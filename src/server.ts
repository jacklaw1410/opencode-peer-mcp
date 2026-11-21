import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PeerService } from './service.js';

export function createMcpServer(service: PeerService): McpServer {
  const server = new McpServer({ name: 'opencode-peer-mcp', version: '0.1.0' });

  server.tool(
    'servers_list',
    'List configured OpenCode servers.',
    {},
    async () => {
      return jsonResult(service.listServers());
    },
  );

  server.tool(
    'server_get',
    'Get one configured OpenCode server.',
    {
      server: z.string().min(1),
    },
    async ({ server: serverId }) => {
      try {
        return jsonResult(service.getServer(serverId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'sessions_list',
    'List sessions on a configured server.',
    {
      server: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
      directory: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional(),
      search: z.string().optional(),
      archived: z.boolean().optional(),
      parent_id: z.string().optional(),
      cursor: z.string().optional(),
      project: z.string().optional(),
      subpath: z.string().optional(),
    },
    async ({
      server,
      limit,
      directory,
      order,
      archived,
      parent_id,
      cursor,
      project,
      subpath,
      search,
    }) => {
      try {
        return jsonResult(
          await service.listSessions(server, {
            limit,
            directory,
            order,
            search,
            archived,
            parentId: parent_id,
            cursor,
            project,
            subpath,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_get',
    'Get a session by ID from a configured server.',
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

  server.tool(
    'session_status',
    'Get derived status for a session.',
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
    },
    async ({ server, session_id }) => {
      try {
        return jsonResult(await service.getSessionStatus(server, session_id));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_messages',
    'Get messages for a session.',
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
      limit: z.number().int().positive().max(200).optional(),
      order: z.enum(['asc', 'desc']).optional(),
      cursor: z.string().optional(),
      type: z.string().optional(),
    },
    async ({ server, session_id, limit, order, cursor, type }) => {
      try {
        return jsonResult(
          await service.getSessionMessages(server, session_id, {
            limit,
            order,
            cursor,
            type,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_diff',
    'Get structured diffs for a session turn.',
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
      from: z.string().optional(),
      to: z.string().optional(),
      context: z.number().int().nonnegative().optional(),
    },
    async ({ server, session_id, from, to, context }) => {
      try {
        return jsonResult(
          await service.getSessionDiff(server, session_id, {
            from,
            to,
            context,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'sessions_search',
    'Search sessions across configured servers.',
    {
      servers: z.array(z.string().min(1)).optional(),
      query: z.string().min(1),
      limit: z.number().int().positive().max(50).optional(),
    },
    async ({ servers, query, limit }) => {
      try {
        return jsonResult(await service.searchSessions(servers, query, limit));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'sessions_compare',
    'Compare two sessions across configured servers.',
    {
      server_a: z.string().min(1),
      session_a: z.string().min(1),
      server_b: z.string().min(1),
      session_b: z.string().min(1),
    },
    async ({ server_a, session_a, server_b, session_b }) => {
      try {
        return jsonResult(
          await service.compareSessions(
            server_a,
            session_a,
            server_b,
            session_b,
          ),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_create',
    'Create a session on a configured server.',
    {
      server: z.string().min(1),
      directory: z.string().min(1),
      title: z.string().optional(),
      agent: z.string().optional(),
      model: z
        .object({
          providerID: z.string().min(1),
          id: z.string().min(1),
          variant: z.string().optional(),
        })
        .optional(),
      allowed: z.boolean().optional(),
    },
    async ({ server, directory, title, agent, model, allowed }) => {
      try {
        return jsonResult(
          await service.createSession(
            server,
            { directory, title, agent, model },
            { allowed },
          ),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_prompt',
    'Prompt a session on a configured server.',
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
      prompt: z.string().min(1),
      allowed: z.boolean().optional(),
    },
    async ({ server, session_id, prompt, allowed }) => {
      try {
        return jsonResult(
          await service.promptSession(server, session_id, prompt, { allowed }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'session_interrupt',
    'Interrupt a session on a configured server.',
    {
      server: z.string().min(1),
      session_id: z.string().min(1),
      allowed: z.boolean().optional(),
    },
    async ({ server, session_id, allowed }) => {
      try {
        return jsonResult(
          await service.interruptSession(server, session_id, { allowed }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}
