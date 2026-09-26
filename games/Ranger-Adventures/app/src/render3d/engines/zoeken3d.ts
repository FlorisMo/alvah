/**
 * zoeken3d.ts — the diegetic 3D variant of the "zoeken" engine (visual search /
 * sustained attention), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildZoekenTrial` builder
 * and emits the SAME `BeatSummary` (`{ trials: 1, correct }`, correct = first-tap
 * hit) as the 2D `playZoeken`. 3D changes ONLY the layout (the trial's field is laid
 * on a patch of real ground in front of the ranger) and the input (a raycast click).
 *
 * 2026-09-26 staging: the animal you search for is the world's own GLB (the frisling
 * for the wild-boar mission, a reekalf, the frog, the nightjar), lying still and
 * partly hidden by grass; the decoys are the world's bushes, birds and a butterfly on
 * a foxglove — no capsules, no glow at the start. Only after a calm wait (or two
 * misses) does the animal get a gentle warm glow as a hint. The "Volg het spoor"
 * hoof prints walk over the rendered ground to the hiding spot. Everything sits per
 * point on `ctx.groundY`; the ranger stands behind the lens, out of the patch.
 *
 * Never-scary / motion-comfort: nothing moves toward the child; one eased reframe
 * (a cut under reduced-motion); all words + read-aloud live in the DOM bar.
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { Step, Distractor } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildZoekenTrial, buildSpoor, scoreZoeken } from '../../engines/zoeken';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, contactShadow, hintAnchor, pick3d, registerActivityWin,
  registerPlayHint, activityScopeSignal, spoorTrail,
} from '../play/kit';
import { patchLocal } from '../play/kit-math';
import { Stage } from '../play/stage';
import { heightFor } from '../play/spawn';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Half-size of the search patch (m): the 2D field laid on the ground. */
const HALF_W = 2.1;
const HALF_D = 1.5;
/** Seconds of searching before the gentle hint glow (or two misses). */
const HINT_AFTER_S = 14;

/** The one you search for: the YOUNG animal of the mission ("Zoek de big"). */
const TARGET_OF: Record<string, string> = { wildzwijn: 'frisling', ree: 'reekalf' };

/** How each decoy kind stands in the world (the 2D token's real-world twin). */
function decoyPlant(d: Distractor, i: number): { id: string; h: number } {
  const a = d.animal ?? '';
  if (a === 'riet') return { id: 'prop-reeds', h: 0.95 };
  if (a === 'pol gras') return { id: 'prop-heather-winter', h: 0.42 };
  const bushes = [
    { id: 'prop-bramble', h: 0.55 }, { id: 'prop-juniper-bush', h: 0.62 }, { id: 'prop-fern', h: 0.5 },
  ];
  return bushes[i % bushes.length];
}

/**
 * The kijker (verrekijker) vignette: a soft warm binocular frame over the 3D view
 * while the child searches. The search haze (`lensSterkte`) IS the lens edge.
 * pointer-events:none so it never blocks picking. Returns a remover (also bound to
 * the activity-abort scope so "Stop de missie" never leaks it onto the hub).
 */
function makeKijker(canvas: HTMLElement, lensSterkte: number): () => void {
  const parent = canvas.parentElement;
  if (!parent) return () => {};
  const edge = (0.28 + Math.max(0, Math.min(1, lensSterkte)) * 0.2).toFixed(2); // 0.28..0.48 opacity
  const v = document.createElement('div');
  v.className = 'kijker-vignette';
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText =
    'position:absolute;inset:0;pointer-events:none;z-index:1;' +
    `background:radial-gradient(ellipse 76% 80% at 50% 52%, transparent 60%, rgba(62,40,20,${edge}) 92%);`;
  parent.appendChild(v);
  const remove = (): void => v.remove();
  activityScopeSignal()?.addEventListener('abort', remove, { once: true });
  return remove;
}

