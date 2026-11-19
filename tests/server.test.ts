import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { createMcpServer } from '../src/server.js';

describe('createMcpServer', () => {
  it('registers the bootstrap tools and serves servers_list', async () => {
    const service = {
      listServers: vi.fn(() => [
        {
          id: 'local',
          url: 'http://example.test',
          auth: 'none',
          timeoutMs: 1,
          allowlist: [],
        },
      ]),
      listSessions: vi.fn(),
      getSession: vi.fn(),
      getServer: vi.fn(() => ({
        id: 'local',
        url: 'http://example.test',
        auth: 'none',
        timeoutMs: 1,
        allowlist: [],
      })),
    };
    const server = createMcpServer(service as never);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: 'test', version: '1.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'servers_list',
      'server_get',
      'sessions_list',
      'session_get',
      'session_status',
      'session_messages',
      'session_diff',
      'sessions_search',
      'sessions_compare',
      'session_create',
      'session_prompt',
      'session_interrupt',
    ]);

    const result = await client.callTool({
      name: 'servers_list',
      arguments: {},
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(service.listServers(), null, 2) },
    ]);

    await client.close();
    await server.close();
  });
});
