/**
 * eekhoorn.ts — "De verstopte nootjes" as an adventure in the world (design §4.4).
 *
 * The squirrel lives on its pine right by the marker: it runs down and round the trunk,
 * forages at its foot, sits on a branch stub, and chatters at the ranger when he comes
 * near. Once the mission starts the lens turns to it for one calm look (the child meets
 * it on its stub), then it takes him to its glade: down its pine and over the forest
 * floor to a second pine, where it waits on a stub for him; a leap to the next pine and
 * on to a third, where it plays hide-and-seek round the trunk until he walks round and
 * finds it; then into its glade. There it takes an acorn from its store and buries one in
 * the moss at spot after spot, runs back to its stump — and forgets where (CORSI: he
 * points the spots out in order; it dashes to each and digs the acorn up; a wrong spot,
 * it sniffs and finds nothing, and the spots glow again as he remembers them). It brings
 * the acorns back to its store. Then the jay (the nut thief) flies down to the store, the
 * squirrel scolds it, and the neighbours call out — the squirrel on its stump, the jay,
 * the green woodpecker on the pine, the raven on the dead snag: he calls them back
 * (SIMON), and the jay gives up and flies off. The squirrel sits on its stump and eats an
 * acorn. Afterwards the store stays, the squirrel lives in the pine by it, and a later
 * visit finds an oak seedling where a forgotten acorn grew.
 *
 * Steps (content, the EF contract): 0 corsi · 1 simon, each logged once.
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import { clearPlayHint, pick3d } from '../../play/kit';
import type { Adventure } from '../registry';
import type { ResidentGroup } from '../../world/Residents';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { listenerOf } from '../../world/Residents';
import { routeBeat } from '../beats/route';
import { callersBeat, type Caller } from '../beats/callers';
import { CALL_GLOW, WarmGlow } from '../beats/callers-glow';
import { Squirrel, type SquirrelTree } from '../squirrel';
import { lineClear, trunkUpright, wrap, type Upright } from '../squirrel-math';
import { dist, headingTo } from '../places';
import type { Spot } from '../types';
import { TREE_BASE_H } from '../../world/Forest';
import { RANGER_STAND_HEIGHT } from '../../AnimalScale';
import { EekhoornHome, type Neighbour } from './eekhoorn.home';
import {
  CALLERS_VIEW, EEKHOORN_HOME, EEKHOORN_PLACES as P, GLADE_VIEW, HEAP, HEAP_GRAB, HIDE, HOME_TREES, JAY_GROUND, SEAT_STOP, SEE_D, SEEN_X, STUMP, WATCH_R, TREE, introView,
  branchStub, eekhoornClearings, eekhoornTreeClear, hideShift, hideStart, roundStep, seatOf, slipSecs, watchSpot, wayTo, type HomeTree,
} from './eekhoorn.places';

/** The squirrel's size (m, sitting up with its tail): the upper end of a red squirrel,
 *  so a child reads it on a trunk a few metres off. */
const SQUIRREL_H = 0.3;
/** At each stop of the follow it sits up on its stub at least this long (s) before it runs
 *  on — then a chatter and a flick (~1 s): a clear "it waits for me", even at a run. */
const SIT = 1.2;

export const eekhoornAdventure: Adventure = {
  id: 'eekhoorn',
  home: EEKHOORN_HOME,
  clearings: eekhoornClearings(),
  // the forest draws them, each with its branch stub (it fades with its tree)
  trees: HOME_TREES.map((t) => ({ x: t.x, z: t.z, s: t.h / TREE_BASE_H[t.species], rotY: t.rotY, species: t.species, stub: branchStub(t) })),
  treeClearings: eekhoornTreeClear(),
  dressing: (env) => new EekhoornHome(env),
  actor: (spec, env, _height, dressing) => {
    if (spec.key !== 'squirrel' || !(dressing instanceof EekhoornHome)) return null;
    const sq = new Squirrel(spec.key, env, { height: SQUIRREL_H, trees: dressing.trees, seed: 11 });
    sq.stumps.push({ x: STUMP.x, z: STUMP.z, top: STUMP.top, r: STUMP.r });
    sq.onDig = (x, z) => dressing.puffAt(x, z, env.reduced());
    return sq;
  },
  prepare(world) {
    // a replay: the store is small again and the jay back on its stub (under the card)
    (world.residents.dressing('eekhoorn') as EekhoornHome | null)?.setState(world.residents.state('eekhoorn') ?? 'before');
  },

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as EekhoornHome;
    const sq = fam.actors.squirrel as Squirrel;
    sq.lensAt = () => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });
    sq.rangerAt = () => k.ranger();
    fam.voice('squirrel', false); // (the adventure chatters itself now)
    // (they stay set: running home after a stop it goes round the lens and the ranger too)
    await story(k, fam, home, sq);
  },
};

