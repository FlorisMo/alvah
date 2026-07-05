# RUN-D-DIRECTION — the art-direction bible for Run D

> **Inherited verbatim from RUN-C-DIRECTION.md (authored by the Fable art
> director 2026-07-04, refined at the Run C P1 gate 2026-07-05) at the
> 2026-07-05 Run C→D reconciliation.** The Run C direction is good and stands;
> Run D changes the LEDGER (reconciled, playability-first — see
> RUN-D-LEDGER.md) and the ROLES (Opus builds, Fable verifies every box), not
> the art direction. The Alvah corrections (child ≈1.2 m; blonde wavy hair +
> blue eyes) are already in §2.4 and are LAW. Run D's D0.1 sitting may refine
> this doc further but may not weaken the frozen contracts or the Alvah
> corrections. §9 below is replaced by the Run D reconciliation record.
>
> This is the single source of truth every Run D sitting re-reads and converges
> to. It operationalizes the locked VISION
> (games/Ranger-Adventures/VISION.md) against the live canon
> (`app/src/content/veluwe.ts`, `app/src/core/companion.ts`, the 5 EF engines,
> `design/ontwerp-brief.md`, `app/src/core/readlevel.ts`) and grounds every
> realism claim in the in-repo research (`games/Ranger-Adventures/research/`).
> Nothing here is invented: each art-direction and per-animal target cites the
> dossier fact it relies on. Where the research says "geen bron gevonden", we
> fall back to the family default and say so — never a made-up detail.

---

## 0. The touchstone (one line)

**Een warme, natuurgetrouwe Veluwe in het gouden ochtenduur — echte,
herkenbare dieren in een echt-voelend bos; kalm, zorgzaam, één wereld.**

One world, one fidelity, one light. Realism comes from good models, textures,
light and framing — never from polygon count, effects, or spectacle (VISION
§6). If a choice ever pits "amazing" against "best for Alvah", Alvah wins
(VISION §2). The canon anchor already in the code: `AREA_VELUWE.tijdVanDag =
'ochtend'` with palette accent `#f5c23b` / land `#8b9249` (veluwe.ts:969-970)
— golden hour is not a new idea, it is the existing world's own key, deepened.

---

## 1. Guardrails — the frozen contracts (inviolable, VISION §11)

Excellence is pursued WITHIN these; no box may trade one away:

1. **Motion-comfort camera law** — fixed FOV, roll 0, no head-bob / motion-blur
   / snap-rotate / FOV-kick / screen-shake; reduced-motion turns camera moves
   into cuts; locomotion always allowed; orbit/zoom/reframe is player-initiated
   + damped.
2. **Never-scary / never game-over** — calm-pose gate for animals
   (`toonVeilig`), no blood/gore, predators calm, tense beats off-screen, one
   short non-graphic sentence; leaving reads as neutral navigation, no guilt
   copy.
3. **≥56 px tap targets · <150 draw calls · pixelRatio ≤ 2 · iPad-first.**
4. **Persistence only via `state.ts`/`persist.ts`** in the `alvah-ef-v1`
   `ranger` namespace — no new localStorage keys (one-time-hint flags
   included).
5. **Reading: AVI M3/E3, ≤7 words per visual line, one instruction per line,
   read-aloud on every new string** (`core/readlevel.ts` lints this into the
   build).
6. **Construct-parity + a 2D floor per mini-game** — the EF science stays
   intact (VISION §5 framings are canon; do not re-theme).
7. **Sound = real animal calls only (xeno-canto)**, calm / never-startle, no
   ambient/music pass yet, assets via `assetUrl`.
8. **No surnames. Never print `.env.local` values. Never commit `assets-gen/`.**
9. **THE ONE RUN-C RELAXATION (Floris, 2026-07-03): new dependencies ARE
   allowed.** The builder may research open-source repos (web search + fetch)
   and install a well-licensed (MIT/Apache/CC0/BSD), self-contained library
   where it clearly raises realism or cohesion — see §7 for this doc's ranked
   recommendations. Every dep still binds to the contracts above: <150 draw
   calls, pixelRatio ≤2, iPad-first, build + e2e:smoke green, **zero runtime
   network/telemetry/CDN calls** (client-side only, no third-party runtime
   scripts), and never trades away motion-comfort / never-scary. A dep that
   cannot meet those is not worth it.

---

## 2. The ART-DIRECTION BIBLE

### 2.1 Light — ONE shared golden-hour rig, everywhere

The realism research prescribes a single lighting recipe for the whole cast so
"the hele set als één wereld samenhangt" (3d-animal-animation-research.md §A7
+ §C2). That rig is the law for every screen, 3D and 2D alike:

- **Key:** warm `DirectionalLight`, low sun angle, colour **#FFCF8F→#FFB870**,
  long soft shadows (`PCFSoftShadowMap`, tight shadow frustum ±8 m around the
  subject — sharper than upping mapSize; 3d-animal §A6/§A7).
