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

module.exports = { longPressSelection };
