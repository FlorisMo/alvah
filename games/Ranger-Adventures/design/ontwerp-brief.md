# Ontwerp-brief — "Ranger van de Veluwe"

**Voor:** Claude Design
**Door:** samen ontworpen door Floris (vader) en Alvah (zoon, 8) — live sessie, 20 juni 2026
**Doel van dit document:** Claude Design kent het Alvah-project nog niet. Dit is de volledige context om een klikbaar ontwerp te maken van de **eerste missie** van een nieuwe spel-laag, in de bestaande look-and-feel van de site. Alles hieronder is uit de echte repo (`FlorisMo/Alvah`) gehaald, niet verzonnen.

---

## 1. Wat we bouwen (de kern, in één alinea)

Een verhaal-laag boven de bestaande oefenspellen van Alvah's site. De speler is **ranger op de Veluwe** en zorgt voor de dieren via **missies**. Het slimme idee: de executieve functies (de "breinkrachten") die de bestaande mini-games trainen, zitten nu **verstopt in echt ranger-werk** in plaats van in een los puzzelscherm. Niet "open het Corsi-blokjesspel", maar "onthoud welke route de kudde nam en wijs hem terug" — dat *is* Corsi, maar het voelt als ranger-werk. Het is dus géén zesde los spel, maar een omhulsel dat de 5 bestaande mini-games betekenis geeft. De Veluwe is gebied 1, zo gebouwd dat er later gebieden bij kunnen. Visuele stijl: **Pokémon-Game-Boy** — top-down wereld om in te lopen, en op sleutelmomenten zoom je in op mooi ontworpen 2D-platen met dieren en animatie.

---

## 2. De eerste missie: "De verdwaalde frisling"

Een jong wild zwijn (een **frisling**) is zijn groep (een **rotte**) kwijt. De ranger brengt het veilig terug. *(Biologische termen worden later met deep research geverifieerd — frisling/rotte zijn werkhypotheses.)*

**De flow die we samen bedachten:**

1. **Intro-reis (keuze).** Je reist naar het gebied. De speler kiest het vervoer: **auto, motor of helikopter**. Korte, coole animatie. (Dit is puur sfeer + agency, geen EF.)
2. **Ranger-briefing.** Een leesbaar scherm met **grote letters, simpele taal op leesniveau** (zie §6), dat uitlegt wat je moet doen. Voorleesknop aanwezig (bestaat al in de shell). Eén instructie per regel.
3. **Naar buiten — top-down gras.** Hier begint stap 1. Pokémon-stijl van bovenaf.
   - **Stap 1 — Spot de frisling.** Zoek het jong in hoog gras. → breinkracht: **volgehouden aandacht + visueel zoeken** (logica van het bestaande *Zoeken*-spel).
   - **Stap 2 — Onthoud het pad.** De rotte liep een route; onthoud en wijs hem terug. → breinkracht: **volgorde-geheugen** (logica van *Corsi*).
   - **Stap 3 — Gevaar ontwijken op de terugweg.** Onderweg rustig blijven en niet elk dier benaderen / het juiste pad kiezen. → breinkracht: **impulscontrole / remmen** (logica van *Dag & Nacht*). *(Dit stukje voegde Alvah zelf toe: "nog een keer gevaar ontwijken op de terugweg naar moeder is cool.")*
   - **Stap 4 — Hereniging.** De frisling vindt de rotte terug. Beloning: bloei-animatie + ranger-badge.

**Belangrijk ontwerpprincipe (van Floris):** integreer de *gedachte* achter de mini-games slimmer dan ze exact na te spelen. De EF-eis (zoeken, volgorde onthouden, impuls remmen) moet in de ranger-handeling zitten, niet als herkenbaar "nu komt het puzzelscherm".

---

## 3. De 5 breinkrachten → ranger-vertaling (voor latere missies)

| Bestaand spel | Breinkracht (EF) | Ranger-vertaling |
|---|---|---|
| Simon | werkgeheugen (volgorde, audio-visueel) | medicijnstappen / handelingsvolgorde bij de dierenarts onthouden |
| Corsi | visueel-ruimtelijk volgordegeheugen | een route of pad van een dier onthouden en terug-wijzen |
| Zoeken | volgehouden aandacht + response-inhibitie | gecamoufleerd/verstopt dier vinden, stropersval spotten |
| Dag & Nacht | inhibitie (Stroop-achtig: zeg het omgekeerde) | niet elk dier benaderen; rustig blijven; juist gedrag kiezen |
| Wisselen | cognitieve flexibiliteit (taakwisseling) | de ene missie sorteert op soort, de volgende op leefgebied — regel wisselt |

---

## 4. Hoe het in de BESTAANDE bouw past (technische context)

De site is een **Astro**-project. Relevante bestaande structuur:

