# ToV-check — onderhoud en pre-commit

Deze site heeft een automatische tone-of-voice-check die bij elke commit
draait. De check is gebouwd op de regels uit [`tone-of-voice-alvah-site-nl.md`](tone-of-voice-alvah-site-nl.md).

## Hoe het werkt

**Script**: `scripts/check-tov.mjs`. Scant `src/pages/` en `src/content/`
(niet `docs/`, niet `research/`, niet `reference/`, niet `src/pages/spelen/`)
op acht categorieën:

| Categorie | Strict? | Wat het vangt |
|---|---|---|
| em-streepje | **blok** | `—` (U+2014). ToV: "Nooit." |
| gender | **blok** | "hij of zij", "hem of haar", "zijn of haar" |
| retorische-tag | **blok** | `, toch?` / `, right?` aan zinseinde |
| uitroepteken | info | `!` buiten `BOUW!`-programma-naam |
| verboden-woord | info | Lijst uit ToV §Vocabulaire |
| ai-cliche | info | delve, unlock, journey, empower, enz. |
| vuller | info | eigenlijk, eerlijk gezegd, letterlijk |
| aandoening-eerst | info | "dyslectische kinderen" i.p.v. "kinderen met dyslexie" |

**Blok**-categorieën hebben zero tolerance en laten de pre-commit hook
falen. **Info**-categorieën rapporteren alleen — sommige hits zijn
legitiem (zie "Bewust behouden" hieronder).

## Commando's

```bash
npm run check:tov          # volledige rapportage, exit 0
npm run check:tov:strict   # rapportage + exit 1 bij blok-hits
```

Filter op één categorie tijdens het schrijven:

```bash
node scripts/check-tov.mjs --only=em-streepje
```

## Pre-commit hook

Het hook-script staat in `.githooks/pre-commit`. De hook-path wordt
automatisch gezet door `npm install` (via de `prepare`-script in
`package.json`). Handmatig:

```bash
git config core.hooksPath .githooks
```

De hook draait alleen als er `.astro`, `.md` of `.mdx`-bestanden in
`src/pages/` of `src/content/` gestaged staan. Bij andere wijzigingen
(CSS, scripts, config) wordt 'ie overgeslagen.

Als je *echt* moet committen met een blok-hit (bv. een WIP-commit die
je zo opruimt):

```bash
git commit --no-verify -m "wip: ..."
```

Doe dat bewust — de blok-categorieën zijn door de ToV absoluut verboden
in gepubliceerde content.

## Bewust behouden afwijkingen

Deze elf hits blijven in `check:tov` verschijnen en zijn geen fouten.
Niet "fixen" zonder overleg.

**Boektitels (niet editeerbaar):**
- `src/pages/bronnen.astro:195` — "kanjer" in "Een kroon voor kanjer" (Tilanus).
- `src/content/oefeningen/een-kroon-voor-kanjer.md:2, :10` — zelfde titel.

**Functionele rolbenoeming (geen pseudo-wij):**
- `src/pages/vragen.astro:49` — "voor ons als ouders" in de driedeling
  ouders / school / Alvah. Rol-benoeming, geen hype-framing.
- `src/pages/onderwijs.astro:241` — "als ouders en school er samen niet
  uitkomen". False positive: "als" is conjunctief ("wanneer"), niet
  pseudo-wij.

**Legitiem "letterlijk" (verbatim):**
- `src/pages/dossier.astro:98` — "schrijft letterlijk:" als inleiding
  op een exact citaat.
- `src/content/vragen/bij-grote-beslissingen-luisteren.md:15` — "Leg
  letterlijk vast wat hij zegt" = verbatim opnemen.

**Uitroeptekens in counter-example-quotes:**
- `src/pages/dossier.astro:416, :418, :423` — geciteerde clichés die
  de tabel bekritiseert ("Nog even doorzetten!", "Je hebt zo je best
  gedaan!"). Het uitroepteken maakt de cliché herkenbaar.
- `src/content/oefeningen/growth-mindset-gesprek-thuis.md:31` — zelfde
  patroon ("Doorzetten!" → aanbevolen alternatief).

**Proper noun in script-filter:**
- Het dyslexie-programma `BOUW!` / `Bouw!` heeft het uitroepteken in
  de officiële naam. Het script skipt deze automatisch
  (case-insensitive).

## Toevoegingen / updates

Nieuwe bewust-behouden gevallen: voeg ze toe aan bovenstaande lijst met
bestand, regelnummer en reden. Niet aan de lijst? Fix 'm.

Nieuwe verboden woorden / AI-clichés: uitbreiden in `scripts/check-tov.mjs`
in de arrays `VERBODEN_WOORDEN_NL`, `AI_CLICHES` of `VULLERS`.
