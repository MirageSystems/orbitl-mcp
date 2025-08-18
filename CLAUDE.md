# CLAUDE.md - Orbitl Engineering Specification

## 🎯 Project Overview

**Project Name:** Orbitl  
**Type:** CLI Tool with Native AI Function Calling  
**Hackathon:** Sei Network AI/Accelathon - MCPU Bonus Bounty ($15K)  
**Timeline:** 10 days (Due: August 25, 2025)  
**Primary Goal:** Win the hackathon by building a natural language interface for smart contract interaction

## 🔐 **CRITICAL: "WE NEVER TOUCH YOUR KEYS" ARCHITECTURE**

### 🏆 **Our Killer Differentiator**
**"We NEVER Touch Your Keys"** - This is our winning edge. While other tools compromise security by asking for private keys, Orbitl keeps users safe by NEVER handling private key material.

### 🛡️ **Security-First Principles**

#### **NEVER**:
- ❌ Ask for private keys
- ❌ Request seed phrases  
- ❌ Store wallet credentials
- ❌ Handle mnemonic phrases
- ❌ Access wallet files
- ❌ Sign transactions directly

#### **ALWAYS**:
- ✅ Generate transaction data only
- ✅ Let users sign with their own wallets
- ✅ Support hardware wallets (Ledger/Trezor)
- ✅ Use WalletConnect for safe connections
- ✅ Provide clear transaction previews
- ✅ Enable simulation before execution
- ✅ Show gas estimates and safety warnings

## 🚦 Development Rules

### CRITICAL: Collaboration Protocol

1. **ALWAYS DISCUSS BEFORE IMPLEMENTING**
   - Present your implementation plan
   - Wait for approval/feedback
   - Never auto-generate files without confirmation
   - Ask questions when uncertain

2. **Iterative Development**
   - Build MVP first
   - Add features incrementally
   - Test each component before moving forward
   - Keep me updated on progress

3. **Code Quality Standards**
   - Clean, readable code > clever code
   - Comment complex logic
   - Use TypeScript for type safety
   - Follow conventional commits

## 📋 Core Requirements

### Must Have (MVP - Complete ✅)
1. **Contract Analysis**
   - ✅ Fetch and decode contract ABI
   - ✅ Identify contract type (DEX, Token, Farm, NFT)
   - ✅ Translate functions to human language
   - ✅ Safety and risk assessment

2. **AI-Powered Natural Language**
   - ✅ Cloudflare AI with native function calling
   - ✅ Automatic tool usage when contracts mentioned
   - ✅ Chat interface with conversation history
   - ✅ Intelligent responses with contract context

3. **Safety Scanner**
   - ✅ Check contract verification status
   - ✅ Identify dangerous functions
   - ✅ Risk assessment and safety scores
   - ✅ Warning system for suspicious contracts

### Should Have (Enhancement - Days 6-8)
1. Transaction simulation before execution
2. Batch operations support
3. Hardware wallet integration
4. Demo mode with famous contracts

## 🏗️ **Current Simplified Architecture (Complete ✅)**

### **Revolutionary Change: No MCP - Direct AI Function Calling**

```
src/
├── analysis/          # Contract analysis
│   ├── reader.ts      # Contract analysis logic
│   └── types.ts       # Contract type definitions
├── intelligence/      # AI functionality
│   ├── client.ts      # Cloudflare AI with native tools
│   ├── executor.ts    # Tool execution logic
│   └── tools.ts       # AI tool definitions
├── interface/         # User interfaces
│   └── chat.ts        # Interactive chat interface
├── network/           # Blockchain connectivity
│   └── sei.ts         # Sei network provider
└── cli.ts            # Top-level CLI entry point
```

### **The New Flow (Ultra-Simple)**
```
User Input → Cloudflare AI (with native tools) → AI calls tools → Response
```

### Tech Stack (Simplified)
```json
{
  "core": {
    "language": "TypeScript",
    "runtime": "Node.js 20+",
    "package-manager": "pnpm"
  },
  "dependencies": {
    "cli": ["commander", "chalk", "ora", "cli-table3"],
    "blockchain": ["ethers@6"],
    "ai": ["Cloudflare Workers AI (native)"],
    "utilities": ["dotenv"]
  },
  "removed": {
    "mcp": "❌ Removed - Too complex",
    "preprocessing": "❌ Removed - AI handles everything",
    "caching": "❌ Removed - Premature optimization"
  }
}
```

## 🔧 Implementation Status

### ✅ Phase 1: Foundation (COMPLETE)
- **Contract Analysis**: Full ABI fetching and analysis
- **Network Integration**: Sei mainnet/testnet support
- **Type Detection**: Token/DEX/Farm/NFT classification

### ✅ Phase 2: AI Revolution (COMPLETE)  
- **Native AI Tools**: 5 powerful tools for contract interaction
- **Cloudflare Integration**: Llama 3.3 70B with function calling
- **Chat Interface**: Natural language conversation
- **Security Focus**: Transaction building without key access

