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
import { mountReadAloud } from './ReadAloud';
import { rangerNaam } from '../core/avatar';
import { Sound } from '../core/sound';
import { loadGameAudio, setAmbientScene } from '../core/calls';
import type { Biome } from '../render3d/Biomes';
import type { Stage } from '../render3d/Stage';
import { World, type WorldMarker } from '../render3d/World';
import { type WayCue } from '../render3d/Wayfinding';
import { prefersReducedMotion } from '../core/reduced-motion';
import { resolveViewMode, variantFor } from '../render3d/play/ViewMode';
import { REGISTRY_3D } from '../render3d/play/registry';
import { nextPatrolTarget, capturedClue } from '../core/patrol';
import { pickWorldBeat, optionCorrect, coarseHeading, type WorldBeat } from '../core/worldbeat';
import type { Clue } from '../content/types';
import { playZoeken } from '../render2d/ZoekenView';
import { playRoute } from '../render2d/RouteView';
import { playSimon } from '../render2d/SimonView';
import { playDanger } from '../render2d/DangerView';
import { playWissel } from '../render2d/WisselView';
import { showCabin } from './Companion';
import { showAvatarCreator } from './AvatarCreator';
import { startSandbox } from './Sandbox';
import { showTweaks } from './Tweaks';
import { showDemoSkip } from './DemoSkip';
import { startDeepDemoTour } from './DeepDemo';

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

/** WebGL support, probed once — a gate for the in-place 3D view (else the 2D floor). */
const WEBGL_OK: boolean = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

let host: HTMLElement;
let stage: Stage;
let world: World | null = null;

// When set (by the Deep Demo tour), the explore HUD's "Terug" tears down the
// world and returns HERE instead of the lodge — so a free-roam / in-world engine
// beat hands control back to the guided tour. Cleared on every lodge entry.
let worldExit: (() => void) | null = null;

// Light world-EF seasoning: count in-world mission completions this session so the
// pure `pickWorldBeat` cadence (every Nth return) stays rare. `lastBeatTick` dedups
// the one beat per completion across the several `resumePatrol` hops in a cycle.
let patrolTick = 0;
let lastBeatTick = -1;

export function startLodge(ui: HTMLElement, st: Stage): void {
  host = ui;
  stage = st;
  showLodge();
}

/** The first mission whose step list features this engine (for the demo engine beat). */
function firstMissionForEngine(engine: Engine): string | null {
  for (const m of Content.activeArea().missies) {
    if (m.stappen.some((s) => s.ef === engine)) return m.id;
  }
  return null;
}

/**
 * Launch the Deep Demo guided tour (Capstone 132a): a narrated walk that opens
 * each LIVE surface in turn. The world beats (free-roam + in-world engine) set
 * `worldExit` so the explore HUD's "Terug" returns to the tour, not the lodge.
 * The DOM-overlay beats reuse `showMetaDemo`'s demo-back wiring + the live
 * avatar/sandbox entries. No import cycle — DeepDemo gets the flows via `api`.
 */
export function startDeepDemo(ui: HTMLElement, st: Stage): void {
  host = ui;
  stage = st;
  worldExit = null;
  Sound.unlock();
  void loadGameAudio();   // the tour shows the cast + plays calls/ambience
  startDeepDemoTour(host, {
    openAvatar: (back) => showAvatarCreator(host, back),
    openSandbox: (back) => { leaveWorld(); startSandbox(host, stage, back); },
    openArc: (back) => showMetaDemo(host, 'arc', back),
    openCompanion: (back) => showMetaDemo(host, 'companion', back),
    openBadges: (back) => showMetaDemo(host, 'badge', back),
    openFreeroam: (back) => { worldExit = back; if (!world) startExplore(); else showExploreHud(activeExploreTitel()); },
    openEngine: (engine, back) => {
      const mid = firstMissionForEngine(engine);
      if (!mid) { back(); return; }
      worldExit = back;
      demoJump(mid, true);   // loads/keeps the world, plays the engine in-place
    },
    backToLodge: () => { worldExit = null; showLodge(); },
  });
}

/** The title the wayfinding cue points at = the first not-yet-done mission. */
function activeExploreTitel(): string | null {
  const area = Content.activeArea();
  const done = store.get().voltooid;
  const id = area.missies.find((m) => !done[m.id])?.id ?? area.missies[0]?.id ?? null;
  return area.missies.find((m) => m.id === id)?.titel ?? null;
}

