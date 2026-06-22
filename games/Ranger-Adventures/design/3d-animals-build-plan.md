# 3D-dieren — Bouwplan & Integratie

> **Wat dit is:** de brug van het onderzoek (`3d-animal-animation-research.md`) naar concrete
> bouwstappen voor de volgende threads. Het zegt *wie wat doet* (Claude Design ↔ Claude Code ↔
> Deep Research), *wat nu al kan* en *wat in de Astro-repo moet*.
>
> **Leesvolgorde voor een nieuwe thread:** `HANDOFF.md` → dit document → `3d-animal-animation-research.md`
> (de specs) → `veluwe-research.md` (ecologie/terminologie/kindveiligheid, al geverifieerd).
>
> **Twee kennisbanken, niet door elkaar halen:**
> - `veluwe-research.md` = **biologie, gedrag, NL-vaktermen, kindveiligheids-toon** (wát een dier is/doet).
> - `3d-animal-animation-research.md` = **visueel + animatie + techniek** (hoe een dier eruitziet & beweegt in 3D).

---

## 0. Wat dit verandert t.o.v. de huidige MVP

De huidige MVP (`Ranger van de Veluwe.html`) rendert dieren als **CSS-vormen** (`sprites.jsx`:
`Frisling`, `Boar`, `Ranger`, `Reekalf`, `Ree`). Dat blijft een geldige stap-0/placeholder.

De nieuwe richting is **echte realtime-3D** (Three.js / WebGL2 / glTF), richting fotorealistisch,
**in stappen** opgebouwd. Belangrijk: dit is een **render-laag-upgrade**, geen herontwerp van de game.
De bewezen architectuur blijft staan:

- De **schermflow** (kaart → vervoer → reis → briefing → wereld → hereniging) verandert niet.
- De **EF-engines** (`zoeken`/`corsi`/`dagnacht` + nog te bouwen `simon`/`wisselen`) veranderen niet.
- Het **content-registry-idee** (Area → Mission → Step → Animal, zie `HANDOFF.md §3b`) blijft de spine.
- **Reduced-motion, leesniveau, toon** blijven harde requirements — 3D mag die nooit breken.

Wat wél verandert: het `Animal`-record en de sprite-componenten krijgen een **3D-presentatielaag**
met dezelfde prop-API, zodat schermen onveranderd blijven (zie §5).

---

## 1. Rolverdeling — wie doet wat

| Rol | Verantwoordelijk voor | Werkt in |
|---|---|---|
| **Claude Design** (dit project) | Look, art-direction, klikbare 3D-proof-of-concept in HTML, per-dier visuele specs, het "voelt het goed?"-oordeel | losse HTML/Three.js prototypes in dit project |
| **Claude Code** (later) | Productie-integratie in de echte Astro-repo, asset-pijplijn, rigging/retargeting, performance op echte toestellen, koppeling aan scoring/storage | `FlorisMo/Alvah` (Astro) |
| **Deep Research** (gedaan) | Geverifieerde feiten-/spec-basis; herbruikt het Deel-A-patroon voor toekomstige dieren/gebieden | n.v.t. |

### 1a. Wat Claude Design (ik) NU al kan — zonder repo-toegang
- Een **Three.js proof-of-concept in standalone HTML** bouwen: een glTF laden (Quaternius CC0 als
  schone start), de **golden-hour licht-rig** uit research §A7/§C2 opzetten (warme directional key
  laag-links + koele hemi-fill + soft shadow), de **3-4 perspectief-camera** (~50° schuin, lage FOV)
  uit §A6, en een idle/walk-clip via `AnimationMixer`.
- De **look valideren**: klopt de camerahoek, leest het silhouet top-down, past de warme palette bij
  de bestaande `--spel-*`/`--paper`-kleuren, hoe groot ogen de dieren in de overworld.
- Een **turntable/model-viewer** maken om kandidaat-modellen te beoordelen en per dier de visuele
  spec (Deel B) vast te leggen — inclusief schaalverhoudingen (§C1).
- De **render-abstractie** ontwerpen (§5): een `<Dier>`-component met stabiele props
  (`soort`, `emotie`, `view`, `size`) die vandaag CSS-shapes toont en straks een Three.js-canvas mount.
- **Reduced-motion + low-end fallback** (sprite/billboard) prototypen zoals §A8 beschrijft.
- De **per-dier art-direction-kaarten** uit Deel B omzetten naar een bruikbaar design-artifact.

### 1b. Wat Claude Code LATER moet doen — in de Astro-repo
- **Asset-pijplijn** als build-step: `gltf-transform optimize … --texture-compress ktx2 --compress draco`,
  `DRACOLoader`/`KTX2Loader` wiring, GLB onder ~4 MB, LOD-bestanden (§A1).
- **Rigging & retargeting** in Blender: per-familie gestandaardiseerde rigs (canide: wolf+vos;
  ungulaat: edelhert+ree+zwijn) via Rigify/Auto-Rig Pro; walk/trot-retarget via Rokoko/ARP (§A3–A5).
- **Modellen verwerven & licentie-administratie**: kopen/maken van realistische modellen, bewijs van
  CC0/Royalty-Free bewaren; géén personal-use/Editorial assets in het product (§A2 waarschuwing).
- **Productiecomponent in Astro**: Three.js als island/web-component, ingebed in `SpelShell`, die
  `prefers-reduced-motion` + `preferences` uit `alvah-ef-v1` respecteert; `LOD`, `LoadingManager`,
  dispose-discipline tegen memory leaks (§A8).
- **Game-koppeling**: dier-emotie-standen (kalm/alert/bang) aan spel-events hangen; de
  heikikker-metamorfose-scène als morph/blendshape-reeks (§B9); EF-stappen blijven loggen via de
  bestaande `staircase/scoring/progressie/storage`-pipeline (ongemoeid).
- **Performance-handhaving** op echt doel-hardware (iPad/midrange): <100 draw calls, ~50K tris
  on-screen, fallback-drempels (§A1, §A8).

### 1c. Grens, in één zin
Ik lever **de look en een werkend 3D-prototype + specs**; Claude Code levert **de geriggede,
geoptimaliseerde productie-assets en de repo-integratie**. Alles wat Blender, een CLI-build, of de
echte repo nodig heeft, is Code-werk.

---

## 2. Geïntegreerde fasering (research §A9-ladder → projecttaal)

| Fase | Inhoud | Door wie | Output |
|---|---|---|---|
| **0 — Blockout** | Quaternius CC0-model in Three.js, golden-hour rig, 3-4 camera, idle/walk. Eén dier (voorstel: **frisling** of **edelhert**). | **Design** (nu) | losse HTML-POC in dit project |
| **1 — Stylized speelbaar** | Render-abstractie `<Dier>`, 2–3 dieren, betere proporties, emotie-standen gemockt, sprite-fallback. | **Design** | POC + `<Dier>`-spec |
| **2 — PBR-stylized** | Per-familie rigs, retargeting, IK foot-plant, secundaire oor/staart-beweging, KTX2/Draco-pijplijn. | **Code** (repo) | productie-assets + Astro-component |
| **3 — Realistisch** | High-poly→normal-mapped, volledige PBR, gang-blends, blendshapes, metamorfose-scène. | **Code** | per-dier realistische set |
| **4 — Fotorealistisch (close-up)** | Hero/plaat-kwaliteit: SSS-huid, fins/shell-fur voor pluis, WebGPU-TSL waar beschikbaar. | **Code** | story-moment-platen |

**Gouden regel uit §A9:** behoud over alle fasen **dezelfde rig-/skelet-botnamen en dezelfde
animatieclip-namen** → upgraden = mesh/texture vervangen zonder code te herschrijven.

---

## 3. Concrete hooks in de bestaande architectuur

**`sprites.jsx` → render-abstractie.** Introduceer één component met stabiele API:
```
<Dier soort="frisling" emotie="bang" view="topdown" size={64} />
   emotie: 'kalm' | 'alert' | 'bang'        (research Deel B, sub g)
   view:   'topdown' | 'plaat'              (overworld 3-4  vs  close-up)
   render-backend: 'css' (nu) | '3d' (straks) — zelfde props, schermen wijzigen niet
```
De huidige `Frisling`/`Boar`/`Ree`/`Reekalf` worden hiervan de `css`-backend.

