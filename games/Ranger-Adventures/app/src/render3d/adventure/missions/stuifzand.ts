/**
 * stuifzand.ts — "Het stille zand" as an adventure on the drift sand (run 7, the adventures
 * lane, package stille-zand, design `state/adventures/design.md` §5).
 *
 * A car drove over the drift sand where nightjars breed. From the marker one calm look at its
 * tyre tracks on the sand path; then he follows them, carefully (a run says why: birds breed
 * here), up the path and off its end over the open sand — where the wind blew sand over them
 * he looks for where they go on. Near this play's scrape a nightjar bursts up from the sand,
 * flutters low and comes down a few metres off, where it flops along with a wing spread as if
 * it were hurt: a parent leading him away from its eggs. "Er zit er nog een." He stands still
 * and searches the scrape: its mate pressed flat on the sand among buntgras tufts and the
 * look-alikes — a lump of bark, a dead stub, a cluster of cones, a heath blue, a stonechat
 * (zoeken). The raaf: her feathers look like dead leaves. Then he guards the place by the
 * juniper with the rabbit's burrow: one by one an animal comes by and stops in front of him,
 * and he points where it belongs now — the open sand or the burrow — by the rule on the card;
 * a wrong place and it turns back ("Daar hoort hij nu niet."); after a few the evening falls,
 * the nightjar churrs, and the rule turns ("Nu is het andersom!") (wisselen). At dusk he goes
 * back to the scrape: she shifts on her two eggs, settles again; now and then the male rises
 * and claps his wings over the sand (k.rare). "De nachtzwaluw blijft rustig op het nest."
 *
 * Every play draws under the briefing card (stuifzand.places `zandLayout`): which scrape and
 * her spot in it, which way the car passed it (the tracks and his walk), where the wind blew
 * sand over the tracks, which way the flushed parent flutters, whether a woodlark sings; the
 * light is the home's own each play (never dusk at the start: the evening falls in the guard).
 * How many look-alikes, how much of her shows, when the first hint comes, how many gaps and
 * how faint the tracks are, how many animals come to the guard place and when the rule turns
 * are the level's knobs, never this file's.
 *
 * Steps (content, the EF contract): 0 zoeken · 1 wisselen, each logged once.
 */

import * as THREE from 'three';
import './stuifzand.css';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Mission } from '../../../content/types';
import type { Play } from '../../../core/play';
import type { Residents } from '../../world/Residents';
import type { Actor } from '../actors';
import type { Spot } from '../types';
import type { MoodId } from '../../Moods';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial } from '../../../engines/zoeken';
import type { WisselBin, WisselItem } from '../../../engines/wisselen';
import { searchBeat } from '../beats/search';
import { aimBeat, type AimWorld } from '../beats/aim';
import { listenerOf } from '../../world/Residents';
import { isRunning } from '../actors-math';
import { SIZE } from '../../AnimalScale';
import { Seen, boxOf } from './ven.finds';
import { REVEAL_GAP_MS, REVEAL_SHOW_MS } from '../../../ui/hud/reveal-queue';
import { Nightjar, Lifted, ZandHome, zandBody } from './stuifzand.home';
import {
  ARRIVE, BURROW, GUARD_STAND, GUARD_VIEW, GUESTS, HOL_JUNIPER, LEAVE, MISSION, NESTS, OFF_PATH_S, PRESSED_H, SETTLE, STOP, VARIANT_KEY,
  DISPLAY_UP, ZAND_HOME, ZWALUW_LEN, approachOf, closeViewOf, displayOf, displayYaw, dist, endSpot, endViewOf, femaleAt, flushOf, gapsOf, gapsTo, GAPS_FROM, headingAt, headingTo, larkFrom, lastVariants, maleAt,
  pointAt, project, setNestNow, slotsOf, zandClearings, zandLayout,
  type Edge, type Pass, type ViewSpec, type ZandLaid,
} from './stuifzand.places';

/** The light this home starts in: any but dusk (the evening falls while he guards), a new one
 *  each play, never one of his last two plays'. */
export const STUIFZAND_MOODS = { allow: ['gouden-uur', 'ochtendnevel', 'zonnig', 'bewolkt'] as readonly MoodId[], perPlay: 2 };
/** The evening the guard turns to. */
const DUSK: MoodId = 'schemer';

