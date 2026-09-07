# Changelog

## Unreleased

### Added

- Added a read-only MCP server for searching historical audit references, reading bounded pages, and preparing cited context for host-model review.
- Added a functional finding reader that validates index metadata once and reuses SQLite statements for search and lookup.
- Added bounded excerpts, UTF-16 safe truncation, dataset and finding citations, response budgeting, and paged reference context.

### Changed

- Moved the local retrieval benchmark scripts, documentation, and historical result artifacts into the repository. The benchmark remains a local, provisional known-item diagnostic.
- Added build and typecheck coverage for the current application, retrieval code, and MCP sources.

### Documentation

- Added contribution, security, conduct, changelog, and MCP setup guidance.
- Preserved the MIT code license and documented separate dataset permissions.
- Added package metadata, an explicit distribution allowlist, a compiled reference CLI binary, build-before-pack, and pinned CI with dependency update configuration.
