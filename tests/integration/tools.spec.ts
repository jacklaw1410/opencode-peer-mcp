import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool, connectClient, toolText } from './client.js';
import { ROOT, SERVERS } from './fixtures.js';

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
    'session_schedule',
  ];
  expect(names).toEqual(expect.arrayContaining(expected));
  expect(names).toHaveLength(expected.length);
});

test('servers_list returns configured servers', async () => {
  const result = await callTool(client, 'servers_list', {});
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as Array<{ id: string }>;
  expect(parsed.map((server) => server.id)).toEqual(['alpha', 'beta', 'write']);
});

test('server_get returns the details of alpha and beta', async () => {
  const alpha = await callTool(client, 'server_get', { server: 'alpha' });
  expect(alpha.isError).not.toBe(true);
  expect(JSON.parse(toolText(alpha))).toMatchObject({
    id: 'alpha',
    url: `http://127.0.0.1:${SERVERS.alpha.port}`,
    auth: 'basic',
  });

  const beta = await callTool(client, 'server_get', { server: 'beta' });
  expect(beta.isError).not.toBe(true);
  expect(JSON.parse(toolText(beta))).toMatchObject({
    id: 'beta',
    url: `http://127.0.0.1:${SERVERS.beta.port}`,
    auth: 'basic',
  });
});

test('session_create with model uses that model', async () => {
  const result = await callTool(client, 'session_create', {
    server: 'alpha',
    directory: `${ROOT}/work`,
    title: 'model-session',
    model: { providerID: 'fixture', id: 'fixture-model' },
  });
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as {
    data?: { model?: { providerID: string; id: string } };
  };
  expect(parsed.data?.model).toMatchObject({
    providerID: 'fixture',
    id: 'fixture-model',
  });
});

test('session_create without model keeps server default', async () => {
  const result = await callTool(client, 'session_create', {
    server: 'alpha',
    directory: `${ROOT}/work`,
    title: 'default-model-session',
  });
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as { data?: { model?: unknown } };
  expect(parsed.data?.model).toBeUndefined();
});
