# Art-direction & Technical-Art Rapport — MENSEN & OGEN ("Ranger van de Veluwe")

*Vervolg op het dieren-rapport. Zelfde pipeline (modern Three.js, WebGPURenderer + automatische WebGL2-fallback via TSL, glTF 2.0/GLB, Draco + KTX2), zelfde golden-hour lichtrig, zelfde budgetten. Focus 100% op VISUEEL + ANIMATIE + TECHNIEK.*

## TL;DR
- Mensen kunnen — anders dan de dieren — volledig leunen op gratis, gestandaardiseerde humanoïde pijplijnen: **Mixamo** (auto-rig ~65 botten + gratis animatiebibliotheek), **MakeHuman/MPFB** (CC0), **Ready Player Me** (glTF-avatars in de browser), **VRoid** (VRM) en **Character Creator 4** (AccuRig). Retargeting tussen humanoïden is triviaal; één animatieset bestuurt de hele cast.
- Houd mensen bewust ietsje MEER gestileerd dan de dieren om de "uncanny valley" te ontwijken: licht vergrote ogen, vereenvoudigde huid met subtiele SSS, zachte trekken, warme highlights/koele schaduwen. Gezichtsexpressie via de de-facto standaard **ARKit-52 blendshapes** (of de simpelere VRM-set).
- Ogen zijn de #1 emotionele lezing: pupilvorm verraadt prooi vs. roofdier (rond = mens/wolf/das/eekhoorn; verticale spleet = vos/adder; horizontaal = edelhert/ree/zwijn). Voor "levende" ogen tellen vooral **catchlights**, natheid (clearcoat) en micro-beweging (knipperen, saccades, look-at). Twee-laags cornea-refractie alleen in close-up; platte oogtextuur in de overworld.

## Kernbevindingen

1. **De humanoïde standaard is je grootste cadeau.** Waar Mixamo en mocap NIET werkten voor quadrupeden, werken ze juist perfect voor bipeds. Mixamo auto-rigt elk humanoïd model gratis (standaardskelet 65 botten, of "No Fingers" 25) en levert duizenden walk/run/idle/wave/sit/talk-clips die automatisch retargeten naar elk compatibel humanoïd rig.
2. **Diversiteit is ingebouwd via character-creators.** Ready Player Me levert kant-en-klare, gerigde glTF/GLB-avatars met ARKit-blendshapes, bestuurbaar via iFrame/SDK/REST — ideaal voor een speler die "z'n eigen" personage maakt (huidskleur, haar, kleding, lichaamstype).
3. **Proporties maken de leeftijd.** Het "head-count"-systeem (peuter ~4–5 koppen, kind ~6, volwassene ~7,5) plus echte Nederlandse/Europese maten geeft een betrouwbare modelleer-tabel voor 3/4/8-jarige + volwassen man/vrouw.

---

# DEEL A — OVERKOEPELEND: TECHNIEK & PIPELINE VOOR MENSEN

## A1. Pipeline & hoe mensen verschillen van dieren

De technische basis is identiek aan het dieren-rapport: GLB (glTF 2.0), GLTFLoader + DRACOLoader + KTX2Loader, MeshStandardMaterial/MeshPhysicalMaterial (PBR), WebGPURenderer met automatische WebGL2-fallback, shaders in TSL zodat ze naar zowel WGSL als GLSL compileren. iPad/iPadOS-compatibel, 60 fps doel.

**Wat anders is dan bij dieren:**
- **Rigging is gestandaardiseerd en geautomatiseerd.** Het humanoïde skelet is universeel; Mixamo/AccuRig/Rigify/Auto-Rig Pro herkennen het automatisch. Bij dieren moest alles handmatig.
- **Animatie is overvloedig.** Mocap voor mensen is bijna gratis en oneindig (Mixamo, ActorCore, CMU). Bij dieren was dit schaars.
- **Het gezicht is de hoofdmoot.** Mensen communiceren via gezicht + handen; blendshapes (ARKit-52) zijn een aparte, grote investering die dieren niet of nauwelijks nodig hadden.
- **De uncanny valley.** Een net-niet-echt dier is "schattig"; een net-niet-echte mens is "eng". Dit dwingt tot bewuste stilering.

**Poly-budgetten (zelfde kader als dieren):**

| LOD | Toepassing | Tris (mens) |
|---|---|---|
| Overworld-LOD | top-down/3-4 Pokémon-stijl, klein op scherm | 1.500–4.000 |
| Mid-LOD | middelafstand | 5.000–15.000 |
| Close-up hero | "plaat"/storymoment | 20.000–50.000 |

Scene-budget ~50.000 tris on-screen; <~100 draw calls/frame; textures 512–2048 KTX2; GLB <~4 MB. Ter referentie hanteert Ready Player Me een harde bovengrens van **"Maximum total triangle count: 30000"** per avatar en **max. 4 skin-weights per vertex, genormaliseerd tot 1.0** ("Ready Player Me assets only support a maximum of 4 skin weights per vertex… Skin weights for each vertex MUST be normalized, meaning they have to add up to 1.0", docs.readyplayer.me) — een nuttige web-bovengrens die naadloos in ons budget past.

**De uncanny valley vermijden — concrete stileringsknoppen:**
- Iets grotere ogen dan fotorealistisch (maar zie waarschuwing in OGEN-deel: niet té groot).
- Zachte, licht vereenvoudigde trekken; minder huidsporen/poriën dan realistisch; subtiele SSS i.p.v. plastic/wasachtig.
- Iets grotere kop (richting head-count-stilering), rondere vormen.
- Warme highlights, koele schaduwen (golden-hour rig) — een warme huid leest direct vriendelijker.
- Vermijd "dode" ogen (zie OGEN). Eén ontbrekende catchlight maakt een gezicht al levenloos.

## A2. Modellen verkrijgen/genereren

