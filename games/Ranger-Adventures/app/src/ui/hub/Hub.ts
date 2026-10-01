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
import { mountReadAloud, readScreenAloud, speakButtonHtml, speakButtonBeside, sentenceSegments, type ReadAloudHandle, type ReadAloudSegment } from '../ReadAloud';
import { zinnen } from '../../core/readlevel';
import { SAY } from '../../content/screens';
import { BESTURING } from '../../content/mentor';
import { HUB, TELWOORD, vul } from '../../content/copy';
import { joystickVisible } from '../../core/input';
import { coarsePointer } from '../hud/device';
import { missionIcon } from '../MissionIcon';
import { showCabin } from '../Companion';
import { showTweaks } from '../Tweaks';
import { session, esc, card, plainCard, kicker } from '../flow/session';
import { icon, CLUE_ICON, type IconName } from '../icons';
import { goToMission, unmountMissionPause } from '../flow/MissionFlow';
import { returnToTitle, resumePatrol, activeExploreTitel, nextMissionId, storyOrder } from '../flow/WorldSession';
import { showExploreHud } from '../hud/ExploreHud';

/* ---------------------------------------------------------------- title ---- */
/**
 * F-27: the pause hub's "Naar het hoofdmenu": back to the title. The title is a shot of
 * the same live world (WorldSession.returnToTitle): a soft fade, the ranger back on the
 * spawn clearing, the camera rising to the title. Progress is write-through in
 * `state.ts`, so "Begin" glides the returning player straight back into play.
 */
export function showTitle(): void {
  narrator.stop();
  unmountMissionPause();
  returnToTitle();
}

/* ------------------------------------------------------------ pause hub ---- */
/** The raaf link reflects the companion: rescue prompt → friend's name. */
function cabinLabel(): string {
  const c = store.get().companion;
  if (!c.rescued) return HUB.raafHelp; // parent:B13
  return vul(HUB.raafZorg, { raaf: c.naam || HUB.jeRaaf });
}

/** Found/total clue count shown on the prikbord link. */
function cluesBadge(): string {
  const area = Content.activeArea();
  const found = Content.cluesFound(area.id, store.get().voltooid).size;
  const total = Content.clues(area.id).length;
  if (!total) return '';
  return `<span class="lodge-clue-count">${found}/${total}</span>`;
}

/**
 * The in-world pause / hub shell (W2.4a/b): prikbord + raaf + badges +
 * instellingen + hoofdmenu, over the LIVE world. Instellingen + badges hand their
 * "terug" back to this hub; the prikbord + raaf return to the open plek.
 */
export function showPauseHub(): void {
  narrator.stop();
  const toWorld = (): void => showExploreHud(activeExploreTitel());
  const tile = (cls: string, ic: IconName, words: string, extra = ''): string =>
    `<button class="ra-chip hub-tile ${cls}" type="button"><span class="ra-chip-ic">${icon(ic)}</span>` +
    `<span class="ra-chip-tx">${words}</span>${extra}</button>`;
  const el = card(
    `<div class="card pause-hub">` +
    kicker('pause', HUB.pauze) +
    `<h1 class="boot-title">${esc(HUB.vraag)}</h1>` +
    `<div class="hub-tiles">` +
    tile('ph-prikbord', 'book', esc(HUB.boek), cluesBadge()) +
    tile('ph-companion', 'raven', esc(cabinLabel())) +
    tile('ph-badges', 'badge', esc(HUB.badges)) +
    tile('ph-tweaks', 'gear', esc(HUB.instellingen)) +
    `</div>` +
    `<div class="card-foot">` +
    `<div class="ra-row"><button class="btn-start ph-back" type="button" data-key="back">${esc(HUB.terug)}</button></div>` +
    `<button class="ra-chip ph-hoofdmenu" type="button"><span class="ra-chip-ic">${icon('home')}</span>` +
    `<span class="ra-chip-tx">${esc(HUB.hoofdmenu)}</span></button>` +
    `</div>` +
    `</div>`,
  );
  const voor = store.get().settings.voorlezen; // child:B12: the menu reads aloud, each choice on hover/focus
  readScreenAloud(el, { text: SAY.pauze, autoStart: voor, items: '.ra-chip', hover: voor });
  el.querySelector('.ph-prikbord')?.addEventListener('click', () => showCaseBoard());
  el.querySelector('.ph-companion')?.addEventListener('click', () =>
    showCabin(toWorld, HUB.terug));
  el.querySelector('.ph-badges')?.addEventListener('click', () => showBadges(showPauseHub));
  el.querySelector('.ph-tweaks')?.addEventListener('click', () => showTweaks(showPauseHub));
  el.querySelector('.ph-hoofdmenu')?.addEventListener('click', () => showTitle());
  el.querySelector('.ph-back')?.addEventListener('click', toWorld);
}

