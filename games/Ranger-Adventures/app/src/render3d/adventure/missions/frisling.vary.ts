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
import type { Skin } from '../../../content/types.ts';
import { playDagnachtTrial, type DagnachtDiff } from '../../../engines/dagnacht.ts';
import { FAMILY_LAYOUTS, WAYS, WAY_IDS, type DecoySpot, type WayId } from './frisling.places.ts';

export type { WayId } from './frisling.places.ts';

/** This play of the frisling. */
export interface FrislingVariant {
  way: WayId;
  /** WAYS[way].nooks index: where in the stand he lies */
  nook: number;
  /** how he lies in the nook, always his striped flank to the lens (frisling.places
   *  `nookAt`): 0 head the nook's way, 1 head the other way, 2 turned a little away */
  pose: 0 | 1 | 2;
  /** per trial decoy (in trial order): the WAYS[way].decoySpots index it is laid on */
  decoySpots: number[];
  /** FAMILY_LAYOUTS index: 0 'modder', 1 'rand', 2 'boom' */
  family: 0 | 1 | 2;
  /** WAYS[way].walkSpots index a woodlark flies up from, or none (package 2; never on his
   *  first play of this home) */
  leeuwerik: number | null;
  /** run 7 (body): the sow's nest of bitten fronds lies at this play's stand (about half
   *  the plays from his second on: a find for another day) */
  nest: boolean;
}

/** A look-alike of the trial, as the variant needs it: a nightjar belongs at a stand's edge. */
export interface DecoyKind { k: string; animal?: string }

/** Does this decoy want an edge spot (a nightjar pressed to a bare patch)? */
export const wantsEdge = (d: DecoyKind): boolean => d.animal === 'nachtzwaluw';

/** A beat of the save's history, as the variant reads it back. */
type Beat = { m: string; sd?: number; va?: string };

/**
 * This play as the home lays it under the briefing card (`prepare`): the order the calm
 * moments will come in first (the very trial the script, the 2D floor and the classic stage
 * build from the play: noted 'rust'), then the way, the family and the nook
 * (`frislingVariant`). In this order the history's 60 characters always keep what the next
 * play reads back, after the light and a rare visitor the briefing noted.
 */
export function drawFrisling(play: Play, history: readonly Beat[], started: readonly PastPlay[], calm: { skin: Skin; diff: DagnachtDiff }, decoys: readonly DecoyKind[]): FrislingVariant {
  playDagnachtTrial(calm.skin, calm.diff, play, history);
  return frislingVariant(play, recentPlays(history, started), decoys);
}

/** How much likelier the way he has not had for longest is, from his fourth play on, than
 *  the other way that may come (never the last play's): a gentle 2 : 1, never forced. */
export const LONGEST_WEIGHT = 2;

/**
 * Draw this play's frisling from its seed. Every decision has its own fork (adding one
 * later never moves the others) and is noted on the play (it travels with every beat into
 * the history: `va`). `past`: his newest frisling plays, newest first (`recentPlays`).
 * `decoys`: the trial's look-alikes, in trial order.
 *
 * The rotation (run 7 review r1: both 'never one of the last two' locked a save into one
 * fixed three-play cycle for good, each way always with the same family): in a save's
 * first three plays the way and the family are each never one of his last two plays' —
 * his first three plays are three ways and three mornings at the mud. From the fourth play
 * on, only the LAST play's way never comes again at once, the way he has not had for
 * longest a little likelier (`LONGEST_WEIGHT`), and only the last play's family layout
 * never comes again at once, drawn from its own fork: no cycle, and every way meets every
 * family. And when a way comes again, the piglet never lies in the nook he lay in the last
 * time that way came, nor does the family lie the way it lay then: a way he knows still
 * hides him somewhere new and finds the family otherwise.
 *
 * Notes: the way, the family, the nook and how he lay in it as ONE short note
 * ('way:steen/modder/3b': nook 3, pose b = 1; pose a, b, c = 0, 1, 2): the history keeps a
 * play's variant to 60 characters, and the light and a rare visitor are noted before the
 * home lays its play (the caller notes the calm order, 'rust', before this), so all four
 * always fit — the next play reads them back, and a grown-up reading his growth sees where
 * each search was and how he lay (run 7 growth: with the longest light and a rare visitor
 * the nook used to be cut; run 7 fix: a separate 'pose' note was the first thing cut, and
 * 'way:steen/modder/3/1' would be one character too many in the worst case).
 */
export function frislingVariant(play: Play, past: readonly PastPlay[], decoys: readonly DecoyKind[]): FrislingVariant {
  const way = drawWay(play.fork('way'), past.map((p) => p.way));
  const w = WAYS[way];
  // the nook: any but the one he found him in the last time this way came
  const before = past.find((p) => p.way === way)?.nook;
  const nook = play.fork('nook').pick(w.nooks.map((_, i) => i).filter((i) => i !== before));
  const pose = play.fork('pose').int(0, 2) as 0 | 1 | 2;
  // the look-alikes: a shuffled order of the stand's spots (assignSpots), never one that
  // stands over or right beside his nook in the search's picture (`nearNook`)
  const decoySpots = assignSpots(play.fork('decoys').shuffle(w.decoySpots.map((_, i) => i)), w.decoySpots, decoys, w.nearNook?.[nook]);
  // the family's layout, from its own fork: never his last play's (in his first three,
  // never one of his last two: three different mornings at the mud), and never the one it
  // had the last time this way came (a way he knows finds the family otherwise again)
  const ids = FAMILY_LAYOUTS.map((l) => l.id as string);
  let fams = freshOf(ids, past.flatMap((p) => (p.fam ? [p.fam] : [])));
  const famBefore = past.find((p) => p.way === way)?.fam;
  if (fams.length > 1 && famBefore) fams = fams.filter((f) => f !== famBefore);
  const family = ids.indexOf(play.fork('family').pick(fams)) as 0 | 1 | 2;
  // the extras (a woodlark where he walks, the sow's nest at the stand): his first play
  // here is the adventure itself; from his second on, each comes in about half the plays,
  // so coming back has something new (their own forks: the rest of the play is the same)
  const extras = play.n > 1;
  const lk = play.fork('leeuwerik');
  const leeuwerik = extras && lk.chance(0.5) ? lk.int(0, w.walkSpots.length - 1) : null;
  const nest = extras && play.fork('nest').chance(0.5);
  play.note('way', `${way}/${FAMILY_LAYOUTS[family].id}/${nook}${POSE_CODE[pose]}`);
  return { way, nook, pose, decoySpots, family, leeuwerik, nest };
}

