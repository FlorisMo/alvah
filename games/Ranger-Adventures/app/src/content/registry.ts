/**
 * registry.ts — area registry + Content accessors (ported from
 * prototype/content.jsx). The hand-authored, prototype-proven data in
 * veluwe.ts is typed at THIS trust boundary (one cast), so everything
 * downstream is cleanly typed. Adding an area = a new data file + a row here.
 */

import { AREA_VELUWE as RAW_VELUWE, ANIMALS as RAW_ANIMALS } from './veluwe';
import type { Area, Animal, Mission, Step, Verhaalboog, Clue, Hoofdstuk } from './types';

const AREA_VELUWE = RAW_VELUWE as unknown as Area;
const ANIMALS = RAW_ANIMALS as unknown as Record<string, Animal>;

const AREAS: Area[] = [
  AREA_VELUWE,
  { id: 'wadden',    naam: 'Wadden',    status: 'binnenkort', mapPin: { x: 38, y: 20 }, landschappen: ['wad', 'kwelder'],     vlaggenschipDieren: ['zeehond'], missies: [] },
  { id: 'biesbosch', naam: 'Biesbosch', status: 'binnenkort', mapPin: { x: 30, y: 74 }, landschappen: ['rivier', 'wilgenbos'], vlaggenschipDieren: ['bever'],   missies: [] },
  { id: 'duinen',    naam: 'Duinen',    status: 'binnenkort', mapPin: { x: 16, y: 46 }, landschappen: ['duin'],                vlaggenschipDieren: ['konijn'],  missies: [] },
];

const EF_TITEL: Record<string, string> = {
  zoeken: 'Zoek het dier in het gras.',
  corsi: 'Onthoud de weg.',
  dagnacht: 'Blijf rustig. Kies veilig.',
  simon: 'Doe de stappen na.',
  wisselen: 'Sorteer goed.',
};

export const Content = {
  areas: (): Area[] => AREAS,
  area: (id: string): Area | null => AREAS.find((a) => a.id === id) ?? null,
  activeArea: (): Area => AREAS.find((a) => a.status === 'actief') ?? AREAS[0],

  missions: (areaId: string): Mission[] => Content.area(areaId)?.missies ?? [],
  mission: (areaId: string, missieId: string): Mission | null => {
    const a = Content.area(areaId);
    if (!a) return null;
    return a.missies.find((m) => m.id === missieId) ?? a.missies[0] ?? null;
  },
  firstActiveMission: (areaId: string): Mission | null => {
    const a = Content.area(areaId);
    if (!a) return null;
    return a.missies.find((m) => m.status === 'actief') ?? a.missies[0] ?? null;
  },

  // a step config inside a mission (1-indexed)
  step: (areaId: string, missieId: string, stepN: number): Step | null => {
    const m = Content.mission(areaId, missieId);
    return m?.stappen?.[stepN - 1] ?? null;
  },

  animal: (id: string): Animal | null => ANIMALS[id] ?? null,

  // ---- season/poacher arc (case-board) -----------------------------------
  verhaalboog: (areaId: string): Verhaalboog | null => Content.area(areaId)?.verhaalboog ?? null,

  /** Clues in story order (chapter, then declaration order). */
  clues: (areaId: string): Clue[] => {
    const vb = Content.verhaalboog(areaId);
    if (!vb) return [];
    return Object.values(vb.clues).sort((a, b) => a.hoofdstuk - b.hoofdstuk);
  },

  /**
   * The data gate (BUILD-PLAN §5 "arc advances by data gates"): a clue is FOUND
   * when any mission tagged `verhaalHaak === clue.id` is completed. Pure — same
   * inputs always give the same found-set, so the case-board never drifts from
   * the player's actual progress. Returns the set of found clue ids.
   */
  cluesFound: (areaId: string, voltooid: Record<string, boolean>): Set<string> => {
    const a = Content.area(areaId);
    if (!a) return new Set();
    const found = new Set<string>();
    for (const m of a.missies) {
      if (m.verhaalHaak && voltooid[m.id]) found.add(m.verhaalHaak);
    }
    return found;
  },

  /** The chapter the player is currently in = last chapter whose clue is found,
   *  else the first chapter. Drives the prikbord season label. */
  currentChapter: (areaId: string, voltooid: Record<string, boolean>): Hoofdstuk | null => {
    const vb = Content.verhaalboog(areaId);
    if (!vb?.hoofdstukken.length) return null;
    const found = Content.cluesFound(areaId, voltooid);
    let cur = vb.hoofdstukken[0];
    for (const h of vb.hoofdstukken) {
      if (h.clue && found.has(h.clue)) cur = h;
    }
    return cur;
  },

  // jargon helper: simple word vs "knap woord"
  pick: (simpel: string, knap: string | undefined, jargon: boolean): string =>
    jargon && knap ? knap : simpel,

  efTitel: (ef: string): string => EF_TITEL[ef] ?? 'Ranger-taak',
};