/** A calm stand-in only if a GLB is missing (the game stays playable with no assets). */
function fallbackForm(h: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(h * 0.5, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.scale.set(1.4, 1, 1);
  m.position.y = h * 0.45;
  g.add(m);
  return g;
}

export function playZoeken3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity).
    const diff = store.difficulty('zoeken');
    const skin = step.skin;
    const trial = buildZoekenTrial(skin, diff);
    const spoor = buildSpoor(diff);
    const instructie =
      settings.jargon && skin.copy?.instructieKnap
        ? skin.copy.instructieKnap
        : skin.copy?.instructie ?? Content.efTitel('zoeken');
    const goedTxt = skin.copy?.goed ?? 'Daar is hij! Goed gezocht.';

    // ---- the patch in front of the ranger + the one calm reframe ----
    const stage = new Stage(ctx, { halfW: HALF_W, halfD: HALF_D, tall: 0.7, pitchDeg: 32, insetTop: 116, insetBottom: 8 });
    const reframe = stage.reframe();
    const removeKijker = makeKijker(ctx.canvas, trial.lensSterkte);

    // ---- accessible prompt (all words + read-aloud here) ----
    const promptEl = anchoredPrompt(
      ctx.prompt,
      `<div class="p3-top"><div class="p3-card"><div class="p3-row">` +
        `<div class="p3-lines"><p class="p3-text">${esc(instructie)}</p>` +
        `<p class="p3-sub">Volg het spoor naar de schuilplek.</p></div>` +
        `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
        `</div></div></div>`,
    );
    promptEl.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(instructie));
    if (settings.voorlezen) narrator.speak(instructie);

    let done = false;
    let ready = false;
    let settled = false; // the one reframe has landed (the hint waits for a still camera)
    let misses = 0;
    let target: THREE.Object3D | null = null;
    let anchor: THREE.Object3D | null = null;
    let hint: Glow | null = null;
    let teardownPick: (() => void) | null = null;
    let trail: { group: THREE.Group; dispose: () => void } | null = null;
    const decoys = new Map<string, THREE.Object3D>();
    const t0 = performance.now();

    // ---- the frame loop: reframe, idle clips, the (late) hint glow ----
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (activityScopeSignal()?.aborted) { stage.dispose(); removeKijker(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (reframe.update(dt)) settled = true;
      stage.update(dt);
      if (ready && !done && !hint && target && (misses >= 2 || (now - t0) / 1000 > HINT_AFTER_S)) {
        hint = new Glow(target, '#ffd98a'); // the gentle hint, only after a calm wait
      }
      if (hint && !done) hint.set(reduced ? 0.22 : 0.14 + 0.12 * (Math.sin(now / 700) + 1) / 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---- build the hiding place from the world's own models ----
    const tgtId = TARGET_OF[skin.dier ?? ''] ?? skin.dier ?? 'frisling';
    const tgt = patchLocal(trial.target.x, trial.target.y, HALF_W, HALF_D);
    const tgtH = heightFor(tgtId);
    const inReeds = trial.decoys.some((d) => d.animal === 'riet');

    void (async () => {
      const jobs: Promise<unknown>[] = [];
      // the animal: lying still, side-on (its profile reads best), in the grass
      jobs.push(stage.animal(tgtId, tgt.u, tgt.v, 1.25, { idle: false }).then((g) => {
        target = g ?? stage.add(fallbackForm(tgtH, '#8a6a4a'));
        if (!g) target.position.copy(stage.at(tgt.u, tgt.v));
      }));
      // the decoys the 2D field shows, each its real-world self
      trial.decoys.forEach((d, i) => {
        const p = patchLocal(d.x, d.y, HALF_W, HALF_D);
        const id = `decoy:${d.id}`;
        if (d.k === 'bird') {
          const bird = d.animal ?? 'roodborsttapuit';
          const onGround = bird === 'nachtzwaluw';
          jobs.push((async () => {
            const g = new THREE.Group();
            g.position.copy(stage.at(p.u, p.v));
            stage.add(g);
            if (!onGround) {
              const perch = await stage.plant('prop-heather-winter', 0.34, p.u, p.v, i);
              if (perch) { perch.position.set(0, 0, 0); g.add(perch); }
            }
            const b = await stage.animal(bird, p.u, p.v, -0.9);
            if (b) { g.add(b); b.position.set(0, onGround ? 0 : 0.28, 0); }
            decoys.set(id, g);
          })());
        } else if (d.k === 'butterfly') {
          jobs.push((async () => {
            const g = new THREE.Group();
            g.position.copy(stage.at(p.u, p.v));
            stage.add(g);
            const flower = await stage.plant('prop-foxglove', 0.72, p.u, p.v, i);
            if (flower) { flower.position.set(0, 0, 0); g.add(flower); }
            const fly = await stage.animal(d.animal ?? 'heideblauwtje', p.u, p.v, 0.4);
            if (fly) { fly.position.set(0.06, 0.5, 0.05); g.add(fly); }
            decoys.set(id, g);
          })());
        } else {
          const pl = decoyPlant(d, i);
          jobs.push(stage.plant(pl.id, pl.h, p.u, p.v, i * 1.3).then((g) => {
            if (g) decoys.set(id, g);
          }));
        }
      });
      // the hide: thick grass in FRONT of the animal (toward the lens) and at its
      // flanks, taller than it, so only its back and head peek out — a real search,
      // no glow. A fern leans over its rump.
      const hideH = Math.max(0.3, tgtH * 1.5);
      const hide = [
        { u: tgt.u - 0.16, v: tgt.v - 0.2, h: hideH }, { u: tgt.u + 0.14, v: tgt.v - 0.24, h: hideH * 0.95 },
        { u: tgt.u + 0.0, v: tgt.v - 0.3, h: hideH * 0.8 }, { u: tgt.u - 0.3, v: tgt.v + 0.02, h: hideH * 0.9 },
        { u: tgt.u + 0.3, v: tgt.v + 0.06, h: hideH * 0.85 },
      ];
      // loose ground cover over the rest of the patch, kept off the decoys
      const cover: { u: number; v: number; h: number }[] = [];
      const taken = trial.decoys.map((d) => patchLocal(d.x, d.y, HALF_W, HALF_D)).concat([tgt]);
      for (let k = 0; k < 40 && cover.length < 16; k++) {
        const u = -HALF_W + ((k * 0.618) % 1) * HALF_W * 2;
        const v = -HALF_D + ((k * 0.382 + 0.17) % 1) * HALF_D * 2;
        if (taken.some((q) => Math.hypot(q.u - u, q.v - v) < 0.45)) continue;
        cover.push({ u, v, h: 0.22 + (k % 3) * 0.06 });
      }
      if (inReeds) {
        for (const h of hide.slice(0, 3)) jobs.push(stage.plant('prop-reeds', h.h * 1.5, h.u, h.v, h.u * 7));
        stage.grass(hide.slice(3), 40);
      } else {
        stage.grass(hide, 40);
        jobs.push(stage.plant('prop-fern', Math.max(0.32, tgtH * 1.3), tgt.u + 0.3, tgt.v + 0.12, 2.1));
      }
      stage.grass(cover);
      await Promise.all(jobs);
      if (done || activityScopeSignal()?.aborted) return;

      // a soft contact shadow under the animal so it lies ON the grass
      const sh = contactShadow(Math.max(0.18, tgtH * 0.8));
      sh.position.copy(stage.at(tgt.u, tgt.v, 0.02));
      stage.add(sh);

      // ---- the "Volg het spoor" hoof prints: from the near edge to the hiding spot ----
      const start = stage.at(tgt.u * 0.2 - HALF_W * 0.55, -HALF_D + 0.05);
      const end = stage.at(tgt.u, tgt.v);
      const dir = end.clone().sub(start).setY(0);
      const len = dir.length();
      dir.normalize();
      const stop = start.clone().addScaledVector(dir, Math.max(0.5, len - 0.42));
      trail = spoorTrail(start.x, start.z, stop.x, stop.z, spoor.legs, ctx.groundY, 0.45 + 0.55 * spoor.helderheid);
      stage.add(trail.group);

      anchor = hintAnchor(target!, 0.7);
      teardownPick = pick3d({
        canvas: ctx.canvas,
        camera,
        raycaster,
        targets: [
          { id: 'target', object: target! },
          ...[...decoys].map(([id, object]) => ({ id, object })),
        ],
        onPick: (id) => {
          if (done) return;
          if (id === 'target') onFound();
          else onMiss(id);
        },
      });
      ready = true;
    })().catch((e) => console.error('[zoeken3d] staging failed', e));

    const unHint = registerPlayHint(() => (ready && settled && !done && anchor ? { id: 'target', target: anchor } : null));

    // W2.3: dev-only win — a clean first-tap hit + advance past the win card.
    registerActivityWin(() => {
      if (!done) onFound();
      ctx.prompt.querySelector<HTMLButtonElement>('.zoeken-found .p3-btn')?.click();
    });

    function onMiss(id: string): void {
      misses += 1;
      if (settings.geluid) Sound.tryAgain();
      // a soft nudge on the tapped bush/bird (SCALE) + the gentle tone (AUDIO) — never
      // a startle; a miss only costs the perfect score (never game-over)
      const o = decoys.get(id);
      if (o && !reduced) {
        const s0 = o.scale.x;
        o.scale.setScalar(s0 * 1.12);
        window.setTimeout(() => o.scale.setScalar(s0), 220);
      }
    }

    function onFound(): void {
      done = true;
      if (settings.geluid) Sound.found();
      const correct = scoreZoeken(misses); // identical scoring to playZoeken (shared rule)
      if (target) { hint?.clear(); hint = new Glow(target, '#ffe2a0'); hint.set(0.24); } // a warm "gevonden" light
      teardownPick?.();
      teardownPick = null;

      // the find becomes a photo for the prikbord; the fact itself follows on the
      // mission's own fact card (never twice)
      const kicker = '📷 Klik! Je maakt een foto.';
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom zoeken-found"><div class="p3-card">` +
          `<p class="p3-sub">${esc(kicker)}</p>` +
          `<p class="p3-text">${esc(goedTxt)}</p>` +
          `<button class="p3-btn" type="button">Verder</button>` +
          `</div></div>`,
      );
      if (settings.voorlezen) narrator.speak(`${goedTxt}`);
      card.querySelector('.p3-btn')?.addEventListener('click', () => {
        narrator.stop();
        cancelAnimationFrame(raf);
        unHint();
        hint?.clear();
        removeKijker();
        trail?.dispose();
        stage.dispose();
        card.remove();
        resolve({ trials: 1, correct });
      });
    }
  });
}

/** The registered 3D zoeken variant. rmSafe:false → the resolver serves the 2D
 *  floor under reduced-motion (3D-IMMERSION-PLAN §4): visual search measures scanning
 *  a field where every item is equally available, and a perspective view (near items
 *  larger, the hide partly covering the animal) is a fairer, calmer task in the flat
 *  2D grid for a motion-sensitive reduced-motion player. The 3D path itself is
 *  already cuts-not-moves (reframe cuts, the hint glow freezes steady, the miss nudge
 *  is gated `!reduced`), so nothing here moves the camera under reduced-motion. */
export const zoeken3dEngine: Play3dEngine = {
  engine: 'zoeken',
  play: playZoeken3d,
  rmSafe: false,
};
