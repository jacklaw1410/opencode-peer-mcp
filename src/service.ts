import type { ResolvedServer } from './types.js';
import { HttpClient } from './http.js';
import { Logger, type LogEntry } from './logger.js';
import { evaluatePermission } from './permission.js';

export interface PeerServiceOptions {
  servers: ResolvedServer[];
  http: HttpClient;
  writable?: boolean;
  logger?: Logger;
}

export interface SessionListOptions {
  limit?: number;
  directory?: string;
  order?: 'asc' | 'desc';
  search?: string;
  archived?: boolean;
  parentId?: string;
  cursor?: string;
  project?: string;
  subpath?: string;
}

export interface SessionMessageOptions {
  limit?: number;
  order?: 'asc' | 'desc';
  cursor?: string;
  type?: string;
}

export interface SessionDiffOptions {
  from?: string;
  to?: string;
  context?: number;
}

export interface WriteOptions {
  allowed?: boolean;
  waitFor?: number | null;
}

export class PeerService {
  private readonly writable: boolean;
  private readonly logger: Logger;

  constructor(private readonly options: PeerServiceOptions) {
    this.writable =
      options.writable ??
      process.env.OPENCODE_PEER_MCP_WRITE_ENABLED === 'true';
    this.logger = options.logger ?? new Logger();
  }

  listServers(): Array<{
    id: string;
    url: string;
    auth: ResolvedServer['auth'];
    timeoutMs: number;
    allowlist: string[];
  }> {
    return this.options.servers.map((server) => ({
      id: server.id,
      url: server.url,
      auth: server.auth,
      timeoutMs: server.timeoutMs,
      allowlist: server.allowlist,
    }));
  }

  getServer(id: string): {
    id: string;
    url: string;
    auth: ResolvedServer['auth'];
    timeoutMs: number;
    allowlist: string[];
  } {
    const server = this.resolveServer(id);
    return {
      id: server.id,
      url: server.url,
      auth: server.auth,
      timeoutMs: server.timeoutMs,
      allowlist: server.allowlist,
    };
  }

  private resolveServer(id: string): ResolvedServer {
    const server = this.options.servers.find((item) => item.id === id);
    if (!server) throw new Error(`Unknown server: ${id}`);
    return server;
  }

  async listSessions(
    serverId: string,
    params: SessionListOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const query: Record<string, string | number | undefined> = {
      limit,
    };
    if (params.directory) query.directory = params.directory;
    if (params.order) query.order = params.order;
    if (params.search) query.search = params.search;
    if (params.archived !== undefined) query.archived = String(params.archived);
    if (params.parentId) query.parentID = params.parentId;
    if (params.cursor) query.cursor = params.cursor;
    if (params.project) query.project = params.project;
    if (params.subpath) query.subpath = params.subpath;
    return this.options.http.request(server, '/api/session', { query });
  }

  async getSession(serverId: string, sessionId: string): Promise<unknown> {
    const server = this.resolveServer(serverId);
    return this.options.http.request(
      server,
      `/api/session/${encodeURIComponent(sessionId)}`,
    );
  }

