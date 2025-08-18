/**
 * @fileoverview Core type definitions for Sei contract analysis
 * @author Orbitl Team
 */

/**
 * Contract types that can be automatically detected from ABI patterns
 */
export type ContractType = 
  | "Token"    // ERC-20/721 tokens (has transfer, balanceOf)
  | "DEX"      // DEX/AMM (has swap, addLiquidity)  
  | "Farm"     // Staking/Farm (has stake, deposit, withdraw)
  | "Unknown"; // Everything else

/**
 * Contract function definition from ABI
 * Based on ethers.js ABI structure
 */
export interface ABIFunction {
  name: string;
  type: "function";
  inputs: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability: "pure" | "view" | "nonpayable" | "payable";
}

/**
 * ABI function input parameter
 */
export interface ABIInput {
  /** Parameter name */
  name: string;
  /** Solidity type (e.g., "uint256", "address") */
  type: string;
  /** Whether this parameter is indexed (for events) */
  indexed?: boolean;
}

/**
 * ABI function output parameter
 */
export interface ABIOutput {
  /** Output name */
  name: string;
  /** Solidity type (e.g., "uint256", "address") */
  type: string;
}

/**
 * Complete contract analysis result
 */
export interface ContractData {
  /** Contract address (checksummed) */
  address: string;
  /** Whether the address contains bytecode */
  hasCode: boolean;
  /** Whether source code is verified on block explorer */
  isVerified: boolean;
  /** Parsed ABI functions only (events/constructors filtered out) */
  abi: ABIFunction[];
  /** Automatically detected contract type */
  basicType: ContractType;
  /** Total number of functions found */
  functionCount: number;
  /** Read-only functions (view/pure) */
  readOnlyFunctions: ABIFunction[];
  /** State-changing functions (nonpayable/payable) */
  writeFunctions: ABIFunction[];
}

/**
 * Blockchain network configuration
 */
export interface NetworkConfig {
  /** Human-readable network name */
  name: string;
  /** Numeric chain ID */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Block explorer API base URL */
  explorerApiUrl: string;
}

/**
 * Contract operation error with error codes
 */
export class ContractError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ContractError";
  }
}

/**
 * Contract type detection patterns
 * Used to automatically classify contracts based on function names
 */
export const TYPE_DETECTION_PATTERNS = {
  Token: {
    required: ["transfer", "balanceOf"],
    optional: ["totalSupply", "approve", "allowance", "symbol", "name", "decimals"]
  },
  DEX: {
    required: ["swap"],
    optional: ["addLiquidity", "removeLiquidity", "getAmountsOut", "getAmountsIn"]
  },
  Farm: {
    required: ["deposit", "withdraw"],
    optional: ["stake", "unstake", "claimRewards", "earned", "rewardPerToken"]
  }
} as const;

/**
 * Format a contract address for display (e.g., "0x1234...5678")
 * @param address Full contract address
 * @returns Shortened address string
 */
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validate Ethereum-style address format
 * @param address Address string to validate
 * @returns True if address format is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}