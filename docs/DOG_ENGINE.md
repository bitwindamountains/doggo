# Dog Years — Dog Engine Spec

The engine turns stored data into the dog's state, its current request, the renderer
properties, and a plan of notifications. It is **pure TypeScript**: no React, no Expo, no
I/O, no implicit clock. Same input → same output. All numbers below live in
`src/engine/constants.ts` so they can be tuned in one place.

## 1. Why the dog behaves this way (research basis)

| Rule | Basis |
| --- | --- |
| Two activity peaks, mostly resting | Pet dogs on accelerometers peak around 7 am and 7 pm; young dogs are more active at peaks; weekend peaks run 1–3 h later; older dogs peak earlier. Dogs alone rest 92–97% of the time. |
| Peaks follow the owner's schedule | Companion dogs' activity is shaped by their humans' routines more than by domestication. |
| Greeting scales with time away, then caps | Greetings are stronger after 2 h apart than 30 min, with no difference between 2 h and 4 h. |
| "Asking" = inner brow raise, play bow | Dogs use an inner-brow raise that reads as puppy eyes; the play bow is a stereotyped invitation that restarts play. |
| Tail wag shifts right as bond grows | Dogs wag more to the right for their owner; the right bias grows over days of familiarity. |
| Growth over ~60 good days, misses forgiven | New habits took a median of 66 days to become automatic; one missed day didn't matter. |
| No zero-reset streaks | Highlighted broken streaks reduce re-engagement; repairable progress reduces the drop. |

## 2. Types

```ts
// src/engine/types.ts
export type ISO = string;            // UTC ISO timestamp
export type DayKey = string;         // 'YYYY-MM-DD', user-local "day" (starts at wake time)
export type HHmm = string;           // '07:00'

export type Breed = 'aspin' | 'shiba' | 'golden' | 'corgi';
export type LifeStage = 'puppy' | 'young' | 'adult' | 'senior';
export type Pose = 'sleeping' | 'resting' | 'idle' | 'sniffing' | 'excited';
export type Request = 'none' | 'leash' | 'playBow' | 'ball' | 'bored' | 'water' | 'bedtime';
export type Greeting = 'none' | 'small' | 'big';
export type ScreenRung = 0 | 1 | 2 | 3;    // 45 / 60 / 120 minutes on watched apps
export type TrickId = 'sit' | 'paw' | 'spin' | 'rollOver' | 'highFive' | 'bow' | 'fetch' | 'dance';
export type NudgeType = 'leash' | 'playBow' | 'ball' | 'bored' | 'bedtime';

export interface Prefs {
  timezone: string;                  // IANA, default 'Asia/Manila'
  wakeTime: HHmm;                    // default '07:00'
  bedTime: HHmm;                     // default '23:00' (may be earlier than wakeTime: night shift)
  weekendWakeTime?: HHmm;            // optional separate weekend schedule
  weekendBedTime?: HHmm;
  walkCheckTime?: HHmm;              // default derived, see §6.1
  nudgesPerDay: 0 | 1 | 2 | 3;       // default 3
  quietHours: { start: HHmm; end: HHmm }[];
  waterGoal: number;                 // glasses, default 8
  screenTimeEnabled: boolean;
  stepsAvailable: boolean;           // permission granted and source works
}

export interface DogProfile {
  id: string;
  name: string;
  breed: Breed;
  adoptedAt: ISO;
  adoptedAsSenior: boolean;          // senior is chosen at adoption, never reached by aging
  bondPoints: number;                // never decreases
  goodDaysTotal: number;             // never decreases
  walksTotal: number;                // never decreases
  tricks: TrickId[];
}

export interface WalkEvent { start: ISO; end: ISO; steps: number; source: 'detected' | 'manual' }

export interface TodayData {
  day: DayKey;
  dayStart: ISO;                     // today's wake time (UTC)
  dayEnd: ISO;                       // next wake time (UTC)
  stepBuckets: number[];             // 10-minute buckets from dayStart to now
  walks: WalkEvent[];
  water: number;
  waterLastAt?: ISO;
  screenRung: ScreenRung;            // after early-fire guard
  screenAckRung: ScreenRung;         // highest rung the user already acknowledged in-app
  moodToday?: 1 | 2 | 3 | 4 | 5;
  petsToday: number;
}

export interface DaySummary {
  day: DayKey; steps: number; walks: number; water: number;
  screenRungMax: ScreenRung; moodCheckin: boolean; goodDay: boolean; finalized: boolean;
}

export interface NudgeLedger {
  day: DayKey; sentCount: number; lastSentAt?: ISO;
  sentTypes: NudgeType[]; openedCount: number; ignoredStreakDays: number;
}

export interface EngineInput {
  now: ISO;
  prefs: Prefs;
  dog: DogProfile;
  today: TodayData;
  history: DaySummary[];             // most recent first, up to 14 days
  ledger: NudgeLedger;
  lastOpenedAt?: ISO;
  lastPlayBowAt?: ISO;
}

export interface DogState {
  pose: Pose;
  request: Request;
  greeting: Greeting;
  energy: number;                    // 0–100
  contentment: number;               // 20–100 (floor 20: the dog is never miserable)
  bond: number;                      // 0–100
  lifeStage: LifeStage;
  bowlLevel: number;                 // 0–1
  isAsleep: boolean;
  baselineLearning: boolean;
}

export interface PlannedNudge { type: NudgeType; at: ISO; copyKey: string; deepLink: string }

export interface EngineOutput {
  state: DogState;
  render: RenderProps;               // see ARCHITECTURE §7
  lineKey: string;                   // copy key for the speech/caption line
  nudgePlan: PlannedNudge[];         // nudges allowed from now until day end
  unlockedTricks: TrickId[];         // newly unlocked by this computation
  a11yLabelKey: string;
}
```

