// Gas Estimation System for Safe Transaction Builder
// Provides accurate gas cost prediction for transactions

import { ethers } from 'ethers';
import { GasEstimate, TransactionData } from './types.js';

/**
 * Gas estimation utility for predicting transaction costs
 * Combines static estimates with network data for accuracy
 */
export class GasEstimator {
  private provider: ethers.JsonRpcProvider;
  private gasCache: Map<string, { price: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Static gas estimates for common operations
   * Based on historical data and typical usage patterns
   */
  private static readonly STATIC_ESTIMATES = {
    // ERC-20 operations
    'erc20_transfer': 65000,
    'erc20_approve': 45000,
    'erc20_transferFrom': 70000,
    
    // Native token operations
    'native_transfer': 21000,
    
    // DEX operations  
    'uniswap_swap': 150000,
    'add_liquidity': 200000,
    'remove_liquidity': 180000,
    
    // Staking operations
    'stake': 100000,
    'unstake': 80000,
    'claim_rewards': 60000,
    
    // Contract deployment
    'contract_deploy': 500000,
    
    // Multi-sig operations
    'multisig_execute': 120000
  };

  /**
   * Get static gas estimate for operation type
   * @param operation - Type of operation
   * @param safetyBuffer - Safety buffer percentage (default 20%)
   */
  getStaticEstimate(operation: string, safetyBuffer: number = 20): number {
    const baseEstimate = GasEstimator.STATIC_ESTIMATES[operation as keyof typeof GasEstimator.STATIC_ESTIMATES] || 100000;
    return Math.floor(baseEstimate * (1 + safetyBuffer / 100));
  }

  /**
   * Get current network gas price with caching
   * @returns Gas price in wei as string
   */
  async getCurrentGasPrice(): Promise<string> {
    const cacheKey = 'current_gas_price';
    const cached = this.gasCache.get(cacheKey);
    
    // Return cached value if still fresh
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      const feeData = await this.provider.getFeeData();
      
      // Use EIP-1559 maxFeePerGas if available, otherwise gasPrice
      let gasPrice: bigint;
      if (feeData.maxFeePerGas) {
        gasPrice = feeData.maxFeePerGas;
      } else if (feeData.gasPrice) {
        gasPrice = feeData.gasPrice;
      } else {
        throw new Error('No gas price data available');
      }

      const gasPriceString = gasPrice.toString();
      
      // Cache the result
      this.gasCache.set(cacheKey, {
        price: gasPriceString,
        timestamp: Date.now()
      });

      return gasPriceString;

    } catch (error) {
      console.warn('Failed to fetch gas price from network, using fallback:', error);
      
      // Fallback to reasonable default (20 gwei equivalent for Sei)
      const fallbackPrice = ethers.parseUnits('20', 'gwei').toString();
      
      // Cache fallback briefly
      this.gasCache.set(cacheKey, {
        price: fallbackPrice,
        timestamp: Date.now() - (this.CACHE_DURATION / 2) // Shorter cache for fallback
      });
      
      return fallbackPrice;
    }
  }

  /**
   * Estimate gas for a specific transaction
   * @param txData - Transaction data to estimate
   * @returns Complete gas estimate with costs
   */
  async estimateTransaction(txData: TransactionData): Promise<GasEstimate> {
    // 1. Determine gas limit
    let gasLimit: string;
    if (txData.gasLimit) {
      gasLimit = txData.gasLimit;
    } else {
      // Try to estimate from network, fallback to static
      try {
        const estimated = await this.provider.estimateGas({
          to: txData.to,
          data: txData.data,
          value: txData.value || '0'
        });
        gasLimit = Math.floor(Number(estimated) * 1.1).toString(); // 10% buffer
      } catch (error) {
        // Fallback to static estimate based on data
        gasLimit = this.getStaticEstimate(this.detectOperationType(txData)).toString();
      }
    }

    // 2. Get current gas price
    const gasPrice = await this.getCurrentGasPrice();

    // 3. Calculate total cost in wei
    const gasCostWei = (BigInt(gasLimit) * BigInt(gasPrice)).toString();

    // 4. Convert to human readable cost
    const estimatedCost = await this.formatCost(gasCostWei);

    // 5. Determine confidence level
    const confidence = this.calculateConfidence(txData, gasLimit);

    return {
      gasLimit,
      gasPrice,
      estimatedCost,
      estimatedCostWei: gasCostWei,
      confidence,
      buffer: 10 // 10% buffer included in estimates
    };
  }

  /**
   * Detect operation type from transaction data for better estimates
   * @param txData - Transaction to analyze
   * @returns Operation type string
   */
  private detectOperationType(txData: TransactionData): string {
    if (!txData.data || txData.data === '0x') {
      return 'native_transfer';
    }

    // Check function selector (first 4 bytes after 0x)
    const functionSelector = txData.data.slice(0, 10);
    
    const knownSelectors: Record<string, string> = {
      '0xa9059cbb': 'erc20_transfer',        // transfer(address,uint256)
      '0x095ea7b3': 'erc20_approve',         // approve(address,uint256)
      '0x23b872dd': 'erc20_transferFrom',    // transferFrom(address,address,uint256)
      '0x7ff36ab5': 'uniswap_swap',          // swapExactETHForTokens
      '0x38ed1739': 'uniswap_swap',          // swapExactTokensForTokens
      '0xe8e33700': 'add_liquidity',         // addLiquidity
      '0xbaa2abde': 'remove_liquidity'       // removeLiquidity
    };

    return knownSelectors[functionSelector] || 'erc20_transfer'; // Default to ERC-20 transfer
  }

