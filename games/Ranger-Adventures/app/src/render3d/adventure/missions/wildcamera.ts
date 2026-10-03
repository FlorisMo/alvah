/**
 * wildcamera.ts — "De wildcamera" as an adventure in the world (design run6-missions §4.3).
 *
 * A camera trap lies on a stump at the marker. The ranger takes it and follows a
 * WILDWISSEL — a narrow trodden game trail with deer slots, boar and badger prints — into
 * the wood, to a crossing where a second game trail runs from an open glade past a
 * sturdy pine into a thicket with the badger's sett. He straps the camera to the pine
 * (its red light blinks) and aims it, animal by animal, at the glade or the thicket by
 * the rule on the card; each right choice brings the animal walking into view there and
 * a photograph joins the strip (WISSELEN). When the rule flips, the day turns into night
 * (or back): night animals come out into the open, day animals rest in the thicket. At
 * night the badger comes out of its sett, a wild boar out of the bushes, a roe to the
 * glade's edge, a nightjar onto a log; they call, and he calls them back in order
 * (SIMON). The night passes. In the morning he looks through the photos: the animals
 * he aimed for, and on the last one a man setting a snare by two things of the wood. He
 * looks for that place himself (the photo pinned at the top of his screen), finds the
 * empty snare half in the grass there, takes it away and walks back to his camera.
 * A roe steps into the glade; the camera clicks: it guards the wood. He is handed back
 * on the open crossing. The camera stays on its pine.
 *
 * Run 7 (wc-hands): no buttons. He clicks the camera on its stump to take it, clicks the
 * pine's trunk to hang it there, walks past it to test it (it takes his photo), flips the
 * morning's photos himself, and finds the snare at this play's spot (one of three, each
 * with its own two landmarks) by comparing the photo with the wood, then clicks it.
 *
 * Run 7 (wc-album): the camera's album. The evening stands in this play's light (the golden
 * hour, an overcast or a misty evening; never the last play's), the morning after is misty
 * or clear, the night stays the camera's own readable blue. What he saw goes into his
 * veldgids (content/ontdekkingen.ts): his own photo, the fox, a nose pressed to the lens
 * on a photo the camera took on its own in the night (some plays: "Wie is dat? Een neus!"),
 * and the rare ones (`k.rare()`: a seeded chance and the pity rule): a fox with her two
 * cubs crossing in the night after the echo, or a white roe stepping into the glade in the
 * morning. On plays the fox comes, its fresh prints run up the wildwissel as he walks in.
 *
 * Steps (content, the EF contract): 0 wisselen · 1 simon, each logged once.
 */

import type * as THREE from 'three';
import type { Adventure } from '../registry';
import type { Mission } from '../../../content/types';
import type { Play } from '../../../core/play';
import type { AdventureKit } from '../kit';
import { buildWisselTrial, type WisselBin, type WisselItem } from '../../../engines/wisselen';
import { simonCast } from '../../../engines/simon';
import { store } from '../../../core/state';
import { Sound } from '../../../core/sound';
import { applyAmbient } from '../../../core/calls';
import { clearPlayHint, pick3d } from '../../play/kit';
import { aimBeat, type AimWorld } from '../beats/aim';
import { callersBeat, type Caller } from '../beats/callers';
import { dist, headingTo, toLocal } from '../places';
import type { Spot } from '../types';
import { RANGER_STAND_HEIGHT, SIZE } from '../../AnimalScale';
import { WildcameraHome, type BirdId } from './wildcamera.home';
import { CameraClock, WILDCAMERA_MOODS, drawWildcameraPlay, lastDawn, lastNights, lastSnare, neusDrought, variantOf, type NeusId } from './wildcamera.variety';
import { PhotoStrip, develop, developedLuma, type Photo } from './wildcamera.photos';
import { FoxCubs } from './wildcamera.cubs';
import { Actor } from '../actors';
import {
  WILDCAMERA_HOME, WILDCAMERA_PLACES as P, CROSS_VIEW, REUNION_VIEW, TRAIL_VIEW, STRAP_VIEW, SNARE_FOUND, SNARE_SPOTS, SEARCH_VIEW, TEST_SPOT, TEST_VIEW, inFan, walkBackView,
  AIM_AT, CAMERA, ROE_HIDEAWAY, ROE_SHY_WITHIN, aimSpot, cameraAim, wildcameraClearings, wildcameraTreeClearings, wildcameraTrees,
  CALLER_SLOTS, SIDE_OF, SKY, STOPS, STOPS_OF, arrivalPath, exitPath,
  CROSS, CUB_LAG, FAMILY_SHOT, WHITE_ROE_OUT, familyPath,
  type AimSpot, type Side, type SlotId, type StopId,
} from './wildcamera.places';

export const wildcameraAdventure: Adventure = {
  id: 'wildcamera',
  home: WILDCAMERA_HOME,
  clearings: wildcameraClearings(),
  treeClearings: wildcameraTreeClearings(),
  trees: wildcameraTrees(),
  dressing: (env) => new WildcameraHome(env),
  // run 7 (wc-album): the evening's light, a new one each play (never the last play's)
  moods: WILDCAMERA_MOODS,

  // run 7 (wc-album): under the briefing card, on plays the fox comes (in the evening or at
  // night: the same draws the play makes), its fresh prints run up the wildwissel
  prepare(world, mission, play) {
    const home = world.residents.dressing('wildcamera') as WildcameraHome | null;
    home?.showFoxPrints(foxComes(mission, play));
  },
  unprepare(world) {
    (world.residents.dressing('wildcamera') as WildcameraHome | null)?.showFoxPrints(false);
  },

  async play(k: AdventureKit): Promise<void> {
    const fam = k.borrow();
    const home = fam.dressing as WildcameraHome;
    const photos = new PhotoStrip(k.host);
    const owned: { dispose(): void }[] = [];
    try {
      await story(k, fam.actors as Record<Walker, Actor>, home, photos, (d) => owned.push(d));
    } finally {
      for (const d of owned) d.dispose();
      photos.dispose();
      applyAmbient(); // the day's bed at its own level again
    }
  },
};

/** Run 7 (wc-album): does the fox come this play — in the evening's round, in the night's
 *  choir, or with her cubs (this play's rare)? (The SAME draws the play makes: the wissel
 *  queue and the simon cast from their forks of the play, the rare from its note.) */
function foxComes(mission: Mission, play: Play): boolean {
  const queue = buildWisselTrial(mission.stappen[0].skin, store.knobs('wisselen'), play.fork('wisselen').rng).queue;
  const cast = simonCast(mission.stappen[1].skin, play.fork('simon-cast').rng);
  return queue.some((q) => q.id === 'vos') || cast.includes('vos') || /vosjes/.test(String(play.variant.rare ?? ''));
}

/** Run 7: every walking animal of the crossing (the stag, the hind, the roe, the badger,
 *  the boar, the fox): residents of the home, out in the wood until they come. */
type Walker = 'edelhert' | 'hinde' | 'ree' | 'das' | 'wildzwijn' | 'vos';
const isBird = (id: string): id is BirdId => id === 'nachtzwaluw' || id === 'gaai';

