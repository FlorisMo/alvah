# Run 6 · FLOW lane: the first impression and how the whole game flows

> Lane lead's design, 2026-09-28. Branch `run6/flow`. Builders: read this whole file,
> then GOAL.md, STATE.md, CLAUDE.md (its "Rules learned the hard way" are binding) and
> ARCHITECTURE.md. Reviewer (the lane lead) picks this up cold: §9 says how each package
> is judged.

Floris: *"I would love a proper check on the game flow and content, especially the first
screens when entering and starting etc, so that's all amazing looking, smooth, and makes
sense."*

The lane covers everything from opening the URL to walking up to the first mission, plus
the shared screens between the world and the missions (briefing, fact, reunion, reward,
clue, Onderweg, HUD, pause, missiebord, sporenboek, badges) and every line of text on
them. What happens inside a running mission belongs to the MISSIONS lane; walking,
running, the jeep, the animals and the ranger's size belong to FEEL.

---

## 1. What a first-time player meets today (scouted 2026-09-28, laptop 1280×800 + iPad size)

Played with real keys and clicks on `main` (c9c0ab8), screenshots looked at. Golden is
ALL GREEN, so nothing blocks; what follows is about how it looks, feels and reads.

**Loading and title**
- For the first ~2 s the title shows primitive stand-ins (cone pines, faceted icosahedron
  "oaks", a flat orange box as the board), then the real GLB props pop in over them.
- The title is a *separate miniature diorama* (`render3d/Stage.ts`, ~400 lines of title
  code), not the world you will play in. Flat beige haze for a sky, a flat heath plate,
  the ranger at the left edge seen from the side with stiff A-pose arms.
- A big white panel covers the lower middle. Copy: "Word boswachter / Help de dieren van
  de Veluwe. / Kies een missie en train je breinkracht." The last line is meta
  (brain-training talk), not story. The 🔊 renders as a grey blob.
- Fonts: `tokens.css` names Fraunces, Lexend and Atkinson Hyperlegible but none is
  loaded (the file says "TODO: self-host"), so everything renders in Georgia and the
  system sans. The default reading font (Atkinson, `leesFont: true`) never shows.

**Ranger maker**
- A 860×680 white card covers almost the whole screen. The "preview" is a flat SVG
  cartoon (circle head) that does not look like the 3D ranger. The real 3D ranger *is*
  live-painted (`RangerLook.dressRanger`) but stands at the far left, half behind the
  card, side-on, so skin and eyes cannot be judged.

**Arriving in the world**
- "Dit is mijn ranger" is a hard cut into the world. For about a second, primitive
  stand-in trees (brown sticks with balls) stand at the edges, then pop.
- No establishing moment and no story: nobody greets you. The warden (the canon mentor,
  "by the report board") stands at (6.4, 4.4), *behind* the camera, and never speaks
  anywhere in the game. The voice says "Klaar, ranger Alvah. Op naar de hut." while you
  already stand at the hut.
- The spawn clearing is a big flat brown dirt disc (≈40% of the first frame).
- All ten mission name-tags show at once from spawn; three overlap top-right, one
  ("Het reekalf in het gras", 27 m away) sits on the cabin roof because tags draw on top
  of everything; two are cut off at the screen edges.
- One hint, "Loop met de pijltjes.", floats mid-screen over the missiebord. After the
  first step: "Loop naar een ring om te spelen." Nothing teaches running, looking round,
  the jeep or Enter. The `?` chip only repeats "Loop met de pijltjes.".
- The way to mission 1 is the top-left chip; walking straight ahead puts you in the
  missiebord ring first, whose big yellow "Bekijk het missiebord" competes with the goal.

**Shared screens**
- Briefing: six lines at once on a white card ("Hoi ranger!" … — whose voice?).
- Fact cards say "De raaf vertelt · 1/3" long before you have met a raaf (it is rescued
  from a menu: Pauze → "Help de jonge raaf").
- Clue, reward, pause, badges, missiebord, sporenboek: all white web cards with emoji
  icons; the sporenboek shows "???" for unfound clues.
- The *Onderweg* world-beat card has no Enter target (its options carry no
  `data-key`), so a keyboard player cannot answer it (STATE.md "still open").
- `fadeCut` (missiebord pick → marker) is a full-screen flat paper colour for ~0.8 s.
- A returning player's "Begin" cuts from the diorama to the world; "Naar het hoofdmenu"
  disposes the whole world and rebuilds the diorama.

**Words**
- UI strings are scattered inline through `ui/*` (≈40 child-facing sentences in
  ExploreHud, MissionFlow, WorldSession, Hub, Companion, worldbeat); the read-level
  corpus test (`core/readlevel.test.ts`) only covers content, onboarding and `SAY`.
- Wrong or inconsistent: "Een vos kift" (should be *keft*), "Je belt de politie van het
  bos" and "De stroper is gemeld bij de BOA" for the same person nobody ever met,
  "Bijna! Blijf rustig — probeer nog eens." (an em dash), a raaf that "vertelt" before it
  exists, "Kies een missie en train je breinkracht".

---

## 2. The experience we are building (the storyboard)

One sentence: **you open the game and you are already looking at the Veluwe you will
play in; from there to the first mission there is never a cut, a pop, a wall of text or
a moment where you do not know what to do.**

### 2.1 The first five minutes, beat by beat (laptop; iPad differences in brackets)

