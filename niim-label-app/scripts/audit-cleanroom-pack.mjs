import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const APP_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const CLEANROOM_GATE_VERSION = '1.1.0';

export const KNOWN_PROFILE_IDS = Object.freeze([
  'd110',
  'd11-legacy',
  'b1',
  'b21',
  'b21-c2b',
  'b21s'
]);

const CODE_TYPES = new Set(['barcode', 'qrcode', 'qr']);
const FORBIDDEN_BRAND_PATTERN = /(?:精臣|精诚|niim(?:bot)?)/i;
const FORBIDDEN_SOURCE_VALUE_PATTERN = /(?:精臣|精诚|niim(?:bot)?|online[-_ ](?:template|image|thumb)|authorized[-_ ]catalog|competitor|third[-_ ]party)/i;
const REMOTE_REFERENCE_PATTERN = /(?:https?:\/\/|ftp:\/\/|(?:^|[^:])\/\/[a-z0-9])/i;
const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const MOBILE_PATTERN = /(?:^|\D)(?:\+?86[-\s]?)?1[3-9]\d{9}(?:\D|$)/;
const LANDLINE_PATTERN = /(?:^|\D)0\d{2,3}[-\s]?\d{7,8}(?:\D|$)/;
const CONTACT_HANDLE_PATTERN = /(?:微信|wechat|qq|电话|手机|tel)\s*[:：#-]?\s*[a-z0-9_-]{5,}/i;
const SOURCE_ID_KEY_PATTERN = /^(?:source|external|remote|competitor|thirdParty|original(?:Template)?|referenceTemplate|niim(?:bot)?)(?:Template)?Ids?$/i;
const ASSET_KEY_PATTERN = /(?:asset|image|thumb|preview|src|url|uri|path|logo|background)/i;
const CLEANROOM_PROVENANCE_PATTERN = /(?:shangyue|clean[-_ ]?room|商跃(?:原创|独立设计)?)/i;
const CLEANROOM_AUTHORSHIP_PATTERN = /(?:shangyue[-_ ]clean[-_ ]room|商跃(?:原创|独立设计|设计团队))/i;
const SHANGYUE_COPYRIGHT_PATTERN = /(?:©|copyright|版权).*(?:商跃|shangyue)|(?:商跃|shangyue).*(?:©|copyright|版权)/i;

const STRUCTURAL_ELEMENT_FIELDS = Object.freeze([
  'type',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'fontSize',
  'bold',
  'italic',
  'underline',
  'strike',
  'reverse',
  'align',
  'verticalAlign',
  'direction',
  'letterSpacing',
  'lineSpacing',
  'wordWrap',
  'lineWidth',
  'filled',
  'dashed',
  'shapeKind',
  'format',
  'showText',
  'textPosition',
  'errorCorrection',
  'rows',
  'columns',
  'symbol',
  'dateRole',
  'mirrorX',
  'mirrorY',
  'locked'
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function textValue(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function firstDeclared(layers, keys) {
  for (const layer of layers) {
    if (!isObject(layer)) continue;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(layer, key) && hasValue(layer[key])) {
        return layer[key];
      }
    }
  }
  return undefined;
}

function firstBoolean(layers, keys) {
  for (const layer of layers) {
    if (!isObject(layer)) continue;
    for (const key of keys) {
      if (typeof layer[key] === 'boolean') return layer[key];
    }
  }
  return undefined;
}

function addIssue(report, issue) {
  const normalized = Object.assign({ severity: 'blocker' }, issue);
  const key = JSON.stringify([
    normalized.code,
    normalized.templateId || '',
    normalized.elementId || '',
    normalized.path || '',
    normalized.message || ''
  ]);
  if (report._issueKeys.has(key)) return;
  report._issueKeys.add(key);
  report.issues.push(normalized);
}

function walkObject(value, visit, currentPath = '', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${currentPath}[${index}]`;
      visit(item, String(index), itemPath);
      walkObject(item, visit, itemPath, seen);
    });
    return;
  }
  Object.entries(value).forEach(([key, item]) => {
    const itemPath = currentPath ? `${currentPath}.${key}` : key;
    visit(item, key, itemPath);
    walkObject(item, visit, itemPath, seen);
  });
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function signatureNumber(value) {
  const number = numeric(value);
  if (!Number.isFinite(number)) return null;
  // A 0.1 mm grid also catches cosmetic nudges that do not constitute a
  // genuinely new composition.
  return Math.round(number * 10) / 10;
}

function structuralElement(element) {
  const output = {};
  STRUCTURAL_ELEMENT_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(element, key)) return;
    const value = element[key];
    output[key] = typeof value === 'number' ? signatureNumber(value) : value;
  });
  return output;
}

export function layoutSignature(documentValue) {
  if (!isObject(documentValue)) return '';
  const elements = Array.isArray(documentValue.elements)
    ? documentValue.elements.filter(isObject).map(structuralElement)
    : [];
  elements.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const structure = {
    widthMm: signatureNumber(documentValue.widthMm ?? documentValue.width),
    heightMm: signatureNumber(documentValue.heightMm ?? documentValue.height),
    elements
  };
  return createHash('sha256').update(JSON.stringify(structure)).digest('hex').slice(0, 20);
}

function extractTemplates(pack) {
  if (Array.isArray(pack)) return pack;
  if (!isObject(pack)) return [];
  for (const key of ['templates', 'records', 'catalog', 'items', 'PUBLIC_TEMPLATES', 'CLEANROOM_TEMPLATE_PACK']) {
    if (Array.isArray(pack[key])) return pack[key];
  }
  if (isObject(pack.default)) return extractTemplates(pack.default);
  return [];
}

function documentFor(template, pack, options) {
  for (const value of [template.document, template.layout, template.doc]) {
    if (isObject(value)) return value;
  }
  const id = String(template.id || '');
  for (const collection of [pack.documents, pack.layouts]) {
    if (isObject(collection) && isObject(collection[id])) return collection[id];
  }
  if (Number.isFinite(Number(template.widthMm ?? template.width)) && Array.isArray(template.elements)) {
    return template;
  }
  if (typeof options.buildDocument === 'function') {
    try {
      return options.buildDocument(template);
    } catch (error) {
      return { __buildError: error };
    }
  }
  return null;
}

function templateIdentity(template, index) {
  return String(template && template.id || `record-${index + 1}`);
}

function scanOwnership(template, documentValue, report, templateId) {
  const meta = isObject(documentValue && documentValue.templateMeta)
    ? documentValue.templateMeta
    : {};
  const catalogMeta = isObject(template.meta) ? template.meta : {};
  const layers = [template, catalogMeta, meta];
  const provenance = firstDeclared(layers, ['provenance', 'origin', 'designOrigin']);
  const authorship = firstDeclared(layers, ['authorship', 'author', 'designedBy']);
  const copyright = firstDeclared(layers, ['copyright', 'copyrightNotice']);
  const thirdPartyAssets = firstBoolean(layers, ['thirdPartyAssets']);

  if (!hasValue(provenance)) {
    addIssue(report, {
      code: 'PROVENANCE_REQUIRED',
      templateId,
      message: '缺少 clean-room 来源声明'
    });
  } else if (!CLEANROOM_PROVENANCE_PATTERN.test(textValue(provenance))) {
    addIssue(report, {
      code: 'INVALID_PROVENANCE',
      templateId,
      message: '来源声明未明确属于商跃独立 clean-room 设计'
    });
  }

  if (!hasValue(authorship)) {
    addIssue(report, {
      code: 'AUTHORSHIP_REQUIRED',
      templateId,
      message: '缺少原创作者声明'
    });
  } else if (!CLEANROOM_AUTHORSHIP_PATTERN.test(textValue(authorship))) {
    addIssue(report, {
      code: 'INVALID_AUTHORSHIP',
      templateId,
      message: '作者声明不是商跃 clean-room 设计'
    });
  }

  if (!hasValue(copyright)) {
    addIssue(report, {
      code: 'COPYRIGHT_REQUIRED',
      templateId,
      message: '缺少商跃版权声明'
    });
  } else if (!SHANGYUE_COPYRIGHT_PATTERN.test(textValue(copyright))) {
    addIssue(report, {
      code: 'INVALID_COPYRIGHT',
      templateId,
      message: '版权声明未归属商跃'
    });
  }

  if (thirdPartyAssets !== false) {
    addIssue(report, {
      code: 'THIRD_PARTY_ASSET_DECLARATION_REQUIRED',
      templateId,
      message: '必须显式声明 thirdPartyAssets: false'
    });
  }
}

function scanForbiddenData(template, documentValue, report, templateId) {
  const scanRoot = { template, document: documentValue };
  walkObject(scanRoot, (value, key, valuePath) => {
    if (SOURCE_ID_KEY_PATTERN.test(key) && hasValue(value)) {
      addIssue(report, {
        code: 'THIRD_PARTY_SOURCE_ID',
        templateId,
        path: valuePath,
        message: '不允许保留竞品或第三方源 ID'
      });
    }
    // Parent objects stringify all of their descendants and would turn one
    // bad leaf into many duplicate findings. Only inspect scalar leaves.
    if (value && typeof value === 'object') return;
    const string = textValue(value).trim();
    if (!string) return;

    if (FORBIDDEN_BRAND_PATTERN.test(string)) {
      addIssue(report, {
        code: 'FORBIDDEN_COMPETITOR_BRAND',
        templateId,
        path: valuePath,
        message: '内容或元数据中含有竞品品牌'
      });
    }

    if (['source', 'origin', 'provider', 'vendor'].includes(key)
      && FORBIDDEN_SOURCE_VALUE_PATTERN.test(string)) {
      addIssue(report, {
        code: 'FORBIDDEN_THIRD_PARTY_SOURCE',
        templateId,
        path: valuePath,
        message: '来源字段指向竞品或第三方'
      });
    }

    if (REMOTE_REFERENCE_PATTERN.test(string)) {
      addIssue(report, {
        code: 'REMOTE_REFERENCE_FORBIDDEN',
        templateId,
        path: valuePath,
        message: '禁止 HTTP/FTP 网址与远程资源'
      });
      if (ASSET_KEY_PATTERN.test(key)) {
        addIssue(report, {
          code: 'REMOTE_ASSET_FORBIDDEN',
          templateId,
          path: valuePath,
          message: '素材必须是已确认权属的本地资源'
        });
      }
    }

    if (ASSET_KEY_PATTERN.test(key) && FORBIDDEN_SOURCE_VALUE_PATTERN.test(string)) {
      addIssue(report, {
        code: 'THIRD_PARTY_ASSET_PATH',
        templateId,
        path: valuePath,
        message: '素材路径不得指向竞品或第三方资源包'
      });
    }

    if (EMAIL_PATTERN.test(string)
      || MOBILE_PATTERN.test(string)
      || LANDLINE_PATTERN.test(string)
      || CONTACT_HANDLE_PATTERN.test(string)) {
      addIssue(report, {
        code: 'REAL_CONTACT_FORBIDDEN',
        templateId,
        path: valuePath,
        message: '模板不得携带真实或可信联系方式'
      });
    }
  });
}

function scanGeometry(documentValue, report, templateId, tolerance) {
  const width = numeric(documentValue.widthMm ?? documentValue.width);
  const height = numeric(documentValue.heightMm ?? documentValue.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    addIssue(report, {
      code: 'INVALID_DOCUMENT_SIZE',
      templateId,
      message: '标签宽高必须是正数'
    });
    return;
  }
  const elements = Array.isArray(documentValue.elements) ? documentValue.elements : null;
  if (!elements) {
    addIssue(report, {
      code: 'ELEMENTS_REQUIRED',
      templateId,
      message: 'document.elements 必须是数组'
    });
    return;
  }
  if (elements.length === 0) {
    addIssue(report, {
      code: 'EMPTY_LAYOUT',
      templateId,
      message: '模板布局不能为空'
    });
  }

  elements.forEach((element, index) => {
    const elementId = String(element && element.id || `element-${index + 1}`);
    if (!isObject(element)) {
      addIssue(report, {
        code: 'INVALID_ELEMENT',
        templateId,
        elementId,
        message: '元素必须是对象'
      });
      return;
    }
    const x = numeric(element.x);
    const y = numeric(element.y);
    const elementWidth = numeric(element.width);
    const elementHeight = numeric(element.height);
    if (![x, y, elementWidth, elementHeight].every(Number.isFinite)
      || elementWidth <= 0
      || elementHeight <= 0) {
      addIssue(report, {
        code: 'INVALID_ELEMENT_GEOMETRY',
        templateId,
        elementId,
        message: '元素坐标和尺寸必须有效，且宽高必须为正数'
      });
      return;
    }

    const radians = numeric(element.rotation || 0) * Math.PI / 180;
    const centerX = x + elementWidth / 2;
    const centerY = y + elementHeight / 2;
    const halfWidth = (
      Math.abs(elementWidth * Math.cos(radians))
      + Math.abs(elementHeight * Math.sin(radians))
    ) / 2;
    const halfHeight = (
      Math.abs(elementWidth * Math.sin(radians))
      + Math.abs(elementHeight * Math.cos(radians))
    ) / 2;
    const bounds = {
      left: centerX - halfWidth,
      top: centerY - halfHeight,
      right: centerX + halfWidth,
      bottom: centerY + halfHeight
    };
    if (bounds.left < -tolerance
      || bounds.top < -tolerance
      || bounds.right > width + tolerance
      || bounds.bottom > height + tolerance) {
      addIssue(report, {
        code: 'ELEMENT_OUT_OF_BOUNDS',
        templateId,
        elementId,
        message: '元素旋转后超出标签边界',
        details: { bounds, document: { width, height } }
      });
    }

    const type = String(element.type || '').trim().toLowerCase();
    if (CODE_TYPES.has(type)) {
      report.summary.codesChecked += 1;
      if (element.requiresInput !== true) {
        addIssue(report, {
          code: 'CODE_REQUIRES_INPUT',
          templateId,
          elementId,
          message: '条码/二维码示例值必须设置 requiresInput: true'
        });
      }
    }
  });
}

function declaredProfiles(template, documentValue) {
  const meta = isObject(documentValue && documentValue.templateMeta)
    ? documentValue.templateMeta
    : {};
  const catalogMeta = isObject(template.meta) ? template.meta : {};
  const value = firstDeclared(
    [template, catalogMeta, meta],
    ['verifiedProfiles', 'printableProfiles', 'printProfiles', 'supportedProfiles']
  );
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return [];
}

function scanProfiles(template, documentValue, report, templateId, options) {
  const profiles = declaredProfiles(template, documentValue);
  // A template is a physical label design, not a BLE-model entitlement.
  // Publishing, editing and previewing therefore require no printer claim.
  // If a pack chooses to advertise compatibility, however, the release gate
  // must be able to substantiate every claim instead of treating a known id as
  // proof that the document fits that printer.
  if (profiles.length === 0) return;
  const knownProfiles = new Set(options.knownProfileIds || KNOWN_PROFILE_IDS);
  profiles.forEach((profileId) => {
    report.summary.profileClaimsChecked += 1;
    if (!knownProfiles.has(profileId)) {
      addIssue(report, {
        code: 'UNKNOWN_PRINT_PROFILE',
        templateId,
        message: `未知打印 profile: ${profileId}`
      });
      return;
    }
    if (typeof options.validateProfile !== 'function') {
      addIssue(report, {
        code: 'PROFILE_CLAIM_UNVERIFIED',
        templateId,
        message: `${profileId} 兼容声明缺少可打印性校验；请删除该声明或提供 validateProfile`
      });
      return;
    }
    try {
      options.validateProfile(documentValue, profileId);
    } catch (error) {
      addIssue(report, {
        code: 'PROFILE_PRINTABILITY_FAILED',
        templateId,
        message: `${profileId} 可打印性校验失败: ${error.message}`
      });
    }
  });
}

/**
 * Audits a standalone clean-room pack. A pack may be an array or an object
 * containing templates/records/catalog. Documents can be embedded on each
 * record, keyed under pack.documents, or supplied by options.buildDocument.
 */
export function auditCleanroomPack(pack, options = {}) {
  const templates = extractTemplates(pack);
  const report = {
    gate: 'shangyue-cleanroom-release',
    gateVersion: CLEANROOM_GATE_VERSION,
    source: options.source || 'in-memory-pack',
    passed: false,
    summary: {
      templates: templates.length,
      documents: 0,
      uniqueTemplateIds: 0,
      layoutSignatures: 0,
      codesChecked: 0,
      profileClaimsChecked: 0,
      blockers: 0,
      findingsByCode: {}
    },
    issues: [],
    fingerprints: {},
    _issueKeys: new Set()
  };

  if (templates.length === 0) {
    addIssue(report, {
      code: 'NO_TEMPLATES',
      message: '待发布 clean-room pack 中没有模板'
    });
  }

  const ids = new Map();
  const signatures = new Map();
  templates.forEach((template, index) => {
    if (!isObject(template)) {
      addIssue(report, {
        code: 'INVALID_TEMPLATE_RECORD',
        templateId: `record-${index + 1}`,
        message: '模板记录必须是对象'
      });
      return;
    }
    const templateId = templateIdentity(template, index);
    if (!hasValue(template.id)) {
      addIssue(report, {
        code: 'TEMPLATE_ID_REQUIRED',
        templateId,
        message: '模板必须有稳定 ID'
      });
    } else if (ids.has(templateId)) {
      addIssue(report, {
        code: 'DUPLICATE_TEMPLATE_ID',
        templateId,
        message: `模板 ID 重复，首次出现于第 ${ids.get(templateId) + 1} 条`
      });
    } else {
      ids.set(templateId, index);
    }

    const documentValue = documentFor(template, pack, options);
    if (documentValue && documentValue.__buildError) {
      addIssue(report, {
        code: 'LAYOUT_BUILD_FAILED',
        templateId,
        message: `布局构建失败: ${documentValue.__buildError.message}`
      });
      return;
    }
    if (!isObject(documentValue)) {
      addIssue(report, {
        code: 'DOCUMENT_REQUIRED',
        templateId,
        message: '模板缺少可审核的 document/layout'
      });
      return;
    }
    report.summary.documents += 1;

    scanOwnership(template, documentValue, report, templateId);
    scanForbiddenData(template, documentValue, report, templateId);
    scanGeometry(documentValue, report, templateId, Number(options.geometryToleranceMm ?? 0.05));
    scanProfiles(template, documentValue, report, templateId, options);

    const signature = layoutSignature(documentValue);
    report.fingerprints[templateId] = signature;
    if (signature) {
      if (signatures.has(signature)) {
        addIssue(report, {
          code: 'DUPLICATE_LAYOUT_SIGNATURE',
          templateId,
          message: `布局结构与 ${signatures.get(signature)} 相同，疑似只替换了文案`,
          details: { duplicateOf: signatures.get(signature), signature }
        });
      } else {
        signatures.set(signature, templateId);
      }
    }
  });

  report.summary.uniqueTemplateIds = ids.size;
  report.summary.layoutSignatures = signatures.size;
  report.summary.blockers = report.issues.length;
  report.issues.forEach((issue) => {
    report.summary.findingsByCode[issue.code] = (report.summary.findingsByCode[issue.code] || 0) + 1;
  });
  report.passed = report.summary.blockers === 0;
  delete report._issueKeys;
  return report;
}

function applicationProfileAuditOptions() {
  const { PROFILES, alignedCanvasSize } = require(path.join(APP_ROOT, 'src/core/profiles.js'));
  const profilesById = new Map(PROFILES.map((profile) => [profile.id, profile]));
  return {
    knownProfileIds: PROFILES.map((profile) => profile.id),
    validateProfile(documentValue, profileId) {
      const profile = profilesById.get(profileId);
      if (!profile) throw new Error(`未知打印 profile: ${profileId}`);
      alignedCanvasSize(documentValue, profile);
    }
  };
}

export function auditPublicCatalog(options = {}) {
  const { PUBLIC_TEMPLATES } = require(path.join(APP_ROOT, 'src/app/catalog.js'));
  const { buildTemplateDocument } = require(path.join(APP_ROOT, 'src/app/template-layouts.js'));
  return auditCleanroomPack(
    { templates: PUBLIC_TEMPLATES },
    Object.assign(applicationProfileAuditOptions(), {
      source: 'public-catalog',
      buildDocument: buildTemplateDocument
    }, options)
  );
}

async function loadPack(packPath) {
  const absolutePath = path.resolve(process.cwd(), packPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`clean-room pack 不存在: ${absolutePath}`);
  }
  if (path.extname(absolutePath).toLowerCase() === '.json') {
    return {
      source: path.relative(process.cwd(), absolutePath).replaceAll('\\', '/'),
      pack: JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
      options: applicationProfileAuditOptions()
    };
  }
  const moduleValue = await import(`${pathToFileURL(absolutePath).href}?audit=${Date.now()}`);
  const exported = moduleValue.default || moduleValue.CLEANROOM_PACK || moduleValue.cleanroomPack || moduleValue;
  const buildDocument = moduleValue.buildTemplateDocument
    || moduleValue.buildCleanroomDocument
    || moduleValue.buildDocument
    || exported.buildTemplateDocument
    || exported.buildCleanroomDocument
    || exported.buildDocument;
  return {
    source: path.relative(process.cwd(), absolutePath).replaceAll('\\', '/'),
    pack: exported,
    options: Object.assign(
      applicationProfileAuditOptions(),
      typeof buildDocument === 'function' ? { buildDocument } : {}
    )
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const packPath = args.find((argument) => !argument.startsWith('--'));
  let report;
  try {
    if (!packPath || args.includes('--public-catalog')) {
      report = auditPublicCatalog();
    } else {
      const loaded = await loadPack(packPath);
      report = auditCleanroomPack(
        loaded.pack,
        Object.assign({ source: loaded.source }, loaded.options)
      );
    }
  } catch (error) {
    report = {
      gate: 'shangyue-cleanroom-release',
      gateVersion: CLEANROOM_GATE_VERSION,
      source: packPath || 'public-catalog',
      passed: false,
      summary: { templates: 0, blockers: 1, findingsByCode: { AUDIT_INPUT_ERROR: 1 } },
      issues: [{
        severity: 'blocker',
        code: 'AUDIT_INPUT_ERROR',
        message: error.message
      }],
      fingerprints: {}
    };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  await runCli();
}
