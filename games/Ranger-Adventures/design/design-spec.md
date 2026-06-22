# Design Spec — "Ranger van de Veluwe" (Missie 1)

> The craft bible. `plan.md` says *what* each screen is; this says *how it should feel* —
> camera, motion, micro-interactions, feedback, sound, and the wow-moments.
> Read alongside `plan.md`. In-game copy = Nederlands (M3/E3); design prose = English.
>
> **Standard to hold this to:** a 8-year-old with dyslexia should feel like a *ranger on a real
> morning on the Veluwe* — calm, capable, never tested. Every screen earns its motion. Nothing
> flashes for its own sake. Restraint is the house style.

---

## 0. The one big idea, in feel terms

The whole experience swings between two registers, and that swing *is* the design:

- **Top-down "doe-modus"** — humble, gridded, Game-Boy-honest. This is where you *work*.
- **Ingezoomde "verhaal-platen"** — lush, painterly, hand-illustrated 2D scenes. This is where you
  *feel*. They only appear at story beats (briefing portrait, the find, the reunion).

The **zoom between them is the signature move** of the game. A top-down search resolves into a
close, warm portrait of the frisling; the long walk home resolves into the reunion plate. The
contrast — plain world → rich moment — is what gives a tiny mission emotional weight. Spend the
illustration budget *there*, keep the world clean and readable.

---

## 1. Art direction

**Time of day:** early morning, golden hour. Low warm sun from screen-left. This single decision
drives everything — long soft shadows pointing screen-right, warm highlights on grass tips, cool
blue-green in the shade. It justifies the warm palette (`--paper`, `--accent-warm`) over Game-Boy
green and makes the heath feel like a real place at a real hour.

**Surface & line:** soft painterly tiles, *not* hard pixel-art. Think gouache with a faint paper
grain, gentle 2–3px soft edges, no harsh outlines on terrain. Animals/sprites get a slightly
firmer line so they read against the grass. The world should look hand-made, a little storybook.

**Camera language (three moves, used consistently):**
- **Glide** — gentle pan/follow during traversal. Easing `--ease-standard`, never snappy.
- **Push-in** — the signature: scale + slight vertical tilt from top-down toward a plate, vignette
  closing in. `--dur-cinematic` (900ms), `--ease-cinematic`.
- **Settle** — on arriving at a plate, a 2% overshoot that eases back, like a held breath. This is
  what makes beats feel *landed* rather than cut.

**The world breathes.** Even idle, nothing is fully static (except under reduced-motion): a 4s sine
"wind wave" crosses the grass grid, cloud shadows drift, a bird crosses every ~12s, the active
map-pin glows on a slow pulse. Ambient life at ~30–40% intensity so it never competes with the task.

**Placeholders (MVP):** every animal/vehicle/landscape = a striped placeholder block with a
monospace label (`frisling`, `rotte`, `ranger`, `heli`). Shape, size, shadow and *motion* are
real even when the art isn't — so the choreography reads now and the art drops in later.

> **Evolutie naar 3D (June 2026).** De dieren-art-richting is doorontwikkeld van CSS-shapes/
> placeholders naar **echte realtime-3D** (Three.js/glTF), in stappen richting realistisch. De
> golden-hour art direction hieronder is precies wat de 3D-licht-rig moet reproduceren. Specs +
> bouwplan: `3d-animal-animation-research.md` en `3d-animals-build-plan.md`. Het is een render-laag-
> upgrade — deze feel/motion/reduced-motion-regels blijven onverkort gelden voor de 3D-dieren.

---

## 2. Motion system (tokens the whole build shares)

```
Durations            Easings
--dur-instant  120ms --ease-standard   cubic-bezier(.2,0,0,1)     general
--dur-quick    200ms --ease-out        cubic-bezier(0,0,.2,1)     entrances
--dur-base     320ms --ease-in         cubic-bezier(.4,0,1,1)     exits
--dur-slow     520ms --ease-soft       cubic-bezier(.4,0,.2,1)    ambient / breath
--dur-cine     900ms --ease-overshoot  cubic-bezier(.34,1.56,.64,1) rewards only
```

**Rules**
- Entrances ease-*out* (arrive gently, no bounce). Exits ease-*in* (leave decisively).
- **Overshoot is rationed** — only for earned rewards (badge stamp, route-tile correct bloom).
  Using it anywhere else cheapens it.
- Stagger groups by 40–60ms (briefing lines, choice halos) so they feel authored, not dumped.
- **Reduced-motion contract:** every animation below names its reduced-motion fallback. Default:
  cross-fade or instant state, zero transforms, ambient loops paused. The game is fully playable and
  fully *legible* with motion off — never gate information behind animation.

