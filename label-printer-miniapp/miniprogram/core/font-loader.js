const { collectDocumentFontIds, getFontEntry } = require('./font-family');

const loaded = new Set();
const inflight = new Map();

function runtimeHosts(runtime) {
  const host = runtime || {};
  return {
    wx: host.wx || (typeof wx !== 'undefined' ? wx : null),
    FontFace: host.FontFace || (typeof FontFace !== 'undefined' ? FontFace : null),
    document: host.document || (typeof document !== 'undefined' ? document : null)
  };
}

function loadWithWx(entry, wxApi) {
  const files = entry.files || [];
  if (!files.length) return Promise.resolve();
  return files.reduce((chain, file) => chain.then(() => new Promise((resolve, reject) => {
    wxApi.loadFontFace({
      family: entry.family,
      source: `url("${file.url}")`,
      scopes: ['webview', 'native'],
      global: true,
      success: () => resolve(),
      fail: (error) => reject(error || new Error(`Unable to load ${entry.family}`))
    });
  })), Promise.resolve());
}

function loadWithFontFace(entry, FontFaceCtor, documentRef) {
  const files = entry.files || [];
  if (!files.length || !documentRef || !documentRef.fonts) return Promise.resolve();
  return Promise.all(files.map(async (file) => {
    const face = new FontFaceCtor(entry.family, `url("${file.url}")`, {
      weight: String(file.weight || 400),
      display: 'swap'
    });
    const loadedFace = await face.load();
    documentRef.fonts.add(loadedFace);
  })).then(() => undefined);
}

function ensureFont(id, runtime) {
  const entry = getFontEntry(id);
  if (!entry || entry.generic) {
    return Promise.resolve({ id: entry ? entry.id : 'sans-serif', newlyLoaded: false, status: 'generic' });
  }
  if (loaded.has(entry.id)) {
    return Promise.resolve({ id: entry.id, newlyLoaded: false, status: 'ready' });
  }
  if (inflight.has(entry.id)) return inflight.get(entry.id);

  const hosts = runtimeHosts(runtime);
  let task;
  if (hosts.wx && typeof hosts.wx.loadFontFace === 'function') {
    task = loadWithWx(entry, hosts.wx);
  } else if (hosts.FontFace && hosts.document) {
    task = loadWithFontFace(entry, hosts.FontFace, hosts.document);
  } else {
    return Promise.resolve({ id: entry.id, newlyLoaded: false, status: 'unavailable' });
  }

  const pending = task.then(() => {
    loaded.add(entry.id);
    inflight.delete(entry.id);
    return { id: entry.id, newlyLoaded: true, status: 'ready' };
  }, () => {
    inflight.delete(entry.id);
    return { id: entry.id, newlyLoaded: false, status: 'failed' };
  });
  inflight.set(entry.id, pending);
  return pending;
}

function ensureDocumentFonts(documentValue, runtime) {
  const ids = collectDocumentFontIds(documentValue).filter((id) => {
    const entry = getFontEntry(id);
    return entry && !entry.generic;
  });
  if (!ids.length) {
    return Promise.resolve({ newlyLoaded: false, results: [] });
  }
  return Promise.all(ids.map((id) => ensureFont(id, runtime))).then((results) => ({
    newlyLoaded: results.some((item) => item && item.newlyLoaded),
    results
  }));
}

function resetFontLoader() {
  loaded.clear();
  inflight.clear();
}

module.exports = {
  ensureDocumentFonts,
  ensureFont,
  resetFontLoader
};
