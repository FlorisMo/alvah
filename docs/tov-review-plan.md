# ToV-review plan — alle content langs de tone-of-voice-lat

**Status**: klaar om uit te voeren.

**Doel**: de bestaande content (alles in `src/pages/` en `src/content/`) systematisch
langs `docs/tone-of-voice-alvah-site-nl.md` leggen, zonder de structuur, ankers of
layout te raken. Output is een site waarin geen stuk tekst meer voor generieke AI,
opvoedblog of inspiratie-porno kan doorgaan.

**Verhouding tot `next-steps-plan.md`**: Fase 11 daar is de beknopte placeholder.
Dit document is de uitwerking. Volgorde-advies blijft: pas na Fase 8 (structuur
stabiel), zodat het één schone commit-reeks is.

**Hoe te gebruiken**: elke fase is zelfstandig uitvoerbaar in een sessie van 60–90
minuten. Per fase één commit met herkenbare message (`ToV 1.2: verboden woorden sweep`,
`ToV 2.3: /dossier herschreven`). Niet doorgaan bij een rood vinkje.

---

## Drie doctrines

1. **Alleen taal, geen structuur**. Anchors, ids, `chapters`-arrays, italic-cijfer-koppen
   en HTML-klassen blijven ongemoeid. Als een edit zowel stijl als structuur raakt,
   splits je hem.
2. **Ruis vóór nuance**. Eerst mechanische sweeps (em-streepjes, verboden woorden,
   uitroeptekens). Daarna pas pagina-per-pagina inhoudelijk werk. Andersom gaat je
   aandacht verloren aan vervuiling terwijl je iets diepers probeert te beoordelen.
3. **Twijfel wordt een markering, geen rewrite**. Bij aarzeling: inline
   `<!-- TOV: [korte notitie] -->` en doorgaan. Tweede pass beslist. Dat houdt
   sessies afgegrensd en voorkomt dat je vastloopt op één passage.

---

## Scope

**Wel in scope:**
- Alle pagina's in `src/pages/` (m.u.v. `404.astro` en de `spelen/` subtree).
- Alle content in `src/content/oefeningen/`, `src/content/milestones/`, `src/content/vragen/`.

**Niet in scope:**
- `src/pages/spelen/**` — eigen plan (`docs/practice-games-plan.md`).
- `research/` — input-materiaal, bevroren.
- `docs/tone-of-voice-alvah-site-nl.md` — de norm zelf.
- Structurele wijzigingen, nieuwe content, layout, schema's.

**Ruwe nulmeting (2026-04-24, pre-review):**
- 11 pagina's, ~3.210 regels.
- 40 oefeningen, 5 milestones, 19 vragen.
- Ruwe `grep` voor em-streepjes: ~346 hits in `src/pages/` + `src/content/`.
- ~62 uitroeptekens in dezelfde scope (exclusief code/CSS).
- Verboden-woord-treffers o.a.: `kanjer` (2), `held` (1), `empoweren` (1),
  `goud waard` (2), `onmisbaar` (1), `game-changer` (1).
- Actuele baseline wordt in Fase 0.2 opnieuw gemeten met het script.

---

## Volgorde

```
Fase 0 (voorbereiden)
  → Fase 1 (mechanische sweeps)
    → Fase 2 (pagina-per-pagina)
      → Fase 3 (content collections)
        → Fase 4 (cross-cutting patronen)
          → Fase 5 (borging)
```

Totaalindicatie: 8–12 uur, verdeeld over 6–10 sessies van max 90 min.

---

## Fase 0 — Voorbereiden (45 min)

### Stap 0.1 — ToV-gids in het hoofd zetten

Lees `docs/tone-of-voice-alvah-site-nl.md` in één zit, inclusief de vijf
voor/na-voorbeelden en de checklist. Geen aantekeningen maken. Doel is niet dat
je het uit je hoofd kent, maar dat de *stem* actief in je hoofd zit als je de
eerste pagina openslaat.

### Stap 0.2 — `scripts/check-tov.mjs` maken en baseline meten

Zie Fase 11.1 in `next-steps-plan.md` voor de initiële categorieën. Breid uit met
wat ik hieronder vastleg.

**Categorieën (niet-blokkerend, rapporteert alleen):**

