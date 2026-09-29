/**
 * WorldSession.ts — the one world's life cycle. It is built ONCE, at boot, behind the
 * veil (`bootWorld`), and shown as the title (world/Presenter.ts: the title and the
 * ranger maker are shots of the real spawn clearing). Begin glides into the maker (a
 * first-time player) or straight into play (`enterPlay`); Pauze → "Naar het hoofdmenu"
 * glides back up to the title (`returnToTitle`). The world is never torn down.
 * Also here: coming back from a mission or a menu (`resumePatrol`) and the two
 * in-world beats that are not missions: the calm world-EF micro-beat between missions
 * and "Ken je roep" at the bird bench.
 */

import type { Engine } from '../../core/skill';
import { SKILL_META } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { loadGameAudio, setAmbientScene } from '../../core/calls';
import { SAY, TITLE } from '../../content/screens';
import type { Biome } from '../../render3d/Biomes';
import type { Stage } from '../../render3d/Stage';
import { World, type WorldMarker } from '../../render3d/World';
import { playRoep3d } from '../../render3d/engines/roep3d';
import { playRoep } from '../../render2d/RoepView';
import { prefersReducedMotion } from '../../core/reduced-motion';
import { clearActivityWin, clearPlayHint, beginActivityScope, abortActivityScope } from '../../render3d/play/kit';
import { modelFor, heightFor } from '../../render3d/play/spawn';
import { heroOf } from '../../render3d/world/Progress';
import { nextPatrolTarget } from '../../core/patrol';
import { Vector3 } from 'three';
import {
  pickWorldBeat, optionCorrect, coarseHeading, withAnimal, beatReady, WORLDBEAT_ANIMAL_M, type WorldBeat,
} from '../../core/worldbeat';
import { setScreen, setMissionView, provideTitleReady } from '../../core/devhook';
import { mountReadAloud, readScreenAloud } from '../ReadAloud';
import { showAvatarCreator } from '../AvatarCreator';
import { mountMissionPause, unmountMissionPause } from './MissionFlow';
import { session, esc, card, plainCard, clearOverlays, menuOpen, fadeCut } from './session';
import { wireWorldDevhook } from '../dev/wireDevhook';
import {
  showExploreHud, disposeExploreHud, onApproach, onWayfind, onInteract, onBoardApproach,
  tryOpenBoard, onSitSpotApproach, tryPlayRoep, renderVehiclePrompt, renderHeliPrompt,
  setHeliCockpit, setHeliVignette, showBoundaryHint, showDriveHint, beginGuide,
} from '../hud/ExploreHud';
import { armMissiebordBeat } from '../hud/Lessons';

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

/* -------------------------------------------------------- the one world ---- */
// the season tints the ambience bed; taken from the story's current chapter at boot
let seizoen: string | undefined;

/**
 * Boot (main.ts): build the world behind the veil and show it as the title. The veil
 * lifts once the world is ready (every model it asked for has arrived, or a cap), so the
 * first thing a player sees is the finished clearing, never a stand-in.
 */
export function bootWorld(ui: HTMLElement, st: Stage, veil: { lift: () => void }): void {
  session.host = ui;
  session.stage = st;
  const world = buildWorld();
  world.present('title');
  setScreen('title');
  setMissionView(null);
  let titleUp = false;
  provideTitleReady(() => titleUp && world.ready());
  const wait = (): void => {
    if (!world.ready()) { requestAnimationFrame(wait); return; }
    showTitleCard({ afterVeil: true });
    veil.lift();
    titleUp = true;
  };
  wait();
}

/** The world, built once: the markers, the callbacks the HUD listens on, the finished
 *  missions' lasting tableaus, handed to the Stage. */
