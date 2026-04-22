# Next-steps-plan — vervolgfases na Fase 5

**Status**: definitief. Klaar om uit te voeren.

**Doel**: Fase 5 leverde alle content. Deze fases maken het project **onderhoud-klaar**:
vangnetten tegen regressie (privacy + broken links), een structuur die op schaal werkt,
rituelen voor doorlopend onderhoud. Geen over-engineering: alleen toevoegen wat
bewezen risico afdekt of duplicatie reduceert.

**Hoe te gebruiken**: elke fase is zelfstandig executeerbaar, met concrete bestanden,
commando's en een validatie-gate. Groen = door naar de volgende fase. Elke fase krijgt
een eigen commit met herkenbare message (`Fase 6: …`, `Fase 7: …`).

**Drie doctrines (onveranderd sinds website-plan.md)**:
1. **Surgical changes**: raak alleen wat de opdracht noemt.
2. **Goal-driven execution**: zonder groene validatie-gate niet doorgaan.
3. **Simplicity first**: minimum wat het probleem oplost, niets speculatiefs.

---

## Volgorde

```
Fase 6 (vangnetten) → Fase 7 (structuur) → Fase 8 (refactor) → Fase 9 (deploy) → Fase 10 (gids)
```

Fase 6 eerst omdat de overige fases (Fase 7 verhuist bestanden, Fase 8 hernoemt componenten)
risicovol zijn zonder CI-vangnet. Daarna Fase 7 zodat Fase 10 een plek heeft om te wonen.

---

## Fase 6 — CI-vangnetten: privacy + interne links (60 min)

**Waarom**: de harde regel "geen achternamen" leunt nu op menselijke alertheid. Eén
slip gaat live. Idem voor interne ankers (`#interventies-tijdelijk`) — een rename breekt
ze stilzwijgend. Node-scripts in CI vangen beide voor deploy.

### Stap 6.1 — Maak `scripts/check-privacy.mjs`

```js
#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BLOCKLIST = [
  'Moerkamp',
  // voeg toe wanneer relevant (let op: medewerkers/behandelaars-achternamen hier)
];

function* walkHtml(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walkHtml(path);
    else if (entry.endsWith('.html')) yield path;
  }
}

const violations = [];
for (const file of walkHtml('dist')) {
  const html = readFileSync(file, 'utf8');
  for (const name of BLOCKLIST) {
    if (html.includes(name)) violations.push(`${file}: found "${name}"`);
  }
}

if (violations.length > 0) {
  console.error('Privacy check FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Privacy check OK — ${BLOCKLIST.length} name(s) checked in dist/`);
```

### Stap 6.2 — Maak `scripts/check-internal-links.mjs`

Verzamelt alle `href="/..."` en `href="#..."` uit `dist/**/*.html`, verifieert dat:
- `/foo` of `/foo/` → `dist/foo/index.html` (of `dist/foo.html`) bestaat
- `/foo#bar` → bestand bestaat EN bevat `id="bar"`
- `#bar` → huidig bestand bevat `id="bar"`
- Externe URLs (`http…`, `mailto:`) → overslaan

```js
#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function* walkHtml(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* walkHtml(path);
    else if (entry.endsWith('.html')) yield path;
  }
}

const files = Array.from(walkHtml('dist'));
const idsPerFile = new Map();
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  idsPerFile.set(file, ids);
}

// Map URL path → file
const urlToFile = new Map();
for (const file of files) {
  const rel = file.slice('dist/'.length);
  // /index.html → '/', /foo/index.html → '/foo/', /404.html → '/404.html'
  if (rel === 'index.html') urlToFile.set('/', file);
  else if (rel.endsWith('/index.html')) urlToFile.set('/' + rel.slice(0, -'/index.html'.length) + '/', file);
  else urlToFile.set('/' + rel, file);
}

const violations = [];
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (!idsPerFile.get(file).has(id)) violations.push(`${file}: broken #${id}`);
      continue;
    }
    if (!href.startsWith('/')) continue; // relative links skipped
    const [path, anchor] = href.split('#');
    // normalize: add trailing slash if directory pattern
    const variants = [path, path + '/', path + '.html'];
    const target = variants.map(v => urlToFile.get(v)).find(Boolean);
    if (!target) { violations.push(`${file}: broken ${href} (no file)`); continue; }
    if (anchor && !idsPerFile.get(target).has(anchor)) {
      violations.push(`${file}: broken ${href} (no #${anchor} in ${target})`);
    }
  }
}

