import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool, connectClient, toolText } from './client.js';
import { ROOT, readState } from './fixtures.js';

const state = readState();

let client: Client;
beforeAll(async () => {
  client = await connectClient();
});
afterAll(async () => {
  await client.close();
});

test('permission denies session creation by default', async () => {
  const result = await callTool(client, 'session_create', {
    server: 'beta',
    directory: `${ROOT}/work`,
    title: 'should-not-be-created',
  });
  expect(result.isError).toBe(true);
  expect(toolText(result)).toContain('Write denied');
});

test('permission allows an allowlisted session', async () => {
  const result = await callTool(client, 'session_create', {
    server: 'alpha',
    directory: `${ROOT}/work`,
    title: 'allowed-write-fixture',
  });
  expect(result.isError).not.toBe(true);
});

test('permission denies session_prompt on a non-allowlisted session', async () => {
  const result = await callTool(client, 'session_prompt', {
    server: 'beta',
    session_id: state.betaSessionId,
    prompt: 'should-not-run',
  });
  expect(result.isError).toBe(true);
  expect(toolText(result)).toContain('Write denied');
});

test('permission denies session_interrupt on a non-allowlisted session', async () => {
  const result = await callTool(client, 'session_interrupt', {
    server: 'beta',
    session_id: state.betaSessionId,
  });
  expect(result.isError).toBe(true);
  expect(toolText(result)).toContain('Write denied');
});
