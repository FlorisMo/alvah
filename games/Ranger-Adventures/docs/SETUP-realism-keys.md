# Accounts & sleutels voor de 3D-realisme-pijplijn — doe-het-zelf-gids

**Voor wie:** een ouder zonder programmeerachtergrond. Je hoeft niets te installeren of te coderen. Je maakt alleen een paar gratis accounts aan en kopieert een paar "sleutels" (lange tekstcodes) op een veilige plek. De bouw-agent gebruikt die sleutels later zelf.

**Laatst geverifieerd:** 22 juni 2026. Alle prijzen/limieten staan onderaan met bron + datum + zekerheidslabel. **Deze markt verandert maandelijks — controleer de prijs- en API-pagina's opnieuw vlak voordat je iets afrekent.**

---

> **UPDATE (Floris, 22 jun 2026) — we kiezen WÉL voor Meshy Pro.** Floris betaalt **eenmalig ~$20**: neem
> **één maand Meshy Pro** en **zeg op vóór de verlenging** (zet een telefoonherinnering; controleer op de
> betaalpagina dat opzeggen altijd kan). Hiermee maakt de bouw-agent de **realistische ranger** grotendeels
> automatisch (genereren + riggen). **Negeer dus hieronder het advies "reken Meshy NIET af" — dat gold voor
> de gratis route.** De vier hoofddieren (vos/ree/edelhert/wolf) blijven gratis CC0 (al geanimeerd); Meshy is
> vooral voor de ranger + zeldzamere dieren, waarvan het *animeren* soms nog handwerk blijft.
> **Gratis alternatief (als je tóch niet wilt betalen):** maak modellen met de hand via de gratis Hugging
> Face–demo's **TRELLIS / TripoSG** (MIT-licentie — output is van jou, werkt op een Mac in de browser). Het
> betalen scheelt je vooral gepriegel. Maak sowieso de gratis **Freesound**- + **xeno-canto**-sleutels aan.

## TL;DR — wat moet je nú echt aanmaken? (5 minuten leeswerk)

Maak **drie gratis accounts** aan, en bewaar **twee gratis sleutels**:

1. **Freesound** (geluiden van zoogdieren + bosgeluid) — gratis account, gratis API-sleutel. **Maak dit aan.** Sleutel ophalen op `freesound.org/apiv2/apply`.
2. **xeno-canto** (vogelgeluiden: raaf, nachtzwaluw) — gratis account + bevestig je e-mail, dan krijg je automatisch een gratis API-sleutel op je accountpagina. **Maak dit aan.**
3. **Mixamo** (het Alvah-poppetje laten "bewegen") — gratis met een Adobe-account. **Maak dit aan, maar er is GEEN sleutel** en geen automatisering: dit is handwerk in de browser. De agent kan dit niet zelf doen.

**Wat je NIET hoeft af te rekenen, en waarom:**

- **Meshy** (AI maakt de 3D-dieren/-poppetjes) — de **gratis versie werkt, maar alléén in de browser, niet via een sleutel/automatisch.** De automatische sleutel (API) zit achter een **betaald** abonnement (Pro, $20/maand). **Reken dit NIET af.** Aanbevolen gratis route: gebruik de gratis Meshy-website met de hand om losse 3D-modellen (.glb-bestanden) te maken en op te slaan. Zie deel 4 + de "Meshy-knoop" hieronder.
- **Anything World** (dieren automatisch een skelet + loopjes geven) — er is een gratis laag, maar de échte automatisch-aanstuurbare functie (het "processing"-deel) vereist volgens hun voorwaarden dat een **mens hen eerst e-mailt** om toestemming te vragen. Dus: **nog niet zelf aanmaken voor automatisering.** Als je dit wilt, stuur eerst een mailtje (zie deel 5). Reken niets af.

**De kern in één zin:** *Maak gratis accounts bij Freesound, xeno-canto en Mixamo. Bewaar de twee gratis sleutels (Freesound + xeno-canto). Reken Meshy en Anything World NIET af — die gebruik je gratis met de hand, of je stuurt eerst een mailtje.*

---

## Belangrijk vooraf: wat is een "API-sleutel" en hoe bewaar ik die veilig?

