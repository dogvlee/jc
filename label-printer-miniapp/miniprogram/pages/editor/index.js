const { BleSession } = require('../../services/ble-session');
const { PrinterClient } = require('../../services/printer-client');
const { templates: catalogTemplates } = require('../../app/catalog');
const { buildTemplateDocument } = require('../../app/template-layouts');
const {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  elementTypeLabel,
  hitTest,
  hitTestAll,
  placeNewElement
} = require('../../core/document');
const {
  changeTextMode,
  clampGroupDelta,
  fitElementToSelectionBounds,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  selectionHandleModeAtPoint,
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
const {
  longPressSelection,
  nextSelectionId,
  selectionHitDecision,
  selectionTargetSizeMm
} = require('../../core/editor-gesture');
const { createImageCacheRegistry } = require('../../core/image-cache');
const { applyScanToElement } = require('../../core/scan-label');
const { linkedCodeValue, syncLinkedCodes } = require('../../core/linked-codes');
const { localizeUrl } = require('../../services/remote-image-cache');
const { KEYS, Repository, normalizeDocument } = require('../../services/repository');
const { scanCode, showScanFailure } = require('../../services/scanner');
const { EditorSession } = require('../../services/editor-session');
const { PrintJobService } = require('../../services/print-job-service');
const { fontFallbackInfo, listFontCatalog, resolveFontId } = require('../../core/font-family');
const { ensureDocumentFonts } = require('../../core/font-loader');
const { resizeCodeElementToMinimum } = require('../../core/code-quality');

function fontRuntime() {
  return { wx: typeof wx === 'undefined' ? null : wx };
}

const EDITOR_FONT_CATALOG = listFontCatalog();
const EDITOR_REMOTE_FONT_COUNT = EDITOR_FONT_CATALOG.filter((font) => font.remote).length;
const EDITOR_FONT_CATALOG_NOTE = `${EDITOR_FONT_CATALOG.length} 款字体 · ${EDITOR_REMOTE_FONT_COUNT} 款 OFL 开源字体按需加载`;

const MILLIMETERS_PER_INCH = 25.4;
const PREVIEW_WIDTH_RPX = 672;
let previewCanvasInstanceSequence = 0;
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
  { type: 'text', label: '文本', icon: 'icon-type' },
  { type: 'image', label: '图片', icon: 'icon-image' },
  { type: 'material', label: '素材', icon: 'icon-smile' },
  { type: 'date', label: '时间', icon: 'icon-clock' },
  { type: 'barcode', label: '条码', icon: 'icon-barcode' },
  { type: 'qrcode', label: '二维码', icon: 'icon-qr-code' },
  { type: 'serial', label: '序列号', icon: 'icon-hash' },
  { type: 'rect', label: '形状', icon: 'icon-square' },
  { type: 'table', label: '表格', icon: 'icon-table' },
  { type: 'line', label: '线条', icon: 'icon-minus' }
];

function isLiveStringField(element, field) {
  if (!element) return false;
  if (element.type === 'text') return field === 'text';
  if (element.type === 'barcode' || element.type === 'qrcode') return field === 'value';
  if (element.type === 'serial') return field === 'prefix' || field === 'suffix';
  return false;
}

function updateInputConfirmationAfterEdit(element, field) {
  const isEditableContent = element && (
    (element.type === 'text' && field === 'text')
    || ((element.type === 'barcode' || element.type === 'qrcode') && field === 'value')
  );
  if (!isEditableContent) return element;
  const value = element.type === 'text' ? element.text : element.value;
  element.requiresInput = !String(value == null ? '' : value).trim();
  element.requiresInputReason = element.requiresInput
    ? (element.type === 'text' ? 'empty-text' : 'empty-code')
    : undefined;
  delete element.invalidCode;
  delete element.codeValidationMessage;
  return element;
}

function confirmBarcodeFormat(element, format) {
  if (!element || element.type !== 'barcode') return element;
  element.format = format;
  element.formatChangedByUser = true;
  delete element.unsupportedCodeType;
  delete element.requiresFormatConfirmation;
  delete element.invalidCode;
  delete element.codeValidationMessage;
  const reason = element.requiresInputReason;
  const keepContentConfirmation = reason === 'data-binding' || reason === 'sample-code';
  const empty = !String(element.value == null ? '' : element.value).trim();
  element.requiresInput = empty || keepContentConfirmation;
  if (empty) element.requiresInputReason = 'empty-code';
  else if (!keepContentConfirmation) delete element.requiresInputReason;
  return element;
}

function previewFrameHeight(documentValue, windowInfo) {
  const windowWidth = Number(windowInfo && windowInfo.windowWidth);
  const widthMm = Number(documentValue && documentValue.widthMm);
  const heightMm = Number(documentValue && documentValue.heightMm);
  if (!Number.isFinite(windowWidth) || windowWidth <= 0
    || !Number.isFinite(widthMm) || widthMm <= 0
    || !Number.isFinite(heightMm) || heightMm <= 0) {
    return 1;
  }
  const frameWidth = windowWidth * PREVIEW_WIDTH_RPX / 750;
  // Keep the unrounded ratio for CSS. Rounding to an integer pixel is visible
  // on narrow/tall labels and makes the two overlaid canvases drift at edges.
  return Number((frameWidth * heightMm / widthMm).toFixed(4));
}

function previewCanvasMetrics(documentValue, cssSize, pixelRatio) {
  const cssWidth = Number(cssSize && cssSize.width);
  const cssHeight = Number(cssSize && cssSize.height);
  const widthMm = Number(documentValue && documentValue.widthMm);
  const heightMm = Number(documentValue && documentValue.heightMm);
  const ratio = Number(pixelRatio);
  if (!Number.isFinite(cssWidth) || cssWidth <= 0
    || !Number.isFinite(cssHeight) || cssHeight <= 0
    || !Number.isFinite(widthMm) || widthMm <= 0
    || !Number.isFinite(heightMm) || heightMm <= 0) {
    throw new Error('预览画布尺寸无效');
  }
  const devicePixelRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const canvasSize = {
    width: Math.max(1, Math.round(cssWidth * devicePixelRatio)),
    height: Math.max(1, Math.round(cssHeight * devicePixelRatio))
  };
  return {
    canvasSize,
    devicePixelRatio,
    // Rendering uses a preview-only dot density derived from the measured CSS
    // width. Printing continues to use the printer profile's fixed 203 dpi.
    dpi: canvasSize.width * MILLIMETERS_PER_INCH / widthMm
  };
}

