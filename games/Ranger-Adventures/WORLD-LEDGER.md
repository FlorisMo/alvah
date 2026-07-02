# WORLD-LEDGER — run 2: één immersieve 3D-wereld

> Tickable checklist for the second autonomous run. Specs + acceptance
> criteria per box live in [WORLD-PLAN.md](WORLD-PLAN.md) §5 under the same
> ID. Weights `(N)` drive the progress %. Tick via:
> `RUN_LEDGER=WORLD-LEDGER.md node games/Ranger-Adventures/app/scripts/ranger-run.mjs tick "W0.1"`
> — tick enforces build + e2e:smoke mechanically and refuses on red
> (`--force` only for W0.7 / W0.8 / W3.0 / W3.4a / W3.4b / W3.5).
>
> Definition of done for EVERY box: targeted unit test green where the plan
> names one + build green + `e2e:smoke` green (STAGED definition, plan §3.1:
> v1 = boot→world until W0.4 adds the movement assert and freezes it) + the
> box's own E2E assert where the plan names one. Split oversized boxes into
> sub-boxes here first; replace the parent checkbox with plain text and
> always tick with the full sub-id (e.g. W2.4a).

## Fase W0 — Waarheidsharnas (browser proof)

- [x] W0.1 Playwright scaffold: devDep, config (poort ~4199, reuseExistingServer, CI-retries), boot smoke spec, npm scripts e2e + e2e:smoke, chromium install, gitignore-regels (test-results/, playwright-report/, e2e/__shots__/, incoming/), git hooksPath .githooks (3)
- [x] W0.2 Dev-state hook window.__ranger (screen, pos, cameraYaw, drawCalls, missionView, clip) achter DEV of ?dev=1 (2)
- [x] W0.3 Journey E2E: Begin → avatar → hut → Verken de Veluwe → screen world, met screenshots; world-reach in e2e:smoke v1 (2)
- [x] W0.4 Movement red-first E2E: tap-to-walk ≥2 m via expect.poll; diagnose + fix waarom taps de ranger niet bewegen; e2e:smoke upgraden en BEVRIEZEN; root-cause in plan §10 (3)
- [x] W0.5 Budgets overlay ALLEEN achter ?dev=1 (niet DEV); E2E assert aanwezig/afwezig (1)
W0.6 CI-gate in deploy.yml — gesplitst (vereist een groene ubuntu-run vóór het blocking-flippen):
- [x] W0.6a Test-job landen: unit-tests (blokkerend) + e2e:smoke (continue-on-error, paths-gated op ranger-wijzigingen, --with-deps chromium, swiftshader launch-args, playwright-cache); build needs test; push + één groene ubuntu-run observeren (1)
- [x] W0.6b e2e:smoke naar blocking flippen (continue-on-error weg); nog één groene ubuntu-run bevestigen (1)
- [x] W0.7 Meshy balance probe: credits loggen (gemaskeerd) of status --blocker; --force toegestaan (1)
- [x] W0.8 WebKit-project (iPad Safari engine): webkit-config forward-ready gelandt; lokaal draaien onmogelijk (frozen webkit op mac14-arm64, OS niet te updaten wegens schijfruimte) → graceful-degrade skip met §10-verdict; CI-webkit optioneel follow-up; --force toegestaan (2)

## Fase W1 — Besturing

- [x] W1.1 core/input.ts pure module (pijlen + WASD + joystick-vector, camera-relatief) + unit tests (2)
- [x] W1.2 Toetsenbord lopen door resolveMove; E2E ArrowUp poll ≥2 m + collision houdt (3)
- [x] W1.3 Virtuele joystick ui/Joystick.ts (≥56 px, coarse-pointer default, Instellingen-toggle via state.ts); E2E touch-drag beweegt (3)
- [x] W1.4 Interactie-toets Space/Enter voor nabijheids-actie; E2E opent missie-briefing (2)
- [x] W1.5 Meedraaiende volgcamera (dt-onafhankelijke demping, yaw-clamp ~120°/s, reframe-precedentie, reduced-motion → vaste richting, toggle); unit tests demping/wrap/clamp + E2E yaw ≥45° én yaw-stil onder reduced-motion (3)
- [x] W1.6 Onboarding-hint eerste wereld-entree (Loop met de pijltjes / Sleep de stick, voorleesbaar, seen-flag via state.ts) (1)

