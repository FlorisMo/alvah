# BUILD/QA REFERENCE — "Ranger van de Veluwe"
**Three.js / WebGL2 (WebGPU where available) · iPad / mid-range · motion-sensitive, dyslexic 8-year-old · calm/warm/never-scary**

Confidence flags: **zeker** = certain / well-established / peer-reviewed / official; **waarschijnlijk** = probable / likely / reasoned inference. Source URL + date next to each load-bearing claim.

---

## TL;DR
- **Humanoid faces:** drive a ~16-shape ARKit subset in symmetric L/R pairs, keep **brows + eyes** as the emotional core, cap weights ~0.5–0.7 and *always* animate the upper face to dodge uncanny valley. **Ready Player Me** and **Character Creator 4** ship true ARKit-52; **VRoid** and **MakeHuman** need conversion.
- **Animals:** convey calm via relaxed/loose ears, soft or half-closed eyes + slow blink, loose tails, and slow visible breathing; **never** bare teeth, raise hackles, pin-ears-and-crouch, S-coil, or stare unblinking. Render eyes "alive" with one small bright catchlight + slight wetness; only **fox, red/roe deer, badger, nightjar, frog** get dusk eyeshine.
- **Motion comfort:** fixed **50–60° FOV**, exponentially-damped follow camera (~0.3 s position / ~0.2 s rotation), **ban** head-bob, motion-blur, snap-rotate, FOV-kick, screen-shake; a real **reduced-motion mode** turns camera *moves* into cuts/fades, kills secondary motion, and pins the horizon — while keeping the essential expression/gaze motion a low-reading child relies on.

---

## A. HUMANOID EXPRESSION SPEC

### A.1 The chosen ARKit subset (~16 shapes, named)
ARKit defines exactly **52** blendshapes (coefficients 0.0–1.0), the de-facto realtime face standard, derived from FaceShift/FACS. Corroborated verbatim by Ready Player Me's Apple ARKit doc — avatars "come with a blend shape based facial rig supporting Apple's `ARFaceAnchor.BlendShapeLocation` API," enumerating all 52 names — and Apple's own per-shape pages (e.g. `tongueOut`: "The coefficient describing extension of the tongue") [**zeker** — docs.readyplayer.me/.../apple-arkit, accessed Jun 2026; developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation]. Eyes + brows carry most readable emotion, so weight the subset there and keep the mouth simple.

**Subset (symmetric pairs counted L+R):**
- **Brows:** `browInnerUp`, `browDownLeft/Right`, `browOuterUpLeft/Right`
- **Eyes:** `eyeBlinkLeft/Right`, `eyeWideLeft/Right`, `eyeSquintLeft/Right` (gaze via `eyeLookIn/Out/Up/Down` handled procedurally, see A.4)
- **Cheeks:** `cheekSquintLeft/Right` (the Duchenne "real smile" marker)
- **Mouth/jaw:** `mouthSmileLeft/Right`, `mouthFrownLeft/Right`, `jawOpen`, `mouthPucker`, `mouthShrugUpper`
- **Deliberately EXCLUDED:** `noseSneerLeft/Right` (reads disgust/anger), `mouthPress`, `jawForward` (no reliable warm use).

### A.2 Per-emotion recipes (weights 0–1; cap to avoid uncanny valley)
Uncanny-valley research grounding: stylized/cartoon characters are *least* affected; the **eyes** ("dead eyes") are the #1 eeriness driver; **childish features** (round head, snub nose, big eyes) increase affinity; **inconsistent realism** drives eeriness [**zeker** — Tinwell & Sloan, "Children's perception of uncanny human-like virtual characters," *Computers in Human Behavior* 36 (2014), sciencedirect.com/science/article/abs/pii/S0747563214002015; ACM Interactions "Avoiding the uncanny valley in virtual character design," 2018]. Keep weights moderate; never freeze the upper face.

