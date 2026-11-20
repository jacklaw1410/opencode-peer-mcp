import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';

const ROOT =
  process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ??
  '/tmp/opencode-peer-mcp-integration';
const ALPHA_PASSWORD = process.env.OPENCODE_ALPHA_PASSWORD ?? 'alpha-pass';
const BETA_PASSWORD = process.env.OPENCODE_BETA_PASSWORD ?? 'beta-pass';
function passwordFor(port: number): string {
  return port === 49421 ? ALPHA_PASSWORD : BETA_PASSWORD;
}
function basicAuth(password: string): string {
  return `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
}

export default async function globalTeardown(): Promise<void> {
  let pids: number[] = [];
  let state: { alphaSessionId?: string; betaSessionId?: string } = {};
  try {
    const parsed = JSON.parse(
      readFileSync(`${ROOT}/pids.json`, 'utf8'),
    ) as unknown;
    if (Array.isArray(parsed)) {
      pids = parsed.filter(
        (pid): pid is number => Number.isInteger(pid) && pid > 0,
      );
    }
  } catch {
    pids = [];
  }
  try {
    state = JSON.parse(readFileSync(`${ROOT}/state.json`, 'utf8')) as {
      alphaSessionId?: string;
      betaSessionId?: string;
    };
  } catch {
    state = {};
  }

  for (const [port, sessionId] of [
    [49421, state.alphaSessionId],
    [49422, state.betaSessionId],
  ] as const) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) continue;
    try {
      await fetch(`http://127.0.0.1:${port}/api/session/${sessionId}`, {
        method: 'DELETE',
        headers: { authorization: basicAuth(passwordFor(port)) },
      });
    } catch {
      // ignore cleanup failures
    }
  }

  for (const pid of pids) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  for (const pid of pids) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }

  await rm(ROOT, { recursive: true, force: true });
}
