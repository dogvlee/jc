const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ONLINE_TEMPLATES,
  buildOnlineDocument,
  getOnlineTemplate
} = require('../miniprogram/app/online-templates-pack');
const { templates, getTemplate } = require('../miniprogram/app/catalog');
const {
  buildTemplateDocument,
  LAYOUT_BUILDERS
} = require('../miniprogram/app/template-layouts');

const miniRoot = path.join(__dirname, '..', 'miniprogram');

test('catalog exposes the complete 189-template library', () => {
  assert.equal(templates.length, 189);
  assert.ok(ONLINE_TEMPLATES.length >= 80);
  assert.equal(new Set(templates.map((item) => item.id)).size, templates.length);
});

test('online templates can be resolved and built into editable documents', () => {
  for (const item of ONLINE_TEMPLATES) {
    assert.equal(getOnlineTemplate(item.id).id, item.id);
    assert.equal(typeof LAYOUT_BUILDERS[item.id], 'function');
    const document = buildOnlineDocument(item.id);
    assert.ok(document.elements.length >= 1, item.id);
    const throughCatalog = buildTemplateDocument(getTemplate(item.id));
    assert.equal(throughCatalog.widthMm, item.size[0]);
    assert.equal(throughCatalog.heightMm, item.size[1]);
  }
});

test('all static online image paths resolve to bundled mini-program assets', () => {
  const imageElements = ONLINE_TEMPLATES
    .flatMap((item) => item.document.elements || [])
    .filter((element) => element.type === 'image');
  assert.ok(imageElements.length > 0);
  for (const element of imageElements) {
    assert.doesNotMatch(String(element.path || ''), /文件不存在|null|undefined|not[ _-]?found/i);
    if (String(element.path).startsWith('assets/')) {
      assert.ok(fs.existsSync(path.join(miniRoot, element.path)), element.path);
    }
  }
});
