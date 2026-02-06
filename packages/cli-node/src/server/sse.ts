export interface SseFrameOptions {
  event?: string;
  id?: string | number;
  retryMs?: number;
}

/**
 * Encode a payload into an SSE frame.
 *
 * Notes:
 * - SSE requires each data line to be prefixed with `data:`.
 * - `event:` maps cleanly to CEP `type` to keep transport mapping deterministic.
 */
export function encodeSseFrame(data: unknown, options: SseFrameOptions = {}): string {
  const lines: string[] = [];

  if (options.retryMs !== undefined) lines.push(`retry: ${options.retryMs}`);
  if (options.id !== undefined) lines.push(`id: ${options.id}`);
  if (options.event) lines.push(`event: ${options.event}`);

  const json = JSON.stringify(data);
  for (const line of json.split('\n')) {
    lines.push(`data: ${line}`);
  }

  lines.push(''); // End of event
  return lines.join('\n') + '\n';
}

