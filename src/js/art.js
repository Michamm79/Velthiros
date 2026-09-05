/* Velthiros - all drawing. Everything is procedural canvas art, no image assets.
   Look target: Minish Cap brightness, chibi (Mario-ish) proportions, 3/4 view. */
(function (V) {
  'use strict';

  var U = V.U;
  var Art = {};

  /* 3/4 perspective: the world's Y axis is squashed on screen. */
  Art.SQUASH = 0.62;

  /* ------------------------------------------------------------- primitives */
  Art.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  Art.ellipse = function (ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, U.TAU);
    ctx.closePath();
  };

  Art.shadow = function (ctx, x, y, rx, alpha) {
    ctx.fillStyle = 'rgba(20,26,18,' + (alpha == null ? 0.24 : alpha) + ')';
    Art.ellipse(ctx, x, y, rx, rx * 0.42);
    ctx.fill();
  };

  Art.shade = function (hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = U.clamp(Math.round(r + amt), 0, 255);
    g = U.clamp(Math.round(g + amt), 0, 255);
    b = U.clamp(Math.round(b + amt), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  Art.outline = function (ctx, w) {
    ctx.strokeStyle = 'rgba(38,30,44,0.85)';
    ctx.lineWidth = w || 2;
    ctx.stroke();
  };

  /* ------------------------------------------------------------ characters
     Every character is built from the same chibi rig so the cast reads as
     one family: big head, stubby limbs, heavy outline, single highlight. */
  function chibi(ctx, o) {
    var s = o.scale;
    var bob = Math.sin(o.phase) * 1.6 * s;
    var lean = o.lean || 0;
    var headR = 12 * s;
    var bodyW = 15 * s, bodyH = 14 * s;
    var footY = 0;
    var bodyY = footY - 8 * s - bodyH + bob;
    var headY = bodyY - headR * 0.75;

    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.flash) { ctx.globalAlpha = 0.9; }
    ctx.rotate(lean);

    /* legs */
    var stride = Math.sin(o.phase) * 5 * s * (o.moving ? 1 : 0);
    ctx.fillStyle = o.legs || Art.shade(o.body, -40);
    Art.roundRect(ctx, -6 * s - stride * 0.5, footY - 10 * s, 6 * s, 11 * s, 2.5 * s); ctx.fill(); Art.outline(ctx, 1.6 * s);
    Art.roundRect(ctx, 0.6 * s + stride * 0.5, footY - 10 * s, 6 * s, 11 * s, 2.5 * s); ctx.fill(); Art.outline(ctx, 1.6 * s);

    /* torso */
    ctx.fillStyle = o.body;
    Art.roundRect(ctx, -bodyW / 2, bodyY, bodyW, bodyH + 4 * s, 5 * s); ctx.fill(); Art.outline(ctx, 1.8 * s);
    /* torso highlight */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    Art.roundRect(ctx, -bodyW / 2 + 2 * s, bodyY + 2 * s, bodyW * 0.34, bodyH * 0.6, 2 * s); ctx.fill();

    /* arms */
    var armSwing = Math.sin(o.phase + Math.PI) * 4 * s * (o.moving ? 1 : 0);
    ctx.fillStyle = o.skin;
    Art.roundRect(ctx, -bodyW / 2 - 4.2 * s, bodyY + 3 * s + armSwing, 5 * s, 9 * s, 2.4 * s); ctx.fill(); Art.outline(ctx, 1.5 * s);
    if (!o.hideRightArm) {
      Art.roundRect(ctx, bodyW / 2 - 0.8 * s, bodyY + 3 * s - armSwing, 5 * s, 9 * s, 2.4 * s); ctx.fill(); Art.outline(ctx, 1.5 * s);
    }

    /* head */
    ctx.fillStyle = o.skin;
    Art.ellipse(ctx, 0, headY, headR, headR * 0.96); ctx.fill(); Art.outline(ctx, 2 * s);

    /* hair / cap */
    if (o.hair) {
      ctx.fillStyle = o.hair;
      ctx.beginPath();
      ctx.ellipse(0, headY - headR * 0.32, headR * 1.02, headR * 0.72, 0, Math.PI, U.TAU);
      ctx.closePath();
      ctx.fill(); Art.outline(ctx, 1.6 * s);
    }
    if (o.horns) {
      ctx.fillStyle = '#efe3c8';
      [-1, 1].forEach(function (sgn) {
        ctx.beginPath();
        ctx.moveTo(sgn * headR * 0.72, headY - headR * 0.25);
        ctx.quadraticCurveTo(sgn * headR * 1.5, headY - headR * 0.9, sgn * headR * 1.05, headY - headR * 1.25);
        ctx.quadraticCurveTo(sgn * headR * 1.0, headY - headR * 0.55, sgn * headR * 0.6, headY - headR * 0.35);
        ctx.closePath(); ctx.fill(); Art.outline(ctx, 1.4 * s);
      });
    }
    if (o.hood) {
      ctx.fillStyle = o.hood;
      ctx.beginPath();
      ctx.ellipse(0, headY - headR * 0.1, headR * 1.12, headR * 1.05, 0, Math.PI * 0.92, Math.PI * 2.08);
      ctx.closePath(); ctx.fill(); Art.outline(ctx, 1.8 * s);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      Art.ellipse(ctx, 0, headY + headR * 0.16, headR * 0.72, headR * 0.62); ctx.fill();
    }

    /* face - only when facing the camera-ish */
    if (!o.hood && o.faceDir !== 0) {
      var fx = o.faceDir * 2.2 * s;
      ctx.fillStyle = '#2b2231';
      Art.ellipse(ctx, fx - 4.2 * s, headY + 0.5 * s, 1.7 * s, 2.3 * s); ctx.fill();
      Art.ellipse(ctx, fx + 4.2 * s, headY + 0.5 * s, 1.7 * s, 2.3 * s); ctx.fill();
      if (o.eyeGlow) {
        ctx.fillStyle = o.eyeGlow;
        Art.ellipse(ctx, fx - 4.2 * s, headY + 0.5 * s, 1.1 * s, 1.5 * s); ctx.fill();
        Art.ellipse(ctx, fx + 4.2 * s, headY + 0.5 * s, 1.1 * s, 1.5 * s); ctx.fill();
      }
    } else if (o.hood && o.eyeGlow) {
      ctx.fillStyle = o.eyeGlow;
      Art.ellipse(ctx, -3.4 * s, headY + 1.5 * s, 1.5 * s, 1.5 * s); ctx.fill();
      Art.ellipse(ctx, 3.4 * s, headY + 1.5 * s, 1.5 * s, 1.5 * s); ctx.fill();
    }

    ctx.restore();
    return { headY: headY, bodyY: bodyY, scale: s };
  }
  Art.chibi = chibi;

  /* ------------------------------------------------------------- weapons */
  Art.drawWeapon = function (ctx, id, x, y, scale, angle, swing) {
    var s = scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (id === 'sword') {
      ctx.fillStyle = '#dfe6ee';
      Art.roundRect(ctx, 0, -2.6 * s, 27 * s, 5.2 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.8 * s);
      ctx.fillStyle = '#8a5a33';
      Art.roundRect(ctx, -7 * s, -2.4 * s, 8 * s, 4.8 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.4 * s);
      ctx.fillStyle = '#e8c14a';
      Art.roundRect(ctx, -0.5 * s, -5.5 * s, 3 * s, 11 * s, 1.4 * s); ctx.fill(); Art.outline(ctx, 1.2 * s);
    } else if (id === 'battleaxe') {
      ctx.fillStyle = '#6b4a2c';
      Art.roundRect(ctx, -8 * s, -2 * s, 30 * s, 4 * s, 1.6 * s); ctx.fill(); Art.outline(ctx, 1.5 * s);
      ctx.fillStyle = '#cfd8e2';
      ctx.beginPath();
      ctx.moveTo(15 * s, -3 * s);
      ctx.quadraticCurveTo(29 * s, -16 * s, 33 * s, 0);
      ctx.quadraticCurveTo(29 * s, 16 * s, 15 * s, 3 * s);
      ctx.closePath(); ctx.fill(); Art.outline(ctx, 1.8 * s);
    } else if (id === 'bow') {
      var br = 21 * s;
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.arc(0, 0, br, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = '#a5713d';
      ctx.lineWidth = 3.4 * s;
      ctx.beginPath();
      ctx.arc(0, 0, br, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(250,250,250,0.9)';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(br * Math.cos(-1.25), br * Math.sin(-1.25));
      ctx.lineTo(2 * s - (swing || 0) * 9 * s, 0);
      ctx.lineTo(br * Math.cos(1.25), br * Math.sin(1.25));
      ctx.stroke();
    } else if (id === 'scythe') {
      ctx.fillStyle = '#3a2f43';
      Art.roundRect(ctx, -10 * s, -2 * s, 34 * s, 3.6 * s, 1.6 * s); ctx.fill(); Art.outline(ctx, 1.5 * s);
      ctx.fillStyle = '#c9f0ea';
      ctx.beginPath();
      ctx.moveTo(22 * s, 0);
      ctx.quadraticCurveTo(40 * s, -6 * s, 34 * s, -20 * s);
      ctx.quadraticCurveTo(34 * s, -7 * s, 21 * s, -4 * s);
      ctx.closePath(); ctx.fill(); Art.outline(ctx, 1.7 * s);
    }
    ctx.restore();
  };

  /* --------------------------------------------------------------- actors */
  Art.drawPlayer = function (ctx, p, t) {
    var s = p.drawScale || 1;
    Art.shadow(ctx, p.sx, p.sy, 14 * s, p.z > 2 ? 0.14 : 0.24);
    var faceDir = Math.cos(p.facing) > 0.25 ? 1 : (Math.cos(p.facing) < -0.25 ? -1 : 0);
    var yy = p.sy - (p.z || 0);
    var flashing = p.hurtFlash > 0 && Math.floor(p.hurtFlash * 24) % 2 === 0;

    if (flashing) { ctx.save(); ctx.globalAlpha = 0.55; }

    /* weapon behind the body when swinging away from camera */
    var wpnBehind = Math.sin(p.facing) < -0.1;
    var swingT = p.attackTimer > 0 ? 1 - (p.attackTimer / Math.max(p.attackDuration, 0.01)) : 0;
    var wAngle = p.facing + (p.attacking ? U.lerp(-0.9, 1.1, swingT) : 0.5);
    var wx = p.sx + Math.cos(p.facing) * 13 * s;
    var wy = yy - 16 * s + Math.sin(p.facing) * 5 * s;

    if (wpnBehind) Art.drawWeapon(ctx, p.weaponId, wx, wy, s, wAngle, p.drawT || 0);

    chibi(ctx, {
      x: p.sx, y: yy, scale: s, phase: p.animPhase, moving: p.moving,
      body: p.tint || '#4f8fd6', skin: '#f5c9a0', hair: '#5b3d2b',
      faceDir: faceDir, legs: '#3f6ea8', lean: p.lean || 0
    });

    if (!wpnBehind) Art.drawWeapon(ctx, p.weaponId, wx, wy, s, wAngle, p.drawT || 0);

    if (flashing) ctx.restore();

    if (p.hidden) {
      ctx.fillStyle = 'rgba(120,200,140,0.28)';
      Art.ellipse(ctx, p.sx, yy - 18 * s, 22 * s, 24 * s); ctx.fill();
    }
    if (p.invuln > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(t * 22)) + ')';
      ctx.lineWidth = 2;
      Art.ellipse(ctx, p.sx, p.sy, 20 * s, 9 * s); ctx.stroke();
    }
  };

  Art.drawGoblin = function (ctx, e) {
    var s = e.drawScale;
    Art.shadow(ctx, e.sx, e.sy, 13 * s);
    var yy = e.sy - (e.z || 0);
    var faceDir = Math.cos(e.facing) > 0.25 ? 1 : (Math.cos(e.facing) < -0.25 ? -1 : 0);
    var alert = e.state === 'windup';
    if (e.hurtFlash > 0) ctx.globalAlpha = 0.6;
    chibi(ctx, {
      x: e.sx, y: yy, scale: s * 0.86, phase: e.animPhase, moving: e.moving,
      body: '#6f5236', skin: e.def.colour, legs: '#5b4229',
      faceDir: faceDir, eyeGlow: alert ? '#ffdd55' : null,
      lean: alert ? Math.sin(e.stateTime * 30) * 0.06 : 0
    });
    ctx.globalAlpha = 1;
    /* crude club */
    var wa = e.facing + (alert ? -0.9 : 0.6);
    ctx.save();
    ctx.translate(e.sx + Math.cos(e.facing) * 11 * s, yy - 17 * s);
    ctx.rotate(wa);
    ctx.fillStyle = '#6b4a2c';
    Art.roundRect(ctx, 0, -2 * s, 17 * s, 4 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.4 * s);
    ctx.restore();
  };

  Art.drawMinotaur = function (ctx, e) {
    var s = e.drawScale * 1.35;
    Art.shadow(ctx, e.sx, e.sy, 20 * s * 0.8);
    var yy = e.sy - (e.z || 0);
    var faceDir = Math.cos(e.facing) > 0.25 ? 1 : (Math.cos(e.facing) < -0.25 ? -1 : 0);
    var alert = e.state === 'windup' || e.state === 'charge';
    if (e.hurtFlash > 0) ctx.globalAlpha = 0.6;
    chibi(ctx, {
      x: e.sx, y: yy, scale: s, phase: e.animPhase, moving: e.moving,
      body: '#8a5b3a', skin: e.def.colour, legs: '#6b4227', horns: true,
      faceDir: faceDir, eyeGlow: alert ? '#ff6a3c' : null,
      lean: e.state === 'charge' ? 0.14 * Math.sign(Math.cos(e.facing) || 1) : 0
    });
    ctx.globalAlpha = 1;
    Art.drawWeapon(ctx, 'battleaxe', e.sx + Math.cos(e.facing) * 15 * s, yy - 22 * s, s * 0.8,
      e.facing + (alert ? -1.1 : 0.5), 0);
  };

  Art.drawReaper = function (ctx, e, t) {
    var s = e.drawScale * 1.45;
    Art.shadow(ctx, e.sx, e.sy, 22 * s * 0.8, 0.3);
    var yy = e.sy - (e.z || 0) - Math.sin(t * 2) * 4;
    var alert = e.state === 'windup';
    if (e.hurtFlash > 0) ctx.globalAlpha = 0.6;

    /* trailing cloak */
    ctx.fillStyle = 'rgba(30,26,44,0.9)';
    ctx.beginPath();
    ctx.moveTo(e.sx - 16 * s, yy - 20 * s);
    ctx.quadraticCurveTo(e.sx - 22 * s, yy + 6, e.sx, yy + 4);
    ctx.quadraticCurveTo(e.sx + 22 * s, yy + 6, e.sx + 16 * s, yy - 20 * s);
    ctx.closePath(); ctx.fill(); Art.outline(ctx, 2);

    chibi(ctx, {
      x: e.sx, y: yy, scale: s, phase: e.animPhase, moving: e.moving,
      body: e.def.colour, skin: '#cfc6d8', legs: e.def.dark,
      hood: '#2a2438', eyeGlow: alert ? '#ff4d5e' : '#9b6bff', faceDir: 1
    });
    ctx.globalAlpha = 1;
    Art.drawWeapon(ctx, 'scythe', e.sx + Math.cos(e.facing) * 16 * s, yy - 24 * s, s,
      e.facing + (alert ? -1.2 : 0.4), 0);
  };

  /* Final boss - the provided reference: pale winged figure, insectoid core,
     a single red eye, twin red sockets on the abdomen. */
  Art.drawAurelith = function (ctx, e, t) {
    var s = e.drawScale * 2.1;
    Art.shadow(ctx, e.sx, e.sy, 34 * s * 0.7, 0.3);
    var yy = e.sy - (e.z || 0) - 10 - Math.sin(t * 1.4) * 6;
    var flap = Math.sin(t * 1.8) * 0.16;

    /* six wings */
    for (var i = 0; i < 3; i++) {
      var spread = 0.55 + i * 0.42 + flap;
      [-1, 1].forEach(function (sgn) {
        ctx.save();
        ctx.translate(e.sx, yy - 34 * s);
        ctx.rotate(sgn * spread);
        ctx.fillStyle = i === 0 ? '#ffffff' : (i === 1 ? '#f2eef6' : '#e4dced');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sgn * 34 * s, -14 * s, sgn * 62 * s, 6 * s);
        ctx.quadraticCurveTo(sgn * 34 * s, 10 * s, 0, 8 * s);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(70,60,80,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
      });
    }

    /* carapace torso */
    ctx.fillStyle = e.def.dark;
    Art.roundRect(ctx, e.sx - 16 * s, yy - 40 * s, 32 * s, 34 * s, 10 * s); ctx.fill(); Art.outline(ctx, 2.4);
    /* web pattern */
    ctx.strokeStyle = 'rgba(220,210,230,0.32)'; ctx.lineWidth = 1.2;
    for (var w = -2; w <= 2; w++) {
      ctx.beginPath();
      ctx.moveTo(e.sx + w * 6 * s, yy - 40 * s);
      ctx.lineTo(e.sx + w * 3 * s, yy - 8 * s);
      ctx.stroke();
    }
    /* orange growths */
    ctx.fillStyle = '#ff6a33';
    for (var g = 0; g < 7; g++) {
      var ga = g / 7 * Math.PI - Math.PI / 2;
      Art.ellipse(ctx, e.sx + Math.cos(ga) * 15 * s, yy - 34 * s + Math.sin(ga) * 9 * s, 2.6 * s, 2.6 * s);
      ctx.fill();
    }
    /* twin red sockets */
    ctx.fillStyle = '#ff2f4a';
    Art.ellipse(ctx, e.sx - 7 * s, yy - 16 * s, 3.4 * s, 4.2 * s); ctx.fill();
    Art.ellipse(ctx, e.sx + 7 * s, yy - 16 * s, 3.4 * s, 4.2 * s); ctx.fill();

    /* elongated pale head with the single gem eye */
    ctx.fillStyle = e.def.colour;
    Art.ellipse(ctx, e.sx, yy - 54 * s, 9 * s, 15 * s); ctx.fill(); Art.outline(ctx, 2.2);
    ctx.fillStyle = '#ff2f4a';
    Art.ellipse(ctx, e.sx, yy - 56 * s, 3.6 * s, 3.6 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    Art.ellipse(ctx, e.sx - 1 * s, yy - 57 * s, 1.2 * s, 1.2 * s); ctx.fill();

    /* insect legs */
    ctx.strokeStyle = e.def.dark; ctx.lineWidth = 3 * s * 0.6;
    [-1, 1].forEach(function (sgn) {
      for (var l = 0; l < 2; l++) {
        ctx.beginPath();
        ctx.moveTo(e.sx + sgn * 8 * s, yy - 12 * s);
        ctx.quadraticCurveTo(e.sx + sgn * (22 + l * 8) * s, yy - 4 * s, e.sx + sgn * (14 + l * 10) * s, yy + 2);
        ctx.stroke();
      }
    });

    /* floating X blade fragments */
    ctx.strokeStyle = 'rgba(240,235,245,0.8)'; ctx.lineWidth = 2;
    for (var f = 0; f < 4; f++) {
      var fa = t * 0.6 + f * 1.57;
      var fx = e.sx + Math.cos(fa) * 40 * s, fy = yy - 14 * s + Math.sin(fa) * 10 * s;
      ctx.beginPath();
      ctx.moveTo(fx - 5, fy - 5); ctx.lineTo(fx + 5, fy + 5);
      ctx.moveTo(fx + 5, fy - 5); ctx.lineTo(fx - 5, fy + 5);
      ctx.stroke();
    }
  };

  /* Garatu - the abductor. Winged demon, seen mostly in cutscenes. */
  Art.drawGaratu = function (ctx, x, y, scale, t) {
    var s = scale;
    var flap = Math.sin(t * 3.2) * 0.4;
    ctx.save();
    ctx.translate(x, y);

    [-1, 1].forEach(function (sgn) {
      ctx.save();
      ctx.rotate(sgn * (0.5 + flap));
      ctx.fillStyle = '#43213a';
      ctx.beginPath();
      ctx.moveTo(0, -30 * s);
      ctx.quadraticCurveTo(sgn * 46 * s, -56 * s, sgn * 70 * s, -18 * s);
      ctx.quadraticCurveTo(sgn * 44 * s, -26 * s, sgn * 50 * s, -2 * s);
      ctx.quadraticCurveTo(sgn * 30 * s, -14 * s, sgn * 28 * s, 6 * s);
      ctx.quadraticCurveTo(sgn * 14 * s, -10 * s, 0, -22 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,20,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    });

    chibi(ctx, {
      x: 0, y: 0, scale: s * 1.25, phase: t * 2, moving: false,
      body: '#5c2b4a', skin: '#c9526a', legs: '#3d1c31',
      horns: true, faceDir: 1, eyeGlow: '#ffd24a'
    });
    ctx.restore();
  };

  /* ----------------------------------------------------------- environment */
  Art.drawProp = function (ctx, kind, x, y, s, seed, t) {
    var r = U.rng(seed);
    switch (kind) {
      case 'tree': {
        ctx.fillStyle = 'rgba(20,26,18,0.22)';
        Art.ellipse(ctx, x, y, 20 * s, 8 * s); ctx.fill();
        ctx.fillStyle = '#6b4a2c';
        Art.roundRect(ctx, x - 5 * s, y - 30 * s, 10 * s, 30 * s, 3 * s); ctx.fill(); Art.outline(ctx, 2);
        var lay = [[0, -58, 26], [-11, -44, 20], [11, -44, 20]];
        for (var i = 0; i < lay.length; i++) {
          ctx.fillStyle = i === 0 ? '#4f9a49' : '#3f8a3d';
          Art.ellipse(ctx, x + lay[i][0] * s, y + lay[i][1] * s, lay[i][2] * s, lay[i][2] * 0.86 * s);
          ctx.fill(); Art.outline(ctx, 2);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        Art.ellipse(ctx, x - 8 * s, y - 64 * s, 9 * s, 6 * s); ctx.fill();
        break;
      }
      case 'pine': {
        ctx.fillStyle = 'rgba(20,26,18,0.18)';
        Art.ellipse(ctx, x, y, 18 * s, 7 * s); ctx.fill();
        ctx.fillStyle = '#5b3f27';
        Art.roundRect(ctx, x - 4 * s, y - 20 * s, 8 * s, 20 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.8);
        for (var k = 0; k < 3; k++) {
          ctx.fillStyle = k === 2 ? '#3d7a4e' : '#2f6b41';
          ctx.beginPath();
          ctx.moveTo(x, y - (62 - k * 4) * s + k * 14 * s);
          ctx.lineTo(x - (20 - k * 3) * s, y - (20 - k * 2) * s + k * 12 * s);
          ctx.lineTo(x + (20 - k * 3) * s, y - (20 - k * 2) * s + k * 12 * s);
          ctx.closePath(); ctx.fill(); Art.outline(ctx, 1.8);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(x, y - 62 * s); ctx.lineTo(x - 7 * s, y - 44 * s); ctx.lineTo(x + 7 * s, y - 44 * s);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'cactus': {
        ctx.fillStyle = 'rgba(60,50,20,0.2)';
        Art.ellipse(ctx, x, y, 14 * s, 6 * s); ctx.fill();
        ctx.fillStyle = '#4f9a5e';
        Art.roundRect(ctx, x - 7 * s, y - 52 * s, 14 * s, 52 * s, 7 * s); ctx.fill(); Art.outline(ctx, 2);
        Art.roundRect(ctx, x - 20 * s, y - 40 * s, 13 * s, 9 * s, 4.5 * s); ctx.fill(); Art.outline(ctx, 2);
        Art.roundRect(ctx, x + 7 * s, y - 32 * s, 13 * s, 9 * s, 4.5 * s); ctx.fill(); Art.outline(ctx, 2);
        break;
      }
      case 'fence': {
        ctx.fillStyle = '#8a5a33';
        Art.roundRect(ctx, x - 4 * s, y - 34 * s, 8 * s, 34 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.8);
        Art.roundRect(ctx, x - 22 * s, y - 26 * s, 44 * s, 6 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.6);
        Art.roundRect(ctx, x - 22 * s, y - 14 * s, 44 * s, 6 * s, 2 * s); ctx.fill(); Art.outline(ctx, 1.6);
        break;
      }
      case 'wall': {
        ctx.fillStyle = '#5a5364';
        Art.roundRect(ctx, x - 22 * s, y - 46 * s, 44 * s, 46 * s, 4 * s); ctx.fill(); Art.outline(ctx, 2.2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        Art.roundRect(ctx, x - 18 * s, y - 42 * s, 36 * s, 12 * s, 3 * s); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 22 * s, y - 30 * s); ctx.lineTo(x + 22 * s, y - 30 * s);
        ctx.moveTo(x - 22 * s, y - 16 * s); ctx.lineTo(x + 22 * s, y - 16 * s);
        ctx.moveTo(x, y - 30 * s); ctx.lineTo(x, y - 16 * s);
        ctx.stroke();
        break;
      }
      case 'bush': case 'snowbush': case 'shrub': {
        var base = kind === 'snowbush' ? '#cfe4ef' : (kind === 'shrub' ? '#9db35c' : '#4fa85a');
        var top = kind === 'snowbush' ? '#eef7fc' : (kind === 'shrub' ? '#b3c76e' : '#63c46c');
        ctx.fillStyle = 'rgba(20,26,18,0.2)';
        Art.ellipse(ctx, x, y, 20 * s, 7 * s); ctx.fill();
        ctx.fillStyle = base;
        Art.ellipse(ctx, x, y - 12 * s, 22 * s, 16 * s); ctx.fill(); Art.outline(ctx, 2);
        ctx.fillStyle = top;
        Art.ellipse(ctx, x - 6 * s, y - 18 * s, 11 * s, 8 * s); ctx.fill();
        Art.ellipse(ctx, x + 7 * s, y - 15 * s, 8 * s, 6 * s); ctx.fill();
        break;
      }
      case 'crate': {
        ctx.fillStyle = 'rgba(20,26,18,0.2)';
        Art.ellipse(ctx, x, y, 18 * s, 6 * s); ctx.fill();
        ctx.fillStyle = '#a9793f';
        Art.roundRect(ctx, x - 17 * s, y - 30 * s, 34 * s, 30 * s, 3 * s); ctx.fill(); Art.outline(ctx, 2);
        ctx.strokeStyle = 'rgba(90,60,25,0.7)'; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - 17 * s, y - 30 * s); ctx.lineTo(x + 17 * s, y);
        ctx.moveTo(x + 17 * s, y - 30 * s); ctx.lineTo(x - 17 * s, y);
        ctx.stroke();
        break;
      }
      case 'flower': {
        var col = ['#ff8fb1', '#ffd86b', '#b58cff', '#ffffff'][seed % 4];
        ctx.fillStyle = '#3f8a3d';
        Art.roundRect(ctx, x - 0.8 * s, y - 9 * s, 1.6 * s, 9 * s, 1); ctx.fill();
        ctx.fillStyle = col;
        for (var f = 0; f < 5; f++) {
          var fa = f / 5 * U.TAU;
          Art.ellipse(ctx, x + Math.cos(fa) * 3 * s, y - 10 * s + Math.sin(fa) * 3 * s, 2.4 * s, 2.4 * s);
          ctx.fill();
        }
        ctx.fillStyle = '#ffe98a';
        Art.ellipse(ctx, x, y - 10 * s, 1.8 * s, 1.8 * s); ctx.fill();
        break;
      }
      case 'fern': {
        ctx.strokeStyle = '#3f8a3d'; ctx.lineWidth = 2 * s;
        for (var n = 0; n < 5; n++) {
          var na = -Math.PI / 2 + (n - 2) * 0.34;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + Math.cos(na) * 6 * s, y + Math.sin(na) * 10 * s,
            x + Math.cos(na) * 13 * s, y + Math.sin(na) * 16 * s);
          ctx.stroke();
        }
        break;
      }
      case 'rock': {
        ctx.fillStyle = 'rgba(20,26,18,0.16)';
        Art.ellipse(ctx, x, y, 10 * s, 4 * s); ctx.fill();
        ctx.fillStyle = '#9aa0a8';
        Art.ellipse(ctx, x, y - 5 * s, 9 * s, 7 * s); ctx.fill(); Art.outline(ctx, 1.6);
        ctx.fillStyle = 'rgba(255,255,255,0.24)';
        Art.ellipse(ctx, x - 3 * s, y - 7 * s, 3.4 * s, 2.4 * s); ctx.fill();
        break;
      }
      case 'plate': {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        Art.ellipse(ctx, x, y, 26 * s, 12 * s); ctx.fill();
        ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = 3;
        Art.ellipse(ctx, x, y, 26 * s, 12 * s); ctx.stroke();
        break;
      }
      case 'stone': {
        ctx.fillStyle = 'rgba(20,26,18,0.24)';
        Art.ellipse(ctx, x, y, 18 * s, 7 * s); ctx.fill();
        ctx.fillStyle = '#8f8aa0';
        Art.roundRect(ctx, x - 16 * s, y - 26 * s, 32 * s, 26 * s, 5 * s); ctx.fill(); Art.outline(ctx, 2.2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        Art.roundRect(ctx, x - 12 * s, y - 22 * s, 16 * s, 8 * s, 3 * s); ctx.fill();
        break;
      }
    }
  };

  /* item / objective markers */
  Art.drawRelic = function (ctx, x, y, t, colour) {
    var bob = Math.sin(t * 3) * 4;
    ctx.fillStyle = 'rgba(20,26,18,0.2)';
    Art.ellipse(ctx, x, y, 10, 4); ctx.fill();
    ctx.save();
    ctx.translate(x, y - 20 + bob);
    ctx.rotate(t * 1.2);
    ctx.fillStyle = colour || '#ffe45c';
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill(); Art.outline(ctx, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(2, -2); ctx.lineTo(-2, 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  Art.drawCoin = function (ctx, x, y, t) {
    var bob = Math.sin(t * 5) * 3;
    ctx.fillStyle = '#e8c14a';
    Art.ellipse(ctx, x, y - 8 + bob, 6 * Math.abs(Math.cos(t * 3)) + 1.5, 7); ctx.fill();
    Art.outline(ctx, 1.5);
  };

  Art.drawHintGlyph = function (ctx, x, y, t, found) {
    ctx.save();
    ctx.translate(x, y - 16 + Math.sin(t * 2.4) * 3);
    ctx.fillStyle = found ? 'rgba(150,150,160,0.5)' : '#9b6bff';
    Art.ellipse(ctx, 0, 0, 9, 11); ctx.fill(); Art.outline(ctx, 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0.5);
    ctx.restore();
  };

  Art.drawGem = function (ctx, x, y, r, gem, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t) * 0.15);
    var g = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r * 1.4);
    g.addColorStop(0, gem.glow);
    g.addColorStop(1, gem.colour);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.78, -r * 0.2); ctx.lineTo(r * 0.5, r * 0.85);
    ctx.lineTo(-r * 0.5, r * 0.85); ctx.lineTo(-r * 0.78, -r * 0.2);
    ctx.closePath(); ctx.fill(); Art.outline(ctx, 2.4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.72); ctx.lineTo(r * 0.16, -r * 0.3); ctx.lineTo(-r * 0.3, r * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  V.Art = Art;
})(window.V = window.V || {});
