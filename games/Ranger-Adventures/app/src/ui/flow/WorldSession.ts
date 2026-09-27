/**
 * WorldSession.ts — the free-roam world's life cycle: build it (`startExplore`),
 * return to it after a mission or a menu (`resumePatrol`), and tear it down
 * (`leaveWorld`). Also the two in-world beats that are not missions: the calm
 * world-EF micro-beat between missions and "Ken je roep" at the bird bench.
 *
 * The world is the front door: Begin → (first boot: make your ranger) → here.
 */

import type { Engine } from '../../core/skill';
import { SKILL_META } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { loadGameAudio, setAmbientScene } from '../../core/calls';
import type { Biome } from '../../render3d/Biomes';
import type { Stage } from '../../render3d/Stage';
import { World, type WorldMarker } from '../../render3d/World';
import { playRoep3d } from '../../render3d/engines/roep3d';
import { playRoep } from '../../render2d/RoepView';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { clearActivityWin } from '../../render3d/play/kit';
import { modelFor, heightFor } from '../../render3d/play/spawn';
import { heroOf } from '../../render3d/world/Progress';
import { nextPatrolTarget } from '../../core/patrol';
import { pickWorldBeat, optionCorrect, coarseHeading, type WorldBeat } from '../../core/worldbeat';
import { setScreen, setMissionView } from '../../core/devhook';
import { mountReadAloud } from '../ReadAloud';
import { session, esc, card, clearOverlays, menuOpen } from './session';
import { wireWorldDevhook, clearWorldDevhook } from '../dev/wireDevhook';
import {
  showExploreHud, disposeExploreHud, onApproach, onWayfind, onInteract, onBoardApproach,
  tryOpenBoard, onSitSpotApproach, tryPlayRoep, renderVehiclePrompt, renderHeliPrompt,
  setHeliCockpit, setHeliVignette, showBoundaryHint, showDriveHint,
} from '../hud/ExploreHud';

// Light world-EF seasoning: count in-world mission completions this session so the
// pure `pickWorldBeat` cadence (every Nth return) stays rare. `lastBeatTick` dedups
// the one beat per completion across the several `resumePatrol` hops in a cycle.
let patrolTick = 0;
let lastBeatTick = -1;

/** A mission was completed in the world: advance the world-EF beat cadence. */
export function notePatrolCompletion(): void {
  patrolTick++;
}

/**
 * Felt progress — the ONE completion event the world listens to. When a mission is
 * finished the flow tells the world `onMissionComplete(id, { fresh: true })` (play
 * the reunion at the marker now); when a world is built, it hears the same for
 * every mission already done with `fresh: false` (show the finished state, no beat),
 * so progress survives a reload. Optional: a world without the method ignores it.
 */
export function tellWorldMissionDone(missionId: string, fresh: boolean): Promise<void> {
  return session.world?.onMissionComplete(missionId, { fresh }) ?? Promise.resolve();
}

/* ---------------------------------------------------- the world holds still ---- */
// A mission (or the bird bench) freezes the live world for as long as it runs — not
// per step: between two steps and on the reward the ranger stays put, no marker tag
// or proximity prompt comes back, and the camera stays where the game left it.
let held = false;

/** Freeze the world for a mission (idempotent). */
export function holdWorld(): void {
  if (held || !session.world) return;
  held = true;
  session.world.beginActivity();
}

/** Let the world go again: free roam, the tags, the prompts (idempotent). */
export function releaseWorld(): void {
  if (!held) return;
  held = false;
  session.world?.endActivity();
}

/** WebGL support, probed once (the in-place 3D view needs it). */
let webgl: boolean | null = null;
function webglOk(): boolean {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { webgl = false; }
  }
  return webgl;
}

/** Boot entry (main.ts): unlock audio inside the Begin gesture, then load the world. */
export function startWorld(ui: HTMLElement, st: Stage): void {
  session.host = ui;
  session.stage = st;
  Sound.unlock();
  void loadGameAudio();
  startExplore();
}

/** The mission the game recommends next: the first unfinished one in story order.
 *  The wayfinding chip points at it and the missiebord marks it. Null when all done. */
export function nextMissionId(): string | null {
  return nextPatrolTarget(Content.activeArea().missies, store.get().voltooid);
}

/** The title the wayfinding chip shows (the recommended mission), or null. */
export function activeExploreTitel(): string | null {
  const id = nextMissionId();
  return Content.activeArea().missies.find((m) => m.id === id)?.titel ?? null;
}

/** Tear the world down (title screen, or a stopped mission's rebuild). */
export function leaveWorld(): void {
  held = false;
  disposeExploreHud();
  const { world, stage } = session;
  if (world) { world.dispose(); session.world = null; stage.exitWorld(); }
  clearWorldDevhook();
}

