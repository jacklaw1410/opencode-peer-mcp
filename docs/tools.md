# MCP tools

All tools return JSON. Errors set `isError: true` and include a message. Tools marked **read-only** never mutate OpenCode state. Tools marked **write** pass through the write gate.

## Server tools

| Tool           | Parameters | Description                                                              |
| -------------- | ---------- | ------------------------------------------------------------------------ |
| `servers_list` | none       | List configured servers with id, url, auth mode, timeout, and allowlist. |
| `server_get`   | `server`   | Get one configured server.                                               |

## Session read tools

| Tool               | Parameters                                                                                                          | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `sessions_list`    | `server`, `limit?`, `directory?`, `order?`, `search?`, `archived?`, `parent_id?`, `cursor?`, `project?`, `subpath?` | List sessions on one server. `limit` is 1–100.                                  |
| `session_get`      | `server`, `session_id`                                                                                              | Get a session record.                                                           |
| `session_status`   | `server`, `session_id`                                                                                              | Derive `busy`/`idle` from session timing data.                                  |
| `session_messages` | `server`, `session_id`, `limit?`, `order?`, `cursor?`, `type?`                                                      | Get messages. `limit` is 1–200.                                                 |
| `session_diff`     | `server`, `session_id`, `from?`, `to?`, `context?`                                                                  | Get structured diffs for a turn range.                                          |
| `sessions_search`  | `query`, `servers?`, `limit?`                                                                                       | Search across all configured servers, or a subset. `limit` is per server, 1–50. |
| `sessions_compare` | `server_a`, `session_a`, `server_b`, `session_b`                                                                    | Return two sessions side by side.                                               |

## Write tools

Each write tool accepts `allowed?: boolean` to explicitly allow the operation when the session is not allowlisted.

| Tool                | Parameters                                                      | Description                                                                                                   |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `session_create`    | `server`, `directory`, `title?`, `agent?`, `model?`, `allowed?` | Create a session. `model` is `{ providerID, id, variant? }`. Allowlist token: `create`.                       |
| `session_prompt`    | `server`, `session_id`, `prompt`, `wait_for?`, `allowed?`       | Send a prompt. `wait_for` is 1000–300000 ms; when set, waits for idle and returns the last assistant message. |
| `session_interrupt` | `server`, `session_id`, `allowed?`                              | Interrupt a session. Destructive hint is set.                                                                 |
| `session_schedule`  | `server`, `session_id`, `prompt`, `delay`, `allowed?`           | Send a prompt after a delay. Duration like `30s` or ISO timestamp. Max one hour. Not persistent.              |

All write attempts are recorded in the audit log, including denials.
