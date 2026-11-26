# MCP tools

Successful tool results are JSON. Errors set `isError: true` and return a plain-text message. Read-only tools never mutate OpenCode state. Write tools pass through the write gate.

## Server tools

| Tool           | Parameters | Description                                                              |
| -------------- | ---------- | ------------------------------------------------------------------------ |
| `servers_list` | none       | List configured servers with id, url, auth mode, timeout, and allowlist. |
| `server_get`   | `server`   | Get one configured server.                                               |

## Session read tools

| Tool               | Parameters                                                                                                          | Description                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sessions_list`    | `server`, `limit?`, `directory?`, `order?`, `search?`, `archived?`, `parent_id?`, `cursor?`, `project?`, `subpath?` | List sessions on one server. `limit` defaults to 50, range 1–100.                                  |
| `session_get`      | `server`, `session_id`                                                                                              | Get a session record.                                                                              |
| `session_status`   | `server`, `session_id`                                                                                              | Derive `busy`/`idle` from session timing data.                                                     |
| `session_messages` | `server`, `session_id`, `limit?`, `order?`, `cursor?`, `type?`                                                      | Get messages. `limit` defaults to 50, range 1–200.                                                 |
| `session_diff`     | `server`, `session_id`, `from?`, `to?`, `context?`                                                                  | Get structured diffs for a turn range.                                                             |
| `sessions_search`  | `query`, `servers?`, `limit?`                                                                                       | Search across all configured servers, or a subset. `limit` defaults to 20, per server, range 1–50. |
| `sessions_compare` | `server_a`, `session_a`, `server_b`, `session_b`                                                                    | Return two sessions side by side.                                                                  |

## Write tools

Each write tool accepts `allowed?: boolean` to explicitly allow the operation when the session is not allowlisted. This bypasses the allowlist; withhold `allowed` from untrusted clients.

| Tool                | Parameters                                                      | Description                                                                                                                                    |
| ------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_create`    | `server`, `directory`, `title?`, `agent?`, `model?`, `allowed?` | Create a session. `model` is `{ providerID, id, variant? }`. Allowlist token: `create` (or `*`).                                               |
| `session_prompt`    | `server`, `session_id`, `prompt`, `wait_for?`, `allowed?`       | Send a prompt. `wait_for` is 1000–300000 ms. When set, returns `{ prompt, awaited, timed_out, message }`.                                      |
| `session_interrupt` | `server`, `session_id`, `allowed?`                              | Interrupt a session. Destructive hint is set.                                                                                                  |
| `session_schedule`  | `server`, `session_id`, `prompt`, `delay`, `allowed?`           | Send a prompt after a delay. Minimum 1 second, maximum 1 hour. Durations like `30s`, `2m30s`, or `in 5m`; also ISO timestamps. Not persistent. |

Audit records are written for allowed and denied writes. Invalid `session_schedule` delays throw before any record is written.