- **`src/layouts/SpelShell.astro`** — gedeelde shell voor elk spel. Heeft: terug-knop (pijl naar `/spelen`), spel-titel `<h1>`, **geluid-toggle** (persistent), en een **voorlees-knop** (TTS) die een `instructie`-prop voorleest. De nieuwe missie zou hierin moeten passen of dit patroon volgen.
- **`src/pages/spelen/`** — bestaande routes: `index.astro` (landing), `simon`, `corsi`, `day-night`, `zoeken`, `wisselen`, `reis` (mijlpalen-overzicht), `admin`. Een missie zou bv. `spelen/veluwe.astro` of `spelen/missie/frisling.astro` kunnen worden.
- **Gedeelde scripts** (`src/scripts/`) — deze MOET de missie hergebruiken, niet opnieuw uitvinden:
  - `staircase.js` — adaptieve moeilijkheid (past zich aan het kind aan, reversals).
  - `scoring.js` — vult de gemeenschappelijke summary-laag (accuracy, meanRT, sdRT, iivCV, trialsN).
  - `progressie.js` — cross-session level-logica (80%+ en trialsN≥24 om te stijgen; geen mid-sessie demotie).
  - `mijlpalen.js` — 20 mijlpalen (4 per spel) + `evalueerNieuwBereikt()`. Ranger-badges zouden hier een nieuwe skin/laag overheen zijn.
  - `storage.js` — schrijft naar localStorage sleutel **`alvah-ef-v1`** (zie §5). Auto-prune. Geen server, alles client-side.
  - `celebration.js` — bloei-plant + audio-chord op eindscherm (voorspelbare beloning).
  - `skin.js` — mastery-getriggerde visuele variatie (niveau 0-4 tint).
  - `audio.js`, `timer.js`, `strings.nl.js` (alle NL-teksten centraal).
- **Belofte van geen-tracking:** het data-object verlaat nóóit de browser. Geen fetch/beacon. Enige exit: JSON-export in `/spelen/admin`. Houd dit principe heilig in het ontwerp.

**Voor het ontwerp betekent dit:** de missie is een nieuwe *presentatie-laag* (verhaal, kaart, scènes) bovenop bestaande, bewezen mechaniek. Elke stap logt nog steeds een sessie via dezelfde scoring/staircase/storage-pipeline.

---

## 5. Data-schema (bestaand, `alvah-ef-v1`)

Eén localStorage-sleutel, één JSON-object, `schemaVersion: 1`. Structuur:

- `preferences`: `{ sound, reducedMotion, textSize ("large" default), sparklineInEinde, toonReferenties }`
- `exercises[id]`: `{ currentLevel, highestLevel, sessions[] }`
- elke sessie: `{ id, date, level, durationMs, trials[], summary }`
- gemeenschappelijke summary: `accuracy, meanRT, sdRT, iivCV, trialsN`
- `mijlpalen`: `{ bereikt: [ids], cadeaus: [{id, milestoneId, omschrijving, status}] }`
- id-conventie mijlpaal: `<spelId>-<volgnummer>` (bv. `corsi-2`).
- **Cadeaus:** vader koppelt in `/spelen/admin` een fysiek cadeau (bv. "LEGO-set") aan een mijlpaal. Status `open` → `uitgereikt`.

De missie-laag kan een nieuw `exercises`-id of een `missions`-uitbreiding gebruiken — maar moet `schemaVersion` netjes migreren (bestaande `storage.js::migrate`).

---

## 6. Leesniveau & toegankelijkheid (KRITISCH)

Alvah is 8, heeft een **dyslexieprofiel** en oefent met lezen. Uit het dossier (DMT-scores B4 nov 2025) leest hij rond **AVI M3/E3** — bij dyslexie op deze leeftijd normaal. Dat bepaalt ALLE tekst in de missie:

- **Korte zinnen.** 3-7 woorden per zin. Eén instructie per regel.
- **Grote letters.** De site gebruikt `textSize: "large"` als default (body schaalt naar 20px). Briefing-tekst nog groter.
- **Bekende, concrete woorden.** Geen abstracte of lange woorden.
- **Dyslexie-vriendelijk:** rustige regelafstand, niet te veel contrast (de boeken-research noemt getint papier i.p.v. fel wit), genoeg witruimte. Overweeg een dyslexie-vriendelijk lettertype voor de leestekst.
- **Voorleesknop altijd aanwezig** (bestaat al als TTS in de shell).
- **Succes-gericht, nooit vergelijkend.** Uit het dossier: zwakke lezers oefenen het best door te herhalen wat *goed* ging, niet door te drillen op fouten. Nooit vergelijken met leeftijdsgenoten.
- Alvah houdt van **Pokémon** (bevestigd in de boeken-research) — vandaar de gekozen stijl.

**Voorbeeld-briefing op niveau (concept, mag aangepast):**
> Hoi ranger!
> Een klein zwijntje is zijn mama kwijt.
> Hij is nog maar net geboren.
> Hij is bang en alleen.
> Kun jij hem terugbrengen?
> Zoek hem eerst in het gras.
> [knop: Ik ga!]  [knop: 🔊 Lees voor]

---

## 7. Tone of voice (uit `strings.nl.js` + `tone-of-voice-alvah-site-nl.md`)

De bestaande spel-stem is **direct, feit-taal, geen hype**. Letterlijk uit de strings:

