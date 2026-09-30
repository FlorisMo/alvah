/**
 * wildlife.ts — how a roaming animal sees the jeep and the ranger coming (run 6, FEEL).
 *
 * Floris: "The car is bumped to the side by animals, seems a bit weird; they should avoid
 * being hit by the car and jump to the side." The roaming animals (ree, vos, wildzwijn,
 * eekhoorn) used to trace a blind loop that shoved the jeep. Here each one notices things:
 *
 *  - The JEEP, judged from where it will be over the next few seconds (its distance, speed,
 *    heading and turn: the path its body sweeps, `readJeep`). An animal in that path lifts
 *    its head, turns and trots — the ree bounds, low — off the track to the side it is
 *    already on (dead centre: away from the jeep's turn), toward open ground (`planYield`),
 *    stops a little way off and watches the jeep pass, then drifts back to grazing. It
 *    leaves the path before the jeep's own give-way brake (`core/vehicle.yieldBrake`) needs
 *    to act; if it cannot get away (no open ground on its side), it stands still and the
 *    brake stops the jeep in front of it. It never crosses the jeep's path to get away.
 *  - The RANGER on foot (`World.rangerMotion()`). Walking calmly he may come close: it looks
 *    up when he comes at it (`alert`), steps away when he is close (`flight`), and never
 *    lets him nearer than `near` — it keeps pace with him. Running at it, it trots off
 *    early (`runFlight`). A ranger who stands still is no threat: the animals graze on round
 *    him. Calm ranger, calm animals: the rustkracht lesson made physical.
 *
 * Never scary (VISION §6): nothing panics, squeals, sprints at the camera or runs toward the
 * ranger or the jeep; every move is a turn and a walk, trot or bound along the way it faces
 * (never sideways, never backwards), at a calm turn rate. Hysteresis on every threshold, so
 * an animal on the edge of a distance never twitches between two modes.
 *
 * One step (`wildStep`) moves one animal one frame: its mode (`roam` along its loop,
 * `alert` watching, `away` from the ranger, `yield` off the jeep's path, `return` to its
 * loop), where it goes and how it moves there. The world it moves in comes in through
 * `WildWorld` (open ground, a collision-resolved step, its roam loop), so this module stays
 * THREE-free, DOM-free and deterministic: unit-tested in wildlife.test.ts. Exported for the
 * missions lane: their staged animals can react to a running ranger with the same rules
 * (`readRanger`, `planAway`, `TEMPERAMENT`).
 */

import {
  jeepStep, JEEP_BODY, YIELD_DECEL, YIELD_GAP, YIELD_MARGIN,
  type DriveCaps, type DriveInput, type JeepState, type JeepWorld,
} from './vehicle.ts';

/** What an animal is doing. */
export type WildMode = 'roam' | 'alert' | 'away' | 'yield' | 'return';
/** How it moves its legs: standing, walking, trotting (a fox lopes, a squirrel scampers),
 *  bounding (the ree, a low arc). */
export type WildGait = 'still' | 'walk' | 'trot' | 'bound';

/**
 * A species' temperament: how fast it walks, trots and turns, and how close it lets the
 * ranger come. All distances in metres from the animal's centre, speeds in m/s.
 */
export interface Temperament {
  /** its calm walk: the top speed of its roam loop and the walk back to it */
  walk: number;
  /** stepping away from a calm ranger */
  step: number;
  /** trotting off (making way for the jeep, a running ranger) */
  trot: number;
  /** its fastest, only when he runs hard at it or the jeep comes fast */
  top: number;
  /** it bounds at speed (a low arc): the ree */
  bounds: boolean;
  /** its calm body turn and its quick one (making way), rad/s */
  turn: number;
  turnQuick: number;
  /** a walking ranger coming at it: it looks up inside `alert`, steps away inside `flight`
   *  and never lets him nearer than `near` */
  alert: number;
  flight: number;
  near: number;
  /** a running ranger coming at it: it looks up inside `runAlert`, trots off inside `runFlight` */
  runAlert: number;
  runFlight: number;
  /** it watches this long (s) after the last threat before it goes back to its grazing */
  watch: number;
}

/**
 * The four roamers. Real animals, scaled to the game's calm: a roe deer lets a quiet walker
 * come to a few metres and bounds off when chased; a fox is warier; a sow is heavy and slow
 * to turn and lets you come closest; a squirrel lets you come to a couple of metres and then
 * scampers. The walk speeds keep the baked walk clips from skating (a ree's clip covers
 * about 0.6 m/s at its own rate, played faster here); `top` is only reached when the
 * ranger runs (4.2 m/s) straight at it, so he can never catch one.
 */
export const TEMPERAMENT: Readonly<Record<string, Temperament>> = {
  'animal-ree-roedeer': {
    walk: 0.95, step: 1.4, trot: 2.6, top: 4.6, bounds: true, turn: 2.2, turnQuick: 3.8,
    alert: 6, flight: 3.6, near: 1.5, runAlert: 11, runFlight: 8.5, watch: 3,
  },
  'animal-vos-fox': {
    walk: 0.9, step: 1.5, trot: 2.8, top: 4.6, bounds: false, turn: 2.6, turnQuick: 4,
    alert: 7, flight: 4.5, near: 1.8, runAlert: 12, runFlight: 9, watch: 3,
  },
  'animal-wildzwijn-boar': {
    walk: 0.8, step: 1.2, trot: 2.3, top: 4.4, bounds: false, turn: 1.8, turnQuick: 3.2,
    alert: 5.5, flight: 3.2, near: 1.6, runAlert: 10, runFlight: 7.5, watch: 3.5,
  },
  'animal-eekhoorn-squirrel': {
    walk: 0.7, step: 1.6, trot: 2.4, top: 4.4, bounds: false, turn: 3, turnQuick: 4.2,
    alert: 4.5, flight: 2.6, near: 1.2, runAlert: 8, runFlight: 6, watch: 2.5,
  },
};

/** A creature without its own row reacts like a roe deer (the calm default). */
export function temperamentFor(id: string): Temperament {
  return TEMPERAMENT[id] ?? TEMPERAMENT['animal-ree-roedeer'];
}

/** The ranger on foot, as `World.rangerMotion()` reads him: where he stands, the way he
 *  faces (rad, `rotation.y`), his ground speed (m/s, − = backing up) and whether he runs. */
export interface RangerRead { x: number; z: number; heading: number; speed: number; running: boolean }
/** What an animal can react to this frame (null = not there: he rides, nobody drives). */
export interface Threats { ranger: RangerRead | null; jeep: JeepRead | null }

/** A point on the roam loop (`AmbientPaths.wanderAt` has this shape). */
export interface LoopPoint { x: number; z: number; facing: number; moving: boolean }

