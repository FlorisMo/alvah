/**
 * ree.ts — "Het reekalf in het gras" as an adventure in the world (design run6 §4.2, run 7
 * `state/ree/design.md`).
 *
 * The doe grazes by her cover, out on the heath past the empty marker ring, all along. A
 * walker phoned in about a calf lying alone: lost? After one calm look at the mother, the
 * ranger follows her small prints along her trodden path (a wissel, with a bend) to a stand
 * of tall grass — and she lifts her head and slips into her cover. He finds the spotted calf
 * pressed flat in the grass (ZOEKEN), and leaves it be with his HANDS, three times, in this
 * play's order: it peeps at his boots (aai), it stretches its nose to his hand (geur), it
 * stands up wobbly and totters toward him (oppakken) — a click on it is a hand reaching: it
 * bolts a few metres and drops again (or the mother barks from her cover), and the same
 * moment comes back (RUSTKRACHT). He sneaks off himself to a hide — running gets "Sst" —
 * and a wet pool lies across one of his walks, on her path to the grass or on his way to
 * the hide: round it, not through it, with his FEET. From the hide, through his
 * binoculars, the doe steps out of her cover where she went in and walks to her calf; it
 * stands and she noses it. The path is free: he walks away quietly (the flip, a card) and
 * the calf drinks. Doe and calf graze together near the copse after.
 *
 * Run 7: every play is a different morning, drawn under the briefing card from the play's
 * seed (ree.variety.ts): one of three stands of tall grass, each with its own path there,
 * its own side to search it from and its own hide; the calf in one of four spots, never in
 * the middle of the picture; the doe at one of two graze spots; the pool on her path or on
 * his way; the three calm moments by the calf in a drawn order. A replay plays the same
 * morning (`?dev=1&seed=N`).
 *
 * Steps (content, the EF contract): 0 zoeken · 1 dagnacht, each logged once.
 */

import * as THREE from 'three';
import type { Distractor, Mission } from '../../../content/types';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Actor } from '../actors';
import type { Play } from '../../../core/play';
import type { Residents } from '../../world/Residents';
import type { Spot } from '../types';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial, buildSpoor } from '../../../engines/zoeken';
import { spoorTrail } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { searchBeat } from '../beats/search';
import { choiceRun, type ChoiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { atLocal, dist, headingTo, toLocal, toward } from '../places';
import { ARRIVE_RADIUS, bearing, cue as cueAt } from '../../Wayfinding';
import { backPoints, openWindow } from '../cover-math';
import { SIZE } from '../../AnimalScale';
import { TREE_BASE_H } from '../../world/Forest';
import { heightAt } from '../../Biomes';
import { ReeHome } from './ree.home';
import {
  drawReePlay, lastReeVariants, printRuns, reeGrowth, watchScript, VARIANT_KEY, type CalfMoment, type ReePlay, type WatchCue,
} from './ree.variety';
import {
  REE_HOME, REE_LAYOUTS, REE_RESIDENTS, COPSE_TREES, CALF_DOELEN, POOL, reeClearings, slotTrail, calfAt, calfTalkOf, calfBolt, calfView,
  drinkSpot, leaveView, poolSides, reunionPose, walkVia, type PoolSpot, type ReeLayout,
} from './ree.places';

const MISSION = 'ree-niet-aanraken';

/** The keys that would take a step (the watch from the hide asks him to keep still). */
const STEP_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;
/** (How long he must keep still before a startled mother walks on is the level's: run 7,
 *  `reeGrowth(...).stillS`, 2.2 s on a fresh save, up to 3.5 s.) */

/** Her prints on her wissel: so many a metre, whatever the level (run 7: a practised
 *  ranger's prints are fainter and broken by gaps, never denser). */
const PRINTS_PER_M = 1.6;

/** The content's zoeken decoys of this mission (a stand shows them all until a trial
 *  keeps its own). */
function distractorsOf(m: Mission | undefined): readonly Distractor[] {
  return (m?.stappen[0]?.skin.distractors ?? []) as Distractor[];
}
/** The spots the calf may lie in (the content's `doelen`; the places' pinned copy when a
 *  skin has none). */
function doelenOf(m: Mission): readonly { x: number; y: number }[] {
  const d = (m.stappen[0]?.skin as { doelen?: { x: number; y: number }[] }).doelen;
  return d?.length ? d : CALF_DOELEN;
}

let contentDecoys: readonly Distractor[] = [];

/** The doe's brisk walk (m/s: her walk is 0.8) when her cover lies far across the heath,
 *  and out of her bed to her gap in the watch, unseen. */
const BRISK = 1.25;

/** The watch's rustle stands at least this long (s) before "Daar is de moeder!" (its own
 *  line is heard first, however soon she shows). */
const RUSTLE_MIN_S = 1.4;

/** How far (m) the doe walks to this morning's graze spot under the briefing card (beyond
 *  it, the walk would hold up the first look: she is put there where nobody sees it). */
const DOE_WALK_M = 6;

/** Is (x, z) in the picture beside the briefing card (the card covers the middle of it)?
 *  (`heightAt`: the pure terrain height; only to aim the check, nothing stands on it) */
function besideCard(cam: THREE.Camera, at: { x: number; z: number }): boolean {
  const v = new THREE.Vector3(at.x, heightAt(at.x, at.z) + 0.7, at.z).project(cam);
  if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) return false; // off screen
  return !(Math.abs(v.x) < 0.42 && Math.abs(v.y) < 0.8); // under the card: hidden
}

