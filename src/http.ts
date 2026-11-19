import type { ResolvedServer } from "./types.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export class HttpClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async request<T>(server: ResolvedServer, path: string, options: HttpRequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const url = new URL(path.replace(/^\/+/, ""), server.url.endsWith("/") ? server.url : `${server.url}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: "application/json" };
    if (server.auth === "basic" && server.username && server.password) {
      headers.authorization = `Basic ${Buffer.from(`${server.username}:${server.password}`).toString("base64")}`;
    } else if (server.auth === "bearer" && server.token) {
      headers.authorization = `Bearer ${server.token}`;
    }
    if (options.body !== undefined) headers["content-type"] = "application/json";

    const timeoutMs = options.timeoutMs ?? server.timeoutMs;
    const retries = method === "GET" ? 2 : 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        const contentLength = response.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
          throw new HttpError(413, `Response exceeds ${MAX_RESPONSE_BYTES} bytes`);
        }
        const text = await response.text();
        if (text.length > MAX_RESPONSE_BYTES) {
          throw new HttpError(413, `Response exceeds ${MAX_RESPONSE_BYTES} bytes`);
        }

        if (!response.ok) {
          if (attempt < retries && response.status >= 500) {
            lastError = new HttpError(response.status, `HTTP ${response.status}: ${text}`, text);
            continue;
          }
          throw new HttpError(response.status, `HTTP ${response.status}: ${text}`, text);
        }

        if (response.status === 204 || text === "") return undefined as T;
        return JSON.parse(text) as T;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        if (attempt >= retries) break;
        if (error instanceof HttpError) break;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error("Unknown HTTP error");
  }
}