| Categorie | Regex / match | Actie |
|---|---|---|
| Em-streepje | `—` (U+2014) | altijd fixen |
| Uitroepteken | `!` in tekst-velden | heroverwegen per hit |
| Verboden woorden | zie Bijlage A | per hit beoordelen |
| AI-clichés | delve/unlock/journey/empower/bloeien etc. | fixen |
| Vulling | `eigenlijk`, `eerlijk gezegd`, `letterlijk` | beoordelen per context |
| Genderconstructie | `hij of zij`, `hem of haar` | fixen |
| Aandoening-eerst | `dyslexie(kinderen\|patiënt\|leerling)`, `PKU-kind` | beoordelen |
| Retorisch tag | `, toch\?`, `, right\?` aan zinseinde | fixen |

Exit altijd 0. Output als `file:line:category:match`, gesorteerd per pagina.
Script komt in `package.json` als `check:tov`, **niet** in `verify` — ToV is
sturing, geen harde test.

Draai het script en bewaar de output als `docs/tov-baseline.txt` (niet
committen, lokaal artefact). Dit is je pre-beeld: aan het eind vergelijk je
ermee.

### Stap 0.3 — Progress-tracker in dit document

Onderaan dit bestand staat een checklist per bestand (Bijlage D). Vink bij
elke behandelde pagina/entry af. Dat is de enige state die meereist tussen
sessies.

### Validatie-gate Fase 0
- [ ] ToV-gids in één zit gelezen
- [ ] `scripts/check-tov.mjs` draait, baseline weggeschreven naar `docs/tov-baseline.txt`
- [ ] `package.json` heeft `check:tov` script
- [ ] Geen toevoeging aan `verify` (bewust)

---

## Fase 1 — Mechanische sweeps (90–120 min)

Doe deze **eerst** en in aparte commits. Dit ruimt de meeste ruis op voordat je
inhoudelijk werk doet en maakt Fase 2-diffs leesbaar.

### Stap 1.1 — Em-streepjes sweep

Drie patronen, elk met een eigen herschrijf-regel:

| Patroon | Voorbeeld | Fix |
|---|---|---|
| Bijstelling | "De Mheen — een Jenaplanschool" | komma: "De Mheen, een Jenaplanschool" |
| Inlassing / terzijde | "Alvah — zoals bekend — heeft PKU" | haakjes of aparte zin |
| Pauze / contrast | "Het werkte — tijdelijk" | twee zinnen: "Het werkte. Tijdelijk." |

Werkwijze: `grep -rn "—" src/pages/ src/content/` → regel-per-regel kiezen.
Niet globaal `sed`-en. Elke em-streep is een inhoudelijk keuzemoment tussen
de drie vormen; een bulk-vervanger maakt de verkeerde gok.

**Commit**: `ToV 1.1: em-streepjes sweep`.

### Stap 1.2 — Verboden-woord-sweep

Per woord uit Bijlage A: `grep -rn -i "<woord>" src/pages/ src/content/`. Per
hit: vervangen door de gewone versie, of de zin herschrijven. Als er geen
elegante fix is, `<!-- TOV: [reden] -->` en door. Tweede pass in Fase 2.

**Let op**: niet alle hits zijn fout in context. "Bloeien" in een plantencontext
is geen metafoor-overtreding. "Mooi" in "mooie dag" is geen vulling. Lees de zin.

**Commit**: `ToV 1.2: verboden woorden sweep`.

### Stap 1.3 — Uitroeptekens

ToV: alleen in geciteerde Alvah-uitspraken. Overal anders weg. Vaak is er
geen betere punctuatie — de juiste fix is de emotionele lading uit de zin
halen, niet alleen het teken.

**Commit**: `ToV 1.3: uitroeptekens weg`.

### Stap 1.4 — Vullers

`eigenlijk`, `eerlijk gezegd`, `letterlijk`. Vaak weg te halen zonder rewrite.
Enkele gevallen zijn legitiem (`letterlijk` in een taalkundige context) — lees.

**Commit**: `ToV 1.4: vullers weg`.

### Stap 1.5 — Genderconstructies en retorische tags

Baseline meldde 0 voor `hij of zij`, maar check ook `de leerling (hij of zij)`
en `leraar/lerares`-constructies. Retorische `, toch?` en `, right?`: eruit.

**Commit**: `ToV 1.5: gender + retorische tags`.

