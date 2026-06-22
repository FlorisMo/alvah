/**
 * types.ts — TypeScript shapes for the content registry (HANDOFF §3b).
 * Deliberately permissive: the hand-authored data in veluwe.ts is the
 * source of truth, typed at the registry boundary. The 5 EF engines are
 * fixed; everything else (animals, skins, missions, areas) is data.
 */

export type EfId = 'zoeken' | 'corsi' | 'simon' | 'dagnacht' | 'wisselen';

export interface Animal {
  id: string;
  naam: string;
  simpelWoord?: string;
  vaktermen?: Record<string, string>;
  geluid?: string;
  toonVeilig?: boolean;
  feiten?: string[];
  veiligheid?: string[];
}

export interface Distractor {
  id: string;
  x: number;
  y: number;
  k: string;          // 'bush' | 'bird' | 'butterfly' | …
  animal?: string;    // animal id, for the label
}

export interface StepCopy {
  instructie?: string;
  instructieKnap?: string;
  goed?: string;
  opnieuw?: string;
  toon?: string;
  terug?: string;
  luister?: string;
  echo?: string;
  regel?: string;
  regelOm?: string;
}

/** A research-true presentation over one EF mechanic. Engine-specific extras
 *  are allowed via the index signature; each engine reads what it needs. */
export interface Skin {
  dier?: string;
  term?: string;
  simpelWoord?: string;
  copy?: StepCopy;
  doel?: { x: number; y: number };
  distractors?: Distractor[];
  feit?: string;
  feitDier?: string;
  dieren?: string[];
  dagDieren?: string[];
  nachtDieren?: string[];
  regels?: string[];
  encounters?: unknown[];
  metgezel?: string;
  trials?: number;
  [key: string]: unknown;
}

export interface Step {
  ef: EfId;
  skin: Skin;
  moeilijkheid?: Record<string, unknown>;
}

export interface Beloning {
  badgeId: string;
  badgeNaam: string;
  vaktermBadge?: { id: string; naam: string };
}

export interface Briefing {
  simpel: string[];
  knap?: string[];
}

export interface Mission {
  id: string;
  titel: string;
  landschap: string;
  dier?: string;
  status?: string;
  verhaalHaak?: string;
  payoff?: string;
  kort?: string;
  briefing: Briefing;
  beloning: Beloning;
  reunion?: { sprite?: string; tekst?: string };
  stappen: Step[];
}

export interface Clue {
  id: string;
  soort: string;
  hoofdstuk: number;
  seizoen: string;
  titel: string;
  tekst: string;
  seizoenNa?: string;
  hoofdstukNa?: number;
}

export interface Hoofdstuk {
  n: number;
  seizoen: string;
  naam: string;
  clue: string | null;
  missies: string[];
}

export interface Verhaalboog {
  antagonist: { kind: string; naam: string };
  clues: Record<string, Clue>;
  hoofdstukken: Hoofdstuk[];
  ontknoping: { id: string; tekst: string }[];
}

export interface Area {
  id: string;
  naam: string;
  status: string;
  mapPin: { x: number; y: number };
  tijdVanDag?: string;
  palette?: { accent: string; land: string };
  landschappen: string[];
  vlaggenschipDieren: string[];
  verhaalboog?: Verhaalboog;
  missies: Mission[];
}
