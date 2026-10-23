/**
 * Pictures picked from the album, taken with the camera or imported inside a
 * template are copied into USER_DATA_PATH as `label-image-*` and stay there for
 * as long as a label uses them. Nothing else deletes them, and WeChat gives the
 * whole mini program a shared local-file quota (about 200 MB), so a shop that
 * replaces photos regularly would eventually fail every import. This module
 * removes the files that no stored label, template, draft or print record
 * refers to any more.
 *
 * Deleting is only safe once the label that used a picture is gone for good,
 * which is why callers sweep when the editor closes (the undo stack of that
 * page is gone by then) and never while it is open.
 */
const FILE_PATTERN = /^(label-image-[A-Za-z0-9._-]+)$/;
// One close cleans at most this many files; the next one finishes the job.
const MAX_FILES_PER_SWEEP = 200;
// A picture imported seconds ago may belong to a page that has not saved yet.
const RECENT_MS = 60 * 1000;

function fileNameOf(path) {
  const text = String(path || '');
  return text.slice(text.lastIndexOf('/') + 1);
}

function isLabelImagePath(value) {
  return typeof value === 'string' && FILE_PATTERN.test(fileNameOf(value));
}

function collectPaths(documentValue, into) {
  const elements = documentValue && Array.isArray(documentValue.elements) ? documentValue.elements : [];
  elements.forEach((element) => {
    if (element && isLabelImagePath(element.path)) into.add(String(element.path));
  });
  return into;
}

/** Every `label-image-*` path the given documents still use. */
function referencedPaths(documents) {
  const paths = new Set();
  (Array.isArray(documents) ? documents : []).forEach((documentValue) => collectPaths(documentValue, paths));
  return paths;
}

function modifiedAt(fs, path) {
  if (typeof fs.statSync !== 'function') return 0;
  try {
    const stats = fs.statSync(path);
    if (!stats) return 0;
    const seconds = Number(stats.lastModifiedTime);
    if (seconds > 0) return seconds * 1000;
    const milliseconds = Number(stats.mtime);
    return milliseconds > 0 ? (milliseconds > 1e11 ? milliseconds : milliseconds * 1000) : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Deletes the label pictures in USER_DATA_PATH that none of `documents`
 * refers to. Best effort: a failure leaves the file for the next sweep, and a
 * storage manager that cannot list the directory changes nothing.
 * Returns { removed, kept }.
 */
function sweepOrphanImages(api, documents, options) {
  const config = options || {};
  const root = api && api.env && api.env.USER_DATA_PATH;
  if (!root || typeof api.getFileSystemManager !== 'function') return { removed: 0, kept: 0 };
  let files;
  try {
    files = api.getFileSystemManager();
  } catch (error) {
    return { removed: 0, kept: 0 };
  }
  if (!files || typeof files.readdirSync !== 'function' || typeof files.unlinkSync !== 'function') {
    return { removed: 0, kept: 0 };
  }
  let names = [];
  try {
    names = files.readdirSync(root) || [];
  } catch (error) {
    return { removed: 0, kept: 0 };
  }
  const images = names.filter((name) => FILE_PATTERN.test(String(name)));
  if (!images.length) return { removed: 0, kept: 0 };
  const referenced = referencedPaths(documents);
  const now = Number.isFinite(Number(config.now)) ? Number(config.now) : Date.now();
  const recentMs = Number.isFinite(Number(config.recentMs)) ? Number(config.recentMs) : RECENT_MS;
  let removed = 0;
  images.slice(0, MAX_FILES_PER_SWEEP).forEach((name) => {
    const path = `${root}/${name}`;
    if (referenced.has(path) || referenced.has(name)) return;
    const modified = modifiedAt(files, path);
    if (modified && now - modified < recentMs) return;
    try {
      files.unlinkSync(path);
      removed += 1;
    } catch (error) {
      // Another page may have removed it already; the next sweep retries.
    }
  });
  return { removed, kept: images.length - removed };
}

module.exports = {
  FILE_PATTERN,
  MAX_FILES_PER_SWEEP,
  RECENT_MS,
  fileNameOf,
  isLabelImagePath,
  referencedPaths,
  sweepOrphanImages
};
