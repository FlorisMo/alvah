# 11 — Expeditions: the cross-area quest layer

> **What this is.** The missing top layer: multi-area quests that compose the area catalogues'
> mini-games into stories. The research treats the ten areas separately (correctly — that is how
> evidence works); the *game* only feels like one game if a season has a plot. An expedition is that
> plot: a weeks-long arc where scoping a project, reading a track, convincing a farmer and weighing
> a trade-off are beats of one adventure rather than items on a curriculum.
>
> **Architecture thesis, held:** an expedition is **data, not code** — a sequence of existing engine
> skins sharing one narrative context, plus an almanac artefact at the end. No new machinery; the
> one new thing is the *expedition record* below.
>
> **Expeditions are also the spaced-rehearsal delivery vehicle.** Doc 06 §6 wants procedural skills
> resurfaced by *trigger*, interleaved, in varied contexts — exactly what a fresh expedition does
> naturally ("the grant form needs a percentage — remember those?"). The scheduler proposes which
> rusty rungs an expedition should include; the story disguises the rehearsal.
>
> **Status:** v1, 2 Jul 2026. Whole layer is new — design hypothesis; every beat inherits its own
> area's flags, gates and privacy rules (an expedition never overrides an age-gate or the motivation
> rulebook; heavy beats keep their co-play routing).

---

## 1. The expedition record (data-skin, like everything else)

```jsonc
{
  "expedition_id": "the-new-pond",
  "season": "spring",                      // when it naturally triggers
  "band_min": "10-12",                     // readiness band, per 00-growth-model §1
  "recurs": true,                          // returns next year, one rung deeper (§3)
  "beats": [                               // ordered, each an existing skin + context
    { "skin": "notice-and-name",        "context": "the dried-out hollow bugs you" },
    { "skin": "scope-the-restoration",  "context": "pond, smallest version" },
    { "skin": "run-a-budget",           "context": "the pond budget", "resurface": "percent-forge" },
    { "skin": "angry-farmer",           "context": "the neighbour fears mosquitoes" },
    { "skin": "whos-affected",          "context": "newts vs dogs-off-leash" },
    { "skin": "slow-look-journal",      "context": "weekly pond entries" }
  ],
  "almanac_artifact": "before/after page + the pond's first-year phenology ring",
  "co_play_beats": ["angry-farmer"]        // beats that route to parent-present at this band
}
```

The scheduler may inject one `resurface` beat per expedition (a rusty rung, doc 06 §6); never more —
an expedition must stay a story, not a syllabus.

## 2. The six launch expeditions

### The New Pond (band 10–12+, spring, recurs)
The worked example above — the full tension→action loop with money, neighbours and newts attached.
**Areas:** 04 work (the spine) · 03 budget · 05 the mosquito conversation · 08 who's affected ·
10 the journal + the returning frogs as the reward the world pays honestly.
**Recurrence:** year 2 the pond needs maintenance and has *data* (did the frogs come? — epistemics
on his own prediction); year 3 it needs defending (the dry summer, the dog owners).

### The Wolf Rumour (band 12–14+, any season, recurs with variants)
A visitor claims a wolf took a lamb. **Areas:** 02 epistemics (the spine: source, evidence,
calibration — "how sure are we, and what would change it?") · 10 read the tracks and the kill-site
signs (perception handing evidence to reasoning) · 01 what explains these signs (inference) · 05 the
frightened farmer heard first, steel-manned, answered without blame · 08 what to tell the village —
precaution vs panic, whose voices count. **The almanac artefact:** the investigation file, with his
confidence curve attached.
**Why this one matters:** it is the game's thesis in one story — perception feeds logic feeds
epistemics feeds communication feeds ethics, about one real Veluwe fact (the wolf is back).

### The Kiosk Season (band 14–16, summer, recurs as the venture grows)
Run the kiosk for a season. **Areas:** 03 finance (the spine: stock, price, margin, the rainy-week
cushion) · 07 make the season's product + poster (with Spot-the-AI-Slop on the AI draft options) ·
05 serve customers, hear complaints, one Polite No · 04 the whole thing runs on the project board ·
08 one "should we sell this?" beat. **Graduation lane:** year 2 can be the *real* market-stall
variant (rung 4, parent-in-loop).

