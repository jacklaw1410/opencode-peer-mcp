# Configuration

## Config file

The bridge reads a YAML file. Default path: `~/.config/opencode-peer-mcp/servers.yaml`. Override with `OPENCODE_PEER_MCP_CONFIG`.

If the file does not exist, the bridge starts with no servers and logs a warning to stderr. Duplicate server ids are rejected.

## Server fields

| Field          | Required | Description                                                                       |
| -------------- | -------- | --------------------------------------------------------------------------------- |
| `id`           | yes      | Stable server identifier used by tools.                                           |
| `url`          | yes      | Base URL of the OpenCode server.                                                  |
| `password_env` | no       | Environment variable holding the Basic auth password.                             |
| `token_env`    | no       | Environment variable holding the Bearer token.                                    |
| `auth`         | no       | Explicit mode: `basic`, `bearer`, or `none`.                                      |
| `timeout_ms`   | no       | Per-request timeout; defaults to `15000`.                                         |
| `allowlist`    | no       | Session ids allowed for writes; `*` allows all. `create` allows session creation. |

Example:

```yaml
servers:
  - id: local
    url: http://127.0.0.1:49374
    auth: none
    timeout_ms: 10000
    allowlist:
      - '*'
  - id: remote_1
    url: http://127.0.0.2:49374
    token_env: OPENCODE_REMOTE_TOKEN
    auth: bearer
  - id: remote_2
    url: http://127.0.0.3:49374
    password_env: OPENCODE_LOCAL_PASSWORD
    auth: basic
```

## Authentication

If `auth` is omitted, the mode is inferred: `password_env` selects `basic`, `token_env` selects `bearer`, otherwise `none`. Basic auth uses a fixed username of `opencode`. Secrets are read from the environment at startup; missing variables are fatal for that server.

Explicit `auth` is recommended. Making the field required is tracked in #35.

## Environment variables

| Variable                          | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `OPENCODE_PEER_MCP_CONFIG`        | Config file path.                                             |
| `OPENCODE_PEER_MCP_WRITE_ENABLED` | Set to `true` to enable the global write gate.                |
| `OPENCODE_PEER_MCP_AUDIT_LOG`     | Audit log path; defaults to `~/.opencode-peer-mcp/audit.log`. |

## Write access

To allow writes:

1. Set `OPENCODE_PEER_MCP_WRITE_ENABLED=true`.
2. Add the target session id to the server allowlist, use `*`, or pass `allowed: true` on the write tool call. For `session_create`, allowlist `create` instead.

Denied writes are recorded in the audit log and return an error to the MCP client.
