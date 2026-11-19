import { describe, expect, it, vi } from 'vitest';
import { PeerService } from '../src/service.js';
import type { ResolvedServer } from '../src/types.js';

const servers: ResolvedServer[] = [
  {
    id: 'local',
    url: 'http://example.test/',
    auth: 'none',
    timeoutMs: 1000,
    allowlist: ['session-1'],
  },
];

describe('PeerService', () => {
  it('lists servers without exposing secrets', () => {
    const http = { request: vi.fn() };
    const service = new PeerService({ servers, http: http as never });
    expect(service.listServers()).toEqual([
      {
        id: 'local',
        url: 'http://example.test/',
        auth: 'none',
        timeoutMs: 1000,
        allowlist: ['session-1'],
      },
    ]);
  });

  it('throws for an unknown server', async () => {
    const http = { request: vi.fn() };
    const service = new PeerService({ servers, http: http as never });
    await expect(service.listSessions('missing')).rejects.toThrow(
      /Unknown server/,
    );
  });

  it('clamps session list limit and passes directory', async () => {
    const http = { request: vi.fn(async () => ({ ok: true })) };
    const service = new PeerService({ servers, http: http as never });
    await service.listSessions('local', { limit: 500, directory: '/tmp' });
    expect(http.request).toHaveBeenCalledWith(servers[0], '/api/session', {
      query: { limit: 100, directory: '/tmp' },
    });
  });

  it('encodes session IDs when fetching a session', async () => {
    const http = { request: vi.fn(async () => ({ ok: true })) };
    const service = new PeerService({ servers, http: http as never });
    await service.getSession('local', 'a/b');
    expect(http.request).toHaveBeenCalledWith(servers[0], '/api/session/a%2Fb');
  });
});
