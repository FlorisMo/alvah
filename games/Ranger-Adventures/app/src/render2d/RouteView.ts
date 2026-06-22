/**
 * RouteView.ts — 2D render layer for the "corsi" engine (remember the route).
 * Runs the show → recall state machine in vanilla TS and resolves with the
 * BeatSummary. Accessibility: read-aloud, ≥56px spots, dual-channel feedback,
 * and (under reduced-motion) numbered spots instead of relying on the animation.
 */

import './route.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import { store } from '../core/state';
import { buildCorsiTrial, PRINT_SPOTS } from '../engines/corsi';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playRoute(host: HTMLElement, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const diff = store.difficulty('corsi');
    const copy = step.skin.copy ?? {};
    const trial = buildCorsiTrial(diff);

    const tonen = copy.toon ?? 'Kijk goed welke weg de groep liep…';
    const terug = copy.terug ?? 'Wijs de weg terug.';
    const goed = copy.goed ?? 'Precies de goede weg!';
    const instructie = copy.instructie ?? 'Onthoud de weg.';

    let recallIdx = 0;
    let wrong = 0;
    let done = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => {
      timers.push(window.setTimeout(fn, ms));
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
    panel.querySelector('.route-speak')?.addEventListener('click', () => narrator.speak(instructie));

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
      if (settings.voorlezen) narrator.speak(tonen);
      showSequence();
    });

    function showSequence(): void {
      clearTimers();
      banner.textContent = tonen;
      for (const b of spotEls.values()) b.disabled = true;
      const stepDur = settings.reducedMotion ? 380 : 620;
      let t = 500;
      trial.sequence.forEach((id, i) => {
        after(t, () => {
          for (const [sid, b] of spotEls) {
            const pos = trial.sequence.indexOf(sid);
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
      recallIdx = 0;
      banner.textContent = terug;
    }

    function onTap(id: number): void {
      if (done) return;
      const expected = trial.sequence[recallIdx];
      const b = spotEls.get(id);
      if (id === expected) {
        if (settings.geluid) Sound.step();
        b?.classList.add('correct');
        recallIdx += 1;
        if (recallIdx >= trial.sequence.length) finish();
      } else {
        wrong += 1;
        if (settings.geluid) Sound.tryAgain();
        if (b) {
          b.classList.remove('wrong');
          requestAnimationFrame(() => b.classList.add('wrong'));
        }
        for (const bb of spotEls.values()) bb.disabled = true;
        after(750, showSequence);
      }
    }

    function finish(): void {
      done = true;
      for (const b of spotEls.values()) b.disabled = true;
      if (settings.geluid) Sound.found();
      banner.textContent = goed;
      if (settings.voorlezen) narrator.speak(goed);
      const correct = wrong === 0 ? 1 : 0;
      after(1500, () => {
        clearTimers();
        narrator.stop();
        panel.remove();
        resolve({ trials: 1, correct });
      });
    }
  });
}