| # | Beat | What the player sees and hears | Takes |
|---|------|-------------------------------|-------|
| 0 | Open the URL | A warm paper-coloured veil with "Ranger van de Veluwe" in the serif and a row of five footprints that fill in, calmly. Never a stand-in prop. | ≤ 4 s |
| 1 | Title | The veil dissolves onto the **real world**: the spawn clearing at golden hour, the ranger small on the sand path, the cabin, the tree line, grass moving, a deer grazing far off, a slow drift of the camera. The title block (wordmark, "Word de nieuwe boswachter.", 🔊, Begin) sits over the sky, no big panel. Enter or a click presses Begin. | dwell |
| 2 | Begin (new player) | The camera glides down to the ranger (≈1.3 s). He turns round to face you. The maker panel slides in on the right. | 1.3 s |
| 3 | Make your ranger | Big 3D ranger on the left, facing you; every swatch you pick paints him at once (skin and eyes readable on his face). Name field + name chips, "Hoi, ranger Bo!". "Dit is mijn ranger". | player |
| 4 | Into the world | He turns back to the forest, the camera glides round and behind him into the play view (≈2 s, no cut). The world's sound fades in. Any arrow key takes over at once. | 2 s |
| 5 | Bram | The warden, **Bram**, stands by the missiebord in view, turns to you and speaks in a speaker strip at the bottom (read aloud, words light up): "Hoi Alvah! Welkom op de Veluwe." · "Ik ben Bram, de boswachter." · "Jij bent nu ook boswachter!" You can already walk. | ≈8 s |
| 6 | Learn to walk | Key-cap strip: [↑][←][→][↓] "Loop met de pijltjes." (iPad: the stick, "Sleep de stick om te lopen.") Gone after 3 m. | player |
| 7 | Learn to run | [Shift] "Hou Shift vast. Dan ren je." (iPad: "Duw de stick ver. Dan ren je.") Gone after 1.5 s of running, or after 12 s. | player |
| 8 | The hook | Bram: "Luister! Een kleine big is zoek." · "Help jij hem zoeken?" · "Volg de pijl linksboven." Now (not earlier) the chip appears top-left pointing at *De verdwaalde frisling*, and that marker's ring and name-tag glow softly. | ≈7 s |
| 9 | Look round | Only if he stands still ~5 s before reaching the marker: [muis] "Kijk rond: sleep met de muis." (iPad: "Kijk rond: veeg over het scherm."; a one-finger drag on the canvas already orbits, `Player.onPointerMove`). | optional |
| 10 | To the marker | Only the frisling's tag and the Missiebord tag are up; nothing overlaps; the chip counts down. At the ring: "Speel mee: De verdwaalde frisling" with a small [Enter] key cap on the button (laptop). | ≈15 s |
| 11 | Briefing | Bram's field note: his name and picture, the mission picture, the lines appearing one by one as they are read. "Ga op pad". Then the MISSIONS lane's game. | player |
| 12 | Back from mission 1 | Reunion in the world, reward card, clue card, back on patrol. Bram: "Er is nog meer werk, Alvah." · "Kijk maar op het missiebord." The board's tag glows. | ≈6 s |
| 13 | Later reveals | First time the next mission is far away on foot: Bram "Dat is ver lopen." · "Pak de jeep maar!" and the jeep's ring glows. After mission 2: "Bij de hut zit een jonge raaf." · "Kun jij hem helpen?" and the cabin porch gets a ring "Kijk in de hut". | on trigger |
| 14 | Returning player | Veil → title → Begin → the camera glides from the title into play (no maker) → Bram, once a session: "Welkom terug, Alvah!" | 2 s |
| 15 | Hoofdmenu | Pauze → "Naar het hoofdmenu": a soft fade, the ranger is back at spawn, the camera rises to the title shot, the title block returns. Begin glides back in. The world is never rebuilt. | 1.5 s |

Reduced motion (OS setting or the in-game toggle): every glide is a cut, the ranger's
turns are instant, the veil fades are instant, the title drift is off. Nothing else
changes.

### 2.2 Design rules for this lane

1. **One world, no second scene.** The title and the maker are *shots of the real world*,
   not a diorama. Every change of screen is a camera move inside that world or a card
   over it.
2. **One voice.** Bram (the warden/BOA of the canon, now with a first name) is the one
   person who speaks to the player: the arrival, the hook, the later reveals, the
   briefings (his field notes) and the ontknoping ("Je vertelt het aan Bram."). No
   surname, ever.
3. **One thing at a time.** At most one teaching strip (Bram or a lesson) on screen,
   never two hints; the proximity prompt (an action) may sit under it.
4. **Never blocking by accident.** Narration never takes the keys: the player can walk
   while Bram speaks. Only real menus (a card with a scrim) hold the ranger still.
5. **Every new line is read aloud**, word-highlighted, ≤ 7 words per sentence and per
   rendered line, AVI M3/E3, and lives in ONE copy module that the read-level test lints.
6. **No dead moments** (> 1 s with nothing moving, nothing to read and nothing to do) and
   **no flashes** (a full-screen flat colour, a white frame, a pop of stand-in geometry).
7. Laptop 1280×800 decides; iPad 1080×810 touch must work and look intended.

---

## 3. Package P1 · The front door: loading, a title that IS the world, the maker

### 3.1 Player experience and the bar
Beats 0-4 and 14-15 of §2.1. The bar:
- No stand-in geometry is ever visible (not on the title, not on arrival). The veil hides
  loading; it lifts when the spawn set is in, or after a cap.
- The title frame is poster-worthy: warm golden light, the ranger clearly readable on
  the path, the cabin and tree line, living grass and animals, no HUD, no marker rings,
  no name-tags, no labels. The title block never covers the ranger.
