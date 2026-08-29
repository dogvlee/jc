const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  handleHitRegion,
  longPressSelection,
  nextSelectionId,
  selectionHitDecision,
  selectionTargetSizeMm,
  shouldCycleSelectionOnTap
} = require('../src/core/editor-gesture');

test('holding the sole selected element keeps ordinary single selection', () => {
  assert.deepEqual(longPressSelection(['a'], 'a'), { enterMulti: false, ids: ['a'] });
  assert.deepEqual(longPressSelection([], 'a'), { enterMulti: false, ids: [] });
});

test('holding a distinct second element extends selection and deduplicates the base', () => {
  assert.deepEqual(longPressSelection(['a', 'a'], 'b'), { enterMulti: true, ids: ['a', 'b'] });
});

test('canvas long-press timer uses the pure decision and only toggles multi on enterMulti', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/main.js'), 'utf8');
  assert.match(source, /longPressSelection\(drag\.longPressBaseIds, pressId\)/);
  assert.match(source, /if \(decision\.enterMulti\) \{\s*state\.multiSelect = true;/);
  assert.match(source, /drag\.tapToContent = false;/);
});

test('large touch handles stay outside the content instead of stealing its center', () => {
  // A 2.68 mm-high text box is about 33 px high on the audited phone. Its
  // center is 16.5 px inward from the south handle and must remain tappable.
  assert.equal(handleHitRegion('s', 0, -16.5, 'touch'), false);
  assert.equal(handleHitRegion('s', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('s', 0, 35, 'touch'), true);
  assert.equal(handleHitRegion('s', 0, 37, 'touch'), false);
  assert.equal(handleHitRegion('e', -16.5, 0, 'touch'), false);
  assert.equal(handleHitRegion('e', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('rotate', -16.5, -16.5, 'touch'), false);
  assert.equal(handleHitRegion('rotate', 0, 0, 'touch'), true);
});

test('selection target converts the 44px touch area to label millimetres', () => {
  const document = { widthMm: 40, heightMm: 20 };
  const canvas = { width: 400, height: 200 };
  assert.deepEqual(selectionTargetSizeMm(document, canvas, 'touch'), {
    minWidthMm: 4.4,
    minHeightMm: 4.4
  });
  assert.deepEqual(selectionTargetSizeMm(document, canvas, 'mouse'), {
    minWidthMm: 2,
    minHeightMm: 2
  });
});

test('repeat taps preserve drag first, then cycle through overlap candidates', () => {
  const candidates = [{ id: 'top' }, { id: 'middle' }, { id: 'bottom' }];
  assert.deepEqual(selectionHitDecision(candidates, ''), {
    element: candidates[0],
    candidateIds: ['top', 'middle', 'bottom'],
    cycleOnTap: false
  });
  assert.deepEqual(selectionHitDecision(candidates, 'middle'), {
    element: candidates[1],
    candidateIds: ['top', 'middle', 'bottom'],
    cycleOnTap: true
  });
  assert.equal(nextSelectionId(['top', 'middle', 'bottom'], 'middle'), 'bottom');
  assert.equal(nextSelectionId(['top', 'middle', 'bottom'], 'bottom'), 'top');
});

test('touch and pen cycle overlapping content before opening content edit', () => {
  const overlap = {
    cycleOnTap: true,
    candidateIds: ['top-text', 'bottom-code']
  };
  const single = {
    cycleOnTap: false,
    candidateIds: ['top-text']
  };

  assert.equal(shouldCycleSelectionOnTap(overlap, {
    pointerType: 'touch', contentTapEligible: true
  }), true);
  assert.equal(shouldCycleSelectionOnTap(overlap, {
    pointerType: 'pen', contentTapEligible: true
  }), true);
  assert.equal(shouldCycleSelectionOnTap(single, {
    pointerType: 'touch', contentTapEligible: true
  }), false);
  assert.equal(shouldCycleSelectionOnTap(overlap, {
    pointerType: 'mouse', contentTapEligible: true
  }), false);
  assert.equal(shouldCycleSelectionOnTap(overlap, {
    pointerType: 'mouse', contentTapEligible: true, alternateKey: true
  }), true);
  assert.equal(shouldCycleSelectionOnTap(overlap, {
    pointerType: 'mouse', contentTapEligible: false
  }), true);
});

test('web editor wires accessible hit candidates and stationary overlap cycling', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/main.js'), 'utf8');
  assert.match(source, /hitTestAll\([\s\S]*selectionTargetSizeMm\(/);
  assert.match(source, /cycleCandidateIds:\s*hitDecision\.candidateIds/);
  assert.match(source, /nextSelectionId\(drag\.cycleCandidateIds, state\.selectedId\)/);
  assert.match(source, /!drag\.longPressed && drag\.cycleOnTap/);
  assert.match(source, /shouldCycleSelectionOnTap\(hitDecision, \{[\s\S]*pointerType: event\.pointerType \|\| 'mouse',[\s\S]*contentTapEligible,[\s\S]*alternateKey: event\.altKey/);
});
