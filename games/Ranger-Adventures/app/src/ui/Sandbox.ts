/**
 * Sandbox.ts (ui) — mounts the compact Demo Sandbox (render3d/SandboxScene) on the
 * shared Stage and overlays the instant jump-menu (DEMO-SANDBOX.md Tier 2; ledger 75b).
 *
 * The jump-menu is the §9g demo-skip entry point: every cast member + every
 * interaction in one flat, scrollable list of ≥56px, dual-channel (colour pip +
 * word) buttons. A cast/ranger target §1e-reframes the camera onto it (and plays its
 * call); an EF target launches the live diegetic engine in-place (75b-ii); a meta
 * target opens its live screen (75c — companion · prikbord · avatar · badge ·
 * wist-je-dat · arc-resolve). The same routing backs the in-world post taps.
 */

import './sandbox.css';
import type { Stage } from '../render3d/Stage';
import { SandboxScene } from '../render3d/SandboxScene';
import { Sound } from '../core/sound';
import { loadGameAudio } from '../core/calls';
import type { SandboxLayout, SandboxKind } from '../render3d/Sandbox';
import type { Engine, BeatSummary } from '../core/skill';
import type { Step } from '../content/types';
import { Content } from '../content/registry';
import { prefersReducedMotion } from '../core/reduced-motion';
import { resolveViewMode, variantFor } from '../render3d/play/ViewMode';
import { REGISTRY_3D } from '../render3d/play/registry';
import { playZoeken } from '../render2d/ZoekenView';
import { playRoute } from '../render2d/RouteView';
import { playSimon } from '../render2d/SimonView';
import { playDanger } from '../render2d/DangerView';
import { playWissel } from '../render2d/WisselView';
import { showMetaDemo } from './Missions';

/** The 2D floor view per EF engine — served under reduced-motion / no-WebGL, exactly
 *  like Missions.runMission's else branch (the always-available render-agnostic floor). */
const PLAY_2D: Record<string, (host: HTMLElement, step: Step) => Promise<BeatSummary>> = {
  zoeken: playZoeken, corsi: playRoute, simon: playSimon, dagnacht: playDanger, wisselen: playWissel,
};

/** WebGL support, probed once — gates the in-place 3D activity (else the 2D floor),
 *  matching Missions. The sandbox only renders because the Stage renderer is live, so
 *  this is true here; the probe keeps the no-WebGL → 2D-floor contract honest anyway. */
const WEBGL_OK: boolean = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

/** A representative Step for an engine — the first step that drives it in the live
 *  content, so the sandbox plays the REAL trial (skin/copy/feit), not a stub. */