- Begin works by click and by Enter; it appears within 5 s on the laptop dev server
  (golden's soft limit is 8 s).
- Maker: the 3D ranger fills the left ~55%, faces the camera, full body, lit, solid (not
  faded by the camera rig); every swatch changes him within one frame; the panel fits
  1280×800 and 1080×810 **without scrolling**; all targets ≥ 56 px; Tab and Enter work;
  the name field still takes typing (Space types a space).
- Begin → maker, maker → play, title → play (returning) and play → title (hoofdmenu) are
  single eased camera moves with no cut, no snap, roll 0, fixed FOV; the ranger turns
  smoothly; reduced motion = cuts.
- The world object survives title ↔ play round trips (no dispose/rebuild).
- CI light mode (software GL) still boots and passes the smoke; draw calls < 150 on every
  one of these screens.

### 3.2 Technical approach
- **Boot** (`main.ts`): create the Stage (renderer + loop only), mount the veil, and
  immediately `import('./ui/Missions')` to build the World in *presentation* state.
  `Sound.unlock()` + `loadGameAudio()` stay synchronous inside the Begin gesture (iOS).
  The ambience bed starts on Begin, fading in under the glide.
- **Stage** (`render3d/Stage.ts`): delete the whole title diorama (ground, sand path,
  primitive trees, heather, board, blob shadows, `dressTitleReal`, `titleMixer`,
  `titleAvatar`, `titleReady`, `markLeavingTitle`, `exitWorld`'s re-dress). Before the
  world exists the loop just clears to the fog colour (the veil covers it). Fix at the
  root, delete the workaround: the P1.4/D3.17 bail-and-redress machinery exists only
  because the title was a second scene.
- **Presentation** (new `render3d/world/Presenter.ts`, wired through `World`):
  `world.present('title' | 'maker' | null)`. While presenting, the world behaves as in an
  activity (no player input, no proximity, no wayfinding, marker tags and rings hidden,
  the HUD absent) but everything else lives (wind, water, clouds, roaming animals, the
  ranger's idle). A shot is a camera pose relative to the spawn; moving between shots
  uses the kit's `makeReframe` (smoothstep, yaw the short way, roll 0, `arc` to go round
  the ranger, a cut under reduced motion). `present(null)` ends at the follow rig's own
  pose so the rig takes over without a jump (compute the rig's pose, glide to it, then
  hand over; or hand over and let the rig's documented ease-back finish, as
  `endActivity()` does, as long as it reads as one move). The ranger's turn to face the
  camera is a yaw ease on his group (≈0.8 s, the idle clip playing).
  - Title shot: find the most beautiful frame of the real spawn area by looking (take
    screenshots of candidates; judge them). A barely-there drift (≤ 0.3 m over ~20 s,
    secondary motion, off under reduced motion) like the old title sway.
  - Maker shot: in front of the ranger, full body, ranger at ~30-35% from the left of
    the frame, the panel on the right. The camera rig's near-fade must not touch him.
  - A returning player's Begin: title shot → play. "Naar het hoofdmenu": `fadeCut`
    (short), put the ranger (out of any vehicle) back at spawn facing −z, present
    'title', title block in.
- **World ready**: add a small in-flight counter to `render3d/Models.ts` (loads started /
  settled). `world.ready()` = the spawn set has settled (ranger rig, cabin, board, the
  warden, the nearby trees) OR a cap (≈ 6 s GPU, ≈ 2 s light mode) has passed since the
  build. The veil lifts on ready (600 ms fade; a cut under reduced motion). The dev hook's
  `titleReady()` reads `world.ready() && title block shown`; `avatar()` reads the world's
  ranger (it already can).
- **Flow** (`ui/flow/WorldSession.ts`): split `startWorld/startExplore` into
  `bootWorld()` (build the World, wire it, `present('title')`, `setScreen('title')`) and
  `enterPlay()` (HUD, audio scene, lessons hook for P2, `setScreen('world')`).
  `Hub.showTitle()` stops calling `leaveWorld()`. Keep `leaveWorld()` only if something
  else still needs it; otherwise delete it.
- **Maker** (`ui/AvatarCreator.ts`, `ui/avatar.css`): a right-hand panel (≈ 480 px at
  1280, ≈ 460 px at 1080; below ~760 px width it becomes a bottom sheet). Rows: header
  ("Maak je ranger" + the greet "Hoi, ranger Alvah!"), name field + chips, then four
  compact rows *legend left, four swatches right* (Huid, Haar, Ranger-jas, Ogen), then the
  footer (🔊 + "Dit is mijn ranger"). Delete the SVG cartoon preview and its scroll cue
  if it no longer scrolls. Keep every accessible name exactly: the radios
  "Huid: Donker", "Haar: Rood", "Ranger-jas: Spijkerblauw", "Ogen: Groen" (golden
  clicks them) and the buttons "Begin" and "Dit is mijn ranger" (26 specs click them).
  ←/→ move within a swatch row, ↑/↓ between rows (roving focus), Enter on a focused
  swatch picks it, Enter elsewhere presses "Dit is mijn ranger".
- **Spawn clearing dressing** (`render3d/world/Dressing.ts`): the flat brown dirt disc at
  spawn becomes a lived-in yard that reads in the title, maker and arrival frames: sandy
  path from spawn past the board, grass edges and tufts, a few heather mats, wildflowers
  by the cabin. Walk-through vegetation only (no new solids near the spawn, the board
  ring or the jeep), instanced, within the draw-call budget, every piece on the rendered
  ground (`terrain.y`).
- **Visual foundation** used by these screens and extended in P3: self-host the fonts
  (see §7.1) in `src/styles/fonts/` with `@font-face` in a CSS file imported by
  `main.ts` (Vite bundles and rebases them for the `/ranger` build; no request leaves
  the site); the title wordmark in Fraunces; reading text in the reading font.
- **Sky (bounded, only after the rest is done):** if the title and arrival frames still
  read as flat beige haze, tune the shared golden-hour dome (`Lighting.makeSkyDome` /
  `Atmosphere` stops) toward a warm horizon glow on the sun side and a soft clear top.
  No new draw calls, no fog-distance change (other lanes depend on visibility), checked
  in a title, an arrival and a mission frame.
- **Copy** (`content/screens.ts`): see §7.3.

### 3.3 Files
`src/main.ts`, `src/render3d/Stage.ts`, `src/render3d/World.ts`,
`src/render3d/world/Presenter.ts` (new), `src/render3d/Models.ts`,
`src/render3d/world/Dressing.ts`, `src/render3d/world/Sky.ts` / `src/render3d/Lighting.ts`
(sky, optional), `src/ui/flow/WorldSession.ts`, `src/ui/flow/session.ts`,
`src/ui/hub/Hub.ts` (showTitle), `src/ui/AvatarCreator.ts`, `src/ui/avatar.css`,
`src/styles/base.css`, `src/styles/tokens.css`, `src/styles/fonts.css` + font files (new),
`src/content/screens.ts`, `src/core/devhook.ts`, `src/ui/dev/wireDevhook.ts`,
`src/core/quality.ts` (light-mode title notes), tests: `e2e/golden.spec.ts` steps 1-2,
`e2e/boot.spec.ts`, `e2e/journey.spec.ts`, `e2e/devhook.spec.ts`,
`e2e/readaloud.spec.ts` (title), `e2e/quality.spec.ts` (light title), any spec that reads
`.boot-title` or the title backdrop.

### 3.4 Pitfalls found while scouting
- `menuOpen()` (session.ts) is true while a `.ra-fade` veil is up: the ranger is held
  under any veil. Good under the boot veil; do not leave one up longer than needed.
- The camera rig fades the ranger when the lens is close (`avatarOpacity`); the maker
  shot is close, so presentation must keep him solid.
- `RangerLook.dressRanger` repaints the shared material on every store change, so the
  world ranger is already the live preview; do not build a second ranger.
- The ranger's `idle` clip holds the arms out (a stiff A-pose); in the maker portrait it
  is prominent. FEEL owns the rig's animation: first merge `run6/scale-base` if it exists
  (FEEL's base: ranger at 1.32 m, Shift-to-run). If the arms are still stiff, fix it once
  at the root in the shared ranger rig code (not a maker-only hack) and say so in your
  report so FEEL knows.
- `RANGER_STAND_HEIGHT` (AnimalScale.ts) is the one height; FEEL changes it to 1.32. Read
  it, never hard-code a height in a shot.
- Speech before the first gesture is blocked by the browser: the title's read-aloud
  starts on the first key/click (as today). The veil carries no words but the name.
- `keys.ts` gives Enter to the visible `.btn-start`; a focused button (focus-visible)
  keeps it. The name `<input>` must keep Space.
- CI runs `npm run e2e:smoke` on SwiftShader against the production build; the world now
  builds at boot there too. Before you finish: stop your server and run
  `CI=1 RANGER_PORT=<port> npm run e2e:smoke`, and `npm run e2e:webkit` (iPad engine).
- Several smoke specs assert `.boot-title` has text "Word boswachter" and the readaloud
  spec expects the title 🔊 to say "Word boswachter": update them to the new copy
  (§7.3), do not keep the old copy to please a test.
- The dev hook is for reading; golden may read `titleReady()` to wait, never to skip.
- The world's adaptive quality probe (`World.probeQuality`, W7.2) persists its verdict
  (`kwaliteitTier`). Behind the veil the GLB decodes stall frames; do not let those
  frames count, or a fast laptop boots into the `laag` tier next time. Start probing
  after `ready()`.
- `World.update` returns early while an activity is active (no `cam.place`, no
  proximity); presentation relies on the same freeze, so the Presenter must drive the
  camera every frame itself, and `labels.fade` keeps running (hide the tags with
  `setLabelsVisible(false)`).

---

## 4. Package P2 · The first minute: Bram, learning by doing, finding mission 1

### 4.1 Player experience and the bar
Beats 5-10, 12-13 (jeep, missiebord) and 14 (welkom terug) of §2.1. The bar:
- Bram stands by the missiebord, in the first play frame, head-and-shoulders taller than
  the ranger, turns to face the ranger while he speaks, and a small speech mark floats
  over his head while he speaks.
- The speaker strip (name "Bram", a small drawn portrait, the line, karaoke highlight)
  sits bottom-centre, above the prompt slot; one line at a time; it advances when the
  voice is done (or after a reading time with voice off); it never takes the keys.
- The lessons come one at a time, each only once ever (persisted), each dismissed by
  doing it (walk 3 m; run 1.5 s; drag to look), with a timeout so nothing waits forever.
  Walking during Bram's greeting counts: a lesson already done is skipped.
- The chip appears with the hook (not before), pointing at mission 1; the frisling ring
  and tag glow for a few seconds; the path to it is readable.
- Name-tags: from spawn only the next mission and the Missiebord (plus anything within
  ~12 m); a tag hidden behind the cabin or another solid does not show on top of it; two
  tags never overlap on screen (the farther one fades); nothing cut at a screen edge
  reads as a word fragment (fade tags near the edge).
- The `?` chip opens a small "Zo speel je" card with key caps (laptop) or stick pictures
  (iPad); Esc or its button closes it.
- The jeep lesson and the missiebord beat fire once, at the right moment (§2.1 #12-13);
  a returning player hears "Welkom terug, Alvah!" once a session.
- golden steps 3 and 5 stay green and now also see the run lesson and the hook.

### 4.2 Technical approach
- **Bram in the world** (`render3d/world/Fauna.ts`): move `ranger-warden-boa` from
  (6.4, 4.4) to beside the missiebord (≈ 1.5 m to its side, clear of its ring, the
  camera's path and the jeep's parking spot), facing the spawn; update
  `POACHER_REFORMED` so the reformed poacher still stands by him. A calm yaw ease to face
  the ranger while speaking (`fauna.faceTowards(x, z)` or similar) and back after. A
  speech-mark sprite over his head (Labels-style, depthTest off, small) while he speaks.
  He stays solid (the ranger walks round him) and never stands in a mini-game patch
  (`playClear` already excludes actors).
- **Speaker strip** (new `ui/hud/Speaker.ts`): `say(lines, { speaker: 'bram' })`
  returns a promise; one queue; each line via `mountReadAloud` (karaoke + narrator);
  advance on `narrator.quiet()` plus a minimum reading time (≈ 1.2 s + 0.35 s per word),
  or on reading time alone when voorlezen is off; cancelled when a menu card opens, a
  mission starts or the world is presented. It is an `.explore-overlay` child (never a
  `.ra-overlay` menu), so `menuOpen()` stays false.
- **Lessons** (new `ui/hud/Lessons.ts`, replaces `mountOnboardHint` and the tap tip in
  `ExploreHud.ts`): a small ordered list `{ id, when, show, done, timeout }` driven by one
  rAF watcher. Persist per-lesson flags in settings (`core/state.ts`): replace
  `wereldHintGezien` / `tikHintGezien` with `geleerd: Record<string, boolean>` and migrate
  the old flags on load (wereldHintGezien → geleerd.lopen). Keep the dev hook
  `hint()` meaningful (active lesson id + learned set) and update `e2e/onboarding.spec.ts`.
  Running: read FEEL's signal (merge `run6/scale-base` first; a `world.isRunning()` or
  ground speed above the walk speed); if FEEL has not landed, detect Shift held while
  moving (keys) / stick at its rim (touch) and note it in the report.
  Look lesson: done on the first drag that orbits the camera (mouse or one finger: the
  canvas pointer handlers in `Player.ts` already orbit on touch).
- **Key caps** (CSS component `.kcap`): used by lessons, the controls card and a small
  [Enter] cap on the world's primary prompt buttons on a laptop (never on touch).
- **The script** (new `content/mentor.ts`): Bram's lines per beat (intro, hook for the
  first mission in simpel/knap variants, jeep, missiebord, raaf, welkom terug) with their
  triggers, `{naam}` filled from `rangerNaam`. The hook text must match the MISSIONS
  lane's frisling story: read
  `git -C ~/Code/alvah show run6/missions:games/Ranger-Adventures/design/run6-missions.md`
  first; if it tells a different story (e.g. the mother is searching), follow it.
- **Guidance** (`ui/hud/ExploreHud.ts`, `render3d/world/Markers.ts`): the chip stays
  hidden until the hook (today it is hidden until the first step); after the hook the
  next marker's ring and tag pulse softly for ~6 s (secondary motion: a steady glow under
  reduced motion).
- **Name-tags** (`render3d/world/Labels.ts`, `Markers.ts`): visibility rules (next
  mission; Missiebord ≤ 20 m; any tag ≤ 12 m; finished missions only near, as "✓ …"),
  an occlusion test against solid obstacles (the cabin, the bird hide, the watchtower:
  a segment-vs-circle test on the obstacle list, a few tags per frame, no allocation),
  a screen-space overlap pass (sort by distance, fade the farther of two overlapping
  cards) and an edge fade. No extra draw calls.
- **Jeep lesson**: when on foot, no lesson active, the next mission is > 30 m away and the
  jeep ≤ 40 m: Bram's two jeep lines, the jeep's ring/tag glows until he enters it; then
  the existing drive hint.
- **After mission 1**: on the first `resumePatrol()` after a first completion, Bram's
  missiebord lines and the board tag glow. Must not collide with the Onderweg beat
  (that one waits for 15 m of walking anyway) or the reward cards.
- **Controls card** (`?` chip): `showControls()` in `ui/hub/Hub.ts` or its own module; a
  `card()` with a scrim, rows of key caps + one word each (§7.3), read aloud, "Terug"
  (Esc).
- **A first-minute spec** (new `e2e/firstminute.spec.ts`): fresh save, real keys and
  clicks: Begin → maker → Dit is mijn ranger → Bram's lines (spoken, spy on
  `speechSynthesis` like scout scripts do) → walk lesson → hold Shift → run lesson done →
  hook → chip names the frisling → walk to the marker with the golden walker → "Speel
  mee" visible. Screenshots of every beat into `test-results/firstminute/`.

