# Briefing: EF-oefeningen voor Alvah — evidence, repos en bouwplan

**Bottom line up front.** Voor een 7-jarige met PKU, vermoedelijk dyslexie (Protocol 3.0) en ADHD-profiel is de meest verdedigbare koers: **bouw een kleine set van 4–6 klassiek gevalideerde, non-verbale EF-taken (Corsi, Simon-patroon, Day-Night/Animal Stroop, Go/No-Go, cued task-switching, Visual Search/Posner) met adaptieve staircase, in Astro-routes met pure `<script>`-blokken en één gedeeld localStorage-schema**. De meta-analytische literatuur (Melby-Lervåg, Redick & Hulme 2016; Sala & Gobet 2020; Gobet & Sala 2023) sluit far-transfer naar IQ, schools functioneren of ADHD-symptomen effectief uit; **de app mag géén transferclaims maken**. Wat het wel biedt: voorspelbare oefenritme, vader-zoon-ritueel, objectieve trendvisualisatie (accuracy, RT, reactietijd-variabiliteit) voor eigen gebruik of overleg met behandelaar, en een rustig, papieren-redactioneel design dat Alvahs zintuigen niet overvraagt.

De rest van dit document is driedelig: **BLOK A** repo-inventaris, **BLOK B** evidence-gegradeerde spelmechanieken per EF-domein, **BLOK C** Astro/JS/a11y/kliniek-implementatie. Aan het eind: **top-5 oefeningen** met kant-en-klare Claude Code prompts.

---

## BLOK A — Open-source repositories

### A.1 Het veld in één alinea

De bruikbare wereld is klein en bijna volledig gecentreerd rond **jsPsych** (MIT, modern, actief onderhouden, plugin-architectuur). Alles wat eromheen ligt is óf GPL/AGPL (problematisch voor hergebruik in eigen codebase zonder ook de eigen code open te stellen) óf dode student-repos. **Strategische keuze: jsPsych-taken als *referentie-implementaties* lezen, en vervolgens als vanilla-JS port in Astro neerzetten — niet jsPsych zelf embedden.** Dat is zowel juridisch schoon (MIT-licensed, dus afleiden mag) als pedagogisch beter (eigen UI-taal, NL-strings, Fraunces/Inter Tight, kleurenblind-safe palet).

### A.2 Repo-overzicht per categorie

**jsPsych-ecosysteem (MIT — best in klasse, hoofdbron)**

| Naam | URL | Licentie | Laatste activiteit | Stack | NL-lokalisatie | Astro-integratie |
|---|---|---|---|---|---|---|
| jsPsych core | github.com/jspsych/jsPsych | MIT | actief (2024-2026) | TypeScript, vanilla | Makkelijk (instructies zijn strings) | Matig als library, makkelijk als referentie |
| jspsych-contrib plugins | github.com/jspsych/jspsych-contrib | MIT | actief | TypeScript | Makkelijk | Als referentie: makkelijk |
| vekteo/Nback_jsPsych | github.com/vekteo/Nback_jsPsych | MIT-stijl + Zenodo DOI | 2021 | jsPsych 6.x | Makkelijk (al NL/FR/PT/ES/HU in zustertaken) | Referentie-port |
| vekteo/GoNoGo_jsPsych | github.com/vekteo/GoNoGo_jsPsych | MIT-stijl + Zenodo DOI | 2021 | jsPsych | Makkelijk | Referentie-port |

jsPsych-core bevat kant-en-klare plugins voor vrijwel elke paradigma (`html-keyboard-response`, `image-keyboard-response`, `visual-search-circle`, `serial-reaction-time`, `free-sort`, `categorize-image`). `jspsych-contrib` voegt specialistische plugins toe zoals **corsi-blocks**, **rdk**, **pipe** en enkele n-back varianten. Voor Alvahs app gebruik je deze codebases als **juridisch veilige leesbron**: kopieer trial-timings, staircase-logica, stimulusvolgorde; herschrijf UI in eigen Astro-component met Nederlandse strings.

**n-back implementaties (gemengd)**

| Naam | URL | Licentie | Laatste activiteit | Bruikbaarheid |
|---|---|---|---|---|
| tmlbl/nback | github.com/tmlbl/nback | **GPL v2** | oud (~2014) | Alleen als concept-referentie — GPL besmet je eigen code als je kopieert |
| JamieCummins/dual-nback | github.com/JamieCummins/dual-nback | **GPL** | oud | NL-audio al aanwezig, maar GPL |
| Brain Workshop | sourceforge.net/projects/brainworkshop | **GPL** | 2010-legacy, Python/Pyglet | Historisch, niet web-ready |

**Let op: alle pre-jsPsych n-back-repos zijn GPL-geïnfecteerd.** Voor een niet-openbare site is dat praktisch gezien misschien tolereerbaar (je distribueert niets), maar zodra je ooit de code deelt moet je je eigen code ook GPL'en. Veiliger: implementeer single n-back zelf vanaf de beschrijving in Kirchner (1958)/Jaeggi (2008); dat is ~200 regels vanilla JS.

**Stroop / Flanker / Go-NoGo / Corsi / DCCS / Tower of London**

Voor al deze paradigma's geldt hetzelfde patroon: **jsPsych-plugins of community demos** zijn de enige levende open-source bronnen; losstaande GitHub-repos zijn meestal dood of ongelicenseerd (wat juridisch = niet hergebruiken). Concreet:

- **Stroop**: `jspsych/plugins/plugin-html-keyboard-response` + eigen stimulus-lijst. Er is geen goede standalone "Animal Stroop JS" — zelf bouwen met emoji-stimuli uit Unicode of eigen SVG's.
- **Flanker**: jsPsych contrib bevat `jspsych-flanker`; vanaf de ANT-child (Rueda et al. 2004) zijn duidelijke parameters bekend (stimulus 170 ms, ISI 1500 ms).
- **Go/No-Go**: vekteo/GoNoGo_jsPsych is de schoonste referentie met 20 oefen- + 2×160 test-trials en P/R key-mapping.
- **Corsi**: jspsych-contrib heeft een `corsi-blocks`-plugin; alternatief is zelfbouw met 9 absoluut-gepositioneerde divs en een array-sequentie.
- **DCCS**: geen standaard plugin; volg Zelazo (2006) *Nature Protocols* 1:297 voor exacte protocol.
- **Tower of London**: `jatos.org` en PsyToolkit hebben voorbeelden; lab.js heeft een ToL-template. Geen rijpe standalone JS-repo; zelfbouw is overzichtelijk (3 stokken, 3 ballen, drag-and-drop of tap-tap).

**Experiment-frameworks als geheel**

| Naam | Licentie | Geschikt voor Alvah? |
|---|---|---|
| jsPsych | MIT | **Ja** als referentie-codebase; *mogelijk* als runtime in Astro via dynamische import, maar voegt 200 KB+ bundle toe en dwingt eigen UI-patronen |
| lab.js | **AGPL** | Nee — AGPL is copyleft over een netwerk, juridisch risicovol voor eigen site |
| PsychoJS (psychopy/psychojs) | **GPL v3** | Nee — zelfde GPL-probleem |
| PsyToolkit | Non-OSI, academisch | Nee — geen open-source licentie |
| Gorilla | Gesloten, betaald | Nee |

**Nederlandse onderzoeksgroepen.** Sebastiaan Mathôt (github.com/smathot) publiceert **OpenSesame** (GPL) — desktop, niet web. Zijn web-lab experimenten zijn meestal jsPsych-gebaseerd. UvA Brain & Development Lab, Radboud Donders en UMCG hebben geen publieke EF-repo die direct bruikbaar is voor een website; hun code zit in OSF-projecten met gedeeltelijke deponering, meestal voor specifieke studies. Praktisch: **niet op rekenen**, bouw zelf met jsPsych als mentor.

