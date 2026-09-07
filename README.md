# Orbitl

Orbitl has two separate interfaces. The existing Sei CLI uses Cloudflare native function calling for contract interaction. The audit-reference MCP provides read-only local search over historical findings for use during review.

The retrieval runtime and MCP are functional TypeScript. A small offline Python helper converts the local Parquet dataset before indexing. Query and MCP operation need no model credentials or network connection. The MCP client supplies any model used to assess the returned context.

## Build a local reference index

Use Node.js 24 or newer and pnpm 9.15.9:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Export the workspace dataset and build the SQLite FTS5 index from the repository root:

```bash
uv run --script scripts/export-findings.py ../audit-findings.parquet .orbitl/findings.json
pnpm findings --index .orbitl/findings.sqlite --build .orbitl/findings.json
```

The export helper needs Python 3.11 or newer and `uv` to read Parquet. Export and index creation refuse to replace existing files. Generated corpus and index files stay under the ignored `.orbitl/` directory.

The exporter omits the dataset's PoC field. Descriptions and recommendations remain untrusted historical text and may contain code or instructions. Orbitl never executes that text.

## Run the audit-reference MCP

Build the project, then configure an MCP client to start this command with absolute paths:

```bash
node /absolute/repo/dist/mcp/cli.js --index /absolute/path/findings.sqlite
```

The process uses stdout only for MCP protocol messages. Diagnostics go to stderr. See [MCP setup](docs/MCP-SETUP.md) for the exact host configuration.

The stdio server uses the stable Model Context Protocol TypeScript SDK v2 and exposes:

| Capability                | Purpose                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `search_audit_references` | Search descriptions and recommendations and return at most ten cited excerpts     |
| `get_audit_reference`     | Read a description or recommendation in pages of at most 8,000 characters         |
| `review_with_references`  | Prepare grounded context for an existing concern and supplied source evidence     |
| `orbitl://index`          | Report the dataset identity, indexed fields, retrieval method, and identity limit |

Search queries are limited to 2,048 characters and 64 searchable terms. Encoded tool results, including both text and structured content, are limited to 64 KiB before the JSON-RPC envelope. The review prompt uses the same result budget. Large result sets report `omittedForBudget`. Each result includes a citation in the form `orbitl:<dataset-sha256>:<finding-id>`. Follow `nextOffset` to read another page from a long description or recommendation.

The server opens one existing index read-only and disables SQLite extension loading. Its tools are read-only, idempotent, and closed to external systems. It cannot build an index, access a network, scan a contract, modify a report, or run a model.

## Use references during review

Search for historical material after a reviewer has an existing concern or question. Compare each historical prerequisite with evidence from the current source. Cite the dataset hash and finding ID, then record the reason for retaining, rejecting, merging, or deferring the candidate in the review's existing disposition ledger.

`review_with_references` packages the concern, supplied evidence, and five search results for the host model. It does not validate a finding. Similarity scores are lexical ranking values, historical severity does not set current severity, and historical text cannot replace evidence from the reviewed source.

The recorded 200-query diagnostic retrieved the source finding in the top five for 76% of title queries. This is a development known-item test, not a measure of semantic relevance or audit accuracy. See [benchmark methods and results](benchmarks/README.md). BTC manual validation and a project-held-out comparison with human judgments remain pending.

## Direct reference CLI

The lower-level command can query the same local index without MCP:

```bash
pnpm findings --index .orbitl/findings.sqlite --query "rounding accounting" --limit 5
pnpm findings --index .orbitl/findings.sqlite --id 123
```

Search output contains the dataset identity, source filename, finding ID, historical severity, lexical score, and bounded excerpts. Direct ID lookup returns the stored narrative. A built package also exposes `orbitl-findings` for the same operations without development dependencies. Prefer the paged MCP tool when placing long references in model context.

## Sei CLI

```bash
pnpm dev --help
pnpm dev check
pnpm dev
```

Chat requires the Cloudflare settings in `.env.example`. RPC and explorer commands use live providers. Contract inspection is based on ABI information and heuristics, not source-level security analysis.

Known limitations include mock transaction encoding, static gas estimates, a canned response at the tool recursion cap, and six-message conversation history. The WalletConnect connection request includes both Sei networks. The existing `connect --testnet` flag does not restrict that request. Do not treat the transaction builder as a validated execution path.

## Project references

- [Architecture](ARCHITECTURE.md) describes code boundaries and data flow.
- [Testing](TESTING.md) records local checks and their limits.
- [Glossary](CONTEXT.md) defines the shared vocabulary.
- [Benchmarks](benchmarks/README.md) records the provisional retrieval diagnostic.
- Files under `plans/` are historical proposals, not current implementation status.

## License and contributions

The code is [MIT licensed](LICENSE). The dataset and generated indexes are excluded and have separate permissions; see [NOTICE](NOTICE). Read [CONTRIBUTING.md](CONTRIBUTING.md) for development checks and [SECURITY.md](SECURITY.md) for private vulnerability reporting. Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
