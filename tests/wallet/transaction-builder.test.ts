// Comprehensive tests for SafeTransactionBuilder
// Tests the core transaction building functionality without needing a live network

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { ethers } from 'ethers';
import { SafeTransactionBuilder } from '../../src/wallet/transaction-builder.js';
import { TransactionBuildError } from '../../src/wallet/types.js';

// Mock ethers provider to avoid network calls during testing
vi.mock('ethers');

describe('SafeTransactionBuilder', () => {
  let builder: SafeTransactionBuilder;
  let mockProvider: any;
  let mockContract: any;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      getNetwork: vi.fn(),
    };

    // Create mock contract for token interactions
    mockContract = {
      decimals: vi.fn(),
    };

    // Mock ethers JsonRpcProvider constructor
    (ethers.JsonRpcProvider as any) = vi.fn(() => mockProvider);
    
    // Mock ethers Contract constructor
    (ethers.Contract as any) = vi.fn(() => mockContract);

    // Mock other ethers utilities
    (ethers.isAddress as MockedFunction<typeof ethers.isAddress>) = vi.fn();
    (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>) = vi.fn();
    (ethers.Interface as any) = vi.fn(() => ({
      encodeFunctionData: vi.fn()
    }));
    (ethers.MaxUint256 as any) = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    // Setup default mock returns
    (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(true);
    (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockReturnValue(BigInt('100000000000000000000'));
    mockContract.decimals.mockResolvedValue(18);
    mockProvider.getNetwork.mockResolvedValue({ chainId: BigInt(1329), name: 'sei-network' });

    builder = new SafeTransactionBuilder('http://test-rpc');
  });

  describe('buildTransfer', () => {
    const validTokenAddress = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
    const validRecipient = '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a';
    const validAmount = '100';

    it('should build a valid transfer transaction', async () => {
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0x1234567890');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      const result = await builder.buildTransfer(validTokenAddress, validRecipient, validAmount);

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.preview).toBeDefined();
      expect(result.safetyScore).toBe(95);

      // Check transaction structure
      expect(result.transaction.to).toBe(validTokenAddress);
      expect(result.transaction.value).toBe('0');
      expect(result.transaction.data).toBe('0x1234567890');
      expect(result.transaction.gasLimit).toBe('65000');

      // Check that encode was called correctly
      expect(mockEncodeFunctionData).toHaveBeenCalledWith('transfer', [
        validRecipient,
        BigInt('100000000000000000000')
      ]);
    });

    it('should include context in preview when provided', async () => {
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0x1234567890');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      const context = { tokenSymbol: 'USDC' };
      const result = await builder.buildTransfer(validTokenAddress, validRecipient, validAmount, context);

      expect(result.preview.humanDescription).toContain('USDC');
      expect(result.preview.contractName).toContain('USDC');
    });

    it('should throw error for invalid token address', async () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);

      await expect(
        builder.buildTransfer('invalid-address', validRecipient, validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should throw error for invalid recipient address', async () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>)
        .mockReturnValueOnce(true)  // First call for token address
        .mockReturnValueOnce(false); // Second call for recipient

      await expect(
        builder.buildTransfer(validTokenAddress, 'invalid-recipient', validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        builder.buildTransfer(validTokenAddress, validRecipient, 'invalid-amount')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer(validTokenAddress, validRecipient, '-100')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer(validTokenAddress, validRecipient, '0')
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should handle token decimals fetch failure gracefully', async () => {
      mockContract.decimals.mockRejectedValue(new Error('Contract not found'));
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0x1234567890');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      // Should still work with fallback to 18 decimals
      const result = await builder.buildTransfer(validTokenAddress, validRecipient, validAmount);
      expect(result).toBeDefined();
      expect(ethers.parseUnits).toHaveBeenCalledWith(validAmount, 18);
    });
  });

  describe('buildApproval', () => {
    const validTokenAddress = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
    const validSpender = '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a';
    const validAmount = '100';

    it('should build a valid approval transaction', async () => {
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0xabcdef1234');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      const result = await builder.buildApproval(validTokenAddress, validSpender, validAmount);

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.preview).toBeDefined();
      expect(result.safetyScore).toBe(90);

      // Check transaction structure
      expect(result.transaction.to).toBe(validTokenAddress);
      expect(result.transaction.value).toBe('0');
      expect(result.transaction.data).toBe('0xabcdef1234');
      expect(result.transaction.gasLimit).toBe('45000');

      // Check risk assessment
      expect(result.preview.riskLevel).toBe('LOW');
      expect(result.preview.warnings).toHaveLength(0);

      // Check that encode was called correctly
      expect(mockEncodeFunctionData).toHaveBeenCalledWith('approve', [
        validSpender,
        BigInt('100000000000000000000')
      ]);
    });

    it('should handle unlimited approval correctly', async () => {
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0xabcdef1234');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      const result = await builder.buildApproval(validTokenAddress, validSpender, 'unlimited');

      expect(result.preview.riskLevel).toBe('MEDIUM');
      expect(result.preview.warnings.length).toBeGreaterThan(0);
      expect(result.safetyScore).toBe(75);
      expect(result.preview.humanDescription).toContain('unlimited');

      // Should use MaxUint256 for unlimited
      expect(mockEncodeFunctionData).toHaveBeenCalledWith('approve', [
        validSpender,
        ethers.MaxUint256
      ]);
    });

    it('should handle "max" as unlimited approval', async () => {
      const mockEncodeFunctionData = vi.fn().mockReturnValue('0xabcdef1234');
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      const result = await builder.buildApproval(validTokenAddress, validSpender, 'max');

      expect(result.preview.riskLevel).toBe('MEDIUM');
      expect(mockEncodeFunctionData).toHaveBeenCalledWith('approve', [
        validSpender,
        ethers.MaxUint256
      ]);
    });

    it('should throw error for invalid addresses', async () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);

      await expect(
        builder.buildApproval('invalid-token', validSpender, validAmount)
      ).rejects.toThrow(TransactionBuildError);

      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>)
        .mockReturnValueOnce(true)  // Token address valid
        .mockReturnValueOnce(false); // Spender invalid

      await expect(
        builder.buildApproval(validTokenAddress, 'invalid-spender', validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });
  });

  describe('input validation', () => {
    it('should reject empty or undefined addresses', async () => {
      await expect(
        builder.buildTransfer('', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '100')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '', '100')
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should reject empty or invalid amounts', async () => {
      const validAddress = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';

      await expect(
        builder.buildTransfer(validAddress, validAddress, '')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer(validAddress, validAddress, '0')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer(validAddress, validAddress, '-100')
      ).rejects.toThrow(TransactionBuildError);

      await expect(
        builder.buildTransfer(validAddress, validAddress, 'not-a-number')
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should reject extremely large amounts', async () => {
      const validAddress = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';

      await expect(
        builder.buildTransfer(validAddress, validAddress, '1000000000001') // > 1 trillion
      ).rejects.toThrow(TransactionBuildError);
    });
  });

  describe('getNetworkInfo', () => {
    it('should return network information', async () => {
      const networkInfo = await builder.getNetworkInfo();
      
      expect(networkInfo).toBeDefined();
      expect(networkInfo.chainId).toBe(1329);
      expect(networkInfo.name).toBe('sei-network');
    });

    it('should return default network info on error', async () => {
      mockProvider.getNetwork.mockRejectedValue(new Error('Network error'));

      const networkInfo = await builder.getNetworkInfo();
      
      expect(networkInfo.chainId).toBe(1329);
      expect(networkInfo.name).toBe('sei-network');
    });
  });

  describe('error handling', () => {
    it('should provide helpful suggestions in error messages', async () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);

      try {
        await builder.buildTransfer('invalid', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '100');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionBuildError);
        const buildError = error as TransactionBuildError;
        expect(buildError.suggestions).toBeDefined();
        expect(buildError.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('should include error codes for programmatic handling', async () => {
      (ethers.isAddress as MockedFunction<typeof ethers.isAddress>).mockReturnValue(false);

      try {
        await builder.buildTransfer('invalid', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '100');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionBuildError);
        const buildError = error as TransactionBuildError;
        expect(buildError.code).toBe('INVALID_ADDRESS');
      }
    });

    it('should handle encoding failures gracefully', async () => {
      const mockEncodeFunctionData = vi.fn().mockImplementation(() => {
        throw new Error('Encoding failed');
      });
      (ethers.Interface as any) = vi.fn(() => ({
        encodeFunctionData: mockEncodeFunctionData
      }));

      await expect(
        builder.buildTransfer(
          '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
          '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a',
          '100'
        )
      ).rejects.toThrow(TransactionBuildError);
    });
  });
});