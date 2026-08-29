const crypto = require('node:crypto');

const {
  buildDocument,
  ownedEntry
} = require('../../miniprogram/app/shangyue-library/factory');
const {
  classifyScene,
  pickItem,
  sceneById
} = require('../../miniprogram/app/shangyue-library/classify');

const ROLE_RULES = [
  [/name|title|product|commodity|goods|品名|名称/i, 'name'],
  [/price|amount|金额|售价|原价|会员价/i, 'price'],
  [/origin|产地/i, 'origin'],
  [/spec|规格|型号/i, 'specification'],
  [/batch|lot|批次/i, 'batch'],
  [/date|time|日期|时间|效期/i, 'date'],
  [/serial|sequence|流水|序号/i, 'serial'],
  [/barcode|条码|条形码/i, 'barcode'],
  [/qrcode|qr|二维码/i, 'qrcode'],
  [/table|表格/i, 'table']
];

const COPY_FIELDS = Object.freeze(['text', 'value', 'prefix', 'suffix', 'label', 'fixedValue']);
const CRITICAL_ROLES = new Set(['barcode', 'qrcode', 'date', 'table', 'serial']);
const RASTER_TYPES = new Set(['image', 'raster', 'bitmap', 'material']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rawElements(record) {
  return Array.isArray(record && record.elements) ? record.elements : [];
}

function isRasterType(value) {
  const type = String(value || '').toLowerCase();
  return RASTER_TYPES.has(type) || /(?:image|raster|bitmap)/.test(type);
}

function normalizeSourceProvider(value) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
  if (value && typeof value === 'object') {
    const candidate = value.id || value.name || value.provider || value.kind || value.sourceMethod;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 160);
  }
  return 'unspecified-input';
}

function normalizeAuthorization(value) {
  const isObject = value && typeof value === 'object' && !Array.isArray(value);
  const isString = typeof value === 'string' && Boolean(value.trim());
  const metadataPresent = Boolean(isString || (isObject && Object.keys(value).length));
  if (!metadataPresent) {
    return {
      status: 'missing',
      reference: '',
      metadataPresent: false,
      publishAllowed: false
    };
  }

  const supplied = isObject ? Object.assign({}, value) : { status: value.trim() };
  return Object.assign({}, supplied, {
    status: String(supplied.status || 'provided-unspecified').slice(0, 160),
    reference: String(supplied.reference || '').slice(0, 500),
    metadataPresent: true,
    // This planning tool only emits internal-review artifacts, even if the
    // upstream authorization object contains a broader publishing permission.
    publishAllowed: false
  });
}

function sourceText(element) {
  return [element && element.fieldName, element && element.contentTitle, element && element.title]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ');
}

function roleForElement(element) {
  const declaredType = String((element && element.type) || '').toLowerCase();
  if (isRasterType(declaredType) || ['rect', 'rectangle', 'line', 'shape'].includes(declaredType)) return 'unknown';
  if (declaredType === 'barcode') return 'barcode';
  if (declaredType === 'qrcode' || declaredType === 'qr') return 'qrcode';
  if (declaredType === 'date' || declaredType === 'time') return 'date';
  if (declaredType === 'serial') return 'serial';
  if (declaredType === 'table') return 'table';
  const semantic = sourceText(element);
  const rule = ROLE_RULES.find(([pattern]) => pattern.test(semantic));
  return rule ? rule[1] : (declaredType === 'text' ? 'supportingText' : declaredType || 'unknown');
}

