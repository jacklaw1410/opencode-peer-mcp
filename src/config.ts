import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";
import { toResolvedServer } from "./auth.js";
import type { ResolvedServer, ServerConfig } from "./types.js";

const ServerSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  password_env: z.string().min(1).optional(),
  token_env: z.string().min(1).optional(),
  auth: z.enum(["basic", "bearer", "none"]).optional(),
  timeout_ms: z.number().int().positive().optional(),
  allowlist: z.array(z.string()).optional(),
});

const ConfigSchema = z.object({
  servers: z.array(ServerSchema).default([]),
});

export function defaultConfigPath(): string {
  return process.env.OPENCODE_PEER_MCP_CONFIG ?? `${process.env.HOME ?? ""}/.config/opencode-peer-mcp/servers.yaml`;
}

export async function loadConfig(path = defaultConfigPath()): Promise<ResolvedServer[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const parsed = parse(raw);
  const config = ConfigSchema.parse(parsed ?? {});
  const ids = new Set<string>();
  for (const server of config.servers) {
    if (ids.has(server.id)) {
      throw new Error(`Duplicate server id: ${server.id}`);
    }
    ids.add(server.id);
  }
  return config.servers.map((server) => toResolvedServer(server as ServerConfig));
}
