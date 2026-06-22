/**
 * SimonView.ts — 2D render layer for the "simon" engine (sound-echo memory).
 * The animals call a growing sequence at dusk; the child taps them back in
 * order. Audio working memory + you learn the real calls. The light-up carries
 * the sequence too, so it plays muted. Accessibility: read-aloud, ≥56px animal
 * buttons, dual-channel feedback (glow + sound + call), reduced-motion tempo.
 * Never punishing — a wrong tap just replays the same sequence, no game-over.
 */

import './simon.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import { store } from '../core/state';
import { Content } from '../content/registry';
import { buildSimonTrial, randomCaller } from '../engines/simon';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playSimon(host: HTMLElement, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const diff = store.difficulty('simon');
    const copy = step.skin.copy ?? {};
    const trial = buildSimonTrial(step.skin, diff);
    const reduced = settings.reducedMotion;

    const instructie = copy.instructie ?? 'De dieren roepen. Doe ze na.';
    const luister = copy.luister ?? 'Luister naar de dieren…';
    const echoTxt = copy.echo ?? 'Doe ze na. Tik de dieren.';
    const goed = copy.goed ?? 'Knap onthouden!';

    let seq: string[] = [];
    let phase: 'intro' | 'listen' | 'echo' | 'pause' | 'done' = 'intro';
    let pos = 0;
    let wrong = 0;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    const panel = document.createElement('div');
    panel.className = 'simon';
    panel.innerHTML =
      `<div class="simon-bar">` +
      `<p class="simon-instr">${esc(instructie)}</p>` +
      `<button class="simon-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="simon-field" role="group" aria-label="${esc(instructie)}">` +
      `<div class="simon-sky"></div>` +
      `<p class="simon-banner">${esc(luister)}</p>` +
      `<div class="simon-dots" aria-hidden="true"></div>` +
      `<div class="simon-row"></div>` +
      `<div class="simon-intro"><button class="btn-start" type="button">Luister</button></div>` +
      `</div>`;
    host.appendChild(panel);

    const banner = panel.querySelector('.simon-banner') as HTMLParagraphElement;
    const dots = panel.querySelector('.simon-dots') as HTMLDivElement;
    const row = panel.querySelector('.simon-row') as HTMLDivElement;
    const intro = panel.querySelector('.simon-intro') as HTMLDivElement;
    panel.querySelector('.simon-speak')?.addEventListener('click', () => narrator.speak(instructie));

    const btns = new Map<string, HTMLButtonElement>();
    trial.dieren.forEach((id) => {
      const a = Content.animal(id);
      const b = document.createElement('button');
      b.className = 'simon-dier';
      b.disabled = true;
      b.setAttribute('aria-label', a?.naam ?? id);
      b.innerHTML = `<span class="sd-glow"></span><span class="sd-token">${esc((a?.naam ?? id).slice(0, 2))}</span><span class="sd-name">${esc(a?.naam ?? id)}</span>`;
      b.addEventListener('click', () => onTap(id));
      row.appendChild(b);
      btns.set(id, b);
    });

    function renderDots(): void {
      dots.innerHTML = seq
        .map((_, i) => `<span class="sp-dot${i < pos ? ' done' : ''}${phase === 'echo' && i === pos ? ' next' : ''}"></span>`)
        .join('');
    }

    intro.querySelector('.btn-start')?.addEventListener('click', () => {
      intro.style.display = 'none';
      Sound.unlock();
      seq = [randomCaller(trial.dieren), randomCaller(trial.dieren)];
      listen();
    });

    function listen(): void {
      clearTimers();
      phase = 'listen';
      pos = 0;
      banner.textContent = luister;
      for (const b of btns.values()) { b.disabled = true; b.classList.remove('calling'); }
      renderDots();
      const gap = reduced ? 380 : 250;
      let t = 480;
      seq.forEach((id) => {
        after(t, () => {
          for (const [bid, b] of btns) b.classList.toggle('calling', bid === id);
          if (settings.geluid) Sound.call(id);
        });
        const dur = Sound.callDur(id) * 1000;
        after(t + dur, () => btns.get(id)?.classList.remove('calling'));
        t += dur + gap;
      });
      after(t, startEcho);
    }

    function startEcho(): void {
      phase = 'echo';
      pos = 0;
      banner.textContent = echoTxt;
      for (const b of btns.values()) { b.disabled = false; b.classList.remove('calling'); }
      renderDots();
    }

    function onTap(id: string): void {
      if (phase !== 'echo') return;
      const b = btns.get(id);
      b?.classList.remove('tapped');
      requestAnimationFrame(() => b?.classList.add('tapped'));
      if (settings.geluid) Sound.call(id);
      after(240, () => b?.classList.remove('tapped'));

      if (id === seq[pos]) {
        pos += 1;
        renderDots();
        if (pos < seq.length) return;
        if (seq.length >= trial.target) finish();
        else {
          phase = 'pause';
          for (const bb of btns.values()) bb.disabled = true;
          if (settings.geluid) Sound.correct();
          banner.textContent = 'Goed onthouden!';
          after(1100, () => { seq = [...seq, randomCaller(trial.dieren)]; listen(); });
        }
      } else {
        wrong += 1;
        phase = 'pause';
        for (const bb of btns.values()) bb.disabled = true;
        if (settings.geluid) Sound.tryAgain();
        banner.textContent = 'Luister nog een keer.';
        after(1300, listen);
      }
    }

    function finish(): void {
      phase = 'done';
      for (const b of btns.values()) b.disabled = true;
      if (settings.geluid) Sound.found();
      banner.textContent = goed;
      if (settings.voorlezen) narrator.speak(goed);
      const correct = wrong === 0 ? 1 : 0;
      after(1600, () => { clearTimers(); narrator.stop(); panel.remove(); resolve({ trials: 1, correct }); });
    }
  });
}
