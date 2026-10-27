# Run 7 · FOUNDATION lane: variety, growth and discovery under every game

> Lane lead's design, 2026-10-01. Base `run7/integration` @ 1941214 (run 6's result).
> Read GOAL.md, STATE.md (2026-10-01), CLAUDE.md, ARCHITECTURE.md first, and the run's
> STRATEGY.md. This file is the contract the foundation builders build to and the lead
> reviews against, and **section 4 is the contract every game lane builds on** (it is
> authoritative over the names in STRATEGY.md). Section 11 is the package plan. The final
> agent copies this file to `design/run7-foundation.md`.

## 0. In one paragraph (player terms)

Today the four adventures are good the first time and the same the fifth time: the piglet
lies in the same clump, dead in the middle of the picture, and is found in 1-3 seconds;
the calm moments come in the same order with the "now it is allowed" moment always last;
the echo game is over after one echo of two calls; the light is always the same golden
hour; and a boar 20 m away is a black cut-out. After this run, every time Alvah comes
back the world is a little different: a misty morning, a bright day, an overcast
afternoon, a golden evening or a soft dusk. Inside a mission the home draws this play's
hiding spot, route, order of calm moments and maybe a rare visitor from one seed, so no
two plays are alike, while each breinkracht starts where *he* is and grows while he
succeeds: the echo starts at two calls the first time, grows to three and four in the same
game, and starts at three next time once two came easily. Nothing ever gets harder by
luck, and nothing ever drops back to baby level. What he sees and hears goes into a
**veldgids** in the hut: animals, tracks, finds, the camera's photos and a few rare ones,
with grey silhouettes and one short line for what is still out there. No points, no
streaks, no timers: just a reason to look again.

## 1. What I found (scouted 2026-10-01 on 1941214, port 5510, fresh and practised saves)

Played the four adventures with real keys and clicks (frisling ×1 full + its replays
attempted, ree, wildcamera, eekhoorn ×1), the 2D floors under "altijd 2D" for frisling
(zoeken, corsi, dagnacht) and wildcamera (wisselen, simon) at level 1 and at a practised
level 3.5, walked up to roaming and resident animals at 55/40/25/13 m, and measured the
dark animals' own pixels with one material property toggled at a time. Screenshots looked
at; numbers below are measured, not read off code.

**What is the same every play**
- The frisling search: the piglet lies at one spot, its hint point at (648, 379) on a
  1280×800 picture: 8 px from the centre column. Found in **3 s** (no miss). The ree's
  calf: hint at (666, 349), found in **1 s**. `SEARCH_GLIMPSE = 0.18` is a constant.
- The 2D zoeken field: the target is `skin.doel ?? {52, 58}` (fixed, near the middle) and
  the decoys keep their authored x/y: the same picture every play, at every level.
