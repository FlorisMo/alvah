import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { R, sleep, walkTo, visibleButtons, MAX_DRAW_CALLS, type Hint, type P2 } from './golden-lib';

/**
 * RUN 7 · MOODS — different light every visit, and every animal readable in every light
 * (design run7-foundation §6). Not in the smoke set; run it on demand:
 *
 *   RANGER_PORT=<port> npx playwright test e2e/moods.spec.ts --project=chromium --grep @moods
 *
 * It plays like a player (Begin with the mouse, the arrow keys to walk, "Speel mee" and
 * "Ga op pad" clicked) and READS the dev hook only. Each mood is chosen with `?mood=<id>`
 * (dev and tests); the crossfade test uses `&fade=<id>` (dev: the world turns into that mood
 * a few seconds after he enters it). It prints its numbers and saves its screenshots in
 * test-results/moods/ — look at them:
 *
 * - visits: a fresh save stands in the golden hour, the title already in it; each reload
 *   after (a new visit) stands in a new mood, never the last one;
 * - the crossfade: calm (the sky and the light only go one way, the sun never moves in view),
 *   under 150 draw calls; a cut under reduced motion;
 * - per mood: the roaming boar, the sow at the wallow, the red deer at the herstel marker,
 *   the roe and the fox at ~40 m and ~20 m from the lens: their OWN pixels (`__ranger.animals()`:
 *   the points where a ray from the lens meets the animal first) must reach a darkest tenth
 *   of sRGB luma ≥ 22 and a median ≥ 40 (they rendered almost black before);
 * - per mood: each adventure's home, and the frisling's search view reached by playing (the
 *   same seed in every mood, so the same hiding place), with the piglet's contrast to the
 *   bracken round it.
 */

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const MOODS = ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt', 'schemer'] as const;
type MoodId = (typeof MOODS)[number];
const OUT = 'test-results/moods';
const P10_MIN = 22;
const MEDIAN_MIN = 40;

type Seen = { id: string; x: number; z: number; dist: number; box: [number, number, number, number]; onScreen: boolean; pts: [number, number][] };
type SkyMood = { now: string; from: string; fade: number; sunElevation: number; sunPending: boolean; fogNear: number; fogFar: number; wind: number };

function dir(...parts: string[]): string {
  const d = path.join(OUT, ...parts);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** sRGB luma (0-255) of a screenshot's pixels at the given CSS points (DPR 1). */
async function lumas(png: Buffer, pts: [number, number][]): Promise<number[]> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return pts.map(([x, y]) => {
    const i = (Math.min(info.height - 1, Math.round(y)) * info.width + Math.min(info.width - 1, Math.round(x))) * info.channels;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }).sort((a, b) => a - b);
}
const pct = (xs: number[], q: number): number => xs.length ? Math.round(xs[Math.min(xs.length - 1, Math.floor(xs.length * q))]) : NaN;

/** Begin (and the ranger maker on a fresh save) → the world. */
async function enter(page: Page): Promise<void> {
  const begin = page.getByRole('button', { name: 'Begin' });
  await begin.waitFor({ state: 'visible', timeout: 60_000 });
  await begin.click({ timeout: 30_000 });
  const maker = page.getByRole('button', { name: 'Dit is mijn ranger' });
  if (await maker.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true, () => false)) await maker.click({ timeout: 30_000 });
  await expect.poll(() => R<string>(page, 'r.screen'), { timeout: 60_000 }).toBe('world');
  await expect.poll(() => R<P2 | null>(page, 'r.pos()'), { timeout: 30_000 }).not.toBeNull();
  await sleep(page, 1_500);
}

/** Turn on the spot with taps of the arrow keys until the lens looks at `at`. */
async function face(page: Page, at: P2, tol = 5): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const s = await R<{ p: P2; c: { x: number; z: number } }>(page, '({ p: r.pos(), c: r.cam() })');
    let fx = s.p.x - s.c.x, fz = s.p.z - s.c.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const dx = at.x - s.c.x, dz = at.z - s.c.z, d = Math.hypot(dx, dz) || 1;
    const ang = (Math.atan2((dx * -fz + dz * fx) / d, (dx * fx + dz * fz) / d) * 180) / Math.PI;
    if (Math.abs(ang) < tol) return;
    const k = ang > 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(k); await sleep(page, Math.min(300, Math.abs(ang) * 6)); await page.keyboard.up(k); await sleep(page, 350);
  }
}

