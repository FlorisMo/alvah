/**
 * Missions.ts — the mission wrapper + lodge (BUILD-PLAN §5 phase 3).
 * Owns the whole play flow on top of the render-agnostic spine:
 *   lodge (pick a mission) → briefing → play each step through ENGINE_VIEWS
 *   → "wist-je-dat" fact between steps → reward (badge tier + knap-woord + skill).
 * Every screen is a DOM overlay over the 3D stage. Accessibility throughout:
 * read-aloud, ≥56px targets, dual-channel feedback. Never a game-over — the
 * reward always celebrates; difficulty is what flexes (silently, via the spine).
 */

import './missions.css';
import type { Mission, Step } from '../content/types';
import type { BeatSummary, Engine } from '../core/skill';
import { SKILL_META, tierFor, badgeProgress } from '../core/skill';
import { store } from '../core/state';
import { Content } from '../content/registry';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';
import { loadGameAudio } from '../core/calls';
import type { Stage } from '../render3d/Stage';
import { World, type WorldMarker } from '../render3d/World';
import { playZoeken } from '../render2d/ZoekenView';
import { playRoute } from '../render2d/RouteView';
import { playSimon } from '../render2d/SimonView';
import { playDanger } from '../render2d/DangerView';
import { playWissel } from '../render2d/WisselView';

/** animal id (content) → generated GLB id (asset pipeline). Others → procedural. */
const MODEL_OF: Record<string, string> = {
  wildzwijn: 'animal-wildzwijn-boar',
  frisling: 'animal-frisling-piglet',
  das: 'animal-das-badger',
  eekhoorn: 'animal-eekhoorn-squirrel',
  raaf: 'animal-raaf-raven',
  nachtzwaluw: 'animal-nachtzwaluw-nightjar',
  adder: 'animal-adder-snake',
  heikikker: 'animal-heikikker-frog',
};

type PlayFn = (host: HTMLElement, step: Step) => Promise<BeatSummary>;
const ENGINE_VIEWS: Partial<Record<string, PlayFn>> = {
  zoeken: playZoeken, corsi: playRoute, simon: playSimon, dagnacht: playDanger, wisselen: playWissel,
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

let host: HTMLElement;
let stage: Stage;
let world: World | null = null;

export function startLodge(ui: HTMLElement, st: Stage): void {
  host = ui;
  stage = st;
  showLodge();
}

function leaveWorld(): void {
  if (world) { world.dispose(); world = null; stage.exitWorld(); }
}

function clearOverlays(): void {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

function card(html: string): HTMLDivElement {
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML = html;
  host.appendChild(el);
  return el;
}

/* ---------------------------------------------------------------- lodge ---- */
function showLodge(): void {
  narrator.stop();
  leaveWorld();
  const area = Content.activeArea();
  const done = store.get().voltooid;
  const cards = area.missies
    .map((m) => {
      const engines = Array.from(new Set(m.stappen.map((s) => SKILL_META[s.ef as Engine]?.naam ?? s.ef)));
      const klaar = done[m.id] ? `<span class="mc-done" aria-label="voltooid">✓</span>` : '';
      return (
        `<button class="mission-card" type="button" data-id="${esc(m.id)}">` +
        `<span class="mc-land">${esc(m.landschap)}</span>${klaar}` +
        `<span class="mc-title">${esc(m.titel)}</span>` +
        `<span class="mc-eng">${engines.map((e) => `<span class="mc-chip">${esc(e)}</span>`).join('')}</span>` +
        `</button>`
      );
    })
    .join('');

  const el = card(
    `<div class="lodge">` +
    `<p class="boot-kicker">Ranger-hut · ${esc(area.naam)}</p>` +
    `<h1 class="boot-title">Kies een missie</h1>` +
    `<div class="mission-grid">${cards}</div>` +
    `<div class="ra-row">` +
    `<button class="btn-start lodge-explore" type="button">Verken de Veluwe (3D)</button>` +
    `</div>` +
    `<button class="ra-text-btn lodge-badges" type="button">Bekijk je breinkracht-badges</button>` +
    `</div>`,
  );

  el.querySelectorAll<HTMLButtonElement>('.mission-card').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.unlock();
      void loadGameAudio();                 // unlocked by this tap → real calls + ambience
      const m = area.missies.find((mm) => mm.id === b.dataset.id);
      if (m) showBriefing(m);
    });
  });
  el.querySelector('.lodge-explore')?.addEventListener('click', () => {
    Sound.unlock();
    void loadGameAudio();
    startExplore();
  });
  el.querySelector('.lodge-badges')?.addEventListener('click', showBadges);
}

