import fs from 'node:fs';
import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';

const state = JSON.parse(
  fs.readFileSync(
    `${process.env.OPENCODE_PEER_MCP_INTEGRATION_ROOT ?? '/tmp/opencode-peer-mcp-integration'}/state.json`,
    'utf8',
  ),
) as { alphaSessionId: string; betaSessionId: string };

test('sessions_list finds the fixture session', async ({ mcp }) => {
  const result = await mcp.callTool('sessions_list', {
    server: 'alpha',
    limit: 20,
    search: 'peer-mcp-fixture',
  });
  expect(result).not.toBeToolError();
  expect(result).toContainToolText('peer-mcp-fixture');
});

test('session_get returns the fixture session', async ({ mcp }) => {
  const result = await mcp.callTool('session_get', {
    server: 'alpha',
    session_id: state.alphaSessionId,
  });
  expect(result).not.toBeToolError();
  expect(result).toContainToolText(state.alphaSessionId);
});

test('sessions_search spans both servers', async ({ mcp }) => {
  const result = await mcp.callTool('sessions_search', {
    query: 'peer-mcp-fixture',
    limit: 20,
  });
  expect(result).not.toBeToolError();
  expect(result).toContainToolText('alpha');
  expect(result).toContainToolText('beta');
});

test('sessions_compare returns both sessions', async ({ mcp }) => {
  const result = await mcp.callTool('sessions_compare', {
    server_a: 'alpha',
    session_a: state.alphaSessionId,
    server_b: 'beta',
    session_b: state.betaSessionId,
  });
  expect(result).not.toBeToolError();
  expect(result).toContainToolText('alpha');
  expect(result).toContainToolText('beta');
});