| Emotion | Recipe (weights) |
|---|---|
| **Neutral** | all ~0; `mouthSmile` 0.05; periodic blink + microsaccades |
| **Happy / smile** | `mouthSmileL/R` 0.5–0.7 **+ `cheekSquintL/R` 0.3–0.4** (Duchenne) + `eyeSquintL/R` 0.15 + `browInnerUp` 0.1 (without cheekSquint a smile reads fake) |
| **Surprised (gentle, not fear)** | `browInnerUp` 0.5 + `browOuterUpL/R` 0.4 + `eyeWideL/R` **≤0.35** + `jawOpen` 0.2 (eyeWide >0.4 reads fear/uncanny) |
| **Curious** | `browOuterUpL/R` 0.25 + `browInnerUp` 0.2 + `eyeWideL/R` 0.15 + head tilt + single brow flash; `mouthSmile` 0.1 |
| **Sad-gentle** | `browInnerUp` 0.5 (inner-brow-up = sadness) + `mouthFrownL/R` 0.25 + `eyeSquint` 0.1 (keep subtle; no full frown) |
| **Proud** | `mouthSmileL/R` 0.4 + `cheekSquint` 0.25 + chin up (head pose) + `browOuterUp` 0.15 |
| **Focused** | `browDownL/R` **0.2 max** + `eyeSquint` 0.25 + `mouthPucker` 0.1 (keep browDown low so it never reads angry) |

**Transition timing:** ~0.3–0.4 s eased fade in/out between expressions (matches Warudo's 0.4 s default) [**waarschijnlijk** — docs.warudo.app/docs/assets/character].

### A.3 Avatar-system comparison (ARKit blendshape support)
| System | ARKit-52? | Fidelity / notes | License | Pick |
|---|---|---|---|---|
| **Ready Player Me** | **Yes, native** | Half- AND full-body glTF/GLB ship the full ARKit rig; request `?morphTargets=ARKit`; web/glTF-native. Per RPM docs: "Both half-body (VR) and full-body Ready Player Me avatars come with a blend shape based facial rig supporting Apple's `ARFaceAnchor.BlendShapeLocation` API" [**zeker** — docs.readyplayer.me, accessed Jun 2026] | Free | **Best web path** |
| **Character Creator 4** | **Yes (AccuLips & ExPlus)** | Profile adds "63 custom blend shapes: 52 ARKit shapes… and eleven tongue shapes" — highest authoring fidelity; FBX/glTF export [**zeker** — manual.reallusion.com, "Using Apple's ARKit in Character Creator"] | Commercial | **Top fidelity** |
| **VRoid Studio** | **No (needs conversion)** | Exports VRM with its own expression set (Joy/Angry/etc.), not native ARKit; "Perfect Sync" requires adding the 52 shapes via community tools (hinzka HANA, `@hinzka/52blendshapes-for-VRoid-face`); some shapes can't be cleanly derived [**zeker** — arkit-face-blendshapes.com; extra-ordinary.tv VRoid mapping, 2020] | Free | Anime style only |
| **MakeHuman / MPFB** | **No** | AGPL3 open-source; no ARKit shapes out of the box; manual shape-key authoring (e.g. ARKitBlendshapeHelper Blender addon) [**waarschijnlijk** — sourceforge MakeHuman; github.com/elijah-atkins/ARKitBlendshapeHelper] | Free/open | Most work |

**Recommendation:** **RPM** for the fastest guaranteed-ARKit web/glTF pipeline; **CC4** if you want maximum fidelity and to own the rig.

### A.4 Blink / saccade / look-at timing (child vs adult)
Established facts: resting human blink ~**15–20/min** (Tsubota et al. 1996, cited in *Frontiers in Psychology* 2022; adult range ~4–48 bpm, mean 14–17, Bentivoglio et al. 1997) [**zeker**]; saccade latency ~200 ms; saccade duration 20–200 ms (small shifts ~20–30 ms); microsaccades ~1/sec during fixation; blink duration ~100–150 ms [**zeker** — en.wikipedia.org/wiki/Saccade; scholarpedia.org "Human saccadic eye movements"; USPTO 10372205].

> **CORRECTION (now zeker):** children blink **less** than adults, not more. Spontaneous blink rate "increases rapidly during childhood before reaching a plateau in adulthood at 10–20 blinks/minute," and children's **median** rate during straight-ahead fixation is only ~**7 blinks/min** [**zeker** — PubMed 23968947, children's eye-movement study; Zametkin et al.: "blink rates increase steadily from infancy to adulthood"]. Model the 8-year-old's *resting/attentive* blink clearly **below** the adult.

