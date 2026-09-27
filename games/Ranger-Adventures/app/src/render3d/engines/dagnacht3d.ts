/**
 * dagnacht3d.ts — the diegetic 3D variant of the "dagnacht" engine (inhibition /
 * impulse control, "rustkracht"), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildDagnachtTrial`
 * builder and drives the SAME pure `DagnachtRun` core as the 2D `playDanger`, so
 * it emits the IDENTICAL `BeatSummary` (`{ trials: total, correct }`, correct =
 * encounters never answered wrong). The decision itself stays a two-choice pick in
 * the accessible DOM card (≥56px), exactly the 2D task.
 *
 * 2026-09-26 staging: each encounter shows ITS OWN subject from the world's cast —
 * the reekalf (the ree GLB at calf size), the adder on a sandy patch, the hungry
 * wild boar, a real mud pool, the open path; for mission 1 the frisling is a piglet,
 * the mother sow stands with her piglets and the rotte waits further up the free
 * path (2026-09-27) — seated on the rendered ground in front
 * of the ranger (he stands behind the lens). The card keeps the question, the ranger
 * rules and the two choices together; the feedback toast sits ABOVE the card so it
 * never covers a button; the "Nu mag het wél" note shows only on the flip encounter.
 *
 * Never-scary / motion-comfort (§1e): the subject is calm and still; a wrong choice
 * makes it step softly AWAY from the child (never toward the camera) + the
 * recoverable retry. One eased reframe (a cut under reduced-motion).
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildDagnachtTrial, DagnachtRun, type Encounter } from '../../engines/dagnacht';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  anchoredPrompt, contactShadow, registerActivityWin, registerPlayHint,
} from '../play/kit';
import { Stage } from '../play/stage';
import { heightFor } from '../play/spawn';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** A soft-edged alpha ramp across a ribbon (opaque middle, feathered sides). */
let _edgeTex: THREE.Texture | null = null;
function edgeTexture(): THREE.Texture {
  if (_edgeTex) return _edgeTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 64, 0);
  // an alphaMap reads the GREEN channel: an opaque black→white→black ramp
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.3, '#fff');
  grad.addColorStop(0.7, '#fff');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  _edgeTex = new THREE.CanvasTexture(c);
  return _edgeTex;
}

/** A sandy footpath running away from the lens (patch-local v0 → v1), gently winding,
 *  draped vertex by vertex over the rendered ground, its sides feathered into the grass. */
