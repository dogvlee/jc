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
  if (nextDirection === currentDirection) return element;
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
  changeTextDirection,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  snapElementPosition,
  snapScalar
};
