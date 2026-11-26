import type { EvalCase, EvalDataset } from '@gleanwork/mcp-server-tester';
import type { FixtureState } from '../integration/fixtures.js';
import { EVAL_LAYOUT } from './layout.js';

const HOST_PROVIDERS = ['deepseek', 'openai', 'anthropic', 'google'] as const;
type HostProvider = (typeof HOST_PROVIDERS)[number];

function hostProviderFrom(value: string): HostProvider {
  if (!(HOST_PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(
      `MCP_EVAL_PROVIDER must be one of ${HOST_PROVIDERS.join(', ')}, got ${value}`,
    );
  }
  return value as HostProvider;
}

const provider = hostProviderFrom(process.env.MCP_EVAL_PROVIDER ?? 'openai');
// Route id served by OpenCode Go. Other providers have their own model ids.
const GO_DEFAULT_MODEL = 'deepseek-v4.1-flash';
const model =
  process.env.MCP_EVAL_MODEL ??
  (provider === 'openai' ? GO_DEFAULT_MODEL : undefined);
if (!model) {
  throw new Error(
    `MCP_EVAL_MODEL is required when MCP_EVAL_PROVIDER is ${provider}`,
  );
}

const JUDGE_PROVIDERS = ['openai', 'anthropic', 'google'] as const;
type JudgeProvider = (typeof JUDGE_PROVIDERS)[number];

function isJudgeProvider(value: string): value is JudgeProvider {
  return (JUDGE_PROVIDERS as readonly string[]).includes(value);
}

function judgeProviderFrom(envValue: string | undefined): JudgeProvider {
  const value = envValue ?? (isJudgeProvider(provider) ? provider : 'openai');
  if (!isJudgeProvider(value)) {
    throw new Error(
      `MCP_EVAL_JUDGE_PROVIDER must be one of ${JUDGE_PROVIDERS.join(', ')}, got ${value}`,
    );
  }
  return value;
}

const judgeProvider = judgeProviderFrom(process.env.MCP_EVAL_JUDGE_PROVIDER);
// A judge model is only inferred when it shares the host's provider, because
// a model id from one provider does not exist on another.
const judgeModel =
  process.env.MCP_EVAL_JUDGE_MODEL ??
  (judgeProvider === provider ? model : undefined);
if (!judgeModel) {
  throw new Error(
    `MCP_EVAL_JUDGE_MODEL is required when the judge provider (${judgeProvider}) differs from MCP_EVAL_PROVIDER (${provider})`,
  );
}
// The OpenAI judge always goes through OPENAI_BASE_URL, which global setup
// points at the Go proxy. Its key must be OPENAI_API_KEY (the proxy token), so
// MCP_EVAL_JUDGE_API_KEY_ENV applies only to anthropic and google.
const judgeApiKeyEnvVar =
  judgeProvider === 'openai'
    ? 'OPENAI_API_KEY'
    : (process.env.MCP_EVAL_JUDGE_API_KEY_ENV ??
      (judgeProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'));

const hostConfig = {
  provider,
  model,
  temperature: 0,
  maxToolCalls: 12,
};

// Write cases change server state, so they run once instead of 10 times.
const WRITE_CASE_ITERATIONS = 1;

function judge(rubric: 'correctness' | 'completeness') {
  return {
    rubric,
    threshold: 0.7,
    provider: judgeProvider,
    model: judgeModel,
    apiKeyEnvVar: judgeApiKeyEnvVar,
  };
}

export function buildEvalDataset(state: FixtureState): EvalDataset {
  const alpha = state.alphaSessionId;
  const beta = state.betaSessionId;
  const writeSession = state.writeSessionId;
  // Write cases run against a dedicated server/session so read cases never
  // observe the state they mutate.
  const writeServer = 'write';
  const workDir = `${EVAL_LAYOUT.root}/work`;

  const standalone: EvalCase[] = [
    {
      id: 'servers_list',
      description: 'Discover configured servers.',
      mode: 'mcp_host',
      scenario: 'What OpenCode servers are configured? List their ids.',
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: { calls: [{ name: 'servers_list' }] },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'server_get',
      description: 'Fetch one server.',
      mode: 'mcp_host',
      scenario: "Get details for the configured server named 'alpha'.",
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [{ name: 'server_get', arguments: { server: 'alpha' } }],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'sessions_list',
      description: 'List sessions on a server.',
      mode: 'mcp_host',
      scenario: "List sessions on server 'alpha' matching 'peer-mcp-fixture'.",
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'sessions_list',
              arguments: { server: 'alpha', search: 'peer-mcp-fixture' },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_get',
      description: 'Get a session by id.',
      mode: 'mcp_host',
      scenario: `Get the session with id ${alpha} from server 'alpha'.`,
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_get',
              arguments: { server: 'alpha', session_id: alpha },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_status',
      description: 'Get derived status.',
      mode: 'mcp_host',
      scenario: `What is the status of session ${alpha} on server 'alpha'?`,
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_status',
              arguments: { server: 'alpha', session_id: alpha },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_messages',
      description: 'Get messages.',
      mode: 'mcp_host',
      scenario: `Show messages for session ${alpha} on server 'alpha'.`,
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_messages',
              arguments: { server: 'alpha', session_id: alpha },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_diff',
      description: 'Get diffs.',
      mode: 'mcp_host',
      scenario: `Show the diff for session ${alpha} on server 'alpha'.`,
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_diff',
              arguments: { server: 'alpha', session_id: alpha },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'sessions_search',
      description: 'Search across servers.',
      mode: 'mcp_host',
      scenario:
        "Search all configured servers for sessions about 'peer-mcp-fixture'. Report the matching session ids only.",
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'sessions_search',
              arguments: { query: 'peer-mcp-fixture' },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'sessions_compare',
      description: 'Compare two sessions.',
      mode: 'mcp_host',
      scenario: `Compare session ${alpha} on 'alpha' with session ${beta} on 'beta'.`,
      mcpHostConfig: hostConfig,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'sessions_compare',
              arguments: {
                server_a: 'alpha',
                session_a: alpha,
                server_b: 'beta',
                session_b: beta,
              },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_create',
      description: 'Create a session where allowed.',
      mode: 'mcp_host',
      scenario: `Create a new session on server '${writeServer}' in directory ${workDir} with title 'eval-created-session'.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_create',
              arguments: {
                server: writeServer,
                directory: workDir,
                title: 'eval-created-session',
              },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_prompt',
      description: 'Prompt a session.',
      mode: 'mcp_host',
      scenario: `Send the prompt 'hello from eval' to session ${writeSession} on server '${writeServer}'.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_prompt',
              arguments: {
                server: writeServer,
                session_id: writeSession,
                prompt: 'hello from eval',
              },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_interrupt',
      description: 'Interrupt a session.',
      mode: 'mcp_host',
      scenario: `Interrupt session ${writeSession} on server '${writeServer}'.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_interrupt',
              arguments: { server: writeServer, session_id: writeSession },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_schedule',
      description: 'Schedule a prompt after a delay.',
      mode: 'mcp_host',
      scenario: `In 30 seconds, send the prompt 'scheduled eval check' to session ${alpha} on server 'alpha'.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_schedule',
              arguments: {
                server: 'alpha',
                session_id: alpha,
                prompt: 'scheduled eval check',
                delay: '30s',
              },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'session_prompt_wait_for',
      description: 'Await a prompt reply.',
      mode: 'mcp_host',
      scenario: `Send the prompt 'awaited eval check' to session ${alpha} on server 'alpha' and wait up to 10000 milliseconds for the reply.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            {
              name: 'session_prompt',
              arguments: {
                server: 'alpha',
                session_id: alpha,
                prompt: 'awaited eval check',
                wait_for: 10000,
              },
            },
          ],
        },
        toolCallCount: { min: 1, max: 5 },
      },
      accuracyThreshold: 0.8,
    },
    {
      id: 'no_tool_arithmetic',
      description: 'Answer without calling a tool.',
      mode: 'mcp_host',
      scenario: 'What is 2+2?',
      mcpHostConfig: hostConfig,
      expect: {
        toolCallCount: { exact: 0 },
      },
      accuracyThreshold: 0.8,
    },
  ];

  const multiTool: EvalCase[] = [
    {
      id: 'search_recent_sessions',
      description: 'Search and filter sessions by topic and recency.',
      mode: 'mcp_host',
      scenario:
        "Find sessions related to 'peer-mcp-fixture' across configured servers, then identify which ones were updated in the last 10 hours. Report their ids.",
      mcpHostConfig: hostConfig,
      canonicalAnswer: `Both fixture sessions match 'peer-mcp-fixture'. They were created at the start of this run, so both were updated in the last 10 hours: ${alpha} on alpha and ${beta} on beta.`,
      expect: {
        toolsTriggered: {
          calls: [
            { name: 'sessions_search', required: true },
            { name: 'sessions_list', required: false },
          ],
          order: 'any',
        },
        toolCallCount: { min: 1, max: 5 },
        passesJudge: judge('correctness'),
      },
      judgeReps: Number(process.env.MCP_EVAL_JUDGE_REPS ?? 3),
      accuracyThreshold: 0.8,
    },
    {
      id: 'compare_sessions_summary',
      description: 'Compare sessions and summarize differences.',
      mode: 'mcp_host',
      scenario: `Compare session ${alpha} on 'alpha' with session ${beta} on 'beta', then summarize the differences in title and activity.`,
      mcpHostConfig: hostConfig,
      canonicalAnswer: `Both sessions have the title 'peer-mcp-fixture', so their titles are identical. Both were created during this run.`,
      expect: {
        toolsTriggered: {
          calls: [{ name: 'sessions_compare', required: true }],
        },
        passesJudge: judge('completeness'),
      },
      judgeReps: Number(process.env.MCP_EVAL_JUDGE_REPS ?? 3),
      accuracyThreshold: 0.8,
    },
    {
      id: 'prompt_and_diff',
      description: 'Prompt an allowlisted session, then inspect its diff.',
      mode: 'mcp_host',
      scenario: `Send the prompt 'eval workflow check' to session ${writeSession} on '${writeServer}', then show its diff.`,
      mcpHostConfig: hostConfig,
      iterations: WRITE_CASE_ITERATIONS,
      expect: {
        toolsTriggered: {
          calls: [
            { name: 'session_prompt', required: true },
            { name: 'session_diff', required: true },
          ],
          order: 'strict',
        },
      },
      accuracyThreshold: 0.8,
    },
  ];

  return {
    name: 'opencode-peer-mcp-evals',
    description: 'LLM evals for OpenCode peer MCP tools.',
    cases: [...standalone, ...multiTool],
  };
}
