import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 60000,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  reporter: [['list']],
  projects: [
    {
      name: 'opencode-peer-mcp',
      use: {
        mcpConfig: {
          transport: 'stdio',
          command: 'node',
          args: [path.resolve(process.cwd(), 'dist/index.js')],
          env: {
            OPENCODE_PEER_MCP_CONFIG: `${process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ?? '/tmp/opencode-peer-mcp-integration'}/servers.yaml`,
            OPENCODE_ALPHA_PASSWORD:
              process.env.OPENCODE_ALPHA_PASSWORD ?? 'alpha-pass',
            OPENCODE_BETA_PASSWORD:
              process.env.OPENCODE_BETA_PASSWORD ?? 'beta-pass',
            OPENCODE_PEER_MCP_WRITE_ENABLED: 'true',
            OPENCODE_PEER_MCP_AUDIT_LOG: `${process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ?? '/tmp/opencode-peer-mcp-integration'}/audit.log`,
          },
        },
      },
    },
  ],
});