**`Animal`-record (content-registry, `HANDOFF.md §3b`) krijgt 3D-velden:**
```
Animal = {
  …bestaand (id, naam, simpelWoord, vaktermen, feiten, toonVeilig)…,
  model3d: {
    bron, licentie,                 // herkomst + licentiebewijs (CC0/Royalty-Free)
    lod: { laag, mid, closeup },    // GLB-urls per niveau (§A1-tabel)
    clips: ['idle','walk','trot','run', signatuur],  // signatuur per dier (§B sub d)
    schaal,                          // reële maat → wereldschaal (§C1)
    emoties: ['kalm','alert','bang'],
  }
}
```

**Belichting is al gespecificeerd.** De golden-hour Three.js-waarden in §C2 mappen direct op de
bestaande warme palette (`--spel-sun #f5c23b`, `--accent-warm`, `--paper`). Geen nieuwe kleur-richting
nodig — de 3D-rig is de 3D-vertaling van wat de design-spec al "early morning, golden hour" noemt.

**Reduced-motion is al first-class** in `design-spec.md §2` en `plan.md §8` → mapt 1-op-1 op §A8
(idle-micro/camera-bob uit, sprite-fallback voor low-end).

**Kindveiligheid is al geborgd.** De "niet-eng"-regels in Deel B (geen slagtanden-dreiging, geen
sprookjeswolf, geen bloed/prooi) zijn de visuele tegenhanger van `veluwe-research.md` Deel 6 — ze
spreken elkaar niet tegen, ze versterken elkaar.

---

## 4. Per-dier visuele spec

Staat volledig in **`3d-animal-animation-research.md` Deel B** (subkoppen a–j per dier): silhouet/
proporties, vacht/kleur, kop, signatuur-beweging, gangen, idle, emotie-standen, top-down-leesbaarheid,
close-up-pose, referentie-zoektermen. Schaalverhoudingen in **Deel C1**, gedeelde belichting in **C2**.

Bijzondere stage-sets (animeerbare reeksen, niet één pose):
- **Edelhert — gewei-jaarcyclus** (afwerpen → bast → verbening → vegen → bronst): §B1.
- **Heikikker — volledige metamorfose** (ei → larve → +achterpoten → vierpotig+staart → froglet →
  volwassen; ♂ blauw in paartijd): §B9. Sluit aan op je bestaande Pond-/metamorfose-project — daar
  kan de 3D-reeks landen.

**Schaarste-let-op (§A2):** edelhert/ree/zwijn/wolf/vos zijn ruim verkrijgbaar; **das, eekhoorn,
adder, zandhagedis, heikikker** zijn schaars in realistische gerigde vorm → Quaternius-stylized als
basis, of los kopen/maken. Metamorfose-stadia bestaan niet kant-en-klaar → custom.

---

## 5. Aanbevolen eerste stap (Design, nu te doen)

Een **3D-proof-of-concept in dit project**: één dier in een Three.js-scène met de golden-hour rig en
3-4 camera, idle + walk, naast een knop om de bestaande CSS-versie ernaast te zien. Doel: bevestigen
dat de look klopt en dat de `<Dier>`-abstractie werkt vóórdat Claude Code de repo-pijplijn bouwt.

**Te kiezen met Floris:**
1. Welk dier als POC — **frisling** (klein, schattig, missie-1-held) of **edelhert** (imposant,
   toetst gewei + grote schaal)?
2. Realisme-niveau voor de eerste speelbare versie: **stylized CC0** (snel, schoon) of meteen richting
   gekochte realistische modellen?
3. Blijven story-momenten **2D-platen** (huidige design-spec) of worden die óók 3D close-ups?
4. Wil je dat ik **GitHub koppel** zodat de Code-fase straks de echte repo-structuur kan lezen?

---

## 6. Openstaande Code-afhankelijkheden (voor de repo-thread)
- Astro-island vs web-component voor de Three.js-mount binnen `SpelShell`.
- Build-step voor `gltf-transform`/Draco/KTX2 in de bestaande toolchain.
- Blender-workflow + licentie-administratie als onderdeel van de asset-map.
- Doel-toestel(len) van Alvah vaststellen → harde performance-budgetten (§A1/§A8).

---

## 7. Performance-audit POC (`Vos 3D POC.html`, jun 2026)

Gemeten met een ingebouwde `renderer.info`-overlay (rechtsonder: fps · draw calls · tris over de héle
frame, inclusief alle composer-passes — `renderer.info.autoReset=false` + `reset()` vlak vóór
`fx.render()`). Klik de overlay om te dimmen. Doel §A1/§A8: **<100 draw calls, ~50K tris, 60 fps**.

**Resultaat: ruim binnen budget — 60 fps, ~29–35 draw calls, ~26–39K tris** (idle → rennen).
Draw calls vóór de ingrepen lagen rond de richtgrens (~80+): 40 losse dennen-meshes + 9 rotsen +
post-passes. De grote winst zit in instancing (calls) en in pixelRatio/shadow/bloom (fragmentwerk).

| Ingreep | Vóór | Ná | Win |
|---|---|---|---|
| **Dennen instanced** (10×(stam+3 cones)) | 40 draw calls | 4 (1 stam-IM + 3 cone-IM) | −36 calls |
| **Rotsen instanced** (9 losse) | 9 draw calls | 1 InstancedMesh | −8 calls |
| **Shadowmap** key volgt de vos | 2048², elke frame een volle scene-pass | 1024² + `autoUpdate=false`, alleen hertekenen als de zon-positie (= vos óf dagdeel) écht verandert → idle/Rust = géén shadow-pass | ¼ res + meeste frames 0 shadow-passes |
| **Composer pixelRatio** | cap 2 (retina) | cap 1.5 | ~44% minder fragmentwerk over álle passes |
| **UnrealBloom** | volle resolutie | halve resolutie (`w/2,h/2`) | ~4× minder bloom-fragmentwerk (bloom hoeft niet scherp) |
| **Gras** 6000 blades × Plane(…,1,3) ≈ 36K tris | 6000, 3 segs, r≤14 | 3000, 2 segs, cull r≤9 (vos blijft binnen r≈11) | ~−27K tris |

**Bewust niet aangeraakt (minor / meet eerst):** motes (260 CPU-punten/frame) en de per-frame
`applyTimeState`-lerp — beide verwaarloosbaar naast het bovenstaande. **SMAA behouden:** met de
pixelRatio-cap is het één goedkope fullscreen-pass; vervangen door een multisampled render target
levert hier weinig op. **GTAO/SSAO** is bewust níét toegevoegd — dat is een extra post-pass die juist
tegen de audit in werkt; pas overwegen als er fps-marge over is op het doel-toestel.

**Wat hierna nog Code-werk is (niet in-browser POC):** echte LOD-bestanden + sprite-fallback voor
low-end, KTX2/Draco-build zodat textures niet de VRAM vullen, en de harde fps-handhaving op het
echte doel-toestel (iPad/mid-range) — de POC draait op desktop, dus dit zijn schattingen van de
relatieve winst, geen device-metingen.

## 8. Realisme-stap gedaan: secundaire beweging (staart-lag + ademhaling)

Eerst de rig geïnspecteerd (botnamen gelogd in console). De **Khronos-vos heeft 24 botten**, clips
`Survey/Walk/Run`. Staartketen: `b_Tail01_012 → b_Tail02_013 → b_Tail03_014`. **Let op: er zijn GÉÉN
oorbotten** — de oren zitten in de kop-mesh, dus oor-lag kan niet via bones (pas mogelijk met een
custom rig of blendshape in de Code-fase).

Gemeten staart-as-oriëntatie (additieve rotatie ná `mixer.update`, dus bovenop de clip):
- **local X = horizontale wag** (zijwaartse pluimstaart-zwaai) → primair "levend" gevoel.
- **local Z = verticale lift/krul** → staart stroomt omhoog bij rennen.

