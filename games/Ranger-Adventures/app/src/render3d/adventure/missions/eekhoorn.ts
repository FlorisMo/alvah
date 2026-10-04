/**
 * eekhoorn.ts — "De verstopte nootjes" as an adventure in the world (design run6 §4.4,
 * run 7 `state/eekhoorn/design.md`).
 *
 * The squirrel lives on its pine right by the marker: it runs down and round the trunk,
 * forages at its foot, sits on a branch stub, and chatters at the ranger when he comes
 * near. Once the mission starts the lens turns to it for one calm look (the child meets
 * it on its stub), then it takes him to its glade — every play another way through its
 * pines (run 7: along the middle, round to the left, up the right): tree to tree it waits
 * for him on a low stub beside the trunk, leaps between close pines (always starting where
 * he sees it), and at its last pine it plays hide-and-seek round the trunk until he walks
 * round and finds it; then the lens holds the two of them close while it peeks out at
 * him. In its glade it takes acorns from its store and buries them in the moss at spot
 * after spot, runs back to its stump — and forgets where (CORSI: he points the spots out
 * in order; it dashes to each and digs the acorn up; a wrong spot, it sniffs and finds
 * nothing, and the spots glow again). Two mouthfuls: between them it sweeps up the found
 * acorns in one quick run to its store. Then its three neighbours of the day (drawn per
 * play) are met one by one, the jay (the nut thief) glides down for the store, and the
 * neighbours and the squirrel call: he calls them back (SIMON), the echo growing round by
 * round, and after every echo he gets right the jay backs off a step, until it flies off.
 * The squirrel sits on its stump and eats an acorn. Afterwards the store stays, the
 * squirrel lives in the pine by it, and a later visit finds an oak seedling where a
 * forgotten acorn grew.
 *
 * Steps (content, the EF contract): 0 corsi · 1 simon, each logged once. Every choice of
 * a play comes from its own fork of `k.play` (never the page's own random).
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import { clearPlayHint, pick3d } from '../../play/kit';
import type { Adventure } from '../registry';
import type { ResidentGroup, Residents } from '../../world/Residents';
import type { Play } from '../../../core/play';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { listenerOf } from '../../world/Residents';
import { routeBeat } from '../beats/route';
import { callersBeat, type Caller } from '../beats/callers';
import { CALL_GLOW, WarmGlow } from '../beats/callers-glow';
import { Squirrel, type SquirrelTree } from '../squirrel';
import { barkRadius, lineClear, patPlan, trunkFadeUpright, trunkPose, trunkUpright, wrap, type Upright } from '../squirrel-math';
import { dist, headingTo } from '../places';
import type { Spot } from '../types';
import { TREE_BASE_H } from '../../world/Forest';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale';
import { EekhoornHome, homeTreeNear, pictureOf, type Neighbour } from './eekhoorn.home';
import {
  CALLERS_VIEW, EEKHOORN_HOME, EEKHOORN_PLACES as P, FIND_R, GLADE_VIEW, HEAP, HEAP_GRAB, AT_IT, HIDE, HOME_TREES, ROUTES, RUN_ON_WAIT, RUN_ON_X, SEAT_STOP, SEE_D, SEEN_X, STUMP,
  VARIANT_KEY, WATCH_R, branchStub, comesFrom, drawEekhoornPlay, eekhoornClearings, eekhoornTreeClear, foundFace, foundStand, foundView, hideShift, hideStart, introView,
  jayStep, lastVariants, roundStep, seatOf, slipSecs, variantOf, watchSpot, wayTo, type EekhoornPlay, type HomeTree, type Route,
  DEN_VISITOR, DINING_SEE, NEST, NEST_SEE, NEST_WATCH, SeenClock, YOUNG, denVisitor, nestPeek, nestTrees, nestWatch, youngPeek,
  ANTICS, DEN_KINDS, DEN_DAY, denSpot, EINDES, BURY_AT, SECOND_HIDE, coneDrop, jayFliesAway, hide2Stand, foundRun, JAY_SEE,
} from './eekhoorn.places';
import { ontdekking } from '../../../content/ontdekkingen';

/** The squirrel's size (m, sitting up with its tail curled over its back): a little over
 *  the upper end of a red squirrel (≈ 0.3), so a child reads it on a trunk a few metres
 *  off — through the follow lens 4.6 m behind him, ≥ 40 px as it sets off from a stub he
 *  stands 1.4 m from (measured 2026-10-03: at 0.3 m it was 35-38 px there). */
const SQUIRREL_H = 0.33;
/** At each stop of the follow it sits up on its stub at least this long (s) before it runs
 *  on — then a chatter and a flick (~1 s): a clear "it waits for me", even at a run. */
const SIT = 1.2;
/** Within SEE_D of him and in his view, it waits until it reads at least this share of
 *  his picture's height (42 px at 1280×800: the design's 40 with a little room) — he is
 *  walking up to it, a step closer is enough — but never longer than SET_OFF_WAIT s more,
 *  so it always runs on. Within SEE_D alone it could set off at 39 px (the lead's play,
 *  2026-10-03: the middle way's first wait); waiting for the size alone held two of four
 *  scripted sessions for minutes at the middle way's last pine, where it sits smaller on
 *  arrival (31-35 px), on a heavily loaded laptop (2026-10-03). */
const SET_OFF_H = 42 / 800;
const SET_OFF_WAIT = 2;
/** The squirrel's own visits to its caching spots (each round's first show): the dash
 *  (straight, at its full run), the dig, the breath before the next (design §6.4: ≤ 2 s a
 *  spot — the 2D floor shows one in 1.15 s; replays and eases are its timings). */
const VISIT = { dig: 0.65, gap: 0.12 } as const;
/** On a pine it only passes, it waits at most this long (s) for him to turn to it before it
 *  leaps on (the way on shows after RUN_ON_WAIT + 2 s, turning him toward it). */
const PASS_WAIT = 9;
/** Its nest (run 7): it peeks out once he has seen the nest (NEST_SEE: big enough in his
 *  picture for a moment, the threshold the places test pins from the spot to see it from) —
 *  or, once he has stood still right under it (NEST_WATCH.under) `nearWait` s, or `wait` s
 *  on in all, it comes out all the same and says nothing of a nest he did not see. While it waits
 *  in its nest the way on is to the spot to see it from (nestWatch), then a step that turns
 *  him to it — and he stands there while it peeks out and its line plays (played
 *  2026-10-04: walked on to the nest's foot, or away to the stub's watch spot while the line
 *  played, the moment was lost in 2 of 9 plays). */
const NEST_PEEK = { wait: 16, nearWait: 4 } as const;
/** Its sweep after a round: each acorn dug up in a quick bob (s). */
const SWEEP_DIG = 0.25;
/** Each neighbour's call in the echo game is held to this snippet (s): a blackbird's long
 *  song and a great tit's short pump give the same listening tempo, whoever came today. */
const CALL_CAP: readonly [number, number] = [0.6, 1.2];
/** The jay's own cache (run 7, ek-day): it acts in its window (eekhoorn.places JAY_SEE).
 *  The drum roll comes once he is within DRUM_NEAR m of the bird on the store pine's bark
 *  (it is awake and in sight from there). */
const DRUM_NEAR = 11;
/** The second hide (run 7, ek-day): a short one — it slips round at most `most` times, and
 *  stays once he has walked `round` rad round its pine. */
const HIDE2 = { most: 1, round: HIDE.round * 0.6 } as const;
/** Its antic at a wait (run 7, ek-day): `first` s after it sits down (wherever he is) it
 *  plays its antic, and again `again` s after the last one while he is still further than
 *  `near` m off; when he has come close (the wait's own rule) it finishes the one it is in,
 *  `grace` s more at most, sits up facing him and runs on. Lying in the sun it lies along
 *  its stub, turned `lie` rad from the way the stub points. */
const ANTIC = { first: 0.25, again: 2.2, near: SEE_D + 0.2, lie: 0, grace: 1.1 } as const;
/** He has stood right by it (within SEE_D + 0.6 m) this long (s): it runs on, whatever the
 *  lens shows of it (ek-finds review: a wait that never finished). */
const BY_WAIT = 5;

/** This play's day, drawn and laid under the briefing card (`prepare`). */
let drawn: { seed: number; p: EekhoornPlay } | null = null;

/** Draw this play (from its seed and the squirrel's last play) and lay it in its home:
 *  the caching pattern, the neighbours, the small things' stream, the squirrel's day. */
function lay(world: { residents: Residents }, play: Play): EekhoornPlay | null {
  const home = world.residents.dressing('eekhoorn') as EekhoornHome | null;
  if (!home) return null;
  const v = play.variant;
  const p = drawEekhoornPlay(play, lastVariants(store.get().geschiedenis, 2), { mood: typeof v.mood === 'string' ? v.mood : undefined, rare: typeof v.rare === 'string' ? v.rare : null });
  // (its way, pattern, trio — and its day, folded in: the next play draws against it)
  play.note(VARIANT_KEY, variantOf(p));
  // (its finds: which of the way's trees carries its nest, where its gnawed cones lie)
  play.note('nest', nestTrees(ROUTES[p.route])[p.nest].id);
  play.note('kegels', p.kegels);
  // (its day, each choice by name: design §6.8)
  play.note('den', p.day.den);
  play.note('antics', p.day.antics.join('+'));
  play.note('verrassing', p.day.verrassing);
  play.note('verstop2', p.day.verstop2 ? 1 : 0);
  play.note('einde', p.day.einde);
  home.layPlay(p, { cosmetic: play.fork('cosmetic').rng, squirrel: play.fork('squirrel').int(1, 0x7fffffff) });
  drawn = { seed: play.seed, p };
  return p;
}

