# Art-Direction & Technical-Artist Rapport — 3D-dierenset "Ranger van de Veluwe"

*Realtime-3D in de browser (Three.js / WebGL2 / glTF), top-down overworld + close-up "platen". Doel: zo realistisch mogelijk, in stappen opgebouwd. Kindvriendelijk, warm, niet eng. Doelgroep: 8-jarige met dyslexie.*

> **Scope:** Dit rapport behandelt UITSLUITEND visuele, animatie- en technische aspecten. Ecologie, gedrag, Nederlandse terminologie (frisling, rotte, zeug, spiegel, burcht, sprong, wissel etc.) en kindveiligheids-toon zijn reeds geverifieerd in een aparte kennisbank en worden hier niet herhaald. Eén leidend principe blijft overal gelden: **kindvriendelijke, niet-enge weergave** (geen agressieve slagtanden, geen "boze wolf", geen bloed/prooi) — realistisch maar warm en benaderbaar.

---

# DEEL A — OVERKOEPELEND: TECHNIEK & PIPELINE

## A1. Pipeline realtime-3D dieren in de browser

**Format:** glTF 2.0 / GLB is de standaard ("de JPEG van 3D"). Eén binair bestand met geometrie, PBR-materialen, skeletale animatie, morph targets. Gebruik `GLTFLoader` + `DRACOLoader` (mesh-compressie; volgens de Khronos Group press release van 15 feb 2018 is "in sample glTF models, up to 12X compression demonstrated with no change in visual fidelity") + `KTX2Loader` (Basis Universal texture-compressie, ~10× minder VRAM, blijft gecomprimeerd op de GPU).

**Poly-budget (per dier, on-screen, met meerdere dieren tegelijk op iPad/midrange laptop):**

| Niveau | Tris per dier | Toepassing |
|---|---|---|
| Overworld-LOD (top-down, klein) | 1.500–4.000 | hero-dier in overworld |
| Mid-LOD | 5.000–15.000 | dier dichtbij in overworld |
| Close-up "plaat" | 20.000–50.000 | story-moment, 1 dier in beeld |

**Scene-budget:** richt op ~50.000 tris totaal on-screen voor universele iPad/mid-range-compatibiliteit; ~50K is het veilige plafond voor 60 fps op toestellen van de afgelopen jaren. Mid-range toestellen laten frames vallen boven ~65K tris (flagship iPhone A15 haalt ~150K, maar daar mag je niet op mikken).

**Draw calls — de echte bottleneck:** mik op **<100 draw calls per frame** voor soepele 60 fps; boven 500 worstelt zelfs een krachtige GPU. Belangrijker dan triangle-count. Meet met `renderer.info.render.calls` en `stats-gl`.

**Texturebudget:** 512×512 tot 1024×1024 per map voor overworld-dieren; 2048 (hero/close-up) alleen waar nodig. KTX2: UASTC voor normal-maps/hero, ETC1S voor diffuse/secundair. Houd totale GLB **onder ~4 MB** inclusief textures voor snel laden.

**Optimalisatie-pijplijn:** `gltf-transform optimize model.glb output.glb --texture-compress ktx2 --compress draco`. Draco-decompressie draait in een Web Worker (blokkeert main thread niet). Texturedecompressie van PNG/JPEG vult VRAM volledig (200 KB PNG → 20+ MB VRAM); KTX2 voorkomt dit. Vermijd overdraw (gestapelde transparante vlakken) — dat is de échte mobiele killer, erger dan polycount.

**Renderer:** modern Three.js (r17x+) ondersteunt `WebGPURenderer` via `import { WebGPURenderer } from 'three/webgpu'` met **automatische WebGL2-fallback** (`await renderer.init()` vereist vóór eerste render). Per Apple Safari 26.0 Release Notes (released 15 september 2025): "Added support for WebGPU", standaard ingeschakeld op macOS Tahoe 26, iOS 26, iPadOS 26 en visionOS 26 — dus iPads op iPadOS 26 krijgen WebGPU, oudere blijven op WebGL2. Schrijf shaders in **TSL** (Three Shading Language) → compileert naar zowel WGSL (WebGPU) als GLSL (WebGL2). Dit dekt de iPad/WebGL2-eis terwijl je WebGPU-winst pakt waar beschikbaar.

## A2. Modellen verkrijgen — bronnen voor realistische Europese fauna

| Bron | Gratis/betaald | Licentie | Gerigd & geanimeerd | Realisme | Concrete vindbare opties |
|---|---|---|---|---|---|
| **Quaternius** (quaternius.com, poly.pizza) | Gratis | **CC0** (geen attributie) | Ja — Idle/Walk/Run/Jump + meer | Stylized low-poly | "Ultimate Animated Animal Pack" (12 dieren, 12+ animaties incl. Deer, Stag, Fox, Wolf); "Animated Animal Pack"; FBX/OBJ/glTF/Blend |
| **Sketchfab** | Gratis + betaald | CC-BY / CC0 / Royalty-Free per model | Wisselend | Stylized → fotorealistisch | WildMesh 3D / AnimalMesh 3D (realistische deer/boar, vaak 145 animaties — let op: gratis versie = personal use, commercieel via Fab/Patreon); "Low World Forest Animals Kit" (rigged: Boar 1016 tris, Deer 1138, Fox 1088, Stag 1600, Wolf 1556 — 36 animaties, royalty-free) |
| **CGTrader** | Betaald + gratis | Royalty-Free / Editorial | Filter op rigged/animated | Tot fotorealistisch | 6.767 deer-, 19.729 wild-boar-, 1.434 squirrel-modellen; "CGT Standard" = import-ready geverifieerd |
| **TurboSquid** | Betaald | Royalty-Free / Editorial | Wisselend | Tot fotorealistisch | Grote bibliotheek hertachtigen/roofdieren; let op "Editorial Use Only"-licenties (niet bruikbaar in product) |
| **Fab** (Epic) | Gratis + betaald | Commercieel | Ja | Mid → hoog | "Ultimate 3D Animal Pack 80+" (incl. Badger, Boar, Deer, Doe, Fox, Squirrel) |
| **Free3D / OpenGameArt** | Gratis | Wisselend (let op!) | Wisselend | Laag → mid | Quaternius-mirrors (CC0) |

**Belangrijke licentie-waarschuwing voor de coding agent (Claude Code):** veel "gratis" Sketchfab-realistische dieren (WildMesh/AnimalMesh) zijn **alleen personal use**; commercieel gebruik vereist aankoop via Fab/Patreon. CC0 (Quaternius) en expliciete Royalty-Free (Sketchfab Store) zijn veilig voor een educatief product. Controleer per asset de licentie en bewaar bewijs (screenshot licentietekst + URL + datum).

**Per-dier vindbaarheid:** edelhert/ree/zwijn/wolf/vos zijn ruim beschikbaar (alle marketplaces). **Das, eekhoorn, adder, zandhagedis, heikikker** zijn schaarser in realistische gerigde vorm — verwacht hiervoor: óf Quaternius-stylized als basis, óf losse aankoop (CGTrader/Sketchfab Store), óf zelf riggen vanuit een statisch realistisch model. De heikikker-metamorfose-stadia bestaan vrijwel zeker niet kant-en-klaar → custom maken (zie B9).

