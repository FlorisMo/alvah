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

import type { Distractor, Mission } from '../../../content/types';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Actor } from '../actors';
import type { Play } from '../../../core/play';
import type { Residents } from '../../world/Residents';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial, buildSpoor } from '../../../engines/zoeken';
import { spoorTrail } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { searchBeat } from '../beats/search';
import { choiceRun, type ChoiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { dist, headingTo, toLocal, toward } from '../places';
import { ARRIVE_RADIUS, bearing, cue as cueAt } from '../../Wayfinding';
import { backPoints, openWindow } from '../cover-math';
import { SIZE } from '../../AnimalScale';
import { TREE_BASE_H } from '../../world/Forest';
import { ReeHome, SEARCH_GLIMPSE } from './ree.home';
import { drawReePlay, lastReeVariants, VARIANT_KEY, type CalfMoment, type ReePlay } from './ree.variety';
import {
  REE_HOME, REE_LAYOUTS, REE_RESIDENTS, COPSE_TREES, CALF_DOELEN, POOL, reeClearings, slotTrail, calfAt, calfTalkOf, calfBolt, calfView,
  drinkSpot, leaveView, poolSides, walkVia, type PoolSpot, type ReeLayout,
} from './ree.places';

const MISSION = 'ree-niet-aanraken';

/** The keys that would take a step (the watch from the hide asks him to keep still). */
const STEP_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;
/** How long (s) he must keep still before a startled mother walks on. */
const STILL_S = 2.2;

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
  const trial = buildZoekenTrial(mission.stappen[0].skin, store.difficulty('zoeken'));
  home.layPlay({ layout: l, calf, pool: p.pool, decoys: trial.decoys.map((d) => d.id), glimpse: SEARCH_GLIMPSE });
  const g = l.graze[p.graze];
  world.residents.repose(MISSION, 'calf', 'before', { x: calf.x, z: calf.z, yaw: calf.yaw, idle: 'lie', roam: 0 });
  world.residents.repose(MISSION, 'doe', 'before', { x: g.x, z: g.z, yaw: g.yaw, idle: 'graze', roam: 0.5 }, { walk: true, cover: l.bed });
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

  // 0 · she is at her graze spot (had she slipped into her cover, she steps out again; a
  // play laid her elsewhere: she walks there)
  if (dist(doe, graze) > 0.6 || doe.lies) {
    void doe.go(graze.x, graze.z, { speed: 'walk', face: graze.yaw }).then((ok) => { if (ok) doe.root(graze.x, graze.z, 0.4); });
    await k.until(() => dist(doe, graze) < 0.8, 6);
  } else doe.root(graze.x, graze.z, 0.4);

  // her fresh slots on her wissel, dark in its pale sand so they read from the ring (the
  // zoeken spoor leg sets how many and how clear), round its bend; there as the card goes
  const spoor = buildSpoor(store.difficulty('zoeken'));
  for (const leg of slotTrail(l)) {
    const n = Math.max(2, Math.round(spoor.legs * dist(leg.from, leg.to) / 6));
    k.own(spoorTrail(leg.from.x, leg.from.z, leg.to.x, leg.to.z, n, g, 0.4 + 0.6 * spoor.helderheid, 1.0, 5,
      { slot: true, fadeFrom: 0.85 }).group);
  }

  // 1 · one calm look at the mother, grazing by her cover
  await k.look({ x: doe.x, z: doe.z, y: g(doe.x, doe.z) + 0.6 }, c.kijk, 2.5, { turn: true });

  // 2 · her slots lead along her path to the grass; walking up, he sees her slip into her
  // cover (the pool may lie across her path: round it, not through it)
  let slipping: Promise<void> | null = null;
  const slipAway = async (): Promise<void> => {
    await doe.lookAt(me, 1.4);                   // she lifts her head and looks at him
    if (k.beat === 'walk:meadow' || k.beat === 'meadow:watch') k.say(c.weg);
    for (const s of l.slip) if (!(await doe.go(s.x, s.z, { speed: 'walk', face: s === l.bed ? l.bed.yaw : undefined }))) return;
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
  await k.until(() => doe.lies || dist(doe, l.bed) < 1.2, 9);

  // 3 · find the calf in the tall grass (zoeken)
  const lyH = lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf);
  await searchBeat(k, 0, {
    view: l.views.search, stand: l.search, cover: home.cover, target: calf, call: 'fiep', lyingH: lyH, glimpse: SEARCH_GLIMPSE,
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
  const moments: Record<CalfMoment, () => Promise<void>> = {
    // HANDS STILL: it lies by his boots and peeps; a click on it is a hand reaching to stroke it
    aai: () => rust.still('aai', {
      line: c.raakNiet, hands: () => calf.body,
      show: () => call('fiep', calf.x, calf.z),
      // a moment in, it lifts its head and peeps at him again (the hand wants to go)
      tempt: () => { call('fiep', calf.x, calf.z); void calf.lookAt(me, 1.6); },
      wrong: () => bolt(false),
    }),
    // …and still, while it stretches its nose toward his hand (a click: his hand at its nose)
    geur: () => rust.still('geur', {
      line: c.snuffelt, hands: () => calf.body,
      show: () => { void calf.lookAt(me, 2.4); },
      tempt: () => { void calf.lookAt(me, 1.8); if (settings.geluid) Sound.rustle(); },
      // his hand at its nose: from her cover a short bark — the mother noticed; the calf
      // presses flatter and looks toward her
      wrong: async () => {
        call('ree', l.bed.x, l.bed.z);
        home.rustleGap(l, 0.12);
        await k.guard(calf.lookAt(() => ({ x: l.bed.x, z: l.bed.z, speed: 0 }), 2.2));
      },
    }),
    // …and still, while it gets up on wobbly legs and totters a step toward him, peeping:
    // is it lost? It is not (a click on it: a hand reaching to pick it up; it startles,
    // bolts and drops again). Held: it lies down again where it stands.
    oppakken: () => rust.still('oppakken', {
      line: c.opstaan ?? c.raakNiet, hands: () => calf.body,
      show: () => { void totter(); },
      tempt: () => { call('fiep', calf.x, calf.z); void calf.lookAt(me, 1.6); },
      wrong: () => bolt(true),
      right: async () => { await k.guard(calf.lie(true)); },
    }),
  };
  /** The calf gets up and totters a wobbly step toward him (beside him, never at the lens,
   *  stopping a long arm's length from his boots), peeping. */
  const totter = async (): Promise<void> => {
    call('fiep', calf.x, calf.z);
    await calf.lie(false);
    const r = k.ranger();
    const side = toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, calf).u > toLocal({ x: view.at.x, z: view.at.z, heading: view.heading }, r).u ? 1 : -1;
    const near = toward(r, calf, 1.0);
    const across = { x: near.x + Math.cos(view.heading) * 0.25 * side, z: near.z - Math.sin(view.heading) * 0.25 * side };
    const step = toward(calf, across, Math.min(0.55, Math.max(0, dist(calf, across) - 0.05)));
    if (dist(step, r) > 0.9) await calf.go(step.x, step.z, { speed: 0.3, face: headingTo(step, r) });
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
  await k.walk({
    name: 'hide', to: l.hide, r: 1.0, line: c.stil, doel: c.chipHut, cue: c.zacht, glyph: 'boot', quiet: hush,
    // (a perfect player's way: round the grass, and round the pool when it lies here)
    via: walkVia(l, 'hide', poolOut ? pool : null),
    tick: () => {
      if (poolOut) { poolOut.tick(); return; }
      if (lineBack < 0 && dist(k.ranger(), l.hide) < 4) { lineBack = 1; k.say(c.verstop); }
    },
  });
  poolOut?.done();

  // 11 · watch: the lens turns toward her cover and he watches through his binoculars; the
  // bracken at her gap stirs, and the mother steps out where she went in
  k.beat = 'watch:walk';
  await k.walkRanger(l.hide.x, l.hide.z, 0.05);
  k.beat = 'watch';
  // from the first moment of the watch he must keep STILL (a roe hears everything): a step
  // key or a tap on the world and she freezes, head up, staring at the hide ("Sta stil");
  // once he has been still a little while she goes on. Never a fail: it only makes her
  // wait. (Listening from here, before the lens turns and she walks to her bed: a key in
  // the watch's first seconds is answered like every later one.)
  const hide = { x: l.hide.x, z: l.hide.z, speed: 0 };
  let movedAt = -99;
  const startle = (): void => {
    const fresh = k.now - movedAt > 1.5;
    movedAt = k.now;
    if (!fresh) return;
    k.stats.watch_moves = (k.stats.watch_moves ?? 0) + 1;
    k.say(c.staStil);
    if (settings.geluid) Sound.rustle();
    // standing, she turns her head up to the hide; lying in her bed in her cover, the
    // bracken by her stirs (she heard it, out of sight)
    if (!doe.lies) void doe.lookAt(() => hide, 1.8);
    else home.rustleGap(l, 0.06);
  };
  const onKey = (e: KeyboardEvent): void => { if (STEP_KEYS.test(e.code)) startle(); };
  const onTap = (e: PointerEvent): void => { if (!(e.target as Element | null)?.closest?.('button')) startle(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onTap);
  /** He has been still long enough (else wait until he is, and say the watch line again). */
  const still = async (): Promise<void> => {
    if (k.now - movedAt >= STILL_S) return;
    await k.until(() => k.now - movedAt >= STILL_S, 600);
    k.say(c.wacht);
  };
  /** Her calm walk to (x, z); a startle stops her, and she walks on once he is still. */
  const walkOn = async (x: number, z: number, o: Parameters<Actor['go']>[2] = {}): Promise<void> => {
    for (;;) {
      await still();
      if (await go(doe, x, z, { speed: 'walk', ...o })) return;
      if (k.now - movedAt > 1) return; // (blocked, not startled: she stays where she is)
    }
  };
  const meet = l.meet;
  try {
    // he turns to her cover first and only then lifts his glasses (the turn never sweeps
    // the wildcamera's glade next door: every hide looks away from it)
    await k.frame(l.views.watch, { face: l.hide.heading });
    k.ui.watching(true);
    if (k.now - movedAt >= STILL_S) k.say(c.wacht); // (a step in the turn: "Sta stil" stays up)
    calf.idle();
    if (!doe.lies && dist(doe, l.bed) > 0.5) { // (a stop and a replay: she is in her bed)
      for (const s of l.slip) await walkOn(s.x, s.z, s === l.bed ? { face: l.bed.yaw } : {});
    }
    await k.wait(2.6);
    await still();
    home.rustleGap(l, 0.16);
    if (settings.geluid) Sound.rustle();
    await k.wait(1.3);
    await walkOn(l.gap.x, l.gap.z);
    k.say(c.daar);
    // in the gap she stops and tests the air; a step out, two calm bites of grass
    await k.guard(doe.lookAt(() => ({ x: meet.x, z: meet.z, speed: 0 }), 1.3));
    const bite = toward(l.gap, meet, Math.min(0.8, dist(l.gap, meet) * 0.5));
    await walkOn(bite.x, bite.z);
    doe.root(bite.x, bite.z, 0.05);
    await k.wait(2.6);
    // out onto the open heath by the tall grass; she stops and looks round (toward the
    // hide: stil!), then toward the grass where her calf lies
    await walkOn(meet.x, meet.z);
    await still();
    await k.guard(doe.lookAt(() => hide, 1.6));
    await still();
  } finally {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onTap);
  }
  const calfAtNow = { x: calf.x, z: calf.z };
  await k.guard(doe.lookAt(() => ({ x: calfAtNow.x, z: calfAtNow.z, speed: 0 }), 0.9));
  // she calls it softly; the calf gets up and comes out of the grass to her
  call('fiep', meet.x, meet.z);
  home.cover.rustle(home.cover.nearestClump(calf.x, calf.z)?.i ?? 0, 0.1);
  await k.wait(0.8);
  await k.guard(calf.lie(false));
  const to = toward(meet, calfAtNow, 0.75); // (it stops at her head: she noses it)
  await go(calf, to.x, to.z, { speed: 0.8, face: headingTo(to, meet) });
  void calf.lookAt(() => ({ x: doe.x, z: doe.z, speed: 0 }), 4);
  void doe.sniff(calf.x, calf.z, 2.8, 0.5);
  k.say(c.ruikt);
  await k.wait(2.8);

  // 12 · the path is free (the flip: now GO)
  await rust.ask('moeder', {
    // he stays too close: she lifts her head toward the hide and steps back toward her
    // cover, the calf waiting where it is
    wrong: async () => {
      await k.guard(doe.lookAt(() => ({ x: l.hide.x, z: l.hide.z, speed: 0 }), 1.1));
      const back = toward(meet, l.gap, Math.min(1.6, dist(meet, l.gap) * 0.8));
      await go(doe, back.x, back.z, { speed: 'walk', face: headingTo(back, l.hide) });
    },
    // he steps quietly back out of the hide (and turns to watch them again); she (back)
    // at her calf
    right: async () => {
      const back = dist(doe, meet) > 0.4 ? go(doe, meet.x, meet.z, { speed: 'walk', face: headingTo(meet, calf) }) : Promise.resolve(true);
      await Promise.all([k.walkRanger(l.hideLeave.x, l.hideLeave.z, 0.05), back]);
      k.world.faceRanger(l.hideLeave.heading!);
    },
  });
  rust.done();

  // 13 · the reunion: she stands side-on to the glasses; the calf goes to her flank (the
  // side he watches from) and drinks, its head under her belly
  const side = headingTo(meet, bed0);
  await go(doe, meet.x, meet.z, { speed: 'walk', face: side });
  const eye = k.world.camera.position;
  const right = { x: -Math.cos(side), z: Math.sin(side) };
  const near = (eye.x - doe.x) * right.x + (eye.z - doe.z) * right.z > 0 ? 1 : -1;
  const drink = drinkSpot({ x: doe.x, z: doe.z, yaw: side }, SIZE.ree.len, near);
  await k.reunion(async () => {
    call('fiep', calf.x, calf.z);
    await calf.go(drink.x, drink.z, { speed: 'walk', face: drink.yaw });
    doe.idle();
    await k.wait(4.8);
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
    k.say(plashes >= 2 ? (c.eromheen ?? c.stil) : c.stil);
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
