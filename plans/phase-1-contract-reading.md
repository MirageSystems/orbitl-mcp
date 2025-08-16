# Phase 1: Contract Reading - Implementation Plan (Orbitl)

## 🎯 Goal
Build a minimal working foundation that can read and analyze Sei smart contracts with basic CLI interface.

## 📋 Success Criteria
- [ ] Can connect to Sei network (mainnet/testnet)
- [ ] Can read contract bytecode and verify it exists
- [ ] Can fetch contract ABI from Seitrace explorer
- [ ] Can identify basic contract type (Token, DEX, Farm, etc.)
- [ ] Can display human-readable contract information
- [ ] Simple CLI command: `pnpm dev analyze <address>`

## 🏗️ Architecture Decision

### Core Components (Minimal)
```
src/
├── types/
│   └── contract.ts       # Basic contract types only
├── blockchain/
│   └── sei-provider.ts   # Network connection + ABI fetching
├── core/
│   └── contract-reader.ts # Contract analysis (simplified)
└── cli/
    └── index.ts          # Single 'analyze' command
```

### What We WON'T Build Yet
- ❌ Complex pattern matching
- ❌ Risk assessment
- ❌ User interaction status
- ❌ MCP integration  
- ❌ Caching
- ❌ Multiple CLI commands
- ❌ TUI/fancy output

## 🔧 Implementation Steps

### Step 1: Basic Types (30 min)
```typescript
// src/types/contract.ts
export interface ContractData {
  address: string;
  hasCode: boolean;
  isVerified: boolean;
  abi: any[];
  basicType: "Token" | "DEX" | "Farm" | "Unknown";
}
```

### Step 2: Sei Provider (45 min)
```typescript
// src/blockchain/sei-provider.ts
export class SeiProvider {
  constructor(rpcUrl: string) {}
  
  async hasCode(address: string): Promise<boolean> {}
  async fetchABI(address: string): Promise<any[]> {}
}
```

**Key Implementation Notes:**
- Use ethers.js JsonRpcProvider
- Seitrace API: `https://seitrace.com/api/v2/smart-contracts/${address}`
- Handle 404 gracefully (unverified contracts)
- Return empty ABI array if not verified

### Step 3: Contract Reader (30 min)
```typescript
// src/core/contract-reader.ts
export class ContractReader {
  constructor(seiProvider: SeiProvider) {}
  
  async read(address: string): Promise<ContractData> {
    // 1. Check if address has code
    // 2. Try to fetch ABI
    // 3. Determine basic type from ABI function names
    // 4. Return structured data
  }
}
```

**Type Detection Logic (Simple):**
- Token: has `transfer`, `balanceOf`, `totalSupply`
- DEX: has `swap` or `addLiquidity`  
- Farm: has `stake` or `deposit` + `withdraw`
- Unknown: everything else

### Step 4: CLI Interface (30 min)
```typescript
// src/cli/index.ts
import { Command } from "commander";

const program = new Command();

program
  .command("analyze <address>")
  .option("-t, --testnet", "Use testnet")
  .action(async (address, options) => {
    // 1. Initialize provider
    // 2. Read contract
    // 3. Display basic info in console
  });
```

**Output Format:**
```
Contract Analysis: 0x1234...5678

✓ Contract verified
✗ Type: Token (SEI)
✓ Functions: 9 found

Functions:
- transfer(address,uint256)
- balanceOf(address) 
- totalSupply()
...
```

## 🧪 Testing Strategy

### Sei Atlantic-2 Testnet Configuration
- **Chain ID**: 1328 (0x530)
- **RPC URL**: https://evm-rpc-testnet.sei-apis.com  
- **Explorer**: https://seitrace.com/?chain=atlantic-2
- **Faucet**: https://seitrace.com/tool/faucet?chain=atlantic-2

### Test Contract Addresses (Atlantic-2 Testnet)
1. **USDC Token**: `0x4fCF1784B31630811181f670Aea7A7bEF803eaED`
   - Type: Token (ERC-20)
   - Verified: Should be verified
   - Good test for token detection

### Manual Test Cases
1. **Verified Token**: USDC contract above
2. **Unverified Contract**: Random contract address  
3. **Non-Contract Address**: EOA address (0x1234...5678)
4. **Invalid Address**: Malformed address (0x123)
5. **Network Error**: Test with wrong RPC

### Test Commands
```bash
# Test USDC token on testnet
pnpm dev analyze 0x4fCF1784B31630811181f670Aea7A7bEF803eaED --testnet

# Test invalid address
pnpm dev analyze 0x123 --testnet

# Test EOA (should fail gracefully)
pnpm dev analyze 0x1234567890123456789012345678901234567890 --testnet
```

### Available DEX Projects for Future Testing
- **Sparrowswap**: Sei Native DEX
- **Simba Exchange**: DEX order book
- **Levana Protocol**: Leveraged positions DEX

(We'll find their contract addresses as we implement)

## 📊 Time Estimation
- **Total**: ~2.5 hours
- **Step 1**: 30 min (types)
- **Step 2**: 45 min (provider) 
- **Step 3**: 30 min (reader)
- **Step 4**: 30 min (CLI)
- **Testing**: 15 min (manual verification)

## 🚧 Known Limitations
- No error recovery for network issues
- No caching (will re-fetch ABI every time)
- Very basic type detection
- Minimal output formatting
- No validation of contract addresses

## 🎯 Phase 1 Demo
By end of Phase 1, we should be able to:

```bash
$ pnpm dev analyze 0xSomeContract
✓ Analyzing contract 0xSome...tract

Contract Information:
Address: 0xSomeContract  
Type: Token
Verified: Yes
Functions: 12 found

Available Functions:
- name() → Get token name
- symbol() → Get token symbol  
- transfer(to, amount) → Send tokens
- balanceOf(account) → Check balance
...

✓ Analysis complete!
```

## ✅ Updated Configuration Based on Research
1. **Network**: ✅ Using Sei Atlantic-2 testnet (Chain ID 1328)
2. **Test Contract**: ✅ USDC token `0x4fCF1784B31630811181f670Aea7A7bEF803eaED`
3. **Explorer API**: ✅ Seitrace testnet explorer
4. **DEX Ecosystem**: ✅ Yei Finance, Sparrowswap, Simba Exchange available

## ❓ Remaining Questions for Discussion  
1. **Output format**: Simple console.log or structured tables?
2. **Error handling**: How verbose should error messages be?
3. **Rate limiting**: Should we add delays for Seitrace API calls?
4. **Yei Finance**: Should we try to find their specific testnet contracts or focus on USDC first?

---

**Ready to implement Phase 1?** This gives us a solid foundation to build MCP integration and advanced features in Phase 2.