import { test, expect, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREA_VELUWE } from '../src/content/veluwe';
import { HAAR_OPTIES, OUTFIT_OPTIES } from '../src/core/avatar';
import {
  R, SEAT_TOLERANCE, MAX_DRAW_CALLS, budget, clickButton, hard, holdKey, markTimedOut, note, noteOnce, r2, renderTable, renderedLook, save, setShotDir, shot,
  sleep, snap, soft, step, uiText, under, visibleButtons, walkQuality, walkTo, worldChange, worldSamples, wrap,
  type Heli, type Hint, type P2, type Seat, type Vehicle,
} from './golden-lib';

/**
 * THE GOLDEN PATH (GOAL.md steps 1-8), played the way a first-time player plays it.
 *
 *   npm run golden        (always with your own port: RANGER_PORT=<port> npm run golden)
 *
 * Real input only: mouse clicks on buttons, held arrow keys to walk, held W to drive,
 * and in the 3D mini-games a real mouse click on the spot the engine says a perfect
 * player would click next (`__ranger.playHint()`: the engine's `registerPlayHint`
 * target, projected with the live camera). The dev hook is only READ (where am I,
 * where is the marker, where is the hinted target); `winStep()` is never called.
 *
 * Hard failures (the player is blocked) stop the run; quality problems are soft
 * (`expect.soft`) so one run lists every broken thing. The table at the end gives, per
 * GOAL step, pass / FAIL / soft-fail / not reached with the measured numbers. Every
 * step is screenshotted to test-results/golden/NN-<step>.png: LOOK at them. A step
 * only counts as working when this passes AND the picture looks right to a human.
 */

const SEAT_RADIUS = 6; // m around the mission marker that must stand on the ground
const missions = AREA_VELUWE.missies;
const CHOICE = { huid: 'Donker', haar: 'Rood', outfit: 'Spijkerblauw', iris: 'Groen' }; // none is the default
const optId = (list: { id: string; label: string }[], label: string): string => list.find((o) => o.label === label)!.id;

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

let shotDir = '';
let loads = 0; let expectedLoads = 0; // main-frame navigations seen vs the ones golden caused (goto, reload)
// The table is written here, not at the end of the test, so a timeout still gets one.
test.afterEach(async ({}, testInfo) => {
  if (!shotDir) return;
  if (testInfo.status === 'timedOut') markTimedOut();
  if (loads > expectedLoads) noteOnce('reloaded by itself', '✗✗ the page reloaded by itself during this step (a crash, or a Vite full reload because a source file changed on this dev server?)');
  const table = renderTable(shotDir);
  fs.writeFileSync(path.join(shotDir, 'SUMMARY.txt'), table);
  if (!process.env.GOLDEN_QUIET) console.log(table); // `npm run golden` prints it last instead
  await testInfo.attach('golden-summary', { body: table, contentType: 'text/plain' });
});