/** This play's morning, drawn and laid under the briefing card (`prepare`). */
let drawn: { seed: number; play: ReePlay } | null = null;

/** Draw this play's morning (from its seed and the ree's last plays) and lay it in the
 *  world: the calf in its spot (it lies hidden in the grass: put there at once), the doe
 *  walking to her graze spot, the stand's look-alikes, the pool, her path. */
function lay(world: { residents: Residents }, mission: Mission, play: Play): ReePlay | null {
  const home = world.residents.dressing(MISSION) as ReeHome | null;
  if (!home) return null;
  const p = drawReePlay(play, lastReeVariants(store.get().geschiedenis, MISSION), undefined, (id) => poolSides(REE_LAYOUTS[id]));
  play.note(VARIANT_KEY, p.variant);
  const l = REE_LAYOUTS[p.layout];
  const doel = doelenOf(mission)[p.spot] ?? CALF_DOELEN[p.spot];
  const calf = calfAt(l, doel);
  // run 7: the trial as the 2D floor builds it (the level's knobs, this play's fork): how
  // many look-alikes and which, how much of the calf's back shows
  const trial = buildZoekenTrial(mission.stappen[0].skin, store.knobs('zoeken'), play.fork('zoeken').rng);
  home.layPlay({ layout: l, calf, pool: p.pool, decoys: trial.decoys.map((d) => d.id), glimpse: trial.glimpse });
  const g = l.graze[p.graze];
  world.residents.repose(MISSION, 'calf', 'before', { x: calf.x, z: calf.z, yaw: calf.yaw, idle: 'lie', roam: 0 });
  // the doe grazes by this morning's cover: she walks there, unless it lies across the
  // heath (her thicket is ~19 m from her copse) and neither where she is nor where she
  // goes shows beside the briefing card: then she is simply there when the card goes
  const doe = world.residents.read().find((h) => h.missionId === MISSION)?.actors.find((a) => a.key === 'doe');
  const cam = (world as { camera?: THREE.Camera }).camera;
  const far = !!doe && Math.hypot(doe.x - g.x, doe.z - g.z) > DOE_WALK_M;
  const unseen = !!doe && !!cam && !besideCard(cam, doe) && !besideCard(cam, g);
  world.residents.repose(MISSION, 'doe', 'before', { x: g.x, z: g.z, yaw: g.yaw, idle: 'graze', roam: 0.5 }, { walk: !(far && unseen), cover: l.bed });
  drawn = { seed: play.seed, play: p };
  return p;
}

export const reeAdventure: Adventure = {
  id: MISSION,
  home: REE_HOME,
  clearings: reeClearings(),
  // the copse's birches and pine join the world's forest (instanced, faded for the lens,
  // a solid trunk), each at its grown height
  trees: COPSE_TREES.map((t, i) => ({
    x: t.x, z: t.z, species: t.species, s: t.h / TREE_BASE_H[t.species], rotY: ((i + 3) * 2.39996) % (Math.PI * 2),
  })),
  dressing: (env) => new ReeHome(env, contentDecoys),
  bind(mission) { contentDecoys = distractorsOf(mission); },
  // a calf flat in the grass reads the same in each: misty mornings most of all, a bright
  // day, an overcast one, the golden hour; never dusk
  moods: { allow: ['ochtendnevel', 'ochtendnevel', 'zonnig', 'bewolkt', 'gouden-uur'] },

  /** Under the briefing card: this play's morning is laid. */
  prepare(world, mission, play) { lay(world, mission, play); },
  unprepare(world) {
    const home = world.residents.dressing(MISSION) as ReeHome | null;
    home?.useDecoys(contentDecoys.map((d) => d.id));
  },

  async play(k: AdventureKit): Promise<void> {
    // the morning laid under the card (or, when there was none, laid now: the calf hidden
    // in the grass, the doe walking to her spot)
    const p = drawn && drawn.seed === k.play.seed ? drawn.play : lay(k.world, k.mission, k.play);
    if (!p) throw new Error('[ree] no home');
    await story(k, REE_LAYOUTS[p.layout], p);
  },
};

