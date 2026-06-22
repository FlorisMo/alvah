# Handoff — "Ranger van de Veluwe" (MVP built → next thread)

> **STATUS UPDATE (June 2026).** The two priority tasks below (§2 travel mini-game, §3 content
> registry) are **DONE and wired** — the prose in §2/§3 is kept for context but is no longer "next".
> Since then, **Missie 2 — "Het reekalf in het gras" — is built and fully playable**:
> - Activated in `content-veluwe.jsx` (was a `'binnenkort'` seed) with rich, research-true skins:
>   `zoeken` (find the kalf that "drukt zich" + heath-fauna distractors) → `dagnacht` (the
>   **"niet aanraken / hou afstand"** inhibition, one rule-flip). A 2-step mission — proves missions
>   can vary in length.
> - **Inverted payoff:** you do NOT carry the kalf home. You leave it; the **mother (new `Ree`
>   sprite in `sprites.jsx`) returns**. `screen-reunion.jsx` branches on `isRee` ("De moeder kwam
>   terug.") + `reunion.css` `.ree` rules. Badge: **Reekalf-wachter**.
> - `step-danger.jsx` now reads `skin.metgezel` ('frisling' | 'reekalf' | 'geen') so the ranger
>   patrols alone in the ree mission (the kalf stays put).
> - **Per-mission completion** replaced the single `missieKlaar` boolean: `state.voltooid` map
>   ({missieId:true}); the map post shows real `doneN/missieN` ("1/2") and per-row done state;
>   `screen-complete` "Jouw reis" shows the next playable mission.
>
> **TRUE NEXT STEPS:** (1) ✅ DONE — the two remaining EF engines `simon` (werkgeheugen,
> sound-echo) & `wisselen` (flexibiliteit, dag/nacht-sorteren) are built and wired; the 5-engine
> library is complete. They ship in **Missie 3 — "De nachtronde"** (`simon` → `wisselen`, dusk skin,
> badge **Nachtwacht**, calm-dawn `reunion`). New files: `step-simon.jsx`, `step-wissel.jsx`,
> `world-night.css`; new sprites `Hert`/`Raaf`/`Nachtzwaluw`/`Das` + `DierSprite` resolver in
> `sprites.jsx`; animal calls (`Sound.call`/`callDur`) in `sound.jsx`; difficulty knobs
> `simonLengte` + `wisselFreq` in `state.jsx`/`tweaks.jsx`. (2) build difficulty/skill-tracking +
> visible badges (§6.1 + §7.4) — **the next thread**; (3) more Veluwe missions from the research
> seeds (wildcamera/Snapshot, ecoduct, eekhoorn-memory); (4) start a second area
> (`content-<area>.jsx`) once its deep-research doc lands. Polish backlog in §4 still stands.
>
> **3D-DIERENSPOOR (parallel, June 2026).** Een aparte richting is uitgewerkt: de dieren upgraden
> van CSS-vormen naar **echte realtime-3D** (Three.js/WebGL/glTF), in stappen richting realistisch.
> Twee docs in deze map: **`3d-animal-animation-research.md`** (geverifieerde visuele/animatie/
> technische specs per dier + pipeline) en **`3d-animals-build-plan.md`** (de brug naar de bouw:
> rolverdeling Claude Design ↔ Claude Code, fasering, hooks in deze architectuur). Lees die twee
> vóór 3D-werk. Kernpunt: 3D is een **render-laag-upgrade**, niet een herontwerp — schermflow,
> EF-engines, content-registry en reduced-motion/leesniveau blijven onveranderd. `sprites.jsx`
> wordt de `css`-backend van een nieuwe `<Dier>`-abstractie met stabiele props.
>
> **⛔ 3D-MODELLERING BEVROREN (jun 2026) — lees `3d-animals-build-plan.md §15` vóór elk 3D-werk.**
> Beslissing: procedureel 3D (`humanoid.js`-figuur, ogen, vacht, haar) is een **stand-in + doel-spec**,
> géén eind-geometrie. Code importeert de échte geriggede mens-/dier-assets. **Niet verder polijsten**
> in-browser; bouw nieuwe dingen (bv. voertuigen) met lichte stand-in-vormen en steek Design-budget in
> **feel · EF-engines · UX/HUD · content-registry · copy/toon · verhaal/gevolg-regels** — dáár blinkt
> Design in uit. §15 heeft de volledige lijst van wat naar Code schuift en wat al beslist is.

---

## 0. Where we are (original, Missie 1)

A complete, polished, clickable MVP of **Missie 1 — "De verdwaalde frisling"** is built and
working end-to-end in `Ranger van de Veluwe/Ranger van de Veluwe.html`. Seven screens:

`map → transport → travel(cutscene) → briefing → world(step1 spot / step2 route / step3 danger) → reunion → complete`

It already has: the warm Veluwe design-token system, a motion system, soft WebAudio sound + a
read-aloud (karaoke line-highlight) for the dyslexia-friendly briefing, charming CSS sprites
(frisling/boar/ranger/critters), reduced-motion paths, and a **Tweaks panel** (reading size,
dyslexie-font, difficulty per step, motion, sound, accent, + test-jump buttons to any screen).

Read `plan.md` (gameplan) and `design-spec.md` (the craft bible) first — they define the
intended feel, the EF→ranger mapping, and the motion/feedback rules. This MVP follows them.

---

## 1. Architecture & conventions — DO NOT BREAK THESE

**Stack:** React 18.3.1 UMD + Babel standalone, multiple `<script type="text/babel">` files.
Fixed **1080×720** canvas (`#canvas`) letterboxed into `#stage` by a tiny scale script in the HTML.

**File map (all in `Ranger van de Veluwe/`):**
- `styles.css` — design tokens (colors, motion, radii), shell chrome, buttons, art-slot, `.rm` reduced-motion.
- `map.css / transport.css / travel.css / briefing.css / world.css / reunion.css / tweaks.css` — per-screen.
- `sound.jsx` — `Sound` (tones: hover/select/step/correct/tryagain/found/wait/reward/bloom) + `Speech` (`useReadAloud`, `useLineReader`).
- `sprites.jsx` — `Frisling`, `Boar`, `Ranger`, `Critter`(in step-danger), `ArtPlate`, `Shadow`. CSS-shape sprites only.
- `state.jsx` — `GameProvider`, `useGame()`, `Chrome` (back/title/read-aloud/sound), `DEFAULT_STATE`, `SCREENS`.
- `screen-map.jsx` (REGIONS array = area pins), `screen-transport.jsx` (`Vehicle`), `screen-travel.jsx`,
  `screen-briefing.jsx` (BRIEF_LINES), `step-spot.jsx`, `step-route.jsx`, `step-danger.jsx`,
  `screen-world.jsx` (STEP_META + routes steps), `screen-reunion.jsx`, `screen-complete.jsx`.
- `tweaks-panel.jsx` (starter shell — host protocol) + `tweaks.jsx` (`RangerTweaks`, wires controls to game settings).
- `app.jsx` — `Router`, `App`, `Root` (mounts to `#canvas`).

**Hard rules learned the hard way:**
1. **Never gate visible content behind an `opacity:0` entrance animation.** When the preview tab
   is backgrounded, animations don't advance and the element stays invisible. Base state must be
   visible; animate transforms or fade *from* a visible state. (`.screen-enter` is intentionally a
   no-op; the badge/stamp animations were rewritten to animate transform only.)
2. **Babel multi-file scope:** every shared component is exported via `Object.assign(window, {...})`
   at the end of its file. New files must do the same and be added to the HTML script list in
   dependency order (helpers → screens → `app.jsx` last).
3. **No `const styles = {}`** global collisions — name style objects uniquely or use inline styles.
4. **State** lives in `useGame()`; persisted to `localStorage['ranger-mvp-state']`. Settings drive
   CSS vars on `#canvas` (`--read-size`, `--read-font`, `--spel-sun`, reduced-motion `.rm`).
5. **Sprites = simple CSS shapes only.** No hand-drawn detailed SVG. Key illustrated "plates" use
   `<ArtPlate label>` placeholders with real motion around them (briefing portrait, reunion).
   *(Geldt voor de huidige MVP. Het 3D-dierenspoor — zie kop + `3d-animals-build-plan.md` — vervangt
   deze sprites door een `<Dier>`-abstractie waarvan deze CSS-shapes de `css`-backend worden;
   schermen/props blijven gelijk.)*
6. Tone: feedback without exclamation pile-up; success *sings*, failure is *quiet*; never a game-over.

---

## 2. PRIORITY TASK A — Make the travel intro a real mini-game

Today `screen-travel.jsx` is a **passive** parallax cutscene (auto-advances, skippable). Upgrade it
to a short, joyful, **controllable** mini-game — "sfeer + agency", explicitly NOT an executive-function
test (per brief §2.1), so it must **never punish**: no game-over, no failure state, no EF logging.

**Core loop (endless-ish over a fixed short distance with a clear finish line):**
- Player **controls the chosen vehicle** down a side-scrolling Veluwe road/sky:
  - **Auto / Motor** → ground lane: tap/hold to hop or shift up a lane; release to come down.
  - **Helikopter** → free vertical flight: hold to rise, release to descend (Flappy-ish but gentle).
- **Collect coins** along the way — make them thematic: **eikels (acorns)** or **ranger-sterren**.
  They feed a little counter, shown as a cheerful tally at the finish ("Je verzamelde 8 eikels!").
  Coins are pure reward/sparkle — optionally a cosmetic, never gating progress.
- **Avoid obstacles** — but keep them soft and on-theme: a fallen branch, a rock, a puddle, or a
  **dier dat oversteekt** (rabbit/deer crossing the road — which quietly seeds the real Veluwe
  "watch for wildlife / ecoduct" theme without preaching). Hitting one = a gentle bonk, vehicle
  wobbles, you simply miss nearby coins — **no life lost, no restart.** Maybe a soft "Oeps".
- A **finish** (the ranger-post / heath edge) ends the run and hands off to the briefing, with a
  brief, warm tally. Keep total run ~12–20s. Always keep the **"Overslaan ›"** skip.

**Accessibility & motion:**
- One-button control (tap/hold) — large hit area, works on touch + keyboard (Space/↑).
- **Reduced-motion:** offer an auto-pilot variant — the vehicle drifts and auto-collects, or just
  fall back to the current static arrival frame + a "Ga verder" button. Never require fast reflexes.
- Add **Tweaks** for it: game speed, obstacle density, "auto-help" (magnet to coins) so Floris can
  match it to Alvah. Hook into the existing `useGame().settings` + `RangerTweaks`.

**Build notes:** keep it in `screen-travel.jsx` (+ `travel.css`); reuse the existing `Vehicle`
component and the parallax layers already there. Persist nothing into the EF schema. Consider a
tiny `useGameLoop` (requestAnimationFrame) helper; pause it on reduced-motion. Coins/obstacles as a
data-driven array so difficulty Tweaks just change spawn rates.

---

## 3. PRIORITY TASK B — Deep research integration + scalable area structure

`veluwe-research.md` (in this folder) is the verified biology/ecology base. Two jobs: **(3a)** use it
to make Missie 1 true, and **(3b–3d)** build a content structure so future areas — each fed by its
own deep-research doc — slot in as *data*, not new code.

### 3a. Refine Missie 1 with the verified facts
The research confirms our working terms are correct ("zeker"): **frisling** (jong wild zwijn),
**rotte** (de familiegroep), **zeug** (moeder), **keiler** (volwassen mannetje), **overloper**
(eenjarig). Mother in the reunion = **zeug**; keep her gentle (research tone-rule: don't dramatize
the aggressive sow / slagtanden). Concrete upgrades:
- **Step 1 (spot)** distractors → real Veluwe fauna: a **heideblauwtje/gentiaanblauwtje** (butterfly),
  a **roodborsttapuit** or **nachtzwaluw** (bird), other brown shapes. Tie the camouflage idea to the
  real fact that young animals "drukken zich" (lie dead-still in cover).
- **Step 3 (danger/inhibition)** hazards → research-true and framed as **kind safety lessons**:
  **adder** ("schuw — niet aanraken, hij glijdt weg", not "deadly"), **modderpoel/ven**, a
  **weg/wildaanrijding** moment. Reframe the Stroop rule-flips around the two flagship ranger rules:
  **"niet voeren"** and **"reekalf niet aanraken"** (research calls these ideal learn-moments).
- Add a **"knap woord"** vocabulary layer (research Deel 6): default to simple words (**big, groep**),
  and offer the vakterm (**frisling, rotte**) as an optional bonus badge with picture + sound. Make it
  a Tweak / setting, because playtests may show the jargon is too hard.
- **Fact cards** ("wist-je-dat", research Deel 5) as a light optional reward layer between steps —
  e.g. "Biggetjes dragen een gestreepte pyjama als camouflage." Short, one idea, with image + sound.

### 3b. Content data model (Area → Mission → Step) — the spine for everything
Move hardcoded content (REGIONS in `screen-map.jsx`, BRIEF_LINES, step configs) into a **content
registry** so the engine renders from data. Proposed shape (`content/<area>.js`, exported to window):

```
Area = {
  id, naam, status,                 // 'veluwe', 'Veluwe', 'actief' | 'binnenkort'
  mapPin: { x, y },                 // position on the gebied-overzicht
  palette, tijdVanDag,              // art direction per area (golden hour, etc.)
  landschappen: ['bos','heide','stuifzand','ven'],
  vlaggenschipDieren: [animalIds],  // research Fase 1 flagships
  missies: [Mission],
}
Mission = {
  id, titel, landschap,             // which landscape skin
  briefing: [shortLines],           // M3/E3 copy, one instruction per line
  beloning: { badgeId, badgeNaam },
  stappen: [Step],
}
Step = {
  ef: 'zoeken'|'corsi'|'simon'|'dagnacht'|'wisselen',  // which brainpower (engine mechanic)
  skin: {                           // research-true presentation over that mechanic
    dier, term, simpelWoord,        // 'frisling' / 'big'
    copy: { instructie, goed, opnieuw },
    plate, geluid, distractors,
  },
  moeilijkheid: { ... },            // hooks the staircase/Tweaks drive
}
Animal = {                          // a verified entry distilled from the research
  id, naam, simpelWoord, vaktermen:{groep,jong,man,vrouw},
  geluid, feiten:[wistjedat], veiligheid:[lessen],
  toonVeilig:true|false,            // research Deel 6 safety flag
}
```

The five EF mechanics are the **reusable engines** (all five now built: `zoeken`=step-spot,
`corsi`=step-route, `dagnacht`=step-danger, `simon`=step-simon (sound-echo), `wisselen`=step-wissel
(dag/nacht-sorteren)). Every mission is just a *sequence of these engines wearing a
research-true skin*. That is the whole scalability thesis from the brief — never a sixth loose game.

### 3c. Pipeline for adding a NEW area (fed by deep research)
Make adding an area a **content + asset** job, zero engine changes:
1. **Deep research** produces `<area>-research.md` (same depth as `veluwe-research.md`).
2. Distill it into `content/<area>.js` using the schema above — verified terms, kid-safe facts,
   tone flags, mission sequences mapped onto the 5 EF engines and the area's landscapes.
3. Add the area to the **area registry** the `map` screen reads (replace the local REGIONS array
   with a registry import). New pin appears automatically; locked→`'binnenkort'` until ready.
4. Provide a **tile-map data array** for the area's world (already designed data-driven) + any art
   plates. Palette/time-of-day come from the Area record so each area has its own light.
5. The map ([A]) is the expansion anchor: areas are pins; missions are inzoom scenes per area.

Research → mission seeds already in the doc (use these for area "Veluwe" missions 2+):
- **Ree — "niet aanraken"** (reekalf drukt zich): `zoeken` + `dagnacht` (inhibition). Strong missie 2.
- **Wildcamera / Snapshot**: `simon`/`wisselen` — handelingsvolgorde + soort herkennen/sorteren.
- **Ecoduct controleren**: `corsi` — onthoud welke dieren in welke volgorde overstaken.
- **Eekhoorn nootjes verstoppen/terugvinden**: `corsi`/`simon` memory.
- **Das-burcht**, **broedstoof vliegend hert**, **ven herstellen**: landscape missions (heide/stuifzand/ven/bos).
- Recovery stories as Fase-3 flavor: raaf (1976), zeearend (2006), wolf (2018/19), venherstel Kootwijkerveen.

### 3d. Tone & vocabulary safety (bake into the content layer — research Deel 6)
- **Positive/caring only.** Avoid as central: jacht/afschot, predatie, wildaanrijding-leed,
  uitsterven, gevechten, kannibalisme, "enge wolf", "giftig=dodelijk". Soft/zijdelings at most.
- Each `Animal.toonVeilig` flag + a soft-variant copy path so a theme can be dialed down if a
  playtest shows fear/sadness.
- **Vocabulary:** AVI M3/E3 — short sentences, one idea per line, repeat kernwoorden; vakterms only
  as optional "knap-woord" badges with picture+sound. Default to simple words.
- **Never hardcode population numbers** as game facts (they vary by year/source — see research
  Caveats). Use "honderden herten" at most.

---

## 4. Polish backlog (nice-to-haves, not blockers)
- Map screen ([A]) terrain is a little "lava-lamp"; could read more like a drawn map (paths, labels).
- Briefing left "scared frisling in grass" panel is slightly clipped at small heights — fine now, watch it.
- Real illustrated plates (briefing portrait, reunion) are tasteful placeholders awaiting art.
- Speech read-aloud uses browser TTS (nl-NL if available) with a timed fallback — fine for MVP.
- Screen transitions are hard cuts (the safe choice after the throttle bug); could add a JS-driven
  mount-class fade that's robust to throttling if you want soft transitions.

## 5. Open questions for Floris (carry over from plan.md §10)
1. Map style: stylized fantasy nature-map vs. literal NL outline?
2. "Knap woord" jargon (frisling/rotte) default-on or default-off for Alvah?
3. Travel mini-game: how reflex-y is OK, or keep it very gentle/auto-assisted?
4. Which missie 2 first — the ree "niet aanraken" lesson looks strongest.
5. Badge art direction + naming convention across areas.

---

---

## 6. v2 BUILD — engines, difficulty/skill tracking, consequences, story (from `mini-game-research.md`)

> Added 21 June 2026. Design rationale for all of this lives in `plan.md §12`. This section is the
> **build/implementation** layer. v2 is a real-time 3D world (see `3d-animals-build-plan.md`)
> but the data spine, EF engines, difficulty tracking and consequence model below are render-agnostic —
> they work in the current 2D MVP and carry forward into 3D unchanged. Build them now.
>
> **Rolverdeling (Design ↔ Code) — lees dit.** De canonieke tabel staat in `3d-animals-build-plan.md
> §1` (§1a/§1b/§1c). Kort: **Claude Design** bouwt en valideert deze systemen eerst als **klikbaar
> HTML-prototype in dit project** (datamodel, engines, UI, badges, gevoel); **Claude Code** hardt ze
> daarna in de **Astro-repo** (echte `alvah-ef-v1`-schema/migratie, routes, performance, asset-
> pijplijn). Vuistregel: *spelregels/data/UI/gevoel = Design-nu; productie-schema/repo/performance/
> 3D-asset-pijplijn = Code-later.* Waar het per onderdeel afwijkt, staat het erbij.

### 6.1 Difficulty & skill tracking — the engine that makes it harder over time AND with skill
Floris's explicit requirement: **difficulty must scale both over time and with demonstrated skill.**
Implement one small, telemetry-free system that does both, drives the staircase invisibly, and
persists. Everything stays in `localStorage['ranger-mvp-state']` (or the real `alvah-ef-v1`); nothing
leaves the browser.

**Per-engine skill record** (one per EF mechanic — `zoeken|corsi|simon|dagnacht|wisselen`):
```
skill[engine] = {
  level: number,        // current mastery, e.g. 1.0 → grows; the START point for new missions
  best: number,         // highest level reached (never shown as a "drop")
  reversals: [...],     // recent up/down steps, for the staircase
  recent: [bool...],    // last N successes (rolling window, ~last 8 trials)
  trials: number,       // lifetime trials on this engine (drives "over time" growth)
}
```

**Two scaling forces, combined:**
1. **Over time (experience):** each completed beat increments `trials`; the *floor* difficulty a new
   mission starts at rises slowly with lifetime `trials` on that engine — so a returning, practised
   player never restarts from baby-level. (Soft curve, e.g. `floor = f(log(trials))`, capped.)
2. **With skill (live staircase):** within/across missions run a **reversal staircase** toward
   ~70–80% success — lengthen sequence / add distractors / shorten exposure / raise tempo after a
   success; ease after a miss. `level` is the live difficulty; `reversals` smooth it.

**Difficulty knobs each engine exposes** (so the staircase has something to turn — data-driven, in the
Step.`moeilijkheid` block):
- `zoeken`: distractor count, camouflage strength, target visible-time, # targets.
- `corsi`: sequence length, path complexity, distractor tiles, replay-on-fail on/off.
- `simon`: sequence length, modality mix (sound+sight), inter-stimulus speed.
- `dagnacht`: rule-flip frequency, response window, congruency ratio.
- `wisselen`: switch frequency, # of rules in play, cue salience.

**Invisible-DDA rules (match `plan.md §12.4`):**
- **Scale down silently; scale up may be visible & opt-in** ("Klaar voor een lastiger spoor?").
- Track a **frustration signal** (consecutive misses / rapid quits) and *auto-ease* + surface the
  child-controlled **"Maak makkelijker / Hint"** button (preserves autonomy).
- Reuse existing `staircase.js` (reversals) + `scoring.js` (`{accuracy, meanRT, sdRT, iivCV, trialsN}`)
  + `progressie.js` (80%+ & trialsN≥24 to rise, no mid-session demotion). The skill record above is
  the persistence/“over time” layer those plug into.
- **Never** render a score, rank, timer-by-default, or peer comparison. Skill visibility to the child
  is an open question (plan §12.11 Q4) — keep it behind a flag, default off.

### 6.2 Mini-game engine catalogue as DATA (extend the content registry)
The 19 research seeds (`mini-game-research.md` Theme D; summarised `plan.md §12.3`) are **not** 19 new
code paths — each is one of the 5 engines wearing a skin. Extend the `Step`/`Mission` schema from §3b:
- Build the **two missing engines** first: `simon` (werkgeheugen — echo an audio-visual sequence,
  e.g. answer the animal / re-key radio tones) and `wisselen` (flexibiliteit — alternate two ranger
  tasks as a signpost flips the rule / swap tools). Same component contract as the existing three
  steps (`step-spot`/`step-route`/`step-danger`): read `skin`, drive `moeilijkheid`, log a session.
- Encode each of the 19 as a **Step skin record** (engine + interaction copy + plate/sound +
  distractors + season + `herhaalbaar` flag + optional `verhaalHaak`). Ship a **launch ~10** spanning
  all 5 engines and 4 seasons; mark the rest `'binnenkort'`.
- **Reskin axis discipline (plan §12.2):** the same engine must re-skin by varying ONE axis at a time.
  Put the axis set in `moeilijkheid` so the staircase and a "freshness" picker can both read it.
- Tag the snare-removal (#17, **non-graphic** — animal *stuck*, not bloodied), track-reading (#1) and
  camera-trap (#3) skins with `verhaalHaak` so they can be slotted into the antagonist arc (§6.4).

### 6.3 Consequence / damage system (real stakes, mature, never shaming)
Implements `plan.md §12.5`. The brief's "never punishing" means **never shame the child or harm an
animal by his error** — it does NOT forbid real, fixable stakes on *equipment/resources/time*. Build
the consequence on that line.

**Vehicle durability model:**
```
vehicle = { id:'auto'|'motor'|'heli', durability: 0..100, cosmeticDamage: 0..1, disabled: bool }
```
- Tree/rock/hard collision → real `durability` loss (tune so careless driving genuinely wrecks a
  vehicle; attentive driving doesn't). Raises `cosmeticDamage` (visible mud/dents/scratches that
  **persist until repaired** — an honest, readable consequence, not an abstract life counter).
- `durability == 0` → `disabled = true`. **No cute "oeps", no teleport-to-cabin.** Dry ranger-radio
  line: *"Voertuig beschadigd. Te voet verder of terug voor reparatie?"*

**Consequence = loss of convenience + opportunity cost (the mature part):**
- Disabled vehicle → continue **on foot** (slower; heli-only spots temporarily unreachable) **or**
  repair, which **spends resources** (`onderdelen` / `ranger-budget`) you'd rather spend on gear/
  upgrades. So a crash has a real *opportunity cost* — sim/management feel, not childish.
- **Resource economy** (new state, persisted): `resources = { onderdelen, budget, ... }`; careful
  driving banks resources → afford upgrades → ties the consequence system into the skill/progression
  loop (§6.1). Scope of the economy is an open question (plan §12.11 Q1) — start minimal (repair cost
  only), make it expandable.
- **Checkpoints, never wipe:** on disable, respawn the *vehicle* calmly on the nearest path a few
  metres back; keep mission progress; **never relocate the child to the cabin as a penalty.**

**Hard prohibitions (enforce in code/review):** no game-over that diminishes the child; no "je faalde";
no animal visibly hurt by the player's mistake; no failing score. A found **empty** snare is fine.

**Assist/difficulty setting:** expose consequence severity as a Tweak — `stevig` (default) →
`mild`/`assist` (soft-bonk only, free repair). Wire into `useGame().settings` + `RangerTweaks`.
This is the dial Floris uses to tune stakes to Alvah; default **stevig maar eerlijk**.

### 6.4 Story / antagonist state machine (chapters + case-board)
Implements `plan.md §12.8`. Keep it data-driven so a future area drops in its own arc.
```
story = {
  chapter: number,
  clues: { [clueId]: 'hidden'|'found' },   // dropped by missions tagged verhaalHaak
  antagonist: { kind:'stroper'|'kapper', spotted:int, caughtOnCamera:bool, reported:bool, reformed:bool },
  restored: { [habitatId]: bool },         // the hopeful finale state
}
```
- Each mission optionally **drops one clue** toward the season's case (Wild-Kratts recurring-antagonist
  / unfolding-mystery pattern). The **cabin case-board** (diegetic, §6.5) renders `clues` as photos +
  string. Arc beats: nuisance → mystery → gather evidence → outsmart → **catch-on-camera** → **report
  to BOA** → **restore** (the emotional payoff: heath regrows / animal released).
- **Emotional-safety gate (must enforce):** every tense beat resolves hopefully within the same
  session; threats resolved off-screen; no hurt animals / weapons-in-use / jump-scares / sad endings.
  Keep a `softVariant` copy path per beat so a playtest can dial fear/sadness down (mirrors
  `Animal.toonVeilig`).
- **Reading load:** carry beats with voice + picture + animation + icon; **one short sentence of text
  per beat**, fully understandable with text unread (§6.6 / plan §12.10).

### 6.5 3D integration hooks (where the engines/UI meet the 3D world)
Full 3D pipeline is in `3d-animal-animation-research.md` + `3d-animals-build-plan.md`. The v2-design
hooks Claude Code must honour:
- **In-place mini-games:** a mini-game is triggered by walking to an interactable and pressing the
  **one consistent interact prompt**; the camera does an eased push-in, the engine runs *in situ*, then
  eases back to free-roam. No separate puzzle screen / route change. (The current screen-based steps
  become in-world "moments".)
- **Diegetic vs HUD split:** mission-select = cabin **computer**; briefing = letter/signpost;
  progress = **case-board**; destination = sky light-beam or mentor-to-follow. HUD keeps ONLY: corner
  map+single pin, interact prompt, soft vehicle-status. Build these as components, not text overlays.
- **Camera rig:** gentle third-person default (slightly top-down for driving), no head-bob/motion-blur,
  eased turns, moderate FOV; ship a real **3D reduced-motion mode** (steadier camera, slower/longer
  transitions, stable horizon) gated on OS `prefers-reduced-motion` + the in-game toggle.
- **Wayfinding:** place real landmarks (fire-tower doubles as a vantage), keep the world small/dense,
  add in-world breadcrumbs + a "wijs me de weg" helper; never let "lost" become a fail-state.

### 6.6 Text/accessibility corrections to apply in code
From research Theme E — supersedes earlier "consider a dyslexia font" notes:
- **Use a clean sans-serif (Arial/Verdana/Open Sans) — NOT OpenDyslexic/Dyslexie** (no proven benefit).
  Update the `--read-font` Tweak: the alternate should be another good sans, not a "dyslexia font".
- **Background cream/pastel, never stark white**; dark-on-light; avoid red/green pairs.
- **Audio+icon+animation primary, text backup**; every instruction & story beat playable with text
  unread; one short sentence per beat; read-aloud + short synced karaoke highlight (mind redundancy).
- **Hit targets ≥44–48px**, well-spaced; one-button controls; honour reduced-motion everywhere.
- **Jargon as optional "knap-woord" badges** (picture+sound first), never required reading.

### 6.7 Updated open questions for Floris (carry from plan.md §12.11)
1. Consequence severity default + scope of the resource economy (repair-only vs fuel/upgrades)?
2. Which 10 mini-games launch first, in what mission order?
3. How often may the bumbling poacher appear before it feels heavy?
4. Show the child per-engine skill (badges/stars) or keep it fully invisible? (gate behind a flag)
5. 3D camera: fixed-ish follow vs free third-person — test with Alvah for nausea.
6. Where/how to repair & upgrade in the hub (a workbench in the cabin)?

---

### The bar (unchanged)
If, watching Alvah play, Floris forgets it's executive-function training and just sees his son being
a ranger on a golden Veluwe morning — calm, capable, proud of a notch on a wooden post — it worked.

---

## 7. v2 BUILD — companion, story arc, new engine variants, badges, scalability (from Floris Q's, 21 Jun)

> Design rationale: `plan.md §13`. Implementation layer here. Still render-agnostic, telemetry-free,
> all in `localStorage`. Build on the §6 data spine.

### 7.1 New EF engine variants to build (thicken Simon & Wisselen; add audio)
Add these as **Step skins** on the existing/new engines — no new code paths beyond the 2 missing engines:
- **`simon` — sound-echo (priority):** an animal calls a sequence (real samples: burlen/blaf/knor/
  kroa/nachtzwaluw-ratel) and the child echoes it back. Audio working memory + animal learning. Drives
  the same `moeilijkheid` knobs as `simon` in §6.1 (sequence length, modality mix, speed).
- **`zoeken` — sound-ID:** "which animal made this?" — auditory variant of search.
- **`wisselen` — day/night sort:** das/zwijn/nachtzwaluw = night-active; sort "day→clearing, night→den"
  with periodic rule-flips (also exercises `dagnacht`). Research-true (Deel 4).
- **`wisselen` — monitoring bench:** alternate *count* ↔ *photograph* at the wildcamera as a sign flips.
- **`simon` — antler-compare / `zoeken` — spoor-detective:** small memory/deduction skins (facts §13.5).
Wire each into `content-veluwe.jsx` as data; tag `verhaalHaak` where relevant (spoor-detective → arc).

### 7.2 Companion / care system (`companion.jsx` + state)
Implements `plan.md §13.3`. Species-agnostic; default `raaf`. Persisted.
```
companion = {
  soort: 'raaf'|'hond'|'vos',
  fase: 'baby'|'jong'|'zelfstandig',     // growth stages
  bond: 0..100,                          // grows with correct care, NOT with over-handling
  care: { warmte, voer, rust, check },   // today's care-routine flags
  kunstjes: [ 'scout'|'snuffel'|... ],   // helper abilities unlocked per fase
  meeOpMissie: bool,                     // walks/flies with you in the world
}
rehab = { active:bool, dier, fase, releasedCount }   // recurring care-and-RELEASE loop (separate animals)
```
- **Care loop = EF in disguise:** the daily routine is a `simon`-style ordered sequence (warmte→voer→
  rust→check); over-feeding/over-handling is an `dagnacht` inhibition fail that *lowers* bond (teaches
  "don't over-handle"); changing needs per `fase` is `wisselen`. Reuse the engines — don't fork.
- **Discrimination lesson:** reuse the `dagnacht` engine for "this animal truly needs help vs the
  reekalf you must leave" — a judgement skin, ties Missie 2 to the rescue.
- **Helper ability** = a *hint* hook: `companion.kunstjes` can reveal a clue / highlight a search
  target — route it through the existing autonomy "hint/easier" path (§6.1) so EF stays with the child.
- **Two layers:** persistent `companion` (one friend, bonds, accompanies) + recurring `rehab` (other
  animals you care for then **release** — emotional-positive, never sad). Keep both non-graphic.

### 7.3 Story arc state (extend §6.4 `story`)
Implements the 4-chapter season arc (`plan.md §13.4`). Extend the `story` object:
```
story.season = { chapter:1..4, seizoen:'lente'|'zomer'|'herfst'|'winter' }
// chapters gate which missions/clues are available; case-board renders story.clues per chapter
```
- Each chapter = standalone missions **+ one clue** toward the season mystery. Chapter advance is a
  data-driven gate (mission completion → unlock next), so the arc is content, not hardcoded flow.
- Arc beats reuse §6.4: nuisance→mystery→evidence→outsmart→catch-on-camera→report-to-BOA→restore.
- Tie the world's **seizoen** to palette/time-of-day per area (already in the Area record, §3b) so
  chapters visibly change the world (spring green → autumn rut → winter restoration).

### 7.4 Badge / skill-visibility system — BUILD IT VISIBLE (decision: yes badges)
Supersedes §6.1's "gate behind a flag, default off". Floris decided **yes**. Frame as personal growth,
never ranking/score/comparison.
- **5 brainpower badges**, one per engine, leveling with `skill[engine].level` (brons→zilver→goud).
  Render in the cabin / "Jouw reis". Show growth, never a drop (use `skill.best` for display).
- **Mission badges** (existing `mijlpalen.js`), **knap-woord badges** (optional jargon, picture+sound),
  **companion milestones** (`companion.fase`). All four collectible, all informational (album/patches/
  case-board), per the overjustification guard (§6.1 / plan §12.4). No numeric score, no leaderboard.

### 7.5 Scalability extension points (decision: everything addable as data)
"Always be able to add games and stuff." Make each of these a **content/data** job, zero engine changes:
- **New mini-game / variation:** add a `Step` skin record (engine + skin + `moeilijkheid` axes) to
  `content-<area>.js`. The 5 engines are fixed; everything else is a skin.
- **New animal / fact:** add an `Animal` record (terms, sounds, kid-safe facts, `toonVeilig`).
- **New mission:** a `Mission` = ordered `Step`s + briefing + badge; drop into the area's `missies`.
- **New companion species:** add a `soort` config (sprite/sound/`kunstjes`) — system is species-agnostic.
- **New badge:** add a badge record; types are open-ended.
- **New area:** new `content-<area>.js` (fed by its deep-research doc) + tile-map + palette; appears as
  a map pin (§3c). Same engines, new skins/season-arc.
Keep all content registries exported to `window` and loaded in dependency order (§1 rule 2).

### 7.6 Build order suggestion (multi-session, per Floris)
1. The two missing engines (`simon`, `wisselen`) + **sound-echo** (biggest cool/EF win) — §7.1.
2. Difficulty/skill tracking + **visible badges** — §6.1 + §7.4.
3. Companion rescue→care→friend (one species, `raaf`) — §7.2.
4. Consequence/damage system — §6.3.
5. Season-arc scaffolding + case-board + 2–3 more missions from the seeds — §7.3 + §6.2.
6. 3D integration pass — §6.5 + `3d-animals-build-plan.md`.

---

## 8. v2 BUILD — avatar customization & identity (from Floris, 21 Jun)

> Design rationale: `plan.md §14`. Promotes the existing tech hooks in `3d-animals-build-plan.md
> §12e` (swappable iris material) and `§13f` (character-creator) into a built feature. Don't fork a
> new system — reuse those hooks. **Design-now:** the creator UI, the `avatar` state, name-injection,
> cabin personalization, all option lists as data. **Code-later:** the production 3D modular-mesh
> swaps / Ready-Player-Me path (`§13f`), persisted under `alvah-ef-v1`.

### 8.1 Avatar state (persisted)
```
avatar = {
  naam: 'Alvah',                        // default; used in copy + TTS everywhere
  geslacht: 'jongen'|'meisje'|'neutraal',
  huidtint, haarkleur, haarstijl,       // pick from data-driven option lists
  kleding: { jasKleur, hoed:bool, laarzen, uitrusting },
  preset: 'alvah'|'eigen',              // 'alvah' = the §13d likeness default
}
```
- **Default = the Alvah likeness preset** (`3d-animals-build-plan.md §13d`); the creator sits on top.
- Drives the 3D player model via **modular mesh + swappable material** hooks (hair mesh+colour, iris
  material §12e, outfit colour, skin tone) — same discipline as `character.js`/`stage.js`. In the
  current 2D MVP, drive the `Ranger` sprite's colours from these fields as a stand-in.

### 8.2 Character-creator screen + in-hub re-edit
- One-time creator at first launch (diegetic, by the cabin); re-editable later via a **mirror/wardrobe**
  in the hub. Big tap targets (≥44–48px), picture+voice, never required reading.
- **Name entry, dyslexia-aware:** preset name list (read-aloud) first; free-type optional with TTS.
- All option lists (`haarstijl`, `huidtint`, `jasKleur`, …) are **data arrays** so options are addable
  later (scalability, §7.5). Ranger-only clothing — no off-theme garments.

### 8.3 Name & avatar threaded through the game
- Inject `avatar.naam` into briefings/read-aloud (`BRIEF_LINES`, `Speech`): "Hoi {naam}!" instead of
  only "Hoi ranger!"; also on badges and the case-board.
- Render the chosen avatar as the controlled world figure, in reunion plates, and on badges/photos.

### 8.4 Cabin personalization + unified "ranger-logboek"
- Persist cabin state (photo wall/album, companion's perch/bed, earned gear/patches, case-board) so
  the hub visibly grows and feels owned (`plan.md §14.4`).
- Consolidate album + badges + knap-woord + case-board into **one diegetic "ranger-logboek"** in the
  hub — single understandable place for all collectibles/progress.