### Validatie-gate Fase 1
- [ ] `check:tov` rapporteert 0 em-streepjes en 0 "hij of zij"
- [ ] Uitroeptekens alleen nog in attributeerbare citaten
- [ ] Diff per commit reviewbaar (onder ~200 regels per commit)
- [ ] `npm run verify` groen

---

## Fase 2 — Pagina-per-pagina review (4–5 uur)

Dit is het kernwerk. Per pagina één sessie. Niet meerdere pagina's in één
sessie, zelfs niet als er tijd over is — je aandacht is na ~60 min concreet
op deze schaal op.

### Protocol per pagina

1. **Identificeer inhoudstype** (zie Bijlage B). Zet de vier toondoelen in
   een post-it / bovenaan het document-als-aantekeningen.
2. **Lees de pagina in zijn geheel, hardop**. Dit vangt cadans, sentiment-slot
   en hype die je op scherm overziet. Markeer ter plaatse (inline comment of
   losse notitie) wat wringt. Nog niet herschrijven.
3. **Volledige ToV-checklist** (Bijlage C) toepassen op de hele pagina.
4. **Herschrijven** in kleine passes. Één passage tegelijk. Niet-herschrijfbare
   punten markeren met `<!-- TOV: [notitie] -->`.
5. **Hardop opnieuw lezen** — nu alleen de herschreven passages.
6. **Check-tov draaien** voor die pagina. Nul hits op em-streepjes, uitroeptekens,
   gendercosntructies. Verboden-woord-hits bewust of weg.
7. **Visuele check**: `npm run dev`, pagina openen. Ankers werken nog, layout
   klopt, TOC-items nog leesbaar.
8. **Commit**: `ToV 2.X: /pagina herschreven`.

### Volgorde (op zichtbaarheid en risico)

| # | Pagina | Inhoudstype | Doel-scores (F/G/O/E) | Specifiek risico |
|---|---|---|---|---|
| 2.1 | `/` (index) | Cockpit / samenvatting | 5 / 3 / 3 / 3 | Salesy CTA's, hype-kopjes |
| 2.2 | `/samenvatting` | Samenvatting | 5 / 3 / 4 / 3 | Zet de toon voor de hele site |
| 2.3 | `/dossier` | Samenvatting + toetsresultaat | 5 / 3 / 4 / 3 | 629 regels, meest claims, meest em-streepjes |
| 2.4 | `/resultaten` | Toetsresultaat | 6 / 2 / 3 / 3 | Oordelen over Alvah sluipen snel in cijferteksten |
| 2.5 | `/wetenschap` | Wetenschappelijke notitie | 6 / 3 / 5 / 3 | Ambtenarentaal, pseudo-academisch |
| 2.6 | `/doubleren` | Reflectie + wetenschap | 4 / 4 / 5 / 3 | Neutrale framing bewaken; geen pleidooi |
| 2.7 | `/onderwijs` | Reflectie | 4 / 4 / 5 / 3 | Van-bovenaf-moraliseren, "scholen zouden" |
| 2.8 | `/bronnen` | Wetenschap (mild) | 6 / 2 / 3 / 3 | Vooral headings en intro's; bronlijsten zelf latens |
| 2.9 | `/voortgang` | Mijlpaal | 4 / 4 / 3 / 5(→7) | Prestatiesticker-taal is hier het gevaar |
| 2.10 | `/vragen` | Reflectie (per vraag) | 4 / 4 / 5 / 3 | Ja-en-nee-framing, niet oplossen wat open is |
| 2.11 | `/oefeningen` | Catalogus-intro (de pagina zelf) | 5 / 3 / 4 / 3 | De 40 entries zelf zijn Fase 3.1 |

### Validatie-gate Fase 2
- [ ] Elk van de 11 pagina's afgevinkt in Bijlage D
- [ ] Per pagina één commit; niet méér in één commit
- [ ] `check:tov` op deze scope: 0 em-streepjes, 0 genderconstructies, 0 retorische tags
- [ ] Visuele smoke-test op desktop én mobile voor minstens 3 pagina's
- [ ] Ten minste één kenmerkend ToV-patroon (ja-en-nee / stil slot / droge onthulling / wat zit erachter) per pagina aanwezig

---

## Fase 3 — Content collections (2–3 uur)

