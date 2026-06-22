import './styles/tokens.css';
import './styles/base.css';
import { Stage } from './render3d/Stage';
import { Budgets } from './ui/Budgets';
import { applyReducedMotionClass, watchReducedMotion } from './core/reduced-motion';
import { store } from './core/state';
import { Content } from './content/registry';
import { playZoeken } from './render2d/ZoekenView';
import { playRoute } from './render2d/RouteView';
import type { Step } from './content/types';
import { SKILL_META, type BeatSummary, type Engine } from './core/skill';

applyReducedMotionClass();
watchReducedMotion();

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;

// --- 3D render layer + live budget overlay (Phase 0) ---
const stage = new Stage(canvas);
const budgets = new Budgets(ui);
stage.onFrame((dt) => budgets.update(stage.renderer, dt));
stage.start();

// --- engine → 2D view dispatch (grows as engines are ported) ---
type PlayFn = (host: HTMLElement, step: Step) => Promise<BeatSummary>;
const ENGINE_VIEWS: Partial<Record<string, PlayFn>> = {
  zoeken: playZoeken,
  corsi: playRoute,
};

// --- boot / title card ---
const card = document.createElement('div');
card.className = 'boot-card';
card.innerHTML =
  `<p class="boot-kicker">Fase 1 · speel de missie</p>` +
  `<h1 class="boot-title">Ranger van de Veluwe</h1>` +
  `<p class="boot-sub">De verdwaalde frisling. Zoek hem, en onthoud de weg naar de groep.</p>` +
  `<button class="btn-start" type="button">Start de missie</button>`;
ui.appendChild(card);

card.querySelector<HTMLButtonElement>('.btn-start')?.addEventListener('click', () => {
  card.classList.add('boot-card--hidden');
  window.setTimeout(() => card.remove(), 360);
  void playMission('veluwe', 'frisling');
});

/** Play a mission step-by-step through whatever engines are ported; persist each beat. */
async function playMission(areaId: string, missieId: string): Promise<void> {
  const mission = Content.mission(areaId, missieId);
  if (!mission) return;
  const played: Engine[] = [];
  let stopped: string | null = null;
  for (const step of mission.stappen) {
    const play = ENGINE_VIEWS[step.ef];
    if (!play) {
      stopped = step.ef;
      break;
    }
    const result = await play(ui, step);
    store.logSession(step.ef, result); // updates skill + persists
    played.push(step.ef);
  }
  showResult(mission.titel, played, stopped);
}

function showResult(titel: string, played: Engine[], stopped: string | null): void {
  const skill = store.get().skill;
  const lines = played.map((e) => `${SKILL_META[e].naam}: niveau ${skill[e].level.toFixed(1)}`).join(' · ');
  const meer = stopped
    ? `<p class="boot-sub">De volgende stap (${esc(stopped)}) bouw ik hierna.</p>`
    : '';
  const result = document.createElement('div');
  result.className = 'boot-card';
  result.innerHTML =
    `<p class="boot-kicker">Missie · ${esc(titel)}</p>` +
    `<h1 class="boot-title">Knap gedaan!</h1>` +
    `<p class="boot-sub">${esc(lines)}</p>` +
    meer +
    `<button class="btn-start" type="button">Nog een keer</button>`;
  ui.appendChild(result);
  result.querySelector<HTMLButtonElement>('.btn-start')?.addEventListener('click', () => {
    result.remove();
    void playMission('veluwe', 'frisling');
  });
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}