/** How fast each animal comes into view (m/s): a brisk walk (the badger's quick trot),
 *  never a dash. */
const PACE: Record<string, number> = { edelhert: 1.9, hinde: 1.9, ree: 1.8, das: 1.45, wildzwijn: 1.6, vos: 1.7 };
/** A bird's flight into view and away (s). */
const FLY_S = 1.6;
/** Run 7 (wc-album): the fox family's trot across the crossing (m/s): ~6 s in the picture. */
const FAMILY_PACE = 2.0;
/** Run 7 (wc-album): the night's close-up, per animal: where the camera looks (rad: out
 *  over the crossing, a little to one side), how near the tip of its nose comes to the
 *  lens (m), how far at most it tips its body to bring its nose up (or down) to the lens
 *  (rad), and how much of it the photo frames (m of height at 1 m: its face fills it). */
const NEUS_POSE: Readonly<Record<NeusId, { heading: number; d: number; tilt: number; frame: number }>> = {
  wildzwijn: { heading: 0.25, d: 0.55, tilt: 0.55, frame: 0.75 },
  das: { heading: -0.2, d: 0.3, tilt: 0.6, frame: 0.56 },
  vos: { heading: 0.3, d: 0.32, tilt: 0.65, frame: 0.6 },
  ree: { heading: -0.25, d: 0.36, tilt: 0.4, frame: 0.64 },
};
/** The close-up is a little out of focus: the nose came nearer than the lens can sharpen
 *  (px of blur on the 320 px photo). */
const NEUS_SOFT = 1.1;

