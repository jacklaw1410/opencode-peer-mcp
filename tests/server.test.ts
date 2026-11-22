import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, mock } from 'bun:test';
import { createMcpServer } from '../src/server.js';

describe('createMcpServer', () => {
  it('registers the bootstrap tools and serves servers_list', async () => {
    const service = {
      listServers: mock(() => [
        {
          id: 'local',
          url: 'http://example.test',
          auth: 'none',
          timeoutMs: 1,
          allowlist: [],
        },
      ]),
      listSessions: mock(),
      getSession: mock(),
      getServer: mock(() => ({
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
      'session_schedule',
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

describe('session_create model parameter', () => {
  it('accepts a Model.Ref object and rejects a bare string', async () => {
    const service = {
      createSession: mock(() => ({ data: { id: 'created' } })),
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

    const ok = await client.callTool({
      name: 'session_create',
      arguments: {
        server: 'local',
        directory: '/tmp/work',
        model: { providerID: 'fixture', id: 'fixture-model' },
      },
    });
    expect(ok.isError).not.toBe(true);

    const bad = await client.callTool({
      name: 'session_create',
      arguments: {
        server: 'local',
        directory: '/tmp/work',
        model: 'fixture/fixture-model',
      },
    });
    expect(bad.isError).toBe(true);

    const none = await client.callTool({
      name: 'session_create',
      arguments: {
        server: 'local',
        directory: '/tmp/work',
      },
    });
    expect(none.isError).not.toBe(true);

    await client.close();
    await server.close();
  });
});
