/* Velthiros - player, enemies, projectiles, particles */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, Audio = V.Audio;
  var E = {};

  /* how long a dodge takes; the distance travelled is Save.resolveStats.dodgeDist */
  var DODGE_TIME = 0.2;
  var DODGE_COOLDOWN = 0.58;
  E.DODGE_TIME = DODGE_TIME;
  E.DODGE_COOLDOWN = DODGE_COOLDOWN;

  /* facing angle -> which of the three authored views to use */
  function viewOf(facing) {
    var sy = Math.sin(facing), sx = Math.cos(facing);
    if (Math.abs(sy) > 0.55) return { dir: sy > 0 ? 'down' : 'up', flip: false };
    return { dir: 'side', flip: sx < 0 };
  }
  /* a 4-step walk cycle: contact, left lift, contact, right lift */
  function walkFrame(phase, moving) {
    if (!moving) return 0;
    return [0, 1, 0, 2][Math.floor(phase) % 4];
  }
  E.viewOf = viewOf;
  E.walkFrame = walkFrame;

  /* ================================================================= PLAYER */
  function Player(stats, weaponId, world) {
    this.world = world;
    this.stats = stats;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0;
    this.radius = 15;
    this.facing = -Math.PI / 2;
    this.hp = stats.maxHp;
    this.stamina = stats.maxStamina;
    this.staminaLock = 0;
    this.weaponId = weaponId;
    this.animPhase = 0;
    this.moving = false;
    this.hurtFlash = 0;
    this.invuln = 0;
    this.dodgeCd = 0;
    this.dodgeTime = 0;
    this.atkState = null;
    this.atkKind = null;
    this.atkDef = null;
    this.atkTime = 0;
    this.specialCd = 0;
    this.hidden = false;
    this.hideAmount = 0;
    this.carrying = null;
    this.dead = false;
    this.lean = 0;
    this.drawScale = 1;
    this.smokeTimer = 0;
    this.damageTaken = 0;
    this.kills = 0;
    this.swingDir = 1;            /* flips each swing: left-to-right, then back */
  }

  Player.prototype.canAct = function () {
    return !this.dead && this.dodgeTime <= 0 && !this.atkState;
  };

  Player.prototype.moveScale = function () {
    if (this.atkState) {
      var w = D.WEAPONS[this.weaponId];
      return w.moveScale * (this.atkState === 'windup' ? 0.6 : 1);
    }
    return 1;
  };

  Player.prototype.update = function (dt, input) {
    if (this.dead) return;
    var w = this.world;

    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.staminaLock = Math.max(0, this.staminaLock - dt);
    this.smokeTimer = Math.max(0, this.smokeTimer - dt);

    if (this.staminaLock <= 0 && this.stamina < this.stats.maxStamina) {
      this.stamina = Math.min(this.stats.maxStamina, this.stamina + this.stats.staminaRegen * dt);
    }

    /* ------- dodge / glide ------- */
    if (this.dodgeTime > 0) {
      /* Only integrate the time actually left in the dodge. Stepping a full dt
         on the last frame overshot the distance by ~8% at 60fps and up to 25%
         on a stutter, so the same input travelled different distances. */
      var step = Math.min(dt, this.dodgeTime);
      this.dodgeTime -= dt;
      var dodgeSpeed = this.stats.dodgeDist / DODGE_TIME;
      this.x += Math.cos(this.dodgeAngle) * dodgeSpeed * step;
      this.y += Math.sin(this.dodgeAngle) * dodgeSpeed * step;
      this.z = this.stats.glide
        ? Math.sin(U.clamp(1 - this.dodgeTime / DODGE_TIME, 0, 1) * Math.PI) * 18 : 0;
      this.moving = true;
      this.animPhase += dt * 18;
      w.confine(this);
      return;
    }
    this.z = 0;

    /* ------- movement ------- */
    var mv = input.move;
    var sc = this.moveScale();
    if (mv.mag > 0.08) {
      var sp = this.stats.speed * mv.mag * sc;
      this.x += mv.x * sp * dt;
      this.y += mv.y * sp * dt;
      this.moving = true;
      if (!this.atkState) this.facing = Math.atan2(mv.y, mv.x);
      this.animPhase += dt * (9 + 14 * mv.mag);
    } else {
      this.moving = false;
      this.animPhase += dt * 2.2;
    }
    w.confine(this);

    /* ------- attack state machine ------- */
    if (this.atkState) {
      this.atkTime += dt;
      if (this.atkState === 'windup' && this.atkTime >= this.atkDef.windup) {
        this.resolveAttack();
        this.atkState = 'recover';
        this.atkTime = 0;
      } else if (this.atkState === 'recover' && this.atkTime >= this.atkDef.recover) {
        this.atkState = null;
        this.atkDef = null;
      }
    }

    /* ------- hiding (GDD 7.3) ------- */
    var wasHidden = this.hidden;
    var inBush = w.inCover(this.x, this.y);
    this.hidden = !!inBush && !this.atkState && mv.mag < 0.75;
    this.hideAmount = U.approach(this.hideAmount, this.hidden ? 1 : 0, dt * 5);
    if (this.hidden && !wasHidden) w.onHide && w.onHide();
  };

  Player.prototype.attackDuration = function () {
    return this.atkDef ? this.atkDef.windup + this.atkDef.recover : 0.3;
  };

  /* Soft lock-on: on the swing, snap to the most plausible target in a wide
     cone. There is no held lock — you still aim with the stick — but a target
     that reads as "in front of me" now counts as in front of you. */
  Player.prototype.aimAssist = function (def) {
    var world = this.world;
    var SQ = Art.SQUASH;
    var reach = Math.min(def.range || 100, 260) + 55;
    var fv = Math.atan2(Math.sin(this.facing) * SQ, Math.cos(this.facing));
    var best = null, bestCost = Infinity;

    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      if (e.dead || e.hiding) continue;
      var dx = e.x - this.x, dy = e.y - this.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach + e.radius) continue;
      var delta = Math.abs(U.angleDelta(fv, Math.atan2(dy * SQ, dx)));
      if (delta > 1.0) continue;                 /* ~57 degrees either side */
      var cost = delta * 90 + d * 0.35;          /* prefer aligned, then near */
      if (cost < bestCost) { bestCost = cost; best = e; }
    }
    if (best) this.facing = Math.atan2(best.y - this.y, best.x - this.x);
  };

  Player.prototype.tryAttack = function (special) {
    if (!this.canAct()) return false;
    var w = D.WEAPONS[this.weaponId];
    var def = special ? w.special : w;
    if (special && this.specialCd > 0) return false;
    if (this.stamina < def.stamina) { Audio.play('deny'); return false; }
    this.aimAssist(def);
    this.stamina -= def.stamina;
    this.staminaLock = 0.55;
    this.atkDef = def;
    this.atkKind = special ? 'special' : 'primary';
    this.atkState = 'windup';
    this.atkTime = 0;
    this.swingDir = -this.swingDir;
    if (special) this.specialCd = def.cooldown;
    Audio.play(w.kind === 'ranged' ? 'bow' : (w.id === 'battleaxe' ? 'heavy' : 'swing'));

    if (def.dash) {
      this.dodgeAngle = this.facing;
      this.x += Math.cos(this.facing) * def.dash * 0.35;
      this.y += Math.sin(this.facing) * def.dash * 0.35;
      this.world.confine(this);
    }
    return true;
  };

  Player.prototype.resolveAttack = function () {
    var w = D.WEAPONS[this.weaponId];
    var def = this.atkDef;
    var world = this.world;
    var mul = this.stats.damageMul * (w.kind === 'ranged' ? this.stats.rangedMul : 1);
    var dmg = def.damage * mul;

    if (w.kind === 'ranged') {
      var shots = def.shots || 1;
      var spread = def.spread || 0;
      for (var i = 0; i < shots; i++) {
        var a = this.facing + (shots > 1 ? (i - (shots - 1) / 2) * spread : 0);
        world.spawnArrow(this.x, this.y, a, def.projectileSpeed || w.projectileSpeed,
          dmg, w.range, this.stats.pierce);
      }
      return;
    }

    var halfArc = (def.spin ? Math.PI : def.arc / 2);
    var hitAny = false;
    for (var e = 0; e < world.enemies.length; e++) {
      var en = world.enemies[e];
      if (en.dead) continue;
      if (!U.inArcVisual(this.x, this.y, this.facing, halfArc, def.range + en.radius,
        en.x, en.y, Art.SQUASH)) continue;
      en.hurt(dmg, this.facing, def.knock || 120, this);
      hitAny = true;
      if (def.lifesteal) this.heal(dmg * def.lifesteal);
    }
    /* physical puzzle blocks can be knocked by melee too */
    world.meleeProps && world.meleeProps(this, halfArc, def.range);

    world.swipe(this.x, this.y, this.facing, def.range, halfArc, w.id);
    if (def.quake) world.shake(9, 0.35);
    if (hitAny) { Audio.play('hit'); world.shake(4, 0.12); }
  };

  Player.prototype.tryDodge = function () {
    if (this.dead || this.atkState || this.dodgeTime > 0 || this.dodgeCd > 0) return false;
    if (this.stamina < 16) { Audio.play('deny'); return false; }
    this.stamina -= 16;
    this.staminaLock = 0.5;
    var mv = this.world.input.move;
    this.dodgeAngle = mv.mag > 0.15 ? Math.atan2(mv.y, mv.x) : this.facing;
    this.facing = this.dodgeAngle;
    this.dodgeTime = DODGE_TIME;
    this.dodgeCd = DODGE_COOLDOWN * this.stats.dodgeCdMul;
    this.invuln = Math.max(this.invuln, 0.3);
    Audio.play('dodge');
    this.world.dust(this.x, this.y, 6);
    this.world.onPlayerDodge && this.world.onPlayerDodge();
    return true;
  };

  Player.prototype.heal = function (n) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  };

  Player.prototype.hurt = function (dmg, fromAngle) {
    if (this.dead || this.invuln > 0 || this.dodgeTime > 0) return false;
    if (Math.random() < this.stats.evasion) {
      this.world.floater(this.x, this.y - 40, 'miss', '#cfe8ff');
      return false;
    }
    var real = dmg * this.stats.defenceMul;
    this.hp -= real;
    this.damageTaken += real;
    this.hurtFlash = 0.45;
    this.invuln = 0.6;
    this.x += Math.cos(fromAngle) * 20;
    this.y += Math.sin(fromAngle) * 20;
    this.world.confine(this);
    this.world.shake(7, 0.22);
    this.world.floater(this.x, this.y - 44, '-' + Math.round(real), '#ff7a7a');
    Audio.play('hurt');
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return true;
  };

  Player.prototype.draw = function (ctx, t) {
    var Px = V.Px, Spr = V.Spr;
    var view = viewOf(this.facing);
    var frame = walkFrame(this.animPhase, this.moving);
    var spr = Spr.player(view.dir, frame, this.tint);
    var y = this.sy - (this.z || 0) * 0.26;

    Px.shadow(ctx, this.sx, this.sy, 7, this.z > 2 ? 0.16 : 0.28);

    /* weapon sits behind the body when the swing goes away from camera */
    var wpn = Spr.weapon(this.weaponId);
    var Z = V.Trial.ZOOM, SQ = Art.SQUASH;

    /* The weapon travels a real arc AROUND the body: it winds back during the
       wind-up, then whips through the full sweep, alternating direction each
       swing. The sweep matches the weapon's hit arc, so what you see is what
       connects. */
    var sweepHalf = 0.55, orbit = -0.7, held = true;
    if (this.atkState && this.atkDef) {
      var def = this.atkDef;
      sweepHalf = (def.spin ? Math.PI : def.arc / 2) + 0.3;
      var dir = this.swingDir;
      if (this.atkState === 'windup') {
        /* wind back past the start of the arc */
        var wp = U.clamp(this.atkTime / Math.max(def.windup, 0.01), 0, 1);
        orbit = -sweepHalf * dir * (0.7 + 0.3 * wp);
      } else {
        var rp = U.clamp(this.atkTime / Math.max(def.recover, 0.01), 0, 1);
        orbit = U.lerp(-sweepHalf, sweepHalf, U.easeOut(rp)) * dir;
      }
      held = false;
    }

    var swingAngle = this.facing + orbit;
    var radius = held ? 7 : 12;
    var wx = this.sx + Math.cos(swingAngle) * radius;
    var wy = y - 13 + Math.sin(swingAngle) * radius * SQ;
    /* point the blade outward along the arc; the sprite pivots at its grip */
    var visual = Math.atan2(Math.sin(swingAngle) * SQ, Math.cos(swingAngle));
    var wOpts = { rot: view.flip ? Math.PI - visual : visual, flip: view.flip };
    var behind = Math.sin(swingAngle) < -0.15;

    if (behind) Px.draw(ctx, wpn, wx, wy, wOpts);
    var flash = this.hurtFlash > 0 && Math.floor(this.hurtFlash * 24) % 2 === 0;
    Px.draw(ctx, spr, this.sx, y, { flip: view.flip, alpha: flash ? 0.45 : null });
    if (!behind) Px.draw(ctx, wpn, wx, wy, wOpts);

    if (this.hidden) {
      ctx.fillStyle = 'rgba(120,200,140,0.22)';
      ctx.beginPath();
      ctx.ellipse(this.sx, y - 13, 12, 15, 0, 0, U.TAU);
      ctx.fill();
    }
    if (this.invuln > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + 0.2 * Math.sin(t * 22)) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(this.sx, this.sy, 10, 5, 0, 0, U.TAU);
      ctx.stroke();
    }
  };

  /* ================================================================= ENEMY */
  function Enemy(defId, x, y, world, opts) {
    opts = opts || {};
    var def = D.ENEMIES[defId];
    this.def = def;
    this.id = defId;
    this.world = world;
    this.x = x; this.y = y; this.z = 0;
    this.radius = def.radius;
    this.maxHp = def.hp * (opts.hpScale || 1);
    this.hp = this.maxHp;
    this.damage = def.damage * (opts.dmgScale || 1);
    this.speed = def.speed * (opts.speedScale || 1);
    this.facing = Math.random() * U.TAU;
    this.state = 'idle';
    this.stateTime = 0;
    this.animPhase = Math.random() * 6;
    this.moving = false;
    this.hurtFlash = 0;
    this.dead = false;
    this.drawScale = 1;
    this.vx = 0; this.vy = 0;
    this.wanderAngle = Math.random() * U.TAU;
    this.wanderTimer = 0;
    this.hiding = !!opts.hiding;      /* seek trials: sits in cover until found */
    this.homeX = x; this.homeY = y;
    this.leash = opts.leash || 0;
    this.aggro = false;
    this.summonedAt = [];
    this.phase = 1;
    this.attackedThisSwing = false;
  }

  Enemy.prototype.detects = function (p) {
    if (p.dead) return false;
    if (p.smokeTimer > 0) return false;
    var sight = this.def.sight * p.stats.stealthMul;
    if (p.hidden) sight *= 0.22;
    return U.dist2(this.x, this.y, p.x, p.y) < sight * sight;
  };

  Enemy.prototype.update = function (dt) {
    if (this.dead) return;
    var w = this.world, p = w.player;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.stateTime += dt;

    /* knockback velocity decay */
    if (this.vx || this.vy) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt);
      if (Math.abs(this.vx) < 6) this.vx = 0;
      if (Math.abs(this.vy) < 6) this.vy = 0;
      w.confine(this);
    }

    if (this.hiding) {
      this.moving = false;
      this.animPhase += dt * 1.5;
      /* found if the player gets very close */
      if (U.dist2(this.x, this.y, p.x, p.y) < 118 * 118) {
        this.hiding = false;
        this.aggro = true;
        this.state = 'chase';
        w.floater(this.x, this.y - 40, 'found!', '#ffe45c');
        w.onEnemyFound && w.onEnemyFound(this);
      }
      return;
    }

    /* a bolted-down training dummy: it takes hits and turns to face you,
       but it never chases, wanders or swings back */
    if (this.def.inert) {
      this.moving = false;
      this.facing = Math.atan2(p.y - this.y, p.x - this.x);
      this.vx = 0; this.vy = 0;
      /* separate() runs after this and will shove it around like any other
         body, so put it back on its post every frame */
      this.x = this.homeX; this.y = this.homeY;
      return;
    }

    var d = U.dist(this.x, this.y, p.x, p.y);
    var toP = Math.atan2(p.y - this.y, p.x - this.x);

    if (this.def.boss) this.bossBrain(dt, d, toP, p);

    switch (this.state) {
      case 'idle': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1 + Math.random() * 2.2;
          this.wanderAngle = Math.random() * U.TAU;
          this.wanderMoving = Math.random() < 0.6;
        }
        if (this.wanderMoving) {
          this.step(this.wanderAngle, this.speed * 0.34, dt);
          this.moving = true;
        } else this.moving = false;
        if (this.detects(p)) { this.state = 'chase'; this.stateTime = 0; this.aggro = true; }
        break;
      }
      case 'chase': {
        this.facing = toP;
        this.moving = true;
        var chaseSpeed = this.speed;
        if (this.def.charge && d > 220 && d < 620 && this.stateTime > 1.0) {
          this.state = 'charge'; this.stateTime = 0;
          this.chargeAngle = toP;
          w.floater(this.x, this.y - 46, '!', '#ff6a3c');
          break;
        }
        this.step(toP, chaseSpeed, dt);
        if (d < this.def.attackRange) { this.state = 'windup'; this.stateTime = 0; this.attackedThisSwing = false; }
        else if (!this.detects(p) && this.stateTime > 2.5) { this.state = 'idle'; this.stateTime = 0; }
        break;
      }
      case 'charge': {
        this.moving = true;
        this.facing = this.chargeAngle;
        this.step(this.chargeAngle, this.speed * 2.3, dt);
        if (d < this.def.attackRange * 0.8) {
          if (p.hurt(this.damage * 1.2, this.chargeAngle)) w.shake(10, 0.3);
          this.state = 'recover'; this.stateTime = 0;
        }
        if (this.stateTime > 0.9) { this.state = 'recover'; this.stateTime = 0; }
        break;
      }
      case 'windup': {
        this.moving = false;
        this.facing = U.lerp(this.facing, this.facing + U.angleDelta(this.facing, toP), 0.18);
        if (this.stateTime >= this.def.attackWindup) {
          this.swing(p);
          this.state = 'recover'; this.stateTime = 0;
        }
        break;
      }
      case 'recover': {
        this.moving = false;
        if (this.stateTime >= this.def.attackRecover) {
          this.state = d < this.def.sight ? 'chase' : 'idle';
          this.stateTime = 0;
        }
        break;
      }
      case 'stagger': {
        this.moving = false;
        if (this.stateTime > 0.45) { this.state = 'chase'; this.stateTime = 0; }
        break;
      }
    }
    this.animPhase += dt * (this.moving ? 15 : 2);
  };

  Enemy.prototype.step = function (angle, speed, dt) {
    var nx = this.x + Math.cos(angle) * speed * dt;
    var ny = this.y + Math.sin(angle) * speed * dt;
    this.x = nx; this.y = ny;
    this.world.confine(this);
  };

  Enemy.prototype.swing = function (p) {
    var w = this.world;
    var arc = this.def.boss ? 1.6 : 1.1;
    w.swipe(this.x, this.y, this.facing, this.def.attackRange, arc / 2, 'enemy');
    if (U.inArcVisual(this.x, this.y, this.facing, arc / 2, this.def.attackRange + p.radius,
      p.x, p.y, Art.SQUASH)) {
      p.hurt(this.damage, this.facing);
    }
    V.Audio.play(this.def.heavy || this.def.boss ? 'heavy' : 'swing');
  };

  Enemy.prototype.bossBrain = function (dt, d, toP, p) {
    var w = this.world;
    this.bossTimer = (this.bossTimer || 0) + dt;
    var hpFrac = this.hp / this.maxHp;

    /* phase gates: summon adds at 66% and 33% */
    var wantPhase = hpFrac > 0.66 ? 1 : (hpFrac > 0.33 ? 2 : 3);
    if (wantPhase > this.phase) {
      this.phase = wantPhase;
      var n = this.def.finalBoss ? 4 : 2;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * U.TAU;
        w.spawnEnemy(this.def.finalBoss && i % 2 === 0 ? 'minotaur' : 'goblin',
          this.x + Math.cos(a) * 170, this.y + Math.sin(a) * 170);
      }
      w.floater(this.x, this.y - 70, 'RISE', '#ff4d5e');
      V.Audio.play('boss');
      w.shake(14, 0.5);
    }

    /* teleport out of a corner or when kited */
    if (this.def.teleport && this.bossTimer > (this.def.finalBoss ? 3.5 : 4.5) && d > 340) {
      this.bossTimer = 0;
      var ta = Math.atan2(this.y - p.y, this.x - p.x) + Math.PI;
      this.x = p.x + Math.cos(ta + (Math.random() - 0.5)) * 130;
      this.y = p.y + Math.sin(ta + (Math.random() - 0.5)) * 130;
      w.confine(this);
      w.burst(this.x, this.y, 18, '#9b6bff');
      V.Audio.play('warp');
      this.state = 'windup'; this.stateTime = 0;
    }

    /* final boss: radial feather volley */
    if (this.def.finalBoss) {
      this.volleyTimer = (this.volleyTimer || 0) + dt;
      if (this.volleyTimer > (this.phase >= 3 ? 2.6 : 4)) {
        this.volleyTimer = 0;
        var shots = 8 + this.phase * 2;
        for (var s = 0; s < shots; s++) {
          w.spawnBolt(this.x, this.y - 20, (s / shots) * U.TAU + this.bossTimer, 280, this.damage * 0.45);
        }
        V.Audio.play('warp');
      }
    }
  };

  Enemy.prototype.hurt = function (dmg, fromAngle, knock, src) {
    if (this.dead) return;
    this.hiding = false;
    this.hp -= dmg;
    this.hurtFlash = 0.18;
    this.aggro = true;
    var resist = this.def.inert ? 0 : (this.def.boss ? 0.25 : (this.def.heavy ? 0.5 : 1));
    this.vx += Math.cos(fromAngle) * knock * resist;
    this.vy += Math.sin(fromAngle) * knock * resist;
    this.world.floater(this.x, this.y - 36 - this.radius, String(Math.round(dmg)), '#fff0a8');
    this.world.burst(this.x, this.y - 18, 5, '#ffd66b');
    if (!this.def.boss && knock > 200) { this.state = 'stagger'; this.stateTime = 0; }
    if (this.state === 'idle') { this.state = 'chase'; this.stateTime = 0; }
    /* every source of enemy damage in the game is the player, arrows included,
       so this is the one place a scripted beat can watch for "you landed a hit" */
    this.world.onEnemyHurt && this.world.onEnemyHurt(this, dmg);
    if (this.hp <= 0) this.die(src);
  };

  Enemy.prototype.die = function (src) {
    this.dead = true;
    this.hp = 0;
    var w = this.world;
    w.burst(this.x, this.y - 18, 16, this.def.colour);
    V.Audio.play('kill');
    if (src) src.kills++;
    w.onEnemyKilled && w.onEnemyKilled(this);
  };

  var ENEMY_SPRITE = {
    goblin: 'goblin', minotaur: 'minotaur', reaper: 'reaper', aurelith: 'aurelith',
    warden: 'warden', dummy: 'dummy'
  };

  Enemy.prototype.draw = function (ctx, t) {
    if (this.dead) return;
    var Px = V.Px, Spr = V.Spr, Z = V.Trial.ZOOM;
    var view = viewOf(this.facing);
    var frame = walkFrame(this.animPhase, this.moving);
    var name = ENEMY_SPRITE[this.id];
    var spr = this.id === 'aurelith' ? Spr.aurelith(frame ? 1 : 0) : Spr[name](view.dir, frame);
    var y = this.sy - (this.z || 0) * Z;

    var alpha = null;
    if (this.hiding) alpha = 0.24 + 0.08 * Math.sin(t * 3 + this.animPhase);
    else if (this.hurtFlash > 0) alpha = 0.55;

    Px.shadow(ctx, this.sx, this.sy, this.def.boss ? 12 : (this.def.heavy ? 9 : 7));
    Px.draw(ctx, spr, this.sx, y, { flip: view.flip, alpha: alpha });

    /* windup telegraph */
    if (this.state === 'windup' || this.state === 'charge') {
      var prog = U.clamp(this.stateTime / (this.state === 'charge' ? 0.9 : this.def.attackWindup), 0, 1);
      ctx.strokeStyle = 'rgba(255,90,80,' + (0.3 + prog * 0.55) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.sx, this.sy, this.def.attackRange * Z * 0.7, this.facing - 0.6, this.facing + 0.6);
      ctx.stroke();
    }
    if (this.def.boss) {
      var bw = 36, bx = Math.round(this.sx - bw / 2), by = Math.round(y - spr.h - 6);
      ctx.fillStyle = '#241c2b';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(bx, by, Math.round(bw * (this.hp / this.maxHp)), 3);
    }
  };

  /* ============================================================ PROJECTILE */
  function Projectile(x, y, angle, speed, dmg, range, opts) {
    opts = opts || {};
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = dmg;
    this.life = range / speed;
    this.dead = false;
    this.hostile = !!opts.hostile;
    this.pierce = !!opts.pierce;
    this.hits = [];
    this.colour = opts.colour || (opts.hostile ? '#ff7a9c' : '#f0e6c8');
    this.trail = [];
  }

  Projectile.prototype.update = function (dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    if (!world.insideArena(this.x, this.y, 8)) { this.dead = true; return; }

    if (this.hostile) {
      var p = world.player;
      if (!p.dead && U.dist2(this.x, this.y, p.x, p.y) < (p.radius + 7) * (p.radius + 7)) {
        p.hurt(this.damage, this.angle);
        this.dead = true;
      }
      return;
    }
    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      if (e.dead || this.hits.indexOf(e) >= 0) continue;
      if (U.dist2(this.x, this.y, e.x, e.y) < (e.radius + 8) * (e.radius + 8)) {
        e.hurt(this.damage, this.angle, 90);
        V.Audio.play('hit');
        this.hits.push(e);
        if (!this.pierce) { this.dead = true; return; }
      }
    }
  };

  Projectile.prototype.draw = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.trail.length; i++) {
      var tp = this.trail[i];
      ctx.globalAlpha = (i / this.trail.length) * 0.35;
      ctx.fillStyle = this.colour;
      ctx.fillRect(Math.round(tp.sx) - 1, Math.round(tp.sy) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.translate(Math.round(this.sx), Math.round(this.sy));
    ctx.rotate(this.angle);
    if (this.hostile) {
      ctx.fillStyle = '#ff4d5e';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = '#ffd0d8';
      ctx.fillRect(-1, -1, 2, 2);
    } else {
      ctx.fillStyle = '#8a5a33';
      ctx.fillRect(-5, 0, 8, 1);
      ctx.fillStyle = '#d8e0e8';
      ctx.fillRect(3, 0, 3, 1);
      ctx.fillStyle = '#efe3c8';
      ctx.fillRect(-6, -1, 2, 3);
    }
    ctx.restore();
  };

  E.Player = Player;
  E.Enemy = Enemy;
  E.Projectile = Projectile;
  V.E = E;
})(window.V = window.V || {});
