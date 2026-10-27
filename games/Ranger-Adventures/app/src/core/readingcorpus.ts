/**
 * readingcorpus.ts — every child-facing string the game shows or reads aloud, walked
 * out of the content (moved here from core/readlevel.test.ts, 2026-10-27). Two users:
 * the read-level test lints it (M3/E3, one line ≤ 7 words), and `npm run voice`
 * (scripts/voice.mjs) records Benjamin saying it. Not part of the game's bundle.
 */

import { zinnen, type LabeledText } from './readlevel.ts';
import { AREA_VELUWE, ANIMALS } from '../content/veluwe.ts';
import { ROEP_COPY, ROEP_VOGELS } from '../engines/roep.ts';
import { SAY, TITLE, MAKER } from '../content/screens.ts';
import { BENJAMIN, LES, BESTURING, MENTOR_NAAM, metNaam } from '../content/mentor.ts';
import * as COPY from '../content/copy.ts';
import { AVATAR_KENMERKEN, KENMERK_LABEL, NAAM_SUGGESTIES } from './avatar.ts';
import { SKILL_META, tierFor } from './skill.ts';
import { FASE_META, KUNSTJE_META, ZORG_STAPPEN, OPVANG_GASTEN, COMPANION_SOORTEN } from './companion.ts';
import { pickWorldBeat, withAnimal } from './worldbeat.ts';
import { ONTDEKKINGEN, OOK_HIER } from '../content/ontdekkingen.ts';
import { countWords } from './readlevel.ts';

export const MISSIONS = (AREA_VELUWE as any).missies as any[];
/** The longest mission title, the longest names: a template is judged at its longest. */
const LONGEST = (xs: string[]): string => xs.reduce((a, b) => (countWords(b) > countWords(a) ? b : a), '');
const SAMPLE: Record<string, string | number> = {
  naam: 'Alvah', mentor: MENTOR_NAAM, raaf: LONGEST([...COPY.RAAF_NAMEN]), wie: 'de nachtzwaluw',
  titel: LONGEST(MISSIONS.map((m) => m.titel)), landschap: 'Stuifzand', gebied: 'Veluwe',
  hoofdstuk: 'Kraamtijd', telling: '1/3', n: 10, m: 12, woord: 'wintervoorraad', stap: 'wisselen',
  richting: 'achter je', dier: 'wild zwijn', gast: 'nachtzwaluw', reden: LONGEST(OPVANG_GASTEN.map((g) => g.reden)),
  fase: LONGEST(Object.values(FASE_META).map((f) => f.label)), kunstje: 'Scout', stop: 'stop met luisteren', aantal: 'negen',
  kracht: 'Geheugenkracht', s: 12, // run 7: the reward's "Je {kracht} groeit.", the Groei panel's seconds
};

export interface Entry extends LabeledText {
  shown: boolean;
  /** Its words were filled in with a sample (a title, an animal): the real line differs. */
  sample?: boolean;
}

/** Every string in a group of the copy deck, deep, with its templates filled in. A key
 *  starting with `zeg` (or the SAY group) is only spoken: only the sentence rule. */
function deck(label: string, v: unknown, spoken: boolean, out: Entry[]): void {
  if (typeof v === 'string') {
    out.push({ label, text: COPY.vul(metNaam(v, 'Alvah'), SAMPLE), shown: !spoken, sample: /\{(?!naam\})\w+\}/.test(v) });
  } else if (typeof v === 'function') {
    out.push({ label, text: String((v as (n: string) => string)('Alvah')), shown: !spoken });
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => deck(`${label}[${i}]`, x, spoken, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) deck(`${label}.${k}`, x, spoken || /^zeg/.test(k), out);
  }
}

/** Collect every child-facing string the game shows or reads aloud. `shown`: it is drawn
 *  as ONE line (the line check applies). */
