# Orbitl Architecture

AI-powered contract analysis and safe transaction builder for Sei Network.

## Overview

Orbitl is built with a clean separation of concerns across three main domains:

```
├── src/
│   ├── intelligence/     # AI & Tools Domain  
│   ├── wallet/           # Transaction Domain
│   ├── config/           # Configuration Domain
│   ├── analysis/         # Contract Analysis Domain
│   ├── network/          # Network Communication Domain
│   └── utils/            # Shared Utilities
```

## Core Domains

### 1. Intelligence Domain (`src/intelligence/`)

**Purpose**: AI-powered natural language interface with tool calling

**Key Components**:
- `client.ts` - Cloudflare AI client with recursive tool calling
- `tools/analysis-tools.ts` - Contract analysis tools (4 tools)
- `tools/transaction-tools.ts` - Transaction building tools (3 tools) 
- `tools/wallet-tools.ts` - Wallet & execution tools (5 tools)
- `tools/index.ts` - Unified tool registry

**Architecture Pattern**: Tool-based AI with domain separation
- Each domain has focused, specialized tools
- Clean separation prevents tool bloat
- Recursive tool calling for complex workflows

### 2. Transaction Domain (`src/wallet/`)

**Purpose**: Safe transaction building, simulation, and execution

**Key Components**:
- `transaction-system.ts` - **NEW**: Consolidated transaction interface
- `transaction-builder.ts` - Core transaction building logic
- `transaction-simulator.ts` - Balance change simulation
- `validator.ts` - Address and parameter validation
- `wallet-connect-flow.ts` - WalletConnect integration
- `gas-estimator.ts` - Gas cost estimation
- `balance-fetcher.ts` - Real-time balance queries

**Architecture Pattern**: Unified system with specialized components
- `TransactionSystem` class consolidates all operations
- Replaces multiple interfaces with single entry point
- Maintains component specialization internally

### 3. Configuration Domain (`src/config/`)

**Purpose**: Network and token configuration management

**Key Components**:
- `token-resolver.ts` - Centralized token resolution
- `tokens.json` - Real mainnet/testnet token addresses

**Architecture Pattern**: Centralized configuration
- Single source of truth for all token data
- Network-aware token resolution
- Real addresses for production use

### 4. Analysis Domain (`src/analysis/`)

**Purpose**: Contract reading and safety analysis

**Key Components**:
- `reader.ts` - Contract ABI reading and analysis  
- `types.ts` - Type definitions for contracts

**Architecture Pattern**: Read-only analysis
- Focus on safety scoring and risk assessment
- Pattern-based contract type detection
- No complex analysis, just reliable basics

### 5. Network Domain (`src/network/`)

**Purpose**: Sei blockchain communication

**Key Components**:
- `sei.ts` - Sei network providers and configuration

## Data Flow

### 1. Natural Language Request
```
User Input → AI Client → Tool Selection → Tool Execution → Response
```

### 2. Transaction Building  
```
Token Symbol → Token Resolver → Transaction System → Preview + Validation
```

### 3. Transaction Execution
```
Built Transaction → WalletConnect Flow → User Signs → Network Broadcast
```

## Security Model

**"We Never Touch Your Keys"**

1. **No Private Key Handling**: All signing happens in user's wallet
2. **WalletConnect Protocol**: Secure wallet communication
3. **Address Validation**: Comprehensive validation with burn detection  
4. **Risk Assessment**: Transaction simulation with warning system
5. **Real Addresses**: No mock data, production-ready token addresses

## Tool Architecture

### Analysis Tools (4 tools)
- `analyze_contract` - Contract type, functions, safety scoring
- `get_function_details` - Detailed function analysis  
- `check_safety` - Comprehensive safety checks
- `estimate_gas` - Gas cost estimation

### Transaction Tools (3 tools)  
- `lookup_token` - Token address resolution
- `build_token_transfer` - Transfer transaction building
- `build_token_approval` - Approval transaction building

### Wallet Tools (5 tools)
- `connect_wallet` - WalletConnect QR generation
- `check_wallet_connection` - Connection status
- `show_transaction_preview` - Preview formatting
- `simulate_transaction` - Balance change simulation
- `execute_transaction` - Complete execution flow

## Key Design Decisions

### 1. Consolidated Transaction System
- **Problem**: Multiple interfaces (TransactionInterface, multiple builders)
- **Solution**: Single TransactionSystem class with specialized components
- **Benefit**: Simplified API, easier to maintain, consistent behavior

### 2. Domain-Split Tools
- **Problem**: 13 tools in one massive file  
- **Solution**: Split by domain (analysis/transaction/wallet)
- **Benefit**: Better organization, focused concerns, easier to extend

### 3. Centralized Token Resolution
- **Problem**: Hardcoded addresses scattered across codebase
- **Solution**: Single TokenResolver with network-aware lookup
- **Benefit**: Easy to update, consistent addresses, testnet support

### 4. Real Production Data
- **Problem**: Mock addresses and demo data
- **Solution**: Real USDC, WSEI, SEI addresses for mainnet/testnet  
- **Benefit**: Hackathon-ready, production use, no surprises

## Network Support

### Mainnet (Pacific-1)
- Chain ID: 1329
- USDC: `0xE15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392`
- WSEI: `0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7`  
- SEI: Native token

### Testnet (Atlantic-2)  
- Chain ID: 1328
- USDC: `0x4fCF1784B31630811181f670Aea7A7bEF803eaED`
- WSEI: `0x3921eA6Cf927BE80211Bb57f19830700285b0AdA`
- SEI: Native token

## Extension Points

1. **New Tools**: Add to appropriate domain in `tools/` directory
2. **New Tokens**: Add to `tokens.json` configuration  
3. **New Networks**: Extend network configurations
4. **New Transaction Types**: Extend TransactionSystem class
5. **Enhanced Analysis**: Extend contract analysis patterns

## Performance Considerations

- **Tool Calling**: Recursive depth limited to 3 levels
- **Token Lookup**: Fast symbol resolution with fallback to address verification
- **Balance Fetching**: Direct contract calls, no caching complexity
- **Gas Estimation**: Pattern-based estimates for speed

This architecture prioritizes hackathon needs: **fast**, **reliable**, **production-ready**.