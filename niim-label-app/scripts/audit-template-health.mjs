import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  CODE_TYPE_MAP,
  convertElement,
  importNiimTemplate,
  resolveImagePath
} = require('../src/core/niim-template-import');
const { codePrintMetrics } = require('../src/core/code-quality');
const { encodeEan13 } = require('../src/core/ean13');
const { PROFILES, evaluatePrintability } = require('../src/core/profiles');
const { validateDocument } = require('../src/core/renderer');
const { isPlaceholderElement } = require('../src/app/views');
const { listFontCatalog } = require('../src/core/font-family');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const input = args.find((value) => !value.startsWith('--'))
  || 'research/authorized-catalog-full/collections/templates.json';
const collectionPath = path.resolve(process.cwd(), input);
const source = path.relative(process.cwd(), collectionPath).replaceAll('\\', '/');
const dpi = 203;
const imageTypes = new Set(['image', 'picture', 'logo']);
const codeTypes = new Set(['barcode', 'qrcode', 'qr']);
const semanticSourceTypes = new Set([
  'text', 'date', 'time', 'serial', 'barcode', 'qrcode', 'qr', 'table',
  'material', 'icon', 'sticker'
]);
const genericFontFamilies = new Set(
  listFontCatalog().map((font) => font.id).concat('system-ui')
);
const placeholderPattern = /^(?:双击(?:文本框)?编辑|点击后编辑文字|请输入(?:文字|内容)?|请编辑(?:文字|内容)?|在此输入(?:文字|内容)?|placeholder)$/i;

function createSummary(authorization = '') {
  return {
    source,
    authorization,
    authorizationDocumentaryPending: /documentary(?:\s+reference)?\s+pending/i.test(authorization),
    strictMode: strict,
    records: 0,
    imported: 0,

    // Strict blockers: damage that can still reach import/print without a
    // reliable attention marker or preflight stop.
    parseErrors: 0,
    importErrors: 0,
    dataCorruptionTemplates: 0,
    dataCorruptionFindings: 0,
    validImageDropTemplates: 0,
    validImageDropElements: 0,
    unreportedMissingImageTemplates: 0,
    unreportedMissingImageElements: 0,
    unsafeContentTemplates: 0,
    unsafeContentElements: 0,
    falseBlackFillTemplates: 0,
    falseBlackFillElements: 0,
    rotatedOverflowTemplates: 0,
    rotatedOverflowElements: 0,
    strictBlockerTemplates: 0,
    strictBlockerFindings: 0,

    // Source findings that are safe only because import metadata or print
    // preflight makes the operator resolve them first.
    missingImageTemplates: 0,
    missingImageElements: 0,
    missingImageReportedTemplates: 0,
    emptyCodeTemplates: 0,
    emptyCodeElements: 0,
    placeholderTextTemplates: 0,
    placeholderTextElements: 0,
    unknownCodeTypeTemplates: 0,
    unknownCodeTypeElements: 0,
    invalidEanTemplates: 0,
    invalidEanElements: 0,
    requiresUserInputTemplates: 0,
    requiresUserInputElements: 0,
    blockedByPreflightTemplates: 0,
    blockedByPreflightElements: 0,

    // Explicit warnings: useful operational limits, not damaged template data.
    codeQualityWarningTemplates: 0,
    codeQualityWarningsBelow2Dots: 0,
    profileUnsupportedTemplates: 0,
    allSemanticLockedTemplates: 0,
    semanticUnlockAppliedTemplates: 0,
    fontFallbackTemplates: 0,
    fontFallbackElements: 0,
    runtimeUnsupportedFontTemplates: 0,
    runtimeUnsupportedFontElements: 0,
    warningTemplates: 0,

    // Informational QA observations.
    emptySourceTemplates: 0,
    tinyElementsBelow2mm: 0,
    geometryRepairedTemplates: 0
  };
}

function createSamples() {
  return {
    parseErrors: [],
    importErrors: [],
    dataCorruption: [],
    validImageDrops: [],
    missingImages: [],
    unreportedMissingImages: [],
    emptyCodes: [],
    placeholderText: [],
    unknownCodeTypes: [],
    invalidEan: [],
    requiresUserInput: [],
    unsafeContent: [],
    falseBlackFill: [],
    rotatedOverflow: [],
    codeQualityWarnings: [],
    profileUnsupported: [],
    allSemanticLocked: [],
    fontFallback: [],
    runtimeUnsupportedFonts: []
  };
}