### 🔜 Phase 3: Advanced Features (Next)
- **Transaction Preview**: Enhanced transaction details
- **Demo Mode**: Pre-loaded famous contracts
- **Hardware Wallets**: Ledger/Trezor integration
- **Batch Operations**: Multiple transactions

## 🛠️ **AI Tools Available**

The AI has access to these 5 native tools:

1. **analyze_contract** - Full contract analysis
2. **get_function_details** - Deep function analysis  
3. **check_safety** - Risk assessment and safety scores
4. **build_transaction** - Create unsigned transaction data
5. **estimate_gas** - Gas cost estimation

## 🎮 Demo Scenarios (Security-First)

### Scenario 1: Save User from Scam (30 seconds) 🛡️
```bash
$ orbitl
> "Check this contract: 0x123..."
🚨 AI automatically calls check_safety tool
❌ WARNING: Unverified contract with HIGH risk functions
> "What should I use instead?"
✅ AI suggests verified alternatives
🔒 Your keys stay safe - we never ask for them
```

### Scenario 2: Smart Transaction Building (25 seconds) 🔒
```bash
> "I want to swap 100 USDC for SEI"
🔍 AI calls analyze_contract automatically
💰 AI calls build_transaction tool
📋 Transaction preview shown
🔗 "Sign this with YOUR wallet - we never touch keys!"
```

### Scenario 3: Expert Analysis (20 seconds) 🔍
```bash
> "Analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423"
🔧 AI calls analyze_contract + get_function_details
📊 Complete analysis with risk assessment
✅ Verified DEX with 26 functions, safety score: 85/100
```

## 🚀 Quick Start Commands

```bash
# Environment setup
cp .env.example .env
# Add your Cloudflare AI credentials

# Install and build
pnpm install
pnpm build

# Start AI chat (main mode)
pnpm dev

# Direct analysis
pnpm dev analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423

# Network check
pnpm dev check

# Help
pnpm dev --help
```

## 📊 Success Metrics

- ✅ **Code Completeness**: All MVP features working (1,673 lines)
- ✅ **AI Integration**: Native function calling works perfectly
- ✅ **Security**: Never asks for private keys
- ✅ **Performance**: Contract analysis < 5 seconds
- ✅ **User Experience**: Natural conversation flow
- 🔜 **Demo Quality**: 30-second impressive demonstrations

## 🎯 **Winning Strategy: Simplicity + Security**

### **Why We Ditched MCP**
1. **Too Complex**: MCP added unnecessary layers
2. **Native is Better**: Cloudflare has built-in function calling
3. **Fewer Bugs**: Less code = fewer problems  
4. **Faster Development**: Direct AI integration

### **Our Competitive Advantages**
1. 🛡️ **Security**: Never compromises user safety
2. 🤖 **AI-First**: Truly intelligent conversation  
3. ⚡ **Performance**: Simple = fast
4. 🎯 **User Experience**: Just works naturally
5. 🏗️ **Architecture**: Production-ready simplicity

### **Implementation Timeline (Updated)**
- ✅ **Phase 1**: Contract Analysis (DONE)
- ✅ **Phase 2**: Native AI Integration (DONE)  
- ✅ **Phase 2.5**: Architecture Simplification (DONE)
- ✅ **Phase 2.75**: File Reorganization (DONE)
- 🔜 **Phase 3**: Advanced Features (1-2 days)
- 🔜 **Phase 4**: Demo & Polish (1 day)

## 📚 Resources

- [Sei Network Docs](https://docs.sei.io)
- [Cloudflare AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Ethers.js v6 Docs](https://docs.ethers.org/v6/)
- [Sei Testnet Faucet](https://faucet.sei.io)
- [Example Contracts on Sei](https://seitrace.com)

## 🤝 Communication Protocol

Before implementing any major component:
1. Share your approach
2. Discuss potential issues
3. Get approval
4. Implement
5. Test and iterate

**Remember**: This is a hackathon. Security + Simplicity = Victory. Build something that impresses judges AND keeps users safe.

---

## 🔐 **SECURITY COMMITMENT**

**"We NEVER Touch Your Keys"** is not just a feature - it's our core philosophy. Every line of code, every architecture decision, every user interaction is designed around this principle.

### **Why This Wins the Hackathon**
- 🥇 **Judges Value Security**: Demonstrates enterprise-level security thinking
- 🥇 **User Trust**: Addresses #1 crypto concern (private key safety)  
- 🥇 **Technical Innovation**: Native AI function calling is cutting-edge
- 🥇 **Real-world Ready**: Production-ready security model
- 🥇 **Simplicity**: Easy to understand and verify

**LET'S BUILD THE SAFEST, SMARTEST CONTRACT TOOL! 🚀🔒**

---

## 🏆 **Current Status: Ready to Win!**

✅ **Phase 1 & 2**: Complete - AI chat with native tools working  
✅ **Architecture**: Simplified to 1,673 lines of clean TypeScript  
✅ **Security**: Never touches private keys  
✅ **Testing**: Comprehensive test plan ready  
✅ **Demo**: 30-second scenarios prepared  

**Next: Phase 3 advanced features and final demo preparation! 🎯**