---

## 3. Sound design (palette, even if stubbed in MVP)

Warm, soft, acoustic. **No sharp dings, no arcade buzzers.**
- **Ambient bed:** low Veluwe morning — distant birds, soft wind. Loops under everything at ~20%.
- **UI tones:** rounded marimba/woodblock. Hover = a breath of air; select = a single soft mallet.
- **Correct:** a short rising two-note marimba. **Try-again:** a *neutral* low woodblock — never a
  "wrong" sound; failure is quiet, success sings (per the success-oriented principle).
- **Reward:** a single warm major chord (the `celebration.js` chord), with a soft plant-bloom shimmer.
- Everything routes through the existing **geluid-toggle** (persistent). Read-aloud is independent.

---

## 4. Screen-by-screen craft

### [A] Gebied-overzicht — the map

**Composition.** A stylized, hand-drawn nature-map (not a literal NL outline — warmer, friendlier).
Carved **wooden ranger-posts** as pins. The Veluwe post is active: a small sun-glow halo
(`--spel-sun` glow) pulsing on `--dur-slow` ease-soft. Other regions (Wadden, Biesbosch) are
desaturated with a little wax-seal "Binnenkort".

**Idle life.** Cloud shadows drift across the map (slow, 60s loop). A bird crosses every ~12s. The
active post's halo breathes. Nothing demands attention except the one lit post.

**Interactions.**
- *Hover/focus a post:* post rises 4px with its shadow lengthening, a label card slides up from
  behind it (`--dur-quick` ease-out) — name, "1 missie", a tiny progress notch (0/1).
- *Click Veluwe:* **push-in** — the map scales ~1.4× toward the post, tilts ~3° for a 2.5D feel, a
  vignette closes, ambient ducks. Lands on a Veluwe scene card with the primary button
  **"Start missie: De verdwaalde frisling"**. ~900ms, then hand off.
- *Locked post:* a soft shake + the wax-seal lifts to show "Binnenkort", then settles. No dead-end
  frustration — it *answers* the tap.

**Reduced-motion:** posts get a static raised state on focus; click cross-fades straight to the
Veluwe card. Cloud/bird loops paused.

**Why it's here:** this is the scalability anchor. New gebied = new post; new missie = new inzoom
scene. Build the posts from a data array so adding regions is data, not layout work.

---

### [B] Vervoerkeuze — "Hoe ga je erheen?"

**Composition.** Three cards side-by-side (flex, gap), each a small **diorama**, not a flat icon —
the vehicle sits in a sliver of landscape with its own shadow. Big, ≥44px-plus tap zones.

**Idle micro-motion (per card, the detail that sells it):**
- Auto — a faint exhaust puff every ~3s; body settles on its suspension.
- Motor — front wheel shimmer; a tiny lean.
- Helikopter — rotor turning slow (motion-blurred disc), a soft ground-shadow wobble.

**Interactions.**
- *Hover/focus:* card lifts 6px, shadow softens and spreads, label brightens.
- *Select:* chosen card lifts and **the other two dim and recede** (scale 0.96, opacity 0.5,
  `--dur-base`); a small check **stamps** in with overshoot. Beat of ~400ms to enjoy the choice,
  then push to the cutscene.

**State:** `gekozenVervoer` persists — it picks the cutscene and a tiny arrival detail later.

**Reduced-motion:** dioramas static; selection shown by a solid `--spel-sun` border + check, no recede.

---

### [C] Reis-cutscene — the reward for choosing

**Composition.** Side-scroll **parallax**, 5 layers: sky gradient (morning peach→blue), far hills,
mid pine-line, near grass verge, foreground road. The chosen vehicle holds screen-center-left and
*bobs* on the terrain while the world scrolls past. Soft distance posts tick by (km-paaltjes).

**The helikopter variant** is its own thing: a descending arc, rotor-blur disc, and a **growing
ground-shadow** as it nears the heath — lands the player *into* the world. Car/motor simply arrive at
a ranger-post gate.

**Timing & control.** ~4s, **always skippable** — a quiet "Overslaan ›" bottom-right from the first
frame (never trap a kid in a cutscene). Ends by easing the scroll to rest, then a soft white-warm
flash into the briefing.

**Reduced-motion:** no scroll. A single static "arrival" frame — vehicle parked at the heath edge,
caption "Onderweg naar de Veluwe…" → tap to continue.

---

### [D] Ranger-briefing — the reading screen (most important for access)

This is where the accessibility work lives. Get this wrong and the mission excludes its only player.

