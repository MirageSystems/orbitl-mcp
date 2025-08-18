// Transaction Preview Generator - Creates beautiful, detailed transaction previews
// Converts technical transaction data into user-friendly descriptions

import {
  SafeTransactionData,
  DetailedTransactionPreview,
  PreviewParameter,
  UserConfirmation,
  RiskLevel,
  ParameterType
} from './types.js';
import { TokenInfo } from './token-info.js';

/**
 * Context information for generating better previews
 */
export interface TransactionContext {
  userAddress?: string;                 // User's wallet address
  tokenSymbol?: string;                // Token symbol if known
  amount?: string;                     // Amount being transferred
  recipient?: string;                  // Recipient address
  recipientName?: string;              // ENS name or known name
  spender?: string;                    // Spender address for approvals
  spenderName?: string;                // Known spender name
  fromAddress?: string;                // From address for transferFrom
  fromName?: string;                   // Known from name
}

/**
 * Generates detailed transaction previews with rich context
 * Makes transactions understandable for non-technical users
 */
export class TransactionPreviewGenerator {

  /**
   * Generate detailed preview for any transaction
   * @param txData - Safe transaction data
   * @param context - Additional context for better descriptions
   */
  async generatePreview(
    txData: SafeTransactionData,
    context: TransactionContext = {}
  ): Promise<DetailedTransactionPreview> {
    
    // Detect the transaction type from the data
    const action = this.detectAction(txData);
    
    switch (action) {
      case 'transfer':
        return this.generateTransferPreview(txData, context);
      case 'approve':
        return this.generateApprovalPreview(txData, context);
      case 'transferFrom':
        return this.generateTransferFromPreview(txData, context);
      default:
        return this.generateGenericPreview(txData, context);
    }
  }

