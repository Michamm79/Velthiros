/* Velthiros - walks every trial in the run and reports anything wrong.
 *
 * Builds each of the 50 trials plus the endgame waves, checks the setup makes
 * a completable objective, then simulates it forward to catch anything that
 * throws only once things start moving.
 *
 *   node tools/sweep.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pre = '/opt/pw-browsers/chromium';
const opts = { args: ['--no-sandbox'] };
if (fs.existsSync(pre)) opts.executablePath = pre;

const browser = await chromium.launch(opts);
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const boot = [];
page.on('pageerror', (e) => boot.push(e.message));
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForFunction(() => window.VELTHIROS && window.V && window.V.Trial);

const report = await page.evaluate(() => {
  const g = window.VELTHIROS, V = window.V, D = V.D, U = V.U;
  const R = V.Trial.ARENA_R;
  const rows = [];

  const inBounds = (o, pad) => o && U.dist(o.x, o.y, 0, 0) <= R - (pad || 0) + 1;

  for (let idx = 1; idx <= D.TOTAL_TRIALS; idx++) {
    const row = { trial: idx, problems: [] };
    let t = null;
    try {
      g.save.trial = idx;
      const spec = g.makeSpec(idx);
      row.type = spec.type;
      t = new V.Trial(g, spec);
    } catch (e) {
      row.problems.push('setup threw: ' + e.message);
      rows.push(row);
      continue;
    }

    row.enemies = t.enemies.length;
    row.limit = Math.round(t.timeLimit || 0);
    row.par = Math.round(t.par || 0);

    if (!t.objective || !t.objective.text) row.problems.push('no objective text');
    if (!(t.timeLimit > 0)) row.problems.push('no time limit');
    if (!(t.par > 0)) row.problems.push('no par score');

    /* everything the player must reach has to be inside the barrier */
    for (const e of t.enemies) if (!inBounds(e, e.radius)) row.problems.push('enemy out of bounds');
    if (t.relic && !inBounds(t.relic, 40)) row.problems.push('relic out of bounds');
    if (t.delivery && !inBounds(t.delivery, t.delivery.r)) row.problems.push('delivery out of bounds');
    if (t.zone && !inBounds(t.zone, t.zone.r)) row.problems.push('zone out of bounds');
    for (const b of (t.blocks || [])) if (!inBounds(b, b.r)) row.problems.push('stone out of bounds');
    for (const pl of (t.plates || [])) if (!inBounds(pl, pl.r)) row.problems.push('plate out of bounds');
    for (const h of (t.hints || [])) if (!inBounds(h, 30)) row.problems.push('hint out of bounds');

    /* per-type: is the win condition actually formed? */
    if (spec_type(t) === 'defeat' && !(t.target > 0)) row.problems.push('defeat has no target');
    if (spec_type(t) === 'deliver' && !(t.relic && t.delivery)) row.problems.push('deliver missing relic or drop');
    if (spec_type(t) === 'puzzle') {
      if (t.blocks.length !== t.plates.length) row.problems.push('stones != plates');
      if (!t.blocks.length) row.problems.push('puzzle has no stones');
    }
    if (spec_type(t) === 'word' && !(t.riddle && t.riddle.options && t.riddle.options.length === 4)) {
      row.problems.push('riddle malformed');
    }
    if (spec_type(t) === 'word' && t.riddle && t.riddle.options.indexOf(t.riddle.answer) < 0) {
      row.problems.push('riddle answer not among the options');
    }
    if (spec_type(t) === 'seek') {
      const hiding = t.enemies.filter((e) => e.hiding).length;
      if (hiding < t.target) row.problems.push('fewer hidden enemies than the target (' + hiding + '/' + t.target + ')');
      row.cover = (t.cover || []).length;
      if (row.cover < t.target) row.problems.push('fewer cover spots than hidden enemies (' + row.cover + '/' + t.target + ')');
    }
    if (spec_type(t) === 'defend' && !t.zone) row.problems.push('defend has no zone');
    if (spec_type(t) === 'boss' && !t.boss) row.problems.push('boss trial has no boss');

    /* hardest enemy on the board, so scaling can be eyeballed across the run */
    let hp = 0, dmg = 0;
    for (const e of t.enemies) { hp = Math.max(hp, Math.round(e.maxHp)); dmg = Math.max(dmg, Math.round(e.damage)); }
    row.topHp = hp; row.topDmg = dmg;

    /* run it forward: a third of the clock, which is enough to shake out
       anything that only throws once waves spawn and things collide */
    try {
      t.introTimer = 0;
      t.state = 'play';
      const steps = Math.round((t.timeLimit / 3) * 60);
      for (let i = 0; i < steps && t.state === 'play'; i++) t.update(1 / 60);
      row.ranSeconds = Math.round(steps / 60);
      row.aliveAfter = t.enemies.filter((e) => !e.dead).length;
      if (t.zone) row.zoneHp = Math.round(t.zone.hp);
    } catch (e) {
      row.problems.push('update threw: ' + e.message);
    }
    rows.push(row);
  }

  function spec_type(t) { return t.type; }
  return rows;
});