### 4.3 Files
`src/render3d/world/Fauna.ts`, `src/render3d/world/Labels.ts`,
`src/render3d/world/Markers.ts`, `src/render3d/World.ts` (small API additions),
`src/ui/hud/ExploreHud.ts`, `src/ui/hud/Speaker.ts` (new), `src/ui/hud/Lessons.ts` (new),
`src/content/mentor.ts` (new), `src/core/onboarding.ts` (fold into Lessons/mentor or
keep as the lesson copy), `src/core/state.ts` (settings.geleerd + migration),
`src/core/devhook.ts` (hint()), `src/ui/flow/WorldSession.ts` (resumePatrol beats),
`src/ui/hub/Hub.ts` (controls card), CSS in `src/ui/missions.css` or a new
`src/ui/hud/hud.css`, tests: `e2e/onboarding.spec.ts`, `e2e/firstminute.spec.ts` (new),
`e2e/golden.spec.ts` steps 3 and 5 (see §8), `src/core/*.test.ts` for the lesson logic.

### 4.4 Pitfalls
- 26 specs click "Dit is mijn ranger" and then walk at once; golden holds ArrowUp 1.5 s
  after 1.5 s. Nothing in P2 may hold the ranger: narration and lessons are non-modal.
- The golden walker does not press Shift; the run lesson must time out (≈ 12 s shown, or
  after 25 m walked) so the hook and the chip still come (golden step 5 soft-checks that
  the HUD names mission 1).
