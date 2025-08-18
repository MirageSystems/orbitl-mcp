# Chunk 2: Function Encoding Engine

## 🎯 **Goal**: Convert function calls into executable transaction data

**Timeline**: 2-3 days  
**Risk**: Medium  
**Dependencies**: Chunk 1 completed

---

## 📋 **Tasks**

### **2.1: Set up ethers.js Integration** (1 hour)
```bash
# Add ethers.js if not already present
pnpm add ethers@6
pnpm add -D @types/ethers
```

Create `src/wallet/abi-manager.ts`:
```typescript
export class ABIManager {
  /**
   * Get ABI for common contracts (ERC-20, ERC-721, etc.)
   */
  static getERC20ABI(): any[]
  static getContractABI(address: string): Promise<any[]>
  
  /**
   * Create ethers Interface from ABI
   */
  static createInterface(abi: any[]): ethers.Interface
}
```

### **2.2: Implement Function Encoding** (3-4 hours)
Update `src/wallet/transaction-builder.ts`:

```typescript
import { ethers } from 'ethers';
import { ABIManager } from './abi-manager.js';

export class SafeTransactionBuilder {
  
  async buildTransfer(
    tokenAddress: string,
    to: string, 
    amount: string
  ): Promise<SafeTransactionData> {
    
    // 1. Validate inputs
    TransactionValidator.validateAddress(tokenAddress);
    TransactionValidator.validateAddress(to);
    TransactionValidator.validateAmount(amount);
    
    // 2. Get ERC-20 ABI and create interface
    const abi = ABIManager.getERC20ABI();
    const iface = ABIManager.createInterface(abi);
    
    // 3. Convert amount to wei (assuming 18 decimals for now)
    const amountWei = ethers.parseUnits(amount, 18);
    
    // 4. Encode function call
    const data = iface.encodeFunctionData('transfer', [to, amountWei]);
    
    // 5. Build transaction data
    const transaction: TransactionData = {
      to: tokenAddress,
      data,
      value: '0', // ERC-20 transfers don't send ETH
      gasLimit: '65000' // Static estimate for now
    };
    
    // 6. Generate preview
    const preview: TransactionPreview = {
      humanDescription: `Transfer ${amount} tokens to ${to}`,
      contractName: 'ERC-20 Token',
      riskLevel: 'LOW',
      warnings: [],
      estimatedCost: '$0.50 in gas'
    };
    
    return {
      transaction,
      preview,
      safetyScore: 90 // High score for basic transfers
    };
  }
}
```

### **2.3: Add ERC-20 Standard Functions** (2 hours)

Implement core ERC-20 functions:
- `buildTransfer(token, to, amount)`
- `buildApproval(token, spender, amount)` 
- `buildTransferFrom(token, from, to, amount)`

```typescript
async buildApproval(
  tokenAddress: string,
  spender: string,
  amount: string
): Promise<SafeTransactionData> {
  // Encode approve(spender, amount)
  const data = iface.encodeFunctionData('approve', [spender, amountWei]);
  
  const preview: TransactionPreview = {
    humanDescription: `Approve ${spender} to spend ${amount} tokens`,
    contractName: 'ERC-20 Token',
    riskLevel: 'MEDIUM', // Approvals are riskier
    warnings: amount === 'unlimited' ? 
      ['WARNING: Unlimited approval - spender can take all tokens'] : [],
    estimatedCost: '$0.45 in gas'
  };
  
  // Return transaction data...
}
```

### **2.4: Add Decimal Handling** (2 hours)

Create `src/wallet/token-info.ts`:
```typescript
export class TokenInfo {
  /**
   * Get token decimals (18 for most tokens, 6 for USDC, etc.)
   */
  static async getDecimals(tokenAddress: string): Promise<number>
  
  /**
   * Convert human amount to wei using correct decimals
   */
  static async toWei(amount: string, tokenAddress: string): Promise<bigint>
  
  /**
   * Convert wei to human readable using correct decimals  
   */
  static async fromWei(amountWei: bigint, tokenAddress: string): Promise<string>
}
```

### **2.5: Error Handling & Edge Cases** (1-2 hours)

Handle common errors:
- Invalid ABI
- Encoding failures
- Invalid function names
- Parameter type mismatches

