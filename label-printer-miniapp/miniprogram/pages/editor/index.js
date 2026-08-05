const { BleSession } = require('../../services/ble-session');
const { PrinterClient } = require('../../services/printer-client');
const {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  hitTest
} = require('../../core/document');
const { alignedCanvasSize, getProfile, profileForModelId, PROFILES } = require('../../core/profiles');
const { renderDocument, renderSelection, validateDocument } = require('../../core/renderer');

const STORAGE_DOCUMENT = 'label-printer:last-document';
const STORAGE_TEMPLATES = 'label-printer:templates';
const STORAGE_PROFILE = 'label-printer:profile';
const SIZE_OPTIONS = [
  { label: '30 x 12 mm', width: 30, height: 12 },
  { label: '40 x 12 mm', width: 40, height: 12 },
  { label: '50 x 12 mm', width: 50, height: 12 },
  { label: '30 x 20 mm', width: 30, height: 20 },
  { label: '40 x 30 mm', width: 40, height: 30 },
  { label: '50 x 30 mm', width: 50, height: 30 },
  { label: '50 x 40 mm', width: 50, height: 40 }
];

Page({
  data: {
    profileOptions: PROFILES.map((item) => item.name),
    profileIndex: 0,
    sizeOptions: SIZE_OPTIONS.map((item) => item.label),
    sizeIndex: 1,
    labelTypeOptions: ['间隙纸', '连续纸'],
    barcodeFormatOptions: ['EAN-13', 'Code 128'],
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
    canUndo: false,
    canRedo: false,
    templates: [],
    templateNames: [],
    showDevices: false,
    scanning: false,
    devices: [],
    connectionState: 'disconnected',
    connectionLabel: '未连接',
    connectedDevice: '',
    connectedMtu: 0,
    connectedDetails: '',
    printing: false,
    printProgress: 0,
    printMessage: ''
  },

  onLoad() {
    let storedProfileId = 'd110';
    try {
      storedProfileId = wx.getStorageSync(STORAGE_PROFILE) || 'd110';
    } catch (error) {
      storedProfileId = 'd110';
    }
    this.profile = getProfile(storedProfileId);
    this.profileConfirmed = true;
    this.document = this.loadLastDocument() || createDocument(40, 12);
    if (this.ensureDocumentFitsProfile(this.document, this.profile)) {
      this.persistDocument();
    }
    this.selectedId = this.document.elements.length ? this.document.elements[0].id : '';
    this.undoStack = [];
    this.redoStack = [];
    this.images = {};
    this.imageLoadPromises = {};
    this.session = new BleSession(wx);
    this.printer = new PrinterClient(this.session);
    this.removeConnectionListener = this.session.onConnectionStateChange(() => {
      this.setDisconnectedState();
      wx.showToast({ title: '打印机连接已断开', icon: 'none' });
    });
    const profileIndex = PROFILES.findIndex((item) => item.id === this.profile.id);
    this.setData({
      profileIndex,
      density: this.profile.densityDefault,
      densityMin: this.profile.densityMin,
      densityMax: this.profile.densityMax
    });
    this.loadTemplates();
    this.syncPageData();
  },

  onReady() {
    this.initCanvas();
  },

  async onUnload() {
    if (this.printer && this.printer.printing) {
      await this.printer.cancel();
    }
    if (this.session) {
      await this.session.close();
    }
    if (this.removeConnectionListener) {
      this.removeConnectionListener();
    }
  },

  onHide() {
    if (this.data.scanning) {
      this.session.stopScan();
      this.setData({ scanning: false });
    }
  },

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.syncPageData(() => this.initCanvas()), 100);
  },

  ensureDocumentFitsProfile(document, profile) {
    try {
      alignedCanvasSize(document, profile);
      return false;
    } catch (error) {
      document.widthMm = profile.defaultSize[0];
      document.heightMm = profile.defaultSize[1];
      document.elements.forEach((item) => clampElement(item, document));
      return true;
    }
  },

  loadLastDocument() {
    try {
      const stored = wx.getStorageSync(STORAGE_DOCUMENT);
      if (stored && stored.schemaVersion === 1 && Array.isArray(stored.elements)) {
        return stored;
      }
    } catch (error) {
      // A fresh document is used when local storage is unavailable.
    }
    return null;
  },

  persistDocument() {
    try {
      wx.setStorageSync(STORAGE_DOCUMENT, this.document);
    } catch (error) {
      wx.showToast({ title: '本地保存失败', icon: 'none' });
    }
  },

  loadTemplates() {
    let templates = [];
    try {
      const stored = wx.getStorageSync(STORAGE_TEMPLATES);
      templates = Array.isArray(stored) ? stored : [];
    } catch (error) {
      templates = [];
    }
    this.setData({
      templates,
      templateNames: templates.length ? templates.map((item) => item.name) : ['暂无模板']
    });
  },

  selectedElement() {
    return this.document.elements.find((item) => item.id === this.selectedId) || null;
  },

  syncPageData(callback) {
    const selected = this.selectedElement();
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const frameWidth = windowInfo.windowWidth * 672 / 750;
    const previewHeightPx = Math.round(frameWidth * this.document.heightMm / this.document.widthMm);
    const sizeIndex = SIZE_OPTIONS.findIndex((item) => {
      return item.width === this.document.widthMm && item.height === this.document.heightMm;
    });
    this.setData({
      document: cloneDocument(this.document),
      selected: selected ? Object.assign({}, selected) : null,
      previewHeightPx,
      sizeIndex: sizeIndex >= 0 ? sizeIndex : 0,
      currentSizeLabel: `${this.document.widthMm} x ${this.document.heightMm} mm`,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0
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
          this.canvasSize = alignedCanvasSize(this.document, this.profile);
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
    renderSelection(this.selectionContext, this.selectedElement(), this.canvasSize, this.profile.dpi);
  },

  loadDocumentImages() {
    if (!this.canvas) {
      return [];
    }
    const pending = [];
    this.document.elements.filter((item) => item.type === 'image' && item.path).forEach((element) => {
      if (this.images[element.id]) {
        return;
      }
      if (!this.imageLoadPromises[element.id]) {
        this.imageLoadPromises[element.id] = new Promise((resolve) => {
          const image = this.canvas.createImage();
          image.onload = () => {
            this.images[element.id] = image;
            this.renderAll();
            resolve(true);
          };
          image.onerror = () => {
            delete this.images[element.id];
            delete this.imageLoadPromises[element.id];
            resolve(false);
          };
          image.src = element.path;
        });
      }
      pending.push(this.imageLoadPromises[element.id]);
    });
    return pending;
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
    this.selectedId = '';
    this.persistDocument();
    this.syncPageData(() => this.initCanvas());
  },

  redo() {
    if (!this.redoStack.length) {
      return;
    }
    this.undoStack.push(cloneDocument(this.document));
    this.document = this.redoStack.pop();
    this.selectedId = '';
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
    this.selectedId = element ? element.id : '';
    this.drag = element ? {
      before: cloneDocument(this.document),
      startX: point.x,
      startY: point.y,
      originalX: element.x,
      originalY: element.y,
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
    element.x = this.drag.originalX + point.x - this.drag.startX;
    element.y = this.drag.originalY + point.y - this.drag.startY;
    clampElement(element, this.document);
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
  },

  addElement(event) {
    const type = event.currentTarget.dataset.type;
    if (type === 'image') {
      this.chooseImage();
      return;
    }
    this.commit((document) => {
      const element = createElement(type, document);
      document.elements.push(element);
      this.selectedId = element.id;
    });
  },

  chooseImage() {
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
              const element = createElement('image', document);
              element.path = destination;
              document.elements.push(element);
              this.selectedId = element.id;
            });
          },
          fail: () => wx.showToast({ title: '图片保存失败', icon: 'none' })
        });
      }
    });
  },

  deleteSelected() {
    if (!this.selectedId) {
      return;
    }
    const deletedId = this.selectedId;
    this.commit((document) => {
      document.elements = document.elements.filter((item) => item.id !== deletedId);
      delete this.images[deletedId];
      delete this.imageLoadPromises[deletedId];
      this.selectedId = '';
    });
  },

  duplicateSelected() {
    const selected = this.selectedElement();
    if (!selected) {
      return;
    }
    this.commit((document) => {
      const duplicate = JSON.parse(JSON.stringify(selected));
      duplicate.id = `${selected.type}-${Date.now().toString(36)}`;
      duplicate.x = Math.min(document.widthMm - duplicate.width, duplicate.x + 1);
      duplicate.y = Math.min(document.heightMm - duplicate.height, duplicate.y + 1);
      document.elements.push(duplicate);
      this.selectedId = duplicate.id;
      if (this.images[selected.id]) {
        this.images[duplicate.id] = this.images[selected.id];
      }
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
    const numeric = ['x', 'y', 'width', 'height', 'fontSize', 'lineWidth', 'rotation'];
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

  updateBarcodeFormat(event) {
    const format = Number(event.detail.value) === 0 ? 'ean13' : 'code128';
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected && selected.type === 'barcode') {
        selected.format = format;
        selected.value = format === 'ean13' ? '6901234567892' : 'LABEL-001';
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
    wx.setStorageSync(STORAGE_PROFILE, profile.id);
    let width = this.document.widthMm;
    let height = this.document.heightMm;
    try {
      alignedCanvasSize(this.document, profile);
    } catch (error) {
      [width, height] = profile.defaultSize;
    }
    this.setData({
      profileIndex,
      density: profile.densityDefault,
      densityMin: profile.densityMin,
      densityMax: profile.densityMax
    });
    this.commit((document) => {
      document.widthMm = width;
      document.heightMm = height;
    }, true);
  },

  onSizeChange(event) {
    const sizeIndex = Number(event.detail.value);
    const size = SIZE_OPTIONS[sizeIndex];
    const candidate = Object.assign({}, this.document, { widthMm: size.width, heightMm: size.height });
    try {
      alignedCanvasSize(candidate, this.profile);
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
    const candidate = Object.assign({}, this.document, { [field]: value });
    try {
      alignedCanvasSize(candidate, this.profile);
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
    this.setData({ labelTypeIndex: Number(event.detail.value) });
  },

  onDensityChange(event) {
    this.setData({ density: Number(event.detail.value) });
  },

  onThresholdChange(event) {
    this.setData({ threshold: Number(event.detail.value) });
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
        const templates = this.data.templates.slice();
        templates.unshift({
          id: Date.now(),
          name,
          profileId: this.profile.id,
          document: cloneDocument(this.document)
        });
        const limited = templates.slice(0, 20);
        wx.setStorageSync(STORAGE_TEMPLATES, limited);
        this.loadTemplates();
        wx.showToast({ title: '模板已保存', icon: 'success' });
      }
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
    this.document = cloneDocument(template.document);
    this.images = {};
    this.imageLoadPromises = {};
    this.document.name = template.name;
    if (template.profileId && this.data.connectionState !== 'connected') {
      this.profile = getProfile(template.profileId);
      wx.setStorageSync(STORAGE_PROFILE, this.profile.id);
      this.profileConfirmed = true;
      this.setData({
        profileIndex: PROFILES.findIndex((item) => item.id === this.profile.id),
        density: this.profile.densityDefault,
        densityMin: this.profile.densityMin,
        densityMax: this.profile.densityMax
      });
    }
    this.ensureDocumentFitsProfile(this.document, this.profile);
    this.selectedId = '';
    this.persistDocument();
    this.syncPageData(() => this.initCanvas());
  },

  openDevices() {
    if (this.data.connectionState === 'connecting' || this.data.printing) {
      return;
    }
    this.setData({ showDevices: true, devices: [], scanning: true });
    this.session.scan((devices) => this.setData({ devices }))
      .catch((error) => {
        this.setData({ scanning: false });
        wx.showModal({ title: '无法扫描蓝牙设备', content: error.message, showCancel: false });
      });
  },

  closeDevices() {
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
      const result = await this.printer.connect(device);
      const guessed = profileForModelId(result.modelId, result.name, result.protocolVersion);
      if (guessed) {
        const index = PROFILES.findIndex((item) => item.id === guessed.id);
        this.profile = guessed;
        this.profileConfirmed = true;
        wx.setStorageSync(STORAGE_PROFILE, guessed.id);
        this.ensureDocumentFitsProfile(this.document, guessed);
        this.persistDocument();
        this.setData({
          profileIndex: index,
          density: guessed.densityDefault,
          densityMin: guessed.densityMin,
          densityMax: guessed.densityMax
        });
      } else {
        this.profileConfirmed = false;
      }
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
      if (!guessed) {
        wx.showModal({
          title: '需要选择打印机型号',
          content: result.modelId == null
            ? '设备未返回型号 ID，请在打印设置中手动选择准确型号后再打印。'
            : `型号 ID ${result.modelId} 尚未适配，请勿使用相似机型参数直接打印。`,
          showCancel: false
        });
      }
    } catch (error) {
      await this.session.disconnect();
      this.setDisconnectedState();
      wx.showModal({ title: '连接失败', content: error.message, showCancel: false });
    } finally {
      this.connecting = false;
    }
  },

  async disconnectDevice() {
    await this.session.disconnect();
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

  async startPrint() {
    if (!this.session.connected) {
      this.openDevices();
      return;
    }
    if (!this.profileConfirmed) {
      wx.showModal({
        title: '请确认打印机型号',
        content: '当前设备型号未被自动识别，请先在打印设置中选择准确型号。',
        showCancel: false
      });
      return;
    }
    if (!this.context || !this.canvasSize || !this.data.canvasReady) {
      wx.showToast({ title: '画布尚未就绪', icon: 'none' });
      return;
    }
    this.setData({ printing: true, printProgress: 0, printMessage: '准备打印' });
    try {
      await this.ensureImagesReady();
      validateDocument(this.document, this.profile.dpi);
      this.renderAll();
      const imageData = this.context.getImageData(0, 0, this.canvasSize.width, this.canvasSize.height);
      await this.printer.print(imageData, this.profile, {
        copies: this.data.copies,
        density: this.data.density,
        threshold: this.data.threshold,
        labelType: this.data.labelTypeIndex === 0 ? 1 : 3
      }, (printProgress, printMessage) => this.setData({ printProgress, printMessage }));
      wx.showToast({ title: '打印完成', icon: 'success' });
    } catch (error) {
      wx.showModal({ title: '打印失败', content: error.message, showCancel: false });
    } finally {
      this.setData({ printing: false });
    }
  },

  async cancelPrint() {
    await this.printer.cancel();
    this.setData({ printing: false, printMessage: '已取消' });
  }
});