function extractSemanticProfile(record, options) {
  const context = options && typeof options === 'object' ? options : {};
  const elements = rawElements(record);
  const semanticHints = [
    record && record.name,
    ...elements.map(sourceText)
  ].filter(Boolean).join(' ');
  const classified = classifyScene(semanticHints);
  const widthMm = clamp(finite(record && (record.width || record.widthMm), 40), 5, 300);
  const heightMm = clamp(finite(record && (record.height || record.heightMm), 30), 5, 300);
  const fieldRoles = [...new Set(elements.map(roleForElement).filter((role) => role !== 'unknown'))].sort();
  const sourceId = String((record && record.id) || sha256(semanticHints).slice(0, 16));
  const expressionSignals = {
    sourceImages: elements.filter((element) => isRasterType(element && element.type)).length,
    sourceFonts: new Set(elements.map((element) => element.fontFamily || element.fontCode).filter(Boolean)).size,
    positionedElements: elements.filter((element) => (
      Number.isFinite(Number(element.x))
      && Number.isFinite(Number(element.y))
      && Number.isFinite(Number(element.width))
      && Number.isFinite(Number(element.height))
    )).length
  };

  return {
    schemaVersion: 1,
    sourceProvider: normalizeSourceProvider(context.sourceProvider),
    sourceId,
    sourceLabel: String((record && record.name) || '').slice(0, 120),
    sourceRecordHash: sha256(JSON.stringify(record || {})),
    widthMm,
    heightMm,
    scene: classified.scene,
    category: classified.category,
    fieldRoles,
    expressionSignals,
    extractionPolicy: 'semantic-only; source coordinates, copy, fonts and assets are excluded from generation'
  };
}

function normalizedFeature(widthMm, heightMm, element) {
  const x = finite(element && element.x, 0);
  const y = finite(element && element.y, 0);
  const width = Math.max(0, finite(element && element.width, 0));
  const height = Math.max(0, finite(element && element.height, 0));
  return {
    type: String((element && element.type) || 'unknown').toLowerCase(),
    cx: (x + width / 2) / widthMm,
    cy: (y + height / 2) / heightMm,
    width: width / widthMm,
    height: height / heightMm
  };
}

function featureDistance(left, right) {
  return Math.sqrt(
    ((left.cx - right.cx) ** 2)
    + ((left.cy - right.cy) ** 2)
    + ((left.width - right.width) ** 2)
    + ((left.height - right.height) ** 2)
  );
}

function oneWayDistance(left, right) {
  if (!left.elements.length) return 1;
  const rightFeatures = right.elements.map((element) => normalizedFeature(right.widthMm, right.heightMm, element));
  return left.elements.reduce((sum, element) => {
    const feature = normalizedFeature(left.widthMm, left.heightMm, element);
    const sameType = rightFeatures.filter((candidate) => candidate.type === feature.type);
    if (!sameType.length) return sum + 1;
    return sum + Math.min(...sameType.map((candidate) => featureDistance(feature, candidate)));
  }, 0) / left.elements.length;
}

function structuralDistance(record, document) {
  const rawWidthMm = Number(record && (record.width ?? record.widthMm));
  const rawHeightMm = Number(record && (record.height ?? record.heightMm));
  if (!Number.isFinite(rawWidthMm) || rawWidthMm <= 0
    || !Number.isFinite(rawHeightMm) || rawHeightMm <= 0) {
    return { comparable: false, distance: null };
  }
  const source = {
    widthMm: clamp(rawWidthMm, 5, 300),
    heightMm: clamp(rawHeightMm, 5, 300),
    elements: rawElements(record).filter((element) => (
      Number.isFinite(Number(element.x))
      && Number.isFinite(Number(element.y))
      && Number.isFinite(Number(element.width))
      && Number.isFinite(Number(element.height))
      && Number(element.width) > 0
      && Number(element.height) > 0
    ))
  };
  if (!source.elements.length || !document || !Array.isArray(document.elements) || !document.elements.length
    || !Number.isFinite(Number(document.widthMm)) || Number(document.widthMm) <= 0
    || !Number.isFinite(Number(document.heightMm)) || Number(document.heightMm) <= 0) {
    return { comparable: false, distance: null };
  }
  const candidate = {
    widthMm: document.widthMm,
    heightMm: document.heightMm,
    elements: document.elements
  };
  return {
    comparable: true,
    distance: Number(((oneWayDistance(source, candidate) + oneWayDistance(candidate, source)) / 2).toFixed(4))
  };
}

function visibleCopy(elements) {
  return new Set((Array.isArray(elements) ? elements : [])
    .flatMap((element) => COPY_FIELDS.map((field) => element && element[field]))
    .map((value) => String(value == null ? '' : value).trim())
    .filter((value) => value.length >= 4));
}

