/* Velthiros - static design data (weapons, gems, enemies, environments, shops, trials) */
(function (V) {
  'use strict';

  var D = {};

  /* ---------------------------------------------------------------- currency */
  D.CURRENCY = { name: 'Vel', symbol: '◆' };

  /* --------------------------------------------------------------- weapons
     GDD 7.1. Numbers are the first-pass tuning pass for open question #4. */
  /* MELEE REACH IS SET AGAINST THE SPRITES, NOT THE BODIES. The collision
     radii are world units drawn through ZOOM 0.26, while sprites are drawn
     1:1 into the world buffer, so every character LOOKS about 2.4x wider than
     the body it swings from: the hero is an 18px sprite on a 3.9px on-screen
     radius, a goblin a 10px sprite on 2.1px.

     Two sprites therefore touch at ~14 buffer px apart, and a sword used to
     reach 25.5 - a swingable gap of about one goblin, which is "you have to
     be standing on them". Unarmed reached 16.6, less than three pixels past
     overlapping. These numbers put roughly two goblin-widths of air between
     you and a target you can still hit, which is what the swing looks like it
     should do. The relative order of the weapons is unchanged. */
  D.WEAPONS = {
    sword: {
      id: 'sword', name: 'Sword', kind: 'melee', owned: true, price: 0,
      damage: 15, arc: 1.5, range: 122, windup: 0.05, recover: 0.19, stamina: 9,
      moveScale: 0.74, knock: 180,
      special: { name: 'Spin', damage: 13, arc: Math.PI, range: 130, windup: 0.11, recover: 0.34, stamina: 30, cooldown: 2.8, knock: 280, spin: true },
      blurb: 'Balanced all-rounder. No weakness, no spike.'
    },
    battleaxe: {
      id: 'battleaxe', name: 'Battleaxe', kind: 'melee', owned: false, price: 260,
      damage: 27, arc: 1.8, range: 142, windup: 0.26, recover: 0.36, stamina: 22,
      moveScale: 0.5, knock: 380,
      special: { name: 'Cleave', damage: 44, arc: 2.2, range: 160, windup: 0.4, recover: 0.42, stamina: 40, cooldown: 4.4, knock: 560, quake: true },
      blurb: 'Huge damage in a wide arc. Long wind-up, poor mobility.'
    },
    bow: {
      id: 'bow', name: 'Bow', kind: 'ranged', owned: false, price: 240,
      damage: 12, arc: 0.2, range: 820, windup: 0.22, recover: 0.17, stamina: 12,
      moveScale: 0.66, knock: 80, projectileSpeed: 720,
      special: { name: 'Volley', damage: 10, spread: 0.34, shots: 3, windup: 0.3, recover: 0.28, stamina: 34, cooldown: 3.8, projectileSpeed: 700 },
      blurb: 'Best kiting tool. Helpless once they close in.'
    },
    scythe: {
      id: 'scythe', name: 'Scythe', kind: 'melee', owned: false, price: -1, secret: true,
      damage: 21, arc: 1.75, range: 134, windup: 0.08, recover: 0.24, stamina: 14,
      moveScale: 0.72, knock: 250,
      special: { name: 'Reap', damage: 26, arc: 2.7, range: 152, windup: 0.1, recover: 0.3, stamina: 32, cooldown: 3.2, knock: 320, dash: 340, lifesteal: 0.3 },
      blurb: 'The secret. Solid damage, quick, no crippling weakness.'
    }
  };
  D.WEAPON_ORDER = ['sword', 'battleaxe', 'bow', 'scythe'];

  /* Empty hands, for the stretch of the tutorial before you pick. It is a real
     entry rather than a null so the HUD and the attack code need no special
     case; it is kept out of WEAPON_ORDER so it never reaches a shop. */
  D.WEAPONS.none = {
    id: 'none', name: 'Unarmed', kind: 'melee', owned: true, price: 0,
    damage: 3, arc: 1.1, range: 78, windup: 0.08, recover: 0.26, stamina: 6,
    moveScale: 0.9, knock: 60,
    special: { name: '--', damage: 0, arc: 0.4, range: 40, windup: 0.1, recover: 0.2, stamina: 999, cooldown: 1 },
    blurb: 'Nothing but your fists.'
  };

  /* ----------------------------------------------------------------- gems
     GDD 8. One is granted at random during the first trial and levels up. */
  D.GEMS = {
    emberstone: {
      id: 'emberstone', name: 'Emberstone', colour: '#ff7a3c', glow: '#ffcf9a',
      role: 'Attack / Defense',
      desc: function (l) { return '+' + (8 * l) + '% damage dealt, -' + (5 * l) + '% damage taken'; },
      apply: function (s, l) { s.damageMul *= 1 + 0.08 * l; s.defenceMul *= 1 - 0.05 * l; }
    },
    rootstone: {
      id: 'rootstone', name: 'Rootstone', colour: '#5fd07a', glow: '#c6f7ce',
      role: 'Health / Stamina',
      desc: function (l) { return '+' + (12 * l) + ' max health, +' + (10 * l) + ' max stamina'; },
      apply: function (s, l) { s.maxHp += 12 * l; s.maxStamina += 10 * l; }
    },
    galeshard: {
      id: 'galeshard', name: 'Galeshard', colour: '#57c6ff', glow: '#cdefff',
      role: 'Dodge / Movement',
      desc: function (l) { return '+' + (6 * l) + '% move speed, dodge cooldown -' + (10 * l) + '%'; },
      apply: function (s, l) { s.speedMul *= 1 + 0.06 * l; s.dodgeCdMul *= 1 - 0.1 * l; }
    },
    wingshard: {
      id: 'wingshard', name: 'Wingshard', colour: '#f0e6ff', glow: '#ffffff',
      role: 'Jump / Glide',
      /* scaled with the shorter base dodge: 170 -> 260 at level V */
      desc: function (l) { return 'Dodge becomes a glide: +' + (18 * l) + ' distance'; },
      apply: function (s, l) { s.glide = true; s.dodgeDist += 18 * l; }
    },
    stormshard: {
      id: 'stormshard', name: 'Stormshard', colour: '#ffe45c', glow: '#fff7c2',
      role: 'Ranged power',
      desc: function (l) { return '+' + (15 * l) + '% ranged damage, arrows pierce at level 3+'; },
      apply: function (s, l) { s.rangedMul *= 1 + 0.15 * l; if (l >= 3) s.pierce = true; }
    },
    duskveil: {
      id: 'duskveil', name: 'Duskveil', colour: '#a077ff', glow: '#ded0ff',
      role: 'Evasion',
      desc: function (l) { return (7 * l) + '% chance to be missed entirely, quieter in cover'; },
      apply: function (s, l) { s.evasion += 0.07 * l; s.stealthMul *= 1 - 0.08 * l; }
    }
  };
  D.GEM_IDS = ['emberstone', 'rootstone', 'galeshard', 'wingshard', 'stormshard', 'duskveil'];

  /* --------------------------------------------------------------- enemies */
  D.ENEMIES = {
    goblin: {
      /* radius follows the art: the sprite halved, so the body it collides and
         is hit with halves too, or you swing at air and it reaches you from
         outside itself. Reach is left alone - that is difficulty, not size. */
      id: 'goblin', name: 'Goblin', hp: 32, speed: 122, damage: 8, sight: 430,
      radius: 8, attackRange: 52, attackWindup: 0.34, attackRecover: 0.4,
      score: 10, reward: 6, colour: '#7fbf4f', dark: '#4b8030'
    },
    minotaur: {
      id: 'minotaur', name: 'Minotaur', hp: 130, speed: 104, damage: 20, sight: 510,
      radius: 24, attackRange: 72, attackWindup: 0.5, attackRecover: 0.6,
      score: 40, reward: 22, colour: '#b06a40', dark: '#733f22', charge: true, heavy: true
    },
    /* --- Husk: a drained townsperson, and the reason a crowd is dangerous.
       Half a goblin's health, a third more speed. Alone it is nothing; the
       point is that it never arrives alone, so a single-target swing is the
       wrong answer and a wide arc is the right one. --- */
    husk: {
      id: 'husk', name: 'Husk', hp: 18, speed: 168, damage: 6, sight: 480,
      radius: 10, attackRange: 44, attackWindup: 0.22, attackRecover: 0.3,
      score: 7, reward: 4, colour: '#7e8a6e', dark: '#4a5340', swarm: true
    },

    /* --- Slinger: the first enemy that does not have to touch you.
       Nothing in the game had ever shot back, so distance was a free win and
       the bow was strictly better than it should be. This one holds at range,
       backs off when you close, and its wind-up is long enough to read and
       dodge - but only if you are looking at it. --- */
    slinger: {
      id: 'slinger', name: 'Slinger', hp: 40, speed: 108, damage: 11, sight: 640,
      radius: 14, attackRange: 430, attackWindup: 0.55, attackRecover: 0.8,
      score: 24, reward: 15, colour: '#778a3d', dark: '#3f4a22',
      ranged: true, kite: 270, boltSpeed: 430
    },

    /* --- Ironclad: a wall. Slowest thing in the arena and the hardest to
       move - heavy halves knockback - with a wind-up you can walk out of and
       a hit you cannot afford twice. It punishes greed, not reflexes. --- */
    ironclad: {
      id: 'ironclad', name: 'Ironclad', hp: 260, speed: 74, damage: 30, sight: 420,
      radius: 28, attackRange: 84, attackWindup: 0.62, attackRecover: 0.7,
      score: 72, reward: 42, colour: '#6d7b8c', dark: '#2b323d', heavy: true
    },

    /* --- Shade: the answer to kiting. It closes half the gap instantly every
       few seconds, so backing away buys you nothing and the bow stops being a
       safe option. Thin enough to drop fast once you commit to it. --- */
    shade: {
      id: 'shade', name: 'Shade', hp: 70, speed: 132, damage: 16, sight: 900,
      radius: 16, attackRange: 62, attackWindup: 0.3, attackRecover: 0.38,
      score: 32, reward: 19, colour: '#4aa8c8', dark: '#1d4a60', blink: 2.6
    },

    reaper: {
      id: 'reaper', name: 'Reaper', hp: 420, speed: 156, damage: 26, sight: 4000,
      radius: 26, attackRange: 110, attackWindup: 0.4, attackRecover: 0.46,
      score: 260, reward: 140, colour: '#3b3550', dark: '#1d1a2b', boss: true, teleport: true
    },
    aurelith: {
      id: 'aurelith', name: 'Aurelith', hp: 1500, speed: 134, damage: 30, sight: 8000,
      radius: 40, attackRange: 150, attackWindup: 0.52, attackRecover: 0.54,
      score: 1200, reward: 900, colour: '#e9e2ea', dark: '#2a2331', boss: true, finalBoss: true,
      teleport: true
    },
    /* --- tutorial only; never enters the trial rotation --- */
    dummy: {
      id: 'dummy', name: 'Straw Dummy', hp: 40, speed: 0, damage: 0, sight: 0,
      radius: 16, attackRange: 0, attackWindup: 1, attackRecover: 1,
      score: 0, reward: 0, colour: '#d8c188', dark: '#b09a5c', inert: true
    },
    warden: {
      /* You get ONE attempt at this - die and it keeps the scythe for the rest
         of the run - so it is tuned to be survived by few.

         The lever is lethality, not health. At 15 damage a sword already needs
         40 connects to drop it; more health only makes the fight longer, not
         harder. What was soft was the danger: 24 damage meant five mistakes
         were survivable and a 0.62s wind-up is a tell you can react to while
         looking elsewhere. Now three mistakes end the run, the tell is 0.45s -
         real, but it demands you watch it - and the recovery you punish on has
         halved, so every opening has to be taken cleanly. */
      id: 'warden', name: 'Warden', hp: 600, speed: 136, damage: 34, sight: 4000,
      radius: 28, attackRange: 118, attackWindup: 0.45, attackRecover: 0.42,
      score: 0, reward: 0, colour: '#5c2b4a', dark: '#3a1830', boss: true,
      heavy: true, charge: true
    }
  };

  /* ---------------------------------------------------------------- roster
     Which enemies a trial may field, and how often. `from` is the tier at
     which one starts appearing (tier runs 1.0 at trial 1 to ~2.9 at trial 50),
     `weight` its share of the draw once it has.

     `fade` thins an entry out as the tier climbs past its own `from`. Without
     it the starter enemy keeps its full share forever and a trial 50 field is
     still mostly goblins with a garnish - the roster grows but the fight never
     changes. Bosses are not here: they are placed by the trial, not drawn. */
  D.ROSTER = [
    { id: 'goblin',   from: 1.00, weight: 10, fade: 0.55 },
    { id: 'husk',     from: 1.15, weight: 7 },
    { id: 'slinger',  from: 1.45, weight: 5 },
    { id: 'minotaur', from: 1.70, weight: 6 },
    { id: 'shade',    from: 2.05, weight: 4 },
    { id: 'ironclad', from: 2.35, weight: 4 }
  ];

  /* ---------------------------------------------------------- environments
     GDD 5. Each skin recolours the arena and swaps the barrier / cover prop. */
  D.ENVIRONMENTS = [
    { id: 'plains', name: 'Plains', ground: '#6fae4a', ground2: '#5f9c3e', accent: '#487a30',
      barrier: 'tree', cover: 'bush', sky: '#7fb8d6', litter: 'flower' },
    { id: 'forest', name: 'Deepwood', ground: '#3f8447', ground2: '#34713c', accent: '#255230',
      barrier: 'tree', cover: 'bush', sky: '#4d7a63', litter: 'fern' },
    { id: 'snow', name: 'Snowfield', ground: '#cfe0ee', ground2: '#b9cfe2', accent: '#93aec8',
      barrier: 'pine', cover: 'snowbush', sky: '#8fb0cc', litter: 'rock' },
    { id: 'village', name: 'Village', ground: '#b09763', ground2: '#9d8555', accent: '#7a6640',
      barrier: 'fence', cover: 'crate', sky: '#d8b585', litter: 'flower' },
    { id: 'hq', name: 'Enemy HQ', ground: '#4a4455', ground2: '#3e3948', accent: '#2a2634',
      barrier: 'wall', cover: 'crate', sky: '#241f30', litter: 'rock' },
    { id: 'city', name: 'City Block', ground: '#6e747d', ground2: '#5f656d', accent: '#464b52',
      barrier: 'wall', cover: 'crate', sky: '#5b6b7c', litter: 'rock' },
    { id: 'desert', name: 'Dunes', ground: '#d0ac68', ground2: '#bd9955', accent: '#9a7a3d',
      barrier: 'cactus', cover: 'shrub', sky: '#c98f52', litter: 'rock' }
  ];

  /* The two plaza skins live OUTSIDE D.ENVIRONMENTS on purpose: makeSpec picks
     a trial's environment with `hash % ENVIRONMENTS.length`, so appending here
     would silently re-roll the environment of all 50 trials. */
  D.TUTORIAL_ENVS = {
    /* the living square: warm shopfront glow under a night sky */
    square: { id: 'square', name: 'Aurelia Square', ground: '#6e747d', ground2: '#5f656d',
      accent: '#464b52', barrier: 'wall', cover: 'crate', sky: '#2b3446', litter: 'rock' },
    /* the same square after the fall - identical tiles, all the life drained out */
    drained: { id: 'drained', name: 'Aurelia Square', ground: '#4c525b', ground2: '#40454d',
      accent: '#2e3238', barrier: 'wall', cover: 'crate', sky: '#171b26', litter: 'rock' }
  };


  /* -------------------------------------------------------------- trials
     GDD 6.1. `weight` biases the rotation; boss trials override every 5th. */
  D.TRIAL_TYPES = [
    { id: 'defeat',  name: 'Defeat Enemies', brief: 'Cull the arena.' },
    { id: 'defend',  name: 'Defend',          brief: 'Hold the ground.' },
    { id: 'deliver', name: 'Collect & Deliver', brief: 'Fetch it. Run it home.' },
    { id: 'puzzle',  name: 'Physical Puzzle', brief: 'Set the stones right.' },
    { id: 'word',    name: 'Word Puzzle',     brief: 'Find the hints. Answer.' },
    { id: 'hide',    name: 'Hide & Seek',     brief: 'Do not be found.' },
    { id: 'seek',    name: 'Seek & Destroy',  brief: 'They are hiding. Find them.' }
  ];
  D.TRIAL_ROTATION = ['defeat', 'deliver', 'puzzle', 'defend', 'hide', 'defeat', 'word', 'deliver', 'seek', 'defend'];

  D.TOTAL_TRIALS = 50;
  D.BOSS_EVERY = 5;
  D.DEATH_LIMIT = 25;

  /* --------------------------------------------------------- word puzzles */
  D.RIDDLES = [
    { q: 'What has a ring of trees but never a road out?', a: 'The arena', wrong: ['A crown', 'The city', 'A wheel'] },
    { q: 'Garatu calls them watchers. What do they want?', a: 'Entertainment', wrong: ['Tribute', 'Silence', 'Blood'] },
    { q: 'It cuts wide, needs no wind-up, and was here all along.', a: 'The scythe', wrong: ['The axe', 'The bow', 'The sword'] },
    { q: 'Spend it in two shops, earn it in one place.', a: 'Vel', wrong: ['Time', 'Blood', 'Trust'] },
    { q: 'Bright green, waist high, and it will save your life.', a: 'A bush', wrong: ['A shield', 'A tree', 'A wall'] },
    { q: 'Every fifth guest arrives carrying your own weapon.', a: 'The Reaper', wrong: ['Garatu', 'A goblin', 'A watcher'] },
    { q: 'Twenty-five of these and nothing you own survives.', a: 'Deaths', wrong: ['Trials', 'Days', 'Coins'] },
    { q: 'It was given once, at random, and it grows with you.', a: 'A power gem', wrong: ['A debt', 'A scar', 'A name'] },
    { q: 'Slow, heavy, and it will get you killed if you are surrounded.', a: 'The battleaxe', wrong: ['The bow', 'The scythe', 'Cowardice'] },
    { q: 'Thirty seconds edge to edge. What is it?', a: 'The arena', wrong: ['The trial', 'A minute', 'The hall'] },
    { q: 'Below forty percent buys you this.', a: 'A debuff', wrong: ['A reward', 'A rest', 'Applause'] },
    { q: 'Where does the story begin?', a: 'A bedroom', wrong: ['A grave', 'The plains', 'A throne'] }
  ];

  /* ---------------------------------------------------------------- shops
     GDD 9. One shared currency across both shops. */
  D.REALITY_SHOP = [
    /* The outfit is near-black, so the sleeves are the one saturated thing on
       the character - they have to carry all of the colour. These were mid
       reds and blues that read as washed-out at sprite size; they are now the
       deep, lit accents the look is built around. */
    /* Four suits of armour, not four dye jobs. Every one of these is a real
       outfit now - the tint still recolours the sleeves, but the garments are
       what you actually see. Priced by how much armour each one is. */
    { id: 'shirt_red',   cat: 'Armour', name: 'Royal',      price: 120, desc: 'Black and gold robes, crowned in fire.', tint: '#1e1a26', outfit: 'royal' },
    { id: 'shirt_gold',  cat: 'Armour', name: 'Ophiuchus',  price: 220, desc: 'Black, emerald and bone.', tint: '#1f7a52', outfit: 'ophiuchus' },
    { id: 'shirt_blue',  cat: 'Armour', name: 'Reaper',     price: 300, desc: 'Sash, wraps and baggy silks.', tint: '#2e2a42', outfit: 'reaper' },
    { id: 'shirt_black', cat: 'Armour', name: 'Grayson',    price: 480, desc: 'Gold-trimmed cloak, blue stone.', tint: '#1b1826', outfit: 'grayson' },
    { id: 'decor_rug',   cat: 'Decor',   name: 'Woven Rug',      price: 80,  desc: 'The floor is less cold now.',           decor: 'rug' },
    { id: 'decor_plant', cat: 'Decor',   name: 'Corner Fern',    price: 70,  desc: 'It is alive. Probably.',                decor: 'plant' },
    { id: 'decor_lamp',  cat: 'Decor',   name: 'Warm Lamp',      price: 110, desc: 'Makes the room feel like a home.',      decor: 'lamp' },
    { id: 'decor_shelf', cat: 'Decor',   name: 'Trophy Shelf',   price: 150, desc: 'Somewhere to put what you survive.',    decor: 'shelf' },
    { id: 'biz_cart',    cat: 'Business', name: 'Street Cart',    price: 200,  desc: 'Passive income each trial.', income: 6 },
    { id: 'biz_bakery',  cat: 'Business', name: 'Corner Bakery',  price: 450,  desc: 'Passive income each trial.', income: 15 },
    { id: 'biz_smith',   cat: 'Business', name: 'Smithy Share',   price: 800,  desc: 'Passive income each trial.', income: 28 },
    { id: 'biz_tower',   cat: 'Business', name: 'Tower Floor',    price: 1400, desc: 'Passive income each trial.', income: 52 },
    { id: 'biz_guild',   cat: 'Business', name: 'Guild Charter',  price: 2400, desc: 'Passive income each trial.', income: 95 }
  ];

  D.TRIAL_SHOP = [
    { id: 'w_battleaxe', cat: 'Weapon', name: 'Battleaxe', price: 260, desc: 'High damage, wide arc, slow.', weapon: 'battleaxe' },
    { id: 'w_bow',       cat: 'Weapon', name: 'Bow',       price: 240, desc: 'Long range. Weak up close.',   weapon: 'bow' },
    { id: 'g_armour',    cat: 'Gear', name: 'Padded Vest',  price: 150, desc: '+20 max health.',              gear: { maxHp: 20 } },
    { id: 'g_armour2',   cat: 'Gear', name: 'Plated Vest',  price: 420, desc: '+45 max health.',              gear: { maxHp: 45 }, needs: 'g_armour' },
    { id: 'g_boots',     cat: 'Gear', name: 'Runner Boots', price: 180, desc: '+10% move speed.',             gear: { speedMul: 0.10 } },
    { id: 'g_belt',      cat: 'Gear', name: 'Stamina Belt', price: 200, desc: '+25 max stamina, faster regen.', gear: { maxStamina: 25, staminaRegen: 5 } },
    { id: 'g_charm',     cat: 'Gear', name: 'Hunter Charm',  price: 260, desc: '-25% enemy detection range.',  gear: { stealthMul: 0.25 } },
    { id: 'c_potion',    cat: 'Consumable', name: 'Health Draught', price: 45, desc: 'Restores 50 health mid-trial.', consumable: 'potion', stack: true },
    { id: 'c_tonic',     cat: 'Consumable', name: 'Stamina Tonic',  price: 35, desc: 'Refills stamina instantly.',    consumable: 'tonic',  stack: true },
    { id: 'c_smoke',     cat: 'Consumable', name: 'Smoke Bomb',     price: 55, desc: 'Breaks all enemy detection.',   consumable: 'smoke',  stack: true }
  ];

  /* ------------------------------------------------------------- debuffs
     GDD 6.2 - "potential debuff applied on the reattempt". */
  D.DEBUFFS = [
    { id: 'weak',    name: 'Weakened',  desc: '-20% damage dealt',      apply: function (s) { s.damageMul *= 0.8; } },
    { id: 'brittle', name: 'Brittle',   desc: '+25% damage taken',      apply: function (s) { s.defenceMul *= 1.25; } },
    { id: 'winded',  name: 'Winded',    desc: '-30% max stamina',       apply: function (s) { s.maxStamina *= 0.7; } },
    { id: 'heavy',   name: 'Leadfoot',  desc: '-15% move speed',        apply: function (s) { s.speedMul *= 0.85; } },
    { id: 'marked',  name: 'Marked',    desc: 'Enemies see 40% further', apply: function (s) { s.stealthMul *= 1.4; } }
  ];

  /* ------------------------------------------------- scythe unlock combos
     GDD 7.1. Ten presets; one is picked at random per run and rerolled on reset. */
  D.COMBOS = [
    ['up', 'up', 'down', 'down', 'left', 'right'],
    ['left', 'right', 'left', 'right', 'up'],
    ['down', 'down', 'up', 'left', 'left'],
    ['up', 'left', 'down', 'right', 'up'],
    ['right', 'right', 'up', 'up', 'down'],
    ['down', 'left', 'up', 'right', 'down'],
    ['left', 'left', 'right', 'down', 'up'],
    ['up', 'down', 'up', 'down', 'left'],
    ['right', 'down', 'left', 'up', 'right'],
    ['down', 'up', 'right', 'right', 'left']
  ];
  D.IDLE_UNLOCK_SECONDS = 300; /* GDD: five minutes on the Start Screen */

  /* TEMPORARY (for playtesting): pin the unlock to one combo so it never
     changes between runs. Set to null to restore the GDD behaviour of drawing
     a fresh random combo on every reset. */
  D.FIXED_COMBO_INDEX = 0;     /* up up down down left right */

  /* ------------------------------------------------------------- ranking
     GDD 6.2. Percentile is derived from score vs. the trial's par score. */
  /* Outfits are garment sets, not colours: a tint only recolours the sleeves
     that are already there, so anything with a different SHAPE - a sash, a
     baggy leg, a wrapped wrist - has to be its own thing. Each entry is
     handed straight to humanoidGrid, so adding another is a data edit. */
  /* Four named suits of armour. Each one is a set of garments handed to
     `humanoidGrid`, so a suit is a data entry rather than more sprite code.

     They are built to be told apart by SHAPE first and colour second: at 18x28
     a palette swap alone is what "they all look the same" meant last time. So
     Royal gets pauldrons and a chest plate, Ophiuchus a long coat and a high
     collar, Reaper a sash and baggy legs, and Grayson all of it at once. */
  /* Four named suits of armour. Each one is a set of garments handed to
     `humanoidGrid`, so a suit is a data entry rather than more sprite code.

     They are told apart by SHAPE first and colour second - a palette swap
     alone is what "they all look the same" meant - and every one of them is
     FITTED. The body is six columns wide at 18x28, so a garment any wider has
     already lost the waist and reads as a sack. Ophiuchus is the single
     exception: its top is meant to hang, and it says so with `loose`. */
  D.OUTFITS = {
    /* ROYAL - elegant black and gold robes under a helm with a crown of gold
       fire. No shoulder plate: the silhouette is the helm and the flame, and
       every bit of colour on the robe is trim rather than fill. */
    royal: {
      plate: 'U', plateLite: '@', plateTrim: 'Y',
      collar: 'U', collarLite: '#',
      helm: 'U', helmTrim: 'Y', helmEye: 'Y',
      helmFlame: '#', helmFlameLite: '!',
      trouser: 'U',
      boot: 'U', cuff: 'Y',
      sash: '#', sashDark: '@'
    },

    /* OPHIUCHUS - the serpent-bearer. Black and emerald with bone at the
       throat, and the one top in the shop that is allowed to hang loose. */
    ophiuchus: {
      plate: 'U', plateLite: '<', plateTrim: 'O', loose: true,
      collar: 'U', collarLite: 'O',
      belt: '<',
      trouser: 'U', trouserLite: 'x',
      boot: 'U', cuff: 'O',
      wrap: '>'
    },

    /* REAPER - gold sash with a crimson tie, baggy teal trousers with a lit
       seam, gold boot cuffs and wrapped wrists. */
    reaper: {
      trouser: 'o', trouserLite: '%',
      baggy: true,
      sash: '#', sashDark: '@', sashTie: '$',
      cuff: 'Y', wrap: 'q'
    },

    /* GRAYSON - a black cloak trimmed in gold, clasped at the throat and
       falling down the outside of the arms, over fitted white clothing, with
       a blue stone set in the chest that matches the scythe's edge. */
    grayson: {
      plate: 'Q', plateLite: 'q', plateTrim: 'q',
      cloak: 'U', cloakTrim: '#',
      collar: 'U', collarLite: '#',
      chestGem: ';', chestGemLite: '/',
      trouser: 'U', trouserLite: 'x',
      boot: 'U'
    }
  };

  D.RANK_TIERS = [
    { max: 25, id: 'top',     label: 'Top 25%',     outcome: 'reward' },
    { max: 40, id: 'middle',  label: '26 - 40%',    outcome: 'neutral' },
    { max: 100, id: 'bottom', label: 'Below 40%',   outcome: 'fail' }
  ];

  V.D = D;
})(window.V = window.V || {});