function pathRibbon(stage: Stage, v0: number, v1: number, width: number): THREE.Mesh {
  const rows = 24;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const v = v0 + (v1 - v0) * t;
    const u = Math.sin(t * 3.1) * 0.18;
    const w = width * (0.9 + 0.1 * Math.sin(t * 7.3));
    for (const side of [-1, 1]) {
      const p = stage.at(u + side * w * 0.5, v, 0.025);
      pos.push(p.x, p.y, p.z);
      uv.push(side < 0 ? 0 : 1, t);
    }
    if (i < rows) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: '#b39866', roughness: 1, alphaMap: edgeTexture(), transparent: true, depthWrite: false,
    side: THREE.DoubleSide, // (the strip's winding depends on the stage heading)
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

export function playDagnacht3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('dagnacht');
    const trial = buildDagnachtTrial(step.skin, { ...diff, reducedMotion: reduced } as typeof diff);
    const run = new DagnachtRun(trial.encounters.length);
    const instructie = step.skin.copy?.instructie ?? 'Blijf rustig. Maak de goede keuze.';

    // frame the tallest subject whole (a red deer on the free path is 1.5 m), and a
    // little deeper when one waits further up the path (the rotte, the herd)
    const subjectH = (e: Encounter): number =>
      e.subject === 'modderpoel' || (e.subject === 'pad-veilig' && !(e.dier ?? step.skin.dier)) ? 0.4
        : e.subject === 'rotte' || e.subject === 'wildzwijn' ? 0.8
          : heightFor(e.subject === 'reekalf' && (!e.dier || e.dier === 'ree') ? 'reekalf' : e.dier ?? step.skin.dier ?? 'wildzwijn');
    const far = trial.encounters.some((e) => e.subject === 'rotte' || (e.subject === 'pad-veilig' && (e.dier ?? step.skin.dier)));
    const halfD = far ? 1.05 : 0.75;
    const stage = new Stage(ctx, {
      halfW: 1.05, halfD, tall: Math.max(0.9, ...trial.encounters.map(subjectH)) + 0.1, pitchDeg: 24, insetBottom: 300, insetTop: 70,
    });
    const reframe = stage.reframe();

    // ---- the subject of the current encounter (rebuilt per encounter) ----
    let subject: THREE.Group | null = null;
    let subjectToken = 0;
    let leanUntil = 0;

    function clearSubject(): void {
      if (!subject) return;
      subject.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.spawned) return;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      for (const d of (subject.userData.disposers as (() => void)[] | undefined) ?? []) d();
      subject.removeFromParent();
      subject = null;
    }

    /** Build the in-world subject of an encounter from the world's own cast. */
    async function stageSubject(enc: Encounter): Promise<void> {
      const token = ++subjectToken;
      clearSubject();
      const g = new THREE.Group();
      g.userData.disposers = [];
      const disposers = g.userData.disposers as (() => void)[];
      const tickers: ((dt: number) => void)[] = [];
      g.userData.tick = (dt: number) => { for (const t of tickers) t(dt); };
      const addModel = async (id: string, u: number, v: number, turn: number, height?: number): Promise<THREE.Object3D | null> => {
        const s = await ctx.spawnModel(id, { height: height ?? heightFor(id) });
        if (!s) return null;
        disposers.push(() => s.dispose());
        const root = s.root as THREE.Group;
        const p = stage.at(u, v);
        root.position.copy(p);
        root.rotation.y = stage.faceLens(p, turn);
        root.traverse((o) => { o.userData.spawned = true; });
        g.add(root);
        tickers.push((dt) => s.update(dt));
        const sh = contactShadow(Math.max(0.2, (height ?? heightFor(id)) * 0.55));
        sh.position.copy(p).setY(p.y + 0.02);
        g.add(sh);
        return root;
      };
      const tufts = (pts: { u: number; v: number; h: number }[]): void => { g.add(stage.grassMesh(pts, 30)); };
      const path = (): void => { g.add(pathRibbon(stage, -1.6, 3.4, 0.75)); };
      switch (enc.subject) {
        case 'adder':
          g.add(stage.decal('#c9ad7a', 0.75, 0.45, 0, 0, { roughness: 1, layer: 1 }));
          tufts([{ u: -0.85, v: 0.1, h: 0.3 }, { u: 0.9, v: 0.2, h: 0.34 }, { u: 0.7, v: -0.45, h: 0.26 }, { u: -0.6, v: 0.55, h: 0.3 }]);
          await addModel(enc.dier ?? 'adder', 0, 0, 1.3);
          break;
        case 'modderpoel':
          // the mud lies across the sandy path, soft grass along its rim
          path();
          g.add(stage.decal('#4a3826', 0.95, 0.55, 0, 0.05, { roughness: 0.35, layer: 2 }));
          g.add(stage.decal('#2e231a', 0.64, 0.34, 0.05, 0.08, { roughness: 0.08, layer: 3 }));
          tufts([{ u: -1.05, v: 0.1, h: 0.36 }, { u: 1.08, v: -0.05, h: 0.4 }, { u: -0.8, v: 0.55, h: 0.3 }, { u: 0.85, v: 0.6, h: 0.34 }, { u: 0.3, v: 0.72, h: 0.3 }]);
          break;
        case 'pad-veilig':
          // the path runs on, free — the one the ranger may now walk
          path();
          tufts([{ u: -0.7, v: -0.6, h: 0.34 }, { u: 0.72, v: -0.3, h: 0.36 }, { u: -0.75, v: 0.5, h: 0.3 }, { u: 0.7, v: 0.9, h: 0.32 }, { u: -0.62, v: 1.5, h: 0.3 }, { u: 0.6, v: 2.0, h: 0.3 }]);
          if (enc.dier ?? step.skin.dier) await addModel(enc.dier ?? step.skin.dier ?? 'wildzwijn', 0.3, halfD - 0.05, 1.2);
          break;
        case 'zwijn-honger':
          tufts([{ u: -0.75, v: -0.25, h: 0.3 }, { u: 0.8, v: -0.2, h: 0.34 }, { u: 0.55, v: 0.55, h: 0.3 }, { u: -0.6, v: 0.6, h: 0.3 }]);
          await addModel(enc.dier ?? 'wildzwijn', 0, 0.1, 1.1);
          break;
        case 'frisling': {
          // the frisling itself: a small striped piglet in the grass (never a grown boar)
          const h = heightFor('frisling');
          tufts([
            { u: -0.32, v: -0.2, h: 0.26 }, { u: 0.34, v: -0.18, h: 0.24 }, { u: -0.5, v: 0.2, h: 0.3 },
            { u: 0.5, v: 0.25, h: 0.28 }, { u: 0.05, v: 0.42, h: 0.26 },
          ]);
          await addModel('frisling', 0, 0.05, 1.2, h);
          break;
        }
        case 'wildzwijn':
          // the mother sow with her piglets close by her side
          tufts([{ u: -0.95, v: -0.3, h: 0.32 }, { u: 0.95, v: -0.1, h: 0.34 }, { u: -0.7, v: 0.75, h: 0.3 }, { u: 0.8, v: 0.8, h: 0.3 }]);
          await Promise.all([
            addModel('wildzwijn', 0.1, 0.35, 1.2, 0.8),
            addModel('frisling', -0.55, 0.05, 1.0),
            addModel('frisling', 0.6, -0.05, 1.5),
          ]);
          break;
        case 'rotte':
          // the path runs on, free — and further along it the rotte waits: the sow and piglets
          path();
          tufts([{ u: -0.7, v: -0.6, h: 0.34 }, { u: 0.72, v: -0.3, h: 0.36 }, { u: -0.75, v: 0.5, h: 0.3 }, { u: 0.7, v: 0.9, h: 0.32 }]);
          await Promise.all([
            addModel('wildzwijn', 0.35, halfD + 0.45, 1.3, 0.8),
            addModel('frisling', -0.2, halfD + 0.2, 1.1),
            addModel('frisling', 0.8, halfD + 0.05, 1.6),
            addModel('frisling', 0.15, halfD - 0.25, 0.9),
          ]);
          break;
        case 'reekalf':
        default: {
          // the calf stands still in the grass ("drukt zich"): tufts around and in front
          const id = enc.dier === 'ree' || !enc.dier ? 'reekalf' : enc.dier;
          const h = heightFor(id);
          tufts([
            { u: -0.2, v: -0.28, h: h * 0.5 }, { u: 0.22, v: -0.3, h: h * 0.45 }, { u: 0.02, v: -0.36, h: h * 0.4 },
            { u: -0.5, v: 0.1, h: h * 0.45 }, { u: 0.5, v: 0.12, h: h * 0.5 }, { u: -0.1, v: 0.4, h: h * 0.4 },
          ]);
          await addModel(id, 0, 0.05, 1.2);
          break;
        }
      }
      if (token !== subjectToken || stage.aborted) { // superseded
        for (const d of disposers) d();
        return;
      }
      subject = g;
      stage.add(g);
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (stage.aborted) { unHint(); subjectToken++; clearSubject(); stage.dispose(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reframe.update(dt);
      if (subject) {
        (subject.userData.tick as ((dt: number) => void) | undefined)?.(dt);
        // a calm step AWAY from the child on a wrong choice, then back (never a lunge)
        const back = now < leanUntil ? 0.35 : 0;
        const want = back;
        const cur = (subject.userData.v as number | undefined) ?? 0;
        const nv = cur + (want - cur) * (reduced ? 1 : Math.min(1, dt * 5));
        subject.userData.v = nv;
        subject.position.set(stage.fwd.x * nv, 0, stage.fwd.z * nv);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    const unHint = registerPlayHint(() => null); // answered with the DOM choice buttons

    /** Render the current encounter: its subject in the world + the card. */
    function present(): void {
      if (run.finished) return finish();
      const enc = trial.encounters[run.index];
      void stageSubject(enc).catch((e) => console.error('[dagnacht3d] subject failed', e));
      const regels = trial.regels.length
        ? `<div class="p3-chips" aria-label="Ranger-regels">${trial.regels.map((r) => `<span class="p3-chip">${esc(r)}</span>`).join('')}</div>`
        : '';
      const flip = enc.flip ? `<p class="p3-flip">Nu mag het wél</p>` : '';
      // shuffle the two slots so position never cues the answer (as the 2D view)
      const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom dag3d">` +
          `<div class="p3-card">` +
          `<div class="p3-row"><p class="p3-text">${esc(enc.vraag)}</p>` +
          `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button></div>` +
          regels + flip +
          `<div class="p3-choices">` +
          order.map((i) => `<button class="p3-choice" data-i="${i}" type="button">${esc(enc.opties[i].label)}</button>`).join('') +
          `</div></div></div>`,
        stage.signal,
      );
      card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(enc.vraag));
      speak(enc.vraag);
      card.querySelectorAll<HTMLButtonElement>('.p3-choice').forEach((b) => {
        b.addEventListener('click', () => choose(parseInt(b.dataset.i!, 10), enc, card));
      });
    }

    function choose(optIndex: number, enc: Encounter, card: HTMLElement): void {
      const opt = enc.opties[optIndex];
      // lock the choices while feedback shows (one decision per presentation)
      card.querySelectorAll<HTMLButtonElement>('.p3-choice').forEach((b) => { b.disabled = true; });
      if (opt.goed) {
        run.choose(true);
        if (settings.geluid) Sound.correct();
        feedback('ok', enc.uitleg ?? 'Rustig zo.', card, () => { card.remove(); present(); });
      } else {
        run.choose(false); // recoverable — marks the encounter, keeps it up
        if (settings.geluid) Sound.tryAgain();
        leanUntil = performance.now() + (reduced ? 0 : 900); // a calm step away
        feedback('gevolg', enc.gevolg ?? 'Wacht even. Probeer het anders.', card, () => {
          card.remove();
          present(); // re-present the SAME encounter (run.index unchanged)
        });
      }
    }

    function feedback(kind: 'ok' | 'gevolg', text: string, card: HTMLElement, then: () => void): void {
      const t = document.createElement('div');
      t.className = `p3-toast ${kind}`;
      t.setAttribute('role', 'status');
      t.textContent = text;
      const col = card.classList.contains('p3-bottom') ? card : card.querySelector('.p3-bottom') ?? card;
      col.insertBefore(t, col.firstChild); // ABOVE the card: never over a choice
      speak(text);
      const words = text.split(/\s+/).length;
      window.setTimeout(() => { if (!stage.aborted) then(); }, Math.max(kind === 'ok' ? 1600 : 2400, words * 280));
    }

    function finish(): void {
      if (settings.geluid) Sound.found();
      const summary = run.summary();
      narrator.stop();
      cancelAnimationFrame(raf);
      unHint();
      subjectToken++;
      ctx.prompt.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
      // the lens glides back to the ranger before the world takes it over
      void stage.handBack().then(() => { clearSubject(); stage.dispose(); resolve(summary); });
    }

    // W2.3: dev-only win — take the calm (goed) choice on every encounter, then finish.
    registerActivityWin(() => {
      while (!run.finished) run.choose(true);
      finish();
    });

    if (settings.voorlezen) narrator.speak(instructie);
    present();
  });
}

/** The registered 3D dagnacht variant. rmSafe:true — the reduced-motion path is
 *  defined (camera CUTS, the subject's step-away is an instant settle, the decision +
 *  every word stay in the DOM card), so the resolver may serve 3D even under
 *  reduced-motion (3D-IMMERSION-PLAN §4). */
export const dagnacht3dEngine: Play3dEngine = {
  engine: 'dagnacht',
  play: playDagnacht3d,
  rmSafe: true,
};
