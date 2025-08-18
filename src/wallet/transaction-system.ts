/**
 * Consolidated Transaction System
 * Unified interface for all transaction operations: building, validation, simulation, and execution
 */

import { SafeTransactionBuilder } from './transaction-builder.js';
import { TransactionSimulator } from './transaction-simulator.js';
import { TransactionValidator } from './validator.js';
import { GasEstimator } from './gas-estimator.js';
import { BalanceFetcher } from './balance-fetcher.js';
import { WalletConnectFlow } from './wallet-connect-flow.js';
import { CLIFormatter } from '../utils/formatter/cli-formatter.js';
import { getTokenResolver } from '../config/token-resolver.js';
import { 
  SafeTransactionData, 
  TransactionBuildError,
  ValidationError,
  TransactionData
} from './types.js';

export interface TransactionContext {
  tokenSymbol?: string;
  recipientName?: string;
  spenderName?: string;
  fromName?: string;
}

export interface TransactionPreview {
  action: string;
  tokenSymbol: string;
  amount: string;
  fromAddress?: string;
  toAddress?: string;
  contractVerified: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  gasEstimate: string;
  totalCost: string;
  warnings: string[];
  balanceChanges: {
    before: string;
    after: string;
  };
}

/**
 * Consolidated transaction system combining all wallet operations
 * Replaces multiple separate classes with one unified interface
 */
export class TransactionSystem {
  private builder: SafeTransactionBuilder;
  private simulator: TransactionSimulator;
  private gasEstimator: GasEstimator;
  private balanceFetcher: BalanceFetcher;
  private walletFlow: WalletConnectFlow;
  private network: 'mainnet' | 'testnet';

  /**
   * Initialize consolidated transaction system
   * @param rpcUrl - Sei network RPC endpoint
   * @param network - Target network (mainnet or testnet)
   */
  constructor(rpcUrl: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.builder = new SafeTransactionBuilder(rpcUrl);
    this.simulator = new TransactionSimulator(rpcUrl);
    this.gasEstimator = new GasEstimator(rpcUrl);
    this.balanceFetcher = new BalanceFetcher(rpcUrl);
    this.walletFlow = new WalletConnectFlow();
    this.network = network;
  }

  /**
   * Build and preview a token transfer transaction
   * @param tokenInput - Token symbol (USDC, WSEI) or contract address
   * @param to - Recipient wallet address  
   * @param amount - Amount to transfer (e.g., "100.5")
   * @param context - Additional context for better UX
   * @returns Transaction data, preview, and formatted output
   */
  async buildTransfer(
    tokenInput: string,
    to: string,
    amount: string,
    context: TransactionContext = {}
  ): Promise<{
    transactionData: SafeTransactionData;
    preview: TransactionPreview;
    formattedPreview: string;
  }> {
    try {
      // 1. Resolve token
      const resolver = getTokenResolver(this.network);
      const tokenInfo = await resolver.resolveToken(tokenInput);
      
      // 2. Build transaction
      const transactionData = await this.builder.buildTransfer(
        tokenInfo.address,
        to,
        amount,
        context
      );

      // 3. Generate preview
      const preview = await this.generatePreview(
        transactionData,
        {
          ...context,
          tokenSymbol: tokenInfo.symbol,
          amount,
          toAddress: to,
          action: 'transfer'
        }
      );

      // 4. Format for display
      const formattedPreview = this.formatPreview(preview);

      return { transactionData, preview, formattedPreview };

    } catch (error) {
      if (error instanceof TransactionBuildError) {
        throw error;
      }
      throw new TransactionBuildError(
        `Failed to build transfer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFER_BUILD_FAILED',
        ['Check token exists', 'Verify recipient address', 'Ensure amount format is correct']
      );
    }
  }

  /**
   * Build and preview a token approval transaction
   * @param tokenInput - Token symbol (USDC, WSEI) or contract address
   * @param spender - Address that will be allowed to spend tokens
   * @param amount - Amount to approve ("unlimited" for max approval)
   * @param context - Additional context for better UX
   * @returns Transaction data, preview, and formatted output
   */
  async buildApproval(
    tokenInput: string,
    spender: string,
    amount: string,
    context: TransactionContext = {}
  ): Promise<{
    transactionData: SafeTransactionData;
    preview: TransactionPreview;
    formattedPreview: string;
  }> {
    try {
      // 1. Resolve token
      const resolver = getTokenResolver(this.network);
      const tokenInfo = await resolver.resolveToken(tokenInput);
      
      // 2. Build transaction
      const transactionData = await this.builder.buildApproval(
        tokenInfo.address,
        spender,
        amount,
        context
      );

      // 3. Generate preview
      const preview = await this.generatePreview(
        transactionData,
        {
          ...context,
          tokenSymbol: tokenInfo.symbol,
          amount,
          toAddress: spender,
          action: 'approval'
        }
      );

      // 4. Format for display
      const formattedPreview = this.formatPreview(preview);

      return { transactionData, preview, formattedPreview };

    } catch (error) {
      if (error instanceof TransactionBuildError) {
        throw error;
      }
      throw new TransactionBuildError(
        `Failed to build approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'APPROVAL_BUILD_FAILED',
        ['Check token exists', 'Verify spender address', 'Use valid amount or "unlimited"']
      );
    }
  }