function exactLongCopyReuse(record, document) {
  const sourceCopy = visibleCopy(rawElements(record));
  return [...visibleCopy(document && document.elements)]
    .filter((value) => sourceCopy.has(value))
    .sort();
}

function redesignId(sourceId, variant) {
  return `sy-redesign-${sha256(sourceId).slice(0, 12)}-v${variant + 1}`;
}

function stableSeed(sourceId) {
  return Number.parseInt(sha256(sourceId).slice(0, 8), 16);
}

function criticalRoles(elements) {
  return [...new Set((Array.isArray(elements) ? elements : [])
    .map(roleForElement)
    .filter((role) => CRITICAL_ROLES.has(role)))].sort();
}

function buildCandidate(record, profile, authorization, variant) {
  const scene = sceneById(profile.scene);
  const seed = stableSeed(profile.sourceId);
  const item = pickItem(scene.id, seed + variant);
  const entry = ownedEntry(scene, profile.widthMm, profile.heightMm, item, variant, seed * 3 + variant);
  entry.id = redesignId(profile.sourceId, variant);
  entry.name = `${scene.title} · ${item} · ${authorization.metadataPresent ? '授权重设计' : '重设计审核'}${variant + 1}`;
  const document = buildDocument(entry);
  document.name = entry.name;
  document.elements.forEach((element, elementIndex) => {
    const type = String((element && element.type) || 'element').toLowerCase();
    element.id = `${type}-${sha256(`${profile.sourceId}:${variant}:${elementIndex}:${type}`).slice(0, 16)}`;
  });
  const reviewOrigin = authorization.metadataPresent
    ? 'shangyue-authorized-redesign-review'
    : 'shangyue-reference-redesign-review';
  document.templateMeta = Object.assign({}, document.templateMeta, {
    origin: reviewOrigin,
    authorship: 'shangyue-independent-redesign',
    sourceProvider: profile.sourceProvider,
    sourceTemplateId: profile.sourceId,
    sourceRecordHash: profile.sourceRecordHash,
    authorizationStatus: authorization.status,
    authorizationReference: authorization.reference,
    approvedOriginal: false,
    approvalStatus: 'internal-review',
    publicCatalog: false,
    releaseApproved: false,
    reviewStatus: 'needs-human-review',
    thirdPartyAssets: false,
    copyright: '商跃重设计 · 仅内部审核'
  });
  const layout = structuralDistance(record, document);
  const copyReuse = exactLongCopyReuse(record, document);
  const sourceContainsRaster = rawElements(record)
    .some((element) => isRasterType(element && element.type));
  const candidateContainsRaster = document.elements
    .some((element) => isRasterType(element && element.type));
  const requiredCriticalRoles = profile.fieldRoles.filter((role) => CRITICAL_ROLES.has(role));
  const generatedCriticalRoles = criticalRoles(document.elements);
  const missingCriticalRoles = requiredCriticalRoles
    .filter((role) => !generatedCriticalRoles.includes(role));
  const requiresVisualReview = !layout.comparable || sourceContainsRaster || candidateContainsRaster;
  const gateReasons = [];
  if (!layout.comparable) gateReasons.push('layout-not-comparable');
  if (sourceContainsRaster) gateReasons.push('source-contains-raster');
  if (candidateContainsRaster) gateReasons.push('candidate-contains-raster');
  if (copyReuse.length) gateReasons.push('exact-long-copy-reuse');
  if (missingCriticalRoles.length) gateReasons.push('missing-critical-role');
  if (layout.comparable && layout.distance < 0.25) gateReasons.push('structural-distance-below-threshold');
  if (!authorization.metadataPresent) gateReasons.push('authorization-metadata-missing');
  const candidateForHumanReview = authorization.metadataPresent
    && !requiresVisualReview
    && copyReuse.length === 0
    && missingCriticalRoles.length === 0
    && layout.distance >= 0.25;
  return {
    entry,
    document,
    audit: {
      layoutComparable: layout.comparable,
      structuralDistance: layout.distance,
      exactLongCopyReuse: copyReuse,
      sourceContainsRaster,
      candidateContainsRaster,
      containsThirdPartyAsset: sourceContainsRaster || candidateContainsRaster,
      requiredCriticalRoles,
      generatedCriticalRoles,
      missingCriticalRoles,
      requiresVisualReview,
      gateReasons,
      candidateForHumanReview
    }
  };
}