**Aanbeveling start-set:** begin met **Quaternius CC0** (alle 9 dieren benaderbaar of vervangbaar, juridisch schoon, klein) als stylized stap-1, en koop/maak realistische upgrades per dier los.

## A3. Rigging — quadruped-skelet

**Standaard game-quadruped:** geen vast aantal; een schoon deform-skelet loopt ~**45–67 botten** (ter referentie: UE5 humanoid = 67). Een gestroomlijnd rig van 45–55 botten presteert beter en retarget schoner.

**Botketens (Blender Rigify "Basic Quadruped"/"Wolf"/"Cat"/"Horse" metarigs):**
- **Spine-keten:** spine, spine.001…003, met nek (2 botten) en kop als laatste; tail als verlenging van de super-spine.
- **Voorpoot:** scapula/schouder → humerus (bovenarm) → onderarm → carpus/pols → poot/hoef (tenen).
- **Achterpoot:** heup/femur → tibia → hak/tarsus (de naar-achteren-buigende "knie" = eigenlijk de hiel, hoog op de poot) → poot.
- **Oren, kaak, klauwen/tenen, staart** = aparte kleine ketens.
- Rigify-prefixen: `ORG-` (origineel), `MCH-` (mechanisme), `DEF-` (deform = skinnt de mesh; dit subset exporteer je naar de game).

**Verschillen per diertype:**
- **Hoefdier (edelhert/ree/zwijn) — unguligrade:** lopen op hoefpunten; metacarpalen/tarsalen vergroeien tot lange "pijpbeen" (cannon bone); weinig laterale poot-flex; **lange nekketen** (extra nekbotten).
- **Roofdier/canide (wolf/vos) — digitigrade:** lopen op tenen, hak/pols permanent geheven; flexibele rug. Rigify Wolf/Dog-metarig = "gold standard" voor quadrupeds. Vos = canide-rig, kleinere proporties.
- **Knaagdier (eekhoorn):** flexibele rug, grote **staartketen** (spline-IK voor de pluim), grijpende voorpoten (vingerbotten). Geen kant-en-klare Rigify-rodent-metarig; bouw uit quadruped/cat + extra ketens.
- **Slang (adder) — ledemaatloos:** één lange botketen kop→staart met **Spline-IK-constraint** langs een Bezier-curve; ~20–40 botten (meer = vloeiender). Controle-curve in aparte armature.
- **Kikker (heikikker):** 4 poten, grote vouwende achterpoten (femur → tibiofibula → tarsus → voet); twee gestapelde IK-constraints voor volledige "concertina"-vouw bij de sprong.

**Tools (Mixamo doet GEEN dieren!):**
- **Blender Rigify** — gratis, ingebouwd; Quadruped/Cat/Wolf/Horse/Bird metarigs. Let op: voor game-export het DEF-deform-subset apart afhandelen.
- **Auto-Rig Pro** ($40, bevestigd via officiële artell-listing en Blender Artists-gebruikers) — "Multi-Ped" type, 3-bots digitigrade-IK, **Remap**-retargeting; exporteert **FBX + glTF**.
- **Cascadeur** (gratis tier + Pro) — physics-based; quadruped-support sinds 2025.3 (alpha, cat/dog-georiënteerd, Pro vereist); exporteert FBX + **GLB/glTF**.
- **AccuRig/ActorCore (Reallusion)** — **alleen bipeds**, géén quadrupeds (officieel: geen plannen voor dieren). Niet bruikbaar voor deze set.
- **DeepMotion / Radical** — alleen menselijke markerless mocap, geen dieren.

## A4. Animatie-aanpak

**Bestaande dier-animatiebibliotheken:**
- **Quaternius CC0** — kant-en-klare Idle/Walk/Run/Jump/Eat-clips per dier in glTF.
- **Truebones "FBX/BVH ZOO"** — 75+ geanimeerde dieren (FBX + BVH), royalty-free; meest directe ready-made bron. Let op: exacte dekking van adder/das/ree niet gegarandeerd — inspecteer pack-inhoud vóór gebruik.
- **Sketchfab Store / Fab** — per-dier rigged+animated packs.

**Bruikbare mocap voor dieren:** beperkt. Truebones (library, geen capture-tool), QUADRIMA (hond-gerichte AI-quadruped-data). Voor de meeste dieren: keyframe-animatie of retargeting binnen dezelfde familie.

**Retargeting (Blender):** werkt via **bot-naam + hiërarchie-matching**; betrouwbaar alleen tussen vergelijkbare skeletten (wolf→vos makkelijk; edelhert→ree makkelijk; mens→quadruped slecht). Tools: **Rokoko Studio Live plugin** (retargeting is **gratis**, "Build Bone List", beide armatures in zelfde pose), **Auto-Rig Pro Remap** (universeel, verschillende botnamen/oriëntaties, geschikt voor Truebones-BVH). **Praktijk:** standaardiseer botnamen per familie (canide-rig gedeeld door wolf+vos; ungulaat-rig door edelhert+ree+zwijn) → walk/trot-cycli transfereren schoon.

**Procedurele technieken:**
- **IK foot-planting** tegen "ice-skating": voeten op grond verankeren via IK terwijl heup beweegt.
- **Secundaire beweging:** oren/staart na-zwaaien via bone-chains met vertraging (spring/lag). Vooral cruciaal voor vos-/eekhoornpluimstaart en edelhert-oren.
- **Ademhaling in rust:** subtiele bone-scale van ribbenkast of blendshape, ~0.2–0.4 Hz; bij kikker keel-pulsatie.
- Three.js `AnimationMixer` blendt/crossfade't clips (idle↔walk↔run).

## A5. Realistische GANGEN — voetval-patronen & timing

Quadruped-gangen op volgorde van snelheid: **walk → amble → trot → pace → canter → gallop** (Animator Notebook, Muybridge-traditie).

**Voetval-volgorde (één cyclus = fase 0–1; LA=linksachter, LV=linksvoor, RA=rechtsachter, RV=rechtsvoor):**

| Gang | Type | Voetval-volgorde | Fasering | Suspensie | Body-bob & kop/staart |
|---|---|---|---|---|---|
| **Walk** | 4-beat | LA→LV→RA→RV (lateraal) | 0.0, 0.25, 0.5, 0.75 | nee | gering verticaal, kop knikt licht per stap |
| **Trot** | 2-beat diagonaal | diagonale paren: LV+RA, dan RV+LA | LV/RA=0.0, RV/LA=0.5 | korte zweef tussen beats | matig verticaal, kop stabiel |
| **Pace** | 2-beat lateraal | zijdelingse paren: LV+LA, dan RV+RA | links=0.0, rechts=0.5 | korte zweef | zijwaartse rol (waggel) |
| **Canter** | 3-beat | RA → (LA+RV) → LV (lead) | RA=0.0, LA+RV=0.33, LV=0.66 | één zweef na lead-voorbeen | duidelijke golf, kop wipt |
| **Gallop** | 4-beat | RA→LA→RV→LV (transverse), equidistant | ~0.0, 0.1, 0.5, 0.6 | volledige zweef bij ingetrokken voorbenen | max romp-rek/compressie, kop+nek pompen |

Trot = diagonaal paar (LV+RA samen). Gallop: twee achterbenen raken bijna samen (één split-second eerder), dan twee voorbenen; grootste romp-rek-compressie, tightste compressie bij optillen voorbenen.