/* ----------------------------------------------------- 3D free-roam ---- */
function startExplore(): void {
  const area = Content.activeArea();
  const markers: WorldMarker[] = area.missies.map((m) => {
    const ef = m.stappen[0]?.ef as Engine | undefined;
    const animal = m.dier ?? '';
    const isBird = MODEL_OF[animal]?.includes('raven') || MODEL_OF[animal]?.includes('nightjar');
    return {
      missionId: m.id,
      titel: m.titel,
      modelId: MODEL_OF[animal] ?? null,
      height: isBird ? 0.5 : 0.9,
      color: (ef && SKILL_META[ef]?.kleur) || '#f5c23b',
    };
  });

  world = new World(stage.renderer.domElement as HTMLCanvasElement, markers, onApproach);
  stage.enterWorld(world);
  showExploreHud();
}

function showExploreHud(): void {
  const el = card(
    `<div class="explore-hud">` +
    `<button class="ra-pill explore-back" type="button">‹ Terug naar de hut</button>` +
    `<p class="explore-hint">Tik op een dier om mee te spelen — of tik op de grond om te lopen.</p>` +
    `<div class="explore-prompt" hidden></div>` +
    `</div>`,
  );
  el.querySelector('.explore-back')?.addEventListener('click', showLodge);
}

let approachId: string | null = null;
function onApproach(missionId: string | null): void {
  approachId = missionId;
  const prompt = host.querySelector<HTMLDivElement>('.explore-prompt');
  if (!prompt) return;
  if (!missionId) { prompt.hidden = true; prompt.innerHTML = ''; return; }
  const m = Content.activeArea().missies.find((mm) => mm.id === missionId);
  if (!m) return;
  prompt.hidden = false;
  prompt.innerHTML = `<button class="btn-start explore-play" type="button">Speel mee: ${esc(m.titel)}</button>`;
  prompt.querySelector('.explore-play')?.addEventListener('click', () => {
    if (approachId !== missionId) return;
    leaveWorld();
    showBriefing(m);
  });
}

/* ------------------------------------------------------------ briefing ---- */
function showBriefing(mission: Mission): void {
  const jargon = store.get().settings.jargon;
  const lines = (jargon && mission.briefing.knap?.length ? mission.briefing.knap : mission.briefing.simpel) ?? [];
  const spoken = `${mission.titel}. ${lines.join(' ')}`;

  const el = card(
    `<div class="briefing boot-card-ish">` +
    `<p class="boot-kicker">Missie · ${esc(mission.landschap)}</p>` +
    `<h1 class="boot-title">${esc(mission.titel)}</h1>` +
    `<div class="briefing-lines">${lines.map((l) => `<p class="briefing-line">${esc(l)}</p>`).join('')}</div>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start" type="button">Start de missie</button>` +
    `</div>` +
    `<button class="ra-text-btn briefing-back" type="button">Terug naar de hut</button>` +
    `</div>`,
  );
  if (store.get().settings.voorlezen) narrator.speak(spoken);
  el.querySelector('.ra-speak')?.addEventListener('click', () => narrator.speak(spoken));
  el.querySelector('.briefing-back')?.addEventListener('click', showLodge);
  el.querySelector('.btn-start')?.addEventListener('click', () => void runMission(mission));
}

/* ---------------------------------------------------------- play loop ---- */
async function runMission(mission: Mission): Promise<void> {
  const played: Engine[] = [];
  let skipped: string | null = null;
  for (let i = 0; i < mission.stappen.length; i++) {
    const step = mission.stappen[i];
    const play = ENGINE_VIEWS[step.ef];
    if (!play) { skipped = step.ef; break; }
    clearOverlays();
    const result = await play(host, step);
    store.logSession(step.ef as Engine, result);
    played.push(step.ef as Engine);
    if (step.skin.feit) await showFact(step, i + 1, mission.stappen.length);
  }
  store.markMissionDone(mission.id);
  showReward(mission, played, skipped);
}

