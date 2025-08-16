// Phase 1: Sei Provider - Network connection and ABI fetching
// Using battle-tested ethers.js and native fetch

import { ethers } from "ethers";
import type { 
  NetworkConfig, 
  ABIFunction 
} from "../types/contract.js";
import { ContractError } from "../types/contract.js";

export class SeiProvider {
  private provider: ethers.JsonRpcProvider;
  private config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
    
    // Use ethers.js JsonRpcProvider (battle-tested)
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: config.name
    });
  }

  /**
   * Check if address has contract bytecode
   * Uses ethers.js getCode() - reliable method
   */
  async hasCode(address: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(address);
      return code !== "0x" && code.length > 2;
    } catch (error) {
      throw new ContractError(
        `Failed to check contract code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "CODE_CHECK_FAILED"
      );
    }
  }

  /**
   * Fetch contract ABI from Seitrace explorer API with retry logic
   * Uses fetch with browser-like headers for maximum compatibility
   */
  async fetchABI(address: string): Promise<ABIFunction[]> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use correct Seitrace API endpoint based on network (Etherscan-style API)
        const networkPath = this.config.chainId === 1329 ? "pacific-1" : "atlantic-2"; 
        const baseUrl = `https://seitrace.com/${networkPath}/api`;
        const params = new URLSearchParams({
          module: 'contract',
          action: 'getabi',
          address: address
        });
        const url = `${baseUrl}?${params.toString()}`;
        
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),  // 15 second timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Check if contract is verified and has ABI (Etherscan-style response)
        if (!data || data.status !== "1" || !data.result) {
          return []; // Unverified contract or API error
        }

        // Parse ABI string to JSON (result contains the ABI string)
        const abi = JSON.parse(data.result);
        
        // Filter only function entries (exclude events, constructors)
        const functions = abi.filter((item: any) => item.type === "function");
        
        return functions as ABIFunction[];

      } catch (error) {
        lastError = error as Error;
        
        // If it's the last attempt, handle the error
        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Handle the final error after all retries
    if (lastError) {
      // If it's a timeout or network error, return empty array (treat as unverified)
      if (lastError.name === 'AbortError' || 
          lastError.message.includes('timeout') || 
          lastError.message.includes('ETIMEDOUT') ||
          lastError.message.includes('fetch failed')) {
        return [];
      }
      
      // If it's an HTTP error
      if (lastError.message.includes('HTTP 404')) {
        // Contract not found or not verified - this is normal
        return [];
      }
      
      throw new ContractError(
        `Explorer API error after ${maxRetries} attempts: ${lastError.message}`,
        "EXPLORER_API_ERROR"
      );
    }
    
    throw new ContractError(
      `Failed to fetch ABI after ${maxRetries} attempts`,
      "ABI_FETCH_FAILED"
    );
  }

  /**
   * Check network connectivity
   * Uses ethers.js getBlockNumber() - simple and reliable
   */
  async checkConnection(): Promise<{ blockNumber: number; networkName: string }> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        blockNumber,
        networkName: this.config.name
      };
    } catch (error) {
      throw new ContractError(
        `Network connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "NETWORK_CONNECTION_FAILED"
      );
    }
  }

  /**
   * Get network configuration
   */
  getConfig(): NetworkConfig {
    return this.config;
  }

  /**
   * Get ethers provider for advanced use cases
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}

// Predefined network configurations
export const SEI_TESTNET_CONFIG: NetworkConfig = {
  name: "Sei Atlantic-2 Testnet",
  chainId: 1328,
  rpcUrl: "https://evm-rpc-testnet.sei-apis.com",
  explorerUrl: "https://seitrace.com/?chain=atlantic-2",
  explorerApiUrl: "https://seitrace.com/api/v2"
};

export const SEI_MAINNET_CONFIG: NetworkConfig = {
  name: "Sei Network",
  chainId: 1329,
  rpcUrl: "https://evm-rpc.sei-apis.com", 
  explorerUrl: "https://seitrace.com",
  explorerApiUrl: "https://seitrace.com/api/v2"
};