export const eekhoornAdventure: Adventure = {
  id: 'eekhoorn',
  home: EEKHOORN_HOME,
  clearings: eekhoornClearings(),
  // the forest draws them, each with its branch stub (it fades with its tree); only the
  // trees it plays round now in full detail, the rest as the forest's simple copy, also
  // see-through (eekhoorn.home `homeTreeNear`: eleven pines round one spot keep the budget)
  trees: HOME_TREES.map((t) => ({ x: t.x, z: t.z, s: t.h / TREE_BASE_H[t.species], rotY: t.rotY, species: t.species, stub: branchStub(t), near: () => homeTreeNear(t.id) })),
  treeClearings: eekhoornTreeClear(),
  dressing: (env) => new EekhoornHome(env),
  // a new light each play (design §6.6): a misty morning, a bright day, an overcast one,
  // the golden hour — never dusk (a red squirrel is in its drey by then); never the light
  // of either of the last two plays here, so three plays in a row are three lights
  moods: { allow: ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt'], perPlay: 2 },
  actor: (spec, env, _height, dressing) => {
    if (spec.key !== 'squirrel' || !(dressing instanceof EekhoornHome)) return null;
    const sq = new Squirrel(spec.key, env, { height: SQUIRREL_H, trees: dressing.trees, seed: 11 });
    sq.stumps.push({ x: STUMP.x, z: STUMP.z, top: STUMP.top, r: STUMP.r });
    sq.onDig = (x, z) => dressing.puffAt(x, z, env.reduced());
    sq.onScale = (x, y, z) => dressing.scaleAt(x, y, z, env.reduced());
    dressing.squirrel = sq;
    dressing.actorEnv = env; // (a play's rare visitor is made the same way)
    return sq;
  },
  prepare(world, _mission, play) {
    // a replay: the store is small again and the jay back on its stub (under the card)
    (world.residents.dressing('eekhoorn') as EekhoornHome | null)?.setState(world.residents.state('eekhoorn') ?? 'before');
    lay(world, play);
  },

  async play(k: AdventureKit): Promise<void> {
    // the day laid under the card (or, when there was none, laid now)
    const p = drawn && drawn.seed === k.play.seed ? drawn.p : lay(k.world, k.play);
    if (!p) throw new Error('[eekhoorn] no home');
    const fam = k.borrow();
    const home = fam.dressing as EekhoornHome;
    const sq = fam.actors.squirrel as Squirrel;
    sq.lensAt = () => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });
    sq.rangerAt = () => k.ranger();
    fam.voice('squirrel', false); // (the adventure chatters itself now)
    // (they stay set: running home after a stop it goes round the lens and the ranger too)
    await story(k, fam, home, sq, p);
  },
};

/** Who lives round the store (beat 4): he clicks each neighbour; it lights up, hops, calls
 *  and its name is said. Any order; one after another (a click while one is talking waits
 *  its turn). Resolves once he has met all three. */
async function meetNeighbours(k: AdventureKit, home: EekhoornHome, geluid: boolean): Promise<void> {
  const c = k.copy;
  const names: Record<string, string> = {
    gaai: c.isGaai, 'groene-specht': c.isSpecht, raaf: c.isRaaf, koolmees: c.isKoolmees, merel: c.isMerel, roodborst: c.isRoodborst,
    'grote-bonte-specht': c.isBonteSpecht, boomklever: c.isBoomklever, koekoek: c.isKoekoek,
  };
  const birds = home.neighbours;
  const left = new Set<string>(birds.map((n) => n.id));
  const glows = new Map<string, WarmGlow>(birds.filter((n) => n.body).map((n) => [n.id, new WarmGlow(n.body!)]));
  let busy = false;
  k.say(c.wieWonen);
  let finished!: () => void;
  const done = new Promise<void>((r) => { finished = r; });
  const onPick = (id: string): void => {
    const n = birds.find((q) => q.id === id);
    if (!n || busy) return;
    busy = true;
    left.delete(id);
    glows.get(id)?.set(CALL_GLOW);
    n.call();
    k.say(names[n.id] ?? null);
    // into his veldgids, quietly: this meeting (its light, its call, its name) is its moment —
    // the home's own row, or the open wood's where it is a bird of the whole wood
    const row = ontdekking(`eekhoorn.${n.id}`) ?? ontdekking(`wereld.${n.id}`);
    if (row) k.discover(row.id, { quiet: true });
    if (geluid) Sound.callAt(n.id, n.at.x, n.at.z, listenerOf(k.world.camera), 25, CALL_CAP[1]);
    void k.wait(Math.max(1.6, Sound.callDur(n.id, CALL_CAP[1]) + 0.4)).then(() => {
      glows.get(id)?.set(0);
      busy = false;
      if (!left.size) finished();
    }).catch(() => {});
  };
  const unhint = k.hint(() => {
    if (busy) return null;
    const n = birds.find((q) => left.has(q.id));
    return n ? { id: `buur:${n.id}`, target: n.body ?? n.object } : null;
  });
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets: birds.map((n) => ({ id: n.id, object: n.object })), onPick, signal: k.signal,
  });
  try {
    await k.guard(done);
  } finally {
    teardown();
    unhint();
    clearPlayHint();
    for (const g of glows.values()) g.clear();
  }
  await k.wait(0.6);
}

/** Where the squirrel is to the player, right now, through the live lens: `seen` = at
 *  least half of its body (a dozen points on its head and trunk, each a line of sight
 *  from the lens) in front of the lens, well inside the picture (not at its edge, under
 *  the line card at the top) and not hidden by a trunk of its home (one the camera fades
 *  because it stands between the lens and him hides nothing) or by his own body;
 *  `glimpse` = a bit of it shows anywhere in the picture; `px` = how tall it is on the
 *  screen, tail and ears and all; `x` = where its middle is across the picture (−1 the
 *  left edge … 1 the right).
 *  The mode: 'see' (finding it) counts a trunk out to its ridged outline, so a squirrel
 *  is found only once it is truly in view. 'near': he is right at it, under it — his own
 *  head in front of it in the lens hides nothing from HIM, and a trunk hides it only
 *  behind its bark (a squirrel on its stub at the very edge of its trunk in the picture
 *  shows past the ridged outline, played 2026-10-01). 'peek' (while it HIDES): a trunk
 *  hides it only behind its bark and the picture's very edge counts — any of it that
 *  could show sends it round the bark (played 2026-10-01: by the ridged outline a
 *  squirrel sitting 80 px tall beside the near trunk, at the screen's left edge, was
 *  "hidden", and 'Waar is hij?' asked for a squirrel in plain view). */
interface Sight { seen: boolean; glimpse: boolean; px: number; x: number }
type SightMode = 'see' | 'near' | 'peek';

const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const V3 = new THREE.Vector3();
const V4 = new THREE.Vector3();
const BOX = new THREE.Box3();
function sightOf(k: AdventureKit, sq: Squirrel, trees: readonly SquirrelTree[], mode: SightMode = 'see'): Sight {
  const pts = sq.bodyPoints();
  const cam = k.world.camera as THREE.PerspectiveCamera;
  if (!pts.length || !sq.body || !sq.group.visible) return { seen: false, glimpse: false, px: 0, x: 9 };
  const h = k.ctx.canvas.clientHeight || 800;
  cam.updateMatrixWorld();
  const me = k.ranger();
  const g = k.ctx.groundY(me.x, me.z);
  // (a trunk between the lens and him is faded by the follow camera — world/CameraRig,
  // his head or his chest behind it — and he is seen through it: so is the squirrel)
  const head = V3.set(me.x, g + RANGER_STAND_HEIGHT, me.z), chest = V4.set(me.x, g + 0.9, me.z);
  const ups: Upright[] = trees.filter((t) => {
    const f = trunkFadeUpright(t.trunk, k.ctx.groundY(t.trunk.x, t.trunk.z)); // (the camera's own fade decision)
    return lineClear(cam.position, head, [f]) && lineClear(cam.position, chest, [f]);
  }).map((t) => {
    const ground = k.ctx.groundY(t.trunk.x, t.trunk.z);
    const u = trunkUpright(t.trunk, ground);
    return mode !== 'see' ? { ...u, r: (y: number) => barkRadius(t.trunk, Math.max(0, y - ground)) } : u;
  });
  if (mode !== 'near') ups.push({ x: me.x, z: me.z, y0: g - 0.2, y1: g + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 });
  const edge = mode === 'peek' ? 1 : 0.98;
  let open = 0, well = 0;
  for (const p of pts) {
    if (V1.copy(p).applyMatrix4(cam.matrixWorldInverse).z > -0.3) continue; // (behind the lens)
    const s = V1.copy(p).project(cam);
    const y = (1 - s.y) * 0.5 * h;
    if (Math.abs(s.x) > edge || y < 96 || y > h - (mode === 'peek' ? 0 : 8) || !lineClear(cam.position, p, ups)) continue;
    open += 1;
    if (Math.abs(s.x) <= SEEN_X && y >= 110 && y <= h - 70) well += 1;
  }
  BOX.setFromObject(sq.body);
  const c = BOX.getCenter(V2);
  const ahead = V1.copy(c).applyMatrix4(cam.matrixWorldInverse).z < -0.3;
  const x = ahead ? V1.copy(c).project(cam).x : 9;
  const px = Math.abs(V1.set(c.x, BOX.max.y, c.z).project(cam).y - V2.set(c.x, BOX.min.y, c.z).project(cam).y) * 0.5 * h;
  return { seen: well >= pts.length / 2, glimpse: open > 0, px, x };
}

/**
 * He SAW it (design §4.4, the home's finds): while `what` stands in his picture — at least
 * `px` tall (or `across` wide), inside the picture and under the line card, most of it clear
 * of the home's trunks (the ones the follow camera fades between the lens and him hide
 * nothing), within `within` m of him — a clock runs; after `secs` in a row it is his:
 * `k.discover(id)` once (a new one gets one calm reveal at the next quiet moment, `quiet`:
 * none). Never a prize: it only counts what was really in his picture. The stats keep how
 * big it was then (`seen_<stat>`). `off()` stops looking; `seen` says whether it was.
 */
