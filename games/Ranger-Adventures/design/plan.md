# Gameplan — "Ranger van de Veluwe" (Missie 1 MVP)

> Klikbaar ontwerp van de **eerste missie**: "De verdwaalde frisling".
> Dit document is de volledige bouwblauwdruk: elk scherm, elke interactie, elke staat.
> Bron: `ontwerp-brief.md` (in deze map). In-game tekst = Nederlands, leesniveau M3/E3.

---

## 0. Doel van deze MVP

Eén speelbare missie die bewijst dat de **verhaal-laag** werkt: de speler voelt zich ranger, niet
puzzel-speler. De drie executieve functies (zoeken, route-geheugen, impulsremmen) zitten **verstopt
in ranger-werk**. We bouwen dit als klikbaar HTML-prototype (Claude Design), zodat Floris + Alvah het
samen kunnen testen vóór de echte Astro-implementatie.

**Wat de MVP moet aantonen**
1. De verhaal-omhulsel-flow leest lekker en is begrijpelijk op M3/E3-niveau.
2. De drie EF-mechanieken voelen als ranger-handelingen, niet als losse mini-games.
3. De Pokémon-Game-Boy top-down look past bij de bestaande warme natuur-kleuren.
4. Schaalbaar opgezet: een gebied-overzicht waar later gebieden/missies bij kunnen.

**Out of scope voor de MVP (wel benoemen, niet bouwen)**
- Echte `staircase/scoring/storage`-pipeline (we mocken adaptiviteit visueel).
- Admin/cadeau-koppeling, JSON-export.
- Audio-engine (we tonen de voorlees-knop, TTS mag een stub zijn).
- Andere gebieden dan de Veluwe (alleen als "binnenkort"-pin op de kaart).

---

## 1. Schermenkaart (high-level flow)

```
[A] Gebied-overzicht (kaart NL met pins)
        │  klik pin "Veluwe"
        ▼
[B] Vervoerkeuze  ──►  auto / motor / helikopter  (sfeer-animatie)
        ▼
[C] Reis-animatie (korte cutscene, gekozen voertuig)
        ▼
[D] Ranger-briefing  (grote letters, 1 instructie/regel, 🔊 voorlees, "Ik ga!")
        ▼
[E] Wereld — top-down gras
        ├─ Stap 1: Spot de frisling   (volgehouden aandacht + visueel zoeken → Zoeken)
        ├─ Stap 2: Onthoud het pad    (volgorde-geheugen → Corsi)
        ├─ Stap 3: Gevaar ontwijken   (impulscontrole / remmen → Dag & Nacht)
        ▼
[F] Hereniging + beloning  (ingezoomde 2D-plaat, bloei-animatie, ranger-badge)
        ▼
[G] Missie-afsluiting  ("Jouw reis"-haak, terug naar kaart)
```

Eén lineaire missie. Geen doodlopende wegen. Altijd terug-knop (shell-patroon → `/spelen`).

---

## 2. Scherm-voor-scherm detail

### [A] Gebied-overzicht — "Kies een gebied"
**Rol:** hoofdscherm van de verhaal-laag; het schaalbaarheidsanker.
- Top-down/kaart-weergave van Nederland (of een gestileerde natuur-kaart) met **gebied-pins**.
- **Veluwe** = actieve pin (gloeiend, `--spel-sun` glow). Andere pins ("Wadden", "Biesbosch") = grijs,
  label "Binnenkort".
- Pin toont mini-kaart: gebiedsnaam, aantal missies, voortgang (0/1 voor MVP).
- **Interactie:** klik Veluwe-pin → kaart zoomt in op de Veluwe-scène → knop "Start missie: De
  verdwaalde frisling".
- **Staat:** welke gebieden ontgrendeld; per gebied welke missies klaar. (MVP: hardcoded.)
- **Copy:** "Kies een gebied" / "Veluwe" / "Binnenkort" / "1 missie".

### [B] Vervoerkeuze — "Hoe ga je erheen?"
**Rol:** pure sfeer + agency, geen EF. Eerste keuze geeft het kind regie.
- Drie grote kaart-knoppen, naast elkaar (flex, gap): **Auto · Motor · Helikopter**.
- Elk een rustige illustratie-placeholder + label. Hover/focus: lift + glow.
- **Interactie:** klik voertuig → kort "geselecteerd"-state → door naar reis-animatie.
- **Staat:** `gekozenVervoer` onthouden (bepaalt cutscene + klein detail bij aankomst).
- **Copy:** "Hoe ga je erheen?" / "Auto" / "Motor" / "Helikopter". Toon: nuchter-avontuurlijk.

### [C] Reis-animatie — korte cutscene
**Rol:** beloon de keuze, bouw sfeer. ~3-5s, overslaanbaar.
- Gekozen voertuig beweegt over een zijaanzicht-landschap (parallax heuvels/bomen).
- Helikopter = van bovenaf dalend; auto/motor = horizontaal over een weg.
- **Interactie:** auto-door na animatie, of knop "Overslaan".
- **Reduced-motion:** toon statisch eindbeeld i.p.v. beweging.
- **Copy:** "Onderweg naar de Veluwe…".

### [D] Ranger-briefing — leesscherm (KRITISCH voor leesniveau)
**Rol:** uitleggen wat je gaat doen, op M3/E3-niveau.
- Warm `--paper`-paneel, dyslexie-vriendelijke leestekst, ruime regelafstand.
- **Eén instructie per regel**, 3-7 woorden per zin. Grote letters (groter dan body-large).
- Voorbeeld-copy (uit brief, mag fijngeslepen):
  > Hoi ranger!
  > Een klein zwijntje is zijn mama kwijt.
  > Hij is nog maar net geboren.
  > Hij is bang en alleen.
  > Kun jij hem terugbrengen?
  > Zoek hem eerst in het gras.
- **Knoppen (flex, gap):** [ Ik ga! ]  [ 🔊 Lees voor ].
- **Voorlees-knop:** highlight per regel tijdens voorlezen (karaoke-stijl) — sterke dyslexie-hulp.
- **Staat:** of voorlezen aan staat; geluid-toggle (persistent, shell).

### [E] Wereld — top-down gras (de 3 EF-stappen)
**Gedeeld frame:** Pokémon-stijl top-down tegel-wereld. Ranger-sprite (de speler) zichtbaar.
Bovenin een rustige **missie-balk**: stap-indicator (●○○ → ●●○ → ●●●) + huidige micro-opdracht in
één korte zin. Onderaan optioneel d-pad voor touch.

> Ontwerpprincipe (Floris): de *gedachte* achter de mini-game integreren, niet het puzzelscherm
> exact naspelen. Geen "nu komt Corsi" — het moet ranger-werk blijven.

