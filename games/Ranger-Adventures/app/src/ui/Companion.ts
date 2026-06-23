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

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

/** Care-action glyphs — dual-channel with the label (glyph + word). */
const CARE_GLYPH: Record<string, string> = {
  flame: '🔥', drop: '💧', moon: '🌙', check: '✅', wing: '🪶', heart: '💛', eye: '👁️', path: '🧭',
};
/** A simple species mark for the cabin overlay (the 3D model lives in the world, not here). */
const SOORT_GLYPH: Record<string, string> = { raaf: '🐦‍⬛', hond: '🐕', vos: '🦊' };

let host: HTMLElement;
let onBack: () => void;

export function showCabin(ui: HTMLElement, back: () => void): void {
  host = ui;
  onBack = back;
  render();
}

function clearOverlays(): void {
  host.querySelectorAll('.ra-overlay').forEach((n) => n.remove());
}

function speak(text: string): void {
  if (store.get().settings.voorlezen) narrator.speak(text);
}

/* ----------------------------------------------------------- cabin shell ---- */
function render(): void {
  narrator.stop();
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="cabin boot-card-ish">` +
    `<p class="boot-kicker">De ranger-hut</p>` +
    `<h1 class="boot-title">Jouw plekje</h1>` +
    `<div class="cabin-sections"></div>` +
    `<button class="ra-text-btn cabin-back" type="button">Terug naar de hut</button>` +
    `</div>`;
  host.appendChild(el);

  const sections = el.querySelector<HTMLDivElement>('.cabin-sections')!;
  sections.appendChild(companionSection());
  sections.appendChild(opvangSection());

  el.querySelector('.cabin-back')?.addEventListener('click', () => { narrator.stop(); onBack(); });
}

/* ------------------------------------------------------- companion (perch) -- */
function companionSection(): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'comp-card';
  const c = store.get().companion;

  if (!c.rescued) {
    wrap.innerHTML =
      `<div class="comp-rescue">` +
      `<div class="comp-perch"><span class="comp-sprite fase-baby" aria-hidden="true">${SOORT_GLYPH[c.soort] ?? '🐦‍⬛'}</span></div>` +
      `<p class="comp-title">Een jonge raaf is uit het nest gevallen.</p>` +
      `<p class="comp-text">Hij is zwak en heeft hulp nodig. Wil je hem opvangen? Later wordt hij je vaste vriend.</p>` +
      `<div class="naam-grid"></div>` +
      `<div class="ra-row"><button class="btn-start comp-rescue-btn" type="button" disabled>Kies eerst een naam</button></div>` +
      `</div>`;
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
        btn.textContent = `Vang ${n} op`;
      });
      grid.appendChild(nb);
    });
    speak('Een jonge raaf heeft hulp nodig. Kies een naam.');
    btn.addEventListener('click', () => {
      if (!gekozen) return;
      Sound.found();
      store.rescueCompanion(gekozen);
      speak(`${gekozen} is veilig. Verzorg hem goed.`);
      render();
    });
    return wrap;
  }

  // rescued → show the friend, the bond, the kunstjes, and the daily care button
  const fase = FASE_META[c.fase];
  const bondPct = Math.max(0, Math.min(100, Math.round(c.bond)));
  const kunstjes = c.kunstjes
    .map((k: Kunstje) => `<span class="comp-kunstje">${esc(KUNSTJE_META[k].naam)}</span>`)
    .join('');
  const mee = c.meeOpMissie ? `<p class="comp-mee">${esc(c.naam)} vliegt nu met je mee op missie.</p>` : '';

  wrap.innerHTML =
    `<div class="comp-head">` +
    `<div class="comp-perch"><span class="comp-sprite fase-${esc(c.fase)}" aria-hidden="true">${SOORT_GLYPH[c.soort] ?? '🐦‍⬛'}</span></div>` +
    `<div class="comp-meta">` +
    `<div class="comp-name">${esc(c.naam || 'Je raaf')}</div>` +
    `<div class="comp-fase">${esc(fase.label)} · ${esc(fase.kort)}</div>` +
    `<div class="bond-meter" aria-label="band ${bondPct} van 100"><span class="bm-heart">💛</span>` +
    `<span class="bm-track"><span class="bm-fill" style="width:${bondPct}%"></span></span></div>` +
    (kunstjes ? `<div class="comp-kunstjes">${kunstjes}</div>` : '') +
    `</div></div>` +
    mee +
    `<div class="ra-row"><button class="btn-start comp-care-btn" type="button">Geef ${esc(c.naam || 'hem')} zorg</button></div>`;

  wrap.querySelector('.comp-care-btn')?.addEventListener('click', () => {
    Sound.unlock();
    const stappen = ZORG_STAPPEN[c.fase];
    runCare(stappen, c.naam || 'hem', (miss) => {
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

/** Fase-up celebration (positive growth, never a drop). */
function celebrateGroei(fase: Fase): void {
  const c = store.get().companion;
  const meta = FASE_META[fase];
  const newKunstje = c.kunstjes.length ? KUNSTJE_META[c.kunstjes[c.kunstjes.length - 1]] : null;
  const line = `${c.naam || 'Je raaf'} is gegroeid: ${meta.label}. ${fase !== 'baby' ? `${c.naam || 'Hij'} kan nu met je mee.` : ''}`;
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="comp-groei boot-card-ish">` +
    `<p class="boot-kicker">Je vriend groeit</p>` +
    `<span class="comp-sprite big fase-${esc(fase)}" aria-hidden="true">${SOORT_GLYPH[c.soort] ?? '🐦‍⬛'}</span>` +
    `<h1 class="boot-title">${esc(meta.label)}</h1>` +
    `<p class="comp-text">${esc(line)}</p>` +
    (newKunstje ? `<p class="comp-kunstje-new">Nieuw kunstje: <b>${esc(newKunstje.naam)}</b> — ${esc(newKunstje.uitleg.replace('{naam}', c.naam || 'Hij'))}</p>` : '') +
    `<button class="btn-start" type="button">Fijn!</button>` +
    `</div>`;
  host.appendChild(el);
  if (store.get().settings.geluid) Sound.found();
  speak(line);
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    narrator.stop();
    store.clearCompanionGroei();
    render();
  });
}

