// Tests for Enhanced Transaction Builder with Function Encoding
// Tests the new ethers.js integration and improved functionality

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { ethers } from 'ethers';
import { SafeTransactionBuilder } from '../../src/wallet/transaction-builder.js';
import { TokenInfo } from '../../src/wallet/token-info.js';
import { ABIManager } from '../../src/wallet/abi-manager.js';
import { TransactionBuildError } from '../../src/wallet/types.js';

// Mock all dependencies
vi.mock('ethers');
vi.mock('../../src/wallet/token-info.js');
vi.mock('../../src/wallet/abi-manager.js');
vi.mock('../../src/wallet/validator.js');

describe('Enhanced SafeTransactionBuilder', () => {
  let builder: SafeTransactionBuilder;
  let mockProvider: any;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: BigInt(1329), name: 'sei-network' })
    };

    // Mock ethers JsonRpcProvider constructor
    (ethers.JsonRpcProvider as any) = vi.fn(() => mockProvider);

    // Mock TokenInfo methods
    const TokenInfoMock = TokenInfo as any;
    TokenInfoMock.setProvider = vi.fn();
    TokenInfoMock.getTokenMetadata = vi.fn();
    TokenInfoMock.validateAmountForToken = vi.fn();
    TokenInfoMock.toWei = vi.fn();
    TokenInfoMock.formatAmount = vi.fn();

    // Mock ABIManager methods
    const ABIManagerMock = ABIManager as any;
    ABIManagerMock.getERC20ABI = vi.fn();
    ABIManagerMock.encodeFunctionCall = vi.fn();

    // Setup default mock returns
    TokenInfoMock.getTokenMetadata.mockResolvedValue({
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a'
    });

    TokenInfoMock.validateAmountForToken.mockResolvedValue({ isValid: true });
    TokenInfoMock.toWei.mockResolvedValue(BigInt('100000000')); // 100 USDC
    TokenInfoMock.formatAmount.mockResolvedValue('100.00 USDC');

    ABIManagerMock.getERC20ABI.mockReturnValue(['function transfer(address,uint256)']);
    ABIManagerMock.encodeFunctionCall.mockReturnValue('0xa9059cbb000000000000000000000000742d35cc6665cb9d9dc69e7a1e15f2fc0c9a345600000000000000000000000000000000000000000000000005f5e100');

    builder = new SafeTransactionBuilder('http://test-rpc');
  });

  describe('constructor', () => {
    it('should initialize provider and TokenInfo', () => {
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith('http://test-rpc');
      expect(TokenInfo.setProvider).toHaveBeenCalledWith('http://test-rpc');
    });
  });

  describe('buildTransfer - enhanced version', () => {
    const validTokenAddress = '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a';
    const validRecipient = '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456';
    const validAmount = '100';

    it('should build transfer with enhanced metadata', async () => {
      // Mock validation to pass
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await builder.buildTransfer(validTokenAddress, validRecipient, validAmount);

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.preview).toBeDefined();

      // Should use token metadata for better descriptions
      expect(result.preview.contractName).toBe('USD Coin (USDC)');
      expect(result.preview.humanDescription).toContain('100.00 USDC');
      
      // Should use ABI manager for encoding
      expect(ABIManager.encodeFunctionCall).toHaveBeenCalledWith(
        expect.any(Array),
        'transfer',
        [validRecipient, BigInt('100000000')]
      );

      // Should validate amount against token decimals
      expect(TokenInfo.validateAmountForToken).toHaveBeenCalledWith(validAmount, validTokenAddress);
    });

    it('should handle validation failures gracefully', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: false,
        errors: ['Invalid token address'],
        warnings: [],
        suggestions: ['Check the address format']
      });

      await expect(
        builder.buildTransfer('invalid', validRecipient, validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should handle decimal validation failures', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      (TokenInfo.validateAmountForToken as any).mockResolvedValue({
        isValid: false,
        error: 'Too many decimal places',
        maxDecimals: 6
      });

      await expect(
        builder.buildTransfer(validTokenAddress, validRecipient, '100.1234567')
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should include validation warnings in preview', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Large transfer amount']
      });

      const result = await builder.buildTransfer(validTokenAddress, validRecipient, validAmount);

      expect(result.preview.warnings).toContain('Large transfer amount');
    });

    it('should handle encoding failures', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      (ABIManager.encodeFunctionCall as any).mockImplementation(() => {
        throw new Error('Encoding failed');
      });

      await expect(
        builder.buildTransfer(validTokenAddress, validRecipient, validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });
  });

  describe('buildApproval - enhanced version', () => {
    const validTokenAddress = '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a';
    const validSpender = '0x1234567890123456789012345678901234567890';

    it('should build limited approval correctly', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateApprovalParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await builder.buildApproval(validTokenAddress, validSpender, '100');

      expect(result).toBeDefined();
      expect(result.preview.riskLevel).toBe('LOW');
      expect(result.safetyScore).toBe(85);
      expect(result.preview.humanDescription).toContain('100.00 USDC');

      expect(ABIManager.encodeFunctionCall).toHaveBeenCalledWith(
        expect.any(Array),
        'approve',
        [validSpender, BigInt('100000000')]
      );
    });

    it('should build unlimited approval with warnings', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateApprovalParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Unlimited approval detected']
      });

      const result = await builder.buildApproval(validTokenAddress, validSpender, 'unlimited');

      expect(result).toBeDefined();
      expect(result.preview.riskLevel).toBe('MEDIUM');
      expect(result.safetyScore).toBe(65);
      expect(result.preview.humanDescription).toContain('unlimited');
      expect(result.preview.warnings.length).toBeGreaterThan(2);

      expect(ABIManager.encodeFunctionCall).toHaveBeenCalledWith(
        expect.any(Array),
        'approve',
        [validSpender, ethers.MaxUint256]
      );
    });

    it('should handle various unlimited keywords', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateApprovalParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const keywords = ['unlimited', 'max', 'maximum'];

      for (const keyword of keywords) {
        const result = await builder.buildApproval(validTokenAddress, validSpender, keyword);
        
        expect(result.preview.riskLevel).toBe('MEDIUM');
        expect(ABIManager.encodeFunctionCall).toHaveBeenCalledWith(
          expect.any(Array),
          'approve',
          [validSpender, ethers.MaxUint256]
        );
      }
    });
  });

  describe('buildTransferFrom', () => {
    const validTokenAddress = '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a';
    const validFrom = '0x1111111111111111111111111111111111111111';
    const validTo = '0x2222222222222222222222222222222222222222';
    const validAmount = '100';

    it('should build transferFrom transaction correctly', async () => {
      // Mock individual address validations
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateAddress = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      TransactionValidatorMock.validateAmount = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const result = await builder.buildTransferFrom(validTokenAddress, validFrom, validTo, validAmount);

      expect(result).toBeDefined();
      expect(result.transaction.to).toBe(validTokenAddress);
      expect(result.transaction.gasLimit).toBe('70000'); // Higher than regular transfer
      expect(result.preview.riskLevel).toBe('MEDIUM');
      expect(result.safetyScore).toBe(80);

      // Should include allowance warnings
      expect(result.preview.warnings.some(w => w.includes('allowance'))).toBe(true);
      expect(result.preview.warnings.some(w => w.includes('permission'))).toBe(true);

      expect(ABIManager.encodeFunctionCall).toHaveBeenCalledWith(
        expect.any(Array),
        'transferFrom',
        [validFrom, validTo, BigInt('100000000')]
      );
    });

    it('should validate all addresses', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateAddress = vi.fn()
        .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] })  // token
        .mockReturnValueOnce({ isValid: false, errors: ['Invalid from address'], warnings: [] })  // from
        .mockReturnValueOnce({ isValid: true, errors: [], warnings: [] })  // to
      TransactionValidatorMock.validateAmount = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      await expect(
        builder.buildTransferFrom(validTokenAddress, 'invalid-from', validTo, validAmount)
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should include helpful error suggestions for transferFrom', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateAddress = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      TransactionValidatorMock.validateAmount = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      (ABIManager.encodeFunctionCall as any).mockImplementation(() => {
        throw new Error('Encoding error');
      });

      try {
        await builder.buildTransferFrom(validTokenAddress, validFrom, validTo, validAmount);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionBuildError);
        const buildError = error as TransactionBuildError;
        expect(buildError.suggestions).toContain('Verify you have approval to spend from the source address');
      }
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle TokenInfo metadata failures gracefully', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      (TokenInfo.getTokenMetadata as any).mockRejectedValue(new Error('Metadata fetch failed'));

      await expect(
        builder.buildTransfer('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '100')
      ).rejects.toThrow(TransactionBuildError);
    });

    it('should provide detailed error information', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: false,
        errors: ['Invalid token address format'],
        warnings: [],
        suggestions: ['Use a valid 42-character hex address']
      });

      try {
        await builder.buildTransfer('invalid', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '100');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionBuildError);
        const buildError = error as TransactionBuildError;
        expect(buildError.message).toBe('Invalid token address format');
        expect(buildError.code).toBe('VALIDATION_FAILED');
        expect(buildError.suggestions).toContain('Use a valid 42-character hex address');
      }
    });
  });

  describe('integration with utility classes', () => {
    it('should call all required utility methods', async () => {
      const mockValidation = await import('../../src/wallet/validator.js');
      const TransactionValidatorMock = mockValidation.TransactionValidator as any;
      TransactionValidatorMock.validateTransferParams = vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Test warning']
      });

      await builder.buildTransfer('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '100');

      // Verify all integrations were called
      expect(TokenInfo.getTokenMetadata).toHaveBeenCalledWith('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a');
      expect(TokenInfo.validateAmountForToken).toHaveBeenCalledWith('100', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a');
      expect(TokenInfo.toWei).toHaveBeenCalledWith('100', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a');
      expect(TokenInfo.formatAmount).toHaveBeenCalledWith('100', '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', false);
      expect(ABIManager.getERC20ABI).toHaveBeenCalled();
      expect(ABIManager.encodeFunctionCall).toHaveBeenCalled();
    });
  });
});