Een **API-sleutel** is een lange, geheime tekstcode (een soort wachtwoord) waarmee een programma namens jou toegang krijgt tot een dienst. Bijvoorbeeld bij Meshy ziet zo'n sleutel eruit als `msy_` gevolgd door een lange willekeurige reeks letters en cijfers.

**Regels (belangrijk):**
- **Behandel een sleutel als een wachtwoord.** Niet delen, niet in een appje plakken, niet op een website zetten.
- **Bewaar elke sleutel op één veilige plek** (bijv. je wachtwoordmanager, of een afgeschermd notitiebestand). Sommige diensten tonen de sleutel **maar één keer** — kopieer hem meteen.
- Geef elke sleutel een duidelijke naam, bijv. "Ranger-spel — Freesound".

---

## 1. Freesound — geluiden van zoogdieren (edelhert, vos, wild zwijn) + bosgeluid

**Gratis? Ja. Gratis API-sleutel? Ja.** Dit is een echte gratis-API-dienst.

**Wat je krijgt:** zoeken in een grote gratis geluidenbibliotheek en de geluiden ophalen. De geluiden staan onder Creative Commons (zie hieronder).

**Let op één technisch detail (de agent moet dit weten):** zoeken en het ophalen van *voorbeeldgeluiden* (preview-mp3/ogg) werkt met alléén de API-sleutel. Maar het downloaden van het **originele bestand in topkwaliteit** vereist een extra inlog-stap ("OAuth2"), waarbij een mens één keer in de browser toestemming geeft. Voor een spel zijn de previews vaak goed genoeg; anders is er die eenmalige handmatige toestemmingsstap nodig. Volledig onbemand originele bestanden downloaden met enkel de sleutel kan dus niet.

### Aanmaken — stap voor stap
1. Ga naar **`https://freesound.org`** en klik rechtsboven op **"Register"** (of "Join").
2. Vul gebruikersnaam, e-mail en wachtwoord in. **Bevestig je e-mail** via de link die je toegestuurd krijgt.
3. Log in.
4. Ga naar **`https://freesound.org/apiv2/apply`** (of: bovenin via je account → "API credentials" → "Apply for a new API credential").
5. Vul het formulier in: geef je "applicatie" een naam (bijv. *Ranger Adventures*) en een korte omschrijving. Akkoord met de voorwaarden.
6. Je krijgt nu twee dingen te zien:
   - een **API-sleutel** ("API key" / "Client secret" — een lange reeks letters en cijfers) → **dit is wat je bewaart.**
   - een **Client ID** (alleen nodig voor de eenmalige inlog-toestemming/OAuth2; bewaar hem ook, voor het geval dat).
7. **Kopieer de API-sleutel** en bewaar hem veilig onder de naam "Ranger-spel — Freesound".

### Licentie van de geluiden
Elk geluid heeft zijn eigen Creative-Commons-licentie: **CC0** (geen naamsvermelding nodig), **CC BY** (naam vermelden), of **CC BY-NC** (naam vermelden + niet-commercieel). Voor dit privé, niet-commerciële kinderspel zijn alle drie toegestaan. **Schoonste keuze:** filter op CC0 (dan hoef je niemand te crediteren). Filteren kan in de zoekopdracht. Tip voor de agent: gebruik het filter `license:"Creative Commons 0"` voor CC0, of `"Attribution"` / `"Attribution Noncommercial"`.

### Regio
Geen EU-blokkade bekend. Werkt in Nederland.

---

## 2. xeno-canto — vogelgeluiden (raaf, nachtzwaluw)

**Gratis? Ja. Gratis API-sleutel? Ja.** Vogelgeluiden-databank van een non-profit-gemeenschap.

**Belangrijk:** sinds **ongeveer oktober 2025** heb je een **gratis API-sleutel** nodig om via de nieuwe API (versie 3) opnames op te halen. De oude sleutelloze versie (v2) wordt uitgefaseerd. Goed nieuws: de sleutel is **gratis** en je krijgt hem automatisch zodra je e-mail bevestigd is.

> **Let op:** dit is **alleen voor vógels.** Edelhert, vos en wild zwijn zitten hier NIET in — die haal je bij Freesound (deel 1). Raaf (*Corvus corax*) en nachtzwaluw (*Caprimulgus europaeus*) zitten er wél goed in.

