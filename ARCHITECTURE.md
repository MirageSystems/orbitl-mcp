# Architecture

The Sei interface, reference CLI, and audit-reference MCP have separate entrypoints.

| Area                               | Responsibility                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `src/cli.ts`                       | Sei commands and chat startup                                                    |
| `src/interface/chat.ts`            | Readline interaction, static system prompt, and recent history                   |
| `src/intelligence/client.ts`       | Cloudflare requests and recursive native tool calls                              |
| `src/intelligence/tool-manager.ts` | Five contract tools and heuristic output                                         |
| `src/analysis/reader.ts`           | ABI-based contract inspection                                                    |
| `src/network/sei.ts`               | RPC and explorer access                                                          |
| `src/wallet/wallet-connect.ts`     | External wallet session management                                               |
| `src/retrieval/findings.ts`        | Readonly types, corpus validation, text normalization, query terms, and excerpts |
| `src/retrieval/store.ts`           | Transactional SQLite indexing and prepared read operations                       |
| `src/retrieval/cli.ts`             | Index building and direct JSON lookup                                            |
| `src/mcp/context.ts`               | Citations, context limits, paging, and the review prompt                         |
| `src/mcp/server.ts`                | MCP tools, prompt, resource, and schemas                                         |
| `src/mcp/cli.ts`                   | Read-only database lifetime and stdio transport                                  |

## Reference data flow

The offline Python helper reads the local Parquet file, removes exact full-text duplicates, and exports a versioned JSON corpus with the source-dataset hash. It retains one source filename and historical severity label for each exported finding. It excludes the dedicated PoC field.

The TypeScript build command validates the corpus and writes metadata, narrative payloads, and an FTS5 index in one transaction. It indexes descriptions and recommendations. Titles remain metadata and are excluded from search, which preserves the title-to-body diagnostic boundary.

A completed database is published through an exclusive filesystem link. Existing destinations are preserved. Failed builds leave no published partial index. Query processes open the database read-only with extension loading disabled.

Query preparation is a pure function. Search terms become quoted FTS terms passed through bound SQL parameters. Queries are limited to 2,048 characters and 64 searchable terms. Results are limited to ten. SQLite BM25 determines rank, with finding ID as a deterministic tie-breaker.

## MCP context flow

An MCP host starts `dist/mcp/cli.js` over stdio with one explicit index path. The server opens that index once, prepares its read statements, and keeps the connection for the transport lifetime. Stdout carries protocol messages only.

`search_audit_references` returns clipped descriptions and recommendations. The encoded tool result cannot exceed 64 KiB before the JSON-RPC envelope, and `omittedForBudget` records results removed to meet that limit. The budget includes both the structured payload and its text copy for client compatibility. Oversized pages fail with a request for a shorter page. `get_audit_reference` reads either narrative section by character offset in pages of up to 8,000 characters. Unicode paging does not split code points.

Every tool response includes the source-dataset hash, finding ID, stable `orbitl:<hash>:<id>` citation, source filename, historical severity, and reference-use warning. The `orbitl://index` resource reports dataset identity and the lexical retrieval method. The dataset hash identifies the source snapshot. It does not authenticate later edits to the exported corpus or SQLite index.

`review_with_references` searches five references and returns a prompt containing the existing concern, supplied source evidence, bounded historical context, and assessment rules. The complete prompt result has the same 64 KiB encoded budget and rejects oversized evidence instead of silently truncating it. The MCP does not generate the assessment. The host model does. This is retrieval-augmented generation when the host model uses the returned context, with SQLite FTS5 BM25 as the current retrieval backend.

## Trust boundary

Historical descriptions and recommendations are untrusted data. The server does not execute them and offers no network, indexing, scanning, transaction, wallet, or report-writing tool. A similar finding does not establish applicability. Reviewers must compare prerequisites with the current source and keep the candidate disposition in the review's existing ledger.

The runtime retrieval and MCP code use strict functional TypeScript and readonly records. The SDK supplies the MCP server and transport objects at the protocol boundary. The offline Parquet conversion helper remains Python. The MCP SDK v2 uses Zod 4 schemas through the `zod-v4` alias. Zod 3 remains for the existing wallet dependency peer requirement.

## Existing limitations

The lexical backend does not use embeddings, understand the current codebase, or establish semantic relevance. The provisional known-item benchmark does not measure audit accuracy. Human verdict validation and a project-held-out evaluation remain open.

Sei analysis uses ABI shape and function names. Published ABI status does not establish security. Transaction encoding and gas estimation contain mock behavior. The chat client has a depth-three tool cap and limited in-memory history. This work does not establish live-provider or wallet correctness.
