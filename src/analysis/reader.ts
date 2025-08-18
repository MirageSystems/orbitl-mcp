// Phase 1: Contract Reader - Contract analysis
// Battle-tested approach: pattern matching, no complex logic

import type { 
  ContractData, 
  ABIFunction, 
  ContractType
} from "./types.js";
import { isValidAddress } from "./types.js";
import { SeiProvider } from "../network/sei.js";

export class ContractReader {
  private seiProvider: SeiProvider;

  constructor(seiProvider: SeiProvider) {
    this.seiProvider = seiProvider;
  }

  /**
   * Main method: Read and analyze a contract
   * Reliable process following the plan
   */
  async read(address: string): Promise<ContractData> {
    // Step 1: Validate address format
    if (!isValidAddress(address)) {
      throw new Error(`Invalid address format: ${address}`);
    }

    try {
      // Step 2: Check if address has contract code
      const hasCode = await this.seiProvider.hasCode(address);
      if (!hasCode) {
        throw new Error(`Address ${address} is not a contract (no bytecode found)`);
      }

      // Step 3: Try to fetch ABI from explorer
      const abi = await this.seiProvider.fetchABI(address);
      const isVerified = abi.length > 0;

      // Step 4: Determine basic contract type from ABI function names
      const basicType = this.detectContractType(abi);

      // Step 5: Categorize functions
      const readOnlyFunctions = abi.filter(f => 
        f.stateMutability === "view" || f.stateMutability === "pure"
      );
      
      const writeFunctions = abi.filter(f => 
        f.stateMutability === "nonpayable" || f.stateMutability === "payable"
      );

      // Return structured contract data
      return {
        address: address.toLowerCase(),
        hasCode: true,
        isVerified,
        abi,
        basicType,
        functionCount: abi.length,
        readOnlyFunctions,
        writeFunctions
      };

    } catch (error) {
      if (error instanceof Error) {
        throw error; // Re-throw known errors
      }
      throw new Error(`Failed to read contract: ${String(error)}`);
    }
  }

  /**
   * Contract type detection based on function names
   * Battle-tested approach: explicit pattern matching
   */
  private detectContractType(abi: ABIFunction[]): ContractType {
    if (abi.length === 0) {
      return "Unknown";
    }

    // Get all function names in lowercase for matching
    const functionNames = abi.map(f => f.name.toLowerCase());

    // Check Token pattern: must have transfer + balanceOf
    if (this.hasRequiredFunctions(functionNames, ["transfer", "balanceof"])) {
      return "Token";
    }

    // Check DEX pattern: must have swap or addLiquidity
    if (this.hasAnyFunction(functionNames, ["swap", "addliquidity"])) {
      return "DEX";
    }

    // Check Farm pattern: must have deposit + withdraw OR stake
    if (this.hasRequiredFunctions(functionNames, ["deposit", "withdraw"]) ||
        this.hasAnyFunction(functionNames, ["stake", "unstake"])) {
      return "Farm";
    }

    return "Unknown";
  }

  /**
   * Helper: Check if all required functions exist
   */
  private hasRequiredFunctions(functionNames: string[], required: string[]): boolean {
    return required.every(reqFunc => 
      functionNames.some(fn => fn.includes(reqFunc))
    );
  }

  /**
   * Helper: Check if any of the functions exist
   */
  private hasAnyFunction(functionNames: string[], targets: string[]): boolean {
    return targets.some(targetFunc =>
      functionNames.some(fn => fn.includes(targetFunc))
    );
  }

  /**
   * Get human-readable function description
   * Mapping for common functions
   */
  static getFunctionDescription(func: ABIFunction): string {
    const name = func.name.toLowerCase();
    
    // Common function descriptions
    const descriptions: Record<string, string> = {
      "name": "Get token name",
      "symbol": "Get token symbol", 
      "decimals": "Get token decimals",
      "totalsupply": "Get total supply",
      "balanceof": "Check balance",
      "transfer": "Send tokens",
      "approve": "Allow spending",
      "allowance": "Check spending allowance",
      "transferfrom": "Transfer on behalf",
      "swap": "Exchange tokens",
      "addliquidity": "Add liquidity to pool",
      "removeliquidity": "Remove liquidity from pool",
      "deposit": "Deposit tokens",
      "withdraw": "Withdraw tokens",
      "stake": "Stake tokens for rewards",
      "unstake": "Unstake tokens",
      "claimrewards": "Claim earned rewards",
      "getreserves": "Get pool reserves"
    };

    // Find matching description
    for (const [key, description] of Object.entries(descriptions)) {
      if (name.includes(key)) {
        return description;
      }
    }

    // Default description based on mutability
    if (func.stateMutability === "view" || func.stateMutability === "pure") {
      return `View ${func.name} data`;
    }
    
    return `Execute ${func.name}`;
  }

  /**
   * Format function signature for display
   */
  static formatFunctionSignature(func: ABIFunction): string {
    const inputs = func.inputs.map(input => input.type).join(", ");
    return `${func.name}(${inputs})`;
  }
}