/** The world one animal moves in (supplied by the World; stubs in the unit tests). */
export interface WildWorld {
  /** Open ground for an animal of footprint radius `r` at (x, z): no trunk, bush, wall,
   *  person, water, forest edge, mission-marker ground or helipad. */
  free(x: number, z: number, r: number): boolean;
  /** Its step from (fx, fz) toward (tx, tz), slid round whatever it meets (trunks, walls,
   *  the ranger, the jeep, marker ground), written into `out`. */
  move(fx: number, fz: number, tx: number, tz: number, out: { x: number; z: number }): void;
  /** Where its roam loop is at loop time `t` (s). */
  loop(t: number): LoopPoint;
  /** Seconds per leg of that loop (to skip to the next waypoint when the way back is blocked). */
  readonly loopLeg: number;
}

/** One animal's state (mutated in place by `wildStep`: no garbage per frame). */
export interface WildState {
  x: number;
  z: number;
  /** the way it faces and moves (rad, `rotation.y` convention: forward = (sin, cos)) */
  facing: number;
  /** its speed along its facing (m/s) */
  speed: number;
  /** the speed it really moved at last frame (m/s): the legs follow this */
  moved: number;
  /** how fast its body turned last frame (rad/s): the legs step round on a turn */
  turning: number;
  mode: WildMode;
  gait: WildGait;
  /** seconds in this mode */
  inMode: number;
  /** its own roam clock (s): runs only while it roams, so it resumes where it left off */
  loopT: number;
  /** where it is going (away, yield, return) */
  gx: number;
  gz: number;
  /** what it watches (alert) */
  lookX: number;
  lookZ: number;
  /** the side of the jeep's current line it makes way to (+1 = the jeep's left, −1 its right;
   *  0 = it has not made way). Chosen once per encounter and kept until it roams again: it
   *  never crosses in front of the bonnet to the other side, however the driver steers */
  side: number;
  /** it bears away without a clear spot to stand (the jeep steers at it): at its top speed */
  bear: boolean;
  /** it has made way for the jeep someone drives now (until he climbs out) */
  madeWay: boolean;
  /** how far (m) that jeep has come at it by its own motion since it last settled to watch
   *  (never less than 0: backing off banks nothing; its own walk back is not counted) */
  closed: number;
  /** where that jeep was last frame (NaN: nobody drove) */
  jx: number;
  jz: number;
  /** seconds since the last threat */
  quiet: number;
  /** seconds without progress on its way back */
  stuck: number;
  /** seconds until its plan is looked at again */
  replan: number;
  /** what it reacts to */
  threat: 'jeep' | 'ranger' | null;
  /** watching, its body is turning to what it watches (a latch: it turns once, then holds) */
  watchTurn: boolean;
  /** how fast it wants to go on its way (m/s) */
  pace: number;
}

/** A fresh animal standing on its loop at loop time `loopT`. */
export function newWildState(at: LoopPoint, loopT: number): WildState {
  return {
    x: at.x, z: at.z, facing: at.facing, speed: 0, moved: 0, turning: 0, mode: 'roam', gait: 'still',
    inMode: 0, loopT, gx: at.x, gz: at.z, lookX: at.x, lookZ: at.z, side: 0, bear: false, madeWay: false, closed: 0, jx: NaN, jz: NaN,
    quiet: 99, stuck: 0, replan: 0, threat: null, watchTurn: false, pace: 0,
  };
}

/** The ranger's own footprint (m) when an animal keeps off him (a child, a little room). */
export const RANGER_BODY = 0.3;

/* ------------------------------------------------------------------ the jeep -- */

/** Half the jeep's width (m): its widest body circle. */
export const JEEP_HALF = Math.max(...JEEP_BODY.map((c) => c.r));
/** From the jeep's centre to the front (and back) of its body (m). */
export const JEEP_REACH = Math.max(...JEEP_BODY.map((c) => Math.abs(c.along) + c.r));
/** The body's centre line runs this far (m) fore and aft of its centre (its end circles). */
const JEEP_SPINE = Math.max(...JEEP_BODY.map((c) => Math.abs(c.along)));
/** How many seconds of the jeep's path an animal looks along: at 6 m/s it starts moving
 *  about 20 m in front of the jeep's nose (enough to be off the path, trotting or bounding,
 *  before the jeep's give-way brake would ease it back). */
export const JEEP_HORIZON = 3.4;
/** The predicted path: a pose every `PATH_DT` s over the horizon (`predictJeep`), each
 *  `PATH_STRIDE` numbers: x, z, heading, signed speed. */
export const PATH_DT = 0.1;
export const PATH_N = Math.round(JEEP_HORIZON / PATH_DT) + 1;
export const PATH_STRIDE = 4;
/** Beyond the brake's corridor, the path an animal keeps out of is this much (m) wider… */
export const JEEP_CLEAR = 1.2;
/** …and when it makes way it stands this much (m) further out still, to watch it pass. */
export const JEEP_STAND_OFF = 1.1;
/** A driven jeep this close (m, body to body) that barely moves: the animal steps away. */
export const JEEP_NEAR = 3;
/** A jeep whose path comes within this (m) of an animal is watched (head up). */
export const JEEP_WATCH = 9;

/** A jeep someone drives: its centre, heading (`rotation.y`), signed speed along its heading
 *  (m/s, − = backing up), its yaw rate (rad/s, + = turning left) and, when the World has
 *  it, where it will be over the next `JEEP_HORIZON` seconds if the driver keeps doing what
 *  he does (`predictJeep`: the bends round zones, trunks, walls and the forest edge
 *  included), `pathN` poses in `path`. Without one, its heading and turn are extended. */
export interface JeepRead {
  x: number; z: number; heading: number; speed: number; yawRate: number;
  path: Float64Array | null;
  pathN: number;
}

/**
 * The half-width (m) of the path the jeep's give-way brake watches for an animal of
 * footprint radius `r` (`vehicle.yieldBrake`: its widest body circle + the animal + the
 * margin). An animal whose centre is further than this from the jeep's line never makes it
 * brake.
 */
export function jeepCorridor(r: number): number {
  return JEEP_HALF + r + YIELD_MARGIN;
}

/**
 * Where the jeep will be over the next `JEEP_HORIZON` seconds if the driver keeps `want`
 * (the jeep's own pure frame, `vehicle.jeepStep`, run ahead in `PATH_DT` steps): written
 * into `out` as (x, z, heading, speed) poses from now; returns how many. `w` must hold NO
 * animals (else the jeep would be seen braking for the very animal that reads it). Pure.
 */
