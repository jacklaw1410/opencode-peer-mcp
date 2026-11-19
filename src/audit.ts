import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface AuditEntry {
  timestamp: string;
  server: string;
  session: string;
  tool: string;
  confirm: null;
  allowlistDecision: string;
  result: string;
}

export class AuditLogger {
  constructor(
    private readonly path = process.env.OPENCODE_PEER_MCP_AUDIT_LOG ??
      `${process.env.HOME ?? ''}/.opencode-peer-mcp/audit.log`,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
