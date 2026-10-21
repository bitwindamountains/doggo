// Runs the engine over persona days, stepping `now` every 10 minutes, the way the app
// would if it recomputed constantly. Pure: everything is derived from the persona.

import { computeDog } from '../computeDog';
import { BUCKET_MINUTES, DAY_MS, MINUTE_MS } from '../constants';
import { finalizeDay, newDayLedger } from '../finalizeDay';
import { earnedTricks } from '../growth';
import { nudgeBudget } from '../nudges';
import {
  addDays,
  dayWindow,
  formatHHmm,
  localMinutes,
  nextLocalTime,
  parseHHmm,
  toISO,
  toMs,
} from '../time';
import type {
  DayKey,
  DaySummary,
  DogProfile,
  DogState,
  NudgeLedger,
  NudgeType,
  Request,
  ScreenRung,
  WalkEvent,
} from '../types';
import { countableWalks, sumSteps } from '../walks';
import type { Persona, StepSegment } from './personas';

const BUCKET_MS = BUCKET_MINUTES * MINUTE_MS;

export interface TickRow {
  at: string; // ISO
  local: string; // HH:mm
  day: DayKey;
  pose: DogState['pose'];
  request: Request;
  activeRequests: Request[];
  greeting: DogState['greeting'];
  energy: number;
  contentment: number;
  bond: number;
  lineKey: string;
  walkDetected: boolean;
  pushes: NudgeType[];
  pushesSent: number;
  budget: number;
}

export interface SimDay {
  day: DayKey;
  rows: TickRow[];
  pushes: { type: NudgeType; at: string; local: string }[];
  budget: number;
  askNudgeFrequency: boolean;
  summary: DaySummary;
  unlockedTricks: string[];
}

export interface SimResult {
  personaId: string;
  dogBefore: DogProfile;
  dog: DogProfile;
  ledger: NudgeLedger;
  days: SimDay[];
}

function inSegment(minute: number, [from, to]: StepSegment): boolean {
  const s = parseHHmm(from);
  const e = parseHHmm(to);
  return s < e ? minute >= s && minute < e : minute >= s || minute < e;
}

/** Steps for a bucket; later segments override earlier ones. */
function stepsForBucket(minute: number, segments: StepSegment[]): number {
  let steps = 0;
  for (const segment of segments) if (inSegment(minute, segment)) steps = segment[2];
  return steps;
}

/** Steps the persona takes in the 10-minute bucket starting at `ms` (any day). */
export function personaStepsAt(persona: Persona, ms: number): number {
  return persona.prefs.stepsAvailable
    ? stepsForBucket(localMinutes(ms, persona.prefs.timezone), persona.steps)
    : 0;
}

export function initialDog(persona: Persona): DogProfile {
  const start = dayWindow(persona.startDay, persona.prefs).start;
  const d = persona.dog;
  return {
    id: `dog-${persona.id}`,
    name: d.name,
    breed: d.breed,
    adoptedAt: toISO(start - d.adoptedDaysBeforeStart * DAY_MS),
    adoptedAsSenior: d.adoptedAsSenior ?? false,
    bondPoints: d.bondPoints ?? 0,
    goodDaysTotal: d.goodDaysTotal ?? 0,
    walksTotal: d.walksTotal ?? 0,
    tricks:
      d.tricks ??
      earnedTricks({ goodDaysTotal: d.goodDaysTotal ?? 0, walksTotal: d.walksTotal ?? 0 }),
  };
}

export function initialHistory(persona: Persona): DaySummary[] {
  const gap = persona.historyGapDays ?? 0;
  return (persona.historySteps ?? []).map((steps, i) => ({
    day: addDays(persona.startDay, -(i + 1 + gap)),
    steps,
    walks: 1,
    water: 6,
    screenRungMax: 0 as ScreenRung,
    moodCheckin: false,
    goodDay: true,
    finalized: true,
    pets: 1,
  }));
}

