import { afterEach, describe, expect, it } from 'vitest';
import { FIXED_USERNAME, resolveAuth, toResolvedServer } from '../src/auth.js';
import type { ServerConfig } from '../src/types.js';

afterEach(() => {
  delete process.env.TEST_PASSWORD;
  delete process.env.TEST_TOKEN;
});

describe('resolveAuth', () => {
  it('resolves basic auth from env with fixed username', () => {
    process.env.TEST_PASSWORD = 'secret';
    const server: ServerConfig = {
      id: 'local',
      url: 'http://example.test',
      password_env: 'TEST_PASSWORD',
    };
    expect(resolveAuth(server)).toEqual({
      auth: 'basic',
      username: FIXED_USERNAME,
      password: 'secret',
    });
  });

  it('resolves bearer auth from env', () => {
    process.env.TEST_TOKEN = 'token';
    const server: ServerConfig = {
      id: 'remote',
      url: 'http://example.test',
      token_env: 'TEST_TOKEN',
      auth: 'bearer',
    };
    expect(resolveAuth(server)).toEqual({ auth: 'bearer', token: 'token' });
  });

  it('resolves none when no secret is configured', () => {
    const server: ServerConfig = { id: 'local', url: 'http://example.test' };
    expect(resolveAuth(server)).toEqual({ auth: 'none' });
  });

  it('throws when basic auth has no password env', () => {
    const server: ServerConfig = {
      id: 'local',
      url: 'http://example.test',
      auth: 'basic',
    };
    expect(() => resolveAuth(server)).toThrow(/no password_env/);
  });

  it('throws when the referenced env var is missing', () => {
    const server: ServerConfig = {
      id: 'local',
      url: 'http://example.test',
      password_env: 'MISSING_PASSWORD',
    };
    expect(() => resolveAuth(server)).toThrow(/not set/);
  });
});

describe('toResolvedServer', () => {
  it('applies defaults', () => {
    const server: ServerConfig = { id: 'local', url: 'http://example.test' };
    expect(toResolvedServer(server)).toMatchObject({
      id: 'local',
      url: 'http://example.test',
      auth: 'none',
      timeoutMs: 15000,
      allowlist: [],
    });
  });
});
