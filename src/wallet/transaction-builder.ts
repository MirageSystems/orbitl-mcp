// Safe Transaction Builder - Core component for building transactions without handling private keys
// Follows "We Build, You Sign" philosophy - generates transaction data for external signing

import { ethers } from 'ethers';
import {
  TransactionData,
  SafeTransactionData,
  TransactionPreview,
  TransactionContext,
  ValidationResult,
  TransactionBuildError,
  RiskLevel
} from './types.js';
import { ABIManager } from './abi-manager.js';
import { getTokenResolver } from '../config/token-resolver.js';
import { TransactionValidator } from './validator.js';
import { GasEstimator } from './gas-estimator.js';

/**
 * SafeTransactionBuilder - The core class for building secure transactions
 * 
 * SECURITY PRINCIPLE: This class NEVER handles private keys or signs transactions.
 * It only builds transaction data that can be signed by external wallets.
 */
export class SafeTransactionBuilder {
  private provider: ethers.JsonRpcProvider;
  private gasEstimator: GasEstimator;
  private network: 'mainnet' | 'testnet';

  constructor(rpcUrl: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.gasEstimator = new GasEstimator(rpcUrl);
    this.network = network;
  }

  /**
   * Build an ERC-20 token transfer transaction
   * @param tokenAddress - Address of the token contract
   * @param to - Recipient address
   * @param amount - Amount to transfer (in token units)
   * @param context - Additional context for better previews
   */
  async buildTransfer(
    tokenAddress: string,
    to: string,
    amount: string,
    context?: TransactionContext
  ): Promise<SafeTransactionData> {
    
    const validation = TransactionValidator.validateTransferParams({
      tokenAddress,
      recipient: to,
      amount
    });

    if (!validation.isValid) {
      throw new TransactionBuildError(
        validation.errors[0] || 'Validation failed',
        'VALIDATION_FAILED',
        validation.suggestions
      );
    }

    try {
      const tokenResolver = getTokenResolver(this.network);
      
      // Get token info if available, otherwise use defaults
      let tokenInfo: any;
      try {
        tokenInfo = await tokenResolver.resolveToken(tokenAddress);
      } catch {
        tokenInfo = { name: 'Unknown Token', symbol: 'UNKNOWN', decimals: 18 };
      }
      
      // Basic amount validation
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new TransactionBuildError(
          'Invalid amount format',
          'INVALID_AMOUNT',
          ['Amount must be a positive number']
        );
      }

      const amountWei = ethers.parseUnits(amount, tokenInfo.decimals || 18);

      // 5. Encode function call using ABI manager
      const abi = ABIManager.getERC20ABI();
      const data = ABIManager.encodeFunctionCall(abi, 'transfer', [to, amountWei]);

      // 6. Build transaction data
      const transaction: TransactionData = {
        to: tokenAddress,
        data,
        value: '0', // ERC-20 transfers don't send native tokens
        gasLimit: this.gasEstimator.getStaticEstimate('erc20_transfer').toString(),
      };

      // 7. Get accurate gas estimate
      const gasEstimate = await this.gasEstimator.estimateTransaction(transaction);

      // 8. Update transaction with better gas estimate
      transaction.gasLimit = gasEstimate.gasLimit;
      transaction.gasPrice = gasEstimate.gasPrice;

      const formattedAmount = `${amount} ${tokenInfo.symbol || 'tokens'}`;
      const preview: TransactionPreview = {
        humanDescription: `Transfer ${formattedAmount} to ${this.formatAddress(to)}`,
        contractName: `${tokenInfo.name} (${tokenInfo.symbol})`,
        riskLevel: 'LOW',
        warnings: validation.warnings,
        estimatedCost: gasEstimate.estimatedCost
      };

      return {
        transaction,
        preview,
        safetyScore: 95, // High safety score for simple transfers
        gasEstimate
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TransactionBuildError(
        `Failed to build transfer transaction: ${errorMessage}`,
        'BUILD_TRANSFER_FAILED',
        [
          'Check that the token address is valid',
          'Verify the recipient address is correct',
          'Ensure the amount has the correct decimal places'
        ]
      );
    }
  }

