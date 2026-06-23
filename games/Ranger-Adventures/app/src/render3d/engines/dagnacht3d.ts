/**
 * dagnacht3d.ts — the diegetic 3D variant of the "dagnacht" engine (inhibition /
 * impulse control), the second in-place mini-game on the 3D play harness
 * (3D-IMMERSION-PLAN §3, BUILD-PLAN §1f / ledger 50).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildDagnachtTrial`
 * builder and drives the SAME pure `DagnachtRun` core as the 2D `playDanger`, so
 * it emits the IDENTICAL `BeatSummary` (`{ trials: total, correct }`, correct =
 * encounters never answered wrong). 3D changes ONLY the staging — the subject you
 * meet on patrol becomes a calm in-world form, the camera §1e-reframes onto it —
 * and never WHAT is measured: the inhibition decision itself stays a two-choice
 * pick in the accessible DOM card (≥56px, dual-channel), exactly the 2D task.
 *
 * Never-scary / motion-comfort (§1e): the subject is calm-posed and STILL (it
 * "drukt zich"); a wrong choice's consequence is a soft lean-AWAY from the child
 * (never a lunge toward the camera) + the recoverable retry — never a game-over.
 * Highlight is dual-channel (emissive colour + a calm breath, steady under
 * reduced-motion); the reframe cuts under reduced-motion. rmSafe: the decision +
 * all words live in the DOM card, so the task is fully playable without the move.
 */

import * as THREE from 'three';
import '../../render2d/danger.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildDagnachtTrial, DagnachtRun, type Encounter } from '../../engines/dagnacht';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { Highlight3d, anchoredPrompt, makeReframe } from '../play/kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** A calm, still subject form in the mission colour (no model load inside the
 *  activity — a low-poly blob keeps it never-scary + cheap). Returns the group. */
function buildSubject(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.34, 4, 8), mat);
  body.position.y = 0.36;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat);
  head.position.set(0, 0.66, 0.14);
  g.add(body, head);
  g.userData.mat = mat;
  return g;
}

export function playDagnacht3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('dagnacht');
    const trial = buildDagnachtTrial(step.skin, { ...diff, reducedMotion: reduced } as typeof diff);
    const run = new DagnachtRun(trial.encounters.length);
    const instructie = step.skin.copy?.instructie ?? 'Blijf rustig. Maak de goede keuze.';

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;

    // ---- the subject the ranger meets, staged just ahead of the activity spot ----
    const subject = buildSubject();
    subject.position.set(sx, sy, sz + 0.4);
    const restZ = subject.position.z;
    scene.add(subject);
    const highlight = new Highlight3d(subject, '#ffe6a8');

    // ---- §1e reframe onto the subject (cuts under reduced-motion) ----
    const lookAt = new THREE.Vector3(sx, sy + 0.5, restZ);
    const to = new THREE.Vector3(sx, sy + 2.2, sz + 4.0);
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);

    // a soft, recoverable lean-AWAY on a wrong choice (never toward the child)
    let leanUntil = 0;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reframe.update(dt);
      highlight.update(now / 1000, reduced);
      // calm away-lean settles back to rest (motion-comfort: small, damped, and
      // AWAY from the viewer — camera sits at +z, so a lean is −z, never a lunge)
      const target = now < leanUntil ? restZ - 0.3 : restZ;
      subject.position.z += (target - subject.position.z) * (reduced ? 1 : 0.08);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    /** Render the current encounter's rule + two choices into the accessible card. */
    function present(): void {
      if (run.finished) return finish();
      const enc = trial.encounters[run.index];
      const flip = enc.flip
        ? `<span class="flip-cue">Nu mag het wél</span>`
        : '';
      const regels = trial.regels.length
        ? `<div class="enc-regels">${trial.regels.map((r) => `<span class="regel-chip">${esc(r)}</span>`).join('')}</div>`
        : '';
      // shuffle the two slots so position never cues the answer (as the 2D view)
      const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="dag3d-card" style="position:absolute;left:0;right:0;bottom:18px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 16px;">` +
          `<div class="danger-bar"><p class="danger-instr">${esc(enc.vraag)}</p>` +
          `<button class="danger-speak" type="button" aria-label="Lees voor">🔊</button></div>` +
          regels +
          `<div class="rule-banner${enc.flip ? ' flip' : ''}">${flip}</div>` +
          `<div class="enc-options">` +
          order
            .map((i) => `<button class="choice-opt" data-i="${i}" type="button"><span class="opt-label">${esc(enc.opties[i].label)}</span></button>`)
            .join('') +
          `</div>` +
          `</div>`,
      );
      card.querySelector('.danger-speak')?.addEventListener('click', () => narrator.speak(enc.vraag));
      speak(enc.vraag);
      card.querySelectorAll<HTMLButtonElement>('.choice-opt').forEach((b) => {
        b.addEventListener('click', () => choose(parseInt(b.dataset.i!, 10), enc, card));
      });
    }

    function choose(optIndex: number, enc: Encounter, card: HTMLElement): void {
      const opt = enc.opties[optIndex];
      // lock the choices while feedback shows (one decision per presentation)
      card.querySelectorAll<HTMLButtonElement>('.choice-opt').forEach((b) => { b.disabled = true; });
      if (opt.goed) {
        run.choose(true);
        if (settings.geluid) Sound.correct();
        feedback('ok', enc.uitleg ?? 'Rustig zo.', card, () => { card.remove(); present(); });
      } else {
        run.choose(false); // recoverable — marks the encounter, keeps it up
        if (settings.geluid) Sound.tryAgain();
        leanUntil = performance.now() + (reduced ? 0 : 700); // calm away-lean
        feedback('gevolg', enc.gevolg ?? 'Wacht even. Probeer het anders.', card, () => {
          card.remove();
          present(); // re-present the SAME encounter (run.index unchanged)
        });
      }
    }

    function feedback(kind: 'ok' | 'gevolg', text: string, card: HTMLElement, then: () => void): void {
      const t = document.createElement('div');
      t.className = `feedback-toast ${kind}`;
      t.textContent = text;
      card.appendChild(t);
      speak(text);
      window.setTimeout(then, kind === 'ok' ? 1500 : (reduced ? 1500 : 2100));
    }

    function finish(): void {
      if (settings.geluid) Sound.found();
      const summary = run.summary();
      narrator.stop();
      cancelAnimationFrame(raf);
      highlight.clear();
      scene.remove(subject);
      subject.traverse((o) => {
        const m = (o as THREE.Mesh).geometry;
        if (m) m.dispose();
      });
      (subject.userData.mat as THREE.Material).dispose();
      ctx.prompt.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
      resolve(summary);
    }

    if (settings.voorlezen) narrator.speak(instructie);
    present();
  });
}

/** The registered 3D dagnacht variant. rmSafe:true — the reduced-motion path is
 *  defined (camera CUTS, highlight steady, subject lean is an instant settle, the
 *  decision + every word stay in the DOM card), so the resolver may serve 3D even
 *  under reduced-motion (3D-IMMERSION-PLAN §4). */
export const dagnacht3dEngine: Play3dEngine = {
  engine: 'dagnacht',
  play: playDagnacht3d,
  rmSafe: true,
};