```typescript
try {
  const data = iface.encodeFunctionData(functionName, params);
} catch (error) {
  throw new TransactionBuildError(
    `Failed to encode ${functionName}: ${error.message}`
  );
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('Function Encoding', () => {
  it('encodes ERC-20 transfer correctly', async () => {
    const builder = new SafeTransactionBuilder();
    const result = await builder.buildTransfer(
      '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // Mock USDC
      '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', // Recipient
      '100'
    );
    
    // Verify transaction data structure
    expect(result.transaction.to).toBe('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a');
    expect(result.transaction.data).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(result.transaction.value).toBe('0');
    
    // Verify preview is meaningful
    expect(result.preview.humanDescription).toContain('100');
    expect(result.preview.humanDescription).toContain('Transfer');
  });
  
  it('handles different token decimals', async () => {
    // Test with USDC (6 decimals)
    const result = await builder.buildTransfer(
      '0xUSDCAddress',
      '0xRecipient', 
      '100'
    );
    
    // Should encode 100 * 10^6, not 100 * 10^18
    const expectedAmount = ethers.parseUnits('100', 6);
    // Verify the encoded data contains the correct amount
  });
});
```

### **Integration Tests**
```typescript
describe('Transaction Building Integration', () => {
  it('builds complete transaction data that could be signed', async () => {
    const builder = new SafeTransactionBuilder();
    const result = await builder.buildTransfer(
      '0xRealTokenAddress',
      '0xRealRecipient',
      '100'
    );
    
    // Transaction should be valid for wallet signing
    expect(result.transaction).toMatchObject({
      to: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
      data: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
      value: expect.any(String),
      gasLimit: expect.any(String)
    });
  });
});
```

### **Manual Testing**
```bash
# Test encoding with real data
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';

const builder = new SafeTransactionBuilder();

// Test transfer
const transfer = await builder.buildTransfer(
  '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC
  '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
  '100'
);

console.log('Transfer Transaction:');
console.log(JSON.stringify(transfer, null, 2));

// Test approval
const approval = await builder.buildApproval(
  '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC  
  '0x1234567890123456789012345678901234567890', // DEX router
  '1000'
);

console.log('Approval Transaction:');
console.log(JSON.stringify(approval, null, 2));
"
```

---

## ✅ **Acceptance Criteria**

- [ ] ethers.js properly integrated
- [ ] ERC-20 transfer transactions encode correctly
- [ ] ERC-20 approval transactions encode correctly  
- [ ] Correct decimal handling (6 for USDC, 18 for others)
- [ ] Transaction data is valid for wallet signing
- [ ] Error handling for encoding failures
- [ ] All tests pass
- [ ] Manual testing shows correct encoded data

---

## 🔍 **Key Validation Points**

### **Critical**
- **Encoded data is valid**: Can be decoded back to original params
- **Decimal handling**: 100 USDC = 100000000 (not 100000000000000000000)
- **Gas estimates**: Reasonable estimates for each function type
- **Error messages**: Clear when encoding fails

### **Security**
- **Input sanitization**: Prevent injection attacks
- **Parameter validation**: Reject invalid addresses/amounts
- **ABI safety**: Only use trusted ABI sources

---

## 🔧 **Debugging Tools**

Create helper for testing encoding:
```typescript
// src/wallet/debug.ts
export class TransactionDebugger {
  static decodeTransaction(data: string, abi: any[]): any {
    const iface = new ethers.Interface(abi);
    return iface.parseTransaction({ data });
  }
  
  static validateEncoding(
    functionName: string, 
    params: any[], 
    encodedData: string, 
    abi: any[]
  ): boolean {
    // Encode -> Decode -> Compare
  }
}
```

---

## 🚀 **Deliverables**

1. `src/wallet/abi-manager.ts` - ABI management
2. Updated `src/wallet/transaction-builder.ts` - Function encoding
3. `src/wallet/token-info.ts` - Decimal handling
4. `src/wallet/debug.ts` - Debugging utilities
5. Comprehensive tests for all encoding functions
6. Manual validation that encoded transactions work

---

## 🔄 **Next Chunk**

Once this is working, **Chunk 3: Gas Estimation** will add accurate gas cost prediction to make our transaction previews even better.

**Ready to encode some functions safely? Let's build transactions users can trust! 🔐**