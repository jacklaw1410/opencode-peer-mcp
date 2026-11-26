import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { connect } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startFixtureModel, stopFixtureModel } from './fixture-model.js';

export type FixtureLayout = {
  root: string;
  alphaPort: number;
  betaPort: number;
  writePort: number;
  modelPort: number;
};

export type FixtureState = {
  alphaSessionId: string;
  betaSessionId: string;
  writeSessionId: string;
};

export const INTEGRATION_LAYOUT: FixtureLayout = {
  root: path.resolve(
    process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ??
      '/tmp/opencode-peer-mcp-integration',
  ),
  alphaPort: 49421,
  betaPort: 49422,
  writePort: 49424,
  modelPort: 49423,
};

export const ROOT = INTEGRATION_LAYOUT.root;

// Default roots live under /tmp. TMPDIR can point elsewhere (for example
// /tmp/opencode), so both locations count as safe.
const SAFE_BASES = [...new Set([path.resolve(os.tmpdir()), '/tmp'])];

function assertSafeRoot(root: string): void {
  const resolved = path.resolve(root);
  if (!SAFE_BASES.some((base) => resolved.startsWith(`${base}${path.sep}`))) {
    throw new Error(`Unsafe fixture root: ${root}`);
  }
}

assertSafeRoot(ROOT);

export const SERVERS = {
  alpha: {
    port: INTEGRATION_LAYOUT.alphaPort,
    password: process.env.OPENCODE_ALPHA_PASSWORD ?? 'alpha-pass',
  },
  beta: {
    port: INTEGRATION_LAYOUT.betaPort,
    password: process.env.OPENCODE_BETA_PASSWORD ?? 'beta-pass',
  },
  write: {
    port: INTEGRATION_LAYOUT.writePort,
    password: process.env.OPENCODE_WRITE_PASSWORD ?? 'write-pass',
  },
} as const;

const MODEL_PROVIDER = 'fixture';
const MODEL_ID = 'fixture-model';

type FixtureServer = { port: number; password: string };
type Session = FixtureServer & { id: string };
type Running = {
  layout: FixtureLayout;
  pids: number[];
  sessions: Session[];
  model?: Server;
};

let running: Running | undefined;

function fixtureConfig(modelPort: number): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      model: `${MODEL_PROVIDER}/${MODEL_ID}`,
      providers: {
        [MODEL_PROVIDER]: {
          name: 'Fixture',
          package: '@opencode/ai/providers/openai-compatible',
          settings: { baseURL: `http://127.0.0.1:${modelPort}/v1` },
          models: { [MODEL_ID]: { name: 'Fixture model' } },
        },
      },
    },
    null,
    2,
  );
}

function serversFor(layout: FixtureLayout): FixtureServer[] {
  return [
    { port: layout.alphaPort, password: SERVERS.alpha.password },
    { port: layout.betaPort, password: SERVERS.beta.password },
    { port: layout.writePort, password: SERVERS.write.password },
  ];
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

async function waitForPortsClosed(
  layout: FixtureLayout,
  timeoutMs: number,
): Promise<boolean> {
  const ports = [
    ...serversFor(layout).map((server) => server.port),
    layout.modelPort,
  ];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await Promise.all(ports.map((port) => isPortOpen(port)));
    if (!open.some(Boolean)) return true;
    await sleep(200);
  }
  return false;
}

async function waitForServer(server: FixtureServer): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `http://127.0.0.1:${server.port}/api/session?limit=1`,
        { headers: { authorization: basicAuth(server.password) } },
      );
      if (res.status < 500) return;
    } catch {
      // server not ready yet
    }
    await sleep(500);
  }
  throw new Error(
    `OpenCode server on port ${server.port} did not become ready`,
  );
}

async function createSession(
  root: string,
  server: FixtureServer,
  title = 'peer-mcp-fixture',
): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${server.port}/api/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: basicAuth(server.password),
    },
    body: JSON.stringify({
      directory: `${root}/work`,
      title,
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
      `Port ${port} is already in use. Stop the process holding it before running fixtures.`,
    );
  }
}

