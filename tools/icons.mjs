/* Velthiros - renders the app icons.
   Vector rather than pixel art on purpose: the icon has to survive being drawn
   at 48px in a launcher, and an 18x28 sprite upscaled turns to mush there. The
   mark is the scythe - the game's secret weapon and its existing favicon. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'icons');
fs.mkdirSync(OUT, { recursive: true });

const pre = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ args: ['--no-sandbox'], ...(fs.existsSync(pre) ? { executablePath: pre } : {}) });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

/* size, filename, inset — maskable needs its content inside the safe circle,
   because launchers crop the corners to whatever shape they please */
const JOBS = [
  [512, 'icon-512.png', 0.78],
  [192, 'icon-192.png', 0.78],
  [180, 'apple-touch-icon.png', 0.78],
  [512, 'icon-maskable-512.png', 0.54],
  [192, 'icon-maskable-192.png', 0.54]
];

for (const [size, name, fill] of JOBS) {
  const data = await page.evaluate(([size, fill]) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size * 0.42, size * 0.34, size * 0.05, size / 2, size / 2, size * 0.78);
    g.addColorStop(0, '#2a1b47');
    g.addColorStop(1, '#0d0916');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);

    /* the scythe, drawn in a 32x32 space then scaled into the safe area */
    const u = (size * fill) / 32;
    const ox = size / 2 - 16 * u, oy = size / 2 - 16 * u;
    const P = (px, py) => [ox + px * u, oy + py * u];
    x.lineCap = 'round';
    x.lineJoin = 'round';

    x.strokeStyle = '#6f5aa8';
    x.lineWidth = 3.6 * u;
    x.beginPath(); x.moveTo(...P(8, 25)); x.lineTo(...P(23, 8)); x.stroke();
    x.strokeStyle = '#c9f0ea';
    x.lineWidth = 2.2 * u;
    x.beginPath(); x.moveTo(...P(8, 25)); x.lineTo(...P(23, 8)); x.stroke();

    x.fillStyle = '#eafcf7';
    x.beginPath();
    x.moveTo(...P(23, 8));
    x.quadraticCurveTo(...P(30, 11), ...P(26.5, 20.5));
    x.quadraticCurveTo(...P(25.5, 12.5), ...P(18.5, 11.5));
    x.closePath();
    x.fill();
    return c.toDataURL('image/png');
  }, [size, fill]);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data.split(',')[1], 'base64'));
  console.log('  icons/' + name, size + 'px');
}

await browser.close();
