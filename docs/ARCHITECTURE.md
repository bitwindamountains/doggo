# Dog Years — Architecture

## 1. Big picture

```
 ┌──────────────────────── Phone ─────────────────────────────────────────┐
 │                                                                        │
 │  Platform sources              Event log (SQLite)        Dog engine    │
 │  ─────────────────             ──────────────────        (pure TS)     │
 │  HealthKit / Health Connect ─┐                                         │
 │  Screen Time ext. / Usage ───┼──► events + daily rows ──► computeDog() │
 │  User actions (water, mood) ─┘          ▲                     │        │
 │                                         │                     ▼        │
 │  Background workers ────────────────────┘          DogState + request  │
 │  (HK observer, iOS monitor ext.,                         │       │     │
 │   Android WorkManager)                                   ▼       ▼     │
 │         │                                      DogRenderer   NudgeSched│
 │         └──► local notifications ◄──────────────────────────────┘      │
 │                                                                        │
 └──────────────────────────────┬─────────────────────────────────────────┘
                                │ daily aggregates only (later milestone)
                                ▼
                        Supabase (auth, Postgres + RLS)
```

The engine is the product. Everything else feeds it data or draws its output.

## 2. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | React Native + Expo, latest stable SDK, New Architecture | Dev client + EAS Build. Not Expo Go. |
| Language | TypeScript strict | |
| Navigation | Expo Router | File-based routes in `app/` |
| State | Zustand | UI state only; source of truth is SQLite |
| Local DB | `expo-sqlite` + Drizzle ORM | Migrations in `src/data/migrations` |
| iOS Screen Time | `react-native-device-activity` | Config plugin creates monitor + shield extensions |
| Android usage | Local Expo module `modules/android-usage-stats` (Kotlin) | `UsageStatsManager.queryEvents` + WorkManager |
| iOS steps | `@kingstinct/react-native-healthkit` (verify current) | Statistics queries + observer + background delivery |
| Android steps | `react-native-health-connect` (verify current) + Recording API fallback | Health Connect on Android 14+; Recording API for older |
| Animation | `@rive-app/react-native` (pin exact version) | Behind `DogRenderer` |
| Notifications | `expo-notifications` | Local notifications; categories with action buttons |
| Background (Android) | WorkManager via the local Expo module | 15-minute periodic minimum |
| Payments | `react-native-purchases` (RevenueCat) | One entitlement: `premium` |
| Backend | Supabase | Later milestone; optional account |
| Analytics | PostHog (or none in MVP) | Only coarse, non-sensitive events |
| Tests | Jest, React Native Testing Library | Engine coverage ≥ 90% |

Minimum OS: iOS 16.0 (Screen Time self-monitoring with individual authorization requires
iOS 16). Android: Expo SDK default minSdk; Health Connect on-device steps need Android 14+,
older devices use the Recording API.

## 3. Folder structure

