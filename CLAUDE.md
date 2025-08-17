# CLAUDE.md - Orbitl Engineering Specification

## 🎯 Project Overview

**Project Name:** Orbitl  
**Type:** CLI Tool with MCP Integration  
**Hackathon:** Sei Network AI/Accelathon - MCPU Bonus Bounty ($15K)  
**Timeline:** 10 days (Due: August 25, 2025)  
**Primary Goal:** Win the hackathon by building a natural language interface for smart contract interaction

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

## 🏗️ Technical Architecture

### Project Structure
```
orbitl/
├── src/
│   ├── cli/
│   │   ├── index.ts          # Entry point
│   │   ├── commands.ts       # CLI command handlers
│   │   └── ui.ts            # TUI components
│   ├── core/
│   │   ├── analyzer.ts      # Contract analysis engine
│   │   ├── scanner.ts       # Safety scanner
│   │   ├── translator.ts    # ABI to human language
│   │   └── patterns.ts      # Contract pattern matching
│   ├── mcp/
│   │   ├── server.ts        # MCP server setup
│   │   ├── tools.ts         # MCP tool definitions
│   │   └── parser.ts        # Intent parsing
│   ├── blockchain/
│   │   ├── sei.ts           # Sei network connection
│   │   ├── contracts.ts     # Contract interaction
│   │   └── transactions.ts  # Transaction builder
│   └── utils/
│       ├── cache.ts         # ABI caching
│       ├── logger.ts        # Logging utility
│       └── config.ts        # Configuration
├── examples/
│   └── demo-contracts.json  # Pre-loaded contracts for demo
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
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

### Phase 2: MCP Integration (Days 3-4)
```typescript
// 3. src/mcp/server.ts
export class MCPServer {
  async start()
  registerTools()
  handleRequest(request: MCPRequest)
}

// 4. src/mcp/tools.ts
export const tools = {
  analyzeContract: /* MCP tool definition */,
  executeFunction: /* MCP tool definition */,
  checkSafety: /* MCP tool definition */
}
```

### Phase 3: CLI Interface (Days 5-6)
```typescript
// 5. src/cli/index.ts
commander
  .command('analyze <address>')
  .command('execute <address>')
  .command('scan <address>')
  .option('--paper', 'Paper mode (no real transactions)')
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

## 🎮 Demo Scenarios

### Scenario 1: Save User from Scam (30 seconds)
```bash
$ orbitl
> "Check 0x666..." 
[Shows WARNING - scam contract]
> "What should I use instead?"
[Shows safe alternatives]
```

### Scenario 2: Claim All Rewards (20 seconds)
```bash
> "Find all my unclaimed rewards"
[Lists rewards across protocols]
> "Claim everything"
[One-click claim all]
```

### Scenario 3: Understand Complex DeFi (25 seconds)
```bash
> "Explain what I can do with 0xDragonSwap"
[Human-friendly explanation of LP staking]
> "Stake 100 SEI"
[Transaction preview and execution]
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

## 🎯 Winning Strategy

1. **Days 1-5**: Build solid MVP that actually works
2. **Days 6-8**: Polish and add wow factor
3. **Day 9**: Demo preparation and testing
4. **Day 10**: Final submission and video

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

**Remember**: This is a hackathon. Speed matters, but a working demo matters more. Build something that impresses in 30 seconds.

---

**LET'S BUILD SOMETHING AMAZING! 🚀**

When you're ready, say "Ready to start Phase 1" and we'll begin with the foundation.