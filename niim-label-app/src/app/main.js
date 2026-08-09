const {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  hitTest,
  placeNewElement
} = require('../core/document');
const { linkedPrimary, syncLinkedDates, unlinkDate } = require('../core/date-links');
const {
  alignedCanvasSize,
  evaluatePrintability,
  getProfile,
  previewCanvasSize,
  profileForModelId
} = require('../core/profiles');
const {
  changeTextDirection,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  snapElementPosition
} = require('../core/geometry');
const { resetTextStyle } = require('../core/text-style');
const { renderDocument, renderSelection, validateDocument, contentHandleLocalMm } = require('../core/renderer');
const { drawMaterialSymbol } = require('../core/materials');
const { drawBorderStyle, borderById, BORDER_CATALOG } = require('../core/borders');
const { Capacitor } = require('@capacitor/core');
const { App: CapacitorApp } = require('@capacitor/app');
const { BleSession } = require('../services/ble-session');
const { parseCsv, rowsToRecords, stringifyCsv } = require('../services/csv');
const { createPlatformBleApi } = require('../services/platform-ble-api');
const { PrinterClient } = require('../services/printer-client');
const { KEYS, write } = require('../services/store');
const { templates } = require('./catalog');
const {
  initialState,
  openDocument,
  persistRows,
  persistSettings,
  readPrintHistory,
  templateDocument,
  upsertProject
} = require('./state');
const { applyRowToDocument, buildDocumentsFromRows } = require('./data-bind');
const { stockLabel } = require('./stock-presets');
const { invalidateThumbsByPrefix, resolveThumb } = require('./template-thumbs');
const {
  contextActions,
  isPlaceholderElement,
  propertyPanel,
  renderMain,
  renderModal,
  selectedElement,
  selectedElements
} = require('./views');

const appRoot = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toastRoot = document.getElementById('toast-root');
const state = initialState();
const bleApi = createPlatformBleApi();
const session = new BleSession(bleApi);
const printer = new PrinterClient(session);
let canvasState = null;
let scanTimer = null;
let longPressTimer = null;
let floatLayoutObserver = null;

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}
let intentionalDisconnect = false;

function toast(message, type) {
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' error' : ''}`;
  node.textContent = message;
  toastRoot.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function render() {
  appRoot.innerHTML = renderMain(state);
  modalRoot.innerHTML = renderModal(state);
  requestAnimationFrame(afterRender);
}

function renderModalOnly() {
  modalRoot.innerHTML = renderModal(state);
  requestAnimationFrame(() => {
    if (state.modal === 'print') renderPrintPreview();
    if (state.modal === 'template-preview') renderTemplatePreview();
    paintMaterialThumbs();
    paintBorderThumbs();
  });
}


function paintMaterialThumbs() {
  const nodes = document.querySelectorAll('[data-material-thumb]');
  if (!nodes.length) return;
  nodes.forEach((wrap) => {
    const symbol = wrap.getAttribute('data-material-thumb') || 'check';
    let canvas = wrap.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 56;
      canvas.height = 56;
      wrap.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    try {
      drawMaterialSymbol(ctx, symbol, 4, 4, w - 8, h - 8, 2);
    } catch (err) {
      ctx.strokeStyle = '#000';
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
  });
}

function paintBorderThumbs() {
  document.querySelectorAll('[data-border-thumb]').forEach((node) => {
    const id = node.getAttribute('data-border-thumb') || 'simple';
    const canvas = node.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    const b = borderById(id); drawBorderStyle(ctx, (b && b.draw) || id, 6, 6, w - 12, h - 12, 1.5);
  });
}

function afterRender() {
  if (state.route === 'editor' && state.document) {
    initializeEditorCanvas();
    bindElementPager();
    positionFloatChrome();
    bindFloatLayoutObserver();
    positionTabIndicator(false);
    bindKeyboardInset();
    const shell = document.querySelector('.niim-editor');
    if (shell) {
      shell.classList.toggle('content-editing', isContentKeyboardMode());
      shell.classList.toggle('has-selection', selectedElements(state).length > 0);
      shell.classList.toggle('panel-selected', state.editorMode === 'selected' || (state.editorMode === 'content' && !isContentKeyboardMode()));
      shell.classList.toggle('panel-add', state.editorMode === 'add');
    }
  } else {
    unbindKeyboardInset();
    if (floatLayoutObserver) {
      floatLayoutObserver.disconnect();
      floatLayoutObserver = null;
    }
  }
  if (state.modal === 'print') {
    renderPrintPreview();
  }
  if (state.modal === 'template-preview') {
    renderTemplatePreview();
  }
  paintTemplateThumbs();
  paintMaterialThumbs();
  paintBorderThumbs();
}

let kbInsetBound = false;
function onVisualViewportChange() {
  const vv = window.visualViewport;
  if (!vv) return;
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
  const shell = document.querySelector('.niim-editor');
  if (shell) shell.classList.toggle('kb-open', inset > 40);
}

function bindKeyboardInset() {
  if (kbInsetBound || !window.visualViewport) return;
  window.visualViewport.addEventListener('resize', onVisualViewportChange);
  window.visualViewport.addEventListener('scroll', onVisualViewportChange);
  kbInsetBound = true;
  onVisualViewportChange();
}

function unbindKeyboardInset() {
  if (!kbInsetBound || !window.visualViewport) return;
  window.visualViewport.removeEventListener('resize', onVisualViewportChange);
  window.visualViewport.removeEventListener('scroll', onVisualViewportChange);
  kbInsetBound = false;
  document.documentElement.style.setProperty('--kb-inset', '0px');
}

/** Float bar follows selection bbox (NIIM: above element + caret). */
function positionFloatChrome() {
  const bar = document.querySelector('.niim-float-bar, .niim-float-multi');
  if (!bar) return;
  const els = selectedElements(state);
  if (!els.length || !state.document) {
    bar.style.visibility = 'hidden';
    return;
  }
  const stage = document.querySelector('.niim-stage') || document.querySelector('.editor-stage');
  const viewport = document.getElementById('canvas-viewport') || document.querySelector('.niim-viewport');
  if (!stage || !viewport) {
    bar.style.visibility = 'visible';
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const viewRect = viewport.getBoundingClientRect();
  const dpi = currentProfile().dpi;
  // element bbox in mm → fraction of label
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  els.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  });
  const docW = Math.max(0.1, state.document.widthMm);
  const docH = Math.max(0.1, state.document.heightMm);
  const leftPx = viewRect.left + (minX / docW) * viewRect.width;
  const rightPx = viewRect.left + (maxX / docW) * viewRect.width;
  const topPx = viewRect.top + (minY / docH) * viewRect.height;
  const centerX = (leftPx + rightPx) / 2 - stageRect.left;
  const barH = bar.offsetHeight || 40;
  const barW = bar.offsetWidth || 220;
  let left = centerX - barW / 2;
  let top = topPx - stageRect.top - barH - 10;
  left = Math.max(6, Math.min(left, stageRect.width - barW - 6));
  top = Math.max(6, top);
  bar.style.visibility = 'visible';
  bar.style.position = 'absolute';
  bar.style.left = `${left}px`;
  bar.style.top = `${top}px`;
  bar.style.transform = 'none';
  bar.style.right = 'auto';
  if (!canvasState || !canvasState.drag || !canvasState.drag.moved) {
    bar.style.pointerEvents = '';
  }
}


function positionTabIndicator(animate) {
  const tabs = document.querySelector('.niim-panel-tabs');
  const indicator = document.querySelector('.niim-tab-indicator');
  if (!tabs || !indicator) return;
  const active = tabs.querySelector('.niim-panel-tab.active');
  if (!active) {
    indicator.style.opacity = '0';
    return;
  }
  if (!animate) indicator.style.transition = 'none';
  else indicator.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.15s ease';
  const tabsRect = tabs.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  const left = tabRect.left - tabsRect.left + tabs.scrollLeft;
  // underline ~60% of equal column, centered under label
  const width = Math.max(20, Math.min(48, tabRect.width * 0.45));
  const pad = (tabRect.width - width) / 2;
  indicator.style.opacity = '1';
  indicator.style.width = `${width}px`;
  indicator.style.transform = `translateX(${left + pad}px)`;
  if (!animate) {
    requestAnimationFrame(() => {
      indicator.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.15s ease';
    });
  }
}

/** Rebuild only the bottom property panel (keep canvas mounted). */
function patchEditorPanel() {
  refreshEditorChrome();
}

function resolveDocumentForThumb(id, source) {
  if (source === 'project') {
    const project = state.projects.find((item) => item.id === id);
    return project && project.document ? project.document : null;
  }
  if (source === 'user') {
    const userTemplate = state.userTemplates.find((item) => item.id === id);
    return userTemplate && userTemplate.document ? userTemplate.document : null;
  }
  const template = templates.find((item) => item.id === id);
  return template ? templateDocument(template) : null;
}

function paintTemplateThumbs() {
  const nodes = document.querySelectorAll('[data-role="template-thumb"][data-thumb-id]');
  if (!nodes.length) return;
  const dpi = currentProfile().dpi;
  nodes.forEach((node) => {
    if (node.getAttribute('data-thumb-static') === '1') return;
    const id = node.getAttribute('data-thumb-id');
    const source = node.getAttribute('data-thumb-source') || 'catalog';
    const documentValue = resolveDocumentForThumb(id, source);
    if (!documentValue) return;
    const result = resolveThumb(id, documentValue, {
      dpi,
      maxSide: 400,
      renderDocument,
      images: {}
    });
    if (!result.dataUrl) return;
    const image = node.querySelector('.thumb-image');
    const fallback = node.querySelector('.fallback-thumb');
    if (image) {
      image.src = result.dataUrl;
      image.hidden = false;
    }
    if (fallback) fallback.hidden = true;
    node.classList.add('has-thumb');
  });
}

async function renderTemplatePreview() {
  const canvas = document.getElementById('template-preview-canvas');
  const status = document.querySelector('[data-role="template-preview-status"]');
  if (!canvas || !state.templatePreviewId) return;
  const template = templates.find((item) => item.id === state.templatePreviewId)
    || state.userTemplates.find((item) => item.id === state.templatePreviewId);
  if (!template) {
    if (status) status.textContent = '模板不存在';
    return;
  }
  const documentValue = template.document || templateDocument(template);
  const profile = currentProfile();
  try {
    if (status) status.textContent = '正在渲染预览…';
    const size = previewCanvasSize(documentValue, profile.dpi);
    const maxCss = Math.min(340, window.innerWidth - 56);
    const fit = Math.min(1, maxCss / size.width, (maxCss * 0.85) / size.height);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${Math.round(size.width * fit)}px`;
    canvas.style.height = `${Math.round(size.height * fit)}px`;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    renderDocument(context, documentValue, size, profile.dpi, {});
    canvas.hidden = false;
    if (status) status.hidden = true;
  } catch (error) {
    if (status) {
      status.hidden = false;
      status.textContent = `预览失败：${error.message}`;
    }
    canvas.hidden = true;
    toast(error.message, 'error');
  }
}

function previewTemplate(id) {
  if (!id) return;
  const exists = templates.some((item) => item.id === id)
    || state.userTemplates.some((item) => item.id === id);
  if (!exists) {
    toast('找不到该模板', 'error');
    return;
  }
  state.templatePreviewId = id;
  state.modal = 'template-preview';
  renderModalOnly();
}

function useTemplate(id) {
  state.modal = '';
  state.templatePreviewId = '';
  openTemplate(id);
}

function findHistoryItem(id) {
  return (state.printHistory || []).find((item) => item.id === id) || null;
}

function openHistoryDocument(item, andPrint) {
  if (!item) {
    toast('历史记录不存在', 'error');
    return;
  }
  let documentValue = item.document ? cloneDocument(item.document) : null;
  if (!documentValue && item.projectId) {
    const project = state.projects.find((entry) => entry.id === item.projectId);
    if (project && project.document) {
      documentValue = cloneDocument(project.document);
      openDocument(state, documentValue, project.id);
      state.modal = '';
      render();
      if (andPrint) {
        requestAnimationFrame(() => openPrint());
      }
      return;
    }
  }
  if (!documentValue) {
    toast('该记录没有可打开的标签快照', 'error');
    return;
  }
  openDocument(state, documentValue, item.projectId || '');
  state.modal = '';
  render();
  if (andPrint) {
    requestAnimationFrame(() => openPrint());
  } else {
    toast('已从打印历史打开');
  }
}

function bindElementPager() {
  const pages = document.querySelector('[data-role="element-pages"]');
  if (!pages) return;
  const updateDots = () => {
    const page = pages.clientWidth ? Math.round(pages.scrollLeft / pages.clientWidth) : 0;
    document.querySelectorAll('.element-page-dot').forEach((dot, index) => {
      const active = index === page;
      dot.classList.toggle('active', active);
      if (active) dot.setAttribute('aria-selected', 'true');
      else dot.removeAttribute('aria-selected');
    });
  };
  pages.addEventListener('scroll', updateDots, { passive: true });
  updateDots();
}

function currentProfile() {
  return getProfile(state.settings.defaultProfileId);
}

function imageForElement(element) {
  if (!element || element.type !== 'image' || !element.path) return Promise.resolve(null);
  if (state.images[element.id]) return Promise.resolve(state.images[element.id]);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      state.images[element.id] = image;
      resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = element.path;
  });
}

async function loadDocumentImages(documentValue) {
  const source = documentValue || state.document;
  if (!source) return;
  await Promise.all(source.elements.map(imageForElement));
}

function drawEditorCanvas() {
  if (!canvasState || !state.document) return;
  renderDocument(canvasState.context, state.document, canvasState.size, canvasState.profile.dpi, state.images);
  const guides = (canvasState.drag && canvasState.drag.guides) || [];
  renderSelection(
    canvasState.selectionContext,
    selectedElements(state),
    canvasState.size,
    canvasState.profile.dpi,
    guides
  );
  positionFloatChrome();
}

/** reason: 'add' | 'select' | 'content' */
function preferredPanelTabForElement(element, reason) {
  if (!element) return 'elements';
  if (element.type === 'rect' || element.type === 'line') return 'style';
  if (element.type === 'table') return 'style';
  // Date always opens 时间 tab; new text/barcode → content; select → style
  if (element.type === 'date') return 'content';
  if (reason === 'add' || reason === 'content') {
    if (['text', 'serial', 'barcode', 'qrcode', 'table', 'material'].includes(element.type)) return 'content';
  }
  if (['text', 'serial', 'barcode', 'qrcode', 'table', 'image'].includes(element.type)) return 'style';
  return 'style';
}

