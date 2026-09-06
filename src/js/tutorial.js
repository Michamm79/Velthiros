/* Velthiros - the guided opening.

   This runs as a normal Trial (type 'tutorial') so it inherits combat, the
   HUD, enemies, cover, pause and the pixel renderer for free. All that lives
   here is the script: an ordered list of beats, each teaching exactly one
   thing, each with its own setup and its own completion test.

   The trial is `untimed` and cannot be failed. Dying revives you on the spot,
   because a tutorial that can end in a loss teaches the wrong lesson - the one
   exception is the Warden, which you only get one attempt at. */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Audio = V.Audio;

  var T = {};

  T.RADIUS = 700;          /* a plaza, not the 1250u arena */
  T.ENV = 'drained';

  /* Where the script places things. Y grows toward the camera, so negative Y
     is "further in" - the player walks north through the beats and comes back
     south to the gate. */
  var GATE = { x: 0, y: 560 };
  var START = { x: 0, y: 470 };
  /* Well clear of the gate's 110u ring: reviving inside it would walk you out
     of the tutorial the instant the Warden killed you. */
  var REVIVE = { x: 0, y: 340 };
  var PEDESTALS = [
    { id: 'sword', x: -250, y: -70, label: 'SWORD' },
    { id: 'battleaxe', x: 0, y: -170, label: 'BATTLEAXE' },
    { id: 'bow', x: 250, y: -70, label: 'BOW' }
  ];


  /* ------------------------------------------------------------- helpers */

  /* Randomly-scattered cover would otherwise land on top of a pedestal or in
     the middle of the duel ground. */
  function clearArea(trial, x, y, r) {
    var r2 = r * r, i;
    for (i = trial.cover.length - 1; i >= 0; i--) {
      if (U.dist2(trial.cover[i].x, trial.cover[i].y, x, y) < r2) trial.cover.splice(i, 1);
    }
    for (i = trial.props.length - 1; i >= 0; i--) {
      var p = trial.props[i];
      if (p.solid) continue;                            /* never thin the barrier ring */
      if (U.dist2(p.x, p.y, x, y) < r2) trial.props.splice(i, 1);
    }
  }

  function decor(trial, kind, x, y, seed) {
    var d = { x: x, y: y, spr: V.Spr.prop(kind, seed || 0), kind: kind };
    trial.decor.push(d);
    return d;
  }

  function marker(trial, x, y, r, colour, active) {
    var m = { x: x, y: y, r: r, colour: colour || '#ffe45c', active: active !== false };
    trial.markers.push(m);
    return m;
  }

  function label(trial, x, y, text, colour, lift) {
    var l = { x: x, y: y, text: text, colour: colour || '#ffe45c', lift: lift };
    trial.worldLabels.push(l);
    return l;
  }

  function inMarker(trial, m) {
    var p = trial.player;
    return U.dist2(p.x, p.y, m.x, m.y) < m.r * m.r;
  }

  function say(trial, text) {
    trial.persistentPrompt = text;
  }

  /* Buttons the HUD should grey out until their beat arrives. */
  function lock(trial, list) {
    var map = { attack: true, special: true, dodge: true, item: true };
    for (var i = 0; i < list.length; i++) delete map[list[i]];
    trial.lockedActions = map;
  }

  /* ---------------------------------------------------------------- beats */

  var BEATS = [
    {
      id: 'move',
      enter: function (tr) {
        lock(tr, []);
        say(tr, 'Drag anywhere on the left of the screen to walk. Head for the light.');
        tr.tut.waypoint = marker(tr, 0, 120, 100, '#7fe08a');
        tr.guideTarget = tr.tut.waypoint;
      },
      done: function (tr) { return inMarker(tr, tr.tut.waypoint); },
      exit: function (tr) {
        tr.tut.waypoint.hidden = true;
        tr.guideTarget = null;
      }
    },

    {
      id: 'weapon',
      enter: function (tr) {
        lock(tr, []);
        say(tr, 'Three of them left something behind. Stand on a circle to pick that one up - '
              + 'you can walk back and swap as often as you like.');
        tr.tut.picks = [];
        tr.tut.pickLabels = [];
        for (var i = 0; i < PEDESTALS.length; i++) {
          var pd = PEDESTALS[i];
          var m = marker(tr, pd.x, pd.y, 80, '#ffe45c');
          m.weapon = pd.id;
          tr.tut.picks.push(m);
          tr.tut.pickLabels.push(label(tr, pd.x, pd.y, pd.label, '#ffe45c', -46));
        }
      },
      done: function (tr) { return !!tr.tut.chosenWeapon; }
    },

    {
      id: 'strike',
      enter: function (tr) {
        lock(tr, ['attack']);
        say(tr, 'Tap ATK to swing - you strike where you are facing. Land three hits. '
              + 'The pedestals are still open, so try all three on it if you want.');
        tr.tut.hits = 0;
        /* The dummy is a range, not a kill. It has to outlast a battleaxe so
           that trying every weapon on it is actually possible. */
        tr.tut.dummy = tr.spawnEnemy('dummy', 0, -330, { hpScale: 20 });
        tr.guideTarget = tr.tut.dummy;
      },
      done: function (tr) { return tr.tut.hits >= 3; },
      exit: function (tr) {
        tr.guideTarget = null;
        tr.setMessage('Good. Now something that hits back.', 2.4);
      }
    },

    {
      id: 'fight',
      enter: function (tr) {
        lock(tr, ['attack', 'special']);
        say(tr, 'Two of them. SPECIAL is slower and costs stamina, but it clears a crowd. Put both down - '
              + 'and swap weapon at the pedestals any time you want to feel the difference.');
        tr.tut.foes = [
          tr.spawnEnemy('goblin', -190, -340, { hpScale: 0.8, dmgScale: 0.6 }),
          tr.spawnEnemy('goblin', 190, -340, { hpScale: 0.8, dmgScale: 0.6 })
        ];
      },
      done: function (tr) {
        for (var i = 0; i < tr.tut.foes.length; i++) if (!tr.tut.foes[i].dead) return false;
        return true;
      }
    },

    {
      id: 'dodge',
      enter: function (tr) {
        lock(tr, ['attack', 'special', 'dodge']);
        say(tr, 'This one charges. Tap DODGE to slip past it - you are untouchable for the roll. Dodge twice.');
        tr.tut.dodges = 0;
        tr.tut.brute = tr.spawnEnemy('minotaur', 0, -360, { hpScale: 1.4, dmgScale: 0.45, speedScale: 0.9 });
        tr.guideTarget = tr.tut.brute;
      },
      done: function (tr) { return tr.tut.dodges >= 2; },
      exit: function (tr) {
        tr.guideTarget = null;
        var b = tr.tut.brute;
        if (b && !b.dead) {
          /* it withdraws rather than dying: the lesson was the roll, not the kill */
          tr.burst(b.x, b.y - 20, 22, '#9b6bff');
          tr.dust(b.x, b.y, 10);
          b.dead = true;
          Audio.play('warp');
        }
      }
    },

    {
      id: 'hide',
      enter: function (tr) {
        lock(tr, ['attack', 'special', 'dodge']);
        say(tr, 'Stand still in cover and they lose you. Stay hidden for a moment.');
        tr.tut.hideTime = 0;
        /* Cover is scattered at random everywhere else, which is fine when the
           whole arena is 1250u across and useless when a beat depends on there
           being some right here. This beat plants its own. */
        var spot = { x: -120, y: 60 };
        tr.tut.hideSpot = spot;
        for (var i = 0; i < 5; i++) {
          var a = (i / 5) * U.TAU;
          tr.cover.push({
            x: spot.x + Math.cos(a) * 40, y: spot.y + Math.sin(a) * 26,
            kind: tr.env.cover, s: 1.15, seed: 40 + i, r: 52
          });
        }
        tr.tut.hideRing = marker(tr, spot.x, spot.y, 70, '#7fe08a');
        tr.guideTarget = spot;
        tr.tut.hunter = tr.spawnEnemy('goblin', 0, -420, { hpScale: 0.8, dmgScale: 0.5 });
      },
      done: function (tr) { return tr.tut.hideTime >= 1.5; },
      exit: function (tr) {
        tr.guideTarget = null;
        tr.tut.hideRing.hidden = true;
        var h = tr.tut.hunter;
        if (h && !h.dead) { tr.burst(h.x, h.y - 18, 14, '#9b6bff'); h.dead = true; }
      }
    },

    {
      id: 'gem',
      enter: function (tr) {
        lock(tr, ['attack', 'special', 'dodge', 'item']);
        /* Last call: the pedestals close here, and whatever is in your hands
           now is the weapon you leave with. */
        T.commitWeapon(tr);
        var sv = tr.game.save;
        if (!sv.gem) sv.gem = { id: D.GEM_IDS[Math.floor(Math.random() * D.GEM_IDS.length)] };
        tr.tut.gemDef = D.GEMS[sv.gem.id];
        say(tr, 'Something of theirs is still burning up ahead. Take it.');
        tr.tut.gemSpot = marker(tr, 0, -470, 70, tr.tut.gemDef.colour);
        tr.tut.gemProp = decor(tr, 'gem', 0, -470, 0);
        tr.tut.gemProp.lift = -18;
        tr.guideTarget = tr.tut.gemSpot;
      },
      done: function (tr) { return inMarker(tr, tr.tut.gemSpot); },
      exit: function (tr) {
        var g = tr.tut.gemDef;
        tr.tut.gemProp.hidden = true;
        tr.tut.gemSpot.hidden = true;
        tr.guideTarget = null;
        tr.burst(tr.player.x, tr.player.y - 24, 26, g.colour);
        tr.floater(tr.player.x, tr.player.y - 50, g.name, g.glow);
        Audio.play('pickup');
        /* the gem changes the stats this attempt is already running on */
        tr.stats = V.Save.resolveStats(tr.game.save);
        tr.player.stats = tr.stats;
        tr.player.hp = tr.stats.maxHp;
        tr.setMessage(g.name + ' - ' + g.desc(V.Save.gemLevel(tr.game.save)), 4.5);
      }
    },

    {
      id: 'warden',
      enter: function (tr) {
        lock(tr, ['attack', 'special', 'dodge', 'item']);
        tr.tut.gate = marker(tr, GATE.x, GATE.y, 110, '#7fe08a');
        label(tr, GATE.x, GATE.y, 'HOME', '#7fe08a', -52);
        decor(tr, 'gate', GATE.x - 88, GATE.y, 1);
        decor(tr, 'gate', GATE.x + 88, GATE.y, 2);
        tr.tut.warden = tr.spawnEnemy('warden', 0, -520, { hpScale: 1, dmgScale: 1, speedScale: 1 });
        tr.boss = tr.tut.warden;
        say(tr, 'The Warden carries a scythe. Take it, or walk to the gate and go home - the gate is open either way.');
        Audio.music('boss');
      },
      done: function (tr) { return inMarker(tr, tr.tut.gate); }
    }
  ];

  /* -------------------------------------------------------------- lifecycle */

  T.setup = function (trial) {
    var i;
    trial.objective = { text: 'Learn the ground rules' };
    trial.timeLimit = 0;
    trial.timeLeft = 0;
    trial.untimed = true;
    trial.par = 1;                  /* finish() divides by par; never scored */
    trial.tut = { index: -1, revives: 0, dodges: 0, hideTime: 0 };

    /* keep the scripted ground clear of random scatter */
    clearArea(trial, 0, 120, 150);
    for (i = 0; i < PEDESTALS.length; i++) {
      clearArea(trial, PEDESTALS[i].x, PEDESTALS[i].y, 130);
      decor(trial, 'pedestal', PEDESTALS[i].x, PEDESTALS[i].y, i);
    }
    clearArea(trial, 0, -350, 260);          /* the duelling ground */
    clearArea(trial, 0, -470, 130);          /* the gem */
    clearArea(trial, GATE.x, GATE.y, 190);   /* the way home */
    clearArea(trial, REVIVE.x, REVIVE.y, 90);

    /* plaza dressing: the furniture the crowd was using before the fall */
    decor(trial, 'kiosk', -420, 210, 1);
    decor(trial, 'kiosk', 430, -240, 2);
    decor(trial, 'bench', -300, 330, 1);
    decor(trial, 'bench', 300, 330, 2);
    decor(trial, 'bench', -470, -60, 3);
    decor(trial, 'bench', 470, -60, 4);
    var lamps = [[-360, 60], [360, 60], [-360, -300], [360, -300], [-160, 420], [160, 420]];
    for (i = 0; i < lamps.length; i++) {
      clearArea(trial, lamps[i][0], lamps[i][1], 60);
      decor(trial, 'lamp', lamps[i][0], lamps[i][1], i);
    }

    /* start further back than a normal trial so the first walk has room */
    trial.player.x = START.x;
    trial.player.y = START.y;
    trial.player.facing = -Math.PI / 2;
    trial.player.weaponId = 'none';

    advance(trial);
  };

  function advance(trial) {
    var tut = trial.tut;
    var prev = BEATS[tut.index];
    if (prev && prev.exit) prev.exit(trial);

    tut.index++;
    var beat = BEATS[tut.index];
    if (!beat) { trial.objectiveDone = true; return; }
    tut.beatId = beat.id;
    tut.beatTime = 0;
    beat.enter(trial);
    Audio.play('confirm');
  }
  T.advance = advance;

  T.update = function (trial, dt) {
    var tut = trial.tut;
    if (!tut) return;
    tut.beatTime += dt;

    /* dying is never the end of a tutorial */
    if (trial.player.dead) { revive(trial); return; }

    /* Swapping is not part of any one beat: the pedestals stay live from the
       moment they appear until the gem beat closes them, so an accidental
       circle costs nothing and every weapon can be tried in a real fight. */
    if (tut.picks && !tut.weaponLocked) {
      for (var i = 0; i < tut.picks.length; i++) {
        if (inMarker(trial, tut.picks[i])) T.takeWeapon(trial, tut.picks[i].weapon);
      }
    }

    /* the hide beat needs a running total, not a single frame */
    if (tut.beatId === 'hide') {
      if (trial.player.hidden) tut.hideTime += dt;
      else tut.hideTime = Math.max(0, tut.hideTime - dt * 0.5);
    }

    var beat = BEATS[tut.index];
    if (beat && beat.done(trial)) advance(trial);
  };

  /* Called from Enemy.hurt, so it fires for arrows as well as melee. */
  T.onEnemyHurt = function (trial, enemy) {
    var tut = trial.tut;
    if (!tut || tut.beatId !== 'strike' || enemy !== tut.dummy) return;
    tut.hits++;
    trial.floater(enemy.x, enemy.y - 62, Math.min(tut.hits, 3) + ' / 3', '#cfe8ff');
  };

  T.onPlayerDodge = function (trial) {
    var tut = trial.tut;
    if (!tut || tut.beatId !== 'dodge') return;
    tut.dodges++;
    trial.floater(trial.player.x, trial.player.y - 56, tut.dodges + ' / 2', '#cfe8ff');
  };

  T.onEnemyKilled = function (trial, enemy) {
    var tut = trial.tut;
    if (!tut) return;
    if (enemy === tut.warden) {
      /* Same rules as the idle-unlock secret: Save.blank() clears
         scytheUnlocked, weapons.scythe and weapon, so a New Game or a full
         reset strips it with no extra bookkeeping here. */
      trial.game.unlockScythe();
      trial.player.weaponId = 'scythe';
      trial.floater(enemy.x, enemy.y - 70, 'SCYTHE', '#d8e0e8');
      trial.setMessage('Its scythe is yours. Walk into the gate to go home.', 5);
      say(trial, 'You took the Warden\'s scythe. Walk into the gate to go home.');
      Audio.music(null);
    }
  };

  function revive(trial) {
    var tut = trial.tut;
    var p = trial.player;
    tut.revives++;
    p.dead = false;
    p.hp = p.stats.maxHp;
    p.stamina = p.stats.maxStamina;
    p.invuln = 2;
    p.x = REVIVE.x; p.y = REVIVE.y;
    p.facing = -Math.PI / 2;
    trial.burst(p.x, p.y - 20, 24, '#9b6bff');
    Audio.play('warp');

    /* The Warden is the one thing you get a single attempt at, so the scythe
       stays worth having. Everything else you simply try again. */
    if (tut.beatId === 'warden' && tut.warden && !tut.warden.dead) {
      tut.warden.dead = true;
      trial.boss = null;
      for (var i = trial.enemies.length - 1; i >= 0; i--) trial.enemies[i].dead = true;
      Audio.music(null);
      trial.setMessage('The Warden lets you go. The scythe stays with it.', 4);
      say(trial, 'You lost the Warden. Walk into the gate to go home.');
    } else {
      trial.setMessage('Down, but not out. Try that again.', 2.6);
    }
  }

  /* ------------------------------------------------------------- rewards */

  /* Standing on a pedestal is a fitting, not a purchase. Nothing is written to
     the save until commitWeapon, so stepping on the wrong circle costs you
     nothing and you can keep swapping - including mid-fight - right up until
     the pedestals close. */
  T.takeWeapon = function (trial, id) {
    var tut = trial.tut;
    if (tut.chosenWeapon === id) return false;
    tut.chosenWeapon = id;
    trial.player.weaponId = id;
    /* a swing or a cooldown belonging to the weapon you just put down */
    trial.player.atkState = null;
    trial.player.atkDef = null;
    trial.player.specialCd = 0;
    for (var i = 0; i < tut.picks.length; i++) {
      var m = tut.picks[i];
      m.colour = m.weapon === id ? '#7fe08a' : '#ffe45c';
    }
    trial.burst(trial.player.x, trial.player.y - 20, 20, '#ffe45c');
    trial.floater(trial.player.x, trial.player.y - 54, D.WEAPONS[id].name, '#ffe45c');
    Audio.play('confirm');
    trial.setMessage(D.WEAPONS[id].name + ' - ' + D.WEAPONS[id].blurb, 4);
    return true;
  };

  /* Closes the pedestals and writes the held weapon to the save. Only the one
     you walk away with is granted - the other two stay in the Trial Shop. */
  T.commitWeapon = function (trial) {
    var tut = trial.tut;
    if (tut.weaponLocked) return;
    tut.weaponLocked = true;
    var id = tut.chosenWeapon || 'sword';
    var sv = trial.game.save;
    sv.weapons[id] = true;
    sv.weapon = id;
    trial.player.weaponId = id;
    V.Save.write(sv);
    for (var i = 0; tut.picks && i < tut.picks.length; i++) {
      tut.picks[i].active = false;
      tut.picks[i].hidden = true;
    }
    for (var j = 0; tut.pickLabels && j < tut.pickLabels.length; j++) tut.pickLabels[j].hidden = true;
    if (tut.dummy && !tut.dummy.dead) {
      trial.burst(tut.dummy.x, tut.dummy.y - 20, 18, '#d8c188');
      tut.dummy.dead = true;
    }
    trial.setMessage('You are keeping the ' + D.WEAPONS[id].name + '.', 3);
  };

  /* Pause-menu escape hatch. Hands over everything the beats would have given
     you except the Warden's scythe, so skipping is a shortcut and not a
     penalty - and never leaves you standing in trial 1 empty-handed. */
  T.skip = function (trial) {
    var sv = trial.game.save;
    T.commitWeapon(trial);
    if (!sv.weapons.sword) sv.weapons.sword = true;
    if (!sv.weapon || sv.weapon === 'none') sv.weapon = 'sword';
    if (!sv.gem) sv.gem = { id: D.GEM_IDS[Math.floor(Math.random() * D.GEM_IDS.length)] };
    V.Save.write(sv);
    trial.player.weaponId = sv.weapon;
    trial.persistentPrompt = null;
    trial.lockedActions = null;
    Audio.music(null);
    trial.objectiveDone = true;
  };

  /* the HUD's top-right progress readout */
  T.progressText = function (trial) {
    var tut = trial.tut;
    if (!tut) return '';
    return 'Step ' + (tut.index + 1) + ' / ' + BEATS.length;
  };

  T.BEATS = BEATS;
  T.beatIds = function () {
    var ids = [];
    for (var i = 0; i < BEATS.length; i++) ids.push(BEATS[i].id);
    return ids;
  };

  V.Tutorial = T;
})(window.V = window.V || {});