function remember(bucket, value, limit = 12) {
  if (bucket.length < limit) bucket.push(value);
}

function identity(raw, index, extra) {
  return Object.assign({
    id: raw && raw.id != null ? raw.id : `record-${index + 1}`,
    name: raw && raw.name ? raw.name : ''
  }, extra || {});
}

function sourceElementType(element) {
  return String(element && element.type || '').trim().toLowerCase();
}

function sourceText(element) {
  for (const value of [
    element && element.value,
    element && element.valueText,
    element && element.content,
    element && element.text,
    element && element.contentTitle
  ]) {
    if (value != null && String(value).length) return String(value);
  }
  return '';
}

function isExplicitTrue(value) {
  return value === true || value === 1;
}

function isExplicitlyLocked(element) {
  return isExplicitTrue(element && element.isLock) || isExplicitTrue(element && element.locked);
}

function isPlaceholderSource(element) {
  return sourceElementType(element) === 'text'
    && placeholderPattern.test(sourceText(element).trim());
}

function containsObjectText(element) {
  const values = [element && element.text, element && element.value]
    .concat(Array.isArray(element && element.cells) ? element.cells : []);
  return values.some((value) => String(value == null ? '' : value).includes('[object Object]'));
}

function isRuntimeUnsupportedFont(element) {
  const family = String(element && element.fontFamily || '').trim().toLowerCase();
  return Boolean(family) && !genericFontFamilies.has(family);
}

function rotatedBounds(element) {
  const radians = Number(element.rotation || 0) * Math.PI / 180;
  const width = Number(element.width) || 0;
  const height = Number(element.height) || 0;
  const halfWidth = (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
  const halfHeight = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
  const centerX = (Number(element.x) || 0) + width / 2;
  const centerY = (Number(element.y) || 0) + height / 2;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY - halfHeight,
    bottom: centerY + halfHeight
  };
}

function isFalseBlackFill(rawElement, importedElement) {
  return sourceElementType(rawElement) === 'graph'
    && Number(rawElement.graphType || 0) !== 1
    && rawElement.outline === 0
    && !isExplicitTrue(rawElement.filled)
    && !isExplicitTrue(rawElement.fill)
    && Boolean(importedElement && importedElement.type === 'rect' && importedElement.filled);
}

function preflightFailure(element) {
  if (!element) return null;
  // This is the same first gate used by main.js/evaluatePrintBlock before the
  // profile and renderer checks. It covers required text as well as code
  // values that deliberately remain samples until the operator confirms them.
  if (isPlaceholderElement(element)) {
    return {
      code: 'PLACEHOLDER_INPUT_REQUIRED',
      message: '请先编辑或确认模板内容'
    };
  }
  try {
    validateDocument({ elements: [element] }, dpi);
    return null;
  } catch (error) {
    return {
      code: error.code || 'PRINT_PREFLIGHT_ERROR',
      message: error.message
    };
  }
}

function safeContentBlock(category, element, failure) {
  if (!element || !failure || element.requiresInput !== true) return false;
  if (category === 'unknown-code-type' && element.unsupportedCodeType !== true) return false;
  if (category === 'invalid-ean13' && element.invalidCode !== true) return false;
  return true;
}

function countMissingPaths(sourcePaths, importedPaths) {
  const remaining = new Map();
  importedPaths.forEach((value) => {
    const key = String(value);
    remaining.set(key, (remaining.get(key) || 0) + 1);
  });
  let missing = 0;
  sourcePaths.forEach((value) => {
    const key = String(value);
    const available = remaining.get(key) || 0;
    if (available > 0) remaining.set(key, available - 1);
    else missing += 1;
  });
  return missing;
}

function output(report, exitCode) {
  console.log(JSON.stringify(report, null, 2));
  if (exitCode) process.exitCode = exitCode;
}

