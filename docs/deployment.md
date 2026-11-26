# Deployment

## Build

```bash
bun install
bun run build
```

The built entry point is `dist/index.js`. It communicates over stdio, so it must be launched by an MCP client.

## MCP client configuration

```json
{
  "mcp": {
    "opencode-peer": {
      "type": "local",
      "command": ["node", "/path/to/opencode-peer-mcp/dist/index.js"],
      "environment": {
        "OPENCODE_PEER_MCP_CONFIG": "/home/jack/.config/opencode-peer-mcp/servers.yaml",
        "OPENCODE_PEER_MCP_WRITE_ENABLED": "false"
      }
    }
  }
}
```

Set `OPENCODE_PEER_MCP_WRITE_ENABLED` to `"true"` only when write access is intended. Secrets belong in the environment of the launched process, referenced by name in the config file.

## Filesystem

| Path        | Purpose                                                               |
| ----------- | --------------------------------------------------------------------- |
| Config file | Server registry. Default: `~/.config/opencode-peer-mcp/servers.yaml`. |
| Audit log   | Append-only write record. Default: `~/.opencode-peer-mcp/audit.log`.  |

The audit log directory is created automatically. Ensure the launching user can write to it.

## Operational notes

- The bridge does not start or health-check OpenCode servers.
- Scheduled prompts are in-process and lost on restart. Use OpenCode automations for recurring work.
- HTTP responses are limited to 5 MiB; GET requests retry twice on 5xx responses.
- `node dist/index.js` exits with an error if config resolution fails.