function stepFor(engine: Engine): Step | null {
  for (const m of Content.activeArea().missies) {
    const s = m.stappen.find((st) => st.ef === engine);
    if (s) return s;
  }
  return null;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const KIND_COLOR: Record<string, string> = {
  ranger: '#6b8e5a', ef: '#f5c23b', meta: '#7a9bd1', cast: '#cdb892',
};
const KIND_LABEL: Record<string, string> = {
  ranger: 'Ranger', ef: 'Speel mee', meta: 'Meer', cast: 'Dieren',
};

/** Open the Demo Sandbox over the Stage. `onExit` returns to wherever it was opened. */
export function startSandbox(ui: HTMLElement, stage: Stage, onExit: () => void): void {
  Sound.unlock();
  void loadGameAudio();

  const scene = new SandboxScene(
    stage.renderer.domElement as HTMLCanvasElement,
    'ranger-alvah',
    (layout) => buildMenu(layout),
    (id, kind) => onTrigger(id, kind),
  );
  stage.enterWorld(scene);

  const root = document.createElement('div');
  root.className = 'sbx';
  root.innerHTML =
    `<div class="sbx-bar">` +
    `<span class="sbx-title">Demo · de hele Veluwe in het klein</span>` +
    `<button class="sbx-jump-toggle" type="button" aria-expanded="false">Spring naar…</button>` +
    `<button class="sbx-exit" type="button">Terug</button>` +
    `</div>` +
    `<div class="sbx-menu" hidden></div>` +
    `<p class="sbx-hint">Tik een dier om in te zoomen en het te horen · of kies “Spring naar…”.</p>`;
  ui.appendChild(root);

  const menu = root.querySelector<HTMLDivElement>('.sbx-menu')!;
  const toggle = root.querySelector<HTMLButtonElement>('.sbx-jump-toggle')!;
  toggle.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', String(open));
  });
  root.querySelector('.sbx-exit')?.addEventListener('click', () => {
    stage.exitWorld();
    scene.dispose();
    root.remove();
    onExit();
  });

  /** Hide the showroom chrome while an in-place activity owns the screen (its own
   *  accessible card + canvas), restore it after. The activity card mounts on `ui`. */
  function showChrome(on: boolean): void {
    root.hidden = !on;
    if (!on) { menu.setAttribute('hidden', ''); toggle.setAttribute('aria-expanded', 'false'); }
  }

  /** A post was tapped in-world: an EF post drives the live diegetic engine; a meta
   *  post opens its live screen (demo-skip, no briefings/grind). */
  function onTrigger(id: string, kind: SandboxKind): void {
    if (kind === 'ef') void launchEf(id as Engine);
    else launchMeta(id);
  }

  /** Open one live meta screen over the sandbox (companion · prikbord · avatar ·
   *  badge · wist-je-dat · arc-resolve), reusing `Missions.showMetaDemo`. The scene
   *  is frozen (begin/endActivity) so the still-rendering canvas behind the overlay
   *  takes no free-roam taps (`.ra-overlay` is pointer-transparent), and the showroom
   *  chrome hides while the accessible card owns the screen. */
  function launchMeta(id: string): void {
    showChrome(false);
    scene.beginActivity();
    showMetaDemo(ui, id, backFromMeta);
  }

  /** Close a meta screen: drop its overlay, §1e-glide the camera back to the overview,
   *  and restore the showroom chrome. */
  function backFromMeta(): void {
    ui.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
    scene.endActivity();
    showChrome(true);
  }

  /** Play one EF activity in the sandbox, reusing the exact §1f branch the mission
   *  runner uses: a parity-green 3D variant in-place via a sandbox `WorldCtx`, else
   *  the 2D floor (reduced-motion / no-WebGL). The world stays loaded throughout. */
  async function launchEf(engine: Engine): Promise<void> {
    const step = stepFor(engine);
    if (!step) return;
    const mode = resolveViewMode({
      engine,
      sceneLive: true,
      webglCapable: WEBGL_OK,
      reducedMotion: prefersReducedMotion(),
      force2d: false,
      registry: REGISTRY_3D,
    });
    showChrome(false);
    try {
      if (mode === '3d') {
        const variant = variantFor(REGISTRY_3D, engine)!;
        scene.beginActivity();
        try { await variant.play(scene.ctx(ui, engine), step); }
        finally { scene.endActivity(); }
      } else {
        await PLAY_2D[engine](ui, step); // the always-available 2D floor over the scene
      }
    } finally {
      showChrome(true);
    }
  }

  function buildMenu(layout: SandboxLayout): void {
    // group the flat jump-target list by kind so the demo-skip menu reads in sections.
    const order = ['ranger', 'ef', 'meta', 'cast'] as const;
    const groups = new Map<string, { id: string; label: string; kind: string }[]>();
    for (const t of layout.jumpTargets) {
      const arr = groups.get(t.kind) ?? [];
      arr.push({ id: t.id, label: t.label, kind: t.kind });
      groups.set(t.kind, arr);
    }
    menu.innerHTML = order
      .filter((k) => groups.has(k))
      .map((k) => {
        const items = groups.get(k)!
          .map((it) =>
            `<button class="sbx-jump" type="button" data-id="${esc(it.id)}" data-kind="${esc(it.kind)}" ` +
            `style="--pip:${KIND_COLOR[it.kind] ?? '#cdb892'}">` +
            `<span class="sbx-pip" aria-hidden="true"></span>` +
            `<span class="sbx-jump-label">${esc(it.label)}</span></button>`)
          .join('');
        return `<div class="sbx-group"><p class="sbx-group-head">${esc(KIND_LABEL[k] ?? k)}</p>` +
          `<div class="sbx-jump-grid">${items}</div></div>`;
      })
      .join('');

    menu.querySelectorAll<HTMLButtonElement>('.sbx-jump').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.id!;
        const kind = b.dataset.kind as SandboxKind;
        menu.querySelectorAll('.sbx-jump').forEach((x) => x.removeAttribute('aria-current'));
        b.setAttribute('aria-current', 'true');
        // an EF post launches the live diegetic activity, a meta post opens its live
        // screen (both the §9g demo-skip path); a cast/ranger target frames the camera.
        if (kind === 'ef') void launchEf(id as Engine);
        else if (kind === 'meta') launchMeta(id);
        else scene.jumpTo(id);
      });
    });
  }
}
