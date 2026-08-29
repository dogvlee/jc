const { buildDocument, buildOwnedLibraryIndex, catalogMeta } = require('./factory');

// The 8,100 entries are a deterministic scene/size/copy/style matrix. Building
// the compact index here avoids shipping a ~1.7 MiB generated JSON file in the
// WeChat main package while preserving stable lookup behavior.
const LIBRARY_INDEX = buildOwnedLibraryIndex();

const byId = new Map(LIBRARY_INDEX.map((entry) => [entry.id, entry]));

function getLibraryEntry(id) {
  return byId.get(id) || null;
}

function buildLibraryDocument(id) {
  const entry = getLibraryEntry(id);
  return entry ? buildDocument(entry) : null;
}

function listLibraryMeta() {
  return LIBRARY_INDEX.map(catalogMeta);
}

function queryLibraryMeta(options) {
  const opts = options || {};
  const sceneLabel = String(opts.sceneLabel || opts.scene || '').trim();
  const size = String(opts.size || '').trim();
  const query = String(opts.query || '').trim().toLowerCase();
  const offset = Math.max(0, Number(opts.offset) || 0);
  const limit = Math.max(1, Number(opts.limit) || 24);
  const matched = LIBRARY_INDEX.filter((entry) => {
    if (sceneLabel && sceneLabel !== '全部' && entry.title !== sceneLabel && entry.scene !== sceneLabel) return false;
    if (size && size !== '全部' && `${entry.widthMm}×${entry.heightMm}` !== size) return false;
    if (!query) return true;
    return [
      entry.name,
      entry.title,
      entry.item,
      entry.scene,
      entry.category,
      entry.sceneCode,
      entry.designFamilyLabel
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });
  return {
    total: matched.length,
    offset,
    limit,
    items: matched.slice(offset, offset + limit).map(catalogMeta)
  };
}

function librarySceneChips() {
  const counts = new Map();
  LIBRARY_INDEX.forEach((entry) => {
    counts.set(entry.title, (counts.get(entry.title) || 0) + 1);
  });
  return ['全部'].concat([...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh'))
    .map((entry) => entry[0]));
}

function librarySizeChips() {
  const counts = new Map();
  LIBRARY_INDEX.forEach((entry) => {
    const key = `${entry.widthMm}×${entry.heightMm}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return ['全部'].concat([...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map((entry) => entry[0]));
}

function libraryStats() {
  const scenes = {};
  const sizes = {};
  LIBRARY_INDEX.forEach((entry) => {
    scenes[entry.scene] = (scenes[entry.scene] || 0) + 1;
    const key = `${entry.widthMm}x${entry.heightMm}`;
    sizes[key] = (sizes[key] || 0) + 1;
  });
  return {
    total: LIBRARY_INDEX.length,
    scenes,
    sizeCount: Object.keys(sizes).length
  };
}

module.exports = {
  LIBRARY_INDEX,
  buildLibraryDocument,
  catalogMeta,
  getLibraryEntry,
  librarySceneChips,
  librarySizeChips,
  libraryStats,
  listLibraryMeta,
  queryLibraryMeta
};