#### Stap 1 — Spot de frisling  (EF: volgehouden aandacht + visueel zoeken → *Zoeken*)
- Hoog gras met subtiele beweging; de frisling is **gecamoufleerd** ertussen.
- De speler scant en **tikt op de frisling** wanneer gevonden. Afleiders: vogels, takken,
  bewegend gras (verleiden tot misklik = response-inhibitie).
- **Adaptief (gemockt):** moeilijker = meer afleiders / beter gecamoufleerd / korter zichtbaar.
- **Feedback:** juist = zachte "gevonden"-puls + frisling kijkt op. Mis = rustige "Probeer maar",
  geen straf-toon.
- **Klaar-conditie:** frisling gevonden → korte inzoom op frisling → door naar stap 2.
- **Copy:** "Zoek de frisling in het gras."

#### Stap 2 — Onthoud het pad  (EF: visueel-ruimtelijk volgordegeheugen → *Corsi*)
- De **rotte** (zwijnen-groep) liep zojuist een route. Toon de route als **oplichtende
  voetstappen/tegels in volgorde** (sequentie speelt af).
- Daarna doven ze. De speler **wijst de route terug** door de tegels in dezelfde volgorde aan te
  tikken (of de frisling stap-voor-stap langs het pad te sturen).
- **Adaptief (gemockt):** sequentielengte groeit (3→4→5…); reversals bij fouten.
- **Feedback:** juiste tegel licht groen op; foute tegel = zachte schud + "Nog een keer", route
  wordt opnieuw getoond (succes-gericht, niet straffend).
- **Klaar-conditie:** route correct terug-gewezen → frisling loopt het pad → door naar stap 3.
- **Copy:** "Kijk welke weg de groep liep." → "Wijs de weg terug."

#### Stap 3 — Gevaar ontwijken op de terugweg  (EF: inhibitie / remmen → *Dag & Nacht*)
- Terugweg naar de rotte. Onderweg verschijnen **dieren/objecten**: sommige veilig (mag naderen /
  juiste pad), sommige gevaar (NIET naderen — slang, modderpoel, stroper-val).