test('golden path: title → ranger → walk → jeep + heli → mission 1 by real clicks → reward → reload @golden', async ({ page }, testInfo: TestInfo) => {
  test.setTimeout(14 * 60_000); // run 6: mission 1 is an adventure in the world now (walks, a search, a route ...)
  shotDir = path.join(testInfo.project.outputDir, 'golden');
  fs.rmSync(shotDir, { recursive: true, force: true });
  fs.mkdirSync(shotDir, { recursive: true });
  setShotDir(shotDir);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  // A page that reloads by itself (an app crash, or Vite's full reload after a source
  // edit on a shared dev server) turns every later step into nonsense: name it.
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) loads += 1; });
  let errSeen = 0;
  const noNewErrors = (): void => {
    const fresh = errors.slice(errSeen); errSeen = errors.length;
    soft(fresh.length === 0, `page errors: ${fresh.join(' / ')}`);
    hard(loads <= expectedLoads, `the page reloaded by itself ${loads - expectedLoads}× (a crash, or a Vite full reload because a source file changed on this dev server?)`);
  };

  let missionId = missions[0].id;
  let marker: P2 = { x: 0, z: 0 };
  let seatsBefore: Seat[][] = []; // readings around the marker before the mission (step 7 compares)
  let playerTold = true; // seating() tells the player's own ranger apart (else step 7 cannot judge)

  // ---------------------------------------------------- 1. opening screen ----
  await step(1, async () => {
    const t0 = Date.now();
    expectedLoads += 1;
    await page.goto('/?dev=1');
    const begin = page.getByRole('button', { name: 'Begin', exact: true });
    const up = await begin.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false);
    hard(up, 'no "Begin" button within 30 s');
    const tBegin = (Date.now() - t0) / 1000;
    note(`Begin visible after ${tBegin.toFixed(1)} s`);
    soft(tBegin < 8, `the title is slow: Begin appeared after ${tBegin.toFixed(1)} s (want < 8 s)`);
    const dressed = await page.waitForFunction(() => (window as unknown as { __ranger?: { titleReady(): boolean } }).__ranger?.titleReady(), null, { timeout: 15_000 }).then(() => true, () => false);
    soft(dressed, 'after 15 s the title still shows its low-poly stand-in props (titleReady=false)');
    await shot(page, 'title');
    await clickButton(page, 'Begin', 'title', 10_000, 30_000); // its handler loads the maker + world code
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 30_000, message: 'a mouse click on Begin must open the ranger maker' }).not.toBe('title');
    noNewErrors();
  });

  // --------------------------------------------------- 2. make your ranger ----
  await step(2, async () => {
    const done = page.getByRole('button', { name: 'Dit is mijn ranger' });
    const up = await done.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false);
    hard(up, `the ranger maker never showed "Dit is mijn ranger" (visible buttons: ${await visibleButtons(page)})`);
    for (const label of [`Huid: ${CHOICE.huid}`, `Haar: ${CHOICE.haar}`, `Ranger-jas: ${CHOICE.outfit}`, `Ogen: ${CHOICE.iris}`]) {
      const sw = page.getByRole('radio', { name: label });
      const ok = await sw.click({ timeout: 5_000 }).then(() => true, () => false);
      hard(ok, `no swatch "${label}" in the ranger maker`);
      soft((await sw.getAttribute('aria-checked')) === 'true', `swatch "${label}" does not show as chosen after a click`);
    }
    note(`chose ${Object.entries(CHOICE).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    await shot(page, 'ranger-maker');
    await clickButton(page, 'Dit is mijn ranger', 'ranger maker', 10_000, 30_000); // its handler builds the world
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000, message: '"Dit is mijn ranger" must lead into the world' }).toBe('world');
    await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000, message: 'the world never placed the ranger' }).not.toBeNull();
    note('colours on the 3D ranger are measured in step 3, once the spawn hint has left his head');
    noNewErrors();
  });

  // ------------------------------------------------ 3. walk the free world ----
  await step(3, async () => {
    await sleep(page, 1_500);
    await shot(page, 'world-spawn');
    await budget(page, 'at spawn');
    const fwd = await holdKey(page, 'ArrowUp', 1_500);
    hard(fwd.moved >= 1.0, `holding ArrowUp for 1.5 s moved the ranger only ${fwd.moved} m`);
    note(`ArrowUp 1.5 s: walked ${fwd.moved} m, ${fwd.dir}° off the camera's forward`);
    soft(fwd.dir !== null && Math.abs(fwd.dir) <= 30, `forward does not walk forward: ${fwd.dir}° off the camera's direction`);

    // GOAL 2: the maker's choices on the 3D ranger (seen from the follow camera)
    await sleep(page, 800);
    const look = await renderedLook(page, {
      jacket: OUTFIT_OPTIES.map((o) => `${o.id}=${o.kleur}`),
      hair: HAAR_OPTIES.map((o) => `${o.id}=${o.kleur}`),
    });
    const lookShot = await shot(page, 'ranger-from-behind');
    under(2, () => {
      if (!look) { soft(false, 'avatar colours: the ranger is not on screen to check'); return; }
      const jacket = optId(OUTFIT_OPTIES, CHOICE.outfit); const hair = optId(HAAR_OPTIES, CHOICE.haar);
      note(`3D ranger renders jacket "${look.jacket}" (${look.jacketShare}% of coloured pixels), hair "${look.hair}"`);
      soft(look.jacket === jacket, `the jacket colour does not reach the 3D ranger: chose ${jacket}, it renders ${look.jacket}`);
      soft(look.hair === hair, `the hair colour does not reach the 3D ranger: chose ${hair}, it renders ${look.hair}`);
      note(`skin + eyes are not visible from behind: judge ${lookShot} and the ranger-maker shot`);
    });

    for (const [key, name] of [['ArrowLeft', 'left'], ['ArrowRight', 'right']] as const) {
      const t = await holdKey(page, key, 1_200);
      note(`${key} 1.2 s: camera turned ${t.during}° while held, ${t.after}° after release; ranger moved ${t.moved} m`);
      soft(t.during <= 180, `${name}: the camera spins (${t.during}° in 1.2 s; a calm turn is ≤ 180°)`);
      soft(t.after <= 20, `${name}: the camera keeps turning after the key is released (${t.after}° in the next second)`);
      soft(t.onScreen, `${name}: the ranger left the screen`);
    }
    const back = await holdKey(page, 'ArrowDown', 1_200);
    note(`ArrowDown 1.2 s: camera swung ${back.during + back.after}°, ranger moved ${back.moved} m`);
    soft(back.during + back.after <= 90, `back: the camera swings round to face the ranger (${back.during + back.after}°)`);
    soft(back.onScreen, 'back: the ranger left the screen');
    await shot(page, 'after-turn-keys');
    noNewErrors();
  });

  // ------------------------------------ 4. drive the jeep, fly the helicopter ----
  await step(4, async () => {
    // back on foot, the walk camera stands clear behind the ranger: not folded onto him
    // by the parked vehicle or a solid, and he is not faded to a see-through ghost
    const clearOnFoot = async (where: string): Promise<void> => {
      const c = await R<{ dist: number; avatarOpacity: number } | null>(page, 'r.cam()');
      note(`${where}: the camera stands ${r2(c?.dist ?? 0)} m behind the ranger (ranger opacity ${r2(c?.avatarOpacity ?? 0)})`);
      soft(!!c && c.dist >= 2.5 && c.avatarOpacity >= 0.95, `${where}: the camera folds onto the ranger (${r2(c?.dist ?? 0)} m, opacity ${r2(c?.avatarOpacity ?? 0)})`);
    };
    // -- the jeep: parked clear of every mission, on the ground; board, drive, step out
    const v0 = await R<Vehicle | null>(page, 'r.vehicle()');
    hard(!!v0?.placed, 'there is no jeep in the world (vehicle().placed=false)');
    soft(v0!.markerDist >= 6, `the jeep is parked ${r2(v0!.markerDist)} m from a mission marker (want ≥ 6 m)`);
    soft(Math.abs(v0!.clearance) <= 0.1, `the parked jeep does not sit on the ground (${r2(v0!.clearance)} m off)`);
    const w = await walkTo(page, { x: v0!.x, z: v0!.z }, { stopDist: 0.3, until: (s) => s.jeepNear, timeout: 60_000 });
    walkQuality(w, 'walk to the jeep');
    hard(w.res === 'until', `walked to the jeep at (${r2(v0!.x)}, ${r2(v0!.z)}) but it never offered "Stap in" (${w.res} at ${r2(w.end.x)}, ${r2(w.end.z)})`);
    await shot(page, 'at-jeep');
    await clickButton(page, /Stap in de jeep/, 'jeep');
    await expect.poll(async () => (await R<Vehicle>(page, 'r.vehicle()')).inVehicle, { timeout: 5_000, message: '"Stap in de jeep" did not seat the ranger in the jeep' }).toBe(true);
    await sleep(page, 800);
    const a = await R<Vehicle>(page, 'r.vehicle()');
    soft(a.driverSeated, 'the driver does not sit in the jeep (hidden, or no seated pose)');
    const hint = await uiText(page);
    soft(/stap uit/i.test(hint) && /(gas|rijd|stick)/i.test(hint), `no line says how to drive and how to get out (HUD: "${hint.replace(/\s+/g, ' ').slice(0, 100)}")`);
    const samples: (Vehicle & { contact: boolean })[] = [];
    await page.keyboard.down('KeyW');
    const t0 = Date.now();
    try {
      while (Date.now() - t0 < 3_000) {
        samples.push(await R<Vehicle & { contact: boolean }>(page, 'r.vehicle()'));
        if (samples.length === 20) await shot(page, 'jeep-driving');
        await sleep(page, 100);
      }
    } finally { await page.keyboard.up('KeyW'); }
    const b = await R<Vehicle>(page, 'r.vehicle()');
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    note(`hold W 3 s: the jeep moved ${r2(moved)} m, top speed ${r2(Math.max(...samples.map((s) => s.speed)))} m/s`);
    hard(moved >= 10, `holding W for 3 s moved the jeep only ${r2(moved)} m (want ≥ 10 m)`);
    soft(!samples.some((s) => s.contact), 'driving straight on from where the jeep is parked, it runs into something');
    const off = samples.filter((s) => !s.grounded || Math.abs(s.clearance) > 0.1);
    soft(off.length === 0, `the jeep leaves the ground: ${off.length}/${samples.length} samples not grounded or > 10 cm off (worst ${r2(Math.max(...samples.map((s) => Math.abs(s.clearance))))} m)`);
    soft(samples.every((s) => s.fov === samples[0].fov && Math.abs(s.roll) < 1e-3), 'the jeep camera changed its FOV or rolled');
    const shape = await R<{ id: string; along: number; across: number } | null>(page, `r.shapeAt(${b.x}, ${b.z}, ${b.x - a.x}, ${b.z - a.z})`);
    if (shape) note(`the jeep measures ${shape.along} m along its driving direction, ${shape.across} m across`);
    soft(!!shape && shape.along > shape.across, shape
      ? `the jeep drives sideways: its long side (${shape.across} m) lies across the way it drives (${shape.along} m along)`
      : 'could not find the jeep model to measure which way it faces');
    note('dust behind the wheels, the driver in his seat? judge the jeep-driving shot');
    await sleep(page, 1_200);
    await clickButton(page, /Stap uit/, 'jeep');
    await expect.poll(async () => (await R<Vehicle>(page, 'r.vehicle()')).inVehicle, { timeout: 5_000, message: '"Stap uit" did not get the ranger out of the jeep' }).toBe(false);
    await sleep(page, 600);
    const parked = await R<Vehicle>(page, 'r.vehicle()');
    soft(parked.markerDist >= 6 && Math.abs(parked.clearance) <= 0.1, `where the ranger left it the jeep is ${r2(parked.markerDist)} m from a marker (want ≥ 6) and ${r2(parked.clearance)} m off the ground`);
    const walkOn = await holdKey(page, 'ArrowUp', 1_000);
    hard(walkOn.moved >= 0.8, `after "Stap uit" the ranger cannot walk on (moved ${walkOn.moved} m in 1 s)`);
    await clearOnFoot('out of the jeep');
    await shot(page, 'out-of-jeep');

    // -- the helicopter: switched on in Pauze → Instellingen with real clicks
    await clickButton(page, /Pauze/, 'explore HUD');
    await clickButton(page, /Instellingen/, 'pause');
    const toggle = page.getByRole('switch', { name: 'Helikopter' });
    const shown = await toggle.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false);
    hard(shown, `Instellingen has no "Helikopter" switch (visible buttons: ${await visibleButtons(page)})`);
    await toggle.click();
    await clickButton(page, /^Klaar$/, 'Instellingen');
    await clickButton(page, /Terug naar de open plek/, 'pause');
    const h0 = await R<Heli | null>(page, 'r.heli()');
    hard(!!h0?.placed, 'there is no helicopter in the world');
    hard(h0!.optIn && h0!.available, `after switching it on the helicopter is not available (optIn ${h0!.optIn}, available ${h0!.available})`);
    const wh = await walkTo(page, { x: h0!.x, z: h0!.z }, { stopDist: 0.3, until: (s) => s.heliNear, timeout: 60_000 });
    walkQuality(wh, 'walk to the helicopter');
    hard(wh.res === 'until', `walked to the helicopter but it never offered "Stap in" (${wh.res} at ${r2(wh.end.x)}, ${r2(wh.end.z)})`);
    await shot(page, 'at-heli');
    await clickButton(page, /Stap in de helikopter/, 'helicopter');
    await expect.poll(async () => (await R<Heli>(page, 'r.heli()')).inHeli, { timeout: 5_000, message: '"Stap in de helikopter" did not seat the ranger' }).toBe(true);
    soft((await R<Heli>(page, 'r.heli()')).pilotSeated, 'the pilot does not sit in the helicopter');
    // take off and fly to the other helipad with the arrow keys, like a player
    const pad = h0!.pads.reduce((f, p) => (Math.hypot(p.x - h0!.x, p.z - h0!.z) > Math.hypot(f.x - h0!.x, f.z - h0!.z) ? p : f));
    const held = new Set<string>();
    const setKey = async (k: string, on: boolean): Promise<void> => {
      if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    };
    let prev: Heli | null = null; let sideways = 0; let flights = 0; let steep = 0; let comfort = 0; let flyShot = false; let over = false;
    const tf = Date.now();
    try {
      while (Date.now() - tf < 90_000) {
        const h = await R<Heli>(page, 'r.heli()');
        if (Math.abs(h.climbRate) > 2.05) steep += 1;
        if (h.fov !== h0!.fov || Math.abs(h.roll) > 1e-3) comfort += 1;
        if (prev && h.speed > 3) {
          const mx = h.x - prev.x; const mz = h.z - prev.z;
          if (Math.hypot(mx, mz) > 0.3) {
            flights += 1;
            // against the nose halfway between the two samples (in a turn it swings between them)
            if (Math.abs(wrap(Math.atan2(mx, mz) - (prev.heading + wrap(h.heading - prev.heading) / 2))) > 0.35) sideways += 1;
          }
        }
        prev = h;
        if (!flyShot && h.altitude > 10 && h.speed > 5) { flyShot = true; await shot(page, 'heli-flying'); }
        if (h.onPad && Math.hypot(h.x - pad.x, h.z - pad.z) < 4) { over = true; break; }
        const e = wrap(Math.atan2(pad.x - h.x, pad.z - h.z) - h.heading);
        await setKey('ArrowUp', true);
        await setKey('ArrowLeft', e > 0.12);
        await setKey('ArrowRight', e < -0.12);
        await sleep(page, 100);
      }
    } finally { for (const k of [...held]) await page.keyboard.up(k); }
    note(`flew ${r2(Math.hypot(pad.x - h0!.x, pad.z - h0!.z))} m to the helipad at (${pad.x}, ${pad.z}) in ${((Date.now() - tf) / 1000).toFixed(1)} s`);
    hard(over, 'flying with the arrow keys never brought the helicopter over the other helipad');
    soft(sideways === 0, `the helicopter flies sideways: ${sideways}/${flights} samples move > 20° off its nose`);
    soft(steep === 0 && comfort === 0, `flight comfort: ${steep} samples climb/sink faster than 2 m/s, ${comfort} change the FOV or roll`);
    await clickButton(page, /Land hier/, 'helicopter over the pad');
    await expect.poll(async () => (await R<Heli>(page, 'r.heli()')).airborne, { timeout: 60_000, message: '"Land hier" never set the helicopter down' }).toBe(false);
    await sleep(page, 500);
    const hl = await R<Heli>(page, 'r.heli()');
    note(`landed ${r2(Math.hypot(hl.x - pad.x, hl.z - pad.z))} m from the pad centre, ${r2(hl.clearance)} m off the ground`);
    soft(Math.hypot(hl.x - pad.x, hl.z - pad.z) < 1 && Math.abs(hl.clearance) <= 0.1, 'the helicopter did not land on the pad (centre, on the ground)');
    await shot(page, 'heli-landed');
    await clickButton(page, /Stap uit/, 'landed helicopter');
    await expect.poll(async () => (await R<Heli>(page, 'r.heli()')).inHeli, { timeout: 5_000, message: '"Stap uit" did not get the ranger out of the helicopter' }).toBe(false);
    await sleep(page, 600);
    const walkOff = await holdKey(page, 'ArrowUp', 1_000);
    hard(walkOff.moved >= 0.8, `after landing the ranger cannot walk on (moved ${walkOff.moved} m in 1 s)`);
    await clearOnFoot('out of the helicopter');
    noNewErrors();
  });

  // --------------------------------------------- 5. go to the first mission ----
  await step(5, async () => {
    const hud = await uiText(page);
    const pointed = missions.find((m) => hud.includes(m.titel));
    soft(!!pointed, `the HUD names no mission to go to (HUD text: "${hud.replace(/\s+/g, ' ').slice(0, 120)}")`);
    if (pointed) missionId = pointed.id;
    soft(missionId === missions[0].id, `the HUD points at "${pointed?.titel}", not the first mission "${missions[0].titel}"`);
    const all = await R<(P2 & { missionId: string })[] | null>(page, 'r.markers()');
    const m = all?.find((x) => x.missionId === missionId);
    hard(!!m, `markers() has no marker for mission "${missionId}"`);
    marker = { x: m.x, z: m.z };
    const w = await walkTo(page, marker, { until: (s) => s.near === missionId, timeout: 120_000 });
    walkQuality(w, `walk to "${missionId}"`);
    hard(w.res === 'until', `walking with the arrow keys never reached the "${missionId}" marker (${w.res} at ${r2(w.end.x)}, ${r2(w.end.z)}; marker at ${r2(marker.x)}, ${r2(marker.z)})`);
    await sleep(page, 1_000);
    await shot(page, 'at-marker');
    await budget(page, 'at the marker');
    // run 6: an adventure's animals LIVE at its home, in view as he walks up (never out of nowhere)
    const home = await R<{ state: string; actors: { key: string; x: number; z: number; visible: boolean }[] }[] | null>(page, 'r.residents()');
    const fam = home?.find((h) => (h as unknown as { missionId: string }).missionId === missionId);
    if (fam) {
      const seen: string[] = [];
      for (const a of fam.actors.filter((x) => x.visible && x.key !== 'lost')) {
        const g = (await R<number | null>(page, `r.groundAt(${a.x}, ${a.z})`)) ?? 0;
        const sc = await R<{ onScreen: boolean } | null>(page, `r.screenOf(${a.x}, ${g + 0.35}, ${a.z})`);
        if (sc?.onScreen) seen.push(a.key);
      }
      note(`the family at its home: ${seen.join(', ') || 'none'} on screen from the marker`);
      soft(seen.includes('sow') && seen.length >= 3, `at the marker the family is not in view (on screen: ${seen.join(', ') || 'none'})`);
      soft(!fam.actors.some((a) => a.key === 'lost' && Math.hypot(a.x - marker.x, a.z - marker.z) < 2), 'the lost piglet stands in the marker ring (he should be hidden, heard)');
    }
    seatsBefore = await worldSamples(page, marker, SEAT_RADIUS, 3);
    // The ranger stands at the marker, so the probe must see him there and tag him as the
    // player: otherwise step 7 would count his own steps as the world reacting.
    const me = (await snap(page)).p!;
    const tagged = seatsBefore[0].filter((s) => s.moves === 'player').length;
    const inside = Math.hypot(me.x - marker.x, me.z - marker.z) < SEAT_RADIUS - 1;
    playerTold = !inside || tagged === 1;
    soft(playerTold, `harness: seating() tagged ${tagged} things as the player's own ranger (want 1): step 7 cannot tell his steps from the world reacting`);
    const things = seatsBefore[0].filter((s) => s.moves !== 'player'); // his feet are judged in step 3
    const bad = things.filter((s) => Math.abs(s.gap) > SEAT_TOLERANCE);
    note(`${things.length} things stand within ${SEAT_RADIUS} m of the marker`);
    soft(bad.length === 0, `${bad.length}/${things.length} of them are not on the ground (±${SEAT_TOLERANCE * 100} cm): ${bad.slice(0, 4).map((s) => `${s.id} ${s.gap > 0 ? '+' : ''}${s.gap} m`).join('; ')}`);
    // starting it should be one obvious action
    let clicks = 0;
    const titel = missions.find((x) => x.id === missionId)!.titel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await clickButton(page, new RegExp(`Speel mee|${titel}`), 'mission prompt at the marker'); clicks += 1;
    const started = async (): Promise<boolean> => (await R<string | null>(page, 'r.missionView')) !== null;
    for (let i = 0; i < 3 && !(await started()); i++) {
      await sleep(page, 800);
      if (await started()) break;
      const go = page.getByRole('button', { name: /Ga op pad|Start/ }).filter({ visible: true }).first();
      if (await go.isVisible().catch(() => false)) {
        if (clicks === 1) await shot(page, 'briefing');
        await clickButton(page, /Ga op pad|Start/, 'briefing'); clicks += 1;
      }
    }
    await expect.poll(started, { timeout: 10_000, message: 'the mission never started (missionView stayed null)' }).toBe(true);
    note(`the mission started after ${clicks} click(s)`);
    soft(clicks <= 2, `starting the mission took ${clicks} clicks`);
    noNewErrors();
  });

  // ------------------------------------------------- 6. play its mini-games ----
  await step(6, async () => {
    const mission = missions.find((m) => m.id === missionId)!;
    const plan = mission.stappen.map((s) => s.ef as string);
    note(`"${mission.titel}": ${plan.join(' → ')}`);
    const base = (await save(page))?.trials ?? {};
    // run 6: an adventure plays its steps as beats in the world, interleaved (the choices of
    // one step before and after another's route): "won" = EVERY step's trial count went up
    const need: Record<string, number> = {};
    for (const ef of plan) need[ef] = (need[ef] ?? 0) + 1;
    const wonOf = (sv: { trials: Record<string, number> } | null, ef: string): boolean => !!sv && (sv.trials[ef] ?? 0) - (base[ef] ?? 0) >= need[ef];
    // an encounter card is answered by matching its question against the encounters of ANY step
    const encounters = mission.stappen.flatMap((st) => ((st.skin as { encounters?: { vraag: string; opties: { label: string; goed: boolean }[] }[] }).encounters ?? []));
    type GameLog = { hints: number; clicks: number; answers: number; walks: number; offScreen: string[]; hidden: string[]; buried: string[]; unseated: string[]; blocked: string[]; standIns: string[] };
    const logs: Record<string, GameLog> = {};
    const log = (k: string): GameLog => (logs[k] ??= { hints: 0, clicks: 0, answers: 0, walks: 0, offScreen: [], hidden: [], buried: [], unseated: [], blocked: [], standIns: [] });
    const served2d = new Set<string>();
    const won = new Set<string>();
    let lastProgress = Date.now();
    let ended: number | null = null;
    let lastBeat = '';
    let beats = 0;
    let maxCalls = 0;
    let stats: Record<string, number> = {};
    const t6 = Date.now();
    const deadline = Date.now() + 9 * 60_000;
    const animalOf = (ef: string): string | undefined => (mission.stappen.find((s) => s.ef === ef)?.skin as { dier?: string } | undefined)?.dier;
    while (won.size < Object.keys(need).length && Date.now() < deadline) {
      const sv = await save(page);
      for (const ef of Object.keys(need)) {
        if (!won.has(ef) && wonOf(sv, ef)) {
          won.add(ef); lastProgress = Date.now();
          const g = log(ef);
          note(`${ef}: won${g.clicks ? ` with ${g.clicks} mouse click(s) on 3D targets` : ''}${g.answers ? ` and ${g.answers} answer button(s)` : ''}`);
          await shot(page, `${ef}-won`);
        }
      }
      if (won.size >= Object.keys(need).length) break;
      const adv = await R<{ beat: string; stats: Record<string, number> } | null>(page, 'r.adventure()');
      if (adv) stats = { ...stats, ...adv.stats };
      const calls = await R<number | null>(page, 'r.drawCalls()');
      if (calls !== null) maxCalls = Math.max(maxCalls, calls);
      if (adv && adv.beat !== lastBeat) { // one screenshot per beat, once the lens has settled
        lastBeat = adv.beat;
        beats += 1;
        await sleep(page, 1_200);
        await shot(page, `beat-${adv.beat.replace(/[^a-z0-9]+/gi, '-')}`);
        await budget(page, `at the "${adv.beat}" beat`);
      }
      const view = await R<string | null>(page, 'r.missionView');
      if ((await R<string>(page, 'r.screen')) === 'world' && view === null) {
        ended ??= Date.now();
        hard(Date.now() - ended < 3_000, `the mission ended (back in the free world) before every step was won (won: ${[...won].join(', ') || 'none'})`);
      } else ended = null;
      if (view === '2d') for (const ef of plan) if (!won.has(ef) && !served2d.has(ef)) { served2d.add(ef); soft(false, `${ef} is served as a flat 2D panel, not in the 3D world`); }
      if (Date.now() - lastProgress > 45_000) {
        await shot(page, 'stuck');
        hard(false, `stuck for 45 s at "${lastBeat}" — no play hint, no known answer, no Verder or action button (visible buttons: ${await visibleButtons(page)})`);
      }
      const ef = plan.find((e) => !won.has(e)) ?? plan[0];

      // (a0) a walk: the ranger walks there with the arrow keys (the adventure's walk hint)
      const first = await R<Hint | null>(page, 'r.playHint()');
      if (first?.walk) {
        const g = log(`walk`);
        const w = await walkTo(page, { x: first.walk.x, z: first.walk.z }, {
          stopDist: first.walk.r, timeout: 90_000,
          stopWhen: async () => (await R<Hint | null>(page, 'r.playHint()'))?.id !== first.id,
        });
        g.walks += 1;
        walkQuality(w, `walk "${first.id}"`);
        hard(w.res === 'arrived' || w.res === 'until', `walking to "${first.id}" with the arrow keys got ${w.res} at (${r2(w.end.x)}, ${r2(w.end.z)})`);
        lastProgress = Date.now();
        continue;
      }
      // (a) a 3D target: click where the engine says a perfect player clicks next
      if (first) {
        let h = first; // let a camera move settle: the target must hold still under the mouse
        for (let i = 0; i < 15; i++) {
          await sleep(page, 150);
          const h2 = await R<Hint | null>(page, 'r.playHint()');
          if (!h2 || h2.id !== h.id || h2.walk) break;
          const still = Math.hypot(h2.x - h.x, h2.y - h.y) < 3; h = h2;
          if (still) break;
        }
        if (h.walk) continue;
        const key = adv?.beat ?? ef;
        const g = log(key);
        g.hints += 1;
        if (!h.onScreen) g.offScreen.push(h.id);
        if (!h.firstHit) g.hidden.push(`"${h.id}" behind ${h.firstHitBy}`);
        if (!h.aboveGround) g.buried.push(h.id);
        if (h.bottomGap !== null && Math.abs(h.bottomGap) > SEAT_TOLERANCE) g.unseated.push(`"${h.id}" ${h.bottomGap > 0 ? '+' : ''}${h.bottomGap} m`);
        if (!h.reachesCanvas) g.blocked.push(`"${h.id}" under ${h.blocker}`);
        // GOAL 6: the same real animal models as the world, not primitive stand-ins
        const animal = animalOf(ef);
        if (animal && h.id === 'target' && h.parts.length && h.parts.every((t) => t !== 'BufferGeometry')) g.standIns.push(`the ${animal} "${h.id}" is ${h.parts.join(' + ')}`);
        hard(h.onScreen, `${key}: the target "${h.id}" is off-screen (${h.x}, ${h.y}); a player cannot click it`);
        const before = { id: h.id, text: await uiText(page), trials: JSON.stringify((await save(page))?.trials) };
        await page.mouse.click(h.x, h.y);
        g.clicks += 1;
        const reacted = await expect.poll(async () => {
          const h3 = await R<Hint | null>(page, 'r.playHint()');
          return h3?.id !== before.id || (await uiText(page)) !== before.text || JSON.stringify((await save(page))?.trials) !== before.trials;
        }, { timeout: 10_000 }).toBe(true).then(() => true, () => false); // a click reacts within a frame or two; 4 s ran out in missions.spec at load ~80
        hard(reacted, `${key}: a real mouse click on "${h.id}" at (${h.x}, ${h.y}) did nothing` +
          (h.reachesCanvas ? '' : ` — the click lands on ${h.blocker}, not on the 3D scene`));
        lastProgress = Date.now();
        continue;
      }

      // (b) a choice round with DOM buttons (dagnacht): the right answer is the option
      //     marked goed:true in the mission content, picked by matching the question the
      //     card shows against the encounters of ANY step (run 6: they interleave)
      const text = await uiText(page);
      const enc = encounters.find((e) => text.includes(e.vraag));
      const right = enc?.opties.find((o) => o.goed)?.label;
      const btn = right ? page.getByRole('button', { name: right, exact: true }).filter({ visible: true }).first() : null;
      if (enc && right && btn && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) {
        await clickButton(page, right, `${adv?.beat ?? ef} answer`);
        log('dagnacht').answers += 1;
        await expect.poll(async () => !(await uiText(page)).includes(enc.vraag), { timeout: 8_000 }).toBe(true).catch(() => {});
        lastProgress = Date.now();
        continue;
      }

      // (c) a card to close (a found card, the raaf's fact), or an action in the world
      if (await page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).count()) {
        await clickButton(page, /^(Verder|Klaar)$/, `${adv?.beat ?? ef} card`);
        await sleep(page, 400);
        lastProgress = Date.now();
        continue;
      }
      const act = page.locator('.adv-action').filter({ visible: true }).first();
      if (await act.isVisible().catch(() => false)) {
        const label = (await act.innerText()).trim();
        await clickButton(page, label, `${adv?.beat ?? ef} action`);
        lastProgress = Date.now();
        continue;
      }
      await sleep(page, 250); // a sequence is being shown, an animal walks: watch it, like a player
    }
    note(`the mission took ${((Date.now() - t6) / 1000).toFixed(0)} s for golden (${beats} beats); draw calls peaked at ${maxCalls}`);
    for (const [key, g] of Object.entries(logs)) {
      if (g.answers) note(`${key}: answers taken from the content (the option marked goed, matched by the question on screen)`);
      if (!g.hints) continue;
      soft(g.offScreen.length === 0, `${key}: ${g.offScreen.length}/${g.hints} hinted targets off-screen`);
      soft(g.hidden.length === 0, `${key}: ${g.hidden.length}/${g.hints} targets hidden, the first thing the ray hits is something else: ${[...new Set(g.hidden)].slice(0, 3).join('; ')}`);
      soft(g.buried.length === 0, `${key}: ${g.buried.length}/${g.hints} targets entirely under the rendered ground`);
      soft(g.unseated.length === 0, `${key}: targets not standing on the ground (±${SEAT_TOLERANCE * 100} cm): ${[...new Set(g.unseated)].slice(0, 3).join('; ')}`);
      soft(g.blocked.length === 0, `${key}: a click on the target lands on a DOM element: ${[...new Set(g.blocked)].slice(0, 2).join('; ')}`);
      soft(g.standIns.length === 0, `${key}: a primitive stand-in, not the real animal model: ${[...new Set(g.standIns)].slice(0, 2).join('; ')}`);
    }
    // run 6: the design's bar, measured (design run6-missions §3.9)
    if (stats.cover_ratio !== undefined) {
      note(`the hidden animal lies ${stats.lying_h} m high in cover ${stats.cover_h} m tall (×${stats.cover_ratio})`);
      soft(stats.cover_ratio >= 2, `the cover is only ${stats.cover_ratio}× the hidden animal's lying height (want ≥ 2)`);
    }
    soft(maxCalls < MAX_DRAW_CALLS, `draw calls peaked at ${maxCalls} during the mission (budget < ${MAX_DRAW_CALLS})`);
    hard(won.size >= Object.keys(need).length, `won ${won.size}/${Object.keys(need).length} mini-games before the time ran out (not won: ${plan.filter((e) => !won.has(e)).join(', ')})`);
    noNewErrors();
  });

  // --------------------------------------------------- 7. finish the mission ----
  await step(7, async () => {
    const mission = missions.find((m) => m.id === missionId)!;
    const t0 = Date.now(); // the last step's fact card may still be open: read it and go on
    while (!(await save(page))?.voltooid[missionId] && Date.now() - t0 < 30_000) {
      if (await page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).count()) {
        await clickButton(page, /^(Verder|Klaar)$/, 'last fact card');
      }
      await sleep(page, 500);
    }
    hard(!!(await save(page))?.voltooid[missionId], `after the last mini-game the mission was never marked done (visible buttons: ${await visibleButtons(page)})`);
    await sleep(page, 800);
    await shot(page, 'reward');
    const text = (await uiText(page)).toLowerCase();
    soft(text.includes(mission.titel.toLowerCase()), `no reward card naming "${mission.titel}"`);
    let clue = false;
    for (let i = 0; i < 8; i++) { // click through to the world like a player: prefer "back to patrol"
      if (await page.getByRole('button', { name: /Verder op patrouille/ }).filter({ visible: true }).count()) {
        await clickButton(page, /Verder op patrouille/, 'reward');
      } else if (await page.getByRole('button', { name: /Kijk wat je vond|Bekijk de wildcamera/ }).filter({ visible: true }).count()) {
        await clickButton(page, /Kijk wat je vond|Bekijk de wildcamera/, 'reward'); clue = true;
        await sleep(page, 800); await shot(page, 'clue');
        continue;
      } else if (await page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).count()) {
        await clickButton(page, /^(Verder|Klaar)$/, 'reward');
      } else if ((await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null) break;
      await sleep(page, 700);
    }
    // run 6: an adventure's reunion happens at the family's home: the young ends by its mother
    const places = await R<Record<string, P2> | null>(page, `r.missionPlaces(${JSON.stringify(missionId)})`);
    const fam = (await R<{ missionId: string; state: string; actors: { key: string; x: number; z: number }[] }[] | null>(page, 'r.residents()'))
      ?.find((h) => h.missionId === missionId);
    if (places?.home && fam) {
      const sow = fam.actors.find((a) => a.key === 'sow'), young = fam.actors.find((a) => a.key === 'lost');
      if (sow && young) {
        const gap = Math.hypot(sow.x - young.x, sow.z - young.z);
        note(`at the home: the young ${r2(gap)} m from its mother, ${r2(Math.hypot(young.x - places.home.x, young.z - places.home.z))} m from the home place`);
        soft(gap <= 2, `after the reunion the young stands ${r2(gap)} m from its mother (want ≤ 2 m)`);
        soft(Math.hypot(young.x - places.home.x, young.z - places.home.z) < 3, 'the young is home at the wallow');
        soft(fam.state === 'after', `the home is in its "after" state (it is "${fam.state}")`);
      }
    }
    const hook = 'verhaalHaak' in mission ? mission.verhaalHaak : null; // the last mission has a payoff instead
    if (hook) soft(clue, `mission "${mission.id}" carries a clue (${hook}) but no clue card was offered`);
    await expect.poll(async () => (await R<string>(page, 'r.screen')) === 'world' && (await R<string | null>(page, 'r.missionView')) === null,
      { timeout: 15_000, message: `the reward never led back to the world (visible buttons: ${await visibleButtons(page)})` }).toBe(true);
    await sleep(page, 2_000);
    // Did the WORLD change near the marker? Not the ranger walking about, not a roaming
    // animal, not an idle loop (worldChange leaves those out); every change is named.
    const after = await worldSamples(page, marker, SEAT_RADIUS, 3);
    const { appeared, gone, restless } = worldChange(seatsBefore, after);
    const names = (l: Seat[]): string => l.slice(0, 4).map((s) => s.id).join('; ') + (l.length > 4 ? '; …' : '');
    note(`within ${SEAT_RADIUS} m of the marker: ${appeared.length} things appeared${appeared.length ? ` (${names(appeared)})` : ''}, ${gone.length} gone${gone.length ? ` (${names(gone)})` : ''}`);
    const self = [...new Set(after.flat().filter((s) => s.moves).map((s) => `${s.moves === 'player' ? 'the ranger' : s.id}`))];
    if (self.length || restless.length) note(`not counted, they move by themselves: ${[...self, ...restless].slice(0, 4).join('; ')}`);
    if (!playerTold) soft(false, 'harness: "the world reacts" cannot be judged, the probe does not tell the player\'s own ranger apart (step 5)');
    else soft(appeared.length + gone.length > 0, `the world does not react: nothing within ${SEAT_RADIUS} m of the marker looks different after finishing`);
    noNewErrors();
  });

  // --------------------------------------------- 8. back in the world, reload ----
  await step(8, async () => {
    await shot(page, 'back-in-world');
    const s = await snap(page);
    hard(!!s.p, 'no ranger position after the mission');
    const places = await R<Record<string, P2> | null>(page, `r.missionPlaces(${JSON.stringify(missionId)})`);
    const dM = Math.hypot(s.p.x - marker.x, s.p.z - marker.z);
    const dH = places?.home ? Math.hypot(s.p.x - places.home.x, s.p.z - places.home.z) : Infinity;
    const dist = Math.min(dM, dH);
    note(`the ranger stands ${r2(dM)} m from the finished marker${places?.home ? `, ${r2(dH)} m from the mission's home` : ''}`);
    soft(dist <= 12, `back in the world ${r2(dist)} m away from the mission (teleported?)`);
    // after a reload the family still lives at its home, in its after state (checked below)
    soft(!!s.g?.grounded, 'back in the world the ranger is not on the ground');
    const hud = await uiText(page);
    const offered = missions.find((m) => m.id !== missionId && hud.includes(m.titel));
    soft(!!offered, `the HUD offers no next mission (HUD text: "${hud.replace(/\s+/g, ' ').slice(0, 100)}")`);
    if (offered) note(`next mission offered: "${offered.titel}"`);
    const walk = await holdKey(page, 'ArrowUp', 1_000);
    soft(walk.moved >= 0.8, `cannot walk on after the mission (moved ${walk.moved} m in 1 s)`);
    // reload: the progress must survive
    expectedLoads += 1;
    await page.reload();
    const up = await page.getByRole('button', { name: 'Begin', exact: true }).waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false);
    hard(up, 'after a reload the title never showed "Begin"');
    await sleep(page, 500);
    await page.keyboard.press('Enter');
    // Enter pressed Begin when the title card goes (the world may take a few seconds
    // more to load behind it: that is not Enter failing)
    const beginGone = async (): Promise<boolean> => (await R<string>(page, 'r.screen')) !== 'title'
      || !(await page.getByRole('button', { name: 'Begin', exact: true }).isVisible().catch(() => false));
    const enterWorks = await expect.poll(beginGone, { timeout: 3_000 }).toBe(true).then(() => true, () => false);
    soft(enterWorks, 'Enter does not press Begin on the title');
    if (!enterWorks) await clickButton(page, 'Begin', 'title after reload', 10_000, 30_000);
    await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000, message: 'after a reload Begin must go straight back into the world' }).toBe('world');
    const sv = await save(page);
    hard(!!sv?.voltooid[missionId], `after a reload mission "${missionId}" is no longer done`);
    await sleep(page, 2_500);
    await shot(page, 'after-reload');
    const famR = (await R<{ missionId: string; state: string }[] | null>(page, 'r.residents()'))?.find((h) => h.missionId === missionId);
    if (famR) soft(famR.state === 'after', `after a reload the family's home is in its "${famR.state}" state (want "after")`);
    const hud2 = await uiText(page);
    const offered2 = missions.find((m) => m.id !== missionId && hud2.includes(m.titel));
    soft(!!offered2 && (!offered || offered2.id === offered.id), `after a reload the HUD offers "${offered2?.titel ?? 'nothing'}"${offered ? ` instead of "${offered.titel}"` : ''}`);
    noNewErrors();
  });
});
