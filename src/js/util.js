/* Velthiros - shared math, rng and helpers */
(function (V) {
  'use strict';

  var U = {};

  U.TAU = Math.PI * 2;

  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

  /* shortest signed angular difference b - a, wrapped to [-PI, PI] */
  U.angleDelta = function (a, b) {
    var d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return d;
  };

  U.approach = function (v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return target;
  };

  U.easeOut = function (t) { return 1 - (1 - t) * (1 - t); };
  U.easeIn = function (t) { return t * t; };
  U.easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  /* Mulberry32 - small deterministic PRNG so a trial seed rebuilds the same arena */
  U.rng = function (seed) {
    var a = seed >>> 0;
    var r = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = function (lo, hi) { return lo + r() * (hi - lo); };
    r.int = function (lo, hi) { return Math.floor(lo + r() * (hi - lo + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.chance = function (p) { return r() < p; };
    r.shuffle = function (arr) {
      var out = arr.slice();
      for (var i = out.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1));
        var t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    };
    return r;
  };

  /* string -> 32 bit hash, used to derive stable seeds from names */
  U.hash = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.fmtTime = function (sec) {
    if (sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  U.fmtNum = function (n) {
    n = Math.floor(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /* point inside a circle */
  U.inCircle = function (px, py, cx, cy, r) { return U.dist2(px, py, cx, cy) <= r * r; };

  /* push a point back inside a circular boundary, returns true if it moved */
  U.confineToCircle = function (p, cx, cy, r) {
    var dx = p.x - cx, dy = p.y - cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r) return false;
    if (d === 0) { p.x = cx + r; return true; }
    p.x = cx + (dx / d) * r;
    p.y = cy + (dy / d) * r;
    return true;
  };

  /* is target inside a cone centred on `facing`? */
  U.inArc = function (ax, ay, facing, halfArc, range, tx, ty) {
    var dx = tx - ax, dy = ty - ay;
    var d2 = dx * dx + dy * dy;
    if (d2 > range * range) return false;
    if (d2 < 1) return true;
    var a = Math.atan2(dy, dx);
    return Math.abs(U.angleDelta(facing, a)) <= halfArc;
  };

  U.roman = function (n) {
    var map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return map[n] || String(n);
  };

  V.U = U;
})(window.V = window.V || {});
