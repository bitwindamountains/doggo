# Store privacy answers (DRAFT)

> **[HUMAN]** Answers for the current build (M5: no account, no server, no analytics, no
> purchases SDK). Re-check when RevenueCat (M9), crash reporting or sync ship. Source of
> truth for behavior: `docs/ARCHITECTURE.md` and the code; nothing in `src/` makes a
> network request.

## Apple App Store — App Privacy ("nutrition label")

- **Data collection:** "Data Not Collected." Apple defines "collect" as transmitting data
  off the device; Dog Years reads HealthKit step counts and Screen Time thresholds but keeps
  them on the device.
- After M9 (RevenueCat): add **Purchases → Purchase History** (App Functionality, linked to
  the user via an anonymous ID, not used for tracking) and **Identifiers → User ID** if a
  RevenueCat app user ID is set. Confirm against RevenueCat's current Apple guidance.
- **Tracking (ATT):** No. No IDFA, no third-party ads or analytics.
- **HealthKit review notes:** read-only `stepCount`; usage description:
  "Dog Years reads your step count so your dog knows when you have walked. Steps stay on
  this phone." No HealthKit data in iCloud, no third-party sharing.
- **Family Controls (M6):** individual authorization; app tokens only, no app names.

## Google Play — Data safety

- **Does your app collect or share any of the required user data types?** No (data is
  processed only on the device; Google's definition of "collect" excludes on-device-only
  processing).
- **Is all user data encrypted in transit?** Not applicable (nothing is transmitted).
- **Can users request that data be deleted?** Yes — Settings → Your data → Delete all data.
- **Health Connect declaration (Play Console):** READ_STEPS only, for "fitness/wellness
  reminders shown in the app"; privacy policy URL required; the permission-rationale intent
  opens the app (see ARCHITECTURE §4.4).
- After M9: Financial info → Purchase history (collected, not shared, app functionality).
- **Usage access (M7):** `PACKAGE_USAGE_STATS` is a special permission granted in Settings;
  declare the use in the listing and show the in-app disclosure before sending the user to
  Settings.
