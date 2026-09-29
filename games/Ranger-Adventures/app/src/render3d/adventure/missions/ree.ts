/**
 * ree.ts — "Het reekalf in het gras" as an adventure in the world (design §4.2).
 *
 * The doe grazes at the edge of a small copse where the heath meets the forest, 18 m
 * past the empty marker ring, all along. A walker phoned in about a calf lying alone:
 * lost? After one calm look at the mother, the ranger follows her small prints to a
 * meadow of tall grass — and she lifts her head and slips into the copse. He finds the
 * spotted calf pressed flat in the grass (ZOEKEN), and leaves it be: no stroking, no
 * picking it up, no hand at its nose (RUSTKRACHT 1-3; a wrong answer makes it bolt a few
 * metres and drop again, or the mother bark from the copse). He walks away quietly to a
 * hide — running gets "Sst" — round a wet pool, not through it (RUSTKRACHT 4). From the
 * hide, through his binoculars, the doe steps out of the copse where she went in, looks
 * round, walks to her calf; it stands and she noses it. The path is free: he walks away
 * quietly (RUSTKRACHT 5, the flip) and the calf drinks. Doe and calf stay at the copse.
 *
 * Steps (content, the EF contract): 0 zoeken · 1 dagnacht, each logged once.
 */

import type { Distractor, Mission } from '../../../content/types';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Actor } from '../actors';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial, buildSpoor } from '../../../engines/zoeken';
import { spoorTrail } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { searchBeat } from '../beats/search';
import { choiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { dist, headingTo, toLocal, toward } from '../places';
import { backPoints, openWindow } from '../cover-math';
import { SIZE } from '../../AnimalScale';
import { TREE_BASE_H } from '../../world/Forest';
import { ReeHome } from './ree.home';
import {
  REE_HOME, REE_PLACES as P, REE_RESIDENTS, COPSE_TREES, CALF_SPOT, COPSE_GAP, DOE_BED, MEET, POOL, POOL_FRAME, POOL_IN, POOL_ROUND,
  SEARCH_VIEW, CALF_VIEW, POOL_VIEW, WATCH_VIEW, reeClearings, slotTrail, calfBolt, drinkSpot, leaveView,
} from './ree.places';

const MISSION = 'ree-niet-aanraken';

/** The content's zoeken decoys of this mission (the meadow shows them all until a
 *  trial keeps its own). */
function distractorsOf(m: Mission | undefined): readonly Distractor[] {
  return (m?.stappen[0]?.skin.distractors ?? []) as Distractor[];
}

let contentDecoys: readonly Distractor[] = [];

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

  /** Under the briefing card: this trial's decoys stay in the meadow, the others go. */
  prepare(world, mission) {
    const home = world.residents.dressing(MISSION) as ReeHome | null;
    if (!home) return;
    const trial = buildZoekenTrial(mission.stappen[0].skin, store.difficulty('zoeken'));
    home.useDecoys(trial.decoys.map((d) => d.id));
  },
  unprepare(world) {
    const home = world.residents.dressing(MISSION) as ReeHome | null;
    home?.useDecoys(contentDecoys.map((d) => d.id));
  },

  async play(k: AdventureKit): Promise<void> {
    await story(k);
  },
};

