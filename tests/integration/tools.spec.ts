import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

test('lists the expected tools', async ({ mcp }) => {
  const tools = await mcp.listTools();
  const names = tools.map((tool) => tool.name);
  for (const name of [
    'servers_list',
    'sessions_list',
    'session_get',
    'sessions_search',
    'sessions_compare',
  ]) {
    expect(names).toContain(name);
  }
});

test('servers_list returns configured servers', async ({ mcp }) => {
  const result = await mcp.callTool('servers_list', {});
  expect(result).not.toBeToolError();
  const text = (result.content as Array<{ text?: string }>)[0]?.text ?? '';
  const parsed = JSON.parse(text) as Array<{ id: string }>;
  expect(parsed.map((server) => server.id)).toEqual(['alpha', 'beta']);
});