export function predictJeep(s: JeepState, want: DriveInput, caps: DriveCaps, w: JeepWorld, out: Float64Array): number {
  let st: JeepState = s;
  out[0] = s.x; out[1] = s.z; out[2] = s.heading; out[3] = s.speed;
  let n = 1;
  for (; n < PATH_N; n++) {
    const f = jeepStep(st, want, PATH_DT, caps, w);
    const o = n * PATH_STRIDE;
    out[o] = f.x; out[o + 1] = f.z; out[o + 2] = f.heading; out[o + 3] = f.speed;
    st = f;
    if (want.throttle === 0 && Math.abs(f.speed) < 0.05) { n++; break; }
  }
  return n;
}

// a jeep read without a prediction: its heading and turn, extended at its speed
const arcBuf = new Float64Array(PATH_N * PATH_STRIDE);
function arcPath(j: JeepRead): number {
  let x = j.x, z = j.z, h = j.heading;
  for (let i = 0; i < PATH_N; i++) {
    const o = i * PATH_STRIDE;
    arcBuf[o] = x; arcBuf[o + 1] = z; arcBuf[o + 2] = h; arcBuf[o + 3] = j.speed;
    x += Math.sin(h) * j.speed * PATH_DT; z += Math.cos(h) * j.speed * PATH_DT;
    h += j.yawRate * PATH_DT;
  }
  return PATH_N;
}
let posesOf: Float64Array = arcBuf;
/** Point `posesOf` at the jeep's poses; returns how many. */
function poses(j: JeepRead): number {
  if (j.path && j.pathN > 1) { posesOf = j.path; return j.pathN; }
  posesOf = arcBuf;
  return arcPath(j);
}

// module scratch for `keepOut` (no garbage)
let koGap = Infinity, koHit = -1;
/**
 * How close (m) the point (x, z) comes to the ground the jeep will cover: its body at every
 * predicted pose, each with the stretch its give-way brake looks along straight ahead (the
 * distance it would need to stop softly from that speed), measured from the jeep's widest
 * side to the point's own footprint `r` (`koGap`; < 0 = it touches). `koHit` = the first
 * pose whose ground comes within `need` of it (−1 none). Poses whose body has already passed
 * the point are skipped.
 */
function keepOut(n: number, x: number, z: number, r: number, need: number): void {
  const P = posesOf;
  koGap = Infinity; koHit = -1;
  for (let i = 0; i < n; i++) {
    const o = i * PATH_STRIDE;
    const h = P[o + 2], v = P[o + 3];
    const fx = Math.sin(h), fz = Math.cos(h);
    const dx = x - P[o], dz = z - P[o + 1];
    const along = dx * fx + dz * fz;
    const dir = v >= 0 ? 1 : -1;
    if (along * dir < -JEEP_REACH) continue;                  // already behind the body
    const look = Math.abs(v) > 0.3 ? (v * v) / (2 * YIELD_DECEL) + YIELD_GAP : 0;
    const lo = dir > 0 ? -JEEP_SPINE : -JEEP_SPINE - look, hi = dir > 0 ? JEEP_SPINE + look : JEEP_SPINE;
    const a = along < lo ? lo : along > hi ? hi : along;
    const gap = Math.hypot(dx - fx * a, dz - fz * a) - JEEP_HALF - r;
    if (gap < need && koHit < 0) koHit = i;
    if (gap < koGap) koGap = gap;
  }
}

// module scratch for `lineOf` (no garbage)
let lnLat = 0;
/**
 * How far (x, z) lies across the jeep's CURRENT line (its centre and heading, not the path it
 * may curve along): `lnLat` m (+ = its left). The side an animal keeps to is judged here: a path predicted with the wheel turned
 * at the animal wraps round it, and its side of that curve points across the jeep's nose.
 */
function lineOf(j: JeepRead, x: number, z: number): void {
  const fx = Math.sin(j.heading), fz = Math.cos(j.heading);
  lnLat = (x - j.x) * fz - (z - j.z) * fx;
}

/** What an animal makes of a driven jeep this frame. */
export interface JeepView {
  /** 'path': it is in (or about to be in) the ground the jeep will cover; 'near': the jeep
   *  stands or crawls right by it; 'watch': the jeep comes by, worth watching; 'none' */
  kind: 'none' | 'watch' | 'near' | 'path';
  /** how far (m) it stands off the jeep's current line (+ = its left; 0 = dead ahead) */
  lat: number;
  /** seconds until the jeep's ground reaches it (Infinity when it is not coming) */
  tti: number;
}

const jeepView: JeepView = { kind: 'none', lat: 0, tti: Infinity };

/** A jeep this still (m/s now, and m over its whole predicted path) is standing. */
function standing(j: JeepRead, n: number): boolean {
  if (Math.abs(j.speed) >= 0.3) return false;
  const P = posesOf, o = (n - 1) * PATH_STRIDE;
  return Math.hypot(P[o] - j.x, P[o + 1] - j.z) < 1;
}

/**
 * How the animal at (x, z), footprint radius `r`, sees the jeep: is it in the ground the jeep
 * will cover over the next `JEEP_HORIZON` seconds (`keepOut`: the brake's corridor widened
 * by `JEEP_CLEAR`, so the animal is always out of it before the brake would act), close by,
 * or just coming past? Returns a reused object (read it before the next call).
 */
export function readJeep(x: number, z: number, r: number, j: JeepRead | null): JeepView {
  const v = jeepView;
  v.kind = 'none'; v.lat = 0; v.tti = Infinity;
  if (!j) return v;
  const n = poses(j);
  const need = YIELD_MARGIN + JEEP_CLEAR;
  if (standing(j, n)) {
    // body to body, now
    const fx = Math.sin(j.heading), fz = Math.cos(j.heading);
    let gap = Infinity;
    for (const c of JEEP_BODY) gap = Math.min(gap, Math.hypot(x - (j.x + fx * c.along), z - (j.z + fz * c.along)) - c.r - r);
    if (gap < JEEP_NEAR) v.kind = 'near';
    return v;
  }
  keepOut(n, x, z, r, need);
  lineOf(j, x, z);
  v.lat = lnLat;
  if (koHit >= 0) { v.kind = 'path'; v.tti = koHit * PATH_DT; return v; }
  if (koGap < JEEP_WATCH) v.kind = 'watch';
  return v;
}

/** Whether (x, z) lies clear of the ground the jeep will cover by at least `need` (m) of
 *  footprint gap, and on `side` of the jeep's current line. Call `poses` first. */
function clearOfPath(n: number, j: JeepRead, x: number, z: number, r: number, need: number, side: number): boolean {
  keepOut(n, x, z, r, need);
  if (koHit >= 0) return false;
  lineOf(j, x, z);
  return lnLat * side > 0;
}

const out2 = { x: 0, z: 0 };

