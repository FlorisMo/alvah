/**
 * registry.ts — the list of shipped, in-place 3D engine variants the `ViewMode`
 * resolver consults (3D-IMMERSION-PLAN §2, BUILD-PLAN §1f). A variant appears here
 * only once it's construct-faithful (same trial builder + same `BeatSummary` as its
 * 2D twin); its seeded parity test lands in the matching Phase-II ledger box. Any
 * engine NOT listed keeps serving the always-available 2D floor.
 *
 * 45c proves the harness end-to-end with the first diegetic adapter (zoeken); the
 * other four (dagnacht/corsi/simon/wisselen) followed as their boxes landed — all
 * five EF engines now ship a construct-faithful in-world variant.
 */

import type { Play3dEngine } from './types';
import { zoeken3dEngine } from '../engines/zoeken3d';
import { dagnacht3dEngine } from '../engines/dagnacht3d';
import { corsi3dEngine } from '../engines/corsi3d';
import { simon3dEngine } from '../engines/simon3d';
import { wisselen3dEngine } from '../engines/wisselen3d';

export const REGISTRY_3D: readonly Play3dEngine[] = [
  zoeken3dEngine,
  dagnacht3dEngine,
  corsi3dEngine,
  simon3dEngine,
  wisselen3dEngine,
];