| Bron | Gratis/Betaald | Licentie | Gerigd & geanimeerd | Realisme | Web/glTF |
|---|---|---|---|---|---|
| **MakeHuman / MPFB2** (Blender) | Gratis, open-source | Output **CC0** (commercieel/closed-source OK, geen attributie) | Rig ja (Default, CMU, Rigify); animatie via Mixamo | Realistisch, parametrisch | Exporteert glTF/glb, FBX, USD, Alembic |
| **Character Creator 4 / Reallusion** | Betaald (30-dg trial) | Commercieel (per licentie) | Ja, volledige body + facial rig, AccuRig, 60 facial blendshapes | Hoog/fotorealistisch, HD-morphs, LOD-export | FBX→glTF; LOD/decimate ingebouwd |
| **VRoid Studio** | Gratis | Toestaat commercieel gebruik (eigen modellen) | Ja, VRM (humanoïd + expressies + visemes) | Anime-gestileerd | VRM (= glTF-extensie) |
| **Ready Player Me** | Gratis (Partner) | CC-BY 4.0 standaard; gratis voor commercieel als geregistreerde Partner | Ja, full-body gerigd + ARKit-blendshapes | Semi-gestileerd, web-geoptimaliseerd | **Native glTF/GLB**, Draco/meshopt optioneel |
| **Meshcapade / SMPL** | Betaald/onderzoek | Per licentie | SMPL-body, parametrisch | Realistisch lichaam | glTF mogelijk |
| **Mixamo** (Adobe) | **Gratis** | Gratis gebruik | Auto-rig + animatiebibliotheek (3.000+ clips) | n.v.t. (rig/animatie) | FBX→glTF |
| **Quaternius** | Gratis | **CC0** | Gestileerde humans, vaak gerigd | Low-poly gestileerd | glTF/FBX |
| **Fab / MetaHuman** | Gratis (Epic-ecosysteem) | MetaHuman-licentie (gebonden aan Unreal-ecosysteem; zwaar) | Zeer hoog, volledige facial rig | Fotorealistisch maar zwaar | Niet web-vriendelijk out-of-box |
| **Sketchfab / CGTrader / TurboSquid** | Gemengd | Variabel (CC0/CC-BY/royalty) | Variabel | Variabel | Veel glTF/GLB |

**Aanbeveling voor dit project:** start met **MakeHuman/MPFB (CC0)** voor de vaste cast (ranger, peuters, volwassenen) → rig via **Mixamo** → animatie uit Mixamo. Voor de **aanpasbare speler-avatar**: **Ready Player Me** (browser-native glTF, ARKit-blendshapes, ingebouwde character-creator via iFrame).

**MakeHuman-licentienoot:** alle kern-assets (basemesh, targets, skins) zijn CC0; de officiële export mag commercieel en closed-source worden gebruikt zonder attributie ("Take all mesh and target assets and build a character generator of your own, with no restriction on what license that character generator needs to have", makehumancommunity.org). MPFB2 (de Blender-opvolger) is GPLv3-code met CC0-assets, compatibel met Blender 4.2+.

**Character-creator in de browser:** Ready Player Me biedt een device-agnostische web-Avatar Creator (iFrame/WebView) én een REST-API/SDK om zelf een UI te bouwen. Workflow: maak een (gast)gebruiker → haal asset-lijst op (per gender; feminine/masculine skelet) → equip assets via PATCH → haal GLB op via `models.readyplayer.me/[id].glb`. Body-shape presets, huidskleur, haar, outfits en kleur zijn instelbaar.

## A3. Rigging van mensen

**Het standaard humanoïde skelet:**
- **Mixamo:** standaardskelet **65 botten** (incl. vingers) of "No Fingers" 25. Botnaamgeving `mixamorig:Hips`, `mixamorig:Spine`, etc. Auto-rigger plaatst botten + skinning via AI (Stanford-onderzoek), markers op polsen/ellebogen/knieën/kruis.
- **Game-praktijk:** een volledige body-rig heeft de zinvolle articulatie in **35–45 botten**; boven ~65–70 botten lopen de kosten met afnemend rendement op. Extra botten gaan naar gezicht (20–30), vingers (15) en secundaire dynamica.
- **VRM/Humanoid:** vaste bone-map (Hips, Spine, Chest, Neck, Head, UpperArm/LowerArm/Hand L/R, UpperLeg/LowerLeg/Foot L/R + optioneel leftEye/rightEye).
- **MetaHuman:** zeer hoog botaantal incl. uitgebreide facial joints — te zwaar voor onze browserbudgetten.

**Contrast met de quadruped uit het dieren-rapport:** Mixamo en AccuRig werken WÉL voor bipeds (auto-detectie van anatomie, AI-skinning, T-pose). Retargeting tussen humanoïden is gestandaardiseerd en triviaal — dat is precies het punt: **één animatiebibliotheek stuurt vele personages**.

**Hand/vinger-botten vs. gezicht:** vingers via botten (15 joints voor volledige hand; voor onze stijl mogen vingers vereenvoudigd). Gezicht: **blendshapes** (niet botten) is de realtime/web-standaard — goedkoper, draagbaar, en kernpunt voor expressie.

**Tools:** Mixamo auto-rigger (gratis), AccuRig (gratis, mensen, + toegang tot ActorCore 4.500+ animaties), Blender **Rigify** (human metarig), **Auto-Rig Pro** (betaald, "Remap"-functie voor retargeting tussen verschillende botnamen/oriëntaties, glTF/FBX-export). In Three.js: `SkeletonUtils.retarget()` / `retargetClip()` voor retargeting (geef een echte `Skeleton` mee, niet een SkeletonHelper); let op bekende valkuilen (proportieverschillen geven artefacten zoals omgekeerde voeten — vandaar de community-solver `upf-gti/retargeting-threejs`).

## A4. Animatie-aanpak

**Mixamo-clips nuttig voor dit spel:**
- Ranger/gids: Idle, Looking Around, Walking, Standing, Talking, Pointing, Waving, Hands On Hip, Sitting, Crouch.
- Kinderen spelend/lopend: Happy Walk, Run, Jump, Excited, Wave, Sitting (vloer), Clapping.
- In-place editing in Mixamo: snelheid, mirroring, blending, foot-lock (tegen voet-slip). Export tot 60 fps, motion baked op het skelet.

**ActorCore:** 4.500+ productieklare mocap-clips; **CMU**-bibliotheek (2.000+) gratis via BVH→glTF (retarget met Auto-Rig Pro).

