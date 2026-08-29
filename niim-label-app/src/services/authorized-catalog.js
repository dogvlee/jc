'use strict';

/**
 * Read-only client for the public NIIM catalog endpoints that the project is
 * authorised to redistribute. This module intentionally exposes no generic
 * request method, so account, private-template and shared-inbox endpoints
 * cannot be reached through it by accident.
 */
const { importNiimTemplate } = require('../core/niim-template-import');

const DEFAULT_BASE_URL = 'https://print.niimbot.com/api';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PAGE_LIMIT = 100;

const PUBLIC_ENDPOINTS = Object.freeze({
  industryTemplates: '/industryTemplate/page',
  materials: '/materialLib/page',
  borders: '/material-borders/page'
});

class AuthorizedCatalogError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'AuthorizedCatalogError';
    this.code = code || 'CATALOG_ERROR';
    if (details !== undefined) this.details = details;
  }
}

function nonEmpty(value) {
  if (value == null) return '';
  const text = String(value).trim();
  return text;
}

function firstNonEmpty() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = nonEmpty(arguments[index]);
    if (value) return value;
  }
  return '';
}

function safeRemoteUrl(value) {
  const url = nonEmpty(value);
  return /^https:\/\//i.test(url) ? url : '';
}

function sanitizedRemoteTemplate(raw, id, name, width, height) {
  const source = Object.assign({}, raw, { id, name, width, height });
  source.elements = (Array.isArray(raw.elements) ? raw.elements : []).map((element) => {
    if (!element || typeof element !== 'object') return element;
    const type = nonEmpty(element.type).toLowerCase();
    if (!['image', 'picture', 'logo'].includes(type)) return Object.assign({}, element);
    const clean = Object.assign({}, element);
    for (const field of ['imageUrl', 'localImageUrl', 'ninePatchUrl', 'localUrl']) {
      if (field in clean) clean[field] = safeRemoteUrl(clean[field]);
    }
    return clean;
  });
  return source;
}

function remoteId(raw, kind) {
  if (!raw || typeof raw !== 'object' || raw.id == null || nonEmpty(raw.id) === '') {
    throw new AuthorizedCatalogError(kind + ' 缺少 id', 'INVALID_ITEM', { kind });
  }
  return raw.id;
}

function asPositiveNumber(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new AuthorizedCatalogError(label + ' 必须是正数', 'INVALID_ARGUMENT', { label, value });
  }
  return result;
}

function asPositiveInteger(value, fallback, label, maximum) {
  const candidate = value == null ? fallback : Number(value);
  if (!Number.isInteger(candidate) || candidate <= 0 || (maximum && candidate > maximum)) {
    const range = maximum ? '（1-' + maximum + '）' : '';
    throw new AuthorizedCatalogError(label + ' 必须是正整数' + range, 'INVALID_ARGUMENT', {
      label,
      value,
      maximum: maximum || null
    });
  }
  return candidate;
}

function cleanKeyword(value) {
  if (value == null) return '';
  const keyword = String(value).trim();
  if (keyword.length > 200) {
    throw new AuthorizedCatalogError('keyword 不能超过 200 个字符', 'INVALID_ARGUMENT');
  }
  return keyword;
}

function localizedName(raw) {
  if (nonEmpty(raw && raw.name)) return nonEmpty(raw.name);
  const names = raw && Array.isArray(raw.names) ? raw.names : [];
  const chinese = names.find((item) => item && item.languageCode === 'zh-cn' && nonEmpty(item.name));
  const any = names.find((item) => item && nonEmpty(item.name));
  return firstNonEmpty(chinese && chinese.name, any && any.name);
}

