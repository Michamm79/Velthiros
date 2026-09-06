/* Velthiros - pixel-art core.
   Sprites are authored at pixel resolution against a locked palette, baked once
   into offscreen canvases, and blitted at integer scale so every sprite pixel
   lands on exactly one buffer pixel. */
(function (V) {
  'use strict';

  var U = V.U;
  var Px = {};

  /* ------------------------------------------------------------- palette
     Pulled from the reference: heavy near-black outlines, three-tone foliage,
     warm dirt, straw, cool stone. One key per colour, one colour per key. */
  Px.PALETTE = {
    '.': null,                  /* transparent */
    'K': '#241c2b',             /* outline */
    'k': '#3b3145',             /* soft shadow line */

    'G': '#356428',             /* grass dark */
    'g': '#54903a',             /* grass mid */
    'h': '#7ab84f',             /* grass light */
    'H': '#a3d570',             /* grass hilite */

    'D': '#8f6a41',             /* dirt dark */
    'd': '#bd975f',             /* dirt mid */
    'e': '#dcc08d',             /* dirt light */

    'S': '#c2a061',             /* sand dark */
    's': '#dcbe83',             /* sand mid */
    'z': '#f0dcae',             /* sand light */

    'W': '#5e3a24',             /* wood dark */
    'w': '#8a5a33',             /* wood mid */
    'v': '#ad7a4c',             /* wood light */

    'T': '#b09a5c',             /* straw dark */
    't': '#d8c188',             /* straw mid */
    'u': '#efe0ab',             /* straw light */

    'R': '#5f6670',             /* stone dark */
    'r': '#8b939c',             /* stone mid */
    'q': '#bcc3ca',             /* stone light */

    'A': '#5a6673',             /* metal dark */
    'a': '#95a1ae',             /* metal mid */
    'b': '#d8e0e8',             /* metal light */

    'F': '#cf9668',             /* skin shade */
    'f': '#f0c191',             /* skin */

    'N': '#8c2f28',             /* red dark */
    'n': '#c34a3c',             /* red */
    'B': '#2a4e77',             /* blue dark */
    'm': '#3d6fa8',             /* blue */
    'P': '#2e2842',             /* purple dark */
    'p': '#584c78',             /* purple mid */

    'O': '#efe3c8',             /* bone */
    'X': '#ff4d5e',             /* glow red */
    'Y': '#e8c14a',             /* gold */
    'I': '#eef6fb',             /* snow */
    'i': '#c3d9e8',             /* snow shade */
    'C': '#2a6f92',             /* water dark */
    'c': '#4aa8c8',             /* water mid */
    'Q': '#ffffff'
  };

  /* -------------------------------------------------------------- grid */
  function Grid(w, h) {
    this.w = w; this.h = h;
    this.d = new Array(w * h);
    for (var i = 0; i < this.d.length; i++) this.d[i] = '.';
  }
  Px.Grid = Grid;

  Grid.prototype.set = function (x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = c;
    return this;
  };
  Grid.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.d[y * this.w + x];
  };
  Grid.prototype.rect = function (c, x, y, w, h) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  };
  /* filled ellipse, inclusive of the radii */
  Grid.prototype.oval = function (c, cx, cy, rx, ry) {
    for (var y = -ry; y <= ry; y++) {
      for (var x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx + 0.0001) + (y * y) / (ry * ry + 0.0001) <= 1.05) {
          this.set(cx + x, cy + y, c);
        }
      }
    }
    return this;
  };
  Grid.prototype.line = function (c, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return this;
  };
  /* scatter, seeded so a sprite bakes identically every time */
  Grid.prototype.speckle = function (c, x, y, w, h, n, seed) {
    var r = U.rng(seed || 1);
    for (var i = 0; i < n; i++) this.set(x + r.int(0, w - 1), y + r.int(0, h - 1), c);
    return this;
  };
  /* copy the left half onto the right, so symmetric sprites are authored once */
  Grid.prototype.mirrorX = function () {
    var mid = Math.floor(this.w / 2);
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < mid; x++) {
        this.set(this.w - 1 - x, y, this.get(x, y));
      }
    }
    return this;
  };
  /* the look of the reference: one hard dark pixel around the whole silhouette */
  Grid.prototype.outline = function (c) {
    var add = [];
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        if (this.get(x - 1, y) !== '.' || this.get(x + 1, y) !== '.' ||
            this.get(x, y - 1) !== '.' || this.get(x, y + 1) !== '.') {
          add.push(x, y);
        }
      }
    }
    for (var i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c || 'K');
    return this;
  };
  /* darken the lower-right lip of a shape - cheap, readable form */
  Grid.prototype.shadeBottom = function (map) {
    for (var y = this.h - 1; y >= 0; y--) {
      for (var x = 0; x < this.w; x++) {
        var here = this.get(x, y);
        if (here === '.' || !map[here]) continue;
        if (this.get(x, y + 1) === '.' || this.get(x + 1, y) === '.') this.set(x, y, map[here]);
      }
    }
    return this;
  };

  /* ------------------------------------------------------------- baking
     Anchor defaults to bottom-centre, which is where a sprite meets the ground. */
  Px.bake = function (grid, opts) {
    opts = opts || {};
    var pal = Px.PALETTE;
    if (opts.pal) {
      pal = {};
      for (var k in Px.PALETTE) pal[k] = Px.PALETTE[k];
      for (var k2 in opts.pal) pal[k2] = opts.pal[k2];
    }
    var spr = { w: grid.w, h: grid.h, ax: opts.ax != null ? opts.ax : grid.w / 2,
                ay: opts.ay != null ? opts.ay : grid.h, grid: grid };

    if (typeof document === 'undefined') return spr;   /* headless safety */

    var cv = document.createElement('canvas');
    cv.width = grid.w; cv.height = grid.h;
    var c = cv.getContext('2d');
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) {
        var key = grid.get(x, y);
        if (key === '.') continue;
        var col = pal[key];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    }
    spr.canvas = cv;
    return spr;
  };

  /* author a sprite: Px.make(w, h, function (g) { ... }) */
  Px.make = function (w, h, fn, opts) {
    var g = new Grid(w, h);
    fn(g);
    return Px.bake(g, opts);
  };

  /* extra palette entries, registered by the sprite sheet */
  Px.addColours = function (map) {
    for (var k in map) Px.PALETTE[k] = map[k];
  };

  /* --------------------------------------------------------------- draw */
  Px.draw = function (ctx, spr, x, y, opts) {
    if (!spr || !spr.canvas) return;
    opts = opts || {};
    var sc = opts.scale || 1;
    var dx = Math.round(x - spr.ax * sc);
    var dy = Math.round(y - spr.ay * sc);
    /* nearest-neighbour always: sprites stay crisp even when drawn straight
       onto the full-resolution canvas at an integer scale */
    ctx.imageSmoothingEnabled = false;
    if (!opts.flip && opts.alpha == null && !opts.rot) {
      ctx.drawImage(spr.canvas, dx, dy, spr.w * sc, spr.h * sc);
      return;
    }
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (opts.flip) ctx.scale(-1, 1);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.drawImage(spr.canvas, Math.round(-spr.ax * sc), Math.round(-spr.ay * sc),
      spr.w * sc, spr.h * sc);
    ctx.restore();
  };

  /* a soft ground shadow, drawn in buffer pixels */
  Px.shadow = function (ctx, x, y, rx, alpha) {
    ctx.fillStyle = 'rgba(20,16,26,' + (alpha == null ? 0.28 : alpha) + ')';
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), rx, Math.max(1, rx * 0.45), 0, 0, U.TAU);
    ctx.fill();
  };

  /* every sprite must be rectangular and use only known palette keys */
  Px.validate = function (spr, name) {
    var g = spr.grid, bad = [];
    if (!g) return bad;
    for (var i = 0; i < g.d.length; i++) {
      var k = g.d[i];
      if (k !== '.' && !(k in Px.PALETTE)) bad.push(name + ': unknown palette key "' + k + '"');
    }
    if (g.d.length !== g.w * g.h) bad.push(name + ': grid size mismatch');
    return bad;
  };

  V.Px = Px;
})(window.V = window.V || {});