/** How big (px) a thing shows in his picture, steady for a second, before it is his. */
const SEEN_PX = 40;
/** One new find's card (s), and the longest a calm moment holds on for cards still waiting. */
const CARD_S = (REVEAL_SHOW_MS + REVEAL_GAP_MS) / 1000;
/** How fast (m/s) each visitor of the guard place walks in, to its place and out. */
const PACE: Readonly<Record<string, number>> = { ree: 1.5, eekhoorn: 2.0, das: 1.15, zwijn: 1.2 };

/** Is something being said now (a call never sounds over a spoken line)? */
function speaking(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis?.speaking;
}

/** This play's drift sand, drawn and laid under the briefing card. */
let drawn: { seed: number; laid: ZandLaid } | null = null;

/** Draw this play's drift sand (from its seed and the last plays) and lay it in the world:
 *  the tracks and their gaps, the look-alikes on the scrape, the window over her, the pair. */
function lay(world: { residents: Residents }, mission: Mission, play: Play): ZandLaid | null {
  const home = world.residents.dressing(MISSION) as ZandHome | null;
  if (!home) return null;
  const s = store.get();
  const laid = zandLayout(play, lastVariants(s.geschiedenis));
  play.note(VARIANT_KEY, laid.variant);
  const zk = store.knobs('zoeken');
  // the look-alikes: the trial the 2D floor builds (the level's knobs, this play's fork), laid
  // on the scrape's own slots (which slot each: a fork of its own)
  const trial = buildZoekenTrial(mission.stappen[0].skin, zk, play.fork('zoeken').rng);
  const slots = play.fork('sz-slots').shuffle(slotsOf(laid.nest));
  const decoys = trial.decoys.map((d, i) => ({ id: d.id, k: d.k, ...slots[i % slots.length] }));
  const a = approachOf(laid.nest, laid.side);
  const gaps = gapsOf(zk.trailLegs, GAPS_FROM, gapsTo(a.passS), play.fork('sz-gaten').rng);
  home.lay({ laid, decoys, glimpse: trial.glimpse, gaps, clarity: zk.trailClarity });
  // the pair at this play's scrape (laid at once: under the card), and there after it too
  const she = { ...femaleAt(laid.nest, laid.spot), idle: 'stand' as const, roam: 0 };
  const he = { ...maleAt(laid.nest), idle: 'stand' as const, roam: 0 };
  world.residents.layout(MISSION, { zwaluw: { before: she, after: she }, man: { before: he, after: he } }, false);
  setNestNow(laid.nest, laid.spot);
  drawn = { seed: play.seed, laid };
  return laid;
}

export const stuifzandAdventure: Adventure = {
  id: MISSION,
  home: ZAND_HOME,
  clearings: zandClearings(),
  dressing: (env) => new ZandHome(env),
  actor: (spec, env, height) => zandBody(spec, env, height),
  moods: STUIFZAND_MOODS,
  /** Under the briefing card: this play's drift sand is laid. */
  prepare(world, mission, play) { lay(world, mission, play); },
  unprepare(world) { (world.residents.dressing(MISSION) as ZandHome | null)?.lay(null); drawn = null; },

  async play(k: AdventureKit): Promise<void> {
    const laid = drawn && drawn.seed === k.play.seed ? drawn.laid : lay(k.world, k.mission, k.play);
    if (!laid) throw new Error('[stuifzand] no home');
    await story(k, laid);
  },
};

/* ------------------------------------------------------------ the story ---- */

