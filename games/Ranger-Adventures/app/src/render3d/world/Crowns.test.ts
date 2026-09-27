/**
 * Crowns.test.ts — the one tree model the camera and the forest fade share.
 * Run: `node --experimental-strip-types --test src/render3d/world/Crowns.test.ts`
 *
 * Pins review CAM-1 (2026-09-27): the camera counted a crown as "in the way" with one
 * model and the forest faded trees with another, so a line 2.8–3.3 m beside an oak's
 * trunk at crown height read blocked to the camera and was never faded. Now both sides
 * ask these functions, and the shape follows the measured GLBs: an oak's foliage is as
 * wide at the ranger's head height as at its middle, and a trunk in the line blocks too.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { crownOf, insideCrown, blocksLine, leavesFloorAt } from './Crowns.ts';

const OAK_H = 5.4, PINE_H = 6.6;
const oak = crownOf('prop-oak-tree', OAK_H, 0, 0, 0, 7)!;
const pine = crownOf('prop-pine-scots', PINE_H, 0, 0, 0, 3)!;

test('a kind that is not a tree has no crown; a tree keeps its forest index', () => {
  assert.equal(crownOf('prop-boulder', 1, 0, 0, 0, 1), null);
  assert.equal(oak.tree, 7);
  assert.equal(pine.tree, 3);
});

test('a line through an oak\'s foliage, 2.8 and 3.3 m beside the trunk at crown height, is blocked', () => {
  for (const off of [1.5, 2.2, 2.8, 3.3]) {
    const y = OAK_H * 0.56;
    assert.equal(blocksLine(oak, -6, y, off, 6, y - 1, off), true, `offset ${off} m`);
  }
});

test('an oak\'s low foliage hides the ranger\'s head: a line at 1.1 m, 3 m beside the trunk', () => {
  // the lens 6 m out at 2.4 m, his head 6 m past the trunk on the other side
  assert.equal(blocksLine(oak, -6, 2.4, 3, 6, 1.1, 3), true);
});

test('a pine\'s bare trunk only blocks a line that hits it: the leaves start at 0.44 of its height', () => {
  // at 1.5 m height, 0.5 m beside the trunk: under the leaves, clear of the trunk
  assert.equal(blocksLine(pine, -6, 1.5, 0.5, 6, 1.5, 0.5), false);
  // straight through the trunk
  assert.equal(blocksLine(pine, -6, 1.5, 0, 6, 1.5, 0), true);
  // through the foliage (0.6 of the height, 1.2 m out)
  assert.equal(blocksLine(pine, -6, PINE_H * 0.6, 1.2, 6, PINE_H * 0.6, 1.2), true);
});

test('only a tree BETWEEN counts: behind the lens or past the ranger it is a backdrop', () => {
  const y = OAK_H * 0.5;
  // the tree 3 m behind the lens (the line runs away from it)
  assert.equal(blocksLine(oak, 5, y, 0, 15, y, 0), false);
  // the trunk he stands right at (the line meets it only in its last 10 %)
  assert.equal(blocksLine(pine, -10, 1.5, 0.1, 0, 1.5, 0.1), false);
  // …but leaves he stands under DO hide him: the line runs through them for metres
  assert.equal(blocksLine(oak, -30, y, 0, 0.5, y, 0), true);
  // well clear to the side
  assert.equal(blocksLine(oak, -6, y, 5, 6, y, 5), false);
});

test('a lens inside the leaves crosses the tree from its first metre', () => {
  assert.equal(insideCrown(oak, 1, 2, 1, 0), true);
  assert.equal(blocksLine(oak, 1, 2, 1, 10, 1, 1), true);
});

test('inside: the leaves, the trunk, the margin; leavesOnly leaves the trunk out', () => {
  assert.equal(insideCrown(pine, 0.1, 1, 0, 0), true, 'in the trunk');
  assert.equal(insideCrown(pine, 0.1, 1, 0, 0, true), false, 'the trunk is not leaves');
  assert.equal(insideCrown(pine, 1.0, 1, 0, 0), false, 'beside the bare trunk');
  const edge = PINE_H * 0.29 + 0.2; // just outside the widest foliage
  assert.equal(insideCrown(pine, edge, PINE_H * 0.6, 0, 0), false);
  assert.equal(insideCrown(pine, edge, PINE_H * 0.6, 0, 0.3), true, 'grown by a margin');
  assert.equal(insideCrown(pine, 0, PINE_H + 0.5, 0, 0), false, 'above the top');
});

test('the leaves\' underside above a ground point: how high a lens may rise there', () => {
  assert.equal(leavesFloorAt(pine, 1, 0, 0), PINE_H * 0.44);
  assert.equal(leavesFloorAt(oak, 3, 0, 0), OAK_H * 0.14);
  assert.equal(leavesFloorAt(pine, 5, 0, 0), Infinity, 'outside the reach');
});

test('a tree standing on a slope: heights are world heights', () => {
  const k = crownOf('prop-pine-scots', PINE_H, 10, -2, 10, 0)!;
  assert.equal(k.floor, -2 + PINE_H * 0.44);
  assert.equal(k.top, -2 + PINE_H);
  assert.equal(insideCrown(k, 10.5, -2 + PINE_H * 0.6, 10, 0), true);
});
