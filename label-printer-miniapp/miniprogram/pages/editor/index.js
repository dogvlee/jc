const { BleSession } = require('../../services/ble-session');
const { PrinterClient } = require('../../services/printer-client');
const {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  hitTest,
  placeNewElement
} = require('../../core/document');
const {
  changeTextMode,
  fitElementToSelectionBounds,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  selectionHandleMode,
  snapElementPosition
} = require('../../core/geometry');
const { BORDER_CATALOG } = require('../../core/borders');
const { MATERIAL_CATALOG } = require('../../core/materials');
const {
  alignedCanvasSize,
  evaluatePrintability,
  getProfile,
  isCandidateModelId,
  previewCanvasSize,
  profileForModelId,
  PROFILES
} = require('../../core/profiles');
const {
  formatDateValue,
  renderDocument,
  renderSelection,
  serialValue,
  validateDocument
} = require('../../core/renderer');
const { TEXT_MODE_OPTIONS } = require('../../core/text-direction');
const { longPressSelection } = require('../../core/editor-gesture');
const { createImageCacheRegistry } = require('../../core/image-cache');
const { applyScanToElement } = require('../../core/scan-label');
const { KEYS, Repository, normalizeDocument } = require('../../services/repository');
const { scanCode } = require('../../services/scanner');

const STORAGE_DOCUMENT = 'label-printer:last-document';
const SIZE_OPTIONS = [
  { label: '30 x 12 mm', width: 30, height: 12 },
  { label: '40 x 12 mm', width: 40, height: 12 },
  { label: '50 x 12 mm', width: 50, height: 12 },
  { label: '30 x 20 mm', width: 30, height: 20 },
  { label: '40 x 30 mm', width: 40, height: 30 },
  { label: '50 x 30 mm', width: 50, height: 30 },
  { label: '50 x 40 mm', width: 50, height: 40 }
];

const ELEMENT_TOOLS = [
  { type: 'text', label: '文本', mark: 'T' },
  { type: 'image', label: '图片', mark: '▧' },
  { type: 'material', label: '素材', mark: '☺' },
  { type: 'date', label: '时间', mark: '◷' },
  { type: 'barcode', label: '条码', mark: '▥' },
  { type: 'qrcode', label: '二维码', mark: '▦' },
  { type: 'serial', label: '序列号', mark: '#' },
  { type: 'rect', label: '形状', mark: '□' },
  { type: 'table', label: '表格', mark: '▤' },
  { type: 'line', label: '线条', mark: '―' }
];

function placeholderPrintBlock(element) {
  if (!element) return null;
  if (element.type === 'text') {
    const value = String(element.text || '').trim();
    if (!value || value === '双击编辑') return '请先编辑文字内容，当前仍是默认占位';
  }
  if (element.type === 'barcode') {
    const value = String(element.value || '').trim();
    if (!value || value === '0') return '请先填写条码内容，当前仍是默认值';
  }
  if (element.type === 'qrcode') {
    const value = String(element.value || '').trim();
    if (!value || value === 'https://example.com') return '请先填写二维码内容，当前仍是默认链接';
  }
  return null;
}

function friendlyPrintError(error) {
  const raw = String(error && error.message || '打印失败');
  if (/断开|disconnect|未连接|not connected/i.test(raw)) return '打印机连接已断开，请靠近后重新连接再试';
  if (/超时|timeout/i.test(raw)) return '打印机没有响应，请检查电源与纸仓后重试';
  if (/缺纸|no paper|paper/i.test(raw)) return '打印机缺纸或纸仓未合上，装好标签纸后重试';
  if (/电量|battery/i.test(raw)) return '打印机电量过低，充电后重试';
  return raw;
}