| Parameter | Child (~8 yo) | Adult (ranger) | Notes |
|---|---|---|---|
| Blink rate (attentive/fixating) | **~6–10 /min** | ~15–20 /min | child notably lower; rate rises with age toward adult plateau |
| Blink rate (relaxed idle) | ~10–14 /min | ~15–20 /min | randomize interval; Poisson-like |
| Blink duration | 100–150 ms | 100–150 ms | ease-in/out, not linear |
| Inter-saccade interval | 0.2–0.6 s (more darting) | 0.4–1.2 s | child livelier/curious |
| Saccade duration | 20–80 ms | 20–80 ms | near-instant eye snap OK |
| Microsaccade | ~1/s, <0.5° | ~1/s | prevents "dead doll" stare |
| Look-at smoothing | 0.10–0.18 s | 0.18–0.30 s | **eyes lead, head follows ~80–150 ms later** |
| Gaze hold on object | 0.6–1.5 s | 1.0–2.5 s | child shorter holds |
| Eye yaw/pitch before head turns | ±~10° | ±~10° | people turn head past ~15–20° [**zeker** — Oculus Best Practices Guide] |

**Randomization:** jitter each interval ±20–30% so nothing feels metronomic; suppress blink artifacts mid-saccade; give the child higher blink-interval variance and shorter gaze holds for a "curious" read.

---

## B. ANIMAL-EMOTE CHEAT-SHEET

**Universal "never scary" rule:** no bared teeth, no pinned-ears-and-crouch, no raised hackles, no direct unblinking predatory stare, no S-coil. Soft eyes + slow blink + loose body = calm/trust across species [**zeker/waarschijnlijk** — multiple vet/ethology body-language sources, e.g. petdesk.com, embracepetinsurance.com].

### B.1 Ungulates — red deer / roe deer / wild boar + piglet
- **Calm/content:** head low grazing, slow steps, ears relaxed/loose, **tail gently twitching/swishing side-to-side** ("all-clear" signal), chewing [**zeker** — mossyoak.com "How to Read Whitetail Body Language"; mdc.mo.gov "Deer Dialogue," 2014: relaxed tail twitch + chewing = at ease].
- **Curious / mild alert (non-scary):** head up, **ears rotated forward** toward subject, body still but loose, nose lifted to sniff [**zeker** — ilearntohunt.com; mossyoak.com].
- **AVOID (alarm):** raised white **tail "flag,"** stiff-legged stamp, frozen-tense body, snort [**zeker** — realtree.com "Talk to the Tail"; animalsaroundtheglobe.com]. Wild boar: no raised hackles / lowered-head charge; keep **piglet bouncy and close to the sow**.
- **Breathing:** slow visible flank rise; piglet faster, bouncier idle.

### B.2 Canid — fox
- **Calm:** ears **out-to-side or slightly back**, soft half-closed eyes ("smile"), tail **low and loose**, sitting/lying relaxed [**waarschijnlijk** — Wildlife Online "Red Fox Behaviour"; djrphoto.co.uk, ~2020].
- **Curious:** ears swivel, **head tilt**, may rise slightly to investigate; slow blink [**waarschijnlijk** — robinbarefield.com].
- **Play (friendly):** "play face" — mouth barely open, brief head-shake, tail in an upside-down-U [**waarschijnlijk** — Wildlife Online citing Bekoff/Henry].
- **AVOID:** tail straight up + puffed/bristled (threat); tail tucked + flattened ears + crouch (fear).