Implementatie: een **gedempte veer** drijft de wag, gevoed door (a) trage idle-sinus, (b)
snelheids-gekoppelde sinus en (c) een draai-impuls (lag bij bochten); per segment loopt de zwaai op
naar de tip met fasevertraging ("whip"). De lift schaalt met de gemeten loopsnelheid. **Ademhaling in
rust:** subtiele borstkas-scale (`b_Spine01_02`), uitgefade zodra de vos beweegt. Alles gegate op
`Beweging`-toggle + `prefers-reduced-motion` (beide → bevriezen).

**Volgende realisme-stap (voorstel):** IK foot-planting tegen rest-ice-skating in manual Lopen/Rennen,
óf emotie-houdingen (kalm/alert/bang, §B5) als additieve kop/staart-poses bovenop dezelfde clips.

## 9. Realisme-stap gedaan: ogen (+ IK foot-planting geprobeerd en teruggedraaid)

**Ogen.** De CC0-vacht-mesh heeft géén oog-geometrie (ogen zaten alleen impliciet in de diffuse).
Toegevoegd: twee **warm-donkere amandelvormige ogen** (afgeplatte `MeshPhysicalMaterial`-bollen,
`color #201509`, `roughness 0.34`, milde `clearcoat 0.55`, **lage `envMapIntensity 0.45` zodat ze
niet wit uitbloeien**) + per oog een klein wit **catchlight**-bolletje (`MeshBasicMaterial`) — dat is
de "natte glans" uit research C2/B5 en geeft de blik leven. Alles geparenteerd aan `b_Head_05` zodat
het met de kop mee-animeert. **Let op de as-conventie van dit bot: +X = snuit-vooruit, +Y = omhoog,
+Z = zijwaarts** (niet de gebruikelijke z-forward). Eind-plaatsing `{fwd:18.8, up:8.0, sep:±3.4,
r:1.15}` met amandel-scale `sx:0.72, sy:0.82, sz:1.22` (in GLB-units; schaalt mee met `model.scale`).
Eerste poging was een glanzende zwarte bol — die las als "googly eyes" en flaarde wit onder de bloom;
de matte amandel + catchlight past bij de low-poly stijl en is warmer.

**IK foot-planting — geprobeerd, gemeten, en weer verwijderd.** Een analytische 2-bots IK
(voet-XZ verankeren tijdens stance) haalde numeriek het doel (voet-slip tijdens stance van ~1,17×
romp-snelheid → 0,000), **maar vervormde de poot-poses zichtbaar** op deze rig (Fox heeft maar 2
deform-segmenten per poot, geen pole/teen-controle), waardoor de loop er slechter uitzag dan de kale
clip. Conclusie: in-browser additieve IK is hier niet de moeite waard; echte IK foot-planting hoort in
de Code-fase op een rijker rig (pole-target + teen/heel-bones, Rigify/ARP).

**In plaats daarvan — loop-snelheid op de stride afgestemd (anti-ice-skating zonder IK).** De
restschuiver kwam doordat de clip-cadans niet matchte met de afgelegde afstand. Via een ref-sweep
(meet voet-XZ-slip tijdens stance over meerdere `timeScale`-waarden) bleek de **walk-`ref` van 1.15 →
1.4** (timeScale ~0.96 → ~0.79) de stance-slip te halveren (~1,08 → ~0,66) → voeten "plakken" beter,
de loop oogt vloeiender en minder als een stijve glij-gang. Run bleef op 3.2 (de run-sweep was te
ruizig, en de klacht ging over lopen). De ref-constanten staan in zowel de auto-wander- als de
manual-tak van de loop; pas ze samen aan als de stride verandert.

**Volgende stap (zie inline-handoff in de thread):** niet nog meer vos-polish, maar de **herbruikbare
`<Dier>`-framework-laag** bouwen (§3/§5) zodat een 2e dier met dezelfde scène/rig/clip-conventies
erin valt — en pas daarna emotie-houdingen per dier.

## 10. Framework gebouwd: Stage + Character + Specs (+ emotie-laag)

De vos-POC is opgesplitst in een herbruikbaar basismodel. Deliverable: **`Veluwe 3D.html`**
(importeert de drie modules, mount de Stage, laadt een character, bedraadt de UI). Bewezen met een
**2e CC0-model met ándere bot-/clipnamen** — zo is de spec-mapping écht getest, niet alleen aangenomen.

**Bestandsindeling (één bron per ding, géén versie-files):**

| Bestand | Rol | Tuning-niveau |
|---|---|---|
| `stage.js` | `Stage`-klasse + `STAGE_CONFIG`. Dier-onafhankelijk: renderer/composer/post, golden-hour licht-rig, `TIMES` dagdeel-presets, HDRI/IBL, heide-grond + geïnstanceerde props, volg-cam, perf-overlay, reduced-motion. Hooks: `stage.scene`, `stage.registerEnvMat(m,owner)` / `releaseEnvMats(owner)`, `stage.followTarget(obj)`, `stage.flags`, `stage.setTime()`. | **Niveau 1 — hele wereld/look** → `STAGE_CONFIG` |
| `character.js` | `loadCharacter(stage, spec)`. Generieke engine, **nul hardcoded vos-namen/-assen**: GLB laden → (optioneel) smooth-shade + vacht-PBR → ogen uit spec → botten via `spec.bones`/`spec.axes` → secundaire beweging op de staartketen → schaal op `spec.scale.targetHeight` → locomotie met `spec.locomotion` → emotie-laag. Retourneert een handle: `update(dt)`, `setGait('rust'\|'walk'\|'run'\|'auto')`, `setEmotion('kalm'\|'alert'\|'bang')`, `dispose()`. | (engine — niet tunen) |
| `specs.js` | Per-dier `CharacterSpec`-objecten + `SPEC_ORDER` + **licentiebewijs per asset** (CC0-bron + URL + datum). | **Niveau 2 — één dier** → die `CharacterSpec` |
| `Veluwe 3D.html` | Mount + UI: toggles (Volg/Auto-draai/Schaduw/Beweging), gang-knoppen, dagdeel, **character-kiezer** en **uitdrukking-knoppen**. | (bedrading) |

**Twee tuning-niveaus, expliciet:** wijzig je de héle wereld/look → `STAGE_CONFIG` (stage.js).
Wijzig je één dier → die `CharacterSpec` (specs.js). De engine zelf raak je niet aan om een dier toe
te voegen: een 2e/3e dier = een spec invullen.

**Emotie-structuur (research §B sub g) — generieke additieve laag in `character.js`, twee backends:**
- **POSE** — additieve kop/staart-houding (`headPitch`/`headYaw`/`tailLift`), via `spec.bones` +
  `spec.axes`; toegepast ná `mixer.update` zodat het bovenop de clip ligt. (Vos: kop hoog + pluim op
  = alert; kop laag + afgewend + staart ingetrokken = bang.)
- **MORPH** — expressie-morphtargets op de mesh (`spec.emoties.<naam>.morph`). (Robot: `Surprised`/`Sad`.)

Elk dier erft beide automatisch; in de spec vul je alleen in wat past (de vos heeft geen
expressie-morphs → pose; de robot heeft geen bruikbare staart-/kop-bot → morph). Accumulatie-vrij:
de engine roept ook bij Beweging-uit `mixer.update(0)` aan zodat de pose elke frame herberekend wordt
en de additieve offsets niet oplopen. Emotie blijft zichtbaar als Beweging uit staat.

**2e dier = framework-bewijs.** `RobotExpressive` (three.js, **CC0**, Tomás Laulhé / Don McCurdy) —
bewust géén vos-kloon: clipnamen `Idle/Walking/Running` (vs `Survey/Walk/Run`), andere bot-namen, en
expressie-morphtargets. Het is een **framework-test-placeholder**, géén Veluwe-dier; vervang door een
CC0 Veluwe-dier (Quaternius "Ultimate Animated Animal Pack") zodra de Code-fase (§1b) een lokale
asset-pijplijn heeft. Asset-let-op: example-modellen zitten **niet** in het npm-pakket van three →
laad via GitHub-raw met een vaste tag (`r160`), niet via `cdn.jsdelivr.net/npm/three@…/examples/models/…`.

