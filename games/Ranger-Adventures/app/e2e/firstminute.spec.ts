import { test, expect, devices, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { R, walkTo, sleep, type P2, type Vehicle } from './golden-lib';
import { BRAM, LES, BESTURING, metNaam } from '../src/content/mentor';
import { ONBOARD_DRIVE } from '../src/core/onboarding';
import { AREA_VELUWE } from '../src/content/veluwe';

/**
 * THE FIRST MINUTE (run 6, FLOW P2), played like a first-time player: a fresh save, real
 * clicks on Begin and "Dit is mijn ranger", real arrow keys and Shift, the real mouse.
 *
 *   Bram, the warden, stands by the missiebord in the first play frame, turns to the
 *   ranger and greets him in the speaker strip (every line spoken and highlighted); the
 *   player can walk meanwhile. Then one lesson at a time: walk (key caps), run (Shift);
 *   then Bram's hook, and only then the chip, pointing at the frisling, whose ring and
 *   tag glow. Tags never overlap, never sit cut at the edge, and only the next mission,
 *   the Missiebord and near ones show. At the marker "Speel mee" carries an Enter cap and
 *   Enter opens the briefing. A reload never repeats a learned lesson.
 *   A child who drives off in the jeep during the greeting still hears the hook and gets
 *   the chip in the jeep; the run lesson waits until he is on foot again. Turning with
 *   the arrow keys or dragging the view, no tag ever shows cut at the screen's edge (read
 *   every frame).
 *
 * The dev hook is only READ (what Bram says, which lesson is up, the tags on screen).
 * Screenshots of every beat: test-results/firstminute/.
 */

const missions = AREA_VELUWE.missies;
const FIRST = missions[0];
const naam = 'Alvah';
type Hint = {
  active: string | null; speaking: boolean; line: string | null; learned: string[]; chip: boolean;
  progress: { walkedM: number; runS: number; lookPx: number };
  bram: { x: number; z: number; h: number; talking: boolean; mark: boolean; offRanger: number } | null;
};
type Tag = { text: string; o: number; x: number; y: number; w: number; h: number; glow: boolean; d: number; always: boolean };

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

/** Record every line the game hands the voice (the speechSynthesis spy), and every line
 *  Bram's strip shows (read each frame, so a line that came and went while the test was
 *  busy is still seen, in order). */
async function spyVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[]; __strip: string[] };
    w.__said = [];
    w.__strip = [];
    const orig = SpeechSynthesis.prototype.speak;
    SpeechSynthesis.prototype.speak = function (u: SpeechSynthesisUtterance) {
      w.__said.push(u.text);
      try { return orig.call(this, u); } catch { /* no voice in this browser */ }
    };
    const watch = (): void => {
      const line = document.querySelector('.speaker-strip .sp-line')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (line && w.__strip[w.__strip.length - 1] !== line) w.__strip.push(line);
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
}
const stripLines = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __strip: string[] }).__strip.slice());
const saidAll = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice());
const hint = (page: Page): Promise<Hint> => R<Hint>(page, 'r.hint()');

let dir = '';
let n = 0;
async function snapShot(page: Page, name: string): Promise<void> {
  n += 1;
  await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
}
function shotsInto(testInfo: TestInfo, sub: string): void {
  dir = path.join(testInfo.project.outputDir, 'firstminute', sub);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  n = 0;
}

