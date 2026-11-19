import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditLogger } from '../src/audit.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('AuditLogger', () => {
  it('appends JSON lines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'audit-'));
    dirs.push(dir);
    const path = join(dir, 'audit.log');
    const logger = new AuditLogger(path);
    await logger.record({
      timestamp: '2026-01-01T00:00:00.000Z',
      server: 'local',
      session: 'session-1',
      tool: 'session_prompt',
      confirm: null,
      allowlistDecision: 'allowed',
      result: 'success',
    });
    const content = await readFile(path, 'utf8');
    expect(content.trim()).toBe(
      '{"timestamp":"2026-01-01T00:00:00.000Z","server":"local","session":"session-1","tool":"session_prompt","confirm":null,"allowlistDecision":"allowed","result":"success"}',
    );
  });
});