**Scratch-projecten van Center on the Developing Child (Harvard).** Het CDC publiceert beschrijvingen van EF-spellen (rug&go, red light/green light, Simon Says, matching games) maar geen code. Hun "Games that Build Executive Function"-gidsen zijn goede *pedagogische* input voor framing, niet voor implementatie.

**Commerciële EF-apps met validatie-claims.** ACTIVATE (C8 Sciences, Sahni/Posner), Cogmed (Klingberg/Pearson), Lumosity, BrainHQ — **geen open source**. Lumosity schikte in 2016 een FTC-procedure voor $2 M wegens misleidende reclame; Cogmed heeft consistent near-transfer maar geen blinded klinische winst (Aksayli, Sala & Gobet 2019 meta, 50 studies, *Educational Research Review*); BrainHQ heeft sterkere evidence voor processing-speed bij ouderen (ACTIVE-trial) maar niet voor kinderen. **Geen van deze kan of mag gekopieerd worden.**

### A.3 Top-5 bruikbare referentie-repos (en uren-schatting)

| Rang | Repo | Rol | Uren-schatting integratie (Claude Code-geassisteerd) |
|---|---|---|---|
| 1 | **jsPsych core + jspsych-contrib** (MIT) | Leesbron voor trial-timings, plugin-structuur, staircase-patronen — nooit letterlijk embedden | **4–6 uur** per paradigma om te porten naar vanilla JS in Astro |
| 2 | **vekteo/GoNoGo_jsPsych** (MIT + Zenodo) | Kopie-klaar 40/160-trials protocol met fullscreen-handling | **3–4 uur** port |
| 3 | **vekteo/Nback_jsPsych** (MIT + Zenodo) | Verbal n-back Kirchner-protocol — let op: verbal, dus stimuli vervangen door emoji/vormen voor dyslexie-safety | **4–5 uur** port incl. stimulus-swap |
| 4 | **jspsych-contrib plugin-visual-search-circle** (MIT) | Direct bruikbaar model voor zoekplaatje | **3 uur** port |
| 5 | **jsPsych plugin `serial-reaction-time` / `categorize-image`** (MIT) | Bouwstenen voor DCCS en cued task-switching | **4–6 uur** per taak |

**Conclusie BLOK A**: koop je vertrouwen in het jsPsych-universum, niet in standalone repos. Voor elke oefening in Alvahs app bestaat een MIT-gelicenseerde referentie die Claude Code kan lezen en naar vanilla JS kan porten. Totaal voor de top-5 oefeningen: **~20–25 uur** actief sturen met Claude Code, verspreid over enkele weken.

---

## BLOK B — Evidence-gegradeerde spelmechanieken

### Eerst de context waar de hele EF-trainingsindustrie op staat

De meta-analytische consensus (2016–2023) is helder: **near-transfer werkt (kinderen worden beter in de getrainde taak), far-transfer werkt niet**. Melby-Lervåg, Redick & Hulme (2016, *Perspectives on Psychological Science* 11:512–534) — het standaardwerk — 87 publicaties, 145 vergelijkingen: "no convincing evidence of any reliable improvements when working memory training was compared with a treated control condition" voor intelligentie, woord-decodering, begrijpend lezen of rekenen. Sala & Gobet (2020, *Psychonomic Bulletin & Review* 27:423) repliceerden dit specifiek voor typisch ontwikkelende kinderen (41 studies, 393 effecten). Gobet & Sala (2023, *Perspectives* 18:125): "the lack of training-induced far transfer is an invariant of human cognition." De Jaeggi et al. (2008, *PNAS* 105:6829) dual n-back-claim is niet overtuigend gerepliceerd met actieve controlegroepen.

**Implicatie voor Alvahs app**: framing is cruciaal. Dit is "oefenspelletjes voor je superbrein" in alledaagse zin (plezier, concentratiegewoonte, vader-zoon-ritueel, zelfvertrouwen), niet "cognitieve training die je slimmer maakt". Overclaimen leidt tot teleurstelling; eerlijke framing houdt motivatie robuust.

### B.1 Werkgeheugen — 6 mechanieken

**Kernprincipes**: korte trials (≤4 s), stimuli non-verbaal (geen letters/woorden wegens dyslexie), geen harde response-deadline (PKU → wisselende alertheid), adaptieve staircase 2-up/1-down of Jaeggi-achtig.

**WM-1. Single n-back (n=1, n=2)**. Evidence **MATIG** (near-transfer robuust, Soveri et al. 2017 meta; far-transfer niet claimen). Recept: elke 2,5 s een stimulus (emoji/dier/vorm), kind drukt MATCH als huidige = n stappen terug; blok 20 items, 30% targets; start n=1; 3 blokken ≥80% → n=2; onder 60% → terug. Complexiteit eenvoudig (n=1) tot gemiddeld (n=2). Verdict voor Alvah: **ja**, als hoofdmechaniek — visueel, korte trials.

**WM-2. Dual n-back**. Evidence **ZWAK** voor kinderen; IQ-claim weerlegd (Melby-Lervåg 2016; Sala & Gobet 2020). Cognitief te zwaar voor 7-jarige ADHD-profiel. Verdict: **pas later of nooit** als default; eventueel verborgen achter "advanced"-optie na maanden single n-back.

**WM-3. Digit span (forward + backward)**. Evidence **STERK** als meetinstrument (WISC-V); als training **MATIG**. Alleen **digit**-versie (cijfers = PKU/dyslexie-neutraal); **geen letter-span** (dyslexie-struggle als stimulus = faalverwachting). Auditieve presentatie (vaders opgenomen stem = motiverend), cijfers niet visueel tijdens presentatie. Start span=3, klassieke 2-down/1-up. Backward ontgrendelt bij forward=5. Verdict: **ja, digit-versie**.

**WM-4. Corsi block tapping**. Evidence **STERK** (Kessels et al. 2000; klassiek paradigm). 9 blokken in canvas, sequentie licht op 1/sec, kind tikt na; fout = blok blijft kort zichtbaar met "bijna!"-tekst (geen rode feedback). Verdict: **topprioriteit** — taal-vrij, laag frustratie, dyslexie-vriendelijk, PKU-vriendelijk.

**WM-5. Simon-patroon (audiovisueel)**. Evidence **PRAKTIJK** (klassiek speelgoed, geen RCT-literatuur, face-valide WM). 4 gekleurde panelen met eigen toon, computer speelt sequentie (+1 per correcte ronde), kind herhaalt. Cap sequentie-lengte op 9 om frustratie te voorkomen. Verdict: **ja, ideaal opstartspel** — motiverend, laag ingang, turn-taking met papa mogelijk.

**WM-6. Running span**. Evidence **MATIG** (Cowan/Bunting lineage). Sequentie onbekende lengte; bij onverwachte STOP moet kind laatste N items reproduceren. Verdict: **ja, vanaf maand 2–3**, niet als eerste spel.

**Top-3 werkgeheugen voor Alvah: Corsi (1) → Simon-patroon (2) → Digit span audio (3)**. NIET bouwen: letter-span, dual n-back als default, elke variant met countdown-timer die alles verliest bij falen.

### B.2 Inhibitie — 6 mechanieken

**INH-1. Klassieke Stroop (woord-kleur)**. Evidence **STERK** bij vlotte lezers; voor dyslectici **ongeschikt** (leesvaardigheid confoundt interferentie-score — Adams et al. 2013; van Mourik 2005). Verdict: **nee** — dyslexie-killer.

