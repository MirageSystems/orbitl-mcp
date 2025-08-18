# 🧪 ORBITL TESTING PLAN
> Systematic testing approach for all features

---

## 📋 **PHASE 1: MANUAL TESTING (No AI)**
*Direct function calls to test core components*

### **1.1 INDIVIDUAL COMPONENT TESTS**
*Test each component in isolation*

#### **A. Token Information**
```bash
# Test 1: Token lookup by symbol
lookup_token USDC
lookup_token WSEI
lookup_token INVALID

# Expected: Address retrieval, metadata, decimals
```

#### **B. Transaction Simulation**
```bash
# Test 2: Basic transfer simulation
simulate_transaction transfer USDC 100 from:0x123... to:0x456...

# Test 3: Large amount warning
simulate_transaction transfer USDC 600 from:0x123... to:0x456...

# Test 4: Burn address detection
simulate_transaction transfer USDC 100 from:0x123... to:0x000...

# Test 5: Insufficient balance
simulate_transaction transfer USDC 2000 from:0x123... to:0x456...
```

#### **C. Approval Simulation**
```bash
# Test 6: Normal approval
simulate_transaction approve USDC 500 spender:0xDEX...

# Test 7: Unlimited approval warning
simulate_transaction approve USDC unlimited spender:0xDEX...

# Test 8: Zero address approval
simulate_transaction approve USDC 100 spender:0x000...
```

#### **D. Gas Estimation**
```bash
# Test 9: Transfer gas estimate
estimate_gas transfer USDC

# Test 10: Approval gas estimate  
estimate_gas approve USDC

# Test 11: Complex transaction gas
estimate_gas swap USDC->WSEI
```

#### **E. Transaction Building**
```bash
# Test 12: Build transfer transaction
build_transfer USDC 100 to:0x456...

# Test 13: Build approval transaction
build_approval USDC 500 spender:0xDEX...

# Test 14: Build transferFrom transaction
build_transferFrom USDC 100 from:0x123... to:0x456...
```

#### **F. Validation**
```bash
# Test 15: Valid address
validate_address 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456

# Test 16: Invalid address (wrong length)
validate_address 0x123

# Test 17: Invalid address (bad characters)
validate_address 0xGGGG...

# Test 18: Zero address warning
validate_address 0x0000000000000000000000000000000000000000
```

#### **G. WalletConnect**
```bash
# Test 19: Generate QR code
connect_wallet

# Test 20: Check connection status
check_wallet_connection

# Test 21: Disconnect wallet
disconnect_wallet
```

### **1.2 TRANSACTION LIFECYCLE TESTS**
*Complete end-to-end flows*

#### **Lifecycle 1: Safe Token Transfer**
```
1. lookup_token USDC                    → Get token address
2. validate_address [recipient]         → Validate recipient
3. simulate_transaction transfer        → Check what will happen
4. build_transfer                       → Create transaction
5. estimate_gas                         → Get gas costs
6. connect_wallet                       → Show QR code
7. execute_transaction                  → Send for signing
8. check_status                         → Verify completion
```

#### **Lifecycle 2: Token Approval + DEX Swap**
```
1. lookup_token USDC                    → Get USDC address
2. lookup_token WSEI                    → Get WSEI address
3. simulate_transaction approve         → Check approval risks
4. build_approval                       → Create approval tx
5. execute_transaction                  → Sign approval
6. simulate_swap USDC->WSEI            → Check swap outcome
7. build_swap                          → Create swap tx
8. execute_transaction                  → Sign swap
```

#### **Lifecycle 3: Dangerous Transaction (Should Fail)**
```
1. lookup_token USDC                    → Get token address
2. simulate_transaction transfer to:0x0 → CRITICAL risk warning
3. build_transfer to:0x0               → Should warn severely
4. User should CANCEL                  → Transaction prevented
```

#### **Lifecycle 4: Batch Operations**
```
1. lookup_token USDC                    → Get token address
2. build_transfer [multiple]           → Create batch
3. simulate_batch                      → Check all outcomes
4. estimate_gas_batch                  → Total gas cost
5. execute_batch                       → Sign all at once
```

---

## 📋 **PHASE 2: AI-INTEGRATED TESTING**
*Natural language commands through AI*

### **2.1 BASIC AI COMMANDS**

#### **A. Simple Requests**
```
User: "What's the USDC contract address?"
Expected: AI calls lookup_token tool

User: "Show me USDC token info"
Expected: AI calls lookup_token + formats response

User: "Is 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456 a valid address?"
Expected: AI validates and confirms
```

