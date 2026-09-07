# Historical plan: Sei contract reading

This records the original Phase 1 proposal. It is not a test report or the current architecture. See [ARCHITECTURE.md](../ARCHITECTURE.md) and [TESTING.md](../TESTING.md) for current behavior and checks.

The proposed CLI would connect to Sei mainnet or testnet, check for contract bytecode, fetch an ABI from Seitrace, infer a basic contract type from function names, and display contract information. An unavailable ABI would leave the contract unverified rather than prevent bytecode inspection.

The planned components were an ethers.js provider, a contract reader, contract data types, and a Commander CLI. Type inference used familiar ABI names for token, exchange, and staking contracts. This was a heuristic classification, with unknown as the fallback.

Planned manual checks covered a verified contract, an unverified contract, an account with no code, malformed addresses, and provider failure. The original addresses and provider assumptions were not revalidated in the current retrieval work. Live checks require a separate scope.

The proposal deferred caching, broader risk assessment, MCP, and richer UI. Its time estimates, example output, and unchecked success criteria were planning material rather than evidence of implementation.