function showFact(step: Step, n: number, total: number): Promise<void> {
  return new Promise((resolve) => {
    const feit = String(step.skin.feit ?? '');
    const el = card(
      `<div class="fact boot-card-ish">` +
      `<p class="boot-kicker">Wist je dat? · ${n}/${total}</p>` +
      `<p class="fact-text">${esc(feit)}</p>` +
      `<div class="ra-row">` +
      `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `<button class="btn-start" type="button">Verder</button>` +
      `</div></div>`,
    );
    if (store.get().settings.voorlezen) narrator.speak(feit);
    el.querySelector('.ra-speak')?.addEventListener('click', () => narrator.speak(feit));
    el.querySelector('.btn-start')?.addEventListener('click', () => { narrator.stop(); resolve(); });
  });
}

/* ------------------------------------------------------------- reward ---- */
function showReward(mission: Mission, played: Engine[], skipped: string | null): void {
  const skill = store.get().skill;
  const badges = Array.from(new Set(played))
    .map((e) => {
      const meta = SKILL_META[e];
      const best = skill[e]?.best ?? 1;
      const tier = tierFor(best);
      const pct = Math.round(badgeProgress(best) * 100);
      return (
        `<div class="badge" style="--bk:${meta.kleur};--ring:${tier.ring};--glow:${tier.glow}">` +
        `<span class="badge-disc" style="background:${tier.kleur}">${esc(meta.taak.slice(0, 1))}</span>` +
        `<span class="badge-name">${esc(meta.naam)}</span>` +
        `<span class="badge-tier">${esc(tier.naam)}</span>` +
        `<span class="badge-bar"><span style="width:${pct}%"></span></span>` +
        `</div>`
      );
    })
    .join('');

  const knap = mission.beloning.vaktermBadge
    ? `<p class="reward-knap">Knap woord: <b>${esc(mission.beloning.vaktermBadge.naam.replace(/^Knap woord:\s*/i, ''))}</b></p>`
    : '';
  const note = skipped
    ? `<p class="boot-sub reward-note">De stap “${esc(skipped)}” komt eraan.</p>`
    : '';
  const reunion = mission.reunion?.tekst ? `<p class="boot-sub">${esc(mission.reunion.tekst)}</p>` : '';

  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Missie klaar · ${esc(mission.titel)}</p>` +
    `<h1 class="boot-title">Knap gedaan!</h1>` +
    reunion +
    `<div class="badge-row">${badges}</div>` +
    knap +
    note +
    `<button class="btn-start" type="button">Terug naar de hut</button>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  if (store.get().settings.voorlezen) narrator.speak('Knap gedaan!');
  el.querySelector('.btn-start')?.addEventListener('click', showLodge);
}

/* -------------------------------------------------------- badge wall ---- */
function showBadges(): void {
  const skill = store.get().skill;
  const wall = (Object.keys(SKILL_META) as Engine[])
    .map((e) => {
      const meta = SKILL_META[e];
      const best = skill[e]?.best ?? 1;
      const tier = tierFor(best);
      const pct = Math.round(badgeProgress(best) * 100);
      return (
        `<div class="badge" style="--bk:${meta.kleur};--ring:${tier.ring};--glow:${tier.glow}">` +
        `<span class="badge-disc" style="background:${tier.kleur}">${esc(meta.taak.slice(0, 1))}</span>` +
        `<span class="badge-name">${esc(meta.naam)}</span>` +
        `<span class="badge-tier">${esc(tier.naam)}</span>` +
        `<span class="badge-bar"><span style="width:${pct}%"></span></span>` +
        `</div>`
      );
    })
    .join('');
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Jouw breinkracht</p>` +
    `<h1 class="boot-title">Badges</h1>` +
    `<div class="badge-row">${wall}</div>` +
    `<button class="btn-start" type="button">Terug naar de hut</button>` +
    `</div>`,
  );
  el.querySelector('.btn-start')?.addEventListener('click', showLodge);
}