/* --------------------------------------------------------- opvang (rehab) --- */
function opvangSection(): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'opvang-kaart';
  const rehab = store.get().rehab;
  const count = rehab.releasedCount > 0
    ? `<span class="ok-count">${rehab.releasedCount} vrijgelaten</span>` : '';

  if (!rehab.active) {
    wrap.innerHTML =
      `<div class="ok-head"><span class="ok-title">De opvang</span>${count}</div>` +
      `<p class="ok-text">Soms heeft een dier even hulp nodig. Je verzorgt het en laat het weer vrij.</p>` +
      `<div class="ra-row"><button class="ra-text-btn ok-haal" type="button">Kijk wie er is</button></div>`;
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
  wrap.innerHTML =
    `<div class="ok-head"><span class="ok-title">De opvang</span>${count}</div>` +
    `<div class="ok-gast">` +
    `<p class="ok-text">Een ${esc(naam)} is ${esc(rehab.reden ?? 'verzwakt')}. Geef de juiste zorg.</p>` +
    `<div class="ra-row"><button class="btn-start ok-verzorg" type="button">Verzorg ${esc(naam)}</button></div>` +
    `</div>`;
  speak(`Een ${naam} is ${rehab.reden ?? 'verzwakt'}. Geef de juiste zorg.`);
  wrap.querySelector('.ok-verzorg')?.addEventListener('click', () => {
    Sound.unlock();
    runCare(ZORG_STAPPEN.baby, naam, () => showRelease(naam));
  });
  return wrap;
}

/** The hopeful goodbye — release the guest, count it, never sad. */
function showRelease(naam: string): void {
  clearOverlays();
  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="ok-vrij boot-card-ish">` +
    `<p class="boot-kicker">Sterk genoeg</p>` +
    `<span class="ok-vrij-art" aria-hidden="true">🕊️</span>` +
    `<h1 class="boot-title">${esc(naam)} is weer vrij</h1>` +
    `<p class="comp-text">Hij is nu sterk genoeg. Je laat hem gaan — dat hoort erbij.</p>` +
    `<button class="btn-start" type="button">Dag, sterke vriend</button>` +
    `</div>`;
  host.appendChild(el);
  if (store.get().settings.geluid) Sound.found();
  speak(`${naam} is weer sterk genoeg. Je laat hem vrij.`);
  el.querySelector('.btn-start')?.addEventListener('click', () => {
    narrator.stop();
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
  clearOverlays();
  let doneIds: string[] = [];
  let orderMiss = 0;
  let knuffelMiss = 0;
  let finished = false;

  const el = document.createElement('div');
  el.className = 'ra-overlay';
  el.innerHTML =
    `<div class="care-routine boot-card-ish">` +
    `<p class="boot-kicker">Zorg op volgorde</p>` +
    `<h1 class="boot-title">Verzorg ${esc(naam)}</h1>` +
    `<div class="care-progress" aria-label="zorgstappen"></div>` +
    `<div class="care-grid"></div>` +
    `<div class="care-msg tip" role="status">Doe de zorg op volgorde.</div>` +
    `</div>`;
  host.appendChild(el);

  const progress = el.querySelector<HTMLDivElement>('.care-progress')!;
  const grid = el.querySelector<HTMLDivElement>('.care-grid')!;
  const msg = el.querySelector<HTMLDivElement>('.care-msg')!;

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
      `<span class="cs-ico" aria-hidden="true">${CARE_GLYPH.heart}</span><span class="cs-label">Knuffelen</span></button>`;

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
        setMsg('ok', 'De zorg is klaar. Knap gedaan.');
        window.setTimeout(() => done({ orderMiss, knuffelMiss }), 1100);
      } else {
        setMsg('ok', s.zin);
      }
    } else {
      if (store.get().settings.geluid) Sound.tryAgain();
      orderMiss += 1;
      setMsg('wait', `Eerst: ${nn.label.toLowerCase()}.`);
    }
  };

  const tapKnuffel = (): void => {
    if (finished) return;
    if (store.get().settings.geluid) Sound.tryAgain();
    knuffelMiss += 1;
    setMsg('wait', `Niet te veel knuffelen. Geef ${naam} rust.`);
  };

  paint();
}
