/**
 * frisling.ts — "De verdwaalde frisling" as an adventure in the world (design §4.1, run 7
 * frisling §2, §5).
 *
 * The rotte (the sow, last year's young, three striped piglets) lives at its wallow, 13 m
 * past the empty marker ring. A thin squeak you can place comes from one of THREE WAYS
 * this play (frisling.vary.ts, from the play's seed, never the same way twice in a row):
 * north across the trail into the meadow (wei), round the rooting field and the family's
 * far side to the forest edge (steen), north-east to a lone birch in the meadow (berk). After one
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
import type { ResidentPose } from '../types';
import { store } from '../../../core/state';
import { WALK_SPEED } from '../../../core/input';
import { Sound } from '../../../core/sound';
import { narrator } from '../../../core/narrator';
import { buildZoekenTrial } from '../../../engines/zoeken';
import { spoorPath } from '../../play/kit';
import { heightFor } from '../../play/spawn';
import { lyingHeight, LEG_SHARE } from '../../play/pose';
import { TREE_BASE_H } from '../../world/Forest';
import { searchBeat } from '../beats/search';
import { routeBeat } from '../beats/route';
import { choiceRun } from '../beats/choice';
import { readSeconds } from '../beats/hold-math';
import { PaceCore, WalkOnCore, paceStretch, paceTempts, TIRED_PACE, WALK_ON_M } from '../beats/walk-math';
import { backPoints, openWindow, visibleShare } from '../cover-math';
import { listenerOf } from '../../world/Residents';
import { atLocal, dist, headingTo, toward, dirOf } from '../places';
import type { Place, Spot } from '../types';
import * as THREE from 'three';
import { FrislingHome } from './frisling.home';
import { Sightings, spawnBird, flight, type Bird } from './frisling.finds';
import {
  FRISLING_HOME, FRISLING_PLACES as P, WAYS, WAY_IDS, DEFAULT_WAY, FAMILY_LAYOUTS,
  frislingClearings, clueGap, fieldSpotsOf, nookAt, useWay, SOW_NOTICE_M, outSpotOf, bagView, BAG_REACH,
  zeugStare, zeugView, walkOnSpot, yearlingSideOf, yearlingWay, wallowLog, WALLOW_FRAME, WALLOW_LOG, NEST_R,
  larkLandings,
} from './frisling.places';
import { groundHides } from '../../world/surprises-math';
import { drawFrisling, frislingVariant, recentPlays, type FrislingVariant, type PastPlay } from './frisling.vary';
import { CRISP_GAP, CRISP_PRINTS, followLook, pullOf, stepAcross, type Pull } from './frisling.grow';

/** How far the lost piglet's squeak carries while he follows it (m): from the ring to
 *  any way's stand, ~35-38 m (softly at first, louder as he comes). */
const FOLLOW_REACH = 46;
/** His careful walk while he leads the piglet home (m/s): the piglet's own calm trot,
 *  so they stay together (a brisk walk is 2.2 m/s; running is still his to choose). */
const LEAD_PACE = 1.5;
/** After a reach at the lying piglet, at least this share of his back shows from the close
 *  lens (the stems over him give way): he stays clearly there, never a sliver. */
const AAIEN_SHOWS = 0.45;
/** After a run on the tired piglet's stretch he walks calmly right back to the clump it
 *  dived into (within this, m) before it comes out: the stretch again starts there, so a run
 *  that carried him to the stretch's end still gets a real walk back (never 0.7 m). */
const PACE_BACK_M = 2.2;
/** The hungry piglet at his bag (voeren at the stand) shows at least this share of his body
 *  from the bag's lens: the stand's fronds in between give way. */
const VOEREN_SHOWS = 0.7;
/** The woodlark (a surprise on his walks): its size (m; ≈ 1.6× the 0.3 m it had, so it
 *  reads as a bird in his picture's middle distance, as the magpie does), how near he comes before it flies up
 *  (m), and the heather top it perches on when it settles (m above the ground). */
const LARK_H = 0.5;
const LARK_FLUSH_M = 4.5;
const LARK_PERCH = 0.3;
/** The walk on from the field to the mud is long enough to be the tired piglet's moment
 *  (dragen at s2) from this long (m); shorter, he tires on the lead's last stretch. */
const PACE_HOME_M = 12;

/** The content's zoeken decoys of this mission (the stands show them in free roam). */
function distractorsOf(m: Mission | undefined): readonly Distractor[] {
  return (m?.stappen[0]?.skin.distractors ?? []) as Distractor[];
}

let contentDecoys: readonly Distractor[] = [];
/** This play's frisling (laid under the briefing card). */
let current: FrislingVariant | null = null;
/** The plays he set out on in this page session (their seed, way, family layout and nook):
 *  a play stopped early may have left no beat in the history. */
const started: PastPlay[] = [];

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
    // the look-alikes: how many from the level's knobs, which from the play (the 2D floor
    // draws the same set from the same seed)
    const trial = buildZoekenTrial(mission.stappen[0].skin, store.knobs('zoeken'), play.fork('zoeken').rng);
    // the calm moments' order (noted first: the history keeps 60 characters), the way, the
    // family, the nook (frisling.vary.ts)
    const v = drawFrisling(play, store.get().geschiedenis, started,
      { skin: mission.stappen[2].skin, diff: { ...store.knobs('dagnacht') } }, trial.decoys.map((d) => ({ k: d.k, animal: d.animal })));
    current = v;
    home.lay(v.way, { nook: v.nook, pose: v.pose, trial: trial.decoys, spots: v.decoySpots, glimpse: store.knobs('zoeken').glimpse, nest: v.nest });
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
    started.push({ sd: k.play.seed, way: v.way, fam: FAMILY_LAYOUTS[v.family].id, nook: v.nook });
    home.holdClue = true; // the clue waits for its moment: after the reunion, under the raaf's card
    const birds: Bird[] = [];
    try {
      await story(k, fam, home, v, birds);
    } finally {
      for (const b of birds) b.dispose(); // (the woodlark, the magpie, the butterflies: this play's)
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
  const v = frislingVariant(k.play, recentPlays(store.get().geschiedenis, started), []);
  return { ...v, way: DEFAULT_WAY, nook: 0, pose: 0 };
}

