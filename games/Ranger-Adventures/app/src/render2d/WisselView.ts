/**
 * WisselView.ts — 2D render layer for the "wisselen" engine (cognitive
 * flexibility / set-shifting). Day animals → the open clearing, night animals →
 * the den; but the signpost flips now and then ("Nu andersom!") and the child
 * must switch the rule. Accessibility: read-aloud, ≥56px bins, dual-channel
 * feedback (wiggle + sound), explicit flip banner. Never punishing — a wrong tap
 * wiggles and lets you try again, no penalty, no game-over.
 */

import './wissel.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import { store } from '../core/state';
import { Content } from '../content/registry';
import { buildWisselTrial } from '../engines/wisselen';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playWissel(host: HTMLElement, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const diff = store.difficulty('wisselen');
    const copy = step.skin.copy ?? {};
    const trial = buildWisselTrial(step.skin, diff);
    const reduced = settings.reducedMotion;

    const instructie = copy.instructie ?? 'Breng elk dier naar de goede plek.';
    const goed = copy.goed ?? 'Alle dieren op de goede plek!';
    const regelDag = copy.regel ?? 'Dag-dier → open plek. Nacht-dier → het hol.';
    const regelOm = copy.regelOm ?? 'Nu andersom!';

    let idx = 0;
    let andersom = false;
    let sinceFlip = 0;
    let wrong = 0;
    let busy = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    const panel = document.createElement('div');
    panel.className = 'wissel';
    panel.innerHTML =
      `<div class="wissel-bar">` +
      `<p class="wissel-instr">${esc(instructie)}</p>` +
      `<button class="wissel-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="wissel-field" role="group" aria-label="${esc(instructie)}">` +
      `<div class="wissel-sky"></div>` +
      `<div class="wissel-sign"><span class="ws-flag"></span><span class="ws-rule">${esc(regelDag)}</span></div>` +
      `<div class="wissel-stage">` +
      `<button class="wissel-bin bin-open" type="button" aria-label="open plek"><span class="bin-ico">☀️</span><span class="bin-label">open plek</span></button>` +
      `<div class="wissel-center"></div>` +
      `<button class="wissel-bin bin-hol" type="button" aria-label="het hol"><span class="bin-ico">🌙</span><span class="bin-label">het hol</span></button>` +
      `</div>` +
      `<div class="wissel-progress" aria-hidden="true"></div>` +
      `</div>`;
    host.appendChild(panel);

    const field = panel.querySelector('.wissel-field') as HTMLDivElement;
    const sign = panel.querySelector('.wissel-sign') as HTMLDivElement;
    const flag = panel.querySelector('.ws-flag') as HTMLSpanElement;
    const rule = panel.querySelector('.ws-rule') as HTMLSpanElement;
    const center = panel.querySelector('.wissel-center') as HTMLDivElement;
    const dotsBox = panel.querySelector('.wissel-progress') as HTMLDivElement;
    const binOpen = panel.querySelector('.bin-open') as HTMLButtonElement;
    const binHol = panel.querySelector('.bin-hol') as HTMLButtonElement;
    panel.querySelector('.wissel-speak')?.addEventListener('click', () => narrator.speak(rule.textContent ?? instructie));

    binOpen.addEventListener('click', () => choose('open'));
    binHol.addEventListener('click', () => choose('hol'));

    function renderDots(): void {
      dotsBox.innerHTML = trial.queue
        .map((_, i) => `<span class="wp-dot${i < idx ? ' done' : i === idx ? ' current' : ''}"></span>`)
        .join('');
    }

    function renderAnimal(): void {
      const cur = trial.queue[idx];
      if (!cur) return;
      const a = Content.animal(cur.id);
      center.classList.remove('wrong', 'fly-open', 'fly-hol');
      center.innerHTML =
        `<span class="wc-token">${esc((a?.naam ?? cur.id).slice(0, 2))}</span>` +
        `<span class="wc-name">${esc(a?.naam ?? cur.id)}</span>`;
      rule.textContent = andersom ? regelOm : regelDag;
      field.classList.toggle('inverted', andersom);
      renderDots();
    }

    function correctBin(): 'open' | 'hol' {
      const cur = trial.queue[idx];
      const natural = cur.dag ? 'open' : 'hol';
      return andersom ? (natural === 'open' ? 'hol' : 'open') : natural;
    }

    function choose(bin: 'open' | 'hol'): void {
      if (busy || idx >= trial.queue.length) return;
      if (bin === correctBin()) {
        busy = true;
        if (settings.geluid) Sound.correct();
        center.classList.add(`fly-${bin}`);
        after(reduced ? 240 : 540, () => {
          idx += 1;
          if (idx >= trial.queue.length) return finish();
          sinceFlip += 1;
          if (sinceFlip >= trial.flipEvery) {
            andersom = !andersom;
            sinceFlip = 0;
            flag.textContent = 'Bordje draait!';
            sign.classList.add('flipping');
            if (settings.geluid) Sound.select();
            after(reduced ? 700 : 1400, () => { flag.textContent = ''; sign.classList.remove('flipping'); });
          }
          renderAnimal();
          busy = false;
        });
      } else {
        wrong += 1;
        if (settings.geluid) Sound.tryAgain();
        center.classList.remove('wrong');
        requestAnimationFrame(() => center.classList.add('wrong'));
        after(480, () => center.classList.remove('wrong'));
      }
    }

    function finish(): void {
      if (settings.geluid) Sound.found();
      const toast = document.createElement('div');
      toast.className = 'feedback-toast ok';
      toast.textContent = goed;
      field.appendChild(toast);
      if (settings.voorlezen) narrator.speak(goed);
      const correct = wrong === 0 ? 1 : 0;
      after(1500, () => { clearTimers(); narrator.stop(); panel.remove(); resolve({ trials: 1, correct }); });
    }

    renderAnimal();
  });
}
