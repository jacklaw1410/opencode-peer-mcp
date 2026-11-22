import type { MCPConfig } from '@gleanwork/mcp-server-tester';

// MST reads `mcpConfig` at runtime but does not declare it in its types.
declare module 'playwright/test' {
  interface PlaywrightTestOptions {
    mcpConfig: MCPConfig;
  }
}

export {};
