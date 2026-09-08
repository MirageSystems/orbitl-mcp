# Security

## Scope

Orbitl is a read-only MCP for local historical audit references. It searches a local SQLite index, returns bounded excerpts with dataset and finding citations, provides paged description or recommendation text, and prepares a prompt that keeps supplied source evidence separate from historical context. It does not scan a contract, validate a current finding, or execute reference code. Historical text is untrusted data.

The dataset hash identifies the recorded source snapshot. It does not authenticate later edits to a corpus or index. Reviewers should compare historical prerequisites with the reviewed source and keep the finding ID and dataset hash with any citation.

Orbitl requires no credentials. The MCP host may send supplied evidence and retrieved references to its model provider. Configure that host according to the confidentiality requirements of the review. Do not provide private keys, seed phrases, or wallet credential files.

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository when that feature is available. If it is unavailable, publish no sensitive details. Request a private reporting channel through an existing repository contact route, then share reproduction steps and affected data only through that private channel.

Include the affected component, a concise description, reproduction steps that do not expose private material, and the impact you observed. Do not include credentials, private reports, full datasets, or index files in a public issue or pull request.

This document describes the reporting route and scope. It does not promise a response time, a severity classification, or a particular remediation outcome.
