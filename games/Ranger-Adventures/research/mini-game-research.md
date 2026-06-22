# Boswachter op de Veluwe — Build-Ready Design Research (V2, real-time 3D world)

## TL;DR
- **The honest premise must shift from "training brain-powers" to "being a capable ranger."** Peer-reviewed evidence (Melby-Lervåg, Redick & Hulme 2016; Simons et al. 2016; Sala & Gobet 2019; Kassai et al. 2019) shows computerised cognitive/EF training reliably improves the trained task and very similar tasks (near transfer) but shows **no convincing far transfer** to real-life skills like reading, attention, or intelligence. The game's defensible promise is *engagement, joy, autonomy, competence and a calm proud child* — not measurable EF gains. Build a great cosy game first; the EF exercise is an invisible bonus, never a marketing claim.
- **Almost every other V2 instinct is well-supported and 3D-friendly:** a small, legible low-poly world with strong landmarks + a single objective marker; a cosy cabin hub (diegetic computer/ladder/door); in-world tasks (kneel to read tracks, place a camera) instead of pop-up "puzzle screens"; gentle third-person camera; and a kind, non-punishing failure model. The one element I would change is the **3-strike vehicle-destruction → restart-at-cabin loop** — research on failure framing and on sensitive learners favours gentler "soft bonk / slow-down / get out and walk" patterns.
- **Text is the biggest accessibility risk, and it's solvable.** Use a clean sans-serif (Arial/Verdana/Open Sans — OpenDyslexic shows *no* proven benefit and is often *less* preferred), cream/pastel backgrounds (not white), short left-aligned lines, big type, and always pair text with **voice + icon + animation** so an AVI M3/E3 reader is never blocked by words. Antagonist = poachers (stropers)/illegal loggers framed as *outsmart, catch-on-camera, report, restore* — never harm, fear or sadness.

---

## THEME A — "Invisible" executive-function training through play

### A1. What the evidence actually says (the sober version)
- **Near transfer is real; far transfer is not (or is negligible).** Melby-Lervåg, Redick & Hulme (2016, *Perspectives on Psychological Science*, 11(4):512–534) meta-analysed 87 publications / 145 comparisons and found reliable gains on *intermediate* transfer (verbal & visuospatial working memory) but **"no convincing evidence of any reliable improvements"** on far transfer (nonverbal/verbal ability, word decoding, reading comprehension, arithmetic) when compared with a *treated* control. **[zeker]**
- **Simons et al. (2016, "Do 'Brain-Training' Programs Work?", *Psychological Science in the Public Interest* 17(3):103–186):** "extensive evidence that brain-training interventions improve performance on the trained tasks, less evidence that such interventions improve performance on closely related tasks, and little evidence that training … improves everyday cognitive performance." None of the cited studies met all best-practice methodological standards. **[zeker]**
- **Sala & Gobet (2019, *Collabra: Psychology* 5(1):18; Gobet & Sala 2023, "Cognitive Training: A Field in Search of a Phenomenon"):** across working-memory training, video-game playing, exergames and music training, the true far-transfer effect size estimated against an *active* control "is close to zero." **[zeker]**
- **Kassai et al. (2019, *Psychological Bulletin* 145(2):165–188):** training children's individual EF components does not reliably transfer to other EFs or to academics. **[zeker]**
- **What *does* improve EFs (Diamond & Ling 2016, *Dev. Cogn. Neurosci.*; Diamond & Lee 2011, *Science*; Diamond 2020, *Handbook of Clinical Neurology* vol. 173):** approaches that (a) **repeatedly practise** EF and (b) **progressively increase challenge**, embedded in activities that *also* support emotional/social/physical development and that bring **joy, reduce stress, and inspire confidence and pride**. Children with the *worst* EFs benefit most. Pure aerobic/resistance exercise was "among the least effective" — the *cognitive engagement* matters, not mere activity. **[waarschijnlijk]** — Diamond & Ling's positive claims are more contested than the null far-transfer findings; treat "this game will improve his EF" as **unproven**.
- **Bottom line for this project:** Do **not** promise EF improvement. The literature supports promising *fun, engagement, autonomy, competence, and a calm proud child.* The only defensible developmental angle is that the game provides **repeated, joyful, progressively-harder practice in a low-stress, success-oriented context** — exactly the conditions Diamond names — while being honest that real-world transfer is unproven.

### A2. Design patterns to embed each engine in narrative/action
Precedent: **Braingame Brian** (Prins et al. 2013, *Games for Health Journal*) and the **CoCon** game (Song, Yi & Park — 10 mini-games embedding visual search, Stroop, flanker, categorization in a narrative) wrap classic paradigms inside an adventure with story, adaptive difficulty and immediate rewards; reviewers credit "fantasy, a story line, adaptation of the degree of difficulty, and immediate rewards" as the engaging ingredients (JMIR Serious Games). The key validated move: **keep the underlying task, restyle the surface as story.** Per engine:
- **Simon (working memory, audio-visual order):** an edelhert/fawn calls a sequence you echo; repeat the order in which nest boxes lit with returning birds; re-key radio tones to call the BOA. *No "repeat the sequence" screen — you "answer the animal."*
- **Corsi (visuospatial sequence memory):** memorise the route a wild zwijn took across clearings and walk the camera to each spot in order; recall which stumps a squirrel buried nuts at, in order.
- **Zoeken (visual search → sustained attention + response inhibition):** scan heath for the one ree among look-alikes; spot the snare among litter and tap only snares, not mushrooms (inhibition built in).
- **Dag & Nacht (Stroop-like inhibition):** "day animals to the meadow, night animals to the den," sorting against the obvious; "tag the picture, not the loud sound."
- **Wisselen (task-switching → cognitive flexibility):** alternate "count deer" and "photograph tracks" as a signpost flips the rule; switch tools (camera ↔ measuring tape) as the job changes.

