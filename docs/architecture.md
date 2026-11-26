# Architecture

This project is an external bridge between an MCP client and one or more OpenCode servers. It does not modify OpenCode configuration and does not provide native session-to-session communication.

## Components

- **Bootstrap** (`src/index.ts`): loads config, constructs the service and MCP server, connects a stdio transport. Startup exits with code 1 if config resolution fails.
- **Config loader** (`src/config.ts`): reads YAML, validates it, rejects duplicate ids, and produces resolved server records.
- **Auth resolver** (`src/auth.ts`): converts secret references into runtime credentials. Supports `basic`, `bearer`, and `none`. Basic auth uses the fixed username `opencode`; the config schema does not expose a username field.
- **HTTP client** (`src/http.ts`): calls the OpenCode OpenAPI over `fetch`. Applies timeouts, retries GET requests on 5xx responses and network/timeout errors, and caps responses at 5 MiB. Without `content-length`, the cap uses `text.length` (UTF-16 code units), so multi-byte JSON can exceed 5 MiB on the wire.
- **Peer service** (`src/service.ts`): implements the bridge operations and owns the write gate and audit logging.
- **Permission gate** (`src/permission.ts`): evaluates global write enablement plus session allowlisting.
- **MCP server** (`src/server.ts`): registers tools, parameter schemas, and read/write hints.
- **Logger** (`src/logger.ts`): appends JSON audit records to a local file.

## Trust boundaries

1. **MCP client ↔ bridge**: stdio JSON-RPC. The client supplies tool arguments. All arguments are validated with Zod before reaching the service.
2. **Bridge ↔ OpenCode server**: HTTP with optional Basic or Bearer auth. Credentials come from environment variables named in the config; they are never stored in the config file.
3. **Write boundary**: mutating tools pass through `evaluatePermission`. A denied write is logged and never sent to OpenCode.

## Server model

Servers are declared only in config. `servers_list` lists configured servers; there is no network discovery or health probing. Each server has a stable `id`, a base `url`, an auth mode, a timeout, and an allowlist.

## Session identity

A session is addressed as `server_id` plus `session_id`. Tools carry the server id in the `server` parameter. Cross-server operations (`sessions_search`, `sessions_compare`) include the server id in their results.

## Write model

Writes are disabled by default. A write executes only when:

1. `OPENCODE_PEER_MCP_WRITE_ENABLED=true`; and
2. the target session is in the server allowlist, the allowlist contains `*`, or the caller passes `allowed: true`.

`session_create` uses the literal allowlist entry `create`; `*` covers create as well. `allowed` is a caller-supplied argument that bypasses the allowlist, so the allowlist is not a security boundary against clients that can supply it.

`session_schedule` checks permission when the timer is registered. The timer callback does not re-check permission; disabling writes or editing the allowlist afterwards does not cancel a queued prompt. An invalid `delay` throws before any audit entry is written.

## Audit log

Allowed and denied write attempts are appended as JSON lines to `OPENCODE_PEER_MCP_AUDIT_LOG` or `~/.opencode-peer-mcp/audit.log`. Entries include `timestamp`, `level` (`info`, `warn`, or `error`), `server`, `session`, `tool`, `allowlistDecision`, and `result`.

Example:

```json
{
  "timestamp": "2026-11-22T12:00:00.000Z",
  "level": "warn",
  "server": "local",
  "session": "ses_123",
  "tool": "session_prompt",
  "allowlistDecision": "writes disabled",
  "result": "denied"
}
```
