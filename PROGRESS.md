# Dog Years — Progress

Read this at the start of each session. The build plan and checkboxes live in
`docs/MILESTONES.md`; this file is the short status and what to do next.

## Status (2026-10-21)

**M0 — code tasks done.** Expo SDK 57 (React Native 0.86, React 19.2, TypeScript 6),
Expo Router with routes in `app/` (placeholder screens), path aliases (`@/engine`, `@/copy`, …),
ESLint 9 flat config + Prettier, Jest (`jest-expo`) + React Native Testing Library,
`app.config.ts` (scheme `dogyears`, bundle/package `app.dogyears`, env vars from
ARCHITECTURE §8), `eas.json` (development, development-simulator, preview, production),
GitHub Actions CI, folder skeleton from ARCHITECTURE §3. `expo-doctor` passes 21/21.
- Not verified: a development build in the iOS simulator / Android emulator (this machine is
  Windows without Android Studio or Xcode). Run `npx expo run:android` once Android Studio
  is installed, or `eas build --profile development-simulator --platform ios`.
- **[HUMAN] M0 tasks still open:** Apple Developer + Play Console accounts, bundle ID and
  App Group, Family Controls (Distribution) requests (do these first: approval takes weeks),
  Xcode/Android Studio/EAS CLI, test phones.

**M1 — dog engine done.** Pure TypeScript in `src/engine/` covering every rule in
DOG_ENGINE.md §3–§11, with `computeDog()` and `finalizeDay()` as entry points.
- 307 tests pass; engine coverage is about 99.7%. The tests cover every §12 persona row,
  plus 40 fuzzed personas checking the properties (contentment 20–100, totals never
  decrease, pushes ≤ budget, spacing, no pushes in quiet hours or after bedtime).
- The lint guard blocks `src/engine/**` from importing React, React Native, Expo, Drizzle,
  `@/data` or `@/services`, and from calling `new Date()`, `Date.now()` or `Math.random()`
  (verified with a probe file).
- `npm run simulate -- --persona=<id|all> [--days=N] [--all]` prints timelines.
- Decisions where the spec was silent are recorded in DOG_ENGINE.md §13. The one numeric
  change is the bowl formula, `(water + 1) / (expected + 1)`, so the bowl is full at wake time.
- Copy (`src/copy/en.ts`, an M3 task) was pulled forward because the engine's copy keys
  depend on it. The copy-rules test enforces banned words, push bodies ≤ 60 characters, and
  that the keys match the engine.

**M2 — local data layer done.** `src/data/`: Drizzle schema + first migration
(`src/data/migrations/`), six repos, `buildEngineInput()`, `finalizePastDays()` (lazy,
idempotent), `recompute()` (what the app runs on every foreground) and `deleteAllData()`.
- Tests run the app's real migration bundle on an in-memory `better-sqlite3`
  (`src/data/__tests__/testDb.ts`); both drivers are synchronous Drizzle SQLite, so repos
  are plain sync functions. 333 tests pass.
- Decisions not in the spec are in ARCHITECTURE §5 "As built (M2)": new event types
  `ball_played` and `play_bow_answered`, the early-fire guard applied in the assembler,
  walks the app never saw detected at finalization, backfill capped at 60 days.
- Added `babel.config.js` (inline `.sql` imports) and `metro.config.js` (`sql` source ext)
  as Drizzle's Expo driver needs. Not yet run in a dev build (`openDb()` in
  `src/data/openDb.ts` is the only code that touches `expo-sqlite`).

**M3 — app shell done (code).** Every screen is built on mock services:
- `src/services/*`: Health, ScreenTime, Notifications, Purchases interfaces + mocks driven
  by the engine personas; `useEntitlement('premium')` is the only Premium check.
- `src/components/AppProvider.tsx` opens + migrates the DB, recomputes on `AppState` →
  active and when the dev clock moves; `src/features/dog/refresh.ts` is the pipeline.
- Screens: onboarding (welcome, adopt, name, schedule, permission primers), Home
  (`PlaceholderDog` with RenderProps, room light by local time, bowl, request action,
  4 quick actions, goodnight after bedtime, greeting/pet/celebrate bounces, back-off
  question), Walk (manual, resumes after app kill), Check-in + 1-minute breathing,
  Support (`src/config/supportResources.ts`), Progress (no streaks), Settings, Your data
  (delete all), Paywall (mock), dev menu (persona + clock).
- 470 tests pass, including screen tests for PRD F1–F4, F8–F10, F13 acceptance criteria.
  `expo export` bundles both platforms. **Not verified on a simulator/device**: the DoD
  "usable in simulators for every persona" needs a dev build (human, or a machine with
  Xcode / Android Studio).
- **[HUMAN] before launch:** call and confirm every number in
  `src/config/supportResources.ts` (all marked `verifyBeforeLaunch`).
- Settings quiet hours is a single "quiet at lunch" preset for now (shortcut).

**M5 — notifications (code) done; shared ledger mirror waits for M6/M7.** Real
`expo-notifications` service in app builds (other services stay mocked), response handling
with opened tracking and action buttons, `dogyears://home` route. A test runs every persona
through the real pipeline every 30 minutes and proves pushes never exceed the budget.
**[HUMAN]** confirm delivery, action buttons and deep links on both devices.

## Next

1. M4 (steps): HealthKit + Health Connect implementations of `HealthService`; needs the
   libraries' READMEs and physical devices to finish.
2. M6/M7: Screen Time (needs the Apple entitlement) and the Android usage-stats module
   (Kotlin), plus the shared nudge ledger mirror for their background producers.
3. M8 needs the `.riv` file; M9 needs RevenueCat products and keys (human).
4. M10 drafts: usage-description strings, privacy policy, store privacy answers.

## Notes

- Install packages with `npx expo install <pkg>` (add `-- --save-dev` for dev deps). npm
  peer resolution once pulled `react-dom@19.3`; it is pinned to match `react` (19.2.3).
- SDK 57: the splash screen is configured via the `expo-splash-screen` plugin, not `splash`.
- Only `*.test.ts(x)` files are tests, so helpers can live in `__tests__/`.
- RNTL 14: `render`, `fireEvent.*` are async; always `await` them (an un-awaited press
  leaves an act() scope open and later tests stop re-rendering).
- Cloud sessions: api.expo.dev and docs sites are blocked by the network policy. Use
  `EXPO_OFFLINE=1 npx expo install <pkg>` (reads versions from the installed SDK) and read
  docs from GitHub sources.
