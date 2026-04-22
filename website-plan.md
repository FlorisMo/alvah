# Website-plan voor Alvah's dossier

**Status**: definitief. Klaar om aan Claude Code te voeren.

**Doel**: vanaf een lege GitHub-repo een werkende, op maat gemaakte, op een custom domain gehoste website krijgen die Alvah's dossier toegankelijk maakt voor familie, school en behandelaars. Fungeert als gezamenlijk werkdocument: alle wetenschappelijke onderbouwing, interventies, voortgang én openstaande vragen op één plek.

**Hoe dit document te gebruiken**: elke fase is een apart blok. Binnen een fase staan genummerde stappen. Bij elke stap waar Claude Code aan zet is, staat een concrete prompt als codeblok. Je kopieert die, plakt hem in Claude Code, laat hem runnen, controleert de validatie-gate aan het eind, en gaat pas dan naar de volgende stap.

**Drie doctrines die we toepassen**:

1. **Surgical changes**: elke wijziging raakt alleen wat de opdracht zegt. Geen "verbeteringen" van aanliggende code.
2. **Goal-driven execution**: elke stap heeft een meetbaar eind-criterium. Zonder groene validatie-gate ga je niet door.
3. **Simplicity first**: minimum wat het probleem oplost, niets speculatiefs.

---

## Wat je vooraf beslist (2 minuten)

| Token | Jouw waarde |
|---|---|
| `{{BRAND}}` | Werktitel van de site — bv. "Voor Alvah" |
| `{{DOMAIN}}` | Het custom domein — bv. `voor-alvah.nl` |
| `{{GITHUB_USER}}` | Je GitHub-gebruikersnaam |
| `{{REPO}}` | De reponaam, aanbevolen: `voor-alvah` |

**Privacy**: nergens in de site komt een achternaam van Alvah, familie, school-medewerkers of behandelaars. Overal alleen voornamen of rollen ("de gedragswetenschapper van het SWV", "Alvah's leerkracht"). Deze regel is ingebakken in alle content-prompts hieronder.

---

## Fase 0 — Prerequisites (30 minuten, éénmalig)

### Stap 0.1 — Check Claude Code
```bash
claude --version
```
Zo niet:
- macOS/Linux: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows PowerShell (niet als admin): `irm https://claude.ai/install.ps1 | iex`

Docs: https://docs.claude.com/en/docs/claude-code/overview

