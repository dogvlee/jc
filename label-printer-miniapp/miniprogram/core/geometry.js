const { legacyDirectionForMode, normalizeTextMode } = require('./text-direction');
const { ROTATE_HANDLE_GAP, handleHitRegion, rotateHandleLocal } = require('./editor-gesture');

function degreesToRadians(value) {
  return Number(value || 0) * Math.PI / 180;
}

function normalizeAngleDelta(value) {
  return ((Number(value) + 540) % 360) - 180;
}

function pointerAngle(point, center) {
  return Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
}

function changeTextDirection(element, direction, document) {
  const nextDirection = direction === 'vertical' ? 'vertical' : 'horizontal';
  const currentDirection = element.direction === 'vertical' ? 'vertical' : 'horizontal';
  if (nextDirection === currentDirection) {
    element.textMode = nextDirection;
    return element;
  }
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  let width;
  let height;
  if (nextDirection === 'vertical') {
    element.directionLayout = {
      horizontalWidth: element.width,
      horizontalHeight: element.height
    };
    width = Math.min(element.height, document.widthMm);
    height = Math.min(element.width, document.heightMm);
  } else {
    width = Math.min(element.directionLayout?.horizontalWidth || element.height, document.widthMm);
    height = Math.min(element.directionLayout?.horizontalHeight || element.width, document.heightMm);
    delete element.directionLayout;
  }
  element.width = Math.max(0.1, width);
  element.height = Math.max(0.1, height);
  element.x = Math.max(0, Math.min(centerX - element.width / 2, document.widthMm - element.width));
  element.y = Math.max(0, Math.min(centerY - element.height / 2, document.heightMm - element.height));
  element.direction = nextDirection;
  element.textMode = nextDirection;
  return element;
}

function changeTextMode(element, mode, document) {
  const nextMode = normalizeTextMode(mode);
  const nextDirection = legacyDirectionForMode(nextMode);
  const currentDirection = legacyDirectionForMode(normalizeTextMode(element));
  // Reuse the legacy dimension swap only when the mode changes orientation.
  if (currentDirection !== nextDirection) {
    element.direction = currentDirection;
    changeTextDirection(element, nextDirection, document);
  } else {
    element.direction = nextDirection;
  }
  element.textMode = nextMode;
  return element;
}

function resizeRotatedElement(original, handle, worldDelta, minimumSize) {
  const minSize = Math.max(0.1, Number(minimumSize) || 1);
  const angle = degreesToRadians(original.rotation);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const localDeltaX = worldDelta.x * cosine + worldDelta.y * sine;
  const localDeltaY = -worldDelta.x * sine + worldDelta.y * cosine;

  let left = -original.width / 2;
  let right = original.width / 2;
  let top = -original.height / 2;
  let bottom = original.height / 2;

  if (handle.includes('w')) left = Math.min(right - minSize, left + localDeltaX);
  if (handle.includes('e')) right = Math.max(left + minSize, right + localDeltaX);
  if (handle.includes('n')) top = Math.min(bottom - minSize, top + localDeltaY);
  if (handle.includes('s')) bottom = Math.max(top + minSize, bottom + localDeltaY);

  const localCenterX = (left + right) / 2;
  const localCenterY = (top + bottom) / 2;
  const centerX = original.x + original.width / 2
    + localCenterX * cosine - localCenterY * sine;
  const centerY = original.y + original.height / 2
    + localCenterX * sine + localCenterY * cosine;
  const width = right - left;
  const height = bottom - top;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  };
}

/**
 * Promote the content-fitted selection rectangle to the element's real box
 * before a handle drag. This keeps the visible blue handle under the pointer
 * instead of resizing an invisible, wider text container.
 */
function fitElementToSelectionBounds(element, fitValue) {
  const fit = fitValue || element?._fit;
  if (!element || !fit || !Number.isFinite(fit.left) || !Number.isFinite(fit.top)
    || !Number.isFinite(fit.w) || !Number.isFinite(fit.h)) return false;
  const width = Math.max(0.1, Number(element.width) || 0.1);
  const height = Math.max(0.1, Number(element.height) || 0.1);
  const nextWidth = Math.max(0.1, width * fit.w);
  const nextHeight = Math.max(0.1, height * fit.h);
  const localCenterX = -width / 2 + width * fit.left + nextWidth / 2;
  const localCenterY = -height / 2 + height * fit.top + nextHeight / 2;
  const angle = degreesToRadians(element.rotation);
  const worldCenterX = element.x + width / 2
    + localCenterX * Math.cos(angle) - localCenterY * Math.sin(angle);
  const worldCenterY = element.y + height / 2
    + localCenterX * Math.sin(angle) + localCenterY * Math.cos(angle);
  element.x = worldCenterX - nextWidth / 2;
  element.y = worldCenterY - nextHeight / 2;
  element.width = nextWidth;
  element.height = nextHeight;
  element.selectionFit = false;
  delete element._fit;
  return true;
}

