import { test, expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREA_VELUWE } from '../src/content/veluwe';
import { followLook } from '../src/render3d/adventure/missions/frisling.grow';
import {
  R, playSeed, replayTail, save, sleep, snap, uncovered, visibleButtons, walkTo, worldChange, worldSamples,
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
  /** run 7: the seed of the play running now (a hard failure prints its replay URL) */
  seed: number | null = null;
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
    if (!ok) { const m = `${msg}${replayTail(this.seed)}`; this.notes.push(`✗✗ ${m}`); throw new Error(m); }
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

/** Run 7: `RANGER_SEED=N` replays a session's plays from seed N (`?seed=`: the first play
 *  draws N; unset, a fresh seed); `RANGER_MOOD=<id>` plays every mission in that mood
 *  (`?mood=`; unset, a fresh save's first visit: the golden hour). */
const SEED = process.env.RANGER_SEED ? `&seed=${process.env.RANGER_SEED}` : '';
const MOOD = process.env.RANGER_MOOD ? `&mood=${encodeURIComponent(process.env.RANGER_MOOD)}` : '';

/** Begin → the ranger maker (a fresh save) → the world. */
async function boot(log: Log): Promise<void> {
  const page = log.page;
  await page.goto(`/?dev=1${SEED}${MOOD}`);
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
  // run 7: the play's seed (its variety), so a failing run can be replayed
  log.seed = await playSeed(page);
  if (log.seed !== null) log.note(`seed ${log.seed}`);
}

/** Every step, with real input, until each one is won (golden.spec step 6's player). Run 6:
 *  an adventure plays its steps as beats in the world, interleaved — walk hints are walked
 *  with the arrow keys, an encounter is answered from ANY step of the mission, an action
 *  button is pressed, and "won" = every step's trial count went up. A beat that takes no
 *  input (a body moment: keep still) is simply waited out. */
async function playSteps(log: Log, mission: Mission, stopWhen?: () => Promise<boolean>,
  /** run 7 (additive): looks on at every turn of the loop (a mission's own soft checks) */
  observe?: (adv: { beat: string; stats?: Record<string, number> } | null) => Promise<void>,
  /** run 7 (additive): while true the player keeps his hands off the keys (a test makes a
   *  child's mistake at that moment: waits too long, runs) — a walk under way stops too */
  paused?: () => boolean): Promise<void> {
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
  let stats: Record<string, number> = {};
  const deadline = Date.now() + 9 * 60_000;
  const t0 = Date.now();
  // an adventure may play on after its last step (a walk, an action, a card) until its
  // reunion marks the mission done: the loop plays those beats too
  const playingOn = async (): Promise<boolean> =>
    !!(await R<{ beat: string } | null>(page, 'r.adventure()')) && !(await save(page))?.voltooid[mission.id];
  while ((won.size < Object.keys(need).length || await playingOn()) && Date.now() < deadline) {
    const sv = await save(page);
    for (const ef of Object.keys(need)) {
      if (!won.has(ef) && sv && (sv.trials[ef] ?? 0) - (base[ef] ?? 0) >= need[ef]) {
        won.add(ef);
        log.note(`${ef}: won (${clicks} click(s) on 3D targets, ${answers} answer(s), ${walks} walk(s) so far)`);
        await log.shot(`${ef}-won`);
        lastProgress = Date.now();
      }
    }
    if (won.size >= Object.keys(need).length && !await playingOn()) break;
    if (stopWhen && await stopWhen()) return; // (a test that stops the mission part way)
    if (paused?.()) { await sleep(page, 150); lastProgress = Date.now(); continue; }
    const view = await R<string | null>(page, 'r.missionView');
    if ((await R<string>(page, 'r.screen')) === 'world' && view === null) {
      ended ??= Date.now();
      log.hard(Date.now() - ended < 3_000, `the mission ended before every step was won (won: ${[...won].join(', ') || 'none'})`);
    } else ended = null;
    if (Date.now() - lastProgress > 45_000) {
      await log.shot('stuck');
      log.hard(false, `stuck for 45 s at "${lastBeat}" (visible: ${await visibleButtons(page)})`);
    }
    const adv = await R<{ beat: string; stats?: Record<string, number> } | null>(page, 'r.adventure()');
    if (adv?.stats) stats = adv.stats; // (run 7: the walks' own measures)
    if (observe) await observe(adv);
    const calls = await R<number | null>(page, 'r.drawCalls()');
    if (calls !== null && calls >= MAX_DRAW_CALLS) bad.push(`draw calls ${calls} at "${adv?.beat ?? view}"`);
    if (adv && adv.beat !== lastBeat) {
      lastBeat = adv.beat;
      lastProgress = Date.now(); // (run 7: a new beat is the play going on — two calm moments
      // in a row, each with a reach and its words, take longer than 45 s without a click)
      await sleep(page, 1_000);
      await log.shot(`beat-${adv.beat.replace(/[^a-z0-9]+/gi, '-')}`);
    }
    // (a0) a walk hint: walk there with the arrow keys, until the hint changes
    const h0 = await R<Hint | null>(page, 'r.playHint()');
    if (h0?.walk) {
      const w = await walkTo(page, { x: h0.walk.x, z: h0.walk.z }, {
        stopDist: h0.walk.r, timeout: 90_000, stopWhen: async () => !!paused?.() || (await R<Hint | null>(page, 'r.playHint()'))?.id !== h0.id,
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
      // run 7: a hidden animal is never in the middle of the search picture
      if (adv?.beat === 'search' && h.id === 'target') {
        const off = Math.hypot(h.x - 640, h.y - 400);
        log.note(`the search's target lies ${off.toFixed(0)} px from the middle of the picture`);
        if (mission.id === 'frisling') log.soft(off >= 120, `the piglet lies ${off.toFixed(0)} px from the middle of the search picture (want ≥ 120)`);
      }
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
  // run 7: the frisling's lead home is a straight walk at the piglet's pace (1.5 m/s)
  if (mission.id === 'frisling' && stats.walk_field_line !== undefined) {
    const lead = stats.walk_field_line;
    log.note(`the lead home is ${lead} m: walked ${stats.walk_field_m} m in ${stats.walk_field_dur} s (the piglet dived ${stats.walk_field_dives ?? 0}×, waited ${stats.walk_field_waits ?? 0}×)`);
    log.soft(!stats.walk_field_waits && !stats.walk_field_dives, `walking calmly, the piglet fell behind and waited ${stats.walk_field_waits ?? 0}× (dived ${stats.walk_field_dives ?? 0}×)`);
    log.soft(stats.walk_field_m <= lead * 1.6, `the lead took ${stats.walk_field_m} m of walking for ${lead} m (want ≤ 1.6×)`);
    log.soft(stats.walk_field_dur <= (lead / 1.5) * 1.6, `the lead took ${stats.walk_field_dur} s for ${lead} m (want ≤ ${((lead / 1.5) * 1.6).toFixed(1)} s)`);
    // following the squeak the way the prints go never comes near the sow (steen passes them)
    log.soft(!stats.walkround_notice, `following the hints, the sow noticed him ${stats.walkround_notice}× ('Niet zo dichtbij')`);
  }
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
  log.soft(near(marker) || (!!home && near(home)), `back in the world near the marker (or the mission's home): ${s.p ? Math.hypot(s.p.x - marker.x, s.p.z - marker.z).toFixed(1) : '?'} m / ${s.p && home ? Math.hypot(s.p.x - home.x, s.p.z - home.z).toFixed(1) : '?'} m`);
  // run 6: an adventure's family lives at its home, in its after state, together there
  let fam = await homeOf(page, mission.id);
  if (fam && home) {
    // (run 7: a family that met far from its home this play walks there calmly once the
    // mission is done: it gets the time a walk takes, ≤ 25 s, before it is judged)
    const away = (f: Home): Home['actors'] => f.actors.filter((a) => a.visible && Math.hypot(a.x - home.x, a.z - home.z) > 4);
    for (let i = 0; i < 50 && away(fam).length; i++) { await sleep(page, 500); fam = (await homeOf(page, mission.id)) ?? fam; }
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

/**
 * Run 7 (the reekalf, design state/ree §2): soft checks of a play's own morning — where the
 * calf lies in the search's picture (never in the middle: its hint point outside the
 * central box, under the objective line, clear of the edges), how much of its back shows,
 * how high the search's lens hangs, and that the walks to the grass and to the hide are
 * walks. Read while it plays (the stats are gone once it ends).
 */
function reeWatch(log: Log, opts: { practised?: boolean } = {}): { observe: (adv: { beat: string; stats?: Record<string, number> } | null) => Promise<void>; report: () => void; cards: () => Promise<void> } {
  const page = log.page;
  let target: { x: number; y: number } | null = null;
  let lens: number | null = null;
  /** the level's share of the calf's back (`knobs.glimpse`), read as the search shows it */
  let share: number | null = null;
  let stats: Record<string, number> = {};
  let variant = '';
  let carding = false;
  return {
    async observe(adv) {
      if (!adv) return;
      if (adv.stats) stats = adv.stats;
      // (review r2, ree-discover: each new find's card, with the beat it came in — the page
      // notes it the moment it shows, also on a walk the loop is busy walking)
      if (!carding) {
        carding = true;
        await page.evaluate(() => {
          const w = window as unknown as { __cards?: string[]; __ranger?: { adventure(): { beat: string } | null } };
          w.__cards = [];
          let last = '';
          new MutationObserver(() => {
            const n = document.querySelector('.reveal .rv-name')?.textContent ?? '';
            if (n && n !== last) w.__cards!.push(`${n}@${w.__ranger?.adventure()?.beat ?? '-'}`);
            last = n;
          }).observe(document.getElementById('ui')!, { childList: true, subtree: true, characterData: true });
        });
      }
      if (!variant) variant = String((await R<{ variant?: Record<string, string> } | null>(page, 'r.play ? r.play() : null'))?.variant?.ree ?? '');
      if (adv.beat !== 'search' || target) return;
      // (before the player clicks: wait for the framed view to settle on the target)
      let h: Hint | null = null;
      for (let i = 0; i < 30 && !target; i++) {
        const h2 = await R<Hint | null>(page, 'r.playHint()');
        if (h2 && !h2.walk && h && h2.id === h.id && Math.hypot(h2.x - h.x, h2.y - h.y) < 2) target = { x: h2.x, y: h2.y };
        h = h2 && !h2.walk ? h2 : null;
        if (!target) await sleep(page, 200);
      }
      if (!target) return;
      const cam = await R<{ x: number; y: number; z: number } | null>(page, 'r.cam()');
      if (cam) lens = cam.y - (await R<number>(page, `r.groundAt(${cam.x}, ${cam.z})`));
      share = (await R<Record<string, { knobs: { glimpse?: number } }> | null>(page, 'r.skills()'))?.zoeken?.knobs?.glimpse ?? null;
    },
    async cards() {
      // (no card lands on the twin coming to its mother: a waiting one shows with the reunion)
      const cards = await page.evaluate(() => (window as unknown as { __cards?: string[] }).__cards ?? []).catch(() => [] as string[]);
      log.note(`ree: new finds' cards ${cards.join(', ') || 'none'}`);
      log.soft(!cards.some((c2) => c2.endsWith('@twin:comes')), `ree: a card came while the twin came to its mother (${cards.join(', ')})`);
      // (review r2: what he meets on a walk has its card on a walk, never held for the reunion)
      const off = cards.filter((c2) => /^(De leeuwerik|De buizerd|Het geschuurde boompje)@/.test(c2) && !/@walk:/.test(c2));
      log.soft(!off.length, `ree: a walk's find had its card away from the walks (${off.join(', ')})`);
    },
    report() {
      log.note(`ree: morning ${variant || '?'}; calf hint at ${target ? `(${Math.round(target.x)}, ${Math.round(target.y)})` : '?'}; lens ${lens?.toFixed(2) ?? '?'} m over the ground; glimpse ${stats.glimpse}; walks ${stats.walk_meadow_m} m to the grass, ${stats.walk_hide_m} m to the hide`);
      log.soft(!!target, 'ree: the search\'s target was seen');
      if (target) {
        const dx = Math.abs(target.x - 640), dy = Math.abs(target.y - 400);
        log.soft(dx >= 160 || dy >= 110, `ree: the calf lies in the middle of the search's picture (${Math.round(target.x)}, ${Math.round(target.y)})`);
        log.soft(target.y >= 120 && target.x >= 90 && target.x <= 1190 && target.y <= 710, `ree: the calf lies under the objective line or at an edge (${Math.round(target.x)}, ${Math.round(target.y)})`);
      }
      // run 7 (ree-growth): how much of the calf shows is the level's (`glimpse`): a fresh
      // save sees ~0.4 of its back, a practised one (~4.5) clearly less; the holds, the
      // mother's listening pauses and the wait before the flip counts are the level's too
      if (opts.practised) {
        log.soft(stats.glimpse >= 0.15 && stats.glimpse <= 0.32, `ree (practised): the calf's glimpse is ${stats.glimpse} (≤ 0.32)`);
        log.soft(stats.hold_s >= 4, `ree (practised): a hold wants ${stats.hold_s} s (≥ 4)`);
        log.soft(stats.watch_pauses >= 2 && stats.go_moeder_wait <= 6, `ree (practised): ${stats.watch_pauses} listening pauses, the flip waits ${stats.go_moeder_wait} s`);
      } else {
        log.soft(stats.glimpse >= 0.33 && stats.glimpse <= 0.6, `ree: the calf's glimpse is ${stats.glimpse} (0.33-0.6)`);
        log.soft(stats.watch_pauses === 1 && stats.go_moeder_wait >= 8, `ree: a fresh save: ${stats.watch_pauses} listening pause, the flip waits ${stats.go_moeder_wait} s`);
      }
      // (review r1, ree-growth: the search shows the level's own share, never a level's off:
      // in [glimpse, glimpse + 0.07] as the search's lens sees it)
      if (share !== null) log.soft(stats.glimpse >= share - 1e-6 && stats.glimpse <= share + 0.07 + 1e-6, `ree: the calf's glimpse ${stats.glimpse} is the level's (${share}-${(share + 0.07).toFixed(2)})`);
      // ("Daar is de moeder!" as she is first seen, out from behind her bushes: review r1
      // heard it 5-8 s before she showed)
      log.soft(stats.watch_out_lag !== undefined && stats.watch_out_lag >= 0 && stats.watch_out_lag <= 0.5, `ree: "Daar is de moeder!" ${stats.watch_out_lag} s after she is seen`);
      log.note(`ree: look-alikes ${stats.look_alikes}, hold ${stats.hold_s} s, calf wobble ${stats.calf_wobble}, print gaps ${stats.print_gaps}, watch ${stats.watch_s} s (${stats.watch_listens} pauses, unseen ${stats.watch_hidden_s} s), walked away after ${stats.go_moeder ?? 0} wrong (stood ${stats.go_moeder_stay ?? 0}, closer ${stats.go_moeder_closer ?? 0})`);
      log.soft(stats.watch_s >= 18 && stats.watch_s <= 45, `ree: the watch lasts ${stats.watch_s} s`);
      // (the frisling's search lens hangs 3.8 m over the ground; the ree's at that height
      // stands 4.2 m from his head, where the old one stood 3 m from it and looked down on it)
      log.soft(lens !== null && lens <= 4.1, `ree: the search's lens hangs ${lens?.toFixed(2)} m over the ground`);
      log.soft(stats.walk_meadow_m >= 9, `ree: the walk to the grass is ${stats.walk_meadow_m} m`);
      log.soft(stats.walk_hide_m >= 11, `ree: the walk to the hide is ${stats.walk_hide_m} m`);
      // run 7 (ree-discover): what there was to notice this morning, and how big it showed
      // (the play's `vr` note says which small things it held); a twin is laid out of his
      // picture, never at the last moment in view
      const finds = ['leeuwerik', 'buizerd', 'koekoek', 'tweeling', 'tapuit', 'vlinder'].filter((f) => stats[f]);
      log.note(`ree: to notice ${finds.join(', ') || 'none'}${stats.birch_x !== undefined ? `, a rubbed birch at (${stats.birch_x}, ${stats.birch_z})` : ''}; seen ${Object.entries(stats).filter(([k2]) => k2.startsWith('px_')).map(([k2, v]) => `${k2.slice(3)} ${v} px`).join(', ')}`);
      if (stats.tweeling) log.soft(stats.twin_laid === 1, `ree: the twin was laid out of his picture (${stats.twin_laid})`);
    },
  };
}

/**
 * Run 7 (frisling growth, design state/frisling §3, §5.8): the frisling plays the level's
 * knobs — the same knobs its 2D floor reads — and invents none of its own: as many
 * look-alikes in the stand, as much of the piglet showing, the first hint as late, the
 * prints as far apart and as faint, the route's rounds and start, the free path's wait.
 * Read while it plays (the stats are gone once it ends); the knobs are read at its start.
 */
type Knobs = {
  zoeken: { lookAlikes: number; glimpse: number; hintAfterS: number; trailLegs: number; trailClarity: number };
  corsi: { start: number; rounds: number; max: number };
  dagnacht: { holdS: number; tempts: number; goWaitS: number };
};
function frislingWatch(log: Log, opts: { practised?: boolean } = {}): { observe: (adv: { beat: string; stats?: Record<string, number> } | null) => Promise<void>; report: () => Promise<void> } {
  const page = log.page;
  let knobs: Knobs | null = null;
  let stats: Record<string, number> = {};
  return {
    async observe(adv) {
      if (!knobs) {
        const sk = await R<Record<string, { knobs: unknown }> | null>(page, 'r.skills()');
        if (sk) knobs = { zoeken: sk.zoeken.knobs, corsi: sk.corsi.knobs, dagnacht: sk.dagnacht.knobs } as Knobs;
      }
      if (adv?.stats) stats = adv.stats;
    },
    async report() {
      if (!knobs) { log.soft(false, 'frisling: the knobs were never read'); return; }
      const z = knobs.zoeken, d = knobs.dagnacht;
      const look = followLook(z);
      log.note(`frisling knobs: ${JSON.stringify(knobs)}`);
      log.note(`frisling played: ${stats.look_alikes} look-alikes, glimpse ${stats.glimpse}, hint after ${stats.search_hint_after} s, prints ${stats.print_gap} m apart at ${stats.print_opacity}, a squeak every ${stats.squeak_every} s, route ${stats.route_rounds} round(s) to ${stats.route_span}, hold ${stats.hold_s} s (pulls ${stats.pull_aaien ?? '-'}/${stats.pull_voeren ?? '-'}/${stats.pull_zeug ?? '-'}/${stats.pull_dragen ?? '-'}), tired walk ${stats.pace_len} m, the path's wait ${stats.pad_wait_s} s`);
      log.soft(stats.look_alikes === z.lookAlikes, `frisling: ${stats.look_alikes} look-alikes in the stand, the level's ${z.lookAlikes}`);
      log.soft(stats.glimpse >= z.glimpse * 0.6 && stats.glimpse <= z.glimpse * 1.6, `frisling: the piglet's glimpse ${stats.glimpse} is the level's (${z.glimpse})`);
      log.soft(stats.search_hint_after === z.hintAfterS, `frisling: the first hint after ${stats.search_hint_after} s, the level's ${z.hintAfterS}`);
      log.soft(stats.print_gap === look.gap && stats.print_opacity === look.opacity && stats.squeak_every === look.squeakEvery[0],
        `frisling: the follow's prints ${stats.print_gap} m apart at ${stats.print_opacity}, a squeak every ${stats.squeak_every} s (the level's ${look.gap} / ${look.opacity} / ${look.squeakEvery[0]})`);
      log.soft(stats.route_rounds === knobs.corsi.rounds, `frisling: the route plays ${stats.route_rounds} round(s), the level's ${knobs.corsi.rounds}`);
      log.soft(stats.pad_wait_s === d.goWaitS, `frisling: the free path waits ${stats.pad_wait_s} s, the level's ${d.goWaitS}`);
      // (each hold's temptations pull harder one after another: as many kinds as the level's)
      log.soft(stats.pull_zeug === Math.min(2, d.tempts - 1), `frisling: the sow's stare tempts up to pull ${stats.pull_zeug} (the level's ${d.tempts} temptation(s))`);
      if (opts.practised) {
        // (less of him shows than a first play's knob, 0.38: how much exactly is the nook's,
        // within the level's [0.6, 1.6]× checked above)
        log.soft(z.lookAlikes >= 6 && z.glimpse <= 0.25 && stats.glimpse < 0.38 && stats.print_gap >= 1.3, `frisling (practised): a harder search than a first play's (${stats.look_alikes} look-alikes, glimpse ${stats.glimpse} of the level's ${z.glimpse}, prints ${stats.print_gap} m apart)`);
        log.soft(stats.route_rounds >= 3 && d.goWaitS <= 6 && d.holdS >= 4.5, `frisling (practised): ${stats.route_rounds} routes, holds of ${d.holdS} s, the path waits ${d.goWaitS} s`);
      } else {
        log.soft(stats.look_alikes === 4 && stats.print_gap === 0.95 && stats.pad_wait_s === 9, `frisling (a first play): 4 look-alikes, prints 0.95 m apart, the path waits 9 s (${stats.look_alikes}, ${stats.print_gap}, ${stats.pad_wait_s})`);
      }
    },
  };
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
      // (a mission's own soft checks: the ree's also reads its finds' cards once it is over)
      const watch: { observe: (adv: { beat: string; stats?: Record<string, number> } | null) => Promise<void>; report: () => unknown; cards?: () => Promise<void> } | null =
        mission.id === 'ree-niet-aanraken' ? reeWatch(log) : mission.id === 'frisling' ? frislingWatch(log) : null;
      await playSteps(log, mission, undefined, watch?.observe);
      await watch?.report();
      await finish(log, mission);
      await watch?.cards?.();
      await worldReacted(log, mission, marker, before);
      log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
    } finally {
      const text = log.write();
      await info.attach('notes', { body: text, contentType: 'text/plain' });
      if (!process.env.MISSIONS_QUIET) console.log(`\n── ${mission.id} ──\n${text}`);
    }
  });
}

/** Run 7 (ree-growth): the reekalf on a PRACTISED save (zoeken and dagnacht at ~4.5, seeded in
 *  the save before the page loads): the same exercise visibly harder — less of the calf among
 *  more look-alikes, longer holds with more temptations, a more careful mother, a shorter
 *  wait before the flip counts — and the same summaries. Played like the fresh one. */
test('Het reekalf in het gras on a practised save: the same game, harder, with real input @missions', async ({ page, context }, info) => {
  test.setTimeout(9 * 60_000);
  const mission = missions.find((m) => m.id === 'ree-niet-aanraken')!;
  const rec = (level: number) => ({ level, best: level, reversals: [], recent: [true, true, true], trials: 40, beats: 20 });
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { skill: { zoeken: rec(4.5), dagnacht: rec(4.5) }, voltooid: { frisling: true }, avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } });
  const log = new Log(page, outDir(info, 'ree-practised'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try {
    await boot(log);
    const marker = await goToMarker(log, mission);
    await sleep(page, 800);
    const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
    await start(log, mission);
    const lv = await R<Record<string, { level: number }>>(page, 'r.skills()');
    log.note(`levels: zoeken ${lv?.zoeken?.level}, dagnacht ${lv?.dagnacht?.level}`);
    const watch = reeWatch(log, { practised: true });
    await playSteps(log, mission, undefined, watch.observe);
    watch.report();
    // the same summaries as on a fresh save: zoeken one trial, dagnacht five
    const hist = await R<{ e: string; m: string; n: number; lv: number }[]>(page, 'r.history()');
    const ree = (hist ?? []).filter((b) => b.m === mission.id);
    log.soft(ree.some((b) => b.e === 'zoeken' && b.n === 1 && b.lv >= 4) && ree.some((b) => b.e === 'dagnacht' && b.n === 5 && b.lv >= 4),
      `the beats logged at the practised level, the same trials (${JSON.stringify(ree.map((b) => [b.e, b.n, b.lv]))})`);
    await finish(log, mission);
    await watch.cards();
    await worldReacted(log, mission, marker, before);
    log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── ree-practised ──\n${text}`);
  }
});

/** Run 7 (frisling growth): De verdwaalde frisling on a PRACTISED save (zoeken, corsi and
 *  dagnacht at ~4.5, seeded in the save before the page loads; the frisling not yet played,
 *  so a seed draws the same way, nook and light as on a fresh save): the same exercises
 *  visibly harder — less of the piglet among more look-alikes, a later hint, prints further
 *  apart and fainter, more routes, longer holds that tempt harder, a shorter wait at the
 *  free path — and the same summaries, each beat logged with its level, seed and variant. */
test('De verdwaalde frisling on a practised save: the same game, harder, with real input @missions', async ({ page, context }, info) => {
  test.setTimeout(9 * 60_000);
  const mission = missions.find((m) => m.id === 'frisling')!;
  const rec = (level: number) => ({ level, best: level, reversals: [], recent: [true, true, true], trials: 40, beats: 20 });
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { skill: { zoeken: rec(4.5), corsi: rec(4.5), dagnacht: rec(4.5) }, avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } });
  const log = new Log(page, outDir(info, 'frisling-practised'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try {
    await boot(log);
    const marker = await goToMarker(log, mission);
    await sleep(page, 800);
    const before = await worldSamples(page, marker, SEAT_RADIUS, 3);
    await start(log, mission);
    const watch = frislingWatch(log, { practised: true });
    await playSteps(log, mission, undefined, watch.observe);
    await watch.report();
    // the same summaries as on a fresh save (zoeken one find, dagnacht five moments), each
    // at the practised level, with the play's seed and its way, family and nook
    const hist = await R<{ e: string; m: string; n: number; lv: number; st?: number; sd: number; va?: string }[]>(page, 'r.history()');
    const fr = (hist ?? []).filter((b) => b.m === mission.id);
    log.note(`history: ${JSON.stringify(fr.map((b) => [b.e, b.n, b.lv, b.st ?? null, b.sd, b.va]))}`);
    log.soft(fr.some((b) => b.e === 'zoeken' && b.n === 1 && b.lv >= 4) && fr.some((b) => b.e === 'corsi' && (b.st ?? 0) >= 4) && fr.some((b) => b.e === 'dagnacht' && b.n === 5 && b.lv >= 4),
      `the beats logged at the practised level, the same trials (${JSON.stringify(fr.map((b) => [b.e, b.n, b.lv]))})`);
    log.soft(fr.length >= 3 && fr.every((b) => b.sd === log.seed && /(^|,)way:[a-z]+\/[a-z]+\/\d+/.test(b.va ?? '')),
      `every frisling beat carries the play's seed and its way, family and nook (${JSON.stringify(fr.map((b) => [b.sd, b.va]))})`);
    await finish(log, mission);
    await worldReacted(log, mission, marker, before);
    log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── frisling-practised ──\n${text}`);
  }
});

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
    const hud = (await uiText(page)).replace(/\s+/g, ' '); // (the replay chip puts its title on a line of its own)
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
    // (the flags come in as their models load: on a busy machine that is seconds after
    // the world shows, so wait for it rather than a fixed moment)
    const flagged = async (): Promise<boolean> =>
      !!(await R<Seat[] | null>(page, `r.seating(${marker.x}, ${marker.z}, ${SEAT_RADIUS})`))?.some((x) => x.id.startsWith('klaar-flag'));
    const flagBack = await expect.poll(flagged, { timeout: 20_000 }).toBe(true).then(() => true, () => false);
    log.soft(flagBack, 'after a reload the finished marker still has its flag');
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
  // run 7: the route plays rounds (a new route shows by itself after one is walked back):
  // the intro starts the first; every route shown is watched in full, then clicked back,
  // until the route's panel is gone
  if (await vis('.route-intro .btn-start')) await page.locator('.route-intro .btn-start').click();
  else if (!(await page.locator('.route-spot').count())) return false;
  const spotsNow = (): Promise<{ act: number; enabled: boolean; gone: boolean }> => page.evaluate(() => {
    const spots = [...document.querySelectorAll<HTMLButtonElement>('.route-spot')];
    return { act: spots.findIndex((b) => b.classList.contains('active')), enabled: spots.some((b) => !b.disabled), gone: !spots.length };
  });
  for (let round = 1; round <= 8; round++) {
    const order: number[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 25_000) {
      const s = await spotsNow();
      if (s.gone) return true;
      if (s.act >= 0 && order[order.length - 1] !== s.act) order.push(s.act);
      if (s.enabled && order.length) break;
      await sleep(page, 40);
    }
    for (const i of order) { await page.locator('.route-spot').nth(i).click(); await sleep(page, 300); }
    log.note(`corsi 2D: round ${round}: watched and clicked back ${order.length} stones`);
    // the next route starts by itself (or the panel says "goed" and goes)
    const t1 = Date.now();
    let next = false;
    while (Date.now() - t1 < 6_000) {
      const s = await spotsNow();
      if (s.gone) return true;
      if (s.act >= 0) { next = true; break; }
      await sleep(page, 40);
    }
    if (!next) return true;
  }
  return true;
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

/** De verdwaalde frisling's five calm moments, every one played with the body (run 6
 *  polish: aaien, zeug; run 7 package body: dragen, voeren, pad — no card is left in the
 *  world), each with a child's mistake: a hand at the lying piglet (he scoots aside, the
 *  fronds over him give way), a hand with food at the one begging at his bag (it chews and
 *  wants more), a run with the tired piglet (he dives into a clump: "Niet rennen. Hij is
 *  moe."), a step toward the sow (she grunts and stamps nearer), waiting at the free path
 *  (the group shuffles on: "Je wacht te lang."). Each gets a calm reaction and the same
 *  moment back; never a fail. The rustkracht step is logged once, five trials, each
 *  marked once: 0 right — what five cards answered wrong once each would log. */
test('frisling: a mistake at each of the five body moments is a gentle reaction and the same moment back; rustkracht logs 5 trials, 0 right @missions', async ({ page }, info) => {
  test.setTimeout(12 * 60_000);
  const mission = missions.find((m) => m.id === 'frisling')!;
  const log = new Log(page, outDir(info, 'frisling-body'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  type Rec = { trials: number; recent: boolean[] } | null;
  const dagnacht = (): Promise<Rec> => page.evaluate(() => JSON.parse(localStorage.getItem('alvah-ef-v1') ?? '{}').ranger?.skill?.dagnacht ?? null);
  const adv = (): Promise<{ beat: string; line: string | null; stats: Record<string, number> } | null> => R(page, 'r.adventure()');
  const actor = async (key: string): Promise<{ x: number; z: number; doing: string } | null> =>
    (await homeOf(page, 'frisling'))?.actors.find((a) => a.key === key) as { x: number; z: number; doing: string } | undefined ?? null;
  const at = async (a: { x: number; z: number }, h: number): Promise<{ x: number; y: number; onScreen: boolean }> => {
    const g = await R<number>(page, `r.groundAt(${a.x}, ${a.z})`);
    return R(page, `r.screenOf(${a.x}, ${g + h}, ${a.z})`);
  };
  let hands = false; // (the player keeps off the keys while a mistake is made)
  try {
    await boot(log);
    await goToMarker(log, mission);
    const before = await dagnacht();
    await start(log, mission);
    const reached: string[] = [];
    const MOMENT: Record<string, RegExp> = {
      'still:aaien': /Raak hem niet aan/, 'still:voeren': /Hou je handen stil/, 'still:zeug': /Sta heel stil/,
      'pace:dragen': /Hij is moe/, 'go:pad': /Het pad is vrij/,
    };
    /** One body moment played wrong once: acts as soon as it begins. */
    const mistake = async (beat: string): Promise<void> => {
      const want = MOMENT[beat];
      // (its line is up with the beat: act at once — a held moment is over in a few seconds)
      await expect.poll(async () => (await adv())?.line ?? '', { timeout: 8_000, message: `${beat}: its line` }).toMatch(want);
      if (beat === 'still:aaien' || beat === 'still:voeren') {
        // a hand reaches: a real click on the animal (at his bag: the yearling at the
        // field, the lost piglet at the stand)
        const me = (await snap(page)).p!;
        const y = await actor('yearling');
        const key = beat === 'still:voeren' && y && Math.hypot(y.x - me.x, y.z - me.z) < 3 ? 'yearling' : 'lost';
        // (at his bag the hungry one noses in as the moment begins: reach for it where it
        // stands, once it stands still — a click where it was a moment ago hits the heather)
        let a0 = await actor(key);
        for (let i = 0; i < 16 && a0 && beat === 'still:voeren'; i++) {
          await sleep(page, 250);
          const a1 = await actor(key);
          const still = !!a1 && Math.hypot(a1.x - a0.x, a1.z - a0.z) < 0.03;
          a0 = a1;
          if (still) break;
        }
        log.hard(!!a0, `the ${key}`);
        const p = await at(a0!, key === 'lost' ? (beat === 'still:aaien' ? 0.17 : 0.24) : 0.4);
        log.hard(p.onScreen, `${beat}: the ${key} is on screen to reach for`);
        await page.mouse.click(p.x, p.y);
        const stat = beat === 'still:aaien' ? 'still_aaien' : 'still_voeren';
        await expect.poll(async () => (await adv())?.stats[stat] ?? 0, { timeout: 5_000, message: `${beat}: the reach counted` }).toBe(1);
        const moved = await expect.poll(async () => { const l = await actor(key); return !!l && Math.hypot(l.x - a0!.x, l.z - a0!.z) > 0.08; }, { timeout: 5_000 }).toBe(true).then(() => true, () => false);
        log.soft(moved, `${beat}: the ${key} reacts (it ${key === 'lost' && beat === 'still:aaien' ? 'scoots aside' : 'wriggles closer for more'})`);
        if (beat === 'still:aaien') {
          const shows = (await adv())?.stats.aaien_visible ?? 0;
          log.note(`after the reach ${Math.round(shows * 100)} % of his back shows from the close lens`);
          log.soft(shows >= 0.4, `after a reach the piglet stays clearly visible (${shows}; want ≥ 0.4)`);
        }
      } else if (beat === 'still:zeug') {
        // a step toward her piglets: a real key
        const sow = await actor('sow');
        await page.keyboard.press('ArrowUp');
        await expect.poll(async () => (await adv())?.stats.still_zeug ?? 0, { timeout: 5_000, message: 'the step counted' }).toBe(1);
        const stamped = await expect.poll(async () => { const s = await actor('sow'); return !!s && !!sow && Math.hypot(s.x - sow.x, s.z - sow.z) > 0.1; }, { timeout: 6_000 }).toBe(true).then(() => true, () => false);
        log.soft(stamped, 'the sow stamps nearer');
      } else if (beat === 'pace:dragen') {
        // he runs with the tired piglet: Shift held with the walk key
        hands = true;
        await sleep(page, 400);
        await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
        await expect.poll(async () => (await adv())?.stats.pace_dragen ?? 0, { timeout: 6_000, message: 'the run counted' }).toBe(1).catch(() => {});
        await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift');
        log.soft(((await adv())?.stats.pace_dragen ?? 0) === 1, 'a run with the tired piglet is the impulse');
        log.soft(/Niet rennen/.test((await adv())?.line ?? ''), `the run is told calmly ("${(await adv())?.line}")`);
        hands = false;
      } else if (beat === 'go:pad') {
        // he waits at the free path, past the window
        hands = true;
        const t0 = Date.now();
        const late = await expect.poll(async () => (await adv())?.stats.pad_late ?? 0, { timeout: 30_000 }).toBe(1).then(() => true, () => false);
        log.hard(late, 'waiting at the free path: the group shuffles on');
        log.note(`waited ${((Date.now() - t0) / 1000).toFixed(1)} s at the free path (window ${(await adv())?.stats.pad_wait_s} s after its line)`);
        await expect.poll(async () => (await adv())?.line ?? '', { timeout: 6_000 }).toMatch(/Je wacht te lang/).catch(() => {});
        hands = false;
      }
      // no card, no buttons, nothing to click (a perfect player keeps still or walks)
      log.soft((await page.locator('button.p3-choice').filter({ visible: true }).count()) === 0, `${beat}: no answer buttons`);
      reached.push(beat);
      await log.shot(`${beat.replace(':', '-')}-wrong`);
      // the same moment comes back (checked beside the play: the next moment may follow at once)
      backs.push((async () => {
        // (after a run he first walks calmly back to where the tired piglet dropped flat: the
        // walk back is part of the moment, and the stretch begins again there)
        // (the free path's words are back for a second only — the player walks on at once —
        // so its return is read from its count, never from catching the line: run 7 close)
        const back = beat === 'go:pad'
          ? await expect.poll(async () => (await adv())?.stats.pad_again ?? 0, { timeout: 20_000 }).toBeGreaterThanOrEqual(1).then(() => true, () => false)
          : await expect.poll(async () => (await adv())?.line ?? '', { timeout: beat === 'pace:dragen' ? 35_000 : 20_000 }).toMatch(beat === 'pace:dragen' ? /^Hij is moe/ : want).then(() => true, () => false);
        log.soft(back, `${beat}: the moment comes back`);
        if (back) await log.shot(`${beat.replace(':', '-')}-again`);
      })());
    };
    const backs: Promise<void>[] = [];
    let playing = true;
    let failed: unknown = null;
    const watcher = (async () => {
      const done = new Set<string>();
      while (playing) {
        const a = await adv().catch(() => null);
        if (a && MOMENT[a.beat] && !done.has(a.beat)) {
          done.add(a.beat);
          if (a.beat === 'pace:dragen' || a.beat === 'go:pad') hands = true;
          await mistake(a.beat).catch((e) => { failed ??= e; hands = false; });
        }
        // a card in the world would be an answer card left over
        if (await page.locator('button.p3-choice').filter({ visible: true }).count()) failed ??= new Error(`an answer card is up at "${a?.beat}"`);
        await sleep(page, 100);
      }
    })();
    try {
      await playSteps(log, mission, undefined, undefined, () => hands);
    } finally {
      playing = false;
      await watcher;
    }
    await Promise.all(backs);
    if (failed) throw failed;
    await finish(log, mission);
    log.hard(reached.length === 5, `all five moments were played wrong once (${reached.join(', ')})`);
    const after = await dagnacht();
    const trials = (after?.trials ?? 0) - (before?.trials ?? 0);
    const last = (after?.recent ?? []).slice(-trials);
    log.note(`dagnacht: ${trials} trials, ${last.filter(Boolean).length} right (${JSON.stringify(last)})`);
    log.soft(trials === 5, `the rustkracht step logged 5 trials (${trials})`);
    log.soft(last.filter(Boolean).length === 0, `each moment marked once by its mistake: 0 right (${last.filter(Boolean).length})`);
    log.soft(errors.length === 0, `page errors: ${errors.slice(0, 3).join(' / ')}`);
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── frisling-body ──\n${text}`);
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
    log.seed = await playSeed(page);
    if (log.seed !== null) log.note(`seed ${log.seed}`);
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

/** Run 6 · De wildcamera: the day turns into night while it plays; whatever happens, the
 *  golden hour comes back — after "Stop de missie" in the middle of the night, and on a
 *  reload — and the camera lies on its stump again until the mission is done (the roe
 *  back at home in her glade); once it is done, it hangs on its pine (after a reload
 *  too) and the roe grazes in the glade. */
type Sky = { daylight?: number } | null;
const daylight = async (page: Page): Promise<number> => (await R<Sky>(page, 'r.sky()'))?.daylight ?? 1;
const near = async (page: Page, p: P2, r: number, id: string): Promise<boolean> =>
  !!(await R<Seat[] | null>(page, `r.seating(${p.x}, ${p.z}, ${r})`))?.some((s) => s.id.startsWith(id));

test('De wildcamera: stopped in the night, the golden hour comes back and the camera lies on its stump again @missions', async ({ page }, info) => {
  test.setTimeout(8 * 60_000);
  const mission = missions.find((m) => m.id === 'wildcamera')!;
  const log: Log = new Log(page, outDir(info, 'wildcamera-stop'));
  try {
    await boot(log);
    const marker = await goToMarker(log, mission);
    log.soft(await near(page, marker, 1.2, 'camera-on-stump'), 'the camera lies on its stump at the marker');
    await start(log, mission);
    await playSteps(log, mission, async () => (await daylight(page)) < 0.05);
    log.hard((await daylight(page)) < 0.05, 'the night never came');
    const places = await R<Record<string, P2>>(page, `r.missionPlaces("wildcamera")`);
    await sleep(page, 800);
    await log.shot('night');
    await click(log, /Pauze/, 'the mission pause chip');
    await click(log, 'Stop de missie', 'pause card');
    const t0 = Date.now();
    await expect.poll(() => daylight(page), { timeout: 8_000, message: 'the golden hour comes back after a stop' }).toBe(1);
    log.note(`the golden hour was back ${((Date.now() - t0) / 1000).toFixed(1)} s after the stop`);
    // run 7 (moods): the night hands back the visit's own mood (RANGER_MOOD plays it in one)
    const md = await R<{ session: string; now: string } | null>(page, 'r.mood()');
    log.soft(!md || md.now === md.session, `the visit's mood is back after the night (${md?.now}; the visit's: ${md?.session})`);
    await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
      { timeout: 8_000, message: 'back in free roam' }).toBe(true);
    await sleep(page, 1_000);
    await log.shot('after-stop');
    const home = await homeOf(page, 'wildcamera');
    log.soft(home?.state === 'before' && !home.borrowed, `the home is back in its before state (${home?.state}, borrowed ${home?.borrowed})`);
    // (only the roe, back at home in her glade or stepped in under its trees: she grazes
    // there before the mission, and is shy of him)
    const about = home?.actors.filter((a) => a.visible) ?? [];
    log.soft(about.every((a) => a.key === 'ree' && Math.hypot(a.x - places.home.x, a.z - places.home.z) < 6),
      `no animal is left standing about, only the roe at her glade (${about.map((a) => a.key).join(', ') || 'none'})`);
    log.soft(await near(page, marker, 1.2, 'camera-on-stump'), 'the camera lies on its stump again');
    log.soft(!(await near(page, places.pine, 1.5, 'camera-trap')), 'no camera on the pine yet');
    await page.reload();
    await click(log, 'Begin', 'title after reload', 30_000);
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
    await sleep(page, 1_500);
    log.soft((await daylight(page)) === 1, 'after a reload: the golden hour');
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── wildcamera-stop ──\n${text}`);
  }
});

test('De wildcamera done: after a reload the camera hangs on its pine, the roe grazes in the glade, in the golden hour @missions', async ({ page, context }, info) => {
  test.setTimeout(3 * 60_000);
  await context.addInitScript((seed) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: seed }));
  }, { voltooid: { frisling: true, 'ree-niet-aanraken': true, wildcamera: true }, avatarGemaakt: true, settings: { wereldHintGezien: true, tikHintGezien: true } });
  const log: Log = new Log(page, outDir(info, 'wildcamera-after'));
  try {
    await boot(log);
    await sleep(page, 2_000);
    const places = await R<Record<string, P2>>(page, `r.missionPlaces("wildcamera")`);
    const home = await homeOf(page, 'wildcamera');
    log.soft(home?.state === 'after', `the home is in its after state (${home?.state})`);
    const roe = home?.actors.find((a) => a.key === 'ree');
    log.soft(!!roe?.visible && Math.hypot(roe.x - places.glade.x, roe.z - places.glade.z) < 2.5, 'the roe grazes in the glade');
    log.soft(await near(page, places.pine, 1.5, 'camera-trap'), 'the camera hangs on its pine');
    const all = await R<(P2 & { missionId: string })[]>(page, 'r.markers()');
    const m = all.find((x) => x.missionId === 'wildcamera')!;
    log.soft(!(await near(page, m, 1.2, 'camera-on-stump')), 'the stump at the marker is empty');
    log.soft(await near(page, m, 6, 'klaar-flag'), 'the "klaar" flag stands at the marker');
    log.soft((await daylight(page)) === 1, 'the golden hour');
  } finally {
    const text = log.write();
    await info.attach('notes', { body: text, contentType: 'text/plain' });
    if (!process.env.MISSIONS_QUIET) console.log(`\n── wildcamera-after ──\n${text}`);
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
