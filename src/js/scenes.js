/* Velthiros - non-combat scenes: start, bedroom/hub, cutscene, shops, ranking */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, UI = V.UI, Input = V.Input, Audio = V.Audio, Save = V.Save;
  var S = {};

  /* ============================================================ START SCREEN
     GDD 12: "New Game" and "Continue", vertically stacked.
     GDD 7.1: idle here for 5 minutes to surface the scythe unlock prompt. */
  function StartScene(game) {
    this.game = game;
    this.t = 0;
    this.idle = 0;
    this.promptShown = false;
    this.comboProgress = 0;
    this.unlockFlash = 0;
    this.combo = D.COMBOS[game.save.comboIndex % D.COMBOS.length];
    this.stars = [];
    for (var i = 0; i < 60; i++) {
      this.stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.6 + 0.4, p: Math.random() * 6 });
    }
    Audio.music('calm');
  }

  StartScene.prototype.update = function (dt) {
    this.t += dt;
    this.unlockFlash = Math.max(0, this.unlockFlash - dt);

    /* any interaction resets the idle clock */
    if (Input.anyInput && !this.promptShown) this.idle = 0;
    else this.idle += dt;

    if (!this.promptShown && !this.game.save.scytheUnlocked && this.idle >= this.game.idleUnlockSeconds) {
      this.promptShown = true;
      this.comboProgress = 0;
      Audio.play('warp');
    }
  };

  StartScene.prototype.pressDir = function (dir) {
    if (!this.promptShown) return;
    if (this.combo[this.comboProgress] === dir) {
      this.comboProgress++;
      Audio.play('confirm');
      if (this.comboProgress >= this.combo.length) {
        this.game.unlockScythe();
        this.promptShown = false;
        this.unlockFlash = 3.2;
        Audio.play('unlock');
      }
    } else {
      this.comboProgress = 0;
      Audio.play('deny');
    }
  };

  StartScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch), t = this.t, i;

    /* night sky over a skyline - the life being taken away */
    var g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#1a1030');
    g.addColorStop(0.55, '#3a1f47');
    g.addColorStop(1, '#6b3352');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    for (i = 0; i < this.stars.length; i++) {
      var st = this.stars[i];
      ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 0.8 + st.p));
      ctx.fillStyle = '#fff';
      Art.ellipse(ctx, st.x * cw, st.y * ch, st.r, st.r); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* skyline */
    ctx.fillStyle = '#150d22';
    var bw = cw / 11;
    for (i = 0; i < 12; i++) {
      var bh = ch * (0.16 + ((i * 37) % 11) / 11 * 0.24);
      ctx.fillRect(i * bw - 4, ch - bh, bw + 2, bh);
      ctx.fillStyle = 'rgba(255,220,140,0.5)';
      for (var wI = 0; wI < 4; wI++) {
        if ((i * 7 + wI * 3) % 5 < 2) ctx.fillRect(i * bw + 8 + wI * 9, ch - bh + 14 + wI * 16, 5, 7);
      }
      ctx.fillStyle = '#150d22';
    }

    /* Garatu drifting behind the title */
    ctx.globalAlpha = 0.30 + 0.06 * Math.sin(t * 0.9);
    Art.drawGaratu(ctx, cw * 0.78, ch * 0.44 + Math.sin(t * 0.7) * 10, 1.05 * s, t);
    ctx.globalAlpha = 1;

    /* title */
    UI.text(ctx, 'VELTHIROS', cw / 2, ch * 0.22, {
      size: 48, align: 'center', weight: '800', colour: '#ffe9c9', shadowAlpha: 0.7
    });
    UI.text(ctx, 'they are watching', cw / 2, ch * 0.22 + 34 * s, {
      size: 14, align: 'center', colour: 'rgba(255,220,190,0.7)'
    });

    /* stacked buttons */
    var bwid = Math.min(230 * s, cw * 0.7);
    var bx = cw / 2 - bwid / 2;
    var by = ch * 0.44;
    var bh = 46 * s;

    if (UI.button(ctx, 'newgame', bx, by, bwid, bh, 'New Game')) this.game.newGame();
    var canContinue = this.game.save.started;
    if (UI.button(ctx, 'continue', bx, by + bh + 14 * s, bwid, bh, 'Continue',
      { disabled: !canContinue, sub: canContinue ? 'Trial ' + this.game.save.trial : 'no run yet' })) {
      this.game.continueRun();
    }

    var oy = by + (bh + 14 * s) * 2;
    if (UI.button(ctx, 'sound', bx, oy, bwid * 0.48 - 5 * s, 34 * s, Audio.enabled ? 'Sound on' : 'Sound off')) {
      Audio.setEnabled(!Audio.enabled);
    }
    if (UI.button(ctx, 'howto', bx + bwid * 0.52 + 5 * s, oy, bwid * 0.48 - 5 * s, 34 * s, 'How to play')) {
      this.game.setScene(new S.HelpScene(this.game));
    }

    /* footer state */
    var sv = this.game.save;
    UI.text(ctx, 'deaths ' + sv.deaths + '/' + D.DEATH_LIMIT + '   ' + D.CURRENCY.symbol + ' ' + U.fmtNum(sv.currency) +
      (sv.scytheUnlocked ? '   scythe: unlocked' : ''),
      cw / 2, ch - 22 * s, { size: 11, align: 'center', colour: 'rgba(255,255,255,0.45)' });

    if (this.unlockFlash > 0) {
      UI.text(ctx, 'THE SCYTHE IS YOURS', cw / 2, ch * 0.35,
        { size: 22, align: 'center', weight: '800', colour: '#c9f0ea' });
    }

    if (this.promptShown) this.drawCombo(ctx, cw, ch, s);
    else if (!this.game.save.scytheUnlocked) {
      /* the faintest nudge - the mechanic is meant to be discovered */
      var left = Math.max(0, this.game.idleUnlockSeconds - this.idle);
      if (left < 30) {
        UI.text(ctx, '. . .', cw / 2, ch * 0.35, { size: 20, align: 'center', colour: 'rgba(255,255,255,' + (0.15 + 0.2 * Math.sin(t * 4)) + ')' });
      }
    }
  };

  StartScene.prototype.drawCombo = function (ctx, cw, ch, s) {
    UI.dim(ctx, cw, ch, 0.78);
    var w = Math.min(330 * s, cw - 30), x = cw / 2 - w / 2, y = ch * 0.5 - 150 * s;
    UI.panel(ctx, x, y, w, 300 * s, { fill: 'rgba(18,14,26,0.95)', stroke: 'rgba(200,240,235,0.5)' });

    UI.text(ctx, 'something is here', cw / 2, y + 26 * s, { size: 18, align: 'center', weight: '800', colour: '#c9f0ea' });

    /* the sequence */
    var glyph = { up: '▲', down: '▼', left: '◀', right: '▶' };
    var gy = y + 62 * s;
    var step = Math.min(38 * s, (w - 40 * s) / this.combo.length);
    var startX = cw / 2 - (this.combo.length - 1) * step / 2;
    for (var i = 0; i < this.combo.length; i++) {
      var done = i < this.comboProgress;
      UI.text(ctx, glyph[this.combo[i]], startX + i * step, gy, {
        size: 22, align: 'center', colour: done ? '#7fe08a' : 'rgba(255,255,255,0.55)'
      });
    }

    /* d-pad */
    var cx = cw / 2, cy = y + 175 * s, r = 34 * s, gap = 42 * s;
    var self = this;
    function dirBtn(id, dx, dy, label) {
      if (UI.roundButton(ctx, id, cx + dx, cy + dy, r, label, { size: 18 })) self.pressDir(id.replace('cmb_', ''));
    }
    dirBtn('cmb_up', 0, -gap, '▲');
    dirBtn('cmb_down', 0, gap, '▼');
    dirBtn('cmb_left', -gap, 0, '◀');
    dirBtn('cmb_right', gap, 0, '▶');

    UI.text(ctx, 'enter it', cw / 2, y + 274 * s, { size: 12, align: 'center', colour: 'rgba(255,255,255,0.45)' });

    /* keyboard also works */
    if (Input.keyPressed.up) this.pressDir('up');
    if (Input.keyPressed.down) this.pressDir('down');
    if (Input.keyPressed.left) this.pressDir('left');
    if (Input.keyPressed.right) this.pressDir('right');
  };

  /* =================================================================== HELP */
  function HelpScene(game) { this.game = game; this.t = 0; }
  HelpScene.prototype.update = function (dt) { this.t += dt; };
  HelpScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch);
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(0, 0, cw, ch);
    var w = Math.min(440 * s, cw - 28), x = cw / 2 - w / 2, y = 22 * s;
    UI.panel(ctx, x, y, w, ch - 44 * s);
    UI.text(ctx, 'How to play', cw / 2, y + 26 * s, { size: 22, align: 'center', weight: '800' });

    var lines = [
      ['Move', 'Drag anywhere on the left half of the screen.'],
      ['ATK / special', 'Bottom-right. Special costs more stamina and has a cooldown.'],
      ['DODGE', 'Brief invulnerability. Costs stamina.'],
      ['Hide', 'Stand still in a bush and enemies lose you.'],
      ['Rank', 'Top 25% pays. 26-40% is a wash. Below 40% you redo the trial with a debuff.'],
      ['Death', 'Back to the start of the same trial. ' + D.DEATH_LIMIT + ' deaths wipes the run.'],
      ['Every 5th', 'A Reaper comes instead of a trial.'],
      ['Keyboard', 'WASD move, J attack, K special, L dodge, Q item, Esc pause.']
    ];
    var ly = y + 56 * s;
    for (var i = 0; i < lines.length; i++) {
      UI.text(ctx, lines[i][0], x + 18 * s, ly, { size: 13, weight: '800', colour: '#ffe45c' });
      var wrapped = UI.wrap(ctx, lines[i][1], w - 36 * s, 12);
      for (var j = 0; j < wrapped.length; j++) {
        UI.text(ctx, wrapped[j], x + 18 * s, ly + 16 * s + j * 14 * s, { size: 12, colour: 'rgba(255,255,255,0.8)' });
      }
      ly += 22 * s + wrapped.length * 14 * s;
    }
    if (UI.button(ctx, 'back', cw / 2 - 70 * s, ch - 58 * s, 140 * s, 36 * s, 'Back')) {
      this.game.setScene(new S.StartScene(this.game));
    }
  };

  /* =============================================================== BEDROOM
     GDD 2: mood-setting intro (non-interactive), then the same room becomes
     the hub with both shops (GDD 4). */
  function RoomScene(game, mode) {
    this.game = game;
    this.mode = mode;                 /* 'intro' | 'hub' */
    this.t = 0;
    this.introTimer = mode === 'intro' ? 11 : 0;
    this.px = 0; this.py = 60;
    this.pfacing = -Math.PI / 2;
    this.animPhase = 0;
    this.moving = false;
    this.W = 620; this.H = 320;
    this.prompt = null;
    this.fade = mode === 'intro' ? 1 : 0;
    this.dialog = mode === 'intro' ? 'Another night in the tower.' : null;
    this.dialogTime = mode === 'intro' ? 4 : 0;
    Audio.music(mode === 'intro' ? 'calm' : 'hub');
  }

  RoomScene.prototype.zones = function () {
    if (this.mode !== 'hub') return [];
    return [
      { id: 'reality', x: -220, y: 0, r: 66, label: 'Reality Shop' },
      { id: 'trial', x: 220, y: 0, r: 66, label: 'Trial Shop' },
      { id: 'gate', x: 0, y: -112, r: 60, label: 'Enter Trial ' + this.game.save.trial }
    ];
  };

  RoomScene.prototype.update = function (dt) {
    this.t += dt;
    this.fade = Math.max(0, this.fade - dt * 0.8);
    if (this.dialogTime > 0) {
      this.dialogTime -= dt;
      if (this.dialogTime <= 0) this.dialog = null;
    }

    var mv = Input.move;
    var speed = 105;
    if (mv.mag > 0.08) {
      this.px += mv.x * speed * mv.mag * dt;
      this.py += mv.y * speed * mv.mag * dt;
      this.pfacing = Math.atan2(mv.y, mv.x);
      this.moving = true;
      this.animPhase += dt * 12;
    } else { this.moving = false; this.animPhase += dt * 2; }
    this.px = U.clamp(this.px, -this.W / 2 + 26, this.W / 2 - 26);
    this.py = U.clamp(this.py, -this.H / 2 + 40, this.H / 2 - 26);

    /* nearest interactable */
    this.prompt = null;
    var zs = this.zones();
    for (var i = 0; i < zs.length; i++) {
      if (U.dist2(this.px, this.py, zs[i].x, zs[i].y) < zs[i].r * zs[i].r) { this.prompt = zs[i]; break; }
    }
    if (this.prompt && (Input.wasPressed('interact') || Input.wasPressed('actionbtn'))) {
      this.trigger(this.prompt.id);
    }

    if (this.mode === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer < 7 && !this.saidTwo) {
        this.saidTwo = true;
        this.dialog = 'Nothing in here is worth touching.';
        this.dialogTime = 4;
      }
      if (this.introTimer <= 0) this.game.startAbduction();
    }
  };

  RoomScene.prototype.trigger = function (id) {
    Audio.play('confirm');
    if (id === 'reality') this.game.setScene(new S.ShopScene(this.game, 'reality'));
    else if (id === 'trial') this.game.setScene(new S.ShopScene(this.game, 'trial'));
    else if (id === 'gate') this.game.enterTrial();
  };

  RoomScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch), t = this.t;
    /* the room is 460 wide and spans -219..+99 vertically once projected */
    var zoom = U.clamp(Math.min(cw / (this.W + 60), (ch - 26) / 372), 0.4, 1.5);

    var bg = ctx.createRadialGradient(cw / 2, ch / 2, 40, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    bg.addColorStop(0, '#241a33');
    bg.addColorStop(1, '#0d0916');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(cw / 2, ch / 2 + 60 * zoom);
    ctx.scale(zoom, zoom);
    var SQ = Art.SQUASH;
    function P(x, y) { return { x: x, y: y * SQ }; }

    var W = this.W, H = this.H;

    /* floor */
    ctx.fillStyle = '#8a6f52';
    ctx.fillRect(-W / 2, -H / 2 * SQ, W, H * SQ);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (var fx = -W / 2; fx < W / 2; fx += 46) ctx.fillRect(fx, -H / 2 * SQ, 2, H * SQ);

    /* back wall */
    ctx.fillStyle = '#5e4f74';
    ctx.fillRect(-W / 2, -H / 2 * SQ - 120, W, 120);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-W / 2, -H / 2 * SQ - 120, W, 40);

    /* window with the city outside */
    var wx = -158, wy = -H / 2 * SQ - 104;
    ctx.fillStyle = '#1c1430';
    Art.roundRect(ctx, wx, wy, 120, 78, 6); ctx.fill();
    ctx.fillStyle = '#2f2450';
    for (var b = 0; b < 4; b++) ctx.fillRect(wx + 8 + b * 28, wy + 30 + (b % 2) * 12, 20, 48);
    ctx.fillStyle = 'rgba(255,220,140,0.75)';
    for (var lw = 0; lw < 10; lw++) {
      ctx.fillRect(wx + 12 + (lw % 4) * 28, wy + 38 + Math.floor(lw / 4) * 14, 4, 5);
    }
    ctx.strokeStyle = '#3b2f4d'; ctx.lineWidth = 5;
    Art.roundRect(ctx, wx, wy, 120, 78, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx + 60, wy); ctx.lineTo(wx + 60, wy + 78); ctx.stroke();

    /* bed */
    ctx.fillStyle = '#7a4b3a';
    Art.roundRect(ctx, W / 2 - 150, -H / 2 * SQ + 6, 130, 74, 8); ctx.fill(); Art.outline(ctx, 3);
    ctx.fillStyle = '#e0e6f0';
    Art.roundRect(ctx, W / 2 - 144, -H / 2 * SQ + 12, 118, 40, 6); ctx.fill();
    ctx.fillStyle = '#c9d4e6';
    Art.roundRect(ctx, W / 2 - 140, -H / 2 * SQ + 14, 44, 24, 5); ctx.fill();

    /* desk */
    ctx.fillStyle = '#6b4a2c';
    Art.roundRect(ctx, -W / 2 + 24, -H / 2 * SQ + 10, 110, 52, 6); ctx.fill(); Art.outline(ctx, 3);
    ctx.fillStyle = '#9aa0a8';
    Art.roundRect(ctx, -W / 2 + 48, -H / 2 * SQ + 18, 44, 28, 3); ctx.fill(); Art.outline(ctx, 2);

    /* purchased decor */
    var sv = this.game.save;
    if (sv.decor.rug) {
      ctx.fillStyle = '#a4405a';
      ctx.beginPath(); ctx.ellipse(0, 30 * SQ, 100, 54 * SQ, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#d9738c'; ctx.lineWidth = 6; ctx.stroke();
    }
    if (sv.decor.plant) Art.drawProp(ctx, 'bush', -W / 2 + 40, H / 2 * SQ - 30, 1.0, 4, t);
    if (sv.decor.lamp) {
      ctx.fillStyle = '#3b2f4d';
      Art.roundRect(ctx, W / 2 - 60, -30, 8, 60, 3); ctx.fill();
      ctx.fillStyle = '#ffe1a0';
      Art.ellipse(ctx, W / 2 - 56, -40, 24, 18); ctx.fill();
      var lg = ctx.createRadialGradient(W / 2 - 56, -30, 6, W / 2 - 56, -30, 130);
      lg.addColorStop(0, 'rgba(255,225,160,0.30)');
      lg.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(W / 2 - 190, -160, 270, 300);
    }
    if (sv.decor.shelf) {
      ctx.fillStyle = '#6b4a2c';
      Art.roundRect(ctx, -W / 2 + 20, -H / 2 * SQ - 66, 90, 10, 3); ctx.fill();
      for (var tr = 0; tr < 3; tr++) {
        ctx.fillStyle = ['#e8c14a', '#c9f0ea', '#ff7a3c'][tr];
        Art.ellipse(ctx, -W / 2 + 36 + tr * 28, -H / 2 * SQ - 74, 7, 9); ctx.fill(); Art.outline(ctx, 2);
      }
    }

    /* hub fixtures */
    if (this.mode === 'hub') {
        this.drawCounter(ctx, -220, 0, '#4a7fd8', 'REALITY');
      this.drawCounter(ctx, 220, 0, '#d84a4a', 'TRIAL');
      this.drawGate(ctx, 0, -112, t);
    }

    /* player */
    var pp = P(this.px, this.py);
    Art.shadow(ctx, pp.x, pp.y, 16);
    Art.chibi(ctx, {
      x: pp.x, y: pp.y, scale: 1.3, phase: this.animPhase, moving: this.moving,
      body: this.game.playerTint(), skin: '#f5c9a0', hair: '#5b3d2b', legs: '#3f6ea8',
      faceDir: Math.cos(this.pfacing) > 0.25 ? 1 : (Math.cos(this.pfacing) < -0.25 ? -1 : 0)
    });

    ctx.restore();

    /* ---- overlay UI ---- */
    Input.stickEnabled = true;
    V.HUD.drawStick(ctx, cw, ch, s);

    if (this.mode === 'hub') {
      UI.text(ctx, D.CURRENCY.symbol + ' ' + U.fmtNum(sv.currency), 16 * s, 22 * s, { size: 18, weight: '800', colour: '#ffe45c' });
      UI.text(ctx, 'Trial ' + sv.trial + ' / ' + D.TOTAL_TRIALS + '   deaths ' + sv.deaths + '/' + D.DEATH_LIMIT,
        16 * s, 44 * s, { size: 12, colour: 'rgba(255,255,255,0.7)' });
      if (sv.gem) {
        var gem = D.GEMS[sv.gem.id];
        Art.drawGem(ctx, cw - 32 * s, 30 * s, 14 * s, gem, t);
        UI.text(ctx, gem.name + ' ' + U.roman(Save.gemLevel(sv)), cw - 52 * s, 30 * s,
          { size: 12, align: 'right', colour: gem.glow });
      }
      var income = Save.passiveIncome(sv);
      if (income > 0) {
        UI.text(ctx, '+' + income + ' / trial', 16 * s, 62 * s, { size: 11, colour: '#7fe08a' });
      }

      /* weapon selector - the scythe shows up here once discovered */
      var ownedW = [];
      for (var wi = 0; wi < D.WEAPON_ORDER.length; wi++) {
        if (sv.weapons[D.WEAPON_ORDER[wi]]) ownedW.push(D.WEAPON_ORDER[wi]);
      }
      var curW = D.WEAPONS[sv.weapon];
      var wBtnW = Math.min(150 * s, cw * 0.42);
      if (UI.button(ctx, 'weapon', cw - wBtnW - 14 * s, ch - 62 * s, wBtnW, 40 * s,
        curW.name + (ownedW.length > 1 ? '  >' : ''), {
          size: 13, sub: 'Lv ' + Save.weaponLevel(sv) + (ownedW.length > 1 ? '  tap to swap' : ''),
          disabled: ownedW.length < 2
        })) this.game.cycleWeapon();

      if (this.prompt) {
        var bw = Math.min(240 * s, cw * 0.6);
        if (UI.button(ctx, 'actionbtn', cw / 2 - bw / 2, ch - 122 * s, bw, 44 * s, this.prompt.label)) {
          this.trigger(this.prompt.id);
        }
      } else {
        UI.text(ctx, 'walk to a counter or the gate', cw / 2, ch - 22 * s,
          { size: 12, align: 'center', colour: 'rgba(255,255,255,0.45)' });
      }
    }

    if (this.dialog) {
      var dw = Math.min(420 * s, cw - 40);
      UI.panel(ctx, cw / 2 - dw / 2, ch - 74 * s, dw, 44 * s, { fill: 'rgba(14,10,22,0.85)' });
      UI.text(ctx, this.dialog, cw / 2, ch - 52 * s, { size: 14, align: 'center', colour: 'rgba(255,240,220,0.92)' });
    }

    if (this.fade > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + this.fade + ')';
      ctx.fillRect(0, 0, cw, ch);
    }
  };

  RoomScene.prototype.drawCounter = function (ctx, x, y, colour, label) {
    var yy = y * Art.SQUASH;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    Art.ellipse(ctx, x, yy + 20, 52, 16); ctx.fill();
    ctx.fillStyle = colour;
    Art.roundRect(ctx, x - 48, yy - 30, 96, 50, 8); ctx.fill(); Art.outline(ctx, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    Art.roundRect(ctx, x - 42, yy - 24, 84, 14, 5); ctx.fill();
    UI.text(ctx, label, x, yy + 34, { size: 11, align: 'center', weight: '800', colour: 'rgba(255,255,255,0.85)' });
  };

  RoomScene.prototype.drawGate = function (ctx, x, y, t) {
    var yy = y * Art.SQUASH;
    var pulse = 0.6 + 0.25 * Math.sin(t * 2.2);
    var g = ctx.createRadialGradient(x, yy - 20, 4, x, yy - 20, 60);
    g.addColorStop(0, 'rgba(180,120,255,' + pulse + ')');
    g.addColorStop(1, 'rgba(80,40,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, yy - 92, 140, 150);
    ctx.strokeStyle = '#b58cff'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(x, yy - 20, 34, 46, 0, 0, U.TAU);
    ctx.stroke();
    UI.text(ctx, 'THE GATE', x, yy - 82, { size: 12, align: 'center', weight: '800', colour: '#e0ccff' });
  };

  /* ================================================================ CUTSCENE
     GDD 2: Garatu arrives through a gate and takes the player. */
  function CutsceneScene(game, kind) {
    this.game = game;
    this.kind = kind || 'abduction';
    this.t = 0;
    this.beat = 0;
    this.lines = this.kind === 'abduction' ? [
      { at: 0.0, text: null },
      { at: 1.6, text: 'The air splits open.' },
      { at: 4.2, text: '"This is the first of many trials."' },
      { at: 7.0, text: '"We hope you can entertain us more."' },
      { at: 10.0, text: null }
    ] : [
      { at: 0.0, text: null },
      { at: 1.4, text: '"Fifty trials. You are still standing."' },
      { at: 4.4, text: '"Then meet what waits underneath."' },
      { at: 7.4, text: null }
    ];
    this.duration = this.kind === 'abduction' ? 12 : 9;
    Audio.music(null);
    Audio.play('warp');
  }

  CutsceneScene.prototype.update = function (dt) {
    this.t += dt;
    if (this.t > this.duration || Input.wasPressed('confirm') || Input.wasPressed('skip')) {
      this.game.cutsceneDone(this.kind);
    }
  };

  CutsceneScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch), t = this.t;
    var line = null;
    for (var i = 0; i < this.lines.length; i++) if (t >= this.lines[i].at) line = this.lines[i].text;

    ctx.fillStyle = '#0d0916';
    ctx.fillRect(0, 0, cw, ch);

    /* gate opening */
    var gateT = U.clamp((t - 0.6) / 1.6, 0, 1);
    var gx = cw * 0.62, gy = ch * 0.44;
    var gr = 20 + gateT * 130 * s;
    var g = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
    g.addColorStop(0, 'rgba(255,220,255,0.95)');
    g.addColorStop(0.4, 'rgba(170,90,255,0.55)');
    g.addColorStop(1, 'rgba(60,20,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - gr, gy - gr * 1.4, gr * 2, gr * 2.8);

    ctx.strokeStyle = 'rgba(230,190,255,' + (0.5 + 0.4 * Math.sin(t * 6)) + ')';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr * 0.55, gr * 0.95, 0, 0, U.TAU);
    ctx.stroke();

    /* Garatu emerging */
    if (t > 1.4) {
      var em = U.clamp((t - 1.4) / 1.4, 0, 1);
      ctx.globalAlpha = em;
      Art.drawGaratu(ctx, gx, gy + 30 * s, 1.5 * s * (0.7 + em * 0.5), t);
      ctx.globalAlpha = 1;
    }

    /* the player, small, being lifted */
    var lift = U.clamp((t - 6.5) / 3, 0, 1);
    var pxx = U.lerp(cw * 0.28, gx - 40 * s, lift);
    var pyy = U.lerp(ch * 0.62, gy + 10 * s, lift) - lift * 20 * s;
    if (t < 10.5 || this.kind !== 'abduction') {
      Art.shadow(ctx, pxx, ch * 0.62, 16 * (1 - lift * 0.7), 0.2 * (1 - lift));
      Art.chibi(ctx, {
        x: pxx, y: pyy, scale: 1.3 * s, phase: t * 3, moving: false,
        body: this.game.playerTint(), skin: '#f5c9a0', hair: '#5b3d2b', legs: '#3f6ea8',
        faceDir: 1, lean: lift * 0.5
      });
    }

    /* fade out at the end */
    if (t > this.duration - 2) {
      ctx.fillStyle = 'rgba(0,0,0,' + U.clamp((t - (this.duration - 2)) / 2, 0, 1) + ')';
      ctx.fillRect(0, 0, cw, ch);
    }

    if (line) {
      var w = Math.min(460 * s, cw - 36);
      UI.panel(ctx, cw / 2 - w / 2, ch - 88 * s, w, 52 * s, { fill: 'rgba(10,8,16,0.82)' });
      UI.text(ctx, line, cw / 2, ch - 62 * s, { size: 16, align: 'center', colour: '#ffe9c9' });
    }
    Input.zone('skip', cw - 90 * s, 14 * s, 76 * s, 30 * s);
    UI.button(ctx, 'skip', cw - 90 * s, 14 * s, 76 * s, 30 * s, 'Skip', { size: 12 });
  };

  /* =================================================================== SHOPS */
  function ShopScene(game, which) {
    this.game = game;
    this.which = which;
    this.items = which === 'reality' ? D.REALITY_SHOP : D.TRIAL_SHOP;
    this.scroll = 0;
    this.t = 0;
    this.flash = null; this.flashTime = 0;
    Audio.music('hub');
  }

  ShopScene.prototype.update = function (dt) {
    this.t += dt;
    if (this.flashTime > 0) { this.flashTime -= dt; if (this.flashTime <= 0) this.flash = null; }
    if (Input.wasPressed('back')) this.game.setScene(new S.RoomScene(this.game, 'hub'));
  };

  ShopScene.prototype.buy = function (item) {
    var res = this.game.buy(item);
    this.flash = res.message;
    this.flashTime = 2;
    Audio.play(res.ok ? 'coin' : 'deny');
  };

  ShopScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch);
    var sv = this.game.save;
    ctx.fillStyle = this.which === 'reality' ? '#1e2a3d' : '#2d1a26';
    ctx.fillRect(0, 0, cw, ch);

    var title = this.which === 'reality' ? 'Reality Shop' : 'Trial Shop';
    UI.text(ctx, title, 18 * s, 26 * s, { size: 22, weight: '800' });
    UI.text(ctx, D.CURRENCY.symbol + ' ' + U.fmtNum(sv.currency), cw - 18 * s, 26 * s,
      { size: 20, align: 'right', weight: '800', colour: '#ffe45c' });

    var listTop = 52 * s, listBottom = ch - 62 * s;
    var rowH = 62 * s;
    var maxScroll = Math.max(0, this.items.length * rowH - (listBottom - listTop));

    /* drag to scroll */
    if (Input.stick.active) {
      /* the stick doubles as a scroll drag inside shop lists */
      this.scroll = U.clamp(this.scroll - (Input.stick.y - Input.stick.oy) * 0.06, 0, maxScroll);
    }
    if (Input.keys.down) this.scroll = U.clamp(this.scroll + 340 * 0.016, 0, maxScroll);
    if (Input.keys.up) this.scroll = U.clamp(this.scroll - 340 * 0.016, 0, maxScroll);
    Input.stickEnabled = true;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, cw, listBottom - listTop);
    ctx.clip();

    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      var y = listTop + i * rowH - this.scroll;
      if (y > listBottom || y + rowH < listTop) continue;

      var count = Save.ownedCount(sv, it.id);
      var owned = count > 0 && !it.stack;
      var locked = it.needs && !Save.ownedCount(sv, it.needs);
      var afford = sv.currency >= it.price;

      var x = 14 * s, w = cw - 28 * s;
      UI.panel(ctx, x, y + 4 * s, w, rowH - 10 * s, {
        fill: owned ? 'rgba(60,90,60,0.55)' : 'rgba(30,26,42,0.8)'
      });
      UI.text(ctx, it.name, x + 14 * s, y + 22 * s, { size: 15, weight: '700' });
      UI.text(ctx, it.cat, x + 14 * s, y + 40 * s, { size: 10, colour: 'rgba(255,255,255,0.45)' });
      UI.text(ctx, it.desc + (it.stack && count ? '  (x' + count + ')' : ''), x + 60 * s, y + 40 * s,
        { size: 11, colour: 'rgba(255,255,255,0.7)' });

      var bw = 88 * s;
      var label = owned ? 'Owned' : (locked ? 'Locked' : D.CURRENCY.symbol + ' ' + it.price);
      if (UI.button(ctx, 'buy' + i, x + w - bw - 12 * s, y + 16 * s, bw, 32 * s, label, {
        disabled: owned || locked || !afford,
        fill: afford ? 'rgba(70,110,70,0.9)' : 'rgba(52,44,68,0.9)', size: 13
      })) this.buy(it);
    }
    ctx.restore();

    if (maxScroll > 0) {
      var trackH = listBottom - listTop;
      var thumb = trackH * (trackH / (trackH + maxScroll));
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      Art.roundRect(ctx, cw - 7 * s, listTop + (this.scroll / maxScroll) * (trackH - thumb), 4 * s, thumb, 2 * s);
      ctx.fill();
    }

    if (this.flash) {
      UI.text(ctx, this.flash, cw / 2, ch - 74 * s, { size: 13, align: 'center', colour: '#ffe45c' });
    }
    if (UI.button(ctx, 'back', cw / 2 - 80 * s, ch - 52 * s, 160 * s, 38 * s, 'Back to room')) {
      this.game.setScene(new S.RoomScene(this.game, 'hub'));
    }
  };

  /* ================================================================ RANKING
     GDD 6.2 / 12. Placement, outcome, one Continue action. */
  function RankingScene(game, result) {
    this.game = game;
    this.result = result;
    this.t = 0;
    this.reveal = 0;
    Audio.music('hub');
  }

  RankingScene.prototype.update = function (dt) {
    this.t += dt;
    this.reveal = U.clamp(this.reveal + dt * 0.9, 0, 1);
    if (Input.wasPressed('confirm') && this.reveal >= 1) this.game.leaveRanking();
  };

  RankingScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch);
    var r = this.result;
    var outcome = r.tier.outcome;

    var bg = outcome === 'reward' ? '#1d3324' : (outcome === 'neutral' ? '#2a2740' : '#331c22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    var w = Math.min(420 * s, cw - 28), x = cw / 2 - w / 2;
    var y = Math.max(18 * s, ch / 2 - 190 * s);
    UI.panel(ctx, x, y, w, Math.min(380 * s, ch - 36 * s));

    UI.text(ctx, r.trial.label, cw / 2, y + 26 * s, { size: 14, align: 'center', colour: 'rgba(255,255,255,0.65)' });

    var pct = Math.round(U.lerp(99, r.percentile, U.easeOut(this.reveal)));
    UI.text(ctx, 'TOP ' + pct + '%', cw / 2, y + 66 * s, {
      size: 40, align: 'center', weight: '800',
      colour: outcome === 'reward' ? '#8ce89a' : (outcome === 'neutral' ? '#ffe45c' : '#ff7a7a')
    });
    UI.text(ctx, r.tier.label, cw / 2, y + 96 * s, { size: 14, align: 'center', colour: 'rgba(255,255,255,0.7)' });

    var msg = outcome === 'reward' ? 'The watchers are pleased.'
      : (outcome === 'neutral' ? 'Survived. Nothing earned.' : 'Not enough. Run it again.');
    if (r.died) msg = 'You died. Back to the start of this trial.';
    UI.text(ctx, msg, cw / 2, y + 122 * s, { size: 13, align: 'center', colour: 'rgba(255,255,255,0.8)' });

    /* stat rows */
    var rows = [
      ['Score', U.fmtNum(r.score) + ' / ' + U.fmtNum(r.par)],
      ['Kills', String(r.kills)],
      ['Damage taken', String(r.damageTaken)],
      ['Time left', U.fmtTime(r.timeLeft)]
    ];
    if (r.payout) rows.push(['Reward', D.CURRENCY.symbol + ' ' + U.fmtNum(r.payout)]);
    if (r.income) rows.push(['Business income', D.CURRENCY.symbol + ' ' + U.fmtNum(r.income)]);
    if (r.debuffName) rows.push(['Debuff next attempt', r.debuffName]);

    var ry = y + 150 * s;
    for (var i = 0; i < rows.length; i++) {
      UI.text(ctx, rows[i][0], x + 22 * s, ry + i * 22 * s, { size: 12, colour: 'rgba(255,255,255,0.6)' });
      UI.text(ctx, rows[i][1], x + w - 22 * s, ry + i * 22 * s, { size: 12, align: 'right', colour: '#fff' });
    }

    var by = Math.min(y + 340 * s, ch - 56 * s);
    if (UI.button(ctx, 'continue', cw / 2 - 90 * s, by, 180 * s, 40 * s, 'Continue')) {
      if (this.reveal >= 0.9) this.game.leaveRanking();
      else this.reveal = 1;
    }
  };

  /* =============================================================== GEM GRANT
     GDD 8: received once, during the first trial, fully random. */
  function GemScene(game, gemId) {
    this.game = game;
    this.gem = D.GEMS[gemId];
    this.t = 0;
    Audio.play('gem');
  }
  GemScene.prototype.update = function (dt) { this.t += dt; };
  GemScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch), t = this.t;
    ctx.fillStyle = '#150f22';
    ctx.fillRect(0, 0, cw, ch);
    var g = ctx.createRadialGradient(cw / 2, ch * 0.38, 10, cw / 2, ch * 0.38, 220 * s);
    g.addColorStop(0, this.gem.colour + 'cc');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    Art.drawGem(ctx, cw / 2, ch * 0.38, 46 * s, this.gem, t);
    UI.text(ctx, this.gem.name, cw / 2, ch * 0.55, { size: 28, align: 'center', weight: '800', colour: this.gem.glow });
    UI.text(ctx, this.gem.role, cw / 2, ch * 0.55 + 26 * s, { size: 13, align: 'center', colour: 'rgba(255,255,255,0.65)' });
    UI.text(ctx, this.gem.desc(1), cw / 2, ch * 0.55 + 48 * s, { size: 13, align: 'center', colour: '#fff' });
    UI.text(ctx, 'It grows as you do.', cw / 2, ch * 0.55 + 72 * s, { size: 11, align: 'center', colour: 'rgba(255,255,255,0.45)' });

    if (UI.button(ctx, 'continue', cw / 2 - 80 * s, ch - 70 * s, 160 * s, 40 * s, 'Take it')) {
      this.game.gemTaken();
    }
  };

  /* ============================================================== FULL RESET
     GDD 9: 25 deaths wipes everything. */
  function ResetScene(game) {
    this.game = game;
    this.t = 0;
    Audio.music(null);
    Audio.play('lose');
  }
  ResetScene.prototype.update = function (dt) { this.t += dt; };
  ResetScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch);
    ctx.fillStyle = '#0d0710';
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = 0.25;
    Art.drawGaratu(ctx, cw / 2, ch * 0.42, 1.6 * s, this.t);
    ctx.globalAlpha = 1;
    UI.text(ctx, 'TWENTY-FIVE', cw / 2, ch * 0.55, { size: 34, align: 'center', weight: '800', colour: '#ff5f6d' });
    UI.text(ctx, '"You bored them. Start again."', cw / 2, ch * 0.55 + 34 * s,
      { size: 15, align: 'center', colour: 'rgba(255,220,220,0.8)' });
    UI.text(ctx, 'Currency, gem, purchases and weapons are gone. The scythe is hidden again.',
      cw / 2, ch * 0.55 + 60 * s, { size: 11, align: 'center', colour: 'rgba(255,255,255,0.45)' });
    if (UI.button(ctx, 'continue', cw / 2 - 90 * s, ch - 74 * s, 180 * s, 42 * s, 'Start again')) {
      this.game.confirmFullReset();
    }
  };

  /* ================================================================ VICTORY */
  function VictoryScene(game) { this.game = game; this.t = 0; Audio.play('win'); Audio.music('calm'); }
  VictoryScene.prototype.update = function (dt) { this.t += dt; };
  VictoryScene.prototype.render = function (ctx, cw, ch) {
    var s = UI.setScale(cw, ch), t = this.t;
    var g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#2b1c3f'); g.addColorStop(1, '#a35d7a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    for (var i = 0; i < 40; i++) {
      var a = (i / 40) * U.TAU + t * 0.2;
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#ffe9c9';
      Art.ellipse(ctx, cw / 2 + Math.cos(a) * (120 + i * 4) * s, ch * 0.4 + Math.sin(a) * (70 + i * 2) * s, 2, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    UI.text(ctx, 'THE WATCHERS ARE SILENT', cw / 2, ch * 0.4, { size: 26, align: 'center', weight: '800', colour: '#ffe9c9' });
    UI.text(ctx, 'Aurelith is down. Fifty trials behind you.', cw / 2, ch * 0.4 + 34 * s,
      { size: 14, align: 'center', colour: 'rgba(255,240,220,0.85)' });
    var sv = this.game.save;
    UI.text(ctx, 'deaths ' + sv.deaths + '   ' + D.CURRENCY.symbol + ' ' + U.fmtNum(sv.lifetimeEarned) + ' earned',
      cw / 2, ch * 0.4 + 58 * s, { size: 12, align: 'center', colour: 'rgba(255,255,255,0.6)' });
    if (UI.button(ctx, 'continue', cw / 2 - 90 * s, ch - 76 * s, 180 * s, 42 * s, 'Back to the start')) {
      this.game.setScene(new S.StartScene(this.game));
    }
  };

  S.StartScene = StartScene;
  S.HelpScene = HelpScene;
  S.RoomScene = RoomScene;
  S.CutsceneScene = CutsceneScene;
  S.ShopScene = ShopScene;
  S.RankingScene = RankingScene;
  S.GemScene = GemScene;
  S.ResetScene = ResetScene;
  S.VictoryScene = VictoryScene;
  V.S = S;
})(window.V = window.V || {});
