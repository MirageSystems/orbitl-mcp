// Token Information and Decimal Handling
// Manages token metadata, decimal conversions, and amount formatting

import { ethers } from 'ethers';
import { ABIManager } from './abi-manager.js';

/**
 * Token information and utilities for handling different token standards
 * Focuses on proper decimal handling and amount conversions
 */
export class TokenInfo {

  private static provider?: ethers.JsonRpcProvider;
  
  /**
   * Set the RPC provider for contract calls
   */
  static setProvider(rpcUrl: string): void {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Known token information for popular tokens
   * Provides fallback data when contract calls fail
   */
  private static readonly KNOWN_TOKENS: Record<string, TokenMetadata> = {
    // Sei Network tokens (update addresses as needed)
    '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'
    },
    '0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456': {
      symbol: 'WSEI',
      name: 'Wrapped SEI',
      decimals: 18,
      address: '0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456'
    },
    // Ethereum mainnet tokens for testing
    '0xa0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3e4f5a0b1': {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      address: '0xa0b1c2d3e4f5a0b1c2d3e4f5a0b1c2d3e4f5a0b1'
    }
  };

  /**
   * Get token decimals from contract or fallback to known values
   * @param tokenAddress - Contract address of the token
   * @returns Number of decimals (6 for USDC, 18 for most others)
   */
  static async getDecimals(tokenAddress: string): Promise<number> {
    // Check known tokens first
    const knownToken = this.KNOWN_TOKENS[tokenAddress.toLowerCase()];
    if (knownToken) {
      return knownToken.decimals;
    }

    // Try to fetch from contract if provider is available
    if (this.provider) {
      try {
        const abi = ABIManager.getERC20ABI();
        const contract = new ethers.Contract(tokenAddress, abi, this.provider);
        const decimals = await contract.decimals?.();
        return Number(decimals || 18);
      } catch (error) {
        console.warn(`Could not fetch decimals for ${tokenAddress}, using fallback`);
      }
    }

    // Fallback to 18 decimals (most common)
    return 18;
  }

  /**
   * Get complete token metadata
   * @param tokenAddress - Contract address of the token
   * @returns Token metadata including symbol, name, decimals
   */
  static async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    // Check known tokens first
    const knownToken = this.KNOWN_TOKENS[tokenAddress.toLowerCase()];
    if (knownToken) {
      return knownToken;
    }

    // Try to fetch from contract
    if (this.provider) {
      try {
        const abi = ABIManager.getERC20ABI();
        const contract = new ethers.Contract(tokenAddress, abi, this.provider);

        // Fetch all metadata in parallel
        const [symbol, name, decimals] = await Promise.all([
          contract.symbol?.() || 'TOKEN',
          contract.name?.() || 'Unknown Token',
          contract.decimals?.() || 18
        ]);

        return {
          symbol: symbol || 'TOKEN',
          name: name || 'Unknown Token',
          decimals: Number(decimals) || 18,
          address: tokenAddress
        };
      } catch (error) {
        console.warn(`Could not fetch metadata for ${tokenAddress}, using defaults`);
      }
    }

