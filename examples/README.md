# Synthetic demo

`demo-findings.json` contains three original synthetic reference records for trying the CLI and MCP. They describe general review questions. They are not audit findings, vulnerabilities, or independently validated evidence about a real project.

The demo text is covered by the repository's MIT license. Its dataset identity is the SHA-256 of the compact UTF-8 JSON `findings` array, preserving field order and Unicode characters. It is separate from the external corpus used by the retrieval benchmark.

From the repository root:

```bash
mkdir -p .orbitl
pnpm findings --index .orbitl/demo.sqlite --build examples/demo-findings.json
pnpm findings --index .orbitl/demo.sqlite --query "rounding accounting"
```

Index creation refuses to replace an existing destination. Use an unused filename when trying another corpus.
