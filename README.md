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