// the frame the runs out of the jeep's way are laid in: straight out to `side` of its
// current line (`fanLx`/`fanLz`) and the way it moves (`fanUx`/`fanUz`)
let fanLx = 0, fanLz = 0, fanUx = 0, fanUz = 1;
function fanOf(j: JeepRead, side: number): void {
  const fx = Math.sin(j.heading), fz = Math.cos(j.heading);
  const dir = j.speed < -0.05 ? -1 : 1;
  fanUx = fx * dir; fanUz = fz * dir;
  fanLx = fz * side; fanLz = -fx * side;
}

/**
 * Where to make way for the jeep: a spot off the ground it will cover, on `side` of its
 * current line (+1 = the jeep's left), `JEEP_CLEAR + JEEP_STAND_OFF` beyond the brake's
 * corridor, reached along a straight run that stays on open ground (`world.free`) and goes
 * out to that side (never across the jeep's nose). The run goes out and a little ahead
 * (away from the jeep), the way a deer leaves a track, and as short as will do; it prefers
 * the least turn from where the animal faces. False when there is no such spot (no open
 * ground, or the jeep's path curves round to that side). Writes into `out`.
 */
export function planYield(
  x: number, z: number, facing: number, r: number, j: JeepRead, side: number, world: WildWorld,
  out: { x: number; z: number },
): boolean {
  const n = poses(j);
  const need = YIELD_MARGIN + JEEP_CLEAR;
  fanOf(j, side);
  const jx = j.x - x, jz = j.z - z, jl = Math.hypot(jx, jz) || 1;
  let best = Infinity;
  for (const deg of YIELD_ANGLES) {
    const b = (deg * Math.PI) / 180;               // 0 = straight out, + = out and ahead
    const mx = fanLx * Math.cos(b) + fanUx * Math.sin(b), mz = fanLz * Math.cos(b) + fanUz * Math.sin(b);
    if ((mx * jx + mz * jz) / jl > 0.05) continue;  // never a run toward where the jeep is
    const turn = Math.abs(wrapPi(Math.atan2(mx, mz) - facing));
    for (let len = 1.5; len <= 9.01; len += 0.75) {
      const gx = x + mx * len, gz = z + mz * len;
      if (!clearOfPath(n, j, gx, gz, r, need + JEEP_STAND_OFF, side)) continue;
      if (runFree(x, z, mx, mz, len, r, world)) {
        // the least turn, mostly out (a little ahead), the shortest run
        const cost = turn + Math.abs(deg - 20) * 0.02 + len * 0.12;
        if (cost < best) { best = cost; out.x = gx; out.z = gz; }
      }
      break;                                        // the shortest clear run of this heading
    }
  }
  return best < Infinity;
}
/** The run out of the jeep's way: straight out (0°) to well ahead (50°), and a touch back.
 *  Never further ahead: a jeep turning after it would soon point along its run. */
const YIELD_ANGLES = [0, 15, 25, 35, 50, -12];

/**
 * No spot on its side is clear (the driver steers at it, so the path he would drive wraps
 * round it): it bears away all the same, out to `side` of the jeep's current line and a
 * little ahead, `BEAR_RUN` m along open ground, the way that leaves it the most room from the
 * ground the jeep will cover. Replanned as the jeep turns, it curves on round to that side,
 * never back across the nose. False when no way out on that side is open (it then stands,
 * and the jeep's give-way brake stops the jeep). Writes into `out`.
 */
function bearAway(
  x: number, z: number, facing: number, r: number, j: JeepRead, side: number, world: WildWorld,
  out: { x: number; z: number },
): boolean {
  const n = poses(j);
  fanOf(j, side);
  const jx = j.x - x, jz = j.z - z, jl = Math.hypot(jx, jz) || 1;
  let best = -Infinity;
  for (const deg of BEAR_ANGLES) {
    const b = (deg * Math.PI) / 180;
    const mx = fanLx * Math.cos(b) + fanUx * Math.sin(b), mz = fanLz * Math.cos(b) + fanUz * Math.sin(b);
    if ((mx * jx + mz * jz) / jl > 0.05) continue;
    if (!runFree(x, z, mx, mz, BEAR_RUN, r, world)) continue;
    const gx = x + mx * BEAR_RUN, gz = z + mz * BEAR_RUN;
    keepOut(n, gx, gz, r, 0);
    const room = Math.min(koGap, 6);
    const score = room - Math.abs(wrapPi(Math.atan2(mx, mz) - facing)) * 0.5 - Math.abs(deg - 10) * 0.01;
    if (score > best) { best = score; out.x = gx; out.z = gz; }
  }
  return best > -Infinity;
}
/** Bearing away: straight out from the jeep's line, give or take a little. */
const BEAR_ANGLES = [0, 10, 20, 30, -10];
/** …this far (m) at a time, looked at again as the jeep turns. */
const BEAR_RUN = 5;

/** Every half metre of the straight run from (x, z) along (mx, mz) for `len` m is open
 *  ground for radius r (its own first half metre is not tested: it stands there). */
function runFree(x: number, z: number, mx: number, mz: number, len: number, r: number, world: WildWorld): boolean {
  for (let d = Math.min(0.5, len); d <= len + 1e-6; d += 0.5) {
    if (!world.free(x + mx * d, z + mz * d, r)) return false;
  }
  return world.free(x + mx * len, z + mz * len, r);
}

/* ---------------------------------------------------------------- the ranger -- */

/** What an animal makes of the ranger on foot. */
export interface RangerView {
  /** distance (m), centre to centre */
  d: number;
  /** how fast he comes at it (m/s; − = going away) */
  closing: number;
  /** it looks up: he comes at it inside its alert distance, or stands close */
  look: boolean;
  /** it moves away: he is inside its flight distance (a running ranger's, if he runs at it) */
  flee: boolean;
}
const rangerView: RangerView = { d: Infinity, closing: 0, look: false, flee: false };

/**
 * How the animal at (x, z) sees the ranger on foot: how near he is, how fast he comes at it,
 * whether it looks up and whether it moves away. `wary` = it is already alert or moving off,
 * `fleeing` = moving off from him (hysteresis: it lets him come a metre and a half further
 * off before it relaxes, and it keeps going while he keeps coming). A ranger standing still,
 * or walking past without coming at it, is no reason to look up; one closer than its flight
 * distance always is. Returns a reused object.
 */
