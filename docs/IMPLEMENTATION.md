# Velthiros — implementation map

How the design document maps onto the code, what I had to decide, and what is still yours to answer.

---

## 1. GDD section → code

| GDD | Implemented in | Notes |
|---|---|---|
| 2. Story, opening, abduction | `scenes.js` `RoomScene('intro')`, `CutsceneScene` | Bedroom is walkable and non-interactive, exactly as specified. Garatu's line is verbatim. |
| 3. Core loop | `game.js` `enterTrial` → `onTrialFinished` → `leaveRanking` | Hub → shops → trial → ranking → hub. Reaper on every 5th. |
| 4. Screen list | `scenes.js` | All 8 screens exist. |
| 5. World | `arena.js` `build()` | Circular arena, radius 1250 units. Player moves 190 u/s, so edge-to-edge is ~13 seconds — see §5 below for why this departs from the GDD's 30. Tree ring is impassable, bushes are scattered cover. |
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
| 11. Art style | `pixel.js`, `sprites.js` | Hand-authored pixel art on a locked palette, heavy dark outlines, 3/4 view (world Y squashed to 0.62). `art.js` still covers menus, the cutscene and the hub interior. |
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

**Enemies "hiding" in Seek trials are found by proximity**, within about 118 units. There is no
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
score  = objective bonus (0.68 × par if completed)
       + time remaining × 1.5
       + kills × 16
       + type-specific bonuses
       - damage taken × 0.75

ratio      = score / par
percentile = clamp(100 - 75 × ratio, 1, 99)
```

A death floors your percentile at 62 (always a failure), and a timeout or blown objective caps
your score at 55% of par. All of these coefficients are in `Trial.prototype.finish` in
`arena.js`, alongside the per-type `this.par =` lines that set the bar for each trial.

Measured against a scripted bot playing competently, this currently produces roughly:

| Situation | Result |
|---|---|
| Clean Defeat trial, no damage | top 2% |
| Same, taking 45 damage | top 7% |
| Unhurried Collect & Deliver | top 36% (no reward) |
| Seek, all found | top 18% |
| Defend, ground held | top 20% |
| A bot that never dodges, playing a full Defeat trial | top 27% |

That spread is deliberate: a good run pays, a sloppy one does not, and the 25% line is real
rather than automatic. It is also the number most likely to need moving once real people play it —
`npm test` prints this table on every run.

---

## 5. Post-playtest changes

Playtest feedback produced these changes, several of which knowingly depart from the document.

**Movement speed and arena scale.** §5 specifies ~30 seconds to cross the arena. In play
that read as sluggish, so the player moves at 140 u/s instead of 60 and the arena is 2500
units across instead of 1800 — about 13 seconds edge to edge after a second pass. Enemy speeds, attack
wind-ups, recovery frames, projectile speeds, dodge distance and knockback were all scaled
to match, and cover and ground detail were made denser so the larger map does not read as
empty. If the original pacing is wanted back, `speed` in `save.js` `resolveStats` and
`ARENA_R` in `arena.js` are the two numbers.

**Pixel-art presentation.** The world now renders into a small offscreen buffer (about 240
pixels tall) and is scaled up with image smoothing off, so every edge lands on a pixel
grid. The HUD is drawn afterwards at full resolution, so text stays readable on a phone
while the world stays chunky. `?smooth=1` restores the previous vector look for comparison.
Ground is a dithered two-tone tile anchored to the world origin rather than a flat checker,
and the environment palettes were deepened to suit the harder edges.

**Hand-authored pixel art.** The procedural vector drawing was replaced with a real sprite
sheet. `pixel.js` holds a locked palette of about 35 colours and a small authoring grid
(`rect`, `oval`, `line`, `speckle`, `mirrorX`, `outline`); `sprites.js` draws every
character, prop, weapon and ground tile against it, pixel by pixel. Sprites bake once into
offscreen canvases and are blitted at exactly one sprite pixel per buffer pixel, which is
what keeps pixel art from shimmering when the camera moves. The arena's world zoom is fixed
at 0.26 buffer pixels per world unit to hold that relationship.

Characters have three authored views — down, up and side, with side mirrored for the other
direction — and a three-frame walk. Weapons are separate sprites pivoted at the grip and
rotated through the swing. The test suite bakes all 65 sprites and fails on any unknown
palette key, which is the main defence against a typo in hand-placed pixel data.

What is not yet converted: the bedroom/hub interior furniture and the title and cutscene art
are still procedural, so they read smoother than the arena. A tiled interior is the obvious
next art job.

**Stones are pushed on a locked axis.** Physical puzzles originally moved stones through the
generic collision separation, which shoved them along whatever vector separated the two
bodies — so approaching with the joystick even slightly off-centre sent the stone diagonally
and the player slid past it. Pushing is now explicit: contact plus movement into the stone
acquires a lock on the nearest cardinal axis, the stone travels at a fixed 115 u/s, and the
player is pinned square behind it and eased onto its centre line until they stop or turn
away. Stones are otherwise solid — brushing one moves the player, never the stone — and
melee no longer knocks them around, so a swing near a solved plate can't undo it.
`Trial.prototype.updatePush` in `arena.js`.

**A second speed increase.** 140 u/s still read as sluggish, so the player is now 190 u/s
(~13 seconds to cross the arena), dodge reaches 310 units on a 0.58s cooldown, enemies rose
about 20% so they remain a threat without matching the player, and the camera leads further
and catches up faster. The walk cycle animates faster to match.

**The scythe combo is pinned for testing.** `D.FIXED_COMBO_INDEX` is `0`, so the unlock is
always up, up, down, down, left, right. Setting it to `null` restores the GDD behaviour of
drawing a fresh combo from ten presets on every reset — the test suite covers both paths.

## 6. Where the risk is

- **Balance is unplayed by humans.** Every number came from a bot and my judgement.
- **The scythe unlock is undiscoverable by design.** Five minutes of idling on a title screen is a
  long time to bet on. Worth watching whether anyone finds it without being told.
- **Procedural arenas mean no set-pieces.** Fifty trials of generated layouts will start to feel
  samey before trial 50; hand-authored boss arenas are the obvious first fix.
- **Percentile against a par, not against players.** If the trials ever go online, this becomes a
  real leaderboard and the par formula goes away.
