import { describe, expect, it } from 'bun:test';
import { createServer } from 'node:http';
import { startGoProxy } from './evals/go-proxy.js';
import {
  chatToResponses,
  responsesToChat,
  type ItemStore,
  type JsonObject,
} from './evals/responses-translate.js';

const servers = {
  name: 'servers_list',
  description: 'List configured OpenCode servers.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

function chatReply(message: JsonObject): JsonObject {
  return {
    created: 1,
    model: 'beam-free',
    choices: [{ index: 0, finish_reason: 'stop', message }],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  };
}

describe('responsesToChat', () => {
  it('sends a plain string input as one user message with instructions', () => {
    const items: ItemStore = new Map();
    const chat = responsesToChat(
      { model: 'm', instructions: 'be brief', input: 'hi' },
      items,
    );
    expect(chat.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('turns a tool call round trip into chat tool messages with null content', () => {
    const items: ItemStore = new Map();
    const chat = responsesToChat(
      {
        model: 'm',
        input: [
          { role: 'user', content: [{ type: 'input_text', text: 'list' }] },
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'servers_list',
            arguments: '{}',
          },
          {
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"servers":["alpha"]}',
          },
        ],
        tools: [{ type: 'function', ...servers }],
      },
      items,
    );
    expect(chat.messages).toEqual([
      { role: 'user', content: 'list' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'servers_list', arguments: '{}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"servers":["alpha"]}',
      },
    ]);
    expect(chat.tools).toEqual([{ type: 'function', function: servers }]);
  });

  it('resolves item_reference to the item returned earlier', () => {
    const items: ItemStore = new Map();
    const first = chatToResponses(
      chatReply({
        content: null,
        reasoning_content: 'need the list',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'servers_list', arguments: '{}' },
          },
        ],
      }),
      items,
    );
    const output = first.output as JsonObject[];
    const replayed = responsesToChat(
      {
        model: 'm',
        input: [
          { role: 'user', content: 'list' },
          { type: 'item_reference', id: output[0]?.id },
          { type: 'item_reference', id: output[1]?.id },
          { type: 'function_call_output', call_id: 'call_1', output: 'ok' },
        ],
      },
      items,
    );
    expect(replayed.messages).toEqual([
      { role: 'user', content: 'list' },
      {
        role: 'assistant',
        content: null,
        reasoning_content: 'need the list',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'servers_list', arguments: '{}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'ok' },
    ]);
  });

  it('rejects references it cannot resolve and unsupported input', () => {
    const items: ItemStore = new Map();
    expect(() =>
      responsesToChat(
        { model: 'm', input: [{ type: 'item_reference', id: 'fc_x' }] },
        items,
      ),
    ).toThrow('item_reference fc_x is not known');
    expect(() =>
      responsesToChat(
        { model: 'm', input: [{ type: 'web_search_call', id: 'ws_1' }] },
        items,
      ),
    ).toThrow('unsupported input item type: web_search_call');
    expect(() =>
      responsesToChat({ model: 'm', input: 'x', stream: true }, items),
    ).toThrow('streaming is not supported');
  });

  it('rejects non-function tools', () => {
    expect(() =>
      responsesToChat(
        { model: 'm', input: 'x', tools: [{ type: 'web_search' }] },
        new Map(),
      ),
    ).toThrow('unsupported tool type: web_search');
  });
});

describe('chatToResponses', () => {
  it('builds Responses output items and usage from a chat reply', () => {
    const items: ItemStore = new Map();
    const response = chatToResponses(
      chatReply({ content: 'Hi!', reasoning_content: 'greet' }),
      items,
    );
    const output = response.output as JsonObject[];
    expect(output.map((o) => o.type)).toEqual(['reasoning', 'message']);
    expect(response.status).toBe('completed');
    expect(response.usage).toEqual({
      input_tokens: 3,
      output_tokens: 2,
      total_tokens: 5,
    });
    expect(items.size).toBe(2);
  });

  it('marks a length-truncated reply incomplete', () => {
    const response = chatToResponses(
      {
        choices: [
          {
            finish_reason: 'length',
            message: { content: 'partial' },
          },
        ],
      },
      new Map(),
    );
    expect(response.status).toBe('incomplete');
    expect(response.incomplete_details).toEqual({
      reason: 'max_output_tokens',
    });
  });
});

