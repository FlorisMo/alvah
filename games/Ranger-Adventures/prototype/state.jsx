/* ============================================================
   state.jsx — game state machine, persistence, shared chrome
   ============================================================ */

const { useState, useEffect, useRef, useCallback, useContext, createContext } = React;

const STORAGE_KEY = 'ranger-mvp-state';
const SCREENS = ['map', 'cabin', 'transport', 'travel', 'briefing', 'world', 'reunion', 'complete'];

/* ---- consequence system (HANDOFF §6.3 / plan §12.5) ----
   Real, fixable stakes on EQUIPMENT/RESOURCES/TIME — never on the child's
   worth or an animal's safety. No game-over, no shaming, no score. */
const VEHICLE_IDS = ['auto', 'motor', 'heli'];
const REPAIR_KOST = 2;                                   // onderdelen spent per repair
const GEVOLG_SCHADE = { stevig: 22, mild: 11, assist: 0 }; // durability lost per hard hit
const SEIZOENEN = ['lente', 'zomer', 'herfst', 'winter'];

function blankVoertuig() { return { durability: 100, schade: 0, disabled: false }; }
function blankVoertuigen() { const o = {}; VEHICLE_IDS.forEach(id => (o[id] = blankVoertuig())); return o; }
function blankResources() { return { onderdelen: 2, budget: 0 }; }
function mergeVoertuigen(saved) {
  const base = blankVoertuigen();
  if (saved && typeof saved === 'object') VEHICLE_IDS.forEach(id => { if (saved[id]) base[id] = { ...base[id], ...saved[id] }; });
  return base;
}

/* ---- season-arc + case-board (HANDOFF §6.4 / §7.3 / plan §13.4) ---- */
function blankStory() {
  return {
    hoofdstuk: 1,
    seizoen: 'lente',
    clues: {},   // { [clueId]: 'found' } — dropped by missions tagged verhaalHaak
    antagonist: { kind: 'stroper', spotted: 0, caughtOnCamera: false, reported: false, reformed: false },
    restored: {},  // { [habitatId]: true } — the hopeful finale
  };
}
function mergeStory(saved) {
  const base = blankStory();
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base, ...saved,
    clues: { ...(saved.clues || {}) },
    antagonist: { ...base.antagonist, ...(saved.antagonist || {}) },
    restored: { ...(saved.restored || {}) },
  };
}