- Rustkracht: `DagnachtRun` walks `skin.encounters` in content order; the flip ("Nu mag
  het wél") is always the LAST encounter (frisling `pad`, ree `moeder`). The order of the
  calm moments never changes, and a child learns "the last one is yes".
- Simon: `SimonRun` always begins at length 2 and the target is `simonLengte =
  clampInt(1 + level, 2, 6)` → **2 at level 1-1.49**. The wildcamera callers beat took
  **7 s and two clicks** (66.6 s → 73.8 s); the eekhoorn's the same. After one beat the
  level is 1.34, still target 2: **the second echo game is over after two calls too**. A
  practised child (level 3.5) still starts at 2 and climbs 2-3-4-5 every time (44 s).
- Corsi: one route per beat, length `clampInt(2 + level, 3, 6)`: 3 at level 1, then a
  jump to **6 at level 3.5** in one step (2D floor, practised save).
- Wisselen: 6 animals, the flip after 4, one flip, every play.
- Time of day: the golden hour, always (the wildcamera's night is its own).

**What varies today**: the corsi route order, which caller sounds, the aim queue order
(all from `Math.random`, not reproducible). Nothing in the world.

**Difficulty today (core/skill.ts)**: one reversal staircase, ±0.34 per beat on accuracy,
`floorLevel(trials) = 1 + min(2, log2(1 + trials/5))`. Because a rustkracht beat counts 5
trials, **dagnacht jumps from level 1 to 2 after one mission** without any change a child
could feel (its only knob is `slowmo`). The binary scores (trials 1, correct 0/1) cannot
show growth: a perfect 2-call echo and a perfect 5-call echo log the same `{1, 1}`.
`lensSterkte` runs the wrong way (`0.95 - d·0.16`: harder at level 1, gone at level 6),
and only the classic 3D lens reads it.

**Too easy / too hard / read instead of played**
- Too easy: both searches (1-3 s), the first two echo games (one echo of 2), corsi 3.
- Too abrupt: corsi 3 → 6 between level 1.5 and 3.5; simon always restarts at 2.
- Read instead of played: the aim card carries the answer's category as a word chip
  ("☀ Dag-dier"), five rustkracht moments are cards in frisling/ree (game lanes' job),
  the 2D floors are fine as cards (they are the floor).

**Distant animals render almost black (the named fix) — root cause measured**
- At 20-25 m in the golden hour the roaming boar, the resident sow and yearling at the
  wallow and the red deer at the herstel marker are **black cut-outs** (screenshots at
  13/24/38 m). The roe deer roamer reads brown. The ranger reads well.
- Measured on the roaming boar at 20 m (its own pixels, darkest tenth, sRGB luma 0-255):
  baseline **1-2**; normal map off: 2; metalness 0: 1; roughness 1: 1; no mipmaps: 1;
  emissive off: 1; **base-colour map removed (white albedo): 89**. So it is not a shader,
  mipmap or normal bug: the boar's own texture is very dark (mean sRGB 66/53/48, ≈0.05
  linear) and the side the camera sees is mostly **away from the low key light**, lit
  only by the hemisphere fill (0.85, cool sky over warm ground) — and there is no
  environment light at all (`scene.environment` null). Dark albedo × fill-only = black.
  Up close you see texture and a sheen, at 20 m the animal is a small flat dark shape
  against bright, fully sunlit ground (fog only starts at 22 m: no lift either).
- The CC0 quadrupeds (red deer, roe, fox, wolf) carry `metalness 0.4, roughness 0.41`
  with no env map: 40% of their diffuse is thrown away. The red deer's body material
  (`Material.001`, 1794 of 3667 tris) is base `0.03 / 0.02 / 0.01` linear: near black
  by its data. The fox already has a coat-tint correction for the same reason
  (`Coat.ts COAT_TINT`).
- The Meshy animals (boar, piglet, badger, squirrel, raven, frog, nightjar, birds) have
  `metallicFactor 1` but their metal channel is ~0 (B ≈ 1/255): effectively matte.
- Every load path dresses animals separately: `play/spawn.ts` (missions, residents),
  `world/Fauna.ts` (roamers, gliding birds), `world/Markers.ts` (marker heroes). A fix
  in one path leaves the others black.

**Pitfalls found while scouting** (section 10 lists them all): `renderView` is not on
`window.__ranger`; the frisling replay walk back to the marker got the bot stuck (80 s,
the family and cover round the wallow); the lead walk took the bot 139 s and 160 m for
~31 m (the walk hint flips between goal and "back to the piglet": a game-lane matter, but
it inflates every golden run); `store.logSession` is also called by the hut's care game
(`ui/Companion.ts`, binary summaries for corsi + dagnacht).

## 2. The bar

1. **No two plays alike, every play as readable.** Every random choice in a play comes
   from one seed (`k.play`); a variant never changes how hard a breinkracht is.
2. **It grows with him, measurably.** Each breinkracht starts at his level, grows inside
   the beat while he succeeds, eases silently when he struggles, always ends on a
   success, and logs what was played into a history that shows weeks of growth.
3. **Parity holds.** The 2D floor and the world build the same trial from the same knobs
   and seed and score the same taps to the same summary, pinned by tests per engine.
4. **A reason to come back, never pressure.** Discoveries, rare visitors with a pity
   rule, silhouettes with one hint line. No currency, streak, timer or "come back".
5. **Different light every visit, every animal readable in every light.**
6. **Alvah's contracts** (GOAL.md, CLAUDE.md) unchanged; golden ALL GREEN at every land.

## 3. What it is like to play (the player's view)

**Three plays in a row of the frisling** (session mood: misty morning):
1. Play 1 (seed A). The mist hangs over the heath; the family roots at the wallow. The
   squeak leads to the bracken; the piglet lies in the **left** clump, stripes glimpsed
   between two fronds near the picture's edge; 4 look-alikes (a dead frond, a stonechat,
   a butterfly, a bird) because he is new. Hands still while he squeaks (3 s). The route:
   3 patches, then the next route 4 patches in the same beat because the first was clean.
   At the wallow the **sow looks first**, then the yearling sniffs his bag; the "go" moment
   comes **in the middle** this time.
2. Play 2 (seed A+1, "Speel nog eens"). Same light (the session's). The piglet is in the
   clump **behind the foxglove**, partly under a frond to the right; the squeak comes from
   there. Five look-alikes now (his zoeken level rose after a quick clean find). The route
   starts at 4. The yearling comes first; the go moment is last. A **rare** visitor shows
   at the edge of the wallow (the frisling lane picks its home's rares): one calm "Nieuw in
   je veldgids!" once the walk is quiet.
3. Play 3. A third spot, another order, holds a little longer (he held twice cleanly).
   No rare this time (the pity counter makes sure one comes within about three plays).

**How it grows over weeks** (per breinkracht, in his save): the level (1-6) rises a whole
step after an easy beat ("won easily"), a third of a step after a fine one, and eases half
a step after a hard one (silently), never below one step under his best. What he notices:
the echo starts at 3, later 4; the route starts longer; more look-alikes and less of the
animal showing; longer stillness with more temptation; the rule turns sooner and twice.
What Floris can read: `__ranger.history()` (dev) and a small "Groei" panel for grown-ups in
Instellingen (start level, best span, beats per week, per breinkracht).

**What he can discover**: per home a handful of things (the animals of the home, a
track, a find, at least one rare), in free roam small surprises (a buzzard gliding low, a
woodpecker drumming at the forest edge, a cuckoo in the morning mist, a wren on a log, a
robin that follows him a few hops, and two rare ones), and the wildcamera's photographs.
Each new one gets one calm reveal (picture, name, read aloud) at a quiet moment, and lands
in the veldgids in the hut, where the still-missing ones show as silhouettes with one
hint line ("Wie tikt er op een boom?").

## 4. The run-7 contracts (authoritative for every lane)

All of it lands in package `contracts` with simple first implementations; later
foundation packages fill in the behaviour **without changing these names**. Game lanes
code against this section.

### 4.1 `k.play` — this play's variety (`core/play.ts`, pure)

```ts
export interface Play {
  readonly seed: number;          // uint32
  readonly missionId: string;
  readonly n: number;             // this mission's play number in the save (1 = first ever)
  rng(): number;                  // [0, 1), mulberry32 over the seed
  pick<T>(list: readonly T[]): T;
  shuffle<T>(list: readonly T[]): T[];        // a shuffled copy
  chance(p: number): boolean;
  between(a: number, b: number): number;      // uniform float in [a, b)
  int(a: number, b: number): number;          // uniform integer in [a, b]
  fork(label: string): Play;                  // an independent stream: seed' = hash32(seed, label)
  note(key: string, value: string | number): void;   // record a choice (logged with every beat)
  readonly variant: Readonly<Record<string, string | number>>;
}
export function newPlay(missionId: string, seed: number, n: number): Play;
export function sessionSeed(): number;   // ?seed=N → N, else crypto.getRandomValues
export function nextPlaySeed(): number;  // the session's k-th play: (base + k) >>> 0 with ?seed, else random
```
- **Drawn at the briefing**: `MissionFlow.showBriefing` draws the play (`drawPlay(mission)`)
  before `adv.prepare`, so the home lays this play's spot under the card; "Ga op pad" plays
  it; "Nog even rondkijken" discards it; every briefing (marker, missiebord, "Speel nog
  eens") draws a new one. The save's `gespeeld[missionId]` counts plays started.
- **Forks per decision**: a home draws each decision from its own fork
  (`k.play.fork('hide').pick(SPOTS)`, `k.play.fork('order')`...), so adding a draw later
  never reshuffles the others, and a unit test can pin "seed 7 → spot b". A home **never
  calls `Math.random`** (a grep in review); the classic path and the 2D floors build their
  trials from the same play's forks (`play.fork('zoeken')` etc.).
- **Note what was chosen**: `k.play.note('hide', 'b')`; the variant travels with every
  beat into the history (`va`, ≤ 60 chars).
- **Dev**: `?dev=1&seed=N` makes the session's plays N, N+1, N+2 … (a reload with the same
  N replays the same session); `__ranger.play()` → `{ missionId, seed, n, variant }` of
  the current (or last) play. Golden and `missions.spec` note every play's seed in their
  notes and print `replay: ?dev=1&seed=<seed>` on a hard failure.

### 4.2 `k.level(engine)` / `k.knobs(engine)` (`core/skill.ts`, pure)

```ts
export interface ZoekKnobs   { lookAlikes: number; glimpse: number; hintAfterS: number; trailLegs: number; trailClarity: number }
export interface SpanKnobs   { start: number; max: number; rounds: number }          // corsi, simon
export interface RustKnobs   { holdS: number; tempts: number; goWaitS: number; slowmo: boolean }
export interface WisselKnobs { sorts: number; flipEvery: number; flips: number }
export interface EngineKnobs { zoeken: ZoekKnobs; corsi: SpanKnobs; simon: SpanKnobs; dagnacht: RustKnobs; wisselen: WisselKnobs }
export function knobsFor<E extends Engine>(engine: E, level: number): EngineKnobs[E];
// store
store.level(engine): number;                       // the live level (the beat's start)
store.knobs<E extends Engine>(engine: E): EngineKnobs[E];   // autoMoeilijk off: from the manual settings
// kit
k.level(e) === store.level(e); k.knobs(e) === store.knobs(e)
```
- `glimpse`: how much of the animal shows through its cover from the framed view (0..1,
  the share `cover-math.visibleShare` measures); `lookAlikes`: decoys laid with it (the 2D
  field shows the same count); `hintAfterS`: seconds before the first diegetic hint;
  `start/max/rounds`: the first sequence's length, the longest a beat may grow to, how
  many sequences a beat plays; `holdS`: seconds of stillness a body moment wants after its
  line was read; `tempts`: temptations during one hold; `goWaitS`: how long he may wait at
  a go-moment before the animals move on; `sorts/flipEvery/flips`: the aim round's length,
  sorts before the first turn, how many turns.
- In `contracts` the values equal today's behaviour (the mapping in package 1's brief);
  `adaptive` replaces the tables (section 5) and the cores. A game maps knobs onto its
  world (e.g. `glimpse` → how far the fronds part; `lookAlikes` → how many decoys its stand
  lays) and **never invents its own difficulty number**.

### 4.3 The beat log and the history (`core/state.ts`)

```ts
export interface BeatSummary {           // core/skill.ts, extended additively
  trials?: number; correct?: number; success?: boolean;
  span?: number; start?: number; rounds?: number; eased?: number;   // corsi, simon
  misses?: number; seconds?: number; hinted?: boolean;               // zoeken
  impulses?: number; holdS?: number;                                 // dagnacht
  switches?: number; switchErrors?: number;                          // wisselen
}
export interface BeatLog {
  t: number;           // Date.now()
  e: Engine; m: string;               // engine, mission id ('' for the hut)
  w: 'world' | 'stage' | '2d';        // the adventure, the classic 3D stage, the 2D floor
  lv: number;          // the level it started at (2 decimals)
  n: number; c: number;               // trials, correct
  sp?: number; st?: number; ms?: number; s?: number; h?: number;   // span, start, misses, seconds, hold s
  f1?: 0 | 1; ea?: number; hi?: 0 | 1; im?: number; sw?: number; se?: number; // (lane close) first round
                       // clean, eased, hinted, impulses, switches, switch errors: what judgeBeat read
  sd: number;          // the play's seed (0 outside a mission)
  va?: string;         // the play's variant, compact ('hide:b,order:2,mood:mist')
}
store.logBeat(engine: Engine, summary: BeatSummary, meta: { missionId: string; view: BeatLog['w']; play: Play | null }): void;
store.logSession(engine, summary)   // kept: logBeat(engine, summary, { missionId: '', view: '2d', play: null })
```
- `GameState.geschiedenis: BeatLog[]`, newest last, **bounded to 400** (oldest dropped),
  default `[]`. ~150 bytes each: ≤ 60 KB.
- `MissionFlow` logs every step through `logBeat` with the play and the view (the
  adventure's `hooks.log`, the classic loop). `__ranger.history()` reads it.

### 4.4 Discoveries: `k.discover(id)`, `k.rare()`, the table, the reveal

```ts
// content/ontdekkingen.ts (data; every lane adds its rows here, in its own block)
export type OntdekSoort = 'dier' | 'zeldzaam' | 'spoor' | 'vondst' | 'foto';
export interface Ontdekking {
  id: string;          // '<home>.<thing>': 'frisling.zeug', 'wereld.buizerd'
  home: string;        // a mission id, or 'wereld' (free roam)
  soort: OntdekSoort;
  naam: string;        // plain, with its article: 'de buizerd'
  naamKnap?: string;   // with the knappe woorden: 'de zeug'
  hint: string;        // what is still out there, ≤ 7 words, read aloud: 'Wie tikt er op een boom?'
  model?: string;      // GLB id for its picture in the veldgids (a real model)
  icon?: IconName;     // a drawn icon when there is no model (a print, a feather)
  stemming?: MoodId[]; // only in these moods (a nightjar at dusk)
}
export const ONTDEKKINGEN: readonly Ontdekking[];
// state
GameState.ontdekt: Record<string, { t: number; n: number }>;   // first time, times seen
GameState.zeldzaam: Record<string, number>;                    // per home: plays since its last rare
store.discover(id): boolean;              // records (n + 1); true when new
// kit
k.discover(id: string, opts?: { quiet?: boolean }): boolean;  // record + one calm reveal when new (quiet: no reveal)
k.rare(): Ontdekking | null;              // THIS play's rare visitor for this home (rolled at drawPlay)
```
- **The rare roll** (pure, `core/discover.ts`): at `drawPlay`, for the mission's home:
  `rare = count >= 2 || play.fork('rare').chance(p) ? pickRare(...) : null` where
  `count = zeldzaam[home]`, `p = 0.34` while the home has an undiscovered rare (else 0.2,
  and no pity), `pickRare` prefers undiscovered rare rows of that home (seeded pick), and
  respects `stemming` against the play's mood. The counter resets to 0 when a rare of the
  home is discovered and grows by 1 when a play of the home **ends won** without one. So
  a rare comes within three plays of a home. The play notes `rare`.
- **The reveal** (`ui/hud/Reveal.ts`): a calm card under the top chips (never a
  `.ra-overlay`, `pointer-events: none` except its 🔊), the picture, "Nieuw in je
  veldgids!" and the name, read aloud once, ~4 s, one at a time from a queue. It waits for
  a quiet moment: no card or menu up, the narrator and Benjamin silent, the first minute's
  teaching slot idle, and inside a mission only during a walk, a look, the reunion or the
  ending (never during search, route, callers, aim or a body hold). A discovery is
  recorded at once; only its reveal waits.
- A discovery is **what he saw or heard**: a home calls `k.discover` when the thing was
  really in his picture (on screen, ≥ ~40 px, ≥ 1 s) or its call reached him, never as a
  prize for winning. The mission's hero animal is recorded quietly when the mission is
  won (`<missionId>.<hero>`, `quiet: true`): the gids always holds the animals he helped.

### 4.5 Moods: `world.mood()` / `k.mood` (`render3d/Moods.ts`, pure, + `world/Sky.ts`)

```ts
export type MoodId = 'gouden-uur' | 'ochtendnevel' | 'zonnig' | 'bewolkt' | 'schemer';
world.mood(): { session: MoodId; now: MoodId };   // the session's mood, and the one on screen
world.setMood(id: MoodId, seconds?: number): void; // crossfade ~2.5 s; a cut under reduced motion
k.mood: MoodId                                     // this play's mood
// Adventure (registry.ts), additive
moods?: { allow?: readonly MoodId[]; perPlay?: boolean }
prepare?(world, mission, play: Play): void         // third parameter added
```
- **Session mood**: the first session of a save (`sfeer.sessies === 0`) is the golden
  hour (today's look; every fresh-save test sees it). Every later session draws one
  of the five from the session seed, **never the last session's** (`sfeer.laatste`).
  The title already stands in it. `?mood=<id>` forces it (dev and tests).
- **Play mood**: the session's, unless the home restricts (`allow`, the session's mood not
  in it → the play draws from `allow`) or asks a new one each play (`perPlay`: drawn from
  `allow` ≠ the home's last). It is set under the briefing card (a cut there: the card
  covers it), and the mission's end (won or stopped) crossfades back to the session mood.
- The wildcamera's night stays its own: `setDaylight(k)` mixes from the mood on screen to
  the night set; the end hands the mood back.
- In `contracts` only the golden hour exists and `setMood` is a no-op that records the id.

### 4.6 Dev params and reads (all read-only)

`?dev=1&seed=N` (session seed base), `?mood=<id>` (session mood), and on `__ranger`:
`play()`, `history()`, `skills()` (per engine `{ level, best, floor, beats, knobs }`),
`discoveries()` (`{ found: id[], rareCounts }`), `mood()`. None of them wins or skips.

### 4.7 A home's recipe (what a game lane does)

1. Choose places by looking at the world; pin each variant in `<id>.places.ts` + its test:
   dry, clear (`World.playClear` rules), inside its home, the target partly visible from
   the framed view (`cover-math.visibleShare` in `[glimpse·0.6, glimpse·1.6]`), and **off
   centre**: `offCentre(frame, target) >= 0.25` (`adventure/places.ts`, see package 1).
2. Draw every choice from a fork of `k.play`, note it; in `prepare(world, mission, play)`
   lay this play's version under the briefing card.
3. Build trials with the engines' builders from `k.knobs(engine)` and the play's fork;
   map the knobs onto the world (more fronds parted for a bigger `glimpse` …).
4. Call `k.discover(id)` when the thing was really seen or heard; show `k.rare()` if set.
5. Add the home's rows to `content/ontdekkingen.ts` (≥ 4 rows, ≥ 1 `zeldzaam`).
6. Optional: `moods: { allow, perPlay }` on the Adventure.

## 5. Difficulty that grows with him (package `adaptive`)

### 5.1 Levels, steps and the floor (`core/skill.ts`)

- `SkillRecord` gains `beats: number` (beats played; `mergeSkill` defaults it from
  `trials` capped at 50 for old saves). `floor = max(1, best − 1)`: never more than one
  step below his best, never below 1 (the old trial-count floor is retired: it lifted a
  struggling child and jumped dagnacht a whole level per mission).
- `updateSkill(prev, summary, engine)` judges the beat per engine (5.2-5.6) as **easy**
  (+1.0), **fine** (+0.34) or **hard** (−0.5, silent), clamps to `[floor, 6]`, raises `best`,
  and — when the summary lacks the engine's own fields (the hut's care game, an old
  caller) — falls back to today's accuracy staircase (±0.34). `recentGroei` marks an
  engine when its level crossed a whole number (a step he will feel), for the calm
  celebration (5.8).
- Knobs read the **band** `b = clamp(floor(level), 1, 6)`. With `autoMoeilijk` off the
  knobs come from the manual settings (simonLengte → simon.start …), rounds fixed, no
  in-beat growth.

### 5.2 Echokracht (simon) and Geheugenkracht (corsi): one span core

`engines/span.ts` — `SpanRun<T>`, shared by simon and corsi, by the 2D floors, the classic
3D stages and the world's beats:

```ts
export class SpanRun<T> {
  constructor(k: SpanKnobs, next: (len: number, prev: readonly T[] | null) => T[]);
  begin(): readonly T[];        // round 1, length k.start
  tap(id: T): 'advance' | 'next' | 'replay' | 'ease' | 'complete';
  get sequence(): readonly T[]; get expected(): T; get echoIndex(): number;
  get round(): number; get finished(): boolean; get grew(): boolean;
  summary(): BeatSummary;      // { trials: rounds, correct: clean rounds, span, start, rounds, eased }
}
```
- A round = one sequence shown/called, then echoed. The right item advances; the last one
  ends the round. **Clean** (no wrong tap this round): `span = max(span, len)`, the next
  round is `len + 1` (≤ max): `'next'` with `grew = true`. **Rescued** (after a replay):
  the next round keeps `len` (a fresh sequence). A **first wrong** tap in a round:
  `'replay'` (the same sequence again, as today). A **second wrong** in the same round:
  `'ease'` — the round goes on with a fresh sequence one shorter (≥ 2), silently (the
  same "Luister nog een keer." line). The beat is `'complete'` after `rounds` rounds, or
  at once after a clean round at `max`. **It always ends on an echo he made.**
- `next(len, prev)`: simon appends one new caller when the round grew (classic Simon: the
  same calls plus one), else draws a fresh sequence (no caller three times in a row);
  corsi draws a fresh route without repeats over the 7 spots. Both from the play's fork.
- **Knobs** (band 1..6):

| band | simon start | simon rounds | corsi start | corsi rounds | max (simon / corsi) |
|---|---|---|---|---|---|
| 1 | 2 | 3 | 3 | 2 | 7 / 6 |
| 2 | 3 | 3 | 3 | 2 | 7 / 6 |
| 3 | 3 | 4 | 4 | 2 | 7 / 6 |
| 4 | 4 | 4 | 4 | 3 | 7 / 6 |
| 5 | 4 | 4 | 5 | 3 | 7 / 6 |
| 6 | 5 | 4 | 5 | 3 | 7 / 6 |

  A first echo game therefore plays 2 → 3 → 4 when he succeeds (three echoes, ~40 s in
  the world), never "two calls and done". A step ("won easily") moves simon's start 2 → 3.
  A skin may set `rondes` (rounds) for its story (the squirrel: 2); the 2D floor reads the
  same skin, so parity holds.
- **Judgement** (amended in review r1 of `adaptive`: a first-round slip is not a drop):
  judged by what he echoed CLEANLY. easy = round 1 clean **and** `span ≥ start + 1` (he
  grew past his start cleanly); fine = round 1 clean, or `span ≥ start + 1` after a slip in
  round 1; steady = a slip, then `span == start`; hard = `span < start` (never a clean echo
  of his start length). Owner's example: first time start 2, he echoes 2 and 3 cleanly →
  easy → level 2 → next time the echo starts at 3.
- `SimonRun` and `CorsiRun` stay as names (thin wrappers on `SpanRun`) so the views
  compile; their parity tests are rewritten to the new contract with an independent
  reference model, as today's tests do.

### 5.3 Speurkracht (zoeken)

| band | lookAlikes | glimpse | hintAfterS | trailLegs | trailClarity |
|---|---|---|---|---|---|
| 1 | 4 | 0.38 | 10 | 2 | 0.95 |
| 2 | 5 | 0.32 | 12 | 3 | 0.85 |
| 3 | 5 | 0.27 | 14 | 3 | 0.72 |
| 4 | 6 | 0.23 | 16 | 4 | 0.60 |
| 5 | 7 | 0.20 | 18 | 4 | 0.50 |
| 6 | 8 | 0.16 | 20 | 5 | 0.40 |

- `buildZoekenTrial(skin, knobs, rng)`: draws **which** `lookAlikes` decoys come from the
  skin's list (seeded), and for the 2D field a **layout**: the target and decoys on seeded
  spots with ≥ 12% spacing, the target never within 15% of the field's centre (no fixed
  `doel`), `haze = 1 − glimpse` (the 2D field's grass over the animal; the classic lens
  edge reads the same number, fixing the inverted `lensSterkte`).
- In-beat: one find; the hint comes after `hintAfterS` or two misses (as today).
- `zoekSummary({ misses, seconds, hinted })` → `{ trials 1, correct: misses ? 0 : 1, misses,
  seconds, hinted }`. Easy = clean, not hinted, `seconds ≤ 8`; fine = clean; hard = ≥ 2
  misses or hinted. (The frisling's 3 s clean find today → easy → level 2.)

### 5.4 Rustkracht (dagnacht): which moments, in which order, held how long

- **Content can vary the moments**: an `Encounter` may carry `slot?: string`; a skin may
  carry `rustPlan?: { slot: string; pick?: number; shuffle?: boolean }[]` (the story's
  slots in order; per slot how many of its encounters to draw, default all; shuffle their
  order, default true). `buildDagnachtTrial(skin, diff, rng)` builds the trial's order from
  it: slots in plan order, each slot's encounters drawn and shuffled by the seed. Rules:
  a flip is **never the first** encounter (the "no" habit must be built first); if the
  pool has a flip the trial keeps at least one; with two flip encounters available and
  band ≥ 4 both may come. No plan → today's content order (unchanged for the six classic
  missions). The 2D floor plays the same order (same seed).
- `ChoiceRun.next()` (additive): the next encounter of the trial, whatever its id; `ask(id)`
  / `still(id)` keep working. A home plays slot by slot: `while (rust.nextIn('wallow'))`.
- **Knobs**: `holdS` [3, 3.5, 4, 4.5, 5, 6], `tempts` [1, 1, 2, 2, 3, 3], `goWaitS`
  [9, 8, 7, 6, 5, 5], `slowmo` band < 3. Under voorlezen off a hold is 0.5 s shorter (as
  today's HOLD_SILENT_S).
- **In-beat** (`hold-math.ts`, pure `RustTempo`): after a reach in this run the next hold
  wants 0.5 s less (≥ 2.5 s, silent); after two clean holds in a row 0.5 s more (≤ the
  band's + 1). Temptations come at seeded moments inside the hold (never in the first
  1.1 s). The summary stays `DagnachtRun`'s `{ trials: encounters, correct: never-wronged }`
  plus `impulses` and `holdS` (the longest held).
- Judgement: easy = all encounters right first time **and** ≤ 1 impulse in body moments;
  fine = accuracy ≥ 0.8; hard = accuracy < 0.5. One step per beat, not per encounter.

### 5.5 Wisselkracht (wisselen)

- Knobs: `sorts` [6, 6, 8, 8, 10, 10], `flipEvery` [4, 4, 3, 3, 3, 2], `flips`
  [1, 1, 1, 2, 2, 2] (a skin's `trials` still caps the sorts for its story).
- `WisselRun` turns the rule after `flipEvery` right sorts; for a second turn the gap
  adapts: if the first sort after the last turn was wrong (a switch error) the next gap is
  one longer (≤ 5), else it stays. Never two turns in a row; the last turn leaves ≥ 2 sorts.
- Summary `{ trials: sorts, correct: right first time, switches, switchErrors }`. Easy = no
  switch error and ≤ 1 wrong; fine = accuracy ≥ 0.8; hard = ≥ 2 switch errors or accuracy
  < 0.6.

### 5.6 The views (who changes what)

- `render2d/*View.ts` (5), `render3d/engines/*3d.ts` (5, the classic stages), and the
  world's beats (`beats/search.ts`, `route.ts`, `callers.ts`, `choice.ts`, `aim.ts`,
  `hold-math.ts`) all build from `store.knobs()` + the play's fork and run the new cores.
  The beats get the knobs **by default** (that is the fix for the echo), with options a
  home may pass (`rounds`, a `visit` show for round 1 only, `glimpse` override for its
  stand). Each beat shows its round's new sequence like today's reshow / re-listen.
- New lines (content/copy.ts, ≤ 7 words, read aloud): another round of the same length
  ("Nog een rondje. Luister goed."), the route's next round ("Kijk, nog een weg."). The
  existing "Goed zo! Nu komt er een bij." stays the grow line.

### 5.7 Parity, per breinkracht (why the 2D floor and the world measure the same thing)

| breinkracht | same builder | same core | same summary for same input | what may differ (and why that is fine) |
|---|---|---|---|---|
| Speurkracht | `buildZoekenTrial(skin, knobs, rng)`: same decoy set and count | `scoreZoeken` / `zoekSummary` | `{1, correct, misses, seconds, hinted}` | the picture (a field vs bracken): the count of look-alikes, how much shows (`glimpse` = 1 − haze) and the hint delay are the same knobs |
| Geheugenkracht | `SpanRun` + `next` from the same fork | `SpanRun` | `{rounds, clean, span, start, eased}` | spots: 7 look-alikes in the PRINT_SPOTS layout (scaled) in both |
| Echokracht | `SpanRun` + appending `next` | `SpanRun` | same | calls + light-up together in both (plays muted) |
| Rustkracht | `buildDagnachtTrial(skin, diff, rng)`: same order | `DagnachtRun` | `{encounters, never-wronged, impulses?}` | a card vs a body moment: the trial and its scoring are one; `holdS` only exists where there is a hold |
| Wisselkracht | `buildWisselTrial(skin, knobs, rng)` | `WisselRun` | `{sorts, right, switches, switchErrors}` | bins vs places, the turn cued in two channels in both |

Tests per engine (`*.parity.test.ts`): for seeds 1..20 and scripted tap sequences
(perfect, one wrong, two wrongs, a wrong after a turn), drive the core as the 2D view
does and as the world beat does (the shared helper each view uses) and assert equal
summaries, plus an independent reference model.

### 5.8 Up is calm, down is silent

On the reward card a grown breinkracht's badge gets a soft rising mark and one line, read
aloud once ("Je Echokracht groeit."). Inside a beat the existing grow line is the only
celebration. An ease is never said, shown or sounded. A level never drops below `floor`.

### 5.9 Growth Floris can read

`__ranger.history()` (dev) and a small panel for grown-ups at the bottom of Instellingen
("Groei", collapsed): per breinkracht the level now, the best, the beats this week and
the best span (corsi, simon) or the median time to find (zoeken), from a pure
`growthSummary(history, now)` (unit-tested). Plain text in the screen's own look; it
never shows a number to the child elsewhere.

## 6. Moods and readable animals (package `moods`)

### 6.1 The dark animals (the named fix, first)

One dressing step for every animal, wherever it is loaded: `dressAnimal(root, id, mood)`
in `AnimalDress.ts`, called from `play/spawn.ts`, `world/Fauna.ts` (roamers and birds) and
`world/Markers.ts` (heroes), replacing their separate `applyCoat` calls:
1. **Matte**: metalness 0 and roughness ≥ 0.75 on every animal material (the CC0 pack
   throws 40% of its diffuse away with no env map).
2. **True colour**: the red deer's near-black body material gets its dossier coat
   (`research/animal-visual-accuracy.md`: summer red-brown) through `COAT_TINT`; any other
   species the measurement shows under the floor gets a sourced tint or an albedo lift
   (the boar: a dark grey-brown that still reads brown, never grey).
3. **An animal fill**: animal materials get one shared uniform (`uAnimalFill`, a colour ×
   intensity) added to their indirect diffuse (`onBeforeCompile`, one program variant),
   so the side away from the low sun is lit like a soft bounce. Each mood sets it.
Acceptance by measurement (the `moods.spec` below): at 20 m and 40 m, in every mood, the
boar, the sow, the red deer, the roe and the fox show their own pixels at **p10 ≥ 22 and
median ≥ 40** (sRGB luma; today the boar is 1-2); at 5 m each still reads as itself (the
lead looks: the boar dark brown, the deer red-brown). Draw calls unchanged.

### 6.2 The five moods (`render3d/Moods.ts`, pure)

| id | feel | key (sun) | fill | fog near/far | sky | animals |
|---|---|---|---|---|---|---|
| gouden-uur | today | warm low, 2.1 | 0.85 cool/warm | 22 / 90 | today's dome | fill lifted |
| ochtendnevel | misty morning | pale gold, low, softer | brighter, neutral | 24 / 55 | pale cream-grey | — |
| zonnig | bright day | white, higher sun | neutral blue | 30 / 110 | clear blue | — |
| bewolkt | overcast, soft | weak key, no hard shadow | strong even fill | 24 / 80 | soft grey-white | — |
| schemer | soft dusk | low rose-amber, dim | cool lilac fill | 22 / 75 | rose to blue | stronger fill |

Each mood is a `LightSet` (hemi, key, fog) + sky stops + fog range + key direction (static
per mood) + `animalFill` + `wind` (grass sway ×1..1.5). Pure tests pin: every mood's
`lightOn` ≥ 0.85× the golden hour's (never dark), fog near ≥ 22 m (a framed beat's
targets ≤ 15 m away are never fogged), the night set unchanged, `lightAt(mood, night, k)`
mixes per mood. `Sky.setMood(id, s)` crossfades the lights, fog and the dome (a second
dome mesh with opacity while it fades, like the night dome: +1 draw call only during a
fade), a cut under reduced motion; `skyState().mood`.

Never dark, stormy or scary: no rain streaks, no thunder, no flicker; a breeze is the
grass swaying a little more. A drizzle is out of scope (motion + cost).

### 6.3 Every target readable in every mood

Decision 1 says a spot at dusk is no harder than one in the sun: the moods spec walks to
each adventure's home and the frisling's search view in every mood (`?mood=`), measures
the animals' own pixels and the target's contrast with what is around it, and saves the
screenshots the lead looks at. A mood that fails a home is fixed in the mood (fill, fog),
never by excluding the home.

## 7. The veldgids and free-roam surprises (package `veldgids`)

### 7.1 The screen

- Opens from the Pauze hub (a fifth tile "Je veldgids", a drawn icon) and in the hut (the
  cabin card gets a "Veldgids" chip). Reuses run 6's card look, keys (Enter = primary,
  Esc = back) and read-aloud rules.
