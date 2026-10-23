/**
 * Serial numbers continue across print jobs: after a job prints N labels, the
 * next job starts where it stopped instead of repeating the same numbers.
 * PrintJobService numbers its pages with the same helpers, so the plan always
 * matches what actually came out of the printer.
 */
const { cloneDocument } = require('./document');
const { syncLinkedCodes } = require('./linked-codes');
const { serialValue } = require('./renderer');

function serialElements(document) {
  const elements = document && Array.isArray(document.elements) ? document.elements : [];
  return elements.filter((element) => element && element.type === 'serial');
}

/** True when the document prints a serial number (one page per label). */
function hasSerialElements(document) {
  return serialElements(document).length > 0;
}

/** Step between consecutive labels; a missing or broken step counts by one. */
function serialStep(element) {
  const step = Number(element.step);
  return Number.isFinite(step) ? step : 1;
}

/** Number printed on the label at `index` (0-based) of one print job. */
function serialNumberAt(element, index) {
  return (Number(element.start) || 0) + index * serialStep(element);
}

function serialTextAt(element, index) {
  return serialValue(Object.assign({}, element, { currentValue: serialNumberAt(element, index) }));
}

/**
 * What to change after `printedLabels` labels of `document` were printed.
 * Returns null when the document has no serial number or nothing printed;
 * otherwise { lastText, nextText, patches: [{ id, start }] }, where the texts
 * are the first serial element's last printed and next value as printed.
 */
function serialAdvancePlan(document, printedLabels) {
  const serials = serialElements(document);
  const printed = Math.trunc(Number(printedLabels));
  if (!serials.length || !Number.isFinite(printed) || printed < 1) return null;
  return {
    lastText: serialTextAt(serials[0], printed - 1),
    nextText: serialTextAt(serials[0], printed),
    patches: serials.map((element) => ({ id: element.id, start: serialNumberAt(element, printed) }))
  };
}

/** A copy of `document` whose serial numbers start where `plan` says. */
function applySerialAdvance(document, plan) {
  const next = cloneDocument(document);
  const patches = plan && Array.isArray(plan.patches) ? plan.patches : [];
  const starts = new Map(patches
    .filter((patch) => patch && Number.isFinite(Number(patch.start)))
    .map((patch) => [String(patch.id), Number(patch.start)]));
  if (!starts.size) return next;
  serialElements(next).forEach((element) => {
    if (!starts.has(String(element.id))) return;
    element.start = starts.get(String(element.id));
    // A stale preview value would hide the new start in the editor.
    element.currentValue = null;
  });
  return syncLinkedCodes(next);
}

module.exports = {
  applySerialAdvance,
  hasSerialElements,
  serialAdvancePlan,
  serialNumberAt,
  serialStep
};
