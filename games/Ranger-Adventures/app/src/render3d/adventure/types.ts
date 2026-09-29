/**
 * adventure/types.ts — the in-world adventure layer's contracts (run 6, design
 * `design/run6-missions.md` §3). THREE-free, so the places tables and the pure parts
 * carry node unit tests.
 *
 * A mission with an ADVENTURE is played in the live world with the ranger's own body:
 * he walks, follows, leads, searches and watches, and the five brain-games are things
 * he does at real places there. `Mission.stappen` stays the EF contract: an adventure
 * plays those same steps as beats (each `stappen[i]` logged exactly once, through the
 * mission flow), and a mission without one (or a player on the 2D floors) plays the
 * classic path unchanged.
 *
 *   HomeSpec     where the mission lives in the world: its places (absolute world x/z,
 *                chosen by looking at the world, unit-tested for clearance) and the
 *                animals that live there before and after it (world/Residents.ts)
 *   Adventure    the home + an async script over an AdventureKit (adventure/kit.ts)
 */

/** A point on the ground (world metres). */
export interface Spot { x: number; z: number }

/** An authored world spot of a mission: a place a beat happens at. */
export interface Place extends Spot {
  /** how close (m) the ranger must come for a walk beat to arrive there */
  r?: number;
  /** the way a framed view (or the ranger) looks at / from it: a heading (rad), the
   *  direction (sin h, cos h) — the World's `rotation.y` convention */
  heading?: number;
}

export type Places = Readonly<Record<string, Place>>;

/** How a resident spends its time while nobody borrows it. */
export type ResidentIdle = 'root' | 'graze' | 'lie' | 'stand';

/** Where a resident is (and what it does there) in one of its home's two states. */
export interface ResidentPose extends Spot {
  /** facing (rad, heading); default: toward the home's centre */
  yaw?: number;
  idle?: ResidentIdle;
  /** how far (m) it wanders round its spot while it idles (rooting shuffles) */
  roam?: number;
}

/** An animal that lives at a mission's home (world/Residents.ts). */
export interface ResidentSpec {
  /** its name in the home ('sow', 'lost', ...) */
  key: string;
  /** content animal id, as `spawnModel` takes it ('wildzwijn', 'frisling') */
  animal: string;
  /** stand height (m); default: the scale table's (`heightFor`) */
  height?: number;
  /** body length (m), when it is not a pig's ≈ 1.7 × its height (a roe is about as long
   *  as it is tall: its contact shadow and its turning pivot) */
  len?: number;
  /** where it is before the mission is done (null: not there yet) */
  before: ResidentPose | null;
  /** where it is once the mission is done (null: gone) */
  after: ResidentPose | null;
  /** a call it makes now and then while the ranger is near (spatial, calm) */
  voice?: ResidentVoice;
  /** a SHY animal (free roam): it slips into cover when the ranger comes near, and
   *  comes back out once he has gone (world/Residents.ts); per home state */
  shy?: readonly ResidentShy[];
}

/**
 * How a shy resident keeps its distance while nobody borrows it (a roe doe grazing at
 * a copse): once the ranger is within `within` m it lifts its head, looks at him and
 * walks calmly to `to` (into the copse; `lie`: it beds down there). Once he has been
 * further than `back` m away for `after` s it walks back to its spot and idles again.
 */
export interface ResidentShy {
  within: number;
  back: number;
  to: Spot & { yaw?: number };
  lie?: boolean;
  /** seconds he must be gone before it comes out (default 3) */
  after?: number;
  /** only in this home state (default: both) */
  state?: 'before' | 'after';
}

export interface ResidentVoice {
  /** the call id (`Sound.callAt`) */
  call: string;
  /** seconds between two calls: a calm random pause in [min, max] */
  every: readonly [number, number];
  /** it calls only while the ranger is within this many metres */
  within: number;
  /** only in this home state (default: both) */
  state?: 'before' | 'after';
}

/** A mission's home in the world. Pure data: the THREE-side dressing (a wallow, a
 *  cover stand, a rooting field) is the adventure's `dressing` builder. */
export interface HomeSpec {
  missionId: string;
  places: Places;
  residents: readonly ResidentSpec[];
  /** the mission marker: where it stands (default: its landschap's anchor) and what
   *  stands in its ring ('none': an empty ring; the story's animal is elsewhere) */
  marker?: { at?: Spot; look: 'animal' | 'prop' | 'none' };
}

/** The two states of a home: before the mission is done, and after. */
export type HomeState = 'before' | 'after';

/** The step indices of a mission (its `stappen`), as the kit logs them. */
export type StepIndex = number;

/** What the dev hook reads while an adventure runs (`__ranger.adventure()`). Read-only. */
export interface AdventureRead {
  mission: string;
  /** the beat running now ('walk:cover', 'search', 'route', 'choice:aaien', ...) */
  beat: string;
  /** the step indices logged so far (each exactly once) */
  stepsLogged: number[];
  /** the objective line on screen, or null */
  line: string | null;
  /** measured numbers a test can check the design's bar against */
  stats: Record<string, number>;
}
