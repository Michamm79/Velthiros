/* Velthiros - player, enemies, projectiles, particles */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, Audio = V.Audio;
  var E = {};

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
      this.dodgeTime -= dt;
      var dodgeSpeed = this.stats.dodgeDist / 0.24;
      this.x += Math.cos(this.dodgeAngle) * dodgeSpeed * dt;
      this.y += Math.sin(this.dodgeAngle) * dodgeSpeed * dt;
      this.z = this.stats.glide ? Math.sin((1 - this.dodgeTime / 0.24) * Math.PI) * 16 : 0;
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
      this.animPhase += dt * (6 + 9 * mv.mag);
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

  Player.prototype.tryAttack = function (special) {
    if (!this.canAct()) return false;
    var w = D.WEAPONS[this.weaponId];
    var def = special ? w.special : w;
    if (special && this.specialCd > 0) return false;
    if (this.stamina < def.stamina) { Audio.play('deny'); return false; }
    this.stamina -= def.stamina;
    this.staminaLock = 0.55;
    this.atkDef = def;
    this.atkKind = special ? 'special' : 'primary';
    this.atkState = 'windup';
    this.atkTime = 0;
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
      if (!U.inArc(this.x, this.y, this.facing, halfArc, def.range + en.radius, en.x, en.y)) continue;
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
    this.dodgeTime = 0.24;
    this.dodgeCd = 0.85 * this.stats.dodgeCdMul;
    this.invuln = Math.max(this.invuln, 0.3);
    Audio.play('dodge');
    this.world.dust(this.x, this.y, 6);
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
    this.x += Math.cos(fromAngle) * 14;
    this.y += Math.sin(fromAngle) * 14;
    this.world.confine(this);
    this.world.shake(7, 0.22);
    this.world.floater(this.x, this.y - 44, '-' + Math.round(real), '#ff7a7a');
    Audio.play('hurt');
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return true;
  };

  Player.prototype.draw = function (ctx, t) {
    Art.drawPlayer(ctx, this, t);
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
      if (Math.abs(this.vx) < 4) this.vx = 0;
      if (Math.abs(this.vy) < 4) this.vy = 0;
      w.confine(this);
    }

    if (this.hiding) {
      this.moving = false;
      this.animPhase += dt * 1.5;
      /* found if the player gets very close */
      if (U.dist2(this.x, this.y, p.x, p.y) < 92 * 92) {
        this.hiding = false;
        this.aggro = true;
        this.state = 'chase';
        w.floater(this.x, this.y - 40, 'found!', '#ffe45c');
        w.onEnemyFound && w.onEnemyFound(this);
      }
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
        if (this.def.charge && d > 150 && d < 420 && this.stateTime > 1.2) {
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
        this.step(this.chargeAngle, this.speed * 2.6, dt);
        if (d < this.def.attackRange * 0.8) {
          if (p.hurt(this.damage * 1.2, this.chargeAngle)) w.shake(10, 0.3);
          this.state = 'recover'; this.stateTime = 0;
        }
        if (this.stateTime > 1.1) { this.state = 'recover'; this.stateTime = 0; }
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
    this.animPhase += dt * (this.moving ? 11 : 2);
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
    if (U.inArc(this.x, this.y, this.facing, arc / 2, this.def.attackRange + p.radius, p.x, p.y)) {
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
          this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 120);
      }
      w.floater(this.x, this.y - 70, 'RISE', '#ff4d5e');
      V.Audio.play('boss');
      w.shake(14, 0.5);
    }

    /* teleport out of a corner or when kited */
    if (this.def.teleport && this.bossTimer > (this.def.finalBoss ? 4.5 : 6) && d > 240) {
      this.bossTimer = 0;
      var ta = Math.atan2(this.y - p.y, this.x - p.x) + Math.PI;
      this.x = p.x + Math.cos(ta + (Math.random() - 0.5)) * 90;
      this.y = p.y + Math.sin(ta + (Math.random() - 0.5)) * 90;
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
          w.spawnBolt(this.x, this.y - 20, (s / shots) * U.TAU + this.bossTimer, 165, this.damage * 0.45);
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
    var resist = this.def.boss ? 0.25 : (this.def.heavy ? 0.5 : 1);
    this.vx += Math.cos(fromAngle) * knock * resist;
    this.vy += Math.sin(fromAngle) * knock * resist;
    this.world.floater(this.x, this.y - 36 - this.radius, String(Math.round(dmg)), '#fff0a8');
    this.world.burst(this.x, this.y - 18, 5, '#ffd66b');
    if (!this.def.boss && knock > 200) { this.state = 'stagger'; this.stateTime = 0; }
    if (this.state === 'idle') { this.state = 'chase'; this.stateTime = 0; }
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

  Enemy.prototype.draw = function (ctx, t) {
    if (this.dead) return;
    if (this.hiding) {
      /* only a faint rustle gives them away */
      ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 3 + this.animPhase);
    }
    if (this.id === 'goblin') Art.drawGoblin(ctx, this);
    else if (this.id === 'minotaur') Art.drawMinotaur(ctx, this);
    else if (this.id === 'reaper') Art.drawReaper(ctx, this, t);
    else if (this.id === 'aurelith') Art.drawAurelith(ctx, this, t);
    ctx.globalAlpha = 1;

    /* windup telegraph */
    if (this.state === 'windup' || this.state === 'charge') {
      var prog = U.clamp(this.stateTime / (this.state === 'charge' ? 1.1 : this.def.attackWindup), 0, 1);
      ctx.strokeStyle = 'rgba(255,90,80,' + (0.25 + prog * 0.5) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.sx, this.sy, this.def.attackRange * 0.5, this.facing - 0.6, this.facing + 0.6);
      ctx.stroke();
    }
    if (this.def.boss) {
      var bw = 74, bx = this.sx - bw / 2, by = this.sy - 96;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      Art.roundRect(ctx, bx - 2, by - 2, bw + 4, 9, 4); ctx.fill();
      ctx.fillStyle = '#ff4d5e';
      Art.roundRect(ctx, bx, by, bw * (this.hp / this.maxHp), 5, 2.5); ctx.fill();
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
      ctx.globalAlpha = (i / this.trail.length) * 0.4;
      ctx.fillStyle = this.colour;
      Art.ellipse(ctx, tp.sx, tp.sy, 3, 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(this.sx, this.sy);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.colour;
    if (this.hostile) {
      Art.ellipse(ctx, 0, 0, 7, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      Art.ellipse(ctx, -1, -1, 2.4, 1.6); ctx.fill();
    } else {
      Art.roundRect(ctx, -10, -1.6, 20, 3.2, 1.6); ctx.fill();
      ctx.fillStyle = '#cfd8e2';
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  E.Player = Player;
  E.Enemy = Enemy;
  E.Projectile = Projectile;
  V.E = E;
})(window.V = window.V || {});
