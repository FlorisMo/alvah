/**
 * gids-math.ts — what the veldgids shows (run 7, design `state/foundation/design.md` §7.1),
 * pure: the table, the save's discoveries and the story order come in, the pages go out.
 * ui/veldgids/Veldgids.ts draws them; the unit test pins the rules.
 *
 * One page per place that has something to discover, in the order the story meets the
 * places (the four adventures first), and "Overal" (the open world, home 'wereld') last.
 * A page keeps its slots in one fixed order (an animal first, then a track, a find, a
 * photo, the rare one last), so a found thing never moves: a collection book, not a list.
 * A thing he found is `found`; one he has not looked at in the gids yet is `nieuw`. Never
 * a count on screen: the page's dots are a picture of how much of it he found.
 */

import type { Ontdekking, OntdekSoort } from '../../content/ontdekkingen';

/** The save's record of one discovery (core/state.ts `Ontdekt`): `g` once seen in the gids. */
export interface GidsSeen { g?: 1 }

export interface GidsEntry {
  o: Ontdekking;
  found: boolean;
  /** found, and not looked at in the gids yet */
  nieuw: boolean;
  rare: boolean;
  foto: boolean;
}

export interface GidsPage {
  /** the home ('wereld' for the open world) */
  home: string;
  entries: GidsEntry[];
  /** how many of its entries are found (the dots; never shown as a number) */
  found: number;
}

/** The slot order on a page. */
const SOORT_RANK: Record<OntdekSoort, number> = { dier: 0, spoor: 1, vondst: 2, foto: 3, zeldzaam: 4 };

/** The open world's home: always the last page. */
export const WERELD = 'wereld';

/**
 * The gids's pages: one per home with rows, in `order` (the mission ids in story order;
 * a home missing from it comes after them, in table order), then the open world.
 */
export function gidsPages(
  table: readonly Ontdekking[],
  found: Readonly<Record<string, GidsSeen | undefined>>,
  order: readonly string[],
): GidsPage[] {
  const homes: string[] = [];
  for (const o of table) if (!homes.includes(o.home)) homes.push(o.home);
  const rank = (h: string): number => (h === WERELD ? Infinity : order.includes(h) ? order.indexOf(h) : order.length + homes.indexOf(h));
  return homes
    .sort((a, b) => rank(a) - rank(b))
    .map((home) => {
      const rows = table.filter((o) => o.home === home);
      const entries = rows
        .map((o, i) => ({ o, i }))
        .sort((a, b) => SOORT_RANK[a.o.soort] - SOORT_RANK[b.o.soort] || a.i - b.i)
        .map(({ o }) => {
          const rec = found[o.id];
          return { o, found: !!rec, nieuw: !!rec && !rec.g, rare: o.soort === 'zeldzaam', foto: o.soort === 'foto' };
        });
      return { home, entries, found: entries.filter((e) => e.found).length };
    });
}

/** The page the gids opens on: the first with something new on it, else `last` (the page
 *  he looked at last this session) when it still exists, else the first. */
export function openingPage(pages: readonly GidsPage[], last: string | null): number {
  const fresh = pages.findIndex((p) => p.entries.some((e) => e.nieuw));
  if (fresh >= 0) return fresh;
  const at = last ? pages.findIndex((p) => p.home === last) : -1;
  return at >= 0 ? at : 0;
}

/** Is anything in the gids new (the Pauze tile and the hut's chip get a small tag)? */
export function anyNieuw(table: readonly Ontdekking[], found: Readonly<Record<string, GidsSeen | undefined>>): boolean {
  return table.some((o) => { const r = found[o.id]; return !!r && !r.g; });
}

/** Page `i` moved by `step`, wrapping round (the arrows and ◀ ▶ never stop at an edge). */
export function turnPage(i: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return (((i + step) % count) + count) % count;
}

/** How many reveals may still say where the veldgids is. */
export const WHERE_REVEALS = 3;

/**
 * Should a reveal add "Je veldgids zit onder Pauze."? Only while he has never looked at his gids
 * (nothing in it has `g`) and fewer than WHERE_REVEALS reveals have shown (`r`): the first
 * reveal ever says it, and the next two too if he has not gone to look.
 */
export function revealSaysWhere(found: Readonly<Record<string, { g?: 1; r?: 1 } | undefined>>): boolean {
  let shown = 0;
  for (const rec of Object.values(found)) {
    if (!rec) continue;
    if (rec.g) return false;
    if (rec.r) shown += 1;
  }
  return shown < WHERE_REVEALS;
}
