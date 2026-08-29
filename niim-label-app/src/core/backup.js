const SCHEMA_VERSION = 1;

const LIMITS = Object.freeze({
  backupBytes: 25 * 1024 * 1024,
  projects: 1000,
  templates: 1000,
  dataRows: 10000,
  elementsPerDocument: 500,
  fieldsPerRow: 128,
  objectKeys: 256,
  arrayItems: 10000,
  depth: 16,
  stringLength: 1024 * 1024,
  idLength: 128,
  nameLength: 200,
  dataKeyLength: 100,
  maxDimensionMm: 500
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ELEMENT_TYPES = new Set([
  'text', 'barcode', 'qrcode', 'rect', 'line', 'image', 'date', 'serial', 'table', 'material'
]);
const ELEMENT_TYPE_ALIASES = Object.freeze({
  qr: 'qrcode',
  rectangle: 'rect',
  box: 'rect',
  picture: 'image',
  logo: 'image',
  time: 'date',
  icon: 'material',
  sticker: 'material'
});

const SETTING_RULES = Object.freeze({
  language: { type: 'string', max: 40 },
  units: { type: 'enum', values: ['mm', 'in'] },
  autosave: { type: 'boolean' },
  cloudSync: { type: 'boolean' },
  defaultProfileId: { type: 'string', max: 80 },
  density: { type: 'integer', min: 1, max: 20 },
  threshold: { type: 'integer', min: 0, max: 255 },
  copies: { type: 'integer', min: 1, max: 99 },
  labelType: { type: 'integer', min: 1, max: 4 },
  defaultWidthMm: { type: 'number', min: 0.5, max: LIMITS.maxDimensionMm },
  defaultHeightMm: { type: 'number', min: 0.5, max: LIMITS.maxDimensionMm },
  installedStock: { type: 'string', max: 300 },
  batchTemplateId: { type: 'string', max: LIMITS.idLength },
  importedLibraryV1: { type: 'boolean' },
  importedLibraryV2: { type: 'boolean' },
  importedLibraryV4: { type: 'boolean' },
  onboardingDone: { type: 'boolean' },
  lastDeviceId: { type: 'string', max: 300 },
  lastDeviceName: { type: 'string', max: 300 }
});

function issue(code, path, message) {
  return { code, path, message };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addError(context, code, path, message) {
  context.errors.push(issue(code, path, message));
}

function addWarning(context, code, path, message) {
  context.warnings.push(issue(code, path, message));
}

/**
 * Reject suspicious keys before any property is copied. This is intentionally
 * recursive, including fields that a later schema migration would otherwise
 * drop, so an ignored payload cannot hide prototype-pollution data.
 */
function inspectInputGraph(value, context, path = '$', depth = 0, ancestors = new WeakSet()) {
  if (context.errors.length) return;
  if (depth > LIMITS.depth) {
    addError(context, 'limit.depth', path, `对象嵌套不能超过 ${LIMITS.depth} 层`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (ancestors.has(value)) {
    addError(context, 'invalid.cycle', path, '备份数据不能包含循环引用');
    return;
  }
  ancestors.add(value);
  if (!Array.isArray(value) && !isPlainObject(value)) {
    addError(context, 'invalid.object', path, '仅支持普通 JSON 对象');
    return;
  }
  const keys = Object.keys(value);
  if (!Array.isArray(value) && keys.length > LIMITS.objectKeys) {
    addError(context, 'limit.objectKeys', path, `单个对象字段不能超过 ${LIMITS.objectKeys} 个`);
    return;
  }
  for (const key of keys) {
    const nextPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (DANGEROUS_KEYS.has(key)) {
      addError(context, 'security.prototypeKey', nextPath, `拒绝危险字段 ${key}`);
      return;
    }
    inspectInputGraph(value[key], context, nextPath, depth + 1, ancestors);
    if (context.errors.length) {
      ancestors.delete(value);
      return;
    }
  }
  ancestors.delete(value);
}

function utf8ByteLength(value) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length
      && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function parseInput(input, context) {
  if (typeof input !== 'string') return input;
  if (utf8ByteLength(input) > LIMITS.backupBytes) {
    addError(context, 'limit.backupBytes', '$', `备份文件不能超过 ${LIMITS.backupBytes} 字节`);
    return null;
  }
  try {
    return JSON.parse(input);
  } catch (error) {
    addError(context, 'invalid.json', '$', '备份文件不是有效的 JSON');
    return null;
  }
}

function copyJsonValue(value, context, path, depth = 0) {
  if (depth > LIMITS.depth) {
    addError(context, 'limit.depth', path, `对象嵌套不能超过 ${LIMITS.depth} 层`);
    return undefined;
  }
  if (value === null) return null;
  if (typeof value === 'string') {
    if (value.length > LIMITS.stringLength) {
      addError(context, 'limit.stringLength', path, `字符串不能超过 ${LIMITS.stringLength} 个字符`);
      return undefined;
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      addError(context, 'invalid.number', path, '数值必须是有限数字');
      return undefined;
    }
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > LIMITS.arrayItems) {
      addError(context, 'limit.arrayItems', path, `数组不能超过 ${LIMITS.arrayItems} 项`);
      return undefined;
    }
    return value.map((item, index) => copyJsonValue(item, context, `${path}[${index}]`, depth + 1));
  }
  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) {
        addWarning(context, 'migrate.undefinedDropped', `${path}.${key}`, '已忽略无法写入 JSON 的 undefined 字段');
        continue;
      }
      const next = copyJsonValue(value[key], context, `${path}.${key}`, depth + 1);
      if (next !== undefined || value[key] === undefined) output[key] = next;
    }
    return output;
  }
  addError(context, 'invalid.value', path, '仅支持 JSON 字符串、数字、布尔值、null、数组和对象');
  return undefined;
}

function normalizedString(value, fallback, context, path, maxLength) {
  if (value == null || String(value).trim() === '') return fallback;
  const result = String(value).trim();
  if (result.length > maxLength) {
    addError(context, 'limit.stringLength', path, `文本不能超过 ${maxLength} 个字符`);
    return fallback;
  }
  if (typeof value !== 'string') addWarning(context, 'migrate.string', path, '旧值已转换为文本');
  return result;
}

function finiteNumber(value, context, path, options = {}) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    addError(context, 'invalid.number', path, '必须提供有效数字');
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    addError(context, 'invalid.number', path, '必须提供有限数字');
    return null;
  }
  if (options.integer && !Number.isInteger(number)) {
    addError(context, 'invalid.integer', path, '必须提供整数');
    return null;
  }
  if (number < options.min || number > options.max) {
    addError(context, 'invalid.range', path, `数值范围应为 ${options.min} 到 ${options.max}`);
    return null;
  }
  if (typeof value === 'string') addWarning(context, 'migrate.number', path, '旧版文本数字已转换为数值');
  return number;
}

