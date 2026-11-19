export type AuthMode = "basic" | "bearer" | "none";

export interface ServerConfig {
  id: string;
  url: string;
  password_env?: string;
  token_env?: string;
  auth?: AuthMode;
  timeout_ms?: number;
  allowlist?: string[];
}

export interface ResolvedServer {
  id: string;
  url: string;
  auth: AuthMode;
  username?: string;
  password?: string;
  token?: string;
  timeoutMs: number;
  allowlist: string[];
}
