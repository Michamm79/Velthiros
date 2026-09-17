/* Velthiros - the canvas drawing that is NOT sprite work: the primitives,
   the ground props and the gem. Every character moved to pixel art in
   sprites.js, and the vector rig they shared went with them. */
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


  Art.outline = function (ctx, w) {
    ctx.strokeStyle = 'rgba(38,30,44,0.85)';
    ctx.lineWidth = w || 2;
    ctx.stroke();
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
        var base = kind === 'snowbush' ? '#b9d3e4' : (kind === 'shrub' ? '#7f9448' : '#3d8a48');
        var mid = kind === 'snowbush' ? '#d9eaf4' : (kind === 'shrub' ? '#9db35c' : '#4fa85a');
        var top = kind === 'snowbush' ? '#f2f9fd' : (kind === 'shrub' ? '#bdd07a' : '#6cd074');
        ctx.fillStyle = 'rgba(20,26,18,0.26)';
        Art.ellipse(ctx, x, y, 22 * s, 8 * s); ctx.fill();
        /* three stacked lobes give it volume at low resolution */
        ctx.fillStyle = base;
        Art.ellipse(ctx, x, y - 9 * s, 23 * s, 15 * s); ctx.fill(); Art.outline(ctx, 2.4);
        ctx.fillStyle = mid;
        Art.ellipse(ctx, x - 7 * s, y - 16 * s, 13 * s, 11 * s); ctx.fill(); Art.outline(ctx, 2);
        Art.ellipse(ctx, x + 8 * s, y - 14 * s, 11 * s, 9 * s); ctx.fill(); Art.outline(ctx, 2);
        ctx.fillStyle = top;
        Art.ellipse(ctx, x - 6 * s, y - 20 * s, 7 * s, 5 * s); ctx.fill();
        Art.ellipse(ctx, x + 6 * s, y - 17 * s, 5 * s, 4 * s); ctx.fill();
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
      case 'tuft': {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 2.4 * s;
        for (var q = 0; q < 3; q++) {
          var qa = -Math.PI / 2 + (q - 1) * 0.5;
          ctx.beginPath();
          ctx.moveTo(x + (q - 1) * 3 * s, y);
          ctx.lineTo(x + (q - 1) * 3 * s + Math.cos(qa) * 5 * s, y + Math.sin(qa) * 7 * s);
          ctx.stroke();
        }
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
