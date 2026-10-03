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
} from './frisling.places';
import { drawFrisling, frislingVariant, recentPlays, type FrislingVariant, type PastPlay } from './frisling.vary';

/** How far the lost piglet's squeak carries while he follows it (m): from the ring to
 *  any way's stand, ~35-38 m (softly at first, louder as he comes). */
const FOLLOW_REACH = 46;
/** His careful walk while he leads the piglet home (m/s): the piglet's own calm trot,
 *  so they stay together (a brisk walk is 2.2 m/s; running is still his to choose). */
const LEAD_PACE = 1.5;
/** The first prints from the ring: crisp, so where the trail starts reads at once. */
const CRISP_PRINTS = 4;
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
  k.own(spoorPath(trail, k.ctx.groundY, { opacity: 0.35 + 0.5 * knobs.trailClarity, size: 0.62, spacing: 0.95, crisp: CRISP_PRINTS }).group);
  fam.voice('lost', true, FOLLOW_REACH);
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
    await rust.still(e.id, {
      line: c.raakNiet, mis: c.schrok, hands: () => lost.body,
      // he lies squeaking; a moment in, he peeks at him and squeaks again (the hand wants to go)
      show: () => call('piep', lost),
      tempt: () => { call('piep', lost); void lost.lookAt(me, 1.6); },
      // a hand reaches for him: he scoots aside through the bracken, lies flat, peeks out
      wrong: async () => {
        call('piep', lost);
        const to = aside(reaches++);
        await lost.go(to.x, to.z, { speed: 'trot', face: lost.yaw });
        await lost.lie(true);
        // he peeks out where he lies now: the fronds over him part (and stay parted)
        showHim(to);
        await k.wait(0.9);
        await lost.lookAt(me, 1.2);
      },
    });
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
    const len = paceStretch(k.knobs('dagnacht').holdS, lead0);
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

  /** A woodlark sits in the heather at `spot` on his way; when he comes within 3 m it flies
   *  up singing its soft falling "lu-lu-lu", ahead of him (never toward the lens), settles
   *  15-20 m on and drops into the heather, gone (it never sits in the search's picture as
   *  one more bird to click). Seen in flight = discovered. */
  async function woodlark(spot: Spot): Promise<void> {
    const b = await spawnBird(k, 'bird-boomleeuwerik', 0.3);
    if (!b) return;
    birds.push(b);
    scene.add(b.root);
    const f = k.play.fork('leeuwerik-vlucht');
    b.root.position.set(spot.x, k.ctx.groundY(spot.x, spot.z), spot.z);
    b.root.rotation.y = f.between(0, Math.PI * 2);
    b.root.visible = true;
    let flying = false;
    let step: ((dt: number) => boolean) | null = null;
    let sits = -1; // (s it sits on the heather after landing, before it drops in)
    finds.watch({ id: 'frisling.leeuwerik', object: () => (flying ? b.root : null), within: 30 });
    const off = k.onTick((dt) => {
      if (!flying) {
        // (on his walks only: never in a calm moment or a picture held still)
        if (dist(k.ranger(), spot) > 4 || !k.beat.startsWith('walk:')) return;
        flying = true;
        k.stats.leeuwerik = 1;
        if (settings.geluid) Sound.callAt('boomleeuwerik', spot.x, spot.z, listener(), 30);
        const m = k.ranger();
        const h = m.heading + f.between(-0.6, 0.6);
        const to = { x: spot.x + Math.sin(h) * f.between(15, 20), z: spot.z + Math.cos(h) * f.between(15, 20) };
        step = flight(k, b.root, { ...spot, y: 0 }, { ...to, y: 0 }, 3.4, 4.2);
        return;
      }
      if (step && step(dt)) { step = null; sits = 0.8; }
      else if (sits > 0 && (sits -= dt) <= 0) { b.root.visible = false; off(); }
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
    const knobs = k.knobs('dagnacht');
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
      const len = paceStretch(knobs.holdS, rest);
      const whole = len >= rest - 0.6; // (the rest of the way: it ends where the walk ends)
      const end: Place = whole ? last : { ...pointAlong(path, len + 0.9), r: 0.9 };
      k.stats.pace_len = Math.round(len * 10) / 10;
      const marks = paceTempts(len, knobs, fork.rng);
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
            if (core.run()) { k.stats.pace_dragen = core.impulses; if (settings.geluid) Sound.tryAgain(); }
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
          // the family grunts ahead, a sibling squeaks: hurry? (never while he hides)
          while (mi < marks.length && walked >= marks[mi]) {
            if (mi++ % 2 === 0) call('wildzwijn', A.sow, 45); else call('piep', A.p2, 45);
          }
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
    await rust.still('voeren', {
      line: c.eten, hands: () => lost.body,
      show: () => call('piep', lost),
      // he looks up at him, squeaks, and noses a little closer
      tempt: () => {
        call('piep', lost);
        reach = Math.max(0.42, reach - 0.05);
        void lost.lookAt(me, 0.8).then((ok) => { if (ok) void nose(); });
      },
      // a hand with a crumb: he chews it, squeaks for more, wriggles closer, eager
      wrong: async () => {
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
    await rust.still('voeren', {
      line: c.eten, hands: () => yearling.body,
      show: () => call('knor-blij', yearling),
      // he grunts, looks up at him, and shuffles a little closer (never under 1.2 m)
      tempt: () => {
        call('knor-blij', yearling);
        reach = Math.max(1.22, reach - 0.08);
        void yearling.lookAt(me, 0.9).then((ok) => { if (ok) void nose(); });
      },
      // a hand with a biscuit: he chews it, grunts for more, shuffles closer, eager
      wrong: async () => {
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
    await k.frame(zeugView(zt, stare, side));
    await k.until(() => sow.doing !== 'go', 4);
    void came;
    k.stats.zeug_px_m = Math.round(dist(stare, zt) * 10) / 10;
    await rust.still(id, {
      line: c.staStil, feet: true,
      show: () => { void sow.lookAt(me); call('wildzwijn', sow); },
      // a piglet squeaks by her side (the step toward them wants to go); she keeps watching
      tempt: () => { call('piep', A.p2); void sow.lookAt(me); },
      // a step toward her piglets: a firm grunt, half a step nearer, a stamp
      wrong: async () => {
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
  }

  /**
   * 'pad' (the flip, WALK ON): the path is free. He turns the way on past the mud (the lens
   * comes round behind him) and "Het pad is vrij. Loop maar.": walking on `WALK_ON_M` along
   * it within the level's `goWaitS` (from the end of the line's read) is right; standing
   * past it is the stay-habit kept too long (`WalkOnCore`): the group shuffles on, "Je
   * wacht te lang.", and the moment comes back (his steps before still count). The piglet
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