**INH-2. Day-Night Stroop / Animal Stroop**. Evidence **STERK** (Gerstadt, Hong & Diamond 1994 *Cognition* 53:129; Montgomery & Koeltzow 2010). Toon kaart ☀️ of 🌙, kind tikt tegenovergestelde ("DAG"/"NACHT" als knoplabels). 16 trials/blok, respons-window ruim. Verdict: **topprioriteit inhibitie** — geen letters, klassiek gevalideerd, laag-arousal.

**INH-3. Fruit Stroop**. Evidence **MATIG** (Archibald & Kerns 2015). Fruit in kleur, twee modi: natuurlijke kleur noemen vs. getoonde kleur. Antwoord via kleurknoppen. Verdict: **ja**, goede variatie naast Day-Night; moduskeuze voegt task-switching toe (bonus EF).

**INH-4. Go/No-Go**. Evidence **STERK** (Wessel 2018 review; Simmonds et al. 2008 meta bij ADHD). Frequente Go 🐶 (80%), zeldzame No-Go 🐱 (20%); stimulus 800 ms; adaptieve No-Go ratio via false-alarm rate. Verdict: **ja**, ideaal voor ADHD-profiel — mits geen stressvolle countdown, framen als "wachtspel".

**INH-5. Flanker (Eriksen, kind-versie à la Rueda 2004 ANT-child)**. Evidence **STERK**. Rij van 5 pijlen of visjes; kind reageert op middelste richting; congruent vs. incongruent 50/50; stimulus blijft tot respons. Verdict: **ja**, tweede inhibitie-taak naast Day-Night, volledig visueel, skinable (vissen/pijlen/autootjes).

**INH-6. Stop-signal task (SST)**. Evidence **STERK** bij oudere kinderen/adolescenten; **minder geschikt <7j** (Lu et al. 2016: SSRT nog onstabiel bij kleuters met ADHD). Verdict: **later unlock** (maand 3+); niet als instap.

**Top-3 inhibitie voor Alvah: Day-Night/Animal Stroop (1) → Go/No-Go (2) → Flanker (3)**. NIET bouwen: klassieke woord-kleur Stroop; SST <8j als hoofdmechaniek; Lumosity-stijl speed-rounds met 60s-countdown zonder adaptieve drempel.

### B.3 Cognitieve flexibiliteit — 5 mechanieken

**FLEX-1. DCCS (Dimensional Change Card Sort)**. Evidence **STERK** (Zelazo 2006, *Nature Protocols* 1:297). Kaartjes met kleur én vorm, ronde 1 sorteer op kleur, ronde 2 op vorm, daarna gemengd met cue. Verdict: **ja**, leeftijdsadequate kern-flexibiliteitstaak, non-verbaal.

**FLEX-2. Cued task-switching (kleur/vorm)**. Evidence **STERK** met beste transfer-profiel van alle EF-trainingen voor kinderen (Karbach & Kray 2009, *Developmental Science* 12:978 — near-transfer én beperkte far-transfer naar inhibitie/WM/fluid intelligence bij 8–10j; ADHD-follow-up 2011 *Front Hum Neurosci* d≈1.6 interferentie, d≈0.9 verbaal WM). Plaatje met kleur+vorm, cue-symbool (🎨 of 🔷) dicteert welke dimensie, kind zegt regel hardop (verbal self-instruction = kerningrediënt; werkt óók bij dyslexie want gesproken). Verdict: **topprioriteit flexibiliteit** — hoogste evidence-ROI van alle EF-oefeningen voor kinderen.

**FLEX-3. WCST**. Evidence **ZWAK voor 7j**: regel-inferentie via negatieve feedback, 3 dimensies, hoge WM-belasting (PKU-kwetsbaar), faalervaring bij ADHD. Diamond (2013, *Annu Rev Psychol* 64:135) markeert WCST als samengesteld en moeilijk dissocieerbaar. Verdict: **nee**, gebruik DCCS.

**FLEX-4. Trail Making B (origineel)**. Evidence **MATIG als maat**, **ZWAK bij dyslexie** (letters confounden). Verdict: **nee in originele vorm**; eventueel "kleur-vorm-trail" als alternatief, maar DCCS en cued switching dekken dit beter.

**FLEX-5. Zoo Map (BADS-C)**. Evidence **MATIG**, genormeerd 8–16j, onder 8j vaak te veel regels. Verdict: **later** als transfer-taak, niet als kernmechaniek.

**Top-2 flexibiliteit voor Alvah: Cued task-switching (1) → DCCS (2)**.

### B.4 Aandacht — 5 mechanieken

**AAN-1. CPT (Conners/TOVA-achtig) als training**. Evidence **STERK als diagnostiek, ZWAK als training** (Rapport et al. 2013, *Clin Psychol Rev* 33:1237, meta van 25 studies: aandachttraining verbeterde aandacht niet significant; Cortese et al. 2015, *JAACAP* 54:164: geen blinded klinische transfer bij ADHD). Verdict: **nee** als trainingsmechaniek — saai, ADHD-afhakers. Wel bruikbaar als korte **baseline-meting** (3 min pre/post) voor RT-variabiliteit (PKU-monitor).

**AAN-2. Sustained attention met game-wrapper**. Evidence **MATIG** (Shalev et al. 2007 — near-transfer). Dieren over scherm, tik alleen op blauwe vis; hoge naar lage target-frequentie over sessies; adaptief via hit-rate én RT-SD. Verdict: **ja**, mits gegamed en ≤3 min aaneengesloten.

**AAN-3. Posner cueing**. Evidence **STERK paradigm** (Posner & Petersen 1990; Rueda et al. 2004 ANT-children). Kruisje midden, pijl wijst, ster verschijnt, kind tikt kant. 100%-valid → 80/20 → 50/50. PKU-relevant (Huijbregts et al. 2002: orienting/vigilantie-tekort). Verdict: **ja**, kort en PKU-relevant.

**AAN-4. Visual search / zoekplaatje**. Evidence **MATIG-PRAKTIJK** (Treisman; Shalev et al. 2007 trainbaar). Zoek de rode kikker; feature → conjunction → set-size 4→8→16. Verdict: **ja**, dyslexie-veilig, hoge engagement.

**AAN-5. Oddball**. Evidence **MATIG** — meer meet- dan trainingsinstrument. Verdict: **nee**, overlapt CPT.

**Top-2 aandacht voor Alvah: Visual search (1) → Posner cueing (2)**.

### B.5 Planning — 5 mechanieken

**PLAN-1. Tower of London (Shallice 1982)**. Evidence **STERK als construct** (Diamond 2013; genormeerd vanaf 7j). Training-evidence gemengd (meestal task-specifiek). 3 stokken, 3 gekleurde ballen, maak het doel-patroon in minimaal aantal zetten. Hardop plannen toegestaan. Verdict: **ja** — construct-sterk, non-verbaal, accuracy-georiënteerd (PKU-vriendelijk).

**PLAN-2. Tower of Hanoi**. Evidence **MATIG** (Welsh 1991). Vereist recursief denken, zwaarder dan TOL, meer WM-belasting. Verdict: **beperkt ja**, pas na beheersing TOL-5-zet; start 3 schijven.

**PLAN-3. Maze / labyrint**. Evidence **PRAKTIJK/MATIG** (NEPSY-II Route Finding, Porteus Maze historisch). Eerst met ogen, dan met vinger; muren raken = even terug. Verdict: **ja**, laagdrempelig, visueel.