const MOVE_DEADZONE_MM = 0.4;

/** Types that use system-keyboard content bar (compact shell). */
function isKeyboardContentType(type) {
  return type === 'text' || type === 'barcode' || type === 'qrcode';
}

function isContentKeyboardMode() {
  const el = selectedElement(state);
  return state.editorMode === 'content'
    && state.editorPanelTab === 'content'
    && el
    && isKeyboardContentType(el.type);
}

function finalizeContentUndo() {
  if (!contentUndoBefore || !state.document) return;
  // Skip phantom undo if nothing changed
  try {
    if (JSON.stringify(contentUndoBefore) === JSON.stringify(state.document)) {
      contentUndoBefore = null;
      return;
    }
  } catch (_) { /* ignore */ }
  state.undo.push(contentUndoBefore);
  if (state.undo.length > 30) state.undo.shift();
  state.redo = [];
  contentUndoBefore = null;
  autosave();
  patchHistoryButtons();
}

/** Mode A: empty selection → 添加元素 */
function enterAddMode(options) {
  const opts = options || {};
  if (state.editorMode === 'content') finalizeContentUndo();
  state.selectedIds = [];
  state.selectedId = '';
  state.multiSelect = false;
  state.editorPanelTab = 'elements';
  state.editorMode = 'add';
  if (opts.collapsed != null) state.panelCollapsed = !!opts.collapsed;
  else if (!opts.keepCollapsed) state.panelCollapsed = false;
  state.editorMenu = false;
  if (opts.render === 'full') render();
  else refreshEditorChrome();
}

/** Blank stage tap: deselect → add open; idle add → fold toggle */
function handleBlankCanvasTap() {
  if (state.editorMode === 'content') finalizeContentUndo();
  const hadSelection = (state.selectedIds && state.selectedIds.length) || state.editorMode !== 'add';
  if (hadSelection) {
    enterAddMode();
    return;
  }
  state.panelCollapsed = !state.panelCollapsed;
  state.editorMenu = false;
  refreshEditorChrome();
}

/** Mode B: one or more selected */
/** Update selection state without remounting panel/float (safe mid-gesture). */
function applySelectionState(ids, options) {
  const opts = options || {};
  const valid = Array.from(new Set((ids || []).filter((id) => state.document && state.document.elements.some((item) => item.id === id))));
  if (!valid.length) {
    if (state.editorMode === 'content') finalizeContentUndo();
    state.selectedIds = [];
    state.selectedId = '';
    state.multiSelect = false;
    state.editorPanelTab = 'elements';
    state.editorMode = 'add';
    if (opts.collapsed != null) state.panelCollapsed = !!opts.collapsed;
    else if (!opts.keepCollapsed) state.panelCollapsed = false;
    state.editorMenu = false;
    return [];
  }
  if (state.editorMode === 'content' && opts.reason !== 'content') finalizeContentUndo();
  state.selectedIds = valid;
  state.selectedId = valid[valid.length - 1] || '';
  state.editorMode = 'selected';
  state.panelCollapsed = false;
  state.editorMenu = false;
  if (valid.length > 1) {
    state.editorPanelTab = 'arrange';
  } else if (opts.tab) {
    state.editorPanelTab = opts.tab;
  } else if (opts.keepTab) {
    /* keep */
  } else {
    const el = selectedElement(state);
    state.editorPanelTab = preferredPanelTabForElement(el, opts.reason || 'select');
  }
  return valid;
}

function enterSelectedMode(ids, options) {
  const opts = options || {};
  const valid = applySelectionState(ids, opts);
  if (!valid.length) {
    enterAddMode(opts);
    return;
  }
  if (opts.soft) {
    // Mid-gesture: canvas paint only — no panel/float remount (preserves pointer capture & drag)
    drawEditorCanvas();
    return;
  }
  if (opts.render === 'full') render();
  else refreshEditorChrome();
}

/** Mode C: system keyboard only for text/barcode/qrcode. Date/serial use selected+content tab. */
function enterContentMode(element) {
  if (!element) return;
  state.selectedIds = [element.id];
  state.selectedId = element.id;
  state.editorPanelTab = 'content';
  state.panelCollapsed = false;
  state.editorMenu = false;
  if (isKeyboardContentType(element.type)) {
    state.editorMode = 'content';
    if (!contentUndoBefore) contentUndoBefore = cloneDocument(state.document);
    refreshEditorChrome({ animateBody: true });
    // Focus immediately (same gesture tick when possible) + rAF/timeout for WebView IME
    const focus = () => focusElementEditor(element);
    focus();
    requestAnimationFrame(() => {
      focus();
      setTimeout(focus, 50);
    });
  } else {
    state.editorMode = 'selected';
    refreshEditorChrome({ animateBody: true });
  }
}

function refreshEditorChrome(options) {
  const opts = options || {};
  if (state.route !== 'editor' || !state.document) {
    render();
    return;
  }
  const stage = document.querySelector('.niim-stage');
  const panel = document.querySelector('.niim-panel.editor-panel');
  if (!stage || !panel || !canvasState) {
    render();
    return;
  }
  const element = selectedElement(state);
  const selection = selectedElements(state);
  const kbMode = isContentKeyboardMode();

  // While typing, never remount the content input (keeps IME up)
  if (kbMode && opts.preserveContentInput) {
    drawEditorCanvas();
    positionFloatChrome();
    syncContentClearButton();
    return;
  }

  // Float chrome
  stage.querySelectorAll('.niim-float-bar, .niim-float-multi').forEach((node) => node.remove());
  const floatHtml = contextActions(state);
  if (floatHtml) {
    const holder = document.createElement('div');
    holder.innerHTML = floatHtml;
    while (holder.firstChild) stage.insertBefore(holder.firstChild, stage.firstChild);
  }

  panel.classList.toggle('locked', !!(element && element.locked && selection.length === 1));
  const prevTab = panel.querySelector('.niim-panel-tab.active')?.dataset?.tab;
  const nextTab = state.editorPanelTab;
  panel.innerHTML = propertyPanel(state);
  const body = panel.querySelector('.niim-panel-body');
  if (body && opts.animateBody !== false && prevTab !== nextTab) {
    body.classList.remove('panel-body-enter');
    void body.offsetWidth;
    body.classList.add('panel-body-enter');
  }

  const expand = stage.querySelector('.niim-canvas-expand');
  if (expand) expand.style.display = selection.length ? 'none' : '';
  const shell = document.querySelector('.niim-editor');
  if (shell) {
    shell.classList.toggle('has-selection', selection.length > 0);
    shell.classList.toggle('content-editing', kbMode);
    shell.classList.toggle('panel-selected', state.editorMode === 'selected' || (state.editorMode === 'content' && !kbMode));
    shell.classList.toggle('panel-add', state.editorMode === 'add' && !selection.length);
    shell.classList.toggle('panel-collapsed', !!state.panelCollapsed);
  }
  positionFloatChrome();
  positionTabIndicator(opts.animateIndicator !== false);
  patchHistoryButtons();
  drawEditorCanvas();
  paintMaterialThumbs();
}

/**
 * The top bar lives outside the panel that refreshEditorChrome re-renders, so
 * undo/redo stayed greyed out until the next full render. Patch them in place.
 */
function patchHistoryButtons() {
  const undoButton = document.querySelector('.niim-topbar [data-action="undo"]');
  const redoButton = document.querySelector('.niim-topbar [data-action="redo"]');
  if (undoButton) undoButton.disabled = !state.undo.length;
  if (redoButton) redoButton.disabled = !state.redo.length;
}

function syncContentClearButton() {
  const bar = document.querySelector('.niim-content-bar');
  const input = document.querySelector('.niim-content-line');
  if (!bar || !input) return;
  const hasValue = String(input.value || '').length > 0;
  let clearBtn = bar.querySelector('.niim-content-clear');
  if (hasValue && !clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'niim-content-clear';
    clearBtn.dataset.action = 'clear-content';
    clearBtn.title = '清除';
    clearBtn.tabIndex = -1;
    clearBtn.textContent = '×';
    const done = bar.querySelector('.niim-content-done');
    const scan = bar.querySelector('.niim-content-scan');
    bar.insertBefore(clearBtn, scan || done || null);
  } else if (!hasValue && clearBtn) {
    clearBtn.remove();
  }
}

/** Compact / Looser: change gaps between multi-selected elements along primary axis. */
function spaceSelection(deltaMm, axis) {
  const items = selectedItems().filter((item) => !item.locked);
  if (items.length < 2) {
    toast('请至少选择 2 个元素', 'error');
    return;
  }
  const delta = Number(deltaMm) || 0;
  commit((documentValue) => {
    const current = documentValue.elements.filter((item) => items.some((selected) => selected.id === item.id));
    let horizontal;
    if (axis === 'h') horizontal = true;
    else if (axis === 'v') horizontal = false;
    else {
      const widthSpan = Math.max(...current.map((item) => item.x + item.width)) - Math.min(...current.map((item) => item.x));
      const heightSpan = Math.max(...current.map((item) => item.y + item.height)) - Math.min(...current.map((item) => item.y));
      horizontal = widthSpan >= heightSpan;
    }
    current.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    for (let index = 1; index < current.length; index += 1) {
      const prev = current[index - 1];
      const item = current[index];
      if (horizontal) {
        const gap = item.x - (prev.x + prev.width);
        item.x = prev.x + prev.width + Math.max(0.2, gap + delta);
      } else {
        const gap = item.y - (prev.y + prev.height);
        item.y = prev.y + prev.height + Math.max(0.2, gap + delta);
      }
      clampElement(item, documentValue);
    }
  });
}

function initializeEditorCanvas() {
  const canvas = document.getElementById('label-canvas');
  const selection = document.getElementById('selection-canvas');
  const viewport = document.getElementById('canvas-viewport');
  if (!canvas || !selection || !viewport) return;
  try {
    fitEditorCanvasFrame();
    const profile = currentProfile();
    // Editing is independent of the currently selected printer. Printer-head limits
    // are checked when the print flow starts, while the canvas remains usable for
    // every saved template size.
    const size = previewCanvasSize(state.document, profile.dpi);
    canvas.width = size.width;
    canvas.height = size.height;
    selection.width = size.width;
    selection.height = size.height;
    canvasState = {
      canvas,
      context: canvas.getContext('2d', { willReadFrequently: true }),
      selection,
      selectionContext: selection.getContext('2d'),
      size,
      profile,
      viewport,
      zoomFrame: document.querySelector('.canvas-zoom-frame'),
      drag: null,
      pointers: new Map(),
      pinch: null
    };
    drawEditorCanvas();
    loadDocumentImages().then(drawEditorCanvas);
    bindCanvasGestures(selection);
  } catch (error) {
    canvasState = null;
    toast(error.message, 'error');
  }
}

function fitEditorCanvasFrame() {
  const stage = document.querySelector('.editor-stage');
  const workarea = document.querySelector('.canvas-workarea');
  const fitFrame = document.querySelector('.canvas-fit-frame');
  if (!stage || !workarea || !fitFrame || !state.document) return;
  const styles = getComputedStyle(stage);
  const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const verticalPadding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
  const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
  const workareaWidth = Math.min(720, availableWidth);
  const ratio = state.document.widthMm / state.document.heightMm;
  const fittedWidth = Math.max(1, Math.min(workareaWidth, availableHeight * ratio));
  const fittedHeight = fittedWidth / ratio;
  workarea.style.width = `${workareaWidth}px`;
  workarea.style.height = `${availableHeight}px`;
  fitFrame.style.width = `${fittedWidth}px`;
  fitFrame.style.height = `${fittedHeight}px`;
}

function pointerToMm(event) {
  const rect = canvasState.selection.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * state.document.widthMm,
    y: (event.clientY - rect.top) / rect.height * state.document.heightMm
  };
}

function setSelection(ids) {
  const valid = Array.from(new Set((ids || []).filter((id) => state.document && state.document.elements.some((item) => item.id === id))));
  state.selectedIds = valid;
  state.selectedId = valid[valid.length - 1] || '';
  if (!valid.length && state.route === 'editor') {
    state.editorPanelTab = 'elements';
    state.editorMode = 'add';
    state.panelCollapsed = false;
    state.multiSelect = false;
  } else if (valid.length > 1) {
    state.editorPanelTab = 'arrange';
    state.editorMode = 'selected';
  } else if (valid.length === 1) {
    if (state.editorMode !== 'content') state.editorMode = 'selected';
  }
}

function localPoint(element, point) {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const angle = -(Number(element.rotation) || 0) * Math.PI / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle)
  };
}

function selectionHandle(element, point) {
  const local = localPoint(element, point);
  // Tight hit radius so body drag is not stolen by E/S/rotate (esp. short text content box)
  const radius = 0.85;
  const h = typeof contentHandleLocalMm === 'function'
    ? contentHandleLocalMm(element)
    : { e: { x: element.width / 2, y: 0 }, s: { x: 0, y: element.height / 2 }, se: { x: element.width / 2, y: element.height / 2 } };
  // Hit-test matches drawn handles on content-fitted box
  if (Math.abs(local.x - h.se.x) <= radius && Math.abs(local.y - h.se.y) <= radius) return 'rotate';
  if (Math.abs(local.x - h.e.x) <= radius && Math.abs(local.y - h.e.y) <= radius) return 'e';
  if (Math.abs(local.x - h.s.x) <= radius && Math.abs(local.y - h.s.y) <= radius) return 's';
  return '';
}