/** The ids that may come after `recent` (newest first): in his first three plays (fewer
 *  than three known) never one of the last two, after that never the last one only. */
function freshOf(ids: readonly string[], recent: readonly string[]): string[] {
  const shut = recent.slice(0, recent.length < ids.length ? 2 : 1);
  const open = ids.filter((id) => !shut.includes(id));
  return open.length ? open : [...ids];
}

/** This play's way (`frislingVariant`): uniform among the open ways in his first three
 *  plays (the seed table holds); from the fourth on, of the two open ways the one he has
 *  not had for longest is `LONGEST_WEIGHT` times likelier. */
function drawWay(fork: Play, recent: readonly string[]): WayId {
  const open = freshOf(WAY_IDS, recent) as WayId[];
  if (recent.length < WAY_IDS.length || open.length < 2) return fork.pick(open);
  const age = (id: WayId): number => { const i = recent.indexOf(id); return i < 0 ? Infinity : i; };
  const [a, b] = age(open[0]) >= age(open[1]) ? [open[0], open[1]] : [open[1], open[0]];
  if (age(a) === age(b)) return fork.pick(open);
  return fork.rng() < LONGEST_WEIGHT / (LONGEST_WEIGHT + 1) ? a : b;
}

/** Which spot each look-alike takes, from an `order` of the stand's spots: the nightjar
 *  first takes the first edge spot in it, then every other decoy the next spot left.
 *  `skip`: spots none may take (they stand over the nook he lies in: `Way.nearNook`). */
export function assignSpots(order: readonly number[], spots: readonly DecoySpot[], decoys: readonly DecoyKind[], skip: readonly number[] = []): number[] {
  const used = new Set<number>(skip);
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

/** How a pose is written after the nook in the way note ('3b': nook 3, pose 1). */
export const POSE_CODE = ['a', 'b', 'c'] as const;

/** One of his earlier frisling plays, as the next one reads it back: its seed, its way,
 *  and (when the history kept them) its family layout, nook and how he lay there. */
export interface PastPlay { sd?: number; way: string; fam?: string; nook?: number; pose?: number }

/** His newest frisling plays, newest first, one per play (by its seed): the plays started
 *  in this page session (`started`, oldest first: a play stopped early may have left no
 *  beat) before the history's (`BeatLog.va`, 'way:steen/boom/3b'; a save from before run
 *  7's fair-variety fix noted 'way:steen/boom/3,pose:1', one from before its growth package
 *  'way:steen/boom,nook:3/1'). */
export function recentPlays(history: readonly Beat[], started: readonly PastPlay[] = []): PastPlay[] {
  const seen = new Set<number>();
  const out: PastPlay[] = [];
  for (let i = started.length - 1; i >= 0; i--) {
    const s = started[i];
    if (s.sd !== undefined) { if (seen.has(s.sd)) continue; seen.add(s.sd); }
    out.push(s);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.m !== 'frisling' || !h.va || (h.sd !== undefined && seen.has(h.sd))) continue;
    // ('way:steen/boom/3b': the way, the family layout, the nook and the pose; older saves:
    // 'way:steen/boom/3' and 'pose:1', or 'way:steen/boom' and 'nook:3/1', the nook then the pose)
    const m = /(?:^|,)way:([a-z]+)(?:\/([a-z]+))?(?:\/(\d+)([a-c])?)?/.exec(h.va);
    if (!m) continue;
    if (h.sd !== undefined) seen.add(h.sd);
    const old = /(?:^|,)nook:(\d+)(?:\/(\d))?/.exec(h.va);
    const n = m[3] ?? old?.[1];
    const pose = m[4] ? POSE_CODE.indexOf(m[4] as 'a') : (/(?:^|,)pose:(\d)/.exec(h.va)?.[1] ?? old?.[2]);
    out.push({
      sd: h.sd, way: m[1], ...(m[2] ? { fam: m[2] } : {}), ...(n !== undefined ? { nook: Number(n) } : {}),
      ...(pose !== undefined ? { pose: Number(pose) } : {}),
    });
  }
  return out;
}

/** The ways of his newest frisling plays, newest first, one per play (`recentPlays`). */
export function recentWays(history: readonly Beat[], started: readonly PastPlay[] = []): string[] {
  return recentPlays(history, started).map((p) => p.way);
}

/** The family layouts of his newest frisling plays, newest first (`recentPlays`). */
export function recentFams(history: readonly Beat[], started: readonly PastPlay[] = []): string[] {
  return recentPlays(history, started).flatMap((p) => (p.fam ? [p.fam] : []));
}