// The selection box in the element's own frame (mm from its centre): the
// painted text block for content-fitted text, otherwise the element box.
function selectionBox(element) {
  const width = Math.max(0.1, Number(element && element.width) || 0.1);
  const height = Math.max(0.1, Number(element && element.height) || 0.1);
  const fit = element && element._fit;
  if (!fit || !Number.isFinite(fit.left) || !Number.isFinite(fit.top)
    || !Number.isFinite(fit.w) || !Number.isFinite(fit.h)) {
    return { left: -width / 2, top: -height / 2, width, height };
  }
  return {
    left: -width / 2 + fit.left * width,
    top: -height / 2 + fit.top * height,
    width: fit.w * width,
    height: fit.h * height
  };
}

/**
 * Handle positions in the element's own frame: e (stretch the width), s
 * (stretch the height), se (scale as a whole) and rotate. `layout` ({ gapMm,
 * labelWidthMm, labelHeightMm }) places the rotate handle like the renderer
 * draws it; without it the handle sits 3 mm above the box.
 */
function selectionContentHandles(element, layout) {
  const box = selectionBox(element);
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const rotate = layout
    ? rotateHandleLocal(element, box, layout.gapMm, layout.labelWidthMm, layout.labelHeightMm)
    : { x: box.left + box.width / 2, y: box.top - 3 };
  return {
    box,
    e: { x: right, y: box.top + box.height / 2 },
    s: { x: box.left + box.width / 2, y: bottom },
    se: { x: right, y: bottom },
    rotate
  };
}

const HANDLE_MODES = Object.freeze({ e: 'resize-e', s: 'resize-s', se: 'scale', rotate: 'rotate' });

function localPoint(element, point) {
  const width = Math.max(0.1, Number(element.width) || 0.1);
  const height = Math.max(0.1, Number(element.height) || 0.1);
  const dx = Number(point.x) - (Number(element.x) + width / 2);
  const dy = Number(point.y) - (Number(element.y) + height / 2);
  const angle = degreesToRadians(element.rotation);
  return {
    x: dx * Math.cos(angle) + dy * Math.sin(angle),
    y: -dx * Math.sin(angle) + dy * Math.cos(angle)
  };
}

/** Millimetre-tolerance hit test of the handles (kept for callers without a canvas). */
function selectionHandleMode(element, point, tolerance) {
  if (!element || !point) return 'move';
  const local = localPoint(element, point);
  const handles = selectionContentHandles(element);
  const limit = Math.max(0.1, Number(tolerance) || 1);
  const near = (target) => Math.abs(local.x - target.x) <= limit && Math.abs(local.y - target.y) <= limit;
  const hit = ['se', 'rotate', 'e', 's'].find((name) => near(handles[name]));
  return hit ? HANDLE_MODES[hit] : 'move';
}

/**
 * Hit the four visible selection handles in CSS pixels. The editor draws the
 * handles at a fixed visual size, so a millimetre tolerance becomes too small
 * on narrow labels and too large on wide labels. Keeping this calculation in
 * CSS pixels makes the touch target consistently about 44 px on every label.
 */
function selectionHandleModeAtPoint(element, point, document, canvasRect, pointerType) {
  if (!element || element.locked || !point || !document || !canvasRect) return 'move';
  const widthMm = Number(document.widthMm);
  const heightMm = Number(document.heightMm);
  const cssWidth = Number(canvasRect.width);
  const cssHeight = Number(canvasRect.height);
  if (!(widthMm > 0) || !(heightMm > 0) || !(cssWidth > 0) || !(cssHeight > 0)) return 'move';

  const pixelsPerMm = (cssWidth / widthMm + cssHeight / heightMm) / 2;
  const handles = selectionContentHandles(element, {
    gapMm: ROTATE_HANDLE_GAP / pixelsPerMm,
    labelWidthMm: widthMm,
    labelHeightMm: heightMm
  });
  const local = localPoint(element, point);
  const box = handles.box;
  // Preserve a movable/selectable centre even when a tiny element's 44 px
  // handle targets overlap almost its entire visual footprint.
  if (local.x > box.left && local.x < box.left + box.width
    && local.y > box.top && local.y < box.top + box.height) return 'move';
  let best = null;
  Object.keys(HANDLE_MODES).forEach((name) => {
    const target = handles[name];
    const deltaX = (local.x - target.x) * pixelsPerMm;
    const deltaY = (local.y - target.y) * pixelsPerMm;
    if (!handleHitRegion(name, deltaX, deltaY, pointerType || 'touch')) return;
    const distance = deltaX * deltaX + deltaY * deltaY;
    if (!best || distance < best.distance) best = { distance, mode: HANDLE_MODES[name] };
  });
  return best ? best.mode : 'move';
}

