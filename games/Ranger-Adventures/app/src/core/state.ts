/**
 * state.ts — render-agnostic game state, persistence, and the difficulty
 * resolver (ported from prototype/state.jsx + the skill hook). The prototype's
 * React Context/useState shell is replaced by a tiny framework-free observable
 * store: render layers `subscribe()` and call mutators. Persistence now
 * co-tenants the site-wide `alvah-ef-v1` key under a `ranger` namespace (see
 * persist.ts) — migrated from the legacy standalone `ranger-mvp-state` key —
 * with the same mutation semantics.
 *
 * Scope note: season-arc (`arc`) and companion/rehab (`companion`/`rehab`) state
 * are now wired (Phase 3); the pure companion model lives in companion.ts. Vehicle-
 * damage state stays deferred. load() tolerates extra persisted fields.
 */

import {
  EF_ENGINES,
  blankSkill,
  blankSkillSet,
  mergeSkill,
  updateSkill,
  knobsForLevel,
  SKILL_MIN,
  type Engine,
  type SkillSet,
  type SkillRecord,
  type BeatSummary,
} from './skill';
import {
  blankCompanion,
  blankRehab,
  mergeCompanion,
  mergeRehab,
  applyRescue,
  applyBond,
  applyStartRehab,
  applyReleaseRehab,
  type Companion,
  type Rehab,
  type Fase,
  type OpvangGast,
} from './companion';
import {
  blankAvatar,
  mergeAvatar,
  applyAvatar,
  type Avatar,
} from './avatar';
import {
  STORAGE_KEY,
  LEGACY_KEY,
  readRangerPartial,
  writeRangerRoot,
} from './persist';

export type Screen =
  | 'map' | 'cabin' | 'transport' | 'travel' | 'briefing' | 'world' | 'reunion' | 'complete';

export interface Settings {
  geluid: boolean;
  voorlezen: boolean;
  reducedMotion: boolean;            // in-game toggle (OS query handled in reduced-motion.ts)
  gevolgErnst: 'stevig' | 'mild' | 'assist';
  autoMoeilijk: boolean;             // adaptive staircase on vs. raw manual sliders
  jargon: boolean;                   // "knappe woorden" (frisling/rotte) vs simple (big/groep)
  leesFont: boolean;                 // Atkinson Hyperlegible leesletter (alternate, not the default)
  force2d: boolean;                  // Tweak "altijd 2D" — force the 2D floor for every activity
  skipBriefings: boolean;            // demo-skip (§9g): jump straight into play, no briefing card
  readSize: number;
  leading: number;
  ambient: number;
  accent: string;
  // difficulty knobs (the staircase turns these; also the manual Tweak sliders)
  lensSterkte: number;
  afleiders: number;
  spoorLengte: number;               // zoeken tracking leg: clue-count (separate axis, never trims decoys)
  spoorHelderheid: number;           // zoeken tracking leg: trail clarity 0..1 (separate axis)
  routeLengte: number;
  regelWissel: number;
  slowmo: boolean;
  simonLengte: number;
  wisselFreq: number;
  // travel mini-game (sfeer + agency, never a test)
  reisSnelheid: number;
  reisDichtheid: number;
  reisMagneet: boolean;
}

export interface GameState {
  screen: Screen;
  gebied: string;                    // active area id (content registry)
  missie: string;                    // active mission id within the area
  worldStep: number;                 // 1-indexed step within the mission
  eikels: number;                    // acorns collected (cosmetic reward)
  voltooid: Record<string, boolean>; // per-mission completion map
  recentGroei: Engine[];             // engines that grew this mission (for the celebration)
  skill: SkillSet;                   // per-engine skill record — drives difficulty + badges
  knapWoorden: Record<string, { naam: string }>; // earned "knap-woord" badges
  arc: ArcState;                     // season/poacher arc — found clues are DERIVED from voltooid
  companion: Companion;              // metgezel: rescue → care → grow → mee (HANDOFF §7.2)
  rehab: Rehab;                      // recurring opvang-and-release loop
  companionGroei: Fase | null;      // fase the companion just reached (for the cabin celebration)
  avatar: Avatar;                    // the player-ranger identity (naam threads into copy/voice)
  avatarGemaakt: boolean;            // has the ranger been made? (gates the boot creator)
  settings: Settings;
}