- Feedback **zonder uitroeptekens**: "Goed bezig", "Probeer maar", "Nog een keer", "Juist".
- GEEN "kanjer / held / ons mannetje"-stem. Eén niveau warmer dan het zakelijke dossier, maar nuchter.
- Knoppen: "Start", "Pauze", "Doorgaan", "Nog een keer", "Dit is te moeilijk".
- Bij stijgen/dalen van niveau neutraal: "Oké, iets korter", "Dit niveau beheers je nu: X".
- Het kind heet **Alvah**. De spel-sectie heet "Spelen"; mijlpalen heten "Jouw reis".

Voor de ranger-missie mag de stem ietsje avontuurlijker (het is een verhaal voor een 8-jarige), maar blijf binnen deze grens: warm en uitnodigend, niet schreeuwerig, geen overdaad aan uitroeptekens, geen "superheld"-taal.

---

## 8. Visuele stijl-tokens (uit de echte site-CSS)

Neem deze mee zodat het ontwerp bij de bestaande site past.

**Algemene site (`global.css` `:root`):**
- `--green: #1e4d32` (hoofd-groen), `--green-deep: #123621`, `--green-soft: #f0f5ec`, `--green-line: #c8d6c0`
- `--ink: #1a1a1a`, `--ink-soft: #4a4a4a`, `--ink-muted: #7a7a7a`
- `--paper: #fdfcf8` (warme off-white achtergrond — niet fel wit, dyslexie-vriendelijk)
- `--line: #e8e5dc`, `--accent-warm: #d9b89a`, `--red-warn: #9b3d2e`
- Heading-font: **Fraunces** (serif). Body-font: **Inter Tight** (sans).

**Spel-sectie (`spelen.css` `:root`, eigen vrolijker palet):**
- `--spel-blue: #2b5fb8` / soft `#e7eefa`
- `--spel-orange: #ef7a1f` / soft `#fdeedd`
- `--spel-magenta: #c94174` / soft `#fbe6ee`
- `--spel-sun: #f5c23b` + glow `rgba(245,194,59,0.35)`
- radii: `--spel-radius: 14px`, `--spel-radius-lg: 20px`
- landing-hero gebruikt een groen→blauw gradient: `linear-gradient(135deg, var(--green-soft) 0%, var(--spel-blue-soft) 100%)`.

**Aanbeveling voor de ranger-look:** bouw voort op het natuur-groen (`--green`, `--green-soft`) als basis-wereldkleur, gebruik het vrolijke `--spel-*`-palet voor UI-accenten (knoppen, badges), en de warme `--paper`/`--accent-warm` voor briefing-panelen. Game-Boy/Pokémon-gevoel via top-down tegels, maar met deze warmere, natuurlijkere kleuren in plaats van Game-Boy-groen.

---

## 9. Wat we van Claude Design vragen (scope van het ontwerp)

Een **klikbaar ontwerp van missie 1**, met deze schermen:
1. **Vervoerkeuze** (auto / motor / helikopter) — intro-sfeer.
2. **Ranger-briefing** — grote letters, leesniveau M3/E3, voorleesknop, "Ik ga!"-knop.
3. **Top-down wereld** — Pokémon-stijl, frisling spotten in het gras (stap 1).
4. **Route-onthouden** — stap 2 (Corsi-logica, ranger-verpakt).
5. **Gevaar ontwijken** op de terugweg — stap 3 (inhibitie).
6. **Hereniging + beloning** — bloei-animatie, ranger-badge.

**Stijl:** top-down wereld; ingezoomde, mooi ontworpen 2D-platen met dieren + animaties op sleutelmomenten. Warme natuur-kleuren uit §8. Tekst op niveau uit §6. Toon uit §7.

**Schaalbaarheid:** ontwerp de Veluwe zo dat later andere gebieden toegevoegd kunnen worden (bv. een overzichtskaart met gebied-pins als hoofdscherm, waar je per missie inzoomt naar een scène).

---

## 10. Vervolgstappen na het ontwerp

1. **Claude Design** → klikbaar ontwerp (deze brief).
2. **Claude Code** → strakke implementatie in de bestaande Astro-repo, hergebruik van `staircase/scoring/progressie/mijlpalen/storage/celebration`. (In het plan `docs/practice-games-plan.md` staat dit als de werkwijze; nieuwe paradigma's stonden al gepland als "Fase 10".)
3. **Claude Deep Research** → biologische verificatie (frisling, rotte, Veluwe-fauna, diergedrag) zodat de inhoud klopt.

---

### Bron-notitie
Alle bovenstaande feiten komen uit de repo `FlorisMo/Alvah` (o.a. `docs/practice-games-plan.md`, `docs/practice-games-schema.md`, `src/scripts/strings.nl.js`, `src/styles/global.css`, `src/styles/spelen.css`, `src/layouts/SpelShell.astro`, `docs/source/dossier.md`, `docs/source/research-boeken.md`, `docs/tone-of-voice-alvah-site-nl.md`) en uit twee skills in de Nestr-workspace *Nestr Templates*: **Deep Inquiry** en **Project Definition**.
