/**
 * ree.variety.ts — what changes from one play of "Het reekalf in het gras" to the next
 * (run 7, design `state/ree/design.md` §4, §6.1). Pure: no THREE, no DOM, unit-tested
 * (`ree.variety.test.ts`).
 *
 * Every play is a different morning at the same story: the doe lays her calf in one of
 * THREE stands of tall grass round her copse (a layout: the stand, the side he searches it
 * from, her trodden path there, the hide he watches from), the calf lies in one of four
 * spots in it (never the middle of the picture), the doe grazes at one of two spots, the
 * wet pool lies on her path or on his way to the hide, and the three calm moments by the
 * calf come in a drawn order (a layout whose way to the hide has no room for the pool has
 * it on her path). All of it is drawn from the play's seed (`k.play`, one fork
 * per decision), so a play can be replayed (`?dev=1&seed=N`), and none of it changes how
 * hard a breinkracht is (decision 1: the stands are the same size, the lens the same
 * distance and angle, the spots equally readable; difficulty moves only with the level).
 *
 * Three plays in a row are three layouts: a layout never repeats one of the last two
 * plays' (read from the beat history), and so do the spot and the order of the calm
 * moments, so the picture and the moments are new each time too.
 */

import type { Play } from '../../../core/play.ts';
import type { RustKnobs, ZoekKnobs } from '../../../core/skill.ts';

export type ReeLayoutId = 'A' | 'B' | 'C';
export const REE_LAYOUT_IDS: readonly ReeLayoutId[] = ['A', 'B', 'C'];

/** The three calm moments by the calf (rustkracht encounters of the content). */
export type CalfMoment = 'aai' | 'geur' | 'oppakken';
export const CALF_MOMENTS: readonly CalfMoment[] = ['aai', 'geur', 'oppakken'];

/** How many spots the calf may lie in (the content's `doelen`). */
export const CALF_SPOTS = 4;

export interface ReePlay {
  layout: ReeLayoutId;
  /** index into the content's `doelen`: where the calf lies (the zoeken trial's target) */
  spot: number;
  /** which of the layout's two graze spots the doe is at */
  graze: 0 | 1;
  /** the pool lies on her path (`modder` is the first calm moment) or on his way to the
   *  hide (`modder` is the fourth) */
  pool: 'in' | 'out';
  /** the three calf moments, in play order */
  calf: readonly CalfMoment[];
  /** the five encounter ids in play order (`moeder`, the flip, always last) */
  order: readonly string[];
  /** compact, logged with every beat (`B21-in-gao`: layout, spot, graze, pool, calf order) */
  variant: string;
}

/** The five encounters in play order: the pool first (on her path) or fourth (on his way
 *  to the hide), the three at the calf in their drawn order, the flip last. */
export function reeOrder(pool: 'in' | 'out', calf: readonly CalfMoment[]): string[] {
  return pool === 'in' ? ['modder', ...calf, 'moeder'] : [...calf, 'modder', 'moeder'];
}

/** A play's compact variant: `B21-in-gao`. */
export function reeVariant(p: Omit<ReePlay, 'variant' | 'order'>): string {
  return `${p.layout}${p.spot}${p.graze}-${p.pool}-${p.calf.map((c) => c[0]).join('')}`;
}

/** What a logged variant says (null when it is not one of ours). */
export function parseReeVariant(v: string): Omit<ReePlay, 'variant' | 'order'> | null {
  const m = /^([ABC])(\d)([01])-(in|out)-([ago]{3})$/.exec(v);
  if (!m) return null;
  const calf = [...m[5]].map((c) => CALF_MOMENTS.find((x) => x[0] === c)!) as CalfMoment[];
  if (new Set(calf).size !== 3) return null;
  return { layout: m[1] as ReeLayoutId, spot: +m[2], graze: +m[3] as 0 | 1, pool: m[4] as 'in' | 'out', calf };
}

/** The history's key for this mission's variant (the play notes it as `ree`). */
export const VARIANT_KEY = 'ree';

/**
 * The ree's last variants, oldest first, from the save's beat history (each play logs
 * two beats, zoeken and dagnacht: one entry per play, by its seed). A play that was
 * stopped before its first beat left no entry (it never counts).
 */
export function lastReeVariants(history: readonly { m: string; sd: number; va?: string }[], missionId: string): string[] {
  const out: { sd: number; v: string }[] = [];
  for (const b of history) {
    if (b.m !== missionId || !b.va) continue;
    const pair = b.va.split(',').find((p) => p.startsWith(`${VARIANT_KEY}:`));
    if (!pair) continue;
    const v = pair.slice(VARIANT_KEY.length + 1);
    if (out.length && out[out.length - 1].sd === b.sd) continue; // (the same play's second beat)
    out.push({ sd: b.sd, v });
  }
  return out.map((o) => o.v);
}

