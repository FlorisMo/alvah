/**
 * Companion.ts — the cabin/perch screen + CareRoutine care-skin (HANDOFF §7.2).
 * A DOM overlay over the 3D stage, reachable from the lodge. It owns:
 *   - rescue (name pick → store.rescueCompanion)
 *   - the daily care routine (CareRoutine) → bond grows → fase grows → friend joins
 *   - the opvang (rehab): tend a guest, then RELEASE it (help AND let go)
 *
 * CareRoutine is the care SKIN: the ordered routine is a working-memory (simon)
 * task; resisting over-handling ("Knuffelen") is an inhibition (dagnacht) task —
 * both logged to the SAME skill records the engines use (store.logSession), so
 * caring trains EF without a new engine. Never-scary/never-sad: guests are weakened-
 * not-graphic, the goodbye is hopeful. ≥56px targets, dual-channel feedback.
 */

import './companion.css';
import { store } from '../core/state';
import { narrator } from '../core/narrator';
import { Sound } from '../core/sound';
import { Content } from '../content/registry';
import {
  COMPANION_SOORTEN, FASE_META, KUNSTJE_META, ZORG_STAPPEN, OPVANG_GASTEN, CARE_ENGINES,
  careBondDelta, type ZorgStap, type Fase, type Kunstje,
} from '../core/companion';
import { card, kicker } from './flow/session';
import { icon } from './icons';
import { mountReadAloud, type ReadAloudSegment, type ReadAloudHandle } from './ReadAloud';
import { HUT, vul } from '../content/copy';
import { showVeldgids, gidsTag } from './veldgids/Veldgids';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Care-action glyphs — dual-channel with the label (glyph + word). */
const CARE_GLYPH: Record<string, string> = {
  flame: '🔥', drop: '💧', moon: '🌙', check: '✅', wing: '🪶', heart: '💛', eye: '👁️', path: '🧭',
};
/** The friend's drawn mark in the cabin (the 3D model lives in the world, not here). */
const soortMark = (soort: string): string => icon(soort === 'raaf' ? 'raven' : 'paw');

let onBack: () => void;
// The back-button label. Default "Terug naar de hut" (the lodge caller); the
// world pause-hub (W2.4b) and the hut's porch pass "Terug naar de open plek" so the
// raaf screen reads right when it overlays the LIVE world instead of the lodge.
let backLabel: string = HUT.terugHut;
// the hut's words being read aloud now (stopped when it closes or is drawn again)
let reading: ReadAloudHandle | null = null;

export function showCabin(back: () => void, label: string = HUT.terugHut): void {
  onBack = back;
  backLabel = label;
  render();
}

function speak(text: string): void {
  if (store.get().settings.voorlezen) narrator.speak(text);
}

/** One line of text per idea, each its own element (so it can light up as it is read). */
function linesHtml(cls: string, lines: readonly string[]): string {
  return `<p class="${cls}">${lines.map((l) => `<span class="comp-line">${esc(l)}</span>`).join('')}</p>`;
}
/** Those lines as read-aloud segments. */
function lineSegs(root: HTMLElement, sel: string, lines: readonly string[]): ReadAloudSegment[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`${sel} .comp-line`)).map((el, i) => ({ el, text: lines[i] ?? '' }));
}

/* ----------------------------------------------------------- cabin shell ---- */
/** What the hut says as it opens: its name, then what is new (the raaf that needs help,
 *  or the guest in the opvang), every line read aloud and lit up as it is said. */
interface HutWords { segs: ReadAloudSegment[]; trail: string[] }