/** A spot `back` m out from `at` with nothing solid between (trunks, bushes, the cabin:
 *  `__ranger.obstacles()`), inside the world, nearest to `from`. */
async function vantage(page: Page, at: P2, from: P2, back: number): Promise<P2> {
  return page.evaluate(({ at, from, back }) => {
    type O = { x: number; z: number; r: number; box?: { hx: number; hz: number } };
    const obs = (window as unknown as { __ranger: { obstacles(): O[] } }).__ranger.obstacles();
    const clear = (a: { x: number; z: number }): boolean => {
      const dx = at.x - a.x, dz = at.z - a.z, L2 = dx * dx + dz * dz || 1;
      return obs.every((o) => {
        const rr = o.box ? Math.hypot(o.box.hx, o.box.hz) : o.r;
        const k = Math.max(0, Math.min(0.92, ((o.x - a.x) * dx + (o.z - a.z) * dz) / L2));
        return Math.hypot(o.x - (a.x + dx * k), o.z - (a.z + dz * k)) - rr > 0.5;
      });
    };
    let best: { x: number; z: number } | null = null, cost = Infinity;
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const A = { x: at.x + Math.sin(ang) * back, z: at.z + Math.cos(ang) * back };
      if (Math.hypot(A.x, A.z) > 58 || !clear(A)) continue;
      const c = Math.hypot(A.x - from.x, A.z - from.z);
      if (c < cost) { cost = c; best = A; }
    }
    if (best) return best;
    const dx = at.x - from.x, dz = at.z - from.z, l = Math.hypot(dx, dz) || 1;
    return { x: at.x - (dx / l) * back, z: at.z - (dz / l) * back };
  }, { at, from, back });
}

/** The animals the readability check looks at, and where each stands now. */
const ANIMALS: { name: string; model: string; where: (page: Page) => Promise<P2 | null> }[] = [
  { name: 'boar (roaming)', model: 'animal-wildzwijn-boar', where: async (page) => R<P2 | null>(page, "(() => { const a = r.ambient()?.find((x) => x.id === 'animal-wildzwijn-boar'); return a ? { x: a.x, z: a.z } : null; })()") },
  { name: 'sow (wallow)', model: 'animal-wildzwijn-boar', where: async (page) => R<P2 | null>(page, "(() => { const s = r.residents()?.find((h) => h.missionId === 'frisling')?.actors.find((a) => a.key === 'sow'); return s ? { x: s.x, z: s.z } : null; })()") },
  { name: 'red deer (herstel)', model: 'animal-edelhert-reddeer', where: async (page) => R<P2 | null>(page, "(() => { const m = r.markers()?.find((x) => x.missionId === 'herstel'); return m ? { x: m.x - 1.5, z: m.z } : null; })()") },
  { name: 'roe (roaming)', model: 'animal-ree-roedeer', where: async (page) => R<P2 | null>(page, "(() => { const a = r.ambient()?.find((x) => x.id === 'animal-ree-roedeer'); return a ? { x: a.x, z: a.z } : null; })()") },
  { name: 'fox (roaming)', model: 'animal-vos-fox', where: async (page) => R<P2 | null>(page, "(() => { const a = r.ambient()?.find((x) => x.id === 'animal-vos-fox'); return a ? { x: a.x, z: a.z } : null; })()") },
];

