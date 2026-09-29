import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREA_VELUWE } from '../src/content/veluwe';
import {
  R, save, sleep, snap, uncovered, visibleButtons, walkTo, worldChange, worldSamples,
  MAX_DRAW_CALLS, SEAT_TOLERANCE, type Hint, type P2, type Seat,
} from './golden-lib';

/** Run 6: a mission's home (an adventure's family lives there, before and after). */
type Home = { missionId: string; state: 'before' | 'after'; borrowed: boolean; actors: { key: string; x: number; z: number; visible: boolean }[] };
const homeOf = async (page: Page, id: string): Promise<Home | null> =>
  (await R<Home[] | null>(page, 'r.residents()'))?.find((h) => h.missionId === id) ?? null;

/**
 * ALL TEN MISSIONS, each played the way a first-time player plays it, from a fresh
 * save, at its real marker:
 *
 *   RANGER_PORT=<port> npx playwright test e2e/missions.spec.ts --project=chromium --workers=2
 *
 * Real input only (golden.spec.ts's rules): the mouse on Begin and the ranger maker,
 * held arrow keys to walk to the marker, a mouse click on "Speel mee" and "Ga op pad",
 * in the 3D games a real mouse click where the engine says a perfect player clicks
 * next (`__ranger.playHint()`), in the choice rounds the button the content marks
 * `goed` (found by the question on screen), and "Verder" on the cards. The dev hook
 * is only READ; `winStep()` is never called.
 *
 * Each mission must be won, end in its reunion line over the world, its reward card
 * (and the wildcamera clue when it carries one), and leave the world visibly changed
 * at its marker: its finished tableau and the "klaar" flag. The last test plays the
 * season's last mission and its finale, and walks on in the calm, finished world.
 * Quality problems are soft (`expect.soft`), a blocked player is hard. Screenshots:
 * test-results/missions/<mission>/NN-<step>.png, notes in NOTES.txt — look at them.
 */

const missions = AREA_VELUWE.missies;
const SEAT_RADIUS = 6;

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

type Mission = (typeof missions)[number];
type Skin = { dier?: string; encounters?: { vraag: string; opties: { label: string; goed: boolean }[] }[] };

/** Notes + screenshots of one mission run. */
class Log {
  readonly notes: string[] = [];
  private n = 0;
  constructor(readonly page: Page, readonly dir: string) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  note(msg: string): void { this.notes.push(msg); }
  /** A quality check: soft (the run goes on), named in the notes when it fails. */
  soft(ok: boolean, msg: string): boolean {
    expect.soft(ok, msg).toBe(true);
    if (!ok) this.notes.push(`✗ ${msg}`);
    return ok;
  }
  /** The player is blocked here: stop. */
  hard(ok: boolean, msg: string): asserts ok {
    if (!ok) { this.notes.push(`✗✗ ${msg}`); throw new Error(msg); }
  }
  async shot(name: string): Promise<void> {
    this.n += 1;
    await this.page.screenshot({ path: path.join(this.dir, `${String(this.n).padStart(2, '0')}-${name}.png`) });
  }
  write(): string {
    const text = this.notes.join('\n');
    fs.writeFileSync(path.join(this.dir, 'NOTES.txt'), text + '\n');
    return text;
  }
}

/** Click a visible button like a player: the real mouse, at its centre. */
async function click(log: Log, name: RegExp | string, what: string, timeout = 10_000, clickTimeout = 5_000): Promise<void> {
  const page = log.page;
  const btn = page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).first();
  const shown = await btn.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  log.hard(shown, `${what}: no visible button ${String(name)} (visible: ${await visibleButtons(page)})`);
  const cover = await uncovered(btn);
  log.soft(cover === null, `${what}: the "${String(name)}" button is covered by ${cover}`);
  const box = await btn.boundingBox();
  if (box) log.soft(box.height >= 56 || box.width >= 56, `${what}: the "${String(name)}" button is small (${Math.round(box.width)}×${Math.round(box.height)} px)`);
  await btn.click({ timeout: clickTimeout });
}

const visible = async (page: Page, name: RegExp | string): Promise<boolean> =>
  (await page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).count()) > 0;

const uiText = (page: Page): Promise<string> => page.evaluate(() => document.getElementById('ui')?.innerText ?? '');

/** Begin → the ranger maker (a fresh save) → the world. */
async function boot(log: Log): Promise<void> {
  const page = log.page;
  await page.goto('/?dev=1');
  await click(log, 'Begin', 'title', 30_000, 30_000); // the title may still be dressing itself
  const maker = page.getByRole('button', { name: 'Dit is mijn ranger' });
  // (its click builds the world inside the handler: on a busy machine that takes a while)
  if (await maker.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true, () => false)) await click(log, 'Dit is mijn ranger', 'ranger maker', 10_000, 30_000);
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  await sleep(page, 1_200);
}

