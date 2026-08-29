#!/usr/bin/env node

/**
 * Read-only synchronizer for an operator-authorized NIIM public catalog.
 *
 * Safety invariants:
 * - Every API path and method is an exact member of READ_ONLY_API_REQUESTS.
 * - There is no generic endpoint option and no mutation/user-data endpoint.
 * - Existing output is only reused when --resume is explicitly supplied.
 * - Page chunks, the checkpoint, collections, manifest and URL map are written
 *   atomically, so an interrupted run can safely continue.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const SCHEMA_VERSION = 1;
const API_BASE_URL = 'https://print.niimbot.com/api';
const PAGE_LIMIT = 100;
const DEFAULT_DELAY_MS = 150;
const MAX_RETRIES = 5;
const REQUEST_TIMEOUT_MS = 45_000;
const URL_MAP_FLUSH_EVERY = 25;
const SUPPORTED_KINDS = Object.freeze(['templates', 'materials', 'borders']);

const API_HEADERS = Object.freeze({
  accept: 'application/json',
  'content-type': 'application/json',
  lang: 'zh-cn',
  'niimbot-user-agent': 'AppVersionName/6.6.6',
  'user-agent': 'niimbot/6.6.6 Android'
});

const AUTHORIZATION_PLACEHOLDER = Object.freeze({
  status: 'operator-declared; documentary reference pending',
  declaration: '【待填写】发布或再分发前，请附书面授权编号、授权素材范围、地域与有效期。',
  reference: ''
});

const CATALOG_REQUESTS = Object.freeze({
  templates: Object.freeze({
    method: 'POST',
    pathname: '/industryTemplate/page',
    body: (page) => ({
      languageCode: 'zh-cn',
      width: 999,
      height: 999,
      page,
      limit: PAGE_LIMIT
    })
  }),
  materials: Object.freeze({
    method: 'POST',
    pathname: '/materialLib/page',
    body: (page) => ({ page, limit: PAGE_LIMIT })
  }),
  borders: Object.freeze({
    method: 'POST',
    pathname: '/material-borders/page',
    body: (page) => ({ page, limit: PAGE_LIMIT })
  })
});

const METADATA_REQUESTS = Object.freeze([
  Object.freeze({
    name: 'template-sizes',
    kinds: Object.freeze(['templates']),
    method: 'GET',
    pathname: '/industryTemplate/sizes',
    body: null
  }),
  Object.freeze({
    name: 'template-categories',
    kinds: Object.freeze(['templates']),
    method: 'POST',
    pathname: '/industryTemplate/categories',
    body: Object.freeze({ languageCode: 'zh-cn', width: 999, height: 999 })
  }),
  Object.freeze({
    name: 'material-categories',
    kinds: Object.freeze(['materials', 'borders']),
    method: 'POST',
    pathname: '/materialIndCat/list',
    body: Object.freeze({})
  })
]);

const READ_ONLY_API_REQUESTS = new Set([
  ...Object.values(CATALOG_REQUESTS).map((request) => `${request.method} ${request.pathname}`),
  ...METADATA_REQUESTS.map((request) => `${request.method} ${request.pathname}`)
]);

const FORBIDDEN_PATH_PATTERN = /(?:user|mylist|shared[-_/]?inbox|customtemplate)/i;

const ASSET_KEYS = new Set([
  'backgroundImage',
  'contentThumbnail',
  'fontUrl',
  'icon',
  'iconUrl',
  'image',
  'imageLink',
  'imageUrl',
  'previewImage',
  'previewUrl',
  'resourceUrl',
  'thumbnail'
]);

function usage() {
  return `NIIM 授权目录只读同步器

用法:
  node scripts/sync-authorized-catalog.mjs [选项]

选项:
  --kind <all|templates|materials|borders>  同步范围（默认: all）
  --out <目录>                             输出目录（默认: output/authorized-catalog）
  --max-pages <整数>                       每类最多页数；0 表示全量（默认: 0）
  --download-assets                        下载目录记录引用的公开素材（默认关闭）
  --resume                                 从原子 checkpoint/page chunk 继续
  --delay-ms <整数>                        API 请求最小间隔毫秒（默认: ${DEFAULT_DELAY_MS}）
  --dry-run                                仅校验参数并打印计划，不联网、不写文件
  -h, --help                               显示帮助

说明:
  * 只会调用脚本内硬编码的目录查询端点；不会访问用户模板、收件箱或任何写接口。
  * 首次写入时输出目录必须为空；已有同步结果必须显式使用 --resume。
  * 素材采用 SHA-256 内容寻址，URL 到内容哈希的映射写入 url-map.json。
  * 发布或再分发前，请在 manifest 的 authorization 字段补齐书面授权信息。

示例:
  npm run sync:authorized-catalog -- --kind templates --max-pages 1 --out ./output/catalog-smoke
  npm run sync:authorized-catalog -- --kind all --resume --download-assets
`;
}

function parseBoolean(value, name) {
  if (value === undefined) return true;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`${name} 只接受 true 或 false`);
}

function parseNonNegativeInteger(value, name) {
  if (value === undefined || value === '') throw new Error(`${name} 缺少数值`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${name} 必须是非负整数`);
  }
  return number;
}

function parseArgs(argv) {
  const options = {
    kind: 'all',
    out: path.resolve(process.cwd(), 'output', 'authorized-catalog'),
    maxPages: 0,
    downloadAssets: false,
    resume: false,
    delayMs: DEFAULT_DELAY_MS,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '-h' || token === '--help') {
      options.help = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`无法识别参数: ${token}`);

    const equalIndex = token.indexOf('=');
    const name = equalIndex === -1 ? token : token.slice(0, equalIndex);
    let value = equalIndex === -1 ? undefined : token.slice(equalIndex + 1);
    const takeValue = () => {
      if (value !== undefined) return value;
      index += 1;
      if (index >= argv.length || argv[index].startsWith('--')) {
        throw new Error(`${name} 缺少数值`);
      }
      return argv[index];
    };

    if (name === '--kind') options.kind = takeValue();
    else if (name === '--out') options.out = path.resolve(process.cwd(), takeValue());
    else if (name === '--max-pages') options.maxPages = parseNonNegativeInteger(takeValue(), name);
    else if (name === '--delay-ms') options.delayMs = parseNonNegativeInteger(takeValue(), name);
    else if (name === '--download-assets') options.downloadAssets = parseBoolean(value, name);
    else if (name === '--resume') options.resume = parseBoolean(value, name);
    else if (name === '--dry-run') options.dryRun = parseBoolean(value, name);
    else throw new Error(`无法识别参数: ${name}`);
  }

  if (options.kind !== 'all' && !SUPPORTED_KINDS.includes(options.kind)) {
    throw new Error(`--kind 必须是 all、${SUPPORTED_KINDS.join('、')} 之一`);
  }
  return options;
}

function selectedKinds(kind) {
  return kind === 'all' ? [...SUPPORTED_KINDS] : [kind];
}

function isoNow() {
  return new Date().toISOString();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compareStringIds(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function relativePosix(from, target) {
  return path.relative(from, target).split(path.sep).join('/');
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporaryPath, 'wx');
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function retryAfterMs(response) {
  const header = response.headers.get('retry-after');
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function retryDelayMs(attempt, response) {
  const serverDelay = response ? retryAfterMs(response) : 0;
  const exponential = Math.min(30_000, 500 * (2 ** attempt));
  const jitter = Math.floor(Math.random() * 250);
  return Math.max(serverDelay, exponential + jitter);
}

async function responseSnippet(response) {
  try {
    return (await response.text()).replace(/\s+/g, ' ').slice(0, 500);
  } catch {
    return '';
  }
}

async function fetchWithRetry(url, init, label) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return response;

      if (response.status !== 429 && response.status < 500) {
        const detail = await responseSnippet(response);
        throw new Error(`${label} HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }

      lastError = new Error(`${label} HTTP ${response.status}`);
      if (attempt === MAX_RETRIES) break;
      await response.body?.cancel().catch(() => {});
      const delay = retryDelayMs(attempt, response);
      console.warn(`[retry] ${label}: HTTP ${response.status}，${delay}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
    } catch (error) {
      clearTimeout(timeout);
      if (error && typeof error.message === 'string' && / HTTP 4\d\d/.test(error.message) && !/ HTTP 429/.test(error.message)) {
        throw error;
      }
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      const delay = retryDelayMs(attempt);
      console.warn(`[retry] ${label}: ${error.message || error}，${delay}ms 后重试 (${attempt + 1}/${MAX_RETRIES})`);
      await sleep(delay);
    }
  }
  throw new Error(`${label} 重试 ${MAX_RETRIES} 次后仍失败: ${lastError?.message || lastError}`);
}

function assertReadOnlyApiRequest(method, pathname) {
  const signature = `${method} ${pathname}`;
  if (FORBIDDEN_PATH_PATTERN.test(pathname) || !READ_ONLY_API_REQUESTS.has(signature)) {
    throw new Error(`安全策略拒绝未授权 API 请求: ${signature}`);
  }
}

function createApiClient(delayMs) {
  let lastRequestStartedAt = 0;
  return async function fetchApiJson(request, bodyOverride) {
    assertReadOnlyApiRequest(request.method, request.pathname);
    const elapsed = Date.now() - lastRequestStartedAt;
    if (lastRequestStartedAt && elapsed < delayMs) await sleep(delayMs - elapsed);
    lastRequestStartedAt = Date.now();

    const body = bodyOverride === undefined ? request.body : bodyOverride;
    const sourceUrl = `${API_BASE_URL}${request.pathname}`;
    const response = await fetchWithRetry(sourceUrl, {
      method: request.method,
      headers: API_HEADERS,
      body: request.method === 'POST' ? JSON.stringify(body || {}) : undefined
    }, `${request.method} ${request.pathname}`);
    const payload = await response.json();
    if (payload && Object.hasOwn(payload, 'code') && payload.code !== 1 && payload.code !== 200) {
      throw new Error(`${request.pathname} 返回业务错误 ${payload.code}: ${payload.message || payload.msg || 'unknown'}`);
    }
    if (!payload || !Object.hasOwn(payload, 'data')) {
      throw new Error(`${request.pathname} 返回格式缺少 data`);
    }
    return {
      data: payload.data,
      sourceUrl,
      fetchedAt: isoNow(),
      rateLimit: {
        limit: response.headers.get('x-ratelimit-limit'),
        remaining: response.headers.get('x-ratelimit-remaining'),
        reset: response.headers.get('x-ratelimit-reset')
      }
    };
  };
}

function initialCheckpoint() {
  return {
    schemaVersion: SCHEMA_VERSION,
    apiBaseUrl: API_BASE_URL,
    pageLimit: PAGE_LIMIT,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    catalogs: Object.fromEntries(SUPPORTED_KINDS.map((kind) => [kind, {
      completedPages: [],
      totalAvailable: null,
      lastFetchedAt: null
    }]))
  };
}

function validateCheckpoint(checkpoint) {
  if (checkpoint?.schemaVersion !== SCHEMA_VERSION) throw new Error('checkpoint schemaVersion 不兼容');
  if (checkpoint?.apiBaseUrl !== API_BASE_URL) throw new Error('checkpoint API 来源不匹配');
  if (checkpoint?.pageLimit !== PAGE_LIMIT) throw new Error('checkpoint pageLimit 不匹配');
  for (const kind of SUPPORTED_KINDS) {
    const catalog = checkpoint.catalogs?.[kind];
    if (!catalog || !Array.isArray(catalog.completedPages)) {
      throw new Error(`checkpoint 缺少 ${kind} 状态`);
    }
  }
}

async function prepareOutput(options) {
  const checkpointPath = path.join(options.out, 'checkpoint.json');
  const outputExists = await exists(options.out);
  const entries = outputExists ? await readdir(options.out) : [];
  if (entries.length && !options.resume) {
    throw new Error(`输出目录非空: ${options.out}。若要继续已有同步，请加 --resume。`);
  }
  await mkdir(options.out, { recursive: true });

  if (options.resume) {
    if (!(await exists(checkpointPath))) {
      throw new Error(`--resume 需要已有 checkpoint: ${checkpointPath}`);
    }
    const checkpoint = await readJson(checkpointPath);
    validateCheckpoint(checkpoint);
    return { checkpoint, checkpointPath };
  }

  const checkpoint = initialCheckpoint();
  await atomicWriteJson(checkpointPath, checkpoint);
  return { checkpoint, checkpointPath };
}

async function saveCheckpoint(checkpointPath, checkpoint) {
  checkpoint.updatedAt = isoNow();
  for (const kind of SUPPORTED_KINDS) {
    checkpoint.catalogs[kind].completedPages = [...new Set(checkpoint.catalogs[kind].completedPages)]
      .sort((a, b) => a - b);
  }
  await atomicWriteJson(checkpointPath, checkpoint);
}

async function syncMetadata(kinds, outDir, fetchApiJson) {
  const metadataDir = path.join(outDir, 'metadata');
  const selected = METADATA_REQUESTS.filter((request) => request.kinds.some((kind) => kinds.includes(kind)));
  const unique = [...new Map(selected.map((request) => [request.name, request])).values()];
  const summaries = [];

  for (const request of unique) {
    const result = await fetchApiJson(request);
    const filePath = path.join(metadataDir, `${request.name}.json`);
    const document = {
      schemaVersion: SCHEMA_VERSION,
      name: request.name,
      sourceUrl: result.sourceUrl,
      sourceMethod: request.method,
      requestBody: request.method === 'POST' ? request.body : null,
      fetchedAt: result.fetchedAt,
      authorization: AUTHORIZATION_PLACEHOLDER,
      data: result.data
    };
    await atomicWriteJson(filePath, document);
    summaries.push({
      name: request.name,
      file: relativePosix(outDir, filePath),
      sourceUrl: result.sourceUrl,
      fetchedAt: result.fetchedAt
    });
    console.log(`[metadata] ${request.name}`);
  }
  return summaries;
}

function pageFile(outDir, kind, page) {
  return path.join(outDir, 'pages', kind, `page-${String(page).padStart(6, '0')}.json`);
}

function validPageChunk(chunk, kind, page) {
  return chunk?.schemaVersion === SCHEMA_VERSION
    && chunk?.kind === kind
    && chunk?.page === page
    && chunk?.limit === PAGE_LIMIT
    && Array.isArray(chunk?.records);
}

async function existingPageChunk(outDir, kind, page) {
  const filePath = pageFile(outDir, kind, page);
  if (!(await exists(filePath))) return null;
  const chunk = await readJson(filePath);
  if (!validPageChunk(chunk, kind, page)) {
    throw new Error(`页缓存格式不兼容: ${filePath}`);
  }
  return chunk;
}

async function syncCatalogKind(kind, options, checkpoint, checkpointPath, fetchApiJson) {
  const request = CATALOG_REQUESTS[kind];
  const state = checkpoint.catalogs[kind];
  let page = 1;
  let totalAvailable = Number.isFinite(state.totalAvailable) ? state.totalAvailable : null;
  let targetPages = totalAvailable == null ? Infinity : Math.ceil(totalAvailable / PAGE_LIMIT);
  if (options.maxPages > 0) targetPages = Math.min(targetPages, options.maxPages);

  while (page <= targetPages) {
    let chunk = options.resume ? await existingPageChunk(options.out, kind, page) : null;
    if (chunk) {
      totalAvailable = Number.isFinite(chunk.totalAvailable) ? chunk.totalAvailable : totalAvailable;
      if (!state.completedPages.includes(page)) {
        state.completedPages.push(page);
        state.totalAvailable = totalAvailable;
        state.lastFetchedAt = chunk.fetchedAt;
        await saveCheckpoint(checkpointPath, checkpoint);
      }
      console.log(`[${kind}] page ${page} (resume)`);
    } else {
      const requestBody = request.body(page);
      const result = await fetchApiJson(request, requestBody);
      const data = result.data;
      if (!data || !Array.isArray(data.list)) throw new Error(`${kind} page ${page} 返回格式缺少 list`);
      totalAvailable = Number(data.total);
      if (!Number.isFinite(totalAvailable) || totalAvailable < 0) {
        throw new Error(`${kind} page ${page} 返回无效 total`);
      }
      chunk = {
        schemaVersion: SCHEMA_VERSION,
        kind,
        page,
        limit: PAGE_LIMIT,
        totalAvailable,
        sourceUrl: result.sourceUrl,
        sourceMethod: request.method,
        requestBody,
        fetchedAt: result.fetchedAt,
        rateLimit: result.rateLimit,
        authorization: AUTHORIZATION_PLACEHOLDER,
        records: data.list
      };
      await atomicWriteJson(pageFile(options.out, kind, page), chunk);
      state.completedPages.push(page);
      state.totalAvailable = totalAvailable;
      state.lastFetchedAt = result.fetchedAt;
      await saveCheckpoint(checkpointPath, checkpoint);
      console.log(`[${kind}] page ${page}: ${data.list.length} records / total ${totalAvailable}`);
    }

    const fullPages = Math.ceil((totalAvailable || 0) / PAGE_LIMIT);
    targetPages = options.maxPages > 0 ? Math.min(fullPages, options.maxPages) : fullPages;
    if (chunk.records.length === 0) break;
    page += 1;
  }

  return collateCatalog(kind, options.out, checkpoint);
}

async function collateCatalog(kind, outDir, checkpoint) {
  const state = checkpoint.catalogs[kind];
  const recordsById = new Map();
  const provenanceById = new Map();
  let duplicateCount = 0;
  let invalidRecordCount = 0;

  for (const page of [...state.completedPages].sort((a, b) => a - b)) {
    const chunk = await existingPageChunk(outDir, kind, page);
    if (!chunk) continue;
    for (const record of chunk.records) {
      if (!record || record.id === undefined || record.id === null) {
        invalidRecordCount += 1;
        continue;
      }
      const id = String(record.id);
      if (recordsById.has(id)) {
        duplicateCount += 1;
        continue;
      }
      recordsById.set(id, record);
      provenanceById.set(id, {
        id,
        page,
        sourceUrl: chunk.sourceUrl,
        fetchedAt: chunk.fetchedAt
      });
    }
  }

  const ids = [...recordsById.keys()].sort(compareStringIds);
  const records = ids.map((id) => recordsById.get(id));
  const provenance = ids.map((id) => provenanceById.get(id));
  const totalPages = Math.ceil((Number(state.totalAvailable) || 0) / PAGE_LIMIT);
  const completedPages = [...state.completedPages].sort((a, b) => a - b);
  const completedPageSet = new Set(completedPages);
  const complete = totalPages === 0
    ? completedPageSet.has(1)
    : Array.from({ length: totalPages }, (_, index) => index + 1).every((page) => completedPageSet.has(page));
  const collectionPath = path.join(outDir, 'collections', `${kind}.json`);
  const collection = {
    schemaVersion: SCHEMA_VERSION,
    kind,
    sourceUrl: `${API_BASE_URL}${CATALOG_REQUESTS[kind].pathname}`,
    sourceMethod: CATALOG_REQUESTS[kind].method,
    generatedAt: isoNow(),
    authorization: AUTHORIZATION_PLACEHOLDER,
    pageLimit: PAGE_LIMIT,
    totalAvailable: state.totalAvailable,
    totalPages,
    completedPages,
    complete,
    recordCount: records.length,
    duplicateCount,
    invalidRecordCount,
    provenance,
    records
  };
  await atomicWriteJson(collectionPath, collection);
  return {
    ...collection,
    collectionFile: relativePosix(outDir, collectionPath),
    records: undefined
  };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectAssetUrls(value, output = new Set()) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetUrls(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && ASSET_KEYS.has(key) && isHttpUrl(child)) {
      output.add(child);
    } else if (child && typeof child === 'object') {
      collectAssetUrls(child, output);
    }
  }
  return output;
}

function blankUrlMap() {
  return {
    schemaVersion: SCHEMA_VERSION,
    hashAlgorithm: 'sha256',
    addressing: 'content',
    updatedAt: isoNow(),
    entries: []
  };
}

async function loadUrlMap(urlMapPath) {
  if (!(await exists(urlMapPath))) return blankUrlMap();
  const document = await readJson(urlMapPath);
  if (document?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(document?.entries)) {
    throw new Error(`url-map 格式不兼容: ${urlMapPath}`);
  }
  return document;
}

async function saveUrlMap(urlMapPath, entriesByUrl) {
  const document = blankUrlMap();
  document.entries = [...entriesByUrl.values()].sort((left, right) => {
    if (left.url < right.url) return -1;
    if (left.url > right.url) return 1;
    return 0;
  });
  await atomicWriteJson(urlMapPath, document);
  return document;
}

async function cachedAssetExists(outDir, entry) {
  if (entry?.status !== 'ok' || !entry?.relativePath) return false;
  try {
    const info = await stat(path.join(outDir, entry.relativePath));
    return info.isFile() && info.size === entry.byteLength;
  } catch {
    return false;
  }
}

async function downloadAssets(urls, outDir) {
  const urlMapPath = path.join(outDir, 'url-map.json');
  const existingMap = await loadUrlMap(urlMapPath);
  const entriesByUrl = new Map(existingMap.entries.map((entry) => [entry.url, entry]));
  const sortedUrls = [...urls].sort();
  let cached = 0;
  let downloaded = 0;
  let failed = 0;
  let dirtyCount = 0;

  for (let index = 0; index < sortedUrls.length; index += 1) {
    const url = sortedUrls[index];
    const previous = entriesByUrl.get(url);
    if (await cachedAssetExists(outDir, previous)) {
      cached += 1;
      continue;
    }

    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          accept: '*/*',
          'user-agent': API_HEADERS['user-agent']
        },
        redirect: 'follow'
      }, `asset ${index + 1}/${sortedUrls.length}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const contentSha256 = sha256(bytes);
      const assetPath = path.join(outDir, 'assets', 'sha256', contentSha256.slice(0, 2), contentSha256);
      if (!(await exists(assetPath))) await atomicWrite(assetPath, bytes);

      entriesByUrl.set(url, {
        status: 'ok',
        url,
        finalUrl: response.url,
        urlSha256: sha256(url),
        contentSha256,
        relativePath: relativePosix(outDir, assetPath),
        byteLength: bytes.length,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        etag: response.headers.get('etag') || '',
        lastModified: response.headers.get('last-modified') || '',
        downloadedAt: isoNow()
      });
      downloaded += 1;
      dirtyCount += 1;
      console.log(`[asset] ${index + 1}/${sortedUrls.length} ${contentSha256.slice(0, 12)} ${bytes.length}B`);
    } catch (error) {
      entriesByUrl.set(url, {
        status: 'error',
        url,
        urlSha256: sha256(url),
        attemptedAt: isoNow(),
        error: error.message || String(error)
      });
      failed += 1;
      dirtyCount += 1;
      console.warn(`[asset] ${index + 1}/${sortedUrls.length} failed: ${error.message || error}`);
    }

    if (dirtyCount >= URL_MAP_FLUSH_EVERY) {
      await saveUrlMap(urlMapPath, entriesByUrl);
      dirtyCount = 0;
    }
  }

  const urlMap = await saveUrlMap(urlMapPath, entriesByUrl);
  return {
    urlMapFile: relativePosix(outDir, urlMapPath),
    discoveredUrlCount: sortedUrls.length,
    mappedUrlCount: urlMap.entries.filter((entry) => entry.status === 'ok').length,
    cached,
    downloaded,
    failed
  };
}

async function describeSkippedAssetDownload(urls, outDir) {
  const urlMapPath = path.join(outDir, 'url-map.json');
  if (!(await exists(urlMapPath))) {
    return {
      urlMapFile: null,
      discoveredUrlCount: urls.size,
      mappedUrlCount: 0,
      cached: 0,
      downloaded: 0,
      failed: 0,
      downloadSkipped: true
    };
  }
  const urlMap = await loadUrlMap(urlMapPath);
  const relevant = urlMap.entries.filter((entry) => urls.has(entry.url));
  return {
    urlMapFile: relativePosix(outDir, urlMapPath),
    discoveredUrlCount: urls.size,
    mappedUrlCount: relevant.filter((entry) => entry.status === 'ok').length,
    cached: 0,
    downloaded: 0,
    failed: relevant.filter((entry) => entry.status === 'error').length,
    downloadSkipped: true
  };
}

async function loadExistingCollectionSummaries(outDir, currentSummaries) {
  const currentByKind = new Map(currentSummaries.map((summary) => [summary.kind, summary]));
  const summaries = [];
  for (const kind of SUPPORTED_KINDS) {
    if (currentByKind.has(kind)) {
      summaries.push(currentByKind.get(kind));
      continue;
    }
    const filePath = path.join(outDir, 'collections', `${kind}.json`);
    if (!(await exists(filePath))) continue;
    const collection = await readJson(filePath);
    if (collection?.schemaVersion !== SCHEMA_VERSION || collection?.kind !== kind || !Array.isArray(collection?.provenance)) {
      throw new Error(`collection 格式不兼容: ${filePath}`);
    }
    summaries.push({
      ...collection,
      collectionFile: relativePosix(outDir, filePath),
      records: undefined
    });
  }
  return summaries;
}

async function loadCatalogRecords(outDir, summaries) {
  const records = [];
  for (const summary of summaries) {
    const collection = await readJson(path.join(outDir, summary.collectionFile));
    records.push(...collection.records);
  }
  return records;
}

async function existingMetadataSummaries(outDir, current) {
  const resultByName = new Map(current.map((item) => [item.name, item]));
  for (const request of METADATA_REQUESTS) {
    if (resultByName.has(request.name)) continue;
    const filePath = path.join(outDir, 'metadata', `${request.name}.json`);
    if (!(await exists(filePath))) continue;
    const document = await readJson(filePath);
    resultByName.set(request.name, {
      name: request.name,
      file: relativePosix(outDir, filePath),
      sourceUrl: document.sourceUrl,
      fetchedAt: document.fetchedAt
    });
  }
  return [...resultByName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function writeManifest(options, summaries, metadata, assets) {
  const catalogs = {};
  for (const summary of [...summaries].sort((left, right) => SUPPORTED_KINDS.indexOf(left.kind) - SUPPORTED_KINDS.indexOf(right.kind))) {
    const items = [...summary.provenance].sort((left, right) => compareStringIds(left.id, right.id));
    catalogs[summary.kind] = {
      sourceUrl: summary.sourceUrl,
      sourceMethod: summary.sourceMethod,
      collectionFile: summary.collectionFile,
      pageLimit: summary.pageLimit,
      totalAvailable: summary.totalAvailable,
      totalPages: summary.totalPages,
      completedPages: summary.completedPages,
      complete: summary.complete,
      recordCount: summary.recordCount,
      duplicateCount: summary.duplicateCount,
      invalidRecordCount: summary.invalidRecordCount,
      items
    };
  }

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: isoNow(),
    apiBaseUrl: API_BASE_URL,
    sourceApplication: {
      packageName: 'com.gengcon.android.jccloudprinter',
      version: '6.6.6'
    },
    authorization: AUTHORIZATION_PLACEHOLDER,
    synchronization: {
      kind: options.kind,
      maxPages: options.maxPages,
      resume: options.resume,
      downloadAssets: options.downloadAssets,
      delayMs: options.delayMs
    },
    metadata,
    catalogs,
    assets
  };
  const manifestPath = path.join(options.out, 'manifest.json');
  await atomicWriteJson(manifestPath, manifest);
  return manifest;
}

async function run(options) {
  const kinds = selectedKinds(options.kind);
  if (options.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      apiBaseUrl: API_BASE_URL,
      kinds,
      output: options.out,
      maxPages: options.maxPages,
      downloadAssets: options.downloadAssets,
      resume: options.resume,
      delayMs: options.delayMs,
      readOnlyRequests: [...READ_ONLY_API_REQUESTS].sort()
    }, null, 2));
    return { dryRun: true };
  }

  const { checkpoint, checkpointPath } = await prepareOutput(options);
  const fetchApiJson = createApiClient(options.delayMs);
  const currentMetadata = await syncMetadata(kinds, options.out, fetchApiJson);
  const currentSummaries = [];
  for (const kind of kinds) {
    currentSummaries.push(await syncCatalogKind(kind, options, checkpoint, checkpointPath, fetchApiJson));
  }

  const summaries = await loadExistingCollectionSummaries(options.out, currentSummaries);
  const metadata = await existingMetadataSummaries(options.out, currentMetadata);
  const records = await loadCatalogRecords(options.out, summaries);
  const assetUrls = collectAssetUrls(records);
  const assets = options.downloadAssets
    ? await downloadAssets(assetUrls, options.out)
    : await describeSkippedAssetDownload(assetUrls, options.out);
  const manifest = await writeManifest(options, summaries, metadata, assets);

  const summary = {
    output: options.out,
    manifest: path.join(options.out, 'manifest.json'),
    catalogs: Object.fromEntries(Object.entries(manifest.catalogs).map(([kind, catalog]) => [kind, {
      records: catalog.recordCount,
      totalAvailable: catalog.totalAvailable,
      complete: catalog.complete
    }])),
    assets
  };
  console.log(JSON.stringify(summary, null, 2));
  if (options.downloadAssets && assets.failed > 0) process.exitCode = 2;
  return summary;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    await run(options);
  } catch (error) {
    console.error(`sync-authorized-catalog: ${error.message || error}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();

export {
  API_BASE_URL,
  AUTHORIZATION_PLACEHOLDER,
  CATALOG_REQUESTS,
  METADATA_REQUESTS,
  READ_ONLY_API_REQUESTS,
  collectAssetUrls,
  compareStringIds,
  parseArgs,
  run
};