Entry point: `computeDog(input: EngineInput): EngineOutput`. Day finalization is a separate
pure function: `finalizeDay(summary, dog, ledger) → { summary, dog, ledger }`, called lazily
on app open for every unfinalized past day (idempotent).

## 3. Time model

- A user "day" runs from today's wake time to the next wake time, in the user's timezone.
  Night-shift example: wake 15:00, bed 07:00 → day `2026-10-02` = 15:00 Oct 2 to 15:00 Oct 3.
- Waking window = wakeTime → bedTime (crossing midnight allowed).
- `wakingFraction(now)` = elapsed waking time / waking duration, clamped 0–1.
- Weekend schedule applies when the day's start falls on Saturday/Sunday local time and
  weekend times are set.
- Never use the device clock inside the engine. `now` comes from input.

## 4. Activity curve (energy)

```
peak1 = wakeTime + 15 min          (default 07:15)
peak2 = bedTime − 4 h              (default 19:00)
senior: both peaks 1 h earlier
energy(t) = BASE + HEIGHT × stageScale × (g(t, peak1) + g(t, peak2)), clamped 0–100
g(t, p) = exp(−(hoursBetween(t, p))² / (2 × SIGMA²))
BASE = 20, HEIGHT = 70, SIGMA = 1.5 h
stageScale: puppy 1.3, young 1.15, adult 1.0, senior 0.75
asleep (bedTime → wakeTime): energy = 5
```

## 5. Steps, baseline, targets, walks

- `baselineSteps` = median of the last 7 finalized days with steps > 0. Fewer than 3 such
  days → baseline learning mode; target = 5,000.
- `dailyTarget` = round(baseline × 1.10 / 100) × 100, clamped 3,000–12,000, and at most 5%
  above last week's target (slow ramp).
- `baselineLearning` = fewer than 7 days since adoption. In learning mode, step-based
  requests show in-app but never as push nudges.
- **Walk detection:** any rolling 20-minute window (two consecutive 10-minute buckets) with
  ≥ 1,000 steps, not overlapping an existing walk. Manual walks count if ≥ 5 minutes.