async function story(k: AdventureKit, laid: ZandLaid): Promise<void> {
  const c = k.copy;
  const fam = k.borrow();
  const home = fam.dressing as ZandHome;
  const A = fam.actors;
  for (const key of Object.keys(A)) fam.voice(key, false);
  const she = A.zwaluw as Nightjar;
  const he = A.man as Nightjar;
  const nest = NESTS[laid.nest];
  const spot = nest.spots[laid.spot];
  const ap = approachOf(laid.nest, laid.side);
  const route = ap.route;
  const zk = k.knobs('zoeken');
  k.stats.nest = laid.nest;
  k.stats.route = laid.side === 'l' ? 1 : 2;
  k.stats.look_alikes = home.laid?.decoys.length ?? 0;
  k.stats.gaps = home.laid?.gaps.length ?? 0;
  k.stats.rut_clarity = zk.trailClarity;
  // the pair where this play laid them: she pressed on her eggs, he resting by the branch
  she.place(spot.x, spot.z, spot.yaw);
  she.group.visible = true;
  she.pressFlat(true);
  she.idle();
  he.place(nest.roost.x, nest.roost.z, nest.roost.yaw);
  he.group.visible = true;
  he.idle();
  for (const key of Object.values(GUESTS)) { const g = A[key]; if (g) { g.idle(); g.group.visible = false; } }
  watchFinds(k, home);

  /* 1 · one calm look at the car's tracks on the path; he ends facing up the path */
  {
    const me = k.ranger();
    const at = project(route, me);
    const s = Math.max(at.s + 4, Math.min(OFF_PATH_S - 1, at.s + 7));
    const p = pointAt(route, s);
    await k.look({ x: p.x, z: p.z, y: k.ctx.groundY(p.x, p.z) - 0.3 }, c.kijk, 2.6, { face: headingTo(me, pointAt(route, s + 3)), seconds: 2.2 });
  }

  /* 2 · he follows the tracks, carefully; where the wind blew sand over them he looks for
     where they go on; a woodlark may rise and sing over the sand */
  {
    const gaps = home.laid?.gaps ?? [];
    let told = false, inGap = -1, larkDone = laid.lark === null;
    const larkAt = OFF_PATH_S + (ap.passS - OFF_PATH_S) * 0.35;
    const via: Spot[] = [];
    const from = project(route, k.ranger()).s;
    for (let s = Math.max(1, from + 2); s < ap.passS - 3.2 - 0.8; s += 3) via.push(pointAt(route, s));
    await k.walk({
      name: 'sporen', to: ap.approach, r: ap.approach.r, line: c.volg, doel: c.chipSporen, cue: c.cueSporen, glyph: 'tyre',
      quiet: { line: c.rustig }, via,
      tick: () => {
        const me = k.ranger();
        const at = project(route, me);
        if (at.d < 2.2) {
          // at a gap for the first time: where do they go on? (once, at the first)
          const g = gaps.findIndex((q) => at.s > q.s - 0.6 && at.s < q.s + q.len);
          if (g >= 0 && !told && g !== inGap) { told = true; inGap = g; k.say(c.gat); k.stats.gap_told = Math.round(at.s * 10) / 10; }
          else if (inGap >= 0 && g < 0 && at.s > gaps[inGap].s + gaps[inGap].len + 0.4) { inGap = -2; k.say(c.volg); }
        }
        // the woodlark: once he is a third of the way over the sand, it rises ahead of him
        if (!larkDone && at.s > larkAt && !isRunning(me)) {
          const p = larkFrom(me, me.heading, laid.lark!);
          if (p) { larkDone = true; void lark(k, home, p); }
        }
      },
    });
  }

  /* 3 · near the scrape a nightjar bursts up from the sand, flutters off low and comes down a
     few metres away, where it flops along with a wing spread as if hurt: leading him away */
  await flush(k, laid, he);

  /* 4 · "Er zit er nog een." He searches the scrape (zoeken) */
  k.say(c.nogEen);
  // (the dev read: one look-alike of this play, for a test that clicks one first)
  const look = home.decoys.find((d) => d.k === 'bush');
  if (look) { k.stats.look_x = Math.round(look.x * 100) / 100; k.stats.look_z = Math.round(look.z * 100) / 100; k.stats.look_y = Math.round((k.ctx.groundY(look.x, look.z) + 0.06) * 100) / 100; }
  await k.wait(1.2);
  await searchBeat(k, 0, {
    view: nest.views[laid.side], stand: nest.stands[laid.side], cover: home.cover, target: she, call: 'nachtzwaluw', lyingH: PRESSED_H, len: ZWALUW_LEN,
    glimpse: home.laid?.glimpse, fit: (eye, back, share) => home.fitGlimpse(eye, back, share),
    decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: d.poke })),
    lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
  });
  home.flyOff();
  // (she looked up at him; now she presses flat again, still)
  she.pressFlat(true);

  /* 5 · the raaf: her feathers look like dead leaves */
  await k.fact(0);

  /* 6-7 · he guards the place by the juniper as the evening falls (wisselen) */
  await k.walk({ name: 'struik', to: GUARD_STAND, r: GUARD_STAND.r, line: c.naarStruik, doel: c.chipStruik, glyph: 'boot', quiet: { line: c.rustig } });
  await guardLook(k);
  await guard(k, home, A, laid);

  /* 8 · back to the scrape at dusk */
  if (k.world.mood().now !== DUSK) k.world.setMood(DUSK, k.reduced ? 0 : 2.6);
  // (the male, far over the sand since the flush, comes back to rest by his branch: he flies
  // in from behind the lens as the boy walks back, never toward it)
  he.group.visible = false;
  const stand = nest.stands[laid.side];
  let heBack = false;
  await k.walk({
    name: 'nest', to: stand, r: 0.8, line: c.naarNest, doel: c.chipNest, glyph: 'boot', quiet: { line: c.rustig },
    tick: () => {
      if (heBack || dist(k.ranger(), stand) > 6) return;
      heBack = true;
      const cam = k.world.camera.position;
      const behind = { x: cam.x + (cam.x - nest.c.x) * 0.4, z: cam.z + (cam.z - nest.c.z) * 0.4 };
      he.place(behind.x, behind.z, headingTo(behind, nest.roost));
      he.lift = 3.2;
      he.group.visible = true;
      void he.fly({ ...nest.roost, lift: 0 }, { secs: 2.4, arc: 0.5, yaw: nest.roost.yaw }).then((ok) => { if (ok) he.pressFlat(true); });
    },
  });
  if (!heBack) { he.place(nest.roost.x, nest.roost.z, nest.roost.yaw); he.group.visible = true; he.pressFlat(true); }
  await nestEnd(k, home, laid, she, he);
}