/** Draw the hut. `quiet`: it does not read itself (something else is being said). */
function render(quiet = false): void {
  reading?.stop();
  narrator.stop();
  // the way back sits in the pinned footer: it never scrolls out of the card (breaker B3)
  const el = card(
    `<div class="card cabin">` +
    kicker('raven', HUT.kicker) +
    `<h1 class="boot-title">${esc(HUT.titel)}</h1>` +
    `<div class="card-body"><div class="cabin-sections"></div></div>` +
    `<div class="card-foot"><div class="ra-row cabin-foot-row">` +
    // run 7: his veldgids lies in the hut too
    `<button class="ra-chip cabin-gids" type="button">` +
    `<span class="ra-chip-ic">${icon('veldgids')}</span><span class="ra-chip-tx">${esc(HUT.veldgids)}</span>${gidsTag()}</button>` +
    `<button class="ra-chip cabin-back" type="button" data-key="back">` +
    `<span class="ra-chip-ic">${icon('back')}</span><span class="ra-chip-tx">${esc(backLabel)}</span></button>` +
    `</div></div>` +
    `</div>`,
  );

  const sections = el.querySelector<HTMLDivElement>('.cabin-sections')!;
  const words: HutWords = { segs: [], trail: [] };
  sections.appendChild(companionSection(words));
  // one thing at a time: the opvang opens once the raaf is taken in (the hut's first job)
  const s = store.get();
  if (s.companion.rescued || s.rehab.active) sections.appendChild(opvangSection(words));
  reading = mountReadAloud({
    segments: [{ el: el.querySelector<HTMLElement>('.cabin .boot-title')!, text: HUT.titel, sentence: true }, ...words.segs],
    trail: words.trail.join(' '),
    autoStart: store.get().settings.voorlezen && !quiet,
  });

  el.querySelector('.cabin-back')?.addEventListener('click', () => { reading?.stop(); narrator.stop(); onBack(); });
  el.querySelector('.cabin-gids')?.addEventListener('click', () => { reading?.stop(); showVeldgids(() => render()); });
}

/* ------------------------------------------------------- companion (perch) -- */
function companionSection(words: HutWords): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'comp-card';
  const c = store.get().companion;

  if (!c.rescued) {
    // what happened, one idea a line (the first as its heading)
    const [kop, ...rest] = HUT.redding;
    wrap.innerHTML =
      `<div class="comp-rescue">` +
      `<div class="comp-perch"><span class="comp-sprite fase-baby" aria-hidden="true">${soortMark(c.soort)}</span></div>` +
      linesHtml('comp-title', [kop]) +
      linesHtml('comp-text', rest) +
      `<div class="naam-grid"></div>` +
      `<div class="ra-row"><button class="btn-start comp-rescue-btn" type="button" disabled>${esc(HUT.kiesNaam)}</button></div>` +
      `</div>`;
    words.segs.push(...lineSegs(wrap, '.comp-title', [kop]), ...lineSegs(wrap, '.comp-text', rest));
    words.trail.push(`${HUT.kiesNaam}.`);
    const namen = (COMPANION_SOORTEN[c.soort] ?? COMPANION_SOORTEN.raaf).namen;
    const grid = wrap.querySelector<HTMLDivElement>('.naam-grid')!;
    let gekozen = '';
    const btn = wrap.querySelector<HTMLButtonElement>('.comp-rescue-btn')!;
    namen.forEach((n) => {
      const nb = document.createElement('button');
      nb.type = 'button';
      nb.className = 'naam-knop';
      nb.textContent = n;
      nb.addEventListener('click', () => {
        Sound.unlock(); Sound.select();
        gekozen = n;
        grid.querySelectorAll('.naam-knop').forEach((x) => x.classList.remove('gekozen'));
        nb.classList.add('gekozen');
        btn.disabled = false;
        btn.textContent = vul(HUT.vangOp, { raaf: n });
        speak(n); // the name he picked, said back
      });
      grid.appendChild(nb);
    });
    btn.addEventListener('click', () => {
      if (!gekozen) return;
      Sound.found();
      store.rescueCompanion(gekozen);
      render(true);
      speak(vul(HUT.zegVeilig, { raaf: gekozen }));
    });
    return wrap;
  }

  // rescued → show the friend, the bond, the kunstjes, and the daily care button
  const fase = FASE_META[c.fase];
  const bondPct = Math.max(0, Math.min(100, Math.round(c.bond)));
  const kunstjes = c.kunstjes
    .map((k: Kunstje) => `<span class="comp-kunstje">${esc(KUNSTJE_META[k].naam)}</span>`)
    .join('');
  const mee = c.meeOpMissie ? `<p class="comp-mee">${esc(vul(HUT.meeOpMissie, { raaf: c.naam }))}</p>` : '';

  wrap.innerHTML =
    `<div class="comp-head">` +
    `<div class="comp-perch"><span class="comp-sprite fase-${esc(c.fase)}" aria-hidden="true">${soortMark(c.soort)}</span></div>` +
    `<div class="comp-meta">` +
    `<div class="comp-name">${esc(raafNaam())}</div>` +
    `<div class="comp-fase">${esc(fase.label)} · ${esc(fase.kort)}</div>` +
    `<div class="bond-meter" aria-label="band ${bondPct} van 100"><span class="bm-heart">${icon('heart')}</span>` +
    `<span class="bm-track"><span class="bm-fill" style="width:${bondPct}%"></span></span></div>` +
    (kunstjes ? `<div class="comp-kunstjes">${kunstjes}</div>` : '') +
    `</div></div>` +
    mee +
    `<div class="ra-row"><button class="btn-start comp-care-btn" type="button">${esc(vul(HUT.geefZorg, { raaf: raafNaam() }))}</button></div>`;
  const meeEl = wrap.querySelector<HTMLElement>('.comp-mee');
  if (meeEl) words.segs.push({ el: meeEl, text: meeEl.textContent ?? '' });

  wrap.querySelector('.comp-care-btn')?.addEventListener('click', () => {
    Sound.unlock();
    const stappen = ZORG_STAPPEN[c.fase];
    runCare(stappen, raafNaam(), (miss) => {
      const before = store.get().companion.fase;
      store.bondDelta(careBondDelta(miss.orderMiss, miss.knuffelMiss));
      const grew = store.get().companionGroei && store.get().companion.fase !== before;
      if (grew) {
        celebrateGroei(store.get().companion.fase);
      } else {
        render();
      }
    });
  });
  return wrap;
}