- One prompt slot: `arbitratePrompts()` shows one proximity prompt at a time; the speaker
  strip is a separate element above it, not a prompt.
- `showExploreHud()` re-renders the whole HUD (after every menu); lessons and the
  speaker must survive a re-render (state outside the DOM, re-mounted, not restarted).
- Tags are `THREE.Sprite`s with depthTest off, faded per frame in `Labels.fade`; keep the
  per-frame pass allocation-free (review PERF-2).
- Moving the warden changes the camera's clear-view solids and the movement smoke's
  corridor (actors were placed "+z of spawn so the forward (−z) corridor stays clear");
  run `movement.spec`, `camera.spec`, `camera-edges.spec`, `board.spec`, `flow.spec`.
- FEEL may also touch `Fauna.ts` (animals dodging the jeep) and golden step 3 (running):
  keep your edits in those files small and well separated; say exactly what you changed
  in golden so the integration merge is easy.

---

## 5. Package P3 · The shared screens: one visual language and seamless transitions

### 5.1 Player experience and the bar
Every screen between the world and a mission looks like one hand-made ranger's kit in
the same warm world: paper cards with a little grain, the serif for titles, the reading
font for text, one set of drawn line icons (no emoji as UI), one primary button style,
one quiet secondary style, cards that ease in and out. The bar:
- Screens in scope: briefing, raaf/"Wist je dat" fact, reunion caption, reward, clue
  (wildcam), season finale, ontknoping, Onderweg, the explore HUD (Pauze pill, chip,
  prompts, `?`, speaker strip, lessons), mission Pauze chip + menu, the pause hub,
  missiebord, sporenboek, badges, raaf hut and Instellingen (a light restyle only), the
  bird-bench frame.
