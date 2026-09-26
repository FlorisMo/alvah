/**
 * simon3d.ts — the diegetic 3D variant of the "simon" engine (audio-visual
 * working memory), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildSimonTrial` builder
 * and drives the SAME pure `SimonRun` core as the 2D `playSimon`, so it emits the
 * IDENTICAL `BeatSummary` (`{ trials: 1, correct }`, correct = 1 only when the whole
 * growing sequence is echoed with no wrong tap). 3D changes ONLY staging + input.
 *
 * 2026-09-26 staging: the callers are the world's own animals (edelhert, ree, wild
 * zwijn, raaf, das, vos, eekhoorn …) at their real size, in a calm row on a patch in
 * front of the ranger — clear of the cabin, board and jeep, the ranger behind the
 * lens — each with its name over it. "Listen" lights one animal at a time with its
 * real call, only after the camera has settled; "echo" is a click on the animal. A
 * small bird or squirrel sits on a stump so it reads beside a red deer.
 *
 * Never-scary / motion-comfort (§1e): the animals stand still; a call is a warm glow
 * plus a tiny lift; a wrong click replays the SAME sequence (never game-over). One
 * eased reframe (a cut under reduced-motion).
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { Step } from '../../content/types';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildSimonTrial, randomCaller, SimonRun } from '../../engines/simon';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, contactShadow, hintAnchor, pick3d, registerActivityWin, registerPlayHint,
  activityScopeSignal,
} from '../play/kit';
import { Stage, nameTag } from '../play/stage';
import { heightFor } from '../play/spawn';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const CALL = '#ffd98a';  // warm "calling" light
const OK = '#8fd6a0';    // calm green for a right echo
const WRONG = '#e8a27a'; // soft warm for a wrong echo

/** Below this stand height an animal sits on a stump so it reads in the row. */
const PERCH_BELOW = 0.45;

interface CallerFx {
  id: string;
  group: THREE.Group;   // animal (+ perch) + tag, lifted as one
  glow: Glow | null;
  anchor: THREE.Object3D | null;
  lift: number;
  cur: number;
  level: number;
  color: string;
}