function stableUniqueId(preferred, used) {
  const base = String(preferred || 'imported').trim() || 'imported';
  if (!used.has(base)) return base;
  const imported = `${base}-imported`;
  if (!used.has(imported)) return imported;
  let suffix = 2;
  while (used.has(`${imported}-${suffix}`)) suffix += 1;
  return `${imported}-${suffix}`;
}

function normalizeElement(raw, documentValue, index, usedIds, context, path) {
  if (!isPlainObject(raw)) {
    addError(context, 'invalid.element', path, '标签元素必须是对象');
    return null;
  }
  const copied = copyJsonValue(raw, context, path);
  const rawType = normalizedString(raw.type, '', context, `${path}.type`, 40).toLowerCase();
  const type = ELEMENT_TYPE_ALIASES[rawType] || rawType;
  if (!ELEMENT_TYPES.has(type)) {
    addError(context, 'invalid.elementType', `${path}.type`, `不支持的元素类型：${rawType || '空'}`);
    return null;
  }
  if (type !== rawType) addWarning(context, 'migrate.elementType', `${path}.type`, `旧元素类型 ${rawType} 已迁移为 ${type}`);

  const preferredId = normalizedString(raw.id, `${type}-${index + 1}`, context, `${path}.id`, LIMITS.idLength);
  const id = stableUniqueId(preferredId, usedIds);
  if (id !== preferredId) addWarning(context, 'migrate.duplicateElementId', `${path}.id`, `重复元素 ID 已改为 ${id}`);
  if (raw.id == null || String(raw.id).trim() === '') addWarning(context, 'migrate.missingElementId', `${path}.id`, `缺失元素 ID 已补为 ${id}`);
  usedIds.add(id);

  const x = finiteNumber(raw.x, context, `${path}.x`, { min: -LIMITS.maxDimensionMm, max: LIMITS.maxDimensionMm * 2 });
  const y = finiteNumber(raw.y, context, `${path}.y`, { min: -LIMITS.maxDimensionMm, max: LIMITS.maxDimensionMm * 2 });
  const width = finiteNumber(raw.width, context, `${path}.width`, { min: 0.01, max: LIMITS.maxDimensionMm });
  const height = finiteNumber(raw.height, context, `${path}.height`, { min: 0.01, max: LIMITS.maxDimensionMm });
  let rotation = 0;
  if (raw.rotation != null) {
    const sourceRotation = finiteNumber(raw.rotation, context, `${path}.rotation`, { min: -100000, max: 100000 });
    if (sourceRotation !== null) rotation = ((sourceRotation % 360) + 360) % 360;
    else return null;
  }
  if ([x, y, width, height].some((value) => value === null)) return null;
  const tolerance = 0.02;
  const radians = rotation * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height) / 2;
  const halfHeight = (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (centerX - halfWidth < -tolerance || centerY - halfHeight < -tolerance
    || centerX + halfWidth > documentValue.widthMm + tolerance
    || centerY + halfHeight > documentValue.heightMm + tolerance) {
    addError(context, 'invalid.elementBounds', path, '元素边界超出标签尺寸');
    return null;
  }

  copied.id = id;
  copied.type = type;
  copied.x = x;
  copied.y = y;
  copied.width = width;
  copied.height = height;
  copied.rotation = rotation;

  if (type === 'table') {
    const rows = finiteNumber(raw.rows, context, `${path}.rows`, { integer: true, min: 1, max: 50 });
    const columns = finiteNumber(raw.columns, context, `${path}.columns`, { integer: true, min: 1, max: 50 });
    if (rows === null || columns === null) return null;
    if (!Array.isArray(raw.cells) || raw.cells.length > rows * columns) {
      addError(context, 'invalid.tableCells', `${path}.cells`, '表格单元格必须是数组且不能超过行列总数');
      return null;
    }
    copied.rows = rows;
    copied.columns = columns;
    copied.cells = raw.cells.map((cell, cellIndex) => {
      if (cell == null) return '';
      if (!['string', 'number', 'boolean'].includes(typeof cell)) {
        addError(context, 'invalid.tableCell', `${path}.cells[${cellIndex}]`, '表格单元格只能是文本或数字');
        return '';
      }
      return String(cell);
    });
  }
  return copied;
}

