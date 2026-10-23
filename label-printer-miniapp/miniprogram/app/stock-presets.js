/** Common offline label stock sizes (mm). Clean-room presets, not OEM SKUs. */
const STOCK_PRESETS = [
  { id: '40x12', widthMm: 40, heightMm: 12, name: '40×12 线缆/小标' },
  { id: '30x12', widthMm: 30, heightMm: 12, name: '30×12 线号' },
  { id: '40x20', widthMm: 40, heightMm: 20, name: '40×20 药签' },
  { id: '40x30', widthMm: 40, heightMm: 30, name: '40×30 价签' },
  { id: '50x30', widthMm: 50, heightMm: 30, name: '50×30 常用' },
  { id: '50x40', widthMm: 50, heightMm: 40, name: '50×40 物流' },
  { id: '60x40', widthMm: 60, heightMm: 40, name: '60×40 货架' },
  { id: '70x50', widthMm: 70, heightMm: 50, name: '70×50 大标' }
];

function formatMm(value) {
  return String(Math.round((Number(value) || 0) * 10) / 10);
}

/** Plain paper name for shop owners, e.g. “40×12 mm 标签纸”. */
function stockLabel(widthMm, heightMm) {
  return `${formatMm(widthMm)}×${formatMm(heightMm)} mm 标签纸`;
}

function findPreset(widthMm, heightMm) {
  const w = Number(widthMm);
  const h = Number(heightMm);
  return STOCK_PRESETS.find((item) => item.widthMm === w && item.heightMm === h) || null;
}

module.exports = {
  STOCK_PRESETS,
  findPreset,
  stockLabel
};
