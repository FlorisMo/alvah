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
import { rangerNaam } from '../core/avatar';
import { Sound } from '../core/sound';
import { loadGameAudio } from '../core/calls';
import type { Stage } from '../render3d/Stage';
import { World, type WorldMarker } from '../render3d/World';
import { type WayCue } from '../render3d/Wayfinding';
import { playZoeken } from '../render2d/ZoekenView';
import { playRoute } from '../render2d/RouteView';
import { playSimon } from '../render2d/SimonView';
import { playDanger } from '../render2d/DangerView';
import { playWissel } from '../render2d/WisselView';
import { showCabin } from './Companion';
import { showAvatarCreator } from './AvatarCreator';

/** The ranger's name (falls back to "Alvah") — threaded into briefing/fact/reward + voice. */
const naam = (): string => rangerNaam(store.get().avatar);

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
    `<div class="lodge-links">` +
    `<button class="ra-text-btn lodge-badges" type="button">Bekijk je breinkracht-badges</button>` +
    `<button class="ra-text-btn lodge-cabin" type="button">${esc(cabinLabel())}</button>` +
    `<button class="ra-text-btn lodge-prikbord" type="button">Open het prikbord${cluesBadge()}</button>` +
    `<button class="ra-text-btn lodge-ranger" type="button">Pas ${esc(naam())} aan</button>` +
    `</div>` +
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
  el.querySelector('.lodge-cabin')?.addEventListener('click', () => showCabin(host, showLodge));
  el.querySelector('.lodge-prikbord')?.addEventListener('click', showCaseBoard);
  el.querySelector('.lodge-ranger')?.addEventListener('click', () => showAvatarCreator(host, showLodge));
}

/** Lodge link label reflects the companion: rescue prompt → friend's name. */
function cabinLabel(): string {
  const c = store.get().companion;
  if (!c.rescued) return 'Vang je raaf op';
  return `Verzorg ${c.naam || 'je raaf'}`;
}

/* ------------------------------------------------- case-board (prikbord) ---- */
/** Simple per-soort glyph (dual-channel: glyph + the found colour). */
const CLUE_GLYPH: Record<string, string> = { spoor: '🐾', camera: '📷', band: '🛞' };

function cluesBadge(): string {
  const area = Content.activeArea();
  const found = Content.cluesFound(area.id, store.get().voltooid).size;
  const total = Content.clues(area.id).length;
  if (!total) return '';
  return ` <span class="lodge-clue-count">${found}/${total}</span>`;
}

function showCaseBoard(): void {
  narrator.stop();
  const area = Content.activeArea();
  const voltooid = store.get().voltooid;
  const clues = Content.clues(area.id);
  const found = Content.cluesFound(area.id, voltooid);
  const chapter = Content.currentChapter(area.id, voltooid);
  const gemeld = store.get().arc.gemeld;
  const allFound = clues.length > 0 && clues.every((c) => found.has(c.id));
  const laatste = [...clues].reverse().find((c) => found.has(c.id)) ?? null;

  const board = clues
    .map((c) => {
      const isF = found.has(c.id);
      const glyph = isF ? (CLUE_GLYPH[c.soort] ?? '📌') : '?';
      return (
        `<div class="cb-clue${isF ? ' found' : ''}">` +
        `<span class="cb-pin" aria-hidden="true"></span>` +
        `<span class="cb-photo">${glyph}</span>` +
        `<span class="cb-clue-title">${esc(isF ? c.titel : '???')}</span>` +
        (isF ? `<span class="cb-clue-text">${esc(c.tekst)}</span>` : '') +
        `</div>`
      );
    })
    .join('');

  const count = gemeld ? 'opgelost' : `${found.size}/${clues.length}`;
  const note = gemeld
    ? `<p class="cb-note ok">De stroper is gestopt. De heide en het ven groeien weer terug.</p>`
    : laatste
      ? `<p class="cb-note">${esc(laatste.tekst)}</p>`
      : `<p class="cb-note muted">Los missies op. Aanwijzingen komen hier te hangen.</p>`;
  const resolveBtn =
    allFound && !gemeld
      ? `<button class="btn-start cb-resolve" type="button">Volg het spoor</button>`
      : '';

  const el = card(
    `<div class="case-board boot-card-ish">` +
    `<p class="boot-kicker">Het prikbord · ${esc(chapter?.naam ?? '')} · ${count}</p>` +
    `<h1 class="boot-title">Wat is hier aan de hand?</h1>` +
    `<div class="cb-cork">${board}</div>` +
    note +
    `<div class="ra-row">` +
    resolveBtn +
    `<button class="ra-text-btn cb-back" type="button">Terug naar de hut</button>` +
    `</div>` +
    `</div>`,
  );
  if (store.get().settings.voorlezen && laatste && !gemeld) narrator.speak(laatste.tekst);
  el.querySelector('.cb-back')?.addEventListener('click', showLodge);
  el.querySelector('.cb-resolve')?.addEventListener('click', () => {
    Sound.unlock();
    showOntknoping(0);
  });
}

