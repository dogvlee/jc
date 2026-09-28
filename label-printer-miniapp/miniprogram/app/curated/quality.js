/**
 * Automated quality gate for the generated Shangyue template library.
 *
 * This module deliberately does not know how a template is generated. It can
 * therefore audit the current factory, a future AI-assisted generator, or an
 * imported candidate before that candidate is admitted to the public pack.
 */
const { codePrintMetrics } = require('../../core/code-quality');
const { formatDateValue, serialValue } = require('../../core/renderer');
const { normalizeTextMode } = require('../../core/text-direction');
const { lineWidthMm } = require('./text-metrics');

// Any fixed moment works: printed dates keep the same length every day.
const SAMPLE_TIME = new Date(2026, 8, 28, 14, 30);

const CONTENT_TYPES = new Set(['text', 'date', 'serial', 'table', 'barcode', 'qrcode', 'image', 'material']);
const TEXT_TYPES = new Set(['text', 'date', 'serial', 'table']);
const CODE_TYPES = new Set(['barcode', 'qrcode']);
// Strokes, fills and grids: the element kinds that print as a solid black
// edge when the label drifts under the print head.
const INK_TYPES = new Set(['rect', 'line', 'table']);
const EDGE_EPSILON_MM = 0.001;

const DEFAULT_RULES = Object.freeze({
  dpi: 203,
  minimumDotsPerModule: 2,
  boundsToleranceMm: 0.08,
  minimumElementWidthMm: 0.5,
  minimumElementHeightMm: 0.5,
  minimumTextFontSizeMm: 2.2,
  minimumQrSizeMm: 10.8,
  qrSquareToleranceMm: 0.2,
  minimumBarcodeWidthMm: 24.8,
  minimumBarcodeHeightMm: 6,
  edgeSafeMm: 1.0,
  solidEdgeSafeMm: 1.5,
  frameCoverageRatio: 0.7,
  overlapAreaMm2: 0.3,
  overlapRatio: 0.12,
  maximumWhitespaceRatio: 0.82,
  minimumContentSpanRatio: 0.32,
  maximumExpectedStructureReuse: 6
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rounded(value, precision) {
  const factor = 10 ** (precision == null ? 3 : precision);
  return Math.round(Number(value) * factor) / factor;
}

function issue(rule, severity, message, details) {
  return Object.assign({ rule, severity, message }, details || {});
}

function geometryOf(element) {
  return {
    x: finiteNumber(element && element.x),
    y: finiteNumber(element && element.y),
    width: finiteNumber(element && element.width),
    height: finiteNumber(element && element.height)
  };
}

function validGeometry(box) {
  return box.x != null && box.y != null && box.width != null && box.height != null;
}

function area(box) {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function intersection(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return { width, height, area: width * height };
}

function unionArea(boxes) {
  if (!boxes.length) return 0;
  const xs = [...new Set(boxes.flatMap((box) => [box.x, box.x + box.width]))].sort((a, b) => a - b);
  let total = 0;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const left = xs[index];
    const right = xs[index + 1];
    if (right <= left) continue;
    const intervals = boxes
      .filter((box) => box.x < right && box.x + box.width > left)
      .map((box) => [box.y, box.y + box.height])
      .sort((a, b) => a[0] - b[0]);
    if (!intervals.length) continue;
    let covered = 0;
    let start = intervals[0][0];
    let end = intervals[0][1];
    for (let intervalIndex = 1; intervalIndex < intervals.length; intervalIndex += 1) {
      const [nextStart, nextEnd] = intervals[intervalIndex];
      if (nextStart <= end) {
        end = Math.max(end, nextEnd);
      } else {
        covered += end - start;
        start = nextStart;
        end = nextEnd;
      }
    }
    covered += end - start;
    total += (right - left) * covered;
  }
  return total;
}

function contentMetrics(document, boxes) {
  const canvasArea = Number(document.widthMm) * Number(document.heightMm);
  if (!boxes.length || !Number.isFinite(canvasArea) || canvasArea <= 0) {
    return {
      canvasAreaMm2: Number.isFinite(canvasArea) ? rounded(canvasArea) : 0,
      contentAreaMm2: 0,
      contentAreaRatio: 0,
      contentSpanRatio: 0,
      whitespaceRatio: 1
    };
  }
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  const contentArea = Math.min(canvasArea, unionArea(boxes));
  const spanArea = Math.min(canvasArea, Math.max(0, maxX - minX) * Math.max(0, maxY - minY));
  return {
    canvasAreaMm2: rounded(canvasArea),
    contentAreaMm2: rounded(contentArea),
    contentAreaRatio: rounded(contentArea / canvasArea, 4),
    contentSpanRatio: rounded(spanArea / canvasArea, 4),
    whitespaceRatio: rounded(1 - contentArea / canvasArea, 4)
  };
}

// Rotation-aware footprint on the paper, so a rotated element cannot slip
// past the edge rules.
function paperExtent(element, box) {
  const radians = (finiteNumber(element && element.rotation) || 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const width = cosine * box.width + sine * box.height;
  const height = sine * box.width + cosine * box.height;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/**
 * Thermal printers drift 0.5–1 mm against die-cut labels. A frame, a filled
 * band or a rule near the edge then prints as a black edge on one side and a
 * gap on the other, so library templates keep that zone clear.
 */
function checkEdge(document, element, id, type, box, rules, issues) {
  const extent = paperExtent(element, box);
  const width = Number(document.widthMm);
  const height = Number(document.heightMm);
  const gap = Math.min(extent.x, extent.y, width - extent.x - extent.width, height - extent.y - extent.height);
  const details = { elementIds: [id], elementType: type, actual: rounded(gap, 2) };
  if (type === 'rect' && element.filled !== true
    && extent.width >= width * rules.frameCoverageRatio && extent.height >= height * rules.frameCoverageRatio) {
    issues.push(issue('EDGE_FRAME', 'error', `${id} 是整圈外框，走纸偏移后会一边黑边、一边留白`, details));
    return;
  }
  const ink = INK_TYPES.has(type) || (TEXT_TYPES.has(type) && element.reverse === true);
  if (ink && gap < rules.solidEdgeSafeMm - EDGE_EPSILON_MM) {
    issues.push(issue(
      'EDGE_INK',
      'error',
      `${id} 的线条或色块距纸边 ${gap.toFixed(2)} mm（至少 ${rules.solidEdgeSafeMm} mm），打印偏移会出现黑边`,
      Object.assign({ minimum: rules.solidEdgeSafeMm }, details)
    ));
    return;
  }
  if (gap < rules.edgeSafeMm - EDGE_EPSILON_MM) {
    issues.push(issue(
      'EDGE_TOO_CLOSE',
      'error',
      `${id} 距纸边 ${gap.toFixed(2)} mm（至少 ${rules.edgeSafeMm} mm），打印偏移会被裁切`,
      Object.assign({ minimum: rules.edgeSafeMm }, details)
    ));
  }
}

function displayText(element) {
  if (element.type === 'date') return formatDateValue(element, SAMPLE_TIME);
  if (element.type === 'serial') return serialValue(element);
  return String(element.text == null ? '' : element.text);
}

function lineSpacing(element) {
  const value = Number(element.lineSpacing);
  if (!Number.isFinite(value) || value === 0) return 1.15;
  return value > 0 && value < 0.4 ? 1.15 + value : value;
}

/**
 * The renderer shrinks text that does not fit its box. Templates must fit at
 * the declared size, otherwise the printed text ends up smaller than intended.
 * Widths come from the same conservative estimate the curated layouts use.
 */
function checkTextFit(element, id, type, box, issues) {
  if (!['text', 'date', 'serial'].includes(type) || normalizeTextMode(element) !== 'horizontal') return;
  const size = finiteNumber(element.fontSize);
  const value = displayText(element);
  if (size == null || size <= 0 || !value.trim()) return;
  let lines = 0;
  value.split('\n').forEach((paragraph) => {
    const width = lineWidthMm(paragraph, size, element.bold);
    lines += Math.max(1, Math.ceil(width / box.width - 1e-6));
  });
  const blockHeight = size + (lines - 1) * size * lineSpacing(element);
  if (blockHeight > box.height + 0.05) {
    issues.push(issue(
      'TEXT_OVERFLOW',
      'error',
      `${id}「${value.slice(0, 16)}」按 ${size} mm 字号需要约 ${rounded(blockHeight, 1)} mm 高，框只有 ${rounded(box.height, 1)} mm，打印时会被缩小`,
      { elementIds: [id], elementType: type, actual: rounded(blockHeight, 2), maximum: rounded(box.height, 2) }
    ));
  }
}

function checkElement(document, element, elementIndex, rules, issues, contentBoxes) {
  const id = String(element && element.id || `element-${elementIndex + 1}`);
  const type = String(element && element.type || 'unknown');
  const box = geometryOf(element);
  if (!validGeometry(box)) {
    issues.push(issue(
      'ELEMENT_GEOMETRY_INVALID',
      'error',
      `${id} 的位置或尺寸不是有效数字`,
      { elementIds: [id], elementType: type }
    ));
    return;
  }
  if (box.width <= 0 || box.height <= 0) {
    issues.push(issue(
      'ELEMENT_SIZE_INVALID',
      'error',
      `${id} 的宽高必须大于 0`,
      { elementIds: [id], elementType: type, actual: { width: box.width, height: box.height } }
    ));
    return;
  }

  const tolerance = rules.boundsToleranceMm;
  if (box.x < -tolerance || box.y < -tolerance
    || box.x + box.width > Number(document.widthMm) + tolerance
    || box.y + box.height > Number(document.heightMm) + tolerance) {
    issues.push(issue(
      'ELEMENT_OUT_OF_BOUNDS',
      'error',
      `${id} 超出 ${document.widthMm}×${document.heightMm} mm 纸张`,
      { elementIds: [id], elementType: type, actual: box }
    ));
  }
  checkEdge(document, element, id, type, box, rules, issues);
  checkTextFit(element, id, type, box, issues);

  // Lines and narrow decorative bands intentionally have one small axis. They
  // still have to be positive and in bounds, but are excluded from the generic
  // minimum-size rule and content-balance calculations.
  if (CONTENT_TYPES.has(type)) {
    contentBoxes.push(Object.assign({ id, type }, box));
    if (box.width < rules.minimumElementWidthMm || box.height < rules.minimumElementHeightMm) {
      issues.push(issue(
        'ELEMENT_TOO_SMALL',
        'error',
        `${id} 的可见区域过小`,
        { elementIds: [id], elementType: type, actual: { width: box.width, height: box.height } }
      ));
    }
  }

  if (TEXT_TYPES.has(type)) {
    const fontSize = finiteNumber(element.fontSize);
    if (fontSize == null || fontSize < rules.minimumTextFontSizeMm) {
      issues.push(issue(
        'TEXT_TOO_SMALL',
        'error',
        `${id} 字号低于 ${rules.minimumTextFontSizeMm} mm`,
        { elementIds: [id], elementType: type, actual: fontSize, minimum: rules.minimumTextFontSizeMm }
      ));
    }
  }

  if (type === 'qrcode') {
    if (Math.abs(box.width - box.height) > rules.qrSquareToleranceMm) {
      issues.push(issue(
        'QRCODE_NOT_SQUARE',
        'error',
        `${id} 不是正方形二维码`,
        { elementIds: [id], actual: { width: box.width, height: box.height } }
      ));
    }
    if (Math.min(box.width, box.height) < rules.minimumQrSizeMm) {
      issues.push(issue(
        'QRCODE_TOO_SMALL',
        'error',
        `${id} 边长低于 ${rules.minimumQrSizeMm} mm`,
        { elementIds: [id], actual: Math.min(box.width, box.height), minimum: rules.minimumQrSizeMm }
      ));
    }
  }

  if (type === 'barcode'
    && (box.width < rules.minimumBarcodeWidthMm || box.height < rules.minimumBarcodeHeightMm)) {
    issues.push(issue(
      'BARCODE_TOO_SMALL',
      'error',
      `${id} 条码框低于 ${rules.minimumBarcodeWidthMm}×${rules.minimumBarcodeHeightMm} mm`,
      {
        elementIds: [id],
        actual: { width: box.width, height: box.height },
        minimum: { width: rules.minimumBarcodeWidthMm, height: rules.minimumBarcodeHeightMm }
      }
    ));
  }

  if (CODE_TYPES.has(type)) {
    try {
      const metrics = codePrintMetrics(element, rules.dpi, rules.minimumDotsPerModule);
      if (metrics && !metrics.ok) {
        issues.push(issue(
          'CODE_MODULE_DENSITY_LOW',
          'error',
          `${id} 只有约 ${metrics.dotsPerModule.toFixed(2)} 打印点/模块`,
          { elementIds: [id], elementType: type, actual: metrics.dotsPerModule, minimum: metrics.minimumDotsPerModule }
        ));
      }
    } catch (error) {
      issues.push(issue(
        'CODE_CONTENT_INVALID',
        'error',
        `${id} 无法生成可验证的码：${error.message}`,
        { elementIds: [id], elementType: type, causeCode: error.code || '' }
      ));
    }
  }
}

function checkOverlaps(contentBoxes, rules, issues) {
  for (let leftIndex = 0; leftIndex < contentBoxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contentBoxes.length; rightIndex += 1) {
      const left = contentBoxes[leftIndex];
      const right = contentBoxes[rightIndex];
      const overlap = intersection(left, right);
      if (overlap.area < rules.overlapAreaMm2) continue;
      const smallerArea = Math.min(area(left), area(right));
      const ratio = smallerArea > 0 ? overlap.area / smallerArea : 0;
      if (ratio < rules.overlapRatio) continue;
      issues.push(issue(
        'CONTENT_OVERLAP',
        'error',
        `${left.id} 与 ${right.id} 的内容区域重叠`,
        {
          elementIds: [left.id, right.id],
          actual: { areaMm2: rounded(overlap.area), smallerElementRatio: rounded(ratio, 4) }
        }
      ));
    }
  }
}

function auditLibraryDocument(document, options) {
  const rules = Object.assign({}, DEFAULT_RULES, options || {});
  const issues = [];
  const width = finiteNumber(document && document.widthMm);
  const height = finiteNumber(document && document.heightMm);
  if (width == null || height == null || width <= 0 || height <= 0) {
    issues.push(issue('CANVAS_SIZE_INVALID', 'error', '模板纸张宽高必须是有效正数'));
    return {
      id: String(document && document.id || ''),
      name: String(document && document.name || ''),
      ok: false,
      errors: 1,
      warnings: 0,
      metrics: contentMetrics({ widthMm: 0, heightMm: 0 }, []),
      issues
    };
  }

  const safeDocument = Object.assign({}, document, { widthMm: width, heightMm: height });
  const elements = Array.isArray(document && document.elements) ? document.elements : [];
  if (!elements.length) {
    issues.push(issue('DOCUMENT_EMPTY', 'error', '模板没有任何可打印元素'));
  }
  const contentBoxes = [];
  elements.forEach((element, index) => checkElement(safeDocument, element, index, rules, issues, contentBoxes));
  checkOverlaps(contentBoxes, rules, issues);

  const metrics = contentMetrics(safeDocument, contentBoxes);
  if (contentBoxes.length && metrics.whitespaceRatio > rules.maximumWhitespaceRatio
    && metrics.contentSpanRatio < rules.minimumContentSpanRatio) {
    issues.push(issue(
      'EXCESSIVE_WHITESPACE',
      'warning',
      `内容只覆盖纸张约 ${(metrics.contentAreaRatio * 100).toFixed(1)}% 的面积`,
      {
        actual: {
          whitespaceRatio: metrics.whitespaceRatio,
          contentSpanRatio: metrics.contentSpanRatio
        },
        maximum: rules.maximumWhitespaceRatio
      }
    ));
  }

  const errors = issues.filter((item) => item.severity === 'error').length;
  const warnings = issues.length - errors;
  return {
    id: String(document && document.id || document && document.templateMeta && document.templateMeta.libraryId || ''),
    name: String(document && document.name || ''),
    ok: errors === 0,
    errors,
    warnings,
    metrics: Object.assign({ elementCount: elements.length, contentElementCount: contentBoxes.length }, metrics),
    issues
  };
}

function structuralElement(element) {
  return {
    type: String(element && element.type || ''),
    x: rounded(element && element.x),
    y: rounded(element && element.y),
    width: rounded(element && element.width),
    height: rounded(element && element.height),
    rotation: rounded(element && element.rotation || 0),
    filled: element && element.filled === true,
    reverse: element && element.reverse === true,
    align: String(element && element.align || ''),
    bold: element && element.bold === true,
    fontSize: TEXT_TYPES.has(String(element && element.type || '')) ? rounded(element.fontSize) : undefined,
    format: CODE_TYPES.has(String(element && element.type || '')) ? String(element.format || '') : undefined
  };
}

function layoutFingerprint(document) {
  return JSON.stringify({
    widthMm: rounded(document && document.widthMm),
    heightMm: rounded(document && document.heightMm),
    elements: (Array.isArray(document && document.elements) ? document.elements : []).map(structuralElement)
  });
}

function exactFingerprint(document) {
  return JSON.stringify({
    structure: JSON.parse(layoutFingerprint(document)),
    content: (Array.isArray(document && document.elements) ? document.elements : []).map((element) => ({
      type: String(element && element.type || ''),
      text: String(element && element.text || ''),
      value: String(element && element.value || ''),
      label: String(element && element.label || ''),
      prefix: String(element && element.prefix || ''),
      suffix: String(element && element.suffix || ''),
      start: finiteNumber(element && element.start),
      cells: Array.isArray(element && element.cells) ? element.cells.map(String) : undefined
    }))
  });
}

function recordId(record, index) {
  return String(record && record.entry && record.entry.id
    || record && record.document && record.document.id
    || record && record.document && record.document.name
    || `record-${index + 1}`);
}

function familyKey(record) {
  const entry = record && record.entry || {};
  const document = record && record.document || {};
  const meta = document.templateMeta || {};
  return [
    entry.scene || meta.scene || '',
    entry.item || '',
    entry.widthMm || document.widthMm || '',
    entry.heightMm || document.heightMm || ''
  ].join('|');
}

function groupBy(records, keyFor) {
  const groups = new Map();
  records.forEach((record, index) => {
    const key = keyFor(record, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return groups;
}

/**
 * Audit a whole generated library. `buildDocument` is injected so this module
 * stays independent of factory.js and can be reused by future generators.
 */
function auditLibrary(entries, buildDocument, options) {
  if (!Array.isArray(entries)) throw new TypeError('entries 必须是数组');
  if (typeof buildDocument !== 'function') throw new TypeError('buildDocument 必须是函数');
  const rules = Object.assign({}, DEFAULT_RULES, options || {});
  const records = entries.map((entry) => ({ entry, document: buildDocument(entry) }));
  const reports = records.map((record) => auditLibraryDocument(record.document, rules));
  const batchIssues = [];

  const exactGroups = [...groupBy(records, (record) => exactFingerprint(record.document)).values()]
    .filter((group) => group.length > 1);
  if (exactGroups.length) {
    const example = exactGroups[0];
    batchIssues.push(issue(
      'EXACT_DOCUMENT_DUPLICATE',
      'error',
      `发现 ${exactGroups.length} 组内容与结构完全重复的模板`,
      { templateIds: example.slice(0, 6).map(recordId) }
    ));
  }

  const variantCollisions = [];
  for (const family of groupBy(records, familyKey).values()) {
    const repeatedLayouts = [...groupBy(family, (record) => layoutFingerprint(record.document)).values()]
      .filter((group) => group.length > 1);
    repeatedLayouts.forEach((group) => variantCollisions.push(group));
  }
  if (variantCollisions.length) {
    batchIssues.push(issue(
      'VARIANT_STRUCTURE_DUPLICATE',
      'error',
      `发现 ${variantCollisions.length} 组同场景同文案的甲乙丙撞版`,
      { templateIds: variantCollisions[0].slice(0, 6).map(recordId) }
    ));
  }

  const structureGroups = [...groupBy(records, (record) => layoutFingerprint(record.document)).values()];
  const reusedStructureGroups = structureGroups.filter((group) => group.length > rules.maximumExpectedStructureReuse);
  const maxStructureReuse = structureGroups.reduce((max, group) => Math.max(max, group.length), 0);
  if (reusedStructureGroups.length) {
    batchIssues.push(issue(
      'GLOBAL_STRUCTURE_REUSE_HIGH',
      'warning',
      `${reusedStructureGroups.length} 组布局结构被复用超过 ${rules.maximumExpectedStructureReuse} 次`,
      {
        actual: maxStructureReuse,
        maximum: rules.maximumExpectedStructureReuse,
        templateIds: reusedStructureGroups[0].slice(0, 6).map(recordId)
      }
    ));
  }

  const documentErrors = reports.reduce((sum, report) => sum + report.errors, 0);
  const documentWarnings = reports.reduce((sum, report) => sum + report.warnings, 0);
  const batchErrors = batchIssues.filter((item) => item.severity === 'error').length;
  const batchWarnings = batchIssues.length - batchErrors;
  return {
    ok: documentErrors + batchErrors === 0,
    totals: {
      documents: records.length,
      documentErrors,
      documentWarnings,
      batchErrors,
      batchWarnings
    },
    diversity: {
      uniqueStructures: structureGroups.length,
      duplicateStructureGroups: structureGroups.filter((group) => group.length > 1).length,
      maxStructureReuse,
      exactDuplicateGroups: exactGroups.length,
      variantCollisionGroups: variantCollisions.length
    },
    reports,
    batchIssues
  };
}

module.exports = {
  DEFAULT_RULES,
  auditLibrary,
  auditLibraryDocument,
  exactFingerprint,
  layoutFingerprint
};
