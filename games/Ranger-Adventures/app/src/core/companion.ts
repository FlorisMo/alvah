/**
 * companion.ts — metgezel: redden → verzorgen → vriend (HANDOFF §7.2 / plan §13.3).
 * Pure, framework-free, telemetry-free model ported from prototype/companion.jsx.
 *
 * Two layers:
 *  - a PERSISTENT companion you rescue early, care for over time (bond grows),
 *    who grows baby→jong→zelfstandig, unlocks helper-kunstjes, and walks/flies
 *    with you once strong (`meeOpMissie`).
 *  - a recurring REHAB loop: other animals you tend briefly and then RELEASE
 *    (help AND let go — emotional-positive, never sad, never graphic).
 *
 * The care routine is EF-in-disguise: the ordered routine is a working-memory
 * (simon) task; resisting over-handling is an inhibition (dagnacht) task. The UI
 * (`ui/Companion.ts`) logs those to the SAME skill records the engines use — no
 * new engine, just a care SKIN. This module is render-agnostic: it holds only the
 * data + the pure state transitions, so state.ts wraps them and tests verify them.
 */

import type { Engine } from './skill';
import { RAAF_NAMEN, RAAF_FASE, RAAF_KUNSTJE, ZORG, GAST } from '../content/copy.ts';

export type Fase = 'baby' | 'jong' | 'zelfstandig';
export type Kunstje = 'scout' | 'gids';

export interface SoortConfig {
  soort: string;
  naam: string;
  roep: string;
  kunstjeBijFase: Partial<Record<Fase, Kunstje>>;
  namen: string[];
}

/** Species config (data; add 'hond'/'vos' later, same shape). Default = raaf. */
export const COMPANION_SOORTEN: Record<string, SoortConfig> = {
  raaf: {
    soort: 'raaf', naam: 'raaf', roep: 'raaf',
    kunstjeBijFase: { jong: 'scout', zelfstandig: 'gids' },
    namen: [...RAAF_NAMEN],
  },
};

export const FASE_ORDER: readonly Fase[] = ['baby', 'jong', 'zelfstandig'];

/** Each stage's threshold; its words live in the copy deck (content/copy.ts). */
export const FASE_META: Record<Fase, { label: string; kort: string; drempel: number }> = {
  baby:        { ...RAAF_FASE.baby,        drempel: 0 },
  jong:        { ...RAAF_FASE.jong,        drempel: 40 },
  zelfstandig: { ...RAAF_FASE.zelfstandig, drempel: 75 },
};

/** `uitleg` takes the raaf's name as `{raaf}`. */
export const KUNSTJE_META: Record<Kunstje, { naam: string; uitleg: string; icon: string }> = {
  scout: { ...RAAF_KUNSTJE.scout, icon: 'eye' },
  gids:  { ...RAAF_KUNSTJE.gids,  icon: 'path' },
};

export interface ZorgStap {
  id: string;
  label: string;
  icon: string;
  zin: string;
}

/** Care routine per fase — needs change as it grows (that change = flexibiliteit). The
 *  words (the button, what the voice says) live in the copy deck. */
export const ZORG_STAPPEN: Record<Fase, ZorgStap[]> = {
  baby: [
    { id: 'warmte', icon: 'flame', ...ZORG.warmte },
    { id: 'voer',   icon: 'drop',  ...ZORG.voer },
    { id: 'rust',   icon: 'moon',  ...ZORG.rust },
    { id: 'check',  icon: 'check', ...ZORG.check },
  ],
  jong: [
    { id: 'voer',   icon: 'drop',  ...ZORG.voerGroot },
    { id: 'beweeg', icon: 'wing',  ...ZORG.beweeg },
    { id: 'check',  icon: 'check', ...ZORG.checkJong },
  ],
  zelfstandig: [
    { id: 'oefen', icon: 'wing',  ...ZORG.oefen },
    { id: 'check', icon: 'check', ...ZORG.checkVrij },
  ],
};

export interface OpvangGast {
  dier: string;
  reden: string;
}

/** Rehab guests — existing animals only; non-graphic, always releasable. */
export const OPVANG_GASTEN: OpvangGast[] = [
  { dier: 'nachtzwaluw', ...GAST.nachtzwaluw },
  { dier: 'das',         ...GAST.das },
];

export interface Companion {
  soort: string;
  naam: string;
  rescued: boolean;
  fase: Fase;
  bond: number;            // 0..100 — growth, never a "score"; grows with correct care
  kunstjes: Kunstje[];
  meeOpMissie: boolean;    // walks/flies with you once strong
}

