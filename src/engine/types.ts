// Engine types. See docs/DOG_ENGINE.md §2. Additions beyond the spec are marked "ext".

export type ISO = string; // UTC ISO timestamp
export type DayKey = string; // 'YYYY-MM-DD', user-local "day" (starts at wake time)
export type HHmm = string; // '07:00'

export type Breed = 'aspin' | 'shiba' | 'golden' | 'corgi';
export type LifeStage = 'puppy' | 'young' | 'adult' | 'senior';
export type Pose = 'sleeping' | 'resting' | 'idle' | 'sniffing' | 'excited';
export type Request = 'none' | 'leash' | 'playBow' | 'ball' | 'bored' | 'water' | 'bedtime';
export type Greeting = 'none' | 'small' | 'big';
export type ScreenRung = 0 | 1 | 2 | 3; // 45 / 60 / 120 minutes on watched apps
export type TrickId = 'sit' | 'paw' | 'spin' | 'rollOver' | 'highFive' | 'bow' | 'fetch' | 'dance';
export type NudgeType = 'leash' | 'playBow' | 'ball' | 'bored' | 'bedtime';
export type Mood = 1 | 2 | 3 | 4 | 5;

export interface QuietHours {
  start: HHmm;
  end: HHmm;
}

export interface Prefs {
  timezone: string; // IANA, default 'Asia/Manila'
  wakeTime: HHmm; // default '07:00'
  bedTime: HHmm; // default '23:00' (may be earlier than wakeTime: night shift)
  weekendWakeTime?: HHmm; // optional separate weekend schedule
  weekendBedTime?: HHmm;
  walkCheckTime?: HHmm; // default derived, see §6.1
  nudgesPerDay: 0 | 1 | 2 | 3; // default 3
  quietHours: QuietHours[];
  waterGoal: number; // glasses, default 8
  screenTimeEnabled: boolean;
  stepsAvailable: boolean; // permission granted and source works
}

export interface DogProfile {
  id: string;
  name: string;
  breed: Breed;
  adoptedAt: ISO;
  adoptedAsSenior: boolean; // senior is chosen at adoption, never reached by aging
  bondPoints: number; // never decreases
  goodDaysTotal: number; // never decreases
  walksTotal: number; // never decreases
  tricks: TrickId[];
}

export interface WalkEvent {
  start: ISO;
  end: ISO;
  steps: number;
  source: 'detected' | 'manual';
}

export interface TodayData {
  day: DayKey;
  dayStart: ISO; // today's wake time (UTC)
  dayEnd: ISO; // next wake time (UTC)
  stepBuckets: number[]; // 10-minute buckets from dayStart to now
  walks: WalkEvent[];
  water: number;
  waterLastAt?: ISO;
  screenRung: ScreenRung; // after early-fire guard
  screenRungAt?: ISO; // ext: when the current rung fired (walk-after-rung acknowledges it)
  screenAckRung: ScreenRung; // highest rung the user already acknowledged in-app
  moodToday?: Mood;
  petsToday: number;
}

export interface DaySummary {
  day: DayKey;
  steps: number;
  walks: number;
  water: number;
  screenRungMax: ScreenRung;
  moodCheckin: boolean;
  goodDay: boolean;
  finalized: boolean;
  pets: number; // ext: needed for the day's bond points
  stepTarget?: number; // ext: the day's target, for the "target met" good-day criterion
}

export interface NudgeLedger {
  day: DayKey;
  sentCount: number;
  lastSentAt?: ISO;
  sentTypes: NudgeType[];
  openedCount: number;
  ignoredStreakDays: number;
}

export interface EngineInput {
  now: ISO;
  prefs: Prefs;
  dog: DogProfile;
  today: TodayData;
  history: DaySummary[]; // most recent first, up to 14 days
  ledger: NudgeLedger;
  lastOpenedAt?: ISO;
  lastPlayBowAt?: ISO; // when the user last answered a play bow ("Stretch with {name}")
  reduceMotion?: boolean; // ext: OS setting, passed through to RenderProps
}

export interface DogState {
  pose: Pose;
  request: Request;
  greeting: Greeting;
  energy: number; // 0–100
  contentment: number; // 20–100 (floor 20: the dog is never miserable)
  bond: number; // 0–100
  lifeStage: LifeStage;
  bowlLevel: number; // 0–1
  isAsleep: boolean;
  baselineLearning: boolean;
}

export interface PlannedNudge {
  type: NudgeType;
  at: ISO;
  copyKey: string;
  deepLink: string;
}

/** Values handed to the dog renderer. Names follow the Rive contract (ARCHITECTURE §7). */
export interface RenderProps {
  breed: number;
  lifeStage: number;
  energy: number;
  contentment: number;
  bond: number;
  pose: number;
  request: number;
  timeOfDay: number; // local hours as a decimal, 0–24
  reduceMotion: boolean;
  tailRightBias: number; // 0–0.3, derived from bond (placeholder renderer; Rive derives it itself)
}

export interface EngineOutput {
  state: DogState;
  render: RenderProps;
  lineKey: string; // copy key for the speech/caption line
  nudgePlan: PlannedNudge[]; // nudges allowed from now until day end
  unlockedTricks: TrickId[]; // newly unlocked by this computation
  a11yLabelKey: string;
  // ext fields:
  activeRequests: Request[]; // every request whose conditions hold, highest priority first
  newWalks: WalkEvent[]; // walks detected in this computation; the data layer stores them
  stepsToday: number;
  stepTarget: number;
  askNudgeFrequency: boolean; // show "Should I check in less often?"
}
