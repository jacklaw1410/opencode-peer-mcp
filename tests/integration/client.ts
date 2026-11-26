import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolResultSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import { ROOT, SERVERS } from './fixtures.js';

export async function connectClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.resolve(process.cwd(), 'dist/index.js')],
    env: {
      OPENCODE_PEER_MCP_CONFIG: `${ROOT}/servers.yaml`,
      OPENCODE_ALPHA_PASSWORD: SERVERS.alpha.password,
      OPENCODE_BETA_PASSWORD: SERVERS.beta.password,
      OPENCODE_WRITE_PASSWORD: SERVERS.write.password,
      OPENCODE_PEER_MCP_WRITE_ENABLED: 'true',
      OPENCODE_PEER_MCP_AUDIT_LOG: `${ROOT}/audit.log`,
    },
  });
  const client = new Client({
    name: 'opencode-peer-mcp-integration',
    version: '0.0.0',
  });
  await client.connect(transport);
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await client.callTool({ name, arguments: args });
  return CallToolResultSchema.parse(result);
}

export function toolText(result: CallToolResult): string {
  return result.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n');
}

export async function pollTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  done: (text: string) => boolean,
  timeoutMs = 15000,
): Promise<CallToolResult> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await callTool(client, name, args);
    if (done(toolText(result)) || Date.now() >= deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
