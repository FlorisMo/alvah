import './styles/tokens.css';
import './styles/base.css';
import { Stage } from './render3d/Stage';
import { Budgets } from './ui/Budgets';
import { applyReducedMotionClass, watchReducedMotion, setReducedMotionOverride } from './core/reduced-motion';
import { applyReadingPrefs } from './core/reading-prefs';
import { store } from './core/state';
import { Sound } from './core/sound';
import { installDevHook, setScreen, provideDrawCalls, provideAvatar } from './core/devhook';

// W7.1 code-splitting: the mission/world/demo graph (World, the five engines,
// the 3D mini-game views, render2d) is the bulk of the bundle but is only
// reachable AFTER "Begin". It is loaded via dynamic `import()` in the click
// handler below so the entry `app.js` stays a light boot shell (three.js lives
// in the `vendor` chunk, see vite.config.ts). `Sound.unlock()` is imported
// eagerly and fired synchronously in the gesture — the iOS AudioContext must be
// created/resumed inside the user tap, before any `await`.

// Apply the saved Tweaks before first paint: a persisted reduced-motion toggle
// wins over the OS (off = defer to OS), and the reading/accent prefs re-flow :root.
const saved = store.get().settings;
if (saved.reducedMotion) setReducedMotionOverride(true);
applyReadingPrefs(saved);
applyReducedMotionClass();
watchReducedMotion();

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;

// --- 3D render layer + live budget overlay (Phase 0) ---
const stage = new Stage(canvas);
// TEMP-PROBE (revert): expose the stage so a throwaway probe can traverse the
// world scene for the ranger rig. Dev-gated; removed before this box is done.
if (new URLSearchParams(location.search).has('dev')) {
  (window as unknown as { __stage: unknown }).__stage = stage;
}

// The draw-call/fps overlay is a dev instrument, not player UI. Gate it on the
// `?dev=1` query param ONLY (WORLD-PLAN W0.5) — NOT `import.meta.env.DEV`: the
// E2E suite runs against the dev server, so a DEV gate would make the
// "overlay absent" assertion impossible. `drawCalls()` stays available to E2E
// through the dev hook (provideDrawCalls below) regardless of the overlay.
const showBudgets = new URLSearchParams(location.search).has('dev');
if (showBudgets) {
  const budgets = new Budgets(ui);
  stage.onFrame((dt) => budgets.update(stage.renderer, dt));
}
stage.start();

// Dev-state hook for the browser-proof E2E suite (WORLD-PLAN §3.1). Gated
// behind DEV or ?dev=1; draw calls are the same-frame sample captured right
// after each render (F-18 — a stable count, not an arbitrarily-timed poll).
installDevHook();
setScreen('title');
provideDrawCalls(() => stage.drawCalls);
// P1.4: the title now stands the GROUNDED ranger on the heath — expose his
// measured height to the scale assert so the title frame proves avatar.height ∈
// [1.5, 2.0], same as the world. `startWorld` overrides this with the live world
// ranger on "Begin"; null until the title rig finishes loading.
provideAvatar(() => stage.titleAvatar());

// --- title card → the lodge (mission picker) ---
const card = document.createElement('div');
card.className = 'boot-card';
card.innerHTML =
  `<p class="boot-kicker">Ranger van de Veluwe</p>` +
  `<h1 class="boot-title">Word boswachter</h1>` +
  `<p class="boot-sub">Help de dieren van de Veluwe.<br>Kies een missie en train je breinkracht.</p>` +
  `<button class="btn-start" type="button">Begin</button>`;
ui.appendChild(card);

// `?sandbox` jumps straight into the compact Demo Sandbox; `?demo` launches the
// Deep Demo guided tour (the Capstone review surface). Both are demo entries.
const params = new URLSearchParams(location.search);
const sandboxStart = params.has('sandbox');
const deepDemoStart = params.has('demo');

card.querySelector<HTMLButtonElement>('.btn-start')?.addEventListener('click', async () => {
  // Unlock audio FIRST, synchronously in the tap (iOS gesture rule) — before
  // the awaited dynamic import breaks the user-activation chain.
  Sound.unlock();
  card.classList.add('boot-card--hidden');
  window.setTimeout(() => card.remove(), 360);
  if (deepDemoStart) {
    const { startDeepDemo } = await import('./ui/Missions');
    startDeepDemo(ui, stage);
    return;
  }
  if (sandboxStart) {
    const [{ startSandbox }, { startLodge }] = await Promise.all([
      import('./ui/Sandbox'),
      import('./ui/Missions'),
    ]);
    startSandbox(ui, stage, () => startLodge(ui, stage));
    return;
  }
  // W2.1: the walkable world is now the front door. First boot still makes your
  // ranger first; afterwards (and on every later boot) drop STRAIGHT into the
  // Veluwe. The lodge stays reachable from the explore HUD's "Terug naar de hut"
  // pill until the in-world cabin hub (W2.2/W2.4) replaces it.
  if (store.get().avatarGemaakt) {
    const { startWorld } = await import('./ui/Missions');
    startWorld(ui, stage);
  } else {
    const [{ showAvatarCreator }, { startWorld }] = await Promise.all([
      import('./ui/AvatarCreator'),
      import('./ui/Missions'),
    ]);
    showAvatarCreator(ui, () => startWorld(ui, stage));
  }
});