  /**
   * Build an ERC-20 token approval transaction
   * @param tokenAddress - Address of the token contract
   * @param spender - Address that will be allowed to spend tokens
   * @param amount - Amount to approve ('unlimited' for max approval)
   * @param context - Additional context for better previews
   */
  async buildApproval(
    tokenAddress: string,
    spender: string,
    amount: string,
    context?: TransactionContext
  ): Promise<SafeTransactionData> {

    const validation = TransactionValidator.validateApprovalParams({
      tokenAddress,
      spender,
      amount
    });

    if (!validation.isValid) {
      throw new TransactionBuildError(
        validation.errors[0] || 'Validation failed',
        'VALIDATION_FAILED',
        validation.suggestions
      );
    }

    try {
      const tokenResolver = getTokenResolver(this.network);
      
      // Get token info if available, otherwise use defaults
      let tokenInfo: any;
      try {
        tokenInfo = await tokenResolver.resolveToken(tokenAddress);
      } catch {
        tokenInfo = { name: 'Unknown Token', symbol: 'UNKNOWN', decimals: 18 };
      }

      // Handle unlimited vs specific approvals
      let amountWei: bigint;
      let isUnlimited = false;
      const unlimitedKeywords = ['unlimited', 'max', 'maximum'];
      
      if (unlimitedKeywords.includes(amount.toLowerCase())) {
        amountWei = ethers.MaxUint256;
        isUnlimited = true;
      } else {
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          throw new TransactionBuildError(
            'Invalid amount format',
            'INVALID_AMOUNT',
            ['Amount must be a positive number']
          );
        }
        amountWei = ethers.parseUnits(amount, tokenInfo.decimals || 18);
      }

      // 4. Encode function call using ABI manager
      const abi = ABIManager.getERC20ABI();
      const data = ABIManager.encodeFunctionCall(abi, 'approve', [spender, amountWei]);

      // 5. Build transaction data
      const transaction: TransactionData = {
        to: tokenAddress,
        data,
        value: '0', // Approvals don't send native tokens
        gasLimit: this.gasEstimator.getStaticEstimate('erc20_approve').toString(),
      };

      // 6. Get accurate gas estimate
      const gasEstimate = await this.gasEstimator.estimateTransaction(transaction);

      // 7. Update transaction with better gas estimate
      transaction.gasLimit = gasEstimate.gasLimit;
      transaction.gasPrice = gasEstimate.gasPrice;

      // 8. Risk assessment based on approval type
      const riskLevel: RiskLevel = isUnlimited ? 'MEDIUM' : 'LOW';
      const warnings: string[] = [...validation.warnings];

      if (isUnlimited) {
        warnings.push('This approves unlimited token spending');
        warnings.push('The spender can take ALL of your tokens');
        warnings.push('Consider approving only what you need');
      }

      // 9. Create enhanced preview
      const displayAmount = isUnlimited ? 
        'unlimited' : 
        `${amount} ${tokenInfo.symbol || 'tokens'}`;

      const preview: TransactionPreview = {
        humanDescription: `Approve spending ${displayAmount} by ${this.formatAddress(spender)}`,
        contractName: `${tokenInfo.name} (${tokenInfo.symbol})`,
        riskLevel,
        warnings,
        estimatedCost: gasEstimate.estimatedCost
      };

      return {
        transaction,
        preview,
        safetyScore: isUnlimited ? 65 : 85, // Lower score for unlimited approvals
        gasEstimate
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TransactionBuildError(
        `Failed to build approval transaction: ${errorMessage}`,
        'BUILD_APPROVAL_FAILED',
        [
          'Check that the token address is valid',
          'Verify the spender address is correct',
          'Use "unlimited" for maximum approval or a specific amount with correct decimals'
        ]
      );
    }
  }