if (violations.length > 0) {
  console.error('Internal link check FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Internal link check OK — ${files.length} files scanned`);
```

### Stap 6.3 — Update `package.json` scripts

Voeg toe aan `scripts`:
```json
"check:privacy": "node scripts/check-privacy.mjs",
"check:links": "node scripts/check-internal-links.mjs",
"verify": "npm run build && npm run check:privacy && npm run check:links"
```

### Stap 6.4 — Herstructureer `.github/workflows/deploy.yml`

Vervang de `withastro/action@v3`-aanpak door expliciete steps zodat de checks tussen
build en deploy draaien:

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

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
      - name: Check privacy
        run: npm run check:privacy
      - name: Check internal links
        run: npm run check:links
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

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

### Validatie-gate Fase 6
- [ ] `scripts/check-privacy.mjs` en `scripts/check-internal-links.mjs` bestaan
- [ ] `npm run verify` slaagt lokaal
- [ ] Workflow slaagt na push
- [ ] Sabotage-test: voeg tijdelijk `Moerkamp` toe in een pagina → `verify` faalt
- [ ] Sabotage-test: voeg tijdelijk href=`/ongeldige-pagina` toe → `verify` faalt

---

## Fase 7 — Documentatie & research splitsen (30 min)

**Waarom**: `docs/source/` suggereert tijdelijkheid maar blijft staan. Mix van plan-documenten
en research is verwarrend. Nu terwijl de content stabiel is, structuur aanbrengen.

### Stap 7.1 — Verhuis research-bestanden

```bash
mkdir -p research
git mv docs/source/dossier.md research/
git mv docs/source/samenvatting.html research/
git mv docs/source/research-cognitie.md research/
git mv docs/source/research-oefeningen.md research/
git mv docs/source/research-boeken.md research/
git mv docs/source/research-pku-diep.md research/
git mv docs/source/research-doubleren.md research/
git mv docs/source/Research-practice-tools.md research/
rmdir docs/source
```

### Stap 7.2 — Verhuis website-plan.md en next-steps-plan.md naar `docs/`

`website-plan.md` staat nu in root. Voor consistentie naar `docs/` verplaatsen:

```bash
git mv website-plan.md docs/website-plan.md
# next-steps-plan.md staat al in docs/ (dit bestand)
```

Plus: README.md uit root update — vervang verwijzingen naar `website-plan.md` door
`docs/website-plan.md`.

### Stap 7.3 — Maak `research/_README.md`

```md
# Research — input-materiaal

Dit zijn de research-documenten die input vormden voor Fase 5 (content laden).
De authoritative versie van de inhoud staat live op alvah.nl en in `src/`.

## Regels

- **Niet publiceren vanuit hier**: gebruik dit NIET om pagina's te voeden.
  Dat is gebeurd in Fase 5.
- **Authoritative location**: `src/content/*` en `src/pages/*` zijn de waarheid.
- **Blijft staan**: handig als referentiebibliotheek en voor toekomstige uitbreidingen.
- **Drift wordt geaccepteerd**: deze bestanden worden niet automatisch gesynct
  met de live pagina's.

## Van welk document kwam welke live pagina?

| Research-bestand | Live locatie |
|---|---|
| dossier.md | /dossier |
| samenvatting.html | /samenvatting |
| research-cognitie.md | /wetenschap (§01, §06) |
| research-pku-diep.md | /wetenschap (§02, §03, §04, §08) |
| research-doubleren.md | /doubleren |
| research-oefeningen.md | /oefeningen (~30 items) |
| research-boeken.md | /oefeningen (boeken-categorieen) |
| Research-practice-tools.md | nog niet verwerkt — toekomstige EF-mini-apps scope |
```

### Stap 7.4 — Update `tsconfig.json`

Wijzig `exclude` van `["dist", "reference", "docs"]` naar:
```json
"exclude": ["dist", "reference", "docs", "research"]
```

### Stap 7.5 — Update `CLAUDE.md`

Voeg aan regel-sectie toe:
- `research/` bevat input-materiaal voor Fase 5. Niet bewerken om publicatie te beïnvloeden — authoritative versie is altijd `src/`. Zie `research/_README.md`.

### Validatie-gate Fase 7
- [ ] `docs/source/` bestaat niet meer
- [ ] `research/` bevat 8 research-bestanden + `_README.md`
- [ ] `docs/` bevat alleen: `website-plan.md`, `next-steps-plan.md`, `practice-games-plan.md`
- [ ] README.md verwijst naar `docs/website-plan.md` (niet meer naar root)
- [ ] `CLAUDE.md` bevat regel over `research/`
- [ ] `npm run verify` slaagt

---

## Fase 8 — DocPage-component extractie (60–90 min)

**Waarom**: vier pagina's (dossier, wetenschap, onderwijs, doubleren) herhalen identieke
30-regels `doc-layout`-markup plus `chapters`-array. Eén wijziging in het patroon
(bijv. sticky offset) moet nu op vier plekken. Component = single source of truth.

### Stap 8.1 — Maak `src/components/DocPage.astro`

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

interface Chapter {
  id: string;
  num: string;
  titel: string;
}

interface Props {
  title: string;
  description: string;
  pageTitle: string;
  lede: string;
  chapters: Chapter[];
  mobileSummary?: string;
}

const { title, description, pageTitle, lede, chapters, mobileSummary } = Astro.props;
const summaryText = mobileSummary ?? `In deze pagina — ${chapters.length} secties`;
---
<BaseLayout title={title} description={description} wide={true}>
  <div class="doc-layout">
    <aside class="doc-toc" aria-label="Inhoudsopgave">
      <div class="doc-toc__sticky">
        <div class="doc-toc__label">In deze pagina</div>
        <ol>
          {chapters.map((c) => (
            <li><a href={`#${c.id}`}><span class="toc-num">{c.num}</span>{c.titel}</a></li>
          ))}
        </ol>
      </div>
    </aside>

    <article class="doc-main">
      <header class="doc-header">
        <h1>{pageTitle}</h1>
        <p class="lede">{lede}</p>

        <details class="doc-mobile-toc">
          <summary>{summaryText}</summary>
          <ol>
            {chapters.map((c) => (
              <li><a href={`#${c.id}`}><span class="toc-num">{c.num}</span>{c.titel}</a></li>
            ))}
          </ol>
        </details>
      </header>

      <slot />
    </article>
  </div>
