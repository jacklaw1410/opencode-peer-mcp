import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool, connectClient, toolText } from './client.js';
import { readState } from './fixtures.js';

const state = readState();

let client: Client;
beforeAll(async () => {
  client = await connectClient();
});
afterAll(async () => {
  await client.close();
});

test('sessions_list finds the fixture session', async () => {
  const result = await callTool(client, 'sessions_list', {
    server: 'alpha',
    limit: 20,
    search: 'peer-mcp-fixture',
  });
  expect(result.isError).not.toBe(true);
  expect(toolText(result)).toContain('peer-mcp-fixture');
});

test('session_get returns the fixture session', async () => {
  const result = await callTool(client, 'session_get', {
    server: 'alpha',
    session_id: state.alphaSessionId,
  });
  expect(result.isError).not.toBe(true);
  expect(toolText(result)).toContain(state.alphaSessionId);
});

test('sessions_search spans both servers', async () => {
  const result = await callTool(client, 'sessions_search', {
    query: 'peer-mcp-fixture',
    limit: 20,
  });
  expect(result.isError).not.toBe(true);
  expect(toolText(result)).toContain('alpha');
  expect(toolText(result)).toContain('beta');
});

test('sessions_compare returns both sessions', async () => {
  const result = await callTool(client, 'sessions_compare', {
    server_a: 'alpha',
    session_a: state.alphaSessionId,
    server_b: 'beta',
    session_b: state.betaSessionId,
  });
  expect(result.isError).not.toBe(true);
  expect(toolText(result)).toContain('alpha');
  expect(toolText(result)).toContain('beta');
});
