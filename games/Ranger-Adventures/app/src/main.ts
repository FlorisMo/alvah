import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { Stage } from './render3d/Stage';
import { Budgets } from './ui/Budgets';
import { applyReducedMotionClass, watchReducedMotion, setReducedMotionOverride } from './core/reduced-motion';
import { applyReadingPrefs } from './core/reading-prefs';
import { store } from './core/state';
import { installDevHook, setScreen, provideDrawCalls } from './core/devhook';
import { installKeys } from './ui/keys';
import { mountBootVeil } from './ui/BootVeil';

// Boot: the veil goes up at once, the renderer starts, and the world graph (World, the
// engines, the 3D mini-game views, render2d: the bulk of the bundle, W7.1 code-split) is
// loaded straight away and built behind the veil. The title IS that world (a shot of the
// spawn clearing, world/Presenter.ts), so there is no second scene to swap out; the veil
// lifts once the world is ready. The AudioContext is made behind the veil (bootWorld:
// its constructor is slow) and `Sound.unlock()` resumes it inside the Begin tap
// (WorldSession.showTitleCard), with `loadGameAudio()`: iOS lets sound out from a gesture.

// Apply the saved Tweaks before first paint: a persisted reduced-motion toggle
// wins over the OS (off = defer to OS), and the reading/accent prefs re-flow :root.
const saved = store.get().settings;
if (saved.reducedMotion) setReducedMotionOverride(true);
applyReadingPrefs(saved);
applyReducedMotionClass();
watchReducedMotion();

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;
const veil = mountBootVeil(ui);
// Enter/Space press the primary button, Esc goes back or opens Pauze (every screen).
installKeys(ui);

// --- the one renderer + frame loop ---
const stage = new Stage(canvas);
// `?dev=1` also exposes the stage (read-only use: `__stage.world` for probes and
// playtest scripts that project scene objects to screen coordinates).
if (new URLSearchParams(location.search).has('dev')) {
  (window as unknown as { __stage: unknown }).__stage = stage;
}

// The draw-call/fps overlay is a dev instrument, not player UI. Gate it on the
// `?dev=1` query param ONLY (WORLD-PLAN W0.5) — NOT `import.meta.env.DEV`: the
// E2E suite runs against the dev server, so a DEV gate would make the
// "overlay absent" assertion impossible. `drawCalls()` stays available to E2E
// through the dev hook (provideDrawCalls below) regardless of the overlay.
if (new URLSearchParams(location.search).has('dev')) {
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

// --- the world, built behind the veil, shown as the title ---
// The model list comes first, alongside the world's code: with it in hand every model the
// world build asks for starts downloading at once, during the build instead of after it.
void import('./render3d/Models').then((m) => m.loadManifest());
void import('./ui/Missions').then(({ bootWorld }) => bootWorld(ui, stage, veil));