/* ---------------------------------------------------- zo speel je (?) ---- */
/**
 * Run 6: the "?" chip's small card, "Zo speel je": one key cap (or a drawn stick on a
 * tablet) and one word per control, read aloud. Terug (Enter or Esc) goes back to the
 * world, where nothing moved.
 */
export function showControls(): void {
  narrator.stop();
  const toWorld = (): void => showExploreHud(activeExploreTitel());
  const stick = joystickVisible(store.get().settings.joystick, coarsePointer());
  const rows = (stick ? BESTURING.stick : BESTURING.keys)
    .map((r) => `<li class="zs-row"><span class="zs-key" aria-hidden="true">${controlGlyph(r.toets)}</span><span class="zs-wat">${esc(r.wat)}</span></li>`)
    .join('');
  const el = card(
    `<div class="card card--narrow controls-card">` +
    `<h1 class="boot-title">${esc(BESTURING.titel)}</h1>` +
    `<ul class="zs-list">${rows}</ul>` +
    `<div class="card-foot"><div class="ra-row"><button class="btn-start zs-back" type="button" data-key="back">${esc(BESTURING.terug)}</button></div></div>` +
    `</div>`,
  );
  readScreenAloud(el, { text: stick ? BESTURING.zegStick : BESTURING.zegKeys, autoStart: store.get().settings.voorlezen, anchor: '.zs-back' });
  el.querySelector('.zs-back')?.addEventListener('click', toWorld);
}

