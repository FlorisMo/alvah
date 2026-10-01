/**
 * frisling.vary.ts — what changes every play of "De verdwaalde frisling" (run 7, design
 * frisling §5.1), drawn from THIS play's seed (core/play.ts) and nothing else: which way
 * the squeak comes from (never the same way twice in a row), the nook of that way's stand
 * the piglet lies in and how he lies there, where the look-alikes sit, how the family lies
 * at the mud, and where a woodlark may fly up. Pure (THREE-free), unit-tested in
 * frisling.vary.test.ts.
 *
 * Construct-neutral (run decision 1): none of this changes how hard a breinkracht is —
 * every nook is pinned off centre and equally visible (frisling.places.test.ts), the
 * number of look-alikes and how much of him shows come from the knobs, never from here.
 * The ORDER of the calm moments is not drawn here: the dagnacht trial builder draws it
 * from the play's 'dagnacht' fork, so the 2D floor plays the same order.
 */

import type { Play } from '../../../core/play.ts';
import { FAMILY_LAYOUTS, WAYS, WAY_IDS, type DecoySpot, type WayId } from './frisling.places.ts';

export type { WayId } from './frisling.places.ts';

/** This play of the frisling. */
export interface FrislingVariant {
  way: WayId;
  /** WAYS[way].nooks index: where in the stand he lies */
  nook: number;
  /** 0 side-on, 1 head toward the lens, 2 tail toward it */
  pose: 0 | 1 | 2;
  /** per trial decoy (in trial order): the WAYS[way].decoySpots index it is laid on */
  decoySpots: number[];
  /** FAMILY_LAYOUTS index: 0 'modder', 1 'rand', 2 'boom' */
  family: 0 | 1 | 2;
  /** WAYS[way].walkSpots index a woodlark flies up from, or none (package 2) */
  leeuwerik: number | null;
}

/** A look-alike of the trial, as the variant needs it: a nightjar belongs at a stand's edge. */
export interface DecoyKind { k: string; animal?: string }

/** Does this decoy want an edge spot (a nightjar pressed to a bare patch)? */
export const wantsEdge = (d: DecoyKind): boolean => d.animal === 'nachtzwaluw';

/**
 * Draw this play's frisling from its seed. Every decision has its own fork (adding one
 * later never moves the others) and is noted on the play (it travels with every beat into
 * the history: `va`). `lastWay`: the way of his last frisling play (`lastWayOf`): never
 * the same way twice in a row. `decoys`: the trial's look-alikes, in trial order.
 */
export function frislingVariant(play: Play, lastWay: WayId | null, decoys: readonly DecoyKind[], lastFams: readonly string[] = []): FrislingVariant {
  const ways = WAY_IDS.filter((w) => w !== lastWay);
  const way = play.fork('way').pick(ways);
  const w = WAYS[way];
  const nook = play.fork('nook').int(0, w.nooks.length - 1);
  const pose = play.fork('pose').int(0, 2) as 0 | 1 | 2;
  // the look-alikes: a shuffled order of the stand's spots (assignSpots)
  const decoySpots = assignSpots(play.fork('decoys').shuffle(w.decoySpots.map((_, i) => i)), w.decoySpots, decoys);
  // the family's layout: never one of his last two plays' (three plays in a row, three
  // different mornings at the mud)
  const fams = FAMILY_LAYOUTS.map((_, i) => i).filter((i) => !lastFams.slice(0, 2).includes(FAMILY_LAYOUTS[i].id));
  const family = play.fork('family').pick(fams.length ? fams : FAMILY_LAYOUTS.map((_, i) => i)) as 0 | 1 | 2;
  const lk = play.fork('leeuwerik');
  const leeuwerik = lk.chance(0.5) ? lk.int(0, w.walkSpots.length - 1) : null;
  play.note('way', way);
  play.note('nook', `${nook}/${pose}`); // (the nook, and how he lies in it)
  play.note('fam', FAMILY_LAYOUTS[family].id);
  return { way, nook, pose, decoySpots, family, leeuwerik };
}

/** Which spot each look-alike takes, from an `order` of the stand's spots: the nightjar
 *  first takes the first edge spot in it, then every other decoy the next spot left. */
export function assignSpots(order: readonly number[], spots: readonly DecoySpot[], decoys: readonly DecoyKind[]): number[] {
  const used = new Set<number>();
  const take = (ok: (s: number) => boolean): number | undefined => {
    const i = order.find((s) => !used.has(s) && ok(s));
    if (i !== undefined) used.add(i);
    return i;
  };
  const out: number[] = decoys.map((d) => (wantsEdge(d) ? take((s) => !!spots[s].edge) ?? -1 : -1));
  decoys.forEach((_, i) => {
    if (out[i] >= 0) return;
    const s = take(() => true);
    if (s === undefined) throw new Error(`[frisling] more look-alikes (${decoys.length}) than spots on a stand (${spots.length})`);
    out[i] = s;
  });
  return out;
}

/** The family layouts (ids) of his newest frisling plays, newest first, one per play (by
 *  its seed): the plays started in this page session (`started`, oldest first: a play
 *  stopped early may have left no beat) before the history's (`BeatLog.va`, 'fam:boom'). */
export function recentFams(history: readonly { m: string; sd?: number; va?: string }[], started: readonly { sd: number; fam: string }[] = []): string[] {
  const seen = new Set<number>();
  const out: string[] = [];
  for (let i = started.length - 1; i >= 0; i--) {
    if (seen.has(started[i].sd)) continue;
    seen.add(started[i].sd);
    out.push(started[i].fam);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.m !== 'frisling' || !h.va || (h.sd !== undefined && seen.has(h.sd))) continue;
    const m = /(?:^|,)fam:([a-z]+)/.exec(h.va);
    if (!m) continue;
    if (h.sd !== undefined) seen.add(h.sd);
    out.push(m[1]);
  }
  return out;
}

/** The way of his newest frisling play in the history (`BeatLog.va`, 'way:steen,…'), or null. */
export function lastWayOf(history: readonly { m: string; va?: string }[]): WayId | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.m !== 'frisling' || !h.va) continue;
    const m = /(?:^|,)way:([a-z]+)/.exec(h.va);
    if (m && (WAY_IDS as readonly string[]).includes(m[1])) return m[1] as WayId;
  }
  return null;
}
