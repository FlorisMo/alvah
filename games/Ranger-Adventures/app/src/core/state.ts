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
  grewBand,
  skillFloor,
  SKILL_MIN,
  type Engine,
  type SkillSet,
  type SkillRecord,
  type BeatSummary,
  knobsFor,
  knobsFromDifficulty,
  type EngineKnobs,
} from './skill.ts';
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
} from './companion.ts';
import {
  blankAvatar,
  mergeAvatar,
  applyAvatar,
  type Avatar,
} from './avatar.ts';
import { addVeldnotitie } from './veldnotitie.ts';
import { migrateGeleerd, type Geleerd } from './lessons.ts';
import {
  STORAGE_KEY,
  LEGACY_KEY,
  readRangerPartial,
  writeRangerRoot,
} from './persist.ts';
import { compactVariant, type Play } from './play.ts';
import { nextRareCount } from './discover.ts';
import { isMood, type MoodId } from '../render3d/Moods.ts';

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
  joystick: 'auto' | 'aan' | 'uit';  // on-screen joystick visibility (W1.3): auto = coarse pointer
  cameraDraaitMee: boolean;          // W1.5 rotating follow-cam: camera eases behind as you turn
  helikopter: boolean;               // W5.3 opt-in helicopter mode (default UIT; unavailable under reduced-motion)
  geleerd: Geleerd;                  // run 6: the first minute's steps learned or told for good (core/lessons.ts); replaces wereldHintGezien/tikHintGezien
  kwaliteitTier: 'hoog' | 'laag';    // W7.2 adaptive quality tier — the last fps-probe verdict, persisted so a slow device boots light
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
  veldnotities: Record<string, boolean>; // W6.3b: collected "Wist je dat" veldnotitie ids (content-derived)
  recentGroei: Engine[];             // engines whose level crossed a whole number (a step he feels): the reward card's calm "groeit", cleared when shown
  skill: SkillSet;                   // per-engine skill record — drives difficulty + badges
  knapWoorden: Record<string, { naam: string }>; // earned "knap-woord" badges
  arc: ArcState;                     // season/poacher arc — found clues are DERIVED from voltooid
  companion: Companion;              // metgezel: rescue → care → grow → mee (HANDOFF §7.2)
  rehab: Rehab;                      // recurring opvang-and-release loop
  companionGroei: Fase | null;      // fase the companion just reached (for the cabin celebration)
  avatar: Avatar;                    // the player-ranger identity (naam threads into copy/voice)
  avatarGemaakt: boolean;            // has the ranger been made? (gates the boot creator)
  settings: Settings;
  /* ---- run 7 (design §4.3-4.5): all additive, defaulted in hydrate() for an older save ---- */
  geschiedenis: BeatLog[];           // every logged beat, newest last, at most HISTORY_MAX: his growth over weeks
  ontdekt: Record<string, { t: number; n: number }>; // discoveries (content/ontdekkingen ids): first time, times seen
  zeldzaam: Record<string, number>;  // per home: won plays since its last rare (the pity rule, core/discover.ts)
  gespeeld: Record<string, number>;  // per mission: plays started ("Ga op pad"); a play's n is this + 1
  sfeer: { laatste: MoodId | null; sessies: number }; // the last session's mood, sessions so far
}

/** One logged beat (design §4.3): what was played, at which level, from which play. ~150
 *  bytes; the history keeps the newest HISTORY_MAX. */
export interface BeatLog {
  /** Date.now() */
  t: number;
  e: Engine;
  /** the mission id ('' for the hut) */
  m: string;
  /** the adventure, the classic 3D stage, or the 2D floor */
  w: 'world' | 'stage' | '2d';
  /** the level it started at (2 decimals) */
  lv: number;
  /** trials, correct */
  n: number;
  c: number;
  /** span, start (corsi, simon); misses, seconds (zoeken); the longest hold in s (dagnacht) */
  sp?: number;
  st?: number;
  ms?: number;
  s?: number;
  h?: number;
  /** the play's seed (0 outside a mission) */
  sd: number;
  /** the play's variant, compact ('hide:b,order:2,mood:gouden-uur') */
  va?: string;
}

/** The history keeps this many beats (~60 KB): months of play. */
export const HISTORY_MAX = 400;