/* ---------------------------------------------------------- the flush ---- */

/** The parent resting beyond the scrape flushes as he comes: up, a low flutter, down a few
 *  metres off, then the broken-wing show dragged along the sand (one held picture of him and
 *  it, side by side), then it flies off far over the sand. */
async function flush(k: AdventureKit, laid: ZandLaid, he: Nightjar): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const ap = approachOf(laid.nest, laid.side);
  const F = flushOf(laid.nest, laid.side, laid.flutter);
  k.beat = 'flush';
  const unhint = k.hint(() => null); // (a perfect player stands and watches)
  try {
    k.lockFollow();
    k.world.stopRanger();
    k.stats.flush_side = F.side === 'l' ? 1 : 2;
    // up it goes (a whirr of wings), low over the sand, sideways and ahead
    if (settings.geluid) Sound.rustle();
    k.say(c.vliegt);
    const t0 = k.now;
    const flight = he.fly({ ...F.land, lift: 0 }, { secs: 1.35, arc: 0.55, low: true });
    // (he turns to it; the lens takes one calm move to hold him and it side by side)
    const framed = k.frame(F.view as ViewSpec, { face: headingTo(ap.approach, F.land) });
    await k.guard(flight);
    await framed;
    // it flops along the sand with a wing spread, as if it were hurt
    k.say(c.gewond);
    const side: 1 | -1 = F.side === 'r' ? 1 : -1;
    const flop = he.flopTo(F.drag, 3.2, side);
    if (settings.geluid) void k.wait(0.6).then(() => { if (!speaking()) Sound.callAt('nachtzwaluw', he.x, he.z, listenerOf(k.world.camera), 18, 0.35); }).catch(() => {});
    await k.guard(flop);
    k.say(c.lokt);
    await k.wait(2.2);
    // then it flies off, far over the sand (out of his picture)
    he.sitUp();
    const off = he.fly({ ...F.away, lift: 3.0 }, { secs: 2.6, arc: 1.4 });
    void off.then((ok) => { if (ok) he.group.visible = false; });
    await k.wait(1.6);
    k.stats.flush_s = Math.round((k.now - t0) * 10) / 10;
  } finally { unhint(); }
}

/* ---------------------------------------------------------- the guard ---- */

/** At the juniper, before the first visitor: one calm look at the guard place — the burrow
 *  under the juniper in his picture (a find: its card shows now, while he stands there and
 *  nothing comes yet, never later over the eggs). */
async function guardLook(k: AdventureKit): Promise<void> {
  k.beat = 'look:struik';
  const unhint = k.hint(() => null); // (a perfect player looks)
  try {
    await k.walkRanger(GUARD_STAND.x, GUARD_STAND.z, 0.04);
    await k.frame(GUARD_VIEW, { face: GUARD_STAND.heading });
    // (the places' names come with the first visitor: no card lies over them)
    k.say(k.copy.wacht);
    k.discover('stuifzand.konijnenhol', { first: true });
    const t0 = k.now;
    await k.wait(1.6);
    // (its card, and any other new find's still waiting: shown here, two at most)
    await k.until(() => k.revealsWaiting() === 0, 2 * CARD_S);
    k.stats.guard_look_s = Math.round((k.now - t0) * 10) / 10;
  } finally { unhint(); }
}

