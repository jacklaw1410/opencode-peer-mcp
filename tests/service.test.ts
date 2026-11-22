import { describe, expect, it, mock } from 'bun:test';
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
    const http = { request: mock() };
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
    const http = { request: mock() };
    const service = new PeerService({ servers, http: http as never });
    await expect(service.listSessions('missing')).rejects.toThrow(
      /Unknown server/,
    );
  });

  it('clamps session list limit and passes directory', async () => {
    const http = { request: mock(async () => ({ ok: true })) };
    const service = new PeerService({ servers, http: http as never });
    await service.listSessions('local', { limit: 500, directory: '/tmp' });
    expect(http.request).toHaveBeenCalledWith(servers[0], '/api/session', {
      query: { limit: 100, directory: '/tmp' },
    });
  });

  it('encodes session IDs when fetching a session', async () => {
    const http = { request: mock(async () => ({ ok: true })) };
    const service = new PeerService({ servers, http: http as never });
    await service.getSession('local', 'a/b');
    expect(http.request).toHaveBeenCalledWith(servers[0], '/api/session/a%2Fb');
  });

  it('derives session status from timing', async () => {
    const http = {
      request: mock(async () => ({ data: { time: { busy: 10, idle: 5 } } })),
    };
    const service = new PeerService({ servers, http: http as never });
    await expect(
      service.getSessionStatus('local', 'session-1'),
    ).resolves.toMatchObject({ status: 'busy' });
  });

  it('passes message filters', async () => {
    const http = { request: mock(async () => ({ data: [] })) };
    const service = new PeerService({ servers, http: http as never });
    await service.getSessionMessages('local', 'session-1', {
      limit: 10,
      order: 'desc',
      type: 'user',
    });
    expect(http.request).toHaveBeenCalledWith(
      servers[0],
      '/api/session/session-1/message',
      {
        query: { limit: 10, order: 'desc', type: 'user' },
      },
    );
  });

  it('passes diff options', async () => {
    const http = { request: mock(async () => ({ data: [] })) };
    const service = new PeerService({ servers, http: http as never });
    await service.getSessionDiff('local', 'session-1', {
      from: 'm1',
      to: 'm2',
      context: 3,
    });
    expect(http.request).toHaveBeenCalledWith(
      servers[0],
      '/api/session/session-1/diff',
      {
        query: { from: 'm1', to: 'm2', context: 3 },
      },
    );
  });

  it('searches selected servers', async () => {
    const http = { request: mock(async () => ({ data: [{ id: 's1' }] })) };
    const service = new PeerService({ servers, http: http as never });
    const result = await service.searchSessions(['local'], 'foo', 5);
    expect(result).toEqual([{ server: 'local', session: { id: 's1' } }]);
  });

  it('compares two sessions', async () => {
    const http = { request: mock(async () => ({ data: { id: 's1' } })) };
    const service = new PeerService({ servers, http: http as never });
    const result = (await service.compareSessions(
      'local',
      'a',
      'local',
      'b',
    )) as { a: unknown; b: unknown };
    expect(result.a).toMatchObject({ server: 'local' });
    expect(result.b).toMatchObject({ server: 'local' });
  });
});

describe('PeerService writes', () => {
  it('denies writes when the gate is closed', async () => {
    const http = { request: mock() };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: false,
      logger: logger as never,
    });
    await expect(
      service.promptSession('local', 'session-1', 'hello', { allowed: true }),
    ).rejects.toThrow(/Write denied/);
    expect(http.request).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });

  it('allows writes when enabled and allowlisted', async () => {
    const http = { request: mock(async () => ({ ok: true })) };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    await service.promptSession('local', 'session-1', 'hello');
    expect(http.request).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });

  it('awaits remote response when wait_for is set', async () => {
    let callCount = 0;
    const http = {
      request: mock(async (server: unknown, path: string) => {
        if (path.includes('/prompt')) return { data: { id: 'msg-1' } };
        if (path.includes('/message')) {
          return {
            data: [
              { type: 'assistant', content: [{ type: 'text', text: 'done' }] },
            ],
          };
        }
        if (path.includes('/session/')) {
          callCount++;
          if (callCount >= 2) {
            return { data: { time: { busy: 1, idle: 2 } } };
          }
          return { data: { time: { busy: 2, idle: 1 } } };
        }
        return { data: [] };
      }),
    };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    const result = (await service.promptSession('local', 'session-1', 'hello', {
      waitFor: 5000,
    })) as { awaited: boolean; timed_out: boolean; message: unknown };
    expect(result.awaited).toBe(true);
    expect(result.timed_out).toBe(false);
  });

  it('returns timed_out when await exceeds timeout', async () => {
    const http = {
      request: mock(async (server: unknown, path: string) => {
        if (path.includes('/prompt')) return { data: { id: 'msg-1' } };
        if (path.includes('/message')) return { data: [] };
        return { data: { time: { busy: 10, idle: 1 } } };
      }),
    };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    const result = (await service.promptSession('local', 'session-1', 'hello', {
      waitFor: 1000,
    })) as { awaited: boolean; timed_out: boolean };
    expect(result.awaited).toBe(true);
    expect(result.timed_out).toBe(true);
  });

  it('returns immediately when wait_for is null', async () => {
    const http = { request: mock(async () => ({ data: { id: 'msg-1' } })) };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    const result = await service.promptSession('local', 'session-1', 'hello', {
      waitFor: null,
    });
    expect((result as { awaited?: boolean }).awaited).toBeUndefined();
  });

  it('schedules a prompt with a relative delay', async () => {
    const http = { request: mock(async () => ({ ok: true })) };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    const result = (await service.schedulePrompt(
      'local',
      'session-1',
      'hello',
      '5s',
    )) as { scheduled: boolean; delay_ms: number };
    expect(result.scheduled).toBe(true);
    expect(result.delay_ms).toBe(5000);
    expect(logger.log).toHaveBeenCalled();
  });

  it('schedules a prompt with an absolute timestamp', async () => {
    const http = { request: mock(async () => ({ ok: true })) };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    const future = new Date(Date.now() + 30000).toISOString();
    const result = (await service.schedulePrompt(
      'local',
      'session-1',
      'hello',
      future,
    )) as { scheduled: boolean; delay_ms: number };
    expect(result.scheduled).toBe(true);
    expect(result.delay_ms).toBeGreaterThan(0);
  });

  it('rejects invalid delay', async () => {
    const http = { request: mock() };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    await expect(
      service.schedulePrompt('local', 'session-1', 'hello', 'not-a-delay'),
    ).rejects.toThrow(/Cannot parse delay/);
  });

  it('rejects delay over 1 hour', async () => {
    const http = { request: mock() };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: true,
      logger: logger as never,
    });
    await expect(
      service.schedulePrompt('local', 'session-1', 'hello', '2h'),
    ).rejects.toThrow(/Delay exceeds 1 hour/);
  });

  it('denies schedule when gate is closed', async () => {
    const http = { request: mock() };
    const logger = { log: mock(async () => undefined) };
    const service = new PeerService({
      servers,
      http: http as never,
      writable: false,
      logger: logger as never,
    });
    await expect(
      service.schedulePrompt('local', 'session-1', 'hello', '5s', {
        allowed: true,
      }),
    ).rejects.toThrow(/Write denied/);
    expect(http.request).not.toHaveBeenCalled();
  });
});
