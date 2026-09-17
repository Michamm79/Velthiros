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
| 7.2 Enemies | `data.js` `ENEMIES` / `ROSTER`, `entities.js` `Enemy` | Seven types. `D.ROSTER` unlocks each by tier and thins the starter out behind it: Goblin from the start, Husk 1.15, Slinger 1.45, Minotaur 1.70, Shade 2.05, Ironclad 2.35; Reapers every 5th trial and the Aurelith at the end. |
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

**The roster answers habits, not stat lines.** Each enemy past the Goblin exists to close off one
way of playing safely, which is why they are added as behaviour rather than as bigger numbers:

| Enemy | Flag | What it takes away |
|---|---|---|
| Husk | `swarm` | Single-target swings — it never arrives alone, so a wide arc is the answer |
| Slinger | `ranged`, `kite` | Distance. It is the first thing in the game that shoots back, and it gives ground during its own recovery rather than trading |
| Minotaur | `charge` | Standing your ground in the open |
| Shade | `blink` | Backing away — it closes half the gap every 2.6s, so kiting stops working |
| Ironclad | `heavy` | Greed. Halved knockback, a wind-up you can walk out of, and a hit you cannot afford twice |

`ranged` diverts `Enemy.swing` into `spawnBolt` instead of a melee arc; `kite` makes `chase` and
`recover` walk backwards inside a set radius; `blink` is `Enemy.tryBlink`, a short teleport that
refuses to fire inside 220 units so it closes gaps rather than teleporting into your face.

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
score  = objective bonus (complete × par, if completed)
       + time remaining × time
       + kills × kill
       + type-specific bonuses (flawless, zone held, hints unused, partial progress)
       - damage taken × damage

/* the four weights are per trial type - see SCORE in arena.js.
   Combat trials: complete 0.68, time 1.15, kill 16, damage 0.75
   Puzzles:       complete 0.92, time 0.50, kill 16, damage 0.90, flawless 0.10 */

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
direction — and a three-frame walk. The hero has silver hair, so his fringe is authored a
row higher and shallower than everyone else's — a pale mass needs less of the face than a
dark one, and black swallowed it entirely. The hero and the crowd share one builder: `Spr.player`
draws an open long-sleeve top over a bare torso (so the back view is black across the
shoulders and skin below it), while `Spr.civilian` keeps the ordinary clothed build the
square needs. The shop's tints recolour the hero's sleeves, not a tunic. Weapons are separate sprites pivoted at the grip and
rotated through the swing. The test suite bakes all 94 sprites and fails on any unknown
palette key, which is the main defence against a typo in hand-placed pixel data.

**Clothing has two kinds: a tint and an outfit.** A tint only recolours the sleeves already
on the sprite, so anything with its own *shape* cannot be one. `D.OUTFITS` holds garment sets
that are handed straight to `humanoidGrid`, which learned ten optional pieces: a fitted chest
panel, a cloak, a high collar, a helm with a crown of fire, a stone set in the chest, a choker,
wrist bands, a sash with a tie that trails down one hip, a baggy leg cut and trimmed boot tops.
An outfit overlays the default build rather than replacing it - the hair, the skin and the open
top are who he is, the garments are what he is wearing - so adding another outfit is a data
edit. `save.equippedOutfit` sits beside `equippedTint`, is set by any shop item carrying an
`outfit` key, and is cleared by a full reset the same way.

**Four named suits, told apart by shape first.** A palette swap alone is what "they all look
the same" meant, so each set takes a different combination of pieces: Royal a helm crowned in
fire, Ophiuchus a loose top, Reaper a sash and baggy legs, Grayson a cloak over fitted white.

**Everything is fitted.** The body is six columns wide at 18x28, so a garment any wider has
already lost the waist and reads as a sack - the chest panel is the width of the torso and
nothing flares. `loose` is the single opt-out, for the one top that is meant to hang. That one
rule killed three earlier pieces: pauldrons added two columns at each shoulder, coat tails hung
outside the legs, and a split coat flared to the hem; all three bulked the silhouette out until
the character underneath stopped reading.

Trim has to sit on edges, not fill. Royal took three goes: banding the chest panel top and
bottom made stripes with the sash, and framing all three of its edges made a gold U around a
black hole. A collar line and one seam down the front is how a robe closes, and that is all it
needs.

Shop items name their outfit; nothing maps an item id to an outfit by hand. That mapping used
to live in the smoke test as `shirt_black` -> `'reaper'`, and renaming the line-up failed the
test on a rename rather than on a bug. It now checks that buying an item equips what that item
declares, and that every armour in the shop names an outfit that exists.

