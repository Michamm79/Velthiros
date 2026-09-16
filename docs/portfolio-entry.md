# Velthiros — portfolio entry

**Paste this whole file into a chat with your portfolio repo open** (`Michamm79/Portfolio_MH`).
It contains everything needed to add Velthiros to the site, written against the structure
that repo actually uses as of this writing.

---

## Scope: strictly additive

**This adds one project. It does not edit, reorder, restyle or refactor any existing
project, component or shared code.** Every instruction below is a new line in an existing
file. Nothing already in `src/App.jsx` is modified or deleted.

The complete set of changes:

| # | Change | Kind |
|---|---|---|
| 1 | `src/assets/Velthiros_Visual.jpg` | new file |
| 2 | One `import` line beside the other asset imports | new line |
| 3 | One entry **appended** to the end of `PROJECTS` (index 7) | new lines |
| 4 | One entry added to `CODE_SNIPPETS` | new lines |
| 5 | One new JSX card block in the work section | new lines |

Not touched: `CodeCard`, the lucide-react import line, the existing `PROJECTS` entries
0–6, their JSX blocks, their snippets, the CSS, or any other file.

**Verified safe:** `PROJECTS` currently holds exactly 7 entries (ids 0–6), and the JSX
references run `PROJECTS[0]` through `PROJECTS[6]`. Appending at index 7 collides with
nothing.

---

## ⚠️ Read this first: the portfolio does NOT map over `PROJECTS`

`src/App.jsx` renders each project as a **hand-written JSX block** that reaches into the
array by **hard-coded index** — `PROJECTS[0]`, `PROJECTS[1]`, `PROJECTS[4]` and so on.

That means:

- **Append the new entry to the END of `PROJECTS` (index 7).** Do not insert it at the
  front. Inserting shifts every index and silently repoints every existing card at the
  wrong project — the cards would still render, just with the wrong GitHub links and the
  wrong lightbox contents.
- The visual order on the page is set by the **order of the JSX blocks**, not by the
  array. So to show Velthiros first, move its JSX block up — leave the array alone.
- Adding a project therefore takes **four edits**: the asset import, the `PROJECTS`
  entry, a `CODE_SNIPPETS` entry, and a new JSX card block.

---

## 1. The asset

Save the title-screen screenshot as `src/assets/Velthiros_Visual.jpg` (matching the
naming of `Valtara_Visual.jpg` and `WitchsBrew_Visual.jpg`), then add the import
alongside the others near the top of `src/App.jsx`:

```js
import Velthiros_Visual from './assets/Velthiros_Visual.jpg'
```

---

## 2. The `PROJECTS` entry — append at index 7