### B.3 Rodent — red squirrel
- **Calm/feeding:** **upright squat on haunches**, food held in front paws, ears up with tufts, tail **loosely curled and STILL** [**zeker** — treesforlife.org.uk; Wikipedia "Red squirrel"].
- **Curious / mild alert:** sits upright, ears erect, **sniffs air**; gentle tail sway [**zeker** — Wikipedia "Red squirrel"].
- **AVOID:** **rapid repetitive tail-flicking + chittering** = alarm/predator warning [**waarschijnlijk** — nature-mentor.com; flick-as-alarm mechanism well-established].

### B.4 Mustelid — badger
- **Calm:** head low, **nose to ground, slow ambling, snuffling**; pauses to sniff the air [**zeker** — Wildlife Online "European Badger Senses," ~2021].
- **Eyes:** small, **poor eyesight** (notices mainly movement) — convey calm via low head + busy nose, NOT eye contact [**zeker** — en.wikipedia.org/wiki/European_badger]. Optional soft purr/whicker audio for contentment [**waarschijnlijk** — Binfield Badger Group].
- **AVOID:** bared teeth, raised hackles, freeze-and-listen tension.

### B.5 Birds — raven / nightjar
- **Raven calm:** **sleek-to-softly-fluffed** body, **throat hackles FLAT**, head level or gently cocked (curiosity), light two-footed hops; allopreening = bonded/content [**zeker** — Cornell "All About Birds: Common Raven"; nps.gov "Common Raven"; Birds of the World, Boarman & Heinrich 2020].
- **Raven AVOID:** **erect throat hackles + bill pointed up + tall stiff stance** (dominance/threat); low crouch + drooped wings + flashing nictitating membrane (fear) [**zeker** — Birds of the World, citing Gwinner 1964].
- **Nightjar calm:** roosts **lengthwise/flattened along a branch** (or on the ground), **eyes narrowed to slits**, utterly still, cryptic — its calm *is* stillness + camouflage [**zeker** — en.wikipedia.org/wiki/European_nightjar].
- **Nightjar AVOID:** wide open-mouthed **gaping hiss** (defensive) [**zeker** — Wikipedia].

### B.6 Reptiles — adder / sand lizard
- **Adder calm:** **loosely coiled or stretched out basking** on warm rock/heather, head resting **low and level**, slow gentle **tongue-flick = curiosity/"smelling," NOT threat** [**zeker** — ARG-UK "Adders are Amazing"; Discover Wildlife adder guide; Animal Diversity Web *Vipera berus*].
- **Adder pupil softening:** vertical slit + coppery/red iris is natural, not a threat per se [**zeker** — ARG-UK], but to keep non-threatening: **enlarge/dilate the pupil** (dim light rounds the slit), use a **warm, not bright-yellow** iris, add a **big soft catchlight**, keep head low/level, slow tongue-flick; avoid yellow sclera + raised head [**waarschijnlijk** — synthesis with "Hellish Pupils" convention, tvtropes.org: slit + yellow = sinister cue to avoid].
- **Adder AVOID:** raised **S-coil**, flattened/puffed body, hiss/gape [**waarschijnlijk** — A-Z Animals citing viper ethology, Prestt 1971].
- **Sand lizard calm:** body **flat/relaxed on warm sand** in sun, limbs splayed, head low or gently lifted; **round pupils** (diurnal) read friendly [**zeker/waarschijnlijk** — A-Z Animals "Sand Lizard"; iNaturalist].
- **Sand lizard AVOID:** **puffed throat + laterally flattened body + vivid green flanks turned side-on** (territorial display) [**waarschijnlijk** — A-Z Animals citing Olsson 1994].

