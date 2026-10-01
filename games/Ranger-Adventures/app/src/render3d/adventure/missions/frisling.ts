/**
 * frisling.ts — "De verdwaalde frisling" as an adventure in the world (design §4.1, run 7
 * frisling §2, §5).
 *
 * The rotte (the sow, last year's young, three striped piglets) lives at its wallow, 13 m
 * past the empty marker ring. A thin squeak you can place comes from one of THREE WAYS
 * this play (frisling.vary.ts, from the play's seed, never the same way twice in a row):
 * north across the trail into the meadow (wei), south past the family and the big stone
 * to the forest edge (steen), north-east to a lone birch in the meadow (berk). After one
 * calm look at the family the ranger turns the way the squeak comes from and follows
 * small trotter prints (crisp at the ring, fainter on) to that way's stand, and finds the
 * piglet lying flat in one of its nooks — a glimpse of stripes between the stems, never in
 * the middle of the picture (ZOEKEN). He keeps his HANDS still while the piglet squeaks in
 * front of him (RUSTKRACHT, with the body). On the way home the calm moments come in a
 * drawn order at their stations (the dagnacht trial's rustPlan, the same order on the 2D
 * floor): at the stand and at the rooting field the tired piglet (carry him?) and a hungry
 * one at his bag (the piglet himself, or the yearling trotting out to the field); at the
 * mud the sow's stare (FEET still) and the free path (the flip), either first. He leads the
 * piglet home at a careful walk, the family ahead (run, and he dives into a clump beside
 * the way), and at the rooting field walks the group's route back (CORSI). The piglet
 * trots to his mother; she sniffs him and grunts, happy. The family stays at the wallow.
 *
 * Steps (content, the EF contract): 0 zoeken · 1 corsi · 2 dagnacht, each logged once.
 */

