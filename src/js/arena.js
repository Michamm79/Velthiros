/* Velthiros - the trial arena: generation, objectives, scoring, world rendering */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, E = V.E, Audio = V.Audio;

  /* The GDD specifies a 30s crossing. Playtesting said the game felt sluggish,
     so the arena grew and the player got much faster: 2500u across at 140u/s
     is ~18s edge to edge, with everything else scaled to match. */
  var ARENA_R = 1250;
  var BARRIER_R = ARENA_R + 40;

  function Trial(game, spec) {
    this.game = game;
    this.spec = spec;                       /* {index,type,env,seed,boss,wave,label} */
    this.env = spec.env;
    this.rng = U.rng(spec.seed);
    this.input = game.input;
    this.t = 0;
    this.state = 'intro';                   /* intro -> play -> done */
    this.introTimer = 2.4;
    this.result = null;
    this.shakeAmt = 0; this.shakeTime = 0;
    this.cam = { x: 0, y: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.swipes = [];
    this.props = [];       /* barrier + decoration, non-interactive */
    this.cover = [];       /* bushes/crates: hiding spots */
    this.blocks = [];      /* puzzle blocks */
    this.plates = [];      /* puzzle plates */
    this.hints = [];       /* word puzzle hint glyphs */
    this.pickups = [];
    this.kills = 0;
    this.paused = false;
    this.timeLimit = 0;
    this.timeLeft = 0;
    this.objectiveDone = false;
    this.objectiveFailed = false;
    this.spawnQueue = [];
    this.message = null; this.messageTime = 0;

    this.stats = V.Save.resolveStats(game.save);
    this.player = new E.Player(this.stats, game.save.weapon, this);
    this.player.drawScale = 1.8;
    this.player.tint = game.playerTint();

    this.consumables = game.consumableCounts();

    this.build();
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
  }

  /* ==================================================================== gen */
  Trial.prototype.build = function () {
    var r = this.rng, i, a, d;

    /* barrier ring (GDD 5: player cannot leave) */
    var ringCount = 104;
    for (i = 0; i < ringCount; i++) {
      a = (i / ringCount) * U.TAU;
      var jitter = r.range(-14, 14);
      this.props.push({
        x: Math.cos(a) * (BARRIER_R + jitter),
        y: Math.sin(a) * (BARRIER_R + jitter),
        kind: this.env.barrier, s: r.range(1.0, 1.35), seed: r.int(0, 9999), solid: true
      });
    }
    /* a second, sparser row for depth */
    for (i = 0; i < ringCount; i += 2) {
      a = (i / ringCount) * U.TAU + 0.04;
      this.props.push({
        x: Math.cos(a) * (BARRIER_R + 62), y: Math.sin(a) * (BARRIER_R + 62),
        kind: this.env.barrier, s: r.range(0.9, 1.2), seed: r.int(0, 9999)
      });
    }

    /* cover (GDD 5 + 7.3) */
    var bushes = 44 + r.int(0, 16);
    for (i = 0; i < bushes; i++) {
      a = r() * U.TAU; d = Math.sqrt(r()) * (ARENA_R - 120);
      this.cover.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        kind: this.env.cover, s: r.range(0.9, 1.3), seed: r.int(0, 9999), r: 46
      });
    }

    /* ground litter */
    for (i = 0; i < 300; i++) {
      a = r() * U.TAU; d = Math.sqrt(r()) * (ARENA_R - 40);
      this.props.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d,
        kind: r.chance(0.45) ? 'tuft' : this.env.litter,
        s: r.range(0.7, 1.3), seed: r.int(0, 9999)
      });
    }

    /* player start: near the south edge, looking in */
    this.player.x = 0;
    this.player.y = ARENA_R * 0.62;
    this.player.facing = -Math.PI / 2;

    this.setupObjective();
  };

  Trial.prototype.randomPoint = function (minD, maxD, awayFromPlayer) {
    var r = this.rng;
    for (var tries = 0; tries < 40; tries++) {
      var a = r() * U.TAU;
      var d = U.lerp(minD, maxD, Math.sqrt(r()));
      var x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (!awayFromPlayer || U.dist2(x, y, this.player.x, this.player.y) > awayFromPlayer * awayFromPlayer) {
        return { x: x, y: y };
      }
    }
    return { x: 0, y: 0 };
  };

  /* difficulty ramp across the 50-trial demo */
  Trial.prototype.tier = function () {
    return 1 + (this.spec.index - 1) / D.TOTAL_TRIALS * 1.9;   /* 1.0 -> ~2.9 */
  };

  Trial.prototype.setupObjective = function () {
    var r = this.rng, i, p;
    var tier = this.tier();
    var scaleOpts = { hpScale: 0.8 + tier * 0.35, dmgScale: 0.75 + tier * 0.28, speedScale: 0.9 + tier * 0.08 };
    this.scaleOpts = scaleOpts;

    if (this.spec.boss) {
      this.type = 'boss';
      this.objective = { text: 'Defeat the ' + (this.spec.finalBoss ? 'Aurelith' : 'Reaper') };
      this.timeLimit = this.spec.finalBoss ? 300 : 180;
      var bossId = this.spec.finalBoss ? 'aurelith' : 'reaper';
      var boss = this.spawnEnemy(bossId, 0, -ARENA_R * 0.35, {
        hpScale: 0.7 + tier * 0.5, dmgScale: 0.8 + tier * 0.22, speedScale: 1
      });
      this.boss = boss;
      for (i = 0; i < 2 + Math.floor(tier); i++) {
        p = this.randomPoint(200, ARENA_R - 150, 340);
        this.spawnEnemy('goblin', p.x, p.y, scaleOpts);
      }
      this.par = boss.maxHp * 1.5 + 220;
      this.timeLeft = this.timeLimit;
      return;
    }

    this.type = this.spec.type;

    switch (this.type) {
      case 'defeat': {
        var target = 6 + Math.round(tier * 5);
        this.target = target;
        this.timeLimit = 90 + target * 4;
        this.objective = { text: 'Defeat ' + target + ' enemies' };
        var inField = Math.min(target, 5 + Math.floor(tier * 2));
        for (i = 0; i < inField; i++) {
          p = this.randomPoint(160, ARENA_R - 120, 320);
          this.spawnEnemy(this.pickEnemy(tier, r), p.x, p.y, scaleOpts);
        }
        this.remainingToSpawn = target - inField;
        this.par = target * 26 + this.timeLimit * 1.1;
        break;
      }
      case 'defend': {
        this.timeLimit = 60 + Math.round(tier * 22);
        this.zone = { x: 0, y: 0, r: 210, hp: 100, maxHp: 100 };
        this.objective = { text: 'Hold the ground for ' + Math.round(this.timeLimit) + 's' };
        this.player.x = 0; this.player.y = 120;
        this.waveTimer = 2;
        this.par = this.timeLimit * 12 + 380;
        break;
      }
      case 'deliver': {
        this.timeLimit = 100 + Math.round(tier * 12);
        var rp = this.randomPoint(ARENA_R * 0.5, ARENA_R - 130, 500);
        this.relic = { x: rp.x, y: rp.y, taken: false };
        /* delivery point roughly opposite the relic */
        var ra = Math.atan2(rp.y, rp.x) + Math.PI;
        this.delivery = { x: Math.cos(ra) * ARENA_R * 0.6, y: Math.sin(ra) * ARENA_R * 0.6, r: 95 };
        this.objective = { text: 'Collect the relic, deliver it' };
        for (i = 0; i < 4 + Math.floor(tier * 3); i++) {
          p = this.randomPoint(220, ARENA_R - 120, 300);
          this.spawnEnemy(this.pickEnemy(tier, r), p.x, p.y, scaleOpts);
        }
        this.par = 560 + this.timeLimit * 2.2;
        break;
      }
      case 'puzzle': {
        this.timeLimit = 130;
        var n = 3;
        this.objective = { text: 'Push the stones onto the marks' };
        for (i = 0; i < n; i++) {
          var ang = (i / n) * U.TAU + r() * 0.6;
          this.blocks.push({ x: Math.cos(ang) * 330, y: Math.sin(ang) * 330, r: 34, done: false });
          this.plates.push({ x: Math.cos(ang + 0.9) * 720, y: Math.sin(ang + 0.9) * 720, r: 56, filled: false });
        }
        for (i = 0; i < 2 + Math.floor(tier); i++) {
          p = this.randomPoint(300, ARENA_R - 150, 420);
          this.spawnEnemy('goblin', p.x, p.y, scaleOpts);
        }
        this.par = 520 + this.timeLimit * 2.4;
        break;
      }
      case 'word': {
        this.timeLimit = 150;
        var pool = D.RIDDLES;
        var q = pool[this.spec.seed % pool.length];
        var opts = r.shuffle([q.a].concat(q.wrong.slice(0, 3)));
        this.riddle = { q: q.q, answer: q.a, options: opts, revealed: 0, answered: false, correct: false };
        this.objective = { text: 'Find 3 hints, then answer' };
        for (i = 0; i < 3; i++) {
          p = this.randomPoint(300, ARENA_R - 150, 300);
          this.hints.push({ x: p.x, y: p.y, found: false });
        }
        for (i = 0; i < 2 + Math.floor(tier * 1.5); i++) {
          p = this.randomPoint(300, ARENA_R - 150, 420);
          this.spawnEnemy('goblin', p.x, p.y, scaleOpts);
        }
        this.par = 540 + this.timeLimit * 2.3;
        break;
      }
      case 'hide': {
        this.timeLimit = 55 + Math.round(tier * 16);
        this.objective = { text: 'Survive unseen for ' + Math.round(this.timeLimit) + 's' };
        this.spottedTime = 0;
        var hunters = 4 + Math.floor(tier * 2.5);
        for (i = 0; i < hunters; i++) {
          p = this.randomPoint(340, ARENA_R - 120, 420);
          var h = this.spawnEnemy(this.pickEnemy(tier, r), p.x, p.y, scaleOpts);
          h.def = Object.create(h.def);
          h.def.sight = h.def.sight * 1.3;
        }
        this.par = this.timeLimit * 9 + 200;
        break;
      }
      case 'seek': {
        this.timeLimit = 120;
        var hidden = 4 + Math.floor(tier * 1.6);
        this.target = hidden;
        this.objective = { text: 'Find and defeat ' + hidden + ' hidden enemies' };
        var spots = r.shuffle(this.cover.slice());
        for (i = 0; i < hidden; i++) {
          var sp = spots[i % spots.length];
          this.spawnEnemy(this.pickEnemy(tier, r), sp.x + r.range(-14, 14), sp.y + r.range(-14, 14),
            Object.assign({ hiding: true }, scaleOpts));
        }
        this.par = hidden * 46 + this.timeLimit * 2.2;
        break;
      }
    }
    this.timeLeft = this.timeLimit;
  };

  Trial.prototype.pickEnemy = function (tier, r) {
    /* Minotaurs are the difficulty-spike enemy introduced as you level (GDD 7.2) */
    var minoChance = U.clamp((tier - 1.25) * 0.5, 0, 0.42);
    return r.chance(minoChance) ? 'minotaur' : 'goblin';
  };

  /* ============================================================ world hooks */
  Trial.prototype.spawnEnemy = function (id, x, y, opts) {
    var e = new E.Enemy(id, x, y, this, opts || this.scaleOpts);
    e.drawScale = 1.8;
    this.enemies.push(e);
    return e;
  };

  Trial.prototype.spawnArrow = function (x, y, a, sp, dmg, range, pierce) {
    this.projectiles.push(new E.Projectile(x, y, a, sp, dmg, range, { pierce: pierce }));
  };

  Trial.prototype.spawnBolt = function (x, y, a, sp, dmg) {
    this.projectiles.push(new E.Projectile(x, y, a, sp, dmg, 900, { hostile: true, colour: '#ff9ec4' }));
  };

  Trial.prototype.confine = function (ent) {
    U.confineToCircle(ent, 0, 0, ARENA_R - (ent.radius || 12));
  };

  Trial.prototype.insideArena = function (x, y, pad) {
    return U.dist2(x, y, 0, 0) < (ARENA_R - (pad || 0)) * (ARENA_R - (pad || 0));
  };

  Trial.prototype.inCover = function (x, y) {
    for (var i = 0; i < this.cover.length; i++) {
      var c = this.cover[i];
      if (U.dist2(x, y, c.x, c.y) < c.r * c.r) return c;
    }
    return null;
  };

  Trial.prototype.shake = function (amt, time) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeTime = Math.max(this.shakeTime, time);
  };

  Trial.prototype.burst = function (x, y, n, colour) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * U.TAU, sp = 40 + Math.random() * 130;
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4, max: 0.7, r: 2 + Math.random() * 3, colour: colour
      });
    }
  };

  Trial.prototype.dust = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        life: 0.35, max: 0.35, r: 3 + Math.random() * 3, colour: 'rgba(255,255,255,0.7)'
      });
    }
  };

  Trial.prototype.floater = function (x, y, text, colour) {
    this.floaters.push({ x: x, y: y, text: text, colour: colour, life: 0.9, max: 0.9 });
  };

  Trial.prototype.swipe = function (x, y, angle, range, halfArc, kind) {
    this.swipes.push({ x: x, y: y, angle: angle, range: range, halfArc: halfArc, kind: kind, life: 0.18, max: 0.18 });
  };

  Trial.prototype.meleeProps = function (p, halfArc, range) {
    /* melee shoves puzzle blocks */
    for (var i = 0; i < this.blocks.length; i++) {
      var b = this.blocks[i];
      if (U.inArc(p.x, p.y, p.facing, halfArc, range + b.r, b.x, b.y)) {
        b.x += Math.cos(p.facing) * 64;
        b.y += Math.sin(p.facing) * 64;
        U.confineToCircle(b, 0, 0, ARENA_R - 60);
      }
    }
  };

  Trial.prototype.onEnemyKilled = function (e) {
    this.kills++;
    if (this.type === 'seek') this.foundCount = (this.foundCount || 0) + 1;
  };

  /* ================================================================ update */
  Trial.prototype.update = function (dt) {
    this.t += dt;

    if (this.state === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) { this.state = 'play'; Audio.music(this.spec.boss ? 'boss' : 'trial'); }
      return;
    }
    if (this.state === 'done') { this.updateFx(dt); return; }
    if (this.paused) return;

    var p = this.player, i;

    /* ---- input ---- */
    var In = this.input;
    if (In.wasPressed('attack')) {
      if (this.riddle && !this.riddle.answered && this.nearAnswerPad()) { /* handled in HUD taps */ }
      else p.tryAttack(false);
    }
    if (In.wasPressed('special')) p.tryAttack(true);
    if (In.wasPressed('dodge')) p.tryDodge();
    if (In.wasPressed('item')) this.useConsumable();

    p.update(dt, In);

    /* ---- entities ---- */
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt);
    for (i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt, this);
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
    this.separate();
    this.updateFx(dt);

    /* ---- pickups ---- */
    for (i = this.pickups.length - 1; i >= 0; i--) {
      var pk = this.pickups[i];
      if (U.dist2(pk.x, pk.y, p.x, p.y) < 54 * 54) {
        this.pickups.splice(i, 1);
        if (pk.kind === 'coin') { this.bonusCoins = (this.bonusCoins || 0) + pk.value; Audio.play('coin'); }
        else if (pk.kind === 'heal') { p.heal(30); Audio.play('pickup'); }
      }
    }

    /* ---- timer & objective ---- */
    this.timeLeft -= dt;
    this.updateObjective(dt);

    if (p.dead) return this.finish('death');
    if (this.objectiveDone) return this.finish('complete');
    if (this.objectiveFailed) return this.finish('objective');
    if (this.timeLeft <= 0) return this.finish(this.type === 'hide' || this.type === 'defend' ? 'complete' : 'timeout');
  };

  Trial.prototype.updateFx = function (dt) {
    var i;
    for (i = this.particles.length - 1; i >= 0; i--) {
      var pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.05, dt); pt.vy *= Math.pow(0.05, dt);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (i = this.floaters.length - 1; i >= 0; i--) {
      this.floaters[i].life -= dt;
      this.floaters[i].y -= 26 * dt;
      if (this.floaters[i].life <= 0) this.floaters.splice(i, 1);
    }
    for (i = this.swipes.length - 1; i >= 0; i--) {
      this.swipes[i].life -= dt;
      if (this.swipes[i].life <= 0) this.swipes.splice(i, 1);
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeAmt = 0;
    }
    if (this.messageTime > 0) {
      this.messageTime -= dt;
      if (this.messageTime <= 0) this.message = null;
    }
  };

  /* keep bodies from stacking */
  Trial.prototype.separate = function () {
    var list = this.enemies;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        var minD = a.radius + b.radius;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > minD * minD || d2 < 0.001) continue;
        var d = Math.sqrt(d2);
        var push = (minD - d) / 2;
        var ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
    /* blocks push against the player */
    for (var k = 0; k < this.blocks.length; k++) {
      var bl = this.blocks[k], p = this.player;
      var ddx = bl.x - p.x, ddy = bl.y - p.y;
      var dd = Math.sqrt(ddx * ddx + ddy * ddy);
      var need = bl.r + p.radius;
      if (dd < need && dd > 0.001) {
        var over = need - dd;
        bl.x += (ddx / dd) * over;
        bl.y += (ddy / dd) * over;
        U.confineToCircle(bl, 0, 0, ARENA_R - 60);
      }
    }
  };

  Trial.prototype.setMessage = function (txt, time) {
    this.message = txt;
    this.messageTime = time || 2.2;
  };

  Trial.prototype.updateObjective = function (dt) {
    var p = this.player, i;

    switch (this.type) {
      case 'boss': {
        if (this.boss.dead || this.enemies.indexOf(this.boss) < 0) this.objectiveDone = true;
        break;
      }
      case 'defeat': {
        /* trickle in the remainder */
        if (this.remainingToSpawn > 0 && this.enemies.length < 6) {
          var sp = this.randomPoint(ARENA_R * 0.5, ARENA_R - 120, 380);
          this.spawnEnemy(this.pickEnemy(this.tier(), this.rng), sp.x, sp.y, this.scaleOpts);
          this.remainingToSpawn--;
        }
        if (this.kills >= this.target) this.objectiveDone = true;
        break;
      }
      case 'defend': {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
          this.waveTimer = Math.max(1.6, 5.2 - this.tier() * 0.9);
          var n = 1 + Math.floor(this.tier());
          for (i = 0; i < n; i++) {
            var a = Math.random() * U.TAU;
            this.spawnEnemy(this.pickEnemy(this.tier(), this.rng),
              Math.cos(a) * (ARENA_R - 60), Math.sin(a) * (ARENA_R - 60), this.scaleOpts);
          }
        }
        /* enemies inside the zone chew on it */
        for (i = 0; i < this.enemies.length; i++) {
          var e = this.enemies[i];
          if (U.dist2(e.x, e.y, this.zone.x, this.zone.y) < this.zone.r * this.zone.r) {
            this.zone.hp -= 7 * dt;
          }
        }
        if (this.zone.hp <= 0) { this.zone.hp = 0; this.objectiveFailed = true; }
        break;
      }
      case 'deliver': {
        if (!this.relic.taken && U.dist2(p.x, p.y, this.relic.x, this.relic.y) < 58 * 58) {
          this.relic.taken = true;
          p.carrying = 'relic';
          Audio.play('pickup');
          this.setMessage('Relic taken - get it to the marker');
        }
        if (this.relic.taken && U.dist2(p.x, p.y, this.delivery.x, this.delivery.y) < this.delivery.r * this.delivery.r) {
          this.objectiveDone = true;
        }
        break;
      }
      case 'puzzle': {
        var solved = 0;
        for (i = 0; i < this.plates.length; i++) {
          var pl = this.plates[i];
          pl.filled = false;
          for (var b = 0; b < this.blocks.length; b++) {
            if (U.dist2(this.blocks[b].x, this.blocks[b].y, pl.x, pl.y) < pl.r * pl.r) { pl.filled = true; break; }
          }
          if (pl.filled) solved++;
        }
        if (solved !== this.lastSolved) {
          if (solved > (this.lastSolved || 0)) Audio.play('confirm');
          this.lastSolved = solved;
        }
        if (solved >= this.plates.length) this.objectiveDone = true;
        break;
      }
      case 'word': {
        for (i = 0; i < this.hints.length; i++) {
          var h = this.hints[i];
          if (!h.found && U.dist2(p.x, p.y, h.x, h.y) < 62 * 62) {
            h.found = true;
            this.riddle.revealed++;
            Audio.play('pickup');
            this.setMessage('Hint ' + this.riddle.revealed + '/3 found');
          }
        }
        if (this.riddle.answered) {
          if (this.riddle.correct) this.objectiveDone = true;
          else this.objectiveFailed = true;
        }
        break;
      }
      case 'hide': {
        var spotted = false;
        for (i = 0; i < this.enemies.length; i++) {
          if (this.enemies[i].state === 'chase' || this.enemies[i].state === 'windup' ||
              this.enemies[i].state === 'charge') { spotted = true; break; }
        }
        if (spotted) this.spottedTime += dt;
        this.spotted = spotted;
        break;
      }
      case 'seek': {
        var left = 0;
        for (i = 0; i < this.enemies.length; i++) if (!this.enemies[i].dead) left++;
        this.enemiesLeft = left;
        if (left === 0) this.objectiveDone = true;
        break;
      }
    }
  };

  Trial.prototype.useConsumable = function () {
    var g = this.game;
    if (this.consumables.potion > 0 && this.player.hp < this.stats.maxHp * 0.75) {
      this.consumables.potion--; g.spendConsumable('c_potion');
      this.player.heal(50); Audio.play('pickup');
      this.floater(this.player.x, this.player.y - 50, '+50', '#7fe08a');
      return;
    }
    if (this.consumables.tonic > 0 && this.player.stamina < this.stats.maxStamina * 0.5) {
      this.consumables.tonic--; g.spendConsumable('c_tonic');
      this.player.stamina = this.stats.maxStamina; Audio.play('pickup');
      return;
    }
    if (this.consumables.smoke > 0) {
      this.consumables.smoke--; g.spendConsumable('c_smoke');
      this.player.smokeTimer = 6;
      for (var i = 0; i < this.enemies.length; i++) {
        this.enemies[i].state = 'idle'; this.enemies[i].stateTime = 0;
      }
      this.burst(this.player.x, this.player.y, 26, 'rgba(220,220,230,0.9)');
      Audio.play('dodge');
      this.setMessage('Smoke - they lost you');
      return;
    }
    Audio.play('deny');
  };

  Trial.prototype.answerRiddle = function (choice) {
    if (!this.riddle || this.riddle.answered) return;
    this.riddle.answered = true;
    this.riddle.correct = (choice === this.riddle.answer);
    Audio.play(this.riddle.correct ? 'confirm' : 'deny');
  };

  Trial.prototype.nearAnswerPad = function () { return this.riddle && this.riddle.revealed >= 3; };

  /* ================================================================ scoring */
  Trial.prototype.finish = function (reason) {
    if (this.state === 'done') return;
    this.state = 'done';
    Audio.music(null);

    var score = 0;
    var timeBonus = Math.max(0, this.timeLeft) * 1.5;    /* retuned after the speed pass */
    var killScore = 0;
    /* the enemies list only holds the living; count kills directly */
    killScore = this.kills * 16;
    var damagePenalty = this.player.damageTaken * 0.75;

    var completed = (reason === 'complete');
    if (completed) {
      score += this.par * 0.68;
      score += timeBonus;
    }
    score += killScore;

    if (this.type === 'hide') {
      /* rewarded for staying unseen, not for kills */
      var unseen = Math.max(0, this.timeLimit - this.spottedTime);
      score = (completed ? this.par * 0.5 : 0) + unseen * 5 + killScore * 0.5;
    }
    if (this.type === 'defend' && completed) {
      score += (this.zone.hp / this.zone.maxHp) * this.par * 0.22;
    }
    if (this.type === 'word' && completed) {
      score += (3 - this.riddle.revealed) * 40; /* answering on fewer hints scores higher */
    }
    if (this.type === 'boss' && completed) {
      score += this.boss ? this.boss.maxHp * 0.3 : 0;
    }

    score -= damagePenalty;
    if (reason === 'death') score = Math.min(score, this.par * 0.2);
    if (reason === 'timeout' || reason === 'objective') score = Math.min(score, this.par * 0.55);
    score = Math.max(0, Math.round(score));

    /* GDD 6.2: ratio 1.0 => top 25%, 0.8 => 40% boundary */
    var ratio = score / Math.max(1, this.par);
    var percentile = U.clamp(Math.round(100 - 75 * ratio), 1, 99);
    if (reason === 'death') percentile = Math.max(percentile, 62);

    var tier = D.RANK_TIERS[2];
    for (var i = 0; i < D.RANK_TIERS.length; i++) {
      if (percentile <= D.RANK_TIERS[i].max) { tier = D.RANK_TIERS[i]; break; }
    }

    this.result = {
      reason: reason,
      completed: completed,
      score: score,
      par: Math.round(this.par),
      percentile: percentile,
      tier: tier,
      kills: this.kills,
      timeLeft: Math.max(0, this.timeLeft),
      damageTaken: Math.round(this.player.damageTaken),
      bonusCoins: this.bonusCoins || 0,
      died: reason === 'death',
      trial: this.spec
    };
    Audio.play(tier.outcome === 'fail' ? 'lose' : 'win');
    this.game.onTrialFinished(this.result);
  };

  /* ================================================================= render */
  Trial.prototype.zoom = function (cw, ch) {
    /* the arena is 2500u across, so pull the camera back enough to read it */
    return U.clamp(Math.min(cw, ch * 1.75) / 1150, 0.42, 1.0);
  };

  Trial.prototype.render = function (ctx, cw, ch) {
    var p = this.player;
    var zoom = this.zoom(cw, ch);

    /* camera lead + smoothing */
    var lead = 130;
    var tx = p.x + Math.cos(p.facing) * lead * 0.35;
    var ty = p.y + Math.sin(p.facing) * lead * 0.35;
    this.cam.x = U.lerp(this.cam.x, tx, 0.16);
    this.cam.y = U.lerp(this.cam.y, ty, 0.16);

    var shakeX = 0, shakeY = 0;
    if (this.shakeTime > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeAmt;
      shakeY = (Math.random() - 0.5) * this.shakeAmt;
    }

    ctx.fillStyle = this.env.sky;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(cw / 2 + shakeX, ch / 2 + shakeY);
    ctx.scale(zoom, zoom);

    var self = this;
    function P(x, y) { return { x: x - self.cam.x, y: (y - self.cam.y) * Art.SQUASH }; }
    this.project = P;

    this.drawGround(ctx, P);

    /* build the depth-sorted draw list */
    var list = [];
    var i, s;

    for (i = 0; i < this.props.length; i++) {
      var pr = this.props[i];
      list.push({ y: pr.y, fn: makePropDraw(ctx, pr, P, this.t) });
    }
    for (i = 0; i < this.cover.length; i++) {
      var cv = this.cover[i];
      list.push({ y: cv.y, fn: makePropDraw(ctx, cv, P, this.t) });
    }
    for (i = 0; i < this.blocks.length; i++) {
      list.push({ y: this.blocks[i].y, fn: makePropDraw(ctx, { x: this.blocks[i].x, y: this.blocks[i].y, kind: 'stone', s: 1.25, seed: i }, P, this.t) });
    }
    for (i = 0; i < this.enemies.length; i++) {
      (function (e) {
        var sp = P(e.x, e.y);
        e.sx = sp.x; e.sy = sp.y;
        list.push({ y: e.y, fn: function () { e.draw(ctx, self.t); } });
      })(this.enemies[i]);
    }
    (function (pl) {
      var sp = P(pl.x, pl.y);
      pl.sx = sp.x; pl.sy = sp.y;
      list.push({ y: pl.y + 0.1, fn: function () { pl.draw(ctx, self.t); } });
    })(p);

    for (i = 0; i < this.projectiles.length; i++) {
      (function (pj) {
        var sp = P(pj.x, pj.y);
        pj.sx = sp.x; pj.sy = sp.y - 24;
        for (var k = 0; k < pj.trail.length; k++) {
          var tp = P(pj.trail[k].x, pj.trail[k].y);
          pj.trail[k].sx = tp.x; pj.trail[k].sy = tp.y - 24;
        }
        list.push({ y: pj.y, fn: function () { pj.draw(ctx); } });
      })(this.projectiles[i]);
    }

    /* objective markers sit on the ground, drawn before actors of the same row */
    this.drawObjectiveGround(ctx, P);

    list.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < list.length; i++) list[i].fn();

    this.drawFx(ctx, P);
    this.drawObjectiveOverlay(ctx, P);

    ctx.restore();
  };

  function makePropDraw(ctx, pr, P, t) {
    return function () {
      var sp = P(pr.x, pr.y);
      V.Art.drawProp(ctx, pr.kind, sp.x, sp.y, pr.s, pr.seed || 0, t);
    };
  }

  /* a small tile of two-tone dither, built once per environment */
  Trial.prototype.groundPattern = function (ctx) {
    if (this._pat !== undefined) return this._pat;
    if (typeof document === 'undefined') { this._pat = null; return null; }
    var size = 24;
    var tile = document.createElement('canvas');
    tile.width = tile.height = size;
    var tc = tile.getContext('2d');
    var rr = U.rng(U.hash(this.env.id));
    var i;
    tc.fillStyle = this.env.ground2;
    for (i = 0; i < size * size * 0.16; i++) tc.fillRect(rr.int(0, size - 2), rr.int(0, size - 2), 2, 2);
    tc.fillStyle = this.env.accent;
    for (i = 0; i < size * size * 0.05; i++) tc.fillRect(rr.int(0, size - 2), rr.int(0, size - 2), 2, 2);
    this._pat = ctx.createPattern(tile, 'repeat');
    return this._pat;
  };

  Trial.prototype.drawGround = function (ctx, P) {
    var c = P(0, 0);
    var r = ARENA_R;
    /* arena disc */
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * Art.SQUASH, 0, 0, U.TAU);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = this.env.ground;
    ctx.fillRect(c.x - r - 10, c.y - r - 10, r * 2 + 20, r * 2 + 20);

    /* dithered ground texture instead of a flat checker - reads as pixel art
       and, being anchored to the world origin, it scrolls with the map */
    var pat = this.groundPattern(ctx);
    if (pat) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = pat;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    /* edge vignette */
    var grd = ctx.createRadialGradient(c.x, c.y, r * 0.55, c.x, c.y, r);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(20,26,18,0.28)');
    ctx.fillStyle = grd;
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(30,40,28,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * Art.SQUASH, 0, 0, U.TAU);
    ctx.stroke();
  };

  Trial.prototype.drawObjectiveGround = function (ctx, P) {
    var t = this.t, i, sp;
    if (this.zone) {
      sp = P(this.zone.x, this.zone.y);
      var frac = this.zone.hp / this.zone.maxHp;
      ctx.fillStyle = 'rgba(90,200,255,' + (0.10 + 0.05 * Math.sin(t * 2)) + ')';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, this.zone.r, this.zone.r * Art.SQUASH, 0, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = frac > 0.4 ? '#5ac8ff' : '#ff6a6a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, this.zone.r, this.zone.r * Art.SQUASH, 0, -Math.PI / 2, -Math.PI / 2 + U.TAU * frac);
      ctx.stroke();
    }
    if (this.delivery) {
      sp = P(this.delivery.x, this.delivery.y);
      ctx.strokeStyle = this.relic.taken ? '#7fe08a' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, this.delivery.r, this.delivery.r * Art.SQUASH, 0, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (i = 0; i < this.plates.length; i++) {
      sp = P(this.plates[i].x, this.plates[i].y);
      ctx.fillStyle = this.plates[i].filled ? 'rgba(120,240,150,0.28)' : 'rgba(255,228,92,0.16)';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, this.plates[i].r, this.plates[i].r * Art.SQUASH, 0, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = this.plates[i].filled ? '#7fe08a' : '#ffe45c';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  };

  Trial.prototype.drawObjectiveOverlay = function (ctx, P) {
    var t = this.t, sp, i;
    if (this.relic && !this.relic.taken) {
      sp = P(this.relic.x, this.relic.y);
      Art.drawRelic(ctx, sp.x, sp.y, t);
    }
    if (this.relic && this.relic.taken) {
      sp = P(this.player.x, this.player.y);
      Art.drawRelic(ctx, sp.x, sp.y - 58, t, '#ffd66b');
    }
    for (i = 0; i < this.hints.length; i++) {
      sp = P(this.hints[i].x, this.hints[i].y);
      if (!this.hints[i].found) Art.drawHintGlyph(ctx, sp.x, sp.y, t, false);
    }
    for (i = 0; i < this.pickups.length; i++) {
      sp = P(this.pickups[i].x, this.pickups[i].y);
      if (this.pickups[i].kind === 'coin') Art.drawCoin(ctx, sp.x, sp.y, t);
    }

    /* off-screen objective arrow */
    var target = null;
    if (this.relic && !this.relic.taken) target = this.relic;
    else if (this.delivery && this.relic && this.relic.taken) target = this.delivery;
    else if (this.zone) target = this.zone;
    if (target) this.drawGuide(ctx, P, target);
  };

  Trial.prototype.drawGuide = function (ctx, P, target) {
    var p = this.player;
    var d = U.dist(p.x, p.y, target.x, target.y);
    if (d < 330) return;
    var a = Math.atan2((target.y - p.y) * Art.SQUASH, target.x - p.x);
    var sp = P(p.x, p.y);
    ctx.save();
    ctx.translate(sp.x + Math.cos(a) * 70, sp.y - 30 + Math.sin(a) * 70);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,240,160,0.85)';
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  Trial.prototype.drawFx = function (ctx, P) {
    var i, sp;
    for (i = 0; i < this.swipes.length; i++) {
      var s = this.swipes[i];
      sp = P(s.x, s.y);
      var k = s.life / s.max;
      ctx.save();
      ctx.translate(sp.x, sp.y - 26);
      ctx.scale(1, Art.SQUASH);
      ctx.strokeStyle = s.kind === 'enemy' ? 'rgba(255,120,110,' + k * 0.7 + ')' : 'rgba(255,255,255,' + k * 0.75 + ')';
      ctx.lineWidth = 9 * k + 2;
      ctx.beginPath();
      ctx.arc(0, 0, s.range * (1.05 - k * 0.25), s.angle - s.halfArc, s.angle + s.halfArc);
      ctx.stroke();
      ctx.restore();
    }
    for (i = 0; i < this.particles.length; i++) {
      var pt = this.particles[i];
      sp = P(pt.x, pt.y);
      ctx.globalAlpha = U.clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.colour;
      Art.ellipse(ctx, sp.x, sp.y - 22, pt.r, pt.r); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    for (i = 0; i < this.floaters.length; i++) {
      var f = this.floaters[i];
      sp = P(f.x, f.y);
      ctx.globalAlpha = U.clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(f.text, sp.x + 1.5, sp.y + 1.5);
      ctx.fillStyle = f.colour;
      ctx.fillText(f.text, sp.x, sp.y);
    }
    ctx.globalAlpha = 1;
  };

  Trial.ARENA_R = ARENA_R;
  V.Trial = Trial;
})(window.V = window.V || {});
