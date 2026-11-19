import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('loadConfig', () => {
  it('returns an empty list when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opm-'));
    dirs.push(dir);
    expect(await loadConfig(join(dir, 'missing.yaml'))).toHaveLength(0);
  });

  it('parses servers and resolves basic auth from env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opm-'));
    dirs.push(dir);
    const file = join(dir, 'servers.yaml');
    process.env.TEST_PASSWORD = 'secret';
    await writeFile(
      file,
      'servers:\n  - id: local\n    url: http://127.0.0.1:49374\n    password_env: TEST_PASSWORD\n',
    );
    const servers = await loadConfig(file);
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      id: 'local',
      auth: 'basic',
      username: 'opencode',
      password: 'secret',
    });
    delete process.env.TEST_PASSWORD;
  });

  it('rejects duplicate server ids', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'opm-'));
    dirs.push(dir);
    const file = join(dir, 'servers.yaml');
    await writeFile(
      file,
      'servers:\n  - id: local\n    url: http://127.0.0.1:49374\n  - id: local\n    url: http://127.0.0.1:49375\n',
    );
    await expect(loadConfig(file)).rejects.toThrow(/Duplicate server id/);
  });
});
