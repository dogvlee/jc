/**
 * Shangyue's first-party monochrome design system for generated labels.
 *
 * The tokens are deliberately scene based rather than derived from any source
 * template.  They give the 8,100-entry matrix a stable visual identity while
 * keeping every document printable on a 203 dpi thermal printer.
 */

const DESIGN_FAMILIES = Object.freeze([
  Object.freeze({ id: 'signal', label: '信号轨', mark: 'A' }),
  Object.freeze({ id: 'orbit', label: '环行卡', mark: 'B' }),
  Object.freeze({ id: 'ledger', label: '信息栅', mark: 'C' })
]);

const SCENE_CODES = Object.freeze({
  price: 'RT', date: 'DT', name: 'ID', wifi: 'WF', wish: 'WS',
  warehouse: 'WH', cable: 'CB', jewelry: 'JW', garment: 'GM', ship: 'SP',
  medicine: 'MD', card: 'BC', seat: 'ST', bakery: 'BK', plant: 'PL',
  lab: 'LB', asset: 'AS', queue: 'QU', note: 'NT', cert: 'QC',
  material: 'MT', cup: 'CP', seal: 'SL', office: 'OF', info: 'IN'
});

const SCENE_GROUPS = Object.freeze({
  price: 'commerce', jewelry: 'commerce', garment: 'commerce', bakery: 'commerce', cup: 'commerce',
  date: 'care', medicine: 'care', plant: 'care', seal: 'care', wish: 'care',
  warehouse: 'operations', cable: 'operations', ship: 'operations', lab: 'operations',
  asset: 'operations', material: 'operations', cert: 'operations',
  name: 'identity', wifi: 'identity', card: 'identity', seat: 'identity', queue: 'identity',
  note: 'notice', office: 'notice', info: 'notice'
});

const GROUP_FONTS = Object.freeze({
  commerce: 'sy-heiti',
  care: 'sy-mashan',
  operations: 'monospace',
  identity: 'sy-huangyou',
  notice: 'sy-heiti'
});

function designFamily(variant) {
  return DESIGN_FAMILIES[Math.abs(Number(variant) || 0) % DESIGN_FAMILIES.length];
}

function sceneCode(scene) {
  return SCENE_CODES[scene] || 'SY';
}

function sceneGroup(scene) {
  return SCENE_GROUPS[scene] || 'notice';
}

function sceneFont(scene) {
  return GROUP_FONTS[sceneGroup(scene)] || 'sans-serif';
}

function identityLabel(entry) {
  const family = designFamily(entry && entry.variant);
  const serial = String(((Number(entry && entry.serial) || 0) % 99) + 1).padStart(2, '0');
  return `SY/${sceneCode(entry && entry.scene)}-${family.mark}${serial}`;
}

module.exports = {
  DESIGN_FAMILIES,
  GROUP_FONTS,
  SCENE_CODES,
  SCENE_GROUPS,
  designFamily,
  identityLabel,
  sceneCode,
  sceneFont,
  sceneGroup
};
