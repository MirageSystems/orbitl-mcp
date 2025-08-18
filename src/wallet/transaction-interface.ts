// Transaction Interface - High-level interface combining all wallet components
// Provides a complete transaction building and preview system

import { SafeTransactionBuilder } from './transaction-builder.js';
import { CLIFormatter } from '../utils/formatter/cli-formatter.js';
import { 
  SafeTransactionData, 
  DetailedTransactionPreview,
  TransactionBuildError,
  ValidationError,
  TransactionContext
} from './types.js';

/**
 * High-level interface for building and previewing transactions
 * Combines transaction building, preview generation, and formatting
 */
export class TransactionInterface {
  private builder: SafeTransactionBuilder;

  constructor(rpcUrl: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.builder = new SafeTransactionBuilder(rpcUrl, network);
  }

  /**
   * Build and preview a token transfer transaction
   * @param tokenAddress - Token contract address
   * @param to - Recipient address
   * @param amount - Amount to transfer
   * @param context - Additional context for better previews
   * @returns Object with transaction data and formatted preview
   */
  async buildTransferWithPreview(
    tokenAddress: string,
    to: string,
    amount: string,
    context: TransactionContext = {}
  ): Promise<{
    transactionData: SafeTransactionData;
    preview: DetailedTransactionPreview;
    formattedPreview: string;
  }> {
    try {
      // Build the transaction
      const transactionData = await this.builder.buildTransfer(
        tokenAddress,
        to,
        amount,
        context
      );

      const preview: DetailedTransactionPreview = {
        action: `Transfer ${amount} tokens to ${to}`,
        riskLevel: transactionData.preview.riskLevel,
        contractVerified: true,
        totalCost: transactionData.gasEstimate?.estimatedCost || 'Unknown',
        warnings: transactionData.preview.warnings
      };

      const formattedPreview = CLIFormatter.formatTransactionPreview(preview);

      return {
        transactionData,
        preview,
        formattedPreview
      };

    } catch (error) {
      if (error instanceof TransactionBuildError) {
        throw error;
      }
      throw new TransactionBuildError(
        `Failed to build transfer preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFER_PREVIEW_FAILED',
        ['Check all parameters are valid', 'Verify network connection']
      );
    }
  }

  /**
   * Build and preview a token approval transaction
   * @param tokenAddress - Token contract address
   * @param spender - Address to approve for spending
   * @param amount - Amount to approve ('unlimited' for max)
   * @param context - Additional context for better previews
   */
  async buildApprovalWithPreview(
    tokenAddress: string,
    spender: string,
    amount: string,
    context: TransactionContext = {}
  ): Promise<{
    transactionData: SafeTransactionData;
    preview: DetailedTransactionPreview;
    formattedPreview: string;
  }> {
    try {
      // Build the transaction
      const transactionData = await this.builder.buildApproval(
        tokenAddress,
        spender,
        amount,
        context
      );

      const preview: DetailedTransactionPreview = {
        action: `Approve ${amount} token spending by ${spender}`,
        riskLevel: transactionData.preview.riskLevel,
        contractVerified: true,
        totalCost: transactionData.gasEstimate?.estimatedCost || 'Unknown',
        warnings: transactionData.preview.warnings
      };

      const formattedPreview = CLIFormatter.formatTransactionPreview(preview);

      return {
        transactionData,
        preview,
        formattedPreview
      };

    } catch (error) {
      if (error instanceof TransactionBuildError) {
        throw error;
      }
      throw new TransactionBuildError(
        `Failed to build approval preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_PREVIEW_FAILED',
        ['Check all parameters are valid', 'Verify spender address is correct']
      );
    }
  }