### Aanmaken — stap voor stap
1. Ga naar **`https://xeno-canto.org`** en maak een account aan (knop "Register"/"Sign up", meestal rechtsboven).
2. **Bevestig je e-mailadres** via de link die je krijgt. (Dit is nodig: de sleutel wordt alleen uitgegeven aan leden met een bevestigd e-mailadres.)
3. Log in en ga naar je **accountpagina**: **`https://xeno-canto.org/account`**.
4. Daar vind je je **API-sleutel** (de sleutel wordt automatisch toegekend aan bevestigde leden). Kopieer hem en bewaar hem onder "Ranger-spel — xeno-canto".

> **Praktische kanttekening:** de website van xeno-canto blokkeert geautomatiseerde bezoekers met een beveiligingscontrole. Voer stappen 1–4 dus zelf in een gewone browser uit; de agent kan deze accountpagina niet vanzelf openen.

### Licentie van de opnames
Elke opname heeft een eigen Creative-Commons-licentie en die **verschilt per opname** (vaak CC BY-NC of CC BY-NC-SA, soms CC BY of CC0). Voor een privé niet-commercieel spel is "NC" (niet-commercieel) prima. **Let op de "SA" (ShareAlike/"GelijkDelen")-variant:** die valt buiten de toegestane lijst van dit project en legt extra eisen op aan afgeleid werk. **Advies:** laat de agent per opname het licentieveld (`lic`) lezen en sla SA-opnames over; bewaar per geluid de licentie in een logje.

### Regio
Werkt wereldwijd, dus ook in Nederland.

---

## 3. Mixamo — het Alvah-poppetje een skelet + loopjes geven (HANDWERK, geen sleutel)

**Gratis? Ja, met een gratis Adobe-account. Gratis API/automatisch? NEE — er is geen API.**

Mixamo (van Adobe) is **alleen via de website** te gebruiken; er is **geen sleutel en geen automatische toegang.** Dat betekent: het "riggen" (skelet geven) en animeren van het humanoïde Alvah-poppetje is een **handmatige stap in de browser** die een mens doet. De bouw-agent kan dit niet zelf.

### Gebruiken — stap voor stap (handmatig)
1. Ga naar **`https://www.mixamo.com`**.
2. Log in met een **Adobe-account** (gratis aan te maken; gebruik je e-mailadres). Heb je er nog geen, klik dan op "Create an account".
3. Klik in de editor op **"Upload Character"** en kies je 3D-bestand (bijv. de gegenereerde Alvah-basis, als .fbx/.obj/.zip).
4. Volg de aanwijzingen om de gewrichten te plaatsen; Mixamo maakt automatisch een skelet (de "auto-rigger").
5. Kies links een **animatie** (bijv. "Idle", "Walking") uit de bibliotheek.
6. Klik op **"Download"** en kies een formaat (bijv. **FBX** of **glTF/GLB**). Bewaar het bestand voor het spel.

> **Let op (recente wijziging):** Adobe heeft het *bewaren* van geüploade modellen op hun servers stopgezet. Je kunt nog steeds uploaden en riggen, maar het model wordt niet bewaard — **download het meteen** na het riggen.

### Licentie
Mixamo-personages en -animaties zijn rechtenvrij ("royalty-free") te gebruiken in commerciële én niet-commerciële projecten, mits je je aan Adobe's gebruiksvoorwaarden houdt (downloaden moet een mens doen, niet automatisch). Prima voor dit spel. *(Controleer de exacte Adobe-voorwaarden bij twijfel — zie bronnen.)*

### Regio
Werkt in Nederland (Adobe-account vereist).

---

## 4. Meshy — AI maakt de 3D-dieren en -poppetjes (gratis = ALLEEN met de hand)

**Gratis? Ja (beperkt). Gratis API-sleutel? NEE — de API zit achter een betaald abonnement.**

Dit is de belangrijkste valkuil, dus lees dit goed:

- De **gratis Meshy** geeft je **100 "credits" per maand** waarmee je in de **browser** 3D-modellen kunt genereren (ruwweg een handvol getextureerde modellen per maand). Dat werkt prima.
- **Maar de automatische sleutel (API) is NIET inbegrepen in gratis.** In Meshy's eigen prijstabel staat bij "Free" expliciet een kruisje (❌) bij "API Access", en een vinkje (✅) pas vanaf **Pro ($20/maand)**.
- **Reken dus NIETS af.** Als de gids zegt "vul hier je Meshy-sleutel in", dan is dat **niet** mogelijk op gratis.