- **Fill:** `HemisphereLight` sky **#A8C4E8** (cool) / ground **#7A6347**
  (warm bounce) → "warme highlights, koele schaduwen" — the shared shading
  signature of the entire world (3d-animal §C2 table: roodbruin fur glows
  gold-red with cool chestnut cores; white patches — ree-spiegel, das-kop,
  eekhoorn-buik — get warm cream highlights and clear cool-blue shadow).
- **One shared environment/IBL** (warm morning) across title, world, board,
  all 5 games and their 2D floors, so no screen reads as a different game.
- **Eyes:** the warm key gives every creature (and the ranger) a warm
  **catchlight** — the single cheapest "alive" cue; a missing catchlight reads
  as a dead doll (humans-full-animals-eyes-research.md, B-OGEN).
- **Season tint layers** (felt progress, §4): the golden key stays; per
  hoofdstuk only the grade shifts — Kraamtijd fresh green, Zomer full gold,
  Bronst amber/rust, Herstel cool pale light with the warm key kept. Tint,
  never darkness (never-scary; mini-game-research F5: seasonal colour tint is
  the cheap "alive" trick).
- **Cloud shadows** must stay soft and feathered with ground detail readable
  inside them (→ RUN-D-LEDGER D3.9).

### 2.2 Terrain & the four biomes — believable Veluwe ground

Ground truth from veluwe-research.md (Deel 1): heide = paarse struikhei-vlakte
on sand; bos = grove den dominant with eik/berk (the staged tree cast matches:
`prop-pine-scots`, `prop-oak-tree`, `prop-birch-tree`); stuifzand = pale
actief driftzand, the Kootwijkerzand "atlantische woestijn"; ven = shallow
heideplas with reeds. Targets:

