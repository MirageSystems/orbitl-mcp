# MCP setup

Orbitl serves historical audit references from an existing local SQLite index. Use it during review of an existing concern, including consolidation of another audit report. The host model assesses the evidence and returned references. Orbitl does not run that model.

## Prepare the server

Install Node.js 24 or newer and pnpm 9.15.9. Clone the repository, install its locked dependencies, and build:

```bash
git clone https://github.com/MirageSystems/orbitl-mcp.git
cd orbitl-mcp
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Start with the [synthetic demo](../examples/README.md), then use the [reference data instructions](../README.md) with a dataset you have permission to use. External audit data and generated indexes are excluded from the repository and package. Keep your corpus and index in `.orbitl/` or another private local directory.

The client starts the compiled server with this command:

```bash
node /absolute/repo/dist/mcp/cli.js --index /absolute/path/findings.sqlite
```

Use absolute paths. Desktop clients may have a different working directory and PATH from your shell. If needed, replace `node` with the absolute path printed by `command -v node`. The process stays attached to the client's stdio connection. Startup errors and diagnostics go to stderr.

## Codex

Register the command with the Codex CLI:

```bash
codex mcp add orbitl -- node /absolute/repo/dist/mcp/cli.js --index /absolute/path/findings.sqlite
codex mcp get orbitl --json
codex mcp list
```

The first command changes your Codex MCP configuration. Substitute your local paths before running it. The equivalent TOML entry is:

```toml
[mcp_servers.orbitl]
command = "node"
args = ["/absolute/repo/dist/mcp/cli.js", "--index", "/absolute/path/findings.sqlite"]
```

Restart the client after changing its configuration. In the Codex CLI, `/mcp` shows connected servers. See the official [Codex MCP documentation](https://developers.openai.com/codex/mcp) for configuration scope and host controls.

## Other stdio clients

For clients that accept an `mcpServers` JSON configuration:

```json
{
  "mcpServers": {
    "orbitl": {
      "command": "node",
      "args": [
        "/absolute/repo/dist/mcp/cli.js",
        "--index",
        "/absolute/path/findings.sqlite"
      ]
    }
  }
}
```

Use the configuration location documented by your client. A container or remote host needs the compiled server, Node runtime, and index available inside that environment. A path on your laptop is not automatically accessible there.

Your existing review tool can remain the first pass in the workflow. Connect Orbitl to the MCP host that consolidates the reports, alongside any installed security-review skill.

## Review flow

1. Keep the existing concern and its source evidence in the review's current report or disposition ledger.
2. Call `search_audit_references` with a short description of that concern. For example, `{"query":"rounding accounting","limit":5}`.
3. Read relevant details with `get_audit_reference`, passing a returned `id`. Choose `section` as `description` or `recommendation`; follow `nextOffset` for another page.
4. Compare the historical prerequisites with the supplied source evidence. Keep the current concern unresolved when evidence is insufficient.
5. Cite `orbitl:<dataset-sha256>:<finding-id>` alongside source evidence and the reason for the proposed disposition. The human reviewer validates the final report.

Hosts that support MCP prompts can request `review_with_references` with a `query` and optional `evidence`. It prepares five references and assessment instructions. It neither calls a model nor updates a report. The `orbitl://index` resource reports the dataset hash, indexed fields, and retrieval method.

Search returns at most ten excerpts. The encoded tool result is capped at 64 KiB, including structured content and its text copy, before the JSON-RPC envelope. The prompt result uses the same budget; shorten supplied evidence if it exceeds that limit. Individual reference pages contain at most 8,000 Unicode code points. Query and evidence input limits use JavaScript string length. These bounds limit context size; they do not guarantee relevance.

The server makes no model or network calls. Your MCP host may send returned text and supplied evidence to its model provider. Choose host settings that match the confidentiality requirements of the review.

## Troubleshooting

- **Index cannot be opened:** check the absolute path, file permissions, and whether index creation completed. The server will not create or replace an index.
- **FTS5 is unavailable:** check the Node executable used by the client. Node 22.13.0 is unsupported; tests cover Node 24.0.0 and 26.7.0.
- **No references returned:** use a short query containing words likely to occur in a historical description or recommendation. Retrieval is lexical and has no embedding model.
- **Reference output is too large:** request a shorter page with `length` and continue with `nextOffset`.
- **Tools are missing:** confirm the client starts `dist/mcp/cli.js` after a successful build. Both `orbitl` and `orbitl-mcp` start the reference server; `orbitl-findings` manages the offline index.

See [testing](../TESTING.md) for local protocol checks and [security](../SECURITY.md) for the trust boundaries.
