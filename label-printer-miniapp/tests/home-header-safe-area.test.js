const test = require('node:test');
const assert = require('node:assert/strict');

let pageDefinition;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

function loadHome(t, api) {
  const previousWx = global.wx;
  const previousGetApp = global.getApp;
  global.wx = api;
  global.getApp = () => ({ globalData: { repository: {} } });
  t.after(() => {
    global.wx = previousWx;
    global.getApp = previousGetApp;
  });
  const page = Object.assign({}, pageDefinition, {
    data: { ...pageDefinition.data },
    setData(patch) { Object.assign(this.data, patch); },
    bindConnectionState() {},
    refresh() {}
  });
  page.onLoad();
  return page;
}

test('home header clears the native capsule on a notched phone', (t) => {
  const page = loadHome(t, {
    getWindowInfo: () => ({ safeArea: { top: 47 }, statusBarHeight: 47 }),
    getMenuButtonBoundingClientRect: () => ({ top: 51, bottom: 83 })
  });
  assert.equal(page.data.safeTop, 47);
  assert.equal(page.data.headerTop, 95);
});

test('home header uses legacy status-bar metrics and stays below the capsule', (t) => {
  const page = loadHome(t, {
    getSystemInfoSync: () => ({ statusBarHeight: 20 }),
    getMenuButtonBoundingClientRect: () => ({ top: 24, bottom: 56 })
  });
  assert.equal(page.data.headerTop, 68);
});

test('home header reserves a navigation row when the capsule API is absent', (t) => {
  const page = loadHome(t, {
    getWindowInfo: () => ({ safeArea: { top: 44 } })
  });
  assert.equal(page.data.headerTop, 88);
});

test('home header can load when device and capsule metrics throw', (t) => {
  const page = loadHome(t, {
    getWindowInfo() { throw new Error('device metrics unavailable'); },
    getMenuButtonBoundingClientRect() { throw new Error('capsule unavailable'); }
  });
  assert.equal(page.data.safeTop, 24);
  assert.equal(page.data.headerTop, 68);
  assert.equal(page.data.capsuleInset, 102, 'the title bars still keep a standard capsule clear');
});

test('route title bars are centred on the capsule and end before it on any window width', (t) => {
  // A wide window (iPad, PC): the capsule is further from the edge than on a phone.
  const page = loadHome(t, {
    getWindowInfo: () => ({ windowWidth: 768, safeArea: { top: 24 }, statusBarHeight: 24 }),
    getMenuButtonBoundingClientRect: () => ({ top: 28, bottom: 60, left: 650, right: 737 })
  });
  assert.equal(page.data.heroTop, 22, '28 + 16 - 22: the 44px bar is centred on the capsule');
  assert.equal(page.data.capsuleInset, 126, '768 - 650 + 8 px of air');
});

test('route title bars keep a standard capsule clear when its left edge is unusable', (t) => {
  for (const menu of [{ top: 24, bottom: 56 }, { top: 24, bottom: 56, left: 0 }, { top: 24, bottom: 56, left: 400 }]) {
    const page = loadHome(t, {
      getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
      getMenuButtonBoundingClientRect: () => menu
    });
    assert.equal(page.data.capsuleInset, 102, JSON.stringify(menu));
  }
});

test('home header ignores invalid capsule coordinates', (t) => {
  const page = loadHome(t, {
    getWindowInfo: () => ({ statusBarHeight: 20 }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 0 })
  });
  assert.equal(page.data.headerTop, 64);
});
