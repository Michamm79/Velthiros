/* Velthiros - persistent run state (localStorage) */
(function (V) {
  'use strict';

  var U = V.U, D = V.D;
  var KEY = 'velthiros.save.v1';

  var Save = {};

  Save.blank = function () {
    return {
      version: 1,
      started: false,          /* has a run been created at all */
      trial: 1,                /* next trial index, 1..TOTAL_TRIALS */
      cleared: 0,              /* trials actually completed */
      deaths: 0,               /* GDD 9: 25 deaths wipes everything */
      resets: 0,               /* how many full wipes this profile has seen */
      currency: 0,
      lifetimeEarned: 0,
      gem: null,               /* { id, level } - granted in trial 1 */
      weapon: 'sword',
      weapons: { sword: true },
      scytheUnlocked: false,
      comboIndex: D.FIXED_COMBO_INDEX != null ? D.FIXED_COMBO_INDEX : Math.floor(Math.random() * D.COMBOS.length),
      owned: {},               /* shop item id -> true (or count for stackables) */
      equippedTint: null,
      decor: {},
      debuff: null,            /* { id } applied to the next attempt only */
      lastRank: null,
      seenIntro: false,
      endgame: false,          /* reached the wave gauntlet */
      endgameWave: 0,
      beatenGame: false,
      stats: { kills: 0, trialsFailed: 0, bestRank: 100 }
    };
  };

  Save.load = function () {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return Save.blank();
    try {
      var data = JSON.parse(raw);
      if (!data || data.version !== 1) return Save.blank();
      /* fill in anything a newer build added */
      var base = Save.blank();
      for (var k in base) if (!(k in data)) data[k] = base[k];
      /* an in-progress run keeps the combo it was created with, which is
         confusing while the combo is pinned for testing - apply the pin on load */
      if (D.FIXED_COMBO_INDEX != null) data.comboIndex = D.FIXED_COMBO_INDEX;
      return data;
    } catch (e) {
      return Save.blank();
    }
  };

  Save.write = function (state) {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  };

  Save.wipe = function () {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  };

  /* GDD 9: a full reset wipes currency, gem levels, purchases and weapons.
     The scythe reverts to locked with a *new* random combination. */
  Save.fullReset = function (state) {
    var fresh = Save.blank();
    fresh.resets = (state && state.resets ? state.resets : 0) + 1;
    fresh.comboIndex = Save.rerollCombo(state ? state.comboIndex : -1);
    Save.write(fresh);
    return fresh;
  };

  /* pick a combo that differs from the current one */
  Save.rerollCombo = function (current) {
    if (D.FIXED_COMBO_INDEX != null) return D.FIXED_COMBO_INDEX;   /* pinned for playtesting */
    var n = D.COMBOS.length;
    if (n <= 1) return 0;
    var next = current;
    while (next === current) next = Math.floor(Math.random() * n);
    return next;
  };

  Save.newGame = function (state) {
    var fresh = Save.blank();
    fresh.resets = state ? state.resets : 0;
    fresh.comboIndex = Save.rerollCombo(state ? state.comboIndex : -1);
    fresh.started = true;
    Save.write(fresh);
    return fresh;
  };

  Save.hasContinue = function () {
    var s = Save.load();
    return !!s.started && !s.beatenGame;
  };

  /* ------------------------------------------------------- derived helpers */

  Save.ownedCount = function (state, id) {
    var v = state.owned[id];
    if (v === true) return 1;
    return v ? v | 0 : 0;
  };

  Save.passiveIncome = function (state) {
    var total = 0;
    for (var i = 0; i < D.REALITY_SHOP.length; i++) {
      var it = D.REALITY_SHOP[i];
      if (it.income && Save.ownedCount(state, it.id) > 0) total += it.income;
    }
    return total;
  };

  /* Gem level tracks progress: one level per 8 cleared trials, capped at 5. */
  Save.gemLevel = function (state) {
    if (!state.gem) return 0;
    return U.clamp(1 + Math.floor(state.cleared / 8), 1, 5);
  };

  /* Weapons level alongside the player (GDD 7.1). */
  Save.weaponLevel = function (state) {
    return U.clamp(1 + Math.floor(state.cleared / 6), 1, 6);
  };

  /* Fully resolved player stats for a trial attempt. */
  Save.resolveStats = function (state) {
    var s = {
      maxHp: 100, maxStamina: 100, staminaRegen: 20,
      speed: 190,                 /* ~13s to cross the 2500u arena - see arena.js */
      speedMul: 1, damageMul: 1, rangedMul: 1, defenceMul: 1,
      dodgeCdMul: 1, dodgeDist: 310, evasion: 0, stealthMul: 1,
      glide: false, pierce: false,
      weaponLevel: Save.weaponLevel(state),
      gemLevel: Save.gemLevel(state)
    };

    /* gear */
    for (var i = 0; i < D.TRIAL_SHOP.length; i++) {
      var it = D.TRIAL_SHOP[i];
      if (!it.gear || !Save.ownedCount(state, it.id)) continue;
      if (it.gear.maxHp) s.maxHp += it.gear.maxHp;
      if (it.gear.maxStamina) s.maxStamina += it.gear.maxStamina;
      if (it.gear.staminaRegen) s.staminaRegen += it.gear.staminaRegen;
      if (it.gear.speedMul) s.speedMul *= 1 + it.gear.speedMul;
      if (it.gear.stealthMul) s.stealthMul *= 1 - it.gear.stealthMul;
    }

    /* gem */
    if (state.gem) {
      var gem = D.GEMS[state.gem.id];
      if (gem) gem.apply(s, s.gemLevel);
    }

    /* weapon level: +6% damage per level past 1 */
    s.damageMul *= 1 + 0.06 * (s.weaponLevel - 1);

    /* debuff from a failed attempt */
    if (state.debuff) {
      var db = null;
      for (var j = 0; j < D.DEBUFFS.length; j++) if (D.DEBUFFS[j].id === state.debuff) db = D.DEBUFFS[j];
      if (db) db.apply(s);
    }

    s.speed *= s.speedMul;
    s.maxHp = Math.round(s.maxHp);
    s.maxStamina = Math.round(s.maxStamina);
    return s;
  };

  V.Save = Save;
})(window.V = window.V || {});
