# Dog Years — Product Requirements (MVP + v1.1)

## 1. Product in one paragraph

A virtual dog lives on the user's phone. Its needs mirror the user's healthy habits:
walks = the user's steps, play = breaks from sitting, attention = time away from social
media, a full water bowl = the user's water, bedtime = the user's bedtime. The dog reacts
automatically to phone data (steps, app usage) so the core loop needs no manual logging.
The dog is warm, never guilt-tripping, and never suffers.

## 2. Target users

- Primary: adults 18–35 in the Philippines who sit a lot (office, BPO night shifts,
  students) and scroll a lot, and who love dogs.
- Secondary: same profile in the US.
- Must work well on budget Android phones (2–4 GB RAM) and with BPO night-shift schedules
  (wake time can be afternoon; "day" follows the user's own wake/bed times).

## 3. Core loop

1. The dog has a daily rhythm (two activity peaks, rests most of the day).
2. Phone data updates the dog's needs in the background.
3. When a need is unmet, the dog makes a *request* (leash, play bow, ball, water, bedtime).
4. The user acts in real life (walks, stands up, puts the phone down, drinks, sleeps).
5. The dog reacts happily; bond grows; good days accumulate; the dog learns tricks and
   grows from puppy to adult over roughly 10 weeks of good days.

## 4. MVP features

Each feature lists acceptance criteria (AC). Rule numbers and thresholds are defined in
`docs/DOG_ENGINE.md`; do not hard-code different numbers in UI code.

### F1. Adoption onboarding
- User picks a breed (launch set: Aspin, Shiba-style, Golden-style, Corgi-style — generic,
  non-trademarked designs), names the dog (1–24 chars), sets wake time and bedtime, and
  picks how many nudges per day (0–3, default 3).
- Permission primers explain *why* before each OS prompt: steps (health), notifications,
  screen time / usage access. Every permission is optional; the app still works without it.
- AC: a user who denies everything still gets a working dog with manual walk logging.
- AC: onboarding takes under 2 minutes; no account required.

### F2. Home scene
- Full-screen room with the dog (Rive or placeholder), lighting that follows the user's
  local time, the water bowl, and 4 quick actions: Start walk, Log water, Pet, How are you?
- The dog shows its current pose and request. Tapping the dog pets it (max 3 bond awards
  per day; petting is always allowed).
- AC: dog state is recomputed every time the app becomes active.
- AC: a screen-reader label describes the dog's state ("Biscuit is holding the leash and
  looking at you").

### F3. Greetings
- On app open, the dog greets based on time away (none / small / big). Capped: a week away
  gets the same joyful big greeting as two hours away. Never sulking.
- AC: matches `greetingFor()` in DOG_ENGINE.md; snapshot tests for the three levels.

### F4. Walks (steps)
- Steps come from HealthKit / Health Connect. A walk is detected automatically
  (DOG_ENGINE §Walk detection) or started manually with "Start walk" (timer + steps).
- Leash request appears in the afternoon when the user is behind their personal step
  target. First 7 days: baseline learning, in-app requests only, no step push nudges.
- AC: with mock data for persona `desk-worker`, the leash request appears at the configured
  walk-check time and clears after a detected walk.

### F5. Sitting breaks
- If almost no steps in the last 60 minutes during waking hours, the dog play-bows.
- AC: never fires during quiet hours, the first 60 minutes after wake time, or within the
  90-minute cooldown.

### F6. Social media reactions (screen time)
- User picks apps/categories to watch (iOS: Apple's picker; Android: list of launcher apps).
- Escalation ladder: 45 min ears perk (in-app only) → 60 min drops a ball (push) →
  120 min lies down bored with a sigh (push).
- Free tier: one app group. Premium: unlimited groups.
- AC: thresholds reset at the start of the user's day; reactions verified on a physical
  iPhone and a physical budget Android phone.

### F7. Water bowl
- Bowl drains over the waking day; logging a glass refills it and the dog drinks too.
  Goal set by the user (default 8 glasses). In-app request only, never a push.
- AC: one-tap logging from home and from a notification action / widget-ready intent.

### F8. Bedtime
- 30 minutes before bedtime the dog yawns and walks to its bed (push allowed, counts in
  budget). After bedtime the dog is asleep and the room is dim.
- AC: opening the app after bedtime shows a sleeping dog and a quiet "Goodnight" screen.

### F9. Mood check-in
- "How are you?" with 5 faces. Low (1–2) → the dog comes and rests its head on the user,
  offers a 1-minute breathing exercise with the dog breathing slowly.
- If 3 of the last 5 check-ins are low, show a gentle Support screen with local resources
  (Philippines and US lists in remote config; numbers verified before launch).
- AC: mood values never leave the device in MVP.

### F10. Progress, tricks and growth
- Progress screen: total walks, good days, this week's good days, tricks learned, life stage.
- No consecutive-day streaks anywhere.
- AC: tricks unlock at the milestones in DOG_ENGINE.md with a celebration animation.

### F11. Nudges (notifications)
- Written in the dog's voice with one action button. Budget, spacing, quiet hours and
  back-off exactly as DOG_ENGINE §Nudge scheduler.
- AC: a test proves no more than the user's budget are scheduled per day in every persona.

### F12. Paywall
- 7-day free trial of Premium. Reminder 2 days before conversion. Cancel instructions one
  tap away. Regional pricing set in the stores.
- AC: all Premium checks go through one `useEntitlement('premium')` hook.

### F13. Settings & privacy
- Edit wake/bed times, nudges per day, quiet hours, watched apps, water goal, permissions.
- "Your data" screen in plain language: what stays on the phone, what (if anything) syncs.
- Delete all data button (local + server).

## 5. v1.1 features (do not build in MVP)

- App shield at the user's own daily limit (iOS ManagedSettings via the library's shield
  extensions; Android launch intercept via AccessibilityService after Play approval).
  Shield shows the dog with its leash: "Walk with Biscuit" or "5 more minutes".
  iOS shield buttons cannot open the main app: "Walk" closes the app and posts a
  notification that deep-links into Dog Years.
- Sleep data from HealthKit / Health Connect; wake-up mood of the dog.
- Phone-free nap timer: dog naps beside you while watched apps stay closed.
- Extra breeds, cosmetics shop (collars, beds, toys, room items).
- Optional account + sync (Supabase).

## 6. Later

Friends' dog park, weather behaviors (rain → indoor play; high heat index → walk at cooler
hours), home-screen widgets, Apple Watch, meal-regularity check (no calories, ever).