</BaseLayout>
```

### Stap 8.2 — Migreer `src/pages/dossier.astro`

Patroon van de edit:
- Verwijder de `import BaseLayout`-regel; vervang door `import DocPage from '../components/DocPage.astro';`
- Houd de `chapters`-array (blijft in de frontmatter van de pagina).
- Vervang de hele `<BaseLayout …>…</BaseLayout>` wrapper door `<DocPage title="…" description="…" pageTitle="Onderzoeksrapport Alvah" lede="…" chapters={chapters}>…</DocPage>`.
- Verwijder binnen de wrapper: `.doc-layout`, `.doc-toc` (aside), `.doc-header`. Alleen de `<section>`-blokken blijven als children.
- Eventuele scoped `<style>` blijft zoals die is.

Verwachte regelreductie: ~30 regels.

### Stap 8.3 — Migreer `src/pages/wetenschap.astro`, `onderwijs.astro`, `doubleren.astro`

Identiek patroon. Scoped stijlen in `doubleren.astro` (positie-text, genum-list, indicator)
blijven staan — die zijn pagina-specifiek, niet layout.

### Stap 8.4 — Verifieer

```bash
npm run verify
```

Plus visuele check via `npm run dev` op alle vier de pagina's:
- Desktop (>=1024px): sticky TOC links werkt
- Mobile (<1024px): `<details>` klapt open/dicht, TOC-items klikbaar
- Alle ankers werken (test `#interventies-tijdelijk` vanuit /resultaten)

### Validatie-gate Fase 8
- [ ] `src/components/DocPage.astro` bestaat
- [ ] `dossier.astro`, `wetenschap.astro`, `onderwijs.astro`, `doubleren.astro` gebruiken `<DocPage>`
- [ ] `git diff --stat` toont substantiële regelreductie (-80 tot -120 regels totaal)
- [ ] `npm run verify` slaagt
- [ ] Visueel: geen regressies op desktop en mobile
- [ ] `#interventies-tijdelijk` anker werkt nog