/** A choice from `all`, leaving out what the last plays had (when anything is left). */
function fresh<T>(play: Pick<Play, 'pick'>, all: readonly T[], recent: readonly T[], same: (a: T, b: T) => boolean = (a, b) => a === b): T {
  const left = all.filter((x) => !recent.some((r) => same(r, x)));
  return play.pick(left.length ? left : all);
}

/**
 * This play's morning, drawn from its forks (one per decision, so a later draw never
 * reshuffles the others): the layout and the spot leave out the last two plays', the
 * calf order the last two plays' orders, the pool never three times the same in a row.
 * `spot`: the zoeken trial's target when the trial builder drew it (then it is used).
 */
export function drawReePlay(play: Pick<Play, 'fork'>, lastVariants: readonly string[] = [], spot?: number,
  poolSides: (layout: ReeLayoutId) => readonly ('in' | 'out')[] = () => ['in', 'out']): ReePlay {
  const last = lastVariants.map(parseReeVariant).filter((x): x is NonNullable<typeof x> => !!x).slice(-2);
  const layout = fresh(play.fork('ree-plek'), REE_LAYOUT_IDS, last.map((l) => l.layout));
  const spots = Array.from({ length: CALF_SPOTS }, (_, i) => i);
  const s = spot !== undefined && spot >= 0 && spot < CALF_SPOTS ? spot : fresh(play.fork('ree-kalf'), spots, last.map((l) => l.spot));
  const graze = play.fork('ree-graas').pick([0, 1] as const);
  const poolPlay = play.fork('ree-poel');
  const sides = poolSides(layout);
  const pool: 'in' | 'out' = sides.length < 2 ? sides[0] ?? 'in'
    : last.length === 2 && last[0].pool === last[1].pool ? (last[1].pool === 'in' ? 'out' : 'in')
      : poolPlay.pick(['in', 'out'] as const);
  const orders = permutations(CALF_MOMENTS);
  const calf = fresh(play.fork('ree-rust'), orders, last.map((l) => l.calf), (a, b) => a.join() === b.join());
  const p = { layout, spot: s, graze, pool, calf };
  return { ...p, order: reeOrder(pool, calf), variant: reeVariant(p) };
}