    // Fallback metadata
    return {
      symbol: 'TOKEN',
      name: 'Unknown Token',
      decimals: 18,
      address: tokenAddress
    };
  }

  /**
   * Convert human-readable amount to wei using correct decimals
   * @param amount - Human readable amount (e.g., "100.5")
   * @param tokenAddress - Contract address to determine decimals
   * @returns Amount in wei as bigint
   */
  static async toWei(amount: string, tokenAddress: string): Promise<bigint> {
    const decimals = await this.getDecimals(tokenAddress);
    
    try {
      return ethers.parseUnits(amount, decimals);
    } catch (error) {
      throw new Error(`Failed to convert amount '${amount}' to wei: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert wei amount to human-readable using correct decimals
   * @param amountWei - Amount in wei as bigint
   * @param tokenAddress - Contract address to determine decimals
   * @returns Human readable amount as string
   */
  static async fromWei(amountWei: bigint, tokenAddress: string): Promise<string> {
    const decimals = await this.getDecimals(tokenAddress);
    
    try {
      return ethers.formatUnits(amountWei, decimals);
    } catch (error) {
      throw new Error(`Failed to convert wei amount to readable format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format amount for display with proper decimals and symbol
   * @param amount - Amount as string or bigint
   * @param tokenAddress - Contract address for metadata
   * @param isWei - Whether the amount is in wei or human readable
   * @returns Formatted string like "100.5 USDC"
   */
  static async formatAmount(
    amount: string | bigint, 
    tokenAddress: string, 
    isWei: boolean = false
  ): Promise<string> {
    const metadata = await this.getTokenMetadata(tokenAddress);
    
    let displayAmount: string;
    
    if (isWei && typeof amount === 'bigint') {
      displayAmount = await this.fromWei(amount, tokenAddress);
    } else if (isWei && typeof amount === 'string') {
      displayAmount = await this.fromWei(BigInt(amount), tokenAddress);
    } else {
      displayAmount = amount.toString();
    }

    // Format to reasonable decimal places
    const numAmount = parseFloat(displayAmount);
    let formatted: string;

    if (numAmount === 0) {
      formatted = '0';
    } else if (numAmount < 0.01) {
      formatted = numAmount.toExponential(2);
    } else if (numAmount < 1) {
      formatted = numAmount.toFixed(4);
    } else if (numAmount < 1000) {
      formatted = numAmount.toFixed(2);
    } else {
      formatted = numAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    return `${formatted} ${metadata.symbol}`;
  }

  /**
   * Validate that an amount is valid for a token's decimals
   * @param amount - Amount to validate
   * @param tokenAddress - Contract address
   * @returns Validation result
   */
  static async validateAmountForToken(
    amount: string, 
    tokenAddress: string
  ): Promise<{ isValid: boolean; error?: string; maxDecimals?: number }> {
    try {
      const decimals = await this.getDecimals(tokenAddress);
      
      // Check decimal places
      const decimalIndex = amount.indexOf('.');
      if (decimalIndex !== -1) {
        const decimalPlaces = amount.length - decimalIndex - 1;
        if (decimalPlaces > decimals) {
          return {
            isValid: false,
            error: `Too many decimal places. ${await this.getTokenSymbol(tokenAddress)} supports maximum ${decimals} decimals`,
            maxDecimals: decimals
          };
        }
      }

      // Try to parse to ensure it's a valid conversion
      await this.toWei(amount, tokenAddress);
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid amount format'
      };
    }
  }

  /**
   * Get token symbol (quick method)
   * @param tokenAddress - Contract address
   * @returns Token symbol
   */
  static async getTokenSymbol(tokenAddress: string): Promise<string> {
    const metadata = await this.getTokenMetadata(tokenAddress);
    return metadata.symbol;
  }

  /**
   * Check if an address is a known token
   * @param address - Address to check
   * @returns Whether it's a known token
   */
  static isKnownToken(address: string): boolean {
    return !!this.KNOWN_TOKENS[address.toLowerCase()];
  }

  /**
   * Get all known tokens
   * @returns Array of all known token metadata
   */
  static getKnownTokens(): TokenMetadata[] {
    return Object.values(this.KNOWN_TOKENS);
  }

  /**
   * Add a token to the known tokens registry
   * Useful for extending support to new tokens
   */
  static addKnownToken(metadata: TokenMetadata): void {
    this.KNOWN_TOKENS[metadata.address.toLowerCase()] = metadata;
  }

  /**
   * Get user's token balance
   * @param tokenAddress - Token contract address
   * @param userAddress - User's wallet address
   * @returns Balance in human-readable format
   */
  static async getBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not set. Call TokenInfo.setProvider() first.');
    }

    try {
      const abi = ABIManager.getERC20ABI();
      const contract = new ethers.Contract(tokenAddress, abi, this.provider);
      const balanceWei = await contract.balanceOf?.(userAddress);
      
      return await this.fromWei(balanceWei, tokenAddress);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  symbol: string;        // e.g., "USDC"
  name: string;          // e.g., "USD Coin"
  decimals: number;      // e.g., 6 for USDC, 18 for most others
  address: string;       // Contract address
}