**Every character is shaded by the same rule.** The hero was rebuilt with three tones per
material; the rest of the cast was still large flat fills, which is why he looked like he came
from a different game. `Grid.shadeBottom` already existed for the lower-right lip but was never
called, so `Grid.liteTop` was added as its other half, and a `form(g, ramp)` helper applies both
from one `{base: [lit, dark]}` map just before the outline. `liteTop` runs first on purpose: a
band one pixel thick then reads as a highlight, because `shadeBottom` no longer recognises the
key it has been recoloured to.

Two details the rule depends on. Garatu and Aurelith are shaded *after* `mirrorX`, or the light
would mirror with the geometry and come from both sides at once. And the civilian needed its
materials separated before shading would show anything: trousers used the same key as the
shirt's own shadow, and hair, belt and boots were all one key, so a civilian was two flat masses
with no edge between them — the same fault the hero had before his rebuild.

Props were checked against the same standard and mostly already met it: they carry speckle,
mortar lines and highlights, and run four to eight colours. The cactus was the exception, with
flat arms and a lit face only on the trunk.

What is not yet converted: the bedroom and hub interior furniture. The title and cutscene
now use sprites. A tiled interior is the remaining art job.

**The title screen's key art is the hero sprite itself**, `Spr.player('down', 0)`, drawn at a
whole-number scale so its pixels stay square, standing on the skyline with the menu centred
above him and Garatu watching from the far side. He is sized off the **short edge**, the way
`UI.setScale` sizes everything else. Off the height he came out more than twice as tall in
portrait as in landscape, because the height is the dimension that changes when the phone
turns; the short edge barely moves, so he is the same figure either way up. A device check
holds the two orientations to the same pixel height. Garatu is placed around the menu rather than
at a fixed spot: on a wide screen he clears it by sitting to its right, but on a narrow one his
wingspan reaches into the menu's column, so there he drops below it instead. Because the hero,
his shirt and his denim are all dark and the skyline behind them is darker still, a warm radial
wash sits behind him — without it he sinks into the buildings.

An earlier version used a pixel portrait converted from a reference photograph. It was replaced
by the sprite, which is the character the game actually plays; the converter and its output are
in the history rather than the tree.

**The start screen offers to install it, but only where the offer leads somewhere.**
Chrome and Edge fire `beforeinstallprompt`, which `V.Install` holds (preventing Chrome's own
mini-infobar from covering the game) and replays from a real tap later. Safari fires nothing
and has no programmatic install at all, so iOS gets a card with the three taps that do it by
hand instead of a button that would do nothing. Everywhere else, and once the game is already
running installed, the button is simply absent — an install button that cannot install is
worse than no button. iOS reports installed-ness through `navigator.standalone` rather than
the `display-mode` media query, so both are checked.

Two things the button needed from around it. Garatu is placed against the menu's real bottom
edge, so that measurement has to include the install row when it exists. And a modal drawn
over the menu leaves the menu's own hit zones live underneath it, so `Input.clearZones()`
drops everything registered earlier in the frame before the card registers its own button.

**The game is a phone game, so it is built like one.** The world buffer is sized by area
rather than by height: sizing by height alone handed a portrait phone a 98-pixel-wide slice
of arena, which meant a giant player and no warning of anything walking at you. The HUD
reads `env(safe-area-inset-*)` off a hidden probe element — the only way to get those values
into JavaScript — and lays itself out inside them, stacking the top row in portrait where
bars, clock and label will not fit on one line. The action buttons sit on an arc with a
guaranteed gap: they used to overlap, and because hit-testing walks the zone list backwards,
the left edge of ATK fired the special instead. A camera clamp keeps the view inside the
barrier, which matters most in portrait, where the 3/4 squash makes the visible strip taller
than the arena itself.

Beyond layout: a screen wake lock holds the display on through a trial, `visibilitychange`
pauses the run and parks the music when a call arrives, and short vibrations fire on damage
and death (Android only — iOS has no Vibration API). `tools/build.mjs` assembles `dist/site`,
which is the whole installable app: the bundled page, a manifest with maskable icons, and a
service worker whose cache name carries a hash of the bundle, so every deploy lands in a
fresh cache and plays with the network gone. `tools/mobile.mjs` guards all of it.

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

**Puzzle scoring was unwinnable, and speed was the only lever.** Reported from play: a
puzzle solved with full knowledge of the layout still landed below 40%. It was not
difficulty — the maths made the top tier unreachable. Puzzle par was 832 while the best
score the formula could produce, with an instant solve and every guard killed, was 763:
a ceiling of top 31%. A realistic 75-second solve scored top 39%, right on the failure line.

