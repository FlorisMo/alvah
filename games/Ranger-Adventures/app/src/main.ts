import './styles/tokens.css';
import './styles/base.css';
import { Stage } from './render3d/Stage';
import { Budgets } from './ui/Budgets';
import { applyReducedMotionClass, watchReducedMotion, setReducedMotionOverride } from './core/reduced-motion';
import { applyReadingPrefs } from './core/reading-prefs';
import { startLodge, startDeepDemo } from './ui/Missions';
import { startSandbox } from './ui/Sandbox';
import { showAvatarCreator } from './ui/AvatarCreator';
import { store } from './core/state';

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
const budgets = new Budgets(ui);
stage.onFrame((dt) => budgets.update(stage.renderer, dt));
stage.start();

// --- title card → the lodge (mission picker) ---
const card = document.createElement('div');
card.className = 'boot-card';
card.innerHTML =
  `<p class="boot-kicker">Ranger van de Veluwe</p>` +
  `<h1 class="boot-title">Word boswachter</h1>` +
  `<p class="boot-sub">Help de dieren van de Veluwe. Kies een missie en train je breinkracht.</p>` +
  `<button class="btn-start" type="button">Begin</button>`;
ui.appendChild(card);

// `?sandbox` jumps straight into the compact Demo Sandbox; `?demo` launches the
// Deep Demo guided tour (the Capstone review surface). Both are demo entries.
const params = new URLSearchParams(location.search);
const sandboxStart = params.has('sandbox');
const deepDemoStart = params.has('demo');

card.querySelector<HTMLButtonElement>('.btn-start')?.addEventListener('click', () => {
  card.classList.add('boot-card--hidden');
  window.setTimeout(() => card.remove(), 360);
  if (deepDemoStart) { startDeepDemo(ui, stage); return; }
  if (sandboxStart) { startSandbox(ui, stage, () => startLodge(ui, stage)); return; }
  // first boot → make your ranger; afterwards go straight to the lodge
  if (store.get().avatarGemaakt) startLodge(ui, stage);
  else showAvatarCreator(ui, () => startLodge(ui, stage));
});