/** Every order of a list. */
function permutations<T>(list: readonly T[]): T[][] {
  if (list.length <= 1) return [[...list]];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/* -------------------------------------------------------- run 7: growth ---- */

/**
 * How the ree's world reads the level (decision 2, design §6.5): never a difficulty number
 * of its own, only the engines' knobs (`k.knobs('zoeken')`, `k.knobs('dagnacht')`, the same
 * ones the 2D floors read) mapped onto what happens here. The search's share of the calf
 * (`glimpse`), its look-alikes (`lookAlikes`), the first hint (`hintAfterS`) and the holds
 * (`holdS`, `tempts`, `goWaitS`) are the knobs themselves; these are the ree's own faces of
 * them:
 *
 *   her prints     `trailLegs` 2 → 5: the run of slots on her wissel breaks 0 → 3 times
 *                  (a gap of ~1.2 m); `trailClarity` 0.95 → 0.4: how dark they are
 *   oppakken       `tempts` 1 → 3: the calf's wobbly steps toward him
 *   the watch      `tempts` 1 → 3: how often the mother stops to listen; `holdS` 3 → 6:
 *                  how long (s) he must stand still after a step before she goes on, 2.2 → 3.5
 */
export interface ReeGrowth {
  /** gaps in the run of her prints on her wissel (0: one unbroken run) */
  gaps: number;
  /** how dark her prints are (0..1, the decal's opacity) */
  prints: number;
  /** the calf's wobbly steps toward him in `oppakken` (1..3) */
  wobble: number;
  /** the mother's listening pauses in the watch (1..3) */
  pauses: number;
  /** seconds he must stand still after a step in the watch before she goes on */
  stillS: number;
}

/** The ree's faces of the level's knobs (pure; ree.variety.test.ts pins level 1 and the top). */
export function reeGrowth(z: Pick<ZoekKnobs, 'trailLegs' | 'trailClarity'>, r: Pick<RustKnobs, 'holdS' | 'tempts'>): ReeGrowth {
  const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
  const tempts = clamp(Math.round(r.tempts), 1, 3);
  return {
    gaps: clamp(Math.round(z.trailLegs) - 2, 0, 3),
    prints: Math.round((0.4 + 0.6 * clamp(z.trailClarity, 0, 1)) * 100) / 100,
    wobble: tempts,
    pauses: tempts,
    stillS: Math.round(clamp(2.2 + ((r.holdS - 3) * 1.3) / 3, 2.2, 3.5) * 100) / 100,
  };
}

/** One run of her prints along a leg of her wissel: from `a` to `b` (shares 0..1 of it). */
export interface PrintRun { leg: number; a: number; b: number }

/** A gap in her prints is this long (m). */
export const PRINT_GAP_M = 1.2;

/**
 * Her prints along her wissel's legs (lengths `legs`, m) broken by `gaps` gaps (pure): every
 * gap on a straight stretch, never in the first 2.5 m from the ring (he sees where they
 * start), never within 1.5 m of a bend (the turn reads) or of the grass, spread over the
 * whole way. A leg with no gap is one run.
 */
export function printRuns(legs: readonly number[], gaps: number): PrintRun[] {
  const total = legs.reduce((a, b) => a + b, 0);
  // the gaps' middles: evenly over the way, each moved onto a straight stretch
  const mids: { leg: number; at: number }[] = [];
  for (let i = 0; i < gaps; i++) {
    let d = (total * (i + 1)) / (gaps + 1);
    let leg = 0;
    while (leg < legs.length - 1 && d > legs[leg]) { d -= legs[leg]; leg += 1; }
    const lo = (leg === 0 ? 2.5 : 1.5) + PRINT_GAP_M / 2, hi = legs[leg] - 1.5 - PRINT_GAP_M / 2;
    if (hi <= lo) continue; // (a leg too short for a gap keeps its prints)
    mids.push({ leg, at: Math.max(lo, Math.min(hi, d)) });
  }
  const out: PrintRun[] = [];
  legs.forEach((len, leg) => {
    let from = 0;
    for (const g of mids.filter((m) => m.leg === leg).sort((p, q) => p.at - q.at)) {
      const a = (g.at - PRINT_GAP_M / 2) / len, b = (g.at + PRINT_GAP_M / 2) / len;
      if (a > from + 1e-6) out.push({ leg, a: from, b: a });
      from = Math.max(from, b);
    }
    if (from < 1 - 1e-6) out.push({ leg, a: from, b: 1 });
  });
  return out;
}

/* --------------------------------------------------------- run 7: the watch ---- */

/** What the mother turns her head to in a listening pause or a look: a rustle in the
 *  heather beside her, the hide (him), round about, the grass where her calf lies.
 *  (ree-discover adds the birds she may listen to.) */
export type WatchCue = 'ritsel' | 'hut' | 'rond' | 'gras';

/** The mother's small acts in the watch, in play order. */
export type WatchAct = 'rustle' | 'out' | 'walk' | 'listen' | 'bite' | 'look' | 'call' | 'calf' | 'sniff';

export interface WatchEvent {
  act: WatchAct;
  /** how long it lasts (s); a walk lasts until she is there (`out`: out of her bed to her
   *  gap, `walk`: to the point `to` of her way in the watch) */
  s: number;
  /** a walk's goal: 1 = the point of her way between her gap and the meeting place
   *  (layouts with one: she walks `out` to it), 2 = the meeting place */
  to?: 1 | 2;
  /** what she turns her head to (a listen, a look) */
  cue?: WatchCue;
  /** the line said as it starts (a key of the mission's avontuur copy), or none: the line up stays */
  line?: string;
}

/** The lines of the watch: small pools of copy keys (content/veluwe.ts, the ree's
 *  `avontuur`), one drawn per act, each ≤ 7 words, read aloud once. */
export const WATCH_LINES = {
  rustle: ['hoor', 'ritselt'],
  out: ['daar'],
  listen: ['luistert', 'hoortIets', 'stilLuister'],
  bite: ['hapje', 'knabbelt'],
  rond: ['omZich'],
  hut: ['hierheen'],
  call: ['roept'],
  calf: ['kalfKomt'],
  sniff: ['ruikt'],
} as const;

/** How long each act lasts (s), before the seed's jitter (±12 %). */
export const WATCH_S = { rustle: 3.0, listen: 3.6, bite: 2.4, look: 2.4, call: 3.2, sniff: 2.4 } as const;

/**
 * The watch, drawn from the play's seed (design §6.7; pure, ree.variety.test.ts): the bracken
 * at her gap stirs, she steps out into the open (to the point of her way when the layout has
 * one, `way` 2), stops and listens (the first of the level's `pauses`), her small acts in a
 * seeded order (1-2 bites of grass, a look round, more listening pauses), a look at the
 * hide there or at the meeting place (the last pause, when she pauses three times), and at
 * the meeting place her soft call toward the grass where her calf lies, the calf rising and
 * coming to her, and her nose at it. The number of pauses is the level's, never the seed's; the seed picks the
 * order, the lines and the timing. ~25-35 s with her walks.
 */
export function watchScript(play: Pick<Play, 'fork'>, o: { pauses: number; way: 1 | 2 }): WatchEvent[] {
  const rnd = play.fork('ree-wacht');
  const pauses = Math.max(1, Math.min(3, Math.round(o.pauses)));
  const j = (s: number): number => Math.round(s * rnd.between(0.88, 1.12) * 100) / 100;
  const line = (pool: readonly string[]): string => rnd.pick(pool);
  const listen = (cue: WatchCue): WatchEvent => ({ act: 'listen', s: j(WATCH_S.listen), cue, line: line(WATCH_LINES.listen) });
  const look = (cue: 'rond' | 'hut'): WatchEvent => ({ act: 'look', s: j(WATCH_S.look), cue, line: line(WATCH_LINES[cue]) });
  const out: WatchEvent[] = [
    // the bracken at her gap stirs while she gets up and comes out between her bushes,
    // unseen (the rustle is all he hears of it); "Daar is de moeder!" as she is first seen
    { act: 'rustle', s: j(WATCH_S.rustle), line: line(WATCH_LINES.rustle) },
    // out of her gap and a few steps on, out in the open (by the point of her way when the
    // layout has one), where she stops and tests the air: the first pause, toward a rustle
    { act: 'out', s: 0, line: WATCH_LINES.out[0], ...(o.way === 2 ? { to: 1 as const } : {}) },
    listen('ritsel'),
  ];
  // her small acts on the way, in a seeded order: 1-2 bites and a look round, so many as
  // the pauses leave room for (the watch stays ~30 s at every level): one pause: two bites,
  // or a bite and a look round; more: the middle pause and a bite
  const rond = pauses === 1 && rnd.chance(0.5);
  const bites = pauses === 1 && !rond ? 2 : 1;
  const middle: WatchEvent[] = [];
  // (two bites: both of the pool's lines, in a seeded order)
  const biteLines = rnd.shuffle(WATCH_LINES.bite);
  for (let i = 0; i < bites; i++) middle.push({ act: 'bite', s: j(WATCH_S.bite), line: biteLines[i % biteLines.length] });
  if (rond) middle.push(look('rond'));
  if (pauses >= 2) middle.push(listen(rnd.pick(['ritsel', 'rond'] as const)));
  // (the bites stay together; a second pause never straight after the first)
  const pieces = rnd.shuffle(middle.filter((e) => e.act !== 'bite'));
  const firstPause = (e: WatchEvent | undefined): boolean => e?.act === 'listen';
  let at = rnd.int(0, pieces.length);
  if (at > 0 && firstPause(pieces[0])) at = 0;
  const ordered = [...pieces.slice(0, at), ...middle.filter((e) => e.act === 'bite'), ...pieces.slice(at)];
  // where she stopped (by the point of her way), then on to the meeting place; a layout
  // without such a point: at the meeting place
  // a look at the hide (the last pause when she pauses three times): stil! — before she
  // walks on to the meeting place or once she is there (seeded)
  const hut = pauses >= 3 ? listen('hut') : look('hut');
  const early = rnd.chance(0.5);
  if (o.way === 2) out.push(...ordered, ...(early ? [hut] : []), { act: 'walk', s: 0, to: 2 }, ...(early ? [] : [hut]));
  else out.push({ act: 'walk', s: 0, to: 2 }, ...ordered, hut);
  // at the meeting place she turns to the grass where her calf lies and calls it softly
  out.push(
    { act: 'call', s: j(WATCH_S.call), cue: 'gras', line: WATCH_LINES.call[0] },
    { act: 'calf', s: 0, line: WATCH_LINES.calf[0] },
    { act: 'sniff', s: j(WATCH_S.sniff), line: WATCH_LINES.sniff[0] },
  );
  // a line every ~4 s, never a chatter: a look round says its line only when the line up
  // has stood a while; the other acts always do
  let t = 0, said = 0;
  for (const e of out) {
    const small = e.act === 'look' && e.cue === 'rond';
    if (small && e.line && t - said < WATCH_QUIET_S) delete e.line;
    if (e.line) said = t;
    t += e.act === 'out' ? WATCH_OUT_S : e.act === 'walk' ? WATCH_WALK_S : e.act === 'calf' ? 3 : e.s;
  }
  return out;
}

/** A small act says its line only when the line up has stood this long (s). */
const WATCH_QUIET_S = 4.2;
/** How long (s) one of her walks in the watch takes, give or take (for the lines' rhythm). */
export const WATCH_WALK_S = 2.5;
/** …and her walk out of her gap into the open (her walk out of her bed, unseen, is the
 *  rustle's: she is seen as "Daar is de moeder!" is said). */
export const WATCH_OUT_S = 2.0;