export function readRanger(x: number, z: number, tm: Temperament, rg: RangerRead | null, wary: boolean, fleeing = false): RangerView {
  const v = rangerView;
  v.d = Infinity; v.closing = 0; v.look = false; v.flee = false;
  if (!rg) return v;
  const dx = x - rg.x, dz = z - rg.z;
  const d = Math.hypot(dx, dz);
  v.d = d;
  // his velocity along the line to the animal (+ = coming at it)
  v.closing = d > 1e-6 ? rg.speed * ((Math.sin(rg.heading) * dx + Math.cos(rg.heading) * dz) / d) : 0;
  const hyst = wary ? 1.5 : 0;
  const runs = rg.running && v.closing > 1;
  const alert = runs ? tm.runAlert : tm.alert;
  const flight = runs ? tm.runFlight : tm.flight;
  v.flee = d < flight + (fleeing && v.closing > 0.3 ? 1.5 : 0) || d < tm.near + 0.5;
  // it looks up when he comes at it, or moves about close by; a boy who stands still is
  // watched for a moment (`watch`) and then it grazes on (calm ranger, calm animals)
  const moving = Math.abs(rg.speed) > 0.2;
  v.look = v.flee || (d < alert + hyst && (v.closing > 0.25 || (wary && moving && v.closing > -0.25))) || (moving && d < tm.flight + 0.8 + hyst);
  return v;
}

/**
 * Where to step away from something at (fx, fz) (the ranger, a jeep that stands by it): a
 * spot `want` metres from it, roughly away from it (never past it), on open ground, along a
 * straight run; the least turn from where the animal faces, the most directly away. With
 * `home` (its loop), a long chase curves round its home ground instead of carrying it off
 * across the world (a gentle leash beyond `LEASH` m). False when it is cornered. Writes
 * into `out`.
 */
export function planAway(
  x: number, z: number, facing: number, r: number, fx: number, fz: number, want: number, world: WildWorld,
  out: { x: number; z: number }, home: { x: number; z: number } | null = null,
): boolean {
  const d = Math.hypot(x - fx, z - fz);
  const base = d > 1e-6 ? Math.atan2(x - fx, z - fz) : facing;
  const len = Math.max(1.2, want - d);
  let best = Infinity;
  for (const deg of AWAY_ANGLES) {
    const a = base + (deg * Math.PI) / 180;
    const mx = Math.sin(a), mz = Math.cos(a);
    const gx = x + mx * len, gz = z + mz * len;
    if (Math.hypot(gx - fx, gz - fz) < d + len * 0.45) continue; // it must really gain distance
    if (!runFree(x, z, mx, mz, len, r, world)) continue;
    let cost = Math.abs(deg) * 0.02 + Math.abs(wrapPi(a - facing)) * 0.35;
    if (home) {
      const far = (px: number, pz: number): number => Math.max(0, Math.hypot(px - home.x, pz - home.z) - LEASH);
      cost += LEASH_PULL * (far(gx, gz) ** 2 - far(x, z) ** 2);
    }
    if (cost < best) { best = cost; out.x = gx; out.z = gz; }
  }
  return best < Infinity;
}
const AWAY_ANGLES = [0, 20, -20, 40, -40, 60, -60, 80, -80];
/** Beyond this far (m) from its loop a chased animal's way off bends back round its home… */
const LEASH = 8;
/** …the more the further out (cost per m² further out). */
const LEASH_PULL = 0.03;

/* ------------------------------------------------------------------ one step -- */

/** How close (m) to its loop point it has to be to roam on (else it walks back first). */
const ON_LOOP = 0.15;
/** Roaming, it falls this far (m) behind its loop point (blocked) and walks back instead. */
const OFF_LOOP = 1.4;
/** How quickly it catches up with its loop point (1/s). */
const LOOP_GAIN = 3;
/** Walking back, it turns toward where it goes and only moves once it faces within this
 *  (rad); making way, within this wider one (it sets off while it turns). */
const MOVE_ALIGN = 1.2;
const MOVE_ALIGN_QUICK = 1.75;
/** Its calm acceleration and braking (m/s²), and its quick ones when it makes way. */
const ACCEL = 1.6, ACCEL_QUICK = 5, BRAKE = 3, BRAKE_QUICK = 6;
/** Watching, it turns its body to what it watches only when that is this far (rad) off its
 *  facing (the head does the rest), and it faces within this before it stops turning. */
const WATCH_TURN = 0.9, WATCH_SETTLE = 0.2;
/** Grazing near a boy who stands still, its loop never brings it nearer than its flight
 *  distance plus this (m). */
const KEEP_ROOM = 1.2;
/** It walks back to its loop a little brisker than it roams (× its walk). */
const RETURN_PACE = 1.2;
/** A plan is looked at again this often (s) while the threat is on. */
const REPLAN = 0.25;
/** Its side of the jeep's line changes only once it stands this far (m) on the other side
 *  (the jeep's line swung right past it: wholly beside the other half of the bonnet)… */
const SIDE_SWAP = JEEP_HALF;
/** …and it could not get across to its side (at its top speed) within this share of the time
 *  the jeep takes to come level with it. */
const SIDE_SWAP_TIME = 0.5;
/** Having made way for a jeep it watches it, and makes way again only once that jeep has come
 *  this much (m) closer by its own motion since it settled (and its path reaches it). */
const REYIELD_CLOSE = 1.5;

/** Its goal is still good while the jeep comes: on its side of the jeep's current line, and
 *  (unless it bears away: no spot is clear) off the ground the jeep will cover. */
function goalHolds(s: WildState, r: number, j: JeepRead): boolean {
  if (s.bear) { lineOf(j, s.gx, s.gz); return lnLat * s.side > 0; }
  return clearOfPath(poses(j), j, s.gx, s.gz, r, YIELD_MARGIN + JEEP_CLEAR, s.side);
}

/**
 * One frame of one animal: read the jeep and the ranger, pick the mode, steer and move.
 * `r` = its footprint radius (half its length). Mutates and returns `s`. Pure apart from the
 * callbacks in `world` (deterministic for the same inputs).
 */
