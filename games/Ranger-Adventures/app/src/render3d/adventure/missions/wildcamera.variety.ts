/**
 * wildcamera.variety.ts — what changes from one play of "De wildcamera" to the next (run 7,
 * design `state/wildcamera/design.md` §4, §6.1). Pure: no THREE, no DOM, unit-tested
 * (`wildcamera.variety.test.ts`).
 *
 * The crossing stays the familiar stage (the pine, the open glade left, the thicket with
 * the sett right); who comes and how changes every play, all drawn from the play's seed
 * (`k.play`, one fork per decision), so a play can be replayed (`?dev=1&seed=N`):
 *
 * - the evening's visitors: WHICH animals come is the pure wissel core's (it draws them from
 *   the content's pools with the play's `wisselen` fork); here only HOW each one comes: from
 *   the left or the right, and at which of its side's two stops it waits while he decides.
 *   The side is drawn on its own, never from the place the animal must go to (construct-
 *   neutral: where it comes from never tells him where it goes; pinned over 1000 seeds);
 * - the night choir: the badger and three of the roe, the boar, the nightjar and the fox
 *   (the cast is the pure simon core's, `simonCast`, the same for the 2D floor), each in one
 *   of its allowed spots round the crossing (`CALLER_SLOTS`), in a drawn order;
 * - the camera's clock on the photos: a seeded start in the evening, running on;
 * - (wc-hands) where the man set his snare: one of three spots, each with its own two
 *   landmarks (`SNARE_SPOTS`), never the spot of the play before.
 *
 * None of it changes how hard a breinkracht is (decision 1): the level's knobs alone say how
 * many photos, when the rule turns and how long the echo is; every stop and every spot is
 * equally in view, apart and off the middle of the picture (the places test pins them).
 */

import type { Play } from '../../../core/play.ts';
import type { MoodRule } from '../../Moods.ts';
import {
  CALLER_SLOTS, SLOT_CLASH, SLOT_IDS, SNARE_IDS, STOPS_OF, type Side, type SlotId, type SnareId, type StopId,
} from './wildcamera.places.ts';

/** How one visitor of the aim round comes onto the crossing. */
export interface Arrival { side: Side; stop: StopId }

/** One night caller: who, where, and how long after the night falls it walks in (s). */
export interface NightCaller { id: string; slot: SlotId; delay: number }

/** One play of the wildcamera: everything its seed decides. */
export interface WildcameraPlay {
  seed: number;
  /** per aim visitor, in queue order */
  arrivals: Arrival[];
  /** the night choir, in the order they come */
  callers: NightCaller[];
  /** the camera's clock on the first photo (minutes after midnight) */
  clockStart: number;
  /** where the man set his snare (wc-hands; always drawn by `drawWildcameraPlay`) */
  snare?: SnareId;
  /** wc-album: the morning after the night: misty, or clear (always drawn) */
  dawn?: Dawn;
  /** wc-album: whose nose the camera caught at its lens in the night, on its own (the
   *  funny close-up in the morning's photos), or null (always drawn) */
  neus?: NeusId | null;
}

/* ------------------------------------------------- wc-album: the light, the nose ---- */

/** The morning after the night (wc-album): the wood in the dawn mist, a clear bright
 *  morning, or a golden sunrise (render3d/Moods ids: the light the photos, the search and
 *  the reunion stand in). */
export type Dawn = 'ochtendnevel' | 'zonnig' | 'gouden-uur';
export const DAWNS: readonly Dawn[] = ['ochtendnevel', 'zonnig', 'gouden-uur'];
const DAWN_CODE: Readonly<Record<Dawn, string>> = { ochtendnevel: 'n', zonnig: 'z', 'gouden-uur': 'g' };

/** The evening's light at the crossing (the Adventure's `moods.allow`, one per play, never
 *  the last play's): the golden hour, an overcast evening, a misty one. Never the dusk or
 *  the bright day: by day the aim round's day must read as day, and the night is the
 *  wildcamera's own readable blue in every one of them. */
export const EVENINGS = ['gouden-uur', 'bewolkt', 'ochtendnevel'] as const;
/** The home's light rule (Adventure.moods): one of the `EVENINGS`, a new one each play. */
export const WILDCAMERA_MOODS: MoodRule = { allow: EVENINGS, perPlay: true };

