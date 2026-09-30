import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icon, ICON_NAMES, CLUE_ICON, type IconName } from './icons.ts';
import { SKILL_META, EF_ENGINES } from '../core/skill.ts';
import { pickWorldBeat, WORLDBEAT_EVERY } from '../core/worldbeat.ts';

test('every icon is a hidden, unfocusable 24-grid line drawing in the text colour', () => {
  for (const n of ICON_NAMES) {
    const svg = icon(n);
    assert.match(svg, /^<svg [^>]*aria-hidden="true"/, `${n}: aria-hidden (never part of a name, never spoken)`);
    assert.match(svg, /focusable="false"/, n);
    assert.match(svg, /viewBox="0 0 24 24"/, n);
    assert.match(svg, /stroke="currentColor"/, n);
    assert.doesNotMatch(svg, /[\p{Extended_Pictographic}]/u, `${n}: drawn, not an emoji`);
  }
});

test('the badges, the clues and Onderweg only name icons that exist', () => {
  const known = new Set<string>(ICON_NAMES);
  for (const e of EF_ENGINES) assert.ok(known.has(SKILL_META[e].icon), `breinkracht ${e}: ${SKILL_META[e].icon}`);
  for (const [soort, n] of Object.entries(CLUE_ICON)) assert.ok(known.has(n), `clue ${soort}: ${n}`);
  for (const occ of [1, 2]) {
    const beat = pickWorldBeat({ patrolTick: WORLDBEAT_EVERY * occ, heading: 'links' })!;
    for (const o of beat.options) assert.ok(known.has(o.icon as IconName), `Onderweg "${o.label}": ${o.icon}`);
  }
});

test('an extra class joins the icon class, it never replaces it', () => {
  assert.match(icon('check', 'big'), /class="ic ic-check big"/);
});
