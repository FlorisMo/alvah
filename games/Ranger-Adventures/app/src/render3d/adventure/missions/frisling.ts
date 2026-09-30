/**
 * frisling.ts — "De verdwaalde frisling" as an adventure in the world (design §4.1).
 *
 * The rotte (the sow, last year's young, three striped piglets) roots at its wallow,
 * 13 m past the empty marker ring, all along. A thin squeak you can place comes from a
 * stand of bracken across the trail, in the meadow. After one calm look at the family,
 * the ranger follows faint piglet prints ~34 m to the stand (the prints end at the stand,
 * never at the piglet; the squeak carries that far, louder as he comes), and finds him
 * lying flat in it — a glimpse of stripes between the stems (ZOEKEN). The piglet squeaks
 * right in front of him: he keeps his HANDS still (RUSTKRACHT 1, played with the body: a
 * click on the piglet is a hand reaching, and he scoots deeper), and does not carry him
 * (RUSTKRACHT 2, a card). He leads him home ~31 m at a careful walk, the family ahead
 * all the way (run, and he dives into the nearest clump beside the way), to the rooting
 * field, where he walks the group's route back over look-alike patches of turned earth,
 * the piglet sniffing each one (CORSI). On to the wallow: the yearling comes to sniff his
 * bag (RUSTKRACHT 3, a card), the sow lifts her head and looks at him: he keeps his FEET
 * still (RUSTKRACHT 4, played with the body: a step key is a step toward her piglets),
 * and the path is free (RUSTKRACHT 5, the flip card). The piglet trots to his mother;
 * she sniffs him and grunts, happy. The family of six stays at the wallow.
 *
 * Steps (content, the EF contract): 0 zoeken · 1 corsi · 2 dagnacht, each logged once.
 */

import type { Mission } from '../../../content/types';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Adventure } from '../registry';
import type { Actor } from '../actors';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial, buildSpoor } from '../../../engines/zoeken';
import { spoorTrail } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { searchBeat } from '../beats/search';
import { routeBeat } from '../beats/route';
import { choiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { atLocal, dist, headingTo, toLocal, toward, dirOf } from '../places';

/** How far the lost piglet's squeak carries while he follows it (m): from the ring
 *  across the trail to the stand, ~37 m (softly at first, louder as he comes). */
const FOLLOW_REACH = 46;
/** His careful walk while he leads the piglet home (m/s): the piglet's own calm trot,
 *  so they stay together (a brisk walk is 2.2 m/s; running is still his to choose). */
const LEAD_PACE = 1.5;
import { FrislingHome } from './frisling.home';
import {
  FRISLING_HOME, FRISLING_PLACES as P, MARKER, SEARCH_VIEW, FIELD_VIEW, FIELD_SIDE, WALLOW_VIEW,
  frislingClearings, hideClumps, clueGap, fieldSpots, SEARCH_GLIMPSE,
} from './frisling.places';
import type { Distractor } from '../../../content/types';

/** The content's zoeken decoys of this mission (the stand shows them all until a trial
 *  keeps its own). */
function distractorsOf(m: Mission | undefined): readonly Distractor[] {
  return (m?.stappen[0]?.skin.distractors ?? []) as Distractor[];
}

let contentDecoys: readonly Distractor[] = [];

export const frislingAdventure: Adventure = {
  id: 'frisling',
  home: FRISLING_HOME,
  clearings: frislingClearings(),
  dressing: (env) => new FrislingHome(env, contentDecoys),
  bind(mission) { contentDecoys = distractorsOf(mission); },

  /** Under the briefing card: this trial's decoys stay in the stand, the others go. */
  prepare(world, mission) {
    const home = world.residents.dressing('frisling') as FrislingHome | null;
    if (!home) return;
    const trial = buildZoekenTrial(mission.stappen[0].skin, store.difficulty('zoeken'));
    home.useDecoys(trial.decoys.map((d) => d.id));
  },
  unprepare(world) {
    const home = world.residents.dressing('frisling') as FrislingHome | null;
    home?.useDecoys(contentDecoys.map((d) => d.id));
  },

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as FrislingHome;
    home.holdClue = true; // the clue waits for its moment: after the reunion, under the raaf's card
    try {
      await story(k, fam, home);
    } finally {
      home.holdClue = false; // (stopped: the home shows what its state says)
    }
  },
};

