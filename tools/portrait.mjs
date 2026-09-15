/* Velthiros - turns the reference photo into a palette-locked pixel portrait.

   Run once, by hand, with the photo outside the repo. The OUTPUT is what ships:
   src/js/portrait.js, a grid of palette characters exactly like every other
   sprite in the game. The photograph itself is never committed and never
   served - only pixel data derived from it, hand-editable afterwards.

     node tools/portrait.mjs <photo> [cropX cropY cropW cropH]  (fractions 0..1)
*/
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photo = process.argv[2];
if (!photo || !fs.existsSync(photo)) {
  console.error('usage: node tools/portrait.mjs <photo.jpg> [cx cy cw ch]');
  process.exit(1);
}
const crop = process.argv.length >= 7
  ? process.argv.slice(3, 7).map(Number)
  : [0.17, 0.235, 0.34, 0.295];
const OUT_W = Number(process.env.PW || 64);
const OUT_H = Number(process.env.PH || 100);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const photoBytes = fs.readFileSync(photo);

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__photo') {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    return res.end(photoBytes);
  }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const pre = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ args: ['--no-sandbox'], ...(fs.existsSync(pre) ? { executablePath: pre } : {}) });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForTimeout(800);

const result = await page.evaluate(async ([crop, W, H]) => {
  const PAL = window.V.Px.PALETTE;

  /* The portrait may only use colours the game already owns, so it lives in the
     same world as the sprites instead of looking like a photo pasted on top. */
  const rgb = {};
  for (const k of Object.keys(PAL)) if (PAL[k]) {
    const n = parseInt(PAL[k].slice(1), 16);
    rgb[k] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const nearest = (r, g, b, pool) => {
    let best = pool[0], bd = Infinity;
    for (const k of pool) {
      const c = rgb[k];
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      const d = 2.2 * dr * dr + 4.0 * dg * dg + 1.6 * db * db;   /* green carries luminance */
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };

  const img = new Image();
  img.src = '/__photo';
  await img.decode();

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, crop[0] * img.width, crop[1] * img.height,
    crop[2] * img.width, crop[3] * img.height, 0, 0, W, H);
  const px = x.getImageData(0, 0, W, H).data;

  /* The room light is cold, so straight quantisation sent every skin tone into
     the dirt browns. Warm it back up and stretch the contrast before matching,
     or the portrait comes out muddy no matter how good the palette is. */
  const lift = (v, m) => Math.max(0, Math.min(255, ((v * m - 128) * 1.07) + 132));
  const at = (i) => [
    lift(px[i * 4], 1.10),
    lift(px[i * 4 + 1], 1.02),
    lift(px[i * 4 + 2], 0.86)
  ];
  const rawAt = (i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];

  /* ---- 1. background ----------------------------------------------------
     The room is bright, desaturated and blue-leaning; the subject is warm skin
     or near-black cloth. Classify on that, then flood from the border so a
     dark fold inside the shirt is never punched out. */
  const isBackdrop = (r, g, b) => {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    /* The warmth guard is what keeps shadowed skin: it sits at the same
       luminance as the doorframe and is only told apart by being warm. */
    if (lum > 112 && sat < 58 && r - b < 26) return true;
    return b - r > 14 && lum > 70;
  };
  /* Every candidate goes, not just the ones a border flood can reach: the room
     is also visible in enclosed pockets - through the open shirt, under the
     jaw - and those are exactly the scraps a flood fill leaves behind. Nothing
     on the subject classifies as backdrop, so there is no flood to protect. */
  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const p = rawAt(i); bg[i] = isBackdrop(p[0], p[1], p[2]) ? 1 : 0; }
  /* close pinholes so the silhouette edge stays clean */
  for (let pass = 0; pass < 2; pass++) {
    const copy = bg.slice();
    for (let y2 = 1; y2 < H - 1; y2++) for (let x2 = 1; x2 < W - 1; x2++) {
      const i = y2 * W + x2;
      let n = 0;
      for (const d of [-1, 1, -W, W]) n += copy[i + d];
      if (!copy[i] && n >= 4) bg[i] = 1;
      if (copy[i] && n === 0) bg[i] = 0;
    }
  }

  /* anything still bright and colourless is a leftover scrap of room */
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) continue;
    const p = rawAt(i);
    const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const sat = Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
    if (lum > 168 && sat < 46) bg[i] = 1;
  }

  /* Whatever survives in scraps is doorframe, towel or a slice of the room seen
     past his shoulder. The subject is one connected mass, so keep the largest
     component and drop every other island. */
  const seen = new Int32Array(W * H).fill(-1);
  let bestId = -1, bestSize = 0, id = 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (bg[i0] || seen[i0] >= 0) continue;
    let size = 0;
    const q = [i0];
    seen[i0] = id;
    while (q.length) {
      const i = q.pop();
      size++;
      const qx = i % W, qy = (i / W) | 0;
      const nb = [];
      if (qx > 0) nb.push(i - 1);
      if (qx < W - 1) nb.push(i + 1);
      if (qy > 0) nb.push(i - W);
      if (qy < H - 1) nb.push(i + W);
      for (const n of nb) if (!bg[n] && seen[n] < 0) { seen[n] = id; q.push(n); }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  for (let i = 0; i < W * H; i++) if (!bg[i] && seen[i] !== bestId) bg[i] = 1;

  /* ---- 2. hair -----------------------------------------------------------
     Dark, in the top third, not skin. Remapped onto the silver ramp by
     luminance so the portrait matches the sprite rather than the photograph. */
  const SILVER = ['j', 'L', 'l'];
  const SKINS = ['F', 'f', 'e', 'z'];        /* no dirt browns: they read as grime */
  const CLOTH = ['U', 'K', 'k', 'P', 'M', 'V', 'R', 'A'];
  const ALL = Object.keys(rgb).filter((k) => k !== '.');

  const out = [];
  for (let y2 = 0; y2 < H; y2++) {
    let row = '';
    for (let x2 = 0; x2 < W; x2++) {
      const i = y2 * W + x2;
      if (bg[i]) { row += '.'; continue; }
      const [r, g, b] = at(i);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const warm = r - b;
      const hairZone = y2 < H * 0.24;   /* above the jaw only */
      if (hairZone && lum < 108 && warm < 46) {
        /* three silver tones, darkest underneath */
        const t = Math.min(2, Math.max(0, Math.round((lum / 108) * 2.4 - 0.2)));
        row += SILVER[t];
      } else if (warm > 26 && lum > 66) {
        row += nearest(r, g, b, SKINS);
      } else if (lum < 76) {
        row += nearest(r, g, b, CLOTH);
      } else {
        row += nearest(r, g, b, ALL);
      }
    }
    out.push(row);
  }
  return { rows: out, W, H };
}, [crop, OUT_W, OUT_H]);