```
dog-years/
├─ CLAUDE.md
├─ docs/                         PRD, ARCHITECTURE, DOG_ENGINE, MILESTONES
├─ app/                          Expo Router routes
│  ├─ _layout.tsx
│  ├─ (onboarding)/              welcome, adopt, name, schedule, permissions
│  ├─ (tabs)/
│  │  ├─ index.tsx               Home scene
│  │  ├─ progress.tsx
│  │  └─ settings.tsx
│  ├─ walk.tsx                   Active walk screen
│  ├─ checkin.tsx                Mood check-in + breathing
│  ├─ support.tsx                Support resources
│  └─ paywall.tsx
├─ src/
│  ├─ engine/                    PURE TypeScript. No RN/Expo imports.
│  │  ├─ types.ts
│  │  ├─ time.ts                 day boundaries, waking-day fraction (tz-aware)
│  │  ├─ activityCurve.ts
│  │  ├─ targets.ts              baseline + step targets
│  │  ├─ walks.ts                walk detection
│  │  ├─ requests.ts             leash, playBow, ball, bored, water, bedtime
│  │  ├─ greetings.ts
│  │  ├─ bond.ts
│  │  ├─ growth.ts               life stage + tricks
│  │  ├─ goodDay.ts
│  │  ├─ nudges.ts               nudge scheduler (pure planning)
│  │  ├─ renderProps.ts          DogState → renderer properties
│  │  ├─ computeDog.ts           single entry point
│  │  └─ __tests__/
│  ├─ data/
│  │  ├─ db.ts                   expo-sqlite + drizzle setup
│  │  ├─ schema.ts               tables (section 5)
│  │  ├─ migrations/
│  │  └─ repos/                  eventsRepo, dayRepo, dogRepo, prefsRepo
│  ├─ services/
│  │  ├─ health/                 HealthService interface + ios/android/mock
│  │  ├─ screentime/             ScreenTimeService interface + ios/android/mock
│  │  ├─ notifications/          NotificationService + scheduler glue
│  │  ├─ purchases/              PurchaseService (RevenueCat) + mock
│  │  └─ sync/                   Supabase (later)
│  ├─ features/                  dog/, home/, onboarding/, progress/, settings/, checkin/
│  ├─ components/
│  ├─ copy/                      en.ts, fil.ts (native speaker), copyRules.test.ts
│  ├─ config/                    remote-config defaults (support resources etc.)
│  └─ store/                     Zustand stores
├─ modules/
│  └─ android-usage-stats/       Expo module (Kotlin): usage, app list, WorkManager worker
├─ assets/
│  ├─ rive/dog.riv               delivered by the animator (placeholder until then)
│  └─ images/
├─ scripts/
│  └─ simulate.ts                runs the engine over persona days and prints a timeline
├─ supabase/
│  └─ migrations/                SQL (section 6)
└─ app.config.ts
```

## 4. Platform integrations

### 4.1 Service interfaces

```ts
// src/services/health/HealthService.ts
export interface HealthService {
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<'granted' | 'denied' | 'partial'>;
  getStepsBetween(startISO: string, endISO: string): Promise<number>;
  getStepBuckets(startISO: string, endISO: string, bucketMinutes: 10): Promise<number[]>;
  enableBackgroundUpdates(onUpdate: () => Promise<void>): Promise<void>;
}

// src/services/screentime/ScreenTimeService.ts
export type ScreenRung = 0 | 1 | 2 | 3; // 0 none, 1 = 45 min, 2 = 60 min, 3 = 120 min
export interface ScreenTimeService {
  isSupported(): boolean;
  getAuthorizationStatus(): Promise<'authorized' | 'denied' | 'notDetermined'>;
  requestAuthorization(): Promise<boolean>;
  presentAppPicker(groupId: string): Promise<{ count: number }>; // never returns app names to JS on iOS
  startDailyMonitoring(groupId: string, dayStartHHmm: string): Promise<void>;
  stopMonitoring(groupId: string): Promise<void>;
  // As built (M3): returns the rung with its fire time, so the early-fire guard can run.
  getRungsReachedToday(dayStartISO: string): Promise<{ rung: ScreenRung; firedAt: string } | null>;
}

// src/services/notifications/NotificationService.ts (as built, M3)
export interface NotificationService {
  requestPermissions(): Promise<boolean>;
  replaceSchedule(nudges: ScheduledNudge[]): Promise<void>; // cancel all, schedule these
}

// src/services/purchases/PurchaseService.ts (as built, M3); checked only via useEntitlement()
export interface PurchaseService {
  getEntitlements(): Promise<{ premium: boolean }>;
  purchase(productId: 'monthly' | 'annual'): Promise<boolean>;
  restore(): Promise<{ premium: boolean }>;
}
```

`src/services/index.ts` builds the service set. Until M4–M9 every build uses the mocks,
driven by the dev persona and dev clock (`src/store/dev.ts`, Settings → Developer in
`__DEV__` builds). `src/features/dog/refresh.ts` is the foreground pipeline: read steps
(yesterday + today) and the screen-time rung into SQLite, count scheduled nudges whose time
has passed as sent (`nudge_scheduled` → `nudge_sent` events, so the ledger stays right
even though local notifications fire while the app is closed), `recompute()`, then
replace the notification schedule with the engine's plan.