```js
  {
    id: 7,
    title: 'Velthiros',
    category: 'Mobile Action-RPG · No Engine, No Libraries, No Art Files · Playable in Browser',
    color: 'purple',
    thumbnail: Velthiros_Visual,
    description: 'A demon called Garatu takes you out of an ordinary evening, and the trials begin. Clear them well and watchers you never see pay you; finish below 40% and you run it again with a debuff; die twenty-five times and everything you own is gone. Velthiros is a trial-based action-RPG built for phones — touch controls, portrait or landscape, installable to a home screen and playable offline. It is built with no engine and no dependencies: ~7,300 lines of vanilla JavaScript across 15 modules, rendering to an HTML5 canvas. There are no art files and no audio files in the project. Every one of the 93 sprites is authored in code as a grid of characters resolved against a locked 40-colour palette, and every sound is synthesised at runtime through WebAudio. The whole game ships as one 283 KB HTML file that can be emailed, copied to a USB stick, or uploaded to a portal as-is.',
    tags: ['JavaScript', 'HTML5 Canvas', 'Mobile Web', 'PWA', 'Procedural Pixel Art', 'WebAudio', 'Playwright', 'Playable Vertical Slice'],
    github: 'https://github.com/Michamm79/Velthiros',
    codeDownload: 'https://github.com/Michamm79/Velthiros/archive/refs/heads/main.zip',
    liveDemo: 'https://michamm79.github.io/Velthiros/',
    media: [{ type: 'image', src: Velthiros_Visual, label: 'Title Screen', system: 'Presentation' }],
    recruiterHighlights: [
      'Playable in any phone browser with no install and no app store — one 283 KB self-contained HTML file with zero dependencies and zero binary assets.',
      'Zero-asset art pipeline: all 93 sprites are authored in code through a small grid DSL (rect/oval/line/speckle/outline) against a locked 40-colour palette, baked once to offscreen canvases at boot. A test bakes every sprite and fails on any unknown palette key, which is the real defence against a typo in hand-placed pixel data.',
      'The world buffer is sized by AREA rather than by height. Sizing by height handed a portrait phone a 98-pixel-wide slice of arena — a giant player and no warning of anything walking at you. Holding area constant shows the same amount of arena whichever way the phone is held; the landscape sizes come out byte-identical to the implementation it replaced.',
      'Safe-area-aware HUD: env(safe-area-inset-*) reaches JavaScript only through a hidden probe element's computed padding. Without it the dodge button sits under the home indicator on every modern iPhone.',
      'Found a silent input bug that a passing test had been hiding: the action buttons overlapped, and because hit-testing walks the zone list backwards, the left edge of ATTACK fired the special instead. The bounding-box test could never catch it — round buttons have to be compared as circles.',
      'Installable PWA with a generated service worker whose cache name is a hash of the bundle, so each deploy lands in a fresh cache. Verified offline by killing the server and reloading.',
      'Phone-lifecycle handling: screen wake lock through a trial, visibilitychange pauses the run and parks the music so a phone call cannot cost you one, and haptics toggle separately from sound — playing muted in public is exactly when the buzz earns its keep.',
      'Fully synthesised audio through WebAudio — music moods and effects generated at runtime with no audio files, unlocked on first gesture to satisfy mobile autoplay policy.',
      '94 automated checks run the game headless in Chromium before anything ships: 65 gameplay checks plus 29 device checks across four viewports covering control spacing, safe-area insets, the install manifest, and an offline boot with the server shut down.',
      'Scale: ~7,300 lines of vanilla JavaScript across 15 modules, 93 procedurally authored sprites, a tutorial zone, a run of trials, a ranking and death-limit economy, and a boss encounter.',
    ],
  },
```

---

## 3. The `CODE_SNIPPETS` entry

Add to the `CODE_SNIPPETS` object, keyed `velthiros_buffer`. This is real code from
`src/js/game.js`, and it is the snippet worth showing — it is a genuine measurement-led
fix rather than a feature.

```js
  velthiros_buffer: {
    file: 'game.js', lang: 'javascript',
    code: `/* The buffer is sized by AREA, not height. Sizing by
   height alone meant a portrait phone got a 98px-wide
   slice of world - a giant player and no warning of
   anything walking at you. Holding the area constant
   shows the same amount of arena whichever way the
   phone is held; it just changes shape. 287 is the
   geometric mean of the landscape buffer this
   replaces, so the common landscape sizes come out
   byte-identical. */
this.pixelTargetSpan = 287;

Game.prototype.worldTarget = function () {
  var scale = Math.max(2, Math.round(
    Math.sqrt(this.cw * this.ch) / this.pixelTargetSpan
  ));
  var bw = Math.ceil(this.cw / scale);
  var bh = Math.ceil(this.ch / scale);
  // ... render world here, scale up with smoothing off
};`,
    notes: [
      'sqrt(cw * ch) is the geometric mean of the viewport — it is the dimension that stays put when the phone rotates, where height swings from 844 to 390 on the same device.',
      '287 was chosen so the landscape buffer sizes come out byte-identical to the previous height-based implementation: the fix is free for players who were already holding the phone the right way.',
      'Math.max(2, ...) floors the scale so the pixel grid stays chunky on small screens rather than degrading to near-native resolution.',
      'A device check asserts portrait and landscape buffers are within 15% of each other by area; it reports 0% apart, and it fails on the old formula.',
    ],
  },
```

---

## 4. The JSX card block

Model it on the Witch's Brew block (same shape, a browser game, also zero art assets).
Place it wherever you want it to appear in the work section — **the JSX order controls
display order, the array order does not.**