- Stroop-achtige twist: de **regel kan omdraaien** ("benader het rustige dier, NIET het opgewonden
  dier") → het kind moet de impuls remmen om "altijd het dichtstbijzijnde" te kiezen.
- De speler kiest pad/handeling; **rustig blijven en juist kiezen** = vooruit.
- **Adaptief (gemockt):** sneller tempo / vaker regel-omdraai naarmate het beter gaat.
- **Feedback:** juiste keuze = ranger loopt door; impulsieve foute keuze = "Wacht even" +
  herkansing, geen game-over.
- **Klaar-conditie:** veilig bij de rotte aangekomen → trigger hereniging.
- **Copy:** "Blijf rustig." / "Kies de veilige weg." / "Niet elk dier naderen."

### [F] Hereniging + beloning — ingezoomde 2D-plaat
**Rol:** emotionele payoff + voorspelbare beloning (celebration-patroon).
- Inzoom van top-down naar een **mooi ontworpen 2D-plaat**: frisling rent naar de rotte, mama-zwijn
  reageert. Zachte animatie (geen schokkerige flits — reduced-motion-vriendelijk).
- **Bloei-animatie** (bestaand `celebration.js`-idee: plant bloeit op) + zachte audio-chord.
- **Ranger-badge** verschijnt: "Frisling-redder" (mijlpaal-skin over `mijlpalen.js`).
- **Copy:** "Je bracht de frisling terug." / "Goed bezig, ranger." (geen uitroep-overdaad).

### [G] Missie-afsluiting
- Korte samenvatting: badge verdiend, missie afgerond.
- Knoppen: [ Terug naar de kaart ]  [ Jouw reis ] (haak naar mijlpalen-overzicht).
- **Copy:** "Missie klaar." / "Jouw reis" / "Terug naar de kaart".

---

## 3. EF → ranger-vertaling (deze missie)

| Stap | Bestaand spel | Breinkracht (EF) | Ranger-handeling in MVP |
|---|---|---|---|
| 1 | Zoeken | volgehouden aandacht + response-inhibitie | frisling spotten in hoog gras, afleiders negeren |
| 2 | Corsi | visueel-ruimtelijk volgordegeheugen | route van de rotte onthouden en terug-wijzen |
| 3 | Dag & Nacht | inhibitie (Stroop-achtig) | rustig blijven, juiste/veilige weg kiezen, regel kan omdraaien |

(Simon = werkgeheugen en Wisselen = flexibiliteit komen in latere missies — zie brief §3.)

---

## 4. Toestand & data (mapping naar `alvah-ef-v1`)

Voor de MVP simuleren we; voor de echte bouw mapt elke stap op de bestaande pipeline.

- **Sessie per stap:** elke EF-stap = één `session` op een `exercises`-id (of `missions`-uitbreiding),
  met `summary { accuracy, meanRT, sdRT, iivCV, trialsN }`. Hergebruik `scoring.js`.
- **Adaptiviteit:** `staircase.js` (reversals) bepaalt moeilijkheid per stap. MVP mockt dit visueel.
- **Voortgang:** `progressie.js` (80%+ & trialsN≥24 om te stijgen; geen mid-sessie demotie).
- **Badges:** ranger-badge = skin-laag over `mijlpalen.js` (id-conventie `<spelId>-<n>`).
- **Opslag:** alles in localStorage `alvah-ef-v1`, `schemaVersion`-migratie via `storage.js::migrate`.
  Mogelijk nieuw `missions`-blok of nieuwe `exercises`-id's per stap.
- **Geen-tracking-belofte:** niets verlaat de browser. Geen fetch/beacon. Enige export = admin JSON.

**MVP-prototype-state (client, simpel object):**
```
{ gekozenVervoer, huidigeStap, stapStatus[1..3], gevondenFrisling,
  routeGoedGewezen, badgeVerdiend, voorlezenAan, geluidAan, reducedMotion }
```
Bewaar voortgang in localStorage (sleutel los van de echte app, bv. `ranger-mvp-state`) zodat
verversen de plek behoudt — handig tijdens samen testen.

---

## 5. Leesniveau & toegankelijkheid (hard requirement)

- **Korte zinnen:** 3-7 woorden. **Eén instructie per regel.**
- **Grote letters:** body schaalt naar 20px (large default); briefing nog groter.
- **Bekende, concrete woorden.** Geen abstracte/lange woorden.
- **Dyslexie-vriendelijk:** rustige regelafstand, getint papier (`--paper`, niet fel wit), veel
  witruimte, overweeg dyslexie-vriendelijk lettertype voor leestekst.
- **Voorlees-knop altijd aanwezig** (TTS-stub in MVP), met regel-highlight tijdens voorlezen.
- **Succes-gericht, nooit vergelijkend.** Herhaal wat goed ging; nooit vergelijken met leeftijdsgenoten.
- **Reduced-motion** gerespecteerd op elke animatie (cutscene, bloei, gras).
- **Hit targets** ≥ 44px (touch-vriendelijk; Alvah is 8).

## 6. Tone of voice

- Feedback **zonder uitroep-overdaad:** "Goed bezig", "Probeer maar", "Nog een keer", "Juist".
- **Geen** "kanjer / held / superheld"-stem. Warm, nuchter, uitnodigend.
- Knoppen: "Start", "Pauze", "Doorgaan", "Nog een keer", "Dit is te moeilijk".
- Niveau-wissel neutraal: "Oké, iets korter", "Dit niveau beheers je nu".
- Ranger-missie mag ietsje avontuurlijker, maar binnen deze grens.

---

## 7. Visueel systeem

**Basis-wereldkleur:** natuur-groen.
- `--green #1e4d32`, `--green-deep #123621`, `--green-soft #f0f5ec`, `--green-line #c8d6c0`

**Tekst & papier:**
- `--ink #1a1a1a`, `--ink-soft #4a4a4a`, `--ink-muted #7a7a7a`
- `--paper #fdfcf8` (warme off-white), `--line #e8e5dc`, `--accent-warm #d9b89a`, `--red-warn #9b3d2e`

**UI-accenten (vrolijk spel-palet):**
- `--spel-blue #2b5fb8` / soft `#e7eefa`
- `--spel-orange #ef7a1f` / soft `#fdeedd`
- `--spel-magenta #c94174` / soft `#fbe6ee`
- `--spel-sun #f5c23b` + glow `rgba(245,194,59,0.35)`
- radii: `--spel-radius 14px`, `--spel-radius-lg 20px`

**Type:**
- Heading: **Fraunces** (serif). Body: **Inter Tight** (sans).
- Leestekst (briefing): overweeg dyslexie-vriendelijk lettertype, grotere graad, ruime line-height.

**Look:** Game-Boy/Pokémon top-down tegels, maar in deze **warmere natuur-kleuren** i.p.v.
Game-Boy-groen. Top-down voor de wereld; ingezoomde 2D-platen op sleutelmomenten (briefing-portret,
hereniging). Sprites/dieren = nette placeholders in de MVP (gestreepte placeholder + mono-label
"frisling", "rotte", "ranger"), te vervangen door echte art. **3D-spoor:** de dieren worden
doorontwikkeld naar echte realtime-3D (Three.js/glTF) — zie `3d-animals-build-plan.md` +
`3d-animal-animation-research.md`. De warme natuur-kleuren hier zijn de basis voor de golden-hour
3D-licht-rig. **De ranger (de speler = Alvah) en de ogen van mens én dier:** zie
`humans-full-animals-eyes-research.md` (onderzoek) → uitgewerkt in `3d-animals-build-plan.md §12`
(oog-laag voor alle dieren + mens) en `§13` (volledige mens-recreatie + likeness-spec van Alvah uit
de foto's `1000152315–1000152320.jpg`).

**Schaalbaarheid:** kaart-overzicht ([A]) is het uitbreidingsanker — nieuwe gebieden = nieuwe pins;
nieuwe missies = inzoom-scènes per gebied. Bouw de wereld-tegel-render data-gedreven (tile-map array)
zodat latere gebieden andere maps krijgen zonder nieuwe code-structuur.

---

## 8. Animatie-momenten

| Moment | Animatie | Reduced-motion-alternatief |
|---|---|---|
| Kaart-inzoom op Veluwe | zachte scale + pan naar pin | directe cut naar scène |
| Vervoer gekozen | knop-lift + checkmark-puls | statische selectie-rand |
| Reis-cutscene | voertuig over parallax-landschap | statisch aankomst-beeld |
| Briefing voorlezen | regel-highlight (karaoke) | geen beweging, knop blijft |
| Gras (stap 1) | subtiele gras-sway, frisling-knipoog | stilstaand gras |
| Route (stap 2) | tegels lichten op in volgorde | tegels met cijfers 1-2-3 i.p.v. timing |
| Hereniging (stap F) | inzoom + bloei-plant + chord | statische plaat + badge |

---

## 9. Bouw-aanpak voor de MVP (Claude Design)

- **Eén klikbaar HTML-prototype**, schermen als secties/states (geen losse files per scherm).
- **Top-down wereld** als CSS-grid tile-map (data-gedreven array) zodat latere gebieden makkelijk zijn.
- **Tweaks-paneel** voor het samen-testen: bv. leesniveau-grootte, geluid aan/uit, reduced-motion,
  moeilijkheid stap 1-3, dyslexie-lettertype aan/uit, kleur-accent. (Floris kan live afstemmen op Alvah.)
- **State-persistentie** in localStorage zodat verversen de plek bewaart.
- **Placeholders** voor alle art (frisling, rotte, ranger, voertuigen, landschap) met mono-labels;
  echte illustraties komen later.
- Schermen zo opgezet dat ze 1-op-1 mappen op toekomstige Astro-routes
  (`spelen/veluwe.astro` / `spelen/missie/frisling.astro`) en de `SpelShell`-conventies
  (terug-knop, titel, geluid-toggle, voorlees-knop).

---

## 10. Open vragen (vóór of tijdens bouw met Floris)

1. **Kaart-stijl [A]:** echte NL-kaart-vorm of een gestileerde fantasie-natuur-kaart?
2. **Stap 2 interactie:** tegels aantikken in volgorde, óf de frisling stap-voor-stap sturen?
3. **Stap 3 mechaniek:** pad-keuze (links/rechts) of dier-voor-dier "wel/niet naderen"-beslissing?
4. **Voertuig-effect:** heeft de keuze (auto/motor/heli) gameplay-effect of puur sfeer? (Brief: sfeer.)
5. **Dyslexie-lettertype:** welke (bv. een open, schreefloze leesfont) en alleen voor leestekst?
6. **Hoeveel "trials" per stap** voelt goed voor een 8-jarige in MVP (kort genoeg, niet vermoeiend)?
7. **Badge-naam & -beeld:** "Frisling-redder"? Visuele stijl van de ranger-badge?

---

### Volgende stappen
1. Plan afstemmen met Floris (open vragen §10).
2. Klikbaar MVP-prototype bouwen (§9).
3. Samen testen met Alvah → fijnslijpen leesniveau, tempo, moeilijkheid.
4. Daarna: Claude Code → Astro-implementatie; Deep Research → biologische verificatie.

---

## 11. Uitgebreide visie (v2) — semi-open 3D-wereld

> Toegevoegd 21 juni 2026. De MVP hierboven (§0–§10) is één lineaire missie. Dit is de grotere
> richting waar we naartoe bouwen. **Hoofddoel: alles — de wereld, het verhaal én de mini-games —
> volledig in één doorlopende real-time 3D-scène integreren** (geen 2D-wereld met losse
> puzzelschermen). De biologie (`veluwe-research.md`) en de 3D-render/animatie-tech
> (`3d-animal-animation-research.md`, `3d-animals-build-plan.md`) zijn al onderzocht; de nieuwe
> game-design/pedagogie/verhaal-vragen staan in **`deep-research-prompt.md`** (deze map).

**De wereld & navigatie**
- Je **spawnt in het ranger-huisje**. Daar krijg je de brief, óf je klikt op de **computer** en ziet
  **meerdere missies om uit te kiezen**. Vanuit het huisje: **ladder omhoog → helikopterplatform**,
  of **deur naar buiten → motor of auto**.
- **Auto en motor rijden alleen op de paden; de helikopter vliegt overal overheen.** Dus een
  **semi-open wereld** — verkennen, geen gang.
- **Kaart linksonder** met een **marker** waar de speler heen moet.
- **Botsing/schade:** boom raken = **echte voertuigschade**; bij totale schade is je voertuig kapot
  en moet je het gevolg dragen (te voet verder + reparatie kost middelen/tijd). Genoeg ruimte om de
  auto/motor er op plekken doorheen te rijden, plus **open plekken waar de helikopter kan landen**.
  Je kunt **altijd uitstappen en te voet verder**. *(Beslist 21 juni: gevolgen blijven echt en
  volwassen — niet kinderachtig — maar vallen op **uitrusting/middelen/tijd**, nooit op Alvah's
  waarde of de veiligheid van een dier. Volledig uitgewerkt in §12.5; dit vervangt de eerdere
  "1/3 → 3x → terug naar huisje"-formulering.)*

**Mini-games & EF-integratie**
- **Genoeg leuke mini-games, niet te veel stappen per stuk.** Zo **diep mogelijke integratie van de
  bestaande EF-spellen** (geen exacte kopie — de *gedachte* erachter volledig verweven door missies
  en games). Doel: **minstens ~10 mini-games** waarbinnen we kunnen variëren.
- Mini-games zijn **momenten in de wereld** (bukken, beter kijken, handelen), geen aparte schermen.
- **Diersoort-kennis** duidelijk maar **subtiel** verweven — relevant voor wat je doet, nooit een
  lange feitenlijst.

**Verhaal**
- **Echte verhaalprogressie** door het hele spel — mogelijk een verhaallijn over **stropers** of
  **boskappers** (of iets vergelijkbaars). In-world verteld, kindvriendelijk, hoopvol, weinig tekst.

**Schaalbaarheid**
- De Veluwe is **gebied 1**, zo gebouwd dat dezelfde engines/mini-games **in andere gebieden
  herhaald** kunnen worden (andere NL/Europese natuurgebieden).

**Onveranderd:** dyslexie-vriendelijk (AVI M3/E3), grote letters + voorlezen, warme rustige toon,
**succes-gericht en nooit beschámend, nooit vergelijken**, reduced-motion, niets verlaat de browser.
*(Nuance 21 juni: "nooit straffend" = nooit het kind kleineren of een dier-leed-fail. Échte
gevolgen op uitrusting/middelen mógen — Alvah speelt al stevige games. Zie §12.1 en §12.5.)*

---

## 12. v2 — ontwerpbeslissingen (verwerkt uit `mini-game-research.md`)

> Toegevoegd 21 juni 2026. Het deep-research is binnen (`mini-game-research.md`). Dit hoofdstuk
> bevat de **ontwerp-kant** (hoe het voelt/speelt). De **bouw-kant** (datamodel, moeilijkheids-
> tracking, gevolg-systeem in code, verhaal-state) staat in `HANDOFF.md §6`. Lees beide.

### 12.1 Kernreframe — "een capabele ranger zijn", niet "breinkracht-training"
Het research is hierover streng en eerlijk: meta-analyses (Melby-Lervåg/Redick/Hulme 2016; Simons
et al. 2016; Sala & Gobet 2019; Kassai et al. 2019) tonen dat EF-game-training de *getrainde taak*
verbetert, maar **geen overtuigend bewijs** geeft voor overdracht naar lezen, aandacht of
intelligentie in het echte leven.
- **Wat we dus NIET beloven:** dat dit Alvah's brein/EF "traint" of verbetert. Geen claim, geen
  framing richting hem of derden.
- **Wat we WÉL bieden (en mogen claimen):** plezier, autonomie, competentie en een rustig, trots
  kind — plus precies de condities die Diamond noemt: **herhaalde, vrolijke, geleidelijk moeilijker
  oefening in een ontspannen, succes-gerichte context.** Bouw eerst een geweldig, knus spel; de
  EF-oefening is een onzichtbare bonus.
- **Ontwerpregel:** elke engine zit verstopt in echt ranger-werk. Nooit een herkenbaar "klinisch
  scherm". De maatstaf onderaan dit doc blijft leidend.

### 12.2 De vijf engines als herbruikbaar reskin-systeem
Elke mini-game is één van vijf onderliggende mechanieken in een ander ranger-kostuum:

| Engine | Breinkracht | Status |
|---|---|---|
| **Zoeken** | volgehouden aandacht + inhibitie | gebouwd (step-spot) |
| **Corsi** | visueel-ruimtelijk volgordegeheugen | gebouwd (step-route) |
| **Dag & Nacht** | inhibitie (Stroop-achtig) | gebouwd (step-danger) |
| **Simon** | werkgeheugen (audio-visuele volgorde) | **te bouwen** |
| **Wisselen** | cognitieve flexibiliteit (taakwissel) | **te bouwen** |

**Reskin-heuristiek (cruciaal voor variatie zonder herhaling):** *houd het werkwoord constant,
verwissel de fictie* (dier + plek + seizoen + inzet). Eén "onthoud-de-route"-engine (Corsi) wordt zo
5+ verschillende missies (das naar burcht → vennen op volgorde → eekhoorn-nootjes → herten in sneeuw
→ bandensporen van een stroper). **Varieer telkens één as** (lengte, afleiders, dag/nacht,
tijdsdruk aan/uit) zodat het als nieuw werk voelt, niet als her-test.

### 12.3 Mini-game catalogus (launch-set + reserve)
Uit het research (19 zaden). **Launch ≈ 10**, gespreid over alle vijf engines en vier seizoenen; de
rest is reserve voor latere gebieden. Volledige tabel met seizoen/herhaalbaarheid/safety-flag staat
in het research (Theme D) en wordt als data verwerkt in `HANDOFF.md §6.2`.

| # | Mini-game | Engine | Verhaal-haak |
|---|---|---|---|
| 1 | Spoor/track ID | Zoeken | banden-/laarssporen bij kapplek |
| 2 | Dieren tellen | Simon | populatiecheck die verstoord wordt |
| 3 | Wildcamera plaatsen & foto-ID | Corsi + Zoeken | camera betrapt de stroper/kapper |
| 4 | Ecoduct-check | Zoeken + Wisselen | iemand blokkeerde de oversteek |
| 5 | Nestkast ophangen | Corsi | — |
| 6 | Broedstoof / takkenril (vliegend hert) | Simon | — (Veluwe-specifiek) |
| 7 | Heide/ven-herstel | Wisselen | de hoopvolle finale |
| 8 | Hek & wildspiegel-check | Zoeken | doorgeknipt hek = toegang stroper |
| 9 | Brandwacht (uitkijktoren) | Zoeken | toren = ook wayfinding-uitzichtpunt |
| 10 | Invasieve plant verwijderen | Dag & Nacht | — |
| 11 | Waterpeil/bron checken | Simon | verlegde/geblokkeerde beek |
| 12 | Vogels ringen | Corsi | — |
| 13 | Zaad verzamelen | Zoeken | — |
| 14 | Pad herstellen | Corsi | — |
| 15 | Zwerfafval opruimen | Dag & Nacht | bewijs van indringers |
| 16 | GPS/telemetrie-tracking | Corsi | — |
| 17 | Vastzittend dier bevrijden & vrijlaten | Wisselen | climax: dier uit gevonden strik (niet-grafisch) |
| 18 | "Reekalf niet aanraken" | Dag & Nacht | — (al gebouwd in Missie 2) |
| 19 | "Zwijnen niet voeren" | Dag & Nacht | — |

### 12.4 Moeilijkheid die meegroeit (ontwerp-gevoel)
Doel (jouw expliciete wens): **moeilijker worden over tijd én met vaardigheid.** Ontwerpkant:
- **Onzichtbare staircase richting "flow":** lengte/afleiders/tempo schalen zo dat het kind rond
  ~70-80% succes blijft. Langer/moeilijker na succes, korter na missers.
- **Alleen omhoog zichtbaar, omlaag stil.** Opschalen mag een trotse, zichtbare keuze zijn ("Klaar
  voor een lastiger spoor?"); afschalen gebeurt onzichtbaar — nooit als zichtbare degradatie.
- **Vaardigheid telt door over het hele spel:** per engine een meegroeiend "vaardigheidsniveau" dat
  het startpunt van elke nieuwe missie bepaalt (een geoefende speler start hoger). Mechaniek in
  `HANDOFF.md §6.1`.
- **Kind houdt de regie:** altijd een waardige "Maak makkelijker / Geef een hint"-knop (steunt
  autonomie; voorkomt frustratie). Geen timers standaard aan.
- **Beloning informatief, niet belonend-controlerend** (overjustification-effect): foto's voor het
  ranger-album, jasje-patches, zichtbaar herstellende heide — geen punten/sterren-ranking, nooit
  vergelijken, nooit een faal-score. **Proces-lof** ("je keek heel goed"), geen persoon-lof.

### 12.5 Gevolgen bij crashen — "echt en volwassen, nooit beschamend"
Het research adviseert de "1/3 → 3× → terug naar huisje"-loop te verzachten, omdat een setback-straf
die voortgang wist en het kind verplaatst, **schaamtevol** kan voelen. **Jij wilt juist échte
gevolgen** (Alvah speelt al stevige games). Die twee verzoenen we door de **scheidslijn te
verleggen**:

> **Gevolgen vallen op uitrusting, middelen en tijd — concreet, herstelbaar en volwassen.
> Nooit op Alvah's waarde als ranger, en nooit op de veiligheid van een dier.**

Ontwerp:
- **Voertuig heeft échte duurzaamheid.** Bomen/rotsen doen echte schade; rijden vraagt aandacht.
  Bij totale schade is het voertuig **kapot** — geen cute "oeps", maar een nuchtere ranger-radio-
  toon: *"Voertuig beschadigd. Te voet verder of terug voor reparatie?"*
- **Het gevolg is verlies van gemak, niet van eigenwaarde:** kapot voertuig → **te voet verder**
  (langzamer; heli-only-plekken tijdelijk onbereikbaar) **of** reparatie die **reparatie-onderdelen
  / ranger-budget** kost — middelen die je liever aan betere uitrusting/upgrades besteedt. Crashen
  heeft zo een echte *opportunity cost* (sim-/management-gevoel), volwassen i.p.v. kinderachtig.
- **Schade is zichtbaar en blijft** tot reparatie (modder, deuken, krassen) — een echt, afleesbaar
  gevolg, geen abstracte levens-teller.
- **Checkpoints, geen wis.** Je verliest de huidige rit-voortgang en middelen, **niet** de hele
  missie, en je wordt **niet** vernederend naar het huisje teleportert; het voertuig respawnt rustig
  op het dichtstbijzijnde pad een stukje terug.
- **Koppeling met progressie:** netjes rijden = middelen sparen = eerder betere uitrusting. Zo voedt
  het gevolg-systeem de vaardigheidsprogressie (§12.4) i.p.v. te straffen.
- **Wat blijft verboden (de échte rode lijn):** game-over die het kind kleineert, "je faalde de
  ranger-taak", een dier dat zichtbaar gewond raakt door jouw fout, of een score die hem afrekent.
- **Instelbaar:** moeilijkheid van het gevolg (van "stevig" tot "mild/assist") als Tweak/instelling,
  zodat Floris het op Alvah kan afstemmen. Standaard: **stevig maar eerlijk.**

### 12.6 Wereld-leesbaarheid & wayfinding
- **Klein, knus, leesbaar low-poly** met sterke **landmarks** (uitkijktoren, huisje, een herkenbaar
  ven) en "weenies" (hoge/heldere baken-objecten) — speler *leest de wereld*, à la BOTW-vroege fase.
- **Eén doel-marker + kleine hoekkaart met één pin**, versterkt met **in-world breadcrumbs** (een
  pad dat oplicht, of de mentor-ranger om te volgen) en een **"wijs me de weg"-hulp**. Verdwalen is
  nooit een fail-state.
- **Spaarzaam, niet vol** — vermijd marker-soep; een paar duidelijk thematische activiteitsclusters.
- **Voertuig-split is goede wayfinding:** auto/motor op paden = vanzelf railing; heli = vrijheid +
  het "klim hoog voor overzicht"-trucje (vliegen onthult de wereld/mentale kaart).

### 12.7 De huisje-hub (knus thuisbasis)
- **Diegetisch, geen menu:** loop naar de **computer** (missiekeuze), **klim de ladder** (heli),
  **open de deur** (grondvoertuigen). Warme lamp, kachel, de brief op tafel, de mentor aanwezig.
- **Case-board** aan de muur (foto's + draad) dat de verhaalvoortgang toont en het kind tussen
  missies vooruit trekt. Het huisje is ook de **emotionele veilige plek** die het no-shame-ontwerp
  nodig heeft.

### 12.8 Verhaal & antagonist (kindveilig, hoopvol)
- **Aanpak (blend):** "natuur-heeft-hulp-nodig" (Octonauts-model) + een **lichte mysterie-lijn**
  (clues over missies heen) + een **af en toe opduikende, klungelige, vangbare stroper** (Wild-
  Kratts-model). Boog per arc: **slim zijn → op camera betrappen → melden bij de BOA → herstellen.**
  Nooit geweld, nooit angst/verdriet als kerngevoel; een slechterik kan zelfs verbeteren.
- **Echte (kindveilige) verankering** om mechanieken op te bouwen: **blessen** (gekleurde stippen —
  blauwe stip = moet blijven staan, dus ongemarkeerd kappen is verdacht: mooie kind-mechaniek),
  **wildcamera's** (cf. Snapshot Hoge Veluwe), **BOA-patrouilles**, **bewijs fotograferen**. Houd
  illegale houtkap in NL **bescheiden** (kleinschalige houtdiefstal), nooit een feiten-dump.
- **Emotionele veiligheid — DOEN:** dreiging altijd *oplosbaar* en *off-screen opgelost*; hoopvol
  herstel tonen; kind capabel en in controle; antagonist komisch/klungelig en vangbaar; elke
  spannende beat binnen dezelfde korte sessie afronden.
- **NIET:** gewonde/bloedende/dode dieren, wapens in gebruik, jump-scares, duisternis-als-angst,
  achtervolg-paniek, harde dreig-stings, een verdrietig/onopgelost einde, of impliceren dat het kind
  een dier in de steek liet. *(Een gevonden, lege strik die je veilig weghaalt: oké. Een dier dat er
  zichtbaar in vastzit: niet.)*

### 12.9 Eén 3D-ervaring (wereld + verhaal + mini-games)
- **Mini-games in-situ:** loop naar iets en de taak gebeurt **dáár** (bukken bij sporen, camera
  heffen om een dier te kaderen, stammen sorteren bij de stapel) met een **rustige camera-inzoom**
  en soepele uitzoom terug naar vrij rondlopen. **Nooit** een los pop-up-puzzelscherm.
- **Diegetische UI waar het kan:** missiekeuze = de computer; opdracht = brief/bordje; voortgang =
  case-board; bestemming = lichtbaken in de lucht of de mentor om te volgen; "voorzichtig" = de
  fysieke schade/slow van een botsing. **HUD minimaal:** alleen hoekkaart+pin, interactie-prompt en
  een rustige voertuig-status.
- **Camera-comfort = toegankelijkheid:** rustige **third-person** (iets top-down bij rijden) als
  default; **geen** head-bob/motion-blur; soepel-geëaste draaiingen; gematigde FOV. **Echte 3D
  reduced-motion-modus** (minder camera-swing, stabiele horizon, langere transities).
- **Verhaal in-world tonen** (de jeep van de stroper rijdt in de verte weg; de mentor loopt naar je
  toe en *spreekt*; het bevrijde dier rent weg; de heide groeit zichtbaar terug) i.p.v. tekstblokken.
- **Scope-discipline:** liever compact-en-betekenisvol dan groot-en-leeg; "leven" goedkoop oproepen
  met **ambient geluid, licht, seizoens-tint en een paar loop-animaties van dieren**, niet met een
  grote of zwaar-gesimuleerde wereld.

### 12.10 Toegankelijkheid & tekst — aanscherping uit research
- **Lettertype:** schone schreefloze (Arial/Verdana/Open Sans). **GEEN OpenDyslexic/Dyslexie-font** —
  onderzoek (Rello & Baeza-Yates 2013; Wery & Diliberto 2016; Kuster 2018) toont géén voordeel en
  vaak géén voorkeur. *(Dit corrigeert de eerdere "overweeg dyslexie-lettertype" in §5/§7.)*
- **Achtergrond nooit fel wit** — crème/zacht pastel; donkere tekst op licht. Vermijd rood/groen.
- **Audio + icoon + animatie is het primaire kanaal; tekst is back-up.** Elke instructie én story-
  beat moet volledig te begrijpen zijn met de tekst óngelezen. Eén korte zin per beat, voorlezen +
  karaoke-highlight, korte gesynchroniseerde tekst (let op redundantie-effect: niet lang lezen én
  identiek horen).
- **Hit targets ≥ 44-48px**, goed gespreid; één-knop-bediening; OS-reduced-motion respecteren.
- **Jargon = optionele "knap-woord"-badges** (beeld + geluid eerst), nooit verplicht lezen.

### 12.11 Bijgewerkte open vragen (v2)
1. **Gevolg-zwaarte:** wat is de juiste default-stevigheid van het schade/middelen-systeem (§12.5)
   voor Alvah — en welke middelen-economie (alleen reparatie, of ook brandstof/upgrades)?
2. **Launch-10:** welke 10 mini-games uit §12.3 eerst, en in welke missievolgorde?
3. **Antagonist-dosering:** hoe vaak mag de klungelige stroper opduiken zonder te gaan dragen?
4. ~~**Vaardigheidszichtbaarheid**~~ **BESLIST (21 juni): JA, badges.** Het kind ziet zijn vijf
   breinkracht-badges groeien (zie §13.6). Geframed als persoonlijke groei, nooit als ranking/
   vergelijking.
5. **3D-camera:** vaste-ish follow vs vrije third-person — eerst testen met Alvah op misselijkheid.
6. **Middelen-economie in de hub:** waar/hoe repareer/upgrade je (werkbank in het huisje?).
7. **Metgezel-soort:** raaf (aanbevolen), ranger-hond, of jonge vos? Zie §13.3.
8. **Verhaal-lengte:** is een 4-hoofdstukken seizoensboog (§13.4) de juiste scope voor v1?

---

## 13. v2 — metgezel, verhaalboog, game-volledigheid & te-leren-feiten

> Toegevoegd 21 juni 2026, n.a.v. Floris' vragen: zijn de spellen compleet? cooler/betere EF-variaties?
> een langere verhaallijn? en een dier dat je redt, verzorgt en dat je vriend/metgezel wordt.
> Plus: badges = ja; alles schaalbaar. Bouw-kant in `HANDOFF.md §7`.

### 13.1 Game-volledigheid — verdict & nieuwe variaties
De 19-game-catalogus (§12.3) dekt alle vijf engines en vier seizoenen — een goede basis. Twee echte
gaten + verbeteringen om het cooler te maken en EF beter te trainen:
- **Simon & Wisselen zijn het dunst** (elk ~3 games) én nog niet gebouwd. Versterk ze (zie §13.2).
- **Geen geluid-laag.** Dat is zonde én een gemiste EF-kans — zie §13.2 (de sterkste toevoeging).
- **Geen verzorg-over-tijd-lus.** Toegevoegd als metgezel-mechaniek (§13.3) — traint alle vijf EF's.
- **Geen verhaal-doorlopende lijn.** Toegevoegd als seizoensboog (§13.4).

### 13.2 Nieuwe & coolere EF-variaties (vooral Simon & Wisselen)
**Geluid-echo (Simon — de aanrader):** dieren *roepen* een reeks en jij herhaalt — écht werkgeheugen
én je leert de geluiden. Bron-echt en magisch: **burlen** (edelhert), **blaf/fiep** (ree), **knor**
(zwijn), **kroa-kroa** (raaf), **nachtzwaluw-ratel**. "Antwoord het dier", nooit "herhaal de reeks".
- **Geluid-herkennen (Zoeken/auditief):** welk dier maakte dit geluid? — mysterie + leren.
- **Dag/nacht-dieren sorteren (Wisselen + Dag&Nacht):** das, zwijn, nachtzwaluw zijn nacht-actief;
  sorteer "dag-dier naar de open plek, nacht-dier naar het hol" terwijl de regel af en toe omdraait.
  Bron-echt (research Deel 4) en een schoolvoorbeeld van flexibiliteit.
- **Monitoring-werkbank (Wisselen):** wissel tussen *tellen* en *fotograferen* aan de wildcamera
  terwijl een bordje de taak omdraait — ranger-echt (Snapshot).
- **Gewei-vergelijk (Simon/geheugen):** onthoud welk gewei groter is dan vorig jaar (feit: gewei
  valt af en groeit gróter terug). Kort, leuk, leerzaam.
- **Spoor-detective (Zoeken+deductie):** welk dier liep hier? — koppelt aan de stroper-mysterielijn.

### 13.3 Metgezel — redden → verzorgen → vriend (de grote nieuwe mechaniek)
Wat Floris wil: een dier dat je redt, een tijd verzorgt, en dat daarna **als vriend met je meeloopt**
door het spel. Educatief spanningsveld: de ranger-kernles is juist *NIET aanraken / NIET voeren /
wilde dieren loslaten*. We lossen dit elegant op — en maken de spanning zelf léérzaam:

> **Twee lagen.** (a) Een terugkerende **opvang-en-loslaten-lus**: af en toe een dier dat écht
> hulp nodig heeft, dat je tijdelijk verzorgt en dan ontroerend **vrijlaat** (de echte les: helpen
> én loslaten). (b) Één **vaste metgezel** die je vroeg in het verhaal redt en die — als uitzondering,
> goed uitgelegd — bij je blijft en meegaat.

**De discriminatie-les (sterk EF-moment):** het reekalf laat je líggen want mama komt — ít dier (echt
verweesd/gewond) heeft wél hulp nodig. Het kind leert het *verschil* herkennen (inhibitie +
flexibiliteit): niet elk jong dier oppakken, maar wél het juiste.

**Aanbevolen metgezel: een jonge raaf.** Magisch, superslim, kan vanuit de lucht **scouten**
(past perfect in de semi-open 3D-wereld + helpt bij Zoeken), corvidae binden écht met mensen, en de
raaf is *het* Veluwe-terugkeer-succes (sinds 1976) — thematisch goud. Alternatieven (open vraag
§12.11 Q7): **ranger-hond** (het meest realistisch; loopt mee, snuffelt sporen op) of **jonge vos**.
Bouw het systeem **soort-agnostisch** zodat de keuze later kan.

**De verzorg-lus traint alle vijf EF's** (niet alleen decoratie):
- **Werkgeheugen/volgorde (Simon):** onthoud de zorgvolgorde (warmte → voer → rust → check).
- **Inhibitie (Dag&Nacht):** niet te véél aaien/voeren — échte les: te veel mensencontact is slecht.
- **Flexibiliteit (Wisselen):** behoeften veranderen terwijl het groeit (melk → vast voer; warmte →
  beweging) — wissel van zorgroutine.
- **Volgehouden aandacht (Zoeken):** merk subtiele tekenen op dat het beter/slechter gaat.
- **Groeifasen:** baby → jong → (semi)zelfstandig; bij elke fase nieuwe zorg én nieuwe hulp-kunstjes.

**De metgezel helpt onderweg (doorlopend, optioneel):** scouten/spotten (raaf vliegt op en onthult;
hond snuffelt sporen) als een **vriendelijke hint** die koppelt aan de "wijs me de weg / hint"-knop
(§12.4). Houd het EF-werk bij het kind — de metgezel geeft een zetje, doet het niet vóór.

**Toon & veiligheid:** het geredde dier is *echt* hulpbehoevend maar **nooit grafisch** (verzwakt/
verdwaald, niet bloedend). Hoopvol, verzorgend. Bij de opvang-en-loslaten-lus is het afscheid
ontroerend-positief ("hij is nu sterk genoeg"), nooit verdrietig-verlatend.

### 13.4 De verhaalboog — één seizoen op de Veluwe (4 hoofdstukken)
Een begrijpelijke, hoopvolle doorlopende lijn die seizoenen (research Deel 4) als hoofdstukken
gebruikt, de stroper/boskapper-mysterielijn (§12.8) laat oplopen, en eindigt in herstel-successen.
De metgezel groeit door het hele jaar mee.

- **Proloog — het huisje.** Nieuwe ranger, ontmoet de mentor. Je redt vroeg je metgezel (jonge raaf
  uit de nood) → de verzorg-lus begint. Eerste vage hint: er klopt iets niet in het bos.
- **H1 — Lente (kraamtijd).** Leer het vak: reekalf-niet-aanraken (Missie 2, gebouwd), verdwaalde
  frisling (Missie 1, gebouwd). *Clue 1:* vreemde sporen, een doorgeknipt hek.
- **H2 — Zomer.** Heide/ven-werk, vliegend-hert-broedstoof, brandwacht. *Clue 2:* de wildcamera
  betrapt een schimmige figuur; een lége strik gevonden. De metgezel kan nu scouten.
- **H3 — Herfst (bronst).** Edelhert-burlen, tellen, spanning loopt op: volg de stroper/boskapper via
  spoor en bandensporen; leg bewijs vast op camera. Grotere onthulling.
- **H4 — Winter.** Ontknoping: slim zijn → op camera betrappen → **melden bij de BOA**. Daarna
  **herstel**: venherstel (Kootwijkerveen), heide openhouden, het geredde/vrijgelaten dier gedijt.
  Hoopvolle finale, met de terugkeer-successen (raaf 1976, zeearend 2006, wolf 2018/19) als echo van
  "de natuur komt terug".

Elk hoofdstuk = zelfstandige missies **plus** één clue voor het seizoensmysterie (case-board in het
huisje, §12.7). Schaalbaar: latere gebieden krijgen hun eigen seizoensboog.

### 13.5 Te-leren-feiten → gekoppeld aan een spel (subtiel, niet als lijst)
De verified feiten uit `veluwe-research.md` zitten *in de handeling*, niet in een feitenmuur:

| Cool feit (geverifieerd) | Waar je het leert |
|---|---|
| Reekalf "drukt zich", niet aanraken — mama komt | Missie 2 (gebouwd) + discriminatie-les metgezel (§13.3) |
| Biggen dragen een gestreepte "pyjama" als camouflage | Missie 1 spot-game (gebouwd) |
| Edelhert burlt; gewei valt af en groeit gróter terug | Geluid-echo (§13.2) + gewei-vergelijk |
| Eekhoorn vergeet nootjes → daar groeien bomen | Corsi nootjes-verstoppen/terugvinden (#16/seed) |
| Das-burcht: honderden meters, tot ~80 ingangen | Das-missie / spoor-detective |
| Zandhagedis wordt in de lente felgroen, werpt staart af | Zoeken op heide/stuifzand |
| Ecoduct: "brug voor dieren"; 4000 oversteken/jaar | Ecoduct-check (#4) |
| Vliegend hert: grootste kever, "gewei" alleen voor show | Broedstoof bouwen (#6) |
| Raaf terug sinds 1976; partners voor het leven | Metgezel-raaf + finale |
| Nachtzwaluw broedt op de grond, "geitenmelker" | Brandwacht/nacht-geluid + dag/nacht-sorteren |
| Niet voeren (sinds 2002 verboden) | "Zwijnen niet voeren" (#19) |
| Adder is schuw, glijdt weg — niet aanraken | Dag&Nacht gevaar-stap (gebouwd) |

Houd feiten kort, één idee, beeld + geluid; vaktermen (rotte/frisling) als optionele knap-woord-badge.

### 13.6 Badges — BESLIST: ja (persoonlijke groei, geen ranking)
Vier soorten verzamelbare badges, allemaal als **groei**, nooit als vergelijking/score:
1. **Vijf breinkracht-badges** — één per engine (Zoeken/Corsi/Simon/Dag&Nacht/Wisselen), die mee
   oplevelt met het vaardigheidsniveau (bv. brons → zilver → goud). Het kind ziet zijn breinkracht
   gróeien. Neutraal, trots, nooit "je bent beter dan…".
2. **Missie-badges** — per voltooide missie (bv. Frisling-redder, Reekalf-wachter; bestaand).
3. **Knap-woord-badges** — optionele vaktermen (frisling/rotte) met beeld + geluid (§12.10).
4. **Metgezel-mijlpalen** — groeifasen van je geredde vriend (§13.3).
Verzamelen voelt informatief (album/patches/case-board), niet belonend-controlerend (§12.4).

### 13.7 Schaalbaarheid — alles uitbreidbaar (BESLIST)
Floris: "maak het schaalbaar zodat we altijd games en dingen kunnen toevoegen." Bevestigd ontwerp:
alles is **data-gedreven** — nieuwe mini-games, variaties, dieren, feiten, metgezel-soorten, badges en
héle gebieden komen erbij als **content (data), niet als nieuwe code**. De vijf engines zijn de
vaste motor; al het andere is een skin/record erop. Concrete uitbreidpunten staan in `HANDOFF.md §7.5`.

---

## 14. v2 — Avatar-aanpassing & identiteit (de speler = jouw eigen ranger)

> Toegevoegd 21 juni 2026 op verzoek van Floris: maak de speler-avatar aanpasbaar (jongen/meisje,
> andere naam, haarkleur, -stijl, kleding — basics, allemaal ranger-achtig). Dit bestond al als
> *techniek*-haak in `3d-animals-build-plan.md §12e/§13f`; hier promoveren we het tot een **bevestigde
> game-feature**. Bouw-kant in `HANDOFF.md §8`.

### 14.1 Character-creator bij de start (knus, ranger-thema, dyslexie-vriendelijk)
- Eénmalig bij de eerste keer spelen, in/bij het huisje (later altijd te wijzigen via een
  **spiegel/kledingkast** in de hub — diegetisch, geen menu). Kort: een paar tikbare keuzes, geen
  diepe editor.
- **Keuzes (klein, alles ranger-achtig):**
  - **Jongen / meisje** (of neutraal) — bepaalt basis-figuur + stem-toon.
  - **Naam** — kies uit een lijst voorgelezen namen **of** typ je eigen naam (typen is lastig met
    dyslexie → lijst eerst, vrij typen optioneel, met voorlezen). Standaard: "Alvah".
  - **Huidtint** — een rij tinten.
  - **Haarkleur** + **haarstijl** — een handvol opties.
  - **Kleding** — ranger-basics: jas-kleur, hoed aan/uit, laarzen/uitrusting. Geen niet-ranger-kleding.
- Grote tik-doelen (≥44–48px), beeld + voorlezen, nooit verplicht lezen.

### 14.2 Default = "Alvah"-preset (verzoent met het likeness-werk)
De gedetailleerde Alvah-gelijkenis (`3d-animals-build-plan.md §13d`, uit de foto's) wordt het
**standaard-preset**: start het spel en je bent Alvah. De creator zit er **bovenop** — Alvah kan
zichzelf houden, of een meisjes-ranger maken, haar veranderen, enz. De swappable iris/haar/outfit uit
§12e/§13f zijn precies de haken die dit mogelijk maken (geen apart systeem).

### 14.3 Naam & avatar overal doorgevoerd
- De gekozen **naam** verschijnt in briefings en voorlezen ("Hoi {naam}!" i.p.v. alleen "Hoi ranger!"),
  in badges en in het case-board. Sterke, goedkope personalisatie-winst.
- De gekozen **avatar** is het figuur dat je in de 3D-wereld bestuurt, in de hereniging-platen en op
  de badges/foto's ziet.

### 14.4 Cabin-personalisatie (eigenaarschap — kleine, coole toevoeging)
Het huisje groeit met je mee: je **fotomuur/album**, het **plekje van je metgezel** (raaf-stok/
hondenmand), je verdiende **uitrusting/patches** en het **case-board**. Maakt de hub van *jou* en
versterkt de no-shame veilige-plek-rol (§12.7). Eén diegetisch **"ranger-logboek"** in de hub bundelt
album + badges + knap-woorden + case-board, zodat alles op één begrijpelijke plek staat.

### 14.5 Is dit genoeg voor een cool spel? (verdict)
Ja — de kern staat: een **3D semi-open Veluwe**, **jouw aanpasbare ranger**, een **groeiende
metgezel**, **echte dieren** met geluid, **10+ mini-games** over vijf breinkracht-engines, een
**seizoens-verhaalboog** met een vangbare stroper/boskapper, **zichtbare groei** (badges), en
**echte-maar-volwassen gevolgen** bij crashen. De drie dingen die het van "leuk" naar "cool" tillen:
de **geluid-laag** (§13.2), de **metgezel** (§13.3) en **jouw eigen ranger + huisje** (§14). Verdere
ideeën zijn nice-to-have, geen blocker — eerst dit bouwen en met Alvah testen.