function bindCanvasGestures(selection) {
  selection.onpointerdown = (event) => {
    event.preventDefault();
    clearLongPressTimer();
    canvasState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (canvasState.pointers.size >= 2) {
      const points = [...canvasState.pointers.values()];
      canvasState.pinch = {
        startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        startZoom: state.zoom
      };
      canvasState.pendingChrome = false;
      canvasState.drag = null;
      selection.setPointerCapture(event.pointerId);
      return;
    }
    const point = pointerToMm(event);
    const active = selectedElement(state);
    const activeHandle = selectedItems().length === 1 && active && !active.locked ? selectionHandle(active, point) : '';
    const element = activeHandle ? active : hitTest(state.document, point.x, point.y);
    const currentIds = Array.isArray(state.selectedIds) ? state.selectedIds : [];

    // Multi / shift: add unselected; re-tap selected removes
    if (element && (state.multiSelect || event.shiftKey) && !activeHandle) {
      if (currentIds.includes(element.id)) {
        const next = currentIds.filter((id) => id !== element.id);
        if (next.length) enterSelectedMode(next, { reason: 'select' });
        else enterAddMode();
      } else {
        enterSelectedMode([...currentIds, element.id], { reason: 'select', keepTab: false });
      }
      canvasState.drag = { pointerId: event.pointerId, moved: false, empty: true, selectionOnly: true };
      selection.setPointerCapture(event.pointerId);
      return;
    }

    // Blank stage: defer deselect/fold to pointerup (tap only if client move < 10px)
    if (!element) {
      canvasState.drag = {
        pointerId: event.pointerId,
        moved: false,
        empty: true,
        blankTap: true,
        clientStartX: event.clientX,
        clientStartY: event.clientY,
        selectionOnly: true
      };
      selection.setPointerCapture(event.pointerId);
      return;
    }

    // Already-selected BEFORE this gesture? Handles only then; first press = move.
    const singleAlready = currentIds.length === 1 && currentIds[0] === element.id;
    const handleNow = (singleAlready && !element.locked)
      ? (activeHandle || selectionHandle(element, point) || "")
      : "";

    // Soft-select: do not remount float/panel mid-pointerdown (breaks drag on WebView).
    // Do not collapse multi-selection when pressing a member already selected.
    const alreadyInSelection = currentIds.includes(element.id);
    if (!alreadyInSelection) {
      enterSelectedMode([element.id], {
        reason: "select",
        soft: true,
        keepTab: false
      });
      if (canvasState) canvasState.pendingChrome = true;
    }

    const tapToContent = singleAlready
      && !element.locked
      && !handleNow
      && state.editorMode === "selected"
      && ["text", "barcode", "qrcode", "date", "serial"].includes(element.type);

    const mode = element.locked ? "locked" : (handleNow || "move");
    const originals = selectedElements(state).map((item) => ({
      id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation
    }));
    canvasState.drag = {
      pointerId: event.pointerId,
      before: cloneDocument(state.document),
      startX: point.x,
      startY: point.y,
      clientStartX: event.clientX,
      clientStartY: event.clientY,
      mode,
      handle: mode,
      originals,
      rotateCenter: { x: element.x + element.width / 2, y: element.y + element.height / 2 },
      startPointerAngle: pointerAngle(point, { x: element.x + element.width / 2, y: element.y + element.height / 2 }),
      moved: false,
      passedDeadzone: mode !== "move",
      tapToContent,
      guides: []
    };
    try { selection.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    clearLongPressTimer();
    if (!handleNow && element && !state.multiSelect) {
      const pressId = element.id;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        const drag = canvasState && canvasState.drag;
        if (!drag || drag.moved || drag.pointerId !== event.pointerId) return;
        state.multiSelect = true;
        const ids = Array.isArray(state.selectedIds) ? state.selectedIds.slice() : [];
        if (!ids.includes(pressId)) ids.push(pressId);
        enterSelectedMode(ids, { tab: "arrange", reason: "select", soft: true });
        if (canvasState) canvasState.pendingChrome = true;
        toast("多选已开启");
        drawEditorCanvas();
      }, 450);
    }
    drawEditorCanvas();
  };

  selection.onpointermove = (event) => {
    if (canvasState && canvasState.pointers.has(event.pointerId)) {
      canvasState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (canvasState && canvasState.pinch && canvasState.pointers.size >= 2) {
      const points = [...canvasState.pointers.values()];
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      state.zoom = Math.max(60, Math.min(180, Math.round(canvasState.pinch.startZoom * distance / canvasState.pinch.startDistance)));
      if (canvasState.zoomFrame) canvasState.zoomFrame.style.width = `${state.zoom}%`;
      const label = document.querySelector('.zoom-label');
      if (label) label.textContent = `${state.zoom}%`;
      return;
    }
    const drag = canvasState && canvasState.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.empty && drag.blankTap) {
      const dx = event.clientX - (drag.clientStartX || 0);
      const dy = event.clientY - (drag.clientStartY || 0);
      if (Math.hypot(dx, dy) > 10) drag.moved = true;
      return;
    }
    if (drag.empty || drag.mode === 'locked') return;
    event.preventDefault();
    const element = selectedElement(state);
    if (!element) return;
    const point = pointerToMm(event);
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;

    // Dead zone: tiny finger jitter does not start a move (prevents "tap but shifted")
    if (drag.mode === 'move' && !drag.passedDeadzone) {
      if (Math.hypot(deltaX, deltaY) < MOVE_DEADZONE_MM) return;
      drag.passedDeadzone = true;
    }

    drag.guides = [];
    if (drag.mode === 'move') {
      const single = drag.originals.length === 1;
      drag.originals.forEach((original) => {
        const target = state.document.elements.find((item) => item.id === original.id);
        if (!target || target.locked) return;
        target.x = original.x + deltaX;
        target.y = original.y + deltaY;
        if (single && !event.altKey) {
          const others = state.document.elements.filter((item) => item.id !== target.id);
          const snapped = snapElementPosition(target, state.document, others, 0.45);
          target.x = snapped.x;
          target.y = snapped.y;
          drag.guides = snapped.guides;
        }
        clampElement(target, state.document);
      });
    } else if (drag.mode === 'rotate') {
      const angle = pointerAngle(point, drag.rotateCenter);
      const delta = normalizeAngleDelta(angle - drag.startPointerAngle);
      element.rotation = Math.round((drag.originals[0].rotation + delta) / 5) * 5;
    } else {
      const original = drag.originals.find((item) => item.id === element.id);
      if (original) {
        Object.assign(element, resizeRotatedElement(original, drag.handle, { x: deltaX, y: deltaY }, 1));
        clampElement(element, state.document);
      }
    }
    drag.moved = true;
    clearLongPressTimer();
    const bar = document.querySelector(".niim-float-bar, .niim-float-multi");
    if (bar) bar.style.pointerEvents = "none";
    drawEditorCanvas();
  };

  selection.onpointerup = (event) => {
    if (canvasState) canvasState.pointers.delete(event.pointerId);
    if (canvasState && canvasState.pinch) {
      if (canvasState.pointers.size < 2) canvasState.pinch = null;
      if (canvasState.pointers.size) return;
      canvasState.drag = null;
      drawEditorCanvas();
      return;
    }
    finishCanvasGesture(event);
  };
  selection.onpointercancel = (event) => {
    if (canvasState) canvasState.pointers.delete(event.pointerId);
    if (canvasState && canvasState.pinch) {
      canvasState.pinch = null;
      canvasState.drag = null;
      drawEditorCanvas();
      return;
    }
    finishCanvasGesture(event);
  };
  selection.ondblclick = (event) => {
    event.preventDefault();
    if (!state.document) return;
    const point = pointerToMm(event);
    const element = hitTest(state.document, point.x, point.y);
    if (!element) {
      state.zoom = 100;
      if (canvasState.zoomFrame) canvasState.zoomFrame.style.width = '100%';
      const label = document.querySelector('.zoom-label');
      if (label) label.textContent = '100%';
      return;
    }
    if (['text', 'serial', 'barcode', 'qrcode', 'table', 'date'].includes(element.type)) {
      enterContentMode(element);
    } else {
      enterSelectedMode([element.id], { reason: 'select', tab: 'style' });
    }
  };
}

function finishCanvasGesture(event) {
  clearLongPressTimer();
  const drag = canvasState && canvasState.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.empty && drag.blankTap) {
    const moved = drag.moved;
    canvasState.drag = null;
    if (!moved) handleBlankCanvasTap();
    return;
  }

  // Commit undo only after a real transform (not a tap)
  if (drag.moved && !drag.empty && drag.before) {
    state.undo.push(drag.before);
    if (state.undo.length > 30) state.undo.shift();
    state.redo = [];
    autosave();
  }
  const openContent = !drag.moved && drag.tapToContent && !state.multiSelect;
  if (drag) drag.guides = [];
  const needChrome = !!(canvasState && canvasState.pendingChrome);
  if (canvasState) {
    canvasState.drag = null;
    canvasState.pendingChrome = false;
  }
  if (openContent) {
    enterContentMode(selectedElement(state));
    return;
  }
  if (needChrome) {
    refreshEditorChrome({ animateBody: false, animateIndicator: false });
  } else {
    drawEditorCanvas();
    positionFloatChrome();
    patchHistoryButtons();
  }
}

function autosave() {
  if (state.settings.autosave && state.document) {
    try {
      upsertProject(state);
    } catch (error) {
      toast('本地存储空间不足，当前修改仍保留在编辑器中', 'error');
      return false;
    }
  }
  return true;
}

function commit(mutator) {
  if (!state.document) return;
  const before = cloneDocument(state.document);
  try {
    mutator(state.document);
    syncLinkedDates(state.document);
    state.document.elements.forEach((element) => clampElement(element, state.document));
    previewCanvasSize(state.document, currentProfile().dpi);
    state.undo.push(before);
    if (state.undo.length > 30) state.undo.shift();
    state.redo = [];
    autosave();
    render();
  } catch (error) {
    state.document = before;
    toast(error.message, 'error');
    render();
  }
}

/**
 * Style/property mutations: undo + canvas + light chrome patch (no full shell remount).
 * Use for B/U/color/spacing/align toggles that only need live paint + button active state.
 */
function softCommit(mutator, options) {
  if (!state.document) return;
  const opts = options || {};
  const before = cloneDocument(state.document);
  try {
    mutator(state.document);
    syncLinkedDates(state.document);
    state.document.elements.forEach((element) => clampElement(element, state.document));
    state.undo.push(before);
    if (state.undo.length > 30) state.undo.shift();
    state.redo = [];
    autosave();
    if (opts.refreshChrome) refreshEditorChrome({ animateBody: false, animateIndicator: false });
    else {
      drawEditorCanvas();
      if (opts.patchActive) patchActiveStyleControls();
    }
  } catch (error) {
    state.document = before;
    toast(error.message, 'error');
    refreshEditorChrome({ animateBody: false });
  }
}

function patchActiveStyleControls() {
  const el = selectedElement(state);
  if (!el) return;
  document.querySelectorAll('.niim-tbtn[data-field]').forEach((btn) => {
    const field = btn.dataset.field;
    if (!field) return;
    btn.classList.toggle('active', !!el[field]);
  });
  document.querySelectorAll('.niim-color-dot[data-value]').forEach((btn) => {
    const reverse = btn.dataset.reverse === '1';
    const match = (el.color || '#000000').toUpperCase() === String(btn.dataset.value || '').toUpperCase()
      && !!el.reverse === reverse;
    btn.classList.toggle('active', match);
  });
  document.querySelectorAll('.niim-align-t[data-action="set-align"]').forEach((btn) => {
    btn.classList.toggle('active', (el.align || 'left') === btn.dataset.value);
  });
  document.querySelectorAll('.niim-align-t[data-action="set-vertical-align"]').forEach((btn) => {
    btn.classList.toggle('active', (el.verticalAlign || 'middle') === btn.dataset.value);
  });
  document.querySelectorAll('.niim-switch').forEach((sw) => {
    const row = sw.closest('[data-field], [data-action="toggle-element"]');
    const field = row?.dataset?.field || sw.closest('[data-field]')?.dataset?.field;
    if (!field) return;
    sw.classList.toggle('on', !!el[field]);
  });
  const readout = document.querySelector('.niim-size-readout');
  if (readout && el.fontSize != null) readout.textContent = Number(el.fontSize).toFixed(1);
  const slider = document.querySelector('.niim-size-slider');
  if (slider && el.fontSize != null) slider.value = String(el.fontSize);
  document.querySelectorAll('.niim-spacing-item em').forEach((em, index) => {
    if (index === 0) em.textContent = (Math.round((Number(el.letterSpacing) || 0) * 10) / 10).toFixed(1);
    if (index === 1) em.textContent = (Math.round((Number(el.lineSpacing) || 0) * 10) / 10).toFixed(1);
  });
  document.querySelectorAll('.niim-mirror-row .niim-switch').forEach((sw) => {
    const btn = sw.closest('[data-action="toggle-element"]');
    if (!btn || !btn.dataset.field) return;
    sw.classList.toggle('on', !!el[btn.dataset.field]);
  });
}

/** Live edit without remounting panel DOM (content typing / size slider). */
function softUpdate(mutator, options) {
  if (!state.document) return;
  const opts = options || {};
  try {
    mutator(state.document);
    syncLinkedDates(state.document);
    state.document.elements.forEach((element) => clampElement(element, state.document));
    if (opts.undoSnapshot) {
      state.undo.push(opts.undoSnapshot);
      if (state.undo.length > 30) state.undo.shift();
      state.redo = [];
    }
    if (opts.autosave !== false) autosave();
    drawEditorCanvas();
    if (opts.patchReadout) opts.patchReadout();
    if (opts.syncClear) syncContentClearButton();
  } catch (error) {
    toast(error.message, 'error');
  }
}

let contentUndoBefore = null;

function createBlankLabel() {
  const width = Number(state.settings.defaultWidthMm) || currentProfile().defaultSize[0];
  const height = Number(state.settings.defaultHeightMm) || currentProfile().defaultSize[1];
  const documentValue = createDocument(width, height);
  documentValue.elements = [];
  documentValue.name = '未命名标签';
  openDocument(state, documentValue);
  render();
}

function documentFromTemplateId(id) {
  const template = templates.find((item) => item.id === id);
  if (template) return templateDocument(template);
  const userTemplate = state.userTemplates.find((item) => item.id === id);
  if (userTemplate && userTemplate.document) return cloneDocument(userTemplate.document);
  return templateDocument(templates[0]);
}

function openTemplate(id) {
  openDocument(state, documentFromTemplateId(id));
  // Keep the editor landing state idle. `openDocument` selects the first
  // element for its state-level contract; the UI template flow starts with
  // the add-elements panel and lets the first tap select the canvas item.
  state.selectedId = '';
  state.selectedIds = [];
  state.multiSelect = false;
  state.editorMode = 'add';
  state.editorPanelTab = 'elements';
  state.panelCollapsed = false;
  render();
}

