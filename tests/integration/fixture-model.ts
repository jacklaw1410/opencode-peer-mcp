import { createServer, type IncomingMessage, type Server } from 'node:http';

// Local OpenAI-compatible model for the fixture OpenCode servers. It never
// contacts a model provider. Prompts pick the behavior:
// - `fixture-edit: <absolute path>` makes the session write that file.
// - `fixture-slow` holds the reply until the client disconnects or 60 s pass.
// - anything else gets the fixed reply.
export const FIXTURE_REPLY = 'FIXTURE_REPLY';
const EDIT_PATTERN = /fixture-edit: (\S+)/;
const SLOW_MARKER = 'fixture-slow';
const SLOW_MS = 60_000;

type Message = { role: string; content?: unknown };

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .flatMap((part) =>
        typeof part === 'object' &&
        part !== null &&
        (part as { type?: string }).type === 'text'
          ? [String((part as { text?: unknown }).text ?? '')]
          : [],
      )
      .join('\n');
  }
  return '';
}

function lastUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return textOf(messages[i].content);
  }
  return '';
}

type Reply =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; args: Record<string, string> };

function decide(messages: Message[]): Reply {
  const last = messages.at(-1);
  if (last?.role === 'tool') return { kind: 'text', text: FIXTURE_REPLY };
  const prompt = lastUserText(messages);
  const edit = EDIT_PATTERN.exec(prompt);
  if (edit) {
    return {
      kind: 'tool',
      name: 'write',
      args: { path: edit[1], content: 'written by fixture-edit\n' },
    };
  }
  return { kind: 'text', text: FIXTURE_REPLY };
}

function sse(payloads: unknown[]): string {
  return (
    payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join('') +
    'data: [DONE]\n\n'
  );
}

function completion(model: string, reply: Reply, stream: boolean): string {
  const id = 'chatcmpl-fixture';
  if (!stream) {
    const message =
      reply.kind === 'text'
        ? { role: 'assistant', content: reply.text }
        : {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_fixture',
                type: 'function',
                function: {
                  name: reply.name,
                  arguments: JSON.stringify(reply.args),
                },
              },
            ],
          };
    return JSON.stringify({
      id,
      object: 'chat.completion',
      created: 0,
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: reply.kind === 'text' ? 'stop' : 'tool_calls',
        },
      ],
    });
  }
  const chunk = (delta: unknown, finish: string | null) => ({
    id,
    object: 'chat.completion.chunk',
    created: 0,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });
  if (reply.kind === 'text') {
    return sse([
      chunk({ role: 'assistant', content: reply.text }, null),
      chunk({}, 'stop'),
    ]);
  }
  return sse([
    chunk(
      {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'call_fixture',
            type: 'function',
            function: {
              name: reply.name,
              arguments: JSON.stringify(reply.args),
            },
          },
        ],
      },
      null,
    ),
    chunk({}, 'tool_calls'),
  ]);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function startFixtureModel(port: number): Promise<Server> {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    const body = (await readJson(req)) as {
      model?: string;
      messages?: Message[];
      stream?: boolean;
    };
    const messages = body.messages ?? [];
    if (
      lastUserText(messages).includes(SLOW_MARKER) &&
      messages.at(-1)?.role !== 'tool'
    ) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, SLOW_MS);
        res.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    const reply = decide(messages);
    res.writeHead(200, {
      'content-type': body.stream ? 'text/event-stream' : 'application/json',
    });
    res.end(
      completion(body.model ?? 'fixture-model', reply, Boolean(body.stream)),
    );
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

export function stopFixtureModel(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}
