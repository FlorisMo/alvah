/**
 * DangerView.ts — 2D render layer for the "dagnacht" engine (inhibition).
 * Each encounter tempts an impulse the child must inhibit in favour of the
 * ranger rule; one encounter FLIPS so it stays a real inhibition task. A wrong
 * choice has a recoverable consequence: the ranger is knocked back, ground on
 * "Terug naar de groep" is lost, and a few collected eikels spill (persisted to
 * store.eikels). Never a game-over. Accessibility: read-aloud, ≥56px choices,
 * dual-channel feedback, slow-mo choosing window while still learning.
 */

import './danger.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import { store } from '../core/state';
import { buildDagnachtTrial, DagnachtRun, type Encounter } from '../engines/dagnacht';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playDanger(host: HTMLElement, step: Step): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const diff = store.difficulty('dagnacht');
    const trial = buildDagnachtTrial(step.skin, { ...diff, reducedMotion: settings.reducedMotion } as typeof diff);
    const copy = step.skin.copy ?? {};
    const reduced = settings.reducedMotion;
    const slowmo = trial.slowmo && !reduced;

    const instructie = copy.instructie ?? 'Blijf rustig. Kies veilig.';
    const total = trial.encounters.length;

    // Shared pure core (parity with the 3D twin, §1f): it owns the encounter
    // index + the wrong-set + the final BeatSummary; this view only renders.
    const run = new DagnachtRun(total);
    let phase: 'walk' | 'choose' | 'feedback' | 'done' = 'walk';
    let terugSlag = 0;
    let eikels = store.get().eikels;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    const panel = document.createElement('div');
    panel.className = 'danger';
    panel.innerHTML =
      `<div class="danger-bar">` +
      `<p class="danger-instr">${esc(instructie)}</p>` +
      `<button class="danger-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="danger-field" role="group" aria-label="${esc(instructie)}">` +
      `<div class="danger-progress"><span class="dp-label">Terug naar de groep</span>` +
      `<div class="dp-track"><div class="dp-fill"></div></div></div>` +
      `<div class="danger-eikels" aria-label="eikels"><span class="acorn">🌰</span><span class="de-num">${eikels}</span></div>` +
      (trial.regels.length ? `<div class="enc-regels">${trial.regels.map((r) => `<span class="regel-chip">${esc(r)}</span>`).join('')}</div>` : '') +
      `<div class="rule-banner"></div>` +
      `<div class="enc-stage">` +
      `<div class="enc-subject"></div>` +
      `<div class="enc-options"></div>` +
      `</div>` +
      `<div class="danger-walker"><span class="walker-ranger">🧒</span></div>` +
      `</div>`;
    host.appendChild(panel);

    const fill = panel.querySelector('.dp-fill') as HTMLDivElement;
    const eikelsNum = panel.querySelector('.de-num') as HTMLSpanElement;
    const eikelsBox = panel.querySelector('.danger-eikels') as HTMLDivElement;
    const ruleBanner = panel.querySelector('.rule-banner') as HTMLDivElement;
    const subject = panel.querySelector('.enc-subject') as HTMLDivElement;
    const options = panel.querySelector('.enc-options') as HTMLDivElement;
    const walker = panel.querySelector('.danger-walker') as HTMLDivElement;
    const field = panel.querySelector('.danger-field') as HTMLDivElement;
    panel.querySelector('.danger-speak')?.addEventListener('click', () => narrator.speak(instructie));

    function progress(): void {
      const eff = Math.max(0, run.index - terugSlag);
      const p = phase === 'done' ? 1 : Math.min(1, eff / total);
      fill.style.width = `${Math.round(p * 100)}%`;
      walker.style.left = `${10 + p * 72}%`;
    }

    function renderEncounter(): void {
      const enc = trial.encounters[run.index];
      ruleBanner.innerHTML =
        (enc.flip ? `<span class="flip-cue">Nu mag het wél</span>` : '') + esc(enc.vraag);
      ruleBanner.classList.toggle('flip', !!enc.flip);
      subject.className = `enc-subject subj-${esc(enc.subject)}`;
      subject.innerHTML = `<span class="subj-label">${esc(enc.subject)}</span>`;
      // shuffle the two option slots so position never cues the answer
      const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
      options.innerHTML = order
        .map((i) => `<button class="choice-opt" data-i="${i}" type="button"><span class="opt-label">${esc(enc.opties[i].label)}</span></button>`)
        .join('');
      options.querySelectorAll<HTMLButtonElement>('.choice-opt').forEach((b) => {
        b.addEventListener('click', () => choose(parseInt(b.dataset.i!, 10), enc));
      });
    }

    function advance(): void {
      clearTimers();
      if (run.finished) return finish();
      phase = 'walk';
      progress();
      after(reduced ? 350 : 800, () => {
        phase = 'choose';
        if (slowmo) field.classList.add('slowmo');
        renderEncounter();
      });
    }

    function choose(optIndex: number, enc: Encounter): void {
      if (phase !== 'choose') return;
      field.classList.remove('slowmo');
      const opt = enc.opties[optIndex];
      if (opt.goed) {
        phase = 'feedback';
        run.choose(true);
        if (settings.geluid) Sound.correct();
        subject.classList.remove('react');
        flash('ok', enc.uitleg ?? 'Rustig zo.');
        after(1500, () => { advance(); });
      } else {
        phase = 'feedback';
        run.choose(false);
        if (settings.geluid) Sound.tryAgain();
        subject.classList.add('react');
        walker.classList.add('knock');
        terugSlag = Math.min(1.6, terugSlag + (enc.terug ?? 0.5));
        progress();
        // spill a few collected eikels — a real, recoverable consequence
        const kost = enc.eikelKost ?? 2;
        const verlies = Math.min(kost, eikels);
        if (verlies > 0) {
          eikels -= verlies;
          store.set({ eikels });
          eikelsNum.textContent = String(eikels);
          eikelsBox.classList.remove('lost');
          requestAnimationFrame(() => eikelsBox.classList.add('lost'));
          after(900, () => eikelsBox.classList.remove('lost'));
        }
        flash('gevolg', enc.gevolg ?? 'Wacht even. Probeer het anders.');
        after(reduced ? 1500 : 2100, () => {
          subject.classList.remove('react');
          walker.classList.remove('knock');
          phase = 'choose';
          if (slowmo) field.classList.add('slowmo');
        });
      }
    }

    function flash(kind: 'ok' | 'gevolg', text: string): void {
      const t = document.createElement('div');
      t.className = `feedback-toast ${kind}`;
      t.textContent = text;
      field.appendChild(t);
      if (settings.voorlezen) narrator.speak(text);
      after(kind === 'ok' ? 1400 : 1900, () => t.remove());
    }

    function finish(): void {
      phase = 'done';
      progress();
      if (settings.geluid) Sound.found();
      const summary = run.summary();
      after(1400, () => { clearTimers(); narrator.stop(); panel.remove(); resolve(summary); });
    }

    advance();
  });
}
