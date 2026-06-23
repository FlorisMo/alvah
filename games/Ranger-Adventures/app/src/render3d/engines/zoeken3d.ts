/**
 * zoeken3d.ts — the diegetic 3D variant of the "zoeken" engine (visual search /
 * sustained attention), the first in-place mini-game proving the 3D play harness
 * (3D-IMMERSION-PLAN §3, BUILD-PLAN §1f / ledger 45c).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildZoekenTrial` builder
 * and emits the SAME `BeatSummary` (`{ trials: 1, correct }`, correct = first-tap
 * hit) as the 2D `playZoeken`. 3D changes ONLY the spatial layout (the target +
 * decoys become objects on the heath around the activity spot) and the input
 * modality (raycast picks via the shared kit's ≥56px hit-spheres) — never WHAT is
 * measured. The full seeded parity test lands with the Phase-II zoeken box.
 *
 * Never-scary / motion-comfort: the target "drukt zich" (lies still, no startle),
 * highlight is dual-channel (emissive colour + a calm scale breath), the camera
 * reframes with the §1e damped move (cuts under reduced-motion), and all words +
 * read-aloud live in the accessible DOM card so the text path stays complete.
 */

import * as THREE from 'three';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildZoekenTrial, buildSpoor, scoreZoeken } from '../../engines/zoeken';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { Highlight3d, anchoredPrompt, makeReframe, pick3d, spoorTrail } from '../play/kit';
import { heightAt } from '../Biomes';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Map the trial's 0..100 field coords to a calm ~4×3 m patch in front of the spot. */
function placeLocal(x: number, y: number): { dx: number; dz: number } {
  return { dx: ((x - 50) / 100) * 4, dz: ((y - 50) / 100) * 3 };
}

/**
 * The kijker (verrekijker) vignette: a soft binocular frame over the 3D view while
 * the child picks the still target. The search haze (`lensSterkte`) IS the lens edge
 * — no new visual axis (§3d). pointer-events:none so it never blocks `pick3d`; it
 * sits over the canvas, not the accessible card, so all words stay legible. Returns
 * a remover. A plain DOM overlay → zero draw-call cost.
 */
function makeKijker(canvas: HTMLElement, lensSterkte: number): () => void {
  const parent = canvas.parentElement;
  if (!parent) return () => {};
  const edge = (0.55 + Math.max(0, Math.min(1, lensSterkte)) * 0.3).toFixed(2); // 0.55..0.85 opacity
  const v = document.createElement('div');
  v.className = 'kijker-vignette';
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText =
    'position:absolute;inset:0;pointer-events:none;z-index:1;' +
    `background:radial-gradient(ellipse 60% 64% at 50% 46%, transparent 52%, rgba(14,18,11,${edge}) 82%);`;
  parent.appendChild(v);
  return () => v.remove();
}

