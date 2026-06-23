/**
 * wisselen3d.ts — the diegetic 3D variant of the "wisselen" engine (cognitive
 * flexibility / set-shifting), the fifth and last in-place mini-game on the 3D
 * play harness (3D-IMMERSION-PLAN §3, BUILD-PLAN §1f / ledger 60).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildWisselTrial` builder
 * and drives the SAME pure `WisselRun` core as the 2D `playWissel`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the
 * whole queue is sorted with no wrong tap). 3D changes ONLY the staging — the
 * animal-to-sort stands at the activity spot, the two destinations (open plek + het
 * hol) sit either side as calm in-world places, and the signpost between them
 * carries the rule — and never WHAT is measured: same queue, same flip cadence,
 * same binary score. **No cross-construct contamination (§1f, explicit):** both
 * destinations stay VISIBLE + LABELLED the whole time and the ranger never walks to
 * reach one, so this is rule-application (which place does the rule send this animal
 * to *now*), NOT spatial working memory.
 *
 * Never-scary / motion-comfort (§1e): the animal is a calm still earthy form; a
 * correct sort glides it gently to its place + settles (cuts under reduced-motion);
 * the rule flip is dual-channel (the signpost re-colours + turns its label AND the
 * DOM banner swaps the rule words + plays a soft cue) — no startle. A wrong sort is
 * a small wiggle + "probeer de andere plek", recoverable, never a game-over.
 * Dual-channel everywhere (place COLOUR + the glide/settle + sound). ≥56px raycast
 * hit-spheres via the shared kit. The §1e reframe cuts under reduced-motion.
 * rmSafe:false — two labelled DOM-clear bins read cleaner than a 3D perspective for
 * a rule-switch task under reduced-motion, so the resolver serves the proven 2D
 * floor there (matches corsi/simon; this view still degrades gracefully if entered:
 * camera cuts, glide becomes an instant settle, words + cue intact).
 */

import * as THREE from 'three';
import '../../render2d/wissel.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildWisselTrial, WisselRun } from '../../engines/wisselen';
import type { WisselBin } from '../../engines/wisselen';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { anchoredPrompt, makeReframe, pick3d } from '../play/kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** How far either side of the activity spot the two destinations sit (metres). */
const SPREAD = 3.0;

/** The two destination places, staged once and kept visible+labelled the whole
 *  activity (rule-application, not spatial memory). */
interface BinFx {
  bin: WisselBin;
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
  pos: THREE.Vector3;
}