/** Who may sniff at the camera in the night (wc-album): an animal of the crossing, its nose
 *  right at the lens. Each one is a different joke in the morning's photos ("Wie is dat?"). */
export type NeusId = 'wildzwijn' | 'das' | 'vos' | 'ree';
export const NEUS_IDS: readonly NeusId[] = ['wildzwijn', 'das', 'vos', 'ree'];
/** The chance of a nose at the lens on a play. */
export const NEUS_P = 0.35;
/** Plays in a row without one after which the next surely has one. */
export const NEUS_PITY = 2;
const NEUS_CODE: Readonly<Record<NeusId, string>> = { wildzwijn: 'w', das: 'd', vos: 'v', ree: 'r' };

/** Draw the night's close-up: a seeded chance, sure after `NEUS_PITY` plays without one
 *  (`drought`: plays in a row without one, `neusDrought`). Both draws are always made, so
 *  the stream never moves. Construct-neutral: it is a photo in the morning, nothing more. */
export function drawNeus(play: Play, drought = 0): NeusId | null {
  const f = play.fork('wc-neus');
  const lucky = f.chance(NEUS_P);
  const who = f.pick(NEUS_IDS);
  return lucky || drought >= NEUS_PITY ? who : null;
}

/** How many of the wildcamera's last plays in a row had no close-up (their `wx` note `0`),
 *  newest first, from the save's beat history; a play whose note is missing (before this
 *  package, or cut off) ends the count. */
export function neusDrought(history: readonly { m: string; sd: number; va?: string }[], missionId = 'wildcamera'): number {
  let n = 0;
  let seed: number | null = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const b = history[i];
    if (b.m !== missionId || !b.va) continue;
    if (b.sd === seed) continue; // (one play logs two beats)
    seed = b.sd;
    const wx = b.va.split(',').map((kv) => kv.split(':')).find(([k]) => k === 'wx')?.[1];
    if (wx !== '0') break;
    n++;
  }
  return n;
}

/** The dawn after the night, from its own fork: never the light the evening stood in
 *  (`evening`: the night comes between, the morning looks new), never the last play's
 *  morning (`last`, its `wd` note) while another is left. */
export function drawDawn(play: Play, opts: { evening?: string | null; last?: Dawn | null } = {}): Dawn {
  const f = play.fork('wc-dawn');
  const fresh = DAWNS.filter((d) => d !== opts.evening && d !== opts.last);
  const fallback = DAWNS.filter((d) => d !== opts.last);
  return f.pick(fresh.length ? fresh : fallback.length ? fallback : DAWNS);
}

/** The morning of the wildcamera's last play that noted one (its `wd` note), or null. */
export function lastDawn(history: readonly { m: string; va?: string }[], missionId = 'wildcamera'): Dawn | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const b = history[i];
    if (b.m !== missionId || !b.va) continue;
    const wd = b.va.split(',').map((kv) => kv.split(':')).find(([k]) => k === 'wd')?.[1];
    const d = wd ? DAWNS.find((x) => DAWN_CODE[x] === wd) : undefined;
    if (d) return d;
  }
  return null;
}

const ANIMAL_CODE: Readonly<Record<string, string>> = {
  edelhert: 'e', hinde: 'h', ree: 'r', gaai: 'g', das: 'd', nachtzwaluw: 'n', wildzwijn: 'w', vos: 'v',
};
const STOP_CODE: Readonly<Record<StopId, string>> = { l: 'a', lf: 'b', r: 'c', rf: 'd' };
const SLOT_CODE: Readonly<Record<SlotId, string>> = {
  'sett-l': 'a', 'sett-r': 'b', log: 'c', stump: 'd', 'glade-edge': 'e', 'glade-front': 'f', bushes: 'g', juniper: 'h',
};

/** Draw the way each of `queueLength` visitors comes: its side (half from each, in a
 *  shuffled order: never from where it must go, and never all from one side) and one of
 *  that side's stops (never the very stop the visitor before stood at: two in a row at one
 *  spot look like one animal waiting). */