export function playZoeken3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity).
    const diff = store.difficulty('zoeken');
    const skin = step.skin;
    const trial = buildZoekenTrial(skin, diff);
    const instructie =
      settings.jargon && skin.copy?.instructieKnap
        ? skin.copy.instructieKnap
        : skin.copy?.instructie ?? Content.efTitel('zoeken');
    const goedTxt = skin.copy?.goed ?? 'Daar is hij! Goed gezocht.';

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;

    // ---- build the search patch (one group, disposed on teardown) ----
    const patch = new THREE.Group();
    const spawned: THREE.Mesh[] = [];

    // decoys = neutral heath tufts; the target = a calm still animal blob in the
    // mission colour ("drukt zich" — it does not move, exactly like the 2D tell).
    const decoyMat = new THREE.MeshStandardMaterial({ color: '#6f7d3f', roughness: 1, flatShading: true });
    for (const d of trial.decoys) {
      const { dx, dz } = placeLocal(d.x, d.y);
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), decoyMat);
      tuft.position.set(sx + dx, sy + 0.3, sz + dz);
      tuft.userData.id = `decoy:${d.id}`;
      patch.add(tuft);
      spawned.push(tuft);
    }

    const tgtLocal = placeLocal(trial.target.x, trial.target.y);
    const targetGroup = new THREE.Group();
    targetGroup.position.set(sx + tgtLocal.dx, sy, sz + tgtLocal.dz);
    const targetMat = new THREE.MeshStandardMaterial({ color: '#c98a52', roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.32, 4, 8), targetMat);
    body.position.y = 0.34;
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), targetMat);
    headM.position.set(0, 0.62, 0.12);
    targetGroup.add(body, headM);
    patch.add(targetGroup);
    scene.add(patch);

    // ---- the spoor: a tracking leg of clue legs leading INTO the hide zone ----
    // (§3d) a SEPARATE difficulty axis (legs/faintness from buildSpoor) — it sets
    // the region the eye follows but never touches the decoy set. Static instanced
    // markers (one draw call) → already reduced-motion-safe (no walking, no animation).
    const spoor = buildSpoor(diff);
    const trail = spoorTrail(sx, sz + 5, sx, sz + 0.5, spoor.legs, heightAt, '#d8c6a0');
    trail.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'opacity' in m) { m.transparent = true; m.opacity = spoor.helderheid; } // fainter trail = harder to follow
    });
    scene.add(trail.group);

    // ---- the kijker (verrekijker) vignette over the view (the haze = the lens) ----
    const removeKijker = makeKijker(ctx.canvas, trial.lensSterkte);

    // ---- accessible prompt (all words + read-aloud here) ----
    const promptEl = anchoredPrompt(
      ctx.prompt,
      `<div class="zoeken-bar">` +
        `<p class="zoeken-instr">${esc(instructie)}</p>` +
        `<p class="zoeken-spoor">Volg het spoor naar de schuilplek.</p>` +
        `<button class="zoeken-speak" type="button" aria-label="Lees voor">🔊</button>` +
        `</div>`,
    );
    promptEl.querySelector('.zoeken-speak')?.addEventListener('click', () => narrator.speak(instructie));
    if (settings.voorlezen) narrator.speak(instructie);

    // ---- §1e reframe onto the patch + a calm dual-channel target highlight ----
    const lookAt = new THREE.Vector3(sx + tgtLocal.dx, sy + 0.4, sz + tgtLocal.dz);
    const to = new THREE.Vector3(sx, sy + 2.4, sz + 4.4);
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);
    const highlight = new Highlight3d(targetGroup, '#ffe6a8');

    let misses = 0;
    let done = false;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp long frames (no camera jump)
      last = now;
      reframe.update(dt);
      highlight.update(now / 1000, reduced);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const teardown = pick3d({
      canvas: ctx.canvas,
      camera,
      raycaster,
      targets: [
        { id: 'target', object: targetGroup },
        ...spawned.map((m) => ({ id: m.userData.id as string, object: m })),
      ],
      onPick: (id) => {
        if (done) return;
        if (id === 'target') onFound();
        else onMiss(id);
      },
    });

    function onMiss(id: string): void {
      misses += 1;
      if (settings.geluid) Sound.tryAgain();
      // dual-channel like the 2D twin: the gentle "probeer nog eens" tone (AUDIO) +
      // a soft scale nudge on the tapped tuft (SCALE), never a startle. Never-game-
      // over: a miss only costs the perfect score. (3D runs non-reduced-motion only.)
      const tuft = spawned.find((m) => (m.userData.id as string) === id);
      if (tuft && !reduced) {
        tuft.scale.setScalar(1.18);
        window.setTimeout(() => tuft.scale.setScalar(1), 220);
      }
    }

    function onFound(): void {
      done = true;
      if (settings.geluid) Sound.found();
      const correct = scoreZoeken(misses); // identical scoring to playZoeken (shared rule)

      // win beat: the find is "vastgelegd op de wildcamera" — a snapshot card that
      // feeds the case-board (via the existing mission-completion data gate, §3d).
      const feit = skin.feit ? `<p class="zoeken-feit">${esc(String(skin.feit))}</p>` : '';
      const wildcamLine = 'Vastgelegd op de wildcamera.';
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="zoeken-card wildcam-card">` +
          `<p class="wildcam-kicker">📷 ${wildcamLine}</p>` +
          `<p class="zoeken-goed">${esc(goedTxt)}</p>` +
          feit +
          `<button class="btn-start" type="button">Verder</button>` +
          `</div>`,
      );
      if (settings.voorlezen) {
        narrator.speak(skin.feit ? `${wildcamLine} ${goedTxt}. ${skin.feit}` : `${wildcamLine} ${goedTxt}`);
      }

      card.querySelector('.btn-start')?.addEventListener('click', () => {
        narrator.stop();
        cancelAnimationFrame(raf);
        teardown();
        highlight.clear();
        removeKijker();
        trail.dispose();
        scene.remove(trail.group);
        scene.remove(patch);
        patch.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
        decoyMat.dispose();
        targetMat.dispose();
        card.remove();
        resolve({ trials: 1, correct });
      });
    }
  });
}

/** The registered 3D zoeken variant. rmSafe:false → the resolver serves 2D under
 *  reduced-motion (this variant reframes/pulses; its cuts-not-moves path is the
 *  2D floor for now — a dedicated rm path can flip this in the Phase-II box). */
export const zoeken3dEngine: Play3dEngine = {
  engine: 'zoeken',
  play: playZoeken3d,
  rmSafe: false,
};