/** The adventure, beat by beat. */
async function story(k: AdventureKit, fam: ReturnType<AdventureKit['borrow']>, home: FrislingHome, v: FrislingVariant, birds: Bird[]): Promise<void> {
  const c = k.copy;
  const way = WAYS[v.way];
  const A = fam.actors as Record<'sow' | 'yearling' | 'p1' | 'p2' | 'p3' | 'lost', Actor>;
  const lost = A.lost;
  const layout = FAMILY_LAYOUTS[v.family].poses;
  const settings = store.get().settings;
  const listener = (): { x: number; z: number; yaw: number } => listenerOf(k.world.camera);
  const call = (id: string, a: Actor, reach?: number): void => { if (settings.geluid) Sound.callAt(id, a.x, a.z, listener(), reach); };
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  /** A calm moment's `i`-th temptation in this hold: how hard it pulls (each one stronger
   *  than the one before: frisling.grow.ts), the strongest he met noted (`pull_<id>`). */
  const tempted = (id: string, i: number): Pull => {
    const p = pullOf(i);
    k.stats[`pull_${id}`] = Math.max(k.stats[`pull_${id}`] ?? -1, p);
    return p;
  };
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

  // 0 · what he can discover here (recorded only once he really saw it, its reveal at a
  // quiet beat) and this play's small surprises (frisling.finds.ts)
  const finds = new Sightings(k);
  const scene = k.ctx.scene as THREE.Scene;
  const log = wallowLog();
  const logYaw = WALLOW_FRAME.heading + WALLOW_LOG.turn + Math.PI / 2; // (along the log)
  /** the animal rubbing its flank on the log now (the sow in 'boom', the yearling) */
  let rubbing: Actor | null = null;
  const nestPts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x = way.nest.x + Math.cos(a) * NEST_R * 0.8, z = way.nest.z + Math.sin(a) * NEST_R * 0.8;
    return { x, y: k.ctx.groundY(x, z) + 0.08, z };
  });
  finds.watch({ id: 'frisling.zeug', object: () => A.sow.body });
  finds.watch({ id: 'frisling.overloper', object: () => A.yearling.body, within: 15 });
  finds.watch({ id: 'frisling.schuurboom', object: () => home.rub, when: () => rubbing !== null, within: 25, near: { x: log.x, z: log.z, r: 2.5 } });
  finds.watch({
    id: 'frisling.nest', object: () => home.nest, when: () => dist(k.ranger(), way.stand) < 7, near: { ...way.nest, r: 2 },
    hidden: (eye) => visibleShare(nestPts, eye, home.cover.stems) < 0.25,
  });
  // (this play's birds: the magpie on the sow, the butterflies over the meadow)
  let ekster: Bird | null = null;
  let eksterOn = false;
  let eksterStep: ((dt: number) => boolean) | null = null;
  const EKSTER_BACK = { y: 0.74, z: -0.12 };
  const flutter: { b: Bird; at: Spot; ph: number }[] = [];
  const surprise = k.play.fork('verrassing');
  // the pigs' rubbing log: in 'boom' the sow rubs her flank on it while he looks at them;
  // otherwise, now and then, the yearling goes over and has a good scratch (never on his
  // first play here: that one is the adventure itself, the finds wait for coming back)
  const extras = k.play.n > 1;
  if (extras && FAMILY_LAYOUTS[v.family].id === 'boom') rub(A.sow, layout.sow);
  else if (extras && surprise.fork('schuren').chance(0.4)) {
    // (beside the log on the wallow's side, flank to it)
    const across = logYaw - Math.PI / 2;
    const side = Math.sign((P.wallow.x - log.x) * Math.sin(across) + (P.wallow.z - log.z) * Math.cos(across)) || 1;
    const spot = { x: log.x + Math.sin(across) * 0.62 * side, z: log.z + Math.cos(across) * 0.62 * side };
    rub(A.yearling, { x: spot.x, z: spot.z, yaw: logYaw, idle: 'stand' });
  }
  // the rare one: a magpie riding on the sow's back (FOUNDATION's roll, its pity rule)
  if (k.rare()?.id === 'frisling.ekster') await magpie();
  // a woodlark in the heather where he walks (about half the plays: the variant's)
  if (v.leeuwerik !== null) void woodlark(way.walkSpots[v.leeuwerik]);
  // butterflies over the meadow on the way north (wei, berk), now and then
  if (v.way !== 'steen' && surprise.fork('vlinders').chance(0.6)) void butterflies();

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
  // (the first prints crisp and close by the ring at every level: where it starts reads at
  // once; from there his level's trail — further apart and fainter as he grows — and the
  // squeak, heard less often: frisling.grow.ts)
  const look = followLook(knobs);
  const crispM = (CRISP_PRINTS - 1) * CRISP_GAP;
  const prints = [
    spoorPath(sliceAlong(trail, 0, crispM + 0.01), k.ctx.groundY, { opacity: 1, size: 0.62, spacing: CRISP_GAP, crisp: CRISP_PRINTS }).group,
    spoorPath(sliceAlong(trail, crispM + look.gap, Infinity), k.ctx.groundY, { opacity: look.opacity, size: 0.62, spacing: look.gap }).group,
  ];
  for (const p of prints) k.own(p);
  k.stats.print_gap = look.gap;
  k.stats.print_opacity = look.opacity;
  k.stats.squeak_every = look.squeakEvery[0];
  fam.voice('lost', true, FOLLOW_REACH, look.squeakEvery);
  const round = v.way === 'steen' ? walkRound(k, A.sow, layout.sow, call) : undefined;
  // (on steen, now and then, a jay screeches from the forest edge past the stand)
  const jay = v.way === 'steen' && surprise.fork('gaai').chance(0.7) ? atLocal(way.frame, 2.5, 7) : null;
  let followT = 0, jaySaid = false;
  await k.walk({
    name: 'cover', to: way.coverApproach, r: 1.5, line: v.way === 'steen' ? c.boog : c.volg, doel: c.chipPiep, cue: c.luister,
    via: way.follow.slice(1, -1),
    tick: (dt) => {
      round?.(dt);
      followT += dt;
      // well on his way: the family goes back to what it does, the magpie takes off
      if (followT > 5 && rubbing && dist(k.ranger(), log) > 12) stopRub();
      if (followT > 4) magpieOff();
      if (jay && !jaySaid && dist(k.ranger(), way.stand) < 16) {
        jaySaid = true;
        k.stats.gaai = 1;
        if (settings.geluid) Sound.callAt('gaai', jay.x, jay.z, listener(), 30);
      }
    },
  });
  fam.voice('lost', false);
  stopRub();
  hideButterflies();

  // 3 · find him (zoeken): the knobs' glimpse of his back, fitted both ways for the lens the
  // search really stands at (frisling.window: as much of him in every nook), among the
  // knobs' look-alikes (laid under the briefing card), the first hint after the knobs'
  // seconds (searchBeat reads them)
  k.stats.look_alikes = home.decoys.filter((d) => d.object.visible).length;
  // (the moment he finds him, the look-alikes' birds and butterfly startle and fly off)
  let flewOff = false;
  const offFly = k.onTick(() => { if (!flewOff && k.stats.search_seconds !== undefined) { flewOff = true; flyOff(); } });
  await searchBeat(k, 0, {
    view: way.searchView, stand: way.coverApproach, cover: home.cover, target: lost, call: 'piep',
    lyingH: lyingHeight(heightFor('frisling'), LEG_SHARE.frisling), glimpse: knobs.glimpse,
    fit: (eye, _back, share) => home.refitSearch(eye, share),
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: (f) => home.poke(d, f) })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  offFly();
  if (!flewOff) { flewOff = true; flyOff(); }
  // the trail has done its work: under the raaf's card its prints fade into the ground
  // (calmly, 1.5 s; no more draw calls for it in the pictures over the heath that follow)
  fadeAway(prints, 1.5);
  // 4 · the raaf: stripes
  await k.fact(0);

  // 5 · where he lies, pressed flat in the parted bracken, squeaking right in front of
  // him: HANDS STILL (rustkracht 'big', played with the body — a click on him is a hand reaching)
  const rust = choiceRun(k, 2);
  const lay = { x: lost.x, z: lost.z };
  const lying = lyingHeight(heightFor('frisling'), LEG_SHARE.frisling);
  /** The close picture of him lying in the bracken (centred on where he was found). */
  const aaienView: FrameSpec = {
    at: { ...lay }, heading: way.searchView.heading, halfW: 1.0, halfD: 0.95, tall: 0.55, pitchDeg: 46,
    insetTop: 130, insetBottom: 70,
  };
  /** A reach scoots him SIDEWAYS across that picture (never deeper, away from the lens):
   *  to the one side, then back past where he was to the other. */
  const aside = (n: number): Spot => atLocal({ ...lay, heading: aaienView.heading }, n % 2 ? -0.42 : 0.42, 0);
  /** The fronds over him part — and the stems between the close lens and his back give
   *  way (a young frond, a stooping tussock: they grow down calmly) — so at least
   *  `AAIEN_SHOWS` of his back is seen: he never shrinks to a sliver in the bracken. */
  const showHim = (at: Spot): void => {
    home.cover.partAt(at.x, at.z, 0.9, 0.72, 90);
    const eye = k.lensFor(aaienView).cam;
    const back = backPoints(at.x, k.ctx.groundY(at.x, at.z), at.z, lost.yaw, lying * 2.7, lying);
    const drawn = home.cover.stems.map((st) => st.h);
    const more = openWindow(home.cover.stems, eye, back, AAIEN_SHOWS);
    if (more.length) home.cover.settle(more, 0.8, drawn);
    k.stats.aaien_visible = Math.round(visibleShare(back, eye, home.cover.stems) * 100) / 100;
  };
  if (!lost.body) throw new Error('[frisling] the lost piglet has no body');
  if (!lost.lies) void lost.lie(true); // (pressed flat where he was found: he gets up only once calm)
  showHim(lay);
  for (let e = rust.nextIn('big'); e; e = rust.nextIn('big')) {
    k.beat = 'aaien:frame';
    await k.frame(aaienView);
    let reaches = 0;
    /** this hold's temptations so far (a reach begins the hold again) */
    let tempts = 0;
    /** where he lies now (a wriggle closer moves him) */
    let lies: Spot = { ...lay };
    await rust.still(e.id, {
      line: c.raakNiet, mis: c.schrok, hands: () => lost.body,
      show: () => call('piep', lost),
      // the hand wants to go, each time a little more (frisling.grow.ts): he squeaks where
      // he lies and the fronds over him tremble; then he lifts his head and looks at him;
      // then he gets up, wriggles half a step nearer his hand (across the picture, never
      // at the lens) and flops down again, peeking up at him
      tempt: () => {
        const pull = tempted('aaien', tempts++);
        call('piep', lost);
        if (pull === 0) { const cl = home.cover.nearestClump(lost.x, lost.z); if (cl) home.cover.rustle(cl.i, 0.06); }
        else if (pull === 1) void lost.lookAt(me, 1.6);
        else void wriggle();
      },
      // a hand reaches for him: he scoots aside through the bracken, lies flat, peeks out
      wrong: async () => {
        tempts = 0;
        call('piep', lost);
        const to = aside(reaches++);
        lies = to;
        await lost.go(to.x, to.z, { speed: 'trot', face: lost.yaw });
        await lost.lie(true);
        // he peeks out where he lies now: the fronds over him part (and stay parted)
        showHim(to);
        await k.wait(0.9);
        await lost.lookAt(me, 1.2);
      },
    });
    /** The strongest pull: he gets up, comes half a step nearer the hand across the picture
     *  and lies down again where the fronds part over him, peeking up (a reach meanwhile
     *  takes him over: the wriggle simply stops). */
    async function wriggle(): Promise<void> {
      const to = stepAcross(lies, k.ranger(), aaienView.heading, 0.24);
      if (!(await lost.go(to.x, to.z, { speed: 0.7, face: lost.yaw }))) return;
      lies = to;
      await lost.lie(true);
      showHim(to);
      void lost.lookAt(me, 1.4);
    }
  }

  // 6 · he gets up, tired, and comes out to him, to his side (away from the way home:
  // walking on, the ranger leads and the piglet follows, never walks into him; on steen
  // the side whose close pictures look away from the roe's home)
  await lost.lie(false);
  const r1 = k.ranger();
  const edge = outSpotOf(way, r1);
  await lost.go(edge.x, edge.z, { speed: 'walk', face: headingTo(edge, r1) });
  void lost.lookAt(me, 3);
  // the first calm moment on the way home (s1): the piglet begs at his bag here, or he is
  // tired on the lead's first stretch
  const s1 = rust.nextIn('weg');
  if (s1?.id === 'voeren') await voerenPiglet();

  // 7 · lead him home to the rooting field, calmly, his family ahead all the way. Tired
  // (dragen) he is on the lead's first stretch when that moment comes first; when it comes
  // second on a way whose walk on from the field to the mud is only a few steps (wei, berk:
  // 3-8 m, too short to be a moment), on the lead's last stretch instead
  // (the whole lead home as he walks it, a tired stretch on it included: the bar for a
  // real walk home reads this, not only the walk named 'field')
  let ledM = 0, ledWas = k.ranger();
  const offLed = k.onTick(() => { const r = k.ranger(); ledM += Math.min(1, dist(r, ledWas)); ledWas = r; });
  await setOff(way.fieldApproach);
  const homeLong = pathLength([way.fieldApproach, ...way.toWallow, way.wallowTalk]) >= PACE_HOME_M;
  let leadName = 'field';
  if (s1?.id === 'dragen') await dragen([way.fieldApproach], c.chipWroet);
  else if (rust.nextIn('weg')?.id === 'dragen' && !homeLong) {
    const m0 = k.ranger();
    const lead0 = dist(m0, way.fieldApproach);
    const len = paceStretch(rust.tempo.seconds, lead0);
    if (lead0 - len > 2) {
      const mid = pointAlong([m0, way.fieldApproach], lead0 - len);
      await k.walk({ name: 'field', to: { ...mid, r: 1.0 }, r: 1.0, line: c.leid, doel: c.chipWroet, glyph: 'boot', lead });
      leadName = 'field-end';
    }
    await dragen([way.fieldApproach], c.chipWroet);
  }
  await k.walk({ name: leadName, to: way.fieldApproach, r: 1.0, line: c.leid, doel: c.chipWroet, glyph: 'boot', lead });
  offLed();
  k.stats.lead_home_m = Math.round(ledM * 10) / 10;
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
  // the second calm moment on the way home (s2): the yearling trots out to his bag here,
  // or the piglet is tired on the way to the mud
  const s2 = rust.nextIn('weg');
  if (s2?.id === 'voeren') await voerenYearling();

  // 10 · on to the wallow, the piglet at his heels (tired, on a way where that walk is long)
  await setOff(way.toWallow[0] ?? way.wallowTalk);
  if (s2?.id === 'dragen') await dragen([...way.toWallow, way.wallowTalk], c.chipModder);
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
    if (e.id === 'zeug') await zeug(e.id);
    else await pad(e.id);
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
    magpieBack();
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
  // a calm beat with the family together before the raaf's card comes over them (now and
  // then two of the piglets chase each other round the mud)
  if (surprise.fork('jagen').chance(0.5)) await chase(A.p2, A.p3);
  else await k.wait(1.4);
  // 15 · the raaf: a group of pigs (after the reunion, before the reward); under its
  // card the clue drops: the cut fence past the wallow fades in
  home.revealClue();
  await k.fact(2);
  // 16 · one calm look at it (the clue card names it next, with the reward)
  const gap = clueGap();
  await k.look({ x: gap.x, z: gap.z, y: k.ctx.groundY(gap.x, gap.z) + 0.1 }, c.hek);

  /* ------------------------------------------- finds and small surprises ---- */

  /** An animal rubs its flank on the log: it leans this way and that against it (a
   *  gentle wiggle, never a turn round), grunting now and then — until `stopRub`. */
  function rub(a: Actor, at?: ResidentPose): void {
    rubbing = a;
    k.stats.rub = a === A.sow ? 1 : 2;
    let i = 0;
    const loop = async (): Promise<void> => {
      // (first at its place by the log: she may still be on her calm walk there)
      if (at && dist(a, at) > 0.15 && !(await a.go(at.x, at.z, { speed: 'walk', face: at.yaw ?? a.yaw }))) { if (rubbing === a) rubbing = null; return; }
      while (rubbing === a) {
        const t = logYaw + (i++ % 2 ? 0.2 : -0.2) + (Math.cos(a.yaw - logYaw) < 0 ? Math.PI : 0);
        const ok = await a.lookAt(() => ({ x: a.x + Math.sin(t) * 3, z: a.z + Math.cos(t) * 3, speed: 0 }), 0.85);
        if (!ok) break; // (something else took the animal over)
        if (i % 5 === 0) call('wildzwijn', a, 20);
      }
      if (rubbing === a) rubbing = null;
    };
    void loop();
  }
  /** The rubbing is over: the animal back to its own place in this play's layout. */
  function stopRub(): void {
    const a = rubbing;
    if (!a) return;
    rubbing = null;
    const pose = a === A.sow ? layout.sow : layout.yearling;
    if (dist(a, pose) > 0.3) void a.go(pose.x, pose.z, { speed: 'walk' }).then((ok) => { if (ok) atHome(a, pose); });
    else atHome(a, pose);
  }

  /** The magpie (rare): rides on the sow's back, hops about and pecks at her bristles; it
   *  takes off when he walks away (never there during a calm moment's hold), and lands on
   *  her again at the reunion. Two draw calls at most; seen = discovered. */
  async function magpie(): Promise<void> {
    const b = await spawnBird(k, 'bird-ekster', 0.42); // (≈ 1.5× a magpie: it reads on her back from the look)
    if (!b) return;
    birds.push(b);
    ekster = b;
    A.sow.group.add(b.root);
    b.root.position.set(0, EKSTER_BACK.y, EKSTER_BACK.z);
    b.root.visible = true;
    eksterOn = true;
    finds.watch({ id: 'frisling.ekster', object: () => (ekster && ekster.root.visible ? ekster.root : null) });
    const hop = k.play.fork('ekster');
    let next = 0.8, t = 0, hopT = -1, from = 0, to = 0;
    k.onTick((dt) => {
      if (!ekster) return;
      if (eksterStep) { if (eksterStep(dt)) eksterStep = null; return; }
      if (!eksterOn) return;
      t += dt;
      const r = ekster.root;
      if (hopT >= 0) {
        hopT += dt / 0.32;
        const e = Math.min(1, hopT);
        r.position.z = from + (to - from) * e;
        r.position.y = EKSTER_BACK.y + Math.sin(Math.PI * e) * 0.07;
        if (hopT >= 1) hopT = -1;
      } else if (t >= next) {
        // a hop along her back, a turn; or a peck at her bristles
        if (hop.chance(0.6)) { from = r.position.z; to = hop.between(-0.3, 0.12); hopT = 0; r.rotation.y = hop.between(-1.2, 1.2); }
        else r.rotation.x = 0.45;
        next = t + hop.between(0.7, 1.8);
      } else if (r.rotation.x > 0 && t > next - 0.4) r.rotation.x = 0;
    });
  }
  /** It takes off from her back and flies away from him, low, and is gone. */
  function magpieOff(): void {
    if (!ekster || !eksterOn) return;
    eksterOn = false;
    const r = ekster.root;
    scene.attach(r);
    r.rotation.set(0, 0, 0);
    const p = r.position.clone();
    const away = headingTo(k.ranger(), A.sow) + (k.play.fork('ekster-off').chance(0.5) ? 0.6 : -0.6);
    const g = k.ctx.groundY(p.x, p.z);
    eksterStep = flight(k, r, { x: p.x, z: p.z, y: p.y - g }, { ...toward(p, { x: p.x + Math.sin(away), z: p.z + Math.cos(away) }, 16), y: 2.5 }, 2.6, 1.8);
    const done = eksterStep;
    eksterStep = (dt) => { const end = done(dt); if (end && ekster) ekster.root.visible = false; return end; };
  }
  /** At the reunion it flies back in from beyond the family and lands on her back again. */
  function magpieBack(): void {
    if (!ekster) return;
    const r = ekster.root;
    // (in from the side, across the picture: never toward the lens)
    const sowAt = { x: A.sow.x, z: A.sow.z };
    const side = headingTo(k.ranger(), sowAt) + (k.play.fork('ekster-back').chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const from = { x: sowAt.x + Math.sin(side) * 12, z: sowAt.z + Math.cos(side) * 12 };
    r.visible = true;
    scene.attach(r);
    const back = new THREE.Vector3(0, EKSTER_BACK.y, EKSTER_BACK.z);
    A.sow.group.localToWorld(back);
    const land = flight(k, r, { ...from, y: 3 }, { x: back.x, z: back.z, y: back.y - k.ctx.groundY(back.x, back.z) }, 2.4, 1.2);
    eksterStep = (dt) => {
      if (!land(dt)) return false;
      A.sow.group.attach(r);
      r.position.set(0, EKSTER_BACK.y, EKSTER_BACK.z);
      r.rotation.set(0, 0, 0);
      eksterOn = true;
      return true;
    };
  }

  /**
   * A woodlark sits hidden in the heather at `spot` on his way. When he comes within
   * `LARK_FLUSH_M` of it on a walk, with it in his picture (never behind him), it flies up
   * singing its soft falling "lu-lu-lu", low ACROSS his picture — never along the lens away
   * from it, never toward it — in a lark's soft undulating flight, 2.5-3 s, settles on a
   * heather top on the other side of the picture (`larkLandings`: it keeps pace with his
   * picture as he walks on, and stays in it if he stops to watch), sits a moment and drops
   * into the heather, gone. He MET it (seen and heard): recorded as it drops in (or when his
   * walk or the play ends first), so its calm reveal names the bird he just watched and
   * never covers it in flight. It never sits in the search's picture as one more bird to
   * click: once his walk ends it is gone.
   */
  async function woodlark(spot: Spot): Promise<void> {
    const b = await spawnBird(k, 'bird-boomleeuwerik', LARK_H);
    if (!b) return;
    const r = b.root;
    let phase: 'sit' | 'fly' | 'rest' | 'drop' | 'gone' = 'sit';
    // (a play that ends while it flies still records it: he met it)
    birds.push({ root: r, dispose: () => { if (phase !== 'sit' && phase !== 'gone') finds.meet('frisling.leeuwerik'); b.dispose(); } });
    scene.add(r);
    const f = k.play.fork('leeuwerik-vlucht');
    r.position.set(spot.x, k.ctx.groundY(spot.x, spot.z), spot.z);
    r.rotation.y = f.between(0, Math.PI * 2);
    r.visible = false; // (hidden in the heather until it flies up: no bird to click in a picture, no draw call)
    const cam = k.world.camera;
    const flySecs = f.between(2.5, 3), arc = f.between(0.7, 1.0), restS = f.between(1.3, 1.8);
    const first = f.chance(0.5) ? 1 : -1;
    let step: ((dt: number) => boolean) | null = null;
    let t = 0;
    let px = 0;
    const off = k.onTick((dt) => {
      const walking = k.beat.startsWith('walk:');
      if (phase === 'sit') {
        if (!walking || dist(k.ranger(), spot) > LARK_FLUSH_M) return;
        const s = ndcOf(cam, spot.x, k.ctx.groundY(spot.x, spot.z) + LARK_H * 0.5, spot.z);
        if (!inPicture(s, 0.85, -0.85, 0.85)) return; // (in his picture: never behind him)
        const to = larkSettle(spot, s.x);
        phase = 'fly';
        r.visible = true;
        k.stats.leeuwerik = 1;
        if (settings.geluid) Sound.callAt('boomleeuwerik', spot.x, spot.z, listener(), 30);
        step = flight(k, r, { ...spot, y: 0 }, { ...to, y: LARK_PERCH }, flySecs, arc, { bob: 0.14, bumps: 3, pitch: 0.3 });
        return;
      }
      if (phase === 'fly') {
        if (!walking) { gone(); return; } // (his walk ended: never in a framed picture)
        px = Math.max(px, Sightings.px(cam, r, k.ctx.canvas.clientHeight || 800).px);
        k.stats.leeuwerik_px = Math.round(px);
        if (step?.(dt)) { phase = 'rest'; t = 0; }
        return;
      }
      if (phase === 'rest') {
        t += dt;
        if (!walking || t >= restS) { phase = 'drop'; t = 0; }
        return;
      }
      // it drops into the heather (under reduced motion: simply gone)
      t += dt;
      if (k.reduced || !walking || t >= 0.4) { gone(); return; }
      r.position.y -= ((LARK_PERCH + LARK_H) * dt) / 0.4;
    });
    function gone(): void {
      r.visible = false;
      off();
      phase = 'gone';
      finds.meet('frisling.leeuwerik');
    }
    /** Where it settles: of `larkLandings` (both sides, `first` side first; it keeps pace
     *  with his picture as he walks on at his pace now: at its middle distance halfway
     *  through its sit), those in his picture if he stops to watch AND when it drops in
     *  while he walked on, on free ground and not behind a rise; of those, on the OTHER side
     *  of the picture from where it rose (as it lands), the one nearest the picture's middle
     *  that is clear of the veldgids's reveal (top left), else the nearest across, else the
     *  first in view, else on along the lens. */
    function larkSettle(from: Spot, sx: number): Spot {
      const me = k.ranger();
      const look = headingTo({ x: cam.position.x, z: cam.position.z }, me);
      const pace = Math.min(WALK_SPEED, Math.max(0, k.ctx.rangerMotion().speed));
      const lensOn = (m: number): THREE.PerspectiveCamera => {
        const c = cam.clone();
        c.position.x += Math.sin(look) * m;
        c.position.z += Math.cos(look) * m;
        c.updateMatrixWorld(true);
        return c;
      };
      const lands = lensOn(pace * flySecs), drops = lensOn(pace * (flySecs + restS));
      const walked = pace * (flySecs + restS / 2);
      const all = [...larkLandings(me, look, first, walked), ...larkLandings(me, look, first === 1 ? -1 : 1, walked)];
      const lift = LARK_PERCH + LARK_H * 0.5;
      const at = (c: THREE.Camera, p: Spot): THREE.Vector3 => ndcOf(c, p.x, k.ctx.groundY(p.x, p.z) + lift, p.z);
      const seen = all.filter((p) => inPicture(at(cam, p), 0.8, -0.85, 0.62) && inPicture(at(drops, p), 0.82, -0.85, 0.62)
        && k.ctx.isClear(p.x, p.z, 0.4) && !groundHides(cam.position, new THREE.Vector3(p.x, k.ctx.groundY(p.x, p.z) + lift, p.z), k.ctx.groundY));
      const crosses = (p: Spot): boolean => {
        const q = at(lands, p);
        return Math.abs(q.x - sx) >= 0.4 && (Math.abs(sx) < 0.08 || Math.sign(q.x) !== Math.sign(sx));
      };
      const clearOfReveal = (p: Spot): boolean => { const q = at(lands, p); return !(q.x < -0.36 && q.y > 0.36); };
      // (of those across, the one that stays nearest the picture's middle as he walks on: a
      // lens that slides or turns a little with his walk still keeps it in view)
      const across = seen.filter(crosses).sort((a, b) => Math.abs(at(drops, a).x) - Math.abs(at(drops, b).x));
      const pick = across.find(clearOfReveal) ?? across[0] ?? seen[0];
      // (the dev read: how many it could settle on, and whether it flew across)
      k.stats.leeuwerik_seen = seen.length;
      k.stats.leeuwerik_across = across.length ? 1 : 0;
      return pick ?? atLocal({ x: from.x, z: from.z, heading: look }, 0, 6);
    }
  }

  /**
   * The search is over: the look-alikes' animals — the stonechat, the nightjar, the heath
   * blue — startle as the piglet lifts his head and squeaks, and fly off low out of the
   * stand, away from him (never toward the lens), and are gone; their stalks, patches and
   * flowers stay. So no look-alike waits in the close pictures at the stand that follow (and
   * a level with more of them costs no draw calls after the search: run 7 growth). Each
   * comes back to its perch when the play ends.
   */
  function flyOff(): void {
    const me = k.ranger();
    const f = k.play.fork('wegvliegen');
    let n = 0;
    for (const d of home.decoys) {
      if (!d.object.visible || d.kind === 'bush') continue;
      const o = home.stand.decoys.animalOf(d);
      if (!o || !o.parent) continue;
      const parent = o.parent, pos = o.position.clone(), rot = o.rotation.clone(), order = o.rotation.order;
      birds.push({ root: o, dispose: () => { parent.add(o); o.position.copy(pos); o.rotation.copy(rot); o.rotation.order = order; o.visible = true; } });
      const w = o.getWorldPosition(new THREE.Vector3());
      scene.attach(o);
      n += 1;
      const away = headingTo(me, d) + f.between(-0.7, 0.7);
      const to = { x: d.x + Math.sin(away) * f.between(12, 16), z: d.z + Math.cos(away) * f.between(12, 16), y: f.between(1.8, 2.6) };
      const step = flight(k, o, { x: w.x, z: w.z, y: w.y - k.ctx.groundY(w.x, w.z) }, to, f.between(1.8, 2.4), 0.6,
        d.kind === 'butterfly' ? { bob: 0.18, bumps: 4 } : { bob: 0.08, bumps: 2, pitch: 0.2 });
      window.setTimeout(() => {
        if (k.signal.aborted) return;
        const off = k.onTick((dt) => { if (step(dt)) { o.visible = false; off(); } });
      }, f.between(0.1, 0.5) * 1000); // (not all at once: one, then another)
    }
    k.stats.flew_off = n;
  }

  /** Things of this play fade out over `secs` (under reduced motion: at once), then go. */
  function fadeAway(groups: readonly THREE.Object3D[], secs: number): void {
    const mats: { m: THREE.Material; o: number }[] = [];
    for (const g of groups) g.traverse((x) => { const m = (x as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m)) mats.push({ m, o: m.opacity }); });
    let t = 0;
    const off = k.onTick((dt) => {
      t = k.reduced ? secs : t + dt;
      const e = Math.min(1, t / secs);
      for (const q of mats) q.m.opacity = q.o * (1 - e);
      if (e >= 1) { for (const g of groups) g.visible = false; off(); }
    });
  }

  /** A few heath blues flutter over the meadow by the way north (this play's chance). */
  async function butterflies(): Promise<void> {
    const f = k.play.fork('vlinders');
    const along = way.follow;
    for (let i = 0; i < 2; i++) {
      const b = await spawnBird(k, 'heideblauwtje', 0.05);
      if (!b) return;
      birds.push(b);
      scene.add(b.root);
      const t = f.between(0.25, 0.6);
      const base = toward(along[0], along[along.length - 1], dist(along[0], along[along.length - 1]) * t);
      flutter.push({ b, at: atLocal({ ...base, heading: headingTo(along[0], along[along.length - 1]) }, (i ? 1 : -1) * f.between(1.8, 3.2), f.between(-1, 1)), ph: f.between(0, 6) });
      b.root.visible = true;
    }
    let t = 0;
    k.onTick((dt) => {
      t += dt;
      for (const q of flutter) {
        if (!q.b.root.visible) continue;
        const x = q.at.x + Math.sin(t * 0.8 + q.ph) * 0.9, z = q.at.z + Math.cos(t * 0.6 + q.ph * 1.3) * 0.9;
        const y = k.ctx.groundY(x, z) + 0.55 + Math.sin(t * 2.6 + q.ph) * 0.18;
        const r = q.b.root;
        r.rotation.y = Math.atan2(x - r.position.x, z - r.position.z);
        r.position.set(x, y, z);
      }
    });
  }
  function hideButterflies(): void { for (const q of flutter) q.b.root.visible = false; }

  /** Two piglets chase each other round the mud, then root on (after the reunion). */
  async function chase(a: Actor, b: Actor): Promise<void> {
    // (an arc round the far side of the mud and back: across the picture, never at the lens)
    const far = headingTo(P.wallow, k.ranger()) + Math.PI;
    const arc = [-1.5, -0.75, 0, 0.75, 1.5].map((d) => ({ x: P.wallow.x + Math.sin(far + d) * 2.2, z: P.wallow.z + Math.cos(far + d) * 2.2 }));
    const ring = [...arc, ...arc.slice(0, -1).reverse()];
    k.stats.jagen = 1;
    call('piep', a);
    const run = async (x: Actor, lag: number): Promise<void> => {
      await k.wait(lag);
      for (const p of ring) await x.go(p.x, p.z, { speed: 'trot' });
    };
    await Promise.race([Promise.all([run(a, 0), run(b, 0.5)]), k.wait(6)]);
    for (const x of [a, b]) x.root(x.x, x.z, 0.4);
  }

  /* ---------------------------------------------------- the calm moments ---- */

  /** A line's read: the voice done with it (when voorlezen is on), never quicker than a
   *  calm read (280 ms a word, at least `min` s); mission time, stopped by a stop. */
  async function readOut(line: string, min = 0): Promise<void> {
    const calm = k.wait(Math.max(min, readSeconds(line)));
    if (!settings.voorlezen) { await calm; return; }
    await Promise.all([calm, k.guard(narrator.quiet(line.split(/\s+/).length * 700 + 2000))]);
  }

  /** A calm moment's good words (the content's uitleg, as its card says them). */
  function uitlegOf(id: string): string {
    return rust.trial.encounters.find((x) => x.id === id)?.uitleg ?? 'Rustig zo.';
  }

  /** A calm moment done with the body: the soft "right" tone and its good words, read
   *  before what follows. */
  async function praise(id: string): Promise<void> {
    if (settings.geluid) Sound.correct();
    const good = uitlegOf(id);
    k.say(good, { good: true });
    await readOut(good, 1.6);
  }

  /**
   * 'dragen' (PACE): he is tired — walk slowly with him. A stretch of the way home
   * (`paceStretch`: the level's hold walked twice at his tired pace, at least 8 m, or the
   * rest of the way) with the piglet trotting at his side, his walk at its pace; the
   * family grunts ahead and a sibling squeaks (`tempts`: he wants to hurry). A RUN is the
   * impulse (`PaceCore`): the piglet squeals and dives into a clump in his picture, "Niet
   * rennen. Hij is moe.", and once he walked calmly back to it the stretch starts again
   * from there. Walked calmly to its end: the good words. `pts`: the rest of the way.
   */
  async function dragen(pts: readonly Place[], doel: string): Promise<void> {
    const core = new PaceCore((g) => rust.answer('dragen', g));
    const fork = k.play.fork('pace');
    const last = pts[pts.length - 1];
    k.stats.pace_dragen = 0;
    for (;;) {
      const m = k.ranger();
      // the way still ahead of him (the points he has passed dropped)
      const ahead = pts.filter((p, i) => i === pts.length - 1 || dist(p, last) < dist(m, last));
      const path: Spot[] = [{ x: m.x, z: m.z }, ...ahead];
      const rest = pathLength(path);
      // (as long as a hold wants now: the beat's tempo, a little shorter after a reach)
      const len = paceStretch(rust.tempo.seconds, rest);
      const whole = len >= rest - 0.6; // (the rest of the way: it ends where the walk ends)
      const end: Place = whole ? last : { ...pointAlong(path, len + 0.9), r: 0.9 };
      k.stats.pace_len = Math.round(len * 10) / 10;
      const marks = paceTempts(len, rust.tempo, fork.rng);
      // where he drops flat when he runs: the heather beside this stretch, on his side of
      // the way (every 2.5 m), so he dives where the boy sees him — never back into the
      // stand's bracken behind the lens, 10 m off
      const flat: Spot[] = [];
      for (let d = 1.5; d <= Math.min(rest - 0.6, len + 3); d += 2.5) {
        const p0 = pointAlong(path, d), p1 = pointAlong(path, d + 0.5);
        flat.push(atLocal({ ...p0, heading: headingTo(p0, p1) }, -1.7, 0));
      }
      let walked = 0, mi = 0, was = k.ranger(), out = false;
      const walk = k.walk({
        name: 'moe', to: end, r: end.r ?? 1.0, line: c.moe, doel, glyph: 'boot',
        via: path.slice(1).filter((p) => p !== last && pathLength([path[0], p]) < len),
        lead: {
          ...lead, pace: TIRED_PACE, backM: PACE_BACK_M, hide: [...lead.hide, ...flat], runLine: c.nietRennenMoe, backLine: c.moe,
          onHide: (sp: Spot): void => {
            lead.onHide(sp);
            // (a run is a reach: the beat's next hold, and this stretch again, a little shorter)
            if (core.run()) { rust.tempo.reached(); k.stats.pace_dragen = core.impulses; if (settings.geluid) Sound.tryAgain(); }
          },
          onOut: (): void => { lead.onOut(); if (core.phase === 'react') out = true; },
        },
        // (once he walked calmly back and the piglet is out again, this stretch is over:
        // a new one begins from where they stand)
        reached: () => out,
        tick: () => {
          const r = k.ranger();
          if (core.phase === 'walk') walked += Math.min(1, dist(r, was));
          was = r;
          // the way home tempts him to hurry, each time a little more (never while he hides)
          while (mi < marks.length && walked >= marks[mi]) hurry(tempted('dragen', mi++));
        },
      });
      k.beat = 'pace:dragen'; // (a calm moment, not a walk: a discovery's reveal waits)
      await walk;
      if (out) { core.again(); continue; }
      core.arrived();
      break;
    }
    // walked calmly with him: they stop a moment, the good words
    k.lockFollow();
    k.world.stopRanger();
    await praise('dragen');
  }

  /** A temptation to hurry home on the tired piglet's walk: the sow grunts ahead; then a
   *  sibling squeaks ahead and the tired piglet squeaks back; then the whole family calls. */
  function hurry(pull: Pull): void {
    const later = (s: number, f: () => void): void => { window.setTimeout(() => { if (!k.signal.aborted) f(); }, s * 1000); };
    if (pull === 0) { call('wildzwijn', A.sow, 45); return; }
    call('piep', A.p2, 45);
    later(0.45, () => call('piep', lost));
    if (pull === 2) { later(0.2, () => call('wildzwijn', A.sow, 45)); later(0.85, () => call('piep', A.p3, 45)); }
  }

  /** 'voeren' at the stand (s1, HANDS): the lost piglet himself noses the bag on his hip,
   *  hungry, squeaks, looks up: hands still. A click on him is a hand with a crumb: he
   *  chews it and wriggles closer for more, and the moment comes back. Held: he gives up
   *  on the bag and flops down at his feet. */
  async function voerenPiglet(): Promise<void> {
    const r = k.ranger();
    const view = bagView(r, { x: lost.x, z: lost.z });
    // the fronds of the stand between the lens and the piglet at his bag give way, calmly
    // (as at aaien): he is seen whole at the bag, never behind a frond (berk's lens looks
    // back at him from inside the stand)
    const nosing = toward(r, lost, BAG_REACH);
    const eye = k.lensFor(view).cam;
    const body = backPoints(nosing.x, k.ctx.groundY(nosing.x, nosing.z), nosing.z, headingTo(lost, r), lying * 2.7, heightFor('frisling') * 0.8);
    const drawn = home.cover.stems.map((st) => st.h);
    const more = openWindow(home.cover.stems, eye, body, VOEREN_SHOWS);
    if (more.length) home.cover.settle(more, 0.8, drawn);
    k.stats.voeren_visible = Math.round(visibleShare(body, eye, home.cover.stems) * 100) / 100;
    k.beat = 'voeren:frame';
    await k.frame(view);
    let reach = BAG_REACH; // (his snout at the bag on his hip)
    const nose = (secs = 60): Promise<boolean> => { const rr = k.ranger(); return lost.sniff(rr.x, rr.z, secs, reach); };
    void nose();
    let tempts = 0;
    await rust.still('voeren', {
      line: c.eten, hands: () => lost.body,
      show: () => call('piep', lost),
      // the hand wants to go, each time a little more: he squeaks and sniffs at the bag;
      // then he looks up at him and squeaks; then he shuffles half a step nearer and
      // nudges the bag with his snout (across the side lens's picture)
      tempt: () => {
        const pull = tempted('voeren', tempts++);
        call('piep', lost);
        if (pull === 0) { if (settings.geluid) Sound.sniff(); }
        else if (pull === 1) void lost.lookAt(me, 0.8).then((ok) => { if (ok) void nose(); });
        else { reach = Math.max(0.42, reach - 0.12); void nose(); }
      },
      // a hand with a crumb: he chews it, squeaks for more, wriggles closer, eager
      wrong: async () => {
        tempts = 0;
        if (settings.geluid) Sound.sniff();
        call('piep', lost);
        reach = 0.42;
        await nose(1.6);
        call('piep', lost);
        void nose();
      },
      // no food: he gives up on the bag and flops down at his feet
      right: async () => { lost.idle(); await lost.lie(true); await k.wait(0.8); },
    });
  }

  /** 'voeren' at the field (s2, HANDS): the yearling trots out from the wallow (round the
   *  log) and noses his bag, grunting, never nearer than 1.2 m: hands still. A click is a
   *  hand with a biscuit: it chews, grunts for more and shuffles closer; the moment comes
   *  back. Held: it loses interest and trots back to its family. */
  async function voerenYearling(): Promise<void> {
    const yearling = A.yearling;
    const yHome = layout.yearling;
    const r = k.ranger();
    const from = { x: yearling.x, z: yearling.z };
    const toY = headingTo(r, from);
    const side = yearlingSideOf(r, from); // beside him, never at the lens
    k.beat = 'voeren:frame';
    await k.frame({
      at: toward(r, from, 2.4), heading: toY - 0.32, halfW: 2.6, halfD: 2.3, tall: 0.95, pitchDeg: 28, insetTop: 96, insetBottom: 290,
      include: [{ x: r.x, z: r.z, h: 1.32 }, { x: side.x, z: side.z, h: 0.62 }],
    }, { face: toY });
    k.say(c.komt);
    k.beat = 'field:yearling';
    for (const p of yearlingWay(way, from, side)) await yearling.go(p.x, p.z, { speed: 1.1 });
    await yearling.go(side.x, side.z, { speed: 1.1, face: headingTo(side, r) });
    let reach = 1.4;
    const nose = (secs = 60): Promise<boolean> => { const rr = k.ranger(); return yearling.sniff(rr.x, rr.z, secs, reach); };
    void nose();
    let tempts = 0;
    await rust.still('voeren', {
      line: c.eten, hands: () => yearling.body,
      show: () => call('knor-blij', yearling),
      // the hand wants to go, each time a little more: he grunts and sniffs at the bag; then
      // he looks up at him; then he shuffles half a step nearer (never under 1.2 m)
      tempt: () => {
        const pull = tempted('voeren', tempts++);
        call('knor-blij', yearling);
        if (pull === 0) { if (settings.geluid) Sound.sniff(); }
        else if (pull === 1) void yearling.lookAt(me, 0.9).then((ok) => { if (ok) void nose(); });
        else { reach = Math.max(1.22, reach - 0.12); void nose(); }
      },
      // a hand with a biscuit: he chews it, grunts for more, shuffles closer, eager
      wrong: async () => {
        tempts = 0;
        if (settings.geluid) Sound.sniff();
        call('knor-blij', yearling);
        reach = 1.22;
        await nose(1.6);
        call('knor-blij', yearling);
        void nose();
      },
      // no food: he loses interest and trots back to his family (round the log), and roots
      right: async () => {
        const now = { x: yearling.x, z: yearling.z };
        for (const p of yearlingWay(way, now, yHome)) await yearling.go(p.x, p.z, { speed: 'trot' });
        await yearling.go(yHome.x, yHome.z, { speed: 'trot' });
        atHome(yearling, yHome);
      },
    });
  }

  /** 'zeug' (FEET still): the sow lifts her head and comes out of the mud to its rim, between
   *  her piglets and him (a step or two, across the side lens's picture, never at it), and
   *  looks at him — big enough to read. A step toward them: a firm grunt, she stamps half a
   *  step nearer (never within 2.8 m), and the moment comes back. Held: she lowers her head
   *  and goes back to her place. */
  async function zeug(id: string): Promise<void> {
    const sow = A.sow;
    const sowHome = { x: sow.x, z: sow.z };
    const zt = k.ranger();
    const stare = zeugStare(sowHome, zt);
    const side = fieldClutter(zeugView(zt, stare, -1)) <= fieldClutter(zeugView(zt, stare, 1)) ? -1 : 1;
    k.beat = 'zeug:frame';
    call('wildzwijn', sow);
    const came = sow.go(stare.x, stare.z, { speed: 'walk', face: headingTo(stare, zt) });
    const view = zeugView(zt, stare, side);
    await k.frame(view);
    await k.until(() => sow.doing !== 'go', 4);
    void came;
    k.stats.zeug_px_m = Math.round(dist(stare, zt) * 10) / 10;
    // the piglet by her side that tempts him (the nearest to where she stands)
    const pig = [A.p1, A.p2, A.p3].sort((a, b) => dist(a, stare) - dist(b, stare))[0];
    let tempts = 0;
    await rust.still(id, {
      line: c.staStil, feet: true,
      show: () => { void sow.lookAt(me); call('wildzwijn', sow); },
      // the step toward them wants to go, each time a little more: a piglet squeaks by her
      // side; then it lifts its head and looks at him; then it trots half a step out toward
      // him (across the side lens's picture, never at it) and back to its mother. She
      // keeps watching him all the while.
      tempt: () => {
        const pull = tempted('zeug', tempts++);
        call('piep', pig);
        void sow.lookAt(me);
        if (pull === 1) void pig.lookAt(me, 1.6).then((ok) => { if (ok) pig.root(pig.x, pig.z, 0.4); });
        else if (pull === 2) void peek();
      },
      // a step toward her piglets: a firm grunt, half a step nearer, a stamp
      wrong: async () => {
        tempts = 0;
        call('wildzwijn', sow);
        const r = k.ranger();
        const nearer = toward(sow, r, Math.max(0, Math.min(0.5, dist(sow, r) - 2.8)));
        await sow.go(nearer.x, nearer.z, { speed: 'walk', face: headingTo(nearer, r) });
        await k.wait(0.6);
        void sow.lookAt(me);
      },
      // he stood still: she lowers her head and goes back to what she was doing
      right: async () => { await sow.go(sowHome.x, sowHome.z, { speed: 'walk', face: layout.sow.yaw }); atHome(sow, { ...layout.sow, ...sowHome }); },
    });
    /** The strongest pull: the piglet trots half a step out toward him, squeaks, looks at
     *  him, and walks back to root at its place (anything else that takes it over ends it). */
    async function peek(): Promise<void> {
      const from = { x: pig.x, z: pig.z };
      const to = stepAcross(from, zt, view.heading, 0.45);
      if (!(await pig.go(to.x, to.z, { speed: 'trot', face: headingTo(to, zt) }))) return;
      call('piep', pig);
      if (!(await pig.lookAt(me, 1.2))) return;
      if (await pig.go(from.x, from.z, { speed: 'walk' })) pig.root(from.x, from.z, 0.4);
    }
  }

  /**
   * 'pad' (the flip, WALK ON): the path is free. He turns the way on past the mud (the lens
   * comes round behind him) and "Het pad is vrij. Loop maar.": walking on `WALK_ON_M` along
   * it within the level's `goWaitS` (from the end of the line's read), or having set off
   * along it when that closes, is right; still STANDING when it closes is the stay-habit
   * kept too long (`WalkOnCore`): the group shuffles on, "Je wacht te lang.", and the
   * moment comes back (his steps before still count). The piglet
   * trots at his side; the chip names the way, its arrow soon.
   */
  async function pad(id: string): Promise<void> {
    k.beat = 'go:pad';
    const on = walkOnSpot(way, k.ranger());
    // he turns that way with a small step (never a snap), the lens comes round behind him
    const step = toward(k.ranger(), on, 0.3);
    await k.walkRanger(step.x, step.z, 0.05);
    await k.behind();
    const knobs = k.knobs('dagnacht');
    const d0 = dist(k.ranger(), on);
    const core = new WalkOnCore(knobs.goWaitS, (g) => rust.answer(id, g), Math.min(WALK_ON_M, d0 - 0.7));
    k.stats.pad_wait_s = knobs.goWaitS;
    k.stats.pad_late = 0;
    k.stats.pad_again = 0;
    const family = [A.sow, A.p1, A.p2, A.p3, A.yearling];
    let read = false, reacting = false, praised = false, shuffles = 0;
    const readLine = (): void => { read = false; void readOut(c.padVrij).then(() => { read = true; }, () => {}); };
    // he waited too long: the group shuffles on a little (away from him, then back) and
    // roots again, the words for it, and the same moment
    const late = async (): Promise<void> => {
      k.stats.pad_late = core.impulses;
      if (settings.geluid) Sound.tryAgain();
      const away = dirOf(headingTo(k.ranger(), P.wallow));
      const sgn = shuffles++ % 2 ? -1 : 1;
      await Promise.all(family.map((a) => a.go(a.x + away.x * 0.9 * sgn, a.z + away.z * 0.9 * sgn, { speed: 'walk' })));
      for (const a of family) a.root(a.x, a.z, 0.4);
      k.say(c.teLang);
      await readOut(c.teLang, 1.6);
      core.again();
      // (the moment is back: counted, so a reader need not catch its words in the second
      // before a child who walks on at once hears the good ones)
      k.stats.pad_again = core.impulses;
      k.say(c.padVrij);
      readLine();
      reacting = false;
    };
    const judge = (): void => {
      if (reacting) return;
      if (core.phase === 'read' && read) core.begin(k.now);
      const res = core.tick(k.now, d0 - dist(k.ranger(), on));
      if (res === 'late') { reacting = true; void late().catch(() => {}); }
      else if (res === 'went' && !praised) {
        praised = true;
        if (settings.geluid) Sound.correct();
        k.say(uitlegOf(id), { good: true });
      }
    };
    readLine();
    const walk = k.walk({
      name: 'pad', to: on, r: 0.6, line: c.padVrij, doel: c.chipPad, glyph: 'boot', lead,
      arrowAfter: knobs.goWaitS / 2, tick: judge,
    });
    k.beat = 'go:pad'; // (a calm moment, not a walk: a discovery's reveal waits)
    await walk;
    // (there while the group reacted: judged as soon as the line is back)
    if (core.phase !== 'went') await k.until(() => { judge(); return core.phase === 'went'; });
    k.lockFollow();
    k.world.stopRanger();
    await readOut(uitlegOf(id), 1.2);
    // room for the family: the piglet beside him, watching them; he turns to the mud
    const left2 = atLocal({ x: on.x, z: on.z, heading: headingTo(on, P.wallow) }, -1.1, 0.35);
    void lost.go(left2.x, left2.z, { speed: 'walk', face: headingTo(left2, P.wallow) });
    k.world.faceRanger(headingTo(k.ranger(), P.wallow));
  }
}

