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
 * calf come in a drawn order. All of it is drawn from the play's seed (`k.play`, one fork
 * per decision), so a play can be replayed (`?dev=1&seed=N`), and none of it changes how
 * hard a breinkracht is (decision 1: the stands are the same size, the lens the same
 * distance and angle, the spots equally readable; difficulty moves only with the level).
 *
 * Three plays in a row are three layouts: a layout never repeats one of the last two
 * plays' (read from the beat history), and so do the spot and the order of the calm
 * moments, so the picture and the moments are new each time too.
 */

import type { Play } from '../../../core/play.ts';

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
export function drawReePlay(play: Pick<Play, 'fork'>, lastVariants: readonly string[] = [], spot?: number): ReePlay {
  const last = lastVariants.map(parseReeVariant).filter((x): x is NonNullable<typeof x> => !!x).slice(-2);
  const layout = fresh(play.fork('ree-plek'), REE_LAYOUT_IDS, last.map((l) => l.layout));
  const spots = Array.from({ length: CALF_SPOTS }, (_, i) => i);
  const s = spot !== undefined && spot >= 0 && spot < CALF_SPOTS ? spot : fresh(play.fork('ree-kalf'), spots, last.map((l) => l.spot));
  const graze = play.fork('ree-graas').pick([0, 1] as const);
  const poolPlay = play.fork('ree-poel');
  const pool: 'in' | 'out' = last.length === 2 && last[0].pool === last[1].pool
    ? (last[1].pool === 'in' ? 'out' : 'in')
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
