# Troubleshooting

## Config not found

Symptom: `opencode-peer-mcp: config not found at ...; starting with no servers`.

Fix: set `OPENCODE_PEER_MCP_CONFIG` or place the file at `~/.config/opencode-peer-mcp/servers.yaml`.

## Unknown server

Symptom: `Unknown server: <id>`.

Fix: check the `id` in the config and pass that exact value as the `server` argument.

## Startup fails with missing environment variable

Symptom: `Environment variable "..." is not set for server "..."`.

Fix: set the referenced variable in the process that launches the MCP server. One missing secret aborts startup for all servers.

## Write denied

Symptom: `Write denied: writes disabled` or `Write denied: session not allowlisted`.

Fix: set `OPENCODE_PEER_MCP_WRITE_ENABLED=true` (exact lowercase string), then add the session id or `*` to the server allowlist. `session_create` needs the `create` token or `*`. You can also pass `allowed: true` on the tool call, but that bypasses the allowlist; withhold it from untrusted clients. Denials are recorded in the audit log.

## Scheduled prompt did not fire

`session_schedule` is in-process and fire-and-forget. It does not survive a restart and is not re-checked against the write gate when the timer fires. Use OpenCode automations for recurring or durable work.

## Response exceeds limit

Symptom: `Response exceeds 5242880 bytes`.

Fix: reduce requested `limit`, narrow the query, or inspect the session directly on the OpenCode server.

## Integration tests fail

Fix: ensure `opencode` is on `PATH`. Fixtures use disposable directories under `/tmp` (override with `OPENCODE_PEER_MCP_INTEGRATION_ROOT`) and fixed ports `49421`–`49423`. The release workflow sets `OPENCODE_PASSWORD` for fixture servers.

## Audit log location

Default: `~/.opencode-peer-mcp/audit.log`. Override with `OPENCODE_PEER_MCP_AUDIT_LOG`.
