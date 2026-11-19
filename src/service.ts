import type { ResolvedServer } from './types.js';
import { HttpClient } from './http.js';

export interface PeerServiceOptions {
  servers: ResolvedServer[];
  http: HttpClient;
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

  getServer(id: string): ResolvedServer {
    const server = this.options.servers.find((item) => item.id === id);
    if (!server) throw new Error(`Unknown server: ${id}`);
    return server;
  }

  async listSessions(
    serverId: string,
    params: { limit?: number; directory?: string } = {},
  ): Promise<unknown> {
    const server = this.getServer(serverId);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    return this.options.http.request(server, '/api/session', {
      query: { limit, directory: params.directory },
    });
  }

  async getSession(serverId: string, sessionId: string): Promise<unknown> {
    const server = this.getServer(serverId);
    return this.options.http.request(
      server,
      `/api/session/${encodeURIComponent(sessionId)}`,
    );
  }
}