/** The guard place: one by one an animal comes by and stops, and he points where it goes now
 *  (aimBeat over the same WisselRun the 2D floor plays); the evening falls when the rule turns. */
async function guard(k: AdventureKit, home: ZandHome, A: Readonly<Record<string, Actor>>, laid: ZandLaid): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const kant = k.play.fork('sz-kant');
  const startMood = k.mood;
  /** the visitor now at the stop, and the ones walking out (hidden once out of his picture) */
  let standing: { id: string; a: Actor } | null = null;
  const leaving = new Map<Actor, WisselBin>();
  let lastOut: WisselBin | null = null;
  /** the last animal that went to its place (it walks off too once the round is over) */
  let lastPhoto: WisselItem | null = null;
  const actorOf = (id: string): Actor => A[GUESTS[id] ?? id];
  const cam = (): THREE.Camera => k.world.camera;
  k.onTick(() => {
    for (const [a, bin] of [...leaving]) {
      if (!inPicture(cam(), a)) { a.idle(); a.group.visible = false; leaving.delete(a); void bin; }
    }
  });
  const sizeOf = (a: Actor): { len: number; h: number } => {
    const z = (SIZE as Record<string, { h: number; len?: number }>)[a.animal];
    return { len: (z?.len ?? 0.5) * (a.height / (z?.h ?? a.height)), h: a.height };
  };
  /** an animal's walk to `p` at its pace (resolves when there, or false when taken over) */
  const walk = (a: Actor, p: Spot, face?: number): Promise<boolean> => a.go(p.x, p.z, { speed: PACE[a.key] ?? 1, ...(face !== undefined ? { face } : {}) });
  const toHim = (): number => headingTo(STOP, GUARD_STAND);

  const aimWorld: AimWorld = {
    places: {
      open: { pick: home.zones.open, hint: home.hints.open },
      hol: { pick: home.zones.hol, hint: home.hints.hol },
    },
    begin: () => { home.showTags(true); },
    end: () => { home.showTags(false); home.showVisitor(null); },
    // he points: he turns to the place (the lens holds still)
    look: async (bin) => {
      const to = bin === 'open' ? SETTLE.open : SETTLE.hol;
      k.world.faceRanger(headingTo(GUARD_STAND, to));
      await k.wait(0.3);
    },
    arrive: async (item: WisselItem, index: number) => {
      const a = actorOf(item.id);
      // (one of the same kind still walking out in his picture goes first: nothing pops)
      if (a.group.visible && inPicture(cam(), a)) await k.until(() => !a.group.visible || !inPicture(cam(), a), 8);
      leaving.delete(a);
      // in from an edge of the picture (a fork of its own; not the edge the last one leaves by)
      let edge: Edge = kant.pick(['L', 'R'] as const);
      const outEdge: Edge | null = lastOut === 'open' ? 'R' : lastOut === 'hol' ? 'L' : null;
      if (index > 0 && edge === outEdge) edge = edge === 'L' ? 'R' : 'L';
      const way = ARRIVE[edge];
      if (a instanceof Lifted) a.lift = 0;
      if (a.lies) await a.lie(false);
      if (a instanceof Nightjar) {
        const from = { x: way[0].x, z: way[0].z };
        a.place(from.x, from.z, headingTo(from, STOP));
        a.lift = 1.6;
        a.group.visible = true;
        await k.guard(a.fly({ ...STOP, lift: 0 }, { secs: 1.6, arc: 0.4, yaw: toHim() + 1.4 }));
        a.pressFlat(false);
      } else {
        a.place(way[0].x, way[0].z, headingTo(way[0], way[1]));
        a.group.visible = true;
        for (const p of way.slice(1, -1)) await k.guard(walk(a, p));
        await k.guard(walk(a, STOP, toHim() + (edge === 'L' ? -1.3 : 1.3)));
      }
      standing = { id: item.id, a };
      const sz = sizeOf(a);
      home.showVisitor(STOP, sz.len, sz.h, a.yaw);
      k.stats.guard_arrivals = (k.stats.guard_arrivals ?? 0) + 1;
    },
    visitor: home.visitor,
    touch: () => {
      // a click on the animal itself: it lifts its head and looks at him (no choice)
      const s = standing;
      if (!s) return;
      void s.a.lookAt(() => ({ ...k.ranger(), speed: 0 }), 1.0).then((ok) => { if (ok && standing === s) void s.a.go(s.a.x, s.a.z, { face: s.a.yaw }); });
    },
    // the right place: it goes there and settles (a roe lies down by the juniper, the badger
    // goes into its burrow, the squirrel up into the juniper, the nightjar lands on the sand)
    photo: async (item: WisselItem, bin: WisselBin, looked: Promise<void>) => {
      const s = standing;
      standing = null;
      home.showVisitor(null);
      lastPhoto = item;
      if (!s) { await looked; return; }
      const a = s.a;
      const to = bin === 'open' ? SETTLE.open : SETTLE.hol;
      const go = async (): Promise<void> => {
        if (a instanceof Nightjar) {
          await k.guard(a.fly({ ...to, lift: 0 }, { secs: 1.3, arc: 0.35, low: true, yaw: toHim() }));
          if (bin === 'hol') a.pressFlat(true);
          return;
        }
        if (item.id === 'das' && bin === 'hol') {
          await k.guard(walk(a, BURROW, headingTo(GUARD_STAND, BURROW)));
          await sink(k, a as Lifted, -0.42, 0.9);
          a.group.visible = false;
          return;
        }
        if (item.id === 'eekhoorn' && bin === 'hol') {
          const foot = { x: HOL_JUNIPER.x - 0.75, z: HOL_JUNIPER.z - 0.62 };
          await k.guard(walk(a, foot, headingTo(foot, HOL_JUNIPER)));
          await sink(k, a as Lifted, 0.75, 0.7);
          a.group.visible = false;
          return;
        }
        await k.guard(walk(a, to, toHim() + (bin === 'open' ? 1.6 : -1.6)));
        if (item.id === 'ree' && bin === 'hol') await a.lie(true);
        else a.root(to.x, to.z, 0.3);
      };
      await Promise.all([go(), looked]);
      if (settings.geluid && !speaking()) Sound.callAt(item.id === 'wildzwijn' ? 'wildzwijn' : item.id === 'nachtzwaluw' ? 'nachtzwaluw' : item.id, a.x, a.z, listenerOf(cam()), 16, 0.5);
      await k.wait(0.4);
    },
    // the wrong place: it sets off there, stops part way, looks at him and turns back
    empty: async (bin: WisselBin) => {
      const s = standing;
      if (!s) return;
      const a = s.a;
      const to = bin === 'open' ? SETTLE.open : SETTLE.hol;
      const part = { x: STOP.x + (to.x - STOP.x) * 0.42, z: STOP.z + (to.z - STOP.z) * 0.42 };
      if (a instanceof Nightjar) {
        await k.guard(a.fly({ ...part, lift: 0 }, { secs: 0.7, arc: 0.25, low: true }));
        await a.still(0.5);
        await k.guard(a.fly({ ...STOP, lift: 0 }, { secs: 0.8, arc: 0.25, low: true, yaw: toHim() + 1.4 }));
      } else {
        await k.guard(walk(a, part));
        await k.guard(a.lookAt(() => ({ ...k.ranger(), speed: 0 }), 0.9));
        await k.guard(walk(a, STOP, toHim() + 1.3));
      }
      if (standing === s) home.showVisitor(STOP, sizeOf(a).len, sizeOf(a).h, a.yaw);
      k.stats.guard_wrong = (k.stats.guard_wrong ?? 0) + 1;
    },
    // the one before walks off out of the picture on its place's side (the badger and the
    // squirrel are in their burrow and their juniper already)
    leave: (item: WisselItem) => {
      const a = actorOf(item.id);
      if (!a.group.visible) return;
      const bin: WisselBin = Math.hypot(a.x - SETTLE.open.x, a.z - SETTLE.open.z) < Math.hypot(a.x - SETTLE.hol.x, a.z - SETTLE.hol.z) ? 'open' : 'hol';
      lastOut = bin;
      leaving.set(a, bin);
      const out = LEAVE[bin];
      if (a instanceof Nightjar) {
        const far = out[out.length - 1];
        void a.fly({ ...far, lift: 2.4 }, { secs: 2.2, arc: 0.8 });
        return;
      }
      void (async () => {
        if (a.lies) await a.lie(false);
        for (const p of out) if (!(await walk(a, p))) return;
        // (still in his picture at the way's end: on a few steps, then it is gone)
        const last = out[out.length - 1], prev = out[out.length - 2] ?? STOP;
        const L = dist(prev, last) || 1;
        await walk(a, { x: last.x + ((last.x - prev.x) / L) * 4, z: last.z + ((last.z - prev.z) / L) * 4 });
      })().catch(() => {});
    },
    leaving: (bin) => [...leaving.values()].some((b) => b === bin),
    // the evening falls (or the day comes back): the light turns, the nightjar churrs
    turn: async (to) => {
      k.world.setMood(to === 'night' ? DUSK : startMood, k.reduced ? 0 : 2.6);
      await k.wait(1.2);
      if (to === 'night' && settings.geluid && !speaking()) Sound.callAt('nachtzwaluw', HOL_JUNIPER.x + 8, HOL_JUNIPER.z + 3, listenerOf(cam()), 30);
      await k.wait(1.6);
      k.stats.turns = (k.stats.turns ?? 0) + 1;
    },
    miss: () => { if (settings.geluid) Sound.step(); },
  };
  await aimBeat(k, 1, {
    view: GUARD_VIEW, stand: GUARD_STAND, world: aimWorld, tag: 'beeld',
    lines: {
      vraag: c.vraag, komt: (id) => c[`kijk_${id}`] ?? c.vraag, kijk: (id) => c[`kijk_${id}`] ?? c.vraag,
      foto: c.goed, leeg: c.leeg, nacht: c.avond, dag: c.dag, andersom: c.andersom,
      goed: k.steps[1].skin.copy?.goed ?? c.goed,
    },
  });
  // the last one walks off too
  const last = lastPhoto as WisselItem | null;
  if (last) aimWorld.leave(last);
  void laid;
}