### Stap 3.1 — Oefeningen (40 stuks, ~90 min)

Deze entries zijn door Fase 5 in één patroon geschreven. Gemeenschappelijke
problemen op te lossen:

- **Hype-taal**: "kerninterventie", "goud waard", "onmisbaar", "ideaal",
  "krachtige tool". Vervanging meestal: "werkt", "nuttig", "bruikbaar".
- **Evidence-labels** (`sterk` / `matig` / `zwak` / `praktijkclaim`) **blijven
  zoals ze zijn**. Niet oppoetsen, niet hergraderen, niet omschrijven.
- **Bron bij studies**: auteur + jaar verplicht, zoals ToV eist.
- **Aandoening-eerst**: "voor dyslexie-kinderen" → "voor kinderen met dyslexie".

Werkwijze: batch van 10 per sessie. Elke oefening leest als losse eenheid,
dus de cognitieve belasting per entry is laag — je kunt er meer achter elkaar
door dan bij de pagina's. Niet meer dan 20 per sessie.

**Commits**: per batch van 10 (`ToV 3.1a: oefeningen 1-10`, etc.).

### Stap 3.2 — Milestones (5 stuks, ~30 min)

Mijlpaal-toon (F4 G4 O3 E5, spikes tot 7). Specifiek:
- Stil slot (zie ToV kenmerkend patroon 4): "Ik geloof hem." / "Wordt vervolgd." /
  "Meer hebben we nu niet."
- Geen prestatiesticker: geen "wat een mooie stap", "we zijn zo trots".
- Eén droge observatie mag het slot dragen.

**Commit**: `ToV 3.2: milestones`.

### Stap 3.3 — Vragen (19 stuks, ~60 min)

Vragen zijn bedoeld als reflectie: "wat weten we wel, wat niet, wie zou dit
kunnen weten". Specifiek:
- Ja-en-nee-opening waar van toepassing.
- Niet oplossen wat open is. "Open onderzoek" is een geldige staat.
- "Waarom"-velden niet dramatiseren. Feit, niet zorg.

**Commit**: `ToV 3.3: vragen`.

### Validatie-gate Fase 3
- [ ] Alle 40 oefeningen afgevinkt
- [ ] Alle 5 milestones hebben een stil slot
- [ ] Alle 19 vragen hebben ten minste één kenmerkend patroon
- [ ] `check:tov` op `src/content/` scope: 0 em-streepjes, 0 hype-woorden uit Bijlage A
- [ ] Evidence-labels op oefeningen ongewijzigd (spot-check 5 willekeurige)

---

## Fase 4 — Cross-cutting patronen (60–90 min)

Deze vangen wat per-pagina-review soms mist, omdat het patronen zijn die pas
opvallen als je ze over de hele site bekijkt.

### Stap 4.1 — Inspiratie-porno-detector

Zoek op constructies die Alvah als les voor de lezer gebruiken:

- "laat zien dat"
- "bewijst dat"
- "ondanks zijn"
- "een inspiratie"
- "doorzetten"
- "nooit opgeven"
- "volledig potentieel"

Per hit: haal de lezer-les eruit of herschrijf naar beschrijving.

### Stap 4.2 — "Wij als ouders"-constructies

ToV verbiedt "wij als ouders" als pseudo-wij. Zoek op:
- `wij als ouders`
- `als ouder(s)`
- `ouders zouden`

Vervanging: "wij", "ik", of gewoon de zin herschrijven zonder rolframe.

### Stap 4.3 — Aandoening-eerst-framing

Meer dan Fase 1.2 oppikt. Bredere patronen:
- "Voor een kind met PKU is..." — prima, want Alvah is eerder in de tekst genoemd.
- "PKU-kinderen zoals Alvah..." — omdraaien.
- "De dyslexieleerling Alvah" — ontoelaatbaar.

### Stap 4.4 — Sentiment-slot-audit

Ga terug langs elke pagina-afsluiting. ToV: slot is wending of feit, geen
samenvatting, geen gevoelsslot. Typische slechte slots:
- "Samen zoeken we de beste weg voor Alvah."
- "We blijven geloven in hem."
- "Dankbaar voor iedereen die meedenkt."

Vervangers zijn vaak één regel: "Wordt vervolgd.", een concreet getal, een
open vraag die we aanhouden.