export interface Rehab {
  active: boolean;
  dier: string | null;
  reden: string | null;
  releasedCount: number;
}

/** The two EF skills a care round trains (order = working memory, over-handling = inhibition). */
export const CARE_ENGINES: { order: Engine; inhibition: Engine } = { order: 'simon', inhibition: 'dagnacht' };

export function blankCompanion(): Companion {
  return { soort: 'raaf', naam: '', rescued: false, fase: 'baby', bond: 8, kunstjes: [], meeOpMissie: false };
}

export function blankRehab(): Rehab {
  return { active: false, dier: null, reden: null, releasedCount: 0 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Highest fase whose bond threshold is met (monotone in bond). */
export function faseVoorBond(bond: number): Fase {
  let f: Fase = 'baby';
  for (const k of FASE_ORDER) if (bond >= FASE_META[k].drempel) f = k;
  return f;
}

/** Kunstjes unlocked up to and including the given fase (cumulative). */
export function kunstjesVoorFase(soort: string, fase: Fase): Kunstje[] {
  const cfg = COMPANION_SOORTEN[soort] ?? COMPANION_SOORTEN.raaf;
  const out: Kunstje[] = [];
  const upto = FASE_ORDER.indexOf(fase);
  for (const f of FASE_ORDER) {
    const k = cfg.kunstjeBijFase[f];
    if (FASE_ORDER.indexOf(f) <= upto && k) out.push(k);
  }
  return out;
}

export function mergeCompanion(saved: unknown): Companion {
  const base = blankCompanion();
  if (saved && typeof saved === 'object') Object.assign(base, saved as Partial<Companion>);
  // re-derive invariants so a hand-edited / stale save can never desync fase↔kunstjes
  base.fase = FASE_ORDER.includes(base.fase) ? base.fase : 'baby';
  base.bond = clamp(base.bond ?? 0, 0, 100);
  base.kunstjes = kunstjesVoorFase(base.soort, base.fase);
  return base;
}

export function mergeRehab(saved: unknown): Rehab {
  const base = blankRehab();
  if (saved && typeof saved === 'object') Object.assign(base, saved as Partial<Rehab>);
  base.releasedCount = Math.max(0, base.releasedCount | 0);
  return base;
}

/** Rescue: the companion becomes baby with a starting bond, named if given. Pure. */
export function applyRescue(prev: Companion | undefined, naam?: string): Companion {
  const c: Companion = { ...(prev ?? blankCompanion()), rescued: true, fase: 'baby', bond: 12 };
  if (naam) c.naam = naam;
  c.kunstjes = kunstjesVoorFase(c.soort, c.fase);
  return c;
}

/** Care raises the bond; fase NEVER regresses; growing past baby makes the friend join.
 *  Returns the next companion + whether a new fase was reached (for the celebration). Pure. */
export function applyBond(prev: Companion | undefined, delta: number): { companion: Companion; grew: boolean } {
  const c: Companion = { ...(prev ?? blankCompanion()) };
  c.bond = clamp((c.bond || 0) + delta, 0, 100);
  const want = faseVoorBond(c.bond);
  const newIdx = Math.max(FASE_ORDER.indexOf(c.fase), FASE_ORDER.indexOf(want)); // monotone: never regress
  const newFase = FASE_ORDER[newIdx];
  const grew = newFase !== c.fase;
  c.fase = newFase;
  c.kunstjes = kunstjesVoorFase(c.soort, c.fase);
  if (grew && c.fase !== 'baby') c.meeOpMissie = true; // friend joins once it's strong
  return { companion: c, grew };
}

/** Bond delta for a finished care round: full if clean, reduced if order/over-handling slipped. */
export function careBondDelta(orderMiss: number, knuffelMiss: number): number {
  return 12 - (orderMiss > 0 || knuffelMiss > 0 ? 4 : 0);
}

export function applyStartRehab(prev: Rehab | undefined, gast: OpvangGast): Rehab {
  return { ...(prev ?? blankRehab()), active: true, dier: gast.dier, reden: gast.reden };
}

/** Release: clear the guest, count it. Help AND let go. Pure. */
export function applyReleaseRehab(prev: Rehab | undefined): Rehab {
  const r = prev ?? blankRehab();
  return { active: false, dier: null, reden: null, releasedCount: (r.releasedCount || 0) + 1 };
}
