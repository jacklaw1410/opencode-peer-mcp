# Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers are `MAJOR.MINOR.PATCH` with optional pre-release identifiers.

## Public API

The public API consists of:

- MCP tool names, parameters, and result shapes.
- YAML config schema and environment variable names.
- Authentication modes and audit log record format.
- The `dist/index.js` entry point and its stdio transport behavior. Releases provide source plus `dist/` assets on the GitHub Release; there is no npm artifact. Build from source with `bun install && bun run build`.

Internal modules under `src/` are not public API.

## Version rules

- `MAJOR`: incompatible changes to the public API.
- `MINOR`: backward-compatible functionality; also deprecations.
- `PATCH`: backward-compatible bug fixes.
- Pre-releases use suffixes such as `-alpha.1` and are unstable.

While the major version is `0`, anything may change and the public API is not stable. Version `1.0.0` declares the stable API.

## Deprecations

When removing public API:

1. Update documentation to mark the feature deprecated.
2. Release a `MINOR` version with the deprecation in place.
3. Remove the feature only in a later `MAJOR` version (or any version while major is `0`).

## Changelog

Every release has a curated entry in `CHANGELOG.md`. Entries use Added, Changed, Deprecated, Removed, Fixed, and Security categories and list breaking changes explicitly.
