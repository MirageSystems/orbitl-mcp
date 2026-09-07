# Historical plan: Sei native function calling

This records the original Phase 2 proposal for the Sei chat interface. It chose Cloudflare native function calling for that interface. The later audit-reference MCP is a separate entrypoint; this document does not direct its removal. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the current split.

The proposed flow sent user messages and tool definitions to Cloudflare, dispatched returned tool calls locally, and sent tool results back for a response. The proposed tools inspected contracts, described functions, reported heuristic safety checks, and prepared unsigned transaction data.

The design kept chain access and contract reading behind the tool executor. It required external wallet signing and prohibited handling private keys. The transaction examples contained placeholder encoding. They were not working transaction builders or evidence of safe execution.

The proposal also discussed conversation persistence and removing an earlier MCP approach from the Sei interface. Persistence and other proposed behavior must be checked against the current source. Marketing claims, timelines, and simulated chat output from the original plan did not establish correctness or performance.

The current Sei tool manager exposes five tools, including gas estimation. Its mock encoding, static gas estimates, recursion cap, and limited in-memory history remain documented limitations. The audit-reference server has its own read-only tools and does not expose these Sei operations.
