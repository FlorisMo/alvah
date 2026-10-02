/**
 * play.ts — THIS play's variety (run 7, design `state/foundation/design.md` §4.1): every
 * random choice a mission makes in one play (where the piglet hides, the order of the calm
 * moments, a rare visitor, the corsi route, which caller sounds) comes from ONE seed, so no
 * two plays are alike and a test can replay a play exactly. Pure: no THREE, no DOM (the
 * seed source reads `location` and `crypto` only when they exist).
 *
 *   const spot = k.play.fork('hide').pick(SPOTS);   // one fork per decision
 *   k.play.note('hide', spot.id);                   // logged with every beat (BeatLog.va)
 *
 * A home never calls `Math.random`. Each decision draws from its OWN fork (`fork(label)`),
 * so adding a draw later never reshuffles the others: "seed 7 → spot b" stays true. A
 * fork's stream depends only on the root seed and its label (never on draws made on the
 * parent or on another fork); the same label gives the same stream again from its start.
 * A fork's `note` lands in the root play's `variant` (one record per play).
 *
 * The seed: `?seed=N` in the URL makes this page session's plays N, N+1, N+2 … (a reload
 * with the same N replays the same session); without it the session's base is random and
 * its plays are base, base+1 … all the same.
 */

/** This play's variety: a seeded stream and what was chosen. */
export interface Play {
  /** the play's seed (uint32) */
  readonly seed: number;
  readonly missionId: string;
  /** this mission's play number in the save (1 = the first ever) */
  readonly n: number;
  /** uniform in [0, 1) (mulberry32 over the seed); safe to pass around unbound */
  rng(): number;
  /** one item of `list` (throws on an empty list: a home's bug) */
  pick<T>(list: readonly T[]): T;
  /** a shuffled copy of `list` */
  shuffle<T>(list: readonly T[]): T[];
  /** true with probability `p` */
  chance(p: number): boolean;
  /** a uniform float in [a, b) */
  between(a: number, b: number): number;
  /** a uniform integer in [a, b] */
  int(a: number, b: number): number;
  /** an independent stream for one decision: seed' = hash32(seed, label) */
  fork(label: string): Play;
  /** record a choice (it travels with every beat into the history) */
  note(key: string, value: string | number): void;
  /** what was chosen this play (shared by the play and all its forks) */
  readonly variant: Readonly<Record<string, string | number>>;
}

/** mulberry32: a small, fast, well-mixed 32-bit generator. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** murmur3's finaliser: every input bit reaches every output bit. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A label mixed into a seed: FNV-1a over the label's characters, seeded with the mixed
 *  seed, then finalised. Different labels (or seeds) give unrelated streams. */
export function hash32(seed: number, label: string): number {
  let h = (0x811c9dc5 ^ fmix32((seed >>> 0) + 0x9e3779b9)) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

function makePlay(missionId: string, seed: number, n: number, notes: Record<string, string | number>): Play {
  const s = seed >>> 0;
  const rng = mulberry32(s);
  const play: Play = {
    seed: s,
    missionId,
    n,
    rng,
    pick: <T>(list: readonly T[]): T => {
      if (!list.length) throw new Error(`[play] pick from an empty list (${missionId})`);
      return list[Math.floor(rng() * list.length)];
    },
    shuffle: <T>(list: readonly T[]): T[] => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p: number): boolean => rng() < p,
    between: (a: number, b: number): number => a + rng() * (b - a),
    int: (a: number, b: number): number => {
      const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b));
      return lo + Math.floor(rng() * (hi - lo + 1));
    },
    fork: (label: string): Play => makePlay(missionId, hash32(s, label), n, notes),
    note: (key: string, value: string | number): void => { notes[key] = value; },
    variant: notes,
  };
  return play;
}

/** A play of `missionId` over `seed`; `n` is its play number in the save (1 = first). */
export function newPlay(missionId: string, seed: number, n: number): Play {
  return makePlay(missionId, seed, n, {});
}

/** The variant as the history keeps it: 'k:v,k:v', at most `max` characters (whole pairs
 *  only; a value's own ',' or ':' becomes '.'). Empty → undefined. */
export function compactVariant(variant: Readonly<Record<string, string | number>>, max = 60): string | undefined {
  const clean = (x: string | number): string => String(x).replace(/[,:]/g, '.');
  let out = '';
  for (const [k, v] of Object.entries(variant)) {
    const pair = `${clean(k)}:${clean(v)}`;
    const next = out ? `${out},${pair}` : pair;
    if (next.length > max) break;
    out = next;
  }
  return out || undefined;
}

/* ------------------------------------------------------------- the seed ---- */

/** `?seed=N` in a URL's search part → N (uint32), else null. */
export function parseSeedParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || raw.trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) ? (Math.trunc(v) >>> 0) : null;
}

function randomUint32(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  // (no Web Crypto: a time-based base, still never Math.random)
  return fmix32((Date.now() >>> 0) ^ 0x5bd1e995);
}

let base: number | null = null;
let drawn = 0;

/** This page session's seed base: `?seed=N` → N, else a random uint32 (once per load). */
export function sessionSeed(): number {
  if (base === null) {
    const search = typeof location !== 'undefined' ? location.search : '';
    base = parseSeedParam(search) ?? randomUint32();
  }
  return base;
}

/** The seed of the session's next play: the k-th play drawn on this page load gets
 *  (base + k) >>> 0. */
export function nextPlaySeed(): number {
  const s = (sessionSeed() + drawn) >>> 0;
  drawn += 1;
  return s;
}

const loose = new Map<string, number>();

/** Run 7 `adaptive`: a stream for a choice that belongs to no play (a view opened without
 *  one, the hut, the bird bench): seeded from the session's seed and `label`, the k-th call
 *  for a label its own stream. So even these never call `Math.random`, and a `?seed=N`
 *  session replays them too. */
export function looseRng(label: string): () => number {
  const k = loose.get(label) ?? 0;
  loose.set(label, k + 1);
  return mulberry32(hash32((sessionSeed() + k) >>> 0, `loose:${label}`));
}