function leaveWorld(): void {
  if (world) { world.dispose(); world = null; stage.exitWorld(); }
}

/** The explore HUD "Terug" target: hand back to the Deep Demo tour if it owns the
 *  world session (tears the world down first), else return to the lodge. */
function exitWorld(): void {
  if (worldExit) { const back = worldExit; worldExit = null; leaveWorld(); back(); }
  else showLodge();
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
  worldExit = null;   // a normal lodge visit clears any Deep Demo world-return
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
    `<button class="ra-text-btn lodge-deepdemo" type="button">Diepe demo: de hele rondleiding</button>` +
    `<button class="ra-text-btn lodge-sandbox" type="button">Demo: de hele Veluwe in het klein</button>` +
    `<button class="ra-text-btn lodge-demo" type="button">Demo: spring &amp; test</button>` +
    `<button class="ra-text-btn lodge-tweaks" type="button">Instellingen</button>` +
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
  el.querySelector('.lodge-badges')?.addEventListener('click', () => showBadges());
  el.querySelector('.lodge-cabin')?.addEventListener('click', () => showCabin(host, showLodge));
  el.querySelector('.lodge-prikbord')?.addEventListener('click', () => showCaseBoard());
  el.querySelector('.lodge-ranger')?.addEventListener('click', () => showAvatarCreator(host, showLodge));
  el.querySelector('.lodge-sandbox')?.addEventListener('click', () => {
    clearOverlays();
    startSandbox(host, stage, showLodge);
  });
  el.querySelector('.lodge-demo')?.addEventListener('click', () =>
    showDemoSkip(host, { jumpMission: demoJump, back: showLodge }));
  el.querySelector('.lodge-deepdemo')?.addEventListener('click', () => startDeepDemo(host, stage));
  el.querySelector('.lodge-tweaks')?.addEventListener('click', () => showTweaks(host, showLodge));
}

/** Demo-skip jump (§9g, driven by DemoSkip.ts): play any mission without
 *  grinding. `in3d` loads (or keeps) the free-roam world so the mission plays
 *  in-place via runMission's §1f ViewMode branch; otherwise the 2D floor from
 *  the lodge. The briefing is shown unless the skip-briefings Tweak is on
 *  (handled in showBriefing). */
function demoJump(missionId: string, in3d: boolean): void {
  const m = Content.activeArea().missies.find((mm) => mm.id === missionId);
  if (!m) { showLodge(); return; }
  Sound.unlock();
  void loadGameAudio();
  if (in3d) {
    if (!world) startExplore();   // load the world (sets `world` + the explore HUD)
    showBriefing(m, true);        // veldnotitie entry → plays 3D in-place; returns to patrol
  } else {
    leaveWorld();
    showBriefing(m, false);       // 2D floor → returns to the lodge
  }
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

/** The prikbord. From the world (`fromWorld`) the back + resolve buttons stay in
 *  the patrol flow (the world stays loaded behind the overlay); from the lodge
 *  they return to the hut. */
function showCaseBoard(fromWorld = false, demoBack?: () => void): void {
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
    `<button class="ra-text-btn cb-back" type="button">${demoBack ? 'Terug naar de demo' : fromWorld ? 'Verder op patrouille' : 'Terug naar de hut'}</button>` +
    `</div>` +
    `</div>`,
  );
  // Only the latest-clue note is read aloud (and karaoke-highlighted); the
  // "opgelost" / "muted placeholder" notes carry no live clue text to speak.
  const noteEl = !gemeld && laatste ? el.querySelector<HTMLElement>('.cb-note') : null;
  const ra = noteEl
    ? mountReadAloud({ textEl: noteEl, text: laatste!.tekst, autoStart: store.get().settings.voorlezen })
    : null;
  el.querySelector('.cb-back')?.addEventListener('click', () => {
    ra?.stop();
    if (demoBack) demoBack(); else if (fromWorld) resumePatrol(); else showLodge();
  });
  el.querySelector('.cb-resolve')?.addEventListener('click', () => {
    ra?.stop();
    Sound.unlock();
    showOntknoping(0, fromWorld, demoBack);
  });
}

