/* Velthiros - device checks: phone layout, safe areas, and the install story.
   Separate from smoke.mjs because the offline test has to kill its own server,
   which the gameplay suite's single long-lived server cannot do. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') u = '/index.html';
      const file = path.join(dir, u);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end('nope');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const preinstalled = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = { args: ['--no-sandbox'] };
if (fs.existsSync(preinstalled)) launchOpts.executablePath = preinstalled;

/* Drops the player into a live trial and reports the HUD's real geometry. */
async function layout(browser, port, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?trial=4`);
  await wait(800);
  await page.evaluate(() => { window.VELTHIROS.newGame(); });
  await wait(300);
  await page.evaluate(() => { window.VELTHIROS.enterTrial(); });
  await wait(300);
  await page.evaluate(() => { window.VELTHIROS.scene.trial.introTimer = 0.05; });
  await wait(600);
  const out = await page.evaluate(() => {
    const g = window.VELTHIROS;
    return {
      portrait: window.V.UI.portrait,
      inset: g.inset,
      cw: g.cw, ch: g.ch,
      buffer: { w: g.pixCanvas.width, h: g.pixCanvas.height },
      zones: (window.V.Input.lastZones || []).map((z) => (z.r != null
        ? { id: z.id, round: true, cx: z.x, cy: z.y, r: z.r,
            x: z.x - z.r, y: z.y - z.r, w: z.r * 2, h: z.r * 2 }
        : { id: z.id, round: false, x: z.x, y: z.y, w: z.w, h: z.h }))
    };
  });
  out.errors = errors;
  return { out, page, ctx };
}

/* Round buttons have to be compared as circles: two adjacent circles always
   have overlapping bounding boxes, so a box test would cry wolf forever. */
function overlaps(a, b) {
  if (a.round && b.round) {
    const dx = a.cx - b.cx, dy = a.cy - b.cy;
    return Math.sqrt(dx * dx + dy * dy) < a.r + b.r;
  }
  if (a.round || b.round) {
    const c = a.round ? a : b, r = a.round ? b : a;
    const nx = Math.max(r.x, Math.min(c.cx, r.x + r.w));
    const ny = Math.max(r.y, Math.min(c.cy, r.y + r.h));
    const dx = c.cx - nx, dy = c.cy - ny;
    return Math.sqrt(dx * dx + dy * dy) < c.r;
  }
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

async function main() {
  const browser = await chromium.launch(launchOpts);

  /* ---------------- phone layout, both ways up ---------------- */
  const dev = await serve(ROOT);
  const sizes = [
    ['portrait', 390, 844],
    ['landscape', 844, 390],
    ['small portrait', 360, 640],
    ['tablet', 820, 1180]
  ];
  const buffers = {};
  for (const [label, w, h] of sizes) {
    const { out, ctx } = await layout(browser, dev.port, w, h);
    buffers[label] = out.buffer.w * out.buffer.h;

    check(`${label}: orientation detected`, out.portrait === (h > w * 1.08),
      `portrait=${out.portrait} at ${w}x${h}`);
    check(`${label}: renders a trial with no errors`, out.errors.length === 0,
      out.errors.slice(0, 2).join(' | '));

    /* every control has to be reachable and distinct */
    const named = out.zones.filter((z) => ['attack', 'special', 'dodge', 'item', 'pause'].includes(z.id));
    check(`${label}: all five controls are on screen`, named.length === 5,
      named.map((z) => z.id).join(','));
    const off = named.filter((z) =>
      z.x < out.inset.left - 1 || z.y < out.inset.top - 1 ||
      z.x + z.w > out.cw - out.inset.right + 1 || z.y + z.h > out.ch - out.inset.bottom + 1);
    check(`${label}: no control hangs off the safe area`, off.length === 0,
      off.map((z) => z.id).join(','));

    const clashes = [];
    for (let i = 0; i < named.length; i++) {
      for (let j = i + 1; j < named.length; j++) {
        if (overlaps(named[i], named[j])) clashes.push(named[i].id + '/' + named[j].id);
      }
    }
    check(`${label}: no two controls overlap`, clashes.length === 0, clashes.join(', '));
    await ctx.close();
  }

  /* The buffer is sized by area so you see the same amount of arena whichever
     way the phone is held. Before this, portrait showed a 98px-wide slice. */
  const spread = Math.abs(buffers.portrait - buffers.landscape) / buffers.landscape;
  check('portrait and landscape show the same amount of arena',
    spread < 0.15, `portrait=${buffers.portrait}px2 landscape=${buffers.landscape}px2 (${Math.round(spread * 100)}% apart)`);

  /* ---------------- safe-area insets actually move the HUD ---------------- */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${dev.port}/index.html?trial=4`);
  await wait(800);
  await page.evaluate(() => { window.VELTHIROS.newGame(); window.VELTHIROS.enterTrial(); });
  await wait(400);
  const before = await page.evaluate(() => {
    const z = (window.V.Input.lastZones || []);
    const f = (id) => z.find((q) => q.id === id);
    return { pauseY: f('pause').y, atkY: f('attack').y, inset: window.VELTHIROS.inset };
  });
  /* env() cannot be faked from Playwright, but the probe it feeds can be */
  await page.addStyleTag({ content: '#safe-probe { padding: 47px 0px 34px 0px !important; }' });
  await page.evaluate(() => window.VELTHIROS.resize());
  await wait(300);
  const after = await page.evaluate(() => {
    const z = (window.V.Input.lastZones || []);
    const f = (id) => z.find((q) => q.id === id);
    return { pauseY: f('pause').y, atkY: f('attack').y, inset: window.VELTHIROS.inset };
  });
  check('a notch pushes the HUD down out from under it',
    Math.round(after.inset.top) === 47 && Math.round(after.pauseY - before.pauseY) === 47,
    JSON.stringify({ inset: after.inset.top, moved: Math.round(after.pauseY - before.pauseY) }));
  check('a home indicator lifts the action buttons clear of it',
    Math.round(after.inset.bottom) === 34 && Math.round(before.atkY - after.atkY) === 34,
    JSON.stringify({ inset: after.inset.bottom, moved: Math.round(before.atkY - after.atkY) }));
  await ctx.close();
  await new Promise((r) => dev.server.close(r));

  /* ---------------- installable, and playable with the network gone ------- */
  const siteDir = path.join(ROOT, 'dist', 'site');
  if (!fs.existsSync(siteDir)) {
    check('dist/site exists (run npm run build first)', false);
  } else {
    const site = await serve(siteDir);
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p2 = await pctx.newPage();
    const errs = [];
    p2.on('pageerror', (e) => errs.push(e.message));
    p2.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p2.goto(`http://127.0.0.1:${site.port}/`);
    await wait(2500);

    const man = await p2.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]');
      if (!link) return null;
      const m = await (await fetch(link.href)).json();
      return {
        name: m.name, display: m.display, orientation: m.orientation,
        start: !!m.start_url, icons: m.icons.length,
        maskable: m.icons.filter((i) => i.purpose === 'maskable').length,
        sizes: m.icons.map((i) => i.sizes)
      };
    });
    check('the manifest makes it installable',
      man && man.name === 'Velthiros' && man.display === 'fullscreen' && man.start &&
      man.maskable >= 2 && man.sizes.includes('512x512'),
      JSON.stringify(man));
    check('it can be installed either way up', man && man.orientation === 'any', man && man.orientation);

    const swActive = await p2.evaluate(() =>
      navigator.serviceWorker.ready.then((r) => !!r.active).catch(() => false));
    check('the service worker takes over', swActive === true);

    /* the real test: take the server away entirely, then reload */
    await new Promise((r) => site.server.close(r));
    let offline = 'never loaded';
    try {
      await p2.reload({ waitUntil: 'load', timeout: 20000 });
      await wait(1500);
      offline = await p2.evaluate(() => window.VELTHIROS && window.VELTHIROS.scene.constructor.name);
    } catch (e) { offline = 'reload failed: ' + String(e.message).split('\n')[0]; }
    check('the game still boots with the server gone', offline === 'StartScene', String(offline));
    check('no errors on a phone-sized install', errs.length === 0, errs.slice(0, 2).join(' | '));
    await pctx.close();
  }

  await browser.close();
  console.log('\n' + (failures ? `${failures} FAILURE(S)` : 'device checks passed'));
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