**Procedureel (Three.js):**
- **IK foot-planting** tegen voet-slip op oneffen grond.
- **Look-at/head-tracking:** personage kijkt naar interessepunten — perfect voor een gids-ranger (koppel aan eye look-at, zie OGEN).
- **Secundaire beweging:** haar/kleding (spring bones / simpele verlet), ademhalings-idle.
- **prefers-reduced-motion**-pad: dempt secundaire beweging/idle-sway.

**Kind vs. volwassene in locomotie:** kinderen hebben kortere ledematen, hogere cadans, "bouncier" gang (meer verticale beweging, armen wijder), minder geaard. Volwassenen: lagere cadans, geaard, kleinere verticale oscillatie. Pas Mixamo-clipsnelheid + amplitude aan, of gebruik aparte kind-clips.

## A5. Faciale animatie & blendshapes (groot)

**De standaard-sets:**
- **ARKit 52 blendshapes** = de-facto web/realtime-standaard (Apple `ARFaceAnchor.BlendShapeLocation`), georganiseerd in: **brows** (5: browDown L/R, browInnerUp, browOuterUp L/R), **ogen** (14: blink/look-Up/Down/In/Out/squint/wide per oog), **kaak** (4: jawOpen/Forward/Left/Right), **mond** (23: smile/frown/pucker/funnel/press/stretch/roll/shrug/upperUp/lowerDown etc.), **wangen** (cheekPuff, cheekSquint L/R) + neus (noseSneer L/R) + tongOut. De mond is met 25 mond- + 4 kaak-shapes veruit het complexst.
- **FACS** (Action Units, Ekman) = de oudere, anatomische basis waar ARKit op leunt.
- **MetaHuman facial rig:** hoogste kwaliteit (bot+blendshape hybride), te zwaar voor web.
- **Ready Player Me / VRM:** RPM levert exact de ARKit-52. **VRM-expressies** zijn simpeler/holistisch: NEUTRAL, JOY, ANGRY, SORROW, FUN/Surprised + visemes **A,I,U,E,O** + BLINK_L/R + LookAt. Extra VRM-visemes voor lip-sync: SIL, CH, DD, FF, KK, NN, PP, RR, SS, TH.
- **Oculus/Meta visemes:** lip-sync-set voor spraak.

**Aanbevolen blendshape-lijst voor een warm, expressief maar simpel kind + volwassen gezicht** (subset van ARKit, ~16–20 shapes):

| Doel | Blendshapes (ARKit) |
|---|---|
| Glimlach/blij | mouthSmile L/R, cheekSquint L/R, (lichte) eyeSquint L/R |
| Verrast/nieuwsgierig | browInnerUp, browOuterUp L/R, eyeWide L/R, jawOpen (licht) |
| Verdrietig (mild) | browInnerUp, mouthFrown L/R, (lichte) eyeLookDown |
| Bang (mild, kindvriendelijk) | eyeWide L/R, browInnerUp, mouthStretch L/R (licht) |
| Praten/visemes | jawOpen, mouthFunnel, mouthPucker, mouthClose (+ A/I/U/E/O) |
| Knipperen | eyeBlink L/R |
| Wenkbrauw op (interesse) | browInnerUp, browOuterUp L/R |

**Aansturen in Three.js:** `mesh.morphTargetInfluences[i] = waarde (0..1)`, met `morphTargetDictionary` om op naam te indexeren. Fade-in/out (~0,3–0,4 s, zoals VRM-tools default) voorkomt schokkerige overgangen.

**Warm & niet-eng houden:** gebruik nooit volle 1.0 op enge shapes (angst/woede max ~0,4–0,6); combineer altijd met zachte ogen; vermijd asymmetrie die "scheef/sinister" leest; laat ogen meebewegen (squint bij glimlach = "Duchenne", leest oprecht). Oog-gerelateerde shapes (blink, squint, wide) koppelen direct aan het OGEN-deel.

## A6. Kind vs. volwassen proporties (kritisch)

**Head-count systeem (kunstanatomie):**

| Leeftijd | Koppen hoog | Gezichtskenmerk |
|---|---|---|
| Baby (0–1 jr) | 3–4 | kop ~¼ lichaam, gezicht = ⅓ van schedel |
| Peuter (~2–3 jr) | ~4–5 | groot voorhoofd, lage/kleine trekken, bolle buik |
| Kind (4–6 jr) | ~5–6 | ronder gezicht, grote ogen relatief |
| Kind (~8 jr) | ~6–6,5 | ledematen langer, richting volwassen |
| Tiener | ~7–7,5 | bijna volwassen |
| Volwassene | ~7,5–8 | gezicht ≈ ½ schedel |

**Echte antropometrie — Nederlandse/Europese gemiddelden** (Nederlanders zijn de langste ter wereld; gebruik dit bewust):

| Type | Lengte (gem.) | Gewicht (indicatief) | Koppen |
|---|---|---|---|
| 3-jarige | ~95–97 cm | ~14 kg | ~5 |
| 4-jarige | ~103–105 cm | ~16–17 kg | ~5,5 |
| 8-jarige (ranger) | ~130–132 cm | ~26–28 kg | ~6 |
| Volwassen man (NL) | ~183 cm | — | ~7,5 |
| Volwassen vrouw (NL) | ~170 cm | — | ~7,5 |

*Nederlandse volwassen gemiddelden volgens CBS (16 sep 2021): in Nederland in 2001 geboren mannen waren op hun 19e gemiddeld **182,9 cm**, vrouwen uit dat geboortejaar **169,3 cm** — Nederland blijft "het langste volk ter wereld". Kindwaarden via WHO/CDC-groeicurven (rond 3 jaar ~95 cm/14 kg); Nederlandse kinderen zitten iets boven het internationale gemiddelde.*

**Faciale proportie-verschuivingen bij kinderen:** groter voorhoofd, ooglijn LAGER (kinderen: ooglijn dichter bij de neus i.p.v. halverwege het gezicht), grotere ogen relatief, rond gezicht, kleine neus/kin, zachte kaak (kind ¾ schedel/¼ kaak; volwassene ⅔/⅓). Ogen staan verder uit elkaar op de grotere kop.