function parseCollection(summary, samples) {
  if (!fs.existsSync(collectionPath)) {
    summary.parseErrors = 1;
    summary.strictBlockerFindings = 1;
    remember(samples.parseErrors, { source, error: '模板集合不存在' });
    output({ summary, samples }, 2);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  } catch (error) {
    summary.parseErrors = 1;
    summary.strictBlockerFindings = 1;
    remember(samples.parseErrors, { source, error: error.message });
    output({ summary, samples }, 2);
    return null;
  }
}

function audit() {
  const initialSummary = createSummary();
  const samples = createSamples();
  const collection = parseCollection(initialSummary, samples);
  if (!collection) return;

  const authorization = String(collection.authorization && collection.authorization.status || '');
  const summary = createSummary(authorization);
  const records = Array.isArray(collection.records) ? collection.records : [];
  summary.records = records.length;

  const blockerTemplates = new Set();
  const warningTemplates = new Set();
  const requiresInputElements = new Set();
  const requiresInputTemplates = new Set();
  const preflightBlockedElements = new Set();
  const preflightBlockedTemplates = new Set();
  const unsafeContentElements = new Set();

  if (!Array.isArray(collection.records)) {
    summary.dataCorruptionTemplates = 1;
    summary.dataCorruptionFindings += 1;
    blockerTemplates.add('__collection__');
    remember(samples.dataCorruption, { source, error: 'records 必须是数组' });
  }

  records.forEach((raw, recordIndex) => {
    const recordKey = raw && raw.id != null ? String(raw.id) : `record-${recordIndex + 1}`;
    const rawElements = Array.isArray(raw && raw.elements) ? raw.elements : [];
    const recordFlags = {
      dataCorruption: false,
      validImageDrop: false,
      unreportedMissingImage: false,
      unsafeContent: false,
      falseBlackFill: false,
      rotatedOverflow: false,
      missingImage: false,
      emptyCode: false,
      placeholderText: false,
      unknownCodeType: false,
      invalidEan: false,
      codeQuality: false,
      fontFallback: false,
      runtimeUnsupportedFont: false
    };

    const addDataCorruption = (error, extra) => {
      recordFlags.dataCorruption = true;
      summary.dataCorruptionFindings += 1;
      blockerTemplates.add(recordKey);
      remember(samples.dataCorruption, identity(raw, recordIndex, Object.assign({ error }, extra || {})));
    };

    if (!raw || typeof raw !== 'object') {
      addDataCorruption('记录不是对象');
    } else {
      const width = Number(raw.width);
      const height = Number(raw.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        addDataCorruption('模板宽高不是有效正数', { size: [raw.width, raw.height] });
      }
      if (raw.elements != null && !Array.isArray(raw.elements)) {
        addDataCorruption('elements 必须是数组');
      }
      rawElements.forEach((element, elementIndex) => {
        if (!element || typeof element !== 'object') {
          addDataCorruption('元素不是对象', { elementIndex });
        }
      });
    }

    if (!rawElements.length) summary.emptySourceTemplates += 1;

    const validSourceImagePaths = [];
    let missingSourceImages = 0;
    const sourceCategories = [];
    rawElements.forEach((rawElement, elementIndex) => {
      if (!rawElement || typeof rawElement !== 'object') return;
      const type = sourceElementType(rawElement);
      const elementKey = `${recordKey}:${rawElement.id != null ? rawElement.id : elementIndex}`;

      if (imageTypes.has(type)) {
        const imagePath = resolveImagePath(rawElement);
        if (imagePath) {
          validSourceImagePaths.push(imagePath);
        } else {
          missingSourceImages += 1;
          recordFlags.missingImage = true;
          summary.missingImageElements += 1;
          warningTemplates.add(recordKey);
          remember(samples.missingImages, identity(raw, recordIndex, {
            elementId: rawElement.id,
            elementIndex,
            error: '源图片路径为空或为损坏标记'
          }));
        }
      }

      if (codeTypes.has(type)) {
        const value = sourceText(rawElement);
        const empty = !value.trim();
        if (empty) {
          recordFlags.emptyCode = true;
          summary.emptyCodeElements += 1;
          sourceCategories.push({ category: 'empty-code', elementKey, rawElement, elementIndex });
          remember(samples.emptyCodes, identity(raw, recordIndex, {
            elementId: rawElement.id,
            elementIndex,
            type,
            codeType: rawElement.codeType
          }));
        }

        const hasDeclaredCodeType = type === 'barcode'
          && rawElement.codeType != null
          && String(rawElement.codeType).trim() !== '';
        if (hasDeclaredCodeType && !CODE_TYPE_MAP[rawElement.codeType]) {
          recordFlags.unknownCodeType = true;
          summary.unknownCodeTypeElements += 1;
          sourceCategories.push({ category: 'unknown-code-type', elementKey, rawElement, elementIndex });
          remember(samples.unknownCodeTypes, identity(raw, recordIndex, {
            elementId: rawElement.id,
            elementIndex,
            codeType: rawElement.codeType
          }));
        }

        const mapped = type === 'barcode' && CODE_TYPE_MAP[rawElement.codeType];
        if (!empty && mapped === 'ean13') {
          try {
            encodeEan13(value);
          } catch (error) {
            recordFlags.invalidEan = true;
            summary.invalidEanElements += 1;
            sourceCategories.push({ category: 'invalid-ean13', elementKey, rawElement, elementIndex });
            remember(samples.invalidEan, identity(raw, recordIndex, {
              elementId: rawElement.id,
              elementIndex,
              value,
              error: error.message
            }));
          }
        }
      }

      if (isPlaceholderSource(rawElement)) {
        recordFlags.placeholderText = true;
        summary.placeholderTextElements += 1;
        sourceCategories.push({ category: 'placeholder-text', elementKey, rawElement, elementIndex });
        remember(samples.placeholderText, identity(raw, recordIndex, {
          elementId: rawElement.id,
          elementIndex,
          text: sourceText(rawElement)
        }));
      }
    });

    const semanticSourceElements = rawElements.filter((element) => (
      element && typeof element === 'object' && semanticSourceTypes.has(sourceElementType(element))
    ));
    if (semanticSourceElements.length > 0 && semanticSourceElements.every(isExplicitlyLocked)) {
      summary.allSemanticLockedTemplates += 1;
      warningTemplates.add(recordKey);
      remember(samples.allSemanticLocked, identity(raw, recordIndex, {
        semanticElements: semanticSourceElements.length
      }));
    }

    let documentValue;
    let meta;
    try {
      const imported = importNiimTemplate(raw);
      documentValue = imported.document;
      meta = imported.meta || {};
      summary.imported += 1;
    } catch (error) {
      summary.importErrors += 1;
      blockerTemplates.add(recordKey);
      remember(samples.importErrors, identity(raw, recordIndex, { error: error.message }));
      return;
    }

    if (missingSourceImages > 0) {
      summary.missingImageTemplates += 1;
      if (Number(meta.missingImageCount) >= missingSourceImages && meta.needsAttention === true) {
        summary.missingImageReportedTemplates += 1;
      } else {
        recordFlags.unreportedMissingImage = true;
        summary.unreportedMissingImageElements += missingSourceImages;
        blockerTemplates.add(recordKey);
        remember(samples.unreportedMissingImages, identity(raw, recordIndex, {
          count: missingSourceImages,
          error: '缺失图片未进入导入提醒元数据'
        }));
      }
    }

    if (Number(meta.geometryRepairCount) > 0) summary.geometryRepairedTemplates += 1;
    if (Number(meta.semanticUnlockCount) > 0) summary.semanticUnlockAppliedTemplates += 1;

    const elements = Array.isArray(documentValue.elements) ? documentValue.elements : [];
    const importedImagePaths = elements
      .filter((element) => element && element.type === 'image' && element.path)
      .map((element) => element.path);
    const validImageDrops = countMissingPaths(validSourceImagePaths, importedImagePaths);
    if (validImageDrops > 0) {
      recordFlags.validImageDrop = true;
      summary.validImageDropElements += validImageDrops;
      blockerTemplates.add(recordKey);
      remember(samples.validImageDrops, identity(raw, recordIndex, {
        count: validImageDrops,
        error: '有效源图片在导入结果中缺失'
      }));
    }

    const modify = raw && (raw.modify || raw.dataSourceModifies) || null;
    const conversions = new Map();
    rawElements.forEach((rawElement, elementIndex) => {
      if (!rawElement || typeof rawElement !== 'object') return;
      const elementKey = `${recordKey}:${rawElement.id != null ? rawElement.id : elementIndex}`;
      try {
        const importedElement = convertElement(rawElement, documentValue, modify);
        conversions.set(elementKey, importedElement);
        if (isFalseBlackFill(rawElement, importedElement)) {
          recordFlags.falseBlackFill = true;
          summary.falseBlackFillElements += 1;
          blockerTemplates.add(recordKey);
          remember(samples.falseBlackFill, identity(raw, recordIndex, {
            elementId: rawElement.id,
            elementIndex,
            graphType: rawElement.graphType,
            outline: rawElement.outline,
            error: 'outline=0 被导入成黑色实心形状'
          }));
        }
      } catch (error) {
        conversions.set(elementKey, null);
        addDataCorruption('源元素转换失败', {
          elementId: rawElement.id,
          elementIndex,
          detail: error.message
        });
      }
    });

    const preflightCache = new Map();
    const failureFor = (elementKey, element) => {
      if (!preflightCache.has(elementKey)) {
        preflightCache.set(elementKey, preflightFailure(element));
      }
      return preflightCache.get(elementKey);
    };

    conversions.forEach((element, elementKey) => {
      if (!element || element.requiresInput !== true) return;
      requiresInputElements.add(elementKey);
      requiresInputTemplates.add(recordKey);
      warningTemplates.add(recordKey);
      const failure = failureFor(elementKey, element);
      if (failure) {
        preflightBlockedElements.add(elementKey);
        preflightBlockedTemplates.add(recordKey);
      } else {
        unsafeContentElements.add(elementKey);
        recordFlags.unsafeContent = true;
        blockerTemplates.add(recordKey);
      }
      remember(samples.requiresUserInput, identity(raw, recordIndex, {
        elementId: element.id,
        type: element.type,
        reason: element.requiresInputReason || 'requires-input',
        preflightCode: failure && failure.code
      }));
    });

    sourceCategories.forEach((finding) => {
      const element = conversions.get(finding.elementKey);
      const failure = failureFor(finding.elementKey, element);
      if (safeContentBlock(finding.category, element, failure)) {
        requiresInputElements.add(finding.elementKey);
        requiresInputTemplates.add(recordKey);
        preflightBlockedElements.add(finding.elementKey);
        preflightBlockedTemplates.add(recordKey);
        warningTemplates.add(recordKey);
        return;
      }
      unsafeContentElements.add(finding.elementKey);
      recordFlags.unsafeContent = true;
      blockerTemplates.add(recordKey);
      remember(samples.unsafeContent, identity(raw, recordIndex, {
        elementId: finding.rawElement.id,
        elementIndex: finding.elementIndex,
        category: finding.category,
        importedFlags: element && {
          requiresInput: element.requiresInput,
          unsupportedCodeType: element.unsupportedCodeType,
          invalidCode: element.invalidCode
        },
        preflightCode: failure && failure.code,
        error: '内容风险没有被导入标记与打印预检同时拦截'
      }));
    });

    elements.forEach((element) => {
      if (containsObjectText(element)) {
        addDataCorruption('导入结果包含 [object Object]', { elementId: element.id });
      }
      if (![element.x, element.y, element.width, element.height]
        .every((value) => Number.isFinite(Number(value)))
        || Number(element.width) <= 0 || Number(element.height) <= 0) {
        addDataCorruption('导入结果几何数据无效', { elementId: element.id });
      }

      if (element.sourceFontFamily) {
        recordFlags.fontFallback = true;
        summary.fontFallbackElements += 1;
        warningTemplates.add(recordKey);
        remember(samples.fontFallback, identity(raw, recordIndex, {
          elementId: element.id,
          requested: element.sourceFontFamily,
          renderedAs: element.fontFamily
        }));
      }
      if (isRuntimeUnsupportedFont(element)) {
        recordFlags.runtimeUnsupportedFont = true;
        summary.runtimeUnsupportedFontElements += 1;
        warningTemplates.add(recordKey);
        remember(samples.runtimeUnsupportedFonts, identity(raw, recordIndex, {
          elementId: element.id,
          fontFamily: element.fontFamily
        }));
      }
      if (Number(element.width) < 2 || Number(element.height) < 2) {
        summary.tinyElementsBelow2mm += 1;
      }

      const bounds = rotatedBounds(element);
      if (bounds.left < -0.05 || bounds.top < -0.05
        || bounds.right > documentValue.widthMm + 0.05
        || bounds.bottom > documentValue.heightMm + 0.05) {
        recordFlags.rotatedOverflow = true;
        summary.rotatedOverflowElements += 1;
        blockerTemplates.add(recordKey);
        remember(samples.rotatedOverflow, identity(raw, recordIndex, {
          elementId: element.id,
          type: element.type,
          rotation: element.rotation
        }));
      }

      if ((element.type === 'barcode' || element.type === 'qrcode')
        && String(element.value == null ? '' : element.value).trim()
        && element.unsupportedCodeType !== true
        && element.invalidCode !== true) {
        try {
          // A non-empty sample/data-binding value still reveals whether the
          // current box is below two dots/module. Ignore only the input marker
          // for this geometry-only warning; print preflight remains unchanged.
          const metrics = codePrintMetrics(Object.assign({}, element, { requiresInput: false }), dpi);
          if (metrics && !metrics.ok) {
            recordFlags.codeQuality = true;
            summary.codeQualityWarningsBelow2Dots += 1;
            warningTemplates.add(recordKey);
            remember(samples.codeQualityWarnings, identity(raw, recordIndex, {
              elementId: element.id,
              type: element.type,
              dotsPerModule: Number(metrics.dotsPerModule.toFixed(3)),
              minimumDotsPerModule: metrics.minimumDotsPerModule
            }));
          }
        } catch (_) {
          // Invalid/unsupported content has its own source category and
          // preflight marker; it is not a module-density finding.
        }
      }
    });

    if (!PROFILES.some((profile) => evaluatePrintability(documentValue, profile).ok)) {
      summary.profileUnsupportedTemplates += 1;
      warningTemplates.add(recordKey);
      remember(samples.profileUnsupported, identity(raw, recordIndex, {
        size: [documentValue.widthMm, documentValue.heightMm]
      }));
    }

    const templateFlags = [
      ['dataCorruption', 'dataCorruptionTemplates'],
      ['validImageDrop', 'validImageDropTemplates'],
      ['unreportedMissingImage', 'unreportedMissingImageTemplates'],
      ['unsafeContent', 'unsafeContentTemplates'],
      ['falseBlackFill', 'falseBlackFillTemplates'],
      ['rotatedOverflow', 'rotatedOverflowTemplates'],
      ['emptyCode', 'emptyCodeTemplates'],
      ['placeholderText', 'placeholderTextTemplates'],
      ['unknownCodeType', 'unknownCodeTypeTemplates'],
      ['invalidEan', 'invalidEanTemplates'],
      ['codeQuality', 'codeQualityWarningTemplates'],
      ['fontFallback', 'fontFallbackTemplates'],
      ['runtimeUnsupportedFont', 'runtimeUnsupportedFontTemplates']
    ];
    templateFlags.forEach(([flag, field]) => {
      if (recordFlags[flag]) summary[field] += 1;
    });
  });

  summary.requiresUserInputElements = requiresInputElements.size;
  summary.blockedByPreflightElements = preflightBlockedElements.size;
  summary.unsafeContentElements = unsafeContentElements.size;

  summary.requiresUserInputTemplates = requiresInputTemplates.size;
  summary.blockedByPreflightTemplates = preflightBlockedTemplates.size;
  summary.strictBlockerTemplates = blockerTemplates.size;
  summary.strictBlockerFindings = summary.parseErrors
    + summary.importErrors
    + summary.dataCorruptionFindings
    + summary.validImageDropElements
    + summary.unreportedMissingImageElements
    + summary.unsafeContentElements
    + summary.falseBlackFillElements
    + summary.rotatedOverflowElements;
  summary.warningTemplates = warningTemplates.size;

  output({ summary, samples }, strict && summary.strictBlockerFindings > 0 ? 1 : 0);
}

audit();
