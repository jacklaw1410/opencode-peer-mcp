import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PeerService } from './service.js';

export function createMcpServer(service: PeerService): McpServer {
  const server = new McpServer({ name: 'opencode-peer-mcp', version: '0.1.0' });

  server.tool(
    'servers_list',
    'List configured OpenCode servers.',
    {},
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async () => {
      return jsonResult(service.listServers());
    },
  );

  server.tool(
    'server_get',
    'Get one configured OpenCode server.',
    {
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('Max sessions to return.'),
      directory: z.string().optional().describe('Filter by working directory.'),
      order: z
        .enum(['asc', 'desc'])
        .optional()
        .describe('Sort order by updated time.'),
      search: z
        .string()
        .optional()
        .describe('Substring to match in title or id.'),
      archived: z.boolean().optional().describe('Include archived sessions.'),
      parent_id: z.string().optional().describe('Filter by parent session id.'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from previous page.'),
      project: z.string().optional().describe('Filter by project id.'),
      subpath: z.string().optional().describe('Filter by subpath.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
    'Get messages for a session. Returns only the message list; does not fetch session details or status.',
    {
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
      limit: z
        .number()
        .int()
        .positive()
        .max(200)
        .optional()
        .describe('Max messages to return.'),
      order: z
        .enum(['asc', 'desc'])
        .optional()
        .describe('Sort order by updated time.'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from previous page.'),
      type: z.string().optional().describe('Filter by message type.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
    'Get structured diffs for a session turn. Returns only the diff; does not fetch messages or session details.',
    {
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
      from: z.string().optional().describe('Starting turn id.'),
      to: z.string().optional().describe('Ending turn id.'),
      context: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Lines of context around changes.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
    'Search sessions across configured servers. Returns matching sessions with their ids and titles; no follow-up calls needed. Omit the servers parameter to search all configured servers; do not call servers_list first.',
    {
      servers: z
        .array(z.string().min(1))
        .optional()
        .describe(
          'Server ids to search. Omit to search all configured servers.',
        ),
      query: z.string().min(1).describe('Search query.'),
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Max results per server.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
    'Compare two sessions across configured servers. Returns both sessions side by side; does not fetch messages or diffs.',
    {
      server_a: z.string().min(1).describe('First server id.'),
      session_a: z.string().min(1).describe('First session id.'),
      server_b: z.string().min(1).describe('Second server id.'),
      session_b: z.string().min(1).describe('Second session id.'),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      directory: z
        .string()
        .min(1)
        .describe('Working directory for the session.'),
      title: z.string().optional().describe('Session title.'),
      agent: z.string().optional().describe('Agent name to use.'),
      model: z
        .object({
          providerID: z
            .string()
            .min(1)
            .describe('Provider id (e.g. opencode-go).'),
          id: z.string().min(1).describe('Model id (e.g. beam-free).'),
          variant: z.string().optional().describe('Model variant.'),
        })
        .optional(),
      allowed: z
        .boolean()
        .optional()
        .describe('Allow write operations (gated).'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
      prompt: z.string().min(1).describe('Prompt text to send.'),
      wait_for: z
        .number()
        .int()
        .min(1000)
        .max(300000)
        .optional()
        .describe(
          'Wait up to this many milliseconds for the remote session to complete, then return its response. Null/omitted returns immediately.',
        ),
      allowed: z
        .boolean()
        .optional()
        .describe('Allow write operations (gated).'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ server, session_id, prompt, wait_for, allowed }) => {
      try {
        return jsonResult(
          await service.promptSession(server, session_id, prompt, {
            allowed,
            waitFor: wait_for ?? null,
          }),
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
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
      allowed: z
        .boolean()
        .optional()
        .describe('Allow write operations (gated).'),
    },
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
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

  server.tool(
    'session_schedule',
    'Schedule a message on a session after a delay. Fire-and-forget: does not survive server restart. For recurring checks, use OpenCode built-in automations.',
    {
      server: z
        .string()
        .min(1)
        .describe('Configured server id (e.g. linux, window, mbp).'),
      session_id: z.string().min(1).describe('Session id on that server.'),
      prompt: z
        .string()
        .min(1)
        .describe('Prompt text to send when the timer fires.'),
      delay: z
        .string()
        .min(1)
        .describe(
          'When to fire: a duration like "30s", "5m", "1h", "90s", "2m30s" or an ISO timestamp like "2026-11-22T13:00:00". Max 1 hour.',
        ),
      name: z.string().optional().describe('Short label for the schedule.'),
      expires: z
        .string()
        .optional()
        .describe('ISO timestamp after which the schedule is cancelled.'),
      allowed: z
        .boolean()
        .optional()
        .describe('Allow write operations (gated).'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ server, session_id, prompt, delay, name, expires, allowed }) => {
      try {
        return jsonResult(
          await service.schedulePrompt(server, session_id, prompt, delay, {
            allowed,
            name,
            expires,
          }),
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
