/**
 * roep3d.ts — de diegetische 3D-twin van de perceptie-slice "Ken je roep"
 * (Engine-01). Een vogel roept; het kind kiest wélke vogel dat was uit een rij
 * vogels op boomstronken bij de zitplek. De 2D-vloer is `render2d/RoepView`.
 *
 * Construct-pariteit (bevroren, BUILD-PLAN §1f): deze view deelt de PURE
 * `RoepRun`-kern met de 2D-view — dezelfde `buildRoepTrial` + dezelfde staircase —
 * en levert dus een IDENTIEKE `BeatSummary` (`{ trials: ronden, correct }`).
 *
 * 2026-09-26: de vogels zijn de echte vogels van de wereld (raaf, koekoek, merel,
 * roodborsttapuit, groene specht, koolmees), elk op een boomstronk met zijn naam
 * erboven, op een plek vóór de ranger die vrij is van de bank en de hut. Alleen de
 * vogels van deze ronde staan helder; de rest staat zacht op de achtergrond.
 *
 * Toegankelijkheid + motion-comfort (§1e): elke roep ook als TEKST naast de audio
 * (speelbaar met gedempt geluid), voorlezen in de DOM-kaart, ≥56px klikbollen, en
 * één rustige camerabeweging (een cut onder reduced-motion). Nooit game-over: een
 * mis laat rustig zien wélke vogel het was en de beat loopt altijd alle ronden uit.
 */

import * as THREE from 'three';
import '../play/play3d.css';
import type { BeatSummary } from '../../core/skill';
import type { WorldCtx } from '../play/types';
import { buildRoepTrial, RoepRun, ROEP_COPY, type RoepDiff, type RoepVogel } from '../../engines/roep';
import { store } from '../../core/state';
import { looseRng } from '../../core/play';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import {
  Glow, anchoredPrompt, pick3d, registerActivityWin, registerPlayHint, SPEAK_BTN,
} from '../play/kit';
import { Stage, nameTag } from '../play/stage';
import { heightFor, materialsOf } from '../play/spawn';
import { icon } from '../../ui/icons';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Space between two perches (m) and the perch height. */
const GAP = 0.95;
const PERCH_H = 0.36;
/** The birds are small; the task is hearing, so they sit a little larger than life. */
const BIRD_SCALE = 1.5;

const CALL = '#ffd98a';
const OK = '#8fd6a0';
const MISS = '#e8a27a';

interface BirdFx {
  id: string;
  group: THREE.Group;     // perch + bird + tag
  bird: THREE.Object3D | null;
  glow: Glow | null;
  mats: THREE.Material[];
  lift: number;
  cur: number;
  level: number;
  color: string;
  live: boolean;
  shownLive: boolean | null;
}

/** Fade a bird that is not part of this round (the row itself never moves). */
function setLive(f: BirdFx): void {
  if (f.shownLive === f.live) return;
  f.shownLive = f.live;
  for (const m of f.mats) {
    m.transparent = !f.live || (m as THREE.SpriteMaterial).isSpriteMaterial === true;
    m.opacity = f.live ? 1 : 0.35;
    m.needsUpdate = true;
  }
}

