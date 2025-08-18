/**
 * Transaction Building Tools
 * Tools focused on building safe transactions with previews
 */

import { AIClient } from '../client.js';
import { TransactionSystem } from '../../wallet/transaction-system.js';
import { TransactionBuildError } from '../../wallet/types.js';
import { SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from '../../network/sei.js';
import { getTokenResolver } from '../../config/token-resolver.js';
import log from '../../utils/logger.js';

export async function setupTransactionTools(ai: AIClient, network: 'mainnet' | 'testnet' = 'mainnet') {
  // Initialize transaction systems for both networks
  const mainnetConfig = SEI_MAINNET_CONFIG;
  const testnetConfig = SEI_TESTNET_CONFIG;
  const mainnetTxSystem = new TransactionSystem(mainnetConfig.rpcUrl, 'mainnet');
  const testnetTxSystem = new TransactionSystem(testnetConfig.rpcUrl, 'testnet');
  
  const getTxSystem = (net?: string) => {
    return (net === 'testnet' || network === 'testnet') ? testnetTxSystem : mainnetTxSystem;
  };

  // ============================================
  // TOOL: TOKEN LOOKUP
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
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['symbol']
    },
    async (args: { symbol: string; network?: string }) => {
      const resolver = getTokenResolver(args.network as 'mainnet' | 'testnet' || network);
      
      try {
        const token = await resolver.resolveToken(args.symbol);
        return {
          found: true,
          symbol: args.symbol.toUpperCase(),
          address: token.address,
          name: token.name,
          decimals: token.decimals,
          network: args.network || network,
          formatted: resolver.formatTokenInfo(token)
        };
      } catch (error) {
        return {
          found: false,
          symbol: args.symbol.toUpperCase(),
          error: error instanceof Error ? error.message : 'Unknown error',
          availableTokens: resolver.getAvailableTokens(),
          suggestion: `Available tokens: ${resolver.getAvailableTokens().join(', ')}`
        };
      }
    }
  );

  // ============================================
  // TOOL: BUILD TOKEN TRANSFER
  // ============================================
  ai.registerTool(
    'build_token_transfer',
    'Build a safe ERC-20 token transfer transaction with preview (NEVER signs)',
    {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol (USDC, WSEI) or contract address'
        },
        recipient: {
          type: 'string',
          description: 'Recipient wallet address'
        },
        amount: {
          type: 'string',
          description: 'Amount to transfer (e.g., "100.5")'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['token', 'recipient', 'amount']
    },
    async (args: { token: string; recipient: string; amount: string; network?: string }) => {
      try {
        log.info(`Building token transfer: ${args.amount} ${args.token} to ${args.recipient}`);
        
        const txSystem = getTxSystem(args.network);
        const context = {
          recipientName: args.recipient.endsWith('.eth') ? args.recipient : undefined
        };

        const result = await txSystem.buildTransfer(
          args.token,
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
            'Check that the token exists',
            'Verify the recipient address is correct',
            'Ensure the amount format is correct (e.g., "100.5")'
          ]
        };
      }
    }
  );

  // ============================================
  // TOOL: BUILD TOKEN APPROVAL
  // ============================================
  ai.registerTool(
    'build_token_approval',
    'Build a safe ERC-20 token approval transaction with preview (NEVER signs)',
    {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token symbol (USDC, WSEI) or contract address'
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
        spenderName: {
          type: 'string',
          description: 'Known name of the spender (e.g., "Uniswap V3", optional)'
        }
      },
      required: ['token', 'spender', 'amount']
    },
    async (args: { token: string; spender: string; amount: string; network?: string; spenderName?: string }) => {
      try {
        log.info(`Building token approval: ${args.amount} ${args.token} for ${args.spenderName || args.spender}`);
        
        const txSystem = getTxSystem(args.network);
        const context = {
          spenderName: args.spenderName
        };

        const result = await txSystem.buildApproval(
          args.token,
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
            'Check that the token exists',
            'Verify the spender address is correct',
            'Use "unlimited" for max approval or specific amount like "100.5"'
          ]
        };
      }
    }
  );


  log.info(`Registered transaction building tools`);
  return ai;
}