- Each is judged on a screenshot at 1280×800 and 1080×810: on-style with its
  neighbours, one clear primary action, ≥ 56 px targets, nothing clipped, nothing
  overlapping, no scroll where the content fits.
- Keyboard: every screen has an Enter target and an Esc way back; the Onderweg card is
  answerable by keyboard (arrow keys move a visible focus between its options, Enter
  picks; on the direction beat ←, ↑, → focus "Naar links", "Rechtdoor", "Naar rechts").
- Transitions (record each with a 100 ms frame strip): marker → briefing → first step;
  last step → reunion → reward → clue → patrol; missiebord pick → marker → briefing;
  Stop de missie → world; pause ↔ world; bird bench in/out. No full-screen flat-colour
  frame longer than 150 ms, no white flash, no jump of the camera or the ranger, no
  moment > 1 s with nothing to read or do.
- Briefing: Bram's field note: kicker "Veldnotitie van Bram · Heide", the mission
  picture (the MissionIcon pictogram, large), the title, the lines appearing one by one
  in step with the voice (all visible once read; all at once under reduced motion), then
  "Ga op pad" and "Nog even rondkijken".
- Fact card voice: "Wist je dat? · 1/3" until the raaf is rescued, then "Kroa vertelt ·
  1/3" (its chosen name).
- Sporenboek: unfound clues read "Nog niet gevonden" with an outline icon, never "???".
- Reward: the mission pictogram with a ✓, the earned breinkracht badges easing in one by
  one, the knap woord, one primary button.

### 5.2 Technical approach
- Tokens and type (`src/styles/tokens.css`, `base.css`): §7.1. A shared card system
  (`.card` base + header / body / foot, the one scrim, one enter/leave animation,
  reduced motion = none) that every screen above uses; delete per-screen duplicates in
  `missions.css` as you replace them (a smaller stylesheet is the proof).
- Icons (new `src/ui/icons.ts`): ~20 inline SVG line icons (24 px grid, 2 px stroke,
  round caps, `currentColor`, `aria-hidden`): speaker, pause, book, raven, badge, gear,
  home, back, check, jeep, helicopter, camera, footprints, tyre track, compass, keyboard,
  stick, leaf, map pin, lock/outline. Replace the emoji used as UI chrome in `ui/*`.
  The five breinkracht glyphs in `core/skill.ts` `SKILL_META` get SVG twins for the badge
  UI; leave glyph uses inside the 2D mini-game floors alone (MISSIONS lane).
- `fadeCut` (session.ts): replace the flat full-screen paper with a shorter, softer dip
  (e.g. a warm vignette to ~85% for ≤ 250 ms each way) that still hides the move; a cut
  under reduced motion.
- Onderweg (`ui/flow/WorldSession.ts` `showWorldBeat`): roving focus + Enter; the
  options become proper radio-like buttons with key-cap hints on a laptop.
- MissionFlow boundary screens (`showBriefing`, `showFact`, `showReunion`, `showReward`,
  `showWildcamCapture`, `showSeasonFinale`, the mission Pauze menu) and Hub screens
  (`showPauseHub`, `showMissionBoard`, `showCaseBoard`, `showOntknoping`, `showBadges`),
  `ui/Companion.ts` and `ui/Tweaks.ts` (light restyle).
- **Do not change** `runMission`'s step loop, the engines (`render3d/engines`, `engines`,
  `render2d`), the play kit, or what a mission does between its steps, beyond what the
  MISSIONS design asks of the frame. Read
  `git -C ~/Code/alvah show run6/missions:games/Ranger-Adventures/design/run6-missions.md`
  before touching any mission-facing card and build the frame its missions need (e.g. if
  they drop the between-step fact cards or add a mission-specific briefing picture).

### 5.3 Files
`src/styles/tokens.css`, `src/styles/base.css`, `src/ui/missions.css`,
`src/ui/avatar.css` (only to share tokens), `src/ui/icons.ts` (new),
`src/ui/flow/MissionFlow.ts` (the boundary cards only), `src/ui/flow/WorldSession.ts`
(worldbeat card), `src/ui/flow/session.ts` (card/fadeCut), `src/ui/hub/Hub.ts`,
`src/ui/hud/ExploreHud.ts`, `src/ui/Companion.ts`, `src/ui/companion.css`,
`src/ui/Tweaks.ts`, `src/ui/tweaks.css`, `src/ui/ReadAloud.ts` (progressive lines),
`src/ui/MissionIcon.ts`, `src/core/skill.ts` (SVG badge twins), `src/ui/keys.ts` (only
if the roving focus needs it), tests: `e2e/flow.spec.ts`, `e2e/readaloud.spec.ts`,
`e2e/pause.spec.ts`, `e2e/board.spec.ts`, `e2e/raaf-fact.spec.ts`,
`e2e/veldnotitie.spec.ts`, `e2e/sitspot.spec.ts`, `e2e/missions.spec.ts` (must stay
green: run it), plus a new e2e for the Onderweg keyboard path.

### 5.4 Pitfalls
- Tests find buttons by accessible name ("Ga op pad", "Verder", "Verder op patrouille",
  "Speel mee: …", "Stap in de jeep", "Bekijk het missiebord", "Terug naar de open plek",
  "Stop de missie", …). Keep every name; an SVG icon must be `aria-hidden` so it never
  joins a name. `readaloud.spec` checks a hover label never speaks its icon.
- `menuOpen()` keys off `.ra-overlay:not(.explore-overlay)` and `.ra-fade`; the card
  system must keep those classes (or change `menuOpen` in the same commit).
