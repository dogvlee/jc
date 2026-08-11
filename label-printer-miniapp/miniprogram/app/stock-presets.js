/** Common offline label stock sizes (mm). Clean-room presets, not OEM SKUs. */
const STOCK_PRESETS = [
  { id: '40x12', widthMm: 40, heightMm: 12, name: 'T40×12 线缆/小标' },
  { id: '30x12', widthMm: 30, heightMm: 12, name: 'T30×12 线号' },
  { id: '40x20', widthMm: 40, heightMm: 20, name: 'T40×20 药签' },
  { id: '40x30', widthMm: 40, heightMm: 30, name: 'T40×30 价签' },
  { id: '50x30', widthMm: 50, heightMm: 30, name: 'T50×30 常用' },
  { id: '50x40', widthMm: 50, heightMm: 40, name: 'T50×40 物流' },
  { id: '60x40', widthMm: 60, heightMm: 40, name: 'T60×40 货架' },
  { id: '70x50', widthMm: 70, heightMm: 50, name: 'T70×50 大标' }
];

function stockLabel(widthMm, heightMm, dpi) {
  const w = Math.round(Number(widthMm) || 0);
  const h = Math.round(Number(heightMm) || 0);
  const res = dpi || 203;
  return `T${w}×${h} ${res} 空白标签`;
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
