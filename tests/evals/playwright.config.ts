import { defineConfig } from '@playwright/test';
import path from 'node:path';
import type {} from '../mcp-fixture-types.js';
import { EVAL_LAYOUT } from './layout.js';

// MST merges process.env into the stdio child, so an empty value overrides the
// inherited Go key and the per-run proxy token. The MCP server needs neither.
// Undefined would fail MST's config schema.
const UNSET_GO_KEYS = {
  OPENCODE_GO_API_KEY: '',
  OPENAI_API_KEY: '',
  OPENAI_BASE_URL: '',
  ANTHROPIC_API_KEY: '',
  GOOGLE_API_KEY: '',
  DEEPSEEK_API_KEY: '',
};

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 300000,
  globalSetup: './global-setup.ts',
  reporter: [
    ['list'],
    [
      '@gleanwork/mcp-server-tester/reporters/mcpReporter',
      { outputDir: '.mcp-test-results', historyLimit: 10 },
    ],
  ],
  projects: [
    {
      name: 'opencode-peer-mcp-evals',
      use: {
        mcpConfig: {
          transport: 'stdio',
          command: 'node',
          args: [path.resolve(process.cwd(), 'dist/index.js')],
          env: {
            ...UNSET_GO_KEYS,
            OPENCODE_PEER_MCP_CONFIG: `${EVAL_LAYOUT.root}/servers.yaml`,
            OPENCODE_ALPHA_PASSWORD:
              process.env.OPENCODE_ALPHA_PASSWORD ?? 'alpha-pass',
            OPENCODE_BETA_PASSWORD:
              process.env.OPENCODE_BETA_PASSWORD ?? 'beta-pass',
            OPENCODE_PEER_MCP_WRITE_ENABLED: 'true',
            OPENCODE_PEER_MCP_AUDIT_LOG: `${EVAL_LAYOUT.root}/audit.log`,
          },
        },
      },
    },
  ],
});