/** The picture of a control on the "Zo speel je" card: key caps, or a drawn stick/finger. */
function controlGlyph(toets: string): string {
  switch (toets) {
    case 'pijltjes': return '<span class="kcap-cluster kcap-cluster-sm"><span class="kcap kcap-up">↑</span><span class="kcap">←</span><span class="kcap">↓</span><span class="kcap">→</span></span>';
    case 'Shift': return '<span class="kcap kcap-wide">⇧ Shift</span>';
    case 'muis': return '<span class="kcap kcap-wide kcap-icon">' + ICON_MOUSE + '</span>';
    case 'Enter': return '<span class="kcap kcap-wide">Enter ↵</span>';
    case 'Esc': return '<span class="kcap">Esc</span>';
    case 'stick': return ICON_STICK(false);
    case 'stick ver': return ICON_STICK(true);
    case 'veeg': return ICON_SWIPE;
    default: return ICON_TAP;
  }
}
const ICON_MOUSE = '<svg viewBox="0 0 48 48" width="30" height="30" focusable="false"><rect x="16" y="9" width="16" height="28" rx="8" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M24 9v9" stroke="currentColor" stroke-width="2.6"/><path d="M5 24h8M5 24l3-3M5 24l3 3M43 24h-8M43 24l-3-3M43 24l-3 3" fill="none" stroke="#c9901a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_STICK = (far: boolean): string => `<svg class="zs-pic" viewBox="0 0 48 48" width="52" height="52" focusable="false"><circle cx="24" cy="24" r="19" fill="rgba(20,16,12,.12)" stroke="currentColor" stroke-width="2.4"/><circle cx="${far ? 30 : 24}" cy="${far ? 12 : 21}" r="9" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4"/>${far ? '<path d="M33 7l6-1-1 6" fill="none" stroke="#c9901a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
const ICON_SWIPE = '<svg class="zs-pic" viewBox="0 0 48 48" width="52" height="52" focusable="false"><path d="M20 42V22a3 3 0 0 1 6 0v10l8 2a3 3 0 0 1 2 3l-1 5" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 12h30M6 12l4-4M6 12l4 4M36 12l-4-4M36 12l-4 4" fill="none" stroke="#c9901a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TAP = '<svg class="zs-pic" viewBox="0 0 48 48" width="52" height="52" focusable="false"><circle cx="23" cy="14" r="7" fill="none" stroke="#c9901a" stroke-width="2.4"/><path d="M20 44V16a3 3 0 0 1 6 0v12l8 2a3 3 0 0 1 2 3l-1 6" fill="#fdfcf8" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';

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
  const cards = storyOrder(area.missies)
    .map((m) => {
      const engines = Array.from(new Set(m.stappen.map((s) => s.ef as Engine))).filter((e) => SKILL_META[e]);
      const klaar = done[m.id] ? `<span class="mc-done" aria-label="${esc(HUB.voltooid)}">${icon('check')}</span>` : '';
      // the recommended mission: first unfinished in story order (the chip points at it too)
      const isNext = m.id === next;
      const nu = isNext ? `<span class="mc-next-tag">${esc(HUB.nuDoen)}</span>` : '';
      return (
        `<button class="mission-card${isNext ? ' mc-next' : ''}${done[m.id] ? ' mc-klaar' : ''}" type="button" data-id="${esc(m.id)}"${isNext ? ' data-key="primary"' : ''}>` +
        nu +
        missionIcon(m) +
        `<span class="mc-land">${esc(m.landschap)}</span>${klaar}` +
        `<span class="mc-title">${esc(m.titel)}</span>` +
        `<span class="mc-eng">${engines.map((e) => `<span class="mc-chip" style="--bk:${SKILL_META[e].kleur}">${icon(SKILL_META[e].icon)}${esc(SKILL_META[e].naam)}</span>`).join('')}</span>` +
        `</button>`
      );
    })
    .join('');

  const el = plainCard(
    `<div class="mission-board">` +
    kicker('pin', vul(HUB.bord, { gebied: area.naam })) +
    `<h1 class="boot-title">${esc(HUB.kies)}</h1>` +
    `<div class="mb-scroll"><div class="mission-grid">${cards}</div></div>` +
    `<button class="ra-chip mb-back" type="button" data-key="back">` +
    `<span class="ra-chip-ic">${icon('back')}</span>` +
    `<span class="ra-chip-tx">${esc(HUB.terug)}</span></button>` +
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
  const voor = store.get().settings.voorlezen; // child:B12: 🔊 by the heading; a card says its title
  readScreenAloud(el, { text: SAY.bord, anchor: '.boot-title', autoStart: voor, items: '.mission-card', hover: voor,
    itemText: (b) => b.querySelector('.mc-title')?.textContent ?? '' });
}