export function wildStep(s: WildState, tm: Temperament, r: number, th: Threats, world: WildWorld, dt: number): WildState {
  if (!(dt > 0)) return s;
  s.inMode += dt;
  s.replan -= dt;
  const J = readJeep(s.x, s.z, r, th.jeep);
  const jLat = J.lat, jTti = J.tti;
  const wary = s.mode === 'alert' || s.mode === 'away' || s.mode === 'yield';
  const R = readRanger(s.x, s.z, tm, th.ranger, wary, s.mode === 'away' && s.threat === 'ranger');

  // ---- the jeep it knows ----
  // it made way for this jeep, settled and watches it: it moves again only when the jeep really
  // comes, its path reaching it AND the jeep itself having come `REYIELD_CLOSE` closer. Until
  // then its path is only worth watching (standing) or ignoring (grazing, walking back): a jeep
  // revving against a rock with the keys held never sends it off again and again
  const jt = th.jeep;
  if (!jt) { s.madeWay = false; s.closed = 0; s.jx = s.jz = Number.NaN; }
  else {
    // where the jeep really went this frame, toward the animal
    if (!Number.isNaN(s.jx)) {
      const dx = s.x - jt.x, dz = s.z - jt.z, d = Math.hypot(dx, dz) || 1;
      s.closed = Math.max(0, s.closed + ((jt.x - s.jx) * dx + (jt.z - s.jz) * dz) / d);
    }
    s.jx = jt.x; s.jz = jt.z;
  }
  let jKind = J.kind;
  if (s.madeWay && s.closed < REYIELD_CLOSE && s.mode !== 'yield' && (jKind === 'path' || jKind === 'watch')) {
    jKind = s.mode === 'alert' ? 'watch' : 'none';
  }

  // ---- decide ----
  if (jKind === 'path' && th.jeep) {
    const j = th.jeep;
    s.threat = 'jeep';
    s.quiet = 0;
    s.lookX = j.x; s.lookZ = j.z;
    // its side of the jeep's CURRENT line, chosen once for the encounter: the side it is
    // already on; near the middle, away from the jeep's turn, else the side it faces. Kept
    // however the driver steers (a pursuing driver's path wraps round it, and its side of
    // that curve points back across the nose). When the jeep's line swings right past it, it
    // carries on to its side if it is across long before the jeep is there (a driver's aim
    // wobbles by metres far out, and a zig back would be worse); only if the jeep would be on
    // it first is its side where it now stands, never a dash across the nose
    if (s.side === 0) s.side = yieldSide(jLat, j, s.facing);
    else if (jLat * s.side < -SIDE_SWAP) {
      const ahead = Math.abs((s.x - j.x) * Math.sin(j.heading) + (s.z - j.z) * Math.cos(j.heading));
      const across = (jeepCorridor(r) + JEEP_CLEAR - jLat * s.side) / tm.top;
      if (across > SIDE_SWAP_TIME * (ahead / Math.max(1, Math.abs(j.speed)))) s.side = -s.side;
    }
    if (s.mode !== 'yield' || s.replan <= 0 || !goalHolds(s, r, j)) {
      s.replan = REPLAN;
      if (planYield(s.x, s.z, s.facing, r, j, s.side, world, out2)) { setMode(s, 'yield'); s.bear = false; s.gx = out2.x; s.gz = out2.z; }
      else if (bearAway(s.x, s.z, s.facing, r, j, s.side, world, out2)) { setMode(s, 'yield'); s.bear = true; s.gx = out2.x; s.gz = out2.z; }
      else setMode(s, 'alert');                    // nowhere to go: it stands, the jeep brakes
      s.madeWay = true;
    }
    if (s.mode === 'yield') {
      // fast enough to be clear of the corridor well before the jeep's ground reaches it; bearing
      // away from a jeep that steers at it, at its top speed
      const need = Math.max(0, jeepCorridor(r) + JEEP_CLEAR - jLat * s.side);
      const urgent = (need / Math.max(0.5, jTti - 0.4)) * 1.6;
      s.pace = s.bear ? tm.top : clamp(Math.max(urgent, Math.abs(j.speed) > 4.2 && tm.bounds ? (tm.trot + tm.top) / 2 : tm.trot), tm.trot, tm.top);
    }
  } else if (jKind === 'near' && th.jeep) {
    s.threat = 'jeep';
    s.quiet = 0;
    s.lookX = th.jeep.x; s.lookZ = th.jeep.z;
    if (s.mode !== 'away' || s.replan <= 0) {
      s.replan = REPLAN * 3;
      if (planAway(s.x, s.z, s.facing, r, th.jeep.x, th.jeep.z, JEEP_REACH + JEEP_NEAR + 1.5, world, out2)) {
        setMode(s, 'away'); s.gx = out2.x; s.gz = out2.z; s.pace = tm.step;
      } else setMode(s, 'alert');
    }
  } else if (R.flee && th.ranger) {
    const rg = th.ranger;
    s.threat = 'ranger';
    s.quiet = 0;
    s.lookX = rg.x; s.lookZ = rg.z;
    const runs = rg.running && R.closing > 1;
    const far = runs ? tm.runFlight + 3 : tm.flight + 2.2;
    const goalLeft = Math.hypot(s.gx - s.x, s.gz - s.z);
    // while he keeps coming the goal is kept ahead of it, so it walks on instead of stopping
    if (s.mode !== 'away' || s.replan <= 0 || goalLeft < 1.5) {
      s.replan = REPLAN;
      if (planAway(s.x, s.z, s.facing, r, rg.x, rg.z, far, world, out2, world.loop(s.loopT))) {
        if (s.mode !== 'away') setMode(s, 'away');
        s.gx = out2.x; s.gz = out2.z;
      } else if (s.mode !== 'away') setMode(s, 'alert');
    }
    // keep its distance: at his own pace when he follows it (a walker's 2.2 m/s is its
    // trot), quicker the closer he is, a calm step when he stands
    // (a calm walker never makes it bound: a quick trot at most; a runner or the jeep may)
    const flight = runs ? tm.runFlight : tm.flight;
    s.pace = clamp(R.closing + (flight - R.d) * 1.5 + 0.3, tm.step, runs ? tm.top : tm.trot + 0.3);
  } else if (s.mode === 'yield' || s.mode === 'away') {
    // the threat has passed or eased: finish the move, then stand and watch
    if (th.jeep && jKind !== 'none') { s.quiet = 0; s.lookX = th.jeep.x; s.lookZ = th.jeep.z; }
    else if (R.look && th.ranger) { s.quiet = 0; s.lookX = th.ranger.x; s.lookZ = th.ranger.z; }
    if (Math.hypot(s.gx - s.x, s.gz - s.z) < 0.25) setMode(s, 'alert');
  } else if ((jKind === 'watch' || jKind === 'near') && th.jeep) {
    s.threat = 'jeep';
    s.quiet = 0;
    s.lookX = th.jeep.x; s.lookZ = th.jeep.z;
    if (s.mode !== 'alert') setMode(s, 'alert');
  } else if (R.look && th.ranger) {
    s.threat = 'ranger';
    s.quiet = 0;
    s.lookX = th.ranger.x; s.lookZ = th.ranger.z;
    if (s.mode !== 'alert') setMode(s, 'alert');
  } else {
    s.quiet += dt;
    if (s.mode === 'alert' && s.quiet >= tm.watch) {
      s.threat = null;
      const L = world.loop(s.loopT);
      // back on its loop, or its way back leads up to a boy standing there: it grazes where
      // it is (roam waits for him to go, see the move), else it walks back
      const nearHim = th.ranger !== null && Math.hypot(L.x - th.ranger.x, L.z - th.ranger.z) < tm.flight + KEEP_ROOM;
      if (Math.hypot(L.x - s.x, L.z - s.z) < ON_LOOP || nearHim) setMode(s, 'roam');
      else { setMode(s, 'return'); s.gx = L.x; s.gz = L.z; s.stuck = 0; }
    }
  }

  // it settles to watch: from here the jeep must really come at it before it moves again
  if (s.mode === 'alert' && s.inMode === 0) s.closed = 0;

  // ---- move ----
  const x0 = s.x, z0 = s.z, f0 = s.facing;
  switch (s.mode) {
    case 'roam': {
      const L = world.loop(s.loopT);
      const L2 = world.loop(s.loopT + dt);
      // a boy standing near its loop: it grazes where it is rather than walk its loop up to
      // him (its clock waits), and roams on once he has gone
      const rg = th.ranger;
      if (rg) {
        const next = Math.hypot(L2.x - rg.x, L2.z - rg.z);
        if (next < tm.flight + KEEP_ROOM && next <= Math.hypot(L.x - rg.x, L.z - rg.z) + 1e-9) {
          s.speed = approach(s.speed, 0, BRAKE, BRAKE, dt);
          if (s.speed > 0.01) stepAlong(s, world, dt);
          break;
        }
      }
      const ex = L.x - s.x, ez = L.z - s.z;
      const lag = Math.hypot(ex, ez);
      if (lag > OFF_LOOP) { setMode(s, 'return'); s.gx = L.x; s.gz = L.z; s.stuck = 0; break; }
      s.loopT += dt;
      // feed-forward the loop's own motion, and close the gap to it; at a grazing stop it
      // stands where it stopped (a few cm off the loop point is never worth a sideways step)
      const lx = (L2.x - L.x) / dt, lz = (L2.z - L.z) / dt;
      const still = Math.hypot(lx, lz) < 0.02 && lag < 0.3;
      const vx = still ? 0 : lx + ex * LOOP_GAIN, vz = still ? 0 : lz + ez * LOOP_GAIN;
      const v = Math.hypot(vx, vz);
      const want = v > 0.06 ? Math.atan2(vx, vz) : L2.facing;
      turnToward(s, want, tm.turn, dt);
      const align = Math.max(0, Math.cos(wrapPi(want - s.facing)));
      s.speed = approach(s.speed, Math.min(v, tm.walk * 1.4) * align * align, ACCEL * 2, BRAKE, dt);
      stepAlong(s, world, dt);
      break;
    }
    case 'alert': {
      s.speed = approach(s.speed, 0, BRAKE, BRAKE, dt);
      if (s.speed > 0.01) stepAlong(s, world, dt);
      const want = Math.atan2(s.lookX - s.x, s.lookZ - s.z);
      // the body turns to what it watches only when that is well off to its side, calmly,
      // and then all the way round (never a restless follow of every step)
      if (Math.abs(wrapPi(want - s.facing)) > WATCH_TURN) s.watchTurn = true;
      if (s.watchTurn) {
        turnToward(s, want, tm.turn * 0.8, dt);
        if (Math.abs(wrapPi(want - s.facing)) < WATCH_SETTLE) s.watchTurn = false;
      }
      break;
    }
    case 'away':
    case 'yield':
    case 'return': {
      const quick = s.mode !== 'return';
      // walking back, it goes round a boy (or a jeep) standing on its way at a respectful
      // distance, never straight up to him (and off again, and back, and off again)
      let tgx = s.gx, tgz = s.gz;
      if (!quick) {
        if (th.ranger && viaRound(s.x, s.z, s.gx, s.gz, th.ranger.x, th.ranger.z, tm.flight + KEEP_ROOM, via)) { tgx = via.x; tgz = via.z; }
        else if (th.jeep && Math.abs(th.jeep.speed) < 0.3 && viaRound(s.x, s.z, s.gx, s.gz, th.jeep.x, th.jeep.z, JEEP_REACH + JEEP_NEAR + r + 0.3, via)) { tgx = via.x; tgz = via.z; }
      }
      const dx = tgx - s.x, dz = tgz - s.z;
      const dist = Math.hypot(dx, dz);
      const pace = s.mode === 'return' ? tm.walk * RETURN_PACE : s.pace;
      if (tgx === s.gx && tgz === s.gz && dist < (s.mode === 'return' ? ON_LOOP : 0.05)) {
        s.speed = approach(s.speed, 0, BRAKE_QUICK, BRAKE_QUICK, dt);
        if (s.speed > 0.01) stepAlong(s, world, dt);
        if (s.mode === 'return') {
          // back on its loop: face along it and roam on
          const L = world.loop(s.loopT);
          turnToward(s, L.facing, tm.turn, dt);
          if (Math.abs(wrapPi(L.facing - s.facing)) < 0.3) setMode(s, 'roam');
        }
        break;
      }
      const want = Math.atan2(dx, dz);
      turnToward(s, want, quick ? tm.turnQuick : tm.turn, dt);
      const err = Math.abs(wrapPi(want - s.facing));
      // making way it turns on the spot until it faces away from what it leaves: never a step
      // toward the jeep or the ranger, even mid-turn
      const tx = s.lookX - s.x, tz = s.lookZ - s.z, tl = Math.hypot(tx, tz);
      const toward = quick && tl > 1e-6 ? (Math.sin(s.facing) * tx + Math.cos(s.facing) * tz) / tl : -1;
      // making way it sets off while it turns (a curving start, never toward what it leaves);
      // walking back it faces its way first
      const align = toward > 0.1 ? 0 : quick ? (err > MOVE_ALIGN_QUICK ? 0 : Math.max(0.4, Math.cos(err))) : err > MOVE_ALIGN ? 0 : Math.cos(err);
      // arrive: never overshoot the spot, ease into it
      const arrive = Math.sqrt(2 * (quick ? BRAKE_QUICK : BRAKE) * 0.6 * dist);
      s.speed = approach(s.speed, Math.min(pace, arrive) * align, quick ? ACCEL_QUICK : ACCEL, quick ? BRAKE_QUICK : BRAKE, dt);
      stepAlong(s, world, dt);
      if (s.mode === 'return') {
        // no way back (a jeep parked on the loop): make for the next waypoint instead
        const prog = (Math.hypot(tgx - x0, tgz - z0) - Math.hypot(tgx - s.x, tgz - s.z)) / dt;
        s.stuck = prog < 0.05 && align > 0.5 ? s.stuck + dt : 0;
        if (s.stuck > 2.5) {
          s.loopT = (Math.floor(s.loopT / world.loopLeg) + 1) * world.loopLeg;
          const L = world.loop(s.loopT);
          s.gx = L.x; s.gz = L.z; s.stuck = 0;
        }
      }
      break;
    }
  }
  s.moved = Math.hypot(s.x - x0, s.z - z0) / dt;
  s.turning = wrapPi(s.facing - f0) / dt;
  s.gait = gaitOf(s.moved, tm);
  return s;
}