### A3. Adaptive difficulty for a 7–9-year-old
- Use **performance-based dynamic difficulty adjustment (DDA)** aimed at Csíkszentmihályi's *flow channel* (challenge ≈ skill), the established frame in the DDA literature (Chen 2007; multiple systematic reviews). For memory tasks, a **staircase/reversal** method (lengthen the sequence after a success, shorten after a miss) keeps the child near ~70–80% success. **[zeker as method; EF effect unproven]**
- **Make adjustment invisible and never a demotion.** Crash Bandicoot/Jak-style hidden DDA (slow obstacles, add help after repeated misses) is the model — lead designer Jason Rubin: "help weaker players without changing the game for the better players." For a sensitive child, **only ever scale *up* visibly** ("ready for a tougher track?") and scale *down* silently. **[waarschijnlijk]**
- Guo et al. (2024) caution that chasing flow purely by *performance* can misread a learner; track **both** performance and frustration signals, and offer an explicit, dignity-preserving **child-controlled "hint / make it easier" button** (supports autonomy, A6).

### A4. Dosage & cognitive load
- Working memory at this age is small (Gathercole et al.: ~2–4 items for young school children) and **reading taxes working memory far more than listening** for Year-3-level readers (Gathercole et al. 2006; Sweller's cognitive-load theory). Keep each mission's *held-in-mind* load tiny. **[zeker]**
- Practical targets (synthesised from cognitive-load + child-attention literature, **[waarschijnlijk]**): one mini-game beat **~30–90 seconds**; a full mission **~3–6 minutes**; **3–5 steps per mission** max, each step re-stated by voice + icon so nothing must be *held* in memory unless the mini-game is *about* holding it. Use the cabin as a natural stop point rather than long unbroken play.
- Apply **Mayer's multimedia principles / redundancy effect:** don't make the child read *and* hear long identical text at once; pair short spoken instruction with one clear picture/animation, and trim on-screen words.

### A5. Reskinning ONE mechanic many ways (Corsi/route-memory across ≥5 missions)
Heuristic: **hold the verb constant, swap the fiction (animal + place + season + stakes).** One "remember-the-route/order" engine becomes:
1. Spring — follow the das's path back to its sett.
2. Summer — replay the order ponds dried to check ven restoration in sequence.
3. Autumn — find the squirrel's nut-caches in burial order.
4. Winter — retrace deer tracks in snow to the herd's shelter.
5. Story — re-walk the exact route a poacher's tyre tracks took to find the snare.
Vary **one axis at a time** (length, distractors, day/night, time-pressure off/on) so it reads as a new job, not a re-test — exactly how Braingame Brian/CoCon reuse a paradigm across themed levels.

### A6. Motivation without competition
- **Anchor in Self-Determination Theory** (Ryan, Rigby & Przybylski 2006, "The Motivational Pull of Video Games," *Motivation and Emotion* 30(4):347–363): enjoyment and continued play are driven by **autonomy, competence, and relatedness**, which "independently predict enjoyment and future game play" — *not* by beating others. The paper also found "competence and autonomy perceptions are also related to the intuitive nature of game controls, and the sense of presence or immersion" — so simple, intuitive controls *themselves* feed motivation. Build all three: autonomy (choose mission/vehicle/route), competence (visible achievable mastery), relatedness (a warm mentor ranger, grateful animals/villagers). **[zeker]**
- **Use process praise, not person praise** (Dweck; Gunderson et al.; Henderlong & Lepper 2002): praise *effort/strategy* ("you watched really carefully") over fixed traits ("you're so smart"). Process praise predicts persistence and challenge-seeking; person praise backfires when things get hard. **[zeker]**
- **Beware the overjustification effect** (Deci 1971; Lepper, Greene & Nisbett 1973; Deci, Koestner & Ryan 1999): heavy *expected, controlling* rewards for an already-fun activity *reduce* intrinsic motivation. Rewards experienced as **informational** (acknowledging competence) are safe; rewards that feel *controlling* are not. **[zeker]**
- **So, for collectibles/progression:** prefer **unexpected, informational collectibles** tied to *what the child did* (a photo for the ranger's album, a new jacket patch, the heath visibly recovering) over points/stars that rank performance. **Never** compare to peers, never show a failing score, never a leaderboard.

**FOR THE GAME, DO:**
- Drop any "brain-training" claim; frame it as *being a real ranger*; treat EF practice as an invisible bonus.
- Wrap each of the five engines in a ranger job — no recognisable "clinical screen."
- Keep missions to 3–5 voice+icon steps, beats of 30–90s, missions of 3–6 min, cabin as the breather.
- Use hidden staircase DDA that only scales *up* visibly; add a child-controlled "hint/easier" button.
- Reward with informational collectibles (album photos, patches, restored habitat) and **process praise**; no scores, rankings, default timers, or peer comparison.

---

## THEME B — Semi-open-world & vehicle navigation for young children

### B1. Reference games & world legibility
- **Zelda: Breath of the Wild** is the gold standard for legible openness: it guides with **landmarks and towers ("weenies")** and place-names rather than a constant nose-following arrow, so the player *reads the world* (Level Design Book "Wayfinding"; NeoGAF discussions). For an 8-year-old, lean toward BOTW's **early-game** hand-holding (a clear marker to the first objective) rather than its later marker-free freedom.
- Core legibility tools (The Level Design Book; Myk Eff "Mapping & Wayfinding"): **landmarks** (a tall fire-watch tower, the cabin, a distinctive pond), **"weenies"** (bright/tall draw-objects), **well-structured paths**, **lighting/colour contrast** (a bright element in a calm palette), and a **clear critical path.** **[zeker]**
- **Density:** keep it sparse and cosy. The community/critic consensus is that marker-soup (Witcher 3/GTA-style) makes players "look more at the minimap than the actual game." A small world with a *few* clearly-themed activities beats a big empty one. **[waarschijnlijk]**

### B2. Wayfinding for kids
- Provide a **single, clear objective marker + small corner map with one destination pin** — V2's plan is correct. UX consensus: an explicit arrow/pin "makes it less overwhelming than … a giant sandbox," ideal for a young or time-limited player. **[waarschijnlijk]**
- Reinforce the marker with **in-world breadcrumbs** (a trail, a lit path, or the mentor ranger's vehicle to follow) so a non-reader navigates without parsing UI text.
- Pitfall: a too-precise marker everywhere kills exploration for *older* players, but for *this* child **err toward more guidance**; add a "show me the way" helper and never let "lost" become a fail state.

### B3. Vehicle traversal
- **Paths-only ground vehicles + free-flying helicopter is a sound, legible split:** cars/bikes following roads act as built-in rails that aid wayfinding; the helicopter gives freedom *and* the "climb a high vantage to build the macro map" trick (flying reveals the world), a recognised wayfinding aid. **[waarschijnlijk]**
- Make **switching/exiting seamless:** one button to get out and walk anywhere (keep "player can always continue on foot" — it's an accessibility win). Keep controls to **one-or-two buttons** (steer + go; auto-slow near obstacles) for touch + keyboard. Intuitive controls directly raise the SDT competence/autonomy that drive enjoyment (Ryan, Rigby & Przybylski 2006).

### B4. KIND FAILURE DESIGN (the important, sensitive one)
**Honest verdict: the "hit tree → lose 1/3 vehicle → 3 hits → restart at cabin" loop is the *weakest* idea in V2 for this child and should be softened.**
- Game-design theory frames failure as *task-failure + punishment*, with escalating punishment types: energy/"life" loss → **setback** (replay/lost progress) → game-termination (Jesper Juul 2009; GameDeveloper "Accessibility and Difficulty"). A 3-strike destroy-and-restart loop is **setback punishment** — it *removes progress and relocates the child*, the kind most likely to feel shaming to a sensitive learner, and it sits in direct tension with the brief's own fixed constraints ("NEVER punishing, no game-over").
- Accessibility guidance (Game Accessibility Guidelines; child-rights game-design analysis, *Frontiers* 2022) favours **removing hard fail-states for vulnerable players** and offering generous checkpoints, skip/assist options, and feedback that informs rather than penalises.

**Alternatives, gentlest first (pick one or expose as an assist/difficulty setting):**
1. **Soft bonk + slow-down (recommended default):** a tree just bumps/slows the vehicle with a gentle sound and a leaf-puff; no damage, no counter. Signals "careful!" through feedback, not punishment.
2. **"Get out and walk" nudge:** repeated bumps prompt the mentor's friendly voice — "Tricky bit — hop out and walk from here?" — turning a stumble into an autonomy-preserving choice.
3. **Cosmetic-only wear + free repair:** the bike gets muddy/scratched (visual only); reaching a path or the next checkpoint cleans it; never disables play.
4. **Helpful checkpoint, never the cabin:** if you must reset, respawn the *vehicle* gently on the nearest path a few metres back — **never relocate the child to the cabin**, which erases their sense of progress.
5. **If you keep a "3-strike" idea at all,** reframe it as a *non-punishing bonus* ("drive carefully to keep the jeep shiny for a sticker") — a reward for care, not a penalty for error — and make it fully optional.

### B5. Hub-and-spoke: the cabin as cosy home base
- A **home-base hub** (computer = mission select, ladder = helicopter, door = ground vehicles) is a strong, child-friendly structure — compare Wild Kratts' "Tortuga" turtle-HQ or Octonauts' "Octopod": a warm, recurring home you return to between missions. **[waarschijnlijk]**
- Make it feel **cosy and orienting, not menu-like:** diegetic interactions (walk to and click the *computer*, *climb* the ladder, *open* the door) rather than a flat menu; warm light, a crackling stove, the mentor present, the day's letter on the table, a growing wall of earned photos/patches. The hub doubles as the **emotional safe-place** the no-punishment design needs.

**FOR THE GAME, DO:**
- Build a small, sparse, cosy low-poly world with strong landmarks (fire tower, cabin, distinctive pond) and a few themed activity clusters; avoid marker-soup.
- Keep one objective marker + corner map with a single pin, reinforced by in-world breadcrumbs and a "show me the way" helper; never punish getting lost.
- Keep paths-only ground vehicles + free-flying helicopter (great for mental-map building) and one-button "get out and walk anywhere."
- **Replace the 3-strike destruction/cabin-restart with a soft-bonk + slow-down default**, and expose gentler options (get-out-and-walk nudge, cosmetic wear, vehicle-only nearby respawn) as assist settings. Never relocate the child to the cabin as a penalty.
- Make the cabin a warm diegetic hub (walk-to computer, climbable ladder, openable door, growing photo wall), not a flat menu.

---

## THEME C — Story, progression & a kid-appropriate antagonist

### C1. How respected kids' nature media handle "bad guys" without violence/fear/sadness
- **Wild Kratts** is the closest model: villains like **Zach Varmitech** (captures animals for tech) and **Paisley Paver** (paves habitats; she "represented the issue of animal habitats being threatened by illegal logging and deforestation") are **greedy, bumbling, non-lethal** — the heroes **outsmart and foil** them, animals are rescued, and a villain can even **reform** (Paisley turns ally in "Our Blue and Green World"). Common Sense Media's review notes "mild slapstick violence and occasional villainous themes," and that while animals sometimes eat prey, "there's no blood or trauma involved." **[zeker]**
- **Octonauts** is "character vs **environment**" rather than "character vs character" — problems are *situations to solve* (an animal stuck, algae vanishing), resolved with teamwork, science and "calming narration." A villain-free model is fully viable. **[zeker]**
- **Three antagonist framings to choose between** (all avoid harm/fear/sadness as the core feeling):
  1. **The bumbling poacher (Wild-Kratts style):** a recurring, slightly comic stroper you keep *outsmarting and catching on camera* — never violent, never wins, can eventually reform.
  2. **No villain, "nature needs help" (Octonauts style):** the antagonist is a *problem* (a snare someone left, a fallen illegal-cut tree, a blocked stream) you investigate and fix — lowest emotional risk.
  3. **The mystery (whodunit):** clues across missions point to *who* is felling trees/poaching; the child gathers evidence (tracks, camera photos) and *reports* to the BOA — strong through-line, zero on-screen confrontation.
- **Recommended:** a blend of **2 and 3** with an occasional light-comic recurring poacher (1) for continuity — *outsmart → catch-on-camera → report → restore*, never harm.

### C2. Real grounding (kid-safe) on poaching & illegal logging in NL/Europe
- **Poaching (stroperij) is real on the Veluwe and rangers actively work it.** Staatsbosbeheer's "project Stroperij": in **winter 2024/2025, 527 cars were checked, 77 fines issued for various offences, and 7 people arrested**, in joint actions by green BOAs, police and the Koninklijke Marechaussee; evidence found includes "een luchtbuks, een jachtgeweer, munitie, messen of een nachtkijker" (an air rifle, hunting gun, ammunition, knives, a night-vision scope). (Staatsbosbeheer, "Optreden tegen stropers," Dec 2025.) **[zeker]**
- **A real Dutch "caught-on-camera" case:** a boswachter in the Slikken nature reserve repeatedly captured an illegal cannabis grower on a **hidden wildcamera**, then called police — a clean "evidence-on-camera catches the rule-breaker" story (CNNBS, 2023). A separate Achterhoek case saw BOA-boswachters and police catch a bird poacher with catching-nets and bait (single-source — verify before use). **[waarschijnlijk]**
- **Illegal logging globally is a recognised major crime:** INTERPOL/UNEP put it at **15–30% of globally-traded timber, worth ~US$30–100bn/yr** ("Green Carbon: Black Trade," 2012); INTERPOL's **2021 Forestry Crime fact sheet** gives **"an estimated value of between USD 51-152 billion annually,"** and WWF (citing INTERPOL) calls illegal logging the **"world's third-largest transnational crime."** **[zeker]** In the **Netherlands specifically**, the realistic angle is **small-scale wood theft / illegal felling** (which spiked with energy prices — NOS 2022, green-BOA reports), *not* tropical-scale trafficking — do not overstate it.
- **Real ranger anti-crime toolkit to dramatise:** patrols by **BOAs (buitengewoon opsporingsambtenaren)**; **tree-marking ("blessen")** where coloured dots mark trees to fell vs a **blue dot = must stay standing** (so *unmarked* cutting is suspicious — a lovely kid-mechanic); **wildcamera's/camera traps** (cf. Snapshot Hoge Veluwe with Wageningen, using the Agouti app); **satellite monitoring** (EU Copernicus under the new EU Deforestation Regulation, EUDR 2023/1115; and the existing EU Timber Regulation 995/2010); **timber DNA / chain-of-custody tracking**; **photographing evidence**; and **teaming up with police.** **[zeker for tools; satellite/DNA detail waarschijnlijk]**

### C3. Episodic arc structure
- Build a **chaptered through-line with a recurring antagonist or unfolding mystery** (the Wild Kratts recurring-villain pattern). Each mission is self-contained *and* drops one clue/step toward the season's big case (who's been felling/poaching). A small **"case board"** in the cabin (photos + string) visualises progress and pulls the child forward between missions. **[waarschijnlijk]**
- Escalate gently: nuisance → mystery → gather evidence → outsmart/catch-on-camera → report to BOA → **restore the damage** (the emotionally satisfying finale — heath regrows, animal released).

### C4. Reading load in story beats (AVI M3/E3 + dyslexia)
- Carry narrative with **voice-over + picture + animation + icons first, text second.** For this child, **every story beat must be fully understandable with the sound on and the text unread.** **[zeker — from cognitive-load + dyslexia guidance]**
- When text appears, keep beats to **one short sentence at a time**, big, with read-aloud and karaoke-style word highlighting (Theme E).

### C5. Emotional-safety do/don't list (environmental-threat storyline)
**DO:** keep threats *solvable* and *resolved off-screen*; show hopeful restoration; let the child be capable and in control; make the antagonist comic/clumsy and catchable; centre teamwork and grateful animals; resolve every tense beat within the same short session.
**DON'T:** show animals hurt, bleeding, dead, or in graphic distress; show weapons used or any violence; use jump-scares, darkness-as-dread, chase-panic, or loud threat stings; leave a sad/unresolved ending; imply the child failed an animal; depict realistic guns/snares causing visible harm. *(A found, empty snare you safely remove is fine; an animal caught in one on-screen is not.)*

**FOR THE GAME, DO:**
- Use a blend of "nature-needs-help" + light mystery, with an optional bumbling, catchable, reformable poacher; resolve by outsmart → camera-evidence → report to the BOA → restore.
- Ground mechanics in real ranger work (blessen coloured dots, wildcamera's, patrols, photographing evidence) but keep Dutch illegal-logging *modest* and never fact-dump.
- Carry story with voice+picture+animation; one short sentence of text per beat, read-aloud always available.
- Hold the emotional-safety line: no hurt animals, weapons-in-use, jump-scares, or sad endings; every tense beat resolves hopefully within the session.

---

## THEME D — Catalogue of ranger mini-games (19 seeds)
Each: **engine** · core interaction · why age-appropriate/fun · safety-tone flag · season · repeatable elsewhere? · story-tie.

1. **Spoor/track ID** — *Zoeken* (+*Wisselen* if you switch animals) · scan ground, tap the track matching the card · detective-satisfying, low reading · none · autumn/winter (mud/snow) · **repeatable** · *story:* read tyre/boot tracks at a felling site.
2. **Dieren tellen / tally** — *Simon* / working memory · count & echo how many deer crossed, in order · quick proud "I got it" · don't imply harm on a miscount · all seasons · **repeatable** · ties to population checks the antagonist disturbs.
3. **Wildcamera plaatsen & photo-ID** — *Corsi* (placement spots/order) + *Zoeken* (ID the photo) · pick good spots, then match the capture to a species · real citizen-science feel (mirrors Snapshot Hoge Veluwe/Agouti) · keep "no filming people" as a gentle in-world note · all · **repeatable** · *story:* the camera catches the poacher/logger.
4. **Ecoduct / wildlife-crossing check** — *Zoeken* + *Wisselen* · scan which animals used the crossing; clear a blockage · teaches connectivity simply · none · spring/autumn · **repeatable** · ties to "someone blocked the crossing."
5. **Nestkast ophangen** — *Corsi* · remember & place boxes at the right heights/spots in order · gentle, constructive · none · late winter/spring · **repeatable** · —
6. **Vliegend-hert takkenril / broedstoof bouwen** — *Simon* / sequence · stack logs in the shown order · build-y, satisfying · none · summer · **Veluwe-leaning** (stag-beetle habitat) but adaptable · —
7. **Heide/ven herstel (heath/pond restoration)** — *Wisselen* · switch tasks: pull young pines, then check water level · visible restoration = hope · none · autumn/winter · **repeatable** · the satisfying arc finale.
8. **Hek & wildspiegel-check** — *Zoeken* · patrol fence/mirrors, spot the broken one · "I keep animals safe" · none · all · **repeatable** · ties to a cut fence (poacher access).
9. **Brandwacht / fire watch** — *Zoeken* (sustained attention) · scan from the tower for the smoke-wisp among clouds · tower doubles as the wayfinding vantage · keep calm, no scary fire imagery; spot-early-and-report · summer · **repeatable** · —
10. **Invasieve plant verwijderen** — *Dag&Nacht* / inhibition · pull only the invasive plant, *not* the native look-alike · clean "good vs weed" logic · none · summer · **repeatable** · —
11. **Waterpeil / bron checken** — *Simon* · read & repeat the gauge sequence · short, tidy · none · all · **repeatable** · ties to a blocked/diverted stream.
12. **Vogels ringen / bird ringing** — *Corsi* / sequence + gentle handling · follow the careful order of steps · model gentleness explicitly · spring · **repeatable** · —
13. **Zaad verzamelen / seed collecting** — *Zoeken* · find ripe seeds among unripe · calm, foraging-satisfying · none · autumn · **repeatable** · —
14. **Pad herstellen / path repair** — *Corsi* / sequence · lay stepping stones in order · constructive · none · all · **repeatable** · —
15. **Zwerfafval opruimen / litter clean-up** — *Dag&Nacht* or *Zoeken* · grab litter, leave natural items (inhibition) · clear pro-nature message · none · all · **repeatable** · ties to evidence dropped by intruders.
16. **GPS/telemetrie tracking** — *Corsi* · follow the signal route to find the collared animal · gadget-fun (real: GPS sheep/wolf tracking on the Veluwe) · none · all · **repeatable** · —
17. **Vastzittend/gewond dier bevrijden & vrijlaten** — *Wisselen* + careful sequence · switch tools to gently free and release · hopeful; **must stay non-graphic** — animal is *stuck*, not bloodied · all · **repeatable** · story climax: free the animal from a found snare.
18. **"Raak het reekalf niet aan" (don't touch the fawn)** — *Dag&Nacht* / inhibition · resist the urge to approach; do the quiet right thing · teaches the real do-not-disturb rule via inhibition · gentle, no distress · spring · **repeatable** · —
19. **"Voer de zwijnen niet" (don't feed the boar)** — *Dag&Nacht* / inhibition · inhibit the "obvious" feed action; pick the correct ranger action · real safety lesson · none · all · **repeatable** · —

(19 seeds — comfortably exceeds the 10–15 target, covering all five engines and all four seasons. Almost all are repeatable in a future Wadden/Biesbosch area with new animals; #6 is the most Veluwe-specific.)

**FOR THE GAME, DO:**
- Ship a launch set of ~10 spanning all five engines and all four seasons; reserve the rest for later areas.
- Tag each as *repeatable* so the same engine re-skins for a future Wadden/Biesbosch area.
- Route the snare-removal, track-reading and camera-trap games into the poacher/logger arc; keep #17 explicitly non-graphic.

---

## THEME E — Accessibility & dyslexia in text and UI

### E1. Dyslexia-friendly text (British Dyslexia Association *Dyslexia Style Guide* 2023, unless noted)
- **Font:** sans-serif — Arial, Verdana, Tahoma, Century Gothic, Trebuchet, Calibri, Open Sans, Comic Sans — "as letters can appear less crowded." **[zeker]**
- **OpenDyslexic / Dyslexie fonts: do *not* rely on them.** Rello & Baeza-Yates (ASSETS 2013) eye-tracked 97 readers (48 with dyslexia) on 12 fonts: "sans serif, monospaced, and roman font styles significantly improved … reading performance," while OpenDyslexic "did not significantly improve reading time nor shorten eye fixation." Wery & Diliberto (2016, *Annals of Dyslexia*) found "no improvement in reading rate or accuracy," and "none of the participants reported preferring to read material presented in that font." Kuster et al. (2018) found the Dyslexie font gave no reading benefit. **Use a good standard sans-serif, not a "dyslexia font."** **[zeker]**
- **Size:** ≥12–14pt (≈16–19px), larger welcome — for a child's game go **bigger** than minimum. **[zeker]**
- **Spacing:** generous inter-letter (≈35% of letter width), inter-word ≥3.5× inter-letter, line spacing ~1.5/150%. *(Caveat: a 2020 study found increasing letter spacing without matching word spacing can *hurt* dyslexic children — keep word gaps clearly larger.)* **[zeker]**
- **Background:** **never stark white** ("can appear too dazzling") — use **cream or a soft pastel**, dark text on light. Avoid red/green and pink for colour-blind safety. **[zeker]**
- **Layout/style:** left-aligned, ragged right (no justification); short lines (BDA: ~60–70 chars; far shorter for a child); **short, simple, active-voice sentences**; **bold** (not italics/underline/ALL-CAPS) for emphasis; bullets/numbers over dense prose. **[zeker]**
- **Read-aloud / karaoke highlighting:** provide text-to-speech with **word-by-word highlighting**; but heed the **redundancy effect** — don't force the child to read a long passage *and* hear it identically at a mismatched pace; keep synced text short. **[zeker for TTS value; waarschijnlijk for exact karaoke benefit]**
- **Bionic Reading:** unproven for dyslexia — its testing "did not include dyslexic participants," and bolding word-starts can raise speed but *lower accuracy/comprehension*. **Don't depend on it.** **[waarschijnlijk]**

### E2. Reducing reading load via redundancy
- Lead with **audio + icon + animation**; text is the *backup* channel, never the sole channel (Mayer's multimedia principles). Ensure **every instruction and story beat is fully playable with text unread.** **[zeker]**

### E3. Touch & motor accessibility for an 8-year-old
- **Hit targets:** WCAG 2.2 SC 2.5.8 sets a **24×24 CSS px minimum (AA)**; best practice is **44×44 px** (Apple HIG: "44pt × 44pt"; Google Material: "48×48 dp"). For a child, **target the larger end (≥44–48px, bigger for primary actions)** with **clear spacing/exclusion zones** between targets (BBC GEL). **[zeker]**
- **Controls:** one-button / one-tap patterns; avoid button-mashing and simultaneous inputs (Game Accessibility Guidelines); allow simple remap; large, well-spaced buttons. **[zeker]**
- **Reduced motion:** respect the OS "reduce motion" setting — cut camera shake, parallax, flashes, and big transitions (3D specifics in Theme F). **[zeker as principle]**

### E4. Introducing "hard expert words" (jargon) safely
- Treat jargon as **optional bonus "knap-woord" badges**, delivered **picture + sound first**, with the written word as enrichment — never gate progress on reading a hard word. This fits cognitive-load/dyslexia guidance (no extraneous reading load) and SDT (optional mastery = competence without pressure). A child *collects* "edelhert," "ecoduct," "broedstoof" as spoken, illustrated trophies. **[waarschijnlijk]**

**FOR THE GAME, DO:**
- Use a clean sans-serif (Arial/Verdana/Open Sans) — **not** OpenDyslexic; big type, cream/pastel background, left-aligned short active sentences, bold-only emphasis.
- Make audio+icon+animation the primary channel; text always optional and read-aloud with short synced highlighting.
- Use ≥44–48px well-spaced touch targets, one-button controls, remap, and honour OS reduced-motion.
- Offer jargon as optional picture+sound "knap-woord" badges, never as required reading.

---

## THEME F — Making world, story & mini-games feel like ONE 3D experience

### F1. In-world mini-games (no separate puzzle screen)
- Pattern to copy: **the player walks up to a thing and the task happens *there*** — kneel to examine tracks, raise the camera to frame an animal, sort logs at the pile — with a gentle **camera push-in** to focus and a smooth pull-back to free-roam when done. This is the "examine/interact in place" convention of immersive 3D games (TV Tropes "Diegetic Interface"; Firewatch opens its map *in the character's hands* rather than cutting away). **[waarschijnlijk]**
- Use a clear, consistent **interact prompt** (a soft floating icon over the interactable; button/tap to engage), child-sized (Theme E), with the *same* prompt language everywhere so it's learned once.

### F2. Diegetic UI in 3D (what's in-world vs on the HUD)
- Industry taxonomy (Fagerholt & Lorentzon 2009, "Beyond the HUD"): **diegetic** (in the fiction), **spatial** (in 3D space but only the player sees it, e.g. a floating waypoint), **non-diegetic** (flat overlay, e.g. BOTW's corner map), **meta** (screen effects).
- **Put in the world (diegetic):** mission select = the **cabin computer**; the day's job = a **letter/signpost**; the case-so-far = the **cabin case-board**; the destination = a **light beam/marker in the sky** or the mentor's vehicle to follow; "be careful" = the **leaf-puff/slow** of a soft bonk.
- **Keep as a light overlay (non-diegetic/spatial) only what must be glanceable:** the **small corner map + single pin**, the **interact prompt**, and (if kept) a **gentle vehicle-state hint**. BOTW's clean minimal overlay above a physical world is the reference. **[zeker as taxonomy; waarschijnlijk as recommendation]**
- For a child, **fewer HUD elements is better** — prefer diegetic/spatial cues (a glowing path, a tower to head for) over text-y overlays; never clutter the screen.

### F3. Camera for kids in 3D (nausea/disorientation)
- **Third-person is safer than first-person** for motion sickness: third-person cameras are "typically more stable, with a wider field of view, and centred around an exterior perspective" (Access-Ability; clinical/community consensus). Use a **gentle third-person follow** (or a slightly top-down-ish follow for driving) as default. **[waarschijnlijk]**
- Reduce sickness triggers: **no head-bob/weapon-bob**, **no motion blur**, smooth (eased, not instant) camera turns; avoid very wide FOV (large FOV increases vection/cybersickness — PMC studies). For close-up mini-games, a **stable eased push-in**, not a swooping move. **[waarschijnlijk]**
- **Reduced-motion mode in 3D:** cut camera shake, reduce auto-camera swing, slow/lengthen transitions, keep the horizon steady, optionally narrow FOV, and use steadier camera behaviour while driving/flying. **[waarschijnlijk]**

### F4. Staging story in 3D (show, don't text-dump)
- Deliver beats as **things the child sees happen in the world:** the poacher's jeep drives off in the distance; the mentor walks over and *speaks* (voice + optional subtitle); the freed animal bounds away; the heath visibly regrows. This keeps reading near-zero and matches the Octonauts "character vs environment" model where the *situation* tells the story. **[waarschijnlijk]**
- Meet characters **in-world** (the mentor at the cabin, a grateful farmer at a fence), not via menus or text walls.

### F5. Continuity across scenes + scope/performance for a small cosy world
- **Keep it one continuous space:** transition cabin → world → mini-game → reunion with **camera moves and streaming, not hard cuts to separate screens** (mini-games happen *in situ*, F1). The cabin is a real building you drive away from and back to.
- **Scope discipline for a small low-poly world that still feels alive:** prefer a **compact, dense-with-meaning** map over a large empty one (Theme B); reuse a tight **low-poly asset/material kit**; conjure life cheaply with **ambient audio (birds, wind), a few looping animal animations, gentle day/night and seasonal colour tint, and light particles (leaves, pollen)** rather than simulation; bake lighting where possible; instance vegetation. Cosiness comes from **sound + light + a few well-placed animals**, not from world size. **[waarschijnlijk — general 3D scoping wisdom]**

**FOR THE GAME, DO:**
- Run every mini-game *in place* with an eased camera push-in and a single consistent interact prompt; never cut to a separate puzzle screen.
- Put mission-select, briefing, and the case-board *in the cabin* (diegetic); keep only the corner map+pin, interact prompt, and a soft vehicle hint as a minimal overlay.
- Default to a stable gentle third-person (top-down-ish for driving), no bob/blur, eased turns, moderate FOV; ship a real 3D reduced-motion mode.
- Tell story through visible in-world events and a speaking mentor, not text dumps.
- Keep the world small, continuous and cosy; conjure "alive" with ambient sound, light, seasonal tint and a few looping animals rather than a big or heavily-simulated map.

---

## Where 3D specifically changes the recommendation (vs 2D)
- **Mini-games:** in 2D you would cut to a puzzle panel; in 3D you must instead **stage the task in place** with a camera push-in (F1) — this is the single biggest 3D-specific design demand and the core of the "one continuous space" vision.
- **UI:** 2D games lean on overlays; 3D unlocks **diegetic/spatial UI** (cabin computer, sky-beam marker, in-world case-board), so move as much as possible *into the world* and keep the HUD to a tiny map+pin (F2).
- **Camera/comfort:** 2D has no motion-sickness risk; 3D introduces it, so **camera choice becomes an accessibility feature** (gentle third-person, no bob/blur, eased turns, moderate FOV, true reduced-motion mode) — especially while driving/flying (F3).
- **Wayfinding:** 3D lets you use **landmarks, towers and a flying vantage point** to build a mental map (B1–B3) — richer and more legible than a 2D map, but it requires deliberate landmark placement.
- **Failure feedback:** in 3D a "soft bonk" can be sold through **physical feedback (leaf-puff, slow-down, sound)** rather than an abstract life-counter, making kind-failure design more natural (B4).
- **Scope risk:** 3D is far more expensive to build, so the **small-cosy-dense** discipline and cheap "alive" tricks (F5) matter much more than in 2D.

## Overall recommendation & the guiding bar
Build a **small, warm, beautiful low-poly Veluwe** and a **kind, capable ranger fantasy** first; let the five engines live invisibly inside real ranger jobs. Be **honest that this is not proven brain-training** (Theme A) — its real, defensible gifts are autonomy, competence, calm and pride. **Soften the collision/penalty loop** (Theme B4) and **protect emotional safety** (Theme C5) above all else. If a parent watching forgets it is executive-function training and just sees their son being a calm, capable, proud ranger on a golden Veluwe morning — it worked.

---
### Certainty key
**zeker** = strong, consistent peer-reviewed or primary-source evidence · **waarschijnlijk** = reasonable support / professional consensus / sound inference, but contested or indirect · **onzeker** = thin or single-source; flagged in text.

### Note on sources used
EF evidence: Melby-Lervåg, Redick & Hulme 2016; Simons et al. 2016; Sala & Gobet 2019 and Gobet & Sala 2023; Kassai et al. 2019; Diamond & Ling 2016, Diamond & Lee 2011, Diamond 2020. Motivation: Ryan, Rigby & Przybylski 2006; Dweck/Gunderson/Henderlong & Lepper; Deci, Koestner & Ryan 1999. Serious-game precedent: Prins et al. 2013 (Braingame Brian); Song/Yi/Park (CoCon); JMIR Serious Games. Wayfinding/UI: The Level Design Book; Fagerholt & Lorentzon 2009. Failure design: Juul 2009; Game Accessibility Guidelines; *Frontiers* 2022 child-rights analysis. Antagonist models: Wild Kratts (Wikipedia/Common Sense Media), Octonauts. Dutch grounding: Staatsbosbeheer "Optreden tegen stropers" (Dec 2025); CNNBS 2023; NOS 2022; INTERPOL/UNEP 2012 & INTERPOL 2021; WWF; EUDR 2023/1115 & EUTR 995/2010. Dyslexia/UI: British Dyslexia Association Style Guide 2023; Rello & Baeza-Yates 2013; Wery & Diliberto 2016; Kuster et al. 2018; WCAG 2.2 / Apple HIG / Google Material; Mayer multimedia principles; Gathercole et al. 2006; Sweller cognitive-load theory. Camera/motion: Access-Ability; cybersickness/vection PMC studies.