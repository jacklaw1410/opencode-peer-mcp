import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PeerService } from "./service.js";

export function createMcpServer(service: PeerService): McpServer {
  const server = new McpServer({ name: "opencode-peer-mcp", version: "0.1.0" });

  server.tool("servers_list", "List configured OpenCode servers.", {}, async () => {
    return jsonResult(service.listServers());
  });

  server.tool(
    "sessions_list",
    "List sessions on a configured server.",
    {
      server: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
      directory: z.string().optional(),
    },
    async ({ server, limit, directory }) => {
      try {
        return jsonResult(await service.listSessions(server, { limit, directory }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "session_get",
    "Get a session by ID from a configured server.",
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
    },
    async ({ server, session_id }) => {
      try {
        return jsonResult(await service.getSession(server, session_id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