/** Season-arc state. Which clues are found is derived from completed verhaalHaak
 *  missions (a pure data gate, BUILD-PLAN §5) — only the player's "report to the
 *  BOA" act is persisted here, so the resolution stays sticky. */
export interface ArcState {
  gemeld: boolean;                   // the poacher was reported → hopeful resolution shown
}

/** Alvah profile (BUILD-PLAN §3): consequences default MILD, adaptive difficulty on,
 *  simple words by default, dyslexia-friendly reading. */
const DEFAULT_SETTINGS: Settings = {
  geluid: true,
  voorlezen: true,
  reducedMotion: false,
  gevolgErnst: 'mild',
  autoMoeilijk: true,
  jargon: false,
  leesFont: true,
  force2d: false,
  skipBriefings: false,
  readSize: 28,
  leading: 1.7,
  ambient: 0.85,
  accent: '#f5c23b',
  lensSterkte: 0.6,
  afleiders: 4,
  spoorLengte: 3,
  spoorHelderheid: 0.7,
  routeLengte: 4,
  regelWissel: 0.4,
  slowmo: true,
  simonLengte: 3,
  wisselFreq: 0.4,
  reisSnelheid: 1,
  reisDichtheid: 1,
  reisMagneet: false,
};

function freshState(): GameState {
  return {
    screen: 'map',
    gebied: 'veluwe',
    missie: 'frisling',
    worldStep: 1,
    eikels: 0,
    voltooid: {},
    recentGroei: [],
    skill: blankSkillSet(),
    knapWoorden: {},
    arc: { gemeld: false },
    companion: blankCompanion(),
    rehab: blankRehab(),
    companionGroei: null,
    avatar: blankAvatar(),
    avatarGemaakt: false,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const DEFAULT_STATE: GameState = freshState();

function load(): GameState {
  try {
    const parsed = readRangerPartial(
      localStorage.getItem(STORAGE_KEY),
      localStorage.getItem(LEGACY_KEY),
    ) as Partial<GameState> | null;
    if (!parsed) return freshState();
    return {
      ...freshState(),
      ...parsed,
      skill: mergeSkill(parsed.skill),
      voltooid: parsed.voltooid ?? {},
      recentGroei: parsed.recentGroei ?? [],
      knapWoorden: parsed.knapWoorden ?? {},
      arc: { gemeld: false, ...(parsed.arc ?? {}) },
      companion: mergeCompanion(parsed.companion),
      rehab: mergeRehab(parsed.rehab),
      companionGroei: parsed.companionGroei ?? null,
      avatar: mergeAvatar(parsed.avatar),
      avatarGemaakt: parsed.avatarGemaakt ?? false,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return freshState();
  }
}

function save(state: GameState): void {
  try {
    // Read-modify-write the shared blob so the /spelen namespace survives, then
    // drop the legacy standalone key now that it's migrated into `ranger`.
    localStorage.setItem(STORAGE_KEY, writeRangerRoot(localStorage.getItem(STORAGE_KEY), state));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage full / unavailable — game stays playable, just unsaved */
  }
}

type Listener = (state: GameState) => void;

/** Tiny framework-free observable store. One instance, exported as `store`. */
class Store {
  private state: GameState = load();
  private readonly listeners = new Set<Listener>();

  get(): GameState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private commit(next: GameState): void {
    this.state = next;
    save(next);
    for (const fn of this.listeners) fn(next);
  }

  set(patch: Partial<GameState>): void {
    this.commit({ ...this.state, ...patch });
  }

  setSetting(patch: Partial<Settings>): void {
    this.commit({ ...this.state, settings: { ...this.state.settings, ...patch } });
  }

  go(screen: Screen): void {
    this.set({ screen });
  }

  setStep(worldStep: number): void {
    this.set({ worldStep });
  }

  markMissionDone(missieId: string): void {
    this.commit({ ...this.state, voltooid: { ...this.state.voltooid, [missieId]: true } });
  }

  /** Player reported the poacher to the BOA on the case-board → hopeful resolution. */
  reportArc(): void {
    this.commit({ ...this.state, arc: { ...this.state.arc, gemeld: true } });
  }

  /* ---- companion / metgezel (HANDOFF §7.2) — thin wrappers over companion.ts pure logic ---- */

  /** Rescue the companion (baby, starting bond), optionally naming it. */
  rescueCompanion(naam?: string): void {
    this.commit({ ...this.state, companion: applyRescue(this.state.companion, naam) });
  }

  /** Raise/lower the bond; fase never regresses; a new fase flags the celebration. */
  bondDelta(n: number): void {
    const { companion, grew } = applyBond(this.state.companion, n);
    this.commit({
      ...this.state,
      companion,
      companionGroei: grew ? companion.fase : this.state.companionGroei,
    });
  }

  clearCompanionGroei(): void {
    this.set({ companionGroei: null });
  }

  /* ---- avatar / ranger-identiteit (BUILD-PLAN §3) ---- */

  /** Apply a partial avatar change (each field validated by the pure model). */
  setAvatar(patch: Partial<Avatar>): void {
    this.commit({ ...this.state, avatar: applyAvatar(this.state.avatar, patch) });
  }

  /** The ranger is made → the boot creator won't show again (re-openable from the lodge). */
  markAvatarGemaakt(): void {
    this.set({ avatarGemaakt: true });
  }

  /* ---- rehab (opvang & loslaten) ---- */

  startRehab(gast: OpvangGast): void {
    this.commit({ ...this.state, rehab: applyStartRehab(this.state.rehab, gast) });
  }

  /** Help AND let go — clears the guest, counts the release (emotional-positive). */
  releaseRehab(): void {
    this.commit({ ...this.state, rehab: applyReleaseRehab(this.state.rehab) });
  }

  /** An engine finished a beat → feed its skill record (drives staircase + badges). */
  logSession(engine: Engine, summary: BeatSummary): void {
    const skill: SkillSet = { ...this.state.skill };
    const before = (skill[engine] ?? blankSkill()).level;
    const updated = updateSkill(skill[engine], summary);
    skill[engine] = updated;
    const grew = updated.level > before + 1e-3;
    const recentGroei = grew
      ? Array.from(new Set<Engine>([...this.state.recentGroei, engine]))
      : this.state.recentGroei;
    this.commit({ ...this.state, skill, recentGroei });
  }

  /** Child-/frustration-driven ease: lower the live level a touch (silent, never the best). */
  easeEngine(engine: Engine): void {
    const skill: SkillSet = { ...this.state.skill };
    const rec: SkillRecord = { ...(skill[engine] ?? blankSkill()) };
    rec.level = Math.max(1, rec.level - 0.5);
    skill[engine] = rec;
    this.commit({ ...this.state, skill });
  }

  /** Visible opt-in step-up ("Klaar voor een lastiger spoor?") — raises every engine a notch. */
  bumpSkill(delta = 0.6): void {
    const skill: SkillSet = { ...this.state.skill };
    for (const e of EF_ENGINES) {
      const rec: SkillRecord = { ...(skill[e] ?? blankSkill()) };
      rec.level = Math.min(6, rec.level + delta);
      rec.best = Math.max(rec.best, rec.level);
      skill[e] = rec;
    }
    this.commit({ ...this.state, skill });
  }

  clearGroei(): void {
    this.set({ recentGroei: [] });
  }

  resetSkill(): void {
    this.commit({ ...this.state, skill: blankSkillSet(), recentGroei: [] });
  }

  reset(): void {
    this.commit({ ...freshState(), settings: this.state.settings });
  }

  /**
   * Resolved difficulty for an engine (replaces the prototype's useEngineDifficulty).
   * Adaptive ON → the live skill level drives the knobs; OFF → raw manual sliders.
   * `ease` softens THIS attempt only (never persisted as a drop).
   */
  difficulty(engine: Engine, ease = 0): Settings {
    const s = this.state;
    if (!s.settings.autoMoeilijk) return s.settings;
    const rec = s.skill[engine] ?? blankSkill();
    const eff = Math.max(SKILL_MIN, rec.level - ease * 0.8);
    return { ...s.settings, ...knobsForLevel(engine, eff) };
  }
}

export const store = new Store();