### Wat moet je dan doen? — de gratis route (aanbevolen)
**Gebruik de gratis Meshy-website met de hand** om 3D-modellen te maken en als bestand op te slaan. Dan hoeft de agent ze niet zelf te genereren — jij levert de kant-en-klare 3D-bestanden aan.

1. Ga naar **`https://www.meshy.ai`** en klik op "Sign up" / "Get started".
2. Aanmelden kan met **Google** (één klik) of met **e-mail** (je krijgt een **6-cijferige code** in je inbox; die vul je in).
3. Je zit nu op de gratis laag (100 credits/maand).
4. Maak in de browser een model ("Text to 3D" of "Image to 3D"), wacht tot het klaar is, en klik op **"Download"** → kies **GLB**. Bewaar het bestand voor het spel.

### Licentie op de gratis laag — let op
Modellen die je op de **gratis** laag maakt staan onder **CC BY 4.0**. Dat betekent: je mág ze gebruiken (ook in een spel), **maar je moet Meshy crediteren**, bijvoorbeeld met de regel: *"Model created with Meshy – CC BY 4.0 License"* in de aftiteling/omschrijving. Op de **betaalde** laag krijg je privé-eigendom zonder verplichte vermelding — maar dat hoeft niet voor dit project.

### Twee extra aandachtspunten (privacy)
- Meshy slaat data op in de VS (met EU-standaardclausules).
- Inhoud van niet-zakelijke gebruikers (dus ook gratis en Pro) **kan gebruikt worden om hun AI te trainen**; een opt-out lager dan "Enterprise" is niet bevestigd. Voor een spel met een kindgelijkenis is dat het overwegen waard. Upload dus liever geen herkenbare privéfoto's van het kind.

---

## De "Meshy-knoop": wat is de beste GRATIS route voor automatisch 3D genereren?

De agent zou idealiter zélf 3D-modellen genereren via een sleutel. Maar Meshy's sleutel kost geld. De gratis alternatieven:

| Optie | Wat het is | Werkt het voor een ouder zonder krachtige computer? |
|---|---|---|
| **(a) Zelf TRELLIS / TripoSG draaien** | Gratis, open-source AI-modellen (MIT-licentie) die je op je eigen computer draait. | **Nee.** Vereist een **NVIDIA-videokaart**: TRELLIS heeft **minstens 16 GB** videogeheugen nodig; TripoSG iets minder (~6–8 GB). Een gewone laptop of een **Mac heeft dit niet.** Niet realistisch. |
| **(b) Gratis online via Hugging Face (ZeroGPU)** | Sommige van die modellen draaien als gratis "Space" online, technisch ook automatisch aanroepbaar. | **Nauwelijks.** De gratis laag geeft maar **~3,5 minuten GPU per dag**, met wachtrijen, en alleen voor bepaalde (Gradio-)Spaces. Niet geschikt voor een echte productie-pijplijn. |
| **(c) Meshy gratis website, met de hand** | Jij maakt de .glb-bestanden zelf in de browser (deel 4). | **Ja — dit is de realistische gratis route.** |

> **Aanbeveling voor een niet-ontwikkelaar zonder NVIDIA-GPU (zeker op een Mac): optie (c)** — gebruik de gratis Meshy-website met de hand en lever de .glb-bestanden aan. Wil je tóch automatisch genereren via een sleutel, dan is **Meshy Pro ($20/maand)** de eenvoudigste weg — maar dat is een betaald abonnement en dus buiten de "alles gratis"-afspraak.

---

## De "ranger-rig"-vraag: hoe geef je het Alvah-poppetje automatisch beweging?

- **Mixamo** is gratis en kan het humanoïde poppetje riggen + animeren, **maar alleen met de hand** in de browser (geen sleutel). Dit is de meest betrouwbare gratis route — het is alleen geen automatische stap.
- **Anything World** kan volgens zijn documentatie wél humanoïden/bipeds automatisch riggen via een sleutel (niet alleen dieren) — dat zou de automatiseerbare variant zijn. **Maar:** hun voorwaarden zeggen dat het automatische "processing"-deel pas mag na een **e-mail waarin een mens de use-case uitlegt en toestemming krijgt.** Een agent kan dat niet zelf regelen. Bovendien is een **zichtbare vermelding "rigged/animated by Anything World"** verplicht, en is de gratis-limiet niet openbaar.

