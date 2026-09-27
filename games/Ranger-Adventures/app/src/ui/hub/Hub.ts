/**
 * Hub.ts — the menus over the live world: the Pauze hub, the missiebord (pick a
 * mission; the board you walk up to at spawn), the sporenboek (your book of clues
 * and collected veldnotities, and the hopeful resolution; opened from Pauze — it is
 * NOT a board in the world, so it has a different name), the badge wall, and the
 * way back to the title screen.
 * None of them tear the world down: the THREE scene stays live behind the card.
 */

import type { Engine } from '../../core/skill';
import { SKILL_META, tierFor, badgeProgress } from '../../core/skill';
import { store } from '../../core/state';
import { Content } from '../../content/registry';
import { narrator } from '../../core/narrator';
import { Sound } from '../../core/sound';
import { loadGameAudio } from '../../core/calls';
import { setScreen, setMissionView } from '../../core/devhook';
import { mountReadAloud } from '../ReadAloud';
import { missionIcon } from '../MissionIcon';
import { showCabin } from '../Companion';
import { showTweaks } from '../Tweaks';
import { session, esc, card, plainCard } from '../flow/session';
import { goToMission, unmountMissionPause } from '../flow/MissionFlow';
import { startExplore, leaveWorld, resumePatrol, activeExploreTitel, nextMissionId } from '../flow/WorldSession';
import { showExploreHud } from '../hud/ExploreHud';

/* ---------------------------------------------------------------- title ---- */
/**
 * F-27: the pause hub's "Naar het hoofdmenu" lands here — the one exit back to the
 * title screen. It mirrors `main.ts`'s boot card, but as an in-app screen swap (no
 * page reload). Progress is write-through in `state.ts`, so "Begin" drops the
 * returning player straight back into the world.
 */
export function showTitle(): void {
  narrator.stop();
  unmountMissionPause();
  leaveWorld();
  setScreen('title');
  setMissionView(null);
  const el = plainCard(
    `<div class="boot-card-ish ra-title-card">` +
    `<p class="boot-kicker">Ranger van de Veluwe</p>` +
    `<h1 class="boot-title">Word boswachter</h1>` +
    `<p class="boot-sub">Help de dieren van de Veluwe.<br>Kies een missie en train je breinkracht.</p>` +
    `<button class="btn-start ra-title-begin" type="button">Begin</button>` +
    `</div>`,
  );
  el.querySelector('.ra-title-begin')?.addEventListener('click', () => {
    Sound.unlock();
    void loadGameAudio();
    // D3.17: tell the stage we are leaving so a title re-dress bails cleanly.
    session.stage.markLeavingTitle();
    startExplore();
  });
}

/* ------------------------------------------------------------ pause hub ---- */
/** The raaf link reflects the companion: rescue prompt → friend's name. */
function cabinLabel(): string {
  const c = store.get().companion;
  if (!c.rescued) return 'Vang je raaf op';
  return `Verzorg ${c.naam || 'je raaf'}`;
}

/** Found/total clue count shown on the prikbord link. */
function cluesBadge(): string {
  const area = Content.activeArea();
  const found = Content.cluesFound(area.id, store.get().voltooid).size;
  const total = Content.clues(area.id).length;
  if (!total) return '';
  return ` <span class="lodge-clue-count">${found}/${total}</span>`;
}

/**
 * The in-world pause / hub shell (W2.4a/b): prikbord + raaf + badges +
 * instellingen + hoofdmenu, over the LIVE world. Instellingen + badges hand their
 * "terug" back to this hub; the prikbord + raaf return to the open plek.
 */
