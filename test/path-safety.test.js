'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { isPathInside, isImmediateChildOf, liveSessionAtOrUnder } = require('../lib/path-safety');

// --- isPathInside: equal-or-descendant containment ---------------------------

test('isPathInside: true for a direct child', () => {
  assert.equal(isPathInside('C:/work', 'C:/work/app'), true);
});

test('isPathInside: true for a nested descendant', () => {
  assert.equal(isPathInside('C:/work', 'C:/work/app/src/index.js'), true);
});

test('isPathInside: true for the same path', () => {
  assert.equal(isPathInside('C:/work', 'C:/work'), true);
});

test('isPathInside: false for a sibling that shares a name prefix', () => {
  assert.equal(isPathInside('C:/work/app', 'C:/work/app2'), false);
});

test('isPathInside: false for an unrelated path', () => {
  assert.equal(isPathInside('C:/work', 'C:/Windows/System32'), false);
});

test('isPathInside: false when the child is actually the parent (escape)', () => {
  assert.equal(isPathInside('C:/work/app', 'C:/work'), false);
});

// --- isImmediateChildOf: exactly-one-level-down (the delete confinement) ------

test('isImmediateChildOf: true for a direct child folder', () => {
  assert.equal(isImmediateChildOf('C:/work', 'C:/work/app'), true);
});

test('isImmediateChildOf: false for a grandchild', () => {
  assert.equal(isImmediateChildOf('C:/work', 'C:/work/app/src'), false);
});

test('isImmediateChildOf: false for the parent itself', () => {
  assert.equal(isImmediateChildOf('C:/work', 'C:/work'), false);
});

test('isImmediateChildOf: false for an outside path (System32 attack)', () => {
  assert.equal(isImmediateChildOf('C:/work', 'C:/Windows/System32'), false);
});

test('isImmediateChildOf: false for a prefix-sharing sibling', () => {
  assert.equal(isImmediateChildOf('C:/work/app', 'C:/work/app2'), false);
});

// --- liveSessionAtOrUnder: subfolder-aware live-session guard -----------------

test('liveSessionAtOrUnder: matches a session at the exact target', () => {
  const hit = liveSessionAtOrUnder('C:/work/app', ['C:/work/app']);
  assert.equal(hit, path.resolve('C:/work/app'));
});

test('liveSessionAtOrUnder: matches a session in a subfolder of the target', () => {
  const hit = liveSessionAtOrUnder('C:/work', ['C:/other', 'C:/work/app/sub']);
  assert.equal(hit, path.resolve('C:/work/app/sub'));
});

test('liveSessionAtOrUnder: null when no session is at or under the target', () => {
  assert.equal(liveSessionAtOrUnder('C:/work/app', ['C:/work/other', 'C:/work/app2']), null);
});

test('liveSessionAtOrUnder: ignores empty and non-string entries', () => {
  assert.equal(liveSessionAtOrUnder('C:/work/app', ['', null, undefined, 42]), null);
});

test('liveSessionAtOrUnder: null for an empty or missing list', () => {
  assert.equal(liveSessionAtOrUnder('C:/work/app', []), null);
  assert.equal(liveSessionAtOrUnder('C:/work/app', undefined), null);
});
