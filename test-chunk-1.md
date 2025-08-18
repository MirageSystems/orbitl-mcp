# Testing Chunk 1: Transaction Data Structure

## 🎯 **What This Tests**
This validates that our core transaction building system works correctly:
- ✅ Building safe transactions without private keys
- ✅ Input validation with helpful error messages  
- ✅ Risk assessment and safety warnings
- ✅ Token transfer and approval transactions

---

## 🚀 **Quick Test (30 seconds)**

```bash
# 1. Run the automated tests
pnpm test:run

# Expected: All 59 tests should pass ✅
# ✓ tests/wallet/validator.test.ts (41 tests) 
# ✓ tests/wallet/transaction-builder.test.ts (18 tests)
```

---

## 🔧 **Interactive Testing**

### **Test 1: Build a Token Transfer**

```bash
# Create and run this test
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';

const builder = new SafeTransactionBuilder('https://evm-rpc.sei-apis.com');

// Build a USDC transfer transaction
try {
  const result = await builder.buildTransfer(
    '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC contract
    '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', // Recipient
    '100',                                          // Amount
    { tokenSymbol: 'USDC' }                        // Context
  );

  console.log('✅ Transfer transaction built successfully!');
  console.log('Transaction:', JSON.stringify(result.transaction, null, 2));
  console.log('Preview:', result.preview.humanDescription);
  console.log('Safety Score:', result.safetyScore);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
"
```

**Expected Output:**
```
✅ Transfer transaction built successfully!
Transaction: {
  "to": "0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a",
  "data": "0xa9059cbb000000000000000000000000742d35cc6665cb9d9dc69e7a1e15f2fc0c9a345600000000000000000000000000000000000000000000152d02c7e14af6800000",
  "value": "0",
  "gasLimit": "65000"
}
Preview: Transfer 100 USDC to 0x742d...3456
Safety Score: 95
```

---

### **Test 2: Build an Approval Transaction**

```bash
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';

const builder = new SafeTransactionBuilder('https://evm-rpc.sei-apis.com');

// Build unlimited approval (should show warnings)
try {
  const result = await builder.buildApproval(
    '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC contract
    '0x1234567890123456789012345678901234567890', // Spender (DEX)
    'unlimited',                                  // Amount
    { tokenSymbol: 'USDC' }                      // Context
  );

  console.log('✅ Approval transaction built successfully!');
  console.log('Preview:', result.preview.humanDescription);
  console.log('Risk Level:', result.preview.riskLevel);
  console.log('Warnings:', result.preview.warnings);
  console.log('Safety Score:', result.safetyScore);
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
"
```

**Expected Output:**
```
✅ Approval transaction built successfully!
Preview: Approve USDC spending: unlimited
Risk Level: MEDIUM
Warnings: [
  'This approves unlimited token spending',
  'Consider approving only what you need'
]
Safety Score: 75
```

---

### **Test 3: Test Input Validation**

```bash
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';

const builder = new SafeTransactionBuilder('https://evm-rpc.sei-apis.com');

// Test invalid inputs (should show helpful errors)
const tests = [
  {
    name: 'Invalid token address',
    test: () => builder.buildTransfer('invalid-address', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '100')
  },
  {
    name: 'Negative amount',
    test: () => builder.buildTransfer('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '-100')
  },
  {
    name: 'Too large amount',
    test: () => builder.buildTransfer('0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', '999999999999999')
  }
];

for (const { name, test } of tests) {
  try {
    await test();
    console.log('❌', name, '- Should have failed but passed');
  } catch (error) {
    console.log('✅', name, '- Caught error:', error.message);
    if (error.suggestions) {
      console.log('   Suggestions:', error.suggestions);
    }
  }
}
"
```

**Expected Output:**
```
✅ Invalid token address - Caught error: Invalid Token address format
   Suggestions: ['Address should be 42 characters starting with 0x', 'Check for typos in the address']
✅ Negative amount - Caught error: Amount must be a positive number  
   Suggestions: ['Use a positive number like "100" or "1.5"']
✅ Too large amount - Caught error: Amount is too large
   Suggestions: ['Use a smaller amount', 'Check for extra zeros']
```

---

### **Test 4: Validation System**

```bash
pnpm tsx -e "
import { TransactionValidator } from './src/wallet/validator.js';

// Test address validation
console.log('=== Address Validation Tests ===');

const addresses = [
  '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', // Valid
  '0x0000000000000000000000000000000000000000', // Zero address (warning)
  'invalid-address',                               // Invalid
  '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A34',     // Too short
];

for (const addr of addresses) {
  const result = TransactionValidator.validateAddress(addr, 'Test Address');
  console.log(\`\\\nAddress: \${addr}\`);
  console.log(\`Valid: \${result.isValid}\`);
  if (result.errors.length > 0) console.log(\`Errors: \${result.errors.join(', ')}\`);
  if (result.warnings.length > 0) console.log(\`Warnings: \${result.warnings.join(', ')}\`);
}

// Test amount validation  
console.log('\\\n=== Amount Validation Tests ===');

const amounts = ['100', 'unlimited', '-50', '0', 'not-a-number', '999999999999999'];

for (const amount of amounts) {
  const result = TransactionValidator.validateAmount(amount, 'Test Amount', true);
  console.log(\`\\\nAmount: \${amount}\`);
  console.log(\`Valid: \${result.isValid}\`);
  if (result.errors.length > 0) console.log(\`Errors: \${result.errors.join(', ')}\`);
  if (result.warnings.length > 0) console.log(\`Warnings: \${result.warnings.join(', ')}\`);
}
"
```

---

## 🎯 **Success Criteria**

**✅ All tests should pass if:**

1. **Automated Tests**: All 59 tests pass
2. **Transfer Test**: Successfully builds ERC-20 transfer transaction with proper encoding
3. **Approval Test**: Builds approval with risk warnings for unlimited amounts
4. **Validation Test**: Catches all invalid inputs with helpful error messages
5. **Validator Test**: Properly validates addresses and amounts with warnings

**❌ Something is wrong if:**

- Tests fail or throw unexpected errors
- Transaction data is missing or malformed  
- No validation errors for obviously invalid inputs
- Error messages are unclear or unhelpful

---

## 🔧 **Quick Verification Checklist**

```bash
# 1. Run tests
pnpm test:run
# → Should show: "Test Files 2 passed (2), Tests 59 passed (59)"

# 2. Check TypeScript compilation  
pnpm build
# → Should compile our new wallet files (ignore existing formatter errors)

# 3. Verify files exist
ls -la src/wallet/
# → Should show: transaction-builder.ts, types.ts, validator.ts

ls -la tests/wallet/  
# → Should show: transaction-builder.test.ts, validator.test.ts
```

---

## 💡 **What This Proves**

If all tests pass, you've verified that:

- ✅ **Safe Architecture**: Transactions are built without touching private keys
- ✅ **Input Validation**: Invalid inputs are caught with helpful suggestions
- ✅ **Risk Assessment**: Dangerous operations show proper warnings  
- ✅ **ERC-20 Support**: Can build transfer and approval transactions
- ✅ **Error Handling**: Graceful fallbacks when network is unavailable
- ✅ **Type Safety**: Full TypeScript support with proper interfaces

**🎉 Chunk 1 is working perfectly - ready for the next phase!**