import type { Mission, Distractor } from '../../../content/types';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Adventure } from '../registry';
import type { Actor } from '../actors';
import type { Encounter } from '../../../engines/dagnacht';
import type { ResidentPose } from '../types';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial } from '../../../engines/zoeken';
import { spoorPath } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { TREE_BASE_H } from '../../world/Forest';
import { searchBeat } from '../beats/search';
import { routeBeat } from '../beats/route';
import { choiceRun, type ChoiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { atLocal, dist, headingTo, toLocal, toward, dirOf } from '../places';
import { FrislingHome } from './frisling.home';
import {
  FRISLING_HOME, FRISLING_PLACES as P, WAYS, WAY_IDS, DEFAULT_WAY, FAMILY_LAYOUTS,
  frislingClearings, clueGap, fieldSpotsOf, nookAt, useWay, type Way, type WayId,
} from './frisling.places';
import { frislingVariant, lastWayOf, recentFams, recentWays, type FrislingVariant } from './frisling.vary';
import { playDagnachtTrial } from '../../../engines/dagnacht';

/** How far the lost piglet's squeak carries while he follows it (m): from the ring to
 *  any way's stand, ~35-38 m (softly at first, louder as he comes). */
const FOLLOW_REACH = 46;
/** His careful walk while he leads the piglet home (m/s): the piglet's own calm trot,
 *  so they stay together (a brisk walk is 2.2 m/s; running is still his to choose). */
const LEAD_PACE = 1.5;
/** The first prints from the ring: crisp, so where the trail starts reads at once. */
const CRISP_PRINTS = 4;
/** On `steen` the follow passes the family: within this of the sow she lifts her head. */
const SOW_NOTICE_M = 5;

/** The content's zoeken decoys of this mission (the stands show them in free roam). */
function distractorsOf(m: Mission | undefined): readonly Distractor[] {
  return (m?.stappen[0]?.skin.distractors ?? []) as Distractor[];
}

let contentDecoys: readonly Distractor[] = [];
/** This play's frisling (laid under the briefing card). */
let current: FrislingVariant | null = null;
/** The plays he set out on in this page session (their seed, way and family layout): a
 *  play stopped early may have left no beat in the history. */
const started: { sd: number; way: WayId; fam: string }[] = [];

/** The young birches the home plants at its stands (real forest trees). */
const BIRCHES = WAY_IDS.flatMap((id) => WAYS[id].trees.map((t) => ({
  x: t.x, z: t.z, s: t.h / TREE_BASE_H['prop-birch-tree'], rotY: t.rotY, species: 'prop-birch-tree' as const,
})));

const homeOf = (world: { residents: { dressing(id: string): unknown } }): FrislingHome | null =>
  world.residents.dressing('frisling') as FrislingHome | null;

export const frislingAdventure: Adventure = {
  id: 'frisling',
  home: FRISLING_HOME,
  clearings: frislingClearings(),
  trees: BIRCHES,
  dressing: (env) => new FrislingHome(env, contentDecoys),
  bind(mission) { contentDecoys = distractorsOf(mission); },
  // run 7 (design foundation §4.5, frisling §5.10): every play in its own light — but a
  // save's first frisling (no play started yet) stands in the session's light, so his very
  // first time looks like the world he just walked through
  get moods() { return (store.get().gespeeld.frisling ?? 0) > 0 ? { perPlay: true } : undefined; },

  /** Under the briefing card: this play's way, the nook he lies in, the look-alikes, the
   *  family's layout at the mud (frisling.vary.ts, from the play's seed). */
  prepare(world, mission, play) {
    const home = homeOf(world);
    if (!home) return;
    const trial = buildZoekenTrial(mission.stappen[0].skin, store.difficulty('zoeken'));
    const history = store.get().geschiedenis;
    const v = frislingVariant(play, recentWays(history, started), trial.decoys.map((d) => ({ k: d.k, animal: d.animal })), recentFams(history, started));
    current = v;
    // the order the calm moments will come in (the very trial the script builds later):
    // noted now, before the light's note, so the history always says what he played
    playDagnachtTrial(mission.stappen[2].skin, store.difficulty('dagnacht'), play, history);
    home.lay(v.way, { nook: v.nook, pose: v.pose, trial: trial.decoys, spots: v.decoySpots, glimpse: store.knobs('zoeken').glimpse });
    useWay(v.way);
    const lie = nookAt(v.way, v.nook, v.pose);
    const fam = FAMILY_LAYOUTS[v.family].poses;
    world.residents.layout('frisling', {
      lost: { before: { x: lie.x, z: lie.z, yaw: lie.yaw, idle: 'lie', roam: 0 } },
      sow: { before: fam.sow }, yearling: { before: fam.yearling }, p1: { before: fam.p1 }, p2: { before: fam.p2 }, p3: { before: fam.p3 },
    }, (key) => key !== 'lost'); // (the family walks to its places; the lost one lies far off in his stand)
  },
  unprepare(world) {
    current = null;
    homeOf(world)?.layDefault(store.knobs('zoeken').glimpse);
    useWay(DEFAULT_WAY);
    world.residents.layout('frisling', null, (key) => key !== 'lost');
  },

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as FrislingHome;
    const v = current ?? fallbackVariant(k);
    started.push({ sd: k.play.seed, way: v.way, fam: FAMILY_LAYOUTS[v.family].id });
    home.holdClue = true; // the clue waits for its moment: after the reunion, under the raaf's card
    try {
      await story(k, fam, home, v);
    } finally {
      home.holdClue = false; // (stopped: the home shows what its state says)
      current = null;
      // the family and the lost one go back to their own places on release (a calm walk;
      // a lost one stopped in a far stand is put back in his own nook out of sight), and the
      // home is free roam's again: run 6's stand with its look-alikes, the prints north
      k.world.residents.layout('frisling', null);
      home.layDefault(store.knobs('zoeken').glimpse);
      useWay(DEFAULT_WAY);
    }
  },
};

