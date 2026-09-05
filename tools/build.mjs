/* Velthiros - bundles the source into two single-file builds:
     dist/velthiros.html  a complete standalone page (open it anywhere)
     dist/artifact.html   body-only content for publishing as a Claude Artifact  */
import fs from 'node:fs';
import path from 'node:path';
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

const BODY = `<canvas id="game"></canvas>
<div id="rotate">turn sideways for the full arena</div>
<div id="boot"><h1>VELTHIROS</h1><p>loading the arena</p></div>`;

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0d0916">
<meta name="description" content="Velthiros - a trial-based mobile action RPG.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Velthiros</title>
<style>
${css}</style>
</head>
<body>
${BODY}
<script>
${js}
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

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log(`bundled ${scripts.length} scripts`);
console.log(`  dist/velthiros.html  ${kb(standalone)}`);
console.log(`  dist/artifact.html   ${kb(artifact)}`);