- An enter animation must not make `keys.ts` `usable()` miss the primary (it tests
  `elementFromPoint` at the button's centre) nor make Playwright wait for a moving
  element forever: keep it ≤ 200 ms, opacity + ≤ 8 px translate.
- The Onderweg beat fires only on every 3rd completion in a session
  (`WORLDBEAT_EVERY`); to see it for real, play mission 1 three times in one session
  (replays count) or finish three missions. Do not add a skip or debug trigger to the
  shipped game.
- Emoji also appear in content text (e.g. clue glyphs, `CLUE_GLYPH`); `forSpeech` strips
  pictographs from speech; SVG removes the problem at the root for UI chrome.

---

## 6. Package P4 · Story and words: one copy deck, one cast, the reveals, a final play

### 6.1 Player experience and the bar
Everything a child reads or hears is short, correct Dutch at AVI M3/E3, read aloud, in
one voice and one cast, revealed in an order that makes sense. The bar:
- Every child-facing string in `src/ui/**`, `src/core/worldbeat.ts`,
  `src/core/companion.ts`, `src/core/onboarding.ts`, `src/content/mentor.ts` and
  `src/content/screens.ts` lives in the content layer and is covered by the read-level
  corpus test (≤ 7 words per sentence) plus two new checks: no rendered line over 7
  words, and no em dash, no surname-shaped word, no "held/kanjer" hype.
- Names are consistent everywhere: Bram (the warden; also the ontknoping and the finale),
  the raaf and its chosen name, missiebord (the board in the world), sporenboek (the
  book in Pauze), Onderweg, breinkracht names.
- Content fixes (at least): "kift" → "keft"; the ontknoping "Je belt de politie van het
  bos." → "Je vertelt het aan Bram."; "De stroper is gemeld bij de BOA." → "…bij Bram.";
  "Bijna! Blijf rustig — probeer nog eens." → no dash; the raaf hut's four-sentence
  intro split into short lines; "???" gone (P3); every "Hoi ranger!" briefing opener
  consistent with Bram's field-note voice (coordinate with MISSIONS for their four
  missions; fix the other six yourself).
