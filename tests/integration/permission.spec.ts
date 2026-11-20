import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

test('permission denies session creation by default', async ({ mcp }) => {
  const result = await mcp.callTool('session_create', {
    server: 'beta',
    directory: '/tmp/opencode-peer-mcp-integration/work',
    title: 'should-not-be-created',
  });
  expect(result).toBeToolError();
  expect(result).toContainToolText('Write denied');
});

test('permission allows an allowlisted session', async ({ mcp }) => {
  const result = await mcp.callTool('session_create', {
    server: 'alpha',
    directory: '/tmp/opencode-peer-mcp-integration/work',
    title: 'allowed-write-fixture',
  });
  expect(result).not.toBeToolError();
});