Two things changed. Scoring weights are now per trial type rather than one global formula
(`SCORE` in `arena.js`): puzzles weight completion at 0.92 of par, cut the time bonus to a
third of its old value, and add a `flawless` bonus worth 10% of par for finishing untouched.
Care now outscores speed, which is what the trial is actually about. Par for puzzle, word,
hide, deliver, seek and boss came down to put the ceiling back in reach.

Partial credit was added so progress is never worth nothing: stones already on their marks
score even on a timeout, and hints found score even if the riddle goes unanswered.

The word puzzle also had dead code — a bonus for answering on fewer hints that could never
trigger, because the UI hid the answer buttons until all three were found. The buttons are
now always available, so answering early is a real gamble that pays 6% of par per unfound
hint.

The regression guard is a test that constructs a flawless run and a scrape-through run for
every trial type and asserts the first reaches the top 25% while the second does not. That
is the check that would have caught this before it shipped.

**Swings missed things that plainly looked in front of you.** Reported from play, and the
cause was perspective, not tuning. The world's Y axis is squashed to 0.62 on screen for the
3/4 view, so a target's *world* angle differs from the angle the player *sees* by up to 13.6
degrees at around 52 degrees off-axis — 41% of the sword's 33-degree half-arc, spent before
the swing even started. Hit tests ran in world space, so diagonal targets fell outside an
arc that visibly contained them.

Three changes. `U.inArcVisual` runs the arc test in squashed screen space for both the
player and enemies, so what looks in front is in front. `Player.aimAssist` gives a soft
lock-on: on the swing, facing snaps to the best target within a 57-degree cone — there is no
held lock, you still aim with the stick, but a target that reads as yours counts as yours.
And the melee arcs widened (sword 1.15 to 1.5 radians, scythe 1.42 to 1.75, axe 1.5 to 1.8)
with a little more reach.

**The weapon sweeps rather than pivots.** It used to rotate on the spot beside the body. It
now travels a real arc *around* the character: winding back through the wind-up, then
whipping through the full sweep, alternating direction each swing so consecutive attacks
read as back-and-forth. The sweep width is taken from the weapon's own hit arc, so the
animation and the hitbox agree.

**Garatu is an angelic thing, not a demon.** He appears on the title screen, in the abduction
cutscene and on the reset screen, and those screens draw him straight onto the full-resolution
canvas at an integer scale rather than through the world buffer, which keeps the pixels square
without making the surrounding text chunky.

He was a red winged demon, which was the wrong monster for what he does. The premise is that
something beautiful takes you off an ordinary street and puts you in a spectacle for other
people's entertainment — and a red demon reads as a villain in the first frame, so there is no
contradiction left to feel. He is bone feathers, coral growth and one red eye now, and the
horror is that he looks like that while saying *"There you are."*

He is deliberately **not** the Aurelith, and the silhouette is what keeps them apart:

- The Aurelith fans four pairs of wings into a **starburst**. Garatu has one great pair that
  sweeps up and curls inward into an **arch** over his head, a short pair thrown wide and low,
  and two ribbons trailing off him.
- Garatu is 58×62 against the Aurelith's 63×68. He is the herald, not the ending.
- The Aurelith burns a square core; Garatu carries a slit. The ending gets the bigger heart.

Two things the colour change broke elsewhere, both worth naming because neither is about the
sprite:

- **Alpha tuned for a dark sprite does not survive a pale one.** The title screen drew him at
  0.34 and the reset screen at 0.28, which read fine for a dark red shape against a lit sky.
  Bone at 0.34 over that purple just goes grey and muddy. They are 0.66 and 0.5 now — still
  short of solid, because he is watching rather than present.
- **A fixed lift plus a bottom-centre anchor is a latent clipping bug.** The rift and fall
  cutscenes lifted him by a constant, so the moment the sprite got 12px taller his crown went
  through the top of the frame. Both now take the height from the sprite and clamp, so the
  next time he changes size nothing needs to be re-tuned by hand.

**The old vector renderer is gone.** Converting the cast to sprites left `art.js` carrying a
whole second, unreachable way of drawing every character: the `chibi` rig, `Art.RIG`, the
vector weapons and `drawPlayer` / `drawGoblin` / `drawMinotaur` / `drawReaper` /
`drawAurelith` / `drawGaratu`, plus `drawRelic`, `drawCoin` and `drawHintGlyph`. Nothing
outside the module called any of them — they only called each other, which is exactly how
dead code survives a grep. `art.js` went from 658 lines to 232, and what is left is the part
that was never sprite work: the primitives, the ground props and the gem. The bedroom and
hub interior furniture is the only art still unconverted.

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