Each has `ios`, `android` and `mock` implementations. The mock reads persona data so the
whole app runs in a simulator.

### 4.2 iOS Screen Time (react-native-device-activity)

- Requires the Family Controls entitlement. Development works locally; **Distribution
  requires Apple approval per bundle ID**: main app, DeviceActivityMonitor extension,
  ShieldConfiguration extension, ShieldAction extension (shield ones only needed in v1.1).
  The human submits these in milestone M0.
- Configure in `app.config.ts`:
  ```ts
  plugins: [
    ['expo-build-properties', { ios: { deploymentTarget: '16.0' } }],
    ['react-native-device-activity', { appleTeamId: process.env.APPLE_TEAM_ID, appGroup: 'group.app.dogyears.shared' }],
  ]
  ```
- Authorization: individual (the user's own device).
- App selection: Apple's picker returns opaque tokens. Store the selection in the library's
  shared storage keyed by `groupId`. JS never sees app names.
- Monitoring: one daily schedule from the user's day start to day end, repeating, with
  events `rung1` (45 min), `rung2` (60 min), `rung3` (120 min) on the selected tokens.
- On `eventDidReachThreshold` (inside the monitor extension, configured through the
  library): write `{rung, firedAt}` to App Group storage and, for rungs 2 and 3, post a
  local notification **only if** the shared nudge ledger says budget remains (the extension
  reads `nudgeLedger` from App Group storage; keep logic tiny — the extension has a ~5 MB
  memory limit).
- **Early-fire guard:** developers report thresholds firing too early on iOS 26.x. When the
  main app reads a rung, ignore it if `firedAt - dayStart < thresholdMinutes`. Log ignored
  events for diagnostics.
- v1.1 shield: shield buttons can only close/defer; they cannot open the main app. "Walk"
  closes the shielded app and posts a notification that deep-links to `dogyears://walk`.

### 4.3 Android usage stats (local Expo module)

Create with `npx create-expo-module@latest --local android-usage-stats`. Kotlin API:

```kotlin
// exposed to JS
fun hasUsageAccess(): Boolean
fun openUsageAccessSettings()
fun listLauncherApps(): List<Map<String, Any>>   // packageName, label, iconBase64 (small)
fun getForegroundMinutes(packages: List<String>, startMs: Long, endMs: Long): Double
fun scheduleUsageWorker(packages: List<String>, dayStartHHmm: String)
fun cancelUsageWorker()
fun getRungsReachedToday(): Int
```

- Manifest (via the module's config plugin): `PACKAGE_USAGE_STATS` (user grants in
  Settings → Usage access), `POST_NOTIFICATIONS`, and a `<queries>` block with
  `MAIN`/`LAUNCHER` intent so launcher apps are visible on Android 11+ without
  `QUERY_ALL_PACKAGES`.
- Compute foreground time from `queryEvents` (ACTIVITY_RESUMED / ACTIVITY_PAUSED pairs),
  not `queryUsageStats` daily buckets, which are reported as inaccurate.
- Worker: WorkManager periodic (15 min). Computes minutes on watched packages since day
  start, writes the highest rung to SharedPreferences, posts a local notification for
  rungs 2–3 if the nudge ledger allows. Package names stay on device.
- Budget phones (Xiaomi, Oppo, Vivo, realme, Samsung) may kill background work. Onboarding
  includes a "Keep Biscuit awake" step that links to battery-optimization settings, and the
  app always recomputes on open.
- v1.1 launch intercept uses an AccessibilityService and needs a Play Console declaration
  plus prominent in-app disclosure. Do not add it in MVP.

### 4.4 Steps

- iOS: HealthKit read permission for `stepCount` only. Use statistics collection queries for
  totals and 10-minute buckets. Register an observer query + background delivery (`hourly` is the iOS
  maximum for steps; actual delivery may be later). On wake: compute rules, maybe schedule
  one local notification, exit. HealthKit adds App Store review scrutiny: the usage
  description string must be specific.
- Android: Health Connect `READ_STEPS` (+ background read permission, optional). On
  Android 14+, Health Connect counts phone steps once any app holds `READ_STEPS`. Since the
  June 2026 Health Connect update, on-device steps use a device-specific synthetic package
  name: when filtering by data origin, include both `android` and the current device source,
  or do not filter by origin. For Android 13 and lower use the Recording API on mobile.
- Sedentary and walk detection use 10-minute step buckets only (no extra motion permission
  in MVP). Health Connect: aggregate grouped by a 10-minute duration.

### 4.5 Notifications

- Categories: `leash` (actions: "Let's walk" → `dogyears://walk`, "Later"), `ball`
  ("Put phone down"), `bedtime` ("Goodnight"), `generic`.
- All scheduling goes through `NudgeScheduler` (engine, pure) → `NotificationService`
  (side effects). Background producers (iOS extension, Android worker, HealthKit observer)
  consult the shared **nudge ledger** (App Group storage on iOS, SharedPreferences on
  Android, mirrored to SQLite on open) to respect the daily budget.

## 5. Local data model (SQLite via Drizzle)

All timestamps UTC ISO strings. `day` = user-local date string `YYYY-MM-DD` computed with
the user's timezone and wake time (a night-shift "day" starts at wake time, not midnight).

```ts
// src/data/schema.ts (sketch)
dog          { id TEXT PK, name, breed, adoptedAt, bondPoints INT, goodDaysTotal INT,
               walksTotal INT, tricks TEXT(json), cosmetics TEXT(json), updatedAt }
prefs        { id=1, timezone, wakeTime 'HH:mm', bedTime 'HH:mm', nudgesPerDay INT(0-3),
               walkCheckTime 'HH:mm', waterGoal INT, quietHours TEXT(json),
               screenTimeEnabled INT, locale, onboardedAt }
event        { id INTEGER PK, at, type, payload TEXT(json) }
               -- types: water_logged, walk_started, walk_ended, walk_detected, pet,
               --        mood_checkin, screen_rung, nudge_sent, nudge_opened, app_opened,
               --        trick_learned, bedtime_kept
day_summary  { day TEXT PK, steps INT, walks INT, water INT, screenRungMax INT,
               bedtimeKept INT NULL, moodMin INT NULL, goodDay INT, finalized INT }
step_cache   { day TEXT, bucket INT, steps INT, PK(day,bucket) }   -- 10-minute buckets from day start
nudge_ledger { day TEXT PK, sentCount INT, lastSentAt, ignoredStreakDays INT }
```

Mood values and notes live only in `event` locally. Delete-all clears every table.

**As built (M2).** The schema is `src/data/schema.ts`; migrations live in
`src/data/migrations/` (`npx drizzle-kit generate` after a schema change). Columns are
snake_case in SQL. Additions to the sketch above:

- `dog.adoptedAsSenior`; `prefs.weekendWakeTime`, `prefs.weekendBedTime` (DOG_ENGINE §2).
  `stepsAvailable` is not stored: it is runtime state from `HealthService`.
- `day_summary.pets` and `day_summary.stepTarget` (DOG_ENGINE §13); `moodCheckin` is
  `moodMin IS NOT NULL`.
- `nudge_ledger.sentTypes` (JSON) and `openedCount`. An open counts only within 60 minutes
  of the last push.
- Event types `ball_played {rung}` (user tapped "Play": acknowledges the rung) and
  `play_bow_answered` (user tapped "Stretch"). Payloads are typed in `src/data/events.ts`.
  `walk_detected` events are stored at the walk's end; `walk_ended {start, steps}` is a
  manual walk ending at the event's time.
- Days are found by time range (`dayWindow`), not stored on events, so events stay valid
  if the user's wake time changes.

`buildEngineInput(db, now, runtime)` is the only bridge to the engine. It applies the
early-fire guard to `screen_rung` events and uses the latest mood check-in of the day as
`moodToday` (the summary keeps the lowest as `moodMin`). `recompute()` runs on every
foreground: it finalizes past days, computes, stores newly detected walks and records the
`app_opened` event after computing, so the greeting sees the previous open.
`finalizePastDays()` is idempotent, commits each day in one transaction, detects walks the
app never saw from that day's step buckets, and backfills at most 60 days.

## 6. Server data model (Supabase, later milestone)

Only aggregates sync. No app identifiers, raw steps, location or mood notes.

```sql
-- supabase/migrations/0001_init.sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Asia/Manila',
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.dogs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  breed text not null,
  adopted_at timestamptz not null,
  bond_points integer not null default 0 check (bond_points >= 0),
  good_days_total integer not null default 0 check (good_days_total >= 0),
  walks_total integer not null default 0 check (walks_total >= 0),
  tricks text[] not null default '{}',
  cosmetics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index dogs_owner_id_idx on public.dogs (owner_id);

create table public.daily_summaries (
  dog_id bigint not null references public.dogs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  walks smallint not null default 0 check (walks >= 0),
  water smallint not null default 0 check (water >= 0),
  screen_rung_max smallint not null default 0 check (screen_rung_max between 0 and 3),
  bedtime_kept boolean,
  good_day boolean not null default false,
  primary key (dog_id, day)
);
create index daily_summaries_owner_id_idx on public.daily_summaries (owner_id);

alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.daily_summaries enable row level security;

create policy profiles_own on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy dogs_own on public.dogs
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy daily_summaries_own on public.daily_summaries
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
```

Notes: wrap `auth.uid()` in `select` so it is evaluated once per query; every policy
column is indexed; steps are deliberately not synced. Add RLS tests (two users cannot read
each other's rows) before shipping sync.

## 7. Rive contract (art ↔ code)

The animator builds `assets/rive/dog.riv`. Code talks to it only through
`src/features/dog/DogRenderer.tsx`, which maps `RenderProps` (from `engine/renderProps.ts`)
to Rive. Prefer Rive data binding (view model properties); legacy state machine inputs
with the same names are acceptable. **Names are a contract; changing them is a breaking
change.**

| Name | Type | Values / meaning |
| --- | --- | --- |
| Artboard `Dog`, state machine `DogSM`, view model `DogVM` | — | — |
| `breed` | number | 0 aspin, 1 shiba-style, 2 golden-style, 3 corgi-style |
| `lifeStage` | number | 0 puppy, 1 young, 2 adult, 3 senior |
| `energy` | number 0–100 | drives idle liveliness |
| `contentment` | number 0–100 | drives ears/tail baseline |
| `bond` | number 0–100 | tail-wag right bias grows with bond |
| `pose` | number | 0 sleeping, 1 resting, 2 idle, 3 sniffing, 4 excited |
| `request` | number | 0 none, 1 leash, 2 playBow, 3 ball, 4 bored, 5 water, 6 bedtime |
| `timeOfDay` | number 0–24 | room lighting |
| `reduceMotion` | boolean | shorter, calmer transitions |
| `greetSmall`, `greetBig`, `pet`, `drink`, `headRest`, `celebrate` | trigger | one-shot reactions |
| `trickId` + `doTrick` | number + trigger | 1 sit, 2 paw, 3 spin, 4 rollOver, 5 highFive, 6 bow, 7 fetch, 8 dance |

Art rules: inner-brow raise is the "asking" face; never tears, injuries or thin bodies.
Until the `.riv` arrives, `PlaceholderDog` (react-native-svg shapes + a text label of the
pose/request) implements the same `RenderProps`.

## 8. Configuration and secrets

`app.config.ts` reads from EAS secrets / `.env` (never committed):
`APPLE_TEAM_ID`, `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `POSTHOG_KEY` (optional). Bundle ID / package: `app.dogyears`
(placeholder until the name is final).

## 9. Testing strategy

- Engine: table-driven unit tests per rule + persona day simulations with snapshot
  timelines (`DOG_ENGINE.md §Test personas`).
- Copy: test that scans `src/copy/*.ts` for banned words (PRD §7).
- Services: mocks in tests; contract tests for the Android module's minute calculation
  using recorded event fixtures.
- Device checklist (human): physical iPhone (iOS 16+ and latest), physical budget Android
  (Android 11–14), notifications, background behavior after 24 h, battery saver on.
