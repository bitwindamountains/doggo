// Turns platform step aggregates (any interval list) into the engine's dense array of
// completed 10-minute buckets counted from `startISO`.

const BUCKET_MS = 10 * 60_000;

export interface StepInterval {
  start: Date | string;
  steps: number;
}

export function toBuckets(startISO: string, endISO: string, intervals: StepInterval[]): number[] {
  const start = Date.parse(startISO);
  const count = Math.max(0, Math.floor((Date.parse(endISO) - start) / BUCKET_MS));
  const out = new Array<number>(count).fill(0);
  for (const { start: s, steps } of intervals) {
    const i = Math.floor((new Date(s).getTime() - start) / BUCKET_MS);
    if (i >= 0 && i < count && Number.isFinite(steps)) out[i] = (out[i] ?? 0) + Math.round(steps);
  }
  return out;
}