const DEFAULT_STATE = {
  screen: 'map',
  gebied: 'veluwe',        // active area id (content registry)
  missie: 'frisling',      // active mission id within the area
  worldStep: 1,            // 1 spot · 2 route · 3 danger
  gekozenVervoer: null,    // 'auto' | 'motor' | 'heli'
  eikels: 0,               // total acorns collected on travel runs (cosmetic reward)
  badgeVerdiend: false,
  missieKlaar: false,
  voltooid: {},            // per-mission completion map { [missieId]: true }
  skill: blankSkillSet(),  // per-engine skill record (HANDOFF §6.1) — drives difficulty + badges
  knapWoorden: {},         // earned "knap-woord" badges { [id]: { naam } }
  recentGroei: [],         // engines whose breinkracht grew this mission (for the celebration)
  companion: blankCompanion(),  // metgezel (HANDOFF §7.2) — rescue → care → friend
  rehab: blankRehab(),          // recurring opvang-and-release loop
  companionGroei: null,         // fase the companion just reached (for the cabin celebration)
  voertuigen: blankVoertuigen(),// per-vehicle durability + cosmetic damage (HANDOFF §6.3)
  resources: blankResources(),  // { onderdelen, budget } — careful driving banks; repairs spend
  teVoet: false,                // last run ended with a wrecked vehicle → continue on foot
  story: blankStory(),          // season-arc + case-board state (HANDOFF §6.4 / §7.3)
  settings: {
    geluid: true,
    voorlezen: true,
    reducedMotion: false,
    gevolgErnst: 'stevig',  // crash consequence severity: 'stevig' | 'mild' | 'assist'
    autoMoeilijk: true,    // moeilijkheid past zich vanzelf aan (skill-staircase) vs handmatig (sliders)
    jargon: false,         // "knappe woorden" (frisling/rotte) vs simple (big/groep)
    leesFont: true,        // dyslexia-friendly reading font on
    readSize: 28,
    leading: 1.7,
    ambient: 0.85,
    accent: '#f5c23b',
    // difficulty
    lensSterkte: 0.6,      // 0..1 search lens (step 1)
    afleiders: 4,          // distractor count (step 1)
    routeLengte: 4,        // sequence length (step 2)
    regelWissel: 0.4,      // rule-flip frequency (step 3)
    slowmo: true,          // step 3 slow-mo on
    simonLengte: 3,        // simon: target echo-sequence length (grows from 2)
    wisselFreq: 0.4,       // wisselen: how often the sort-rule flips (0..1)
    // travel mini-game (sfeer + agency, never a test)
    reisSnelheid: 1,       // 0.6..1.6 speed multiplier (the "reflex" dial)
    reisDichtheid: 1,      // 0.5..1.8 obstacle/coin spawn density
    reisMagneet: false,    // coin-magnet auto-help (pulls eikels toward you)
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      skill: mergeSkill(parsed.skill),
      knapWoorden: parsed.knapWoorden || {},
      recentGroei: parsed.recentGroei || [],
      companion: mergeCompanion(parsed.companion),
      rehab: mergeRehab(parsed.rehab),
      companionGroei: parsed.companionGroei || null,
      voertuigen: mergeVoertuigen(parsed.voertuigen),
      resources: { ...blankResources(), ...(parsed.resources || {}) },
      teVoet: !!parsed.teVoet,
      story: mergeStory(parsed.story),
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
    };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

const GameContext = createContext(null);
const useGame = () => useContext(GameContext);

function GameProvider({ children }) {
  const [state, setState] = useState(loadState);

  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);

  // reflect reduced-motion + accent onto canvas
  useEffect(() => {
    const c = document.getElementById('canvas');
    if (!c) return;
    c.classList.toggle('rm', !!state.settings.reducedMotion);
    c.style.setProperty('--spel-sun', state.settings.accent);
    c.style.setProperty('--read-size', state.settings.readSize + 'px');
    c.style.setProperty('--read-leading', state.settings.leading);
    c.style.setProperty('--read-font',
      state.settings.leesFont ? "'Lexend', system-ui, sans-serif" : "'Inter Tight', sans-serif");
    c.style.setProperty('--ambient-op', state.settings.ambient);
  }, [state.settings]);

  // reflect the story season onto the canvas (chapters visibly change the world)
  useEffect(() => {
    const c = document.getElementById('canvas');
    if (!c) return;
    const seizoen = (state.story && state.story.seizoen) || 'lente';
    SEIZOENEN.forEach(z => c.classList.toggle('seizoen-' + z, z === seizoen));
  }, [state.story && state.story.seizoen]);

  const go = useCallback((screen) => setState(s => ({ ...s, screen })), []);
  const set = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);
  const setSetting = useCallback((patch) =>
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } })), []);

  const setStep = useCallback((worldStep) => setState(s => ({ ...s, worldStep })), []);

  /* ---- skill / difficulty (HANDOFF §6.1) ---- */
  // an engine finished a beat → feed its skill record (drives staircase + badges)
  const logSession = useCallback((engine, summary) => {
    if (!engine) return;
    setState(s => {
      const skill = { ...(s.skill || blankSkillSet()) };
      const before = (skill[engine] || blankSkill()).level;
      const updated = updateSkill(skill[engine], summary);
      skill[engine] = updated;
      const grew = updated.level > before + 1e-3;
      const recentGroei = grew
        ? Array.from(new Set([...(s.recentGroei || []), engine]))
        : (s.recentGroei || []);
      return { ...s, skill, recentGroei };
    });
  }, []);

  // child-controlled / frustration ease: lower the live level a touch (silent down, never the best)
  const easeEngine = useCallback((engine) => {
    if (!engine) return;
    setState(s => {
      const skill = { ...(s.skill || blankSkillSet()) };
      const rec = { ...(skill[engine] || blankSkill()) };
      rec.level = Math.max(1, rec.level - 0.5);
      skill[engine] = rec;
      return { ...s, skill };
    });
  }, []);

  // visible opt-in step-up ("Klaar voor een lastiger spoor?") — raises every engine a notch
  const bumpSkill = useCallback((delta = 0.6) => {
    setState(s => {
      const skill = { ...(s.skill || blankSkillSet()) };
      EF_ENGINES.forEach(e => {
        const rec = { ...(skill[e] || blankSkill()) };
        rec.level = Math.min(6, rec.level + delta);
        rec.best = Math.max(rec.best, rec.level);
        skill[e] = rec;
      });
      return { ...s, skill };
    });
  }, []);

  const clearGroei = useCallback(() => setState(s => ({ ...s, recentGroei: [] })), []);
  const resetSkill = useCallback(() => setState(s => ({ ...s, skill: blankSkillSet(), recentGroei: [] })), []);

  /* ---- companion / metgezel (HANDOFF §7.2) ---- */
  const setCompanion = useCallback((patch) =>
    setState(s => ({ ...s, companion: { ...(s.companion || blankCompanion()), ...patch } })), []);

  const rescueCompanion = useCallback((naam) =>
    setState(s => {
      const c = { ...(s.companion || blankCompanion()), rescued: true, fase: 'baby', bond: 12 };
      if (naam) c.naam = naam;
      c.kunstjes = kunstjesVoorFase(c.soort, c.fase);
      return { ...s, companion: c };
    }), []);

  // care raises the bond; fase never regresses; growing a fase flags a celebration
  const bondDelta = useCallback((n) =>
    setState(s => {
      const c = { ...(s.companion || blankCompanion()) };
      c.bond = Math.max(0, Math.min(100, (c.bond || 0) + n));
      const want = faseVoorBond(c.bond);
      const newIdx = Math.max(FASE_ORDER.indexOf(c.fase), FASE_ORDER.indexOf(want));
      const newFase = FASE_ORDER[newIdx];
      const grew = newFase !== c.fase;
      c.fase = newFase;
      c.kunstjes = kunstjesVoorFase(c.soort, c.fase);
      if (grew && c.fase !== 'baby') c.meeOpMissie = true;   // friend joins once it's strong
      return { ...s, companion: c, companionGroei: grew ? c.fase : s.companionGroei };
    }), []);

  const clearCompanionGroei = useCallback(() => setState(s => ({ ...s, companionGroei: null })), []);

  /* ---- rehab (opvang & loslaten) ---- */
  const setRehab = useCallback((patch) =>
    setState(s => ({ ...s, rehab: { ...(s.rehab || blankRehab()), ...patch } })), []);
  const startRehab = useCallback((gast) =>
    setState(s => ({ ...s, rehab: { ...(s.rehab || blankRehab()), active: true, dier: gast.dier, reden: gast.reden } })), []);
  const releaseRehab = useCallback(() =>
    setState(s => {
      const r = s.rehab || blankRehab();
      return { ...s, rehab: { ...r, active: false, dier: null, reden: null, releasedCount: (r.releasedCount || 0) + 1 } };
    }), []);

  /* ---- consequence / damage (HANDOFF §6.3) ---- */
  // a hard collision in the travel run → real durability loss (severity-scaled).
  // attentive driving (no hits) costs nothing. 0 → disabled (sober, never shaming).
  const damageVehicle = useCallback((id, raw) => setState(s => {
    const sev = GEVOLG_SCHADE[s.settings.gevolgErnst] != null ? GEVOLG_SCHADE[s.settings.gevolgErnst] : GEVOLG_SCHADE.stevig;
    const loss = raw != null ? raw : sev;
    if (loss <= 0) return s;                       // assist: soft bonk only
    const v = { ...(s.voertuigen || blankVoertuigen()) };
    const cur = { ...(v[id] || blankVoertuig()) };
    cur.durability = Math.max(0, cur.durability - loss);
    cur.schade = Math.min(1, 1 - cur.durability / 100);  // cosmetic, persists until repair
    cur.disabled = cur.durability <= 0;
    v[id] = cur;
    return { ...s, voertuigen: v };
  }), []);

  // repair spends onderdelen (the opportunity cost you'd rather spend on gear)
  const repairVehicle = useCallback((id) => setState(s => {
    const res = { ...(s.resources || blankResources()) };
    if ((res.onderdelen || 0) < REPAIR_KOST) return s;   // can't afford → must go on foot
    res.onderdelen -= REPAIR_KOST;
    const v = { ...(s.voertuigen || blankVoertuigen()) };
    v[id] = blankVoertuig();
    return { ...s, voertuigen: v, resources: res, teVoet: false };
  }), []);

  // careful driving banks resources → afford upgrades (ties consequence to progression)
  const bankResources = useCallback((onderdelen = 0, budget = 0) => setState(s => {
    const res = { ...(s.resources || blankResources()) };
    res.onderdelen = (res.onderdelen || 0) + onderdelen;
    res.budget = (res.budget || 0) + budget;
    return { ...s, resources: res };
  }), []);

  const setTeVoet = useCallback((v) => setState(s => ({ ...s, teVoet: !!v })), []);

  /* ---- story / season-arc (HANDOFF §6.4 / §7.3) ---- */
  // a mission tagged verhaalHaak drops a clue; the season moves forward hopefully
  const findClue = useCallback((clue) => setState(s => {
    if (!clue || !clue.id) return s;
    const story = mergeStory(s.story);
    if (story.clues[clue.id] === 'found') return s;   // already found — no-op
    story.clues = { ...story.clues, [clue.id]: 'found' };
    story.antagonist = { ...story.antagonist, spotted: (story.antagonist.spotted || 0) + 1 };
    if (clue.soort === 'camera') story.antagonist.caughtOnCamera = true;
    if (clue.seizoenNa) story.seizoen = clue.seizoenNa;
    if (clue.hoofdstukNa) story.hoofdstuk = clue.hoofdstukNa;
    return { ...s, story };
  }), []);

  // the hopeful finale: reported to the BOA → restoration; threat resolved off-screen
  const resolveArc = useCallback(() => setState(s => {
    const story = mergeStory(s.story);
    story.antagonist = { ...story.antagonist, caughtOnCamera: true, reported: true, reformed: true };
    story.restored = { ...story.restored, heide: true, ven: true };
    story.seizoen = 'winter';
    story.hoofdstuk = 4;
    return { ...s, story };
  }), []);

  const setStory = useCallback((patch) => setState(s => ({ ...s, story: { ...mergeStory(s.story), ...patch } })), []);
  const resetStory = useCallback(() => setState(s => ({ ...s, story: blankStory() })), []);

  const reset = useCallback(() => {
    setState(s => ({ ...DEFAULT_STATE, settings: s.settings }));
  }, []);

  const value = {
    state, settings: state.settings, go, set, setSetting, setStep, reset,
    logSession, easeEngine, bumpSkill, clearGroei, resetSkill,
    setCompanion, rescueCompanion, bondDelta, clearCompanionGroei,
    setRehab, startRehab, releaseRehab,
    damageVehicle, repairVehicle, bankResources, setTeVoet,
    findClue, resolveArc, setStory, resetStory,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/* ============================================================
   Shared chrome (back / title / sound / read-aloud)
   ============================================================ */
function Chrome({ title, instructie, onBack }) {
  const { settings, setSetting } = useGame();
  const reading = Speech.useReadAloud();

  return (
    <div className="chrome">
      <button className="chrome-btn" onClick={onBack} aria-label="Terug">
        <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        Terug
      </button>
      <div className="chrome-title">{title}</div>
      <div className="chrome-spacer" />
      {instructie && (
        <button
          className="chrome-btn icon-only"
          aria-label="Lees voor"
          aria-pressed={reading.active}
          onClick={() => reading.toggle(instructie)}
        >
          <SpeakerIcon active={reading.active} />
        </button>
      )}
      <button
        className="chrome-btn icon-only"
        aria-label="Geluid"
        aria-pressed={settings.geluid}
        onClick={() => setSetting({ geluid: !settings.geluid })}
      >
        {settings.geluid ? <SoundOnIcon/> : <SoundOffIcon/>}
      </button>
    </div>
  );
}

function SpeakerIcon({ active }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z"/>
      {active && <><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 7a7 7 0 0 1 0 10" opacity=".6"/></>}
    </svg>
  );
}
function SoundOnIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6M16 9l6 6"/>
    </svg>
  );
}

Object.assign(window, {
  GameContext, GameProvider, useGame, Chrome,
  SpeakerIcon, SoundOnIcon, SoundOffIcon,
  SCREENS, DEFAULT_STATE,
  VEHICLE_IDS, REPAIR_KOST, GEVOLG_SCHADE, SEIZOENEN,
  blankVoertuig, blankVoertuigen, blankResources, blankStory,
});
