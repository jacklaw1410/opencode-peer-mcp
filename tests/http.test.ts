import { describe, expect, it, mock } from 'bun:test';
import { HttpClient, HttpError } from '../src/http.js';
import type { ResolvedServer } from '../src/types.js';

const server: ResolvedServer = {
  id: 'local',
  url: 'http://example.test/',
  auth: 'basic',
  username: 'opencode',
  password: 'secret',
  timeoutMs: 1000,
  allowlist: [],
};

describe('HttpClient', () => {
  it('sends basic auth and parses JSON', async () => {
    const fetchImpl = mock(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const client = new HttpClient(fetchImpl as unknown as typeof fetch);
    const result = await client.request(server, '/api/session');
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
  });

  it('throws HttpError on non-ok responses', async () => {
    const fetchImpl = mock(async () => new Response('nope', { status: 404 }));
    const client = new HttpClient(fetchImpl as unknown as typeof fetch);
    await expect(
      client.request(server, '/api/session/missing'),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
