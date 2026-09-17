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

  /* fast-forward the mood intro: bedroom -> crowded square */
  await page.evaluate(() => { window.VELTHIROS.scene.introTimer = 0.15; });
  check('bedroom leads to the crowded square', await waitForScene('SquareScene'), await sceneName());
  await wait(900);
  await shot('03-square');
  const square = await page.evaluate(() => {
    const s = window.VELTHIROS.scene;
    return { crowd: s.crowd.length, phase: s.phase, stage: window.VELTHIROS.save.tutorialStage };
  });
  check('the square is crowded and walkable',
    square.crowd >= 20 && square.phase === 'walk' && square.stage === 'square', JSON.stringify(square));

  /* walking to the middle brings Garatu through */
  await page.evaluate(() => {
    const s = window.VELTHIROS.scene;
    s.t = 3; s.px = s.meet.x; s.py = s.meet.y;
  });
  await wait(600);
  const arrival = await page.evaluate(() => window.VELTHIROS.scene.phase);
  check('reaching the middle opens the rift', arrival !== 'walk', arrival);
  await wait(1200);                                    /* let Garatu fade in */
  await shot('04-square-rift');

  await tapZone('skip');
  check('the fall cutscene plays', await waitForScene('CutsceneScene'), await sceneName());
  await wait(1800);
  await shot('05-cutscene-fall');
  await tapZone('skip');

  /* --- the tutorial trial --- */
  check('the fall lands in the tutorial', await waitForScene('TrialScene'), await sceneName());
  const tut = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial;
    return {
      type: t.type, untimed: t.untimed, radius: t.radius, prompt: !!t.persistentPrompt,
      beat: t.tut.beatId, weapon: t.player.weaponId, hasObjective: !!t.objective.text,
      env: t.env.id, stage: window.VELTHIROS.save.tutorialStage
    };
  });
  check('the tutorial builds as an untimed, unarmed first beat',
    tut.type === 'tutorial' && tut.untimed === true && tut.radius === 700 && tut.prompt &&
    tut.beat === 'move' && tut.weapon === 'none' && tut.hasObjective && tut.env === 'drained',
    JSON.stringify(tut));

  await page.evaluate(() => { window.VELTHIROS.scene.trial.introTimer = 0.1; });
  await wait(500);
  await shot('06-tutorial-move');

  /* Buttons a beat has not taught yet must be inert, not merely greyed out -
     so this presses them through the real input path, not p.tryAttack(). */
  const lockCheck = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial;
    const In = window.V.Input;
    const p = t.player;
    p.atkState = null; p.stamina = 100;
    const locked = Object.keys(t.lockedActions);
    In.down.attack = true; In.down.dodge = true; In.down.special = true;
    t.update(1 / 60);
    const blocked = { atkState: p.atkState, dodgeTime: p.dodgeTime, stamina: Math.round(p.stamina) };
    In.down = {}; In.activeZones = [];
    t.update(1 / 60);
    return { locked, blocked };
  });
  check('an action the tutorial has not taught yet cannot be pressed',
    lockCheck.locked.length === 4 && lockCheck.blocked.atkState === null &&
    lockCheck.blocked.dodgeTime <= 0 && lockCheck.blocked.stamina === 100,
    JSON.stringify(lockCheck));

  /* HUD zones are registered where a thumb expects them */
  const hudZones = await page.evaluate(() => (window.V.Input.lastZones || []).map((z) => z.id));
  check('HUD action buttons present', ['attack', 'special', 'dodge', 'item', 'pause'].every((z) => hudZones.includes(z)),
    hudZones.join(','));

  /* Walk the whole script: each beat is satisfied on its own terms and the
     order is asserted, so a beat cannot be skipped or fire early. */
  const beatWalk = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const t = g.scene.trial;
    const T = window.V.Tutorial;
    const order = [];
    const step = () => { for (let i = 0; i < 4; i++) t.update(1 / 60); };

    const guard = (id) => order.push({ want: id, got: t.tut.beatId });
    guard('move');
    /* 1. move: stand on the waypoint */
    t.player.x = t.tut.waypoint.x; t.player.y = t.tut.waypoint.y;
    step(); guard('weapon');
    /* 2. weapon: take the BATTLEAXE. Deliberately not the sword - a blank save
       already reads `weapon: 'sword'`, so only a non-default pick can show
       that nothing has been written yet. A pedestal is a fitting, so an
       accidental circle has to cost nothing. */
    t.player.x = t.tut.picks[1].x; t.player.y = t.tut.picks[1].y;
    step();
    const firstPick = { player: t.player.weaponId, save: g.save.weapon,
                        owns: Object.keys(g.save.weapons).filter((k) => g.save.weapons[k]) };
    guard('strike');
    /* 3. strike: the dummy must be inert - it should never have moved */
    const dummy = t.tut.dummy;
    const dummyStart = { x: dummy.x, y: dummy.y };
    for (let i = 0; i < 120; i++) t.update(1 / 60);
    const dummyMoved = Math.abs(dummy.x - dummyStart.x) + Math.abs(dummy.y - dummyStart.y);
    const stillStrike = t.tut.beatId === 'strike';
    /* try the sword mid-beat, then the bow, then go back to the battleaxe -
       this is the "I stepped in the wrong circle, let me try them" path */
    t.player.x = t.tut.picks[0].x; t.player.y = t.tut.picks[0].y;
    step();
    const swapped = { player: t.player.weaponId, save: g.save.weapon };
    t.player.x = t.tut.picks[2].x; t.player.y = t.tut.picks[2].y;
    step();
    const swappedAgain = t.player.weaponId;
    /* settle on the battleaxe, which is what should actually be granted */
    t.player.x = t.tut.picks[1].x; t.player.y = t.tut.picks[1].y;
    step();
    const dummySurvived = !dummy.dead;
    for (let h = 0; h < 3; h++) dummy.hurt(5, 0, 0, t.player);
    step(); guard('fight');
    /* 4. fight: both goblins down */
    t.tut.foes.forEach((f) => f.hurt(999, 0, 0, t.player));
    step(); guard('dodge');
    /* 5. dodge: two rolls */
    t.player.stamina = 100; t.player.tryDodge();
    t.player.dodgeTime = 0; t.player.dodgeCd = 0; t.player.stamina = 100;
    const halfWay = t.tut.beatId;
    t.player.tryDodge();
    t.player.dodgeTime = 0;
    step(); guard('hide');
    /* 6. hide: stand still in the cover the beat planted. `hidden` is
       recomputed from the world every frame, so this has to be real. */
    window.V.Input.move.x = 0; window.V.Input.move.y = 0; window.V.Input.move.mag = 0;
    t.player.x = t.tut.hideSpot.x; t.player.y = t.tut.hideSpot.y;
    let wasHidden = false;
    for (let i = 0; i < 130 && t.tut.beatId === 'hide'; i++) {
      t.player.x = t.tut.hideSpot.x; t.player.y = t.tut.hideSpot.y;
      t.update(1 / 60);
      wasHidden = wasHidden || t.player.hidden;
    }
    guard('gem');
    /* 7. gem: walk onto it. Picking it up raises a card that HOLDS the trial
       until it is acknowledged - that is the whole point of the card, so the
       walkthrough has to tap it the way a player does. `cardHeld` proves it
       actually blocked rather than flashing past. */
    t.player.x = t.tut.gemSpot.x; t.player.y = t.tut.gemSpot.y;
    step();
    const cardHeld = !!t.card;
    const cardBody = t.card ? (t.card.title + ' | ' + t.card.body) : null;
    if (t.card) { const before = t.tut.beatId; t.update(1 / 60); var cardFroze = t.tut.beatId === before; }
    t.dismissCard();
    step();
    const gem = g.save.gem && g.save.gem.id;
    /* the gem beat closes the pedestals - only now is the weapon really yours */
    const committed = { save: g.save.weapon, player: t.player.weaponId,
                        owns: Object.keys(g.save.weapons).filter((k) => g.save.weapons[k]),
                        locked: !!t.tut.weaponLocked,
                        ringsHidden: t.tut.picks.every((m) => m.hidden) };
    /* standing on a closed pedestal must no longer change anything */
    t.player.x = t.tut.picks[2].x; t.player.y = t.tut.picks[2].y;
    step();
    committed.afterClosed = t.player.weaponId;
    guard('warden');
    return {
      order, firstPick, swapped, swappedAgain, dummySurvived, committed,
      dummyMoved: Math.round(dummyMoved), stillStrike, halfWay, gem, wasHidden,
      cardHeld, cardFroze, cardBody,
      wardenAlive: !!t.tut.warden && !t.tut.warden.dead
    };
  });
  const beatsInOrder = beatWalk.order.every((o) => o.want === o.got);
  check('the beats advance in order, and only when their own test passes',
    beatsInOrder && beatWalk.stillStrike && beatWalk.halfWay === 'dodge',
    JSON.stringify(beatWalk.order));
  check('a pedestal only lends the weapon - nothing reaches the save yet',
    beatWalk.firstPick.player === 'battleaxe' && beatWalk.firstPick.save === 'sword' &&
    beatWalk.firstPick.owns.join(',') === 'sword',
    JSON.stringify(beatWalk.firstPick));
  check('you can walk back and swap weapons, including mid-beat',
    beatWalk.swapped.player === 'sword' && beatWalk.swappedAgain === 'bow' &&
    beatWalk.swapped.save === 'sword',
    JSON.stringify({ swapped: beatWalk.swapped, then: beatWalk.swappedAgain }));
  check('the dummy outlasts a weapon, so all three can be tried on it',
    beatWalk.dummySurvived === true);
  check('only the weapon you walk away with is granted, and the pedestals then close',
    beatWalk.committed.save === 'battleaxe' && beatWalk.committed.player === 'battleaxe' &&
    beatWalk.committed.owns.sort().join(',') === 'battleaxe,sword' &&
    beatWalk.committed.locked && beatWalk.committed.ringsHidden &&
    beatWalk.committed.afterClosed === 'battleaxe',
    JSON.stringify(beatWalk.committed));
  check('the training dummy never moves or fights back', beatWalk.dummyMoved === 0,
    'drifted ' + beatWalk.dummyMoved + 'u');
  check('the hide beat plants cover you can actually vanish into', beatWalk.wasHidden === true);
  check('the gem is granted by its beat', !!beatWalk.gem, String(beatWalk.gem));
  /* The gem used to be announced in the same 4.5s banner as 'Hint 2/3 found'
     and was routinely missed entirely. It raises a card now, and the card has
     to actually stop the trial - a card that does not block is just a banner
     with a button on it. */
  check('the gem stops the trial and explains itself',
    beatWalk.cardHeld && beatWalk.cardFroze &&
    /level/i.test(beatWalk.cardBody || '') && /reset/i.test(beatWalk.cardBody || ''),
    beatWalk.cardBody || 'no card');
  check('the Warden is waiting at the last beat', beatWalk.wardenAlive);
  await shot('07-tutorial-warden');

  /* dying in the tutorial revives rather than ending the run */
  const tutDeath = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const t = g.scene.trial;
    g.save.deaths = 0;
    t.player.hp = 0; t.player.dead = true;
    for (let i = 0; i < 6; i++) t.update(1 / 60);
    return { dead: t.player.dead, hp: Math.round(t.player.hp), state: t.state,
             deaths: g.save.deaths, scene: g.scene.constructor.name };
  });
  check('a tutorial death revives you and never counts toward the wipe',
    !tutDeath.dead && tutDeath.hp > 0 && tutDeath.state === 'play' && tutDeath.deaths === 0,
    JSON.stringify(tutDeath));

  /* killing the Warden hands over the scythe under the secret's rules */
  const wardenKill = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const t = g.scene.trial;
    if (!t.tut.warden || t.tut.warden.dead) t.tut.warden = t.spawnEnemy('warden', 0, -300, {});
    t.tut.warden.hurt(9999, 0, 0, t.player);
    for (let i = 0; i < 4; i++) t.update(1 / 60);
    const earned = { unlocked: g.save.scytheUnlocked, weapon: g.save.weapon };
    const after = window.V.Save.newGame(g.save);
    return { earned, afterNewGame: { unlocked: after.scytheUnlocked, weapon: after.weapon } };
  });
  check('the Warden drops the scythe, and a New Game takes it away again',
    wardenKill.earned.unlocked && wardenKill.earned.weapon === 'scythe' &&
    !wardenKill.afterNewGame.unlocked && wardenKill.afterNewGame.weapon === 'sword',
    JSON.stringify(wardenKill));

  /* reaching the gate ends the tutorial - no ranking screen, straight home */
  const tutEnd = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const t = g.scene.trial;
    t.player.x = t.tut.gate.x; t.player.y = t.tut.gate.y;
    for (let i = 0; i < 6; i++) t.update(1 / 60);
    return { scene: g.scene.constructor.name, mode: g.scene.mode,
             done: g.save.tutorialDone, stage: g.save.tutorialStage, deaths: g.save.deaths };
  });
  check('walking into the gate finishes the tutorial and lands in the hub',
    tutEnd.scene === 'RoomScene' && tutEnd.mode === 'hub' && tutEnd.done === true &&
    tutEnd.stage === null && tutEnd.deaths === 0,
    JSON.stringify(tutEnd));
  await shot('08-hub-after-tutorial');

  /* --- trial 1, the real thing --- */
  await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.save.weapons = { sword: true };
    g.save.weapon = 'sword';
    g.enterTrial();
  });
  check('entered trial', await waitForScene('TrialScene'), await sceneName());
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
  await shot('09-trial-combat');

  const trialState = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial;
    return { enemies: t.enemies.length, hp: t.player.hp, state: t.state, type: t.type, swipes: t.swipes.length };
  });
  check('trial has live enemies', trialState.enemies > 0, JSON.stringify(trialState));
  check('trial is playing', trialState.state === 'play', trialState.state);

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
  await shot('10-ranking');
  await tapZone('continue');
  check('back in hub', await waitForScene('RoomScene'), await sceneName());
  const hub = await page.evaluate(() => ({ mode: window.VELTHIROS.scene.mode, trial: window.VELTHIROS.save.trial, cur: window.VELTHIROS.save.currency }));
  check('hub mode + trial advanced', hub.mode === 'hub' && hub.trial === 2, JSON.stringify(hub));
  await shot('11-hub');

  /* --- shops --- */
  await page.evaluate(() => { window.VELTHIROS.save.currency = 5000; window.VELTHIROS.setScene(new window.V.S.ShopScene(window.VELTHIROS, 'trial')); });
  await wait(400);
  await shot('12-shop-trial');
  const bought = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const before = g.save.currency;
    const r = g.buy(window.V.D.TRIAL_SHOP.find((i) => i.id === 'w_bow'));
    return { ok: r.ok, spent: before - g.save.currency, weapon: g.save.weapon };
  });
  check('buying a weapon works', bought.ok && bought.spent === 240 && bought.weapon === 'bow', JSON.stringify(bought));

  await page.evaluate(() => window.VELTHIROS.setScene(new window.V.S.ShopScene(window.VELTHIROS, 'reality')));
  await wait(300);
  await shot('13-shop-reality');

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
  await shot('14-boss');

  /* --- a scripted bot actually plays a trial to completion ---
         The arena layout is seeded, but the FIGHT was not: evasion is a
         Math.random roll, and every enemy picks its facing, its anim phase and
         its wander heading the same way. So the bot's clear time drifted by
         several seconds between runs, and since a Defeat clear scores around
         the 40% line - the boundary between 'neutral' and 'fail' - the
         paying-tier check below failed roughly one run in five. It did so on
         CI while this branch was in flight, at p43.

         Seeding Math.random for the duration of the run fixes that at the
         cause rather than by widening the threshold, which would have made the
         check stop meaning anything. The stub is restored in a finally, so
         nothing after this point inherits it. */
  const botRun = await page.evaluate(() => {
    const g = window.VELTHIROS;
    const U = window.V.U;
    const realRandom = Math.random;
    let seed = 0x9e3779b9;
    Math.random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1000003) / 1000003;
    };
    /* And pin the gem. Finishing a trial grants one at random, so by the time
       the bot runs the player is carrying whichever of the six turned up, and
       a rootstone (+12 max HP) against an emberstone (damage) moves the clear
       time by ten seconds - most of the gap between p17 and p35 that this
       check used to swing across. Stats are read off the save when the Trial
       is built, so it has to be set before that. Emberstone, because what the
       check is about is fighting well. */
    const realGem = g.save.gem, realGemLevel = g.save.gemLevel;
    g.save.gem = { id: 'emberstone' };
    try {
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
    } finally {
      Math.random = realRandom;
      g.save.gem = realGem; g.save.gemLevel = realGemLevel;
    }
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
        check(Spr.player(dir, f, '#17141c'), `player:${dir}:${f}`);
        for (const oid in window.V.D.OUTFITS) {
          check(Spr.player(dir, f, '#17141c', oid), `player:${dir}:${f}:${oid}`);
        }
        check(Spr.civilian(dir, f, '#a8563d'), `civilian:${dir}:${f}`);
        /* Driven from the roster rather than a hand-kept list. The list was
           how four new enemies reached the game without a single one of their
           sprites ever being palette-checked: adding to D.ROSTER now enrolls
           an enemy here automatically. Bosses are not in the roster, so they
           are named. */
        for (const e of window.V.D.ROSTER) check(Spr[e.id](dir, f), `${e.id}:${dir}:${f}`);
        check(Spr.reaper(dir, f), `reaper:${dir}:${f}`);
        check(Spr.warden(dir, f), `warden:${dir}:${f}`);
      }
    }
    check(Spr.aurelith(0), 'aurelith:0');
    check(Spr.aurelith(1), 'aurelith:1');
    for (const k of ['tree', 'pine', 'cactus', 'crate', 'fence', 'wall', 'rock',
                     'flower', 'fern', 'tuft', 'stone', 'relic', 'hint',
                     'bush', 'snowbush', 'shrub',
                     'pedestal', 'dummy', 'lamp', 'bench', 'kiosk', 'gate', 'gem']) {
      check(Spr.prop(k, 1), 'prop:' + k);
    }
    for (const w of ['sword', 'battleaxe', 'bow', 'scythe', 'none']) check(Spr.weapon(w), 'weapon:' + w);
    for (const e of window.V.D.ENVIRONMENTS) check(Spr.groundTile(e.id), 'ground:' + e.id);
    for (const k of Object.keys(window.V.D.TUTORIAL_ENVS)) check(Spr.groundTile(k), 'ground:' + k);
    return { count, problems };
  });
  check('every sprite bakes against the locked palette',
    sprites.problems.length === 0, sprites.count + ' sprites; ' + sprites.problems.slice(0, 4).join(' | '));

  /* --- the title screen's key art is the sprite the game actually plays,
         drawn once, at an integer scale so its pixels stay square --- */
  const onTitle = await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.setScene(new window.V.S.StartScene(g));
    const hero = window.V.Spr.player('down', 0, g.playerTint());
    const hits = [];
    const real = window.V.Px.draw;
    window.V.Px.draw = function (ctx, spr, x, y, opts) {
      if (spr === hero) hits.push({ y: y, scale: (opts && opts.scale) || 1 });
      return real.apply(this, arguments);
    };
    g.scene.render(g.ctx, g.cw, g.ch);
    window.V.Px.draw = real;
    return { hits: hits, ch: g.ch, h: hero.h };
  });
  check('the title screen shows the hero', onTitle.hits.length === 1,
    'drawn ' + onTitle.hits.length + ' times');
  check('the title hero is drawn at a square integer scale',
    onTitle.hits.length === 1 && Number.isInteger(onTitle.hits[0].scale) && onTitle.hits[0].scale >= 3,
    'scale ' + (onTitle.hits[0] || {}).scale);
  check('the title hero stands on screen rather than off the bottom',
    onTitle.hits.length === 1 &&
    onTitle.hits[0].y <= onTitle.ch &&
    onTitle.hits[0].y - onTitle.h * onTitle.hits[0].scale > 0,
    JSON.stringify(onTitle.hits[0]) + ' in ' + onTitle.ch + 'px');

  /* --- outfits are garments, not a colour swap ---
         A tint only recolours the sleeves already on the sprite, so anything
         with its own SHAPE - a sash, a baggy leg, a wrapped wrist - needs to
         be its own thing. Reaper Weave is the first. */
  const outfit = await page.evaluate(() => {
    const g = window.VELTHIROS, V = window.V, D = V.D;
    /* Compared in ANCHOR-relative coordinates, not by flattening both grids
       and walking them index by index. A garment that hangs outside the body
       pads its grid wider - the ribbon takes the player from 18 wide to 34 -
       so a flat walk lines up column 0 of one against column 0 of the other
       and compares unrelated pixels. Both sprites anchor bottom-centre, and
       grid.get returns '.' out of bounds, so this handles either size. */
    const at = (spr, rx, ry) => spr.grid.get(Math.round(spr.ax + rx), Math.round(spr.ay + ry));
    g.newGame();
    const plain = V.Spr.player('down', 0, '#17141c', null);
    const dressed = V.Spr.player('down', 0, '#17141c', 'reaper');
    let differs = 0;
    for (let ry = -40; ry <= 2; ry++)
      for (let rx = -24; rx <= 24; rx++)
        if (at(plain, rx, ry) !== at(dressed, rx, ry)) differs++;

    /* Driven from the shop rather than from a hard-coded id -> outfit pair.
       The pair was `shirt_black` -> 'reaper'; renaming the line-up moved that
       slot to Grayson and the check failed on a rename rather than on a bug.
       What actually matters is that buying an item equips what IT declares,
       and that every armour in the shop names an outfit that exists. */
    const armour = D.REALITY_SHOP.filter((it) => it.outfit);
    const dangling = armour.filter((it) => !D.OUTFITS[it.outfit]).map((it) => it.name);
    const item = armour[armour.length - 1];
    g.save.currency = 99999;
    g.buy(item);
    const equipped = { name: item.name, want: item.outfit, dangling,
                       tint: g.save.equippedTint, outfit: g.save.equippedOutfit,
                       fromGame: g.playerOutfit(), suits: armour.length };
    /* a wipe has to strip it the same way it strips the tint */
    g.save = V.Save.fullReset(g.save);
    return { differs, equipped, afterReset: g.save.equippedOutfit,
             tintAfterReset: g.save.equippedTint,
             known: Object.keys(D.OUTFITS) };
  });
  check('an outfit changes the sprite, not just its colour',
    outfit.differs > 12, outfit.differs + ' pixels differ from the default build');
  check('every armour in the shop names an outfit that exists',
    outfit.equipped.dangling.length === 0 && outfit.equipped.suits === 4,
    outfit.equipped.suits + ' suits; dangling: ' + JSON.stringify(outfit.equipped.dangling));
  check('buying an armour equips the garments it declares, and the tint',
    outfit.equipped.outfit === outfit.equipped.want &&
    outfit.equipped.fromGame === outfit.equipped.want && !!outfit.equipped.tint,
    JSON.stringify(outfit.equipped));
  check('a full reset strips the outfit as it strips the tint',
    outfit.afterReset === null && outfit.tintAfterReset === null,
    JSON.stringify({ outfit: outfit.afterReset, tint: outfit.tintAfterReset }));

  /* --- the wings beat from the shoulder ---
         Both winged characters had the flap inverted: Garatu's wing root swung
         three pixels while the tip sat perfectly still, and Aurelith slid each
         whole wing up by a flat amount - the topmost, longest pair by nothing
         at all. Either way the wings slid rather than beat.

         The test is a pivot test and deliberately assumes nothing about where
         the wings point. An earlier version measured travel against distance
         from the body along x, which quietly assumed wings radiate sideways;
         it then failed Aurelith's redesign, whose upper pair arcs UP so its
         tips sit near the centre line. What actually defines a hinge is that
         the parts which move are further out than the parts which hold - so
         that is what is measured:

           held    = pixels filled in both frames        (the sprite's anchor)
           changed = pixels filled in exactly one frame  (what the beat moved)

         Take the centroid of `held` and compare mean distances. A shoulder
         pivot puts the change out at the tips, well beyond the held mass; an
         inverted pivot puts it at the root, inside that mass, and the ratio
         falls to about 1.

         That ratio alone is not enough, and a control proved it: slide a whole
         wing bodily and the test PASSED at 1.62x, because a big enough
         translation shrinks `held` down to a small overlapping core that
         everything else is then far from. So the share of the sprite that
         moved is bounded too. A beat rearranges the tips - 6% of Aurelith,
         17% of Garatu - where the rigid slide moved 70%. A creature that
         relocates most of itself between two frames is not beating a wing. */
  const wings = await page.evaluate(() => {
    const { Spr } = window.V;
    const pivot = (a, b) => {
      const held = [], changed = [];
      let filled = 0;
      for (let y = 0; y < a.grid.h; y++) {
        for (let x = 0; x < a.grid.w; x++) {
          const inA = a.grid.get(x, y) !== '.', inB = b.grid.get(x, y) !== '.';
          if (inA) filled++;
          if (inA && inB) held.push([x, y]);
          else if (inA || inB) changed.push([x, y]);
        }
      }
      if (!held.length || !changed.length) return { ratio: 0, changed: changed.length, share: 1 };
      const cx = held.reduce((s, p) => s + p[0], 0) / held.length;
      const cy = held.reduce((s, p) => s + p[1], 0) / held.length;
      const mean = (pts) => pts.reduce((s, p) =>
        s + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length;
      const h = mean(held);
      return { ratio: h > 0 ? mean(changed) / h : 0, changed: changed.length,
               share: changed.length / filled };
    };
    return {
      garatu: pivot(Spr.garatu(0), Spr.garatu(1)),
      aurelith: pivot(Spr.aurelith(0), Spr.aurelith(1))
    };
  });
  ['garatu', 'aurelith'].forEach((who) => {
    const m = wings[who];
    check(who + "'s wings beat from the shoulder, not the tip",
      m.changed > 30 && m.ratio > 1.15 && m.share < 0.35,
      m.changed + ' px moved (' + (m.share * 100).toFixed(0) + '% of the sprite), ' +
      m.ratio.toFixed(2) + 'x as far out as the part that held');
  });

  /* --- the roster ---
         The whole fighting game used to be two enemies. pickEnemy flipped a
         coin between goblin and minotaur, so across fifty trials the only
         thing that changed was how often the second one turned up. Four more
         now unlock by tier, each answering a different habit: the husk punishes
         single-target swings by never arriving alone, the slinger punishes
         standing still at range, the ironclad punishes greed, and the shade
         punishes backing away.

         Checked three ways: that the roster is actually reachable, that a late
         field is not still mostly goblins, and that every entry is a real
         enemy with a real sprite - a typo in a roster id would otherwise spawn
         `undefined` and crash the draw on whichever trial first rolled it. */
  const roster = await page.evaluate(() => {
    const g = window.VELTHIROS, V = window.V, D = V.D;
    const spec = g.makeSpec(1);
    const t = new V.Trial(g, spec);
    const draw = (tier, n) => {
      const r = V.U.rng(99), seen = {};
      for (let i = 0; i < n; i++) {
        const id = t.pickEnemy(tier, r);
        seen[id] = (seen[id] || 0) + 1;
      }
      return seen;
    };
    /* everything the roster names must resolve to a def and to a sprite */
    const broken = D.ROSTER.filter((e) =>
      !D.ENEMIES[e.id] || typeof V.Spr[e.id] !== 'function').map((e) => e.id);
    const early = draw(1.0, 400);
    const late = draw(2.9, 400);
    const everSeen = {};
    for (let k = 10; k <= 29; k++) Object.keys(draw(k / 10, 200)).forEach((id) => { everSeen[id] = 1; });
    return {
      broken,
      rosterSize: D.ROSTER.length,
      reachable: Object.keys(everSeen).sort(),
      earlyKinds: Object.keys(early).length,
      lateKinds: Object.keys(late).length,
      lateGoblinShare: (late.goblin || 0) / 400,
      /* nothing may appear before the tier it unlocks at */
      tooEarly: D.ROSTER.filter((e) => e.from > 1.0 && early[e.id]).map((e) => e.id)
    };
  });
  check('every roster entry is a real enemy with a real sprite',
    roster.broken.length === 0 && roster.rosterSize === 6,
    roster.rosterSize + ' entries; broken: ' + JSON.stringify(roster.broken));
  check('all six field enemies are reachable across the run',
    roster.reachable.length === 6, roster.reachable.join(', '));
  check('an early field is the starter enemy, a late field is mixed',
    roster.earlyKinds === 1 && roster.lateKinds === 6 && roster.tooEarly.length === 0,
    'tier 1.0 -> ' + roster.earlyKinds + ' kind, tier 2.9 -> ' + roster.lateKinds +
    ' kinds; early leaks: ' + JSON.stringify(roster.tooEarly));
  check('a late field is no longer mostly goblins',
    roster.lateGoblinShare < 0.3,
    'goblins are ' + (roster.lateGoblinShare * 100).toFixed(0) + '% of a tier 2.9 draw');

  /* --- the three new behaviours actually do something ---
         Each is driven directly rather than waited for: spawn the enemy at a
         known distance, run the world forward, and read the one thing that
         proves the behaviour fired. */
  const behaviours = await page.evaluate(() => {
    const g = window.VELTHIROS, V = window.V;
    const run = (t, secs, step) => { for (let i = 0; i < secs / step; i++) t.update(step); };
    const fresh = () => {
      const t = new V.Trial(g, g.makeSpec(12));
      t.state = 'play';
      t.enemies.length = 0;
      t.projectiles.length = 0;
      t.player.x = 0; t.player.y = 0;
      return t;
    };

    /* a slinger shoots: nothing in the game had ever shot at the player */
    const t1 = fresh();
    const sl = t1.spawnEnemy('slinger', 340, 0, {});
    sl.relentless = true; sl.state = 'chase';
    const hpBefore = t1.player.hp;
    run(t1, 6, 1 / 60);
    const shot = { bolts: t1.projectiles.filter((q) => q.hostile).length,
                   hurt: t1.player.hp < hpBefore };

    /* ...and gives ground when you are on top of it, rather than trading */
    const t2 = fresh();
    const sl2 = t2.spawnEnemy('slinger', 90, 0, {});
    sl2.relentless = true; sl2.state = 'chase';
    run(t2, 2.5, 1 / 60);
    const kited = Math.hypot(sl2.x - t2.player.x, sl2.y - t2.player.y);

    /* a shade closes the gap whatever you do, so kiting stops working */
    const t3 = fresh();
    const sh = t3.spawnEnemy('shade', 900, 0, {});
    sh.relentless = true; sh.state = 'chase';
    const shadeStart = 900;
    run(t3, 3.2, 1 / 60);
    const shadeEnd = Math.hypot(sh.x - t3.player.x, sh.y - t3.player.y);

    /* a goblin at the same distance, over the same time, as the control:
       the shade must beat it by more than its slightly higher speed explains */
    const t4 = fresh();
    const gb = t4.spawnEnemy('goblin', 900, 0, {});
    gb.relentless = true; gb.state = 'chase';
    run(t4, 3.2, 1 / 60);
    const goblinEnd = Math.hypot(gb.x - t4.player.x, gb.y - t4.player.y);

    /* COVER BREAKS A LOCK, including a relentless one. stickyAggro is on in
       every trial type except 'hide', and relentless short-circuited detects()
       entirely - so in 49 of the 50 trials an enemy that had already seen you
       walked straight into the bush you were standing in. Two runs from the
       same setup, one hidden and one not, so the hidden one has to be measured
       against what the same goblin does when it can see you. */
    const cover = (hide) => {
      const t = fresh();
      const e = t.spawnEnemy('goblin', 520, 0, {});
      e.relentless = true; e.state = 'chase'; e.aggro = true;
      t.player.x = 0; t.player.y = 0;
      /* Real cover, not a forced flag: Player.update recomputes `hidden` from
         the world every frame and runs BEFORE the enemies, so a flag set from
         outside is gone by the time anything reads it. Standing still matters
         too - hiding needs mv.mag < 0.75. */
      t.cover.length = 0;
      if (hide) t.cover.push({ x: 0, y: 0, kind: 'bush', s: 1, seed: 1, r: 60 });
      window.V.Input.move.x = 0; window.V.Input.move.y = 0; window.V.Input.move.mag = 0;
      const start = 520;
      let everHidden = false;
      for (let i = 0; i < 4 * 60; i++) {
        t.player.x = 0; t.player.y = 0;
        t.update(1 / 60);
        everHidden = everHidden || t.player.hidden;
      }
      return { start, everHidden,
               end: Math.round(Math.hypot(e.x - t.player.x, e.y - t.player.y)),
               state: e.state };
    };
    const seen = cover(false), unseen = cover(true);

    return { shot, kited, shadeStart, shadeEnd, goblinEnd, seen, unseen };
  });
  check('a slinger shoots at the player instead of closing',
    behaviours.shot.bolts > 0 || behaviours.shot.hurt,
    JSON.stringify(behaviours.shot));
  check('a slinger gives ground when the player closes on it',
    behaviours.kited > 150, 'ended ' + behaviours.kited.toFixed(0) + ' units out, from 90');
  check('cover breaks a chase, even a relentless one',
    behaviours.unseen.everHidden && behaviours.unseen.state !== 'chase' &&
    behaviours.unseen.end > behaviours.seen.end * 1.8,
    'hidden: stopped at ' + behaviours.unseen.end + ' in state ' + behaviours.unseen.state +
    '; seen: closed to ' + behaviours.seen.end);
  check('a shade closes ground a runner could not',
    behaviours.shadeEnd < behaviours.goblinEnd * 0.6,
    'shade ' + behaviours.shadeStart + ' -> ' + behaviours.shadeEnd.toFixed(0) +
    ', goblin over the same time -> ' + behaviours.goblinEnd.toFixed(0));

  /* --- the end of the run ---
         A player reached trial 50, killed Aurelith, was told they FAILED, and
         was dropped straight back into the same fight. Completing a trial was
         scored by percentile even when the trial was the ending, and the boss
         par was set so high that no boss kill could reach the paying tier at
         all - so bosses had never paid, and a bad-but-winning final fight
         looped forever with no way out. */
  const ending = await page.evaluate(() => {
    const g = window.VELTHIROS, V = window.V;
    const kill = (spec, dmg, left, kills) => {
      const t = new V.Trial(g, spec);
      t.state = 'play';
      if (t.boss) { t.boss.dead = true; t.boss.hp = 0; }
      t.kills = kills; t.timeLeft = left; t.player.damageTaken = dmg;
      t.finish('complete');
      return g.pendingResult;
    };
    g.newGame();

    /* a mid-run boss, killed cleanly and killed badly */
    const mid = g.makeSpec(25);
    const clean = kill(mid, 0, 140, 5);
    const rough = kill(mid, 1400, 5, 5);
    /* and one that ran out of time without killing anything */
    const t = new V.Trial(g, mid);
    t.state = 'play'; t.kills = 2; t.timeLeft = 0; t.player.damageTaken = 500;
    t.finish('timeout');
    const unfinished = g.pendingResult;

    /* the final boss, killed in the worst state a win can be in */
    g.save.endgame = true; g.save.endgameWave = 4;
    const finalSpec = g.makeSpec(g.save.trial);
    const won = kill(finalSpec, 1400, 5, 1);
    g.leaveRanking();
    return {
      finalBoss: !!finalSpec.finalBoss,
      cleanPct: clean.percentile, cleanOutcome: clean.tier.outcome,
      roughOutcome: rough.tier.outcome,
      unfinishedOutcome: unfinished.tier.outcome,
      wonOutcome: won.tier.outcome,
      scene: g.scene && g.scene.constructor.name,
      beaten: !!g.save.beatenGame
    };
  });
  check('killing the final boss ends the game rather than ranking it',
    ending.finalBoss && ending.wonOutcome !== 'fail' &&
    ending.scene === 'VictoryScene' && ending.beaten,
    JSON.stringify(ending));
  check('a boss you actually killed is never a failure',
    ending.roughOutcome !== 'fail', 'battered kill ranked ' + ending.roughOutcome);
  check('a clean boss kill can reach the paying tier at all',
    ending.cleanOutcome === 'reward', 'clean kill ranked ' + ending.cleanOutcome + ' at p' + ending.cleanPct);
  check('a boss you did not kill still fails',
    ending.unfinishedOutcome === 'fail', 'timeout ranked ' + ending.unfinishedOutcome);

  /* --- objective trials have to bring the enemies to you ---
         The player is pinned to a zone, and waves spawn at the rim: 1190 units
         out against a goblin's 430 of sight. They used to spawn 'idle', never
         notice anyone, and wander until the clock ran out - the zone could not
         even be damaged. */
  await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.newGame();
    g.save.trial = 4;                     /* defend */
    g.enterTrial();
    g.scene.trial.introTimer = 0.05;
  });
  await wait(900);
  const hunt0 = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial, p = t.player;
    t.waveTimer = 0.01;                   /* bring the first wave forward */
    return { type: t.type, hunt: t.huntOnSpawn, sticky: t.stickyAggro,
             px: Math.round(p.x), py: Math.round(p.y) };
  });
  check('a defend trial is set to hunt', hunt0.type === 'defend' && hunt0.hunt === true,
    JSON.stringify(hunt0));

  await wait(700);
  const spawned = await page.evaluate(() => {
    const t = window.VELTHIROS.scene.trial, p = t.player;
    const live = t.enemies.filter((e) => !e.dead);
    return { n: live.length,
             idle: live.filter((e) => e.state === 'idle').length,
             relentless: live.filter((e) => e.relentless).length,
             far: live.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) > e.def.sight).length,
             dist: live.map((e) => Math.round(Math.hypot(e.x - p.x, e.y - p.y))) };
  });
  check('they spawn beyond their own sight, which is why this was needed',
    spawned.n > 0 && spawned.far === spawned.n,
    JSON.stringify(spawned.dist));
  check('none of them are idling', spawned.n > 0 && spawned.idle === 0,
    spawned.idle + ' of ' + spawned.n + ' idle');
  check('every one of them is hunting', spawned.n > 0 && spawned.relentless === spawned.n,
    spawned.relentless + ' of ' + spawned.n);

  await wait(4000);
  const closedIn = await page.evaluate(() => {
    const g = window.VELTHIROS, t = g.scene.trial;
    if (!t) return { gone: true };
    const p = t.player, live = t.enemies.filter((e) => !e.dead);
    return { closest: Math.min.apply(null, live.map((e) => Math.round(Math.hypot(e.x - p.x, e.y - p.y)))) };
  });
  check('and they close the distance rather than wandering',
    closedIn.gone === true || closedIn.closest < 900, JSON.stringify(closedIn));

  /* 'hide' is the exception: being chased IS the fail state there, so an
     enemy that can never lose you would make it unplayable. */
  const hideRules = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D;
    const t = new window.V.Trial(g, { index: 4, type: 'hide', boss: false,
      env: D.ENVIRONMENTS[0], seed: 7, label: 'hide' });
    return { type: t.type, sticky: t.stickyAggro, hunt: t.huntOnSpawn };
  });
  check('a hide trial is exempt from both rules',
    hideRules.type === 'hide' && hideRules.sticky === false && hideRules.hunt === false,
    JSON.stringify(hideRules));

  /* --- the install offer: present only where it leads somewhere ---
         Driven through the live loop and real pointer events, because that is
         the path a player takes; headless Chromium fires no
         beforeinstallprompt, so the browser's side of it is stubbed. */
  const hasInstallZone = () => page.evaluate(
    () => (window.V.Input.lastZones || []).some((z) => z.id === 'install'));

  await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.setScene(new window.V.S.StartScene(g));
  });
  await wait(250);
  check('no install button where installing would do nothing',
    (await hasInstallZone()) === false);

  await page.evaluate(() => {
    window.__prompted = 0;
    window.V.Install.deferred = {
      prompt: () => { window.__prompted++; },
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };
  });
  await wait(250);
  check('the install button appears once the browser offers a prompt',
    (await hasInstallZone()) === true);

  await tapZone('install');
  const tapped = await page.evaluate(() => ({
    prompted: window.__prompted,
    spent: window.V.Install.deferred === null,
    said: window.VELTHIROS.scene.installResult
  }));
  check('tapping it fires the real prompt, once, and spends the event',
    tapped.prompted === 1 && tapped.spent,
    'prompted ' + tapped.prompted + 'x, cleared: ' + tapped.spent);
  check('an accepted install is confirmed on screen',
    !!tapped.said, JSON.stringify(tapped.said));

  /* iOS never fires the event, so the offer has to become instructions */
  await page.evaluate(() => {
    window.__realUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone', configurable: true });
    window.VELTHIROS.scene.installResult = null;
  });
  await wait(250);
  const iosMode = await page.evaluate(() => window.V.Install.mode());
  check('iOS gets instructions rather than a dead button',
    iosMode === 'manual' && (await hasInstallZone()) === true, 'mode=' + iosMode);

  await tapZone('install');
  const card = await page.evaluate(() => ({
    open: window.VELTHIROS.scene.showInstallHelp,
    zones: (window.V.Input.lastZones || []).map((z) => z.id)
  }));
  check('the card opens and swallows the menu behind it',
    card.open === true && card.zones.length === 1 && card.zones[0] === 'installclose',
    JSON.stringify(card.zones));

  await tapZone('installclose');
  const closed = await page.evaluate(() => {
    Object.defineProperty(navigator, 'userAgent', { value: window.__realUA, configurable: true });
    return window.VELTHIROS.scene.showInstallHelp;
  });
  check('the card closes again', closed === false);

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

  /* --- aiming at where an enemy LOOKS must connect.
         The world's Y is squashed 0.62 on screen, so a diagonal target's world
         angle differs from its on-screen angle by up to 13.6 degrees. Swings
         used to be tested in world space and missed things plainly in front. --- */
  const aiming = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D, SQ = window.V.Art.SQUASH;
    const attempt = (angleDeg, distance, faceDeg) => {
      const spec = { index: 3, type: 'defeat', boss: false, env: D.ENVIRONMENTS[0], seed: 3, label: 'aim' };
      const t = new window.V.Trial(g, spec);
      t.state = 'play';
      t.enemies.length = 0;
      const p = t.player;
      p.x = 0; p.y = 0;
      const th = angleDeg * Math.PI / 180;
      const e = t.spawnEnemy('goblin', Math.cos(th) * distance, Math.sin(th) * distance, {});
      const hpBefore = e.hp;
      /* the player aims by what they see: push the stick toward the enemy's
         screen position, which is the world offset with Y squashed */
      p.facing = faceDeg == null
        ? Math.atan2(Math.sin(th) * distance * SQ, Math.cos(th) * distance)
        : faceDeg * Math.PI / 180;
      p.tryAttack(false);
      for (let i = 0; i < 30 && t.state === 'play'; i++) t.update(1 / 60);
      return e.hp < hpBefore;
    };
    return {
      straightAhead: attempt(0, 70),
      diagonal45: attempt(45, 70),
      diagonal52: attempt(52, 75),       /* the worst case for the squash error */
      steepDiagonal: attempt(70, 70),
      behind: attempt(180, 70, 0)        /* enemy behind, player facing forward: must miss */
    };
  });
  check('a swing connects with an enemy wherever it looks in front of you',
    aiming.straightAhead && aiming.diagonal45 && aiming.diagonal52 && aiming.steepDiagonal,
    JSON.stringify(aiming));
  check('a swing still misses an enemy behind you', !aiming.behind, 'behind hit=' + aiming.behind);

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
    start.secret.idle = g.idleUnlockSeconds + 1;
    start.update(0.016);
    const shown = start.secret.shown;
    const seenPersisted = g.save.comboSeen;

    /* IT DOES NOT GO AWAY. The flag used to live on the scene instance, so
       walking into Help and back rebuilt StartScene and started another five
       minutes - the secret found you and then un-found you. A fresh scene on
       the same save must come up already showing it, with no idle at all. */
    const revisit = new window.V.S.StartScene(g);
    const shownOnRevisit = revisit.secret.shown;

    /* And knowing the sequence has to be worth something: with the panel
       CLOSED, the arrows still have to take it. pressDir used to return early
       unless the prompt was up, which made the secret worthless to know. */
    revisit.secret.shown = false;
    for (const dir of revisit.secret.combo) revisit.pressDir(dir);
    const unlockedWhileClosed = g.save.scytheUnlocked;

    /* THE SAME SECRET IN BOTH PLACES. The bedroom you start in and the room you
       come back to are one scene, and it has to carry the combo as the title
       screen does - one implementation, or the two disagree about whether it
       has been found. */
    g.save.scytheUnlocked = false; g.save.weapons.scythe = false; g.save.weapon = 'sword';
    const bedroom = new window.V.S.RoomScene(g, 'intro');
    const shownInBedroom = bedroom.secret.shown;
    for (const dir of bedroom.secret.combo) bedroom.pressDir(dir);
    const unlockedFromBedroom = g.save.scytheUnlocked;

    g.save.scytheUnlocked = false; g.save.weapons.scythe = false; g.save.weapon = 'sword';
    const hub = new window.V.S.RoomScene(g, 'hub');
    const shownInHub = hub.secret.shown;

    /* re-lock and finish through the panel, the way the original check did */
    g.save.scytheUnlocked = false; g.save.weapons.scythe = false; g.save.weapon = 'sword';
    for (const dir of start.secret.combo) start.pressDir(dir);
    return { shown, seenPersisted, shownOnRevisit, unlockedWhileClosed,
             shownInBedroom, unlockedFromBedroom, shownInHub,
             unlocked: g.save.scytheUnlocked, weapon: g.save.weapon,
             comboLen: start.secret.combo.length };
  });
  const oldSave = await page.evaluate(() => {
    const D = window.V.D, Save = window.V.Save;
    /* simulate a run created before the combo was pinned */
    const stale = Save.blank();
    stale.started = true;
    stale.comboIndex = (D.FIXED_COMBO_INDEX + 3) % D.COMBOS.length;
    Save.write(stale);
    const loaded = Save.load();
    return { stored: stale.comboIndex, loaded: loaded.comboIndex, pinned: D.FIXED_COMBO_INDEX };
  });
  check('an existing save picks up the pinned combo on load',
    oldSave.loaded === oldSave.pinned, JSON.stringify(oldSave));

  /* A save written before the tutorial existed has no `tutorialDone` key. It
     must NOT be dragged back through the opening on Continue - but a save that
     never saw the intro should still get it. */
  const migrate = await page.evaluate(() => {
    const Save = window.V.Save;
    const shape = (seenIntro) => {
      const old = Save.blank();
      old.started = true;
      old.seenIntro = seenIntro;
      old.trial = 12;
      delete old.tutorialDone;                 /* as an older build wrote it */
      delete old.tutorialStage;
      Save.write(old);
      const s = Save.load();
      return { tutorialDone: s.tutorialDone, trial: s.trial, hasStage: 'tutorialStage' in s };
    };
    return { veteran: shape(true), neverStarted: shape(false) };
  });
  check('a pre-tutorial save is not dragged back through the opening',
    migrate.veteran.tutorialDone === true && migrate.veteran.trial === 12 &&
    migrate.veteran.hasStage && migrate.neverStarted.tutorialDone === false,
    JSON.stringify(migrate));

  check('scythe unlock prompt + combo', scythe.shown && scythe.unlocked && scythe.weapon === 'scythe', JSON.stringify(scythe));
  check('once the combo has surfaced it stays surfaced',
    scythe.seenPersisted && scythe.shownOnRevisit,
    'comboSeen=' + scythe.seenPersisted + ' shown on a fresh StartScene=' + scythe.shownOnRevisit);
  check('knowing the combo is enough - it is taken with the panel closed',
    scythe.unlockedWhileClosed, String(scythe.unlockedWhileClosed));
  check('the secret is on the title screen AND in the room, from one implementation',
    scythe.shownInBedroom && scythe.shownInHub && scythe.unlockedFromBedroom,
    JSON.stringify({ bedroom: scythe.shownInBedroom, hub: scythe.shownInHub,
                     takenInBedroom: scythe.unlockedFromBedroom }));

  await page.evaluate(() => {
    const g = window.VELTHIROS;
    g.save.scytheUnlocked = false; g.save.weapons.scythe = false;
    const s = new window.V.S.StartScene(g);
    g.setScene(s);
    s.idle = g.idleUnlockSeconds + 1;
    s.update(0.016);
  });
  await wait(400);
  await shot('15-scythe-prompt');

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

  /* --- New Game must leave nothing behind.
         The gem level is not a stored field - Save.gemLevel derives it from
         `cleared` - so this asserts the derived value drops too, not just the
         object. Only `resets` (which seeds arena layouts) may survive. --- */
  const freshStart = await page.evaluate(() => {
    const g = window.VELTHIROS, Save = window.V.Save;
    /* a thoroughly dirty profile */
    g.save.gem = { id: 'emberstone' };
    g.save.cleared = 33;
    g.save.currency = 4242;
    g.save.lifetimeEarned = 9999;
    g.save.weapons = { sword: true, bow: true, battleaxe: true, scythe: true };
    g.save.weapon = 'scythe';
    g.save.scytheUnlocked = true;
    g.save.owned = { w_bow: true, g_boots: true, c_potion: 3 };
    g.save.equippedTint = '#ff0000';
    g.save.decor = { rug: true, lamp: true };
    g.save.trial = 34;
    g.save.deaths = 11;
    g.save.debuff = 'weak';
    g.save.tutorialDone = true;
    g.save.stats = { kills: 400, trialsFailed: 9, bestRank: 3 };
    g.save.resets = 2;
    const beforeLevel = Save.gemLevel(g.save);
    const beforeStats = Save.resolveStats(g.save);

    const s = Save.newGame(g.save);
    const reloaded = Save.load();          /* what actually hit localStorage */
    const stats = Save.resolveStats(s);
    return {
      beforeLevel, beforeDamage: Math.round(beforeStats.damageMul * 100),
      gem: s.gem, gemLevel: Save.gemLevel(s), damageMul: Math.round(stats.damageMul * 100),
      currency: s.currency, lifetime: s.lifetimeEarned, cleared: s.cleared, trial: s.trial,
      deaths: s.deaths, debuff: s.debuff, weapon: s.weapon,
      weaponKeys: Object.keys(s.weapons).filter((k) => s.weapons[k]),
      ownedKeys: Object.keys(s.owned), tint: s.equippedTint,
      decorKeys: Object.keys(s.decor), scythe: s.scytheUnlocked,
      tutorialDone: s.tutorialDone, kills: s.stats.kills, bestRank: s.stats.bestRank,
      resets: s.resets, persistedGem: reloaded.gem, persistedCurrency: reloaded.currency
    };
  });
  check('a New Game wipes the gem, its derived level, and every stat it fed',
    freshStart.beforeLevel === 5 && freshStart.beforeDamage > 100 &&
    freshStart.gem === null && freshStart.gemLevel === 0 && freshStart.damageMul === 100 &&
    freshStart.persistedGem === null,
    JSON.stringify({ before: freshStart.beforeLevel + '/' + freshStart.beforeDamage + '%',
                     after: freshStart.gemLevel + '/' + freshStart.damageMul + '%' }));
  check('a New Game wipes currency, purchases, weapons, tint, decor and progress',
    freshStart.currency === 0 && freshStart.lifetime === 0 && freshStart.persistedCurrency === 0 &&
    freshStart.cleared === 0 && freshStart.trial === 1 && freshStart.deaths === 0 &&
    freshStart.debuff === null && freshStart.weapon === 'sword' &&
    freshStart.weaponKeys.join(',') === 'sword' && freshStart.ownedKeys.length === 0 &&
    freshStart.tint === null && freshStart.decorKeys.length === 0 && !freshStart.scythe &&
    freshStart.tutorialDone === false && freshStart.kills === 0 && freshStart.bestRank === 100,
    JSON.stringify(freshStart));
  check('a New Game keeps only the reset counter, which seeds arena layouts',
    freshStart.resets === 2, 'resets=' + freshStart.resets);

  /* --- the dodge is a sidestep, and the same one at any frame rate.
         It used to integrate a full dt on its last frame, so the distance
         travelled depended on how the frames happened to land. --- */
  const dodge = await page.evaluate(() => {
    const g = window.VELTHIROS, D = window.V.D, E = window.V.E;
    const roll = (dt) => {
      const spec = { index: 3, type: 'defeat', boss: false, env: D.ENVIRONMENTS[0], seed: 8, label: 'dodge' };
      const t = new window.V.Trial(g, spec);
      t.state = 'play';
      t.enemies.length = 0;
      const p = t.player;
      p.x = 0; p.y = 0; p.facing = 0; p.stamina = 100;
      window.V.Input.move.x = 0; window.V.Input.move.y = 0; window.V.Input.move.mag = 0;
      p.tryDodge();
      let guard = 0;
      while (p.dodgeTime > 0 && guard++ < 400) p.update(dt, window.V.Input);
      return Math.round(Math.abs(p.x));
    };
    return {
      dist: g.save && roll(1 / 60),
      at120: roll(1 / 120),
      atStutter: roll(0.05),               /* the dt clamp in game.js */
      configured: window.V.Save.resolveStats(window.V.Save.blank()).dodgeDist,
      duration: E.DODGE_TIME
    };
  });
  check('a dodge is a sidestep, not a leap', dodge.configured === 170 && dodge.dist <= 175,
    JSON.stringify(dodge));
  check('a dodge covers the same ground at any frame rate',
    Math.abs(dodge.dist - dodge.at120) <= 2 && Math.abs(dodge.dist - dodge.atStutter) <= 2,
    `60fps=${dodge.dist} 120fps=${dodge.at120} stutter=${dodge.atStutter}`);

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
  await shot('16-portrait-start');

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
