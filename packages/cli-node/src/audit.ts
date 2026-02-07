import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

function safeSlug(s: string): string {
  const out = s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '-');
  return out.length > 0 ? out.slice(0, 80) : 'unknown';
}

export interface AuditRecord {
  ts: string;
  kind: 'run' | 'pipe' | 'compose';
  policy?: unknown;
  provider?: string;
  module?: unknown;
  input?: unknown;
  result?: unknown;
  notes?: string[];
}

export async function writeAuditRecord(record: AuditRecord): Promise<{ path: string } | null> {
  // Keep it simple and predictable: write under ~/.cognitive/audit/
  const dir = path.join(os.homedir(), '.cognitive', 'audit');
  const ts = record.ts.replace(/[:.]/g, '-');
  const kind = record.kind;
  const moduleName = safeSlug(
    typeof (record.module as any)?.name === 'string' ? (record.module as any).name : 'module'
  );
  const filename = `${ts}-${kind}-${moduleName}-${Math.random().toString(16).slice(2, 10)}.json`;

  try {
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, filename);
    await fs.writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    return { path: outPath };
  } catch {
    // Audit must never break execution.
    return null;
  }
}

