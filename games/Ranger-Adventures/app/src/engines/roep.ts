/**
 * roep.ts — perceptie-slice "Ken je roep" (Engine-01), de render-agnostische
 * taaklogica. Een vogel roept; het kind kiest wélke vogel dat was uit een rij
 * met afleiders. Het is een auditieve herken-taak die ook met gedempt geluid
 * speelbaar blijft: elke vogel draagt zijn roep óók als korte tekst (dubbel
 * kanaal, dyslexie-vriendelijk, nooit alleen-audio).
 *
 * Difficulty schaalt via een reversal-STAIRCASE over het aantal afleiders (het
 * `skill.ts`-patroon): goed antwoord → één afleider erbij, mis → één eraf, altijd
 * geklemd op [1, pool-1]. Nooit game-over: elke ronde wordt één keer beoordeeld en
 * de beat loopt altijd alle ronden uit. De render-laag (2D `render2d/RoepView`, en
 * later de diegetische 3D-twin in W6.4b) speelt de roep + tekent de rij en deelt
 * exact deze pure kern, zodat beide views een IDENTIEKE `BeatSummary` opleveren
 * (construct-pariteit, BUILD-PLAN §1f). De roep-teksten komen uit het
 * W3.4b-vogeldossier (`research/bird-visual-accuracy.md`).
 */

import type { BeatSummary } from '../core/skill';

export interface RoepVogel {
  id: string;
  naam: string;
  /** korte, kindvriendelijke omschrijving van de roep (M3/E3, ≤7 woorden per zin) */
  roep: string;
}

/**
 * De vogelpool voor de staircase — zes soorten met een onmiskenbare, uit elkaar
 * te houden roep (dossier W3.4b). Zelfstandig hier zodat de slice geen
 * content-koppeling nodig heeft; de echte opgenomen roepen landen via de
 * audio-pijplijn (W6.4b/W4.7b, `Sound.registerCall` — zero-rework).
 */
export const ROEP_VOGELS: readonly RoepVogel[] = [
  { id: 'raaf',            naam: 'raaf',            roep: 'Krok krok. Diep en laag.' },
  { id: 'koekoek',         naam: 'koekoek',         roep: 'Koekoek. Eerst hoog, dan laag.' },
  { id: 'merel',           naam: 'merel',           roep: 'Een mooi fluitliedje.' },
  { id: 'roodborsttapuit', naam: 'roodborsttapuit', roep: 'Tik tik. Net twee steentjes.' },
  { id: 'groene-specht',   naam: 'groene specht',   roep: 'Kju kju kju. Een lachje.' },
  { id: 'koolmees',        naam: 'koolmees',        roep: 'Ti ta ti ta. Als een pompje.' },
];

/** Player-facing UI-tekst — één bron van waarheid, meegenomen in de readlevel-corpus.
 *  Elke nieuwe zin loopt zo automatisch door de M3/E3-toon-gate (`readlevel.test`),
 *  inclusief de wereld-entree (`zit`) en de 2D-startknop (`start`) van W6.4/W6.5. */
export const ROEP_COPY = {
  instructie: 'Welke vogel roept zo?',
  luister: 'Luister goed.',
  opnieuw: 'Nog een keer.',
  goed: 'Goed geluisterd!',
  mis: 'Luister nog eens.',
  klaar: 'Knap gedaan!',
  zit: 'Luister naar de vogels',
  start: 'Luister',
  wayfinding: 'Zitplek · luister',
} as const;

export interface RoepDiff {
  /** afleiders in de eerste ronde (naast de juiste vogel) */
  afleiders?: number;
  /** aantal luister→kies ronden in de beat */
  ronden?: number;
}

export interface RoepTrial {
  vogels: RoepVogel[];    // de beschikbare soorten (de rij-kandidaten)
  ronden: number;         // aantal ronden in de beat
  startAfleiders: number; // afleiders in ronde 1
}

export interface RoepRound {
  target: string;   // de roepende vogel (id)
  opties: string[]; // de rij: target + afleiders, geschud
}

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(v)));