/** The hopeful resolution: step through the ontknoping beats, then report → resolved. */
function showOntknoping(idx: number, fromWorld = false, demoBack?: () => void): void {
  const area = Content.activeArea();
  const beats = Content.verhaalboog(area.id)?.ontknoping ?? [];
  const beat = beats[idx];
  // demo mode (showroom): show the resolve beats but never commit the real arc-report.
  if (!beat) { if (demoBack) { demoBack(); return; } store.reportArc(); showCaseBoard(fromWorld); return; }
  const last = idx === beats.length - 1;
  const el = card(
    `<div class="ontknoping boot-card-ish">` +
    `<p class="boot-kicker">Op het spoor · ${idx + 1}/${beats.length}</p>` +
    `<p class="ont-text"></p>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start" type="button">${last ? 'Klaar' : 'Verder'}</button>` +
    `</div></div>`,
  );
  const ra = mountReadAloud({
    textEl: el.querySelector('.ont-text')!,
    text: beat.tekst,
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    if (last) { if (!demoBack) store.reportArc(); if (store.get().settings.geluid) Sound.found(); }
    showOntknoping(idx + 1, fromWorld, demoBack);
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

  // the season tints the ambience bed (forward-compatible with seasonal beds);
  // take it from the story's current chapter so the world matches the arc moment.
  const seizoen = Content.currentChapter(area.id, done)?.seizoen;
  const onBiome = (b: Biome) => setAmbientScene(b, seizoen);

  world = new World(
    stage.renderer.domElement as HTMLCanvasElement, markers, onApproach, onWayfind, active,
    onBiome,
  );
  // start the bed on the lodge clearing (heide) before the first crossing fires
  setAmbientScene('heide', seizoen);
  stage.enterWorld(world);
  showExploreHud(area.missies.find((m) => m.id === active)?.titel ?? null);
}

/** Resume free-roam after an in-world mission instead of dropping to the lodge:
 *  keep the world loaded, re-point the wayfinding cue at the next thing to do
 *  (the continuous-patrol §8d 2b loop), and restore the explore HUD. Falls back
 *  to the lodge only if the world is somehow gone. */
function resumePatrol(): void {
  if (!world) { showLodge(); return; }
  const area = Content.activeArea();
  const next = nextPatrolTarget(area.missies, store.get().voltooid);
  world.setActiveMission(next);
  const titel = area.missies.find((m) => m.id === next)?.titel ?? null;
  // Light world-EF seasoning (BUILD-PLAN §8b): once per completed patrol cycle,
  // on the rare cadence, dust a calm skippable micro-beat before resuming. The
  // wayfinding flavour scores against the live bearing to the next marker.
  if (patrolTick !== lastBeatTick) {
    const beat = pickWorldBeat({ patrolTick, heading: coarseHeading(world.headingTo(next)) });
    if (beat) { lastBeatTick = patrolTick; showWorldBeat(beat, () => showExploreHud(titel)); return; }
  }
  showExploreHud(titel);
}

/* --------------------------------------------------- world-EF micro-beat ---- */
/** A calm, skippable open-world EF beat between missions (impulse-resist or
 *  wayfinding-recall). Never-scary, never game-over: a wrong tap gives a soft
 *  "probeer nog eens" and re-presents the SAME beat; "Even verder" always lets
 *  the child walk on. Dual-channel (colour + glyph + words + read-aloud), ≥56px. */
function showWorldBeat(beat: WorldBeat, done: () => void): void {
  narrator.stop();
  const kicker = beat.kind === 'blijf-op-pad' ? '🌿 Onderweg' : '🧭 Onderweg';
  const opts = beat.options
    .map((o, i) =>
      `<button class="wb-opt" type="button" data-i="${i}">` +
      `<span class="wb-glyph" aria-hidden="true">${esc(o.glyph)}</span>` +
      `<span class="wb-label">${esc(o.label)}</span>` +
      `</button>`,
    )
    .join('');
  const el = card(
    `<div class="worldbeat boot-card-ish">` +
    `<p class="boot-kicker">${kicker}</p>` +
    `<p class="wb-prompt"></p>` +
    `<div class="wb-opts">${opts}</div>` +
    `<p class="wb-feedback" role="status" aria-live="polite" hidden></p>` +
    `<button class="ra-text-btn wb-skip" type="button">Even verder lopen</button>` +
    `</div>`,
  );
  const ra = mountReadAloud({
    textEl: el.querySelector('.wb-prompt')!,
    text: beat.prompt,
    autoStart: store.get().settings.voorlezen,
  });
  const fb = el.querySelector<HTMLParagraphElement>('.wb-feedback');
  const finish = (): void => { ra.stop(); done(); };
  el.querySelectorAll<HTMLButtonElement>('.wb-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      ra.stop();
      const i = Number(btn.dataset.i);
      if (optionCorrect(beat, i)) {
        // success sings — colour + scale + sound + word, then resume patrol
        btn.classList.add('wb-goed');
        if (store.get().settings.geluid) Sound.found();
        if (fb) { fb.hidden = false; fb.textContent = 'Goed onthouden, ranger!'; fb.className = 'wb-feedback wb-fb-goed'; }
        if (store.get().settings.voorlezen) narrator.speak('Goed onthouden, ranger!');
        el.querySelectorAll<HTMLButtonElement>('.wb-opt').forEach((b) => (b.disabled = true));
        window.setTimeout(finish, 900);
      } else {
        // soft, recoverable — quiet note, same beat stays up (never game-over)
        btn.classList.add('wb-bijna');
        if (store.get().settings.geluid) Sound.tryAgain();
        if (fb) { fb.hidden = false; fb.textContent = 'Bijna! Blijf rustig — probeer nog eens.'; fb.className = 'wb-feedback wb-fb-bijna'; }
        if (store.get().settings.voorlezen) narrator.speak('Bijna. Probeer nog eens.');
        window.setTimeout(() => btn.classList.remove('wb-bijna'), 500);
      }
    });
  });
  el.querySelector('.wb-skip')?.addEventListener('click', finish);
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
    `<button class="ra-pill explore-board" type="button">📌 Prikbord${cluesBadge()}</button>` +
    `<p class="explore-hint">Tik op een dier om mee te spelen — of tik op de grond om te lopen.</p>` +
    veld +
    `<div class="explore-prompt" hidden></div>` +
    `</div>`,
  );
  el.querySelector('.explore-back')?.addEventListener('click', exitWorld);
  // reach the prikbord over the LIVE world — no teardown; back returns to patrol.
  el.querySelector('.explore-board')?.addEventListener('click', () => showCaseBoard(true));
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
    // keep the world loaded — the mission may play in-place (3D). runMission's
    // ViewMode branch picks 3D-in-world or the 2D floor per step. Launched from
    // the world → the diegetic veldnotitie entry + return-to-patrol flow (the
    // world is only torn down by showLodge).
    showBriefing(m, true);
  });
}

