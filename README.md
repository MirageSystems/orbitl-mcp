# Orbitl

**Bring audit history into the review.**

Orbitl is an open source MCP server for Web3 security references. Search past audit findings, read their descriptions and recommendations, and attach stable citations to an existing review concern.

Connect it to the review tools you already use. Your MCP host supplies the model and current source evidence; Orbitl supplies the historical context. The reviewer decides whether it applies.

- **Reuse your audit history.** Build a reference index from findings you have permission to use.
- **Keep retrieval local.** Orbitl needs no API key and makes no model or network calls.
- **Keep the evidence traceable.** Each reference carries its source, finding ID, and dataset identity.

## Try it

Use Node.js 24 or newer and pnpm 9.15.9. The included demo contains three synthetic references, so no external dataset is needed to try the server.

```bash
git clone https://github.com/MirageSystems/orbitl-mcp.git
cd orbitl-mcp
pnpm install --frozen-lockfile
pnpm build
mkdir -p .orbitl
pnpm findings --index .orbitl/demo.sqlite --build examples/demo-findings.json
pnpm findings --index .orbitl/demo.sqlite --query "rounding accounting"
```

Configure your MCP host to start this command with absolute paths:

```bash
node /absolute/repo/dist/mcp/cli.js --index /absolute/repo/.orbitl/demo.sqlite
```

For Codex:

```bash
codex mcp add orbitl -- node /absolute/repo/dist/mcp/cli.js --index /absolute/repo/.orbitl/demo.sqlite
```

Then call `search_audit_references` with `{"query":"rounding accounting","limit":5}`. See [MCP setup](docs/MCP-SETUP.md) for other stdio hosts and troubleshooting. Installed packages expose `orbitl` and `orbitl-mcp` as names for the same server.

## What the host gets

| Capability                | Purpose                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `search_audit_references` | Up to ten cited excerpts from historical descriptions and recommendations          |
| `get_audit_reference`     | Paged access to a finding's description or recommendation                          |
| `review_with_references`  | Assessment context for an existing concern, supplied evidence, and five references |
| `orbitl://index`          | Dataset identity and retrieval metadata                                            |

Citations use `orbitl:<dataset-sha256>:<finding-id>`. Follow `nextOffset` to read more of a long reference. The host can place that context beside current source evidence and propose a disposition for human review.

Orbitl uses SQLite FTS5 with BM25 ranking. It opens the index read-only. It does not scan contracts, execute reference content, or modify reports.

## Bring your own findings

Use the [demo corpus](examples/demo-findings.json) as a JSON format example. For the supported Parquet layout, the offline export helper requires Python 3.11 or newer and `uv`:

```bash
uv run --script scripts/export-findings.py /absolute/path/audit-findings.parquet .orbitl/findings.json
pnpm findings --index .orbitl/findings.sqlite --build .orbitl/findings.json
```

Export and index creation refuse to replace existing files. Generated files under `.orbitl/` stay out of version control. The helper omits the dedicated PoC field; narrative text may still contain code.

The same index supports direct local lookup:

```bash
pnpm findings --index .orbitl/findings.sqlite --query "rounding accounting" --limit 5
pnpm findings --index .orbitl/findings.sqlite --id 123
```

A built package also exposes `orbitl-findings` for these operations.

## Evidence and limits

Historical findings are reference material. Similar wording, historical severity, and lexical scores do not establish a defect in the current source. Compare prerequisites, cite current evidence, and leave unsupported conclusions unresolved.

Tool and prompt results are capped at 64 KiB before the JSON-RPC envelope. Reference pages contain at most 8,000 Unicode code points. The recorded dataset hash identifies the source snapshot; it does not authenticate later edits. Your MCP host may send returned text and supplied evidence to its model provider.

The current [benchmark](benchmarks/README.md) measures known-item retrieval. It does not establish better audit decisions. Results include reproducible code, sample, and dependency identities; human review-quality evaluation remains open.

## Development and license

```bash
pnpm typecheck
pnpm test
```

Read [Architecture](ARCHITECTURE.md), [Testing](TESTING.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md). Shared terms are defined in the [glossary](CONTEXT.md).

Code and the original synthetic demo are [MIT licensed](LICENSE). External audit datasets and imported reports retain their own rights and are not bundled or relicensed. See [NOTICE](NOTICE).