**PLAN-4. Rush Hour / schuifpuzzel (Unblock Me-type)**. Evidence **PRAKTIJK**, construct-validiteit redelijk (correleert met TOL/ToH). Verwijzing in Diamond & Lee (2011, *Science*) als EF-interventie. Verdict: **ja**, hoog engagement bij ADHD, tastbaar, schaalbaar.

**PLAN-5. Zoo Map (BADS-C)**. Zie FLEX-5. Verdict: **later**, niet als kern.

**Top-2 planning voor Alvah: Tower of London (1) → Rush Hour (2)**.

### B.6 Waar de literatuur verdeeld is — kritische samenvatting

**Far-transfer van WM-training**: debat tussen Jaeggi/Au et al. (optimistisch, kleinere passieve-vs-actieve controlegroepverschillen) en Melby-Lervåg/Sala/Gobet (skeptisch, systematische problemen met baseline, passieve controles, heterogeniteit). Consensus 2023: **far-transfer is niet robuust reproduceerbaar**. Voor Alvahs app: nooit claimen.

**Task-switching bij kinderen**: Karbach & Kray 2009 is de positieve uitschieter — oorspronkelijk verhaal over transfer naar andere EF-domeinen — maar latere replicaties zijn kleiner en specifieker. Conservatief: ja, bouw het, maar verwacht primair near-skill-winst.

**ADHD en EF-training specifiek**: Cortese et al. (2015) NATURA-meta toonde dat op blinded teacher-ratings cognitive training geen significant effect heeft op ADHD-symptomen (~k=16, N~750). Kofler et al. (2013, *Clin Psychol Rev*, 319-studies meta): RT-IIV is robuuste ADHD-marker, gevoelig voor stimulantia maar niet voor psychosociale/cognitieve training. Dus: app **niet** positioneren als ADHD-interventie.

**Lumosity / Cogmed / BrainHQ**: FTC vs. Lumos Labs jan 2016 — $2 M schikking wegens misleidende claims (ADHD, dementie, schools functioneren). Cogmed (Klingberg): near-transfer consistent, far-transfer inconsistent (Aksayli et al. 2019). BrainHQ: sterker bij ouderen (ACTIVE-trial processing speed), niet bij kinderen. Geen daarvan is een betrouwbaar model om na te volgen.

**PKU-specifiek**: Christ, Huijbregts, de Sonneville & White (2010, *Mol Genet Metab* 99:S22–S32) documenteren dat vroeg-behandelde PKU vooral **executief werkgeheugen, prepotent response inhibition, processing speed en RT-variabiliteit** raakt; shifting en complexe EF equivocal. Dopaminerge depletie in prefrontaal (via Phe-tyrosine-competitie) en witte-stof-afwijkingen zijn de neuropathofysiologische basis. Phe-niveaus correleren dag-tot-dag met acute prestaties. **Consequentie**: app moet prioriteren WM-oefeningen en accuracy-metriek, RT-variabiliteit tonen als trendindicator, nooit snelheidsdruk als primair scoringsmechanisme.

---

## BLOK C — Implementatie-advies

### C.1 Astro-architectuur

**Standalone `.astro`-routes per oefening**, niet alles in componenten. Elke oefening = eigen route (`/oefeningen/corsi.astro`, `/oefeningen/stop-signal.astro`), met eigen state, timers, scoring. Dat maakt het voor Claude Code makkelijker om geïsoleerd te bouwen en debuggen, voorkomt timer-cross-contamination, en elke oefening is los aanpasbaar. Een gedeelde `ExerciseShell.astro`-layout verzorgt uitleg-blok, progress-indicator, einde-scherm.

**Hydration**: gebruik voor vanilla JS gewoon `<script>`-blokken direct in `.astro`; Astro bundelt en tree-shakes automatisch. `client:load/idle/visible` zijn voor framework-componenten — waarschijnlijk nooit nodig. Regel: begin altijd met `<script>`; hydration-directives alleen bij framework-import.

**Folder-structuur**:

```
src/
  pages/
    index.astro                 ← kind-dashboard
    ouder.astro                 ← ouder-dashboard + export
    oefeningen/
      corsi.astro
      simon-patroon.astro
      day-night.astro
      go-no-go.astro
      task-switch.astro
      tower-of-london.astro
      visual-search.astro
      n-back.astro
  layouts/
    ExerciseShell.astro         ← uitleg→voorbeeld→oefening→einde flow
    BaseLayout.astro
  components/
    Sparkline.astro
    LevelBadge.astro
    SoundToggle.astro
  scripts/
    storage.js                  ← localStorage-wrapper + migratie
    timer.js                    ← performance.now() RT
    scoring.js                  ← accuracy, mean RT, RT-IIV (SD)
    staircase.js                ← 2-down/1-up staircase, herbruikbaar
    audio.js                    ← TTS + mp3-helper
    a11y.js                     ← prefers-reduced-motion helper
    strings.nl.js               ← alle NL-UI-teksten centraal
  styles/
    tokens.css                  ← kleuren, type-scale, spacing
    global.css
public/
  fonts/                        ← Fraunces, Inter Tight (self-hosted)
  audio/                        ← instructie-mp3's
```

**Shared utilities** (vanilla JS, ~40 regels elk): `timer.js` met `performance.now()` voor sub-ms RT, `scoring.js` met `mean/sd/iivCV`, `staircase.js` met klassieke 2-down/1-up, `storage.js` met load/save/migrate. Herbruik in alle oefeningen.

### C.2 LocalStorage-schema

