// What the app does when it comes to the foreground (CLAUDE.md engineering rule 2):
// finalize past days, recompute the dog from stored data, store what the engine found.

import { computeDog, type EngineOutput, type ISO } from '@/engine';

import { buildEngineInput, type RuntimeState } from './buildEngineInput';
import type { Db } from './db';
import { finalizePastDays, type FinalizedDay } from './finalizePastDays';
import { eventsRepo } from './repos';

export interface RecomputeResult {
  output: EngineOutput;
  finalized: FinalizedDay[];
}

/**
 * Recomputes the dog. Pass `opened: true` when the app came to the foreground so the
 * greeting sees the previous open and this open is recorded after it.
 */
export function recompute(
  db: Db,
  now: ISO,
  runtime: RuntimeState,
  opts: { opened: boolean },
): RecomputeResult | null {
  const finalized = finalizePastDays(db, now, runtime);
  const input = buildEngineInput(db, now, runtime);
  if (!input) return null;
  const output = computeDog(input);
  db.transaction((tx) => {
    for (const walk of output.newWalks) {
      eventsRepo.add(tx, 'walk_detected', walk.end, {
        start: walk.start,
        end: walk.end,
        steps: walk.steps,
      });
    }
    if (opts.opened) eventsRepo.add(tx, 'app_opened', now, null);
  });
  return { output, finalized };
}