**Lichaamsvorm:** peuter = bolle buik, korte dikke ledematen, geen taille, heupen smal (rechthoek). Naar 8 jaar: benen ~½ van de lengte, slankere ledematen (weinig spierdefinitie).

**Wat leest als "3" vs "4" vs "8" vs "volwassen":** koppenverhouding + ooglijnhoogte + ledemaatlengte zijn de drie sterkste signalen. ~0,5–1 kop verschil verschuift de waargenomen leeftijd al sterk.

## A7. Kleding & haar realtime

**Haar:**
- **Hair cards** (alpha-vlakken met haartextuur) = de realtime/game-standaard, balanceert realisme en kosten; realistische coupes 4k–20k tris, maar voor onze stijl veel minder. Let op: 200–400 cards = veel draw calls + alpha-sortering; voor mobiel/iPad strikt beperken (richtlijn uit de praktijk: 1–2 draw calls per personage, weinig alpha-lagen, gebakken specular).
- **Simpele mesh-coupes** (solide vorm + normalmap) zijn het goedkoopst en passen het best bij onze gestileerde, kindvriendelijke look — sterk aanbevolen voor overworld-LOD.
- **Strand-based hair** = filmkwaliteit maar te duur voor browser/iPad ("a guaranteed recipe for performance issues" op mobiel); niet doen.

**Kleding als mesh:** ranger-uniform (zie B1), kinderkleding casual. Voor de **character-creator**: verwisselbare mesh-onderdelen (RPM-aanpak: outfit/hair/headwear als losse assets) + material/texture-swaps + morph-target lichaamstypes.

**Huid-shading:** PBR-huid met subtiele **subsurface scattering (SSS)** voor warmte. In Three.js: `MeshPhysicalMaterial` (transmission/thickness/attenuationColor) of de nieuwere translucent-material; in golden-hour licht gloeien oren/neus warm op. Vermijd plastic/wasachtig: matige roughness, lichte SSS, geen overdreven specular (waxy/plastic huid is dé uncanny-trigger als SSS ontbreekt). Diverse huidtinten: varieer basecolor + SSS-tint (donkerder huid → SSS subtieler, meer zichtbaar als "golden rim light" langs de silhouetrand).

## A8. Performance & fallback

