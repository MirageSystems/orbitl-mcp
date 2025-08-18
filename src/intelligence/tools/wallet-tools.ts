/**
 * Wallet & Execution Tools
 * Tools focused on wallet connection, transaction simulation, and execution
 */

import { AIClient } from '../client.js';
import { TransactionSystem } from '../../wallet/transaction-system.js';
import { WalletConnectFlow } from '../../wallet/wallet-connect-flow.js';
import { WalletConnect, WALLETCONNECT_CONFIG } from '../../wallet/wallet-connect.js';
import { CLIFormatter } from '../../utils/formatter/cli-formatter.js';
import type { DetailedTransactionPreview } from '../../wallet/types.js';
import { SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from '../../network/sei.js';
import { getTokenResolver } from '../../config/token-resolver.js';
import log from '../../utils/logger.js';

export async function setupWalletTools(ai: AIClient, network: 'mainnet' | 'testnet' = 'mainnet') {
  // Initialize transaction systems for both networks
  const mainnetConfig = SEI_MAINNET_CONFIG;
  const testnetConfig = SEI_TESTNET_CONFIG;
  const mainnetTxSystem = new TransactionSystem(mainnetConfig.rpcUrl, 'mainnet');
  const testnetTxSystem = new TransactionSystem(testnetConfig.rpcUrl, 'testnet');
  
  const getTxSystem = (net?: string) => {
    return (net === 'testnet' || network === 'testnet') ? testnetTxSystem : mainnetTxSystem;
  };

  // ============================================
  // TOOL: CONNECT WALLET
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
  // TOOL: CHECK WALLET CONNECTION
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
  // TOOL: SHOW TRANSACTION PREVIEW
  // ============================================
  ai.registerTool(
    'show_transaction_preview',
    'Display a formatted preview of transaction data for user review',
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
  // TOOL: SIMULATE TRANSACTION
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
        token: {
          type: 'string',
          description: 'Token symbol (USDC, WSEI) or contract address'
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
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['type', 'token', 'fromAddress', 'toAddress', 'amount']
    },
    async (args: { 
      type: 'transfer' | 'approve';
      token: string;
      fromAddress: string;
      toAddress: string;
      amount: string;
      network?: string;
    }) => {
      try {
        const txSystem = getTxSystem(args.network);
        
        console.log(`Simulating ${args.type} transaction...`);
        
        const simulation = await txSystem.simulateTransaction(
          args.type,
          args.token,
          args.fromAddress,
          args.toAddress,
          args.amount
        );
        
        const formattedResult = `
Transaction Simulation
[${simulation.riskLevel}] ${simulation.summary}

Your Balance: ${simulation.senderBefore} → ${simulation.senderAfter}
${simulation.recipientBefore ? `Recipient: ${simulation.recipientBefore} → ${simulation.recipientAfter}` : ''}
Gas Cost: ${simulation.gasCostETH}

${simulation.warnings.length > 0 ? 'Warnings:\n' + simulation.warnings.map(w => `  ${w}`).join('\n') + '\n' : ''}
Orbitl NEVER handles your private keys
`;
        
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
  // TOOL: EXECUTE TRANSACTION
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

  log.info(`Registered wallet and execution tools`);
  return ai;
}