import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, readFileSync, rmSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { connect } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startFixtureModel, stopFixtureModel } from './fixture-model.js';

export const ROOT = path.resolve(
  process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ??
    '/tmp/opencode-peer-mcp-integration',
);
if (!ROOT.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) {
  throw new Error(`Unsafe integration root: ${ROOT}`);
}

export const SERVERS = {
  alpha: {
    port: 49421,
    password: process.env.OPENCODE_ALPHA_PASSWORD ?? 'alpha-pass',
  },
  beta: {
    port: 49422,
    password: process.env.OPENCODE_BETA_PASSWORD ?? 'beta-pass',
  },
} as const;

export const MODEL_PORT = 49423;
const MODEL_PROVIDER = 'fixture';
const MODEL_ID = 'fixture-model';

type Session = { port: number; password: string; id: string };
type Running = { pids: number[]; sessions: Session[]; model?: Server };

let running: Running | undefined;

function fixtureConfig(): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      model: `${MODEL_PROVIDER}/${MODEL_ID}`,
      providers: {
        [MODEL_PROVIDER]: {
          name: 'Fixture',
          package: '@opencode/ai/providers/openai-compatible',
          settings: { baseURL: `http://127.0.0.1:${MODEL_PORT}/v1` },
          models: { [MODEL_ID]: { name: 'Fixture model' } },
        },
      },
    },
    null,
    2,
  );
}

function basicAuth(password: string): string {
  return `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already exited
    }
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForPortsClosed(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ports = [
      ...Object.values(SERVERS).map((server) => server.port),
      MODEL_PORT,
    ];
    const open = await Promise.all(ports.map((port) => isPortOpen(port)));
    if (!open.some(Boolean)) return true;
    await sleep(200);
  }
  return false;
}

async function waitForServer(port: number, password: string): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/session?limit=1`, {
        headers: { authorization: basicAuth(password) },
      });
      if (res.status < 500) return;
    } catch {
      // server not ready yet
    }
    await sleep(500);
  }
  throw new Error(`OpenCode server on port ${port} did not become ready`);
}

async function createSession(port: number, password: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/api/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basicAuth(password),
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

async function assertPortFree(port: number): Promise<void> {
  if (await isPortOpen(port)) {
    throw new Error(
      `Port ${port} is already in use. Stop the process holding it before running integration tests.`,
    );
  }
}

export async function startFixtures(): Promise<void> {
  if (running) return;
  for (const server of Object.values(SERVERS)) {
    await assertPortFree(server.port);
  }
  await assertPortFree(MODEL_PORT);

  await rm(ROOT, { recursive: true, force: true });
  await mkdir(`${ROOT}/work`, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: `${ROOT}/work` });
  execFileSync(
    'git',
    [
      '-c',
      'user.email=fixture@localhost',
      '-c',
      'user.name=fixture',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'fixture',
    ],
    { cwd: `${ROOT}/work` },
  );
  for (const server of Object.values(SERVERS)) {
    await mkdir(`${ROOT}/data-${server.port}`, { recursive: true });
    await mkdir(`${ROOT}/config-${server.port}/opencode`, { recursive: true });
    await writeFile(
      `${ROOT}/config-${server.port}/opencode/opencode.json`,
      fixtureConfig(),
      'utf8',
    );
  }

  const state: Running = { pids: [], sessions: [] };
  running = state;
  try {
    state.model = await startFixtureModel(MODEL_PORT);
    for (const server of Object.values(SERVERS)) {
      const child = spawn(
        'opencode',
        ['serve', '--hostname', '127.0.0.1', '--port', String(server.port)],
        {
          env: {
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
            OPENCODE_PASSWORD: server.password,
            OPENCODE_DISABLE_MODELS_FETCH: '1',
            OPENCODE_DISABLE_AUTOUPDATE: '1',
            OPENCODE_DISABLE_FREE_MODELS: '1',
            XDG_DATA_HOME: `${ROOT}/data-${server.port}`,
            XDG_CONFIG_HOME: `${ROOT}/config-${server.port}`,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          cwd: `${ROOT}/work`,
        },
      );
      child.unref();
      if (!child.pid) {
        throw new Error(`Failed to spawn OpenCode on port ${server.port}`);
      }
      const logStream = createWriteStream(
        `${ROOT}/opencode-${server.port}.log`,
        { flags: 'a' },
      );
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
      state.pids.push(child.pid);
    }

    await Promise.all(
      Object.values(SERVERS).map((server) =>
        waitForServer(server.port, server.password),
      ),
    );

    const [alphaId, betaId] = await Promise.all([
      createSession(SERVERS.alpha.port, SERVERS.alpha.password),
      createSession(SERVERS.beta.port, SERVERS.beta.password),
    ]);
    state.sessions.push(
      {
        port: SERVERS.alpha.port,
        password: SERVERS.alpha.password,
        id: alphaId,
      },
      { port: SERVERS.beta.port, password: SERVERS.beta.password, id: betaId },
    );

    const yaml = [
      'servers:',
      '  - id: alpha',
      `    url: http://127.0.0.1:${SERVERS.alpha.port}`,
      '    password_env: OPENCODE_ALPHA_PASSWORD',
      '    allowlist:',
      `      - '${alphaId}'`,
      "      - 'create'",
      '  - id: beta',
      `    url: http://127.0.0.1:${SERVERS.beta.port}`,
      '    password_env: OPENCODE_BETA_PASSWORD',
      '',
    ].join('\n');
    await writeFile(`${ROOT}/servers.yaml`, yaml, 'utf8');
    await writeFile(
      `${ROOT}/state.json`,
      JSON.stringify(
        { alphaSessionId: alphaId, betaSessionId: betaId },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(`${ROOT}/pids.json`, JSON.stringify(state.pids), 'utf8');
  } catch (error) {
    for (const server of Object.values(SERVERS)) {
      try {
        const log = readFileSync(`${ROOT}/opencode-${server.port}.log`, 'utf8');
        console.error(`--- opencode ${server.port} log ---`);
        console.error(log.slice(-4000));
      } catch {
        // no log written
      }
    }
    await stopFixtures();
    throw error;
  }
}

export async function stopFixtures(): Promise<void> {
  const current = running;
  running = undefined;
  if (!current) return;

  for (const session of current.sessions) {
    try {
      await fetch(
        `http://127.0.0.1:${session.port}/api/session/${session.id}`,
        {
          method: 'DELETE',
          headers: { authorization: basicAuth(session.password) },
        },
      );
    } catch {
      // ignore cleanup failures
    }
  }

  if (current.model) await stopFixtureModel(current.model);
  for (const pid of current.pids) signalGroup(pid, 'SIGTERM');
  if (!(await waitForPortsClosed(5000))) {
    for (const pid of current.pids) signalGroup(pid, 'SIGKILL');
    await waitForPortsClosed(5000);
  }

  await rm(ROOT, { recursive: true, force: true });
}

export function teardownFixturesSync(): void {
  for (const pid of running?.pids ?? []) signalGroup(pid, 'SIGKILL');
  rmSync(ROOT, { recursive: true, force: true });
}

export function readState(): { alphaSessionId: string; betaSessionId: string } {
  return JSON.parse(readFileSync(`${ROOT}/state.json`, 'utf8')) as {
    alphaSessionId: string;
    betaSessionId: string;
  };
}