/** The adventure, beat by beat. */
async function story(k: AdventureKit, l: ReeLayout, p: ReePlay): Promise<void> {
  const c = k.copy;
  const fam = k.borrow();
  const home = fam.dressing as ReeHome;
  const A = fam.actors as Record<'doe' | 'calf', Actor>;
  const { doe, calf } = A;
  const settings = store.get().settings;
  const g = k.ctx.groundY;
  const call = (id: string, x: number, z: number): void => {
    if (settings.geluid) Sound.callAt(id, x, z, listenerOf(k.world.camera));
  };
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  // an animal's walk the script waits on is part of the beat: a stop ends it at once
  const go = (a: Actor, x: number, z: number, o: Parameters<Actor['go']>[2] = {}): Promise<boolean> => k.guard(a.go(x, z, o));
  const graze = l.graze[p.graze];
  const pool = home.pool;
  // the five calm moments in this play's order (the same DagnachtRun; the 2D floor asks
  // them as cards): the pool may come first, on her path
  const rust = choiceRun(k, 1, { order: p.order });
  k.stats.look_alikes = home.laid.decoys.length;

  // 0 · she is at her graze spot (had she slipped into her cover, she steps out again; a
  // play laid her elsewhere: she walks there)
  if (dist(doe, graze) > 0.6 || doe.lies) {
    void doe.go(graze.x, graze.z, { speed: 'walk', face: graze.yaw }).then((ok) => { if (ok) doe.root(graze.x, graze.z, 0.4); });
    await k.until(() => dist(doe, graze) < 0.8, 6);
  } else doe.root(graze.x, graze.z, 0.4);

  // her fresh slots on her wissel, dark in its pale sand so they read from the ring, round
  // its bend; there as the card goes. Run 7: the level's trail knobs (`buildSpoor`, the
  // zoeken spoor axis: never the search's look-alikes) — a fresh ranger follows one dark
  // unbroken run, a practised one fainter prints broken by gaps (`reeGrowth`, `printRuns`)
  const grow = reeGrowth(k.knobs('zoeken'), k.knobs('dagnacht'));
  const spoor = buildSpoor(k.knobs('zoeken'));
  const legs = slotTrail(l);
  const runs = [...printRuns(legs.slice(0, 2).map((q) => dist(q.from, q.to)), grow.gaps), { leg: 2, a: 0, b: 1 }];
  for (const r of runs) {
    const q = legs[r.leg];
    const a = toward(q.from, q.to, dist(q.from, q.to) * r.a), b = toward(q.from, q.to, dist(q.from, q.to) * r.b);
    const n = Math.max(2, Math.round((dist(a, b) * PRINTS_PER_M) / 5));
    k.own(spoorTrail(a.x, a.z, b.x, b.z, n, g, 0.4 + 0.6 * spoor.helderheid, 1.0, 5, { slot: true, fadeFrom: 0.85 }).group);
  }
  k.stats.print_gaps = runs.length - legs.length;
  k.stats.print_dark = Math.round((0.4 + 0.6 * spoor.helderheid) * 100) / 100;

  // 1 · one calm look at the mother, grazing by her cover (or, this morning's cover
  // lying across the heath, still on her way there)
  const walking = dist(doe, graze) > 2;
  await k.look({ x: doe.x, z: doe.z, y: g(doe.x, doe.z) + 0.6 }, walking ? c.kijkLoopt ?? c.kijk : c.kijk, 2.5, { turn: true });

  // 2 · her slots lead along her path to the grass; walking up, he sees her slip into her
  // cover (the pool may lie across her path: round it, not through it)
  let slipping: Promise<void> | null = null;
  const slipAway = async (): Promise<void> => {
    await doe.lookAt(me, 1.4);                   // she lifts her head and looks at him
    if (k.beat === 'walk:meadow' || k.beat === 'meadow:watch') k.say(c.weg);
    // (from far off — her thicket lies across the heath — she walks briskly to her gap)
    for (const s of l.slip) {
      const speed = s === l.slip[0] && dist(doe, s) > 8 ? BRISK : 'walk';
      if (!(await doe.go(s.x, s.z, { speed, face: s === l.bed ? l.bed.yaw : undefined }))) return;
    }
    await doe.lie(true);                         // she beds down in the bracken
  };
  const setOff = { ...k.ranger() };
  const poolIn = p.pool === 'in' ? feetAtPool(k, rust, home, pool, 'meadow') : null;
  await k.walk({
    name: 'meadow', to: l.search, r: 1.4, line: c.volg, doel: c.chipGras, cue: c.sporen, glyph: 'footprints',
    via: walkVia(l, 'meadow', poolIn ? pool : null),
    tick: () => {
      const m = k.ranger();
      if (!slipping && (dist(m, setOff) > 1.2 || dist(m, doe) < 9)) slipping = slipAway();
      poolIn?.tick();
    },
  });
  poolIn?.done();
  slipping ??= slipAway();
  // he stops at the grass's edge while she slips in (he saw her go on his way here; the
  // search's view holds still, so she is out of sight before it starts: in her cover by
  // her bed, behind its bracken, need not wait for her to lie down)
  k.beat = 'meadow:watch';
  k.lockFollow();
  k.world.stopRanger();
  await k.until(() => doe.lies || dist(doe, l.bed) < 1.2, 12);

  // 3 · find the calf in the tall grass (zoeken)
  const lyH = lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf);
  await searchBeat(k, 0, {
    // (the glimpse window was fitted under the card to the level's share for this lens;
    // where he really stands, or on another screen, a share off the level's band is fitted
    // again for the lens he searches with: always the level's)
    view: l.views.search, stand: l.search, cover: home.cover, target: calf, call: 'fiep', lyingH: lyH, len: SIZE.reekalf.len,
    glimpse: home.laid.glimpse, fit: (eye, back, share) => home.fitGlimpse(eye, back, share),
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: (f) => home.poke(d, f) })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  // 4 · the raaf: a calf smells of almost nothing
  await k.fact(0);

  // 5-7 · by the calf: leave it be, with his hands, three times (this play's order)
  k.beat = 'calf:walk';
  const bed0 = { x: calf.x, z: calf.z };
  const talk = calfTalkOf(l, bed0);
  await k.walkRanger(talk.x, talk.z, 0.05);  // up to it, calmly, through the grass
  // the stems between him and it bend aside: from the close view it lies in plain sight
  // by his boots (a window in the grass for that lens, the grass round it parted)
  const view = calfView(l, bed0, talk);
  const uncover = (at: { x: number; z: number; yaw: number }): void => {
    const lens = k.lensFor(view).cam;
    const drawnH = home.cover.stems.map((st) => st.h);
    const more = openWindow(home.cover.stems, lens, backPoints(at.x, g(at.x, at.z), at.z, at.yaw, SIZE.reekalf.len, lyH), 0.8);
    if (more.length) home.cover.settle(more, 1.0, drawnH);
    home.cover.partAt(at.x, at.z, 0.85, 0.7, 120);
  };
  uncover(calf);
  k.beat = 'calf:frame';
  await k.frame(view, { face: talk.heading });
  // a wrong answer startles it: it jumps up, bolts a metre and a half to the side (never at
  // him, never at the lens) and drops flat in the grass again
  const boltTo = calfBolt(l, bed0, talk);
  const bolt = async (squeak: boolean): Promise<void> => {
    const there = dist(calf, bed0) < 0.5 ? boltTo : bed0;
    if (settings.geluid) Sound.rustle();
    if (squeak) call('fiep', calf.x, calf.z);
    const face = headingTo(k.ranger(), there) + Math.PI / 2;
    uncover({ ...there, yaw: face });
    await go(calf, there.x, there.z, { speed: 'trot', face });
    await k.guard(calf.lie(true));
  };
  // run 7: the calf tempts him as often as the level says (`tempts`, 1 → 3 a hold), each
  // time a little more (a peep; its head up to him; a wriggle in the grass and a peep);
  // standing up it totters as many wobbly steps toward him as the level says (`wobble`),
  // never nearer than a long arm's length
  let pull = 0;
  const peep = (): void => call('fiep', calf.x, calf.z);
  const later = (ms: number, fn: () => void): void => { window.setTimeout(() => { if (!k.signal.aborted) fn(); }, ms); };
  // (it wriggles where it lies: the grass round it stirs, it lifts its head to him)
  const wriggle = (): void => {
    home.cover.rustle(home.cover.nearestClump(calf.x, calf.z)?.i ?? 0, 0.09);
    if (settings.geluid) Sound.rustle();
    void calf.lookAt(me, 1.8);
  };
  const pulls: Record<'aai' | 'geur', (() => void)[]> = {
    aai: [
      () => { peep(); void calf.lookAt(me, 1.6); },
      () => { void calf.lookAt(me, 2.4); if (settings.geluid) Sound.rustle(); later(500, peep); },
      () => { wriggle(); later(350, peep); },
    ],
    geur: [
      () => { void calf.lookAt(me, 1.8); if (settings.geluid) Sound.rustle(); },
      () => { peep(); void calf.lookAt(me, 2.2); },
      () => { wriggle(); later(450, peep); },
    ],
  };
  const tempt = (id: 'aai' | 'geur') => (): void => { pulls[id][pull % pulls[id].length](); pull += 1; };
  let steps = 0;
  const moments: Record<CalfMoment, () => Promise<void>> = {
    // HANDS STILL: it lies by his boots and peeps; a click on it is a hand reaching to stroke it
    aai: () => {
      pull = 0;
      return rust.still('aai', {
        line: c.raakNiet, hands: () => calf.body,
        show: () => call('fiep', calf.x, calf.z),
        // a moment in, it lifts its head and peeps at him again (the hand wants to go)
        tempt: tempt('aai'),
        wrong: () => bolt(false),
      });
    },
    // …and still, while it stretches its nose toward his hand (a click: his hand at its nose)
    geur: () => {
      pull = 0;
      return rust.still('geur', {
        line: c.snuffelt, hands: () => calf.body,
        show: () => { void calf.lookAt(me, 2.4); },
        tempt: tempt('geur'),
        // his hand at its nose: from her cover a short bark — the mother noticed; the calf
        // presses flatter and looks toward her
        wrong: async () => {
          call('ree', l.bed.x, l.bed.z);
          home.rustleGap(l, 0.12);
          await k.guard(calf.lookAt(() => ({ x: l.bed.x, z: l.bed.z, speed: 0 }), 2.2));
        },
      });
    },
    // …and still, while it gets up on wobbly legs and totters toward him, a step at a time
    // (the level's wobbly steps), peeping: is it lost? It is not (a click on it: a hand
    // reaching to pick it up; it startles, bolts and drops again). Held: it lies down again
    // where it stands.
    oppakken: () => {
      steps = 0;
      return rust.still('oppakken', {
        line: c.opstaan ?? c.raakNiet, hands: () => calf.body,
        show: () => { void totter(); },
        tempt: () => { if (steps < grow.wobble) void totter(); else { peep(); void calf.lookAt(me, 1.6); } },
        wrong: () => { steps = 0; return bolt(true); },
        right: async () => { await k.guard(calf.lie(true)); },
      });
    },
  };
  k.stats.calf_wobble = grow.wobble;
  /** The calf gets up (the first time) and totters a wobbly step toward him (beside him,
   *  never at the lens, stopping a long arm's length from his boots), peeping. */
  const totter = async (): Promise<void> => {
    steps += 1;
    call('fiep', calf.x, calf.z);
    if (calf.lies) await calf.lie(false);
    const r = k.ranger();
    const side = toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, calf).u > toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, r).u ? 1 : -1;
    const near = toward(r, calf, 1.0);
    const across = { x: near.x + Math.cos(view.heading) * 0.25 * side, z: near.z - Math.sin(view.heading) * 0.25 * side };
    // (the room to him shared out over the level's steps: each one short and wobbly)
    const room = Math.max(0, dist(calf, across) - 0.05);
    const stride = Math.min(0.55, room / Math.max(1, grow.wobble - steps + 1));
    const step = toward(calf, across, stride);
    if (stride > 0.08 && dist(step, r) > 0.9) await calf.go(step.x, step.z, { speed: 0.3, face: headingTo(step, r) });
    void calf.lookAt(me, 3);
  };
  for (let i = 0; i < 3; i++) {
    const id = rust.current?.id as CalfMoment | undefined;
    if (!id || !(id in moments)) break;
    if (i) await k.frame(calfView(l, { x: calf.x, z: calf.z }, talk)); // (where it lies now: it may have bolted)
    await moments[id]();
  }

  // 8-10 · he turns away from the calf and takes his first quiet steps out of the grass,
  // the lens swinging round behind him (then the way ahead is in view); then he sneaks on
  // himself, quietly, round the grass to the hide; the pool may lie across his way
  k.beat = 'calf:leave';
  const r8 = k.ranger();
  const first = toward(r8, l.way[0], 1.4);
  const swing = k.frame(leaveView(first, l.way[0]));
  await k.walkRanger(first.x, first.z, 0.05);
  await swing;
  k.world.faceRanger(headingTo(k.ranger(), l.way[0]));
  const hush = { line: c.sst, onRun: (): void => { void calf.lookAt(me, 1.6); call('fiep', calf.x, calf.z); } };
  const poolOut = p.pool === 'out' ? feetAtPool(k, rust, home, pool, 'hide') : null;
  let lineBack = -1;
  // (from here on the grass is seen from afar: drawn lighter once it is out of the picture)
  let thinned = false;
  await k.walk({
    name: 'hide', to: l.hide, r: 1.0, line: c.stil, doel: c.chipHut, cue: c.zacht, glyph: 'boot', quiet: hush,
    // (a perfect player's way: round the grass, and round the pool when it lies here)
    via: walkVia(l, 'hide', poolOut ? pool : null),
    tick: () => {
      if (!thinned) thinned = home.thinWhenUnseen(k.world.camera);
      if (poolOut) { poolOut.tick(); return; }
      if (lineBack < 0 && dist(k.ranger(), l.hide) < 4) { lineBack = 1; k.say(c.verstop); }
    },
  });
  poolOut?.done();

  // 11 · watch: the lens turns toward her cover and he watches through his binoculars; the
  // bracken at her gap stirs, and the mother steps out where she went in. Run 7: her small
  // acts come from this play's seed (`watchScript`: she stops and listens, eats, looks round,
  // looks at the hide, calls her calf), a line every few seconds; how often she stops to
  // listen and how long she waits for him to be still are the level's (`reeGrowth`)
  k.beat = 'watch:walk';
  await k.walkRanger(l.hide.x, l.hide.z, 0.05);
  k.beat = 'watch';
  const stillS = grow.stillS;
  const script = watchScript(k.play, { pauses: grow.pauses, way: l.watchWay.length ? 2 : 1 });
  k.stats.watch_pauses = grow.pauses;
  k.stats.watch_still_s = stillS;
  const t0 = k.now;
  // from the first moment of the watch he must keep STILL (a roe hears everything): a step
  // key or a tap on the world and she freezes, head up, staring at the hide ("Sta stil");
  // once he has been still the level's while she goes on where she was. Never a fail: it
  // only makes her wait. (Listening from here, before the lens turns and she walks to her
  // bed: a key in the watch's first seconds is answered like every later one.)
  const hide = { x: l.hide.x, z: l.hide.z, speed: 0 };
  let movedAt = -99;
  let lineNow = c.wacht;
  const sayW = (t: string): void => { lineNow = t; k.say(t); };
  const startle = (): void => {
    const fresh = k.now - movedAt > 1.5;
    movedAt = k.now;
    if (!fresh) return;
    k.stats.watch_moves = (k.stats.watch_moves ?? 0) + 1;
    k.say(c.staStil);
    if (settings.geluid) Sound.rustle();
    // standing, she turns her head up to the hide and stares; lying in her bed in her
    // cover, the bracken by her stirs (she heard it, out of sight)
    if (!doe.lies) void doe.lookAt(() => hide, Infinity);
    else home.rustleGap(l, 0.06);
  };
  const onKey = (e: KeyboardEvent): void => { if (STEP_KEYS.test(e.code)) startle(); };
  const onTap = (e: PointerEvent): void => { if (!(e.target as Element | null)?.closest?.('button')) startle(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onTap);
  /** He has been still long enough (else wait until he is, and say the line again). */
  const still = async (): Promise<void> => {
    if (k.now - movedAt >= stillS) return;
    await k.until(() => k.now - movedAt >= stillS, 600);
    k.say(lineNow);
  };
  /** Her calm walk to (x, z); a startle stops her, and she walks on once he is still. */
  const walkOn = async (x: number, z: number, o: Parameters<Actor['go']>[2] = {}): Promise<void> => {
    for (;;) {
      await still();
      if (await go(doe, x, z, { speed: 'walk', ...o })) return;
      if (k.now - movedAt > 1) return; // (blocked, not startled: she stays where she is)
    }
  };
  /** One of her acts, `s` s of it undisturbed: a startle makes her stare at the hide, and
   *  once he is still she takes it up again (`pose`) for the time it had left. */
  const act = async (s: number, pose: (left: number) => void): Promise<void> => {
    let left = s;
    pose(left);
    while (left > 0.05) {
      const from = k.now, m0 = movedAt;
      await k.until(() => movedAt !== m0 || k.now - from >= left);
      left -= k.now - from;
      if (movedAt !== m0) { await still(); if (left > 0.4) pose(left); }
    }
  };
  const meet = l.meet;
  const way = [l.gap, ...l.watchWay, meet];
  let calfAtNow = { x: calf.x, z: calf.z };
  // what she turns to: a rustle in the heather off to one side (never toward the lens),
  // the hide, round about, the grass where her calf lies
  const wv = { x: l.views.watch.at.x, z: l.views.watch.at.z, heading: l.views.watch.heading };
  let ritsel = k.play.fork('ree-ritsel').pick([1, -1] as const);
  const cueAt = (cue: WatchCue | undefined): (() => { x: number; z: number; speed: number }) => {
    if (cue === 'hut') return () => hide;
    if (cue === 'gras') return () => ({ ...calfAtNow, speed: 0 });
    if (cue === 'ritsel') {
      ritsel = (-ritsel) as 1 | -1;
      const p = atLocal(wv, toLocal(wv, doe).u + ritsel * 6, toLocal(wv, doe).v + 2.5);
      return () => ({ ...p, speed: 0 });
    }
    return () => hide;
  };
  // she is first seen (in the glasses' picture, out from behind her bushes): the moment
  // "Daar is de moeder!" is said (review r1 heard it 5-8 s before she showed)
  let seenAt = -1, sinceLook = 0, lookOut = false;
  let daar: string | null = null; // (the line waits for her)
  const offSeen = k.onTick((dt) => {
    if (!lookOut || seenAt >= 0 || doe.lies) return;
    sinceLook += dt;
    if (sinceLook < 0.08) return;
    sinceLook = 0;
    if (home.doeSeen(k.world.camera, doe) >= 2) {
      seenAt = k.now;
      if (daar) { sayW(daar); daar = null; k.stats.watch_out_lag = 0; }
    }
  });
  // her walk out of her bed to her gap, begun as the bracken stirs: brisk while unseen
  let outWalk: Promise<void> | null = null;
  const walkOut = async (): Promise<void> => {
    for (const q of [...[...l.bedWay].reverse(), l.gap]) await walkOn(q.x, q.z, seenAt < 0 ? { speed: BRISK } : {});
  };
  try {
    // he turns to her cover first and only then lifts his glasses (the turn never sweeps
    // the wildcamera's glade next door: every hide looks away from it)
    await k.frame(l.views.watch, { face: l.hide.heading });
    k.ui.watching(true);
    if (k.now - movedAt >= stillS) sayW(c.wacht); // (a step in the turn: "Sta stil" stays up)
    calf.idle();
    if (!doe.lies && dist(doe, l.bed) > 0.5) { // (a stop and a replay: she is in her bed)
      for (const s of l.slip) await walkOn(s.x, s.z, s === l.bed ? { face: l.bed.yaw } : {});
    }
    await k.wait(1.6);
    for (const e of script) {
      await still();
      if (e.line && e.act !== 'out') sayW(c[e.line] ?? lineNow);
      switch (e.act) {
        case 'rustle': {
          // the bracken at her gap stirs: she gets up in her bed and comes out between her
          // bushes, unseen; the rustle lasts until she is seen (and its line was heard) or
          // she stands in her gap
          home.rustleGap(l, 0.16);
          if (settings.geluid) Sound.rustle();
          const from = k.now;
          let atGap = false;
          lookOut = true;
          outWalk ??= walkOut().then(() => { atGap = true; });
          await k.until(() => (seenAt >= 0 && k.now - from >= RUSTLE_MIN_S) || (atGap && k.now - from >= e.s), 15);
          k.stats.watch_hidden_s = Math.round((k.now - from) * 10) / 10;
          break;
        }
        case 'out': {
          // "Daar is de moeder!" as she is seen (now, or the moment she is)
          const line = e.line ? c[e.line] ?? lineNow : null;
          if (line && seenAt >= 0) { sayW(line); k.stats.watch_out_lag = Math.round((k.now - seenAt) * 10) / 10; } else daar = line;
          lookOut = true;
          await (outWalk ??= walkOut()); // (out between her bushes)
          // …and on out into the open, clear of her cover's bushes, before she stops: to the
          // point of her way (or a few steps toward the meeting place)
          const q = e.to === 1 ? way[1] : toward(l.gap, meet, Math.min(1.3, dist(l.gap, meet) * 0.5));
          await walkOn(q.x, q.z);
          if (daar) { sayW(daar); daar = null; k.stats.watch_out_lag = -1; } // (out in the open in any case)
          break;
        }
        case 'walk': {
          const q = way[e.to === 1 ? 1 : way.length - 1];
          await walkOn(q.x, q.z);
          break;
        }
        case 'listen': {
          // she stops dead, head up, turned toward what she heard (a rustle: its sound)
          const to = cueAt(e.cue);
          if (e.cue === 'ritsel' && settings.geluid) Sound.rustle();
          await act(e.s, (left) => { void doe.lookAt(to, left + 0.3); });
          k.stats.watch_listens = (k.stats.watch_listens ?? 0) + 1;
          break;
        }
        case 'look': {
          if (e.cue === 'rond') {
            // a look round: one way, then the other
            const h0 = doe.yaw;
            const side = (a: number) => () => ({ x: doe.x + Math.sin(h0 + a) * 5, z: doe.z + Math.cos(h0 + a) * 5, speed: 0 });
            await act(e.s / 2, (left) => { void doe.lookAt(side(1.1), left + 0.2); });
            await act(e.s / 2, (left) => { void doe.lookAt(side(-1.1), left + 0.2); });
          } else {
            const to = cueAt(e.cue);
            await act(e.s, (left) => { void doe.lookAt(to, left + 0.3); });
          }
          break;
        }
        case 'bite':
          // her head down to the heather: a bite of grass where she stands
          await act(e.s, () => { doe.root(doe.x, doe.z, 0.05); });
          doe.idle();
          break;
        case 'call':
          // she turns to the grass where her calf lies and calls it softly; the grass stirs
          calfAtNow = { x: calf.x, z: calf.z };
          await act(e.s * 0.4, (left) => { void doe.lookAt(cueAt('gras'), left + 0.2); });
          call('fiep', doe.x, doe.z);
          home.cover.rustle(home.cover.nearestClump(calf.x, calf.z)?.i ?? 0, 0.1);
          await act(e.s * 0.6, () => {});
          break;
        case 'calf': {
          // the calf gets up and comes out of the grass to her (it stops at her head)
          await k.guard(calf.lie(false));
          const to = toward(doe, calfAtNow, 0.75);
          // (it trots to her: a calf called by its mother does not dawdle)
          await go(calf, to.x, to.z, { speed: dist(calf, to) > 2.5 ? 'trot' : 0.8, face: headingTo(to, doe) });
          void calf.lookAt(() => ({ x: doe.x, z: doe.z, speed: 0 }), 4);
          break;
        }
        case 'sniff':
          void doe.sniff(calf.x, calf.z, e.s, 0.5);
          await act(e.s, () => {});
          break;
      }
    }
  } finally {
    offSeen();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onTap);
  }
  k.stats.watch_s = Math.round(k.now - t0);

  // 12 · the path is free (the flip: now GO), played with his FEET (run 7): the glasses
  // come down and he walks away quietly himself. Staying put the level's while ("Blijf
  // staan", the old rule) or walking up to them: she lifts her head to him and steps back
  // toward her cover, the calf waiting, and the moment comes back. Running: "Sst".
  k.ui.watching(false);
  const family = (): Spot => {
    const m = k.ranger();
    return dist(m, doe) <= dist(m, calf) ? { x: doe.x, z: doe.z } : { x: calf.x, z: calf.z };
  };
  let backs = 0;
  await rust.go('moeder', {
    line: c.loopWeg ?? c.stil, family, to: l.wayOut, via: l.outWay, doel: c.chipWeg ?? c.chipHut, cue: c.zacht, glyph: 'boot', hush: c.sst,
    // (running: she lifts her head to him, her calf pressed to her)
    onRun: () => { void doe.lookAt(() => ({ ...me(), speed: 0 }), 1.6); },
    wrong: async () => {
      // she lifts her head to him; the first times she steps back toward her cover, her
      // calf waiting where it stands (he walked right up: it goes to its mother)
      await k.guard(doe.lookAt(() => ({ ...me(), speed: 0 }), 1.1));
      if (backs < 2 && dist(doe, l.gap) > 0.5) {
        backs += 1;
        const back = toward(doe, l.gap, Math.min(1.4, dist(doe, l.gap) * 0.7));
        await go(doe, back.x, back.z, { speed: 'walk', face: headingTo(back, me()) });
      }
      if (dist(me(), calf) < 3.2) {
        const to = toward(doe, calf, 0.75);
        await go(calf, to.x, to.z, { speed: 0.8, face: headingTo(to, doe) });
      }
    },
  });
  rust.done();

  // 13 · the reunion, through his glasses: he turns back to look; mother and calf big in
  // the picture, she side-on, the calf drinking at the flank he sees (a soft dip-cut when
  // he walked off the other way: never a swing round him)
  k.lockFollow();
  k.world.stopRanger();
  const pose = reunionPose(l);
  const doeBack = go(doe, meet.x, meet.z, { speed: 'walk', face: pose.yaw });
  k.ui.watching(true);
  await k.frame(l.views.reunion, { face: headingTo(k.ranger(), meet), dip: true });
  await doeBack;
  const drink = drinkSpot({ x: doe.x, z: doe.z, yaw: pose.yaw }, SIZE.ree.len, pose.side);
  await k.reunion(async () => {
    call('fiep', calf.x, calf.z);
    await calf.go(drink.x, drink.z, { speed: 'walk', face: drink.yaw });
    doe.idle();
    await k.wait(4.6);
  });
  k.stats.reunion_gap = Math.round(dist(calf, doe) * 100) / 100;
  // they set off home together across the heath, the calf at her pace (he sees them go
  // while the raaf talks; where they met lies up to ~14 m from their home)
  const after = Object.fromEntries(REE_RESIDENTS.map((r) => [r.key, r.after!]));
  void doe.go(after.doe.x, after.doe.z, { speed: 'walk', face: after.doe.yaw });
  void calf.go(after.calf.x, after.calf.z, { speed: 0.8, face: after.calf.yaw });
  k.ui.watching(false);
  // 14 · the raaf: a mother leaves her calf alone for a while; that keeps it safe
  await k.fact(1);
}