/** The length of a way through `pts` (m). */
function pathLength(pts: readonly Spot[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i]);
  return n;
}

/** The spot `d` m along a way through `pts` (its end, if the way is shorter). */
function pointAlong(pts: readonly Spot[], d: number): Spot {
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (d <= l) return toward(pts[i - 1], pts[i], d);
    d -= l;
  }
  const e = pts[pts.length - 1];
  return { x: e.x, z: e.z };
}

/** The part of a way through `pts` from `a` m along it to `b` m (its end, if shorter). */
function sliceAlong(pts: readonly Spot[], a: number, b: number): Spot[] {
  const out: Spot[] = [pointAlong(pts, a)];
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += dist(pts[i - 1], pts[i]);
    if (d > a + 1e-6 && d < b - 1e-6) out.push({ x: pts[i].x, z: pts[i].z });
  }
  const end = pointAlong(pts, Math.min(b, pathLength(pts)));
  if (dist(out[out.length - 1], end) > 1e-6) out.push(end);
  return out;
}

/**
 * The walk-round on `steen` (unmeasured, design §5.5): while he follows the squeak past
 * the family, coming within `SOW_NOTICE_M` of the sow makes her lift her head and watch him
 * go (once per approach, with a soft grunt and one line); she never moves toward him or the
 * lens. Once he is well away from her again the walk-round's line comes back, and once he
 * is past them the follow's own. Nothing is logged.
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
      if (!past) k.say(k.copy.boog); // (he gave her room: the way round them again)
    }
    if (!past && dist(m, P.wallow) > 10 && m.z < -31) { past = true; k.say(k.copy.volg); }
  };
}

const _ndc = new THREE.Vector3();
/** A world point in the lens's picture (normalised: x, y in −1…1 on screen, z in −1…1 in
 *  front of it). */
function ndcOf(cam: THREE.Camera, x: number, y: number, z: number): THREE.Vector3 {
  return _ndc.set(x, y, z).project(cam);
}
/** Is a projected point in the picture: in front of the lens, |x| ≤ `xr`, `y0` ≤ y ≤ `y1`? */
function inPicture(q: THREE.Vector3, xr: number, y0: number, y1: number): boolean {
  return q.z > -1 && q.z < 1 && Math.abs(q.x) <= xr && q.y >= y0 && q.y <= y1;
}