export function playRoep3d(ctx: WorldCtx, diff: RoepDiff = {}): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const camera = ctx.camera as THREE.PerspectiveCamera;
    const raycaster = ctx.raycaster as THREE.Raycaster;
    const reduced = ctx.reducedMotion;
    const settings = store.get().settings;

    // SAME engine logic as the 2D view (construct parity §1f).
    const trial = buildRoepTrial(diff);
    const run = new RoepRun(trial, looseRng('roep')); // (the bird bench is no play: a session stream, as its 2D twin)
    const byId = new Map<string, RoepVogel>(trial.vogels.map((v) => [v.id, v]));

    const n = trial.vogels.length;
    const halfW = ((n - 1) * GAP) / 2 + 0.5;
    const stage = new Stage(ctx, { halfW, halfD: 0.45, tall: PERCH_H + 0.85, pitchDeg: 14, insetBottom: 170, insetTop: 70 });
    const reframe = stage.reframe();
    let settled = false;

    const fx = new Map<string, BirdFx>();
    let phase: 'wait' | 'kies' | 'pauze' | 'done' = 'wait';
    let round: { target: string; opties: string[] } | null = null;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    function speak(text: string): void { if (settings.voorlezen) narrator.speak(text); }

    // ---- the DOM card: the words, the roep as text + audio, read-aloud ----
    function banner(text: string, roep: string): void {
      const el = anchoredPrompt(
        ctx.prompt,
        `<div class="p3-bottom roep3d"><div class="p3-card">` +
          `<div class="p3-row"><p class="p3-text">${esc(text)}</p>` +
          `${SPEAK_BTN}</div>` +
          (roep
            ? `<button class="p3-call" type="button" aria-label="Speel de roep">${icon('speaker')}<span>${esc(roep)}</span></button>`
            : '') +
          `</div></div>`,
        stage.signal,
      );
      el.querySelector('.p3-speak')?.addEventListener('click', () => narrator.speak(text));
      el.querySelector('.p3-call')?.addEventListener('click', () => { if (phase === 'kies') playCall(); });
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (stage.aborted) { clearTimers(); unHint(); stage.dispose(); return; } // F-26
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (reframe.update(dt) && !settled) { settled = true; maybeStart(); }
      for (const f of fx.values()) {
        f.cur += (f.lift - f.cur) * (reduced ? 1 : Math.min(1, dt * 10));
        if (f.bird) f.bird.position.y = PERCH_H + f.cur * 0.08;
        f.glow?.set(f.level, f.color);
        setLive(f);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---- the birds of the world, each on a stump, named ----
    let teardownPick: (() => void) | null = null;
    let loaded = false;
    void (async () => {
      await Promise.all(trial.vogels.map(async (v, i) => {
        const t = n > 1 ? i / (n - 1) : 0.5;
        const u = (t - 0.5) * (n - 1) * GAP;
        const vv = Math.abs(t - 0.5) * 0.5; // a gentle arc
        const p = stage.at(u, vv);
        const group = new THREE.Group();
        group.position.copy(p);
        stage.add(group);
        const stump = await stage.plant('prop-tree-stump', PERCH_H + 0.04, u, vv, i * 1.9);
        if (stump) { group.add(stump); stump.position.set(0, -0.04, 0); }
        const bird = await stage.animal(v.id, u, vv, 0.9, { height: heightFor(v.id) * BIRD_SCALE });
        if (bird) { group.add(bird); bird.position.set(0, PERCH_H, 0); }
        const tag = nameTag(v.naam, 0.9);
        tag.position.set(0, PERCH_H + Math.max(0.3, heightFor(v.id) * BIRD_SCALE) + 0.22, 0);
        group.add(tag);
        fx.set(v.id, {
          id: v.id, group, bird,
          glow: bird ? new Glow(bird, CALL) : null,
          mats: [...(bird ? materialsOf(bird) : []), ...(stump ? materialsOf(stump) : []), tag.material],
          lift: 0, cur: 0, level: 0, color: CALL, live: true, shownLive: null,
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
    })().catch((e) => console.error('[roep3d] staging failed', e));

    const unHint = registerPlayHint(() => {
      if (phase !== 'kies' || !round) return null;
      const f = fx.get(round.target);
      return f ? { id: f.id, target: f.group } : null; // the bird on its stump
    });

    /** The call, then its words ("kroa-kroa") — one after the other, never at once. */
    function playCall(): void {
      if (!round) return;
      const roep = byId.get(round.target)?.roep ?? '';
      const target = round.target;
      if (!settings.geluid) { if (settings.voorlezen) narrator.speak(roep); return; }
      narrator.stop();
      const dur = Sound.call(target);
      if (settings.voorlezen) after(dur * 1000 + 150, () => { if (round?.target === target) narrator.speak(roep); });
    }

    function quiet(): void {
      for (const f of fx.values()) { f.level = 0; f.lift = 0; f.color = CALL; }
    }

    function maybeStart(): void {
      if (phase !== 'wait' || !loaded || !settled) return;
      nextRound();
    }

    function nextRound(): void {
      clearTimers();
      round = run.next();
      if (!round) { finish(); return; }
      phase = 'kies';
      quiet();
      const live = new Set(round.opties);
      for (const [id, f] of fx) f.live = live.has(id);
      const roep = byId.get(round.target)?.roep ?? '';
      banner(ROEP_COPY.luister, roep);
      // the call waits until the voice is quiet (the instruction, the last "goed")
      const token = round;
      void (settings.voorlezen ? narrator.quiet(6000) : Promise.resolve()).then(() => {
        if (round === token && phase === 'kies' && !stage.aborted) after(reduced ? 460 : 320, playCall);
      });
    }

    function onPick(id: string): void {
      if (phase !== 'kies' || !round) return;
      if (!round.opties.includes(id)) return; // only this round's birds answer
      phase = 'pauze';
      const res = run.answer(id);
      const picked = fx.get(id);
      if (res === 'goed') {
        if (picked) { picked.level = 0.45; picked.lift = 1; picked.color = OK; }
        if (settings.geluid) Sound.correct();
        banner(ROEP_COPY.goed, '');
        speak(ROEP_COPY.goed);
      } else {
        if (picked) { picked.level = 0.45; picked.lift = 0.4; picked.color = MISS; }
        const truth = fx.get(round.target); // show calmly which bird it really was
        if (truth) { truth.level = 0.45; truth.lift = 1; truth.color = OK; }
        if (settings.geluid) Sound.tryAgain();
        banner(ROEP_COPY.mis, '');
        speak(ROEP_COPY.mis);
      }
      after(reduced ? 1500 : 1250, nextRound);
    }

    function finish(): void {
      if (phase === 'done') return;
      phase = 'done';
      round = null;
      quiet();
      for (const f of fx.values()) f.live = true;
      if (settings.geluid) Sound.found();
      banner(ROEP_COPY.klaar, '');
      speak(ROEP_COPY.klaar);
      const summary = run.summary();
      after(1500, () => {
        clearTimers();
        narrator.stop();
        teardownPick?.();
        unHint();
        cancelAnimationFrame(raf);
        ctx.prompt.querySelectorAll('.ra-overlay').forEach((nn) => nn.remove());
        // the lens glides back to the ranger before the world takes it over
        void stage.handBack().then(() => { stage.dispose(); resolve(summary); });
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
    banner(ROEP_COPY.instructie, '');
  });
}
