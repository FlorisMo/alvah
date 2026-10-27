/**
 * ven.ts — "De kikker in het ven" as an adventure in the world (run 7, design
 * `state/adventures/design.md` §3).
 *
 * The heikikkers call from the far north bank of the ven; little rings spread on the water
 * where they sit. After one calm look across the water, the ranger follows the sound round
 * the bird hide and along the shore path, by ear: when he runs they fall silent ("Sst. Nu
 * zijn ze stil."), and only once he has stood still do they call again; at a few listening
 * stops they fall silent by themselves ("Sta stil. Luister."). On the way this play's three
 * calm moments wait for him, in this play's order, played with his FEET: an adder basking
 * on the warm sand of the path (keep your distance until she slides off into the heather),
 * a carpet of soft wet veenmos across the path and down to the water (walk round it above,
 * or a boot sinks in), and right after one of them the dry path is free (walk on; standing
 * there is the old rule). At the cove the frogs call once more; then he searches the water's
 * edge for the brown frog, dead still between the sedge and the moss among look-alike moss
 * clods (ZOEKEN). He keeps still and it sings for him; the other coves answer; it plops back
 * into the ven.
 *
 * Every play draws its own bank under the briefing card (ven.places `venLayout`): the cove
 * (never one of his last two plays'), the frog's spot in it, the order of the three moments
 * (the dagnacht trial's own, the 2D floor's too) and so which station holds the adder and
 * which the moss, the adder's exact spot and turn, the look-alikes' slots. How clear the
 * chorus is, how often he stops to listen, how many look-alikes, how much of the frog shows,
 * when the hint comes, how long the adder wants him to wait and how long the dry path lets
 * him stand are the level's knobs, never this file's.
 *
 * Steps (content, the EF contract): 0 zoeken · 1 dagnacht, each logged once.
 */

import * as THREE from 'three';
import type { AdventureKit } from '../kit';
import type { Adventure } from '../registry';
import type { Mission } from '../../../content/types';
import type { Play } from '../../../core/play';
import type { Residents } from '../../world/Residents';
import type { Spot } from '../types';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { buildZoekenTrial } from '../../../engines/zoeken';
import { searchBeat } from '../beats/search';
import { choiceRun, type ChoiceRun } from '../beats/choice';
import { listenerOf } from '../../world/Residents';
import { isRunning } from '../actors-math';
import { dist, headingTo } from '../places';
import { ARRIVE_RADIUS, bearing, cue as cueAt } from '../../Wayfinding';
import { VEN_CENTER, WATER_LEVEL } from '../../Biomes';
import { VenHome, venBody, type Frog } from './ven.home';
import { ListenCore, StillFor, chorusCalls, listensOf, ringSize } from './ven.listen';
import { BLUE_ID, LIFE_KEY, SEEN, VEN_MOODS, blueOf, lastLifeOf, lifeTag, venLife } from './ven.life';
import { Seen, boxOf } from './ven.finds';
import type { MoodId } from '../../Moods';
import { REVEAL_GAP_MS, REVEAL_SHOW_MS } from '../../../ui/hud/reveal-queue';
import {
  ADDER_NEAR, ADDER_WARN, BAYS, BAY_IDS, CARPET_A, CARPET_SEEN, CARPET_WET, CHORUS_KEYS, FROG_H, FROG_LEN, GO_AWAY, HINT_RING, MISSION, VARIANT_KEY,
  VEN_HOME, AFTER_FROG, adderAt, answerOrder, answerView, plopOf, adderHeather, adderHoldHeading, adderView, between, carpetAt, frogOf, decoySlots, hintRingOf, lastVenVariants, lookAim, pointAt,
  padGoal, project, route, singOf, stationsOf, venClearings, venLayout, venOrder, wayOf, type BayId, type VenLaid, type WayStep,
} from './ven.places';
import { narrator } from '../../../core/narrator';

/** The keys that would take a step (the song asks him to keep still). */
const STEP_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;

/** How far (m) the chorus of this play's cove carries while he follows it (the bank is
 *  ~40 m round from the marker: he hears it from the start). */
const CHORUS_REACH = 48;
/** One "woog" (s): a call is held to as many of them as the level's chorus has. */
const WOOG_S = 0.25;
/** He keeps still this long (s) and the frog he found sings. */
const SING_STILL_S = 1.5;

/** Is something being said now (a call never sounds over a spoken line)? */
function speaking(): boolean {
  return narrator.busy();
}
/** He waited for a line to end at most this long (s): a voice that never says it is done
 *  never holds the frogs up. */
const READ_MAX_S = 3.5;

/** One new find's card (s; ui/hud/reveal-queue.ts), and the longest a stop waits for the
 *  cards still waiting: two of them. */
const CARD_S = (REVEAL_SHOW_MS + REVEAL_GAP_MS) / 1000;
const CARDS_MAX_S = 2 * CARD_S;

/**
 * A new find's card shows on his way (the ree's walkCards): where one still waits as a walk
 * ends (the slang seen in her own moment, a dragonfly seen on a short stretch), he stops
 * there, the beat still the walk's (a calm moment for the reveal gate), until it has been
 * seen — two cards' time at most. Most walks wait for none.
 */
