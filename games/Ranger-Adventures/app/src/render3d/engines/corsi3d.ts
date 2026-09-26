/**
 * corsi3d.ts — the diegetic 3D variant of the "corsi" engine (visuospatial
 * sequence memory), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildCorsiTrial` builder
 * and drives the SAME pure `CorsiRun` core as the 2D `playRoute`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the
 * route is recalled with no wrong tap). 3D changes ONLY the staging and the input.
 *
 * 2026-09-26 staging: the seven spots are real stones from the world (the boulder
 * GLB, small), each seated on the rendered ground at the 2D layout's position, on a
 * patch in front of the ranger (he stands behind the lens, never on a stone). The
 * route plays back ONE stone at a time — a warm light and a small lift, then dark
 * again before the next — only after the camera has settled, so the order is clear.
 * The child clicks the stones back; a right stone stays softly green.
 *
 * Never-scary / motion-comfort (§1e): stones only glow and lift a little; one eased
 * reframe (a cut under reduced-motion); every word + read-aloud in the DOM card.
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildCorsiTrial, CorsiRun } from '../../engines/corsi';
import { store } from '../../core/state';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, contactShadow, hintAnchor, pick3d, registerActivityWin, registerPlayHint,
  activityScopeSignal,
} from '../play/kit';
import { patchLocal } from '../play/kit-math';
import { Stage } from '../play/stage';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Half-size of the stone patch (m). */
const HALF_W = 1.9;
const HALF_D = 1.45;
const STONE_H = 0.22;

const SHOW = '#ffd27a';  // the warm "this one" light
const OK = '#8fd6a0';    // calm green for a right stone
const WRONG = '#e8a27a'; // soft warm for a wrong stone (never red-alarm)

interface StoneFx {
  id: number;
  group: THREE.Group;   // the stone (+ its shadow), lifted as one
  glow: Glow;
  anchor: THREE.Object3D;
  base: number;         // ground y
  lift: number;         // 0..1 target lift
  cur: number;          // eased lift
  level: number;        // glow level 0..1
  color: string;
}

