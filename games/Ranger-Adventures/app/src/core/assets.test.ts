/**
 * assets.test.ts — seeded unit test for the pure base-path joiner.
 * Run: `node --experimental-strip-types --test src/core/assets.test.ts`
 *
 * Covers: root base passes the path through unchanged; a `/ranger/` base
 * prefixes every variant; no double slash regardless of trailing/leading
 * slashes; bare (no-leading-slash) paths join too; absolute + protocol-relative
 * URLs pass through untouched; trailing slash on a directory path is preserved
 * (the draco decoder dir); determinism.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { joinBase } from './assets.ts';

test('root base leaves an absolute app path unchanged', () => {
  assert.equal(joinBase('/', '/models/manifest.json'), '/models/manifest.json');
  assert.equal(joinBase('/', '/draco/'), '/draco/');
});

test('a /ranger/ base prefixes the path', () => {
  assert.equal(joinBase('/ranger/', '/models/manifest.json'), '/ranger/models/manifest.json');
  assert.equal(joinBase('/ranger/', '/audio/raaf.webm'), '/ranger/audio/raaf.webm');
});

test('never produces a double slash', () => {
  assert.equal(joinBase('/ranger/', '/draco/'), '/ranger/draco/');
  // base without a trailing slash still joins cleanly
  assert.equal(joinBase('/ranger', '/models/x.glb'), '/ranger/models/x.glb');
  assert.ok(!joinBase('/ranger/', '/models/x.glb').includes('//'));
});

test('bare (no leading slash) paths join too', () => {
  assert.equal(joinBase('/ranger/', 'models/x.glb'), '/ranger/models/x.glb');
  assert.equal(joinBase('/', 'models/x.glb'), '/models/x.glb');
});

test('preserves a trailing slash on a directory path', () => {
  assert.equal(joinBase('/ranger/', '/draco/'), '/ranger/draco/');
  assert.equal(joinBase('/', '/draco/'), '/draco/');
});

test('absolute + protocol-relative URLs pass through untouched', () => {
  assert.equal(joinBase('/ranger/', 'https://cdn.example/x.glb'), 'https://cdn.example/x.glb');
  assert.equal(joinBase('/ranger/', 'data:audio/webm;base64,AAAA'), 'data:audio/webm;base64,AAAA');
  assert.equal(joinBase('/ranger/', 'blob:abcd'), 'blob:abcd');
  assert.equal(joinBase('/ranger/', '//cdn.example/x.glb'), '//cdn.example/x.glb');
});

test('deterministic', () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(joinBase('/ranger/', '/models/x.glb'), '/ranger/models/x.glb');
  }
});
