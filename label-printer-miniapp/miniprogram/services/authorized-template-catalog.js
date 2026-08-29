/**
 * Public, read-only NIIMBOT template/material/border catalog client.
 *
 * It knows only three public catalog endpoints. It never sends account
 * credentials and has no user-template or VIP-authentication path. Catalog
 * records stay in memory; no remote assets are bundled into the package.
 */
const { importNiimTemplate } = require('../core/niim-template-import');

const API_URL = 'https://print.niimbot.com/api/industryTemplate/page';
const MATERIAL_API_URL = 'https://print.niimbot.com/api/materialLib/page';
const BORDER_API_URL = 'https://print.niimbot.com/api/material-borders/page';
const PAGE_LIMIT = 100;
const REQUEST_HEADERS = Object.freeze({
  'niimbot-user-agent': 'AppVersionName/6.6.6',
  lang: 'zh-cn',
  Accept: 'application/json',
  'Content-Type': 'application/json'
});

function positiveInteger(value, fallback, max) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max || Number.MAX_SAFE_INTEGER);
}

function sourceIdOf(item) {
  if (!item || typeof item !== 'object') return '';
  const fromMeta = item.sourceId
    || item.remoteId
    || (item.sourceMeta && item.sourceMeta.sourceId)
    || (item.document && item.document.templateMeta && item.document.templateMeta.sourceId);
  if (fromMeta != null && String(fromMeta).trim()) return String(fromMeta).trim();
  const id = String(item.id || '');
  return id.startsWith('online-') ? id.slice('online-'.length) : id;
}

function templateKind(document) {
  const elements = Array.isArray(document && document.elements) ? document.elements : [];
  if (elements.some((element) => element.type === 'qrcode')) return 'qr';
  if (elements.some((element) => element.type === 'barcode')) return 'barcode';
  return 'accent';
}

function safeRemoteUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) ? url : '';
}

function normalizeRemoteTemplate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('在线模板记录无效');
  const sourceId = raw.id == null ? '' : String(raw.id).trim();
  if (!sourceId) throw new Error('在线模板缺少来源 ID');
  const imported = importNiimTemplate(raw, { allowRemoteImages: true });
  const document = imported.document;
  const vip = Boolean(raw.vip || raw.hasVipRes);
  const thumbSrc = safeRemoteUrl(raw.thumbnail || raw.previewImage || raw.contentThumbnail);
  return {
    id: `online-${sourceId}`,
    sourceId,
    name: String(raw.name || document.name || `模板 ${sourceId}`),
    size: [document.widthMm, document.heightMm],
    category: '线上',
    industry: '行业模板',
    kind: templateKind(document),
    badge: vip ? 'VIP' : '',
    blurb: '第三方在线模板 · 授权待核',
    accent: '#E85D4C',
    uses: Number(raw.printed) || 0,
    source: 'remote-niim',
    thumbSrc,
    document,
    sourceMeta: Object.assign({}, imported.meta, {
      sourceId,
      vip,
      remote: true
    })
  };
}

function remoteId(raw, label) {
  if (!raw || typeof raw !== 'object') throw new Error(`在线${label}记录无效`);
  const id = raw.id == null ? '' : String(raw.id).trim();
  if (!id) throw new Error(`在线${label}缺少来源 ID`);
  return id;
}

function localizedName(raw, fallback) {
  const names = Array.isArray(raw && raw.names) ? raw.names : [];
  const localized = names.find((item) => item && String(item.languageCode || '').toLowerCase() === 'zh-cn');
  return String((localized && localized.name) || raw.name || fallback || '').trim();
}

function normalizeTags(values) {
  const result = [];
  for (const value of values || []) {
    const tag = String(value || '').trim();
    if (tag && !result.includes(tag)) result.push(tag);
  }
  return result;
}

function normalizeRemoteMaterial(raw) {
  const id = remoteId(raw, '素材');
  const asset = safeRemoteUrl(raw.image || raw.imageUrl || raw.url || raw.previewUrl);
  if (!asset) throw new Error('在线素材缺少 HTTPS 图片');
  const industry = String(raw.materialIndustryName || raw.industryName || '').trim();
  const category = String(raw.materialCategoryName || raw.categoryName || industry || '在线素材').trim();
  return {
    id: `niim-${id}`,
    remoteId: id,
    label: localizedName(raw, `在线素材 ${id}`),
    category,
    tags: normalizeTags([category, industry].concat(Array.isArray(raw.tags) ? raw.tags : [])),
    asset,
    sourceUrl: asset,
    vip: Boolean(raw.vip),
    source: 'remote-niim-material'
  };
}

function normalizeRemoteBorder(raw) {
  const id = remoteId(raw, '边框');
  const ninePatch = raw.ninePatch && typeof raw.ninePatch === 'object'
    ? Object.assign({}, raw.ninePatch)
    : null;
  const asset = safeRemoteUrl(raw.image || raw.imageUrl || raw.url);
  const previewSrc = safeRemoteUrl((ninePatch && ninePatch.previewUrl) || raw.previewUrl || asset);
  if (!asset && !previewSrc) throw new Error('在线边框缺少 HTTPS 图片');
  const industry = String(raw.borderIndustryName || raw.industryName || '线框').trim();
  const category = String(raw.borderCategoryName || raw.categoryName || industry || '在线边框').trim();
  return {
    id: `niim-border-${id}`,
    remoteId: id,
    label: localizedName(raw, `${category} ${id}`),
    category,
    tags: normalizeTags([category, industry].concat(Array.isArray(raw.tags) ? raw.tags : [])),
    asset: asset || previewSrc,
    sourceUrl: asset || previewSrc,
    previewSrc: previewSrc || asset,
    ninePatch,
    vip: Boolean(raw.vip),
    source: 'remote-niim-border'
  };
}

