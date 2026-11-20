import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

test('write gate allows an allowlisted session', async ({ mcp }) => {
  const result = await mcp.callTool('session_create', {
    server: 'alpha',
    directory: '/tmp/opencode-peer-mcp-integration/work',
    title: 'allowed-write-fixture',
  });
  expect(result).not.toBeToolError();
});