function normalizedTags(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = nonEmpty(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function normalizeTemplate(raw) {
  const id = remoteId(raw, 'template');
  const width = asPositiveNumber(raw.width, 'template.width');
  const height = asPositiveNumber(raw.height, 'template.height');
  const name = localizedName(raw) || ('在线模板 ' + id);
  const importSource = sanitizedRemoteTemplate(raw, id, name, width, height);
  const imported = importNiimTemplate(importSource);
  const thumbSrc = safeRemoteUrl(firstNonEmpty(
    raw.thumbnail,
    raw.contentThumbnail,
    raw.previewImage,
    raw.backgroundImage
  ));
  const industry = firstNonEmpty(
    raw.industryName,
    raw.industry && raw.industry.name,
    raw.marketingCategoryName,
    raw.templateCategoryName,
    '行业模板'
  );
  const vip = Boolean(raw.vip || raw.hasVipRes);
  const elementTypes = (imported.document.elements || []).map((element) => element.type);
  const kind = elementTypes.includes('qrcode')
    ? 'qr'
    : (elementTypes.includes('barcode') ? 'barcode' : 'accent');

  return {
    id: 'online-' + id,
    name,
    size: [imported.meta.width, imported.meta.height],
    category: '线上',
    industry,
    kind,
    badge: vip ? 'VIP' : null,
    blurb: firstNonEmpty(raw.description, raw.summary, '精臣第三方在线模板 · 授权待核'),
    accent: '#E85D4C',
    uses: Number(raw.users != null ? raw.users : raw.use) || 0,
    source: 'authorized-niim',
    availability: 'remote',
    thumbSrc,
    document: imported.document,
    sourceMeta: Object.assign({}, imported.meta, {
      remoteId: id,
      endpoint: PUBLIC_ENDPOINTS.industryTemplates,
      thumbnail: thumbSrc,
      industry,
      marketingCategoryId: raw.marketingCategoryId == null ? null : raw.marketingCategoryId,
      marketingCategoryIds: Array.isArray(raw.marketingCategoryIds) ? raw.marketingCategoryIds.slice() : [],
      disabled: Boolean(raw.disabled)
    })
  };
}

function normalizeMaterial(raw) {
  const id = remoteId(raw, 'material');
  const sourceUrl = safeRemoteUrl(firstNonEmpty(raw.image, raw.imageUrl, raw.url, raw.previewUrl));
  if (!sourceUrl) {
    throw new AuthorizedCatalogError('material 缺少图片地址', 'INVALID_ITEM', { id });
  }
  const industry = firstNonEmpty(raw.materialIndustryName, raw.industryName);
  const category = firstNonEmpty(raw.materialCategoryName, raw.categoryName, industry, '在线素材');
  const label = localizedName(raw) || ('在线素材 ' + id);
  const tags = normalizedTags([
    category,
    industry,
    ...(Array.isArray(raw.tags) ? raw.tags : [])
  ]);

  return {
    id: 'niim-' + id,
    remoteId: id,
    label,
    category,
    tags,
    asset: sourceUrl,
    sourceUrl,
    vip: Boolean(raw.vip),
    source: 'authorized-niim',
    availability: 'remote',
    sourceMeta: {
      endpoint: PUBLIC_ENDPOINTS.materials,
      materialIndustryId: raw.materialIndustryId == null ? null : raw.materialIndustryId,
      materialIndustryName: industry,
      materialCategoryId: raw.materialCategoryId == null ? null : raw.materialCategoryId,
      materialCategoryName: category,
      disabled: Boolean(raw.disabled)
    }
  };
}

function normalizeBorder(raw) {
  const id = remoteId(raw, 'border');
  const sourceUrl = safeRemoteUrl(firstNonEmpty(raw.image, raw.imageUrl, raw.url));
  const ninePatch = raw.ninePatch && typeof raw.ninePatch === 'object'
    ? Object.assign({}, raw.ninePatch)
    : null;
  const previewSrc = safeRemoteUrl(firstNonEmpty(ninePatch && ninePatch.previewUrl, raw.previewUrl, sourceUrl));
  if (!sourceUrl && !previewSrc) {
    throw new AuthorizedCatalogError('border 缺少图片地址', 'INVALID_ITEM', { id });
  }
  const industry = firstNonEmpty(raw.borderIndustryName, raw.industryName, '线框');
  const category = firstNonEmpty(raw.borderCategoryName, raw.categoryName, industry, '边框');
  const label = localizedName(raw) || (category + ' ' + id);
  const tags = normalizedTags([
    category,
    industry,
    ...(Array.isArray(raw.tags) ? raw.tags : [])
  ]);

  return {
    id: 'niim-border-' + id,
    remoteId: id,
    type: 'image',
    label,
    category,
    tags,
    asset: sourceUrl || previewSrc,
    sourceUrl: sourceUrl || previewSrc,
    previewSrc,
    vip: Boolean(raw.vip),
    source: 'authorized-niim',
    availability: 'remote',
    ninePatch,
    sourceMeta: {
      endpoint: PUBLIC_ENDPOINTS.borders,
      borderIndustryId: raw.borderIndustryId == null ? null : raw.borderIndustryId,
      borderIndustryName: industry,
      borderCategoryId: raw.borderCategoryId == null ? null : raw.borderCategoryId,
      borderCategoryName: category,
      disabled: Boolean(raw.disabled)
    }
  };
}

/**
 * Merge one or more catalog arrays by id. The first occurrence wins, which
 * lets bundled/offline items take precedence over a remote item with the same
 * `online-{remoteId}` id.
 */
function mergeById() {
  const result = [];
  const seen = new Set();
  for (const collection of arguments) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      if (!item || item.id == null) continue;
      const id = String(item.id);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(item);
    }
  }
  return result;
}

