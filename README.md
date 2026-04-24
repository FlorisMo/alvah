# Alvah

Dossier en website voor Alvah. Een werkdocument dat alle wetenschappelijke onderbouwing, interventies, voortgang én openstaande vragen op één plek verzamelt — voor familie, school en behandelaars.

## Lokaal draaien

```bash
npm install
npm run dev
```

De site draait op http://localhost:4321.

## Bouwen

```bash
npm run build
```

## Deployen

Push naar `main`. GitHub Actions bouwt en deployt automatisch naar GitHub Pages (custom domain: alvah.nl).

## Content bewerken

- `src/content/oefeningen/` — catalogus van interventies (markdown per oefening)
- `src/content/milestones/` — chronologische tijdlijn (markdown per milestone)
- `src/content/vragen/` — openstaande vragen, gecategoriseerd naar wie ze beantwoordt

Schema's staan in `src/content.config.ts`. Zie `CLAUDE.md` voor werkinstructies.

## Oefenspelletjes (`/spelen`)

Privé-subtree voor Alvah zelf: EF-oefenspelletjes (werkgeheugen, inhibitie, aandacht, flexibiliteit) met `localStorage`-voortgang en een admin-pagina voor ouder-inzicht. Alles client-side — geen server, geen tracking.

- **Plan + fasering**: `docs/practice-games-plan.md` (begin met de hervat-gids bovenaan)
- **Data-schema**: `docs/practice-games-schema.md`
- **Wetenschappelijke onderbouwing**: `docs/source/Research-practice-tools.md`
- **Referentie-repo's** in `reference/` (gitignored, read-only): uitsluitend leesbron — zie §4 van het plan voor clean-room-regels.

## Plannen en documentatie

- `docs/practice-games-plan.md` — /spelen-subtree, actieve bouwfase
- `docs/next-steps-plan.md` — dossier-kant onderhoud (Fase 6–11, aparte track)
- `docs/tone-of-voice-alvah-site-nl.md` — schrijfgids voor alle content
- `docs/tov-check.md` — automatische ToV-check bij commit + bewust-behouden-lijst
- `docs/practice-games-schema.md` — localStorage-schema `alvah-ef-v1`
- `docs/source/` — research-input

## Content-wijzigingen

De pre-commit hook (`.githooks/pre-commit`) draait `npm run check:tov:strict`
op gestaged content. Em-streepjes, "hij of zij" en retorische tags
blokkeren de commit. Zie `docs/tov-check.md`.

Hook-pad wordt automatisch ingesteld door `npm install`. Handmatig:
`git config core.hooksPath .githooks`.
