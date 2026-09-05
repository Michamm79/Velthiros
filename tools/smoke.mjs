/* Velthiros - headless smoke test: boots the game, drives it through a full
   loop with real pointer input, and fails on any console/page error. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end('nope');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const errors = [];
const steps = [];
let failures = 0;

function check(name, ok, detail) {
  steps.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { server, port } = await serve();
  /* use a pre-installed Chromium when one is on disk, otherwise let Playwright
     resolve the browser it downloaded (which is what CI does) */
  const preinstalled = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const launchOpts = { args: ['--no-sandbox'] };
  if (fs.existsSync(preinstalled)) launchOpts.executablePath = preinstalled;
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 812, height: 400 }, deviceScaleFactor: 2 });

  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

  const zoneCenter = (id) => page.evaluate((zid) => {
    const z = (window.V.Input.lastZones || []).find((q) => q.id === zid);
    if (!z) return null;
    return z.r != null ? { x: z.x, y: z.y } : { x: z.x + z.w / 2, y: z.y + z.h / 2 };
  }, id);

  async function tapZone(id) {
    const c = await zoneCenter(id);
    if (!c) return false;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await wait(60);
    await page.mouse.up();
    await wait(200);
    return true;
  }

  const sceneName = () => page.evaluate(() => window.VELTHIROS.scene.constructor.name);

  /* poll rather than sleep a fixed amount - CI runners are slower than a dev box */
  async function waitForScene(name, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await sceneName()) === name) return true;
      await wait(100);
    }
    return false;
  }

  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await wait(900);

  check('game object exists', await page.evaluate(() => !!window.VELTHIROS));
  check('start screen renders', (await sceneName()) === 'StartScene');
  await shot('01-start');

  /* --- New Game via a real tap on the drawn button --- */
  check('tapped New Game', await tapZone('newgame'));
  check('bedroom intro scene', await waitForScene('RoomScene'), await sceneName());
  await shot('02-bedroom');

  /* walk around the bedroom with a drag on the left half (virtual joystick) */
  await page.mouse.move(120, 300);
  await page.mouse.down();
  await page.mouse.move(180, 250, { steps: 8 });
  await wait(600);
  await page.mouse.up();
  const moved = await page.evaluate(() => Math.abs(window.VELTHIROS.scene.px) + Math.abs(window.VELTHIROS.scene.py - 60));
  check('joystick moves the player', moved > 5, 'delta=' + Math.round(moved));

  /* fast-forward the mood intro */
  await page.evaluate(() => { window.VELTHIROS.scene.introTimer = 0.15; });
  check('abduction cutscene', await waitForScene('CutsceneScene'), await sceneName());
  await wait(2200);
  await shot('03-cutscene');
  await tapZone('skip');
  check('gem granted', await waitForScene('GemScene'), await sceneName());
  await shot('04-gem');
  await tapZone('continue');

  /* --- trial 1 --- */
  check('entered trial', await waitForScene('TrialScene'), await sceneName());
  await shot('05-trial-intro');
  await page.evaluate(() => { window.VELTHIROS.scene.trial.introTimer = 0.1; });
  await wait(500);

  /* drive the player for a few seconds: move + attack */
  await page.mouse.move(120, 300);
  await page.mouse.down();
  await page.mouse.move(150, 220, { steps: 6 });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('KeyJ');
    await wait(150);
  }
  await page.mouse.up();
  await wait(400);
  await shot('06-trial-combat');

  const trialState = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial;
    return { enemies: t.enemies.length, hp: t.player.hp, state: t.state, type: t.type, swipes: t.swipes.length };
  });
  check('trial has live enemies', trialState.enemies > 0, JSON.stringify(trialState));
  check('trial is playing', trialState.state === 'play', trialState.state);

  /* HUD zones are registered where a thumb expects them */
  const hudZones = await page.evaluate(() => (window.V.Input.lastZones || []).map((z) => z.id));
  check('HUD action buttons present', ['attack', 'special', 'dodge', 'item', 'pause'].every((z) => hudZones.includes(z)),
    hudZones.join(','));

  /* --- force a clean completion and check the ranking maths --- */
  await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial;
    t.timeLeft = t.timeLimit * 0.8;
    t.kills = 12;
    t.finish('complete');
  });
  check('ranking screen', await waitForScene('RankingScene'), await sceneName());
  const rank = await page.evaluate(() => window.VELTHIROS.pendingResult);
  check('rank percentile in range', rank.percentile >= 1 && rank.percentile <= 99, 'p=' + rank.percentile);
  await wait(1400);
  await shot('07-ranking');
  await tapZone('continue');
  check('back in hub', await waitForScene('RoomScene'), await sceneName());
  const hub = await page.evaluate(() => ({ mode: window.VELTHIROS.scene.mode, trial: window.VELTHIROS.save.trial, cur: window.VELTHIROS.save.currency }));
  check('hub mode + trial advanced', hub.mode === 'hub' && hub.trial === 2, JSON.stringify(hub));
  await shot('08-hub');

  /* --- shops --- */
  await page.evaluate(() => { window.VELTHIROS.save.currency = 5000; window.VELTHIROS.setScene(new window.V.S.ShopScene(window.VELTHIROS, 'trial')); });
  await wait(400);
  await shot('09-shop-trial');
  const bought = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const before = g.save.currency;
    const r = g.buy(window.V.D.TRIAL_SHOP.find((i) => i.id === 'w_bow'));
    return { ok: r.ok, spent: before - g.save.currency, weapon: g.save.weapon };
  });
  check('buying a weapon works', bought.ok && bought.spent === 240 && bought.weapon === 'bow', JSON.stringify(bought));

  await page.evaluate(() => window.VELTHIROS.setScene(new window.V.S.ShopScene(window.VELTHIROS, 'reality')));
  await wait(300);
  await shot('10-shop-reality');

  /* --- every trial type renders and simulates without throwing --- */
  const typeReport = await page.evaluate(async () => {
    const g = window.VELTHIROS;
    const out = [];
    const types = ['defeat', 'defend', 'deliver', 'puzzle', 'word', 'hide', 'seek'];
    for (const type of types) {
      const spec = { index: 12, type, boss: false, env: window.V.D.ENVIRONMENTS[0], seed: 1234, label: 'test ' + type };
      const t = new window.V.Trial(g, spec);
      t.state = 'play';
      for (let i = 0; i < 90; i++) t.update(1 / 60);
      t.render(g.ctx, g.cw, g.ch);
      window.V.HUD.draw(g.ctx, t, g.cw, g.ch);
      out.push({ type, enemies: t.enemies.length, par: Math.round(t.par), hasObjective: !!t.objective.text,
                 limit: Math.round(t.timeLimit), left: Math.round(t.timeLeft), state: t.state });
    }
    return out;
  });
  check('all 7 trial types build and simulate',
    typeReport.length === 7 && typeReport.every((r) => r.hasObjective && r.par > 0 && r.limit > 0),
    JSON.stringify(typeReport));
  check('every trial type starts with time on the clock',
    typeReport.every((r) => r.left > 0 && r.left <= r.limit),
    typeReport.map((r) => `${r.type}:${r.left}/${r.limit}`).join(' '));

  /* --- boss + final boss --- */
  const bossReport = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const out = [];
    for (const final of [false, true]) {
      const spec = { index: 5, type: 'boss', boss: true, finalBoss: final, env: window.V.D.ENVIRONMENTS[4], seed: 9, label: final ? 'Aurelith' : 'Reaper' };
      const t = new window.V.Trial(g, spec);
      t.state = 'play';
      for (let i = 0; i < 240; i++) t.update(1 / 60);
      t.render(g.ctx, g.cw, g.ch);
      out.push({ final, bossHp: Math.round(t.boss.hp), alive: !t.boss.dead,
                 state: t.state, left: Math.round(t.timeLeft), limit: Math.round(t.timeLimit) });
    }
    return out;
  });
  check('boss encounters run for their full timer',
    bossReport.length === 2 && bossReport.every((b) => b.bossHp > 0 && b.state === 'play' && b.left > b.limit - 6),
    JSON.stringify(bossReport));

  /* screenshot a boss fight properly */
  await page.evaluate(() => {
    const g = window.VELTHIROS;
    const spec = { index: 5, type: 'boss', boss: true, env: window.V.D.ENVIRONMENTS[4], seed: 9, label: 'Trial 5 - Reaper' };
    const t = new window.V.Trial(g, spec);
    t.introTimer = 0.05;
    g.setScene(new window.V.TrialScene(g, t));
  });
  await wait(1600);
  await shot('11-boss');

  /* --- a scripted bot actually plays a trial to completion --- */
  const botRun = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const U = window.V.U;
    const spec = { index: 3, type: 'defeat', boss: false, env: window.V.D.ENVIRONMENTS[0], seed: 77, label: 'bot run' };
    const t = new window.V.Trial(g, spec);
    t.state = 'play';
    const In = window.V.Input;
    const dt = 1 / 60;
    let frames = 0;
    while (t.state === 'play' && frames < 60 * 200) {
      const p = t.player;
      let best = null, bd = 1e9;
      for (const e of t.enemies) {
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const a = Math.atan2(best.y - p.y, best.x - p.x);
        const close = bd < 58;
        In.move.x = close ? 0 : Math.cos(a);
        In.move.y = close ? 0 : Math.sin(a);
        In.move.mag = close ? 0 : 1;
        p.facing = a;
        if (close) p.tryAttack(false);
        if (p.hp < p.stats.maxHp * 0.35) p.heal(0.6);   /* keep the bot alive long enough to measure */
      }
      t.update(dt);
      frames++;
    }
    In.move.x = 0; In.move.y = 0; In.move.mag = 0;
    return {
      kills: t.kills, target: t.target, state: t.state,
      reason: t.result && t.result.reason, percentile: t.result && t.result.percentile,
      outcome: t.result && t.result.tier.outcome, seconds: Math.round(frames / 60)
    };
  });
  check('a bot can fight and finish a Defeat trial',
    botRun.state === 'done' && botRun.kills >= botRun.target && botRun.reason === 'complete',
    JSON.stringify(botRun));
  check('finishing well lands in a paying tier', botRun.outcome === 'reward' || botRun.outcome === 'neutral',
    botRun.outcome + ' at p' + botRun.percentile);

  /* --- every authored sprite bakes cleanly against the locked palette --- */
  const sprites = await page.evaluate(() => {
    const Spr = window.V.Spr, Px = window.V.Px;
    const problems = [];
    let count = 0;
    const check = (spr, name) => {
      count++;
      if (!spr || !spr.canvas) { problems.push(name + ': did not bake'); return; }
      if (!spr.w || !spr.h) problems.push(name + ': zero size');
      Px.validate(spr, name).forEach((p) => problems.push(p));
    };
    for (const dir of ['down', 'up', 'side']) {
      for (const f of [0, 1, 2]) {
        check(Spr.player(dir, f, '#3d6fa8'), `player:${dir}:${f}`);
        check(Spr.goblin(dir, f), `goblin:${dir}:${f}`);
        check(Spr.minotaur(dir, f), `minotaur:${dir}:${f}`);
        check(Spr.reaper(dir, f), `reaper:${dir}:${f}`);
      }
    }
    check(Spr.aurelith(0), 'aurelith:0');
    check(Spr.aurelith(1), 'aurelith:1');
    for (const k of ['tree', 'pine', 'cactus', 'crate', 'fence', 'wall', 'rock',
                     'flower', 'fern', 'tuft', 'stone', 'relic', 'hint',
                     'bush', 'snowbush', 'shrub']) {
      check(Spr.prop(k, 1), 'prop:' + k);
    }
    for (const w of ['sword', 'battleaxe', 'bow', 'scythe']) check(Spr.weapon(w), 'weapon:' + w);
    for (const e of window.V.D.ENVIRONMENTS) check(Spr.groundTile(e.id), 'ground:' + e.id);
    return { count, problems };
  });
  check('every sprite bakes against the locked palette',
    sprites.problems.length === 0, sprites.count + ' sprites; ' + sprites.problems.slice(0, 4).join(' | '));

  /* --- pushing a stone with the joystick off-centre must not slide you past --- */
  const push = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D, In = window.V.Input;
    const spec = { index: 6, type: 'puzzle', boss: false, env: D.ENVIRONMENTS[0], seed: 5, label: 'push test' };
    const t = new window.V.Trial(g, spec);
    t.state = 'play';
    t.enemies.length = 0;                       /* isolate the mechanic */
    const b = t.blocks[0];
    const p = t.player;

    /* stone due east; the player approaches it 22 units off the centre line */
    b.x = 300; b.y = 0;
    p.x = 300 - (b.r + p.radius) - 8;
    p.y = 22;
    const startX = b.x, startY = b.y;

    In.move.x = 1; In.move.y = 0.28; In.move.mag = 1;   /* joystick slightly off, as reported */
    for (let i = 0; i < 120; i++) t.update(1 / 60);
    const pushed = {
      travelled: Math.round(b.x - startX),
      drift: Math.round(Math.abs(b.y - startY)),
      behind: p.x < b.x,
      offCentre: Math.round(Math.abs(p.y - b.y)),
      locked: !!t.push
    };

    /* and brushing past a stone sideways must not move it at all */
    t.push = null;
    b.x = 300; b.y = 0;
    p.x = 300 - (b.r + p.radius) + 2;
    p.y = 0;
    const brushFrom = b.x;
    In.move.x = 0; In.move.y = 1; In.move.mag = 1;      /* moving perpendicular, grazing it */
    for (let j = 0; j < 60; j++) t.update(1 / 60);
    In.move.x = 0; In.move.y = 0; In.move.mag = 0;
    pushed.brushShift = Math.round(Math.abs(b.x - brushFrom));
    return pushed;
  });
  check('an off-centre push moves the stone straight and keeps the player behind it',
    push.travelled > 100 && push.drift <= 2 && push.behind && push.offCentre <= 4 && push.locked,
    JSON.stringify(push));
  check('brushing past a stone does not move it', push.brushShift === 0, 'shift=' + push.brushShift);

  /* --- the top tier must be REACHABLE on every trial type.
         Puzzle trials once had a ceiling of top 31%, so a perfect solve still
         read as a failure. This asserts no type is unwinnable by construction. --- */
  const ceilings = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D;
    const out = [];
    const types = ['defeat', 'defend', 'deliver', 'puzzle', 'word', 'hide', 'seek'];
    for (const type of types) {
      const spec = { index: 8, type, boss: false, env: D.ENVIRONMENTS[0], seed: 99, label: type };
      const t = new window.V.Trial(g, spec);

      /* What a perfect run of THIS type actually looks like. Defend and Hide
         are survival trials, so they always end with the clock at zero — using
         "finished early" for them would model something impossible. */
      const timed = (type === 'defend' || type === 'hide');
      t.player.damageTaken = 0;
      t.kills = timed ? Math.round(t.timeLimit / 3) : t.enemies.length;
      t.timeLeft = timed ? 0 : t.timeLimit * 0.75;
      t.spottedTime = 0;
      if (t.zone) t.zone.hp = t.zone.maxHp;
      if (t.plates) t.plates.forEach((p) => { p.filled = true; });
      if (t.riddle) { t.riddle.revealed = 3; t.riddle.correct = true; }
      t.finish('complete');
      const good = t.result.percentile;

      /* and a scrape-through: slow, battered, barely holding on */
      const t2 = new window.V.Trial(g, spec);
      t2.player.damageTaken = 90;
      t2.kills = timed ? Math.round(t2.timeLimit / 12) : 0;
      t2.timeLeft = timed ? 0 : t2.timeLimit * 0.05;
      t2.spottedTime = t2.timeLimit * 0.7;
      if (t2.zone) t2.zone.hp = t2.zone.maxHp * 0.25;
      if (t2.plates) t2.plates.forEach((p) => { p.filled = true; });
      if (t2.riddle) { t2.riddle.revealed = 3; t2.riddle.correct = true; }
      t2.finish('complete');
      out.push({ type, best: good, poor: t2.result.percentile });
    }
    return out;
  });
  const unreachable = ceilings.filter((c) => c.best > 25);
  const tooEasy = ceilings.filter((c) => c.poor <= 25);
  console.log('      ceilings: ' + ceilings.map((c) => `${c.type} ${c.best}/${c.poor}`).join('  '));
  check('a flawless run reaches the top 25% on every trial type',
    unreachable.length === 0,
    unreachable.map((c) => c.type + ' caps at top ' + c.best + '%').join(', '));
  check('a sloppy run does not reach the top 25% on any trial type',
    tooEasy.length === 0,
    tooEasy.map((c) => c.type + ' pays at top ' + c.poor + '%').join(', '));

  /* --- the reported case: someone who knows the puzzle layout, solves it
         carefully but unhurriedly and takes no hits, should be paid. --- */
  const puzzleRuns = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D;
    const run = (opts) => {
      const spec = { index: 4, type: 'puzzle', boss: false, env: D.ENVIRONMENTS[0], seed: 21, label: 'puzzle' };
      const t = new window.V.Trial(g, spec);
      t.plates.forEach((p) => { p.filled = opts.solved !== false; });
      t.kills = opts.kills || 0;
      t.player.damageTaken = opts.damage || 0;
      t.timeLeft = t.timeLimit * (opts.timeFrac == null ? 0.2 : opts.timeFrac);
      t.finish(opts.solved === false ? 'timeout' : 'complete');
      return t.result.percentile;
    };
    return {
      unhurriedClean: run({ timeFrac: 0.2, kills: 0, damage: 0 }),
      unhurriedFought: run({ timeFrac: 0.2, kills: 3, damage: 0 }),
      fastClean: run({ timeFrac: 0.7, kills: 3, damage: 0 }),
      battered: run({ timeFrac: 0.2, kills: 1, damage: 120 }),
      timedOutPartial: run({ solved: false, timeFrac: 0, kills: 1, damage: 40 })
    };
  });
  console.log('      puzzle: ' + Object.entries(puzzleRuns).map(([k, v]) => `${k}=top${v}%`).join('  '));
  check('an unhurried, undamaged puzzle solve is paid',
    puzzleRuns.unhurriedClean <= 25, 'top ' + puzzleRuns.unhurriedClean + '%');
  check('a battered puzzle solve is not paid, and a timeout fails',
    puzzleRuns.battered > 25 && puzzleRuns.timedOutPartial > 40,
    `battered=${puzzleRuns.battered} timeout=${puzzleRuns.timedOutPartial}`);

  /* --- balance probe: how does a competent run rank across trial types? --- */
  const probe = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const U = window.V.U;
    const In = window.V.Input;
    const out = [];
    for (const [type, hurt] of [['defeat', 0], ['defeat', 45], ['deliver', 0], ['seek', 0], ['defend', 0]]) {
      const spec = { index: 8, type, boss: false, env: window.V.D.ENVIRONMENTS[0], seed: 512, label: type };
      const t = new window.V.Trial(g, spec);
      t.state = 'play';
      const dt = 1 / 60;
      let frames = 0;
      while (t.state === 'play' && frames < 60 * 220) {
        const p = t.player;
        /* head for the objective when there is one, otherwise the nearest enemy */
        let tx = null, ty = null, melee = false;
        if (t.relic && !t.relic.taken) { tx = t.relic.x; ty = t.relic.y; }
        else if (t.relic && t.relic.taken) { tx = t.delivery.x; ty = t.delivery.y; }
        else {
          let best = null, bd = 1e9;
          for (const e of t.enemies) { const d = U.dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
          if (best) { tx = best.x; ty = best.y; melee = bd < 58; }
        }
        if (tx != null) {
          const a = Math.atan2(ty - p.y, tx - p.x);
          In.move.x = melee ? 0 : Math.cos(a);
          In.move.y = melee ? 0 : Math.sin(a);
          In.move.mag = melee ? 0 : 1;
          p.facing = a;
          if (melee) p.tryAttack(false);
        } else { In.move.mag = 0; In.move.x = 0; In.move.y = 0; }
        /* hold the bot at a fixed health so the probe measures play, not luck */
        p.hp = Math.max(1, p.stats.maxHp - hurt);
        p.damageTaken = hurt;
        t.update(dt);
        frames++;
      }
      In.move.x = 0; In.move.y = 0; In.move.mag = 0;
      out.push({ type, hurt, p: t.result ? t.result.percentile : null,
                 tier: t.result ? t.result.tier.id : null, reason: t.result && t.result.reason });
    }
    return out;
  });
  console.log('      balance: ' + probe.map((r) => `${r.type}${r.hurt ? '+dmg' : ''}=top${r.p}%(${r.tier})`).join('  '));
  check('ranking spreads across tiers rather than always paying out',
    probe.every((r) => r.p >= 1 && r.p <= 99) && new Set(probe.map((r) => r.tier)).size > 1,
    JSON.stringify(probe));

  /* --- failing a trial repeats it and can apply a debuff (GDD 6.2) --- */
  const failFlow = await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.save.deaths = 0;
    g.save.trial = 7;
    const before = g.save.trial;
    g.onTrialFinished({
      reason: 'death', died: true, completed: false, score: 10, par: 500, percentile: 80,
      tier: window.V.D.RANK_TIERS[2], kills: 0, timeLeft: 0, damageTaken: 100, bonusCoins: 0,
      trial: { index: 7, label: 'Trial 7' }
    });
    const deaths = g.save.deaths;
    g.leaveRanking();
    return { before, after: g.save.trial, deaths, scene: g.scene.constructor.name, debuff: g.save.debuff };
  });
  check('death repeats the same trial and counts toward the wipe',
    failFlow.after === failFlow.before && failFlow.deaths === 1 && failFlow.scene === 'TrialScene',
    JSON.stringify(failFlow));

  const wipeFlow = await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.save.deaths = window.V.D.DEATH_LIMIT;
    g.pendingResult = { tier: window.V.D.RANK_TIERS[2], trial: { index: 7 } };
    g.leaveRanking();
    return g.scene.constructor.name;
  });
  check('the 25th death routes to the full reset', wipeFlow === 'ResetScene', wipeFlow);

  /* --- the scythe unlock (GDD 7.1) --- */
  const scythe = await page.evaluate(async () => {
    const g = window.VELTHIROS;
    g.save.scytheUnlocked = false;
    g.save.weapons.scythe = false;
    const start = new window.V.S.StartScene(g);
    g.setScene(start);
    start.idle = g.idleUnlockSeconds + 1;
    start.update(0.016);
    const shown = start.promptShown;
    for (const dir of start.combo) start.pressDir(dir);
    return { shown, unlocked: g.save.scytheUnlocked, weapon: g.save.weapon, comboLen: start.combo.length };
  });
  check('scythe unlock prompt + combo', scythe.shown && scythe.unlocked && scythe.weapon === 'scythe', JSON.stringify(scythe));

  await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.save.scytheUnlocked = false; g.save.weapons.scythe = false;
    const s = new window.V.S.StartScene(g);
    g.setScene(s);
    s.idle = g.idleUnlockSeconds + 1;
    s.update(0.016);
  });
  await wait(400);
  await shot('12-scythe-prompt');

  /* --- reset rules (GDD 9) --- */
  const reset = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const D = window.V.D;
    g.save.currency = 999; g.save.deaths = 25;
    g.save = window.V.Save.fullReset(g.save);
    const wiped = { currency: g.save.currency, deaths: g.save.deaths,
                    scythe: g.save.scytheUnlocked, resets: g.save.resets };

    /* the combo is pinned for playtesting; check it holds, then check the
       GDD's reroll still works with the pin lifted */
    const pinned = D.FIXED_COMBO_INDEX != null;
    const heldPin = !pinned || g.save.comboIndex === D.FIXED_COMBO_INDEX;
    const saved = D.FIXED_COMBO_INDEX;
    D.FIXED_COMBO_INDEX = null;
    let rerolled = true;
    for (let i = 0; i < 12 && rerolled; i++) {
      const before = g.save.comboIndex;
      g.save = window.V.Save.fullReset(g.save);
      rerolled = g.save.comboIndex !== before;
    }
    D.FIXED_COMBO_INDEX = saved;
    return Object.assign(wiped, { pinned, heldPin, rerolled });
  });
  check('25 deaths wipes the run; combo pin holds and the random reroll works',
    reset.currency === 0 && reset.deaths === 0 && !reset.scythe && reset.heldPin && reset.rerolled,
    JSON.stringify(reset));

  /* --- ranking tier boundaries match GDD 6.2 --- */
  const tiers = await page.evaluate(() => {
    const D = window.V.D;
    const pick = (p) => D.RANK_TIERS.find((t) => p <= t.max).outcome;
    return { at10: pick(10), at25: pick(25), at30: pick(30), at40: pick(40), at41: pick(41) };
  });
  check('rank tiers: <=25 reward, 26-40 neutral, >40 fail',
    tiers.at10 === 'reward' && tiers.at25 === 'reward' && tiers.at30 === 'neutral' &&
    tiers.at40 === 'neutral' && tiers.at41 === 'fail', JSON.stringify(tiers));

  /* --- portrait layout still lays out --- */
  await page.setViewportSize({ width: 390, height: 780 });
  await wait(500);
  await page.evaluate(() => window.VELTHIROS.setScene(new window.V.S.StartScene(window.VELTHIROS)));
  await wait(400);
  await shot('13-portrait-start');

  check('no runtime errors', errors.length === 0, errors.slice(0, 6).join(' | '));

  /* --- the bundled single-file build boots straight off the filesystem --- */
  if (fs.existsSync(path.join(ROOT, 'dist', 'velthiros.html'))) {
    const distErrors = [];
    const dp = await browser.newPage({ viewport: { width: 812, height: 400 } });
    dp.on('pageerror', (e) => distErrors.push(e.message));
    dp.on('console', (m) => { if (m.type() === 'error') distErrors.push(m.text()); });
    await dp.goto('file://' + path.join(ROOT, 'dist', 'velthiros.html'));
    await wait(1200);
    const distState = await dp.evaluate(() => ({
      scene: window.VELTHIROS && window.VELTHIROS.scene.constructor.name,
      zones: (window.V.Input.lastZones || []).map((z) => z.id)
    }));
    await dp.close();
    check('single-file build boots from file:// with no errors',
      distState.scene === 'StartScene' && distState.zones.includes('newgame') && distErrors.length === 0,
      JSON.stringify(distState) + ' ' + distErrors.slice(0, 3).join(' | '));
  } else {
    console.log('SKIP  single-file build (run npm run build first)');
  }

  await browser.close();
  server.close();

  console.log('\n' + (failures ? `${failures} FAILURE(S)` : 'all checks passed') + `  (${steps.length} checks)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
