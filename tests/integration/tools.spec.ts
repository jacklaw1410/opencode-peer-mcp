import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

test('lists the expected tools', async ({ mcp }) => {
  const tools = await mcp.listTools();
  const names = tools.map((tool) => tool.name);
  const expected = [
    'servers_list',
    'server_get',
    'sessions_list',
    'session_get',
    'session_status',
    'session_messages',
    'session_diff',
    'sessions_search',
    'sessions_compare',
    'session_create',
    'session_prompt',
    'session_interrupt',
  ];
  expect(names).toEqual(expect.arrayContaining(expected));
  expect(names).toHaveLength(expected.length);
});

test('servers_list returns configured servers', async ({ mcp }) => {
  const result = await mcp.callTool('servers_list', {});
  expect(result).not.toBeToolError();
  const text = (result.content as Array<{ text?: string }>)[0]?.text ?? '';
  const parsed = JSON.parse(text) as Array<{ id: string }>;
  expect(parsed.map((server) => server.id)).toEqual(['alpha', 'beta']);
});