/**
 * The wet pool on a walk, answered with his FEET (rustkracht `modder`, the encounter's own
 * words, no card): coming up to it the pool is named (once); a boot in the water plashes
 * (ree.home.ts), off in the grass the calf lifts its head, the words for it, he steps back
 * out to its near edge — and from the second plash on the chip shows the way round; past
 * its far edge, dry: the good words. Answered once (the run marks a plash once, however
 * often). `done` answers it dry when he came by some other way round.
 */
function feetAtPool(k: AdventureKit, rust: ChoiceRun, home: ReeHome, pool: PoolSpot, walk: string): { tick(): void; done(): void } {
  const c = k.copy;
  const settings = store.get().settings;
  const enc = rust.current!; // (the pool's encounter, next in this play's order: its own words)
  let warned = false, past = false, wading = false, plashes = 0, lineBack = -1, nextRound = 0;
  const plash = async (): Promise<void> => {
    plashes += 1;
    k.stats.pool_plashes = plashes;
    if (plashes === 1) rust.answer('modder', false);
    if (settings.geluid) Sound.tryAgain();
    k.lockFollow();
    k.say(enc.gevolg ?? c.sst);
    await k.wait(1.4);
    await k.walkRanger(pool.edge.x, pool.edge.z, 0.05);
    k.world.faceRanger(pool.heading);
    await k.wait(0.4);
    k.free();
    // the second plash shows the way round: the chip points along the pool's side
    // (the walk's own line on the way to the grass: review r2 heard the hide's there)
    k.say(plashes >= 2 ? (c.eromheen ?? c.stil) : walk === 'hide' ? c.stil : c.volg);
    wading = false;
  };
  return {
    tick(): void {
      if (wading) return;
      if (past) { if (lineBack > 0 && k.now > lineBack) { lineBack = -1; k.say(walk === 'hide' ? c.verstop : c.volg); } return; }
      const r = k.ranger();
      const l = toLocal(pool, r);
      // coming up to it, the pool is named (once): the choice is his feet's
      if (!warned && (l.u / (POOL.halfW + 2.2)) ** 2 + (l.v / (POOL.halfD + 2.2)) ** 2 < 1) { warned = true; k.say(enc.vraag); }
      if (home.inWater(r.x, r.z)) { wading = true; void plash().catch(() => {}); return; }
      if (plashes >= 2) {
        // (after the second plash the chip names the way round and points along it: at
        // the next point of it still a stride ahead, the metres to its far end; never
        // "je bent er" before he is past the water)
        while (nextRound < pool.round.length - 1 && dist(pool.round[nextRound], r) < 1.2) nextRound += 1;
        const v = pool.round[nextRound], end = pool.round[pool.round.length - 1];
        const at = cueAt(bearing(r.x, r.z, r.heading, v.x, v.z), Math.max(ARRIVE_RADIUS, dist(r, end)));
        k.ui.setChip({ doel: c.chipRond ?? c.chipHut, cue: `${at.richting} · ${at.afstand}`, angle: at.angle, glyph: 'boot' });
      }
      // past its far edge, dry: round it — the good words, then the walk's own
      if (l.v > POOL.halfD + 0.3 && Math.abs(l.u) < POOL.halfW + 3) {
        past = true;
        rust.answer('modder', true);
        if (settings.geluid) Sound.correct();
        k.say(enc.uitleg ?? c.verstop, { good: true });
        lineBack = k.now + 2.8;
      }
    },
    done(): void {
      if (!past && rust.current?.id === 'modder') rust.answer('modder', true); // (he came by some other way round: dry)
    },
  };
}
