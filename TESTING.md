# Verification

Use Node.js 24 or newer. Run from the repository root:

```bash
pnpm build
pnpm typecheck
pnpm test
```

`pnpm test` runs the retrieval and MCP protocol suites. The retrieval suite checks external corpus validation, duplicate IDs, placeholder normalization, provenance, body-only search, empty and malformed query text, result limits, excerpt truncation, persistent lookup, refusal to replace an existing index, read-only behavior, and rollback after a failed build.

The MCP suite starts the compiled stdio server through official SDK clients. It checks legacy and 2026-07-28 protocol negotiation, tool discovery, read-only annotations, output schemas, cited search results, Unicode paging, prompt retrieval, index metadata, invalid arguments, missing findings, response budgets, index immutability, missing-index failure, and protocol-only stdout. Fixtures are local and disposable.

The full TypeScript build covers the existing Sei application as well as retrieval and MCP entrypoints. It does not establish runtime correctness of RPC, Cloudflare, or WalletConnect integrations.

## Dataset diagnostic

The benchmark files and recorded results live under `benchmarks/`. The default source dataset remains a workspace input at `../audit-findings.parquet` and is not committed.

Run the Python baseline from the repository root:

```bash
uv run --script benchmarks/retrieval_baseline.py
```

After exporting the corpus as described in the README, run the TypeScript diagnostic:

```bash
pnpm exec tsx scripts/benchmark-retrieval.ts .orbitl/findings.json benchmarks/results.json benchmarks/typescript-sqlite-results.json
```

These commands replace their result JSON files. They measure known-item retrieval and local database timing. They do not include MCP process startup, protocol overhead, a model call, or network time. See the [benchmark record](benchmarks/README.md) for the method and limits.

The TypeScript SQLite result records 76% top-5 retrieval, 80% top-10 retrieval, and 6.61 ms warm p95 on its 200-query development sample. The benchmark was used to choose the implementation, shares wording between titles and bodies, lacks project-level exclusions, and has no independent relevance labels or audit verdicts. These figures do not establish semantic relevance, production latency, or better audit decisions.

Measure the compiled MCP process separately:

```bash
pnpm build
pnpm exec tsx scripts/benchmark-mcp.ts .orbitl/findings.sqlite .orbitl/findings.json benchmarks/results.json benchmarks/mcp-results.json
```

The final Node 24.0.0 run recorded 75.1 to 81.2 ms initialization across three starts and 8.17 ms warm p95 across 600 sequential tool calls. All 200 retrieval ranks matched the direct reader. This includes the local protocol path and context assembly. Model latency belongs to the MCP host and model provider. Orbitl's reference MCP makes no model call.

## Live checks

`pnpm dev check` calls a live RPC provider. Chat calls Cloudflare and may invoke other Sei tools. These checks are separate from local reference verification. Wallet connection and transaction execution are not retrieval tests.

No reference benchmark establishes that the heuristic safety score, mock transaction encoding, or static gas estimate is correct. No retrieval or MCP test establishes audit accuracy.

## Recorded checks

Node 22.13.0 failed because its bundled SQLite lacks FTS5 and is not supported. The full local dataset was exported and indexed, and the compiled reference CLI was checked against it.

On 2026-09-08, the complete TypeScript build and `pnpm typecheck` passed. All 13 retrieval and MCP tests passed on Node 24.0.0 and 26.7.0. The protocol tests include escaped control text, oversized metadata, tool-result budgets including both output representations, and oversized prompt rejection. Frozen-lockfile installation passed.

The npm archive contained 58 files and excluded datasets, indexes, maps, tests, and benchmark tooling. All three compiled binaries passed help checks, and the packaged reference CLI built and searched a disposable fixture. This smoke check reused installed dependencies and set binary executable permissions as an installer does; it was not a registry installation. Local Markdown links also passed. CI is configured for Node 24 and 26 on Linux. See [GitHub Actions](https://github.com/MirageSystems/orbitl-mcp/actions) for the current remote result. The recorded local checks ran on macOS. No live-provider, wallet, model, or human-verdict evaluation is recorded for this change.
