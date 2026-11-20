import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT =
  process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ??
  '/tmp/opencode-peer-mcp-integration';
const resolvedRoot = path.resolve(ROOT);
const allowedRoot = path.resolve(os.tmpdir());
if (!resolvedRoot.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error(`Unsafe integration root: ${resolvedRoot}`);
}
const PASSWORD = process.env.OPENCODE_PASSWORD ?? 'testpass';

function basicAuth(): string {
  return `Basic ${Buffer.from(`opencode:${PASSWORD}`).toString('base64')}`;
}

async function waitForServer(port: number): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/session?limit=1`, {
        headers: { authorization: basicAuth() },
      });
      if (res.status < 500) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`OpenCode server on port ${port} did not become ready`);
}

async function createSession(port: number): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/api/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basicAuth(),
    },
    body: JSON.stringify({
      directory: `${ROOT}/work`,
      title: 'peer-mcp-fixture',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create fixture session: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data?: { id?: string }; id?: string };
  const id = json.data?.id ?? json.id;
  if (!id) throw new Error('Fixture session response missing id');
  return id;
}

async function stopServers(pids: number[]): Promise<void> {
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
}

export default async function globalSetup(): Promise<void> {
  const pids: number[] = [];
  try {
    await rm(ROOT, { recursive: true, force: true });
    await mkdir(ROOT, { recursive: true });
    await mkdir(`${ROOT}/work`, { recursive: true });

    for (const port of [49421, 49422]) {
      const child = spawn(
        'opencode',
        ['serve', '--hostname', '127.0.0.1', '--port', String(port)],
        {
          env: {
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
            OPENCODE_PASSWORD: PASSWORD,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        },
      );
      child.unref();
      if (!child.pid)
        throw new Error(`Failed to spawn OpenCode on port ${port}`);
      const logStream = createWriteStream(`${ROOT}/opencode-${port}.log`, {
        flags: 'a',
      });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
      pids.push(child.pid);
    }

    await Promise.all([waitForServer(49421), waitForServer(49422)]);

    const [alphaSessionId, betaSessionId] = await Promise.all([
      createSession(49421),
      createSession(49422),
    ]);

    const yaml = [
      'servers:',
      '  - id: alpha',
      '    url: http://127.0.0.1:49421',
      '    password_env: OPENCODE_ALPHA_PASSWORD',
      '    allowlist:',
      `      - '${alphaSessionId}'`,
      "      - 'create'",
      '  - id: beta',
      '    url: http://127.0.0.1:49422',
      '    password_env: OPENCODE_BETA_PASSWORD',
      '',
    ].join('\n');
    await writeFile(`${ROOT}/servers.yaml`, yaml, 'utf8');

    await writeFile(
      `${ROOT}/state.json`,
      JSON.stringify({ alphaSessionId, betaSessionId }, null, 2),
      'utf8',
    );
    await writeFile(`${ROOT}/pids.json`, JSON.stringify(pids), 'utf8');
  } catch (error) {
    for (const port of [49421, 49422]) {
      try {
        const { readFileSync } = await import('node:fs');
        console.error(`--- opencode ${port} log ---`);
        console.error(
          readFileSync(`${ROOT}/opencode-${port}.log`, 'utf8').slice(-4000),
        );
      } catch {
        // ignore
      }
    }
    await stopServers(pids);
    await rm(ROOT, { recursive: true, force: true });
    throw error;
  }
}