Eén sleutel (`alvah-ef-v1`), één JSON-object, expliciete `schemaVersion`:

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-04-22T10:00:00Z",
  "child": { "nickname": "Alvah", "ageAtStart": 7 },
  "preferences": {
    "sound": true,
    "reducedMotion": false,
    "audioInstructions": true,
    "textSize": "large",
    "sessionMinutes": 4,
    "letterSpacing": "normal"
  },
  "exercises": {
    "corsi": {
      "currentLevel": 3,
      "highestLevel": 4,
      "sessions": [
        {
          "id": "s_1713...",
          "date": "2026-04-22T16:12:00Z",
          "level": 3,
          "durationMs": 214000,
          "trials": [
            { "i": 1, "span": 3, "resp": "correct", "rt": 2100 },
            { "i": 2, "span": 3, "resp": "correct", "rt": 2450 }
          ],
          "summary": {
            "accuracy": 0.88,
            "meanRT": 2280,
            "sdRT": 340,
            "iivCV": 0.15,
            "trialsN": 12,
            "maxSpan": 4
          }
        }
      ]
    }
  },
  "weeklyMinutes": { "2026-W17": 18 }
}
```

**Migratie**: `migrate(data)` functie in `storage.js` die `schemaVersion` checkt en stapsgewijs omhoog migreert. **Auto-prune**: max 20 sessies per oefening (FIFO); volledige trial-array alleen laatste 10, oudere sessies alleen `summary`. Houdt localStorage ruim onder 5 MB.

**JSON-export** (ouder-dashboard, één knop):
```js
const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = `alvah-ef-${new Date().toISOString().slice(0,10)}.json`;
a.click(); URL.revokeObjectURL(url);
```

### C.3 Niet-verslavend ontwerp

**Theoretische basis**: Deci & Ryan (1985) Self-Determination Theory — intrinsieke motivatie = autonomie + competentie + verbondenheid. Ryan, Rigby & Przybylski (2006) toepasten dit op games (PENS-model): competentie vraagt *duidelijke, consistente feedback* en *haalbare uitdaging*, niet externe beloningen. Barkley (ADHD-literatuur): delay aversion — kinderen met ADHD verkiezen kleine-nu boven grote-later, dopaminerge respons op onvoorspelbare beloning is versterkt → vatbaarder voor variabele-ratio schema's (slot-machine-mechaniek, Zendle & Cairns 2018 over loot boxes).

**Wat te vermijden** bij 7-jarige met ADHD:
- Variabele beloning (random confetti, "je won X punten!") — zelfde verslavingsmechaniek als gok-apps.
- Streaks met verliesaversie ("Je streak van 12 dagen gaat verloren!") — extrinsieke druk, angst bij gemiste dag.
- Confetti bij elk goed antwoord — wordt irrelevant, conditioneert op externe prikkel.
- Leaderboards / levens / game-over — faalangst, bij trage processing speed (PKU) averechts.

**Wat wel**:
- **Mastery-feedback**: "9 van de 10 goed" + progress-bar naar volgend niveau. Feit, geen spektakel.
- **Autonomie**: kind kiest zelf uit 3 oefeningen; kiest zelf stopmoment binnen min/max.
- **Groei-sparkline**: kleine lijngrafiek laatste 14 sessies — toont dat het beter wordt, geen vergelijking met anderen.
- **Competentie-erkenning in taal**: "Dit niveau beheers je nu" (rustig), niet "LEVEL UP 🎉🎉".
- **Voorspelbaarheid > verrassing**: dezelfde flow, geluiden, eindtijd. Stabielere motivatie.
- Eén rustige eindanimatie per sessie (vinkje + bloeiende plant), toggle-baar.

### C.4 Toegankelijkheid

**Kleurenblind-safe palet** (Okabe-Ito-geïnspireerd, papier-compatibel):

| Rol | Hex | Kleur |
|---|---|---|
| Primair (correct) | `#2E7D57` | bosgroen |
| Secundair (CTA) | `#0B6E99` | dieppetrol blauw |
| Aandacht | `#D97706` | warm oranje |
| Neutraal | `#6B5E4E` | warm taupe |
| Achtergrond papier | `#F5EFE0` | crème |
| Tekst | `#2B2A28` | warm zwart |

Geen rood/groen als contrasterend paar — oranje + petrolblauw doet het werk. **Kleur altijd combineren met vorm** (✓ voor correct, ○ voor pauze, △ voor aandacht). Tekst op achtergrond ≥ 7:1 WCAG AAA.

**Dyslexie (Protocol Dyslexie 3.0 context)**. Het **Protocol Dyslexie Diagnostiek en Behandeling 3.0** (NKD 2021, van kracht 1-1-2022) is de NL-standaard voor vergoede dyslexiezorg. Kernwijzigingen t.o.v. 2.0: (1) classificatie "Ernstige Dyslexie" (ED) vervangt "Enkelvoudige Ernstige Dyslexie" — comorbiditeit sluit dyslexiebehandeling niet meer uit, dus Alvah kan zowel PKU/ADHD-zorg als dyslexiezorg krijgen; (2) strenger ernstcriterium (V-/E-score, laagste 10%); (3) cognitief typerend profiel is validerend, niet classificerend; (4) verplicht fonologisch-orthografisch onderzoek; (5) individueel behandelplan met belemmerende/beschermende factoren. **Implicatie voor de app**: dit is **aanvulling op** reguliere dyslexiebehandeling, geen vervanging. Focus op EF, niet leestraining.

Concrete app-maatregelen: body **minimum 18 px**, liever 20; regelhoogte 1,5–1,6; regelbreedte max 60 tekens. **Inter Tight** is prima (sans-serif, open vormen, hoge x-hoogte, voldoet aan British Dyslexia Association-criteria). **Fraunces** alleen voor headings, niet lopende tekst. **OpenDyslexic biedt geen meerwaarde** — Rello & Baeza-Yates (2013), Wery & Diliberto (2017), Kuster et al. (2018), Duranović et al. (2018) laten geen verbetering zien in leessnelheid, accuraatheid of oogfixaties; wat wel werkt is extra letterspacing (Marinus et al. 2016). Dus: **géén OpenDyslexic aanbieden, wel instelbare letterspacing** (normaal / +5% / +10%). Linker uitlijning, geen kapitalen voor lopende tekst. Elke uitleg krijgt een luidsprekericoon voor auditieve weergave (TTS via `speechSynthesis` of vooraf opgenomen mp3 van papa — laatste aanbevolen voor betere kwaliteit).

**prefers-reduced-motion**:
```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    transition-duration:.01ms!important;
  }
}
```
Plus JS-check `matchMedia('(prefers-reduced-motion: reduce)').matches` → schakel confetti uit.

**Geluid** globaal aan/uit, persistent in preferences. Elke auditieve feedback krijgt visueel alternatief (korte kleurflits rond knop + icoon). Geluid nooit de enige drager.

### C.5 UI-patronen voor 7-jarige ADHD

- **Sessieduur 3–5 min hard-cap**, timer als rustige voortgangsbalk (niet aftellend rood).
- **Voorspelbare flow** per oefening, altijd identiek: uitleg (2 zinnen + icoon + luister-knop) → voorbeeld (1–3 trials, geen scoring) → oefening → einde (samenvatting + "Goed bezig" + sluitknop).
- **Geen "fout"/"game over"**. Onjuist antwoord = neutrale toon, zachte visuele correctie, geen rood kruis.
- **Frustratie-management**: na 3 opeenvolgende fouten automatisch korte hint + moeilijkheid omlaag; "Pauze" altijd zichtbaar; "Te moeilijk?"-knop schakelt zonder commentaar naar lager niveau.
- **Hyperfocus-signalering na 10 min**: zachte onderbreking ("Je bent al 10 minuten bezig — stoppen of doorgaan?"). Bij PKU+ADHD is overbelasting contraproductief.
- **Eén taak tegelijk, groot, midden op scherm**. Geen zij-navigatie tijdens trial.
- **Start-knop groot en bewust** (niet auto-start) — geeft kind controle = autonomie.

### C.6 Dashboard (simpel, zoals gevraagd)

**Kind-versie** (`/`): grote "Start vandaag"-knop, 3 oefening-kaarten als keuze, mini-groeikaart "Deze week al 4× geoefend".

**Ouder-versie** (`/ouder`):
- 3–5 sparklines laatste 14 sessies per oefening (SVG `<polyline>`, ~120×30 px).
- Minuten deze week als groot getal + vergelijking vorige week (neutraal).
- Niveau-per-oefening: chip met huidig + hoogst bereikt niveau.
- JSON-export-knop bovenaan.
- JSON-import voor herstel/overzetten.
- "Wis alles" onderaan met dubbele bevestiging.

**Metrics per sessie** (opslaan en tonen): accuracy (primair), mean RT (correcte trials), **RT-IIV = SD(RT) of coefficient of variation**, highest level. RT-IIV is cruciaal: Kofler et al. (2013) meta van 319 studies toont dat het bij ADHD ubiquitair verhoogd is en een kernkenmerk is; bij PKU via processing-speed-variabiliteit even informatief. Niet als score voor kind — als trendindicator voor ouder/behandelaar.

### C.7 Klinische context samengevat

**PKU + EF**: Christ et al. 2010; Huijbregts 2002/2013 — WM, inhibitie van prepotente respons, processing speed, RT-variabiliteit zijn kwetsbaar; shifting equivocal. Dopamine-depletie prefrontaal + witte-stof pathofysiologie. Phe-fluctuatie → dag-tot-dag prestaties. **App**: accuracy boven snelheid, RT-IIV monitoren, WM centraal.