export async function startFixtures(
  layout: FixtureLayout = INTEGRATION_LAYOUT,
): Promise<void> {
  if (running) return;
  assertSafeRoot(layout.root);
  const servers = serversFor(layout);
  for (const server of servers) {
    await assertPortFree(server.port);
  }
  await assertPortFree(layout.modelPort);

  const rootMarker = path.join(layout.root, '.opencode-peer-mcp-eval-root');
  if (existsSync(layout.root) && !existsSync(rootMarker)) {
    throw new Error(
      `Refusing to delete unmarked fixture root: ${layout.root}. ` +
        'Remove it manually if you are sure.',
    );
  }
  await rm(layout.root, { recursive: true, force: true });
  await mkdir(`${layout.root}/work`, { recursive: true });
  await writeFile(rootMarker, 'eval root\n');
  execFileSync('git', ['init', '-q'], { cwd: `${layout.root}/work` });
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
    { cwd: `${layout.root}/work` },
  );
  for (const server of servers) {
    await mkdir(`${layout.root}/data-${server.port}`, { recursive: true });
    await mkdir(`${layout.root}/config-${server.port}/opencode`, {
      recursive: true,
    });
    await writeFile(
      `${layout.root}/config-${server.port}/opencode/opencode.json`,
      fixtureConfig(layout.modelPort),
      'utf8',
    );
  }

  const state: Running = { layout, pids: [], sessions: [] };
  running = state;
  try {
    state.model = await startFixtureModel(layout.modelPort);
    for (const server of servers) {
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
            XDG_DATA_HOME: `${layout.root}/data-${server.port}`,
            XDG_CONFIG_HOME: `${layout.root}/config-${server.port}`,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          cwd: `${layout.root}/work`,
        },
      );
      child.unref();
      if (!child.pid) {
        throw new Error(`Failed to spawn OpenCode on port ${server.port}`);
      }
      const logStream = createWriteStream(
        `${layout.root}/opencode-${server.port}.log`,
        { flags: 'a' },
      );
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
      state.pids.push(child.pid);
    }

    await Promise.all(servers.map((server) => waitForServer(server)));

    const [alphaId, betaId, writeId] = await Promise.all([
      createSession(layout.root, servers[0]),
      createSession(layout.root, servers[1]),
      createSession(layout.root, servers[2], 'peer-mcp-write-fixture'),
    ]);
    state.sessions.push(
      { ...servers[0], id: alphaId },
      { ...servers[1], id: betaId },
      { ...servers[2], id: writeId },
    );

    const yaml = [
      'servers:',
      '  - id: alpha',
      `    url: http://127.0.0.1:${servers[0].port}`,
      '    password_env: OPENCODE_ALPHA_PASSWORD',
      '    auth: basic',
      '    allowlist:',
      `      - '${alphaId}'`,
      "      - 'create'",
      '  - id: beta',
      `    url: http://127.0.0.1:${servers[1].port}`,
      '    password_env: OPENCODE_BETA_PASSWORD',
      '    auth: basic',
      '  - id: write',
      `    url: http://127.0.0.1:${servers[2].port}`,
      '    password_env: OPENCODE_WRITE_PASSWORD',
      '    auth: basic',
      '    allowlist:',
      `      - '${writeId}'`,
      "      - 'create'",
      '',
    ].join('\n');
    await writeFile(`${layout.root}/servers.yaml`, yaml, 'utf8');
    await writeFile(
      `${layout.root}/state.json`,
      JSON.stringify(
        {
          alphaSessionId: alphaId,
          betaSessionId: betaId,
          writeSessionId: writeId,
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      `${layout.root}/pids.json`,
      JSON.stringify(state.pids),
      'utf8',
    );
  } catch (error) {
    for (const server of servers) {
      try {
        const log = readFileSync(
          `${layout.root}/opencode-${server.port}.log`,
          'utf8',
        );
        console.error(`--- opencode ${server.port} log ---`);
        console.error(log.slice(-4000));
      } catch {
        // no log written
      }
    }
    await stopFixtures(layout);
    throw error;
  }
}

export async function stopFixtures(
  layout: FixtureLayout = INTEGRATION_LAYOUT,
): Promise<void> {
  const current = running?.layout.root === layout.root ? running : undefined;
  if (!current) return;
  running = undefined;

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
  if (!(await waitForPortsClosed(current.layout, 5000))) {
    for (const pid of current.pids) signalGroup(pid, 'SIGKILL');
    await waitForPortsClosed(current.layout, 5000);
  }

  await rm(current.layout.root, { recursive: true, force: true });
}

export function teardownFixturesSync(): void {
  for (const pid of running?.pids ?? []) signalGroup(pid, 'SIGKILL');
  if (running) rmSync(running.layout.root, { recursive: true, force: true });
}

export function readState(
  layout: FixtureLayout = INTEGRATION_LAYOUT,
): FixtureState {
  return JSON.parse(
    readFileSync(`${layout.root}/state.json`, 'utf8'),
  ) as FixtureState;
}