- `stepsLast60` = sum of the last six buckets.

## 6. Requests

Evaluate all; return the highest priority:
`bedtime > bored > ball > leash > playBow > water > none`. While asleep, request = none.

### 6.1 Leash
Default `walkCheckTime` = wakeTime + 0.45 × waking duration, rounded down to 30 min
(07:00–23:00 → 14:00; 15:00–07:00 → 22:00).
Request when ALL hold:
- stepsAvailable, now ≥ walkCheckTime, and now ≤ bedTime − 60 min
- stepsToday < 0.6 × dailyTarget × wakingFraction(now)
- no walk ended in the last 3 h
Clears immediately when a walk is detected or a manual walk ends.

### 6.2 Play bow (sitting break)
Request when ALL hold:
- stepsAvailable, awake, now ≥ wakeTime + 60 min, not in quiet hours
- stepsLast60 < 50
- lastPlayBowAt is null or ≥ 90 min ago, and no walk ended in the last 90 min
Clears when stepsLast60 ≥ 150 or the user taps "Stretch with Biscuit".

### 6.3 Ball / bored (screen time)
- `ball` when screenRung ≥ 2 and screenAckRung < 2; `bored` when screenRung = 3 and
  screenAckRung < 3.
- Rung 1 (45 min) is never a request: contentment −5 and the line "ears perked up".
- Acknowledged when the user taps "Play" in-app (the dog chases a tossed ball; sets
  screenAckRung = screenRung) or when a walk is detected afterwards.

### 6.4 Water (in-app only, never a push)
- `expectedWater` = waterGoal × wakingFraction(now); `bowlLevel` = clamp(water / max(1,
  expectedWater), 0, 1).
- Request when bowlLevel < 0.5, expectedWater ≥ 2, and no water logged in the last 2 h.

### 6.5 Bedtime
- Request in [bedTime − 30 min, bedTime). After bedTime until wakeTime: isAsleep = true,
  pose = sleeping, request = none.

## 7. Pose, contentment, greeting

**Pose:** asleep → `sleeping`; any active request → `idle` (renderer shows the request);
energy ≥ 70 → `excited`; 40–69 → `sniffing`; < 40 → `resting`.

**Contentment** (start 70, clamp 20–100):
−15 per active request among leash/ball/playBow, −20 for bored (do not stack beyond −25
total), −5 at rung 1; +10 if a walk ended in the last 2 h; +5 per pet today (max +15);
+5 if water ≥ goal; +5 after a mood check-in today.

**Greeting** (`greetingFor(lastOpenedAt, now, isAsleep)`):
asleep → none (sleepy tail thump); away < 30 min → none; 30–119 min → small;
≥ 120 min → big. Capped at big; no different reaction for longer absences.

## 8. Bond, tail and growth

**Bond points** (never subtract):
walk +2 (max 3 walks/day count), pet +1 (max 3/day), mood check-in +1 (max 1/day),
good day +5 (at finalization), calm screen day (rungMax ≤ 1, screen time enabled) +2.
`bond` = round(100 × (1 − e^(−points / 200))).
Renderer: `bond` drives tail-wag right bias = 0.3 × bond / 100.

**Good day** (at finalization): at least 2 of the *available* criteria:
movement (target met OR ≥ 1 walk) [if stepsAvailable or any manual walk],
water ≥ 75% of goal, calm screen (rungMax ≤ 1) [if screen time enabled],
mood check-in done. If only one criterion is available, it alone suffices.

**Life stage:** adoptedAsSenior → senior always. Otherwise goodDaysTotal < 15 → puppy;
15–59 → young; ≥ 60 → adult. Never goes backwards.

**Tricks** (unlock once, celebrate with `celebrate` + `doTrick`):

