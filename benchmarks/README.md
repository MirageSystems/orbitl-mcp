# Retrieval diagnostic

This benchmark tests whether a finding's title retrieves that finding's body. It establishes a reproducible lexical baseline. It does not measure audit accuracy or improvement in reviewer decisions.

## Method

The corpus has 23,625 records and 23,622 distinct full texts. Exact duplicates are removed. A deterministic SHA-256 ordering selects 200 titles from findings with unique descriptions at least 50 characters long. Titles and the dedicated PoC field are excluded from the index. Narrative fields may still contain code.

Queries use unique, lowercased non-stopword title terms with OR matching. SQLite uses FTS5's default tokenizer and BM25, with finding ID breaking ties. The TypeScript command applies the same query preparation and returns validated narrative payloads. MiniSearch used its own tokenizer and ranking, so engine comparisons are not isolated algorithm tests.

Each variant runs one first pass and three warm repeats, sequentially. Warm timings exclude corpus loading, indexing, process startup, and model or network calls. The first pass is not a controlled cold OS-cache measurement. Results come from one machine and one run per final artifact.

## Results

| Implementation                                      | Top 1 | Top 5 | Top 10 | Warm p95 |
| --------------------------------------------------- | ----: | ----: | -----: | -------: |
| Python SQLite, descriptions                         |   56% | 70.5% |    75% |  5.90 ms |
| Python SQLite, descriptions and recommendations     |   60% |   76% |    80% |  6.75 ms |
| TypeScript MiniSearch trial                         | 52.5% |   70% |  72.5% | 13.02 ms |
| TypeScript SQLite, descriptions and recommendations |   60% |   76% |    80% |  6.61 ms |

The TypeScript SQLite run built its database in about 0.74 seconds and opened it in about 0.11 ms. Its 111.4 MiB database includes full narrative payloads as well as the text index; the Python timing baseline stores only indexed fields. The final TypeScript benchmark ran on Node 24.0.0 with SQLite 3.49.1. Process RSS after the TypeScript build was about 370.0 MiB, including the loaded corpus and benchmark data. This is not the memory footprint of a fresh query process.

The MiniSearch trial required about 3.9 seconds to build and about 499.3 MiB process RSS after construction. The final implementation uses SQLite. The retained trial results are historical evidence, not a dependency or a claim about all workloads.

## MCP process measurements

The compiled MCP server was measured on the same Node 24.0.0 runtime and 200-query sample through an official SDK v2 stdio client. Three sequential starts took 75.1 to 81.2 ms to initialize, or 80.8 to 93.9 ms including the first search. The first process then handled 600 sequential search calls across three passes.

Warm end-to-end search latency was 3.56 ms p50 and 8.17 ms p95. This includes protocol serialization, schema validation, SQLite lookup, payload parsing, and bounded context assembly. The largest encoded tool result was 48,334 bytes. Top-5 and top-10 retrieval remained 76% and 80%; all 200 ranks matched the direct reader.

These are local process measurements with uncontrolled OS caches. They contain no model call or network latency and do not establish production latency. The host's model generation time must be measured separately.

## Reproduce

From the repository root (`orbitl-mcp`). The default dataset path is the workspace input `../audit-findings.parquet`:

```bash
uv run --script benchmarks/retrieval_baseline.py
```

Export the corpus using the repository README, then run from the repository root:

```bash
pnpm exec tsx scripts/benchmark-retrieval.ts .orbitl/findings.json benchmarks/results.json benchmarks/typescript-sqlite-results.json
pnpm build
pnpm exec tsx scripts/benchmark-mcp.ts .orbitl/findings.sqlite .orbitl/findings.json benchmarks/results.json benchmarks/mcp-results.json
```

- `results.json` contains the Python diagnostic, dataset identity, sample IDs, ranks, versions, and timings.
- `typescript-sqlite-results.json` contains the direct TypeScript reader measurements.
- `mcp-results.json` contains MCP startup, query timings, response sizes, and ranks. Both TypeScript artifacts record implementation, harness, and dependency-lock hashes.
- `typescript-results.json` preserves the discarded MiniSearch trial. Its implementation is no longer shipped.

Generated outputs replace the corresponding result files when rerun. Python needs `uv`; its isolated dependency is pinned to DuckDB 1.5.5. The final TypeScript runtime uses Node's built-in SQLite API. See the [Node SQLite documentation](https://nodejs.org/api/sqlite.html) for runtime details.

## Limits and next evaluation

The title and expected body come from the same report. Shared wording can inflate retrieval performance. Another relevant finding counts as a miss if the original finding is absent, so this is known-item retrieval rather than semantic relevance. Near duplicates and project overlap are not excluded.

The sample was used to choose an implementation and is therefore a development benchmark. It is not an untouched acceptance set. There are no independent human relevance judgments, audit verdicts, or model comparisons in these results.

BTC manual validation is pending. A later evaluation needs independently validated dispositions, project-level exclusions, fixed source revisions, and a comparison of assessment with and without references. Increased assertiveness alone is not success.
