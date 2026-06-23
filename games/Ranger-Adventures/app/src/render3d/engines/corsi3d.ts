/**
 * corsi3d.ts — the diegetic 3D variant of the "corsi" engine (visuospatial
 * sequence memory), the third in-place mini-game on the 3D play harness
 * (3D-IMMERSION-PLAN §3, BUILD-PLAN §1f / ledger 52).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildCorsiTrial` builder
 * and drives the SAME pure `CorsiRun` core as the 2D `playRoute`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the
 * route is recalled with no wrong tap). 3D changes ONLY the staging — the herd's
 * footprints become real spots pressed into the heath, lit in turn, and the child
 * taps them back by raycast — and never WHAT is measured: same spots, same order,
 * same binary score. No cross-construct contamination — the spots stay put and
 * labelled, the ranger does not walk during recall, so it's memory not navigation.
 *
 * Never-scary / motion-comfort (§1e): the spots are calm ground discs; "show" is a
 * gentle per-spot glow + a small lift that settles (steady, no pulse, under
 * reduced-motion); the §1e reframe cuts under reduced-motion. Dual-channel
 * everywhere (emissive COLOUR + SCALE + the step sound). ≥56px raycast hit-spheres
 * via the shared kit. rmSafe:false — a flat sequence-memory grid reads cleaner than
 * a 3D perspective under reduced-motion, so the resolver serves the proven 2D floor
 * there (this view still degrades gracefully if ever entered: camera cuts, no pulse).
 */

import * as THREE from 'three';
import '../../render2d/route.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildCorsiTrial, CorsiRun, type CorsiSpot } from '../../engines/corsi';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { anchoredPrompt, makeReframe, pick3d } from '../play/kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Half-width of the footprint patch laid around the activity spot (metres). */
const SPREAD = 2.2;

/** A calm footprint disc pressed into the heath. Its own material so it can glow
 *  (show + recall feedback) without touching any other mesh. */
interface SpotFx {
  id: number;
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  baseEmissiveIntensity: number;
  glow: number;   // 0..1 target emissive level
  lift: number;   // 0..1 target lift (dual-channel with colour)
  cur: number;    // eased current lift
  hue: THREE.Color;
}

export function playCorsi3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('corsi');
    const trial = buildCorsiTrial(diff);
    const run = new CorsiRun(trial.sequence);

    const instructie = copy.instructie ?? 'Onthoud de weg.';
    const tonen = copy.toon ?? 'Kijk goed welke weg de groep liep…';
    const terug = copy.terug ?? 'Wijs de weg terug.';
    const goed = copy.goed ?? 'Precies de goede weg!';

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;
    const baseHue = new THREE.Color('#cdb892'); // footprint sand
    const showHue = new THREE.Color('#ffe6a8'); // warm "lit" glow
    const okHue = new THREE.Color('#8fd6a0');   // calm green for a correct recall

    // ---- lay the footprints (same PRINT_SPOTS layout, mapped onto the patch) ----
    const fx = new Map<number, SpotFx>();
    function worldOf(s: CorsiSpot): { x: number; z: number } {
      return {
        x: sx + (s.x / 100 - 0.5) * 2 * SPREAD,
        z: sz + (s.y / 100 - 0.5) * 2 * SPREAD,
      };
    }
    for (const s of trial.spots) {
      const { x, z } = worldOf(s);
      const group = new THREE.Group();
      group.position.set(x, sy + 0.02, z);
      const mat = new THREE.MeshStandardMaterial({
        color: baseHue, emissive: showHue.clone(), emissiveIntensity: 0, roughness: 1,
      });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), mat);
      disc.rotation.x = -Math.PI / 2;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.34, 0.42, 18),
        new THREE.MeshStandardMaterial({ color: '#9c8a64', roughness: 1 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.001;
      group.add(disc, ring);
      scene.add(group);
      fx.set(s.id, {
        id: s.id, group, mat, baseEmissiveIntensity: 0,
        glow: 0, lift: 0, cur: 0, hue: showHue,
      });
    }

    // ---- §1e reframe — a calm raised look over the whole patch (cuts if reduced) ----
    const lookAt = new THREE.Vector3(sx, sy, sz);
    const to = new THREE.Vector3(sx, sy + 3.4, sz + 4.4);
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);

    function applyFx(f: SpotFx): void {
      f.mat.emissive.copy(f.hue);
      f.mat.emissiveIntensity = f.glow;
      const lift = reduced ? f.lift : f.cur;
      f.group.position.y = sy + 0.02 + lift * 0.18;
      const sc = 1 + lift * 0.18;
      f.group.scale.set(sc, 1, sc);
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
        `<div class="route3d-card" style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;padding:0 16px;">` +
          `<div class="route-bar" style="max-width:520px;">` +
          `<p class="route-instr">${esc(text)}</p>` +
          `<button class="route-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div></div>`,
      );
      card.querySelector('.route-speak')?.addEventListener('click', () => narrator.speak(text));
    }

    let phase: 'show' | 'recall' | 'done' = 'show';
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    function clearAll(): void {
      for (const f of fx.values()) { f.glow = 0; f.lift = 0; f.hue = showHue; }
    }

    function showSequence(): void {
      clearTimers();
      phase = 'show';
      clearAll();
      banner(tonen);
      const stepDur = reduced ? 460 : 680;
      let t = 460;
      trial.sequence.forEach((id, i) => {
        after(t, () => {
          // light the current spot; leave the already-shown ones faintly lit
          for (const f of fx.values()) {
            const pos = trial.sequence.indexOf(f.id);
            const shown = pos !== -1 && pos < i;
            f.glow = f.id === id ? 1 : (shown ? 0.28 : 0);
            f.lift = f.id === id ? 1 : 0;
            f.hue = showHue;
          }
          if (settings.geluid) Sound.step();
        });
        // settle the lit spot back down before the next (motion-comfort)
        after(t + stepDur - 140, () => { const f = fx.get(id); if (f) f.lift = 0; });
        t += stepDur;
      });
      after(t + 220, startRecall);
    }

    function startRecall(): void {
      clearAll();
      phase = 'recall';
      banner(terug);
    }

    function onPick(idStr: string): void {
      if (phase !== 'recall') return;
      const id = parseInt(idStr, 10);
      const res = run.tap(id);
      if (res === 'reshow') {
        if (settings.geluid) Sound.tryAgain();
        phase = 'show'; // freeze taps during the re-show
        const f = fx.get(id);
        if (f) { f.glow = 1; f.lift = 0.5; f.hue = new THREE.Color('#e08a6a'); }
        after(750, showSequence);
      } else {
        if (settings.geluid) Sound.step();
        const f = fx.get(id);
        if (f) { f.glow = 0.6; f.lift = 0; f.hue = okHue; }
        if (res === 'complete') finish();
      }
    }

    const teardownPick = pick3d({
      canvas: ctx.canvas,
      camera,
      raycaster,
      targets: [...fx.values()].map((f) => ({ id: String(f.id), object: f.group })),
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
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
        resolve(summary);
      });
    }

    speak(instructie);
    showSequence();
  });
}

/** The registered 3D corsi variant. rmSafe:false — a flat, labelled grid is the
 *  clearer surface for a visuospatial sequence task under reduced-motion, so the
 *  resolver serves the 2D floor there (3D-IMMERSION-PLAN §4). */
export const corsi3dEngine: Play3dEngine = {
  engine: 'corsi',
  play: playCorsi3d,
  rmSafe: false,
};
