// DOG_ENGINE.md §12: every persona row must hold.

import { MINUTE_MS, NUDGE } from '../constants';
import { PERSONA_IDS, PERSONAS } from '../sim/personas';
import { formatTimeline, simulate, type SimDay, type TickRow } from '../sim/simulate';
import { dayKeyAt, dayWindow, inQuietHours, parseHHmm, toMs, walkCheckAt } from '../time';

const row = (day: SimDay, local: string): TickRow => {
  const found = day.rows.find((r) => r.local === local);
  if (!found) throw new Error(`no row at ${local}`);
  return found;
};
const firstDay = (id: keyof typeof PERSONAS) => simulate(PERSONAS[id]).days[0] as SimDay;
const minutes = (local: string) => parseHHmm(local);

function expectSpacedPushes(day: SimDay) {
  for (let i = 1; i < day.pushes.length; i += 1) {
    const gap = toMs(day.pushes[i]!.at) - toMs(day.pushes[i - 1]!.at);
    expect(gap).toBeGreaterThanOrEqual(NUDGE.MIN_GAP_MIN * MINUTE_MS);
  }
}

describe('desk-worker', () => {
  const day = firstDay('desk-worker');

  it('asks for a walk at 14:00 (800 < 1,444 expected by now)', () => {
    expect(row(day, '13:50').request).not.toBe('leash');
    expect(row(day, '14:00').request).toBe('leash');
    expect(day.pushes.map((p) => `${p.type}@${p.local}`)).toContain('leash@14:00');
  });

  it('detects the walk at 17:50 and clears the leash', () => {
    expect(row(day, '17:50').walkDetected).toBe(true);
    expect(row(day, '17:40').request).toBe('leash');
    expect(row(day, '17:50').activeRequests).not.toContain('leash');
    expect(day.summary.walks).toBe(1);
  });

  it('sends at most 3 pushes', () => {
    expect(day.pushes.length).toBeLessThanOrEqual(3);
    expectSpacedPushes(day);
  });
});

describe('night-shift', () => {
  const persona = PERSONAS['night-shift'];
  const result = simulate(persona);

  it('starts the day key at 15:00 and checks walks at 22:00', () => {
    const w = dayWindow(persona.startDay, persona.prefs);
    expect(dayKeyAt(w.start, persona.prefs)).toBe(persona.startDay);
    expect(dayKeyAt(w.start - MINUTE_MS, persona.prefs)).not.toBe(persona.startDay);
    expect(walkCheckAt(w, persona.prefs)).toBe(w.start + 7 * 60 * MINUTE_MS);
  });

  it('sleeps 07:00–15:00 and sends nothing 07:00–15:30', () => {
    for (const day of result.days) {
      for (const r of day.rows) {
        const m = minutes(r.local);
        const asleep = m >= minutes('07:00') && m < minutes('15:00');
        expect(r.pose === 'sleeping').toBe(asleep);
      }
      for (const p of day.pushes) {
        const m = minutes(p.local);
        expect(m >= minutes('07:00') && m < minutes('15:30')).toBe(false);
      }
    }
  });
});

describe('scroller', () => {
  const day = firstDay('scroller');

  it('pushes the ball at 13:00 and the sigh at 16:00, never rung 1', () => {
    const pushes = day.pushes.map((p) => `${p.type}@${p.local}`);
    expect(pushes).toContain('ball@13:00');
    expect(pushes).toContain('bored@16:00');
    expect(day.pushes.some((p) => p.local === '12:20')).toBe(false);
    expect(row(day, '12:20').lineKey).toBe('rung1.0');
    expectSpacedPushes(day);
  });
});

describe('returning', () => {
  const result = simulate(PERSONAS.returning);
  const day = result.days[0] as SimDay;

  it('greets big with no sulking and keeps every total', () => {
    expect(day.rows[0]?.greeting).toBe('big');
    expect(day.rows[0]?.lineKey).toMatch(/^greetBig\./);
    for (const r of day.rows) expect(r.contentment).toBeGreaterThanOrEqual(20);
    expect(result.dog.bondPoints).toBeGreaterThanOrEqual(result.dogBefore.bondPoints);
    expect(result.dog.goodDaysTotal).toBeGreaterThanOrEqual(result.dogBefore.goodDaysTotal);
  });
});

describe('no-permissions', () => {
  const result = simulate(PERSONAS['no-permissions']);
  const day = result.days[0] as SimDay;

  it('never asks for walks or stretches, counts the manual walk, has a good day', () => {
    for (const r of day.rows) {
      expect(r.activeRequests).not.toContain('leash');
      expect(r.activeRequests).not.toContain('playBow');
    }
    expect(day.summary.walks).toBe(1);
    expect(result.dog.walksTotal).toBe(result.dogBefore.walksTotal + 1);
    expect(day.summary.goodDay).toBe(true);
  });
});

describe('quiet-hours', () => {
  const persona = PERSONAS['quiet-hours'];
  const day = firstDay('quiet-hours');

  it('sends nothing in quiet hours even with a request active', () => {
    const inside = day.rows.filter((r) => inQuietHours(toMs(r.at), persona.prefs));
    expect(inside.some((r) => r.request === 'ball')).toBe(true);
    expect(inside.flatMap((r) => r.pushes)).toEqual([]);
    expect(day.pushes.every((p) => !inQuietHours(toMs(p.at), persona.prefs))).toBe(true);
    expect(day.pushes[0]?.local).toBe('12:00');
  });
});

describe('new-user', () => {
  const day = firstDay('new-user');

  it('shows the leash in-app but never pushes step nudges while learning', () => {
    expect(row(day, '14:00').request).toBe('leash');
    expect(day.pushes.filter((p) => p.type === 'leash' || p.type === 'playBow')).toEqual([]);
  });
});

describe('ignorer', () => {
  const result = simulate(PERSONAS.ignorer);

  it('drops the budget by one on day 4 and asks about frequency', () => {
    const [d1, d2, d3, d4] = result.days as [SimDay, SimDay, SimDay, SimDay];
    expect([d1.budget, d2.budget, d3.budget, d4.budget]).toEqual([3, 3, 3, 2]);
    expect(d3.askNudgeFrequency).toBe(false);
    expect(d4.askNudgeFrequency).toBe(true);
    expect(d4.pushes.length).toBeLessThanOrEqual(2);
  });
});

describe('every persona', () => {
  it.each(PERSONA_IDS)('%s respects the budget and spacing, and prints a timeline', (id) => {
    const result = simulate(PERSONAS[id]);
    for (const day of result.days) {
      expect(day.pushes.length).toBeLessThanOrEqual(day.budget);
      expectSpacedPushes(day);
    }
    const text = formatTimeline(result);
    expect(text).toContain(`persona: ${id}`);
    expect(formatTimeline(result, { all: true }).split('\n').length).toBeGreaterThan(
      text.split('\n').length,
    );
  });
});
