// Test personas (DOG_ENGINE.md §12). Shared by Jest, `npm run simulate` and, later, the
// mock services and the dev menu. Times are local HH:mm within the persona's user-day.

import { DEFAULT_PREFS } from '../constants';
import type { Breed, DayKey, HHmm, Mood, Prefs, TrickId } from '../types';

/** Steps per 10-minute bucket for buckets starting in [from, to). Ranges may wrap midnight. */
export type StepSegment = [from: HHmm, to: HHmm, stepsPerBucket: number];

export interface Persona {
  id: string;
  description: string;
  prefs: Prefs;
  startDay: DayKey;
  days: number;
  dog: {
    name: string;
    breed: Breed;
    adoptedDaysBeforeStart: number;
    adoptedAsSenior?: boolean;
    bondPoints?: number;
    goodDaysTotal?: number;
    walksTotal?: number;
    tricks?: TrickId[];
  };
  /** Steps of the finalized days before startDay, most recent first. */
  historySteps?: number[];
  /** Days with no data between the history and startDay (the user was away). */
  historyGapDays?: number;
  steps: StepSegment[];
  screen?: { rung: 1 | 2 | 3; at: HHmm }[];
  water?: HHmm[];
  pets?: HHmm[];
  mood?: { at: HHmm; value: Mood };
  manualWalks?: { start: HHmm; minutes: number; steps: number }[];
  /** For the first tick of the first day: when the app was last opened. */
  lastOpenedDaysAgo?: number;
  /** Whether the user opens pushed nudges (within the hour). */
  opensNudges: boolean;
}

const START: DayKey = '2026-10-05'; // a Monday
const regularWater: HHmm[] = ['08:00', '10:30', '13:00', '15:30', '18:00', '20:00'];

const deskWorkerSteps: StepSegment[] = [
  ['07:00', '09:00', 20],
  ['09:00', '10:20', 0], // long sit: play bow at 10:00
  ['10:20', '10:30', 160], // coffee run clears it
  ['10:30', '17:30', 19], // ~800 steps by 14:00
  ['17:30', '17:50', 800], // 1,600-step walk
  ['17:50', '23:00', 19],
];

const deskWorker: Persona = {
  id: 'desk-worker',
  description: 'Office day: 800 steps by 14:00, one walk 17:30–17:50, baseline 5,000.',
  prefs: { ...DEFAULT_PREFS, stepsAvailable: true },
  startDay: START,
  days: 1,
  dog: { name: 'Biscuit', breed: 'aspin', adoptedDaysBeforeStart: 30, goodDaysTotal: 20 },
  historySteps: Array<number>(7).fill(5_000),
  steps: deskWorkerSteps,
  water: regularWater,
  pets: ['08:05'],
  opensNudges: true,
};

export const PERSONAS = {
  'desk-worker': deskWorker,

  'night-shift': {
    id: 'night-shift',
    description: 'BPO night shift: wake 15:00, bed 07:00, Asia/Manila.',
    prefs: { ...DEFAULT_PREFS, wakeTime: '15:00', bedTime: '07:00', stepsAvailable: true },
    startDay: START,
    days: 2,
    dog: { name: 'Mochi', breed: 'shiba', adoptedDaysBeforeStart: 30, goodDaysTotal: 10 },
    historySteps: Array<number>(7).fill(6_000),
    steps: [
      ['15:00', '07:00', 60],
      ['18:00', '18:20', 700],
    ],
    water: ['16:00', '19:00', '22:00', '01:00', '04:00', '06:00'],
    opensNudges: true,
  },

  scroller: {
    id: 'scroller',
    description: 'Normal steps; 60 min on watched apps by 13:00 and 120 min by 16:00.',
    prefs: { ...DEFAULT_PREFS, stepsAvailable: true, screenTimeEnabled: true },
    startDay: START,
    days: 1,
    dog: { name: 'Pancake', breed: 'corgi', adoptedDaysBeforeStart: 30, goodDaysTotal: 20 },
    historySteps: Array<number>(7).fill(6_000),
    steps: [['07:00', '23:00', 60]],
    screen: [
      { rung: 1, at: '12:15' },
      { rung: 2, at: '13:00' },
      { rung: 3, at: '16:00' },
    ],
    water: regularWater,
    opensNudges: true,
  },

  returning: {
    ...deskWorker,
    id: 'returning',
    description: 'Back after 5 days away.',
    dog: { ...deskWorker.dog, bondPoints: 120, goodDaysTotal: 18, walksTotal: 12 },
    historyGapDays: 5,
    lastOpenedDaysAgo: 5,
  },

  'no-permissions': {
    id: 'no-permissions',
    description: 'Denied steps and screen time; logs a manual walk, water and mood.',
    prefs: { ...DEFAULT_PREFS, stepsAvailable: false, screenTimeEnabled: false },
    startDay: START,
    days: 1,
    dog: { name: 'Choco', breed: 'golden', adoptedDaysBeforeStart: 10 },
    steps: [],
    manualWalks: [{ start: '18:00', minutes: 20, steps: 1_500 }],
    water: [...regularWater, '21:00', '22:00'],
    mood: { at: '20:00', value: 4 },
    opensNudges: true,
  },

  'quiet-hours': {
    ...deskWorker,
    id: 'quiet-hours',
    description: 'Quiet hours 09:00–12:00; sitting and 60 min on watched apps by 10:00.',
    prefs: {
      ...deskWorker.prefs,
      screenTimeEnabled: true,
      quietHours: [{ start: '09:00', end: '12:00' }],
    },
    screen: [
      { rung: 1, at: '09:45' },
      { rung: 2, at: '10:00' },
    ],
    steps: [
      ['07:00', '09:00', 20],
      ['09:00', '12:00', 0],
      ['12:00', '23:00', 30],
    ],
  },

  'new-user': {
    id: 'new-user',
    description: 'Adopted today: baseline learning, low steps.',
    prefs: { ...DEFAULT_PREFS, stepsAvailable: true },
    startDay: START,
    days: 1,
    dog: { name: 'Bantay', breed: 'aspin', adoptedDaysBeforeStart: 0 },
    steps: [['07:00', '23:00', 15]],
    opensNudges: true,
  },

  ignorer: {
    ...deskWorker,
    id: 'ignorer',
    description: 'Never opens nudges, four days in a row.',
    days: 4,
    opensNudges: false,
  },
} satisfies Record<string, Persona>;

export type PersonaId = keyof typeof PERSONAS;
export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];