const via = { x: 0, z: 0 };
/**
 * Whether the straight walk from (x, z) to (gx, gz) passes within `R` of (cx, cz) (someone
 * standing on the way); if so, `out` gets a spot on the far side of him along the walk's
 * side, `R` + a little out, to walk to first. Pure.
 */
export function viaRound(x: number, z: number, gx: number, gz: number, cx: number, cz: number, R: number, out: { x: number; z: number }): boolean {
  const dx = gx - x, dz = gz - z, L2 = dx * dx + dz * dz;
  if (L2 < 1e-6) return false;
  const t = ((cx - x) * dx + (cz - z) * dz) / L2;
  if (t <= 0 || t >= 1) return false;               // he is not between it and where it goes
  const px = x + dx * t, pz = z + dz * t;
  let nx = px - cx, nz = pz - cz;
  if (nx * nx + nz * nz >= R * R) return false;     // it passes him far enough off
  let nl = Math.hypot(nx, nz);
  if (nl < 1e-3) { nx = -dz; nz = dx; nl = Math.hypot(nx, nz); } // dead on: either side
  // the spot beside him, level with him along the walk, out on its side
  out.x = cx + (nx / nl) * (R + 0.4);
  out.z = cz + (nz / nl) * (R + 0.4);
  return true;
}

