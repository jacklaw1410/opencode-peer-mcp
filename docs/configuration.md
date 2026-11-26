# Configuration

## Config file

The bridge reads a YAML file. Default path: `~/.config/opencode-peer-mcp/servers.yaml`, derived from `$HOME`. If `HOME` is unset, the path becomes `/.config/opencode-peer-mcp/servers.yaml`. Override with `OPENCODE_PEER_MCP_CONFIG`.

If the file does not exist, the bridge starts with no servers and logs a warning to stderr. Duplicate server ids are rejected.

## Server fields

| Field          | Required | Description                                                                                           |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `id`           | yes      | Stable server identifier used by tools.                                                               |
| `url`          | yes      | Base URL of the OpenCode server.                                                                      |
| `password_env` | no       | Environment variable holding the Basic auth password.                                                 |
| `token_env`    | no       | Environment variable holding the Bearer token.                                                        |
| `auth`         | yes      | Explicit mode: `basic`, `bearer`, or `none`.                                                          |
| `timeout_ms`   | no       | Per-request timeout; defaults to `15000`.                                                             |
| `allowlist`    | no       | Session ids allowed for writes; `*` allows all sessions and create. `create` allows session creation. |

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
    password_env: OPENCODE_REMOTE_PASSWORD
    auth: basic
```

## Authentication

`auth` is required on every server entry. `basic` requires `password_env`; `bearer` requires `token_env`; `none` ignores both. `none` is typically used when adding the local OpenCode server as a target, since a local server needs no credentials. Basic auth uses the fixed username `opencode`; the config schema does not expose a username field.

Secrets are read from the environment at startup. A missing referenced variable aborts startup for all servers. A server entry without `auth` is rejected.

## Environment variables

| Variable                          | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `OPENCODE_PEER_MCP_CONFIG`        | Config file path.                                             |
| `OPENCODE_PEER_MCP_WRITE_ENABLED` | Set to the exact lowercase string `true` to enable writes.    |
| `OPENCODE_PEER_MCP_AUDIT_LOG`     | Audit log path; defaults to `~/.opencode-peer-mcp/audit.log`. |

## Write access

To allow writes:

1. Set `OPENCODE_PEER_MCP_WRITE_ENABLED=true` (exact lowercase string).
2. Add the target session id to the server allowlist, use `*`, or pass `allowed: true` on the write tool call. For `session_create`, allowlist `create` or use `*`.

`allowed: true` is caller-supplied and bypasses the allowlist, so the allowlist is not a security boundary against clients that can set it. Denied writes are recorded in the audit log and return an error to the MCP client.
