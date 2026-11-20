import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  server: string;
  session: string;
  tool: string;
  allowlistDecision: string;
  result: string;
}

export class Logger {
  constructor(
    private readonly path = process.env.OPENCODE_PEER_MCP_AUDIT_LOG ??
      `${process.env.HOME ?? ''}/.opencode-peer-mcp/audit.log`,
  ) {}

  async log(entry: LogEntry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
    if (entry.level === 'warn' || entry.level === 'error') {
      console.error(
        `[opencode-peer-mcp] ${entry.level}: ${entry.tool} ${entry.result}`,
      );
    }
  }
}
