const test = require('node:test');
const assert = require('node:assert/strict');

const { templates } = require('../miniprogram/app/catalog');
const { buildTemplateDocument, LAYOUT_BUILDERS } = require('../miniprogram/app/template-layouts');
const { formatDateValue } = require('../miniprogram/core/renderer');

function documentFor(id) {
  return buildTemplateDocument(templates.find((item) => item.id === id));
}

test('every catalog template has a layout builder and valid geometry', () => {
  for (const template of templates) {
    assert.equal(typeof LAYOUT_BUILDERS[template.id], 'function', `missing builder for ${template.id}`);
    const document = buildTemplateDocument(template);
    assert.equal(document.name, template.name);
    assert.equal(document.widthMm, template.size[0]);
    assert.equal(document.heightMm, template.size[1]);
    assert.ok(document.elements.length >= 1, `${template.id} should have elements`);
    for (const element of document.elements) {
      assert.ok(element.width > 0 && element.height > 0, `${template.id}/${element.type} size`);
      assert.ok(element.x + element.width <= document.widthMm + 0.05, `${template.id} x overflow`);
      assert.ok(element.y + element.height <= document.heightMm + 0.05, `${template.id} y overflow`);
    }
  }
});

test('product price template includes barcode and dual prices', () => {
  const document = buildTemplateDocument(templates.find((item) => item.id === 'product-simple'));
  assert.ok(document.elements.some((item) => item.type === 'barcode'));
  assert.ok(document.elements.some((item) => String(item.text || '').includes('¥')));
});

test('wifi template encodes WIFI QR payload', () => {
  const document = buildTemplateDocument(templates.find((item) => item.id === 'wifi-code'));
  const qr = document.elements.find((item) => item.type === 'qrcode');
  assert.ok(qr);
  assert.match(qr.value, /^WIFI:/);
});

test('shelf-life templates compute their expiry instead of printing a frozen date', () => {
  const cases = [
    ['home-date', 24 * 7],
    ['catering-date', 4],
    ['medicine-box', 24 * 365]
  ];
  for (const [id, hours] of cases) {
    const document = documentFor(id);
    const expiry = document.elements.find((item) => item.type === 'date' && item.dateRole === 'expire');
    assert.ok(expiry, `${id} should carry an expiry date element`);
    assert.equal(expiry.expireMode, 'preset');
    assert.equal(expiry.expirePresetHours, hours);

    // No text element may hold a literal date that would print stale.
    for (const element of document.elements) {
      if (element.type !== 'text') continue;
      assert.doesNotMatch(String(element.text || ''), /\d{4}-\d{2}(-\d{2})?/, `${id} has a hardcoded date`);
    }

    const base = new Date(expiry.baseTime);
    const rendered = formatDateValue(expiry);
    const expected = new Date(base.getTime() + hours * 3600000);
    assert.ok(
      rendered.includes(String(expected.getFullYear())),
      `${id} expiry ${rendered} should follow the label's own base time`
    );
  }
});

test('date elements sitting next to their own caption do not repeat the label', () => {
  for (const id of ['home-date', 'catering-date']) {
    const document = documentFor(id);
    for (const element of document.elements.filter((item) => item.type === 'date')) {
      assert.equal(element.label, '', `${id} date element should not re-print its caption`);
    }
  }
});

test('clothing tag actually describes a garment', () => {
  const document = documentFor('clothing-tag');
  const text = document.elements.filter((item) => item.type === 'text').map((item) => item.text).join(' ');
  assert.match(text, /尺码/);
  assert.match(text, /款号/);
  assert.doesNotMatch(text, /LOTION|乳液|纯露/i);
  assert.ok(document.elements.some((item) => item.type === 'barcode'));
});