### B.7 Amphibian — common frog (*Rana temporaria*)
- **Calm:** compact sit, **limbs tucked**, big round eyes, gentle rhythmic **throat pulse (buccal-pump breathing — the key "alive" cue)** + occasional slow nictitating-membrane blink [**zeker/waarschijnlijk** — Woodland Trust "Common Frog" (skin + lung breathing); HowStuffWorks "Frog Anatomy" (nictitating membrane)].
- **AVOID:** hugely **ballooned vocal sac** (= male calling, not resting); frozen mid-leap flee pose.

### B.8 Eye-rendering recipe ("alive, not dead-doll")
Core: a small, bright, correctly-placed **catchlight** is what makes eyes live; uneven/mirrored catchlights look wrong; "dead eyes" drive uncanniness [**zeker** — deviantart.com "Fixing Specular Lights for Eyes"; ACM uncanny-valley 2018].

- **Catchlight:** one dominant specular highlight, small (~8–15% of iris diameter), placed in the **upper quadrant (~10–11 o'clock)** consistently on BOTH eyes (don't mirror the spec map asymmetrically); add a faint secondary fill. Drive it from the key light or a fake highlight quad/billboard so it stays even when scene lights move.
- **Wetness/specular:** clearcoat/specular layer over the cornea — **high specular, low roughness (~0.05–0.15)** for a sharp highlight; eye-white kept slightly off-white and a touch glossy (porcelain, not plastic). In glTF: a high-specular low-roughness cornea layer over a diffuse iris; the established **one-mesh iris parallax/refraction** technique gives depth without a separate lens mesh.
- **Pupil shape per species:** human child/ranger = **round**; fox = vertical but **softened via dilation**; deer/roe/boar = **horizontal**; squirrel/raven/frog = **round**; adder = vertical slit (soften per B.6); sand lizard = round. Round + large = friendly; vertical-slit + yellow = the "ambush/evil" reading to avoid [**zeker** — tvtropes.org "Hellish Pupils": slit/yellow = sinister convention].
- **Eyeshine / tapetum lucidum (dusk only):**
  - **ON (subtle additive glow at pupil when a light points at the eye):** fox **green/yellow-green**; red & roe deer **white/silvery (green/yellow tinge)**; badger **greenish**; **nightjar red — the bird exception** (most birds lack a true tapetum, but nightjars/owls/kiwis have one); frog **faint green**.
  - **OFF (plain dark eyes):** **red squirrel** (diurnal, no tapetum — certain), **adder & sand lizard** (recommend none).
  - [**zeker/waarschijnlijk** — en.wikipedia.org/wiki/Tapetum_lucidum; nps.gov fox eyeshine; Nature Conservancy; BirdGuides "European Nightjar"; TPWD bullfrog eyeshine]. Keep the glow gentle so it never reads "monster."
- **Open shader references:** Blender realistic-eye setups (Gnomon/Alex Alvarez cornea-over-iris with procedural gradient mask), Wikibooks "Realistic Eyes in Blender," and a Three.js **PBR clearcoat** material for the cornea layer [**waarschijnlijk** — blenderartists.org eye threads; en.wikibooks.org].

---

## C. MOTION-COMFORT SPEC (motion-sensitive 8-yo, tablet, 3rd person)

Theory base: cybersickness is explained by **sensory-conflict / neural-mismatch** (visual self-motion vs vestibular stillness) and **vection**; vection strength correlates with sickness; **larger FOV and peripheral optic flow increase sickness**; **vergence-accommodation conflict** is a contributor (minor on a flat tablet) [**zeker** — Springer "Cybersickness in current-generation VR HMDs" 10.1007/s10055-021-00513-6, 2021; en.wikipedia.org/wiki/Virtual_reality_sickness; en.wikipedia.org/wiki/Vergence-accommodation_conflict].

