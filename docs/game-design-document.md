# Velthiros — Game Design Document

**Status:** Draft v0.2 — for team onboarding
**Genre:** Mobile Action-RPG (trial-based, roguelite structure)
**Platform:** Mobile (iOS/Android)
**Engine (proposed):** Unity / C# — *assumption, confirm with team*
**Camera:** 3/4 isometric
**Controls:** Virtual joystick + action buttons
**Monetization:** Free-to-play, no monetization systems at this stage
**Multiplayer:** Single-player only (current scope)
**Demo scope:** ~50 trial areas

---

## 1. High Concept

The player is abducted from their everyday life by a demonic entity, Garatu, and forced to compete in a recurring series of survival "trials" for the entertainment of unseen watchers. Between trials, the player returns to a home base to spend earned currency and prepare for the next challenge. Failure sends them back to the start of the trial they died on; underperforming risks debuffs; only the top performers are rewarded. A hidden endgame path leads through escalating waves of monsters to a final boss encounter.

Visual style takes cues from *The Legend of Zelda: Minish Cap* — bright, chibi-proportioned characters (stout, Mario-like body ratios), rendered in 3/4 isometric perspective.

---

## 2. Story & Premise

- **Setting:** The player lives in an apartment on one floor of a city skyscraper.
- **Opening sequence:** Game opens on the player's bedroom. The player can walk around but cannot interact with objects — this is a mood-setting intro, not a tutorial.
- **Inciting incident:** A demonic winged figure (**Garatu**) appears through a teleportation gate and abducts the player. Screen fades to black.
- **Arrival:** Screen fades back in on a large circular grassy plain, ringed by a wall of trees the player cannot pass. Bushes are scattered throughout for hiding.
- **Garatu's line (first trial):** *"This is the first of many trials, we hope you can entertain us more."*
- **Framing device:** Garatu (and unseen others — "we") treat the trials as a spectacle.

**Still being fleshed out (per design):**
- Full narrative arc beyond the trial loop — noted as in-progress, not blocking early production.

---

## 3. Core Gameplay Loop

1. Player is in home hub (post-first-trial).
2. Player optionally visits **Reality Shop** and/or **Trial Shop**.
3. Player confirms readiness → enters trial arena.
4. Arena environment and objective are generated/selected (see Trial System).
5. Player completes objective within time/condition limits.
6. Ranking is calculated → reward, no reward, or debuff+restart is applied.
7. Ranking summary screen → Continue → return to hub.
8. Repeat. Every **5th trial**, a boss (Reaper) encounter occurs instead of a standard trial.

---

## 4. Screen & Flow List

| Screen | Purpose |
|---|---|
| **Start Screen** | "New Game" and "Continue" buttons, stacked vertically |
| **Bedroom (Intro)** | Walkable, non-interactive. Sets tone before abduction cutscene. |
| **Abduction Cutscene** | Garatu appears, kidnaps player, fade to black/in |
| **Trial Arena** | Core gameplay space; varies by trial type and environment skin |
| **Ranking Screen** | Shown after each trial; shows placement, reward/debuff outcome |
| **Home Hub** | Bedroom, now functions as hub with access to both shops |
| **Reality Shop** | Clothes, room decor, and business investments (real-world benefit) |
| **Trial Shop** | Trial-benefiting purchases (consumables, gear, etc.) |

---

## 5. World & Environments

- **Arena shape:** Circular map. At full movement speed, player crosses from one edge to the opposite edge in ~30 seconds — use this as the baseline for map radius/scale tuning.
- **Containment:** Ring of trees (or environment-appropriate barrier) prevents the player leaving the arena bounds.
- **Cover:** Bushes are placed throughout for the hiding mechanic (used in Hide & Seek trials, and situationally in others).
- **Environment skins:** Snowy, Village, Enemy HQ, Plains, Forest, City, Desert *(room to expand)*.

---

## 6. Trial System

### 6.1 Trial Types

| Type | Description |
|---|---|
| **Defeat Enemies** | Kill a target number of enemies, or as many as possible within a time limit |
| **Puzzles** | **Physical** (move objects to correct locations, minimal hinting) or **Word** (answer a question, hints found by exploring the map) |
| **Defend** | Hold a defined area, fending off enemies from all sides to protect NPCs/materials |
| **Collect & Deliver** | Retrieve an item and bring it to a delivery point while under attack |
| **Hide & Seek** | (a) player hides from hunting enemies, may kill pre-emptively or avoid entirely; (b) enemies hide, player must find and defeat all of them |

### 6.2 Ranking & Outcomes

| Tier | Outcome |
|---|---|
| **Top 25%** | Survive + receive reward |
| **26–40%** | Survive, no reward, no debuff |
| **Below 40%** | Fail — restart from the previous trial, **potential debuff** applied on the reattempt |

- Death during a trial, for any reason, sends the player back to the **start of that trial** (not further back), same as a below-40% ranking failure.

---

## 7. Combat System

### 7.1 Weapons

