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
 * - the camera's clock on the photos: a seeded start in the evening, running on.
 *
 * None of it changes how hard a breinkracht is (decision 1): the level's knobs alone say how
 * many photos, when the rule turns and how long the echo is; every stop and every spot is
 * equally in view, apart and off the middle of the picture (the places test pins them).
 */

import type { Play } from '../../../core/play.ts';
import {
  CALLER_SLOTS, SLOT_CLASH, SLOT_IDS, STOPS_OF, type Side, type SlotId, type StopId,
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

/** Draw the night choir's layout and the order they walk in (a calm stagger, each 0.5-1.2 s
 *  after the one before). `cast` is the simon trial's animals; `recent` the last plays'
 *  nights (their `wn` notes, newest last): a night never stands as one of the last two did. */
export function drawCallers(play: Play, cast: readonly string[], recent: readonly string[] = []): NightCaller[] {
  const f = play.fork('wc-night');
  const all = legalLayouts(cast);
  if (!all.length) throw new Error(`[wildcamera] no night layout for ${cast.join(', ')}`);
  const seen = new Set(recent.slice(-2).map((wn) => { const v = parseVariant({ wa: 'a', wn }); return v ? nightKey(v.night.map((x) => ({ id: x.animal, slot: x.slot }))) : ''; }));
  const fresh = all.filter((l) => !seen.has(nightKey(l)));
  const layout = f.pick(fresh.length ? fresh : all);
  const order = f.shuffle(cast);
  let t = 0;
  return order.map((id, i) => {
    if (i > 0) t += f.between(0.5, 1.2);
    return { id, slot: layout[id], delay: Math.round(t * 100) / 100 };
  });
}

/** Draw a play: `queueLength` visitors for the aim round, the night's `cast`; `recent`
 *  the last plays' night notes (`lastNights`). */
export function drawWildcameraPlay(play: Play, opts: { queueLength: number; cast: readonly string[]; recent?: readonly string[] }): WildcameraPlay {
  return {
    seed: play.seed,
    arrivals: drawArrivals(play, opts.queueLength),
    callers: drawCallers(play, opts.cast, opts.recent ?? []),
    clockStart: Math.round(play.fork('wc-clock').between(17 * 60 + 20, 18 * 60 + 10)),
  };
}

/** The compact variant the beat history keeps: two notes, each short enough that the
 *  history's 60 characters keep both beside the play's mood and rare (no ',' or ':').
 *  `wa`: how the visitors came, one stop each (`a` l, `b` lf, `c` r, `d` rf; WHICH animals
 *  came is the wissel core's, rebuilt from the seed and the logged level); `wn`: the night,
 *  animal + spot in the order they came (`da` = the badger left of its sett). */
export function variantOf(p: WildcameraPlay): { wa: string; wn: string } {
  return {
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
  /** minutes after the first midnight (tests) */
  get minutes(): number { return this.now; }
}
