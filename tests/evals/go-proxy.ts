import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import {
  chatToResponses,
  responsesToChat,
  type ItemStore,
  type JsonObject,
} from './responses-translate.js';

export interface GoProxy {
  baseUrl: string;
  close(): Promise<void>;
}

export interface GoProxyOptions {
  apiKey: string;
  clientToken: string;
  upstream?: string;
  upstreamTimeoutMs?: number;
  // When set, each upstream exchange is appended here as one JSON line.
  // Request headers are not logged, so the Go key and proxy token stay out.
  logFile?: string;
}

const DEFAULT_UPSTREAM = 'https://opencode.ai/inference/go/openai/v1';
// Non-streaming responses send no headers until generation finishes, so this
// must exceed the longest expected generation. Caps a single upstream call.
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 240_000;
// The AI SDK retries 5xx responses (maxRetries 2), so one stalled call can
// hold a trial for this many timeouts. evals.spec.ts sizes test budgets with it.
export const MAX_UPSTREAM_ATTEMPTS = 3;
const UPSTREAM_TIMEOUT_STATUS = 'Service Unavailable 503 upstream timed out';
// Only the endpoints the host loop and the judge call. Paths are matched after
// URL normalization, so `..` segments cannot reach other upstream routes.
const ALLOWED_PATHS = new Set([
  '/v1/chat/completions',
  '/v1/responses',
  '/v1/models',
]);
const USER_AGENT = 'opencode-peer-mcp-evals/1.0';
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];
const DROP_REQUEST_HEADERS = new Set([
  ...HOP_BY_HOP,
  'host',
  'content-length',
  'accept-encoding',
  'authorization',
  'x-opencode-session',
  'user-agent',
]);
const DROP_RESPONSE_HEADERS = new Set([
  ...HOP_BY_HOP,
  'content-length',
  'content-encoding',
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Each eval trial and each judge call opens a fresh conversation. The AI SDK
// replays earlier turns as assistant/tool messages (chat) or item_reference
// entries (responses), so those requests continue the current Go session.
export function opensNewConversation(
  path: string,
  body: Uint8Array | undefined,
): boolean {
  if (!body) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body).toString('utf8'));
  } catch {
    return false;
  }
  if (!isObject(payload)) return false;

  if (path === '/v1/chat/completions') {
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    return !messages.some(
      (message) =>
        isObject(message) &&
        (message.role === 'assistant' || message.role === 'tool'),
    );
  }
  if (path === '/v1/responses') {
    const input = Array.isArray(payload.input)
      ? payload.input
      : typeof payload.input === 'string'
        ? [payload.input]
        : [];
    return !input.some(
      (item) =>
        isObject(item) &&
        (item.type === 'item_reference' ||
          item.type === 'function_call' ||
          item.type === 'reasoning' ||
          item.role === 'assistant'),
    );
  }
  return false;
}