**ADHD + RT-IIV**: Kofler et al. 2013 — stabiel verhoogd, verminderd door stimulantia niet door psychosociaal/cognitief. Meten is trend-informatie, geen diagnose.

**Brain-training werkelijkheid**: Lumosity $2M FTC-schikking 2016; Cogmed near- maar niet far-transfer (Aksayli et al. 2019); BrainHQ sterker bij ouderen niet kinderen. **App claimt géén transfer naar schools functioneren of ADHD-symptomen** — framing als EF-oefening + voortgangsvisualisatie voor ouder/behandelaar.

### C.8 Claude Code prompt-principes voor niet-programmeur

- **Begin klein, één oefening tegelijk**: "Bouw `src/pages/oefeningen/corsi.astro` volledig af (uitleg→voorbeeld→12 trials→einde), met localStorage-opslag volgens `docs/schema.md`. Geen andere bestanden."
- **Deel context expliciet**: verwijs in elke prompt naar `docs/schema.md`, `docs/design-tokens.md`, `docs/a11y-rules.md`, `src/scripts/strings.nl.js`. Claude Code leest bestanden; zorg dat ze bestaan en kort zijn.
- **Vraag om uitleg vóór code**: "Leg eerst in 3 zinnen uit wat je gaat doen, wacht op bevestiging, bouw dan." Voorkomt grote foutieve changes.
- **Test-first voor logica**: "Schrijf eerst testen voor `scoring.js` (mean, sd, iivCV) en laat ze slagen voordat je UI bouwt."
- **Kleine diffs + git-commits per stap**: "Commit na elke werkende stap met beschrijvende boodschap."
- **Expliciete niet-doen-lijst**: "Geen nieuwe dependencies. Geen framework-componenten. Geen backend-calls. Geen confetti/streaks/leaderboards. Alleen localStorage. Fonts alleen Fraunces en Inter Tight."

---

## Top-5 aanbeveling — welke oefeningen eerst voor Alvah

Deze selectie balanceert: (1) de vijf EF-domeinen gelijkwaardig, (2) beste evidence-ROI, (3) dyslexie-veilig (non-verbaal), (4) PKU-profiel (WM + processing speed), (5) laagdrempelig voor niet-programmeur om te bouwen, (6) hoog engagement bij ADHD-profiel.

### #1 Corsi Block Tapping — werkgeheugen (visueel-spatieel)

**Motivering**: klassiek gevalideerd (Kessels et al. 2000), volledig non-verbaal (dyslexie-veilig), laag-arousal, accuracy-georiënteerd (PKU-vriendelijk), visueel direct, face-valid "onthouden waar iets was". Hoogste ROI voor Alvah: bouw dit **eerst**. Evidence **STERK** als meetinstrument, **MATIG** als training (near-transfer). Sessie 4 minuten. Trial-set van 12 (start span 2, 2-down/1-up).

### #2 Simon-patroon (audiovisueel) — werkgeheugen (sequentieel)

**Motivering**: perfect opstartspel — audiovisueel motiverend, laag ingang, turn-taking met papa mogelijk, intuïtief en direct lonend (kind snapt het in 30 sec). Bouwt zelfvertrouwen voor moeilijkere taken. Evidence **PRAKTIJK** (face-valid, geen RCT). Sessie 4 minuten. Cap sequentie op 9 om frustratie te vermijden.

### #3 Day-Night Stroop — inhibitie

**Motivering**: gouden-standaard kinder-inhibitie-taak (Gerstadt, Hong & Diamond 1994), volledig dyslexie-safe (icoon-gebaseerd: zon/maan), klassiek gevalideerd, laag-arousal. Dekt inhibitie-domein met sterkste evidence zonder enige letter- of leesbelasting. Evidence **STERK**. Sessie 4 minuten, 3 blokken van 16 trials.

### #4 Cued Task-Switching kleur/vorm — cognitieve flexibiliteit

**Motivering**: **beste evidence voor transfer** van alle EF-trainingen bij kinderen (Karbach & Kray 2009). Verbal self-instruction ("nu kleur!") past bij dyslexie-profiel (spraak, niet lezen) en versterkt effect. Dekt flexibiliteit én training-gevoeligheid. Evidence **STERK**. Sessie 5 minuten. Begin met pure blokken, dan AABB-alternating, dan cued random.

### #5 Visual Search (zoekplaatje) — aandacht

**Motivering**: dyslexie-veilig (geen tekst), hoge engagement bij 7-jarigen, schaalbare moeilijkheid (feature → conjunction, set-size 4→16), trainbaar (Shalev et al. 2007). Combineert selectieve aandacht met inhibitie van distractors. Leuk om te bouwen en leuk om te doen. Evidence **MATIG**. Sessie 3–4 minuten, 5 ronden oplopend.

**Niet in top-5 maar overwegen in fase 2** (weken 4–8): Go/No-Go (ADHD-profiel-relevant), Tower of London (planning, construct-sterk), digit span audio (PKU-WM-kern). In fase 3: Posner cueing, Flanker. Pas in fase 4 (na maanden): single n-back, Rush Hour.

---

## Kant-en-klare Claude Code implementatieprompts

Elke prompt is zelfstandig bruikbaar. Plak in VS Code Claude Code na het creëren van een leeg Astro-project (`npm create astro@latest`). Bouw eerst **prompt 0** (fundament), daarna oefening 1–5 in volgorde.

### Prompt 0 — Fundament (eerst uitvoeren)

```
Context: we bouwen een Astro-site met vanilla JS voor EF-oefeningen voor een 7-jarige jongen (Alvah). 
Geen frameworks behalve Astro, geen backend, geen tracking, alles localStorage. 
Fonts: Fraunces (headings) + Inter Tight (body), zelf-gehost in /public/fonts.
Palet: groen/papier, kleurenblind-safe.

Bouw de volgende fundament-bestanden in één keer, volledig, geen placeholders:

1. src/styles/tokens.css — CSS custom properties:
   --bg: #F5EFE0; --ink: #2B2A28; --primary: #2E7D57; --secondary: #0B6E99; 
   --warn: #D97706; --mute: #6B5E4E;
   --font-body: "Inter Tight", system-ui, sans-serif;
   --font-display: "Fraunces", Georgia, serif;
   --size-body: 20px; --size-small: 16px; --size-h1: 36px; --size-h2: 24px;
   --radius: 8px; --gap: 16px;
   Plus prefers-reduced-motion media query die alle animaties op 0.01ms zet.

2. src/styles/global.css — reset + body met var(--bg)/var(--ink)/var(--font-body), 
   h1/h2 met var(--font-display), line-height 1.5, max-width 60ch voor lopende tekst.

3. src/scripts/strings.nl.js — exporteer object NL met minstens:
   start, volgende, pauze, klaar, nogEenKeer, goedBezig, teMoeilijk, uitleg, 
   voorbeeld, probeerMaar, jeHebtXvanY, ditIsJeNiveau.

4. src/scripts/storage.js — load(), save(data), migrate(data), 
   saveSession(exerciseId, sessionObj), getPreferences(), setPreference(k,v).
   Sleutel: "alvah-ef-v1". Schema zoals in docs/schema.md (zie 7).
   Auto-prune: per oefening max 20 sessies, volledige trials alleen laatste 10.

5. src/scripts/timer.js — startTrial() returnt performance.now(), rt(start) returnt verschil.

6. src/scripts/scoring.js — mean(arr), sd(arr), iivCV(arr), summarize(trials).

7. docs/schema.md — volledig JSON-voorbeeld van localStorage-schema zoals in briefing.

8. src/layouts/BaseLayout.astro — importeer global.css + tokens.css, self-hosted fonts via @font-face.

9. src/layouts/ExerciseShell.astro — slot-based layout: header (titel + luidspreker-knop voor instructie), 
   main (slot), footer (pauze-knop, te-moeilijk-knop). Accepteert props: title, instructionAudio.

10. src/pages/index.astro — kind-dashboard: 3 oefening-tegels + "deze week X minuten".

11. src/pages/ouder.astro — ouder-dashboard: 5 sparklines (leeg initieel), totaal minuten, 
    JSON-export-knop, JSON-import-knop, wis-alles met dubbele bevestiging.

Leg eerst in 3 zinnen uit wat je gaat doen. Wacht op bevestiging. 
Bouw dan ALLE bestanden in één bericht met volledige inhoud. 
Geen frameworks. Geen extra dependencies.
```

