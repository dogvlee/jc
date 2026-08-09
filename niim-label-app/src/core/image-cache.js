/** Path-aware image cache registry for async editor image loads. */
function createImageCacheRegistry() {
  const imageSources = new WeakMap();
  const activeRequests = new Map();

  function cachedFor(images, element) {
    if (!images || !element || !element.id || !element.path) return null;
    const image = images[element.id];
    if (!image) return null;
    if (imageSources.get(image) === String(element.path)) return image;
    delete images[element.id];
    return null;
  }

  function begin(element) {
    const token = Object.freeze({ id: element.id, source: String(element.path) });
    activeRequests.set(element.id, token);
    return token;
  }

  function accept(images, element, token, image) {
    if (!images || !element || !token || !image) return false;
    if (activeRequests.get(token.id) !== token) return false;
    if (element.id !== token.id || String(element.path || '') !== token.source) return false;
    imageSources.set(image, token.source);
    images[token.id] = image;
    return true;
  }

  function invalidate(images, id) {
    if (!id) return;
    // Replacing the active token prevents an older onload callback from
    // publishing stale pixels after a path change, undo, or redo.
    activeRequests.set(id, Object.freeze({ id, invalidated: true }));
    if (images) delete images[id];
  }

  return { accept, begin, cachedFor, invalidate };
}

module.exports = { createImageCacheRegistry };
