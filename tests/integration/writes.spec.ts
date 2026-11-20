import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

test('write gate denies session creation by default', async ({ mcp }) => {
  const result = await mcp.callTool('session_create', {
    server: 'beta',
    directory: '/tmp/opencode-peer-mcp-integration/work',
    title: 'should-not-be-created',
  });
  expect(result).toBeToolError();
  expect(result).toContainToolText('Write denied');
});