export function playSimon3d(ctx: WorldCtx, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
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
    const echoTxt = copy.echo ?? 'Doe ze na. Klik op de dieren.';
    const goed = copy.goed ?? 'Knap onthouden!';

    // the row: spacing grows with the biggest animal so no two overlap
    const n = trial.dieren.length;
    const sizes = trial.dieren.map((id) => heightFor(id));
    const gapM = Math.max(1.15, Math.max(...sizes) * 0.95);
    const halfW = ((n - 1) * gapM) / 2 + 0.3 + Math.max(...sizes) * 0.6; // + half the longest body
    const tallest = Math.max(...sizes.map((h) => (h < PERCH_BELOW ? h + 0.45 : h))) + 0.45; // + name tag
    const stage = new Stage(ctx, { halfW, halfD: 0.55, tall: tallest, pitchDeg: 20, insetBottom: 110, insetTop: 70 });
    const reframe = stage.reframe();
    let settled = false;

    const fx = new Map<string, CallerFx>();
    let phase: 'wait' | 'listen' | 'echo' | 'done' = 'wait';
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

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

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (activityScopeSignal()?.aborted) { clearTimers(); stage.dispose(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (reframe.update(dt) && !settled) { settled = true; maybeStart(); }
      stage.update(dt);
      for (const f of fx.values()) {
        f.cur += (f.lift - f.cur) * (reduced ? 1 : Math.min(1, dt * 10));
        f.group.position.y = f.cur * 0.1;
        f.glow?.set(f.level, f.color);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---- stage the callers: the world's animals in a gentle row ----
    let teardownPick: (() => void) | null = null;
    let loaded = false;
    void (async () => {
      await Promise.all(trial.dieren.map(async (id, i) => {
        const f = n > 1 ? i / (n - 1) : 0.5;
        const u = (f - 0.5) * (n - 1) * gapM;
        const v = Math.abs(f - 0.5) * 0.5; // a slight arc: the ends sit a touch back
        const group = new THREE.Group();
        stage.add(group);
        const h = heightFor(id);
        const p = stage.at(u, v);
        let top = h;
        let perchH = 0;
        if (h < PERCH_BELOW) {
          const stump = await stage.plant('prop-tree-stump', 0.42, u, v, i);
          if (stump) { group.add(stump); perchH = 0.4; }
        }
        const animal = await stage.animal(id, u, v, 1.15);
        if (animal) {
          group.add(animal);
          animal.position.y += perchH;
          top = h + perchH;
        }
        const sh = contactShadow(Math.max(0.25, h * 0.6));
        sh.position.copy(p).setY(p.y + 0.02);
        group.add(sh);
        const tag = nameTag(Content.animal(id)?.naam ?? id, 0.9);
        tag.position.copy(p).setY(p.y + top + 0.28);
        group.add(tag);
        fx.set(id, {
          id, group, glow: animal ? new Glow(animal, CALL) : null,
          anchor: animal ? hintAnchor(animal, 0.6) : null,
          lift: 0, cur: 0, level: 0, color: CALL,
        });
      }));
      if (activityScopeSignal()?.aborted) return;
      teardownPick = pick3d({
        canvas: ctx.canvas,
        camera,
        raycaster,
        targets: [...fx.values()].map((f) => ({ id: f.id, object: f.group })),
        onPick,
      });
      loaded = true;
      maybeStart();
    })().catch((e) => console.error('[simon3d] staging failed', e));

    const unHint = registerPlayHint(() => {
      if (phase !== 'echo') return null;
      const f = fx.get(run.expected);
      return f?.anchor ? { id: f.id, target: f.anchor } : null;
    });

    function quiet(): void {
      for (const f of fx.values()) { f.level = 0; f.lift = 0; f.color = CALL; }
    }

    function maybeStart(): void {
      if (phase !== 'wait' || !loaded || !settled) return;
      run.begin();
      listen();
    }

    function listen(): void {
      clearTimers();
      phase = 'listen';
      quiet();
      banner(luister);
      const gap = reduced ? 420 : 320;
      let t = 900;
      run.sequence.forEach((id) => {
        after(t, () => {
          quiet();
          const f = fx.get(id);
          if (f) { f.level = 0.9; f.lift = 1; f.color = CALL; }
          if (settings.geluid) Sound.call(id);
        });
        const dur = Math.max(650, Sound.callDur(id) * 1000);
        after(t + dur, () => { const f = fx.get(id); if (f) { f.level = 0; f.lift = 0; } });
        t += dur + gap;
      });
      after(t, startEcho);
    }

    function startEcho(): void {
      phase = 'echo';
      quiet();
      banner(echoTxt);
      speak(echoTxt);
    }

    function onPick(id: string): void {
      if (phase !== 'echo') return;
      const f = fx.get(id);
      const res = run.tap(id);
      if (res === 'advance') {
        if (settings.geluid) Sound.call(id);
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; after(380, () => { f.level = 0; f.lift = 0; f.color = CALL; }); }
      } else if (res === 'complete') {
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; }
        finish();
      } else if (res === 'grow') {
        phase = 'listen'; // a full echo below target — celebrate, then the longer row
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; }
        if (settings.geluid) Sound.correct();
        banner('Goed onthouden!');
        after(1200, listen);
      } else { // 'replay' — a wrong click, recoverable: the SAME sequence again
        phase = 'listen';
        if (f) { f.level = 0.6; f.lift = 0.3; f.color = WRONG; after(650, () => { f.level = 0; f.lift = 0; f.color = CALL; }); }
        if (settings.geluid) Sound.tryAgain();
        banner('Luister nog een keer.');
        after(1400, listen);
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
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        resolve(summary);
      });
    }

    registerActivityWin(() => finish()); // W2.3: dev-only win → genuine resolve + teardown
    banner(instructie);
    speak(instructie);
  });
}

/** The registered 3D simon variant. rmSafe:false — the callers are NAMED, and for a
 *  dyslexic player the flat 2D row shows every name at one size, whereas camera-facing
 *  tags in perspective vary; so the resolver serves the 2D floor under reduced-motion
 *  (3D-IMMERSION-PLAN §4). The 3D path itself is cuts-not-moves (reframe cuts, the
 *  call lift snaps, glow is steady). */
export const simon3dEngine: Play3dEngine = {
  engine: 'simon',
  play: playSimon3d,
  rmSafe: false,
};