## 7. Copy rules

Every string in `src/copy/` must pass all of these. Add a unit test that scans copy files
for banned words.

1. The dog asks or invites; it never blames. Subject of the sentence is the dog's action.
2. Banned words/ideas in user-facing copy: sad (about the user's behavior), disappointed,
   failed, broke, lost your streak, wasted, lazy, guilty, ashamed, starving, sick, dying,
   abandoned, "you only", "you didn't", calories, weight.
3. Max 60 characters for notification bodies. One action per notification.
4. Misses are framed as circumstance or simply not mentioned.

| Avoid | Use |
| --- | --- |
| "Biscuit is sad because you didn't walk him." | "Biscuit brought you the leash." |
| "You broke your 12-day streak." | "12 walks this month. Biscuit remembers every one." |
| "You've wasted 2 hours on TikTok." | "Biscuit dropped a ball by your phone." |
| "Your dog missed you." | "You're back!" (big greeting animation) |

## 8. Non-goals

No ads. No social feed. No calorie or weight tracking. No GPS route tracking in MVP.
No AI chat with the dog in MVP. No dog death, illness or decline mechanics, ever.

## 9. Success metrics (beta)

- Day-14: most beta testers still open the app at least every other day.
- Fewer than 10% of beta testers turn notifications off in the first week.
- Users report the dog feels "cute, not naggy" in a 1-question survey after week 2.