async function walkCards(k: AdventureKit): Promise<void> {
  if (!k.revealsWaiting() || k.stats.walk_cards_stalled) return;
  k.lockFollow();
  k.world.stopRanger();
  const t0 = k.now;
  const waiting = k.revealsWaiting();
  await k.until(() => k.revealsWaiting() === 0, CARDS_MAX_S);
  k.stats.walk_cards_s = Math.round(((k.stats.walk_cards_s ?? 0) + k.now - t0) * 10) / 10;
  // (a stop in which no card came at all — the browser's voice stuck 'speaking', so the
  // reveal never finds its quiet moment — is never made again this play: he walks on, and
  // the cards wait for the reveal's own quiet moment; the close saw 5 such stops, 56 s)
  if (k.revealsWaiting() >= waiting) k.stats.walk_cards_stalled = 1;
}

/** This play's bank, drawn and laid under the briefing card. */
let drawn: { seed: number; laid: VenLaid } | null = null;

/** Draw this play's bank (from its seed and the ven's last plays) and lay it in the world:
 *  the frog hidden in its cove, the look-alikes, the adder on the path, the soft moss. */
function lay(world: { residents: Residents }, mission: Mission, play: Play): VenLaid | null {
  const home = world.residents.dressing(MISSION) as VenHome | null;
  if (!home) return null;
  const s = store.get();
  // the three moments' order: the very trial the run (and the 2D floor) plays this play
  const order = venOrder(mission.stappen[1].skin, store.knobs('dagnacht'), play, s.geschiedenis, s.settings.jargon);
  const last = lastVenVariants(s.geschiedenis);
  const laid = venLayout(play, order, last);
  // the look-alikes: the trial the 2D floor builds (the level's knobs, this play's fork),
  // laid on the cove's own slots
  const trial = buildZoekenTrial(mission.stappen[0].skin, store.knobs('zoeken'), play.fork('zoeken').rng);
  const bay = BAYS[laid.bay];
  const slots = decoySlots(bay, laid.nook, trial.decoys.map((d) => ({ id: d.id, k: d.k })), play.fork('ven-slots').rng);
  const frog = frogOf(laid);
  const sts = stationsOf(laid.bay, laid.side);
  const adder = laid.order.includes('adder-ven') ? adderAt(laid.bay, laid.side, sts[laid.stations['adder-ven']], laid.adderShift, laid.adderTurn) : null;
  const carpet = laid.order.includes('modder-ven') ? carpetAt(sts[laid.stations['modder-ven']]) : null;
  // what lives on the bank this play (the ducks' loop never the last play's): its own forks
  const mood = (typeof play.variant?.mood === 'string' ? play.variant.mood : 'gouden-uur') as MoodId;
  const life = venLife(play, mood, laid, lastLifeOf(last[last.length - 1]));
  // (the duck family and the feather ride on the cove's variant: the next play reads them back)
  play.note(VARIANT_KEY, `${laid.variant}/${lifeTag(life)}`);
  play.note(LIFE_KEY, life.variant);
  home.lay({ laid, frog, decoys: slots, glimpse: trial.glimpse, adder, carpet, life: { life, bay: laid.bay, sat: frog, blue: false } });
  // the frog sits hidden in its cove (put there at once: nobody sees it under the sedge)
  world.residents.repose(MISSION, 'kikker', 'before', { x: frog.x, z: frog.z, yaw: frog.yaw, idle: 'stand', roam: 0 });
  drawn = { seed: play.seed, laid };
  return laid;
}

export const venAdventure: Adventure = {
  id: MISSION,
  home: VEN_HOME,
  clearings: venClearings(),
  dressing: (env) => new VenHome(env),
  actor: venBody,
  // every play in its own light, never one of the last two plays' (the frog reads the same
  // in all five: ven-life's search check; the bank's life is picked to fit the light)
  moods: VEN_MOODS,
  /** Under the briefing card: this play's bank is laid. */
  prepare(world, mission, play) { lay(world, mission, play); },
  unprepare(world) { (world.residents.dressing(MISSION) as VenHome | null)?.lay(null); drawn = null; },

  async play(k: AdventureKit): Promise<void> {
    const laid = drawn && drawn.seed === k.play.seed ? drawn.laid : lay(k.world, k.mission, k.play);
    if (!laid) throw new Error('[ven] no home');
    await story(k, laid);
  },
};

