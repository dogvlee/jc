const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { formatDateValue } = require('../miniprogram/core/renderer');
const {
  companionDates,
  linkedPrimary,
  syncLinkedDates,
  unlinkDate
} = require('../miniprogram/core/date-links');

function linkedDocument() {
  const documentValue = createDocument(60, 30);
  const primary = createElement('date', documentValue);
  primary.id = 'date-primary';
  const companion = createElement('date', documentValue);
  companion.id = 'date-expiry';
  companion.linkedFrom = primary.id;
  companion.x = 30;
  companion.y = 20;
  documentValue.elements = [primary, companion];
  return { documentValue, primary, companion };
}

test('linked date synchronization mirrors all time semantics and preserves companion geometry', () => {
  const { documentValue, primary, companion } = linkedDocument();
  const geometry = { x: companion.x, y: companion.y, width: companion.width, height: companion.height };
  Object.assign(primary, {
    baseTime: '2026-08-09T08:30:00.000Z',
    autoUpdate: false,
    offsetDays: 3,
    offsetHours: 5,
    showTime: false,
    showSeconds: false,
    expireMode: 'custom',
    expirePresetHours: 49,
    format: 'YYYY/MM/DD'
  });

  syncLinkedDates(documentValue, primary);

  for (const field of ['baseTime', 'autoUpdate', 'offsetDays', 'offsetHours', 'showTime', 'showSeconds', 'expireMode', 'expirePresetHours', 'format']) {
    assert.equal(companion[field], primary[field], field);
  }
  assert.equal(companion.dateRole, 'expire');
  assert.equal(companion.label, '保质期至');
  assert.equal(companion.fixedValue, '');
  assert.deepEqual(
    { x: companion.x, y: companion.y, width: companion.width, height: companion.height },
    geometry
  );
  assert.equal(primary.linkedExpire, true);
});

test('syncing from a companion resolves and updates its primary relationship', () => {
  const { documentValue, primary, companion } = linkedDocument();
  primary.offsetDays = 7;
  companion.offsetDays = -99;

  assert.equal(linkedPrimary(documentValue, companion), primary);
  syncLinkedDates(documentValue, companion);
  assert.equal(companion.offsetDays, 7);
  assert.deepEqual(companionDates(documentValue, companion), [companion]);
});

test('a synchronized expiry companion computes from the primary base and offset', () => {
  const { documentValue, primary, companion } = linkedDocument();
  Object.assign(primary, {
    baseTime: new Date(2026, 7, 9, 10, 0, 0).toISOString(),
    autoUpdate: false,
    offsetDays: 2,
    expirePresetHours: 24,
    showTime: false
  });
  syncLinkedDates(documentValue, primary);

  assert.match(
    formatDateValue(companion, new Date(2026, 0, 1)),
    /保质期至：2026年08月12日/
  );
});

test('normalization removes an orphan companion after its primary is deleted', () => {
  const { documentValue, primary, companion } = linkedDocument();
  documentValue.elements = documentValue.elements.filter((element) => element !== primary);
  syncLinkedDates(documentValue);
  assert.deepEqual(documentValue.elements, []);
  assert.equal(companionDates(documentValue, companion).length, 0);
});

test('normalization clears the primary link flag when the companion is deleted', () => {
  const { documentValue, primary, companion } = linkedDocument();
  primary.linkedExpire = true;
  documentValue.elements = documentValue.elements.filter((element) => element !== companion);
  syncLinkedDates(documentValue);
  assert.equal(primary.linkedExpire, false);
});

test('unlinking from either side removes companions but keeps the primary date', () => {
  const { documentValue, primary, companion } = linkedDocument();
  primary.linkedExpire = true;
  unlinkDate(documentValue, companion);
  assert.deepEqual(documentValue.elements, [primary]);
  assert.equal(primary.linkedExpire, false);
});
