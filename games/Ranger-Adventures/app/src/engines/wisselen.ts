/**
 * wisselen.ts — EF engine "wisselen" (cognitive flexibility / set-shifting),
 * the render-agnostic task logic ported from prototype/step-wissel.jsx. Day
 * animals go to the open clearing, night animals to the den — but the signpost
 * flips now and then ("Nu andersom!") and the child must switch the rule.
 * Difficulty knob (wisselFreq) drives how often the rule flips; skin.trials sets
 * the length. The render layer runs the sort loop and reports a beat.
 */

import type { Skin } from '../content/types';
import type { Settings } from '../core/state';

export interface WisselItem {
  id: string;     // animal id
  dag: boolean;   // true = day animal (natural bin = open clearing)
}

export interface WisselTrial {
  queue: WisselItem[];
  flipEvery: number;   // flip the rule every N correct sorts
}

/** Build a shuffled day/night queue + resolve the flip cadence. */
export function buildWisselTrial(skin: Skin, diff: Settings, rng: () => number = Math.random): WisselTrial {
  const dag = skin.dagDieren?.length ? skin.dagDieren : ['edelhert', 'ree'];
  const nacht = skin.nachtDieren?.length ? skin.nachtDieren : ['das', 'nachtzwaluw', 'wildzwijn'];
  const totaal = Math.max(4, skin.trials ?? 8);

  const pool: WisselItem[] = [];
  for (let i = 0; i < totaal; i++) {
    const fromDag = i % 2 === 0;
    const arr = fromDag ? dag : nacht;
    pool.push({ id: arr[Math.floor(rng() * arr.length)], dag: fromDag });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // higher wisselFreq → flips more often (every 2); lower → calmer (every 6)
  const freq = diff.wisselFreq ?? 0.4;
  const flipEvery = Math.max(2, Math.round(2 + (1 - freq) * 4));

  return { queue: pool, flipEvery };
}
