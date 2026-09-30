/**
 * beats/callers.ts — simon in the world (design run6-missions §4.3 beat 4, §4.4 beat 4,
 * §6): animals that are really there — at their own spots round a place in the world —
 * call a growing sequence, each with its own sound and a soft light-up; the child calls
 * them back by clicking them in the same order.
 *
 * Construct parity (§6): the SAME `buildSimonTrial` and the SAME pure `SimonRun`
 * (`begin` → `tap`: advance / grow / complete / replay) as the 2D floor and the 3D
 * stage, so the same `{ trials: 1, correct }` summary, logged once through the kit.
 * Four callers with a distinct call and a distinct place, ALL visible during listening
 * and echoing (the lens holds still); the light-up and the call come together (so it
 * plays muted too); the sequence grows; a wrong click replays the SAME sequence. No
 * other beat runs in between.
 */

import * as THREE from 'three';
import '../../play/play3d.css';
import { buildSimonTrial, randomCaller, SimonRun } from '../../../engines/simon';
import type { BeatSummary } from '../../../core/skill';
import { store } from '../../../core/state';
import { narrator } from '../../../core/narrator';
import { Sound } from '../../../core/sound';
import { anchoredPrompt, clearPlayHint, pick3d, SPEAK_BTN } from '../../play/kit';
import { listenerOf } from '../../world/Residents';
import type { AdventureKit, FrameSpec } from '../kit';
import type { Place } from '../types';
import { listenPlan } from './callers-math';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const CALL = '#ffd98a';  // the warm light of a call
const OK = '#8fd6a0';    // a right echo
const WRONG = '#e8a27a'; // a wrong echo (soft, warm)
/** How far a call lifts a dark animal's own colour toward white (0..1): a touch. */
const LIFT = 0.12;

/**
 * A calling animal lights up in its OWN colours: its real materials take a warm light
 * (the emissive reads the colour texture and the base colour, tinted warm, so the jay
 * stays a jay and the badger a badger), and a warm rim rings its outline (so a black
 * raven lights up too, its feathers still its own) — never a flat cream cut-out. The
 * rim goes into the shader once, when the beat begins (a shader variant per material,
 * built while the lens holds, never mid-call). While it glows, a model that has its own
 * (dark, baked) emissive map lends that slot to its colour texture — a texture swap, no
 * new shader — and gets it back the moment the glow ends, so at rest every animal looks
 * exactly as it did; a textured part without one (the roe's coat) takes its colour
 * texture as its emissive map when the beat begins (its emissive shows nothing at rest);
 * an untextured one glows in its own base colour, and a merged one (the roe's other
 * parts: their colours in their vertices) in its vertex colours. The light is strongest
 * where it faces the lens, so it keeps its shape. `clear` hands every material back as
 * it was.
 */
export class WarmGlow {
  private readonly mats: {
    mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number; map: THREE.Texture | null;
    /** its emissive map while the glow is off (its own, or its colour texture when its
     *  own emissive shows nothing at rest) */
    rest: THREE.Texture | null;
    compile: THREE.Material['onBeforeCompile']; key: THREE.Material['customProgramCacheKey'];
  }[] = [];
  private readonly color = new THREE.Color();
  private readonly tmp = new THREE.Color();
  private readonly rim = { value: 0 };
  private readonly rimColor = { value: new THREE.Color() };

