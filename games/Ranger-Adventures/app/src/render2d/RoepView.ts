/**
 * RoepView.ts — 2D render-laag voor de perceptie-slice "Ken je roep" (Engine-01,
 * W6.4a). Een vogel roept; het kind kiest wélke vogel dat was uit een rij met
 * afleiders. De staircase (RoepRun) maakt het na een goed antwoord één afleider
 * moeilijker, na een mis makkelijker — nooit game-over, de beat loopt altijd uit.
 * Toegankelijkheid: dubbel kanaal (de roep klinkt ÉN staat als tekst, dus
 * speelbaar met gedempt geluid), read-aloud, ≥56px vogelknoppen, dual-channel
 * feedback (glow + geluid + tekst), rustiger tempo onder reduced-motion.
 *
 * Deze view deelt de pure `RoepRun`-kern met de latere diegetische 3D-twin
 * (W6.4b), zodat beide een IDENTIEKE `BeatSummary` opleveren (construct-pariteit,
 * `roep.parity.test.ts`).
 */

import './roep.css';
import type { BeatSummary } from '../core/skill';
import { store } from '../core/state';
import { buildRoepTrial, RoepRun, ROEP_COPY, type RoepVogel } from '../engines/roep';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

export function playRoep(host: HTMLElement): Promise<BeatSummary> {
  return new Promise<BeatSummary>((resolve) => {
    const settings = store.get().settings;
    const reduced = settings.reducedMotion;
    const trial = buildRoepTrial();
    const run = new RoepRun(trial, () => Math.random());
    const byId = new Map<string, RoepVogel>(trial.vogels.map((v) => [v.id, v]));

    let phase: 'intro' | 'kies' | 'pauze' | 'done' = 'intro';
    let round: { target: string; opties: string[] } | null = null;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };
    const clearTimers = (): void => { for (const t of timers) window.clearTimeout(t); timers.length = 0; };

    const panel = document.createElement('div');
    panel.className = 'roep' + (reduced ? ' roep--calm' : '');
    panel.innerHTML =
      `<div class="roep-bar">` +
      `<p class="roep-instr">${esc(ROEP_COPY.instructie)}</p>` +
      `<button class="roep-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `</div>` +
      `<div class="roep-field" role="group" aria-label="${esc(ROEP_COPY.instructie)}">` +
      `<div class="roep-sky"></div>` +
      `<div class="roep-dots" aria-hidden="true"></div>` +
      `<button class="roep-call" type="button" aria-label="Speel de roep">` +
      `<span class="rc-ico">🔊</span><span class="rc-text"></span></button>` +
      `<p class="roep-banner">${esc(ROEP_COPY.luister)}</p>` +
      `<div class="roep-row"></div>` +
      `<div class="roep-intro"><button class="btn-start" type="button">Luister</button></div>` +
      `</div>`;
    host.appendChild(panel);

    const banner = panel.querySelector('.roep-banner') as HTMLParagraphElement;
    const dots = panel.querySelector('.roep-dots') as HTMLDivElement;
    const row = panel.querySelector('.roep-row') as HTMLDivElement;
    const intro = panel.querySelector('.roep-intro') as HTMLDivElement;
    const callBtn = panel.querySelector('.roep-call') as HTMLButtonElement;
    const callText = panel.querySelector('.rc-text') as HTMLSpanElement;
    panel.querySelector('.roep-speak')?.addEventListener('click', () => narrator.speak(ROEP_COPY.instructie));

    // one ≥56px button per bird (the full pool is always the row; the round only
    // decides which are the live options, so the layout never jumps)
    const btns = new Map<string, HTMLButtonElement>();
    trial.vogels.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'roep-dier';
      b.disabled = true;
      b.setAttribute('aria-label', v.naam);
      b.innerHTML =
        `<span class="rd-glow"></span>` +
        `<span class="rd-token">${esc(v.naam.slice(0, 2))}</span>` +
        `<span class="rd-name">${esc(v.naam)}</span>`;
      b.addEventListener('click', () => onTap(v.id));
      row.appendChild(b);
      btns.set(v.id, b);
    });

    function renderDots(): void {
      const done = run.roundIndex;
      dots.innerHTML = Array.from({ length: trial.ronden }, (_, i) =>
        `<span class="rp-dot${i < done ? ' done' : ''}${i === done && phase !== 'done' ? ' next' : ''}"></span>`)
        .join('');
    }

    function playCall(): void {
      if (!round) return;
      if (settings.geluid) Sound.call(round.target);
      const roep = byId.get(round.target)?.roep ?? '';
      if (settings.voorlezen) narrator.speak(roep);
    }

    callBtn.addEventListener('click', () => { if (phase === 'kies') playCall(); });

    intro.querySelector('.btn-start')?.addEventListener('click', () => {
      intro.style.display = 'none';
      Sound.unlock();
      nextRound();
    });

    function nextRound(): void {
      clearTimers();
      round = run.next();
      if (!round) { finish(); return; }
      phase = 'kies';
      banner.textContent = ROEP_COPY.luister;
      const roep = byId.get(round.target)?.roep ?? '';
      callText.textContent = roep;
      renderDots();
      // only the round's options are tappable; the rest sit dimmed but in place
      const live = new Set(round.opties);
      for (const [id, b] of btns) {
        b.disabled = !live.has(id);
        b.classList.toggle('off', !live.has(id));
        b.classList.remove('good', 'bad', 'tapped');
      }
      after(reduced ? 460 : 320, playCall);
    }

    function onTap(id: string): void {
      if (phase !== 'kies' || !round) return;
      phase = 'pauze';
      for (const b of btns.values()) b.disabled = true;
      const res = run.answer(id);
      const b = btns.get(id);
      if (res === 'goed') {
        b?.classList.add('good');
        if (settings.geluid) Sound.correct();
        banner.textContent = ROEP_COPY.goed;
        if (settings.voorlezen) narrator.speak(ROEP_COPY.goed);
      } else {
        b?.classList.add('bad');
        btns.get(round.target)?.classList.add('good'); // show which one it really was
        if (settings.geluid) Sound.tryAgain();
        banner.textContent = ROEP_COPY.mis;
        if (settings.voorlezen) narrator.speak(ROEP_COPY.mis);
      }
      renderDots();
      after(reduced ? 1500 : 1150, nextRound);
    }

    function finish(): void {
      phase = 'done';
      round = null;
      for (const b of btns.values()) b.disabled = true;
      callText.textContent = '';
      if (settings.geluid) Sound.found();
      banner.textContent = ROEP_COPY.klaar;
      if (settings.voorlezen) narrator.speak(ROEP_COPY.klaar);
      renderDots();
      const summary = run.summary();
      after(1600, () => { clearTimers(); narrator.stop(); panel.remove(); resolve(summary); });
    }
  });
}
