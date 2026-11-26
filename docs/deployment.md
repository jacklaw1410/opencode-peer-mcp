# Deployment

## Build

```bash
bun install
bun run build
```

The built entry point is `dist/index.js`. It communicates over stdio, so it must be launched by an MCP client.

## MCP client configuration

Add the server to your MCP client configuration (for OpenCode, `~/.config/opencode/opencode.json`):

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

The `environment` block must not contain secret values. It may set the config path and the write flag; secrets stay in the process environment and are referenced by name in the config file.

Set `OPENCODE_PEER_MCP_WRITE_ENABLED` to the exact lowercase string `"true"` only when write access is intended. Values such as `"True"`, `"1"`, or boolean `true` do not enable writes.

## Filesystem

| Path        | Purpose                                                               |
| ----------- | --------------------------------------------------------------------- |
| Config file | Server registry. Default: `~/.config/opencode-peer-mcp/servers.yaml`. |
| Audit log   | Append-only write record. Default: `~/.opencode-peer-mcp/audit.log`.  |

The audit log directory is created automatically. Ensure the launching user can write to it.

## Operational notes

- The bridge does not start or health-check OpenCode servers.
- Scheduled prompts are in-process and lost on restart. Use OpenCode automations for recurring work.
- HTTP responses are capped at 5 MiB. The cap uses `content-length` when present; otherwise it uses UTF-16 code-unit length, so multi-byte JSON can exceed 5 MiB on the wire. GET requests retry on 5xx responses, timeouts, and network errors.
- `node dist/index.js` exits with an error if config resolution fails.