/** The hopeful resolution: step through the ontknoping beats, then report → resolved. */
function showOntknoping(idx: number): void {
  const area = Content.activeArea();
  const beats = Content.verhaalboog(area.id)?.ontknoping ?? [];
  const beat = beats[idx];
  if (!beat) { store.reportArc(); showCaseBoard(); return; }
  const last = idx === beats.length - 1;
  const el = card(
    `<div class="ontknoping boot-card-ish">` +
    `<p class="boot-kicker">Op het spoor · ${idx + 1}/${beats.length}</p>` +
    `<p class="ont-text">${esc(beat.tekst)}</p>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start" type="button">${last ? 'Klaar' : 'Verder'}</button>` +
    `</div></div>`,
  );
  if (store.get().settings.voorlezen) narrator.speak(beat.tekst);
  el.querySelector('.ra-speak')?.addEventListener('click', () => narrator.speak(beat.tekst));
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    narrator.stop();
    if (last) { store.reportArc(); if (store.get().settings.geluid) Sound.found(); }
    showOntknoping(idx + 1);
  });
}

/* ----------------------------------------------------- 3D free-roam ---- */
function startExplore(): void {
  const area = Content.activeArea();
  const markers: WorldMarker[] = area.missies.map((m) => {
    const ef = m.stappen[0]?.ef as Engine | undefined;
    const animal = m.dier ?? '';
    const isBird = MODEL_OF[animal]?.includes('raven') || MODEL_OF[animal]?.includes('nightjar');
    const BIOMES = ['heide', 'bos', 'stuifzand', 'ven'] as const;
    const biome = (BIOMES as readonly string[]).includes(m.landschap)
      ? (m.landschap as typeof BIOMES[number]) : undefined;
    return {
      missionId: m.id,
      titel: m.titel,
      modelId: MODEL_OF[animal] ?? null,
      height: isBird ? 0.5 : 0.9,
      color: (ef && SKILL_META[ef]?.kleur) || '#f5c23b',
      biome,
    };
  });

  // the active mission the wayfinding cue points to = the first not-yet-done one
  const done = store.get().voltooid;
  const active = area.missies.find((m) => !done[m.id])?.id ?? area.missies[0]?.id ?? null;

  world = new World(
    stage.renderer.domElement as HTMLCanvasElement, markers, onApproach, onWayfind, active,
  );
  stage.enterWorld(world);
  showExploreHud(area.missies.find((m) => m.id === active)?.titel ?? null);
}

function showExploreHud(activeTitel: string | null): void {
  const veld = activeTitel
    ? `<div class="explore-wayfind" role="status" aria-live="polite">` +
      `<span class="wf-glyph" aria-hidden="true">·</span>` +
      `<span class="wf-text"><b class="wf-doel">${esc(activeTitel)}</b><span class="wf-cue">zoek het spoor…</span></span>` +
      `</div>`
    : '';
  const el = card(
    `<div class="explore-hud">` +
    `<button class="ra-pill explore-back" type="button">‹ Terug naar de hut</button>` +
    `<p class="explore-hint">Tik op een dier om mee te spelen — of tik op de grond om te lopen.</p>` +
    veld +
    `<div class="explore-prompt" hidden></div>` +
    `</div>`,
  );
  el.querySelector('.explore-back')?.addEventListener('click', showLodge);
}

/** Render the calm wayfinding cue into the veldnotitie strip (dual-channel: glyph +
 *  words + colour; no minimap chrome). Reduced-motion-safe — only text swaps. */
function onWayfind(cue: WayCue | null): void {
  const strip = host.querySelector<HTMLDivElement>('.explore-wayfind');
  if (!strip) return;
  if (!cue) { strip.hidden = true; return; }
  strip.hidden = false;
  const glyph = strip.querySelector<HTMLSpanElement>('.wf-glyph');
  const cueEl = strip.querySelector<HTMLSpanElement>('.wf-cue');
  if (glyph) glyph.textContent = cue.glyph;
  if (cueEl) cueEl.textContent = cue.arrived ? 'je bent er' : `${cue.richting} · ${cue.afstand}`;
  strip.classList.toggle('wf-arrived', cue.arrived);
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
  const spoken = `Ranger ${naam()}. ${mission.titel}. ${lines.join(' ')}`;

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
      `<p class="boot-kicker">Wist je dat, ${esc(naam())}? · ${n}/${total}</p>` +
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

  const lof = `Knap gedaan, ${naam()}!`;
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Missie klaar · ${esc(mission.titel)}</p>` +
    `<h1 class="boot-title">${esc(lof)}</h1>` +
    reunion +
    `<div class="badge-row">${badges}</div>` +
    knap +
    note +
    `<button class="btn-start" type="button">Terug naar de hut</button>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  if (store.get().settings.voorlezen) narrator.speak(lof);
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