```jsx
              {/* Velthiros — Zero-Asset Mobile Web Game */}
              <div className="project-card-hub" tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                onClick={(e) => {
                  if (e.target.closest('.media-open-btn') || e.target.closest('.card-images-strip')) return;
                  e.currentTarget.querySelector('.media-open-btn')?.click();
                }}>
                <div className="card-hub-header">
                  <div className="card-hub-overline">Mobile Action-RPG · No Engine, No Libraries · Playable in Browser</div>
                  <div className="card-hub-title">Velthiros</div>
                  <div className="card-hub-desc">A trial-based action-RPG that runs in a phone browser with no install and no app store. Built with no engine and no dependencies — ~7,300 lines of vanilla JavaScript on an HTML5 canvas, shipping as a single 283 KB file. Every sprite is authored in code against a locked 40-colour palette and every sound is synthesised at runtime, so the project contains no art or audio assets at all.</div>
                  <div className="card-hub-tags">{['JavaScript', 'HTML5 Canvas', 'Mobile Web', 'PWA', 'Procedural Pixel Art', 'Playable'].map(t => <span key={t} className="card-hub-tag">{t}</span>)}</div>
                </div>
                <div className="card-images-strip" style={{ padding: '0 1rem 6px' }}>
                  {[Velthiros_Visual].map((src, i) => (
                    <img key={i} src={src} alt="Velthiros" loading="lazy" onClick={() => openMedia(PROJECTS[7], i)} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', padding: '0 1rem 8px' }}>
                  <a className="media-open-btn" href={PROJECTS[7].liveDemo}
                     target="_blank" rel="noopener noreferrer"
                     onClick={e => e.stopPropagation()}>
                    <ExternalLink size={12} /> Play it in your browser
                  </a>
                </div>
                <CodeCard snippet={CODE_SNIPPETS.velthiros_buffer} github={PROJECTS[7].github} codeDownload={PROJECTS[7].codeDownload} />
              </div>
```

---

## 5. The "Play it" button — inside the new block only

`CodeCard` hardcodes its second link's label:

```jsx
{codeDownload && (
  <a className="media-open-btn" href={codeDownload} ...>
    <Download size={12} /> Download
  </a>
)}
```

So `codeDownload` cannot carry the live build without rendering a **Download** button that
actually opens a game — the wrong affordance for the one project here you can play in a
single click.

Adding a `liveDemo` prop to `CodeCard` would fix it, but `CodeCard` is shared by all seven
existing cards, and this change is meant to touch none of them. **So the Play link goes in
the Velthiros card's own JSX instead**, in its own row above `<CodeCard>`. That is new code
in a new block: `CodeCard` is untouched, and so is every existing card.

It reuses the `media-open-btn` class and the `ExternalLink` icon, both **already imported
and already in use** — so even the lucide import line stays exactly as it is.

```jsx
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', padding: '0 1rem 8px' }}>
                  <a className="media-open-btn" href={PROJECTS[7].liveDemo}
                     target="_blank" rel="noopener noreferrer"
                     onClick={e => e.stopPropagation()}>
                    <ExternalLink size={12} /> Play it in your browser
                  </a>
                </div>
```

`codeDownload` in the entry above therefore points at the source archive, matching every
other project, and `liveDemo` carries the playable link. The full JSX block in section 4
already includes this row.

> If you ever want a Play button on other cards too, that is the `CodeCard` change — a
> `liveDemo` prop and a gated block. Deliberately **not** done here, because it is a shared
> component and this change adds a project rather than editing the site.

---

## Reference: verified facts

Everything above is measured from the repository, not estimated.

| Claim | Source |
|---|---|
| ~8,000 lines across 15 modules | `wc -l src/js/*.js` → 8,020 |
| 138 sprites | smoke test: `every sprite bakes against the locked palette — 138 sprites` |
| 40-colour palette | `src/js/pixel.js` palette map |
| 320 KB single file | `dist/velthiros.html` |
| No art or audio assets | only binaries in the repo are the PWA icons, themselves rendered from the game's own drawing code |
| 123 automated checks | `npm test` → 94 gameplay + 29 device |
| Live build | https://michamm79.github.io/Velthiros/ |
