import { activityPoints, bondFromPoints, finalizationPoints, tailRightBias } from '../bond';
import { contentmentFor, poseFor, type ContentmentInput } from '../contentment';
import { a11yKeyFor, hashString, lineBaseFor, lineKeyFor, variantFor } from '../copyKeys';
import { goodDayCriteria, isGoodDay } from '../goodDay';
import { greetingFor } from '../greetings';
import { earnedTricks, lifeStageFor, newTricks } from '../growth';
import { renderProps } from '../renderProps';
import type { DogState } from '../types';
import { at, DAY, dog, iso, prefs, summary } from './helpers';

const calm: ContentmentInput = {
  activeRequests: [],
  screenRung: 0,
  walkEndedWithin2h: false,
  petsToday: 0,
  water: 0,
  waterGoal: 8,
  moodCheckedIn: false,
};

describe('contentment (§7)', () => {
  it('starts at 70', () => {
    expect(contentmentFor(calm)).toBe(70);
  });

  it('drops for requests, capped at −25 total', () => {
    expect(contentmentFor({ ...calm, activeRequests: ['leash'] })).toBe(55);
    expect(contentmentFor({ ...calm, activeRequests: ['bored'] })).toBe(50);
    expect(contentmentFor({ ...calm, activeRequests: ['bored', 'ball', 'leash', 'playBow'] })).toBe(
      45,
    );
    expect(contentmentFor({ ...calm, activeRequests: ['water', 'bedtime'] })).toBe(70);
    expect(contentmentFor({ ...calm, screenRung: 1 })).toBe(65);
  });

  it('rises with walks, pets (max +15), water goal and a check-in, up to 100', () => {
    expect(contentmentFor({ ...calm, walkEndedWithin2h: true })).toBe(80);
    expect(contentmentFor({ ...calm, petsToday: 2 })).toBe(80);
    expect(contentmentFor({ ...calm, petsToday: 9 })).toBe(85);
    expect(contentmentFor({ ...calm, water: 8 })).toBe(75);
    expect(contentmentFor({ ...calm, waterGoal: 0, water: 0 })).toBe(70);
    expect(contentmentFor({ ...calm, moodCheckedIn: true })).toBe(75);
    expect(
      contentmentFor({
        ...calm,
        walkEndedWithin2h: true,
        petsToday: 3,
        water: 8,
        moodCheckedIn: true,
      }),
    ).toBe(100);
  });
});

describe('pose (§7)', () => {
  it('maps sleep, requests and energy', () => {
    expect(poseFor(true, 'none', 90)).toBe('sleeping');
    expect(poseFor(false, 'leash', 90)).toBe('idle');
    expect(poseFor(false, 'none', 70)).toBe('excited');
    expect(poseFor(false, 'none', 40)).toBe('sniffing');
    expect(poseFor(false, 'none', 39)).toBe('resting');
  });
});

describe('greeting (§7, PRD F3)', () => {
  const now = iso('12:00');
  it.each([
    ['none', 29],
    ['small', 30],
    ['small', 119],
    ['big', 120],
    ['big', 60 * 24 * 7],
  ] as const)('%s after %i minutes away', (expected, minutes) => {
    expect(greetingFor(new Date(at('12:00') - minutes * 60_000).toISOString(), now, false)).toBe(
      expected,
    );
  });

  it('is none while asleep or on first open', () => {
    expect(greetingFor(iso('08:00'), now, true)).toBe('none');
    expect(greetingFor(undefined, now, false)).toBe('none');
  });
});

describe('bond (§8)', () => {
  it('awards capped daily points and only grows', () => {
    expect(activityPoints({ walks: 5, pets: 7, moodCheckin: true })).toBe(6 + 3 + 1);
    expect(activityPoints({ walks: 0, pets: 0, moodCheckin: false })).toBe(0);
    expect(finalizationPoints(true, true)).toBe(7);
    expect(finalizationPoints(false, false)).toBe(0);
  });

  it('maps points to 0–100 with diminishing returns', () => {
    expect(bondFromPoints(0)).toBe(0);
    expect(bondFromPoints(200)).toBe(63);
    expect(bondFromPoints(10_000)).toBe(100);
    expect(bondFromPoints(-5)).toBe(0);
    expect(tailRightBias(100)).toBeCloseTo(0.3);
    expect(tailRightBias(0)).toBe(0);
  });
});

