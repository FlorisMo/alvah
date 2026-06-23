/**
 * CalmPose.ts — the PURE per-species "never-scary" calm-pose set (BUILD-PLAN Phase 5,
 * research/3d-expression-eyes-motion-comfort.md §B "ANIMAL-EMOTE CHEAT-SHEET"). The
 * §B AVOID lists encoded as DATA plus the calm rest-bias (ears / tail / head / eye /
 * mouth state). THREE-free + deterministic so it unit-tests in isolation (the
 * Eyes.ts / Face.ts split); the best-effort THREE bone-bias applier lives in
 * CalmPoseRig.ts and World wires it onto every animal marker.
 *
 * This is the running "never-scary QA gate" the research demands (§B universal rule,
 * line 212 "keep a living never-scary QA gate"): every resolved pose is forced
 * through calmGatePose() so NO hand-edit can ever express a threat/fear display —
 *  - no bared teeth / gape (mouthOpen capped tiny),
 *  - no raised hackles (hackles forced 0),
 *  - no pinned-ears-and-crouch fear (crouch forced 0, ears never pinned past a soft
 *    relax),
 *  - no raised white tail "flag" / puffed-up tail (tailLift capped low, never tucked),
 *  - no adder S-coil rear-up (coil forced 0 — flat loose basking only),
 *  - no direct unblinking wide stare (eyeOpen capped below full; soft eyes).
 *
 * It is a STATIC rest-pose bias (a one-time pose nudge at load), distinct from the
 * per-frame ProceduralMotion gait — they compose: the gait moves the whole model,
 * this biases its ears/tail/head once into a calm shape. Reduced-motion is therefore
 * irrelevant here (a static pose is not motion); the pose is always applied.
 */

export type EarState = 'relaxed' | 'forward' | 'out-to-side' | 'up-tufted' | 'natural' | 'none';
export type TailState = 'low-loose' | 'curled-still' | 'gentle-twitch' | 'none';
export type HeadState = 'low-level' | 'level' | 'lifted-soft';
export type EyeState = 'soft' | 'half-closed' | 'narrowed-slits';
export type MouthState = 'closed' | 'soft-open';

/**
 * A calm-pose recipe. Build via calmPoseFor()/calmGatePose() — never raw. Numeric
 * fields are rotation/lid biases relative to the model's rest pose; the categorical
 * fields are the §B descriptor a rig/author reads. The AVOID-list features (coil /
 * hackles / crouch / gape / raised-flag-tail / wide stare) live here ONLY so the gate
 * can force them to safe values.
 */
export interface PoseRecipe {
  ear: EarState;
  earTilt: number;   // rad: + = forward/up (curious), − = back; never pinned-flat-back
  tail: TailState;
  tailLift: number;  // rad from rest: LOW + loose — never a raised "flag", never tucked (<0)
  head: HeadState;
  headPitch: number; // rad: − = lowered/grazing, + = lifted-curious; bounded both ways
  eye: EyeState;
  eyeOpen: number;   // 0..1 lid openness — SOFT, never a full wide unblinking stare
  mouth: MouthState;
  mouthOpen: number; // 0..tiny — a soft breath, never bared teeth / gape / ballooned sac
  crouch: number;    // 0 = loose stand; >0 = fearful crouch (gate forces 0)
  hackles: number;   // 0 = flat; >0 = raised threat (gate forces 0)
  coil: number;      // 0 = flat/loose basking; >0 = adder S-coil rear-up (gate forces 0)
}

/**
 * §B never-scary ceilings. calmGatePose() clamps every pose into this envelope, so the
 * AVOID-list displays are unreachable by construction.
 */
export const POSE_CAP = {
  maxTailLift: 0.20,    // ≤~11° loose sway — never a vertical raised "flag"
  maxHeadLift: 0.26,    // ≤~15° lifted-curious — never a reared threat stance
  maxHeadLower: 0.40,   // ≤~23° grazing-low is calm/content; bounded so it never face-plants
  maxEarForward: 0.45,  // ears may rotate forward (curious) within reason
  maxEarBack: 0.16,     // ears may RELAX slightly back — never pinned flat (a hard floor)
  eyeSoftCap: 0.85,     // soft eyes — never lids at full 1.0 (the unblinking stare)
  maxMouthOpen: 0.12,   // a soft breath only — never bared teeth / gape
} as const;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Force a recipe into the never-scary envelope. Idempotent + pure. Even a deliberately
 * threatening hand-edit comes out calm: this is the QA gate, not advice.
 */