  /**
   * Calculate confidence in gas estimate
   * @param txData - Transaction data
   * @param gasLimit - Estimated gas limit
   * @returns Confidence level
   */
  private calculateConfidence(txData: TransactionData, gasLimit: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    // High confidence for simple operations with known patterns
    if (this.detectOperationType(txData) !== 'erc20_transfer') {
      return 'HIGH';
    }

    // Medium confidence for complex transactions
    if (txData.data && txData.data.length > 200) {
      return 'MEDIUM';
    }

    // Lower confidence if we had to use static estimates
    const gasLimitNum = Number(gasLimit);
    if (gasLimitNum === this.getStaticEstimate(this.detectOperationType(txData))) {
      return 'MEDIUM';
    }

    return 'HIGH';
  }

  /**
   * Format gas cost to human-readable string with USD estimate
   * @param costWei - Cost in wei
   * @returns Formatted cost string
   */
  private async formatCost(costWei: string): Promise<string> {
    // Convert wei to SEI (18 decimals)
    const seiAmount = ethers.formatEther(costWei);
    const seiNum = parseFloat(seiAmount);

    // Rough SEI price estimation (could be made dynamic)
    const seiPriceUSD = 0.50; // $0.50 per SEI (update as needed)
    const usdCost = seiNum * seiPriceUSD;

    // Format based on cost magnitude
    if (usdCost < 0.001) {
      return `<$0.001 (${seiNum.toFixed(6)} SEI)`;
    } else if (usdCost < 0.01) {
      return `$${usdCost.toFixed(3)} (${seiNum.toFixed(4)} SEI)`;
    } else if (usdCost < 1) {
      return `$${usdCost.toFixed(2)} (${seiNum.toFixed(3)} SEI)`;
    } else {
      return `$${usdCost.toFixed(2)} (${seiNum.toFixed(2)} SEI)`;
    }
  }

  /**
   * Get gas price analysis with recommendations
   * @returns Gas price analysis with trends and suggestions
   */
  async getGasPriceAnalysis(): Promise<{
    current: string;
    trend: 'rising' | 'falling' | 'stable';
    recommendation: string;
    fastPrice?: string;
    standardPrice?: string;
    slowPrice?: string;
  }> {
    try {
      const feeData = await this.provider.getFeeData();
      const current = await this.getCurrentGasPrice();

      // For EIP-1559 networks, provide different speed options
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        const baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
        const priorityFee = feeData.maxPriorityFeePerGas;

        return {
          current,
          trend: 'stable', // Could implement historical tracking
          recommendation: 'Current gas prices are normal for Sei network',
          fastPrice: (baseFee + priorityFee * BigInt(2)).toString(),
          standardPrice: (baseFee + priorityFee).toString(),
          slowPrice: (baseFee + priorityFee / BigInt(2)).toString()
        };
      }

      return {
        current,
        trend: 'stable',
        recommendation: 'Current gas prices are normal'
      };

    } catch (error) {
      console.warn('Failed to get gas price analysis:', error);
      
      const fallback = await this.getCurrentGasPrice();
      return {
        current: fallback,
        trend: 'stable',
        recommendation: 'Using fallback gas price - network may be temporarily unavailable'
      };
    }
  }

  /**
   * Estimate cost for multiple transactions (batch)
   * @param transactions - Array of transaction data
   * @returns Array of gas estimates
   */
  async estimateBatch(transactions: TransactionData[]): Promise<GasEstimate[]> {
    // Estimate all transactions in parallel for performance
    const estimates = await Promise.all(
      transactions.map(tx => this.estimateTransaction(tx))
    );

    return estimates;
  }

  /**
   * Get total estimated cost for batch transactions
   * @param transactions - Array of transaction data
   * @returns Total cost estimate
   */
  async getBatchCost(transactions: TransactionData[]): Promise<{
    totalCost: string;
    totalCostWei: string;
    individual: GasEstimate[];
  }> {
    const estimates = await this.estimateBatch(transactions);
    
    // Sum all costs
    const totalCostWei = estimates.reduce(
      (sum, estimate) => sum + BigInt(estimate.estimatedCostWei),
      BigInt(0)
    ).toString();

    const totalCost = await this.formatCost(totalCostWei);

    return {
      totalCost,
      totalCostWei,
      individual: estimates
    };
  }

  /**
   * Clear gas price cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.gasCache.clear();
  }

  /**
   * Set custom SEI price for cost calculations
   * @param priceUSD - SEI price in USD
   */
  private seiPriceUSD: number = 0.50;
  
  setSeiPrice(priceUSD: number): void {
    this.seiPriceUSD = priceUSD;
  }
}