  /**
   * Build and preview a transferFrom transaction
   * @param tokenAddress - Token contract address
   * @param from - Address to transfer from
   * @param to - Address to transfer to
   * @param amount - Amount to transfer
   * @param context - Additional context for better previews
   */
  async buildTransferFromWithPreview(
    tokenAddress: string,
    from: string,
    to: string,
    amount: string,
    context: TransactionContext = {}
  ): Promise<{
    transactionData: SafeTransactionData;
    preview: DetailedTransactionPreview;
    formattedPreview: string;
  }> {
    try {
      // Build the transaction
      const transactionData = await this.builder.buildTransferFrom(
        tokenAddress,
        from,
        to,
        amount
      );

      const preview: DetailedTransactionPreview = {
        action: `Transfer ${amount} tokens from ${from} to ${to}`,
        riskLevel: transactionData.preview.riskLevel,
        contractVerified: true,
        totalCost: transactionData.gasEstimate?.estimatedCost || 'Unknown',
        warnings: transactionData.preview.warnings
      };

      const formattedPreview = CLIFormatter.formatTransactionPreview(preview);

      return {
        transactionData,
        preview,
        formattedPreview
      };

    } catch (error) {
      if (error instanceof TransactionBuildError) {
        throw error;
      }
      throw new TransactionBuildError(
        `Failed to build transferFrom preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFERFROM_PREVIEW_FAILED',
        ['Check all addresses are valid', 'Verify allowance exists']
      );
    }
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{ chainId: number; name: string }> {
    return this.builder.getNetworkInfo();
  }

  /**
   * Validate transaction parameters without building
   * @param params - Transaction parameters to validate
   * @returns Validation result with helpful messages
   */
  validateTransactionParams(params: {
    type: 'transfer' | 'approval' | 'transferFrom';
    tokenAddress?: string;
    to?: string;
    from?: string;
    spender?: string;
    amount?: string;
  }): { isValid: boolean; errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Common validations
    if (params.tokenAddress && !this.isValidAddress(params.tokenAddress)) {
      errors.push('Invalid token contract address');
      suggestions.push('Ensure the address is a valid Ethereum/Sei address starting with 0x');
    }

    if (params.amount && !this.isValidAmount(params.amount)) {
      errors.push('Invalid amount format');
      suggestions.push('Use decimal numbers (e.g., "100.5") or "unlimited" for approvals');
    }

    // Type-specific validations
    switch (params.type) {
      case 'transfer':
        if (params.to && !this.isValidAddress(params.to)) {
          errors.push('Invalid recipient address');
          suggestions.push('Check the recipient address format');
        }
        break;

      case 'approval':
        if (params.spender && !this.isValidAddress(params.spender)) {
          errors.push('Invalid spender address');
          suggestions.push('Check the spender address format');
        }
        break;

      case 'transferFrom':
        if (params.from && !this.isValidAddress(params.from)) {
          errors.push('Invalid from address');
          suggestions.push('Check the from address format');
        }
        if (params.to && !this.isValidAddress(params.to)) {
          errors.push('Invalid to address');
          suggestions.push('Check the to address format');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Helper methods for validation
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidAmount(amount: string): boolean {
    if (amount === 'unlimited' || amount === 'max' || amount === 'maximum') {
      return true;
    }
    return /^\d*\.?\d+$/.test(amount) && parseFloat(amount) > 0;
  }

  /**
   * Format error for display
   */
  static formatError(error: Error): string {
    if (error instanceof TransactionBuildError) {
      return CLIFormatter.formatError(error.message, error.suggestions);
    } else if (error instanceof ValidationError) {
      return CLIFormatter.formatError(
        `Validation Error (${error.field}): ${error.message}`,
        error.suggestions
      );
    } else {
      return CLIFormatter.formatError(
        error.message,
        ['Check your inputs and try again', 'Verify network connection']
      );
    }
  }

  /**
   * Create a simple transaction preview for display without building
   * Useful for showing what a transaction would do before building it
   */
  static formatTransactionIntent(
    type: 'transfer' | 'approval' | 'transferFrom',
    params: {
      tokenSymbol?: string;
      amount?: string;
      to?: string;
      from?: string;
      spender?: string;
    }
  ): string {
    const token = params.tokenSymbol || 'tokens';
    
    let intent = '';
    switch (type) {
      case 'transfer':
        intent = `Transfer ${params.amount || '?'} ${token} to ${params.to || 'recipient'}`;
        break;
      case 'approval':
        intent = `Approve ${params.spender || 'spender'} to spend ${params.amount || '?'} ${token}`;
        break;
      case 'transferFrom':
        intent = `Transfer ${params.amount || '?'} ${token} from ${params.from || 'source'} to ${params.to || 'recipient'}`;
        break;
    }

    return CLIFormatter.formatError(`Would you like to proceed with: ${intent}`, [
      'Review the parameters carefully',
      'Type "yes" to build the transaction',
      'Type "no" to cancel'
    ]);
  }
}