# Velthiros — narrative proposal

This is a draft to argue with, not a bible. Every idea in it is chosen so that
**it costs nothing to build**: it connects things the game already contains
rather than asking for new systems. Where something would need new work, that
is called out.

---

## The one idea worth taking

**Reapers are former contestants.**

Four facts are already true in the code, and nobody has joined them up:

| Already in the game | Where |
|---|---|
| A Reaper is the boss of every fifth trial | `game.js` `makeSpec`, `D.BOSS_EVERY` |
| Reapers carry scythes | `sprites.js` `Spr.reaper` |
| The scythe is the game's secret weapon | `D.WEAPONS.scythe`, `secret: true` |
| 25 deaths wipes you and starts a fresh contestant | `D.DEATH_LIMIT`, `Save.fullReset` |

Join them and three things become meaningful for free:

- **Every fifth trial is meeting someone who got further than you and did not
  get out.** The rhythm of the game becomes a rhythm of the story.
- **The secret weapon is something you take off a corpse**, not a reward the
  house hands you. The tutorial's Warden already works this way — you are
  taking a scythe from the thing a previous player became.
- **The 25-death wipe stops being a punishment.** It becomes: *you are not the
  first you.* The `resets` counter that survives a wipe (and seeds the arena
  layouts) is, diegetically, how many of you there have been.

Nothing needs building. It is a reading of the existing structure.

---

## Supporting threads, cheapest first

### 1. Name the field

The ranking screen already tells you what percentile you placed in, which
implies a field of competitors you never meet. Give them names. Three or four
recurring rivals on the results screen, one of whom climbs as you climb, costs
one array and a line of rendering.

Pay-off: the percentile stops being a grade and becomes a scoreboard. When a
name you have been beating stops appearing, you know what happened to them —
and the next Reaper you meet carries the weight of that.

### 2. Garatu as bookmaker, not jailer

Garatu is the only recurring voice in the game. Right now he announces the
trials and vanishes. If he has **money on you**, he has an arc, and it needs no
new systems — only different lines in the existing cutscene slots.

A rough shape:

- **Opening**: he is bored, and picking you was a whim.
- **Around trial 15**: he is interested. Someone else is not.
- **Around trial 35**: he is exposed. He needs you to win now.
- **Endgame**: he is the one who tells you what is underneath, because he is
  the one who stands to lose if you find out.

This turns the endgame cutscene (`CutsceneScene('endgame')`, which currently
exists as two lines) into a payoff instead of a transition.

### 3. The watchers want a style, not a win

The scoring already rewards different things per trial type — speed on Defeat,
care on Puzzle, staying unseen on Hide (`arena.js` `SCORE`). That is currently
invisible spreadsheet design. Make it diegetic: **the audience prefers a show.**

Concretely: the ranking screen's flavour text changes with *how* you won, not
just whether. A flawless quiet Hide reads differently from a bloody one. This
is text, not mechanics — the numbers that would drive it are already computed.

### 4. Aurelith beneath the trials

Two readings, and they are not compatible, so this is the decision to make:

- **Aurelith is what the watchers feed.** The trials are a supply chain. Bleak,
  simple, and makes Garatu a middleman rather than a villain.
- **Aurelith is the previous champion, who stopped losing.** Closes the loop
  with the Reapers: the thing at the bottom is what happens to someone who wins
  fifty trials and keeps going. Your victory condition and your worst outcome
  are the same event.

The second is stronger, and it is the one the Reaper thread already implies. It
also gives the final fight a line worth having: *you are looking at the prize.*

---

## What the tutorial establishes

The opening as built now commits to a few things. Worth knowing before writing
anything else:

- **The player is nobody in particular.** A bedroom, a Friday night, a crowded
  square. There is no chosen-one framing and nothing in the intro suggests one.
- **The abduction is public.** Garatu takes them out of a square full of
  people. Whatever that costs him is a thread available later — somebody saw.
- **The square is reused, emptied.** The tutorial arena is deliberately the
  same place with the life drained out (`D.TUTORIAL_ENVS.square` and
  `.drained` share their geometry and differ only in palette). That is the
  game's whole thesis in one visual: your world, minus everyone in it.
- **The Warden is the first Reaper you meet**, before you know what a Reaper
  is. If the Reaper thread is taken up, the Warden is a contestant too — and
  the tutorial is you doing to someone else exactly what will be done to you.
- **You get one attempt at the Warden.** Dying to it lets you go rather than
  killing you. Under the Reaper reading, that is not mercy: it is a thing that
  used to be a person, deciding it cannot be bothered.

---

## Open questions

1. **Does the player remember the square?** If they can go home at the end, the
   crowd is a person they knew. If they cannot, the square is a thing they lost
   in the first five minutes. The hub is currently their own bedroom, which
   quietly argues for the first.
2. **Do the watchers have faces?** Keeping them off-screen is cheaper and
   probably scarier. Garatu is the only face needed.
3. **What does winning look like?** Fifty trials and the Aurelith is a fight,
   not an ending. If Aurelith is the previous champion, the ending is a choice
   rather than a boss — and that choice is where the game's position on all of
   the above actually gets stated.