/** Fisher–Yates met geïnjecteerde rng (puur + deterministisch onder een seed). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Resolve de pool + het startniveau van de staircase uit de difficulty. */
export function buildRoepTrial(diff: RoepDiff = {}): RoepTrial {
  const vogels = ROEP_VOGELS.slice();
  const ronden = clampInt(diff.ronden ?? 5, 3, 8);
  const startAfleiders = clampInt(diff.afleiders ?? 1, 1, vogels.length - 1);
  return { vogels, ronden, startAfleiders };
}

/**
 * RoepRun — de pure staircase-kern die BEIDE views delen. Per ronde roept één
 * vogel (`next()` levert target + de geschudde rij met `afleiders` afleiders); het
 * kind antwoordt met `answer(id)`. Goed → één afleider moeilijker, mis → één
 * makkelijker (reversal-staircase, `skill.ts`-patroon), altijd geklemd op
 * [1, pool-1]. Elke ronde telt één keer mee; na `ronden` antwoorden is de beat
 * klaar. De score is gegradeerd: `trials` = ronden, `correct` = aantal juist —
 * exact de bevroren regel die de 3D-twin (W6.4b) straks ook draait.
 */
export class RoepRun {
  private readonly vogels: RoepVogel[];
  private readonly ronden: number;
  private readonly rng: () => number;
  private afleidersNu: number;
  private started = 0;
  private answered = 0;
  private correctCount = 0;
  private currentTarget: string | null = null;
  private lastDir = 0;
  private reversalCount = 0;

  constructor(trial: RoepTrial, rng: () => number = Math.random) {
    this.vogels = trial.vogels;
    this.ronden = Math.max(1, trial.ronden);
    this.afleidersNu = clampInt(trial.startAfleiders, 1, this.vogels.length - 1);
    this.rng = rng;
  }

  /** aantal afleiders in de KOMENDE ronde (voor de view / het staircase-inzicht) */
  get afleiders(): number { return this.afleidersNu; }

  /** hoeveel ronden al beantwoord zijn (0..ronden) */
  get roundIndex(): number { return this.answered; }

  /** aantal richting-omkeringen in de staircase (up↔down) */
  get reversals(): number { return this.reversalCount; }

  /** de hele beat is uitgespeeld */
  get finished(): boolean { return this.answered >= this.ronden; }

  /**
   * Start de volgende ronde: kies een roepende vogel en bouw de rij (target +
   * `afleiders` verschillende afleiders, geschud). `null` als de beat klaar is of
   * de vorige ronde nog niet beantwoord is.
   */
  next(): RoepRound | null {
    if (this.started >= this.ronden) return null;
    if (this.currentTarget !== null) return null; // vorige ronde nog open
    const target = this.vogels[Math.floor(this.rng() * this.vogels.length)].id;
    const rest = this.vogels.filter((v) => v.id !== target).map((v) => v.id);
    const decoys = shuffle(rest, this.rng).slice(0, this.afleidersNu);
    const opties = shuffle([target, ...decoys], this.rng);
    this.currentTarget = target;
    this.started += 1;
    return { target, opties };
  }

  /**
   * Beoordeel het antwoord op de lopende ronde en verzet de staircase. Altijd
   * herstelbaar: een mis eindigt niets, hij maakt de volgende ronde alleen
   * makkelijker. `'goed'` bij de juiste vogel, anders `'mis'`.
   */
  answer(id: string): 'goed' | 'mis' {
    if (this.currentTarget === null) return 'mis';
    const goed = id === this.currentTarget;
    this.currentTarget = null;
    this.answered += 1;
    if (goed) this.correctCount += 1;
    const dir = goed ? 1 : -1;
    if (this.lastDir !== 0 && dir !== this.lastDir) this.reversalCount += 1;
    this.lastDir = dir;
    this.afleidersNu = clampInt(this.afleidersNu + dir, 1, this.vogels.length - 1);
    return goed ? 'goed' : 'mis';
  }

  /** de pariteits-bevroren samenvatting: trials = ronden, correct = aantal juist. */
  summary(): BeatSummary {
    return { trials: this.ronden, correct: this.correctCount };
  }
}
