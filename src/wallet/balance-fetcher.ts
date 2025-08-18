// Simple balance fetching for transaction simulation
// Gets current token balances to show before/after states

import { ethers } from 'ethers';
import { ABIManager } from './abi-manager.js';

export interface BalanceInfo {
  current: bigint;
  currentFormatted: string;
  afterTransaction?: bigint;
  afterFormatted?: string;
  symbol: string;
  decimals: number;
}

/**
 * Simple balance fetcher for transaction simulation
 * No caching, no complexity - just direct contract calls
 */
export class BalanceFetcher {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Get current token balance for an address
   */
  async getTokenBalance(
    tokenAddress: string,
    userAddress: string,
    decimals: number = 18,
    symbol: string = 'TOKEN'
  ): Promise<BalanceInfo> {
    try {
      const abi = ABIManager.getERC20ABI();
      const contract = new ethers.Contract(tokenAddress, abi, this.provider);
      
      const balance = await contract.balanceOf?.(userAddress) || BigInt(0);
      const formatted = ethers.formatUnits(balance, decimals);
      
      return {
        current: balance,
        currentFormatted: `${parseFloat(formatted).toLocaleString()} ${symbol}`,
        symbol,
        decimals
      };
    } catch (error) {
      // Production: Return actual zero balance if contract call fails
      return {
        current: BigInt(0),
        currentFormatted: `0 ${symbol}`,
        symbol,
        decimals
      };
    }
  }

  /**
   * Calculate balance after a transfer transaction
   * Handles insufficient balance cases properly
   */
  calculateAfterTransfer(
    balance: BalanceInfo,
    transferAmount: bigint,
    isOutgoing: boolean
  ): BalanceInfo {
    let afterBalance: bigint;
    let afterFormatted: string;

    if (isOutgoing) {
      // Check for insufficient balance
      if (transferAmount > balance.current) {
        afterBalance = BigInt(0);
        afterFormatted = `Insufficient Balance (need ${ethers.formatUnits(transferAmount, balance.decimals)} ${balance.symbol})`;
      } else {
        afterBalance = balance.current - transferAmount;
        const afterValue = ethers.formatUnits(afterBalance, balance.decimals);
        afterFormatted = `${parseFloat(afterValue).toLocaleString()} ${balance.symbol}`;
      }
    } else {
      // Incoming transfer - always add
      afterBalance = balance.current + transferAmount;
      const afterValue = ethers.formatUnits(afterBalance, balance.decimals);
      afterFormatted = `${parseFloat(afterValue).toLocaleString()} ${balance.symbol}`;
    }
    
    return {
      ...balance,
      afterTransaction: afterBalance,
      afterFormatted
    };
  }
}