/**
 * corsi.ts — EF engine "corsi" (Geheugenkracht: visuospatial sequence memory), the
 * render-agnostic task logic. A route of look-alike spots lights up; the child taps it back
 * in order. The render layer runs the show → recall loop and reports the BeatSummary.
 *
 * Run 7 (`adaptive`, design §5.2): the beat is a few ROUNDS on the shared span core
 * (engines/span.ts): the first route is `knobs.start` long, each clean recall brings a new,
 * one-longer route, a rescued one a new route of the same length, two wrong taps a shorter
 * one (silently); it always ends on a route he walked back himself.
 */

import type { Skin } from '../content/types';
import type { SpanKnobs } from '../core/skill';
import { looseRng } from '../core/play.ts';
import { SpanRun, type SpanSupplier } from './span.ts';

export type { SpanResult } from './span.ts';

export interface CorsiSpot {
  id: number;
  x: number;
  y: number;
}

/** Fixed footprint layout (the "route" the herd walked): seven look-alike spots. */
export const PRINT_SPOTS: readonly CorsiSpot[] = [
  { id: 0, x: 18, y: 72 }, { id: 1, x: 34, y: 46 }, { id: 2, x: 50, y: 66 },
  { id: 3, x: 60, y: 36 }, { id: 4, x: 74, y: 58 }, { id: 5, x: 86, y: 34 },
  { id: 6, x: 44, y: 24 },
];

export interface CorsiTrial {
  spots: readonly CorsiSpot[];
  /** the beat's span knobs (max capped by the seven spots; `skin.rondes` caps the rounds) */
  knobs: SpanKnobs;
}

/** The spots and the knobs this beat plays: a skin's `rondes` caps the rounds for its story
 *  (the squirrel's two mouthfuls); the 2D floor reads the same skin. */
export function buildCorsiTrial(skin: Skin, knobs: SpanKnobs): CorsiTrial {
  const rondes = typeof skin.rondes === 'number' && skin.rondes >= 1 ? Math.floor(skin.rondes) : Infinity;
  const max = Math.min(knobs.max, PRINT_SPOTS.length);
  return {
    spots: PRINT_SPOTS,
    knobs: { start: Math.min(knobs.start, max), max, rounds: Math.max(1, Math.min(knobs.rounds, rondes)) },
  };
}

/** The routes' supplier (pure, seeded): every round a fresh route over the seven spots with
 *  no spot twice, never the same route as the round before. */
export function corsiNext(spots: readonly CorsiSpot[], rng: () => number = looseRng('corsi')): SpanSupplier<number> {
  const route = (len: number): number[] => {
    const ids = spots.map((s) => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, len);
  };
  return (len, prev) => {
    let r = route(len);
    for (let tries = 0; tries < 6 && prev && r.join() === prev.join(); tries++) r = route(len);
    return r;
  };
}

/**
 * CorsiRun — the route's core, shared by the 2D floor (`render2d/RouteView`), the classic 3D
 * stage (`render3d/engines/corsi3d`) and the world's route beat (`adventure/beats/route`):
 * the span core over the seven spots, fed by the play's fork. Same knobs + seed + taps →
 * the same summary everywhere.
 */
export class CorsiRun extends SpanRun<number> {
  constructor(trial: CorsiTrial, rng: () => number) {
    super(trial.knobs, corsiNext(trial.spots, rng));
  }
  /** how many spots of this round's route he walked back right in this pass */
  get recallIndex(): number { return this.echoIndex; }
}
