/**
 * DemoSkip.ts — the demo-skip panel (BUILD-PLAN §9g "demo-skip options").
 *
 * A DOM overlay over the 3D stage, reachable from the lodge, so Floris + Alvah
 * can test ANY part of the game without grinding:
 *   - jump to any area (locked "binnenkort" areas are shown but disabled),
 *   - jump to any mission — on the 2D floor or straight into 3D free-roam,
 *   - a one-tap shortcut to play each of the 5 EF engines in 3D,
 *   - a global "skip briefings" toggle (wired into Missions.showBriefing),
 *   - fast-forward the season/poacher arc (mark all missions done · resolve the
 *     storyline · start fresh for a clean test).
 *
 * The mission/engine jumps drive Missions' own flow via the injected `api`
 * (no import cycle); the arc fast-forwards + the toggle act on the store + the
 * pure `core/demo.ts` helpers directly, then re-render. Accessibility: ≥56px
 * controls, dual-channel feedback (colour + state word + sound), reduced-motion-
 * safe (pure DOM; the `.rm` body class calms any transition). Reuses the proven
 * `tweaks.css` toggle + the shared boot-card chrome.
 */

import './tweaks.css';
import './demo.css';
import { store } from '../core/state';
import { Sound } from '../core/sound';
import { narrator } from '../core/narrator';
import { Content } from '../content/registry';
import {
  demoAreaTargets, demoMissionTargets, engineTargets, voltooidAll, voltooidArc,
} from '../core/demo';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Injected hooks into Missions' flow — keeps DemoSkip free of an import cycle. */
export interface DemoSkipApi {
  /** Launch a mission: `in3d` loads/keeps the free-roam world and plays in-place;
   *  otherwise the 2D floor. Briefing is skipped when the toggle is on. */
  jumpMission: (missionId: string, in3d: boolean) => void;
  /** Return to the lodge. */
  back: () => void;
}

let host: HTMLElement;
let api: DemoSkipApi;

export function showDemoSkip(ui: HTMLElement, hooks: DemoSkipApi): void {
  host = ui;
  api = hooks;
  render();
}