### C.1 Concrete spec
- **FOV:** **fixed 50–60°** for 3rd person on a tablet (narrower = less peripheral optic flow/vection). **No dynamic FOV.** Larger FOV reliably increases sickness [**zeker** — ResearchGate "Cybersickness and desktop simulations: FOV effects"; ACM "Adaptive Field-of-view Restriction"].
- **Follow-camera damping:** frame-rate-independent **exponential damping** `t = 1 − exp(−λ·dt)` (NOT raw per-frame lerp). Position smooth-time **~0.3 s**, rotation **~0.2 s**; SmoothDamp or critically-damped spring; update in a LateUpdate-equivalent after the target moves [**zeker** — generalistprogrammer.com camera guide; moonjump.com "Third-Person Camera Systems"; blog.littlepolygon.com].
- **Look-ahead:** small (≤1–2 m), heavily smoothed so it doesn't swing on direction changes.
- **Turn easing:** ease in/out; cap angular velocity; **no instant world snap.** Forward motion is most comfortable; minimize strafing/backing and looking away from travel [**zeker** — Oculus Best Practices Guide].
- **Speed:** match natural pace; avoid high optic-flow speeds. Meta reference: "The average human being walks at a rate of about three miles per hour (1.4 meters per second) and runs at about twice that speed" [**zeker** — developers.meta.com "Reduce Optic Flow" / locomotion comfort].
- **Horizon stability:** camera **roll = 0 always**; stable horizon line; use **quaternions not Euler**; camera stable looking straight up/down [**zeker** — Oculus BPG].
- **Soft camera collisions:** sphere-cast, **decelerate before stopping** (no abrupt jams) [**zeker** — developers.meta.com locomotion comfort].

### C.2 BAN list (always)
Head-bob, motion blur, snap/instant rotation, large FOV shifts / "FOV kick," screen shake, fast whip-pans, hard cuts/teleports without a soft transition, big scale/parallax effects, and any auto-rotating camera the player didn't initiate. Head-bob is explicitly "a series of small but uncomfortable vertical accelerations"; "shaking, jerking, or bobbing the camera will be uncomfortable" [**zeker** — Oculus Best Practices Guide].

### C.3 "3D REDUCED-MOTION MODE" spec (OS `prefers-reduced-motion: reduce`)
Detect via `window.matchMedia('(prefers-reduced-motion: reduce)')` and listen for changes. The request means **minimize/replace non-essential motion, not delete all motion** ("reduce ≠ none") [**zeker** — developer.mozilla.org `prefers-reduced-motion`, updated 2025–2026]. When set:
- **Camera:** stop look-ahead; increase damping (slower, gentler); cut idle camera sway/breath; **disable dynamic FOV** entirely.
- **Replace camera *moves*** (pans/dollies between beats) with **quick cross-fades / cuts ("blink")** instead of swoops.
- **Secondary motion off:** particle storms, parallax backgrounds, large water/foliage sway reduced, screen-space wobble off.
- **Vehicle/flight:** cap speeds, widen turn easing, force horizon lock, add a static cockpit/HUD frame.
- **Keep ESSENTIAL motion:** character expressions, gaze, walk cycles — these aid comprehension for a low-reading child [**zeker** — MDN: reduce ≠ none].
- **In-game toggle** mirroring the OS flag, changeable **without restart** [**waarschijnlijk** — Oculus BPG: allow in-game setting changes].

### C.4 Two risky cases
**(1) Ground vehicle, slightly top-down follow cam:**
Higher camera angle reduces horizon optic flow — good. Keep **pitch fixed**, damp position only (0.3–0.4 s), **no FOV kick** on acceleration. Keep part of the **vehicle body visible** as a static "cockpit effect" frame of reference (a proven nausea reducer) [**zeker** — creator.oculus.com "cockpit effect"]. Ease all turns; **no camera roll** in corners. Reduced-motion: slower top speed, wider turn radius, more top-down (less horizon in frame).