  async schedulePrompt(
    serverId: string,
    sessionId: string,
    prompt: string,
    delay: string,
    options: WriteOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const allowlisted =
      server.allowlist.includes('*') ||
      server.allowlist.includes(sessionId) ||
      Boolean(options.allowed);
    const gate = evaluatePermission({
      globalEnabled: this.writable,
      allowlisted,
      explicitAllow: Boolean(options.allowed),
    });
    if (!gate.allowed) {
      await this.log(
        serverId,
        sessionId,
        'session_schedule',
        gate.decision,
        'denied',
      );
      throw new Error(`Write denied: ${gate.decision}`);
    }

    const fireIn = parseDelay(delay);
    if (fireIn === null) {
      throw new Error(
        `Cannot parse delay: ${delay}. Use a duration like "30s", "5m", "1h" or an ISO timestamp like "2026-11-22T13:00:00". Max 1 hour, min 1 second.`,
      );
    }

    const fireAt = new Date(Date.now() + fireIn).toISOString();

    setTimeout(async () => {
      try {
        await this.options.http.request(
          server,
          `/api/session/${encodeURIComponent(sessionId)}/prompt`,
          {
            method: 'POST',
            body: { text: prompt },
          },
        );
        await this.log(
          serverId,
          sessionId,
          'session_schedule',
          gate.decision,
          'success',
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.log(
          serverId,
          sessionId,
          'session_schedule',
          gate.decision,
          `error: ${msg}`,
        );
      }
    }, fireIn);

    await this.log(
      serverId,
      sessionId,
      'session_schedule',
      gate.decision,
      'scheduled',
    );
    return { scheduled: true, fires_at: fireAt, delay_ms: fireIn };
  }

  async getSessionStatus(
    serverId: string,
    sessionId: string,
  ): Promise<unknown> {
    const session = (await this.getSession(serverId, sessionId)) as {
      data?: { time?: { busy?: number; idle?: number } };
    };
    const record = (session as { data?: unknown }).data ?? session;
    const time = (record as { time?: { busy?: number; idle?: number } }).time;
    const busy = time?.busy ?? 0;
    const idle = time?.idle ?? 0;
    const status = busy > idle ? 'busy' : 'idle';
    return { status, session };
  }

  async getSessionMessages(
    serverId: string,
    sessionId: string,
    params: SessionMessageOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const query: Record<string, string | number | undefined> = { limit };
    if (params.order) query.order = params.order;
    if (params.cursor) query.cursor = params.cursor;
    if (params.type) query.type = params.type;
    return this.options.http.request(
      server,
      `/api/session/${encodeURIComponent(sessionId)}/message`,
      { query },
    );
  }

  async getSessionDiff(
    serverId: string,
    sessionId: string,
    params: SessionDiffOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const query: Record<string, string | number | undefined> = {};
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.context !== undefined) query.context = params.context;
    return this.options.http.request(
      server,
      `/api/session/${encodeURIComponent(sessionId)}/diff`,
      { query },
    );
  }

  async searchSessions(
    serverIds: string[] | undefined,
    query: string,
    limit = 20,
  ): Promise<unknown> {
    const targets =
      serverIds && serverIds.length > 0
        ? serverIds.map((id) => this.resolveServer(id))
        : this.options.servers;
    const perServerLimit = Math.min(Math.max(limit, 1), 50);
    const results = await Promise.all(
      targets.map(async (server) => {
        const response = (await this.options.http.request(
          server,
          '/api/session',
          {
            query: { limit: perServerLimit, search: query },
          },
        )) as { data?: unknown[] };
        const items = Array.isArray(response?.data) ? response.data : [];
        return items.map((item) => ({ server: server.id, session: item }));
      }),
    );
    return results.flat();
  }

  async compareSessions(
    serverA: string,
    sessionA: string,
    serverB: string,
    sessionB: string,
  ): Promise<unknown> {
    const [a, b] = await Promise.all([
      this.getSession(serverA, sessionA),
      this.getSession(serverB, sessionB),
    ]);
    return {
      a: { server: serverA, session: a },
      b: { server: serverB, session: b },
    };
  }

  async createSession(
    serverId: string,
    params: Record<string, unknown>,
    options: WriteOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const allowlisted =
      server.allowlist.includes('*') ||
      server.allowlist.includes('create') ||
      Boolean(options.allowed);
    const gate = evaluatePermission({
      globalEnabled: this.writable,
      allowlisted,
      explicitAllow: Boolean(options.allowed),
    });
    let result = 'denied';
    let sessionId = '__create__';
    let response: unknown;
    if (gate.allowed) {
      try {
        response = await this.options.http.request(server, '/api/session', {
          method: 'POST',
          body: params,
        });
        const data = (response as { data?: { id?: string } })?.data;
        result = 'success';
        sessionId = data?.id ?? sessionId;
      } catch (error) {
        result = `error: ${error instanceof Error ? error.message : String(error)}`;
        await this.log(
          serverId,
          sessionId,
          'session_create',
          gate.decision,
          result,
        );
        throw error;
      }
    }
    await this.log(
      serverId,
      sessionId,
      'session_create',
      gate.decision,
      result,
    );
    if (!gate.allowed) throw new Error(`Write denied: ${gate.decision}`);
    return response;
  }

