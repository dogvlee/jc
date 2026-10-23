/** Download remote template images on demand before handing a document to Canvas. */
const memoryCache = new Map();
const pendingCache = new Map();
const MAX_MEMORY_CACHE_ENTRIES = 64;
const MAX_DISK_CACHE_FILES = 128;
const MAX_DISK_CACHE_BYTES = 24 * 1024 * 1024;

function remember(url, path) {
  memoryCache.delete(url);
  memoryCache.set(url, path);
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRemoteImage(value) {
  return /^https:\/\//i.test(String(value || '').trim());
}

function hashUrl(value) {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193) >>> 0;
    hashB ^= code + index;
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
  }
  return hashA.toString(16).padStart(8, '0')
    + hashB.toString(16).padStart(8, '0');
}

function extensionForUrl(value) {
  const match = String(value || '').split(/[?#]/, 1)[0].match(/\.(png|jpe?g|webp|gif)$/i);
  return match ? `.${match[1].toLowerCase().replace('jpeg', 'jpg')}` : '.png';
}

function callFs(fs, method, options) {
  return new Promise((resolve, reject) => {
    if (!fs || typeof fs[method] !== 'function') {
      reject(new Error(`文件系统不支持 ${method}`));
      return;
    }
    fs[method](Object.assign({}, options, {
      success: resolve,
      fail: reject
    }));
  });
}

// Download failures carry code IMAGE_DOWNLOAD_FAILED and a plain message, so
// a page can tell "no network" apart from a broken template file. The
// platform's own text stays on `detail`.
function downloadError(detail) {
  const error = new Error('图片没有下载下来，请检查网络后重试');
  error.code = 'IMAGE_DOWNLOAD_FAILED';
  error.detail = detail;
  return error;
}

function download(wxLike, url) {
  return new Promise((resolve, reject) => {
    wxLike.downloadFile({
      url,
      timeout: 20000,
      success(result) {
        const status = Number(result && result.statusCode);
        if ((status && status !== 200) || !result || !result.tempFilePath) {
          reject(downloadError(status ? `HTTP ${status}` : 'no file'));
          return;
        }
        resolve(result.tempFilePath);
      },
      fail(error) {
        reject(downloadError(String((error && error.errMsg) || '')));
      }
    });
  });
}

async function pathExists(fs, path) {
  try {
    await callFs(fs, 'access', { path });
    return true;
  } catch (_) {
    return false;
  }
}

async function pruneDiskCache(fs, cacheDir, keepPath) {
  if (!fs || !cacheDir) return;
  try {
    const listing = await callFs(fs, 'readdir', { dirPath: cacheDir });
    const names = (listing && listing.files || [])
      .filter((name) => /^[a-f0-9]{16}\.(?:png|jpe?g|webp|gif)$/i.test(String(name)));
    const records = await Promise.all(names.map(async (name) => {
      const path = `${cacheDir}/${name}`;
      try {
        const result = await callFs(fs, 'stat', { path });
        const stats = result && (result.stats || result.stat);
        return {
          path,
          size: Math.max(0, Number(stats && stats.size) || 0),
          time: Number(stats && (stats.lastAccessedTime || stats.lastModifiedTime)) || 0
        };
      } catch (_) {
        return { path, size: 0, time: 0 };
      }
    }));
    let totalFiles = records.length;
    let totalBytes = records.reduce((sum, record) => sum + record.size, 0);
    if (totalFiles <= MAX_DISK_CACHE_FILES && totalBytes <= MAX_DISK_CACHE_BYTES) return;
    records.sort((left, right) => left.time - right.time);
    for (const record of records) {
      if (totalFiles <= MAX_DISK_CACHE_FILES && totalBytes <= MAX_DISK_CACHE_BYTES) break;
      if (record.path === keepPath) continue;
      try {
        await callFs(fs, 'unlink', { filePath: record.path });
        totalFiles -= 1;
        totalBytes -= record.size;
        memoryCache.forEach((cachedPath, cachedUrl) => {
          if (cachedPath === record.path) memoryCache.delete(cachedUrl);
        });
      } catch (_) {
        // Cache pruning is best effort and must not break image insertion.
      }
    }
  } catch (_) {
    // Older runtimes may not expose directory enumeration.
  }
}

async function localizeUrl(wxLike, url) {
  const normalizedUrl = String(url || '').trim();
  if (!isRemoteImage(normalizedUrl)) {
    throw new Error('只支持下载 HTTPS 模板图片');
  }
  if (memoryCache.has(normalizedUrl)) {
    const cached = memoryCache.get(normalizedUrl);
    remember(normalizedUrl, cached);
    return cached;
  }
  if (pendingCache.has(normalizedUrl)) return pendingCache.get(normalizedUrl);
  if (!wxLike || typeof wxLike.downloadFile !== 'function') {
    throw new Error('当前环境不支持下载模板图片');
  }
  const pending = (async () => {
    const fs = typeof wxLike.getFileSystemManager === 'function' ? wxLike.getFileSystemManager() : null;
    const userRoot = wxLike.env && wxLike.env.USER_DATA_PATH;
    const fileName = `${hashUrl(normalizedUrl)}${extensionForUrl(normalizedUrl)}`;
    const cacheDir = userRoot ? `${userRoot}/niim-online-assets` : '';
    const target = cacheDir ? `${cacheDir}/${fileName}` : '';
    if (target && await pathExists(fs, target)) {
      remember(normalizedUrl, target);
      return target;
    }

    const temporary = await download(wxLike, normalizedUrl);
    let localized = temporary;
    if (target && fs) {
      try {
        await callFs(fs, 'mkdir', { dirPath: cacheDir, recursive: true });
      } catch (_) {
        // mkdir may report that the directory already exists; saveFile decides.
      }
      try {
        const saved = await callFs(fs, 'saveFile', { tempFilePath: temporary, filePath: target });
        localized = (saved && saved.savedFilePath) || target;
      } catch (_) {
        if (await pathExists(fs, target)) localized = target;
      }
    }
    remember(normalizedUrl, localized);
    if (localized === target) await pruneDiskCache(fs, cacheDir, target);
    return localized;
  })();
  pendingCache.set(normalizedUrl, pending);
  try {
    return await pending;
  } finally {
    pendingCache.delete(normalizedUrl);
  }
}

async function localizeDocumentImages(wxLike, document) {
  const localized = clone(document);
  const elements = Array.isArray(localized && localized.elements) ? localized.elements : [];
  const urls = [];
  for (const element of elements) {
    if ((element.type === 'image' || element.type === 'material') && isRemoteImage(element.path) && !urls.includes(element.path)) {
      urls.push(element.path);
    }
  }
  const paths = new Map();
  for (const url of urls) paths.set(url, await localizeUrl(wxLike, url));
  for (const element of elements) {
    if (paths.has(element.path)) element.path = paths.get(element.path);
  }
  return localized;
}

module.exports = {
  MAX_DISK_CACHE_BYTES,
  MAX_DISK_CACHE_FILES,
  MAX_MEMORY_CACHE_ENTRIES,
  extensionForUrl,
  hashUrl,
  isRemoteImage,
  localizeDocumentImages,
  localizeUrl
};