> **Aanbevolen ranger-rig-route:** doe de rig van het Alvah-poppetje **handmatig via Mixamo** (gratis, rechtenvrij, betrouwbaar). Wil je het automatiseren, **mail dan eerst Anything World** (zie deel 5) en reken in op een verplichte creditregel — maar Mixamo is de pragmatische gratis keuze.

---

## 5. Anything World — dieren (en evt. poppetje) automatisch riggen + animeren (EERST MAILEN)

**Gratis? Er is een gratis laag. Gratis API voor automatisering? Ten dele — geblokkeerd door hun voorwaarden.**

- Er is een gratis "Individual"-laag (voor studenten/persoonlijk gebruik, bedoeld voor projecten met < $100K omzet — dat past hier).
- Het **zoeken in hun kant-en-klare modelbibliotheek** lijkt zelf-bediening via een sleutel.
- **Maar** het deel dat je nodig hebt — je **eigen** model automatisch laten riggen/animeren ("processing API") — vereist volgens de voorwaarden dat je **hen eerst e-mailt en toestemming krijgt** ("contact us explaining your use case"). De API is bovendien als **experimenteel** bestempeld. De exacte gratis-limiet (hoeveel modellen per maand) is **niet openbaar**.
- Output: je bent eigenaar van wat je maakt, **maar** met een **verplichte, zichtbare vermelding** dat Anything World het model heeft gerigd/geanimeerd.

### Als je dit wilt gebruiken — stap voor stap
1. **Stuur eerst een mailtje** naar **`hello@anything.world`**: leg uit dat het om een privé, niet-commercieel Nederlands kinderspel gaat, dat je hun "processing API" (auto-rig + animate) wilt gebruiken voor enkele dieren (en mogelijk een humanoïde figuur), en vraag toestemming + de gratis-limiet.
2. Pas ná akkoord: maak een account op **`https://app.anything.world/register`**.
3. Haal je **API-sleutel** op via je profielpagina: **`https://app.anything.world/profile`** (dezelfde sleutel werkt voor zowel de bibliotheek- als de processing-API).
4. Plan een **zichtbare creditregel** in het spel in, bijv. *"Enkele dieren zijn automatisch gerigd en geanimeerd door Anything World."*

### Dieren die het aankan (volgens hun docs)
Viervoeters (hond/kat-achtigen, hoefdieren, beer-achtigen, schildpad), vogels (vliegend/lopend/huppend) en ook bipeds/mens-figuren. Géén slangen en géén kikkers/amfibieën — die blijven handwerk.

---

## Samenvattende tabel

| Dienst | Gratis? | Gratis API (sleutel)? | Licentie van output | Wat moet je aanmaken? | Terugval als geen gratis-API |
|---|---|---|---|---|---|
| **Freesound** (zoogdier­geluiden, ambiance) | Ja | **Ja** | Per geluid: CC0 / CC BY / CC BY-NC (filterbaar) | Gratis account + API-sleutel via `freesound.org/apiv2/apply` | n.v.t. (is gratis-API). Origineel-kwaliteit downloaden vergt eenmalige OAuth2-toestemming; previews werken met sleutel |
| **xeno-canto** (vogel­geluiden) | Ja | **Ja** | Per opname CC (vaak BY-NC / BY-NC-SA) — filteren, SA mijden | Gratis account + e-mail bevestigen → sleutel op `xeno-canto.org/account` | n.v.t. (is gratis-API) |
| **Mixamo** (humanoïde rig+animatie) | Ja | **Nee** (geen API) | Rechtenvrij, commercieel + niet-commercieel | Gratis Adobe-account; handwerk in browser | Handmatige browser-stap; download meteen (modellen worden niet bewaard) |
| **Meshy** (AI 3D-genereren) | Ja (100 cred./mnd, browser) | **Nee** (API = Pro $20/mnd) | Gratis = **CC BY 4.0** (Meshy crediteren); Pro = privé | Gratis account (Google of e-mailcode) — **niet afrekenen** | Gratis Meshy-website met de hand .glb's exporteren (aanbevolen). Of Pro $20/mnd voor de sleutel |
| **Anything World** (auto-rig+animate dieren/biped) | Gratis laag (limiet onbekend) | **Deels — geblokkeerd door voorwaarden** | Je bezit output, **maar** verplichte zichtbare vermelding | **Eerst mailen** `hello@anything.world`; daarna account + sleutel op `app.anything.world/profile` | Voor dieren: handwerk in Blender; voor humanoïde: Mixamo (handmatig) |