/** The adventure, beat by beat. */
async function story(k: AdventureKit, laid: VenLaid): Promise<void> {
  const c = k.copy;
  const fam = k.borrow();
  const home = fam.dressing as VenHome;
  const A = fam.actors as Record<string, Frog>;
  const frog = A.kikker;
  const id = laid.bay;
  const bay = BAYS[id];
  const stand = bay.stands[laid.side];
  const l = route(id, laid.side);
  const singer = A[CHORUS_KEYS[id]];
  const settings = store.get().settings;
  const life = home.life;
  watchLife(k, home);
  const zk = k.knobs('zoeken');
  const calls = chorusCalls(zk.trailClarity);
  const rings = ringSize(zk.trailClarity);
  k.stats.chorus_calls = calls;
  // (the stops on his way, the cove's own one more: counted from the way itself below)
  k.stats.look_alikes = home.laid?.decoys.length ?? 0;
  // the frogs are this script's now: their free-roam calls rest
  for (const key of Object.keys(A)) fam.voice(key, false);
  // the three moments in this play's order (the same DagnachtRun the 2D floor plays)
  const rust = choiceRun(k, 1);
  const trialOrder = rust.trial.encounters.map((e) => e.id);
  if (trialOrder.join() !== laid.order.join()) console.warn(`[ven] the bank was laid for ${laid.order.join()} but the run plays ${trialOrder.join()}`);

  /** The cove's chorus calls: `n` soft woogs from its frog in the water, rings round it. */
  const chorus = (n = calls, from: Frog = singer, reach = CHORUS_REACH): void => {
    // (a frog gone under the water still calls: the rings show where)
    if (from.group.visible) from.sing(n);
    home.ring(from.x, from.z, rings);
    if (settings.geluid && !speaking()) Sound.callAt('heikikker', from.x, from.z, listenerOf(k.world.camera), reach, n * WOOG_S + 0.08);
  };
  /** A call from a spot on land (the frogs just beyond the adder: no rings there). */
  const callFrom = (p: Spot, n = 1): void => {
    if (settings.geluid && !speaking()) Sound.callAt('heikikker', p.x, p.z, listenerOf(k.world.camera), CHORUS_REACH, n * WOOG_S + 0.08);
  };

  // the frog sits hidden in its cove (on a replay it may still be under the water)
  const spot = frogOf(laid);
  frog.place(spot.x, spot.z, spot.yaw);
  frog.group.visible = true;
  frog.idle();
  // the chorus frogs float in their coves
  for (const b of BAY_IDS) {
    const f = A[CHORUS_KEYS[b]];
    if (!f.group.visible || f.lift < -0.05) { f.group.visible = true; void f.dive(true, 0.6); }
  }

  /* 1 · one calm look across the water at this play's cove: rings where they call */
  const lookAt = { x: singer.x, z: singer.z, y: WATER_LEVEL };
  const t0 = k.now;
  let looked = 0;
  const offLook = k.onTick(() => {
    const t = k.now - t0;
    if ((looked === 0 && t > 1.2) || (looked === 1 && t > 4.4)) { looked += 1; chorus(Math.max(2, calls)); }
  });
  try {
    // (a short, slow glide toward the cove, aimed through the calling frog, and straight back
    // behind him: he turns himself when he walks — ven.places lookAim)
    const aim = lookAim(k.world.camera.position, lookAt, (x, z) => k.ctx.groundY(x, z));
    await k.look(aim.at, c.kijk, 2.6, { seconds: aim.seconds });
  } finally { offLook(); }

  /* 2-5 · he follows the chorus along the bank; the moments on the way */
  const listen = new ListenCore(zk.trailClarity, k.play.fork('ven-koor').rng);
  let curS = Math.min(project(l, k.ranger()).s, 6);
  /** The chorus while he walks: running hushes it, standing still brings it back. */
  const tickChorus = (dt: number): void => {
    const m = k.ranger();
    const e = listen.tick(dt, { running: isRunning(m), speed: m.speed });
    if (e === 'hush') { k.say(c.sst); k.stats.hushes = listen.hushes; }
    else if (e === 'back') { k.say(c.weer); chorus(); }
    else if (e === 'call') chorus();
  };
  /** A walk along his way to `s` (m along the route), the chorus calling. */
  const walkTo = async (name: string, s: number, opts: { r?: number; tick?: (dt: number) => void; via?: Spot[]; doel?: string } = {}): Promise<void> => {
    const to = pointAt(l, s);
    await k.walk({
      name, to, r: opts.r ?? 1.1, line: listen.hushed ? c.sst : c.volg, doel: opts.doel ?? c.chipKikkers, cue: c.luister, glyph: 'ear',
      via: opts.via ?? between(l, curS, s),
      tick: (dt) => { tickChorus(dt); opts.tick?.(dt); },
    });
    curS = Math.max(curS, s);
    await walkCards(k);
  };
  /** A listening stop: the frogs fall silent; he stands still; they call (and rings). */
  const listenStop = async (line = c.staStil): Promise<void> => {
    k.beat = 'listen';
    listen.pause();
    k.say(line);
    const unhint = k.hint(() => null); // (a perfect player keeps still)
    const still = new StillFor();
    let dt = 0;
    const offDt = k.onTick((d) => { dt = d; });
    const t0 = k.now;
    try {
      await k.wait(0.6);
      await k.until(() => still.tick(dt, k.ranger().speed) && (!speaking() || k.now - t0 > READ_MAX_S));
    } finally { unhint(); offDt(); }
    chorus();
    k.stats.listened = (k.stats.listened ?? 0) + 1;
    await k.wait(Math.max(0.9, calls * WOOG_S + 0.4));
    listen.resume(2.4);
  };

  const way = wayOf(laid, listensOf(zk.trailLegs));
  k.stats.listen_stops = way.filter((st) => st.kind === 'listen').length + 1;
  for (const step of way) {
    k.check();
    if (step.kind === 'listen') {
      await walkTo('kikkers', step.s);
      await listenStop();
      k.say(c.volg);
    } else if (step.kind === 'adder') {
      await adderMoment(k, rust, home, laid, step, { walkTo, listen, callFrom, curS: () => curS });
    } else if (step.kind === 'modder') {
      await mossMoment(k, rust, home, laid, step, { walkTo, listen, tickChorus, setS: (s) => { curS = Math.max(curS, s); } });
    } else if (step.kind === 'pad') {
      listen.pause();
      const enc = rust.current!;
      // (the walk on is set now, from where he really stands: the moment before it may have
      // ended with him further on, at or past where it was planned to go)
      const goal = padGoal(id, laid.side, step.s, k.ranger());
      k.stats.pad_goal_m = Math.round(dist(k.ranger(), goal.to) * 100) / 100;
      await rust.go('pad-ven', {
        line: `${enc.vraag} ${c.loopDoor}`, family: () => goal.from, to: goal.to, doel: c.chipPad, cue: c.luister, glyph: 'footprints',
        hush: c.sst, away: GO_AWAY,
        // (standing there: the frogs ahead stay silent, then the words, the moment again)
        wrong: async () => { await k.wait(0.6); },
      });
      curS = Math.max(curS, project(l, k.ranger()).s);
      listen.resume(1.6);
      k.free();
    } else if (step.kind === 'bay') {
      if (!rust.next()) rust.done();
      // down the bank to the cove
      await walkTo('cove', l.length, { r: 0.7, doel: c.chipWater });
    }
  }
  if (!rust.next()) rust.done();

  /* 6 · at the cove: he stands still and listens; the frogs call from its water */
  life.slipIn(id);
  k.world.faceRanger(stand.heading!);
  await listenStop();
  // (the calling frogs go under: the picture of the cove is the hidden frog's alone)
  await Promise.all(BAY_IDS.map((b) => A[CHORUS_KEYS[b]].dive(false, 0.8)));

  /* 7 · find the frog at the water's edge (zoeken) */
  // (the dev read: one moss clod of this play, for a test that clicks a look-alike first)
  const clod = home.decoys.find((d) => d.k === 'bush');
  if (clod) {
    k.stats.clod_x = Math.round(clod.x * 100) / 100;
    k.stats.clod_z = Math.round(clod.z * 100) / 100;
    k.stats.clod_y = Math.round((k.ctx.groundY(clod.x, clod.z) + 0.05) * 100) / 100;
  }
  let hinted = false;
  const offHint = k.onTick(() => {
    // the late hint (searchBeat's own line): he calls — his throat swells — and rings by him
    if (!hinted && k.beat === 'search' && k.ui.current === c.hint) {
      hinted = true;
      let next = k.now;
      // (the rings on the open water just in front of him: the same distance from him and
      // the same size at every nook, ven.places `hintRingOf`)
      const ringAt = hintRingOf(bay, frog);
      const off = k.onTick(() => {
        if (k.beat !== 'search') { off(); return; }
        if (k.now < next) return;
        next = k.now + 3.2;
        frog.sing(1);
        home.ring(ringAt.x, ringAt.z, HINT_RING.size);
      });
    }
  });
  try {
    await searchBeat(k, 0, {
      view: bay.views.search[laid.side], stand, cover: home.cover, target: frog, call: 'heikikker', lyingH: FROG_H, len: FROG_LEN,
      glimpse: home.laid?.glimpse, fit: (eye, back, share) => home.fitGlimpse(eye, back, share),
      decoys: home.decoys.map((d) => ({ id: d.id, object: d.object, x: d.x, z: d.z, poke: d.poke })),
      lines: { zoek: c.zoek, mis: c.mis, hint: c.hint, gevonden: k.steps[0].skin.copy?.goed ?? c.zoek },
    });
  } finally { offHint(); }

  // (found: the heath blue and the stonechat fly off, the cove is the frog's now)
  home.flyOff();

  /* 8 · the raaf: he sits still, so the birds don't see him */
  await k.fact(0);

  /* 9 · he keeps still, and the frog sings: three-quarters toward the lens from just over
     the water, the boy behind him on the bank; then the other coves answer */
  k.beat = 'sing';
  const sat = frogOf(laid);
  const sing = singOf(bay, sat);
  // (a frog a step up the bank hops down to the water's edge first: in the search's picture
  // still, a hop or two of at most ~0.65 m — it sings at the edge)
  const edge = sing.at;
  const hops = Math.ceil(dist(frog, edge) / 0.65 - 0.05);
  if (hops > 0) {
    await k.wait(0.3);
    const from = { x: frog.x, z: frog.z };
    for (let i = 1; i <= hops; i++) {
      await k.guard(frog.hop({ x: from.x + ((edge.x - from.x) * i) / hops, z: from.z + ((edge.z - from.z) * i) / hops }, 0.42));
      await k.wait(0.25);
    }
  }
  // (the lens looks back from over the water: one soft dip-cut, never a swing round him;
  // the sedge on the water's side of him leans aside, so he sits in plain view; he turns
  // calmly to sing toward the open water, his throat to the lens)
  home.openForSong(k.lensFor(sing.view).cam, { x: frog.x, z: frog.z, yaw: sing.yaw });
  const turnTo = { x: frog.x + Math.sin(sing.yaw), z: frog.z + Math.cos(sing.yaw), speed: 0 };
  void frog.lookAt(() => turnTo, 60);
  await k.frame(sing.view, { dip: true });
  k.say(c.zingen);
  let movedAt = k.now;
  let told = -9;
  const onKey = (e: KeyboardEvent): void => {
    if (!STEP_KEYS.test(e.code) || k.world.menuShown()) return;
    movedAt = k.now;
    if (k.now - told > 1.6) { told = k.now; k.say(c.wacht); k.stats.sing_moves = (k.stats.sing_moves ?? 0) + 1; }
  };
  window.addEventListener('keydown', onKey);
  const unhint = k.hint(() => null);
  try {
    await k.wait(0.8);
    const t1 = k.now;
    try {
      await k.until(() => k.now - movedAt >= SING_STILL_S && (!speaking() || k.now - t1 > READ_MAX_S));
    } finally {
      // (he sings now: a step no longer asks him to wait — the frogs' answer is next)
      window.removeEventListener('keydown', onKey);
    }
    // his throat swells, three soft calls; the first and the last send rings over the water
    // at his feet (he sings at the very edge: they spread from under him)
    for (let i = 0; i < 3; i++) {
      frog.sing(1);
      if (i !== 1) home.ring(edge.x, edge.z, HINT_RING.size);
      if (settings.geluid) Sound.callAt('heikikker', frog.x, frog.z, listenerOf(k.world.camera), 25, WOOG_S + 0.05);
      await k.wait(0.62);
    }
    await k.wait(0.4);
    // the answer: the lens draws calmly back over the water until the nearest answering
    // cove is in the picture too; its frog comes up and calls (rings), then the far one
    const [nearCove, farCove] = answerOrder(id);
    const near = A[CHORUS_KEYS[nearCove]];
    if (!near.group.visible || near.lift < -0.05) { near.group.visible = true; void near.dive(true, 0.7); }
    k.say(c.terug);
    if (life.laid?.blue) {
      // the rare: the first to answer is a sky-blue frog — it comes up out of the water
      // beside his, climbs onto the moss and calls (the picture draws back just for it)
      await k.frame(answerView(bay, sat, blueOf(bay, sat)));
      const blue = await k.guard(life.blueRise());
      if (blue) {
        await k.wait(0.3);
        blue.sing(2);
        if (settings.geluid && !speaking()) Sound.callAt('heikikker', blue.x, blue.z, listenerOf(k.world.camera), 25, 2 * WOOG_S + 0.08);
        k.say(c.blauw ?? c.terug);
        k.stats.blue_frog = 1;
        await k.wait(2.2);
      }
    } else await k.frame(answerView(bay, sat));
    chorus(2, near, 60);
    await k.wait(1.3);
    chorus(2, A[CHORUS_KEYS[farCove]], 60);
    await k.wait(0.6);
    chorus(1, near, 60);
    await k.wait(1.2);
    k.stats.answered = 2;
  } finally {
    window.removeEventListener('keydown', onKey);
    unhint();
  }

  /* 10 · the frog plops back into the ven (seen in the answer's picture); one frog climbs
     out onto bay B's moss */
  const into = plopOf(bay, sat);
  const keeper = A[CHORUS_KEYS.B];
  await k.reunion(async () => {
    await k.wait(0.6);
    await frog.leap(into, 0.7);
    if (settings.geluid) Sound.plop();
    // (the blue frog plops back after him)
    if (life.laid?.blue) window.setTimeout(() => { if (!k.signal.aborted) void life.blueGo(); }, 900);
    // (the other coves' frogs go under; one of the ven's frogs comes up and climbs onto
    // bay B's moss cushion, where it lives after)
    for (const b of BAY_IDS) if (b !== 'B' && b !== id) void A[CHORUS_KEYS[b]].dive(false, 1.2);
    if (!keeper.group.visible || keeper.lift < -0.05) { keeper.group.visible = true; await keeper.dive(true, 0.8); }
    void keeper.go(AFTER_FROG.x, AFTER_FROG.z, { speed: 0.35, face: AFTER_FROG.yaw });
    await k.wait(3.4);
    // (the line holds on for every new find's card still waiting — the blue frog he just
    // saw, a feather on the last stretch — two at most: never after the reward instead)
    if (!k.stats.walk_cards_stalled) await k.until(() => k.revealsWaiting() === 0, CARDS_MAX_S);
  }, { holdS: k.stats.walk_cards_stalled ? 0 : Math.min(2, k.revealsWaiting()) * CARD_S });
  /* 11 · the raaf: what a ven is */
  await k.fact(1);
}