/** A play laid without a briefing (a test, a dev start): drawn now from the kit's play. */
function fallbackVariant(k: AdventureKit): FrislingVariant {
  const v = frislingVariant(k.play, lastWayOf(store.get().geschiedenis), []);
  return { ...v, way: DEFAULT_WAY, nook: 0, pose: 0 };
}

/** The adventure, beat by beat. */
async function story(k: AdventureKit, fam: ReturnType<AdventureKit['borrow']>, home: FrislingHome, v: FrislingVariant): Promise<void> {
  const c = k.copy;
  const way = WAYS[v.way];
  const A = fam.actors as Record<'sow' | 'yearling' | 'p1' | 'p2' | 'p3' | 'lost', Actor>;
  const lost = A.lost;
  const layout = FAMILY_LAYOUTS[v.family].poses;
  const settings = store.get().settings;
  const listener = (): { x: number; z: number; yaw: number } => listenerOf(k.world.camera);
  const call = (id: string, a: Actor): void => { if (settings.geluid) Sound.callAt(id, a.x, a.z, listener()); };
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  /** After a framed moment (he faced the animal at his side) he turns for `to` and takes a
   *  first calm step that way, and the lens comes round behind him facing the way he goes. */
  const setOff = async (to: { x: number; z: number }): Promise<void> => {
    const r = k.ranger();
    if (dist(r, to) < 2.5) return;
    const step = toward(r, to, 0.8);
    await k.walkRanger(step.x, step.z, 0.1);
    await k.behind();
  };
  /** an animal back at its place in this play's layout, doing what it does there */
  const atHome = (a: Actor, pose: ResidentPose): void => { if (pose.idle === 'stand') a.idle(); else a.root(pose.x, pose.z, pose.roam ?? 0.5); };
  const lead = {
    // (at his left side, a little back: in the picture beside his legs as they walk —
    // never in the line from the lens to him, or the lens would keep side-stepping it)
    actor: lost, gap: 0.4, side: -1.15, hide: home.hideSpots(),
    runLine: c.nietRennen, backLine: c.terugKomen, waitLine: c.wacht, pace: LEAD_PACE,
    onHide: (s: { x: number; z: number }): void => {
      call('piep', lost);
      window.setTimeout(() => home.rustleNear(s.x, s.z, 0.14), 700);
    },
    onOut: (): void => call('piep', lost),
  };
  fam.voice('lost', false);
  const spots = fieldSpotsOf(way.field);
  /** How many patches of the rooting field would lie right in front of a framed lens (a
   *  view at the wallow is taken from the side where none clutters the picture). */
  const fieldClutter = (f: FrameSpec): number => {
    const { cam, look } = k.lensFor(f);
    const fx = look.x - cam.x, fz = look.z - cam.z;
    return spots.filter((q) => (q.x - cam.x) * fx + (q.z - cam.z) * fz > 0 && Math.hypot(q.x - cam.x, q.z - cam.z) < 5).length;
  };

  // 1 · one calm look at the family at its wallow; he ends facing the way the squeak
  // comes from (the lens comes round behind him that way)
  const r0 = k.ranger();
  await k.look({ x: P.wallow.x, z: P.wallow.z }, c.kijk, 2.5, { face: headingTo(r0, way.follow[1]) });

  // 2 · follow the squeak: small trotter prints from the ring along the way, crisp at the
  // start, to the stand's edge (never to the piglet); the squeak carries across, softly
  const knobs = k.knobs('zoeken');
  // (a little over a piglet's true trotter, 7 cm, so the trail reads from the follow lens
  // 5-6 m off: at true size the first prints were specks of 6-8 px, run 7 played)
  // (from just ahead of him and a step to his left — wherever by the ring he set out —
  // joining the way: the first, crisp prints lie beside his feet in the picture, never
  // hidden behind his own back from the lens behind him, nor off by the ring where he
  // does not look)
  const off = k.ranger();
  const trail = [atLocal({ x: off.x, z: off.z, heading: headingTo(off, way.follow[1]) }, -0.75, 0.9), ...way.follow.slice(1)];
  k.own(spoorPath(trail, k.ctx.groundY, { opacity: 0.35 + 0.5 * knobs.trailClarity, size: 0.62, spacing: 0.95, crisp: CRISP_PRINTS }).group);
  fam.voice('lost', true, FOLLOW_REACH);
  await k.walk({
    name: 'cover', to: way.coverApproach, r: 1.5, line: v.way === 'steen' ? c.boog : c.volg, doel: c.chipPiep, cue: c.luister,
    via: way.follow.slice(1, -1), tick: v.way === 'steen' ? walkRound(k, A.sow, layout.sow, call) : undefined,
  });
  fam.voice('lost', false);

  // 3 · find him (zoeken): the knobs' glimpse of his back, never more than 1.5× it
  await searchBeat(k, 0, {
    view: way.searchView, stand: way.coverApproach, cover: home.cover, target: lost, call: 'piep',
    lyingH: lyingHeight(heightFor('frisling'), LEG_SHARE.frisling), glimpse: knobs.glimpse, glimpseMax: knobs.glimpse * 1.5,
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: (f) => home.poke(d, f) })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  // 4 · the raaf: stripes
  await k.fact(0);

  // 5 · where he lies, pressed flat in the parted bracken, squeaking right in front of
  // him: HANDS STILL (rustkracht 'big', played with the body — a click on him is a hand reaching)
  const rust = choiceRun(k, 2);
  home.cover.partAt(lost.x, lost.z, 0.95, 0.72, 40);
  const lay = { x: lost.x, z: lost.z };
  const deeper = (n: number): { x: number; z: number } => // (never further than one scoot)
    atLocal({ ...lay, heading: headingTo(k.ranger(), lay) }, n % 2 ? -0.15 : 0.15, 0.5);
  if (!lost.body) throw new Error('[frisling] the lost piglet has no body');
  if (!lost.lies) void lost.lie(true); // (pressed flat where he was found: he gets up only once calm)
  for (let e = rust.nextIn('big'); e; e = rust.nextIn('big')) {
    k.beat = 'aaien:frame';
    await k.frame({
      at: toward(lay, deeper(0), 0.25), heading: way.searchView.heading, halfW: 1.0, halfD: 0.95, tall: 0.55, pitchDeg: 46,
      insetTop: 130, insetBottom: 70,
    });
    let reaches = 0;
    await rust.still(e.id, {
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
  }

  // 6 · he gets up, tired, and comes out to him, to his side (away from the way home:
  // walking on, the ranger leads and the piglet follows, never walks into him)
  await lost.lie(false);
  const r1 = k.ranger();
  const facing = { x: r1.x, z: r1.z, heading: headingTo(r1, P.cover) };
  const pigSide = toLocal(facing, way.fieldApproach).u >= 0 ? -1 : 1;
  const edge = atLocal(facing, 1.15 * pigSide, 0.15);
  await lost.go(edge.x, edge.z, { speed: 'walk', face: headingTo(edge, r1) });
  void lost.lookAt(me, 3);
  // the first calm moment on the way home, here at the stand (s1)
  const s1 = rust.nextIn('weg');
  if (s1) await weg(s1, 'stand');

  // 7 · lead him home to the rooting field, calmly, his family ahead all the way
  await setOff(way.fieldApproach);
  await k.walk({ name: 'field', to: way.fieldApproach, r: 1.0, line: c.leid, doel: c.chipWroet, glyph: 'boot', lead });
  k.say(c.routeKijk); // (the route's own words from here, never the walk's)

  // 8 · the group's route over the field (corsi): the piglet comes to his left side, the
  // two of them in the picture, looking over the field
  void lost.go(way.fieldSide.x, way.fieldSide.z, { speed: 1.2, face: headingTo(way.fieldSide, P.field) });
  await routeBeat(k, 1, {
    view: way.fieldView, stand: way.fieldApproach, field: home.field, walker: lost,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[1].skin.copy?.goed ?? c.routeWijs },
  });
  // 9 · the raaf: a nose that finds the way
  await k.fact(1);
  // the second calm moment on the way home, at the field (s2)
  const s2 = rust.nextIn('weg');
  if (s2) await weg(s2, 'field');

  // 10 · on to the wallow, the piglet at his heels
  await setOff(way.toWallow[0] ?? way.wallowTalk);
  await k.walk({ name: 'wallow', to: way.wallowTalk, r: 1.5, line: c.breng, doel: c.chipModder, glyph: 'boot', lead, via: way.toWallow });

  // 11 · at the mud (s3): the sow's stare and the free path, in the drawn order
  const talk = k.ranger();
  const toWallow = headingTo(talk, P.wallow);
  // the piglet stands at his left, watching his family (not between him and the lens)
  const left = atLocal({ x: talk.x, z: talk.z, heading: toWallow }, -1.1, 0.35);
  void lost.go(left.x, left.z, { speed: 'walk', face: headingTo(left, P.wallow) });
  k.beat = 'wallow:frame';
  await k.frame({ ...way.wallowView, include: [{ x: talk.x, z: talk.z, h: 1.32 }, { x: left.x, z: left.z, h: 0.45 }] }, { face: toWallow });
  for (let e = rust.nextIn('thuis'); e; e = rust.nextIn('thuis')) {
    if (e.id === 'zeug') await zeug(e);
    else await pad(e);
  }
  rust.done();

  // the reunion, one framed shot, close: the sow and her piglets fill the middle (the
  // sniff reads), the ranger at the side in front, the line over the sky
  k.beat = 'reunion:frame';
  const rr = k.ranger();
  const sow = A.sow;
  const sowAt = { x: sow.x, z: sow.z };
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

  /* ---------------------------------------------------- the calm moments ---- */

  /** A calm moment on the way home ('weg'): at the stand (s1) or at the field (s2). */
  async function weg(e: Encounter, at: 'stand' | 'field'): Promise<void> {
    if (e.id === 'dragen') await dragen(rust, at === 'stand' ? P.cover : P.field);
    else if (e.id === 'voeren') await (at === 'stand' ? voerenPiglet(rust) : voerenYearling(rust));
    else throw new Error(`[frisling] no station for "${e.id}" on the way`);
  }

  /** 'dragen': he is tired — carry him, or walk with him? (a card) The two of them side by
   *  side, what he looked at (the stand, the field) behind; he turns to the piglet. */
  async function dragen(run: ChoiceRun, looked: { x: number; z: number }): Promise<void> {
    const r = k.ranger();
    const pig = { x: lost.x, z: lost.z };
    const facingH = headingTo(r, looked);
    const side = toLocal({ x: r.x, z: r.z, heading: facingH }, pig).u >= 0 ? 1 : -1;
    k.beat = 'dragen:frame';
    await k.frame({
      at: { x: (r.x + pig.x) / 2, z: (r.z + pig.z) / 2 }, heading: facingH - 0.35 * side,
      halfW: 1.1, halfD: 0.6, tall: 1.3, pitchDeg: 22, insetTop: 40, insetBottom: 300,
      include: [{ x: r.x, z: r.z, h: 1.32 }, { x: pig.x, z: pig.z, h: 0.3 }],
    }, { face: headingTo(r, pig) });
    await run.ask('dragen', {
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
  }

  /** 'voeren' at the stand: the lost piglet himself sniffs his bag, hungry (a card). */
  async function voerenPiglet(run: ChoiceRun): Promise<void> {
    const r = k.ranger();
    k.beat = 'voeren:frame';
    await k.frame({
      at: { x: (r.x + lost.x) / 2, z: (r.z + lost.z) / 2 }, heading: headingTo(r, lost) - 0.35,
      halfW: 1.1, halfD: 0.6, tall: 1.3, pitchDeg: 22, insetTop: 40, insetBottom: 300,
      include: [{ x: r.x, z: r.z, h: 1.32 }, { x: lost.x, z: lost.z, h: 0.3 }],
    });
    void lost.sniff(r.x, r.z, 30, 0.5); // (his snout at the bag on his hip)
    call('piep', lost);
    await run.ask('voeren', {
      vraag: settings.jargon ? c.voerenBig : undefined,
      // a crumb: he wants more — he wriggles closer still, eager, and squeaks for it
      wrong: async () => {
        call('piep', lost);
        const rr = k.ranger();
        await lost.sniff(rr.x, rr.z, 1.4, 0.35);
      },
      // no food: he gives up on the bag and stands by him, ready to go
      right: async () => { lost.idle(); void lost.lookAt(me, 1.5); },
    });
  }

  /** 'voeren' at the field: the yearling trots out from the wallow and noses his bag (a card). */
  async function voerenYearling(run: ChoiceRun): Promise<void> {
    const yearling = A.yearling;
    const yHome = layout.yearling;
    const r = k.ranger();
    const from = { x: yearling.x, z: yearling.z };
    const toY = headingTo(r, from);
    const side = atLocal({ x: r.x, z: r.z, heading: toY }, 1.3, 0.75); // beside him, never at the lens
    k.beat = 'voeren:frame';
    await k.frame({
      at: toward(r, from, 2.4), heading: toY - 0.32, halfW: 2.6, halfD: 2.3, tall: 0.95, pitchDeg: 28, insetTop: 96, insetBottom: 290,
      include: [{ x: r.x, z: r.z, h: 1.32 }, { x: side.x, z: side.z, h: 0.62 }],
    }, { face: toY });
    k.say(c.komt);
    k.beat = 'field:yearling';
    // (round the fence's end and the big stone when the field lies south)
    for (const p of yearlingWay(way, from, side)) await yearling.go(p.x, p.z, { speed: 1.1 });
    await yearling.go(side.x, side.z, { speed: 1.1, face: headingTo(side, r) });
    void yearling.sniff(r.x, r.z, 30, 1.25); // at his bag, never closer than 1.2 m
    await run.ask('voeren', {
      // a biscuit: he wants more — he wriggles a little closer (never under 1.2 m), eager
      wrong: async () => {
        call('knor-blij', yearling);
        const rr = k.ranger();
        const closer = toward(rr, yearling, Math.max(1.22, dist(rr, yearling) - 0.15));
        await yearling.go(closer.x, closer.z, { speed: 'walk', face: headingTo(closer, rr) });
        await yearling.sniff(rr.x, rr.z, 1.4, 1.22);
      },
      // no food: he trots back to his family and roots again
      right: async () => {
        for (const p of yearlingWay(way, side, from)) await yearling.go(p.x, p.z, { speed: 'trot' });
        await yearling.go(yHome.x, yHome.z, { speed: 'trot' });
        atHome(yearling, yHome);
      },
    });
  }

  /** 'zeug': the sow lifts her head and looks at him: FEET STILL (with the body). */
  async function zeug(e: Encounter): Promise<void> {
    const sow = A.sow;
    const sowHome = { x: sow.x, z: sow.z };
    k.beat = 'zeug:frame';
    const zt = k.ranger();
    const zh = headingTo(zt, sowHome);
    const zd = dist(zt, sowHome);
    // the lens comes round to their side, low, the two of them facing each other across the
    // picture — her head coming up and her stare at him read, him whole at the side
    const zeugView = (s: number): FrameSpec => ({
      at: toward(zt, sowHome, zd * 0.55), heading: zh + 1.25 * s,
      halfW: zd * 0.5 + 0.6, halfD: 0.8, tall: 1.0, pitchDeg: 12, insetTop: 110, insetBottom: 30,
      include: [{ x: zt.x, z: zt.z, h: 1.32, r: 0.4 }, { x: sowHome.x, z: sowHome.z, h: 0.9 }], // (his shoulders both: never cut by the edge)
    });
    await k.frame(zeugView(fieldClutter(zeugView(-1)) <= fieldClutter(zeugView(1)) ? -1 : 1));
    await rust.still(e.id, {
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
      // he stood still: she lowers her head and goes back to what she was doing
      right: async () => { await sow.go(sowHome.x, sowHome.z, { speed: 'walk', face: layout.sow.yaw }); atHome(sow, { ...layout.sow, ...sowHome }); },
    });
  }

  /** 'pad': the path is free (the flip: now GO) — a card. */
  async function pad(e: Encounter): Promise<void> {
    const family = [A.sow, A.p1, A.p2, A.p3, A.yearling];
    k.beat = 'pad:frame';
    const t = k.ranger();
    await k.frame({ ...way.wallowView, include: [{ x: t.x, z: t.z, h: 1.32 }] }, { face: headingTo(t, P.wallow) });
    await rust.ask(e.id, {
      // he waits too long: the group shuffles on a little, then roots again
      wrong: async () => {
        const away = dirOf(headingTo(k.ranger(), P.wallow));
        await Promise.all(family.map((a) => a.go(a.x + away.x * 1.1, a.z + away.z * 1.1, { speed: 'walk' })));
        for (const a of family) a.root(a.x, a.z, 0.4);
      },
      // he walks on a few calm steps along the way, past the wallow: room for the family
      right: async () => {
        const left2 = atLocal({ x: way.wallowGive.x, z: way.wallowGive.z, heading: way.wallowGive.heading! }, -1.1, 0.35);
        void lost.go(left2.x, left2.z, { speed: 'walk', face: headingTo(left2, P.wallow) });
        await k.walkRanger(way.wallowGive.x, way.wallowGive.z, 0.1);
        k.world.faceRanger(headingTo(k.ranger(), P.wallow));
      },
    });
  }
}

/**
 * The walk-round on `steen` (unmeasured, design §5.5): while he follows the squeak past
 * the family, coming within ~5 m of the sow makes her lift her head and watch him go
 * (once per approach, with a soft grunt and one line); she never moves toward him or the
 * lens. Once he is past them the follow's own line comes back. Nothing is logged.
 */
function walkRound(k: AdventureKit, sow: Actor, home: ResidentPose, call: (id: string, a: Actor) => void): (dt: number) => void {
  let near = false;
  let past = false;
  return () => {
    const m = k.ranger();
    const d = dist(m, sow);
    if (!near && d < SOW_NOTICE_M) {
      near = true;
      k.stats.walkround_notice = (k.stats.walkround_notice ?? 0) + 1;
      call('wildzwijn', sow);
      void sow.lookAt(() => { const r = k.ranger(); return { x: r.x, z: r.z, speed: 0 }; }, 2.6).then((ok) => {
        if (ok) { if (home.idle === 'stand') sow.idle(); else sow.root(home.x, home.z, home.roam ?? 0.5); }
      });
      k.say(k.copy.teDichtbij);
    } else if (near && d > SOW_NOTICE_M + 2) {
      near = false;
    }
    if (!past && dist(m, P.wallow) > 10 && m.z < -31) { past = true; k.say(k.copy.volg); }
  };
}

/** The yearling's way between the wallow and a field station: to the south field round
 *  the log's end and the fence's (the points from the wallow south; reversed coming back). */
const YEARLING_SOUTH: readonly { x: number; z: number }[] = [{ x: -22.6, z: -24.4 }, { x: -21.6, z: -31.3 }];
function yearlingWay(way: Way, from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number }[] {
  if (way.field !== 'S') return [];
  return from.z > to.z ? [...YEARLING_SOUTH] : [...YEARLING_SOUTH].reverse();
}
