import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { toResolvedServer } from './auth.js';
import type { ResolvedServer, ServerConfig } from './types.js';

const ServerSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  password_env: z.string().min(1).optional(),
  token_env: z.string().min(1).optional(),
  auth: z.enum(['basic', 'bearer', 'none']).optional(),
  timeout_ms: z.number().int().positive().optional(),
  allowlist: z.array(z.string()).optional(),
});

const ConfigSchema = z.object({
  servers: z.array(ServerSchema).default([]),
});

export function defaultConfigPath(): string {
  return (
    process.env.OPENCODE_PEER_MCP_CONFIG ??
    `${process.env.HOME ?? ''}/.config/opencode-peer-mcp/servers.yaml`
  );
}

export async function loadConfig(
  path = defaultConfigPath(),
): Promise<ResolvedServer[]> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(
        `opencode-peer-mcp: config not found at ${path}; starting with no servers`,
      );
      return [];
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid YAML in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const config = ConfigSchema.parse(parsed ?? {});
  const ids = new Set<string>();
  for (const server of config.servers) {
    if (ids.has(server.id)) {
      throw new Error(`Duplicate server id: ${server.id}`);
    }
    ids.add(server.id);
  }
  const servers = config.servers.map((server) =>
    toResolvedServer(server as ServerConfig),
  );
  console.error(
    `opencode-peer-mcp: loaded ${servers.length} server(s) from ${path}`,
  );
  return servers;
}