function seenFor(k: AdventureKit, home: EekhoornHome, id: string, what: () => { box: THREE.Box3; pts: readonly THREE.Vector3[]; at?: Spot } | null,
  o: { px?: number; across?: number; secs?: number; within?: number; quiet?: boolean; stat: string }): { off(): void; readonly seen: boolean } {
  const clock = new SeenClock(o.secs ?? 1);
  let done = false;
  const off = k.onTick((dt) => {
    if (done) return;
    const t = what();
    let ok = false;
    if (t) {
      const me = k.ranger();
      const at = t.at ?? { x: (t.box.min.x + t.box.max.x) / 2, z: (t.box.min.z + t.box.max.z) / 2 };
      if (o.within === undefined || dist(me, at) <= o.within) {
        const cam = k.world.camera;
        const pic = pictureOf(cam, k.ctx.canvas.clientHeight || 800, k.ctx.canvas.clientWidth || 1280, t.box, t.pts, home.trunks(cam.position, me));
        ok = pic.inside && pic.clear >= 0.5 && (o.px === undefined || pic.px >= o.px) && (o.across === undefined || pic.across >= o.across);
        if (ok) k.stats[`seen_${o.stat}_px`] = Math.round(o.across !== undefined ? pic.across : pic.px);
      }
    }
    if (clock.step(dt, ok)) {
      done = true;
      k.stats[`seen_${o.stat}`] = 1;
      k.discover(id, { quiet: o.quiet });
      off();
    }
  });
  return { off: () => { done = true; off(); }, get seen() { return clock.seen; } };
}

/** What he sees of a squirrel (its body's box and a dozen points on it), or null. */
function squirrelSight(q: Squirrel): (() => { box: THREE.Box3; pts: readonly THREE.Vector3[] } | null) {
  return () => {
    if (!q.body || !q.group.visible) return null;
    const pts = q.bodyPoints();
    if (!pts.length) return null;
    return { box: new THREE.Box3().setFromObject(q.body), pts };
  };
}

/** A walk that ends on what he SEES (not where he stands) gets its own play hint for
 *  golden: a spot a perfect player walks to straight, with a real radius, read anew each
 *  time he gets there. It replaces the walk's own hint on the walk's first tick, under
 *  its own id (so a reader still holding the walk's own sees it change). */
function seeHint(k: AdventureKit, name: string, spot: () => Spot & { r?: number; tag?: string }): { tick(): void; off(): void } {
  let off: (() => void) | null = null;
  return {
    // (`tag`: a leg of its own — the nest's — under its own id, so a reader walking the last
    // leg sees it change at once)
    tick: () => { off ??= k.hint(() => { const s = spot(); return { id: `walk:${name}:${s.tag ?? 'see'}`, walk: { x: s.x, z: s.z, r: s.r ?? WATCH_R } }; }); },
    off: () => { off?.(); off = null; },
  };
}