/** The raaf's name ("Kroa"), or "Je raaf" before it has one. */
function raafNaam(): string {
  return store.get().companion.naam?.trim() || HUT.jeRaaf;
}

/** Fase-up celebration (positive growth, never a drop). */
function celebrateGroei(fase: Fase): void {
  const c = store.get().companion;
  const meta = FASE_META[fase];
  const newKunstje = c.kunstjes.length ? KUNSTJE_META[c.kunstjes[c.kunstjes.length - 1]] : null;
  const naam = raafNaam();
  const lines = [vul(HUT.gegroeid, { raaf: naam, fase: meta.label }), ...(fase !== 'baby' ? [vul(HUT.kanMee, { raaf: naam })] : [])];
  const kunstje = newKunstje ? [vul(HUT.nieuwKunstje, { kunstje: newKunstje.naam }), vul(newKunstje.uitleg, { raaf: naam })] : [];
  const el = card(
    `<div class="card card--narrow comp-groei">` +
    kicker('heart', HUT.groeiKicker) +
    `<span class="comp-sprite big fase-${esc(fase)}" aria-hidden="true">${soortMark(c.soort)}</span>` +
    `<h1 class="boot-title">${esc(meta.label)}</h1>` +
    linesHtml('comp-text', lines) +
    (kunstje.length ? linesHtml('comp-kunstje-new', kunstje) : '') +
    `<div class="card-foot"><div class="ra-row"><button class="btn-start" type="button">${esc(HUT.fijn)}</button></div></div>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  const ra = mountReadAloud({
    segments: [...lineSegs(el, '.comp-text', lines), ...lineSegs(el, '.comp-kunstje-new', kunstje)],
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    store.clearCompanionGroei();
    render();
  });
}

/* --------------------------------------------------------- opvang (rehab) --- */
function opvangSection(words: HutWords): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'opvang-kaart';
  const rehab = store.get().rehab;
  const count = rehab.releasedCount > 0
    ? `<span class="ok-count">${esc(vul(HUT.vrijgelaten, { n: rehab.releasedCount }))}</span>` : '';

  if (!rehab.active) {
    wrap.innerHTML =
      `<div class="ok-head"><span class="ok-title">${esc(HUT.opvang)}</span>${count}</div>` +
      linesHtml('ok-text', HUT.opvangUitleg) +
      `<div class="ra-row"><button class="ra-chip ok-haal" type="button">${esc(HUT.kijkWie)}</button></div>`;
    words.segs.push(...lineSegs(wrap, '.ok-text', HUT.opvangUitleg));
    wrap.querySelector('.ok-haal')?.addEventListener('click', () => {
      Sound.unlock(); Sound.select();
      // deterministic pick (no Math.random in run-land): rotate by how many you've already released
      const gast = OPVANG_GASTEN[rehab.releasedCount % OPVANG_GASTEN.length];
      store.startRehab(gast);
      render();
    });
    return wrap;
  }

  const dier = rehab.dier ?? 'das';
  const naam = Content.animal(dier)?.naam ?? dier;
  const gast = [vul(HUT.gast, { gast: naam, reden: rehab.reden ?? 'moe' }), HUT.juisteZorg];
  wrap.innerHTML =
    `<div class="ok-head"><span class="ok-title">${esc(HUT.opvang)}</span>${count}</div>` +
    `<div class="ok-gast">` +
    linesHtml('ok-text', gast) +
    `<div class="ra-row"><button class="btn-start ok-verzorg" type="button">${esc(vul(HUT.verzorgDe, { gast: naam }))}</button></div>` +
    `</div>`;
  words.segs.push(...lineSegs(wrap, '.ok-text', gast));
  wrap.querySelector('.ok-verzorg')?.addEventListener('click', () => {
    Sound.unlock();
    runCare(ZORG_STAPPEN.baby, `de ${naam}`, () => showRelease(naam));
  });
  return wrap;
}

/** The hopeful goodbye — release the guest, count it, never sad. */
function showRelease(naam: string): void {
  const titel = vul(HUT.vrij, { gast: naam });
  const el = card(
    `<div class="card card--narrow ok-vrij">` +
    kicker('leaf', HUT.vrijKicker) +
    `<span class="ok-vrij-art" aria-hidden="true">${icon('leaf')}</span>` +
    `<h1 class="boot-title">${esc(titel)}</h1>` +
    linesHtml('comp-text', HUT.vrijRegels) +
    `<div class="card-foot"><div class="ra-row"><button class="btn-start" type="button">${esc(HUT.dag)}</button></div></div>` +
    `</div>`,
  );
  if (store.get().settings.geluid) Sound.found();
  const ra = mountReadAloud({
    segments: [{ el: el.querySelector<HTMLElement>('.ok-vrij .boot-title')!, text: titel, sentence: true }, ...lineSegs(el, '.comp-text', HUT.vrijRegels)],
    autoStart: store.get().settings.voorlezen,
  });
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    ra.stop();
    store.releaseRehab();
    render();
  });
}

/* ------------------------------------------ CareRoutine — the EF care skin -- */
interface CareMiss { orderMiss: number; knuffelMiss: number; }

/**
 * Render the ordered care round into a fresh overlay. The child must tap the
 * needed step IN ORDER (working memory = simon); the tempting "Knuffelen" button
 * is the over-handling trap (inhibition = dagnacht). On completion both skills are
 * logged (correct iff no miss of that kind) and `done(miss)` fires.
 */
function runCare(stappen: ZorgStap[], naam: string, done: (m: CareMiss) => void): void {
  let doneIds: string[] = [];
  let orderMiss = 0;
  let knuffelMiss = 0;
  let finished = false;

  const el = card(
    `<div class="card care-routine">` +
    kicker('heart', HUT.zorgKicker) +
    `<h1 class="boot-title">${esc(vul(HUT.verzorg, { wie: naam }))}</h1>` +
    `<div class="care-progress" aria-label="zorgstappen"></div>` +
    `<div class="care-grid"></div>` +
    `<div class="care-msg tip" role="status">${esc(HUT.zorgTip)}</div>` +
    // never a one-way door: Esc (or this) goes back to the hut, nothing is counted
    `<div class="card-foot"><button class="ra-chip care-back" type="button" data-key="back">` +
    `<span class="ra-chip-ic">${icon('back')}</span><span class="ra-chip-tx">${esc(HUT.terug)}</span></button></div>` +
    `</div>`,
  );
  el.querySelector('.care-back')?.addEventListener('click', () => { if (!finished) { narrator.stop(); render(); } });

  const progress = el.querySelector<HTMLDivElement>('.care-progress')!;
  const grid = el.querySelector<HTMLDivElement>('.care-grid')!;
  const msg = el.querySelector<HTMLDivElement>('.care-msg')!;

  // what the round is, said as it opens: its title and the rule
  speak(`${vul(HUT.verzorg, { wie: naam })}. ${HUT.zorgTip}`);

  const setMsg = (kind: 'tip' | 'ok' | 'wait', text: string): void => {
    msg.className = `care-msg ${kind}`;
    msg.textContent = text;
    speak(text);
  };

  const nextNeed = (): ZorgStap | undefined => stappen.find((s) => !doneIds.includes(s.id));

  const paint = (): void => {
    const nn = nextNeed();
    progress.innerHTML = stappen
      .map((s) => {
        const cls = doneIds.includes(s.id) ? 'done' : nn && nn.id === s.id ? 'next' : '';
        return `<span class="care-dot ${cls}"></span>`;
      })
      .join('');
    grid.innerHTML =
      stappen
        .map((s) => {
          const isDone = doneIds.includes(s.id);
          const isNext = nn && nn.id === s.id;
          return (
            `<button class="care-step${isDone ? ' done' : ''}${isNext ? ' next' : ''}" type="button" data-id="${esc(s.id)}"${isDone ? ' disabled' : ''}>` +
            `<span class="cs-ico" aria-hidden="true">${CARE_GLYPH[s.icon] ?? '•'}</span>` +
            `<span class="cs-label">${esc(s.label)}</span>` +
            (isDone ? `<span class="cs-tick" aria-hidden="true">✓</span>` : '') +
            `</button>`
          );
        })
        .join('') +
      `<button class="care-step knuffel" type="button" data-knuffel="1">` +
      `<span class="cs-ico" aria-hidden="true">${CARE_GLYPH.heart}</span><span class="cs-label">${esc(HUT.knuffelen)}</span></button>`;

    grid.querySelectorAll<HTMLButtonElement>('.care-step').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.knuffel) return tapKnuffel();
        const s = stappen.find((x) => x.id === b.dataset.id);
        if (s) tapStep(s);
      });
    });
  };

  const tapStep = (s: ZorgStap): void => {
    if (finished) return;
    const nn = nextNeed();
    if (!nn) return;
    if (s.id === nn.id) {
      if (store.get().settings.geluid) Sound.correct();
      doneIds = [...doneIds, s.id];
      const last = doneIds.length === stappen.length;
      paint();
      if (last) {
        finished = true;
        if (store.get().settings.geluid) Sound.found();
        // care SKIN → log to the SAME skill records the engines use
        store.logSession(CARE_ENGINES.order, { trials: 1, correct: orderMiss > 0 ? 0 : 1 });
        store.logSession(CARE_ENGINES.inhibition, { trials: 1, correct: knuffelMiss > 0 ? 0 : 1 });
        setMsg('ok', HUT.zorgKlaar);
        window.setTimeout(() => done({ orderMiss, knuffelMiss }), 1100);
      } else {
        setMsg('ok', s.zin);
      }
    } else {
      if (store.get().settings.geluid) Sound.tryAgain();
      orderMiss += 1;
      setMsg('wait', vul(HUT.eerst, { stap: nn.label.toLowerCase() }));
    }
  };

  const tapKnuffel = (): void => {
    if (finished) return;
    if (store.get().settings.geluid) Sound.tryAgain();
    knuffelMiss += 1;
    setMsg('wait', HUT.teVeel);
  };

  paint();
}
