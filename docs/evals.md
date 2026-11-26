# Evals

Evals are scenario-based model evaluations. They are different from unit and integration tests: a host model calls the MCP tools under test, and a judge model scores the result. Run them with `bun run evals`.

## Prerequisites

- Built output (`bun run build` is part of the script).
- `opencode` on `PATH`.
- A host model provider and API key.
- A judge model provider and API key.

## Process

1. Playwright global setup starts two fixture OpenCode servers and one model-proxy server.
2. If the host provider is `openai` and `OPENAI_BASE_URL` is not set, a local Go proxy routes inference through `OPENCODE_GO_API_KEY`.
3. Each eval case sends a natural-language scenario to the host model via the MCP server tester.
4. A judge scores correctness and/or completeness against a 0.7 threshold.
5. Results are written under `.mcp-test-results/`. Baselines live in `.mcp-test-results/baseline/`.

Write cases mutate fixture state and run once. Read cases run `MCP_EVAL_ITERATIONS` times (default 10).

## Environment variables

| Variable                                            | Purpose                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `MCP_EVAL_PROVIDER`                                 | Host provider: `deepseek`, `openai`, `anthropic`, or `google`. Default `openai`.            |
| `MCP_EVAL_MODEL`                                    | Host model id. Required when provider is not `openai`.                                      |
| `MCP_EVAL_JUDGE_PROVIDER`                           | Judge provider: `openai`, `anthropic`, or `google`. Defaults to host provider when valid.   |
| `MCP_EVAL_JUDGE_MODEL`                              | Judge model id. Required when judge provider differs from host provider.                    |
| `MCP_EVAL_JUDGE_REPS`                               | Judge calls averaged per trial. Default `1`.                                                |
| `MCP_EVAL_JUDGE_API_KEY_ENV`                        | Env var holding the judge key for `anthropic`/`google`. OpenAI judge uses `OPENAI_API_KEY`. |
| `MCP_EVAL_ITERATIONS`                               | Trials per read case. Default `10`.                                                         |
| `MCP_EVAL_UPDATE_BASELINE`                          | Set to `1` to write candidate baselines from passing runs.                                  |
| `MCP_EVAL_COMPARE_BASELINE`                         | Set to `1` to compare against committed baselines.                                          |
| `OPENCODE_GO_API_KEY`                               | Required for the OpenCode Go proxy route.                                                   |
| `OPENAI_BASE_URL`                                   | Set to use a custom endpoint instead of the Go proxy.                                       |
| `MCP_EVAL_PROXY_LOG`                                | Optional path for proxy exchange logs.                                                      |
| `OPENCODE_PEER_MCP_EVAL_ROOT`                       | Fixture root. Default `/tmp/opencode-peer-mcp-evals`.                                       |
| `OPENCODE_ALPHA_PASSWORD`, `OPENCODE_BETA_PASSWORD` | Fixture server passwords. Defaults `alpha-pass`, `beta-pass`.                               |

## Baseline workflow

- Run `MCP_EVAL_UPDATE_BASELINE=1 bun run evals` to create candidates. A candidate replaces the baseline only when every trial passes and no outage markers appear.
- Run `MCP_EVAL_COMPARE_BASELINE=1 bun run evals` to compare a run against committed baselines. A pass-rate drop greater than `0.1` is treated as a regression.
- Do not set both update and compare flags in one run.

Infrastructure errors (503s, rate limits, connection errors) are filtered from pass-rate comparisons so provider outages do not fail the eval.