/** Where a beat was played and in which play (`store.logBeat`). */
export interface BeatMeta {
  missionId: string;
  view: BeatLog['w'];
  play: Play | null;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** The history entry for a beat (pure: `level` is the record's level BEFORE the update). */
export function beatLog(engine: Engine, summary: BeatSummary, meta: BeatMeta, level: number, now: number): BeatLog {
  const n = Math.max(1, summary.trials ?? 1);
  const c = summary.correct != null ? summary.correct : (summary.success ? n : 0);
  const log: BeatLog = { t: now, e: engine, m: meta.missionId, w: meta.view, lv: r2(level), n, c, sd: meta.play?.seed ?? 0 };
  if (summary.span != null) log.sp = summary.span;
  if (summary.start != null) log.st = summary.start;
  if (summary.misses != null) log.ms = summary.misses;
  if (summary.seconds != null) log.s = Math.round(summary.seconds * 10) / 10;
  if (summary.holdS != null) log.h = Math.round(summary.holdS * 10) / 10;
  const va = meta.play ? compactVariant(meta.play.variant) : undefined;
  if (va) log.va = va;
  return log;
}

/** The history with one more beat, the oldest dropped past `max`. */
export function appendBeat(history: readonly BeatLog[], log: BeatLog, max = HISTORY_MAX): BeatLog[] {
  const next = [...history, log];
  return next.length > max ? next.slice(next.length - max) : next;
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
  joystick: 'auto',
  cameraDraaitMee: true,
  helikopter: false,
  geleerd: {},
  kwaliteitTier: 'hoog',
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
    veldnotities: {},
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
    geschiedenis: [],
    ontdekt: {},
    zeldzaam: {},
    gespeeld: {},
    sfeer: { laatste: null, sessies: 0 },
  };
}

export const DEFAULT_STATE: GameState = freshState();

/** A plain object from the save, or {} (a missing or broken field never breaks a load). */
function record<T>(v: unknown): Record<string, T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {};
}

/**
 * A parsed save (any age) over a fresh state: every field an older save lacks gets its
 * default, every field it has is kept (migration-safe, additive). Pure: `load()` reads
 * localStorage and hands the parsed `ranger` namespace here.
 */
export function hydrate(parsed: Partial<GameState> | null): GameState {
  if (!parsed) return freshState();
  const sfeer = record<unknown>(parsed.sfeer);
  return {
    ...freshState(),
    ...parsed,
    skill: mergeSkill(parsed.skill),
    voltooid: parsed.voltooid ?? {},
    veldnotities: parsed.veldnotities ?? {},
    recentGroei: parsed.recentGroei ?? [],
    knapWoorden: parsed.knapWoorden ?? {},
    arc: { gemeld: false, ...(parsed.arc ?? {}) },
    companion: mergeCompanion(parsed.companion),
    rehab: mergeRehab(parsed.rehab),
    companionGroei: parsed.companionGroei ?? null,
    avatar: mergeAvatar(parsed.avatar),
    avatarGemaakt: parsed.avatarGemaakt ?? false,
    settings: loadSettings(parsed.settings),
    // run 7
    geschiedenis: Array.isArray(parsed.geschiedenis) ? parsed.geschiedenis.slice(-HISTORY_MAX) : [],
    ontdekt: record(parsed.ontdekt),
    zeldzaam: record(parsed.zeldzaam),
    gespeeld: record(parsed.gespeeld),
    sfeer: {
      laatste: isMood(sfeer.laatste) ? sfeer.laatste : null,
      sessies: typeof sfeer.sessies === 'number' && sfeer.sessies >= 0 ? Math.floor(sfeer.sessies) : 0,
    },
  };
}

function load(): GameState {
  try {
    return hydrate(readRangerPartial(
      localStorage.getItem(STORAGE_KEY),
      localStorage.getItem(LEGACY_KEY),
    ) as Partial<GameState> | null);
  } catch {
    return freshState();
  }
}

/** Set when the save still held the old one-off hint flags: the store writes the
 *  migrated save back at once (so they are gone from `alvah-ef-v1` from this boot on). */
let migratedOnLoad = false;

/** The saved settings over the defaults. The old one-off hint flags become learned steps
 *  (core/lessons.migrateGeleerd) and are dropped, so they are never written back. */
