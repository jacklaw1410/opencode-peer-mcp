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

test('session_prompt with wait_for returns the assistant reply', async () => {
  const result = await callTool(client, 'session_prompt', {
    server: 'alpha',
    session_id: state.alphaSessionId,
    prompt: 'hello await from fixture test',
    wait_for: 10000,
  });
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as {
    awaited: boolean;
    timed_out: boolean;
    message: { type: string; content?: Array<{ type: string; text: string }> };
  };
  expect(parsed.awaited).toBe(true);
  expect(parsed.timed_out).toBe(false);
  expect(parsed.message).not.toBeNull();
});

test('session_schedule arms a timer and returns scheduled', async () => {
  const result = await callTool(client, 'session_schedule', {
    server: 'alpha',
    session_id: state.alphaSessionId,
    prompt: 'scheduled hello',
    delay: '30s',
  });
  expect(result.isError).not.toBe(true);
  const parsed = JSON.parse(toolText(result)) as {
    scheduled: boolean;
    fires_at: string;
    delay_ms: number;
  };
  expect(parsed.scheduled).toBe(true);
  expect(parsed.delay_ms).toBe(30000);
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
