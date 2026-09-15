/* Velthiros - bundles the source into two single-file builds:
     dist/velthiros.html  a complete standalone page (open it anywhere)
     dist/artifact.html   body-only content for publishing as a Claude Artifact  */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* pull the script list straight out of index.html so the two never drift */
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('no <script src> tags found in index.html');

const css = fs.readFileSync(path.join(ROOT, 'src/css/style.css'), 'utf8');
const js = scripts
  .map((rel) => `/* ===== ${rel} ===== */\n` + fs.readFileSync(path.join(ROOT, rel), 'utf8'))
  .join('\n');

/* #safe-probe has to be here too: without it the bundled build reads every
   safe-area inset as zero and the HUD sits under the notch. */
const BODY = `<canvas id="game"></canvas>
<div id="safe-probe" aria-hidden="true"></div>
<div id="boot"><h1>VELTHIROS</h1><p>loading the arena</p></div>`;

/* Registered only in the standalone build. The dev page deliberately has no
   worker (nothing is more tedious than a cached source file), and the artifact
   build is embedded in someone else's page, where registering a worker would
   be both wrong and refused. */
const SW_REGISTER = `
/* ===== offline ===== */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {
      /* offline play is a bonus, not a requirement - never surface this */
    });
  });
}`;

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d0916">
<meta name="description" content="Velthiros - a trial-based mobile action RPG.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231a1030'/%3E%3Cpath d='M9 22 L23 8' stroke='%23c9f0ea' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M23 8 q6 3 3 10 q-1-6-7-7z' fill='%23c9f0ea'/%3E%3C/svg%3E">
<title>Velthiros</title>
<style>
${css}</style>
</head>
<body>
${BODY}
<script>
${js}
${SW_REGISTER}
</script>
</body>
</html>
`;

const artifact = `<title>Velthiros</title>
<style>
${css}</style>
${BODY}
<script>
${js}
</script>
`;

fs.writeFileSync(path.join(DIST, 'velthiros.html'), standalone);
fs.writeFileSync(path.join(DIST, 'artifact.html'), artifact);

/* ---------------------------------------------------------------- the site
   Everything GitHub Pages serves, assembled here rather than in the workflow
   so `npm run build` produces exactly what gets deployed. The worker's cache
   name carries a hash of the bundle, so a new build always lands in a new
   cache and the previous one is dropped on activate. */
const SITE = path.join(DIST, 'site');
fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(path.join(SITE, 'icons'), { recursive: true });

const version = 'velthiros-' + crypto.createHash('sha256').update(standalone).digest('hex').slice(0, 12);
const sw = fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8').replace('__VERSION__', version);

fs.writeFileSync(path.join(SITE, 'index.html'), standalone);
fs.writeFileSync(path.join(SITE, 'sw.js'), sw);
fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(SITE, 'manifest.webmanifest'));
for (const icon of fs.readdirSync(path.join(ROOT, 'icons'))) {
  fs.copyFileSync(path.join(ROOT, 'icons', icon), path.join(SITE, 'icons', icon));
}

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log(`bundled ${scripts.length} scripts`);
console.log(`  dist/velthiros.html  ${kb(standalone)}`);
console.log(`  dist/artifact.html   ${kb(artifact)}`);
console.log(`  dist/site/           installable, ${version}`);