function clearOverlays(): void {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

function select(): void {
  if (store.get().settings.geluid) Sound.select();
}

/** The first mission whose step list features this engine (for the engine shortcut). */
function missionForEngine(engine: string): string | null {
  for (const m of Content.activeArea().missies) {
    if (m.stappen.some((s) => s.ef === engine)) return m.id;
  }
  return null;
}

function render(status?: string): void {
  narrator.stop();
  clearOverlays();
  const area = Content.activeArea();
  const voltooid = store.get().voltooid;
  const skip = store.get().settings.skipBriefings;
  const gemeld = store.get().arc.gemeld;

  const areas = demoAreaTargets(Content.areas())
    .map((a) =>
      `<button class="dm-area${a.enabled ? '' : ' locked'}" type="button" data-area="${esc(a.id)}"` +
      `${a.enabled ? ` aria-current="${a.id === area.id}"` : ' disabled aria-disabled="true"'}>` +
      `<span class="dm-area-name">${esc(a.naam)}</span>` +
      `<span class="dm-area-tag">${a.enabled ? 'open' : 'binnenkort'}</span>` +
      `</button>`)
    .join('');

  const missions = demoMissionTargets(area, voltooid)
    .map((m) =>
      `<div class="dm-mission">` +
      `<span class="dm-mis-info">` +
      `<span class="dm-mis-title">${m.done ? '<span class="dm-check" aria-label="klaar">✓</span> ' : ''}${esc(m.titel)}</span>` +
      `<span class="dm-mis-sub">${esc(m.landschap)} · ${esc(m.engineLabel)}</span>` +
      `</span>` +
      `<span class="dm-mis-actions">` +
      `<button class="dm-go" type="button" data-mis="${esc(m.id)}" data-mode="2d">2D</button>` +
      `<button class="dm-go dm-go-3d" type="button" data-mis="${esc(m.id)}" data-mode="3d">3D</button>` +
      `</span>` +
      `</div>`)
    .join('');

  const engines = engineTargets()
    .filter((e) => missionForEngine(e.engine))
    .map((e) =>
      `<button class="dm-eng" type="button" data-eng="${esc(e.engine)}" ` +
      `style="--pip:${esc(SKILL_COLOR[e.engine] ?? '#f5c23b')}">` +
      `<span class="dm-pip" aria-hidden="true"></span>${esc(e.label)}</button>`)
    .join('');

  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="demo-skip boot-card-ish">` +
    `<p class="boot-kicker">Demo · spring &amp; test</p>` +
    `<h1 class="boot-title">Ga overal heen</h1>` +
    `<p class="dm-status" role="status" aria-live="polite">${status ? esc(status) : ''}</p>` +

    // skip-briefings toggle (reuses the Tweaks toggle look)
    `<button class="tw-toggle${skip ? ' on' : ''} dm-skip" type="button" role="switch" aria-checked="${skip}" aria-label="Briefings overslaan">` +
    `<span class="tw-toggle-text"><span class="tw-toggle-label">Briefings overslaan</span>` +
    `<span class="tw-toggle-hint">Meteen spelen, geen uitleg-scherm</span></span>` +
    `<span class="tw-switch" aria-hidden="true"><span class="tw-knob"></span>` +
    `<span class="tw-state">${skip ? 'aan' : 'uit'}</span></span></button>` +

    `<div class="dm-sect"><p class="dm-head">Gebied</p><div class="dm-areas">${areas}</div></div>` +
    `<div class="dm-sect"><p class="dm-head">Speel direct in 3D</p><div class="dm-engines">${engines}</div></div>` +
    `<div class="dm-sect"><p class="dm-head">Missies</p><div class="dm-missions">${missions}</div></div>` +

    `<div class="dm-sect"><p class="dm-head">Verhaallijn vooruitspoelen</p><div class="dm-arc">` +
    `<button class="dm-arc-btn" type="button" data-arc="all">Markeer alle missies klaar</button>` +
    `<button class="dm-arc-btn" type="button" data-arc="resolve"${gemeld ? ' disabled aria-disabled="true"' : ''}>Los de verhaallijn op</button>` +
    `<button class="dm-arc-btn dm-arc-reset" type="button" data-arc="reset">Begin opnieuw (schone test)</button>` +
    `</div></div>` +

    `<div class="ra-row"><button class="btn-start dm-back" type="button">Terug naar de hut</button></div>` +
    `</div>`;
  host.appendChild(el);

  // ---- skip-briefings toggle ----
  el.querySelector<HTMLButtonElement>('.dm-skip')?.addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    const next = !store.get().settings.skipBriefings;
    store.setSetting({ skipBriefings: next });
    b.classList.toggle('on', next);
    b.setAttribute('aria-checked', String(next));
    const st = b.querySelector('.tw-state');
    if (st) st.textContent = next ? 'aan' : 'uit';
    select();
  });

  // ---- area jump (only the active area is enabled today) ----
  el.querySelectorAll<HTMLButtonElement>('.dm-area:not(.locked)').forEach((b) => {
    b.addEventListener('click', () => { select(); /* one area today → stay on the panel */ });
  });

  // ---- engine shortcuts (play in 3D) ----
  el.querySelectorAll<HTMLButtonElement>('.dm-eng').forEach((b) => {
    b.addEventListener('click', () => {
      const mis = missionForEngine(b.dataset.eng!);
      if (!mis) return;
      select();
      clearOverlays();
      api.jumpMission(mis, true);
    });
  });

  // ---- mission jumps ----
  el.querySelectorAll<HTMLButtonElement>('.dm-go').forEach((b) => {
    b.addEventListener('click', () => {
      select();
      clearOverlays();
      api.jumpMission(b.dataset.mis!, b.dataset.mode === '3d');
    });
  });

  // ---- arc fast-forward ----
  el.querySelectorAll<HTMLButtonElement>('.dm-arc-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const what = b.dataset.arc;
      if (what === 'all') {
        store.set({ voltooid: voltooidAll(area) });
        feedback('Alle missies staan op klaar.');
      } else if (what === 'resolve') {
        store.set({ voltooid: voltooidArc(area, store.get().voltooid) });
        store.reportArc();
        feedback('De verhaallijn is opgelost.');
      } else {
        store.reset();
        feedback('Schone test. Alle voortgang is gewist.');
      }
    });
  });

  el.querySelector('.dm-back')?.addEventListener('click', () => { clearOverlays(); api.back(); });
}

/** Dual-channel confirm for an arc fast-forward: a soft sound + a spoken/visible
 *  status, then re-render so the done-checks + resolve state update. */
function feedback(msg: string): void {
  if (store.get().settings.geluid) Sound.found();
  if (store.get().settings.voorlezen) narrator.speak(msg);
  render(msg);
}

/** Engine pip colours (match SKILL_META; kept local so this stays view-only). */
const SKILL_COLOR: Record<string, string> = {
  zoeken: '#5e8c3a', corsi: '#2f6fb0', simon: '#bb6a2c', dagnacht: '#7a52b3', wisselen: '#c1467e',
};
