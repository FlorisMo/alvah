/**
 * simon3d.ts — the diegetic 3D variant of the "simon" engine (audio-visual
 * working memory), the fourth in-place mini-game on the 3D play harness
 * (3D-IMMERSION-PLAN §3, BUILD-PLAN §1f / ledger 53).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildSimonTrial` builder
 * and drives the SAME pure `SimonRun` core as the 2D `playSimon`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the
 * whole growing sequence is echoed with no wrong tap). 3D changes ONLY the staging
 * — the dusk callers become calm still in-world forms on the heath; "listen" lights
 * each caller in turn with its real call; "echo" is a raycast tap-back — and never
 * WHAT is measured: same growing sequence, same callers, same binary score. No
 * cross-construct contamination — the forms stay put and the ranger does not walk
 * during the echo, so it's memory, not navigation.
 *
 * Never-scary / motion-comfort (§1e): the callers are calm earthy forms (each a
 * distinct hue so WHICH animal is the memory cue, exactly as the 2D tokens); "call"
 * is a gentle per-form glow + small lift that settles (steady, no pulse, under
 * reduced-motion); a wrong tap re-lists the SAME sequence (recoverable, never a
 * game-over). Dual-channel everywhere (emissive COLOUR + SCALE + the real call /
 * step sound). ≥56px raycast hit-spheres via the shared kit. The §1e reframe cuts
 * under reduced-motion. rmSafe:false — a flat, named row reads cleaner than a 3D
 * perspective for a sequence-memory task under reduced-motion, so the resolver
 * serves the proven 2D floor there (this view still degrades gracefully if entered:
 * camera cuts, no pulse, calls + words intact).
 */

import * as THREE from 'three';
import '../../render2d/simon.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildSimonTrial, randomCaller, SimonRun } from '../../engines/simon';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { anchoredPrompt, makeReframe, pick3d } from '../play/kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Half-width of the caller row laid around the activity spot (metres). */
const SPREAD = 2.8;

/** Calm earthy hues so each caller is a distinct, memorable form (never-scary;
 *  all muted heath/dusk tones). The glow on top is a warm "calling" light. */
const CALLER_HUES = ['#b98a5a', '#8a9b6e', '#9a7b6a', '#7e8a9b', '#a9925e', '#6e8a7e'];

/** A calm, still caller form. Its own material so it can glow (call + recall
 *  feedback) without touching any other mesh. */
interface CallerFx {
  id: string;
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  glow: number;   // 0..1 target emissive level
  lift: number;   // 0..1 target lift (dual-channel with colour)
  cur: number;    // eased current lift
  hue: THREE.Color;
}