/**
 * The ven alive while he plays (package ven-life): this play's rare (the blue frog: made now,
 * it comes at the answer), the small surprises only while he walks (a frog plops in, the
 * heath blue flutters up; never in a search, a hold or a listening stop), one dragonfly that
 * comes up to him on his way, and what he REALLY saw goes in his veldgids (`k.discover`: in
 * his picture, big enough, near enough, long enough — its calm reveal waits for a walk, a
 * look or the ending).
 */
function watchLife(k: AdventureKit, home: VenHome): void {
  const life = home.life;
  life.setBlue(k.rare()?.id === BLUE_ID);
  const ll = life.laid?.life;
  if (ll) {
    k.stats.life_ducklings = ll.ducks.count;
    k.stats.life_libellen = ll.libellen.length;
    k.stats.life_vlinder = ll.vlinder === null ? -1 : ll.vlinder;
    k.stats.life_veer = ll.veer === null ? -1 : ll.veer;
    k.stats.life_plops = ll.plops.length;
    k.stats.life_blue = life.laid?.blue ? 1 : 0;
  }
  const seen = new Seen(
    () => ({ cam: k.world.camera, w: k.ctx.canvas.clientWidth || 1280, h: k.ctx.canvas.clientHeight || 800, me: k.ranger() }),
    (id) => { k.discover(id); k.stats[`seen_${id.slice(id.indexOf('.') + 1)}`] = Math.round(k.now); },
  );
  const fly = (): THREE.Box3 | null => {
    const me = k.ranger();
    let best: THREE.Vector3 | null = null, bd = Infinity;
    for (const f of life.dragonflies()) { const d = Math.hypot(f.pos.x - me.x, f.pos.z - me.z); if (d < bd) { bd = d; best = f.pos; } }
    return best ? new THREE.Box3().setFromCenterAndSize(best, new THREE.Vector3(0.24, 0.06, 0.24)) : null;
  };
  // (the mother herself must read as a duck: the family's spread, ducklings trailing metres
  // behind her, made a far-off family of specks look big enough)
  seen.watch({ id: 'ven.eend', box: () => (life.motherObject ? boxOf(life.motherObject) : null), ...SEEN.eend });
  // (in her own moment, not on his walk up to her: its card came before he had met her)
  seen.watch({ id: 'ven.adder', box: () => (home.adderBody ? boxOf(home.adderBody) : null), when: () => /^(adder|still:adder)/.test(k.beat), ...SEEN.adder });
  seen.watch({ id: 'ven.libel', box: fly, ...SEEN.libel });
  seen.watch({ id: 'ven.heideblauwtje', box: () => (life.butterflyObject ? boxOf(life.butterflyObject) : null), ...SEEN.vlinder });
  seen.watch({ id: 'ven.veer', box: () => (life.featherObject ? boxOf(life.featherObject) : null), ...SEEN.veer });
  seen.watch({ id: BLUE_ID, box: () => (life.blueFrog?.group.visible ? boxOf(life.blueFrog.group) : null), ...SEEN.blauw });
  const t0 = k.now;
  let visited = false;
  k.onTick((dt) => {
    seen.tick(dt);
    life.surprisesOn = /^walk:/.test(k.beat);
    // one dragonfly comes up the bank to him on his way (after the first stretch of the follow)
    if (!visited && life.hasDragonflies && /^walk:(kikkers|adder|cove)$/.test(k.beat) && k.now - t0 > 14) {
      const m = k.ranger();
      const ahead = (): THREE.Vector3 => {
        // (just ahead of his shoulder on the water's side, at his chest: in the follow
        // camera's picture beside him, big enough to see it is a dragonfly; never between him
        // and the lens)
        const r = k.ranger(), fx = Math.sin(r.heading), fz = Math.cos(r.heading);
        const lead = 1.1 + Math.min(2, r.speed) * 0.35;
        // (the side of him toward the water: the one facing the ven's middle)
        const sx = fz, sz = -fx, toWater = (VEN_CENTER.x - r.x) * sx + (VEN_CENTER.z - r.z) * sz >= 0 ? 0.7 : -0.7;
        return new THREE.Vector3(r.x + fx * lead + sx * toWater, k.ctx.groundY(r.x, r.z) + 0.95, r.z + fz * lead + sz * toWater);
      };
      if (m.speed > 0.6 && life.visit(m, ahead, 12)) { visited = true; k.stats.libel_visit = Math.round(k.now - t0); }
    }
    for (const [key, v] of Object.entries(seen.most)) k.stats[`px_${key.slice(key.indexOf('.') + 1)}`] = v;
  });
}