function normalizeDocument(raw, context, path) {
  if (!isPlainObject(raw)) {
    addError(context, 'invalid.document', path, '标签文档必须是对象');
    return null;
  }
  const documentSchema = raw.schemaVersion == null ? 0 : Number(raw.schemaVersion);
  if (!Number.isInteger(documentSchema) || documentSchema < 0 || documentSchema > SCHEMA_VERSION) {
    addError(context, 'unsupported.documentSchema', `${path}.schemaVersion`, '不支持该标签文档版本');
    return null;
  }
  if (documentSchema === 0) addWarning(context, 'migrate.documentSchema', `${path}.schemaVersion`, '旧版标签文档已迁移到版本 1');
  const widthMm = finiteNumber(raw.widthMm, context, `${path}.widthMm`, { min: 0.5, max: LIMITS.maxDimensionMm });
  const heightMm = finiteNumber(raw.heightMm, context, `${path}.heightMm`, { min: 0.5, max: LIMITS.maxDimensionMm });
  if (widthMm === null || heightMm === null) return null;
  if (!Array.isArray(raw.elements)) {
    addError(context, 'invalid.elements', `${path}.elements`, 'elements 必须是数组');
    return null;
  }
  if (raw.elements.length > LIMITS.elementsPerDocument) {
    addError(context, 'limit.elements', `${path}.elements`, `每个标签最多 ${LIMITS.elementsPerDocument} 个元素`);
    return null;
  }
  const output = {
    schemaVersion: SCHEMA_VERSION,
    name: normalizedString(raw.name, '未命名标签', context, `${path}.name`, LIMITS.nameLength),
    widthMm,
    heightMm,
    elements: []
  };
  const usedIds = new Set();
  raw.elements.forEach((element, index) => {
    const next = normalizeElement(element, output, index, usedIds, context, `${path}.elements[${index}]`);
    if (next) output.elements.push(next);
  });
  return output;
}