describe('startGoProxy translation', () => {
  it('sends /v1/responses upstream as chat and returns a Responses body', async () => {
    const seen: { path?: string; body?: JsonObject; auth?: string } = {};
    const upstream = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        seen.path = req.url;
        seen.body = JSON.parse(raw) as JsonObject;
        seen.auth = req.headers.authorization;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(chatReply({ content: 'Hi!' })));
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const port = (upstream.address() as { port: number }).port;
    const proxy = await startGoProxy({
      apiKey: 'GO-KEY',
      clientToken: 'TOKEN',
      upstream: `http://127.0.0.1:${port}/v1`,
    });
    try {
      const res = await fetch(`${proxy.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer TOKEN',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'm', input: 'hi' }),
      });
      const body = (await res.json()) as JsonObject;
      expect(res.status).toBe(200);
      expect(body.object).toBe('response');
      expect((body.output as JsonObject[])[0]?.type).toBe('message');
      expect(seen.path).toBe('/v1/chat/completions');
      expect(seen.body?.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(seen.auth).toBe('Bearer GO-KEY');
    } finally {
      await proxy.close();
      upstream.close();
    }
  });
});

describe('startGoProxy sessions', () => {
  it('rotates the Go session for each new case and keeps tool turns together', async () => {
    const sessions: string[] = [];
    const upstream = createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        sessions.push(String(req.headers['x-opencode-session']));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(chatReply({ content: 'ok' })));
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const port = (upstream.address() as { port: number }).port;
    const proxy = await startGoProxy({
      apiKey: 'GO-KEY',
      clientToken: 'TOKEN',
      upstream: `http://127.0.0.1:${port}/v1`,
    });
    try {
      const post = (body: JsonObject) =>
        fetch(`${proxy.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: 'Bearer TOKEN',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      // Judge call for case 1, a tool turn in that case, then case 2.
      await post({
        model: 'm',
        messages: [
          { role: 'system', content: 'judge' },
          { role: 'user', content: 'case 1' },
        ],
      });
      await post({
        model: 'm',
        messages: [
          { role: 'user', content: 'case 1' },
          { role: 'assistant', content: 'call' },
          { role: 'tool', content: 'result' },
        ],
      });
      await post({
        model: 'm',
        messages: [{ role: 'user', content: 'case 2' }],
      });
      expect(sessions[0]).toMatch(/^ses_/);
      expect(sessions[1]).toBe(sessions[0]);
      expect(sessions[2]).not.toBe(sessions[0]);
    } finally {
      await proxy.close();
      upstream.close();
    }
  });

  it('keeps one Responses conversation together and rotates for the judge', async () => {
    const sessions: string[] = [];
    const seenBodies: JsonObject[] = [];
    const upstream = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        sessions.push(String(req.headers['x-opencode-session']));
        seenBodies.push(JSON.parse(raw) as JsonObject);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(chatReply({ content: 'first answer' })));
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    );
    const port = (upstream.address() as { port: number }).port;
    const proxy = await startGoProxy({
      apiKey: 'GO-KEY',
      clientToken: 'TOKEN',
      upstream: `http://127.0.0.1:${port}/v1`,
    });
    try {
      const post = (path: string, body: JsonObject) =>
        fetch(`${proxy.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            authorization: 'Bearer TOKEN',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      const first = await post('/responses', { model: 'm', input: 'case 1' });
      const firstBody = (await first.json()) as JsonObject;
      const itemId = String((firstBody.output as JsonObject[])[0]?.id);
      const second = await post('/responses', {
        model: 'm',
        input: [
          { type: 'message', role: 'user', content: 'go on' },
          { type: 'item_reference', id: itemId },
        ],
      });
      expect(second.status).toBe(200);
      expect((seenBodies[1]?.messages as JsonObject[])[1]?.role).toBe(
        'assistant',
      );
      await post('/chat/completions', {
        model: 'm',
        messages: [
          { role: 'system', content: 'judge' },
          { role: 'user', content: 'grade case 1' },
        ],
      });
      expect(sessions[0]).toBe(sessions[1]);
      expect(sessions[2]).not.toBe(sessions[0]);
    } finally {
      await proxy.close();
      upstream.close();
    }
  });
});