#### **B. Transaction Requests**
```
User: "I want to send 100 USDC to 0x456..."
Expected: AI sequence:
  1. lookup_token(USDC)
  2. build_token_transfer()
  3. simulate_transaction()
  4. Shows preview

User: "Transfer 100 USDC to alice.eth"
Expected: AI handles ENS + builds transaction

User: "Send all my USDC to 0x456..."
Expected: AI warns about sending entire balance
```

#### **C. Safety Checks**
```
User: "Send 100 USDC to 0x0000000000000000000000000000000000000000"
Expected: AI detects burn address, shows CRITICAL warning

User: "Approve unlimited USDC for 0xDEX..."
Expected: AI warns about unlimited approval risks

User: "Send 5000 USDC to my friend"
Expected: AI detects insufficient balance (if applicable)
```

### **2.2 COMPLEX AI WORKFLOWS**

#### **Workflow 1: Complete Transfer with Simulation**
```
User: "I want to safely send 100 USDC to Bob, but show me what will happen first"

Expected AI sequence:
1. lookup_token(USDC) → Get address
2. Ask for Bob's address (if not provided)
3. simulate_transaction() → Show balance changes
4. Display risk assessment
5. Ask for confirmation
6. build_token_transfer() → Create transaction
7. connect_wallet() → Show QR
8. execute_transaction() → Complete
```

#### **Workflow 2: Multi-Step DeFi Operation**
```
User: "I want to swap 100 USDC for WSEI on the DEX"

Expected AI sequence:
1. lookup_token(USDC)
2. lookup_token(WSEI)
3. Check current allowance
4. If needed: build_token_approval()
5. simulate_transaction(approve)
6. execute approval
7. Build swap transaction
8. simulate_transaction(swap)
9. execute swap
```

#### **Workflow 3: Batch Operations**
```
User: "Send 50 USDC each to Alice, Bob, and Charlie"

Expected AI sequence:
1. lookup_token(USDC)
2. Validate all addresses
3. Check total balance (150 USDC needed)
4. Build 3 transfer transactions
5. simulate_transaction() for each
6. Show total gas cost
7. Execute as batch
```

### **2.3 ERROR HANDLING TESTS**

#### **A. Ambiguous Requests**
```
User: "Send some tokens"
Expected: AI asks which token and how much

User: "Transfer to Bob"
Expected: AI asks what to transfer and Bob's address

User: "Send 100"
Expected: AI asks which token (100 what?)
```

#### **B. Invalid Requests**
```
User: "Send -100 USDC"
Expected: AI rejects negative amount

User: "Send USDC to invalid_address"
Expected: AI detects invalid address format

User: "Send 0.0000000001 USDC"
Expected: AI warns about dust amount
```

#### **C. Risk Detection**
```
User: "Send everything to 0x000..."
Expected: AI prevents total loss

User: "Approve this sketchy contract"
Expected: AI warns about unverified contracts

User: "Execute this raw transaction data: 0x..."
Expected: AI refuses unsafe operations
```

---

## ✅ **SUCCESS CRITERIA**

### **Phase 1 Success:**
- [ ] All individual components work independently
- [ ] All validations catch dangerous operations
- [ ] Transaction lifecycle completes end-to-end
- [ ] Gas estimation returns reasonable values
- [ ] WalletConnect QR generation works

### **Phase 2 Success:**
- [ ] AI understands natural language requests
- [ ] AI calls correct sequence of tools
- [ ] AI prevents dangerous operations
- [ ] AI handles ambiguous requests gracefully
- [ ] Complete workflows execute successfully

---

## 🐛 **KNOWN ISSUES TO TRACK**

| Issue | Component | Status | Priority |
|-------|-----------|---------|----------|
| Gas cost formatting | GasEstimator | 🔴 Found | HIGH |
| Address validation | Validator | 🟡 Partial | MEDIUM |
| Network connection | Provider | ❓ Unknown | LOW |

---

## 📊 **TEST EXECUTION LOG**

### **Session 1: [Date/Time]**
```
Test #1: ✅ Passed
Test #2: ❌ Failed - [reason]
Test #3: ⏭️ Skipped
...
```

### **Session 2: [Date/Time]**
```
...
```

---

## 🚀 **QUICK TEST COMMANDS**

```bash
# Start the CLI
pnpm dev

# Quick smoke test (Phase 1)
> simulate_transaction transfer USDC 100 from:0x123... to:0x456...

# Quick AI test (Phase 2)  
> Send 100 USDC to 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456

# Full lifecycle test
> [Follow Lifecycle 1 steps]
```

---

## 📝 **NOTES**

- Always test dangerous operations (burn address, unlimited approvals)
- Verify all warnings are shown prominently
- Check that "We Never Touch Your Keys" is maintained
- Ensure transaction simulation shows accurate balance changes
- Confirm gas estimates are reasonable for Sei Network

---

*Last Updated: [Current Date]*
*Version: 1.0*