export function readingCorpus(): Entry[] {
  const E: Entry[] = [];
  const push = (label: string, t: unknown, shown = false, sample = false) => {
    if (typeof t === 'string' && t.trim().length > 0) E.push({ label, text: t, shown, sample });
  };
  const a = AREA_VELUWE as any;
  push('area.kort', a.kort);
  for (const m of a.missies ?? []) {
    // a title shows on one line: in a tag, the chip, "Speel mee: …" (filled in below)
    push(`${m.id}.titel`, m.titel, true);
    push(`${m.id}.kort`, m.kort);
    push(`${m.id}.payoff`, m.payoff);
    // briefing lines, the reunion, facts and clues are drawn one sentence a line (zinnen)
    (m.briefing?.simpel ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.simpel[${i}]`, s));
    (m.briefing?.knap ?? []).forEach((s: string, i: number) => push(`${m.id}.brief.knap[${i}]`, s));
    push(`${m.id}.beloning.badgeNaam`, m.beloning?.badgeNaam, true);
    push(`${m.id}.beloning.vakterm`, m.beloning?.vaktermBadge?.naam, true);
    push(`${m.id}.reunion`, m.reunion?.tekst);
    (m.stappen ?? []).forEach((st: any, si: number) => {
      const c = st.skin?.copy ?? {};
      for (const k of Object.keys(c)) push(`${m.id}.step${si}.${k}`, c[k]);
      push(`${m.id}.step${si}.feit`, st.skin?.feit);
      // run 7 (words-ree): the step's other facts (one a play, drawn one sentence a line)
      (st.skin?.meerFeiten ?? []).forEach((f: string, j: number) => push(`${m.id}.step${si}.meerFeiten[${j}]`, f));
      // a choice is a button: one line
      (st.skin?.encounters ?? []).forEach((e: any) => (e.opties ?? []).forEach((o: any, oi: number) => push(`${m.id}.step${si}.${e.id}.optie[${oi}]`, o.label, true)));
      // run 7 (words-ree): a moment's question, its good words and what a wrong act did are
      // each shown as ONE line (the adventure's strip, the card's question, the 2D toast)
      for (const e of st.skin?.encounters ?? []) {
        for (const k of ['vraag', 'vraagKnap', 'uitleg', 'uitlegKnap', 'gevolg', 'gevolgKnap']) push(`${m.id}.step${si}.${e.id}.${k}`, e[k], true);
      }
    });
    // the adventure's lines (MISSIONS lane): one objective line, chip or prompt each
    for (const tier of ['simpel', 'knap']) {
      for (const [k, t] of Object.entries(m.avontuur?.[tier] ?? {})) push(`${m.id}.avontuur.${tier}.${k}`, t, true);
    }
  }
  const vb = a.verhaalboog;
  if (vb) {
    for (const k of Object.keys(vb.clues ?? {})) {
      push(`clue.${k}.titel`, vb.clues[k].titel, true);
      push(`clue.${k}.tekst`, vb.clues[k].tekst);
    }
    (vb.ontknoping ?? []).forEach((o: any, i: number) => push(`ontknoping[${i}]`, o.tekst));
    for (const h of vb.hoofdstukken ?? []) push(`hoofdstuk.${h.n}`, h.naam, true);
    push('finale.kicker', vb.finale?.kicker, true);
    push('finale.titel', vb.finale?.titel, true);
    (vb.finale?.regels ?? []).forEach((r: string, i: number) => push(`finale.regel[${i}]`, r, true));
  }
  for (const id of Object.keys(ANIMALS as any)) {
    const an = (ANIMALS as any)[id];
    push(`animal.${id}.naam`, an.naam, true);
    (an.feiten ?? []).forEach((f: string, i: number) => push(`animal.${id}.feit[${i}]`, f));
    (an.veiligheid ?? []).forEach((f: string, i: number) => push(`animal.${id}.veilig[${i}]`, f));
  }
  // W6.4a "Ken je roep" — UI-copy + de roep-omschrijvingen van elke vogel.
  for (const k of Object.keys(ROEP_COPY)) push(`roep.${k}`, (ROEP_COPY as any)[k]);
  for (const v of ROEP_VOGELS) { push(`roep.vogel.${v.id}.naam`, v.naam); push(`roep.vogel.${v.id}.roep`, v.roep); }
  // the front door (screens.ts): the title, the maker; SAY is only spoken
  deck('title', TITLE, false, E);
  deck('maker', MAKER, false, E);
  deck('say', SAY, true, E);
  // Benjamin, the lessons, the "Zo speel je" card (mentor.ts)
  deck('bram', BENJAMIN, false, E);
  deck('les', LES, false, E);
  deck('besturing', BESTURING, false, E);
  // the copy deck of every shared screen (copy.ts)
  for (const [group, v] of Object.entries(COPY)) if (typeof v !== 'function') deck(`copy.${group}`, v, false, E);
  // what core modules show: the maker's choices, the breinkracht badges and their steps,
  // the raaf (its stages, tricks, care steps), the opvang's guests, Onderweg's beats
  for (const [k, label] of Object.entries(KENMERK_LABEL)) push(`avatar.${k}`, label, true);
  for (const [k, opts] of Object.entries(AVATAR_KENMERKEN)) (opts as { label: string }[]).forEach((o, i) => push(`avatar.${k}[${i}]`, o.label, true));
  NAAM_SUGGESTIES.forEach((n, i) => push(`avatar.naam[${i}]`, n, true));
  for (const [e, meta] of Object.entries(SKILL_META)) { push(`skill.${e}.naam`, meta.naam, true); push(`skill.${e}.taak`, meta.taak, true); }
  for (const best of [1, 3, 5]) push(`skill.tier.${best}`, tierFor(best).naam, true);
  for (const [f, meta] of Object.entries(FASE_META)) { push(`raaf.fase.${f}`, meta.label, true); push(`raaf.fase.${f}.kort`, meta.kort, true); }
  for (const [k, meta] of Object.entries(KUNSTJE_META)) push(`raaf.kunstje.${k}`, COPY.vul(meta.uitleg, SAMPLE), true, /\{\w+\}/.test(meta.uitleg));
  for (const [f, stappen] of Object.entries(ZORG_STAPPEN)) stappen.forEach((st) => { push(`zorg.${f}.${st.id}`, st.label, true); push(`zorg.${f}.${st.id}.zin`, st.zin, true); });
  COMPANION_SOORTEN.raaf.namen.forEach((n, i) => push(`raaf.naam[${i}]`, n, true));
  // run 7: the veldgids (content/ontdekkingen.ts): each name and hint line is shown on one
  // line and read aloud
  for (const o of ONTDEKKINGEN) {
    push(`ontdekking.${o.id}.naam`, o.naam, true);
    push(`ontdekking.${o.id}.naamKnap`, o.naamKnap, true);
    push(`ontdekking.${o.id}.hint`, o.hint, true);
  }
  // (where an animal he knows from another page is met on this one: a softened tile's line)
  for (const [id, line] of Object.entries(OOK_HIER)) push(`ontdekking.${id}.ookHier`, line, true);
  for (const tick of [3, 6]) {
    const b = pickWorldBeat({ patrolTick: tick, heading: 'links' });
    if (!b) continue;
    // the prompt is drawn one sentence a line (zinnen), its options are buttons
    zinnen(withAnimal(b, SAMPLE.dier as string).prompt).forEach((z, i) => push(`onderweg.${tick}.prompt[${i}]`, z, true, true));
    b.options.forEach((o, i) => push(`onderweg.${tick}.optie[${i}]`, o.label, true));
  }
  return E;
}
