/**
 * Keep a made/expiry date pair coherent.
 *
 * A companion is a date element whose `linkedFrom` points at the primary date.
 * The primary owns the date semantics; the companion keeps its own geometry and
 * presentation label while mirroring the values that determine the instant.
 */

const LINKED_DATE_FIELDS = Object.freeze([
  'baseTime',
  'autoUpdate',
  'offsetDays',
  'offsetHours',
  'showTime',
  'showSeconds',
  'expireMode',
  'expirePresetHours',
  'format'
]);

function dateElements(documentValue) {
  return Array.isArray(documentValue && documentValue.elements)
    ? documentValue.elements.filter((element) => element && element.type === 'date')
    : [];
}

function findDate(documentValue, elementOrId) {
  if (!elementOrId) return null;
  const id = typeof elementOrId === 'string' ? elementOrId : elementOrId.id;
  if (!id) return null;
  return dateElements(documentValue).find((element) => element.id === id) || null;
}

/** Return the canonical primary for either a primary or a companion. */
function linkedPrimary(documentValue, elementOrId) {
  const element = findDate(documentValue, elementOrId);
  if (!element) return null;
  if (!element.linkedFrom) return element;
  return findDate(documentValue, element.linkedFrom) || element;
}

function companionDates(documentValue, primaryOrId) {
  const primary = linkedPrimary(documentValue, primaryOrId);
  if (!primary) return [];
  return dateElements(documentValue).filter((element) => element.linkedFrom === primary.id);
}

function copyDateSemantics(primary, companion) {
  LINKED_DATE_FIELDS.forEach((field) => {
    if (primary[field] !== undefined) companion[field] = primary[field];
    else delete companion[field];
  });
  companion.dateRole = 'expire';
  companion.label = '保质期至';
  companion.linkedFrom = primary.id;
  // A fixed value on a companion bypasses expiry arithmetic in the renderer.
  companion.fixedValue = '';
  return companion;
}

/**
 * Synchronize companions for one date (or all dates when no source is given).
 * Invalid/orphan companions are removed so deleting a primary cannot leave a
 * stale date rendered on the canvas.
 */
function syncLinkedDates(documentValue, source) {
  if (!documentValue || !Array.isArray(documentValue.elements)) return documentValue;
  const dates = dateElements(documentValue);
  const validIds = new Set(dates.map((element) => element.id));

  // First discard links to deleted/non-date elements. This also handles a
  // primary deletion performed by the generic delete action.
  documentValue.elements = documentValue.elements.filter((element) => (
    !element || !element.linkedFrom || validIds.has(element.linkedFrom)
  ));

  const primary = source ? linkedPrimary(documentValue, source) : null;
  const primaries = primary
    ? [primary]
    : dateElements(documentValue).filter((element) => !element.linkedFrom);

  primaries.forEach((item) => {
    const companions = dateElements(documentValue).filter((element) => element.linkedFrom === item.id);
    item.linkedExpire = companions.length > 0;
    companions.forEach((companion) => copyDateSemantics(item, companion));
  });
  return documentValue;
}

/** Remove the whole relationship when called with either side of the pair. */
function unlinkDate(documentValue, source) {
  if (!documentValue || !Array.isArray(documentValue.elements)) return documentValue;
  const primary = linkedPrimary(documentValue, source);
  if (!primary) return documentValue;
  primary.linkedExpire = false;
  // Keep the primary and remove only its companions.
  documentValue.elements = documentValue.elements.filter((element) => (
    element.id === primary.id || element.linkedFrom !== primary.id
  ));
  return documentValue;
}

module.exports = {
  LINKED_DATE_FIELDS,
  companionDates,
  copyDateSemantics,
  linkedPrimary,
  syncLinkedDates,
  unlinkDate
};