export function calmGatePose(r: PoseRecipe): PoseRecipe {
  return {
    ear: r.ear,
    earTilt: clamp(r.earTilt, -POSE_CAP.maxEarBack, POSE_CAP.maxEarForward),
    tail: r.tail,
    tailLift: clamp(r.tailLift, 0, POSE_CAP.maxTailLift), // floor 0 ⇒ never tucked (fear) nor flagged (alarm)
    head: r.head,
    headPitch: clamp(r.headPitch, -POSE_CAP.maxHeadLower, POSE_CAP.maxHeadLift),
    eye: r.eye,
    eyeOpen: clamp(r.eyeOpen, 0, POSE_CAP.eyeSoftCap),
    mouth: r.mouth,
    mouthOpen: clamp(r.mouthOpen, 0, POSE_CAP.maxMouthOpen),
    crouch: 0,   // pinned-ears-and-crouch fear is never expressible
    hackles: 0,  // raised hackles / bristled / erect throat-hackles never expressible
    coil: 0,     // adder S-coil rear-up never expressible (flat loose basking only)
  };
}

/** A neutral, loose rest pose (props / unknown ids — nothing to bias). */
const NEUTRAL: PoseRecipe = {
  ear: 'none', earTilt: 0, tail: 'none', tailLift: 0, head: 'level', headPitch: 0,
  eye: 'soft', eyeOpen: 0.8, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0,
};

/**
 * §B per-species calm recipes (pre-gate; calmGatePose finalises). Each line cites the
 * §B calm cue it encodes. Unlisted animals fall back to GENERIC_MAMMAL / GENERIC_BIRD.
 */
const POSE: Record<string, PoseRecipe> = {
  // B.1 ungulates — head low/level grazing, ears relaxed/forward, tail low-loose gentle
  // twitch ("all-clear"), soft eyes. AVOID: raised tail "flag", stiff-tense stance.
  'animal-ree-roedeer':   { ear: 'forward', earTilt: 0.18, tail: 'gentle-twitch', tailLift: 0.06, head: 'low-level', headPitch: -0.22, eye: 'soft', eyeOpen: 0.78, mouth: 'closed', mouthOpen: 0.02, crouch: 0, hackles: 0, coil: 0 },
  'animal-edelhert-reddeer': { ear: 'forward', earTilt: 0.16, tail: 'low-loose', tailLift: 0.05, head: 'level', headPitch: -0.10, eye: 'soft', eyeOpen: 0.8, mouth: 'closed', mouthOpen: 0.02, crouch: 0, hackles: 0, coil: 0 },
  // boar: relaxed; AVOID raised hackles / lowered-head charge (gate forces both safe)
  'animal-wildzwijn-boar':   { ear: 'relaxed', earTilt: 0.06, tail: 'low-loose', tailLift: 0.04, head: 'low-level', headPitch: -0.18, eye: 'soft', eyeOpen: 0.78, mouth: 'closed', mouthOpen: 0.03, crouch: 0, hackles: 0, coil: 0 },
  // piglet: bouncy + curious but calm (the bounce is ProceduralMotion's faster bob)
  'animal-frisling-piglet':  { ear: 'forward', earTilt: 0.2, tail: 'gentle-twitch', tailLift: 0.07, head: 'lifted-soft', headPitch: 0.1, eye: 'soft', eyeOpen: 0.82, mouth: 'closed', mouthOpen: 0.03, crouch: 0, hackles: 0, coil: 0 },

  // B.2 fox — ears out-to-side/slightly back, soft half-closed "smile" eyes, tail low+loose
  'animal-vos-fox': { ear: 'out-to-side', earTilt: -0.08, tail: 'low-loose', tailLift: 0.05, head: 'lifted-soft', headPitch: 0.08, eye: 'half-closed', eyeOpen: 0.6, mouth: 'closed', mouthOpen: 0.02, crouch: 0, hackles: 0, coil: 0 },

  // B.3 red squirrel — upright, ears up-tufted, tail loosely curled + STILL, soft eyes.
  // AVOID rapid tail-flick (that's a ProceduralMotion concern; here the tail rests curled)
  'animal-eekhoorn-squirrel': { ear: 'up-tufted', earTilt: 0.22, tail: 'curled-still', tailLift: 0.12, head: 'lifted-soft', headPitch: 0.12, eye: 'soft', eyeOpen: 0.82, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0 },

  // B.4 badger — head LOW, nose to ground, ears natural; calm read via low head + busy
  // nose, NOT eye contact (poor eyesight). AVOID bared teeth / hackles / freeze-tense
  'animal-das-badger': { ear: 'natural', earTilt: 0.04, tail: 'low-loose', tailLift: 0.03, head: 'low-level', headPitch: -0.3, eye: 'soft', eyeOpen: 0.72, mouth: 'closed', mouthOpen: 0.02, crouch: 0, hackles: 0, coil: 0 },

  // B.5 raven — sleek/softly-fluffed, throat hackles FLAT, head level or gently cocked.
  // AVOID erect throat hackles + bill-up + tall stiff stance (gate forces hackles 0)
  'animal-raaf-raven': { ear: 'none', earTilt: 0, tail: 'low-loose', tailLift: 0.05, head: 'level', headPitch: 0.04, eye: 'soft', eyeOpen: 0.8, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0 },
  // B.5 nightjar — roosts flattened lengthwise, eyes narrowed to slits, utterly still
  // (its calm IS stillness + camouflage). AVOID wide open-mouthed gaping hiss
  'animal-nachtzwaluw-nightjar': { ear: 'none', earTilt: 0, tail: 'none', tailLift: 0, head: 'low-level', headPitch: -0.12, eye: 'narrowed-slits', eyeOpen: 0.35, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0 },

  // B.6 adder — loosely coiled/stretched basking, head LOW + level, soft eyes, slow
  // tongue-flick (curiosity). AVOID raised S-coil, puffed body, hiss/gape (coil forced 0)
  'animal-adder-snake': { ear: 'none', earTilt: 0, tail: 'none', tailLift: 0, head: 'low-level', headPitch: -0.05, eye: 'soft', eyeOpen: 0.7, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0 },

  // B.7 common/moor frog — compact sit, limbs tucked, big round soft eyes, gentle throat
  // pulse. AVOID ballooned vocal sac (calling) + frozen mid-leap (mouthOpen 0; gait rests)
  'animal-heikikker-frog': { ear: 'none', earTilt: 0, tail: 'none', tailLift: 0, head: 'level', headPitch: 0, eye: 'soft', eyeOpen: 0.85, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0 },

  // butterfly — no ears/tail/threat display; a plain calm default
  'animal-heideblauwtje-butterfly': { ...NEUTRAL, eyeOpen: 0.85 },
};