  constructor(root: THREE.Object3D, color: THREE.ColorRepresentation = CALL) {
    this.color.set(color);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.hitSphere || mesh.userData.hintAnchor) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const mat = m as THREE.MeshStandardMaterial;
        if (!mat.isMeshStandardMaterial || this.mats.some((e) => e.mat === mat)) continue;
        const e = { mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity, map: mat.emissiveMap, rest: mat.emissiveMap, compile: mat.onBeforeCompile, key: mat.customProgramCacheKey };
        // a textured part with no emissive map of its own (the roe's coat): its colour
        // texture goes in as the emissive map now, with the rim — its emissive shows
        // nothing at rest, so it looks as it did, and while it glows it glows in its own
        // coat, not one flat colour
        if (!mat.emissiveMap && mat.map && (mat.emissiveIntensity === 0 || mat.emissive.getHex() === 0)) { mat.emissiveMap = mat.map; e.rest = mat.map; }
        this.mats.push(e);
        const rim = this.rim, rimColor = this.rimColor;
        mat.onBeforeCompile = function (shader, renderer) {
          e.compile.call(this, shader, renderer);
          shader.uniforms.uCallRim = rim;
          shader.uniforms.uCallRimColor = rimColor;
          // (only while it glows: at rest the block is skipped and it looks as it did)
          shader.fragmentShader = 'uniform float uCallRim;\nuniform vec3 uCallRimColor;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\nif (uCallRim > 0.0) {\n' +
            '  float callFace = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);\n' +
            // a model whose colours are in its vertices (a merged one, the roe): its own
            // colours in the light too, lifted a little like the base colour
            '  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n' +
            `  totalEmissiveRadiance *= vColor.rgb + (1.0 - vColor.rgb) * ${LIFT.toFixed(2)};\n` +
            '  #endif\n' +
            // lit toward the lens, softer where it turns away: its shape, never a flat fill;
            // and a warm ring on its very outline only (a dark raven glows at its edge and
            // stays a dark bird inside it)
            '  totalEmissiveRadiance *= 0.5 + 0.5 * callFace;\n' +
            '  totalEmissiveRadiance += uCallRimColor * (uCallRim * 1.3 * smoothstep(0.55, 0.95, 1.0 - callFace));\n}');
        };
        mat.customProgramCacheKey = function () { return `${e.key.call(this)}|call-rim`; };
        mat.needsUpdate = true;
      }
    });
  }

  /** Light it `level` (0 = as it was), warm, or in `color` (a right echo's green). */
  set(level: number, color?: THREE.ColorRepresentation): void {
    if (color !== undefined) this.color.set(color);
    const on = level > 0.001;
    this.rim.value = on ? level : 0;
    this.rimColor.value.copy(this.color);
    for (const e of this.mats) {
      if (!on) { e.mat.emissive.copy(e.emissive); e.mat.emissiveIntensity = e.intensity; e.mat.emissiveMap = e.rest; continue; }
      if (e.map && e.mat.map) e.mat.emissiveMap = e.mat.map;
      // its own colour (texture × base colour) in the warm light, lifted only a touch: a
      // black raven stays a dark bird (the rim rings it), never a pale cut-out
      const c = e.mat.color;
      e.mat.emissive.copy(this.tmp.setRGB(c.r + (1 - c.r) * LIFT, c.g + (1 - c.g) * LIFT, c.b + (1 - c.b) * LIFT).multiply(this.color));
      e.mat.emissiveIntensity = level;
    }
  }

  /** Hand every material back as it was. */
  clear(): void {
    this.rim.value = 0;
    for (const e of this.mats) {
      e.mat.emissive.copy(e.emissive);
      e.mat.emissiveIntensity = e.intensity;
      e.mat.emissiveMap = e.map;
      e.mat.onBeforeCompile = e.compile;
      e.mat.customProgramCacheKey = e.key;
      e.mat.needsUpdate = true;
    }
  }
}

/** How bright a call lights its animal (its own colours, so brighter than a flat fill). */
export const CALL_GLOW = 0.95;

/** One animal that calls. */
export interface Caller {
  /** the content animal id (as the trial's `dieren` names it) */
  id: string;
  /** what a click on it is (its group: the body and anything it sits on) */
  pick: THREE.Object3D;
  /** the model that lights up (one that owns its materials: a spawn) */
  body: THREE.Object3D | null;
  /** what a perfect player clicks (golden's hint: standing on the ground); default the body */
  hint?: THREE.Object3D;
  /** where it is (its call comes from there) */
  at(): { x: number; z: number };
  /** it calls now (on) / is done (off): a little movement of its own (head up, a hop) */
  act?(on: boolean): void;
}

export interface CallersOpts {
  /** the held view (null: the lens already holds one) */
  view: FrameSpec | null;
  stand?: Place;
  callers: readonly Caller[];
  lines: { luister: string; echo: string; goed: string; groei: string; opnieuw: string };
  /** each call (the camera's infrared blinks with it) */
  onCall?(id: string): void;
}

