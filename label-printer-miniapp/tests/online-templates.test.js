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
const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');

const miniRoot = path.join(__dirname, '..', 'miniprogram');

test('public catalog excludes crawled packs and labels original versus authorized redesigns', () => {
  assert.equal(templates.length, 22);
  assert.equal(templates.filter((item) => item.source === 'shangyue-original').length, 17);
  assert.equal(templates.filter((item) => item.source === 'shangyue-authorized-redesign').length, 5);
  assert.ok(templates.every((item) => item.releaseApproved === true && item.publicCatalog === true));
  assert.equal(templates.some((item) => item.source === 'online-niim' || item.source === 'niim-import'), false);
  assert.ok(ONLINE_TEMPLATES.length >= 80);
  assert.equal(new Set(templates.map((item) => item.id)).size, templates.length);
});

test('online templates can be resolved and built into editable documents', () => {
  for (const item of ONLINE_TEMPLATES) {
    assert.equal(getOnlineTemplate(item.id).id, item.id);
    const document = buildOnlineDocument(item.id);
    assert.ok(document.elements.length >= 1, item.id);
    const throughLayouts = buildTemplateDocument(item);
    assert.equal(throughLayouts.widthMm, item.size[0]);
    assert.equal(throughLayouts.heightMm, item.size[1]);
    assert.equal(getTemplate(item.id), null);
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