- **Heide:** purple-flowering heather mats (`prop-heather-shrub`) over warm
  sandy soil, bare sand paths, scattered juniper/boulders; roodborsttapuit
  perched on top of a shrub is the biome's signature bird pose
  (bird-visual-accuracy.md: zit "prominent en rechtop op de top van een
  struik... als een klein wachtertje van de heide").
- **Bos:** needle-litter + leaf-litter floor (not flat green), ferns, fallen
  logs, mushrooms, dappled light through the pine/oak canopy.
- **Stuifzand:** pale wind-drift sand with grass tufts ("pol gras" — the
  zoeken distractors of MISSIE_STUIFZAND), rippled surface, sparse dead snags.
- **Ven:** dark still water, moss-soft banks, reed clusters (`prop-reeds`);
  calm reflections of the golden sky.
- **Material recipe:** noise-based colour breakup on the terrain (see §7,
  `simplex-noise`) instead of flat fills; **soft blob/contact shadows under
  every animal and prop** — "een zachte slagschaduw 'grondt' het dier —
  cruciaal... om te voorkomen dat het lijkt te zweven" (3d-animal §A6).
  **The ranger binds to the same rule across the WHOLE walkable range**
  (D0.1 evidence, 2026-07-05): the fresh capture shows his hero-shadow-map
  shadow present at spawn (`06-walk-1`) but GONE at the rim (`33-boundary-rim`,
  ~70 m out — the skinned shadow pass degrades with distance from origin, the
  F-07 float-precision family, even though the frustum follows in code).
  Grounding may never depend on the skinned shadow pass at range: blob
  fallback or recentring (→ RUN-D-LEDGER D3.14).
- **Everything seated on `heightAt`** — Run B's P5.5 floating rim-prop is the
  cautionary tale; a floating prop breaks the whole naturalism argument.

### 2.3 Trees & props — one fidelity

The staged Meshy prop cast (75 GLBs in `app/public/models/`) IS the material
language. Mixed species and sizes (pine + oak + birch, seasonal variants
already staged: `prop-oak-autumn/-winter`, `prop-birch-autumn/-winter`,
`prop-heather-winter`, `prop-snow-mound`), consistent warm-natural palette; no
low-poly outlier may stand next to a realistic animal (VISION §6 cohesion
risk). Use `InstancedMesh` for repeated vegetation (1 draw call instead of
hundreds — 3d-animal §A8); keep total on-screen budget ~50k tris (§A1).

### 2.4 Animals — the realism recipe (sourced, never invented)

Global rules (all from the research):

- **Real proportions first.** The scale table is canon
  (animal-visual-accuracy.md "Schaal-referentie" +
  humans-full-animals-eyes-research.md §C1 — **CORRECTIE (Floris 2026-07-05):**
  speler Alvah is een KIND van 8 jaar ≈ **120 cm**; volwassen mensen (de mature
  boswachter/NPC) ≈ **180 cm**, dus Alvah leest een kop-en-schouder kleiner. De
  dier-standhoogtes zijn absoluut/echt en ONgewijzigd; de maat-verhoudingen
  hieronder zijn t.o.v. een VOLWASSENE (~1,7–1,8 m), naast Alvah (1,2 m) lezen
  dieren navenant groter): edelhert schoft ~95–130 cm ≈ ooghoogte van een volwassene; wildzwijn
  65–95 cm ≈ tot zijn middel; ree 60–75 cm en wolf 70–90 cm ≈ tot zijn heup;
  vos 35–40 cm ≈ tot de knie; das 25–30 cm ≈ tot de scheen; eekhoorn
  (kop-romp 19–25 cm) bij de voeten; adder ~55–60 cm op de grond. Small
  animals may scale up slightly for overworld readability (3d-animal §C1),
  but relative order never inverts.
- **Fur = textured mesh** (baseColor + normal + AO), roughness 0.7–0.9; no
  shell-fur/alpha-card stacks on iPad (overdraw is "de échte mobiele killer",
  3d-animal §A7). Wet nose + eyes low-roughness/clearcoat.
- **Eyes:** dark iris is the safe family default where the dossier found no
  source (bird-visual-accuracy.md, bron-gaten). Pupil shape per species
  (humans-full-animals-eyes B-OGEN, Banks et al. 2015): horizontal for
  edelhert/ree (prey, side-set), small round dark for wildzwijn, vertical
  slit + amber for vos, vertical slit + red iris for adder, round dark for
  das/eekhoorn/raaf. Overworld = flat eye texture with baked catchlight;
  refraction only in close-up plates.
- **Never-scary is a pose + framing rule, not a cuteness filter:** keiler
  tusks small/hidden, mouth closed; adder coiled calmly sunning ("schuw, hij
  glijdt vanzelf weg" — canon veiligheid line); wolf (staged, story-gated)
  with hangende staart, closed relaxed mouth, "géén sprookjeswolf" (3d-animal
  §B4); every animal's ALERT/KALM stances come from the per-species emotion
  tables (3d-animal Deel B), BANG stances are used sparingly and resolve
  calmly.
- **Motion:** correct gaits per family — edelhert "loper" (level back), ree
  "springer" (verende sprongen), zwijn gedrongen drafje with kop laag, das
  waggel, eekhoorn bounding with tegenfase-staart, vos lichte trot, adder
  lateral undulation (3d-animal §A5). Secondary motion (ears/tail lag) and
  idle breathing ~0.2–0.4 Hz make the calm world feel alive; ALL of it
  freezes under reduced-motion except locomotion (contract).

Per-animal signature targets for the Meshy prompts (each = the dossier's
"onmiskenbare kenmerken", the judge's checklist when accepting a model):

| Dier (asset id) | Must-read features (source: animal/bird-visual-accuracy.md) | Calm-pose note |
|---|---|---|
| Ranger Alvah (`ranger-alvah`) | KIND 8 jr ≈ **120 cm** (leest duidelijk kleiner dan een volwassene van ~180 cm); **blond, golvend haar + heldere blauwe ogen** — gelijkend op het echte kind in `public/img/Alvah.jpg` (NIET het donkerharige/groenogige huidige model); ~6 koppen, lage ooglijn, grote (niet té grote) ogen + warme catchlight; ranger-groen jasje + geel shirt + accentkleur; iets meer gestileerd dan de dieren (uncanny-valley regel, humans §A1) | open, nieuwsgierige default |
| Raaf (`animal-raaf-raven`) | geheel zwart met groen/blauw/paarse glans; zware licht gekromde snavel, bevederd tot over de helft; ruige keelveren; wigstaart; donkerbruine iris | folded wings, kop-tilt slim |
| Raaf-jong (`animal-raaf-fledgling`) | bruinig dof (nog geen glans), kleinere grijzige snavel, blauwgrijze iris, roze mondhoek (gape) | fluffy, groot-kopje, kwetsbaar-warm |
| Edelhert (`animal-edelhert-reddeer`) | schoft ~120 cm (man), zomer roodbruin, crème spiegel, vertakt gewei (warm/afgerond), horizontale pupil donkerbruin | statig grazen/kop-hoog; burlen = trots-zingend, nooit agressief |
| Wildzwijn (`animal-wildzwijn-boar`) | wig-silhouet: hoge gespierde schouder, kop laag; donkere borstelvacht; wroetschijf; kleine donkere ogen | wroetend of rustig staand; houwers klein/verborgen |
| Frisling (`animal-frisling-piglet`) | goudgeel-crème lengtestrepen ("zwijnenpyjama"), klein en rond, korte snuit, GEEN slagtanden | huddled/close-to-zeug; dit is missie-1's held — leesbaarheid is heilig (Run B F-24) |
| Ree (`animal-ree-roedeer`) | zomer helder roodbruin; witte spiegel (hart ♀ / nier ♂); grote oren (12–14 cm); zwarte neus + witte kin; geen zichtbare staart | alert-stil of knabbelend; "drukt zich"-kalf ligt doodstil |
| Das (`animal-das-badger`) | zilvergrijze rug, zwarte keel/borst; witte kopband met zwarte streep over oog naar oor; gedrongen, korte poten, graafnagels | snuffelend laag bij de grond, schemerlicht |
| Eekhoorn (`animal-eekhoorn-squirrel`) | pluimstaart bijna lichaamslang, oorpluimen, roodbruine rug + áltijd witte buik; grote donkere kraalogen + witte oogring | rechtop zittend met noot in de voorpootjes |
| Vos (`animal-vos-fox`) | witte staartpunt; zwarte oor-achterkant + zwarte "sokken"; amber ogen met verticale pupil; laagbenige pluimstaart-silhouet | zit met staart om de poten; mousing alleen speels, nooit met prooi |
| Adder (`animal-adder-snake`) | donkere zigzag over de rug, V/X-kopteken, rode iris met spleetpupil; gekielde matte schubben | opgerold zonnend; schuw wegglijden, nooit striking |
| Heikikker (`animal-heikikker-frog`) | spitse snuit, bruin met donkere vlekken + lichte rugstreep; ♂ paartijd kort blauw (lente-detail) | stil zittend aan de venrand, keel-pulsatie |
| Nachtzwaluw (`animal-nachtzwaluw-nightjar`) | gemarmerd schors-camouflagekleed; ligt in de LENGTE plat op grond/tak (niet dwars); korte snavel, brede muil | roerloos rustend — de camouflage IS de gameplay (zoeken) |
| Roodborsttapuit (`bird-roodborsttapuit`) | ♂ zwarte kop, witte halsvlek, oranje borst; klein rond rechtop | boven op een heidestruikje |
| Heideblauwtje (`animal-heideblauwtje-butterfly`) | ♂ felblauw, zwarte rand, witte franje; fladdert LAAG over de heide (~20 m/dag — traag, kalm) | slow low flutter, nooit zwermend |

### 2.5 Camera & framing (comfort law as art direction)

Perspective camera, gentle high-ish follow angle; third-person is the
motion-safe choice (mini-game-research F3). **The fixed lens is 55° and stays
55° this run (D0.1 correction, 2026-07-05):** the research ideal (~35–45°,
3d-animal §A6, "keeps depth while realistic models read") is pinned OUT of
reach by the frozen comfort specs — `app/e2e/vehicle.spec.ts:144` and
`app/e2e/heli.spec.ts:132` assert `fov ≈ 55`, and Run D may not touch
`app/e2e/**`. No box may chase the narrower lens; get the tele-read from
follow DISTANCE and framing instead (§2.6's rule: realism from light/texture/
framing, never by trading a contract). Task moments use a stable eased
push-in, never a swoop; reduced-motion turns every camera move into a cut
(contract). Kop/gewei tilt slightly so species markers read from the game
angle (§A6: "kantel kop/gewei licht zodat kenmerken van bovenaf leesbaar
blijven"). Framing rule from Run B's hard lessons: the follow camera must
always land OUTSIDE terrain/props, and hero subjects (board, mission target)
must be in-frustum at their beat — asserted via the dev-hook booleans
(`cam.avatarInView`, `cam.landmarkInView`).

### 2.6 Performance budget as an art constraint

<150 draw calls is the contract; the research aims lower (**<100**, 3d-animal
§A1) — headroom is a feature. ~50k tris on screen; per-animal LOD 1.5–4k
overworld / 5–15k mid / 20–50k only in close-up plates; textures KTX2
512–1024 (2048 only hero); GLB <4 MB through the existing `meshy-gen →
gltf-optimize → optimize-animated` pipeline. `InstancedMesh` for vegetation.
pixelRatio ≤2. If fidelity vs budget ever conflicts: budget wins, get realism
from light/texture/framing instead.

---

## 3. Screen-by-screen LOOK TARGETS (nothing reads as a different game)

Every screen shares: the §2.1 light rig + palette, Fraunces/Inter-warm UI
panels in the site's warm-paper language, ≥56 px targets, ≤7-word lines with
read-aloud, and one clear action. Panel/overlay style is ONE language: warm
cream panel (`--paper`-achtig, dyslexie-vriendelijk — mini-game-research E1:
never stark white), soft static scrim, green/gold accents. Floating world
labels (POI/mission markers) and HUD hint chips COUNT as UI and bind to the
same language: warm-paper styling, a legibility floor at gameplay distance
(hide or grow a label rather than render it unreadably small), a visible
anchor to the spot they mark, and ≥56 px whenever tappable — a tiny charcoal
chip floating mid-air is a style break (GATE-P0 refinement, 2026-07-04).

1. **Title.** A real golden-hour Veluwe vista (heide + bosrand at dawn light)
   with the grounded ranger avatar; subtitle lines per-sentence ≤7 words. The
   title IS the world seen calmly — same terrain materials, same light, no
   separate "menu art". Way in: one big "Speel"-style action.
2. **World (hub + 4 biomes).** The cabin clearing is the cosy heart
   (mini-game-research B5): warm cabin, prikbord, jeep nearby; each biome
   reads per §2.2; ambient life = few well-placed calm animals + soft calls,
   not simulation (F5). Every prop seated; blob shadows; soft feathered cloud
   drift. One visible ≥56 px way back on every sub-screen (Run B nav law).
3. **Case-board (prikbord).** Diegetic detective board: cork, paper notes,
   red string (staged `prop-case-board`); mission cards as warm paper cards
   with pictograms; season/arc progress visibly ON the board (§4). Board face
   presented to the approach path, `.mb-back` sticky and on-screen (Run B
   fix holds). The board is the story's heartbeat — it must look loved.
4. **zoeken (Speurkracht).** 3D: the animal "drukt zich" in real vegetation —
   camouflage read straight from the dossiers (nachtzwaluw = schors-patroon op
   zand; reekalf = stil in het gras; heikikker = doodstil tussen riet).
   Distractors are real biome props (struik/riet/pol gras + heideblauwtje +
   roodborsttapuit per canon skins). 2D floor: same palette, same species
   silhouettes, flat but same world.
5. **corsi (Geheugenkracht).** Footprint/route memory staged on real terrain:
   hoefprenten/pootafdrukken glowing softly on sand or forest floor between
   real clearings (ecoduct mission stages it ON the staged `prop-ecoduct`).
   2D floor: the same footprint markers on a top-down ground texture.
6. **simon (Echokracht).** Dusk-tinted golden hour (schemer without darkness),
   animals arranged in a calm clearing半circle; each call = its xeno-canto
   sound + a soft light cue on the animal (audio-visual parity). The canon
   line stays: "Doe ze na. Tik de dieren."
7. **dagnacht (Rustkracht).** Encounter vignettes composed like the dossier
   "plaat" shots (calm, warm, one animal, readable): reekalf in gras, adder
   op zandpad, hongerig zwijn. The wrong choice reads as a gentle recoverable
   consequence, framed calm (reactie-poses uit 3d-animal Deel B, nooit eng).
8. **wisselen (Wisselkracht).** The open plek and het hol are real staged
   places (badger-sett prop as "het hol", open sand/meadow as "open plek");
   the flip sign is a diegetic wooden `prop-signpost`. 2D floor mirrors both
   destinations with the same icons.
9. **Pause + settings + avatar panels.** One overlay language (§3 intro);
   Pauze chip always visible in-mission (≥56 px, Run B); "Stop de missie" is
   calm neutral navigation; the Instellingen panel gets the same sticky-exit
   law (→ RUN-D-LEDGER D3.10). The avatar creator inherits the same warm panel and
   golden backdrop.

---

## 4. The FELT-PROGRESS plan (VISION §4a gap #1 — the biggest experience lever)

**Mechanism (hard rule):** every reaction derives at render time from existing
mission-completion + `VERHAALBOOG_VELUWE` state (veluwe.ts:642) — clues
`spoor→camera→band`, hoofdstukken Kraamtijd→Zomer→Bronst→Herstel — via
`state.ts`. **No new persistence keys.** Reactions are calm, additive,
never-startling, and placed where the child actually walks (hub, main paths,
the mission's own biome spot).

Per mission, ONE concrete visible world change + ONE board change:

| Missie (id) | World reaction after completion | Board reaction |
|---|---|---|
| De verdwaalde frisling (`frisling`) | een kalme rotte met gestreepte frisling graast zichtbaar bij de heide-plek (pyjama-strepen = het herkenningsfeit) | clue **spoor** pinned: "Vreemde sporen" + veldnotitie |
| Het reekalf in het gras (`ree-niet-aanraken`) | geit + kalf samen op afstand in het gras (de payoff 'moeder-keert-terug' wordt zichtbaar) | reekalf-kaart krijgt "klaar"-stempel, veldnotitie |
| De wildcamera (`wildcamera`) | de wildcamera hangt zichtbaar aan zijn boom (staged prop), das passeert in de schemer bij de burcht | clue **camera**: "Op de foto" foto-note aan het touw |
| De kikker in het ven (`ven`) | heikikker zit aan de venrand, riet voller; zacht geblubber (xeno-canto) bij nadering | ven-kaart klaar + veldnotitie |
| De oversteek (`ecoduct`) | af en toe steekt een ree/edelhert kalm het ecoduct over | clue **band**: "Bandensporen" note |
| Het stille zand (`stuifzand`) | nachtzwaluw rust zichtbaar (voor wie goed kijkt) op het zand; roodborsttapuit op een pol | stuifzand-kaart klaar |
| De nachtronde (`nachtronde`) | de raaf-metgezel zit bij de cabin (companion-fase respecterend); kalme schemer-beat | nachtwacht-badge moment op het bord |
| De verstopte nootjes (`eekhoorn`) | een jong eik-zaailingetje verschijnt waar de eekhoorn een nootje "vergat" (het canon-feit wordt wereld: "Daar groeit een boom uit") | nootjes-kaart klaar |
| De vos en zijn buren (`vos`) | vos zichtbaar bij zijn hol in het gouden licht, staart om de poten | vos-kaart klaar |
| De winterronde (`herstel`) | **de ontknoping wordt wereld:** heide bloeit paars terug, het ven staat vol en helder — "De heide en het ven groeien terug." | ontknoping-strook compleet; hoopvolle slotnote |

**Season tint (chapter-level felt progress):** the world's colour grade tracks
the active hoofdstuk (§2.1) — the child SEES the year turn. Clue finds
advance it (data already drives `seizoenNa`). Winter = cool pale light + the
staged winter props (`prop-oak-winter`, `prop-snow-mound`…), still warm-keyed,
never bleak.

**Badges felt, not bookkept (ledger P3.3):** earning a breinkracht/knap-woord
badge gets a calm on-style moment (bloei-achtig, per ontwerp-brief §2 stap 4)
— informational reward, process praise, geen score (mini-game-research A6).

---

## 5. RANKED MESHY ASSET LIST (impact-per-credit, VISION §6/§6a)

**Budget basis:** ~7,600 credits authorized (VISION §6). The shotlist's own
calibration (asset-shotlist.json header: 76 items fit in ~9,000 cr with
~7,500 spare) puts a text-to-3D generate+refine at roughly **~20 cr per
attempt**; the estimates below assume 1–3 judged attempts per accepted model
(reject-and-regenerate is the §6a rule) plus margin for retexture passes.
Real numbers come from `scripts/meshy-balance.mjs` + the per-model spend log
— the log is ground truth, these are planning figures. Generate ONLY via
`meshy-gen.mjs --only=<id>`; never an unfiltered pass. STOP on the usage
guard/402; a drained balance pauses gracefully (NEEDS-FLORIS).

Rank (most-seen first — the player ranger and the raven are on screen nearly
always; the 5 flagships carry the missions):

| # | Asset id (exists in shotlist + staged GLB) | Why this rank | Est. cr | Never-scary note |
|---|---|---|---|---|
| 1 | `ranger-alvah` | on screen 100% of the time; proportion baseline for everything (§2.4) | 60–100 | friendly open face; child proportions ~6 koppen |
| 2 | `animal-raaf-raven` + `animal-raaf-fledgling` | de metgezel — emotioneel hart, alle fases baby→zelfstandig | 80–120 (2 modellen) | glans-zwart maar warm; kop-tilt, nooit "duister" |
| 3 | `animal-edelhert-reddeer` | grootste dier, 4 missies, seizoensfinale-icoon | 40–80 | gewei warm/afgerond; burlen = zingen |
| 4 | `animal-wildzwijn-boar` + `animal-frisling-piglet` | missie 1 (het eerste wat Alvah speelt); frisling is de Run B F-24 leesbaarheids-retry | 60–120 (2) | houwers verborgen; frisling maximaal "pyjama"-leesbaar |
| 5 | `animal-ree-roedeer` | missie 2 + dagnacht-encounters overal | 40–80 | zacht, grote oren; kalf drukt zich kalm |
| 6 | `animal-das-badger` | wildcamera/nachtronde + wisselen's "hol"-bewoner | 40–80 | vriendelijk masker, schemer-kalm |
| 7 | `animal-eekhoorn-squirrel` | eigen missie + hub-leven | 40–80 | van nature schattig — proporties uit dossier volstaan |
| 8 | `animal-vos-fox` | eigen missie (simon), golden-hour held | 30–60 | mond dicht, speels; nooit met prooi |
| 9 | `animal-nachtzwaluw-nightjar` | zoeken-ster van het stuifzand; camouflage = gameplay | 30–60 | roerloos rustend |
| 10 | `animal-adder-snake` | dagnacht-encounter in 3 missies (veiligheidsles) | 30–60 | opgerold, kalm; nooit striking |
| 11 | `animal-heikikker-frog` | ven-missie held | 20–40 | stil en teder; blauw alleen als lente-detail |
| 12 | `bird-roodborsttapuit` + `animal-heideblauwtje-butterfly` | de vaste zoeken-distractors — in bijna elk zoekveld zichtbaar | 40–80 (2) | klein, vrolijk, kalm |
| 13 | simon/roep-koor indien P4.4 landt: `bird-merel`, `bird-koolmees`, `bird-roodborst`, `bird-vink` | alleen als het roep-spel wordt ingeweven; anders overslaan | 60–120 (4) | perched, kalm |
| 14 | Wereld-cohesie props, ALLEEN bij een aangetoonde stijlbreuk (P2.9): kandidaten `prop-ranger-cabin`, `prop-case-board`, `prop-pine-scots`/`prop-oak-tree`/`prop-birch-tree`, `prop-heather-shrub`, `prop-reeds` | het prikbord en de cabin zijn de meest-geziene props; bomen dragen elke frame | 20–40 per prop | n.v.t. |

**Total plan ≈ 600–1,100 cr** — a fraction of the 7,600, deliberately: "spread
wisely" means a large reserve survives contact with rejects and retextures.
Explicitly NOT in the plan: the wolf (staged, story-gated, geen missie — geen
credit tot een box hem inweeft), the poacher/warden humans (weinig on-screen,
huidige modellen volstaan tot een gate anders oordeelt), the ~15 ambient
birds, vehicles, and the 3 stub areas (out of scope, VISION §4a).

**Acceptance gate per model (VISION §6a):** pipeline-optimized (<150 draw
calls) → never-scary/calm-pose check → screenshot judge "looks real AND
belongs" against §2.4's must-read features → reject-and-regenerate on any
miss → spend logged.

---

## 6. Sound (xeno-canto only — VISION §7)

The canon already names each animal's sound (veluwe.ts `geluid`: zwijn knort,
ree blaft kort, eekhoorn tjikt, das snuift, edelhert burlt, raaf roept
kroa-kroa, nachtzwaluw ratelt, heikikker blubbert zacht). Deepening = real CC
recordings via the existing `audio-fetch.mjs` pipeline, matched to the
dossier call descriptions (bird-visual-accuracy per-species roep/zang, e.g.
raaf "diep, ruw, rollend krruk... veel lager dan een kraai"). Rules: calm
levels, no sudden loud cues (never-startle), soft attack envelopes, assets
via `assetUrl`, no music/ambient pass this run. On-device audio verdicts are
Floris's (DEMO).

---

## 7. Open-source dependency recommendations (the Run C relaxation, used sparingly)

**Default position: the best dependency is none.** three.js built-ins cover
most of Phase 1 (InstancedMesh, LOD, PMREM env lighting, PCFSoftShadowMap,
vertex colours). Recommendations, in order of confidence:

1. **`simplex-noise` (MIT, zero-dep, ~2 kB)** — RECOMMENDED for §2.2 terrain
   colour/height breakup and calm procedural variation (heather patchiness,
   sand ripples). Pure math, no rendering cost beyond what we author, no
   network, trivially contract-safe.
2. **`three-mesh-bvh` (MIT)** — RECOMMENDED IF prop-seating / camera
   ground-probing raycasts get hot while seating hundreds of instanced props
   on `heightAt` (§2.2) or hardening the follow-camera's terrain checks
   (P1.0). Self-contained, widely used, no runtime network.
3. **Build-time only, optional (does not touch the runtime bundle):** the
   read-aloud research (voice-tts-readaloud-research.md) recommends a
   **Piper TTS (MIT) pre-bake** of static Dutch lines + forced-aligned word
   timings as the next quality step — audition `nl_NL-pim`/`ronnie`, avoid
   `nl_NL-mls`. This is out of Run C's ledger scope unless a gate opens a
   box for it; noted here so the builder does not re-research it. Any
   aligner's license must be verified MIT/Apache/BSD before install.
4. **NOT recommended (fails the contracts or the budget):** post-processing
   stacks (fill-rate on iPad, motion-comfort risk), shell-fur/strand hair
   ("guaranteed recipe for performance issues" — humans §A7), cascaded
   shadow maps (multiplies shadow passes against the draw-call budget),
   live in-browser neural TTS (open ONNX-iOS bugs — voice research §D), any
   CDN-loaded asset or telemetry-bearing package.

Every install: license checked (MIT/Apache/CC0/BSD), lockfile committed with
the step, build + e2e:smoke green, no runtime network calls.

---

## 8. The per-screen "EXCELLENT" bar (the terminator, VISION §9) + priority order

A screen/game is **done** when ALL hold — this ends "optimize until happy":

1. **On-story & on-style:** it uses the §2.1 rig + §3 target and would pass as
   a frame of the same film as its neighbours.
2. **One clear action, calm, legible:** ≤7-word lines, read-aloud on new
   strings, ≥56 px targets, a visible way back — verified in the fresh shot.
3. **Progress is felt where applicable:** the §4 reaction for that screen's
   missions renders from state.
4. **Both judges agree:** the builder's own fresh-capture grade AND the Fable
   gate re-judge (no self-certification).
5. **Contracts + mechanics green:** build + e2e:smoke pass; drawCalls <150 in
   the annotation; no contract regression.
6. **Feel/audio/device claims stay open:** anything needing feel, audio, real
   Safari or the real iPad caps at "implemented — awaiting Floris demo".
7. **The shot is the shipped screen (P1-gate lesson, 2026-07-05):** a capture
   frame counts as evidence only when it shows the surface the player actually
   reaches (the real mission path, the real overlays). A dev/sandbox route that
   stages a screen differently proves nothing about the game — `/?sandbox`
   ringed every mini-game with billboard sprites (incl. a story-gated wolf)
   that the mission path may never show. Point the harness at the player's
   path, or the judge must treat the frame as no-evidence. **Equally
   no-evidence (D0.1 lesson, 2026-07-05): a frame shot before the camera's
   easing has SETTLED** — the fresh zoom pair (`12-camera-zoom-in` /
   `13-camera-zoom-out`) is two identical pre-settle frames (shot 13's
   annotation holds `cam.dist` 1.67 against `zoom.dist` 9.5; the dolly never
   moved before the snap). The harness waits for settle and the pair must
   provably differ (`pixelHash`) — RUN-D-LEDGER D1.1. And a Playwright-green
   exit is NOT evidence of coverage: the 12:19 run exited "passed" while a
   whole scene GAPped — "green" means green WITH all groups complete (D1.0).

**No re-litigating:** once a screen passes a gate it is frozen unless a later
box forces it (VISION §10).

**Priority order (VISION §13 — phase order = ship order on an early stop):**
1. One naturalistic art direction across all screens (Phase 1).
2. Realistic animals, credits spread wisely — ranger + raven + flagships
   first (Phase 2, §5 ranking).
3. Make progress FELT (Phase 3, §4 plan).
4. Weave the orphan systems into the season arc — raven, jeep/heli,
   worldbeats, `roep` (Phase 4).
5. Scene/mission dressing + xeno-canto polish (Phase 5).

---

## 9. Run C → Run D — reconciliation record (2026-07-05)

Run C paused at ~9% on its 8h session cap. Every open Run C box was verified
against current code + a fresh laptop capture before it was carried into
RUN-D-LEDGER.md; nothing was trusted from checkbox state alone.

**Verified DONE and cut** (ticked by Run C and confirmed by the Fable P1 gate
on fresh pixels, or verified fixed at reconciliation): P1.0 (board framing +
proportion baseline), P1.1 (golden-hour rig across title/world/mission), P1.4
(title = the real world, grounded ranger), P1.5 (board + pause one warm
overlay language), P1.14 (the mission near-black vignette is gone — fixed by
P1.1's rig extension). The five 2D game floors are on-style and frozen.

**Verified STILL OPEN and carried** (fresh-pixel/code evidence per box in
RUN-D-LEDGER.md): the ven-with-no-water + flat heide (→D3.2), the purple
crystal "heather" props (→D3.3), the billboard-sprite game-3D scenes incl. a
story-gated wolf sprite (→D3.4–D3.7), the frisling-as-egg + gras-as-blobs
(→D3.8), the cloud-shadow murk (→D3.9), the Instellingen off-fold exit + its
GAPped capture scene (→D3.10), the unreadable floating label chips (→D3.11),
the prop-drop hub (→D3.12), the zoom-in-on-a-void framing (→D3.13), the
sandbox-not-player-path capture hole + orphan PNGs + the capture's own 30-min
budget overrun (→D1.0, harness-only, lands before the Phase-1 drive-bursts),
and all of Run C's untouched Phases 2–5 (→Run D Phases 4–7).

**New at the top (Floris's real-device demo, 2026-07-05 — bugs no screenshot
gate can see):** Run D Phase 1 = P1.5a (sinks through the floor), P1.5b (jeep
sticks-and-slides), P1.5c (helicopter cannot be enabled/entered); Phase 2 =
P1.6a (Alvah is a child of ≈1.2 m, not a 1.7 m adult), P1.6b (blonde + blue,
per `public/img/Alvah.jpg`). These are verified by the harness DRIVING the
action and asserting dev-hook state, plus a Floris on-device demo each.

**D0.1 validation (2026-07-05, Fable art director, against the fresh 12:19
capture):** the reconciled ledger held — every open Phase-1/2/3 box
re-confirmed in fresh pixels (crystal props on the title itself; billboard
rings + a story-gated WOLF sprite in ALL FIVE game-3D frames; simon's
"animals" as labeled cylinders; wisselen's disc + dome; the dry ven bowl;
tiny dark label chips; `avatar.height` 1.70 + dark hair in every frame), and
the five reconciliation cuts (P1.0 · P1.1 · P1.4 · P1.5 · P1.14 + the 2D
floors) re-verified on-style — they stay cut. Three gaps the reconciliation
missed, now in the ledger: (1) **the P1.5a sink is visible ON LAPTOP** —
fresh `45-ven-shore` shows the ranger sunk to his NECK in the ven-bowl slope,
so P1.5a's walk burst now includes the ven shore (the bug is not
device-only); (2) the ranger loses his grounding shadow at range → new D3.14;
(3) the capture exited "passed" with a GAPped scene and a pre-settle zoom
pair → new D1.1. Doc refinements this sitting: §2.5 records the frozen 55°
lens pin, §2.2 the grounding-at-range rule, §8.7 the settle + green-with-GAP
lessons. Phase order confirmed: playability → Alvah's truth → cohesion →
realism → felt progress. No frozen contract and no §2.4 Alvah correction was
touched.

---

## 10. Sources this direction stands on

- Canon: `app/src/content/veluwe.ts` (ANIMALS, 10 missies, VERHAALBOOG_VELUWE,
  AREA_VELUWE palette/ochtend), `app/src/core/companion.ts` (raaf-fases,
  zorg-loop), `app/src/core/readlevel.ts` (M3/E3 lint),
  `design/ontwerp-brief.md` (stijl-tokens, toon), `app/scripts/asset-shotlist.json`
  (asset ids + prompts), VISION.md (locked decisions).
- Research (games/Ranger-Adventures/research/): `animal-visual-accuracy.md` +
  `bird-visual-accuracy.md` (per-species maten/kenmerken/kleuren — de
  realism-checklists in §2.4), `veluwe-research.md` (biomen, seizoenen,
  ranger-werk, kindveilige toon), `3d-animal-animation-research.md`
  (licht-rig §A7/C2, budgetten §A1/A8, gangen §A5, per-dier poses Deel B),
  `humans-full-animals-eyes-research.md` (ranger-proporties §A6/B1, ogen
  B-OGEN, schaal C1), `voice-tts-readaloud-research.md` (read-aloud pad),
  `mini-game-research.md` (kind failure, diegetic UI, motivatie, dyslexie-UI).
