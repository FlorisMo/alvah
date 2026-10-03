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
import { barkRadius, lineClear, trunkFadeUpright, trunkUpright, wrap, type Upright } from '../squirrel-math';
import { dist, headingTo } from '../places';
import type { Spot } from '../types';
import { TREE_BASE_H } from '../../world/Forest';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale';
import { EekhoornHome, type Neighbour } from './eekhoorn.home';
import {
  CALLERS_VIEW, EEKHOORN_HOME, EEKHOORN_PLACES as P, FIND_R, GLADE_VIEW, HEAP, HEAP_GRAB, AT_IT, HIDE, HOME_TREES, ROUTES, RUN_ON_WAIT, RUN_ON_X, SEAT_STOP, SEE_D, SEEN_X, STUMP,
  VARIANT_KEY, WATCH_R, branchStub, comesFrom, drawEekhoornPlay, eekhoornClearings, eekhoornTreeClear, foundFace, foundStand, foundView, hideShift, hideStart, introView,
  jayStep, lastVariants, roundStep, seatOf, slipSecs, variantOf, watchSpot, wayTo, type EekhoornPlay, type HomeTree, type Route,
} from './eekhoorn.places';

/** How near the lens (m) a home tree keeps its full detail (world/Forest `near`): measured
 *  2026-10-03, turning round at the marker and along the ways, the squirrel's fifteen pines
 *  in full detail out to the forest's 20 m took the picture past the 1M triangles (shadow
 *  pass included); within this the trunk the squirrel sits on is the full tree. */
const TREE_NEAR = 6;
/** The squirrel's size (m, sitting up with its tail curled over its back): a little over
 *  the upper end of a red squirrel (≈ 0.3), so a child reads it on a trunk a few metres
 *  off — through the follow lens 4.6 m behind him, ≥ 40 px as it sets off from a stub he
 *  stands 1.4 m from (measured 2026-10-03: at 0.3 m it was 35-38 px there). */
const SQUIRREL_H = 0.33;
/** At each stop of the follow it sits up on its stub at least this long (s) before it runs
 *  on — then a chatter and a flick (~1 s): a clear "it waits for me", even at a run. */
const SIT = 1.2;
/** The squirrel's own visits to its caching spots (each round's first show): the dash
 *  (straight, at its full run), the dig, the breath before the next (design §6.4: ≤ 2 s a
 *  spot — the 2D floor shows one in 1.15 s; replays and eases are its timings). */
const VISIT = { dig: 0.65, gap: 0.12 } as const;
/** On a pine it only passes, it waits at most this long (s) for him to turn to it before it
 *  leaps on (the way on shows after RUN_ON_WAIT + 2 s, turning him toward it). */
const PASS_WAIT = 9;
/** Its sweep after a round: each acorn dug up in a quick bob (s). */
const SWEEP_DIG = 0.25;
/** Each neighbour's call in the echo game is held to this snippet (s): a blackbird's long
 *  song and a great tit's short pump give the same listening tempo, whoever came today. */
const CALL_CAP: readonly [number, number] = [0.6, 1.2];

/** This play's day, drawn and laid under the briefing card (`prepare`). */
let drawn: { seed: number; p: EekhoornPlay } | null = null;

/** Draw this play (from its seed and the squirrel's last play) and lay it in its home:
 *  the caching pattern, the neighbours, the small things' stream, the squirrel's day. */
function lay(world: { residents: Residents }, play: Play): EekhoornPlay | null {
  const home = world.residents.dressing('eekhoorn') as EekhoornHome | null;
  if (!home) return null;
  const p = drawEekhoornPlay(play, lastVariants(store.get().geschiedenis, 2));
  play.note(VARIANT_KEY, variantOf(p));
  home.layPlay(p, { cosmetic: play.fork('cosmetic').rng, squirrel: play.fork('squirrel').int(1, 0x7fffffff) });
  drawn = { seed: play.seed, p };
  return p;
}

