# Dog Years — Build Milestones

Work top to bottom. Each milestone ends with a Definition of Done (DoD). Tasks marked
**[HUMAN]** need the project owner (accounts, approvals, physical devices); Claude Code
should stop and ask when it reaches one that blocks progress.

Workflow per task: read the referenced doc sections → propose a short plan → write tests
(engine first) → implement → run `npm run typecheck && npm test` → tick the box → commit
with a message like `M1: walk detection (DOG_ENGINE §5)`.

---

## M0 — Accounts and project setup

- [ ] **[HUMAN]** Join the Apple Developer Program and create a Google Play Console account.
- [ ] **[HUMAN]** Pick the bundle ID (placeholder `app.dogyears`), create the App ID, and an
      App Group `group.app.dogyears.shared`.
- [ ] **[HUMAN]** Submit Family Controls (Distribution) requests for: main app,
      DeviceActivityMonitor extension (MVP); ShieldConfiguration + ShieldAction extensions
      (v1.1). Do this on day 1; approval can take weeks.
- [ ] **[HUMAN]** Install Xcode, Android Studio, EAS CLI; have one physical iPhone and one
      budget Android phone (Android 11–14) for testing.
- [x] Create the Expo app: TypeScript strict, Expo Router, path aliases (`@/engine`,
      `@/data`, `@/services`, `@/features`, `@/components`, `@/copy`).
- [x] ESLint + Prettier. Add `no-restricted-imports` so `src/engine/**` cannot import
      `react`, `react-native`, `expo*`, `drizzle-orm`, or `@/data`/`@/services`.
- [x] Jest + React Native Testing Library configured.
- [x] `app.config.ts` reading env vars (ARCHITECTURE §8), URL scheme `dogyears`.
- [x] `eas.json` with `development`, `preview`, `production` profiles.
- [x] GitHub Actions: typecheck, lint, test on every push.
- [x] Folder skeleton exactly as ARCHITECTURE §3.

**DoD:** `npm run typecheck`, `npm run lint`, `npm test` pass; a development build runs in
the iOS simulator and Android emulator showing a placeholder home screen.

## M1 — Dog engine (pure TypeScript)

- [ ] `types.ts` and `constants.ts` (all numbers from DOG_ENGINE.md).
- [ ] `time.ts`: user-day boundaries from wake time, night-shift support, weekend schedule,
      `wakingFraction`, quiet-hours check. Use `date-fns` + `date-fns-tz`.
- [ ] `activityCurve.ts` (§4), `targets.ts` + `walks.ts` (§5), `requests.ts` (§6),
      `greetings.ts` + contentment + pose (§7), `bond.ts`, `growth.ts`, `goodDay.ts` (§8),
      `nudges.ts` (§9), copy key selection (§10), `renderProps.ts` (§11).
- [ ] `computeDog.ts` and `finalizeDay.ts` entry points.
- [ ] Persona fixtures and Jest tests for every row of DOG_ENGINE §12, plus property tests.
- [ ] `scripts/simulate.ts` and `npm run simulate -- --persona=<name>` printing timelines.

**DoD:** all persona and property tests pass; engine coverage ≥ 90%; lint proves the engine
imports nothing from React/Expo/data/services.

## M2 — Local data layer

- [ ] `expo-sqlite` + Drizzle schema and first migration (ARCHITECTURE §5).
- [ ] Repos: `dogRepo`, `prefsRepo`, `eventsRepo`, `dayRepo`, `ledgerRepo`, `stepCacheRepo`.
- [ ] `buildEngineInput(now)`: the only bridge from stored data to the engine.
- [ ] Lazy finalization of past days on app open (idempotent; test running it twice).
- [ ] "Delete all data" clears every table and resets onboarding.

**DoD:** repo and assembler tests pass; finalization idempotency test passes.

## M3 — App shell and UI (placeholder dog, mock services)

- [ ] Service interfaces + mock implementations (Health, ScreenTime, Notifications,
      Purchases). Dev menu to switch personas and fast-forward time in development builds.
- [ ] Onboarding (PRD F1) with permission primer screens.
- [ ] Home scene (F2): `PlaceholderDog` implementing `RenderProps`, room lighting by time,
      bowl, quick actions (Start walk, Log water, Pet, How are you?).
- [ ] Recompute on `AppState` → active; greetings (F3); trigger animations from output diffs.
- [ ] Walk screen (manual walk), mood check-in with 1-minute breathing (F9), Support screen
      with remote-config resource list (numbers marked "verify before launch").
- [ ] Progress (F10) with no streak counters; Settings (F13); "Your data" screen.
- [ ] `src/copy/en.ts` with all keys from DOG_ENGINE §10 and the copy-rules test (PRD §7).
- [ ] Accessibility labels for every dog state; reduce-motion support.

**DoD:** the whole app is usable in simulators with mock data for every persona; copy test
passes; screen reader reads the dog's state.

## M4 — Steps (real health data)

- [ ] iOS `HealthService`: stepCount permission, 10-minute buckets, observer + hourly
      background delivery that records events and asks the nudge planner.
