const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureDocumentFonts, ensureFont, resetFontLoader } = require('../src/core/font-loader');

test('font loader is a no-op without FontFace or wx and never throws', async () => {
  resetFontLoader();
  const generic = await ensureFont('sans-serif');
  assert.equal(generic.status, 'generic');
  assert.equal(generic.newlyLoaded, false);

  const remote = await ensureFont('sy-heiti');
  assert.equal(remote.status, 'unavailable');
  assert.equal(remote.newlyLoaded, false);

  const batch = await ensureDocumentFonts({
    elements: [
      { type: 'text', fontFamily: 'ZT201' },
      { type: 'text', fontFamily: 'serif' }
    ]
  });
  assert.equal(batch.newlyLoaded, false);
  assert.equal(batch.results.length, 1);
});

test('font loader uses FontFace when the browser runtime is present', async () => {
  resetFontLoader();
  const added = [];
  class FakeFontFace {
    constructor(family, source, descriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
    }
    async load() { return this; }
  }
  const result = await ensureFont('sy-mashan', {
    FontFace: FakeFontFace,
    document: { fonts: { add(face) { added.push(face); } } }
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.newlyLoaded, true);
  assert.equal(added[0].family, 'Ma Shan Zheng');
  assert.match(added[0].source, /ma-shan-zheng/);
  assert.doesNotMatch(added[0].source, /ZT195/);
});

test('new free fonts load on demand and failed downloads are not cached as ready', async () => {
  resetFontLoader();
  const added = [];
  let attempts = 0;
  class FlakyFontFace {
    constructor(family, source) {
      this.family = family;
      this.source = source;
    }
    async load() {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return this;
    }
  }
  const runtime = {
    FontFace: FlakyFontFace,
    document: { fonts: { add(face) { added.push(face); } } }
  };
  const failed = await ensureFont('sy-lubrifont-sc', runtime);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.newlyLoaded, false);

  const retried = await ensureFont('sy-lubrifont-sc', runtime);
  assert.equal(retried.status, 'ready');
  assert.equal(retried.newlyLoaded, true);
  assert.equal(attempts, 2);
  assert.match(added[0].source, /fontsource\/fonts\/wdxl-lubrifont-sc@5\.3\.0/);
});