### Stap 0.2 — Check Node.js
```bash
node --version
```
Moet v22.x+ zijn. Zo niet:
- macOS: `brew install node` of [nvm](https://github.com/nvm-sh/nvm)
- Windows: `winget install OpenJS.NodeJS.LTS`
- Linux: distro-pakket of nvm

**Nooit `sudo npm install -g`.** Bij EACCES: `npm config set prefix '~/.npm-global'` of nvm.

Bron: https://nodejs.org/en/download

### Stap 0.3 — Check git
```bash
git config --global user.name
git config --global user.email
```
Zo niet:
```bash
git config --global user.name "Jouw Naam"
git config --global user.email "jouw@email.com"
```

### Stap 0.4 — Installeer GitHub CLI
- macOS: `brew install gh`
- Windows: `winget install --id GitHub.cli`
- Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

```bash
gh auth login
gh auth status
```

Bron: https://cli.github.com

### Stap 0.5 — Domein gereed?
Registrar-opties:
- https://www.hostnet.nl
- https://www.transip.nl
- https://www.cloudflare.com/products/registrar

### Validatie-gate fase 0
- [ ] `claude --version` → versienummer
- [ ] `node --version` → v22+
- [ ] `git config --global user.name` → gezet
- [ ] `gh auth status` → logged in
- [ ] `{{DOMAIN}}` is geregistreerd

---

## Fase 1 — Lege repo en project opzetten (15 minuten)

### Stap 1.1 — Maak lege GitHub-repo
Op https://github.com/new:
- Repository name: `{{REPO}}`
- Description: "Dossier en website voor Alvah"
- **Public**
- **Niet** README/.gitignore/license aanvinken — totaal leeg
- Create repository

### Stap 1.2 — Clone lokaal
```bash
git clone https://github.com/{{GITHUB_USER}}/{{REPO}}.git
cd {{REPO}}
```

### Stap 1.3 — Open in VS Code
```bash
code .
```

Open geïntegreerde terminal (Ctrl+` / Cmd+`).

### Stap 1.4 — Start Claude Code
```bash
claude
```

### Validatie-gate fase 1
- [ ] Repo bestaat op `https://github.com/{{GITHUB_USER}}/{{REPO}}`
- [ ] Lokaal gecloned
- [ ] VS Code open in projectmap
- [ ] Claude Code draait in VS Code-terminal

---

## Fase 2 — Scaffold met Claude Code (45–60 minuten)

### Stap 2.1 — Plak deze scaffold-prompt in Claude Code

````text
Bouw een statische Astro-website naar GitHub Pages. Scaffold-fase: alle pagina's, routes, layout, design en lege content collections. Content volgt in latere sessies.

## Surgical contract
Werk alleen aan wat deze prompt vraagt. Geen features die niet genoemd zijn. Geen auth, database, CMS, analytics, cookie-banner, i18n, dark mode, animaties. Bij twijfel één concrete vraag per keer.

## Stack (vast)
- Astro v5 met content collections (Content Layer API)
- Vanilla CSS met CSS custom properties (geen Tailwind)
- Zero JS op pagina's zonder interactie; kleine islet voor oefeningen-filter en vragen-filter
- Deploy via officiële `withastro/action@v6` naar GitHub Pages

## Projectgegevens
- Site titel: {{BRAND}}
- Custom domain: {{DOMAIN}}
- GitHub user: {{GITHUB_USER}}
- Primaire taal: Nederlands (nl-NL)
- Tijdzone: Europe/Amsterdam

## Design (kritisch)

Typografie:
- Heading: Fraunces (variable, 300/400/500/600/700) via Google Fonts
- Body: Inter Tight (300/400/500/600) via Google Fonts
- Base 16.5px, line-height 1.65

Kleurpalet (exact als CSS custom properties op :root):
- --green: #1e4d32
- --green-deep: #123621
- --green-soft: #f0f5ec
- --green-line: #c8d6c0
- --ink: #1a1a1a
- --ink-soft: #4a4a4a
- --ink-muted: #7a7a7a
- --paper: #fdfcf8
- --line: #e8e5dc
- --line-soft: #f0ede3
- --accent-warm: #d9b89a
- --red-warn: #9b3d2e

Layout:
- max-width 900px content wrapper (1100px voor cockpit en vragen-pagina)
- 32px side padding, 24px op mobile <720px
- 72-96px vertical section padding desktop

Section-kop patroon:
```html
<h2 class="section-head"><span class="num">01</span>Wie is Alvah</h2>
```
.num = italic Fraunces 300, --green, 0.58em groot.

AVOID (expliciet niet doen):
- symmetrische hero met centered gradient
- blauw-paars gradient
- centre-aligned sans-serif body text
- generieke stock illustraties
- emoji-heavy callouts
- marketing-speak ("baanbrekend", "revolutionair")
- rounded cards met shadow-lg (Framer/Webflow look)
- utility class soup
- dark mode, cookie-banner, loading spinner, lightbox, carousel

Visueel doel: redactioneel, wetenschappelijk-rustig document. Geen SaaS-landingpage.

## Pagina-structuur

10 routes plus 404:

- `/` → src/pages/index.astro (cockpit — navigatie-hub)
- `/samenvatting` → src/pages/samenvatting.astro
- `/dossier` → src/pages/dossier.astro
- `/resultaten` → src/pages/resultaten.astro
- `/wetenschap` → src/pages/wetenschap.astro
- `/onderwijs` → src/pages/onderwijs.astro
- `/doubleren` → src/pages/doubleren.astro
- `/oefeningen` → src/pages/oefeningen.astro
- `/voortgang` → src/pages/voortgang.astro
- `/vragen` → src/pages/vragen.astro
- `/bronnen` → src/pages/bronnen.astro
- `/404` → src/pages/404.astro

Elke pagina gebruikt `src/layouts/BaseLayout.astro` met:
- `<head>`: title/description als props, charset, viewport, preconnect Google Fonts, Fraunces + Inter Tight stylesheet
- `<meta name="robots" content="noindex, nofollow">` op elke pagina
- Globale CSS-reset, custom properties, typografie, utility classes
- Sticky nav met 11 routes (10 + home-icoon), huidige pagina aria-current="page" met subtiele highlight
- Footer met privacy-notitie, "Laatst bijgewerkt: [build date]", en: "Voor Alvah. Om gezien te worden om wie hij is — niet om wat hij nog niet kan."

Alle pagina's krijgen placeholder "Deze pagina wordt later ingevuld." — behalve `/` (cockpit) en `/samenvatting`, die krijgen volledige structuur.

### `/` (cockpit)

Navigatie-hub en huidige stand. Structuur:

1. Minimale hero: H1 "{{BRAND}}", lede-alinea in Fraunces 300 (1 zin: "Alles op één plek voor wie met Alvah werkt — thuis, op school, bij behandelaars.")
2. Metadata-grid: 4 korte feiten (Alvah bijna 8, De Mheen Apeldoorn, stamgroep Inktvissen, context PKU + dyslexie-aanvraag + ADHD-achtig)
3. Sectie "Huidige stand" — 3 data-chips naast elkaar:
   - "Laatste milestone": nieuwste milestone titel + datum uit getCollection('milestones'), link naar /voortgang
   - "Actieve interventies": aantal oefeningen met evidence sterk of matig uit getCollection('oefeningen'), link naar /oefeningen
   - "Openstaande vragen": aantal items uit getCollection('vragen') met status open of in-gesprek, link naar /vragen

4. Sectie "Navigatie" — 10 kaarten in 3-koloms grid, per kaart:
   - Pagina-nummer (italic Fraunces 300 groot in --green)
   - Titel, één zin beschrijving
   - Subtiele border --line, hover --green-soft
   
   Kaarten:
   
   | Nr | Titel | Beschrijving |
   |---|---|---|
   | 01 | Samenvatting | Het verhaal in één pagina, voor wie net aansluit |
   | 02 | Dossier | Uitgebreid onderzoeksrapport met wetenschappelijke onderbouwing |
   | 03 | Resultaten | Cito, Pluspunt en onderwijsbehoeften SWV |
   | 04 | Wetenschap | Dieper inzicht: PKU, dyslexie, executieve functies |
   | 05 | Onderwijs | Nederlandse schoolprocessen, rechten, escalatie |
   | 06 | Doubleren | Wetenschap en beslismatrix bij overweging verlengde bouw |
   | 07 | Oefeningen | Filterbare catalogus van interventies en tools |
   | 08 | Voortgang | Tijdlijn met milestones en lopend onderzoek |
   | 09 | Vragen | Openstaande vragen voor ons, school en met Alvah |
   | 10 | Bronnen | Alle geraadpleegde literatuur en verwijzingen |

5. Sectie "Voor wie met Alvah werkt" — klein kadertje: "Deze site is niet openbaar geïndexeerd maar wel deelbaar. Spreek ons gerust aan als iets niet klopt of als je iets mist. Dit is een werkdocument, geen vast gegeven."

### `/samenvatting`

Verhalende samenvatting (voormalige homepage). Voor nu placeholder-structuur met 8 secties klaar, gevuld met "wordt later geladen". Wordt in Fase 5 gevuld.

## Content collections

Maak `src/content.config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const oefeningen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/oefeningen' }),
  schema: z.object({
    titel: z.string(),
    domein: z.array(z.enum([
      'technisch-lezen',
      'begrijpend-lezen',
      'spelling',
      'rekenen',
      'werkgeheugen',
      'aandacht-focus',
      'planning',
      'zelfbeeld-faalangst',
      'motoriek',
      'beweging',
      'emotieregulatie',
      'compenserend',
    ])),
    context: z.array(z.enum(['thuis', 'school', 'specialist'])),
    duur: z.enum(['kort-5min', 'gemiddeld-10-15min', 'lang-20min-plus', 'nvt']),
    kosten: z.enum(['gratis', 'onder-50', '50-200', 'meer-dan-200', 'abonnement', 'vergoed']),
    evidence: z.enum(['sterk', 'matig', 'zwak', 'praktijkclaim']),
    korte_omschrijving: z.string(),
    bronnen: z.array(z.object({
      tekst: z.string(),
      url: z.string().url().optional(),
    })).default([]),
  }),
});

const milestones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/milestones' }),
  schema: z.object({
    datum: z.coerce.date(),
    titel: z.string(),
    samenvatting: z.string(),
    tags: z.array(z.string()).default([]),
    oefeningen_actief: z.array(z.string()).default([]),
    open_onderzoek: z.boolean().default(false),
  }),
});

const vragen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/vragen' }),
  schema: z.object({
    titel: z.string(),
    voor: z.enum(['ons', 'school', 'alvah']),
    status: z.enum(['open', 'in-gesprek', 'beantwoord']).default('open'),
    urgentie: z.enum(['hoog', 'gemiddeld', 'laag']).default('gemiddeld'),
    waarom: z.string(),
    wie_beantwoordt: z.string().optional(),
    antwoord_milestone: z.string().optional(), // slug van milestone waar antwoord staat
    gerelateerde_milestones: z.array(z.string()).default([]),
    gerelateerde_oefeningen: z.array(z.string()).default([]),
    aangemaakt: z.coerce.date(),
    beantwoord_op: z.coerce.date().optional(),
  }),
});

export const collections = { oefeningen, milestones, vragen };
```

Maak mappen:
- `src/content/oefeningen/` (.gitkeep)
- `src/content/milestones/` (.gitkeep)
- `src/content/vragen/` (.gitkeep)

## /oefeningen pagina

`getCollection('oefeningen')` → grid van cards (serverside). Filter-UI met 4 filters: domein (multi-checkbox), context (multi-checkbox), evidence (radio: alle / matig+ / sterk), kosten (toggle: alleen gratis). Filter-logica via klein vanilla `<script>` block dat CSS-klassen toggled. Cards: titel, evidence-badge (sterk=groen, matig=--accent-warm, zwak=oranje, praktijkclaim=--red-warn), domein-tags, context-tag, duur, kosten, korte omschrijving, bronnen-expander. Leeg-state: "Nog geen oefeningen in de catalogus."

## /voortgang pagina

`getCollection('milestones')` gesorteerd op datum desc. Verticale tijdlijn met jaar-headers. Per milestone: datum (NL-formaat), titel H3, samenvatting, tags. Indien `oefeningen_actief` gevuld: lijst "Actief op dat moment" met links naar `/oefeningen#slug`. Indien `open_onderzoek: true`: --accent-warm border + label "Open onderzoek", met link naar `/vragen` voor de concrete vragen die hieruit voortkwamen. Anker-sectie `#onderzoek` aan eind met lijst open-onderzoek-items. Leeg-state: "Tijdlijn start zodra eerste milestone is vastgelegd."

## /vragen pagina

Belangrijkste nieuwe pagina. Structuur:

1. Intro (1-2 alinea's): "Een werkdocument leeft van wat we nog niet weten. Deze pagina verzamelt de openstaande vragen — gegroepeerd naar wie ze kan beantwoorden. Sommige vragen zijn voor ons als ouders. Andere stellen we aan school of behandelaars. En een deel is van en met Alvah zelf — hij kent zichzelf het beste, en zijn antwoorden tellen zwaar."

2. Filter-strip bovenaan (klein vanilla JS islet):
   - Voor: alle / ons / school / alvah (radio)
   - Status: alle / open / in-gesprek / beantwoord (radio)
   - Urgentie: alle / hoog (toggle)

3. Drie hoofdsecties (H2), één per `voor`-categorie, met italic cijfer prefix:
   - **01. Voor ons** — "Wat wij zelf moeten uitzoeken of regelen."
   - **02. Voor school** — "Wat we aan school en behandelaars willen vragen."
   - **03. Voor en met Alvah** — "Vragen die alleen hij kan beantwoorden, of die zijn eigen ervaring centraal zetten."

   Elke sectie krijgt een korte kader-zin:
   - Voor ons: "Grotendeels onze eigen verantwoordelijkheid — plannen, bellen, opvragen."
   - Voor school: "Partners in zijn ontwikkeling. Vragen die horen bij een transparant schoolpartnership."
   - Voor en met Alvah: "Niet over hem heen, maar met hem. Zijn perspectief is een bron, geen bijzaak."

4. Per vraag: kaart met
   - Titel (H3)
   - Status-badge (open = --accent-warm, in-gesprek = --green-soft, beantwoord = --green met strikethrough titel)
   - Urgentie-indicator (alleen bij hoog: klein --red-warn label)
   - Waarom (paragraph)
   - Wie beantwoordt (compact, italic)
   - Gerelateerd: links naar milestones / oefeningen indien gevuld
   - Indien beantwoord: link "Zie antwoord in milestone X"

5. Helemaal onderaan: klein kadertje "Hoe werkt deze pagina":
   - Vragen worden toegevoegd als we merken dat we iets niet weten
   - Status wisselt van open → in-gesprek → beantwoord
   - Een beantwoorde vraag blijft staan, met link naar waar het antwoord ligt — zo zie je ook terug wat opgelost is

Leeg-state: "Nog geen vragen gelogd. Dat komt snel."

## /404

H1 "Niet gevonden", alinea, link terug naar /.

## robots.txt

`public/robots.txt`:
```
User-agent: *
Disallow: /
```

## CNAME

`public/CNAME`:
```
{{DOMAIN}}
```

## astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://{{DOMAIN}}',
  build: { format: 'directory' },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
```

## GitHub Actions workflow

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Build with Astro
        uses: withastro/action@v6
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

## package.json

Alleen: astro (v5+), @astrojs/check (dev), typescript (dev). Geen Tailwind, geen framework-integraties.

## .gitignore

Standaard Astro: `node_modules`, `dist`, `.astro`, `.env`, `.env.production`, `.DS_Store`, `pnpm-debug.log*`.

## CLAUDE.md in repo-root

```markdown
# Werkinstructies voor Claude Code

Dit is Alvah's dossier-site. Lees dit voordat je wijzigingen maakt.

## Absolute regels
1. Geen achternamen van personen in content of code. Alleen voornamen of rollen.
2. Geen tracking, analytics, cookies of externe scripts.
3. Geen Tailwind, geen CSS-in-JS, geen nieuwe frameworks.
4. robots.txt blijft op Disallow.
5. Elke wijziging raakt alleen bestanden die de opdracht noemt.

## Stack
- Astro v5 met content collections
- Vanilla CSS met custom properties in src/styles/global.css
- Fraunces (headings) + Inter Tight (body) via Google Fonts
- Deploy: withastro/action@v6 naar GitHub Pages

## Content-structuur
- src/content/oefeningen/ — catalogus van interventies
- src/content/milestones/ — chronologische tijdlijn
- src/content/vragen/ — openstaande vragen (voor: ons|school|alvah)
- src/pages/ — 11 pagina's plus 404

## Voor elke sessie
Lees deze CLAUDE.md. Lees src/content.config.ts voor datamodel. Lees de te wijzigen pagina helemaal.

## Design
- Alleen bestaande --custom-properties uit global.css
- Section-kop: italic cijfer + serif heading
- Callouts: --green-soft achtergrond + 3px border-left --green
- Kritische kanttekeningen: --red-warn border
- Open-onderzoek markers: --accent-warm border + label "Open onderzoek"

## Verboden
- `<script>` buiten filters op /oefeningen en /vragen
- Cookies, localStorage, sessionStorage
- Externe trackers, pixels, embeds
- Nieuwe dependencies zonder expliciete opdracht
```

## README.md

Kort: titel, één alinea, lokaal draaien (`npm install` / `npm run dev`), deployen (push naar main), waar content bewerken (src/content/*).

## Uitvoering

Volgorde:
1. `npm init -y`, Astro toevoegen, scripts
2. Config files (astro.config.mjs, tsconfig, content.config.ts)
3. Map-structuur
4. `src/layouts/BaseLayout.astro`
5. `src/styles/global.css`
6. Alle 12 pagina's (11 routes + 404)
7. `public/robots.txt`, `public/CNAME`
8. `.github/workflows/deploy.yml`
9. `CLAUDE.md`, `README.md`
10. `npm install`
11. `npm run build` — zonder errors
12. `npm run dev` — check alle 11 routes 200

## Definition of done

- [ ] `npm install` slaagt
- [ ] `npm run build` slaagt zonder errors
- [ ] `dist/` bevat HTML voor alle 11 routes + 404
- [ ] Elke pagina heeft `<meta name="robots" content="noindex, nofollow">`
- [ ] Cockpit op `/` toont metadata-grid + 3 data-chips + 10 navigatie-kaarten (incl. 09 Vragen)
- [ ] /samenvatting heeft placeholder-structuur met 8 secties
- [ ] /oefeningen, /voortgang, /vragen tonen lege-state
- [ ] public/CNAME bevat "{{DOMAIN}}"
- [ ] public/robots.txt bevat Disallow
- [ ] .github/workflows/deploy.yml verwijst naar withastro/action@v6
- [ ] CLAUDE.md staat in repo-root
- [ ] Geen Tailwind of framework-integraties
- [ ] README beschrijft lokale dev en deploy

Vraag één concrete vraag per keer bij twijfel. Anders ga door tot DoD groen is.
````

### Stap 2.2 — Wacht en controleer
Claude Code loopt 10–20 minuten. Beantwoord vragen één tegelijk.

### Validatie-gate fase 2
- [ ] `npm run build` slaagt zonder errors
- [ ] `npm run dev` werkt; alle 11 routes bereikbaar op http://localhost:4321
- [ ] Cockpit toont 10 navigatie-kaarten inclusief "09 Vragen"
- [ ] `/oefeningen`, `/voortgang`, `/vragen` tonen lege-state
- [ ] `public/CNAME`, `public/robots.txt` en `CLAUDE.md` staan in repo

---

## Fase 3 — Eerste deploy naar GitHub Pages (15 minuten)

### Stap 3.1 — Commit en push
```bash
git add .
git commit -m "Initial scaffold: Astro site met 11 pagina's en 3 content collections"
git push origin main
```

### Stap 3.2 — Enable GitHub Pages
Op https://github.com/{{GITHUB_USER}}/{{REPO}}/settings/pages:
- Source: **GitHub Actions**
- Save

### Stap 3.3 — Wacht op deploy
https://github.com/{{GITHUB_USER}}/{{REPO}}/actions — workflow moet groen eindigen (~2 min).

### Stap 3.4 — Check GitHub-URL
Site tijdelijk op `https://{{GITHUB_USER}}.github.io/{{REPO}}/`.

### Validatie-gate fase 3
- [ ] Workflow groen
- [ ] Cockpit laadt
- [ ] Alle 11 pagina's bereikbaar via nav

---

## Fase 4 — Custom domein live (30 min + tot 24u DNS)

### Stap 4.1 — Verify domein op GitHub
Op https://github.com/settings/pages — "Verified domains":
- Add a domain: `{{DOMAIN}}`
- Noteer TXT-record: `_github-pages-challenge-{{GITHUB_USER}}` met waarde

Docs: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages

### Stap 4.2 — DNS-records aanmaken

**Apex-domein** (bv. `voor-alvah.nl`):

| Type | Host | Waarde | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| AAAA | `@` | `2606:50c0:8000::153` | 3600 |
| AAAA | `@` | `2606:50c0:8001::153` | 3600 |
| AAAA | `@` | `2606:50c0:8002::153` | 3600 |
| AAAA | `@` | `2606:50c0:8003::153` | 3600 |
| CNAME | `www` | `{{GITHUB_USER}}.github.io.` (inclusief trailing punt!) | 3600 |
| TXT | `_github-pages-challenge-{{GITHUB_USER}}` | verification waarde | 3600 |

**Subdomein** (bv. `alvah.jouwdomein.nl`):

| Type | Host | Waarde | TTL |
|---|---|---|---|
| CNAME | `alvah` | `{{GITHUB_USER}}.github.io.` | 3600 |
| TXT | `_github-pages-challenge-{{GITHUB_USER}}` | verification | 3600 |

Docs:
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages

### Stap 4.3 — Custom domain in Pages-settings
Op https://github.com/{{GITHUB_USER}}/{{REPO}}/settings/pages:
- Custom domain: `{{DOMAIN}}` → Save
- Groen vinkje na 5-30 min (opnieuw Save als eerste check rood)

### Stap 4.4 — HTTPS aanzetten
**Enforce HTTPS** vinkbaar na Let's Encrypt (1-24u) → aanvinken.

### Stap 4.5 — Test
- `https://{{DOMAIN}}` → padslot
- `https://www.{{DOMAIN}}` → redirect naar apex
- `http://{{DOMAIN}}` → redirect naar https

Debug:
```bash
dig {{DOMAIN}} +noall +answer -t A
dig www.{{DOMAIN}} +noall +answer -t CNAME
```

### Validatie-gate fase 4
- [ ] Domain verified
- [ ] DNS-records correct
- [ ] `https://{{DOMAIN}}` laadt
- [ ] `www` redirect werkt
- [ ] Enforce HTTPS aan

---

## Fase 5 — Content laden (meerdere sessies)

Plaats eerst bronmateriaal in `docs/source/`:
- `samenvatting.html` — HTML-prototype
- `dossier.md` — onderzoeksrapport
- `research-cognitie.md` — "Cognition, self-control, and PKU"
- `research-oefeningen.md` — "Catalogus: wat werkt echt?"
- `research-boeken.md` — "Boekenadvies"
- `research-pku-diep.md` — "Ontbrekende research — uitgewerkt"
- `research-doubleren.md` — "Doubleren in groep 4 bij dyslexie + PKU + EF-zwakte"

```bash
mkdir -p docs/source
# plaats bestanden
git add docs/source
git commit -m "Bronmateriaal voor content-import"
git push
```

### Stap 5.1 — Samenvatting vullen

````text
Vul /samenvatting met de verhalende samenvatting.

## Surgical contract
- Alleen src/pages/samenvatting.astro wijzigen

## Bron
docs/source/samenvatting.html

## Content
Behoud de 8 secties:
1. Hero met eyebrow "Dossier · [huidig jaar + maand]", H1, lede in Fraunces 300
2. Metadata-grid (4 feiten)
3. Section 01 "Wie is Alvah" — twee kolommen echte items, plus "Wat we niet kunnen weten, maar wel benoemen"-callout
4. Section 02 "Wat de toetsen laten zien" — inline SVG leerrendement-grafiek (exact overnemen), caption
5. Section 03 "Wat opvalt" — drie observaties met italic cijfers
6. Section 04 "Drie lagen" — PKU / dyslexie / aandacht cards
7. Section 05 "Wat we doen" — thuis/school/specialistisch
8. Section 06 "Recent" — getCollection('milestones'), toon 3 nieuwste. Lege state: "Nog geen milestones gelogd."
9. Section 07 "Termen in gewone taal" — glossary
10. Section 08 "Voor wie verder wil lezen" — link naar /bronnen en /dossier

## Privacy
Geen achternamen. "de gedragswetenschapper van het SWV".

## DoD
- [ ] 10 secties aanwezig
- [ ] SVG-grafiek inline en responsive
- [ ] "Recent"-sectie haalt milestones op
- [ ] Geen achternamen
- [ ] npm run build slaagt
````

### Stap 5.2 — Dossier vullen

````text
Vul /dossier met het volledige onderzoeksrapport.

## Surgical contract
- Alleen src/pages/dossier.astro

## Bron
docs/source/dossier.md

## Layout
- Sticky sub-navigatie links op desktop >1024px
- Mobile: klapbare inhoudsopgave bovenaan
- H2 per hoofdsectie
- Callouts: --green-soft + 3px border-left --green
- Tabellen volgens palet

## Extra te verwerken bevindingen (zoek passende plek)

1. **BBdL** — Van der Donk et al. (2015): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.01081/full
2. **Mindfulness-nuance** — Dunning (2019): https://onlinelibrary.wiley.com/doi/10.1111/jcpp.13057 ; Kuyken MYRIAD (2022): https://mentalhealth.bmj.com/content/25/3/99
3. **Cogmed-relativering** — Kassai (2019): https://pubmed.ncbi.nlm.nih.gov/30652908/ ; Simons (2016): https://journals.sagepub.com/doi/10.1177/1529100616661983
4. **GPO 6-weken termijn** — https://onderwijsgeschillen.nl/commissie/geschillencommissie-passend-onderwijs-gpo

## DoD
- [ ] Volledig rapport op pagina
- [ ] Sticky sub-nav werkt desktop
- [ ] 4 nieuwe bevindingen verwerkt
- [ ] Geen achternamen
- [ ] npm run build slaagt
````

### Stap 5.3 — Resultaten vullen

````text
Vul /resultaten met Cito en Pluspunt data.

## Surgical contract
- Alleen src/pages/resultaten.astro

## Content

1. Intro: "Cijfers vertellen geen heel verhaal, maar ze vertellen wel een deel. Resultaten groep 3 (januari 2025) tot midden groep 4 (januari 2026)."

2. Grafiek 1: leerrendement spelling + rekenen (SVG uit samenvatting.html overnemen)

3. Grafiek 2 NIEUW: DMT-ontwikkeling M3 → E3 → B4 → M4:
   - X: jan '25, juni '25, nov '25, jan '26
   - Y: woorden 0-40
   - Datapunten: 11, 7, 27, 23
   - Caption: "Vier opeenvolgende V-scores. Alvah voldoet ruimschoots aan achterstandscriterium én hardnekkigheidscriterium voor vergoede dyslexiezorg onder Protocol 3.0."

4. Volledige Cito-toetstabel (Spelling/Rekenen/DMT/AVI/LIB)

5. Subsectie "Methodegebonden toetsen": Pluspunt 4 Resultatenmonitor, 7 bloktoetsen + tempo-toetsen, alle O

6. Subsectie "Wat de gedragswetenschapper van het SWV observeerde (maart 2026)":
   - Stimulerende factoren
   - Belemmerende factoren
   - Onderwijsbehoeften
   - Callout met "Interventies werken tijdelijk" — link naar /wetenschap#interventies-tijdelijk

## DoD
- [ ] Twee werkende SVG-grafieken
- [ ] Volledige toetstabel
- [ ] Pluspunt-tabel
- [ ] Observaties (geen naam)
- [ ] npm run build slaagt
````

### Stap 5.4 — Wetenschap vullen

````text
Vul /wetenschap met wetenschappelijke onderbouwing.

## Surgical contract
- Alleen src/pages/wetenschap.astro

## Bronnen
- docs/source/dossier.md
- docs/source/research-cognitie.md
- docs/source/research-pku-diep.md

## Sub-secties

### 01. PKU en cognitie
- Neurochemisch mechanisme (dopamine/serotonine via Phe-blokkade LNAA-transport)
- Phe-variabiliteit > Phe-gemiddelde (Hood et al., 2014)
- EF-profiel vroeg-behandelde PKU (Christ et al. 2010; DeRoche & Welsh 2008: d=0.59 planning, d=1.15 cognitieve flexibiliteit)
- Jahja et al. (2020): werkgeheugen meest aangedaan
- Bidirectionele stress-Phe

Bronnen:
- Christ et al. (2010): https://pubmed.ncbi.nlm.nih.gov/20123466/
- Hood et al. (2014): https://pubmed.ncbi.nlm.nih.gov/24568837/
- Palermo 2025: https://pmc.ncbi.nlm.nih.gov/articles/PMC12222274/

### 02. Nederlandse PKU-zorgketen
Uit research-pku-diep.md:
- 6 UMC's verenigd in UMD
- UMCG (Van Spronsen) referentiecentrum, Amsterdam UMC en WKZ UMC Utrecht
- Team: kinderarts metabool, diëtist, psycholoog, maatschappelijk werker
- Meetfrequentie 2-wekelijks voor 1-12j
- Streefwaarden 120-360 µmol/L voor 0-12j
- 10 concrete vragen voor het metabool team

Bronnen:
- UMCG: https://www.umcg.nl/-/expertisecentrum/phenylketonurie-tyrosinemie
- UMC Utrecht: https://www.umcutrecht.nl/nl/expertise-centrum/expertisecentrum-voor-erfelijke-metabole-ziekten
- UMD: https://www.unitedformetabolicdiseases.nl/
- PKU Vereniging: https://www.pkuvereniging.nl
- VKS: https://www.stofwisselingsziekten.nl
- Weetwatikheb/PKU: https://www.weetwatikheb.nl/pku
- Europese richtlijn Van Wegberg 2017: https://pmc.ncbi.nlm.nih.gov/articles/PMC5639803/
- Revisie 2025: https://pubmed.ncbi.nlm.nih.gov/40378670/

### 03. Sephience (sepiapterine)
- FDA-goedkeuring 28 juli 2025
- 66% biochemische respons; 43% Kuvan-non-responders reageert
- BH4-precursor + chaperonne-effect
- Vanaf 1 maand
- Overleg met WKZ

Bronnen:
- FDA: https://www.fda.gov/drugs/drug-approvals-and-databases/drug-trials-snapshots-sephience
- PTC: https://ir.ptcbio.com/news-releases/news-release-details/ptc-therapeutics-announces-fda-approval-sephiencetm-sepiapterin
- First Approval: https://link.springer.com/article/10.1007/s40265-025-02247-0

### 04. LNAA en GMP
LNAA niet voor <12j. GMP kan: Daly et al. (2024) RCT bij 12 kinderen 4-9j toonde minder GI-klachten maar gemiddeld 114 µmol/L hogere Phe. Besluit met diëtist WKZ.

Bronnen:
- Cochrane LNAA: https://pmc.ncbi.nlm.nih.gov/articles/PMC6478180/
- Schindeler (2007): https://pubmed.ncbi.nlm.nih.gov/17368065/
- Ney GMP (2016): https://pmc.ncbi.nlm.nih.gov/articles/PMC4962165/
- Daly (2024): https://www.sciencedirect.com/science/article/pii/S1096719224004918
- Daly review (2022): https://pubmed.ncbi.nlm.nih.gov/35215457/

### 05. Dyslexie en comorbiditeit
- Fonologisch verwerkingsdeficit
- Protocol 3.0 (2022): comorbiditeit niet langer uitsluiting
- BOUW! evidence

Bronnen:
- Protocol 3.0: https://www.nkd.nl
- BVRD: https://richtlijnenjeugdhulp.nl/dyslexie
- Scheltinga & Siekman: https://www.dyslexiecentraal.nl

### 06. Executieve functies — wat werkt en wat niet
Uit research-cognitie.md.

- Brain-training: task-specific, weinig far-transfer
- Kassai (2019): near g=0.44, far g=0.11 (ns)
- Simons (2016, PSPI): "little evidence of meaningful transfer"
- BBdL (Van der Donk): strategie+werkgeheugen, gelijkwaardig aan Cogmed, NJi-erkend
- Mindfulness: Dunning meta kleine effecten; MYRIAD null bij tieners
- Beweging: robuust (Cerrillo-Urbina 2015, g=0.4-0.6)
- Embedded EF-curricula (Diamond & Ling 2016) > isolated training

Bronnen:
- Kassai 2019: https://pubmed.ncbi.nlm.nih.gov/30652908/
- Simons 2016: https://journals.sagepub.com/doi/10.1177/1529100616661983
- Dunning 2019: https://onlinelibrary.wiley.com/doi/10.1111/jcpp.13057
- Kuyken MYRIAD: https://mentalhealth.bmj.com/content/25/3/99
- Van der Donk BBdL: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.01081/full
- Diamond & Ling 2016: https://pubmed.ncbi.nlm.nih.gov/26682925/
- Cerrillo-Urbina 2015: https://onlinelibrary.wiley.com/doi/10.1111/cch.12255

### 07. Werkhervatting-hypothese
Geframed als hypothese met goede onderbouwing, niet bewijs.

### 08. "Interventies werken tijdelijk" — synthese voor ouders
Anker-id: `interventies-tijdelijk`. Uit research-pku-diep.md.

Vijf mechanismen:
1. Transferprobleem (Kassai, Simons, Diamond & Ling)
2. Generalisatieprobleem (Dawson & Guare)
3. Phe-fluctuatie als verstorende variabele (PKU-specifiek)
4. Bidirectionele stress-Phe spiraal
5. Motivatiedaling na nieuwigheidseffect

Zes ontwerpprincipes voor duurzame interventies.

## Design
- Italic-cijfer kop per sub-sectie
- Kritische bevindingen in --green-soft callouts
- Kritische kanttekeningen met --red-warn border

## DoD
- [ ] 8 sub-secties
- [ ] Alle bronnen klikbaar
- [ ] Anker #interventies-tijdelijk werkt
- [ ] Geen achternamen
- [ ] npm run build slaagt
````

### Stap 5.5 — Onderwijs vullen

````text
Vul /onderwijs met schoolprocessen, rechten en escalatie.

## Surgical contract
- Alleen src/pages/onderwijs.astro

## Secties

### 01. Intro
"Roadmap van het Nederlandse passend-onderwijs-systeem voor wie er net mee te maken krijgt."

### 02. De basis
- Zorgplicht (Wet passend onderwijs, 2014)
- Zorgniveaus 1-4
- OPP (WPO art. 40a, instemmingsrecht handelingsdeel)
- Schoolondersteuningsprofiel (SOP)

Bron: https://www.rijksoverheid.nl/onderwerpen/passend-onderwijs

### 03. SWV Apeldoorn PO
- 4 wijken, 6-wekelijks wijkoverleg
- Kernteam (IB/KC + gedragswetenschapper SWV + jeugdverpleegkundige CJG + brugfunctionaris)
- KI's: 8-10u onderwijsbegeleiding
- KI Kentalis (TOS/taal), KI Ergo (motoriek)
- EO en EO+
- MDO 1 en MDO 2
- Kindkans
- Ouder- en jeugdsteunpunt

Bronnen:
- https://www.swvapeldoornpo.nl/ouders
- https://www.swvapeldoornpo.nl/scholen
- https://www.swvapeldoornpo.nl/hoe-werken-wij/informatie-extra-ondersteuning

### 04. Dyslexieroute (ED, Protocol 3.0)
- Criteria (3× V-DMT, hardnekkigheid, comorbiditeit-update 2022)
- Aanvraag via gemeente (Apeldoorn: CJG/Jeugdwet)
- Compenserende/dispenserende maatregelen
- ED vs particulier

Bronnen:
- https://www.nkd.nl
- https://www.dyslexiecentraal.nl
- https://richtlijnenjeugdhulp.nl/dyslexie
- https://www.apeldoorn.nl/begeleiding-advies-over-onderwijs-en-jeugd

### 05. Jenaplan en passend onderwijs
- NJPV: stamgroepen en eigen tempo, niet vrijgesteld van zorgplicht
- Pedagogisch voordeel bij leerprofiel als Alvah's
- Verlengde bouw framing — link naar /doubleren

Bronnen:
- https://www.jenaplan.nl/nl/vereniging
- https://www.jenaplan.nl/nl/voor-ouders/veelgestelde-vragen

### 06. Escalatie en rechten
- GPO: 6 weken termijn, 10 weken advies, kosteloos — https://onderwijsgeschillen.nl/commissie/geschillencommissie-passend-onderwijs-gpo
- LKC — https://onderwijsgeschillen.nl/commissie/landelijke-klachtencommissie-onderwijs-lkc
- Onderwijsconsulenten — https://onderwijsconsulenten.nl
- Ouder- en jeugdsteunpunt SWV — https://www.oudersenonderwijs.nl
- Inspectie — https://www.onderwijsinspectie.nl/onderwerpen/klachten
- AVG-rechten — https://autoriteitpersoonsgegevens.nl
- OCO — https://www.onderwijsconsument.nl/een-geschil-over-passend-onderwijs/

### 07. Wettelijk kader doubleren
Kort. Verwijs naar /doubleren voor wetenschap.
- Art. 8 lid 1 WPO (ononderbroken ontwikkelingsproces)
- Geen expliciete wet; schoolbeleid in schoolgids (Art. 13 WPO)
- Bij passend onderwijs: OPP met instemmingsrecht

Bronnen:
- https://www.onderwijskennis.nl/themas/zittenblijven-en-versnellen
- https://www.nro.nl/kennisrotondevragenopeenrij/zittenblijven-basisonderwijs

## DoD
- [ ] 7 secties
- [ ] Alle URL's klikbaar
- [ ] Escalatie-stappen in volgorde
- [ ] Link naar /doubleren werkt
- [ ] npm run build slaagt
````

### Stap 5.6 — Doubleren-pagina

````text
Vul /doubleren met wetenschap en beslismatrix.

## Surgical contract
- Alleen src/pages/doubleren.astro

## Bron
docs/source/research-doubleren.md

## Framing
Bewust neutraal. Doel: beslissingsproces structureren, niet positie innemen. School heeft formeel laatste woord; ouders hebben OPP-instemming en MR-invloed.

## Secties

### 01. Waarom deze pagina?
Intro 3-4 alinea's: de vraag kan op tafel komen; wat doubleren is; verschil "doubleren" vs "verlengde bouw" in Jenaplan; kernvraag is niet "groep 4 nog een keer ja/nee" maar "wat zou er in dat jaar anders gebeuren".

### 02. Wat zegt het onderzoek?
Uit research-doubleren.md sectie 1.
- Jimerson (2001): d=-0.39
- Allen et al. (2009): hogere kwaliteit studies dichter bij nul
- ITS/Driessen (2014): korte-termijnwinst verdwijnt 2-3 jaar
- Goos et al. (2013): overwegend ongunstig
- KRITISCHE NUANCE: meta's meten extra jaar *op zich*, niet extra jaar *mét interventie*

Bronnen:
- NRO Kennisrotonde: https://www.nro.nl/kennisrotondevragenopeenrij/zittenblijven-basisonderwijs
- Onderwijskennis.nl: https://www.onderwijskennis.nl/themas/zittenblijven-en-versnellen

### 03. Verlengde bouw in Jenaplan
- Middenbouw is driejarige stamgroep (3-4-5)
- "Verlengd" = 4e jaar met rolverschuiving naar oudste
- Minder stigma, natuurlijke differentiatie
- MAAR: Driessen vond Jenaplan-doublurepercentage 20,5% (hoger dan traditioneel 17,9%)
- Geen specifiek effectonderzoek naar verlengde bouw Jenaplan

### 04. Effectgroottes vergeleken
Tabel uit research-doubleren.md sectie 2:

| Interventie | Effectgrootte | Bron | Passend voor Alvah? |
|---|---|---|---|
| Doublure zonder interventie | d=-0.39 tot 0.00 | Jimerson; Allen et al. | Nee, tenzij gevuld |
| Tier-2 leesinterventie | ES=0.54-1.02 | Wanzek et al. 2016 | Ja, mogelijk onvoldoende |
| Tier-3 leesinterventie | significant positief | Denton et al. 2014 | Ja, kern |
| BOUW! (NL, ON3) | substantieel | Van der Weijden | Ja, tot halverwege groep 4 |
| Schoolgebonden ADHD-interventie | 0.28-0.37 | Frontiers 2025 meta | Ja, aanvullend |
| EF-training | significante normalisering | PMC 5339928 | Ja, gericht |
| Schakelklas | positief voor taalachterstand | Ledoux & Veen 2009 | Nee, verkeerde doelgroep |
| Gecombineerde lees+ADHD | additief begrijpend lezen | Tamm et al. 2020 | Ja, ideaal |

Bronnen:
- Wanzek 2016: https://pmc.ncbi.nlm.nih.gov/articles/PMC5007082/
- Denton 2014: https://pmc.ncbi.nlm.nih.gov/articles/PMC4191908/
- Tamm 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7518569/
- Kofler CET 2022: https://pmc.ncbi.nlm.nih.gov/articles/PMC9035079/

### 05. Beslismatrix

**NIET verdedigbaar wanneer:**
1. Achterstand uitsluitend door gediagnosticeerde leerstoornis of medische conditie
2. Geen aantoonbaar ON3-interventie minimaal een schooljaar doorlopen
3. Kind sociaal-emotioneel geen problemen in huidige groep
4. Al eerder kleuterverlenging gehad
5. Plan zonder concreet anders-dan-vorig-jaar interventieplan

**KAN verdedigbaar zijn wanneer:**
1. Brede achterstand op álle vakgebieden >10 maanden DLE
2. Concrete interventie-architectuur
3. Kind profiteert sociaal-emotioneel van verschuiving
4. Externe factoren maakten vorig jaar atypisch
5. Metabool team bevestigt EF-problemen samenhingen met Phe-ontregeling die nu hersteld is

### 06. Beslisgesprek met school
5 genummerde vragen:
1. "Welke ON3-interventies zijn dit jaar ingezet, met welke frequentie en gemeten voortgang?"
2. "Kunt u concreet interventieplan voor doublure-jaar voorleggen dat substantieel verschilt van afgelopen jaar?"
3. "Hoe houdt het OPP rekening met PKU en samenwerking met WKZ?"
4. "Is verlengde bouw (middenbouw blijven als oudste) mogelijk in plaats van formele doublure?"
5. "Welke effectgrootte verwacht u van doublure vergeleken met doorstromen mét intensieve begeleiding?"

### 07. Beslismatrix indicatoren
Uit research-doubleren.md sectie 3.
Vijf categorieën A-E, elk sub-vragen:
- A. Diagnose en achtergrond (3 vragen)
- B. Interventiegeschiedenis (3 vragen)
- C. Sociaal-emotioneel (4 vragen)
- D. Plan voor extra jaar (5 vragen)
- E. Alternatieven (3 vragen)

### 08. Onze voorlopige positie
1 alinea in Fraunces 300:

"Voor Alvah is de kernvraag niet 'groep 4 nog een keer'. De kernvraag is: als de Phe-controle optimaal is, de dyslexiezorg onder Protocol 3.0 loopt, BOUW! gecontinueerd wordt tot en met groep 4, en de gedragswetenschapper van het SWV een EF-ondersteuningsplan neerlegt — hoeveel verschil maakt een extra jaar dan nog, en tegen welke sociaal-emotionele prijs? Dat weten we nog niet. Maar we vinden dat die vraag eerst beantwoord hoort te worden voordat doubleren op tafel komt. Deze pagina is onze gespreksbasis."

## Design
- Beslismatrix sectie 07 in uitklapbare <details> per categorie
- Effectgroottes-tabel: --green-soft headerrij, alternerende rijen
- "Niet verdedigbaar"-criteria in kritische callout (--red-warn border)
- Genummerde secties 01-08

## DoD
- [ ] 8 secties
- [ ] Effectgroottes-tabel compleet
- [ ] Beslismatrix werkt
- [ ] 5 gespreksvragen genummerd
- [ ] Verwijzing naar /wetenschap#interventies-tijdelijk en /onderwijs
- [ ] npm run build slaagt
````

### Stap 5.7 — Oefeningen-catalogus

````text
Vul oefeningen-catalogus op basis van docs/source/research-oefeningen.md en research-boeken.md.

## Surgical contract
- Nieuwe .md bestanden in src/content/oefeningen/
- Geen andere wijzigingen
- Items met "rood/praktijkclaim" alleen opnemen bij duidelijke reden

## Per oefening één .md

Bestandsnaam = slug. Voorbeeld:

---
titel: "Toneellezen"
domein: ["technisch-lezen"]
context: ["thuis"]
duur: "gemiddeld-10-15min"
kosten: "gratis"
evidence: "matig"
korte_omschrijving: "Om de beurt een zin lezen — verlaagt drempel"
bronnen:
  - tekst: "Steenbeek-Planting (2012) — onderzoek naar effectieve leesinterventies"
---

## Wat het is
[200-400 woorden]

## Waarom het werkt
[...]

## Hoe doen we dit
[...]

## Bronnen & verdere lezing
[...]


## Op te nemen oefeningen (~35 items)

LEZEN:
- toneellezen (matig)
- herhaald-lezen-succeservaring (matig)
- luisterboek-meelezen (matig; Singh & Alexander 2022)
- bouw (sterk; Van der Weijden)
- yoleo (zwak-matig; compenserend, gratis via bibliotheek)
- passend-lezen (zwak; gratis)

COMPENSEREND (voorleessoftware):
- kurzweil-3000 (matig; via school/SWV, Lexima NL)
- l2s (matig; NL-specifiek, Lexima)
- read-write-texthelp (matig; Chrome-extensie)
- microsoft-immersive-reader (zwak; gratis instap)
- google-voorleesfunctie (praktijkclaim; basisniveau)

EXECUTIEVE FUNCTIES:
- beter-bij-de-les (matig; sterkste NL-optie, via school/behandelaar)
- cogmed (zwak; disclaimer over far-transfer)
- time-timer (matig; visuele tijd)
- visueel-dagschema (sterk; pictogrammen, externe structuur)
- stappenkaart (sterk; task-analysis)

BEWEGING:
- aerobe-sport (sterk; Cerrillo-Urbina 2015, g=0.4-0.6, 3-5x/week)
- vechtsport (matig; Morales 2011, Lakes & Hoyt 2004)
- klimmen-boulderen (matig; Luttenberger 2015)

ZELFBEELD / FAALANGST:
- wegwijs-programma (matig; Van Luit UU, na ED-diagnose)
- growth-mindset-gesprek-thuis (sterk principe: "jouw hoofd werkt anders")
- comet (matig; COMET-Meesters, negatief zelfbeeld)

MINDFULNESS (zwakke evidence):
- mindup (zwak-matig)
- smiling-mind (zwak; disclaimer)

BORDSPELLEN (eerlijk gelabeld):
- set-spel (zwak; "Leuk om samen te doen, geen 'EF-training'")
- halli-galli (praktijkclaim)
- rush-hour (zwak)

BOEKEN OVER EIGEN BREIN:
- fantastische-elastische-brein (JoAnn Deak, voorlezen)
- het-meisje-dat-nooit-fouten-maakte (Pett & Rubinstein, faalangst + mindset)
- stilzitten-als-kikker (matig; Eline Snel werkboek 5-8j)
- tess-stijn-pimpen-plein (Bartels; dyslexie-specifiek)
- nu-weet-ik-wat-dyslexie-is (Engbers; samen lezen)
- een-kroon-voor-kanjer (Tilanus)

BOEKEN OM TE LEZEN:
- tijgerlezen-reeks (praktijkclaim; top-aanbeveling)
- zoeklicht-dyslexie (praktijkclaim; Zwijsen)
- kijk-en-lees-joep (praktijkclaim; AVI-stripboeken)
- dog-man (praktijkclaim; Pilkey)
- donald-duck-junior (praktijkclaim)
- waar-is-wally (praktijkclaim; wimmelboek)
- mopboek-zwijsen (matig; M&L-serie)

## Regels
- 200-400 woorden per bestand
- Evidence EERLIJK
- Bronnen altijd (URL waar beschikbaar)
- Geen overdreven claims
- Bordspellen: "Leuk om te spelen, niet 'EF-training'"
- Boeken: titel + auteur + uitgever + leeftijd + prijs + waar te koop

## DoD
- [ ] ~35 oefeningen in src/content/oefeningen/
- [ ] Elk bestand valideert Zod-schema
- [ ] Mix evidence-grades
- [ ] Alle bronnen met URL waar mogelijk
- [ ] npm run build zonder warnings
- [ ] /oefeningen toont catalogus met werkende filters
````

### Stap 5.8 — Voortgang-tijdlijn met backdated milestones

````text
Voeg backdated milestones toe.

## Surgical contract
- Alleen nieuwe bestanden in src/content/milestones/
- Geen pagina-wijzigingen

## Milestones

### 2025-01-dmt-groep-3.md
---
datum: 2025-01-30
titel: "Eerste DMT-meting: niveau V"
samenvatting: "Eerste signaal dat technisch lezen achterloopt. Spelling staat nog op niveau II — structurele leerstoornis lijkt niet in het spel."
tags: ["dyslexie", "observatie"]
---

### 2025-06-inzakking.md
---
datum: 2025-06-18
titel: "Inzakking zichtbaar — meerdere open vragen"
samenvatting: "Spelling en rekenen vallen terug naar niveau V in één half jaar. Patroon wijkt af van structurele leerstoornis. Er zijn open vragen over zowel de thuis- als de schoolcontext in deze periode."
tags: ["observatie", "open-onderzoek"]
open_onderzoek: true
---

## De observatie
Cito E3 toont een scherpe val. Spelling II→V in 5 maanden. Rekenen IV→V. Geen normale curve.

## Open vragen
- Welke schoolcontext speelde in jan-juni 2025? Zie /vragen
- Wat lieten de Phe-spiegels in die periode zien? Zie /vragen
- Hoe verhield thuis-observatie (werkhervatting moeder) zich tot andere factoren? Zie /vragen

### 2026-01-hardnekkigheid-bevestigd.md
---
datum: 2026-01-29
titel: "Vierde V-score DMT — hardnekkigheidscriterium gehaald"
samenvatting: "Vier opeenvolgende V-scores. Spelling herstelt gedeeltelijk tot D. Voldoet aan criteria voor vergoede dyslexiezorg onder Protocol 3.0."
tags: ["dyslexie", "aanvragen"]
oefeningen_actief: ["bouw"]
---

### 2026-03-overzicht-onderwijsbehoeften.md
---
datum: 2026-03-15
titel: "Overzicht onderwijsbehoeften door gedragswetenschapper SWV"
samenvatting: "Formeel overzicht. Opvallende observatie: 'interventies werken tijdelijk'."
tags: ["observatie", "school"]
oefeningen_actief: ["bouw", "toneellezen"]
---

### 2026-04-site-gelanceerd.md
---
datum: 2026-04-22
titel: "Website live"
samenvatting: "Dossier digitaal toegankelijk. Eén plek voor school, familie en behandelaars — inclusief openstaande vragen."
tags: ["proces"]
oefeningen_actief: ["bouw", "toneellezen", "visueel-dagschema"]
---

## Schrijfstijl
- Rustige, observerende toon
- Max 200 woorden vrije tekst per milestone
- Verwijzingen naar /vragen waar relevant

## DoD
- [ ] 5 milestones in src/content/milestones/
- [ ] 2025-06-inzakking gemarkeerd open_onderzoek: true
- [ ] /voortgang toont tijdlijn (nieuwste boven)
- [ ] Cockpit toont nieuwste milestone
- [ ] Open-onderzoek sectie #onderzoek werkt
- [ ] Links naar /oefeningen werken
- [ ] npm run build slaagt
````

### Stap 5.9 — Vragen-pagina vullen (NIEUW, BELANGRIJK)

````text
Vul de vragen-collectie met de eerste set openstaande vragen.

## Surgical contract
- Nieuwe .md bestanden in src/content/vragen/
- Geen pagina-wijzigingen

## Schrijftoon
Rustig, concreet, eerlijk. Elke vraag heeft een "waarom"-veld dat uitlegt waarom dit ertoe doet. Vermijd jargon. Schrijf voor drie publieken tegelijk: ouders, schoolmedewerkers en (bij de Alvah-categorie) een 7-jarige die het later zelf kan begrijpen.

## Regels per bestand
- Bestandsnaam = slug (bv. `phe-spiegels-jan-juni-2025.md`)
- Alle frontmatter-velden invullen
- Vrije tekst kort: 100-250 woorden
- Bevat "Wat weten we al" en "Wat zoeken we nog"
- Bij Alvah-vragen: de vraag richten aan wie het gesprek met hem voert, niet aan Alvah zelf

## Op te nemen vragen

### VOOR ONS (src/content/vragen/*)

#### phe-spiegels-jan-juni-2025.md
---
titel: "Wat lieten de Phe-spiegels in jan-juni 2025 zien?"
voor: "ons"
status: "open"
urgentie: "hoog"
waarom: "De inzakking in Cito-scores valt samen met de werkhervatting van moeder. Maar er zijn twee andere factoren mogelijk: wat er op school speelde (zie vraag voor school), en de Phe-variabiliteit. Hood et al. (2014) liet zien dat Phe-variabiliteit een sterkere voorspeller is van cognitieve uitkomsten dan het gemiddelde. Zonder deze data missen we één kritische hoek."
wie_beantwoordt: "Metabool team WKZ (UMC Utrecht)"
gerelateerde_milestones: ["2025-06-inzakking"]
aangemaakt: 2026-04-22
---

## Wat vragen we
Overzicht van dried-blood-spot metingen januari–juni 2025, niet alleen gemiddelde maar ook variabiliteit. Graag naast de schoolperiodes leggen.

## Wat we ermee doen
Als de Phe schommelingen vertoont in die periode, verklaart dat mee hoe EF-belasting fluctueerde. Deze data hoort op /resultaten naast de Cito-grafiek. Als de data stabiel is, sluit dat deze verklaring uit en wordt de focus op thuis/school sterker.

#### sepiapterine-proefbehandeling.md
---
titel: "Is sepiapterine (Sephience) relevant voor Alvah's PAH-mutatie?"
voor: "ons"
status: "open"
urgentie: "gemiddeld"
waarom: "Sephience is juli 2025 door FDA goedgekeurd en eerder in de EU geregistreerd. 66% van PKU-patiënten reageert biochemisch; 43% van de Kuvan-non-responders reageert wél op sepiapterine. Voor wie het werkt betekent het soepeler dieet en betere Phe-stabiliteit. Niet te voorspellen zonder therapeutische proef."
wie_beantwoordt: "Kinderarts metabool WKZ"
aangemaakt: 2026-04-22
---

## Wat vragen we
Of een BH4/sepiapterine-belastingstest ooit is gedaan. Zo ja, wat was de uitkomst en op welke dosering. Zo nee: is dat zinvol om alsnog te doen, gezien de huidige kennis over Alvah's mutatiepatroon.

#### gmp-dieetproducten.md
---
titel: "Zou een overstap naar GMP-producten dieettrouw en welzijn helpen?"
voor: "ons"
status: "open"
urgentie: "laag"
waarom: "Daly et al. (2024) toonden in een RCT met 12 kinderen van 4-9 jaar dat GMP-producten significant minder maagdarmklachten gaven dan traditionele aminozuurmengsels. Nadeel: gemiddeld 114 µmol/L hogere Phe, wat bij klassieke PKU relevant is. Smaak en palatabiliteit zijn vaak veel beter — dat verbetert op lange termijn de dieettrouw."
wie_beantwoordt: "Diëtist metabool team WKZ"
aangemaakt: 2026-04-22
---

## Wat vragen we
Een concrete afweging: zou in Alvah's geval (lage Phe-tolerantie bij klassieke PKU) een GMP-gedeeltelijke overstap werken? Bijvoorbeeld voor een deel van de dagelijkse porties. Wat is de ervaring van het WKZ hiermee bij andere kinderen van zijn leeftijd?

#### neuropsychologisch-onderzoek-planning.md
---
titel: "Wanneer staat het volgende neuropsychologisch onderzoek gepland en wat wordt gemeten?"
voor: "ons"
status: "open"
urgentie: "gemiddeld"
waarom: "DeRoche & Welsh (2008) meta-analyse toont bij vroeg behandelde PKU substantiële effectgroottes op executieve functies (d=0.59 planning tot d=1.15 cognitieve flexibiliteit). Jahja et al. (2020) wijzen werkgeheugen aan als meest aangedaan. Deze domeinen horen standaard in een NPO — maar dat is niet vanzelfsprekend."
wie_beantwoordt: "Psycholoog metabool team WKZ"
aangemaakt: 2026-04-22
---

## Wat vragen we
- Wanneer het volgende NPO gepland staat
- Of EF expliciet gemeten wordt (bv. via BRIEF, WISC werkgeheugen-index, CPT voor aandacht)
- Of resultaten gedeeld kunnen worden met de gedragswetenschapper van het SWV (met toestemming)

#### driepartijenoverleg.md
---
titel: "Kunnen we een driepartijenoverleg regelen tussen WKZ, SWV en school?"
voor: "ons"
status: "open"
urgentie: "hoog"
waarom: "Eén van de zes principes uit de literatuur voor duurzame interventies is 'coördinatie tussen domeinen' (zie /wetenschap#interventies-tijdelijk). Nu werken WKZ-psycholoog, SWV-gedragswetenschapper en schoolleerkracht parallel. Elk ziet een ander deel van Alvah's functioneren. Samen zien ze het volledige beeld."
wie_beantwoordt: "Wij initiëren zelf"
aangemaakt: 2026-04-22
---

## Wat we willen
Eén keer per jaar een kort (~45 min) overleg waar Phe-data, schoolresultaten en gedragsobservaties naast elkaar liggen. Niet eindeloos, wel structureel.

### VOOR SCHOOL (src/content/vragen/*)

#### schoolcontext-jan-juni-2025.md
---
titel: "Wat speelde er op school in de periode januari–juni 2025?"
voor: "school"
status: "open"
urgentie: "hoog"
waarom: "De grootste Cito-val valt precies in deze periode samen. Thuis was er een bekende factor (werkhervatting moeder). School is de derde bron. Was er een leerkrachtwissel, invaller, methode-verandering, sociale dynamiek, of iets anders dat in die maanden anders was dan ervoor?"
wie_beantwoordt: "Toenmalige leerkracht groep 3 + IB'er De Mheen"
gerelateerde_milestones: ["2025-06-inzakking"]
aangemaakt: 2026-04-22
---

## Interview-leidraad

**Aan de toenmalige leerkracht:**
1. Was u de vaste leerkracht het hele schooljaar 2024/2025, of waren er wissels/invallers?
2. Was er in jan-juni 2025 een andere klassensamenstelling dan eerder?
3. Wat viel u op aan Alvah? Werkhouding, concentratie, energie, stemming, relaties met klasgenoten?
4. Was er een moment of gebeurtenis waarna u iets zag veranderen?
5. Hoe ging hij met lees- en schrijfopdrachten om — meer frustratie, vermijding, anders?
6. Waren er sociale dingen in de stamgroep die u opviel?
7. Welke ondersteuning had Alvah, hoe vaak, door wie? Veranderde er iets?
8. Was er een methode- of werkwijze-verandering in de klas?
9. Wat zou u, terugkijkend, graag anders hebben gedaan met de kennis van nu?

**Aan de IB'er:**
1. Welke signalen bereikten u over Alvah in die periode? Van wie?
2. Welke interventies op welk zorgniveau liepen, met welke voortgangsmonitoring?
3. Waren er kernteambesprekingen over Alvah in jan-juni 2025? Uitkomsten?
4. Hoe wordt bij De Mheen omgegaan met leerkracht-continuïteit bij ziekte/verlof?
5. Is er iets gebeurd in de middenbouw-structuur of het team dat terugkijkend relevant is?

**Houding**: niet om iemand iets te verwijten. Samen begrijpen, zodat toekomstige ondersteuning op een vollediger beeld leunt. Rustige setting, minstens een uur plannen.

#### opp-status.md
---
titel: "Is er een OPP voor Alvah? Zo ja, waar staat het? Zo nee, wanneer wel?"
voor: "school"
status: "open"
urgentie: "hoog"
waarom: "OPP is wettelijk verplicht voor leerlingen met extra ondersteuning (WPO art. 40a). Het handelingsdeel vereist instemming van ouders. Zonder OPP is er geen formele basis voor overeengekomen interventies en doelen — en is een eventuele doublure minder goed onderbouwd."
wie_beantwoordt: "IB'er De Mheen"
aangemaakt: 2026-04-22
---

#### dyslexie-aanvraag-status.md
---
titel: "Waar staat de dyslexie-aanvraag precies?"
voor: "school"
status: "open"
urgentie: "hoog"
waarom: "Alvah voldoet sinds januari 2026 ruimschoots aan de criteria van Protocol 3.0 (vier opeenvolgende V-scores op DMT). Hoe eerder de ED-behandeling start, hoe beter. De route loopt via gemeente Apeldoorn (CJG/Jeugdwet). We willen weten: compleet dossier? Al ingediend? Verwachte beschikking? Gekozen zorgaanbieder?"
wie_beantwoordt: "IB'er De Mheen"
aangemaakt: 2026-04-22
---

#### voorleessoftware-chromebook.md
---
titel: "Welke voorleessoftware ondersteunt De Mheen op Chromebook?"
voor: "school"
status: "open"
urgentie: "gemiddeld"
waarom: "Compenserende hulpmiddelen mogen al vóór formele diagnose. Op Chromebook werkt Read&Write, Claro Chrome-extensie, Kurzweil Cloud en ingebouwde Google-voorleesfunctie. School heeft vaak voorkeur voor één systeem omwille van uniformiteit en licenties. Wij kunnen parallel iets thuis gebruiken, maar consistentie helpt Alvah."
wie_beantwoordt: "IB'er of ICT-coördinator De Mheen"
aangemaakt: 2026-04-22
---

#### zorgniveau-3-status.md
---
titel: "Welke zorgniveau-3 interventies lopen nu, hoe vaak, en met welke voortgangsmonitoring?"
voor: "school"
status: "open"
urgentie: "hoog"
waarom: "Zorgniveau 3 is de basis onder zowel de dyslexie-aanvraag als een eventuele doublure-discussie. Zonder aantoonbaar minimaal een schooljaar ON3 is doublure volgens de literatuur niet verdedigbaar (zie /doubleren). We willen weten wat exact loopt — frequentie, wie het uitvoert, hoe voortgang gemeten wordt."
wie_beantwoordt: "IB'er De Mheen"
aangemaakt: 2026-04-22
---

#### sop-inzien.md
---
titel: "Kunnen we het schoolondersteuningsprofiel (SOP) van De Mheen inzien?"
voor: "school"
status: "open"
urgentie: "laag"
waarom: "Het SOP beschrijft welke basisondersteuning de school zelf biedt en wanneer doorverwijzing naar SWV nodig is. Het is wettelijk verplicht en hoort openbaar beschikbaar te zijn. Inzage helpt ons begrijpen wat binnen De Mheen's mogelijkheden valt."
wie_beantwoordt: "IB'er of directie De Mheen"
aangemaakt: 2026-04-22
---

#### verlengde-bouw-mogelijk.md
---
titel: "Als doubleren ooit ter sprake komt — is verlengde bouw mogelijk i.p.v. formele doublure?"
voor: "school"
status: "open"
urgentie: "laag"
waarom: "In Jenaplan is de middenbouw een driejarige stamgroep (3-4-5). Verlengd in dezelfde bouw blijven is een andere rolpositie-verschuiving dan in een jaarklassensysteem. Minder stigma, natuurlijke differentiatie. De Mheen kent deze constructie waarschijnlijk al — wij willen weten of dit voor Alvah open staat als optie."
wie_beantwoordt: "Directie + IB'er De Mheen"
gerelateerde_milestones: []
aangemaakt: 2026-04-22
---

### VOOR EN MET ALVAH (src/content/vragen/*)

Belangrijk: deze vragen zijn niet over hem, maar met hem. Ze zijn geformuleerd voor ons (ouders) als leidraad voor de gesprekken met Alvah. Elke vraag heeft een "Hoe hem dit vragen"-sectie zodat we niet zomaar interviewen maar aansluiten bij waar hij op dat moment is.

#### wat-helpt-bij-lezen.md
---
titel: "Wat helpt hém bij het lezen — waar merkt hij zelf verschil?"
voor: "alvah"
status: "open"
urgentie: "gemiddeld"
waarom: "Alvah kent zichzelf beter dan welke toets ook. Hij heeft nu genoeg ervaring met BOUW!, toneellezen, luisterboek-meelezen en gewoon boek om te kunnen voelen wat verschil maakt. Zijn eigen signaal hierin is zowel praktisch (wat gaan we meer doen) als zelfvertrouwen-bouwend (hij wordt serieus genomen als expert op zichzelf)."
wie_beantwoordt: "In gesprek met Alvah zelf, rustig moment"
gerelateerde_oefeningen: ["bouw", "toneellezen", "luisterboek-meelezen"]
aangemaakt: 2026-04-22
---

## Hoe hem dit vragen
Niet tijdens een leesmoment. Een autorit, een avondwandeling, op de bank. Open vragen:
- "Wat vind je fijn aan lezen?" (eerst positief)
- "Wat vind je soms moeilijk?"
- "Werkt het beter als papa/mama meeleest, of liever alleen?"
- "Wat vind je van de computer-oefening (BOUW!)?"
- Luisteren zonder correctie. Zijn antwoord telt ook als het tegenstrijdig voelt.

#### vriendschappen-stamgroep.md
---
titel: "Wie zijn zijn vrienden in de stamgroep? Wat zou een verschuiving voor hem betekenen?"
voor: "alvah"
status: "open"
urgentie: "hoog"
waarom: "Bij eventuele verlengde bouw of doublure verandert zijn sociale positie. Voor een kind met dyslexieprofiel en groeiende faalangst zijn vrienden een cruciale beschermende factor. Dit moeten we weten voordat we meebeslissen over schoolpad-keuzes."
wie_beantwoordt: "In gesprek met Alvah; observatie op school/verjaardagen"
gerelateerde_milestones: []
aangemaakt: 2026-04-22
---

## Hoe hem dit vragen
- "Met wie speel je het liefst op school?"
- "Wie is je beste vriend in je groep?"
- "Als iemand anders in je groep zou zitten volgend jaar, wie zou je dan willen meenemen?"
- Niet: "wat als je blijft zitten" — dat is de volwassen-frame, niet zijn frame.

#### succes-activiteiten.md
---
titel: "Wat doet hij graag, waar is hij goed in?"
voor: "alvah"
status: "open"
urgentie: "gemiddeld"
waarom: "Voor een kind dat op school veel frustratie opbouwt is een gegarandeerde succeservaring elders de belangrijkste emotionele basis. Literatuur is duidelijk: dit is niet 'extra', dit compenseert voor een schooldag die structureel meer mislukkingen biedt dan bij andere kinderen. We willen minstens één ding per week waar hij zich competent voelt."
wie_beantwoordt: "Observatie + gesprek met Alvah"
gerelateerde_oefeningen: ["aerobe-sport", "growth-mindset-gesprek-thuis"]
aangemaakt: 2026-04-22
---

## Hoe hem dit ontdekken
- "Wat kun je echt goed?"
- "Als je een hele dag mocht doen wat je leuk vindt, wat deed je dan?"
- Vraag ook aan oma, opa, tantes — kinderen laten andere kanten zien bij andere mensen.
- Let op wat hij uit zichzelf probeert — dat is vaak sterker signaal dan wat hij benoemt.

#### wat-weet-hij-over-zichzelf.md
---
titel: "Wat weet hij al over zijn eigen hoofd, PKU, en hoe lezen voor hem werkt?"
voor: "alvah"
status: "open"
urgentie: "gemiddeld"
waarom: "Zelf-begrip is een beschermende factor tegen faalangst en aangeleerde hulpeloosheid. Als Alvah snapt dat zijn brein anders werkt (niet slechter), wordt een lastige leesdag een kenmerk van zijn hoofd, niet een oordeel over zichzelf. 'Het fantastische elastische brein' en 'Tess en Stijn pimpen het plein' zijn hier ingangen voor."
wie_beantwoordt: "In gesprek, eventueel bij voorlezen van relevante boeken"
gerelateerde_oefeningen: ["fantastische-elastische-brein", "tess-stijn-pimpen-plein", "growth-mindset-gesprek-thuis"]
aangemaakt: 2026-04-22
---

## Hoe dit opbouwen
- Niet één gesprek maar een thema over maanden
- Lees "Het fantastische elastische brein" samen, vraag daarna: "zou dat ook voor jou kunnen gelden?"
- Als hij zegt "ik ben dom": "Weet je wat er echt aan de hand is met jouw hoofd?" — dan uitleggen op zijn niveau.
- Vermijd labels die hem vastzetten. "Jouw hoofd werkt anders" is sterker dan "jij bent dyslectisch".

#### vertellen-aan-klas.md
---
titel: "Zou hij zijn klasgenoten willen vertellen over PKU?"
voor: "alvah"
status: "open"
urgentie: "laag"
waarom: "Op weetwatikheb.nl/pku staat materiaal speciaal voor kinderen om PKU aan hun klas uit te leggen. Dit geeft Alvah regie over hoe anderen het zien (niet 'hij mag dat niet' maar 'hij heeft PKU'), en is empowerend in plaats van stigmatiserend. Maar alleen als hij het zelf wil."
wie_beantwoordt: "Gesprek met Alvah, eventueel samen met leerkracht voorbereiden"
aangemaakt: 2026-04-22
---

## Hoe dit aansnijden
Niet forceren. Eerst vragen: "Weet je dat er andere kinderen zijn die ook PKU hebben?" — dan het materiaal van weetwatikheb.nl laten zien als iets leuks, niet als schoolopdracht. Als hij ja zegt: samen plannen. Als hij nee zegt: laten gaan, later nog eens polsen.

#### welke-sport-leuk.md
---
titel: "Welke sport of beweging zou hij leuk vinden om te proberen?"
voor: "alvah"
status: "open"
urgentie: "gemiddeld"
waarom: "Aerobe beweging 3-5x per week heeft de sterkste evidence voor EF-verbetering bij kinderen met ADHD-profiel (Cerrillo-Urbina 2015, g=0.4-0.6). Vechtsport heeft daarbovenop een coördinatie-component. Maar wat hij leuk vindt weegt zwaarder dan wat 'optimaal' is — volhouden is alleen mogelijk bij intrinsieke motivatie."
wie_beantwoordt: "Gesprek met Alvah + proberen"
gerelateerde_oefeningen: ["aerobe-sport", "vechtsport", "klimmen-boulderen"]
aangemaakt: 2026-04-22
---

## Hoe dit verkennen
- Wat heeft hij al geprobeerd? Wat vond hij daarvan?
- Ga naar een open dag / proefles van 2-3 verschillende sporten (voetbal, judo, boulderen, zwemmen, fietsen-in-een-groep)
- Observer: waar zijn ogen blijven hangen, welke beweging hij uit zichzelf opzoekt

#### bij-grote-beslissingen-luisteren.md
---
titel: "Bij grote beslissingen (doubleren, groep veranderen) — hoe luisteren we goed naar wat hij ervaart?"
voor: "alvah"
status: "open"
urgentie: "hoog"
waarom: "Een kind van 7 is geen volwaardige onderhandelingspartner in alle opzichten, maar heeft wel recht op gehoord worden in beslissingen die zijn leven ingrijpend veranderen (Kinderrechtenverdrag art. 12). Zijn stem meenemen betekent niet dat hij beslist, wel dat zijn perspectief weegt. Dat vereist oefening — en een plek waar we vastleggen wat hij heeft gezegd zodat het niet wegvalt in volwassenenoverleg."
wie_beantwoordt: "Principe voor ons bij élk keuzemoment"
aangemaakt: 2026-04-22
---

## Hoe dit praktisch
- Als een grote beslissing nadert: één-op-één gesprek, geen ouders tegelijk, rustige setting
- Vraag: "Wat vind je fijn nu?" "Wat zou je het liefst willen?" "Wat maakt je zorgen?"
- Leg letterlijk vast wat hij zegt (in een milestone of in deze vragen-pagina onder status beantwoord)
- Bij de uiteindelijke beslissing: benoem expliciet wat hij ons heeft verteld en hoe dat meegewogen heeft
- Als we afwijken van zijn wens: leg uit waarom, respecteer het ongemak

## DoD
- [ ] ~15 vragen in src/content/vragen/ (5 ons, 7 school, 6 alvah)
- [ ] Elk bestand valideert Zod-schema
- [ ] Evenwichtige urgentie-verdeling (niet alles "hoog")
- [ ] Drie categorieën vertegenwoordigd
- [ ] Alvah-categorie consequent geformuleerd als leidraad voor gesprek met hem, niet als interview-vragen aan hem
- [ ] Verwijzingen naar milestones en oefeningen werken
- [ ] npm run build zonder warnings
- [ ] /vragen toont alle drie categorieën met filters werkend
- [ ] Cockpit-chip "Openstaande vragen" telt correct
````

### Stap 5.10 — Bronnen consolideren

````text
Vul /bronnen met georganiseerd overzicht.

## Surgical contract
- Alleen src/pages/bronnen.astro
- Eerst inventariseren met grep welke URL's al op andere pagina's gebruikt zijn

## Structuur
Uitklapbare thematische <details> secties:
1. PKU en cognitie
2. Nederlandse PKU-zorg
3. Nieuwe PKU-behandelingen (Sephience, Kuvan, GMP)
4. Dyslexie en behandeling
5. Executieve functies en training
6. Werkhervatting en hechting
7. Doubleren en zittenblijven
8. Onderwijsrecht en passend onderwijs
9. Jenaplan
10. Apeldoorn-specifiek
11. Hulporganisaties
12. Software en hulpmiddelen
13. Boeken

Per bron: titel, auteurs, jaar, korte zin context, URL klikbaar.

## Laatste sectie: "Over dit dossier"
- Wat de site is
- Samenstelling met AI, kritisch door mensen gereviewd
- Fouten of gemis: graag persoonlijk melden
- Werkdocument, geen definitieve tekst

## DoD
- [ ] 13 thematische secties
- [ ] Alle URL's consolidated
- [ ] Geen duplicaten
- [ ] Over-dit-dossier aanwezig
- [ ] npm run build slaagt
````

### Validatie-gate fase 5
- [ ] Alle 11 pagina's bevatten echte content
- [ ] Cockpit toont 3 data-chips met werkende tellers
- [ ] Catalogus heeft ~35 oefeningen met werkende filters
- [ ] Tijdlijn heeft 5 milestones waarvan 1 open-onderzoek
- [ ] Vragen-pagina heeft ~18 items in 3 categorieën met werkende filters
- [ ] Site live op `https://{{DOMAIN}}`
- [ ] Mobiel bekijkbaar

---

## Fase 6 — Onderhoud en iteratie

### Nieuwe milestone (5 min)
1. Nieuw bestand in `src/content/milestones/YYYY-MM-kort-slug.md`
2. Frontmatter + verhaal
3. ```bash
git add src/content/milestones/
git commit -m "Milestone: [beschrijving]"
git push
```

### Vraag beantwoord
In het vraag-bestand:
- `status: "beantwoord"`
- `beantwoord_op: YYYY-MM-DD`
- `antwoord_milestone: "slug-van-milestone"` (als het antwoord leidde tot een milestone)
- Voeg aan onderkant van bestand "## Wat we ontdekten" sectie toe met korte samenvatting

### Vraag in gesprek
Wanneer een vraag actief in behandeling is (gesprek gepland, antwoord in de maak):
- `status: "in-gesprek"`

### Nieuwe oefening
Idem in `src/content/oefeningen/`.

### Claude Code voor kleine wijzigingen
Sjabloon:

```
Surgical contract: wijzig alleen [specifiek bestand]. Raak niks anders aan.

Wat ik wil: [concreet]

Definition of done:
- [ ] [meetbare check 1]
- [ ] [meetbare check 2]
- [ ] npm run build slaagt
```

---

## Fase 7 — Failure recovery

### Build faalt
```
Fix alleen deze build-error. Raak niks anders aan.

Error:
[paste volledige error]

Definition of done:
- [ ] npm run build slaagt
- [ ] Geen andere bestanden gewijzigd
```

### Deploy faalt
https://github.com/{{GITHUB_USER}}/{{REPO}}/actions — rode workflow openen, failing step, error kopiëren, zelfde prompt.

### DNS werkt niet na 24u
```bash
dig {{DOMAIN}} +noall +answer -t A
dig {{DOMAIN}} +noall +answer -t AAAA
dig www.{{DOMAIN}} +noall +answer -t CNAME
```
Fix bij registrar. Als records kloppen maar GitHub rood blijft: verwijder custom domain in Pages-settings, wacht 5 min, opnieuw zetten.

### Pagina "not found"
Check case in filename. Astro is case-sensitive.

---

## Wat NIET op de site komt (bewust)

- Geen analytics, GTM, Matomo
- Geen cookiebanner, cookies
- Geen comment-systeem
- Geen nieuwsbrief
- Geen dark mode
- Geen RSS, geen sitemap.xml
- Geen achternamen van Alvah, familie, school of behandelaars. Ooit.
- Geen foto's zonder expliciete gezamenlijke beslissing

---

## Bijlage: bronmaterialen in `docs/source/`

Voor Fase 5 plaats je in `docs/source/`:

1. `samenvatting.html` — HTML-prototype
2. `dossier.md` — onderzoeksrapport
3. `research-cognitie.md` — "Cognition, self-control, and PKU"
4. `research-oefeningen.md` — "Catalogus: wat werkt echt?"
5. `research-boeken.md` — "Boekenadvies — jongen 7 jaar"
6. `research-pku-diep.md` — "Ontbrekende research — uitgewerkt"
7. `research-doubleren.md` — "Doubleren in groep 4 bij dyslexie + PKU + EF-zwakte"

Kopieer letterlijke inhoud uit je chat-artefacten.

---

## Samenvatting — de route in één blik

| Fase | Duur | Wat je doet |
|---|---|---|
| 0. Prerequisites | 30 min | Tooling en domein |
| 1. Lege repo | 15 min | GitHub-repo, clone, VS Code, Claude Code |
| 2. Scaffold | 1 uur | Één scaffold-prompt bouwt 11 pagina's + 3 content collections |
| 3. Eerste deploy | 15 min | Git push, Pages aan, groene workflow |
| 4. Custom domein | 30 min + DNS | DNS + HTTPS |
| 5. Content laden | Paar avonden | 10 sub-stappen, elk een prompt |
| 6. Onderhoud | Doorlopend | Milestones, vragen status bijwerken, oefeningen |

Elke fase heeft een validatie-gate. Niet doorgaan als rood.

---

## Nabrander over de vragen-pagina

De `/vragen`-pagina is het hart van het werkdocument-karakter van deze site. Drie dingen maken hem werken:

1. **Categorie `alvah` is niet over hem, maar met hem.** Elke vraag in die categorie is geformuleerd als leidraad voor het gesprek met Alvah, nooit als interview-vraag aan hem. Zijn perspectief is een bron, niet een agendapunt. De "hoe hem dit vragen"-sectie per vraag dwingt ons om niet alleen te weten wát we willen horen, maar ook hoé we luisteren.

2. **Status-cyclus (open → in-gesprek → beantwoord) is zichtbaar**, en beantwoorde vragen blijven staan met verwijzing naar het antwoord. Zo zie je ook terug wat je samen hebt opgelost. Dat is belangrijk: de site viert niet alleen wat we niet weten, maar ook wat we hebben ontdekt.

3. **De chip op de cockpit telt alleen open en in-gesprek**. Beantwoorde vragen tellen niet meer mee in "lopend". Dat geeft de vader een snelle maat voor: waar ligt nu nog werk?

Dit is wat het plan levend maakt. Niet één verhaal dat af is, maar een plek waar thuis, school en Alvah zelf aan kunnen werken.
