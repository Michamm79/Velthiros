/* Velthiros - shared UI widgets and the trial HUD (GDD 12) */
(function (V) {
  'use strict';

  var U = V.U, D = V.D, Art = V.Art, Input = V.Input, Audio = V.Audio;
  var UI = {};

  UI.FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  UI.scale = 1;

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
    ctx.globalAlpha = 1;

    /* ---- top-left: health + stamina (GDD 12) ---- */
    var barW = Math.min(150 * s, cw * 0.34);
    UI.bar(ctx, pad, pad + 4, barW, 11 * s, p.hp / p.stats.maxHp, '#ff5f6d');
    UI.bar(ctx, pad, pad + 22 * s, barW * 0.86, 8 * s, p.stamina / p.stats.maxStamina, '#7fe08a');
    UI.text(ctx, Math.ceil(p.hp) + '/' + p.stats.maxHp, pad + barW + 8, pad + 9 * s, { size: 11, colour: 'rgba(255,255,255,0.9)' });

    /* ---- top-middle: timer ---- */
    var warn = trial.timeLeft < 15;
    UI.text(ctx, U.fmtTime(trial.timeLeft), cw / 2, pad + 12 * s, {
      size: 26, align: 'center', weight: '800', colour: warn ? '#ff8a8a' : '#fff'
    });

    /* ---- top-right: trial label + objective progress ---- */
    UI.text(ctx, trial.spec.label, cw - pad, pad + 6 * s, { size: 13, align: 'right', colour: 'rgba(255,255,255,0.85)' });
    UI.text(ctx, HUD.progressText(trial), cw - pad, pad + 24 * s, { size: 13, align: 'right', colour: '#ffe45c' });

    /* ---- pause ---- */
    if (UI.button(ctx, 'pause', cw - pad - 34 * s, pad + 38 * s, 34 * s, 26 * s, '| |', { size: 13 })) {
      trial.paused = !trial.paused;
    }

    /* ---- objective banner ---- */
    if (trial.t < 6 || trial.message) {
      var txt = trial.message || trial.objective.text;
      UI.font(ctx, 14);
      var tw = ctx.measureText(txt).width + 26 * s;
      var bx = cw / 2 - tw / 2, by = pad + 34 * s;
      UI.panel(ctx, bx, by, tw, 26 * s, { fill: 'rgba(20,16,28,0.7)' });
      UI.text(ctx, txt, cw / 2, by + 13 * s, { size: 14, align: 'center' });
    }

    /* ---- hide-trial spotted warning ---- */
    if (trial.type === 'hide' && trial.spotted) {
      UI.text(ctx, 'SPOTTED', cw / 2, ch * 0.24, { size: 30, align: 'center', weight: '800', colour: '#ff5f6d' });
    }
    if (p.hidden) {
      UI.text(ctx, 'hidden', cw / 2, ch * 0.24, { size: 16, align: 'center', colour: 'rgba(160,240,180,0.9)' });
    }

    /* ---- bottom-left: virtual joystick ---- */
    Input.stickEnabled = !trial.paused && trial.state === 'play';
    HUD.drawStick(ctx, cw, ch, s);

    /* ---- bottom-right: action buttons ---- */
    var live = trial.state === 'play' && !trial.paused && !p.dead;
    var aR = 44 * s, sR = 31 * s, dR = 26 * s;
    var ax = cw - pad - aR - 6 * s, ay = ch - pad - aR - 6 * s;
    if (UI.roundButton(ctx, 'attack', ax, ay, aR, 'ATK', { disabled: !live, size: 16 }) && live) p.tryAttack(false);

    var sx = ax - aR - sR + 6 * s, sy = ay - 12 * s;
    var wpn = D.WEAPONS[p.weaponId];
    if (UI.roundButton(ctx, 'special', sx, sy, sR, wpn.special.name, {
      disabled: !live, size: 11, cooldown: p.specialCd, cooldownMax: wpn.special.cooldown
    }) && live) p.tryAttack(true);

    var dx = ax - 6 * s, dy = ay - aR - dR - 4 * s;
    if (UI.roundButton(ctx, 'dodge', dx, dy, dR, 'DODGE', {
      disabled: !live, size: 9, cooldown: p.dodgeCd, cooldownMax: 0.85 * p.stats.dodgeCdMul
    }) && live) p.tryDodge();

    var items = trial.consumables.potion + trial.consumables.tonic + trial.consumables.smoke;
    var ix = sx - sR - dR + 2 * s, iy = sy - 6 * s;
    if (UI.roundButton(ctx, 'item', ix, iy, dR, 'ITEM ' + items, {
      disabled: !live || items <= 0, size: 9
    }) && live) trial.useConsumable();

    /* ---- riddle panel ---- */
    if (trial.riddle && !trial.riddle.answered) HUD.drawRiddle(ctx, trial, cw, ch, s);

    /* ---- pause menu ---- */
    if (trial.paused) HUD.drawPause(ctx, trial, cw, ch, s);

    /* ---- intro card ---- */
    if (trial.state === 'intro') HUD.drawIntro(ctx, trial, cw, ch, s);
  };

  HUD.progressText = function (trial) {
    switch (trial.type) {
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
    if (UI.button(ctx, 'sound', x + 20 * s, y + 122 * s, w - 40 * s, 34 * s,
      'Sound: ' + (Audio.enabled ? 'on' : 'off'))) Audio.setEnabled(!Audio.enabled);
    if (UI.button(ctx, 'giveup', x + 20 * s, y + 164 * s, w - 40 * s, 34 * s, 'Abandon trial',
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