  /**
   * Build an ERC-20 transferFrom transaction
   * Used when spending someone else's approved tokens
   * @param tokenAddress - Address of the token contract
   * @param from - Address to transfer tokens from (token owner)
   * @param to - Address to transfer tokens to
   * @param amount - Amount to transfer
   */
  async buildTransferFrom(
    tokenAddress: string,
    from: string,
    to: string,
    amount: string
  ): Promise<SafeTransactionData> {

    // 1. Validate inputs
    const tokenValidation = TransactionValidator.validateAddress(tokenAddress, 'Token address');
    const fromValidation = TransactionValidator.validateAddress(from, 'From address');  
    const toValidation = TransactionValidator.validateAddress(to, 'To address');
    const amountValidation = TransactionValidator.validateAmount(amount);

    const allErrors = [
      ...tokenValidation.errors,
      ...fromValidation.errors,
      ...toValidation.errors,
      ...amountValidation.errors
    ];

    if (allErrors.length > 0) {
      throw new TransactionBuildError(
        allErrors[0] || 'Validation failed',
        'VALIDATION_FAILED',
        ['Check all addresses and amount are correct']
      );
    }

    try {
      const tokenResolver = getTokenResolver(this.network);
      
      // Get token info if available, otherwise use defaults
      let tokenInfo: any;
      try {
        tokenInfo = await tokenResolver.resolveToken(tokenAddress);
      } catch {
        tokenInfo = { name: 'Unknown Token', symbol: 'UNKNOWN', decimals: 18 };
      }
      
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new TransactionBuildError(
          'Invalid amount format',
          'INVALID_AMOUNT',
          ['Amount must be a positive number']
        );
      }

      const amountWei = ethers.parseUnits(amount, tokenInfo.decimals || 18);

      // 5. Encode function call
      const abi = ABIManager.getERC20ABI();
      const data = ABIManager.encodeFunctionCall(abi, 'transferFrom', [from, to, amountWei]);

      // 6. Build transaction
      const transaction: TransactionData = {
        to: tokenAddress,
        data,
        value: '0',
        gasLimit: this.gasEstimator.getStaticEstimate('erc20_transferFrom').toString(),
      };

      // 7. Get accurate gas estimate
      const gasEstimate = await this.gasEstimator.estimateTransaction(transaction);

      // 8. Update transaction with better gas estimate
      transaction.gasLimit = gasEstimate.gasLimit;
      transaction.gasPrice = gasEstimate.gasPrice;

      const formattedAmount = `${amount} ${tokenInfo.symbol || 'tokens'}`;
      const preview: TransactionPreview = {
        humanDescription: `Transfer ${formattedAmount} from ${this.formatAddress(from)} to ${this.formatAddress(to)}`,
        contractName: `${tokenInfo.name} (${tokenInfo.symbol})`,
        riskLevel: 'MEDIUM', // transferFrom is riskier as it uses allowances
        warnings: [
          'This uses token allowance - ensure you have permission',
          'Verify the from address has sufficient balance'
        ],
        estimatedCost: gasEstimate.estimatedCost
      };

      return {
        transaction,
        preview,
        safetyScore: 80, // Moderate score due to allowance dependency
        gasEstimate
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TransactionBuildError(
        `Failed to build transferFrom transaction: ${errorMessage}`,
        'BUILD_TRANSFERFROM_FAILED',
        [
          'Check that all addresses are valid',
          'Ensure the amount has correct decimal places',
          'Verify you have approval to spend from the source address'
        ]
      );
    }
  }

  /**
   * Format address for display (show first and last 4 chars)
   */
  private formatAddress(address: string): string {
    if (address.length !== 42) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get current network information
   */
  async getNetworkInfo(): Promise<{ chainId: number; name: string }> {
    try {
      const network = await this.provider.getNetwork();
      return {
        chainId: Number(network.chainId),
        name: network.name
      };
    } catch (error) {
      return {
        chainId: 1329, // Default to Sei Pacific-1
        name: 'sei-network'
      };
    }
  }
}