**Per diergroep:**
- **Hoefdier:** walk + trot als hoofdgangen; edelhert = "loper" (rug horizontaal/gestrekt), galop bij vlucht. **Ree = "springer"** (rug plooit, verende sprongen i.p.v. vlakke galop). Zwijn = drafje, gedrongen waggel.
- **Roofdier:** wolf = stap/telgang (11–20 km/u, kop+hals gestrekt vooruit, langere stap dan hond), efficiënte draf als reisgang, galop 40–50 km/u. Vos = lichte, sluipende trot; muis-sprong.
- **Knaagdier (eekhoorn) — bounding:** beide voorpoten samen neer, dan achterpoten ervóór langs (sprong-galop/viersprong); in spoor staan achterpoten vóór de voorpoten. Staart golft tegenfase.
- **Slang (adder) — lateral undulation:** golven van laterale buiging propageren kop→staart in "S"-vorm; duwt tegen vaste punten; identiek patroon op land en zwemmend. Geen poten.
- **Kikker (heikikker):** **sprong** (synchrone afzet beide achterpoten, gestrekt in vlucht, voorpoten vangen landing) + **zwemslag** (symmetrische breaststroke-kick met zwemvliezen).

## A6. Top-down / 3-4 camera

- **Perspectief (PerspectiveCamera) met lage FOV (~35–45°) en hoge schuine hoek** verdient de voorkeur boven puur orthografisch voor een Pokémon-achtige 3-4 overworld: behoudt subtiele diepte/parallax en laat realistische modellen herkenbaar lezen. Orthografisch (OrthographicCamera) geeft consistente grootte ongeacht afstand (RTS-stijl) — handig voor strakke tile-uitlijning, maar plat.
- **Ideale hoek:** ~45–60° neerkijkend (3-4 view). Hoger = meer "echte" top-down (rugsilhouet telt), lager = meer profiel-leesbaarheid van de kop.
- **Leesbaar van boven:** zorg dat rug-tekening/silhouet de soort verraadt (geweivorm edelhert, streeppyjama frisling, zwart-wit koptekening das) — kantel kop/gewei licht zodat kenmerken van bovenaf leesbaar blijven.
- **Schaduwen top-down:** `DirectionalLight` gebruikt een **OrthographicCamera** voor parallelle schaduwen (zon). Stel `shadow.camera` frustum-grenzen strak (±8 rond personage), `near/far` smal, `mapSize` 1024–2048 (of 512 voor low-end). Strakke frustum geeft scherpere schaduw dan alleen resolutie verhogen. Een zachte slagschaduw "grondt" het dier — cruciaal in top-down om te voorkomen dat het lijkt te zweven.

## A7. Lighting "golden hour" & PBR