- [ ] Android `HealthService`: Health Connect `READ_STEPS` (+ optional background read),
      synthetic-package-name-safe aggregation, Recording API fallback for Android ≤ 13.
- [ ] Walk detection writes `walk_detected` events; leash and play-bow requests go live.
- [ ] Permission-denied path keeps manual walks working.
- [ ] **[HUMAN]** Verify on devices: totals within 5% of Apple Health / Health Connect; the
      leash request appears on a low-step afternoon and clears after a walk.

**DoD:** device verification passed on one iPhone and one budget Android phone.

## M5 — Notifications and the nudge ledger

- [ ] `expo-notifications` setup, categories with action buttons, Android channel.
- [ ] Deep links (`dogyears://walk`, `dogyears://home?play=1`, ...) via Expo Router.
- [ ] `NotificationService` applies `nudgePlan`: cancel and reschedule on each compute.
- [ ] Shared nudge ledger: App Group storage (iOS) / SharedPreferences (Android), mirrored
      to SQLite on open; opened-notification tracking; back-off + in-app frequency question.

**DoD:** tests prove pushes/day ≤ budget across fuzzed days; **[HUMAN]** confirms delivery
and actions on both devices.

## M6 — iOS Screen Time

- [ ] Add `react-native-device-activity` + config plugin (ARCHITECTURE §4.2), iOS 16 target.
- [ ] Authorization flow and Apple app picker for group `social` (free tier: 1 group).
- [ ] Daily schedule from the user's day start; events at 45/60/120 minutes.
- [ ] Extension writes `{rung, firedAt}` to App Group storage and posts rung 2/3
      notifications only if the shared ledger allows.
- [ ] Main app reads rungs on foreground with the early-fire guard; ball/bored requests live.
- [ ] **[HUMAN]** Device test: 60 minutes in a watched app triggers the ball notification;
      unwatched apps never trigger anything.

**DoD:** device test passed. Note: TestFlight/App Store builds are blocked until Apple
approves the Distribution entitlement; local development builds work before that.

## M7 — Android usage stats

- [ ] Local Expo module `android-usage-stats` (ARCHITECTURE §4.3) with its config plugin
      (permissions + `<queries>` for launcher apps).
- [ ] Usage-access permission flow; app picker from launcher apps (labels + icons).
- [ ] Foreground minutes from `queryEvents`; fixture-based tests for the calculation.
- [ ] WorkManager worker every 15 minutes: rung computation + ledger-aware notification.
- [ ] Onboarding step for battery optimization exemption ("Keep {name} awake").
- [ ] **[HUMAN]** Device test on a budget Android phone with default battery settings.

**DoD:** rung 2 notification arrives within ~20 minutes of crossing 60 minutes; behavior
with aggressive battery saver documented in `docs/ARCHITECTURE.md`.

## M8 — Rive dog

- [ ] **[HUMAN]** Commission and deliver `assets/rive/dog.riv` matching ARCHITECTURE §7.
- [ ] `DogRenderer` using `@rive-app/react-native` (exact pinned version): props → view
      model properties / inputs; triggers from output diffs; reduce motion.
- [ ] Fallback to `PlaceholderDog` if the file fails to load; log the error.
- [ ] Performance check on the budget Android phone, including inside scroll views.

**DoD:** smooth idle animation on the budget phone; every pose and request visible.

## M9 — Paywall (RevenueCat)

- [ ] **[HUMAN]** Create products (monthly, annual, 7-day trial) with regional pricing,
      RevenueCat project, entitlement `premium`, API keys.
- [ ] `PurchaseService` + `useEntitlement('premium')`; paywall screen; restore purchases.
- [ ] Gates: more than one screen-time group, extra breeds (later: cosmetics shop).
- [ ] Trial reminder 2 days before conversion (separate from the dog's nudge budget,
      respects quiet hours); cancel instructions one tap away.

**DoD:** **[HUMAN]** sandbox purchase, restore and cancel tested on both stores.

## M10 — Release preparation and beta

- [ ] Usage-description strings for HealthKit, notifications and Screen Time that state
      exactly what is read and that it stays on the phone.
- [ ] Draft privacy policy text, App Store privacy labels and Play Data safety answers
      (**[HUMAN]** reviews and submits).
- [ ] Crash reporting (optional, no sensitive data in breadcrumbs).
- [ ] **[HUMAN]** Filipino copy from a native speaker; verify support hotline numbers.
- [ ] **[HUMAN]** TestFlight + Play internal testing with 50–100 beta users.

**DoD:** beta build in testers' hands; PRD §9 metrics tracked.

---

## Post-MVP backlog (do not start before M10)

- [ ] Optional account + Supabase sync (ARCHITECTURE §6) with RLS tests.
- [ ] v1.1 app shield (iOS shield extensions; Android AccessibilityService after Play
      declaration approval) with "Walk with {name}" / "5 more minutes".
- [ ] Sleep data and wake-up mood; phone-free nap timer.
- [ ] Extra breeds and cosmetics shop.
- [ ] Weather behaviors (rain → indoor play; heat index → cooler walk hours).
- [ ] Home-screen widgets; friends' dog park.
