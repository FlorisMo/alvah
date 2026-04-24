# Plan — Oefenspelletjes voor Alvah

Meta-plan dat `docs/source/Research-practice-tools.md` omzet naar een faseerbare bouw. Elke fase is klein genoeg voor één Claude Code-run met marge (<~90 min, <~500 regels nieuwe code, één à twee bestanden van betekenis).

---

## Hervat-gids — lees dit eerst bij een nieuwe sessie

**Status (24 apr 2026):** Fase 0, 1 (Simon), 2 (Corsi), 3 (Day-Night) en 6 (Admin) zijn **klaar**. Zie §6 voor per-fase details. Alles draait lokaal via `npm run dev`; er is nog niet gedeployed en dat moet bewust gebeuren (gate + privacy-checks staan aan).

**Volgende stap:** Fase 4 — Visual Search / Zoek de kikker. Scope staat beschreven in §6. Fase 4 past in één run. Daarna Fase 5 (Wisselen), dan Fase 7 (mijlpalen) + Fase 8 (polish).

**Snelle verificatie bij hervatten:**

```bash
node --test src/scripts/*.test.js    # verwacht: 16 pass, 0 fail
npx astro check                      # verwacht: 0 errors, 0 warnings, 0 hints
npm run dev                          # → /spelen laadt, Simon/Corsi/Day-Night speelbaar, /spelen/admin toont overzicht
```

**Wat er staat en wat niet:**

- `/spelen` (landing) toont Simon als aanbevolen-stub, 2 andere speelbare tegels (Corsi + Day-Night), 2 tegels als "Nog niet beschikbaar" (Zoeken + Wisselen).
- `/spelen/simon`, `/spelen/corsi`, `/spelen/day-night` zijn volledig speelbaar, loggen naar `localStorage` sleutel `alvah-ef-v1`.
- `/spelen/admin` toont per spel sparkline + tabel laatste 10 sessies, "deze week" KPI, JSON-copy/download/import, wis-alles met dubbele bevestiging.
- `/spelen/zoeken`, `/wisselen`, `/reis` bestaan **nog niet**. De landing heeft nog steeds een link naar `/reis` — die geeft 404 tot Fase 7.
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

### Fase 4 — Visual Search / Zoek de kikker (1 run)
**Doel:** aandacht, hoog engagement, niet-verbale taak.
**Bestanden:** `src/pages/spelen/zoeken.astro` (nieuw).
**Recept:** SVG-veld met N kikkers, staircase op set-size 4→16, 3 unlock-niveaus (feature → conjunction → bewegend).
**Acceptatie:** sessie speelbaar, false-alarms gelogd.

### Fase 5 — Cued Task-Switching (1 run, zwaarste)
**Doel:** flexibiliteit, beste evidence-transfer bij kinderen (Karbach & Kray 2009).
**Bestanden:** `src/pages/spelen/wisselen.astro` (nieuw).
**Recept:** cue-symbool + kleur/vorm-stimulus, 3 blokken (pure-kleur, pure-vorm, AABB-switch), verbal self-instruction prompt.
**Acceptatie:** switch-cost zichtbaar in summary (meanRT_switch − meanRT_repeat).

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