/** Which legs it moves at this speed. */
export function gaitOf(v: number, tm: Temperament): WildGait {
  if (v < 0.05) return 'still';
  if (tm.bounds && v >= tm.trot + 0.45) return 'bound';
  if (v >= Math.max(tm.step + 0.25, tm.trot * 0.7)) return 'trot';
  return 'walk';
}

/** Which side of the jeep's path to make way to (+1 = the jeep's left): the side it is on,
 *  unless it stands near the middle — then away from the jeep's turn, else the side it faces
 *  (no half turn to reach the other side of a line it barely stands on). */
function yieldSide(lat: number, j: JeepRead, facing: number): number {
  if (Math.abs(lat) > 0.6) return Math.sign(lat);
  if (j.yawRate > 0.08) return -1;
  if (j.yawRate < -0.08) return 1;
  const across = Math.sin(facing) * Math.cos(j.heading) - Math.cos(facing) * Math.sin(j.heading); // its facing, to the jeep's left
  if (Math.abs(across) > 0.3) return Math.sign(across);
  return lat >= 0 ? 1 : -1;
}

function setMode(s: WildState, m: WildMode): void {
  if (s.mode === m) return;
  s.mode = m;
  s.inMode = 0;
  // the encounter is over once it roams (or walks back to its loop): a jeep coming again is a
  // new one, its side chosen afresh
  if (m === 'roam' || m === 'return') { s.side = 0; s.bear = false; }
  if (m === 'roam') s.threat = null;
  s.watchTurn = false;
}

/** Turn the body toward `want` at no more than `rate` rad/s. */
function turnToward(s: WildState, want: number, rate: number, dt: number): void {
  const e = wrapPi(want - s.facing);
  const step = rate * dt;
  s.facing = wrapPi(s.facing + (Math.abs(e) <= step ? e : Math.sign(e) * step));
}

/** Move along its facing at its speed, slid round whatever it meets. */
function stepAlong(s: WildState, world: WildWorld, dt: number): void {
  if (s.speed <= 0) return;
  const tx = s.x + Math.sin(s.facing) * s.speed * dt, tz = s.z + Math.cos(s.facing) * s.speed * dt;
  world.move(s.x, s.z, tx, tz, out2);
  s.x = out2.x; s.z = out2.z;
}

/** Move `v` toward `to` by at most `up` (speeding up) or `down` (slowing) per second. */
function approach(v: number, to: number, up: number, down: number, dt: number): number {
  return to > v ? Math.min(to, v + up * dt) : Math.max(to, v - down * dt);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Wrap an angle to (−π, π]. */
export function wrapPi(a: number): number {
  const t = Math.PI * 2;
  const r = ((a % t) + t) % t;
  return r > Math.PI ? r - t : r;
}

/* ------------------------------------------------------------- how it moves -- */

/**
 * The whole-body lift and pitch a stride adds (the legs themselves are the clip's, or none
 * on a static model): `cycle` = strides taken (it grows with the ground covered), `v` = its
 * speed. A ree's bound is a low arc (≤ 0.34 m) that lands on its hooves (lift 0) for the
 * last part of every cycle, nose up rising and down falling, level where it leaves and meets
 * the ground (so no hoof ever dips into it); a static
 * model's walk and trot are a small bob (≤ 2 cm) and rock; a squirrel hops. All small and
 * calm (never a jolt); `lift` ≥ 0 always, so nothing sinks into the ground.
 */
export function strideBody(kind: 'bound' | 'trot' | 'walk' | 'hop' | 'still', cycle: number, v: number): { lift: number; pitch: number } {
  const u = cycle - Math.floor(cycle);
  switch (kind) {
    case 'bound': {
      const air = 0.72;
      if (u >= air) return { lift: 0, pitch: 0 };
      const w = u / air;
      const H = clamp(0.12 + (v - 2.8) * 0.12, 0.12, 0.34);
      // nose up rising, down falling, level on the ground: the hooves never dip below it
      return { lift: H * Math.sin(Math.PI * w), pitch: 0.09 * Math.sin(2 * Math.PI * w) };
    }
    case 'hop': {
      const air = 0.6;
      if (u >= air) return { lift: 0, pitch: 0 };
      const w = u / air;
      const H = clamp(0.03 + v * 0.02, 0.03, 0.08);
      return { lift: H * Math.sin(Math.PI * w), pitch: 0.12 * Math.sin(2 * Math.PI * w) };
    }
    case 'trot': {
      const a = 0.012 + Math.min(0.008, v * 0.003);
      return { lift: a * (0.5 - 0.5 * Math.cos(4 * Math.PI * u)), pitch: 0.025 * Math.sin(2 * Math.PI * u) };
    }
    case 'walk':
      return { lift: 0.006 * (0.5 - 0.5 * Math.cos(4 * Math.PI * u)), pitch: 0.012 * Math.sin(2 * Math.PI * u) };
    default:
      return { lift: 0, pitch: 0 };
  }
}

/** How far (m) one stride carries each gait (the cycle above advances by distance / this). */
export function strideLength(kind: 'bound' | 'trot' | 'walk' | 'hop' | 'still', v: number): number {
  switch (kind) {
    case 'bound': return 1.5 + Math.max(0, v - 3) * 0.25;
    case 'hop': return 0.3 + v * 0.1;
    case 'trot': return 1.1;
    case 'walk': return 0.9;
    default: return 1;
  }
}