/** What a moment on the way needs of the follow. */
interface Follow {
  walkTo(name: string, s: number, opts?: { r?: number; tick?: (dt: number) => void; via?: Spot[]; doel?: string }): Promise<void>;
  listen: ListenCore;
}

/**
 * The adder on the path (rustkracht `adder-ven`, keep your distance, his FEET): his walk
 * ends a few metres before her; one calm side shot while her words are read; then the
 * follow camera back and his feet free. He may wait, or walk round on the heather side, so
 * long as he keeps his distance: within `ADDER_WARN` she lifts her head (a cue), within
 * `ADDER_NEAR` she rears and hisses softly, he takes two calm steps back, and the same
 * moment comes back. Held: she slides off the path into the heather.
 */
async function adderMoment(k: AdventureKit, rust: ChoiceRun, home: VenHome, laid: VenLaid, step: Extract<WayStep, { kind: 'adder' }>,
  f: Follow & { callFrom(p: Spot, n?: number): void; curS(): number }): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const l = route(laid.bay, laid.side);
  await f.walkTo('adder', step.s, { r: 0.9 });
  f.listen.pause();
  k.beat = 'adder';
  k.lockFollow();
  k.world.stopRanger();
  const a = home.adderSpot() ?? step.adder;
  const enc = rust.current!;
  // one calm shot from the heather behind him: her coiled on the warm sand of the path ahead
  k.world.faceRanger(headingTo(k.ranger(), a));
  await k.frame(adderView(a, k.ranger()), { face: headingTo(k.ranger(), a) });
  home.adderLift(0.35);
  k.say(enc.vraag);
  await k.wait(Math.max(1.8, enc.vraag.split(/\s+/).length * 0.42));
  home.adderLift(0);
  // the lens comes calmly back behind him, her coiled ahead on the path beside his body (he
  // stands turned a little toward the water: straight behind him he hid her), and his feet
  // are free: he may wait, or walk round her on the heather side — the follow camera, so his
  // turn keys turn him (in the held side shot they turned a lens that was held: review r3)
  k.world.faceRanger(adderHoldHeading(k.ranger(), a));
  await k.behind();
  const feetFree = (): void => { k.free(); };
  feetFree();
  const me = (): Spot => { const m = k.ranger(); return { x: m.x, z: m.z }; };
  // what tempts him on, in the order they pull (the level's `tempts` says how many come in
  // a hold: band 1-2 one, 3-4 two, 5-6 three): the frogs call from just beyond her; a
  // dragonfly (when this play has them) settles on a heather tip right beside her; she lifts
  // her head and looks
  const beyond = pointAt(l, step.adder.s + 3.5);
  const life = home.life;
  const kinds: ('call' | 'fly' | 'lift')[] = ['call', ...(life.hasDragonflies ? ['fly' as const] : []), 'lift'];
  const toHeath = adderHeather(a), dh = Math.max(0.1, dist(a, toHeath));
  const tip = { x: a.x + ((toHeath.x - a.x) / dh) * 0.8, z: a.z + ((toHeath.z - a.z) / dh) * 0.8 };
  let pull = 0;
  // (the dev read: how near he came to her in the hold, m)
  const offNear = k.onTick(() => {
    const at = home.adderSpot();
    if (at) k.stats.adder_min_m = Math.round(Math.min(k.stats.adder_min_m ?? 99, dist(me(), at)) * 100) / 100;
  });
  try {
    await rust.still('adder-ven', {
      line: c.afstand,
      room: { at: () => home.adderSpot() ?? a, r: ADDER_NEAR, warn: ADDER_WARN, onWarn: () => home.adderLift(0.55) },
      tempt: () => {
        const kind = kinds[pull++ % kinds.length];
        k.stats[`tempt_${kind}`] = (k.stats[`tempt_${kind}`] ?? 0) + 1;
        if (kind === 'call') f.callFrom(beyond, 2);
        else if (kind === 'fly' && life.settleBy(tip)) { /* (it sits there, wings flat, until she goes) */ }
        else { home.adderLift(0.5); window.setTimeout(() => { if (!k.signal.aborted) home.adderLift(0); }, 1100); }
      },
      // too near: she rears and hisses softly (never strikes); he takes two calm steps back
      wrong: async () => {
        // (his feet stop at the reach itself: a held key never carries him on into her coil —
        // review r3 saw 1.17 m; the lens holds where it is while he steps back toward it, so
        // his turn never swings it round)
        k.world.setMissionMode({ missionId: k.mission.id, input: 'locked', camera: 'held' });
        k.world.stopRanger();
        home.adderLift(1, me());
        if (settings.geluid) Sound.callAt('adder', a.x, a.z, listenerOf(k.world.camera), 20);
        const m = me();
        const away = Math.max(dist(m, a), 0.1);
        const back = { x: a.x + ((m.x - a.x) / away) * (ADDER_NEAR + 1.6), z: a.z + ((m.z - a.z) / away) * (ADDER_NEAR + 1.6) };
        await k.wait(0.5);
        await k.walkRanger(back.x, back.z, 0.1);
        k.world.faceRanger(adderHoldHeading(k.ranger(), a));
        await k.wait(0.4);
        home.adderLift(0.3);
        feetFree();
      },
      // held: his feet stop (a key still held never carries him on into her while he is
      // praised for leaving her be: played, he came to 1.17 m during the good words), he
      // watches her slide off the path into the heather, then walks on
      held: () => { k.lockFollow(); k.world.stopRanger(); },
      right: async () => {
        home.adderLift(0);
        await k.guard(home.adderSlide(adderHeather(a)));
      },
    });
  } finally { offNear(); life.release(); }
  // the walk camera back behind him (he walks on along the path), his feet free
  k.world.faceRanger(headingTo(k.ranger(), pointAt(l, step.adder.s + 3)));
  await k.behind();
  f.listen.resume(2);
  k.free();
  k.say(c.volg);
}