function paginationFrom(data, itemCount) {
  const page = asPositiveInteger(data && data.page, 1, 'response.page');
  const limit = asPositiveInteger(data && data.limit, Math.max(1, itemCount || 1), 'response.limit');
  const totalValue = Number(data && data.total);
  if (!Number.isFinite(totalValue) || totalValue < 0) {
    throw new AuthorizedCatalogError('目录响应 total 无效', 'INVALID_RESPONSE', {
      total: data && data.total
    });
  }
  const total = Math.floor(totalValue);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const hasMore = page < totalPages;
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
    itemCount: Math.max(0, Number(itemCount) || 0)
  };
}

function validateEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AuthorizedCatalogError('目录响应不是 JSON 对象', 'INVALID_RESPONSE');
  }
  if (payload.code != null && Number(payload.code) !== 1) {
    throw new AuthorizedCatalogError(
      firstNonEmpty(payload.message, payload.msg, '目录接口返回失败'),
      'API_ERROR',
      { apiCode: payload.code }
    );
  }
  if (payload.status_code != null && Number(payload.status_code) !== 1) {
    throw new AuthorizedCatalogError(
      firstNonEmpty(payload.message, payload.msg, '目录接口返回失败'),
      'API_ERROR',
      { apiCode: payload.status_code }
    );
  }
  const data = payload.data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.list)) {
    throw new AuthorizedCatalogError('目录响应缺少 data.list', 'INVALID_RESPONSE');
  }
  return data;
}

function normalizePageResponse(payload, normalizeItem) {
  const data = validateEnvelope(payload);
  const items = [];
  for (let index = 0; index < data.list.length; index += 1) {
    try {
      items.push(normalizeItem(data.list[index]));
    } catch (_) {
      // Keep a public catalog page usable when one remote record is malformed.
    }
  }
  return Object.assign({
    items,
    received: data.list.length,
    skipped: data.list.length - items.length
  }, paginationFrom(data, items.length));
}