function copyHeaders(source: IncomingHttpHeaders, drop: Set<string>): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined || drop.has(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

async function withIdleTimeout<T>(
  pending: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(
  req: AsyncIterable<Buffer>,
  idleMs: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const iterator = req[Symbol.asyncIterator]();
  for (;;) {
    const next = await withIdleTimeout(
      iterator.next(),
      idleMs,
      `client request body stalled for ${idleMs} ms`,
    );
    if (next.done) return Buffer.concat(chunks);
    chunks.push(next.value);
  }
}

function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(text);
}

function logExchange(
  file: string | undefined,
  entry: {
    path: string;
    status: number;
    session: string;
    request?: Uint8Array;
    response: Uint8Array;
  },
): void {
  if (!file) return;
  const line = {
    time: new Date().toISOString(),
    path: entry.path,
    status: entry.status,
    session: entry.session,
    request: entry.request
      ? Buffer.from(entry.request).toString('utf8').slice(0, 20000)
      : undefined,
    response: Buffer.from(entry.response).toString('utf8').slice(0, 4000),
  };
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

export async function startGoProxy(options: GoProxyOptions): Promise<GoProxy> {
  const upstream = options.upstream ?? DEFAULT_UPSTREAM;
  const upstreamTimeoutMs =
    options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  let sessionId = `ses_${randomUUID()}`;
  const expectedAuth = `Bearer ${options.clientToken}`;
  let items: ItemStore = new Map();

  async function forward(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!ALLOWED_PATHS.has(url.pathname)) {
      sendText(res, 404, 'not found');
      return;
    }
    if (req.headers.authorization !== expectedAuth) {
      sendText(res, 401, 'missing or invalid proxy token');
      return;
    }

    const controller = new AbortController();
    let idleTimer: NodeJS.Timeout | undefined;
    let timedOut = false;
    // The body is buffered, so one timer covers headers and body. A stall at
    // either point aborts the call and returns 503 before any header is sent.
    const startTimer = () => {
      idleTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, upstreamTimeoutMs);
    };
    const stopTimer = () => clearTimeout(idleTimer);
    res.on('close', () => {
      stopTimer();
      controller.abort();
    });
    const headers = copyHeaders(req.headers, DROP_REQUEST_HEADERS);
    headers.set('authorization', `Bearer ${options.apiKey}`);
    headers.set('user-agent', USER_AGENT);

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    let body: Uint8Array | undefined;
    if (hasBody) {
      try {
        body = new Uint8Array(await readBody(req, upstreamTimeoutMs));
      } catch (error) {
        res.setHeader('connection', 'close');
        sendText(
          res,
          408,
          error instanceof Error ? error.message : 'request body read failed',
        );
        return;
      }
    }

    if (opensNewConversation(url.pathname, body)) {
      sessionId = `ses_${randomUUID()}`;
      // Responses item references are conversation-local. Drop them with the
      // session so a later case cannot resolve an earlier case's tool output.
      items = new Map();
    }
    headers.set('x-opencode-session', sessionId);

    const translate = url.pathname === '/v1/responses';
    let upstreamPath = url.pathname.slice('/v1'.length);
    let upstreamBody = body;
    if (translate) {
      if (req.method !== 'POST' || !body) {
        sendText(res, 405, 'only POST /v1/responses is supported');
        return;
      }
      try {
        const chat = responsesToChat(
          JSON.parse(Buffer.from(body).toString('utf8')) as JsonObject,
          items,
        );
        upstreamPath = '/chat/completions';
        upstreamBody = new Uint8Array(Buffer.from(JSON.stringify(chat)));
      } catch (error) {
        sendText(
          res,
          400,
          error instanceof Error ? error.message : 'invalid request',
        );
        return;
      }
    }

    startTimer();
    try {
      const upstreamRes = await fetch(
        `${upstream}${upstreamPath}${url.search}`,
        {
          method: req.method,
          headers,
          body: upstreamBody,
          signal: controller.signal,
        },
      );
      const payload = Buffer.from(await upstreamRes.arrayBuffer());
      stopTimer();
      logExchange(options.logFile, {
        path: url.pathname,
        status: upstreamRes.status,
        session: sessionId,
        request: body,
        response: payload,
      });
      const outPayload =
        translate && upstreamRes.ok
          ? Buffer.from(
              JSON.stringify(
                chatToResponses(
                  JSON.parse(payload.toString('utf8')) as JsonObject,
                  items,
                ),
              ),
            )
          : payload;
      res.writeHead(
        upstreamRes.status,
        Object.fromEntries(
          copyHeaders(
            Object.fromEntries(upstreamRes.headers.entries()),
            DROP_RESPONSE_HEADERS,
          ).entries(),
        ),
      );
      res.end(outPayload);
    } catch (error) {
      stopTimer();
      if (timedOut) {
        res.writeHead(503, UPSTREAM_TIMEOUT_STATUS, {
          'content-type': 'text/plain',
        });
        res.end(`go proxy upstream timed out after ${upstreamTimeoutMs} ms`);
        return;
      }
      throw error;
    }
  }

  const server: Server = createServer((req, res) => {
    forward(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendText(res, 502, `go proxy upstream error: ${message}`);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('go proxy failed to bind');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
