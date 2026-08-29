/**
 * Narrow compatibility fixes for known defects in the generated online pack.
 *
 * Keep every correction keyed by both template and element ID. This prevents a
 * broad heuristic from changing templates that intentionally use reversed
 * (white-on-black) shapes.
 */
const HOLLOW_RECT_IDS = Object.freeze({
  'online-238996760': ['rect-mskgxb89-23'],
  'online-255640890': ['rect-mskgxb8a-41'],
  'online-317385076': ['rect-mskgxb8a-52'],
  'online-317385298': ['rect-mskgxb8b-62'],
  'online-427426369': ['rect-mskgxb8e-125'],
  'online-427426444': ['rect-mskgxb8e-138'],
  'online-466284092': ['rect-mskgxb8j-225'],
  'online-479426294': ['rect-mskgxb8m-282'],
  'online-501901299': ['rect-mskgxb8u-456'],
  'online-512427649': ['rect-mskgxb94-650']
});

const TABLE_CELL_FIXES = Object.freeze({
  'online-515326439': Object.freeze({
    'table-mskgxb9a-811': ['试剂名称', '氯化钠溶液', '保存位置', '1号柜']
  })
});

const PLACEHOLDER_ELEMENT_IDS = Object.freeze({
  'online-477823830': ['text-mskgxb8m-272']
});

// Editable foreground copy that was accidentally exported as locked. Background
// artwork remains untouched; only the exact text layer is made selectable.
const UNLOCK_ELEMENT_IDS = Object.freeze({
  'online-438734081': ['text-mskgxb8g-182']
});

const LINE_ELEMENT_FIXES = Object.freeze({
  'online-512427665': Object.freeze({
    'line-mskgxb97-726': Object.freeze({
      x: -4.25,
      y: 14.75,
      width: 29,
      height: 0.5,
      rotation: 90
    })
  }),
  'online-515326450': Object.freeze({
    'line-mskgxb9c-847': Object.freeze({
      x: -0.3,
      y: 5.75,
      width: 11.6,
      height: 0.5,
      rotation: 90
    })
  })
});

function applyOnlineTemplateRuntimeFixes(templateId, document) {
  if (!document || !Array.isArray(document.elements)) return document;

  const hollowIds = HOLLOW_RECT_IDS[templateId] || [];
  const unlockIds = UNLOCK_ELEMENT_IDS[templateId] || [];
  const tableFixes = TABLE_CELL_FIXES[templateId] || null;
  const lineFixes = LINE_ELEMENT_FIXES[templateId] || null;

  document.elements.forEach((element) => {
    if (!element || !element.id) return;
    if (element.type === 'barcode' || element.type === 'qrcode') {
      const value = String(element.value == null ? '' : element.value).trim();
      if (!value || value === '123456' || value === '123456789') {
        element.requiresInput = true;
        element.requiresInputReason = value ? 'sample-code' : 'empty-code';
      }
    }
    if (element.type === 'rect' && hollowIds.includes(element.id)) {
      element.filled = false;
    }
    if (unlockIds.includes(element.id)) {
      element.locked = false;
    }
    if (element.type === 'table' && tableFixes && tableFixes[element.id]) {
      element.cells = tableFixes[element.id].slice();
    }
    if (element.type === 'line' && lineFixes && lineFixes[element.id]) {
      Object.assign(element, lineFixes[element.id]);
    }
  });

  const placeholderIds = PLACEHOLDER_ELEMENT_IDS[templateId] || [];
  if (placeholderIds.length > 0) {
    document.elements = document.elements.filter((element) => !(
      element
      && element.type === 'text'
      && placeholderIds.includes(element.id)
      && String(element.text || '').trim() === '双击编辑'
    ));
  }
  return document;
}

module.exports = {
  HOLLOW_RECT_IDS,
  LINE_ELEMENT_FIXES,
  PLACEHOLDER_ELEMENT_IDS,
  TABLE_CELL_FIXES,
  UNLOCK_ELEMENT_IDS,
  applyOnlineTemplateRuntimeFixes
};