function createAuthorizedCatalogClient(options) {
  const config = options || {};
  const fetchImpl = config.fetchImpl || (
    typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch.bind(globalThis)
      : null
  );
  if (typeof fetchImpl !== 'function') {
    throw new AuthorizedCatalogError('当前环境没有 fetch，请通过 fetchImpl 注入', 'FETCH_UNAVAILABLE');
  }
  const baseUrl = nonEmpty(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!baseUrl) {
    throw new AuthorizedCatalogError('baseUrl 不能为空', 'INVALID_ARGUMENT');
  }
  const configuredLang = nonEmpty(config.lang || 'zh-cn') || 'zh-cn';
  const timeoutMs = asPositiveInteger(
    config.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    'timeoutMs',
    120000
  );

  async function postPage(endpointKey, body, requestOptions) {
    const path = PUBLIC_ENDPOINTS[endpointKey];
    if (!path) {
      throw new AuthorizedCatalogError('未授权的目录端点', 'ENDPOINT_NOT_ALLOWED');
    }
    const callerSignal = requestOptions && requestOptions.signal;
    if (callerSignal && callerSignal.aborted) {
      throw new AuthorizedCatalogError('目录请求已取消', 'ABORTED');
    }

    const Controller = typeof AbortController === 'function' ? AbortController : null;
    const controller = Controller ? new Controller() : null;
    let timedOut = false;
    let relayAbort = null;
    if (controller && callerSignal && typeof callerSignal.addEventListener === 'function') {
      relayAbort = () => controller.abort();
      callerSignal.addEventListener('abort', relayAbort, { once: true });
    }

    let timeoutHandle;
    const timeout = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        if (controller) controller.abort();
        reject(new AuthorizedCatalogError('目录请求超时', 'TIMEOUT', { timeoutMs }));
      }, timeoutMs);
    });

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'niimbot-user-agent': 'AppVersionName/6.6.6',
      lang: nonEmpty(body.languageCode) || configuredLang
    };

    try {
      const request = Promise.resolve().then(() => fetchImpl(baseUrl + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller ? controller.signal : callerSignal
      }));
      const response = await Promise.race([request, timeout]);
      if (!response || typeof response !== 'object') {
        throw new AuthorizedCatalogError('fetch 没有返回 Response', 'INVALID_RESPONSE');
      }
      if (response.ok === false) {
        throw new AuthorizedCatalogError(
          '目录请求失败（HTTP ' + Number(response.status || 0) + '）',
          'HTTP_ERROR',
          { status: Number(response.status || 0), endpoint: path }
        );
      }
      if (typeof response.json !== 'function') {
        throw new AuthorizedCatalogError('目录响应无法解析 JSON', 'INVALID_RESPONSE');
      }
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        throw new AuthorizedCatalogError('目录响应不是有效 JSON', 'INVALID_RESPONSE', {
          cause: error && error.message
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof AuthorizedCatalogError) throw error;
      if (timedOut) {
        throw new AuthorizedCatalogError('目录请求超时', 'TIMEOUT', { timeoutMs });
      }
      if ((callerSignal && callerSignal.aborted) || (error && error.name === 'AbortError')) {
        throw new AuthorizedCatalogError('目录请求已取消', 'ABORTED');
      }
      throw new AuthorizedCatalogError('目录网络请求失败', 'NETWORK_ERROR', {
        cause: error && error.message,
        endpoint: path
      });
    } finally {
      clearTimeout(timeoutHandle);
      if (relayAbort && callerSignal && typeof callerSignal.removeEventListener === 'function') {
        callerSignal.removeEventListener('abort', relayAbort);
      }
    }
  }

  async function fetchIndustryTemplates(requestOptions) {
    const request = requestOptions || {};
    const body = {
      page: asPositiveInteger(request.page, 1, 'page'),
      limit: asPositiveInteger(request.limit, 100, 'limit', MAX_PAGE_LIMIT),
      width: asPositiveNumber(request.width == null ? 999 : request.width, 'width'),
      height: asPositiveNumber(request.height == null ? 999 : request.height, 'height')
    };
    const languageCode = nonEmpty(request.languageCode);
    if (languageCode) body.languageCode = languageCode;
    const payload = await postPage('industryTemplates', body, request);
    return normalizePageResponse(payload, normalizeTemplate);
  }

  async function fetchMaterials(requestOptions) {
    const request = requestOptions || {};
    const body = {
      page: asPositiveInteger(request.page, 1, 'page'),
      limit: asPositiveInteger(request.limit, 100, 'limit', MAX_PAGE_LIMIT)
    };
    const keyword = cleanKeyword(request.keyword);
    if (keyword) body.keyword = keyword;
    const payload = await postPage('materials', body, request);
    return normalizePageResponse(payload, normalizeMaterial);
  }

  async function fetchBorders(requestOptions) {
    const request = requestOptions || {};
    const body = {
      page: asPositiveInteger(request.page, 1, 'page'),
      limit: asPositiveInteger(request.limit, 100, 'limit', MAX_PAGE_LIMIT)
    };
    const keyword = cleanKeyword(request.keyword);
    if (keyword) body.keyword = keyword;
    const payload = await postPage('borders', body, request);
    return normalizePageResponse(payload, normalizeBorder);
  }

  return Object.freeze({
    fetchIndustryTemplates,
    fetchMaterials,
    fetchBorders
  });
}

module.exports = {
  AuthorizedCatalogError,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  MAX_PAGE_LIMIT,
  PUBLIC_ENDPOINTS,
  createAuthorizedCatalogClient,
  normalizeTemplate,
  normalizeMaterial,
  normalizeBorder,
  normalizePageResponse,
  mergeById,
  paginationFrom
};
