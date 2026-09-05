/* Velthiros - static design data (weapons, gems, enemies, environments, shops, trials) */
(function (V) {
  'use strict';

  var D = {};

  /* ---------------------------------------------------------------- currency */
  D.CURRENCY = { name: 'Vel', symbol: '◆' };

  /* --------------------------------------------------------------- weapons
     GDD 7.1. Numbers are the first-pass tuning pass for open question #4. */
  D.WEAPONS = {
    sword: {
      id: 'sword', name: 'Sword', kind: 'melee', owned: true, price: 0,
      damage: 15, arc: 1.5, range: 90, windup: 0.05, recover: 0.19, stamina: 9,
      moveScale: 0.74, knock: 180,
      special: { name: 'Spin', damage: 13, arc: Math.PI, range: 96, windup: 0.11, recover: 0.34, stamina: 30, cooldown: 2.8, knock: 280, spin: true },
      blurb: 'Balanced all-rounder. No weakness, no spike.'
    },
    battleaxe: {
      id: 'battleaxe', name: 'Battleaxe', kind: 'melee', owned: false, price: 260,
      damage: 27, arc: 1.8, range: 108, windup: 0.26, recover: 0.36, stamina: 22,
      moveScale: 0.5, knock: 380,
      special: { name: 'Cleave', damage: 44, arc: 2.2, range: 122, windup: 0.4, recover: 0.42, stamina: 40, cooldown: 4.4, knock: 560, quake: true },
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
      damage: 21, arc: 1.75, range: 102, windup: 0.08, recover: 0.24, stamina: 14,
      moveScale: 0.72, knock: 250,
      special: { name: 'Reap', damage: 26, arc: 2.7, range: 116, windup: 0.1, recover: 0.3, stamina: 32, cooldown: 3.2, knock: 320, dash: 340, lifesteal: 0.3 },
      blurb: 'The secret. Solid damage, quick, no crippling weakness.'
    }
  };
  D.WEAPON_ORDER = ['sword', 'battleaxe', 'bow', 'scythe'];

  /* Empty hands, for the stretch of the tutorial before you pick. It is a real
     entry rather than a null so the HUD and the attack code need no special
     case; it is kept out of WEAPON_ORDER so it never reaches a shop. */
  D.WEAPONS.none = {
    id: 'none', name: 'Unarmed', kind: 'melee', owned: true, price: 0,
    damage: 3, arc: 1.1, range: 56, windup: 0.08, recover: 0.26, stamina: 6,
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
      id: 'goblin', name: 'Goblin', hp: 32, speed: 122, damage: 8, sight: 430,
      radius: 15, attackRange: 52, attackWindup: 0.34, attackRecover: 0.4,
      score: 10, reward: 6, colour: '#7fbf4f', dark: '#4b8030'
    },
    minotaur: {
      id: 'minotaur', name: 'Minotaur', hp: 130, speed: 104, damage: 20, sight: 510,
      radius: 24, attackRange: 72, attackWindup: 0.5, attackRecover: 0.6,
      score: 40, reward: 22, colour: '#b06a40', dark: '#733f22', charge: true, heavy: true
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
      /* Slower and far more telegraphed than a Reaper, but it hits like one.
         Beatable on the tutorial's terms - dodge the wind-up, punish the
         recovery - which is exactly the lesson the preceding beats taught. */
      id: 'warden', name: 'Warden', hp: 560, speed: 128, damage: 24, sight: 4000,
      radius: 28, attackRange: 118, attackWindup: 0.62, attackRecover: 0.62,
      score: 0, reward: 0, colour: '#5c2b4a', dark: '#3a1830', boss: true,
      heavy: true, charge: true
    }
  };

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
    { id: 'shirt_red',   cat: 'Clothes', name: 'Crimson Tunic',  price: 60,  desc: 'A red tunic. Purely for the watchers.', tint: '#d84a4a' },
    { id: 'shirt_blue',  cat: 'Clothes', name: 'Deepwater Coat', price: 60,  desc: 'Cold blue. Suits the snowfields.',     tint: '#4a7fd8' },
    { id: 'shirt_gold',  cat: 'Clothes', name: 'Gilded Vest',    price: 180, desc: 'Loud. Expensive. Slightly ridiculous.', tint: '#e8c14a' },
    { id: 'shirt_black', cat: 'Clothes', name: 'Reaper Weave',   price: 320, desc: 'Woven from a Reaper cloak.',            tint: '#3b3550' },
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
  D.RANK_TIERS = [
    { max: 25, id: 'top',     label: 'Top 25%',     outcome: 'reward' },
    { max: 40, id: 'middle',  label: '26 - 40%',    outcome: 'neutral' },
    { max: 100, id: 'bottom', label: 'Below 40%',   outcome: 'fail' }
  ];

  V.D = D;
})(window.V = window.V || {});
