# Plan: opencode-peer-mcp

## Identity and scope

- Repo name: `opencode-peer-mcp`.
- Purpose: bridge OpenCode sessions across configured servers.
- Orchestration/chief is one consumer, not the server's purpose.
- Non-goal: scheduling, summarization, orchestration policy.

## Server configuration

- Servers are supplied by the user in a config file.
- Secrets come from env, referenced by name.
- `servers_list` only parrots config; no network discovery or health probing by default.

Example:

```yaml
servers:
  - id: local
    url: http://127.0.0.1:49374
    password_env: OPENCODE_LOCAL_PASSWORD
    auth: basic
  - id: remote
    url: http://127.0.0.2:49374
    password_env: OPENCODE_REMOTE_PASSWORD
    auth: basic
```

## Language/runtime

- TypeScript/Node.
- Reason: aligns with OpenCode ecosystem, existing MCP packages, OpenAPI/SDK types, and MCP TypeScript SDK.

## Session communication model

- OpenCode sessions do not natively communicate, even on the same server, except via subagents.
- This MCP is an external bridge only: discover, read, compare, and optionally interact with sessions.

## Auth

- Username is fixed to `opencode` in MVP; not exposed in config.
- Keep `username` as internal parameter for future spec changes.
- Internally support multiple auth modes (`basic`, `bearer`, `none`, future).
- MVP implements Basic auth only.

## Toolset phases

Phase 1 (read-only):

- `servers_list`
- `sessions_list(server, limit?, directory?)`
- `session_get(server, session_id)`
- `session_status(server, session_id)`
- `session_messages(server, session_id)`
- `session_diff(server, session_id)`
- `sessions_search(servers?, query, limit?)`
- `sessions_compare(server_a, session_a, server_b, session_b)`

Phase 2 (gated writes, MVP Option B):

- `session_create(server, directory, title?, agent?, model?)`
- `session_prompt(server, session_id, prompt)`
- `session_interrupt(server, session_id)`

Phase 3 (advanced bridging, if APIs allow):

- `session_transfer_context(...)`
- `session_fork_to_server(...)`
- `server_health`

## Write model

MVP: Option B

- Global gate: `OPENCODE_PEER_MCP_WRITE_ENABLED=true|false`.
- Per-session allowlist via config or tool argument.
- Write executes only if global gate true and target session is allowlisted.
- Audit logs from MVP, including denied attempts.
- Dummy per-session gate: simple allowlist, default empty.

Later: Option A

- Add per-call `confirm: true` on top of Option B.
- Final condition: global enabled + session allowlisted + `confirm=true`.

## Audit logs

- Append-only local log, e.g. `~/.opencode-peer-mcp/audit.log`.
- Fields: timestamp, server, session, tool, confirm value, allowlist decision, result.

## Security

- Secrets only in env.
- Read-only Phase 1.
- Allowlisted servers/tools.
- Timeouts, retries, bounded payloads.
- Audit logging.

## Testing

- Unit tests for config/http/models.
- Integration tests against running OpenCode server(s).
- OpenAPI conformance checks.
- Multi-server smoke tests.

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

## Architectural comparison

| Dimension               | `Traves-Theberge/opencode-mcp`  | `dmdboi/opencode-mcp`                | `opencode-peer-mcp`                                                   |
| ----------------------- | ------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Primary purpose         | Delegate coding tasks           | Spawn/manage sessions                | Bridge sessions across configured servers                             |
| Server model            | Single server                   | Single server                        | Multi-server config                                                   |
| Language/runtime        | TypeScript/Node                 | TypeScript/Node                      | TypeScript/Node                                                       |
| Transport               | stdio + HTTP                    | stdio                                | stdio first; HTTP optional                                            |
| Server discovery        | Implicit single server          | Implicit single server               | Config-only; `servers_list` parrots config                            |
| Auth                    | No Basic auth; local auto-start | Bearer only                          | Basic auth fixed user `opencode`; internal auth modes                 |
| Tool coverage           | 21 broad tools                  | 9 session/task tools                 | Focused peer/session read tools first; gated writes later             |
| Session identity        | Implicit single server          | Implicit single server               | `server_id/session_id`                                                |
| Read depth              | Session list only               | Messages + status + context estimate | Messages + status + diff + search + compare                           |
| Cross-server operations | None                            | None                                 | List configured servers, search across servers, compare sessions      |
| Native session comms    | No                              | No                                   | No; external bridge only                                              |
| Write model             | Full write/config               | run/fire/reply/check                 | MVP Option B + audit logs; later Option A `confirm`                   |
| Config management       | Mutates OpenCode config         | None                                 | Peer registry only; no OpenCode config mutation initially             |
| File/workspace tools    | Yes                             | No                                   | No; delegates to OpenCode                                             |
| Testing/conformance     | Docs/tests present              | Strong API/conformance tests         | Planned unit + integration + OpenAPI conformance + multi-server smoke |

## Milestones

1. Bootstrap repo and read-only single-server MCP.
2. Add multi-server config and Basic auth.
3. Add messages/status/diff/search/compare tools.
4. Add conformance and multi-server tests.
5. Add Option B gated writes + audit logs.
6. Add Option A per-call `confirm`.
7. Add optional advanced bridging features.
   " path="/home/jack/opencode-peer-mcp/PLAN.md