- One page per home (the four adventures and later ones, in story order, named by place:
  "Bij de modderpoel") + "Overal" (free roam); big ◀ ▶ (≥ 56 px, arrow keys too) between
  pages; the page's title read aloud.
- Each page: a grid of entries. **Found**: its picture (the real model rendered as a small
  portrait, cached per session in memory, never in the save; the icon when no model),
  its name, a soft gold rim for a rare one, "nieuw" until he has opened it once. **Not
  found**: the same picture as a grey silhouette, and its one hint line with a 🔊. A row of
  dots says how many of the page are found (a picture, not "3/7").
- Photos (`soort: 'foto'`, the wildcamera's) show in a photo frame.
- The first reveal ever adds one line: where the veldgids is ("Hij zit onder Pauze.").

### 7.2 Free-roam surprises (`world/Surprises.ts`)

- A calm director: in free roam only (on foot or in the jeep; not in a mission, a briefing,
  a menu or the first minute's lessons), at most one surprise at a time, ≥ 45 s apart,
  drawn from the session seed. It stages its animal 12-30 m from the ranger, inside his
  view cone or where he is walking, on ground that suits it, never on the path in front of
  his feet, never moving toward the lens, and takes it away once he is 45 m off or after
  ~60 s. ≤ 2 draw calls each, under the 150 budget.
- Candidates (models and calls that exist): the buizerd gliding low over the heath (mew
  synth), the grote bonte specht drumming on a trunk at the forest edge (drum synth), the
  koekoek calling from a tree (recording; mornings and mist), the winterkoning on a log
  (recording), the roodborst that follows a few hops (recording), the merel; rare: the
  edelhert stag at the forest edge at dusk or in the mist, the das trundling at dusk.
  No wolf, no adder (never scary).
- **Seen** = on screen ≥ 40 px for ≥ 1 s within 35 m; **heard** = its call played within
  25 m of him; either records `wereld.<id>` (`store.discover`) and queues the reveal.
- The existing gliding `bird-buizerd` (Fauna) is one of them, not a second one.

### 7.3 The reveal, polished

Calm (a fade, no bounce), one at a time, never during a held moment (4.4), read aloud,
the 🔊 repeats it, ~4 s, a soft chime (quieter than `found`). Under reduced motion it
simply appears and goes.

## 8. Construct parity in one sentence per breinkracht

Speurkracht: the same seeded decoy set, count, glimpse/haze and hint delay, one find, the
same miss rule. Geheugenkracht and Echokracht: one `SpanRun` (start, growth, replay, ease,
rounds) fed by the same seeded supplier. Rustkracht: one seeded trial order and one
`DagnachtRun`, a card or a hold being two faces of the same choose(goed). Wisselkracht:
one seeded queue and one `WisselRun` with its adaptive turns. Variety (spots, routes,
moods, rares) only ever changes *where* and *what it looks like*, never a knob.

## 9. What I will check when reviewing a package

Always: `RANGER_PORT=<p> npm run gate` tail line; `RANGER_PORT=<p> npm run golden` table
(ALL GREEN) and its screenshots; `npx playwright test e2e/missions.spec.ts --grep <id>`
for every mission the package touches; the unit tests it adds; draw calls < 150 and
triangles in budget; no new runtime dependency; an old save loads; every new string
≤ 7 words and read aloud; no `Math.random` in a home or a core (grep). Then I play it
myself, three plays in a row where it matters, with real keys and mouse, fresh save and
a seeded practised save, at 1280×800, and look at my screenshots.

## 10. Pitfalls (found while scouting; builders read these)

1. `window.__ranger` has no `renderView`: diagnostics that need the scene must add a
   dev-only read (`__ranger.scene()` is fine **read-only**), never mutate from tests.
2. Roamers are unnamed groups: find them by position (`__ranger.ambient()`), not by name;
   `actor-wildzwijn` is a mission actor, not the roamer.
3. The boar walks while you measure: re-read its position before every screenshot.
4. `store.logSession` is also called by the hut's care game (`ui/Companion.ts`) with
   binary summaries: `updateSkill` must fall back to the accuracy staircase there.
5. Changing `trials` semantics (simon/corsi/wisselen now count rounds/sorts) also changes
   `skill.trials`; nothing may key the floor on `trials` any more (use `beats`).
6. `missions.spec`'s finale test and other specs seed saves without the new fields: every
   new field defaults in `load()` (migration-safe), and the first session's mood is the
   golden hour so seeded tests see today's light.
7. Golden's step-6 loop and `missions.spec.playSteps` detect "won" by the trial count
   going up: with rounds counted as trials the count rises by more than one: the loops
   compare `>= need` already; keep them additive.
8. `ChoiceRun.ask(id)` throws on out-of-order ids; a home with a `rustPlan` must use
   `next()`/`nextIn(slot)`.
9. `prepare()` runs under the briefing card BEFORE `runMission`: the play must exist
   there (draw it at the briefing, not at "Ga op pad").
10. The 2D zoeken field's `doel` and decoy x/y are content: the layout from the seed
    replaces them for the field only (content keeps them as the authored default for a
    seed-less call, e.g. old tests).
11. Don't edit `src/` while golden runs in the same worktree (Vite reloads it).
12. `fade.ts` gives fading materials their own copies (`fadeable(root, true)`): the
    animal fill uniform must survive `ownCopy` (copy `onBeforeCompile` + the uniform ref).
13. The sky dome is a baked ramp: a mood crossfade needs a second dome or two ramps
    mixed in the shader; never rebuild textures per frame.
14. The bot's lead walk and the return walk to the frisling marker are slow/stuck under
    the current hints: budget golden time accordingly (game lanes fix the cause).

## 11. Package plan

| id | what the player gets | depends on | runs |
|---|---|---|---|
| `contracts` | nothing visible yet (a quiet "Nieuw in je veldgids" after a win); the shared API every lane builds on | — | first, alone, fast |
| `adaptive` | the echo grows (never two calls and done), every breinkracht starts where he is and grows, routes/searches vary in 2D too, the history fills | contracts | with `moods` |
| `moods` | animals readable at any distance (the named fix), five calm lights across visits | contracts | with `adaptive` |
| `veldgids` | the field guide in the hut, small surprises in the open world, a polished reveal | contracts (its `stemming` rows work on the golden-hour stub and fully once `moods` lands) | after the first of the two lands |
| `feel` (optional) | boarding the jeep from its front no longer swings the lens ~168°; running reads as running | contracts | last, only if time allows |

Priority if time runs short: the dark-animal fix and the echo (adaptive M1) first, then
contracts' variety plumbing used by the game lanes, then the rest of adaptive, moods,
veldgids, feel.
