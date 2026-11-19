#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { HttpClient } from './http.js';
import { PeerService } from './service.js';
import { createMcpServer } from './server.js';

export async function main(): Promise<void> {
  const servers = await loadConfig();
  const service = new PeerService({ servers, http: new HttpClient() });
  const server = createMcpServer(service);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
