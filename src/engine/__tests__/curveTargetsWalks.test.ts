import { activityPeaks, energyAt } from '../activityCurve';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../constants';
import { baselineSteps, dailyTarget, isBaselineLearning } from '../targets';
import { dayWindow, toISO } from '../time';
import type { WalkEvent } from '../types';
import { countableWalks, detectWalks, lastWalkEnd, stepsLastHour, sumSteps } from '../walks';
import { at, DAY, dog, history, iso, prefs, summary } from './helpers';

const w = dayWindow(DAY, prefs());

describe('activity curve (§4)', () => {
  it('peaks 15 min after waking and 4 h before bed', () => {
    expect(activityPeaks(w, 'adult')).toEqual([at('07:15'), at('19:00')]);
    expect(activityPeaks(w, 'senior')).toEqual([at('07:15') - HOUR_MS, at('18:00')]);
  });

  it('is high at peaks, low midday, and 5 while asleep', () => {
    expect(energyAt(at('07:15'), w, 'adult')).toBe(90);
    expect(energyAt(at('19:00'), w, 'adult')).toBe(90);
    expect(energyAt(at('13:00'), w, 'adult')).toBe(20);
    expect(energyAt(at('23:30'), w, 'adult')).toBe(5);
  });

  it('scales by life stage and clamps at 100', () => {
    expect(energyAt(at('07:15'), w, 'puppy')).toBe(100);
    expect(energyAt(at('19:00'), w, 'young')).toBe(100);
    expect(energyAt(at('19:00'), w, 'senior')).toBeLessThan(energyAt(at('18:00'), w, 'senior'));
  });
});

describe('baseline and target (§5)', () => {
  it('needs 3 finalized days with steps; uses the median of the last 7', () => {
    expect(baselineSteps(history([4_000, 6_000]))).toBeNull();
    expect(baselineSteps(history([4_000, 6_000, 5_000]))).toBe(5_000);
    expect(baselineSteps(history([1, 2, 3, 4]))).toBe(2.5);
    expect(baselineSteps([...history([0, 0, 3_000]), summary({ steps: 9_000 })])).toBeNull();
    expect(baselineSteps(history([1, 2, 3, 4, 5, 6, 7, 100, 100, 100]))).toBe(4);
  });

  it('defaults to 5,000 while learning', () => {
    expect(dailyTarget([])).toBe(5_000);
  });

  it('is baseline × 1.1 rounded to 100 and clamped 3,000–12,000', () => {
    expect(dailyTarget(history([5_000, 5_000, 5_000]))).toBe(5_500);
    expect(dailyTarget(history([5_040, 5_040, 5_040]))).toBe(5_500);
    expect(dailyTarget(history([500, 500, 500]))).toBe(3_000);
    expect(dailyTarget(history([20_000, 20_000, 20_000]))).toBe(12_000);
  });

  it('ramps at most 5% above last week', () => {
    const lastWeek = Array<number>(7).fill(5_000); // target 5,500 → cap 5,700 (floor of 5,775)
    expect(dailyTarget(history([...Array<number>(7).fill(8_000), ...lastWeek]))).toBe(5_700);
    expect(dailyTarget(history([...Array<number>(7).fill(5_000), ...lastWeek]))).toBe(5_500);
  });

  it('is in baseline learning for the first 7 days after adoption', () => {
    const adopted = at('07:00');
    const d = dog({ adoptedAt: toISO(adopted) });
    expect(isBaselineLearning(d, adopted + 6 * DAY_MS)).toBe(true);
    expect(isBaselineLearning(d, adopted + 7 * DAY_MS)).toBe(false);
  });
});

describe('walks (§5)', () => {
  const start = w.start;
  const bucketsWithWalk = [10, 10, 600, 600, 600, 10, 10];

  it('detects a 20-minute window of 1,000+ steps and merges a longer walk', () => {
    const found = detectWalks(bucketsWithWalk, start, start + 70 * MINUTE_MS, []);
    expect(found).toEqual([
      {
        start: toISO(start + 20 * MINUTE_MS),
        end: toISO(start + 50 * MINUTE_MS),
        steps: 1_800,
        source: 'detected',
      },
    ]);
  });

  it('ignores slow days and does not redetect a recorded walk, even as it continues', () => {
    expect(detectWalks([400, 500, 400, 500], start, start + DAY_MS, [])).toEqual([]);
    const first = detectWalks(bucketsWithWalk.slice(0, 4), start, start + 40 * MINUTE_MS, []);
    expect(first).toHaveLength(1);
    expect(detectWalks(bucketsWithWalk, start, start + 70 * MINUTE_MS, first)).toEqual([]);
  });

  it('does not double count a manual walk', () => {
    const manual: WalkEvent = {
      start: toISO(start + 20 * MINUTE_MS),
      end: toISO(start + 45 * MINUTE_MS),
      steps: 1_500,
      source: 'manual',
    };
    expect(detectWalks(bucketsWithWalk, start, start + 70 * MINUTE_MS, [manual])).toEqual([]);
  });

  it('caps the end of a walk in progress at now', () => {
    const [walk] = detectWalks([600, 600], start, start + 15 * MINUTE_MS, []);
    expect(walk?.end).toBe(toISO(start + 15 * MINUTE_MS));
  });

  it('counts manual walks of at least 5 minutes', () => {
    const manual = (minutes: number): WalkEvent => ({
      start: iso('09:00'),
      end: toISO(at('09:00') + minutes * MINUTE_MS),
      steps: 100,
      source: 'manual',
    });
    expect(countableWalks([manual(4), manual(5)])).toEqual([manual(5)]);
  });

  it('sums steps, the last hour, and the latest finished walk', () => {
    expect(sumSteps([1, 2, 3])).toBe(6);
    expect(stepsLastHour([100, 1, 1, 1, 1, 1, 1])).toBe(6);
    const walks: WalkEvent[] = [
      { start: iso('08:00'), end: iso('08:30'), steps: 2_000, source: 'detected' },
      { start: iso('12:00'), end: iso('12:30'), steps: 2_000, source: 'detected' },
    ];
    expect(lastWalkEnd(walks, at('10:00'))).toBe(at('08:30'));
    expect(lastWalkEnd(walks, at('13:00'))).toBe(at('12:30'));
    expect(lastWalkEnd([], at('13:00'))).toBeNull();
  });
});