**Perf na het 2e dier (overlay):** ruim binnen §A1/§A8-budget — **60 fps**, vos ~39 calls / ~40K tris,
robot ~47 calls / ~28K tris. Eén dier tegelijk (de kiezer `dispose()`t de vorige + meldt z'n env-mats af).

**Nog steeds Code-werk (§1b):** Blender-rigging/retargeting (echt oor-rig, IK foot-plant op rijker
rig), gltf-transform/Draco/KTX2 + LOD, sprite-fallback voor low-end, betaalde/hi-poly modellen, en de
koppeling aan SpelShell/scoring/storage. De emotie-`setEmotion()`-API is al de hook waaraan de
Code-fase straks spel-events hangt.

---

## 11. Character toegevoegd: Ranger "Alvah" (mens) — procedureel figuur op CC0-rig

Een **mensachtig personage** naast de vos in de kiezer. Belangrijkste ontwerp-keuze: er is
**géén kant-en-klare CC0 mens-asset** die betrouwbaar in-browser laadt (Quaternius is CC0 maar staat
op itch.io/gumroad, niet raw-host-baar; de three.js-`Soldier.glb` heeft géén heldere CC0-licentie —
de three.js-repo merkt zelf op dat veel assets ongelicentieerd zijn). Daarom:

**Rig + clips hergebruikt, uiterlijk zelf gebouwd.** We laden alléén het **CC0-skelet + de
Idle/Walking/Running-clips van RobotExpressive** (al bewezen laadbaar, hard CC0), **verbergen de
robot-mesh**, en bouwen de zichtbare junior-boswachter **volledig procedureel** op de botten — exact
het patroon dat de engine al voor de vos-ogen gebruikt (geometrie geparenteerd aan een bot),
veralgemeniseerd tot een heel figuur. Licentie-administratie staat in `specs.js` (CC0, Tomás Laulhé /
Don McCurdy; alléén rig+clips). Quaternius "Ultimate Animated Character Pack" (CC0) blijft het
bedoelde productie-alternatief zodra de Code-fase (§1b) een lokale asset-pijplijn heeft.

**Nieuw bestand: `humanoid.js`** — een generieke "aankleed"-laag. `buildHumanoid(stage, spec, handle)`:
- **Schaal-fix.** De RobotExpressive-mesh is ~50× groter dan z'n bot-armatuur (bind-scale), dus de
  mesh-bbox-normering maakt de botten piepklein. Omdat we op de botten bouwen, herschalen we het model
  zodat de **skelet-hoogte == `spec.scale.targetHeight`**, voeten op de grond, romp op de oorsprong.
- **Wereld-ruimte attach.** Elk onderdeel wordt geplaatst via een exacte wereld→lokaal-matrix
  (`bone.matrixWorld⁻¹ · M_wereld`), dus géén giswerk over bot-lokale assen/schalen. Alle maten zijn
  **fracties van de gemeten skelet-hoogte H** → schaal-robuust.
- **Lichaam/outfit:** romp (bosgroene jas) + korte broek + huid-onderarmen/handen + laarzen + nek +
  groot kinderhoofd (donkerblonde pony die naar voren valt + cowlick), blauwe ogen (geschilderde
  iris/pupil/glans-schijf), wenkbrauwen, neus, mond. **Outfit:** rode scout-halsdoek (ring + bef) en
  een diagonale **sjerp met badge-slots**.
- **Verdienbare badges (data-gestuurd).** 6 Veluwe-badges in `spec.build.badges`
  (`vossen-spotter, nachtwacht, heide-held, boomklimmer, spoorzoeker, waterwachter`), elk met een
  canvas-getekend geometrisch icoon. Elk slot is **leeg (donkere socket) tot verdiend**;
  `handle.setBadges([...ids])` schakelt ze aan. UI: chips in het Ranger-paneel + Alle/Wis.
- **Hoed (toggle):** brimmed ranger-hoed; `handle.setHat(bool)`. Standaard aan, met pony eronder zodat
  de likeness (haar/gezicht) blijft lezen.

**Engine-uitbreidingen in `character.js` (generiek, spec-gestuurd — geen vos/ranger-hardcode):**
- Als `spec.build` bestaat → `buildHumanoid()` (ná schaal + `scene.add`). `handle.setBadges/setHat`
  delegeren naar de humanoid-API; `handle.badgeDefs` exposed voor de UI.
- **Manual/"bestuurbaar" gang.** Nieuwe gang naast rust/walk/run/zwerven: `handle.setInput({f,b,l,r,run})`
  + een `manual`-tak in `advanceLocomotion` (↑/↓ = vooruit/achteruit langs de heading, ←/→ = draaien,
  Shift = rennen → rent de bestaande walk/run-clips, draait naar de bewegingsrichting). Werkt voor
  **elk** character (de vos is dus ook bestuurbaar). Volg-cam blijft werken.

**UI in `Veluwe 3D.html`:** Ranger-knop in de kiezer (naast de Vos), een **Ranger-uitrusting-paneel**
(badge-chips + Hoed/Alle/Wis, alleen zichtbaar als de Ranger actief is), een **Bestuurbaar**-gangknop
(zet auto-draai uit), en **pijltjestoets-besturing** (een pijl indrukken selecteert automatisch
Bestuurbaar). Emotie kalm/alert/bang = dezelfde POSE-laag (kop-bot): alert = kin omhoog, bang = kop
omlaag + afgewend (geverifieerd via bot-rotatie).

**Perf (overlay):** ruim binnen §A1/§A8-budget — **60 fps**, ranger ~77 draw calls / ~31K tris (het
procedurele figuur ≈ 35 losse meshes; ruim onder de 100-calls-grens, één character tegelijk). Verdere
draw-call-reductie (merge per bot / instancing) is optionele Code-fase-polish.

---

## 12. Ogen — onderzoek → bouwparameters (alle dieren + mens)

> Bron: `humans-full-animals-eyes-research.md` (Deel B-OGEN). Dit veralgemeniseert de
> ad-hoc vos-ogen uit §9 naar een **spec-gestuurde oog-laag** voor de héle cast. Ogen zijn
> volgens het onderzoek de **#1 emotionele lezing** — één ontbrekende catchlight maakt een
> gezicht al levenloos.

### 12a. De vier dingen die "leven" maken (geldt voor élk oog, mens én dier)
1. **Catchlight** — een scherpe specular-highlight van de key-light. Onze golden-hour key (warm,
   laag van links, §C2) levert die vanzelf; versterk desnoods met een klein extra spec-bolletje
   (zoals de vos in §9 al heeft). **Belangrijkste enkele factor.**
2. **Natheid** — clearcoat / hoge specular op het oogoppervlak + subtiele natte "waterline" langs
   het onderooglid.
3. **Micro-beweging** — knipperen + saccades + look-at (zie 12c). Zonder dit: starende dode blik.
4. **Schaal & diepte** — juiste oog-grootte, geen platte "geplakte" iris. In close-up: parallax of
   echte refractie (12d).

### 12b. Per-soort oog-spec (om in `specs.js → CharacterSpec.eyes` te gieten)

| Soort | Pupilvorm | Iris-kleur | Sclera (wit) | Tapetum / eyeshine | Oog t.o.v. kop | Blik-systeem |
|---|---|---|---|---|---|---|
| **Mens / Ranger** | rond | **groen-hazel** (Alvah; zie §13d) | **veel wit, uniek** | nee | matig; kind relatief groter | **ogen draaien zichtbaar** (look-at via oog-bot/UV) |
| Edelhert | horizontaal slot | donkerbruin (pupil blendt in iris) | nauwelijks | **ja** — wit/oranje eyeshine in schemer | groot, zijwaarts | vooral **kop** beweegt |
| Ree | horizontaal slot | donkerbruin | nauwelijks | ja | groot, zijwaarts | kop |
| Wild zwijn | rond, klein | donkerbruin | weinig | ja (zichtbaar in IR) | zeer klein, zwak zicht | kop |
| Wolf | rond | amber / geel-goud (pups blauw) | weinig | ja | matig, frontaal | kop + lichte oog |
| **Vos** | **verticale spleet** | amber / geel (welpen slate-blauw) | weinig | ja (wit/blauwgroen) | matig, frontaal | kop + lichte oog |
| Das | rond | donkerbruin | weinig | ja | klein | kop |
| Eekhoorn | rond, groot | groot, donker | weinig | **nee** (dagactief) | groot, donker, bol | kop |
| Adder | **verticale spleet** | rood / koper | n.v.t. (bril/spectacle, geen ooglid) | — | klein, fel | kop |
| Zandhagedis | rond | donkerbruin | weinig | nee | klein | kop |
| Heikikker | horizontaal | gouden iris (boven lichter), donker gemêleerd | n.v.t. | ja (retinaal) | groot, bol | kop |

**Twee bouw-gevolgen uit deze tabel:**
- **Sclera-regel.** Alleen de **mens** toont veel wit → bij de ranger draaien de ogen zichtbaar
  (sterke emotionele lezing, koppel oog-rotatie/UV aan het look-at-systeem). Bij **dieren** beweegt
  vooral de **kop**; geef ze géén grote witte sclera (leest "menselijk"/eng) en doe look-at via de
  kop-bot (zoals de vos al doet).
- **Eyeshine-regel.** Prooi/nachtdieren met tapetum (hert, ree, zwijn, wolf, vos, das, kikker) mogen
  in **schemer-shots** een subtiele oranje/witte eyeshine krijgen (emissive bij lage lichtsterkte);
  **mens, eekhoorn, zandhagedis: nooit** (geen tapetum). Niet overdrijven — kindveilig houden.

**Correctie op de huidige vos-POC (§9):** de vos-ogen staan nu warm-donker amandel (`#201509`).
Dat las goed bij de low-poly stijl, maar de soort-echte richting is **amber/geel met verticale
spleet-pupil**. Bij de PBR-stylized realisme-stap (Fase 2/3): iris naar amber, pupil als verticale
spleet (iris-textuur of UV), **`envMapIntensity` laag houden** (§9) zodat de lichtere iris niet
wit uitbloeit onder de bloom.

### 12c. Micro-animatie (gedeeld systeem in `character.js`, gevoed per spec)
- **Knipperen:** mens ~**15–20×/min** in rust; daalt bij focus (lezen ~4,5/min) en stijgt bij praten
  (~10–32/min). Eén blink ~200–400 ms. Implementeer via blink-blendshape of ooglid-bot; **randomiseer
  interval ~3–6 s**. Verlaag de frequentie tijdens "focus"-momenten (alert/turen).
- **Saccades:** kleine random fixatie-shifts (2–5 boogminuten tot ~20°) tijdens idle/gesprek.
- **Look-at:** ogen (mens) + kop (dier) richten op interessepunten — koppel aan het bestaande
  follow/look-at-systeem; bij de gids-ranger sterk effect.
- **Pupil-dilatatie:** goedkoop via iris-UV-schaal of kleine blendshape; subtiel wijder bij "verrast".
- **Koppel aan emotie (§B sub g):** *alert-nieuwsgierig* = eyeWide + pupil iets wijder + look-at +
  langzamer knipperen.

### 12d. Oog-LOD (per oog) — wat wel/niet de moeite is

| LOD | Geometrie | Textuur | Cornea-refractie |
|---|---|---|---|
| **Overworld** (3-4 top-down) | platte/enkele mesh, ~50–150 tris/oog | gedeeld 256–512 | **nee** — flat, **gebakken catchlight** |
| **Mid** | enkele mesh + parallax, ~150–400 tris | 512 | parallax-fake diepte |
| **Close-up / plaat** | **twee-laags** (oogbol + transparante cornea-bult), ~500–1.500 tris/oog | 1024–2048 | **ja** — `MeshPhysicalMaterial` (transmission, **IOR ~1,376**), iris ~2,18 mm achter cornea-apex |

Twee-laags refractie is **onzichtbaar klein** op overworld-LOD → daar nooit doen. **Stilering wint
voor kinderpubliek:** gestileerde ogen (groter, simpeler, één sterke warme catchlight) lezen vaak
**warmer en levendiger** dan hyperrealistische ogen — én ze vermijden de dode-pop-val. Default dus:
gestileerd + één warme catchlight; refractief realisme alleen voor uitgesproken hero-platen.

### 12e. Iris = swappable material (character-creator-haak)
Maak de iris een **verwisselbare textuur/material** (oogkleur-keuze). Dit is dezelfde haak die de
aanpasbare avatar (§13e) gebruikt en sluit aan op de bestaande `registerEnvMat`/material-discipline
in `stage.js`/`character.js`.

### 12f. Oogkleur-statistiek & diversiteit (mens)
Voor een diverse, geloofwaardige cast + de character-creator (12e/13f):
- **Wereldwijd:** ~**79% bruin**, ~**8–10% blauw**, ~**5% hazel**, ~**2% groen**.
- **Europa = NW→ZO-gradiënt** (licht→donker): IJsland ~74,5% blauw; **NL ~70% blauw/grijs**;
  Zuid-Europa overwegend bruin. Gebruik **landankers**, niet één "Europees" getal.
- **NW-Europese kinderen** worden vaak met lichte/blauwe ogen geboren die tot ~3 jr kunnen donkeren
  (melanine ↑; verschuiving altijd licht→donker).
- **Alvah's groen-hazel is relatief zeldzaam** (~2% groen wereldwijd) → juist **onderscheidend en
  herkenbaar**; leg de exacte tint vast en bewaar 'm (geen "standaard blauw/bruin" toepassen). Maak
  iris swappable zodat NPC's/speler-avatars de hele range kunnen pakken.

---

## 13. Mensen — volledige recreatie (cast, pijplijn, proporties, gezicht)

> Bron: `humans-full-animals-eyes-research.md` (Deel A + Deel B). De huidige procedurele ranger
> (§11) is de **Design-fase stand-in**; dit is het complete plaatje voor de Code-fase én de
> art-direction-knoppen die nu al gelden.

### 13a. Pijplijn — mensen verschillen fundamenteel van dieren
Het grote cadeau: mensen leunen op **gestandaardiseerde humanoïde pijplijnen** (waar dieren handwerk
waren). Eén animatieset stuurt de hele cast via retargeting.
- **Productie-route (Code-fase):** vaste cast met **MakeHuman/MPFB (CC0)** → **Mixamo** auto-rig
  (standaard 65-bots skelet, of "No Fingers" 25) → Mixamo-animatiebibliotheek (idle/walk/run/wave/
  point/sit/talk…). Alles op één gedeeld humanoïd skelet → retargeting gratis (`SkeletonUtils.retarget()`;
  let op bekende randgevallen bij proportieverschillen).
- **Huidige Design-route (nu, §11):** CC0-rig + clips van RobotExpressive, robot-mesh verborgen,
  figuur **procedureel** op de botten gebouwd (`humanoid.js`). Blijft de stand-in tot de Code-fase een
  lokale asset-pijplijn heeft; dan vervangen door MakeHuman/Mixamo of Quaternius (CC0).
- **Aanpasbare speler-avatar:** **Ready Player Me** (browser-native glTF, ARKit-blendshapes, ≤30k tris,
  ≤4 skin-weights/vertex genormaliseerd op 1.0).

**Uncanny-valley-regel (kritisch voor mensen):** houd mensen **bewust ietsje méér gestileerd** dan
de dieren. Knoppen: iets grotere ogen (niet té — zie 13c), zachtere/vereenvoudigde trekken, subtiele
**SSS** (geen plastic/wasachtige huid), iets grotere kop, warme highlights/koele schaduwen. Een
net-niet-echt dier is schattig; een net-niet-echte mens is eng.

### 13b. Cast + proporties (de leeftijd zit in de verhoudingen)
Sterkste leeftijdssignalen: **koppen-hoog + ooglijnhoogte + ledemaatlengte**. ~0,5–1 kop verschil
verschuift de waargenomen leeftijd al sterk.

| Personage | Koppen hoog | Lengte (NL-gem.) | Gezichtskenmerk |
|---|---|---|---|
| Peuter jongen (3 jr) | ~5 | ~95–97 cm | groot voorhoofd, lage ooglijn, grote ronde ogen, knopneus, bolle buik |
| Peuter meisje (4 jr) | ~5,5 | ~103–105 cm | idem, iets slanker; haar langer (staartjes/krullen) |
| **Ranger (8 jr, Alvah)** | **~6** | **~130–132 cm** | richting "groot kind", nog ronde wangen, lage ooglijn, grote ogen |
| Volwassen vrouw | ~7,5 | ~170 cm | ooglijn halverwege, zachtere kaak, rondere contouren |
| Volwassen man | ~7,5 | ~183 cm | brede schouders (~2 koppen), hoekiger kaak, prominentere wenkbrauwboog |

**Kind-verschuivingen t.o.v. volwassene:** groter voorhoofd, **ooglijn lager** (dichter bij de neus
i.p.v. halverwege), **grotere ogen relatief**, ronder gezicht, kleine neus/kin, zachte kaak, ogen
verder uit elkaar op de grotere kop. Kinderen: bouncier gang, hogere cadans, armen wijder.

**Schaal-overzicht voor scènes (mens + dier samen, §C1):** peuter (3) tot ~middel ranger; peuter (4)
tot ~borst ranger; ranger ijkpunt ~131 cm; volwassen man/vrouw torenen erboven; **edelhert-rug ≈
ranger-ooghoogte** (imposant!); vos tot z'n knie; das tot z'n scheen; eekhoorn/adder/kikker bij de
voeten. Dier-schofthoogtes verifiëren tegen `3d-animal-animation-research.md` Deel C1.

### 13c. Gezicht & blendshapes (de hoofdmoot bij mensen)
Standaard = **ARKit-52 blendshapes** (de-facto web/realtime-norm). Voor een warm, expressief maar
simpel kind/volwassen gezicht volstaat een **subset van ~16–20**:

| Doel | Blendshapes (ARKit) |
|---|---|
| Glimlach/blij (oprecht = "Duchenne") | mouthSmile L/R, cheekSquint L/R, lichte eyeSquint L/R |
| Verrast / nieuwsgierig | browInnerUp, browOuterUp L/R, eyeWide L/R, jawOpen (licht) |
| Verdrietig (mild) | browInnerUp, mouthFrown L/R, lichte eyeLookDown |
| Bang (mild, kindvriendelijk) | eyeWide L/R, browInnerUp, mouthStretch L/R (licht) |
| Praten / visemes | jawOpen, mouthFunnel, mouthPucker, mouthClose (+ A/I/U/E/O) |
| Knipperen | eyeBlink L/R |

Aansturen: `mesh.morphTargetInfluences[i]` via `morphTargetDictionary` (op naam), met fade-in/out
~0,3–0,4 s tegen schokken. **Niet-eng-regels:** enge shapes (angst/woede) **≤0,4–0,6**, nooit vol;
altijd combineren met zachte ogen; vermijd asymmetrie (leest "sinister"); laat ogen meebewegen bij
glimlach (eyeSquint = oprecht). Dit haakt direct op de bestaande **MORPH-emotie-backend** in
`character.js` (§10) — de ranger kan straks MORPH (gezicht) + POSE (kop/houding) combineren.

**Kind-ogen (waarschuwing):** de oogbol is bij geboorte al ~⅔–¾ van volwassen grootte en groeit véél
minder dan het gezicht → daarom ogen kinderen "grootogig". Maak kinderogen proportioneel groter, maar
**niet té groot** (kantelt van schattig naar uncanny/pop-achtig). Iris licht vergroten + lage ooglijn
doet al genoeg.

### 13d. **Ranger "Alvah" — likeness-spec (uit de foto's, jun 2026)**
> Referentie: `1000152315–1000152320.jpg` (front, ¾, profiel, glimlach, neutraal). Dit is het
> doel-uiterlijk voor het procedurele figuur in `humanoid.js`. Negeer tijdelijke details (lichte
> roodheid om de mond = lip-likken, geen permanent kenmerk).

- **Haar:** donkerblond / lichtbruin met **door-de-zon lichtere punten**; **tousled, golvend en
  shaggy**, middellang. Pony valt naar voren én opzij over het voorhoofd; **langer en rommeliger op
  de kruin/achterkant** (richting losse "surfer/shaggy" coupe), met **cowlick**. Oren deels bedekt.
- **Ogen:** **groot en expressief, groen-hazel** (groen-grijs met warme kern) — **niet blauw**.
  **Opvallend lange, donkere wimpers** (signatuur — boven duidelijk). Wenkbrauwen middenbruin,
  vrij recht met lichte boog, laag geplaatst.
- **Huid:** licht, warme ondertoon, lichte zomerbruining.
- **Neus:** klein, rechte brug, **iets opwippende/ronde tip** (profiel bevestigt licht omhoog).
- **Mond:** **volle lippen**, duidelijke cupidoboog, vriendelijke glimlach; **bovenste voortanden
  iets prominent** (twee front-snijtanden naar voren, typisch wisselgebit ~8 jr).
- **Gezicht:** ovaal, aan het lengen maar nog zachte kinderwangen; kin klein-tot-middel.
- **Oren:** middelgroot, licht afstaand.
- **Bouw:** slank, smalle schouders, lang-leen torso (typisch lenige 8-jarige).
- **Uitdrukking (default):** open, nieuwsgierig-vriendelijk; makkelijke scheve glimlach (zie ¾-foto).

**Correcties op de huidige `humanoid.js` (§11) om de likeness te halen:**
1. **Oogkleur blauw → groen-hazel** (geschilderde iris/material aanpassen). Dit is de meest
   zichtbare mismatch.
2. **Haar:** van nette "pony + cowlick" naar **langere, shaggy, golvende coupe** met lichtere punten
   en rommeliger kruin/achterkant.
3. **Wimpers toevoegen** — donkere, lange bovenwimpers (klein alpha-vlak of geometrie-randje); sterk
   likeness-signaal.
4. **Voortanden:** lichte prominentie van de twee bovenste snijtanden bij de glimlach-pose.
5. **Neus-tip** iets opwippend; **lippen** voller; **wenkbrauwen** laag en vrij recht.

Houd de bestaande, werkende delen (groot kinderhoofd ~6 koppen, bosgroene outfit, rode halsdoek,
badge-sjerp, hoed-toggle) — dit zijn alleen gezicht/haar-verfijningen bovenop §11.

### 13e. Kleding, haar & huid — realtime techniek
- **Haar:** **simpele mesh-coupes** (solide vorm + normalmap) zijn het goedkoopst en passen het best
  bij de gestileerde kindvriendelijke look — aanbevolen voor overworld. Hair-cards alleen mid/close;
  **strand-based hair = niet doen** (mobiel/iPad-killer). Houd 1–2 draw calls per personage.
- **Huid:** PBR met **subtiele SSS** (`MeshPhysicalMaterial`, transmission/thickness) → oren/neus/
  vingers gloeien warm op in golden-hour. Vermijd plastic/wasachtig (matige roughness, geen overdreven
  specular). Diverse huidtinten: varieer basecolor + SSS-tint (donkerder huid → SSS subtieler, meer
  als "golden rim light" langs de silhouetrand). WebGL2-fallbackpad voor SSS klaarhouden.
- **Outfit-palet ranger:** aardetinten (bosgroen, kaki, warm bruin) + herkenbare accentkleur — sluit
  aan op de bestaande `--spel-*`/`--paper`-palette en de huidige §11-outfit.

### 13f. Aanpasbare avatar / character-creator (later)
Twee basis-skeletten (feminine/masculine) + morph-target lichaamstypes; instelbare huidtint, haarkleur/
-stijl, oogkleur (= swappable iris-material, 12e), kleding. **Ready Player Me** via iFrame (snelst) of
eigen UI via REST-API; ARKit-52 blijft werken over alle varianten omdat het rig consistent is. Cap
≤30k tris, Draco/meshopt aan. De gedeelde animatieset + emotie-blendshapes werken op elke avatar.

### 13g. Per-personage art-direction-kaarten + animatie-clips
**Volledige per-personage specs staan in `humans-full-animals-eyes-research.md` Deel B** (sub a–j:
silhouet/proporties, huid/haar/kleur, kop/gezicht, signatuur-houding & -beweging, gangen, idle,
emotie-standen, top-down-leesbaarheid, close-up "plaat"-pose, referentie-zoektermen) — net als de
dier-kaarten in het dieren-rapport Deel B. Niet dupliceren; per personage de kaart daaruit invullen
bij het bouwen. De cast: **B1 Ranger (8 jr)**, **B2 peuter jongen (3)**, **B3 peuter meisje (4)**,
**B4 volwassen man**, **B5 volwassen vrouw**, **B6 aanpasbare avatar/creator**.

**Mixamo-/mocap-clips per type (A4):**
- **Ranger/gids:** Idle, Looking Around, Walking, Standing, Talking, Pointing, Waving, Hands On Hip,
  Sitting, Crouch. Signatuur: gids-stand (licht voorover, wijzend/uitleggend, hand boven ogen "turend").
- **Kinderen (spelend):** Happy Walk, Run, Jump, Excited, Wave, Sitting (vloer), Clapping.
- **Mixamo in-place editing:** snelheid, mirroring, blending, **foot-lock** (tegen voet-slip), export 60 fps.
  Uitbreiding: ActorCore (4.500+) / CMU (2.000+, BVH→glTF, retarget via Auto-Rig Pro).
- **Kind vs. volwassen locomotie:** kind = kortere ledematen, hogere cadans, bouncier (meer verticale
  beweging, armen wijder); volwassene = geaard, lagere cadans, kleine verticale oscillatie. Pas
  clipsnelheid/amplitude aan of gebruik aparte kind-clips.
- **Procedureel (Three.js):** IK foot-planting (anti-slip), look-at/head-tracking (gids-ranger),
  secundaire beweging (haar/kleding via spring bones/verlet, ademhalings-idle), `prefers-reduced-motion`
  dempt secundair/idle-sway. Sluit aan op de bestaande secundaire-beweging-laag (§8) en POSE/MORPH-emotie (§10).

### 13h. Budgetten, realisme-ladder & performance-prioriteit (mens)
**Poly-budget (mens), zelfde kader als dieren (§A1):**

| LOD | Toepassing | Tris (mens) |
|---|---|---|
| Overworld | 3-4 top-down, klein op scherm | 1.500–4.000 |
| Mid | middelafstand (speler-default) | 5.000–15.000 |
| Close-up hero | "plaat"/storymoment | 20.000–50.000 |

Scene-budget ~50K tris on-screen; <~100 draw calls; textures 512–2048 KTX2; GLB <~4 MB; RPM hard cap
**30k tris / 4 skin-weights/vertex**. *Toets: de huidige procedurele ranger (~31K tris / ~77 calls,
§11) zit binnen budget, maar dicht bij de calls-grens → merge-per-bot/instancing is de Code-fase-polish.*

**Realisme-ladder (mens, §A9) — mensen blijven bewust ietsje méér gestileerd dan dieren:**
1. **Blockout** (grijze proporties, head-count klopt) → 2. **Gestileerd** (vereenvoudigde vormen,
mesh-haar, flat-ish ogen) → 3. **PBR-gestileerd** *(aanbevolen eindstation voor de meeste shots:
PBR-huid + subtiele SSS, ARKit-subset, twee-laags ogen alleen close-up)* → 4. **Realistisch** →
5. **Fotorealistisch** (alleen close-up "plaat"). **Gouden regel:** behoud over alle fasen dezelfde
rig-botnamen + clip-namen → upgraden = mesh/texture vervangen zonder code te herschrijven.
**Drempel:** voelt een mens "eng" in playtests → één stap terug op de ladder (meer stilering).

**Performance-prioriteit (§A8):** de **speler-ranger staat vrijwel altijd in beeld** → diens budget
weegt het zwaarst: geef hém de beste **consistente mid-LOD**, reserveer hero-LOD (20–50k) voor
platen. **NPC's** mogen agressiever LOD-en + sprite-fallback. iPad onder 60 fps → agressiever LOD,
mesh-haar i.p.v. cards, blink/saccade vereenvoudigen.

### 13i. Caveats (uit het onderzoek — bewust meenemen)
- **Geen enkel "Europees" oogkleur-percentage** — het is een NW→ZO-gradiënt; gebruik landankers (12f).
- **"Ogen volwassen bij geboorte" is een mythe** — ~⅔–¾ van de volwassen grootte; de grootogige
  kinderlook komt doordat de oogbol véél minder groeit dan het gezicht.
- **Antropometrie (CBS, WHO/CDC) en oog-anatomie zijn sterk;** sommige proportie- en
  dier-eyeshine-details zijn **richtlijn, geen exacte spec** (o.a. zandhagedis-iris = beredeneerde aanname).
- **`SkeletonUtils.retarget()` heeft randgevallen** (proportieverschillen, off-by-one in `retargetClip`)
  → test retargeting per personage. **WebGPU/TSL-translucent-SSS is nieuw** → houd een WebGL2-fallbackpad klaar.
- **Dier-schofthoogtes in de schaaltabel (§C1) zijn indicatief** → verifieer tegen het dieren-rapport
  voordat scènes definitief geschaald worden.

### 13j. Wat hiervan nu Design is vs. later Code
- **Nu (Design):** likeness-correcties op `humanoid.js` (13d), groen-hazel iris + wimpers, de
  oog-laag-spec (§12) in `specs.js` per dier invullen, gestileerde catchlight-ogen op de ranger.
- **Later (Code):** MakeHuman/Mixamo-cast, ARKit-blendshape-rig + blink/saccade/look-at-systeem,
  twee-laags refractief oog voor platen, Ready-Player-Me-integratie, SSS-huid op doelhardware.

---

## 14. Realisme-pass geprobeerd → mesh-audition-harness gebouwd (`Ranger Audition.html`, jun 2026)

> **Doel van de thread:** Alvah van stylized → realistisch door het **procedurele primitievenfiguur
> te vervangen door een echte mesh-kop** (handoff §13d-target + foto's 1000152315–320). Conclusie:
> de mesh-swap kan **niet in de Design/in-browser-fase** voltooid worden bij gebrek aan een laadbare,
> geschikte asset → het thread-deliverable is de **audition-harness** die de handoff zelf als fallback
> noemt. De procedurele Alvah in `Veluwe 3D.html` blijft de beste in-app stand-in (ongewijzigd).

**Wat in-browser laadt (geverifieerd via een GLTFLoader-probe, CORS/raw-host):**

| Kandidaat | Bron / licentie | tris · rig · clips · morphs | Bruikbaar als Alvah? |
|---|---|---|---|
| **CesiumMan** | Khronos Sample-Assets · **CC0** | ~4,7k · 19 botten · 1 clip · 0 morphs | Nee — volwassen man, ~7,5 koppen, haar/ogen in textuur. Pijplijn-validator. |
| **Soldier** | three.js examples · **licentie onduidelijk ⚠** | ~11k · 49 botten · Idle/Walk/Run · 0 morphs | Nee — volwassene, niet shippen. Alleen realistische-shading-referentie. |
| **RobotExpressive** | three.js · **CC0** (Laulhé/McCurdy) | ~3,2k · 43 botten · 14 clips · 3 morphs (Angry/Surprised/Sad) | Nee (robot) — maar de rig/clip-donor + bewijs van de `MORPH`-emotie-backend. |
| **RiggedFigure** | Khronos · **CC0** | ~260 · 19 botten · 1 clip | Nee — kale blockout; alleen schaal/koppen-ijk. |
| Ready Player Me demo-GLB | models.readyplayer.me | — | **`Failed to fetch`** → RPM moet je *genereren*; geen vaste demo-URL laadbaar. |

**Kernbevinding:** géén raw-host-bare CC0-mens is een **8-jarig kind** met Alvah's trekken. De
realistische mesh-swap vereist een **geauthorde asset** (Code-fase of door Floris aangeleverd).

**Deliverable — `Ranger van de Veluwe/Ranger Audition.html`** (zelfstandig, three 0.160, geen
afhankelijkheid van `stage.js`/`character.js`): een model-viewer die elke kandidaat toetst onder
- de **golden-hour-rig** (warme key laag-links + koele hemi-fill + soft shadow + RoomEnvironment-IBL),
- de **¾ overworld / front / profiel / hero close-up**-camera's (§A6/§12d),
- een **131 cm hoogte-ijk** + auto-rechtop-zetten van zijwaarts-geauthorde modellen (CesiumMan lag plat;
  fix = 'Y is de kleinste as ⇒ langste horizontale as omhoog draaien', niet 'langste as = verticaal',
  want een staande T-pose heeft armspan ≈ hoogte),
- een live **budget-HUD** (fps · draw calls · tris vs §13h),
- **clip-afspeler** (idle/walk/run, gecureerd) + **morph-emotes** waar aanwezig (robot → Surprised/Sad),
- de vier **referentiefoto's** + per-kandidaat **verdict-kaart** (likeness-score vs §13d-checklist,
  licentie, budget) + een inklapbare **Code-fase-aanbeveling**.

**Aanbeveling voor de Code-fase (staat ook in de harness-UI):**
1. **MakeHuman/MPFB (CC0)** → ~6-koppen kind-base, §13d-trekken sculpten → glTF → **Mixamo** auto-rig
   + idle/walk/run/point/wave (gedeeld humanoïd skelet → retarget gratis) → **ARKit-subset blendshapes**
   voor de bestaande `MORPH`-emotie-backend. Volledig CC0.
2. **Ready Player Me** — avatar afgesteld op de foto's (CORS-GLB, ARKit-morphs, ≤30k tris); moet
   gegenereerd worden (demo-URL gaf `Failed to fetch`); geen clips → retarget de gedeelde set.
3. Op de winnaar: **mesh-coupe haar** (vorm + normalmap) + **PBR-stylized SSS-huid** (§13e); gestileerde
   catchlight-ogen overworld, refractief alleen voor hero-platen.

**De harness is de doel-rig.** Lichting, camera's, hoogte-ijk, budget-poort en de `clip`/`morph`-haken
staan klaar — drop de gerigde GLB erin (en daarna in het `CharacterSpec`-contract van `specs.js`:
`clips:{idle,walk,run}`, `bones`, `axes`, `scale.targetHeight`, `emoties.*.morph`) → het erft alles.

**Niet gewijzigd:** `Veluwe 3D.html`, `stage.js`, `character.js`, `humanoid.js`, `specs.js` — de
procedurele §11/§13d-Alvah blijft de in-app stand-in tot de geauthorde mesh er is.

**Unblock vanuit Floris (snelste pad naar de échte swap):** maak een Ready-Player-Me-avatar afgesteld
op de foto's en lever de `.glb`-URL aan, óf upload een CC0/Royalty-Free kind-GLB — beide vallen direct
in deze harness en daarna in het spec-contract.

---

## 15. BESLISSING (jun 2026): 3D-modellering bevriezen → Design's echte waarde

> Aanleiding (Floris): *"voor mensen en dieren kunnen we bestaande repos importeren in Claude Code,
> dus dat kunnen we daar beter doen."* Klopt. §1/§13j/§14 zeiden dit al verspreid; hier is het als
> **harde regel** zodat geen thread meer procedureel-3D-geometrie polijst die Code wéggooit.

**De kernregel.** Procedureel 3D (`humanoid.js`-figuur, vacht, ogen, IK, haar-strengen) heeft twee
geldige functies en één val:
- ✅ **stand-in** om *feel/schaal/camera/licht/emotie-contract* te valideren vóórdat assets bestaan;
- ✅ **doel-spec** die de échte asset moet halen (de §13d-likeness + de procedurele Alvah van deze
  thread = precies die visuele referentie);
- ❌ **eind-geometrie** — elke procedurele vertex wordt weggegooid zodra een geriggede GLB landt.

→ **De procedurele Alvah/dieren zijn nu BEVROREN op "blockout/stand-in".** Geen verdere
realisme-jacht in-browser (Fase 2+ van §A9 = Code). De likeness van deze thread is "af genoeg" als
referentie; verder finetunen van haar-strengen/ogen/SSS is verkeerde-tool-werk.

**Verschoven naar de Code-handoff (niet langer Design-doorlopend):**
- Alle realistische **mens-/dier-meshes** + rigging/retargeting (MakeHuman/Mixamo, Quaternius/Khronos/
  ActorCore, Ready-Player-Me) — Code importeert echte repos/assets.
- **Haar-cards/strengen, SSS-huid, twee-laags refractieve ogen, vacht, IK foot-plant, blink/saccade/
  look-at-systemen** (§12c/§13c/§13e/§13f/§13h).
- **Draw-call-reductie / instancing / LOD / KTX2·Draco / asset-pijplijn / on-device-perf** — incl. de
  ~178-calls in `Veluwe Wereld 3D.html`. Géén reden meer voor Design om meshes met de hand te mergen.
- **Productie-`alvah-ef-v1`-schema, migratie, Astro-routing/repo, echte audio-samples, TTS-productie.**

**Al BESLOTEN door Design — klaar voor Code, niet heroverwegen:**
- Besturing (WASD/pijl + één interact-prompt + touch-d-pad) · golden-hour look + licht-rig-waarden
  (§C2) · camera-gedrag (rustige third-person, push-in-choreografie, reduced-motion) · de 5 EF-engines
  + content-schema · het emotie-contract (POSE/MORPH: kalm/alert/bang — de hook waar Code assets aan hangt)
  · het asset-contract (`CharacterSpec`: clips/bones/axes/scale/emoties; `Animal.model3d`) · §13d-likeness.

**Waar Claude Design écht in uitblinkt (kan NIET in Code — moet *gespeeld* worden):**
1. **Game-feel & moment-choreografie** — in-situ EF-push-in, prompt, pacing, nooit-beschamende
   feedback-timing, rij-gevoel.
2. **De 5 EF-engines als echte mini-games** + staircase-gevoel + autonomie (hint/makkelijker) — de IP.
3. **UX/IA/diegetische HUD** — computer=missiekeuze, prikbord=voortgang, wegwijzer=briefing, wayfinding.
4. **Content-datamodel & registry** — Area→Mission→Step→Animal, het skin-systeem, de schaalbaarheids-spine.
5. **Copy/toon/leesniveau/toegankelijkheid** — M3/E3-NL, audio-primair, voorlezen, reduced-motion, hit-targets.
6. **Art-directie als *doel*** — golden-hour palette/sfeer (al beslist + gevalideerd → Code bouwt ernaartoe).
7. **Verhaal/seizoen-boog-structuur + emotionele-veiligheids-gates.**
8. **Gevolg-*regels & -gevoel*** (voertuig-durability, ernst-dial, radio-overlay-toon, status-HUD).

**Voertuig-werk (volgende thread) valt hieronder = correct Design-nu:** het *gevoel* (heli vliegt vs
auto/motor op pad), de gevolg-*regels*, de nuchtere radio-overlay-copy, de voertuig-status-HUD,
checkpoints-zonder-wis — allemaal te *voelen*. Alleen de **echte voertuig-modellen + physics** schuiven
naar Code. Bouw voertuigen dus met lichte stand-in-vormen (zoals de huidige procedurele figuur:
bevroren, niet polijsten) en steek het budget in feel/UX/gevolg-loop.

---

*Bronnen: `3d-animal-animation-research.md` (visueel/animatie/techniek dieren),
`humans-full-animals-eyes-research.md` (mensen + ogen, mens én dier), `veluwe-research.md`
(ecologie/terminologie/toon), `design-spec.md` (feel/motion/reduced-motion), `HANDOFF.md` (architectuur
& content-registry), `plan.md` (schermflow). Geen feiten hier opnieuw afgeleid — dit document
verbindt alleen.*
