/* Velthiros - the sprite sheet. Everything here is authored at pixel
   resolution against the locked palette in pixel.js, baked once and cached.
   Reference look: heavy dark outline, three-tone foliage, warm dirt. */
(function (V) {
  'use strict';

  var Px = V.Px, U = V.U;
  var Spr = {};
  var cache = {};

  Px.addColours({
    'J': '#27501d',   /* deepest foliage */
    '1': '#55632c',   /* desert scrub dark */
    '2': '#778a3d',   /* desert scrub mid */
    '3': '#9aae55',   /* desert scrub light */
    '4': '#3a1830',   /* demon shadow */
    '5': '#5c2b4a',   /* demon body */
    '6': '#8c3f61',   /* demon mid */
    '7': '#c9526a',   /* demon skin */
    '8': '#ffd24a',   /* demon eye-glow */
    '9': '#2a1024',   /* wing membrane */
    'M': '#332d40',   /* interior floor dark */
    'V': '#4a4356',   /* interior floor mid */
    'E': '#1d2430',   /* cave / HQ shadow */
    'x': '#6b7480'    /* cool stone mid-dark */
  });

  function cached(key, build) {
    if (!cache[key]) cache[key] = build();
    return cache[key];
  }

  /* =============================================================== ACTORS */

  /* Shared humanoid. dir: 'down' | 'up' | 'side'. frame: 0 idle, 1/2 walk. */
  function humanoidGrid(o) {
    var W = 18, H = 28;
    var g = new Px.Grid(W, H);
    (function (g) {
      var cx = 9;
      var bob = (o.frame === 1 || o.frame === 2) ? 1 : 0;
      var legTop = 20, legBot = 25;
      var bodyTop = 12 + bob, bodyBot = 19 + bob;
      var headCy = 8 + bob;

      /* ---- legs (planted; the walk lifts one at a time) ---- */
      var lx = 6, rx = 9, lTop = legTop, rTop = legTop;
      if (o.frame === 1) { lx = 5; lTop = legTop + 1; }
      if (o.frame === 2) { rx = 10; rTop = legTop + 1; }
      g.rect(o.trouser, lx, lTop, 3, legBot - lTop);
      g.rect(o.trouser, rx, rTop, 3, legBot - rTop);
      g.rect(o.boot, lx, legBot, 3, 2);
      g.rect(o.boot, rx, legBot, 3, 2);

      /* ---- torso ---- */
      g.rect(o.cloth, 6, bodyTop, 6, bodyBot - bodyTop);
      /* shaded right side + a belt */
      g.rect(o.clothDark, 10, bodyTop + 1, 2, bodyBot - bodyTop - 1);
      g.rect(o.belt, 6, bodyBot - 2, 6, 2);
      if (o.chest) g.rect(o.chest, 7, bodyTop + 2, 2, 3);

      /* ---- arms ---- */
      if (o.dir === 'side') {
        g.rect(o.cloth, 11, bodyTop + 1, 2, 4);
        g.rect('f', 11, bodyTop + 5, 2, 3);
      } else {
        g.rect(o.cloth, 4, bodyTop + 1, 2, 4);
        g.rect(o.cloth, 12, bodyTop + 1, 2, 4);
        g.rect('f', 4, bodyTop + 5, 2, 3);
        g.rect('f', 12, bodyTop + 5, 2, 3);
      }

      /* ---- head ---- */
      g.oval('f', cx, headCy, 4, 4);
      g.rect('F', cx + 2, headCy - 1, 2, 4);          /* cheek shade */

      /* ---- hair ---- */
      if (o.dir === 'up') {
        g.oval(o.hair, cx, headCy - 1, 4, 4);
        g.rect(o.hair, cx - 4, headCy - 1, 9, 4);
      } else {
        g.oval(o.hair, cx, headCy - 2, 4, 3);
        g.rect(o.hair, cx - 4, headCy - 4, 9, 3);
        g.rect(o.hair, cx - 4, headCy - 2, 2, 3);
        g.rect(o.hair, cx + 3, headCy - 2, 2, 3);
      }

      /* ---- face ---- */
      if (o.dir === 'down') {
        g.set(cx - 2, headCy + 1, 'K');
        g.set(cx + 2, headCy + 1, 'K');
      } else if (o.dir === 'side') {
        g.set(cx + 2, headCy + 1, 'K');
        g.rect(o.hair, cx - 4, headCy - 2, 3, 5);     /* back of the head */
      }

      g.outline('K');
    })(g);
    return g;
  }

  /* the tunic colour is a shop purchase, so bake one variant per tint */
  Spr.player = function (dir, frame, tint) {
    tint = tint || '#3d6fa8';
    return cached('pl:' + dir + ':' + frame + ':' + tint, function () {
      var g = humanoidGrid({
        dir: dir, frame: frame,
        cloth: 'm', clothDark: 'B', belt: 'W', trouser: 'B', boot: 'W',
        hair: 'W', chest: 'b'
      });
      return Px.bake(g, { pal: { 'm': tint, 'B': shade(tint, -42) } });
    });
  };

  function shade(hex, amt) {
    var c = String(hex).replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = U.clamp(parseInt(c.substr(0, 2), 16) + amt, 0, 255);
    var gg = U.clamp(parseInt(c.substr(2, 2), 16) + amt, 0, 255);
    var b = U.clamp(parseInt(c.substr(4, 2), 16) + amt, 0, 255);
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  Spr.shade = shade;

  Spr.goblin = function (dir, frame) {
    return cached('gb:' + dir + frame, function () {
      return Px.make(18, 26, function (g) {
        var cx = 9;
        var bob = frame ? 1 : 0;
        var legTop = 19, legBot = 23;
        var bodyTop = 12 + bob, bodyBot = 19 + bob;
        var headCy = 8 + bob;

        var lx = 6, rx = 9, lTop = legTop, rTop = legTop;
        if (frame === 1) { lx = 5; lTop = legTop + 1; }
        if (frame === 2) { rx = 10; rTop = legTop + 1; }
        g.rect('W', lx, lTop, 3, legBot - lTop);
        g.rect('W', rx, rTop, 3, legBot - rTop);
        g.rect('K', lx, legBot, 3, 2);
        g.rect('K', rx, legBot, 3, 2);

        /* hunched torso in a scrap tunic */
        g.rect('w', 6, bodyTop, 6, bodyBot - bodyTop);
        g.rect('W', 10, bodyTop + 1, 2, bodyBot - bodyTop - 1);

        /* green arms */
        g.rect('g', 4, bodyTop + 1, 2, 6);
        g.rect('g', 12, bodyTop + 1, 2, 6);

        /* head with big ears */
        g.oval('h', cx, headCy, 4, 4);
        g.rect('g', cx + 2, headCy - 1, 2, 4);
        g.line('g', cx - 5, headCy - 3, cx - 4, headCy + 1);
        g.line('g', cx + 5, headCy - 3, cx + 4, headCy + 1);
        g.set(cx - 5, headCy - 3, 'h');
        g.set(cx + 5, headCy - 3, 'h');
        if (dir !== 'up') {
          g.set(cx - 2, headCy, 'X');
          g.set(cx + 2, headCy, 'X');
          g.rect('K', cx - 2, headCy + 3, 5, 1);   /* grin */
        }
        g.outline('K');
      });
    });
  };

  Spr.minotaur = function (dir, frame) {
    return cached('mn:' + dir + frame, function () {
      return Px.make(26, 34, function (g) {
        var cx = 13;
        var bob = frame ? 1 : 0;
        var legTop = 25, legBot = 31;
        var bodyTop = 14 + bob, bodyBot = 25 + bob;
        var headCy = 9 + bob;

        var lx = 8, rx = 14, lTop = legTop, rTop = legTop;
        if (frame === 1) { lx = 7; lTop = legTop + 1; }
        if (frame === 2) { rx = 15; rTop = legTop + 1; }
        g.rect('W', lx, lTop, 4, legBot - lTop);
        g.rect('W', rx, rTop, 4, legBot - rTop);
        g.rect('K', lx, legBot, 4, 2);
        g.rect('K', rx, legBot, 4, 2);

        /* heavy chest */
        g.rect('w', 7, bodyTop, 12, bodyBot - bodyTop);
        g.rect('W', 15, bodyTop + 1, 4, bodyBot - bodyTop - 1);
        g.rect('v', 9, bodyTop + 2, 4, 4);
        g.rect('A', 7, bodyBot - 3, 12, 3);           /* belt plate */

        /* arms */
        g.rect('w', 4, bodyTop + 2, 3, 9);
        g.rect('w', 19, bodyTop + 2, 3, 9);
        g.rect('W', 19, bodyTop + 2, 3, 9);

        /* head + horns */
        g.oval('v', cx, headCy, 5, 4);
        g.rect('w', cx + 2, headCy - 1, 3, 4);
        g.rect('O', cx - 8, headCy - 4, 3, 2);
        g.rect('O', cx - 7, headCy - 6, 2, 3);
        g.rect('O', cx + 6, headCy - 4, 3, 2);
        g.rect('O', cx + 6, headCy - 6, 2, 3);
        g.rect('K', cx - 2, headCy + 2, 5, 2);        /* muzzle */
        g.set(cx - 1, headCy + 2, 'q');
        g.set(cx + 2, headCy + 2, 'q');
        if (dir !== 'up') {
          g.set(cx - 3, headCy - 1, 'X');
          g.set(cx + 3, headCy - 1, 'X');
        }
        g.outline('K');
      });
    });
  };

  Spr.reaper = function (dir, frame) {
    return cached('rp:' + dir + frame, function () {
      return Px.make(22, 34, function (g) {
        var cx = 11;
        var drift = frame ? 1 : 0;
        var top = 6 + drift;

        /* cloak: wide at the base, tapering into the hood */
        for (var y = 0; y < 24; y++) {
          var half = 2 + Math.round(y * 0.32);
          g.rect(y < 6 ? 'P' : 'P', cx - half, top + y, half * 2 + 1, 1);
        }
        for (var y2 = 8; y2 < 24; y2++) {
          var h2 = 2 + Math.round(y2 * 0.32);
          g.rect('p', cx - h2 + 1, top + y2, 2, 1);      /* lit left edge */
        }
        /* ragged hem */
        g.set(cx - 8, top + 24, 'P'); g.set(cx - 5, top + 24, 'P');
        g.set(cx - 1, top + 24, 'P'); g.set(cx + 3, top + 24, 'P');
        g.set(cx + 7, top + 24, 'P');

        /* hood mouth and the two lights inside it */
        g.oval('E', cx, top + 5, 3, 3);
        g.set(cx - 2, top + 5, 'X');
        g.set(cx + 2, top + 5, 'X');
        if (dir !== 'up') { g.set(cx - 2, top + 6, 'N'); g.set(cx + 2, top + 6, 'N'); }

        /* bone hands */
        g.rect('O', cx - 8, top + 12, 2, 3);
        g.rect('O', cx + 7, top + 12, 2, 3);

        g.outline('K');
      });
    });
  };

  Spr.aurelith = function (frame) {
    return cached('au:' + frame, function () {
      return Px.make(56, 60, function (g) {
        var cx = 28, flap = frame ? 1 : 0;

        /* six wings, three per side, mirrored at the end */
        for (var i = 0; i < 3; i++) {
          var yy = 14 + i * 7 - flap * i;
          var len = 22 - i * 3;
          for (var x = 0; x < len; x++) {
            var drop = Math.round(x * 0.42) + i * 2;
            g.rect(i === 0 ? 'Q' : (i === 1 ? 'I' : 'i'), cx - 6 - x, yy + drop, 1, 5 - i);
          }
        }

        /* carapace torso with a web pattern */
        g.rect('P', cx - 7, 16, 14, 22);
        g.rect('E', cx + 2, 17, 5, 20);
        for (var w = -2; w <= 2; w++) g.line('p', cx + w * 3, 16, cx + w * 2, 37);

        /* orange growths along the shoulders */
        for (var q = 0; q < 6; q++) g.rect('n', cx - 6 + q * 3, 17 + (q % 2), 2, 2);

        /* twin red sockets low on the abdomen */
        g.rect('X', cx - 4, 31, 2, 3);
        g.rect('X', cx + 3, 31, 2, 3);

        /* elongated pale head, single gem eye */
        g.oval('I', cx, 9, 4, 7);
        g.rect('X', cx - 1, 7, 3, 3);
        g.set(cx - 1, 7, 'Q');

        /* insect legs */
        g.line('P', cx - 5, 36, cx - 12, 44);
        g.line('P', cx - 12, 44, cx - 10, 50);
        g.line('P', cx + 5, 36, cx + 12, 44);
        g.line('P', cx + 12, 44, cx + 10, 50);

        g.mirrorX();
        g.outline('K');
      });
    });
  };

  /* Garatu: the abductor. Only ever seen on the title screen and in the
     opening cutscene, but he was the last thing still drawn as smooth vectors. */
  Spr.garatu = function (frame) {
    return cached('ga:' + frame, function () {
      return Px.make(58, 44, function (g) {
        var cx = 29;
        var flap = frame ? 3 : 0;

        /* one wing, then mirrored: a ribbed membrane on three fingers */
        for (var i = 0; i < 24; i++) {
          var span = i / 23;
          var top = 5 + Math.round(span * 9) - Math.round((1 - span) * flap);
          var h = Math.round(14 - span * 5 + Math.sin(span * Math.PI * 3) * 3);
          if (h < 3) h = 3;
          g.rect('9', cx - 9 - i, top, 1, h);
        }
        for (var f = 0; f < 3; f++) {                 /* finger bones */
          var fx = cx - 12 - f * 8;
          g.line('4', fx, 8 + f * 3, fx - 4, 20 + f * 4);
        }
        g.line('4', cx - 9, 6, cx - 32, 13);          /* leading edge */

        /* body */
        g.rect('5', cx - 5, 18, 10, 13);
        g.rect('4', cx + 1, 19, 4, 12);
        g.rect('6', cx - 4, 20, 3, 6);
        g.rect('4', cx - 5, 30, 10, 3);               /* belt */
        g.rect('5', cx - 4, 33, 3, 7);                /* legs */
        g.rect('5', cx + 1, 33, 3, 7);
        g.rect('4', cx - 4, 40, 3, 2);
        g.rect('4', cx + 1, 40, 3, 2);

        /* arms */
        g.rect('7', cx - 8, 20, 3, 8);
        g.rect('7', cx + 5, 20, 3, 8);

        /* head with swept horns and a lit stare */
        g.oval('7', cx, 12, 5, 5);
        g.rect('6', cx + 2, 10, 3, 5);
        g.set(cx - 2, 12, '8'); g.set(cx + 2, 12, '8');
        g.set(cx - 2, 13, 'N'); g.set(cx + 2, 13, 'N');
        g.rect('K', cx - 2, 15, 5, 1);
        g.line('O', cx - 4, 8, cx - 7, 3);
        g.line('O', cx - 5, 8, cx - 8, 4);
        g.line('O', cx + 4, 8, cx + 7, 3);
        g.line('O', cx + 5, 8, cx + 8, 4);

        g.mirrorX();
        g.outline('K');
      });
    });
  };

  /* ================================================================ PROPS */

  function tree(seed, snowy) {
    return Px.make(34, 40, function (g) {
      var cx = 17;
      g.rect('W', cx - 2, 28, 5, 10);                 /* trunk */
      g.rect('w', cx - 2, 28, 2, 10);
      /* three-lobe canopy, dark to light bottom-up */
      g.oval('J', cx, 20, 13, 9);
      g.oval('G', cx - 6, 15, 9, 7);
      g.oval('G', cx + 6, 16, 8, 6);
      g.oval('G', cx, 12, 10, 7);
      g.oval('g', cx - 5, 13, 7, 5);
      g.oval('g', cx + 5, 15, 6, 4);
      g.oval('g', cx, 17, 8, 5);
      g.oval('h', cx - 4, 11, 5, 3);
      g.oval('h', cx + 4, 13, 4, 3);
      g.speckle('h', cx - 10, 12, 20, 10, 14, seed);
      g.speckle('H', cx - 8, 9, 16, 6, 6, seed + 7);
      if (snowy) {
        g.oval('I', cx - 4, 9, 5, 2);
        g.oval('I', cx + 5, 12, 4, 2);
      }
      g.outline('K');
    });
  }

  function pine(seed) {
    return Px.make(28, 42, function (g) {
      var cx = 14;
      g.rect('W', cx - 1, 34, 3, 6);
      for (var t = 0; t < 3; t++) {
        var y = 10 + t * 8;
        var half = 4 + t * 4;
        for (var r = 0; r < 9; r++) {
          var hw = Math.round(half * (r / 9));
          g.rect(t === 2 ? 'G' : 'J', cx - hw, y + r, hw * 2 + 1, 1);
        }
        g.line('g', cx, y, cx - half + 1, y + 8);
      }
      g.oval('I', cx, 10, 3, 2);
      g.speckle('I', cx - 8, 18, 16, 12, 8, seed);
      g.outline('K');
    });
  }

  function bushSprite(kind, seed) {
    var dark = kind === 'snowbush' ? 'i' : (kind === 'shrub' ? '1' : 'J');
    var mid = kind === 'snowbush' ? 'I' : (kind === 'shrub' ? '2' : 'G');
    var lite = kind === 'snowbush' ? 'Q' : (kind === 'shrub' ? '3' : 'g');
    var pop = kind === 'snowbush' ? 'Q' : (kind === 'shrub' ? '3' : 'h');
    return Px.make(24, 20, function (g) {
      g.oval(dark, 12, 14, 10, 5);
      g.oval(mid, 8, 10, 6, 5);
      g.oval(mid, 16, 11, 5, 4);
      g.oval(mid, 12, 12, 7, 5);
      g.oval(lite, 8, 8, 4, 3);
      g.oval(lite, 15, 9, 3, 2);
      g.speckle(pop, 4, 6, 16, 8, 10, seed);
      g.outline('K');
    });
  }

  function crate() {
    return Px.make(20, 20, function (g) {
      g.rect('w', 1, 2, 18, 17);
      g.rect('W', 14, 3, 5, 16);
      g.rect('v', 2, 3, 4, 15);
      g.line('W', 1, 2, 18, 18);
      g.line('W', 18, 2, 1, 18);
      g.rect('W', 1, 2, 18, 2);
      g.rect('W', 1, 17, 18, 2);
      g.outline('K');
    });
  }

  function fence() {
    return Px.make(24, 20, function (g) {
      g.rect('w', 3, 4, 3, 15);
      g.rect('w', 18, 4, 3, 15);
      g.rect('W', 5, 4, 1, 15);
      g.rect('W', 20, 4, 1, 15);
      g.rect('v', 3, 8, 18, 3);
      g.rect('v', 3, 14, 18, 3);
      g.rect('W', 3, 10, 18, 1);
      g.rect('W', 3, 16, 18, 1);
      g.outline('K');
    });
  }

  function wall(seed) {
    return Px.make(28, 24, function (g) {
      g.rect('r', 1, 4, 26, 19);
      g.rect('R', 1, 18, 26, 5);
      g.rect('q', 1, 4, 26, 3);
      /* courses of blocks */
      g.line('R', 1, 10, 26, 10);
      g.line('R', 1, 16, 26, 16);
      g.line('R', 9, 4, 9, 10);
      g.line('R', 19, 4, 19, 10);
      g.line('R', 14, 10, 14, 16);
      g.speckle('x', 2, 5, 24, 17, 18, seed);
      g.outline('K');
    });
  }

  function cactus() {
    return Px.make(22, 32, function (g) {
      g.rect('G', 8, 4, 6, 27);
      g.rect('g', 9, 5, 2, 25);
      g.rect('G', 3, 12, 5, 4);
      g.rect('G', 3, 9, 2, 5);
      g.rect('G', 14, 16, 5, 4);
      g.rect('G', 17, 13, 2, 5);
      g.speckle('J', 8, 5, 6, 25, 10, 3);
      g.outline('K');
    });
  }

  function rock(seed) {
    return Px.make(14, 11, function (g) {
      g.oval('r', 7, 7, 5, 3);
      g.oval('q', 5, 5, 3, 2);
      g.rect('R', 8, 8, 4, 2);
      g.speckle('R', 3, 5, 8, 4, 3, seed);
      g.outline('K');
    });
  }

  function flower(seed) {
    var cols = ['n', 'Y', 'p', 'Q'];
    var col = cols[seed % cols.length];
    return Px.make(8, 10, function (g) {
      g.rect('G', 3, 5, 1, 4);
      g.set(2, 6, 'g'); g.set(5, 7, 'g');
      g.set(3, 3, col); g.set(2, 4, col); g.set(4, 4, col);
      g.set(3, 5, col); g.set(3, 4, 'Y');
      g.outline('K');
    });
  }

  function fern() {
    return Px.make(14, 12, function (g) {
      g.line('G', 7, 11, 3, 4);
      g.line('G', 7, 11, 7, 2);
      g.line('G', 7, 11, 11, 4);
      g.line('g', 7, 11, 5, 5);
      g.line('g', 7, 11, 9, 5);
      g.outline('K');
    });
  }

  function tuft(seed) {
    return Px.make(10, 8, function (g) {
      var r = U.rng(seed);
      for (var i = 0; i < 3; i++) {
        var x = 2 + i * 3;
        g.line(i === 1 ? 'h' : 'g', x, 7, x + r.int(-1, 1), 7 - r.int(2, 4));
      }
    });
  }

  function puzzleStone() {
    return Px.make(26, 24, function (g) {
      g.rect('r', 2, 4, 22, 18);
      g.rect('R', 2, 16, 22, 6);
      g.rect('q', 3, 5, 20, 3);
      g.rect('x', 8, 9, 10, 8);
      g.rect('Y', 11, 11, 4, 4);
      g.speckle('R', 3, 5, 20, 16, 12, 11);
      g.outline('K');
    });
  }

  function relic() {
    return Px.make(12, 16, function (g) {
      g.rect('Y', 4, 3, 4, 9);
      g.rect('Q', 5, 4, 1, 4);
      g.set(3, 5, 'Y'); g.set(8, 5, 'Y');
      g.set(3, 8, 'Y'); g.set(8, 8, 'Y');
      g.set(5, 2, 'Q'); g.set(6, 2, 'Q');
      g.outline('K');
    });
  }

  function hintGlyph() {
    return Px.make(12, 16, function (g) {
      g.oval('p', 6, 7, 4, 5);
      g.rect('Q', 5, 4, 3, 1);
      g.rect('Q', 7, 5, 1, 2);
      g.rect('Q', 6, 7, 2, 1);
      g.rect('Q', 6, 10, 1, 1);
      g.outline('K');
    });
  }

  var PROPS = {
    tree: tree, pine: pine, cactus: cactus, crate: crate, fence: fence,
    wall: wall, rock: rock, flower: flower, fern: fern, tuft: tuft,
    stone: puzzleStone, relic: relic, hint: hintGlyph
  };

  Spr.prop = function (kind, seed) {
    seed = (seed || 0) % 8;
    return cached('pr:' + kind + ':' + seed, function () {
      if (kind === 'bush' || kind === 'snowbush' || kind === 'shrub') return bushSprite(kind, seed + 1);
      var fn = PROPS[kind];
      if (!fn) return PROPS.rock(seed + 1);
      return fn(seed + 1);
    });
  };

  /* =============================================================== GROUND
     Each environment gets a 64x64 pattern built from sixteen 16px tiles, so
     the floor has visible variation without a per-tile draw call. */
  var GROUND = {
    plains:  { base: 'g', dark: 'G', lite: 'h', pop: 'H', detail: 'J' },
    forest:  { base: 'G', dark: 'J', lite: 'g', pop: 'h', detail: 'J' },
    snow:    { base: 'I', dark: 'i', lite: 'Q', pop: 'Q', detail: 'i' },
    village: { base: 'd', dark: 'D', lite: 'e', pop: 'e', detail: 'D' },
    hq:      { base: 'V', dark: 'M', lite: 'x', pop: 'R', detail: 'M' },
    city:    { base: 'r', dark: 'R', lite: 'q', pop: 'q', detail: 'x' },
    desert:  { base: 's', dark: 'S', lite: 'z', pop: 'z', detail: 'S' }
  };

  Spr.groundTile = function (envId) {
    return cached('gt:' + envId, function () {
      var c = GROUND[envId] || GROUND.plains;
      var size = 96;
      return Px.make(size, size, function (g) {
        g.rect(c.base, 0, 0, size, size);
        var r = U.rng(U.hash('ground:' + envId));
        /* broad mottling */
        for (var i = 0; i < 100; i++) {
          g.oval(r.chance(0.5) ? c.dark : c.lite, r.int(0, size), r.int(0, size), r.int(2, 5), r.int(1, 3));
        }
        /* fine speckle */
        for (var j = 0; j < 280; j++) g.set(r.int(0, size - 1), r.int(0, size - 1), r.chance(0.5) ? c.dark : c.pop);
        /* a few blades / cracks */
        for (var k = 0; k < 26; k++) {
          var x = r.int(1, size - 2), y = r.int(1, size - 2);
          g.line(c.detail, x, y, x + r.int(-2, 2), y - r.int(1, 3));
        }
      }, { ax: 0, ay: 0 });
    });
  };

  /* the arena floor pattern, tiled across the disc */
  Spr.groundPattern = function (ctx, envId) {
    var key = 'gp:' + envId;
    if (cache[key]) return cache[key];
    var tile = Spr.groundTile(envId);
    if (!tile.canvas || !ctx.createPattern) return null;
    cache[key] = ctx.createPattern(tile.canvas, 'repeat');
    return cache[key];
  };

  /* ============================================================== WEAPONS
     Small held sprites, drawn beside the character at its hand height. */
  function weaponSprite(id) {
    if (id === 'sword') {
      return Px.make(20, 9, function (g) {
        g.rect('b', 5, 3, 12, 3);          /* blade */
        g.rect('a', 5, 5, 12, 1);          /* lower edge in shadow */
        g.set(17, 4, 'b'); g.set(18, 4, 'q');
        g.rect('Y', 3, 1, 2, 7);           /* crossguard */
        g.rect('W', 0, 3, 3, 3);           /* grip */
        g.set(0, 4, 'Y');
        g.outline('K');
      }, { ax: 1, ay: 4.5 });
    }
    if (id === 'battleaxe') {
      return Px.make(24, 16, function (g) {
        g.rect('W', 0, 7, 16, 3);          /* haft */
        g.rect('w', 0, 8, 16, 1);
        g.oval('b', 17, 8, 5, 6);          /* head */
        g.oval('a', 16, 8, 3, 5);
        g.rect('A', 13, 4, 3, 9);
        g.outline('K');
      }, { ax: 1, ay: 8 });
    }
    if (id === 'bow') {
      return Px.make(14, 20, function (g) {
        /* a wooden arc with a thin string, not a white bar */
        for (var y = 2; y <= 17; y++) {
          var tt = (y - 2) / 15;
          var x = 10 - Math.round(Math.sin(tt * Math.PI) * 5);
          g.set(x, y, 'W');
          g.set(x + 1, y, 'w');
          g.set(x + 2, y, 'v');
        }
        for (var y2 = 3; y2 <= 16; y2++) g.set(11, y2, 'q');
        g.set(10, 2, 'W'); g.set(10, 17, 'W');
        g.outline('K');
      }, { ax: 6, ay: 10 });
    }
    /* scythe */
    return Px.make(24, 20, function (g) {
      g.rect('P', 0, 12, 17, 3);           /* shaft */
      g.rect('p', 0, 13, 17, 1);
      /* curved blade sweeping up and back from the head */
      for (var i = 0; i < 11; i++) {
        var bx = 16 - Math.round(i * i * 0.06);
        g.set(bx, 12 - i, 'b');
        g.set(bx + 1, 12 - i, 'q');
      }
      g.rect('b', 9, 1, 7, 2);
      g.rect('A', 14, 10, 3, 4);
      g.outline('K');
    }, { ax: 1, ay: 13 });
  }
  Spr.weapon = function (id) { return cached('wp:' + id, function () { return weaponSprite(id); }); };

  Spr.clearCache = function () { cache = {}; };
  Spr.cacheSize = function () { return Object.keys(cache).length; };

  V.Spr = Spr;
})(window.V = window.V || {});