// Sizes inside an element that grow and shrink with it when it is scaled as a
// whole (text size and spacing, and the digits under a barcode), with the
// ranges a saved label keeps (DOCUMENT_LIMITS in services/repository.js).
const SCALED_SIZE_RANGES = Object.freeze({
  fontSize: [0.5, 25],
  letterSpacing: [-20, 20],
  lineSpacing: [-5, 10]
});
const FONT_SIZE_RANGE_MM = SCALED_SIZE_RANGES.fontSize;

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Scale an element as a whole from its bottom-right corner: the top-left
 * corner stays put, width and height keep their ratio, and text sizes grow
 * with the box. The scale stops where the box would leave the label, and at
 * `minimumSize` mm for the shorter side. Returns the new box plus the scaled
 * size fields the element has.
 */
function scaleRotatedElement(original, worldDelta, document, minimumSize) {
  const width = Math.max(0.1, Number(original.width) || 0.1);
  const height = Math.max(0.1, Number(original.height) || 0.1);
  const angle = degreesToRadians(original.rotation);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const localDeltaX = worldDelta.x * cosine + worldDelta.y * sine;
  const localDeltaY = -worldDelta.x * sine + worldDelta.y * cosine;
  // The dragged corner, projected onto the box diagonal.
  let factor = ((width + localDeltaX) * width + (height + localDeltaY) * height) / (width * width + height * height);
  // The limits only stop a change: an element already thinner than the
  // minimum, or with text outside the range, keeps its size when touched
  // instead of jumping to the limit.
  factor = Math.max(factor, Math.min(1, Math.max(0.1, Number(minimumSize) || 1) / Math.min(width, height)));
  const fontSize = Number(original.fontSize);
  if (fontSize > 0) {
    factor = Math.max(factor, Math.min(1, FONT_SIZE_RANGE_MM[0] / fontSize));
    factor = Math.min(factor, Math.max(1, FONT_SIZE_RANGE_MM[1] / fontSize));
  }
  const anchorX = original.x + width / 2 + (-width / 2) * cosine - (-height / 2) * sine;
  const anchorY = original.y + height / 2 + (-width / 2) * sine + (-height / 2) * cosine;
  const place = (scale) => {
    const nextWidth = width * scale;
    const nextHeight = height * scale;
    const centerX = anchorX + (nextWidth / 2) * cosine - (nextHeight / 2) * sine;
    const centerY = anchorY + (nextWidth / 2) * sine + (nextHeight / 2) * cosine;
    return { x: centerX - nextWidth / 2, y: centerY - nextHeight / 2, width: nextWidth, height: nextHeight };
  };
  const fits = (box) => {
    if (!document) return true;
    const bounds = rotatedElementBounds(Object.assign({ rotation: original.rotation }, box));
    const slack = 1e-6;
    return bounds.left >= -slack && bounds.top >= -slack
      && bounds.right <= Number(document.widthMm) + slack && bounds.bottom <= Number(document.heightMm) + slack;
  };
  if (factor > 1 && !fits(place(factor))) {
    let low = 1;
    let high = factor;
    if (!fits(place(low))) {
      factor = 1;
    } else {
      for (let step = 0; step < 24; step += 1) {
        const middle = (low + high) / 2;
        if (fits(place(middle))) low = middle;
        else high = middle;
      }
      factor = low;
    }
  }
  const result = place(factor);
  Object.keys(SCALED_SIZE_RANGES).forEach((field) => {
    const value = Number(original[field]);
    if (!Number.isFinite(value) || value === 0) return;
    const range = SCALED_SIZE_RANGES[field];
    // Only stop a change: a value already outside its range stays as it was.
    const low = Math.min(range[0], value);
    const high = Math.max(range[1], value);
    result[field] = round2(Math.max(low, Math.min(high, value * factor)));
  });
  return result;
}

function rotatedElementBounds(element) {
  const width = Math.max(0.1, Number(element && element.width) || 0.1);
  const height = Math.max(0.1, Number(element && element.height) || 0.1);
  const angle = degreesToRadians(element && element.rotation);
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const centerX = (Number(element && element.x) || 0) + width / 2;
  const centerY = (Number(element && element.y) || 0) + height / 2;
  const halfExtentX = (cosine * width + sine * height) / 2;
  const halfExtentY = (sine * width + cosine * height) / 2;
  return {
    left: centerX - halfExtentX,
    right: centerX + halfExtentX,
    top: centerY - halfExtentY,
    bottom: centerY + halfExtentY
  };
}

/**
 * Clamp one shared translation for a selection. Applying clampElement to each
 * item separately makes elements pile up at an edge and destroys spacing.
 */
