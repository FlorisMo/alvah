# Plan — Oefenspelletjes voor Alvah

Meta-plan dat `docs/source/Research-practice-tools.md` omzet naar een faseerbare bouw. Elke fase is klein genoeg voor één Claude Code-run met marge (<~90 min, <~500 regels nieuwe code, één à twee bestanden van betekenis).

---

## Hervat-gids — lees dit eerst bij een nieuwe sessie

**Status (25 apr 2026, zevende run + 8.5 iteratie):** Fases 0–8 + 8.5 + 11 + 12 **klaar**. Eindstand:
- Top-nav is een minimale flex-rij (home-icoon links, hamburger rechts). Geen horizontale linklijst meer.
- Alle dossier-navigatie loopt via het rechts uitschuivend zijmenu — grote groen-gradient "Spelen"-CTA bovenaan, 11 items eronder (Home + 10 dossier-pagina's). ESC of overlay-click sluit.
- Alle 5 spellen speelbaar met groei-fragment + bloei + chord. Corsi-sterren effect via `<style is:global>` blok (Astro-scoping omzeilen voor JS-SVG).
- Admin: KPI + 5 research-lenzen + heatmap in 4 dagdelen + mijlpalen-badge-grid + cadeau-koppeling + JSON-tools.
- 4 commits in deze sessie: `e0bef68` (Fase 7-12) → `3f21633` (Fase 8.5 eerste pass) → `e5b8059` (zijmenu fix) → `284ec79` (top-nav weg + Corsi globaal) → `7d88a5c` (Corsi subtieler). HEAD = `7d88a5c`. Hoofdpagina `/` heeft haak naar `/spelen`. Landing draait `pickNext()` echt. SpelShell heeft persistent geluid-toggle. Span-spellen loggen `teMoeilijkN` + `autoLowerN`. Alle 5 spellen speelbaar met:
- Bloeiende plant + audio-chord op einde-scherm (Fase 12 — predictable celebration binnen research-rules §C.3)
- Trofeeën-strip met bereikte-dieren-cirkels + skin-niveau-tint (0-4) op root (Fase 11 — variatie mastery-getriggerd)
- Mijlpaal-pop 1.2s met character-entry-animatie

Admin toont KPI + 5 research-lenzen + per-spel detail + mijlpalen + cadeaus + JSON-tools. Fase 9 (pre-live QA + demo) en Fase 10 (5 nieuwe paradigma's) staan nog open.

**Volgende stap:** Fase 9 — pre-live QA + product-demo. Daarna optioneel Fase 10 als Alvah vrijwillig blijft komen (Go/No-Go, Tower of London, Posner, Flanker, DCCS — alle research-backed, plus skip-lijst voor zwakke evidence).

**Beslissingen vastgelegd in Fase 6.5:** A1=`cL-1`, A2=alleen-omhoog, B1=3 reversals, C1=hybride (2 in eerste 2min, anders 3), C2=alleen span-spellen, D1=hard, D2=2 van laatste 3, E1=14d/3s, F1=level-schema nu, F2=80%+trialsN≥24, F3=geen mid-sessie demotie. Zie `src/scripts/progressie.js`-header-comment.

**Snelle verificatie bij hervatten:**

```bash
node --test src/scripts/*.test.js    # verwacht: 80 pass, 0 fail
npx astro check                      # verwacht: 0 errors, 0 warnings, 0 hints
npm run check:tov:strict             # verwacht: 0 blokkerende hits
npm run dev                          # → /, /spelen, /spelen/reis, /spelen/admin + alle 5 spellen werken
```

**Wat er staat en wat niet:**

- `/spelen` (landing) toont Simon als aanbevolen-stub, 4 andere speelbare tegels (Zoeken, Corsi, Day-Night, Wisselen). Geen "binnenkort"-tegels meer.
- Alle 5 spel-routes zijn volledig speelbaar en loggen naar `localStorage` sleutel `alvah-ef-v1`:
  `/spelen/simon`, `/spelen/corsi`, `/spelen/day-night`, `/spelen/zoeken`, `/spelen/wisselen`.
- `/spelen/admin` toont per spel sparkline + tabel laatste 10 sessies, "deze week" KPI, JSON-copy/download/import, wis-alles met dubbele bevestiging.
- `/spelen/reis` toont 5 spellen × 4 mijlpalen-badges. Bereikte mijlpalen krijgen kleur + cirkel; nog-te-ontgrendelen blijven gestreept. Animatie-pop bij nieuw bereikt.
- `src/scripts/mijlpalen.js` bevat 20 mijlpalen (4 per spel) + `computeMilestones`/`isMilestoneReached`/`evalueerNieuwBereikt`. Drempel-types: `maxSpan`, `maxSetSize`, `accuracy`, `accuracy-at-level`, `level-min`, `switchCost-max`. `src/scripts/aanraden.js` heeft echte logica maar landing gebruikt nog de stub (default-volgorde). In Fase 8 kan de landing `pickNext()` écht gebruiken.
- Referentie-repo's zijn gekloond in `reference/` (gitignored, read-only via `chmod`). Beleid: uitsluitend leesbron, altijd zelf herschrijven. Zie §4.

**Gotchas:**

- BaseLayout heeft een client-side auth-gate (SHA-256 wachtwoord in sessionStorage). **Niet aanpassen** zonder expliciete opdracht van Floris.
- Regel 6 in CLAUDE.md: `reference/` is read-only, nooit bewerken / importeren / bundelen.
- `node --test` werkt met `.test.js` (niet `.test.mjs`) omdat `package.json` heeft `"type": "module"`.

**Niet verwarren met `docs/next-steps-plan.md`.** Dat document beschrijft Fase 6–11 voor de **dossier-kant** van de site (CI-checks, DocPage-refactor, onderhoudsgids, ToV-review van alle content). Die fases gaan over de hoofdsite `/dossier`, `/wetenschap`, etc. Dit document — `practice-games-plan.md` — gaat over de `/spelen`-subtree voor Alvah zelf. De nummer-overlap is historisch (beide plannen startten onafhankelijk bij eigen Fase-reeksen). Bewust niet hernoemd; hier gemarkeerd.

---

---

## 1. Waar bouwen we, voor wie

**Twee gebruikers, één dataset.**

- **Alvah** (7j): speelt kort (3–5 min), kiest zelf het spel, ziet zijn eigen groei.
- **Papa** (admin): leest dezelfde data, kopieert samenvattingen, plakt in LLM voor duiding.

**Routes (voorstel):**

```
/spelen                   ← kind-landing: 3 grote tegels, "Vandaag spelen"
/spelen/simon             ← spel 1
/spelen/corsi             ← spel 2
/spelen/day-night         ← spel 3
/spelen/zoeken            ← spel 4 (visual search)
/spelen/wisselen          ← spel 5 (task-switch)
/spelen/admin             ← papa: sparklines + JSON copy/export
```

Niet in de hoofdnavigatie. Bereikbaar via een grote tegel op `/` (alleen voor Alvah zichtbaar op moment dat papa hem dit laat gebruiken) en via directe URL voor admin.

**Waarom niet onder `/oefeningen`:** die pagina is de externe-interventies-catalogus (Kurzweil, Time Timer, judo, etc.) — andere doelgroep en andere datamodel. Mengen verwart.

---

## 2. CLAUDE.md — reeds bijgewerkt

CLAUDE.md is al aangepast: de blanket-beperkingen op `<script>`, `localStorage` en cookies zijn eruit. Nieuwe toestand:
- Regel 2: "Geen externe tracking, analytics of scripts van derden. Alle data blijft client-side."
- Regel 6 (nieuw): `reference/` is read-only, nooit bewerken of bundelen.
- Sectie "Toegestaan binnen /spelen": scripts in `/spelen` + `src/scripts`, `localStorage` onder sleutel `alvah-ef-v1`, Web Audio API.
- Sectie "Verboden" behoudt alleen echt externe dingen (trackers, pixels, third-party scripts, nieuwe dependencies, achternamen).

**Cookie vs localStorage:** jouw intuïtie was "cookie". In de praktijk wordt het `localStorage`: meer ruimte (5 MB i.p.v. 4 KB), niet meegestuurd in requests, JSON-natief. Eén Chromebook = één dataset. Admin toont de volledige JSON in een `<pre>`-blok met kopieer-knop, plus losse sparklines per spel — zo kun je het geheel in één keer in LLM plakken of selectief lezen.

---

## 3. Tonaliteit en visuele koers — "cool, niet kinderachtig"

Het research-document beveelt een rustig papier-palet aan (dyslexie-vriendelijk, PKU-vriendelijk, anti-verslaving). Dat blijft het fundament. "Fun en colourful" leggen we daar bovenop als **speelvlak-eigen subthema**, alleen actief binnen `/spelen/*`:

**Palet (bovenop bestaande tokens):**

| Token | Hex | Rol |
|---|---|---|
| `--spel-ink` | `#1a1a1a` | hergebruik bestaande `--ink` |
| `--spel-paper` | `#fdfcf8` | hergebruik `--paper` |
| `--spel-green` | `#1e4d32` | hergebruik `--green` (correct / primair) |
| `--spel-blue` | `#2b5fb8` | nieuw — Simon-blauw, "wisselen"-cue |
| `--spel-orange` | `#ef7a1f` | nieuw — Simon-oranje, aandacht |
| `--spel-magenta` | `#c94174` | nieuw — Simon-paneel 4, accent |
| `--spel-sun` | `#f5c23b` | nieuw — zon in Day-Night, badges |
| `--spel-glow` | `rgba(245,194,59,0.35)` | zachte gloed bij correct |

Kleur **altijd combineren met vorm** (cirkel/vierkant/driehoek/ruit) — kleurenblind- en dyslexie-safe. Gradients mogen (rustig, twee kleuren max, bv. `--spel-blue` → `--spel-magenta` voor achtergrond-headers) — niet "wild regenboog", wel iets dat voelt als een game en niet als dossier.

**Tonaliteit microcopy:**
- Framing: "superbrein-spelletjes", niet "oefenen" of "training".
- Score-taal: "je hoogste rij = 5" (feit), niet "LEVEL UP 🎉".
- Einde sessie: rustige "goed bezig!" + sparkline van laatste 10 dagen. Geen confetti, geen streaks-verlies-dreiging.
- Knoppen: grote ronde pill-buttons (16px radius), duidelijke schaduw, groot (minimaal 56px tap-target).
- Typografie in spellen: Fraunces voor cijfers/score, Inter Tight voor knoplabels. Body ≥20px.
- Eén rustig einde-animatie per sessie (groene vink + bloem die opengroeit, 600ms). Toggle-baar.

**Dingen die we bewust NIET doen:** confetti bij elk goed antwoord, variabele beloning (random surprise-drops), streaks met verliesaversie, leaderboard, levens, countdown-timers die alles verliezen bij missen.

**Onderbouwing:** Research §C.3 — Barkley toont versterkte dopamine-respons op onvoorspelbare beloning bij ADHD; Zendle & Cairns 2018 koppelt variabele-ratio-schema's aan gok-vatbaarheid; Deci & Ryan SDT laat zien dat externe surprise-beloning intrinsieke motivatie ondergraaft. Voor Alvah's ADHD-profiel is de evidence sterker dan voor neurotypisch.

**Wat wél mag (binnen research-rules):** voorspelbare celebration tied aan mastery — eindanimatie per sessie (vinkje + bloeiende plant, 1.5s), single audio-chord bij mijlpaal-unlock (zelfde elke keer per dier), character-animatie wanneer een nieuw dier verschijnt, subtiele growth-animaties op `/spelen/reis`. De regel: *predictable + mastery-anchored = OK; variable + per-trial = niet*.

---

## 4. Referentie-repo's — clonen als leesbron, clean-room herschrijven

**Fase 0 cloned** vier MIT-repo's naar `reference/` (gitignored, niet in bundle, niet in deploy):

**Status (apr 2026): gekloond en read-only gemaakt.**

| Repo | Licentie | Grootte | Relevante paden |
|---|---|---|---|
| `reference/jsPsych` | MIT (license.txt) | 33M | `packages/plugin-visual-search-circle`, `plugin-html-keyboard-response`, `plugin-image-keyboard-response`, `plugin-categorize-image`, `plugin-serial-reaction-time` |
| `reference/jspsych-contrib` | MIT (per plugin, in `package.json`) | 13M | `packages/plugin-corsi-blocks`, `plugin-flanker`, `plugin-tower-of-london`, `plugin-spatial-nback`, `plugin-stop-signal`, `plugin-trail-making`, `plugin-visual-search-click-target` |
| `reference/GoNoGo_jsPsych` | MIT (Teodóra Vékony, 2021) | 11M | `online/experiment.js`, `shared/{stimuli,parameters,statCalculation,languages}.js` |
| `reference/Nback_jsPsych` | MIT (Teodóra Vékony, 2021) | 10M | `online/experiment.js`, `shared/{createBlocks,stimuli,parameters,statCalculation}.js` |

**Direct na klonen toegepast:** `chmod -R a-w reference/` — alle bestanden read-only op filesystem-niveau. Refreshen later kan expliciet via `chmod -R u+w reference/<repo> && git -C reference/<repo> pull && chmod -R a-w reference/<repo>`.

**Bevindingen na verkenning — relevant voor plan:**

- **`plugin-visual-search-circle` zit in `core` jsPsych, niet in contrib** (research-doc had die locatie verkeerd). Voor ons "zoeken"-spel (fase 4) is dat de relevante referentie.
- **`plugin-tower-of-london` bestaat in contrib, MIT.** Research-doc dacht "geen rijpe standalone JS-repo, zelfbouw is overzichtelijk". Niet nodig dus — bij een eventuele latere ToL-fase hebben we een kant-en-klare leesbron.
- **`plugin-spatial-nback` bestaat in contrib, MIT.** Dat is de *visuospatiële* (non-verbale) n-back — precies wat we voor Alvah willen (dyslexie-safe). Als we ooit n-back toevoegen in een latere fase, is dit de referentie, niet de Kirchner verbal-versie van vekteo.
- **`plugin-stop-signal` bestaat in contrib, MIT.** Nuttig voor latere fases als we SST toevoegen (research zei "vanaf 8j").
- **vekteo-repo's hebben geen Nederlandse localisatie** (research-doc beweerde "al NL/FR/PT/ES/HU in zustertaken" — klopt niet voor GoNoGo en Nback zelf). Geen probleem, we schrijven `strings.nl.js` sowieso vanaf 0.
- **vekteo-structuur is schoon gescheiden** (`stimuli.js`, `parameters.js`, `statCalculation.js`, `normsinverz.js`). Deze scheiding volgen we in eigen architectuur: `parameters` → constanten per spel, `stimuli` → SVG/config, `statCalculation` → in `src/scripts/scoring.js`.
- **Per-plugin licenties in contrib staan in `package.json`, niet in een LICENSE-bestand.** Bij clean-room rewrite noteren we in een korte header-comment bovenaan ons spel-bestand: *"Paradigma-referentie: @jspsych-contrib/plugin-corsi-blocks, MIT. Onze implementatie is onafhankelijk geschreven."*

**Clean-room verplichting — hard.**

**Kernregel (behandel alle referentie-code als if-gebruik-verboden):** ongeacht of een licentie gebruik *wel* toestaat (zoals MIT hier), doen we alsof dat niet zo is. We gebruiken de repo's uitsluitend als *inspiratie en informatie over het paradigma* — nooit als sjabloon. Rewrite alles. Dat maakt onze policy robuust voor elke toekomstige referentie, ook die met GPL / proprietary / ongespecificeerde licentie.

Concreet voor elk paradigma dat we bouwen:

- **Niet copy-pasten, niet verfijnd overschrijven.** Lezen van regels code om "even de timing uit te pikken" is OK; die regel daarna overtypen in onze codebase is het niet. Schrijf vanaf de *beschrijving* van het paradigma.
- **Herschrijven in drie stappen:**
  1. lees het paradigma in het research-doc (BLOK B) + de originele wetenschappelijke bron (bv. Gerstadt, Hong & Diamond 1994 voor Day-Night, Kessels et al. 2000 voor Corsi);
  2. bekijk in de referentie-repo hoe bepaalde details zijn opgelost (timings, staircase-stap, trial-volgorde) — als *informatiebron*, niet als *sjabloon*;
  3. sluit het referentie-bestand, en schrijf vanaf nul in eigen woorden, eigen functies, eigen variabelen, eigen structuur. Als je merkt dat je vast zit omdat je naar de referentie wilt kijken → dat is het signaal dat je de beschrijving nog niet goed genoeg snapt, niet dat je mag copy-pasten.
- **Andere programmeertaal of idioom is expliciet toegestaan en vaak gewenst.** jsPsych is TypeScript-klassen met plugin-architectuur; wij schrijven vanilla JS in Astro `<script>`-blokken met plain functies. Die vertaalstap is op zichzelf al clean-room — letterlijk overnemen is onmogelijk want de doelidiomatiek is totaal anders. Waar helderheid het nóg sterker scheidt (bv. scoring-logica in pure functies in `src/scripts/*.js` los van UI), doen we dat.
- **Testbaarheid als extra muur.** `scoring.js`, `staircase.js`, `timer.js` zijn pure modules zonder DOM-koppeling, gedekt door unit-tests (`node --test`). Dat dwingt expressie in eigen idiomatiek en maakt diefstal vrijwel onmogelijk.
- **Nooit importeren of bundelen.** Niks uit `reference/` mag in een `import`-statement, niks mag in `public/`, niks mag in de Astro-bundle terechtkomen. Als iemand (mens of Claude Code) dit probeert → hard stop.
- **Korte attribution-comment** bovenaan elk spel-bestand: *"Paradigma-referentie: [bron + paper]. Code onafhankelijk geschreven op basis van paradigma-beschrijving."* Niet omdat MIT het eist (voor niet-overgenomen code eist het niks), maar om onszelf en toekomstige lezers te herinneren waar de conceptuele inspiratie vandaan kwam.

**CLAUDE.md-regel 6** (reeds doorgevoerd) dekt dit: *"`reference/` is read-only leesbron. Nooit bewerken, importeren of bundelen — altijd zelf herschrijven."* De regel werkt licentie-agnostisch en blijft kloppen als we in de toekomst repo's met andere licenties toevoegen.

---

## 5. Architectuur (één keer goed, daarna herbruiken)

```
src/
  layouts/
    BaseLayout.astro         ← bestaat
    SpelShell.astro          ← NIEUW: header + pauze + te-moeilijk + luidspreker
  scripts/                   ← NIEUW
    storage.js               ← load/save/migrate + saveSession
    timer.js                 ← performance.now() + rt()
    scoring.js               ← mean/sd/iivCV/summarize
    staircase.js             ← 2-down/1-up herbruikbaar
    audio.js                 ← Web Audio tonen + TTS-fallback
    strings.nl.js            ← centrale NL-copy
  styles/
    global.css               ← bestaat
    spelen.css               ← NIEUW: tokens + shell + knoppen + animaties
  pages/
    spelen/
      index.astro            ← kind-landing
      simon.astro            ← fase 1
      corsi.astro            ← fase 2
      day-night.astro        ← fase 3
      zoeken.astro           ← fase 4
      wisselen.astro         ← fase 5
      admin.astro            ← fase 6
docs/
  practice-games-plan.md     ← dit bestand
  practice-games-schema.md   ← JSON-schema voor localStorage (fase 0)
```

**localStorage-schema** (exact één sleutel `alvah-ef-v1`, versiebeheer via `schemaVersion`):

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-04-22T10:00:00Z",
  "preferences": { "sound": true, "reducedMotion": false, "textSize": "large" },
  "exercises": {
    "<id>": {
      "currentLevel": 3,
      "highestLevel": 4,
      "sessions": [
        { "id": "...", "date": "...", "level": 3, "durationMs": 214000,
          "trials": [{ "i": 1, "span": 3, "resp": "correct", "rt": 2100 }],
          "summary": { "accuracy": 0.88, "meanRT": 2280, "sdRT": 340, "iivCV": 0.15, "trialsN": 12, "maxSpan": 4 }
        }
      ]
    }
  }
}
```

**Auto-prune** (voorkomt localStorage-overflow): max 20 sessies per spel, volledige trial-array alleen voor laatste 10; oudere sessies alleen `summary`.

---

## 6. Fasering — elk blok = één Claude Code-run

Elke fase eindigt in een commit, werkende pagina, en geen wijzigingen buiten de genoemde bestanden. Fase 0 moet éérst af; fases 1–5 kunnen daarna in vrije volgorde (aanbevolen volgorde: engagement-first).

### Fase 0 — Fundament + referentie-repo's — ✅ KLAAR (22 apr 2026)

**Gebouwd en geverifieerd:**

| Onderdeel | Bestand(en) | Status |
|---|---|---|
| Referentie-repo's | `reference/{jsPsych,jspsych-contrib,GoNoGo_jsPsych,Nback_jsPsych}/` | ✓ gekloond, `chmod -R a-w`, `.gitignore`-d |
| CLAUDE.md-regels | `CLAUDE.md` §6 + "Toegestaan binnen /spelen" | ✓ doorgevoerd |
| localStorage-schema | `docs/practice-games-schema.md` | ✓ gedocumenteerd |
| Timer | `src/scripts/timer.js` | ✓ `now()`, `rt()` |
| Scoring | `src/scripts/scoring.js` + `scoring.test.js` | ✓ `mean`, `sd`, `iivCV`, `summarize` — 5/5 tests |
| Staircase | `src/scripts/staircase.js` + `staircase.test.js` | ✓ 2-down/1-up — 6/6 tests |
| Aanrader | `src/scripts/aanraden.js` + `aanraden.test.js` | ✓ niet-herhalen + staleness + succes-bias + fallback — 5/5 tests |
| Mijlpalen | `src/scripts/mijlpalen.js` | ✓ stub (drempels leeg — vullen in fase 7) |
| Storage | `src/scripts/storage.js` | ✓ load/save/migrate + saveSession + prune + export/import + clearAll |
| Audio | `src/scripts/audio.js` | ✓ Web Audio `tone()` + `speechSynthesis` `say()`, respecteert `sound`-pref |
| NL-strings | `src/scripts/strings.nl.js` | ✓ centrale copy, toon: feit-taal, geen hype |
| Speelvlak-CSS | `src/styles/spelen.css` | ✓ `--spel-blue/orange/magenta/sun/glow` + hero-gradient + tegels + knoppen + shell |
| Game-shell-layout | `src/layouts/SpelShell.astro` | ✓ wrapt BaseLayout, header (terug + titel + voorleesknop), pauze + te-moeilijk events |
| Landing | `src/pages/spelen/index.astro` | ✓ hero ("Vandaag" — pickNext op load), 4 andere tegels (binnenkort), links naar reis/admin |

**Verificatie:**
- `node --test src/scripts/*.test.js` → **16 pass, 0 fail**
- `npx astro check` → **0 errors, 0 warnings, 0 hints**
- Dev-server HTTP 200 op `/`, `/spelen`, `/oefeningen`
- Gerenderde HTML bevat: Simon, Zoeken, Corsi, Dag & Nacht, Wisselen, "Vandaag", "Andere spellen", "Binnenkort"

**Keuzes tijdens uitvoering (afwijkingen t.o.v. oorspronkelijk plan, klein):**
- Tests als `.test.js` (niet `.test.mjs`) — `package.json` heeft `"type": "module"`, dus ESM werkt al.
- `SpelShell.astro` wrapt `BaseLayout.astro` (krijgt gate, nav, footer "gratis") in plaats van naast BaseLayout te staan.
- Landing-pagina gebruikt `BaseLayout` direct (niet SpelShell), want de landing is geen spel — SpelShell is voor game-pagina's vanaf fase 1.
- Pauze-knop en "te-moeilijk"-knop in SpelShell dispatchen `CustomEvent`s (`spel:pauze`, `spel:te-moeilijk`) zodat toekomstige game-scripts eenvoudig kunnen haken.
- Alle 5 tegels staan nu als `.spel-tegel--binnenkort` (disabled). Zodra een spel speelbaar is, wordt de modifier verwijderd en wordt de `<article>` een `<a href="/spelen/<id>">`.

### Fase 1 — Simon-patroon — ✅ KLAAR (22 apr 2026)

**Gebouwd:**
- `src/pages/spelen/simon.astro` — nieuw, compleet spel in één bestand (template + scoped CSS + TS-script).
- `src/scripts/strings.nl.js` — Simon-subblok uitgebreid (`uitleg`, `kijkGoed`, `jouwBeurt`, `goed`, `ietsKorter`, `hoogsteRij`, `eindeCap`).
- `src/pages/spelen/index.astro` — Simon nu speelbaar: hero-CTA is actieve link naar `/spelen/simon`. 4 andere tegels blijven `.spel-tegel--binnenkort`. `SPEELBAAR`-set makkelijk uitbreidbaar per volgende fase.

**Spel-mechanica (clean-room implementatie):**
- 4 panelen in 2×2 grid: groen (330 Hz, ●), blauw (392 Hz, ■), oranje (494 Hz, ▲), magenta (587 Hz, ◆). Toonhoogtes E4/G4/B4/D5 — geen dissonantie in elke combinatie.
- Sequentie-weergave: 600 ms flash + 200 ms gap per item. Paneel krijgt `is-aktief` (brightness + box-shadow-gloed) + audio.tone().
- Gebruiker tikt. Eerste-tik-RT gemeten via `timer.now()` vanaf einde sequentie. Per trial gelogd: `{ i, span, correct, rt }`.
- Correct → `span++`, nieuwe sequentie. Fout → retry-scherm. "Nog een keer" → `span = max(2, span-1)`. Cap 9; sessie max 4 min.
- Einde-scherm: `hoogsteRij`, `X / Y correct`, sparkline van laatste 10 sessies (SVG polyline, alleen bij ≥2 sessies, uit-zetbaar via `sparklineInEinde` preference).
- SpelShell-events: `spel:te-moeilijk` → `span--` + nieuwe trial; `spel:pauze` → `endSession()` als er trials zijn, anders naar `/spelen`.

**A11y / research-regels:**
- `prefers-reduced-motion`: `filter` en `box-shadow` uit; in plaats daarvan `outline` in `--spel-sun` bij `is-aktief` — nog steeds goed zichtbaar, geen animatie.
- Kleur + vorm samen (cirkel/vierkant/driehoek/ruit) — kleurenblind-safe.
- Geen countdown, geen confetti, geen variabele beloning. "Nog een keer" is neutraal. Feedback is `NL.spel.simon.goed` / `.ietsKorter`, geen "KANJER!".
- Elke paneel-knop heeft `aria-label` met kleur + vorm.

**Verificatie:**
- `node --test src/scripts/*.test.js` → 16 pass, 0 fail (Simon heeft geen eigen unit-test — logica zit in Astro-script, niet in een pure module; de gebruikte modules — scoring, staircase, storage, audio, timer — zijn wel gedekt).
- `npx astro check` → 0 errors, 0 warnings, 0 hints.
- Dev-server HTTP 200 op `/spelen` en `/spelen/simon`.
- Gerenderde HTML bevat: 4 panelen met juiste kleuren + vormen, 4 schermen (start/spelen/retry/einde), instructie-tekst, data-simon-root.

**Gebruikt paradigma-referentie:** klassiek Simon-speelgoed (Milton Bradley 1978). Geen jsPsych-plugin bestond hiervoor — implementatie volledig onafhankelijk.

### Fase 2 — Corsi Block Tapping — ✅ KLAAR (24 apr 2026)

**Gebouwd:**
- `src/pages/spelen/corsi.astro` — nieuw, compleet spel in één bestand (template + scoped CSS + TS-script).
- `src/scripts/strings.nl.js` — Corsi-subblok uitgebreid (`uitleg`, `kijkGoed`, `jouwBeurt`, `goed`, `ietsKorter`, `hoogsteRij`, `eindeCap`).
- `src/pages/spelen/index.astro` — Corsi toegevoegd aan SPEELBAAR-set (zowel server-side als client-side).

**Spel-mechanica (clean-room implementatie):**
- 9 SVG-polygon-sterren op vaste, onregelmatige posities in 400×400 viewBox (asymmetrisch — voorkomt ruimtelijke patronen, Corsi-traditie).
- Staircase 2-down/1-up via `src/scripts/staircase.js` (reeds aanwezig). Start span 2, cap 9.
- Sequentie-weergave: 500 ms pre-stim, 900 ms flash + 250 ms gap per item. Fill switcht naar `--spel-sun` + `drop-shadow`-gloed. Pentatoniek-tonen 262..587 Hz per positie.
- Gebruiker klikt; eerste tik start RT-meting. Correct → staircase.stepTrial(true), volgende trial. Fout → retry-scherm + staircase naar beneden.
- Sessie: max 12 trials of 4 min. Trial-log: `{ i, span, correct, rt, sequence, response }`.
- Einde-scherm: `maxSpan`, X/Y correct, sparkline in `--spel-magenta`.
- Geen twee opeenvolgende posities gelijk (realistische Corsi-sequentie; positie-herhaling binnen één sequentie wél toegestaan, niet direct na elkaar).

**A11y / research-regels:**
- `prefers-reduced-motion`: `filter` en `drop-shadow` uit, in plaats daarvan SVG `stroke` in `--spel-sun` bij `is-aktief`.
- Sterren hebben `role="button"` + `aria-label="Ster N"`.
- Geen countdown, geen confetti. Feedback "Juist" / "Oké, iets korter" — feit-taal.

**Verificatie:** `node --test` → 16/16 pass, `npx astro check` → 0 errors/warnings/hints, HTTP 200 op `/spelen/corsi`, paradigma-referentie-comment in bestand-header.

**Gebruikt paradigma-referentie:** Corsi 1972 + Kessels et al. 2000. `@jspsych-contrib/plugin-corsi-blocks` (MIT) als informatiebron over timing en interactie-volgorde — alleen `docs/jspsych-corsi-blocks.md` gelezen, niet `src/index.ts`.

### Fase 3 — Day-Night Stroop — ✅ KLAAR (24 apr 2026)

**Gebouwd:**
- `src/pages/spelen/day-night.astro` — nieuw, compleet spel in één bestand.
- `src/scripts/strings.nl.js` — `day-night`-subblok uitgebreid (`uitleg`, `dag`, `nacht`, `klaarVoor`, `goed`, `bijnaGoed`, `rondeVan`).
- `src/pages/spelen/index.astro` — Day-Night toegevoegd aan SPEELBAAR-set.

**Spel-mechanica (clean-room implementatie, volledig onafhankelijk):**
- Stimulus: zon (gele cirkel + stralen, SVG) of maan (SVG-path). Fill via `--spel-sun` en `#e9e9ef`.
- Twee grote knoppen: "Dag" (zon-kleurig) en "Nacht" (nachtblauw). Stroop-regel: zon → zeg NACHT, maan → zeg DAG.
- 3 blokken × 16 trials = 48 totaal. Blok 1–2 = mixed stimulus-ratio, blok 3 = puur incongruent (afwijking t.o.v. klassieke 16-trial Gerstadt: we geven meer data per sessie, met lichte mode-escalatie).
- Stimulus-achtergrond switcht "day-mode" (warm geel) ↔ "night-mode" (nachtblauw gradient) om de Stroop-conflict visueel te versterken.
- Feedback: 500 ms `is-correct` / `is-fout` ring (gloed vs rood), daarna 300 ms ITI.
- Trial-log: `{ i, blok, mode, stimulus, expected, response, correct, rt }`.
- Einde-scherm: correct/total, accuracy %, gem. RT, sparkline in `--spel-sun`.

**A11y / research-regels:**
- Kleur + label + positie (knoppen staan links/rechts en zijn grafisch geplaatst) — kleurenblind-safe.
- `aria-live="polite"` op statusregel voor "Juist"/"Andersom".
- Geen countdown, geen tijdsdruk per trial.
- Feedback is rustig ("Juist" / "Andersom"), geen hypetaal.

**Verificatie:** `node --test` → 16/16, `npx astro check` → 0 errors, HTTP 200 op `/spelen/day-night`.

**Gebruikt paradigma-referentie:** Gerstadt, Hong & Diamond 1994. Geen jsPsych-plugin-equivalent gebruikt — implementatie volledig onafhankelijk geschreven.

### Fase 4 — Visual Search / Zoek de kikker — ✅ KLAAR (24 apr 2026)

**Gebouwd:**
- `src/pages/spelen/zoeken.astro` — nieuw, compleet spel in één bestand.
- `src/scripts/strings.nl.js` — `zoeken`-subblok uitgebreid (`uitleg`, `jouwBeurt`, `goed`, `fout`, `setSize`).
- `src/pages/spelen/index.astro` — Zoeken toegevoegd aan SPEELBAAR-set.

**Spel-mechanica (clean-room implementatie):**
- SVG-veld 400×400, `<symbol id="kikker-icon">` met ogen + pootjes, vullen via `color`-attribuut op `<use>` elementen — één doel-kikker in `--zoek-target` (rood), distractors in `--zoek-distractor` (groen).
- Jittered-grid-layout: verdeelt N posities over √N × ceil(N/√N) rasters met random jitter per cel, geshuffled. Voorkomt clustering en overlap.
- Staircase 2-down/1-up via `src/scripts/staircase.js`. Set-size range 4..16, start 6.
- Sessie: max 16 trials of 3 min. Trial-log: `{ i, setSize, correct, rt, falseAlarms, targetIdx }`.
- False-alarm-logica: klik op distractor = fout-feedback (rode ring 350 ms) maar trial blijft open. Na 3 false-alarms sluit trial als incorrect. Klik target = correct, staircase stapt.
- Einde-scherm: correct/total, `maxSetSize`, gem. RT, sparkline in `--spel-orange`. Summary bevat `maxSetSize` + `falseAlarmsTotal`.

**A11y / research-regels:**
- Kleur + positie (rode kikker heeft pop-out kleur-verschil met groene — Treisman feature-search). Kleurenblind-safe? Rood/groen is klassiek lastig voor deuteranopie. Voor nu acceptabel: Alvah heeft geen kleurenblindheid volgens dossier; bij latere uitbreiding naar conjunction-search (Fase 7/8) vorm-verschil toevoegen.
- `aria-label` per kikker ("Rode kikker"/"Groene kikker"), `role="button"`.
- Geen countdown; sessie-limiet op tijd.
- Hover-scale 1.08 disabled onder `prefers-reduced-motion`.

**Afwijkend t.o.v. plan:** het plan noemt 3 unlock-niveaus (feature → conjunction → bewegend). Voor nu alleen niveau 1 (feature) gebouwd — de staircase loopt over set-size binnen één mode. Conjunction + bewegend komen bij Fase 7 (mijlpalen) waar unlocks thuishoren. `highestLevel` in storage tracked `maxSetSize` als proxy.

**Verificatie:** `node --test` 16/16, `npx astro check` 0 errors, HTTP 200 op `/spelen/zoeken`.

**Paradigma-referentie:** Treisman & Gelade 1980 (feature-integration theory). `@jspsych/plugin-visual-search-circle` (MIT, core jsPsych) als informatiebron — alleen plugin-docs geraadpleegd. Posities hier op jittered-grid i.p.v. cirkel.

### Fase 5 — Cued Task-Switching — ✅ KLAAR (24 apr 2026)

**Gebouwd:**
- `src/pages/spelen/wisselen.astro` — nieuw, compleet spel in één bestand met 4 schermen (start, blok-intro, spelen, einde).
- `src/scripts/strings.nl.js` — `wisselen`-subblok uitgebreid (cue-labels, blok-titels/uitleg, instructies, feedback).
- `src/pages/spelen/index.astro` — Wisselen toegevoegd aan SPEELBAAR-set.

**Spel-mechanica (clean-room implementatie):**
- Bivalente stimuli: 2 kleuren (rood/blauw) × 2 vormen (vierkant/cirkel) = 4 stimulus-combinaties. SVG rect of circle, gevuld met stimulus-kleur.
- Vaste mapping: kleur-taak → rood=links, blauw=rechts. Vorm-taak → vierkant=links, cirkel=rechts. Bivalent betekent: sommige trials (bv. rood vierkant) hebben dezelfde correcte response ongeacht taak; andere (rood cirkel, blauw vierkant) zijn incongruent.
- Cue ("Kleur" / "Vorm") verschijnt eerst; stimulus 400 ms later (standaard cue-stimulus-interval). Response: 2 grote knoppen "← Links" / "Rechts →".
- 3 blokken × 12 trials = 36 totaal:
  - Blok 1 "Alleen kleur" (pure-kleur)
  - Blok 2 "Alleen vorm" (pure-vorm)
  - Blok 3 "Afwisselen" — AABB-patroon (K,K,V,V,K,K,...) zodat switch- en repeat-trials ongeveer 50/50 zijn en voorspelbaar.
- Blok-intro-scherm tussen blokken zodat Alvah pauze krijgt + nieuwe regel ziet.
- Feedback 450 ms (gloed-ring correct of rode ring fout) + 250 ms ITI.
- Trial-log: `{ i, blok, taak, kleur, vorm, expected, response, correct, rt, isSwitch }`.
- **Switch-cost** in summary: `mean(RT van correcte switch-trials in blok 3) − mean(RT van correcte repeat-trials in blok 3)`, afgerond in ms. Zichtbaar op einde-scherm en gelogd in `summary.switchCost`.

**A11y / research-regels:**
- Kleur + vorm gecombineerd — kleurenblind-safe.
- Cue + uitleg in duidelijke talen; cue-paneel in `--green-soft` met `--green` tekst.
- `aria-live="polite"` op status voor "Juist"/"Andersom".
- Geen countdown, geen tijdsdruk.
- Rustige feedback-kleuren, geen hype.

**Verificatie:** `node --test` 16/16, `npx astro check` 0 errors, HTTP 200 op `/spelen/wisselen`.

**Paradigma-referentie:** Rogers & Monsell 1995 (task-switching paradigm); Karbach & Kray 2009 (kindertraining evidence). Geen jsPsych-plugin gebruikt — implementatie volledig onafhankelijk.

### Fase 6 — Admin-pagina — ✅ KLAAR (24 apr 2026)

**Gebouwd:**
- `src/pages/spelen/admin.astro` — nieuw, gebruikt `BaseLayout` direct (geen SpelShell — geen spel, maar een lees-pagina).
- `src/scripts/strings.nl.js` — `admin`-subblok toegevoegd (alle UI-copy).

**Mechanica:**
- **KPI "Deze week":** loopt door alle sessies binnen 7 dagen, telt totaal minuten (0.1-precisie onder 10 min, afgerond boven) en aantal sessies.
- **Per spel-kaart** (5 kaarten: Simon, Corsi, Day-Night, Zoeken, Wisselen):
  - Header-meta: `niveau X · hoogst Y · N sessies`.
  - Sparkline: laatste 20 sessies. X-as = sessie-index, Y-as = `maxSpan` (Simon/Corsi) of `accuracy` (Day-Night/Zoeken/Wisselen). Kleur per spel: Simon blauw, Corsi magenta, Day-Night zonne-geel, Zoeken oranje, Wisselen groen.
  - Tabel laatste 10 sessies: datum (NL-format), niveau, duur (s), accuracy %, gem. RT.
  - Lege-staat: "Nog geen sessies gespeeld.".
- **Data-knoppen:**
  - "Kopieer JSON" → `navigator.clipboard.writeText`. Fallback bij permission-fout → hint om te downloaden.
  - "Download JSON" → Blob + anchor-click, bestandsnaam `alvah-ef-v1-YYYY-MM-DD.json`.
  - "Importeer JSON" → file-input → `importJSON()` in storage.js → re-render. Foutafhandeling voor ongeldige JSON.
  - "Wis alles" → dubbele `confirm()` voor Floris-proof, dan `clearAll()` + re-render.
- **JSON-preview:** collapsed `<details>` met volledige `<pre>` van `exportJSON()`. Lees-only, refresht bij elke re-render.
- Feedback-regel ("Gekopieerd", "Geïmporteerd", "Gewist", "Ongeldige JSON") verdwijnt na 4s.

**Verificatie:** HTTP 200 op `/spelen/admin`, 4 data-actie-knoppen (kopieer/download/importeer/wis), `BaseLayout` geeft gate + footer.

**Plan zei:** "Admin-pagina (fase 6) tussen fase 2 en fase 3: zodra er data van twee spellen is, is het nuttig om te kunnen lezen." In de praktijk meegenomen in dezelfde run als Fase 2 én 3 — admin werkt nu voor alle 3 de speelbare spellen + toont lege kaarten voor Zoeken/Wisselen.

### Fase 6.5 — Progressie & adaptatie aan niveau — ✅ KLAAR (24 apr 2026)

**Antwoorden op de 11 open vragen, gerealiseerd:** A1=`currentLevel-1` warm-up, A2=alleen-omhoog, B1=3 reversals (minder = "verkennend"), C1=3 op rij / 2 in eerste 2 min, C2=alleen span-spellen, D1=hard, D2=2 van laatste 3, E1=14d/3s, F1=level-schema nu vastgelegd, F2=80% + trialsN≥24, F3=geen mid-sessie demotie.

**Gebouwd:**
- `src/scripts/progressie.js` (nieuw, 170 regels pure module): `seedLevel`, `computeSessionLevel`, `shouldAutoLower`, `isReliableSession`, `detectPlateau`, `dnConfig`/`nextLevelDayNight`, `wisConfig`/`nextLevelWisselen`, `countRecentAtOrAbove` (Fase 7-bouwsteen).
- `src/scripts/progressie.test.js` (nieuw, 22 tests pass): dekt alle 7 functies met fixture-sessies.
- `src/scripts/staircase.js` (patch): exposet `reversals[]` en `direction`, volledig backward-compatible (bestaande 6 tests blijven pass).
- `src/scripts/storage.js` (patch): `saveSession` past currentLevel/highestLevel nu alleen aan bij geldige sessies én alleen omhoog. Niet-geldige sessies worden opgeslagen voor admin-zicht, maar updaten geen level.
- `src/pages/spelen/simon.astro` (patch): `startSession` gebruikt `seedLevel()` in plaats van `MIN_SPAN`. Geen shouldAutoLower (retry-flow dekt dit al).
- `src/pages/spelen/corsi.astro` (patch): seedLevel bij start, shouldAutoLower na foute trial, computeSessionLevel(reversals) voor `session.level` bij endSession.
- `src/pages/spelen/zoeken.astro` (patch): idem — seed, auto-lower na elke trial, reversal-based session-level.
- `src/pages/spelen/day-night.astro` (patch): BLOKKEN en TRIALS_PER_BLOK dynamisch uit `dnConfig(nextLevelDayNight(sessions))`; `session.level` = cross-session speelLevel.
- `src/pages/spelen/wisselen.astro` (patch): BLOKKEN + switchPatroon (AABB vs ABAB) dynamisch uit `wisConfig(nextLevelWisselen(sessions))`; ABAB-patroon toegevoegd aan trial-taak-bepaling.
- `src/pages/spelen/admin.astro` (patch): plateau-banner per spel met `detectPlateau()` (14d / 3 sessies). Oranje border-left, rustige tekst "Hangt op niveau X, al Y dagen".

**Day-Night niveaus:**
- L1: 2 mixed (32 trials)
- L2: 2 mixed + 1 incongruent (48 trials) — wat eerst vast was
- L3: 1 mixed + 2 incongruent (48 trials)
- L4: gereserveerd (afleiders), `nextLevelDayNight` capt op 3 totdat Fase 7 dit activeert.

**Wisselen niveaus:**
- L1: pure-kleur (12 trials)
- L2: pure-kleur + pure-vorm (24 trials)
- L3: pure-kleur + pure-vorm + switch-AABB (36 trials) — wat eerst vast was
- L4: pure-kleur + pure-vorm + switch-ABAB (36 trials, elke trial wisselt)

**Migratie bestaande data:** Alvah's eventueel al gespeelde DN/Wisselen-sessies worden opnieuw geëvalueerd bij elke sessie-start: `nextLevelDayNight(sessions)` loopt door alle sessies en bouwt level van 1 af op. Oude sessies met `level = blokIdx + 1` (oud schema) worden geïnterpreteerd als lagere levels; de nieuwe promotie-detectie trekt het opnieuw op.

**Verificatie:** `node --test` 38/38 (16 oud + 22 nieuw), `npx astro check` 0 errors/warnings/hints, HTTP 200 op alle 7 /spelen-routes, ToV-strict 0 blokkers.

<details>
<summary>Oorspronkelijke scope-beschrijving (Fase 6.5 pre-implementatie)</summary>

**Waarom nu, vóór Fase 7:** mijlpalen (Fase 7) hangen af van "wat telt als geldige sessie" en hoe `currentLevel` over sessies stabiliseert. Zonder expliciete progressie-regels worden mijlpaal-drempels willekeurig — Alvah haalt ze op een goede dag, verliest ze nooit (terecht), maar het systeem leert niet of dit "echte" groei is.

**Doel:** kruis-snijdende beslissingen over hoe niveau zich tussen sessies verplaatst, vastgelegd in één pure module + kleine patches in de 5 spel-bestanden + admin.

**Diagnose huidige stand:**

- `currentLevel` wordt opgeslagen in [storage.js:83](../src/scripts/storage.js#L83) maar nergens teruggelezen. Elke sessie start hardcoded laag (Simon `MIN_SPAN`, Corsi staircase-init, Zoeken set-size 6).
- "Te-moeilijk"-knop is manueel. Geen auto-detectie van frustratie; een 7-jarige drukt zo'n knop zelden uit zichzelf.
- Day-Night en Wisselen hebben vaste blok-design — geen pad waar `currentLevel` betekenis heeft.
- IIV-CV wordt gemeten in `summarize()`, nergens gebruikt voor beslissingen.
- Eindspan van een sessie kan ruis zijn (laatste trial toevallig fout) en bepaalt nu blijvend `currentLevel`.

**Zes onderdelen:**

#### A. Seed-regel voor start-niveau (per spel)

Default: bij sessie-start `start = max(MIN, currentLevel - 1)` voor adaptieve spellen (Simon, Corsi, Zoeken). Eén warm-up-stap onder current geeft Alvah een succes-trial bij binnenkomst, daarna stijgt de staircase snel terug.

| Spel | MIN | Default-start zonder data |
|---|---|---|
| Simon | 2 | 2 |
| Corsi | 2 | 2 |
| Zoeken | 4 (set-size) | 6 |

**Open vraag A1:** start op `currentLevel` (geen warm-up, sneller bij niveau) of `currentLevel - 1` (warm-up, één trial verlies)? Voorkeur Claude: `-1`, omdat eerste trial bij koude start vaak ruis is.

**Open vraag A2:** moet `currentLevel` dalen als hij een sessie slecht speelt, of alleen stijgen? Nu daalt hij ([storage.js:83](../src/scripts/storage.js#L83) zet `currentLevel = session.level`). Risico: één slechte dag verlaagt zijn start blijvend. Alternatieven: (a) `currentLevel = max(currentLevel, session.level)` — alleen omhoog, (b) glijdend gemiddelde over laatste 3 geldige sessies, (c) huidige logica behouden. Voorkeur Claude: (b), maar dat is kind-pedagogisch niet kortweg te beargumenteren.

#### B. Stop-criterium per sessie

Nu: max trials of max tijd. Geen reversal-criterium → de eindspan kan ruis zijn.

Voorstel: registreer reversals expliciet in de staircase-output, en bereken `session.level` als **mediaan-span van de laatste 3 reversals**, niet als eind-span van de laatste trial. De staircase-logica kent reversals al intern; we exposen ze.

**Open vraag B1:** hoeveel reversals voor een betrouwbare schatting? Klassieke psychofysica zegt 6–8; voor een kind van 7 binnen 4 min is dat te lang. Voorkeur Claude: minimaal 3 reversals — anders geldt de sessie als "verkennend" (telt niet voor `currentLevel`-update, wordt wel opgeslagen voor admin-zicht).

#### C. Auto "te-moeilijk"-trigger

Nu: alleen manuele knop. Een 7-jarige drukt die zelden — frustratie uit zich eerder in stoppen of slordig klikken.

Voorstel: bij **3 fouten op rij** automatisch span-1 + korte rustige cue ("Even iets makkelijker, gaat goed"). Geen knop-druk nodig. De staircase doet dit nu al stap voor stap (1 fout = stap omlaag); deze trigger zit *bovenop* en daalt sneller bij echte stress.

**Open vraag C1:** 3 fouten op rij, of 2? 3 voorkomt onnodig zachtzinnig zijn; 2 reageert sneller op echt overvraag. Voorkeur Claude: 3, behalve in eerste 2 minuten van sessie waar 2 al genoeg is (warming-up vs. echte uitputting).

**Open vraag C2:** ook voor Day-Night en Wisselen, of alleen voor span-spellen? Daar zijn "fouten op rij" minder informatief (bivalent design — incongruente trials zijn inherent moeilijker).

#### D. Welke sessies tellen voor `currentLevel`-update én mijlpaal-progressie

Een sessie van 2 trials zou geen mijlpaal mogen unlocken. Een sessie met IIV-CV van 0.9 (gokkend tikken) ook niet.

Voorstel: een sessie is "geldig" als:

- `trialsN >= 6` (Simon/Corsi/Zoeken: minimaal 6 trials gespeeld)
- `iivCV <= 0.6` (uitsluiten van puur-gokken-sessies; klassiek geldt 0.5 als bovengrens voor "consistent kind", 0.6 geeft kind-marge)
- Niet de eerste sessie ooit voor dat spel (kalibratie-vrije zone)

Niet-geldige sessies blijven opgeslagen voor admin-zicht, maar updaten `currentLevel`/`highestLevel` niet en tellen niet voor mijlpaal-drempels.

**Open vraag D1:** hard of zacht? Hard = sessie telt of telt niet. Zacht = sessie krijgt gewicht (1.0 schoon, 0.5 matig, 0.0 onbruikbaar) in glijdend gemiddelde. Voorkeur Claude: hard, want mijlpaal moet eenduidig zijn ("3× span 5 gehaald" is helder; "3 sessies à gewicht 0.7 = 2.1, dus net niet" is ondoorgrondelijk voor papa én kind).

**Open vraag D2:** drempel voor mijlpaal-unlock: "1× gehaald", "2 van laatste 3", "3× ooit"? §6 Fase 7 zegt nu "Corsi span 5 drie keer gehaald → LEGO-set" — dus impliciet "3× ooit". Vastleggen voordat de drempels in `mijlpalen.js` komen. Voorkeur Claude: **2 van laatste 3 geldige sessies** — herhaalbaarheid bewijst stabiliteit, "3× ooit" zou kunnen sluiten op drie goede dagen verspreid over maanden.

#### E. Plateau-detectie

Als `highestLevel` 14 dagen niet stijgt voor een spel waar Alvah wel actief in is (≥3 sessies in die periode): admin-banner "Alvah hangt op Corsi span 4 — overweeg variant of pauze".

Geen actie naar Alvah zelf — plateau-feedback hoort bij papa, niet bij kind. Het is signaal voor menselijk overleg, geen automatische game-aanpassing.

**Open vraag E1:** drempel 14 dagen + 3 sessies, of strenger? Bij Alvah's tempo (2-3× per week) is 14d ≈ 6 sessies. Strenger (7d / 3 sessies) geeft meer false positives; ruimer (21d) is laat. Voorkeur Claude: 14d / 3 sessies als startpunt, herzien na eerste twee echte plateau-banner-momenten in de praktijk.

#### F. Day-Night & Wisselen cross-session progressie

Deze paradigma's hebben nu **geen** `currentLevel` met betekenis (alleen accuracy). Voorstel: introduceer 4 niveaus per spel als blok-configuratie, parallel aan de 4 mijlpaal-unlocks (Fase 7).

| Spel | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| Day-Night | 2 blokken mixed | 3 blokken (1 incongruent) | 3 blokken (2 incongruent) | 3 blokken + intermitterende afleider-stimuli |
| Wisselen | Pure kleur óf vorm | Pure + AABB switch | AABB switch full | ABAB switch (snellere wissel) |

Promotie naar volgend level: na 2 geldige sessies met accuracy ≥80% op huidig level. Demotie: nooit automatisch — alleen manuele admin-actie.

**Open vraag F1:** moeten deze 4 levels nu uitgewerkt worden, of in Fase 7 samen met mijlpaal-drempels? Voorkeur Claude: nu het *level-schema* vastleggen (kolom-inhoud van bovenstaande tabel), in Fase 7 de visuals + mijlpaal-drempels koppelen. Zo bouwt Fase 7 op een stabiel level-systeem.

**Open vraag F2:** 80% accuracy als promotie-drempel — te streng of te soepel voor een 7-jarige met cognitieve uitdagingen? EF-research gebruikt vaak 75–85%. Voorkeur Claude: 80% met `trialsN >= 24` als ondergrens.

**Open vraag F3:** wil je dat Day-Night/Wisselen óók een "te-moeilijk"-knop respecteren met betekenis? Bv. binnen één sessie van level 3 naar level 2 zakken? Voorkeur Claude: nee — de blok-design is te kort om midden-sessie te herconfigureren; manueel uit de spel-tegel klikken en opnieuw starten op lager level is netter.

#### Bestanden

- `src/scripts/progressie.js` (nieuw, pure module): `seedLevel(ex, spelId)`, `shouldAutoLower(recentTrials, sessieMs)`, `isReliableSession(summary, trialsN, isFirstEver)`, `detectPlateau(sessions, days)`, `nextLevelDayNight(sessions)`, `nextLevelWisselen(sessions)`, `computeSessionLevel(reversals)`.
- `src/scripts/progressie.test.js` (nieuw): unit-tests voor elk van bovenstaande met fixture-data (≥10 asserts).
- `src/scripts/staircase.js` (patch): expose `reversals[]` in output.
- `src/scripts/storage.js` (patch): `saveSession()` past `currentLevel`-update aan volgens beslissingen A2 + D1 (alleen bij geldige sessies).
- `src/pages/spelen/{simon,corsi,zoeken}.astro` (patch): bij init `seedLevel()` aanroepen i.p.v. hardcoded MIN; eindspan via `computeSessionLevel()`.
- `src/pages/spelen/{day-night,wisselen}.astro` (patch): blok-config laden uit `nextLevel*()` + level-promotie checken na sessie.
- `src/pages/spelen/admin.astro` (patch): plateau-banner per spel met `detectPlateau()`-resultaat.

#### Acceptatie

- `node --test` toont nieuwe progressie-tests pass.
- Speel Simon, eindig op span 4 → start volgende sessie op span 3 (default A1 = `-1` warm-up).
- Speel Day-Night 2× achter elkaar met accuracy 90% op level 1 → 3e sessie start op level 2 (3 blokken).
- Speel Corsi met 3 fouten op rij in eerste minuut → automatische zachte verlaging zonder knop.
- Admin toont plateau-banner als Corsi `highestLevel` 14d niet stijgt bij ≥3 sessies in dat venster.
- Sessie van 3 trials wordt opgeslagen, maar updatet `currentLevel`/`highestLevel` niet.

#### Antwoord-template voor de open vragen (vul in vóór de implementatie-run)

```
A1: [currentLevel | currentLevel - 1]
A2: [a alleen omhoog | b glijdend gemiddelde | c huidige (eindspan)]
B1: [3 reversals | 4 reversals | anders: __]
C1: [3 op rij | 2 op rij | hybride zoals voorgesteld]
C2: [alleen span-spellen | ook Day-Night/Wisselen]
D1: [hard | zacht]
D2: [1× gehaald | 2 van laatste 3 | 3× ooit | anders: __]
E1: [14d/3s | 7d/3s | 21d/3s]
F1: [nu vastleggen | naar Fase 7]
F2: [75% | 80% | 85%]
F3: [geen mid-sessie demotie | wel mid-sessie demotie]
```

</details>

### Fase 7 — Mijlpalen & visuele collectie — ✅ KLAAR (25 apr 2026)

**Gebouwd:**
- `src/scripts/mijlpalen.js` — 20 mijlpalen (4 per spel, vast en mastery-anchored) + `computeMilestones`, `isMilestoneReached`, `evalueerNieuwBereikt`. Drempel-typen: `maxSpan`, `maxSetSize`, `accuracy`, `accuracy-at-level`, `level-min`, `switchCost-max`.
- `src/scripts/mijlpalen.test.js` — 15 tests pass: schema-checks, span-mijlpalen, accuracy, level-min, switchCost, computeMilestones, evalueerNieuwBereikt.
- `src/pages/spelen/reis.astro` — nieuw. Laat 5 spel-secties zien met 4 badges per spel; bereikt = volle cirkel + naam; wachtend = gestreepte rand. "Volgende: [dier] — [drempel]" per spel. Pop-animatie 700ms bij nieuw bereikt; reduced-motion-veilig.
- `src/pages/spelen/{simon,corsi,day-night,zoeken,wisselen}.astro` — groei-fragment in einde-scherm: anchor `.spel-mijlpaal-melding` met "Nieuw ontgrendeld: [dieren]" + link naar `/spelen/reis`. Verschijnt alleen als een mijlpaal nieuw bereikt is in deze sessie.
- `src/styles/spelen.css` — `.spel-mijlpaal-melding`-stijl (sun-tinted card + pop-animatie, reduced-motion-veilig). Hergebruikt door alle 5 spellen.
- `src/pages/spelen/admin.astro` — nieuwe sectie "Mijlpalen": stats-pillen (behaald + openstaand), 5 spel-kaarten met 4 mijlpalen-rijen (status `Behaald`/`Open`), cadeau-form (dropdown met alle 20 mijlpalen + omschrijving + toevoegen), tabel met cadeau-koppelingen + `Markeer uitgereikt`/`Verwijder`-knoppen. Bestaande secties hernummerd.
- `src/scripts/strings.nl.js` — nieuwe blokken `reis` en `admin.{mijlpalen,cadeaus,...}`.
- Storage gebruikt al `data.mijlpalen.{bereikt[], cadeaus[]}` (sinds Fase 0); Fase 7 vult cadeaus-shape aan: `{ id, milestoneId, omschrijving, status: 'open'|'uitgereikt', toegevoegd }`.

**Mijlpalen-thema's:** dierenbandje (Simon: trom-aap → gitaar-flamingo → zang-vos → piano-uil), nachtbos (Corsi: vuurvliegjes → uil → vos → sterren-pad), dag-nacht-cyclus (DN: egel → vos → uil → vleermuis), vijver (Zoeken: libel → reiger → ijsvogel → otter), dierentuin (Wisselen: papegaai → giraffe → leeuw → olifant).

**Drempel-strategie:** span-/setSize-/accuracy-mijlpalen vereisen "2 van laatste 3 geldige sessies" boven de drempel (D2-regel uit Fase 6.5, herhaalbaarheid-bewijs). `level-min` kijkt naar `currentLevel` (alleen-omhoog dankzij Fase 6.5 A2). `switchCost-max` kijkt naar laatste geldige Wisselen-sessie. `accuracy-at-level` filtert op sessies op of boven het vereiste level voordat de 2-van-3-check loopt.

**Niet bereikt zonder verdere bouw:**
- `zoeken-4` (otter, "Combineer-zoeken"): vereist `currentLevel >= 3`, maar zoeken kent nog geen niveau-2/3-modi. Wacht op uitbreiding (conjunction → bewegend, plan §4 fase 4 noot).
- `day-night-4` (vleermuis, "Niveau 4 met afleiders"): vereist `currentLevel >= 4`, maar `nextLevelDayNight` capt op 3 tot afleider-stimuli geïmplementeerd zijn (Fase 6.5 F-tabel level 4). Voor nu zichtbaar in outline-staat op `/spelen/reis`.

**Verificatie:** `node --test` 53/53 (38 oud + 15 nieuw), `npx astro check` 0 errors/warnings/hints, ToV-check 0 blokkers, HTTP 200 op `/spelen`, `/spelen/reis`, `/spelen/admin` + alle 5 spel-routes.

<details>
<summary>Oorspronkelijke scope-beschrijving (Fase 7 pre-implementatie)</summary>

**Doel:** duidelijke doelen waar Alvah naartoe werkt, rustig in-software én extrinsiek via papa — binnen de research-regels (geen variabele beloning, geen streaks, geen loss-aversion).

**Drie lagen:**

**Laag 1 — visueel wereldje per spel (in-software, vast schema):** elk spel heeft zijn eigen mini-wereldje dat zichtbaar meegroeit bij elk mastery-niveau. Vast, voorspelbaar, geen verrassing → geen dopamine-hijack. Eenmaal ontgrendeld blijft het staan, ook als hij een week niet speelt.

Overkoepelend thema: **dieren**. Elk spel heeft zijn eigen dierenwereldje dat groeit. Vijver+kikkers is de kern in "zoeken"; de andere spellen haken thematisch aan.

| Spel | Wereldje | Unlock-niveaus (vast, mastery-anchored) |
|---|---|---|
| Simon | dierenbandje (4 muzikanten) | span 3 → trom-aap, span 5 → gitaar-flamingo, span 7 → zang-vos, span 9 → piano-uil |
| Corsi | nachtbos met vuurvliegjes | span 4 → eerste vuurvliegjes, span 5 → uil op tak, span 6 → vos tussen varens, span 7 → volledige sterren-pad |
| Day-Night | dieren-dag/nacht-cyclus | blok 80% → egel (schemer), 85% → vos (avond), 90% → uil (nacht), incongruent-modus → vleermuis (dageraad) |
| Zoeken | vijver vol dieren | set-size 8 → libel, 12 → reiger, 16 → ijsvogel, niveau-3 → zeldzame otter |
| Wisselen | dierentuin-verzorger | pure-kleur gehaald → papegaai, pure-vorm → giraffe, switch-blok → leeuw, switchCost <200ms → olifant |

**Laag 2 — `/spelen/reis` (Alvah's overzicht):** grote visual van waar hij nu staat per spel. Expliciet "jouw volgende mijlpaal = [naam], nog X te gaan", en de volgende unlock staat zichtbaar in grijze outline — hij zíet wat er komt. Geen verrassing = geen variabele beloning. Precies één rustige mini-animatie als een wereldje groeit (600ms, toggle-baar via `prefers-reduced-motion`).

**Laag 3 — echte cadeaus via admin (extrinsiek, door papa):** papa configureert in `/spelen/admin` een lijst fysieke mijlpaal-cadeaus, gekoppeld aan specifieke mastery-thresholds ("Corsi span 5 drie keer gehaald → LEGO-set"). Software detecteert + flagt in admin-banner "🎯 mijlpaal behaald: Corsi span 5"; papa regelt het echte cadeau buiten de software. Software kondigt fysieke cadeaus niet zelf aan bij Alvah — dat blijft een papa-kind-moment en ontkoppelt het cadeau van de software-loop.

**Waarom dit werkt binnen research-regels (sectie C.3):**
- **Geen variabele beloning:** elk cadeau/unlock is vooraf zichtbaar. Schedule is vast, mastery-anchored.
- **Geen loss-aversion:** ontgrendelingen zijn permanent. Geen "streak van X dagen gaat verloren"-dreiging.
- **Autonomie:** Alvah kiest zelf welk spel en welk pad. Vijf parallelle mijlpaal-routes.
- **Competentie-feedback:** het wereldje toont visueel wat hij beheerst — mastery, geen spektakel.
- **Papa-mediated fysiek cadeau:** zit buiten software-dopamine-loop, blijft menselijk.

**Bestanden:**
- `src/pages/spelen/reis.astro` (nieuw)
- `src/scripts/mijlpalen.js` (nieuw) — pure functie `computeMilestones(data)` → `{ bereikt: [...], volgende: [...] }`. Unit-test verplicht.
- `src/pages/spelen/admin.astro` (tweak) — cadeau-lijst, banner voor nieuw behaalde mijlpalen.
- `src/pages/spelen/{simon,corsi,day-night,zoeken,wisselen}.astro` (tweak) — na summary-scherm korte groei-fragment van het wereldje ("+1 ster"), rustig.

**Acceptatie:** speel één spel voorbij een unlock-drempel → wereldje groeit op `/spelen/reis`, admin-banner meldt mijlpaal, spel-scherm zelf blijft rustig (alleen summary, geen confetti).

</details>

### Fase 7.5 — Admin-analytics: vijf lenzen op basis van research — ✅ KLAAR (25 apr 2026)

**Gebouwd:**
- `src/scripts/analytics.js` (nieuw, pure module): `rollingMean`, `huidigStatus`, `iivTrend`, `incongruentAccuracyTrend`, `falseAlarmRate`, `switchCostTrend`, `weekFrequency`, `timeOfDayHeatmap`, `platteSessies`, `teMoeilijkPerWeek`. Geen DOM-koppeling.
- `src/scripts/analytics.test.js` (nieuw): 15 tests pass — rollingMean (3), huidigStatus (3), iivTrend (2), incongruent-accuracy (2), falseAlarmRate (1), switchCost (1), weekFrequency (1), heatmap (1), platteSessies (1).
- `src/scripts/referenties.js` (nieuw): config met 4 defensibele banden (Corsi-span, IIV-CV, DN-incongruent-accuracy, Wisselen-switchCost) + bron + disclaimer-tekst. Geen band voor Simon-span en Zoeken-set-size — bron te zwak.
- `src/scripts/storage.js` (patch): `toonReferenties: false` als default + idempotente migratie.
- `src/scripts/strings.nl.js` (patch): `admin.lenzen.*`-blok met titels, uitlegjes, toggle-labels.
- `src/pages/spelen/admin.astro` (patch): nieuwe sectie "Wat zegt iets" tussen "Deze week" en "Per spel"; bestaande sectie wordt detail-laag (renumber 2 → 3, 3 → 4, 4 → 5). Toggle "Toon onderzoek-referenties" persistent in storage. Vijf lens-articles met sparklines + bands + bar-chart sessies/week + 5×24-heatmap voor tijd-van-dag.

**Beslissingen tijdens build:**
- Lens 5 (referentie-banden) als toggle, niet als aparte lens — anders krijg je dubbele visuals. Toggle off-by-default zodat samen-met-Alvah-kijken safe is.
- Heatmap-cellen kleur-per-spel met opacity = relatief aandeel. Geen absolute schaal — alleen relatieve "wanneer is hij aan".
- Te-moeilijk-frequentie (Lens 4 sub) als ruwe placeholder: telt `summary.autoLowerN` als dat veld bestaat. Spel-bestanden loggen dit nu nog niet expliciet — toekomstige uitbreiding (in Fase 8 of later).
- Geen samengestelde EF-score (Diamond 2013 — componenten zijn separabel).
- Incongruent-accuracy gebruikt `trials[]` waar beschikbaar (laatste 10 sessies dankzij prune); valt terug op summary.accuracy met `exact: false` voor oudere sessies.

**Verificatie:** `node --test` 68/68 (53 oud + 15 nieuw), `npx astro check` 0 errors/warnings/hints, ToV-strict 0 blokkers, HTTP 200 op `/spelen/admin`, 7 lens-data-attributen aanwezig in markup.

<details>
<summary>Oorspronkelijke scope-beschrijving (Fase 7.5 pre-implementatie)</summary>

**Doel oorspronkelijk:** vier lenzen — gegroeid naar vijf met de toggle-laag voor referentie-banden.

**Doel:** admin laten zien wat *écht iets zegt* over Alvah, op basis van EF-research. Geen samengestelde score, geen leeftijdsnorm, geen "verbetering-percentage". Wel: Alvah-vs-Alvah trends, IIV-CV als aandacht-consistency-marker, EF-componenten apart, engagement als context.

**Research-fundering:**
- Diamond 2013 — EF heeft drie separabele componenten (WM, inhibition, flexibility). Niet optellen.
- Kofler e.a. 2013 — intra-individual variability (IIV-CV) is sterk geassocieerd met aandacht-regulatie in kinderen met ADHD.
- Melby-Lervåg 2016, Sala & Gobet 2020, Gobet & Sala 2023 — far-transfer naar school is niet bewezen. Geen academische claims.
- Alvah-vs-Alvah trends zijn de enige valide vergelijking.

**Lens 1 — Stabiliteit (uitbreiding bestaande sparkline):**
- Per spel: sparkline-band met 30-dagen-rolling-gemiddelde als grijze achtergrond, individuele sessies als punten.
- Heden-marker: laatste sessie t.o.v. de band.
- Tekst-label: "ligt op zijn niveau" / "iets boven" / "iets onder" (niet als oordeel — als feit).

**Lens 2 — Aandacht-consistency (NIEUW):**
- Per spel een tweede sparkline: IIV-CV per sessie, lager-is-beter.
- Aparte sectie "Aandacht-consistency" in admin met korte uitleg: "Lager = consistenter qua reactietijd. Onderzoek koppelt dit aan aandacht-regulatie, sterker signaal dan accuracy."
- Y-as 0–0.5 (waarden boven 0.6 zijn "verkennend", al uitgefilterd).

**Lens 3 — EF-componenten apart (NIEUW + bestaand):**
- **Working memory** (Simon + Corsi): span-trend (al zichtbaar, blijft).
- **Inhibition** (Day-Night): aparte lijn voor incongruent-blok-accuracy, naast de bestaande totale accuracy. Toont de échte Stroop-cost. Computed: `mean(accuracy van incongruent-trials in laatste 10 sessies)`.
- **Inhibition** (Zoeken): false-alarm-rate per sessie als sparkline. Computed: `summary.falseAlarmsTotal / summary.trialsN`.
- **Cognitive flexibility** (Wisselen): switch-cost trend over alle sessies (al gemeten in `summary.switchCost`, alleen op einde-scherm zichtbaar — nu in admin als sparkline).

**Lens 4 — Engagement-context (NIEUW):**
- Sessie-frequentie per week (kleine bar-chart, laatste 8 weken).
- Tijd-van-dag-heatmap per spel: 24 uur-cellen × 5 spellen, opacity = sessie-aantal. Toont *wanneer* Alvah speelt. Ruw signaal voor "wanneer is hij aan" — relevant voor PKU-context (eiwit-load varieert per dagdeel).
- Te-moeilijk + auto-lower frequentie per week (een teller).
- **Niet** een prestatie-metric — context voor de LLM-analyse die papa elders doet.

**Lens 5 — Referentie-banden (optioneel, toggle):**
School kijkt naar leeftijdsgemiddelden, dus we tonen ze *als ze defensibel zijn*, met een toggle in admin. Default uit (zodat als je samen met Alvah kijkt, het Alvah-vs-Alvah blijft); toggle aan voor papa-analyse-momenten. Persistent in `data.preferences.toonReferenties`.

Bands die we tonen (alleen waar literatuur defensibel is voor 7-jarigen):

| Lens | Spel | Band | Bron |
|---|---|---|---|
| 1 stabiliteit | Corsi span | 4–5 | ontwikkelings-literatuur Kessels e.a. + replicaties |
| 2 IIV-CV | alle | 0.20–0.35 | Kofler 2013 + ranges in attention-research voor 6-9j |
| 3 inhibition | Day-Night incongruent-accuracy | 80–90% | Gerstadt 1994 + replicaties leeftijd 7 |
| 3 flexibiliteit | Wisselen switch-cost | 200–400 ms | Cepeda 2001 e.a. leeftijd 7-8 |

Bands die we **niet** tonen omdat de bron te zwak of niet-vergelijkbaar is:
- Simon span (geen leeftijd-norm voor dit specifieke paradigma)
- Zoeken set-size (te parameter-afhankelijk; onze jittered-grid is geen klassieke set-up)
- Day-Night totale-accuracy (alleen incongruent is paradigma-relevant)

Visualisatie: lichte horizontale band over de sparkline, label "ongeveer leeftijd 7" + tooltip met bron + disclaimer "parameters wijken af van origineel onderzoek; nooit als diagnose gebruiken". Toggle in admin-header naast bestaande knoppen: "Toon onderzoek-referenties [aan/uit]".

**Bestanden:**
- `src/scripts/analytics.js` (nieuw, pure module): `rollingMean(values, days)`, `iivTrend(sessions)`, `incongruentAccuracy(sessions)`, `falseAlarmRate(sessions)`, `weekFrequency(sessions, weeks)`, `timeOfDayHeatmap(sessions)`. Unit-tests verplicht.
- `src/scripts/analytics.test.js` (nieuw): fixture-gedreven tests voor elke functie.
- `src/scripts/referenties.js` (nieuw, pure config): `REFERENTIE_BANDS` per lens-spel-combinatie + bronnaam + disclaimer-tekst.
- `src/scripts/storage.js` (patch): default `toonReferenties: false` in preferences (migratie idempotent).
- `src/pages/spelen/admin.astro` (patch): nieuwe sectie "Wat zegt iets" met de vijf lenzen vóór de bestaande "Per spel"-sectie. Toggle "Toon onderzoek-referenties" in admin-header. Bestaande sectie wordt detail-laag.
- `src/scripts/strings.nl.js` (patch): nieuwe `admin.lenzen.*`-blok met korte research-zinnen.

**Bewust niet:**
- Geen samengestelde EF-score.
- Geen leeftijds-norm-vergelijking.
- Geen "verbetering-percentage" als headline.
- Geen scoring.js raken — we voegen nieuwe analytics toe, breken de bestaande summary niet.

**Acceptatie:**
- Alle nieuwe functies in `analytics.js` hebben unit-tests die pass.
- Admin toont vijf lenzen, elk met korte uitleg-zin (1 regel) waarom het iets zegt.
- Bij lege state (geen sessies): elke lens toont "—" of "te weinig data", geen JS-errors.
- Toggle "Toon onderzoek-referenties" persistent in storage; default uit; flippen toont/verbergt bands op alle relevante sparklines tegelijk.
- ToV-strict 0 blokkers; astro check 0 errors.

</details>

### Fase 8.5 — QA-feedback verwerkt — ✅ KLAAR (25 apr 2026)

Iteratie boven Fase 8 op basis van korte QA-doorloop met Floris. Vier commits: `3f21633` (eerste pass), `e5b8059` (zijmenu zichtbaar maken), `284ec79` (top-nav-rij weg), `7d88a5c` (Corsi subtieler). Eindstand:

**Navigatie compleet anders:**
- **Top-bar minimaal:** alleen home-icoon links + hamburger-knop rechts. Horizontale linklijst is helemaal verdwenen — alle 10 dossier-pagina's lopen nu via het zijmenu. Bestanden: `src/layouts/BaseLayout.astro`, `src/styles/global.css` (`.site-nav` is nu een simpele flex-rij `space-between`, geen scroll-container meer).
- **Rechts uitschuivend zijmenu:** ~92vw / max 380px paneel met grote groen-gradient "Spelen"-CTA bovenaan en de 11 nav-items (Home + 10 pagina's) eronder. Slide-in 280ms cubic-bezier, overlay-fade 220ms, ESC of overlay-click sluit, `prefers-reduced-motion`-veilig. Bestanden: `BaseLayout.astro` template + `global.css` (`.side-menu`, `.side-menu__cta`, `.side-menu__lijst`, `.side-menu-overlay`).

**Spel-feedback verbeterd:**
- **`src/pages/spelen/simon.astro`** — tap-toon matcht sequence-toon-duur. `flash(idx, visualMs, toneMs)` accepteert aparte tone-duur; visueel blijft 220ms voor responsive taps, audio is 600ms voor consistente klank-karakter.
- **`src/pages/spelen/simon.astro`** — is-aktief versterkt: brightness 1.5 → 1.7, dubbele box-shadow ring (6px solid + 24px glow), scale 1.04.
- **`src/pages/spelen/corsi.astro`** — `.corsi-ster*` regels in een `<style is:global>` blok verplaatst (kritisch — zie gotcha hieronder) en is-aktief eindstand: stroke 1.5px warm-wit, single drop-shadow 10px, scale 1.22 settle (puls-peak 1.32), animation `corsi-puls` 700ms (stroke-width 0 → 5 → 1.5 + scale 1 → 1.32 → 1.22).

**Admin verbeterd:**
- **Heatmap** in `admin.astro` (Lens "Wanneer hij speelt") — 24 uur-cellen geaggregeerd naar 4 dagdelen (ochtend 6-12 / middag 12-18 / avond 18-22 / nacht 22-6). Grid `110px + 4 cellen` (2:1 aspect-ratio), sessie-aantal in elke cel.
- **Mijlpalen-lijst** in `admin.astro` — vervangen door 4-badge-grid per spel (consistent met `/spelen/reis`). Cirkel met initiaal + dier-naam + drempel; bereikt = sun-tinted + glow-ring; niet-bereikt = dashed outline. Responsive 4-kol → 2-kol op mobiel.

**Gotcha — Astro `<style>` scoping vs JS-gemaakte SVG-elementen:**

Astro scope CSS standaard: `.corsi-ster { ... }` wordt onder de motorkap `.corsi-ster[data-astro-cid-XYZ]`. Elementen in de Astro-template krijgen die `data-astro-cid` automatisch, maar elementen die je via `document.createElementNS('http://www.w3.org/2000/svg', 'polygon')` aanmaakt **niet**. Resultaat: scoped CSS gaat niet matchen, je polygon defaultet naar `fill: black`.

In Corsi werd dit zichtbaar omdat we `el.setAttribute('fill', 'var(--corsi-ster)')` weghaalden zonder de CSS uit te scopen. Sterren werden zwart op donkerblauw veld.

**Oplossing:** voor JS-gerenderde SVG-children, plaats de class-rules in `<style is:global>` met literal kleuren (geen `var()` — die zouden ook problematisch zijn als je ze later in scoped scope wilt definiëren). Of geef zelf de scope-attribute mee bij `createElement`. De eerste route is gekozen voor Corsi.

Geldt potentieel voor toekomstige spellen die ook SVG dynamisch renderen (bv. Tower of London bij Fase 10b — drag-and-drop ballen).

**Verificatie:** `node --test` 80/80, `npx astro check` 0 errors, ToV-strict 0 blokkers, alle 9 routes 200, hamburger zichtbaar in markup, Corsi-puls keyframe geladen.

### Fase 8 — Polish — ✅ KLAAR (25 apr 2026)

**Gebouwd:**
- `src/pages/index.astro` (patch): nieuwe sectie "B. Voor Alvah zelf" met `.alvah-spelen-haak`-callout naar `/spelen`. Sectie "Navigatie" verschoof naar "C". Scoped style met green-soft achtergrond, hover-lift respecteert `prefers-reduced-motion`.
- `src/pages/spelen/index.astro` (patch): `pickNext()` echt aangezet — fallback verwijderd (alle 5 spellen speelbaar). Server-rendert nu alle 5 tegels in de "Andere spellen"-grid; CSS `.spel-tegel[data-is-hero="true"] { display: none }` verbergt de hero-tile zodat er geen duplicaat met de hero ontstaat. JS draait `pickNext()` op load en wisselt `data-is-hero` op de tegels zodat de gepickte tile verbergt en de server-default (Simon) zichtbaar wordt.
- `src/layouts/SpelShell.astro` (patch): nieuwe geluid-toggle-knop in header naast de voorlees-knop. Twee SVG-iconen (luidspreker / luidspreker-met-kruis); klik wisselt `data-preferences.sound` via `setPreference('sound', ...)`. `aria-pressed` reflecteert state, `audio.js::soundOn()` respecteert dit al. `stopSpeech()` wordt aangeroepen bij uitschakelen.
- `src/styles/spelen.css` (patch): `.spel-shell__acties` flex-container voor de actie-knoppen + `.spel-shell__icon-btn[aria-pressed="false"]` muted-styling voor geluid-uit-state.
- `src/pages/spelen/{simon,corsi,zoeken}.astro` (patch): tellen `teMoeilijkN` (alle 3) + `autoLowerN` (Corsi en Zoeken; Simon heeft geen auto-lower) en schrijven dit naar `summary.teMoeilijkN` / `summary.autoLowerN`. Lens 4 in admin (`teMoeilijkPerWeek`) gaat nu echte data tonen.

**Bewust niet gedaan in Fase 8:**
- Avatar-keuze (beslissing #6 in §8 = "Overslaan").
- Onboarding-flow (alle uitleg zit al in spel-start-schermen; verdere onboarding voelt overdreven).
- Frustratie-knop "verzachten": de bestaande knop + feedback-zinnen ("Oké, iets korter" / "Even iets makkelijker") zijn al rustig. Geen nieuwe layer nodig.

**Verificatie:** `node --test` 68/68, `npx astro check` 0 errors/warnings/hints, ToV-strict 0 blokkers, HTTP 200 op alle 9 routes (`/`, `/spelen`, `/spelen/{reis,admin,simon,corsi,zoeken,wisselen,day-night}`).

### Fase 9 — Pre-live QA + product-demo (1 run)

**Doel:** voor we `/spelen` aan Alvah geven, doorlopen we systematisch wat we niet uit de unit-tests kunnen lezen — feel, flow, edge-cases, A11y, en opslag-gedrag over sessies heen. Eén keer voor de eerste vrijgave; herhaalbaar bij elke significante toevoeging daarna.

**Test-laag-overzicht (waar staan we nu):**

| Laag | Wat | Hoe | Wanneer |
|---|---|---|---|
| Unit | Pure modules: `scoring`, `staircase`, `storage`, `aanraden`, `progressie`, `mijlpalen` | `node --test src/scripts/*.test.js` | Bij elke commit (lokaal) + per fase |
| Type | Astro + TypeScript-types | `npx astro check` | Bij elke commit |
| Tone | NL-content tegen `tone-of-voice-alvah-site-nl.md` | `npm run check:tov:strict` (pre-commit hook) | Bij elke commit |
| Smoke | HTTP 200 op alle `/spelen`-routes | curl tijdens dev | Per fase-afronding |
| Manueel scenario | Spel-flows, opslag-gedrag, A11y | Checklist hieronder | Pre-live + bij elke significante release |
| Product-demo | Floris als PM, Claude doorloopt frontend | Runbook hieronder | Pre-live |

**Bewust geen E2E-framework (Playwright/Cypress).** Eén gebruiker (Alvah), één Chromebook, geen continuous deployment-druk. De manuele checklist + scenario-doorloop is goedkoper dan een E2E-setup onderhouden — én CLAUDE.md-regel "geen nieuwe dependencies zonder expliciete opdracht" blijft kloppen. Bij de eerste echte regressie die een unit-test miste maar een E2E zou vangen, heroverwegen.

**Browser-/device-matrix (minimum):**

| Device | Browser | Reden |
|---|---|---|
| Chromebook (Alvah's) | Chrome | Primair gebruiks-target |
| Mac (papa's) | Safari | Admin-doorloop, JSON-export |
| iPad (papa's) | Safari | Spelen op groter touchscreen, admin op de bank |
| iPhone (papa's) | Safari | Snelle plateau-check onderweg |

Niet: Firefox, oude Chrome-versies, Windows. Daar gaat dit niet draaien.

**Manuele scenario-checklist (zelf afvinken voor live gang):**

*A. Eerste run / kalibratie-vrije zone:*
- [ ] Verse browser (incognito): `/spelen/admin` toont overal "Nog geen sessies gespeeld."
- [ ] Speel Simon één korte sessie (3 trials) → admin toont 1 sessie, `currentLevel` nog `1` (eerste-ooit telt niet mee, D1-regel).
- [ ] Speel Simon tweede sessie (≥6 trials, ≥3 reversals) → `currentLevel` updatet, admin toont 2 sessies.

*B. Storage + progressie:*
- [ ] Speel Corsi tot span 5 → start van volgende sessie begint op span 4 (warm-up A1).
- [ ] Speel een "slechte" Corsi (vooral fout) → `currentLevel` daalt **niet** (A2 alleen omhoog).
- [ ] Speel 3 Day-Night-sessies met 80%+ accuracy → vierde sessie start op level 2 (3 blokken).
- [ ] Vul localStorage met 21+ sessies van één spel → admin toont nog steeds 20 (prune werkt), oudste sessies hebben geen `trials`-array meer (lichte snapshot).

*C. Te-moeilijk / frustratie-opvang:*
- [ ] In Simon: druk "Dit is te moeilijk" tijdens spelen → span zakt 1 stap, geen commentaar.
- [ ] In Corsi: maak 3 fouten op rij na 3 minuten → automatische zachte verlaging (shouldAutoLower).

*D. Mijlpalen + groei-fragment:*
- [ ] Speel Simon tot span 3 in 2 van laatste 3 sessies → groei-fragment "Nieuw ontgrendeld: trom-aap" verschijnt op einde-scherm + linkt naar `/spelen/reis`.
- [ ] Open `/spelen/reis`: trom-aap-badge heeft volle cirkel + naam, andere drie Simon-mijlpalen blijven gestreept.
- [ ] Sluit en open opnieuw → groei-animatie speelt **niet** opnieuw af (snapshot bewaard).
- [ ] Open admin: stats tonen "1 behaald · 0 openstaand", mijlpaal-overzicht toont trom-aap als "Behaald".

*E. Cadeau-koppeling (admin-flow):*
- [ ] In admin: koppel cadeau "LEGO-set" aan "Corsi: vos (Rij van 6)" → tabel-rij verschijnt met status "Wacht".
- [ ] Speel Corsi voorbij span 6 (twee keer) → admin toont status "Openstaand" (oranje pill).
- [ ] Klik "Markeer uitgereikt" → status wordt grijs "Uitgereikt", knop verdwijnt.
- [ ] Klik "Verwijder" op een cadeau → bevestig-dialoog → rij verdwijnt.

*F. Data-management:*
- [ ] Admin → "Kopieer JSON" → plak in tekst-editor, geldige JSON met alle sessies.
- [ ] Admin → "Download JSON" → bestandsnaam `alvah-ef-v1-YYYY-MM-DD.json`, leesbaar.
- [ ] Admin → "Importeer JSON" met geldig bestand → re-render, sparklines + tabellen kloppen.
- [ ] Admin → "Importeer JSON" met onzin-tekstbestand → "Ongeldige JSON"-feedback, geen data-corruptie.
- [ ] Admin → "Wis alles" → twee bevestigingen → alles leeg, terug naar pristine state.

*G. A11y / reduced motion:*
- [ ] Systeem-instelling "reduce motion" aan → Simon-panelen flashen via `outline` i.p.v. brightness, geen scale-bouncing op `/spelen/reis`.
- [ ] Schermlezer-tab door alle 4 Simon-panelen → leest "Groen, cirkel" / "Blauw, vierkant" etc.
- [ ] Tab door admin-knoppen → focus-ring zichtbaar.

*H. Cross-spel + edge:*
- [ ] Speel alle 5 spellen kort → `/spelen` (landing) toont nog steeds correcte aanbeveling-stub (Simon).
- [ ] Open een spel-URL direct (`/spelen/wisselen`) zonder eerst landing → werkt, gate vraagt eenmalig wachtwoord.
- [ ] BaseLayout-gate: log uit (sessionStorage clear), refresh → wachtwoord-prompt, foute → blokkeert; juiste → laadt.
- [ ] Mobiel: tap-targets ≥56px (Simon-panelen, paneel-knoppen Day-Night, Wisselen-richtingsknoppen).

**Product-demo runbook (Claude doorloopt, Floris als PM):**

Volgorde is belangrijk — bouwt op cumulatieve state.

*Demo-stap 1 — Pristine first-run als Alvah:*
- Open `/spelen` in incognito. **PM checkt:** voelt het als "vandaag spelen" of als spreadsheet?
- Hero toont één aanbevolen spel (Simon). **PM checkt:** is de keuze duidelijk, snap je waar je heen kan?
- Klik door naar Simon, doorloop start-uitleg → speel één rij (span 2). **PM checkt:** weet een 7-jarige wat 'ie moet doen zonder uitleg van papa?
- Eindscherm: hoogste rij, sparkline (verschijnt pas vanaf 2 sessies, dus eerste keer leeg). **PM checkt:** voelt einde rustig of teleurstellend?

*Demo-stap 2 — Tweede sessie + groei:*
- Speel Simon nogmaals, push tot span 4-5. **PM checkt:** stijgt het natuurlijk mee, of voelt het of de sprongen groot zijn?
- Bij span 3 reached: groei-fragment verschijnt → klik door naar `/spelen/reis`. **PM checkt:** klopt de pop-animatie of voelt 'ie opdringerig?
- Reis-pagina: 5 spel-secties zichtbaar. **PM checkt:** snap je in één blik welke dieren je hebt en welke nog komen?

*Demo-stap 3 — Andere spellen + variatie:*
- Vanuit `/spelen/reis` terug → kies Corsi, speel kort. Daarna Day-Night, kort. **PM checkt:** is "uitstapje" naar ander spel makkelijk, of moet je terug naar landing en opnieuw kiezen?
- Forceer een fout-streak in Corsi (klik random) → check of zachte-verlaging triggert. **PM checkt:** voelt de verlaging als help of als straf?

*Demo-stap 4 — Frustratie-uitstap:*
- In Day-Night midden in een blok: druk SpelShell "Pauze" → terug naar `/spelen`. **PM checkt:** dataset blijft heel? Niets gaat verloren?

*Demo-stap 5 — Admin als papa:*
- Open `/spelen/admin`. **PM checkt:** zie je in 5 seconden waar Alvah staat, of moet je scrollen/zoeken?
- Sparklines per spel — kloppen ze met wat je zojuist gespeeld hebt? Plateau-banner zichtbaar bij correcte conditie?
- Mijlpaal-sectie: koppel een cadeau aan trom-aap. **PM checkt:** form duidelijk? "Markeer uitgereikt" intuïtief?
- "Kopieer JSON" → plak in chat-window van keuze. **PM checkt:** is dit format wat je in een LLM zou plakken voor analyse?

*Demo-stap 6 — Stress-test:*
- Wis alles (dubbele bevestiging). **PM checkt:** voelt het wis-pad veilig genoeg dat je het niet per ongeluk doet?
- Re-import van vorige download. **PM checkt:** state komt terug zoals het was?

*Demo-stap 7 — Mobiel:*
- iPhone Safari: open `/spelen` met dezelfde gate. **PM checkt:** layout staat netjes? Tap-targets groot genoeg? Tonen worden afgespeeld?

**Acceptatie Fase 9:**
- Manuele checklist (A–H) volledig groen op Chromebook + Mac Safari (mobile = nice-to-have).
- Product-demo doorlopen met Floris; alle 7 demo-stappen op groen of expliciet als "later" gelabeld.
- Eventuele bevindingen → kleine PR's vóór live gang, of verplaatst naar Fase 10 (post-live polish) als acceptabel.
- "Live gang" = Floris geeft Alvah's Chromebook URL + wachtwoord. Niets meer.

**Bestanden:** dit fase-blok is uitvoerend, geen nieuwe code-bestanden. Eventuele bug-fixes uit de checklist → kleine commits in bestaande bestanden, met commit-prefix `Fase 9: <korte fix>`.

### Fase 10 — Paradigma-uitbreiding (research-backed)

**Doel:** alle paradigma's bouwen die research §B als sterk evidence-onderbouwd aanmerkt voor 7-jarige met ADHD-profiel + PKU. Niet "diminishing returns" als drempel — wat in de research-top staat, hoort er in. Wat zwak of leeftijds-ongeschikt is, blijft eruit.

**Coverage-status na Fase 0–8:**

| EF-component | Bestaande spellen | Evidence | Top-research nog niet gebouwd |
|---|---|---|---|
| WM | Simon + Corsi | sterk | — (Corsi en Simon zijn top-2) |
| Inhibition | Day-Night | sterk | **Go/No-Go** (top-2), **Flanker** (top-3) |
| Flexibility | Wisselen | sterk | **DCCS** (top-2 naast Wisselen) |
| Attention | Zoeken | matig-praktijk | **Posner cueing** (top-2, PKU-relevant) |
| Planning | — | n.v.t. | **Tower of London** (top-1) |

**Vijf paradigma's te bouwen, in evidence + impact-volgorde:**

**10a. Go/No-Go (~1 run).** Wessel 2018 review + Simmonds 2008 meta bij ADHD. Onze top-2 inhibitie. Implementatie: frequente Go (80% — bv. 🐶) → zeldzame No-Go (20% — 🐱), stimulus 800 ms, adaptieve No-Go-ratio op basis van false-alarm-rate. Geen countdown. Reference-repo `reference/GoNoGo_jsPsych` als leesbron (clean-room). Mijlpaal-thema: dieren-vrienden (hond, kat, vogel, eekhoorn — 4 unlocks). Sessie-summary toegevoegd: `commission` (No-Go fout-rate), `omission` (Go-mis-rate), `meanGoRT`. Lens 3 (inhibition) krijgt extra commission-rate-trend.

**10b. Tower of London (~1.5 run).** Diamond 2013, Shallice 1982. Vult lege planning-categorie. Implementatie: 3 stokken, 3 gekleurde ballen, doel-patroon zichtbaar, tap-tap-bewegingen (geen drag — eenvoudiger op touchscreen Chromebook). Tellen aantal-zetten vs. minimum-zetten + plantijd (tijd voor eerste zet). Hardop plannen mag. Reference-repo `reference/jspsych-contrib/plugin-tower-of-london`. Mijlpaal-thema: bouw-dieren (bever-architect, mier-bouwer, eekhoorn-stapelaar, vogel-nestbouwer). Levels: 3-zet → 4-zet → 5-zet → 7-zet patronen. Lens nieuw: planning (excess-moves trend).

**10c. Flanker / vissen-versie (~1 run).** Eriksen-paradigma à la Rueda 2004 ANT-child. Visualer dan Day-Night, ander paradigma. Rij van 5 visjes, kind reageert op middelste richting (links/rechts), congruent vs incongruent 50/50, stimulus 170 ms, ISI 1500 ms. Mijlpaal-thema: zee-dieren (zeepaardje, zeester, krab, dolfijn). Skinable: vissen → pijltjes → autootjes als variatie-laag (Fase 11). Lens 3 (inhibition) krijgt flanker-effect-trend (incongruent RT − congruent RT).

**10d. DCCS (Dimensional Change Card Sort) (~1 run).** Zelazo 2006 *Nature Protocols*. Tweede flexibility-paradigma naast Wisselen, andere mechaniek. Kaartjes met kleur+vorm; ronde 1 sorteer op kleur, ronde 2 op vorm, ronde 3 gemengd met cue. Verschilt van Wisselen omdat sorteer-actie i.p.v. links/rechts-respons. Mijlpaal-thema: sorteer-dieren (das, mol, hamster, eekhoorn — verzamelaars). Levels: pre-switch → post-switch → mixed-cue. Lens 4 (flexibility) krijgt DCCS-mixed-accuracy-trend.

**10e. Posner cueing / Sterren-vangen (~0.75 run).** Posner & Petersen 1990, Rueda 2004 ANT-children. PKU-relevant per Huijbregts 2002 (orienting/vigilantie-tekort). Korte taak (~3 min). Kruisje midden, pijl wijst (cue), ster verschijnt links of rechts (target), kind tikt zijde. Cue-validity 100% → 80/20 → 50/50 als levels. Mijlpaal-thema: nacht-dieren (vleermuis, uil, kat, vos — geluiden in donker). Lens nieuw: aandacht-orienting (validity-effect trend).

**Bewust NIET bouwen (research-vlag):**
- **Klassieke woord-Stroop** (INH-1): dyslexie-killer per Adams 2013, van Mourik 2005.
- **N-back** (WM-3 verbal Kirchner): research-evidence is mixed voor far-transfer; voor 7-jarige WM-zwaar; verbal aspect is dyslexie-onvriendelijk. Dual-n-back als default = expliciet niet doen.
- **Stop-signal task** (INH-6): "minder geschikt <8j", SSRT instabiel bij kleuters met ADHD (Lu 2016). Pas overwegen als Alvah 8 is.
- **CPT als training** (AAN-1): Cortese 2015 + Rapport 2013 = geen klinische transfer. Saai voor ADHD. Mogelijk wel als 3-min baseline-meting (out of scope nu).
- **Trail Making B** origineel (FLEX-4): letters confounden bij dyslexie.
- **WCST** (FLEX-3): te WM-zwaar voor 7j, faalervaring bij ADHD.
- **Tower of Hanoi** (PLAN-2): wachten tot Tower of London beheerst is + recursief denken te zwaar.

**Volgorde-bouw-aanbeveling:** 10a → 10b → 10e → 10c → 10d. Reden: Go/No-Go heeft hoogste ADHD-impact; Tower of London vult een lege categorie; Posner is kort en PKU-relevant; Flanker en DCCS overlappen deels met bestaande spellen dus minder urgent.

**Architectuur-hergebruik:** elk nieuw spel volgt bestaande SpelShell + scoring/staircase/storage. Mijlpalen-systeem (`mijlpalen.js`) breidt uit met 4 nieuwe spel-blokken, 16 nieuwe dieren totaal. Analytics-laag (`analytics.js`) krijgt nieuwe metric-helpers per paradigma. Per spel: ~5–8 nieuwe bestanden incl. tests.

**Triggers om te bouwen:** Floris vraagt erom; of Alvah speelt ≥2× per week 4 weken op rij + plateau-dichtheid op huidige spellen.

### Fase 11 — Variatie-systeem per spel — ✅ KLAAR (25 apr 2026)

**Gebouwd (minimale werkende versie):**
- `src/scripts/skin.js` (nieuw, pure module): `skinNiveau(spelId, data)` → 0-4 = aantal bereikte mijlpalen voor dat spel; `bereikteDieren(spelId, data)` → array van MIJLPALEN-objecten in mijlpaal-volgorde.
- `src/scripts/skin.test.js` (nieuw): 5 tests pass — lege data, count-per-spel, volgorde, onbekend spel.
- `src/styles/spelen.css` (patch): `.spel-trofeeen` flex-row, `.spel-trofee` cirkel-styling per spel-kleur (5 varianten: simon-blauw, corsi-magenta, day-night-zon, zoeken-oranje, wisselen-groen), `[data-skin="N"]` selectors voor progresief opbouwende sun-tint achtergrond.
- 5 spel-bestanden patches: trofeeën-strip-div in template, `applySkin(host, spelId)` functie op outer scope die data-skin-attr zet + cirkels rendert met dier-initialen, applySkin-call op init én na nieuwe-mijlpaal in `toonNieuweMijlpaal`.

**Wat dit oplevert:** persistent reminder van bereikte dieren bovenaan elk spel, achtergrond wordt warmer naarmate Alvah verder komt. Cirkels gebruiken eerste-letter-conventie (consistent met `/spelen/reis`-badges). Geen paradigma-aanpassing — volledig op visuele laag.

**Bewust niet (afgeschaald van plan):** geen pictografische SVG-silhouettes per dier (20 unieke SVGs is te veel werk voor V1) — initialen-cirkels zijn consistent met reis-pagina en functioneel. Geen scene-evolutie met silhouettes verspreid in spel-veld; alleen header-strip. Beide kunnen iteratief later, dit is V1.

**Verificatie:** `node --test` 80/80 (75 oud + 5 skin), `npx astro check` 0 errors, ToV-strict 0 blokkers, HTTP 200 op alle 9 routes, `data-trofeeen` en `data-bloei` aanwezig in alle 5 spel-pagina's.

<details>
<summary>Oorspronkelijke scope-beschrijving (Fase 11 pre-implementatie)</summary>

**Doel:** elk spel ziet er anders uit op verschillende mastery-momenten zonder dat het paradigma verandert. Trigger = mijlpaal-unlock of level-up, niet kalender. Geen surprise-drops, wel zichtbare evolutie van het wereldje.

**Per-spel variatie-tabel** (paradigma-parameters identiek; alleen visueel-thematische laag wijzigt):

**Simon — dierenbandje:**
| Trigger | Skin |
|---|---|
| Default (span 2) | 4 panelen basis-kleur, basis-tonen |
| span 3 (trom-aap) | Trom-aap-silhouet boven panelen, panelen zelfde |
| span 5 (gitaar-flamingo) | + flamingo-silhouet, panelen krijgen subtiele textuur (linnen-achtig) |
| span 7 (zang-vos) | + vos-silhouet, schemer-achtergrond (donkerder paper) |
| span 9 (piano-uil) | Volledig dierenbandje (4 dieren), nacht-thema |

**Corsi — nachtbos:**
| Trigger | Skin |
|---|---|
| Default | Donker-blauw veld, 9 grijze sterren |
| span 4 (vuurvliegjes) | + 5 gele puntjes als ambient vuurvliegjes (NIET op de ster-posities — paradigma intact) |
| span 5 (uil) | + uil-silhouet op tak rechtsboven |
| span 6 (vos) | + vos tussen varens linksonder |
| span 7 (sterren-pad) | + lijn van piepkleine sterren in achtergrond, geen invloed op klikbare sterren |

**Day-Night — dag-nacht-cyclus:**
| Trigger | Skin |
|---|---|
| Default (L1) | Zon/maan basis-iconen op crème-achtergrond |
| 80% acc (egel) | + egel-silhouet onderaan, schemer-band achter stimulus |
| 85%+L2 (vos) | + vos in struiken, avond-gradient |
| 90%+L3 (uil) | + uil in lucht, nacht-thema (achtergrond donkerder) |
| L4 (vleermuis) | + vleermuizen in lucht, dageraad-gradient |

**Zoeken — vijver:**
| Trigger | Skin |
|---|---|
| Default | Crème veld, kikkers basis |
| 8 (libel) | + libel zwemt boven veld (decoratief), waterlelies onderaan |
| 12 (reiger) | + reiger-silhouet aan rand, water-textuur |
| 16 (ijsvogel) | + ijsvogel op tak, oever-detail |
| L3 (otter) | + otter zwemt door, volle pond-scene |

**Wisselen — dierentuin:**
| Trigger | Skin |
|---|---|
| Default | Stimuli basis, cue-paneel basis-kleur |
| L1 (papegaai) | Papegaai in hoek, jungle-rand-textuur |
| L2 (giraffe) | + giraffe-silhouet, savanne-band |
| L3 (leeuw) | + leeuw-silhouet, savanne-thema volledig |
| <200ms (olifant) | + olifant, complete dierentuin-scene |

**Implementatie:**
- `src/scripts/skin.js` (nieuw, pure module): mapt `(spelId, computedMilestones, currentLevel)` → `skinConfig` object met thema-strings + asset-keys + CSS-class-namen.
- `src/scripts/skin.test.js` (nieuw): per spel fixture-driven tests dat de juiste skin retourneert per state.
- 5 spel-bestanden patch: bij sessie-start `getSkin(spelId)` aanroepen, root-element krijgt `data-skin="<config>"`. CSS in `spelen.css` heeft `[data-skin*="..."]`-selectors voor de visual swaps.
- `src/styles/spelen.css` (patch): per spel een blok met skin-varianten (extra SVG-overlays, achtergrond-gradients, character-silhouets).

**Bestaande mijlpaal-pop blijft** — de skin-shift gebeurt op de volgende sessie (rustig: geen mid-sessie-aanpassing). Geen variabele beloning, alles voorspelbaar.

Geschat: ~1.5 run.

</details>

### Fase 12 — Celebration-upgrade — ✅ KLAAR (25 apr 2026)

**Gebouwd:**
- `src/scripts/celebration.js` (nieuw, pure module): `chordVoor(milestoneId)` mapt mijlpaal-volgnummer (1-4) → akkoord-array (4 voorgedefinieerde akkoorden, hetzelfde per volgnummer over spellen — Alvah leert "dit klinkt als de eerste mijlpaal"). `bloemSvg(spelId)` retourneert SVG-string per spel: muziek-noot (Simon), ster (Corsi), zon-bloem (Day-Night), waterlelie (Zoeken), regenboog-bloem (Wisselen).
- `src/scripts/celebration.test.js` (nieuw): 7 tests pass — chord-progressie consistent + per-spel SVG.
- `src/scripts/audio.js` (patch): `playChord(freqs, durationMs, gain)` helper — multi-oscillator met per-stem gain-correctie tegen clipping. Respecteert `preferences.sound`.
- `src/styles/spelen.css` (patch): `.spel-bloei`-class met 1.5s scale + rotate keyframe, per spel een variant met spel-kleur via `currentColor`. `spel-mijlpaal-pop` keyframe verlengd 700ms → 1.2s met character-entry (translateX van rechts + scale-overshoot). Reduced-motion-veilig.
- `src/pages/spelen/reis.astro` (patch): `reis-groei` keyframe verlengd 700ms → 1.2s met rotate-overshoot voor character-feel.
- 5 spel-bestanden patches: `<div class="spel-bloei spel-bloei--<spelId>" data-bloei></div>` in einde-scherm. Op endSession: `bloeiEl.innerHTML = bloemSvg(spelId)` na toon('einde'). In `toonNieuweMijlpaal`: 200ms delay daarna `playChord(chordVoor(top.id), 1100)` voor de hoogste nieuwe mijlpaal.

**Research-anchoring:** §C.3 "Niet-verslavend ontwerp" expliciet — voorspelbare + mastery-anchored celebration. Geen confetti per correct, geen variable reward, geen streaks. Bloeiende plant + akkoord per mijlpaal-unlock = letterlijk wat research-doc als toegestaan noemt.

**Verificatie:** `node --test` 75/75 (68 oud + 7 celebration), `npx astro check` 0 errors, ToV-strict 0 blokkers, HTTP 200 op alle 9 routes.

<details>
<summary>Oorspronkelijke scope-beschrijving (Fase 12 pre-implementatie)</summary>

**Doel:** de rek tussen onze huidige (austeere) celebration en wat research §C.3 toestaat benutten. Predictable + mastery-anchored, geen variable + per-trial.

**Wat we nu hebben:**
- Feedback-ring 350-500 ms tijdens trial (correct: gloed; fout: rode ring)
- "Juist" / "Andersom" status-tekst
- Sparkline op einde-scherm
- Mijlpaal: 700ms pop-animatie + groei-fragment-anchor

**Wat we toevoegen (allemaal voorspelbaar, niet random):**

1. **Bloeiende plant op einde-scherm (research §C.3 noemt dit letterlijk):** SVG-zaadje → bloem in 1.5s, single keyframe. Per-spel een eigen variant: muziek-noot voor Simon, ster voor Corsi, zon-bloem voor Day-Night, waterlelie voor Zoeken, regenboog-bloem voor Wisselen. Toggle-baar via bestaande `preferences.sparklineInEinde` of nieuwe `preferences.eindeAnimatie`. Reduced-motion-veilig (statische bloei).

2. **Single audio-chord bij mijlpaal-unlock:** één akkoord, hetzelfde elke keer per dier (predictable). Voorbeelden: trom-aap = lage rommel-toon; gitaar-flamingo = G-majeur akkoord; zang-vos = dorian melodie 3-note; piano-uil = vol Cmaj9-akkoord. Audio.js krijgt `playChord(notes[], duration)` helper. Respecteert `preferences.sound`.

3. **Mijlpaal-pop-animatie uitbreiden 700ms → 1.2s met character-entry:** dier-silhouet zweeft 200ms in van rechts, vergroot 600ms in mid-stap, settle 400ms. Eén keer per nieuwe mijlpaal, niet per trial.

4. **Reis-pagina micro-detail:** bij scroll-in-view van bereikte badge een subtiele "ademing"-puls (1.5s opacity 0.85 → 1.0 → 0.85, eenmaal). Reduced-motion: geen puls.

5. **Sessie-end "Goed bezig"-uitspraak (optioneel):** als `preferences.tts === true`, audio-uitspraak "Goed bezig" via speechSynthesis bij einde-scherm. Default uit (kan irriterend worden), opt-in.

**Wat we NIET toevoegen:**
- Confetti (research-vlag)
- Per-correct-trial-pop (variable reward)
- Streak-counter ("X dagen op rij!")
- Surprise-drops ("je hebt een nieuwe vaardigheid ontgrendeld!")
- Speed-rounds met countdown

**Bestanden:**
- `src/styles/spelen.css` (patch): nieuwe keyframes voor bloei + mijlpaal-uitbreiding + reis-puls.
- `src/scripts/audio.js` (patch): `playChord(notes, durationMs, gain)` helper.
- `src/scripts/celebration.js` (nieuw, pure config): per-mijlpaal chord-config + plant-variant per spel.
- 5 spel-bestanden (patch): bloei-SVG + chord-call op einde-scherm.
- `src/pages/spelen/reis.astro` (patch): in-view-puls via IntersectionObserver.

Geschat: ~1 run.

</details>

---

## 7. Volgorde — bouwen én aanraden

**Bouwvolgorde (welk spel eerst af):** Simon → Visual-Search → Corsi → Day-Night → Wisselen.
**Reden:** Simon sluit de storage-loop met minimale complexiteit. Visual-Search is visueel het meest speels en bouwt zelfvertrouwen. Corsi + Day-Night zijn research-kern (WM + inhibitie). Wisselen is cognitief het zwaarst → laatst.

**Admin-pagina (fase 6) tussen fase 2 en fase 3:** zodra er data van twee spellen is, is het nuttig om te kunnen lezen. Ontkoppelt test-effort van elke nieuwe game.

**Mijlpalen & visuele collectie (fase 7) ná fase 5:** systeem kent dan alle vijf de datavormen → unlocks consistent in één pass. Wel vanaf fase 1 kleine hook-stubs: `saveSession` roept `onSessionComplete` aan die in fase 7 mijlpalen evalueert.

**Progressie-ontwerp (fase 6.5) tussen fase 6 en fase 7:** mijlpaal-drempels in fase 7 hebben vaste regels nodig over wat een "geldige sessie" is en hoe `currentLevel` zich tussen sessies verplaatst. Fase 6.5 legt die regels vast in één pure module (`progressie.js`) + patches in alle 5 spel-bestanden. Bevat open vragen die in die run beantwoord moeten worden — zie antwoord-template aan het eind van blok 6.5.

**Aanrader op de landing (`/spelen`):** in plaats van Alvah elke keer zelf laten kiezen uit vijf, toont de landing **één aanbevolen spel voor vandaag** (grote tegel) + de andere vier kleiner eronder. De aanbeveling volgt drie eenvoudige regels (pure functie `src/scripts/aanraden.js`, unit-test verplicht):

1. **Niet herhalen:** sla het spel over dat laatst is gespeeld.
2. **Succes-bias (motivatie):** kies bij voorkeur een spel waar accuracy ≥70% was in de laatste 3 sessies. Zo start hij met een winst-gevoel.
3. **Afwisseling over de week:** als een spel >7 dagen niet gespeeld is, prioriteer dát boven "favoriet".

Als er nog geen data is, of alle accuracy is laag (slechte dag, te zwaar ingesteld): **altijd Simon**, het opstartspel. Dat kan hij bijna niet verliezen → zelfvertrouwen herstellen.

**Scope-kanttekening:** de aanrader is een stub (default-volgorde) in fase 0, krijgt echte logica in fase 8. Niks in de spel-bouwfases 1–5 hangt ervan af.

---

## 8. Vastgesteld (beslissingen definitief)

| # | Beslissing | Keuze |
|---|---|---|
| 1 | Route | `/spelen/*` (los van `/oefeningen/*`) |
| 2 | CLAUDE.md | Restricties er sowieso uit — reeds doorgevoerd in CLAUDE.md |
| 3 | Palet | Papier-basis + 4 speelvlak-kleuren + gradients toegestaan (rustig, max twee kleuren) |
| 4 | Volgorde | Bouwvolgorde = engagement-eerst (Simon → Visual-Search → Corsi → Day-Night → Wisselen); landing-pagina toont één aanbevolen spel per dag via `aanraden.js` met succes-bias en afwisseling |
| 5 | Admin-auth | Geen — directe URL `/spelen/admin`. Toont volledige localStorage-JSON in een `<pre>`-blok met kopieer-knop |
| 6 | Avatar-keuze | Overslaan |
| 7 | Sparkline bij Alvah | Default **aan** (rustig klein element in einde-scherm, feit-taal, uit-zetbaar vanuit admin) — tenzij je alsnog nee zegt |
| 8 | Mijlpaal-thema's | Dieren dwars door alles heen (vijver+kikkers in zoeken, dierenbandje in Simon, nachtbos in Corsi, dieren-dagcyclus in Day-Night, dierentuin in Wisselen) |
| 9 | Unlocks per spel | 4 (16 totaal) |
| 10 | Fysieke cadeaus via admin | Aan — papa koppelt in admin cadeaus aan mastery-thresholds, software flagt, papa regelt zelf |

Plan is daarmee bouwklaar. Fase 0 kan in één run.

---

## 9. Wat we bewust NIET doen

- Geen jsPsych embedden — te zwaar (200 KB+), eigen UI-taal wordt gecompromitteerd. Research-repo is **leesbron**, niet runtime.
- Geen claims dat dit Alvah's ADHD/dyslexie/schoolprestaties verbetert. De meta-analyses (Melby-Lervåg 2016, Sala & Gobet 2020, Gobet & Sala 2023) sluiten far-transfer uit. Framing = plezier, ritueel, zelfvertrouwen, trend-zicht voor behandelaar.
- Geen nieuwe dependencies. Alles vanilla JS + Astro `<script>`.
- Geen server, geen auth, geen backend. Alles client-side, lokaal.
- Geen achternamen of persoonsgegevens in de code of data (CLAUDE.md-rule 1, blijft gelden).