### The Big Count (all bands, every autumn — the annual anchor)
The yearly wildlife count, deliberately the same every year so growth is visible against a fixed
event. **Areas:** 10 perception (the spine: calls, tracks, the sit-spot baseline) · 01 sampling
logic, grown band by band — 8–10 count one plot with the mentor · 10–12 why we count *three plots
and not everywhere* (sampling!) · 12–14 estimate totals from samples with a confidence interval
(Guess-the-Forest + Sure-O-Meter) · 14–16 design the count protocol; account for detection bias
("we hear more on still mornings — does that change the number or the truth?") · 16–18 run the
count, brief the volunteers (Teach the New Volunteer), submit to the real regional count
(citizen-science rung 4). **The almanac artefact:** the count page — a decade of them becomes his
own dataset, and the game's most honest long-term reward.

### The Storm Week (band 10+, triggered by the season, recurs)
A storm is coming; then it hits; then the reserve rebuilds. **Areas:** 09 the pacing spine (prepare
while fresh, rest before the night, the Ranger's Day under stress) · 04 triage and re-scope (the
plan meets reality; Re-scope Rescue's finest hour) · 06 the fear beat, private and optional (the
Ranger Meets His Fear before the storm — its canonical scene) · 03 the repair budget with real
trade-offs · 10 what changed since yesterday, storm edition. **Design note:** the storm is the
game's controlled encounter with things going wrong — recoverable, paced, never punishing (veluwe
safety chart tone throughout).

### The Exchange Visit (band 14+, spring, one-shot then variants)
A ranger from another reserve visits; then ours visits theirs (a fen, a coast, a city park).
**Areas:** 05 hosting and asking (The Right Question, both directions) · 10 perceiving an
*unfamiliar* landscape (the pattern library humbled — expertise is narrow, felt kindly; the doc 07
honesty line as an experience) · 02 when-the-experts-disagree on management styles · 07 bring-back:
make something inspired by theirs, credited (Influence Map). **Why:** it is the transfer-honesty
table turned into fiction — skills are local, curiosity travels.

## 3. Recurrence: the spiral, playable

The same expedition returns a year later one rung deeper — same pond, same count, same storm season.
Recurrence is what makes growth *visible against a fixed background* (the almanac shows the same
event at 9, 11, 14, 17), delivers spaced rehearsal without nagging, and gives the game its calendar.
Two rules: an expedition never recurs identically (one new complication per return), and the child
can always see his previous year's artefact *before* starting the new one (the Seasons-Replay move,
generalised).

## 4. Authoring rules (so expeditions stay safe and honest)

1. **Beats inherit their area's law.** Age-gates (08), privacy tiers (04/06), co-play routing,
   the anti-gambling line, the motivation rulebook — an expedition changes *context*, never rules.
2. **One resurface beat max**; the story leads, the scheduler follows.
3. **The world pays what it promises** (doc 02 §1.3) — expedition rewards (the frogs return, the
   count publishes) arrive as promised, always.
4. **Agency before bleak facts** (doc 05 §8) — an expedition that will show hard things (the storm,
   a failed nest) equips first.
5. **The almanac artefact is the ending** — every expedition closes with a made thing, not a score
   screen (doc 03 §5: the almanac *is* the reward).
6. **Band variants, not band locks** — where possible the same expedition has an 8-year-old shape
   and a 16-year-old shape (The Big Count is the model), so family play stays possible across ages.

## 5. Open decisions

- **First expedition to build** — recommend **The Big Count**: it composes the recommended first
  vertical slice (Perception on engine 01) with one logic beat and the almanac, recurs annually by
  design, and needs no Engine 04. The Wolf Rumour is the strongest *second* (adds epistemics +
  communication; its farmer beat can stay scripted until PLAN §7.6 lands).
- **Expedition cadence** — one per season + the annual Count feels right (4–5/year); confirm against
  real play rhythm so expeditions never become homework.
- **Whether expeditions gate mini-games** — recommendation: never. Field drills stay freely playable;
  expeditions *contextualise* skills, they don't own them.
