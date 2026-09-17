/* Velthiros - shared UI widgets and the trial HUD (GDD 12) */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, Input = V.Input, Audio = V.Audio;
  var UI = {};

  UI.FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  UI.scale = 1;

  /* Overwritten by Game.resize; these are the desktop defaults. */
  UI.inset = { top: 0, right: 0, bottom: 0, left: 0 };
  UI.portrait = false;

  UI.setScale = function (cw, ch) {
    UI.scale = U.clamp(Math.min(cw, ch) / 400, 0.82, 1.7);
    return UI.scale;
  };

  UI.font = function (ctx, size, weight) {
    ctx.font = (weight || '600') + ' ' + Math.round(size * UI.scale) + 'px ' + UI.FONT;
  };

  UI.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    UI.font(ctx, opts.size || 15, opts.weight);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,' + (opts.shadowAlpha || 0.45) + ')';
      ctx.fillText(str, x + 1.5, y + 1.8);
    }
    ctx.fillStyle = opts.colour || '#fff';
    ctx.fillText(str, x, y);
  };

  UI.panel = function (ctx, x, y, w, h, opts) {
    opts = opts || {};
    ctx.fillStyle = opts.fill || 'rgba(28,22,38,0.88)';
    Art.roundRect(ctx, x, y, w, h, opts.radius || 14 * UI.scale);
    ctx.fill();
    ctx.strokeStyle = opts.stroke || 'rgba(255,255,255,0.16)';
    ctx.lineWidth = opts.lineWidth || 2;
    ctx.stroke();
  };

  /* Returns true on the frame the button is released-as-a-tap (or key pressed). */
  UI.button = function (ctx, id, x, y, w, h, label, opts) {
    opts = opts || {};
    var held = Input.isDown(id);
    var disabled = !!opts.disabled;
    Input.zone(id, x, y, w, h);

    var fill = disabled ? 'rgba(60,56,70,0.7)'
      : (held ? (opts.activeFill || 'rgba(255,220,120,0.95)') : (opts.fill || 'rgba(52,44,68,0.94)'));
    var textCol = disabled ? 'rgba(255,255,255,0.35)'
      : (held ? '#2a2135' : (opts.colour || '#fff'));

    ctx.save();
    if (held && !disabled) ctx.translate(0, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    Art.roundRect(ctx, x, y + 4, w, h, opts.radius || 12 * UI.scale); ctx.fill();
    ctx.fillStyle = fill;
    Art.roundRect(ctx, x, y, w, h, opts.radius || 12 * UI.scale); ctx.fill();
    ctx.strokeStyle = opts.stroke || (held ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)');
    ctx.lineWidth = 2;
    ctx.stroke();

    UI.text(ctx, label, x + w / 2, y + h / 2, {
      size: opts.size || 17, align: 'center', colour: textCol, weight: '700', shadow: !held
    });
    if (opts.sub) {
      UI.text(ctx, opts.sub, x + w / 2, y + h / 2 + 15 * UI.scale, {
        size: 11, align: 'center', colour: held ? 'rgba(40,32,50,0.8)' : 'rgba(255,255,255,0.6)'
      });
    }
    ctx.restore();

    if (disabled) return false;
    var fired = Input.wasPressed(id);
    if (fired) Audio.play(opts.silent ? null : 'ui');
    return fired;
  };

  UI.roundButton = function (ctx, id, cx, cy, r, label, opts) {
    opts = opts || {};
    var held = Input.isDown(id);
    var disabled = !!opts.disabled;
    Input.circleZone(id, cx, cy, r * 1.08);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    Art.ellipse(ctx, cx, cy + 4, r, r); ctx.fill();
    var fill = disabled ? 'rgba(60,56,70,0.5)' : (held ? (opts.activeFill || 'rgba(255,225,140,0.95)') : (opts.fill || 'rgba(58,48,76,0.8)'));
    ctx.fillStyle = fill;
    Art.ellipse(ctx, cx, cy + (held ? 2 : 0), r, r); ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (opts.cooldown > 0 && opts.cooldownMax > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + U.TAU * (opts.cooldown / opts.cooldownMax));
      ctx.closePath(); ctx.fill();
    }

    UI.text(ctx, label, cx, cy + (held ? 2 : 0), {
      size: opts.size || 15, align: 'center', weight: '800',
      colour: disabled ? 'rgba(255,255,255,0.4)' : (held ? '#2a2135' : '#fff')
    });
    ctx.restore();
    return Input.wasPressed(id);
  };

  UI.bar = function (ctx, x, y, w, h, frac, colour, opts) {
    opts = opts || {};
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    Art.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.fill();
    ctx.fillStyle = opts.back || 'rgba(255,255,255,0.14)';
    Art.roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    var fw = Math.max(0, w * U.clamp(frac, 0, 1));
    if (fw > 1) {
      ctx.fillStyle = colour;
      Art.roundRect(ctx, x, y, fw, h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      Art.roundRect(ctx, x + 2, y + 1.5, Math.max(0, fw - 4), h * 0.34, h * 0.2); ctx.fill();
    }
    if (opts.label) {
      UI.text(ctx, opts.label, x + w + 8, y + h / 2, { size: 11, colour: 'rgba(255,255,255,0.85)' });
    }
  };

  /* full-screen dim used behind modal panels */
  UI.dim = function (ctx, cw, ch, a) {
    ctx.fillStyle = 'rgba(10,8,16,' + (a == null ? 0.62 : a) + ')';
    ctx.fillRect(0, 0, cw, ch);
  };

  UI.wrap = function (ctx, str, maxWidth, size) {
    UI.font(ctx, size || 15);
    var words = String(str).split(' ');
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  /* ==================================================================== HUD */
  var HUD = {};

  /* A centred, wrapping caption bar. Tutorial prompts are full sentences, so
     it has to wrap rather than run off the side of a phone. */
  HUD.banner = function (ctx, txt, cw, y, s, size, colour) {
    var maxW = Math.min(cw * 0.78, 420 * s);
    var lines = UI.wrap(ctx, txt, maxW, size);
    var lineH = (size + 4) * s;
    var wide = 0;
    for (var i = 0; i < lines.length; i++) wide = Math.max(wide, ctx.measureText(lines[i]).width);
    var bw = wide + 26 * s, bh = lines.length * lineH + 10 * s;
    UI.panel(ctx, cw / 2 - bw / 2, y, bw, bh, { fill: 'rgba(20,16,28,0.74)' });
    for (var j = 0; j < lines.length; j++) {
      UI.text(ctx, lines[j], cw / 2, y + 5 * s + lineH * (j + 0.5),
        { size: size, align: 'center', colour: colour });
    }
    return bh;
  };

  HUD.draw = function (ctx, trial, cw, ch) {
    var s = UI.setScale(cw, ch);
    var p = trial.player;
    var pad = 14 * s;

    /* ---- damage numbers, handed up from the world pass so they stay crisp ---- */
    var ps = (trial.game && trial.game.pixScale) || 1;
    var fl = trial.screenFloaters || [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var fi = 0; fi < fl.length; fi++) {
      var f = fl[fi];
      var fx = (trial._originX + f.x) * ps;
      var fy = (trial._originY + f.y) * ps;
      ctx.globalAlpha = f.alpha;
      UI.text(ctx, f.text, fx, fy, { size: 13, align: 'center', weight: '800', colour: f.colour });
    }
    /* ---- world labels (pedestal names, the gate) - same treatment ---- */
    var wls = trial.screenLabels || [];
    for (var li = 0; li < wls.length; li++) {
      var wl = wls[li];
      UI.text(ctx, wl.text, (trial._originX + wl.x) * ps, (trial._originY + wl.y) * ps,
        { size: 12, align: 'center', weight: '800', colour: wl.colour });
    }
    ctx.globalAlpha = 1;

    /* ---- the top block ----
       Landscape spreads bars / timer / label across one row. Portrait has no
       room for that - at 390pt the three collide into each other - so the
       timer moves right, the trial label drops (it is already on the intro
       card), and pause tucks under the bars where a thumb can reach it. */
    var ins = UI.inset;
    var padL = pad + ins.left, padR = pad + ins.right;
    var padT = pad + ins.top, padB = pad + ins.bottom;
    var tall = UI.portrait;
    var warn = !trial.untimed && trial.timeLeft < 15;
    var clock = trial.untimed ? '--:--' : U.fmtTime(trial.timeLeft);
    var clockCol = trial.untimed ? 'rgba(255,255,255,0.45)' : (warn ? '#ff8a8a' : '#fff');

    var barW = Math.min(150 * s, cw * (tall ? 0.40 : 0.34));
    UI.bar(ctx, padL, padT + 4, barW, 11 * s, p.hp / p.stats.maxHp, '#ff5f6d');
    UI.bar(ctx, padL, padT + 22 * s, barW * 0.86, 8 * s, p.stamina / p.stats.maxStamina, '#7fe08a');
    UI.text(ctx, Math.ceil(p.hp) + '/' + p.stats.maxHp, padL + barW + 8, padT + 9 * s,
      { size: 11, colour: 'rgba(255,255,255,0.9)' });

    var pauseX, pauseY;
    if (tall) {
      UI.text(ctx, clock, cw - padR, padT + 10 * s, { size: 22, align: 'right', weight: '800', colour: clockCol });
      UI.text(ctx, HUD.progressText(trial), cw - padR, padT + 30 * s, { size: 12, align: 'right', colour: '#ffe45c' });
      pauseX = padL; pauseY = padT + 38 * s;
    } else {
      UI.text(ctx, clock, cw / 2, padT + 12 * s, { size: 26, align: 'center', weight: '800', colour: clockCol });
      UI.text(ctx, trial.spec.label, cw - padR, padT + 6 * s, { size: 13, align: 'right', colour: 'rgba(255,255,255,0.85)' });
      UI.text(ctx, HUD.progressText(trial), cw - padR, padT + 24 * s, { size: 13, align: 'right', colour: '#ffe45c' });
      pauseX = cw - padR - 34 * s; pauseY = padT + 38 * s;
    }

    if (UI.button(ctx, 'pause', pauseX, pauseY, 34 * s, 26 * s, '| |', { size: 13 })) {
      trial.paused = !trial.paused;
    }

    /* ---- objective banner ----
       Instruction has to stay put: trial.message auto-clears after a couple of
       seconds, which is right for a combat nudge and useless for "here is how
       to move". persistentPrompt sits underneath and only the beat clears it. */
    var bannerTop = padT + (tall ? 70 : 34) * s;
    if (trial.t < 6 || trial.message) {
      HUD.banner(ctx, trial.message || trial.objective.text, cw, bannerTop, s, 14, '#fff');
    }
    if (trial.persistentPrompt) {
      var py = bannerTop + (trial.message || trial.t < 6 ? 30 : 0) * s;
      HUD.banner(ctx, trial.persistentPrompt, cw, py, s, 13, '#ffe45c');
    }

    /* ---- hide-trial spotted warning ---- */
    if (trial.type === 'hide' && trial.spotted) {
      UI.text(ctx, 'SPOTTED', cw / 2, ch * 0.24, { size: 30, align: 'center', weight: '800', colour: '#ff5f6d' });
    }
    if (p.hidden) {
      UI.text(ctx, 'hidden', cw / 2, ch * 0.24, { size: 16, align: 'center', colour: 'rgba(160,240,180,0.9)' });
    }

    /* ---- bottom-left: virtual joystick ---- */
    Input.stickEnabled = !trial.paused && !trial.card && trial.state === 'play';
    HUD.drawStick(ctx, cw, ch, s);

    /* ---- bottom-right: action buttons ---- */
    var live = trial.state === 'play' && !trial.paused && !trial.card && !p.dead;
    var lk = trial.lockedActions || {};
    var aR = 44 * s, sR = 31 * s, dR = 26 * s;
    var ax = cw - padR - aR - 6 * s, ay = ch - padB - aR - 6 * s;

    /* Laid out on an arc around the thumb, each button placed far enough from
       its neighbour that their touch zones cannot meet. They used to be packed
       by hand-tuned offsets and the circles genuinely overlapped: because
       hit-testing walks the zone list backwards, the left edge of ATK fired
       Spin instead. `1.08` matches the padding roundButton adds to its zone. */
    function nextTo(fromX, fromY, r1, r2, deg) {
      var d = (r1 + r2) * 1.08 + 5 * s;
      var a = deg * Math.PI / 180;
      return { x: fromX + Math.cos(a) * d, y: fromY + Math.sin(a) * d };
    }
    var spc = nextTo(ax, ay, aR, sR, 198);        /* left of ATK, a little high */
    var ddg = nextTo(ax, ay, aR, dR, 275);        /* straight above ATK */
    var itm = nextTo(spc.x, spc.y, sR, dR, 250);  /* up and in from the special */

    if (UI.roundButton(ctx, 'attack', ax, ay, aR, 'ATK', { disabled: !live || lk.attack, size: 16 })
      && live && !lk.attack) p.tryAttack(false);

    var wpn = D.WEAPONS[p.weaponId];
    if (UI.roundButton(ctx, 'special', spc.x, spc.y, sR, wpn.special.name, {
      disabled: !live || lk.special, size: 11, cooldown: p.specialCd, cooldownMax: wpn.special.cooldown
    }) && live && !lk.special) p.tryAttack(true);

    if (UI.roundButton(ctx, 'dodge', ddg.x, ddg.y, dR, 'DODGE', {
      disabled: !live || lk.dodge, size: 9, cooldown: p.dodgeCd,
      cooldownMax: V.E.DODGE_COOLDOWN * p.stats.dodgeCdMul
    }) && live && !lk.dodge) p.tryDodge();

    var items = trial.consumables.potion + trial.consumables.tonic + trial.consumables.smoke;
    if (UI.roundButton(ctx, 'item', itm.x, itm.y, dR, 'ITEM ' + items, {
      disabled: !live || lk.item || items <= 0, size: 9
    }) && live && !lk.item) trial.useConsumable();

    /* ---- riddle panel ---- */
    if (trial.riddle && !trial.riddle.answered) HUD.drawRiddle(ctx, trial, cw, ch, s);

    /* ---- pause menu ---- */
    if (trial.paused) HUD.drawPause(ctx, trial, cw, ch, s);

    /* ---- intro card ---- */
    if (trial.state === 'intro') HUD.drawIntro(ctx, trial, cw, ch, s);

    /* ---- a card that has to be read ---- */
    if (trial.card) HUD.drawCard(ctx, trial, cw, ch, s);
  };

  /* A full stop. Used for the things that change the run permanently and were
     previously announced in the same transient banner as a hint counter - the
     gem above all, which is the only stat choice in a run and used to arrive
     as four and a half seconds of small text in the corner.

     Drawn over the dim, so the arena is still visible behind it: this is a
     thing that just happened to you in the world, not a menu. */
  HUD.drawCard = function (ctx, trial, cw, ch, s) {
    var c = trial.card;
    UI.dim(ctx, cw, ch, 0.62);

    var w = Math.min(cw - 40 * s, 360 * s);
    var x = cw / 2 - w / 2;
    var body = UI.wrap(ctx, c.body, w - 32 * s, 13);
    var h = (c.role ? 112 : 96) * s + body.length * 17 * s;
    var y = ch * 0.5 - h / 2;

    UI.panel(ctx, x, y, w, h);

    /* a band of the gem's own colour, so the card is recognisably about the
       thing that is now glowing on the HUD */
    ctx.fillStyle = c.colour || '#ffe45c';
    ctx.fillRect(x, y, w, 3 * s);

    var ty = y + 30 * s;
    UI.text(ctx, c.title, cw / 2, ty,
      { size: 20, align: 'center', weight: '800', colour: c.glow || '#fff' });
    if (c.role) {
      ty += 20 * s;
      UI.text(ctx, c.role, cw / 2, ty,
        { size: 11, align: 'center', colour: 'rgba(255,255,255,0.55)' });
    }
    ty += 26 * s;
    for (var i = 0; i < body.length; i++) {
      UI.text(ctx, body[i], cw / 2, ty + i * 17 * s, { size: 13, align: 'center' });
    }

    if (UI.button(ctx, 'cardok', x + 16 * s, y + h - 44 * s, w - 32 * s, 32 * s,
                  c.cta || 'Continue', { size: 14 })) {
      trial.dismissCard();
    }
  };

  HUD.progressText = function (trial) {
    switch (trial.type) {
      case 'tutorial': return V.Tutorial.progressText(trial);
      case 'defeat': return trial.kills + ' / ' + trial.target + ' slain';
      case 'seek': return (trial.target - (trial.enemiesLeft || trial.target)) + ' / ' + trial.target + ' found';
      case 'defend': return 'Ground ' + Math.ceil(trial.zone.hp) + '%';
      case 'deliver': return trial.relic.taken ? 'Deliver it' : 'Find the relic';
      case 'puzzle': return (trial.lastSolved || 0) + ' / ' + trial.plates.length + ' set';
      case 'word': return trial.riddle.revealed + ' / 3 hints';
      case 'hide': return 'Stay unseen';
      case 'boss': return trial.boss && !trial.boss.dead ? Math.ceil(trial.boss.hp) + ' hp' : 'down';
      default: return '';
    }
  };

  HUD.drawStick = function (ctx, cw, ch, s) {
    var st = Input.stick;
    var baseX, baseY, knobX, knobY, alpha;
    if (st.active) {
      baseX = st.ox; baseY = st.oy;
      var dx = st.x - baseX, dy = st.y - baseY;
      var d = Math.sqrt(dx * dx + dy * dy);
      var lim = Input.stickRadius;
      if (d > lim) { dx = dx / d * lim; dy = dy / d * lim; }
      knobX = baseX + dx; knobY = baseY + dy;
      alpha = 0.5;
    } else {
      baseX = 78 * s; baseY = ch - 78 * s;
      knobX = baseX; knobY = baseY;
      alpha = 0.22;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.lineWidth = 3;
    Art.ellipse(ctx, baseX, baseY, Input.stickRadius, Input.stickRadius); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.35) + ')';
    Art.ellipse(ctx, baseX, baseY, Input.stickRadius, Input.stickRadius); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha + 0.28) + ')';
    Art.ellipse(ctx, knobX, knobY, 26, 26); ctx.fill();
    ctx.restore();
  };

  HUD.drawIntro = function (ctx, trial, cw, ch, s) {
    var k = U.clamp(trial.introTimer / 2.4, 0, 1);
    UI.dim(ctx, cw, ch, 0.55 * U.clamp(k * 2, 0, 1));
    UI.text(ctx, trial.spec.label, cw / 2, ch / 2 - 30 * s, { size: 30, align: 'center', weight: '800' });
    UI.text(ctx, trial.objective.text, cw / 2, ch / 2 + 6 * s, { size: 17, align: 'center', colour: '#ffe45c' });
    UI.text(ctx, trial.env.name, cw / 2, ch / 2 + 32 * s, { size: 13, align: 'center', colour: 'rgba(255,255,255,0.6)' });
  };

  HUD.drawRiddle = function (ctx, trial, cw, ch, s) {
    var r = trial.riddle;
    var w = Math.min(cw - 40 * s, 420 * s);
    var x = cw / 2 - w / 2;
    var lines = UI.wrap(ctx, r.q, w - 28 * s, 14);
    var h = 62 * s + lines.length * 18 * s + 4 * 32 * s;
    var y = ch * 0.5 - h / 2;

    UI.panel(ctx, x, y, w, h);
    for (var i = 0; i < lines.length; i++) {
      UI.text(ctx, lines[i], cw / 2, y + 22 * s + i * 18 * s, { size: 14, align: 'center' });
    }

    /* You may answer at any point. Every hint left unfound is worth more score,
       so this is a real gamble rather than a checklist. */
    var oy = y + 32 * s + lines.length * 18 * s;
    var left = 3 - r.revealed;
    UI.text(ctx, left > 0
      ? r.revealed + '/3 hints found - answering now scores higher, if you are right'
      : 'all 3 hints found',
      cw / 2, oy, { size: 11, align: 'center', colour: left > 0 ? '#ffe45c' : 'rgba(255,255,255,0.55)' });

    for (var o = 0; o < r.options.length; o++) {
      var by = oy + 16 * s + o * 32 * s;
      if (UI.button(ctx, 'ans' + o, x + 14 * s, by, w - 28 * s, 27 * s, r.options[o], { size: 14 })) {
        trial.answerRiddle(r.options[o]);
      }
    }
  };

  HUD.drawPause = function (ctx, trial, cw, ch, s) {
    UI.dim(ctx, cw, ch, 0.72);
    var w = Math.min(300 * s, cw - 40), x = cw / 2 - w / 2, y = ch / 2 - 120 * s;
    UI.panel(ctx, x, y, w, 240 * s);
    UI.text(ctx, 'Paused', cw / 2, y + 28 * s, { size: 24, align: 'center', weight: '800' });
    UI.text(ctx, trial.spec.label + ' - ' + trial.objective.text, cw / 2, y + 56 * s,
      { size: 12, align: 'center', colour: 'rgba(255,255,255,0.65)' });

    if (UI.button(ctx, 'resume', x + 20 * s, y + 76 * s, w - 40 * s, 38 * s, 'Resume')) trial.paused = false;

    /* Sound and haptics are separate switches on purpose: playing muted in
       public is exactly when the buzz earns its keep. Haptics only appears
       where the device actually has a vibration motor. */
    var half = (w - 46 * s) / 2;
    var canBuzz = V.Haptics.supported;
    if (UI.button(ctx, 'sound', x + 20 * s, y + 122 * s, canBuzz ? half : w - 40 * s, 34 * s,
      'Sound: ' + (Audio.enabled ? 'on' : 'off'), { size: 13 })) Audio.setEnabled(!Audio.enabled);
    if (canBuzz && UI.button(ctx, 'haptics', x + 26 * s + half, y + 122 * s, half, 34 * s,
      'Buzz: ' + (V.Haptics.enabled ? 'on' : 'off'), { size: 13 })) {
      V.Haptics.enabled = !V.Haptics.enabled;
      trial.game.save.haptics = V.Haptics.enabled;
      trial.game.persist();
      if (V.Haptics.enabled) V.Haptics.buzz(20);
    }
    /* The tutorial cannot be abandoned - dying there just revives you - so the
       same slot becomes a way out for anyone who already knows the game. */
    if (trial.type === 'tutorial') {
      if (UI.button(ctx, 'giveup', x + 20 * s, y + 164 * s, w - 40 * s, 34 * s, 'Skip the tutorial',
        { fill: 'rgba(70,66,96,0.9)' })) {
        trial.paused = false;
        V.Tutorial.skip(trial);
      }
    } else if (UI.button(ctx, 'giveup', x + 20 * s, y + 164 * s, w - 40 * s, 34 * s, 'Abandon trial',
      { fill: 'rgba(120,40,52,0.9)' })) {
      trial.paused = false;
      trial.player.hp = 0;
      trial.player.dead = true;
    }
    UI.text(ctx, 'Keys: WASD move, J attack, K special, L dodge, Q item',
      cw / 2, y + 216 * s, { size: 10, align: 'center', colour: 'rgba(255,255,255,0.4)' });
  };

  V.UI = UI;
  V.HUD = HUD;
})(window.V = window.V || {});
