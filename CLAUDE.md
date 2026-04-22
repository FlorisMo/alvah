# Werkinstructies voor Claude Code

Dit is Alvah's dossier-site. Lees dit voordat je wijzigingen maakt.

## Absolute regels
1. Geen achternamen van personen in content of code. Alleen voornamen of rollen ("de gedragswetenschapper van het SWV", "Alvah's leerkracht").
2. Geen externe tracking, analytics of scripts van derden. Alle data blijft client-side; niets gaat naar een server.
3. Geen Tailwind, geen CSS-in-JS, geen nieuwe frameworks.
4. robots.txt blijft op Disallow.
5. Elke wijziging raakt alleen bestanden die de opdracht noemt.
6. `reference/` is read-only leesbron voor EF-oefeningen. Nooit bewerken, importeren of bundelen — altijd zelf herschrijven (zie `docs/practice-games-plan.md` §4).

## Stack
- Astro v5 met content collections (Content Layer API)
- Vanilla CSS met custom properties in src/styles/global.css
- Fraunces (headings) + Inter Tight (body) via Google Fonts
- Deploy: withastro/action@v3 naar GitHub Pages

## Content-structuur
- src/content/oefeningen/ — catalogus van interventies
- src/content/milestones/ — chronologische tijdlijn
- src/content/vragen/ — openstaande vragen (voor: ons|school|alvah)
- src/pages/ — 11 pagina's plus 404

## Voor elke sessie
Lees deze CLAUDE.md. Lees src/content.config.ts voor datamodel. Lees de te wijzigen pagina helemaal.

## Design
- Alleen bestaande `--custom-properties` uit global.css
- Section-kop: italic cijfer + serif heading (.section-head met .num span)
- Callouts: `--green-soft` achtergrond + 3px border-left `--green` (.callout)
- Kritische kanttekeningen: `--red-warn` border (.callout--warn)
- Open-onderzoek markers: `--accent-warm` border + label "Open onderzoek" (.callout--open)

## Verboden
- Externe trackers, pixels, embeds, third-party scripts
- Nieuwe dependencies zonder expliciete opdracht
- Achternamen van personen

## Toegestaan binnen /spelen
- `<script>`-blokken in `src/pages/spelen/**` en gedeelde modules in `src/scripts/**`
- `localStorage` onder de vaste sleutel `alvah-ef-v1` (zie `docs/practice-games-schema.md`)
- Web Audio API voor spel-tonen