/* ------------------------------------------------------------ briefing ---- */
/** The mission entry card. From the lodge it's a "Missie"-briefing; from the
 *  world (`fromWorld`) it reads as a lighter diegetic *veldnotitie* (field note)
 *  so launching a mission never feels like leaving the world, and its back +
 *  start buttons stay in the patrol flow rather than returning to the lodge. */
function showBriefing(mission: Mission, fromWorld = false): void {
  // Demo-skip (§9g): the "skip briefings" Tweak jumps straight into play, no
  // uitleg-scherm. The world (if loaded) stays loaded across the §1f branch.
  if (store.get().settings.skipBriefings) { clearOverlays(); void runMission(mission, fromWorld); return; }
  const jargon = store.get().settings.jargon;
  const lines = (jargon && mission.briefing.knap?.length ? mission.briefing.knap : mission.briefing.simpel) ?? [];

  const kicker = fromWorld ? `Veldnotitie · ${esc(mission.landschap)}` : `Missie · ${esc(mission.landschap)}`;
  const startLabel = fromWorld ? 'Ga op pad' : 'Start de missie';
  const backLabel = fromWorld ? 'Nog even rondkijken' : 'Terug naar de hut';
  const wrapClass = fromWorld ? 'briefing veldnotitie boot-card-ish' : 'briefing boot-card-ish';

  const el = card(
    `<div class="${wrapClass}">` +
    `<p class="boot-kicker">${kicker}</p>` +
    `<h1 class="boot-title">${esc(mission.titel)}</h1>` +
    `<div class="briefing-lines">${lines.map((_, i) => `<p class="briefing-line" data-line="${i}"></p>`).join('')}</div>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start" type="button">${startLabel}</button>` +
    `</div>` +
    `<button class="ra-text-btn briefing-back" type="button">${backLabel}</button>` +
    `</div>`,
  );
  const lineEls = Array.from(el.querySelectorAll<HTMLElement>('.briefing-line'));
  const ra = mountReadAloud({
    lead: `Ranger ${naam()}. ${mission.titel}.`,
    segments: lines.map((l, i) => ({ el: lineEls[i], text: l })),
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.briefing-back')?.addEventListener('click', () => { ra.stop(); if (fromWorld) resumePatrol(); else showLodge(); });
  el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); void runMission(mission, fromWorld); });
}