function clampGroupDelta(originals, document, delta) {
  const items = Array.isArray(originals) ? originals.filter(Boolean) : [];
  const requestedX = Number(delta && delta.x) || 0;
  const requestedY = Number(delta && delta.y) || 0;
  const documentWidth = Number(document && document.widthMm);
  const documentHeight = Number(document && document.heightMm);
  if (!items.length || !(documentWidth > 0) || !(documentHeight > 0)) {
    return { x: requestedX, y: requestedY };
  }
  const bounds = items.map(rotatedElementBounds);
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  const minimumX = -left;
  const maximumX = documentWidth - right;
  const minimumY = -top;
  const maximumY = documentHeight - bottom;
  const clampAxis = (value, minimum, maximum) => {
    if (minimum > maximum) return 0;
    return Math.max(minimum, Math.min(value, maximum));
  };
  return {
    x: clampAxis(requestedX, minimumX, maximumX),
    y: clampAxis(requestedY, minimumY, maximumY)
  };
}

/**
 * Snap a value to the nearest target within threshold (mm).
 * Returns { value, snapped, guide }.
 */
function snapScalar(value, targets, threshold) {
  const limit = Number.isFinite(threshold) ? threshold : 0.4;
  let best = null;
  targets.forEach((target) => {
    const distance = Math.abs(value - target);
    if (distance <= limit && (!best || distance < best.distance)) {
      best = { target, distance };
    }
  });
  if (!best) return { value, snapped: false, guide: null, distance: Infinity };
  return { value: best.target, snapped: true, guide: best.target, distance: best.distance };
}

/**
 * Snap element edges/centers to document bounds, document center, and other elements.
 * Mutates element x/y when moving as a group is not used — single-element position snap.
 */
function snapElementPosition(element, document, others, threshold) {
  const limit = Number.isFinite(threshold) ? threshold : 0.45;
  const xTargets = [0, document.widthMm / 2, document.widthMm];
  const yTargets = [0, document.heightMm / 2, document.heightMm];
  (others || []).forEach((other) => {
    if (!other || other.id === element.id) return;
    xTargets.push(other.x, other.x + other.width / 2, other.x + other.width);
    yTargets.push(other.y, other.y + other.height / 2, other.y + other.height);
  });

  const left = element.x;
  const right = element.x + element.width;
  const centerX = element.x + element.width / 2;
  const top = element.y;
  const bottom = element.y + element.height;
  const centerY = element.y + element.height / 2;

  const guides = [];
  let nextX = element.x;
  let nextY = element.y;

  const leftSnap = snapScalar(left, xTargets, limit);
  const rightSnap = snapScalar(right, xTargets, limit);
  const centerXSnap = snapScalar(centerX, xTargets, limit);
  // Prefer edge snap over center when both match.
  if (leftSnap.snapped && (!centerXSnap.snapped || leftSnap.distance <= centerXSnap.distance)
    && (!rightSnap.snapped || leftSnap.distance <= rightSnap.distance)) {
    nextX = leftSnap.value;
    guides.push({ axis: 'v', pos: leftSnap.guide });
  } else if (rightSnap.snapped && (!centerXSnap.snapped || rightSnap.distance <= centerXSnap.distance)) {
    nextX = rightSnap.value - element.width;
    guides.push({ axis: 'v', pos: rightSnap.guide });
  } else if (centerXSnap.snapped) {
    nextX = centerXSnap.value - element.width / 2;
    guides.push({ axis: 'v', pos: centerXSnap.guide });
  }

  const topSnap = snapScalar(top, yTargets, limit);
  const bottomSnap = snapScalar(bottom, yTargets, limit);
  const centerYSnap = snapScalar(centerY, yTargets, limit);
  if (topSnap.snapped && (!centerYSnap.snapped || topSnap.distance <= centerYSnap.distance)
    && (!bottomSnap.snapped || topSnap.distance <= bottomSnap.distance)) {
    nextY = topSnap.value;
    guides.push({ axis: 'h', pos: topSnap.guide });
  } else if (bottomSnap.snapped && (!centerYSnap.snapped || bottomSnap.distance <= centerYSnap.distance)) {
    nextY = bottomSnap.value - element.height;
    guides.push({ axis: 'h', pos: bottomSnap.guide });
  } else if (centerYSnap.snapped) {
    nextY = centerYSnap.value - element.height / 2;
    guides.push({ axis: 'h', pos: centerYSnap.guide });
  }

  return { x: nextX, y: nextY, guides };
}

module.exports = {
  SCALED_SIZE_RANGES,
  changeTextDirection,
  changeTextMode,
  clampGroupDelta,
  fitElementToSelectionBounds,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  scaleRotatedElement,
  selectionContentHandles,
  selectionHandleMode,
  selectionHandleModeAtPoint,
  snapElementPosition,
  snapScalar
};
