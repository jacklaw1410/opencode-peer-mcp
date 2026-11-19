import type { AuthMode, ResolvedServer, ServerConfig } from './types.js';

export const FIXED_USERNAME = 'opencode';

export function resolveAuth(server: ServerConfig): {
  auth: AuthMode;
  username?: string;
  password?: string;
  token?: string;
} {
  const requested =
    server.auth ??
    (server.password_env ? 'basic' : server.token_env ? 'bearer' : 'none');

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
    return { auth: 'basic', username: FIXED_USERNAME, password };
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
  return {
    id: server.id,
    url: server.url,
    auth: auth.auth,
    username: auth.username,
    password: auth.password,
    token: auth.token,
    timeoutMs: server.timeout_ms ?? 15000,
    allowlist: server.allowlist ?? [],
  };
}