/** The adventure, beat by beat. */
async function story(k: AdventureKit, fam: ReturnType<AdventureKit['borrow']>, home: FrislingHome): Promise<void> {
  const c = k.copy;
  const A = fam.actors as Record<'sow' | 'yearling' | 'p1' | 'p2' | 'p3' | 'lost', Actor>;
  const lost = A.lost;
  const settings = store.get().settings;
  const listener = (): { x: number; z: number; yaw: number } => listenerOf(k.world.camera);
  const call = (id: string, a: Actor): void => { if (settings.geluid) Sound.callAt(id, a.x, a.z, listener()); };
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  const hides = [...hideClumps(), ...home.cover.clumps.filter((q) => q.kind !== 'dead')].map((q) => ({ x: q.x, z: q.z }));
  const lead = {
    // (at his left side, a little back: in the picture beside his legs as they walk)
    actor: lost, gap: 0.4, side: -0.8, hide: hides,
    runLine: c.nietRennen, backLine: c.terugKomen, waitLine: c.wacht, pace: LEAD_PACE,
    onHide: (s: { x: number; z: number }): void => {
      call('piep', lost);
      const cl = home.cover.nearestClump(s.x, s.z);
      if (cl && cl.d < 1.2) window.setTimeout(() => home.cover.rustle(cl.i, 0.14), 700);
    },
    onOut: (): void => call('piep', lost),
  };
  fam.voice('lost', false);
  /** How many patches of the rooting field would lie right in front of a framed lens (a
   *  view at the wallow is taken from the side where none clutters the picture). */
  const fieldClutter = (f: FrameSpec): number => {
    const { cam, look } = k.lensFor(f);
    const fx = look.x - cam.x, fz = look.z - cam.z;
    return fieldSpots().filter((q) => (q.x - cam.x) * fx + (q.z - cam.z) * fz > 0 && Math.hypot(q.x - cam.x, q.z - cam.z) < 5).length;
  };

  // 1 · one calm look at the family, rooting at its wallow
  await k.look({ x: P.wallow.x, z: P.wallow.z }, c.kijk);

  // 2 · follow the squeak: faint trotter prints from the ring over the trail into the
  // meadow, to the stand's edge (a print every metre or so however long the way); the
  // squeak carries across, softly at first
  const spoor = buildSpoor(store.difficulty('zoeken'));
  const from = toward(MARKER, P.coverApproach, 0.9);
  const end = toward(P.coverApproach, P.cover, 0.6);
  const perLeg = Math.max(5, Math.round(dist(from, end) / (spoor.legs * 1.1)));
  k.own(spoorTrail(from.x, from.z, end.x, end.z, spoor.legs, k.ctx.groundY, 0.35 + 0.5 * spoor.helderheid, 0.42, perLeg).group);
  fam.voice('lost', true, FOLLOW_REACH);
  await k.walk({ name: 'cover', to: P.coverApproach, r: 1.5, line: c.volg, doel: c.chipPiep, cue: c.luister });
  fam.voice('lost', false);

  // 3 · find him (zoeken)
  await searchBeat(k, 0, {
    view: SEARCH_VIEW, stand: P.coverApproach, cover: home.cover, target: lost, call: 'piep',
    lyingH: lyingHeight(heightFor('frisling'), LEG_SHARE.frisling), glimpse: SEARCH_GLIMPSE,
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: (f) => home.poke(d, f) })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  // 4 · the raaf: stripes
  await k.fact(0);

  // 5 · where he lies, pressed flat in the parted bracken, squeaking right in front of
  // him: HANDS STILL (rustkracht, played with the body — a click on him is a hand reaching)
  const rust = choiceRun(k, 2);
  home.cover.partAt(lost.x, lost.z, 0.95, 0.72, 40);
  const lay = { x: lost.x, z: lost.z };
  const deeper = (n: number): { x: number; z: number } => // (never further than one scoot)
    atLocal({ ...lay, heading: headingTo(k.ranger(), lay) }, n % 2 ? -0.15 : 0.15, 0.5);
  if (!lost.body) throw new Error('[frisling] the lost piglet has no body');
  if (!lost.lies) void lost.lie(true); // (pressed flat where he was found: he gets up only once calm)
  k.beat = 'aaien:frame';
  await k.frame({
    at: toward(lay, deeper(0), 0.25), heading: SEARCH_VIEW.heading, halfW: 1.0, halfD: 0.95, tall: 0.55, pitchDeg: 46,
    insetTop: 130, insetBottom: 70,
  });
  let reaches = 0;
  await rust.still('aaien', {
    line: c.raakNiet, mis: c.schrok, hands: () => lost.body,
    // he lies squeaking; a moment in, he peeks at him and squeaks again (the hand wants to go)
    show: () => call('piep', lost),
    tempt: () => { call('piep', lost); void lost.lookAt(me, 1.6); },
    // a hand reaches for him: he scoots deeper into the bracken, lies flat, peeks out
    wrong: async () => {
      call('piep', lost);
      const to = deeper(reaches++);
      await lost.go(to.x, to.z, { speed: 'trot' });
      await lost.lie(true);
      await k.wait(0.9);
      // he peeks out: the fronds over his head part again (the moment comes back, he in it)
      home.cover.partAt(to.x, to.z, 0.8, 0.7, 40);
      await lost.lookAt(me, 1.2);
    },
  });
  // 6 · he gets up, tired, and comes out to him: don't carry him
  await lost.lie(false);
  // he comes all the way out of the bracken, to the ranger's side (away from the way
  // home: walking on, the ranger leads and the piglet follows, never walks into him)
  const r1 = k.ranger();
  const facing = { x: r1.x, z: r1.z, heading: headingTo(r1, P.cover) };
  const pigSide = toLocal(facing, P.field).u >= 0 ? -1 : 1;
  const edge = atLocal(facing, 1.15 * pigSide, 0.15);
  await lost.go(edge.x, edge.z, { speed: 'walk', face: headingTo(edge, r1) });
  void lost.lookAt(me, 3);
  k.beat = 'dragen:frame';
  await k.frame({ // the two of them side by side, the stand behind: he faces the piglet
    at: { x: (r1.x + edge.x) / 2, z: (r1.z + edge.z) / 2 }, heading: facing.heading - 0.35 * pigSide, halfW: 1.1, halfD: 0.6, tall: 1.3,
    pitchDeg: 22, insetTop: 40, insetBottom: 300, include: [{ x: r1.x, z: r1.z, h: 1.32 }, { x: edge.x, z: edge.z, h: 0.3 }],
  }, { face: headingTo(r1, edge) });
  await rust.ask('dragen', {
    // picked up: a squeal, he trots off, stops, and comes back to him
    wrong: async () => {
      call('piep', lost);
      const away = toward(k.ranger(), lost, dist(k.ranger(), lost) + 2.2);
      await lost.go(away.x, away.z, { speed: 'trot' });
      await k.wait(0.7);
      const near = toward(k.ranger(), lost, 1.5);
      await lost.go(near.x, near.z, { speed: 'walk', face: headingTo(near, k.ranger()) });
    },
  });

  // 7 · lead him home to the rooting field, calmly: ~31 m, his family ahead all the way
  await k.walk({ name: 'field', to: P.fieldApproach, r: 1.0, line: c.leid, doel: c.chipWroet, glyph: 'boot', lead });
  k.say(c.routeKijk); // (the route's own words from here, never the walk's)

  // 8 · the group's route over the field (corsi): the piglet comes to his left side, the
  // two of them in the picture, looking over the field
  void lost.go(FIELD_SIDE.x, FIELD_SIDE.z, { speed: 1.2, face: headingTo(FIELD_SIDE, P.field) });
  await routeBeat(k, 1, {
    view: FIELD_VIEW, stand: P.fieldApproach, field: home.field, walker: lost,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[1].skin.copy?.goed ?? c.routeWijs },
  });
  // 9 · the raaf: a nose that finds the way
  await k.fact(1);

  // 10 · on to the wallow, the piglet at his heels
  await k.walk({ name: 'wallow', to: P.wallowTalk, r: 1.5, line: c.breng, doel: c.chipModder, glyph: 'boot', lead });

  // 11 · the yearling comes to sniff his bag
  k.beat = 'wallow:frame';
  const talk = k.ranger();
  const toWallow = headingTo(talk, P.wallow);
  const side = atLocal({ x: talk.x, z: talk.z, heading: toWallow }, 1.3, 0.55); // beside him, never at the lens
  await k.frame({
    ...WALLOW_VIEW, at: toward(talk, P.wallow, 2.2), heading: toWallow - 0.32,
    include: [{ x: talk.x, z: talk.z, h: 1.32 }, { x: side.x, z: side.z, h: 0.62 }],
  }, { face: toWallow });
  // the piglet stands at his left, watching his family (not between him and the lens)
  const left = atLocal({ x: talk.x, z: talk.z, heading: toWallow }, -1.1, 0.35);
  void lost.go(left.x, left.z, { speed: 'walk', face: headingTo(left, P.wallow) });
  const yearling = A.yearling;
  const yHome = { x: yearling.x, z: yearling.z };
  const r0 = k.ranger();
  k.say(c.komt);
  k.beat = 'wallow:yearling';
  await yearling.go(side.x, side.z, { speed: 1.1, face: headingTo(side, r0) });
  void yearling.sniff(r0.x, r0.z, 30, 1.25); // at his bag, never closer than 1.2 m
  await rust.ask('voeren', {
    // a biscuit: he wants more — he wriggles a little closer (never under 1.2 m), eager
    wrong: async () => {
      call('knor-blij', yearling);
      const r = k.ranger();
      const closer = toward(r, yearling, Math.max(1.22, dist(r, yearling) - 0.15));
      await yearling.go(closer.x, closer.z, { speed: 'walk', face: headingTo(closer, r) });
      await yearling.sniff(r.x, r.z, 1.4, 1.22);
    },
    // no food: he trots back to his family and roots again
    right: async () => { await yearling.go(yHome.x, yHome.z, { speed: 'trot' }); yearling.root(yHome.x, yHome.z, 1.1); },
  });

  // 12 · the sow lifts her head and looks at him: FEET STILL (rustkracht, played with the
  // body — a step key or a tap on the world is a step toward her piglets)
  const sow = A.sow;
  const sowHome = { x: sow.x, z: sow.z };
  // (no card now: the lens comes a little closer, to her and her piglets, him at the side)
  k.beat = 'zeug:frame';
  const zt = k.ranger();
  const zh = headingTo(zt, sowHome);
  const zeugView = (s: number): FrameSpec => ({
    at: toward(sowHome, zt, 1.0), heading: zh + 0.22 * s,
    halfW: 1.15, halfD: 0.9, tall: 0.95, pitchDeg: 16, insetTop: 110, insetBottom: 36,
    include: [{ x: zt.x, z: zt.z, h: 1.32, r: 0.4 }], // (his shoulders both: never cut by the edge)
  });
  await k.frame(zeugView(fieldClutter(zeugView(-1)) <= fieldClutter(zeugView(1)) ? -1 : 1));
  await rust.still('zeug', {
    line: c.staStil, feet: true,
    show: () => { void sow.lookAt(me); call('wildzwijn', sow); },
    // a piglet squeaks by her side (the step toward them wants to go); she keeps watching
    tempt: () => { call('piep', A.p2); void sow.lookAt(me); },
    // a step toward her piglets: a firm grunt, she steps between (sideways, never at the lens)
    wrong: async () => {
      call('wildzwijn', sow);
      const r = k.ranger();
      const mid = toward(sowHome, { x: (r.x + P.wallow.x) / 2, z: (r.z + P.wallow.z) / 2 }, 0.7);
      await sow.go(mid.x, mid.z, { speed: 'walk', face: headingTo(mid, r) });
      await k.wait(0.6);
      void sow.lookAt(me);
    },
    // he stood still: she lowers her head and roots on
    right: async () => { await sow.go(sowHome.x, sowHome.z, { speed: 'walk' }); sow.root(sowHome.x, sowHome.z, 0.6); },
  });

  // 13 · the path is free (the flip: now GO)
  const family = [A.sow, A.p1, A.p2, A.p3, A.yearling];
  await rust.ask('pad', {
    // he waits too long: the group shuffles on a little, then roots again
    wrong: async () => {
      const away = dirOf(headingTo(k.ranger(), P.wallow));
      await Promise.all(family.map((a) => a.go(a.x + away.x * 1.1, a.z + away.z * 1.1, { speed: 'walk' })));
      for (const a of family) a.root(a.x, a.z, 0.4);
    },
    // he walks on a few calm steps along the way, past the wallow: room for the family
    right: async () => {
      lost.idle();
      await k.walkRanger(P.wallowGive.x, P.wallowGive.z, 0.1);
      k.world.faceRanger(headingTo(k.ranger(), P.wallow));
    },
  });
  rust.done();

  // the reunion, one framed shot, close: the sow and her piglets fill the middle (the
  // sniff reads), the ranger at the side in front, the line over the sky
  k.beat = 'reunion:frame';
  const rr = k.ranger();
  const sowAt = { x: A.sow.x, z: A.sow.z };
  const reunionView = (s: number): FrameSpec => ({
    at: toward(sowAt, rr, 0.5), heading: headingTo(rr, sowAt) + 0.45 * s,
    halfW: 1.05, halfD: 0.85, tall: 0.85, pitchDeg: 15, insetTop: 170, insetBottom: 20,
    include: [{ x: rr.x, z: rr.z, h: 1.32, r: 0.4 }],
  });
  await k.frame(reunionView(fieldClutter(reunionView(-1)) < fieldClutter(reunionView(1)) ? -1 : 1));

  // 14 · the reunion at the wallow: he trots to his mother, she sniffs him, happy grunts
  const after = FRISLING_HOME.residents.find((r) => r.key === 'lost')!.after!;
  await k.reunion(async () => {
    call('piep', lost);
    void sow.lookAt(() => ({ x: lost.x, z: lost.z, speed: 0 }));
    await lost.go(after.x, after.z, { speed: 'trot', face: headingTo(after, sow) });
    void sow.sniff(lost.x, lost.z, 2.6);
    call('knor-blij', sow);
    // his brothers and sisters come to sniff him too
    for (const p of [A.p1, A.p2, A.p3]) {
      const spot = toward(lost, p, 0.65);
      void p.go(spot.x, spot.z, { speed: 'trot', face: headingTo(spot, lost) });
    }
    await k.wait(2.6);
    void lost.sniff(sow.x, sow.z, 2);
    await k.wait(1.4);
  });
  k.stats.reunion_gap = Math.round(dist(lost, sow) * 100) / 100;
  // a calm beat with the family together before the raaf's card comes over them
  await k.wait(1.4);
  // 15 · the raaf: a group of pigs (after the reunion, before the reward); under its
  // card the clue drops: the cut fence past the wallow fades in
  home.revealClue();
  await k.fact(2);
  // 16 · one calm look at it (the clue card names it next, with the reward)
  const gap = clueGap();
  await k.look({ x: gap.x, z: gap.z, y: k.ctx.groundY(gap.x, gap.z) + 0.1 }, c.hek);
}