/* ---- preview it big, through the game's own baker ---- */
const preview = await page.evaluate(async ([data]) => {
  const { rows, W, H } = data;
  const Px = window.V.Px;
  const spr = Px.make(W, H, (g) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      if (ch !== '.') g.set(x, y, ch);
    }
  }, { ax: 0, ay: 0 });
  const S = 6;
  const c = document.createElement('canvas');
  c.width = W * S + 20; c.height = H * S + 20;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1622'; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = false;
  x.drawImage(spr.canvas, 10, 10, W * S, H * S);
  return c.toDataURL('image/png');
}, [result]);

const OUT = process.env.OUT || 'zz-portrait';
fs.writeFileSync(path.join(ROOT, 'tests/shots/' + OUT + '.png'),
  Buffer.from(preview.split(',')[1], 'base64'));

/* ---- hand corrections -------------------------------------------------
   Automatic masking gets the silhouette but not everything: a slab of
   doorframe sits directly against his jaw at the same luminance as skin, so
   no colour rule separates it. Clearing it by coordinate is honest pixel
   work, and keeping it here rather than editing the output means a
   regeneration reproduces the same portrait. */
const PATCHES = [
  { x: 12, y: 36, w: 11, h: 13, why: 'doorframe beside the jaw' }
];
for (const p of PATCHES) {
  for (let y = p.y; y < p.y + p.h && y < result.rows.length; y++) {
    const row = result.rows[y];
    result.rows[y] = row.slice(0, p.x) + '.'.repeat(Math.min(p.w, row.length - p.x)) + row.slice(p.x + p.w);
  }
  console.log(`patched ${p.w}x${p.h} at ${p.x},${p.y} - ${p.why}`);
}

/* ---- ship it as sprite data, not as an image ---- */
const js = `/* Velthiros - the main character's portrait.

   Derived once from a reference photograph by tools/portrait.mjs and then
   hand-corrected. What ships is only this: a grid of palette characters,
   authored exactly like every other sprite in the game. The photograph is not
   in the repository and is never served.

   Every character below is a key in Px.PALETTE; '.' is transparent. Edit it
   like any other sprite - the test suite validates it against the palette. */
(function (V) {
  'use strict';

  V.Portrait = {
    W: ${result.W},
    H: ${result.H},
    ROWS: [
${result.rows.map((r) => "      '" + r + "'").join(',\n')}
    ]
  };
})(window.V = window.V || {});
`;
fs.writeFileSync(path.join(ROOT, 'src/js/portrait.js'), js);
console.log('wrote src/js/portrait.js');

const used = new Set();
for (const r of result.rows) for (const ch of r) if (ch !== '.') used.add(ch);
console.log(`crop ${crop.join(' ')} -> ${OUT_W}x${OUT_H}`);
console.log('palette keys used:', [...used].sort().join(''));
fs.writeFileSync(path.join(ROOT, 'tests/shots/' + OUT + '.json'), JSON.stringify(result.rows));

await browser.close();
server.close();