/**
 * The editor panel animates its height when switching between add/selected/content
 * modes. The canvas is vertically centered in the remaining stage, so its screen
 * position changes during that transition even when its own size does not. Observe
 * the stage and re-position the floating bar while the layout settles.
 */
function bindFloatLayoutObserver() {
  if (typeof ResizeObserver === 'undefined') return;
  const stage = document.querySelector('.niim-stage');
  if (!stage) return;
  if (floatLayoutObserver) floatLayoutObserver.disconnect();
  floatLayoutObserver = new ResizeObserver(() => {
    if (state.route === 'editor' && state.document) positionFloatChrome();
  });
  floatLayoutObserver.observe(stage);
}

function applySizeToDocument(documentValue, widthMm, heightMm) {
  const width = Math.max(5, Math.min(200, Number(widthMm) || 40));
  const height = Math.max(5, Math.min(200, Number(heightMm) || 30));
  documentValue.widthMm = width;
  documentValue.heightMm = height;
  (documentValue.elements || []).forEach((element) => clampElement(element, documentValue));
  return documentValue;
}

function openStockSheet() {
  if (state.document) {
    state.stockWidthMm = state.document.widthMm;
    state.stockHeightMm = state.document.heightMm;
  } else {
    state.stockWidthMm = state.settings.defaultWidthMm || 50;
    state.stockHeightMm = state.settings.defaultHeightMm || 30;
  }
  state.stockApplyCurrent = true;
  state.modal = 'stock';
  renderModalOnly();
}

function applyStock() {
  const width = Math.max(5, Math.min(200, Number(state.stockWidthMm) || 50));
  const height = Math.max(5, Math.min(200, Number(state.stockHeightMm) || 30));
  const profile = currentProfile();
  state.settings.defaultWidthMm = width;
  state.settings.defaultHeightMm = height;
  state.settings.installedStock = stockLabel(width, height, profile.dpi);
  persistSettings(state);

  state.modal = '';
  if (state.route === 'editor' && state.document && state.stockApplyCurrent !== false) {
    commit((documentValue) => {
      applySizeToDocument(documentValue, width, height);
    });
    toast(`已应用 ${width}×${height} mm`);
    return;
  }
  render();
  toast(`默认标签纸：${width}×${height} mm`);
}

function openBatchSheet() {
  if (!state.dataRows.length) {
    toast('请先添加或导入批量数据', 'error');
    return;
  }
  state.batchSelectedRows = state.dataRows.map((_, index) => index);
  state.batchMode = state.batchMode || 'open-first';
  state.modal = 'batch';
  renderModalOnly();
}

function runBatch() {
  const rows = state.dataRows || [];
  const selected = Array.isArray(state.batchSelectedRows)
    ? state.batchSelectedRows.filter((index) => index >= 0 && index < rows.length)
    : rows.map((_, index) => index);
  if (!selected.length) {
    toast('请至少选择一行数据', 'error');
    return;
  }
  const templateId = state.settings.batchTemplateId || templates[0].id;
  const picked = selected.map((index) => rows[index]);
  const documents = buildDocumentsFromRows(
    () => documentFromTemplateId(templateId),
    picked
  );
  if (state.batchMode === 'projects') {
    const now = Date.now();
    const projects = documents.map((documentValue, index) => ({
      id: `project-batch-${now.toString(36)}-${index}`,
      updatedAt: now - index,
      document: documentValue
    }));
    state.projects = [...projects, ...state.projects].slice(0, 80);
    try {
      write(KEYS.projects, state.projects);
    } catch (error) {
      toast('保存项目失败：本地空间不足', 'error');
      return;
    }
    state.modal = '';
    state.route = 'home';
    render();
    toast(`已生成 ${projects.length} 个标签项目`);
    return;
  }
  openDocument(state, documents[0]);
  state.modal = '';
  render();
  toast(documents.length > 1
    ? `已打开第 1 / ${documents.length} 行（其余可再生成到项目）`
    : '已套用数据到模板');
}

function openProject(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  openDocument(state, project.document, project.id);
  render();
}

function saveProject(showMessage) {
  try {
    const project = upsertProject(state);
    if (project && showMessage !== false) toast('标签已保存');
    render();
  } catch (error) {
    toast('保存失败：本地存储空间不足', 'error');
  }
}

function closeEditor() {
  try {
    if (state.document) upsertProject(state);
  } catch (error) {
    toast('保存失败：请清理本地空间后再退出', 'error');
    return;
  }
  state.route = 'home';
  state.document = null;
  state.selectedId = '';
  state.selectedIds = [];
  canvasState = null;
  render();
}

function undo() {
  if (!state.undo.length) return;
  const keepIds = (state.selectedIds || []).slice();
  state.redo.push(cloneDocument(state.document));
  state.document = state.undo.pop();
  const valid = keepIds.filter((id) => state.document.elements.some((el) => el.id === id));
  if (valid.length) enterSelectedMode(valid, { reason: 'select', keepTab: true, render: 'full' });
  else {
    setSelection([]);
    state.editorMode = 'add';
    state.editorPanelTab = 'elements';
    autosave();
    render();
  }
  autosave();
}

function redo() {
  if (!state.redo.length) return;
  const keepIds = (state.selectedIds || []).slice();
  state.undo.push(cloneDocument(state.document));
  state.document = state.redo.pop();
  const valid = keepIds.filter((id) => state.document.elements.some((el) => el.id === id));
  if (valid.length) enterSelectedMode(valid, { reason: 'select', keepTab: true, render: 'full' });
  else {
    setSelection([]);
    state.editorMode = 'add';
    state.editorPanelTab = 'elements';
    autosave();
    render();
  }
  autosave();
}

function chooseFile(accept, capture) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '*/*';
    if (capture) input.capture = capture;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(input.files && input.files[0] ? input.files[0] : null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function readFile(file, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    if (mode === 'data-url') reader.readAsDataURL(file);
    else reader.readAsText(file, 'UTF-8');
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxDimension = 1024;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.86;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 1200000 && quality > 0.52) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 1400000) throw new Error('图片压缩后仍过大，请选择较小的图片');
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error('图片读取失败'));
    };
    image.src = sourceUrl;
  });
}

