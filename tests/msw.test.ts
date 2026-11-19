import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HttpClient } from '../src/http.js';
import { PeerService } from '../src/service.js';
import type { ResolvedServer } from '../src/types.js';

const server = setupServer(
  http.get('http://example.test/api/session', () =>
    HttpResponse.json({
      data: [{ id: 'session-1', title: 'Test' }],
      cursor: { previous: null, next: null },
    }),
  ),
);

const resolved: ResolvedServer = {
  id: 'local',
  url: 'http://example.test/',
  auth: 'none',
  timeoutMs: 1000,
  allowlist: [],
};

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MSW HTTP mocking', () => {
  it('fetches sessions through the real HTTP client', async () => {
    const service = new PeerService({
      servers: [resolved],
      http: new HttpClient(),
    });
    const result = (await service.listSessions('local')) as {
      data: Array<{ id: string }>;
    };
    expect(result.data).toEqual([{ id: 'session-1', title: 'Test' }]);
  });
});
