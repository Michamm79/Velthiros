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
    'x': '#6b7480',   /* cool stone mid-dark */
    'L': '#9098ab',   /* silver hair, mid */
    'l': '#dbe1ef',   /* silver hair, the light catching the top */
    'j': '#5c6376',   /* silver hair, underside and the back of the head */
    'U': '#0f0d14',   /* boot black, the darkest value in the set */
    'y': '#8579b5',   /* purple light - the cloak had no lit tone at all */
    '0': '#e88fa0',   /* demon skin light */
    'Z': '#6f9fd8',   /* placeholder - civilian cloth lit, replaced per tint */
    'o': '#2f6f86',   /* baggy trouser, teal */
    '%': '#48a0bd',   /* baggy trouser, lit seam */
    '#': '#d8a13c',   /* sash gold */
    '@': '#8e6018',   /* sash gold, shadowed */
    '$': '#b02a37',   /* sash ribbon, crimson */
    '&': '#7e8a6e',   /* husk flesh, mid - drained grey-green */
    '*': '#4a5340',   /* husk flesh, dark */
    '-': '#b4bda2',   /* husk flesh, light */
    '(': '#e8e0d2',   /* feather shade - warm, where 'i' is cold */
    '^': '#e07a42',   /* coral growth */
    ')': '#c2b8a8',   /* feather shadow - warm, where 'i' is cold */
    '+': '#f4e8ff',   /* celestial silk, the face catching the light */
    '=': '#b79ae0',   /* celestial silk, where the ribbon turns */
    ':': '#6d54a6'    /* celestial silk, the far side of a fold */
  });

  /* Give a flat fill a lit edge and a shadow, the way the hero's hair, denim
     and skin already carry one. `ramp` maps a base key to [lit, dark]; either
     may be null where the palette has nowhere further to go. Applied once per
     sprite, just before the outline, so it shades art rather than outline. */
  function form(g, ramp) {
    var lite = {}, dark = {};
    for (var k in ramp) {
      if (ramp[k][0]) lite[k] = ramp[k][0];
      if (ramp[k][1]) dark[k] = ramp[k][1];
    }
    g.liteTop(lite).shadeBottom(dark);
    return g;
  }

  function cached(key, build) {
    if (!cache[key]) cache[key] = build();
    return cache[key];
  }

  /* =============================================================== ACTORS */

  /* The hero wears an open long-sleeve top: it covers the arms and the upper
     back and nothing else. So the front view is chest and abs, the back view
     is black across the shoulders with skin below, and the side view shows the
     shirt only as a strip down the spine. Drawn after the torso base so the
     definition lines survive. */
  function bareTorso(g, o, top, bot) {
    var belt = bot - 1;                              /* a one-row belt buys a row of abs */
    if (o.dir === 'up') {
      g.rect(o.cloth, 6, top, 6, 2);                 /* the shirt, across the shoulders */
      g.set(11, top, o.clothDark); g.set(11, top + 1, o.clothDark);
      g.rect('f', 6, top + 2, 6, belt - top - 2);    /* the small of the back, bare */
      g.rect('F', 11, top + 2, 1, belt - top - 2);
      g.rect('F', 9, top + 3, 1, belt - top - 3);    /* spine */
    } else {
      g.rect('f', 6, top, 6, belt - top);
      g.rect('F', 11, top, 1, belt - top);           /* lit from the left */
      g.set(7, top, 'F'); g.set(10, top, 'F');       /* collarbones */
      g.rect('F', 7, top + 2, 4, 1);                 /* under the pecs */
      g.rect('F', 7, top + 4, 4, 1);                 /* the ab line */
      g.set(9, top + 3, 'F');                        /* linea alba */
      g.set(9, top + 5, 'F');
      if (o.dir === 'side') g.rect(o.cloth, 6, top, 1, belt - top);  /* shirt down the spine */
      else g.set(9, top + 1, 'Y');                   /* the pendant, at the sternum */
    }
    g.rect(o.belt, 6, belt, 6, 1);
    g.set(9, belt, 'a');                             /* buckle */
  }

  /* Shared humanoid. dir: 'down' | 'up' | 'side'. frame: 0 idle, 1/2 walk.
     `bare` picks the hero's build; without it you get an ordinary clothed
     person, which is what the square crowd needs. */
  /* ------------------------------------------------------------ RIBBON
     A celestial ribbon in the Sun Wukong / feitian line: a long silk stole
     that passes over both shoulders and trails out and down on either side,
     rather than a scarf knotted at the throat.

     The whole reason it works at 18x28 is that it leaves the body's bounds -
     a ribbon that stays inside the silhouette is a collar. The grid is padded
     outward first, and the tails are walked as a wave that opens up as it
     travels: tight at the shoulder, wide and loose at the tip, drifting
     downward the whole way. It is thick near the shoulder and one pixel at the
     end, which is what makes it read as fabric rather than as a wire.

     The wave is phase-shifted per walk frame, so it undulates as you move. */
  /* One length of silk, hung from the shoulder and falling outward.

     Four passes to get here and each one failed the same way: at 18x28 a
     SYMMETRIC pair of tails reads as wings, a cape or a pair of parentheses,
     whatever curve you give it. Straight out was wings. Out-then-down was a
     cape. Adding a curl so the tips rose turned them into antennae, then into
     a pair of hooks.

     So the silhouette is asymmetric instead: one long streamer flowing off
     one shoulder, a short fall off the other, joined over the back. That is
     also how the reference reads - cloth caught mid-motion, not a matched
     set of anything.

     The path is a straight fall with a ripple laid over it, the ripple
     growing with distance from the shoulder because that is how cloth
     behaves: held at one end, loose at the other. */
  function ribbonTail(g, x0, y0, side, reach, fall, ripple, phase, o) {
    var steps = Math.max(reach, 5) * 3;
    var px = x0, py = y0;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var x = x0 + side * Math.round(t * reach);
      var y = y0 + Math.round(t * fall + Math.sin(t * Math.PI * 1.7 + phase) * ripple * (0.3 + t));
      /* Joined to the previous point rather than dotted along the curve:
         oversampling alone fills a vertical gap but not a diagonal one, and
         the tip broke off into loose pixels floating beside the shoulder. */
      g.line(o.ribbon, px, py, x, y);
      /* body near the shoulder, tapering to a single pixel at the tip */
      if (t < 0.72) g.line(o.ribbonTurn || o.ribbon, px, py + 1, x, y + 1);
      if (t < 0.34) g.line(o.ribbonDark || o.ribbonTurn || o.ribbon, px, py + 2, x, y + 2);
      px = x; py = y;
    }
  }

  function celestialRibbon(g, o, pad, bodyTop) {
    var cx = 9 + pad;
    /* frame 0 rests; 1 and 2 are the two halves of a stride. The silk lags
       behind the body, so the ripple is phase-shifted rather than redrawn. */
    var ph = o.frame === 1 ? 0.9 : (o.frame === 2 ? -0.8 : 0);

    if (o.dir === 'side') {
      /* from the side it streams BEHIND you: a stub over the near shoulder,
         and the whole length trailing back off the far one */
      g.rect(o.ribbon, cx - 2, bodyTop - 1, 6, 2);
      g.set(cx + 3, bodyTop + 1, o.ribbonTurn || o.ribbon);
      ribbonTail(g, cx - 2, bodyTop, -1, pad + 2, 13, 2.4, ph, o);
      return;
    }
    /* over both shoulders: pads either side of the neck rather than a band
       across the chest, since the sash already owns the horizontal here.
       They sit at bodyTop-1, clear of the arms which start at bodyTop+1. */
    g.rect(o.ribbon, cx - 6, bodyTop - 1, 3, 2);
    g.rect(o.ribbon, cx + 4, bodyTop - 1, 3, 2);
    if (o.dir === 'up') {
      /* from behind you also see the span across the shoulderblades */
      g.rect(o.ribbonTurn || o.ribbon, cx - 4, bodyTop - 1, 9, 1);
    }
    /* the long streamer, and the short fall on the other hip */
    ribbonTail(g, cx - 6, bodyTop, -1, pad, 15, 2.6, ph, o);
    ribbonTail(g, cx + 6, bodyTop, 1, 2, 7, 1.4, -ph, o);
  }

  function humanoidGrid(o) {
    var W = 18, H = 28;
    var g = new Px.Grid(W, H);
    var cx = 9;
    var bob = (o.frame === 1 || o.frame === 2) ? 1 : 0;
    var legTop = 20, legBot = 25;
    var bodyTop = 12 + bob, bodyBot = 19 + bob;
    var headCy = 8 + bob;
    var torsoH = bodyBot - bodyTop;

    /* ---- legs (planted; the walk lifts one at a time) ---- */
    var lx = 6, rx = 9, lTop = legTop, rTop = legTop;
    if (o.frame === 1) { lx = 5; lTop = legTop + 1; }
    if (o.frame === 2) { rx = 10; rTop = legTop + 1; }
    /* A baggy cut is a wider leg that tapers back in at the ankle - at this
       size that one extra column either side is the whole silhouette. */
    var legW = o.baggy ? 4 : 3;
    var legX = o.baggy ? 1 : 0;
    g.rect(o.trouser, lx - legX, lTop, legW, legBot - lTop);
    g.rect(o.trouser, rx, rTop, legW, legBot - rTop);
    if (o.trouserLite) {                       /* a seam of light down each leg */
      g.rect(o.trouserLite, lx - legX, lTop, 1, legBot - lTop);
      g.rect(o.trouserLite, rx, rTop, 1, legBot - rTop);
    }
    g.rect(o.boot, lx, legBot, 3, 2);
    g.rect(o.boot, rx, legBot, 3, 2);
    if (o.cuff) {                              /* trimmed boot tops */
      g.rect(o.cuff, lx, legBot, 3, 1);
      g.rect(o.cuff, rx, legBot, 3, 1);
    }

    /* ---- torso ---- */
    if (o.bare) {
      bareTorso(g, o, bodyTop, bodyBot);
    } else {
      g.rect(o.cloth, 6, bodyTop, 6, torsoH);
      g.rect(o.clothDark, 10, bodyTop + 1, 2, torsoH - 1);
      g.rect(o.belt, 6, bodyBot - 2, 6, 2);
      if (o.chest) g.rect(o.chest, 7, bodyTop + 2, 2, 3);
    }

    /* ---- arms. A long sleeve runs almost to the wrist, so only the hand
           is skin; a short one leaves the forearm bare. ---- */
    var sleeve = o.bare ? 5 : 4;
    var hand = 7 - sleeve;
    if (o.dir === 'side') {
      g.rect(o.cloth, 11, bodyTop + 1, 2, sleeve);
      g.rect('f', 11, bodyTop + 1 + sleeve, 2, hand);
    } else {
      g.rect(o.cloth, 4, bodyTop + 1, 2, sleeve);
      g.rect(o.cloth, 12, bodyTop + 1, 2, sleeve);
      g.rect('f', 4, bodyTop + 1 + sleeve, 2, hand);
      g.rect('f', 12, bodyTop + 1 + sleeve, 2, hand);
    }

    /* ---- sash, worn over everything at the waist, with a tie that trails
           down one hip. It is the loudest thing on the character, which is
           the point: it is what you see first and from furthest away. ---- */
    if (o.sash) {
      g.rect(o.sash, 5, bodyBot, 8, 2);
      if (o.sashDark) g.rect(o.sashDark, 5, bodyBot + 1, 8, 1);
      if (o.sashTie) {
        g.rect(o.sashTie, 4, bodyBot, 1, 5);
        g.set(3, bodyBot + 3, o.sashTie);
        g.set(3, bodyBot + 4, o.sashTie);
      }
    }
    /* ---- wrapped wrists ---- */
    if (o.wrap) {
      var wy = bodyTop + 1 + sleeve;
      if (o.dir === 'side') g.rect(o.wrap, 11, wy, 2, 1);
      else { g.rect(o.wrap, 4, wy, 2, 1); g.rect(o.wrap, 12, wy, 2, 1); }
    }

    /* ---- head ---- */
    g.oval('f', cx, headCy, 4, 4);
    g.rect('F', cx + 2, headCy - 1, 2, 4);          /* cheek shade */

    /* ---- hair ---- */
    if (o.dir === 'up') {
      g.oval(o.hair, cx, headCy - 1, 4, 4);
      g.rect(o.hair, cx - 4, headCy - 1, 9, 4);
      if (o.hairLite) { g.set(cx - 2, headCy - 3, o.hairLite); g.set(cx + 1, headCy - 4, o.hairLite); }
    } else {
      /* Black hair swallows a face that brown hair only frames, so the hero's
         fringe sits a row higher and shallower than everyone else's. */
      g.oval(o.hair, cx, headCy - (o.curly ? 3 : 2), 4, o.curly ? 2 : 3);
      g.rect(o.hair, cx - 4, headCy - 4, 9, 3);
      /* the sides fall away from the light, so they take the darker tone */
      var side = o.hairDark || o.hair;
      g.rect(side, cx - 4, headCy - 2, 2, o.curly ? 2 : 3);
      g.rect(side, cx + 3, headCy - 2, 2, o.curly ? 2 : 3);
      if (o.curly) {
        /* break the silhouette so it reads as curl rather than a helmet.
           Kept strictly above the eyeline - in black, anything lower closes
           the face up entirely. */
        g.set(cx - 5, headCy - 3, o.hair);
        g.set(cx + 4, headCy - 3, o.hair);
        g.set(cx - 1, headCy - 5, o.hair);
        g.set(cx + 2, headCy - 5, o.hair);
      }
      if (o.hairLite) {
        g.set(cx - 2, headCy - 4, o.hairLite);
        g.set(cx - 1, headCy - 4, o.hairLite);
        g.set(cx + 2, headCy - 3, o.hairLite);
      }
    }

    /* ---- face ---- */
    if (o.dir === 'down') {
      g.set(cx - 2, headCy + 1, 'K');
      g.set(cx + 2, headCy + 1, 'K');
    } else if (o.dir === 'side') {
      g.set(cx + 2, headCy + 1, 'K');
      g.rect(o.hairDark || o.hair, cx - 4, headCy - 2, 3, 5);   /* back of the head */
    }

    /* The ribbon hangs outside the body, so the grid grows to fit it. Drawn
       last and over the top: a stole sits ON the shoulders, and at this size
       anything drawn behind the torso is simply invisible. */
    if (o.ribbon) {
      var pad = o.ribbonReach || 7;
      g = g.pad(pad, pad, 0, 0);
      celestialRibbon(g, o, pad, bodyTop);
    }

    if (o.form) form(g, o.form);
    g.outline('K');
    return g;
  }

  /* The hero. `tint` recolours the shirt only - the shop sells sleeves, not
     tunics - so the silver hair, denim and skin stay put across every purchase. */
  Spr.player = function (dir, frame, tint, outfitId) {
    tint = tint || '#17141c';
    return cached('pl:' + dir + ':' + frame + ':' + tint + ':' + (outfitId || ''), function () {
      var o = {
        dir: dir, frame: frame, bare: true, curly: true,
        cloth: 'm', clothDark: 'B', belt: 'U', trouser: 'M', trouserLite: 'V',
        boot: 'U', hair: 'L', hairLite: 'l', hairDark: 'j'
      };
      /* An outfit overlays the default build rather than replacing it: the
         hair, the skin and the open top are who he is, the garments are what
         he is wearing. */
      var kit = outfitId && V.D.OUTFITS[outfitId];
      if (kit) for (var k in kit) o[k] = kit[k];
      return Px.bake(humanoidGrid(o), { pal: { 'm': tint, 'B': shade(tint, -18) } });
    });
  };

  /* Everybody else. Ordinary clothes, ordinary hair - the square crowd is
     meant to read as a street full of people, not a street full of heroes. */
  Spr.civilian = function (dir, frame, tint) {
    tint = tint || '#3d6fa8';
    return cached('cv:' + dir + ':' + frame + ':' + tint, function () {
      /* Trousers used to be 'B', the same key as the shirt's own shadow, and
         hair, belt and boots were all 'W' - so a civilian was two flat masses
         with no edge between them. Same fault the hero had before his rebuild:
         each material now carries its own value, and form() gives each one a
         lit lip and a shadow. */
      var g = humanoidGrid({
        dir: dir, frame: frame,
        cloth: 'm', clothDark: 'B', belt: 'W', trouser: 'R', trouserLite: 'r',
        boot: 'W', hair: 'W', chest: 'b',
        form: { 'm': ['Z', 'B'], 'R': ['r', null], 'W': ['w', null], 'f': [null, 'F'] }
      });
      return Px.bake(g, {
        pal: { 'm': tint, 'B': shade(tint, -42), 'Z': shade(tint, 34) }
      });
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

  /* Goblin. Half the size it was, which is the size it should always have been:
     at 18x26 it stood eye to eye with the player, and a thing you are meant to
     read as "one of many, individually trivial" cannot be as big as you are.

     The folklore shape is a small body under an oversized head, so at this
     scale nearly everything is spent on the head and the ears - they are the
     silhouette. The body is four columns of scrap tunic and two stubby legs;
     there is no room for detail and it does not need any, because you will
     never see one on its own. */
  Spr.goblin = function (dir, frame) {
    return cached('gb:' + dir + frame, function () {
      return Px.make(10, 14, function (g) {
        var cx = 5;
        var bob = frame ? 1 : 0;
        var legTop = 10, legBot = 12;
        var bodyTop = 7 + bob, bodyBot = 10 + bob;
        var headCy = 4 + bob;

        var lx = 3, rx = 5, lTop = legTop, rTop = legTop;
        if (frame === 1) { lTop = legTop + 1; }
        if (frame === 2) { rTop = legTop + 1; }
        g.rect('W', lx, lTop, 2, legBot - lTop);
        g.rect('W', rx, rTop, 2, legBot - rTop);
        g.rect('K', lx, legBot, 2, 1);
        g.rect('K', rx, legBot, 2, 1);

        /* hunched scrap tunic */
        g.rect('w', 3, bodyTop, 4, bodyBot - bodyTop);
        g.rect('W', 5, bodyTop + 1, 2, bodyBot - bodyTop - 1);

        /* green arms, one column each */
        g.rect('g', 2, bodyTop, 1, 3);
        g.rect('g', 7, bodyTop, 1, 3);

        /* the head is the character: oversized, with ears wider than the body */
        g.oval('h', cx, headCy, 3, 3);
        g.rect('g', cx + 1, headCy - 1, 2, 3);
        g.line('g', cx - 4, headCy - 2, cx - 3, headCy + 1);
        g.line('g', cx + 4, headCy - 2, cx + 3, headCy + 1);
        g.set(cx - 4, headCy - 2, 'h');
        g.set(cx + 4, headCy - 2, 'h');
        if (dir !== 'up') {
          g.set(cx - 1, headCy, 'X');
          g.set(cx + 1, headCy, 'X');
          g.rect('K', cx - 1, headCy + 2, 3, 1);   /* grin */
        }
        form(g, { 'g': ['h', 'G'], 'h': ['H', 'g'], 'w': ['v', 'W'], 'W': ['w', null] });
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
        form(g, { 'w': ['v', 'W'], 'v': ['d', 'w'], 'W': ['w', null], 'A': ['a', null] });
        g.outline('K');
      });
    });
  };

  /* Husk: what is left of a townsperson the arena used up. Same footprint as
     before but drawn tall and lanky - narrower body, longer limbs, taller than
     the player rather than shorter. It reads as a person stretched thin, which
     is what it is, and it sits at the opposite end of the silhouette range from
     the goblins it shares a field with. */
  Spr.husk = function (dir, frame) {
    return cached('hk:' + dir + frame, function () {
      return Px.make(14, 30, function (g) {
        var cx = 7;
        var bob = frame ? 1 : 0;
        var legTop = 18, legBot = 27;
        var bodyTop = 9 + bob, bodyBot = 18 + bob;
        var headCy = 5 + bob;

        /* long thin legs, a single column of shin each */
        var lx = 5, rx = 8, lTop = legTop, rTop = legTop;
        if (frame === 1) { lx = 4; lTop = legTop + 1; }
        if (frame === 2) { rx = 9; rTop = legTop + 1; }
        g.rect('*', lx, lTop, 2, legBot - lTop);
        g.rect('*', rx, rTop, 2, legBot - rTop);
        g.rect('K', lx - 1, legBot, 3, 2);
        g.rect('K', rx, legBot, 3, 2);

        /* narrow torso in the rags it died in - four columns, no more */
        g.rect('&', 5, bodyTop, 4, bodyBot - bodyTop);
        g.rect('*', 7, bodyTop + 1, 2, bodyBot - bodyTop - 1);
        /* ribs, cut as dark gaps with a lit edge under each */
        g.rect('*', 5, bodyTop + 2, 3, 1); g.set(5, bodyTop + 3, '-');
        g.rect('*', 5, bodyTop + 5, 3, 1); g.set(5, bodyTop + 6, '-');

        /* arms hanging past the hips - nothing is holding them up */
        g.rect('&', 3, bodyTop, 2, 11);
        g.rect('&', 9, bodyTop, 2, 11);
        g.set(3, bodyTop + 11, '*');
        g.set(10, bodyTop + 11, '*');

        /* a long neck, then a small hollow head */
        g.rect('&', cx - 1, headCy + 3, 2, 3);
        g.oval('&', cx, headCy, 3, 4);
        if (dir !== 'up') {
          g.set(cx - 2, headCy, 'K'); g.set(cx + 2, headCy, 'K');
          g.set(cx - 2, headCy - 1, 'X');
          g.rect('K', cx - 1, headCy + 3, 2, 2);   /* slack jaw */
        }
        form(g, { '&': ['-', '*'], '*': ['&', null], '-': [null, '&'] });
        g.outline('K');
      });
    });
  };

  /* Slinger: lean, braced over a loaded sling, bone mask. Rust rather than the
     olive it started in - olive put it in the goblin's colour, and two green
     humanoids at sprite size are one green humanoid. The silhouette carries it
     anyway: the levelled arm reads as "that one is pointing something at me"
     from clear across an arena, which is the only thing you need to know. */
  Spr.slinger = function (dir, frame) {
    return cached('sl:' + dir + frame, function () {
      return Px.make(22, 28, function (g) {
        var cx = 11;
        var bob = frame ? 1 : 0;
        var legTop = 19, legBot = 25;
        var bodyTop = 11 + bob, bodyBot = 19 + bob;
        var headCy = 7 + bob;

        /* braced stance: feet apart, never together - it shoots standing */
        g.rect('N', 6, legTop, 3, legBot - legTop);
        g.rect('N', 13, legTop + (frame ? 1 : 0), 3, legBot - legTop - (frame ? 1 : 0));
        g.rect('K', 5, legBot, 4, 2);
        g.rect('K', 13, legBot, 4, 2);

        /* body, with a quiver strap across it */
        g.rect('n', 7, bodyTop, 8, bodyBot - bodyTop);
        g.rect('N', 12, bodyTop + 1, 3, bodyBot - bodyTop - 1);
        g.line('K', 7, bodyTop + 1, 14, bodyTop + 6);
        g.rect('^', 8, bodyTop + 1, 2, 2);

        /* the loaded arm, held out level; the other hauls the cord back */
        g.rect('n', 15, bodyTop + 1, 5, 2);
        g.set(20, bodyTop + 1, 'O');
        g.rect('n', 4, bodyTop + 3, 3, 2);
        for (var y = bodyTop; y <= bodyTop + 4; y++) g.set(18, y, 'T');

        /* bone mask over a hood */
        g.oval('N', cx, headCy, 4, 4);
        g.oval('O', cx + 1, headCy + 1, 2, 2);
        if (dir !== 'up') { g.set(cx, headCy, 'K'); g.set(cx + 2, headCy, 'K'); }
        g.rect('K', cx - 4, headCy - 3, 8, 2);      /* hood brim */

        form(g, { 'n': ['^', 'N'], 'N': ['n', null], '^': [null, 'n'],
                  'O': [null, 'q'] });
        g.outline('K');
      });
    });
  };

  /* Ironclad: mass. Wider than it is interesting - a squat block of plate with
     the head sunk between the shoulders and no neck to aim at. Drawn broad at
     the top and narrow at the ankles so it reads as top-heavy and slow. */
  Spr.ironclad = function (dir, frame) {
    return cached('ic:' + dir + frame, function () {
      return Px.make(30, 34, function (g) {
        var cx = 15;
        var bob = frame ? 1 : 0;
        var legTop = 24, legBot = 31;
        var bodyTop = 9 + bob, bodyBot = 24 + bob;

        /* stubby legs, barely clearing the plate */
        var lx = 9, rx = 17, lTop = legTop, rTop = legTop;
        if (frame === 1) { lTop = legTop + 1; }
        if (frame === 2) { rTop = legTop + 1; }
        g.rect('E', lx, lTop, 4, legBot - lTop);
        g.rect('E', rx, rTop, 4, legBot - rTop);
        g.rect('K', lx - 1, legBot, 5, 2);
        g.rect('K', rx, legBot, 5, 2);

        /* the slab: broad pauldrons tapering to the waist */
        for (var y2 = 0; y2 < bodyBot - bodyTop; y2++) {
          var half = 9 - Math.round(y2 * 0.28);
          g.rect('A', cx - half, bodyTop + y2, half * 2 + 1, 1);
        }
        g.rect('a', cx - 7, bodyTop + 1, 4, 3);      /* lit pauldron */
        g.rect('E', cx + 3, bodyTop + 2, 5, 11);     /* shadowed side */
        /* a riveted seam down the centre line */
        for (var v = bodyTop + 3; v < bodyBot - 1; v += 3) g.set(cx, v, 'b');
        g.rect('E', cx - 8, bodyBot - 4, 17, 2);     /* waist band */

        /* arms: one hangs, one carries the weight of a maul */
        g.rect('A', cx - 12, bodyTop + 3, 3, 9);
        g.rect('A', cx + 10, bodyTop + 3, 3, 9);
        g.rect('E', cx + 10, bodyTop + 3, 3, 9);
        g.rect('K', cx + 9, bodyTop + 12, 5, 3);     /* maul head */
        g.rect('A', cx + 10, bodyTop + 13, 3, 1);

        /* helm sunk into the shoulders; a slit, not a face */
        g.oval('A', cx, bodyTop - 1, 5, 4);
        g.rect('E', cx - 4, bodyTop - 1, 9, 2);
        if (dir !== 'up') {
          g.rect('X', cx - 3, bodyTop - 1, 2, 1);
          g.rect('X', cx + 2, bodyTop - 1, 2, 1);
        }
        g.rect('b', cx - 1, bodyTop - 5, 2, 3);      /* crest */

        form(g, { 'A': ['a', 'E'], 'a': ['b', 'A'], 'E': ['A', null] });
        g.outline('K');
      });
    });
  };

  /* Shade: a tall cold smear with two lights in it. No legs - it frays out
     below the waist, so when it blinks there is nothing to watch travel.

     Drawn narrow on purpose. The first pass was a solid cone and read as a
     traffic bollard: at sprite size a wraith has to be mostly gaps, so the
     hem is eaten away column by column and the body is streaked vertically
     rather than filled. */
  Spr.shade = function (dir, frame) {
    return cached('sh:' + dir + frame, function () {
      return Px.make(20, 32, function (g) {
        var cx = 10;
        var drift = frame ? 1 : 0;
        var top = 3 + drift;

        /* Shoulders down to nothing. The hem is ragged per column: each one
           stops at its own height, so the bottom edge is torn rather than cut. */
        for (var x = -4; x <= 4; x++) {
          var a = Math.abs(x);
          if (a === 4 && frame) continue;                 /* the outermost wisps flicker */
          var colTop = top + 3 + a * 2;
          var colBot = top + 26 - a * a - ((x + (frame ? 1 : 0)) % 3) * 3;
          if (colBot <= colTop) continue;
          g.rect('C', cx + x, colTop, 1, colBot - colTop);
          /* one lit column either side of centre, so it is streaked not filled */
          if (a === 1 || a === 3) g.rect('c', cx + x, colTop + 2, 1, colBot - colTop - 4);
        }

        /* trailing arms, barely attached */
        g.line('C', cx - 4, top + 8, cx - 7, top + 15);
        g.line('C', cx + 4, top + 8, cx + 7, top + 15);
        g.set(cx - 7, top + 16, 'c');
        g.set(cx + 7, top + 16, 'c');

        /* the head is a suggestion; the eyes are not */
        g.oval('C', cx, top + 4, 3, 4);
        if (dir !== 'up') {
          g.set(cx - 2, top + 4, 'I'); g.set(cx + 2, top + 4, 'I');
          g.set(cx - 2, top + 5, 'c'); g.set(cx + 2, top + 5, 'c');
        }

        form(g, { 'C': ['c', null], 'c': ['I', 'C'] });
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

        form(g, { 'P': ['p', 'E'], 'p': ['y', null], 'O': [null, 'q'] });
        g.outline('K');
      });
    });
  };

  /* The Warden: the tutorial's optional boss. Heavier and squarer than a
     Reaper, in the same demon palette as Garatu so it reads as his creature. */
  Spr.warden = function (dir, frame) {
    return cached('wd:' + dir + frame, function () {
      return Px.make(28, 40, function (g) {
        var cx = 14;
        var bob = frame ? 1 : 0;
        var top = 4 + bob;

        /* legs, planted wide */
        g.rect('4', cx - 8, top + 26, 5, 9);
        g.rect('4', cx + 3, top + 26, 5, 9);
        g.rect('9', cx - 8, top + 33, 5, 2);
        g.rect('9', cx + 3, top + 33, 5, 2);

        /* slab torso with heavy plate */
        g.rect('5', cx - 8, top + 12, 17, 15);
        g.rect('6', cx - 7, top + 13, 6, 13);
        g.rect('4', cx + 4, top + 13, 4, 13);
        g.rect('A', cx - 8, top + 16, 17, 3);        /* chest band */
        g.rect('a', cx - 8, top + 16, 17, 1);
        g.rect('A', cx - 2, top + 12, 5, 15);        /* centre strap */

        /* pauldrons */
        g.oval('A', cx - 9, top + 13, 4, 3);
        g.oval('A', cx + 9, top + 13, 4, 3);
        g.oval('a', cx - 9, top + 12, 2, 1);
        g.oval('a', cx + 9, top + 12, 2, 1);

        /* arms */
        g.rect('6', cx - 11, top + 16, 3, 9);
        g.rect('6', cx + 9, top + 16, 3, 9);
        g.rect('7', cx - 11, top + 24, 3, 3);
        g.rect('7', cx + 9, top + 24, 3, 3);

        /* horned helm */
        g.oval('5', cx, top + 6, 5, 5);
        g.rect('4', cx + 2, top + 3, 3, 7);
        g.rect('A', cx - 6, top + 2, 13, 3);         /* brow */
        g.line('A', cx - 6, top + 2, cx - 9, top - 2);
        g.line('A', cx + 6, top + 2, cx + 9, top - 2);
        if (dir !== 'up') {
          g.set(cx - 3, top + 6, '8'); g.set(cx + 3, top + 6, '8');
          g.set(cx - 3, top + 7, 'X'); g.set(cx + 3, top + 7, 'X');
        }
        if (dir === 'side') g.rect('4', cx - 6, top + 4, 4, 6);

        form(g, { '5': ['6', '4'], '6': ['7', '5'], '4': ['5', null],
                  'A': ['a', 'E'], 'a': ['b', null], '7': ['0', '6'] });
        g.outline('K');
      });
    });
  };

  /* the training dummy is an enemy so it can be hit, but it is scenery */
  Spr.dummy = function (dir, frame) {
    return cached('dm:' + dir + frame, function () { return Spr.prop('dummy', 0); });
  };

  /* ---------------------------------------------------------------- AURELITH
     The thing at the end. Six white wings in a halo, a body so thin it is
     almost a line, and a hot core burning behind a web of ribs.

     Three passes to get the wings right, and the lesson each time was about
     shape rather than colour. Straight bars of colour read as an insect. A
     fan of one-pixel strokes sharing a root reads as a sunburst. A wide arc
     swept from a single point reads as a flower petal.

     A wing is a curved SPINE with feathers hanging off its trailing side:
     `wing` walks a leading edge outward, turning a little on every step, and
     at each step drops a run of feather perpendicular to it, tapering toward
     the tip. Bending the spine slightly harder is also what a beat is, so the
     flap comes free and pivots at the shoulder by construction - the root
     cannot move, only the accumulated turn past it. */
  function wing(g, ox, oy, a0, curve, len, depth, body, sep, edge, flap) {
    var x = ox, y = oy, a = a0;
    for (var i = 0; i < len; i++) {
      var t = i / (len - 1);
      a += curve + flap * t;            /* the bend accumulates; the root does not move */
      x += Math.cos(a);
      y += Math.sin(a);
      /* feathers hang off the trailing side, deepest at the shoulder */
      var d = Math.max(1, Math.round(depth * (1 - t * t * 0.78)));
      var pa = a - Math.PI / 2;
      var cp = Math.cos(pa), sp = Math.sin(pa);
      for (var s = 0; s <= d; s++) {
        g.set(Math.round(x + cp * s), Math.round(y + sp * s), s === d ? edge : body);
      }
      /* a separation every few steps, so it reads as feathers not as a blade */
      if (i % 5 === 3) {
        for (var s2 = Math.round(d * 0.3); s2 < d; s2++) {
          g.set(Math.round(x + cp * s2), Math.round(y + sp * s2), sep);
        }
      }
      g.set(Math.round(x), Math.round(y), edge);      /* the leading edge */
    }
  }

  Spr.aurelith = function (frame) {
    return cached('au:' + frame, function () {
      return Px.make(63, 68, function (g) {
        var cx = 31;
        var flap = frame ? 0.012 : 0;   /* extra bend per step along the spine */

        /* --- the halo, back to front. Canvas angles: y grows downward, so PI
               points out to the left and 4.71 points straight up. --- */
        /* lower pair: long, drooping, the tips almost at the floor */
        wing(g, cx - 4, 33, 2.55, -0.022, 25, 7, ')', 'i', '(', flap * 0.8);
        /* middle pair: the widest sweep, out past everything else. Started
           life flat and thin, which cut the sprite in half like a plank -
           it needs both the depth and the bend to read as a wing. */
        wing(g, cx - 5, 27, 3.58, -0.034, 26, 11, '(', ')', 'Q', flap);
        /* upper pair: rises outside the head, then curls back over it */
        wing(g, cx - 6, 26, 4.16, 0.030, 26, 7, '(', ')', 'Q', flap * 1.4);
        /* the small inner pair, folded down the front of the ribs. Behind the
           body, not over it: the torso is the one thing that must stay read. */
        wing(g, cx - 3, 24, 1.82, 0.016, 15, 4, '(', ')', 'Q', flap * 0.5);

        /* --- speckled growths ---
               Seeded, so the boss bakes identically every run. The dark
               clusters ride the upper wings; the coral spills off the
               shoulders and down the inside of the middle pair. */
        g.speckle('N', cx - 19, 9, 9, 8, 13, 7717);
        g.speckle('^', cx - 19, 28, 14, 7, 22, 3391);
        g.speckle('^', cx - 10, 34, 7, 5, 8, 5153);

        /* --- body: a dark line, barely wider than the head. Drawn over the
               inner wings, because a white creature on white wings is only
               legible if the one dark shape on it survives. --- */
        for (var y = 20; y < 50; y++) {
          var half = y < 33 ? 5 : Math.max(1, 5 - Math.round((y - 33) * 0.28));
          g.rect('U', cx - half, y, half * 2 + 1, 1);
          g.set(cx - half, y, 'P');                   /* lit along one edge */
        }

        /* the web of ribs over the chest, and the core burning behind it */
        for (var w = 0; w < 4; w++) g.line('p', cx - 4 + w * 2, 21, cx - 2 + w, 32);
        g.rect('$', cx - 2, 28, 5, 6);
        g.rect('X', cx - 1, 30, 3, 3);
        g.set(cx, 31, 'Q');
        g.set(cx - 3, 43, 'X'); g.set(cx + 3, 43, 'X');  /* sockets on the hips */

        /* --- head: narrow, pale, one eye. Drawn last so nothing buries it. */
        g.oval('I', cx, 16, 3, 6);
        g.rect('(', cx - 1, 10, 3, 5);
        g.set(cx, 15, 'X');
        g.rect('U', cx - 1, 19, 3, 3);

        /* --- legs: long, thin, splaying to points --- */
        g.line('U', cx - 2, 48, cx - 6, 62);
        g.line('U', cx - 6, 62, cx - 5, 67);
        g.line('P', cx - 3, 50, cx - 6, 61);

        /* --- the crossed mark that flanks it: laid ON the lower wing, not
               floating beside it, or at sprite size it reads as a stray glyph */
        g.line(')', cx - 19, 42, cx - 15, 46);
        g.line(')', cx - 19, 46, cx - 15, 42);

        g.mirrorX();
        form(g, { '(': ['Q', ')'], ')': ['(', 'i'], 'P': ['p', 'U'],
                  'p': [null, 'P'], 'I': ['Q', '('] });
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
        var flap = frame ? 7 : 0;

        /* One wing, then mirrored: a ribbed membrane on three fingers.

           A wing beats from the shoulder, so the root holds station and the
           tip travels furthest - `lift` is that arc, squared so the outer
           half whips. The displacement used to be (1 - span), which is the
           beat inverted: the root swung three pixels and the tip sat still,
           which reads as the wing sliding out of its socket.

           Membrane, leading edge and finger bones all take the lift at their
           own distance out. Give it to the skin alone and the bones come away
           from it halfway through the beat. */
        var lift = function (span) { return span * span * flap; };

        for (var i = 0; i < 24; i++) {
          var span = i / 23;
          /* The sweep and the lift are rounded together, not separately. Round
             each and they disagree by a pixel every few columns, and the top
             edge saws up and down instead of stepping cleanly. */
          var top = 5 + Math.round(span * 9 - lift(span));
          var h = Math.round(14 - span * 5 + Math.sin(span * Math.PI * 3) * 3);
          if (h < 3) h = 3;
          g.rect('9', cx - 9 - i, top, 1, h);
          /* Leading edge. Exactly the pixels the straight line from shoulder
             to tip used to lay down, but stepped per column so it takes the
             lift with the membrane instead of cutting across it. */
          g.set(cx - 9 - i, 6 + Math.round(i * 7 / 23 - lift(span)), '4');
        }
        for (var f = 0; f < 3; f++) {                 /* finger bones */
          var fx = cx - 12 - f * 8;
          g.line('4', fx, 8 + f * 3 - Math.round(lift((3 + f * 8) / 23)),
                 fx - 4, 20 + f * 4 - Math.round(lift((7 + f * 8) / 23)));
        }

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
        form(g, { '9': ['4', null], '5': ['6', '4'], '7': ['0', '6'],
                  '4': ['5', '9'], '6': ['7', '5'], 'O': [null, 'q'] });
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
      /* the arms were flat 'G' with no lit face; the trunk already had one */
      form(g, { 'G': ['g', 'J'] });
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

  /* ------------------------------------------------------- plaza furniture */

  function pedestal() {
    return Px.make(20, 26, function (g) {
      g.rect('R', 2, 18, 16, 6);        /* base */
      g.rect('r', 3, 19, 14, 3);
      g.rect('R', 5, 8, 10, 11);        /* column */
      g.rect('r', 6, 9, 4, 10);
      g.rect('q', 4, 5, 12, 4);         /* cap */
      g.rect('r', 5, 6, 10, 2);
      g.rect('x', 8, 12, 4, 4);         /* inset socket */
      g.outline('K');
    });
  }

  function dummyProp() {
    /* a straw torso lashed to a post - deliberately non-threatening */
    return Px.make(18, 30, function (g) {
      g.rect('W', 8, 18, 3, 11);        /* post */
      g.rect('w', 8, 18, 1, 11);
      g.rect('W', 3, 14, 13, 2);        /* crossbar */
      g.oval('T', 9, 12, 5, 6);         /* body */
      g.oval('t', 8, 11, 4, 5);
      g.oval('u', 7, 9, 2, 2);
      g.rect('W', 4, 12, 2, 5);         /* bound arms */
      g.rect('W', 13, 12, 2, 5);
      g.oval('t', 9, 4, 3, 3);          /* sack head */
      g.set(8, 4, 'K'); g.set(11, 4, 'K');
      g.rect('n', 6, 13, 7, 1);         /* target band */
      g.outline('K');
    });
  }

  function lamp() {
    return Px.make(14, 40, function (g) {
      g.rect('A', 5, 34, 5, 5);         /* footing */
      g.rect('R', 6, 10, 3, 25);        /* pole */
      g.rect('A', 6, 10, 1, 25);
      g.rect('A', 4, 6, 7, 5);          /* housing */
      g.rect('Y', 5, 7, 5, 3);          /* lit pane */
      g.rect('Q', 6, 8, 3, 1);
      g.rect('A', 4, 3, 7, 3);          /* cowl */
      g.outline('K');
    });
  }

  function bench() {
    return Px.make(26, 18, function (g) {
      g.rect('W', 3, 12, 3, 5);         /* legs */
      g.rect('W', 20, 12, 3, 5);
      g.rect('v', 2, 9, 22, 3);         /* seat */
      g.rect('w', 2, 11, 22, 1);
      g.rect('v', 2, 4, 22, 2);         /* back slats */
      g.rect('v', 2, 7, 22, 2);
      g.rect('W', 3, 4, 2, 6);
      g.rect('W', 21, 4, 2, 6);
      g.outline('K');
    });
  }

  function kiosk() {
    return Px.make(30, 32, function (g) {
      g.rect('W', 2, 12, 26, 19);       /* body */
      g.rect('w', 3, 13, 12, 17);
      g.rect('v', 4, 16, 9, 10);        /* serving window */
      g.rect('x', 5, 17, 7, 8);
      g.rect('n', 1, 7, 28, 6);         /* awning */
      g.rect('Q', 1, 7, 28, 2);
      for (var i = 0; i < 5; i++) g.rect('N', 2 + i * 6, 9, 3, 4);
      g.rect('W', 2, 29, 26, 2);
      g.outline('K');
    });
  }

  function gatePost() {
    /* half of the exit arch: two of these flank the way out */
    return Px.make(16, 40, function (g) {
      g.rect('R', 3, 8, 10, 30);
      g.rect('r', 4, 9, 4, 28);
      g.rect('q', 2, 4, 12, 5);         /* capital */
      g.rect('r', 3, 5, 10, 3);
      g.rect('P', 5, 14, 6, 12);        /* portal glow inset */
      g.rect('p', 6, 15, 4, 10);
      g.speckle('x', 4, 10, 8, 26, 12, 5);
      g.outline('K');
    });
  }

  function gemProp() {
    return Px.make(12, 16, function (g) {
      g.oval('p', 6, 8, 3, 4);
      g.rect('P', 3, 8, 6, 4);
      g.set(5, 5, 'Q'); g.set(6, 6, 'Q');
      g.rect('p', 4, 4, 4, 3);
      g.set(6, 11, 'Q');
      g.outline('K');
    });
  }

  var PROPS = {
    tree: tree, pine: pine, cactus: cactus, crate: crate, fence: fence,
    wall: wall, rock: rock, flower: flower, fern: fern, tuft: tuft,
    stone: puzzleStone, relic: relic, hint: hintGlyph,
    pedestal: pedestal, dummy: dummyProp, lamp: lamp, bench: bench,
    kiosk: kiosk, gate: gatePost, gem: gemProp
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
    desert:  { base: 's', dark: 'S', lite: 'z', pop: 'z', detail: 'S' },
    /* plaza paving, before and after the fall */
    square:  { base: 'r', dark: 'R', lite: 'q', pop: 'q', detail: 'x' },
    drained: { base: 'R', dark: 'E', lite: 'x', pop: 'x', detail: 'E' }
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
    /* empty hands: a blank sprite, so nothing is drawn and nothing branches.
       Without this, an unrecognised id falls through to the scythe below. */
    if (id === 'none') return Px.make(1, 1, function () { }, { ax: 0, ay: 0 });
    if (id === 'sword') {
      /* The starter, and the plain one on purpose: bare steel, gold furniture,
         black leather. It is the baseline the other three are read against, so
         it is the only weapon that stays bright metal end to end. */
      return Px.make(20, 9, function (g) {
        g.rect('b', 5, 3, 12, 3);          /* blade */
        g.rect('a', 5, 5, 12, 1);          /* lower edge in shadow */
        g.set(17, 4, 'b'); g.set(18, 4, 'q');
        g.rect('Y', 3, 1, 2, 7);           /* gold crossguard */
        g.set(3, 4, 'y');
        g.rect('U', 0, 3, 3, 3);           /* black leather grip */
        g.set(0, 4, 'Y');                  /* pommel */
        g.outline('K');
      }, { ax: 1, ay: 4.5 });
    }
    if (id === 'battleaxe') {
      /* Heavy and dark where the sword is bright: a black iron head that only
         catches light along the edge it cuts with, a brass collar, and a haft
         bound in leather. It used to share the sword's blade colour exactly. */
      return Px.make(24, 16, function (g) {
        g.rect('W', 0, 7, 16, 3);          /* leather-bound haft */
        g.rect('w', 0, 8, 16, 1);
        g.set(3, 7, 'U'); g.set(7, 7, 'U'); g.set(11, 7, 'U');   /* bindings */
        g.oval('A', 17, 8, 5, 6);          /* iron head */
        g.oval('E', 15, 8, 3, 5);          /* shadowed inner face */
        g.oval('b', 20, 8, 1, 4);          /* only the cutting edge is bright */
        g.rect('Y', 13, 4, 3, 9);          /* brass collar */
        g.set(14, 8, 'y');
        g.outline('K');
      }, { ax: 1, ay: 8 });
    }
    if (id === 'bow') {
      /* A strung bow from the side: the stave bows toward the target and the
         string sits on the archer's side of it. +x is forward for every weapon
         here, so the stave belongs at high x and the string behind it - drawn
         the other way round it reads as a bow held backwards. Art.drawWeapon's
         vector bow already had it this way; only this one was mirrored. */
      return Px.make(14, 20, function (g) {
        for (var y = 2; y <= 17; y++) {
          var tt = (y - 2) / 15;
          var x = 3 + Math.round(Math.sin(tt * Math.PI) * 5);
          g.set(x, y, 'W');        /* lit edge, on the face pointed downrange */
          g.set(x - 1, y, 'w');
          g.set(x - 2, y, 'v');
        }
        for (var y2 = 3; y2 <= 16; y2++) g.set(2, y2, 'q');   /* the string */
        g.set(3, 2, 'W'); g.set(3, 17, 'W');                  /* the tips */
        g.outline('K');
      }, { ax: 7, ay: 10 });
    }
    /* The scythe. It is the secret weapon and the one thing in the game you
       may never see, so it should not have been sharing a blade colour with
       the free starter sword. Black haft, and a blade that is lit from inside
       rather than reflecting anything: dark crimson body, hot along the edge
       it cuts with. */
    return Px.make(24, 20, function (g) {
      g.rect('U', 0, 12, 17, 3);           /* black haft */
      g.rect('P', 0, 13, 17, 1);           /* cold sheen along it */
      for (var i = 0; i < 11; i++) {
        var bx = 16 - Math.round(i * i * 0.06);
        g.set(bx, 12 - i, 'N');            /* blade body, dark */
        g.set(bx + 1, 12 - i, 'X');        /* the edge, burning */
      }
      g.rect('n', 9, 1, 7, 2);             /* hooked tip */
      g.set(15, 1, 'X');
      g.rect('A', 14, 10, 3, 4);           /* the collar it is socketed into */
      g.set(15, 11, 'a');
      g.outline('K');
    }, { ax: 1, ay: 13 });
  }
  Spr.weapon = function (id) { return cached('wp:' + id, function () { return weaponSprite(id); }); };

  Spr.clearCache = function () { cache = {}; };
  Spr.cacheSize = function () { return Object.keys(cache).length; };

  V.Spr = Spr;
})(window.V = window.V || {});
