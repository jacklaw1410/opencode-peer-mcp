# Testing

## Prerequisites

- Bun canary build (`bun upgrade --canary`).
- `opencode` on `PATH` for integration and eval tests.

## Commands

| Command                    | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `bun install`              | Install dependencies and configure Git hooks.                      |
| `bun run build`            | Type-check and emit `dist/`.                                       |
| `bun run test`             | Unit tests.                                                        |
| `bun run typecheck`        | Type-check source and tests.                                       |
| `bun run lint`             | Lint with Bun.                                                     |
| `bun run format:check`     | Check formatting.                                                  |
| `bun run format`           | Format files.                                                      |
| `bun run test:integration` | Build, start two fixture OpenCode servers, run integration specs.  |
| `bun run evals`            | Build and run Playwright-based MCP evals. See [evals](./evals.md). |

## Unit tests

Cover config loading, auth resolution, HTTP retries and bounds, permission decisions, audit logging, peer service operations, and MCP tool registration.

## Integration tests

`tests/integration` starts two OpenCode servers using fixture config and credentials, then exercises every MCP tool through a real client. They require `opencode` on `PATH`.

## Evals

Evals are scenario-based model evaluations, not ordinary unit or integration tests. Run them with `bun run evals` and see [docs/evals.md](./evals.md) for setup, environment variables, and baseline workflow.

## Pre-commit hook

The hook runs `bun fmt --staged`, `bun lint --staged --fix`, and `bun check`. Run commits with the canary `bun` first on `PATH`.
