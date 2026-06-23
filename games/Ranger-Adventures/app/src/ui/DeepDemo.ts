/**
 * DeepDemo.ts — the Deep Demo guided tour runner (BUILD-PLAN §5 / Capstone 132a-ii).
 *
 * The Deep Demo is the autonomous review surface: a single narrated walk that
 * hits every capability of the finished game in the §132 order. This runner is a
 * THIN reuse layer over the LIVE screens — each beat opens the real surface
 * (avatar creator · free-roam world · the compact cast sandbox · an EF engine
 * in-world · the case-board/arc · the cabin/companion · the badge wall) and
 * wires that screen's "back" to return to the same demo beat. The ordered beat
 * list + cursor are the pure `core/deepdemo.ts` (unit-tested); this layer only
 * renders the narration card and dispatches.
 *
 * The live flows live in Missions.ts; to stay free of an import cycle they're
 * passed in as `DeepDemoApi` (the same pattern as DemoSkip). Accessibility:
 * ≥56px controls, dual-channel (a state/step word + a soft select sound + the
 * narrated line read aloud), reduced-motion-safe (pure DOM; the global `.rm *`
 * rule calms any transition).
 */

import './demo.css';
import type { Engine } from '../core/skill';
import { store } from '../core/state';
import { Sound } from '../core/sound';
import { narrator } from '../core/narrator';
import { mountReadAloud, type ReadAloudHandle } from './ReadAloud';
import {
  deepDemoScript, beatAt, nextBeat, prevBeat, isLastBeat, type DeepDemoBeat,
} from '../core/deepdemo';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Injected hooks into Missions' LIVE flows — keeps DeepDemo free of an import
 *  cycle. Each opener receives a `back` callback to return to the demo beat. */
export interface DeepDemoApi {
  openAvatar: (back: () => void) => void;
  openFreeroam: (back: () => void) => void;
  openSandbox: (back: () => void) => void;
  openEngine: (engine: Engine, back: () => void) => void;
  openArc: (back: () => void) => void;
  openCompanion: (back: () => void) => void;
  openBadges: (back: () => void) => void;
  /** Leave the tour, back to the lodge. */
  backToLodge: () => void;
}

let host: HTMLElement;
let api: DeepDemoApi;
let script: DeepDemoBeat[] = [];
let ra: ReadAloudHandle | null = null;

export function startDeepDemoTour(ui: HTMLElement, hooks: DeepDemoApi): void {
  host = ui;
  api = hooks;
  script = deepDemoScript();
  showBeat(0);
}

function clearOverlays(): void {
  ra?.stop();
  ra = null;
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

function select(): void {
  if (store.get().settings.geluid) Sound.select();
}

/** "Open" the live surface for a beat; its own back returns to this beat. */
function openBeat(beat: DeepDemoBeat, idx: number): void {
  select();
  clearOverlays();
  const back = (): void => showBeat(idx);
  switch (beat.kind) {
    case 'avatar':    api.openAvatar(back); break;
    case 'freeroam':  api.openFreeroam(back); break;
    case 'cast':      api.openSandbox(back); break;
    case 'engine':    api.openEngine(beat.engine!, back); break;
    case 'arc':       api.openArc(back); break;
    case 'companion': api.openCompanion(back); break;
    case 'badges':    api.openBadges(back); break;
    default:          showBeat(idx); // boot has no live surface
  }
}

function showBeat(idx: number): void {
  narrator.stop();
  clearOverlays();
  const beat = beatAt(script, idx);
  if (!beat) { api.backToLodge(); return; }

  const total = script.length;
  const last = isLastBeat(script, idx);
  const hasSurface = beat.kind !== 'boot';

  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="deep-demo boot-card-ish">` +
    `<p class="boot-kicker">Diepe demo · stap ${idx + 1} van ${total}</p>` +
    `<h1 class="boot-title">${esc(beat.titel)}</h1>` +
    `<p class="dd-note"></p>` +

    `<div class="ra-row">` +
    (hasSurface ? `<button class="btn-start dd-open" type="button">Bekijk dit</button>` : '') +
    `</div>` +

    `<div class="dd-nav">` +
    `<button class="ra-text-btn dd-prev" type="button"${idx === 0 ? ' disabled aria-disabled="true"' : ''}>‹ Vorige</button>` +
    `<button class="ra-text-btn dd-next" type="button">${last ? 'Klaar — terug naar de hut' : 'Volgende ›'}</button>` +
    `</div>` +
    `<button class="ra-text-btn dd-skip" type="button">Sla de demo over</button>` +
    `</div>`;
  host.appendChild(el);

  // narrate the beat (karaoke read-aloud), respecting the voorlezen setting
  ra = mountReadAloud({
    textEl: el.querySelector<HTMLElement>('.dd-note')!,
    text: beat.toelichting,
    autoStart: store.get().settings.voorlezen,
  });

  el.querySelector('.dd-open')?.addEventListener('click', () => openBeat(beat, idx));
  el.querySelector('.dd-prev')?.addEventListener('click', () => { select(); showBeat(prevBeat(idx)); });
  el.querySelector('.dd-next')?.addEventListener('click', () => {
    select();
    if (last) { clearOverlays(); api.backToLodge(); }
    else showBeat(nextBeat(script, idx));
  });
  el.querySelector('.dd-skip')?.addEventListener('click', () => { select(); clearOverlays(); api.backToLodge(); });
}
