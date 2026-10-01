/**
 * simon3d.ts — the diegetic 3D variant of the "simon" engine (audio-visual
 * working memory), played IN the world (3D-IMMERSION-PLAN §3).
 *
 * Construct parity (frozen, §1f): it consumes the SAME `buildSimonTrial` builder
 * and drives the SAME pure `SimonRun` core as the 2D `playSimon` (run 7: rounds on the
 * span core from the knobs and the play's fork), so it emits the IDENTICAL `BeatSummary`.
 * 3D changes ONLY staging + input.
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
import type { Play } from '../../core/play';
import type { WorldCtx, Play3dEngine } from '../play/types';
import { buildSimonTrial, SimonRun } from '../../engines/simon';
import { store } from '../../core/state';
import { looseRng } from '../../core/play';
import { GROEI } from '../../content/copy';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, contactShadow, pick3d, registerActivityWin, registerPlayHint, SPEAK_BTN,
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
  lift: number;
  cur: number;
  level: number;
  color: string;
}

export function playSimon3d(ctx: WorldCtx, step: Step, play?: Play): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};

    // SAME engine logic as the 2D view (construct parity §1f); run 7: the play's callers
    const trial = buildSimonTrial(step.skin, store.knobs('simon'));
    const run = new SimonRun(trial.knobs, trial.dieren, play ? play.fork('simon').rng : looseRng('simon'));

    const instructie = copy.instructie ?? 'De dieren roepen. Doe ze na.';
    const luister = copy.luister ?? 'Luister naar de dieren…';
    const echoTxt = copy.echo ?? 'Doe ze na. Klik op de dieren.';
    const goed = copy.goed ?? 'Knap onthouden!';

    // the row: spacing grows with the biggest animal so no two overlap
    const n = trial.dieren.length;
    const sizes = trial.dieren.map((id) => heightFor(id));
    const gapM = Math.max(1.15, Math.max(...sizes) * 1.35);
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

    function banner(text: string, dots = false): void {
      const card = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom"><div class="p3-card"><div class="p3-row">` +
          `<p class="p3-text">${esc(text)}</p>` +
          (dots ? `<p class="p3-dots" aria-hidden="true"></p>` : '') +
          `${SPEAK_BTN}` +
          `</div></div></div>`,
        stage.signal,
      );
      card.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
      showProgress();
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (stage.aborted) { clearTimers(); unHint(); stage.dispose(); return; } // F-26
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
        const animal = await stage.animal(id, u, v, h < PERCH_BELOW ? 1.15 : 0.75);
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
          lift: 0, cur: 0, level: 0, color: CALL,
        });
      }));
      if (stage.aborted) return;
      teardownPick = pick3d({
        canvas: ctx.canvas,
        camera,
        raycaster,
        targets: [...fx.values()].map((f) => ({ id: f.id, object: f.group })),
        onPick,
        signal: stage.signal,
      });
      loaded = true;
      maybeStart();
    })().catch((e) => console.error('[simon3d] staging failed', e));

    const unHint = registerPlayHint(() => {
      if (phase !== 'echo') return null;
      const f = fx.get(run.expected);
      return f ? { id: f.id, target: f.group } : null; // the animal (on its stump) a player sees
    });

    function quiet(): void {
      for (const f of fx.values()) { f.level = 0; f.lift = 0; f.color = CALL; }
    }

    function maybeStart(): void {
      if (phase !== 'wait' || !loaded || !settled) return;
      run.begin();
      listen('queue');
    }

    /** The animals call the sequence. "Luister…" is said first (`queue`: after the
     *  instruction; `speak`: a new line; `none`: just said) and the calls always wait
     *  until the voice is quiet, so no call ever sounds over the words (child:B1/B2). */
    let listenToken = 0;
    function listen(sayIt: 'queue' | 'speak' | 'none'): void {
      clearTimers();
      phase = 'listen';
      quiet();
      banner(luister);
      if (settings.voorlezen && sayIt === 'queue') narrator.queue(luister);
      else if (sayIt === 'speak') speak(luister);
      const token = ++listenToken;
      void (settings.voorlezen ? narrator.quiet(6000) : Promise.resolve()).then(() => {
        if (token !== listenToken || stage.aborted || phase !== 'listen') return;
        const gap = reduced ? 420 : 320;
        let t = 500;
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
      });
    }

    /** how far the echo is: one dot per animal to repeat, filled as they are clicked
     *  (so every right click visibly counts, even when the same animal calls twice) */
    function showProgress(): void {
      const el = ctx.prompt.querySelector('.p3-dots');
      if (el) el.textContent = run.sequence.map((_, i) => (i < run.echoIndex ? '●' : '○')).join(' ');
    }

    function startEcho(): void {
      phase = 'echo';
      quiet();
      banner(echoTxt, true);
      speak(echoTxt);
    }

    function onPick(id: string): void {
      if (phase !== 'echo') return;
      const f = fx.get(id);
      const res = run.tap(id);
      showProgress();
      if (res === 'advance') {
        if (settings.geluid) Sound.call(id);
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; after(380, () => { f.level = 0; f.lift = 0; f.color = CALL; }); }
      } else if (res === 'complete') {
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; }
        finish();
      } else if (res === 'next') {
        phase = 'listen'; // a round echoed: one more caller after a clean one, else a new one as long
        const line = run.grew ? GROEI.erbij : GROEI.rondje;
        if (f) { f.level = 0.45; f.lift = 0.5; f.color = OK; }
        if (settings.geluid) Sound.correct();
        banner(line);
        speak(line);
        after(1300, () => listen('none'));
      } else { // 'replay' (the SAME sequence) or 'ease' (silently a shorter one): recoverable
        phase = 'listen';
        if (f) { f.level = 0.6; f.lift = 0.3; f.color = WRONG; after(650, () => { f.level = 0; f.lift = 0; f.color = CALL; }); }
        if (settings.geluid) Sound.tryAgain();
        banner(GROEI.nogEens);
        speak(GROEI.nogEens);
        after(1400, () => listen('none'));
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
        Sound.stopCall();
        teardownPick?.();
        unHint();
        cancelAnimationFrame(raf);
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        // the lens glides back to the ranger before the world takes it over
        void stage.handBack().then(() => { stage.dispose(); resolve(summary); });
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
