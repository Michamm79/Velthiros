# Velthiros — press kit

**Play it:** https://michamm79.github.io/Velthiros/

---

## Teaser

`teaser-grayson-1600.png` — 16:9, 1600×900.

Regenerate at any width with `node tools/teaser.mjs <width>` (`OUT=path.png` to choose the
file). Same rule as the cover: it is composed from the game's **own sprites and palette**, so
it cannot promise a look the game does not deliver. The hero is wearing **Grayson**, the suit
you have to find; the Aurelith looms behind him at the same scale it fights you at, held back
in brightness rather than in size.

Both pieces are deliberately quiet: no weapon, no effects, just the armour. Grayson is the
whole subject of the frame, and nothing else in it competes with him.

---

## Reference sheets

`armour-sheet.png` — all four suits, three views each.
`weapon-sheet.png` — all four weapons, upright and to scale with one another.

Regenerate both with `node tools/sheets.mjs` (`node tools/sheets.mjs 20` for a chunkier
scale, `OUT_DIR=path` to choose where). Like the cover, they are drawn from the game's own
sprite functions and its own shop list — a suit cannot appear on the sheet without being
buyable, and the sheet cannot show a version of a weapon the game does not draw.

Two things the sheets make visible on purpose:

- **Three views, not one.** A front-only sheet hides the back and the silhouette, which is
  exactly where garments go wrong at 18×28.
- **Weapons to scale with each other.** The cell is sized off the largest weapon rather than
  fixed, so the axe and the scythe are not cropped and the size comparison is honest. They
  are authored lying down, because that is the angle the game pivots them from; they are
  stood up here. The bow is the exception — it is authored the way it is held.

---

## Cover art

`cover-1024.png` — square, 1024×1024.

Regenerate at any size with `node tools/cover.mjs <size>` (`OUT=path.png` to choose the
file). It is composed from the game's **own sprites and palette** rather than drawn
separately, so the cover cannot drift away from what the game actually looks like — the
Aurelith and the hero on it are the same sprites you meet in the game, at a whole-number
scale.

The hero wears **Grayson**. The looming figure is the **Aurelith**, the game's last fight;
it replaced Garatu there because Garatu is a red demon by construction and the cover wanted
to be cold. The only warm thing left in frame is the Aurelith's core.

What is in the frame, and why:

- **The Aurelith**, large and looming. The thing waiting at the end of the fifty trials,
  drawn as a mass rather than as detail so the eye still lands on the hero.
- **Eyes in the dark**, dozens of them, dimmer toward the edges. The premise is that unseen
  watchers score every run, and by definition they have no sprite — so they are eyes, and
  they are everywhere.
- **The city**, because the abduction happens off an ordinary street. It is what he is
  taken from.
- **The hero, small, in a ring of light.** The only bright thing in the picture, and
  deliberately dwarfed by everything above him. That is the game.

---

## The description

### One line

> Abducted by a demon, graded by an audience you will never see. Get good, or get poor.

### Short (store blurb, ~90 words)

> You were having a perfectly normal evening. Then Garatu showed up, and now you are in
> the trials.
>
> Watchers you will never meet score every run. Finish in the top 25% and they pay you.
> Come in under 40% and you go again — same trial, except now you are weaker, because
> apparently that is entertainment. Die twenty-five times and they take everything you own.
>
> So you get good, or you get poor.
>
> Runs in your phone browser. No download, no store, no install.

### Long (the full pitch)

> You were having a perfectly normal evening. Then Garatu showed up, and now you are in
> the trials.
>
> Here is the arrangement. Somewhere out there, watchers you will never meet are scoring
> every single run you make. Finish in the top 25% and they pay you in Vel. Land in the
> middle and you survive with nothing. Come in under 40% and you go again — same trial,
> except now you are carrying a debuff, because apparently that is entertainment. Die
> twenty-five times across the whole run and they take everything you own. Gems, gear, the
> lot. Gone.
>
> So you get good, or you get poor.
>
> Fifty trials, and they do not all want the same thing from you. Some want a body count.
> Some want you to hold a patch of ground while it is actively being taken off you. Some
> hide a relic somewhere and expect you to go and find it. One wants you to solve a riddle.
> One just wants you to not be seen, and being seen is the entire failure condition.
>
> You start with a sword. There is an axe and a bow if you save up. And there is a scythe
> that is not for sale at any price, that nobody will tell you about, and that you will
> only ever hold if you work out what the start screen is waiting for.
>
> Drag anywhere to move, tap to swing, dodge like you mean it. It is a real action-RPG that
> happens to live in a browser tab — click the link and you are in, on a phone, with no
> download and no app store between you and it. Add it to your home screen and it works
> with the wifi off.
>
> They are watching. Give them something to score.

---

## Facts

| | |
|---|---|
| Genre | Trial-based action-RPG |
| Platform | Any browser; built for phones. Installs as a PWA, plays offline |
| Controls | Touch (drag to move, tap to attack/dodge) or keyboard |
| Content | 50 trials across 9 types, 4 weapons, 6 enemy types, a tutorial and two bosses |
| Currency | Vel (◆) |
| Rules | Top 25% paid · under 40% repeats with a debuff · 25 deaths wipes the run |
| Built with | Vanilla JavaScript and HTML5 canvas. No engine, no libraries |
| Size | One self-contained 322 KB HTML file, no external assets |
| Art | All 165 sprites authored in code against a locked palette |
| Audio | Synthesised at runtime through WebAudio; no audio files |
| Status | Playable vertical slice |

## Screenshots

Generate fresh ones straight from the game rather than keeping stale copies here:

```
node tools/cover.mjs 1024          # the square cover
```

The title screen and in-game shots are easiest to grab by opening
`dist/velthiros.html` and using the browser's own screenshot tool, at a phone-shaped
window for portrait shots and a wide one for landscape.
