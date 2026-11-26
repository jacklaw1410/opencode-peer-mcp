import type { AuthMode, ResolvedServer, ServerConfig } from './types.js';

export const OPENCODE_USERNAME = 'opencode';
export const DEFAULT_TIMEOUT_MS = 15000;

export function resolveAuth(server: ServerConfig): {
  auth: AuthMode;
  username?: string;
  password?: string;
  token?: string;
} {
  const requested = server.auth;

  if (requested === 'basic') {
    if (!server.password_env) {
      throw new Error(
        `Server "${server.id}" uses basic auth but has no password_env`,
      );
    }
    const password = process.env[server.password_env];
    if (password === undefined) {
      throw new Error(
        `Environment variable "${server.password_env}" is not set for server "${server.id}"`,
      );
    }
    return {
      auth: 'basic',
      username: server.username ?? OPENCODE_USERNAME,
      password,
    };
  }

  if (requested === 'bearer') {
    if (!server.token_env) {
      throw new Error(
        `Server "${server.id}" uses bearer auth but has no token_env`,
      );
    }
    const token = process.env[server.token_env];
    if (token === undefined) {
      throw new Error(
        `Environment variable "${server.token_env}" is not set for server "${server.id}"`,
      );
    }
    return { auth: 'bearer', token };
  }

  return { auth: 'none' };
}

export function toResolvedServer(server: ServerConfig): ResolvedServer {
  const auth = resolveAuth(server);
  const timeoutMs = server.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  if (auth.auth === 'basic') {
    return {
      id: server.id,
      url: server.url,
      auth: 'basic',
      username: auth.username ?? OPENCODE_USERNAME,
      password: auth.password!,
      timeoutMs,
      allowlist: server.allowlist ?? [],
    };
  }
  if (auth.auth === 'bearer') {
    return {
      id: server.id,
      url: server.url,
      auth: 'bearer',
      token: auth.token!,
      timeoutMs,
      allowlist: server.allowlist ?? [],
    };
  }
  return {
    id: server.id,
    url: server.url,
    auth: 'none',
    timeoutMs,
    allowlist: server.allowlist ?? [],
  };
}
