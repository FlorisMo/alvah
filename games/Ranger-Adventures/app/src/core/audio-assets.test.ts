/**
 * audio-assets.test.ts — mechanical asset gate for the staged ambience/call
 * files (W4.7a). Run: `node --experimental-strip-types src/core/audio-assets.test.ts`
 *
 * Pins the W4.7a acceptance so it can never silently regress: the re-encoded
 * `ambient-heide` bed stays < 1 MB, and every file the manifest names actually
 * exists on disk (a wrong extension / missing file would ship a dead fetch that
 * calls.ts swallows silently — this catches it at build time instead).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const audioDir = fileURLToPath(new URL('../../public/audio/', import.meta.url));
const manifest = JSON.parse(readFileSync(audioDir + 'manifest.json', 'utf8')) as Record<
  string,
  { file: string; kind: string }
>;

test('ambient-heide bed is re-encoded under 1 MB (W4.7a)', () => {
  const entry = manifest['ambient-heide'];
  assert.ok(entry, 'manifest has ambient-heide');
  const bytes = statSync(audioDir + entry.file).size;
  assert.ok(bytes < 1_000_000, `ambient-heide ${bytes} bytes must be < 1 MB`);
});

test('every manifest file exists on disk', () => {
  for (const [id, e] of Object.entries(manifest)) {
    assert.ok(statSync(audioDir + e.file).size > 0, `${id} → ${e.file} present`);
  }
});