test.describe('@moods different light every visit', () => {
  test('a fresh save boots in the golden hour, the title already in it; every visit after stands in a new mood', async ({ page }) => {
    test.setTimeout(240_000);
    const d = dir('visits');
    const seen: string[] = [];
    for (let visit = 0; visit < 6; visit++) {
      if (visit === 0) await page.goto('/?dev=1'); else await page.reload();
      await expect.poll(() => R<boolean>(page, 'r.titleReady()'), { timeout: 60_000 }).toBe(true);
      await sleep(page, 800);
      const m = await R<{ session: string; now: string }>(page, 'r.mood()');
      const sky = await R<{ mood: SkyMood }>(page, 'r.sky()');
      await page.screenshot({ path: path.join(d, `visit-${visit}-${m.session}.png`) });
      console.log(`[moods] visit ${visit}: ${m.session} (on screen ${sky.mood.now}, fog ${sky.mood.fogNear}-${sky.mood.fogFar} m, sun ${sky.mood.sunElevation}°)`);
      expect(sky.mood.now, 'the title stands in the visit\'s mood').toBe(m.session);
      if (visit === 0) expect(m.session, 'a fresh save: the golden hour').toBe('gouden-uur');
      else expect(m.session, `visit ${visit}: never the last visit's mood`).not.toBe(seen[seen.length - 1]);
      seen.push(m.session);
    }
    expect(new Set(seen).size, `the visits' moods: ${seen.join(', ')}`).toBeGreaterThanOrEqual(3);
  });

  test('a crossfade is calm, under 150 draw calls, and a cut under reduced motion', async ({ browser }) => {
    test.setTimeout(240_000);
    const d = dir('crossfade');
    for (const reduced of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await ctx.newPage();
      await page.goto('/?dev=1&mood=zonnig&fade=schemer');
      // every drawn frame's mood state, recorded in the page (reads only): a busy laptop draws
      // few frames, and a poll from here would miss most of the fade
      await page.evaluate(() => {
        const w = window as unknown as { __moodLog: unknown[]; __ranger: { sky(): { mood: unknown }; drawCalls(): number | null } };
        w.__moodLog = [];
        const tick = (): void => {
          const r = w.__ranger;
          if (r?.sky()) w.__moodLog.push({ sky: r.sky().mood, calls: r.drawCalls() });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await enter(page);
      await expect.poll(() => R<string>(page, 'r.sky().mood.now'), { timeout: 30_000 }).toBe('schemer');
      if (!reduced) await page.screenshot({ path: path.join(d, 'fade-1-during.png') });
      await expect.poll(() => R<number>(page, 'r.sky().mood.fade'), { timeout: 30_000 }).toBe(1);
      await sleep(page, 500);
      await page.screenshot({ path: path.join(d, `fade-2-after${reduced ? '-reduced' : ''}.png`) });
      const samples = await page.evaluate(() => (window as unknown as { __moodLog: { sky: SkyMood; calls: number | null }[] }).__moodLog) as { sky: SkyMood; calls: number | null }[];
      const during = samples.filter((s) => s.sky.now === 'schemer');
      expect(during.length, 'the world turned into the next mood').toBeGreaterThan(0);
      const fades = during.map((s) => s.sky.fade);
      const steps = fades.slice(1).map((f, i) => f - fades[i]);
      const elev = new Set(samples.map((s) => s.sky.sunElevation));
      const maxCalls = Math.max(...samples.map((s) => s.calls ?? 0));
      const part = fades.filter((f) => f > 0.02 && f < 0.98);
      console.log(`[moods] crossfade${reduced ? ' (reduced motion)' : ''}: ${samples.length} frames, ${part.length} of them part way (largest step ${Math.max(0, ...steps).toFixed(2)}); sun ${[...elev].join('/')}°; draw calls ≤ ${maxCalls}; the sun waits for a cut: ${during[during.length - 1].sky.sunPending}`);
      expect(steps.every((s) => s >= -1e-9), 'the fade only goes one way (no flicker)').toBe(true);
      expect(elev.size, 'the sun never moves in view').toBe(1);
      expect(maxCalls, 'draw calls during the fade').toBeLessThan(MAX_DRAW_CALLS);
      if (reduced) expect(part.length, 'reduced motion: a cut').toBe(0);
      else expect(part.length, 'a calm fade, seen part way').toBeGreaterThanOrEqual(3);
      await ctx.close();
    }
  });
});

for (const mood of MOODS) {
  test.describe(`@moods ${mood}`, () => {
    test(`${mood}: the boar, the sow, the red deer, the roe and the fox read as animals at 40 and 20 m`, async ({ page }) => {
      test.setTimeout(600_000);
      const d = dir(mood);
      await page.goto(`/?dev=1&mood=${mood}`);
      await enter(page);
      const rows: string[] = [];
      for (const a of ANIMALS) {
        for (const D of [40, 20]) {
          let at = await a.where(page);
          expect(at, `${a.name} is in the world`).not.toBeNull();
          // a clear view from ~D m (the lens stands ~4.4 m behind him)
          const spot = await vantage(page, at!, await R<P2>(page, 'r.pos()'), Math.max(1.5, D - 4.4));
          await walkTo(page, spot, { stopDist: 1.0, timeout: 120_000 });
          at = await a.where(page);
          await face(page, at!);
          await sleep(page, 900);
          at = await a.where(page); // (a roamer walks on: read it again)
          const all = (await R<Seen[] | null>(page, 'r.animals()')) ?? [];
          const it = all.filter((x) => x.id === a.model).sort((p, q) => Math.hypot(p.x - at!.x, p.z - at!.z) - Math.hypot(q.x - at!.x, q.z - at!.z))[0];
          const png = await page.screenshot({ path: path.join(d, `${a.name.split(' ')[0]}-${D}.png`) });
          if (!it || it.pts.length < 4) {
            rows.push(`${a.name} @${D}: not in the picture (${it ? `${it.dist.toFixed(1)} m, ${it.pts.length} px seen` : 'none'})`);
            expect.soft(false, `${mood}: ${a.name} at ~${D} m is not in the picture`).toBe(true);
            continue;
          }
          const ls = await lumas(png, it.pts);
          const p10 = pct(ls, 0.1), med = pct(ls, 0.5);
          rows.push(`${a.name} @${it.dist.toFixed(0)} m: p10 ${p10}, median ${med} (${ls.length} px)`);
          expect.soft(p10, `${mood}: ${a.name} at ${it.dist.toFixed(0)} m — its darkest tenth`).toBeGreaterThanOrEqual(P10_MIN);
          expect.soft(med, `${mood}: ${a.name} at ${it.dist.toFixed(0)} m — its median`).toBeGreaterThanOrEqual(MEDIAN_MIN);
        }
      }
      console.log(`[moods] ${mood} animals:\n  ${rows.join('\n  ')}`);
      fs.writeFileSync(path.join(d, 'ANIMALS.txt'), rows.join('\n') + '\n');
    });

    test(`${mood}: the four adventure homes and the frisling's search view`, async ({ page }) => {
      test.setTimeout(600_000);
      const d = dir(mood);
      await page.goto(`/?dev=1&mood=${mood}&seed=4242`);
      await enter(page);
      const rows: string[] = [];
      for (const id of ['eekhoorn', 'wildcamera', 'ree-niet-aanraken', 'frisling']) {
        const pl = await R<Record<string, P2> | null>(page, `r.missionPlaces('${id}')`);
        expect(pl, `${id} has a home`).not.toBeNull();
        const home = pl!.home ?? pl!.marker;
        const me = await R<P2>(page, 'r.pos()');
        const dx = home.x - me.x, dz = home.z - me.z, len = Math.hypot(dx, dz) || 1;
        await walkTo(page, { x: home.x - (dx / len) * 9, z: home.z - (dz / len) * 9 }, { stopDist: 1.5, timeout: 150_000 });
        await face(page, home);
        await sleep(page, 1_200);
        await page.screenshot({ path: path.join(d, `home-${id}.png`) });
        const calls = await R<number | null>(page, 'r.drawCalls()');
        rows.push(`home ${id}: draw calls ${calls}`);
        expect.soft(calls ?? 0, `${mood}: draw calls at the ${id} home`).toBeLessThan(MAX_DRAW_CALLS);
      }
      // the frisling: to its marker, "Speel mee", "Ga op pad", then play like a player (walk
      // the hints with the arrow keys, close the cards) until the search beat frames the stand
      const m = (await R<(P2 & { missionId: string })[]>(page, 'r.markers()')).find((x) => x.missionId === 'frisling')!;
      await walkTo(page, m, { stopDist: 1.0, timeout: 150_000, until: (s) => s.near === 'frisling' && !!s.p && Math.hypot(s.p.x - m.x, s.p.z - m.z) < 1.9 });
      await page.getByRole('button', { name: /Speel mee: De verdwaalde frisling/ }).click({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Ga op pad', exact: true }).click({ timeout: 15_000 });
      expect(await R<string>(page, 'r.mood().now'), 'the play stands in the visit\'s mood').toBe(mood);
      const t0 = Date.now();
      let hint: Hint | null = null;
      while (Date.now() - t0 < 180_000) {
        const adv = await R<{ beat: string } | null>(page, 'r.adventure()');
        const h = await R<Hint | null>(page, 'r.playHint()');
        if (adv?.beat === 'search' && h && !h.walk) { hint = h; break; }
        if (h?.walk) {
          await walkTo(page, { x: h.walk.x, z: h.walk.z }, { stopDist: h.walk.r, timeout: 90_000, stopWhen: async () => (await R<Hint | null>(page, 'r.playHint()'))?.id !== h.id });
          continue;
        }
        const next = page.getByRole('button', { name: /^(Verder|Klaar)$/ }).filter({ visible: true }).first();
        if (await next.isVisible().catch(() => false)) { await next.click(); continue; }
        await sleep(page, 250);
      }
      expect(hint, `the frisling's search beat (visible: ${await visibleButtons(page)})`).not.toBeNull();
      await sleep(page, 2_000); // the lens settles on the stand
      const all = (await R<Seen[] | null>(page, 'r.animals()')) ?? [];
      const h = (await R<Hint | null>(page, 'r.playHint()')) ?? hint!;
      const piglet = all.filter((x) => x.id === 'animal-frisling-piglet' && x.onScreen)
        .sort((p, q) => Math.hypot((p.box[0] + p.box[2]) / 2 - h.x, (p.box[1] + p.box[3]) / 2 - h.y) - Math.hypot((q.box[0] + q.box[2]) / 2 - h.x, (q.box[1] + q.box[3]) / 2 - h.y))[0];
      const png = await page.screenshot({ path: path.join(d, 'frisling-search.png') });
      if (piglet && piglet.pts.length >= 3) {
        const own = await lumas(png, piglet.pts);
        // what is round it: a ring one box wide around its screen box
        const [x0, y0, x1, y1] = piglet.box;
        const w = Math.max(8, x1 - x0), hh = Math.max(8, y1 - y0);
        const ring: [number, number][] = [];
        for (let y = y0 - hh; y <= y1 + hh; y += Math.max(1, hh / 8)) for (let x = x0 - w; x <= x1 + w; x += Math.max(1, w / 8)) {
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
          if (x >= 0 && y >= 0 && x < 1280 && y < 800) ring.push([x, y]);
        }
        const round = await lumas(png, ring);
        const a = pct(own, 0.5), b = pct(round, 0.5);
        const contrast = Math.abs(a - b) / Math.max(1, a + b);
        rows.push(`frisling search: the piglet's own pixels median ${a} (p10 ${pct(own, 0.1)}, ${own.length} px) · round it ${b} · contrast ${contrast.toFixed(2)} · seed ${(await R<{ seed: number } | null>(page, 'r.play()'))?.seed}`);
        expect.soft(pct(own, 0.5), `${mood}: the hidden piglet is not a black shape`).toBeGreaterThanOrEqual(MEDIAN_MIN);
      } else {
        rows.push(`frisling search: the piglet shows ${piglet?.pts.length ?? 0} px of itself`);
      }
      rows.push(`frisling search: draw calls ${await R<number | null>(page, 'r.drawCalls()')}`);
      console.log(`[moods] ${mood} homes:\n  ${rows.join('\n  ')}`);
      fs.writeFileSync(path.join(d, 'HOMES.txt'), rows.join('\n') + '\n');
    });
  });
}