export function simulate(persona: Persona, options: { days?: number } = {}): SimResult {
  const { prefs } = persona;
  const tz = prefs.timezone;
  const dogBefore = initialDog(persona);
  let dog = dogBefore;
  let history = initialHistory(persona);
  let ledger = newDayLedger(persona.startDay);
  const days: SimDay[] = [];

  for (let d = 0; d < (options.days ?? persona.days); d += 1) {
    const day = addDays(persona.startDay, d);
    const w = dayWindow(day, prefs);
    const at = (hhmm: string) => nextLocalTime(w.start, parseHHmm(hhmm), tz);
    ledger = newDayLedger(day, ledger);

    const bucketCount = Math.round((w.end - w.start) / BUCKET_MS);
    const allBuckets = prefs.stepsAvailable
      ? Array.from({ length: bucketCount }, (_, i) =>
          stepsForBucket(localMinutes(w.start + i * BUCKET_MS, tz), persona.steps),
        )
      : [];
    const waterTimes = (persona.water ?? []).map(at).sort((a, b) => a - b);
    const petTimes = (persona.pets ?? []).map(at);
    const rungs = (persona.screen ?? []).map((r) => ({ rung: r.rung, at: at(r.at) }));
    const manual: WalkEvent[] = (persona.manualWalks ?? []).map((m) => ({
      start: toISO(at(m.start)),
      end: toISO(at(m.start) + m.minutes * MINUTE_MS),
      steps: m.steps,
      source: 'manual',
    }));
    const moodAt = persona.mood ? at(persona.mood.at) : null;

    const detected: WalkEvent[] = [];
    const rows: TickRow[] = [];
    const pushes: SimDay['pushes'] = [];
    let lastTarget = 0;
    let askNudgeFrequency = false;
    const budget = nudgeBudget(prefs, ledger);

    for (let t = w.start; t < w.end; t += BUCKET_MS) {
      const doneBuckets = Math.floor((t - w.start) / BUCKET_MS);
      const water = waterTimes.filter((x) => x <= t);
      const rungNow = rungs.filter((r) => r.at <= t).sort((a, b) => b.rung - a.rung)[0];
      const firstTick = d === 0 && t === w.start;
      const lastOpenedAt = firstTick
        ? persona.lastOpenedDaysAgo === undefined
          ? undefined
          : toISO(t - persona.lastOpenedDaysAgo * DAY_MS)
        : toISO(t - BUCKET_MS);

      const out = computeDog({
        now: toISO(t),
        prefs,
        dog,
        history,
        ledger,
        lastOpenedAt,
        today: {
          day,
          dayStart: toISO(w.start),
          dayEnd: toISO(w.end),
          stepBuckets: allBuckets.slice(0, doneBuckets),
          walks: [...manual.filter((m) => toMs(m.end) <= t), ...detected],
          water: water.length,
          waterLastAt: water.length ? toISO(water[water.length - 1] as number) : undefined,
          screenRung: (rungNow?.rung ?? 0) as ScreenRung,
          screenRungAt: rungNow ? toISO(rungNow.at) : undefined,
          screenAckRung: 0,
          moodToday: moodAt !== null && moodAt <= t ? persona.mood?.value : undefined,
          petsToday: petTimes.filter((x) => x <= t).length,
        },
      });
      detected.push(...out.newWalks);
      lastTarget = out.stepTarget;
      askNudgeFrequency = askNudgeFrequency || out.askNudgeFrequency;

      // Deliver every planned nudge due before the next tick.
      const due = out.nudgePlan.filter((n) => toMs(n.at) < t + BUCKET_MS);
      for (const nudge of due) {
        ledger = {
          ...ledger,
          sentCount: ledger.sentCount + 1,
          lastSentAt: nudge.at,
          sentTypes: [...ledger.sentTypes, nudge.type],
          openedCount: ledger.openedCount + (persona.opensNudges ? 1 : 0),
        };
        pushes.push({
          type: nudge.type,
          at: nudge.at,
          local: formatHHmm(localMinutes(toMs(nudge.at), tz)),
        });
      }

      rows.push({
        at: toISO(t),
        local: formatHHmm(localMinutes(t, tz)),
        day,
        pose: out.state.pose,
        request: out.state.request,
        activeRequests: out.activeRequests,
        greeting: out.state.greeting,
        energy: out.state.energy,
        contentment: out.state.contentment,
        bond: out.state.bond,
        lineKey: out.lineKey,
        walkDetected: out.newWalks.length > 0,
        pushes: due.map((n) => n.type),
        pushesSent: ledger.sentCount,
        budget,
      });
    }

    const walks = countableWalks([...manual, ...detected]);
    const summary: DaySummary = {
      day,
      steps: sumSteps(allBuckets),
      walks: walks.length,
      water: waterTimes.length,
      screenRungMax: Math.max(0, ...rungs.map((r) => r.rung)) as ScreenRung,
      moodCheckin: moodAt !== null,
      goodDay: false,
      finalized: false,
      pets: petTimes.length,
      stepTarget: lastTarget,
    };
    const result = finalizeDay(summary, dog, ledger, prefs);
    dog = result.dog;
    ledger = result.ledger;
    history = [result.summary, ...history].slice(0, 14);
    days.push({
      day,
      rows,
      pushes,
      budget,
      askNudgeFrequency,
      summary: result.summary,
      unlockedTricks: result.unlockedTricks,
    });
  }

  return { personaId: persona.id, dogBefore, dog, ledger, days };
}

/**
 * Timeline text: `14:00 pose=idle req=leash energy=38 cont=55 push=leash (1/3)`.
 * By default only rows where something changed are printed.
 */
export function formatTimeline(result: SimResult, options: { all?: boolean } = {}): string {
  const lines: string[] = [`persona: ${result.personaId}`];
  for (const day of result.days) {
    lines.push('', `day ${day.day} (budget ${day.budget})`);
    let previous: TickRow | undefined;
    for (const row of day.rows) {
      const changed =
        !previous ||
        previous.request !== row.request ||
        previous.pose !== row.pose ||
        row.pushes.length > 0 ||
        row.walkDetected ||
        row.greeting !== 'none';
      if (options.all || changed) {
        const parts = [
          row.local,
          `pose=${row.pose}`,
          `req=${row.request}`,
          `energy=${row.energy}`,
          `cont=${row.contentment}`,
        ];
        if (row.greeting !== 'none') parts.push(`greet=${row.greeting}`);
        if (row.walkDetected) parts.push('walk=detected');
        for (const push of row.pushes) parts.push(`push=${push} (${row.pushesSent}/${row.budget})`);
        parts.push(`line=${row.lineKey}`);
        lines.push(parts.join(' '));
      }
      previous = row;
    }
    const s = day.summary;
    lines.push(
      `end: steps=${s.steps} target=${s.stepTarget} walks=${s.walks} water=${s.water} ` +
        `pushes=${day.pushes.length} goodDay=${s.goodDay}` +
        (day.unlockedTricks.length ? ` tricks+=${day.unlockedTricks.join(',')}` : '') +
        (day.askNudgeFrequency ? ' askNudgeFrequency' : ''),
    );
  }
  const d = result.dog;
  lines.push(
    '',
    `dog: bondPoints ${result.dogBefore.bondPoints}→${d.bondPoints}, ` +
      `goodDays ${result.dogBefore.goodDaysTotal}→${d.goodDaysTotal}, ` +
      `walks ${result.dogBefore.walksTotal}→${d.walksTotal}, tricks [${d.tricks.join(', ')}]`,
  );
  return lines.join('\n');
}