async function addImage(replace, capture) {
  const file = await chooseFile('image/png,image/jpeg,image/webp', capture ? 'environment' : '');
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    toast('图片不能超过 8 MB', 'error');
    return;
  }
  try {
    const dataUrl = await compressImage(file);
    commit((documentValue) => {
      let element = replace ? selectedElement(state) : null;
      if (!element || element.type !== 'image') {
        element = createElement('image', documentValue);
        placeNewElement(element, documentValue);
        documentValue.elements.push(element);
        setSelection(state.multiSelect ? [...state.selectedIds, element.id] : [element.id]);
      }
      element.path = dataUrl;
      state.editorPanelTab = 'content';
      delete state.images[element.id];
    });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function download(name, contents, type) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProject() {
  const file = await chooseFile('application/json,.json');
  if (!file) return;
  try {
    const parsed = JSON.parse(await readFile(file));
    const documentValue = parsed.document || parsed;
    if (!documentValue || !Number.isFinite(Number(documentValue.widthMm)) || Number(documentValue.widthMm) <= 0
      || !Number.isFinite(Number(documentValue.heightMm)) || Number(documentValue.heightMm) <= 0
      || !Array.isArray(documentValue.elements)) {
      throw new Error('项目文件格式无效');
    }
    openDocument(state, documentValue);
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function importCsv() {
  const file = await chooseFile('text/csv,.csv');
  if (!file) return;
  if (file.size > 300 * 1024) {
    toast('CSV 文件不能超过 300 KB', 'error');
    return;
  }
  try {
    const records = rowsToRecords(parseCsv(await readFile(file)), ['name', 'code', 'price', 'date']);
    if (!records.length) throw new Error('CSV 中没有数据行');
    if (records.length > 2000) throw new Error('单次最多导入 2000 条数据');
    state.dataRows = records;
    persistRows(state);
    render();
    toast(`已导入 ${records.length} 条数据`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function exportCsv() {
  const columns = ['name', 'code', 'price', 'date'];
  const rows = [columns, ...state.dataRows.map((item) => columns.map((column) => item[column]))];
  download('label-data.csv', `\uFEFF${stringifyCsv(rows)}`, 'text/csv;charset=utf-8');
}

function batchCreate() {
  openBatchSheet();
}

function persistUserTemplates(next) {
  write(KEYS.templates, next);
  state.userTemplates = next;
}

function renameUserTemplate(id) {
  const input = document.getElementById('rename-template');
  const name = (input && input.value ? input.value : '').trim();
  if (!name) {
    toast('名称不能为空', 'error');
    return;
  }
  const next = state.userTemplates.map((item) => {
    if (item.id !== id) return item;
    const documentValue = item.document ? cloneDocument(item.document) : item.document;
    if (documentValue) documentValue.name = name;
    return Object.assign({}, item, { name, document: documentValue });
  });
  try {
    persistUserTemplates(next);
    invalidateThumbsByPrefix(id);
    state.modal = '';
    render();
    toast('模板已重命名');
  } catch (error) {
    toast('保存失败', 'error');
  }
}

function deleteUserTemplate(id) {
  if (!window.confirm('确定删除该模板？此操作不可撤销。')) return;
  const next = state.userTemplates.filter((item) => item.id !== id);
  try {
    persistUserTemplates(next);
    invalidateThumbsByPrefix(id);
    state.modal = '';
    state.manageTemplateId = '';
    render();
    toast('模板已删除');
  } catch (error) {
    toast('删除失败', 'error');
  }
}

async function openDevices() {
  state.modal = 'devices';
  renderModalOnly();
  if (!state.device) await scanDevices();
}

async function scanDevices() {
  if (state.scanning) return;
  state.scanning = true;
  state.devices = [];
  renderModalOnly();
  clearTimeout(scanTimer);
  try {
    await session.scan((devices) => {
      state.devices = devices;
      renderModalOnly();
    });
    scanTimer = setTimeout(async () => {
      await session.stopScan();
      state.scanning = false;
      renderModalOnly();
    }, 7000);
  } catch (error) {
    state.scanning = false;
    renderModalOnly();
    toast(error.message, 'error');
  }
}

async function connectDevice(deviceId) {
  if (state.connecting) return;
  const device = state.devices.find((item) => item.deviceId === deviceId);
  if (!device) return;
  state.connecting = true;
  state.scanning = false;
  clearTimeout(scanTimer);
  renderModalOnly();
  try {
    const details = await printer.connect(device);
    const profile = profileForModelId(details.modelId, device.displayName, details.protocolVersion);
    if (!profile) {
      throw new Error(`型号 ID ${details.modelId == null ? '未知' : details.modelId} 尚未配置打印参数`);
    }
    state.settings.defaultProfileId = profile.id;
    persistSettings(state);
    state.device = {
      deviceId: device.deviceId,
      name: details.name,
      mtu: details.mtu,
      maxWriteSize: details.maxWriteSize,
      modelId: details.modelId,
      protocolVersion: details.protocolVersion,
      info: details.info,
      profileId: profile.id,
      preview: bleApi.platform === 'preview'
    };
    state.connecting = false;
    toast(`${details.name} 已连接`);
    if (state.printIntent && state.document) {
      // The user pressed 连接并打印 — finish what they asked for.
      state.printIntent = false;
      state.modal = 'print';
      render();
      await startPrint();
      return;
    }
    state.printIntent = false;
    state.modal = '';
    render();
  } catch (error) {
    state.connecting = false;
    state.device = null;
    renderModalOnly();
    toast(error.message, 'error');
  }
}

async function disconnectDevice() {
  intentionalDisconnect = true;
  clearTimeout(scanTimer);
  try {
    await session.disconnect();
  } finally {
    intentionalDisconnect = false;
    state.device = null;
    state.modal = 'devices';
    render();
  }
}

/**
 * Why the current label cannot print on the current profile, if anything.
 * Never throws: the print sheet is the only place that hosts the model picker,
 * so refusing to open it left the user with no way to fix the problem.
 */
function evaluatePrintBlock() {
  if (!state.document) return null;
  // Placeholder defaults block print until user edits content
  for (const el of state.document.elements || []) {
    if (!isPlaceholderElement(el)) continue;
    let message = "请先编辑内容";
    if (el.type === "text") message = "请先编辑文字内容，当前仍是默认占位";
    else if (el.type === "barcode") message = "请先填写条码内容，当前仍是默认值";
    else if (el.type === "qrcode") message = "请先填写二维码内容，当前仍是默认链接";
    return { kind: "placeholder", message, elementId: el.id, suggestProfileId: "" };
  }
  const profile = currentProfile();
  const fit = evaluatePrintability(state.document, profile);
  if (!fit.ok) {
    return {
      kind: 'size',
      message: fit.message,
      suggestProfileId: fit.suggestProfileId
    };
  }
  try {
    validateDocument(state.document, profile.dpi);
  } catch (error) {
    return { kind: 'element', message: error.message, suggestProfileId: '' };
  }
  return null;
}

function openPrint() {
  state.printBlock = evaluatePrintBlock();
  state.printError = null;
  state.modal = 'print';
  renderModalOnly();
}

async function renderToCanvas(target, documentValue, options) {
  const source = documentValue || state.document;
  if (!source) return null;
  const profile = currentProfile();
  const opts = options || {};
  let size;
  try {
    size = alignedCanvasSize(source, profile);
  } catch (error) {
    // Preview still shows the label even when the model cannot print it,
    // so the warning bar has something to point at.
    if (!opts.allowUnaligned) throw error;
    size = previewCanvasSize(source, profile.dpi);
  }
  await loadDocumentImages(source);
  target.width = size.width;
  target.height = size.height;
  const context = target.getContext('2d', { willReadFrequently: true });
  renderDocument(context, source, size, profile.dpi, state.images);
  return { context, profile, size };
}

async function renderPrintPreview() {
  const canvas = document.getElementById('print-preview-canvas');
  if (!canvas) return;
  try {
    await renderToCanvas(canvas, null, { allowUnaligned: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}

function updateProgress(progress, message) {
  state.printProgress = progress;
  state.printMessage = message;
  const fill = modalRoot.querySelector('.progress-fill');
  const detail = modalRoot.querySelector('.progress-track + .device-meta');
  if (fill) fill.style.width = `${progress}%`;
  if (detail) detail.textContent = message;
}

async function startPrint() {
  if (state.printing) return;
  state.printBlock = evaluatePrintBlock();
  if (state.printBlock) {
    renderModalOnly();
    return;
  }
  if (!state.device) {
    // Remember that the user asked to print, so connecting finishes the job
    // instead of dropping them back into the editor with nothing printed.
    state.printIntent = true;
    state.modal = 'devices';
    renderModalOnly();
    await scanDevices();
    return;
  }
  state.printing = true;
  state.printError = null;
  printCancelRequested = false;
  state.printProgress = 2;
  state.printMessage = '正在生成打印点阵';
  renderModalOnly();
  try {
    const copies = Math.max(1, Number(state.settings.copies) || 1);
    const serialElements = state.document.elements.filter((element) => element.type === 'serial');
    const printDocuments = serialElements.length
      ? Array.from({ length: copies }, (_, copyIndex) => {
        const next = cloneDocument(state.document);
        next.elements.filter((element) => element.type === 'serial').forEach((element) => {
          element.currentValue = (Number(element.start) || 0) + copyIndex * (Number(element.step) || 1);
        });
        return next;
      })
      : [state.document];
    for (let index = 0; index < printDocuments.length; index += 1) {
      const workCanvas = document.createElement('canvas');
      const printDocument = printDocuments[index];
      const rendered = await renderToCanvas(workCanvas, printDocument);
      validateDocument(printDocument, rendered.profile.dpi);
      const imageData = rendered.context.getImageData(0, 0, rendered.size.width, rendered.size.height);
      await printer.print(imageData, rendered.profile, {
        density: state.settings.density,
        threshold: state.settings.threshold,
        copies: serialElements.length ? 1 : copies,
        labelType: state.settings.labelType
      }, (progress, message) => {
        const combined = serialElements.length
          ? Math.round((index * 100 + progress) / printDocuments.length)
          : progress;
        updateProgress(combined, message);
      });
    }
    state.printing = false;
    state.printProgress = 100;
    state.printMessage = '打印完成';
    state.printError = null;
    renderModalOnly();
    recordPrint('success');
    toast('打印完成');
  } catch (error) {
    state.printing = false;
    // PrinterClient clears its own `cancelled` flag in a finally block that
    // runs before this catch, so the intent has to be tracked here.
    const cancelled = printCancelRequested || /已取消/.test(error.message || '');
    printCancelRequested = false;
    // Keep the reason on screen: a 2.8s toast is the wrong carrier for a
    // failure the user may only notice after looking back at the printer.
    state.printError = cancelled ? null : { message: friendlyPrintError(error) };
    renderModalOnly();
    recordPrint(cancelled ? 'cancelled' : 'failed', error.message);
    toast(cancelled ? '打印已取消' : state.printError.message, cancelled ? undefined : 'error');
  }
}

/** Turn protocol/BLE errors into something a shop owner can act on. */
function friendlyPrintError(error) {
  const raw = String((error && error.message) || '打印失败');
  if (/断开|disconnect|未连接|not connected/i.test(raw)) return '打印机连接已断开，请靠近后重新连接再试';
  if (/超时|timeout/i.test(raw)) return '打印机没有响应，请检查电源与纸仓后重试';
  if (/缺纸|no paper|paper/i.test(raw)) return '打印机缺纸或纸仓未合上，装好标签纸后重试';
  if (/电量|battery/i.test(raw)) return '打印机电量过低，充电后重试';
  return raw;
}

/**
 * The one way a sheet closes — shared by the ×, the backdrop, Escape and the
 * Android back button. Refuses while printing so the progress bar (the only
 * feedback the user has) cannot be wiped out by a stray tap.
 * Returns false when the sheet stayed open.
 */
async function closeModal() {
  if (state.printing) {
    toast('正在打印，完成后自动关闭');
    return false;
  }
  if (state.scanning) {
    clearTimeout(scanTimer);
    try {
      await session.stopScan();
    } catch (error) {
      // Scanning already stopped; closing must not depend on it.
    }
    state.scanning = false;
  }
  state.modal = '';
  state.templatePreviewId = '';
  state.printIntent = false;
  state.printBlock = null;
  state.printError = null;
  renderModalOnly();
  return true;
}

let printCancelRequested = false;

async function cancelPrint() {
  if (!state.printing) return;
  printCancelRequested = true;
  state.printMessage = '正在停止打印…';
  renderModalOnly();
  try {
    await printer.cancel();
  } catch (error) {
    // Local cancellation already stops queueing further rows.
  }
}

function recordPrint(result, error) {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem('niim-label:print-history') || '[]');
  } catch (parseError) {
    history = [];
  }
  const documentValue = state.document ? cloneDocument(state.document) : null;
  history.unshift({
    id: `print-${Date.now().toString(36)}`,
    name: documentValue ? documentValue.name : '',
    projectId: state.projectId || '',
    widthMm: documentValue ? documentValue.widthMm : null,
    heightMm: documentValue ? documentValue.heightMm : null,
    document: documentValue,
    device: state.device ? state.device.name : '',
    copies: state.settings.copies,
    result,
    error: error || '',
    createdAt: Date.now()
  });
  // Full document snapshots dominate the payload; keep them only for the
  // entries the user can realistically want to reopen.
  const next = history.slice(0, 80).map((item, index) => (
    index < 10 ? item : { ...item, document: null }
  ));
  state.printHistory = next;
  try {
    localStorage.setItem('niim-label:print-history', JSON.stringify(next));
  } catch (writeError) {
    // Never let history bookkeeping take down the print result the user is reading.
    try {
      const trimmed = next.slice(0, 10);
      localStorage.setItem('niim-label:print-history', JSON.stringify(trimmed));
      state.printHistory = trimmed;
    } catch (retryError) {
      toast('打印记录未能保存：本地空间不足', 'error');
    }
  }
}

function backupData() {
  const data = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    projects: state.projects,
    templates: state.userTemplates,
    settings: state.settings,
    dataRows: state.dataRows
  };
  download('niim-label-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function handleNavigation(route) {
  if (rowSaveTimer) flushRowSave();
  if (route === 'create') {
    createBlankLabel();
    return;
  }
  if (state.route === 'editor' && state.document) {
    try {
      upsertProject(state);
    } catch (error) {
      toast('保存失败：请清理本地空间后再离开编辑器', 'error');
      return;
    }
  }
  state.route = route;
  state.modal = '';
  render();
}

function selectedItems() {
  return selectedElements(state);
}

function dateControlElement(element) {
  if (!element || element.type !== 'date' || !state.document) return element;
  return linkedPrimary(state.document, element) || element;
}

function commitSelected(mutator, includeLocked) {
  const items = selectedItems();
  if (!items.length) return;
  commit((documentValue) => {
    const ids = items.map((item) => item.id);
    documentValue.elements
      .filter((item) => ids.includes(item.id) && (includeLocked || !item.locked))
      .forEach((item) => mutator(item));
  });
}

function rotateDocument() {
  if (!state.document) return;
  commit((documentValue) => {
    const oldWidth = documentValue.widthMm;
    const oldHeight = documentValue.heightMm;
    documentValue.elements.forEach((element) => {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const nextCenterX = oldHeight - centerY;
      const nextCenterY = centerX;
      element.x = nextCenterX - element.width / 2;
      element.y = nextCenterY - element.height / 2;
      element.rotation = (Number(element.rotation) + 90) % 360;
    });
    documentValue.widthMm = oldHeight;
    documentValue.heightMm = oldWidth;
    state.zoom = 100;
  });
}

function nudgeSelection(deltaX, deltaY) {
  commitSelected((element) => {
    element.x += deltaX;
    element.y += deltaY;
  });
}

function alignSelection(value) {
  const items = selectedItems();
  if (!items.length || !state.document) return;
  state.alignmentMenu = false;
  commit((documentValue) => {
    const current = documentValue.elements.filter((item) => items.some((selected) => selected.id === item.id) && !item.locked);
    if (!current.length) return;
    if (current.length === 1) {
      const item = current[0];
      if (value === 'left') item.x = 0;
      if (value === 'right') item.x = documentValue.widthMm - item.width;
      if (value === 'centerH') item.x = (documentValue.widthMm - item.width) / 2;
      if (value === 'top') item.y = 0;
      if (value === 'bottom') item.y = documentValue.heightMm - item.height;
      if (value === 'centerV') item.y = (documentValue.heightMm - item.height) / 2;
      return;
    }
    const left = Math.min(...current.map((item) => item.x));
    const right = Math.max(...current.map((item) => item.x + item.width));
    const top = Math.min(...current.map((item) => item.y));
    const bottom = Math.max(...current.map((item) => item.y + item.height));
    current.forEach((item) => {
      if (value === 'left') item.x = left;
      if (value === 'right') item.x = right - item.width;
      if (value === 'centerH') item.x = (left + right - item.width) / 2;
      if (value === 'top') item.y = top;
      if (value === 'bottom') item.y = bottom - item.height;
      if (value === 'centerV') item.y = (top + bottom - item.height) / 2;
    });
  });
}

function distributeSelection(axis) {
  const items = selectedItems().filter((item) => !item.locked);
  if (items.length < 3) {
    toast('至少选择 3 个元素才能等距分布', 'error');
    return;
  }
  state.alignmentMenu = false;
  commit((documentValue) => {
    const current = documentValue.elements.filter((item) => items.some((selected) => selected.id === item.id));
    const horizontal = axis === 'horizontal';
    current.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const first = horizontal ? current[0].x : current[0].y;
    const last = horizontal ? current[current.length - 1].x + current[current.length - 1].width : current[current.length - 1].y + current[current.length - 1].height;
    const occupied = current.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0);
    const gap = (last - first - occupied) / (current.length - 1);
    let cursor = first;
    current.forEach((item) => {
      if (horizontal) item.x = cursor;
      else item.y = cursor;
      cursor += (horizontal ? item.width : item.height) + gap;
    });
  });
}

function saveAsTemplate() {
  if (!state.document) return;
  const copy = cloneDocument(state.document);
  copy.id = `user-template-${Date.now().toString(36)}`;
  copy.name = `${copy.name || '未命名标签'}模板`;
  const nextTemplates = [{ id: copy.id, name: copy.name, document: copy, createdAt: Date.now() }, ...state.userTemplates];
  try {
    write(KEYS.templates, nextTemplates);
    state.userTemplates = nextTemplates;
    invalidateThumbsByPrefix(copy.id);
    toast('已保存为模板');
    render();
  } catch (error) {
    toast('保存模板失败：本地存储空间不足', 'error');
  }
}

function clearElements() {
  if (!state.document || !state.document.elements.length) return;
  commit((documentValue) => {
    documentValue.elements.forEach((item) => delete state.images[item.id]);
    documentValue.elements = [];
    state.selectedIds = [];
    state.selectedId = '';
    state.editorMode = 'add';
    state.editorPanelTab = 'elements';
    state.multiSelect = false;
  });
}

function focusElementEditor(element) {
  if (!element) return;
  const ids = {
    text: 'element-text',
    barcode: 'barcode-value',
    qrcode: 'qr-value',
    date: 'date-fixed',
    serial: 'serial-prefix',
    material: 'material-symbol'
  };
  const node = document.getElementById(ids[element.type])
    || document.querySelector('.niim-content-line')
    || (element.type === 'table' ? document.querySelector('.table-cell-editor input') : null)
    || document.querySelector('.editor-panel-body input, .editor-panel-body select, .editor-panel-body textarea, .editor-panel-body button');
  if (!node) return;
  try {
    node.focus({ preventScroll: false });
  } catch (_) {
    try { node.focus(); } catch (__) { /* ignore */ }
  }
  // Android WebView / Capacitor often needs click() to raise the system keyboard
  try { node.click(); } catch (_) { /* ignore */ }
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
    if (typeof node.value === 'string' && node.setSelectionRange) {
      const len = node.value.length;
      try { node.setSelectionRange(len, len); } catch (_) { /* ignore */ }
    } else if (typeof node.select === 'function') {
      try { node.select(); } catch (_) { /* ignore */ }
    }
  }
}

async function handleAction(action, target) {
  switch (action) {
    case 'navigate': handleNavigation(target.dataset.route); break;
    case 'create-label': createBlankLabel(); break;
    case 'open-template':
      // All catalog entry points go through preview first.
      previewTemplate(target.dataset.id);
      break;
    case 'preview-template': previewTemplate(target.dataset.id); break;
    case 'use-template': useTemplate(target.dataset.id); break;
    case 'history-open':
      openHistoryDocument(findHistoryItem(target.dataset.id), false);
      break;
    case 'history-reprint':
      openHistoryDocument(findHistoryItem(target.dataset.id), true);
      break;
    case 'open-industry':
      state.route = 'templates';
      state.templateIndustry = '行业标识';
      state.templateCategory = '全部';
      state.modal = '';
      render();
      break;
    case 'scan-placeholder':
      toast('扫一扫将在接入相机能力后启用；可先用模板库中的二维码模板');
      break;
    case 'open-project': openProject(target.dataset.id); break;
    case 'template-category':
      state.templateCategory = target.dataset.category;
      render();
      break;
    case 'template-industry':
      state.templateIndustry = target.dataset.industry || '全部';
      render();
      break;
    case 'save-project': saveProject(); break;
    case 'save-as-template':
      state.editorMenu = false;
      saveAsTemplate();
      break;
    case 'close-editor': closeEditor(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'clear-elements':
      state.editorMenu = false;
      clearElements();
      break;
    case 'confirm-clear-elements':
      state.editorMenu = false;
      if (window.confirm('确定清空画布？此操作可撤销。')) {
        clearElements();
      }
      break;
    case 'focus-placeholder': {
      const id = target.dataset.id;
      state.modal = null;
      const el = (state.document && state.document.elements || []).find((item) => item.id === id);
      if (el) {
        enterContentMode(el);
      } else {
        render();
      }
      break;
    }
    case 'rotate-document':
      state.editorMenu = false;
      rotateDocument();
      break;
    case 'toggle-multi-select':
      state.editorMenu = false;
      state.multiSelect = !state.multiSelect;
      if (!state.multiSelect && state.selectedIds.length > 1) {
        enterSelectedMode([state.selectedId], { reason: 'select' });
      } else if (state.multiSelect && state.selectedIds.length) {
        enterSelectedMode(state.selectedIds, { tab: 'arrange', reason: 'select' });
      } else {
        refreshEditorChrome();
      }
      toast(state.multiSelect ? '多选已开启' : '已退出多选');
      break;
    case 'toggle-canvas-expand':
      state.canvasExpanded = !state.canvasExpanded;
      render();
      break;
    case 'toggle-property-panel':
      state.panelCollapsed = !state.panelCollapsed;
      state.editorMenu = false;
      refreshEditorChrome();
      break;
    case 'add-linked-date': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      commit(() => {
        const selected = selectedElement(state);
        const element = dateControlElement(selected);
        if (!element || element.locked) return;
        element.linkedExpire = true;
        if (!element.expirePresetHours) element.expirePresetHours = 24;
        element.expireMode = element.expireMode || 'preset';
        // companion canvas element for 保质期至
        const exists = state.document.elements.some((e) => e.type === 'date' && e.linkedFrom === element.id);
        if (!exists) {
          const linked = createElement('date', state.document);
          linked.linkedFrom = element.id;
          linked.x = element.x;
          linked.y = Math.min(state.document.heightMm - element.height - 0.5, element.y + element.height + 0.8);
          linked.width = element.width;
          linked.height = element.height;
          linked.fontSize = element.fontSize;
          placeNewElement(linked, state.document, { preferred: { x: linked.x, y: linked.y } });
          state.document.elements.push(linked);
        }
      });
      break;
    }
    case 'remove-linked-date': {
      const el = selectedElement(state);
      if (!el || el.type !== 'date') break;
      commit(() => {
        const element = selectedElement(state);
        if (!element) return;
        unlinkDate(state.document, element);
      });
      break;
    }
    case 'clear-text-style': {
      const el = selectedElement(state);
      if (!el || el.locked) break;
      softCommit(() => {
        const target = selectedElement(state);
        if (!target) return;
        resetTextStyle(target);
      }, { refreshChrome: true });
      break;
    }
    case 'set-editor-panel-tab': {
      state.editorMenu = false;
      const nextTab = target.dataset.tab || 'elements';
      state.panelCollapsed = false;
      if (['elements', 'templates', 'data-source', 'label'].includes(nextTab)) {
        enterAddMode({ render: document.querySelector('.niim-panel') ? undefined : 'full' });
        if (nextTab !== 'elements') {
          state.editorPanelTab = nextTab;
          refreshEditorChrome({ animateBody: true });
        }
        break;
      }
      const el = selectedElement(state);
      if (state.editorMode === 'content' && nextTab !== 'content') finalizeContentUndo();
      if (nextTab === 'content' && el && el.locked) {
        state.editorPanelTab = preferredPanelTabForElement(el, 'select');
        state.editorMode = 'selected';
        refreshEditorChrome({ animateBody: true });
        break;
      }
      state.editorPanelTab = nextTab;
      // Keyboard content mode ONLY for text/barcode/qrcode on 内容 tab
      if (nextTab === 'content' && el && isKeyboardContentType(el.type)) {
        state.editorMode = 'content';
        if (!contentUndoBefore) contentUndoBefore = cloneDocument(state.document);
      } else {
        state.editorMode = 'selected';
      }
      refreshEditorChrome({ animateBody: true });
      if (nextTab === 'content' && el && isKeyboardContentType(el.type)) {
        const focus = () => focusElementEditor(el);
        focus();
        requestAnimationFrame(() => {
          focus();
          setTimeout(focus, 50);
        });
      }
      break;
    }
    case 'open-layers':
      state.editorMenu = false;
      state.editorPanelTab = 'layers';
      state.panelCollapsed = false;
      render();
      break;
    case 'content-done':
      // 完成 → Mode B selected + style (keep selection)
      finalizeContentUndo();
      if (selectedElement(state)) {
        enterSelectedMode([selectedElement(state).id], { tab: 'style', reason: 'select' });
      } else {
        enterAddMode();
      }
      break;
    case 'clear-content': {
      const el = selectedElement(state);
      if (!el || el.locked) break;
      if (!contentUndoBefore) contentUndoBefore = cloneDocument(state.document);
      softUpdate(() => {
        // Keep the placeholder out of persisted content; the renderer paints it for empty text.
        if (el.type === 'text') el.text = '';
        else if (el.type === 'barcode' || el.type === 'qrcode') el.value = '';
      }, { autosave: true });
      const input = document.querySelector('.niim-content-line');
      if (input) input.value = '';
      const clearBtn = document.querySelector('.niim-content-clear');
      if (clearBtn) clearBtn.remove();
      requestAnimationFrame(() => focusElementEditor(selectedElement(state)));
      break;
    }
    case 'set-date-label': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        const label = target.value || '制作日期';
        element.label = label;
        if (label === '保质期至') {
          element.dateRole = 'expire';
          if (!element.expirePresetHours) element.expirePresetHours = 24;
        } else if (label === '制作日期' || label === '生产日期' || label === '打印时间' || label === '上架日期' || label === '开封时间') {
          element.dateRole = 'made';
        } else {
          element.dateRole = 'generic'; // 无前缀 / 自定义
        }
      });
      break;
    }
    case 'set-date-base': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      const raw = target.value;
      if (!raw) break;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
          element.baseTime = d.toISOString();
          element.autoUpdate = false;
        }
      });
      break;
    }
    case 'nudge-date-offset': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      const delta = Number(target.dataset.delta) || 0;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        element.offsetDays = Math.max(-3650, Math.min(3650, (Number(element.offsetDays) || 0) + delta));
      });
      break;
    }
    case 'set-expire-mode': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        element.expireMode = target.dataset.value === 'custom' ? 'custom' : 'preset';
        if (element.label === '制作日期') {
          // switching to expire presets often means 保质期
        }
      });
      break;
    }
    case 'set-expire-preset': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      const hours = Number(target.dataset.hours) || 24;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        element.expireMode = 'preset';
        element.expirePresetHours = hours;
        if (!element.linkedExpire) {
          element.dateRole = 'expire';
          if (!element.label || element.label === '制作日期') element.label = '保质期至';
        }
      });
      break;
    }
    case 'nudge-expire-hours': {
      const el = selectedElement(state);
      if (!el || el.locked || el.type !== 'date') break;
      const delta = Number(target.dataset.delta) || 0;
      commit(() => {
        const element = dateControlElement(selectedElement(state));
        element.expireMode = 'custom';
        element.expirePresetHours = Math.max(1, Math.min(8760, (Number(element.expirePresetHours) || 24) + delta));
        element.dateRole = 'expire';
      });
      break;
    }
    case 'set-color':
      if (selectedElement(state) && !selectedElement(state).locked) {
        softCommit(() => {
          const element = selectedElement(state);
          element.color = target.dataset.value || '#000000';
          if (target.dataset.reverse != null && ['text', 'date', 'serial'].includes(element.type)) {
            element.reverse = target.dataset.reverse === '1';
          }
        }, { patchActive: true });
      }
      break;
    case 'set-font':
      if (selectedElement(state) && !selectedElement(state).locked) {
        softCommit(() => { selectedElement(state).fontFamily = target.dataset.value || 'sans-serif'; }, { refreshChrome: true });
      }
      break;
    case 'nudge-letter': {
      const delta = Number(target.dataset.delta) || 0;
      softCommit(() => {
        const element = selectedElement(state);
        if (!element || element.locked) return;
        const next = Math.max(-2, Math.min(10, (Number(element.letterSpacing) || 0) + delta));
        element.letterSpacing = Math.round(next * 10) / 10;
      }, { patchActive: true });
      break;
    }
    case 'nudge-line': {
      const delta = Number(target.dataset.delta) || 0;
      softCommit(() => {
        const element = selectedElement(state);
        if (!element || element.locked) return;
        const next = Math.max(-1, Math.min(5, (Number(element.lineSpacing) || 0) + delta));
        element.lineSpacing = Math.round(next * 100) / 100;
      }, { patchActive: true });
      break;
    }
    case 'gap-selection':
      spaceSelection(Number(target.dataset.delta) || 0, target.dataset.axis);
      break;
    case 'edit-label-settings':
      state.editorMenu = false;
      openStockSheet();
      break;
    case 'open-stock-sheet':
      state.editorMenu = false;
      openStockSheet();
      break;
    case 'pick-stock-preset':
      state.stockWidthMm = Number(target.dataset.width) || 50;
      state.stockHeightMm = Number(target.dataset.height) || 30;
      renderModalOnly();
      break;
    case 'apply-stock':
      applyStock();
      break;
    case 'open-batch-sheet':
      openBatchSheet();
      break;
    case 'run-batch':
      runBatch();
      break;
    case 'batch-select-all':
      state.batchSelectedRows = state.dataRows.map((_, index) => index);
      renderModalOnly();
      break;
    case 'batch-select-none':
      state.batchSelectedRows = [];
      renderModalOnly();
      break;
    case 'manage-user-template':
      state.manageTemplateId = target.dataset.id || '';
      state.modal = 'manage-template';
      renderModalOnly();
      break;
    case 'rename-user-template':
      renameUserTemplate(target.dataset.id);
      break;
    case 'delete-user-template':
      deleteUserTemplate(target.dataset.id);
      break;
    case 'select-element':
      if (target.dataset.id) {
        if (state.multiSelect) {
          const ids = state.selectedIds.includes(target.dataset.id)
            ? state.selectedIds.filter((id) => id !== target.dataset.id)
            : [...state.selectedIds, target.dataset.id];
          if (ids.length) enterSelectedMode(ids, { reason: 'select', tab: ids.length > 1 ? 'arrange' : undefined });
          else enterAddMode();
        } else {
          enterSelectedMode([target.dataset.id], { reason: 'select' });
        }
      }
      break;
    case 'edit-element': {
      const el = selectedElement(state);
      if (!el) break;
      if (el.locked) {
        enterSelectedMode([el.id], { tab: preferredPanelTabForElement(el, 'select'), reason: 'select' });
        break;
      }
      if (['text', 'date', 'serial', 'barcode', 'qrcode', 'table'].includes(el.type)) {
        enterContentMode(el);
      } else {
        enterSelectedMode([el.id], { tab: 'style', reason: 'select' });
      }
      break;
    }
    case 'open-element-menu':
      enterAddMode();
      break;
    case 'editor-more':
      state.editorMenu = state.editorMenu === 'settings' ? false : 'settings';
      render();
      break;
    case 'editor-clear-menu':
      state.editorMenu = state.editorMenu === 'clear' ? false : 'clear';
      render();
      break;
    case 'select-all-elements':
      state.editorMenu = false;
      state.multiSelect = true;
      enterSelectedMode(state.document.elements.map((item) => item.id), { tab: 'arrange', reason: 'select' });
      break;
    case 'select-element-type':
      state.editorMenu = false;
      state.multiSelect = true;
      enterSelectedMode(
        state.document.elements.filter((item) => item.type === target.dataset.type).map((item) => item.id),
        { tab: 'arrange', reason: 'select' }
      );
      break;
    case 'set-element-page': {
      const pages = document.querySelector('[data-role="element-pages"]');
      const page = Math.max(0, Number(target.dataset.page) || 0);
      if (pages) pages.scrollTo({ left: pages.clientWidth * page, behavior: 'smooth' });
      document.querySelectorAll('.element-page-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === page);
        if (index === page) dot.setAttribute('aria-selected', 'true');
        else dot.removeAttribute('aria-selected');
      });
      break;
    }
    case 'open-align-menu':
      if (selectedElements(state).length) {
        state.editorPanelTab = 'arrange';
        state.editorMode = 'selected';
        state.panelCollapsed = false;
        refreshEditorChrome();
      }
      break;
    case 'nudge-element':
      nudgeSelection(Number(target.dataset.x) || 0, Number(target.dataset.y) || 0);
      break;
    case 'add-element':
      if ((target.dataset.type || '') === 'material') {
        state.pendingMaterialAdd = true;
        state.modal = 'material';
        renderModalOnly();
        break;
      }
      commit((documentValue) => {
        const type = target.dataset.type || 'text';
        const element = createElement(type === 'scan' ? 'barcode' : type, documentValue);
        if (target.dataset.variant === 'advanced') element.advanced = true;
        if (target.dataset.variant === 'border') {
          element.shapeKind = 'rect';
          element.filled = false;
        }
        if (target.dataset.variant === 'shape') {
          element.shapeKind = 'rounded';
        }
        placeNewElement(element, documentValue);
        documentValue.elements.push(element);
        const ids = state.multiSelect ? [...state.selectedIds, element.id] : [element.id];
        state.selectedIds = ids;
        state.selectedId = element.id;
        const tab = preferredPanelTabForElement(element, 'add');
        state.editorPanelTab = tab;
        state.editorMode = tab === 'content' ? 'content' : 'selected';
        state.panelCollapsed = false;
        if (state.editorMode === 'content') contentUndoBefore = cloneDocument(documentValue);
      });
      if (state.editorMode === 'content') {
        requestAnimationFrame(() => focusElementEditor(selectedElement(state)));
      }
      break;
    case 'enable-multi-select':
      state.multiSelect = true;
      state.editorMenu = false;
      toast('多选已开启，继续点选元素');
      break;
        case 'open-border-sheet':
      state.pendingBorderAdd = !(selectedElement(state) && selectedElement(state).type === 'rect' && selectedElement(state).borderStyle);
      state.modal = 'border';
      renderModalOnly();
      break;
    case 'border-chip': {
      const chip = target.dataset.chip || '最新';
      if (chip === '搜索') {
        state.borderSearchOpen = !state.borderSearchOpen;
        if (state.borderSearchOpen) state.borderChip = '搜索';
        else if (state.borderChip === '搜索') state.borderChip = '最新';
      } else {
        state.borderChip = chip;
        state.borderSearchOpen = false;
      }
      if (state.modal === 'border') renderModalOnly();
      else refreshEditorChrome();
      paintBorderThumbs();
      break;
    }
    case 'pick-border': {
      const borderId = target.dataset.border || 'simple';
      const selected = selectedElement(state);
      if (selected && selected.type === 'rect' && selected.borderStyle && !state.pendingBorderAdd) {
        commit(() => {
          const el = selectedElement(state);
          if (el && el.type === 'rect' && !el.locked) {
            el.borderStyle = borderId;
            el.filled = false;
            el.shapeKind = 'rect';
          }
        });
        state.modal = '';
        state.pendingBorderAdd = false;
        state.editorPanelTab = 'style';
        state.editorMode = 'selected';
        state.panelCollapsed = false;
        render();
      } else {
        commit((documentValue) => {
          const element = createElement('rect', documentValue);
          element.borderStyle = borderId;
          element.filled = false;
          element.shapeKind = 'rect';
          placeNewElement(element, documentValue);
          documentValue.elements.push(element);
          state.selectedIds = state.multiSelect ? [...state.selectedIds, element.id] : [element.id];
          state.selectedId = element.id;
          state.editorPanelTab = 'style';
          state.editorMode = 'selected';
          state.panelCollapsed = false;
        });
        state.modal = '';
        state.pendingBorderAdd = false;
        render();
      }
      break;
    }
    case 'nudge-table': {
      const field = target.dataset.field || 'rows';
      const delta = Number(target.dataset.delta) || 0;
      commit(() => {
        const el = selectedElement(state);
        if (!el || el.locked || el.type !== 'table') return;
        if (field === 'rows') {
          el.rows = Math.max(1, Math.min(20, (Number(el.rows) || 3) + delta));
        } else if (field === 'columns') {
          el.columns = Math.max(1, Math.min(12, (Number(el.columns) || 2) + delta));
        }
        const cellCount = el.rows * el.columns;
        el.cells = Array.from({ length: cellCount }, (_, index) => (el.cells || [])[index] || '');
        const rowH = Number(el.rowH) || (el.height / Math.max(1, el.rows));
        const colW = Number(el.colW) || (el.width / Math.max(1, el.columns));
        el.rowH = rowH;
        el.colW = colW;
        el.height = rowH * el.rows;
        el.width = colW * el.columns;
      });
      break;
    }
    case 'set-table-dim': {
      const field = target.dataset.field || 'rowH';
      const value = Number(target.value);
      if (!Number.isFinite(value)) break;
      softCommit(() => {
        const el = selectedElement(state);
        if (!el || el.locked || el.type !== 'table') return;
        if (field === 'rowH') {
          el.rowH = Math.max(2, Math.min(20, value));
          el.height = el.rowH * Math.max(1, Number(el.rows) || 1);
        } else if (field === 'colW') {
          el.colW = Math.max(4, Math.min(40, value));
          el.width = el.colW * Math.max(1, Number(el.columns) || 1);
        }
      }, { refreshChrome: true });
      break;
    }
    case 'set-table-color': {
      const field = target.dataset.field || 'textColor';
      softCommit(() => {
        const el = selectedElement(state);
        if (!el || el.locked || el.type !== 'table') return;
        el[field] = target.dataset.value || '#000000';
        if (field === 'textColor') el.color = el.textColor;
      }, { patchActive: true });
      break;
    }
