# Orbitl

AI-powered contract analysis and safe transaction builder for Sei Network.

## Features

- Contract analysis with safety scoring
- Natural language transaction building
- WalletConnect integration for secure signing
- Risk assessment and transaction simulation
- Support for mainnet and testnet

## Quick Start

```bash
# Install dependencies
pnpm install

# Start interactive CLI
pnpm dev

# Direct commands
npx tsx src/cli.ts lookup USDC
npx tsx src/cli.ts simulate transfer USDC 100 -f 0x123... -t 0x456...
npx tsx src/cli.ts validate 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456
```

## Demo Commands

```bash
# Look up token addresses
pnpm tsx src/cli.ts lookup USDC
pnpm tsx src/cli.ts --network testnet lookup WSEI

# Simulate transactions
pnpm tsx src/cli.ts simulate transfer USDC 100 -f 0x1234567890123456789012345678901234567890 -t 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456

# Test WalletConnect
pnpm tsx src/cli.ts wallet

# AI Natural Language (interactive mode)
pnpm dev
> "Send 100 USDC to 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456"
```

## Architecture

- `src/core/` - Business logic (contracts, tokens, transactions)
- `src/intelligence/` - AI integration with 13 specialized tools
- `src/wallet/` - Transaction building and WalletConnect integration
- `src/config/` - Network and token configurations

## Security

- Never handles private keys
- All transactions signed in user's wallet
- Comprehensive risk assessment
- Address validation and burn detection