export function playCorsi3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f).
    const diff = store.difficulty('corsi');
    const trial = buildCorsiTrial(diff);
    const run = new CorsiRun(trial.sequence);

    const instructie = (settings.jargon && copy.instructieKnap) || copy.instructie || 'Onthoud de weg.';
    const tonen = copy.toon ?? 'Kijk goed welke weg de groep liep…';
    const terug = copy.terug ?? 'Wijs de weg terug.';
    const goed = copy.goed ?? 'Precies de goede weg!';

    const stage = new Stage(ctx, { halfW: HALF_W, halfD: HALF_D, tall: 0.45, pitchDeg: 40, insetBottom: 110, insetTop: 70 });
    const reframe = stage.reframe();
    let settled = false;

    const fx = new Map<number, StoneFx>();
    let phase: 'wait' | 'show' | 'recall' | 'done' = 'wait';
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    // ---- the accessible DOM card (all words + read-aloud live here) ----
    function banner(text: string): void {
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom"><div class="p3-card"><div class="p3-row">` +
          `<p class="p3-text">${esc(text)}</p>` +
          `<button class="p3-speak" type="button" aria-label="Lees voor">🔊</button>` +
          `</div></div></div>`,
      );
      card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
    }

    // ---- the frame loop: reframe, then the stones' eased lift + glow ----
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (activityScopeSignal()?.aborted) { clearTimers(); stage.dispose(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (reframe.update(dt) && !settled) { settled = true; maybeStart(); }
      for (const f of fx.values()) {
        f.cur += (f.lift - f.cur) * (reduced ? 1 : Math.min(1, dt * 12));
        f.group.position.y = f.base + f.cur * 0.14;
        f.glow.set(f.level, f.color);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---- lay the stones (the 2D layout on the ground) ----
    let teardownPick: (() => void) | null = null;
    let loaded = false;
    void (async () => {
      await Promise.all(trial.spots.map(async (s, i) => {
        const { u, v } = patchLocal(s.x, s.y, HALF_W, HALF_D);
        const group = new THREE.Group();
        const p = stage.at(u, v);
        group.position.copy(p);
        stage.add(group);
        const sh = contactShadow(0.3);
        sh.position.y = 0.015;
        group.add(sh);
        let stone = await stage.plant('prop-boulder', STONE_H, u, v, i * 1.7);
        if (stone) {
          group.add(stone);
          stone.position.set(0, -0.03, 0); // bedded a little into the ground
          stone.scale.set(1.35, 1, 1.35);
        } else {
          stone = new THREE.Group();
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 1 }));
          m.scale.set(1.2, 0.55, 1);
          stone.add(m);
          group.add(stone);
        }
        const anchor = hintAnchor(stone, 0.8);
        fx.set(s.id, { id: s.id, group, glow: new Glow(stone, SHOW), anchor, base: p.y, lift: 0, cur: 0, level: 0, color: SHOW });
      }));
      if (activityScopeSignal()?.aborted) return;
      teardownPick = pick3d({
        canvas: ctx.canvas,
        camera,
        raycaster,
        targets: [...fx.values()].map((f) => ({ id: String(f.id), object: f.group })),
        onPick,
      });
      loaded = true;
      maybeStart();
    })().catch((e) => console.error('[corsi3d] staging failed', e));

    const unHint = registerPlayHint(() => {
      if (phase !== 'recall') return null;
      const f = fx.get(run.expected);
      return f ? { id: String(f.id), target: f.anchor } : null;
    });

    function allDark(): void {
      for (const f of fx.values()) { f.level = 0; f.lift = 0; f.color = SHOW; }
    }

    /** Start the route once the stones stand AND the camera is still (never mid-move). */
    function maybeStart(): void {
      if (phase !== 'wait' || !loaded || !settled) return;
      showSequence();
    }

    function showSequence(): void {
      clearTimers();
      phase = 'show';
      allDark();
      banner(tonen);
      speak(tonen);
      const on = reduced ? 620 : 700;   // how long a stone stays lit
      const gap = 300;                  // dark between two stones, so each is its own beat
      let t = 1100;
      trial.sequence.forEach((id) => {
        after(t, () => {
          allDark();
          const f = fx.get(id);
          if (f) { f.level = 1; f.lift = 1; f.color = SHOW; }
          if (settings.geluid) Sound.step();
        });
        after(t + on, () => { const f = fx.get(id); if (f) { f.level = 0; f.lift = 0; } });
        t += on + gap;
      });
      after(t + 250, startRecall);
    }

    function startRecall(): void {
      allDark();
      phase = 'recall';
      banner(terug);
      speak(terug);
    }

    function onPick(idStr: string): void {
      if (phase !== 'recall') return;
      const id = parseInt(idStr, 10);
      const res = run.tap(id);
      const f = fx.get(id);
      if (res === 'reshow') {
        if (settings.geluid) Sound.tryAgain();
        phase = 'show'; // freeze taps during the re-show
        allDark();
        if (f) { f.level = 0.8; f.lift = 0.4; f.color = WRONG; }
        banner('Kijk nog een keer.');
        after(1000, showSequence);
      } else {
        if (settings.geluid) Sound.step();
        if (f) { f.level = 0.3; f.lift = 0; f.color = OK; }
        if (res === 'complete') finish();
      }
    }

    function finish(): void {
      if (phase === 'done') return;
      phase = 'done';
      if (settings.geluid) Sound.found();
      banner(goed);
      speak(goed);
      const summary = run.summary();
      after(1600, () => {
        clearTimers();
        narrator.stop();
        teardownPick?.();
        unHint();
        cancelAnimationFrame(raf);
        stage.dispose();
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
        resolve(summary);
      });
    }

    registerActivityWin(() => finish()); // W2.3: dev-only win → genuine resolve + teardown
    banner(instructie);
    speak(instructie);
  });
}

/** The registered 3D corsi variant. rmSafe:false — a flat top-down grid preserves the
 *  true spot positions a visuospatial sequence task measures, so the resolver serves
 *  the 2D floor under reduced-motion (3D-IMMERSION-PLAN §4). The 3D path itself is
 *  already cuts-not-moves (reframe cuts, the stone lift snaps, no pulse). */
export const corsi3dEngine: Play3dEngine = {
  engine: 'corsi',
  play: playCorsi3d,
  rmSafe: false,
};
