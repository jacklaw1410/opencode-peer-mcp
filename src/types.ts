export type AuthMode = 'basic' | 'bearer' | 'none';

export interface ServerConfig {
  id: string;
  url: string;
  username?: string;
  password_env?: string;
  token_env?: string;
  auth: AuthMode;
  timeout_ms?: number;
  allowlist?: string[];
}

export type ResolvedServer =
  | {
      id: string;
      url: string;
      auth: 'basic';
      username: string;
      password: string;
      timeoutMs: number;
      allowlist: string[];
    }
  | {
      id: string;
      url: string;
      auth: 'bearer';
      token: string;
      timeoutMs: number;
      allowlist: string[];
    }
  | {
      id: string;
      url: string;
      auth: 'none';
      timeoutMs: number;
      allowlist: string[];
    };