| Weapon | Damage | Speed | Range | Stamina Cost | Notes |
|---|---|---|---|---|---|
| **Sword** | Medium | Medium-fast | Short (melee) | Low | Balanced all-rounder, no major weakness — the "safe" starter choice |
| **Battleaxe** | High (~1.5–2x sword) | Slow | Short-medium (wide arc) | High | Hits multiple enemies per swing; long wind-up leaves player exposed; poor mobility while wielding |
| **Bow** | Medium-low per hit | Medium (draw time) | Long | Medium | Best for kiting; weak in melee if enemies close the distance, no blocking |
| **Scythe** *(semi-hidden)* | Medium-high | Medium | Medium (melee, wide arc) | Medium | Secret weapon available from the very start of the game, mitigating the weaknesses of the other three — solid damage, no crippling wind-up, no melee-only or ranged-only limitation. Levels up alongside the player like the other weapons once unlocked. |

#### Scythe Unlock Mechanic

- The scythe exists from the beginning of the game, but is **locked** until discovered.
- **Trigger:** The player must sit idle on the main Start Screen (New Game / Continue, etc.) for **5 minutes**.
- After 5 minutes of idling, a **distinct on-screen button sequence** appears as a prompt.
- Entering the correct sequence unlocks the scythe **for the rest of that game run**.
- **Reset conditions** — the unlock is lost and must be rediscovered if:
  - The current run ends
  - The player starts a New Game
  - The player dies too many times, triggering a full game restart (**25 total deaths** in the current run — see Section 9 for what a full reset wipes)
- On any of the above reset conditions, the required button combination changes to a new one, randomly selected from **10 preset combinations**.

### 7.2 Enemy Roster

| Enemy | Role |
|---|---|
| **Goblins** | Standard/common enemy, appear across most trial types |
| **Minotaurs** | Difficulty spike enemy, introduced as the player levels up |
| **Reapers (scythes)** | Boss-tier enemy, appears every 5th trial |

### 7.3 Stealth/Hiding

- Bushes let the player break enemy detection; hidden players are not attacked.
- Central to Hide & Seek trials, available tactically elsewhere (e.g., avoiding a fight in Collect & Deliver).

---

## 8. Power Gem System

Received once, during the tutorial (first trial), fully random with no player input. Levels up as the player progresses.

| Function | Name |
|---|---|
| Attack/Defense boost | **Emberstone** |
| Health/Stamina boost | **Rootstone** |
| Dodge/Movement speed boost | **Galeshard** |
| Jump/Glide ability | **Wingshard** |
| Ranged weapon power | **Stormshard** |
| Hidden/missed hit chance boost | **Duskveil** |

*(Names above are working titles — easy to swap later if the team wants something different.)*

---

## 9. Economy & Progression

- **Currency:** One shared currency across both the Reality Shop and Trial Shop.
- **Reality Shop:** Clothes, room decor, and **business investments** — 5 total investment options that generate passive income for the player over time without further action.
- **Trial Shop:** Trial-benefiting purchases (consumables, temporary gear). Specific contents still TBD.

### Full Game Reset

- Accumulating **25 total deaths** in a run triggers a full game restart.
- A full reset wipes **everything**: currency, gem levels, shop purchases, and any unlocked weapons (including the scythe, which reverts to locked with a new random button combination).
- Player returns to the Start Screen as if beginning fresh.

---

## 10. Endgame

- Endgame concept (not yet fully fleshed out): the player fights through escalating **waves of monsters** to reach a final boss encounter.
- **Final boss visual reference (provided):** A tall, pale humanoid figure with multiple large white-feathered wings spread wide. Dark, insectoid/carapace-like torso and legs with a web-like pattern, marked with clusters of orange-red spotted growths along the shoulders and chest. A single red gem/eye set into an elongated pale head. Twin red-eyed sockets lower on the chest/abdomen. Stands atop rippling water, with faint X-shaped blade/bone fragments floating near the hips. Overall tone: ethereal but unsettling — angelic silhouette with a corrupted, insect-like core.
- Boss name and full endgame structure (how many waves, what escalates, victory condition) still to be defined.

---

## 11. Art Style

- Reference: *The Legend of Zelda: Minish Cap* — bright, storybook-ish aesthetic.
- Character proportions: stout, similar to classic-era Mario — short limbs, oversized head-to-body ratio.
- Camera: confirmed 3/4 isometric.

---

## 12. UI Notes

### Start Screen
- "New Game" and "Continue" buttons, vertically stacked.

### Trial HUD
- **Top-middle:** Timer
- **Top-left:** Health and stamina
- **Bottom-right:** Primary attack button, with a slightly smaller special attack button positioned next to it
- **Bottom-left:** Movement (virtual joystick)

### Ranking Screen
- Shows placement result and a single "Continue" action back to the hub.

---

## 13. Technical Notes

- **Engine:** Unity (C#) proposed as the default, given team background and fit for isometric mobile action-RPGs. Confirm before locking in.
- **Controls:** Virtual joystick (bottom-left) for movement + on-screen action buttons (bottom-right) for attacks/specials.
- **Monetization:** None at this stage — free-to-play with no IAP, ads, or gacha systems planned yet.

---

## 14. Open Questions for the Team

- [ ] Final boss name and full endgame wave/victory structure
- [ ] Trial Shop specific contents
- [ ] Currency name and exact earn rates
- [ ] Weapon numeric stat tuning (exact damage/speed values, once ready for implementation balancing)