/** The adventure, beat by beat. */
async function story(k: AdventureKit, fam: ResidentGroup, home: EekhoornHome, sq: Squirrel, p: EekhoornPlay): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const route: Route = ROUTES[p.route];
  /** the squirrel's own view of a home tree */
  const st = (t: HomeTree): SquirrelTree => home.trees[HOME_TREES.indexOf(t)];
  const oak = st(HOME_TREES[0]);
  const me = (): { x: number; z: number; speed: number } => { const m = k.ranger(); return { x: m.x, z: m.z, speed: m.speed }; };
  const faceMe = (from: { x: number; z: number }): number => headingTo(from, k.ranger());
  let lastChatter = -9;
  const chatter = (): void => {
    lastChatter = k.now;
    if (settings.geluid) Sound.callAt('eekhoorn', sq.x, sq.z, listenerOf(k.world.camera));
    sq.called();
  };
  void fam;
  const sight = (): Sight => sightOf(k, sq, home.trees);
  /** the stats a playtest reads (`__ranger.adventure().stats`): how tall it is now (px) */
  const measure = (): Sight => { const s = sight(); k.stats.sq_px = Math.round(s.px); k.stats.sq_seen = s.seen ? 1 : 0; return s; };
  /** while it hides: could any of it show in his picture, edge and all? (the stats too) */
  const peeks = (): boolean => { measure(); const q = sightOf(k, sq, home.trees, 'peek').glimpse; k.stats.sq_peek = q ? 1 : 0; return q; };
  /** it is where he sees it: in the middle 80 % of his picture */
  const inMiddle = (): boolean => { const s = sightOf(k, sq, home.trees, 'peek'); return s.glimpse && Math.abs(s.x) <= RUN_ON_X; };
  k.stats.route = ['midden', 'noord', 'zuid'].indexOf(p.route);
  const lens = (): Spot => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });

  // run 7 (its finds): this play's rare visitor (k.rare(), rolled at the briefing: a seeded
  // chance, and surely within about three plays), made now and laid out of his sight where
  // it comes: the dark-brown one at the den, the young one in the found view
  const rare = k.rare()?.id ?? null;
  const visitorSeed = k.play.fork('bezoeker').int(1, 0x7fffffff);
  const dark = rare === 'eekhoorn.donkere-eekhoorn' ? home.visitor('donker', SQUIRREL_H, visitorSeed) : null;
  const young = rare === 'eekhoorn.jonge-eekhoorn' ? home.visitor('jong', SQUIRREL_H * YOUNG.scale, visitorSeed) : null;
  for (const v of [dark, young]) if (v) { v.lensAt = sq.lensAt; v.rangerAt = sq.rangerAt; }
  /** a visitor's chatter (from where it is) */
  const chatterOf = (v: Squirrel): void => {
    if (settings.geluid) Sound.callAt('eekhoorn', v.x, v.z, listenerOf(k.world.camera));
    v.called();
  };

  // 0 · it sees him coming: up to its branch stub on its pine, and it chatters at him.
  //     The one look of the mission: the lens turns to it over his shoulder (while it
  //     runs up to its stub), so the child meets the squirrel he is going to follow;
  //     then the follow camera is back. (A play with the dark-brown visitor frames it a
  //     little higher: the two of them meet on the trunk.)
  //     Run 7 (ek-day, design §6.8): what it is doing as he comes is this play's den — on
  //     its stub, hanging head down on the bark under it, nibbling a pine cone at the
  //     pine's foot, or a spiral run up round the trunk to its stub as the lens turns to it.
  k.beat = 'den';
  const den = p.day.den;
  k.stats.den = DEN_KINDS.indexOf(den);
  const meAtDen = k.ranger();
  const denLook = introView(meAtDen, route.waits[0], dark ? DEN_VISITOR.tall : undefined);
  const denLens = k.lensFor(denLook).cam;
  const ds = denSpot({ x: denLens.x, z: denLens.z }, meAtDen);
  const sitFace = faceMe(sq.branchPose(oak));
  const up = k.guard((async (): Promise<boolean> => {
    if (den === 'omlaag') {
      // (up its pine above where it hangs, if it is not on it, then down head first to there)
      if (sq.onTree !== oak && !(await sq.goTrunk(oak, { ang: ds.down.ang, h: ds.down.h + 0.9 }))) return false;
      return sq.goRound(oak, ds.down, 0.8, 0, false);
    }
    if (den === 'voet') return sq.run(sq.dashTo(ds.foot.x, ds.foot.z, ds.footFace));
    if (den === 'spiraal') {
      // (down round the back of its pine, and up again, round and round, to its stub)
      const low = { ang: oak.branch.ang + Math.PI, h: 0.4 };
      if (sq.onTree === oak ? !(await sq.goRound(oak, low, 0.9, 0, false)) : !(await sq.goTrunk(oak, low))) return false;
      if (!(await sq.goRound(oak, { ang: oak.branch.ang, h: oak.branch.h - 0.12 }, 2.2, 1, true))) return false;
      return sq.goBranch(oak, sitFace);
    }
    return sq.goBranch(oak, sitFace);
  })());
  await k.frame(den === 'voet' ? introView(meAtDen, route.waits[0], DEN_DAY.footTall, ds.foot) : denLook, { face: headingTo(k.ranger(), oak.trunk) });
  await up;
  // (nibbling at the pine's foot: a cone in its paws, its scales falling, while the look holds)
  let nibbling = den === 'voet';
  const nibble = async (): Promise<void> => { while (nibbling) if (!(await sq.antic('knabbelen', ds.footFace))) return; };
  const nibbled = nibble().catch(() => {});
  k.say(c.daar);
  k.stats.den_px = Math.round(measure().px);
  chatter();
  await k.wait(1.5);
  sq.flick();
  if (dark && (await k.guard(dark.ready.then(() => !!dark.body)))) {
    // the dark-brown squirrel comes down the trunk head first, from above and round the
    // back of it, to the bark above ours: the two chatter at each other ("Kijk, nog een
    // eekhoorn!"), chase each other once round the pine, and it runs up the far side and
    // away through the crown; ours goes back to its stub
    const cam = k.world.camera.position;
    const v = denVisitor({ x: cam.x, z: cam.z });
    dark.placeOnTrunk(oak, v.start, false);
    dark.group.visible = true;
    const seen = seenFor(k, home, 'eekhoorn.donkere-eekhoorn', squirrelSight(dark), { px: 40, secs: 1, stat: 'donker' });
    try {
      await k.guard(dark.goRound(oak, v.meet, 1.6, 0, false));
      chatterOf(dark);
      await k.wait(0.35);
      k.say(c.nogEen);
      void sq.look(headingTo(sq, dark), 0.2).catch(() => {});
      await k.wait(0.9);
      chatter();
      await k.wait(0.9);
      // once round the pine: it first, ours after it (round the bark: never toward the lens)
      const chase = k.guard(dark.goRound(oak, { ang: v.meet.ang, h: DEN_VISITOR.spiralH }, 1.4, 1, false));
      await k.wait(0.3);
      const after = k.guard(sq.goRound(oak, { ang: oak.branch.ang, h: DEN_VISITOR.spiralH - 0.15 }, 1.4, 1, false));
      await chase;
      chatterOf(dark);
      const gone = k.guard(dark.goRound(oak, v.up, 2.4));
      await after;
      await k.guard(sq.goBranch(oak, faceMe(sq.branchPose(oak))));
      chatter();
      sq.flick();
      await gone;
      await k.wait(0.3);
    } finally {
      seen.off();
      k.stats.donker = seen.seen ? 1 : 0;
      home.dropVisitor();
    }
  } else {
    await k.wait(1.1);
    chatter();
  }
  await k.wait(1.2);
  if (nibbling) {
    // (it stops nibbling and sits up, looking at him, before it runs off)
    nibbling = false;
    await k.guard(sq.settleTo(faceMe(sq), 0.3));
  }
  await nibbled;
  // (out of the picture he turns the way the squirrel will go: the follow camera comes
  // back behind him looking there, and the keys walk him after it)
  k.world.faceRanger(headingTo(k.ranger(), wayTo(k.ranger(), watchSpot(route.waits[0]))));
  k.free();

  // 1 · "Volg de eekhoorn": tree to tree along this play's way. At each wait it sits up on
  //     a LOW stub beside its trunk (about his shoulder: over it in the follow lens, never
  //     behind his head), faces him, flicks its tail and chatters, a warm light on its
  //     outline; it runs on only once he has come close (within SEE_D), it is in his view,
  //     and it is where he sees it (the middle of his picture): every dash and leap starts
  //     in his view.
  let leapAt = -9, leapOut = false, wasLeap = false;
  k.stats.leaps = 0;
  k.stats.leap_out = 0;
  const offLeaps = k.onTick(() => {
    const leaping = sq.now.act === 'leap';
    if (leaping && !wasLeap) { leapAt = k.now; leapOut = false; k.stats.leaps += 1; }
    wasLeap = leaping;
    // (a leap that STARTS outside the middle 80 % of his picture, or behind the lens: design
    // §6.2; one passing behind his own head as it sets off is in his picture)
    if (leaping && k.now - leapAt <= 0.3 && !leapOut) {
      const s = sightOf(k, sq, home.trees, 'peek');
      if (Math.abs(s.x) > RUN_ON_X) {
        leapOut = true;
        k.stats.leap_out += 1;
        k.stats.leap_out_n = k.stats.leaps; // (which leap, and where: a dev read)
        k.stats.leap_out_x = Math.round(s.x * 100) / 100;
      }
    }
  });
  // run 7 (ek-day, design §6.8): at most one small surprise this play, only while he walks —
  // a pine cone drops beside his path from a pine he passes under (`denappel`, on the way
  // tree to tree), the jay buries an acorn of its own ahead of him (`gaai`) or a drum roll
  // comes from the glade (`roffel`, with the great spotted woodpecker on the bark: both on
  // his walk into the glade)
  const verr = p.day.verrassing;
  let verrDone = verr === 'geen';
  k.stats.verr = ['geen', 'denappel', 'gaai', 'roffel'].indexOf(verr);
  /** in his picture now, well inside it (the follow lens): a spot `up` m above the ground */
  const inPicture = (q: Spot, up: number, xMax = 0.7, yMin = -0.8): boolean => {
    const cam = k.world.camera;
    cam.updateMatrixWorld();
    V1.set(q.x, k.ctx.groundY(q.x, q.z) + up, q.z);
    if (V1.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.5) return false;
    V1.project(cam);
    return Math.abs(V1.x) <= xMax && V1.y >= yMin && V1.y <= 0.5;
  };
  /** the cone: as he walks up to the pine the squirrel waits on, one drops from its crown
   *  in front of its trunk, beside his way, in the middle of his picture */
  const coneTick = (walkFrom: number, t: HomeTree): void => {
    if (verrDone || verr !== 'denappel') return;
    const m = k.ranger();
    if (k.now - walkFrom < 1.5) return;
    const spot = coneDrop(m, t);
    if (!spot || !inPicture(spot, 0.1, 0.5, -0.5)) return;
    verrDone = true;
    k.stats.verr_go = 1;
    home.dropCone(spot, lens(), () => { k.stats.verr_land = 1; if (settings.geluid) Sound.dig(); });
  };
  // run 7 (its finds): along the way he may see its gnawed cones — into his veldgids once he
  // really saw them (big enough in his picture, for a moment); its nest goes in with its own
  // moment (nestMoment), or — when he walked past it without a look — once he does see it
  let nestSeen = null as { off(): void; readonly seen: boolean } | null;
  const kegelsSeen = seenFor(k, home, 'eekhoorn.kale-kegels', () => { const q = home.kegelsSight(); return q && { box: q.box, pts: q.pts, at: q.at }; },
    { across: DINING_SEE.across, within: DINING_SEE.within, secs: DINING_SEE.secs, stat: 'kegels' });
  /** set once the last move to the next wait has begun (a leap through a pine it only
   *  passes comes first) */
  let lastMove = false;
  /** while it waits in its nest (and peeks out of it): the spot to see it from, and which
   *  leg of the way there he is on (to the spot; the step that turns him to the nest) */
  let nestWait: { watch: ReturnType<typeof nestWatch>; leg: 'go' | 'look' | 'hold'; at?: Spot } | null = null;
  const hop = async (name: string, wi: number, go: () => Promise<boolean>, t: HomeTree, line: string): Promise<void> => {
    k.say(line);
    lastMove = false;
    // (every wait can finish: should its way there be taken over part way — a plan replaced —
    // it runs straight to its stub after all; ek-finds review, seed 45: a wait that never
    // finished after the nest moment)
    const face = headingTo(t, comesFrom(route, wi));
    const there = k.guard((async () => {
      let ok = await go();
      for (let i = 1; !ok && i <= 3; i++) {
        k.check();
        k.stats[`${name}_retry`] = i;
        ok = await sq.goBranch(st(t), face);
      }
      return ok;
    })());
    // (a breath before the way on shows: he sees it set off from where he stands — and
    // leap on through a pine it only passes — before the chip and the keys turn him
    // toward where it goes)
    await k.wait(0.7);
    await k.until(() => lastMove, RUN_ON_WAIT + 2);
    await k.wait(0.3);
    let arrived = false;
    let sitFrom = 0;
    let toldWait = false;
    /** since when he has been within SEE_D of it with it in his view (−1: not now) */
    let closeFrom = -1;
    /** since when he has stood right by it (−1: not now): standing there a while, it runs on
     *  whatever the lens shows (never a wait that cannot finish) */
    let byFrom = -1;
    // run 7 (ek-day, design §6.8): its antic while he comes — a moment looking at him first,
    // then it grooms, nibbles, basks, scolds or looks round, and again while he is still on
    // his way; as he comes close it sits up and looks at him (it runs on as before)
    const antic = p.day.antics[wi] ?? 'kijken';
    let anticNext = Infinity, anticOn = false, anticN = 0, scoldAt = Infinity;
    const faceHim = (): number => headingTo(sq, k.ranger());
    void there.then((ok) => {
      if (!ok) return;
      arrived = true; sitFrom = k.now; sq.glow(true); void sq.lookAt(me); chatter();
      k.stats[`${name}_arrive_px`] = Math.round(measure().px);
      k.stats[`${name}_there`] = Math.round(k.now * 10) / 10;
      anticNext = k.now + ANTIC.first;
    }).catch(() => {});
    const anticTick = (): void => {
      if (!arrived) return;
      const d = dist(k.ranger(), sq);
      // (its first antic as it sits down, wherever he is — he sees what it does as he comes
      // up; again while he is still on his way)
      if (!anticOn && k.now >= anticNext && (anticN === 0 || d > ANTIC.near)) {
        anticOn = true;
        anticN += 1;
        k.stats[`antic_${wi + 1}`] = ANTICS.indexOf(antic);
        k.stats[`antic_go_${wi + 1}`] = anticN;
        if (antic === 'mopperen') { chatter(); scoldAt = k.now + 1.05; }
        void sq.antic(antic, faceHim(), { along: t.branch!.ang + ANTIC.lie }).then((ok) => {
          if (!anticOn) return;
          anticOn = false;
          anticNext = k.now + ANTIC.again;
          if (ok) void sq.lookAt(me);
        }).catch(() => {});
      }
      if (k.now >= scoldAt) { scoldAt = Infinity; chatter(); }
    };
    const spot = watchSpot(t);
    const seat = seatOf(t);
    const hint = seeHint(k, name, () => {
      // (it waits in its nest: the way is to the spot to see it from, then one step on toward
      // a point beside the nest — it turns him, and the lens, to it — and there he stands)
      if (nestWait) {
        const w = nestWait.watch, d = dist(k.ranger(), w);
        // (it peeks out: he stands where he saw it, while it looks at him and its line plays)
        if (nestWait.leg === 'hold' && nestWait.at) return { x: nestWait.at.x, z: nestWait.at.z, r: 1.5, tag: 'nest-hold' };
        if (nestWait.leg === 'go' && d <= NEST_WATCH.r) nestWait.leg = 'look'; // (and it stays: wandered off, the step brings him back facing it)
        if (nestWait.leg === 'look') return { x: w.aim.x, z: w.aim.z, r: w.stop, tag: 'nest-look' };
        const way = wayTo(k.ranger(), w);
        return way === w ? { x: w.x, z: w.z, r: NEST_WATCH.r * 0.7, tag: 'nest' } : { x: way.x, z: way.z, tag: 'nest' };
      }
      // (at the spot to see it from — or right by it already — with it on its stub: the way
      // is on toward it, never away from it: walking at it turns him, and the lens, to it,
      // and brings him within SEE_D)
      if (arrived && (dist(k.ranger(), spot) <= WATCH_R || dist(k.ranger(), seat) <= AT_IT)) return { ...seat, r: SEAT_STOP };
      return wayTo(k.ranger(), spot);
    });
    const walkFrom = k.now;
    try {
      await k.walk({
        // (the chip's way, if he needs it: to the squirrel on its stub itself)
        name, to: seat, r: 0.01, line, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
        // while it waits for the ranger it chatters now and then (a sound to follow); when
        // the ranger wanders off, the line says so once
        tick: () => {
          hint.tick();
          // (as he walks up to the pine it is off to — where he looks — a cone drops in front
          // of it; never with its nest's own moment)
          if (wi !== p.nest) coneTick(walkFrom, t);
          if (!arrived) return;
          anticTick();
          if (k.now - lastChatter > 3.2 && !anticOn) chatter();
          const far = dist(k.ranger(), sq) > 9;
          if (far && !toldWait) { toldWait = true; k.say(c.wacht); } else if (!far && toldWait && dist(k.ranger(), sq) < 6) { toldWait = false; k.say(line); }
        },
        // (close: within SEE_D of it, it well in his view and big enough there (SET_OFF_H, or
        // SET_OFF_WAIT s on) — or right at it, under it, a bit of it showing past his own
        // head — and it sits up on its stub a moment first, even when he is there before
        // it: it waits for him, looking at him; or he has stood right by it BY_WAIT s, where
        // the lens may not show it — it runs on all the same, never a wait without an end)
        reached: () => {
          if (!arrived || k.now - sitFrom < SIT) return false;
          const d = dist(k.ranger(), sq);
          const s = measure();
          const close = d <= SEE_D && s.seen;
          if (!close) closeFrom = -1;
          else if (closeFrom < 0) closeFrom = k.now;
          if (d > SEE_D + 0.6) byFrom = -1;
          else if (byFrom < 0) byFrom = k.now;
          const big = s.px >= SET_OFF_H * (k.ctx.canvas.clientHeight || 800);
          if (byFrom >= 0 && k.now - byFrom >= BY_WAIT && !(close || d <= AT_IT)) k.stats[`${name}_by`] = 1;
          return (close && (big || k.now - closeFrom >= SET_OFF_WAIT)) || (d <= AT_IT && sightOf(k, sq, home.trees, 'near').glimpse)
            || (byFrom >= 0 && k.now - byFrom >= BY_WAIT);
        },
      });
    } finally {
      hint.off();
    }
    await there;
    // (it was in the middle of an antic as he came close: it finishes it — a moment more at
    // most — and sits up facing him; then it is off)
    if (anticOn) {
      await k.until(() => !anticOn, ANTIC.grace);
      if (anticOn) { anticOn = false; scoldAt = Infinity; await k.guard(sq.settleTo(faceHim(), 0.25)); }
    }
    // it saw him come: a chatter and a flick — and it is off as soon as it is where he
    // sees it (a moment for the lens to swing round after him, at most RUN_ON_WAIT s)
    chatter();
    await k.wait(0.45);
    sq.flick();
    await k.until(() => inMiddle(), RUN_ON_WAIT);
    // (how big it is as it sets off, and where in his picture)
    const off = sightOf(k, sq, home.trees, 'peek');
    k.stats[`${name}_px`] = Math.round(off.px);
    k.stats[`${name}_x`] = Math.round(off.x * 100) / 100;
    sq.glow(false);
  };
  /**
   * Its nest (run 7): at the wait whose tree carries it, it runs up into the nest instead
   * of onto its stub and waits there, chattering from the twigs, while the way on takes him
   * to the spot to see it from. Once he has SEEN the nest (NEST_SEE: big enough in his
   * picture, NEST_SEE.secs in a row) it peeks out of it at him ("Kijk, zijn nest!") and the
   * nest goes into his veldgids — that moment is the find; he stands while it peeks and
   * flicks its tail, then it comes down to its stub to wait. A child who walks on under it
   * without a look: it comes out all the same and nothing is said of a nest he did not see
   * (it is his once he does see it, from then on).
   */
  const nestMoment = async (t: HomeTree, wi: number, face: number, line: string): Promise<boolean> => {
    const n = home.nestNow;
    if (!n) return sq.goBranch(st(t), face);
    const tree = st(t);
    if (!(await sq.goTrunk(tree, { ang: n.ang, h: NEST.h - NEST.r - 0.1 }))) return false;
    // into it (the ball of twigs hides it; a bit of tail may show)
    if (!(await sq.moveTo({ x: n.x, z: n.z, alt: n.world.y - k.ctx.groundY(n.x, n.z) - NEST.r * 0.55, yaw: n.ang, pitch: 0, roll: 0, act: 'sit' }, 0.45))) return false;
    /** the nest in his picture now: big enough, well inside it (not at its edge), under the
     *  line card and out of the chips' corner, mostly clear of the trunks (not the ones the
     *  camera fades) and of his head */
    const nestInView = (): boolean => {
      const me = k.ranger();
      if (dist(me, n) > NEST_SEE.near) return false;
      const t0 = home.nestSight();
      if (!t0) return false;
      const cam = k.world.camera;
      const g = k.ctx.groundY(me.x, me.z);
      const hiders = [...home.trunks(cam.position, me), { x: me.x, z: me.z, y0: g - 0.2, y1: g + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 }];
      const W = k.ctx.canvas.clientWidth || 1280;
      const pic = pictureOf(cam, k.ctx.canvas.clientHeight || 800, W, t0.box, t0.pts, hiders);
      const underHud = ((pic.cx + 1) / 2) * W < NEST_SEE.hud.w && pic.cy < NEST_SEE.hud.h;
      const ok = pic.inside && !underHud && Math.abs(pic.cx) <= NEST_SEE.x && pic.px >= NEST_SEE.px && pic.clear >= 0.5;
      if (ok) { k.stats.nest_px = Math.round(pic.px); k.stats.nest_x = Math.round(pic.cx * 100) / 100; }
      return ok;
    };
    nestWait = { watch: nestWatch(route, wi), leg: 'go' };
    const clock = new SeenClock(NEST_SEE.secs);
    let nextChatter = k.now + 1.5, under = 0, last = k.now, lastYaw = NaN;
    const look = new THREE.Vector3();
    const t0 = k.now;
    const seen = await k.until(() => {
      const dt = k.now - last;
      if (dt <= 0) return false; // (no time has passed: nothing to measure)
      last = k.now;
      if (k.now >= nextChatter) { nextChatter = k.now + 2.8; chatter(); }
      // (a steady picture: the lens not swinging round — a nest seen as it swings by is gone
      // again a moment later)
      k.world.camera.getWorldDirection(look);
      const yaw = Math.atan2(look.x, look.z);
      const steady = Number.isFinite(lastYaw) && Math.abs(wrap(yaw - lastYaw)) / dt <= NEST_SEE.turn;
      lastYaw = yaw;
      if (clock.step(dt, steady && nestInView())) return true;
      // (he stands right under it and does not look up at it: it comes out to him all the same
      // — standing: on his way out from under it to see it, the clock waits; played
      // 2026-10-04, seed 2: right by its trunk as it went in, the walk out took 4 s and it
      // came out without a word)
      const me = k.ranger();
      under = dist(me, n) <= NEST_WATCH.under && me.speed < 0.3 ? under + dt : 0;
      return under >= NEST_PEEK.nearWait;
    }, NEST_PEEK.wait).then(() => clock.seen);
    k.stats.nest_wait_s = Math.round((k.now - t0) * 10) / 10;
    // (seen — in a steady picture: he stands where he saw it while it peeks out at him)
    if (seen) { const me = k.ranger(); nestWait = { ...nestWait, leg: 'hold', at: { x: me.x, z: me.z } }; }
    const pk = nestPeek(n, k.ranger());
    sq.glow(true);
    const out = sq.moveTo({ x: pk.x, z: pk.z, alt: pk.y, yaw: pk.yaw, pitch: 0, roll: 0, act: 'sit' }, 0.5);
    out.catch(() => {});
    if (seen) {
      // its moment, in his picture: the line as its head comes out, and the nest is his
      await k.wait(0.25);
      k.say(c.nestKijk);
      k.stats.nest_peek = 1;
      k.discover('eekhoorn.nest', { first: true }); // (its card next: with its moment, before a find that waits)
    }
    if (!(await out)) { nestWait = null; return false; }
    chatter();
    await k.wait(0.6);
    sq.flick();
    await k.wait(1.2);
    chatter();
    await k.wait(0.6);
    if (seen) {
      // (a little longer in its nest, looking at him: its card comes up now, after its line,
      // with the nest still in his picture — before the next line, which would hold it back)
      sq.flick();
      await k.wait(1.3);
    }
    nestWait = null;
    // (a nest he did not see: his once he does — from here on, as he walks on)
    if (!seen) nestSeen ??= seenFor(k, home, 'eekhoorn.nest', () => home.nestSight(), { px: NEST_SEE.px, secs: 1, stat: 'nest' });
    sq.glow(false);
    k.say(line);
    // down the bark under its nest, round to its stub
    if (!(await sq.moveTo(trunkPose(tree.trunk, { ang: n.ang, h: NEST.h - NEST.r - 0.08 }, false, 'cling'), 0.35))) return false;
    return sq.goBranch(tree, face);
  };
  /** the hops after the wait before up to and including `w` (a leap or a dash each) */
  const goTo = (from: number, to: number, face: number, nest: { wi: number; line: string } | null = null): (() => Promise<boolean>) => async () => {
    const hops = route.hops.slice(from, to + 1);
    for (const [i, h] of hops.entries()) {
      const last = i === hops.length - 1;
      // (on from a tree it only passes, too, only once it is where he sees it: landed out of
      // his picture, it chatters there and waits until he has turned to it — played
      // 2026-10-03: from the middle way's A, its leap to B lands left of his picture)
      if (i > 0 && !inMiddle()) { chatter(); await k.until(() => inMiddle(), PASS_WAIT); }
      if (last) lastMove = true;
      const ok = last && nest && h.how === 'dash' ? await nestMoment(h.tree, nest.wi, face, nest.line)
        : h.how === 'leap' ? await sq.goLeap(st(h.tree), last ? face : undefined) : await sq.goBranch(st(h.tree), last ? face : undefined);
      if (!ok) return false;
      if (!last) await k.wait(0.25);
    }
    return true;
  };
  try {
    let from = 0;
    for (const [wi, t] of route.waits.entries()) {
      const to = route.hops.findIndex((h) => h.tree === t);
      const line = wi === 0 ? c.volg : c.weer;
      await hop(`wacht-${wi + 1}`, wi, goTo(from, to, headingTo(t, comesFrom(route, wi)), wi === p.nest && wi < route.waits.length - 1 ? { wi, line } : null), t, line);
      from = to + 1;
    }
  } finally {
    offLeaps();
  }

  // it plays hide-and-seek: it slips off its stub round the trunk, across it from him (as
  // red squirrels do), and as he walks round — or the moment a bit of it peeks out in his
  // view — it slips round again, keeping the bark between them, never faster than he
  // walks, its chatter from behind the bark telling him where. Once he has walked about
  // half round the pine (or it slipped a few times) it stays, and he has found it the
  // moment it is in his view (the live lens: on the screen, most of it clear of the trunk
  // and of his own body): then the lens holds the two of them while it peeks out at him.
  let slipping = 0;
  /** One round of hide-and-seek round `cT` (its own walk, `name`): it hides across the
   *  trunk from him and his eye, slips round as he comes (at most `most` times, until he has
   *  walked `round` rad round), and he has found it once it is in his view. Returns the side
   *  of the trunk it stopped on. (`stat`: the stats' prefix.) */
  const hideAndSeek = async (cT: HomeTree, name: string, most: number, round: number, stat: string): Promise<number> => {
    const hideTree = st(cT);
    let sqAng = hideStart(cT, [k.ranger(), lens()], STUMP);
    const slip = (ang: number, secs?: number): void => {
      const token = ++slipping;
      void k.guard(sq.goRound(hideTree, { ang, h: HIDE.h }, secs)).then(() => { if (slipping === token) slipping = 0; }, () => {});
    };
    slip(sqAng, slipSecs(headingTo(hideTree.trunk, sq), sqAng) * 0.6);
    chatter();
    k.say(c.waarIsHij);
    await k.until(() => slipping === 0, 3);
    k.stats[`${stat}_shifts`] = 0;
    let lastB = headingTo(hideTree.trunk, k.ranger());
    let walked = 0;
    let hid = false;
    let hiding = true;
    const step = { ...roundStep(cT, k.ranger(), sqAng) };
    const hint = seeHint(k, name, () => roundStep(cT, k.ranger(), sqAng));
    const nearIt = (): boolean => { const m = k.ranger(); return dist(m, sq) < HIDE.near && Math.abs(wrap(headingTo(hideTree.trunk, m) - sqAng)) < HIDE.nearAng; };
    try {
      await k.walk({
        name, to: step, r: 0.01, line: c.waarIsHij, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 14,
        tick: () => {
          hint.tick();
          const mb = headingTo(hideTree.trunk, k.ranger());
          walked += Math.abs(wrap(mb - lastB));
          lastB = mb;
          Object.assign(step, roundStep(cT, k.ranger(), sqAng)); // (the chip's way, if he needs it)
          if (!slipping && !hid) {
            // (he kept walking while it slipped off its stub: it hides anew across from where
            // his eye is now, until it is out of sight — only then does the game begin)
            if (peeks()) { sqAng = hideStart(cT, [k.ranger(), lens()], STUMP); slip(sqAng, 0.6); } else hid = true;
          } else if (!slipping && hiding) {
            // he has been round far enough: it stays where it is and lets him find it
            if (walked >= round || k.stats[`${stat}_shifts`] >= most) hiding = false;
            else {
              // it slips round when he (or his eye, the lens) comes round toward it — or the
              // moment a bit of it peeks out past the bark in his view (the tail: a clue,
              // not a find)
              const next = hideShift(cT, sqAng, [mb, headingTo(hideTree.trunk, lens())], peeks());
              if (next !== null) {
                k.stats[`${stat}_shifts`] += 1;
                slip(next, slipSecs(sqAng, next));
                sqAng = next;
                chatter();
              }
            }
          }
          if (k.now - lastChatter > 2.6) chatter();
        },
        // (found: in view once it stopped hiding — while it hides, a glimpse of it sends it
        // round the bark again; or, right up at the bark on its side of the tree — where a
        // child steering at its chatter ends up, his own back between it and the lens — as
        // soon as a bit of it shows beside him)
        reached: () => hid && !hiding && !slipping && dist(k.ranger(), hideTree.trunk) <= FIND_R && (measure().seen || (nearIt() && measure().glimpse)),
      });
    } finally {
      hint.off();
    }
    k.stats[`${stat}_round`] = Math.round((walked * 180) / Math.PI);
    return sqAng;
  };
  /** Found: he stops (a moment with the keys resting) and the lens eases round to hold the
   *  two of them, on his side of the tree; the squirrel peeks its head round the bark at him
   *  and comes out onto the bark's near face, flicks its tail and chatters. Returns where he
   *  stands and the side of the trunk it is on. */
  const foundAt = async (cT: HomeTree, sqAng0: number, young0: boolean): Promise<{ at0: Spot; face: number }> => {
    const hideTree = st(cT);
    k.lockFollow();
    await k.until(() => k.ranger().speed < 0.1 && !slipping, 1.5);
    // (found from further off: a few calm steps nearer it first, so the two of them fit close)
    const near0 = foundStand(cT, foundFace(cT, sqAng0, k.ranger()), k.ranger());
    if (dist(near0, k.ranger()) > 0.2) await k.walkRanger(near0.x, near0.z, 0.05);
    const at0 = k.ranger();
    const face = foundFace(cT, sqAng0, at0);
    const out = k.guard(sq.goRound(hideTree, { ang: face, h: HIDE.h }, 0.9));
    out.catch(() => {});
    const rr = barkRadius(hideTree.trunk, HIDE.h) + 0.08;
    const sqAt = { x: cT.x + Math.sin(face) * rr, z: cT.z + Math.cos(face) * rr };
    await k.frame(foundView(cT, face, at0, young0), { face: headingTo(at0, sqAt) });
    await out;
    sq.flick();
    chatter();
    return { at0, face };
  };

  // it plays hide-and-seek: it slips off its stub round the trunk, across it from him (as
  // red squirrels do), and as he walks round — or the moment a bit of it peeks out in his
  // view — it slips round again, keeping the bark between them, never faster than he
  // walks, its chatter from behind the bark telling him where. Once he has walked about
  // half round the pine (or it slipped a few times) it stays, and he has found it the
  // moment it is in his view (the live lens: on the screen, most of it clear of the trunk
  // and of his own body): then the lens holds the two of them while it peeks out at him.
  k.beat = 'verstop';
  let cT = route.hide;
  let hideTree = st(cT);
  let sqAng = await hideAndSeek(cT, 'om-de-boom', HIDE.most, HIDE.round, 'hide');
  // (found: a held view now, no walk — a new find's reveal waits for the walk to its glade)
  k.beat = 'gevonden';
  const { at0, face } = await foundAt(cT, sqAng, !!young);
  sqAng = face;
  // run 7 (the rare young one): it was hiding with ours, round the back of the trunk; now
  // a little head peeks round the wood, and out it comes onto the ground, out past the
  // pine's root spurs, and sits up facing him ("Gevonden! En nog een kleintje!"); once he
  // has seen it, it runs up the trunk and round the back, out of the picture. (The found
  // view of a play with it holds it whole too: eekhoorn.places foundView/youngPeek.)
  let youngGone: Promise<boolean> | null = null;
  let youngSeen: { off(): void; readonly seen: boolean } | null = null;
  if (young && (await k.guard(young.ready.then(() => !!young.body)))) {
    const cam = k.world.camera.position;
    const y = youngPeek(cT, at0, { x: cam.x, z: cam.z }, face);
    young.placeOnTrunk(hideTree, y.start, false);
    young.group.visible = true;
    youngSeen = seenFor(k, home, 'eekhoorn.jonge-eekhoorn', squirrelSight(young), { px: 38, secs: 1, stat: 'jong' });
    await k.guard(young.goRound(hideTree, y.edge, 0.8, 0, false));
    chatterOf(young);
    await k.wait(0.5);
    await k.guard(young.run(young.dashTo(y.sit.x, y.sit.z, headingTo(y.sit, at0), y.edge.ang)));
    young.flick();
    k.say(c.gevondenJong);
    const found = measure();
    k.stats.found_px = Math.round(found.px);
    k.stats.found_x = Math.round(found.x * 100) / 100;
    sq.called();
    await k.wait(0.8);
    chatterOf(young);
    await k.wait(1.4);
    await k.until(() => youngSeen!.seen, 1.6);
    young.flick();
    await k.wait(0.4);
    youngGone = k.guard((async () => (await young.goTrunk(hideTree, y.climb)) && young.goRound(hideTree, y.up, 2))());
    await k.wait(0.8);
  } else {
    await k.wait(0.5);
    k.say(c.gevonden);
    const found = measure();
    k.stats.found_px = Math.round(found.px);
    k.stats.found_x = Math.round(found.x * 100) / 100;
    sq.called();
    await k.wait(1.6);
  }
  const dropYoung = async (): Promise<void> => {
    if (!youngGone) return;
    // (the young one is up in the crown by now, out of his picture: it goes)
    await youngGone.catch(() => false);
    youngGone = null;
    youngSeen?.off();
    k.stats.jong = youngSeen?.seen ? 1 : 0;
    home.dropVisitor();
  };

  // run 7 (ek-day, design §6.8): on some plays it is off again at once — "Nog een keer!" —
  // to a close pine of its way, and hides round that one too: a short one (it slips round
  // once at most), found the same way, the lens holding the two of them close
  if (p.day.verstop2) {
    const t2 = SECOND_HIDE[p.route];
    const tree2 = st(t2);
    k.stats.hide2 = 1;
    await dropYoung();
    // "Nog een keer!": it chatters and flicks on the bark, still in the found view
    k.say(c.nogEenKeer);
    chatter();
    sq.flick();
    await k.wait(0.6);
    // he turns toward the pine it is off to and the lens comes round behind him on an arc,
    // to where his picture holds it on this pine and the next one both (eekhoorn.places
    // hide2Stand: where he stands, or a few calm steps off first); then it pours down the
    // bark and dashes across his picture, up the near side of that trunk — never at the lens
    const rr0 = barkRadius(hideTree.trunk, HIDE.h) + 0.08;
    const turn = hide2Stand(k.ranger(), { x: cT.x + Math.sin(sqAng) * rr0, z: cT.z + Math.cos(sqAng) * rr0 }, cT, t2);
    k.stats.hide2_turn = turn.ok ? 1 : 0;
    if (dist(turn.at, k.ranger()) > 0.05) {
      k.stats.hide2_step = Math.round(dist(turn.at, k.ranger()) * 10) / 10;
      await k.walkRanger(turn.at.x, turn.at.z, 0.05);
    }
    const me0 = k.ranger();
    k.world.faceRanger(turn.face);
    await k.behind();
    k.stats.hide2_go = 1;
    await k.guard(sq.goTrunk(tree2, { ang: headingTo(t2, me0), h: HIDE.h + 0.25 }));
    chatter();
    sq.flick();
    await k.wait(0.5);
    k.beat = 'verstop-2';
    cT = t2;
    hideTree = tree2;
    const a2 = await hideAndSeek(t2, 'om-de-boom-2', HIDE2.most, HIDE2.round, 'hide2');
    k.beat = 'gevonden-2';
    const f2 = await foundAt(t2, a2, false);
    sqAng = f2.face;
    await k.wait(0.5);
    k.say(c.weerGevonden);
    const found2 = measure();
    k.stats.hide2_found_px = Math.round(found2.px);
    k.stats.hide2_found_x = Math.round(found2.x * 100) / 100;
    sq.called();
    await k.wait(1.4);
  }
  // he turns toward its glade (or, where he must, a few calm steps first) and the lens comes
  // round behind him on an arc: from there his picture holds it on the bark and its whole
  // run to its stump (eekhoorn.places foundRun, review r1: still facing the tree from the
  // found view, the stump stood behind him where he found it from the glade's side, and it
  // ran past him at the lens). It pours down the bark on its side toward the glade and pops
  // up on the ground in front of him, sits up facing him, chatters — and runs on across the
  // picture or away from the lens, never at it
  const run = foundRun(k.ranger(), sqAng, cT);
  k.stats.run_ok = run.ok ? 1 : 0;
  if (dist(run.at, k.ranger()) > 0.05) {
    k.stats.run_step = Math.round(dist(run.at, k.ranger()) * 10) / 10;
    await k.walkRanger(run.at.x, run.at.z, 0.05);
  }
  k.world.faceRanger(run.face);
  await k.behind();
  await k.wait(0.3);
  const m = k.ranger();
  const pop = run.pop;
  await k.guard(sq.run(sq.dashTo(pop.x, pop.z, headingTo(pop, m), run.side)));
  chatter();
  await k.wait(0.7);
  sq.flick();
  await k.wait(1.1);
  await dropYoung();

  // into its glade: down the pine and over the ground onto its stump by the store
  k.say(c.weer);
  const stumpFace = headingTo(STUMP, P.stand);
  const toStump = k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  toStump.catch(() => {}); // (a stop during the walk: the walk throws, this one is let go)
  // (on its stump it waits for him: it chatters now and then, the warm light on its outline)
  let onStump = false;
  void toStump.then((ok) => { if (ok) { onStump = true; sq.glow(true); chatter(); } }, () => {});
  const gladeFrom = k.now;
  let walkingIn = true;
  /** the jay in his picture now: how tall (px), where across (−1…1), and whether that is in
   *  its window (eekhoorn.places JAY_SEE: big enough, in the picture's middle, off his body,
   *  mostly clear of the trunks and of him) */
  const jayPicture = (): { px: number; cx: number; ok: boolean } | null => {
    const t = home.jaySight(JAY_SEE.h);
    if (!t) return null;
    const cam = k.world.camera, me = k.ranger();
    const H = k.ctx.canvas.clientHeight || 800, W = k.ctx.canvas.clientWidth || 1280;
    const g = k.ctx.groundY(me.x, me.z);
    const pic = pictureOf(cam, H, W, t.box, t.pts, [...home.trunks(cam.position, me), { x: me.x, z: me.z, y0: g - 0.2, y1: g + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 }]);
    const edge = (1 - JAY_SEE.mid) / 2;
    const ok = pic.px >= JAY_SEE.px && Math.abs(pic.cx) <= JAY_SEE.mid && Math.abs(pic.cx) >= JAY_SEE.body
      && pic.cy >= H * edge && pic.cy <= H * (1 - edge) && pic.clear >= 0.5;
    return { px: pic.px, cx: pic.cx, ok };
  };
  /** the squirrel in the lower half of his picture now (out of it: not) */
  const squirrelLow = (): boolean => {
    if (!sq.body || !sq.group.visible) return false;
    const cam = k.world.camera;
    cam.updateMatrixWorld();
    const c = BOX.setFromObject(sq.body).getCenter(V2);
    if (V1.copy(c).applyMatrix4(cam.matrixWorldInverse).z > -0.3) return false;
    const s = V1.copy(c).project(cam);
    return Math.abs(s.x) <= 1 && s.y < 0 && s.y >= -1;
  };
  /** the jay's own cache: it pushes its acorn into the needles, looks at him, flies up */
  // (it plays while he comes up to it — he walks on meanwhile: short, the line at once)
  const jayMoment = async (): Promise<void> => {
    k.stats.verr_go = 1;
    home.jayBury();
    if (settings.geluid) Sound.dig();
    k.say(c.gaaiVerstopt);
    k.discover('eekhoorn.gaai', { quiet: true });
    await k.wait(0.8);
    home.jayLook(k.ranger());
    await k.wait(0.4);
    if (settings.geluid) { const j = home.jayAt(); Sound.callAt('gaai', j.x, j.z, listenerOf(k.world.camera), 25, CALL_CAP[1]); }
    await k.wait(0.6);
    home.jayUp(1.8);
    await k.wait(1.8);
    if (walkingIn) k.say(c.weer);
  };
  await k.walk({
    name: 'open-plek', to: P.stand, r: 1.6, line: c.weer, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
    tick: () => {
      if (onStump && k.now - lastChatter > 3.2) chatter();
      if (onStump) measure();
      if (verrDone) return;
      const m = k.ranger();
      if (verr === 'gaai') {
        const j = home.jayAt(), d = dist(m, j);
        k.stats.gaai_d = Math.round(Math.min(k.stats.gaai_d ?? 99, d) * 10) / 10; // (dev read: how near he came)
        // (in its window — big and well inside his picture, the squirrel on its stump or
        // clearly elsewhere: eekhoorn.places JAY_SEE — he walks up to it as it buries its
        // acorn; not at the walk's first moment)
        if (k.now - gladeFrom < JAY_SEE.after || d < JAY_SEE.close) { /* wait; or it flies up below */ } else {
          const pic = jayPicture();
          const away = jayFliesAway(m, j);
          const sqElse = onStump || (dist(sq, j) >= JAY_SEE.apart && !squirrelLow());
          if (pic) { k.stats.gaai_px = Math.round(pic.px); k.stats.gaai_x = Math.round(pic.cx * 100) / 100; }
          if (pic && pic.ok && away && sqElse) {
            k.stats.gaai_sq = Math.round(dist(sq, j) * 10) / 10;
            k.stats.gaai_stump = onStump ? 1 : 0;
            verrDone = true;
            void jayMoment().catch(() => {});
          } else if (pic?.ok && !sqElse) k.stats.gaai_wait_sq = 1;
        }
        if (!verrDone && d < JAY_SEE.close) {
          // (he came on it from the side or straight at it, or its window never came: it simply
          // flies up to its oak, without a word)
          verrDone = true;
          k.stats.gaai_up = 1;
          home.jayUp(1.8);
        }
      } else if (verr === 'roffel' && k.now - gladeFrom >= 1.2 && dist(m, home.stamAt()) <= DRUM_NEAR) {
        // a drum roll from the glade, and a second one a moment later
        verrDone = true;
        k.stats.verr_go = 1;
        const drum = (): void => { home.drumOn(); if (settings.geluid) { const q = home.stamAt(); Sound.callAt('grote-bonte-specht', q.x, q.z, listenerOf(k.world.camera), 30); } };
        drum();
        void k.wait(1.6).then(drum).catch(() => {});
      }
    },
  });
  walkingIn = false;
  // (the jay he did not come by: it flies up to the glade oak all the same, before the glade)
  if (verr === 'gaai' && !verrDone) { verrDone = true; home.jayUp(1.8); }
  await toStump;
  sq.glow(false);
  // (the way is behind him: what he saw of it is his, the rest stays for another visit)
  nestSeen?.off();
  kegelsSeen.off();
  k.say(c.plekje);
  chatter();
  // it takes acorns from its store: it starts burying with its cheeks full
  await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z));
  await k.guard(sq.sniffHere(0.35));
  sq.carry(true);

  // 2 · it buries its acorns, one spot after another, and forgets them (corsi): two
  //     mouthfuls (the skin's `rondes`), its visits each round's first show
  /** Forgotten: back on its stump it looks this way and that, and chatters. */
  const forget = async (): Promise<void> => {
    if (!(await sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace))) return;
    chatter();
    if (!(await sq.look(stumpFace + 0.8))) return;
    if (!(await sq.look(stumpFace - 0.8))) return;
    await sq.look(stumpFace, 0.1);
  };
  /** Its sweep after a round: a quick run to each found acorn (nearest first), dug up in a
   *  bob, its cheeks filling, then one run to its store: the heap grows a cluster. */
  const sweep = async (spots: readonly { x: number; z: number }[]): Promise<void> => {
    const left = [...spots];
    let at: Spot = sq;
    const t0 = k.now;
    while (left.length) {
      left.sort((a, b) => dist(a, at) - dist(b, at));
      const s = left.shift()!;
      if (!(await k.guard(sq.goDash(s.x, s.z, true)))) return;
      const y = sq.now.yaw;
      home.unearthAcorn(s.x + Math.sin(y) * 0.07, s.z + Math.cos(y) * 0.07, SWEEP_DIG);
      if (settings.geluid) Sound.dig();
      await k.guard(sq.dig(SWEEP_DIG));
      sq.carry(true);
      at = s;
    }
    if (!(await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z, true)))) return;
    sq.carry(false);
    sq.flick();
    home.growHeap(1);
    if (settings.geluid) Sound.dig();
    k.stats.sweep_s = Math.round((k.now - t0) * 10) / 10;
    k.stats.sweep_n = spots.length;
  };
  /** the spots he pointed out right in this pass (the round's route, once complete) */
  let pass: { x: number; z: number }[] = [];
  let lastRoute: { x: number; z: number }[] = [];
  let visitT = 0, visits = 0;
  await routeBeat(k, 0, {
    view: GLADE_VIEW, stand: P.stand, field: home.field,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[0].skin.copy?.goed ?? c.routeWijs, vergeten: c.vergeten, nogEen: c.nogMeer },
    // the show: it dashes to each spot with an acorn in its cheeks and digs it in (the
    // spot glows warm from the moment it gets there, all through the dig, and a breath
    // after — one clear lit spot at a time; the acorn sinks into the moss in front of
    // its nose)
    visit: async (s, light) => {
      const t0 = k.now;
      sq.carry(true);
      if (!(await sq.goDash(s.x, s.z, true))) return;
      light(true);
      sq.carry(false);
      const y = sq.now.yaw;
      home.buryAcorn(s.x + Math.sin(y) * 0.07, s.z + Math.cos(y) * 0.07, VISIT.dig);
      await sq.dig(VISIT.dig);
      await k.wait(VISIT.gap);
      light(false);
      visitT += k.now - t0; visits += 1;
      k.stats.visit_s = Math.round((visitT / visits) * 100) / 100;
    },
    // the show over, it runs back to its stump and forgets (recall is open at once)
    shown: (first) => { pass = []; if (first) { sq.carry(false); void forget().catch(() => {}); } },
    // a pick: it dashes there and sniffs — the right one it knows again (a flick of its
    // tail: here!), a wrong one it shakes off (nothing there)
    picked: async (s, res) => {
      if (res === 'reshow') pass = []; else pass.push({ x: s.x, z: s.z });
      if (res === 'complete') lastRoute = pass;
      if (!(await sq.goDash(s.x, s.z))) return;
      await sq.sniffHere(res === 'reshow' ? 0.7 : 0.4);
      if (res === 'reshow') {
        // nothing there: a shake of its head (a quick look left and right)
        const y = sq.now.yaw;
        await sq.look(y + 0.6, 0.15);
        await sq.look(y - 0.5, 0.15);
        return;
      }
      sq.flick();
      if (settings.geluid) Sound.correct();
    },
    // between the mouthfuls: it sweeps the found acorns up to its store and takes more
    between: async (_round, spots) => {
      await sweep(spots);
      sq.carry(true);
    },
  });

  // it remembers them all: one quick run over the last mouthful's spots, its cheeks
  // filling, and one run to its store by the stump — the store grows
  k.say(c.stapel);
  await sweep(lastRoute);
  if (settings.geluid) Sound.found();
  await k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  chatter();

  // 3 · the raaf: forgotten nuts grow into trees
  await k.fact(0);

  // 4 · who else lives here? The lens turns to the neighbours round the stump and he
  //     meets them one by one: a click, and each calls and says who it is (so he knows
  //     every voice before they call together)
  k.beat = 'buren';
  await k.walkRanger(P.callers.x, P.callers.z, 0.04);
  await k.frame(CALLERS_VIEW, { face: P.callers.heading });
  await meetNeighbours(k, home, settings.geluid);

  // 5 · the jay (the nut thief) glides down for the store; the squirrel scolds it from its
  //     stump, the neighbours call out, and he calls them back (simon): after every echo
  //     he gets right the jay backs off a step
  k.beat = 'gaai';
  k.say(c.gaaiKomt);
  home.jayDown();
  await k.wait(1.7);
  // (landed by the store, big in the callers' picture: into his veldgids, quietly — the
  // line names it)
  k.discover('eekhoorn.gaai', { quiet: true });
  if (settings.geluid) { const j = home.jayAt(); Sound.callAt('gaai', j.x, j.z, listenerOf(k.world.camera), 25, CALL_CAP[1]); }
  await k.wait(0.9);
  chatter(); // (the squirrel scolds it)
  await k.wait(0.8);
  k.say(c.roepMee);
  await k.wait(2.2);
  if (sq.body) sq.body.userData.perch = STUMP.top; // (it sits on its stump)
  const birds = home.neighbours;
  const callers: Caller[] = [
    { id: 'eekhoorn', pick: sq.group, body: sq.body, at: () => ({ x: sq.x, z: sq.z }), act: (on) => { if (on) sq.called(); } },
    ...birds.map((n: Neighbour): Caller => ({ id: n.id, pick: n.object, body: n.body, at: () => ({ x: n.at.x, z: n.at.z }), act: (on) => { if (on) n.call(); } })),
  ];
  k.stats.jay_steps = 0;
  try {
    await callersBeat(k, 1, {
      view: null, callers,
      // the four of THIS play (the 2D floor plays the content's four; the same row, slot
      // for slot, so the same taps give the same summary)
      dieren: ['eekhoorn', ...birds.map((n) => n.id)],
      callCap: CALL_CAP,
      // between two rounds: the jay backs off a step with one short call
      between: async (round, rounds) => {
        home.jayBack(jayStep(round, Math.max(1, rounds - 1)));
        k.stats.jay_steps += 1;
        await k.wait(0.35);
        if (settings.geluid) { const j = home.jayAt(); Sound.callAt('gaai', j.x, j.z, listenerOf(k.world.camera), 25, 0.6); }
        await k.wait(0.6);
      },
      lines: { luister: c.luisterBuren, echo: c.naroepen, groei: c.groei, opnieuw: c.opnieuw, goed: c.goedBuren },
    });
  } finally {
    if (sq.body) delete sq.body.userData.perch; // (a stop too: it runs home off its stump)
  }
  // the jay (the nut thief) gives up and flies off over the trees
  k.say(c.gaai);
  if (settings.geluid) { const j = home.jayAt(); Sound.callAt('gaai', j.x, j.z, listenerOf(k.world.camera), 25, CALL_CAP[1]); }
  home.jayFlies();
  await k.wait(2.4);

  // 6 · all its nuts are back: its day ends one of three ways (run 7, ek-day §6.8) — it
  //     eats an acorn on its stump; or it fetches one more from its store, buries it by
  //     the stump and pats it down (a forgotten one: the seedling a later visit finds); or
  //     it grooms on its stump, its tail curled round
  home.seedlingWaits = true; // (a later visit finds the forgotten one grown)
  const einde = p.day.einde;
  k.stats.einde = EINDES.indexOf(einde);
  await k.reunion(async () => {
    k.stats.einde_go = 1;
    sq.flick();
    if (einde === 'begraaf') {
      // (it turns to the side of its stump away from the store, an acorn it kept in its
      // mouth, hops down there and buries it)
      if (!(await sq.look(headingTo(STUMP, BURY_AT), 0.25))) return;
      sq.carry(true);
      if (!(await sq.goDash(BURY_AT.x, BURY_AT.z))) return;
      sq.carry(false);
      const y = sq.now.yaw;
      home.buryAcorn(BURY_AT.x + Math.sin(y) * 0.07, BURY_AT.z + Math.cos(y) * 0.07, 0.8);
      if (settings.geluid) Sound.dig();
      if (!(await sq.dig(0.8))) return;
      if (!(await sq.run(patPlan(sq.now, headingTo(BURY_AT, P.callers))))) return;
      sq.flick();
      await sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace);
    } else if (einde === 'poets') {
      if (!(await sq.antic('poetsen', stumpFace))) return;
      sq.flick();
      await sq.antic('poetsen', stumpFace);
    } else await sq.eat(3.6);
  });
  k.stats.store = dist(sq, HEAP) < 1.2 ? 1 : 0;
  // the raaf: the squirrel wakes up in winter to eat (the store is its winter food)
  await k.fact(1);
}
