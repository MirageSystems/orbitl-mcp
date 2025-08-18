// Centralized Token Resolution for Sei Network
// Used by both AI tools and manual CLI commands

import chalk from 'chalk';
import { ethers } from 'ethers';
import tokens from './tokens.json' assert { type: 'json' };

export interface TokenInfo {
  address: string;
  decimals: number;
  name: string;
  symbol: string;
  isNative?: boolean;
}

type NetworkType = 'mainnet' | 'testnet';

/**
 * Centralized token resolver for hackathon
 * Handles network-specific token lookups with safety checks
 */
export class TokenResolver {
  private network: NetworkType;
  
  // Known scam addresses - expand as needed
  private static readonly KNOWN_SCAMS = [
    '0x666666666666666666666666666666666666666666',
    '0x420420420420420420420420420420420420420'
  ];

  constructor(network: NetworkType = 'mainnet') {
    this.network = network;
  }

  /**
   * Resolve token symbol or address to TokenInfo
   * @param input - Token symbol (USDC) or address (0x...)
   * @returns Promise<TokenInfo>
   */
  async resolveToken(input: string): Promise<TokenInfo> {
    // Case 1: Token symbol lookup
    const upper = input.toUpperCase();
    const networkTokens = tokens[this.network];
    
    if (networkTokens[upper as keyof typeof networkTokens]) {
      const token = networkTokens[upper as keyof typeof networkTokens] as TokenInfo;
      console.log(`Found ${upper} on ${this.network}: ${token.address}`);
      return token;
    }
    
    // Case 2: Already an address - verify it
    if (input.startsWith('0x')) {
      await this.warnIfScam(input);
      const isValid = await this.verifyContractAddress(input);
      
      if (!isValid) {
        throw new Error('Invalid or non-contract address');
      }
      
      // Return basic token info for unknown addresses
      return {
        address: input,
        decimals: 18, // Default
        name: 'Unknown Token',
        symbol: 'UNKNOWN'
      };
    }
    
    // Case 3: Unknown symbol
    console.log(chalk.yellow(`Unknown token: ${input}`));
    console.log(chalk.gray(`Available tokens: ${this.getAvailableTokens().join(', ')}`));
    throw new Error(`Token ${input} not recognized. Use symbol (USDC, WSEI, SEI) or contract address.`);
  }

  /**
   * Get all available token symbols for current network
   * @returns Array of token symbols (e.g., ['USDC', 'WSEI', 'SEI'])
   */
  getAvailableTokens(): string[] {
    return Object.keys(tokens[this.network]);
  }

  /**
   * Get token info by symbol (no address verification)
   * @param symbol - Token symbol to look up
   * @returns TokenInfo object or null if not found
   */
  getTokenBySymbol(symbol: string): TokenInfo | null {
    const upper = symbol.toUpperCase();
    const networkTokens = tokens[this.network];
    return (networkTokens[upper as keyof typeof networkTokens] as TokenInfo) || null;
  }

  /**
   * Get current network
   * @returns Current network (mainnet or testnet)
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Set network (for switching between mainnet/testnet)
   * @param network - Target network to switch to
   */
  setNetwork(network: NetworkType): void {
    this.network = network;
  }

  /**
   * Check if token exists by symbol
   * @param symbol - Token symbol to check
   * @returns True if token exists for current network
   */
  hasToken(symbol: string): boolean {
    const upper = symbol.toUpperCase();
    const networkTokens = tokens[this.network];
    return upper in networkTokens;
  }

  /**
   * Verify if address is a valid contract (basic check)
   */
  private async verifyContractAddress(address: string): Promise<boolean> {
    try {
      // Basic format check
      if (!ethers.isAddress(address)) {
        return false;
      }
      
      // For hackathon: accept all properly formatted addresses
      // In production, we'd check if it's actually a contract
      return true;
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not verify address: ${error}`));
      return false;
    }
  }

  /**
   * Warn if address is known scam
   */
  private async warnIfScam(address: string): Promise<void> {
    if (TokenResolver.KNOWN_SCAMS.includes(address.toLowerCase())) {
      console.log(chalk.red('WARNING: KNOWN SCAM TOKEN ADDRESS'));
      console.log(chalk.red('DO NOT PROCEED WITH THIS TRANSACTION'));
      throw new Error('Scam token detected - transaction blocked for safety');
    }
  }

  /**
   * Get all tokens for current network
   */
  getAllTokens(): Record<string, TokenInfo> {
    return tokens[this.network] as Record<string, TokenInfo>;
  }

  /**
   * Format token info for display
   */
  formatTokenInfo(token: TokenInfo): string {
    const networkBadge = this.network === 'testnet' ? ' (Testnet)' : '';
    return [
      chalk.green(`✅ ${token.symbol}${networkBadge}`),
      chalk.gray('─'.repeat(50)),
      `📋 Name:     ${token.name}`,
      `📍 Address:  ${token.address}`,
      `🔢 Decimals: ${token.decimals}`,
      `🌐 Network:  ${this.network}`,
      token.isNative ? '🪙 Native Token' : ''
    ].filter(Boolean).join('\n');
  }
}

// Export singleton instances
export const mainnetResolver = new TokenResolver('mainnet');
export const testnetResolver = new TokenResolver('testnet');

// Helper function to get resolver for network
export function getTokenResolver(network: NetworkType): TokenResolver {
  return network === 'testnet' ? testnetResolver : mainnetResolver;
}