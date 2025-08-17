# 🛰️ Orbitl

**Natural language interface for Sei smart contract interaction**

A CLI tool with MCP integration that makes smart contract analysis and interaction as easy as natural conversation.

## 🎯 Current Status: Phase 1 - Contract Reading

✅ **Phase 1 Goal**: Basic contract reading and analysis  
🚧 **In Development**: USDC token analysis on Sei Atlantic-2 testnet

### What Works Now
- Connect to Sei Atlantic-2 testnet
- Read contract bytecode and ABI from Seitrace
- Basic contract type detection (Token/DEX/Farm)
- CLI interface: `pnpm dev analyze <address> --testnet`

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm

### Installation
```bash
git clone <repository>
cd orbitl-mcp
pnpm install
```

### Usage
```bash
# Analyze USDC token on Sei testnet
pnpm dev analyze 0x4fCF1784B31630811181f670Aea7A7bEF803eaED --testnet

# Check network connection
pnpm dev check --testnet
```

## 🧪 Test Contracts (Sei Atlantic-2 Testnet)

| Contract | Address | Type | Purpose |
|----------|---------|------|---------|
| USDC | `0x4fCF1784B31630811181f670Aea7A7bEF803eaD` | Token | ERC-20 testing |

**Network Details:**
- Chain ID: 1328 (0x530)
- RPC: https://evm-rpc-testnet.sei-apis.com
- Explorer: https://seitrace.com/?chain=atlantic-2
- Faucet: https://seitrace.com/tool/faucet?chain=atlantic-2

## 🛠️ Tech Stack (Battle-Tested Libraries)

- **Blockchain**: ethers.js v6 (mature, well-documented)
- **CLI**: commander.js (standard CLI framework)
- **Tables**: cli-table3 (clean output formatting)
- **HTTP**: axios (reliable API calls)
- **Validation**: zod (runtime type safety)
- **Spinner**: ora (user feedback)
- **Colors**: chalk (terminal styling)

## 📋 Development Roadmap

### Phase 1: Contract Reading (Current)
- [x] Project setup
- [x] Sei testnet connection
- [ ] Contract ABI fetching
- [ ] Basic type detection
- [ ] CLI interface

### Phase 2: MCP Integration
- [ ] MCP server setup
- [ ] Natural language parsing
- [ ] Tool definitions
- [ ] Claude integration

### Phase 3: Advanced Features
- [ ] Transaction simulation
- [ ] Safety scanner
- [ ] Batch operations
- [ ] TUI interface

## 📁 Project Structure

```
orbitl/
├── src/
│   ├── types/           # TypeScript interfaces
│   ├── blockchain/      # Sei network connection
│   ├── core/           # Contract analysis logic
│   ├── cli/            # Command-line interface
│   └── utils/          # Utilities (config, cache, logging)
├── plans/              # Implementation plans
└── examples/           # Usage examples
```

## 🧪 Testing

```bash
# Run with development server
pnpm dev

# Build for production
pnpm build

# Format code
pnpm format
```

## 🎯 Example Output

```bash
$ pnpm dev analyze 0x4fCF1784B31630811181f670Aea7A7bEF803eaED --testnet

✓ Analyzing contract 0x4fCF...eaED

┌─────────────┬────────────────────────────────┐
│ Property    │ Value                          │
├─────────────┼────────────────────────────────┤
│ Address     │ 0x4fCF1784B31630811181f670A... │
│ Type        │ Token                          │
│ Verified    │ ✓ Yes                          │
│ Functions   │ 12 found                       │
└─────────────┴────────────────────────────────┘

Available Functions:
• name() → Get token name
• symbol() → Get token symbol  
• transfer(to, amount) → Send tokens
• balanceOf(account) → Check balance

✓ Analysis complete!
```

## 🤝 Contributing

This is a hackathon project for Sei Network AI/Accelathon. See `plans/` directory for detailed implementation plans.

## 📚 Resources

- [Sei Network Docs](https://docs.sei.io)
- [Seitrace Explorer](https://seitrace.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

## ⚡ Performance Goals

- Contract analysis: < 2 seconds
- Network connection: < 1 second  
- ABI fetching: < 3 seconds
- Type detection: < 100ms

---

**Built for Sei Network AI/Accelathon 2025** 🚀