**Composition.** A tinted-paper card (`--paper`, soft grain, gentle inner shadow) centered, with
generous margins. Left: a small **ranger portrait** plate (the first lush illustration; placeholder
in MVP). Right: the briefing text. Behind, faint and small, the **frisling in tall grass** — scared,
ears down — so the stakes are *shown*, not just told.

**Typography (hard rules).**
- One instruction **per line**. 3–7 words per sentence.
- Reading text uses a **dyslexia-friendly face** (open, single-story a/g, generous spacing),
  ~26–30px, line-height ~1.7, slightly loosened letter-spacing. Tunable via Tweaks.
- Warm ink on tinted paper — *moderate* contrast, never pure black on pure white (per the
  boeken-research note). Comfortable, not clinical.

**Example copy (from brief, refined):**
> Hoi ranger!
> Een klein zwijntje is zijn mama kwijt.
> Hij is nog maar net geboren.
> Hij is bang en alleen.
> Kun jij hem terugbrengen?
> Zoek hem eerst in het gras.

**Lines arrive staggered** (60ms each, ease-out, 8px rise) so the page composes itself calmly — and
this doubles as a natural reading pace. Reduced-motion: all lines present at once.

**Read-aloud (the craft centerpiece).** Tap **🔊 Lees voor** and it reads **line by line with a
karaoke highlight**: the current line gets a warm `--accent-warm` band and a soft underline that
*sweeps* left-to-right at speaking pace; finished lines stay slightly emphasized, upcoming lines
sit calm. The speaker button shows a gentle waveform pulse while active. This sweep is a genuine
dyslexia aid — it anchors the eye to the spoken word. (MVP: TTS may be a timed stub; the highlight
choreography is real and is what we're testing.)

**Buttons (flex, gap, big).** Primary **"Ik ga!"** in `--spel-sun`, satisfying press (2px down,
soft shadow collapse). Secondary **"🔊 Lees voor"** toggles read-aloud. Both ≥56px tall.

---

### [E] De wereld — top-down (the three brainpowers, hidden as ranger work)

**Shared frame.** A clean top-down tile-world (CSS-grid tile-map from a data array). Top: a calm
**missie-balk** — step dots (`●○○ → ●●○ → ●●●`) + the current micro-instruction in one short
sentence. The **ranger sprite** is the player's anchor on screen. Optional touch d-pad bottom-center.
The world *breathes* (wind wave, light). Everything below stays inside this frame so the three steps
feel like one continuous walk, not three mini-games.

> **The cardinal rule (Floris):** integrate the *thought* of the mini-game, never the puzzle-screen.
> No loading-screen, no "now: Corsi". The EF demand lives inside a ranger action.

---

#### Step 1 — Spot de frisling  · *volgehouden aandacht + visueel zoeken (Zoeken)*

**The field.** Tall grass across the grid, swaying on the wind wave. The frisling is **camouflaged**
— same palette as the grass, hidden by one *tell*: an **ear-twitch** every ~4s, and a grass-clump
that breathes on a slightly different rhythm than its neighbours. You find it by *attention*, not by
it being obvious.

**The search lens (attention aid, tunable).** A soft circle of clarity follows the cursor/finger —
inside it grass is crisper and the wind quiets; outside, a faint haze. It externalizes "where am I
looking" and gently rewards systematic scanning. Can be dialed from "off" to "obvious" in Tweaks so
Floris can match it to Alvah on the day.

**Distractors (the inhibition half).** A vlinder flutters, a struik rustles, a bird lifts — each
*baits* a tap. Tap a distractor: it does a tiny head-shake/settle, a neutral woodblock, soft
"Probeer maar". **No penalty, no scary sound** — the cost is only time. This is response-inhibition
taught kindly.

**Find.** Tap the frisling: its eyes catch the light, a soft ring pulses outward, the camera nudges
toward it, a rising two-note marimba. Then — **the first push-in**: top-down resolves into a small
warm close-up plate of the frisling looking up. Beat. Hand to Step 2.

**Adaptive (mocked in MVP):** more distractors / tighter camouflage / shorter ear-twitch window as
it goes well. Tunable in Tweaks.

**Reduced-motion:** grass static; the frisling's tell becomes a faint steady shimmer instead of a
twitch; search-lens is a soft static spotlight, no haze animation.

---

#### Step 2 — Onthoud het pad  · *visueel-ruimtelijk volgordegeheugen (Corsi)*

**Frame it as tracking.** "De rotte liep hier — wijs de frisling de weg terug." Not abstract tiles —
**hoof-print stepping stones** on the grass.

**Show phase.** The prints light up **in order**, one at a time: each blooms a warm glow + a soft
single drum-tap, ~500ms apart, a faint connecting trail drawn between them. Then they fade to faint
ghosts. (Reduced-motion: prints show a quiet **number 1-2-3** instead of relying on timing.)

**Recall phase.** Player taps the prints in the same order — **and the frisling actually walks each
correct one**, so you're *guiding an animal*, not pressing a memory pad. That single choice is what
keeps it ranger-work.
- *Correct print:* green bloom + ascending tone + the frisling trots to it (overshoot, the one place
  it's allowed besides rewards — guiding feels springy and good).
- *Wrong print:* a gentle shake, neutral tone, "Nog een keer", and the route **replays** from the
  start. Mistakes cost a repeat, never a fail. Success-oriented to the bone.

**Adaptive (mocked):** sequence grows 3 → 4 → 5; staircase reversals on error. The *replay-on-wrong*
is itself a scaffold — repetition of what's correct, exactly as the dossier prescribes.

---

#### Step 3 — Gevaar ontwijken op de terugweg  · *inhibitie / remmen (Dag & Nacht)*

**The walk home.** Top-down path back toward the rotte, frisling trotting behind the ranger.
Encounters appear along the way: **safe** (a calm hert, a konijn) vs **gevaar** (slang, modderpoel,
a stroper-val). Danger is always **telegraphed** — a subtle `--red-warn` outline + a wary posture —
so it's *learnable*, never a gotcha.

**The Stroop twist (the real inhibition).** A calm **regel-banner** can flip the rule:
default "nader rustige dieren, niet de onrustige", then sometimes the banner changes it. The natural
impulse is to always approach the nearest/cutest animal — the child must **remember the current rule
and remember to remember it.** That's the executive load, dressed as ranger judgment.

**Decision UX (calm, not twitchy).** As an encounter nears, the world **slows ~40%** and two soft
**choice-halos** fade in (nader / hou afstand, or links/rechts pad). No countdown clock, no flashing
— pressure comes from the slowed beat, not a timer, so a dyslexic 8-year-old isn't punished for
reading speed.
- *Correct:* ranger walks on calmly, frisling trots behind, soft affirm tone.
- *Impulsive wrong:* the world gently **rewinds** to just before the choice, a quiet "Wacht even",
  and re-presents it. **Never a game-over.** Tension is real but the floor is soft.

**Adaptive (mocked):** faster encounters / more frequent rule-flips as it goes well.

**Reduced-motion:** no slow-mo; choice-halos appear instantly and wait indefinitely; rewind is a
clean reset to the choice frame.

---

### [F] Hereniging — the payoff plate

The emotional reason the whole thing exists. Spend the budget here.

**The move.** From the top-down walk, the camera **push-ins** and resolves into a lush 2D
illustrated plate (side / three-quarter): the **frisling sprints** across the heath, the **rotte**
turns, the **mother sow steps forward**, noses touch. Then **Settle** — a 2% overshoot easing back,
a held breath. Let the beat *land*; don't rush off it (~1.5–2s of just the moment).

**Celebration (the `celebration.js` motif, with restraint).** At the frisling's feet a **plant
blooms** — stem rises, leaves unfurl, one flower opens (`--dur-cine`, ease-overshoot), a few petals
drift on the wind. A single warm **major chord**. Then the **ranger-badge** — "Frisling-redder" —
**stamps in** like a wax seal: scale from 1.15 → 1 with overshoot, a soft press-thud, a brief
glint sweep across it.

**Restraint clause.** No confetti storm. No screen-shake. No exclamation pile-up. **One earned,
warm moment.** The power is in holding the quiet, not filling it. This is the line that separates
this from slop.

**Reduced-motion:** the plate appears as a finished still; the plant is shown already bloomed; the
badge fades in at final size. The chord still plays (sound ≠ motion).

---

### [G] Missie-afsluiting

A quiet card. The earned badge, centered. **"Goed bezig, ranger."** / "Missie klaar." Buttons
(flex, gap): **"Terug naar de kaart"** and **"Jouw reis"** (hook to the mijlpalen overview). Back on
the map, the Veluwe post now carries a small carved **1/1 notch** — visible, lasting proof. No
score, no stars-out-of-three, no comparison. The reward is the story and the notch.

---

## 5. Feedback-state matrix (the tone, made concrete)

| Event | Visual | Sound | Copy | Never |
|---|---|---|---|---|
| Correct action | green bloom / glow, gentle | rising marimba | "Juist" / "Goed bezig" | confetti, caps |
| Try again | soft shake/settle on the thing | neutral woodblock | "Nog een keer" / "Probeer maar" | red X, buzzer, "fout!" |
| Found / unlocked | ring pulse + camera nudge | soft chime | "Gevonden" | siren, flash |
| Reward / badge | wax-stamp overshoot + bloom | one warm chord | "Frisling-redder" | fanfare overload |
| Wrong impulse (step 3) | gentle rewind to choice | quiet low note | "Wacht even" | game-over, life lost |

**Golden rule:** success *sings*, failure is *quiet*. Volume and motion both bias toward the things
that went right. Nothing in the game shouts at the child.

---

## 6. Accessibility, deep (non-negotiable)

- **Read-aloud everywhere** there's text — not just the briefing. Line-highlight choreography on
  every reading surface.
- **Redundant signals:** never color alone. Correct = color **+** shape **+** motion **+** sound.
  Danger (step 3) = outline **+** posture **+** position, not just red.
- **Slowed beats, never timers.** Reading speed is never the thing being tested. Pressure comes from
  ambience and slow-mo, removable in Tweaks.
- **Tap targets ≥ 44px**, generous spacing, forgiving hit-areas around small sprites.
- **Tunable difficulty & support** in Tweaks (search-lens strength, distractor count, sequence
  length, rule-flip frequency, slow-mo on/off) so Floris matches it to Alvah live.
- **Reduced-motion** is a first-class path, specified per screen above — fully playable, fully
  legible, never penalized.
- **Success-oriented framing** throughout: replay-what-went-right, never drill-the-error, never
  compare to peers.

---

## 7. Tweaks panel (for testing with Alvah)

Ship the prototype with a Tweaks panel so Floris can tune on the day:
- **Leestekst:** font (dyslexie-font on/off), size, line-height.
- **Geluid / Voorlezen:** on/off, read-aloud speed.
- **Beweging:** reduced-motion on/off, ambient intensity.
- **Moeilijkheid:** search-lens strength, distractor count (step 1), sequence length (step 2),
  rule-flip frequency + slow-mo (step 3).
- **Sfeer:** accent color (curated 3–4 from the `--spel-*` palette), time-of-day warmth.

These are a floor; if a moment wants a custom control, build it.

---

## 8. Build notes (so the MVP maps cleanly to the real Astro app)

- One clickable HTML prototype; screens as states, not separate files.
- World = **data-driven tile-map array** → later gebieden are new data, not new structure.
- Map ([A]) posts from a **data array** → new regions are data.
- Persist prototype state in localStorage (`ranger-mvp-state`) so refresh keeps the place during
  co-testing.
- Mirror `SpelShell` conventions (terug-knop → `/spelen`, titel `<h1>`, geluid-toggle, voorlees-knop)
  so the screens drop into `spelen/veluwe.astro` / `spelen/missie/frisling.astro` later.
- Every EF step is designed to log one session through the real `staircase / scoring / progressie /
  storage` pipeline; the MVP mocks the adaptivity visually but keeps the seams in the right places.

---

## 9. ⬇ Deep-research integration slots (fill BEFORE build)

> Floris is running deep research (biology/ecology) in parallel. These are the exact places the facts
> plug in. Each is a deliberate `TODO` so nothing gets hand-waved.

- **`TODO[bio:terms]`** — verify **frisling** (juvenile wild boar) & **rotte** (the herd/sounder).
  If the real terms differ, swap everywhere (copy, labels, badge). Brief calls these werkhypotheses.
- **`TODO[bio:boar-behavior]`** — how a sounder actually moves (single-file? matriarch-led?),
  how a piglet gets separated and reunites. Make Step 2's route and the reunion plate *true*.
- **`TODO[bio:veluwe-fauna]`** — real Veluwe animals for **Step 1 distractors** (which birds,
  insects, ground animals) and **Step 3 encounters** (genuinely safe vs genuinely to-avoid species).
- **`TODO[bio:real-danger]`** — what's actually a hazard to a piglet on the Veluwe (adder? bog?
  roads? poacher snares?) so Step 3 teaches something real, not invented peril.
- **`TODO[eco:habitat-light]`** — heath vs forest vs zandverstuiving, correct season & time-of-day
  so the golden-hour art direction is ecologically honest.
- **`TODO[bio:scale]`** — relative sizes (frisling vs ranger vs adult boar) so sprite proportions
  in the plates are right.

When research lands: replace each `TODO`, re-check the M3/E3 copy (new animal names must stay short
and concrete), then we build.

---

### The bar
If, watching an 8-year-old play this, Floris forgets it's three executive-function tests stitched
together and just sees his son being a ranger on a golden morning — calm, capable, proud of a notch
on a wooden post — then it lived up to the work we put our name on.