export function drawArrivals(play: Play, queueLength: number): Arrival[] {
  const f = play.fork('wc-arrive');
  const half = Math.floor(queueLength / 2);
  const odd: Side = f.chance(0.5) ? 'left' : 'right';
  const sides = f.shuffle<Side>([...Array<Side>(half).fill('left'), ...Array<Side>(half).fill('right'), ...(queueLength % 2 ? [odd] : [])]);
  const out: Arrival[] = [];
  for (let i = 0; i < queueLength; i++) {
    const side = sides[i];
    const stops = STOPS_OF[side].filter((s) => s !== out[i - 1]?.stop);
    out.push({ side, stop: f.pick(stops) });
  }
  return out;
}

/** Every way the night's callers can stand: each in a spot that allows it, never two in
 *  one spot, never two spots of a clashing pair (too near on the screen). */
export function legalLayouts(cast: readonly string[]): Record<string, SlotId>[] {
  const clash = (a: SlotId, b: SlotId): boolean => SLOT_CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const out: Record<string, SlotId>[] = [];
  const walk = (i: number, used: SlotId[], acc: Record<string, SlotId>): void => {
    if (i === cast.length) { out.push({ ...acc }); return; }
    const id = cast[i];
    for (const s of SLOT_IDS) {
      if (!CALLER_SLOTS[s].animals.includes(id) || used.includes(s) || used.some((u) => clash(u, s))) continue;
      acc[id] = s;
      walk(i + 1, [...used, s], acc);
      delete acc[id];
    }
  };
  walk(0, [], {});
  return out;
}

/** A night's layout as one comparable line: `das@sett-l,ree@glade-edge,…` (sorted). */
export function nightKey(n: readonly { id: string; slot: SlotId }[] | Record<string, SlotId>): string {
  const pairs = Array.isArray(n) ? n.map((c) => `${c.id}@${c.slot}`) : Object.entries(n).map(([id, s]) => `${id}@${s}`);
  return pairs.sort().join(',');
}

/** A logged night (its `wn` note) read back as animal → spot (null when it is not ours). */
function nightOf(wn: string): Record<string, SlotId> | null {
  const v = parseVariant({ wa: 'a', wn });
  return v ? Object.fromEntries(v.night.map((x) => [x.animal, x.slot])) : null;
}

/** How many of a night's animals stand on the very spot they had in `before` (an animal
 *  that sat that night out, or no night before: none). */
export function sameSpots(layout: Readonly<Record<string, SlotId>>, before: Readonly<Record<string, SlotId>> | null): number {
  return before ? Object.keys(layout).filter((id) => before[id] === layout[id]).length : 0;
}

/** How many of a night's spots were taken in `before`, by any animal. */
function samePlaces(layout: Readonly<Record<string, SlotId>>, before: Readonly<Record<string, SlotId>> | null): number {
  if (!before) return 0;
  const used = new Set(Object.values(before));
  return Object.values(layout).filter((s) => used.has(s)).length;
}

/** Draw the night choir's layout and the order they walk in (a calm stagger, each 0.5-1.2 s
 *  after the one before). `cast` is the simon trial's animals; `recent` the last plays'
 *  nights (their `wn` notes, newest last). A night never stands as one of the last two did,
 *  and of the layouts left only those with the FEWEST animals on the spot they had last
 *  night are drawn from (then the fewest against the night before, then the fewest spots
 *  taken last night by any animal: the same four spots with the walkers shuffled looks
 *  like last night too): two nights in a row share at most one animal on its old spot (the
 *  badger by its sett, when the night has no room for it on the other side). Only
 *  `legalLayouts`, which the view test pins, so every night stays as readable. */
export function drawCallers(play: Play, cast: readonly string[], recent: readonly string[] = []): NightCaller[] {
  const f = play.fork('wc-night');
  const all = legalLayouts(cast);
  if (!all.length) throw new Error(`[wildcamera] no night layout for ${cast.join(', ')}`);
  const nights = recent.slice(-2).map(nightOf);
  const last = nights[nights.length - 1] ?? null, before = nights.length > 1 ? nights[0] : null;
  const seen = new Set(nights.map((n) => (n ? nightKey(n) : '')));
  let pool = all.filter((l) => !seen.has(nightKey(l)));
  if (!pool.length) pool = all;
  const fewest = (score: (l: Record<string, SlotId>) => number): void => {
    const least = Math.min(...pool.map(score));
    pool = pool.filter((l) => score(l) === least);
  };
  fewest((l) => sameSpots(l, last));
  fewest((l) => sameSpots(l, before));
  fewest((l) => samePlaces(l, last));
  const layout = f.pick(pool);
  const order = f.shuffle(cast);
  let t = 0;
  return order.map((id, i) => {
    if (i > 0) t += f.between(0.5, 1.2);
    return { id, slot: layout[id], delay: Math.round(t * 100) / 100 };
  });
}