/** Play the callers (simon, step `step`). Resolves once the sequence is echoed to its end. */
export async function callersBeat(k: AdventureKit, step: number, o: CallersOpts): Promise<BeatSummary> {
  k.check();
  k.beat = 'callers';
  const settings = store.get().settings;
  const trial = buildSimonTrial(k.steps[step].skin, store.difficulty('simon'));
  const run = new SimonRun(trial.target, () => randomCaller(trial.dieren));
  const byId = new Map(o.callers.map((c) => [c.id, c]));
  const missing = trial.dieren.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`[adventure] no caller for ${missing.join(', ')}`);
  k.stats.callers_target = trial.target;

  if (o.stand) await k.walkRanger(o.stand.x, o.stand.z, 0.04);
  if (o.view) await k.frame(o.view, { face: o.stand?.heading });
  k.say(null);

  const glows = new Map<string, WarmGlow>();
  for (const c of o.callers) if (c.body) glows.set(c.id, new WarmGlow(c.body, CALL));
  const light = (id: string, level: number, color = CALL): void => { glows.get(id)?.set(level, color); };
  const quiet = (): void => { for (const c of o.callers) { light(c.id, 0); c.act?.(false); } };

  let phase: 'listen' | 'echo' | 'done' = 'listen';
  let card: HTMLDivElement | null = null;
  const banner = (text: string, dots: boolean): void => {
    card = anchoredPrompt(k.host,
      `<div class="p3-bottom"><div class="p3-card"><div class="p3-row">` +
      `<p class="p3-text">${esc(text)}</p>` +
      (dots ? `<p class="p3-dots" aria-hidden="true"></p>` : '') +
      `${SPEAK_BTN}` +
      `</div></div></div>`, k.signal);
    card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
    progress();
  };
  const progress = (): void => {
    const el = card?.querySelector('.p3-dots');
    if (el) el.textContent = run.sequence.map((_, i) => (i < run.echoIndex ? '●' : '○')).join(' ');
  };
  const speak = (t: string): void => { if (settings.voorlezen) narrator.speak(t); };
  const callFrom = (id: string): number => {
    const c = byId.get(id)!;
    if (!settings.geluid) return 0;
    const p = c.at();
    const d = Sound.callAt(id, p.x, p.z, listenerOf(k.world.camera));
    return d || Sound.callDur(id);
  };

  /** The animals call the sequence, one at a time, each light-up with its call (after
   *  the words: a call never sounds over the voice). */
  let listenToken = 0;
  const listen = async (line: string | null): Promise<void> => {
    const token = ++listenToken;
    phase = 'listen';
    quiet();
    banner(o.lines.luister, false);
    if (line) speak(line);
    if (settings.voorlezen) await k.guard(narrator.quiet(6000));
    await k.wait(0.4);
    const plan = listenPlan(run.sequence, (id) => Math.max(0.65, Sound.callDur(id)), k.reduced);
    for (const beat of plan) {
      if (token !== listenToken) return;
      const c = byId.get(beat.id)!;
      quiet();
      light(beat.id, CALL_GLOW);
      c.act?.(true);
      o.onCall?.(beat.id);
      callFrom(beat.id);
      await k.wait(beat.on);
      light(beat.id, 0);
      c.act?.(false);
      await k.wait(beat.gap);
    }
    if (token !== listenToken) return;
    phase = 'echo';
    banner(o.lines.echo, true);
    speak(o.lines.echo);
  };

  let finished!: () => void;
  const complete = new Promise<void>((r) => { finished = r; });
  const flash = (id: string, color: string, secs: number): void => {
    light(id, color === WRONG ? 0.8 : 0.7, color);
    void k.wait(secs).then(() => { if (phase !== 'listen') light(id, 0); }).catch(() => {});
  };
  const onPick = (id: string): void => {
    if (phase !== 'echo') return;
    const res = run.tap(id);
    progress();
    if (res === 'advance') {
      callFrom(id);
      flash(id, OK, 0.4);
      return;
    }
    if (res === 'complete') {
      phase = 'done';
      callFrom(id);
      light(id, 0.7, OK);
      finished();
      return;
    }
    if (res === 'grow') {
      phase = 'listen';
      light(id, 0.7, OK);
      if (settings.geluid) Sound.correct();
      banner(o.lines.groei, false);
      speak(o.lines.groei);
      void k.wait(1.3).then(() => listen(null)).catch(() => {});
      return;
    }
    // a wrong click: recoverable — the SAME sequence again
    phase = 'listen';
    flash(id, WRONG, 0.65);
    if (settings.geluid) Sound.tryAgain();
    k.stats.callers_wrong = (k.stats.callers_wrong ?? 0) + 1;
    banner(o.lines.opnieuw, false);
    speak(o.lines.opnieuw);
    void k.wait(1.5).then(() => listen(null)).catch(() => {});
  };

  const unhint = k.hint(() => {
    if (phase !== 'echo') return null;
    const c = byId.get(run.expected);
    return c ? { id: c.id, target: c.hint ?? c.body ?? c.pick } : null;
  });
  const teardown = pick3d({
    canvas: k.ctx.canvas, camera: k.world.camera, raycaster: k.ctx.raycaster as THREE.Raycaster,
    targets: o.callers.map((c) => ({ id: c.id, object: c.pick })), onPick, signal: k.signal,
  });
  try {
    run.begin();
    await listen(o.lines.luister);
    await k.guard(complete);
  } finally {
    teardown();
    unhint();
    clearPlayHint();
    listenToken += 1;
  }
  const summary = run.summary();
  k.log(step, summary);
  if (settings.geluid) Sound.found();
  banner(o.lines.goed, false);
  speak(o.lines.goed);
  await k.wait(1.8);
  quiet();
  for (const g of glows.values()) g.clear();
  (card as HTMLDivElement | null)?.remove();
  return summary;
}