function buildWorld(): World {
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
  seizoen = Content.currentChapter(area.id, done)?.seizoen;
  const onBiome = (b: Biome) => setAmbientScene(b, seizoen);

  const { stage } = session;
  const world = new World(
    stage.renderer.domElement as HTMLCanvasElement, markers, onApproach, onWayfind, nextMissionId(),
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
  // mission board overlay in-place.
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
  stage.enterWorld(world);
  for (const m of area.missies) if (done[m.id]) void tellWorldMissionDone(m.id, false);
  if (store.get().arc.gemeld) world.setSeasonResolved(true);
  wireWorldDevhook(world);
  return world;
}

/**
 * The title block over the sky of the real clearing: the name, one line of story, 🔊
 * and Begin (a click or Enter). Begin unlocks the sound inside the gesture (iOS), then
 * glides down to the ranger: into the maker the first time, straight into play after.
 */
function showTitleCard(opts: { after?: number; afterVeil?: boolean } = {}): void {
  const el = plainCard(
    `<div class="title-block">` +
    `<h1 class="title-mark">${esc(TITLE.naam)}</h1>` +
    `<p class="title-sub">${esc(TITLE.sub)}</p>` +
    `<div class="ra-row title-row"><button class="btn-start title-begin" type="button">${esc(TITLE.begin)}</button></div>` +
    `</div>`,
  );
  el.classList.add('title-overlay');
  if (opts.afterVeil) el.classList.add('title-overlay--after-veil'); // the veil's name stays
  // back from Pauze the camera is still rising to the title: the words wait for the sky
  if (opts.after) {
    el.querySelectorAll<HTMLElement>('.title-block > *').forEach((w, i) => w.style.setProperty('animation-delay', `${(opts.after ?? 0) + i * 160}ms`));
  }
  const ra = readScreenAloud(el, { text: SAY.title, autoStart: store.get().settings.voorlezen }); // child:B12
  el.querySelector('.title-begin')?.addEventListener('click', () => {
    // iOS: the AudioContext must be made inside the tap, before anything awaits
    Sound.unlock();
    void loadGameAudio();
    ra.stop();
    el.className = 'title-overlay title-overlay--leaving'; // not a menu any more: the glide starts at once
    el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    window.setTimeout(() => el.remove(), prefersReducedMotion() ? 0 : 320);
    if (store.get().avatarGemaakt) enterPlay(true);
    else showAvatarCreator(session.host, session.world!, () => enterPlay(false));
  }, { once: true });
}

/** From the title or the maker into play: the follow camera takes the lens over from the
 *  shot in one move, the ranger turns to the forest, the HUD and the sound come in. The
 *  player can walk at once. Then the first minute: Bram greets a new boswachter (or
 *  welcomes a `returning` one back) and the lessons follow (ui/hud/Lessons.ts). */
export function enterPlay(returning: boolean): void {
  const world = session.world;
  if (!world) return;
  world.present(null);
  setAmbientScene('heide', seizoen);
  setScreen('world');
  setMissionView(null);
  showExploreHud(activeExploreTitel());
  // the HUD comes in as the glide settles, not over the moving picture; then the class
  // goes, or every prompt that appears later (a slot shown again restarts its animation)
  // would wait a second and fade in behind the ring he already stands in
  const hud = session.host.querySelector('.explore-hud');
  hud?.classList.add('explore-hud--arriving');
  window.setTimeout(() => hud?.classList.remove('explore-hud--arriving'), 1_700);
  beginGuide(returning);
}

/**
 * Pauze → "Naar het hoofdmenu": a soft fade, the ranger back on the spawn clearing (out
 * of any vehicle), the camera rising from behind him to the title, the title block back.
 * The same world, never rebuilt; Begin glides back in.
 */
export function returnToTitle(): void {
  const world = session.world;
  if (!world) return;
  narrator.stop();
  held = false;
  disarmBeat();
  fadeCut(() => {
    clearOverlays();
    disposeExploreHud();
    world.resetToSpawn();
    world.present('title', false);
    setScreen('title');
    setMissionView(null);
  }, () => showTitleCard({ after: prefersReducedMotion() ? 0 : 900 }));
}

/** Resume free-roam after an in-world mission or menu: keep the world loaded,
 *  re-point the wayfinding cue at the next thing to do and restore the explore HUD. */
export function resumePatrol(): void {
  const world = session.world;
  if (!world) return;
  releaseWorld();
  setScreen('world');
  setMissionView(null);
  const area = Content.activeArea();
  const next = nextMissionId();
  world.setActiveMission(next);
  const titel = area.missies.find((m) => m.id === next)?.titel ?? null;
  // Light world-EF seasoning (BUILD-PLAN §8b): once per completed patrol cycle, on the
  // rare cadence, a calm skippable micro-beat — armed here, shown only once he has
  // walked on (never stacked on the reward cards: child B14).
  if (patrolTick !== lastBeatTick && pickWorldBeat({ patrolTick, heading: 'rechtdoor' })) {
    lastBeatTick = patrolTick;
    armBeat(patrolTick);
  }
  showExploreHud(titel);
  // back from a finished mission: Bram points at the missiebord (once, after the first)
  if (patrolTick > 0) armMissiebordBeat();
}

/* ------------------------------------------------ the armed world-EF beat ---- */
// The beat waits for a free-roam walk of WORLDBEAT_WALK_M (on foot, no menu, no mission),
// and the impulse beat for a roaming animal close by and in view: it names THAT animal.
let beatTick: number | null = null;
let beatWalked = 0;
let beatLast: { x: number; z: number } | null = null;
let beatRaf = 0;

function armBeat(tick: number): void {
  beatTick = tick;
  beatWalked = 0;
  beatLast = null;
  if (!beatRaf) beatRaf = requestAnimationFrame(watchBeat);
}

function disarmBeat(): void {
  beatTick = null;
  if (beatRaf) { cancelAnimationFrame(beatRaf); beatRaf = 0; }
}

/** A roaming ground animal close by and in the picture: its name ("vos"), or null. */
function animalInView(world: World): string | null {
  const p = world.pos();
  if (!p) return null;
  const cam = world.camera;
  for (const a of world.ambientState()) {
    // close enough to SEE: a roe deer across the heath, a squirrel only a few metres off
    // (about 36 px tall on a 1280×800 screen at the fixed 55° lens: h × 21 m)
    const reach = Math.min(WORLDBEAT_ANIMAL_M, a.h * 21);
    if (a.id.startsWith('bird-') || Math.hypot(a.x - p.x, a.z - p.z) > reach) continue;
    const v = new Vector3(a.x, cam.position.y - 2, a.z).project(cam);
    // in the picture, and above the low beat card that will name it
    if (v.z < 1 && Math.abs(v.x) < 0.85 && v.y > -0.3 && v.y < 0.9) return a.id.split('-')[1] ?? null; // animal-vos-fox → vos
  }
  return null;
}

function watchBeat(): void {
  beatRaf = 0;
  const world = session.world;
  if (!world || beatTick === null) return;
  const onFoot = !world.vehicleState()?.inVehicle && !world.heliState()?.inHeli;
  const free = onFoot && !held && !menuOpen() && !!session.host.querySelector('.explore-hud');
  const p = world.pos();
  if (free && p) {
    if (beatLast) beatWalked += Math.hypot(p.x - beatLast.x, p.z - beatLast.z);
    beatLast = p;
    // decided now, from where he stands: the way to the next mission, the animal in view
    const beat = pickWorldBeat({ patrolTick: beatTick, heading: coarseHeading(world.headingTo(nextMissionId())) });
    const animal = beat?.kind === 'blijf-op-pad' ? animalInView(world) : null;
    if (beat && beatReady(beat, beatWalked, !!animal)) {
      beatTick = null;
      showWorldBeat(animal ? withAnimal(beat, animal) : beat, () => showExploreHud(activeExploreTitel()));
      return;
    }
  } else beatLast = null; // riding, a menu, a mission: those metres do not count
  beatRaf = requestAnimationFrame(watchBeat);
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
  // low on the screen and without a scrim: the animal the impulse beat names is in view
  const el = card(
    `<div class="worldbeat boot-card-ish${beat.kind === 'blijf-op-pad' ? ' wb-low' : ''}">` +
    `<p class="boot-kicker">${kicker}</p>` +
    `<p class="wb-prompt"></p>` +
    `<div class="wb-opts">${opts}</div>` +
    `<p class="wb-feedback" role="status" aria-live="polite" hidden></p>` +
    `<button class="ra-text-btn wb-skip" type="button" data-key="back">Even verder lopen</button>` +
    `</div>`,
    { scrim: beat.kind !== 'blijf-op-pad' },
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
        const goed = beat.kind === 'blijf-op-pad' ? 'Knap, je blijft rustig.' : 'Goed onthouden, ranger!';
        if (fb) { fb.hidden = false; fb.textContent = goed; fb.className = 'wb-feedback wb-fb-goed'; }
        if (store.get().settings.voorlezen) narrator.speak(goed);
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
  // the bench is never a one-way door (breaker B5): the mission's Pauze chip, with a
  // calm "Stop met luisteren" that aborts the game's scope, and Esc opens it
  beginActivityScope();
  let stop: () => void = () => {};
  const stopped = new Promise<'STOP'>((res) => { stop = () => res('STOP'); });
  mountMissionPause(() => { narrator.stop(); abortActivityScope(); unmountMissionPause(); stop(); }, 'Stop met luisteren');
  try {
    await Promise.race([flat ? playRoep(host) : playRoep3d(world.ctx(host)), stopped]);
  } finally {
    unmountMissionPause();
    clearActivityWin();
    clearPlayHint();
    host.remove();
    releaseWorld();
    setMissionView(null);
  }
  // the ranger is still at the bench → the HUD re-surfaces the sit-spot affordance
  showExploreHud(activeExploreTitel());
}
