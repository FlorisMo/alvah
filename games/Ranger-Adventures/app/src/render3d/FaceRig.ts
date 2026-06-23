/**
 * FaceRig.ts — the THREE-touching half of the face system (the pure spec + maths
 * live in Face.ts). Drives a humanoid's ARKit morph targets from a data-driven
 * emotion, with an eased fade between expressions and an always-alive blink +
 * microsaccade so the upper face never goes "dead doll".
 *
 * Best-effort, like EyeMaterial.ts / Models.ts: a model whose meshes carry NO
 * ARKit-named morph targets (the Meshy humanoids ship without a blendshape rig
 * today) is left completely untouched (returns null) and never throws — the game
 * stays playable. The moment a real ARKit-rigged GLB (RPM / CC4, §A.3) is staged
 * into a humanoid slot, this lights up with zero further wiring.
 *
 * Motion-comfort (§C): expression + blink are ESSENTIAL motion a low-reading child
 * relies on, so they stay ON under reduced-motion ("reduce ≠ none", research line
 * 152). Only the secondary microsaccade jitter is dropped when reduced-motion is set.
 */

import * as THREE from 'three';
import {
  ARKIT_SUBSET, FACE_TIMING, expressionWeights, fadeWeights, blinkWeightAt,
  nextBlinkDelay, microsaccadeAt, type Emotion, type ArkitShape,
} from './Face';

const SUBSET = new Set<string>(ARKIT_SUBSET as readonly string[]);
const GAZE_MORPHS = ['eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight'];

/** A morph mesh we manage, with its name→index lookup cached. */
interface MorphMesh {
  mesh: THREE.Mesh;
  dict: Record<string, number>;
  influences: number[];
}

/**
 * A live face controller. Self-drives via an onBeforeRender hook on the driver mesh,
 * but exposes setEmotion() so gameplay (a reward smile, a curious look) can retarget
 * it. update(t) is pure-ish bookkeeping; the heavy lifting is the pure Face.ts maths.
 */
export class FaceController {
  private emotion: Emotion;
  private from: Record<string, number>;
  private to: Record<string, number>;
  private fadeStart = 0;
  private last: Record<string, number>;
  private blinkIndex = 0;
  private lastBlinkStart = -999;
  private nextBlinkAt: number;
  private readonly perMin: number;
  private readonly reducedMotion: boolean;
  private readonly meshes: MorphMesh[];

  constructor(
    meshes: MorphMesh[],
    opts: { emotion?: Emotion; child?: boolean; reducedMotion?: boolean } = {},
  ) {
    this.meshes = meshes;
    this.emotion = opts.emotion ?? 'neutral';
    this.reducedMotion = !!opts.reducedMotion;
    const rate = opts.child ? FACE_TIMING.childBlinkPerMin.attentive : FACE_TIMING.adultBlinkPerMin.attentive;
    this.perMin = (rate[0] + rate[1]) / 2;
    this.to = expressionWeights(this.emotion);
    this.from = { ...this.to };
    this.last = { ...this.to };
    this.nextBlinkAt = nextBlinkDelay(0, this.perMin);
  }

  /** Retarget the expression; the next frames ease from the current pose to it. */
  setEmotion(e: Emotion): void {
    if (e === this.emotion) return;
    this.emotion = e;
    this.from = { ...this.last };
    this.to = expressionWeights(e);
    this.fadeStart = -1; // stamped on the next update() so the fade starts from "now"
  }

  /** Advance to absolute time t (seconds) and write influences to every morph mesh. */
  update(t: number): void {
    if (this.fadeStart < 0) this.fadeStart = t;

    // eased expression fade (§A.2 ~0.35 s)
    const k = (t - this.fadeStart) / FACE_TIMING.expressionFadeSec;
    const expr = fadeWeights(this.from, this.to, k);
    this.last = expr;

    // schedule + sample the always-alive blink (§A.4)
    if (t >= this.nextBlinkAt) {
      this.lastBlinkStart = t;
      this.blinkIndex++;
      this.nextBlinkAt = t + nextBlinkDelay(this.blinkIndex, this.perMin);
    }
    const blink = blinkWeightAt(t, this.lastBlinkStart, FACE_TIMING.blinkDurationSec);

    // microsaccade gaze (secondary → dropped under reduced-motion)
    const sac = this.reducedMotion ? { yawDeg: 0, pitchDeg: 0 } : microsaccadeAt(t);

    for (const m of this.meshes) {
      // expression
      for (const name of ARKIT_SUBSET) this.write(m, name, expr[name] ?? 0);
      // blink rides on top of the expression
      this.write(m, 'eyeBlinkLeft' as ArkitShape, blink);
      this.write(m, 'eyeBlinkRight' as ArkitShape, blink);
      // best-effort gaze micro-jitter if the rig exposes eyeLook morphs
      this.writeGaze(m, sac);
    }
  }

  private write(m: MorphMesh, name: string, v: number): void {
    const idx = m.dict[name];
    if (idx != null) m.influences[idx] = v;
  }

  private writeGaze(m: MorphMesh, sac: { yawDeg: number; pitchDeg: number }): void {
    const yaw = sac.yawDeg / FACE_TIMING.microsaccadeMaxDeg; // -1..1
    const pitch = sac.pitchDeg / FACE_TIMING.microsaccadeMaxDeg;
    const amp = 0.15; // tiny — a sub-degree wander, never a roll of the eyes
    this.write(m, 'eyeLookOutLeft', Math.max(0, yaw) * amp);
    this.write(m, 'eyeLookInRight', Math.max(0, yaw) * amp);
    this.write(m, 'eyeLookInLeft', Math.max(0, -yaw) * amp);
    this.write(m, 'eyeLookOutRight', Math.max(0, -yaw) * amp);
    this.write(m, 'eyeLookUpLeft', Math.max(0, pitch) * amp);
    this.write(m, 'eyeLookUpRight', Math.max(0, pitch) * amp);
    this.write(m, 'eyeLookDownLeft', Math.max(0, -pitch) * amp);
    this.write(m, 'eyeLookDownRight', Math.max(0, -pitch) * amp);
  }
}

/**
 * Find a humanoid's ARKit morph meshes and attach a self-driving FaceController.
 * Returns the controller (so gameplay can call setEmotion) or null if the model has
 * no ARKit blendshape rig (best-effort — never throws). The controller advances once
 * per frame from an onBeforeRender hook on its richest morph mesh.
 */
export function applyFace(
  root: THREE.Object3D,
  opts: { emotion?: Emotion; child?: boolean; reducedMotion?: boolean } = {},
): FaceController | null {
  const meshes: MorphMesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    const dict = mesh.morphTargetDictionary as Record<string, number>;
    const hasArkit = Object.keys(dict).some((n) => SUBSET.has(n) || GAZE_MORPHS.includes(n));
    if (!hasArkit) return;
    meshes.push({ mesh, dict, influences: mesh.morphTargetInfluences });
  });
  if (meshes.length === 0) return null; // no ARKit rig → leave the model untouched

  const ctrl = new FaceController(meshes, opts);

  // self-drive: advance the controller once per frame from the richest morph mesh
  const driver = meshes.reduce((a, b) =>
    Object.keys(b.dict).length > Object.keys(a.dict).length ? b : a).mesh;
  const start = performance.now();
  driver.onBeforeRender = () => ctrl.update((performance.now() - start) / 1000);
  return ctrl;
}
