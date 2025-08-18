# CLAUDE.md - Orbitl Engineering Specification

## 🎯 Project Overview

**Project Name:** Orbitl  
**Type:** CLI Tool with MCP Integration  
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

### Must Have (MVP - Days 1-5)
1. **Contract Analysis**
   - Fetch and decode contract ABI
   - Identify contract type (DEX, Token, Farm, NFT)
   - Translate functions to human language
   - Display user's interaction status

2. **Natural Language Processing via MCP**
   - Parse user commands through Claude MCP
   - Map intents to contract functions
   - Handle parameter extraction
   - Generate transaction data

3. **Safety Scanner**
   - Check contract verification status
   - Identify dangerous functions
   - Show basic risk assessment
   - Warning system for suspicious contracts

### Should Have (Enhancement - Days 6-8)
1. Beautiful TUI with real-time updates
2. Transaction simulation before execution
3. Batch operations support
4. Gas estimation and optimization

### Nice to Have (If Time Permits - Days 9-10)
1. Telegram bot version
2. Contract interaction history
3. Advanced pattern recognition
4. Community trust scores

## 🏗️ **Wallet-Safe Technical Architecture**

### Current Implementation (Phase 1 & 2 Complete ✅)
```
orbitl/
├── src/
│   ├── cli/
│   │   └── index.ts          # Entry point with chat-first UX
│   ├── core/
│   │   ├── contract-reader.ts # Contract analysis engine
│   │   └── (scanner.ts)      # 🔜 Safety scanner & risk assessment
│   ├── chat/
│   │   ├── interface.ts      # Interactive chat with AI
│   │   └── conversation.ts   # Conversation management
│   ├── mcp/
│   │   └── server.ts         # MCP server with contract tools
│   ├── ai/
│   │   └── cloudflare-client.ts # Cloudflare AI integration
│   ├── blockchain/
│   │   └── sei-provider.ts   # READ-ONLY Sei network connection
│   ├── types/
│   │   └── contract.ts       # Type definitions
│   └── utils/               # Configuration utilities
├── examples/
├── package.json             # Current: ethers@6, commander, etc.
├── tsconfig.json           # Strict TypeScript configuration
└── README.md               # Battle-tested libs documentation
```

### 🔜 **Phase 3: Wallet-Safe Transaction Mode**
```
├── src/
│   ├── wallet/              # 🆕 ZERO private key handling
│   │   ├── transaction-builder.ts # 🔒 Build tx data only
│   │   ├── wallet-connect.ts      # 🔒 WalletConnect integration  
│   │   ├── hardware.ts            # 🔒 Ledger/Trezor support
│   │   ├── preview.ts             # Transaction preview & simulation
│   │   └── safety-checks.ts       # Pre-execution safety validation
│   ├── core/
│   │   ├── safety-scanner.ts      # Advanced risk assessment
│   │   └── transaction-simulator.ts # Simulate before execute
```

### Tech Stack
```json
{
  "core": {
    "language": "TypeScript",
    "runtime": "Node.js 20+",
    "package-manager": "pnpm"
  },
  "dependencies": {
    "cli": ["commander", "inquirer", "chalk", "ora"],
    "tui": ["blessed", "blessed-contrib"],
    "blockchain": ["ethers@6", "axios"],
    "mcp": ["@modelcontextprotocol/sdk"],
    "utilities": ["dotenv", "node-cache"]
  },
  "dev-dependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "prettier": "^3.0.0"
  }
}
```

## 🔧 Implementation Plan

### Phase 1: Foundation (Days 1-2)
```typescript
// Start with these files:
// 1. src/blockchain/sei.ts
export class SeiProvider {
  async getContract(address: string)
  async getABI(address: string)
  async getCode(address: string)
}

// 2. src/core/analyzer.ts
export class ContractAnalyzer {
  async analyze(address: string): Promise<ContractInfo>
  identifyType(abi: ABI): ContractType
  getUserStatus(address: string, userAddress: string)
}
```

### Phase 2: MCP Integration (Days 3-4) ✅ COMPLETE
```typescript
// ✅ src/mcp/server.ts 
export class OrbitlMCPServer {
  // MCP server with contract analysis tools
}

// ✅ src/ai/cloudflare-client.ts
export class CloudflareAI {
  // Llama 3.1 8B Instruct integration
}

// ✅ src/chat/interface.ts
export class ChatInterface {
  // Interactive chat with AI + conversation history
}
```

### Phase 3: Wallet-Safe Transaction Builder (Days 5-6) 🔜 NEXT
```typescript
// 🔜 src/wallet/transaction-builder.ts
export class SafeTransactionBuilder {
  buildTransaction(contractCall: ContractCall): TransactionData
  // NEVER signs - only builds data for external signing
}

// 🔜 src/wallet/wallet-connect.ts  
export class WalletConnectIntegration {
  connectWallet(): Promise<WalletConnection>
  sendTransactionForSigning(txData: TransactionData): Promise<SignedTx>
  // NEVER accesses private keys
}

// 🔜 src/core/safety-scanner.ts
export class SafetyScanner {
  scanContract(address: string): Promise<RiskAssessment>
  validateTransaction(txData: TransactionData): SafetyReport
}
```

### Phase 4: Polish (Days 7-8)
- Add TUI dashboard
- Implement transaction preview
- Add batch operations
- Error handling and edge cases

### Phase 5: Demo Prep (Days 9-10)
- Pre-load famous contracts
- Create demo script
- Record video
- Prepare submission

## 📝 Key Algorithms