  /**
   * Simulate transaction to show balance changes and risks
   * @param type - Transaction type (transfer or approve)
   * @param tokenInput - Token symbol or contract address
   * @param fromAddress - Sender wallet address
   * @param toAddress - Recipient or spender address  
   * @param amount - Amount to transfer/approve
   * @returns Simulation results with balance changes and risk assessment
   */
  async simulateTransaction(
    type: 'transfer' | 'approve',
    tokenInput: string,
    fromAddress: string,
    toAddress: string,
    amount: string
  ) {
    const resolver = getTokenResolver(this.network);
    const tokenInfo = await resolver.resolveToken(tokenInput);
    
    if (type === 'transfer') {
      return await this.simulator.simulateTransfer(
        tokenInfo.address,
        fromAddress,
        toAddress,
        amount,
        tokenInfo.symbol,
        tokenInfo.decimals
      );
    } else {
      return await this.simulator.simulateApproval(
        tokenInfo.address,
        fromAddress,
        toAddress,
        amount,
        tokenInfo.symbol
      );
    }
  }

  /**
   * Execute transaction through WalletConnect
   * @param transactionData - Built transaction data ready for signing
   * @returns Execution result with transaction hash or error details
   */
  async executeTransaction(transactionData: TransactionData) {
    return await this.walletFlow.executeTransaction(transactionData);
  }

  /**
   * Connect wallet via WalletConnect
   * @returns Connection result with QR code and status
   */
  async connectWallet() {
    return await this.walletFlow.showQRAndConnect();
  }

  /**
   * Validate transaction parameters before building
   * @param params - Transaction parameters to validate
   * @returns Array of validation results with errors and suggestions
   */
  validateTransaction(params: {
    tokenAddress?: string;
    to?: string;
    amount?: string;
  }) {
    const results = [];
    
    if (params.tokenAddress) {
      results.push(TransactionValidator.validateAddress(params.tokenAddress, 'Token'));
    }
    
    if (params.to) {
      results.push(TransactionValidator.validateAddress(params.to, 'Recipient'));
    }
    
    if (params.amount) {
      results.push(TransactionValidator.validateAmount(params.amount));
    }
    
    return results;
  }

  /**
   * Generate transaction preview
   */
  private async generatePreview(
    transactionData: SafeTransactionData,
    context: TransactionContext & {
      action: string;
      amount: string;
      tokenSymbol?: string;
      toAddress?: string;
      fromAddress?: string;
    }
  ): Promise<TransactionPreview> {
    const warnings: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    
    // Basic risk assessment
    if (context.action === 'approval' && context.amount?.toLowerCase().includes('unlimited')) {
      warnings.push('UNLIMITED APPROVAL: Spender can take ALL your tokens');
      riskLevel = 'HIGH';
    }
    
    // Check for burn address
    if (context.toAddress === '0x0000000000000000000000000000000000000000') {
      warnings.push('BURN ADDRESS: Tokens will be lost forever');
      riskLevel = 'CRITICAL';
    }
    
    // Estimate gas
    const gasEstimate = await this.gasEstimator.estimateTransaction(transactionData.transaction);
    
    // Get balance changes (simplified)
    let balanceChanges = { before: 'Loading...', after: 'Loading...' };
    if (context.fromAddress && context.tokenSymbol) {
      try {
        const resolver = getTokenResolver(this.network);
        const token = await resolver.getTokenBySymbol(context.tokenSymbol);
        if (token) {
          const balance = await this.balanceFetcher.getTokenBalance(
            token.address,
            context.fromAddress,
            token.decimals,
            context.tokenSymbol
          );
          balanceChanges.before = balance.currentFormatted;
          
          if (context.action === 'transfer') {
            const afterBalance = this.balanceFetcher.calculateAfterTransfer(
              balance,
              BigInt(context.amount || '0'),
              true
            );
            balanceChanges.after = afterBalance.afterFormatted || 'Error calculating';
          } else {
            balanceChanges.after = `${balance.currentFormatted} (no change)`;
          }
        }
      } catch (error) {
        balanceChanges = { before: 'Unable to fetch', after: 'Unable to calculate' };
      }
    }
    
    return {
      action: context.action === 'transfer' ? 'Token Transfer' : 'Token Approval',
      tokenSymbol: context.tokenSymbol || 'TOKEN',
      amount: context.amount,
      fromAddress: context.fromAddress,
      toAddress: context.toAddress,
      contractVerified: true, // Assume verified for centralized tokens
      riskLevel,
      gasEstimate: gasEstimate.gasLimit,
      totalCost: gasEstimate.estimatedCost,
      warnings,
      balanceChanges
    };
  }

  /**
   * Format preview for CLI display
   */
  private formatPreview(preview: TransactionPreview): string {
    let output = `\n${preview.action}\n`;
    output += `Token: ${preview.tokenSymbol}\n`;
    output += `Amount: ${preview.amount}\n`;
    
    if (preview.fromAddress) output += `From: ${preview.fromAddress}\n`;
    if (preview.toAddress) output += `To: ${preview.toAddress}\n`;
    
    output += `Risk Level: [${preview.riskLevel}]\n`;
    output += `Gas Estimate: ${preview.gasEstimate}\n`;
    output += `Total Cost: ${preview.totalCost}\n`;
    
    if (preview.balanceChanges.before !== 'Loading...') {
      output += `Balance: ${preview.balanceChanges.before} → ${preview.balanceChanges.after}\n`;
    }
    
    if (preview.warnings.length > 0) {
      output += `\nWarnings:\n`;
      preview.warnings.forEach(warning => output += `  • ${warning}\n`);
    }
    
    output += `\nOrbitl NEVER handles your private keys\n`;
    
    return output;
  }

  /**
   * Get network information
   */
  async getNetworkInfo() {
    return this.builder.getNetworkInfo();
  }
}