| Trick | Unlocks at |
| --- | --- |
| sit | 3 good days |
| paw | 7 good days |
| spin | 14 good days |
| fetch | 10 walks |
| rollOver | 30 good days |
| highFive | 45 good days |
| bow | 60 good days |
| dance | 100 good days |

## 9. Nudge scheduler

`planNudges(input, state) → PlannedNudge[]` (pure). Side effects live in
`NotificationService`.

- Candidate types: leash (§6.1), playBow (§6.2), ball (rung 2), bored (rung 3), bedtime
  (bedTime − 30 min). Water is never pushed. Rung 1 is never pushed.
- Budget = prefs.nudgesPerDay − (ledger.ignoredStreakDays ≥ 3 ? 1 : 0), min 0.
- Drop a candidate if: sentCount ≥ budget; < 120 min since lastSentAt; inside quiet
  hours; before wakeTime + 30 min; after bedTime (except the bedtime nudge itself);
  same type already sent today; baselineLearning and type ∈ {leash, playBow}.
- Priority when several compete for one slot: bedtime > bored > ball > leash > playBow.
- "Ignored" = not opened within 60 min. At finalization: if sentCount > 0 and
  openedCount = 0 → ignoredStreakDays + 1, else reset to 0. When it reaches 3, the app
  shows an in-app question: "Should I check in less often?"
- Deep links: leash → `dogyears://walk`, playBow → `dogyears://home?stretch=1`,
  ball/bored → `dogyears://home?play=1`, bedtime → `dogyears://home`.
- Background producers (iOS monitor extension, Android worker, HealthKit observer) apply
  the same budget checks using the shared ledger before posting.

## 10. Copy selection

`lineKey` = `${request}.${variant}` or `${pose}.${variant}` with
`variant = hash(day + request) % variantsCount` (deterministic, no randomness). Examples
(English, `src/copy/en.ts`; `{name}` = dog name):

| Key | Line |
| --- | --- |
| leash.0 | "{name} brought you the leash." |
| leash.1 | "{name} is sitting by the door, tail going." |
| playBow.0 | "{name} did a little play bow. Stretch?" |
| ball.0 | "{name} dropped a ball by your phone." |
| bored.0 | "{name} flopped down with a big sigh." |
| water.0 | "{name}'s bowl is getting low. Drink together?" |
| bedtime.0 | "{name} is yawning and heading to bed." |
| sleeping.0 | "Shh. {name} is asleep." |
| greetBig.0 | "You're back!" |
| headRest.0 | "{name} came over and rested their head on you." |
| rung1.0 | "{name}'s ears perked up." |

All lines must pass PRD §7 copy rules (test enforced).

## 11. Render mapping

`renderProps(state, dog, now, reduceMotion)` → ARCHITECTURE §7 names: breed index,
lifeStage index, energy, contentment, bond, pose index, request index, timeOfDay (local
hours as decimal), reduceMotion. Triggers (greetBig, pet, drink, headRest, celebrate,
doTrick) are fired by the UI layer from `EngineOutput` diffs, not stored in state.

## 12. Test personas (`scripts/simulate.ts` and Jest)

Each persona is a fixture of prefs + 10-minute step buckets + events over 1–14 days. The
simulator steps `now` every 10 minutes and prints a timeline:
`14:00 pose=idle req=leash energy=38 cont=55 push=leash (1/3)`.

| Persona | Setup | Must be true |
| --- | --- | --- |
| desk-worker | wake 07:00, bed 23:00, baseline 5,000 (target 5,500), 800 steps by 14:00, 1,600 steps 17:30–17:50 | leash at 14:00 (expected-by-now 2,406 × 0.6 = 1,444 > 800); walk detected 17:50; leash cleared; ≤ 3 pushes |
| night-shift | wake 15:00, bed 07:00, Asia/Manila | day key starts at 15:00; walkCheckTime 22:00; asleep 07:00–15:00; no pushes 07:00–15:30 |
| scroller | normal steps; 60 min on watched apps by 13:00, 120 min by 16:00 | ball push at 13:00, bored push at 16:00, rung 1 (45 min) never pushed, ≥ 2 h between pushes |
| returning | last open 5 days ago | greeting = big; contentment ≥ 20; bond and goodDaysTotal unchanged; no "missed" copy |
| no-permissions | stepsAvailable false, screen time off | no leash/playBow requests; manual walk counts; good day with water + mood |
| quiet-hours | quiet 09:00–12:00 | zero pushes in that window even with active requests |
| new-user | adopted today | baselineLearning true; leash shown in-app, never pushed |
| ignorer | 3 days of nudges never opened | budget drops by 1 on day 4; in-app frequency question flag set |

