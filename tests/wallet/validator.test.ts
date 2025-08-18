// Comprehensive tests for TransactionValidator
// Tests all validation logic with various edge cases

import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { ethers } from 'ethers';
import { TransactionValidator } from '../../src/wallet/validator.js';

// Mock ethers for validation tests
vi.mock('ethers');

describe('TransactionValidator', () => {
  beforeEach(() => {
    // Mock ethers.isAddress by default to return true for valid-looking addresses
    (ethers.isAddress as MockedFunction<typeof ethers.isAddress>) = vi.fn();
    (ethers.getAddress as MockedFunction<typeof ethers.getAddress>) = vi.fn();
    
    // Default behavior: return true for addresses that look valid
    (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockImplementation((address) => {
      return address === '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456' ||
             address === '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a' ||
             address === '0x0000000000000000000000000000000000000000' ||
             address === '0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456';
    });
    
    // Mock getAddress to return proper checksum
    (ethers.getAddress as MockedFunction<typeof ethers.getAddress>).mockImplementation((address) => {
      if (address === '0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456') {
        return '0x742D35Cc6665Cb9D9dC69E7A1E15f2Fc0C9A3456';
      }
      return address;
    });
  });

  describe('validateAddress', () => {
    const validAddress = '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'; // All lowercase to avoid checksum warnings

    it('should validate correct addresses', () => {
      // Add this lowercase address to our mock
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockImplementation((address) => {
        return address === '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456' ||
               address === '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a' ||
               address === '0x0000000000000000000000000000000000000000' ||
               address === '0x742d35cc6665cb9d9dc69e7a1e15f2fc0c9a3456' ||
               address === '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a';
      });
      
      const result = TransactionValidator.validateAddress(validAddress, 'Test address');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject empty addresses when required', () => {
      const result = TransactionValidator.validateAddress('', 'Test address');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test address is required');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should accept empty addresses when not required', () => {
      const result = TransactionValidator.validateAddress('', 'Test address', false);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject addresses not starting with 0x', () => {
      const result = TransactionValidator.validateAddress('742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', 'Test address');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test address must start with \'0x\'');
    });

    it('should reject addresses with wrong length', () => {
      const result = TransactionValidator.validateAddress('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A345', 'Test address'); // Too short
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test address must be exactly 42 characters long');
    });

    it('should reject addresses with invalid characters', () => {
      const result = TransactionValidator.validateAddress('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3G56', 'Test address'); // G is not hex
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test address contains invalid characters');
    });

    it('should warn about zero address', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      const result = TransactionValidator.validateAddress(zeroAddress, 'Test address');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('This is the zero address - tokens sent here will be lost');
    });

    it('should warn about checksum issues', () => {
      const mixedCaseAddress = '0x742d35Cc6665cb9D9dc69e7a1e15f2fc0c9a3456'; // Mixed case
      const checksummedAddress = '0x742D35Cc6665Cb9D9dC69E7A1E15f2Fc0C9A3456';
      
      // Make sure this address is considered valid
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(true);
      (ethers.getAddress as MockedFunction<typeof ethers.getAddress>).mockReturnValue(checksummedAddress);
      
      const result = TransactionValidator.validateAddress(mixedCaseAddress, 'Test address');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes(checksummedAddress))).toBe(true);
    });

    it('should handle ethers.js validation failure', () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);
      
      const result = TransactionValidator.validateAddress('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', 'Test address');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Test address is not a valid Ethereum address');
    });
  });

  describe('validateAmount', () => {
    it('should validate correct amounts', () => {
      const result = TransactionValidator.validateAmount('100');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate decimal amounts', () => {
      const result = TransactionValidator.validateAmount('100.5');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty amounts', () => {
      const result = TransactionValidator.validateAmount('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount is required');
    });

    it('should reject negative amounts', () => {
      const result = TransactionValidator.validateAmount('-100');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than zero');
    });

    it('should reject zero amounts', () => {
      const result = TransactionValidator.validateAmount('0');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than zero');
    });

    it('should reject non-numeric amounts', () => {
      const result = TransactionValidator.validateAmount('not-a-number');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number');
    });

    it('should reject amounts with invalid characters', () => {
      const result = TransactionValidator.validateAmount('100,000'); // Comma not allowed
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number');
    });

    it('should reject extremely large amounts', () => {
      const result = TransactionValidator.validateAmount('10000000000000'); // > 1 trillion
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount is too large');
    });

    it('should handle unlimited amounts when allowed', () => {
      const result = TransactionValidator.validateAmount('unlimited', 'Amount', true);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unlimited amounts when not allowed', () => {
      const result = TransactionValidator.validateAmount('unlimited', 'Amount', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount cannot be unlimited for this operation');
    });

    it('should handle various unlimited keywords', () => {
      const keywords = ['unlimited', 'max', 'maximum', 'infinite'];
      
      for (const keyword of keywords) {
        const result = TransactionValidator.validateAmount(keyword, 'Amount', true);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject amounts with too many decimal places', () => {
      const result = TransactionValidator.validateAmount('100.123456789012345678901', 'Amount', false, 18);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount has too many decimal places (max 18)');
    });

    it('should warn about very small amounts', () => {
      const result = TransactionValidator.validateAmount('0.0000001');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Very small amounts may not be processed correctly');
    });

    it('should warn about very large amounts', () => {
      const result = TransactionValidator.validateAmount('1000000000'); // 1 billion
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('This is a very large amount');
    });

    it('should warn about high precision amounts', () => {
      const result = TransactionValidator.validateAmount('100.12345678');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('High precision amounts may be rounded');
    });
  });

  describe('validateTransferParams', () => {
    const validParams = {
      tokenAddress: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
      recipient: '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a',
      amount: '100'
    };

    it('should validate correct transfer parameters', () => {
      const result = TransactionValidator.validateTransferParams(validParams);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should aggregate errors from all validations', () => {
      const invalidParams = {
        tokenAddress: 'invalid',
        recipient: 'invalid',
        amount: '-100'
      };
      
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);
      
      const result = TransactionValidator.validateTransferParams(invalidParams);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2); // Should have multiple errors
    });

    it('should warn about sending to token contract', () => {
      const sameAddressParams = {
        tokenAddress: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
        recipient: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', // Same as token
        amount: '100'
      };
      
      const result = TransactionValidator.validateTransferParams(sameAddressParams);
      
      expect(result.warnings).toContain('Sending tokens to the token contract address');
    });

    it('should remove duplicate suggestions', () => {
      const result = TransactionValidator.validateTransferParams({
        tokenAddress: '',
        recipient: '',
        amount: ''
      });
      
      // Should not have duplicate suggestions even though multiple fields are invalid
      const uniqueSuggestions = new Set(result.suggestions);
      expect(uniqueSuggestions.size).toBe(result.suggestions.length);
    });
  });

  describe('validateApprovalParams', () => {
    const validParams = {
      tokenAddress: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
      spender: '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a',
      amount: '100'
    };

    it('should validate correct approval parameters', () => {
      const result = TransactionValidator.validateApprovalParams(validParams);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about unlimited approvals', () => {
      const unlimitedParams = {
        ...validParams,
        amount: 'unlimited'
      };
      
      const result = TransactionValidator.validateApprovalParams(unlimitedParams);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Unlimited approval allows spender to take all your tokens');
      expect(result.suggestions).toContain('Consider approving only the amount you need');
    });

    it('should warn about approving token to itself', () => {
      const selfApprovalParams = {
        tokenAddress: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
        spender: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
        amount: '100'
      };
      
      const result = TransactionValidator.validateApprovalParams(selfApprovalParams);
      
      expect(result.warnings).toContain('Approving the token contract to spend its own tokens');
    });
  });

  describe('validateRpcUrl', () => {
    it('should validate correct HTTPS URLs', () => {
      const result = TransactionValidator.validateRpcUrl('https://sei-rpc.example.com');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate HTTP localhost URLs', () => {
      const result = TransactionValidator.validateRpcUrl('http://localhost:8545');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate WebSocket URLs', () => {
      const result = TransactionValidator.validateRpcUrl('wss://sei-ws.example.com');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty URLs', () => {
      const result = TransactionValidator.validateRpcUrl('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('RPC URL is required');
    });

    it('should reject invalid URL formats', () => {
      const result = TransactionValidator.validateRpcUrl('not-a-url');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid RPC URL format');
    });

    it('should reject URLs with invalid protocols', () => {
      const result = TransactionValidator.validateRpcUrl('ftp://sei-rpc.example.com');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('RPC URL must use HTTP, HTTPS, WS, or WSS protocol');
    });

    it('should warn about HTTP URLs (non-localhost)', () => {
      const result = TransactionValidator.validateRpcUrl('http://sei-rpc.example.com');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('HTTP URLs are not secure');
      expect(result.suggestions).toContain('Use HTTPS for production RPC endpoints');
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      const addressResult = TransactionValidator.validateAddress(undefined, 'Test address');
      expect(addressResult.isValid).toBe(false);

      const amountResult = TransactionValidator.validateAmount(undefined);
      expect(amountResult.isValid).toBe(false);

      const urlResult = TransactionValidator.validateRpcUrl(undefined);
      expect(urlResult.isValid).toBe(false);
    });

    it('should handle whitespace-only inputs', () => {
      const addressResult = TransactionValidator.validateAddress('   ', 'Test address');
      expect(addressResult.isValid).toBe(false);

      const amountResult = TransactionValidator.validateAmount('   ');
      expect(amountResult.isValid).toBe(false);
    });

    it('should trim whitespace from inputs', () => {
      const validAddress = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
      const result = TransactionValidator.validateAddress(`  ${validAddress}  `, 'Test address');
      
      expect(result.isValid).toBe(true);
    });
  });
});