function normalizeRecord(raw, kind, index, usedIds, context, path) {
  if (!isPlainObject(raw)) {
    addError(context, `invalid.${kind}`, path, `${kind === 'project' ? '项目' : '模板'}必须是对象`);
    return null;
  }
  const copied = copyJsonValue(raw, context, path);
  const fallbackId = `${kind}-imported-${index + 1}`;
  const preferredId = normalizedString(raw.id, fallbackId, context, `${path}.id`, LIMITS.idLength);
  const id = stableUniqueId(preferredId, usedIds);
  if (id !== preferredId) addWarning(context, `migrate.duplicate${kind}Id`, `${path}.id`, `重复 ID 已改为 ${id}`);
  if (raw.id == null || String(raw.id).trim() === '') addWarning(context, `migrate.missing${kind}Id`, `${path}.id`, `缺失 ID 已补为 ${id}`);
  usedIds.add(id);
  const documentValue = normalizeDocument(raw.document, context, `${path}.document`);
  copied.id = id;
  copied.document = documentValue;
  if (kind === 'template') {
    copied.name = normalizedString(raw.name, documentValue ? documentValue.name : '未命名模板', context, `${path}.name`, LIMITS.nameLength);
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (raw[field] == null) continue;
    const value = finiteNumber(raw[field], context, `${path}.${field}`, { min: 0, max: Number.MAX_SAFE_INTEGER });
    if (value !== null) copied[field] = value;
  }
  return copied;
}

function normalizeCollection(raw, kind, limit, context, path) {
  if (!Array.isArray(raw)) {
    addError(context, `invalid.${kind}s`, path, `${path} 必须是数组`);
    return [];
  }
  if (raw.length > limit) {
    addError(context, `limit.${kind}s`, path, `${path} 最多 ${limit} 项`);
    return [];
  }
  const usedIds = new Set();
  const output = [];
  raw.forEach((item, index) => {
    const next = normalizeRecord(item, kind, index, usedIds, context, `${path}[${index}]`);
    if (next) output.push(next);
  });
  return output;
}

function normalizeBoolean(value, context, path) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0 || value === 'true' || value === 'false') {
    addWarning(context, 'migrate.boolean', path, '旧值已转换为布尔值');
    return value === 1 || value === 'true';
  }
  addError(context, 'invalid.boolean', path, '必须是布尔值');
  return null;
}

function normalizeSettings(raw, context, path) {
  if (!isPlainObject(raw)) {
    addError(context, 'invalid.settings', path, 'settings 必须是对象');
    return {};
  }
  const output = {};
  for (const key of Object.keys(raw)) {
    const rule = SETTING_RULES[key];
    if (!rule) {
      addWarning(context, 'migrate.unknownSettingDropped', `${path}.${key}`, `已忽略未知设置 ${key}`);
      continue;
    }
    const value = raw[key];
    if (rule.type === 'string') {
      output[key] = normalizedString(value, '', context, `${path}.${key}`, rule.max);
    } else if (rule.type === 'enum') {
      const normalized = String(value || '').trim();
      if (!rule.values.includes(normalized)) addError(context, 'invalid.settingEnum', `${path}.${key}`, `允许值：${rule.values.join(', ')}`);
      else output[key] = normalized;
    } else if (rule.type === 'boolean') {
      const normalized = normalizeBoolean(value, context, `${path}.${key}`);
      if (normalized !== null) output[key] = normalized;
    } else {
      const normalized = finiteNumber(value, context, `${path}.${key}`, rule);
      if (normalized !== null) output[key] = normalized;
    }
  }
  return output;
}

function normalizeDataRows(raw, context, path) {
  if (!Array.isArray(raw)) {
    addError(context, 'invalid.dataRows', path, 'dataRows 必须是数组');
    return [];
  }
  if (raw.length > LIMITS.dataRows) {
    addError(context, 'limit.dataRows', path, `dataRows 最多 ${LIMITS.dataRows} 行`);
    return [];
  }
  return raw.map((row, rowIndex) => {
    const rowPath = `${path}[${rowIndex}]`;
    if (!isPlainObject(row)) {
      addError(context, 'invalid.dataRow', rowPath, '数据行必须是对象');
      return null;
    }
    const keys = Object.keys(row);
    if (keys.length > LIMITS.fieldsPerRow) {
      addError(context, 'limit.dataFields', rowPath, `每行最多 ${LIMITS.fieldsPerRow} 个字段`);
      return null;
    }
    const output = {};
    for (const key of keys) {
      if (!key.trim() || key.length > LIMITS.dataKeyLength) {
        addError(context, 'invalid.dataKey', `${rowPath}.${key}`, `字段名不能为空且不能超过 ${LIMITS.dataKeyLength} 个字符`);
        continue;
      }
      const value = row[key];
      if (value == null) output[key] = '';
      else if (['string', 'number', 'boolean'].includes(typeof value)) {
        output[key] = String(value);
        if (typeof value !== 'string') addWarning(context, 'migrate.dataValue', `${rowPath}.${key}`, '数据值已转换为文本');
      } else {
        addError(context, 'invalid.dataValue', `${rowPath}.${key}`, '数据单元格只能是文本、数字、布尔值或空值');
      }
      if (output[key] && output[key].length > LIMITS.stringLength) {
        addError(context, 'limit.stringLength', `${rowPath}.${key}`, `字符串不能超过 ${LIMITS.stringLength} 个字符`);
      }
    }
    return output;
  }).filter(Boolean);
}