---

## Bronnen (met toegangsdatum 22-06-2026 en zekerheidslabel)

**Zekerheid:** *zeker* = bevestigd uit de eigen primaire bron (prijspagina/docs/voorwaarden); *waarschijnlijk* = primaire bron, maar indirect of afgeleid; *onzeker* = niet uit een primaire bron kunnen bevestigen.

### Meshy
- Prijs/plannen — gratis = 100 credits/mnd, licentie CC BY 4.0, **API Access ❌ op Free / ✅ op Pro ($20/mnd, privé-eigendom)**: Meshy Help Center, "Meshy Pricing Plans: Free, Pro, Studio, Enterprise" — https://help.meshy.ai/en/articles/12062933-meshy-pricing-plans-free-pro-studio-enterprise — 22-06-2026 — **zeker**
- Prijspagina (Free $0; Pro $20/mnd met API access): https://www.meshy.ai/pricing — 22-06-2026 — **zeker**
- API = "pay-before-you-go", credits kopen vanuit abonnement-instellingen (bevestigt: API betaald): Meshy API Docs, Pricing — https://docs.meshy.ai/en/api/pricing — 22-06-2026 — **zeker**
- API-sleutel aanmaken op `meshy.ai/settings/api`; sleutel-formaat `msy-`/`msy_...`; test-sleutel `msy_dummy_api_key_for_test_mode_12345678` (verbruikt geen credits, alleen testen): Meshy API Docs, Quickstart/Authentication — https://docs.meshy.ai/en/api/quick-start — 22-06-2026 — **zeker**
- Gratis-laag output CC BY 4.0 + verzoek om Meshy te crediteren; betaald = privé-eigendom: Meshy Help Center, commercieel gebruik — https://help.meshy.ai/en/articles/9992001-can-i-use-my-generated-assets-for-commercial-projects — 22-06-2026 — **zeker**
- Data opgeslagen in VS / niet-zakelijke inhoud kan voor training gebruikt worden: Meshy privacy-policy + "Is my asset safe" — https://www.meshy.ai/privacy-policy / https://help.meshy.ai/en/articles/9991999-is-my-asset-safe — 22-06-2026 — **zeker** (training-default); opt-out < Enterprise **onzeker**
- "Gratis-API eindigde 20 maart 2025" (in secundaire bronnen) — **niet** teruggevonden op een Meshy-pagina — **onzeker**

### Anything World
- Voorwaarden: "Usage of the processing API … is subject to authorization, you need to contact us explaining your use case": Anything World Terms of Use — https://everythinguniver.se/terms-of-use — 22-06-2026 — **zeker**
- Verplichte zichtbare vermelding "rigged and animated automatically by Anything World"; je bezit "Your Creations": zelfde Terms of Use — 22-06-2026 — **zeker**
- Gratis maandelijkse allowance bestaat ("free allowance of model processing credits which renews every month"), exact aantal **niet** gepubliceerd; e-mailwaarschuwing "100 requests away": Anything World docs + FAQ — https://anything-world.gitbook.io/anything-world/api/rest-api-references / https://anything-world.gitbook.io/anything-world/master/faq — 22-06-2026 — **zeker** (tekst) / **onzeker** (exact aantal)
- Sleutel aanmaken via Dashboard `app.anything.world/profile`; registreren `app.anything.world/register`: docs + officiële Python-client README — https://anything-world.gitbook.io/anything-world/api/rest-api-references — 22-06-2026 — **zeker**
- Ondersteunt bipeds/humanoïden én viervoeters/vogels (geen slang/kikker); contact `hello@anything.world`: docs "Expected Results by Category" + REST references — https://anything-world.gitbook.io/anything-world/quickstart/generate-anything-quickstart/expected-results-by-category — 22-06-2026 — **zeker**
- Gratis "Individual"-laag, omzet-grens < $100K: prijspagina — https://everythinguniver.se/pricing — 22-06-2026 — **zeker**