/** The badger into its burrow, the squirrel up into the juniper: it sinks (or rises) `by` m
 *  over `secs`, then the script hides it. */
function sink(k: AdventureKit, a: Lifted, by: number, secs: number): Promise<boolean> {
  const from = a.lift, t0 = k.now;
  return k.until(() => {
    const t = Math.min(1, (k.now - t0) / Math.max(0.05, k.reduced ? 0.05 : secs));
    a.lift = from + by * t * t * (3 - 2 * t);
    return t >= 1;
  });
}

/* ----------------------------------------------------- back at the nest ---- */

/** At dusk by the scrape: he steps back and gives her room, and the lens comes close to her —
 *  the tufts lean aside, she shifts off her two speckled eggs and settles on them again (the
 *  eggs' card shows here, with its moment). Now and then (k.rare) the male rises from his branch
 *  and claps his wings over the sand: one calm move back to the dusk picture, held through the
 *  reunion. The reunion: she stays calmly on her nest while he churrs in the dusk. */
async function nestEnd(k: AdventureKit, home: ZandHome, laid: ZandLaid, she: Nightjar, he: Nightjar): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  // (he steps back beside the lens's way in: out of its picture, he gives her room)
  const back = endSpot(laid.nest, laid.side);
  await k.walkRanger(back.x, back.z, 0.04);
  k.beat = 'look:nest';
  const unhint = k.hint(() => null); // (a perfect player looks)
  try {
    await k.frame(closeViewOf(laid.nest, laid.spot), { face: back.heading });
    // the tufts in front of her lean aside (she is in plain view now), and she shifts off her
    // eggs: two speckled eggs on the sand
    home.cover.partAt(she.x, she.z, 0.55, 0.6, 30);
    await k.wait(0.7);
    she.pressFlat(false);
    she.shift(true);
    await k.wait(0.5);
    home.showEggs(true);
    k.say(c.eitjes);
    k.discover('stuifzand.eieren', { first: true });
    k.stats.eggs = 1;
    await k.wait(2.8);
    she.shift(false);
    await k.wait(0.7);
    home.showEggs(false);
    she.pressFlat(true);
    k.say(null);
    // (the eggs' card, when they are new, is seen here, with them: never over what comes next)
    await k.until(() => k.revealsWaiting() === 0, CARD_S);
    await k.until(() => he.grounded, 3);
    he.idle();
    // now and then the male rises from his branch and claps his wings over the sand: the lens
    // draws back once, low over the sand, and holds there through the reunion
    if (k.rare()?.id === 'stuifzand.vlucht') {
      await k.frame(endViewOf(laid.nest, laid.spot), { face: back.heading });
      k.say(c.vlucht);
      he.onClap = () => { if (settings.geluid) Sound.call('vleugelklap'); };
      let seenClap = 0;
      const off = k.onTick((dt) => {
        if (!he.group.visible || he.lift < 0.6 || !inPicture(k.world.camera, he)) return;
        seenClap += dt;
        // (dev read: how big he shows with his wings open, px across the picture)
        const span = he.spanPx(k.world.camera, k.ctx.canvas.clientWidth || 1280, k.ctx.canvas.clientHeight || 800);
        if (span > (k.stats.display_px ?? 0)) k.stats.display_px = Math.round(span);
      });
      await k.guard(he.display(displayOf(laid.nest, laid.spot), DISPLAY_UP, displayYaw(laid.nest, laid.spot)));
      off();
      k.stats.display_seen = Math.round(seenClap * 10) / 10;
      if (seenClap > 0.6) k.discover('stuifzand.vlucht', { first: true });
      await k.wait(0.6);
      k.say(null);
    }
  } finally { unhint(); }
  // she stays calmly on her nest (the reunion's line over her), the male churring nearby
  await k.reunion(async () => {
    if (settings.geluid && !speaking()) Sound.callAt('nachtzwaluw', he.x, he.z, listenerOf(k.world.camera), 20);
    await k.wait(2.6);
    await k.until(() => k.revealsWaiting() === 0, 2 * CARD_S);
  }, { holdS: Math.max(2, Math.min(2, k.revealsWaiting()) * CARD_S) });
  /* the raaf: by day and by night other animals live here */
  await k.fact(1);
}