Property tests: contentment always within 20–100; bond, goodDaysTotal, walksTotal, tricks
never decrease; pushes per day ≤ budget for random fuzzed days.

## 13. Implementation decisions (M1)

Where this spec was silent or ambiguous, the engine does the following. Tests pin each one.

- **Signatures.** `finalizeDay(summary, dog, ledger, prefs)` takes `prefs` (good-day criteria
  depend on what is available). `newDayLedger(day, previous)` starts a day and carries
  `ignoredStreakDays`. "Ignored" is judged at finalization from `openedCount`; the data layer
  counts an open only within 60 minutes of the push.
- **Extra fields.** `TodayData.screenRungAt` (when the current rung fired, so a later walk
  acknowledges it), `DaySummary.pets` and `DaySummary.stepTarget` (needed at finalization),
  `EngineInput.reduceMotion`. `EngineOutput` also returns `activeRequests`, `newWalks`,
  `stepsToday`, `stepTarget` and `askNudgeFrequency`. `RenderProps.tailRightBias` is for the
  placeholder renderer; Rive derives it from `bond`.
- **Bond timing.** Daily points are committed at finalization. Until then the bond shown adds
  today's walk/pet/check-in points on top of `dog.bondPoints`, so petting shows at once.
  `walksTotal` and `goodDaysTotal` also update at finalization.
- **Walk detection.** Overlapping qualifying windows merge into one run. A run that overlaps
  an existing walk is the same walk, so a walk still in progress is not logged twice; its
  stored end/steps are what was known when it was first detected.
- **Step target ramp.** "Last week's target" = the target computed from history entries 8–14.
  If those have no baseline (fewer than 3 days), no ramp cap applies.
- **Play bow.** `lastPlayBowAt` = when the user last answered a play bow ("Stretch"). The
  sitting spell is replayed over the day's buckets with hysteresis: starts below 50 steps in
  the last hour, ends at 150 or when answered; a new spell needs 90 minutes after an answer.
- **Water bowl.** `bowlLevel = clamp((water + 1) / (expected + 1), 0, 1)` instead of
  `water / max(1, expected)`: the plain formula shows an empty bowl the moment the user wakes
  up, which reads as neglect. The request thresholds (< 0.5, ≥ 2 expected, 2 h since last
  glass) are unchanged.
- **Line priority.** asleep → `sleeping`; greeting big/small → `greetBig`/`greetSmall`;
  request → request; low mood today → `headRest`; rung 1 → `rung1`; else the pose.
  Push copy keys are `push.${type}.${variant}`; counts live in `PUSH_VARIANTS`.
- **Nudge planning.** The plan contains requests active now plus two foreseeable ones:
  bedtime (bedTime − 30 min) and the leash at walk-check time if the user would still be
  behind with no more steps (cancelled by a later recompute if they walk). Types are placed
  in priority order; a nudge blocked by spacing, quiet hours or wake + 30 min may wait, up to:
  leash → bedTime − 60 min, ball/bored → 3 h, playBow → 30 min, bedtime → bedTime.
- **Simulator.** `src/engine/sim/` holds the personas and a pure `simulate()`; it delivers a
  planned nudge when it falls before the next 10-minute tick and treats every tick as an
  open (greetings only show on the first tick, from `lastOpenedDaysAgo`).