async function enterFresh(page: Page): Promise<void> {
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await page.getByRole('button', { name: 'Dit is mijn ranger' }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
}

/** Wait until Bram's strip has shown `line` (and it was handed to the voice). */
async function bramSays(page: Page, line: string, timeout = 20_000): Promise<void> {
  await expect.poll(async () => (await stripLines(page)).includes(line), { timeout, message: `Bram says "${line}" in his strip` }).toBe(true);
  await expect.poll(async () => (await saidAll(page)).includes(line), { timeout: 5_000, message: `"${line}" is read aloud` }).toBe(true);
}

/** No two tags overlap, none touches the screen edge, and only those that matter show. */
function tagsClean(tags: Tag[], vw: number, vh: number, where: string): void {
  const shown = tags.filter((t) => t.o > 0.3);
  for (let i = 0; i < shown.length; i++) {
    const a = shown[i];
    expect(a.x >= 0 && a.y >= 0 && a.x + a.w <= vw && a.y + a.h <= vh, `${where}: "${a.text}" is cut at the screen edge (${a.x},${a.y} ${a.w}×${a.h})`).toBe(true);
    const allowed = a.always || a.glow || (a.text === 'Missiebord' ? a.d <= 20.5 : a.d <= 12.5);
    expect(allowed, `${where}: "${a.text}" shows from ${a.d} m (only the next mission, the Missiebord ≤ 20 m or a tag ≤ 12 m)`).toBe(true);
    for (let j = i + 1; j < shown.length; j++) {
      const b = shown[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${where}: "${a.text}" and "${b.text}" overlap`).toBe(false);
    }
  }
}

test('the first minute: Bram greets, walk and run are learned by doing, the hook brings the chip, Enter starts mission 1', async ({ page }, testInfo) => {
  test.setTimeout(5 * 60_000);
  shotsInto(testInfo, 'laptop');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await spyVoice(page);
  await enterFresh(page);

  // -- the first play frame: Bram by the missiebord, a head and shoulders above the boy
  await sleep(page, 400);
  await snapShot(page, 'arrival');
  const h0 = await hint(page);
  const board = (await R<P2>(page, 'r.board()'))!;
  expect(h0.bram, 'Bram stands in the world').not.toBeNull();
  expect(Math.hypot(h0.bram!.x - board.x, h0.bram!.z - board.z), 'Bram stands beside the missiebord').toBeLessThan(2.6);
  const boy = (await R<{ height: number }>(page, 'r.avatar()')).height;
  expect(h0.bram!.h / boy, `Bram (${h0.bram!.h} m) is a head and shoulders taller than the ranger (${boy} m)`).toBeGreaterThan(1.25);
  const onScreen = await R<{ onScreen: boolean }>(page, `r.screenOf(${h0.bram!.x}, 1.0, ${h0.bram!.z})`);
  expect(onScreen?.onScreen, 'Bram is in the first play frame').toBe(true);
  // the chip waits for the hook
  await expect(page.locator('.explore-wayfind')).toBeHidden();

  // -- Bram greets, one line at a time, spoken, and the player can walk meanwhile
  const intro = BRAM.intro.map((l) => metNaam(l, naam));
  await bramSays(page, intro[0]);
  await snapShot(page, 'bram-1');
  await expect(page.locator('.speaker-strip .sp-name')).toHaveText('Bram');
  const hb = await hint(page);
  expect(hb.active).toBe('bram');
  expect(hb.bram?.talking && hb.bram.mark, 'a speech mark floats over Bram while he talks').toBe(true);
  await expect.poll(async () => (await hint(page)).bram?.offRanger ?? 9, { timeout: 4_000, message: 'Bram turns to the ranger while he speaks' }).toBeLessThan(0.35);
  const p0 = (await R<P2>(page, 'r.pos()'))!;
  await page.keyboard.down('ArrowUp'); await sleep(page, 650); await page.keyboard.up('ArrowUp');
  const p1 = (await R<P2>(page, 'r.pos()'))!;
  expect(Math.hypot(p1.x - p0.x, p1.z - p0.z), 'he walks while Bram talks (nothing holds him)').toBeGreaterThan(0.6);
  await bramSays(page, intro[1]);
  await snapShot(page, 'bram-2');
  await bramSays(page, intro[2]);
  await snapShot(page, 'bram-3');
  expect((await stripLines(page)).slice(0, 3), 'his three lines, one at a time, in order').toEqual(intro);

  // -- the walk lesson: key caps, spoken, gone after walking a few metres
  const walk = page.locator('.lesson-strip.ls-lopen');
  await expect(walk, 'the walk lesson follows Bram').toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.speaker-strip')).toHaveCount(0); // one teaching strip at a time
  await expect(walk).toContainText(LES.lopen.keys);
  expect(await walk.locator('.kcap').count(), 'four arrow key caps').toBe(4);
  await expect.poll(async () => (await saidAll(page)).includes(LES.lopen.keys)).toBe(true);
  await snapShot(page, 'lesson-walk');
  await page.keyboard.down('ArrowUp');
  try { await expect(walk, 'walking dismisses the walk lesson').toHaveCount(0, { timeout: 8_000 }); } finally { await page.keyboard.up('ArrowUp'); }
  expect((await hint(page)).learned).toContain('lopen');

  // -- the run lesson: the Shift cap; holding Shift + ↑ runs, and that is the lesson done
  const run = page.locator('.lesson-strip.ls-rennen');
  await expect(run, 'the run lesson comes next').toBeVisible({ timeout: 10_000 });
  await expect(run).toContainText(LES.rennen.keys);
  await expect(run.locator('.kcap', { hasText: 'Shift' })).toBeVisible();
  await expect.poll(async () => (await saidAll(page)).includes(LES.rennen.keys)).toBe(true);
  await snapShot(page, 'lesson-run');
  await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp');
  try {
    await sleep(page, 700);
    await snapShot(page, 'running');
    await expect(run, 'running dismisses the run lesson').toHaveCount(0, { timeout: 8_000 });
  } finally { await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift'); }
  expect((await hint(page)).learned).toContain('rennen');

  // -- the hook: Bram tells the story; the chip appears as he points at it, the frisling glows
  const hook = BRAM.haak.simpel;
  await bramSays(page, hook[0]);
  await expect(page.locator('.explore-wayfind'), 'the chip waits for the hook').toBeHidden();
  await snapShot(page, 'hook-1');
  await bramSays(page, hook[1]);
  await bramSays(page, hook[2]);
  await expect(page.locator('.explore-wayfind'), 'the chip appears with the hook').toBeVisible();
  await expect(page.locator('.explore-wayfind .wf-doel')).toHaveText(FIRST.titel);
  expect((await R<{ next: boolean }>(page, 'r.glow()')).next, 'the frisling ring and tag glow').toBe(true);
  await snapShot(page, 'hook-chip');
  await expect(page.locator('.speaker-strip')).toHaveCount(0, { timeout: 12_000 });
  expect((await hint(page)).learned).toContain('haak');

  // -- standing still a while brings the look lesson; a drag with the mouse is it done
  const look = page.locator('.lesson-strip.ls-kijken');
  await expect(look, 'standing still ~5 s brings the look lesson').toBeVisible({ timeout: 12_000 });
  await expect(look).toContainText(LES.kijken.keys);
  await snapShot(page, 'lesson-look');
  await page.mouse.move(640, 300); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(640 + i * 12, 300); await sleep(page, 25); }
  await page.mouse.up();
  await expect(look, 'dragging the view round dismisses it').toHaveCount(0, { timeout: 5_000 });
  expect((await hint(page)).learned).toContain('kijken');

  // -- to the marker: the tags stay clean all the way (every ~2 s)
  const marker = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((m) => m.missionId === FIRST.id)!;
  const w = await walkTo(page, marker, { until: (s) => s.near === FIRST.id, timeout: 90_000 });
  expect(w.res, `walking to the marker (${w.res})`).toBe('until');
  await sleep(page, 900);
  const play = page.getByRole('button', { name: `Speel mee: ${FIRST.titel}` });
  await expect(play).toBeVisible();
  await expect(play.locator('.kcap-in'), 'a small Enter cap on the laptop').toHaveText('Enter');
  tagsClean(await R<Tag[]>(page, 'r.tags()'), 1280, 800, 'at the marker');
  await snapShot(page, 'at-marker');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Ga op pad/ }), 'Enter opens the briefing').toBeVisible({ timeout: 10_000 });
  await snapShot(page, 'briefing');
  expect(errors).toEqual([]);
});

test('the tags from spawn to the frisling to the ree: only what matters, never overlapping, never cut', async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  shotsInto(testInfo, 'tags');
  // a player who already had the first minute (the chip and the next mission's tag are up)
  await page.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { geleerd: { bram: true, lopen: true, rennen: true, haak: true, kijken: true } } } }));
  });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await sleep(page, 3_200); // the lens is behind him, the tags are in
  const markers = await R<(P2 & { missionId: string })[]>(page, 'r.markers()');
  const at = (id: string): P2 => markers.find((m) => m.missionId === id)!;
  let k = 0;
  const check = async (where: string): Promise<void> => {
    const tags = await R<Tag[]>(page, 'r.tags()');
    tagsClean(tags, 1280, 800, where);
    await snapShot(page, `${where}-${k++}`);
  };
  await check('spawn');
  const texts = (await R<Tag[]>(page, 'r.tags()')).filter((t) => t.o > 0.3).map((t) => t.text);
  expect(texts.every((t) => t === FIRST.titel || t === 'Missiebord'), `from spawn only the next mission and the Missiebord (saw ${texts.join(', ')})`).toBe(true);
  // walk to the frisling marker, then on toward the ree marker, looking every ~2 s
  for (const goal of [FIRST.id, missions[1].id]) {
    const g = at(goal);
    const t0 = Date.now();
    let lastLook = 0;
    const walker = walkTo(page, g, { stopDist: 2.5, timeout: 60_000 });
    let done = false;
    void walker.then(() => { done = true; });
    while (!done && Date.now() - t0 < 60_000) {
      if (Date.now() - lastLook > 2_000) { lastLook = Date.now(); await check(`to-${goal}`); }
      await sleep(page, 200);
    }
    await walker;
  }
  await check('at-ree');
});

test('not pressing Shift: the run lesson gives way and the hook and the chip still come; a reload repeats nothing', async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  shotsInto(testInfo, 'noshift');
  await spyVoice(page);
  await enterFresh(page);
  await expect.poll(async () => (await hint(page)).active, { timeout: 20_000 }).toBe('bram');
  // walk all the way through Bram's greeting (the walk lesson is then already done)
  await page.keyboard.down('ArrowUp'); await sleep(page, 2_500); await page.keyboard.up('ArrowUp');
  await expect(page.locator('.lesson-strip.ls-rennen'), 'the run lesson').toBeVisible({ timeout: 25_000 });
  expect((await hint(page)).learned, 'walking during Bram counted').toContain('lopen');
  await expect(page.locator('.lesson-strip.ls-lopen'), 'the walk lesson never showed').toHaveCount(0);
  await snapShot(page, 'run-lesson');
  // never Shift: after ~12 s it gives way
  await expect(page.locator('.lesson-strip.ls-rennen'), 'the run lesson gives way').toHaveCount(0, { timeout: 16_000 });
  await bramSays(page, BRAM.haak.simpel[0], 10_000);
  await expect(page.locator('.explore-wayfind')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.explore-wayfind .wf-doel')).toHaveText(FIRST.titel);
  await snapShot(page, 'chip');
  await expect(page.locator('.speaker-strip')).toHaveCount(0, { timeout: 12_000 });
  const learned = (await hint(page)).learned;
  expect(learned).toEqual(expect.arrayContaining(['bram', 'lopen', 'haak']));
  expect(learned, 'the run was not learned (it only gave way)').not.toContain('rennen');

  // a reload: straight into play; Bram welcomes him back, nothing learned repeats, the chip is there
  await page.reload();
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await bramSays(page, metNaam(BRAM.welkomTerug[0], naam));
  await expect(page.locator('.explore-wayfind')).toBeVisible();
  await snapShot(page, 'welkom-terug');
  await expect(page.locator('.speaker-strip')).toHaveCount(0, { timeout: 12_000 });
  await sleep(page, 1_500);
  await expect(page.locator('.lesson-strip.ls-lopen'), 'the walk lesson is never repeated').toHaveCount(0);
  // (the voice spy starts afresh with the page) the new boswachter's greeting is not said again
  const again = (await saidAll(page)).filter((l) => BRAM.intro.map((x) => metNaam(x, naam)).includes(l) || LES.lopen.keys === l);
  expect(again, 'after a reload neither the greeting nor the walk lesson again').toEqual([]);
});

test('a curious child drives off during the greeting: the hook and the chip come in the jeep, the run lesson once he is out', async ({ page }, testInfo) => {
  test.setTimeout(4 * 60_000);
  shotsInto(testInfo, 'jeep');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await spyVoice(page);
  await enterFresh(page);
  await expect.poll(async () => (await hint(page)).active, { timeout: 20_000 }).toBe('bram');
  // straight to the jeep while Bram is still greeting him (real arrow keys)
  const v0 = (await R<Vehicle>(page, 'r.vehicle()'))!;
  const w = await walkTo(page, v0, { stopDist: 0.3, until: (s) => s.jeepNear, timeout: 60_000 });
  expect(w.res, `walking to the jeep (${w.res})`).toBe('until');
  const atJeep = await hint(page);
  expect(atJeep.learned, 'the hook is still to come when he reaches the jeep').not.toContain('haak');
  const enter = page.getByRole('button', { name: 'Stap in de jeep' });
  await expect(enter.locator('.kcap-in')).toHaveText('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await R<Vehicle>(page, 'r.vehicle()'))?.inVehicle, { timeout: 5_000, message: 'Enter gets him into the jeep' }).toBe(true);
  // the drive line teaches the same key as every other prompt, and "Stap uit" wears its cap
  await expect(page.locator('.explore-drive-hint')).toContainText(ONBOARD_DRIVE.uit);
  await expect(page.getByRole('button', { name: 'Stap uit' }).locator('.kcap-in')).toHaveText('Enter');
  await snapShot(page, 'in-jeep');

  // he drives about; the hook comes while he is in the jeep, and the chip with it
  const hook = BRAM.haak.simpel;
  const t0 = Date.now();
  let turn = false;
  while (!(await stripLines(page)).includes(hook[1]) && Date.now() - t0 < 45_000) {
    await page.keyboard.down('ArrowUp'); if (turn) await page.keyboard.down('ArrowLeft');
    await sleep(page, 1_200);
    await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
    await sleep(page, 900);
    turn = !turn;
    expect(await page.locator('.lesson-strip').count(), 'no lesson on foot shows (or waits on screen) in the jeep').toBe(0);
  }
  await bramSays(page, hook[0], 1_000);
  await bramSays(page, hook[2], 10_000);
  await expect(page.locator('.explore-wayfind'), 'the chip appears with the hook, in the jeep').toBeVisible({ timeout: 3_000 });
  await expect(page.locator('.explore-wayfind .wf-doel')).toHaveText(FIRST.titel);
  expect((await R<Vehicle>(page, 'r.vehicle()'))?.inVehicle, 'still in the jeep').toBe(true);
  await snapShot(page, 'hook-in-jeep');
  await expect(page.locator('.speaker-strip')).toHaveCount(0, { timeout: 12_000 });
  const learned = (await hint(page)).learned;
  expect(learned).toContain('haak');
  expect(learned, 'the run was not learned in the jeep').not.toContain('rennen');

  // out of the jeep (Enter): the run lesson comes, as he is on foot again
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await R<Vehicle>(page, 'r.vehicle()'))?.inVehicle, { timeout: 5_000, message: 'Enter gets him out' }).toBe(false);
  const run = page.locator('.lesson-strip.ls-rennen');
  await expect(run, 'the run lesson comes once he is on foot').toBeVisible({ timeout: 6_000 });
  await expect.poll(async () => (await saidAll(page)).includes(LES.rennen.keys)).toBe(true);
  await snapShot(page, 'out-run-lesson');
  // the drive line is read aloud too (queued behind Bram's line, never cutting it off)
  const said = await saidAll(page);
  const drive = said.findIndex((l) => l.includes(ONBOARD_DRIVE.uit));
  expect(drive, 'the drive line is read aloud').toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('turning and dragging the view: no tag is ever drawn cut at the screen edge (read every frame)', async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  shotsInto(testInfo, 'edge');
  await page.addInitScript(() => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, settings: { geleerd: { bram: true, lopen: true, rennen: true, haak: true, kijken: true, missiebord: true, jeep: true } } } }));
  });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await sleep(page, 3_500); // the lens is behind him, the tags are in
  type Sweep = { n: number; bad: string[]; nearEdge: number };
  const sweep = async (act: () => Promise<void>): Promise<Sweep> => {
    await page.evaluate(() => {
      const w = window as unknown as { __edge: (Sweep & { raf: number }) | null; __ranger: { tags(): Tag[] | null } };
      w.__edge = { n: 0, bad: [], nearEdge: 0, raf: 0 };
      const loop = (): void => {
        const e = w.__edge; if (!e) return;
        e.n++;
        let near = false;
        for (const t of w.__ranger.tags() ?? []) {
          const cut = t.x < 0 || t.y < 0 || t.x + t.w > innerWidth || t.y + t.h > innerHeight;
          if (cut && t.o > 0.1) e.bad.push(`${t.text} o=${t.o} x=${t.x} w=${t.w}`);
          if (t.x < 40 || t.x + t.w > innerWidth - 40) near = true;
        }
        if (near) e.nearEdge++;
        e.raf = requestAnimationFrame(loop);
      };
      loop();
    });
    await act();
    return page.evaluate(() => {
      const w = window as unknown as { __edge: (Sweep & { raf: number }) | null };
      const e = w.__edge!; cancelAnimationFrame(e.raf); w.__edge = null;
      return { n: e.n, bad: e.bad, nearEdge: e.nearEdge };
    });
  };
  const hold = (key: string) => async (): Promise<void> => {
    await page.keyboard.down(key); await sleep(page, 6_000); await page.keyboard.up(key); await sleep(page, 500);
  };
  const left = await sweep(hold('ArrowLeft'));
  await snapShot(page, 'after-left');
  const right = await sweep(hold('ArrowRight'));
  const drags = await sweep(async () => {
    for (let k = 0; k < 4; k++) {
      const from = k % 2 === 0 ? 390 : 890, to = k % 2 === 0 ? 890 : 390;
      await page.mouse.move(from, 420); await page.mouse.down();
      await page.mouse.move(to, 420, { steps: 20 }); await page.mouse.up();
      await sleep(page, 350);
    }
  });
  await snapShot(page, 'after-drags');
  for (const [what, r] of [['holding ArrowLeft', left], ['holding ArrowRight', right], ['four mouse drags', drags]] as const) {
    expect(r.n, `${what}: frames read`).toBeGreaterThan(60);
    expect(r.bad, `${what}: ${r.bad.length}/${r.n} frames show a tag cut at the edge`).toEqual([]);
  }
  expect(left.nearEdge + right.nearEdge + drags.nearEdge, 'the tags did sweep past the screen edges').toBeGreaterThan(0);
});

test('the "?" chip opens "Zo speel je" with key caps, read aloud; Esc closes it', async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await spyVoice(page);
  await enterFresh(page);
  await page.getByRole('button', { name: 'Zo speel je' }).click();
  const card = page.locator('.controls-card');
  await expect(card).toBeVisible();
  await expect(card.locator('h1')).toHaveText(BESTURING.titel);
  for (const r of BESTURING.keys) await expect(card).toContainText(r.wat);
  expect(await card.locator('.kcap').count(), 'key caps on the card').toBeGreaterThanOrEqual(7);
  await expect.poll(async () => (await saidAll(page)).includes(BESTURING.zegKeys)).toBe(true);
  expect(await R<string>(page, 'r.screen')).toBe('world');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page.locator('.explore-hud')).toBeVisible();
});

test('the next mission far on foot: Bram suggests the jeep once, and it glows until he gets in', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await spyVoice(page);
  // six missions done: the next one is 40 m away, the jeep 14 m
  const voltooid = Object.fromEntries(missions.slice(0, 6).map((m) => [m.id, true]));
  await page.addInitScript((v) => {
    if (!localStorage.getItem('alvah-ef-v1')) localStorage.setItem('alvah-ef-v1', JSON.stringify({ ranger: { avatarGemaakt: true, voltooid: v, settings: { geleerd: { bram: true, lopen: true, rennen: true, haak: true, kijken: true, missiebord: true } } } }));
  }, voltooid);
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: 'Begin', exact: true }).click({ timeout: 40_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await bramSays(page, BRAM.jeep[0], 30_000);
  await bramSays(page, BRAM.jeep[1]);
  await expect.poll(async () => (await R<{ beacon: boolean }>(page, 'r.glow()')).beacon, { timeout: 4_000, message: 'the jeep glows' }).toBe(true);
  const v = (await R<P2>(page, 'r.vehicle()'))!;
  await walkTo(page, v, { stopDist: 0.3, until: (s) => s.jeepNear, timeout: 60_000 });
  await page.getByRole('button', { name: /Stap in de jeep/ }).click({ timeout: 20_000 });
  await expect.poll(async () => (await R<{ beacon: boolean }>(page, 'r.glow()')).beacon, { timeout: 4_000, message: 'the glow ends once he is in' }).toBe(false);
  expect((await hint(page)).learned).toContain('jeep');
  const count = (await saidAll(page)).filter((l) => l === BRAM.jeep[0]).length;
  expect(count, 'the jeep lines are said once').toBe(1);
});

test.describe('on an iPad-size touch screen', () => {
  const { defaultBrowserType: _ignored, ...ipad } = devices['iPad (gen 7) landscape'];
  test.use({ ...ipad, deviceScaleFactor: 1 });

  test('the lessons speak of the stick, and pushing it far is the run lesson done', async ({ page }, testInfo) => {
    test.setTimeout(4 * 60_000);
    shotsInto(testInfo, 'ipad');
    await spyVoice(page);
    await page.goto('/?dev=1');
    await page.getByRole('button', { name: 'Begin', exact: true }).tap({ timeout: 40_000 });
    await page.getByRole('button', { name: 'Dit is mijn ranger' }).tap({ timeout: 40_000 });
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
    await bramSays(page, metNaam(BRAM.intro[0], naam));
    await snapShot(page, 'bram');
    const walk = page.locator('.lesson-strip.ls-lopen');
    await expect(walk).toBeVisible({ timeout: 25_000 });
    await expect(walk).toContainText(LES.lopen.stick);
    await snapShot(page, 'lesson-walk');
    const base = (await page.locator('.rj-base').boundingBox())!;
    const cx = base.x + base.width / 2; const cy = base.y + base.height / 2; const r = base.width / 2;
    const push = async (frac: number, ms: number): Promise<void> => {
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy - (r * frac * i) / 6); await sleep(page, 30); }
      await sleep(page, ms);
      await page.mouse.up();
    };
    await push(0.7, 3_600);
    await expect(walk).toHaveCount(0, { timeout: 6_000 });
    const run = page.locator('.lesson-strip.ls-rennen');
    await expect(run).toBeVisible({ timeout: 10_000 });
    await expect(run).toContainText(LES.rennen.stick);
    await snapShot(page, 'lesson-run');
    await push(1.3, 2_600);
    await expect(run, 'the stick at its rim runs: the lesson is done').toHaveCount(0, { timeout: 6_000 });
    expect((await hint(page)).learned).toContain('rennen');
    await bramSays(page, BRAM.haak.simpel[0], 15_000);
    await snapShot(page, 'hook');
  });
});
