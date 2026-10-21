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

## Next

1. **M3 — app shell with mock services:** service interfaces + mocks (personas from
   `src/engine/sim/personas.ts` can drive them and the dev menu), then onboarding and the
   home scene. Call `migrate(openDb())` at startup and `recompute(db, now, runtime,
   { opened: true })` on `AppState` → active.

## Notes

- Install packages with `npx expo install <pkg>` (add `-- --save-dev` for dev deps). npm
  peer resolution once pulled `react-dom@19.3`; it is pinned to match `react` (19.2.3).
- SDK 57: the splash screen is configured via the `expo-splash-screen` plugin, not `splash`.
- Only `*.test.ts(x)` files are tests, so helpers can live in `__tests__/`.
- Cloud sessions: api.expo.dev and docs sites are blocked by the network policy. Use
  `EXPO_OFFLINE=1 npx expo install <pkg>` (reads versions from the installed SDK) and read
  docs from GitHub sources.