/** Generic calm fallbacks for an unlisted member of a family. */
const GENERIC_MAMMAL: PoseRecipe = {
  ear: 'relaxed', earTilt: 0.08, tail: 'low-loose', tailLift: 0.05, head: 'level', headPitch: -0.05,
  eye: 'soft', eyeOpen: 0.8, mouth: 'closed', mouthOpen: 0.02, crouch: 0, hackles: 0, coil: 0,
};
const GENERIC_BIRD: PoseRecipe = {
  ear: 'none', earTilt: 0, tail: 'low-loose', tailLift: 0.05, head: 'level', headPitch: 0.02,
  eye: 'soft', eyeOpen: 0.8, mouth: 'closed', mouthOpen: 0, crouch: 0, hackles: 0, coil: 0,
};

/**
 * Resolve the full, gated calm pose for a model id. Pure + deterministic. Unlisted
 * `animal-*` → generic calm mammal, `bird-*` → generic calm bird, anything else
 * (props / null) → the neutral loose rest. Always passes through calmGatePose().
 */
export function calmPoseFor(id: string | null | undefined): PoseRecipe {
  const key = id ?? '';
  const base =
    POSE[key] ??
    (key.startsWith('bird-') ? GENERIC_BIRD :
     key.startsWith('animal-') ? GENERIC_MAMMAL :
     NEUTRAL);
  return calmGatePose(base);
}

/**
 * A bone-name-keyword → Euler rotation bias, for the best-effort THREE applier
 * (CalmPoseRig). Keywords are matched case-insensitively against bone/object names.
 * Derived purely from the gated pose so it can never carry a scary bias.
 */
export interface BoneBias {
  keyword: string;             // substring matched against a bone/object name
  euler: { x: number; y: number; z: number }; // radians, ADDED to the bone's rest rotation
}

/**
 * Map a species' gated pose to the small set of rest-pose bone biases World applies.
 * Pure + deterministic. A rig without these named bones is simply left untouched
 * (CalmPoseRig is best-effort). Ears droop forward/back, the tail lifts gently (never
 * a flag), and the head pitches into its calm read.
 */
export function calmPoseBones(id: string | null | undefined): BoneBias[] {
  const p = calmPoseFor(id);
  const out: BoneBias[] = [];
  // head: pitch about local X (− = lowered/grazing, + = lifted) — bounded by the gate
  if (p.headPitch !== 0) out.push({ keyword: 'head', euler: { x: p.headPitch, y: 0, z: 0 } });
  // ears: a loose forward/back droop about X (symmetric — both ears read identical)
  if (p.ear !== 'none' && p.earTilt !== 0) {
    out.push({ keyword: 'ear', euler: { x: p.earTilt, y: 0, z: 0 } });
  }
  // tail: a gentle low lift about X — gate guarantees it is never a raised flag/tuck
  if (p.tail !== 'none' && p.tailLift !== 0) {
    out.push({ keyword: 'tail', euler: { x: p.tailLift, y: 0, z: 0 } });
  }
  return out;
}