- **Key:** warme `DirectionalLight` (kleur ~#FFCF8F→#FFB870) laag vanaf links, lange zachte schaduwen.
- **Fill:** koele `HemisphereLight` (sky ~#A8C4E8 koel, ground ~#7A6347 warm) + lage ambient voor blauwige schaduwkern (warm licht ↔ koele schaduw).
- **Soft shadows:** `PCFSoftShadowMap`; bias tweaken tegen schaduw-acne.
- **PBR-materialen:** `MeshStandardMaterial`/`MeshPhysicalMaterial` met baseColor + roughness + normal + AO. Vacht hoog roughness (0.7–0.9); natte neus/ogen laag roughness + clearcoat; schubben (adder/hagedis) medium roughness + normal-map voor schub-reliëf.
- **Realtime vacht — kosten/baten:**

| Techniek | Kosten | Baten | Browser-advies |
|---|---|---|---|
| **Textured mesh** (vacht in baseColor + normal/AO) | Laagst | Geen extra draw cost; werkt overal | **Standaard voor overworld + iPad** |
| **Alpha-card "fins/strips"** (haarbundels als kaartjes) | Middel (overdraw!) | Silhouet-pluis (eekhoornstaart, oorpluimen) | Spaarzaam; alpha-overdraw is mobiele killer |
| **Shell-fur** (gestapelde mesh-lagen) | Hoog (N× geometrie + overdraw) | Echte volumetrische pluis | Alleen close-up/hero op desktop/WebGPU |

Aanbeveling: textured-mesh als basis; **fins/shells alleen in close-up** voor staart/oorpluim/manen.

## A8. Performance & fallback

- **LOD:** Three.js `LOD`-object met 2–3 niveaus (zie A1-tabel); switch op afstand.
- **Instancing:** `InstancedMesh` voor herhaalde props (bomen, gras) → 1 draw call i.p.v. duizenden. `BatchedMesh` voor verschillende geometrie met gedeeld materiaal.
- **Draw-distance / frustum culling:** automatisch; chunk-loading voor grote overworld.
- **Reduced-motion-pad:** respecteer `prefers-reduced-motion` (een aanzienlijk deel van de gebruikers): zet idle-micro-animaties/camera-bob uit, houd alleen essentiële beweging. Belangrijk voor een toegankelijkheidsgerichte 8-jarige met dyslexie.
- **Low-end fallback:** bij weinig GPU → **billboard/sprite** (vooraf gerenderde 8-richtingen-sprite van het 3D-model) i.p.v. realtime mesh; of laagste LOD + uitgeschakelde schaduwen. `pixelRatio` cappen op 2.
- **Loading:** `<link rel="preload" as="fetch" crossorigin>` voor GLB/KTX2; toon eerst low-res (`low.glb`), laad high-res async; placeholder-box tijdens laden; `LoadingManager` voor progress. Dispose ongebruikte geometrie/material/texture (anders memory leaks / ImageBitmap-lek).

## A9. "Realisme in stappen"-ladder

| Stap | Mesh | Textuur | Animatie | Licht/Shading | Wanneer |
|---|---|---|---|---|---|
| **0. Blockout** | Quaternius CC0 low-poly | vlakke kleur | CC0 walk/idle | flat + 1 dir-light | prototype, gameplay-test |
| **1. Stylized** | low-poly, betere proporties | handgeschilderde baseColor + AO | walk/trot/idle/eat | golden-hour key+hemi, simpele schaduw | eerste speelbare versie |
| **2. PBR-stylized** | mid-poly | baseColor+roughness+normal | + emotie-standen, secundaire beweging | PBR, soft shadows, IK foot-plant | polish |
| **3. Realistisch** | high-poly→genormaalmapt low-poly | volledige PBR + detail-normals | gang-blends, breathing, blendshapes | clearcoat ogen/neus, fins voor pluis | hero/close-up |
| **4. Fotorealistisch (close-up only)** | 30–50K tris | 2K–4K, SSS-huid | mocap/keyframe-fijn | shell-fur, SSS, WebGPU-TSL | platen/story-moment |

Bouw zo dat elke stap dezelfde rig/skeletnamen + dezelfde animatieclip-namen behoudt → upgraden = mesh/texture vervangen zonder code te herschrijven.

---

# DEEL B — PER DIER

> Subkoppen a–j per dier. Maten uit Zoogdiervereniging / Vereniging Het Edelhert / RAVON / Natuurmonumenten e.a.

## B1. EDELHERT (Cervus elaphus)

**a. SILHOUET & PROPORTIES.** Grootste landzoogdier van NL. Schofthoogte ♂ 104–124 cm, ♀ 90–110 cm; kop-romp ♂ 180–210 cm, ♀ 150–180 cm; staart ~20 cm (12–15 zonder haar); gewicht ♂ 95–160 (max ~200) kg, ♀ 55–80 kg. "Loper": rug horizontaal/gestrekt. Lange krachtige nek, in herfst ♂ met manen + verdikte hals. Lange spitse kop, diepe romp, lange slanke poten. **Instant herkenbaar:** het vertakte gewei (alleen ♂) + statige lange-nek-silhouet. Kalf: gevlekt, klein. Hinde (♀): geen gewei, slanker.

**b. VACHT/HUID/KLEUR.** Zomer: roodbruin ("roodwild"). Winter: grijsachtig bruin; rui begint bij kop/poten/voorlijf (sep–dec wintervacht, mei–aug zomervacht). Buik wit; spiegel (staartstuk) wit/roomkleurig, begrensd door donkerbruine band. Jonge dieren gevlekt bruin.

**c. KOP & GEZICHT.** Grote van binnen behaarde oren, grote donkere ogen, spitse snuit met donkere neus. Kindvriendelijk: grote zachte ogen, ronde oren benadrukken; gewei warm/afgerond tonen (geen scherpe dreiging).

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Burlen:** kop omhoog/achterover, hals gestrekt, mond open — de iconische bronstpose. Toon als trots/zingend, niet agressief.

**e. GANGEN.** Walk (statig, kop knikt licht), trot, galop bij vlucht (rug blijft relatief gestrekt — "loper"). Gewei achterover bij rennen door bos.

**f. IDLE.** Grazen (kop omlaag), herkauwen (kaak-cyclus), oren draaien, staart-flick, flank-ademhaling.

**g. EMOTIE-STANDEN.** KALM: kop laag, oren ontspannen, grazend. ALERT: kop hoog, oren naar voren/draaiend, bevroren. BANG: kop hoog, lichaam gespannen, wegdraaien/galop, spiegel opvallend.

**h. TOP-DOWN LEESBAARHEID.** Gewei-vorm (vertakking) + grote roodbruine romp + lange nek. Gewei iets opzij kantelen zodat vertakking van bovenaf leest.

**i. CLOSE-UP "PLAAT".** Burlende hert in ochtendmist, kop omhoog, adem-stoom, golden-hour rim-light op gewei. Sereen-episch.

**j. REFERENTIE-ZOEKTERMEN.** "Cervus elaphus stag bugling", "edelhert burlen Veluwe", "red deer antler velvet", "red deer summer coat", "rode hert hinde kalf".

**SPECIALE AANDACHT — Gewei-cyclus (animeerbaar als jaarcyclus-stage-set):**

| Fase | Periode | Uiterlijk | Visuele noot |
|---|---|---|---|
| Afwerpen | feb–mrt (oud), mrt–mei (jong) | gewei valt af, "zegel" eerst rood/bloederig | evt. één stang (asymmetrisch) |
| Bastgroei | direct na afwerp, ~4,5 mnd | fluweelzachte grijze "bast"-huid, ronde einden | Per Li et al. (Nature/Cell Death & Differentiation, 2023, "Deer antlers: the fastest growing tissue with least cancer occurrence") is gewei "the fastest animal growing tissue (2 cm/day)" — de snelst groeiende botstructuur onder gewervelden; doorbloed, zacht, warm |
| Verbening | tot ~juli | gewei hard/verkalkt | |
| Vegen | aug | bast jeukt/sterft af, hert schuurt langs boompjes; punten blank, gewei donker | huidflarden, niet bloederig tonen (kindvriendelijk) |
| Volgroeid/bronst | sep–okt | hard gewei, burlen | hoogtepunt |

Spitser (1-jarig ♂) = onvertakt; ouder = meer enden tot 8–12 jaar, daarna terugzettend. Vorm = genetisch, individueel herkenbaar.

## B2. WILD ZWIJN (Sus scrofa) + FRISLING

**a. SILHOUET & PROPORTIES.** Schofthoogte 65–95 cm; kop-romp ♂ 139–178 cm, ♀ 132–167 cm; staart 15–29 cm; gewicht ♂ 60–135 kg, ♀ 45–128 kg (NL meestal ≤120 kg). Wig-vormig: gedrongen romp, korte nek, langwerpige kop eindigend in **wroetschijf**; achterpoten korter dan voorpoten → hoogste punt op schoft. **Instant herkenbaar:** wigsilhouet + wroetsnuit + borstelige rug. Frisling: klein, gestreept. Keiler (♂): forser, slagtanden — **kindvriendelijk: slagtanden klein/verborgen houden, geen dreiging.**

**b. VACHT/HUID/KLEUR.** Volwassen: donker borstelig (zwart-bruin), dikke ondervacht; winter langer/donkerder, ouderen grijzer. **Frisling ("pyjama"): okerkleurig/zwartbruin met overlangse goudgele strepen** (van voor naar achter over rug) — verdwijnt na 3–5 mnd, daarna roodbruin ("overloper"), na ~6 mnd donker.

**c. KOP & GEZICHT.** Kleine ogen (slecht zicht), brede rechtopstaande behaarde oren, lange snuit + wroetschijf, propvol tastzenuwen. Kindvriendelijk: ronde oogjes, vriendelijke snuit, geen agressieve tanden.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Wroeten:** kop omlaag, snuit in de grond duwend/wroetend, achterwerk omhoog. Dé "dit is een zwijn"-pose.

**e. GANGEN.** Drafje (gedrongen waggel door korte nek), galop bij vlucht; kan tot 15 km afleggen. Kop laag-vooruit.

**f. IDLE.** Wroeten, snuit-snuffel, oren-flick, modderbad-schud, staart-pluim-zwiep.

**g. EMOTIE-STANDEN.** KALM: wroetend, ontspannen. ALERT: kop omhoog, snuit omhoog snuivend, oren naar voren, bevroren. BANG: wegrennen (waggel-galop), rotte sluit aan.

**h. TOP-DOWN LEESBAARHEID.** Donkere wigvorm + borstelrug; frisling-strepen van bovenaf zichtbaar (sterk herkenningspunt). Rotte (groep) als cluster leest goed.

**i. CLOSE-UP "PLAAT".** Zeug met frislingen in ochtendlicht, wroetend; gestreepte biggetjes — schattig, warm.

**j. REFERENTIE-ZOEKTERMEN.** "wild boar rooting", "frisling streep pyjama big", "Sus scrofa piglet stripes", "wild zwijn Veluwe modderbad", "wild boar bristly coat winter".

## B3. REE (Capreolus capreolus) + REEKALF

**a. SILHOUET & PROPORTIES.** Kleinste inheemse hert. Schofthoogte 60–90 cm; lichaamslengte ~95–135 cm; gewicht 15–35 kg. Slank, fijn, **"springer"** (rug plooit en springt). Geen zichtbare staart. ♂ (bok): bescheiden gewei max ~25 cm, gepareld. ♀ (geit): geen gewei. **Instant herkenbaar:** compact sierlijk silhouet + grote oren + opvallende witte spiegel, geen staart. Reekalf: witte vlekken.

**b. VACHT/HUID/KLEUR.** Zomer: oranje-/roodbruin (fel). Winter: bruingrijs, dikker/wolliger, relatief kleine kop. **Spiegel (achterwerk wit, zet uit bij gevaar):** ♂ niervormig, ♀ hartvormig met "schortje" (haarpluk tussen achterpoten). Zomer spiegel kleiner/geliger. **Reekalf: donkere + lichte vlekken op vacht** (tot ~6 mnd). Donkere neus, witte kin.

**c. KOP & GEZICHT.** Grote ronde ogen, grote beweeglijke oren, zwarte neus + witte kin, fijne snuit. Van nature al "schattig" — behoud grote ogen/oren, klein gewei.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Alert-stand:** kop hoog, grote oren gespitst naar voren, lichaam bevroren, spiegel opgezet — dé "ree"-pose. Verende sprong als handtekening-beweging.

**e. GANGEN.** Springer: verende sprongen (rug plooit), korte trot, schichtige vlucht met spiegel-flash. Niet de vlakke "loper"-galop van edelhert.

**f. IDLE.** Knabbelen (selectief, "knabbelaar" niet grazer), oren draaien constant, kop-omhoog-check, flank-ademhaling.

**g. EMOTIE-STANDEN.** KALM: knabbelend, oren ontspannen. ALERT: kop hoog, oren naar voren, spiegel licht op, bevroren. BANG: spiegel maximaal opgezet (waarschuwt soortgenoten), verende vlucht, blaffen.

**h. TOP-DOWN LEESBAARHEID.** Witte spiegel = sterkste top-down-marker (zet uit bij vlucht). Compact roodbruin lijf + grote oren. Spiegelvorm (hart/nier) onderscheidt sekse.

**i. CLOSE-UP "PLAAT".** Reegeit met gevlekt kalf in voorjaarsgras, oren gespitst, zachte ochtenddauw. Teder.

**j. REFERENTIE-ZOEKTERMEN.** "roe deer spiegel rump patch", "reekalf white spots fawn", "Capreolus capreolus alert ears", "ree zomervacht roodbruin", "roe buck antlers velvet".

## B4. WOLF (Canis lupus)

**a. SILHOUET & PROPORTIES.** Schofthoogte 65–80 cm; kop-romp 100–150 cm (range 80–160); staart 30–50 cm (~⅓ lichaamslengte); gewicht ♂ ~45 kg / ♀ ~40 kg (range 18–50). Grote brede kop, breed voorhoofd, relatief **korte oren** ver uiteen, hoge smalle borstkas, langere romp, lange krachtige poten. **Volle hangende staart met zwarte punt** (in rust omlaag — onderscheid met hond die staart opkrult). **Instant herkenbaar:** rechte rug + hangende borstelige staart + lange poten + krachtig-maar-niet-monsterlijk. **Géén sprookjeswolf!**

**b. VACHT/HUID/KLEUR.** Weinig contrastrijk **beige- tot rossig-bruin**, grijze bovenkant, **donker zadelvormig patroon op de rug**, lichte vlek aan beide zijden van de hals, wit rond de bek. (Europese grijze wolf — niet egaal grijs/zwart van Amerikaanse beelden.)

**c. KOP & GEZICHT.** Contrastrijke kop ("clownsmasker"): bleke wang-onderzijde, duidelijke zwarte liprand, lichte binnen-oren met donkere rand, schuine amandelvormige (vaak gele) ogen, korte snuit, korte afgeronde oren ver uiteen. Kindvriendelijk: zachte ogen, gesloten/ontspannen bek (geen ontblote tanden, geen grauw).

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Kop-tilt** (nieuwsgierig schuin houden) = warme, niet-enge handtekening. Howl-houding: zittend/staand, kop omhoog, mond rond — als zingen, sereen.

**e. GANGEN.** Stap/telgang (11–20 km/u, kop+hals gestrekt vooruit, langere stap dan hond), efficiënte draf als reisgang, galop 40–50 km/u. Staart hangt stabiel (beweegt weinig).

**f. IDLE.** Zit/lig, oren-draai, kop-tilt, gaap, staart laag, flank-ademhaling, sociale blik naar roedel.

**g. EMOTIE-STANDEN (lichaamstaal, niet-eng):** KALM: ontspannen houding, staart laag/neutraal, oren neutraal, zachte ogen. ALERT: kop hoog, oren naar voren, lichaam stil-aandachtig, staart horizontaal. BANG/onderdanig: lichaam laag, staart ingetrokken, oren plat, blik afgewend (toon kwetsbaar, niet dreigend).

**h. TOP-DOWN LEESBAARHEID.** Grijs-beige langwerpig lijf + donker zadel op rug + dikke hangende staart. Zadelpatroon van bovenaf benadrukken; kop-breedte vs spitse vos onderscheiden.

**i. CLOSE-UP "PLAAT".** Wolf met kop-tilt in golden-hour, zachte gele ogen, Veluws bos/heide achter. Nieuwsgierig & warm, niet dreigend.

**j. REFERENTIE-ZOEKTERMEN.** "European grey wolf saddle marking", "wolf head tilt", "Canis lupus Veluwe", "wolf body language relaxed", "wolf tail hanging black tip".

## B5. VOS (Vulpes vulpes)

**a. SILHOUET & PROPORTIES.** Schofthoogte 35–40 cm; kop-romp 50–80 cm; staart 28–54 cm; gewicht 5–8 kg (tot ~12). Laagbenig, langgerekt lijf, lange dikke ruige **pluimstaart** (vaak witte punt). **Instant herkenbaar:** rossig + spitse snuit + grote puntoren + lange pluimstaart.

**b. VACHT/HUID/KLEUR.** Rood- tot bruingrijs; rug donkerder dan flanken; buik wit/staalgrijs; **oren achterzijde zwart**, onderbenen ("sokken") zwart; bovenlip + bef wit; vaak witte staartpunt. Winter dikker/grijzer.

**c. KOP & GEZICHT.** Slanke zwart-witte snuit, puntige rechtopstaande oren, amberkleurige ogen met **verticale (kat-achtige) pupil**, soms donkere "traandruppel" op wang. Al charmant — behoud grote ogen, ronde wangen.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Muis-sprong ("mousing"):** hoog verticaal opspringen en met voorpoten+snuit vooruit-omlaag duiken op prooi. Dé vos-handtekening (geen bloed/prooi tonen — speels weergeven).

**e. GANGEN.** Lichte sluipende trot (laagbenig, lijkt te zweven), sprint achter prooi; bij snelle vlucht dekken achterpoten voorpoot-prenten.

**f. IDLE.** Zit met staart om poten gekruld, oren-draai, snuffel, kop-kantel (luisterend naar muizen onder grond), staart-zwiep.

**g. EMOTIE-STANDEN.** KALM: ontspannen zit, staart gekruld, oren neutraal. ALERT: oren naar voren, kop gekanteld luisterend, één poot opgetild, lijf laag. BANG: lijf laag, staart laag, oren plat, wegsluipen.

**h. TOP-DOWN LEESBAARHEID.** Rossig langwerpig lijf + grote pluimstaart (witte punt = top-down-marker) + spitse kop. Staart even groot als lijf — sterk silhouet.

**i. CLOSE-UP "PLAAT".** Vos in mousing-pose (mid-sprong) in besneeuwd/grazig veld, golden-hour, staart als balans-boog. Speels-elegant.

**j. REFERENTIE-ZOEKTERMEN.** "red fox mousing pounce", "Vulpes vulpes bushy tail white tip", "vos zwarte oren sokken", "red fox sitting tail curled", "fox vertical pupil amber eye".

## B6. DAS (Meles meles)

**a. SILHOUET & PROPORTIES.** Kop-romp 65–80 cm; staart 12–19 cm; gewicht 6,6–16,7 kg (zwaarder in najaar door vetlaag). Zwaargebouwd, gedrongen, laag bij de grond, korte poten, korte brede bossige lichte staart, lange gekromde graafnagels (voorvoeten). **Instant herkenbaar:** gedrongen grijs lijf + **zwart-wit gestreepte kop**.

**b. VACHT/HUID/KLEUR.** Rug/flanken grijs (zwart-witte haren), onderzijde + poten zwart, **kop wit met twee brede zwarte strepen** (vanaf achterhoofd over oren+ogen naar mondhoeken). Kleine wit-zwarte oren. Ouderen lichter.

**c. KOP & GEZICHT.** Grote brede kop, kleine zwarte ogen, kleine wit-zwarte oren, zwarte neus, het iconische zwart-wit strepenmasker. Kindvriendelijk: ronde vriendelijke ogen, het masker is van nature al "knuffelig".

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Graven:** voorlijf laag, krachtige voorpoten met lange nagels grond uitwerpend bij burcht-ingang. Dé das-handtekening. Snuffelend met neus laag (regenwormen zoeken in kort gras).

**e. GANGEN.** Sjokkende waggel-loop (laag, gedrongen), trippel-draf; geen snelheidsdier. Kop laag, lijf deint zijwaarts.

**f. IDLE.** Snuffelen (neus laag), graven, krabben, zit-rust, oren-flick, flank-ademhaling.

**g. EMOTIE-STANDEN.** KALM: snuffelend/gravend, ontspannen. ALERT: kop omhoog, snuit snuivend, bevroren. BANG: terugtrekken in burcht, lijf laag.

**h. TOP-DOWN LEESBAARHEID.** Grijs gedrongen ovaal + zwart-wit kopstrepen (van bovenaf het sterkste herkenningspunt — kop iets kantelen). Compacte vorm vs slankere vos.

**i. CLOSE-UP "PLAAT".** Das bij burcht-ingang in schemerlicht, kop-masker frontaal, aarde-storthoop. Mysterieus-warm.

**j. REFERENTIE-ZOEKTERMEN.** "European badger face stripes", "Meles meles digging sett", "das zwart-wit kop Veluwe", "badger burcht entrance", "badger grey coat body".

## B7. EEKHOORN (Sciurus vulgaris)

**a. SILHOUET & PROPORTIES.** Kop-romp 21–25 cm; staart 14–22 cm; gewicht 230–415 g. Korte voorpoten, lange achterpoten, grote pluimstaart (~lichaamslengte), **oorpluimen** (in winter veel langer). **Instant herkenbaar:** rechtopzittend met grote pluimstaart over de rug + oorpluimen + noot in voorpootjes.

**b. VACHT/HUID/KLEUR.** Rug/staart rood(oranje) tot kastanje/donkerbruin; **buik wit** (steekt af). Winter donkerder/grijzer + langere oorpluimen. Zomer roder, korte oorpluimen.

**c. KOP & GEZICHT.** Grote donkere kraalogen, oorpluimen, kleine snuit met knaagtanden, lange tenen + scherpe nagels. Van nature maximaal "schattig" — grote ogen + pluimen benadrukken.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Zittend met noot in voorpootjes + staart als grote pluim over de rug** (Latijn: "schaduwstaart"). Plus staart-flick (signaal). Dé eekhoorn-pose.

**e. GANGEN — bounding.** Sprong-galop/viersprong: beide voorpoten neer, dan achterpoten ervóór langs; in spoor staan achterpoten vóór. Klimt spiraalsgewijs tegen stam, daalt met kop naar beneden. Staart golft tegenfase, als roer bij sprong.

**f. IDLE.** Zit-knagen aan noot/kegel, staart-flick, kop-schok-bewegingen (alert), oren-draai, snelle ademhaling.

**g. EMOTIE-STANDEN.** KALM: zittend etend, staart ontspannen over rug. ALERT: bevroren, kop omhoog, staart-flick, kraalogen wijd. BANG: spiraal-vlucht omhoog boom, indringend piepen, staart opgezet.

**h. TOP-DOWN LEESBAARHEID.** Klein rossig lijf + grote pluimstaart (grootste marker van bovenaf) + witte buik bij oprichten. Staart als komma-vorm.

**i. CLOSE-UP "PLAAT".** Eekhoorn rechtop op tak met noot, oorpluimen tegen golden-hour-licht, pluimstaart als gloeiende boog. Maximaal hartverwarmend.

**j. REFERENTIE-ZOEKTERMEN.** "red squirrel ear tufts winter", "Sciurus vulgaris holding nut", "eekhoorn pluimstaart rug", "red squirrel bounding leap", "rode eekhoorn zomervacht".

## B8. ADDER (Vipera berus) + ZANDHAGEDIS (Lacerta agilis)

### ADDER
**a. SILHOUET & PROPORTIES.** Zwaargebouwde slang, 50–60 cm. Verticale pupil. ♀ roodbruin, ♂ grijsbruin tot lichtgrijs. **Instant herkenbaar:** donkere **zigzag-streep** over de rug + relatief korte gedrongen bouw + driehoekige kop.

**b. VACHT/HUID/KLEUR (schubben).** Grondkleur ♂ grijs/grijsbruin, ♀ roodbruin; **karakteristieke donkere zigzag-band** over rug (kop→staart), donkere lijn over flanken. Gekielde schubben → matte, niet glanzende huid. PBR: medium roughness, normal-map met schub-patroon, donkere zigzag in baseColor.

**c. KOP & GEZICHT.** Driehoekig, verticale (kat-achtige) pupil, V/X-tekening op kop. Kindvriendelijk: zachte ronde oog-uitdrukking, gesloten bek, geen ontblote giftanden/tong-dreiging — nieuwsgierig i.p.v. dreigend.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **S-glide** (lateral undulation) + opgerolde zonnehouding (samengerold op heide in ochtendzon). Schuw-wegglijden bij verstoring = dé adder-handtekening.

**e. GANGEN.** Lateral undulation: S-golven kop→staart, duwend tegen vaste punten; geen poten. Traag in ochtend (opwarmen), sneller na opwarmen.

**f. IDLE.** Opgerold zonnend, tong-flick (snuiven), trage kop-hef, subtiele flank-ademhaling.

**g. EMOTIE-STANDEN.** KALM: opgerold zonnend, kop laag. ALERT: kop iets geheven, tong-flick, lijf gespannen. BANG: wegglijden (S-glide) in dekking — schuw, niet aanvallend.

**h. TOP-DOWN LEESBAARHEID.** **Zigzag-streep** is de absolute top-down-marker (van bovenaf perfect zichtbaar). S-vorm van het lijf leest direct als "slang".

**i. CLOSE-UP "PLAAT".** Opgerolde adder op zonnige heideplag, zigzag scherp, ochtenddauw, verticale pupil-detail. Stil-fascinerend, niet eng.

**j. REFERENTIE-ZOEKTERMEN.** "Vipera berus zigzag dorsal", "adder basking heather", "European adder male grey female brown", "adder vertical pupil head", "adder S-glide movement".

### ZANDHAGEDIS
**a. SILHOUET & PROPORTIES.** Grootste inheemse hagedis, 11–17 cm (max 20 met staart). Robuust, hoge kop, stompe snuit (♂ zwaardere kop). Vier poten + lange staart. **Instant herkenbaar:** forse hagedis met oogvlek-rijen op flanken + (♂ voorjaar) groene flanken.

**b. VACHT/HUID/KLEUR (schubben).** Doorgaans bruin/grijsbruin rug+staart; midden over rug witte lijn (vaak in streepjes uiteengevallen); donkere vlekken met lichte kern ("oogvlekken") op flanken. **♂ in voorjaar/paartijd: fel(smaragd)groene kop, flanken en buik** — dé blikvanger. ♀ bruin met lichte donker-omrande vlekjes, gele/crème buik. Juveniel: bruin met oogvlekjes. Middelste rugschubben smaller/gekield.

**c. KOP & GEZICHT.** Forse kop, stompe snuit, kleine alerte oogjes. Kindvriendelijk: levendige nieuwsgierige blik.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Razendsnel wegschieten** in dekking + opwarmend-zonnen op kale zandplek; ♂ groen tonend in baltshouding. Staart kan afgeworpen worden (autotomie) — kronkelt na (optioneel speels detail).

**e. GANGEN.** Snelle sprintjes met laterale lijf-golf + poten-loop (sprawling gait: poten zijwaarts, lijf slingert S-vormig tussen stappen), pauzes, kop-bob.

**f. IDLE.** Zonnen plat op zand, kop-bob, tong/snuit-snuffel, snelle flank-ademhaling.

**g. EMOTIE-STANDEN.** KALM: plat zonnend. ALERT: kop omhoog, lijf gespannen, klaar om te schieten. BANG: razendsnel wegschieten in heide/dekking.

**h. TOP-DOWN LEESBAARHEID.** ♂ groene flanken (voorjaar) = sterkste marker; anders oogvlek-rijen + bruin lijf + lange staart. Klein → relatief vergroten in overworld.

**i. CLOSE-UP "PLAAT".** ♂ zandhagedis fel groen op warme zandige heide-helling in voorjaarszon, oogvlekken scherp. Juweel-achtig.

**j. REFERENTIE-ZOEKTERMEN.** "Lacerta agilis green male spring", "sand lizard eye spots flanks", "zandhagedis Veluwe heide", "sand lizard basking sand", "sand lizard female brown pattern".

> **Gedeelde noot adder+zandhagedis:** beide profiteren van dezelfde schub-shader (tiled normal-map + scale-detail, geen vacht). Verschil in beweging: adder = pure spline-IK-undulatie zonder poten; hagedis = pootloop + lijf-undulatie + razend tempo. Beide schuw/wegglijdend bij verstoring.

## B9. HEIKIKKER (Rana arvalis) + VOLLEDIGE METAMORFOSE

**a. SILHOUET & PROPORTIES.** Middelgrote kikker, 6–8 cm (♀ tot 10, ♂ kleiner). **Iets spitse snuit** (onderscheid met bruine kikker), relatief korte poten, grote graafknobbel op achterpoot (~½ teenlengte). Uitpuilende ogen aan zijkant kop, klein trommelvlies (kleiner dan oog). **Instant herkenbaar:** spitse snuit + (♂ paartijd) blauwe kleur + lichte rugstreep.

**b. VACHT/HUID/KLEUR.** Buiten paartijd: geel-/licht-/roodbruin tot grijsbruin, vaak donkere flankvlekken + lichte lengte-rugstreep; buik wit. **♂ in paartijd (eind feb–begin apr, piek mrt): licht- tot felblauw.** Per Sztatecsny et al. (2012, PMC3496481, "Don't get the blues") verkleurt het mannetje "from a dull brown ... to a conspicuous blue", en "male blueness is maintained for a few days" (in de bestudeerde populatie duurde de paai slechts 3 dagen, 25–27 maart); ontstaat door lymfevocht onder de huid (zwelt licht op). ♂ heeft dan verdikte voorpoten + zwarte paringswratten (copulatieborstels) op duimen.

**c. KOP & GEZICHT.** Grote uitpuilende ogen, spitse snuit, brede bek. Van nature al "vriendelijk" — grote glanzende ogen benadrukken.

**d. SIGNATUUR-HOUDING & -BEWEGING.** **Sprong** (afzet met gestrekte achterpoten) + ♂ in blauwe baltshouding roepend ("wuob-wuob", als onderwater-leeglopende fles). Dé heikikker-handtekening = blauwe ♂.

**e. GANGEN.** Sprong (synchrone achterpoot-afzet, vlucht gestrekt, voorpoten vangen) + zwemslag (symmetrische breaststroke-kick met zwemvliezen achterpoten). Op land soms kruip-stapjes.

**f. IDLE.** Zit (keel-pulsatie = ademhaling, ~constante throat-flutter), oog-knipper, occasionele kop-draai; ♂ roepend met opgeblazen keel.

**g. EMOTIE-STANDEN.** KALM: zit, keel pulseert. ALERT: lijf gespannen, ogen wijd, klaar om te springen. BANG: wegspringen in water/dekking, duiken.

**h. TOP-DOWN LEESBAARHEID.** ♂ blauw (paartijd) = unieke marker; anders bruin lijf + rugstreep + spitse snuit. Klein → vergroten.

**i. CLOSE-UP "PLAAT".** Felblauw ♂ op veenmos/aan waterkant met spiegeling, eitjes/dril zichtbaar, voorjaars-ochtendlicht. Bijzonder & teder.

**j. REFERENTIE-ZOEKTERMEN.** "Rana arvalis blue male breeding", "heikikker blauw paartijd veen", "moor frog pointed snout", "heikikker dril eiklomp", "moor frog metamorphosis stages".

**SPECIALE AANDACHT — Volledige metamorfose (aparte animeerbare stage-set, ei→volwassen, voor een aparte metamorfose-scène):**

| Stadium | Periode | Vorm | Kleur | Animatie-noot |
|---|---|---|---|---|
| **1. Ei/dril** | mrt–apr | eiklomp (vuistgroot, 500–3000 eitjes), eitje 1,5–2 mm + gelei 6–8 mm | grijsbruin/donkergrijs boven, lichter onder | trillende klomp, drijvend op waterplant |
| **2. Larve/kikkervisje (vroeg)** | na 2–4 wk | bolvormig lijf + lange staart (staart ~1,5× romp, spits) | donker/zwartbruin | enkel staart-undulatie zwemmen, geen poten |
| **3. Kikkervisje + achterpoten** | groei | lijf groter, **achterpoten knoppen** verschijnen eerst | donkerbruin, buik lichter | staart-zwem + beginnende pootjes |
| **4. Vierpotig met staart** | ~4,5 cm, stopt met eten, teert op staart | 4 poten + krimpende staart, kop verbreedt | bruinend | overgang zwem→hup; staart krimpt zichtbaar (ideale blendshape) |
| **5. Juveniel kikkertje (froglet)** | eind mei–jun(jul) | 12–16 mm, staartloos, volwassen vorm | bruin, rugstreep verschijnt | verlaat water → land; eerste sprongetjes |
| **6. Volwassen** | 2–3 jaar later | 6–8 cm; ♂ paartijd blauw | zie b. | volledige sprong/zwem/roep-set |

Maak elk stadium als aparte mesh/morph-target-set met eigen schaal; verbind via de metamorfose-scène met crossfade/scale-morphs. Staart-krimp (stadium 4) ideaal als blendshape op één model i.p.v. mesh-swap.

---

# DEEL C — OVERKOEPELENDE VERGELIJKINGEN

## C1. SCHAALOVERZICHT (echte maten, met mens/ranger als referentie)

Ranger (volwassen mens) ≈ **175 cm** lang als ijkpunt.

| Dier | Schofthoogte/lijfhoogte | Lichaamslengte (kop-romp) | Staart | Gewicht | Relatief tot ranger (175 cm) |
|---|---|---|---|---|---|
| **Edelhert ♂** | 104–124 cm (schoft) | 180–210 cm | ~20 cm | 95–160 (max 200) kg | schoft tot ~heup/borst; met kop+gewei ~ooghoogte |
| **Wild zwijn ♂** | 65–95 cm (schoft) | 139–178 cm | 15–29 cm | 60–135 kg | schoft tot ~bovenbeen/heup |
| **Ree** | 60–90 cm (schoft) | 95–135 cm | (geen zichtb.) | 15–35 kg | schoft tot ~knie/dij |
| **Wolf** | 65–80 cm (schoft) | 100–150 cm | 30–50 cm | 40–50 kg | schoft tot ~dij |
| **Vos** | 35–40 cm (schoft) | 50–80 cm | 28–54 cm | 5–8 kg | schoft tot ~onder de knie |
| **Das** | ~25–30 cm (rughoogte) | 65–80 cm | 12–19 cm | 7–17 kg | tot ~mid-onderbeen |
| **Eekhoorn** | — (zit ~15–20 cm) | 21–25 cm | 14–22 cm | 230–415 g | tot ~enkel/scheen |
| **Adder** | — (dik ~2–3 cm) | 50–60 cm totaal | — | tot ~100+ g | uitgestrekt ~halve scheenlengte op grond |
| **Zandhagedis** | — | 11–17 cm (max 20 incl. staart) | ~⅔ totaal | enkele g | tot ~halve voetlengte |
| **Heikikker** | ~3–4 cm zithoogte | 6–8 cm (♀ tot 10) | — | enkele g | tot ~halve handlengte |

**Schaal-relaties voor proportie-check:** edelhert is veruit het grootst (schoft op menselijke borsthoogte); wolf ≈ vos ×~1,7 in schofthoogte maar veel zwaarder gebouwd; vos ≈ kleine herdershond; eekhoorn/adder/hagedis/kikker zijn "kleine" assets die in de overworld iets vergroot moeten worden voor leesbaarheid (anders subpixel/onleesbaar). Jonge varianten (frisling, reekalf, froglet) ~40–60% van de volwassen schaal; overloper-zwijn ~70%.

## C2. GEDEELD GOLDEN-HOUR-PALET (samenhang hele set)

**Lichtopzet (één gedeelde rig voor alle dieren — zie A7):**
- **Key (zon, laag links):** warm goud-oranje (~#FFCF8F→#FFB870), lange zachte schaduwen.
- **Fill (hemi):** koel hemelblauw van boven (~#A8C4E8), warm grond-bounce van onder (~#7A6347).
- **Schaduwkern:** koel-blauwig (complement van warm key) → "warme highlights, koele schaduwen".

**Hoe de vacht/huid reageert (gedeelde shading-noot):**

| Dier-kleurgroep | Warme highlight (zonzijde) | Koele schaduw (afgekeerd) |
|---|---|---|
| Roodbruin (edelhert zomer, ree zomer, vos, eekhoorn) | gloeiend goud-rood, rim-light op vacht-randen | koel kastanje-/paarsbruin in kern |
| Grijsbruin (edelhert/ree winter, wolf, das-grijs) | warm beige-goud op rug | blauwgrijze schaduw |
| Zwart/donker (zwijn borstel, das-strepen, adder zigzag) | warme bruine glans op borstelpunten | diep koel-blauwzwart |
| Wit (spiegel ree, das-kop, vos-bef, eekhoorn-buik) | warm crème-goud | helder koelblauw (sterkst contrast) |
| Groen (♂ zandhagedis voorjaar) | felgroen met gouden glans | koel smaragd-schaduw |
| Blauw (♂ heikikker paartijd) | helder hemelsblauw oplichtend | koel ultramarijn-schaduw |
| Schubben (adder/hagedis) | scherpe specular-glints op schubrand | koele micro-schaduw tussen schubben |

**Praktijk:** gebruik dezelfde environment-map/IBL (warme ochtend-HDRI, bv. Poly Haven) + dezelfde key+hemi-waarden voor alle dieren zodat de hele set als één wereld samenhangt. Rim-light (warm) vanaf links accentueert pluimstaart (vos/eekhoorn), oorpluimen, manen (edelhert) en silhouet — cruciaal voor herkenbaarheid én warmte. Voor close-up "platen": voeg subtiele SSS toe op oren (doorschijnend in tegenlicht) en natte specular op ogen/neus.

---

## Samenvatting / aanbevelingen voor de coding agent (gefaseerd)

1. **Fase 0–1 (prototype → eerste speelbaar):** Quaternius CC0-set (alle 9, juridisch schoon), `WebGPURenderer` met WebGL2-fallback + TSL, golden-hour key+hemi-rig, perspectief-camera ~50° schuin, één gedeelde IBL. Poly <4K/dier, <100 draw calls, KTX2+Draco. Implementeer `prefers-reduced-motion` direct.
2. **Fase 2 (polish):** per-familie gestandaardiseerde rigs (canide: wolf+vos; ungulaat: edelhert+ree+zwijn) in Blender (Rigify/Auto-Rig Pro), retarget walk/trot binnen familie via Rokoko (gratis) of ARP Remap. Voeg emotie-standen, IK foot-plant, secundaire staart/oor-beweging toe. Bouw heikikker-metamorfose als blendshape-/morph-scène.
3. **Fase 3–4 (realisme/close-up):** koop/maak per-dier realistische PBR-modellen (let op licentie — CC0/Royalty-Free, géén personal-use of Editorial), normal-mapped detail, fins/shell-fur alleen voor close-up-pluis, SSS op oren, schub-shader voor adder+hagedis. LOD-systeem + sprite-fallback voor low-end.

**Drempels die de aanpak veranderen:** zakt fps <60 op iPad met meerdere dieren → val terug op laagste LOD/sprites en zet schaduwen uit; >100 draw calls → instancing op props; GLB >4 MB → agressiever Draco/KTX2 of textures naar 512. Licentie niet aantoonbaar commercieel/CC0 → asset niet gebruiken.

---

*Bronnen: Three.js docs & community (threejs.org, utsubo.com, neural4d, discourse.threejs.org, Khronos Group), Apple Safari 26 Release Notes; Quaternius/poly.pizza, Sketchfab, CGTrader, Fab; Blender Rigify/Auto-Rig Pro/Cascadeur/Rokoko/Truebones; Zoogdiervereniging, Vereniging Het Edelhert, Natuurmonumenten, Hoge Veluwe, RAVON, BIJ12/Werkgroep Wolf, Animator Notebook (gangen/Muybridge), snake-locomotion (WikiVet/Univ. Louisiana), Li et al. 2023 (geweigroei), Sztatecsny et al. 2012 (heikikker blauwkleuring). Ecologie/terminologie reeds geverifieerd in aparte kennisbank — hier bewust niet herhaald.*