/* ---------------------------------------------------------- play loop ---- */
async function runMission(mission: Mission, fromWorld = false): Promise<void> {
  const played: Engine[] = [];
  let skipped: string | null = null;
  for (let i = 0; i < mission.stappen.length; i++) {
    const step = mission.stappen[i];
    const play = ENGINE_VIEWS[step.ef];
    if (!play) { skipped = step.ef; break; }
    clearOverlays();
    // The ONE branch (§1f): play the step diegetically in-place when the world is
    // live AND a parity-green 3D variant ships for this engine; otherwise the 2D
    // floor. The world (if loaded) stays loaded across both paths.
    const mode = resolveViewMode({
      engine: step.ef as Engine,
      sceneLive: !!world,
      webglCapable: WEBGL_OK,
      reducedMotion: prefersReducedMotion(),
      force2d: store.get().settings.force2d, // Tweaks "altijd 2D" → always the 2D floor
      registry: REGISTRY_3D,
    });
    let result: BeatSummary;
    if (mode === '3d' && world) {
      const variant = variantFor(REGISTRY_3D, step.ef as Engine)!;
      world.beginActivity();
      try {
        result = await variant.play(world.ctx(host), step);
      } finally {
        world.endActivity();
      }
    } else {
      result = await play(host, step);
    }
    store.logSession(step.ef as Engine, result);
    played.push(step.ef as Engine);
    if (step.skin.feit) await showFact(step, i + 1, mission.stappen.length);
  }
  // The case-board data gate (Content.cluesFound) keys off voltooid, so snapshot
  // the found-set BEFORE marking this mission done. The diegetic clue beat fires
  // only when this completion makes the hook NEWLY appear on the board (so a
  // replay, or a second mission sharing the same hook, never re-announces it).
  const areaId = Content.activeArea().id;
  const before = Content.cluesFound(areaId, store.get().voltooid);
  store.markMissionDone(mission.id);
  // a genuine in-world completion advances patrol → the world-EF beat cadence
  if (fromWorld) patrolTick++;
  const clueId = capturedClue(mission, fromWorld, before);
  showReward(mission, played, skipped, fromWorld, clueId);
}