/** Who lives round the store (beat 4): he clicks each neighbour; it lights up, hops, calls
 *  and its name is said. Any order; one after another (a click while one is talking waits
 *  its turn). Resolves once he has met all three. */
async function meetNeighbours(k: AdventureKit, home: EekhoornHome, geluid: boolean): Promise<void> {
  const c = k.copy;
  const names: Record<Neighbour['id'], string> = { gaai: c.isGaai, 'groene-specht': c.isSpecht, raaf: c.isRaaf };
  const left = new Set<string>(home.neighbours.map((n) => n.id));
  const glows = new Map<string, WarmGlow>(home.neighbours.filter((n) => n.body).map((n) => [n.id, new WarmGlow(n.body!)]));
  let busy = false;
  k.say(c.wieWonen);
  let finished!: () => void;
  const done = new Promise<void>((r) => { finished = r; });
  const onPick = (id: string): void => {
    const n = home.neighbours.find((q) => q.id === id);
    if (!n || busy) return;
    busy = true;
    left.delete(id);
    glows.get(id)?.set(CALL_GLOW);
    n.call();
    k.say(names[n.id]);
    if (geluid) Sound.callAt(n.id, n.at.x, n.at.z, listenerOf(k.world.camera));
    void k.wait(Math.max(1.6, Sound.callDur(n.id) + 0.4)).then(() => {
      glows.get(id)?.set(0);
      busy = false;
      if (!left.size) finished();
    }).catch(() => {});
  };
  const unhint = k.hint(() => {
    if (busy) return null;
    const n = home.neighbours.find((q) => left.has(q.id));
    return n ? { id: `buur:${n.id}`, target: n.body ?? n.object } : null;
  });
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets: home.neighbours.map((n) => ({ id: n.id, object: n.object })), onPick, signal: k.signal,
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
 *  screen, tail and ears and all. */
interface Sight { seen: boolean; glimpse: boolean; px: number }

const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const V3 = new THREE.Vector3();
const V4 = new THREE.Vector3();
const BOX = new THREE.Box3();
function sightOf(k: AdventureKit, sq: Squirrel, trees: readonly SquirrelTree[]): Sight {
  const pts = sq.bodyPoints();
  const cam = k.world.camera as THREE.PerspectiveCamera;
  if (!pts.length || !sq.body || !sq.group.visible) return { seen: false, glimpse: false, px: 0 };
  const h = k.ctx.canvas.clientHeight || 800;
  cam.updateMatrixWorld();
  const me = k.ranger();
  const g = k.ctx.groundY(me.x, me.z);
  // (a trunk between the lens and him is faded by the follow camera — world/CameraRig,
  // his head or his chest behind it — and he is seen through it: so is the squirrel)
  const head = V3.set(me.x, g + RANGER_STAND_HEIGHT, me.z), chest = V4.set(me.x, g + 0.9, me.z);
  const ups: Upright[] = trees.map((t) => trunkUpright(t.trunk, k.ctx.groundY(t.trunk.x, t.trunk.z)))
    .filter((u) => lineClear(cam.position, head, [u]) && lineClear(cam.position, chest, [u]));
  ups.push({ x: me.x, z: me.z, y0: g - 0.2, y1: g + RANGER_STAND_HEIGHT * 1.1, r: () => 0.22 });
  let open = 0, well = 0;
  for (const p of pts) {
    if (V1.copy(p).applyMatrix4(cam.matrixWorldInverse).z > -0.3) continue; // (behind the lens)
    const s = V1.copy(p).project(cam);
    const y = (1 - s.y) * 0.5 * h;
    if (Math.abs(s.x) > 0.98 || y < 96 || y > h - 8 || !lineClear(cam.position, p, ups)) continue;
    open += 1;
    if (Math.abs(s.x) <= SEEN_X && y >= 110 && y <= h - 70) well += 1;
  }
  BOX.setFromObject(sq.body);
  const c = BOX.getCenter(V2);
  const px = Math.abs(V1.set(c.x, BOX.max.y, c.z).project(cam).y - V2.set(c.x, BOX.min.y, c.z).project(cam).y) * 0.5 * h;
  return { seen: well >= pts.length / 2, glimpse: open > 0, px };
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
async function story(k: AdventureKit, fam: ResidentGroup, home: EekhoornHome, sq: Squirrel): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const [oak, pineA, pineB, pineC] = home.trees;
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

  // 0 · it sees him coming: up to its branch stub on its pine, and it chatters at him.
  //     The one look of the mission: the lens turns to it over his shoulder (while it
  //     runs up to its stub), so the child meets the squirrel he is going to follow;
  //     then the follow camera is back.
  k.beat = 'den';
  const up = k.guard(sq.goBranch(oak, faceMe(sq.branchPose(oak))));
  await k.frame(introView(k.ranger()), { face: headingTo(k.ranger(), oak.trunk) });
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
  k.world.faceRanger(headingTo(k.ranger(), wayTo(k.ranger(), watchSpot(TREE.a))));
  k.free();

  // 1 · "Volg de eekhoorn": tree to tree. At each stop it sits up on a LOW stub on his
  //     side of the pine (about his shoulder: over it in the follow lens, never behind
  //     his head), faces him, flicks its tail and chatters, a warm light on its outline;
  //     it runs on only once he has come close (within SEE_D) and it is in his view.
  const hop = async (name: string, go: () => Promise<boolean>, t: HomeTree, line: string): Promise<void> => {
    k.say(line);
    const there = k.guard(go());
    let arrived = false;
    let sitFrom = 0;
    let toldWait = false;
    void there.then((ok) => { if (!ok) return; arrived = true; sitFrom = k.now; sq.glow(true); void sq.lookAt(me); chatter(); }).catch(() => {});
    const spot = watchSpot(t);
    const hint = seeHint(k, name, () => {
      // (at the spot to see it from, with it on its stub: the way is on toward it — walking
      // at it turns him, and the lens, to it, and brings him within SEE_D)
      if (arrived && dist(k.ranger(), spot) <= WATCH_R) return { ...seatOf(t), r: SEAT_STOP };
      return wayTo(k.ranger(), spot);
    });
    try {
      await k.walk({
        name, to: spot, r: 0.01, line, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 18,
        // while it waits for the ranger it chatters now and then (a sound to follow); when
        // the ranger wanders off, the line says so once
        tick: () => {
          hint.tick();
          if (!arrived) return;
          if (k.now - lastChatter > 3.2) chatter();
          const far = dist(k.ranger(), sq) > 9;
          if (far && !toldWait) { toldWait = true; k.say(c.wacht); } else if (!far && toldWait && dist(k.ranger(), sq) < 6) { toldWait = false; k.say(line); }
        },
        // (close: within SEE_D of it, and it well in his view — and it sits up on its stub
        // a moment first, even when he is there before it: it waits for him, looking at him)
        reached: () => arrived && k.now - sitFrom >= SIT && dist(k.ranger(), sq) <= SEE_D && measure().seen,
      });
    } finally {
      hint.off();
    }
    k.stats[`${name}_px`] = Math.round(measure().px);
    await there;
    // it saw him come: a chatter and a flick, and it is off
    chatter();
    await k.wait(0.45);
    sq.flick();
    await k.wait(0.45);
    sq.glow(false);
  };
  await hop('pijn-1', () => sq.goBranch(pineA, headingTo(pineA.trunk, oak.trunk)), TREE.a, c.volg);
  await hop('pijn-3', async () => {
    // a leap to the next pine and another to the third, then it waits there
    if (!(await sq.goLeap(pineB))) return false;
    await k.wait(0.25);
    return sq.goLeap(pineC, headingTo(pineC.trunk, pineA.trunk));
  }, TREE.c, c.weer);

  // it plays hide-and-seek: it slips off its stub round the trunk, across it from him (as
  // red squirrels do), and as he walks round — or the moment a bit of it peeks out in his
  // view — it slips round again, keeping the bark between them, never faster than he
  // walks, its chatter from behind the bark telling him where. Once he has walked about
  // half round the pine (or it slipped a few times) it stays, and he has found it the
  // moment it is in his view (the live lens: on the screen, most of it clear of the trunk
  // and of his own body): then it comes down to him.
  k.beat = 'verstop';
  const cT = TREE.c;
  const lens = (): Spot => ({ x: k.world.camera.position.x, z: k.world.camera.position.z });
  let sqAng = hideStart(pineC.trunk, [k.ranger(), lens()], STUMP);
  let slipping = 0;
  const slip = (ang: number, secs?: number): void => {
    const token = ++slipping;
    void k.guard(sq.goRound(pineC, { ang, h: HIDE.h }, secs)).then(() => { if (slipping === token) slipping = 0; }, () => {});
  };
  slip(sqAng, slipSecs(headingTo(pineC.trunk, sq), sqAng) * 0.6);
  chatter();
  k.say(c.waarIsHij);
  await k.until(() => slipping === 0, 3);
  k.stats.hide_shifts = 0;
  let lastB = headingTo(pineC.trunk, k.ranger());
  let walked = 0;
  let hid = false;
  let hiding = true;
  const step = { ...roundStep(cT, k.ranger(), sqAng) };
  const hint = seeHint(k, 'om-de-boom', () => roundStep(cT, k.ranger(), sqAng));
  const nearIt = (): boolean => { const me = k.ranger(); return dist(me, sq) < HIDE.near && Math.abs(wrap(headingTo(pineC.trunk, me) - sqAng)) < HIDE.nearAng; };
  try {
    await k.walk({
      name: 'om-de-boom', to: step, r: 0.01, line: c.waarIsHij, doel: c.chipEekhoorn, cue: c.luister, arrowAfter: 14,
      tick: () => {
        hint.tick();
        const mb = headingTo(pineC.trunk, k.ranger());
        walked += Math.abs(wrap(mb - lastB));
        lastB = mb;
        Object.assign(step, roundStep(cT, k.ranger(), sqAng)); // (the chip's way, if he needs it)
        if (!slipping && !hid) {
          // (he kept walking while it slipped off its stub: it hides anew across from where
          // his eye is now, until it is out of sight — only then does the game begin)
          if (measure().glimpse) { sqAng = hideStart(pineC.trunk, [k.ranger(), lens()], STUMP); slip(sqAng, 0.6); } else hid = true;
        } else if (!slipping && hiding) {
          // he has been round far enough: it stays where it is and lets him find it
          if (walked >= HIDE.round || k.stats.hide_shifts >= HIDE.most) hiding = false;
          else {
            // it slips round when he (or his eye, the lens) comes round toward it — or the
            // moment a bit of it peeks out past the bark in his view (the tail: a clue,
            // not a find)
            const next = hideShift(sqAng, [mb, headingTo(pineC.trunk, lens())], measure().glimpse);
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
      reached: () => hid && !hiding && !slipping && (measure().seen || (nearIt() && measure().glimpse)),
    });
  } finally {
    hint.off();
  }
  // found: in the very frame it came into his view
  k.say(c.gevonden);
  k.stats.found_px = Math.round(measure().px);
  k.stats.hide_round = Math.round((walked * 180) / Math.PI);
  sq.called();
  if (settings.geluid) Sound.callAt('eekhoorn', sq.x, sq.z, listenerOf(k.world.camera));
  lastChatter = k.now;
  // he stops (a moment with the keys resting); it pours straight down the bark on its side
  // (in his view) and pops up on the ground in front of him, sits up facing him, chatters
  k.lockFollow();
  await k.until(() => k.ranger().speed < 0.1 && !slipping, 1.5);
  const m = k.ranger();
  const ahead = m.heading; // (where he looks: the follow camera looks there too)
  // (ahead of him but off to the side away from the tree, on the open floor: straight
  // ahead his own body would hide it from the camera behind him, by the trunk it is a
  // small dark thing against the dark bark)
  const toTree = headingTo(m, pineC.trunk);
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
  // it takes an acorn from its store: it starts burying with one in its mouth
  await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z));
  await k.guard(sq.sniffHere(0.35));
  sq.carry(true);

  // 2 · it buries its acorns, one spot after another, and forgets them (corsi)
  /** Forgotten: back on its stump it looks this way and that, and chatters. */
  const forget = async (): Promise<void> => {
    if (!(await sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace))) return;
    chatter();
    if (!(await sq.look(stumpFace + 0.8))) return;
    if (!(await sq.look(stumpFace - 0.8))) return;
    await sq.look(stumpFace, 0.1);
  };
  /** the spots it buried its acorns in, in the order it did (the route) */
  const buried: { x: number; z: number }[] = [];
  await routeBeat(k, 0, {
    view: GLADE_VIEW, stand: P.stand, field: home.field,
    lines: { kijk: c.routeKijk, wijs: c.routeWijs, mis: c.routeMis, goed: k.steps[0].skin.copy?.goed ?? c.routeWijs, vergeten: c.vergeten },
    // the show: it dashes to each spot with an acorn in its mouth and digs it in (the
    // spot glows warm from the moment it gets there, all through the dig, and a breath
    // after — one clear lit spot at a time; the acorn sinks into the moss in front of
    // its nose)
    visit: async (s, light) => {
      sq.carry(true);
      if (!(await sq.goDash(s.x, s.z))) return;
      light(true);
      sq.carry(false);
      const y = sq.now.yaw;
      home.buryAcorn(s.x + Math.sin(y) * 0.07, s.z + Math.cos(y) * 0.07, 0.85);
      buried.push({ x: s.x, z: s.z });
      await sq.dig(1.0);
      await k.wait(0.35);
      light(false);
    },
    // the show over, it runs back to its stump and forgets (recall is open at once)
    shown: (first) => { if (first) { sq.carry(false); void forget().catch(() => {}); } },
    // a pick: it dashes there and sniffs — the right one it knows again (a flick of its
    // tail: here!), a wrong one it shakes off (nothing there)
    picked: async (s, res) => {
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
  });

  // it remembers them all: a happy run, spot after spot, digging each acorn up and
  // carrying it to its store by the stump — the store grows one acorn at a time
  k.say(c.stapel);
  for (const b of buried) {
    if (!(await k.guard(sq.goDash(b.x, b.z)))) break;
    const y = sq.now.yaw;
    home.unearthAcorn(b.x + Math.sin(y) * 0.07, b.z + Math.cos(y) * 0.07, 0.35);
    await k.guard(sq.dig(0.35));
    sq.carry(true);
    sq.flick();
    if (!(await k.guard(sq.goDash(HEAP_GRAB.x, HEAP_GRAB.z)))) break;
    sq.carry(false);
    home.growHeap(1);
    if (settings.geluid) Sound.dig();
  }
  if (settings.geluid) Sound.found();
  await k.guard(sq.goStump(STUMP.x, STUMP.z, STUMP.top, STUMP.r, stumpFace));
  chatter();

  // 3 · the raaf: forgotten nuts grow into trees
  await k.fact(0);

  // 4 · who else lives here? The lens turns to the neighbours round the stump and he
  //     meets them one by one: a click, and each calls and says who it is (so he knows
  //     every voice before they call together; the jay is the one eyeing the store)
  k.beat = 'buren';
  await k.walkRanger(P.callers.x, P.callers.z, 0.04);
  await k.frame(CALLERS_VIEW, { face: P.callers.heading });
  await meetNeighbours(k, home, settings.geluid);

  // 5 · the jay (the nut thief) comes down for the store; the squirrel scolds it from its
  //     stump, the neighbours call out, and he calls them back (simon)
  k.beat = 'gaai';
  k.say(c.gaaiKomt);
  home.jayDown();
  await k.wait(1.2);
  if (settings.geluid) Sound.callAt('gaai', JAY_GROUND.x, JAY_GROUND.z, listenerOf(k.world.camera));
  await k.wait(0.9);
  chatter(); // (the squirrel scolds it)
  await k.wait(0.8);
  k.say(c.roepMee);
  await k.wait(2.2);
  if (sq.body) sq.body.userData.perch = STUMP.top; // (it sits on its stump)
  const callers: Caller[] = [
    { id: 'eekhoorn', pick: sq.group, body: sq.body, at: () => ({ x: sq.x, z: sq.z }), act: (on) => { if (on) sq.called(); } },
    ...home.neighbours.map((n): Caller => ({ id: n.id, pick: n.object, body: n.body, at: () => ({ x: n.at.x, z: n.at.z }), act: (on) => { if (on) n.call(); } })),
  ];
  try {
    await callersBeat(k, 1, {
      view: null, callers,
      lines: { luister: c.luisterBuren, echo: c.naroepen, groei: c.groei, opnieuw: c.opnieuw, goed: c.goedBuren },
    });
  } finally {
    if (sq.body) delete sq.body.userData.perch; // (a stop too: it runs home off its stump)
  }
  // the jay (the nut thief) gives up and flies off over the trees
  k.say(c.gaai);
  const jay = home.neighbours.find((n) => n.id === 'gaai');
  if (settings.geluid && jay) Sound.callAt('gaai', jay.at.x, jay.at.z, listenerOf(k.world.camera));
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