/** Draw where the man set his snare: one of the three spots, never `last` (the spot of the
 *  play before, when the history still says it), from its own fork. Every spot is equally
 *  findable (the places test pins each: its landmarks in its photo and no other's, in view
 *  of the camera, off the middle of its close view), so the draw changes no difficulty. */
export function drawSnare(play: Play, last: SnareId | null = null): SnareId {
  const pool = SNARE_IDS.filter((id) => id !== last);
  return play.fork('wc-snare').pick(pool.length ? pool : SNARE_IDS);
}

/** Draw a play: `queueLength` visitors for the aim round, the night's `cast`; `recent`
 *  the last plays' night notes (`lastNights`); `lastSnare` the spot of the play before
 *  (`lastSnare`). */
export function drawWildcameraPlay(play: Play, opts: { queueLength: number; cast: readonly string[]; recent?: readonly string[]; lastSnare?: SnareId | null; neusDrought?: number; evening?: string | null; lastDawn?: Dawn | null }): WildcameraPlay & { snare: SnareId; dawn: Dawn; neus: NeusId | null } {
  return {
    seed: play.seed,
    arrivals: drawArrivals(play, opts.queueLength),
    callers: drawCallers(play, opts.cast, opts.recent ?? []),
    clockStart: Math.round(play.fork('wc-clock').between(17 * 60 + 20, 18 * 60 + 10)),
    snare: drawSnare(play, opts.lastSnare ?? null),
    dawn: drawDawn(play, { evening: opts.evening ?? null, last: opts.lastDawn ?? null }),
    neus: drawNeus(play, opts.neusDrought ?? 0),
  };
}

/** The compact variant the beat history keeps: five notes, each short enough that the
 *  history's 60 characters keep them beside the play's mood and rare (no ',' or ':'; noted
 *  in the order ws, wx, wn, wd, wa: what overflows the 60 falls off from the end).
 *  `ws`: the snare's spot (`1`, `2`, `3`: S1-S3), kept first (the next play reads it).
 *  `wx` (wc-album): the night's close-up, `0` for none, else its animal (`w` the boar, `d`
 *  the badger, `v` the fox, `r` the roe): the next plays read it (`neusDrought`).
 *  `wd` (wc-album): the morning (`n` misty, `z` clear, `g` a golden sunrise; `lastDawn`).
 *  `wa`: how the visitors came, one stop each (`a` l, `b` lf, `c` r, `d` rf; WHICH animals
 *  came is the wissel core's, rebuilt from the seed and the logged level); `wn`: the night,
 *  animal + spot in the order they came (`da` = the badger left of its sett). */
export function variantOf(p: WildcameraPlay): { ws: string; wx: string; wd: string; wa: string; wn: string } {
  return {
    ws: p.snare ? p.snare.slice(1) : '',
    wx: p.neus ? NEUS_CODE[p.neus] : '0',
    wd: p.dawn ? DAWN_CODE[p.dawn] : '',
    wa: p.arrivals.map((a) => STOP_CODE[a.stop]).join(''),
    wn: p.callers.map((c) => `${ANIMAL_CODE[c.id] ?? c.id[0]}${SLOT_CODE[c.slot]}`).join(''),
  };
}

