/* Velthiros - game shell: loop, scene stack, run state and progression rules */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Save = V.Save, Input = V.Input, Audio = V.Audio, S = V.S, UI = V.UI;

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = Input;
    this.save = Save.load();
    this.scene = null;
    this.last = 0;
    this.acc = 0;
    this.running = false;
    this.dpr = 1;
    this.cw = 0; this.ch = 0;
    this.fade = { a: 0, dir: 0, next: null };

    /* dev affordance: ?idle=10 shortens the 5-minute scythe idle for testing */
    var q = new URLSearchParams(window.location.search);
    var idleOverride = parseFloat(q.get('idle'));
    this.idleUnlockSeconds = (isFinite(idleOverride) && idleOverride > 0) ? idleOverride : D.IDLE_UNLOCK_SECONDS;
    this.debug = q.get('debug') === '1';
    /* Pixel-art presentation: the world renders into a small offscreen buffer
       and is scaled up with no smoothing, so everything lands on a chunky
       pixel grid. The HUD is drawn afterwards at full resolution so text stays
       readable on a phone. ?smooth=1 falls back to the old vector look. */
    this.pixelMode = q.get('smooth') !== '1';
    this.pixelTargetHeight = 240;
    var startTrial = parseInt(q.get('trial'), 10);
    this.forceTrial = (isFinite(startTrial) && startTrial > 0) ? startTrial : 0;
  }

  /* ================================================================== boot */
  Game.prototype.start = function () {
    var self = this;
    Input.init(this.canvas);
    this.resize();
    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 120); });

    /* audio needs a gesture */
    var unlock = function () {
      Audio.init();
      Audio.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.setScene(new S.StartScene(this));
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(function (t) { self.frame(t); });
  };

  Game.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.cw = w; this.ch = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* ------------------------------------------------------- pixel pipeline */
  Game.prototype.worldTarget = function () {
    if (!this.pixelMode) { this.pixScale = 1; return { ctx: this.ctx, w: this.cw, h: this.ch, direct: true }; }

    var scale = Math.max(2, Math.round(this.ch / this.pixelTargetHeight));
    var bw = Math.ceil(this.cw / scale);
    var bh = Math.ceil(this.ch / scale);

    if (!this.pixCanvas) {
      this.pixCanvas = document.createElement('canvas');
      this.pixCtx = this.pixCanvas.getContext('2d');
    }
    if (this.pixCanvas.width !== bw || this.pixCanvas.height !== bh) {
      this.pixCanvas.width = bw;
      this.pixCanvas.height = bh;
    }
    this.pixScale = scale;
    var c = this.pixCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, bw, bh);
    c.imageSmoothingEnabled = false;
    return { ctx: c, w: bw, h: bh, direct: false };
  };

  Game.prototype.flushWorld = function (target) {
    if (!this.pixelMode || target.direct) return;
    var ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.pixCanvas, 0, 0, this.pixCanvas.width, this.pixCanvas.height,
      0, 0, this.pixCanvas.width * this.pixScale, this.pixCanvas.height * this.pixScale);
    ctx.imageSmoothingEnabled = true;
  };

  Game.prototype.frame = function (now) {
    var self = this;
    var dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    Input.update();
    if (this.scene && this.scene.update) this.scene.update(dt);

    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    if (this.scene && this.scene.render) this.scene.render(ctx, this.cw, this.ch);

    if (this.debug) {
      UI.text(ctx, Math.round(1 / Math.max(dt, 0.0001)) + ' fps', 8, this.ch - 10, { size: 10, colour: '#0f0' });
    }

    Input.endFrame();
    requestAnimationFrame(function (t) { self.frame(t); });
  };

  Game.prototype.setScene = function (scene) {
    this.scene = scene;
    Input.stickEnabled = false;
    Input.down = {};
    Input.stick.active = false;
  };

  Game.prototype.persist = function () { Save.write(this.save); };

  /* ============================================================== run flow */
  Game.prototype.newGame = function () {
    this.save = Save.newGame(this.save);
    this.pendingResult = null;      /* never carry a finished trial into a fresh run */
    this.persist();
    if (this.forceTrial) {
      this.save.trial = this.forceTrial;
      this.save.gem = { id: D.GEM_IDS[Math.floor(Math.random() * D.GEM_IDS.length)] };
      this.save.seenIntro = true;
      this.save.tutorialDone = true;   /* the dev jump skips the guided opening */
      this.persist();
      return this.setScene(new S.RoomScene(this, 'hub'));
    }
    this.setScene(new S.RoomScene(this, 'intro'));
  };

  /* The opening is bedroom -> square -> abduction -> tutorial -> hub.
     Continue re-enters wherever the player stopped, so quitting halfway
     through the tutorial resumes the tutorial rather than skipping it. */
  Game.prototype.continueRun = function () {
    if (!this.save.started) return;
    if (!this.save.seenIntro) return this.setScene(new S.RoomScene(this, 'intro'));
    if (!this.save.tutorialDone) return this.enterTutorial();
    this.setScene(new S.RoomScene(this, 'hub'));
  };

  Game.prototype.enterSquare = function () {
    this.save.tutorialStage = 'square';
    this.persist();
    this.setScene(new S.SquareScene(this));
  };

  Game.prototype.startAbduction = function () {
    this.setScene(new S.CutsceneScene(this, 'abduction'));
  };

  Game.prototype.cutsceneDone = function (kind) {
    if (kind === 'abduction') {
      this.save.seenIntro = true;
      this.persist();
      /* The gem is no longer handed over here - the tutorial grants it in
         beat 7, so the player has hands on the controls when it arrives. */
      return this.enterTutorial();
    }
    /* endgame cutscene */
    this.enterTrial();
  };

  Game.prototype.enterTutorial = function () {
    this.save.tutorialStage = 'trial';
    this.persist();
    var spec = {
      index: 0, type: 'tutorial', boss: false, tutorial: true, untimed: true,
      radius: V.Tutorial.RADIUS, env: D.TUTORIAL_ENVS[V.Tutorial.ENV],
      seed: U.hash('velthiros:tutorial:' + this.save.resets), label: 'The Square'
    };
    this.setScene(new TrialScene(this, new V.Trial(this, spec)));
  };

  Game.prototype.finishTutorial = function () {
    this.save.tutorialDone = true;
    this.save.tutorialStage = null;
    this.persist();
    this.setScene(new S.RoomScene(this, 'hub'));
  };

  Game.prototype.gemTaken = function () { this.enterTrial(); };

  /* ---------------------------------------------------------- trial specs */
  Game.prototype.makeSpec = function (index) {
    var sv = this.save;
    var seed = U.hash('velthiros:' + sv.resets + ':' + index);
    var envIndex = U.hash('env:' + seed) % D.ENVIRONMENTS.length;
    var env = D.ENVIRONMENTS[envIndex];

    if (sv.endgame) {
      var wave = sv.endgameWave;
      if (wave >= 4) {
        return {
          index: D.TOTAL_TRIALS + 4, type: 'boss', boss: true, finalBoss: true,
          env: D.ENVIRONMENTS[2], seed: seed, label: 'Aurelith'
        };
      }
      return {
        index: D.TOTAL_TRIALS + wave, type: 'defeat', boss: false,
        env: D.ENVIRONMENTS[(wave + 3) % D.ENVIRONMENTS.length], seed: seed,
        label: 'Wave ' + wave + ' / 3', endgame: true
      };
    }

    var isBoss = (index % D.BOSS_EVERY === 0);
    if (isBoss) {
      return {
        index: index, type: 'boss', boss: true, env: env, seed: seed,
        label: 'Trial ' + index + ' - Reaper'
      };
    }
    var type = D.TRIAL_ROTATION[(index - 1) % D.TRIAL_ROTATION.length];
    var typeDef = null;
    for (var i = 0; i < D.TRIAL_TYPES.length; i++) if (D.TRIAL_TYPES[i].id === type) typeDef = D.TRIAL_TYPES[i];
    return {
      index: index, type: type, boss: false, env: env, seed: seed,
      label: 'Trial ' + index + ' - ' + (typeDef ? typeDef.name : type)
    };
  };

  Game.prototype.enterTrial = function () {
    var spec = this.makeSpec(this.save.trial);
    var trial = new V.Trial(this, spec);
    this.setScene(new TrialScene(this, trial));
  };

  /* ------------------------------------------------------------- outcomes */
  Game.prototype.onTrialFinished = function (result) {
    var sv = this.save;
    var outcome = result.tier.outcome;

    /* The tutorial is not ranked, not paid and not counted. A percentile on a
       guided sequence is noise, and its deaths must not push anyone toward the
       25-death wipe before the real game has started. */
    if (result.trial.tutorial) return this.finishTutorial();

    if (result.died) {
      sv.deaths++;
      sv.stats.trialsFailed++;
    }
    sv.stats.bestRank = Math.min(sv.stats.bestRank, result.percentile);

    if (outcome === 'reward') {
      /* GDD 6.2: only the top 25% is paid */
      var base = 45 + result.trial.index * 7;
      var overPar = U.clamp(result.score / Math.max(1, result.par), 0, 2.2);
      result.payout = Math.round(base * (0.8 + overPar * 0.6)) + result.bonusCoins;
      sv.currency += result.payout;
      sv.lifetimeEarned += result.payout;
    } else {
      result.payout = result.bonusCoins;
      if (result.bonusCoins) { sv.currency += result.bonusCoins; sv.lifetimeEarned += result.bonusCoins; }
    }

    if (outcome !== 'fail') {
      /* passive income from Reality Shop businesses (GDD 9) */
      var income = Save.passiveIncome(sv);
      if (income > 0) {
        result.income = income;
        sv.currency += income;
        sv.lifetimeEarned += income;
      }
      sv.cleared++;
      sv.debuff = null;
    } else {
      /* GDD 6.2: potential debuff on the reattempt */
      if (Math.random() < 0.7) {
        var db = D.DEBUFFS[Math.floor(Math.random() * D.DEBUFFS.length)];
        sv.debuff = db.id;
        result.debuffName = db.name + ' (' + db.desc + ')';
      } else {
        sv.debuff = null;
      }
    }

    sv.lastRank = result.percentile;
    sv.stats.kills += result.kills;
    this.pendingResult = result;
    this.persist();
    this.setScene(new S.RankingScene(this, result));
  };

  Game.prototype.leaveRanking = function () {
    var sv = this.save;
    var r = this.pendingResult;

    /* GDD 9: 25 deaths in a run wipes everything */
    if (sv.deaths >= D.DEATH_LIMIT) return this.setScene(new S.ResetScene(this));

    var survived = r.tier.outcome !== 'fail';

    if (!survived) {
      /* death or below-40%: rerun the same trial */
      return this.enterTrial();
    }

    if (sv.endgame) {
      if (r.trial.finalBoss) {
        sv.beatenGame = true;
        this.persist();
        return this.setScene(new S.VictoryScene(this));
      }
      sv.endgameWave++;
      this.persist();
      return this.enterTrial();
    }

    sv.trial++;
    if (sv.trial > D.TOTAL_TRIALS) {
      /* GDD 10: escalating waves, then the final boss */
      sv.endgame = true;
      sv.endgameWave = 1;
      this.persist();
      return this.setScene(new S.CutsceneScene(this, 'endgame'));
    }
    this.persist();
    this.setScene(new S.RoomScene(this, 'hub'));
  };

  Game.prototype.confirmFullReset = function () {
    this.save = Save.fullReset(this.save);
    this.pendingResult = null;
    this.setScene(new S.StartScene(this));
  };

  /* ----------------------------------------------------------------- shop */
  Game.prototype.buy = function (item) {
    var sv = this.save;
    var count = Save.ownedCount(sv, item.id);
    if (!item.stack && count > 0) return { ok: false, message: 'Already owned.' };
    if (item.needs && !Save.ownedCount(sv, item.needs)) return { ok: false, message: 'Requires an earlier upgrade.' };
    if (sv.currency < item.price) return { ok: false, message: 'Not enough ' + D.CURRENCY.name + '.' };

    sv.currency -= item.price;
    sv.owned[item.id] = item.stack ? count + 1 : true;

    if (item.weapon) {
      sv.weapons[item.weapon] = true;
      sv.weapon = item.weapon;
    }
    if (item.tint) sv.equippedTint = item.tint;
    if (item.decor) sv.decor[item.decor] = true;

    this.persist();
    return { ok: true, message: item.name + ' bought.' + (item.weapon ? ' Equipped.' : '') };
  };

  Game.prototype.spendConsumable = function (id) {
    var n = Save.ownedCount(this.save, id);
    if (n > 0) {
      this.save.owned[id] = n - 1;
      if (this.save.owned[id] <= 0) delete this.save.owned[id];
      this.persist();
    }
  };

  Game.prototype.consumableCounts = function () {
    return {
      potion: Save.ownedCount(this.save, 'c_potion'),
      tonic: Save.ownedCount(this.save, 'c_tonic'),
      smoke: Save.ownedCount(this.save, 'c_smoke')
    };
  };

  Game.prototype.playerTint = function () { return this.save.equippedTint || '#4f8fd6'; };

  /* GDD 7.1: the scythe unlock lasts for the rest of this run only. */
  Game.prototype.unlockScythe = function () {
    this.save.scytheUnlocked = true;
    this.save.weapons.scythe = true;
    this.save.weapon = 'scythe';
    this.persist();
  };

  Game.prototype.cycleWeapon = function () {
    var owned = [];
    for (var i = 0; i < D.WEAPON_ORDER.length; i++) {
      var id = D.WEAPON_ORDER[i];
      if (this.save.weapons[id]) owned.push(id);
    }
    if (owned.length < 2) return;
    var idx = owned.indexOf(this.save.weapon);
    this.save.weapon = owned[(idx + 1) % owned.length];
    this.persist();
  };

  /* ============================================================ TRIAL SCENE */
  function TrialScene(game, trial) {
    this.game = game;
    this.trial = trial;
  }
  TrialScene.prototype.update = function (dt) {
    if (V.Input.wasPressed('back')) this.trial.paused = !this.trial.paused;
    this.trial.update(dt);
  };
  TrialScene.prototype.render = function (ctx, cw, ch) {
    var target = this.game.worldTarget();
    this.trial.render(target.ctx, target.w, target.h);
    this.game.flushWorld(target);
    V.HUD.draw(ctx, this.trial, cw, ch);
  };

  V.Game = Game;
  V.TrialScene = TrialScene;
})(window.V = window.V || {});