- Reveals: after mission 2, Bram's raaf lines and a ring on the cabin porch
  ("Kijk in de hut") that opens the raaf hut (the same `showCabin` Pauze uses); the first
  clue introduces the sporenboek ("Hij zit nu in je sporenboek." + where: "Je vindt het
  bij Pauze."); the fact voice switches when the raaf is rescued (P3).
- A read-aloud coverage e2e: walks title → maker → arrival → lessons → hook → marker →
  briefing and (seeded) a reward/clue, spying on `speechSynthesis`, and fails when a
  visible new line was never spoken.
- Final whole-flow play on laptop and iPad size (and `npm run e2e:webkit`), a screenshot
  strip of every beat of §2.1, and a short "what a player experiences now" write-up in
  the report for the final agent's STATE.md (do not edit STATE.md yourself).

### 6.2 Technical approach
- One copy module (extend `content/screens.ts` into `content/copy.ts` with named groups,
  or several small ones under `content/`), imported by the UI; `readlevel.test.ts` pushes
  every group into its corpus; a line-length check on the strings that render as one
  line (buttons, chips, tags, strip lines).
- The raaf porch ring reuses the missiebord proximity pattern (`Markers.placeBoard` /
  `onBoardApproach`): a ring by the cabin, a prompt in the one prompt slot, Space/Enter.
- Read the MISSIONS design and their branch's `content/veluwe.ts` changes before
  editing mission copy; edit only the six missions they do not own, and send them your
  wording notes for their four in your report.

### 6.3 Files
`src/content/*.ts` (copy, mentor, veluwe for the six non-MISSIONS missions and the arc),
`src/core/readlevel.test.ts`, `src/core/worldbeat.ts`, `src/core/companion.ts`,
`src/ui/**` (strings only, plus the porch prompt), `src/render3d/world/Markers.ts` (the
porch ring), `e2e/readaloud.spec.ts` or a new `e2e/readcoverage.spec.ts`,
`e2e/firstminute.spec.ts` (extend).

### 6.4 Pitfalls
- `readlevel.lintCorpus` counts words per *sentence*; a button like "Speel nog eens: De
  verdwaalde frisling" is one line of 6 words: fine; check lines, not only sentences.
- Content text is also asserted by specs (e.g. golden matches mission titles; missions
  spec answers choice rounds by the option marked `goed`). Change titles only with the
  MISSIONS lane's agreement; never change what `goed` marks.
- "Knap woord" names and `vaktermBadge` ids are save data (`knapWoorden`): rename the
  shown text only, never the ids.

---

## 7. Shared specs

### 7.1 Visual language
- **Type.** Headings and the wordmark: *Fraunces* 600/700. Reading text: *Atkinson
  Hyperlegible* 400/700 (the default, `leesFont: true`) and *Lexend* 400/600 (leesFont
  off). All three are SIL OFL; get the latin `woff2` files from the `@fontsource/*`
  packages with `npm pack` into your scratch folder (no dependency added), copy only the
  needed weights plus each OFL licence into `src/styles/fonts/`, `font-display: swap`.
  Sizes: reading 28 px default (`--read-size`), leading 1.7, headings clamp(30-44 px).
- **Colour.** The existing tokens: paper `#fdfcf8` / `#f7f2e7`, ink `#1a1a1a`, green-deep
  `#123621`, sun `#f5c23b` (the primary), the warm scrim `rgba(28,21,11,.5)`. Cards: paper
  at ~94% with a faint grain (CSS gradients only), 1 px warm hairline, 20 px radius,
  `--shadow-lg`.
- **Buttons.** Primary: the sun button (≥ 56 px high). Secondary: a quiet green chip or
  text button. One primary per screen.
- **Icons.** One drawn line set (§5.2), never emoji as UI chrome.
- **Motion.** Cards: in 200 ms (opacity, ≤ 8 px rise), out 140 ms. Camera: eased glides
  via `makeReframe`. Reduced motion: no transitions, cuts only.
- **HUD layout.** Top-left: Pauze pill, then the chip. Bottom-right: `?`. Bottom-centre,
  stacked: speaker strip or lesson (never both) above the one prompt slot. Nothing
  mid-screen over the world in free roam.

### 7.2 Cast
- **Bram**: the warden/BOA of the canon (`ranger-warden-boa`), the player's mentor, by
  the missiebord. First name only. Calm, kind, few words.
- **The ranger**: the player, named in the maker (default Alvah), 8 years old, 1.32 m
  (FEEL).
- **The raaf**: rescued at the hut, then named by the player; tells the "Wist je dat"
  facts once rescued.
- **De stroper**: the reformed poacher, off in the trees; stands by Bram after the
  ontknoping.

### 7.3 Copy deck (new or changed lines; every sentence ≤ 7 words)

| Where | Line |
|-------|------|
| Veil | Ranger van de Veluwe |
| Title wordmark | Ranger van de Veluwe |
| Title sub | Word de nieuwe boswachter. |
| Title button | Begin |
| SAY.title | Ranger van de Veluwe. Word de nieuwe boswachter. Druk op Begin. |
| Maker title | Maak je ranger |
| Maker greet | Hoi, ranger {naam}! |
| Maker done (spoken) | *(removed: Bram greets instead)* |
| Bram · intro 1 | Hoi {naam}! Welkom op de Veluwe. |
| Bram · intro 2 | Ik ben Bram, de boswachter. |
| Bram · intro 3 | Jij bent nu ook boswachter! |
| Lesson · lopen (keys / stick) | Loop met de pijltjes. / Sleep de stick om te lopen. |
| Lesson · rennen (keys / stick) | Hou Shift vast. Dan ren je. / Duw de stick ver. Dan ren je. |
| Lesson · kijken (mouse / touch) | Kijk rond: sleep met de muis. / Kijk rond: veeg over het scherm. |
| Bram · hook 1 (simpel / knap) | Luister! Een kleine big is zoek. / Luister! Een frisling is zoek. |
| Bram · hook 2 | Help jij hem zoeken? |
| Bram · hook 3 | Volg de pijl linksboven. |
| Bram · jeep | Dat is ver lopen. · Pak de jeep maar! |
| Bram · after mission 1 | Er is nog meer werk, {naam}. · Kijk maar op het missiebord. |
| Bram · after mission 2 | Bij de hut zit een jonge raaf. · Kun jij hem helpen? |
| Porch prompt | Kijk in de hut |
| Bram · returning | Welkom terug, {naam}! |
| Controls card | Zo speel je · [pijltjes] Lopen · [Shift] Rennen · [muis] Rondkijken · [Enter] Doen · [Esc] Pauze (iPad: [stick] Lopen · [stick ver] Rennen · [veeg] Rondkijken · [tik] Doen) |
| Briefing kicker | Veldnotitie van Bram · {landschap} |
| Fact kicker (before / after the raaf) | Wist je dat? · {n}/{m} / {raafnaam} vertelt · {n}/{m} |
| Sporenboek, unfound | Nog niet gevonden |
| Sporenboek, where | Je vindt het bij Pauze. |
| Ontknoping 2 | Je vertelt het aan Bram. |

The hook must match the MISSIONS lane's frisling story; if their design changes who is
looking for the piglet, change hook 1-2 to fit (same length rules).

---

## 8. Tests we own and how they change

- `npm run gate` and `npm run golden` stay green after every package.
- **golden step 1**: Begin visible (< 8 s soft), `titleReady()` (now: veil lifted, title
  block shown, world ready), screenshot of the title; click Begin.
- **golden step 2**: the maker; the four swatch clicks by their accessible names; the
  screenshot now shows the 3D ranger in the portrait: add a `renderedLook`-style check
  that the jacket colour on screen in the maker is the chosen one (the maker is the
  first place a player judges it). "Dit is mijn ranger" → screen `world`.
- **golden step 3** (P2): after the first ArrowUp walk, hold Shift + ArrowUp: note the
  run lesson appeared and went away (FEEL owns the speed numbers; coordinate).
- **golden step 5** (P2): the chip must name mission 1 by the time step 5 starts (the
  hook has played); the marker is reached the same way.
- New: `e2e/firstminute.spec.ts` (P2), an Onderweg keyboard spec (P3), a read-aloud
  coverage spec (P4).
- Smoke (`@smoke`: boot, devhook, journey, movement, landmarks) green locally AND the CI
  way (`CI=1 … npm run e2e:smoke`) after P1 and P2. `npm run e2e:webkit` after P1, P2
  and P4. `e2e/missions.spec.ts` after P3 and P4. `e2e/flow.spec.ts` after every package.

---

## 9. How the lead reviews a package

For each package, on its branch, with a fresh browser context at 1280×800 (and one at
1080×810 touch), real keys and clicks, screenshots opened and looked at:
1. Play the beats the package owns in §2.1, with voice on (spy on `speechSynthesis`),
   then with reduced motion on. Record 100 ms frame strips of every transition it owns.
2. Check the bar in the package's section (3.1, 4.1, 5.1, 6.1) line by line.
3. Read every new line: ≤ 7 words, correct Dutch, spoken, consistent names.
4. Run: `RANGER_PORT=<port> npm run gate`, `npm run golden`, the specs the package lists,
   and for P1/P2 the CI-mode smoke. Read the tail lines, not the colour.
5. Draw calls < 150 on every new screen (`__ranger.drawCalls()`), no page errors.
6. `git diff run6/flow...` stays inside the package's files (plus tests); workarounds
   deleted in the same commit as the root fix.

A package passes when all six hold and the screenshots look like §2.1 describes.

---

## 10. Coordination

- **FEEL** (`run6/scale-base`, then its later branches): ranger 1.32 m, Shift-to-run,
  faster walk, the jeep, animals. P1 merges `run6/scale-base` before building the maker
  shot (the ranger's height and look); P2 merges it before the run lesson. We read
  `RANGER_STAND_HEIGHT`, never copy numbers. Overlap risk: `Fauna.ts` (warden move vs
  animal dodging), golden step 3, the ranger idle pose.
- **MISSIONS** (`run6/missions`): owns everything once "Ga op pad" is pressed, the four
  missions' content, `world/Progress.ts`, the engines and the play kit. We own the
  boundary cards' look and keyboard behaviour. Read their `design/run6-missions.md`
  before P2's hook, P3's cards and P4's copy. Overlap risk: `MissionFlow.ts` (we touch
  the card functions, they touch the step loop), `content/veluwe.ts` (we touch the six
  missions they do not own and the arc), `Markers.ts`.
- Merge order inside the lane: P1 → P2 → P3 → P4, each branched from `run6/flow` after
  the previous one landed there.
