# Velthiros — implementation map

How the design document maps onto the code, what I had to decide, and what is still yours to answer.

---

## 1. GDD section → code

| GDD | Implemented in | Notes |
|---|---|---|
| 2. Story, opening, abduction | `scenes.js` `RoomScene('intro')`, `CutsceneScene` | Bedroom is walkable and non-interactive, exactly as specified. Garatu's line is verbatim. |
| 3. Core loop | `game.js` `enterTrial` → `onTrialFinished` → `leaveRanking` | Hub → shops → trial → ranking → hub. Reaper on every 5th. |
| 4. Screen list | `scenes.js` | All 8 screens exist. |
| 5. World | `arena.js` `build()` | Circular arena, radius 900 units. Player moves 60 u/s, so edge-to-edge is 1800/60 = **30 seconds** as specified. Tree ring is impassable, bushes are scattered cover. |
| 6.1 Trial types | `arena.js` `setupObjective()` | All 5 types; Hide & Seek is split into its two stated variants (`hide` and `seek`), and Puzzles into `puzzle` (physical) and `word`. |
| 6.2 Ranking | `arena.js` `finish()`, `data.js` `RANK_TIERS` | See "Ranking maths" below. |
| 7.1 Weapons | `data.js` `WEAPONS` | Four weapons with the stated strengths and weaknesses expressed as real numbers. |
| 7.1 Scythe unlock | `scenes.js` `StartScene` | 5 minutes idle on the Start Screen → prompt → button sequence → unlocked for the run. |
| 7.2 Enemies | `data.js` `ENEMIES`, `entities.js` `Enemy` | Goblins everywhere, Minotaurs appear as the difficulty tier rises, Reapers every 5th trial. |
| 7.3 Stealth | `entities.js` `Player.update` / `Enemy.detects` | Standing still in a bush cuts enemy sight range to 22%. |
| 8. Power gems | `data.js` `GEMS`, `scenes.js` `GemScene` | One granted at random after the abduction, no player input. Levels every 8 cleared trials, capped at V. |
| 9. Economy | `data.js` shops, `game.js` `buy()` | One shared currency. Five business investments pay out on every survived trial. |
| 9. Full reset | `save.js` `fullReset()` | 25 deaths wipes currency, gems, purchases and weapons, and rerolls the scythe combo. |
| 10. Endgame | `game.js` `makeSpec()`, `arena.js` | Three escalating waves, then the final boss, drawn from the reference image. |
| 11. Art style | `art.js` | Chibi proportions, heavy outlines, bright palette, 3/4 view (world Y squashed to 0.62). |
| 12. UI | `ui.js` `HUD.draw` | Timer top-middle, health and stamina top-left, attack + smaller special bottom-right, joystick bottom-left. |

---

## 2. Decisions I had to make

These were ambiguous or unspecified. Each is a one-line change if you disagree.

**Failure sends you back to the same trial, not the previous one.**
§6.2 says a below-40% result restarts "from the previous trial", but the note directly under it
says death returns you to "the start of that trial ... same as a below-40% ranking failure".
Those conflict. I implemented both as *restart the current trial*, which is the reading the note
supports and the less punishing of the two. `game.js` `leaveRanking()`.

**Ranking percentile is derived from score against a par.**
There is no real leaderboard to place against, so each trial computes a par score and your
percentile is `100 - 75 × (score / par)`. That formula puts the GDD's boundaries exactly where
they belong: hitting par is top 25%, 80% of par is the 40% line. Score comes from completing the
objective, time remaining and kills, minus damage taken.

**Debuffs are a 70% chance, drawn from five.**
§6.2 says "potential debuff", so it is not guaranteed. The five are in `data.js` `DEBUFFS`.

**Gem and weapon levelling rates.** Gems gain a level every 8 cleared trials (max V), weapons
every 6 (max VI, +6% damage each). The GDD says both "level up alongside the player" without
giving a rate.

**A dodge button exists.** The GDD lists only attack and special, but Galeshard boosts "dodge"
and Wingshard grants a glide, so a dodge action has to exist. It is the small third button.

**Consumables use one context-sensitive button** rather than an inventory screen — it uses a
potion if you are hurt, a tonic if you are winded, otherwise a smoke bomb.

**Enemies "hiding" in Seek trials are found by proximity**, within about 90 units. There is no
separate search input.

---

## 3. Placeholder answers to the open questions

All four are marked TBD in §14. I filled them in so the build could run — treat every one of
these as a suggestion, not a decision.

**Currency name → "Vel"** (symbol ◆). Short enough for a mobile HUD, and it echoes the title.
Earn rate is `45 + 7 × trial index`, scaled by how far above par you finished, so trial 1 pays
around 100 and trial 50 around 500. `game.js` `onTrialFinished`.

**Trial Shop contents → three weapons, five gear pieces, three consumables.** Gear is permanent
stat gain, consumables are per-use. Prices are set so a top-25% player affords roughly one item
every two or three trials.

**Final boss → "Aurelith".** Drawn from your reference: pale multi-winged figure, insectoid
carapace with a web pattern, orange-red growths, a single red gem eye and twin red sockets on
the abdomen, floating blade fragments. Three phases gated on health, summoning adds and firing
radial volleys.

**Endgame structure → 3 waves, then Aurelith.** Escalating Defeat trials at endgame difficulty.

**Weapon numeric tuning** is first-pass and in `data.js`. Roughly: the sword is the baseline, the
axe trades ~2.3× the wind-up for ~1.8× the damage, the bow does 80% of sword damage at eight
times the range, and the scythe sits ~40% above the sword with no real weakness — which is the
point of it being secret.

---

## 4. Ranking maths, in full

```
score  = objective bonus (0.62 × par if completed)
       + time remaining × 2.2
       + kills × 16
       + type-specific bonuses
       - damage taken × 1.1

ratio      = score / par
percentile = clamp(100 - 75 × ratio, 1, 99)
```

A death floors your percentile at 62 (always a failure), and a timeout or blown objective caps
your score at 55% of par.

Measured against a scripted bot playing competently, this currently produces roughly:

| Situation | Result |
|---|---|
| Clean Defeat trial, no damage | top 6% |
| Same, taking 45 damage | top 17% |
| Unhurried Collect & Deliver | top 36% (no reward) |
| Seek, all found | top 20% |
| Defend, ground held | top 24% |

That spread is deliberate: a good run pays, a sloppy one does not, and the 25% line is real
rather than automatic. It is also the number most likely to need moving once real people play it —
`npm test` prints this table on every run.

---

## 5. Where the risk is

- **Balance is unplayed by humans.** Every number came from a bot and my judgement.
- **The scythe unlock is undiscoverable by design.** Five minutes of idling on a title screen is a
  long time to bet on. Worth watching whether anyone finds it without being told.
- **Procedural arenas mean no set-pieces.** Fifty trials of generated layouts will start to feel
  samey before trial 50; hand-authored boss arenas are the obvious first fix.
- **Percentile against a par, not against players.** If the trials ever go online, this becomes a
  real leaderboard and the par formula goes away.
