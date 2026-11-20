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
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      server,
      session,
      tool,
      allowlistDecision,
      result,
    };
    await this.logger.record(entry);
  }
}
