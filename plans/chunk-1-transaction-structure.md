# Chunk 1: Transaction Data Structure

## 🎯 **Goal**: Create the foundation for safe transaction building

**Timeline**: 1-2 days  
**Risk**: Low  
**Dependencies**: None

---

## 📋 **Tasks**

### **1.1: Define Core Types** (30 minutes)
Create `src/wallet/types.ts`:
```typescript
interface TransactionData {
  to: string;           // Contract address
  data: string;         // Encoded function call
  value: string;        // ETH/SEI value (usually "0")
  gasLimit?: string;    // Estimated gas limit
  gasPrice?: string;    // Gas price
}

interface TransactionPreview {
  humanDescription: string;    // "Swap 100 USDC for SEI"
  contractName: string;        // "DragonSwap Router"
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];          // ["High slippage detected"]
  estimatedCost: string;       // "$0.50 in gas"
}

interface SafeTransactionData {
  transaction: TransactionData;
  preview: TransactionPreview;
  safetyScore: number;         // 0-100
}
```

### **1.2: Create Transaction Builder Class** (1 hour)
Create `src/wallet/transaction-builder.ts`:
```typescript
export class SafeTransactionBuilder {
  
  /**
   * Build a basic ERC-20 transfer transaction
   * @param tokenAddress - ERC-20 token contract
   * @param to - Recipient address
   * @param amount - Amount in token units (not wei)
   */
  async buildTransfer(
    tokenAddress: string,
    to: string, 
    amount: string
  ): Promise<SafeTransactionData> {
    // Implementation here
  }

  /**
   * Build an ERC-20 approval transaction
   */
  async buildApproval(
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<SafeTransactionData> {
    // Implementation here
  }
}
```

### **1.3: Add Input Validation** (1 hour)
Create `src/wallet/validation.ts`:
```typescript
export class TransactionValidator {
  static validateAddress(address: string): boolean
  static validateAmount(amount: string): boolean  
  static validateTokenAddress(address: string): boolean
  static sanitizeInput(input: string): string
}
```

### **1.4: Create Basic Implementation** (2-3 hours)
Implement basic transfer function:
- Validate inputs
- Create mock transaction data
- Generate human-readable preview
- Return SafeTransactionData

### **1.5: Write Tests** (1 hour)
Create `tests/wallet/transaction-builder.test.ts`:
- Test input validation
- Test transaction data structure
- Test preview generation
- Test error cases

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('SafeTransactionBuilder', () => {
  it('builds valid transfer transaction data', async () => {
    const builder = new SafeTransactionBuilder();
    const result = await builder.buildTransfer(
      '0xUSDCAddress',
      '0xRecipient', 
      '100'
    );
    
    expect(result.transaction.to).toBe('0xUSDCAddress');
    expect(result.preview.humanDescription).toContain('100');
  });
});
```

### **Manual Testing**
```bash
# Test the builder directly
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';
const builder = new SafeTransactionBuilder();
const result = await builder.buildTransfer('0x123', '0x456', '100');
console.log(JSON.stringify(result, null, 2));
"
```

---

## ✅ **Acceptance Criteria**

- [ ] TypeScript interfaces defined and exported
- [ ] SafeTransactionBuilder class created
- [ ] Input validation works correctly
- [ ] Can build basic transfer transaction data
- [ ] Transaction preview is human-readable
- [ ] All tests pass
- [ ] No private key handling anywhere in code

---

## 🔍 **What to Focus On**

### **Critical**
- **Type Safety**: All interfaces properly typed
- **Validation**: Reject invalid inputs immediately  
- **Preview Quality**: Descriptions must be clear

### **Nice to Have**
- Error messages are helpful
- Code is well-documented
- Performance is reasonable

---

## 🚀 **Deliverables**

1. `src/wallet/types.ts` - Core type definitions
2. `src/wallet/transaction-builder.ts` - Main builder class
3. `src/wallet/validation.ts` - Input validation
4. `tests/wallet/transaction-builder.test.ts` - Tests
5. Working example that builds a transfer transaction

---

## 🔄 **Next Chunk**

Once this is complete and tested, we move to **Chunk 2: Function Encoding** where we'll implement actual ethers.js encoding to make the transaction data executable.

**Ready to start building the foundation? Let's make sure every transaction is built safely! 🛡️**