# opencode-peer-mcp

Bridge OpenCode sessions across configured servers.

## Development

Use the Bun canary build. `bun lint` exists only in canary builds: `bun upgrade --canary`.

- `bun install`: installs dependencies and points Git at the committed `.githooks/` directory.
- `bun run test`: unit tests.
- `bun run test:integration`: starts two OpenCode servers. Requires `opencode` on `PATH`.
- `bun run typecheck`, `bun run lint`, `bun run format:check`: static checks.

The pre-commit hook runs `bun fmt --staged`, `bun lint --staged --fix`, and `bun check`. Run the commit with the canary `bun` first on `PATH`.

## Installation

```bash
bun install
bun run build
```

## Configuration

Servers are supplied in a YAML config file. Secrets are referenced by environment variable name, never stored directly.

Suggested default path: `~/.config/opencode-peer-mcp/servers.yaml`.

```yaml
servers:
  - id: local
    url: http://127.0.0.1:49374
    password_env: OPENCODE_LOCAL_PASSWORD
  - id: remote
    url: http://127.0.0.2:49374
    password_env: OPENCODE_REMOTE_PASSWORD
```

Set `OPENCODE_PEER_MCP_CONFIG` to the config file path and `OPENCODE_PEER_MCP_WRITE_ENABLED=true` to enable gated writes.

## Usage

Run the built server:

```bash
node dist/index.js
```

Or configure it as an MCP server in your MCP client using the deployment snippet below.

## MCP tools

`servers_list`, `sessions_list`, `session_get`, `session_status`, `session_messages`, `session_diff`, `sessions_search`, `sessions_compare`, `session_create`, `session_prompt`, `session_interrupt`, `session_schedule`.

## Write access

Write operations are disabled by default. To enable them:

1. Set `OPENCODE_PEER_MCP_WRITE_ENABLED=true`.
2. Allowlist target sessions in the config or via tool arguments.

Denied attempts are recorded in the audit log (`~/.opencode-peer-mcp/audit.log`).

## Troubleshooting

- Integration tests require `opencode` on `PATH`.
- If tools fail to connect, verify server URLs and environment variables in the config.
- Audit logs are written to `~/.opencode-peer-mcp/audit.log`.

## Deployment

```json
{
  "mcp": {
    "opencode-peer": {
      "type": "local",
      "command": ["node", "/path/to/opencode-peer-mcp/dist/index.js"],
      "environment": {
        "OPENCODE_PEER_MCP_CONFIG": "/home/jack/.config/opencode-peer-mcp/servers.yaml"
      }
    }
  }
}
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