Zelfde kader als dieren: LOD-ketens, instancing (voor menigtes/NPC's), sprite-fallback voor low-end, `prefers-reduced-motion`. **Belangrijk verschil:** de **speler-ranger staat vrijwel altijd in beeld** — diens LOD/budget weegt het zwaarst. Geef de speler-ranger de beste consistente mid-LOD; reserveer hero-LOD (20k–50k) voor "platen". NPC's mogen agressiever LOD-en en sprite-fallen.

## A9. "Realisme in stappen"-ladder (mensen)

Spiegelt de dieren-ladder, maar **mensen blijven bewust ietsje MEER gestileerd** om de uncanny valley te ontwijken:
1. **Blockout** — grijze proporties, head-count kloppend.
2. **Gestileerd** — vereenvoudigde vormen, mesh-haar, flat-ish ogen, weinig textuurdetail.
3. **PBR-gestileerd** *(aanbevolen eindstation voor de meeste shots)* — PBR-huid + subtiele SSS, ARKit-blendshapes, twee-laags ogen alleen in close-up.
4. **Realistisch** — meer huiddetail, hair cards, volledige facial set.
5. **Fotorealistisch (alleen close-up "plaat")** — hoogste detail, full refractive eye, maximale SSS.

---

# DEEL B — PER MENSELIJK PERSONAGE-TYPE

## B1. DE RANGER (8-jarige speler-personage)

**a. SILHOUET & PROPORTIES** — ~6 koppen hoog; lengte ~130–132 cm (NL 8-jarige), ~26–28 kg. Slank, benen ~½ lengte, nog kinderlijk rond gezicht maar al richting "groot kind". Herkenbaar silhouet: ranger-pet/hoed + jasje + (verrekijker/rugzakje).
**b. HUID/HAAR/KLEUR** — diverse huidtinten (speler kan variëren; default warm-neutraal). Haar: bruin/blond/zwart, korte praktische coupe. Outfit-palet: aardetinten — bosgroen, kaki, warm bruin, met een herkenbare accentkleur (bijv. oranje/geel patch).
**c. KOP & GEZICHT** — grote, vriendelijke ogen, lage ooglijn, kleine neus, ronde wangen. Stileringsknop: ogen iets vergroot maar niet té (anders uncanny/baby). Open, nieuwsgierige uitdrukking als default.
**d. SIGNATUUR-HOUDING & -BEWEGING** — zelfverzekerd-nieuwsgierige gids-stand: licht voorover, wijzend/uitleggend, hand boven ogen "turend". Look-at naar interessepunten.
**e. GANGEN** — verkennende wandel met lichte bounce, iets snellere cadans dan volwassene; ren = energiek, armen actief.
**f. IDLE** — ademhaling, gewichtsverplaatsing, af en toe rondkijken (look-around), knipperen op natuurlijk tempo (zie OGEN).
**g. EMOTIE-STANDEN** — *Kalm/blij:* mouthSmile + cheekSquint, ontspannen schouders. *Alert-nieuwsgierig:* browInnerUp + eyeWide + hoofd kantelen + look-at. *Bang/verdrietig (mild):* eyeWide of browInnerUp + mouthFrown licht, schouders in.
**h. TOP-DOWN LEESBAARHEID** — pet/hoed-silhouet + jaskleur + accentkleur moeten klein leesbaar blijven; haarkleur en proporties (groot hoofd) maken hem direct herkenbaar.
**i. CLOSE-UP "PLAAT"-POSE** — driekwart portret, ogen wijd van verwondering, lichte glimlach, catchlight in beide ogen van de warme key-light.
**j. REFERENTIE-ZOEKTERMEN** — "kids park ranger uniform", "3D child character proportions 8 year old", "stylized child game character", "junior ranger outfit kids", "Pixar child character turnaround".

## B2. PEUTER JONGEN (3 jaar)

**a. SILHOUET & PROPORTIES** — ~5 koppen; ~95–97 cm, ~14 kg; bolle buik, korte dikke ledematen, geen taille, grote kop.
**b. HUID/HAAR/KLEUR** — zachte, warme huid (sterke SSS-wangen); dun fijn haar, vaak lichter (NW-Europese kinderen worden vaak met lichte ogen/haar geboren — zie OGEN). Kleurrijke peuterkleding (primaire kleuren).
**c. KOP & GEZICHT** — zeer groot voorhoofd, lage ooglijn, grote ronde ogen, knopneusje, mollige wangen, kleine kin.
**d. SIGNATUUR-HOUDING & -BEWEGING** — wankel, reikend omhoog (armen omhoog "optillen"), breed bal-evenwicht.
**e. GANGEN** — waggelende, onzekere peuterloop, armen wijd voor balans, korte snelle pasjes.
**f. IDLE** — frequent friemelen, wiebelen, rondkijken; korte aandachtsspanne in beweging.
**g. EMOTIE-STANDEN** — *Blij:* brede mouthSmile + eyeSquint, hele lichaam. *Nieuwsgierig:* eyeWide + jawOpen licht + reiken. *Verdrietig (mild):* browInnerUp + mouthFrown + pruillip (mouthPucker licht).
**h. TOP-DOWN LEESBAARHEID** — extreem grote kop + bolle buik + kleurrijke kleding = direct "peuter".
**i. CLOSE-UP "PLAAT"-POSE** — frontaal, grote ogen, open mondje van verbazing, maximale schattigheid.
**j. REFERENTIE-ZOEKTERMEN** — "toddler 3 year old proportions", "3D toddler character model", "toddler body proportions chart", "cute stylized toddler".

## B3. PEUTER MEISJE (4 jaar)

**a. SILHOUET & PROPORTIES** — ~5,5 koppen; ~103–105 cm, ~16–17 kg; iets slanker/langer dan B2, nog steeds grote kop en korte ledematen.
**b. HUID/HAAR/KLEUR** — warme huid + SSS; haar langer (staartjes/krullen mogelijk), diverse kleuren. Vrolijk kleurenpalet.
**c. KOP & GEZICHT** — groot voorhoofd, grote ogen, lage ooglijn, ronde wangen; iets gedefinieerder dan 3-jarige.
**d. SIGNATUUR-HOUDING & -BEWEGING** — iets stabieler dan B2, nieuwsgierig, kan kort rennen/huppelen.
**e. GANGEN** — bouncy, snelle cadans, beginnende huppel; nog lichte waggel.
**f. IDLE** — wiebelen, met haar/kleding friemelen, rondkijken.
**g. EMOTIE-STANDEN** — *Blij:* mouthSmile + cheekSquint, huppel-aanzet. *Alert:* eyeWide + browInnerUp + hoofd kantelen. *Bang/verdrietig (mild):* browInnerUp + mouthFrown, zoekt houvast.
**h. TOP-DOWN LEESBAARHEID** — grote kop + haarstijl (staartjes) + jurk/kleurcontrast.
**i. CLOSE-UP "PLAAT"-POSE** — driekwart, brede glimlach met eyeSquint, warme catchlights.
**j. REFERENTIE-ZOEKTERMEN** — "4 year old girl proportions", "preschooler 3D character", "stylized young girl game character", "child pigtails 3D".

## B4. VOLWASSEN MAN (ouder/ranger/bezoeker)

**a. SILHOUET & PROPORTIES** — ~7,5 koppen; NL-gemiddelde ~183 cm; brede schouders (~2 koppen), smalle heupen, hoekiger silhouet.
**b. HUID/HAAR/KLEUR** — diverse huidtinten + SSS (oren/neus); haar kort, diverse kleuren incl. grijzend; mogelijk baard (eigen blendshape/mesh). Kledingpalet: ranger-uniform of casual outdoor.
**c. KOP & GEZICHT** — ooglijn halverwege gezicht, hoekiger kaak, prominentere wenkbrauwboog, grotere neus/kin; warme, vriendelijke trekken houden (geen harde frons-defaults).
**d. SIGNATUUR-HOUDING & -BEWEGING** — ontspannen, geaarde stand, hand op heup of armen over elkaar; rustige gebaren.
**e. GANGEN** — geaarde wandel, lage cadans, kleine verticale oscillatie.
**f. IDLE** — subtiele ademhaling, kleine gewichtsverplaatsing, af en toe knikken/look-at.
**g. EMOTIE-STANDEN** — *Kalm/blij:* zachte mouthSmile, ontspannen brows. *Alert:* browInnerUp + eyeWide + look-at. *Bezorgd (mild):* browInnerUp + lichte mouthFrown.
**h. TOP-DOWN LEESBAARHEID** — lengte + schouderbreedte + haar/baard + kledingkleur.
**i. CLOSE-UP "PLAAT"-POSE** — driekwart, warme glimlach, geruststellende blik, catchlights.
**j. REFERENTIE-ZOEKTERMEN** — "adult male character proportions 3D", "park ranger uniform man", "stylized friendly adult male game", "Dutch man average build".

## B5. VOLWASSEN VROUW

**a. SILHOUET & PROPORTIES** — ~7,5 koppen; NL-gemiddelde ~170 cm; smallere schouders (~1,5–1,75 kop), heupen relatief breder, rondere overgangen.
**b. HUID/HAAR/KLEUR** — diverse huidtinten + SSS; haar variabel (kort tot lang), diverse kleuren; casual/outdoor of ranger-outfit.
**c. KOP & GEZICHT** — ooglijn halverwege, zachtere kaaklijn, rondere contouren, vollere lippen; warme open uitdrukking.
**d. SIGNATUUR-HOUDING & -BEWEGING** — ontspannen geaarde stand, natuurlijke gebaren.
**e. GANGEN** — geaarde wandel, gemiddelde cadans, vloeiend.
**f. IDLE** — ademhaling, gewichtsverplaatsing, look-at, knipperen.
**g. EMOTIE-STANDEN** — *Kalm/blij:* mouthSmile + cheekSquint. *Alert:* browInnerUp + eyeWide + look-at. *Verdrietig (mild):* browInnerUp + mouthFrown.
**h. TOP-DOWN LEESBAARHEID** — haarstijl/kleur + silhouet (schouder/heup) + kledingkleur.
**i. CLOSE-UP "PLAAT"-POSE** — driekwart, warme glimlach, eyeSquint (oprecht), catchlights.
**j. REFERENTIE-ZOEKTERMEN** — "adult female character proportions 3D", "stylized friendly woman game character", "female ranger outfit", "Dutch woman average build".

## B6. AANPASBARE AVATAR / CHARACTER CREATOR

**a. SILHOUET & PROPORTIES** — twee basis-skeletten (feminine/masculine, RPM-conventie) + morph-target lichaamstypes (slank/gemiddeld/steviger). Basisproporties volwassen ~7,5 koppen, of kind-preset ~6 koppen.
**b. HUID/HAAR/KLEUR** — instelbare huidtint (volledige diverse range), haarkleur, haarstijl-assets, kledingassets + kleur. Via RPM: skin-color, hair-color, eye-color als swappable assets/material-swaps.
**c. KOP & GEZICHT** — instelbare gezichtsvorm, ogen, wenkbrauwen, neus, mond; ARKit-52 blendshapes blijven werken over alle varianten (consistent rig).
**d. SIGNATUUR-HOUDING & -BEWEGING** — neutrale idle + dezelfde gedeelde animatieset (retargeting werkt omdat alle varianten hetzelfde humanoïde skelet delen).
**e. GANGEN** — gedeelde walk/run-clips; eventueel body-type-afhankelijke snelheid/amplitude.
**f. IDLE** — gedeelde idle met ademhaling + look-at.
**g. EMOTIE-STANDEN** — gedeelde ARKit-blendshape-combo's (zie A5), werken op elke avatar.
**h. TOP-DOWN LEESBAARHEID** — haarkleur + kledingkleur + lichaamstype als primaire onderscheiders; houd palet helder/contrastrijk.
**i. CLOSE-UP "PLAAT"-POSE** — gedeelde hero-pose; speler herkent "eigen" avatar aan kleur/haar.
**j. REFERENTIE-ZOEKTERMEN** — "Ready Player Me avatar creator", "character creator UI skin tone hair", "browser avatar customization glTF", "modular character swappable parts".

**Technische implementatie character-creator:** Ready Player Me web-Avatar Creator via iFrame (snelst, altijd up-to-date, plug-and-play in enkele minuten) óf eigen UI via REST-API (asset-lijst ophalen → equip via PATCH → GLB ophalen). Avatars komen binnen als gerigde GLB met ARKit-blendshapes; Draco/meshopt optioneel voor kleinere files (meshopt is effectiever op avatars mét morph targets). Cache avatars runtime (RPM SDK ≥1.12 doet dit automatisch).

---

# DEEL B-OGEN — OGEN VAN MENSEN ÉN DIEREN

## Anatomie & art-direction

**Pupilvorm verraadt ecologie (Banks et al., 2015, *Science Advances*, "Why do animal eyes have pupils of different shapes?", n=214 soorten):** sterke correlatie tussen pupilvorm en niche. **Verticale spleet** = hinderlaag-roofdier, dag+nacht actief (astigmatische scherptediepte helpt afstand schatten via stereopsis op verticale contouren). **Horizontale balk** = prooidier met zijwaartse ogen (panoramisch zicht langs de grond, scherp op horizontale contouren vóór en achter). **Rond** = veel dagactieve dieren + mens.

**Per soort (mens + de negen dieren):**

| Soort | Pupilvorm | Iris/oogkleur | Sclera zichtbaar | Tapetum (eyeshine) | Oog t.o.v. kop |
|---|---|---|---|---|---|
| **Mens** | rond | bruin/blauw/groen/hazel | **veel wit** (uniek) | nee | matig; kind relatief groter |
| Edelhert | horizontaal (slot) | donkerbruin (pupil blendt in iris) | nauwelijks | ja (eyeshine wit/oranje) | groot, zijwaarts |
| Ree | horizontaal | donkerbruin | nauwelijks | ja | groot, zijwaarts |
| Wild zwijn | rond, klein | donkerbruin | weinig | ja (zichtbaar in IR) | zeer klein, zwak zicht |
| Wolf | rond | amber/geel-goud (pups blauw) | weinig | ja | matig, frontaal |
| Vos | **verticale spleet** | amber/geel (lipochroom; welpen slate-blauw) | weinig | ja (wit/blauwgroen) | matig, frontaal |
| Das | rond | donkerbruin | weinig | ja (recyclet licht) | klein |
| Eekhoorn | rond | groot, donker | weinig | nee (dagactief, conusrijk) | groot, donker, bol |
| Adder | **verticale spleet** | rood/koper iris | n.v.t. (bril) | — | klein, fel |
| Zandhagedis | rond (dagactieve lacertide) | donkerbruin | weinig | nee | klein |
| Heikikker | horizontaal | gouden iris (boven lichter), donker gemêleerd | n.v.t. | ja (retinaal) | groot, bol |

**Mensogen:** irisbereik bruin/blauw/groen/hazel. Wereldwijd is volgens een mini-review (Journal of Cellular Physiology 2020, via de American Academy of Ophthalmology) **~79% bruin, ~8–10% blauw, ~5% hazel en slechts ~2% groen**. In Europa een sterke **noordwest→zuidoost-gradiënt** (licht→donker): IJsland ~74,5% blauw; Nederland ~70% blauw/grijs (Rotterdam-cohort, PMC7583924); zuidelijk Europa overwegend bruin. **Kinderen (vooral NW-Europees)** worden vaak met lichte/blauwe ogen geboren die in de eerste maanden tot ~3 jaar donkerder kunnen worden (melanine neemt toe; verschuiving altijd licht→donker) — handig voor een diverse, herkenbare cast.

De **witte sclera is uniek menselijk** ("cooperative eye hypothesis", Tomasello, Hare, Lehmann & Call, 2007): het hoge contrast wit-sclera / gekleurde iris / zwarte pupil maakt blikrichting afleesbaar — dé basis voor emotie en joint attention. (Recente reviews, o.a. Perea-García, nuanceren de exclusiviteit, maar het hoge contrast bij mensen is onbetwist.) **Dieren tonen weinig of geen wit**; hun blik lees je via kop/houding, niet via sclera. **Gevolg voor look-at-systemen:** bij mensen draaien de ogen zichtbaar (wit verschuift → sterke emotionele lezing), bij dieren beweegt vooral de kop.

**Kind-ogen:** de oogbol is bij de geboorte al ~⅔–¾ van de volwassen grootte. *General Ophthalmology* (Vaughan/Asbury & Riordan-Eva, 1999): "the size of the eyeball at birth averages 16.5 mm from front to back as compared to adults where it is 24.2 mm"; het oog groeit van ~16–17 mm naar ~22,5–23 mm op 3 jaar en volledige grootte rond 12 jaar (= ~68–75% bij geboorte). De oogbol groeit dus veel minder dan de rest van het gezicht — dáárom ogen kinderen "grootogig". Maak kinderogen proportioneel groter, maar **waarschuwing: niet té groot** — overdrijving kantelt van schattig naar uncanny/pop-achtig. Iris licht vergroten + lage ooglijn doet al veel.

**Het "dode pop"/uncanny-probleem — wat maakt CG-ogen dood vs. levend:**
- ontbrekende **catchlights**/specular → dood;
- geen **natheid** (wet line/waterline) → glazig;
- geen **micro-beweging** (saccades, blink) → starend;
- verkeerde **schaal**/platte iris/geen diepte/parallax → "geplakt".

## Realtime rendering-techniek (browser/Three.js)

**Ooggeometrie:**
- **Enkele mesh** (overworld-LOD): platte iris-textuur, eventueel parallax-mapped voor goedkope nep-diepte. Iris-refractie te simuleren met parallax op één mesh (cf. ArtStation "Real time eyes": één mesh, iris niet gescheiden, cornea-refractie via parallax, 10 iris-varianten).
- **Twee-laags** (close-up/hero): binnenste oogbol + buitenste transparante cornea-bult. Echte refractie via `MeshPhysicalMaterial` (transmission + IOR ~1,376). De klassieke truc (Jimenez, "Next-Generation Character Rendering"): de iris is fysiek concaaf maar wordt **bol** gemodelleerd; refractie laat hem juist als diep/concaaf lezen. Praktisch: iris als vlak ~2,18 mm achter de cornea-apex, met ray/plane-intersectie voor de UV.

**Catchlights/specular** = het allerbelangrijkste voor "levende" ogen: een scherpe specular highlight van de key-light. Onze golden-hour key (warm, laag van links) levert vanzelf een warme catchlight — versterk die desnoods met een kleine extra spec.

**Natheid:** clearcoat / hoge specular op het oogoppervlak + een subtiele natte "waterline" langs het onderooglid.

**Iris/sclera-texturen:** te authoren of kant-en-klaar (bijv. TexturingXYZ iris-maps; ArtStation realtime-eye-sets met 2k-textures en meerdere iris-varianten). Maak iris een **swappable textuur/material** voor de character-creator (oogkleur-keuze).

**Micro-animatie voor leven:**
- **Knipperen:** mens **~15–20×/min** in rust (Tsubota et al. 1996, geciteerd in Frontiers 2017: "Spontaneous eye blinks occur ~15–20 times per minute"; rust-meta-analyses geven gem. ~12–17/min). Daalt sterk bij focus: bij lezen gem. **~4,5/min**, bij conversatie juist **~10,5–32,5/min** (Review of Ophthalmology). Eén blink duurt ~200–400 ms (volledig gesloten ~50 ms). Implementeer via blink-blendshape (eyeBlink L/R) of bot; randomiseer interval ~3–6 s.
- **Saccades:** kleine schokkerige oogbewegingen (tot ~900°/s, 2–5 boogminuten tot ~20°); voeg subtiele random fixatie-shifts toe tijdens idle/gesprek.
- **Look-at/eye-tracking:** ogen (en kop) richten op interessepunten — koppel aan het look-at-systeem (A4); bij de gids-ranger sterk effect.
- **Pupil-dilatatie:** goedkoop te animeren via iris-UV-schaal of een kleine blendshape; subtiel inzetten bij emotie (verrast = wijder).

Koppel deze aan de emotie-standen: bv. *alert-nieuwsgierig* = eyeWide + pupil iets wijder + look-at + langzamer knipperen.

**Per-oog kostenbudget & LOD:**

| LOD | Geometrie | Textuur | Cornea-refractie |
|---|---|---|---|
| Overworld | platte/enkele mesh, ~50–150 tris/oog | gedeelde 256–512 | nee (flat, gebakken catchlight) |
| Mid | enkele mesh + parallax, ~150–400 tris | 512 | parallax-fake |
| Close-up hero | twee-laags, ~500–1.500 tris/oog | 1024–2048 | ja (MeshPhysicalMaterial transmission/IOR) |

De twee-laags refractieve cornea is **niet** de moeite waard op overworld-LOD (onzichtbaar klein) — gebruik daar platte oogtextuur met een gebakken catchlight. In close-up loont de volledige refractieve setup wél.

**Stilering dodgt de uncanny valley:** voor een kinderpubliek lezen **gestileerde/cartoon-ogen** (groter, simpeler, sterke enkele catchlight) vaak warmer en "levendiger" dan hyperrealistische ogen — en ze vermijden de dode-pop-val. **Aanbeveling:** gestileerde ogen met één sterke, warme catchlight als default; refractief realisme reserveren voor uitgesproken hero-platen.

---

# DEEL C — OVERKOEPELENDE VERGELIJKINGEN

## C1. Schaaloverzicht (hele cast samen)

Hoogtes (mens = stahoogte; dieren = schofthoogte/lengte ter referentie uit het dieren-rapport):

| Personage/dier | Hoogte | Referentie t.o.v. 8-jarige ranger (~131 cm) |
|---|---|---|
| Peuter (3 jr) | ~96 cm | tot ~middel/borst van ranger |
| Peuter (4 jr) | ~104 cm | tot ~borst van ranger |
| **8-jarige ranger** | **~131 cm** | ijkpunt |
| Volwassen vrouw (NL) | ~170 cm | ranger tot ~borst van vrouw |
| Volwassen man (NL) | ~183 cm | ranger tot ~middel/borst van man |
| Edelhert (schoft) | ~120–150 cm | ooghoogte ranger ≈ rug hert; imposant |
| Wild zwijn (schoft) | ~75–100 cm | tot ~middel ranger |
| Ree (schoft) | ~65–75 cm | tot ~heup/dij ranger |
| Wolf (schoft) | ~70–85 cm | tot ~heup ranger |
| Vos (schoft) | ~35–40 cm | tot ~knie ranger |
| Das (schoft) | ~25–30 cm | tot ~scheen ranger |
| Eekhoorn | ~20 cm lijf | bij de voeten |
| Adder | ~60 cm lang | op de grond |
| Zandhagedis | ~20 cm lang | op de grond |
| Heikikker | ~6–7 cm | piepklein |

*Gebruik dit zodat mens + dier in elke scène kloppend geschaald staan: een edelhert is indrukwekkend groot náást de kleine ranger; een vos komt tot z'n knie. Dier-schofthoogtes zijn indicatief — verifieer tegen de exacte waarden in het dieren-rapport.*

## C2. Gedeeld golden-hour palet voor huid & ogen

Zelfde lichtnotitie als de dieren, zodat mens en dier in dezelfde wereld zitten:
- **Warme key** (DirectionalLight, laag van links, #FFCF8F→#FFB870): warme highlights op huid; door **SSS** gloeien oren, neus en vingers warm op (sterker bij lichtere huid; bij donkere huid vooral als "golden rim light" langs de silhouetrand).
- **Koele fill** (HemisphereLight, sky #A8C4E8 / ground #7A6347): koel-blauwe schaduwkernen — "warme highlights, koele schaduwen".
- **Ogen:** de warme key levert in elk oog een warme **catchlight** (mens én dier) — de gedeelde lichtbron bindt de hele cast visueel. Bij prooidieren met tapetum (hert, ree) kan in schemer-shots een subtiele oranje/witte eyeshine; bij mens nooit (geen tapetum). PCFSoftShadowMap zachte schaduwen voor iedereen.

*Diverse huidtinten reageren consistent op dit licht: pas SSS-tint en roughness per tint aan, maar houd de key/fill-kleuren identiek over de hele cast voor wereld-cohesie.*

---

# Aanbevelingen (gefaseerd)

**Fase 1 — Fundament (nu):**
1. Zet de vaste cast op met **MakeHuman/MPFB (CC0)** → **Mixamo** auto-rig (65-bots skelet) → Mixamo-animatieset. Bouw alle personages op één gedeeld humanoïd skelet zodat retargeting gratis is.
2. Modelleer strikt volgens de **proportie-tabel (A6)**: head-count + ooglijnhoogte + ledemaatlengte zijn de leeftijdsbepalers. Lever per personage een blockout (ladder-stap 1) voor proportie-akkoord vóór detaillering.
3. Kies **PBR-gestileerd (ladder-stap 3)** als standaard-eindkwaliteit; reserveer hero/refractief alleen voor "platen".

**Fase 2 — Expressie & ogen:**
4. Implementeer de **~16–20 ARKit-subset** (A5) + een gedeeld **blink/saccade/look-at-systeem** (knipperinterval ~3–6 s; daal blink-frequentie tijdens "focus"-momenten). Houd enge shapes ≤0,6.
5. Bouw het **twee-laags oog** alleen voor close-up; overworld krijgt platte oogtextuur met gebakken catchlight. Maak iris een swappable material voor de creator.

**Fase 3 — Aanpasbare avatar:**
6. Integreer **Ready Player Me** (iFrame eerst, eventueel later eigen UI via REST-API). Cap op ≤30k tris, ≤4 skin-weights/vertex, Draco/meshopt aan.

**Drempels die de aanpak veranderen:**
- Zakt de iPad onder 60 fps met meerdere personages → agressiever LOD-en, NPC's naar sprite-fallback, mesh-haar i.p.v. cards, blink/saccade vereenvoudigen.
- Voelt een mens "eng" in playtests → één stap terug op de ladder (meer stilering: grotere kop/ogen-binnen-grens, zachtere huid, minder huiddetail).
- Wordt MetaHuman/strand-hair overwogen → niet doen voor web/iPad; blijft buiten budget.

---

# Caveats

- **Bronkwaliteit varieert.** Antropometrie (CBS, WHO/CDC), oog-anatomie (Banks et al. 2015 *Science Advances*; Tomasello et al. 2007; *General Ophthalmology*) en tool-documentatie (Apple ARKit, Ready Player Me, Reallusion, MakeHuman) zijn sterk. Sommige proportie- en dier-eyeshine-details komen van hobby/wildlife-sites en zijn als richtlijn bedoeld, niet als exacte spec.
- **Geen enkel "Europees" oogkleur-percentage.** De realiteit is een NW→ZO-gradiënt; gebruik landankers (IJsland ~75% blauw; NL ~70% blauw/grijs; Zuid-Europa overwegend bruin) i.p.v. één getal.
- **"Ogen volwassen bij geboorte" is een mythe** — correct is ~⅔–¾ van de volwassen grootte; de grootogige look komt doordat de oogbol veel minder groeit dan het gezicht.
- **Zandhagedis-iris en exacte pupilvorm** zijn deels afgeleid uit de algemene biologie van dagactieve lacertiden (ronde pupil), niet uit één expliciete bron — behandel als beredeneerde aanname.
- **Dier-schofthoogtes in C1 zijn indicatief**; verifieer tegen de exacte cijfers uit het dieren-rapport voordat scènes definitief worden geschaald.
- **Three.js-specifics evolueren snel.** `SkeletonUtils.retarget()` heeft bekende randgevallen (proportieverschillen, off-by-one frame in `retargetClip`); test retargeting per personage. WebGPU/TSL-translucent-materialen zijn relatief nieuw — houd een WebGL2-fallbackpad voor SSS klaar.