function placeholderPrintBlock(element) {
  if (!element) return null;
  if (element.type === 'text') {
    const value = String(element.text || '').trim();
    if (element.requiresInput === true || !value || value === '双击编辑'
      || value === '双击文本框编辑' || value === '点击后编辑文字') {
      return '请先编辑文字内容，当前仍是默认占位';
    }
  }
  if (element.type === 'barcode') {
    if (element.unsupportedCodeType === true || element.invalidCode === true) return null;
    const value = String(element.value || '').trim();
    if (element.requiresInput === true || !value || value === '0') return '请先填写并确认条码内容';
  }
  if (element.type === 'qrcode') {
    const value = String(element.value || '').trim();
    if (element.requiresInput === true || !value || value === 'https://example.com') return '请先填写并确认二维码内容';
  }
  return null;
}

function templateAttentionMessage(documentValue) {
  const meta = documentValue && documentValue.templateMeta;
  if (!meta) return '';
  const elements = Array.isArray(documentValue.elements) ? documentValue.elements : [];
  const liveUnsupported = elements.filter((element) => element.unsupportedCodeType === true).length;
  const liveInvalid = elements.filter((element) => element.invalidCode === true).length;
  const liveRequired = elements.filter((element) => element.requiresInput === true).length;
  const messages = [];
  if (Number(meta.missingImageCount) > 0) {
    messages.push(`源模板有 ${Number(meta.missingImageCount)} 张图片缺失，已跳过，请补图`);
  }
  if (meta.sizeClamped) {
    messages.push(`源尺寸 ${meta.sourceWidthMm}×${meta.sourceHeightMm} mm 超出编辑上限，当前副本为 ${documentValue.widthMm}×${documentValue.heightMm} mm`);
  }
  if (liveUnsupported > 0) {
    messages.push(`有 ${liveUnsupported} 个条码码制待确认`);
  }
  if (liveInvalid > 0) {
    messages.push(`有 ${liveInvalid} 个条码内容不符合声明码制`);
  }
  const otherRequired = Math.max(0, liveRequired - liveUnsupported - liveInvalid);
  if (otherRequired > 0) messages.push(`有 ${otherRequired} 个内容需要填写或确认`);
  return messages.join('；');
}

function previewAssetPath(value) {
  const path = String(value || '').trim();
  if (!path || /^(?:https?:\/\/|wxfile:\/\/|\/)/i.test(path)) return path;
  return `/${path.replace(/^\/+/, '')}`;
}

function materialOption(item) {
  return {
    id: item.id,
    label: item.label,
    previewSrc: previewAssetPath(item.asset),
    symbol: item.symbol || '',
    remote: item.source === 'remote-niim-material',
    vip: Boolean(item.vip)
  };
}

function borderOption(item) {
  return {
    id: item.id,
    label: item.label,
    previewSrc: previewAssetPath(item.previewSrc || item.asset),
    remote: item.source === 'remote-niim-border',
    vip: Boolean(item.vip)
  };
}