function showFact(step: Step, n: number, total: number): Promise<void> {
  return new Promise((resolve) => {
    const feit = String(step.skin.feit ?? '');
    const el = card(
      `<div class="fact boot-card-ish">` +
      `<p class="boot-kicker">Wist je dat, ${esc(naam())}? · ${n}/${total}</p>` +
      `<p class="fact-text"></p>` +
      `<div class="ra-row">` +
      `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
      `<button class="btn-start" type="button">Verder</button>` +
      `</div></div>`,
    );
    const ra = mountReadAloud({
      textEl: el.querySelector('.fact-text')!,
      text: feit,
      speakBtn: el.querySelector('.ra-speak'),
      autoStart: store.get().settings.voorlezen,
    });
    el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); resolve(); });
  });
}

/* ------------------------------------------------------------- reward ---- */
function showReward(
  mission: Mission, played: Engine[], skipped: string | null,
  fromWorld = false, clueId: string | null = null,
): void {
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

  // a verhaalHaak mission finished in-world pins a clue → the diegetic
  // "vastgelegd op de wildcamera → prikbord" beat sits between reward + patrol.
  const clue = clueId
    ? Content.clues(Content.activeArea().id).find((c) => c.id === clueId) ?? null
    : null;

  const lof = `Knap gedaan, ${naam()}!`;
  // from the world → return to patrol (world stays loaded); from the lodge → hut.
  // a captured clue routes through the wildcamera snapshot first.
  const backLabel = clue ? 'Bekijk de wildcamera' : fromWorld ? 'Verder op patrouille' : 'Terug naar de hut';
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Missie klaar · ${esc(mission.titel)}</p>` +
    `<h1 class="boot-title reward-lof"></h1>` +
    reunion +
    `<div class="badge-row">${badges}</div>` +
    knap +
    note +
    `<button class="btn-start" type="button">${backLabel}</button>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  const ra = mountReadAloud({
    textEl: el.querySelector('.reward-lof')!,
    text: lof,
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    if (clue) showWildcamCapture(clue);
    else if (fromWorld) resumePatrol();
    else showLodge();
  });
}

/* ------------------------------------------------- wildcamera → prikbord ---- */
/** The diegetic clue beat: a verhaalHaak mission completed on patrol is
 *  "vastgelegd op de wildcamera" — a calm snapshot card showing the new
 *  aanwijzing now hanging on the prikbord. Two ways on: peek at the board
 *  (returns to patrol), or walk straight on. Never-scary: a still snapshot,
 *  no startle, dual-channel (glyph + colour + words + read-aloud). */
function showWildcamCapture(clue: Clue): void {
  narrator.stop();
  const line = 'Vastgelegd op de wildcamera.';
  const glyph = CLUE_GLYPH[clue.soort] ?? '📌';
  const el = card(
    `<div class="wildcam boot-card-ish">` +
    `<p class="boot-kicker">📷 ${line}</p>` +
    `<h1 class="boot-title">Een nieuwe aanwijzing</h1>` +
    `<div class="cb-clue found wildcam-shot">` +
    `<span class="cb-photo">${glyph}</span>` +
    `<span class="cb-clue-title"></span>` +
    `<span class="cb-clue-text"></span>` +
    `</div>` +
    `<p class="boot-sub">Hij hangt nu op het prikbord.</p>` +
    `<div class="ra-row">` +
    `<button class="ra-speak" type="button" aria-label="Lees voor">🔊</button>` +
    `<button class="btn-start wc-board" type="button">Bekijk het prikbord</button>` +
    `</div>` +
    `<button class="ra-text-btn wc-patrol" type="button">Verder op patrouille</button>` +
    `</div>`,
  );
  const ra = mountReadAloud({
    lead: line,
    segments: [
      { el: el.querySelector('.cb-clue-title')!, text: clue.titel },
      { el: el.querySelector('.cb-clue-text')!, text: clue.tekst },
    ],
    speakBtn: el.querySelector('.ra-speak'),
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.wc-board')?.addEventListener('click', () => { ra.stop(); showCaseBoard(true); });
  el.querySelector('.wc-patrol')?.addEventListener('click', () => { ra.stop(); resumePatrol(); });
}

/* -------------------------------------------------------- badge wall ---- */
function showBadges(demoBack?: () => void): void {
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
    `<button class="btn-start" type="button">${demoBack ? 'Terug naar de demo' : 'Terug naar de hut'}</button>` +
    `</div>`,
  );
  el.querySelector('.btn-start')?.addEventListener('click', demoBack ?? showLodge);
}

/* --------------------------------------------------- demo-sandbox meta entry ---- */
/**
 * Open one live meta screen for the Demo Sandbox (DEMO-SANDBOX.md Tier 2; ledger 75c).
 * Reuses the exact live screens — no demo re-implementation — with a demo-skip back
 * (`onBack`) instead of the lodge/patrol navigation, and never committing real arc
 * progression. `host` is pointed at the sandbox `ui` so the overlays mount there.
 * companion/avatar reuse their already-parameterised entry points; caseboard/badge/
 * fact/arc reuse the internal renderers via their optional demo-back param.
 */
export function showMetaDemo(ui: HTMLElement, id: string, onBack: () => void): void {
  host = ui;
  switch (id) {
    case 'companion': showCabin(ui, onBack); break;
    case 'avatar': showAvatarCreator(ui, onBack); break;
    case 'caseboard': showCaseBoard(false, onBack); break;
    case 'badge': showBadges(onBack); break;
    case 'arc': showOntknoping(0, false, onBack); break;
    case 'fact': void showFact(demoFactStep(), 1, 1).then(onBack); break;
    default: onBack();
  }
}

/** A representative content step that carries a "wist-je-dat" feit, for the demo fact card. */
function demoFactStep(): Step {
  for (const m of Content.activeArea().missies) {
    const s = m.stappen.find((st) => st.skin?.feit);
    if (s) return s;
  }
  return Content.activeArea().missies[0].stappen[0];
}
