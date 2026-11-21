import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callTool, connectClient, pollTool, toolText } from './client.js';
import { FIXTURE_REPLY } from './fixture-model.js';
import { ROOT, readState } from './fixtures.js';

const state = readState();

let client: Client;
beforeAll(async () => {
  client = await connectClient();
});
afterAll(async () => {
  await client.close();
});

test('session_prompt on alpha returns the fixed reply in session_messages', async () => {
  const prompt = await callTool(client, 'session_prompt', {
    server: 'alpha',
    session_id: state.alphaSessionId,
    prompt: 'hello from fixture test',
  });
  expect(prompt.isError).not.toBe(true);

  const messages = await pollTool(
    client,
    'session_messages',
    { server: 'alpha', session_id: state.alphaSessionId },
    (text) => text.includes(FIXTURE_REPLY),
  );
  expect(messages.isError).not.toBe(true);
  expect(toolText(messages)).toContain(FIXTURE_REPLY);
});

test('scripted edit on alpha appears in session_diff', async () => {
  const target = `${ROOT}/work/edited.txt`;
  const prompt = await callTool(client, 'session_prompt', {
    server: 'alpha',
    session_id: state.alphaSessionId,
    prompt: `fixture-edit: ${target}`,
  });
  expect(prompt.isError).not.toBe(true);

  const diff = await pollTool(
    client,
    'session_diff',
    { server: 'alpha', session_id: state.alphaSessionId },
    (text) => text.includes('edited.txt'),
  );
  expect(diff.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(diff)) as {
    data: Array<{ file: string; status: string; additions: number }>;
  };
  expect(parsed.data).toEqual([
    expect.objectContaining({
      file: 'edited.txt',
      status: 'added',
      additions: 1,
    }),
  ]);
  expect(readFileSync(target, 'utf8')).toBe('written by fixture-edit\n');
});

test('session_interrupt stops a slow prompt and the session goes idle', async () => {
  const prompt = await callTool(client, 'session_prompt', {
    server: 'alpha',
    session_id: state.alphaSessionId,
    prompt: 'fixture-slow',
  });
  expect(prompt.isError).not.toBe(true);

  const busy = await pollTool(
    client,
    'session_status',
    { server: 'alpha', session_id: state.alphaSessionId },
    (text) => text.includes('"busy"'),
  );
  expect(toolText(busy)).toContain('"busy"');

  const interrupt = await callTool(client, 'session_interrupt', {
    server: 'alpha',
    session_id: state.alphaSessionId,
  });
  expect(interrupt.isError).not.toBe(true);

  const idle = await pollTool(
    client,
    'session_status',
    { server: 'alpha', session_id: state.alphaSessionId },
    (text) => text.includes('"idle"'),
  );
  expect(toolText(idle)).toContain('"idle"');
});