**(2) Helicopter, free vertical motion — highest risk:**
Vertical oscillation + free motion is the worst vection case. Mitigations: visible **cockpit/canopy frame** (static reference) [**zeker** — cockpit effect]; **clamp pitch/roll** to gentle ranges; **heavily damp vertical motion**; no rapid altitude changes; keep an **always-level artificial-horizon** element on screen; optional gentle **vignette / dynamic FOV-restriction ("tunneling")** during fast motion — dynamic FOV restriction significantly reduces cybersickness [**zeker** — Springer "Effects of dynamic field-of-view restriction…" 10.1007/s10055-020-00466-2, 2020]. Reduced-motion: lock roll to 0, auto-stabilize hover, slow climb/descent, ban free-look while moving.

### C.5 Testable QA checklist
- [ ] FOV fixed 50–60°; never changes during play.
- [ ] Camera follow uses exp-damping, frame-rate independent (test 30/60/120 fps → identical feel).
- [ ] Camera roll == 0 at all times; horizon never tilts.
- [ ] No head-bob, motion blur, screen shake, or snap-rotate anywhere.
- [ ] All accelerations player-initiated, brief, eased.
- [ ] Soft camera collision (decelerate, no hard jams).
- [ ] Vehicle: body visible as static frame; no FOV kick; no roll in corners.
- [ ] Helicopter: clamped pitch/roll, level-horizon overlay, heavy vertical damping, optional motion vignette.
- [ ] `prefers-reduced-motion: reduce` → camera moves become cuts/fades, secondary motion off, essential (expression/gaze/walk) motion kept.
- [ ] In-game reduced-motion toggle works without restart and mirrors the OS flag.
- [ ] 10-minute play session with the target child → no discomfort reported (re-test per build).

---

## D. READING-LIGHT STORYTELLING PATTERNS
(Voice + picture + animation + icon; one short sentence per beat; AVI M3/E3 early-reader.)

Base: dyslexia-friendly = **reduce on-screen text/clutter**, simple concise language, **audio narration/voice**, **symbols + color coding**, clear visual cues, customizable font (OpenDyslexic / Atkinson Hyperlegible), **avoid red/green-only** coding, **no time pressure** [**zeker/waarschijnlijk** — mdpi.com "Accessible Serious Games for Dyslexia" (2021); gameaccessibilityguidelines.com dyslexia typography; British Dyslexia Association via dyslexia-first.co.uk].