function collectionStats(data) {
  return {
    projects: data.projects.length,
    templates: data.templates.length,
    dataRows: data.dataRows.length,
    settings: Object.keys(data.settings).length,
    elements: [...data.projects, ...data.templates]
      .reduce((sum, item) => sum + item.document.elements.length, 0)
  };
}

function normalizeCollections(raw, context, path = '$') {
  if (!isPlainObject(raw)) {
    addError(context, 'invalid.root', path, '备份根节点必须是对象');
    return null;
  }
  const templateSource = raw.templates == null && Array.isArray(raw.userTemplates)
    ? raw.userTemplates
    : raw.templates;
  if (raw.templates == null && Array.isArray(raw.userTemplates)) {
    addWarning(context, 'migrate.userTemplates', `${path}.userTemplates`, '旧字段 userTemplates 已迁移为 templates');
  }
  return {
    projects: normalizeCollection(raw.projects == null ? [] : raw.projects, 'project', LIMITS.projects, context, `${path}.projects`),
    templates: normalizeCollection(templateSource == null ? [] : templateSource, 'template', LIMITS.templates, context, `${path}.templates`),
    settings: normalizeSettings(raw.settings == null ? {} : raw.settings, context, `${path}.settings`),
    dataRows: normalizeDataRows(raw.dataRows == null ? [] : raw.dataRows, context, `${path}.dataRows`)
  };
}

function resultFailure(context) {
  return { ok: false, backup: null, data: null, stats: null, errors: context.errors, warnings: context.warnings };
}

function validateBackup(input) {
  const context = { errors: [], warnings: [] };
  const parsed = parseInput(input, context);
  if (context.errors.length) return resultFailure(context);
  inspectInputGraph(parsed, context);
  if (context.errors.length) return resultFailure(context);
  if (!isPlainObject(parsed)) {
    addError(context, 'invalid.root', '$', '备份根节点必须是对象');
    return resultFailure(context);
  }

  const rawSchema = parsed.schemaVersion == null ? 0 : Number(parsed.schemaVersion);
  if (!Number.isInteger(rawSchema) || rawSchema < 0 || rawSchema > SCHEMA_VERSION) {
    addError(context, 'unsupported.schema', '$.schemaVersion', `仅支持备份版本 0-${SCHEMA_VERSION}`);
    return resultFailure(context);
  }
  if (rawSchema === 0) addWarning(context, 'migrate.schema', '$.schemaVersion', '旧版备份已迁移到版本 1');
  const rawData = isPlainObject(parsed.data) ? parsed.data : parsed;
  if (rawData !== parsed) addWarning(context, 'migrate.dataEnvelope', '$.data', '旧版 data 包装已展开');
  const data = normalizeCollections(rawData, context);
  if (context.errors.length || !data) return resultFailure(context);

  let exportedAt = '';
  if (parsed.exportedAt != null && String(parsed.exportedAt).trim()) {
    const date = new Date(parsed.exportedAt);
    if (Number.isNaN(date.getTime())) addWarning(context, 'migrate.exportedAt', '$.exportedAt', '无效导出时间已忽略');
    else exportedAt = date.toISOString();
  }
  const backup = { schemaVersion: SCHEMA_VERSION, exportedAt, ...data };
  return {
    ok: true,
    backup,
    data,
    stats: collectionStats(data),
    errors: [],
    warnings: context.warnings,
    sourceSchemaVersion: rawSchema
  };
}

function buildBackup(source, options = {}) {
  const context = { errors: [], warnings: [] };
  inspectInputGraph(source, context);
  if (context.errors.length) return resultFailure(context);
  const data = normalizeCollections(source, context);
  if (context.errors.length || !data) return resultFailure(context);
  const now = options.now == null ? new Date() : new Date(options.now);
  if (Number.isNaN(now.getTime())) {
    addError(context, 'invalid.exportedAt', '$.exportedAt', '导出时间无效');
    return resultFailure(context);
  }
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...data
  };
  return {
    ok: true,
    backup,
    data,
    stats: collectionStats(data),
    errors: [],
    warnings: context.warnings
  };
}