case 'open-material-sheet':
      state.pendingMaterialAdd = !(selectedElement(state) && selectedElement(state).type === 'material');
      state.modal = 'material';
      renderModalOnly();
      break;
    case 'material-chip': {
      const chip = target.dataset.chip || '热门';
      if (chip === '搜索') {
        state.materialSearchOpen = !state.materialSearchOpen;
        if (state.materialSearchOpen) state.materialChip = '搜索';
        else if (state.materialChip === '搜索') state.materialChip = '热门';
      } else {
        state.materialChip = chip;
        state.materialSearchOpen = false;
      }
      if (state.modal === 'material') renderModalOnly();
      else refreshEditorChrome();
      paintMaterialThumbs();
      break;
    }
    case 'editor-tpl-size':
      state.editorTplSize = target.value || '全部尺寸';
      refreshEditorChrome();
      break;
    case 'editor-tpl-industry':
      state.editorTplIndustry = target.value || '全部';
      refreshEditorChrome();
      break;
    case 'pick-material': {
      const symbol = target.dataset.symbol || 'check';
      const selected = selectedElement(state);
      if (selected && selected.type === 'material' && !state.pendingMaterialAdd) {
        commit(() => {
          const el = selectedElement(state);
          if (el && el.type === 'material' && !el.locked) el.symbol = symbol;
        });
        state.modal = '';
        state.pendingMaterialAdd = false;
        state.editorPanelTab = 'content';
        state.editorMode = 'selected';
        state.panelCollapsed = false;
        render();
      } else {
        commit((documentValue) => {
          const element = createElement('material', documentValue);
          element.symbol = symbol;
          placeNewElement(element, documentValue);
          documentValue.elements.push(element);
          state.selectedIds = state.multiSelect ? [...state.selectedIds, element.id] : [element.id];
          state.selectedId = element.id;
          state.editorPanelTab = preferredPanelTabForElement(element, 'add');
          state.editorMode = 'selected';
          state.panelCollapsed = false;
        });
        state.modal = '';
        state.pendingMaterialAdd = false;
        render();
      }
      break;
    }
    case 'open-advanced-qr':
      state.modal = 'advanced-qr';
      renderModalOnly();
      break;
    case 'scan-code':
      // Video opens camera scanner; stub with toast + focus content
      toast('请将相机对准条码或二维码（模拟器可用内容栏手动输入）');
      if (selectedElement(state) && ['barcode', 'qrcode'].includes(selectedElement(state).type)) {
        state.editorPanelTab = 'content';
        state.panelCollapsed = false;
        render();
        requestAnimationFrame(() => focusElementEditor(selectedElement(state)));
      }
      break;
    case 'toast-feature':
      toast(target.dataset.msg || '该功能后续接入');
      break;
    case 'dual-color-tip':
      toast('仅限双色/彩色标签纸使用该功能，实际打印的颜色和标签纸有关。');
      break;
    case 'set-shape-kind':
      if (selectedElement(state) && !selectedElement(state).locked) {
        commit(() => {
          const el = selectedElement(state);
          el.shapeKind = target.dataset.value || 'rect';
          if (el.shapeKind === 'line') {
            el.type = 'line';
            el.height = Math.min(el.height, 2);
          } else {
            el.type = 'rect';
            if (el.height < 3) el.height = 8;
          }
        });
      }
      break;
    case 'set-dashed':
      if (selectedElement(state) && !selectedElement(state).locked) {
        commit(() => { selectedElement(state).dashed = target.dataset.value === '1'; });
      }
      break;
    case 'nudge-line-width': {
      const delta = Number(target.dataset.delta) || 0;
      commit(() => {
        const el = selectedElement(state);
        if (!el || el.locked) return;
        el.lineWidth = Math.max(0.1, Math.min(4, Math.round(((Number(el.lineWidth) || 0.4) + delta) * 10) / 10));
      });
      break;
    }
    case 'nudge-serial': {
      const field = target.dataset.field || 'step';
      const delta = Number(target.dataset.delta) || 0;
      commit(() => {
        const el = selectedElement(state);
        if (!el || el.locked || el.type !== 'serial') return;
        if (field === "digits") {
          el.digits = Math.max(1, Math.min(12, (Number(el.digits) || 1) + delta));
        } else {
          const next = Math.max(1, (Number(el[field]) || 1) + delta);
          el[field] = next;
        }
      });
      break;
    }
    case 'add-image': await addImage(false); break;
    case 'add-photo': await addImage(false, true); break;
    case 'replace-image': await addImage(true); break;
    case 'delete-element':
    case 'delete-selected': {
      const deletableIds = new Set(selectedItems().filter((item) => !item.locked).map((item) => item.id));
      if (!deletableIds.size) {
        toast('请先解锁元素', 'error');
        break;
      }
      commit((documentValue) => {
        documentValue.elements = documentValue.elements.filter((item) => {
          if (deletableIds.has(item.id)) {
            delete state.images[item.id];
            return false;
          }
          return true;
        });
        const remain = documentValue.elements.filter((item) => item.locked && state.selectedIds.includes(item.id)).map((item) => item.id);
        state.selectedIds = remain;
        state.selectedId = remain[remain.length - 1] || '';
        if (!remain.length) {
          state.editorMode = 'add';
          state.editorPanelTab = 'elements';
          state.multiSelect = false;
        } else {
          state.editorMode = 'selected';
          state.editorPanelTab = remain.length > 1 ? 'arrange' : 'style';
        }
      });
      break;
    }
    case 'duplicate-element': {
      const sources = selectedItems();
      if (!sources.length) break;
      commit((documentValue) => {
        const nextIds = [];
        sources.forEach((source, sourceIndex) => {
          const copy = cloneDocument(source);
          copy.id = `${source.type}-${Date.now().toString(36)}-${sourceIndex}`;
          copy.x = Math.min(documentValue.widthMm - copy.width, copy.x + 1);
          copy.y = Math.min(documentValue.heightMm - copy.height, copy.y + 1);
          copy.locked = false;
          documentValue.elements.push(copy);
          if (state.images[source.id]) state.images[copy.id] = state.images[source.id];
          nextIds.push(copy.id);
        });
        setSelection(nextIds);
      });
      break;
    }
    case 'bring-forward':
      handleAction('move-layer', { dataset: { delta: '1' } });
      break;
    case 'send-backward':
      handleAction('move-layer', { dataset: { delta: '-1' } });
      break;
    case 'move-layer': {
      const element = selectedElement(state);
      if (!element) break;
      if (element.locked) {
        toast('请先解锁元素', 'error');
        break;
      }
      commit((documentValue) => {
        const index = documentValue.elements.findIndex((item) => item.id === element.id);
        const destination = Math.max(0, Math.min(documentValue.elements.length - 1, index + Number(target.dataset.delta || target.dataset.value || 0)));
        if (destination !== index) {
          const item = documentValue.elements.splice(index, 1)[0];
          documentValue.elements.splice(destination, 0, item);
        }
      });
      break;
    }
    case 'rotate-element':
      if (selectedItems().length) commitSelected((element) => { element.rotation = (Number(element.rotation) + 90) % 360; });
      break;
    case 'rotate-by':
      if (selectedElement(state)) commitSelected((element) => { element.rotation = (Number(element.rotation) + Number(target.dataset.value || 0) + 360) % 360; });
      break;
    case 'reset-image-transform':
      if (selectedElement(state)) commitSelected((element) => { element.rotation = 0; element.mirrorX = false; element.mirrorY = false; });
      break;
    case 'toggle-lock': {
      const items = selectedItems();
      if (items.length) {
        const shouldLock = !items.every((item) => item.locked);
        softCommit(() => {
          selectedItems().forEach((element) => { element.locked = shouldLock; });
        }, { refreshChrome: true });
      }
      break;
    }
    case 'mirror-element':
      if (selectedItems().length) commitSelected((element) => {
        const axis = target.dataset.axis || target.dataset.value || 'x';
        if (axis === 'y') element.mirrorY = !element.mirrorY;
        else element.mirrorX = !element.mirrorX;
      });
      break;
    case 'align-selection': alignSelection(target.dataset.value); break;
    case 'distribute-selection': distributeSelection(target.dataset.value); break;
    case 'space-selection':
      spaceSelection(Number(target.dataset.delta) || 0, null);
      break;
    case 'zoom':
      state.zoom = Math.max(40, Math.min(140, state.zoom + Number(target.dataset.delta)));
      render();
      break;
    case 'set-align':
      if (selectedElement(state) && !selectedElement(state).locked) {
        softCommit(() => { selectedElement(state).align = target.dataset.value; }, { patchActive: true });
      }
      break;
    case 'set-vertical-align':
      if (selectedElement(state) && !selectedElement(state).locked) {
        softCommit(() => { selectedElement(state).verticalAlign = target.dataset.value; }, { patchActive: true });
      }
      break;
    case 'set-text-direction':
      if (selectedElement(state)) {
        softCommit((documentValue) => {
          const element = selectedElement(state);
          if (element && !element.locked) changeTextDirection(element, target.dataset.value, documentValue);
        }, { refreshChrome: true });
      }
      break;
    case 'toggle-element': {
      const field = target.dataset.field;
      if (!field) break;
      softCommit(() => {
        const selected = selectedElement(state);
        const element = selected && selected.type === 'date' && ['autoUpdate', 'showTime', 'showSeconds'].includes(field)
          ? dateControlElement(selected)
          : selected;
        if (!element || element.locked) return;
        if (typeof target.checked === 'boolean' && target.type === 'checkbox') {
          element[field] = target.checked;
        } else {
          element[field] = !element[field];
        }
      }, { patchActive: true });
      break;
    }
    case 'nudge-font': {
      const delta = Number(target.dataset.delta) || 0;
      softCommit(() => {
        const element = selectedElement(state);
        if (!element || element.locked) return;
        const next = Math.max(0.8, Math.min(40, (Number(element.fontSize) || 4) + delta));
        element.fontSize = Math.round(next * 10) / 10;
      }, { patchActive: true });
      break;
    }
    case 'set-barcode-text':
      if (selectedElement(state) && !selectedElement(state).locked) {
        softCommit(() => {
          const element = selectedElement(state);
          if (!element || element.type !== 'barcode') return;
          element.textPosition = target.dataset.value;
          element.showText = target.dataset.value !== 'none';
        }, { refreshChrome: true });
      }
      break;
    case 'open-print': openPrint(); break;
    case 'start-print': await startPrint(); break;
    case 'change-copies':
      state.settings.copies = Math.max(1, Math.min(99, state.settings.copies + Number(target.dataset.delta)));
      persistSettings(state);
      renderModalOnly();
      break;
    case 'open-devices': await openDevices(); break;
    case 'scan-devices': await scanDevices(); break;
    case 'connect-device': await connectDevice(target.dataset.id); break;
    case 'disconnect-device': await disconnectDevice(); break;
    case 'cancel-print': await cancelPrint(); break;
    case 'apply-suggested-profile': {
      const id = target.dataset.id;
      if (!id) break;
      state.settings.defaultProfileId = id;
      persistSettings(state);
      state.printBlock = evaluatePrintBlock();
      renderModalOnly();
      toast(`已切换到 ${getProfile(id).name}`);
      break;
    }
    case 'retry-print':
      state.printError = null;
      await startPrint();
      break;
    case 'close-modal': await closeModal(); break;
    case 'reset-template-filters':
      state.templateQuery = '';
      state.templateCategory = '全部';
      state.templateIndustry = '全部';
      render();
      break;
    case 'import-project': await importProject(); break;
    case 'add-data-row':
      state.dataRows.push({ name: '', code: '', price: '', date: new Date().toISOString().slice(0, 10) });
      persistRows(state);
      render();
      break;
    case 'remove-data-row':
      state.dataRows.splice(Number(target.dataset.row), 1);
      persistRows(state);
      render();
      break;
    case 'import-csv': await importCsv(); break;
    case 'export-csv': exportCsv(); break;
    case 'batch-create': batchCreate(); break;
    case 'backup-data': backupData(); break;
    case 'toggle-cloud':
      state.settings.cloudSync = !state.settings.cloudSync;
      persistSettings(state);
      render();
      break;
    case 'account-login': state.modal = 'login'; renderModalOnly(); break;
    case 'open-about': state.modal = 'about'; renderModalOnly(); break;
    case 'help': state.modal = 'help'; renderModalOnly(); break;
    case 'default-print-settings': state.modal = 'cloud'; renderModalOnly(); break;
    case 'editor-settings':
      state.settings.units = state.settings.units === 'mm' ? 'in' : 'mm';
      persistSettings(state);
      render();
      break;
    case 'print-history':
      state.printHistory = readPrintHistory();
      state.modal = 'print-history';
      renderModalOnly();
      break;
    case 'notification-settings': toast('通知设置由 Android 系统管理'); break;
    case 'import-template': await importProject(); break;
    case 'all-projects': state.route = 'home'; render(); break;
    default: break;
  }
}