/* ------------------------------------------------------- the woodlark ---- */

/** A woodlark rises from the sand ahead of him and sings up into the sky: his once he heard
 *  its song (close enough). */
async function lark(k: AdventureKit, home: ZandHome, at: Spot): Promise<void> {
  const settings = store.get().settings;
  k.stats.lark = 1;
  const up = home.larkUp(at, k.reduced, 7);
  let heard = false;
  for (let i = 0; i < 5; i++) {
    await k.wait(i === 0 ? 0.5 : 1.3);
    const o = home.lark;
    if (!o?.visible) break;
    if (settings.geluid && !speaking()) {
      const d = Sound.callAt('boomleeuwerik', o.position.x, o.position.z, listenerOf(k.world.camera), 32);
      if (d > 0 && !heard && dist(k.ranger(), { x: o.position.x, z: o.position.z }) < 25) { heard = true; k.discover('stuifzand.leeuwerik', { heard: true }); }
    }
  }
  // (without sound he sees it rise: a lark seen in his picture counts too)
  if (!heard && home.lark && inPicture(k.world.camera, null, home.lark)) k.discover('stuifzand.leeuwerik');
  await up;
}

/* ------------------------------------------------------- what he saw ---- */

/** The anthill, his once he really saw it on his way (in his picture, big enough, for a
 *  moment). */
