# Launch posts

Copy the one you want. All links point at the live build:
**https://michamm79.github.io/Velthiros/**

Swap that for the itch.io URL once the itch page is up — a store page converts better
than a bare GitHub Pages link, and it gives people somewhere to leave a comment.

---

## LinkedIn — the constraint angle (recommended)

This is the one that fits your profile. It leads with the thing a hiring manager
cares about (decisions under constraint), not with the plot.

> I built a mobile action-RPG that runs in a phone browser. No install, no app store,
> no download — one link.
>
> ▶ https://michamm79.github.io/Velthiros/
>
> The constraint I set myself was no engine, no libraries, no art files.
>
> • ~8,000 lines of vanilla JavaScript across 15 modules. Zero dependencies.
> • All 165 sprites are authored in code as character grids against a locked 82-colour
>   palette. There are no images in the project.
> • Every sound is synthesised at runtime through WebAudio. No audio files either.
> • The whole game ships as one 322 KB HTML file. You can email it.
>
> Three things I did not expect to be the hard parts:
>
> **1. Sizing.** The world buffer was sized by screen height, which handed a portrait
> phone a 98-pixel-wide slice of arena — a giant player and no warning of anything
> walking at you. Sizing by area instead keeps the visible arena constant however the
> phone is held.
>
> **2. Hit-testing.** The action buttons overlapped, and because hit-testing walks the
> zone list backwards, the left edge of ATTACK silently fired the special instead. The
> bounding-box test had been passing the whole time. Round buttons have to be compared
> as circles.
>
> **3. Safe areas.** `env(safe-area-inset-*)` only reaches JavaScript through a hidden
> probe element's computed padding. Without it, the dodge button sits under the home
> indicator on every modern iPhone.
>
> It is a vertical slice, not a finished game — a tutorial, a run of trials, a ranking
> system and a boss. 94 automated checks drive it headless in Chromium across four
> device viewports before anything ships.
>
> Eight years in Unreal and Unity. Building without an engine taught me more about
> engines than I expected it to.
>
> #gamedev #javascript #html5 #indiedev #gameplayprogramming

---

## LinkedIn — the hook angle

Shorter, more curiosity-driven. Better if you want plays over technical credibility.

> You are taken. You fight. Watchers you never see rank you afterwards.
>
> Top 25% gets paid. Below 40% and you run it again, weaker. Twenty-five deaths and
> everything you own is gone.
>
> That is Velthiros, and you can play it in your phone browser right now. No install,
> no store, one link:
>
> ▶ https://michamm79.github.io/Velthiros/
>
> I built it solo with no engine, no libraries and no art files — ~8,000 lines of
> vanilla JavaScript, every sprite authored in code as a grid of characters, every
> sound synthesised at runtime. It ships as a single 322 KB HTML file that also
> installs to a home screen and runs offline.
>
> It is a vertical slice rather than a finished game, but it is a real one: a tutorial,
> trials, a ranking system, a boss, and 94 automated checks that play it across four
> device viewports before anything ships.
>
> Tell me where it loses you. That is the useful feedback.
>
> #gamedev #indiedev #javascript #html5

---

## X / Bluesky / Mastodon

> Built a mobile action-RPG that runs in a phone browser. No install, no store.
>
> No engine, no libraries, no art files — ~7.3k lines of vanilla JS, every sprite
> authored in code, every sound synthesised at runtime, the whole thing one 322 KB
> HTML file.
>
> ▶ https://michamm79.github.io/Velthiros/

---

## itch.io / portal short description

Store pages cut the description off fast, so the first sentence carries it.

**Tagline (one line):**
> Abducted, ranked, and paid by watchers you never see. A mobile action-RPG that runs
> in your browser.

**Short description:**
> Garatu takes you, and the trials begin. Clear them well and the watchers pay you.
> Finish below 40% and you run it again, weaker. Die twenty-five times and everything
> you own is gone.
>
> A trial-based action-RPG built for phones: touch controls, portrait or landscape, and
> it installs to your home screen and plays offline. No engine, no libraries, no art
> files — every sprite is authored in code against a locked 82-colour palette.
>
> This is a vertical slice: a tutorial, a run of trials, a ranking system and a boss.

---

## Posting notes

- **Post the link as a comment, not in the body.** LinkedIn suppresses reach on posts
  with external links. Put the post up, then drop the URL in the first comment and edit
  the body to say "link in the comments".
- **Lead with an image or a short video.** The title screen works; a 10–15 second screen
  recording of an actual fight works better. Native video outperforms a link preview.
- **Tuesday–Thursday, 8–10am in your audience's timezone** is the usual sweet spot.
- **Reply to every comment in the first two hours.** That window decides distribution.