function friendlyPrintError(error) {
  const raw = String(error && error.message || '打印失败');
  if (/断开|disconnect|未连接|not connected|no connection/i.test(raw)) return '打印机连接已断开，请靠近后重新连接再试';
  if (/缺纸|no paper|paper/i.test(raw)) return '打印机缺纸或纸仓未合上，装好标签纸后重试';
  if (/上盖|纸仓盖|cover/i.test(raw)) return '打印机上盖未关闭，请合上纸仓盖后重试';
  if (/电量|电池|battery/i.test(raw)) return '打印机电量过低，请充电后重试';
  if (/过热|温度过高|overheat/i.test(raw)) return '打印头温度过高，请稍等片刻再打印';
  if (/正忙|busy|尚未完成当前任务/i.test(raw)) return '打印机正忙，请等待当前任务结束后重试';
  if (/位图宽度|超过打印头/.test(raw)) return '标签超过当前机型的打印幅面，请在打印设置中改用适配的尺寸或机型';
  if (/协议协商|协议尚未|handshake/i.test(raw)) return '打印机握手失败，请重启打印机后重新连接';
  if (/超时|timeout/i.test(raw)) return '打印机没有响应，请检查电源与纸仓后重试';
  if (/MTU|载荷|写入特征|通知特征|BLE 服务|writeBLE|readBLE|notifyBLE|BLECharacteristic|BLEConnection|GATT|characteristic/i.test(raw)) {
    return '蓝牙传输出现问题，请重新连接打印机后再试';
  }
  // Raw platform errors with no Chinese copy would otherwise reach the user
  // verbatim (e.g. "operateBLECharacteristic:fail").
  if (!/[\u4e00-\u9fff]/.test(raw)) return `打印失败（${raw}）`;
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
    loadError: '',
    saveState: '',
    previewHeightPx: 104,
    canvasInstanceId: '',
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
    materialOptions: MATERIAL_CATALOG.map(materialOption),
    borderOptions: BORDER_CATALOG.map(borderOption),
    remoteMaterialPage: 0,
    remoteMaterialTotal: 0,
    remoteMaterialHasMore: false,
    remoteMaterialLoading: false,
    remoteMaterialError: '',
    remoteMaterialStatusText: '仅使用商跃内置素材',
    materialAssetLoadingId: '',
    remoteBorderPage: 0,
    remoteBorderTotal: 0,
    remoteBorderHasMore: false,
    remoteBorderLoading: false,
    remoteBorderError: '',
    remoteBorderStatusText: '仅使用商跃程序化边框',
    borderAssetLoadingId: '',
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
    selectedFontFamily: 'sans-serif',
    fontCatalog: EDITOR_FONT_CATALOG,
    fontCatalogNote: EDITOR_FONT_CATALOG_NOTE,
    fontFallbackNote: '',
    templateAttentionMessage: '',
    shapeKindOptions: ['rect', 'rounded', 'circle', 'ellipse'],
    tableCellIndexes: [],
    safeTop: 24,
    menuSafeRightPx: 9
  },

  headerRightInset(windowInfo, menuRect) {
    const windowWidth = Number(windowInfo && windowInfo.windowWidth);
    const fallback = Number.isFinite(windowWidth) && windowWidth > 0
      ? Math.max(8, Math.round(windowWidth * 18 / 750))
      : 9;
    let rect = menuRect;
    if (!rect && wx.getMenuButtonBoundingClientRect) {
      try {
        rect = wx.getMenuButtonBoundingClientRect();
      } catch (_) {
        rect = null;
      }
    }
    const menuLeft = Number(rect && rect.left);
    if (!Number.isFinite(windowWidth) || windowWidth <= 0
      || !Number.isFinite(menuLeft) || menuLeft <= 0 || menuLeft >= windowWidth) {
      return fallback;
    }
    // End custom controls before the native WeChat capsule, with an 8 px gap.
    return Math.ceil(windowWidth - menuLeft + 8);
  },

  onLoad(options) {
    this.loadOptions = options;
    this.pageActive = true;
    this.canvasInstanceId = `preview-${Date.now().toString(36)}-${++previewCanvasInstanceSequence}`;
    this.remoteMaterials = [];
    this.remoteBorders = [];
    this.devicePickerGeneration = 0;
    this.printTaskGeneration = 0;
    const app = getApp();
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.repository = app && app.globalData && app.globalData.repository
      ? app.globalData.repository
      : new Repository(wx);
    this.editorSession = new EditorSession(this.repository);
    let settings;
    let state;
    try {
      this.repository.migrate();
      settings = this.repository.getSettings();
      state = this.editorSession.open(settings);
      this.loadTemplates();
    } catch (error) {
      this.setData({ loadError: error.message || '本地标签读取失败，请重试' });
      return;
    }
    this.setData({ loadError: '' });
    let storedProfileId = settings.defaultProfileId || 'd110';
    this.profile = getProfile(storedProfileId);
    this.profileConfirmed = true;
    this.projectId = state.projectId || '';
    this.dirtySinceSave = state.dirtySinceSave;
    this.document = state.document;
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
      safeTop: Number(info.safeArea && info.safeArea.top) || Number(info.statusBarHeight) || 24,
      menuSafeRightPx: this.headerRightInset(info)
    });
    this.syncPageData();
    if (options && options.devices === '1') {
      this.deviceOpenTimer = setTimeout(() => {
        if (this.pageActive) this.openDevices();
      }, 350);
    }
  },

  onReady() {
    if (!this.data.loadError) this.initCanvas();
  },

  retryEditorLoad() {
    this.onLoad(this.loadOptions);
    if (!this.data.loadError) this.initCanvas();
  },

  returnHome() {
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) });
  },

  async onUnload() {
    // A system navigation can unload the page before the focused input emits
    // blur. Persist the latest live preview so typed text is never discarded.
    const fieldCommitted = this.commitFieldEditDraft();
    if (!fieldCommitted && this.document && !this.discardedSession && !this.data.loadError) this.persistDocument();
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
    if (this.printJobService && this.printJobService.running) {
      await this.printJobService.cancel();
    } else if (this.printer && this.printer.printing) {
      await this.printer.cancel();
    }
    if (this.session && this.ownsSession) {
      await this.session.close();
    }
  },

  onHide() {
    if (this.document && !this.discardedSession && !this.data.loadError) {
      if (!this.commitFieldEditDraft()) this.persistDocument();
    }
    if (this.data.scanning) {
      this.devicePickerGeneration += 1;
      this.session.stopScan();
      this.setData({ showDevices: false, scanning: false });
    }
  },

  onResize() {
    clearTimeout(this.resizeTimer);
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ menuSafeRightPx: this.headerRightInset(info) });
    this.resizeTimer = setTimeout(() => {
      if (this.pageActive) this.syncPageData(() => this.initCanvas());
    }, 100);
  },

  persistDocument() {
    try {
      const session = this.editorSession || new EditorSession(this.repository);
      session.checkpoint(this.document, this.projectId, this.dirtySinceSave);
      this.setData({ saveState: this.projectId && !this.dirtySinceSave ? '已保存到标签' : '草稿已保存到本机' });
      return true;
    } catch (error) {
      this.setData({ saveState: '草稿保存失败，请勿退出，点此重试' });
      return false;
    }
  },

  loadTemplates() {
    const systemTemplates = catalogTemplates
      .filter((item) => item.publicCatalog === true && item.releaseApproved === true)
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: `${item.name} · 商跃原创`,
        document: buildTemplateDocument(item),
        source: item.source,
        approvalStatus: item.approvalStatus
      }));
    const userTemplates = this.repository.getUserTemplates().map((item) => Object.assign({ source: 'user' }, item));
    const templates = systemTemplates.concat(userTemplates);
    this.setData({
      templates,
      templateNames: templates.length ? templates.map((item) => item.displayName || item.name) : ['暂无模板']
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
    const selectedFont = selected
      ? fontFallbackInfo(selected.fontFamily, selected.sourceFontFamily)
      : { requested: '', renderFamily: 'sans-serif', fallback: false };
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const previewHeightPx = previewFrameHeight(this.document, windowInfo);
    const sizeIndex = SIZE_OPTIONS.findIndex((item) => {
      return item.width === this.document.widthMm && item.height === this.document.heightMm;
    });
    const documentView = cloneDocument(this.document);
    documentView.elements.forEach((item) => {
      item._selected = this.selectedIds.includes(item.id);
      item._typeLabel = elementTypeLabel(item.type);
    });
    this.setData({
      document: documentView,
      selected: selected ? Object.assign({}, selected) : null,
      selectedTypeLabel: selected ? elementTypeLabel(selected.type) : '',
      selectionCount: this.selectedIds.length,
      multiSelect: this.multiSelect,
      canvasInstanceId: this.canvasInstanceId || '',
      previewHeightPx,
      sizeIndex: sizeIndex >= 0 ? sizeIndex : 0,
      currentSizeLabel: `${this.document.widthMm} x ${this.document.heightMm} mm`,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      projectId: this.projectId || '',
      selectedDateValue: selected && selected.type === 'date' ? formatDateValue(selected) : '',
      selectedSerialValue: selected && selected.type === 'serial' ? serialValue(selected) : '',
      documentHasSerial: this.document.elements.some((item) => item.type === 'serial'),
      selectedLinkedValue: selected && selected.serialLinked ? linkedCodeValue(this.document, selected) : '',
      selectedFontFamily: selectedFont.renderFamily,
      fontFallbackNote: selectedFont.fallback
        ? `源字体“${selectedFont.requested}”未随模板提供，已用开源「${selectedFont.label}」稳定替代。请选择下方字体确认替换。`
        : '',
      templateAttentionMessage: templateAttentionMessage(this.document),
      tableCellIndexes: selected && selected.type === 'table'
        ? Array.from({ length: Math.max(1, Number(selected.rows) || 1) * Math.max(1, Number(selected.columns) || 1) }, (item, index) => index)
        : []
    }, callback);
  },

  initCanvas() {
    const generation = (this.canvasInitGeneration || 0) + 1;
    this.canvasInitGeneration = generation;
    this.setData({ canvasReady: false });
    const isCurrent = () => this.canvasInitGeneration === generation && this.pageActive !== false;
    const initialize = () => {
      if (!isCurrent()) return;
      wx.createSelectorQuery()
        .in(this)
        .select('#labelCanvas')
        .fields({ node: true, size: true })
        .select('#selectionCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          if (!isCurrent() || !result || !result[0] || !result[1]) {
            return;
          }
          try {
            const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
            const metrics = previewCanvasMetrics(this.document, {
              width: result[1].width,
              height: result[1].height
            }, windowInfo.pixelRatio);
            this.canvasSize = metrics.canvasSize;
            this.previewDpi = metrics.dpi;
            this.previewPixelRatio = metrics.devicePixelRatio;
          } catch (error) {
            this.context = null;
            this.selectionContext = null;
            this.canvasSize = null;
            this.previewDpi = 0;
            this.previewPixelRatio = 1;
            this.setData({ canvasReady: false });
            wx.showToast({ title: error.message, icon: 'none' });
            return;
          }
          this.canvas = result[0].node;
          this.selectionCanvas = result[1].node;
          // Touch events are bound to the selection canvas, so its measured CSS
          // box is the source of truth for px -> mm conversion.
          this.canvasRect = { width: result[1].width, height: result[1].height };
          [this.canvas, this.selectionCanvas].forEach((canvas) => {
            canvas.width = this.canvasSize.width;
            canvas.height = this.canvasSize.height;
          });
          this.context = this.canvas.getContext('2d');
          this.selectionContext = this.selectionCanvas.getContext('2d');
          const paintFirstFrame = () => {
            if (!isCurrent()) return;
            this.loadDocumentImages();
            this.renderAll();
            this.setData({ canvasReady: true });
          };
          if (typeof this.canvas.requestAnimationFrame === 'function') {
            this.canvas.requestAnimationFrame(paintFirstFrame);
          } else {
            paintFirstFrame();
          }
        });
    };
    // Native Canvas surfaces can retain the initial height until the view update
    // is flushed. Measure after that update, then draw on their first frame.
    if (typeof wx.nextTick === 'function') wx.nextTick(initialize);
    else initialize();
  },

  paintCanvases() {
    if (!this.context || !this.selectionContext || !this.previewDpi) {
      return;
    }
    renderDocument(this.context, this.document, this.canvasSize, this.previewDpi, this.images);
    const selection = this.selectedElements();
    renderSelection(
      this.selectionContext,
      selection.length > 1 ? selection : selection[0],
      this.canvasSize,
      this.previewDpi,
      this.snapGuides || [],
      this.previewPixelRatio || 1
    );
  },

  renderAll() {
    this.paintCanvases();
    this.refreshLoadedFonts();
  },

  refreshLoadedFonts() {
    if (this._fontRefreshInFlight || !this.document) return;
    this._fontRefreshInFlight = true;
    ensureDocumentFonts(this.document, fontRuntime()).then((result) => {
      this._fontRefreshInFlight = false;
      if (result && result.newlyLoaded) this.paintCanvases();
    }, () => {
      this._fontRefreshInFlight = false;
    });
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
    const required = this.document.elements.filter((item) => (
      (item.type === 'image' || item.type === 'material') && item.path
    ));
    if (!required.length) {
      return;
    }
    await Promise.all(this.loadDocumentImages());
    const missing = required.find((item) => !this.images[item.id]);
    if (missing) {
      throw new Error('标签中的图片或素材加载失败，请重新选择后再打印');
    }
  },

  recordSnapshot(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 30) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.dirtySinceSave = true;
  },

  commit(mutator, reinitializeCanvas) {
    const before = cloneDocument(this.document);
    mutator(this.document);
    syncLinkedCodes(this.document);
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
    this.dirtySinceSave = true;
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
    this.dirtySinceSave = true;
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
    this.pressBaseIds = (this.selectedIds || []).slice();
    const previous = this.selectedElement();
    let mode = 'move';
    let handleOriginal = null;
    if (!this.multiSelect && previous && !previous.locked) {
      mode = selectionHandleModeAtPoint(
        previous,
        point,
        this.document,
        this.canvasRect,
        'touch'
      );
      if (mode !== 'move') {
        handleOriginal = Object.assign({}, previous);
        if (previous._fit) fitElementToSelectionBounds(handleOriginal, previous._fit);
      }
    }
    // Handles extend outside the element's strict content bounds. Give the
    // already selected handle first refusal before normal z-order hit testing.
    const hitDecision = mode === 'move'
      ? selectionHitDecision(
        hitTestAll(
          this.document,
          point.x,
          point.y,
          selectionTargetSizeMm(this.document, this.canvasRect, 'touch')
        ),
        this.multiSelect || !previous ? '' : previous.id
      )
      : { element: previous, candidateIds: previous ? [previous.id] : [], cycleOnTap: false };
    const element = hitDecision.element;
    const touch = event.touches[0] || event.changedTouches[0] || {};
    this.selectionTapCycle = !this.multiSelect && mode === 'move' && hitDecision.cycleOnTap
      ? {
        candidateIds: hitDecision.candidateIds,
        selectedId: previous.id,
        startClientX: Number(touch.x) || 0,
        startClientY: Number(touch.y) || 0,
        moved: false
      }
      : null;
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
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation
    })) : [];
    const gestureOriginal = handleOriginal || element;
    this.drag = element && !element.locked && (!group || groupOriginals.length) ? {
      before: cloneDocument(this.document),
      startX: point.x,
      startY: point.y,
      originalX: element.x,
      originalY: element.y,
      original: Object.assign({}, gestureOriginal),
      promotedFit: Boolean(handleOriginal && previous && previous._fit),
      mode: group ? 'group' : mode,
      groupOriginals,
      startClientX: Number(touch.x) || 0,
      startClientY: Number(touch.y) || 0,
      passedDeadzone: !['move', 'group'].includes(group ? 'group' : mode),
      startAngle: pointerAngle(point, {
        x: gestureOriginal.x + gestureOriginal.width / 2,
        y: gestureOriginal.y + gestureOriginal.height / 2
      }),
      moved: false
    } : null;
    this.syncPageData(() => this.renderAll());
  },

  onCanvasTouchMove(event) {
    if (this.selectionTapCycle) {
      const touch = event.touches[0] || event.changedTouches[0] || {};
      const distance = Math.hypot(
        (Number(touch.x) || 0) - this.selectionTapCycle.startClientX,
        (Number(touch.y) || 0) - this.selectionTapCycle.startClientY
      );
      if (distance >= 8) this.selectionTapCycle.moved = true;
    }
    if (!this.drag) {
      return;
    }
    const point = this.touchPoint(event);
    const element = this.selectedElement();
    if (!element) {
      return;
    }
    if (!this.drag.passedDeadzone && ['move', 'group'].includes(this.drag.mode)) {
      const touch = event.touches[0] || event.changedTouches[0] || {};
      const distance = Math.hypot(
        (Number(touch.x) || 0) - this.drag.startClientX,
        (Number(touch.y) || 0) - this.drag.startClientY
      );
      if (distance < 8) return;
      this.drag.passedDeadzone = true;
    }
    const delta = { x: point.x - this.drag.startX, y: point.y - this.drag.startY };
    if (this.drag.mode === 'group') {
      const groupDelta = clampGroupDelta(this.drag.groupOriginals, this.document, delta);
      this.drag.groupOriginals.forEach((original) => {
        const item = this.document.elements.find((candidate) => candidate.id === original.id);
        if (!item) return;
        item.x = original.x + groupDelta.x;
        item.y = original.y + groupDelta.y;
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
      if (this.drag.promotedFit) {
        Object.assign(element, {
          x: this.drag.original.x,
          y: this.drag.original.y,
          width: this.drag.original.width,
          height: this.drag.original.height,
          selectionFit: false
        });
      }
      element.rotation = (this.drag.original.rotation
        + normalizeAngleDelta(nextAngle - this.drag.startAngle) + 360) % 360;
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
    const cycle = this.selectionTapCycle;
    const shouldCycle = cycle && !cycle.moved && !(this.drag && this.drag.moved);
    let cycled = false;
    if (this.drag && this.drag.moved) {
      this.recordSnapshot(this.drag.before);
      this.persistDocument();
      this.syncPageData(() => this.renderAll());
    }
    if (shouldCycle) {
      const nextId = nextSelectionId(cycle.candidateIds, cycle.selectedId);
      if (nextId) {
        this.setSelection([nextId], false);
        cycled = true;
      }
    }
    this.drag = null;
    this.selectionTapCycle = null;
    this.pressBaseIds = [];
    this.snapGuides = [];
    if (cycled) this.syncPageData(() => this.renderAll());
    else this.renderAll();
  },

  addElement(event) {
    const type = event.currentTarget.dataset.type;
    if (type === 'image') {
      this.chooseImage();
      return;
    }
    if (type === 'material') {
      this.replaceMaterial = false;
      this.setData({ showMaterialSheet: true }, () => this.ensureRemoteMaterialCatalog());
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

  startFieldEdit(event) {
    const field = event.currentTarget.dataset.field;
    const element = this.selectedElement();
    if (!isLiveStringField(element, field)) {
      this.fieldEditDraft = null;
      return;
    }
    this.fieldEditDraft = {
      elementId: element.id,
      field,
      before: cloneDocument(this.document)
    };
  },

  previewField(event) {
    const field = event.currentTarget.dataset.field;
    const draft = this.fieldEditDraft;
    if (!draft || draft.field !== field) return;
    const element = this.document.elements.find((item) => item.id === draft.elementId);
    if (!isLiveStringField(element, field)) return;
    element[field] = String(event.detail.value == null ? '' : event.detail.value);
    updateInputConfirmationAfterEdit(element, field);
    if (this.selectedId === element.id) {
      const patch = { selected: Object.assign({}, element) };
      if (element.type === 'serial') patch.selectedSerialValue = serialValue(element);
      this.setData(patch);
    }
    this.renderAll();
  },

  commitFieldEditDraft() {
    const draft = this.fieldEditDraft;
    if (!draft) return false;
    this.fieldEditDraft = null;
    const element = this.document && this.document.elements.find((item) => item.id === draft.elementId);
    const beforeElement = draft.before && draft.before.elements.find((item) => item.id === draft.elementId);
    if (!isLiveStringField(element, draft.field) || !beforeElement) return false;
    const beforeValue = String(beforeElement[draft.field] == null ? '' : beforeElement[draft.field]);
    const value = String(element[draft.field] == null ? '' : element[draft.field]);
    if (beforeValue === value) return false;
    this.recordSnapshot(draft.before);
    this.persistDocument();
    return true;
  },

  finishFieldEdit(event) {
    const field = event.currentTarget.dataset.field;
    const draft = this.fieldEditDraft;
    if (!draft || draft.field !== field) {
      this.updateField(event);
      return;
    }
    const element = this.document.elements.find((item) => item.id === draft.elementId);
    const beforeElement = draft.before.elements.find((item) => item.id === draft.elementId);
    if (!isLiveStringField(element, field) || !beforeElement) {
      this.fieldEditDraft = null;
      return;
    }

    const value = String(event.detail.value == null ? '' : event.detail.value);
    element[field] = value;
    updateInputConfirmationAfterEdit(element, field);
    this.commitFieldEditDraft();
    this.syncPageData(() => this.renderAll());
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
        updateInputConfirmationAfterEdit(selected, field);
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

  setFontFamily(event) {
    const value = resolveFontId(event.currentTarget.dataset.value || 'sans-serif');
    this.commit(() => {
      const selected = this.selectedElement();
      if (!selected || selected.locked) return;
      selected.fontFamily = value;
      delete selected.sourceFontFamily;
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
        updateInputConfirmationAfterEdit(current, 'value');
      });
      if (!this.offerReadableCodeSize(selected.id)) {
        wx.showToast({ title: selected.type === 'barcode' ? '条码已填入' : '二维码已填入', icon: 'success' });
      }
    } catch (error) {
      if (error && error.code === 'SCAN_CANCELLED') return;
      showScanFailure(wx, error, { title: '无法填入扫码内容', retry: () => this.scanSelectedCode() });
    } finally {
      this.codeScanInFlight = false;
      this.setData({ codeScanning: false });
    }
  },

  // After a scan fills a code, flag a size that would print unreadably now
  // instead of at print preflight. Returns true when a dialog was shown.
  offerReadableCodeSize(elementId) {
    const dpi = this.profile && this.profile.dpi;
    const probeDocument = cloneDocument(this.document);
    const probeElement = probeDocument.elements.find((item) => item.id === elementId);
    if (!dpi || !probeElement) return false;
    let probe;
    try {
      probe = resizeCodeElementToMinimum(probeElement, probeDocument, dpi);
    } catch (error) {
      return false;
    }
    if (probe.ok && !probe.changed) return false;
    const label = probeElement.type === 'qrcode' ? '二维码' : '条码';
    const needed = `${label}需要约 ${probe.metrics.minimumMmRounded.toFixed(1)} mm`;
    if (!probe.ok) {
      wx.showModal({
        title: `${label}已填入`,
        content: `内容较长，按当前尺寸打印可能扫不出；${needed}，当前标签放不下。请换更大的标签纸${probeElement.type === 'barcode' ? '，或改用二维码' : ''}。`,
        showCancel: false,
        confirmText: '知道了'
      });
      return true;
    }
    wx.showModal({
      title: `${label}已填入`,
      content: `内容较长，按当前尺寸打印可能扫不出。放大到可清晰打印的尺寸吗？（${needed}）`,
      confirmText: '放大',
      cancelText: '暂不',
      confirmColor: '#E02D26',
      success: (result) => {
        if (result && result.confirm) this.resizeCodeToMinimum(elementId);
      }
    });
    return true;
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
      if (selected) {
        if (field === 'format' && selected.type === 'barcode') confirmBarcodeFormat(selected, value);
        else selected[field] = value;
      }
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
    this.setData({ showMaterialSheet: true }, () => this.ensureRemoteMaterialCatalog());
  },
  closeMaterialSheet() { this.setData({ showMaterialSheet: false }); },
  openBorderSheet() {
    this.setData({ showBorderSheet: true }, () => this.ensureRemoteBorderCatalog());
  },
  closeBorderSheet() { this.setData({ showBorderSheet: false }); },

  ensureRemoteMaterialCatalog() {
    return Promise.resolve();
  },

  loadMoreRemoteMaterials() {
    return Promise.resolve();
  },

  ensureRemoteBorderCatalog() {
    return Promise.resolve();
  },

  loadMoreRemoteBorders() {
    return Promise.resolve();
  },

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
    this.selectionTapCycle = null;
    const point = this.touchPoint(event);
    const element = hitTest(
      this.document,
      point.x,
      point.y,
      selectionTargetSizeMm(this.document, this.canvasRect, 'touch')
    );
    const decision = longPressSelection(this.pressBaseIds || [], element && element.id);
    if (!decision.enterMulti) return;
    this.drag = null;
    this.setSelection(decision.ids, true);
    this.syncPageData(() => this.renderAll());
    wx.showToast({ title: `已选择 ${decision.ids.length} 个元素`, icon: 'none' });
  },

  async pickMaterial(event) {
    const id = event.currentTarget.dataset.id;
    const material = MATERIAL_CATALOG.find((item) => item.id === id)
      || (this.remoteMaterials || []).find((item) => item.id === id);
    if (!material) return;
    let asset = material.asset || '';
    if (material.source === 'remote-niim-material') {
      if (this.data.materialAssetLoadingId) return;
      this.setData({ materialAssetLoadingId: material.id });
      try {
        asset = await localizeUrl(wx, material.asset);
      } catch (error) {
        wx.showModal({ title: '素材图片加载失败', content: error.message || '请检查网络后重试', showCancel: false });
        return;
      } finally {
        if (this.pageActive) this.setData({ materialAssetLoadingId: '' });
      }
      if (!this.pageActive) return;
    }
    this.commit((document) => {
      let element = this.replaceMaterial && this.selectedElement();
      if (!element || element.type !== 'material') {
        element = createElement('material', document);
        document.elements.push(element);
        this.setSelection([element.id], false);
      }
      element.materialId = material.id;
      element.label = material.label;
      element.path = asset;
      element.symbol = material.symbol || (asset ? element.symbol : material.id);
      if (material.sourceUrl) element.sourceUrl = material.sourceUrl;
      this.invalidateImage(element.id);
    });
    this.replaceMaterial = false;
    this.setData({ showMaterialSheet: false, editorPanelTab: 'elements' });
  },

  async pickBorder(event) {
    const id = event.currentTarget.dataset.id;
    const border = BORDER_CATALOG.find((item) => item.id === id)
      || (this.remoteBorders || []).find((item) => item.id === id);
    if (!border) return;
    if (border.source === 'remote-niim-border') {
      if (this.data.borderAssetLoadingId) return;
      this.setData({ borderAssetLoadingId: border.id });
      let asset;
      try {
        asset = await localizeUrl(wx, border.asset);
      } catch (error) {
        wx.showModal({ title: '边框图片加载失败', content: error.message || '请检查网络后重试', showCancel: false });
        return;
      } finally {
        if (this.pageActive) this.setData({ borderAssetLoadingId: '' });
      }
      if (!this.pageActive) return;
      const selectedProgrammaticBorderId = this.selectedId;
      this.commit((document) => {
        let element = document.elements.find((item) => item.type === 'image' && item.onlineBorderId);
        if (!element) element = createElement('image', document);
        document.elements = document.elements.filter((item) => !(
          item.type === 'rect'
          && item.borderStyle
          && (item.decorativeBorder || item.id === selectedProgrammaticBorderId)
        ));
        element.x = 0;
        element.y = 0;
        element.width = document.widthMm;
        element.height = document.heightMm;
        element.rotation = 0;
        // Online borders are full-canvas background layers. Lock them by
        // default so a normal content drag cannot shift the frame by mistake;
        // the inspector still exposes an explicit unlock action.
        element.locked = true;
        element.path = asset;
        element.threshold = 180;
        element.onlineBorderId = border.id;
        element.label = border.label;
        element.ninePatch = border.ninePatch || null;
        if (border.sourceUrl) element.sourceUrl = border.sourceUrl;
        document.elements = document.elements.filter((item) => item.id !== element.id);
        document.elements.unshift(element);
        this.invalidateImage(element.id);
        this.setSelection([element.id], false);
      });
      this.setData({ showBorderSheet: false, editorPanelTab: 'elements' });
      return;
    }
    this.commit((document) => {
      document.elements = document.elements.filter((item) => !(item.type === 'image' && item.onlineBorderId));
      let element = this.selectedElement();
      if (!element || element.type !== 'rect') {
        element = createElement('rect', document);
        document.elements.push(element);
        this.setSelection([element.id], false);
      }
      element.borderStyle = border.id;
      element.decorativeBorder = true;
    });
    this.setData({ showBorderSheet: false, editorPanelTab: 'elements' });
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
    if (!Number.isFinite(value) || value < 5 || value > 500) {
      wx.showToast({ title: '标签尺寸须在 5-500 mm', icon: 'none' });
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

  setCopiesInput(event) {
    const rawText = String(event.detail.value == null ? '' : event.detail.value).trim();
    const value = Math.round(Number(rawText));
    this.setData({
      copies: rawText && Number.isFinite(value)
        ? Math.max(1, Math.min(99, value))
        : this.data.copies
    });
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

  saveProjectSilently() {
    this.commitFieldEditDraft();
    try {
      const isNew = !this.projectId;
      const project = this.repository.saveEditorProject(this.document, this.projectId);
      this.projectId = project.id;
      this.dirtySinceSave = false;
      this.setData({ projectId: project.id, saveState: '已保存到标签' });
      return { ok: true, isNew };
    } catch (error) {
      wx.showModal({ title: '保存失败', content: error.message, showCancel: false });
      return { ok: false, isNew: false };
    }
  },

  saveProject() {
    const result = this.saveProjectSilently();
    if (!result.ok) return;
    if (result.isNew) wx.showToast({ title: '已保存到「标签」页', icon: 'none' });
    else wx.showToast({ title: '已保存', icon: 'success' });
  },

  exitEditor() {
    if (this.dirtySinceSave && !this.discardedSession && !this.persistDocument()) return;
    this.returnHome();
  },

  closeEditor() {
    // Leaving without an explicit save must never silently drop edits made to
    // an existing project (autosave only survives until the next editor open).
    this.commitFieldEditDraft();
    if (this.data.printing) {
      wx.showToast({ title: '请先取消打印，再退出编辑器', icon: 'none' });
      return;
    }
    if (!this.dirtySinceSave) {
      this.exitEditor();
      return;
    }
    wx.showActionSheet({
      alertText: '标签有未保存的修改',
      itemList: ['保存并退出', '保留草稿退出', '放弃修改退出'],
      success: (result) => {
        if (result.tapIndex === 0) {
          const saved = this.saveProjectSilently();
          if (saved.ok) this.exitEditor();
        } else if (result.tapIndex === 1) {
          this.exitEditor();
        } else if (result.tapIndex === 2) {
          try {
            this.editorSession.discard();
            this.discardedSession = true;
            this.dirtySinceSave = false;
            this.exitEditor();
          } catch (error) {
            wx.showModal({ title: '无法放弃草稿', content: error.message, showCancel: false });
          }
        }
      }
    });
  },

  openDataManager() {
    try {
      wx.setStorageSync(KEYS.pendingHomeRoute, 'data');
    } catch (error) {
      // Falling back to the plain home route is acceptable.
    }
    this.closeEditor();
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
    this.returnToPrintAfterConnect = false;
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
      if (this.returnToPrintAfterConnect) {
        this.returnToPrintAfterConnect = false;
        this.openPrintSheet();
      }
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

  evaluatePrintBlock(documentValue = this.document, profile = this.profile) {
    if (!this.profileConfirmed) {
      return { kind: 'model', message: '请先确认准确的打印机型号，再开始打印。', suggestProfileId: '' };
    }
    if (!documentValue.elements.length) {
      return { kind: 'empty', message: '请先添加至少一个标签元素。', suggestProfileId: '' };
    }
    for (let index = 0; index < documentValue.elements.length; index += 1) {
      const element = documentValue.elements[index];
      const message = placeholderPrintBlock(element);
      if (message) {
        return {
          kind: 'placeholder',
          message,
          elementId: element.id,
          canConfirmOriginal: element.requiresInputReason === 'sample-code',
          suggestProfileId: ''
        };
      }
    }
    const fit = evaluatePrintability(documentValue, profile);
    if (!fit.ok) return { kind: 'size', message: fit.message, suggestProfileId: fit.suggestProfileId || '' };
    try {
      validateDocument(documentValue, profile.dpi);
    } catch (error) {
      return {
        kind: 'element',
        message: error.message,
        elementId: error.elementId || '',
        elementType: error.elementType || '',
        errorCode: error.code || '',
        suggestProfileId: ''
      };
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
    this.commitFieldEditDraft();
    this.refreshPrintBlock();
    const patch = { showPrintSheet: true };
    if (!this.data.printing) {
      patch.printProgress = 0;
      patch.printMessage = '';
    }
    this.setData(patch);
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

  focusPrintElement() {
    const elementId = this.data.printBlock && this.data.printBlock.elementId;
    if (!elementId || !this.document.elements.some((item) => item.id === elementId)) return;
    this.setSelection([elementId], false);
    this.setData({ showPrintSheet: false });
    this.syncPageData(() => this.renderAll());
  },

  confirmPrintElementValue() {
    const elementId = this.data.printBlock && this.data.printBlock.elementId;
    const element = this.document.elements.find((item) => item.id === elementId);
    if (!element || element.requiresInputReason !== 'sample-code') return;
    this.commit((documentValue) => {
      const current = documentValue.elements.find((item) => item.id === elementId);
      if (!current || current.requiresInputReason !== 'sample-code') return;
      current.requiresInput = false;
      delete current.requiresInputReason;
      current.sampleValueConfirmed = true;
    });
    this.refreshPrintBlock();
    wx.showToast({ title: '已确认使用当前编码', icon: 'success' });
  },

  fixCodeSize() {
    const elementId = this.data.printBlock && this.data.printBlock.elementId;
    this.resizeCodeToMinimum(elementId, { closePrintSheet: true });
  },

  resizeCodeToMinimum(elementId, options) {
    const probeDocument = cloneDocument(this.document);
    const probeElement = probeDocument.elements.find((item) => item.id === elementId);
    if (!probeElement) return;
    let probe;
    try {
      probe = resizeCodeElementToMinimum(probeElement, probeDocument, this.profile.dpi);
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none', duration: 2800 });
      return;
    }
    if (!probe.ok) {
      wx.showToast({ title: probe.message, icon: 'none', duration: 3200 });
      return;
    }
    this.setSelection([elementId], false);
    if (options && options.closePrintSheet) this.setData({ showPrintSheet: false });
    this.commit((documentValue) => {
      const element = documentValue.elements.find((item) => item.id === elementId);
      resizeCodeElementToMinimum(element, documentValue, this.profile.dpi);
    });
    wx.showToast({
      title: probe.changed ? '已放大，请检查排版' : '尺寸已满足要求',
      icon: 'none'
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

  async preparePrintImages(documentValue) {
    const images = {};
    await Promise.all(documentValue.elements.filter((element) => (
      (element.type === 'image' || element.type === 'material') && element.path
    )).map((element) => new Promise((resolve, reject) => {
      const image = this.canvas.createImage();
      const timer = setTimeout(() => reject(new Error('标签图片加载超时，请重新选择图片后重试')), 15000);
      image.onload = () => { clearTimeout(timer); images[element.id] = image; resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('标签图片加载失败，请重新选择图片后重试')); };
      image.src = this.resolveImagePath(element.path);
    })));
    return images;
  },

  createPrintImageData(documentValue, profile = this.profile, images = this.images) {
    const size = alignedCanvasSize(documentValue, profile);
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
    renderDocument(context, documentValue, size, profile.dpi, images);
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
    this.commitFieldEditDraft();
    if (!this.context || !this.canvasSize || !this.data.canvasReady) {
      wx.showToast({ title: '画布尚未就绪', icon: 'none' });
      return;
    }
    const savedDevice = this.connectionManager && this.connectionManager.getSavedDevice
      ? this.connectionManager.getSavedDevice()
      : null;
    if (this.connectionManager && !savedDevice) {
      this.returnToPrintAfterConnect = true;
      this.setData({ showPrintSheet: false });
      this.openDevices();
      return;
    }
    if (!this.connectionManager && !this.session.connected) {
      this.returnToPrintAfterConnect = true;
      this.setData({ showPrintSheet: false });
      this.openDevices();
      return;
    }
    // Model/size preflight is definitive only after the selected device has
    // been checked below. Never prevent first-time device selection with a
    // remembered or default profile.

    const taskGeneration = (this.printTaskGeneration || 0) + 1;
    this.printTaskGeneration = taskGeneration;
    this.printCancelRequested = false;
    this.setData({ printing: true, printProgress: 2, printMessage: '正在确认打印机连接', printError: '' });
    let blockedAfterConnect = false;
    const projectId = this.projectId || '';
    const requestedDocument = cloneDocument(this.document);
    let printImages = {};
    this.printJobService = this.printJobService || new PrintJobService({ printer: this.printer });
    try {
      const completed = await this.printJobService.run({
        document: requestedDocument,
        profile: this.profile,
        options: {
          copies: this.data.copies,
          density: this.data.density,
          threshold: this.data.threshold,
          labelType: this.data.labelTypeIndex + 1
        },
        prepare: async (snapshot, controls) => {
          if (this.connectionManager) {
            const result = await this.connectionManager.ensureReady(savedDevice);
            controls.assertActive();
            this.assertPrintActive(taskGeneration);
            this.applyConnectionResult(result);
          }
          this.assertPrintActive(taskGeneration);
          const profile = Object.assign({}, this.profile);
          const block = this.evaluatePrintBlock(snapshot.document, profile);
          if (block) {
            blockedAfterConnect = true;
            const suggested = block.suggestProfileId ? getProfile(block.suggestProfileId) : null;
            this.setData({ printBlock: block, suggestedProfileName: suggested ? suggested.name : '' });
            const error = new Error(block.message);
            error.code = 'PRINT_PREFLIGHT_BLOCKED';
            throw error;
          }
          this.setData({ printProgress: 5, printMessage: '正在生成打印点阵' });
          await ensureDocumentFonts(snapshot.document, fontRuntime());
          controls.assertActive();
          printImages = await this.preparePrintImages(snapshot.document);
          this.assertPrintActive(taskGeneration);
          return { profile };
        },
        render: (documentValue, profile) => {
          this.assertPrintActive(taskGeneration);
          validateDocument(documentValue, profile.dpi);
          return this.createPrintImageData(documentValue, profile, printImages);
        },
        onProgress: (progress, message) => {
          if (!this.pageActive || taskGeneration !== this.printTaskGeneration) return;
          this.setData({ printProgress: progress, printMessage: message });
        }
      });
      if (this.connectionManager) this.connectionManager.touch(savedDevice);
      const historySaved = this.recordPrintSafely({
        name: completed.document.name,
        projectId,
        result: 'success',
        message: `已完成 ${completed.completedCopies} 份`,
        profileId: completed.profile.id,
        deviceName: this.data.connectedDevice,
        document: completed.document
      });
      if (this.pageActive && taskGeneration === this.printTaskGeneration) {
        this.setData({ printProgress: 100, printMessage: '打印完成', printError: '' });
        wx.showToast({
          title: historySaved ? '打印完成' : '打印完成，历史未保存',
          icon: historySaved ? 'success' : 'none'
        });
      }
    } catch (error) {
      if (blockedAfterConnect) return;
      const cancelled = this.printCancelRequested || !this.pageActive
        || taskGeneration !== this.printTaskGeneration
        || /已取消/.test(String(error && error.message || ''));
      const job = error.printJob;
      const paperNotice = job && job.possiblyPrinted
        ? `已确认完成 ${job.completedCopies}/${job.totalCopies} 份，可能仍有标签出纸。请核对实物后再打印，避免重复。`
        : '';
      const message = [cancelled ? '' : friendlyPrintError(error), paperNotice].filter(Boolean).join('；');
      this.recordPrintSafely({
        name: requestedDocument.name,
        projectId,
        result: cancelled ? 'cancelled' : 'failed',
        message: [error && error.message || '打印失败', paperNotice].filter(Boolean).join('；'),
        profileId: job ? job.profile.id : this.profile.id,
        deviceName: this.data.connectedDevice,
        document: job ? job.document : requestedDocument
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
      if (this.printJobService) await this.printJobService.cancel();
      else await this.printer.cancel();
    } catch (error) {
      // PrinterClient will surface the original task result to startPrint.
    }
  }
});
