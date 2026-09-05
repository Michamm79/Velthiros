# Velthiros

A playable vertical slice of the mobile action-RPG described in
[`docs/game-design-document.md`](docs/game-design-document.md).

Abducted by a demon called Garatu, ranked after every trial by watchers you never see.
Top 25% gets paid, below 40% you run it again with a debuff, and 25 deaths wipes everything
you own.

**Built as an HTML5 canvas game** — it runs in a phone browser with touch controls, no install
and no app store. See [Why web and not Unity](#why-web-and-not-unity) below; the design port
to Unity is unaffected by this choice.

---

## Play it

- **Phone / tablet:** open `dist/velthiros.html` in any browser. Landscape is best; portrait works.
- **Desktop:** same file, or `npm run serve` and visit `http://localhost:8080`.
- Everything is one file with no dependencies — you can email it, drop it on a USB stick, or
  upload it to itch.io as-is.

Controls:

| Action | Touch | Keyboard |
|---|---|---|
| Move | drag anywhere on the left half | `WASD` / arrows |
| Attack | `ATK`, bottom-right | `J` / `Space` |
| Special | the smaller button beside `ATK` | `K` |
| Dodge | `DODGE` | `L` / `Shift` |
| Use item | `ITEM` | `Q` |
| Pause | `| |`, top-right | `Esc` |

Progress saves automatically to the browser, so **Continue** works across sessions.

---

## Working on it

```bash
npm run serve    # http://localhost:8080 - live source, no build step
npm run build    # bundles src/ into dist/velthiros.html and dist/artifact.html
npm test         # headless Chromium: 29 checks + screenshots into tests/shots/
```

`npm test` boots the real game, taps the real drawn buttons, drives a scripted bot through a
full trial, and fails on any console error. It also writes screenshots of every screen to
`tests/shots/` — those are the fastest way to see what changed.

Useful URL flags while developing:

| Flag | Effect |
|---|---|
| `?idle=10` | shortens the 5-minute scythe idle timer to 10 seconds |
| `?trial=23` | New Game drops you straight into the hub at trial 23 |
| `?smooth=1` | turns off pixel rendering, back to the smooth vector look |
| `?debug=1` | shows an FPS counter |

### Layout

```
index.html            dev entry point, loads src/js/*.js in order
src/css/style.css     page chrome around one full-bleed canvas
src/js/
  util.js             math, seeded RNG, formatting
  data.js             ALL design data - weapons, gems, enemies, shops, trials, riddles
  save.js             localStorage run state + resolved player stats
  input.js            pointer/keyboard, virtual joystick, button hit-zones
  audio.js            procedural WebAudio SFX and music (no audio files)
  art.js              every sprite, drawn procedurally on canvas
  entities.js         player, enemy AI, projectiles
  arena.js            trial generation, objectives, scoring, world rendering
  ui.js               UI widgets + the trial HUD
  scenes.js           start / bedroom / cutscene / hub / shops / ranking / endings
  game.js             loop, scene switching, progression rules
tools/build.mjs       single-file bundler
tools/smoke.mjs       headless playtest
docs/                 the design document + an implementation map
```

**Tuning happens in `src/js/data.js`.** Weapon damage, enemy stats, shop prices, gem effects,
debuffs and the scythe combos are all there as plain data. Trial difficulty curves and the
ranking par values live in `src/js/arena.js` (`tier()` and the `this.par =` lines).

---

## What's in this version

Everything in the design document that the demo scope implies, minus the open questions:

- Start screen, bedroom intro, abduction cutscene, ranking screen, hub, both shops
- 50 trials, a Reaper every 5th, then a 3-wave endgame and a final boss
- All 7 trial types (Defeat, Defend, Collect & Deliver, physical Puzzle, Word puzzle, Hide, Seek)
- All 7 environment skins on a circular arena you cross in ~18 seconds (see the deviations below)
- 4 weapons with distinct feel and specials; the scythe hidden behind the 5-minute idle unlock
- All 6 power gems, granted at random once and levelling with you
- Ranking tiers exactly as specified, debuffs on failure, 25 deaths wipes the run
- Goblins, Minotaurs, Reapers, the final boss drawn from your reference image
- Bush hiding that actually breaks enemy detection

A section-by-section map of GDD to code, plus the ambiguities I had to resolve, is in
[`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md).

### Playtest changes that deviate from the GDD

Three deliberate departures, all reversible from one place each:

- **The scythe combo is pinned.** `D.FIXED_COMBO_INDEX` in `src/js/data.js` is set to `0`
  (up, up, down, down, left, right) so it never changes between runs while the game is
  being tested. Set it to `null` to restore the GDD's random draw from ten presets.
- **Everything moves much faster.** The GDD's 30-second arena crossing felt sluggish in
  play, so the player went from 60 to 140 units/sec, the arena from 1800 to 2500 units
  across (~18s edge to edge), and every enemy speed, attack wind-up and projectile was
  scaled to match.
- **The art is pixel-rendered, and characters are less chibi.** The world draws into a
  low-resolution buffer that is scaled up with no smoothing; the HUD stays full
  resolution so text is readable. Character proportions moved from roughly 1:2 head-to-body
  to about 1:3, which survives being drawn at buffer resolution. `Art.RIG` in
  `src/js/art.js` holds every proportion in one object.

### Not in this version

- No monetisation (per the GDD) and no multiplayer
- Narrative beyond the trial framing — the GDD flags this as still being written
- Clothes are a colour swap rather than modelled outfits
- No per-trial hand-authored layouts; every arena is procedurally generated from a seed

---

## Why web and not Unity

The GDD proposes Unity, and that is still the right call for a shipping iOS/Android build.
This slice is web so that it is **playable immediately, by anyone, with a link** — no editor,
no build pipeline, no TestFlight, no device provisioning. It exists to answer "does this design
feel good to play?" while that question is still cheap to answer.

Nothing here blocks the Unity port. The design data in `data.js` maps directly to
ScriptableObjects, the trial objective logic is engine-agnostic, and the tuning numbers carry
over as-is.

---

## Next versions

Rough order of value:

1. Tune from real play — weapon feel, enemy aggression and the ranking curve are all first-pass
2. Answer the GDD's open questions (currency name, Trial Shop contents, endgame structure)
3. Hand-authored arena set-pieces for the boss trials and the endgame
4. Sprite art to replace the procedural drawing, once the character designs are locked
5. Unity port, if and when this feels right