export const eekhoornAdventure: Adventure = {
  id: 'eekhoorn',
  home: EEKHOORN_HOME,
  clearings: eekhoornClearings(),
  // the forest draws them, each with its branch stub (it fades with its tree)
  // (full detail only within TREE_NEAR m of the lens: fifteen pines round one spot keep the
  // triangle budget; past it they are the forest's simpler copy, as any tree past 20 m)
  trees: HOME_TREES.map((t) => ({ x: t.x, z: t.z, s: t.h / TREE_BASE_H[t.species], rotY: t.rotY, species: t.species, stub: branchStub(t), near: TREE_NEAR })),
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
    dressing.squirrel = sq;
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

/** A walk that ends on what he SEES (not where he stands) gets its own play hint for
 *  golden: a spot a perfect player walks to straight, with a real radius, read anew each
 *  time he gets there. It replaces the walk's own hint on the walk's first tick, under
 *  its own id (so a reader still holding the walk's own sees it change). */
function seeHint(k: AdventureKit, name: string, spot: () => Spot & { r?: number }): { tick(): void; off(): void } {
  let off: (() => void) | null = null;
  return {
    tick: () => { off ??= k.hint(() => { const s = spot(); return { id: `walk:${name}:see`, walk: { x: s.x, z: s.z, r: s.r ?? WATCH_R } }; }); },
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

  // 0 · it sees him coming: up to its branch stub on its pine, and it chatters at him.
  //     The one look of the mission: the lens turns to it over his shoulder (while it
  //     runs up to its stub), so the child meets the squirrel he is going to follow;
  //     then the follow camera is back.
  k.beat = 'den';
  const up = k.guard(sq.goBranch(oak, faceMe(sq.branchPose(oak))));
  await k.frame(introView(k.ranger(), route.waits[0]), { face: headingTo(k.ranger(), oak.trunk) });
  await up;
  k.say(c.daar);
  k.stats.den_px = Math.round(measure().px);
  chatter();
  await k.wait(1.5);
  sq.flick();
  await k.wait(1.1);
  chatter();
  await k.wait(1.2);
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
  /** set once the last move to the next wait has begun (a leap through a pine it only
   *  passes comes first) */
  let lastMove = false;
  const hop = async (name: string, go: () => Promise<boolean>, t: HomeTree, line: string): Promise<void> => {
    k.say(line);
    lastMove = false;
    const there = k.guard(go());
    // (a breath before the way on shows: he sees it set off from where he stands — and
    // leap on through a pine it only passes — before the chip and the keys turn him
    // toward where it goes)
    await k.wait(0.7);
    await k.until(() => lastMove, RUN_ON_WAIT + 2);
    await k.wait(0.3);
    let arrived = false;
    let sitFrom = 0;
    let toldWait = false;
    void there.then((ok) => {
      if (!ok) return;
      arrived = true; sitFrom = k.now; sq.glow(true); void sq.lookAt(me); chatter();
      k.stats[`${name}_arrive_px`] = Math.round(measure().px);
    }).catch(() => {});
    const spot = watchSpot(t);
    const seat = seatOf(t);
    const hint = seeHint(k, name, () => {
      // (at the spot to see it from — or right by it already — with it on its stub: the way
      // is on toward it, never away from it: walking at it turns him, and the lens, to it,
      // and brings him within SEE_D)
      if (arrived && (dist(k.ranger(), spot) <= WATCH_R || dist(k.ranger(), seat) <= AT_IT)) return { ...seat, r: SEAT_STOP };
      return wayTo(k.ranger(), spot);
    });
    try {
      await k.walk({
        // (the chip's way, if he needs it: to the squirrel on its stub itself)
        name, to: seat, r: 0.01, line, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
        // while it waits for the ranger it chatters now and then (a sound to follow); when
        // the ranger wanders off, the line says so once
        tick: () => {
          hint.tick();
          if (!arrived) return;
          if (k.now - lastChatter > 3.2) chatter();
          const far = dist(k.ranger(), sq) > 9;
          if (far && !toldWait) { toldWait = true; k.say(c.wacht); } else if (!far && toldWait && dist(k.ranger(), sq) < 6) { toldWait = false; k.say(line); }
        },
        // (close: within SEE_D of it, and it well in his view — or right at it, under it, a
        // bit of it showing past his own head — and it sits up on its stub a moment first,
        // even when he is there before it: it waits for him, looking at him)
        reached: () => {
          if (!arrived || k.now - sitFrom < SIT) return false;
          const d = dist(k.ranger(), sq);
          return (d <= SEE_D && measure().seen) || (d <= AT_IT && sightOf(k, sq, home.trees, 'near').glimpse);
        },
      });
    } finally {
      hint.off();
    }
    await there;
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
  /** the hops after the wait before up to and including `w` (a leap or a dash each) */
  const goTo = (from: number, to: number, face: number): (() => Promise<boolean>) => async () => {
    const hops = route.hops.slice(from, to + 1);
    for (const [i, h] of hops.entries()) {
      const last = i === hops.length - 1;
      // (on from a tree it only passes, too, only once it is where he sees it: landed out of
      // his picture, it chatters there and waits until he has turned to it — played
      // 2026-10-03: from the middle way's A, its leap to B lands left of his picture)
      if (i > 0 && !inMiddle()) { chatter(); await k.until(() => inMiddle(), PASS_WAIT); }
      if (last) lastMove = true;
      const ok = h.how === 'leap' ? await sq.goLeap(st(h.tree), last ? face : undefined) : await sq.goBranch(st(h.tree), last ? face : undefined);
      if (!ok) return false;
      if (!last) await k.wait(0.25);
    }
    return true;
  };
  try {
    let from = 0;
    for (const [wi, t] of route.waits.entries()) {
      const to = route.hops.findIndex((h) => h.tree === t);
      await hop(`wacht-${wi + 1}`, goTo(from, to, headingTo(t, comesFrom(route, wi))), t, wi === 0 ? c.volg : c.weer);
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
  k.beat = 'verstop';
  const cT = route.hide;
  const hideTree = st(cT);
  const lens = (): Spot => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });
  let sqAng = hideStart(cT, [k.ranger(), lens()], STUMP);
  let slipping = 0;
  const slip = (ang: number, secs?: number): void => {
    const token = ++slipping;
    void k.guard(sq.goRound(hideTree, { ang, h: HIDE.h }, secs)).then(() => { if (slipping === token) slipping = 0; }, () => {});
  };
  slip(sqAng, slipSecs(headingTo(hideTree.trunk, sq), sqAng) * 0.6);
  chatter();
  k.say(c.waarIsHij);
  await k.until(() => slipping === 0, 3);
  k.stats.hide_shifts = 0;
  let lastB = headingTo(hideTree.trunk, k.ranger());
  let walked = 0;
  let hid = false;
  let hiding = true;
  const step = { ...roundStep(cT, k.ranger(), sqAng) };
  const hint = seeHint(k, 'om-de-boom', () => roundStep(cT, k.ranger(), sqAng));
  const nearIt = (): boolean => { const m = k.ranger(); return dist(m, sq) < HIDE.near && Math.abs(wrap(headingTo(hideTree.trunk, m) - sqAng)) < HIDE.nearAng; };
  try {
    await k.walk({
      name: 'om-de-boom', to: step, r: 0.01, line: c.waarIsHij, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 14,
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
          if (walked >= HIDE.round || k.stats.hide_shifts >= HIDE.most) hiding = false;
          else {
            // it slips round when he (or his eye, the lens) comes round toward it — or the
            // moment a bit of it peeks out past the bark in his view (the tail: a clue,
            // not a find)
            const next = hideShift(cT, sqAng, [mb, headingTo(hideTree.trunk, lens())], peeks());
            if (next !== null) {
              k.stats.hide_shifts += 1;
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
  k.stats.hide_round = Math.round((walked * 180) / Math.PI);
  // found: he stops (a moment with the keys resting) and the lens eases round to hold the
  // two of them, on his side of the tree; the squirrel peeks its head round the bark at
  // him and comes out onto the bark's near face, flicks its tail and chatters — and THEN
  // "Gevonden!", with it big in the picture
  k.lockFollow();
  await k.until(() => k.ranger().speed < 0.1 && !slipping, 1.5);
  // (found from further off: a few calm steps nearer it first, so the two of them fit close)
  const near0 = foundStand(cT, foundFace(cT, sqAng, k.ranger()), k.ranger());
  if (dist(near0, k.ranger()) > 0.2) await k.walkRanger(near0.x, near0.z, 0.05);
  const at0 = k.ranger();
  const face = foundFace(cT, sqAng, at0);
  const out = k.guard(sq.goRound(hideTree, { ang: face, h: HIDE.h }, 0.9));
  out.catch(() => {});
  const rr = barkRadius(hideTree.trunk, HIDE.h) + 0.08;
  const sqAt = { x: cT.x + Math.sin(face) * rr, z: cT.z + Math.cos(face) * rr };
  await k.frame(foundView(cT, face, at0), { face: headingTo(at0, sqAt) });
  await out;
  sqAng = face;
  sq.flick();
  chatter();
  await k.wait(0.5);
  k.say(c.gevonden);
  const found = measure();
  k.stats.found_px = Math.round(found.px);
  k.stats.found_x = Math.round(found.x * 100) / 100;
  sq.called();
  await k.wait(1.6);
  // the lens back behind him; it pours straight down the bark on its side (in his view)
  // and pops up on the ground in front of him, sits up facing him, chatters
  k.lockFollow();
  await k.wait(0.6);
  const m = k.ranger();
  const ahead = m.heading; // (where he looks: the follow camera looks there too)
  // (ahead of him but off to the side away from the tree, on the open floor: straight
  // ahead his own body would hide it from the camera behind him, by the trunk it is a
  // small dark thing against the dark bark)
  const toTree = headingTo(m, hideTree.trunk);
  const side = Math.sin(toTree - ahead) >= 0 ? -1 : 1;
  const popAt = ahead + side * 0.75;
  const pop = { x: m.x + Math.sin(popAt) * 1.8, z: m.z + Math.cos(popAt) * 1.8 };
  await k.guard(sq.run(sq.dashTo(pop.x, pop.z, headingTo(pop, m), sqAng)));
  chatter();
  await k.wait(0.7);
  sq.flick();
  await k.wait(1.1);

  // into its glade: down the pine and over the ground onto its stump by the store
  k.say(c.weer);
  const stumpFace = headingTo(STUMP, P.stand);
  const toStump = k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  toStump.catch(() => {}); // (a stop during the walk: the walk throws, this one is let go)
  // (on its stump it waits for him: it chatters now and then, the warm light on its outline)
  let onStump = false;
  void toStump.then((ok) => { if (ok) { onStump = true; sq.glow(true); chatter(); } }, () => {});
  await k.walk({
    name: 'open-plek', to: P.stand, r: 1.6, line: c.weer, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
    tick: () => { if (onStump && k.now - lastChatter > 3.2) chatter(); if (onStump) measure(); },
  });
  await toStump;
  sq.glow(false);
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

  // 6 · the squirrel sits on its stump and eats an acorn: all its nuts are back
  home.seedlingWaits = true; // (a later visit finds the forgotten one grown)
  await k.reunion(async () => {
    sq.flick();
    await sq.eat(3.6);
  });
  k.stats.store = dist(sq, HEAP) < 1.2 ? 1 : 0;
  // the raaf: the squirrel wakes up in winter to eat (the store is its winter food)
  await k.fact(1);
}