function handleField(action, target) {
  if (action === 'editor-tpl-size') {
    state.editorTplSize = target.value || '全部尺寸';
    refreshEditorChrome();
    return;
  }
  if (action === 'editor-tpl-industry') {
    state.editorTplIndustry = target.value || '全部';
    refreshEditorChrome();
    return;
  }
  if (action === 'border-search') {
    state.borderQuery = target.value;
    const cursor = target.selectionStart;
    if (state.modal === 'border') renderModalOnly();
    else refreshEditorChrome();
    paintBorderThumbs();
    return;
  }
  if (action === 'material-search') {
    state.materialQuery = target.value;
    const cursor = target.selectionStart;
    if (state.modal === 'material') renderModalOnly();
    else refreshEditorChrome();
    const next = document.querySelector('[data-action="material-search"]');
    if (next) {
      next.focus();
      try { next.setSelectionRange(cursor, cursor); } catch (_) {}
    }
    paintMaterialThumbs();
    return;
  }
  if (action === 'editor-tpl-search') {
    state.editorTplQuery = target.value;
    const cursor = target.selectionStart;
    refreshEditorChrome();
    const next = document.querySelector('[data-action="editor-tpl-search"]');
    if (next) {
      next.focus();
      try { next.setSelectionRange(cursor, cursor); } catch (_) {}
    }
    return;
  }
  if (action === 'template-search') {
    state.templateQuery = target.value;
    const cursor = target.selectionStart;
    render();
    const next = document.querySelector('[data-action="template-search"]');
    if (next) {
      next.focus();
      next.setSelectionRange(cursor, cursor);
    }
    return;
  }
  if (action === 'template-category') {
    state.templateCategory = target.dataset.category;
    render();
    return;
  }
    if (action === 'set-table-dim') {
    handleAction(action, target);
    return;
  }
  if (action === 'update-element') {
    const field = target.dataset.field;
    const numeric = [
      'x', 'y', 'width', 'height', 'rotation', 'fontSize', 'lineWidth', 'threshold',
      'start', 'step', 'digits', 'rows', 'columns', 'rowH', 'colW', 'lineSpacing', 'letterSpacing', 'document-width', 'document-height'
    ];
    const value = numeric.includes(field) ? Number(target.value) : target.value;
    if (numeric.includes(field) && !Number.isFinite(value)) return;
    // Live fields: paint canvas only, keep input focused (video: no flash while typing / sliding)
    const softFields = new Set(['text', 'value', 'fixedValue', 'prefix', 'suffix', 'fontSize', 'rotation']);
    if (softFields.has(field) && state.route === 'editor') {
      const element = selectedElement(state);
      if (!element || element.locked) return;
      if (!contentUndoBefore && ['text', 'value', 'fixedValue', 'prefix', 'suffix'].includes(field)) {
        contentUndoBefore = cloneDocument(state.document);
      }
      softUpdate(() => {
        element[field] = value;
      }, {
        autosave: field === 'fontSize',
        syncClear: field === 'text' || field === 'value',
        patchReadout: field === 'fontSize'
          ? () => {
            const readout = document.querySelector('.niim-size-readout');
            if (readout) readout.textContent = Number(value).toFixed(1);
            const slider = document.querySelector('.niim-size-slider');
            if (slider) slider.value = String(value);
          }
          : null
      });
      return;
    }
    commit((documentValue) => {
      if (field === 'document-width' || field === 'document-height') {
        if (value <= 0) throw new Error('标签宽高必须大于 0 mm');
        if (field === 'document-width') documentValue.widthMm = value;
        else documentValue.heightMm = value;
        documentValue.elements.forEach((element) => clampElement(element, documentValue));
        return;
      }
      const element = selectedElement(state);
      if (!element) return;
      if (element.locked) return;
      if (field === 'rows' || field === 'columns') {
        element[field] = Math.max(1, Math.min(field === 'rows' ? 20 : 12, Math.round(value)));
        const cellCount = element.rows * element.columns;
        element.cells = Array.from({ length: cellCount }, (_, index) => (element.cells || [])[index] || '');
        const rowH = Number(element.rowH) || (element.height / Math.max(1, element.rows));
        const colW = Number(element.colW) || (element.width / Math.max(1, element.columns));
        element.rowH = rowH;
        element.colW = colW;
        element.height = rowH * element.rows;
        element.width = colW * element.columns;
      } else if (field === 'rowH') {
        element.rowH = Math.max(2, Math.min(20, value));
        element.height = element.rowH * Math.max(1, Number(element.rows) || 1);
      } else if (field === 'colW') {
        element.colW = Math.max(4, Math.min(40, value));
        element.width = element.colW * Math.max(1, Number(element.columns) || 1);
      } else if (field === 'digits') {
        element[field] = Math.max(1, Math.min(12, Math.round(value)));
      } else {
        element[field] = value;
      }
    });
    return;
  }
  if (action === 'update-table-cell') {
    const index = Number(target.dataset.index);
    commit(() => {
      const element = selectedElement(state);
      if (element && !element.locked && element.type === 'table' && Number.isInteger(index) && index >= 0) {
        element.cells[index] = target.value;
      }
    });
    return;
  }
  if (action === 'toggle-element') {
    commit(() => {
      const element = selectedElement(state);
      if (!element || element.locked) return;
      if (typeof target.checked === 'boolean') element[target.dataset.field] = target.checked;
      else element[target.dataset.field] = !element[target.dataset.field];
    });
    return;
  }
  if (action === 'update-barcode-format') {
    commit(() => {
      const element = selectedElement(state);
      if (element && !element.locked && element.type === 'barcode') {
        element.format = target.value;
      }
    });
    return;
  }
  if (action === 'update-document') {
    commit((documentValue) => { documentValue[target.dataset.field] = target.value.trim() || '未命名标签'; });
    return;
  }
  if (action === 'update-setting') {
    const field = target.dataset.field;
    state.settings[field] = ['density', 'threshold', 'copies', 'labelType'].includes(field)
      ? Number(target.value)
      : target.value;
    persistSettings(state);
    // Switching the model is the main escape hatch from a blocked print —
    // re-check immediately so the warning bar clears itself.
    if (field === 'defaultProfileId' && state.modal === 'print') {
      state.printBlock = evaluatePrintBlock();
    }
    if (field === 'defaultProfileId' && state.route === 'editor') {
      render();
      return;
    }
    if (state.modal === 'print' && ['density', 'threshold', 'defaultProfileId', 'labelType'].includes(field)) {
      renderModalOnly();
    }
    return;
  }
  if (action === 'stock-field') {
    const field = target.dataset.field;
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    state[field] = value;
    return;
  }
  if (action === 'rename-template-field') {
    // live value stays in the input until save
    return;
  }
  if (action === 'update-data-cell') {
    const row = state.dataRows[Number(target.dataset.row)];
    if (row) row[target.dataset.field] = target.value;
    scheduleRowSave();
  }
}