  async promptSession(
    serverId: string,
    sessionId: string,
    prompt: string,
    options: WriteOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const allowlisted =
      server.allowlist.includes('*') ||
      server.allowlist.includes(sessionId) ||
      Boolean(options.allowed);
    const gate = evaluatePermission({
      globalEnabled: this.writable,
      allowlisted,
      explicitAllow: Boolean(options.allowed),
    });
    let result = 'denied';
    if (gate.allowed) {
      try {
        const response = await this.options.http.request(
          server,
          `/api/session/${encodeURIComponent(sessionId)}/prompt`,
          { method: 'POST', body: { text: prompt } },
        );
        result = 'success';

        // Await mode: poll until idle or timeout
        const waitFor = options.waitFor;
        if (waitFor && waitFor > 0) {
          const timeoutMs = Math.min(Math.max(waitFor, 1000), 300000);
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            const status = (await this.getSessionStatus(
              serverId,
              sessionId,
            )) as { status: string };
            if (status.status === 'idle') break;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          // Fetch latest messages
          const messages = (await this.getSessionMessages(serverId, sessionId, {
            limit: 5,
            order: 'desc',
          })) as { data?: unknown[] };
          const data =
            messages?.data ?? (Array.isArray(messages) ? messages : []);
          const assistantMsg = (data as any[]).find(
            (m: any) => m.type === 'assistant',
          );
          await this.log(
            serverId,
            sessionId,
            'session_prompt',
            gate.decision,
            result,
          );
          return {
            prompt: response,
            awaited: true,
            timed_out: Date.now() >= deadline,
            message: assistantMsg ?? null,
          };
        }

        await this.log(
          serverId,
          sessionId,
          'session_prompt',
          gate.decision,
          result,
        );
        return response;
      } catch (error) {
        result = `error: ${error instanceof Error ? error.message : String(error)}`;
        await this.log(
          serverId,
          sessionId,
          'session_prompt',
          gate.decision,
          result,
        );
        throw error;
      }
    }
    await this.log(
      serverId,
      sessionId,
      'session_prompt',
      gate.decision,
      result,
    );
    throw new Error(`Write denied: ${gate.decision}`);
  }

  async interruptSession(
    serverId: string,
    sessionId: string,
    options: WriteOptions = {},
  ): Promise<unknown> {
    const server = this.resolveServer(serverId);
    const allowlisted =
      server.allowlist.includes('*') ||
      server.allowlist.includes(sessionId) ||
      Boolean(options.allowed);
    const gate = evaluatePermission({
      globalEnabled: this.writable,
      allowlisted,
      explicitAllow: Boolean(options.allowed),
    });
    let result = 'denied';
    if (gate.allowed) {
      try {
        const response = await this.options.http.request(
          server,
          `/api/session/${encodeURIComponent(sessionId)}/interrupt`,
          { method: 'POST' },
        );
        result = 'success';
        await this.log(
          serverId,
          sessionId,
          'session_interrupt',
          gate.decision,
          result,
        );
        return response;
      } catch (error) {
        result = `error: ${error instanceof Error ? error.message : String(error)}`;
        await this.log(
          serverId,
          sessionId,
          'session_interrupt',
          gate.decision,
          result,
        );
        throw error;
      }
    }
    await this.log(
      serverId,
      sessionId,
      'session_interrupt',
      gate.decision,
      result,
    );
    throw new Error(`Write denied: ${gate.decision}`);
  }

  private async log(
    server: string,
    session: string,
    tool: string,
    allowlistDecision: string,
    result: string,
  ): Promise<void> {
    const level =
      result === 'success'
        ? 'info'
        : result.startsWith('denied')
          ? 'warn'
          : 'error';
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      server,
      session,
      tool,
      allowlistDecision,
      result,
    };
    await this.logger.log(entry);
  }
}

function parseDelay(input: string): number | null {
  const parsed = Date.parse(input);
  if (!isNaN(parsed)) {
    const delay = parsed - Date.now();
    const clamped = delay < 0 ? 0 : delay;
    if (clamped > 60 * 60 * 1000 || clamped < 1000) return null;
    return clamped;
  }
  const cleaned = input.replace(/^in\s+/i, '').trim();
  const match = cleaned.match(
    /^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?)$/i,
  );
  if (match) {
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = 0;
    if (unit.startsWith('s')) ms = n * 1000;
    else if (unit.startsWith('m')) ms = n * 60 * 1000;
    else if (unit.startsWith('h')) ms = n * 60 * 60 * 1000;
    if (ms > 60 * 60 * 1000 || ms < 1000) return null;
    return ms;
  }
  const parts = cleaned.match(/(\d+)\s*(h|m|s)/gi);
  if (parts && parts.length > 1) {
    let total = 0;
    for (const part of parts) {
      const m = part.match(/(\d+)\s*(h|m|s)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        const u = m[2].toLowerCase();
        if (u === 'h') total += n * 3600000;
        else if (u === 'm') total += n * 60000;
        else if (u === 's') total += n * 1000;
      }
    }
    if (total > 60 * 60 * 1000 || total < 1000) return null;
    return total > 0 ? total : null;
  }
  return null;
}