### Validatie-gate Fase 4
- [ ] Inspiratie-porno-grep: 0 overgebleven hits zonder `<!-- TOV -->` of rewrite
- [ ] "Wij als ouders"-constructies nul of bewust behouden
- [ ] Elke pagina heeft een slot dat de audit uit 4.4 doorstaat
- [ ] Commit per stap in deze fase

---

## Fase 5 — Borging (45 min)

### Stap 5.1 — Full check-tov-rapport tegenover baseline

Draai `check:tov` opnieuw. Vergelijk met `docs/tov-baseline.txt`. Verschil moet
overwegend nul of bewust zijn. Documenteer alle resterende hits in
Bijlage E met reden.

### Stap 5.2 — Handmatige steekproef

Kies drie willekeurige pagina's (met `shuf` of gut). Leg de volledige
ToV-checklist (Bijlage C) erover. Als één van de drie zakt, ga je terug.

### Stap 5.3 — Diff-review op hoog niveau

`git log --oneline` sinds het begin van deze fase-reeks. Elke commit moet
alleen taal-wijzigingen bevatten. Eén structurele sluiper is genoeg om de
hele review te vervuilen. Als je die vindt: aparte cleanup-commit.

### Stap 5.4 — De AI-verwarringstest

Pak drie willekeurige passages (30–80 woorden). Lees ze alsof je ze voor het
eerst ziet. Zou dit voor generieke Claude-tekst kunnen doorgaan, of voor een
opvoedblog? Zo ja: herschrijven.

### Stap 5.5 — De-16-jaar-test

Pak twee willekeurige passages over Alvah. Stel je voor dat hij 16 is en dit
net voor het eerst heeft gelezen. Zou je de passage laten staan? Zo niet:
herschrijven.

### Validatie-gate Fase 5
- [ ] `check:tov`-rapport vergeleken met baseline, resterende hits gedocumenteerd
- [ ] Steekproef van 3 pagina's doorstaat volledige checklist
- [ ] `git log --oneline` toont alleen taal-commits, geen structurele drift
- [ ] AI-test en 16-jaar-test op minstens 5 passages gedaan
- [ ] `npm run verify` groen

---

## Kwaliteitsbewaking — cross-cut regels

Deze gelden door alle fases heen, niet per fase.

1. **Sessie ≤ 90 min**. Daarna pauze, ook als er werk over is. Aandachtsverval
   is de nummer-één-bron van ToV-drift.
2. **Eén commit per logische eenheid**. Pagina, batch van 10 oefeningen,
   sweep-categorie. Commits > 300 regels worden onleesbaar in review.
3. **Geen stijl + structuur in dezelfde edit**. Als je tijdens een rewrite
   toch een anker of klasse wilt aanpassen: aparte commit na afloop van de fase.
4. **Twijfel = markering, geen improvisatie**. `<!-- TOV: [notitie] -->` is
   altijd goedkoper dan een slechte rewrite die later nog eens moet.
5. **Niet meer dan 3 pagina's achter elkaar**. Na elke drie: uit-zoom,
   diff-scan, korte pauze.
6. **Bij onzekerheid over een rewrite: terug naar de ToV-voorbeelden
   (§Few-shot voorbeelden)**. Eén blik op het voor/na-voorbeeld is vaak genoeg.
7. **Niets committen wat je niet hardop hebt gelezen**.

---

## Wat bewust niet in scope

- `/spelen` subtree — eigen fase-plan, eigen UI-toon-instellingen.
- `research/` — input-materiaal, onaangeroerd.
- Toevoegen van nieuwe content.
- Structurele wijzigingen (ankers, klassen, chapters-arrays).
- `docs/tone-of-voice-alvah-site-nl.md` zelf.

---

## Samenvatting

| Fase | Duur | Wat | Commits |
|---|---|---|---|
| 0 | 45 min | Voorbereiden + script + baseline | 1 (script) |
| 1 | 90–120 min | Mechanische sweeps | 5 (één per sweep) |
| 2 | 4–5 uur | Pagina-per-pagina | 11 (één per pagina) |
| 3 | 2–3 uur | Collections | 5–7 (batches) |
| 4 | 60–90 min | Cross-cutting patronen | 4 |
| 5 | 45 min | Borging + audits | 0–1 (fix-commit) |