/**
 * The soft moss across the path (rustkracht `modder-ven`, walk round it, his FEET): his walk
 * goes on past it with the follow camera; coming near it is named (its own words); it
 * quivers when he is close (it is soft). A boot in it: a squelch, brown water wells up
 * round his boots, the moss quakes, the words, he steps back out and walks on himself (from
 * the second boot the chip shows the way round). Past it dry on the heather side: the good
 * words. Answered once (the run marks a boot once, however often).
 */
async function mossMoment(k: AdventureKit, rust: ChoiceRun, home: VenHome, laid: VenLaid, step: Extract<WayStep, { kind: 'modder' }>,
  f: Follow & { tickChorus(dt: number): void; setS(s: number): void }): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const l = route(laid.bay, laid.side);
  const enc = rust.current!;
  const st = stationsOf(laid.bay, laid.side)[step.station];
  const nearRim = st.s - CARPET_A, farRim = st.s + CARPET_A;
  // (up to where it can be seen: the follow, the chorus calling)
  await f.walkTo('kikkers', step.s);
  k.beat = 'moss';
  // (the dev read: where the soft moss lies, for a test that steps in it as a child would)
  k.stats.moss_x = Math.round(st.at.x * 100) / 100;
  k.stats.moss_z = Math.round(st.at.z * 100) / 100;
  let warned = false, past = false, wading = false, boots = 0, nextRound = 0, lineBack = -1;
  const out = pointAt(l, nearRim - 1.3);
  const plash = async (): Promise<void> => {
    boots += 1;
    k.stats.moss_boots = boots;
    if (boots === 1) rust.answer('modder-ven', false);
    if (settings.geluid) { Sound.squelch(); Sound.tryAgain(); }
    const m = k.ranger();
    home.sinkAt(m.x, m.z);
    k.lockFollow();
    k.world.stopRanger();
    k.say(enc.gevolg ?? c.sst);
    await k.wait(1.5);
    await k.walkRanger(out.x, out.z, 0.1);
    k.world.faceRanger(headingTo(out, pointAt(l, st.s)));
    await k.wait(0.4);
    k.free();
    k.say(boots >= 2 ? c.eromheen : c.volg);
    wading = false;
  };
  await k.walk({
    // (a calm moment, not a plain walk: a veldgids card never shows while he chooses his way)
    name: 'moss', beat: 'moss', to: step.past, r: 0.9, line: c.volg, doel: c.chipKikkers, cue: c.luister, glyph: 'ear',
    via: [...between(l, project(l, k.ranger()).s, nearRim - 1.6), ...step.round],
    tick: (dt) => {
      if (wading) return;
      const m = k.ranger();
      const s = project(l, m).s;
      if (!past) f.tickChorus(dt);
      if (past) { if (lineBack > 0 && k.now > lineBack) { lineBack = -1; k.say(c.volg); } return; }
      // coming up to it, it is named (once): the choice is his feet's
      if (!warned && s > nearRim - CARPET_SEEN) { warned = true; f.listen.pause(); k.say(enc.vraag); }
      if (home.inMoss(m.x, m.z, CARPET_WET)) { wading = true; void plash().catch(() => {}); return; }
      if (boots >= 2) {
        // (after the second boot the chip names the way round and points along it)
        while (nextRound < step.round.length - 1 && dist(step.round[nextRound], m) < 1.2) nextRound += 1;
        const v = step.round[nextRound], end = step.round[step.round.length - 1];
        const at = cueAt(bearing(m.x, m.z, m.heading, v.x, v.z), Math.max(ARRIVE_RADIUS, dist(m, end)));
        k.ui.setChip({ doel: c.chipRond, cue: `${at.richting} · ${at.afstand}`, angle: at.angle, glyph: 'boot' });
      }
      // past its far rim, dry: round it — the good words, then the walk's own
      if (s > farRim + 0.4 && !home.inMoss(m.x, m.z, 1.05)) {
        past = true;
        rust.answer('modder-ven', true);
        if (settings.geluid) Sound.correct();
        k.say(enc.uitleg ?? c.volg, { good: true });
        lineBack = k.now + 2.8;
        f.listen.resume(3);
      }
    },
  });
  if (!past && rust.current?.id === 'modder-ven') rust.answer('modder-ven', true); // (he came by some other way round: dry)
  f.listen.resume(2);
  f.setS(project(l, k.ranger()).s);
}

/** (The ids every cove's stations and frogs carry: for the dev read.) */
export const VEN_BAYS: readonly BayId[] = BAY_IDS;
