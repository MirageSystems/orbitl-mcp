// Phase 1: Basic contract types (battle-tested approach)
// Keep it simple and focused on contract reading only

// Basic contract types we can detect from ABI patterns
export type ContractType = 
  | "Token"    // ERC-20/721 tokens (has transfer, balanceOf)
  | "DEX"      // DEX/AMM (has swap, addLiquidity)  
  | "Farm"     // Staking/Farm (has stake, deposit, withdraw)
  | "Unknown"; // Everything else

// Basic ABI function structure (from ethers.js)
export interface ABIFunction {
  name: string;
  type: "function";
  inputs: ABIInput[];
  outputs?: ABIOutput[];
  stateMutability: "pure" | "view" | "nonpayable" | "payable";
}

export interface ABIInput {
  name: string;
  type: string;
  indexed?: boolean;
}

export interface ABIOutput {
  name: string;
  type: string;
}

// Main contract data structure for Phase 1
export interface ContractData {
  address: string;                    // Contract address
  hasCode: boolean;                   // Does it have bytecode?
  isVerified: boolean;                // Is source verified on explorer?
  abi: ABIFunction[];                 // Parsed ABI functions
  basicType: ContractType;            // Detected contract type
  functionCount: number;              // Number of functions found
  readOnlyFunctions: ABIFunction[];   // View/pure functions
  writeFunctions: ABIFunction[];      // State-changing functions
}

// Network configuration for Sei testnet
export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
}

// Simple error types
export class ContractError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "ContractError";
  }
}

// Predefined constants for type detection
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

// Helper function to format contract address for display
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper function to validate Ethereum address format
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}