### Prompt 1 — Corsi Block Tapping

```
Context: Astro-site met vanilla JS, fundament al gebouwd (tokens.css, global.css, strings.nl.js, 
storage.js, timer.js, scoring.js, ExerciseShell.astro, BaseLayout.astro).
Schema zie docs/schema.md. Oefening-id: "corsi".

Bouw src/pages/oefeningen/corsi.astro volledig af. Volg dit recept exact:

REGELS:
- 9 blokken op een canvas of in een CSS grid, onregelmatig gepositioneerd (absolute positioning 
  met vaste percentages binnen een 400x400 container).
- Blokken = gekleurde SVG-sterren, kleur uit var(--primary).
- Bij start sequentie: blokken lichten één voor één op (1 per seconde, 600ms "aan" + 400ms "uit"),
  met zachte ping-geluid (Web Audio API, sine 440Hz 100ms, gain 0.2). Geluid respecteert preferences.
- Daarna mag kind tikken in dezelfde volgorde (forward) of omgekeerde (backward, pas vanaf forward span=5).
- Start span=2. Staircase 2-down/1-up: 2 correct op rij = span+1, 2 fout op rij = eind blok.
- Bij fout: blok dat misging blijft 1s zichtbaar met gele gloed + tekst "🌟 bijna!" (NL.nogEenKeer).
- Geen rode kleur, geen "fout"-geluid.
- Sessie = minimaal 12 trials of 4 minuten (wat eerst komt). Pauze-knop in ExerciseShell respecteren.
- Na sessie: samenvatting-scherm (accuracy, max span bereikt, groei sinds vorige sessie).

STORAGE:
- Per trial: { i, span, correct, rt } waarbij rt = ms vanaf einde sequentie tot laatste tik.
- summary: { accuracy, maxSpan, trialsN, meanRT, sdRT, iivCV }.
- Roep saveSession("corsi", sessionObj) aan bij einde.

UI:
- Nederlandse strings uit NL-object in strings.nl.js.
- Instructie-tekst kort: "Kijk goed welke sterren oplichten. Tik ze daarna in dezelfde volgorde aan."
- Luidspreker-knop activeert speechSynthesis met nl-NL voice.
- Grote "Start"-knop, rustig groen, niet knipperend.
- Einde-scherm: sparkline van laatste 10 sessies + "Je had X van de Y goed" + "Je hoogste rij was N" + 
  grote groene knop "Klaar".

TOEGANKELIJKHEID:
- Blokken hebben naast kleur ook nummer-label (alleen zichtbaar bij "hoge leesbaarheid"-preference).
- prefers-reduced-motion: blokken wisselen instant van aan/uit zonder fade.
- Geluid toggle respecteren: zonder geluid wordt "ping" een korte visuele pulse op de rand.

Leg in 3 zinnen uit wat je gaat doen. Wacht op bevestiging. Bouw dan het volledige bestand.
Geen andere bestanden aanpassen behalve src/pages/oefeningen/corsi.astro en eventueel 
één helper in src/scripts/ als expliciet nodig. Commit met boodschap "corsi: eerste werkende versie".
```

### Prompt 2 — Simon-patroon

```
Context: zie prompt 0 en 1. Oefening-id: "simon".

Bouw src/pages/oefeningen/simon-patroon.astro volledig af.

REGELS:
- 4 grote gekleurde panelen in 2x2 grid, fullscreen op mobiel: 
  groen (var(--primary)), blauw (var(--secondary)), oranje (var(--warn)), taupe (var(--mute)).
- Elk paneel heeft eigen toon via Web Audio API: 
  groen 330Hz, blauw 392Hz, oranje 494Hz, taupe 587Hz. Sine, 500ms, gain 0.25.
- Computer speelt sequentie: paneel licht op (brightness up 150%) + toon, 600ms per item, 200ms gap.
- Kind herhaalt door te tikken/klikken. Elke correcte ronde: sequentie+1.
- Fout → "nog een keer?"-scherm (NL.nogEenKeer), sequentie herstart op span-1, GEEN game-over-scherm.
- "Rustige modus" preference: stimulus-duur 900ms.
- Cap sequentie-lengte op 9 (dan automatisch "goed bezig!"-einde).

STORAGE:
- Per trial: { i, span, correct, rt }. rt = ms van einde sequentie tot eerste tik.
- summary: { accuracy, maxSpan, trialsN, meanRT, sdRT, iivCV }.
- saveSession("simon", sessionObj).

UI + a11y:
- Elke kleur heeft bovendien een vorm-icoon in hoek (cirkel/vierkant/driehoek/ruit) voor kleurenblind.
- Instructie: "Kijk en luister goed. Tik daarna de kleuren in dezelfde volgorde."
- Luidspreker-knop voor auditieve uitleg.
- prefers-reduced-motion: geen brightness-animatie, alleen kleurwissel.
- Geluid uit: toon wordt vervangen door 200ms pulse-animatie (zelfs bij reduced-motion een korte border-highlight).

SESSIE: 3-4 rondes tot fout of cap, maximaal 4 min, dan samenvatting (maxSpan) + sparkline.

Leg in 3 zinnen uit. Wacht op bevestiging. Bouw dan het volledige bestand.
Alleen src/pages/oefeningen/simon-patroon.astro aanpassen. Commit: "simon-patroon: eerste werkende versie".
```

### Prompt 3 — Day-Night Stroop

```
Context: zie prompt 0. Oefening-id: "day-night".

Bouw src/pages/oefeningen/day-night.astro volledig af.

REGELS (Gerstadt, Hong & Diamond 1994):
- Toon beeldvullend één van twee kaarten: ☀️ zon of 🌙 maan-met-sterren (SVG, ~300px).
- Kind moet tegenovergestelde antwoorden: bij zon → "NACHT"-knop, bij maan → "DAG"-knop.
- Twee grote knoppen onderin: [DAG] (var(--warn) oranje) en [NACHT] (var(--secondary) blauw).
- 16 trials per blok, random volgorde, minstens 6 van elk type, random interleaving.
- Geen response-deadline. Na respons: 500ms feedback (groene gloed rond juiste knop + zacht piepje) 
  + 1000ms pauze met neutrale "..." animatie.
- Fout: stimulus blijft 1000ms zichtbaar met tekst "probeer het omgekeerde" (NL.nogEenKeer), geen straf.
- Sessie: 3 blokken van 16 trials (~75s per blok), met 2 mini-pauzes van 10s.
- Progressie (adaptief over sessies, niet binnen): start 50/50 congruent (zon→dag, maan→nacht).
  Na 3 sessies ≥85% correct: schakel naar "altijd incongruent" modus. Log modus in session.

STORAGE:
- Per trial: { i, stimulus: "sun"|"moon", response: "day"|"night"|"none", correct, rt, mode: "mixed"|"incongruent" }.
- summary: { accuracy, meanRT, sdRT, iivCV, trialsN }.
- saveSession("day-night", sessionObj).

UI + a11y:
- Instructie: "Als je de zon ziet, zeg NACHT. Als je de maan ziet, zeg DAG. Het is expres omgekeerd!"
- Luidspreker-knop voor auditieve uitleg (belangrijk voor dyslexie).
- Knop-labels DAG/NACHT met bijbehorend icoontje (zon/maan) kleiner ernaast.
- prefers-reduced-motion: geen gloed-animatie, alleen kleurwissel.
- Geluid aan: zacht piepje (Web Audio, 660Hz, 100ms) bij correct. Uit: alleen visuele gloed.

Leg in 3 zinnen uit. Wacht op bevestiging. Bouw dan volledig bestand. 
Alleen dit bestand aanpassen. Commit: "day-night: eerste werkende versie".
```

