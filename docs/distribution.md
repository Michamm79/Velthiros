# Where to put this so it can actually make money

## The honest headline

A solo browser game usually makes very little. The realistic ceiling for this build,
as it stands, is somewhere between pocket money and a few hundred dollars a month —
and getting to the upper end of that depends far more on **retention** than on which
platform you pick.

The one route with a real shot at meaningful money is **web game portals**
(CrazyGames, Poki), because they bring the traffic and split ad revenue with you.
A game that performs on a portal clears roughly **$200–$2,000/month**; the handful of
top studios on Poki reach seven figures a year. Everything else on this page is either
a stepping stone to that, or a credibility asset rather than an income stream.

Two things are already in your favour:

- **The game has no outbound links anywhere in its source.** Portals reject games that
  link out. You are compliant without changing anything.
- **It is already one self-contained HTML file with no dependencies and no asset
  loading.** That is exactly the shape portals want, and it makes the itch.io upload a
  drag-and-drop.

One thing is against you, and it is worth saying plainly: **the design is
anti-retention for a portal audience.** "Twenty-five deaths wipes everything you own"
is a great hook for a premium game and a great way to lose a casual player who found
you through an ad. Portal revenue is a function of session length and return visits.
If portal money is the goal, that rule needs an off-ramp — see the checklist at the
bottom.

---

## The sequence

Do these in order. Each one feeds the next.

### 1. itch.io — this week, free

You already have `graysongamedev.itch.io` with Valtara on it, so this is the shortest
path from "a GitHub Pages link" to "a real store page".

- Run `npm run itch`. It builds and writes `dist/velthiros-itch.zip` — `index.html` at
  the root (itch requires that name at the top level), plus the service worker, manifest
  and icons so offline play works there too. 9 files, 758 KB, against limits of
  1,000 files / 500 MB / 200 MB per file.
- Upload that zip as an HTML5 project and tick **"This file will be played in the
  browser"**.
- **Tick "Mobile friendly"** in the embed settings. On a phone, itch then forces
  click-to-launch fullscreen regardless of your desktop embed config.
- Set the canvas size, tick the touchscreen option, enable the fullscreen button, and
  set orientation to **Auto** — the game genuinely works both ways up.
- Pricing: **"$0 or donate"** — pay-what-you-want with a $0 minimum. That *is* the
  donation model; there is no separate donate switch. A paywall on an unknown solo
  browser game kills the play count you need for everything below.
- Set the **suggested** amount to **$3–5, not $1**: processing runs about 2.9% + $0.30,
  so a $1 tip nets roughly $0.37 once fees and itch's cut come out.
- itch's cut is whatever you set it to, 0–100%, defaulting to 10%.

**Set payments up before you publish, not after.** Pick a payout mode in seller settings:
*Direct to you* sends each purchase straight to your PayPal or Stripe and needs those
configured first, or *Collected by itch.io* takes donations immediately but will not let
you withdraw until you have completed the **tax interview** and linked PayPal or Payoneer.
Manual payouts have a **$5 minimum**. Collecting donations you cannot claim is the usual
way this goes wrong.

**What you get:** a linkable store page, comments, a devlog, and a download counter.
**What you will not get:** meaningful revenue. Discovery on itch is weak unless you
catch a jam or a curator.

### 2. CrazyGames — the actual money, next

This is the highest-expected-value route and it costs nothing to try.

- Submit the HTML5 build through the developer portal. QA usually replies in 1–2 days.
- It launches in two stages: **Basic Launch** puts it on the site with no SDK work so
  they can measure how players respond. If it holds attention, you are invited to
  **Full Launch**, where you integrate their SDK and start earning.
- Their 2026 game-jam terms put the developer share at **60% of ad revenue and 70% of
  purchase revenue**. They do not publish a split in the main docs, so treat that as
  indicative, not contractual — read your actual terms.
- **No fee and no exclusivity.** You can keep the itch page, the GitHub Pages build and
  a future Play listing running at the same time.

The SDK work at Full Launch is the real task: rewarded/interstitial ad calls need places
to sit that do not feel grafted on. The natural spots here are between trials and on the
continue-after-death prompt.

### 3. Poki — after you have CrazyGames numbers

Poki negotiates terms per title rather than publishing a rate; developer share lands
roughly **50–80%** depending on the game and traffic source. The bar is higher and they
care about retention metrics, which is exactly what a CrazyGames Basic Launch gives you
to show them. Apply with data, not with a pitch.

### 4. Google Play as a TWA — $25, optional

The game is already an installable PWA with a service worker and a maskable icon set,
so wrapping it with **PWABuilder** into a Trusted Web Activity is genuinely close to
free work. A Play listing is a credibility asset and lets you add IAP or ads later.

Budget for the friction, not the fee: a new personal developer account needs a
**closed test with 12 testers running for 14 continuous days** before you can apply for
production access. The $25 is one-off and trivial; the testers are the actual cost.

### 5. Apple App Store — not yet

$99/year, and submission requires a Mac. You mentioned being without your desktop for a
stretch. Skip it until something below is earning.

---

## What actually moves the number

Ranked by revenue impact, not by effort:

1. **Give the death limit an off-ramp.** A run-ending wipe at 25 deaths is the single
   biggest retention risk. A rewarded ad that restores a death, or a "start a new run
   keeping your gems" option, converts a quit into a session — and on a portal, a
   rewarded ad *is* the revenue.
2. **Cut time-to-first-fight.** Portal players bounce in seconds. Measure how long it
   takes from page load to the first swing, and cut everything you can out of it.
3. **Add a reason to come back tomorrow.** A daily trial, a streak, a leaderboard. The
   ranking system you already have is 80% of a leaderboard.
4. **Then integrate ads.** Interstitials between trials, rewarded on continue. Doing
   this before 1–3 just annoys people who were going to leave anyway.

---

## Realistic expectations

| Route | Cost to try | Time to live | Realistic monthly |
|---|---|---|---|
| itch.io | Free | An afternoon | $0–20 |
| CrazyGames | Free | 1–2 days to review, weeks to Full Launch | $0–2,000 |
| Poki | Free | Needs prior traction | $0–2,000+ |
| Google Play (TWA) | $25 + 12 testers × 14 days | 3–4 weeks | $0–50 without ads |
| App Store | $99/yr + a Mac | Weeks | Not worth it yet |

The wide CrazyGames range is the honest one: most submissions earn close to nothing, and
the difference between the ends of that range is retention, not code quality.

---

## Sources

- [CrazyGames developer portal](https://developer.crazygames.com/)
- [CrazyGames requirements](https://docs.crazygames.com/requirements/intro/) · [FAQ](https://docs.crazygames.com/faq/)
- [CrazyGames publish-and-earn guide (2026)](https://app.cinevva.com/guides/publish-game-crazygames)
- [Poki vs CrazyGames vs GameDistribution revenue share](https://playgama.com/blog/business-faqs/poki-vs-crazygames-vs-gamedistribution-revenue-share/)
- [Web game monetization: what the data says (2026)](https://app.cinevva.com/guides/web-game-monetization)
- [itch.io: uploading HTML5 games](https://itch.io/docs/creators/html5)
- [itch.io launch guide (2026)](https://app.cinevva.com/guides/itch-io-launch-guide)
