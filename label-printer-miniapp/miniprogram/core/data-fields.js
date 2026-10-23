/**
 * The four columns of a data row, in table order. The batch table, CSV
 * import/export, the backup and the template binder all read them here so a
 * column can never exist in one place and be missing in another.
 */
const BATCH_FIELDS = Object.freeze(['name', 'code', 'price', 'date']);

module.exports = { BATCH_FIELDS };
