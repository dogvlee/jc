/**
 * Single source of truth for every canvas-drawn editor chrome color/stroke.
 * Editor visuals only — label content (text/barcode/QR/shape/table/picture
 * inks) is painted by renderer.js and intentionally never reads these.
 */
const BLUE = '#2F6BFF';
const CHROME = Object.freeze({
  selection: BLUE,
  selectionFill: 'rgba(47, 107, 255, 0.08)',
  selectionWidth: 1.5,
  locked: 'rgba(47, 107, 255, 0.45)',
  handleRadius: 5,
  handleFill: '#FFFFFF',
  handleRing: BLUE,
  handleRingWidth: 2,
  handleArrow: BLUE,
  handleArrowWidth: 1.5,
  guide: BLUE,
  guideWidth: 1,
  guideDash: [4, 3],
  guideLabel: 'rgba(47, 107, 255, 0.75)',
  guideLabelFont: '9px system-ui, sans-serif',
  paperMargin: BLUE,
  paperMarginDash: [4, 3],
  multiSelect: BLUE,
  multiSelectWidth: 1,
  multiSelectDash: [6, 4],
  dateDash: [5, 3],
  backdrop: '#EDEFF2',
  paper: '#FFFFFF',
  ink: '#1A1C1E'
});

/**
 * Decide whether a hold gesture should enter multi-select.
 * Holding the sole selected element is a drag affordance, not a multi-select command.
 * Holding a different second element extends the pre-gesture selection.
 */
function longPressSelection(baseIds, pressId) {
  const ids = Array.from(new Set((Array.isArray(baseIds) ? baseIds : []).filter(Boolean)));
  if (!pressId || ids.length === 0 || ids.includes(pressId)) {
    return { enterMulti: false, ids };
  }
  return { enterMulti: true, ids: [...ids, pressId] };
}

/**
 * Keep the mobile resize target large without letting its inward half cover the
 * selected element's content. The target is a full 44 px square for touch,
 * shifted outside the relevant edge; mouse gets a precise 28 px target.
 */
function handleHitRegion(name, deltaX, deltaY, pointerType) {
  const coarse = pointerType === 'touch' || pointerType === 'pen';
  const radius = coarse ? 22 : 14;
  const inward = coarse ? 8 : 6;
  const outward = radius * 2 - inward;
  if (name === 'e') {
    return deltaX >= -inward && deltaX <= outward && Math.abs(deltaY) <= radius;
  }
  if (name === 's') {
    return Math.abs(deltaX) <= radius && deltaY >= -inward && deltaY <= outward;
  }
  if (name === 'rotate') {
    return deltaX >= -inward && deltaX <= outward && deltaY >= -inward && deltaY <= outward;
  }
  return false;
}

module.exports = { CHROME, handleHitRegion, longPressSelection };
