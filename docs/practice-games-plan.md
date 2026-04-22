# Plan — Oefenspelletjes voor Alvah

Meta-plan dat `docs/source/Research-practice-tools.md` omzet naar een faseerbare bouw. Elke fase is klein genoeg voor één Claude Code-run met marge (<~90 min, <~500 regels nieuwe code, één à twee bestanden van betekenis). Onderstaande principes en open beslissingen moeten vóór fase 1 vastgezet worden.

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

### Fase 0 — Fundament + referentie-repo's (1 run, geen spel)
**Doel:** CLAUDE.md-uitzondering + utilities + lege shell + docs/schema + referentie-repo's lokaal en read-only.
**Stappen:**
1. `mkdir reference && echo "reference/" >> .gitignore`
2. Clone vier MIT-repo's (zie sectie 4) in `reference/`.
3. `chmod -R a-w reference/` — alle referenties read-only.
4. `CLAUDE.md` uitbreiden: `/spelen`-carve-out (localStorage ja, cookies nee, scripts alleen in `/spelen`-subtree en `src/scripts/`) + clean-room-regel voor `reference/`.
5. `docs/practice-games-schema.md` (JSON-schema van localStorage).
6. `src/scripts/{storage,timer,scoring,staircase,audio,strings.nl}.js` — minimale werkende implementaties, logica geschreven zonder naar `reference/` te copy-pasten. Voor `scoring.js` en `staircase.js` één pure unit-test per module (`node --test`).
7. `src/styles/spelen.css` met speelvlak-palet + shell-tokens.
8. `src/layouts/SpelShell.astro` + `src/pages/spelen/index.astro` (lege landing met 5 placeholder-tegels).

**Acceptatie:** `npm run dev` → `/spelen` laadt zonder errors, 5 tegels zichtbaar (disabled), `node --test src/scripts/*.test.mjs` groen, `ls reference/` toont vier read-only repo's, `git status` toont `reference/` niet (want gitignored).
**Risico:** laag. Pure scaffolding.

### Fase 1 — Simon-patroon (1 run, eerste echte spel)
**Doel:** opstartspel, sluit storage-loop end-to-end. Per research: laagdrempelig, motiverend, turn-taking mogelijk.
**Bestanden:** `src/pages/spelen/simon.astro` (nieuw), kleine tweaks in `strings.nl.js` als nodig.
**Recept:** 4 panelen (groen/blauw/oranje/magenta + vorm-icoon), Web Audio tonen, sequentie +1 per ronde, cap 9, "nog een keer?" bij fout. Trial-log + summary → `saveSession("simon", …)`.
**Acceptatie:** 1 volledige sessie speelbaar, data zichtbaar in DevTools → `localStorage["alvah-ef-v1"]`.

### Fase 2 — Corsi Block Tapping (1 run)
**Doel:** research-top-1 (visuospatieel WM, klassiek gevalideerd).
**Bestanden:** `src/pages/spelen/corsi.astro` (nieuw).
**Recept:** 9 SVG-sterren op vaste posities in 400×400 grid, staircase 2-down/1-up, start span 2, max span 9. Trial-log + summary.
**Acceptatie:** sessie van 12 trials of 4 min, summary-scherm met sparkline van vorige sessies.

### Fase 3 — Day-Night Stroop (1 run)
**Doel:** inhibitie-kern (Gerstadt/Hong/Diamond 1994), volledig non-verbaal.
**Bestanden:** `src/pages/spelen/day-night.astro` (nieuw).
**Recept:** zon/maan stimulus (SVG), twee grote knoppen DAG/NACHT, 3 blokken × 16 trials, progressie mixed → incongruent.
**Acceptatie:** sessie speelbaar, accuracy + mean RT in localStorage.

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

### Fase 6 — Admin-pagina (1 run, kan parallel aan 2–5)
**Doel:** papa kan data lezen en naar LLM kopiëren.
**Bestanden:** `src/pages/spelen/admin.astro` (nieuw).
**Recept:** per spel een sparkline (inline SVG `<polyline>`), tabel laatste 10 sessies, totaal minuten deze week, "Kopieer JSON naar klembord"-knop, "Download JSON"-knop, "Importeer JSON", "Wis alles" (dubbele bevestiging).
**Acceptatie:** lege-staat + gevulde-staat werken; copy-to-clipboard getest.

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