export function playSimon3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('simon');
    const trial = buildSimonTrial(step.skin, diff);
    const run = new SimonRun(trial.target, () => randomCaller(trial.dieren));

    const instructie = copy.instructie ?? 'De dieren roepen. Doe ze na.';
    const luister = copy.luister ?? 'Luister naar de dieren…';
    const echoTxt = copy.echo ?? 'Doe ze na. Tik de dieren.';
    const goed = copy.goed ?? 'Knap onthouden!';

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;
    const callHue = new THREE.Color('#ffe6a8'); // warm "calling" glow
    const okHue = new THREE.Color('#8fd6a0');   // calm green for a correct echo tap

    // ---- stage the callers in a gentle row on the heath ----
    const fx = new Map<string, CallerFx>();
    const n = trial.dieren.length;
    trial.dieren.forEach((id, i) => {
      const f = n > 1 ? i / (n - 1) : 0.5; // 0..1 across the row
      const x = sx + (f - 0.5) * 2 * SPREAD;
      const z = sz - Math.abs(f - 0.5) * 0.8; // slight arc — ends sit a touch back
      const base = new THREE.Color(CALLER_HUES[i % CALLER_HUES.length]);
      const mat = new THREE.MeshStandardMaterial({
        color: base, emissive: callHue.clone(), emissiveIntensity: 0, roughness: 0.9,
      });
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.36, 4, 8), mat);
      body.position.y = 0.38;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat);
      head.position.set(0, 0.7, 0.14);
      group.add(body, head);
      group.position.set(x, sy, z);
      scene.add(group);
      fx.set(id, { id, group, mat, glow: 0, lift: 0, cur: 0, hue: callHue });

      // a camera-facing name tag (dual-channel with the form's hue), like the 2D names
      const naam = Content.animal(id)?.naam ?? id;
      const label = makeLabel(naam);
      label.position.set(0, 1.15, 0);
      group.add(label);
    });

    // ---- §1e reframe — a calm raised look over the whole row (cuts if reduced) ----
    const lookAt = new THREE.Vector3(sx, sy + 0.5, sz);
    const to = new THREE.Vector3(sx, sy + 3.2, sz + 5.0);
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);

    function applyFx(f: CallerFx): void {
      f.mat.emissive.copy(f.hue);
      f.mat.emissiveIntensity = f.glow;
      const lift = reduced ? f.lift : f.cur;
      f.group.position.y = sy + lift * 0.16;
      const sc = 1 + lift * 0.14;
      f.group.scale.set(sc, sc, sc);
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reframe.update(dt);
      for (const f of fx.values()) {
        f.cur += (f.lift - f.cur) * (reduced ? 1 : Math.min(1, dt * 10));
        applyFx(f);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    // ---- the accessible DOM banner (all words + read-aloud live here) ----
    function banner(text: string): void {
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="simon3d-card" style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;padding:0 16px;">` +
          `<div class="simon-bar" style="max-width:520px;">` +
          `<p class="simon-instr">${esc(text)}</p>` +
          `<button class="simon-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div></div>`,
      );
      card.querySelector('.simon-speak')?.addEventListener('click', () => narrator.speak(text));
    }

    let phase: 'listen' | 'echo' | 'done' = 'listen';
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    function clearGlow(): void {
      for (const f of fx.values()) { f.glow = 0; f.lift = 0; f.hue = callHue; }
    }

    function listen(): void {
      clearTimers();
      phase = 'listen';
      clearGlow();
      banner(luister);
      const gap = reduced ? 380 : 250;
      let t = 480;
      run.sequence.forEach((id) => {
        after(t, () => {
          for (const f of fx.values()) { f.hue = callHue; f.glow = f.id === id ? 1 : 0; f.lift = f.id === id ? 1 : 0; }
          if (settings.geluid) Sound.call(id);
        });
        const dur = Sound.callDur(id) * 1000;
        after(t + dur, () => { const f = fx.get(id); if (f) { f.glow = 0; f.lift = 0; } });
        t += dur + gap;
      });
      after(t, startEcho);
    }

    function startEcho(): void {
      phase = 'echo';
      clearGlow();
      banner(echoTxt);
    }

    function onPick(id: string): void {
      if (phase !== 'echo') return;
      const f = fx.get(id);
      const res = run.tap(id);
      if (res === 'advance') {
        if (settings.geluid) Sound.call(id);
        if (f) { f.glow = 0.7; f.lift = 0.4; f.hue = okHue; after(260, () => { f.glow = 0; f.lift = 0; f.hue = callHue; }); }
      } else if (res === 'complete') {
        if (f) { f.glow = 0.7; f.lift = 0.4; f.hue = okHue; }
        finish();
      } else if (res === 'grow') {
        // a full echo below target — celebrate, then re-list the longer sequence
        phase = 'listen';
        if (f) { f.glow = 0.7; f.lift = 0.4; f.hue = okHue; }
        if (settings.geluid) Sound.correct();
        banner('Goed onthouden!');
        after(1100, listen);
      } else { // 'replay' — wrong tap, recoverable: re-list the SAME sequence
        phase = 'listen';
        if (f) { f.glow = 1; f.lift = 0.3; f.hue = new THREE.Color('#e08a6a'); after(600, () => { f.glow = 0; f.lift = 0; f.hue = callHue; }); }
        if (settings.geluid) Sound.tryAgain();
        banner('Luister nog een keer.');
        after(1300, listen);
      }
    }

    const teardownPick = pick3d({
      canvas: ctx.canvas,
      camera,
      raycaster,
      targets: [...fx.values()].map((f) => ({ id: f.id, object: f.group })),
      onPick,
    });

    function finish(): void {
      phase = 'done';
      if (settings.geluid) Sound.found();
      banner(goed);
      speak(goed);
      const summary = run.summary();
      after(1500, () => {
        clearTimers();
        narrator.stop();
        teardownPick();
        cancelAnimationFrame(raf);
        for (const f of fx.values()) {
          f.group.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const m = mesh.material as THREE.Material | undefined;
            if (m) m.dispose();
          });
          scene.remove(f.group);
        }
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        resolve(summary);
      });
    }

    speak(instructie);
    run.begin();
    listen();
  });
}

/** A small camera-facing name sprite (depthWrite off) so the caller is named in
 *  world, the dual-channel partner to its hue (no chrome, ≥ readable). */
function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = '600 34px Inter, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(28,24,18,0.72)';
  const w = g.measureText(text).width + 28;
  roundRect(g, (256 - w) / 2, 12, w, 40, 12);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.9, 0.225, 1);
  return sprite;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The registered 3D simon variant. rmSafe:false — a flat, named row is the clearer
 *  surface for an audio-visual sequence-memory task under reduced-motion, so the
 *  resolver serves the 2D floor there (3D-IMMERSION-PLAN §4). */
export const simon3dEngine: Play3dEngine = {
  engine: 'simon',
  play: playSimon3d,
  rmSafe: false,
};
