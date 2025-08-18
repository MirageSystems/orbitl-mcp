// Tests for ABI Manager and function encoding
// Validates that contract interfaces and encoding work correctly

import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import { ABIManager } from '../../src/wallet/abi-manager.js';

describe('ABIManager', () => {

  describe('getERC20ABI', () => {
    it('should return valid ERC-20 ABI', () => {
      const abi = ABIManager.getERC20ABI();
      
      expect(abi).toBeDefined();
      expect(Array.isArray(abi)).toBe(true);
      expect(abi.length).toBeGreaterThan(5);
      
      // Should contain essential functions
      const abiString = abi.join(' ');
      expect(abiString).toContain('function transfer(');
      expect(abiString).toContain('function approve(');
      expect(abiString).toContain('function balanceOf(');
      expect(abiString).toContain('function decimals(');
    });
  });

  describe('getERC721ABI', () => {
    it('should return valid ERC-721 ABI', () => {
      const abi = ABIManager.getERC721ABI();
      
      expect(abi).toBeDefined();
      expect(Array.isArray(abi)).toBe(true);
      
      const abiString = abi.join(' ');
      expect(abiString).toContain('function transferFrom(');
      expect(abiString).toContain('function safeTransferFrom(');
      expect(abiString).toContain('function ownerOf(');
      expect(abiString).toContain('function tokenURI(');
    });
  });

  describe('createInterface', () => {
    it('should create ethers Interface from ABI', () => {
      const abi = ABIManager.getERC20ABI();
      const iface = ABIManager.createInterface(abi);
      
      expect(iface).toBeDefined();
      expect(iface).toBeInstanceOf(ethers.Interface);
      
      // Should be able to get functions
      const transferFunction = iface.getFunction('transfer');
      expect(transferFunction).toBeDefined();
      expect(transferFunction?.name).toBe('transfer');
    });

    it('should throw error for invalid ABI', () => {
      const invalidAbi = ['invalid function signature'];
      
      expect(() => {
        ABIManager.createInterface(invalidAbi);
      }).toThrow('Failed to create interface');
    });
  });

  describe('getABIForContractType', () => {
    it('should return correct ABI for each contract type', () => {
      const erc20Abi = ABIManager.getABIForContractType('ERC20');
      const erc721Abi = ABIManager.getABIForContractType('ERC721');
      const dexAbi = ABIManager.getABIForContractType('DEXRouter');
      
      expect(erc20Abi).toBeDefined();
      expect(erc721Abi).toBeDefined();
      expect(dexAbi).toBeDefined();
      
      expect(erc20Abi.join(' ')).toContain('function transfer(');
      expect(erc721Abi.join(' ')).toContain('function ownerOf(');
      expect(dexAbi.join(' ')).toContain('function swapExactTokensForTokens(');
    });

    it('should throw error for unsupported contract type', () => {
      expect(() => {
        ABIManager.getABIForContractType('UnsupportedType' as any);
      }).toThrow('Unsupported contract type');
    });
  });

  describe('validateABI', () => {
    it('should validate complete ERC-20 ABI', () => {
      const abi = ABIManager.getERC20ABI();
      const result = ABIManager.validateABI(abi, ['transfer', 'approve']);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required functions', () => {
      const incompleteAbi = [
        'function transfer(address to, uint256 amount) returns (bool)'
        // Missing approve function
      ];
      
      const result = ABIManager.validateABI(incompleteAbi, ['transfer', 'approve']);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required function: approve');
    });

    it('should handle invalid ABI format', () => {
      const invalidAbi = ['not a valid function signature'];
      
      const result = ABIManager.validateABI(invalidAbi, ['transfer']);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid ABI format');
      expect(result.suggestions).toContain('Check that the ABI is properly formatted JSON');
    });
  });

  describe('encodeFunctionCall', () => {
    it('should encode transfer function correctly', () => {
      const abi = ABIManager.getERC20ABI();
      // Use proper checksummed address
      const recipient = ethers.getAddress('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456');
      const amount = BigInt('1000000000000000000'); // 1 token in wei
      
      const encoded = ABIManager.encodeFunctionCall(abi, 'transfer', [recipient, amount]);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.startsWith('0x')).toBe(true);
      expect(encoded.length).toBeGreaterThan(10); // Should be a hex string with function selector + params
    });

    it('should encode approve function correctly', () => {
      const abi = ABIManager.getERC20ABI();
      const spender = ethers.getAddress('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a');
      const amount = ethers.MaxUint256;
      
      const encoded = ABIManager.encodeFunctionCall(abi, 'approve', [spender, amount]);
      
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
      expect(encoded.startsWith('0x')).toBe(true);
    });

    it('should throw error for non-existent function', () => {
      const abi = ABIManager.getERC20ABI();
      
      expect(() => {
        ABIManager.encodeFunctionCall(abi, 'nonExistentFunction', []);
      }).toThrow("Failed to encode function 'nonExistentFunction'");
    });

    it('should throw error for wrong number of parameters', () => {
      const abi = ABIManager.getERC20ABI();
      
      expect(() => {
        ABIManager.encodeFunctionCall(abi, 'transfer', ['0x123']); // Missing amount parameter
      }).toThrow("Wrong number of parameters for function 'transfer'");
    });

    it('should throw error for invalid parameter types', () => {
      const abi = ABIManager.getERC20ABI();
      
      expect(() => {
        ABIManager.encodeFunctionCall(abi, 'transfer', ['invalid-address', BigInt(100)]);
      }).toThrow("Invalid parameter type for function 'transfer'");
    });
  });

  describe('decodeFunctionCall', () => {
    it('should decode transfer function call', () => {
      const abi = ABIManager.getERC20ABI();
      const recipient = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
      const amount = BigInt('1000000000000000000');
      
      // First encode, then decode
      const encoded = ABIManager.encodeFunctionCall(abi, 'transfer', [recipient, amount]);
      const decoded = ABIManager.decodeFunctionCall(abi, encoded);
      
      expect(decoded).toBeDefined();
      expect(decoded!.functionName).toBe('transfer');
      expect(decoded!.parameters).toHaveLength(2);
      expect(decoded!.parameters[0]).toBe(recipient);
      expect(decoded!.parameters[1]).toBe(amount);
    });

    it('should return null for invalid data', () => {
      const abi = ABIManager.getERC20ABI();
      const result = ABIManager.decodeFunctionCall(abi, '0xinvaliddata');
      
      expect(result).toBeNull();
    });

    it('should return null for empty data', () => {
      const abi = ABIManager.getERC20ABI();
      const result = ABIManager.decodeFunctionCall(abi, '0x');
      
      expect(result).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('should encode and decode consistently', () => {
      const abi = ABIManager.getERC20ABI();
      const testCases = [
        {
          function: 'transfer',
          params: ['0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', BigInt('1000000000000000000')]
        },
        {
          function: 'approve',
          params: ['0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', ethers.MaxUint256]
        }
      ];

      for (const testCase of testCases) {
        const encoded = ABIManager.encodeFunctionCall(abi, testCase.function, testCase.params);
        const decoded = ABIManager.decodeFunctionCall(abi, encoded);
        
        expect(decoded).toBeDefined();
        expect(decoded!.functionName).toBe(testCase.function);
        expect(decoded!.parameters).toEqual(testCase.params);
      }
    });

    it('should work with real ethers Interface', () => {
      const abi = ABIManager.getERC20ABI();
      const iface = ABIManager.createInterface(abi);
      
      // Encode using our utility
      const recipient = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
      const amount = BigInt('1000000000000000000');
      const encoded = ABIManager.encodeFunctionCall(abi, 'transfer', [recipient, amount]);
      
      // Decode using ethers directly to verify compatibility
      const decoded = iface.parseTransaction({ data: encoded });
      
      expect(decoded).toBeDefined();
      expect(decoded!.name).toBe('transfer');
      expect(decoded!.args[0]).toBe(recipient);
      expect(decoded!.args[1]).toBe(amount);
    });
  });
});