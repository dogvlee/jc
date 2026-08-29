const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureDocumentFonts, ensureFont, resetFontLoader } = require('../miniprogram/core/font-loader');

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

test('font loader uses wx.loadFontFace for canvas-native scope', async () => {
  resetFontLoader();
  const calls = [];
  const wx = {
    loadFontFace(options) {
      calls.push(options);
      options.success();
    }
  };
  const result = await ensureFont('sy-heiti', { wx });
  assert.equal(result.status, 'ready');
  assert.equal(result.newlyLoaded, true);
  assert.ok(calls.length >= 1);
  assert.equal(calls[0].family, 'Noto Sans SC');
  assert.match(calls[0].source, /cdn\.jsdelivr\.net/);
  assert.deepEqual(calls[0].scopes, ['webview', 'native']);
  assert.doesNotMatch(calls[0].source, /ZT201|HarmonyOS/);

  const again = await ensureFont('sy-heiti', { wx });
  assert.equal(again.newlyLoaded, false);
  assert.equal(calls.length, 2);
});

test('new free fonts load on demand and failed downloads are not cached as ready', async () => {
  resetFontLoader();
  const calls = [];
  const wx = {
    loadFontFace(options) {
      calls.push(options);
      if (calls.length === 1) options.fail(new Error('offline'));
      else options.success();
    }
  };
  const failed = await ensureFont('sy-lubrifont-sc', { wx });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.newlyLoaded, false);
  assert.match(calls[0].source, /fontsource\/fonts\/wdxl-lubrifont-sc@5\.3\.0/);

  const retried = await ensureFont('sy-lubrifont-sc', { wx });
  assert.equal(retried.status, 'ready');
  assert.equal(retried.newlyLoaded, true);
  assert.equal(calls.length, 2);
});
