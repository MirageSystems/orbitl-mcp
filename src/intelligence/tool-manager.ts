/**
 * @fileoverview Tool manager for contract analysis tools
 * Registers all tools with the new CloudflareAIToolCaller
 */

import { AIClient } from './client.js';
import { ContractReader } from '../analysis/reader.js';
import { SeiProvider, SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from '../network/sei.js';
import type { ContractData, ABIFunction } from '../analysis/types.js';
import { TransactionInterface } from '../wallet/transaction-interface.js';
import { CLIFormatter } from '../utils/formatter/cli-formatter.js';
import { WalletConnect, WALLETCONNECT_CONFIG } from '../wallet/wallet-connect.js';
import { TransactionSimulator } from '../wallet/transaction-simulator.js';
import { WalletConnectFlow } from '../wallet/wallet-connect-flow.js';
import { TransactionBuildError } from '../wallet/types.js';
import type { DetailedTransactionPreview } from '../wallet/types.js';
import log from '../utils/logger.js';

/**
 * Setup and register all contract analysis tools
 */
export async function setupContractTools(ai: AIClient, network: 'mainnet' | 'testnet' = 'mainnet') {
  // Initialize contract readers for both networks
  const mainnetReader = new ContractReader(new SeiProvider(SEI_MAINNET_CONFIG));
  const testnetReader = new ContractReader(new SeiProvider(SEI_TESTNET_CONFIG));
  
  // Initialize transaction interfaces for both networks
  const mainnetConfig = SEI_MAINNET_CONFIG;
  const testnetConfig = SEI_TESTNET_CONFIG;
  const mainnetTxInterface = new TransactionInterface(mainnetConfig.rpcUrl);
  const testnetTxInterface = new TransactionInterface(testnetConfig.rpcUrl);
  
  const getReader = (net?: string) => {
    return (net === 'testnet' || network === 'testnet') ? testnetReader : mainnetReader;
  };

  const getTxInterface = (net?: string) => {
    return (net === 'testnet' || network === 'testnet') ? testnetTxInterface : mainnetTxInterface;
  };

  // ============================================
  // TOOL 1: ANALYZE CONTRACT
  // ============================================
  ai.registerTool(
    'analyze_contract',
    'Analyze a contract on Sei Network to understand its type, functions, verification status, and safety',
    {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The contract address to analyze (0x...)'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['address']
    },
    async (args: { address: string; network?: string }) => {
      log.contract.analyzing(args.address, args.network || network);
      
      const reader = getReader(args.network);
      const analysis = await reader.read(args.address);
      
      log.contract.analyzed(args.address, analysis.basicType, analysis.functionCount, analysis.isVerified);
      
      const result = {
        address: analysis.address,
        type: analysis.basicType,
        verified: analysis.isVerified,
        network: args.network || network,
        summary: {
          totalFunctions: analysis.functionCount,
          readOnlyFunctions: analysis.readOnlyFunctions.length,
          stateMutatingFunctions: analysis.writeFunctions.length
        },
        keyFunctions: analysis.abi.slice(0, 10).map(func => ({
          name: func.name,
          type: func.stateMutability,
          risk: assessRisk(func),
          description: getFunctionDescription(func),
          signature: ContractReader.formatFunctionSignature(func)
        })),
        risks: getContractRisks(analysis),
        safetyScore: calculateSafetyScore(analysis),
        recommendation: analysis.isVerified ? 
          (analysis.basicType === 'Unknown' ? 'CAUTION' : 'SAFE') : 
          'DANGEROUS'
      };
      
      return result;
    }
  );

  // ============================================
  // TOOL 2: GET FUNCTION DETAILS
  // ============================================
  ai.registerTool(
    'get_function_details',
    'Get detailed information about a specific function in a contract',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address'
        },
        functionName: {
          type: 'string',
          description: 'Name of the function to analyze'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['contract', 'functionName']
    },
    async (args: { contract: string; functionName: string; network?: string }) => {
      const reader = getReader(args.network);
      const analysis = await reader.read(args.contract);
      
      const func = analysis.abi.find(f => 
        f.name.toLowerCase() === args.functionName.toLowerCase()
      );
      
      if (!func) {
        throw new Error(`Function '${args.functionName}' not found in contract`);
      }

      return {
        name: func.name,
        signature: ContractReader.formatFunctionSignature(func),
        inputs: func.inputs.map(input => ({
          name: input.name,
          type: input.type,
          description: getParameterDescription(input.type)
        })),
        outputs: func.outputs?.map(output => ({
          name: output.name || 'result',
          type: output.type,
          description: getParameterDescription(output.type)
        })) || [],
        stateMutability: func.stateMutability,
        risk: assessRisk(func),
        description: getFunctionDescription(func),
        usage: getFunctionUsage(func),
        warnings: getFunctionWarnings(func),
        gasEstimate: getGasEstimate(func)
      };
    }
  );

  // ============================================
  // TOOL 3: CHECK SAFETY
  // ============================================
  ai.registerTool(
    'check_safety',
    'Perform a comprehensive safety check on a contract or specific function',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address to check'
        },
        functionName: {
          type: 'string',
          description: 'Optional: specific function to check'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['contract']
    },
    async (args: { contract: string; functionName?: string; network?: string }) => {
      const reader = getReader(args.network);
      const analysis = await reader.read(args.contract);
      
      if (args.functionName) {
        // Check specific function
        const func = analysis.abi.find(f => 
          f.name.toLowerCase() === args.functionName!.toLowerCase()
        );
        
        if (!func) {
          throw new Error(`Function '${args.functionName}' not found`);
        }
        
        return {
          type: 'function',
          function: args.functionName,
          risk: assessRisk(func),
          warnings: getFunctionWarnings(func),
          safe: ['NONE', 'LOW'].includes(assessRisk(func)),
          recommendation: getFunctionRecommendation(func)
        };
      } else {
        // Check entire contract
        const risks = getContractRisks(analysis);
        const safetyScore = calculateSafetyScore(analysis);
        
        return {
          type: 'contract',
          verified: analysis.isVerified,
          contractType: analysis.basicType,
          safetyScore,
          risks,
          criticalFunctions: analysis.abi
            .filter(f => assessRisk(f) === 'CRITICAL')
            .map(f => f.name),
          highRiskFunctions: analysis.abi
            .filter(f => assessRisk(f) === 'HIGH')
            .map(f => f.name),
          recommendation: safetyScore >= 70 ? 'SAFE' : safetyScore >= 40 ? 'CAUTION' : 'DANGEROUS',
          summary: `This is a ${analysis.isVerified ? 'verified' : 'unverified'} ${analysis.basicType} contract with a safety score of ${safetyScore}/100`
        };
      }
    }
  );

  // ============================================
  // TOOL 4: TOKEN LOOKUP
  // ============================================
  ai.registerTool(
    'lookup_token',
    'Find token contract address by symbol (e.g., USDC, WSEI)',
    {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Token symbol to look up (e.g., USDC, WSEI, USDT)'
        }
      },
      required: ['symbol']
    },
    async (args: { symbol: string }) => {
      // Use centralized token resolver
      const { getTokenResolver } = await import('../config/token-resolver.js');
      
      const resolver = getTokenResolver('mainnet'); // Default to mainnet for lookup
      
      try {
        const token = await resolver.resolveToken(args.symbol);
        return {
          found: true,
          symbol: args.symbol.toUpperCase(),
          address: token.address,
          name: token.name,
          decimals: token.decimals,
          fullName: `${token.name} (${token.symbol})`
        };
      } catch (error) {
        return {
          found: false,
          symbol: args.symbol.toUpperCase(),
          error: error instanceof Error ? error.message : 'Token not found',
          availableTokens: resolver.getAvailableTokens(),
          suggestion: `Available tokens: ${resolver.getAvailableTokens().join(', ')}`
        };
      }
    }
  );

  // ============================================
  // TOOL 5: BUILD TOKEN TRANSFER
  // ============================================
  ai.registerTool(
    'build_token_transfer',
    'Build a safe ERC-20 token transfer transaction with beautiful preview (NEVER signs)',
    {
      type: 'object',
      properties: {
        tokenAddress: {
          type: 'string',
          description: 'The token contract address. Common tokens: USDC=0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a, WSEI=0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456'
        },
        recipient: {
          type: 'string',
          description: 'Recipient wallet address or ENS name'
        },
        amount: {
          type: 'string',
          description: 'Amount to transfer (e.g., "100.5" for 100.5 tokens)'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        },
        tokenSymbol: {
          type: 'string',
          description: 'Token symbol for better display (optional)',
          default: 'TOKEN'
        }
      },
      required: ['tokenAddress', 'recipient', 'amount']
    },
    async (args: { 
      tokenAddress: string; 
      recipient: string; 
      amount: string; 
      network?: string;
      tokenSymbol?: string;
    }) => {
      try {
        log.info(`Building token transfer: ${args.amount} ${args.tokenSymbol || 'tokens'} to ${args.recipient}`);
        
        const txInterface = getTxInterface(args.network);
        const context = {
          tokenSymbol: args.tokenSymbol,
          recipientName: args.recipient.endsWith('.eth') ? args.recipient : undefined
        };

        const result = await txInterface.buildTransferWithPreview(
          args.tokenAddress,
          args.recipient,
          args.amount,
          context
        );

        return {
          success: true,
          transactionData: result.transactionData.transaction,
          preview: result.preview,
          formattedPreview: result.formattedPreview,
          network: args.network || network,
          securityNote: 'Orbitl NEVER handles private keys. You sign with YOUR wallet.',
          instructions: [
            '1. Review the transaction preview above carefully',
            '2. Connect your wallet (we\'ll help with that)',
            '3. Sign the transaction in YOUR wallet',
            '4. Never share private keys with anyone!'
          ]
        };

      } catch (error) {
        const errorMessage = error instanceof TransactionBuildError ? 
          error.message : 
          `Failed to build transfer: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        return {
          success: false,
          error: errorMessage,
          suggestions: error instanceof TransactionBuildError ? error.suggestions : [
            'Check that the token address is valid',
            'Verify the recipient address is correct',
            'Ensure the amount format is correct (e.g., "100.5")'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 5: BUILD TOKEN APPROVAL
  // ============================================
  ai.registerTool(
    'build_token_approval',
    'Build a safe ERC-20 token approval transaction with beautiful preview (NEVER signs)',
    {
      type: 'object',
      properties: {
        tokenAddress: {
          type: 'string',
          description: 'The token contract address'
        },
        spender: {
          type: 'string',
          description: 'Address that will be allowed to spend tokens (e.g., DEX contract)'
        },
        amount: {
          type: 'string',
          description: 'Amount to approve ("unlimited" for max approval, or specific amount like "100.5")'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        },
        tokenSymbol: {
          type: 'string',
          description: 'Token symbol for better display (optional)'
        },
        spenderName: {
          type: 'string',
          description: 'Known name of the spender (e.g., "Uniswap V3", optional)'
        }
      },
      required: ['tokenAddress', 'spender', 'amount']
    },
    async (args: { 
      tokenAddress: string; 
      spender: string; 
      amount: string; 
      network?: string;
      tokenSymbol?: string;
      spenderName?: string;
    }) => {
      try {
        log.info(`Building token approval: ${args.amount} ${args.tokenSymbol || 'tokens'} for ${args.spenderName || args.spender}`);
        
        const txInterface = getTxInterface(args.network);
        const context = {
          tokenSymbol: args.tokenSymbol,
          spenderName: args.spenderName
        };

        const result = await txInterface.buildApprovalWithPreview(
          args.tokenAddress,
          args.spender,
          args.amount,
          context
        );

        return {
          success: true,
          transactionData: result.transactionData.transaction,
          preview: result.preview,
          formattedPreview: result.formattedPreview,
          network: args.network || network,
          riskWarning: args.amount.toLowerCase().includes('unlimited') ? 
            'UNLIMITED APPROVAL: This allows the spender to take ALL of your tokens at any time!' : 
            undefined,
          securityNote: 'Orbitl NEVER handles private keys. You sign with YOUR wallet.',
          instructions: [
            '1. Review the transaction preview and warnings above',
            '2. Consider using specific amounts instead of unlimited approvals',
            '3. Connect your wallet (we\'ll help with that)',
            '4. Sign the transaction in YOUR wallet'
          ]
        };

      } catch (error) {
        const errorMessage = error instanceof TransactionBuildError ? 
          error.message : 
          `Failed to build approval: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        return {
          success: false,
          error: errorMessage,
          suggestions: error instanceof TransactionBuildError ? error.suggestions : [
            'Check that the token address is valid',
            'Verify the spender address is correct',
            'Use "unlimited" for max approval or specific amount like "100.5"'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 6: BUILD TRANSFER FROM
  // ============================================
  ai.registerTool(
    'build_transfer_from',
    'Build a transferFrom transaction using existing token allowance (NEVER signs)',
    {
      type: 'object',
      properties: {
        tokenAddress: {
          type: 'string',
          description: 'The token contract address'
        },
        from: {
          type: 'string',
          description: 'Address to transfer tokens from (must have given approval)'
        },
        to: {
          type: 'string',
          description: 'Address to transfer tokens to'
        },
        amount: {
          type: 'string',
          description: 'Amount to transfer'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        },
        tokenSymbol: {
          type: 'string',
          description: 'Token symbol for better display (optional)'
        }
      },
      required: ['tokenAddress', 'from', 'to', 'amount']
    },
    async (args: { 
      tokenAddress: string; 
      from: string;
      to: string;
      amount: string; 
      network?: string;
      tokenSymbol?: string;
    }) => {
      try {
        log.info(`Building transferFrom: ${args.amount} ${args.tokenSymbol || 'tokens'} from ${args.from} to ${args.to}`);
        
        const txInterface = getTxInterface(args.network);
        const context = {
          tokenSymbol: args.tokenSymbol,
          fromName: args.from.endsWith('.eth') ? args.from : undefined,
          recipientName: args.to.endsWith('.eth') ? args.to : undefined
        };

        const result = await txInterface.buildTransferFromWithPreview(
          args.tokenAddress,
          args.from,
          args.to,
          args.amount,
          context
        );

        return {
          success: true,
          transactionData: result.transactionData.transaction,
          preview: result.preview,
          formattedPreview: result.formattedPreview,
          network: args.network || network,
          allowanceWarning: 'This transaction requires existing token allowance from the source address',
          securityNote: 'Orbitl NEVER handles private keys. You sign with YOUR wallet.',
          instructions: [
            '1. Ensure you have permission to spend from the source address',
            '2. Review the transaction preview above',
            '3. Connect your wallet (we\'ll help with that)',
            '4. Sign the transaction in YOUR wallet'
          ]
        };

      } catch (error) {
        const errorMessage = error instanceof TransactionBuildError ? 
          error.message : 
          `Failed to build transferFrom: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        return {
          success: false,
          error: errorMessage,
          suggestions: error instanceof TransactionBuildError ? error.suggestions : [
            'Check that all addresses are valid',
            'Verify you have approval to spend from the source address',
            'Ensure the amount format is correct'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 5: ESTIMATE GAS
  // ============================================
  ai.registerTool(
    'estimate_gas',
    'Estimate gas costs for a contract function call',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address'
        },
        method: {
          type: 'string',
          description: 'Function name'
        },
        args: {
          type: 'array',
          description: 'Function arguments',
          items: { type: 'string' }
        }
      },
      required: ['contract', 'method']
    },
    async (args: { contract: string; method: string; args?: string[] }) => {
      const reader = getReader();
      const analysis = await reader.read(args.contract);
      
      const func = analysis.abi.find(f => 
        f.name.toLowerCase() === args.method.toLowerCase()
      );
      
      if (!func) {
        throw new Error(`Function '${args.method}' not found in contract`);
      }

      const baseGas = 21000;
      const functionGas = getGasEstimate(func);
      const totalGas = baseGas + functionGas;
      
      return {
        function: args.method,
        gasLimit: totalGas.toString(),
        estimatedCost: `~${totalGas.toLocaleString()} gas units`,
        recommendation: 'Add 20% buffer for safety',
        breakdown: {
          baseTransaction: baseGas,
          functionExecution: functionGas,
          total: totalGas
        },
        notes: func.stateMutability === 'payable' ? 
          ['This function requires sending SEI', 'Gas costs may vary based on network congestion'] :
          ['Gas costs may vary based on network congestion']
      };
    }
  );

  // ============================================
  // TOOL 7: CONNECT WALLET
  // ============================================
  ai.registerTool(
    'connect_wallet',
    'Generate QR code to safely connect user wallet via WalletConnect (NEVER handles private keys)',
    {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          description: 'Network to connect to: mainnet or testnet',
          enum: ['mainnet', 'testnet'],
          default: 'mainnet'
        }
      }
    },
    async (args: { network?: string }) => {
      try {
        log.info(`Initializing WalletConnect for ${args.network || network}`);
        
        const wallet = new WalletConnect(WALLETCONNECT_CONFIG);
        await wallet.initialize();
        
        const selectedChains = [(args.network === 'testnet') ? "eip155:1328" : "eip155:1329"];
        const { uri, qrCodeData } = await wallet.generateConnectionURI();

        return {
          success: true,
          connectionUri: uri,
          qrCodeData,
          instructions: [
            'WalletConnect Session Ready',
            '',
            'Scan the QR code above with your mobile wallet app:',
            '  • MetaMask Mobile',
            '  • Trust Wallet', 
            '  • Rainbow Wallet',
            '  • Any WalletConnect-compatible wallet',
            '',
            'SECURITY: Orbitl NEVER sees your private keys!',
            '   Your keys stay safely in YOUR wallet.',
            '',
            'Connection will timeout in 2 minutes if not accepted.'
          ],
          securityNote: 'WalletConnect is a secure protocol. Your private keys never leave your device.',
          networkInfo: {
            network: args.network || network,
            chainId: (args.network === 'testnet') ? '1328' : '1329',
            name: (args.network === 'testnet') ? 'Sei Atlantic-2 (Testnet)' : 'Sei Pacific-1 (Mainnet)'
          }
        };

      } catch (error) {
        return {
          success: false,
          error: `Failed to initialize wallet connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: [
            'Check your internet connection',
            'Make sure you have a WalletConnect-compatible wallet app installed',
            'Try again in a few moments'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 8: CHECK WALLET CONNECTION
  // ============================================
  ai.registerTool(
    'check_wallet_connection',
    'Check if a wallet is currently connected via WalletConnect',
    {
      type: 'object',
      properties: {}
    },
    async () => {
      try {
        // Note: This is a simplified check. In a full implementation,
        // we'd maintain wallet connection state in a session manager
        return {
          connected: false,
          message: 'No active wallet connection found',
          instructions: [
            'Use the "connect_wallet" tool to establish a connection',
            'Make sure to scan the QR code with your mobile wallet',
            'Accept the connection request in your wallet app'
          ],
          securityNote: 'Orbitl NEVER stores wallet connection state with private keys'
        };
      } catch (error) {
        return {
          connected: false,
          error: `Error checking wallet connection: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  );

  // ============================================
  // TOOL 9: SHOW TRANSACTION PREVIEW
  // ============================================
  ai.registerTool(
    'show_transaction_preview',
    'Display a beautiful formatted preview of transaction data for user review',
    {
      type: 'object',
      properties: {
        transactionData: {
          type: 'object',
          description: 'Transaction data from build_token_* tools'
        },
        preview: {
          type: 'object', 
          description: 'Preview data from build_token_* tools'
        },
        network: {
          type: 'string',
          description: 'Network the transaction is for'
        }
      },
      required: ['transactionData', 'preview']
    },
    async (args: { transactionData: any; preview: any; network?: string }) => {
      try {
        // The transaction tools already return formatted previews,
        // but this tool can be used to re-display or format differently
        const preview = args.preview as DetailedTransactionPreview;
        const formattedPreview = CLIFormatter.formatTransactionPreview(preview);

        return {
          success: true,
          formattedPreview,
          summary: {
            action: preview.action,
            riskLevel: preview.riskLevel,
            totalCost: preview.totalCost,
            contractVerified: preview.contractVerified
          },
          instructions: [
            'Review the transaction details above carefully',
            'Pay special attention to risk warnings',
            'Check the gas cost estimate', 
            'Connect your wallet when ready to sign',
            'NEVER share your private keys with anyone!'
          ],
          nextSteps: [
            'If everything looks correct, use "connect_wallet" to establish connection',
            'Once connected, you can sign this transaction in YOUR wallet',
            'The transaction will be submitted to the network after signing'
          ]
        };

      } catch (error) {
        return {
          success: false,
          error: `Failed to format transaction preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: [
            'Make sure the transaction data is valid',
            'Try rebuilding the transaction if needed'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 10: SIMULATE TRANSACTION
  // ============================================
  ai.registerTool(
    'simulate_transaction',
    'Simulate a transaction to show what will happen before signing (balance changes, risks)',
    {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Transaction type: transfer or approve',
          enum: ['transfer', 'approve']
        },
        tokenAddress: {
          type: 'string',
          description: 'Token contract address'
        },
        fromAddress: {
          type: 'string',
          description: 'YOUR wallet address (the sender - you need to provide this)'
        },
        toAddress: {
          type: 'string',
          description: 'Recipient address where tokens will be sent (different from fromAddress)'
        },
        amount: {
          type: 'string',
          description: 'Amount to transfer/approve (e.g., "100.5" or "unlimited")'
        },
        tokenSymbol: {
          type: 'string',
          description: 'Token symbol (e.g., USDC, WSEI)',
          default: 'TOKEN'
        },
        decimals: {
          type: 'number',
          description: 'Token decimals (18 for most tokens, 6 for USDC)',
          default: 18
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['type', 'tokenAddress', 'fromAddress', 'toAddress', 'amount']
    },
    async (args: { 
      type: 'transfer' | 'approve';
      tokenAddress: string;
      fromAddress: string;
      toAddress: string;
      amount: string;
      tokenSymbol?: string;
      decimals?: number;
      network?: string;
    }) => {
      try {
        const config = (args.network === 'testnet') ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
        const simulator = new TransactionSimulator(config.rpcUrl);
        
        console.log(`Simulating ${args.type} transaction...`);
        
        let simulation;
        
        if (args.type === 'transfer') {
          simulation = await simulator.simulateTransfer(
            args.tokenAddress,
            args.fromAddress,
            args.toAddress,
            args.amount,
            args.tokenSymbol || 'TOKEN',
            args.decimals || 18
          );
        } else {
          simulation = await simulator.simulateApproval(
            args.tokenAddress,
            args.fromAddress,
            args.toAddress,
            args.amount,
            args.tokenSymbol || 'TOKEN'
          );
        }
        
        const formattedResult = TransactionSimulator.formatSimulation(simulation);
        
        return {
          success: true,
          simulation,
          formattedResult,
          network: args.network || network,
          nextSteps: simulation.riskLevel === 'CRITICAL' ? 
            [
              'DO NOT PROCEED - Critical risk detected',
              'Review warnings carefully',
              'Double-check all addresses and amounts'
            ] :
            [
              'Simulation complete - review results above',
              'Use "execute_transaction" if ready to sign',
              'Your keys stay in YOUR wallet'
            ]
        };
        
      } catch (error) {
        return {
          success: false,
          error: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: [
            'Check all addresses are valid',
            'Verify token contract exists',
            'Ensure network connection is working'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL 11: EXECUTE TRANSACTION
  // ============================================
  ai.registerTool(
    'execute_transaction',
    'Execute a transaction: show QR code, connect wallet, and send for signing',
    {
      type: 'object',
      properties: {
        transactionData: {
          type: 'object',
          description: 'Transaction data from build_token_* tools'
        },
        skipConnection: {
          type: 'boolean',
          description: 'Skip connection step if wallet already connected',
          default: false
        }
      },
      required: ['transactionData']
    },
    async (args: { transactionData: any; skipConnection?: boolean }) => {
      try {
        const walletFlow = new WalletConnectFlow();
        
        console.log('Starting transaction execution flow...');
        
        // Execute complete flow (connect + send)
        const result = await walletFlow.executeTransaction(args.transactionData);
        
        if (result.success) {
          return {
            success: true,
            message: result.message,
            transactionHash: result.transactionHash,
            status: 'completed',
            summary: 'Transaction signed and submitted successfully!',
            securityReminder: 'Your private keys never left your wallet device',
            nextSteps: [
              `Track transaction: ${result.transactionHash}`,
              'Wait for network confirmation (usually 1-2 minutes)',
              'Transaction will appear in your wallet history'
            ]
          };
        } else {
          return {
            success: false,
            error: result.error || result.message,
            troubleshooting: [
              'Make sure your wallet app is open',
              'Check your internet connection',
              'Try refreshing the QR code',
              'Ensure you have enough balance for gas fees'
            ]
          };
        }
        
      } catch (error) {
        return {
          success: false,
          error: `Transaction execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: [
            'Check wallet connection',
            'Verify transaction data is valid',
            'Try again with a fresh connection'
          ]
        };
      }
    }
  );

  log.info(`✅ Registered ${ai.getRegisteredTools().length} contract analysis and transaction tools`);
  return ai;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function assessRisk(func: ABIFunction): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const dangerous = ['selfdestruct', 'delegatecall', 'kill', 'suicide'];
  const risky = ['approve', 'transfer', 'transferfrom', 'setowner', 'withdraw'];
  const medium = ['mint', 'burn', 'swap'];
  
  const name = func.name.toLowerCase();
  
  if (dangerous.some(d => name.includes(d))) return 'CRITICAL';
  if (risky.some(r => name.includes(r))) return 'HIGH';
  if (func.stateMutability === 'view' || func.stateMutability === 'pure') return 'NONE';
  if (func.stateMutability === 'payable') return 'MEDIUM';
  if (medium.some(m => name.includes(m))) return 'MEDIUM';
  
  return 'LOW';
}

function getFunctionDescription(func: ABIFunction): string {
  const descriptions: Record<string, string> = {
    'transfer': 'Send tokens to another address',
    'approve': 'Allow another address to spend your tokens',
    'swap': 'Exchange one token for another',
    'mint': 'Create new tokens',
    'burn': 'Destroy tokens',
    'stake': 'Lock tokens to earn rewards',
    'unstake': 'Unlock staked tokens',
    'claimrewards': 'Collect earned rewards',
    'addliquidity': 'Provide tokens to liquidity pool',
    'removeliquidity': 'Remove tokens from liquidity pool',
    'balanceof': 'Check token balance',
    'allowance': 'Check spending allowance',
    'totalsupply': 'Get total token supply'
  };
  
  const name = func.name.toLowerCase();
  for (const [key, description] of Object.entries(descriptions)) {
    if (name.includes(key)) {
      return description;
    }
  }
  
  return func.stateMutability === 'view' || func.stateMutability === 'pure' ?
    `View ${func.name} data` : `Execute ${func.name}`;
}

function getFunctionUsage(func: ABIFunction): string {
  if (func.inputs.length === 0) {
    return `Call ${func.name}() with no parameters`;
  }
  
  const params = func.inputs.map(input => `${input.name}: ${input.type}`).join(', ');
  return `Call ${func.name}(${params})`;
}

function getFunctionWarnings(func: ABIFunction): string[] {
  const warnings: string[] = [];
  const risk = assessRisk(func);
  
  if (risk === 'CRITICAL') {
    warnings.push('CRITICAL: This function can destroy the contract or steal funds');
  } else if (risk === 'HIGH') {
    warnings.push('HIGH RISK: This function can transfer your assets');
  }
  
  if (func.stateMutability === 'payable') {
    warnings.push('This function requires sending SEI tokens');
  }
  
  if (func.name.toLowerCase().includes('approve')) {
    warnings.push('Approval functions can allow unlimited spending - be careful with amounts');
  }
  
  return warnings;
}

function getFunctionRecommendation(func: ABIFunction): string {
  const risk = assessRisk(func);
  
  switch (risk) {
    case 'CRITICAL': return 'DO NOT USE - This function is extremely dangerous';
    case 'HIGH': return 'Use with extreme caution - Double check all parameters';
    case 'MEDIUM': return 'Safe to use - Review parameters before calling';
    case 'LOW': return 'Generally safe to use';
    case 'NONE': return 'Safe to call - Read-only function';
    default: return 'Review function carefully before use';
  }
}

function getParameterDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'address': 'Ethereum/Sei address (0x...)',
    'uint256': 'Large unsigned integer (typically token amounts)',
    'uint': 'Unsigned integer',
    'bool': 'True or false value',
    'bytes': 'Binary data',
    'string': 'Text string'
  };
  
  for (const [key, description] of Object.entries(descriptions)) {
    if (type.includes(key)) {
      return description;
    }
  }
  
  return `${type} value`;
}

function getGasEstimate(func: ABIFunction): number {
  const name = func.name.toLowerCase();
  
  // Gas estimates based on common function patterns
  if (name.includes('transfer')) return 65000;
  if (name.includes('approve')) return 45000;
  if (name.includes('swap')) return 150000;
  if (name.includes('stake') || name.includes('deposit')) return 100000;
  if (name.includes('mint')) return 80000;
  if (name.includes('burn')) return 60000;
  if (func.stateMutability === 'view' || func.stateMutability === 'pure') return 3000;
  
  return 50000; // Default estimate
}

function getContractRisks(analysis: ContractData): string[] {
  const risks: string[] = [];
  
  if (!analysis.isVerified) {
    risks.push('Contract source code is not verified - high risk');
  }
  
  const criticalFuncs = analysis.abi.filter(f => assessRisk(f) === 'CRITICAL');
  if (criticalFuncs.length > 0) {
    risks.push(`Contains ${criticalFuncs.length} critical risk function(s)`);
  }
  
  const payableFuncs = analysis.abi.filter(f => f.stateMutability === 'payable');
  if (payableFuncs.length > 5) {
    risks.push('Many functions require sending funds - review carefully');
  }
  
  if (analysis.basicType === 'Unknown') {
    risks.push('Unknown contract type - purpose unclear');
  }
  
  return risks;
}

function calculateSafetyScore(analysis: ContractData): number {
  let score = 50; // Base score
  
  // Verification bonus
  if (analysis.isVerified) score += 30;
  
  // Risk penalties
  const criticalCount = analysis.abi.filter(f => assessRisk(f) === 'CRITICAL').length;
  const highCount = analysis.abi.filter(f => assessRisk(f) === 'HIGH').length;
  
  score -= criticalCount * 20;
  score -= highCount * 5;
  
  // Type bonus
  if (analysis.basicType === 'Token') score += 15;
  if (analysis.basicType === 'DEX') score += 10;
  if (analysis.basicType === 'Farm') score += 5;
  
  return Math.max(0, Math.min(100, score));
}