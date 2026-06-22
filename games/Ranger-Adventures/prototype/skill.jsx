/* ============================================================
   skill.jsx — difficulty & skill tracking (HANDOFF §6.1 / plan §12.4)
   ------------------------------------------------------------
   One small, telemetry-free system that makes each EF-engine scale
   BOTH over time (lifetime trials lift the start-floor) AND with
   demonstrated skill (a reversal staircase toward ~70-80% success).
   It DRIVES the difficulty knobs the engines already read from
   settings — so the engines change nothing structural, they just
   read a resolved difficulty instead of only the raw Tweak sliders.

   Pure logic + config live here (loaded BEFORE state.jsx). The
   React hook `useEngineDifficulty` reads the live skill record and
   returns a settings-like object the engines can use directly.

   Rules baked in:
   - scale DOWN silently; scale UP may be visible/opt-in.
   - floor never lets a practised player restart at baby-level.
   - "best" is the high-water mark (badges never show a drop).
   ============================================================ */

const EF_ENGINES = ['zoeken', 'corsi', 'simon', 'dagnacht', 'wisselen'];

/* per-engine identity for the 5 breinkracht-badges (data, not hardcoded UI) */
const SKILL_META = {
  zoeken:   { badgeId: 'brein-zoeken',   naam: 'Speurkracht',   taak: 'Speuren',        kleur: '#5e8c3a' },
  corsi:    { badgeId: 'brein-corsi',    naam: 'Geheugenkracht', taak: 'Route onthouden', kleur: '#2f6fb0' },
  simon:    { badgeId: 'brein-simon',    naam: 'Echokracht',    taak: 'Naroepen',       kleur: '#bb6a2c' },
  dagnacht: { badgeId: 'brein-dagnacht', naam: 'Rustkracht',    taak: 'Rustig blijven', kleur: '#7a52b3' },
  wisselen: { badgeId: 'brein-wisselen', naam: 'Wisselkracht',  taak: 'Omschakelen',    kleur: '#c1467e' },
};

const SKILL_MIN = 1, SKILL_MAX = 6, SKILL_STEP = 0.34;

const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _clampInt = (v, lo, hi) => Math.round(_clamp(v, lo, hi));

function blankSkill() { return { level: 1, best: 1, reversals: [], recent: [], trials: 0 }; }
function blankSkillSet() { const o = {}; EF_ENGINES.forEach(e => (o[e] = blankSkill())); return o; }

/* (a) OVER TIME: lifetime trials slowly lift the difficulty floor a new
   mission starts at. Soft log curve, capped (+2 levels). */
function floorLevel(trials) {
  return 1 + Math.min(2, Math.log2(1 + (trials || 0) / 5));
}

/* tier from the high-water mark (never shows a drop). */
function tierFor(best) {
  if (best >= 4)   return { id: 'goud',   naam: 'Goud',   kleur: '#e0a92e', ring: '#f4d987', glow: 'rgba(224,169,46,.45)' };
  if (best >= 2.5) return { id: 'zilver', naam: 'Zilver', kleur: '#aab4bf', ring: '#dde3ea', glow: 'rgba(170,180,191,.4)' };
  return                  { id: 'brons',  naam: 'Brons',  kleur: '#c08a52', ring: '#dcb487', glow: 'rgba(192,138,82,.4)' };
}
/* progress 0..1 toward the next tier (for the badge ring). */
function badgeProgress(best) {
  if (best >= 4)   return 1;
  if (best >= 2.5) return _clamp((best - 2.5) / (4 - 2.5), 0, 1);
  return _clamp((best - 1) / (2.5 - 1), 0, 1);
}

/* (b) WITH SKILL: update one engine's record from a finished beat.
   summary = { trials, correct }  (or { success:bool }).
   A reversal staircase nudges `level` up after a strong beat, down
   after a weak one; the floor lifts the minimum so practice sticks. */
function updateSkill(prev, summary) {
  const rec = prev ? { ...prev } : blankSkill();
  const trials = Math.max(1, (summary && summary.trials) || 1);
  const correct = (summary && summary.correct != null)
    ? summary.correct
    : (summary && summary.success ? trials : 0);
  const acc = trials > 0 ? correct / trials : 1;

  const newTrials = (rec.trials || 0) + trials;
  const fl = floorLevel(newTrials);

  let level = rec.level || 1;
  const reversals = [...(rec.reversals || [])];
  let dir = 0;
  if (acc >= 0.8) dir = +1;            // strong → harder
  else if (acc < 0.5) dir = -1;        // weak  → easier (silent)
  if (dir !== 0) {
    const last = reversals.length ? reversals[reversals.length - 1].dir : 0;
    if (last !== dir) reversals.push({ dir, at: newTrials });
    level += dir * SKILL_STEP;
  }
  level = _clamp(level, fl, SKILL_MAX);          // floor lifts the minimum
  const best = Math.max(rec.best || 1, level);   // high-water mark

  const recent = [...(rec.recent || [])];
  for (let i = 0; i < trials; i++) recent.push(i < correct);

  return {
    level: Math.round(level * 1000) / 1000,
    best: Math.round(best * 1000) / 1000,
    reversals: reversals.slice(-12),
    recent: recent.slice(-8),
    trials: newTrials,
  };
}

/* map an effective difficulty (≈ level) onto each engine's knobs.
   These are the SAME knobs the engines already read from settings. */
function knobsForLevel(engine, level) {
  const d = _clamp(level, SKILL_MIN, SKILL_MAX);
  switch (engine) {
    case 'zoeken':
      return { afleiders: _clampInt(2 + d, 2, 8), lensSterkte: _clamp(0.95 - d * 0.16, 0, 0.95) };
    case 'corsi':
      return { routeLengte: _clampInt(2 + d, 3, 6) };
    case 'simon':
      return { simonLengte: _clampInt(1 + d, 2, 6) };
    case 'dagnacht':
      return { slowmo: d < 3 };            // slow-mo support while still learning
    case 'wisselen':
      return { wisselFreq: _clamp(0.12 + d * 0.13, 0.1, 0.9) };
    default:
      return {};
  }
}

/* deep-merge persisted skill onto a fresh set (migration-safe). */
function mergeSkill(saved) {
  const base = blankSkillSet();
  if (saved && typeof saved === 'object') {
    EF_ENGINES.forEach(e => { if (saved[e]) base[e] = { ...base[e], ...saved[e] }; });
  }
  return base;
}

/* ---- React hook: the engines call this instead of reading raw sliders.
   `ease` (0..n) = a transient, child- or frustration-driven softening
   applied to THIS attempt only (never persisted as a "drop"). When the
   adaptive system is off, the raw Tweak sliders win (Floris drives). */
function useEngineDifficulty(engine, ease) {
  const { settings, state } = useGame();
  if (!settings.autoMoeilijk) return settings;             // manual mode → raw sliders
  const rec = (state.skill && state.skill[engine]) || blankSkill();
  const eff = Math.max(SKILL_MIN, rec.level - (ease || 0) * 0.8);
  return { ...settings, ...knobsForLevel(engine, eff) };
}

Object.assign(window, {
  EF_ENGINES, SKILL_META, blankSkill, blankSkillSet, mergeSkill,
  floorLevel, updateSkill, knobsForLevel, tierFor, badgeProgress,
  useEngineDifficulty,
});