function watchFinds(k: AdventureKit, home: ZandHome): void {
  const seen = new Seen(
    () => ({ cam: k.world.camera, w: k.ctx.canvas.clientWidth || 1280, h: k.ctx.canvas.clientHeight || 800, me: k.ranger() }),
    (id) => { k.discover(id); k.stats[`seen_${id.slice(id.indexOf('.') + 1)}`] = Math.round(k.now); },
  );
  const anthill = home.group.getObjectByName('stuifzand-anthill');
  seen.watch({ id: 'stuifzand.mierenhoop', box: () => (anthill ? boxOf(anthill) : null), px: SEEN_PX, secs: 1, within: 9, when: () => /^walk:/.test(k.beat) });
  k.onTick((dt) => seen.tick(dt));
}

/** Is an animal (or an object) in the lens's picture now (any of it)? */
function inPicture(cam: THREE.Camera, a: Actor | null, o?: THREE.Object3D): boolean {
  const box = new THREE.Box3();
  if (a) {
    const z = (SIZE as Record<string, { h: number; len?: number }>)[a.animal];
    const len = (z?.len ?? 0.5) * (a.height / (z?.h ?? a.height));
    const y = a.group.position.y;
    box.set(new THREE.Vector3(a.x - len / 2, y, a.z - len / 2), new THREE.Vector3(a.x + len / 2, y + a.height, a.z + len / 2));
  } else if (o) box.setFromObject(o);
  else return false;
  cam.updateMatrixWorld();
  const V = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    V.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    if (V.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.2) continue;
    V.project(cam);
    if (Math.abs(V.x) < 1.04 && Math.abs(V.y) < 1.04) return true;
  }
  return false;
}

/** (the places' own, for a reader) */
export { headingAt };
export type { Pass };
