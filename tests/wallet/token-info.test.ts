// Tests for TokenInfo utility
// Validates decimal handling and amount conversions

import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { ethers } from 'ethers';
import { TokenInfo } from '../../src/wallet/token-info.js';

// Mock ethers
vi.mock('ethers');

describe('TokenInfo', () => {
  let mockProvider: any;
  let mockContract: any;

  beforeEach(() => {
    // Create mock provider
    mockProvider = {};

    // Create mock contract
    mockContract = {
      decimals: vi.fn(),
      symbol: vi.fn(),
      name: vi.fn(),
      balanceOf: vi.fn()
    };

    // Mock ethers constructors
    (ethers.JsonRpcProvider as any) = vi.fn(() => mockProvider);
    (ethers.Contract as any) = vi.fn(() => mockContract);

    // Mock ethers utilities
    (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>) = vi.fn();
    (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>) = vi.fn();

    // Setup default mock returns
    mockContract.decimals.mockResolvedValue(18);
    mockContract.symbol.mockResolvedValue('TOKEN');
    mockContract.name.mockResolvedValue('Test Token');
    (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockReturnValue(BigInt('1000000000000000000'));
    (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>).mockReturnValue('1.0');
  });

  describe('getDecimals', () => {
    it('should return decimals from known tokens', async () => {
      // USDC should have 6 decimals
      const decimals = await TokenInfo.getDecimals('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      expect(decimals).toBe(6);
    });

    it('should fetch decimals from contract when provider is set', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.decimals.mockResolvedValue(8);

      const decimals = await TokenInfo.getDecimals('0x1234567890123456789012345678901234567890');
      
      expect(decimals).toBe(8);
      expect(mockContract.decimals).toHaveBeenCalled();
    });

    it('should fallback to 18 decimals when contract call fails', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.decimals.mockRejectedValue(new Error('Contract not found'));

      const decimals = await TokenInfo.getDecimals('0x1234567890123456789012345678901234567890');
      
      expect(decimals).toBe(18);
    });

    it('should fallback to 18 decimals when no provider is set', async () => {
      // Don't set provider
      const decimals = await TokenInfo.getDecimals('0x1234567890123456789012345678901234567890');
      
      expect(decimals).toBe(18);
    });
  });

  describe('getTokenMetadata', () => {
    it('should return metadata for known tokens', async () => {
      const metadata = await TokenInfo.getTokenMetadata('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(metadata).toEqual({
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        address: '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'
      });
    });

    it('should fetch metadata from contract', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.symbol.mockResolvedValue('TEST');
      mockContract.name.mockResolvedValue('Test Token');
      mockContract.decimals.mockResolvedValue(18);

      const metadata = await TokenInfo.getTokenMetadata('0x1234567890123456789012345678901234567890');
      
      expect(metadata).toEqual({
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
        address: '0x1234567890123456789012345678901234567890'
      });
    });

    it('should return default metadata when contract calls fail', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.symbol.mockRejectedValue(new Error('Contract error'));

      const metadata = await TokenInfo.getTokenMetadata('0x1234567890123456789012345678901234567890');
      
      expect(metadata).toEqual({
        symbol: 'TOKEN',
        name: 'Unknown Token',
        decimals: 18,
        address: '0x1234567890123456789012345678901234567890'
      });
    });
  });

  describe('toWei', () => {
    it('should convert amount to wei with correct decimals', async () => {
      (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockReturnValue(BigInt('100000000')); // 100 USDC (6 decimals)

      const result = await TokenInfo.toWei('100', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'); // USDC
      
      expect(result).toBe(BigInt('100000000'));
      expect(ethers.parseUnits).toHaveBeenCalledWith('100', 6);
    });

    it('should use contract decimals when not in known tokens', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.decimals.mockResolvedValue(8);
      (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockReturnValue(BigInt('10000000000')); // 100 tokens (8 decimals)

      const result = await TokenInfo.toWei('100', '0x1234567890123456789012345678901234567890');
      
      expect(result).toBe(BigInt('10000000000'));
      expect(ethers.parseUnits).toHaveBeenCalledWith('100', 8);
    });

    it('should throw error for invalid amount', async () => {
      (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockImplementation(() => {
        throw new Error('Invalid amount');
      });

      await expect(
        TokenInfo.toWei('invalid', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a')
      ).rejects.toThrow('Failed to convert amount');
    });
  });

  describe('fromWei', () => {
    it('should convert wei to readable amount with correct decimals', async () => {
      (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>).mockReturnValue('100.0');

      const result = await TokenInfo.fromWei(BigInt('100000000'), '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'); // USDC
      
      expect(result).toBe('100.0');
      expect(ethers.formatUnits).toHaveBeenCalledWith(BigInt('100000000'), 6);
    });

    it('should throw error for invalid conversion', async () => {
      (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>).mockImplementation(() => {
        throw new Error('Invalid conversion');
      });

      await expect(
        TokenInfo.fromWei(BigInt('100000000'), '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a')
      ).rejects.toThrow('Failed to convert wei amount');
    });
  });

  describe('formatAmount', () => {
    it('should format string amount with token symbol', async () => {
      const result = await TokenInfo.formatAmount('100', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result).toBe('100.00 USDC');
    });

    it('should format wei amount with token symbol', async () => {
      (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>).mockReturnValue('100.0');

      const result = await TokenInfo.formatAmount(BigInt('100000000'), '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a', true);
      
      expect(result).toBe('100.00 USDC');
    });

    it('should format small amounts with appropriate precision', async () => {
      const result = await TokenInfo.formatAmount('0.001', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result).toBe('0.0010 USDC');
    });

    it('should format very small amounts in exponential notation', async () => {
      const result = await TokenInfo.formatAmount('0.000001', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result).toBe('1.00e-6 USDC');
    });

    it('should format large amounts with locale formatting', async () => {
      const result = await TokenInfo.formatAmount('1234567.89', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result).toBe('1,234,567.89 USDC');
    });

    it('should format zero amount correctly', async () => {
      const result = await TokenInfo.formatAmount('0', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result).toBe('0 USDC');
    });
  });

  describe('validateAmountForToken', () => {
    it('should validate amount with correct decimal places', async () => {
      const result = await TokenInfo.validateAmountForToken('100.123456', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'); // USDC has 6 decimals
      
      expect(result.isValid).toBe(true);
    });

    it('should reject amount with too many decimal places', async () => {
      const result = await TokenInfo.validateAmountForToken('100.1234567', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a'); // USDC has 6 decimals
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Too many decimal places');
      expect(result.maxDecimals).toBe(6);
    });

    it('should validate amount that can be converted to wei', async () => {
      const result = await TokenInfo.validateAmountForToken('100', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result.isValid).toBe(true);
      expect(ethers.parseUnits).toHaveBeenCalledWith('100', 6);
    });

    it('should reject amount that cannot be converted', async () => {
      (ethers.parseUnits as MockedFunction<typeof ethers.parseUnits>).mockImplementation(() => {
        throw new Error('Invalid number');
      });

      const result = await TokenInfo.validateAmountForToken('invalid', '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid number');
    });
  });

  describe('utility functions', () => {
    it('should get token symbol', async () => {
      const symbol = await TokenInfo.getTokenSymbol('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a');
      expect(symbol).toBe('USDC');
    });

    it('should identify known tokens', () => {
      expect(TokenInfo.isKnownToken('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a')).toBe(true);
      expect(TokenInfo.isKnownToken('0x1234567890123456789012345678901234567890')).toBe(false);
    });

    it('should return all known tokens', () => {
      const tokens = TokenInfo.getKnownTokens();
      
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0]).toHaveProperty('symbol');
      expect(tokens[0]).toHaveProperty('name');
      expect(tokens[0]).toHaveProperty('decimals');
      expect(tokens[0]).toHaveProperty('address');
    });

    it('should add known token', () => {
      const newToken = {
        symbol: 'NEW',
        name: 'New Token',
        decimals: 12,
        address: '0xabcdef1234567890123456789012345678901234'
      };

      TokenInfo.addKnownToken(newToken);
      
      expect(TokenInfo.isKnownToken(newToken.address)).toBe(true);
      const metadata = TokenInfo.getKnownTokens().find(t => t.address.toLowerCase() === newToken.address.toLowerCase());
      expect(metadata).toEqual(newToken);
    });
  });

  describe('getBalance', () => {
    it('should get user balance and format correctly', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.balanceOf.mockResolvedValue(BigInt('100000000')); // 100 USDC (6 decimals)
      (ethers.formatUnits as MockedFunction<typeof ethers.formatUnits>).mockReturnValue('100.0');

      const balance = await TokenInfo.getBalance('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456');
      
      expect(balance).toBe('100.0');
      expect(mockContract.balanceOf).toHaveBeenCalledWith('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456');
      expect(ethers.formatUnits).toHaveBeenCalledWith(BigInt('100000000'), 6);
    });

    it('should throw error when provider not set', async () => {
      // Don't set provider
      await expect(
        TokenInfo.getBalance('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456')
      ).rejects.toThrow('Provider not set');
    });

    it('should throw error when balance call fails', async () => {
      TokenInfo.setProvider('http://test-rpc');
      mockContract.balanceOf.mockRejectedValue(new Error('Balance call failed'));

      await expect(
        TokenInfo.getBalance('0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456')
      ).rejects.toThrow('Failed to get balance');
    });
  });
});