**Totaal**: 8–12 uur, verdeeld over 6–10 sessies.

---

## Bijlage A — Verboden-woord-lijst voor `check:tov`

Direct uit ToV §Vocabulaire + AI-clichés, in grep-bruikbare vorm.

**NL (vulling / hype):**
onvergetelijk, bijzonder (als vulling), mooie reis, prachtige ontwikkeling,
het is belangrijk om te benadrukken, wij als ouders, held, dappere kleine vechter,
ons zonnetje, ons mannetje, ondanks zijn beperking, laat zich door niets tegenhouden,
is een inspiratie voor iedereen, zijn glimlach zegt alles, op reis gaan (metafoor),
volwaardig potentieel ontgrendelen, empoweren, bloeien (metafoor), bijzonder kind (vulling),
kanjer, kerninterventie, goud waard, onmisbaar, game-changer, krachtig(e) tool.

**EN (AI-clichés):**
delve, unlock, game-changer, journey (als metafoor), empower, transformative,
it's worth noting, move the needle, deep dive (als zelfstandig naamwoord),
unpack (metafoor), circle back, elevate, curate (waar "kies" werkt).

**Constructies:**
hij of zij, hem of haar, eerlijk gezegd, letterlijk, eigenlijk (als vulling),
, toch?, , right?.

Let op: sommige woorden zijn niet altijd fout. Het script rapporteert; de mens
beoordeelt per hit.

---

## Bijlage B — Toondimensies per inhoudstype (cheatsheet)

Schaal 0-10. Afwijking > ±1 flaggen, > ±2 herschrijven.

| Inhoudstype | Formeel | Grappig | Oneerbiedig | Energie |
|---|---|---|---|---|
| Samenvatting / update | 5 | 3 | 4 | 3 |
| Toetsresultaat | 6 | 2 | 3 | 3 |
| Wetenschappelijke notitie | 6 | 3 | 5 | 3 |
| Mijlpaal | 4 | 4 | 3 | 5 (→7) |
| Bericht leraar | 5 | 3 | 3 | 3 |
| Reflectie | 4 | 4 | 5 | 3 |

---

## Bijlage C — ToV-checklist per pagina/entry

(Direct uit ToV §Checklist voor publicatie.)

- [ ] Toon-scores binnen ±1 van de doelen voor het inhoudstype
- [ ] Geen verboden woorden, geen verboden uitdrukkingen, geen em-streepjes
- [ ] Geen uitroeptekens (behalve in Alvah-citaat)
- [ ] Geen "hij of zij" / "hem of haar"
- [ ] Geen inspiratie-porno-zinnen
- [ ] Alvah wordt genoemd vóór zijn aandoening
- [ ] Ten minste één kenmerkend patroon aanwezig
- [ ] Perspectief consistent (ik of we)
- [ ] Geen clevere metafoor waar de gewone versie klopt
- [ ] Bron bij elke wetenschappelijke claim (auteur, jaar)
- [ ] Datum bij elke observatie
- [ ] Slot is wending of feit, geen samenvatting, geen sentiment
- [ ] Geen van-bovenaf-moraliseren
- [ ] Zou ik dit oké vinden als Alvah het op zijn 16e leest?
- [ ] Zou dit voor generieke AI / opvoedblog kunnen doorgaan? Zo ja: herschrijven.

---

## Bijlage D — Progress-tracker (vink af tijdens het werk)

