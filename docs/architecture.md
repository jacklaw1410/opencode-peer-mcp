# Architecture

This project is an external bridge between an MCP client and one or more OpenCode servers. It does not modify OpenCode configuration and does not provide native session-to-session communication.

## Components

- **Bootstrap** (`src/index.ts`): loads config, constructs the service and MCP server, connects a stdio transport.
- **Config loader** (`src/config.ts`): reads YAML, validates it, resolves duplicate ids, and produces resolved server records.
- **Auth resolver** (`src/auth.ts`): converts secret references into runtime credentials. Supports `basic`, `bearer`, and `none`.
- **HTTP client** (`src/http.ts`): calls the OpenCode OpenAPI over `fetch`; applies timeouts, bounded GET retries, and a 5 MiB response limit.
- **Peer service** (`src/service.ts`): implements the bridge operations and owns the write gate and audit logging.
- **Permission gate** (`src/permission.ts`): evaluates global write enablement plus session allowlisting.
- **MCP server** (`src/server.ts`): registers tools, parameter schemas, and read/write hints.
- **Logger** (`src/logger.ts`): appends JSON audit records to a local file.

## Trust boundaries

1. **MCP client ↔ bridge**: stdio JSON-RPC. The client supplies tool arguments. All arguments are validated with Zod before reaching the service.
2. **Bridge ↔ OpenCode server**: HTTP with optional Basic or Bearer auth. Credentials come from environment variables named in the config; they are never stored in the config file.
3. **Write boundary**: every mutating tool passes through `evaluatePermission`. A denied write is logged and never sent to OpenCode.

## Server model

Servers are declared only in config. `servers_list` reports configured servers; there is no network discovery or health probing. Each server has a stable `id`, a base `url`, an auth mode, a timeout, and an allowlist.

## Session identity

A session is addressed as `server_id` plus `session_id`. Cross-server operations (`sessions_search`, `sessions_compare`) carry the server id explicitly in their results.

## Write model

Writes are disabled by default. A write executes only when:

1. `OPENCODE_PEER_MCP_WRITE_ENABLED=true`; and
2. the target session is in the server allowlist, the allowlist contains `*`, or the caller passes `allowed: true`.

`session_create` uses the literal allowlist entry `create` instead of a session id. `session_schedule` registers an in-process timer; it is fire-and-forget and does not survive a bridge restart.

## Audit log

All write attempts — allowed, denied, successful, or failed — append a JSON line to `OPENCODE_PEER_MCP_AUDIT_LOG` or `~/.opencode-peer-mcp/audit.log`. Entries include timestamp, level, server, session, tool, allowlist decision, and result.
