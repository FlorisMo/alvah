# Plan — Oefenspelletjes voor Alvah

Meta-plan dat `docs/source/Research-practice-tools.md` omzet naar een faseerbare bouw. Elke fase is klein genoeg voor één Claude Code-run met marge (<~90 min, <~500 regels nieuwe code, één à twee bestanden van betekenis).

---

## Hervat-gids — lees dit eerst bij een nieuwe sessie

**Status (24 apr 2026, derde run):** Fases 0–6 + 6.5 **klaar**. Alle vijf spellen speelbaar; admin toont alle data + plateau-banner; progressie-regels actief (seed warm-up, alleen-omhoog-currentLevel, harde geldigheid, level-systeem voor DN/Wisselen). Fase 7 (mijlpalen + `/spelen/reis`) en Fase 8 (polish) staan nog open.

**Volgende stap:** Fase 7 — Mijlpalen + visuele collectie + `/spelen/reis`. Bouwt op `progressie.js::countRecentAtOrAbove` voor "2 van laatste 3 geldige sessies"-drempels. Raakt 5 spel-bestanden (groei-fragment na summary), `mijlpalen.js` (stub → drempels), `reis.astro` (nieuw), admin-banner voor behaalde mijlpalen + cadeau-lijst.

**Daarna:** Fase 8 (polish — homepage-haak, onboarding, `pickNext()` echt aanzetten).

**Beslissingen vastgelegd in Fase 6.5:** A1=`cL-1`, A2=alleen-omhoog, B1=3 reversals, C1=hybride (2 in eerste 2min, anders 3), C2=alleen span-spellen, D1=hard, D2=2 van laatste 3, E1=14d/3s, F1=level-schema nu, F2=80%+trialsN≥24, F3=geen mid-sessie demotie. Zie `src/scripts/progressie.js`-header-comment.

**Snelle verificatie bij hervatten:**

```bash
node --test src/scripts/*.test.js    # verwacht: 16 pass, 0 fail
npx astro check                      # verwacht: 0 errors, 0 warnings, 0 hints
npm run dev                          # → /spelen laadt, alle 5 spellen speelbaar, /spelen/admin werkt
```

**Wat er staat en wat niet:**

- `/spelen` (landing) toont Simon als aanbevolen-stub, 4 andere speelbare tegels (Zoeken, Corsi, Day-Night, Wisselen). Geen "binnenkort"-tegels meer.
- Alle 5 spel-routes zijn volledig speelbaar en loggen naar `localStorage` sleutel `alvah-ef-v1`:
  `/spelen/simon`, `/spelen/corsi`, `/spelen/day-night`, `/spelen/zoeken`, `/spelen/wisselen`.
- `/spelen/admin` toont per spel sparkline + tabel laatste 10 sessies, "deze week" KPI, JSON-copy/download/import, wis-alles met dubbele bevestiging.
- `/spelen/reis` bestaat **nog niet** (Fase 7). De landing heeft nog steeds een link naar `/reis` — die geeft 404 tot Fase 7.
- `src/scripts/mijlpalen.js` bestaat als stub — drempels per spel moeten in Fase 7 gevuld worden. `src/scripts/aanraden.js` heeft echte logica maar landing gebruikt nog de stub (default-volgorde). In Fase 8 kan de landing `pickNext()` écht gebruiken.
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

**Dingen die we bewust NIET doen:** confetti bij elk goed antwoord, variabele beloning, streaks met verliesaversie, leaderboard, levens, countdown-timers die alles verliezen bij missen.

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

### Fase 7 — Mijlpalen & visuele collectie (1 run)
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

### Fase 8 — Polish (1 run)
**Doel:** homepage-haak voor Alvah, frustratie-opvang, geluid-toggle persistent, onboarding "kies je avatar-vorm" voor autonomie-gevoel.
**Bestanden:** kleine tweaks in `src/pages/index.astro`, `SpelShell.astro`, `spelen.css`.
**Acceptatie:** vanaf `/` één-klik naar `/spelen`, "te moeilijk"-knop schakelt spel naar lager niveau zonder commentaar.

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