/* ------------------------------------ sporenboek (clues; code: case-board) ---- */
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

  // a found clue: its drawn picture (footprints, not a paw: parent:B13), title and text,
  // one sentence a line; one still to find: an empty dashed frame, "Nog niet gevonden"
  // (never "???"; the note under the cork says how many are still to find)
  const board = clues
    .map((c) => {
      const isF = found.has(c.id);
      return (
        `<div class="cb-clue${isF ? ' found' : ''}" data-clue="${esc(c.id)}">` +
        `<span class="cb-pin" aria-hidden="true"></span>` +
        `<span class="cb-photo">${icon(isF ? CLUE_ICON[c.soort] ?? 'photo' : 'unknown')}</span>` +
        (isF
          ? `<span class="cb-clue-title">${esc(c.titel)}</span><span class="cb-clue-text">${zinHtml(zinnen(c.tekst))}</span>`
          : `<span class="cb-clue-wait">${esc(HUB.nietGevonden)}</span>`) +
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
      `<p class="cb-veld-head">${icon('leaf')}<span>${esc(vul(HUB.veldnotities, { n: gotN.length, m: notities.length }))}</span></p>` +
      (gotN.length
        ? gotN
            .map((n, i) =>
              `<div class="cb-veld-note" data-i="${i}">` +
              (n.dier ? `<span class="cb-veld-dier">${esc(n.dier)}</span>` : '') +
              `<span class="cb-veld-text"></span>` +
              speakButtonHtml('ra-speak cb-veld-speak') +
              `</div>`,
            )
            .join('')
        : `<p class="cb-note cb-veld-leeg muted"></p>`) +
      `</div>`
    : '';

  const count = gemeld ? HUB.opgelost : `${found.size}/${clues.length}`;
  // the note under the cork says what is still to come (never the newest clue again: that
  // clue is read and lit up on the cork itself), or the happy end
  const rest = clues.length - found.size;
  const noteLines: readonly string[] = gemeld
    ? HUB.gestopt
    : !laatste
      ? HUB.geenSporen
      : allFound
        ? HUB.alleGevonden
        : [rest === 1 ? HUB.nogEen : vul(HUB.nogMeer, { aantal: TELWOORD[rest] ?? rest })];
  const note = `<p class="cb-note cb-note-main${gemeld ? ' ok' : laatste ? '' : ' muted'}"></p>`;
  // Enter always moves on (child B7): the pinned footer carries the primary. With every
  // clue found that is "Volg het spoor" (the way to the ontknoping), and walking on is
  // the quiet way back; otherwise "Verder op patrouille" itself is the primary.
  const resolve = allFound && !gemeld;
  const onLabel = esc(back === resumePatrol ? HUB.verderPatrouille : HUB.verder);
  const foot = resolve
    ? `<div class="ra-row"><button class="btn-start cb-resolve" type="button">${icon('footprints')}${esc(HUB.volgSpoor)}</button></div>` +
      `<button class="ra-chip cb-back" type="button" data-key="back">${onLabel}</button>`
    : `<div class="ra-row"><button class="btn-start cb-back" type="button" data-key="back">${onLabel}</button></div>`;

  const el = card(
    `<div class="card card--wide case-board">` +
    kicker('book', vul(HUB.boekKicker, { hoofdstuk: chapter?.naam ?? '', telling: count })) +
    `<h1 class="boot-title">${esc(HUB.boekVraag)}</h1>` +
    `<div class="card-body">` +
    `<div class="cb-cork">${board}</div>` +
    note +
    veldStrip +
    `</div>` +
    `<div class="card-foot">${foot}</div>` +
    `</div>`,
  );
  // What the book is, then the newest clue (its title and text) and the note under the
  // cork, read aloud and lit up line by line (the happy end: only its note). The 🔊 by the
  // heading says it again.
  const newest = !gemeld && laatste ? el.querySelector<HTMLElement>(`.cb-clue[data-clue="${CSS.escape(laatste.id)}"]`) : null;
  const leeg = el.querySelector<HTMLElement>('.cb-veld-leeg');
  const segments = [
    ...(newest && laatste
      ? [{ el: newest.querySelector<HTMLElement>('.cb-clue-title')!, text: laatste.titel, sentence: true },
        ...sentenceSegments(newest.querySelector<HTMLElement>('.cb-clue-text')!, laatste.tekst)]
      : []),
    ...lineSegments(el.querySelector<HTMLElement>('.cb-note-main')!, noteLines),
    ...(leeg ? lineSegments(leeg, [HUB.geenNotities]) : []),
  ];
  const ra = mountReadAloud({ lead: HUB.zegBoek, segments, autoStart: store.get().settings.voorlezen });
  // W6.3b: each collected veldnotitie reads aloud on demand, lit up line by line. One voice
  // at a time: a new read stops the one before (its highlight too).
  const facts = Array.from(el.querySelectorAll<HTMLElement>('.cb-veld-note')).map((row, i) => ({
    btn: row.querySelector('.cb-veld-speak'),
    ra: mountReadAloud({ segments: sentenceSegments(row.querySelector<HTMLElement>('.cb-veld-text')!, gotN[i]?.tekst ?? '') }),
  }));
  const reads = [ra, ...facts.map((f) => f.ra)];
  const stopAll = (): void => reads.forEach((r) => r.stop());
  const sayOnly = (r: ReadAloudHandle): void => { reads.forEach((o) => { if (o !== r) o.stop(); }); r.speak(); };
  speakButtonBeside(el.querySelector('.boot-title'))?.addEventListener('click', () => sayOnly(ra));
  facts.forEach((f) => f.btn?.addEventListener('click', () => sayOnly(f.ra)));
  el.querySelector('.cb-back')?.addEventListener('click', () => {
    stopAll();
    back();
  });
  el.querySelector('.cb-resolve')?.addEventListener('click', () => {
    stopAll();
    Sound.unlock();
    showOntknoping(0, () => showCaseBoard(back));
  });
}

/** Lines of a card as `.zin` spans (one sentence a line), the text escaped. */
function zinHtml(lines: readonly string[]): string {
  return lines.map((l) => `<span class="zin">${esc(l)}</span>`).join(' ');
}
/** Given lines (each one sentence) into `host`, one a line, as read-aloud segments. */
function lineSegments(host: HTMLElement, lines: readonly string[]): ReadAloudSegment[] {
  host.innerHTML = zinHtml(lines);
  return Array.from(host.querySelectorAll<HTMLElement>('.zin')).map((el, i) => ({ el, text: lines[i] }));
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
    `<div class="card card--narrow ontknoping">` +
    kicker('footprints', vul(HUB.opHetSpoor, { n: idx + 1, m: beats.length })) +
    `<p class="ont-text"></p>` +
    `<div class="card-foot"><div class="ra-row">${speakButtonHtml()}` +
    `<button class="btn-start" type="button">${esc(last ? HUB.klaar : HUB.verder)}</button></div></div>` +
    `</div>`,
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
/** One breinkracht badge: its drawn picture on the tier's disc (brons, zilver, goud), its
 *  name, the tier and how far to the next one. `i`: its place in a row that eases in one
 *  badge after the other (the reward). */
export function badgeHtml(e: Engine, i = 0): string {
  const meta = SKILL_META[e];
  const best = store.get().skill[e]?.best ?? 1;
  const tier = tierFor(best);
  const pct = Math.round(badgeProgress(best) * 100);
  return (
    `<div class="badge" style="--bk:${meta.kleur};--ring:${tier.ring};--glow:${tier.glow};--i:${i}">` +
    `<span class="badge-disc" style="background:${tier.kleur}">${icon(meta.icon)}</span>` +
    `<span class="badge-name">${esc(meta.naam)}</span>` +
    `<span class="badge-tier">${esc(tier.naam)}</span>` +
    `<span class="badge-bar"><span style="width:${pct}%"></span></span>` +
    `</div>`
  );
}

export function showBadges(back: () => void): void {
  const wall = (Object.keys(SKILL_META) as Engine[]).map((e) => badgeHtml(e)).join('');
  // the knappe woorden earned on missions (each reward card names one)
  const woorden = Object.values(store.get().knapWoorden).map((w) => w.naam);
  const knap = woorden.length
    ? `<p class="kw-head">${esc(vul(HUB.knappeWoorden, { n: woorden.length }))}</p>` +
      `<div class="knap-woorden">${woorden.map((w) => `<span class="knap-woord">${esc(w)}</span>`).join('')}</div>`
    : '';
  const el = card(
    `<div class="card badge-wall">` +
    kicker('badge', HUB.breinkracht) +
    `<h1 class="boot-title">${esc(HUB.badgesTitel)}</h1>` +
    `<div class="card-body"><div class="badge-row">${wall}</div>${knap}</div>` +
    `<div class="card-foot"><div class="ra-row"><button class="btn-start" type="button" data-key="back">${esc(HUB.terugKort)}</button></div></div>` +
    `</div>`,
  );
  // what the wall is, and each badge says its name and step on hover or focus (child:B12)
  const voor = store.get().settings.voorlezen;
  const ra = readScreenAloud(el, { text: HUB.zegBadges, autoStart: voor, items: '.badge', hover: voor,
    itemText: (b) => `${b.querySelector('.badge-name')?.textContent ?? ''}: ${b.querySelector('.badge-tier')?.textContent ?? ''}` });
  el.querySelector('.btn-start')?.addEventListener('click', () => { ra.stop(); back(); });
}
