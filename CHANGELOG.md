# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-26

### Added

- Read-only MCP tools for listing configured servers and sessions, reading session details, status, messages, diffs, cross-server search, and comparison.
- Gated write tools for creating sessions, prompting, interrupting, and scheduling prompts.
- YAML server configuration with environment-referenced secrets, Basic/Bearer/none auth, per-server timeouts, and write allowlists.
- Append-only JSON audit log for write attempts, including denials.
- Reference documentation for architecture, configuration, tools, testing, deployment, evals, releasing, versioning, and troubleshooting.
- GitHub Actions release workflow for tagged releases.

### Changed

- Development toolchain moved to Bun built-ins.

[Unreleased]: https://github.com/jacklaw1410/opencode-peer-mcp/compare/main...HEAD
