/* Velthiros - renders the Grayson teaser.
 *
 * Like tools/cover.mjs, this is composed from the game's OWN sprites and
 * palette rather than drawn separately, so the teaser cannot promise a look
 * the game does not deliver. It loads index.html headless, builds a wide
 * canvas with V.Spr and V.Px, and writes a PNG.
 *
 *   node tools/teaser.mjs [width]        default 1600 (16:9)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = parseInt(process.argv[2], 10) || 1600;
const OUT = process.env.OUT || path.join(ROOT, 'press', `teaser-grayson-${W}.png`);

const preinstalled = '/opt/pw-browsers/chromium';
const launchOpts = { args: ['--no-sandbox'] };
if (fs.existsSync(preinstalled)) launchOpts.executablePath = preinstalled;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => window.V && window.V.Spr && window.V.Px);

const dataUrl = await page.evaluate((W) => {
  const V = window.V, Spr = V.Spr;
  const H = Math.round(W * 9 / 16);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const k = W / 1600;                       /* everything scales off the width */

  let seed = 20260917;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* ------------------------------------------------------------------ sky
     Cold where the cover is warm. The cover sells the arena; this sells the
     one suit you have to find, so it is lit by the armour rather than by a
     sunset. */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.00, '#05060d');
  sky.addColorStop(0.42, '#0d1424');
  sky.addColorStop(0.72, '#132437');
  sky.addColorStop(1.00, '#070a12');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H * 0.72;
    ctx.globalAlpha = (0.2 + rnd() * 0.55) * (1 - y / (H * 0.85));
    ctx.fillStyle = '#cfe6ff';
    ctx.fillRect(x, y, Math.max(1, rnd() * 2.2 * k), Math.max(1, rnd() * 2.2 * k));
  }
  ctx.globalAlpha = 1;

  /* --------------------------------------------------------- the watchers
     Same motif as the cover: the premise is an unseen audience ranking every
     run, so they are pairs of eyes rather than a crowd. Colder here, and held
     well back, because the hero is the subject this time. */
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * H * 0.5;
    if (Math.abs(x - W * 0.42) < W * 0.2 && y > H * 0.15) continue;
    const near = rnd();
    const gap = (3 + near * near * 7) * k, r = (1.1 + near * near * 2.2) * k;
    const a = 0.22 + near * 0.4;
    const gr = gap * 2.4;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, gr);
    glow.addColorStop(0, 'rgba(127,228,255,' + (a * 0.22).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(127,228,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - gr, y - gr, gr * 2, gr * 2);
    ctx.fillStyle = 'rgba(190,240,255,' + a.toFixed(3) + ')';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * gap, y, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------------------------------------------------------- floor */
  const horizon = H * 0.72;
  const gnd = ctx.createLinearGradient(0, horizon, 0, H);
  gnd.addColorStop(0, '#1b2233');
  gnd.addColorStop(1, '#090c15');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.fillStyle = 'rgba(127,228,255,0.10)';
  ctx.fillRect(0, horizon, W, 2 * k);

  /* the arena ring, in perspective */
  ctx.strokeStyle = 'rgba(127,228,255,0.13)';
  ctx.lineWidth = 2 * k;
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.ellipse(W * 0.42, H * 0.93, W * 0.18 * r, H * 0.05 * r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ------------------------------------------------- the thing at the end
     The Aurelith, looming directly behind the hero so its wings spread either
     side of him. Held back in brightness rather than in size: a boss shrunk to
     fit politely behind someone is not looming, so it is drawn big and dimmed
     instead, with only its core left burning. */
  const boss = Spr.aurelith(0);
  const bs = 11 * k;
  const bcx = W * 0.42;
  const bx = bcx - boss.w * bs / 2;
  const by = H * 0.87 - boss.h * bs;
  const bcy = by + boss.h * bs * 0.46;

  const halo = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, boss.w * bs * 0.72);
  halo.addColorStop(0, 'rgba(126,146,196,0.22)');
  halo.addColorStop(1, 'rgba(126,146,196,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(bx - 120 * k, by - 80 * k, boss.w * bs + 240 * k, boss.h * bs + 160 * k);

  ctx.globalAlpha = 0.40;
  ctx.drawImage(boss.canvas, bx, by, boss.w * bs, boss.h * bs);
  ctx.globalAlpha = 1;

  const core = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, 52 * k);
  core.addColorStop(0, 'rgba(255,92,112,0.58)');
  core.addColorStop(1, 'rgba(255,92,112,0)');
  ctx.fillStyle = core;
  ctx.fillRect(bcx - 70 * k, bcy - 70 * k, 140 * k, 140 * k);

  /* --------------------------------------------------- the cast, held back
     Three enemies in silhouette so the roster is in the picture without
     competing with the hero: the ones furthest apart in shape. */
  const cast = [['ironclad', 0.80, 0.80, 7], ['shade', 0.90, 0.74, 6], ['goblin', 0.70, 0.75, 6]];
  for (const [id, fx, fy, sc] of cast) {
    const spr = Spr[id]('down', 0);
    const s = sc * k;
    const x = W * fx - spr.w * s / 2, y = H * fy - spr.h * s;
    ctx.globalAlpha = 0.34;
    ctx.drawImage(spr.canvas, x, y, spr.w * s, spr.h * s);
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- hero */
  const hero = Spr.player('down', 0, '#1b1826', 'grayson');
  const hs = 18 * k;
  const hx = W * 0.42 - hero.w * hs / 2;
  const hy = H * 0.93 - hero.h * hs;

  /* A rim of his own light behind him. A dark figure standing in front of a
     dark figure loses its edge completely; this is what separates the two. */
  const rimY = H * 0.93 - hero.h * hs * 0.45;
  const rim = ctx.createRadialGradient(W * 0.42, rimY, 0, W * 0.42, rimY, hero.w * hs * 0.8);
  rim.addColorStop(0, 'rgba(79,216,255,0.32)');
  rim.addColorStop(0.55, 'rgba(79,216,255,0.11)');
  rim.addColorStop(1, 'rgba(79,216,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(W * 0.42 - hero.w * hs, rimY - hero.h * hs * 0.8, hero.w * hs * 2, hero.h * hs * 1.6);

  /* the charge he is carrying, pooling under him */
  const pool = ctx.createRadialGradient(W * 0.42, H * 0.93, 0, W * 0.42, H * 0.93, W * 0.2);
  pool.addColorStop(0, 'rgba(127,228,255,0.30)');
  pool.addColorStop(0.5, 'rgba(90,150,255,0.10)');
  pool.addColorStop(1, 'rgba(127,228,255,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(W * 0.22, H * 0.72, W * 0.4, H * 0.28);

  /* the scythe, held out and back - drawn before the body so the haft passes
     behind him and only the blade clears his shoulder */
  const sc = Spr.weapon('scythe');
  const ws = 13 * k;
  ctx.save();
  ctx.translate(W * 0.42 + 1.5 * hs, H * 0.93 - hero.h * hs * 0.48);
  ctx.rotate(-0.52);
  ctx.drawImage(sc.canvas, -sc.w * ws * 0.14, -sc.h * ws * 0.86, sc.w * ws, sc.h * ws);
  ctx.restore();

  ctx.drawImage(hero.canvas, hx, hy, hero.w * hs, hero.h * hs);

  /* the electricity, drawn at key-art scale with the same rule the game uses:
     short jagged runs that jump, never a smooth halo */
  ctx.lineWidth = Math.max(2, 2.6 * k);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    /* held close to the body - arcs thrown wide stop reading as HIS charge
       and start reading as weather */
    const rad = (0.4 + rnd() * 0.5) * hero.w * hs * 0.72;
    let x = W * 0.42 + Math.cos(a) * rad;
    let y = H * 0.93 - hero.h * hs * 0.5 + Math.sin(a) * rad * 0.7;
    ctx.strokeStyle = rnd() < 0.3 ? '#b6f4ff' : '#4fd8ff';
    ctx.globalAlpha = 0.35 + rnd() * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rnd() - 0.5) * 34 * k;
      y += (rnd() - 0.5) * 30 * k;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  /* --------------------------------------------------------------- title */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const tx = W * 0.62;
  ctx.font = 'bold ' + Math.round(96 * k) + 'px ui-monospace, Menlo, monospace';
  ctx.fillStyle = 'rgba(127,228,255,0.30)';
  ctx.fillText('VELTHIROS', tx + 4 * k, H * 0.36 + 4 * k);
  ctx.fillStyle = '#f2f7ff';
  ctx.fillText('VELTHIROS', tx, H * 0.36);

  ctx.font = Math.round(25 * k) + 'px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#7fe4ff';
  ctx.fillText('T H E   G R A Y S O N   W E A V E', tx + 3 * k, H * 0.36 + 44 * k);

  ctx.font = Math.round(21 * k) + 'px ui-monospace, Menlo, monospace';
  ctx.fillStyle = 'rgba(210,225,245,0.72)';
  ctx.fillText('Fifty trials. One suit you have to find.', tx + 3 * k, H * 0.36 + 86 * k);
  ctx.fillText('They are watching.', tx + 3 * k, H * 0.36 + 116 * k);

  return cv.toDataURL('image/png');
}, W);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
await browser.close();