  /**
   * Generate preview for ERC-20 transfer transactions
   */
  private async generateTransferPreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): Promise<DetailedTransactionPreview> {
    
    const tokenMetadata = await TokenInfo.getTokenMetadata(txData.transaction.to);
    const formattedAmount = context.amount ? 
      await TokenInfo.formatAmount(context.amount, txData.transaction.to, false) : 
      'tokens';

    const recipientDisplay = context.recipientName || 
      this.formatAddress(context.recipient || 'recipient');

    return {
      title: 'Token Transfer',
      humanDescription: `Transfer ${formattedAmount} to ${recipientDisplay}`,
      
      contractName: `${tokenMetadata.name} (${tokenMetadata.symbol})`,
      contractAddress: txData.transaction.to,
      contractVerified: true, // Could integrate with contract verification APIs
      
      action: 'transfer',
      parameters: [
        {
          name: 'Recipient',
          value: context.recipient || '',
          displayValue: recipientDisplay,
          type: 'address'
        },
        {
          name: 'Amount',
          value: context.amount || '0',
          displayValue: formattedAmount,
          type: 'amount'
        }
      ],
      
      riskLevel: 'LOW',
      riskFactors: [],
      safetyWarnings: [],
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate?.estimatedCost || 'Unknown',
      
      confirmations: [
        {
          type: 'info',
          message: `You are sending ${formattedAmount}`,
          userMustAcknowledge: false
        }
      ]
    };
  }

  /**
   * Generate preview for ERC-20 approval transactions
   */
  private async generateApprovalPreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): Promise<DetailedTransactionPreview> {
    
    const tokenMetadata = await TokenInfo.getTokenMetadata(txData.transaction.to);
    const isUnlimited = Boolean(context.amount === 'unlimited' || 
                       (context.amount && this.isUnlimitedAmount(context.amount)));
    
    const formattedAmount = isUnlimited ? 
      'unlimited' : 
      (context.amount ? await TokenInfo.formatAmount(context.amount, txData.transaction.to, false) : 'tokens');

    const spenderDisplay = context.spenderName || 
      this.formatAddress(context.spender || 'spender');

    const riskLevel: RiskLevel = isUnlimited ? 'MEDIUM' : 'LOW';
    const riskFactors: string[] = isUnlimited ? ['Unlimited approval amount'] : [];
    const safetyWarnings: string[] = isUnlimited ? [
      'This approval allows the spender to take ALL of your tokens',
      'The spender can use this approval at any time in the future',
      'Consider approving only the amount you need'
    ] : [];

    return {
      title: 'Token Approval',
      humanDescription: `Allow ${spenderDisplay} to spend ${formattedAmount}`,
      
      contractName: `${tokenMetadata.name} (${tokenMetadata.symbol})`,
      contractAddress: txData.transaction.to,
      contractVerified: true,
      
      action: 'approve',
      parameters: [
        {
          name: 'Spender',
          value: context.spender || '',
          displayValue: spenderDisplay,
          type: 'address'
        },
        {
          name: 'Amount',
          value: context.amount || '0',
          displayValue: formattedAmount,
          type: 'amount'
        }
      ],
      
      riskLevel,
      riskFactors,
      safetyWarnings,
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate?.estimatedCost || 'Unknown',
      
      confirmations: [
        {
          type: isUnlimited ? 'warning' : 'info',
          message: isUnlimited ? 
            'You are granting unlimited token access - this is risky!' : 
            `You are approving ${formattedAmount} for spending`,
          userMustAcknowledge: isUnlimited
        }
      ]
    };
  }

  /**
   * Generate preview for ERC-20 transferFrom transactions
   */
  private async generateTransferFromPreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): Promise<DetailedTransactionPreview> {
    
    const tokenMetadata = await TokenInfo.getTokenMetadata(txData.transaction.to);
    const formattedAmount = context.amount ? 
      await TokenInfo.formatAmount(context.amount, txData.transaction.to, false) : 
      'tokens';

    const fromDisplay = context.fromName || 
      this.formatAddress(context.fromAddress || 'source');
    const recipientDisplay = context.recipientName || 
      this.formatAddress(context.recipient || 'recipient');

    return {
      title: 'Token Transfer (Using Allowance)',
      humanDescription: `Transfer ${formattedAmount} from ${fromDisplay} to ${recipientDisplay}`,
      
      contractName: `${tokenMetadata.name} (${tokenMetadata.symbol})`,
      contractAddress: txData.transaction.to,
      contractVerified: true,
      
      action: 'transferFrom',
      parameters: [
        {
          name: 'From',
          value: context.fromAddress || '',
          displayValue: fromDisplay,
          type: 'address'
        },
        {
          name: 'To',
          value: context.recipient || '',
          displayValue: recipientDisplay,
          type: 'address'
        },
        {
          name: 'Amount',
          value: context.amount || '0',
          displayValue: formattedAmount,
          type: 'amount'
        }
      ],
      
      riskLevel: 'MEDIUM',
      riskFactors: ['Uses token allowance', 'Requires prior approval'],
      safetyWarnings: [
        'This transaction uses an existing token allowance',
        'Verify that you have permission to spend from the source address'
      ],
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate?.estimatedCost || 'Unknown',
      
      confirmations: [
        {
          type: 'warning',
          message: `You are transferring ${formattedAmount} using an allowance`,
          userMustAcknowledge: true
        }
      ]
    };
  }

  /**
   * Generate generic preview for unknown transaction types
   */
  private generateGenericPreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): DetailedTransactionPreview {
    
    return {
      title: 'Contract Interaction',
      humanDescription: `Execute function on contract ${this.formatAddress(txData.transaction.to)}`,
      
      contractName: 'Smart Contract',
      contractAddress: txData.transaction.to,
      contractVerified: false,
      
      action: 'unknown',
      parameters: [
        {
          name: 'Contract',
          value: txData.transaction.to,
          displayValue: this.formatAddress(txData.transaction.to),
          type: 'address'
        },
        {
          name: 'Data',
          value: txData.transaction.data,
          displayValue: `${txData.transaction.data.slice(0, 20)}...`,
          type: 'string'
        }
      ],
      
      riskLevel: 'HIGH',
      riskFactors: ['Unknown contract interaction', 'Unverified function call'],
      safetyWarnings: [
        'This is an unknown contract interaction',
        'Make sure you trust this contract and understand what it does',
        'Consider getting the transaction reviewed by an expert'
      ],
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate?.estimatedCost || 'Unknown',
      
      confirmations: [
        {
          type: 'critical',
          message: 'You are interacting with an unknown smart contract',
          userMustAcknowledge: true
        }
      ]
    };
  }

  /**
   * Detect transaction action from transaction data
   */
  private detectAction(txData: SafeTransactionData): string {
    if (!txData.transaction.data || txData.transaction.data === '0x') {
      return 'native_transfer';
    }

    // Check function selector (first 4 bytes after 0x)
    const functionSelector = txData.transaction.data.slice(0, 10);
    
    const knownSelectors: Record<string, string> = {
      '0xa9059cbb': 'transfer',        // transfer(address,uint256)
      '0x095ea7b3': 'approve',         // approve(address,uint256)
      '0x23b872dd': 'transferFrom',    // transferFrom(address,address,uint256)
    };

    return knownSelectors[functionSelector] || 'unknown';
  }

  /**
   * Check if an amount represents unlimited approval
   */
  private isUnlimitedAmount(amount: string): boolean {
    try {
      const amountBigInt = BigInt(amount);
      // Check if it's close to max uint256
      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      return amountBigInt > maxUint256 / BigInt(2); // If more than half of max uint256
    } catch {
      return false;
    }
  }

  /**
   * Format address for display (first 6 and last 4 characters)
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Create context from transaction data for simpler usage
   */
  static createContextFromTransaction(
    txData: SafeTransactionData,
    additionalContext?: Partial<TransactionContext>
  ): TransactionContext {
    const context: TransactionContext = {
      ...additionalContext
    };

    // Try to extract context from the transaction data
    if (txData.transaction.data && txData.transaction.data.length > 10) {
      const functionSelector = txData.transaction.data.slice(0, 10);
      
      if (functionSelector === '0xa9059cbb') { // transfer
        // Could decode the recipient and amount from the data
        // For now, use what's provided in additionalContext
      } else if (functionSelector === '0x095ea7b3') { // approve
        // Could decode the spender and amount
      }
    }

    return context;
  }
}