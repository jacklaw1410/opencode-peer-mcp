import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool, connectClient, toolText } from './client.js';

let client: Client;
beforeAll(async () => {
  client = await connectClient();
});
afterAll(async () => {
  await client.close();
});

test('lists the expected tools', async () => {
  const { tools } = await client.listTools();
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

test('servers_list returns configured servers', async () => {
  const result = await callTool(client, 'servers_list', {});
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as Array<{ id: string }>;
  expect(parsed.map((server) => server.id)).toEqual(['alpha', 'beta']);
});
