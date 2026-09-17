/* Velthiros - renders the square cover art.
 *
 * The art is composed from the game's OWN sprites and palette rather than
 * drawn separately, so the cover cannot drift away from what the game
 * actually looks like. It loads index.html headless, builds a square canvas
 * with V.Spr and V.Px, and writes a PNG.
 *
 *   node tools/cover.mjs [size]        default 1024
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = parseInt(process.argv[2], 10) || 1024;
const OUT = process.env.OUT || path.join(ROOT, 'dist', `cover-${SIZE}.png`);

const preinstalled = '/opt/pw-browsers/chromium';
const launchOpts = { args: ['--no-sandbox'] };
if (fs.existsSync(preinstalled)) launchOpts.executablePath = preinstalled;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => window.V && window.V.Spr && window.V.Px);

const dataUrl = await page.evaluate((S) => {
  const V = window.V, Px = V.Px, Spr = V.Spr;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');

  /* deterministic scatter, so the cover is reproducible */
  let seed = 20260915;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* ---------------------------------------------------------------- sky */
  const sky = ctx.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0.00, '#05070e');
  sky.addColorStop(0.38, '#0e1728');
  sky.addColorStop(0.62, '#17293f');
  sky.addColorStop(0.84, '#2a4a68');
  sky.addColorStop(1.00, '#0b1220');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, S, S);

  /* stars, thinning as the sky warms toward the horizon */
  for (let i = 0; i < 220; i++) {
    const x = rnd() * S, y = rnd() * S * 0.7;
    const r = rnd() * 1.8 + 0.5;
    ctx.globalAlpha = (0.25 + rnd() * 0.5) * (1 - y / (S * 0.8));
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r * (S / 1024), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------ watchers
     The premise is that unseen watchers rank every run. They are the thing
     the cover has to carry, and they have no sprite - by definition you
     never see them. So they are pairs of eyes in the dark, dimmer and
     denser toward the edges, and they read as an audience rather than as
     enemies. */
  const eyes = [];
  for (let i = 0; i < 62; i++) {
    const x = rnd() * S;
    const y = rnd() * S * 0.53;
    /* keep the centre clear so Garatu stays readable */
    const dx = Math.abs(x - S / 2) / (S / 2);
    if (dx < 0.36 && y > S * 0.13 && y < S * 0.46) continue;
    /* a wide size spread: the near ones have to read as eyes, or the whole
       motif collapses into background bokeh */
    const near = rnd();
    const k = S / 1024;
    eyes.push({ x, y,
                gap: (3 + near * near * 8) * k,
                r: (1.2 + near * near * 2.6) * k,
                a: 0.3 + near * 0.55 });
  }
  for (const e of eyes) {
    const gr = e.gap * 2.2;
    const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, gr);
    glow.addColorStop(0, 'rgba(127,228,255,' + (e.a * 0.26).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(127,228,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - gr, e.y - gr, gr * 2, gr * 2);
    ctx.fillStyle = 'rgba(190,240,255,' + e.a.toFixed(3) + ')';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(e.x + s * e.gap, e.y, e.r, e.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------------------------------------------- the thing at the end
     The Aurelith. Drawn large and low-contrast so it reads as a mass rather
     than as detail: the eye should still land on the hero. It replaced Garatu
     here because it is the game's actual last fight, and because Garatu is a
     red demon by construction - there is no cold version of that sprite, and
     the cover wanted to be cold. */
  const gar = Spr.aurelith(0);
  const gScale = Math.max(1, Math.round((S * 0.47) / gar.w));
  const garY = Math.round(S * 0.435);
  const garW = gar.w * gScale, garH = gar.h * gScale;

  const aura = ctx.createRadialGradient(S / 2, garY - garH * 0.5, 0, S / 2, garY - garH * 0.5, garW * 0.78);
  aura.addColorStop(0, 'rgba(126,146,196,0.30)');
  aura.addColorStop(0.55, 'rgba(90,120,180,0.13)');
  aura.addColorStop(1, 'rgba(90,120,180,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(S / 2 - garW, garY - garH * 1.5, garW * 2, garH * 2);

  ctx.globalAlpha = 0.9;
  Px.draw(ctx, gar, S / 2, garY, { scale: gScale });
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------- skyline
     The abduction happens off an ordinary street, so the city has to be in
     frame - it is what he is taken from. */
  const base = S * 0.84;
  const cols = 13, bw = S / (cols - 1);
  ctx.fillStyle = '#0a1120';
  for (let i = 0; i < cols; i++) {
    const bh = S * (0.055 + ((i * 37) % 11) / 11 * 0.115);
    ctx.fillRect(i * bw - 6, base - bh, bw + 3, bh + S);
    ctx.fillStyle = 'rgba(190,225,255,0.40)';
    for (let w = 0; w < 4; w++) {
      if ((i * 7 + w * 3) % 5 < 2) {
        ctx.fillRect(i * bw + bw * 0.16 + w * bw * 0.2,
                     base - bh + S * 0.018 + w * S * 0.019,
                     S * 0.0055, S * 0.008);
      }
    }
    ctx.fillStyle = '#0a1120';
  }

  /* ---------------------------------------------------- the arena, and him
     A ring of light on the ground: the trial floor, and the only bright
     thing in the frame. He is small on purpose - that is the game. */
  const hero = Spr.player('down', 0, '#1b1826', 'grayson');
  const hScale = Math.max(2, Math.round((S * 0.175) / hero.h));
  const heroY = Math.round(S * 0.905);
  const ringR = hero.w * hScale * 1.6;

  const floor = ctx.createRadialGradient(S / 2, heroY, 0, S / 2, heroY, ringR * 1.7);
  floor.addColorStop(0, 'rgba(127,228,255,0.32)');
  floor.addColorStop(0.5, 'rgba(90,170,255,0.11)');
  floor.addColorStop(1, 'rgba(90,170,255,0)');
  ctx.fillStyle = floor;
  ctx.fillRect(S / 2 - ringR * 1.7, heroY - ringR * 1.7, ringR * 3.4, ringR * 3.4);

  ctx.strokeStyle = 'rgba(126,214,233,0.5)';
  ctx.lineWidth = Math.max(1.5, S / 420);
  ctx.beginPath();
  ctx.ellipse(S / 2, heroY, ringR, ringR * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();

  /* a shaft of light from above, so the ring reads as a stage */
  const shaft = ctx.createLinearGradient(0, S * 0.5, 0, heroY);
  shaft.addColorStop(0, 'rgba(127,228,255,0)');
  shaft.addColorStop(1, 'rgba(127,228,255,0.10)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(S / 2 - ringR * 0.42, S * 0.5);
  ctx.lineTo(S / 2 + ringR * 0.42, S * 0.5);
  ctx.lineTo(S / 2 + ringR, heroY);
  ctx.lineTo(S / 2 - ringR, heroY);
  ctx.closePath();
  ctx.fill();

  Px.shadow(ctx, S / 2, heroY, hero.w * hScale * 0.42, 0.42);

  Px.draw(ctx, hero, S / 2, heroY, { scale: hScale });

  /* ---------------------------------------------------------------- title */
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const titlePx = Math.round(S * 0.103);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 ' + titlePx + 'px ' + FONT;
  const ty = Math.round(S * 0.6);

  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = S * 0.03;
  ctx.shadowOffsetY = S * 0.006;
  ctx.fillStyle = '#f2f7ff';
  ctx.letterSpacing = (S * 0.007) + 'px';
  ctx.fillText('VELTHIROS', S / 2, ty);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.font = '600 ' + Math.round(S * 0.028) + 'px ' + FONT;
  ctx.letterSpacing = (S * 0.017) + 'px';
  ctx.fillStyle = 'rgba(127,228,255,0.85)';
  ctx.fillText('THEY ARE WATCHING', S / 2, ty + titlePx * 0.58);
  ctx.letterSpacing = '0px';

  /* a vignette pulls the eye back to the middle */
  const vig = ctx.createRadialGradient(S / 2, S * 0.52, S * 0.22, S / 2, S * 0.52, S * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  return cv.toDataURL('image/png');
}, SIZE);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log(`wrote ${OUT} (${SIZE}x${SIZE}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