Page({
  data: {
    profileOptions: PROFILES.map((item) => item.name),
    profileIndex: 0,
    sizeOptions: SIZE_OPTIONS.map((item) => item.label),
    sizeIndex: 1,
    labelTypeOptions: ['间隙纸', '黑标纸', '连续纸', '定孔纸'],
    qrCorrectionOptions: ['L', 'M', 'Q', 'H'],
    labelTypeIndex: 0,
    density: 2,
    densityMin: 1,
    densityMax: 3,
    threshold: 180,
    copies: 1,
    previewHeightPx: 104,
    canvasReady: false,
    document: null,
    selected: null,
    selectionCount: 0,
    multiSelect: false,
    canUndo: false,
    canRedo: false,
    templates: [],
    templateNames: [],
    showDevices: false,
    scanning: false,
    codeScanning: false,
    devices: [],
    connectionState: 'disconnected',
    connectionLabel: '未连接',
    connectedDevice: '',
    connectedMtu: 0,
    connectedDetails: '',
    printing: false,
    printProgress: 0,
    printMessage: '',
    projectId: '',
    editorPanelTab: 'elements',
    elementTools: ELEMENT_TOOLS,
    textModeOptions: TEXT_MODE_OPTIONS,
    materialOptions: MATERIAL_CATALOG.map((item) => ({
      id: item.id,
      label: item.label,
      asset: item.asset || '',
      symbol: item.symbol || ''
    })),
    borderOptions: BORDER_CATALOG,
    showPrintSheet: false,
    showSettingsSheet: false,
    showLayersSheet: false,
    showMaterialSheet: false,
    showBorderSheet: false,
    printBlock: null,
    printError: '',
    suggestedProfileName: '',
    selectedDateValue: '',
    selectedSerialValue: '',
    shapeKindOptions: ['rect', 'rounded', 'circle', 'ellipse'],
    tableCellIndexes: [],
    safeTop: 24
  },

  onLoad(options) {
    this.pageActive = true;
    this.devicePickerGeneration = 0;
    this.printTaskGeneration = 0;
    const app = getApp();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.repository = app && app.globalData && app.globalData.repository
      ? app.globalData.repository
      : new Repository(wx);
    this.repository.migrate();
    const settings = this.repository.getSettings();
    let storedProfileId = settings.defaultProfileId || 'd110';
    this.profile = getProfile(storedProfileId);
    this.profileConfirmed = true;
    let draft = null;
    try {
      draft = wx.getStorageSync(KEYS.editorDraft) || null;
      wx.removeStorageSync(KEYS.editorDraft);
    } catch (error) {
      draft = null;
    }
    this.projectId = draft && draft.projectId ? String(draft.projectId) : '';
    const storedDocument = draft && normalizeDocument(draft.document);
    this.document = storedDocument || this.loadLastDocument()
      || createDocument(Number(settings.stockWidthMm) || 50, Number(settings.stockHeightMm) || 30);
    this.selectedId = this.document.elements.length ? this.document.elements[0].id : '';
    this.selectedIds = this.selectedId ? [this.selectedId] : [];
    this.multiSelect = false;
    this.undoStack = [];
    this.redoStack = [];
    this.images = {};
    this.imageLoadPromises = {};
    this.imageCache = createImageCacheRegistry();
    this.connectionManager = app && app.globalData && app.globalData.connectionManager;
    this.session = app && app.globalData && app.globalData.bleSession
      ? app.globalData.bleSession
      : new BleSession(wx);
    this.printer = app && app.globalData && app.globalData.printerClient
      ? app.globalData.printerClient
      : new PrinterClient(this.session);
    this.ownsSession = !(app && app.globalData && app.globalData.bleSession);
    this.removeConnectionListener = this.session.onConnectionStateChange(() => {
      if (!this.pageActive) return;
      this.setDisconnectedState();
      wx.showToast({ title: '打印机连接已断开', icon: 'none' });
    });
    if (this.connectionManager && this.connectionManager.subscribe) {
      this.removeManagerListener = this.connectionManager.subscribe((state) => {
        if (!this.pageActive) return;
        if (state.status === 'connected' && state.device) {
          this.setData({
            connectionState: 'connected',
            connectionLabel: '已连接',
            connectedDevice: state.device.name || state.device.displayName || '打印机',
            connectedMtu: Number(state.device.mtu) || this.session.mtu || 0
          });
        } else if (state.status === 'connecting') {
          this.setData({ connectionState: 'connecting', connectionLabel: '连接中' });
        } else {
          this.setDisconnectedState();
        }
      });
      const managerState = this.connectionManager.getState();
      if (managerState.status === 'connected' && managerState.device) {
        this.setData({
          connectionState: 'connected',
          connectionLabel: '已连接',
          connectedDevice: managerState.device.name || managerState.device.displayName || '打印机',
          connectedMtu: Number(managerState.device.mtu) || this.session.mtu || 0
        });
      }
    }
    const profileIndex = PROFILES.findIndex((item) => item.id === this.profile.id);
    this.setData({
      profileIndex,
      density: Number(settings.density) || this.profile.densityDefault,
      densityMin: this.profile.densityMin,
      densityMax: this.profile.densityMax,
      threshold: Number(settings.threshold) || 180,
      labelTypeIndex: Math.max(0, Math.min(3, (Number(settings.labelType) || 1) - 1)),
      projectId: this.projectId,
      safeTop: Number(info.safeArea && info.safeArea.top) || Number(info.statusBarHeight) || 24
    });
    this.loadTemplates();
    this.syncPageData();
    if (options && options.devices === '1') {
      this.deviceOpenTimer = setTimeout(() => {
        if (this.pageActive) this.openDevices();
      }, 350);
    }
  },

  onReady() {
    this.initCanvas();
  },

  async onUnload() {
    this.pageActive = false;
    this.printCancelRequested = true;
    this.printTaskGeneration = (this.printTaskGeneration || 0) + 1;
    this.devicePickerGeneration += 1;
    clearTimeout(this.deviceOpenTimer);
    clearTimeout(this.resizeTimer);
    if (this.removeConnectionListener) {
      this.removeConnectionListener();
      this.removeConnectionListener = null;
    }
    if (this.removeManagerListener) {
      this.removeManagerListener();
      this.removeManagerListener = null;
    }
    if (this.printer && this.printer.printing) {
      await this.printer.cancel();
    }
    if (this.session && this.ownsSession) {
      await this.session.close();
    }
  },

  onHide() {
    if (this.data.scanning) {
      this.devicePickerGeneration += 1;
      this.session.stopScan();
      this.setData({ showDevices: false, scanning: false });
    }
  },

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (this.pageActive) this.syncPageData(() => this.initCanvas());
    }, 100);
  },

  loadLastDocument() {
    try {
      const autosave = wx.getStorageSync(KEYS.editorAutosave);
      const normalized = normalizeDocument(autosave && (autosave.document || autosave));
      if (normalized) {
        if (!this.projectId && autosave.projectId) this.projectId = String(autosave.projectId);
        return normalized;
      }
      const stored = wx.getStorageSync(STORAGE_DOCUMENT);
      return normalizeDocument(stored);
    } catch (error) {
      // A fresh document is used when local storage is unavailable.
    }
    return null;
  },

  persistDocument() {
    try {
      wx.setStorageSync(KEYS.editorAutosave, {
        document: this.document,
        projectId: this.projectId || '',
        updatedAt: Date.now()
      });
    } catch (error) {
      wx.showToast({ title: '本地保存失败', icon: 'none' });
    }
  },

  loadTemplates() {
    const templates = this.repository.getUserTemplates();
    this.setData({
      templates,
      templateNames: templates.length ? templates.map((item) => item.name) : ['暂无模板']
    });
  },

  selectedElement() {
    return this.document.elements.find((item) => item.id === this.selectedId) || null;
  },

  selectedElements() {
    const ids = new Set(Array.isArray(this.selectedIds) ? this.selectedIds : []);
    return this.document.elements.filter((item) => ids.has(item.id));
  },

  setSelection(ids, multiSelect) {
    const valid = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((id) => {
      return this.document.elements.some((item) => item.id === id);
    })));
    this.selectedIds = valid;
    this.selectedId = valid.length ? valid[valid.length - 1] : '';
    this.multiSelect = Boolean(multiSelect && valid.length);
  },

  syncPageData(callback) {
    const validIds = new Set(this.document.elements.map((item) => item.id));
    this.selectedIds = (this.selectedIds || []).filter((id) => validIds.has(id));
    if (this.selectedId && validIds.has(this.selectedId) && !this.selectedIds.includes(this.selectedId)) {
      this.selectedIds = this.multiSelect ? this.selectedIds.concat(this.selectedId) : [this.selectedId];
    }
    if (!this.multiSelect && this.selectedIds.length > 1) {
      this.selectedIds = this.selectedId ? [this.selectedId] : [];
    }
    if (!this.selectedIds.length) {
      this.selectedId = '';
      this.multiSelect = false;
    } else if (!this.selectedId || !this.selectedIds.includes(this.selectedId)) {
      this.selectedId = this.selectedIds[this.selectedIds.length - 1];
    }
    const selected = this.selectedElement();
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const frameWidth = windowInfo.windowWidth * 672 / 750;
    const previewHeightPx = Math.round(frameWidth * this.document.heightMm / this.document.widthMm);
    const sizeIndex = SIZE_OPTIONS.findIndex((item) => {
      return item.width === this.document.widthMm && item.height === this.document.heightMm;
    });
    const documentView = cloneDocument(this.document);
    documentView.elements.forEach((item) => { item._selected = this.selectedIds.includes(item.id); });
    this.setData({
      document: documentView,
      selected: selected ? Object.assign({}, selected) : null,
      selectionCount: this.selectedIds.length,
      multiSelect: this.multiSelect,
      previewHeightPx,
      sizeIndex: sizeIndex >= 0 ? sizeIndex : 0,
      currentSizeLabel: `${this.document.widthMm} x ${this.document.heightMm} mm`,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      projectId: this.projectId || '',
      selectedDateValue: selected && selected.type === 'date' ? formatDateValue(selected) : '',
      selectedSerialValue: selected && selected.type === 'serial' ? serialValue(selected) : '',
      tableCellIndexes: selected && selected.type === 'table'
        ? Array.from({ length: Math.max(1, Number(selected.rows) || 1) * Math.max(1, Number(selected.columns) || 1) }, (item, index) => index)
        : []
    }, callback);
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#labelCanvas')
      .fields({ node: true, size: true })
      .select('#selectionCanvas')
      .fields({ node: true, size: true })
      .exec((result) => {
        if (!result || !result[0] || !result[1]) {
          return;
        }
        try {
          this.canvasSize = previewCanvasSize(this.document, this.profile.dpi);
        } catch (error) {
          this.context = null;
          this.selectionContext = null;
          this.canvasSize = null;
          this.setData({ canvasReady: false });
          wx.showToast({ title: error.message, icon: 'none' });
          return;
        }
        this.canvas = result[0].node;
        this.selectionCanvas = result[1].node;
        this.canvasRect = { width: result[0].width, height: result[0].height };
        [this.canvas, this.selectionCanvas].forEach((canvas) => {
          canvas.width = this.canvasSize.width;
          canvas.height = this.canvasSize.height;
        });
        this.context = this.canvas.getContext('2d');
        this.selectionContext = this.selectionCanvas.getContext('2d');
        this.setData({ canvasReady: true });
        this.loadDocumentImages();
        this.renderAll();
      });
  },

  renderAll() {
    if (!this.context || !this.selectionContext) {
      return;
    }
    renderDocument(this.context, this.document, this.canvasSize, this.profile.dpi, this.images);
    const selection = this.selectedElements();
    renderSelection(this.selectionContext, selection.length > 1 ? selection : selection[0], this.canvasSize, this.profile.dpi, this.snapGuides || []);
  },

  resolveImagePath(path) {
    const value = String(path || '');
    if (!value) return '';
    if (/^(wxfile:|https?:|\/)/.test(value)) return value;
    return `/${value.replace(/^\/+/, '')}`;
  },

  loadDocumentImages() {
    if (!this.canvas) {
      return [];
    }
    const pending = [];
    this.document.elements.filter((item) => (item.type === 'image' || item.type === 'material') && item.path).forEach((element) => {
      if (this.imageCache.cachedFor(this.images, element)) {
        return;
      }
      const source = String(element.path);
      let request = this.imageLoadPromises[element.id];
      if (!request || request.source !== source) {
        this.imageCache.invalidate(this.images, element.id);
        const token = this.imageCache.begin(element);
        const promise = new Promise((resolve) => {
          const image = this.canvas.createImage();
          image.onload = () => {
            const current = this.document.elements.find((item) => item.id === token.id);
            const accepted = this.imageCache.accept(this.images, current, token, image);
            if (this.imageLoadPromises[token.id] && this.imageLoadPromises[token.id].token === token) {
              delete this.imageLoadPromises[token.id];
            }
            if (accepted) this.renderAll();
            resolve(accepted);
          };
          image.onerror = () => {
            if (this.imageLoadPromises[token.id] && this.imageLoadPromises[token.id].token === token) {
              this.imageCache.invalidate(this.images, token.id);
              delete this.imageLoadPromises[token.id];
            }
            resolve(false);
          };
          image.src = this.resolveImagePath(element.path);
        });
        request = { source, token, promise };
        this.imageLoadPromises[element.id] = request;
      }
      pending.push(request.promise);
    });
    return pending;
  },

  invalidateImage(id) {
    if (!id) return;
    this.imageCache.invalidate(this.images, id);
    delete this.imageLoadPromises[id];
  },

  async ensureImagesReady() {
    const required = this.document.elements.filter((item) => item.type === 'image' && item.path);
    if (!required.length) {
      return;
    }
    await Promise.all(this.loadDocumentImages());
    const missing = required.find((item) => !this.images[item.id]);
    if (missing) {
      throw new Error('标签中的图片加载失败，请重新选择图片');
    }
  },

  recordSnapshot(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 30) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  },

  commit(mutator, reinitializeCanvas) {
    const before = cloneDocument(this.document);
    mutator(this.document);
    this.document.elements.forEach((item) => clampElement(item, this.document));
    this.recordSnapshot(before);
    this.persistDocument();
    this.syncPageData(() => {
      if (reinitializeCanvas) {
        this.initCanvas();
      } else {
        this.loadDocumentImages();
        this.renderAll();
      }
    });
  },

  undo() {
    if (!this.undoStack.length) {
      return;
    }
    this.redoStack.push(cloneDocument(this.document));
    this.document = this.undoStack.pop();
    this.setSelection([], false);
    this.persistDocument();
    this.syncPageData(() => this.initCanvas());
  },

  redo() {
    if (!this.redoStack.length) {
      return;
    }
    this.undoStack.push(cloneDocument(this.document));
    this.document = this.redoStack.pop();
    this.setSelection([], false);
    this.persistDocument();
    this.syncPageData(() => this.initCanvas());
  },

  touchPoint(event) {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      x: touch.x / this.canvasRect.width * this.document.widthMm,
      y: touch.y / this.canvasRect.height * this.document.heightMm
    };
  },

  onCanvasTouchStart(event) {
    if (!this.canvasRect) {
      return;
    }
    const point = this.touchPoint(event);
    const element = hitTest(this.document, point.x, point.y);
    this.pressBaseIds = (this.selectedIds || []).slice();
    const previous = this.selectedElement();
    let mode = 'move';
    if (!this.multiSelect && previous && !previous.locked && previous === element) {
      const tolerance = Math.max(1.2, Math.min(2.8, this.document.widthMm / 18));
      mode = selectionHandleMode(previous, point, tolerance);
      if (mode !== 'move' && previous._fit) fitElementToSelectionBounds(previous);
    }
    if (this.multiSelect) {
      if (!element) this.setSelection([], false);
      else if (!this.selectedIds.includes(element.id)) this.setSelection(this.selectedIds.concat(element.id), true);
      else this.selectedId = element.id;
    } else {
      this.setSelection(element ? [element.id] : [], false);
    }
    const group = this.multiSelect && this.selectedIds.length > 1 && element && this.selectedIds.includes(element.id);
    const groupOriginals = group ? this.selectedElements().filter((item) => !item.locked).map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y
    })) : [];
    this.drag = element && !element.locked && (!group || groupOriginals.length) ? {
      before: cloneDocument(this.document),
      startX: point.x,
      startY: point.y,
      originalX: element.x,
      originalY: element.y,
      original: Object.assign({}, element),
      mode: group ? 'group' : mode,
      groupOriginals,
      startAngle: pointerAngle(point, { x: element.x + element.width / 2, y: element.y + element.height / 2 }),
      moved: false
    } : null;
    this.syncPageData(() => this.renderAll());
  },

  onCanvasTouchMove(event) {
    if (!this.drag) {
      return;
    }
    const point = this.touchPoint(event);
    const element = this.selectedElement();
    if (!element) {
      return;
    }
    const delta = { x: point.x - this.drag.startX, y: point.y - this.drag.startY };
    if (this.drag.mode === 'group') {
      this.drag.groupOriginals.forEach((original) => {
        const item = this.document.elements.find((candidate) => candidate.id === original.id);
        if (!item) return;
        item.x = original.x + delta.x;
        item.y = original.y + delta.y;
        clampElement(item, this.document);
      });
      this.snapGuides = [];
    } else if (this.drag.mode === 'resize-e' || this.drag.mode === 'resize-s') {
      const resized = resizeRotatedElement(this.drag.original, this.drag.mode === 'resize-e' ? 'e' : 's', delta, 0.8);
      Object.assign(element, resized, { selectionFit: false });
      this.snapGuides = [];
    } else if (this.drag.mode === 'rotate') {
      const center = {
        x: this.drag.original.x + this.drag.original.width / 2,
        y: this.drag.original.y + this.drag.original.height / 2
      };
      const nextAngle = pointerAngle(point, center);
      element.rotation = (this.drag.original.rotation + normalizeAngleDelta(nextAngle - this.drag.startAngle) + 360) % 360;
      this.snapGuides = [];
    } else {
      element.x = this.drag.originalX + delta.x;
      element.y = this.drag.originalY + delta.y;
      const snapped = snapElementPosition(element, this.document, this.document.elements, 0.45);
      element.x = snapped.x;
      element.y = snapped.y;
      this.snapGuides = snapped.guides;
    }
    if (this.drag.mode !== 'group') clampElement(element, this.document);
    this.drag.moved = true;
    this.setData({ selected: Object.assign({}, element) });
    this.renderAll();
  },

  onCanvasTouchEnd() {
    if (this.drag && this.drag.moved) {
      this.recordSnapshot(this.drag.before);
      this.persistDocument();
      this.syncPageData(() => this.renderAll());
    }
    this.drag = null;
    this.pressBaseIds = [];
    this.snapGuides = [];
    this.renderAll();
  },

  addElement(event) {
    const type = event.currentTarget.dataset.type;
    if (type === 'image') {
      this.chooseImage();
      return;
    }
    if (type === 'material') {
      this.replaceMaterial = false;
      this.setData({ showMaterialSheet: true });
      return;
    }
    this.commit((document) => {
      const element = createElement(type, document);
      placeNewElement(element, document);
      document.elements.push(element);
      this.setSelection([element.id], false);
    });
  },

  chooseImage(event) {
    const replaceId = event && event.currentTarget && event.currentTarget.dataset.replace === '1'
      ? this.selectedId
      : '';
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (result) => {
        const source = result.tempFiles[0].tempFilePath;
        const extensionMatch = source.match(/\.[a-zA-Z0-9]+$/);
        const extension = extensionMatch ? extensionMatch[0] : '.jpg';
        const destination = `${wx.env.USER_DATA_PATH}/label-image-${Date.now()}${extension}`;
        wx.getFileSystemManager().copyFile({
          srcPath: source,
          destPath: destination,
          success: () => {
            this.commit((document) => {
              const existing = replaceId && document.elements.find((item) => item.id === replaceId && item.type === 'image');
              if (existing) {
                existing.path = destination;
                this.invalidateImage(existing.id);
                return;
              }
              const element = createElement('image', document);
              element.path = destination;
              document.elements.push(element);
              this.setSelection([element.id], false);
            });
          },
          fail: () => wx.showToast({ title: '图片保存失败', icon: 'none' })
        });
      }
    });
  },

  deleteSelected() {
    const deletedIds = (this.selectedIds && this.selectedIds.length ? this.selectedIds : [this.selectedId]).filter(Boolean);
    if (!deletedIds.length) {
      return;
    }
    this.commit((document) => {
      document.elements = document.elements.filter((item) => !deletedIds.includes(item.id));
      deletedIds.forEach((id) => {
        this.invalidateImage(id);
      });
      this.setSelection([], false);
    });
  },

  duplicateSelected() {
    const selection = this.selectedElements();
    if (!selection.length) {
      return;
    }
    this.commit((document) => {
      const ids = selection.map((selected, index) => {
        const duplicate = JSON.parse(JSON.stringify(selected));
        duplicate.id = `${selected.type}-${Date.now().toString(36)}-${index}`;
        duplicate.x = Math.min(document.widthMm - duplicate.width, duplicate.x + 1);
        duplicate.y = Math.min(document.heightMm - duplicate.height, duplicate.y + 1);
        document.elements.push(duplicate);
        if (this.images[selected.id]) this.images[duplicate.id] = this.images[selected.id];
        return duplicate.id;
      });
      this.setSelection(ids, ids.length > 1);
    });
  },

  moveLayer(event) {
    const direction = Number(event.currentTarget.dataset.direction);
    const selected = this.selectedElement();
    if (!selected) {
      return;
    }
    this.commit((document) => {
      const index = document.elements.findIndex((item) => item.id === selected.id);
      const target = Math.max(0, Math.min(document.elements.length - 1, index + direction));
      if (target !== index) {
        const item = document.elements.splice(index, 1)[0];
        document.elements.splice(target, 0, item);
      }
    });
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field;
    const numeric = [
      'x', 'y', 'width', 'height', 'fontSize', 'lineWidth', 'rotation',
      'letterSpacing', 'lineSpacing', 'threshold', 'start', 'step', 'digits',
      'offsetDays', 'offsetHours', 'expirePresetHours', 'textArcAngle'
    ];
    const value = numeric.indexOf(field) >= 0 ? Number(event.detail.value) : event.detail.value;
    if (numeric.indexOf(field) >= 0 && !Number.isFinite(value)) {
      return;
    }
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        selected[field] = value;
      }
    });
  },

  updateSwitch(event) {
    const field = event.currentTarget.dataset.field;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        selected[field] = event.detail.value;
      }
    });
  },

  updateSlider(event) {
    const field = event.currentTarget.dataset.field;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        selected[field] = Number(event.detail.value);
      }
    });
  },

  setAlignment(event) {
    const value = event.currentTarget.dataset.value;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        selected.align = value;
      }
    });
  },

  setVerticalAlignment(event) {
    const value = event.currentTarget.dataset.value;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) selected.verticalAlign = value;
    });
  },

  async scanSelectedCode() {
    if (this.codeScanInFlight) return;
    const selected = this.selectedElement();
    if (!selected || (selected.type !== 'barcode' && selected.type !== 'qrcode')) {
      wx.showToast({ title: '请先选择条码或二维码', icon: 'none' });
      return;
    }
    this.codeScanInFlight = true;
    this.setData({ codeScanning: true });
    try {
      const result = await scanCode(wx, {
        scanType: selected.type === 'barcode' ? ['barCode'] : ['qrCode']
      });
      this.commit(() => {
        const current = this.selectedElement();
        applyScanToElement(current, result);
      });
      wx.showToast({ title: selected.type === 'barcode' ? '条码已填入' : '二维码已填入', icon: 'success' });
    } catch (error) {
      if (error && error.code === 'SCAN_CANCELLED') return;
      wx.showModal({
        title: '无法填入扫码内容',
        content: error && error.message ? error.message : '扫码失败，请稍后重试',
        showCancel: false
      });
    } finally {
      this.codeScanInFlight = false;
      this.setData({ codeScanning: false });
    }
  },

  setTextMode(event) {
    const value = event.currentTarget.dataset.value;
    this.commit((document) => {
      const selected = this.selectedElement();
      if (selected && ['text', 'date', 'serial'].includes(selected.type)) {
        changeTextMode(selected, value, document);
      }
    });
  },

  setShapeKind(event) {
    const value = event.currentTarget.dataset.value;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected && (selected.type === 'rect' || selected.type === 'line')) selected.shapeKind = value;
    });
  },

  setEditorPanelTab(event) {
    this.setData({ editorPanelTab: event.currentTarget.dataset.value });
  },

  setChoiceField(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    if (!field) return;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) selected[field] = value;
    });
  },

  toggleSelectedFlag(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.commit(() => {
      const selected = this.selectedElement();
      if (!selected) return;
      const value = !selected[field];
      const targets = this.multiSelect ? this.selectedElements() : [selected];
      targets.forEach((item) => { item[field] = value; });
    });
  },

  toggleMultiSelect() {
    if (this.multiSelect) {
      this.setSelection(this.selectedId ? [this.selectedId] : [], false);
    } else if (this.selectedId) {
      this.setSelection([this.selectedId], true);
    } else {
      wx.showToast({ title: '请先选择一个元素', icon: 'none' });
      return;
    }
    this.syncPageData(() => this.renderAll());
  },

  selectAllElements() {
    const ids = this.document.elements.map((item) => item.id);
    this.setSelection(ids, ids.length > 0);
    this.syncPageData(() => this.renderAll());
  },

  alignSelection(event) {
    const value = event.currentTarget.dataset.value;
    const selection = this.selectedElements().filter((item) => !item.locked);
    if (selection.length < 2) {
      wx.showToast({ title: '至少选择两个未锁定元素', icon: 'none' });
      return;
    }
    const left = Math.min(...selection.map((item) => item.x));
    const top = Math.min(...selection.map((item) => item.y));
    const right = Math.max(...selection.map((item) => item.x + item.width));
    const bottom = Math.max(...selection.map((item) => item.y + item.height));
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    this.commit(() => {
      selection.forEach((item) => {
        if (value === 'left') item.x = left;
        else if (value === 'hcenter') item.x = centerX - item.width / 2;
        else if (value === 'right') item.x = right - item.width;
        else if (value === 'top') item.y = top;
        else if (value === 'vcenter') item.y = centerY - item.height / 2;
        else if (value === 'bottom') item.y = bottom - item.height;
      });
    });
  },

  distributeSelection(event) {
    const axis = event.currentTarget.dataset.axis;
    const selection = this.selectedElements().filter((item) => !item.locked);
    if (selection.length < 3) {
      wx.showToast({ title: '均匀分布至少需要三个未锁定元素', icon: 'none' });
      return;
    }
    this.commit(() => {
      if (axis === 'horizontal') {
        const sorted = selection.slice().sort((left, right) => left.x - right.x);
        const start = sorted[0].x;
        const end = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
        const width = sorted.reduce((total, item) => total + item.width, 0);
        const gap = (end - start - width) / (sorted.length - 1);
        let cursor = start;
        sorted.forEach((item) => { item.x = cursor; cursor += item.width + gap; });
      } else {
        const sorted = selection.slice().sort((left, right) => left.y - right.y);
        const start = sorted[0].y;
        const end = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
        const height = sorted.reduce((total, item) => total + item.height, 0);
        const gap = (end - start - height) / (sorted.length - 1);
        let cursor = start;
        sorted.forEach((item) => { item.y = cursor; cursor += item.height + gap; });
      }
    });
  },

  clearElements() {
    if (!this.document.elements.length) return;
    wx.showModal({
      title: '清空标签内容',
      content: '将删除画布上的全部元素，可使用撤销恢复。',
      success: (result) => {
        if (!result.confirm) return;
        this.commit((document) => {
          document.elements = [];
          this.setSelection([], false);
          this.images = {};
          this.imageLoadPromises = {};
          this.imageCache = createImageCacheRegistry();
        });
      }
    });
  },

  openLayers() { this.setData({ showLayersSheet: true }); },
  closeLayers() { this.setData({ showLayersSheet: false }); },
  openSettings() { this.setData({ showSettingsSheet: true }); },
  closeSettings() { this.setData({ showSettingsSheet: false }); },
  openMaterialSheet() {
    this.replaceMaterial = Boolean(this.selectedElement() && this.selectedElement().type === 'material');
    this.setData({ showMaterialSheet: true });
  },
  closeMaterialSheet() { this.setData({ showMaterialSheet: false }); },
  openBorderSheet() { this.setData({ showBorderSheet: true }); },
  closeBorderSheet() { this.setData({ showBorderSheet: false }); },

  selectLayer(event) {
    const id = event.currentTarget.dataset.id;
    if (this.multiSelect) {
      const ids = this.selectedIds.includes(id)
        ? this.selectedIds.filter((item) => item !== id)
        : this.selectedIds.concat(id);
      this.setSelection(ids, ids.length > 0);
    } else {
      this.setSelection([id], false);
      this.setData({ showLayersSheet: false });
    }
    this.syncPageData(() => this.renderAll());
  },

  onCanvasLongPress(event) {
    if (!this.canvasRect) return;
    const point = this.touchPoint(event);
    const element = hitTest(this.document, point.x, point.y);
    const decision = longPressSelection(this.pressBaseIds || [], element && element.id);
    if (!decision.enterMulti) return;
    this.drag = null;
    this.setSelection(decision.ids, true);
    this.syncPageData(() => this.renderAll());
    wx.showToast({ title: `已选择 ${decision.ids.length} 个元素`, icon: 'none' });
  },

  pickMaterial(event) {
    const material = MATERIAL_CATALOG.find((item) => item.id === event.currentTarget.dataset.id);
    if (!material) return;
    this.commit((document) => {
      let element = this.replaceMaterial && this.selectedElement();
      if (!element || element.type !== 'material') {
        element = createElement('material', document);
        document.elements.push(element);
        this.setSelection([element.id], false);
      }
      element.materialId = material.id;
      element.label = material.label;
      element.path = material.asset || '';
      element.symbol = material.symbol || (material.asset ? element.symbol : material.id);
      this.invalidateImage(element.id);
    });
    this.replaceMaterial = false;
    this.setData({ showMaterialSheet: false, editorPanelTab: 'style' });
  },

  pickBorder(event) {
    const border = BORDER_CATALOG.find((item) => item.id === event.currentTarget.dataset.id);
    if (!border) return;
    this.commit((document) => {
      let element = this.selectedElement();
      if (!element || element.type !== 'rect') {
        element = createElement('rect', document);
        document.elements.push(element);
        this.setSelection([element.id], false);
      }
      element.borderStyle = border.id;
    });
    this.setData({ showBorderSheet: false, editorPanelTab: 'style' });
  },

  updateTableCell(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.commit(() => {
      const selected = this.selectedElement();
      if (!selected || selected.type !== 'table' || !Number.isInteger(index)) return;
      const cells = Array.isArray(selected.cells) ? selected.cells.slice() : [];
      cells[index] = event.detail.value;
      selected.cells = cells;
    });
  },

  changeTableSize(event) {
    const field = event.currentTarget.dataset.field;
    const delta = Number(event.currentTarget.dataset.delta);
    this.commit(() => {
      const selected = this.selectedElement();
      if (!selected || selected.type !== 'table') return;
      const limit = field === 'rows' ? 20 : 12;
      selected[field] = Math.max(1, Math.min(limit, (Number(selected[field]) || 1) + delta));
      const count = selected.rows * selected.columns;
      const cells = Array.isArray(selected.cells) ? selected.cells.slice(0, count) : [];
      while (cells.length < count) cells.push('');
      selected.cells = cells;
    });
  },

  updateDocumentName(event) {
    const name = String(event.detail.value || '').trim() || '未命名标签';
    if (name === this.document.name) {
      return;
    }
    this.commit((document) => {
      document.name = name;
    });
  },

  onProfileChange(event) {
    const profileIndex = Number(event.detail.value);
    const profile = PROFILES[profileIndex];
    this.profile = profile;
    this.profileConfirmed = true;
    this.manualProfileConfirmed = true;
    this.repository.saveSettings({ defaultProfileId: profile.id });
    this.setData({
      profileIndex,
      density: profile.densityDefault,
      densityMin: profile.densityMin,
      densityMax: profile.densityMax
    });
    this.syncPageData(() => this.initCanvas());
    const check = evaluatePrintability(this.document, profile);
    if (!check.ok) wx.showToast({ title: '标签仍可编辑，打印前需更换合适机型', icon: 'none', duration: 2500 });
  },

  onSizeChange(event) {
    const sizeIndex = Number(event.detail.value);
    const size = SIZE_OPTIONS[sizeIndex];
    try {
      previewCanvasSize({ widthMm: size.width, heightMm: size.height }, this.profile.dpi);
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none', duration: 2500 });
      return;
    }
    this.setData({ sizeIndex });
    this.commit((document) => {
      document.widthMm = size.width;
      document.heightMm = size.height;
    }, true);
  },

  onCustomSizeChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    if (!Number.isFinite(value) || value < 5 || value > 150) {
      wx.showToast({ title: '标签尺寸须在 5-150 mm', icon: 'none' });
      this.syncPageData();
      return;
    }
    try {
      previewCanvasSize(Object.assign({}, this.document, { [field]: value }), this.profile.dpi);
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none', duration: 2500 });
      this.syncPageData();
      return;
    }
    this.commit((document) => {
      document[field] = value;
    }, true);
  },

  onLabelTypeChange(event) {
    const labelTypeIndex = Number(event.detail.value);
    this.repository.saveSettings({ labelType: labelTypeIndex + 1 });
    this.setData({ labelTypeIndex });
  },

  onDensityChange(event) {
    const density = Number(event.detail.value);
    this.repository.saveSettings({ density });
    this.setData({ density });
  },

  onThresholdChange(event) {
    const threshold = Number(event.detail.value);
    this.repository.saveSettings({ threshold });
    this.setData({ threshold });
  },

  changeCopies(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    this.setData({ copies: Math.max(1, Math.min(99, this.data.copies + delta)) });
  },

  saveTemplate() {
    wx.showModal({
      title: '保存模板',
      editable: true,
      placeholderText: this.document.name || '模板名称',
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        const name = String(result.content || this.document.name || '未命名模板').trim();
        try {
          this.repository.saveUserTemplate(this.document, name);
          this.loadTemplates();
          wx.showToast({ title: '模板已保存', icon: 'success' });
        } catch (error) {
          wx.showModal({ title: '保存失败', content: error.message, showCancel: false });
        }
      }
    });
  },

  saveProject() {
    try {
      const project = this.repository.saveProject(this.document, this.projectId);
      this.projectId = project.id;
      this.persistDocument();
      this.setData({ projectId: project.id });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      wx.showModal({ title: '保存失败', content: error.message, showCancel: false });
    }
  },

  closeEditor() {
    if (!this.projectId && this.document.elements.length) this.persistDocument();
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/home/index' })
    });
  },

  loadTemplate(event) {
    if (!this.data.templates.length) {
      return;
    }
    const template = this.data.templates[Number(event.detail.value)];
    if (!template) {
      return;
    }
    this.recordSnapshot(cloneDocument(this.document));
    this.document = normalizeDocument(template.document) || createDocument(50, 30);
    this.images = {};
    this.imageLoadPromises = {};
    this.imageCache = createImageCacheRegistry();
    this.document.name = template.name;
    this.setSelection([], false);
    this.persistDocument();
    this.syncPageData(() => this.initCanvas());
  },

  openDevices() {
    if (!this.pageActive || this.data.connectionState === 'connecting' || this.data.printing) {
      return;
    }
    const generation = ++this.devicePickerGeneration;
    this.setData({ showDevices: true, devices: [], scanning: true });
    this.session.scan((devices) => {
      if (this.pageActive && generation === this.devicePickerGeneration && this.data.showDevices) {
        this.setData({ devices });
      }
    })
      .catch((error) => {
        if (!this.pageActive || generation !== this.devicePickerGeneration) return;
        this.setData({ scanning: false });
        wx.showModal({ title: '无法扫描蓝牙设备', content: error.message, showCancel: false });
      });
  },

  closeDevices() {
    this.devicePickerGeneration += 1;
    this.session.stopScan();
    this.setData({ showDevices: false, scanning: false });
  },

  async connectDevice(event) {
    if (this.connecting) {
      return;
    }
    const deviceId = event.currentTarget.dataset.id;
    const device = this.data.devices.find((item) => item.deviceId === deviceId);
    if (!device) {
      return;
    }
    this.connecting = true;
    this.setData({ connectionState: 'connecting', connectionLabel: '连接中', scanning: false });
    try {
      let result;
      try {
        result = this.connectionManager
          ? await this.connectionManager.ensureReady(device, { forceFresh: true })
          : await this.printer.connect(device);
      } catch (error) {
        if (error && error.code === 'BLE_RECONNECT_OFF') result = await this.printer.connect(device);
        else throw error;
      }
      const guessed = this.applyConnectionResult(result);
      const details = [
        result.modelId == null ? '' : `ID ${result.modelId}`,
        result.protocolVersion ? `协议 ${result.protocolVersion}` : '',
        result.mtu ? `MTU ${result.mtu}` : ''
      ].filter(Boolean).join(' · ');
      this.setData({
        showDevices: false,
        connectionState: 'connected',
        connectionLabel: '已连接',
        connectedDevice: result.name,
        connectedMtu: result.mtu,
        connectedDetails: details
      });
      this.syncPageData(() => this.initCanvas());
      if (!guessed || this.candidateProfileVerificationRequired) {
        wx.showModal({
          title: this.candidateProfileVerificationRequired ? '请确认候选机型参数' : '需要选择打印机型号',
          content: this.candidateProfileVerificationRequired
            ? `型号 ID ${result.modelId} 暂按“${guessed.name}”候选适配，尚未完成真机验证。请在打印设置中核对并手动确认后再打印。`
            : result.modelId == null
            ? '设备未返回型号 ID，请在打印设置中手动选择准确型号后再打印。'
            : `型号 ID ${result.modelId} 尚未适配，请勿使用相似机型参数直接打印。`,
          showCancel: false
        });
      }
    } catch (error) {
      if (this.connectionManager) await this.connectionManager.disconnect();
      else await this.session.disconnect();
      this.setDisconnectedState();
      wx.showModal({ title: '连接失败', content: error.message, showCancel: false });
    } finally {
      this.connecting = false;
    }
  },

  async disconnectDevice() {
    if (this.connectionManager) await this.connectionManager.disconnect();
    else await this.session.disconnect();
    this.setDisconnectedState();
  },

  setDisconnectedState() {
    this.setData({
      connectionState: 'disconnected',
      connectionLabel: '未连接',
      connectedDevice: '',
      connectedMtu: 0,
      connectedDetails: ''
    });
  },

  applyConnectionResult(result) {
    const guessed = profileForModelId(result.modelId, result.name, result.protocolVersion);
    const candidate = Boolean(guessed && isCandidateModelId(result.modelId));
    this.candidateProfileVerificationRequired = candidate;
    if (guessed) {
      const index = PROFILES.findIndex((item) => item.id === guessed.id);
      this.profile = guessed;
      const manuallyConfirmedCandidate = candidate
        && this.manualProfileConfirmed === true
        && this.data.profileIndex === index;
      this.profileConfirmed = candidate ? manuallyConfirmedCandidate : true;
      if (!candidate) this.manualProfileConfirmed = false;
      this.repository.saveSettings({ defaultProfileId: guessed.id });
      this.setData({
        profileIndex: index,
        density: guessed.densityDefault,
        densityMin: guessed.densityMin,
        densityMax: guessed.densityMax
      });
    } else if (!this.manualProfileConfirmed) {
      this.profileConfirmed = false;
      this.candidateProfileVerificationRequired = false;
    }
    return guessed;
  },

  evaluatePrintBlock() {
    if (!this.profileConfirmed) {
      return { kind: 'model', message: '请先确认准确的打印机型号，再开始打印。', suggestProfileId: '' };
    }
    if (!this.document.elements.length) {
      return { kind: 'empty', message: '请先添加至少一个标签元素。', suggestProfileId: '' };
    }
    for (let index = 0; index < this.document.elements.length; index += 1) {
      const element = this.document.elements[index];
      const message = placeholderPrintBlock(element);
      if (message) return { kind: 'placeholder', message, elementId: element.id, suggestProfileId: '' };
    }
    const fit = evaluatePrintability(this.document, this.profile);
    if (!fit.ok) return { kind: 'size', message: fit.message, suggestProfileId: fit.suggestProfileId || '' };
    try {
      validateDocument(this.document, this.profile.dpi);
    } catch (error) {
      return { kind: 'element', message: error.message, suggestProfileId: '' };
    }
    return null;
  },

  refreshPrintBlock() {
    const printBlock = this.evaluatePrintBlock();
    const suggested = printBlock && printBlock.suggestProfileId
      ? getProfile(printBlock.suggestProfileId)
      : null;
    this.setData({
      printBlock,
      suggestedProfileName: suggested ? suggested.name : '',
      printError: ''
    });
    return printBlock;
  },

  openPrintSheet() {
    this.refreshPrintBlock();
    this.setData({ showPrintSheet: true });
  },

  closePrintSheet() {
    if (this.data.printing) {
      wx.showToast({ title: '正在打印，请先取消或等待完成', icon: 'none' });
      return;
    }
    this.setData({ showPrintSheet: false, printError: '' });
  },

  applySuggestedProfile() {
    const profileId = this.data.printBlock && this.data.printBlock.suggestProfileId;
    if (!profileId) return;
    const profile = getProfile(profileId);
    const index = PROFILES.findIndex((item) => item.id === profile.id);
    this.profile = profile;
    this.profileConfirmed = true;
    this.manualProfileConfirmed = true;
    this.repository.saveSettings({ defaultProfileId: profile.id });
    this.setData({
      profileIndex: index,
      density: profile.densityDefault,
      densityMin: profile.densityMin,
      densityMax: profile.densityMax
    });
    this.syncPageData(() => {
      this.initCanvas();
      this.refreshPrintBlock();
    });
  },

  async diagnoseConnection() {
    if (!this.connectionManager) {
      wx.showModal({ title: '连接诊断', content: '当前运行环境未启用稳定连接管理器。', showCancel: false });
      return;
    }
    wx.showLoading({ title: '诊断中', mask: true });
    const report = await this.connectionManager.diagnose();
    wx.hideLoading();
    const lines = report.error ? [`结果：${report.error}`] : [
      `蓝牙适配器：${report.adapterOk ? '正常' : '异常'}`,
      `系统连接：${report.systemConnected ? '已连接' : '待重建'}`,
      `GATT 通道：${report.transportReady ? '正常' : '异常'}`,
      `打印协议：${report.protocolReady ? '正常' : '异常'}`,
      `MTU：${report.mtu || '未知'}`,
      report.modelId == null ? '型号 ID：未返回' : `型号 ID：${report.modelId}`,
      report.source ? `连接路径：${report.source}` : ''
    ].filter(Boolean);
    wx.showModal({ title: report.error ? '诊断未通过' : '连接诊断通过', content: lines.join('\n'), showCancel: false });
  },

  async forgetDevice() {
    if (this.connectionManager) await this.connectionManager.forget();
    else await this.session.disconnect();
    this.setDisconnectedState();
    wx.showToast({ title: '已忘记打印机', icon: 'success' });
  },

  recordPrintSafely(entry) {
    try {
      this.repository.recordPrint(entry);
      return true;
    } catch (error) {
      return false;
    }
  },

  createPrintImageData(documentValue) {
    const size = alignedCanvasSize(documentValue, this.profile);
    let canvas = null;
    if (wx.createOffscreenCanvas) {
      canvas = wx.createOffscreenCanvas({ type: '2d', width: size.width, height: size.height });
    } else {
      canvas = this.canvas;
      this.usedVisiblePrintCanvas = true;
    }
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    renderDocument(context, documentValue, size, this.profile.dpi, this.images);
    return context.getImageData(0, 0, size.width, size.height);
  },

  assertPrintActive(generation) {
    if (!this.pageActive || this.printCancelRequested || generation !== this.printTaskGeneration) {
      const error = new Error('打印已取消');
      error.code = 'PRINT_CANCELLED';
      throw error;
    }
  },

  async startPrint() {
    if (this.data.printing) return;
    if (this.refreshPrintBlock()) return;
    if (!this.context || !this.canvasSize || !this.data.canvasReady) {
      wx.showToast({ title: '画布尚未就绪', icon: 'none' });
      return;
    }
    const savedDevice = this.connectionManager && this.connectionManager.getSavedDevice
      ? this.connectionManager.getSavedDevice()
      : null;
    if (this.connectionManager && !savedDevice) {
      this.setData({ showPrintSheet: false });
      this.openDevices();
      return;
    }
    if (!this.connectionManager && !this.session.connected) {
      this.setData({ showPrintSheet: false });
      this.openDevices();
      return;
    }

    const taskGeneration = (this.printTaskGeneration || 0) + 1;
    this.printTaskGeneration = taskGeneration;
    this.printCancelRequested = false;
    this.setData({ printing: true, printProgress: 2, printMessage: '正在确认打印机连接', printError: '' });
    let blockedAfterConnect = false;
    try {
      if (this.connectionManager) {
        const result = await this.connectionManager.ensureReady(savedDevice);
        this.assertPrintActive(taskGeneration);
        this.applyConnectionResult(result);
      }
      this.assertPrintActive(taskGeneration);
      const block = this.evaluatePrintBlock();
      if (block) {
        blockedAfterConnect = true;
        const suggested = block.suggestProfileId ? getProfile(block.suggestProfileId) : null;
        this.setData({ printBlock: block, suggestedProfileName: suggested ? suggested.name : '' });
        return;
      }

      this.setData({ printProgress: 5, printMessage: '正在生成打印点阵' });
      await this.ensureImagesReady();
      this.assertPrintActive(taskGeneration);
      const serialElements = this.document.elements.filter((element) => element.type === 'serial');
      const printDocuments = serialElements.length
        ? Array.from({ length: this.data.copies }, (item, copyIndex) => {
          const next = cloneDocument(this.document);
          next.elements.filter((element) => element.type === 'serial').forEach((element) => {
            element.currentValue = (Number(element.start) || 0) + copyIndex * (Number(element.step) || 1);
          });
          return next;
        })
        : [this.document];

      for (let index = 0; index < printDocuments.length; index += 1) {
        this.assertPrintActive(taskGeneration);
        const documentValue = printDocuments[index];
        validateDocument(documentValue, this.profile.dpi);
        const imageData = this.createPrintImageData(documentValue);
        await this.printer.print(imageData, this.profile, {
          copies: serialElements.length ? 1 : this.data.copies,
          density: this.data.density,
          threshold: this.data.threshold,
          labelType: this.data.labelTypeIndex + 1
        }, (progress, message) => {
          if (!this.pageActive || taskGeneration !== this.printTaskGeneration) return;
          const printProgress = serialElements.length
            ? Math.round((index * 100 + progress) / printDocuments.length)
            : progress;
          this.setData({ printProgress, printMessage: message });
        });
        this.assertPrintActive(taskGeneration);
      }
      if (this.connectionManager) this.connectionManager.touch(savedDevice);
      const historySaved = this.recordPrintSafely({
        name: this.document.name,
        projectId: this.projectId || '',
        result: 'success',
        message: '',
        profileId: this.profile.id,
        deviceName: this.data.connectedDevice,
        document: cloneDocument(this.document)
      });
      if (this.pageActive && taskGeneration === this.printTaskGeneration) {
        this.setData({ printProgress: 100, printMessage: '打印完成', printError: '' });
        wx.showToast({
          title: historySaved ? '打印完成' : '打印完成，历史未保存',
          icon: historySaved ? 'success' : 'none'
        });
      }
    } catch (error) {
      const cancelled = this.printCancelRequested || !this.pageActive
        || taskGeneration !== this.printTaskGeneration
        || /已取消/.test(String(error && error.message || ''));
      const message = cancelled ? '' : friendlyPrintError(error);
      this.recordPrintSafely({
        name: this.document.name,
        projectId: this.projectId || '',
        result: cancelled ? 'cancelled' : 'failed',
        message: error && error.message || '打印失败',
        profileId: this.profile.id,
        deviceName: this.data.connectedDevice,
        document: cloneDocument(this.document)
      });
      if (this.pageActive && taskGeneration === this.printTaskGeneration) {
        this.setData({
          printMessage: cancelled ? '打印已取消' : '打印未完成',
          printError: message
        });
        wx.showToast({ title: cancelled ? '打印已取消' : message, icon: 'none', duration: 2800 });
      }
    } finally {
      if (taskGeneration === this.printTaskGeneration) {
        this.printCancelRequested = false;
        if (this.pageActive) {
          this.setData({ printing: false });
          if (this.usedVisiblePrintCanvas) {
            this.usedVisiblePrintCanvas = false;
            this.initCanvas();
          } else if (!blockedAfterConnect) {
            this.renderAll();
          }
        }
      }
    }
  },

  async cancelPrint() {
    if (!this.data.printing) return;
    this.printCancelRequested = true;
    this.setData({ printMessage: '正在停止打印…' });
    try {
      await this.printer.cancel();
    } catch (error) {
      // PrinterClient will surface the original task result to startPrint.
    }
  }
});