function normalizePageResponse(payload, requested, normalizer, key, label) {
  const code = Number(payload && (payload.code != null ? payload.code : payload.status_code));
  if (!payload || code !== 1 || !payload.data || !Array.isArray(payload.data.list)) {
    throw new Error(String((payload && payload.message) || `在线${label}目录返回格式无效`));
  }
  const page = positiveInteger(payload.data.page, positiveInteger(requested.page, 1), 100000);
  const limit = positiveInteger(payload.data.limit, positiveInteger(requested.limit, PAGE_LIMIT, PAGE_LIMIT), PAGE_LIMIT);
  const total = Math.max(0, Number(payload.data.total) || 0);
  const items = [];
  for (const raw of payload.data.list) {
    try {
      items.push(normalizer(raw));
    } catch (_) {
      // A single malformed record must not make the whole public page unusable.
    }
  }
  return {
    page,
    limit,
    total,
    [key]: items,
    received: payload.data.list.length,
    skipped: payload.data.list.length - items.length,
    hasMore: payload.data.list.length > 0 && page * limit < total
  };
}

function normalizeCatalogResponse(payload, requested = {}) {
  return normalizePageResponse(payload, requested, normalizeRemoteTemplate, 'templates', '模板');
}

function requestCatalogPage(wxLike, url, data, normalizer, key, label, options) {
  if (!wxLike || typeof wxLike.request !== 'function') {
    return Promise.reject(new Error(`当前环境不支持在线${label}请求`));
  }
  const page = data.page;
  const limit = data.limit;
  const timeout = positiveInteger(options.timeout, 15000, 60000);
  return new Promise((resolve, reject) => {
    wxLike.request({
      url,
      method: 'POST',
      header: Object.assign({}, REQUEST_HEADERS),
      data,
      timeout,
      success(response) {
        const status = Number(response && response.statusCode);
        if (status && (status < 200 || status >= 300)) {
          reject(new Error(`在线${label}目录请求失败（HTTP ${status}）`));
          return;
        }
        try {
          resolve(normalizePageResponse(response && response.data, { page, limit }, normalizer, key, label));
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(new Error(String((error && error.errMsg) || `在线${label}目录网络请求失败`)));
      }
    });
  });
}

function fetchAuthorizedTemplatePage(wxLike, options = {}) {
  const page = positiveInteger(options.page, 1, 100000);
  const limit = positiveInteger(options.limit, PAGE_LIMIT, PAGE_LIMIT);
  return requestCatalogPage(wxLike, API_URL, {
    languageCode: 'zh-cn', width: 999, height: 999, page, limit
  }, normalizeRemoteTemplate, 'templates', '模板', options);
}

function fetchAuthorizedMaterialPage(wxLike, options = {}) {
  const page = positiveInteger(options.page, 1, 100000);
  const limit = positiveInteger(options.limit, PAGE_LIMIT, PAGE_LIMIT);
  return requestCatalogPage(wxLike, MATERIAL_API_URL, { page, limit }, normalizeRemoteMaterial, 'materials', '素材', options);
}

function fetchAuthorizedBorderPage(wxLike, options = {}) {
  const page = positiveInteger(options.page, 1, 100000);
  const limit = positiveInteger(options.limit, PAGE_LIMIT, PAGE_LIMIT);
  return requestCatalogPage(wxLike, BORDER_API_URL, { page, limit }, normalizeRemoteBorder, 'borders', '边框', options);
}

function mergeRemoteTemplates(current, incoming, options = {}) {
  const reservedIds = new Set((options.reservedIds || []).map(String));
  const reservedSourceIds = new Set((options.reservedSourceIds || []).map(String));
  for (const id of reservedIds) {
    if (id.startsWith('online-')) reservedSourceIds.add(id.slice('online-'.length));
  }
  const result = [];
  const seenIds = new Set(reservedIds);
  const seenSources = new Set(reservedSourceIds);
  for (const item of (current || []).concat(incoming || [])) {
    if (!item || !item.id) continue;
    const id = String(item.id);
    const sourceId = sourceIdOf(item);
    if (seenIds.has(id) || (sourceId && seenSources.has(sourceId))) continue;
    seenIds.add(id);
    if (sourceId) seenSources.add(sourceId);
    result.push(item);
  }
  return result;
}

module.exports = {
  API_URL,
  BORDER_API_URL,
  MATERIAL_API_URL,
  PAGE_LIMIT,
  REQUEST_HEADERS,
  fetchAuthorizedBorderPage,
  fetchAuthorizedMaterialPage,
  fetchAuthorizedTemplatePage,
  mergeRemoteTemplates,
  normalizeCatalogResponse,
  normalizeRemoteBorder,
  normalizeRemoteMaterial,
  normalizeRemoteTemplate,
  sourceIdOf
};