function loadSettings(saved: Partial<Settings> | undefined): Settings {
  const raw = (saved ?? {}) as Partial<Settings> & { wereldHintGezien?: boolean; tikHintGezien?: boolean; renHintGezien?: boolean };
  const { wereldHintGezien: _w, tikHintGezien: _t, renHintGezien: _r, ...rest } = raw;
  if (_w !== undefined || _t !== undefined || _r !== undefined) migratedOnLoad = true;
  return { ...DEFAULT_SETTINGS, ...rest, geleerd: migrateGeleerd(raw) };
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

  constructor() {
    if (migratedOnLoad) save(this.state); // the old hint flags leave the save now
  }

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

  /** A first-minute step is learned (a lesson done) or told (Bram's beat), for good. */
  learn(id: keyof Geleerd): void {
    if (this.state.settings.geleerd[id]) return;
    this.setSetting({ geleerd: { ...this.state.settings.geleerd, [id]: true } });
  }

  go(screen: Screen): void {
    this.set({ screen });
  }

  setStep(worldStep: number): void {
    this.set({ worldStep });
  }

  /** A mission is done; its "knap woord" (the reward card names it) is earned for good. */
  markMissionDone(missieId: string, knapWoord?: { id: string; naam: string }): void {
    const knapWoorden = knapWoord && !this.state.knapWoorden[knapWoord.id]
      ? { ...this.state.knapWoorden, [knapWoord.id]: { naam: knapWoord.naam } }
      : this.state.knapWoorden;
    this.commit({ ...this.state, voltooid: { ...this.state.voltooid, [missieId]: true }, knapWoorden });
  }

  /** W6.3b: pin a "Wist je dat"-veldnotitie to the case-board. Idempotent (a
   *  replay never re-pins) — the pure model returns the same ref on a no-op, so
   *  the commit (and its listeners) is skipped and the board stays quiet. */
  collectVeldnotitie(id: string): void {
    const next = addVeldnotitie(this.state.veldnotities, id);
    if (next === this.state.veldnotities) return;
    this.commit({ ...this.state, veldnotities: next });
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

  /**
   * Run 7 (design §4.3, §5.1): an engine finished a beat → it goes into the history (what
   * was played, at which level, in which play and view), then its skill record is judged by
   * its own engine (core/skill.ts `updateSkill`: an easy win a whole step up, a hard one
   * half a step down, silently, never under the floor). A level that crossed a whole number
   * marks the engine for the reward card's calm "groeit". One commit.
   */
  logBeat(engine: Engine, summary: BeatSummary, meta: BeatMeta): void {
    const skill: SkillSet = { ...this.state.skill };
    const before = (skill[engine] ?? blankSkill()).level;
    const geschiedenis = appendBeat(this.state.geschiedenis, beatLog(engine, summary, meta, before, Date.now()));
    const updated = updateSkill(skill[engine], summary, engine);
    skill[engine] = updated;
    const grew = grewBand(before, updated.level);
    const recentGroei = grew
      ? Array.from(new Set<Engine>([...this.state.recentGroei, engine]))
      : this.state.recentGroei;
    this.commit({ ...this.state, skill, recentGroei, geschiedenis });
  }

  /** A beat outside a mission (the hut's care game): logged as a 2D beat without a play. */
  logSession(engine: Engine, summary: BeatSummary): void {
    this.logBeat(engine, summary, { missionId: '', view: '2d', play: null });
  }

  /** Run 7 (§4.2): the live level of a breinkracht (where its next beat starts). */
  level(engine: Engine): number {
    return (this.state.skill[engine] ?? blankSkill()).level;
  }

  /** Run 7 (§4.2): the knobs its views read now; with "automatisch" off, the manual settings. */
  knobs<E extends Engine>(engine: E): EngineKnobs[E] {
    const s = this.state;
    return s.settings.autoMoeilijk ? knobsFor(engine, this.level(engine)) : knobsFromDifficulty(engine, s.settings);
  }

  /** Run 7 (§4.4): he saw or heard it. Recorded (first time, times seen); true when new. */
  discover(id: string): boolean {
    const was = this.state.ontdekt[id];
    const ontdekt = { ...this.state.ontdekt, [id]: { t: was?.t ?? Date.now(), n: (was?.n ?? 0) + 1 } };
    this.commit({ ...this.state, ontdekt });
    return !was;
  }

  /** Run 7: a play of this mission starts ("Ga op pad"). Returns how many plays it has now. */
  notePlay(missionId: string): number {
    const n = (this.state.gespeeld[missionId] ?? 0) + 1;
    this.commit({ ...this.state, gespeeld: { ...this.state.gespeeld, [missionId]: n } });
    return n;
  }

  /** Run 7: a play of a home ended: its rare counter (the pity rule, core/discover.ts) goes
   *  back to 0 when he discovered a rare of that home in it, one up when it was won. */
  rareEnd(home: string, gotRare: boolean, won = true): void {
    const was = this.state.zeldzaam[home] ?? 0;
    const next = nextRareCount(was, { won, gotRare });
    if (next === was && home in this.state.zeldzaam) return;
    this.commit({ ...this.state, zeldzaam: { ...this.state.zeldzaam, [home]: next } });
  }

  /** Run 7 (§4.5): a session began in this mood (once per page load). */
  noteSession(mood: MoodId): void {
    this.commit({ ...this.state, sfeer: { laatste: mood, sessies: this.state.sfeer.sessies + 1 } });
  }

  /** Child-/frustration-driven ease: lower the live level a touch (silent, never the best,
   *  never under the floor: one step under his best). */
  easeEngine(engine: Engine): void {
    const skill: SkillSet = { ...this.state.skill };
    const rec: SkillRecord = { ...(skill[engine] ?? blankSkill()) };
    rec.level = Math.max(skillFloor(rec.best), rec.level - 0.5);
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
