/* Velthiros - procedural WebAudio SFX and a small ambient bed (no asset files) */
(function (V) {
  'use strict';

  var Audio = { enabled: true, ready: false, ctx: null, master: null, musicGain: null, sfxGain: null };
  var musicTimer = null;
  var musicStep = 0;
  var currentMood = null;

  Audio.init = function () {
    if (Audio.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { Audio.enabled = false; return; }
    try {
      Audio.ctx = new AC();
      Audio.master = Audio.ctx.createGain();
      Audio.master.gain.value = 0.6;
      Audio.master.connect(Audio.ctx.destination);
      Audio.sfxGain = Audio.ctx.createGain();
      Audio.sfxGain.gain.value = 0.85;
      Audio.sfxGain.connect(Audio.master);
      Audio.musicGain = Audio.ctx.createGain();
      Audio.musicGain.gain.value = 0.32;
      Audio.musicGain.connect(Audio.master);
      Audio.ready = true;
    } catch (e) { Audio.enabled = false; }
  };

  /* browsers require a gesture before audio starts */
  Audio.resume = function () {
    if (!Audio.ctx) Audio.init();
    if (Audio.ctx && Audio.ctx.state === 'suspended') Audio.ctx.resume();
  };

  Audio.setEnabled = function (on) {
    Audio.enabled = on;
    if (Audio.master) Audio.master.gain.value = on ? 0.6 : 0;
  };

  function tone(opts) {
    if (!Audio.enabled || !Audio.ready) return;
    var ctx = Audio.ctx, t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(opts.to, 1), t + opts.dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(opts.vol || 0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(gain);
    gain.connect(opts.bus || Audio.sfxGain);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  function noise(dur, vol, filterFreq, sweepTo) {
    if (!Audio.enabled || !Audio.ready) return;
    var ctx = Audio.ctx, t = ctx.currentTime;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(filterFreq || 1400, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(gain); gain.connect(Audio.sfxGain);
    src.start(t);
  }

  var SFX = {
    swing:    function () { noise(0.16, 0.22, 2600, 500); },
    heavy:    function () { noise(0.3, 0.3, 1400, 260); tone({ type: 'sine', freq: 120, to: 50, dur: 0.25, vol: 0.2 }); },
    hit:      function () { noise(0.1, 0.3, 3200, 900); tone({ type: 'square', freq: 220, to: 110, dur: 0.09, vol: 0.14 }); },
    kill:     function () { tone({ type: 'triangle', freq: 320, to: 90, dur: 0.3, vol: 0.2 }); noise(0.2, 0.18, 1200, 300); },
    hurt:     function () { tone({ type: 'sawtooth', freq: 180, to: 70, dur: 0.28, vol: 0.22 }); },
    bow:      function () { tone({ type: 'triangle', freq: 800, to: 1600, dur: 0.1, vol: 0.14 }); noise(0.1, 0.14, 4000, 1400); },
    dodge:    function () { noise(0.18, 0.16, 2200, 700); },
    pickup:   function () { tone({ type: 'sine', freq: 700, dur: 0.09, vol: 0.16 }); tone({ type: 'sine', freq: 1050, dur: 0.14, vol: 0.13 }); },
    coin:     function () { tone({ type: 'square', freq: 980, dur: 0.07, vol: 0.1 }); tone({ type: 'square', freq: 1480, dur: 0.12, vol: 0.08 }); },
    ui:       function () { tone({ type: 'square', freq: 520, dur: 0.05, vol: 0.09 }); },
    confirm:  function () { tone({ type: 'square', freq: 620, dur: 0.06, vol: 0.1 }); tone({ type: 'square', freq: 930, dur: 0.1, vol: 0.08 }); },
    deny:     function () { tone({ type: 'square', freq: 200, to: 130, dur: 0.16, vol: 0.12 }); },
    win:      function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone({ type: 'triangle', freq: f, dur: 0.26, vol: 0.16 }); }, i * 110); }); },
    lose:     function () { [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { tone({ type: 'sawtooth', freq: f, dur: 0.3, vol: 0.15 }); }, i * 150); }); },
    gem:      function () { [660, 880, 1320].forEach(function (f, i) { setTimeout(function () { tone({ type: 'sine', freq: f, dur: 0.5, vol: 0.16 }); }, i * 130); }); },
    boss:     function () { tone({ type: 'sawtooth', freq: 90, to: 40, dur: 1.2, vol: 0.3 }); noise(1.0, 0.2, 700, 160); },
    warp:     function () { tone({ type: 'sine', freq: 120, to: 1400, dur: 0.7, vol: 0.2 }); noise(0.7, 0.14, 900, 3000); },
    unlock:   function () { [440, 554, 659, 880, 1109].forEach(function (f, i) { setTimeout(function () { tone({ type: 'triangle', freq: f, dur: 0.42, vol: 0.15 }); }, i * 95); }); }
  };

  Audio.play = function (name) {
    var fn = SFX[name];
    if (fn) { try { fn(); } catch (e) { /* ignore */ } }
  };

  /* ---------------------------------------------------------------- music */
  var MOODS = {
    hub:   { root: 261.63, scale: [0, 2, 4, 7, 9], tempo: 620, type: 'triangle', vol: 0.09 },
    trial: { root: 196.00, scale: [0, 3, 5, 7, 10], tempo: 420, type: 'square', vol: 0.06 },
    boss:  { root: 130.81, scale: [0, 1, 5, 6, 8], tempo: 300, type: 'sawtooth', vol: 0.07 },
    calm:  { root: 220.00, scale: [0, 4, 7, 11, 14], tempo: 900, type: 'sine', vol: 0.08 }
  };

  Audio.music = function (mood) {
    if (mood === currentMood) return;
    currentMood = mood;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (!mood || !Audio.ready) return;
    var m = MOODS[mood];
    if (!m) return;
    musicStep = 0;
    musicTimer = setInterval(function () {
      if (!Audio.enabled || !Audio.ready) return;
      var deg = m.scale[Math.floor(Math.random() * m.scale.length)];
      var oct = Math.random() < 0.25 ? 12 : 0;
      var f = m.root * Math.pow(2, (deg + oct) / 12);
      tone({ type: m.type, freq: f, dur: m.tempo / 1000 * 1.6, vol: m.vol, bus: Audio.musicGain });
      if (musicStep % 4 === 0) {
        tone({ type: 'sine', freq: m.root / 2, dur: m.tempo / 1000 * 3, vol: m.vol * 1.3, bus: Audio.musicGain });
      }
      musicStep++;
    }, m.tempo);
  };

  V.Audio = Audio;
})(window.V = window.V || {});
