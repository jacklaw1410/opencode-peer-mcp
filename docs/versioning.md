# Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers are `MAJOR.MINOR.PATCH` with optional pre-release identifiers. [semantic-release](https://semantic-release.gitbook.io/semantic-release/) derives versions from Conventional Commits.

## Public API

The public API consists of:

- MCP tool names, parameters, and result shapes.
- YAML config schema and environment variable names.
- Authentication modes and audit log record format.
- The `dist/index.js` entry point and its stdio transport behavior.

Internal modules under `src/` are not public API. Releases publish the npm package (`dist/`) and a GitHub Release with `dist/` assets. Build from source with `bun install && bun run build`.

## Version rules

- `fix:` commits produce `PATCH` releases.
- `feat:` commits produce `MINOR` releases.
- `BREAKING CHANGE:` or `!` in the commit type produces `MAJOR` releases.
- Pre-releases use suffixes such as `-alpha.1` and are unstable.

While the major version is `0`, anything may change and the public API is not stable. Version `1.0.0` declares the stable API.

## Deprecations

When removing public API:

1. Update documentation to mark the feature deprecated.
2. Release a `MINOR` version with the deprecation in place.
3. Remove the feature only in a later `MAJOR` version (or any version while major is `0`).

## Changelog

`CHANGELOG.md` is generated automatically by semantic-release from Conventional Commits. Do not hand-edit version sections; only the `Unreleased` heading is managed by the tool.