/** What the logged notes say back (null when they are not ours). */
export function parseVariant(v: { wa?: string; wn?: string }): { stops: StopId[]; night: { animal: string; slot: SlotId }[] } | null {
  if (!v.wa || !v.wn || !/^[a-d]+$/.test(v.wa) || !/^(?:[a-z][a-h])+$/.test(v.wn)) return null;
  const stop = (c: string): StopId => (Object.keys(STOP_CODE) as StopId[]).find((k) => STOP_CODE[k] === c)!;
  const slot = (c: string): SlotId => (Object.keys(SLOT_CODE) as SlotId[]).find((k) => SLOT_CODE[k] === c)!;
  const animal = (c: string): string => Object.keys(ANIMAL_CODE).find((k) => ANIMAL_CODE[k] === c) ?? c;
  return {
    stops: [...v.wa].map(stop),
    night: (v.wn.match(/../g) ?? []).map((x) => ({ animal: animal(x[0]), slot: slot(x[1]) })),
  };
}

/**
 * The wildcamera's last nights, oldest first, from the save's beat history: each play logs
 * two beats (wisselen, simon) with the play's variant (`va`: 'mood:…,wn:…,wa:…'); one entry
 * per play, by its seed. A play stopped before its first beat left none.
 */
export function lastNights(history: readonly { m: string; sd: number; va?: string }[], missionId = 'wildcamera'): string[] {
  const out: { sd: number; wn: string }[] = [];
  for (const b of history) {
    if (b.m !== missionId || !b.va) continue;
    const wn = b.va.split(',').map((kv) => kv.split(':')).find(([k]) => k === 'wn')?.[1];
    if (!wn) continue;
    if (out.length && out[out.length - 1].sd === b.sd) continue;
    out.push({ sd: b.sd, wn });
  }
  return out.map((x) => x.wn);
}

/** The snare's spot of the wildcamera's last play that logged one (its `ws` note), or null. */
export function lastSnare(history: readonly { m: string; va?: string }[], missionId = 'wildcamera'): SnareId | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const b = history[i];
    if (b.m !== missionId || !b.va) continue;
    const ws = b.va.split(',').map((kv) => kv.split(':')).find(([k]) => k === 'ws')?.[1];
    const id = ws ? (`S${ws}` as SnareId) : null;
    if (id && SNARE_IDS.includes(id)) return id;
  }
  return null;
}

/* ------------------------------------------------------- the camera's clock ---- */

/** HH:MM of `minutes` after midnight (wrapping past midnight). */
export function hhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The camera's own clock, printed on every photo (one running clock, design pitfall 5):
 * it starts in the evening (the play's `clockStart`), runs on 7-25 minutes a photo (an
 * empty one too: the camera clicked), and jumps when the day turns: to late at night
 * (21:50-22:30, at least an hour on), or to first light (05:10-05:40) when it turns back.
 */
export class CameraClock {
  private now: number;
  private readonly rng: () => number;
  constructor(start: number, rng: () => number) {
    this.now = start;
    this.rng = rng;
  }
  /** a photo now: its time, and the clock runs on */
  photo(): string {
    const t = hhmm(this.now);
    this.now += 7 + Math.floor(this.rng() * 19);
    return t;
  }
  /** the day turned: to the night, or back to the day */
  turn(to: 'night' | 'day'): void {
    if (to === 'night') {
      const late = 21 * 60 + 50 + Math.floor(this.rng() * 41);
      this.now = Math.max(this.now + 60, late);
    } else {
      const day = 24 * 60 + 5 * 60 + 10 + Math.floor(this.rng() * 31);
      this.now = Math.max(this.now + 60, day);
    }
  }
  /** wc-album: the camera clicked on its own in the deep of the night, while everyone slept
   *  (00:40-03:30, at least half an hour on): its time */
  lateNight(): string {
    const deep = 24 * 60 + 40 + Math.floor(this.rng() * 171);
    this.now = Math.max(this.now + 30, deep);
    return this.photo();
  }
  /** wc-album: first light (05:15-05:40, at least ten minutes on): its time */
  firstLight(): string {
    const light = 24 * 60 + 5 * 60 + 15 + Math.floor(this.rng() * 26);
    this.now = Math.max(this.now + 10, light);
    return this.photo();
  }
  /** wc-album: the man at his snare at dawn (05:52, or a little later when the clock has
   *  passed it): its time, never before a photo taken earlier */
  dawnMan(): string {
    this.now = Math.max(this.now, 24 * 60 + 5 * 60 + 52);
    return this.photo();
  }
  /** minutes after the first midnight (tests) */
  get minutes(): number { return this.now; }
}
