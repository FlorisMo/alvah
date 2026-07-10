/**
 * roep3d.ts — de diegetische 3D-twin van de perceptie-slice "Ken je roep"
 * (Engine-01, W6.4b1). Een vogel roept; het kind kiest wélke vogel dat was uit
 * een rij calme vogelvormen op de tak bij de vogelkijkhut. Dit is de wereld-view
 * naast de 2D-vloer (`render2d/RoepView`); de wereld-entree (zitplek + wayfinding
 * + missionView) landt in W6.4b2.
 *
 * Construct-pariteit (bevroren, BUILD-PLAN §1f): deze view deelt de PURE
 * `RoepRun`-kern met de 2D-view — dezelfde `buildRoepTrial` + dezelfde staircase
 * over het aantal afleiders — en levert dus een IDENTIEKE `BeatSummary`
 * (`{ trials: ronden, correct }`). 3D verandert ALLEEN de enscenering (de vogels
 * staan als calme vormen op de heide, de roep klinkt op locatie, de keuze is een
 * raycast-tik) en NOOIT wát gemeten wordt: zelfde pool, zelfde roep, zelfde score.
 * Pariteit is by construction (beide views drijven één `RoepRun`), geverifieerd
 * door `roep.parity.test.ts`.
 *
 * Toegankelijkheid + motion-comfort (§1e): elke vogel draagt zijn roep óók als
 * TEKST naast de audio (dubbel kanaal, speelbaar met gedempt geluid, nooit
 * alleen-audio), read-aloud in de verankerde DOM-kaart, ≥56px raycast-tikbollen
 * (gedeelde kit), en de reframe cut onder reduced-motion. Nooit game-over: een mis
 * laat rustig zien wélke vogel het was en de beat loopt altijd alle ronden uit.
 */

import * as THREE from 'three';
import '../../render2d/roep.css';
import type { BeatSummary } from '../../core/skill';
import type { WorldCtx } from '../play/types';
import { buildRoepTrial, RoepRun, ROEP_COPY, type RoepDiff, type RoepVogel } from '../../engines/roep';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { anchoredPrompt, liftReframeAboveGround, makeReframe, pick3d, registerActivityWin, activityScopeSignal } from '../play/kit';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Half-width of the bird row laid around the sit-spot (metres). */
const SPREAD = 3.0;

/** Calm earthy hues so each bird is a distinct, memorable form (never-scary; all
 *  muted heath tones). The glow on top is a warm "calling" light. */
const BIRD_HUES = ['#3a3a40', '#8a7b5a', '#b98a5a', '#7e8a6e', '#6e8a5e', '#c9a94e'];

/** A calm, still bird form. Its own material so it can glow (call + answer
 *  feedback) without touching any other mesh. */
interface BirdFx {
  id: string;
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  glow: number;   // 0..1 target emissive level
  lift: number;   // 0..1 target lift (dual-channel with colour)
  cur: number;    // eased current lift
  hue: THREE.Color;
  live: boolean;  // is this bird one of the current round's options?
}