describe('growth (§8)', () => {
  it('grows puppy → young → adult by good days; senior only by choice', () => {
    expect(lifeStageFor({ adoptedAsSenior: false, goodDaysTotal: 14 })).toBe('puppy');
    expect(lifeStageFor({ adoptedAsSenior: false, goodDaysTotal: 15 })).toBe('young');
    expect(lifeStageFor({ adoptedAsSenior: false, goodDaysTotal: 60 })).toBe('adult');
    expect(lifeStageFor({ adoptedAsSenior: false, goodDaysTotal: 999 })).toBe('adult');
    expect(lifeStageFor({ adoptedAsSenior: true, goodDaysTotal: 0 })).toBe('senior');
  });

  it('unlocks tricks at their milestones', () => {
    expect(earnedTricks({ goodDaysTotal: 2, walksTotal: 9 })).toEqual([]);
    expect(earnedTricks({ goodDaysTotal: 3, walksTotal: 10 })).toEqual(['sit', 'fetch']);
    expect(earnedTricks({ goodDaysTotal: 100, walksTotal: 0 })).toEqual([
      'sit',
      'paw',
      'spin',
      'rollOver',
      'highFive',
      'bow',
      'dance',
    ]);
    expect(newTricks(dog({ goodDaysTotal: 7, tricks: ['sit'] }))).toEqual(['paw']);
  });
});

describe('good day (§8)', () => {
  const all = { stepsAvailable: true, screenTimeEnabled: true, waterGoal: 8 };

  it('needs 2 of the available criteria', () => {
    expect(isGoodDay(summary({ walks: 1, screenRungMax: 2 }), all)).toBe(false);
    expect(isGoodDay(summary({ walks: 1 }), all)).toBe(true); // rung 0 is a calm screen day
    expect(isGoodDay(summary({ walks: 1, water: 6 }), all)).toBe(true);
    expect(isGoodDay(summary({ steps: 6_000, stepTarget: 5_500, moodCheckin: true }), all)).toBe(
      true,
    );
    expect(isGoodDay(summary({ water: 6, screenRungMax: 1 }), all)).toBe(true);
    expect(isGoodDay(summary({ water: 5, screenRungMax: 2 }), all)).toBe(false);
  });

  it('only counts criteria the user can meet', () => {
    const none = { stepsAvailable: false, screenTimeEnabled: false, waterGoal: 8 };
    const c = goodDayCriteria(summary(), none);
    expect(c.movement.available).toBe(false);
    expect(c.calmScreen.available).toBe(false);
    expect(goodDayCriteria(summary({ walks: 1 }), none).movement.available).toBe(true);
    // calm screen is met by default but not available without screen time
    expect(isGoodDay(summary({ moodCheckin: true }), none)).toBe(false);
  });

  it('lets a single available criterion suffice', () => {
    const onlyMood = { stepsAvailable: false, screenTimeEnabled: false, waterGoal: 0 };
    expect(isGoodDay(summary({ moodCheckin: true }), onlyMood)).toBe(true);
    expect(isGoodDay(summary(), onlyMood)).toBe(false);
  });
});

describe('copy keys (§10)', () => {
  const state = { isAsleep: false, request: 'none', pose: 'resting' } as const;

  it('hashes deterministically', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(variantFor(DAY, 'leash', 1)).toBe(0);
    expect(variantFor(DAY, 'leash', 2)).toBe(variantFor(DAY, 'leash', 2));
  });

  it('picks sleep, greeting, request, head rest, rung 1, then pose', () => {
    const base = { day: DAY, greeting: 'none', screenRung: 0 } as const;
    expect(lineBaseFor({ ...base, state: { ...state, isAsleep: true }, greeting: 'big' })).toBe(
      'sleeping',
    );
    expect(lineBaseFor({ ...base, state, greeting: 'big' })).toBe('greetBig');
    expect(lineBaseFor({ ...base, state, greeting: 'small' })).toBe('greetSmall');
    expect(lineBaseFor({ ...base, state: { ...state, request: 'leash' }, moodToday: 1 })).toBe(
      'leash',
    );
    expect(lineBaseFor({ ...base, state, moodToday: 2 })).toBe('headRest');
    expect(lineBaseFor({ ...base, state, moodToday: 3, screenRung: 1 })).toBe('rung1');
    expect(lineBaseFor({ ...base, state })).toBe('resting');
    expect(lineKeyFor({ ...base, state })).toMatch(/^resting\.[01]$/);
  });

  it('labels the request, else the pose, for screen readers', () => {
    expect(a11yKeyFor({ request: 'leash', pose: 'idle' })).toBe('a11y.leash');
    expect(a11yKeyFor({ request: 'none', pose: 'sleeping' })).toBe('a11y.sleeping');
  });
});

describe('render props (§11)', () => {
  it('maps state to the Rive contract indices', () => {
    const state: DogState = {
      pose: 'idle',
      request: 'playBow',
      greeting: 'none',
      energy: 50,
      contentment: 60,
      bond: 50,
      lifeStage: 'young',
      bowlLevel: 1,
      isAsleep: false,
      baselineLearning: false,
    };
    expect(
      renderProps(state, { breed: 'corgi' }, at('18:30', prefs()), 'Asia/Manila', true),
    ).toEqual({
      breed: 3,
      lifeStage: 1,
      energy: 50,
      contentment: 60,
      bond: 50,
      pose: 2,
      request: 2,
      timeOfDay: 18.5,
      reduceMotion: true,
      tailRightBias: 0.15,
    });
  });
});