### Prompt 4 — Cued Task-Switching kleur/vorm

```
Context: zie prompt 0. Oefening-id: "task-switch". 
Op basis van Karbach & Kray (2009, Dev Sci 12:978) cued switching paradigma.

Bouw src/pages/oefeningen/task-switch.astro volledig af.

REGELS:
- Elk trial: een cue-symbool boven (🎨 = kleur-taak, 🔷 = vorm-taak) + een stimulus-plaatje eronder.
- Stimulus = één van 4 combinaties: rode-cirkel, rode-vierkant, blauwe-cirkel, blauwe-vierkant 
  (SVG, ~200px, kleuren var(--primary) of var(--secondary)).
- Cue blijft 1500ms vóór stimulus (lange cue-lead → makkelijk starten). 
  Later (adaptief over sessies) verkorten naar 500ms als kind ≥80% accuracy op 1500ms.
- Twee response-knoppen: bij kleur-taak [ROOD] en [BLAUW]; bij vorm-taak [RONDJE] en [VIERKANT].
  Knoppen wisselen expliciet van label bij cue-wissel. Ieder met icoon erbij (kleurvlak/vorm).
- 3 blokken per sessie:
  Blok 1 (warming-up): 12 trials pure-kleur-taak (cue = altijd 🎨).
  Blok 2: 12 trials pure-vorm-taak (cue = altijd 🔷).
  Blok 3 (switching): 24 trials met AABB-patroon (kleur-kleur-vorm-vorm-kleur-kleur-…), cue toont regel.
- Bij elk trial: moedig verbal self-instruction aan door boven de cue even te tonen 
  "Zeg hardop: nu KLEUR!" of "nu VORM!" — 800ms, dan verdwijnt dit en stimulus verschijnt.
- Geen response-deadline, feedback 500ms groene gloed bij correct.
- Fout = stimulus blijft 1500ms met tekst "lees de aanwijzing nog eens" + regel-herinnering, geen straf.

STORAGE:
- Per trial: { i, block, cue, stimulus, response, correct, rt, switchType: "pure"|"repeat"|"switch" }.
- summary: { accuracy, meanRT, sdRT, iivCV, switchCost: meanRT_switch - meanRT_repeat, 
  trialsN, pureAccuracy, mixedAccuracy }.
- saveSession("task-switch", sessionObj).

UI + a11y:
- Instructie-audio: "Boven staat een teken. Verfje betekent: kijk naar de kleur. 
  Ruitje betekent: kijk naar de vorm. Zeg het eerst hardop, dan drukken!"
- Knoppen altijd groot met icoon + tekst.
- prefers-reduced-motion: geen fade-in van stimulus.

Leg uit in 3 zinnen. Wacht op bevestiging. Bouw volledig. Commit: "task-switch: eerste werkende versie".
```

### Prompt 5 — Visual Search

```
Context: zie prompt 0. Oefening-id: "visual-search".

Bouw src/pages/oefeningen/visual-search.astro volledig af.

REGELS:
- Scherm toont een veld (600x400 of responsive fluid) met N items (kikkers-SVG of eenvoudige vormen).
- Target: "rode kikker" (var(--warn) gevuld). Distractors: groene kikkers (var(--primary)).
- Kind tikt de rode kikker aan. Één per trial.
- Start set-size = 4. Staircase op set-size: 2 correct op rij → set-size +2; 1 fout → set-size -2 (min 4).
- Max set-size = 16.
- 3 niveaus die sessie-over-sessie unlocken:
  Niveau 1 (eerste 3 sessies): feature search — alleen kleurverschil.
  Niveau 2 (na 3 sessies ≥80%): conjunction search — distractors ook deels rood maar andere vorm 
  (bv. rode vierkantjes als distractor naast groene kikkers; target = rode kikker).
  Niveau 3 (na 6 sessies ≥80%): distractors bewegen langzaam (translate animatie 3s).
- Geen tijdsdruk voor response. Wel: meet RT van stimulus-verschijn tot tik.
- Fout = tik op distractor: zachte "plop" + item wordt 500ms grijs, kind mag verder zoeken. Geen straf.
- Sessie: 8 trials oplopend, ~3-4 minuten.

STORAGE:
- Per trial: { i, setSize, level, correct, rt, falseAlarms: aantal distractor-tikken voor target gevonden }.
- summary: { accuracy, meanRT, sdRT, iivCV, maxSetSize, trialsN, meanFalseAlarms }.
- saveSession("visual-search", sessionObj).

UI + a11y:
- Instructie: "Zoek de rode kikker! Niet snel, maar goed. Tik hem aan zodra je hem ziet."
- Luidspreker-knop voor audio.
- Target onderscheidbaar zowel door kleur ALS (bij niveau 2+) door kleine gele rand (kleurenblind-veilig).
- prefers-reduced-motion: geen animatie op niveau 3, distractors stilstaand.

Leg uit in 3 zinnen. Wacht op bevestiging. Bouw volledig. 
Alleen dit bestand. Commit: "visual-search: eerste werkende versie".
```

---

## Slotwoord en verwachtingsmanagement

De vijf oefeningen hierboven dekken alle vijf EF-domeinen (werkgeheugen 2×, inhibitie 1×, flexibiliteit 1×, aandacht 1×; planning volgt in fase 2 met Tower of London). Ze zijn alle vijf in vanilla JS met AI-assistentie in enkele uren per oefening realiseerbaar op een bestaand fundament, alle vijf dyslexie-veilig, alle vijf met rustige non-confetti-feedback, alle vijf met adaptieve staircase en JSON-logbare trials.

**Wat je mag verwachten**: Alvah wordt beter in deze spellen. Hij krijgt een vader-zoon-ritueel, een gevoel van agency ("ik kies welk spel vandaag"), en concrete zichtbare groei in sparklines. Dat is waardevol op zich. **Wat je niet mag verwachten**: verbetering van leesvaardigheid, rekenen, ADHD-symptomen of schools functioneren — de meta-analyses (Melby-Lervåg 2016, Sala & Gobet 2020, Gobet & Sala 2023) sluiten dat vrij stevig uit. Reguliere dyslexiebehandeling onder PDDB 3.0 en reguliere ADHD-zorg blijven primair. De app is aanvulling, ritueel, oefenmoment — niet behandeling.

**Vervolgfase** (na ~6 weken met deze vijf werkend): voeg Go/No-Go, Tower of London en digit span audio toe. Daarna Posner cueing en Flanker. Pas na maanden en alleen als Alvah er plezier in blijft vinden: Rush Hour, single n-back, stop-signal-visueel. Plafond bij ~10 oefeningen; meer wordt verwarrend en verwatert het ritueel.