### xeno-canto
- API v3 vereist een API-sleutel; v2 wordt uitgefaseerd: wrapper-docs die de eis citeren — https://joesiu.github.io/xeno-canto-api-ts/ — 22-06-2026 — **zeker** (eis); v2-volledige-stop **onzeker**
- Sleutel gratis voor leden met bevestigd e-mailadres, op de Account-pagina `xeno-canto.org/account`; sleutel via `key=`-parameter: API-directory + wrapper-docs — https://publicapi.dev/xeno-canto-api — 22-06-2026 — **zeker** (sleutel/locatie) / **waarschijnlijk** (exacte knop op de pagina; site is bot-geblokkeerd)
- "Starting October 10, 2025 users need a Xeno-canto API key to download recordings" — meerdere secundaire snippets, eigen pagina niet te laden (bot-blokkade) — 22-06-2026 — **waarschijnlijk**
- Opnames per stuk Creative-Commons (o.a. CC BY-NC-SA via `lic`-veld): API-directory + Wikipedia "Xeno-canto" — https://publicapi.dev/xeno-canto-api / https://en.wikipedia.org/wiki/Xeno-canto — 22-06-2026 — **zeker** (per-opname CC) / **waarschijnlijk** (exacte mix)

### Freesound
- API gratis; twee methoden (token-sleutel + OAuth2); sommige acties OAuth2-only: Freesound API Authentication — https://freesound.org/docs/api/authentication.html — 22-06-2026 — **zeker**
- **Originele-bestand-download vereist OAuth2**; zoeken + previews werken met sleutel: Freesound API Resources — https://freesound.org/docs/api/resources_apiv2.html — 22-06-2026 — **zeker**
- Sleutel aanvragen op `freesound.org/apiv2/apply`: Authentication-docs — 22-06-2026 — **zeker**
- Per geluid CC0 / CC BY / CC BY-NC, filterbaar (`filter=license:"Creative Commons 0"` enz.): Freesound FAQ + Resources — https://freesound.org/help/faq/ / https://freesound.org/docs/api/resources_apiv2.html — 22-06-2026 — **zeker**

### Mixamo
- Gratis met Adobe-account; **alleen web, geen API**; upload-character auto-rigger; download FBX/GLB; commercieel + niet-commercieel rechtenvrij: Adobe Help "Upload and rig 3D characters with Mixamo" + Mixamo FAQ + Adobe community ("Mixamo is only available on the web and cannot be accessed through an API") — https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html / https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html / https://community.adobe.com/questions-696/is-there-any-way-to-use-mixamo-to-rigging-model-via-api-589777 — 22-06-2026 — **zeker** (geen API, gratis) / **waarschijnlijk** (exacte licentievoorwaarden — controleer bij twijfel)

### Zelf-hosten als gratis Meshy-alternatief (TRELLIS / TripoSG / Hugging Face)
- **TRELLIS** = MIT-licentie; vereist **NVIDIA-GPU met ≥16 GB** videogeheugen (getest op A100/A6000): github.com/microsoft/TRELLIS README — https://raw.githubusercontent.com/microsoft/TRELLIS/main/README.md — 22-06-2026 — **zeker**
- **TripoSG** = MIT; NVIDIA-GPU, lager videogeheugen (~6–8 GB): VAST-AI-Research/TripoSG + model card — https://github.com/VAST-AI-Research/TripoSG / https://huggingface.co/VAST-AI/TripoSG — 22-06-2026 — **zeker** (MIT/NVIDIA) / **waarschijnlijk** (exacte GB)
- **Hugging Face ZeroGPU** gratis = ~3,5 min GPU/dag, alleen Gradio-SDK-Spaces, wachtrijen: HF Docs ZeroGPU — https://huggingface.co/docs/hub/en/spaces-zerogpu — 22-06-2026 — **zeker** (gratis-quota klein, Gradio-only) / **waarschijnlijk** (headless via gradio_client haalbaar maar onpraktisch)

---

*Einde gids. Twijfel je bij het afrekenen? De vuistregel van dit project: betaal niets. Alleen Freesound, xeno-canto (sleutels) en Mixamo + Meshy-gratis-website (handwerk) zijn nodig voor de gratis route.*
