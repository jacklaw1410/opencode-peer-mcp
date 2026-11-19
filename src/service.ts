import type { ResolvedServer } from './types.js';
import { HttpClient } from './http.js';

export interface PeerServiceOptions {
  servers: ResolvedServer[];
  http: HttpClient;
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

export class PeerService {
  constructor(private readonly options: PeerServiceOptions) {}

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
}