/** Walk with the arrow keys to the mission's marker, until its prompt is offered. */
async function goToMarker(log: Log, mission: Mission): Promise<P2> {
  const page = log.page;
  const all = await R<(P2 & { missionId: string })[] | null>(page, 'r.markers()');
  const m = all?.find((x) => x.missionId === mission.id);
  log.hard(!!m, `no marker for "${mission.id}"`);
  const marker = { x: m.x, z: m.z };
  // a step inside the prompt's ring (2.4 m), so a stride of momentum never carries him out again
  const inside = (s: { near: string | null; p: P2 | null }): boolean =>
    s.near === mission.id && !!s.p && Math.hypot(s.p.x - marker.x, s.p.z - marker.z) < 1.9;
  const w = await walkTo(page, marker, { stopDist: 1.0, until: inside, timeout: 150_000 });
  log.note(`walked to the marker (${Math.round(marker.x)}, ${Math.round(marker.z)}): ${w.res} in ${(w.ms / 1000).toFixed(1)} s`);
  log.hard(w.res === 'until' || w.res === 'arrived', `walking never reached the "${mission.id}" marker (${w.res} at ${w.end.x.toFixed(1)}, ${w.end.z.toFixed(1)})`);
  await expect.poll(async () => (await snap(page)).near, { timeout: 5_000, message: `the "${mission.id}" prompt ring` }).toBe(mission.id);
  return marker;
}

/** "Speel mee" (or "Speel nog eens") at the marker, then "Ga op pad" on the briefing. */
async function start(log: Log, mission: Mission): Promise<void> {
  const page = log.page;
  // note the reunion line the moment it shows (it is on screen for a few seconds only)
  await page.evaluate(() => {
    const w = window as unknown as { __reunion?: string };
    w.__reunion = '';
    new MutationObserver(() => {
      const el = document.querySelector('.reunion-cap') as HTMLElement | null;
      if (el && !w.__reunion) w.__reunion = el.innerText;
    }).observe(document.getElementById('ui')!, { childList: true, subtree: true });
  });
  const titel = mission.titel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await click(log, new RegExp(`(Speel mee|Speel nog eens): ${titel}`), 'marker prompt');
  await sleep(page, 700);
  await log.shot('briefing');
  log.soft((await uiText(page)).toLowerCase().includes(mission.titel.toLowerCase()), 'the briefing names the mission');
  await click(log, 'Ga op pad', 'briefing');
  await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 10_000, message: 'the mission never started' }).not.toBeNull();
}

/** Every step, with real input, until each one is won (golden.spec step 6's player). Run 6:
 *  an adventure plays its steps as beats in the world, interleaved — walk hints are walked
 *  with the arrow keys, an encounter is answered from ANY step of the mission, an action
 *  button is pressed, and "won" = every step's trial count went up. */