/* ----------------------------------------------------- 3D free-roam ---- */
export function startExplore(): void {
  const area = Content.activeArea();
  const markers: WorldMarker[] = area.missies.map((m) => {
    const ef = m.stappen[0]?.ef as Engine | undefined;
    // the animal the mission is about stands at its marker, at its real size: the
    // frisling (not a grown boar), the reekalf, the frog in the reeds
    const hero = heroOf(m.id, m.dier);
    const BIOMES = ['heide', 'bos', 'stuifzand', 'ven'] as const;
    const biome = (BIOMES as readonly string[]).includes(m.landschap)
      ? (m.landschap as typeof BIOMES[number]) : undefined;
    return {
      missionId: m.id,
      titel: m.titel,
      modelId: hero ? modelFor(hero) : null,
      height: heightFor(hero),
      color: (ef && SKILL_META[ef]?.kleur) || '#f5c23b',
      biome,
    };
  });

  // the active mission the wayfinding cue points to = the recommended next one
  const done = store.get().voltooid;
  const active = nextMissionId();

  // the season tints the ambience bed; take it from the story's current chapter so
  // the world matches the arc moment.
  const seizoen = Content.currentChapter(area.id, done)?.seizoen;
  const onBiome = (b: Biome) => setAmbientScene(b, seizoen);

  const { stage } = session;
  const world = new World(
    stage.renderer.domElement as HTMLCanvasElement, markers, onApproach, onWayfind, active,
    onBiome, onInteract,
  );
  session.world = world;
  // W4.5: hand the world the shared renderer so it can turn on the hero shadow map.
  world.setRenderer(stage.renderer);
  // W1.5: the rotating follow-cam reads the "Camera draait mee" setting live each frame.
  world.setCameraFollow(() => store.get().settings.cameraDraaitMee);
  // a menu card over the world (Pauze, the missiebord, a briefing ...) holds him still
  world.setMenuGate(menuOpen);
  // W2.2: the spawn case-board is the mission hub — walking up to it opens the
  // mission board overlay in-place (no leaveWorld).
  world.setBoard({ onNear: onBoardApproach, onOpen: tryOpenBoard });
  // F-11: the calm world-rim cue ("Hier stopt het bos") through the one hint channel.
  world.setBoundaryHint(showBoundaryHint);
  // W6.4b2: the "Ken je roep" sit-spot by the vogelkijkhut.
  world.setSitSpot({ onNear: onSitSpotApproach, onActivate: tryPlayRoep });
  // W5.1: the drivable jeep — "Stap in" near it, "Stap uit" while driving.
  world.setVehicle({
    onNear: () => renderVehiclePrompt(),
    onChange: (inVehicle) => { renderVehiclePrompt(); if (inVehicle) showDriveHint(); },
  });
  // W5.3b: the opt-in helicopter; the optIn source is read live (Instellingen toggle).
  world.setHeli({
    onNear: () => renderHeliPrompt(),
    onChange: (inHeli) => { renderHeliPrompt(); setHeliCockpit(inHeli); },
    onFrame: (v) => setHeliVignette(v),
    optIn: () => store.get().settings.helikopter,
  });
  // start the bed on the spawn clearing (heide) before the first crossing fires
  setAmbientScene('heide', seizoen);
  stage.enterWorld(world);
  for (const m of area.missies) if (done[m.id]) void tellWorldMissionDone(m.id, false);
  if (store.get().arc.gemeld) world.setSeasonResolved(true);
  setScreen('world');
  setMissionView(null);
  wireWorldDevhook(world);
  showExploreHud(area.missies.find((m) => m.id === active)?.titel ?? null);
}

/** Resume free-roam after an in-world mission or menu: keep the world loaded,
 *  re-point the wayfinding cue at the next thing to do and restore the explore HUD. */
export function resumePatrol(): void {
  const world = session.world;
  if (!world) { startExplore(); return; }
  releaseWorld();
  setScreen('world');
  setMissionView(null);
  const area = Content.activeArea();
  const next = nextMissionId();
  world.setActiveMission(next);
  const titel = area.missies.find((m) => m.id === next)?.titel ?? null;
  // Light world-EF seasoning (BUILD-PLAN §8b): once per completed patrol cycle,
  // on the rare cadence, dust a calm skippable micro-beat before resuming.
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
    `<button class="ra-text-btn wb-skip" type="button" data-key="back">Even verder lopen</button>` +
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
        btn.classList.add('wb-goed');
        if (store.get().settings.geluid) Sound.found();
        if (fb) { fb.hidden = false; fb.textContent = 'Goed onthouden, ranger!'; fb.className = 'wb-feedback wb-fb-goed'; }
        if (store.get().settings.voorlezen) narrator.speak('Goed onthouden, ranger!');
        el.querySelectorAll<HTMLButtonElement>('.wb-opt').forEach((b) => (b.disabled = true));
        window.setTimeout(finish, 900);
      } else {
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

/**
 * Play "Ken je roep" (roep3d) in-place at the sit-spot (W6.4b2): freeze the world,
 * play the beat into the live `WorldCtx`, then resume free-roam in-place. The world
 * is never torn down; reduced-motion is honoured inside `playRoep3d`.
 */
export async function playRoepAtSitSpot(): Promise<void> {
  const world = session.world;
  if (!world) return;
  Sound.unlock();
  void loadGameAudio();
  clearOverlays();
  // the 2D floor when the player asked for it (Tweaks "altijd 2D"), under reduced
  // motion, or without WebGL — the same rule the missions' steps follow
  const flat = store.get().settings.force2d || prefersReducedMotion() || !webglOk();
  setMissionView(flat ? '2d' : '3d');
  holdWorld();
  const host = document.createElement('div');
  host.className = 'mission-step';
  session.host.appendChild(host);
  try {
    if (flat) await playRoep(host);
    else await playRoep3d(world.ctx(host));
  } finally {
    clearActivityWin();
    host.remove();
    releaseWorld();
    setMissionView(null);
  }
  // the ranger is still at the bench → the HUD re-surfaces the sit-spot affordance
  showExploreHud(activeExploreTitel());
}
