# opencode-peer-mcp

Bridge OpenCode sessions across configured servers.

## Development

Use the Bun canary build. `bun lint` exists only in canary builds: `bun upgrade --canary`.

- `bun install`: installs dependencies and points Git at the committed `.githooks/` directory.
- `bun run test`: unit tests.
- `bun run test:integration`: starts two OpenCode servers. Requires `opencode` on `PATH`.
- `bun run typecheck`, `bun run lint`, `bun run format:check`: static checks.

The pre-commit hook runs `bun fmt --staged`, `bun lint --staged --fix`, and `bun check`. Run the commit with the canary `bun` first on `PATH`.