async function story(k: AdventureKit, A: Record<Walker, Actor>, home: WildcameraHome, photos: PhotoStrip, own: (d: { dispose(): void }) => void): Promise<void> {
  const c = k.copy;
  const settings = store.get().settings;
  const lens = (): { x: number; z: number; speed: number } => ({ x: k.world.camera.position.x, z: k.world.camera.position.z, speed: 0 });

  /* -- run 7: this play's night and evening, drawn from its seed (wildcamera.variety) -- */
  // (the SAME queue the aim beat builds, and the SAME callers the echo beat builds: one
  // fork each, replayed from its start)
  const queue = buildWisselTrial(k.steps[0].skin, k.knobs('wisselen'), k.play.fork('wisselen').rng).queue;
  const cast = simonCast(k.steps[1].skin, k.play.fork('simon-cast').rng);
  const history = store.get().geschiedenis;
  const wp = drawWildcameraPlay(k.play, {
    queueLength: queue.length, cast, recent: lastNights(history), lastSnare: lastSnare(history), neusDrought: neusDrought(history),
    evening: k.mood, lastDawn: lastDawn(history),
  });
  const variant = variantOf(wp);
  // (the snare's spot and the night's close-up first: the next plays read them back, and
  // the history keeps 60 characters)
  k.play.note('ws', variant.ws);
  k.play.note('wx', variant.wx);
  k.play.note('wn', variant.wn);
  k.play.note('wd', variant.wd);
  k.play.note('wa', variant.wa);
  const clock = new CameraClock(wp.clockStart, k.play.fork('wc-clock-run').rng);
  // run 7 (wc-album): this play's rare visitor (rolled at the briefing: k.rare), the dawn,
  // and what the camera takes on its own in the night
  const rare = k.rare()?.id ?? null;
  k.stats.album_rare = rare === 'wildcamera.vosjes' ? 1 : rare === 'wildcamera.witte-ree' ? 2 : 0;
  k.stats.album_neus = wp.neus ? 1 : 0;
  k.stats.album_dawn = wp.dawn === 'ochtendnevel' ? 1 : wp.dawn === 'zonnig' ? 2 : 3;
  // (the rare ones are spawned for this play only, disposed after; made now, hidden, so they
  // are there when their moment comes)
  const actorEnv = {
    parent: home.group, groundY: k.ctx.groundY, spawnModel: k.ctx.spawnModel.bind(k.ctx),
    obstacles: [], limits: { bound: 1e6 }, reduced: () => k.reduced,
  };
  const cubs = rare === 'wildcamera.vosjes' ? new FoxCubs(actorEnv) : null;
  if (cubs) own(cubs);
  const whiteRoe = rare === 'wildcamera.witte-ree' ? new Actor('witte-ree', 'witte-ree', actorEnv, { height: A.ree.height }) : null;
  if (whiteRoe) {
    whiteRoe.group.visible = false;
    own(whiteRoe);
    k.onTick((dt, t) => { if (whiteRoe.group.visible) whiteRoe.update(dt, t); });
  }
  // (the man sets his snare at this play's spot: its grass and landmarks always stand there)
  const snareSpot = SNARE_SPOTS[wp.snare];
  home.setSnareSpot(wp.snare);
  k.stats.snare_spot = Number(variant.ws);

  /** He clicks one of `targets` in the world (a 3D pick: ≥ 56 px round each, whatever its
   *  size); golden's play hint is `hint()` (null: nothing yet). Resolves with what he
   *  clicked. The pick is made once the lens is where it will stay. */
  const clickOn = async (id: string, targets: { id: string; object: THREE.Object3D }[], hint: () => THREE.Object3D | null): Promise<string> => {
    let picked!: (what: string) => void;
    const got = new Promise<string>((r) => { picked = r; });
    const unhint = k.hint(() => { const t = hint(); return t ? { id, target: t } : null; });
    const teardown = pick3d({
      canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
      targets, onPick: (what) => picked(what), signal: k.signal,
    });
    try {
      return await k.guard(got);
    } finally {
      teardown();
      unhint();
      clearPlayHint();
    }
  };
  /** Say `line` (what to do) after `s` s, unless he has done it by then. */
  const thenSay = (s: number, line: string, done: () => boolean): void => {
    void k.wait(s).then(() => { if (!done()) k.say(line, { queue: true }); }).catch(() => {});
  };

  let shots = 0;
  /** A photograph from the camera on the pine, looking at `p` (`y` m up, `frameH` m of
   *  height in the picture), developed (the camera's clock runs on with every one). */
  const photograph = async (p: Spot, y: number, frameH: number, what: string, time: Photo['time'], prepare?: () => () => void, minFov?: number, fill?: number, more: { stamp?: string; soft?: number } = {}): Promise<Photo | null> => {
    const cam = home.photoCamera(p, y, 1.6, frameH, minFov);
    const raw = await k.guard(k.world.snapshot(cam, 320, 200, () => {
      const a = home.photoPrep(fill ?? (time === 'nacht' ? 1 : time === 'ochtend' ? 1.35 : 1.9));
      const b = prepare?.();
      return () => { b?.(); a(); };
    }, { people: false })); // (a trap in the wood: never Bram, never the far figure in the trees)
    if (!raw) return null;
    shots++;
    const line = what === 'jij' ? c.fotoJij : c[`foto_${what}`];
    // (the camera's own clock: the man at his snare at first light, every other photo as it
    // runs on; a photo it took on its own in the night carries its own time)
    const url = develop(raw, time, more.stamp ?? (time === 'ochtend' ? clock.dawnMan() : clock.photo()), shots + 7, more.soft ?? 0);
    // (dev read: no photo in any light comes out black or white)
    const luma = developedLuma();
    k.stats.photo_luma_min = Math.min(k.stats.photo_luma_min ?? 255, luma);
    k.stats.photo_luma_max = Math.max(k.stats.photo_luma_max ?? 0, luma);
    return { url, what, time, ...(line ? { line } : {}) };
  };
  const shutter = (night: boolean): void => {
    home.flash(night);
    if (settings.geluid) Sound.shutter();
  };

  /* -- the night: the camera's fan cools, the birdsong of the day bed goes quiet -- */
  const dayBed = 0.22 * settings.ambient;
  let lastNight = -1;
  k.onTick(() => {
    const night = 1 - k.world.daylight();
    if (Math.abs(night - lastNight) < 0.01) return;
    lastNight = night;
    home.setNight(night);
    if (settings.geluid && settings.ambient > 0) Sound.setAmbientGain(dayBed * (1 - 0.7 * night));
  });
  /** An animal that comes again stands a little differently (a step nearer the camera,
   *  turned a little): no two photos the same, and never further into the bushes behind
   *  it. The badger keeps to its spot by the sett; a bird to its perch (it only turns a
   *  little). */
  const seen = new Map<string, number>();
  const varied = (s: AimSpot, id: string): AimSpot => {
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (!n || id === 'das') return s;
    if (isBird(id)) return { ...s, yaw: s.yaw + (n % 2 ? 0.3 : -0.25) };
    const dx = CAMERA.x - s.at.x, dz = CAMERA.z - s.at.z, l = Math.hypot(dx, dz) || 1;
    const step = n % 2 ? 0.35 : 0.2;
    return { ...s, at: { x: s.at.x + (dx / l) * step, z: s.at.z + (dz / l) * step }, yaw: s.yaw + (n % 2 ? 0.5 : -0.45) };
  };
  const leaving = new Map<string, number>();
  /** the animals still walking off after their photo: the place each left from (and a
   *  few seconds at most: a walk that never ends never holds the next aim) */
  const walkingOff = new Map<string, { bin: WisselBin; until: number }>();
  const shotAt = new Map<string, WisselBin>();
  const birdToken: Record<BirdId, number> = { nachtzwaluw: 0, gaai: 0 };
  /** a walk that may stall (a trunk between): it never holds the round longer than this */
  const walkTo = async (a: Actor, to: Spot, pace: number, face?: number): Promise<boolean> => {
    const far = Math.hypot(to.x - a.x, to.z - a.z);
    return k.guard(Promise.race([a.go(to.x, to.z, { speed: pace, face }), k.wait(far / pace + 4).then(() => false)]));
  };

  /* -- run 7 (wc-album): the fox with her cubs (a rare night, after the echo). The fox that
        called tonight trots off out of the picture on her side first (to fetch them); then
        out she comes with her two cubs bounding behind her, along the second trail across
        the crossing in front of the pine, side-on to the lens, and into the trees on the
        other side. The camera turns to them and photographs them in its infrared glow;
        "Kijk! Een vos met jongen." The night's other animals look up as they pass -- */
  const foxFamily = async (young: FoxCubs): Promise<void> => {
    k.beat = 'vosjes';
    const f = k.play.fork('wc-vosjes');
    const drawn: Side = f.pick(['left', 'right'] as const); // (always drawn: the stream stays put)
    const tumbles: [number, number] = [f.between(0.36, 0.48), f.between(0.54, 0.66)];
    const caller = wp.callers.find((n) => n.id === 'vos');
    const side: Side = caller ? (toLocal(CROSS, CALLER_SLOTS[caller.slot].at).u < 0 ? 'left' : 'right') : drawn;
    const path = familyPath(side);
    const vixen = A.vos;
    await k.guard(Promise.race([young.ready, k.wait(4)]));
    if (vixen.group.visible) {
      if (vixen.lies) await k.guard(vixen.lie(false));
      await walkTo(vixen, path[0], FAMILY_PACE);
    }
    vixen.group.visible = false;
    vixen.idle();
    await k.wait(0.7);
    vixen.place(path[0].x, path[0].z, headingTo(path[0], path[1]));
    vixen.group.visible = true;
    let L = 0;
    for (let i = 1; i < path.length; i++) L += dist(path[i - 1], path[i]);
    young.start(path, [tumbles[0] * L, tumbles[1] * L]);
    const off = k.onTick((dt) => {
      young.update(dt, { x: vixen.x, z: vixen.z, speed: vixen.speed }, k.reduced);
    });
    // the camera turns to where it will take them; the other animals look up at them
    const shot = FAMILY_SHOT;
    home.aim(cameraAim(shot), k.reduced);
    for (const n of wp.callers) {
      if (n.id === 'vos' || isBird(n.id)) continue;
      const a = A[n.id as Walker];
      void a.lookAt(() => ({ x: vixen.x, z: vixen.z, speed: 0 }), 7);
    }
    const trot = (async (): Promise<void> => {
      for (const p of path.slice(1)) {
        const ok = await walkTo(vixen, p, FAMILY_PACE);
        if (!ok && dist(vixen, p) > 1.2) break; // (a stall: she slips off from where she is)
      }
    })();
    try {
      // in the picture: the words
      await k.until(() => Math.abs(toLocal(CROSS, vixen).u) < 6.2, 8);
      k.say(c.vosjes, { good: true });
      // right in front of the camera: click, in its infrared glow (her first cub passes the
      // middle of its view, she a step ahead of it, the second a step behind)
      const s0 = toLocal(CROSS, shot).u + (side === 'left' ? CUB_LAG[0] : -CUB_LAG[0]), dir = side === 'left' ? 1 : -1;
      await k.until(() => (toLocal(CROSS, vixen).u - s0) * dir >= 0, 9);
      shutter(true);
      const p = await photograph(shot, 0.22, shot.frameH, 'vosjes', 'nacht');
      if (p) { photos.photos.push(p); photos.pin(p); }
      k.discover('wildcamera.vosjes');
      k.discover('wildcamera.vos'); // (a fox he saw, if it came on no other way tonight)
      k.stats.family_photo = p ? 1 : 0;
      await k.guard(Promise.race([trot, k.wait(9)]));
    } finally {
      off();
      photos.pin(null);
      vixen.group.visible = false;
      vixen.idle();
      young.hide();
    }
    k.say(null);
  };

  /* -- run 7 (wc-album): the funny close-up. In the deep of the night (the roe: at first
        light) an animal of the crossing came right up to the camera and sniffed at its lens,
        and the camera clicked on its own. Like the man, it is in that one picture only:
        placed for its render and gone again. In the morning's photos, in the camera's clock
        order: "Wie is dat? Een neus!" -- */
  const closeUp = async (id: NeusId, time: 'nacht' | 'ochtend'): Promise<void> => {
    const a = A[id as Walker];
    const pose = NEUS_POSE[id];
    await k.guard(a.ready);
    if (a.lies) await k.guard(a.lie(false));
    home.aim(pose.heading, true);
    let undo: (() => void) | null = null;
    const stamp = time === 'nacht' ? clock.lateNight() : clock.firstLight();
    const at = home.closeUp(a, pose.heading, pose.d, pose.tilt);
    const nose = at.nose, y = at.y;
    at.undo();
    const p = await photograph(nose, y, pose.frame, 'neus', time, () => {
      undo = home.closeUp(a, pose.heading, pose.d, pose.tilt).undo;
      return () => undo?.();
    }, 8, time === 'nacht' ? 1 : 1.35, { stamp, soft: NEUS_SOFT });
    if (p) photos.photos.push(p);
    k.stats.neus_photo = p ? 1 : 0;
    for (const [key, v] of Object.entries(home.closeUpRead ?? {})) k.stats[`neus_${key}`] = Math.round(v * 100) / 100;
  };

  /* -- run 7: the animal comes first. Each visitor walks (or flies) in from out of view on
        its side (wp.arrivals: drawn on its own, never from where it must go) to one of that
        side's stops on the crossing, and stands there side-on while he decides. A newcomer
        from the side the last one goes to waits until that one stands at its place (its
        in-lane passes there), else it sets off at the click -- */
  const standing = { id: '', stop: null as StopId | null, at: null as Spot | null, yaw: 0 };
  /** side-on to the lens at a stop, facing on the way it came (turned a touch to the lens) */
  const sideOn = (side: 'left' | 'right'): number => (side === 'left' ? Math.PI / 2 - 0.22 : -Math.PI / 2 + 0.22);
  let reached: { side: 'left' | 'right' | null; at: Promise<void> } = { side: null, at: Promise.resolve() };
  const sizeOf = (id: string): { len: number; h: number } => {
    const z = (SIZE as Record<string, { h: number; len?: number }>)[id];
    const k15 = isBird(id) ? 1.5 : 1;
    return { len: (z?.len ?? 0.5) * k15, h: (z?.h ?? 0.4) * k15 * (id === 'edelhert' ? 0.8 : 1) };
  };
  const arrive = async (item: WisselItem, index: number, turn?: 'night' | 'day'): Promise<void> => {
    const drawn = wp.arrivals[index] ?? { side: 'left' as const, stop: 'l' as StopId };
    // (after a turn the card carries the new rule and stands taller: the visitor then waits
    // on the trail beside the pine, never at a front stop the card would cover)
    const a = turn ? { side: drawn.side, stop: STOPS_OF[drawn.side][0] } : drawn;
    const t0 = k.now;
    // (on the side the last one goes to: wait until it stands at its place)
    if (index > 0 && reached.side === a.side) await k.guard(reached.at);
    const stop = STOPS[a.stop];
    const yaw = sideOn(a.side);
    const id = item.id;
    leaving.delete(id);
    walkingOff.delete(id);
    if (isBird(id)) {
      birdToken[id] += 1;
      const sky = SKY[a.side];
      const from = home.birdOut(id) ? { x: home.birdAtOf(id).x, z: home.birdAtOf(id).z, y: home.birdAtOf(id).y - k.ctx.groundY(home.birdAtOf(id).x, home.birdAtOf(id).z) } : sky;
      await k.guard(home.fly(from, { x: stop.x, z: stop.z, lift: 0 }, yaw, k.reduced, FLY_S * 1.2, id));
    } else {
      const w = A[id as Walker];
      // (the shy roe of the glade, gone under the trees out of view: she comes in like the
      // rest; still on her way there, in view, she turns back from where she is)
      const fresh = !w.group.visible || (id === 'ree' && !roeTaken && Math.hypot(w.x - ROE_HIDEAWAY.x, w.z - ROE_HIDEAWAY.z) < 1.5);
      if (id === 'ree') roeTaken = true;
      if (w.lies) await k.guard(w.lie(false));
      const path = arrivalPath(a.stop);
      if (fresh) {
        w.place(path[0].x, path[0].z, headingTo(path[0], path[1]));
        w.group.visible = true;
      }
      const pace = (PACE[id] ?? 1.2) * 1.22; // (a brisk walk in: it has somewhere to be)
      // along its side's in-lane (still about from its last photo, walking off: it turns
      // back from where it is, straight to its stop)
      if (fresh) for (const via of path.slice(1, -1)) await walkTo(w, via, pace);
      const came = await walkTo(w, stop, pace, yaw);
      if (!came && Math.hypot(stop.x - w.x, stop.z - w.z) > 0.8) k.stats.aim_late = (k.stats.aim_late ?? 0) + 1; // (dev read: it never got there)
    }
    standing.id = id;
    standing.stop = a.stop;
    standing.at = isBird(id) ? { x: stop.x, z: stop.z } : { x: A[id as Walker].x, z: A[id as Walker].z };
    standing.yaw = yaw;
    const sz = sizeOf(id);
    home.showVisitor(standing.at, sz.len, sz.h, yaw);
    home.birdFidget(isBird(id) ? id : null);
    k.stats.aim_arrive_s = Math.round((k.now - t0) * 10) / 10;
    k.stats.aim_arrivals = (k.stats.aim_arrivals ?? 0) + 1;
  };

  /** The photographed animal walks off, out of view on its place's side (its out-lane:
   *  never the way a newcomer comes in there). */
  const walkOut = (id: string, bin: WisselBin): void => {
    if (isBird(id)) {
      // it sits a moment on its perch after the click (as birds do: still), then lifts off
      // and glides away over its side
      const token = ++birdToken[id];
      void k.wait(1.2).then(() => {
        if (token !== birdToken[id]) return;
        const p = home.birdAtOf(id);
        const sky = SKY[SIDE_OF[bin]];
        return home.fly({ x: p.x, z: p.z, y: p.y - k.ctx.groundY(p.x, p.z) + 0.2 }, { x: sky.x, z: sky.z, lift: sky.y }, 0, k.reduced, FLY_S, id)
          .then(() => { if (token === birdToken[id]) home.birdGone(id); });
      }).catch(() => {});
      return;
    }
    const a = A[id as Walker];
    const t = (leaving.get(id) ?? 0) + 1;
    leaving.set(id, t);
    walkingOff.set(id, { bin, until: k.now + 4.0 }); // (its walk off out of the place: the hint waits, never longer)
    // (it looks up at the camera a moment first: the click)
    void k.wait(id === 'das' ? 0.4 : 0.6).then(async () => {
      if (leaving.get(id) !== t) return;
      if (a.lies) await a.lie(false);
      // the badger goes back into its sett; the others out of view on the place's side
      const out = exitPath(bin, a, id)[1];
      const ok = await a.go(out.x, out.z, { speed: (PACE[id] ?? 1.1) * 1.2 });
      if (leaving.get(id) === t) walkingOff.delete(id);
      if (ok && leaving.get(id) === t) { a.group.visible = false; a.idle(); }
    }).catch(() => {});
  };

  /* 0 · the roe grazes in the glade (the deer's place); as he comes along the game trail
         she lifts her head, looks at him and walks calmly in under the trees beyond it,
         away from him — who comes back when nobody is there is what the camera is for.
         Once the camera watches, she is out of its view (and comes back from there) */
  let roeShy = A.ree.group.visible;
  let roeGone: Promise<boolean> | null = null;
  let roeTaken = false;
  const unwatchRoe = k.onTick(() => {
    if (!roeShy || roeGone) return;
    const me = k.ranger(), a = A.ree;
    if (Math.hypot(me.x - a.x, me.z - a.z) > ROE_SHY_WITHIN) return;
    roeGone = a.lookAt(() => ({ x: k.ranger().x, z: k.ranger().z, speed: 0 }), 1.3)
      .then((ok) => (ok && !roeTaken ? a.go(ROE_HIDEAWAY.x, ROE_HIDEAWAY.z, { speed: 'walk', face: ROE_HIDEAWAY.yaw }) : false));
  });
  /** the camera starts watching: the roe (out of its view under the trees) is gone */
  const roeOut = (): void => {
    unwatchRoe();
    if (!roeShy) return;
    roeShy = false;
    void (roeGone ?? Promise.resolve(true)).then((ok) => {
      if (ok && !roeTaken) { A.ree.group.visible = false; A.ree.idle(); }
    });
  };

  /* 1 · at the marker: the camera lies on the stump. He steps beside it (on the side
         he stands, across the lens's view, so it is not behind him) and faces it; the
         lens stays where it is */
  k.beat = 'pak';
  {
    const st = P.stump, lens = k.world.camera.position, me = k.ranger();
    const dx = st.x - lens.x, dz = st.z - lens.z, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l, pz = dx / l; // across the view
    const side = (me.x - st.x) * px + (me.z - st.z) * pz >= 0 ? 1 : -1;
    const beside = { x: st.x + px * 0.62 * side - (dx / l) * 0.12, z: st.z + pz * 0.62 * side - (dz / l) * 0.12 };
    k.lockFollow();
    await k.walkRanger(beside.x, beside.z, 0.05);
    k.world.faceRanger(headingTo(beside, st));
  }
  // run 7: he takes it himself: a click on the camera lying there
  k.say(c.pak);
  await k.until(() => !!home.stumpCamera, 8);
  let took = false;
  thenSay(1.8, c.pakKlik, () => took);
  const lying = home.stumpCamera;
  if (lying) await clickOn('camera', [{ id: 'camera', object: lying }], () => home.stumpCameraBody);
  took = true;
  home.pickUp(k.ranger(), k.reduced);
  if (settings.geluid) Sound.step();
  // he steps onto the wildwissel where it leaves the ring while the view glides round
  // behind him to look along it into the wood (one calm move, whichever side he came
  // from: he walks into the view it lands on); once the path is in view and he stands
  // on it, the words say so (the follow camera takes over from there, facing the way)
  k.beat = 'pad';
  k.say(null);
  const framed = k.frame(TRAIL_VIEW);
  framed.catch(() => {}); // (a stop during his steps: the walk's own guard ends the story)
  await k.walkRanger(P.trailStart.x, P.trailStart.z, 0.05);
  k.world.faceRanger(TRAIL_VIEW.heading);
  await framed;
  k.say(c.kijkPad);
  await k.wait(2.2);
  // run 7 (wc-album): on plays the fox comes, its fresh prints run up the path ahead of
  // him (laid under the briefing card): a small question the evening or the night answers
  k.stats.fox_prints = home.foxPrintsShown ? 1 : 0;
  if (home.foxPrintsShown) {
    k.say(c.vosSporen);
    await k.wait(2.4);
  }

  /* 2 · follow the wildwissel into the wood, to the crossing */
  await k.walk({ name: 'wissel', to: P.crossApproach, r: P.crossApproach.r, line: c.volg, doel: c.chipPad, cue: c.sporen });

  /* 3 · strap the camera to the pine. Run 7: he steps onto the crossing and sees it whole
         (the lens of the camera's own view: the glade, the pine, the thicket); on the
         pine's trunk, at his chest, the camera's soft shape says where; he clicks the trunk,
         walks the last steps and straps it on */
  k.beat = 'hang';
  k.say(c.hang);
  await k.walkRanger(P.crossApproach.x, P.crossApproach.z, 0.05);
  home.showStrapSpot(true);
  await k.frame({ ...CROSS_VIEW, include: [{ x: P.crossApproach.x, z: P.crossApproach.z, h: RANGER_STAND_HEIGHT }] }, { face: headingTo(P.crossApproach, CAMERA) });
  let hung = false;
  thenSay(0.8, c.hangBoom, () => hung);
  await clickOn('pine', [{ id: 'pine', object: home.pineTarget }, { id: 'pine', object: home.strapHint }], () => home.strapHint);
  hung = true;
  k.say(null);
  k.beat = 'hang:strap';
  await k.walkRanger(P.strap.x, P.strap.z, 0.05);
  await k.frame(STRAP_VIEW, { face: P.strap.heading });
  await k.wait(0.3);
  home.showStrapSpot(false);
  home.strapOn(k.reduced);
  k.beat = 'hang:on';
  if (settings.geluid) Sound.strap();
  k.say(c.hangt, { good: true });
  k.stats.camera_strapped = 1;
  await k.wait(1.6);

  /* 3b · run 7: he tests it: he walks out in front of it, into the ground it sees (its fan
          shows there); once he is in it the camera flashes and takes his photo: "Klik! Daar
          sta jij." (the photo shows a moment under the line, then joins the strip) */
  // (he turns from the trunk to the crossing, and the lens comes round behind him: the
  // follow camera takes over from there, so the Up key walks him into the fan)
  home.showFan(true);
  await k.frame(TEST_VIEW, { face: headingTo(P.strap, TEST_SPOT) });
  await k.walk({
    name: 'test', to: TEST_SPOT, r: TEST_SPOT.r, reached: () => inFan(k.ranger()),
    line: c.test, doel: c.chipTest, cue: c.cueTest, glyph: 'camera',
  });
  k.beat = 'test';
  // (he stops in its fan and turns to the camera's red light: it sees his face)
  k.lockFollow();
  k.world.faceRanger(headingTo(k.ranger(), CAMERA));
  await k.wait(0.35);
  shutter(false);
  const me = k.ranger();
  const selfie = await photograph({ x: me.x, z: me.z }, 0.7, 1.45, 'jij', 'dag', undefined, undefined, 1.0);
  if (selfie) { photos.add(selfie); photos.pin(selfie); }
  k.say(c.selfie, { good: true });
  k.stats.selfie = selfie ? 1 : 0;
  // run 7 (wc-album): his own photo goes into his veldgids. The first time, he looks at it a
  // moment longer (a calm look: the veldgids's reveal shows beside it then, once)
  const firstSelfie = !!selfie && k.discover('wildcamera.selfie');
  if (firstSelfie) k.beat = 'look:selfie';
  await k.wait(firstSelfie ? 5.6 : 2.8);
  photos.pin(null);
  home.showFan(false);

  /* 4 · aim the camera for each animal, as the day turns to night (wisselen). Run 7: each
         animal steps onto the crossing first and stands there; then he aims */
  photos.show(true);
  const at = new Map<string, AimSpot>();
  const aimWorld: AimWorld = {
    places: {
      open: { pick: home.glade, hint: home.gladeHint },
      hol: { pick: home.thicket, hint: home.thicketHint },
    },
    begin: () => { roeOut(); home.showTags(true); home.showFan(true); },
    end: () => { home.showTags(false); home.showFan(false); home.showVisitor(null); home.birdFidget(null); },
    look: async (bin) => {
      home.aim(cameraAim(AIM_AT[bin]), k.reduced);
      await k.until(() => !home.aiming, 3);
    },
    arrive,
    visitor: home.visitor,
    touch: (item) => {
      // a click on the animal itself: it lifts its head and looks at the camera a moment
      // (no choice: the camera only turns to a place)
      if (isBird(item.id)) { home.birdHop(true, item.id); void k.wait(0.3).then(() => home.birdHop(false, item.id as BirdId)).catch(() => {}); return; }
      const a = A[item.id as Walker];
      void a.lookAt(() => ({ x: CAMERA.x, z: CAMERA.z, speed: 0 }), 0.9).then((ok) => { if (ok && standing.at && standing.id === item.id) void a.go(a.x, a.z, { face: standing.yaw }); });
    },
    photo: async (item: WisselItem, bin: WisselBin, looked: Promise<void>) => {
      const id = item.id;
      const s = varied(aimSpot(id, bin), id);
      if (isBird(id)) s.lift = home.birdLift(id, bin); // (its perch, as the model stands)
      at.set(id, s);
      shotAt.set(id, bin);
      home.showVisitor(null);
      home.birdFidget(null);
      standing.at = null;
      // (a newcomer from this place's side waits until this one is nearly there: its way in
      // passes the place, and this one walks off out the back of it after its photo)
      let there!: () => void;
      reached = { side: SIDE_OF[bin], at: new Promise<void>((r) => { there = r; }) };
      const nearly = isBird(id) ? null : k.onTick(() => {
        const a = A[id as Walker];
        if (Math.hypot(a.x - s.at.x, a.z - s.at.z) < 1.8) { there(); nearly?.(); }
      });
      // it sets off from its stop at once, while the camera still turns to the place; the
      // shutter waits for both
      const goThere = async (): Promise<void> => {
        if (isBird(id)) {
          const p = home.birdAtOf(id);
          await k.guard(home.fly({ x: p.x, z: p.z, y: p.y - k.ctx.groundY(p.x, p.z) }, { ...s.at, lift: s.lift ?? 0 }, s.yaw, k.reduced, FLY_S, id));
          return;
        }
        const a = A[id as Walker];
        if (!a.group.visible) { a.place(s.from.x, s.from.z, headingTo(s.from, s.at)); a.group.visible = true; }
        await walkTo(a, s.at, (PACE[id] ?? 1.1) * 1.2, s.yaw);
      };
      try {
        await Promise.all([goThere(), looked]);
      } finally {
        there();
        nearly?.();
      }
      // a deer (and the fox) rests in the thicket by night: it lies down
      if ((id === 'ree' || id === 'vos') && bin === 'hol') await k.guard(A[id].lie(true));
      await k.wait(0.12);
      const night = k.world.daylight() < 0.5;
      shutter(night);
      // framed on the animal where it stands (the camera triggers on it): its middle, a
      // little more than its height in the picture
      const bird = isBird(id);
      const walker = bird ? null : A[id as Walker];
      const lying = !!walker?.lies;
      const h = bird ? (id === 'gaai' ? 0.42 : 0.26) : walker!.height * (lying ? 0.5 : id === 'edelhert' ? 0.85 : 1);
      const where = walker ? { x: walker.x, z: walker.z } : { x: home.birdAtOf(id as BirdId).x, z: home.birdAtOf(id as BirdId).z };
      // (a bird: a close-up on its perch — a small bird fills the picture, and what stands
      // round its perch, the sett, stays out of it)
      const p = bird
        ? await photograph(where, home.birdAtOf(id as BirdId).y - k.ctx.groundY(where.x, where.z) + h * 0.45, id === 'gaai' ? 0.9 : 0.72, id, night ? 'nacht' : 'dag', undefined, 8)
        : await photograph(where, h * 0.5, Math.max(1.1, h * (h > 1 ? 1.6 : 2.3)), id, night ? 'nacht' : 'dag');
      if (p) photos.add(p);
      // run 7 (wc-album): he saw the fox walk in and stand for its photo
      if (id === 'vos') k.discover('wildcamera.vos');
      // it heard the click: its head comes up, it looks at the camera a moment
      if (walker && !walker.lies) void walker.lookAt(() => ({ x: CAMERA.x, z: CAMERA.z, speed: 0 }), 0.9);
      k.stats.photos = photos.photos.length;
      await k.wait(0.3);
    },
    empty: async (bin) => {
      const night = k.world.daylight() < 0.5;
      shutter(night);
      // the animal on the crossing heard the click: it looks up at the camera, then back
      const id = standing.id;
      if (id && !isBird(id) && standing.at) {
        const a = A[id as Walker];
        void a.lookAt(() => ({ x: CAMERA.x, z: CAMERA.z, speed: 0 }), 1.0).then((ok) => { if (ok && standing.id === id && standing.at) void a.go(a.x, a.z, { face: standing.yaw }); });
      } else if (id && isBird(id)) { home.birdHop(true, id); void k.wait(0.35).then(() => home.birdHop(false, id as BirdId)).catch(() => {}); }
      const p = await photograph(AIM_AT[bin], 0.5, 2.2, 'leeg', night ? 'nacht' : 'dag');
      if (p) photos.empty(p, c.leeg.split('.')[0]);
      await k.wait(0.5);
    },
    leave: (item) => { const bin = shotAt.get(item.id); if (bin) walkOut(item.id, bin); },
    leaving: (bin) => [...walkingOff.values()].some((w) => w.bin === bin && k.now < w.until),
    turn: async (to) => {
      // the sky turns (the camera's light turns to its infrared glow as the dusk passes,
      // home.setNight); the places keep their sun and moon: the rule turned, not they
      clock.turn(to);
      k.daylight(to === 'night' ? 0 : 1, 2.4);
      await k.wait(1.0);
      if (settings.geluid) Sound.select();
      await k.wait(1.6);
    },
    miss: () => {
      // a press beside both places: the camera shakes a calm "no", tick-tick
      if (!home.shake(k.reduced) || !settings.geluid) return;
      Sound.step();
      void k.wait(0.2).then(() => Sound.step()).catch(() => {});
    },
  };
  await aimBeat(k, 0, {
    view: CROSS_VIEW, stand: P.watch, world: aimWorld,
    lines: {
      vraag: c.vraag, komt: (id) => c[`kijk_${id}`] ?? c.vraag, kijk: (id) => c[`kijk_${id}`] ?? c.vraag, foto: c.foto, leeg: c.leeg,
      nacht: c.nacht, dag: c.dag, andersom: c.andersom, goed: k.steps[0].skin.copy?.goed ?? c.foto,
    },
  });
  // the last one walks off too
  for (const [id, sp] of at) {
    const out = isBird(id) ? home.birdOut(id) : A[id as Walker].group.visible;
    const bin = shotAt.get(id);
    if (out && bin && !leaving.has(id)) walkOut(id, bin);
    void sp;
  }
  photos.show(false);
  home.aim(0, k.reduced); // the camera looks back at the crossing

  /* 5 · the raaf: the badger sleeps by day */
  await k.fact(0);

  /* 6 · night: who comes? Run 7: the night's callers (the badger and three of the roe, the
         boar, the nightjar and the fox), each walking (or flying) in to its spot of this
         night, one after another */
  k.beat = 'night';
  if (k.world.daylight() > 0.2) {
    clock.turn('night'); // (wc-album: a round that ended in the day: the camera's clock runs into a night again)
    k.say(c.donker);
    k.daylight(0, 2.4);
    await k.wait(2.6);
  }
  k.say(c.nachtKomt);
  // (any animal of the evening still about walks off: the night ones come in)
  for (const id of ['edelhert', 'hinde', 'ree', 'das', 'wildzwijn', 'vos'] as Walker[]) {
    if (A[id].group.visible && !wp.callers.some((n) => n.id === id)) { const bin = shotAt.get(id); if (bin && !leaving.has(id)) walkOut(id, bin); }
  }
  for (const b of ['nachtzwaluw', 'gaai'] as BirdId[]) if (home.birdOut(b) && !wp.callers.some((n) => n.id === b)) home.birdGone(b);
  const comeOut = async (id: string, slotId: SlotId, delay: number): Promise<void> => {
    await k.wait(delay);
    const slot = CALLER_SLOTS[slotId];
    if (id === 'nachtzwaluw') {
      birdToken.nachtzwaluw += 1;
      const lift = slotId === 'stump' ? home.stumpLift : slot.lift ?? 0;
      await k.guard(home.fly({ ...slot.from, y: slot.from.y ?? 4 }, { ...slot.at, lift }, slot.yaw, k.reduced, 2.6));
      return;
    }
    const a = A[id as Walker];
    leaving.delete(id);
    walkingOff.delete(id);
    if (a.lies) await a.lie(false);
    if (!a.group.visible) { a.place(slot.from.x, slot.from.z, headingTo(slot.from, slot.at)); a.group.visible = true; }
    await k.guard(Promise.race([a.go(slot.at.x, slot.at.z, { speed: (PACE[id] ?? 1) * 0.8, face: slot.yaw }), k.wait(10).then(() => false)]));
  };
  await k.wait(0.6);
  await Promise.all(wp.callers.map((n) => comeOut(n.id, n.slot, n.delay)));
  k.stats.callers_in = wp.callers.length;
  await k.wait(0.8);

  /* 7 · they call; he calls them back in the same order (simon) */
  const caller = (id: Walker): Caller => {
    const a = A[id];
    return {
      id, pick: a.group, body: a.body, at: () => ({ x: a.x, z: a.z }),
      act: (on) => { if (on) void a.lookAt(lens, 0.9); },
    };
  };
  const nightjar = (): Caller => {
    // (on the log a click on the bird or its log counts; on the stump, the bird)
    const onLog = wp.callers.some((n) => n.id === 'nachtzwaluw' && n.slot === 'log');
    return { id: 'nachtzwaluw', pick: onLog ? home.perch : home.bird, body: home.birdObject, hint: home.birdObject, at: () => home.birdAt, act: (on) => home.birdHop(on) };
  };
  const simonCopy = k.steps[1].skin.copy ?? {};
  await callersBeat(k, 1, {
    view: null,
    callers: wp.callers.map((n) => (n.id === 'nachtzwaluw' ? nightjar() : caller(n.id as Walker))),
    lines: {
      luister: simonCopy.luister ?? 'Luister wie er roept…', echo: simonCopy.echo ?? 'Doe ze na. Klik op de dieren.',
      goed: simonCopy.goed ?? 'Knap onthouden!', groei: c.groei, opnieuw: c.opnieuw,
    },
    onCall: (id) => {
      home.glowIr(0.9);
      if (id === 'vos') k.discover('wildcamera.vos'); // (wc-album: its call reached him)
    },
  });

  /* 7b · run 7 (wc-album): a rare night — a fox with her two cubs crosses the crossing in
          the camera's infrared glow, and it photographs them (the night's other animals
          look up as they pass) */
  if (cubs) await foxFamily(cubs);

  /* 8 · the night animals go; the night passes */
  k.beat = 'morning';
  k.say(c.slapen);
  for (const n of wp.callers) {
    const slot = CALLER_SLOTS[n.slot];
    if (n.id === 'nachtzwaluw') {
      const token = ++birdToken.nachtzwaluw;
      const p = home.birdAt;
      void home.fly({ x: p.x, z: p.z, y: p.y - k.ctx.groundY(p.x, p.z) + 0.2 }, { x: slot.from.x, z: slot.from.z, lift: 3.4 }, 0, k.reduced, FLY_S)
        .then(() => { if (token === birdToken.nachtzwaluw) home.birdGone('nachtzwaluw'); });
      continue;
    }
    const a = A[n.id as Walker];
    void a.go(slot.from.x, slot.from.z, { speed: PACE[n.id] ?? 1.1 });
  }
  await k.wait(2.6);
  k.say(null);
  k.ui.veil(c.ochtend);
  await k.wait(1.2);
  // behind the veil: first light; the camera saw a man by the trail at dawn
  for (const id of ['edelhert', 'hinde', 'ree', 'das', 'wildzwijn', 'vos'] as Walker[]) { A[id].group.visible = false; A[id].idle(); if (A[id].lies) void A[id].lie(false); }
  home.birdGone();
  // run 7 (wc-album): in the deep of the night the camera clicked on its own: an animal
  // sniffed at its lens (the funny close-up, some plays); the roe comes at first light
  if (wp.neus && wp.neus !== 'ree') await closeUp(wp.neus, 'nacht');
  // the morning of this play: misty, or clear (a cut behind the veil; the end of the
  // mission hands the visit's own light back)
  k.world.setMood(wp.dawn, 0);
  k.daylight(0.3, 0);
  if (wp.neus === 'ree') { await k.wait(0.1); await closeUp('ree', 'ochtend'); }
  home.aim(cameraAim(snareSpot.at), true);
  await k.wait(0.2);
  // (framed on the man crouched at the wire at this play's spot: his height, a little more,
  // with its two landmarks beside him: the camera zooms in on him as on the nightjar)
  // (in the dawn mist: what lies far behind him fades, so the photo shows the man and the
  // two things beside him, and nothing that is not there)
  const toMan = dist(CAMERA, snareSpot.at);
  const man = await photograph(snareSpot.at, 0.62, 2.1, 'man', 'ochtend', () => {
    const a = home.poacherIn(), b = home.dawnMist(toMan - 1.5, toMan + 11);
    return () => { b(); a(); };
  }, 11);
  if (man) photos.photos.push(man);
  k.cluePhoto = man?.url ?? null;
  await k.wait(1.4);
  k.ui.veil(null);
  k.daylight(1, 3.2); // the sun comes up
  await k.wait(1.6);

  /* 9 · what did the camera see? the photos, and the man on the last one */
  k.beat = 'photos';
  k.say(c.fotos);
  await k.wait(1.6);
  k.say(null);
  k.stats.photos = photos.photos.length;
  // (the snare he set lies there: it is in the world from here on, while the photos' card
  // is up, so the child finds it after the photo told him about it). Run 7: he flips
  // through them himself; the man's comes last: "Waar is dit?"
  // (wc-album: a nose at the lens is a find once he has flipped to it)
  const review = photos.review(c.fotoTitel, [c.man, c.waar], 'Verder', k.signal, (p) => { if (p.what === 'neus') k.discover('wildcamera.neus'); });
  home.showSnare(true);
  await k.guard(review);
  /* 10 · the raaf: the camera tells the ranger who lives here */
  await k.fact(1);

  /* 11 · the snare: the photo showed the man at it by two things of the wood. He looks
          for that place himself, from where he stands by his camera, with the photo pinned
          at the top of his screen: up the wildwissel, or on the deer trail north of the
          glade (this play's spot). The chip names it; the arrow comes only after ~20 s
          without getting nearer. (He steps out from beside the pine onto the open crossing
          first, turned to the glade: the lens stays behind him there, looking over the
          crossing.) Near it he takes the last step to it, sees it in the grass ("Zie je de
          val?") and clicks the wire loop: it is gone */
  await k.walkRanger(P.handBack.x, P.handBack.z, 0.05);
  if (man) photos.pin(man);
  // (he turns from the glade to the wood where the man was: the lens comes round behind
  // him, so the place on the photo lies ahead of him, whichever of the three it is)
  await k.frame(SEARCH_VIEW, { face: SEARCH_VIEW.heading });
  // (a search of his own, the photo in his hand: the veldgids's reveals wait for the walk
  // back, never over the wood he compares with the photo)
  await k.walk({
    name: 'val', beat: 'seek:val', to: snareSpot.approach, r: snareSpot.approach.r, reached: () => dist(k.ranger(), snareSpot.at) < SNARE_FOUND,
    line: c.zoekVal, doel: c.chipVal, cue: c.bijPad, glyph: 'photo',
  });
  k.beat = 'val';
  k.say(c.zieVal);
  await k.walkRanger(snareSpot.approach.x, snareSpot.approach.z, 0.05);
  await k.frame(snareSpot.view, { face: snareSpot.approach.heading });
  const wire = home.snareObject;
  if (wire) await clickOn('snare', [{ id: 'snare', object: wire }], () => (home.snareObject?.visible ? home.snareHint : null));
  if (settings.geluid) Sound.rustle();
  await k.guard(home.liftSnare(k.ranger(), k.reduced));
  photos.pin(null);
  if (settings.geluid) Sound.found();
  k.say(c.valWeg, { good: true });
  k.stats.snare_gone = 1;
  await k.wait(1.8);

  /* 12 · back to his camera on the pine (he walks it himself, turned the way back, the lens
          behind him: the Up key walks him home): he is there once he is by the pine,
          whichever side he comes to it */
  await k.frame(walkBackView(k.ranger()), { face: headingTo(k.ranger(), P.handBack) });
  await k.walk({
    name: 'terug', to: P.handBack, r: P.handBack.r, reached: () => dist(k.ranger(), CAMERA) < 3.2,
    line: c.terug, doel: c.chipCamera, cue: c.bijBoom, glyph: 'camera',
  });

  /* 13 · the camera guards the wood: on the open crossing, a step out from his camera, he
          looks across it at the glade; a roe comes in from the trees and grazes there;
          click. He is handed back where he stands (the follow camera takes over from the
          crossing's view: his first step into it passes the pine) */
  const roe = WILDCAMERA_HOME.residents.find((r) => r.key === 'ree')!.after!;
  k.beat = 'reunion:walk';
  await k.walkRanger(P.handBack.x, P.handBack.z, 0.05);
  await k.frame(REUNION_VIEW, { face: P.handBack.heading });
  /* 13a · run 7 (wc-album): a rare morning — the roe that steps into the glade is WHITE: a
           second roe of this play (her own pale coat: the glade's own roe and the reekalf's
           mother stay brown), click, "Een witte ree! Heel bijzonder." She grazes a moment
           and goes back in under the trees; the glade's own roe comes back once he is done */
  if (whiteRoe) {
    k.beat = 'witte-ree';
    k.say(null); // (he is back: he watches her step out, nothing to read)
    await k.guard(Promise.race([whiteRoe.ready, k.wait(4)]));
    const from = aimSpot('ree', 'open').from;
    whiteRoe.place(from.x, from.z, headingTo(from, roe));
    whiteRoe.group.visible = true;
    home.aim(cameraAim(roe), k.reduced);
    await k.guard(Promise.race([whiteRoe.go(roe.x, roe.z, { speed: 1.1, face: roe.yaw }), k.wait(8)]));
    shutter(false);
    const p = await photograph({ x: whiteRoe.x, z: whiteRoe.z }, whiteRoe.height * 0.55, whiteRoe.height * 1.7, 'witte-ree', 'dag');
    if (p) photos.pin(p);
    k.say(c.witteRee, { good: true });
    k.discover('wildcamera.witte-ree');
    k.stats.white_roe = 1;
    whiteRoe.root(roe.x, roe.z, 0.3);
    await k.wait(3.4);
    photos.pin(null);
  }
  await k.reunion(async () => {
    if (whiteRoe) {
      // she grazes on while the words show, then goes calmly back in under the trees, out of
      // the picture; the glade's own roe waits there (out of view) and walks in once the
      // mission is done
      await k.wait(3.2);
      await Promise.race([whiteRoe.go(WHITE_ROE_OUT.x, WHITE_ROE_OUT.z, { speed: 0.9 }), k.wait(6.5)]);
      whiteRoe.group.visible = false;
      A.ree.place(ROE_HIDEAWAY.x, ROE_HIDEAWAY.z, ROE_HIDEAWAY.yaw);
      A.ree.group.visible = false;
      A.ree.idle();
      return;
    }
    const from = aimSpot('ree', 'open').from;
    const a = A.ree;
    if (a.lies) await a.lie(false);
    a.place(from.x, from.z, headingTo(from, roe));
    a.group.visible = true;
    home.aim(cameraAim(roe), k.reduced);
    await Promise.race([a.go(roe.x, roe.z, { speed: 1.1, face: roe.yaw }), k.wait(8)]);
    shutter(false);
    a.root(roe.x, roe.z, roe.roam ?? 0.5);
    await k.wait(1.2);
  });
}