**Named patterns:**
1. **One short sentence per beat + voiceover** — every line read aloud; on-screen text optional, large, dyslexia font. Plot advances by voice + action, not reading [**zeker** — dyslexia accessibility sources above].
2. **Gaze-leading** — characters look at the next point of interest *before* the player needs it; player attention follows their gaze. Gaze-based guidance measurably improves performance and experience vs crosshair/no-guidance [**zeker** — MDPI "gEYEded: Gaze-Based Player Guidance," 2019]. The ranger's eyes/head pre-orient to the goal.
3. **Anticipation + staging (Disney 12 principles)** — a small wind-up telegraphs intent; staging composes frame + lighting + minimized background motion so "any idea is completely and unmistakably clear" [**zeker** — en.wikipedia.org/wiki/Twelve_basic_principles_of_animation; Johnston & Thomas definition].
4. **Pose/silhouette acting** — strong readable silhouettes carry emotion (proud chest-up, curious lean-in, gentle-sad slump); the "appeal" principle.
5. **Environmental storytelling** — arrange world objects into cause-and-effect vignettes the child infers without text [**zeker** — gamedeveloper.com "Environmental Storytelling"; Don Carson theme-park article; Jenkins; Smith & Worch GDC].
6. **Diegetic icons** — in-world symbols (paw print = track, footprint trail, sparkle on interactables) instead of word labels; one consistent icon language [**waarschijnlijk** — dyslexia UI rules: use graphical objects/icons, researchgate "Serious Game UI Design Rules for dyslexic children"].
7. **Audio cues** — a distinct non-verbal sound per event (discovery chime, soft "found it," gentle worried tone that resolves) carries mood for non-readers [**zeker** — accessibility audio/visual cue pairing].
8. **Color & light for mood** — warm soft light = safe/calm; cooler/dimmer = mild mystery that resolves to warm; directional light guides the eye to the key object (cf. *Journey*'s color language) [**zeker** — gamedeveloper.com environmental-storytelling lighting; pixune.com visual storytelling]. Don't use red/green as the sole signal.
9. **Camera as narrator** — slow gentle push-in for emotional beats (within motion-comfort limits), pull-back for reveal — but obey reduced-motion (use cuts/fades when set).
10. **Resolve-hopeful beat** — every tense moment ends with a visible hopeful resolution in-session (character relaxes — ears up, soft eyes, smile), reinforcing the emotional-safety rule.

---

## CAVEATS
- **Apple's blendshape page is JS-gated;** the 52-name list and semantics are corroborated verbatim via Ready Player Me, DeepWiki, and Reallusion (all reproduce Apple's names) plus Apple's individual shape pages.
- **Child blink rate:** corrected to **below** adult (~6–10/min attentive vs 15–20 adult) per PubMed 23968947 / Zametkin — do not use the higher number.
- Several **animal calm-state specifics** (squirrel calm-tail, frog throat-pulse-as-calm, sand-lizard calm head pose) are reasoned inferences from solid behavioral facts, flagged **waarschijnlijk** — validate with a behaviorist if a beat depends on them.
- Most **cybersickness numbers come from VR/HMD studies;** effects are milder on a flat tablet, so treat FOV/vignette/damping values as conservative *starting points to playtest*, not hard physiological limits.
- **Eyeshine colors are angle/age-dependent (iridescence)** — treat as art direction, not exact spectra. Note the resolved conflict: "birds lack a tapetum" is generally true *except* nightjars (and owls/kiwis), which do show eyeshine.
- Animal body-language sourcing mixes some secondary/aggregator wildlife sites with strong primary bodies; **UK conservation organizations (Woodland Trust, ARG-UK, Trees for Life, PTES) and Cornell Birds of the World are the most authoritative** and should be preferred when refining.

---

## RECOMMENDATIONS (staged, with change-thresholds)
1. **Build the face rig on RPM first** (guaranteed ARKit-52, web-native). Implement the A.2 recipe table and A.4 timing as data-driven JSON so artists can tune without code. *Switch to CC4 only if* playtesters find RPM faces insufficiently warm/expressive.
2. **Prototype the eye material (B.8) before any animal modeling** — the catchlight + wetness + one-mesh parallax is the single highest-leverage "alive vs dead-doll" investment, and the same shader serves humans and animals with per-species pupil/eyeshine params.
3. **Lock the camera spec (C.1) and the BAN list (C.2) as engine-level constants** the whole team builds against; wire `prefers-reduced-motion` from day one (cheap early, expensive to retrofit). *Trigger for stricter limits:* if the target child reports any discomfort in the 10-min test, drop FOV toward 50°, raise damping, and enable the helicopter vignette by default.
4. **Treat helicopter free-flight as opt-in / late content** behind the strongest comfort settings; if QA can't get a clean 10-minute session, **make hover-stabilized flight the only mode** and cut free vertical control.
5. **Author every story beat as voice + gaze-lead + icon first, text last** (Section D). *Benchmark:* a non-reading adult should follow the whole plot with text hidden; if they can't, the beat is over-reliant on words and must be re-staged.
6. **Keep a living "never-scary" QA gate:** every animal pose and beat checked against the B-section AVOID lists and the emotional-safety rule (no hurt/distress, weapons-in-use, jump-scares; tense beats resolve hopefully in-session) before merge.