function mergeRecords(current, incoming) {
  const used = new Set(current.map((item) => item.id));
  const added = [];
  const renamed = [];
  incoming.forEach((item) => {
    const next = copyJsonValue(item, { errors: [], warnings: [] }, '$');
    const nextId = stableUniqueId(item.id, used);
    if (nextId !== item.id) renamed.push({ from: item.id, to: nextId });
    next.id = nextId;
    used.add(nextId);
    added.push(next);
  });
  return { records: [...current, ...added], renamed };
}

function restoreBackup(input, current, options = {}) {
  const strategy = options.strategy || 'replace';
  if (!['replace', 'merge'].includes(strategy)) {
    return {
      ok: false,
      backup: null,
      data: null,
      stats: null,
      errors: [issue('invalid.strategy', '$.strategy', '恢复策略只能是 replace 或 merge')],
      warnings: []
    };
  }
  const imported = validateBackup(input);
  if (!imported.ok) return imported;
  if (strategy === 'replace') {
    const data = copyJsonValue(imported.data, { errors: [], warnings: [] }, '$');
    return {
      ok: true,
      backup: imported.backup,
      data,
      stats: {
        strategy,
        projects: { previous: Array.isArray(current && current.projects) ? current.projects.length : 0, added: data.projects.length, renamed: 0, total: data.projects.length },
        templates: { previous: Array.isArray(current && (current.templates || current.userTemplates)) ? (current.templates || current.userTemplates).length : 0, added: data.templates.length, renamed: 0, total: data.templates.length },
        dataRows: { previous: Array.isArray(current && current.dataRows) ? current.dataRows.length : 0, added: data.dataRows.length, total: data.dataRows.length },
        settings: Object.keys(data.settings).length
      },
      errors: [],
      warnings: imported.warnings
    };
  }

  const context = { errors: [], warnings: [] };
  inspectInputGraph(current, context, '$.current');
  if (context.errors.length) return resultFailure(context);
  const normalizedCurrent = normalizeCollections(current || {}, context, '$.current');
  if (context.errors.length || !normalizedCurrent) return resultFailure(context);

  const projects = mergeRecords(normalizedCurrent.projects, imported.data.projects);
  const templates = mergeRecords(normalizedCurrent.templates, imported.data.templates);
  const totalRows = normalizedCurrent.dataRows.length + imported.data.dataRows.length;
  if (projects.records.length > LIMITS.projects) addError(context, 'limit.projects', '$.projects', `合并后项目不能超过 ${LIMITS.projects} 个`);
  if (templates.records.length > LIMITS.templates) addError(context, 'limit.templates', '$.templates', `合并后模板不能超过 ${LIMITS.templates} 个`);
  if (totalRows > LIMITS.dataRows) addError(context, 'limit.dataRows', '$.dataRows', `合并后数据行不能超过 ${LIMITS.dataRows} 行`);
  if (context.errors.length) return resultFailure({ errors: context.errors, warnings: [...imported.warnings, ...context.warnings] });

  // Merge never changes an existing device/editor preference. Imported
  // settings only fill keys that do not yet exist; replace is the explicit
  // operation for restoring all preferences.
  const settings = { ...imported.data.settings, ...normalizedCurrent.settings };
  const data = {
    projects: projects.records,
    templates: templates.records,
    settings,
    dataRows: [...normalizedCurrent.dataRows, ...imported.data.dataRows]
  };
  return {
    ok: true,
    backup: imported.backup,
    data,
    stats: {
      strategy,
      projects: { previous: normalizedCurrent.projects.length, added: imported.data.projects.length, renamed: projects.renamed.length, total: data.projects.length, conflicts: projects.renamed },
      templates: { previous: normalizedCurrent.templates.length, added: imported.data.templates.length, renamed: templates.renamed.length, total: data.templates.length, conflicts: templates.renamed },
      dataRows: { previous: normalizedCurrent.dataRows.length, added: imported.data.dataRows.length, total: data.dataRows.length },
      settings: Object.keys(data.settings).length
    },
    errors: [],
    warnings: [...imported.warnings, ...context.warnings]
  };
}

module.exports = {
  LIMITS,
  SCHEMA_VERSION,
  buildBackup,
  restoreBackup,
  stableUniqueId,
  validateBackup
};