export function playRoep3d(ctx: WorldCtx, diff: RoepDiff = {}): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const scene = ctx.scene as THREE.Scene;
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity §1f).
    const trial = buildRoepTrial(diff);
    const run = new RoepRun(trial, () => Math.random());
    const byId = new Map<string, RoepVogel>(trial.vogels.map((v) => [v.id, v]));

    const sx = ctx.activitySpot.x, sy = ctx.activitySpot.y, sz = ctx.activitySpot.z;
    const callHue = new THREE.Color('#ffe6a8'); // warm "calling" glow
    const okHue = new THREE.Color('#8fd6a0');   // calm green for the right bird
    const missHue = new THREE.Color('#e08a6a'); // soft warm for a wrong tap

    // ---- stage the full pool as calm perched forms in a gentle arc ----
    const fx = new Map<string, BirdFx>();
    const n = trial.vogels.length;
    trial.vogels.forEach((v, i) => {
      const f = n > 1 ? i / (n - 1) : 0.5; // 0..1 across the row
      const x = sx + (f - 0.5) * 2 * SPREAD;
      const z = sz - Math.abs(f - 0.5) * 0.8; // slight arc — ends sit a touch back
      const base = new THREE.Color(BIRD_HUES[i % BIRD_HUES.length]);
      const mat = new THREE.MeshStandardMaterial({
        color: base, emissive: callHue.clone(), emissiveIntensity: 0, roughness: 0.92,
      });
      const group = new THREE.Group();
      // a small calm bird silhouette: a rounded body, a head, a little tail
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat);
      body.scale.set(1, 0.85, 1.25);
      body.position.y = 0.5;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat);
      head.position.set(0, 0.78, 0.16);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), mat);
      tail.rotation.x = Math.PI / 2.2;
      tail.position.set(0, 0.46, -0.3);
      const perch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: '#6b5a44', roughness: 1 }),
      );
      perch.position.y = 0.2;
      group.add(perch, body, head, tail);
      group.position.set(x, sy, z);
      scene.add(group);
      fx.set(v.id, { id: v.id, group, mat, glow: 0, lift: 0, cur: 0, hue: callHue, live: false });

      // a camera-facing name tag (dual-channel with the form's hue), like the 2D names
      const label = makeLabel(v.naam);
      label.position.set(0, 1.2, 0);
      group.add(label);
    });

    // ---- §1e reframe — a calm raised look over the whole row (cuts if reduced) ----
    const lookAt = new THREE.Vector3(sx, sy + 0.6, sz);
    const to = new THREE.Vector3(sx, sy + 3.2, sz + 5.2);
    liftReframeAboveGround(to, ctx.groundY); // D1.3: never land the lens under the terrain
    const reframe = makeReframe(camera, to, lookAt, reduced, 0.35);

    function applyFx(fb: BirdFx): void {
      fb.mat.emissive.copy(fb.hue);
      fb.mat.emissiveIntensity = fb.glow;
      const lift = reduced ? fb.lift : fb.cur;
      fb.group.position.y = sy + lift * 0.18;
      const sc = 1 + lift * 0.14;
      fb.group.scale.set(sc, sc, sc);
      // dim the birds that aren't in play this round (the row never jumps)
      fb.mat.opacity = fb.live ? 1 : 0.38;
      fb.mat.transparent = !fb.live;
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (activityScopeSignal()?.aborted) return; // F-26: "Stop de missie" tears the step down
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reframe.update(dt);
      for (const fb of fx.values()) {
        fb.cur += (fb.lift - fb.cur) * (reduced ? 1 : Math.min(1, dt * 10));
        applyFx(fb);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    let phase: 'kies' | 'pauze' | 'done' = 'kies';
    let round: { target: string; opties: string[] } | null = null;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    // ---- the accessible DOM banner (all words + the roep-text + read-aloud) ----
    let bannerEl: HTMLDivElement | null = null;
    function banner(text: string, roep: string): void {
      bannerEl = anchoredPrompt(
        ctx.prompt,
        `<div class="roep3d-card" style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;padding:0 16px;">` +
          `<div class="roep-bar" style="max-width:560px;flex-direction:column;gap:8px;">` +
          `<div style="display:flex;align-items:center;gap:10px;">` +
          `<p class="roep-instr" style="margin:0;">${esc(text)}</p>` +
          `<button class="roep-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div>` +
          (roep
            ? `<button class="roep-call" type="button" aria-label="Speel de roep">` +
              `<span class="rc-ico">🔊</span><span class="rc-text">${esc(roep)}</span></button>`
            : '') +
          `</div></div>`,
      );
      bannerEl.querySelector('.roep-speak')?.addEventListener('click', () => narrator.speak(text));
      bannerEl.querySelector('.roep-call')?.addEventListener('click', () => { if (phase === 'kies') playCall(); });
    }

    function playCall(): void {
      if (!round) return;
      if (settings.geluid) Sound.call(round.target);
      const roep = byId.get(round.target)?.roep ?? '';
      if (settings.voorlezen) narrator.speak(roep);
    }

    function clearGlow(): void {
      for (const fb of fx.values()) { fb.glow = 0; fb.lift = 0; fb.hue = callHue; }
    }

    function nextRound(): void {
      clearTimers();
      round = run.next();
      if (!round) { finish(); return; }
      phase = 'kies';
      clearGlow();
      const live = new Set(round.opties);
      for (const [id, fb] of fx) fb.live = live.has(id);
      const roep = byId.get(round.target)?.roep ?? '';
      banner(ROEP_COPY.luister, roep);
      after(reduced ? 460 : 320, playCall);
    }

    function onPick(id: string): void {
      if (phase !== 'kies' || !round) return;
      if (!round.opties.includes(id)) return; // only the round's birds answer
      phase = 'pauze';
      const res = run.answer(id);
      const picked = fx.get(id);
      if (res === 'goed') {
        if (picked) { picked.glow = 0.8; picked.lift = 0.5; picked.hue = okHue; }
        if (settings.geluid) Sound.correct();
        banner(ROEP_COPY.goed, '');
        speak(ROEP_COPY.goed);
      } else {
        if (picked) { picked.glow = 1; picked.lift = 0.25; picked.hue = missHue; }
        const truth = fx.get(round.target); // show which bird it really was
        if (truth) { truth.glow = 0.8; truth.lift = 0.5; truth.hue = okHue; }
        if (settings.geluid) Sound.tryAgain();
        banner(ROEP_COPY.mis, '');
        speak(ROEP_COPY.mis);
      }
      after(reduced ? 1500 : 1150, nextRound);
    }

    const teardownPick = pick3d({
      canvas: ctx.canvas,
      camera,
      raycaster,
      targets: [...fx.values()].map((fb) => ({ id: fb.id, object: fb.group })),
      onPick,
    });

    function finish(): void {
      phase = 'done';
      round = null;
      clearGlow();
      if (settings.geluid) Sound.found();
      banner(ROEP_COPY.klaar, '');
      speak(ROEP_COPY.klaar);
      const summary = run.summary();
      after(1500, () => {
        clearTimers();
        narrator.stop();
        teardownPick();
        cancelAnimationFrame(raf);
        for (const fb of fx.values()) {
          fb.group.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const m = mesh.material as THREE.Material | undefined;
            if (m) m.dispose();
          });
          scene.remove(fb.group);
        }
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        resolve(summary);
      });
    }

    // W2.3 dev-only win → drive the GENUINE resolve: answer every remaining round
    // correctly (real scoring, real BeatSummary, real teardown), then finish.
    registerActivityWin(() => {
      clearTimers();
      let guard = 0;
      while (!run.finished && guard++ < 64) {
        if (!round) round = run.next();
        if (!round) break;
        run.answer(round.target);
        round = null;
      }
      finish();
    });

    speak(ROEP_COPY.instructie);
    nextRound();
  });
}

/** A small camera-facing name sprite (depthWrite off) so the bird is named in
 *  world — the dual-channel partner to its hue (no chrome, readable). */
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
