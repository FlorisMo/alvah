/**
 * frisling.grow.ts — how "De verdwaalde frisling" plays FOUNDATION's knobs (run 7, package
 * growth, design frisling §3 and §5.8): the same exercises, visibly harder as he grows,
 * never a different exercise. Pure (THREE-free), unit-tested in frisling.grow.test.ts.
 *
 * The frisling invents no difficulty number of its own: every number here turns a knob of
 * `core/skill.ts` (`k.knobs(engine)`, the same knobs the 2D floor reads) into what the world
 * shows. What the beats read by themselves is not repeated here: the look-alikes' count
 * (`buildZoekenTrial`), how much of him shows (`openWindow` at `glimpse`), the first hint
 * (`searchBeat`, `hintAfterS`), the route's start, length and rounds (`routeBeat`,
 * `SpanRun`), the holds and when the animal tempts him (`ChoiceRun.still`, `RustTempo`), the
 * tired piglet's stretch (`paceStretch`) and the free path's window (`goWaitS`).
 *
 *  - the FOLLOW (speurkracht's tracking leg): after the first crisp prints by the ring (the
 *    same at every level: where the trail starts reads at once), `trailLegs` sets how far
 *    apart the prints lie and `trailClarity` how dark they are and how often he hears the
 *    lost piglet squeak (a clearer trail: more often).
 *  - the TEMPTATIONS of a calm moment (rustkracht): a hold's temptations (`tempts`, 1-3)
 *    each pull harder than the one before — first a sound (a squeak, a grunt), then a look
 *    at him or a nudge, then a half step closer (across the picture, never at the lens). A
 *    first play hears one squeak; a practised child meets all three in a longer hold.
 */

import type { ZoekKnobs } from '../../../core/skill.ts';
import { atLocal, toLocal } from '../places.ts';
import type { Spot } from '../types.ts';

/** The first prints from the ring: crisp, at every level, and this far apart (m) — run 6's
 *  print gap, so where the trail starts reads at once. */
export const CRISP_PRINTS = 4;
export const CRISP_GAP = 0.95;

/** How the follow looks and sounds at a level. */
export interface FollowLook {
  /** metres between two prints after the crisp ones */
  gap: number;
  /** how dark those prints are (0..1) */
  opacity: number;
  /** seconds between two squeaks of the lost piglet while he follows (a range) */
  squeakEvery: readonly [number, number];
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * The follow at a level (`k.knobs('zoeken')`): `trailLegs` 2..5 → a print every 0.95 m
 * (run 6's trail) .. 1.55 m; `trailClarity` 0.95..0.4 → prints 0.86..0.45 dark and a squeak
 * every ~3-5 s .. ~6.5-8 s. Each band is at least as hard as the one below it.
 */
export function followLook(z: Pick<ZoekKnobs, 'trailLegs' | 'trailClarity'>): FollowLook {
  const legs = clamp(z.trailLegs, 2, 5);
  const c = clamp(z.trailClarity, 0.25, 1);
  const lo = 3.2 + (0.95 - c) * 6;
  return {
    gap: Math.round((0.55 + 0.2 * legs) * 100) / 100,
    opacity: Math.round((0.15 + 0.75 * c) * 100) / 100,
    squeakEvery: [Math.round(lo * 10) / 10, Math.round((lo + 1.5) * 10) / 10],
  };
}

/** How hard a temptation pulls: 0 a sound (a squeak, a grunt), 1 a look at him or a
 *  nudge, 2 a half step closer. */
export type Pull = 0 | 1 | 2;

/** The pull of a hold's `i`-th temptation (0-based): each one stronger than the one before,
 *  the strongest last. One temptation (a first play) is a sound; three (a practised child)
 *  are a sound, a look and a half step. */
export function pullOf(i: number): Pull {
  return clamp(Math.floor(i), 0, 2) as Pull;
}

/**
 * A half step (`m`) from `from` toward `to`, ACROSS a lens looking along `heading`: only the
 * part of the way that runs across its picture, so an animal coming a little nearer him
 * never comes at the lens. Never further than `to` lies across; when `to` lies straight
 * along the lens, to the picture's right.
 */
export function stepAcross(from: Spot, to: Spot, heading: number, m: number): Spot {
  const f = { x: from.x, z: from.z, heading };
  const u = toLocal(f, to).u;
  const s = Math.abs(u) < 1e-6 ? m : Math.sign(u) * Math.min(m, Math.abs(u));
  return atLocal(f, s, 0);
}
