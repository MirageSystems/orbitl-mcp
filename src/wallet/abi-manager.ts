// ABI Manager for handling contract interfaces and function encoding
// Provides standardized ABIs for common contract types (ERC-20, ERC-721, etc.)

import { ethers } from 'ethers';

/**
 * Manages ABIs and creates ethers.js interfaces for contract interaction
 * Focuses on standard interfaces to ensure compatibility and safety
 */
export class ABIManager {
  
  /**
   * Standard ERC-20 ABI with all commonly used functions
   * Includes: transfer, approve, transferFrom, balanceOf, decimals, symbol, name
   */
  static getERC20ABI(): any[] {
    return [
      // Core transfer functions
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
      
      // View functions
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function totalSupply() view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)',
      
      // Events
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Approval(address indexed owner, address indexed spender, uint256 value)'
    ];
  }

  /**
   * Standard ERC-721 (NFT) ABI with essential functions
   */
  static getERC721ABI(): any[] {
    return [
      // Core transfer functions
      'function transferFrom(address from, address to, uint256 tokenId)',
      'function safeTransferFrom(address from, address to, uint256 tokenId)',
      'function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data)',
      'function approve(address to, uint256 tokenId)',
      'function setApprovalForAll(address operator, bool approved)',
      
      // View functions  
      'function balanceOf(address owner) view returns (uint256)',
      'function ownerOf(uint256 tokenId) view returns (address)',
      'function getApproved(uint256 tokenId) view returns (address)',
      'function isApprovedForAll(address owner, address operator) view returns (bool)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function tokenURI(uint256 tokenId) view returns (string)',
      
      // Events
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
      'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
      'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
    ];
  }

  /**
   * Common DEX Router ABI (Uniswap V2 style)
   * Useful for swap functionality
   */
  static getDEXRouterABI(): any[] {
    return [
      // Swap functions
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
      'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
      'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
      
      // Liquidity functions
      'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)',
      'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB)',
      
      // View functions
      'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
      'function getAmountsIn(uint amountOut, address[] calldata path) view returns (uint[] memory amounts)',
      'function factory() view returns (address)',
      'function WETH() view returns (address)'
    ];
  }

  /**
   * Create an ethers.js Interface from an ABI
   * Handles error cases gracefully
   */
  static createInterface(abi: any[]): ethers.Interface {
    try {
      return new ethers.Interface(abi);
    } catch (error) {
      throw new Error(`Failed to create interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ABI for a specific contract type
   * Extensible system for different contract standards
   */
  static getABIForContractType(contractType: ContractType): any[] {
    switch (contractType) {
      case 'ERC20':
        return this.getERC20ABI();
      case 'ERC721':
        return this.getERC721ABI();
      case 'DEXRouter':
        return this.getDEXRouterABI();
      default:
        throw new Error(`Unsupported contract type: ${contractType}`);
    }
  }

  /**
   * Validate that an ABI contains required functions
   * Useful for ensuring contracts implement expected interfaces
   */
  static validateABI(abi: any[], requiredFunctions: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const iface = new ethers.Interface(abi);
      
      // Check for required functions
      for (const funcName of requiredFunctions) {
        try {
          iface.getFunction(funcName);
        } catch {
          errors.push(`Missing required function: ${funcName}`);
        }
      }

      // Check for common functions that should exist
      const commonERC20Functions = ['transfer', 'approve', 'balanceOf'];
      const missingCommon = commonERC20Functions.filter(func => {
        try {
          iface.getFunction(func);
          return false;
        } catch {
          return true;
        }
      });

      if (missingCommon.length > 0) {
        warnings.push(`Missing common functions: ${missingCommon.join(', ')}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions: errors.length > 0 ? ['Verify this is the correct contract ABI'] : []
      };

    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid ABI format'],
        warnings: [],
        suggestions: ['Check that the ABI is properly formatted JSON']
      };
    }
  }

  /**
   * Encode function call data
   * Provides better error messages than raw ethers.js calls
   */
  static encodeFunctionCall(
    abi: any[],
    functionName: string,
    parameters: any[]
  ): string {
    try {
      const iface = this.createInterface(abi);
      return iface.encodeFunctionData(functionName, parameters);
    } catch (error) {
      // Provide helpful error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown encoding error';
      
      if (errorMessage.includes('no matching function')) {
        throw new Error(`Function '${functionName}' not found in contract ABI`);
      }
      
      if (errorMessage.includes('wrong number of arguments')) {
        throw new Error(`Wrong number of parameters for function '${functionName}'`);
      }
      
      if (errorMessage.includes('invalid type')) {
        throw new Error(`Invalid parameter type for function '${functionName}': ${errorMessage}`);
      }
      
      throw new Error(`Failed to encode function '${functionName}': ${errorMessage}`);
    }
  }

  /**
   * Decode function call data back to parameters
   * Useful for debugging and validation
   */
  static decodeFunctionCall(
    abi: any[],
    data: string
  ): { functionName: string; parameters: any[] } | null {
    try {
      const iface = this.createInterface(abi);
      const decoded = iface.parseTransaction({ data });
      
      if (!decoded) {
        return null;
      }

      return {
        functionName: decoded.name,
        parameters: Array.from(decoded.args)
      };
    } catch (error) {
      // Return null for invalid data instead of throwing
      return null;
    }
  }
}

/**
 * Supported contract types
 */
export type ContractType = 'ERC20' | 'ERC721' | 'DEXRouter';

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}