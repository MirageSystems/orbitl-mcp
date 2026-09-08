# Changelog

## Unreleased

### Added

- Added a read-only MCP server for searching historical audit references, reading bounded pages, and preparing cited context for host-model review.
- Added a functional finding reader that validates index metadata once and reuses SQLite statements for search and lookup.
- Added bounded excerpts, Unicode-safe truncation, dataset and finding citations, response budgeting, and paged reference context.
- Added an original synthetic demo corpus for trying the MCP without external audit data.

### Changed

- Moved the local retrieval benchmark scripts, documentation, and historical result artifacts into the repository. The benchmark remains a local, provisional known-item diagnostic.
- Added clean builds and typecheck coverage for retrieval, MCP, tests, and benchmark sources.

### Documentation

- Added contribution, security, conduct, changelog, and MCP setup guidance.
- Preserved the MIT code license and documented separate dataset permissions.
- Added package metadata, an explicit distribution allowlist, a compiled reference CLI binary, build-before-pack, and pinned CI with dependency update configuration.

### Removed

- Removed the Sei CLI, Cloudflare client, contract heuristics, wallet integrations, transaction tools, terminal UI, provider configuration, and obsolete plans.
- Removed their dependencies. `orbitl` now starts the reference MCP; `orbitl-findings` remains the offline index command.