async function playSteps(log: Log, mission: Mission): Promise<void> {
  const page = log.page;
  const plan = mission.stappen.map((s) => s.ef as string);
  log.note(`steps: ${plan.join(' → ')}`);
  const base = (await save(page))?.trials ?? {};
  const need: Record<string, number> = {};
  for (const ef of plan) need[ef] = (need[ef] ?? 0) + 1;
  const encounters = mission.stappen.flatMap((st) => (st.skin as Skin).encounters ?? []);
  const bad: string[] = [];
  const won = new Set<string>();
  let lastProgress = Date.now(); let ended: number | null = null;
  let clicks = 0; let answers = 0; let walks = 0; let lastBeat = '';
  const deadline = Date.now() + 9 * 60_000;
  const t0 = Date.now();
  while (won.size < Object.keys(need).length && Date.now() < deadline) {
    const sv = await save(page);
    for (const ef of Object.keys(need)) {
      if (!won.has(ef) && sv && (sv.trials[ef] ?? 0) - (base[ef] ?? 0) >= need[ef]) {
        won.add(ef);
        log.note(`${ef}: won (${clicks} click(s) on 3D targets, ${answers} answer(s), ${walks} walk(s) so far)`);
        await log.shot(`${ef}-won`);
        lastProgress = Date.now();
      }
    }
    if (won.size >= Object.keys(need).length) break;
    const view = await R<string | null>(page, 'r.missionView');
    if ((await R<string>(page, 'r.screen')) === 'world' && view === null) {
      ended ??= Date.now();
      log.hard(Date.now() - ended < 3_000, `the mission ended before every step was won (won: ${[...won].join(', ') || 'none'})`);
    } else ended = null;
    if (Date.now() - lastProgress > 45_000) {
      await log.shot('stuck');
      log.hard(false, `stuck for 45 s at "${lastBeat}" (visible: ${await visibleButtons(page)})`);
    }
    const adv = await R<{ beat: string } | null>(page, 'r.adventure()');
    const calls = await R<number | null>(page, 'r.drawCalls()');
    if (calls !== null && calls >= MAX_DRAW_CALLS) bad.push(`draw calls ${calls} at "${adv?.beat ?? view}"`);
    if (adv && adv.beat !== lastBeat) {
      lastBeat = adv.beat;
      await sleep(page, 1_000);
      await log.shot(`beat-${adv.beat.replace(/[^a-z0-9]+/gi, '-')}`);
    }
    // (a0) a walk hint: walk there with the arrow keys, until the hint changes
    const h0 = await R<Hint | null>(page, 'r.playHint()');
    if (h0?.walk) {
      const w = await walkTo(page, { x: h0.walk.x, z: h0.walk.z }, {
        stopDist: h0.walk.r, timeout: 90_000, stopWhen: async () => (await R<Hint | null>(page, 'r.playHint()'))?.id !== h0.id,
      });
      walks += 1;
      log.hard(w.res === 'arrived' || w.res === 'until', `walking to "${h0.id}" got ${w.res}`);
      lastProgress = Date.now();
      continue;
    }
    // (a) a 3D target: where the engine says a perfect player clicks next
    if (h0) {
      let h = h0;
      for (let i = 0; i < 15; i++) { // let a camera move settle first
        await sleep(page, 150);
        const h2 = await R<Hint | null>(page, 'r.playHint()');
        if (!h2 || h2.id !== h.id || h2.walk) break;
        const still = Math.hypot(h2.x - h.x, h2.y - h.y) < 3; h = h2;
        if (still) break;
      }
      if (h.walk) continue;
      const key = adv?.beat ?? view ?? '';
      if (!h.onScreen) bad.push(`${key}: "${h.id}" off-screen`);
      if (!h.firstHit) bad.push(`${key}: "${h.id}" hidden behind ${h.firstHitBy}`);
      if (!h.reachesCanvas) bad.push(`${key}: "${h.id}" under ${h.blocker}`);
      if (!h.aboveGround) bad.push(`${key}: "${h.id}" under the ground`);
      if (h.bottomGap !== null && Math.abs(h.bottomGap) > SEAT_TOLERANCE) bad.push(`${key}: "${h.id}" ${h.bottomGap} m off the ground`);
      log.hard(h.onScreen, `${key}: the target "${h.id}" is off-screen`);
      const before = { id: h.id, text: await uiText(page), trials: JSON.stringify((await save(page))?.trials) };
      await page.mouse.click(h.x, h.y);
      clicks += 1;
      const reacted = await expect.poll(async () => {
        const h3 = await R<Hint | null>(page, 'r.playHint()');
        return h3?.id !== before.id || (await uiText(page)) !== before.text || JSON.stringify((await save(page))?.trials) !== before.trials;
      }, { timeout: 10_000 }).toBe(true).then(() => true, () => false); // a real click reacts within a frame or two; 4 s ran out at load ~80
      log.hard(reacted, `${key}: a real click on "${h.id}" did nothing`);
      lastProgress = Date.now();
      continue;
    }
    // (b) a choice round: the option the content marks goed, by the question on screen (any step)
    const text = await uiText(page);
    const enc = encounters.find((e) => text.includes(e.vraag));
    const right = enc?.opties.find((o) => o.goed)?.label;
    const btn = right ? page.getByRole('button', { name: right, exact: true }).filter({ visible: true }).first() : null;
    if (enc && right && btn && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
      await click(log, right, `${adv?.beat ?? view} answer`);
      answers += 1;
      await expect.poll(async () => !(await uiText(page)).includes(enc.vraag), { timeout: 8_000 }).toBe(true).catch(() => {});
      lastProgress = Date.now();
      continue;
    }
    // (c) a card to close (a find card, the raaf's fact), or an action in the world
    if (await visible(page, /^(Verder|Klaar)$/)) {
      await click(log, /^(Verder|Klaar)$/, `${adv?.beat ?? view} card`);
      await sleep(page, 400);
      lastProgress = Date.now();
      continue;
    }
    const act = page.locator('.adv-action').filter({ visible: true }).first();
    if (await act.isVisible().catch(() => false)) {
      await click(log, (await act.innerText()).trim(), `${adv?.beat ?? view} action`);
      lastProgress = Date.now();
      continue;
    }
    await sleep(page, 250); // a sequence is being shown, an animal walks: watch it
  }
  log.note(`played in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  log.soft(bad.length === 0, `targets a player could not see or reach: ${[...new Set(bad)].slice(0, 4).join('; ')}`);
  log.hard(won.size >= Object.keys(need).length, `won ${won.size}/${Object.keys(need).length} steps before the time ran out`);
}

/** The ending: the reunion over the world, the reward, the clue, back on patrol. */
async function finish(log: Log, mission: Mission, then: 'patrol' | 'finale' = 'patrol'): Promise<void> {
  const page = log.page;
  const t0 = Date.now(); // the last step's fact card may still be open
  while (!(await save(page))?.voltooid[mission.id] && Date.now() - t0 < 30_000) {
    if (await visible(page, /^(Verder|Klaar)$/)) await click(log, /^(Verder|Klaar)$/, 'last fact card');
    await sleep(page, 400);
  }
  log.hard(!!(await save(page))?.voltooid[mission.id], 'the mission was never marked done');
  // the reunion: its line over the LIVE world (no card over it) while the family comes back
  const seen = (): Promise<string> => page.evaluate(() => (window as unknown as { __reunion?: string }).__reunion ?? '');
  const cap = await expect.poll(seen, { timeout: 8_000 }).not.toBe('').then(() => true, () => false);
  const capText = (await seen()).replace(/\s+/g, ' ');
  log.soft(cap, 'no reunion moment after the last step');
  const line = mission.reunion?.tekst ?? '';
  if (line) log.soft(capText.toLowerCase().includes(line.toLowerCase()), `the reunion says "${line}" (it says "${capText}")`);
  if (await page.locator('.reunion-cap').isVisible().catch(() => false)) { await sleep(page, 1_000); await log.shot('reunion'); }
  // the reward card (an adventure tells its last fact after the reunion: read it on)
  const reward = await expect.poll(async () => {
    // (a card that closes while the click lands is fine: on a loaded laptop a click on a
    // card being replaced can outlast its timeout; the poll looks again)
    if (await visible(page, /^Verder$/) && !(await uiText(page)).includes('Knap gedaan')) await click(log, /^Verder$/, 'the fact after the reunion', 5_000, 15_000).catch(() => {});
    return (await uiText(page)).includes('Knap gedaan');
  }, { timeout: 20_000 }).toBe(true).then(() => true, () => false);
  log.soft(reward, 'no reward card after the reunion');
  log.soft((await uiText(page)).toLowerCase().includes(mission.titel.toLowerCase()), `the reward names "${mission.titel}"`);
  await log.shot('reward');
  let clue = false;
  for (let i = 0; i < 6; i++) {
    if (await visible(page, /Kijk wat je vond|Bekijk de wildcamera/)) {
      await click(log, /Kijk wat je vond|Bekijk de wildcamera/, 'reward'); clue = true;
      await sleep(page, 700); await log.shot('clue');
      continue;
    }
    if (then === 'finale' && await visible(page, /^Verder$/)) break;
    if (await visible(page, /Verder op patrouille/)) { await click(log, /Verder op patrouille/, 'reward'); await sleep(page, 700); continue; }
    if ((await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null) break;
    await sleep(page, 500);
  }
  if ('verhaalHaak' in mission && mission.verhaalHaak) log.soft(clue, `mission "${mission.id}" carries a clue (${mission.verhaalHaak}) but no clue card was offered`);
}

/** Back in the world: the marker's finished tableau and "klaar" flag stand there. */
async function worldReacted(log: Log, mission: Mission, marker: P2, before: Seat[][]): Promise<void> {
  const page = log.page;
  await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
    { timeout: 15_000, message: `the reward never led back to the world (visible: ${await visibleButtons(page)})` }).toBe(true);
  await sleep(page, 2_000);
  await log.shot('after');
  const after = await worldSamples(page, marker, SEAT_RADIUS, 3);
  const { appeared } = worldChange(before, after);
  log.note(`within ${SEAT_RADIUS} m of the marker ${appeared.length} things appeared: ${appeared.slice(0, 5).map((s) => s.id.split('@')[0]).join(', ')}`);
  log.soft(appeared.length > 0, 'the world does not react at the marker');
  log.soft(after[0].some((s) => s.id.startsWith('klaar-flag')), 'no "klaar" flag at the finished marker');
  const off = appeared.filter((s) => Math.abs(s.gap) > SEAT_TOLERANCE);
  log.soft(off.length === 0, `what appeared is not on the ground: ${off.slice(0, 3).map((s) => `${s.id.split('@')[0]} ${s.gap} m`).join('; ')}`);
  const s = await snap(page);
  const home = (await R<Record<string, P2> | null>(page, `r.missionPlaces(${JSON.stringify(mission.id)})`))?.home;
  const near = (q: P2): boolean => !!s.p && Math.hypot(s.p.x - q.x, s.p.z - q.z) < 12;
  log.soft(near(marker) || (!!home && near(home)), 'back in the world near the marker (or the mission\'s home)');
  // run 6: an adventure's family lives at its home, in its after state, together there
  const fam = await homeOf(page, mission.id);
  if (fam && home) {
    const members = fam.actors.filter((a) => a.visible);
    const far = members.filter((a) => Math.hypot(a.x - home.x, a.z - home.z) > 4);
    log.note(`its home: "${fam.state}", ${members.length} animal(s) there`);
    log.soft(fam.state === 'after' && !fam.borrowed && members.length > 0 && far.length === 0,
      `the family lives at its home after the mission (${fam.state}; off home: ${far.map((a) => a.key).join(', ') || 'none'})`);
  }
  const hud = await uiText(page);
  log.soft(hud.includes(`Speel nog eens: ${mission.titel}`) || hud.includes('Pauze'), 'the explore HUD is back');
  const calls = await R<number | null>(page, 'r.drawCalls()');
  log.soft(calls !== null && calls < MAX_DRAW_CALLS, `draw calls back in the world: ${calls}`);
}

function outDir(info: TestInfo, id: string): string {
  return path.join(info.project.outputDir, 'missions', id);
}

for (const mission of missions) {
  test(`mission "${mission.titel}": walk to its marker and play it with real input @missions`, async ({ page }, info) => {
    test.setTimeout(9 * 60_000);
    const log = new Log(page, outDir(info, mission.id));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    try {
      await boot(log);
      const marker = await goToMarker(log, mission);
      await sleep(page, 800);
      await log.shot('at-marker');
      const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
      // run 6: an adventure's animals live in the world before it starts (nothing pops in)
      const fam = await homeOf(page, mission.id);
      if (fam) log.soft(fam.state === 'before' && fam.actors.some((a) => a.visible), `the story's animals are in the world before the mission (${fam.state})`);
      await start(log, mission);
      await playSteps(log, mission);
      await finish(log, mission);
      await worldReacted(log, mission, marker, before);
      log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
    } finally {
      const text = log.write();
      await info.attach('notes', { body: text, contentType: 'text/plain' });
      if (!process.env.MISSIONS_QUIET) console.log(`\n── ${mission.id} ──\n${text}`);
    }
  });
}

