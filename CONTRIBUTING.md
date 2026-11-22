# Contributing

Thanks for considering a contribution to `opencode-peer-mcp`.

## Development setup

- Use the Bun canary build (`bun upgrade --canary`).
- Install dependencies: `bun install`
- Run unit tests: `bun run test`
- Run integration tests: `bun run test:integration` (requires `opencode` on `PATH`)
- Type check: `bun run typecheck`
- Lint: `bun run lint`
- Format check: `bun run format:check`

The pre-commit hook runs `bun fmt --staged`, `bun lint --staged --fix`, and `bun check`.

## Coding standards

- TypeScript, ESM.
- Follow existing code style; run `bun run format` before committing.
- Keep changes focused and minimal.
- Add or update tests for behavior changes.

## Pull requests

- Open an issue first for significant changes.
- Keep PRs small and reviewable.
- Include tests and update docs when behavior changes.
- Ensure `bun run typecheck`, `bun run lint`, and `bun run test` pass.

## Commit messages

Use Conventional Commits (e.g. `feat:`, `fix:`, `docs:`, `test:`, `chore:`).
EOF
