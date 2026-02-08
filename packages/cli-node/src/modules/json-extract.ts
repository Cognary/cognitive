export type JsonExtractStrategy =
  | 'as_is'
  | 'code_fence'
  | 'balanced_first'
  | 'balanced_last';

export interface JsonExtractResult {
  json: string;
  strategy: JsonExtractStrategy;
}

export function extractJsonCandidates(text: string): JsonExtractResult[] {
  const raw = String(text ?? '');
  if (!raw.trim()) return [];

  const out: JsonExtractResult[] = [];

  const trimmed = raw.trim();
  const trimmedLooksJson = looksLikeJson(trimmed);
  // Candidate 1: treat the entire output as JSON only if it already looks like JSON.
  if (trimmedLooksJson) out.push({ json: trimmed, strategy: 'as_is' });

  // Candidate 2: markdown code fences
  const fence = extractFromCodeFence(raw);
  if (fence) out.push(fence);

  // Candidate 3/4: balanced JSON values from the text
  const first = extractBalancedJson(raw, 'first');
  if (first) out.push({ json: first, strategy: 'balanced_first' });

  const last = extractBalancedJson(raw, 'last');
  if (last) out.push({ json: last, strategy: 'balanced_last' });

  // Candidate last: as-is, even if it doesn't look like JSON.
  // This is useful for providers that return a single JSON value with leading/trailing whitespace.
  if (!trimmedLooksJson) out.push({ json: trimmed, strategy: 'as_is' });

  // Deduplicate by json string to keep parse attempts small.
  const seen = new Set<string>();
  return out.filter((c) => {
    if (!c.json) return false;
    if (seen.has(c.json)) return false;
    seen.add(c.json);
    return true;
  });
}

export function extractJsonCandidate(text: string): JsonExtractResult | null {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;

  // 1) If it's already JSON, prefer that.
  const trimmed = raw.trim();
  if (looksLikeJson(trimmed)) return { json: trimmed, strategy: 'as_is' };

  // 2) Markdown code fence ```json ... ```
  const fence = extractFromCodeFence(raw);
  if (fence) return fence;

  // 3) Best-effort: find a balanced JSON value in the text.
  const first = extractBalancedJson(raw, 'first');
  if (first) return { json: first, strategy: 'balanced_first' };

  const last = extractBalancedJson(raw, 'last');
  if (last) return { json: last, strategy: 'balanced_last' };

  return null;
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function extractFromCodeFence(raw: string): JsonExtractResult | null {
  // Non-greedy capture; allow "```json" or plain "```".
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!m) return null;
  const json = (m[1] ?? '').trim();
  if (!json) return null;
  return { json, strategy: 'code_fence' };
}

type BalancedMode = 'first' | 'last';

function extractBalancedJson(raw: string, mode: BalancedMode): string | null {
  // Cap scanning to avoid pathological memory usage on giant outputs.
  const maxScan = 256_000;
  const s = raw.length > maxScan ? raw.slice(0, maxScan) : raw;

  const starts: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{' || ch === '[') starts.push(i);
  }
  if (!starts.length) return null;

  const order = mode === 'first' ? starts : [...starts].reverse();
  for (const start of order) {
    const end = findBalancedEnd(s, start);
    if (end === -1) continue;
    const candidate = s.slice(start, end + 1).trim();
    if (candidate) return candidate;
  }
  return null;
}

function findBalancedEnd(s: string, start: number): number {
  const open = s[start];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return -1;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}
