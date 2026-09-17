/* Velthiros - renders the armour and weapon reference sheets.
 *
 * These existed only as one-off renders for a while, which meant the only
 * copy of "what does the Ophiuchus top actually look like" was an image in a
 * chat log. They are a build artifact now: run this and you get the current
 * truth, straight out of the same sprite functions the game draws from.
 *
 *   node tools/sheets.mjs            writes both into press/
 *   node tools/sheets.mjs 20         at 20x rather than 14x
 *
 * Every suit is drawn facing three ways so the cloak, the back and the
 * silhouette are all visible - a front-only sheet hides exactly the things
 * that go wrong at this size.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = parseInt(process.argv[2], 10) || 14;
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'press');

const preinstalled = '/opt/pw-browsers/chromium';
const launchOpts = { args: ['--no-sandbox'] };
if (fs.existsSync(preinstalled)) launchOpts.executablePath = preinstalled;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => { console.error('PAGE ERROR', e.message); });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => window.V && window.V.Spr && window.V.Px);

const sheets = await page.evaluate((S) => {
  const V = window.V, Spr = V.Spr, D = V.D;

  const BG = '#181620', CELL = '#2a2635', LINE = '#3d3750';
  const INK = '#efe9f6', DIM = '#a79cbd';
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

  function newCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);
    return { cv, ctx };
  }

  function heading(ctx, text, sub, x, y) {
    ctx.textAlign = 'left';
    ctx.font = '800 26px ' + FONT;
    ctx.fillStyle = INK;
    ctx.fillText(text, x, y);
    ctx.font = '500 14px ' + FONT;
    ctx.fillStyle = DIM;
    ctx.fillText(sub, x, y + 20);
  }

  /* ------------------------------------------------------------- armour
     Four suits down the page, three views each, drawn from the shop's own
     list so a suit cannot appear here without being buyable. */
  function armourSheet() {
    const suits = D.REALITY_SHOP.filter((it) => it.cat === 'Armour');
    const views = ['down', 'side', 'up'];
    const spr = Spr.player('down', 0, null, suits[0].outfit);
    const cw = spr.w * S, ch = spr.h * S;
    const pad = 22, gap = 16, labelH = 26;
    const colW = cw + gap;
    const rowH = ch + labelH + gap + 34;
    const left = pad + 280;                       /* room for the suit names */

    const { cv, ctx } = newCanvas(left + views.length * colW + pad,
                                  84 + suits.length * rowH + pad);
    heading(ctx, 'VELTHIROS — ARMOUR', 'every suit in the shop, drawn from the game’s own sprites', pad, 44);

    suits.forEach((suit, r) => {
      const y = 84 + r * rowH;

      ctx.textAlign = 'left';
      ctx.font = '700 20px ' + FONT;
      ctx.fillStyle = INK;
      ctx.fillText(suit.name, pad, y + 34);
      ctx.font = '500 13px ' + FONT;
      ctx.fillStyle = DIM;
      ctx.fillText(suit.desc, pad, y + 54);
      ctx.fillText('◆ ' + suit.price, pad, y + 74);

      views.forEach((dir, c) => {
        const x = left + c * colW;
        ctx.fillStyle = CELL;
        ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        /* tint null: the suit's own palette, not the shop swatch */
        ctx.drawImage(Spr.player(dir, 0, null, suit.outfit).canvas, x, y, cw, ch);

        ctx.textAlign = 'center';
        ctx.font = '600 12px ' + FONT;
        ctx.fillStyle = DIM;
        ctx.fillText(dir, x + cw / 2, y + ch + 18);
      });

      if (r < suits.length - 1) {
        ctx.strokeStyle = LINE;
        ctx.beginPath();
        ctx.moveTo(pad, y + rowH - gap);
        ctx.lineTo(cv.width - pad, y + rowH - gap);
        ctx.stroke();
      }
    });
    return cv.toDataURL('image/png');
  }

  /* ------------------------------------------------------------- weapons
     The three swung weapons are authored lying down - grip at the left, tip
     to the right - because that is the angle the game pivots them from. On a
     rack that reads as three dropped weapons, so they are stood up here. The
     bow is the exception: it is authored the way it is held, and rotating it
     would be the thing that lies. */
  const UPRIGHT = { sword: -Math.PI / 2, battleaxe: -Math.PI / 2,
                    scythe: -Math.PI / 2, bow: 0 };

  function weaponSheet() {
    const ids = D.WEAPON_ORDER;   /* not Object.keys: that includes `none` */
    const items = ids.map((id) => {
      const spr = Spr.weapon(id), rot = UPRIGHT[id] || 0;
      /* a quarter turn swaps the footprint, so measure what is DRAWN */
      return { id: id, spr: spr, rot: rot,
               rw: rot ? spr.h : spr.w, rh: rot ? spr.w : spr.h };
    });
    const cw = Math.max.apply(null, items.map((it) => it.rw)) * S;
    const ch = Math.max.apply(null, items.map((it) => it.rh)) * S;
    const pad = 22, gap = 18, labelH = 46;

    const { cv, ctx } = newCanvas(pad * 2 + ids.length * cw + (ids.length - 1) * gap,
                                  84 + ch + labelH + pad);
    heading(ctx, 'VELTHIROS — WEAPONS', 'stood upright and to scale with each other; in play they rotate to the swing', pad, 44);

    items.forEach((it, i) => {
      const w = D.WEAPONS[it.id];
      const x = pad + i * (cw + gap), y = 84;

      ctx.fillStyle = CELL;
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);

      /* rotate about the cell's centre, so the scale comparison stays honest */
      ctx.save();
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.rotate(it.rot);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(it.spr.canvas,
                    -it.spr.w * S / 2, -it.spr.h * S / 2,
                    it.spr.w * S, it.spr.h * S);
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.font = '700 18px ' + FONT;
      ctx.fillStyle = INK;
      ctx.fillText(w.name || it.id, x + cw / 2, y + ch + 24);
      ctx.font = '500 13px ' + FONT;
      ctx.fillStyle = DIM;
      ctx.fillText(it.spr.w + '×' + it.spr.h + ' px', x + cw / 2, y + ch + 42);
    });
    return cv.toDataURL('image/png');
  }

  return { armour: armourSheet(), weapons: weaponSheet() };
}, SCALE);

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, url] of [['armour-sheet.png', sheets.armour],
                           ['weapon-sheet.png', sheets.weapons]]) {
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
await browser.close();