### Fase 1 — Mechanische sweeps
- [x] 1.1 Em-streepjes (milestones + vragen + 40 oefeningen + 11 pagina's: 0 hits over)
- [x] 1.2 Verboden woorden (5 gefixt, 3 bewust behouden — zie Bijlage E)
- [x] 1.3 Uitroeptekens (BOUW!-filter in script; 4 bewust behouden)
- [x] 1.4 Vullers (3 gefixt, 2 bewust behouden)
- [x] 1.5 Gender + retorische tags (0 hits)

### Fase 2 — Pagina's
- [x] 2.1 `/` (index)
- [x] 2.2 `/samenvatting`
- [x] 2.3 `/dossier`
- [x] 2.4 `/resultaten` (geen aanpassingen, was al op toon)
- [x] 2.5 `/wetenschap`
- [x] 2.6 `/doubleren` (geen aanpassingen, bewust-neutraal frame staat)
- [x] 2.7 `/onderwijs` (geen aanpassingen, systeem-beschrijvend)
- [x] 2.8 `/bronnen` (geen aanpassingen, bibliografie + over-dossier goed)
- [x] 2.9 `/voortgang` (no-op, alleen milestone-loop)
- [x] 2.10 `/vragen` (em-streepje in frontmatter-kader gefixt)
- [x] 2.11 `/oefeningen` (no-op, catalogus-functionaliteit)
- [ ] 2.5 `/wetenschap`
- [ ] 2.6 `/doubleren`
- [ ] 2.7 `/onderwijs`
- [ ] 2.8 `/bronnen`
- [ ] 2.9 `/voortgang`
- [ ] 2.10 `/vragen`
- [ ] 2.11 `/oefeningen` (catalogus-pagina)

### Fase 3 — Collections
- [ ] 3.1a Oefeningen 1–10
- [ ] 3.1b Oefeningen 11–20
- [ ] 3.1c Oefeningen 21–30
- [ ] 3.1d Oefeningen 31–40
- [ ] 3.2 Milestones (5)
- [ ] 3.3 Vragen (19)

### Fase 4 — Cross-cutting
- [ ] 4.1 Inspiratie-porno
- [ ] 4.2 "Wij als ouders"
- [ ] 4.3 Aandoening-eerst
- [ ] 4.4 Sentiment-slot-audit

### Fase 5 — Borging
- [ ] 5.1 Baseline-vergelijking
- [ ] 5.2 Handmatige steekproef
- [ ] 5.3 Diff-review
- [ ] 5.4 AI-verwarringstest
- [ ] 5.5 16-jaar-test

---

## Bijlage E — Bewust behouden afwijkingen (log tijdens Fase 5)

Elke hit uit `check:tov` die blijft staan: hier documenteren met bestand, regel,
en reden.

### Uit Fase 1 (mechanische sweeps)

**Verboden woorden — boektitels:**
- `src/pages/bronnen.astro:195` — "kanjer", onderdeel van boektitel "Een kroon voor kanjer" (Tilanus). Titel blijft onaangeroerd.
- `src/content/oefeningen/een-kroon-voor-kanjer.md:2,10` — zelfde boektitel, blijft.

**Verboden woorden — functionele rolbenaming, geen pseudo-wij:**
- `src/pages/vragen.astro:49` — "Sommige vragen zijn voor ons als ouders". Dit is de functionele driedeling (ouders / school / Alvah), niet hype-framing. Rol-benoeming staat, want alternatieven verliezen de structuur.
- `src/pages/onderwijs.astro:241` — "als ouders en school er samen niet uitkomen". False positive: "als" is hier conjunctief ("wanneer"), niet pseudo-wij.

**Vullers — legitiem gebruik:**
- `src/pages/dossier.astro:98` — "schrijft letterlijk" als inleiding op een letterlijk citaat. Legitiem, niet vulling.
- `src/content/vragen/bij-grote-beslissingen-luisteren.md:15` — "Leg letterlijk vast wat hij zegt". Letterlijk = verbatim, niet emphasis-vulling.

**Uitroeptekens — counter-example quotes:**
- `src/pages/dossier.astro:416,418,423` — geciteerde voorbeelden van typische ouder-cliché's (tabel "wat niet helpt / alternatief"). Het uitroepteken is onderdeel van de cliché die wordt bekritiseerd. De alternatief-kolom is wel schoon.
- `src/content/oefeningen/growth-mindset-gesprek-thuis.md:31` — zelfde patroon ("Doorzetten!" → betere vorm).

**Uitroeptekens — proper noun in script-filter:**
- Het programma `BOUW!` / `Bouw!` heeft het uitroepteken in de officiële naam. Script skipt deze automatisch (case-insensitive).

### Opmerking voor volgende sessies
Bij Fase 1.1 (em-streepjes) is voor `bronnen:`-frontmatter en label-beschrijving-lijsten gekozen voor **colon** (`:`) als vervanger, omdat de ToV colons niet verbiedt en deze structuur (auteur + jaar + beschrijving, of label + toelichting) idiomatisch een dubbele punt vraagt. Voor pauze/contrast in proza: punt. Voor bijstelling: komma. Voor terzijde: haakjes.
