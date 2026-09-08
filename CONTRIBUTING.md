# Contributing

Keep changes focused on the behavior they are meant to change, and read `README.md`, `ARCHITECTURE.md`, and `TESTING.md` before editing.

## Development setup

Use Node.js 24 or newer and pnpm 9.15.9.

```bash
pnpm install --frozen-lockfile
```

Use strict TypeScript and prefer small functions with readonly data in the retrieval and MCP code. Keep filesystem, database, and protocol operations at explicit boundaries. Tests use local fixtures and disposable temporary files. The reference server makes no model or network calls.

## Checks

Run the relevant checks before opening a change:

```bash
pnpm build
pnpm typecheck
pnpm test
```

Retrieval changes should also pass `pnpm test:retrieval`. Describe the checks you ran and any live or dataset-dependent checks you did not run.

## Data and credentials

Do not commit `audit-findings.parquet`, private reports, generated findings datasets, SQLite indexes, `.orbitl/` data, credentials, private keys, seed phrases, mnemonics, or wallet files. Treat imported report text and generated findings as untrusted data. Preserve source identity and explain any uncertainty about historical references.

Benchmark claims must come from a measured local run. Keep the dataset identity, sampled queries, implementation hash, and result artifact together, and label provisional results as provisional. Do not present a planned or partial benchmark as a measurement.

In a pull request, explain the resulting behavior, validation, and any known limit that affects review. Keep unrelated formatting and dependency changes out of the change.
