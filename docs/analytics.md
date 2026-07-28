# Analytics & North Star (Phase 0)

Product analytics run through **PostHog** (`src/lib/telemetry.ts`). Nothing loads
or sends unless `VITE_POSTHOG_KEY` is set, so it stays off in local dev by
default. Set it in `.env` and in Vercel (then redeploy), optionally with
`VITE_POSTHOG_HOST` (defaults to `https://us.i.posthog.com`).

## North Star: Weekly Logging Users (WLU)

**Definition:** users who log a real day (a weigh-in) on **≥4 days in a rolling
7-day window.** Everything we build should move this number.

Set it up in PostHog:

1. **People → Cohorts → New cohort → "Weekly Loggers"** (behavioral):
   - *Completed event* **`day_saved`**, where property **`has_weight` = true**,
     **at least 4 times** in the **last 7 days**.
2. **Product analytics → New insight → Trends**:
   - Series: **Unique users** in cohort **Weekly Loggers** (or count the cohort),
     grouped **weekly**. Pin it to a dashboard — that line is your North Star.

> Why `has_weight`? A day only "counts" once a weight is entered (matches the
> app's `isDayLogged` / streak rule). Partial saves send `day_saved` with
> `has_weight:false` and are excluded.

## Activation funnel (make-or-break)

New insight → **Funnel**, ordered steps:

1. **`profile_completed`** (`first_time = true`) — finished onboarding.
2. **`day_saved`** where **`day = 1`** — logged Day 1.
3. **`day_saved`** where **`day = 2`** — logged Day 2 (came back).

"Signup" = PostHog's first-seen for the user (the `$identify` on first sign-in),
so the top of the funnel is simply *new users → profile_completed → Day 1 → Day 2*.

## Retention (business health)

New insight → **Retention**:

- **Cohortize on:** performed **`day_saved`** (`has_weight = true`).
- **Returning event:** **`day_saved`** (`has_weight = true`).
- Read **Day 1 / Day 7 / Day 30** columns. This is the single most important
  chart — fix retention before buying traffic.

## Monetization funnel

New insight → **Funnel**:

1. **`paywall_viewed`** — hit a gate (history cap, export, locked theme, etc.;
   see the `source` property).
2. **`premium_checkout_started`** — clicked Get Premium (Whop).
3. **`premium_activated`** — became premium (webhook granted it).

Track the free-trial branch separately with **`trial_started`** (property-free)
→ `premium_activated`.

## Event reference

| Event | Where | Key properties |
|---|---|---|
| `profile_completed` | ProfileSetup save | `first_time` |
| `day_saved` | saving today's data | `day`, `has_weight` |
| `quest_claimed` / `quests_claimed_all` | claiming quests | `quest`/`count`, `xp` |
| `level_up` / `rank_up` | XP thresholds | `level`, `rank` |
| `challenge_created` / `challenge_joined` | challenges | `mode`, `via` |
| `paywall_viewed` | free-limit modal | `source` |
| `trial_started` | any "start trial" button | — |
| `premium_checkout_started` | Get Premium (Whop) | — |
| `premium_activated` | premium unlocked | — |
| `share_card` | shared/saved a progress card | `method` |
| `waitlist_joined` | landing-page email capture | — |
| `account_deleted` | account deletion | — |
| `push_enabled` / `app_install_prompt` | PWA | `accepted` |

User identity is attached on sign-in (`identifyUser`) and cleared on sign-out.