## Fase W2 — Wereld als voordeur

- [x] W2.1 Boot direct de wereld in na titel/avatar; interim Naar-de-hut knop; ?demo en ?sandbox blijven werken; journey-E2E aangepast (3)
- [x] W2.2 Cabin-hub op de open plek: cabin + case-board props, missiebord-overlay zonder leaveWorld; E2E assert missionView === 3d (3)
- [x] W2.3 Twee-missies-ketting E2E vanuit de wereld zonder hutbezoek; BeatSummary persist + missionView 3d voor beide (2)
- [x] W2.4a Pauze/hub-overlay shell: instellingen + badges bereikbaar zonder leaveWorld (2)
- [x] W2.4b Prikbord + raaf in hub-overlay; dode hut-flows opruimen; MILESTONE: commit + push (eerste coherente wereld-eerst build live) (2)

## Fase W3 — Levend (animaties)

- [x] W3.0 Sleutels verifiëren (test-meshy + test-xeno, gemaskeerd) en balans loggen; bij ontbreken status --blocker en dóór; --force toegestaan (1)
- [x] W3.1 Ranger regen + rig via Meshy (~35 cr, eerst balans checken, gen BACKGROUNDED met log-polling) of ingest app/incoming/ranger-alvah-rigged.glb; staged GLB ≥1 skin ≥2 clips (3)
- [x] W3.2 Speler-animatie state machine: idle/walk crossfade op snelheid, procedurele fallback; unit test + E2E clip().name walk én clip().time loopt (3)
- [x] W3.3 Warden + poacher spelen hun bestaande baked clips op hun plek (1)
- [x] W3.4a Accuracy-dossier zoogdieren: webresearch per dier (maten, vacht/seizoen, oogkleur, kenmerken, gang, 1-2 kindfeiten) naar research/animal-visual-accuracy.md met bron-URL + datum per claim; geen web → --blocker, nooit verzinnen; --force toegestaan (3)
- [x] W3.4b Accuracy-dossier vogels: zelfde behandeling voor de ~10 missie/audio-relevante vogels; zelfde bronregels; --force toegestaan (2)
- [x] W3.5 Dieren-animatie via CC0/CC-BY packs (Quaternius, poly.pizza, Kenney): match per boegbeeld-dier, license-log, schaal per dossier, optimize-animated, staged animated:true; stijl-check screenshot in qa-evidence-2; geen match → §10-verdict; Anything World NIET gebruiken; --force toegestaan (3)
- [x] W3.6 Ambient dierenleven: zwerf-loops met baked clips waar W3.5 ze stageerde en verbeterde procedurele gaits elders, 2 zwevende vogels; calm-pose gate; E2E ≥2 dieren + drawCalls <150 (3)
W3.7 Dossier toepassen — gesplitst (schaal / tinten+ogen+houding / teksten, elk eigen verificatie):
- [x] W3.7a Relatieve schaal per dier t.o.v. de ranger: canonieke stand-hoogte-tabel (dossier-afgeleid, ranger-relatief) door de plaatsings/showroom height-path; unit test op ordening + ranger-ratio; showroom true-scale modus + before/after screenshots in qa-evidence-2; E2E leest de toegepaste schaal-ordening live (1)
- [x] W3.7b Vacht-tinten + oogkleur-recept + houding: vos rufous-retint (+ andere dossier-strijdige vachten) via tint-util; eye-recipe uitbreiden (wolf/wildzwijn/frisling iris, adder rood) per dossier; houding-flags; unit test eyeSpecFor; before/after showroom in qa-evidence-2; §10-notitie (1)
- [x] W3.7c Strijdige Wist-je-dat teksten fixen via readlevel-corpus; §10 noteert elke dossier-tegenspraak (1)

## Fase W4 — Rijke wereld