/** The adventure, beat by beat. */
async function story(k: AdventureKit): Promise<void> {
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
  const graze = REE_RESIDENTS.find((r) => r.key === 'doe')!.before!;

  // 0 · she is at the copse's edge (had she slipped into the copse, she steps out again)
  if (dist(doe, graze) > 0.6 || doe.lies) {
    void doe.go(graze.x, graze.z, { speed: 'walk', face: graze.yaw }).then((ok) => { if (ok) doe.root(graze.x, graze.z, 0.4); });
  } else doe.root(graze.x, graze.z, 0.4);

  // 1 · one calm look at the mother, grazing by the copse
  await k.look({ x: graze.x, z: graze.z, y: g(graze.x, graze.z) + 0.6 }, c.kijk, 2.5, { turn: true });

  // 2 · her small prints lead to the meadow; walking up, he sees her slip into the copse
  const spoor = buildSpoor(store.difficulty('zoeken'));
  const trail = slotTrail();
  k.own(spoorTrail(trail.from.x, trail.from.z, trail.to.x, trail.to.z, spoor.legs, g, 0.35 + 0.5 * spoor.helderheid, 0.34, 5).group);
  let slipping: Promise<void> | null = null;
  const slipAway = async (): Promise<void> => {
    await doe.lookAt(me, 1.4);                   // she lifts her head and looks at him
    if (k.beat === 'walk:meadow' || k.beat === 'meadow:watch') k.say(c.weg);
    if (!(await doe.go(DOE_BED.x, DOE_BED.z, { speed: 'walk', face: DOE_BED.yaw }))) return;
    await doe.lie(true);                         // she beds down in the bracken
  };
  // she notices him the moment he sets off (or comes near her)
  const setOff = { ...k.ranger() };
  await k.walk({
    name: 'meadow', to: P.meadowApproach, r: 1.4, line: c.volg, doel: c.chipGras, cue: c.sporen,
    tick: () => {
      const m = k.ranger();
      if (!slipping && (dist(m, setOff) > 1.2 || dist(m, doe) < 9)) slipping = slipAway();
    },
  });
  slipping ??= slipAway();
  // he stops at the meadow's edge and watches her go in (the search's view holds still:
  // she is out of sight before it starts)
  k.beat = 'meadow:watch';
  k.lockFollow();
  k.world.stopRanger();
  await k.until(() => doe.lies, 9);

  // 3 · find the calf in the tall grass (zoeken)
  await searchBeat(k, 0, {
    view: SEARCH_VIEW, stand: P.meadowApproach, cover: home.cover, target: calf, call: 'fiep',
    lyingH: lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf),
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: (f) => home.poke(d, f) })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  // 4 · the raaf: a calf smells of almost nothing
  await k.fact(0);

  // 5-7 · by the calf: leave it be (rustkracht 1-3)
  const rust = choiceRun(k, 1);
  k.beat = 'calf:walk';
  await k.walkRanger(P.calfTalk.x, P.calfTalk.z, 0.05);  // up to it, calmly, through the grass
  // the stems between him and it bend aside: from the close view it lies in plain sight
  // at his boots (a window in the grass for that lens, the grass round it parted)
  const lyH = lyingHeight(heightFor('reekalf'), LEG_SHARE.reekalf);
  const uncover = (at: { x: number; z: number; yaw: number }): void => {
    const lens = k.lensFor(CALF_VIEW).cam;
    const drawn = home.cover.stems.map((st) => st.h);
    const more = openWindow(home.cover.stems, lens, backPoints(at.x, g(at.x, at.z), at.z, at.yaw, SIZE.reekalf.len, lyH), 0.8);
    if (more.length) home.cover.settle(more, 1.0, drawn);
    home.cover.partAt(at.x, at.z, 0.85, 0.7, 120);
  };
  uncover(calf);
  k.beat = 'calf:frame';
  await k.frame(CALF_VIEW, { face: P.calfTalk.heading });
  // a wrong answer startles it: it jumps up, bolts a few metres to the side (never at
  // him, never at the lens) and drops flat in the grass again
  const bed0 = { x: CALF_SPOT.x, z: CALF_SPOT.z };
  const boltTo = calfBolt();
  const bolt = async (squeak: boolean): Promise<void> => {
    const there = dist(calf, bed0) < 0.5 ? boltTo : bed0;
    if (settings.geluid) Sound.rustle();
    if (squeak) call('fiep', calf.x, calf.z);
    const face = headingTo(k.ranger(), there) + Math.PI / 2;
    uncover({ ...there, yaw: face });
    await go(calf, there.x, there.z, { speed: 'trot', face });
    await k.guard(calf.lie(true));
  };
  await rust.ask('aai', { wrong: () => bolt(false) });
  await rust.ask('oppakken', {
    wrong: () => bolt(true),
    // "stil weglopen": he steps back from it, quietly, and turns to it again
    right: async () => {
      const r = k.ranger();
      const back = toward(calf, r, dist(calf, r) + 0.9);
      await k.walkRanger(back.x, back.z, 0.05);
      const turn = toward(back, calf, 0.3); // (a small step toward it: he turns round calmly)
      await k.walkRanger(turn.x, turn.z, 0.05);
      k.world.faceRanger(headingTo(k.ranger(), calf));
    },
  });
  await rust.ask('geur', {
    // his hand at its nose: from the copse a short bark — the mother noticed; the calf
    // presses flatter and looks toward her
    wrong: async () => {
      call('ree', DOE_BED.x, DOE_BED.z);
      home.cover.rustle(home.gapClump, 0.12);
      await k.guard(calf.lookAt(() => ({ x: DOE_BED.x, z: DOE_BED.z, speed: 0 }), 2.2));
    },
  });

  // 8 · he turns away from the calf and takes his first quiet steps toward the pool, the
  // lens swinging round behind him (then the way ahead is in view); then he walks on
  // himself, quietly, to the hide; a wet pool lies across the way
  k.beat = 'calf:leave';
  const r8 = k.ranger();
  const first = toward(r8, POOL, 1.4);
  const swing = k.frame(leaveView(first));
  await k.walkRanger(first.x, first.z, 0.05);
  await swing;
  k.world.faceRanger(headingTo(k.ranger(), POOL));
  const hush = { line: c.sst, onRun: (): void => { void calf.lookAt(me, 1.6); call('fiep', calf.x, calf.z); } };
  await k.walk({ name: 'pool', to: { x: POOL.x, z: POOL.z }, r: 2.0, line: c.stil, doel: c.chipHut, cue: c.zacht, quiet: hush });

  // 9 · at the pool's edge: round it, not through it (rustkracht 4)
  k.beat = 'pool:walk';
  await k.walkRanger(P.poolEdge.x, P.poolEdge.z, 0.05);
  k.beat = 'pool:frame';
  await k.frame(POOL_VIEW, { face: POOL.heading });
  await rust.ask('modder', {
    // straight through: the moment his boot is in the water a plash, rings and drops;
    // off in the grass the calf lifts its head; he steps back out
    wrong: async () => {
      const inWater = (): boolean => {
        const l = toLocal(POOL_FRAME, k.ranger());
        return (l.u / POOL.halfW) ** 2 + (l.v / POOL.halfD) ** 2 < 0.85;
      };
      const walkIn = k.walkRanger(POOL_IN.x, POOL_IN.z, 0.05);
      await k.until(inWater, 3);
      if (settings.geluid) Sound.splash();
      const r = k.ranger();
      home.splash(r.x, r.z);
      void calf.lookAt(me, 2.2);
      await walkIn;
      await k.wait(1.0);
      await k.walkRanger(P.poolEdge.x, P.poolEdge.z, 0.05);
      k.world.faceRanger(POOL.heading);
    },
    // round it, quietly, along its side
    right: async () => {
      for (const p of POOL_ROUND) await k.walkRanger(p.x, p.z, 0.12);
    },
  });

  // 10 · on to the hide, quietly
  await k.walk({ name: 'hide', to: P.hide, r: 1.0, line: c.verstop, doel: c.chipHut, cue: c.zacht, quiet: hush });

  // 11 · watch: through his binoculars the lens moves toward the meadow; the bracken at
  // the copse's gap stirs, and the mother steps out where she went in
  k.beat = 'watch:walk';
  await k.walkRanger(P.hide.x, P.hide.z, 0.05);
  k.beat = 'watch';
  k.ui.watching(true);
  await k.frame(WATCH_VIEW, { face: P.hide.heading });
  k.say(c.wacht);
  calf.idle();
  if (!doe.lies && dist(doe, DOE_BED) > 0.5) { // (a stop and a replay: she is in her bed)
    await go(doe, DOE_BED.x, DOE_BED.z, { speed: 'walk', face: DOE_BED.yaw });
  }
  await k.wait(2.6);
  home.cover.rustle(home.gapClump, 0.16);
  if (settings.geluid) Sound.rustle();
  await k.wait(1.3);
  await go(doe, COPSE_GAP.x, COPSE_GAP.z, { speed: 'walk' });
  k.say(c.daar);
  // in the gap she stops and tests the air; a step out, two calm bites of grass
  await k.guard(doe.lookAt(() => ({ x: MEET.x, z: MEET.z, speed: 0 }), 1.3));
  const bite = toward(COPSE_GAP, MEET, 0.8);
  await go(doe, bite.x, bite.z, { speed: 'walk' });
  doe.root(bite.x, bite.z, 0.05);
  await k.wait(2.6);
  // out onto the open heath by the tall grass; she stops and looks round (toward the
  // hide: stil!), then toward the grass where her calf lies
  await go(doe, MEET.x, MEET.z, { speed: 'walk' });
  await k.guard(doe.lookAt(() => ({ x: P.hide.x, z: P.hide.z, speed: 0 }), 1.6));
  const calfAt = { x: calf.x, z: calf.z };
  await k.guard(doe.lookAt(() => ({ x: calfAt.x, z: calfAt.z, speed: 0 }), 0.9));
  // she calls it softly; the calf gets up and comes out of the grass to her
  call('fiep', MEET.x, MEET.z);
  home.cover.rustle(home.cover.nearestClump(calf.x, calf.z)?.i ?? 0, 0.1);
  await k.wait(0.8);
  await k.guard(calf.lie(false));
  const to = toward(MEET, calfAt, 0.75); // (it stops at her head: she noses it)
  await go(calf, to.x, to.z, { speed: 0.8, face: headingTo(to, MEET) });
  void calf.lookAt(() => ({ x: doe.x, z: doe.z, speed: 0 }), 4);
  void doe.sniff(calf.x, calf.z, 2.8, 0.5);
  k.say(c.ruikt);
  await k.wait(2.8);

  // 12 · the path is free (the flip: now GO)
  await rust.ask('moeder', {
    // he stays too close: she lifts her head toward the hide and steps back toward the
    // copse, the calf waiting where it is
    wrong: async () => {
      await k.guard(doe.lookAt(() => ({ x: P.hide.x, z: P.hide.z, speed: 0 }), 1.1));
      const back = toward(MEET, COPSE_GAP, 1.6);
      await go(doe, back.x, back.z, { speed: 'walk', face: headingTo(back, P.hide) });
    },
    // he steps quietly back out of the hide (and turns to watch them again); she (back)
    // at her calf
    right: async () => {
      const back = dist(doe, MEET) > 0.4 ? go(doe, MEET.x, MEET.z, { speed: 'walk', face: headingTo(MEET, calf) }) : Promise.resolve(true);
      await Promise.all([k.walkRanger(P.hideLeave.x, P.hideLeave.z, 0.05), back]);
      k.world.faceRanger(P.hideLeave.heading!);
    },
  });
  rust.done();

  // 13 · the reunion: she stands side-on to the glasses; the calf goes to her flank (the
  // side he watches from) and drinks, its head under her belly
  const side = headingTo(MEET, CALF_SPOT);
  await go(doe, MEET.x, MEET.z, { speed: 'walk', face: side });
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
  k.ui.watching(false);
  // 14 · the raaf: a mother leaves her calf alone for a while; that keeps it safe
  await k.fact(1);
}