---

## Fase 9 — Deploy-kwaliteit — artifact assertions (30 min)

**Waarom**: CNAME en robots.txt zijn kritische deploy-artefacten. Een build die zonder
deze slaagt maakt de site onbereikbaar of onbedoeld geïndexeerd. Simpele check voor deploy
vangt dat.

### Stap 9.1 — Maak `scripts/check-artifacts.mjs`

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const problems = [];

try {
  const cname = readFileSync('dist/CNAME', 'utf8').trim();
  if (cname !== 'alvah.nl') problems.push(`dist/CNAME contains "${cname}", expected "alvah.nl"`);
} catch {
  problems.push('dist/CNAME missing');
}

try {
  const robots = readFileSync('dist/robots.txt', 'utf8');
  if (!robots.includes('Disallow: /')) problems.push('dist/robots.txt missing "Disallow: /"');
} catch {
  problems.push('dist/robots.txt missing');
}

if (problems.length) {
  console.error('Artifact check FAILED:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('Artifact check OK');
```

### Stap 9.2 — Update `package.json`

```json
"check:artifacts": "node scripts/check-artifacts.mjs",
"verify": "npm run build && npm run check:privacy && npm run check:links && npm run check:artifacts"
```

### Stap 9.3 — Voeg step toe aan workflow

In `.github/workflows/deploy.yml`, tussen "Check internal links" en "Upload artifact":

```yaml
      - name: Check artifacts
        run: npm run check:artifacts
```

### Validatie-gate Fase 9
- [ ] `scripts/check-artifacts.mjs` bestaat
- [ ] `verify`-script draait alle drie checks
- [ ] Sabotage-test: verwijder tijdelijk `public/CNAME` → verify faalt
- [ ] Workflow slaagt na push

---

## Fase 10 — Onderhoudsgids (20 min)

**Waarom**: over 3 maanden wil je een milestone toevoegen en weet je niet meer welke
frontmatter-velden verplicht zijn. Drie minuten documentatie per taak voorkomt frustratie.

### Stap 10.1 — Maak `docs/onderhoudsgids.md`

Inhoudsopgave:
1. Nieuwe milestone toevoegen
2. Vraag beantwoorden (status wisselen)
3. Nieuwe oefening toevoegen
4. Achternaam blokkeren (privacy-guard uitbreiden)
5. Nieuwe pagina toevoegen (als toekomstige scope speelt)
6. Deploy-troubleshooting (veelvoorkomende fouten)

Per sectie:
- Bestandsnaam-conventie
- Verplichte frontmatter-velden (copy-paste-baar)
- Minimaal voorbeeld
- Tips / valkuilen

### Stap 10.2 — Verwijzingen toevoegen

- `CLAUDE.md` bovenaan: "Voor routinewijzigingen, zie `docs/onderhoudsgids.md`".
- `README.md` onder "Content bewerken": link naar onderhoudsgids.

### Validatie-gate Fase 10
- [ ] `docs/onderhoudsgids.md` bestaat met 6 secties
- [ ] `CLAUDE.md` verwijst ernaar
- [ ] `README.md` verwijst ernaar

---

## Fase 11 — Tone-of-voice review van alle content (4–6 uur)

**Waarom**: `docs/tone-of-voice-alvah-site-nl.md` is de leidraad voor deze site. De content
uit Fase 5 is geschreven voordat die gids bestond. Onvermijdelijk zitten er afwijkingen in:
em-streepjes, verboden woorden, AI-default-patronen ("werkt als een tierelier", "goud waard"),
hype-slotzinnen, sentiment. Deze fase doet een systematische pass langs alles.

**Volgorde-advies**: kan op elk moment, maar zinnig *na* Fase 8 (refactor). Dan is de
structuur stabiel en pas je puur op inhoudsniveau aan — één schone commit-reeks, géén
structurele wijzigingen ertussen.

**Scope**: alle pagina's in `src/pages/`, alle content in `src/content/`. Niet: `research/`
(input-materiaal, blijft ongewijzigd) en niet: `docs/tone-of-voice-alvah-site-nl.md` zelf
(de norm).

### Stap 11.1 — ToV-check-script (30 min)

Maak `scripts/check-tov.mjs` dat waarschuwingen rapporteert (niet-blokkerend):

- **Em-streepjes** (`—`, U+2014) — per ToV §Verboden constructies: "Em-streepjes. Nooit."
- **Verboden woorden** uit ToV §Vocabulaire, inclusief Nederlandse equivalenten:
  `onvergetelijk`, `een mooie reis`, `prachtige ontwikkeling`, `held`, `dappere kleine vechter`,
  `ons mannetje`, `ons zonnetje`, `laat zich door niets tegenhouden`, `is een inspiratie voor iedereen`,
  `op reis gaan` (als metafoor), `volwaardig potentieel ontgrendelen`, `empoweren`,
  `bloeien` (als metafoor), `bijzonder kind` (als vulling), `delve`, `unlock`, `game-changer`,
  `journey`, `transformative`, `it's worth noting`, `move the needle`, `deep dive`,
  `circle back`, `elevate`, `curate`.
- **Uitroeptekens** buiten attribueerbare citaten.
- **"hij of zij" / "hem of haar"** constructies.
- **"eerlijk gezegd" / "letterlijk" / "eigenlijk"** als vulling.

Output: regel-per-regel `file:line:match`, per categorie. Exit altijd 0 — ToV is sturing,
geen harde test. Niet aan `verify` toevoegen.

Script in `package.json`:
```json
"check:tov": "node scripts/check-tov.mjs"
```

### Stap 11.2 — Em-streepje auto-sweep (45 min)

De ToV verbiedt em-streepjes zonder uitzondering. Ik gebruikte ze in Fase 5 voor drie
patronen. Alle drie hebben een alternatief:

| Patroon | Voorbeeld nu | Herschrijven naar |
|---|---|---|
| Bijstelling | "De Mheen — een Jenaplanschool" | "De Mheen, een Jenaplanschool" |
| Inlassing | "Alvah — zoals bekend — heeft PKU" | "Alvah heeft PKU (zoals bekend)" |
| Pauze / contrast | "Ja — nee" of "Het werkte — tijdelijk" | "Ja. Nee." of "Het werkte tijdelijk." |

Werkwijze: `grep -rn "—" src/content/ src/pages/` (niet `research/`), langs de regels lopen,
één-voor-één kiezen welke vorm past.

**Commit apart** zodat de diff reviewable is: één commit `Fase 11.2: em-streepjes sweep`.

### Stap 11.3 — Pagina-per-pagina review (3–4 uur)

Per pagina de checklist uit ToV §Checklist voor publicatie doorlopen. Volgorde op
zichtbaarheid:

1. `/` (cockpit)
2. `/samenvatting` — entry-pagina
3. `/dossier` — langste, meest claims
4. `/wetenschap` — risico: te abstract / te ambtenarenachtig
5. `/doubleren` — bewaak neutrale framing
6. `/onderwijs` — risico: ambtenarentaal
7. `/resultaten` — meest cijfer-gedreven, minst tekst
8. `/bronnen` — bijna alleen lijstwerk
9. `/voortgang` — 5 losse milestone-bestanden
10. `/vragen` — 19 losse bestanden
11. `/oefeningen` — 40 losse bestanden

**Checklist per stuk** (uit ToV):
- [ ] Toon-scores (Formeel / Grappig / Oneerbiedig / Energie) binnen ±1 van doel per inhoudstype (zie ToV §Toon per inhoudstype)
- [ ] Geen verboden woorden of clichés
- [ ] Geen em-streepjes (Fase 11.2 al opgeruimd; double-check)
- [ ] Geen uitroeptekens behalve in Alvah-citaat
- [ ] Geen "hij of zij"
- [ ] Geen inspiratie-porno-zinnen
- [ ] Alvah wordt genoemd vóór zijn aandoening
- [ ] Ten minste één kenmerkend patroon aanwezig: ja-en-nee, stil slot, droge onthulling, "wat zit erachter?"
- [ ] Perspectief consistent (ik vs. we, niet door elkaar)
- [ ] Geen clevere metafoor waar gewone versie klopt
- [ ] Bron bij elke wetenschappelijke claim (auteur + jaar)
- [ ] Datum bij observaties
- [ ] Slot is wending of feit, geen samenvatting, geen sentiment
- [ ] Geen van-bovenaf-moraliseren ("ouders zouden altijd…")
- [ ] "Zou ik dit oké vinden als Alvah het op zijn 16e leest?"
- [ ] "Zou dit voor generieke opvoedblog / AI-tekst kunnen doorgaan?" — zo ja: herschrijven

Bij twijfel: inline `<!-- TOV: [korte notitie] -->` markeren en later bespreken in plaats
van ter plekke wegschrijven.

### Stap 11.4 — Content collections (45 min)

- **40 oefeningen** (`src/content/oefeningen/*.md`): scan op hype-taal ("kerninterventie", "goud waard",
  "onmisbaar", "ideaal"). Vervanging meestal: "werkt", "nuttig", "bruikbaar". Evidence-labeling
  eerlijk houden — `sterk` / `matig` / `zwak` / `praktijkclaim` zijn al goed, niet oppoetsen.
- **5 milestones** (`src/content/milestones/*.md`): stil-slot-patroon waar mogelijk. Geen
  prestatiesticker-taal. Data, feiten, eventueel één droge observatie.
- **19 vragen** (`src/content/vragen/*.md`): direct. "Waarom"-velden niet dramatiseren.
  Ja-en-nee-framing waar van toepassing: wat we (denken te) weten, wat we nog niet weten.

### Stap 11.5 — Validatie-gate Fase 11
- [ ] `scripts/check-tov.mjs` rapporteert 0 em-streepjes, 0 uitroeptekens (buiten citaten), 0 "hij of zij"-constructies
- [ ] Verboden-woorden-rapport: elke hit opgelost of bewust behouden met reden
- [ ] Drie willekeurige pagina's handmatig tegen ToV-checklist gelegd
- [ ] `npm run verify` slaagt
- [ ] Git diff reviewable: alleen stijl-wijzigingen, geen structurele

### Wat bewust blijft

- `research/` (ex-`docs/source/`) — input-materiaal, niet authoritative. Onaangeroerd.
- `docs/tone-of-voice-alvah-site-nl.md` — de norm, blijft zoals die is.
- Zod-schema's en frontmatter-structuur — taal-level wijzigingen, geen structuur.
- Italic-cijfer-koppen (01, 02, …) — visueel patroon, niet taal.

---

## Wat bewust niet in scope

- **Unit tests (Vitest)** — voor statische content met Zod-schema-validatie voegen ze
  weinig toe. De CI-checks uit Fase 6 en 9 dekken de echte risico's af.
- **E2E tests (Playwright)** — alleen twee kleine filter-islets met interactie;
  onderhoudslast hoger dan waarde.
- **Linting/formatting automation** — 2-persoon-projectje, Prettier-in-CI levert meer
  conflicten dan winst.
- **Preview deploys per commit / PR** — er is geen PR-flow, lokaal `npm run dev` is
  sneller.
- **i18n, dark mode, PWA, search-index** — uit scope per oorspronkelijk website-plan.

---

## Samenvatting

| Fase | Duur | Wat | Output |
|---|---|---|---|
| 6 | 60 min | CI-checks privacy + links | `scripts/check-*.mjs`, workflow-herstructurering |
| 7 | 30 min | docs/research splitsen | `research/` map, docs-herschikking |
| 8 | 60–90 min | DocPage-component | 4 pagina's migreren, ~100 regels minder |
| 9 | 30 min | Artifact-checks | `check-artifacts.mjs`, verify alle drie |
| 10 | 20 min | Onderhoudsgids | `docs/onderhoudsgids.md` + verwijzingen |
| 11 | 4–6 uur | Tone-of-voice review alle content | em-streepje sweep, pagina-per-pagina checklist, collections review |

**Totaal**: 7 tot 10 uur, verdeeld over losse sessies. Fase 11 is het grootste blok
en het meest content-gericht. Elke fase heeft eigen commit en eigen validatie-gate.
Niet doorgaan bij een rood vinkje.

**Aanbevolen volgorde**: 6 → 7 → 8 → 9 → 10 → 11. Fase 11 als laatste zodat structuur
(6–10) eerst stabiel is en je puur op inhoud finetunet.