let rowSaveTimer = null;

/**
 * Batch rows used to survive only if the user found the unlabelled save icon.
 * Debounced so typing never triggers a re-render (which would drop focus).
 */
function scheduleRowSave() {
  setRowSaveStatus('未保存');
  clearTimeout(rowSaveTimer);
  rowSaveTimer = setTimeout(flushRowSave, 500);
}

function flushRowSave() {
  clearTimeout(rowSaveTimer);
  rowSaveTimer = null;
  try {
    persistRows(state);
    setRowSaveStatus(`已保存 ${new Date().toTimeString().slice(0, 5)}`);
  } catch (error) {
    setRowSaveStatus('保存失败：空间不足');
  }
}

function setRowSaveStatus(text) {
  const chip = document.querySelector('[data-role="data-save-status"]');
  if (chip) chip.textContent = text;
}

appRoot.addEventListener('focusout', (event) => {
  const target = event.target.closest && event.target.closest('[data-action="update-data-cell"]');
  // Leaving the last cell must not wait out the debounce.
  if (target && rowSaveTimer) flushRowSave();
}, true);

appRoot.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (target) handleAction(target.dataset.action, target);
});

modalRoot.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (target) handleAction(target.dataset.action, target);
});

appRoot.addEventListener('input', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  // Live: content typing + font size slider (no full remount)
  if (['template-search', 'material-search', 'editor-tpl-search', 'update-data-cell', 'update-element', 'update-table-cell', 'set-table-dim', 'border-search'].includes(target.dataset.action)) {
    handleField(target.dataset.action, target);
  }
});

// System keyboard Enter / Done → 完成 (leave content mode)
appRoot.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const input = event.target;
  if (!input || !input.classList || !input.classList.contains('niim-content-line')) return;
  event.preventDefault();
  handleAction('content-done', input);
});

appRoot.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  // Date/time pickers commit on change (not click)
  if (['set-date-base', 'set-date-label'].includes(target.dataset.action)) {
    handleAction(target.dataset.action, target);
    return;
  }
  // text/value already handled live on input — finalize undo on change
  if (target.dataset.action === 'update-element' && contentUndoBefore) {
    const field = target.dataset.field;
    if (['text', 'value', 'fixedValue', 'prefix', 'suffix', 'fontSize'].includes(field)) {
      state.undo.push(contentUndoBefore);
      if (state.undo.length > 30) state.undo.shift();
      state.redo = [];
      contentUndoBefore = null;
      autosave();
      return;
    }
  }
  handleField(target.dataset.action, target);
});

modalRoot.addEventListener('input', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'update-setting' || target.dataset.action === 'stock-field' || target.dataset.action === 'rename-template-field') {
    handleField(target.dataset.action, target);
  }
});

modalRoot.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'stock-apply-current') {
    state.stockApplyCurrent = !!target.checked;
    return;
  }
  if (target.dataset.action === 'batch-template') {
    state.settings.batchTemplateId = target.value;
    persistSettings(state);
    return;
  }
  if (target.dataset.action === 'batch-mode') {
    state.batchMode = target.value;
    return;
  }
  if (target.dataset.action === 'batch-toggle-row') {
    const row = Number(target.dataset.row);
    const set = new Set(Array.isArray(state.batchSelectedRows) ? state.batchSelectedRows : []);
    if (target.checked) set.add(row);
    else set.delete(row);
    state.batchSelectedRows = Array.from(set).sort((a, b) => a - b);
    renderModalOnly();
    return;
  }
  handleField(target.dataset.action, target);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal) {
    event.preventDefault();
    closeModal();
    return;
  }
  if (state.route !== 'editor') return;
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    handleAction('delete-element', event.target);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    handleAction(event.shiftKey ? 'redo' : 'undo', event.target);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    handleAction('redo', event.target);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    handleAction('duplicate-element', event.target);
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (!selectedElements(state).length) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 0.5;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    nudgeSelection(dx, dy);
  } else if (event.key === 'Escape') {
    setSelection([]);
    render();
  } else if (event.key === 'Enter' && selectedElement(state)) {
    event.preventDefault();
    handleAction('edit-element', event.target);
  }
});

session.onConnectionStateChange(() => {
  state.device = null;
  printer.ready = false;
  if (!intentionalDisconnect) toast('打印机连接已断开', 'error');
  render();
});

window.addEventListener('resize', () => {
  if (state.route === 'editor') requestAnimationFrame(initializeEditorCanvas);
});

window.addEventListener('beforeunload', () => {
  if (rowSaveTimer) flushRowSave();
  try {
    if (state.document) upsertProject(state);
  } catch (error) {
    // The page is closing; the in-memory document remains available until unload.
  }
  session.close();
});

/**
 * One back step, not an app exit. Returns false only when there is nothing
 * left to go back to, which is the caller's cue to leave the app.
 */
async function goBack() {
  if (state.modal) {
    await closeModal();
    return true;
  }
  if (state.route === 'editor' && state.document) {
    closeEditor();
    // closeEditor bails out (and toasts) when the draft cannot be persisted;
    // swallow the gesture so a storage problem never discards the label.
    return true;
  }
  if (state.route !== 'home') {
    handleNavigation('home');
    return true;
  }
  return false;
}

let exitArmedUntil = 0;

function bindBackButton() {
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('backButton', async () => {
      if (await goBack()) return;
      if (Date.now() < exitArmedUntil) {
        CapacitorApp.exitApp();
        return;
      }
      exitArmedUntil = Date.now() + 2000;
      toast('再按一次返回键退出');
    });
    return;
  }
  // Browser fallback: keep one sentinel entry so the back gesture lands here
  // instead of leaving the page.
  history.replaceState({ niimBack: true }, '');
  history.pushState({ niimBack: true }, '');
  window.addEventListener('popstate', async () => {
    const handled = await goBack();
    if (handled) history.pushState({ niimBack: true }, '');
  });
}

write(KEYS.projects, state.projects);
render();
bindBackButton();
