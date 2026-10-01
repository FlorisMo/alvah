/**
 * RouteView.ts — 2D render layer for the "corsi" engine (remember the route).
 * Runs the show → recall state machine in vanilla TS and resolves with the
 * BeatSummary. Accessibility: read-aloud, ≥56px spots, dual-channel feedback,
 * and (under reduced-motion) numbered spots instead of relying on the animation.
 * Run 7: the route plays rounds on the shared span core (engines/span.ts) from the knobs
 * and the play's fork, as the world's route beat does: each round a new route.
 */

import './route.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import type { Play } from '../core/play';
import { store } from '../core/state';
import { looseRng } from '../core/play';
import { GROEI } from '../content/copy';
import { buildCorsiTrial, CorsiRun, PRINT_SPOTS } from '../engines/corsi';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playRoute(host: HTMLElement, step: Step, play?: Play): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const copy = step.skin.copy ?? {};
    const trial = buildCorsiTrial(step.skin, store.knobs('corsi'));

    const tonen = copy.toon ?? 'Kijk goed welke weg de groep liep…';
    const terug = copy.terug ?? 'Wijs de weg terug.';
    const goed = copy.goed ?? 'Precies de goede weg!';
    const instructie = copy.instructie ?? 'Onthoud de weg.';

    // Shared pure core (parity with the 3D twin, §1f): it owns the rounds, the routes,
    // the recall index + the final BeatSummary; this view only renders + shows.
    // Run 7: the play's routes (the world's twin draws the same).
    const run = new CorsiRun(trial, play ? play.fork('corsi').rng : looseRng('corsi'));
    let done = false;
    let busy = true; // (a route is being shown or a new one comes: taps wait)
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => {
      timers.push(window.setTimeout(() => { if (panel.isConnected) fn(); }, ms)); // a stopped step's panel is gone: its timers stand down
    };
    const clearTimers = (): void => {
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
    };

    const panel = document.createElement('div');
    panel.className = 'route';
    panel.innerHTML =
      `<div class="route-bar">` +
      `<p class="route-instr">${esc(instructie)}</p>` +
      `<button class="route-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="route-field" role="group" aria-label="${esc(instructie)}">` +
      `<div class="route-grass"></div>` +
      `<p class="route-banner">${esc(tonen)}</p>` +
      `<div class="route-intro"><button class="btn-start" type="button">Laat de weg zien</button></div>` +
      `</div>`;
    host.appendChild(panel);

    const field = panel.querySelector('.route-field') as HTMLDivElement;
    const banner = panel.querySelector('.route-banner') as HTMLParagraphElement;
    const intro = panel.querySelector('.route-intro') as HTMLDivElement;
    // read-aloud (child:B2): the instruction, then each new line on the banner
    const say = (text: string): void => { if (settings.voorlezen) narrator.speak(text); };
    let started = false;
    panel.querySelector('.route-speak')?.addEventListener('click', () => narrator.speak(
      started ? banner.textContent ?? instructie : instructie));
    say(instructie);

    const spotEls = new Map<number, HTMLButtonElement>();
    for (const s of PRINT_SPOTS) {
      const b = document.createElement('button');
      b.className = 'route-spot';
      b.style.left = `${s.x}%`;
      b.style.top = `${s.y}%`;
      b.setAttribute('aria-label', 'voetstap');
      b.disabled = true;
      b.addEventListener('click', () => onTap(s.id));
      field.appendChild(b);
      spotEls.set(s.id, b);
    }

    intro.querySelector('.btn-start')?.addEventListener('click', () => {
      intro.style.display = 'none';
      started = true;
      say(tonen);
      run.begin();
      showSequence();
    });

    function showSequence(line: string = tonen): void {
      clearTimers();
      busy = true;
      banner.textContent = line;
      for (const b of spotEls.values()) {
        b.disabled = true;
        b.classList.remove('lit', 'active', 'correct', 'wrong');
        b.textContent = '';
      }
      const stepDur = settings.reducedMotion ? 380 : 620;
      let t = 500;
      const seq = [...run.sequence]; // this round's route
      seq.forEach((id, i) => {
        after(t, () => {
          for (const [sid, b] of spotEls) {
            const pos = seq.indexOf(sid);
            b.classList.toggle('active', sid === id);
            b.classList.toggle('lit', pos !== -1 && pos < i);
            b.textContent = settings.reducedMotion && pos !== -1 && pos <= i ? String(pos + 1) : '';
          }
          if (settings.geluid) Sound.step();
        });
        t += stepDur;
      });
      after(t + 200, startRecall);
    }

    function startRecall(): void {
      for (const b of spotEls.values()) {
        b.classList.remove('lit', 'active', 'correct', 'wrong');
        b.textContent = '';
        b.disabled = false;
      }
      busy = false;
      banner.textContent = terug;
      say(terug);
    }

    function onTap(id: number): void {
      if (done || busy) return;
      const b = spotEls.get(id);
      const res = run.tap(id);
      if (res === 'replay' || res === 'ease') {
        // a wrong spot: the route again ('replay'), or silently a shorter one ('ease')
        busy = true;
        if (settings.geluid) Sound.tryAgain();
        if (b) {
          b.classList.remove('wrong');
          requestAnimationFrame(() => b.classList.add('wrong'));
        }
        for (const bb of spotEls.values()) bb.disabled = true;
        banner.textContent = GROEI.kijkNogEens;
        say(GROEI.kijkNogEens);
        after(750, () => showSequence());
        return;
      }
      if (settings.geluid) Sound.step();
      b?.classList.add('correct');
      if (res === 'complete') { finish(); return; }
      if (res === 'next') {
        // the route walked back: a new route (one longer after a clean one)
        busy = true;
        for (const bb of spotEls.values()) bb.disabled = true;
        if (settings.geluid) Sound.correct();
        say(GROEI.nogEenWeg);
        after(900, () => showSequence(GROEI.nogEenWeg));
      }
    }

    function finish(): void {
      done = true;
      for (const b of spotEls.values()) b.disabled = true;
      if (settings.geluid) Sound.found();
      banner.textContent = goed;
      say(goed);
      const summary = run.summary();
      after(1500, () => {
        clearTimers();
        narrator.stop();
        panel.remove();
        resolve(summary);
      });
    }
  });
}
