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
import { buildWisselTrial, WisselRun, dagOfNacht, regelAndersom } from '../engines/wisselen';
import { animalIcon } from './animalIcon';
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
    const run = new WisselRun(trial);
    const reduced = settings.reducedMotion;

    const instructie = copy.instructie ?? 'Breng elk dier naar de goede plek.';
    const goed = copy.goed ?? 'Alle dieren op de goede plek!';
    const regelDag = copy.regel ?? 'Dag-dier → open plek. Nacht-dier → het hol.';
    const regelOm = copy.regelOm ?? 'Nu andersom!';
    // after a flip the sign states the NEW mapping outright, as in 3D
    const regelOmgekeerd = regelAndersom(regelDag);

    let busy = false;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(() => { if (panel.isConnected) fn(); }, ms)); }; // a stopped step's panel is gone: its timers stand down
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
      `<div class="wissel-sign"><span class="ws-flag"></span><span class="ws-rule"></span></div>` +
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
    // read-aloud (child:B2/B3): the instruction and the rule, the new rule after every
    // flip, and each animal with what it is (a day or a night animal)
    const say = (text: string, after = false): void => {
      if (!settings.voorlezen) return;
      if (after) narrator.queue(text); else narrator.speak(text);
    };
    const ruleNow = (): string => (run.inverted ? regelOmgekeerd : regelDag);
    panel.querySelector('.wissel-speak')?.addEventListener('click', () => narrator.speak(ruleNow()));

    binOpen.addEventListener('click', () => choose('open'));
    binHol.addEventListener('click', () => choose('hol'));

    function renderDots(): void {
      dotsBox.innerHTML = trial.queue
        .map((_, i) => `<span class="wp-dot${i < run.index ? ' done' : i === run.index ? ' current' : ''}"></span>`)
        .join('');
    }

    /** `afterRule`: the rule is being said, so the animal waits its turn; otherwise
     *  its line replaces the last animal's (the voice never lags behind the screen). */
    function renderAnimal(afterRule = false): void {
      const cur = run.current;
      if (!cur) return;
      const a = Content.animal(cur.id);
      const soort = dagOfNacht(cur.dag);
      center.classList.remove('wrong', 'fly-open', 'fly-hol');
      // the animal carries its cue: ☀ dag-dier / 🌙 nacht-dier (icon + word, child:B3)
      center.innerHTML =
        `<span class="wc-token" aria-hidden="true">${animalIcon(cur.id)}</span>` +
        `<span class="wc-name">${esc(a?.naam ?? cur.id)}</span>` +
        `<span class="wc-kind ${cur.dag ? 'is-dag' : 'is-nacht'}">${soort.icoon} ${esc(soort.woord)}</span>`;
      say(`${a?.naam ?? cur.id}. ${soort.woord}.`, afterRule);
      // one sentence per line: never more than ~7 words on a line
      rule.innerHTML = ruleNow().split(/(?<=[.!?])\s+/).map(esc).join('<br>');
      field.classList.toggle('inverted', run.inverted);
      renderDots();
    }

    function choose(bin: 'open' | 'hol'): void {
      if (busy || run.finished) return;
      const res = run.choose(bin);
      if (res === 'retry') {
        if (settings.geluid) Sound.tryAgain();
        toast('Bijna! Probeer de andere plek.', 'gevolg');
        center.classList.remove('wrong');
        requestAnimationFrame(() => center.classList.add('wrong'));
        after(480, () => center.classList.remove('wrong'));
        return;
      }
      busy = true;
      if (settings.geluid) Sound.correct();
      center.classList.add(`fly-${bin}`);
      after(reduced ? 240 : 540, () => {
        if (res === 'complete') return finish();
        if (res === 'flip') {
          flag.textContent = 'Bordje draait!';
          sign.classList.add('flipping');
          if (settings.geluid) Sound.select();
          say(regelOm); // "Nu andersom!" + the new rule, before the next animal
          say(regelOmgekeerd, true);
          after(reduced ? 700 : 1400, () => { flag.textContent = ''; sign.classList.remove('flipping'); });
        }
        renderAnimal(res === 'flip');
        busy = false;
      });
    }

    function toast(text: string, kind: 'ok' | 'gevolg'): void {
      field.querySelectorAll('.feedback-toast').forEach((n) => n.remove());
      const t = document.createElement('div');
      t.className = `feedback-toast ${kind}`;
      t.textContent = text;
      field.appendChild(t);
      say(text);
      if (kind === 'gevolg') after(1400, () => t.remove());
    }

    function finish(): void {
      if (settings.geluid) Sound.found();
      toast(goed, 'ok');
      after(1500, () => { clearTimers(); narrator.stop(); panel.remove(); resolve(run.summary()); });
    }

    say(instructie);
    say(regelDag, true);
    renderAnimal(true);
  });
}
