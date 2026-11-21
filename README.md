# opencode-peer-mcp

Bridge OpenCode sessions across configured servers.

## Development

Use the Bun canary build. `bun lint` exists only in canary builds: `bun upgrade --canary`.

- `bun install`: installs dependencies and points Git at the committed `.githooks/` directory.
- `bun run test`: unit tests.
- `bun run test:integration`: starts two OpenCode servers. Requires `opencode` on `PATH`.
- `bun run typecheck`, `bun run lint`, `bun run format:check`: static checks.

The pre-commit hook runs `bun fmt --staged`, `bun lint --staged --fix`, and `bun check`. Run the commit with the canary `bun` first on `PATH`.

## Evals

Evals check whether an LLM picks and uses the MCP tools correctly. They call a paid model, so they run locally only and are not part of `bun run test` or CI.

The default provider `openai` routes through a local proxy to OpenCode Go. Set `OPENCODE_GO_API_KEY` to your Go key. DeepSeek V4.1 Flash needs Console Settings > Privacy set to Global. If a run fails with a region or privacy error, change that setting.

```
OPENCODE_GO_API_KEY=... bun run test:evals
OPENCODE_GO_API_KEY=... bun run test:evals -- --grep servers_list
```

Each case runs as its own Playwright test. Results go to `.mcp-test-results/`, and the MST report is written to `.mcp-test-results/latest/`.

Baselines:

- `MCP_EVAL_UPDATE_BASELINE=1` writes a case's results to `.mcp-test-results/baseline/` only when every trial passes with no infrastructure error. Otherwise the results stay in `.mcp-test-results/candidate/`, and the log says why.
- `MCP_EVAL_COMPARE_BASELINE=1` fails a case whose pass rate drops more than 0.1 below its baseline, for example 10/10 to 8/10. A case with no baseline file also fails.
- Set only one of the two variables. Setting both fails each case.

Environment variables:

| Variable                                            | Default                                       | Purpose                                                                                    |
| --------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `OPENCODE_GO_API_KEY`                               | none                                          | OpenCode Go key, required when routing through the proxy                                   |
| `MCP_EVAL_PROVIDER`                                 | `openai`                                      | Host model provider. `openai` routes through the Go proxy unless `OPENAI_BASE_URL` is set  |
| `MCP_EVAL_MODEL`                                    | `deepseek-v4.1-flash` for `openai`, else none | Host model. Required when `MCP_EVAL_PROVIDER` is `deepseek`, `anthropic`, or `google`      |
| `MCP_EVAL_JUDGE_PROVIDER`                           | host provider if judge-capable, else `openai` | `openai`, `anthropic`, or `google`                                                         |
| `MCP_EVAL_JUDGE_MODEL`                              | host model if providers match, else none      | Judge model. Required when the judge provider differs from the host provider               |
| `MCP_EVAL_JUDGE_REPS`                               | 1                                             | Number of judge calls averaged per trial. 3 reduces variance.                              |
| `MCP_EVAL_JUDGE_API_KEY_ENV`                        | provider key name                             | Env var that holds the judge key. Ignored for `openai`, which always uses `OPENAI_API_KEY` |
| `OPENAI_BASE_URL`                                   | unset                                         | Skips the Go proxy and sends OpenAI requests to this endpoint                              |
| `OPENCODE_PEER_MCP_EVAL_ROOT`                       | `/tmp/opencode-peer-mcp-evals`                | Eval fixture directory                                                                     |
| `OPENCODE_ALPHA_PASSWORD`, `OPENCODE_BETA_PASSWORD` | `alpha-pass`, `beta-pass`                     | Passwords for the two fixture OpenCode servers                                             |

If the host is not `openai` and the judge is `openai`, the judge calls `api.openai.com` with `OPENAI_API_KEY`, not the Go proxy.