await browser.close();

const bad = report.filter((r) => r.problems.length);
const byType = {};
for (const r of report) (byType[r.type] = byType[r.type] || []).push(r);

console.log('\nTrial sweep - ' + report.length + ' trials\n');
console.log('type      count  enemies      top hp        top dmg       limit');
for (const type of Object.keys(byType)) {
  const rs = byType[type];
  const rng = (k) => {
    const v = rs.map((r) => r[k] || 0);
    const lo = Math.min(...v), hi = Math.max(...v);
    return (lo === hi ? String(lo) : lo + '-' + hi);
  };
  console.log(
    type.padEnd(9), String(rs.length).padStart(3), '  ',
    rng('enemies').padEnd(11), rng('topHp').padEnd(13), rng('topDmg').padEnd(13), rng('limit'));
}

/* Does each type actually get harder across the run? A type whose hardest
   enemy never grows is the same trial at 43 as it was at 3. */
console.log('\nscaling across the run');
const flat = [];
for (const type of Object.keys(byType)) {
  const rs = byType[type].slice().sort((a, b) => a.trial - b.trial);
  if (rs.length < 2) continue;
  const first = rs[0], last = rs[rs.length - 1];
  const grew = (last.topHp || 0) > (first.topHp || 0) * 1.2;
  console.log('  ' + type.padEnd(9) +
    'trial ' + String(first.trial).padStart(2) + ' -> ' + String(last.trial).padStart(2) +
    '   top hp ' + String(first.topHp).padStart(4) + ' -> ' + String(last.topHp).padStart(4) +
    '   dmg ' + String(first.topDmg).padStart(2) + ' -> ' + String(last.topDmg).padStart(2) +
    '   limit ' + first.limit + ' -> ' + last.limit +
    (grew || type === 'defend' ? '' : '     <-- FLAT'));
  if (!grew && type !== 'defend') flat.push(type);   /* defend spawns in waves, not at setup */
}
if (flat.length) console.log('\n  flat types: ' + flat.join(', '));

const def = byType.defend || [];
if (def.length) {
  console.log('\ndefend trials, left undefended for a third of the clock');
  for (const r of def) {
    console.log('  trial ' + String(r.trial).padStart(2) +
      '  after ' + String(r.ranSeconds).padStart(3) + 's: ' +
      String(r.aliveAfter).padStart(2) + ' enemies alive, zone ' + r.zoneHp + '/100' +
      (r.zoneHp === 100 ? '   <-- never touched' : ''));
  }
}

if (boot.length) console.log('\nPAGE ERRORS ON BOOT:\n  ' + boot.join('\n  '));

if (!bad.length) {
  console.log('\nNo problems found in any trial.\n');
} else {
  console.log('\n' + bad.length + ' trial(s) with problems:\n');
  for (const r of bad) {
    console.log('  trial ' + String(r.trial).padStart(2) + '  ' + String(r.type).padEnd(8) +
      '  ' + [...new Set(r.problems)].join('; '));
  }
  console.log('');
}
process.exit(bad.length ? 1 : 0);