function planAuthorizedRedesign(record, serialOrOptions, legacyOptions) {
  const options = serialOrOptions && typeof serialOrOptions === 'object'
    ? serialOrOptions
    : (legacyOptions && typeof legacyOptions === 'object' ? legacyOptions : {});
  const authorization = normalizeAuthorization(options.authorization);
  const profile = extractSemanticProfile(record, options);
  const candidates = [0, 1, 2].map((variant) => buildCandidate(record, profile, authorization, variant));
  candidates.sort((left, right) => {
    const safeDelta = Number(right.audit.candidateForHumanReview) - Number(left.audit.candidateForHumanReview);
    if (safeDelta) return safeDelta;
    return finite(right.audit.structuralDistance, 1) - finite(left.audit.structuralDistance, 1);
  });
  const selected = candidates[0];
  let reviewStatus = 'manual-redesign-required';
  if (selected.audit.requiresVisualReview) reviewStatus = 'visual-review';
  else if (!authorization.metadataPresent) reviewStatus = 'authorization-review';
  else if (selected.audit.candidateForHumanReview) reviewStatus = 'candidate';
  selected.document.templateMeta.reviewStatus = reviewStatus;
  const visionPrompt = createVisionSemanticPrompt(profile);
  return {
    schemaVersion: 2,
    profile,
    selectedId: selected.entry.id,
    selectedVariant: selected.entry.variant,
    audit: selected.audit,
    authorization,
    visionPrompt,
    vision: {
      invoked: false,
      status: 'not-invoked',
      prompt: visionPrompt,
      result: null
    },
    reviewStatus,
    catalogMeta: {
      id: selected.entry.id,
      name: selected.entry.name,
      scene: selected.entry.scene,
      category: selected.entry.category,
      size: [selected.entry.widthMm, selected.entry.heightMm],
      source: selected.document.templateMeta.origin,
      reviewStatus,
      publicCatalog: false,
      releaseApproved: false
    },
    document: selected.document,
    alternatives: candidates.slice(1).map((candidate) => ({
      id: candidate.entry.id,
      variant: candidate.entry.variant,
      audit: candidate.audit
    }))
  };
}

function selectDiverseRecords(records, limit) {
  const source = Array.isArray(records) ? records : [];
  const requested = Number(limit);
  if (!Number.isInteger(requested) || requested <= 0 || requested >= source.length) return source.slice();

  const buckets = new Map();
  source.forEach((record) => {
    const scene = extractSemanticProfile(record).scene;
    if (!buckets.has(scene)) buckets.set(scene, []);
    buckets.get(scene).push(record);
  });

  const selected = [];
  let round = 0;
  while (selected.length < requested) {
    let added = false;
    for (const bucket of buckets.values()) {
      if (round >= bucket.length) continue;
      selected.push(bucket[round]);
      added = true;
      if (selected.length >= requested) break;
    }
    if (!added) break;
    round += 1;
  }
  return selected;
}

function createVisionSemanticPrompt(profile) {
  return [
    '只分析标签的用途与字段语义，输出 JSON。',
    '允许字段：scene、fieldRoles、informationPriority、paperOrientation、notes。',
    '禁止输出或复刻：原图坐标、字体名、素材路径、装饰细节、完整原文案。',
    '看不清的字段写 unknown，不要猜测品牌、价格、条码或个人信息。',
    `目标纸张：${profile.widthMm}×${profile.heightMm}mm；预分类场景：${profile.scene}。`
  ].join('\n');
}

module.exports = {
  createVisionSemanticPrompt,
  exactLongCopyReuse,
  extractSemanticProfile,
  normalizeAuthorization,
  planAuthorizedRedesign,
  selectDiverseRecords,
  structuralDistance
};