export function playWissel3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('wisselen');
    const trial = buildWisselTrial(step.skin, diff);
    const run = new WisselRun(trial);

    const instructie = copy.instructie ?? 'Breng elk dier naar de goede plek.';
    const goed = copy.goed ?? 'Alle dieren op de goede plek!';
    const regelDag = copy.regel ?? 'Dag-dier → open plek. Nacht-dier → het hol.';
    const regelOm = copy.regelOm ?? 'Nu andersom!';

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;

    // ---- stage the two destinations (always visible + labelled) ----
    // open plek = a warm sunny clearing disc; het hol = a calm dark den mound.
    const sunHue = new THREE.Color('#d8b86a');
    const denHue = new THREE.Color('#5a4f44');
    const okHue = new THREE.Color('#8fd6a0');

    const bins = new Map<WisselBin, BinFx>();
    const mkBin = (bin: WisselBin, x: number, hue: THREE.Color, naam: string): BinFx => {
      const mat = new THREE.MeshStandardMaterial({ color: hue, emissive: okHue.clone(), emissiveIntensity: 0, roughness: 0.95 });
      const group = new THREE.Group();
      // a low place-disc on the ground (the "spot" the animal goes to)
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.12, 20), mat);
      disc.position.y = 0.06;
      group.add(disc);
      if (bin === 'hol') {
        // a calm den mound with a dark opening (still, no shadowy interior to read as scary)
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        mound.position.y = 0.1;
        group.add(mound);
      } else {
        // a small sun marker above the open plek (warm, friendly)
        const sun = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 14, 12),
          new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffcf6a', emissiveIntensity: 0.5, roughness: 0.6 }),
        );
        sun.position.y = 1.0;
        group.add(sun);
      }
      group.position.set(x, sy, sz - 0.6);
      const label = makeLabel(naam);
      label.position.set(0, 1.5, 0);
      group.add(label);
      scene.add(group);
      const fx: BinFx = { bin, group, mat, base: hue.clone(), pos: group.position.clone() };
      bins.set(bin, fx);
      return fx;
    };
    mkBin('open', sx - SPREAD, sunHue, 'open plek');
    mkBin('hol', sx + SPREAD, denHue, 'het hol');

    // ---- the signpost between the places: dual-channel rule cue (colour + label) ----
    const signMat = new THREE.MeshStandardMaterial({ color: '#caa46a', roughness: 0.8 });
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), signMat);
    post.position.y = 0.65;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.06), signMat);
    board.position.y = 1.2;
    sign.add(post, board);
    sign.position.set(sx, sy, sz + 0.4);
    scene.add(sign);
    const signLabel = makeLabel('Bordje');
    signLabel.position.set(0, 1.7, 0);
    sign.add(signLabel);

    function paintSign(): void {
      // inverted rule → the board turns a cooler dusk hue (colour channel), and its
      // word swaps too (the DOM banner carries the readable rule).
      signMat.color.set(run.inverted ? '#8a7bb0' : '#caa46a');
      sign.rotation.y = run.inverted ? Math.PI : 0;
    }

    // ---- the current animal, re-staged at the centre each turn ----
    let animal: THREE.Group | null = null;
    let animalMat: THREE.MeshStandardMaterial | null = null;
    const centre = new THREE.Vector3(sx, sy, sz);

    function disposeAnimal(): void {
      if (!animal) return;
      const g = animal;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | undefined;
        if (m && m !== animalMat) m.dispose();
      });
      animalMat?.dispose();
      scene.remove(g);
      animal = null; animalMat = null;
    }

    function stageAnimal(): void {
      disposeAnimal();
      const cur = run.current;
      if (!cur) return;
      const hue = cur.dag ? new THREE.Color('#b9925a') : new THREE.Color('#6e6457');
      animalMat = new THREE.MeshStandardMaterial({ color: hue, emissive: okHue.clone(), emissiveIntensity: 0, roughness: 0.9 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.36, 4, 8), animalMat);
      body.position.y = 0.38;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), animalMat);
      head.position.set(0, 0.7, 0.14);
      g.add(body, head);
      g.position.copy(centre);
      const naam = Content.animal(cur.id)?.naam ?? cur.id;
      const label = makeLabel(naam);
      label.position.set(0, 1.15, 0);
      g.add(label);
      scene.add(g);
      animal = g;
    }

    // ---- §1e reframe — a calm raised look over the whole bench (cuts if reduced) ----
    const lookAt = new THREE.Vector3(sx, sy + 0.4, sz);
    const to = new THREE.Vector3(sx, sy + 3.4, sz + 5.4);
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);

    // a one-shot glide of the animal to a destination (cut under reduced-motion)
    let glide: { from: THREE.Vector3; to: THREE.Vector3; t: number; done: () => void } | null = null;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reframe.update(dt);
      if (glide && animal) {
        glide.t = Math.min(1, glide.t + (reduced ? 1 : dt / 0.5));
        const e = glide.t * glide.t * (3 - 2 * glide.t); // smoothstep
        animal.position.lerpVectors(glide.from, glide.to, e);
        animal.position.y = centre.y + Math.sin(e * Math.PI) * (reduced ? 0 : 0.18); // gentle hop arc
        if (glide.t >= 1) { const d = glide.done; glide = null; d(); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    // ---- the accessible DOM banner (rule + read-aloud live here) ----
    function banner(text: string): void {
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="wissel3d-card" style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;padding:0 16px;">` +
          `<div class="wissel-bar" style="max-width:520px;">` +
          `<p class="wissel-instr">${esc(text)}</p>` +
          `<button class="wissel-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div></div>`,
      );
      card.querySelector('.wissel-speak')?.addEventListener('click', () => narrator.speak(text));
    }

    function ruleText(): string { return run.inverted ? regelOm : regelDag; }

    let busy = false;

    function onPick(bin: WisselBin): void {
      if (busy || run.finished || glide) return;
      const res = run.choose(bin);
      const target = bins.get(bin)!;
      if (res === 'retry') {
        // wrong place — small wiggle + recoverable hint, animal stays at centre
        if (settings.geluid) Sound.tryAgain();
        if (animal && !reduced) {
          const g = animal;
          const t0 = performance.now();
          const wig = (): void => {
            const k = (performance.now() - t0) / 1000;
            if (k > 0.5 || g !== animal) { if (g === animal) g.rotation.z = 0; return; }
            g.rotation.z = Math.sin(k * 40) * 0.12 * (1 - k / 0.5);
            requestAnimationFrame(wig);
          };
          requestAnimationFrame(wig);
        }
        banner('Bijna! Probeer de andere plek.');
        return;
      }
      busy = true;
      if (settings.geluid) Sound.correct();
      // green confirm on the destination (dual-channel: colour + the glide)
      target.mat.emissiveIntensity = 0.6;
      window.setTimeout(() => { target.mat.emissiveIntensity = 0; }, 520);
      glide = {
        from: animal ? animal.position.clone() : centre.clone(),
        to: new THREE.Vector3(target.pos.x, sy, target.pos.z),
        t: 0,
        done: () => {
          if (res === 'complete') { finish(); return; }
          if (res === 'flip') {
            paintSign();
            if (settings.geluid) Sound.select();
            banner(regelOm); // the flip announcement (signpost re-colours + turns alongside)
            window.setTimeout(() => { stageAnimal(); banner(ruleText()); busy = false; }, reduced ? 500 : 1100);
            return;
          }
          stageAnimal();
          banner(ruleText());
          busy = false;
        },
      };
    }

    const teardownPick = pick3d({
      canvas: ctx.canvas,
      camera,
      raycaster,
      targets: [...bins.values()].map((b) => ({ id: b.bin, object: b.group })),
      onPick: (id) => onPick(id as WisselBin),
    });

    function finish(): void {
      if (settings.geluid) Sound.found();
      banner(goed);
      speak(goed);
      const summary = run.summary();
      window.setTimeout(() => {
        narrator.stop();
        teardownPick();
        cancelAnimationFrame(raf);
        disposeAnimal();
        for (const b of bins.values()) {
          b.group.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const m = mesh.material as THREE.Material | undefined;
            if (m) m.dispose();
          });
          scene.remove(b.group);
        }
        sign.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
        signMat.dispose();
        scene.remove(sign);
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        resolve(summary);
      }, 1500);
    }

    // boot
    paintSign();
    stageAnimal();
    speak(instructie);
    banner(ruleText());
  });
}

/** A small camera-facing name sprite (depthWrite off) — the dual-channel partner to
 *  each place's colour, naming it in-world without HUD chrome. */
function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = '600 32px Inter, system-ui, sans-serif';
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
  sprite.scale.set(0.95, 0.238, 1);
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

/** The registered 3D wisselen variant. rmSafe:false — two clearly-labelled bins on
 *  the flat 2D floor read cleaner than a 3D perspective for a rule-switch task under
 *  reduced-motion, so the resolver serves the 2D floor there (3D-IMMERSION-PLAN §4). */
export const wisselen3dEngine: Play3dEngine = {
  engine: 'wisselen',
  play: playWissel3d,
  rmSafe: false,
};
