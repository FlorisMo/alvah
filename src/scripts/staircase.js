// Klassieke 2-down/1-up staircase. Pure state-machine.
// Paradigma-referentie: psychofysische staircase-methodologie,
// standaard in jsPsych-paradigma's (MIT). Eigen implementatie.
//
// Conventie: level = moeilijkheidsgraad (hoger = moeilijker).
// - 2 correct op rij  → level + 1 (harder)
// - 1 fout            → level - 1 (easier)
// Clamped op [min, max]. Tellers resetten bij level-verandering.
//
// Reversals: elke richting-wissel (omhoog → omlaag of andersom) is een
// reversal. De lijst `reversals` bevat de level-waarden waarop de
// omkering plaatsvond. Zie progressie.js::computeSessionLevel voor
// hoe reversals omgezet worden in een sessie-level (mediaan van
// laatste N reversals).

export function create({ level = 2, min = 1, max = 9 } = {}) {
  return {
    level: clamp(level, min, max),
    min,
    max,
    consecCorrect: 0,
    consecWrong: 0,
    direction: 0, // -1 = daalt, +1 = stijgt, 0 = nog niet bewogen
    reversals: [],
  };
}

export function onTrial(state, correct) {
  if (correct) {
    const c = state.consecCorrect + 1;
    if (c >= 2 && state.level < state.max) {
      const nextDirection = 1;
      const reversals = state.direction === -1
        ? [...state.reversals, state.level]
        : state.reversals;
      return {
        ...state,
        level: state.level + 1,
        consecCorrect: 0,
        consecWrong: 0,
        direction: nextDirection,
        reversals,
      };
    }
    return { ...state, consecCorrect: c, consecWrong: 0 };
  } else {
    if (state.level > state.min) {
      const nextDirection = -1;
      const reversals = state.direction === 1
        ? [...state.reversals, state.level]
        : state.reversals;
      return {
        ...state,
        level: state.level - 1,
        consecCorrect: 0,
        consecWrong: 0,
        direction: nextDirection,
        reversals,
      };
    }
    return { ...state, consecCorrect: 0, consecWrong: state.consecWrong + 1 };
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
