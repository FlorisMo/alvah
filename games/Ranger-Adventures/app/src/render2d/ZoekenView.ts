/**
 * ZoekenView.ts — the 2D "spot the animal" view: the render layer for the
 * zoeken engine (Phase 1). Mounts into the UI overlay, runs one trial, and
 * resolves with the BeatSummary the skill system needs. Accessibility baked in:
 * read-aloud, ≥56px tap targets, dual-channel (colour + scale/sound) feedback.
 * The 3D in-world version (Phase 4) will reuse the same engine + BeatSummary.
 * Run 7 (`adaptive`): the trial comes from the level's knobs and the play's fork — which
 * look-alikes and how many, where everything lies (never the animal in the middle), how
 * much of it shows through the grass (haze = 1 − glimpse) and when the hint comes (its ring
 * breathes softly after `hintAfterS` or two misses), as the world's search reads them.
 */

import './zoeken.css';
import type { Step } from '../content/types';
import type { BeatSummary } from '../core/skill';
import type { Play } from '../core/play';
import { store } from '../core/state';
import { looseRng } from '../core/play';
import { Content } from '../content/registry';
import { buildZoekenTrial, zoekSummary } from '../engines/zoeken';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

/** Play one zoeken trial for `step`; resolves when the child taps "Verder". */
export function playZoeken(host: HTMLElement, step: Step, play?: Play): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const skin = step.skin;
    // run 7: this play's look-alikes and places (the world's twin draws the same set)
    const trial = buildZoekenTrial(skin, store.knobs('zoeken'), play ? play.fork('zoeken').rng : looseRng('zoeken'));
    const dier = skin.dier ? Content.animal(skin.dier) : null;

    const instructie =
      settings.jargon && skin.copy?.instructieKnap
        ? skin.copy.instructieKnap
        : skin.copy?.instructie ?? Content.efTitel('zoeken');
    const goedTxt = skin.copy?.goed ?? 'Daar is hij! Goed gezocht.';

    let misses = 0;
    let done = false;
    let hinted = false;
    const t0 = performance.now();

    const panel = document.createElement('div');
    panel.className = 'zoeken';
    panel.innerHTML =
      `<div class="zoeken-bar">` +
      `<p class="zoeken-instr">${esc(instructie)}</p>` +
      `<button class="zoeken-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="zoeken-field" role="group" aria-label="${esc(instructie)}">` +
      `<div class="zoeken-grass"></div>` +
      `</div>`;
    host.appendChild(panel);

    const field = panel.querySelector('.zoeken-field') as HTMLDivElement;
    field.style.setProperty('--haze', String(trial.haze)); // the grass over the animal
    const speakBtn = panel.querySelector('.zoeken-speak') as HTMLButtonElement;
    speakBtn.addEventListener('click', () => narrator.speak(instructie));

    // decoys
    for (const d of trial.decoys) {
      const b = document.createElement('button');
      b.className = `zoeken-decoy k-${d.k}`;
      b.style.left = `${d.x}%`;
      b.style.top = `${d.y}%`;
      const naam = d.animal ? Content.animal(d.animal)?.naam ?? '' : '';
      b.setAttribute('aria-label', naam || 'iets in het gras');
      b.addEventListener('click', () => onMiss(b, naam));
      field.appendChild(b);
    }

    // target — the animal that "drukt zich"
    const target = document.createElement('button');
    target.className = 'zoeken-target';
    target.style.left = `${trial.target.x}%`;
    target.style.top = `${trial.target.y}%`;
    target.setAttribute('aria-label', dier?.naam ?? 'het dier');
    target.innerHTML = `<span class="tell"></span><span class="body"></span><span class="cover" aria-hidden="true"></span>`;
    target.addEventListener('click', onFound);
    field.appendChild(target);

    // attempt auto read-aloud (the Start tap that opened this counts as the gesture)
    if (settings.voorlezen) narrator.speak(instructie);

    // the hint: after a calm wait, or two misses, its ring breathes softly where it lies
    const hint = (): void => {
      if (done || hinted) return;
      hinted = true;
      target.classList.add('hint');
    };
    const hintTimer = window.setTimeout(() => { if (panel.isConnected) hint(); }, trial.hintAfterS * 1000);

    function onMiss(btn: HTMLButtonElement, naam: string): void {
      if (done) return;
      misses += 1;
      if (misses >= 2) hint();
      if (settings.geluid) Sound.tryAgain();
      btn.classList.remove('miss');
      requestAnimationFrame(() => btn.classList.add('miss'));
      if (naam) {
        let tag = btn.querySelector('.decoy-name');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'decoy-name';
          tag.textContent = naam;
          btn.appendChild(tag);
        }
        const el = tag;
        window.setTimeout(() => el.remove(), 700);
      }
    }

    function onFound(): void {
      if (done) return;
      done = true;
      window.clearTimeout(hintTimer);
      const summary = zoekSummary({ misses, seconds: (performance.now() - t0) / 1000, hinted });
      if (settings.geluid) Sound.found();
      target.classList.remove('hint');
      target.classList.add('found');

      const closeup = document.createElement('div');
      closeup.className = 'zoeken-closeup';
      const feit = skin.feit ? `<p class="zoeken-feit">${esc(skin.feit)}</p>` : '';
      closeup.innerHTML =
        `<div class="zoeken-card">` +
        `<p class="zoeken-goed">${esc(goedTxt)}</p>` +
        feit +
        `<div class="zoeken-actions">` +
        `<button class="zoeken-speak" type="button" aria-label="Lees voor">🔊</button>` +
        `<button class="btn-start" type="button">Verder</button>` +
        `</div>` +
        `</div>`;
      panel.appendChild(closeup);

      const found = skin.feit ? `${goedTxt} ${skin.feit}` : goedTxt;
      closeup.querySelector('.zoeken-speak')?.addEventListener('click', () => narrator.speak(found));
      if (settings.voorlezen) narrator.speak(found);

      const verder = closeup.querySelector('.btn-start') as HTMLButtonElement;
      verder.addEventListener('click', () => {
        narrator.stop();
        panel.remove();
        resolve(summary);
      });
    }
  });
}
