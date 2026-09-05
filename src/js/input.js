/* Velthiros - touch / mouse / keyboard input, virtual joystick and button zones */
(function (V) {
  'use strict';

  var U = V.U;

  var Input = {
    /* movement vector, magnitude 0..1 */
    move: { x: 0, y: 0, mag: 0 },
    stick: { active: false, ox: 0, oy: 0, x: 0, y: 0, id: null },
    zones: [],            /* collected during the current frame's render */
    activeZones: [],      /* the previous frame's zones - what a tap hits */
    down: {},             /* zone id -> true while held */
    pressed: {},          /* zone id -> true for one frame */
    released: {},
    taps: [],             /* {x,y} taps that hit no zone - used by menus */
    lastZones: [],
    keys: {},
    keyPressed: {},
    anyInput: false,      /* true on any frame with a fresh interaction */
    lastActivity: 0,
    canvas: null,
    scale: 1
  };

  var pointers = {};      /* pointerId -> { zone, x, y } */

  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Space: 'attack', KeyJ: 'attack', Enter: 'confirm',
    KeyK: 'special', KeyL: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
    Escape: 'back', KeyE: 'interact', KeyQ: 'item'
  };

  Input.init = function (canvas) {
    Input.canvas = canvas;
    var opts = { passive: false };

    canvas.addEventListener('pointerdown', onDown, opts);
    canvas.addEventListener('pointermove', onMove, opts);
    canvas.addEventListener('pointerup', onUp, opts);
    canvas.addEventListener('pointercancel', onUp, opts);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, opts);

    window.addEventListener('keydown', function (e) {
      var k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (!Input.keys[k]) Input.keyPressed[k] = true;
      Input.keys[k] = true;
      Input.markActivity();
    });
    window.addEventListener('keyup', function (e) {
      var k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      Input.keys[k] = false;
    });
    window.addEventListener('blur', function () {
      Input.keys = {};
      pointers = {};
      Input.down = {};
      Input.stick.active = false;
      Input.stick.id = null;
    });
  };

  Input.markActivity = function () {
    Input.anyInput = true;
    Input.lastActivity = performance.now();
  };

  function localPos(e) {
    var r = Input.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
  }

  function hitZone(x, y) {
    /* Pointer events arrive between frames, so hit-test the zones the last
       rendered frame registered - `zones` is empty at that moment. */
    var zs = Input.activeZones;
    for (var i = zs.length - 1; i >= 0; i--) {
      var z = zs[i];
      if (z.r != null) {
        if (U.dist2(x, y, z.x, z.y) <= z.r * z.r) return z;
      } else if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
        return z;
      }
    }
    return null;
  }

  function onDown(e) {
    Input.canvas.setPointerCapture && Input.canvas.setPointerCapture(e.pointerId);
    var p = localPos(e);
    Input.markActivity();

    var z = hitZone(p.x, p.y);
    if (z) {
      pointers[e.pointerId] = { zone: z.id, x: p.x, y: p.y };
      if (!Input.down[z.id]) Input.pressed[z.id] = true;
      Input.down[z.id] = true;
      return;
    }

    /* left third of the screen (and not on a zone) drives the floating stick */
    if (Input.stickEnabled && p.x < Input.canvas.clientWidth * 0.5 && !Input.stick.active) {
      Input.stick.active = true;
      Input.stick.id = e.pointerId;
      Input.stick.ox = p.x; Input.stick.oy = p.y;
      Input.stick.x = p.x; Input.stick.y = p.y;
      pointers[e.pointerId] = { zone: '__stick', x: p.x, y: p.y };
      return;
    }

    pointers[e.pointerId] = { zone: null, x: p.x, y: p.y };
    Input.taps.push({ x: p.x, y: p.y });
  }

  function onMove(e) {
    var rec = pointers[e.pointerId];
    if (!rec) return;
    var p = localPos(e);
    rec.x = p.x; rec.y = p.y;
    if (rec.zone === '__stick') {
      Input.stick.x = p.x; Input.stick.y = p.y;
      Input.markActivity();
    }
  }

  function onUp(e) {
    var rec = pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (!rec) return;
    if (rec.zone === '__stick') {
      Input.stick.active = false;
      Input.stick.id = null;
      return;
    }
    if (rec.zone) {
      /* only clear if no other pointer holds the same zone */
      var stillHeld = false;
      for (var id in pointers) if (pointers[id].zone === rec.zone) stillHeld = true;
      if (!stillHeld) {
        Input.down[rec.zone] = false;
        Input.released[rec.zone] = true;
      }
    }
  }

  Input.stickEnabled = false;
  var STICK_RADIUS = 62;

  /* called once per frame, after scenes have read last frame's state */
  Input.update = function () {
    var mx = 0, my = 0;

    if (Input.stick.active) {
      var dx = Input.stick.x - Input.stick.ox;
      var dy = Input.stick.y - Input.stick.oy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) {
        var mag = Math.min(d / STICK_RADIUS, 1);
        mx = (dx / d) * mag;
        my = (dy / d) * mag;
      }
    }

    /* keyboard fallback */
    var kx = (Input.keys.right ? 1 : 0) - (Input.keys.left ? 1 : 0);
    var ky = (Input.keys.down ? 1 : 0) - (Input.keys.up ? 1 : 0);
    if (kx || ky) {
      var kd = Math.sqrt(kx * kx + ky * ky);
      mx = kx / kd; my = ky / kd;
    }

    Input.move.x = mx;
    Input.move.y = my;
    Input.move.mag = Math.min(Math.sqrt(mx * mx + my * my), 1);
    if (Input.move.mag > 0.15) Input.markActivity();

    /* fold keyboard action keys into the button maps */
    ['attack', 'special', 'dodge', 'confirm', 'back', 'interact', 'item'].forEach(function (k) {
      if (Input.keyPressed[k]) Input.pressed[k] = true;
      if (Input.keys[k]) Input.down[k] = true;
      else if (!heldByPointer(k)) Input.down[k] = false;
    });
  };

  function heldByPointer(zoneId) {
    for (var id in pointers) if (pointers[id].zone === zoneId) return true;
    return false;
  }

  /* called at the very end of a frame */
  Input.endFrame = function () {
    Input.activeZones = Input.zones;
    Input.lastZones = Input.zones;   /* kept for automated tests / debugging */
    Input.pressed = {};
    Input.released = {};
    Input.keyPressed = {};
    Input.taps.length = 0;
    Input.anyInput = false;
    Input.zones = [];
  };

  Input.zone = function (id, x, y, w, h) {
    Input.zones.push({ id: id, x: x, y: y, w: w, h: h });
  };
  Input.circleZone = function (id, x, y, r) {
    Input.zones.push({ id: id, x: x, y: y, r: r });
  };

  Input.isDown = function (id) { return !!Input.down[id]; };
  Input.wasPressed = function (id) { return !!Input.pressed[id]; };
  Input.stickRadius = STICK_RADIUS;

  V.Input = Input;
})(window.V = window.V || {});