test('the season finale: the last mission ends the season, then the world is calm and free @missions', async ({ page, context }, info) => {
  test.setTimeout(9 * 60_000);
  const last = missions[missions.length - 1];
  // a returning ranger: every other mission done, the poacher not yet reported
  const voltooid = Object.fromEntries(missions.filter((m) => m.id !== last.id).map((m) => [m.id, true]));
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { voltooid, avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } });
  const log = new Log(page, outDir(info, 'finale'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try {
    await boot(log);
    await sleep(page, 2_500);
    await log.shot('nine-done');
    const marker = await goToMarker(log, last);
    const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
    await start(log, last);
    await playSteps(log, last);
    await finish(log, last, 'finale');
    // the reward leads on to the season's ending: the ontknoping (not reported yet), then the finale
    await click(log, /^Verder$/, 'reward → season end');
    const beats = AREA_VELUWE.verhaalboog.ontknoping;
    for (const [i, beat] of beats.entries()) {
      await expect.poll(async () => (await uiText(page)).includes(beat.tekst.split(' ').slice(0, 3).join(' ')), { timeout: 8_000, message: `ontknoping beat ${i + 1}` }).toBe(true);
      await log.shot(`ontknoping-${i + 1}`);
      await click(log, i === beats.length - 1 ? 'Klaar' : 'Verder', `ontknoping ${i + 1}`);
    }
    const fin = AREA_VELUWE.verhaalboog.finale;
    await expect.poll(async () => (await uiText(page)).includes(fin.titel), { timeout: 8_000, message: 'the season finale card' }).toBe(true);
    await sleep(page, 600);
    await log.shot('finale');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alvah-ef-v1') ?? '{}').ranger?.arc?.gemeld);
    log.soft(saved === true, 'the poacher is reported (arc.gemeld) after the ontknoping');
    await click(log, 'Verder op patrouille', 'finale');
    await worldReacted(log, last, marker, before);
    // the calm, free world: nothing to point at any more, the ranger walks on
    const hud = await uiText(page);
    log.soft(!missions.some((m) => hud.includes(m.titel) && !hud.includes(`Speel nog eens: ${m.titel}`)), 'no mission is offered any more (all done)');
    log.soft(await page.locator('.explore-klaar').isVisible().catch(() => false), 'the HUD says the season is done ("Alle missies klaar")');
    const p0 = (await snap(page)).p!;
    await page.keyboard.down('ArrowUp'); await sleep(page, 1_200); await page.keyboard.up('ArrowUp');
    const p1 = (await snap(page)).p!;
    log.soft(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.8, 'the ranger walks on after the finale');
    // every marker reads "klaar": its flag stands there
    const all = await R<(P2 & { missionId: string })[]>(page, 'r.markers()');
    const unflagged: string[] = [];
    for (const m of all) {
      const seats = await R<Seat[] | null>(page, `r.seating(${m.x}, ${m.z}, ${SEAT_RADIUS})`);
      if (!seats?.some((x) => x.id.startsWith('klaar-flag'))) unflagged.push(m.missionId);
    }
    log.soft(unflagged.length === 0, `markers without their "klaar" flag: ${unflagged.join(', ')}`);
    await page.keyboard.down('ArrowDown'); await sleep(page, 1_500); await page.keyboard.up('ArrowDown');
    await sleep(page, 800);
    await log.shot('free-world');
    // and a reload keeps it all
    await page.reload();
    await click(log, 'Begin', 'title after reload', 30_000);
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
    await sleep(page, 3_000);
    const seats = await R<Seat[] | null>(page, `r.seating(${marker.x}, ${marker.z}, ${SEAT_RADIUS})`);
    log.soft(!!seats?.some((x) => x.id.startsWith('klaar-flag')), 'after a reload the finished marker still has its flag');
    await log.shot('after-reload');
    log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── finale ──\n${text}`);
  }
});

/** The 2D floors a reduced-motion player gets, played with real clicks: zoeken (click
 *  the hidden animal, then Verder), corsi (watch the route light up, click it back). */
async function play2dFloor(log: Log): Promise<boolean> {
  const page = log.page;
  const vis = (sel: string): Promise<boolean> => page.locator(sel).first().isVisible().catch(() => false);
  if (await vis('.zoeken-card .btn-start')) {
    const cover = await uncovered(page.locator('.zoeken-card .btn-start'));
    log.soft(cover === null, `the zoeken found card's Verder is covered by ${cover}`);
    await page.locator('.zoeken-card .btn-start').click();
    return true;
  }
  if (await vis('.zoeken-target')) { await page.locator('.zoeken-target').click(); return true; }
  if (await vis('.route-intro .btn-start')) {
    await page.locator('.route-intro .btn-start').click();
    const order: number[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 25_000) {
      const s = await page.evaluate(() => {
        const spots = [...document.querySelectorAll<HTMLButtonElement>('.route-spot')];
        return { act: spots.findIndex((b) => b.classList.contains('active')), enabled: spots.some((b) => !b.disabled) };
      });
      if (s.act >= 0 && order[order.length - 1] !== s.act) order.push(s.act);
      if (s.enabled) break;
      await sleep(page, 40);
    }
    for (const i of order) { await page.locator('.route-spot').nth(i).click(); await sleep(page, 300); }
    log.note(`corsi 2D: watched and clicked back ${order.length} stones`);
    return true;
  }
  return false;
}

test('reduced motion: mission 1 on the 2D floors with real clicks, and its reunion is a cut @missions', async ({ page }, info) => {
  test.setTimeout(6 * 60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const log: Log = new Log(page, outDir(info, 'reduced-motion'));
  const mission = missions[0];
  try {
    await boot(log);
    const marker = await goToMarker(log, mission);
    const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
    await start(log, mission);
    const t0 = Date.now();
    const skin = (i: number): Skin => mission.stappen[i].skin as Skin;
    const answers = new Set(mission.stappen.flatMap((_, i) => (skin(i).encounters ?? []).flatMap((e) => e.opties.filter((o) => o.goed).map((o) => o.label))));
    const views = new Set<string>();
    while (!(await save(page))?.voltooid[mission.id] && Date.now() - t0 < 4 * 60_000) {
      const v = await R<string | null>(page, 'r.missionView');
      if (v) views.add(v);
      if (await play2dFloor(log)) { await sleep(page, 500); continue; }
      const choice = page.locator('button.p3-choice:not([disabled]), button.choice-opt:not([disabled])');
      let answered = false;
      for (let i = 0; i < await choice.count(); i++) {
        if (answers.has((await choice.nth(i).innerText()).trim())) { await choice.nth(i).click(); answered = true; break; }
      }
      if (answered) { await sleep(page, 1_800); continue; }
      if (await visible(page, /^(Verder|Klaar)$/)) { await click(log, /^(Verder|Klaar)$/, 'card'); await sleep(page, 400); continue; }
      await sleep(page, 250);
    }
    log.hard(!!(await save(page))?.voltooid[mission.id], 'mission 1 was not won on the reduced-motion floors');
    log.note(`views served: ${[...views].join(', ')}`);
    log.soft(views.has('2d'), 'reduced motion serves the 2D floor for zoeken + corsi');
    // the reunion is a cut: the moment the line shows, the family already stands in its place
    // (run 6: the rotte LIVES at its wallow, the mission's home — the lost piglet is simply
    // there with his mother; the marker gets its "klaar" flag)
    await expect.poll(() => page.locator('.reunion-cap').isVisible().catch(() => false), { timeout: 8_000 }).toBe(true);
    await sleep(page, 300);
    const places = await R<Record<string, P2> | null>(page, `r.missionPlaces(${JSON.stringify(mission.id)})`);
    const fam = await homeOf(page, mission.id);
    const at = (h: Home | null, key: string) => h?.actors.find((a) => a.key === key) ?? null;
    const lost0 = at(fam, 'lost'), sow0 = at(fam, 'sow');
    log.note(`at the first frame of the reunion the home is "${fam?.state}", the lost piglet ${lost0 && sow0 ? Math.hypot(lost0.x - sow0.x, lost0.z - sow0.z).toFixed(2) : '?'} m from his mother`);
    log.soft(fam?.state === 'after' && !!lost0 && !!sow0 && Math.hypot(lost0.x - sow0.x, lost0.z - sow0.z) < 2.2,
      'under reduced motion the family is together at its home at once (a cut, no walk-in)');
    if (places?.home) log.soft(!!lost0 && Math.hypot(lost0.x - places.home.x, lost0.z - places.home.z) < 3, 'the piglet is home at the wallow');
    await sleep(page, 1_200);
    const lost1 = at(await homeOf(page, mission.id), 'lost');
    log.soft(!!lost0 && !!lost1 && Math.hypot(lost1.x - lost0.x, lost1.z - lost0.z) < 0.05, 'nothing walks in after the cut (reduced motion holds them still)');
    const now = await worldSamples(page, marker, SEAT_RADIUS, 1);
    log.soft(now[0].some((x) => x.id.startsWith('klaar-flag')), 'the "klaar" flag stands at the marker');
    await log.shot('reunion-cut');
    await finish(log, mission);
    await worldReacted(log, mission, marker, before);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── reduced-motion ──\n${text}`);
  }
});

test('the bird bench on the 2D floor (Tweaks "altijd 2D"): RoepView plays and hands the world back @missions', async ({ page, context }, info) => {
  test.setTimeout(6 * 60_000); // 1.4 min alone; ran out of 4 min with other worlds on the GPU
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true, force2d: true } });
  const log: Log = new Log(page, outDir(info, 'roep-2d'));
  try {
    await boot(log);
    const sit = await R<{ x: number; z: number } | null>(page, 'r.sitSpot()');
    log.hard(!!sit, 'no sit-spot');
    const w = await walkTo(page, sit!, { stopDist: 1.0, timeout: 90_000 });
    log.note(`walked to the bench: ${w.res} in ${(w.ms / 1000).toFixed(1)} s`);
    await click(log, 'Luister naar de vogels', 'bench');
    await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 5_000 }).toBe('2d');
    await click(log, 'Luister', 'roep intro');
    const byCall: Record<string, string> = { 'Krok krok': 'raaf', Koekoek: 'koekoek', fluitliedje: 'merel', 'Tik tik': 'roodborsttapuit', 'Kju kju': 'groene specht', 'Ti ta': 'koolmees' };
    let n = 0;
    const t0 = Date.now();
    while ((await page.locator('.roep').count()) && Date.now() - t0 < 90_000) {
      const call = await page.locator('.rc-text').innerText().catch(() => '');
      const key = Object.keys(byCall).find((k) => call.includes(k));
      const b = key ? page.getByRole('button', { name: byCall[key], exact: true }) : null;
      if (b && await b.isEnabled().catch(() => false)) {
        if (!n) await log.shot('roep-2d');
        await b.click(); n += 1; await sleep(page, 1_500); continue;
      }
      await sleep(page, 250);
    }
    log.note(`answered ${n} calls by the words on screen`);
    log.soft(n >= 3, 'the roep rounds were played');
    await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
      { timeout: 10_000, message: 'the bench hands the world back' }).toBe(true);
    const p0 = (await snap(page)).p!;
    await page.keyboard.down('ArrowUp'); await sleep(page, 1_000); await page.keyboard.up('ArrowUp');
    let p1 = (await snap(page)).p!;
    // the bench stands by a pine: facing its trunk, a child backs up instead (run 6: the
    // brisker walk can end the walk-in facing it)
    if (Math.hypot(p1.x - p0.x, p1.z - p0.z) <= 0.6) {
      await page.keyboard.down('ArrowDown'); await sleep(page, 1_000); await page.keyboard.up('ArrowDown');
      p1 = (await snap(page)).p!;
    }
    log.soft(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.6, 'the ranger walks on after the bench');
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── roep-2d ──\n${text}`);
  }
});

test('a mission picked on the missiebord: played at its OWN marker (the pick brings him there), its family comes home there @missions', async ({ page }, info) => {
  test.setTimeout(8 * 60_000);
  const log: Log = new Log(page, outDir(info, 'missiebord'));
  const mission = missions[0];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try {
    await boot(log);
    const all = await R<(P2 & { missionId: string })[]>(page, 'r.markers()');
    const m = all.find((x) => x.missionId === mission.id)!;
    const marker = { x: m.x, z: m.z };
    const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
    const board = await R<P2 | null>(page, 'r.board()');
    log.hard(!!board, 'no missiebord');
    const w = await walkTo(page, board!, { stopDist: 1.6, timeout: 60_000 });
    log.note(`walked to the missiebord: ${w.res}`);
    await click(log, 'Bekijk het missiebord', 'board prompt');
    await sleep(page, 700);
    await page.locator(`.mission-card[data-id="${mission.id}"]`).click();
    await sleep(page, 700);
    await page.evaluate(() => {
      const win = window as unknown as { __reunion?: string };
      win.__reunion = '';
      new MutationObserver(() => {
        const el = document.querySelector('.reunion-cap') as HTMLElement | null;
        if (el && !win.__reunion) win.__reunion = el.innerText;
      }).observe(document.getElementById('ui')!, { childList: true, subtree: true });
    });
    await click(log, 'Ga op pad', 'briefing');
    await expect.poll(() => R<string | null>(page, 'r.missionView'), { timeout: 10_000, message: 'the mission never started' }).not.toBeNull();
    await playSteps(log, mission);
    await finish(log, mission);
    await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
      { timeout: 15_000, message: 'the reward never led back to the world' }).toBe(true);
    // the pick brought him to its marker (wave 4, parent B6): it was played there, in view.
    // Run 6: an adventure plays on from its marker to its home (the rotte's wallow), so he
    // ends at one of the two; the family lives at the home, together, in the after state
    const at = (await snap(page)).p!;
    const places = await R<Record<string, P2> | null>(page, `r.missionPlaces(${JSON.stringify(mission.id)})`);
    const dM = Math.hypot(at.x - marker.x, at.z - marker.z);
    const dH = places?.home ? Math.hypot(at.x - places.home.x, at.z - places.home.z) : Infinity;
    log.soft(Math.min(dM, dH) < (places?.home ? 6 : 2.4), `the mission picked on the board was played ${r2d(dM)} m from its marker${places?.home ? `, ${r2d(dH)} m from its home` : ''}`);
    await sleep(page, 3_000);
    await log.shot('at-home');
    const after = await worldSamples(page, marker, SEAT_RADIUS, 3);
    log.soft(after[0].some((s) => s.id.startsWith('klaar-flag')), 'the "klaar" flag stands at its marker');
    void worldChange(before, after);
    const fam = await homeOf(page, mission.id);
    const home = places?.home ?? marker;
    const members = fam?.actors.filter((a) => a.visible) ?? [];
    log.note(`at its home: ${members.length} of the family (${members.map((a) => `${a.key} ${r2d(Math.hypot(a.x - home.x, a.z - home.z))} m`).join(', ')})`);
    log.soft(fam?.state === 'after' && members.length >= 5, 'the sow and her piglets are together at their home');
    log.soft(members.every((a) => Math.hypot(a.x - home.x, a.z - home.z) < 4), 'the family stands right at its home, not metres off');
    const seats = await R<Seat[] | null>(page, `r.seating(${home.x}, ${home.z}, 4)`);
    const off = (seats ?? []).filter((s) => s.moves && Math.abs(s.gap) > SEAT_TOLERANCE && !s.id.includes('ranger'));
    log.soft(off.length === 0, `the family stands on the ground: ${off.slice(0, 3).map((s) => `${s.id.split('@')[0]} ${s.gap} m`).join('; ')}`);
    log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── missiebord ──\n${text}`);
  }
});

test('the sporenboek at 1280×800: with every clue found, "Volg het spoor" is in view and opens the ontknoping @missions', async ({ page, context }, info) => {
  test.setTimeout(3 * 60_000);
  const voltooid = Object.fromEntries(missions.slice(0, -1).map((m) => [m.id, true]));
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { voltooid, avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } });
  const log: Log = new Log(page, outDir(info, 'sporenboek'));
  try {
    await boot(log);
    await click(log, /Pauze/, 'HUD');
    await sleep(page, 500);
    await page.locator('.ph-prikbord').click();
    const btn = page.getByRole('button', { name: 'Volg het spoor', exact: true });
    await btn.waitFor({ state: 'visible', timeout: 5_000 });
    await sleep(page, 500);
    await log.shot('sporenboek');
    const box = await btn.boundingBox();
    log.hard(!!box, 'no "Volg het spoor" button');
    log.soft(box!.y >= 0 && box!.y + box!.height <= 800, `"Volg het spoor" is below the fold (${Math.round(box!.y)}-${Math.round(box!.y + box!.height)} px)`);
    const cover = await uncovered(btn);
    log.soft(cover === null, `"Volg het spoor" is covered by ${cover}`);
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2); // where the player sees it: no scrolling
    const first = AREA_VELUWE.verhaalboog.ontknoping[0].tekst.split(' ').slice(0, 3).join(' ');
    const opened = await expect.poll(async () => (await uiText(page)).includes(first), { timeout: 5_000 }).toBe(true).then(() => true, () => false);
    log.soft(opened, 'a click on "Volg het spoor" opens the ontknoping');
    await log.shot('ontknoping');
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── sporenboek ──\n${text}`);
  }
});

const r2d = (n: number): number => Math.round(n * 10) / 10;