- [ ] W4.1 Landmark-props geplaatst (uitkijktoren, ecoduct, vogelkijkhut, BOA-post, wegwijzers) + collision + wayfinding; E2E wandeling spawn→toren; <150 draw calls (3)
- [ ] W4.2 Natuur-aankleding: echte boom-GLB's bij paden/POI's, stronken, keien, paddenstoelen, riet per bioom (3)
- [ ] W4.3 Zandpaden-netwerk verbindt spawn en POI's; wayfinding volgt paden (2)
- [ ] W4.4 Grond-detail: procedurele albedo per bioom, gouache-gevoel behouden; before/after screenshots + één paar in qa-evidence-2/ (3)
- [ ] W4.5 Gouden-uur licht + selectieve schaduwen (hero shadow map + blob shadows); statisch licht; budget (3)
- [ ] W4.6 Lucht + adem: rijkere gradient, wolkschaduwen, windgolf, vogel-overvlucht ~12 s; stil onder reduced-motion (2)
- [ ] W4.7 Audio-pas: ambient-heide her-encoderen <1 MB, voetstappen per ondergrond, biome-crossfade; extra vogelzang bij sleutels (2)
- [ ] W4.8 Ven-water: fresnel-tint, golfloos default, subtiele rimpel zonder reduced-motion (2)

## Fase W5 — Voertuigen

- [ ] W5.1 Jeep bestuurbaar: Stap in/uit, arcade-kinematisch, ruimere camera; reduced-motion: snelheid ~3 m/s en halve draaisnelheid; E2E rijdt ≥10 m + caps gelden (3)
- [ ] W5.2 Jeep-gevoel: zachte motorloop, stof (uit onder reduced-motion), auto-langzaam bij dieren (2)
- [ ] W5.3 Helikopter opt-in (default UIT, via state.ts): helipads, klim/daal gedempt ≤2 m/s, vaste kruishoogte, horizon altijd recht, cockpitkader, vignette bij verplaatsing; reduced-motion → niet beschikbaar; E2E pad-naar-pad + FOV/roll/yaw-asserts (3)
- [ ] W5.4 Rapier-spike ALLEEN bij een in §10 vastgelegd controller-probleem, anders skip-tick met verdict; in-tree zonder commit, geen zijtak, schone status op main na afloop (3)

## Fase W6 — Diegetische missies + biologie

- [ ] W6.1 Frictie-audit alle 5 missies vanaf wereld-markers onder E2E met screenshots; ruwe randen gefixt (2)
- [ ] W6.2a rmSafe-audit corsi3d: cuts-niet-moves waar eerlijk kan; flip vereist reduced-motion E2E (nul camera-beweging) + §10-notitie; bij twijfel rmSafe:false HOUDEN (1)
- [ ] W6.2b rmSafe-audit simon3d: zelfde eisen als W6.2a (1)
- [ ] W6.2c rmSafe-audit zoeken3d: zelfde eisen als W6.2a (1)
- [ ] W6.2d rmSafe-audit wisselen3d: zelfde eisen als W6.2a (1)
- [ ] W6.3 Biologie diegetisch: Wist-je-dat via raaf-companion op locatie + veldnotitie op het prikbord (2)
- [ ] W6.4a Ken je roep, engine-helft: staircase-core over vogelzang met decoys, 2D-vloer + parity test, strings in readlevel-corpus (2)
- [ ] W6.4b Ken je roep, wereld-helft: zitplek bij vogelkijkhut, 3D-entree, audio, wayfinding; E2E één beat + missionView 3d (2)
- [ ] W6.5 Toon-gate: nieuwe strings in readlevel-corpus, voorlezen gekoppeld, ≥56 px E2E-assert (1)

## Fase W7 — Prestatie + oplevering

- [ ] W7.1 Code-splitting: vendor chunk + lazy chunks; /ranger/app.js entrynaam ongewijzigd; entry gzip <120 kB (2)
- [ ] W7.2 Kwaliteits-tiers via fps-probe (pixelRatio, vegetatiedichtheid) met hysterese; persist via state.ts (2)
- [ ] W7.3 Alles groen: unit + parity + volledige E2E (chromium én webkit) + build:site + astro build; AUTO-QA-REPORT-2.md met screenshots uit qa-evidence-2/ (2)
- [ ] W7.4 Ship: commit + push; E2E tegen astro preview met vooraf gezette sessionStorage gate-sleutel; curl 200 + app.js hash gewijzigd (1)
- [ ] W7.5 NEEDS-FLORIS iPad-acceptatie: lopen (stick + tap), jeep, missie vanaf marker, Deep Demo, Reduce-Motion beide standen (1)
