const TEXT_MODE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'horizontal', label: '横向', asset: 'text_mode_horizontal_cn.svg', orientation: 'horizontal' }),
  Object.freeze({ id: 'horizontal-90', label: '横向旋转', asset: 'text_mode_horizontal_90_cn.svg', orientation: 'horizontal' }),
  Object.freeze({ id: 'horizontal-90-words-rotate', label: '横向字旋转', asset: 'text_mode_horizontal_90_words_rotate_cn.svg', orientation: 'horizontal' }),
  Object.freeze({ id: 'vertical', label: '竖向', asset: 'text_mode_vertical_cn.svg', orientation: 'vertical' }),
  Object.freeze({ id: 'vertical-words-rotate', label: '竖向字旋转', asset: 'text_mode_vertical_words_rotate_cn.svg', orientation: 'vertical' }),
  Object.freeze({ id: 'arc', label: '弧形', asset: 'text_mode_arc_cn.svg', orientation: 'horizontal' })
]);

const TEXT_MODE_IDS = new Set(TEXT_MODE_OPTIONS.map((option) => option.id));

function normalizeTextMode(value) {
  if (value && typeof value === 'object') {
    if (TEXT_MODE_IDS.has(value.textMode)) return value.textMode;
    return value.direction === 'vertical' ? 'vertical' : 'horizontal';
  }
  return TEXT_MODE_IDS.has(value) ? value : 'horizontal';
}

function legacyDirectionForMode(mode) {
  return TEXT_MODE_OPTIONS.find((option) => option.id === normalizeTextMode(mode))?.orientation === 'vertical'
    ? 'vertical'
    : 'horizontal';
}

function clampTextArcAngle(value, fallback = 180) {
  const number = Number(value);
  const resolved = Number.isFinite(number) ? number : Number(fallback);
  return Math.max(0, Math.min(180, Number.isFinite(resolved) ? resolved : 180));
}

module.exports = {
  TEXT_MODE_OPTIONS,
  clampTextArcAngle,
  legacyDirectionForMode,
  normalizeTextMode
};
