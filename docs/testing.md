# Testing

## Prerequisites

- Bun canary build (`bun upgrade --canary`).
- `opencode` on `PATH` for integration tests and evals.

## Commands

| Command                    | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `bun install`              | Install dependencies and configure Git hooks.                     |
| `bun run build`            | Type-check and emit `dist/`.                                      |
| `bun run test`             | Unit tests.                                                       |
| `bun run typecheck`        | Type-check source and tests.                                      |
| `bun run lint`             | Lint with Bun.                                                    |
| `bun run format:check`     | Check formatting.                                                 |
| `bun run format`           | Format files.                                                     |
| `bun run test:integration` | Build, start two fixture OpenCode servers, run integration specs. |

## Unit tests

Cover config loading, auth resolution, HTTP retries and bounds, permission decisions, audit logging, peer service operations, and MCP tool registration.

## Integration tests

`tests/integration` starts two OpenCode servers and one fixture model server, then exercises every MCP tool through a real client. They require `opencode` on `PATH`.

Fixtures use ports `49421`, `49422`, and `49423`. The fixture root defaults to `/tmp/opencode-peer-mcp-integration`; override with `OPENCODE_PEER_MCP_INTEGRATION_ROOT`. The root must be under `/tmp` or `os.tmpdir()` and is deleted recursively before and after each run, so use a disposable path.

## Pre-commit hook

The hook runs `bun fmt --staged`, `bun lint --staged --fix`, `bun check`, and `bun check -p tsconfig.tests.json`. Run commits with the canary `bun` first on `PATH`.