### Contract Type Detection
```typescript
function identifyContractType(abi: ABI): ContractType {
  // Check for standard patterns
  const hasSwap = abi.some(f => f.name.includes('swap'))
  const hasTransfer = abi.some(f => f.name === 'transfer')
  const hasStake = abi.some(f => f.name.includes('stake'))
  
  if (hasSwap) return 'DEX'
  if (hasStake) return 'Farm'
  if (hasTransfer && !hasSwap) return 'Token'
  // ... more patterns
}
```

### Function Translation Map
```typescript
const functionTranslations = {
  'transfer': 'Send tokens',
  'approve': 'Allow spending',
  'stake': 'Lock tokens for rewards',
  'claimRewards': 'Collect earned rewards',
  'addLiquidity': 'Provide liquidity to pool',
  // ... comprehensive mapping
}
```

### Risk Assessment
```typescript
function assessRisk(func: ABIFunction): RiskLevel {
  const dangerous = ['selfdestruct', 'delegatecall', 'kill']
  const risky = ['approve', 'transfer', 'setOwner']
  
  if (dangerous.some(d => func.name.includes(d))) return 'CRITICAL'
  if (risky.some(r => func.name.includes(r))) return 'HIGH'
  if (func.stateMutability === 'view') return 'NONE'
  return 'MEDIUM'
}
```

## 🎮 Demo Scenarios (Wallet-Safe Approach)

### Scenario 1: Save User from Scam (30 seconds) 🛡️
```bash
$ orbitl
> "Check 0x666..." 
🚨 WARNING: Unverified contract detected
❌ Risk Level: CRITICAL - Do not interact
> "What should I use instead?"
✅ Safe alternatives: [Lists verified DEXs]
🔒 Your keys stay in YOUR wallet - we never ask for them
```

### Scenario 2: Safe Transaction Building (25 seconds) 🔒
```bash
> "I want to stake 100 SEI on 0xDragonSwap"
🔍 Analyzing contract... ✅ Verified DEX found
💰 Building stake transaction for 100 SEI
📋 Transaction preview:
   • Contract: DragonSwap LP Staking
   • Function: stake(100000000000000000000)
   • Gas estimate: ~50,000 SEI
   • Safety: ✅ Low risk
🔗 Connect your wallet to sign (WalletConnect/Hardware)
[Never asks for private keys - YOU sign in YOUR wallet]
```

### Scenario 3: Wallet-Safe Analysis (20 seconds) 🔍
```bash
> "Analyze 0xSomeContract"
🔍 Contract Analysis:
   ✅ Verified on Seitrace
   💰 Token contract (DRAGON)
   🔒 Standard ERC-20 functions
   ⚠️  High-risk functions: approve() - be careful with amounts
🔒 Analysis complete - your wallet never exposed
```

## 🚀 Quick Start Commands

```bash
# Initial setup
git init orbitl
cd orbitl
pnpm init
pnpm add typescript tsx @types/node -D

# Create structure
mkdir -p src/{cli,core,mcp,blockchain,utils}
touch src/cli/index.ts

# Run in dev mode
pnpm tsx src/cli/index.ts

# Build for production
pnpm tsc
```

## 📊 Success Metrics

- **Code Completeness**: All MVP features working
- **Demo Quality**: Smooth 30-second demonstration
- **User Safety**: Correctly identifies 10/10 known scams
- **MCP Integration**: Natural language feels natural
- **Performance**: Contract analysis < 2 seconds

## ⚠️ Common Pitfalls to Avoid

1. **Over-engineering**: Keep it simple, we have 10 days
2. **Ignoring edge cases**: Handle network errors gracefully
3. **Poor UX**: Make errors helpful, not technical
4. **No demo prep**: Practice the demo 20+ times
5. **Forgetting safety**: Never execute without user confirmation

## 🎯 **Security-First Winning Strategy**

### **Our Unique Value Proposition**
🔒 **"We NEVER Touch Your Keys"** - The only smart contract tool that prioritizes user security above all else.

### **Implementation Timeline**
1. **Days 1-4**: ✅ **COMPLETE** - Chat-first analysis with AI (NO transactions)
2. **Days 5-6**: 🔜 **NEXT** - Wallet-safe transaction builder (Preview only)
3. **Days 7-8**: **Polish** - WalletConnect + Hardware wallet support
4. **Day 9**: **Demo** - Emphasize security advantage
5. **Day 10**: **Submission** - "Safest smart contract tool in crypto"

### **Competitive Advantages for Judges**
1. 🛡️ **Security**: Never compromises user safety
2. 🤖 **AI-First**: Natural language that actually works  
3. ⚡ **Performance**: Instant contract analysis
4. 🎯 **User Experience**: Chat interface like Claude Code
5. 🏗️ **Architecture**: Enterprise-ready security model

## 📚 Resources

- [Sei Network Docs](https://docs.sei.io)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
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

**Remember**: This is a hackathon. Security + Speed = Victory. Build something that impresses judges AND keeps users safe.

---

## 🔐 **SECURITY COMMITMENT**

**"We NEVER Touch Your Keys"** is not just a feature - it's our core philosophy. Every line of code, every architecture decision, every user interaction is designed around this principle.

### **Why This Wins the Hackathon**
- 🥇 **Judges Value Security**: Demonstrates enterprise-level security thinking
- 🥇 **User Trust**: Addresses #1 crypto concern (private key safety)  
- 🥇 **Technical Innovation**: Wallet-safe architecture is cutting-edge
- 🥇 **Real-world Ready**: Production-ready security model
- 🥇 **Competitive Differentiation**: No other tool prioritizes this

**LET'S BUILD THE SAFEST, SMARTEST CONTRACT TOOL! 🚀🔒**

Current Status: Phase 1 & 2 Complete ✅ | Next: Wallet-Safe Transaction Builder 🔜