export function showPauseHub(): void {
  narrator.stop();
  const toWorld = (): void => showExploreHud(activeExploreTitel());
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Pauze</p>` +
    `<h1 class="boot-title">Wat wil je doen?</h1>` +
    `<div class="lodge-links">` +
    `<button class="ra-chip ph-prikbord" type="button"><span class="ra-chip-ic" aria-hidden="true">📓</span>` +
    `<span class="ra-chip-tx">Open je sporenboek${cluesBadge()}</span></button>` +
    `<button class="ra-chip ph-companion" type="button"><span class="ra-chip-ic" aria-hidden="true">🐦‍⬛</span>` +
    `<span class="ra-chip-tx">${esc(cabinLabel())}</span></button>` +
    `<button class="ra-chip ph-badges" type="button"><span class="ra-chip-ic" aria-hidden="true">🏅</span>` +
    `<span class="ra-chip-tx">Bekijk je breinkracht-badges</span></button>` +
    `<button class="ra-chip ph-tweaks" type="button"><span class="ra-chip-ic" aria-hidden="true">⚙️</span>` +
    `<span class="ra-chip-tx">Instellingen</span></button>` +
    `<button class="ra-chip ph-hoofdmenu" type="button"><span class="ra-chip-ic" aria-hidden="true">🏠</span>` +
    `<span class="ra-chip-tx">Naar het hoofdmenu</span></button>` +
    `</div>` +
    `<button class="btn-start ph-back" type="button" data-key="back">Terug naar de open plek</button>` +
    `</div>`,
  );
  el.querySelector('.ph-prikbord')?.addEventListener('click', () => showCaseBoard());
  el.querySelector('.ph-companion')?.addEventListener('click', () =>
    showCabin(session.host, toWorld, 'Terug naar de open plek'));
  el.querySelector('.ph-badges')?.addEventListener('click', () => showBadges(showPauseHub));
  el.querySelector('.ph-tweaks')?.addEventListener('click', () => showTweaks(session.host, showPauseHub));
  el.querySelector('.ph-hoofdmenu')?.addEventListener('click', () => showTitle());
  el.querySelector('.ph-back')?.addEventListener('click', toWorld);
}

/* -------------------------------------------------------- missiebord ---- */
/**
 * The in-world mission board (W2.2): the spawn board opens a mission-pick overlay
 * WITHOUT tearing the world down. Picking a mission launches it in-place; the back
 * chip returns to the explore HUD.
 */
export function showMissionBoard(): void {
  narrator.stop();
  const area = Content.activeArea();
  const done = store.get().voltooid;
  const next = nextMissionId();
  const cards = area.missies
    .map((m) => {
      const engines = Array.from(new Set(m.stappen.map((s) => SKILL_META[s.ef as Engine]?.naam ?? s.ef)));
      const klaar = done[m.id] ? `<span class="mc-done" aria-label="voltooid">✓</span>` : '';
      // the recommended mission: first unfinished in story order (the chip points at it too)
      const isNext = m.id === next;
      const nu = isNext ? `<span class="mc-next-tag">Nu doen</span>` : '';
      return (
        `<button class="mission-card${isNext ? ' mc-next' : ''}${done[m.id] ? ' mc-klaar' : ''}" type="button" data-id="${esc(m.id)}"${isNext ? ' data-key="primary"' : ''}>` +
        nu +
        missionIcon(m) +
        `<span class="mc-land">${esc(m.landschap)}</span>${klaar}` +
        `<span class="mc-title">${esc(m.titel)}</span>` +
        `<span class="mc-eng">${engines.map((e) => `<span class="mc-chip">${esc(e)}</span>`).join('')}</span>` +
        `</button>`
      );
    })
    .join('');

  const el = plainCard(
    `<div class="mission-board">` +
    `<p class="boot-kicker">Het missiebord · ${esc(area.naam)}</p>` +
    `<h1 class="boot-title">Kies een missie</h1>` +
    `<div class="mb-scroll"><div class="mission-grid">${cards}</div></div>` +
    `<button class="ra-chip mb-back" type="button" data-key="back">` +
    `<span class="ra-chip-ic" aria-hidden="true">‹</span>` +
    `<span class="ra-chip-tx">Terug naar de open plek</span></button>` +
    `</div>`,
  );
  el.querySelectorAll<HTMLButtonElement>('.mission-card').forEach((b) => {
    b.addEventListener('click', () => {
      Sound.unlock();
      void loadGameAudio();
      const m = area.missies.find((mm) => mm.id === b.dataset.id);
      if (m) goToMission(m); // played at its own marker (parent B6)
    });
  });
  el.querySelector('.mb-back')?.addEventListener('click', () => showExploreHud(activeExploreTitel()));
  el.querySelector('.mc-next')?.scrollIntoView({ block: 'nearest' });
}

/* ------------------------------------ sporenboek (clues; code: case-board) ---- */
/** Simple per-soort glyph (dual-channel: glyph + the found colour). */
export const CLUE_GLYPH: Record<string, string> = { spoor: '🐾', camera: '📷', band: '🛞' };

/** The sporenboek (was "prikbord"; the class names stay case-board / ph-prikbord):
 *  found clues, the collected veldnotities and (once all clues are found) the way
 *  to the hopeful resolution. Its back returns to patrol. */
export function showCaseBoard(back: () => void = resumePatrol): void {
  narrator.stop();
  // a hub card over the world, also when it follows a finished mission's clue: the dev
  // hook no longer says 'mission' / '3d' there (breaker note)
  setScreen('world');
  setMissionView(null);
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

  // W6.3b: the collected "Wist je dat"-veldnotities pinned to the board.
  const notities = Content.veldnotities(area.id);
  const collected = store.get().veldnotities;
  const gotN = notities.filter((n) => collected[n.id]);
  const veldStrip = notities.length
    ? `<div class="cb-veld">` +
      `<p class="cb-veld-head">Veldnotities · ${gotN.length}/${notities.length}</p>` +
      (gotN.length
        ? gotN
            .map((n, i) =>
              `<div class="cb-veld-note" data-i="${i}">` +
              (n.dier ? `<span class="cb-veld-dier">${esc(n.dier)}</span>` : '') +
              `<span class="cb-veld-text">${esc(n.tekst)}</span>` +
              `<button class="ra-speak cb-veld-speak" type="button" aria-label="Lees voor">🔊</button>` +
              `</div>`,
            )
            .join('')
        : `<p class="cb-note muted">Speel een missie in de wereld. Wist-je-datjes komen hier.</p>`) +
      `</div>`
    : '';

  const count = gemeld ? 'opgelost' : `${found.size}/${clues.length}`;
  const note = gemeld
    ? `<p class="cb-note ok">De stroper is gestopt. De heide en het ven groeien weer terug.</p>`
    : laatste
      ? `<p class="cb-note">${esc(laatste.tekst)}</p>`
      : `<p class="cb-note muted">Los missies op. Aanwijzingen komen hier.</p>`;
  // Enter always moves on (child B7): the pinned footer carries the primary. With every
  // clue found that is "Volg het spoor" (the way to the ontknoping), and walking on is
  // the quiet way back; otherwise "Verder op patrouille" itself is the primary.
  const resolve = allFound && !gemeld;
  const onLabel = back === resumePatrol ? 'Verder op patrouille' : 'Verder';
  const foot = resolve
    ? `<div class="ra-row cb-act"><button class="btn-start cb-resolve" type="button">Volg het spoor</button></div>` +
      `<button class="ra-text-btn cb-back" type="button" data-key="back">${onLabel}</button>`
    : `<div class="ra-row"><button class="btn-start cb-back" type="button" data-key="back">${onLabel}</button></div>`;

  const el = card(
    `<div class="case-board boot-card-ish has-foot">` +
    `<p class="boot-kicker">Je sporenboek · ${esc(chapter?.naam ?? '')} · ${count}</p>` +
    `<h1 class="boot-title">Wat is hier aan de hand?</h1>` +
    `<div class="card-body">` +
    `<div class="cb-cork">${board}</div>` +
    note +
    veldStrip +
    `</div>` +
    `<div class="card-foot">${foot}</div>` +
    `</div>`,
  );
  // Only the latest-clue note is read aloud (and karaoke-highlighted).
  const noteEl = !gemeld && laatste ? el.querySelector<HTMLElement>('.cb-note') : null;
  const ra = noteEl
    ? mountReadAloud({ textEl: noteEl, text: laatste!.tekst, autoStart: store.get().settings.voorlezen })
    : null;
  el.querySelector('.cb-back')?.addEventListener('click', () => {
    ra?.stop();
    back();
  });
  el.querySelector('.cb-resolve')?.addEventListener('click', () => {
    ra?.stop();
    Sound.unlock();
    showOntknoping(0, () => showCaseBoard(back));
  });
  // W6.3b: each collected veldnotitie reads aloud on demand.
  el.querySelectorAll<HTMLElement>('.cb-veld-note').forEach((row, i) => {
    row.querySelector('.cb-veld-speak')?.addEventListener('click', () => {
      ra?.stop();
      narrator.speak(gotN[i]?.tekst ?? '');
    });
  });
}

/** The hopeful resolution: step through the ontknoping beats, then report → resolved,
 *  and on to `done` (the sporenboek it was opened from, or the season finale). */
export function showOntknoping(idx: number, done: () => void): void {
  const area = Content.activeArea();
  const beats = Content.verhaalboog(area.id)?.ontknoping ?? [];
  const beat = beats[idx];
  if (!beat) { store.reportArc(); session.world?.setSeasonResolved(true); done(); return; }
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
    if (last) { store.reportArc(); session.world?.setSeasonResolved(true); if (store.get().settings.geluid) Sound.found(); }
    showOntknoping(idx + 1, done);
  });
}

/* -------------------------------------------------------- badge wall ---- */
export function badgeHtml(e: Engine): string {
  const meta = SKILL_META[e];
  const best = store.get().skill[e]?.best ?? 1;
  const tier = tierFor(best);
  const pct = Math.round(badgeProgress(best) * 100);
  return (
    `<div class="badge" style="--bk:${meta.kleur};--ring:${tier.ring};--glow:${tier.glow}">` +
    `<span class="badge-disc" style="background:${tier.kleur}" aria-hidden="true">${meta.glyph}</span>` +
    `<span class="badge-name">${esc(meta.naam)}</span>` +
    `<span class="badge-tier">${esc(tier.naam)}</span>` +
    `<span class="badge-bar"><span style="width:${pct}%"></span></span>` +
    `</div>`
  );
}

export function showBadges(back: () => void): void {
  const wall = (Object.keys(SKILL_META) as Engine[]).map(badgeHtml).join('');
  // the knappe woorden earned on missions (each reward card names one)
  const woorden = Object.values(store.get().knapWoorden).map((w) => w.naam);
  const knap = woorden.length
    ? `<p class="boot-kicker">Knappe woorden · ${woorden.length}</p>` +
      `<div class="knap-woorden">${woorden.map((w) => `<span class="knap-woord">${esc(w)}</span>`).join('')}</div>`
    : '';
  const el = card(
    `<div class="reward boot-card-ish">` +
    `<p class="boot-kicker">Jouw breinkracht</p>` +
    `<h1 class="boot-title">Badges</h1>` +
    `<div class="badge-row">${wall}</div>` +
    knap +
    `<button class="btn-start" type="button" data-key="back">Terug</button>` +
    `</div>`,
  );
  el.querySelector('.btn-start')?.addEventListener('click', back);
}
