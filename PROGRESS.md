# Dog Years — Progress

Read this at the start of each session. The build plan and checkboxes live in
`docs/MILESTONES.md`; this file is the short status and what to do next.

## Status (2026-10-02)

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

## Next

1. **M2 — local data layer:** `expo-sqlite` + Drizzle schema (ARCHITECTURE §5), the repos,
   `buildEngineInput(now)`, lazy idempotent finalization on open, and delete-all. The
   engine's needs are in DOG_ENGINE §13: summaries must store `pets` and `stepTarget`, and
   `screenRungAt` must be tracked.
2. M3 — app shell with mock services (personas from `src/engine/sim/personas.ts` can drive
   the mocks and the dev menu).

## Notes

- Install packages with `npx expo install <pkg>` (add `-- --save-dev` for dev deps). npm
  peer resolution once pulled `react-dom@19.3`; it is pinned to match `react` (19.2.3).
- SDK 57: the splash screen is configured via the `expo-splash-screen` plugin, not `splash`.
- Only `*.test.ts(x)` files are tests, so helpers can live in `__tests__/`.
