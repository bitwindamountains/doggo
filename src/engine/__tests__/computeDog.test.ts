import { computeDog } from '../computeDog';
import { toISO } from '../time';
import { at, buckets, dog, input, iso, prefs } from './helpers';

describe('computeDog', () => {
  it('is deterministic', () => {
    const i = input('14:00', { today: { stepBuckets: buckets('14:00', [], 10) } });
    expect(computeDog(i)).toEqual(computeDog(i));
  });

  it('shows the leash and its screen-reader label when behind in the afternoon', () => {
    const out = computeDog(
      input('14:00', { today: { stepBuckets: buckets('14:00', [], 10), water: 8 } }),
    );
    expect(out.state).toMatchObject({ request: 'leash', pose: 'idle', isAsleep: false });
    expect(out.a11yLabelKey).toBe('a11y.leash');
    expect(out.lineKey).toMatch(/^leash\./);
    expect(out.stepTarget).toBe(5_500);
    expect(out.nudgePlan[0]?.type).toBe('leash');
  });

  it('reports new walks and clears the leash right away', () => {
    const steps = buckets('17:50', [['17:30', '17:50', 800]], 10);
    const out = computeDog(input('17:50', { today: { stepBuckets: steps, water: 8 } }));
    expect(out.newWalks).toHaveLength(1);
    expect(out.newWalks[0]).toMatchObject({ start: iso('17:30'), end: iso('17:50'), steps: 1_600 });
    expect(out.activeRequests).not.toContain('leash');
    expect(out.state.contentment).toBe(85); // 70 + walk 10 + water goal 5
  });

  it('ignores step data when steps are not available', () => {
    const steps = buckets('17:50', [['17:30', '17:50', 800]], 10);
    const out = computeDog(
      input('17:50', { prefs: prefs({ stepsAvailable: false }), today: { stepBuckets: steps } }),
    );
    expect(out.newWalks).toEqual([]);
  });

  it('treats a walk after a screen-time rung as answering it', () => {
    const base = { stepBuckets: buckets('15:00', [], 100), water: 8, screenRung: 2 as const };
    const asked = computeDog(input('15:00', { today: { ...base, screenRungAt: iso('13:00') } }));
    expect(asked.state.request).toBe('ball');
    const walked = computeDog(
      input('15:00', {
        today: {
          ...base,
          screenRungAt: iso('13:00'),
          walks: [{ start: iso('13:30'), end: iso('14:00'), steps: 2_000, source: 'manual' }],
        },
      }),
    );
    expect(walked.state.request).toBe('none');
    const answered = computeDog(input('15:00', { today: { ...base, screenAckRung: 2 } }));
    expect(answered.state.request).toBe('none');
  });

  it('greets, sleeps and reports the bowl', () => {
    const away = computeDog(input('09:00', { lastOpenedAt: toISO(at('09:00') - 3 * 3_600_000) }));
    expect(away.state.greeting).toBe('big');
    expect(away.lineKey).toMatch(/^greetBig\./);
    const night = computeDog(input('23:30', { lastOpenedAt: iso('12:00') }));
    expect(night.state).toMatchObject({
      isAsleep: true,
      pose: 'sleeping',
      greeting: 'none',
      bowlLevel: 1,
    });
    expect(night.nudgePlan).toEqual([]);
    expect(computeDog(input('15:00')).state.bowlLevel).toBeCloseTo(1 / 5);
  });

  it('rests its head on the user after a low mood check-in', () => {
    const out = computeDog(
      input('10:00', { today: { stepBuckets: buckets('10:00', [], 100), water: 8, moodToday: 2 } }),
    );
    expect(out.lineKey).toBe('headRest.0');
  });

  it('adds today’s points to the bond shown, without changing the dog', () => {
    const d = dog({ bondPoints: 100 });
    const out = computeDog(input('10:00', { dog: d, today: { petsToday: 2, moodToday: 4 } }));
    expect(out.state.bond).toBe(40); // 103 points → 40.25
    expect(d.bondPoints).toBe(100);
  });

  it('reports tricks earned but not yet learned, and the frequency question', () => {
    const out = computeDog(
      input('10:00', {
        dog: dog({ goodDaysTotal: 3 }),
        ledger: {
          day: '2026-10-05',
          sentCount: 0,
          sentTypes: [],
          openedCount: 0,
          ignoredStreakDays: 3,
        },
      }),
    );
    expect(out.unlockedTricks).toEqual(['sit']);
    expect(out.askNudgeFrequency).toBe(true);
  });

  it('is in baseline learning for a new dog and passes reduce motion through', () => {
    const out = computeDog(
      input('10:00', { dog: dog({ adoptedAt: toISO(at('07:00')) }), reduceMotion: true }),
    );
    expect(out.state.baselineLearning).toBe(true);
    expect(out.render.reduceMotion).toBe(true);
    expect(computeDog(input('10:00')).render.reduceMotion).toBe(false);
  });

  it('uses the last play-bow answer for the cooldown', () => {
    const sitting = buckets('10:00', [['09:00', '10:00', 0]], 100);
    const fresh = computeDog(input('10:00', { today: { stepBuckets: sitting, water: 8 } }));
    expect(fresh.state.request).toBe('playBow');
    const answered = computeDog(
      input('10:00', { today: { stepBuckets: sitting, water: 8 }, lastPlayBowAt: iso('09:55') }),
    );
    expect(answered.state.request).toBe('none');
  });
});
