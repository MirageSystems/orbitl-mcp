# Orbitl Testing Guide

## 🧪 **How to Test Everything We've Built**

This guide covers testing all implemented features in Orbitl v2.

## 🔧 **Prerequisites**

### 1. Environment Setup
```bash
# Ensure you have the .env file configured
cp .env.example .env

# Edit .env with your credentials:
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
DEFAULT_NETWORK=mainnet
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Build Project
```bash
pnpm build
```

## 📋 **Test Checklist**

### ✅ **Phase 1: Contract Analysis (Direct)**

#### Test 1: Help Command
```bash
pnpm dev --help
```
**Expected:** Clean help output showing options and commands

#### Test 2: Network Connection Check
```bash
pnpm dev check
```
**Expected:** Successfully connects to Sei mainnet, shows chain ID and latest block

```bash
pnpm dev check --network testnet  
```
**Expected:** Connects to Sei testnet (atlantic-2)

#### Test 3: Direct Contract Analysis
```bash
# Test with verified DEX contract (DragonSwap)
pnpm dev analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423

# Test with different network
pnpm dev analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423 --network testnet

# Test with detailed output
pnpm dev analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423 --detailed
```
**Expected:** 
- Shows contract type (DEX)
- Lists functions count
- Shows verification status  
- Displays function table
- Type-specific information

#### Test 4: Invalid Contract
```bash
pnpm dev analyze 0x1234567890123456789012345678901234567890
```
**Expected:** Graceful error handling with helpful message

### ✅ **Phase 2: AI Chat Interface**

#### Test 5: Basic AI Chat
```bash
pnpm dev
```

Once in chat, try these conversations:

**Test 5a: Simple Question**
```
> What is a smart contract?
```
**Expected:** AI explains smart contracts without using tools

**Test 5b: Contract Address Query (Auto-Tool Usage)**
```
> What is 0x882f62fe8e9594470d1da0f70bc85096f6c60423?
```
**Expected:** 
- Shows "🔧 Executing tool: analyze_contract"
- AI automatically calls analyze_contract tool
- Returns detailed analysis of the DEX contract

**Test 5c: Function Details**
```
> Tell me about the swap function in 0x882f62fe8e9594470d1da0f70bc85096f6c60423
```
**Expected:** AI uses get_function_details tool automatically

**Test 5d: Safety Check**  
```
> Is 0x882f62fe8e9594470d1da0f70bc85096f6c60423 safe to use?
```
**Expected:** AI uses check_safety tool, returns risk assessment

**Test 5e: Transaction Building**
```
> Build a swap transaction for 0x882f62fe8e9594470d1da0f70bc85096f6c60423
```
**Expected:** 
- AI uses build_transaction tool
- Returns unsigned transaction data
- Emphasizes "NEVER sign with private keys"
- Shows wallet connection instructions

**Test 5f: Gas Estimation**
```
> How much gas would a swap cost?
```
**Expected:** AI uses estimate_gas tool

#### Test 6: Chat Commands
```
> help
```
**Expected:** Shows chat help with examples

```
> clear  
```
**Expected:** Clears conversation history

```
> exit
```
**Expected:** Gracefully exits chat

### ✅ **Phase 2: Network Switching**

#### Test 7: Testnet Analysis
```bash
pnpm dev --network testnet
```
Then test:
```
> What contracts are popular on testnet?
```
**Expected:** AI knows it's on testnet network

### ✅ **Advanced Features**

#### Test 8: Multiple Contracts in One Message
```
> Compare 0x882f62fe8e9594470d1da0f70bc85096f6c60423 with 0x1234567890123456789012345678901234567890
```
**Expected:** AI analyzes both contracts (one valid, one invalid)

#### Test 9: Conversation History
```
> What was the last contract we analyzed?
```
**Expected:** AI remembers previous conversation context

#### Test 10: Edge Cases
```
> 0xinvalidaddress
```
**Expected:** AI handles invalid addresses gracefully

```
> Build a transaction with no parameters
```
**Expected:** AI asks for required information

### ✅ **File Structure Verification**

#### Test 11: Check Reorganized Structure
```bash
tree src/
```
**Expected:**
```
src/
├── analysis/        # Contract analysis
├── intelligence/    # AI functionality  
├── interface/       # User interfaces
├── network/         # Blockchain connectivity
└── cli.ts          # CLI entry point
```

#### Test 12: Import Paths
```bash
pnpm build
```
**Expected:** No TypeScript errors, clean build

## 🎯 **Demo Test Scenarios**

### Scenario 1: New User Experience (30 seconds)
```bash
# 1. Start Orbitl
pnpm dev

# 2. Ask about a contract
> What can I do with 0x882f62fe8e9594470d1da0f70bc85096f6c60423?

# 3. Check safety
> Is this contract safe?

# 4. Build transaction
> Help me swap tokens

# 5. Exit
> exit
```

### Scenario 2: Safety Demo (Scam Protection)
```bash
pnpm dev
> Check 0x1234567890123456789012345678901234567890
```
**Expected:** AI warns about invalid/unverified contract

### Scenario 3: Expert Analysis
```bash
pnpm dev --verbose
> Analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423 in detail
```
**Expected:** Detailed technical analysis with all function details

## 🐛 **Troubleshooting**

### Common Issues:

**❌ "AI request failed"**
- Check Cloudflare credentials in .env
- Verify account has Workers AI enabled
- Check internet connection

**❌ "Network connection failed"** 
- Sei RPC might be down, try testnet
- Check firewall/proxy settings

**❌ "Contract analysis failed"**
- Contract might not exist on that network
- Seitrace API might be rate limiting

**❌ "Module not found"**
- Run `pnpm build` after changes
- Check import paths are correct

## ✅ **Success Criteria**

If all tests pass, you should have:

✅ **Working contract analysis** on mainnet/testnet  
✅ **AI chat with automatic tool usage**  
✅ **Transaction building (unsigned only)**  
✅ **Safety warnings and risk assessment**  
✅ **Clean error handling**  
✅ **Natural conversation flow**  
✅ **Security-first messaging**  

## 🚀 **Performance Expectations**

- **Contract analysis:** 2-5 seconds
- **AI responses:** 5-15 seconds (Cloudflare AI can be slow)
- **Tool execution:** 1-3 seconds each
- **Network checks:** 1-2 seconds

## 📊 **What Each Component Does**

### `src/analysis/`
- **reader.ts:** Fetches and analyzes contract ABIs
- **types.ts:** TypeScript definitions for contracts

### `src/intelligence/`  
- **client.ts:** Cloudflare AI integration with native tools
- **executor.ts:** Executes tools called by AI
- **tools.ts:** Tool definitions for AI function calling

### `src/interface/`
- **chat.ts:** Interactive chat interface

### `src/network/`
- **sei.ts:** Sei blockchain connection and API calls

### `src/cli.ts`
- Main entry point, command parsing, help system

## 🏆 **Ready for Demo**

After successful testing, you're ready to:
1. **Demo to judges** - 30-second impressive demos
2. **Add Phase 3 features** - More transaction tools
3. **Deploy** - Package for distribution
4. **Submit to hackathon** - With confidence it works!

---

**Test everything systematically and you'll have a rock-solid hackathon submission! 🎉**