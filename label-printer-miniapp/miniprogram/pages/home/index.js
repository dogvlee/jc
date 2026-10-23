const {
  APPROVED_ORIGINAL_TEMPLATES,
  categories,
  industries,
  templates
} = require('../../app/catalog');
const { buildBatchDocuments } = require('../../app/data-bind');
const { buildTemplateDocument } = require('../../app/template-layouts');
const {
  buildCuratedBatchDocument,
  buildCuratedDocument,
  catalogMeta,
  curatedBatchTemplates,
  curatedCategoryChips,
  curatedSizeChips,
  curatedStats,
  getCuratedEntry,
  normalizeSearchText,
  queryCuratedMeta
} = require('../../app/curated/index');
const { STOCK_PRESETS, stockLabel } = require('../../app/stock-presets');
const { createDocument } = require('../../core/document');
const { buildMiniPreview } = require('../../core/mini-preview');
const { importNiimTemplate } = require('../../core/niim-template-import');
const { decodePcTemplateCode, isPcTemplateCode } = require('../../core/pc-template-code');
const {
  PRINTER_FAMILIES,
  evaluatePrintability,
  getProfile,
  printableProfilesForDocument,
  printerFamilyCode,
  printerFamilyLabel,
  savedPrinterProfile
} = require('../../core/profiles');
const { buildScanDocument } = require('../../core/scan-label');
const { validateDocument } = require('../../core/renderer');
const { findExcelDamagedCodes, parseDataCsv, stringifyDataCsv } = require('../../services/csv');
const { materializeDataUrlImages } = require('../../services/data-url-images');
const { shareTextFileSync } = require('../../services/file-share');
const { isRemoteImage, localizeDocumentImages } = require('../../services/remote-image-cache');
const { KEYS, MAX_PROJECTS, Repository, defaultRows, normalizeDocument } = require('../../services/repository');
const { scanCode, showScanFailure } = require('../../services/scanner');
const { EditorSession } = require('../../services/editor-session');

const PAGE_SIZE = 24;
const { BATCH_FIELDS: DATA_COLUMNS } = require('../../core/data-fields');
const MAX_CSV_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_BACKUP_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_TEMPLATE_IMPORT_BYTES = 2 * 1024 * 1024;
// What the repository keeps and the editor accepts for one batch.
const MAX_DATA_ROWS = 1000;
const MAX_BATCH_FIELD_LENGTH = 256;
// Table edits are saved this long after the last keystroke, and on blur.
const DATA_SAVE_DELAY_MS = 400;
// The template shelf is filtered this long after the last keystroke.
const SEARCH_DELAY_MS = 250;
// The history sheet lists the newest records; storage keeps up to 80.
const HISTORY_SHEET_LIMIT = 20;
const HOME_TEMPLATE_COUNT = 6;
const HOME_RECOMMENDED_TEMPLATES = APPROVED_ORIGINAL_TEMPLATES.slice(0, HOME_TEMPLATE_COUNT);
const WIFI_TEMPLATE_ID = 'shangyue-wifi-card';
const BRAND_RED = '#E02D26';
const SHARE_TITLE = '商跃标签：手机设计标签，蓝牙直接打印';
const STOCK_TOO_LARGE_HINT = '这台打印机装不下这个尺寸，请换纸';
const CSV_READ_FAILED = '文件没有读出来。如果是 Excel 表格，请「另存为 → CSV UTF-8（逗号分隔）」后再导入。';
const FAMILY_LABELS = {};
PRINTER_FAMILIES.forEach((family) => { FAMILY_LABELS[family.code] = family.label; });
// Live previews are built for the first projects only; the rest keep the light placeholder.
const PROJECT_PREVIEW_LIMIT = 24;
let previewSizes = null;

/** Preview boxes in px for cards, project thumbnails and the preview sheet (rpx-based). */
function previewBoxes() {
  if (previewSizes) return previewSizes;
  let width = 375;
  try {
    const info = typeof wx !== 'undefined' && (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
    width = Number(info && info.windowWidth) || 375;
  } catch (error) {
    width = 375;
  }
  const rpx = width / 750;
  previewSizes = {
    card: { w: 280 * rpx, h: 168 * rpx },
    sheet: { w: 600 * rpx, h: 316 * rpx }
  };
  return previewSizes;
}

function withPreview(view, documentValue, box) {
  if (!documentValue || view.thumbSrc) return view;
  try {
    view.preview = buildMiniPreview(documentValue, box.w, box.h);
  } catch (error) {
    view.preview = null;
  }
  return view;
}
const ROUTE_TITLES = {
  home: '商跃标签',
  templates: '商跃模板',
  projects: '我的标签',
  data: '批量数据',
  profile: '我的'
};

// Printer families that print a label as designed: '5' (58mm), '8' (80mm), '58' or ''.
function documentFit(documentValue) {
  const ids = printableProfilesForDocument(documentValue);
  return { families: printerFamilyCode(ids), label: printerFamilyLabel(ids) };
}

// Built-in layouts never change, so each is measured once per session. User
// templates are measured once per stored copy: a refresh reads new copies.
const systemFits = new Map();
const documentFits = new WeakMap();

function fitOf(item) {
  if (item.source === 'shangyue-curated') return { families: item.fitFamilies || '', label: item.fitLabel || '' };
  if (item.document && typeof item.document === 'object') {
    if (!documentFits.has(item.document)) documentFits.set(item.document, documentFit(item.document));
    return documentFits.get(item.document);
  }
  if (!systemFits.has(item.id)) systemFits.set(item.id, documentFit(buildTemplateDocument(item)));
  return systemFits.get(item.id);
}

/** Card fit line; `family` is the user's printer family ('' when unknown). */
function fitFields(fit, family) {
  return {
    fitFamilies: fit.families,
    fitLabel: fit.label,
    fitText: fit.label ? `适用 ${fit.label}` : '58mm、80mm 打印机都打不了',
    fitMismatch: Boolean(family) && !fit.families.includes(family)
  };
}

function templateView(item, family) {
  const rawThumb = String(item.thumbSrc || '').trim();
  const thumbSrc = rawThumb && /^(?:https?:\/\/|wxfile:\/\/|\/)/i.test(rawThumb)
    ? rawThumb
    : (rawThumb ? `/${rawThumb.replace(/^\/+/, '')}` : '');
  return Object.assign({
    id: item.id,
    name: item.name,
    category: item.category || '我的',
    industry: item.industry || '我的',
    sizeText: `${item.size[0]}×${item.size[1]} mm`,
    blurb: item.blurb || '我的本地模板',
    badge: item.badge || '',
    copyright: item.copyright || '',
    kind: item.kind || 'accent',
    source: item.source || 'unknown',
    sceneLabel: item.sceneLabel || '',
    thumbSrc
  }, fitFields(fitOf(item), family || ''));
}

// Curated layouts are fixed, so each card preview is drawn once per session
// instead of again every time the list grows or a filter changes.
const curatedPreviews = new Map();

function curatedCardView(item, family) {
  const view = templateView(item, family);
  if (!curatedPreviews.has(item.id)) {
    curatedPreviews.set(item.id, withPreview({}, buildCuratedDocument(item.id), previewBoxes().card).preview || null);
  }
  view.preview = curatedPreviews.get(item.id);
  return view;
}

function systemCardView(item, family) {
  const view = templateView(item, family);
  return view.thumbSrc ? view : withPreview(view, buildTemplateDocument(item), previewBoxes().card);
}

// '50×30' for the paper in the settings, '' when none is set.
function paperSizeText(settings) {
  const width = Number(settings && settings.stockWidthMm) || 0;
  const height = Number(settings && settings.stockHeightMm) || 0;
  return width && height ? `${width}×${height}` : '';
}

/**
 * Home picks: templates for the user's paper size (built-in ones first, then
 * scene templates) that the printer prints; when the paper has none, the
 * printer's templates, else the brand picks.
 */
function recommendedViews(family, paperSize) {
  const paperViews = paperSize ? paperTemplateViews(family, paperSize) : [];
  if (!paperViews.length) return familyTemplateViews(family);
  const shown = new Set(paperViews.map((item) => item.id));
  const extra = familyTemplateViews(family).filter((item) => !shown.has(item.id));
  return paperViews.concat(extra).slice(0, HOME_TEMPLATE_COUNT);
}

function paperTemplateViews(family, paperSize) {
  const views = templates.filter((item) => (
    `${item.size[0]}×${item.size[1]}` === paperSize && (!family || fitOf(item).families.includes(family))
  )).slice(0, HOME_TEMPLATE_COUNT).map((item) => systemCardView(item, family));
  const room = HOME_TEMPLATE_COUNT - views.length;
  if (room > 0) {
    queryCuratedMeta({ family, size: paperSize, limit: room }).items.forEach((item) => views.push(curatedCardView(item, family)));
  }
  return views;
}

function familyTemplateViews(family) {
  if (!family) return HOME_RECOMMENDED_TEMPLATES.map((item) => templateView(item, ''));
  const views = templates.filter((item) => fitOf(item).families.includes(family))
    .slice(0, HOME_TEMPLATE_COUNT)
    .map((item) => systemCardView(item, family));
  const room = HOME_TEMPLATE_COUNT - views.length;
  if (room > 0) {
    queryCuratedMeta({ family, limit: room }).items.forEach((item) => views.push(curatedCardView(item, family)));
  }
  return views;
}

function batchPicks(family) {
  const picks = curatedBatchTemplates(family);
  return picks.length ? picks : curatedBatchTemplates();
}

// Unfiltered picks name the printers they suit, so nobody fills 40 rows for
// a size their printer cannot take.
function batchPickerData(family, currentId) {
  const picks = batchPicks(family);
  const found = picks.findIndex((item) => item.id === currentId);
  const index = found >= 0 ? found : 0;
  return {
    batchTemplateNames: picks.map((item) => (family || !item.fitLabel ? item.name : `${item.name}（适用 ${item.fitLabel}）`)),
    batchTemplateIndex: index,
    batchTemplateId: picks[index] ? picks[index].id : ''
  };
}

function hasRowData(row) {
  return DATA_COLUMNS.some((field) => String(row && row[field] != null ? row[field] : '').trim());
}

function cellText(row, field) {
  return String(row && row[field] != null ? row[field] : '');
}

// The sample rows a new table starts with. Importing over them needs no
// question; rows the user typed or edited do.
const SAMPLE_ROWS = new Map(defaultRows().map((row) => [row.id, row]));

function isSampleRow(row) {
  const sample = row && SAMPLE_ROWS.get(row.id);
  // Every field counts: a row whose only edit is the date (the most likely
  // first edit) is the owner's data and must never be replaced without asking.
  return Boolean(sample) && ['name', 'code', 'price', 'date'].every((field) => cellText(row, field) === sample[field]);
}

function userRowCount(rows) {
  return (rows || []).filter((row) => hasRowData(row) && !isSampleRow(row)).length;
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Plain text rows for the editor's batch. Blank rows stay in place, so a row
// number in an error matches the table.
function batchRows(rows) {
  return (rows || []).slice(0, MAX_DATA_ROWS).map((row, index) => {
    const item = { id: String(row && row.id || `row-${index + 1}`).slice(0, 64) };
    DATA_COLUMNS.forEach((field) => {
      const value = row && row[field] != null ? row[field] : '';
      item[field] = String(value).slice(0, MAX_BATCH_FIELD_LENGTH);
    });
    return item;
  });
}

function appConnectionManager() {
  let app = null;
  try {
    app = typeof getApp === 'function' ? getApp() : null;
  } catch (error) {
    app = null;
  }
  return app && app.globalData && app.globalData.connectionManager || null;
}

/** Profile of the remembered printer, or null before any printer was connected. */
function rememberedProfile(manager, settings) {
  let saved = null;
  try {
    saved = manager && typeof manager.getSavedDevice === 'function' ? manager.getSavedDevice() : null;
  } catch (error) {
    saved = null;
  }
  if (!saved) return null;
  return savedPrinterProfile(saved) || getProfile(settings && settings.defaultProfileId);
}

// An automatic reconnect runs quietly in the background, so it reads as
// 未连接 until it succeeds; only a connection the user asked for shows 连接中.
function connectionView(state) {
  const status = state && state.status;
  if (status === 'connected') {
    const device = state.device || {};
    return { connected: true, connectionLabel: device.name || device.displayName || '已连接' };
  }
  const requested = status === 'connecting' && !state.background;
  return { connected: false, connectionLabel: requested ? '连接中…' : '未连接' };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dayStamp(date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

// A saved label changes its updatedAt whenever it changes, so its preview is
// drawn once per version instead of on every return to the home page.
const projectPreviews = new Map();
const PROJECT_PREVIEW_CACHE_SIZE = 200;

function projectPreview(item, document) {
  const key = `${item.id}:${item.updatedAt}`;
  if (!projectPreviews.has(key)) {
    if (projectPreviews.size >= PROJECT_PREVIEW_CACHE_SIZE) projectPreviews.delete(projectPreviews.keys().next().value);
    projectPreviews.set(key, withPreview({}, document, previewBoxes().card).preview || null);
  }
  return projectPreviews.get(key);
}

function projectView(item, index) {
  const document = item.document || {};
  const elements = Array.isArray(document.elements) ? document.elements : [];
  let kind = 'accent';
  if (elements.some((element) => element.type === 'qrcode')) kind = 'qr';
  else if (elements.some((element) => element.type === 'barcode')) kind = 'barcode';
  return {
    id: item.id,
    name: item.name || document.name || '未命名标签',
    sizeText: `${document.widthMm || 40}×${document.heightMm || 30} mm`,
    updatedText: formatRelativeTime(item.updatedAt),
    kind,
    preview: index < PROJECT_PREVIEW_LIMIT && elements.length ? projectPreview(item, document) : null
  };
}

function formatRelativeTime(value) {
  const timestamp = Number(value) || 0;
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function isCancelled(failure) {
  return /cancel/i.test(String(failure && failure.errMsg || ''));
}

// Our own errors are written in Chinese; anything else (a JSON syntax error,
// a raw platform message) gets the plain `fallback` instead.
function plainMessage(error, fallback) {
  const message = String(error && error.message || '');
  return /[一-鿿]/.test(message) ? message : fallback;
}

const HISTORY_STATUS = {
  success: { label: '成功', icon: 'icon-check' },
  cancelled: { label: '已取消', icon: 'icon-x' },
  failed: { label: '失败', icon: 'icon-triangle-alert' }
};

// Records saved before print errors were translated can hold the platform's
// own words (writeBLECharacteristicValue:fail …). Those parts are left out;
// a failure with nothing readable left says 打印失败.
function historyMessage(item, result) {
  const parts = String(item.message || '').split(/[；;]/).map((part) => part.trim())
    .filter((part) => /[一-鿿]/.test(part) && !/fail|ble|errmsg|errno|undefined|null/i.test(part));
  if (parts.length) return parts.join('；');
  if (result === 'success') return '';
  return result === 'cancelled' ? '已取消' : '打印失败';
}

function historyView(item) {
  const result = item.result === 'success' || item.result === 'cancelled' ? item.result : 'failed';
  return {
    id: item.id,
    name: item.name || '未命名标签',
    result,
    statusLabel: HISTORY_STATUS[result].label,
    statusIcon: HISTORY_STATUS[result].icon,
    atText: formatRelativeTime(item.at),
    message: historyMessage(item, result),
    canOpen: Boolean(item.document)
  };
}

Page({
  data: Object.assign({
    route: 'home',
    storageError: '',
    recoveryDraft: null,
    routeTitle: ROUTE_TITLES.home,
    safeTop: 24,
    headerTop: 68,
    connected: false,
    connectionLabel: '未连接',
    showDevices: false,
    // Family of the remembered printer ('5' | '8'), '' until one is connected.
    printerFamily: '',
    printerFamilyLabel: '',
    familyFilterOn: true,
    categories,
    industries,
    templateCategory: '全部',
    templateIndustry: '全部',
    libraryScene: '全部',
    libraryScenes: curatedCategoryChips(),
    librarySize: '全部',
    librarySizes: curatedSizeChips(),
    libraryTotal: curatedStats().total,
    templateQuery: '',
    templateVisibleCount: PAGE_SIZE,
    templateTotal: templates.length,
    visibleTemplates: [],
    remoteTemplatePage: 0,
    remoteTemplateTotal: 0,
    remoteTemplateLoaded: 0,
    remoteTemplateScanned: 0,
    remoteTemplateHasMore: false,
    remoteTemplateLoading: false,
    remoteTemplateError: '',
    remoteTemplateStatusText: '公开货架仅含商跃原创模板和我的模板',
    remoteAssetLoading: false,
    recentProjects: [],
    allProjects: [],
    // Totals for counts and stats; allProjects follows the search box.
    projectTotal: 0,
    // How many more labels can be saved before the 120 limit.
    projectRoom: MAX_PROJECTS,
    // Stored labels or templates that cannot be read and are hidden.
    damagedRecords: 0,
    recommendedTemplates: recommendedViews(''),
    recommendedSubtitle: '',
    userTemplateCount: 0,
    authStatus: 'guest',
    accountPhone: '',
    // The table reaches the page only while the data route is open.
    dataRows: [],
    batchRowCount: 0,
    // A table edit storage refused; it stays in memory until saved.
    dataSaveFailed: false,
    datePlaceholder: todayText(),
    printHistory: [],
    historyTotal: 0,
    settings: {},
    stockName: '',
    stockFitHint: '',
    densityMin: 1,
    densityMax: 5,
    // Thermal printers keep their own density, so there is nothing to set.
    densityAdjustable: true,
    codeScanning: false,
    showOnboarding: false,
    onboardingStep: 0,
    showTemplatePreview: false,
    previewTemplate: null,
    showStockSheet: false,
    showHistorySheet: false,
    showSettingsSheet: false,
    showHelpSheet: false,
    projectQuery: '',
    labelTypeNames: ['间隙纸', '黑标纸', '连续纸', '定孔纸'],
    stockPresets: STOCK_PRESETS
  }, batchPickerData('', '')),

  onLoad() {
    this.pageActive = true;
    let info = {};
    try {
      info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) || {};
    } catch (error) {
      // Keep the custom header usable when device metrics are unavailable.
    }
    const safeTop = Number(info.safeArea && info.safeArea.top) || Number(info.statusBarHeight) || 24;
    // Put the whole header below the native capsule, preserving its full width.
    let headerTop = safeTop + 44;
    try {
      const menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
      const menuBottom = Number(menu && menu.bottom);
      if (Number.isFinite(menuBottom) && menuBottom > 0) {
        headerTop = Math.max(safeTop + 12, menuBottom + 12);
      }
    } catch (error) {
      // Older clients can throw here; reserve a navigation row below the status bar.
    }
    const app = getApp();
    this.repository = app && app.globalData && app.globalData.repository || new Repository(wx);
    this.authService = app && app.globalData && app.globalData.authService || null;
    this.bindAuthState();
    this.editorSession = new EditorSession(this.repository);
    this.remoteTemplates = [];
    this.setData({ safeTop, headerTop });
    this.enableSharing();
    this.bindConnectionState();
    this.refresh();
    // WeChat calls onShow right after onLoad: that first show has nothing new.
    this.freshlyLoaded = true;
  },

  onShow() {
    this.editorOpening = false;
    this.syncAuthState();
    if (!this.repository) return;
    this.consumePendingRoute();
    if (this.freshlyLoaded) {
      this.freshlyLoaded = false;
      return;
    }
    this.refresh();
  },

  onHide() {
    this.commitDataRows(true);
  },

  consumePendingRoute() {
    let route = '';
    try {
      route = String(wx.getStorageSync(KEYS.pendingHomeRoute) || '');
      if (route) wx.removeStorageSync(KEYS.pendingHomeRoute);
    } catch (error) {
      route = '';
    }
    if (route && ROUTE_TITLES[route] && route !== this.data.route) {
      this.setData(Object.assign({ route, routeTitle: ROUTE_TITLES[route] },
        route === 'data' ? this.tableViewPatch(this.currentDataRows(), { route }) : {}));
    }
  },

  onUnload() {
    this.pageActive = false;
    if (this.removeAuthListener) this.removeAuthListener();
    this.removeAuthListener = null;
    if (this.templateSearchTimer) clearTimeout(this.templateSearchTimer);
    this.templateSearchTimer = null;
    if (this.batchSavingTimer) clearTimeout(this.batchSavingTimer);
    this.batchSavingTimer = null;
    this.commitDataRows(true);
    if (this.removeConnectionListener) this.removeConnectionListener();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  bindAuthState() {
    if (this.removeAuthListener) this.removeAuthListener();
    this.removeAuthListener = null;
    if (this.authService && typeof this.authService.subscribe === 'function') {
      this.removeAuthListener = this.authService.subscribe((state) => {
        if (this.pageActive !== false) this.applyAuthState(state);
      });
    }
    this.syncAuthState();
  },

  syncAuthState() {
    const state = this.authService && typeof this.authService.getState === 'function'
      ? this.authService.getState()
      : { status: 'guest', user: null };
    this.applyAuthState(state);
  },

  applyAuthState(state) {
    const authenticated = Boolean(state && state.status === 'authenticated' && state.user);
    this.setData({
      authStatus: authenticated ? 'authenticated' : (state && state.status === 'restoring' ? 'restoring' : 'guest'),
      accountPhone: authenticated ? String(state.user.phoneMasked || '') : ''
    });
  },

  openLogin() {
    if (this.data.authStatus === 'authenticated' || this.loginOpening) return;
    this.loginOpening = true;
    wx.navigateTo({
      url: '/pages/login/index',
      complete: () => { this.loginOpening = false; },
      fail: () => wx.showToast({ title: '登录页面没有打开，请重试', icon: 'none' })
    });
  },

  logoutAccount() {
    if (!this.authService || this.data.authStatus !== 'authenticated') return;
    wx.showModal({
      title: '退出登录？',
      content: '退出后，这台设备上的标签、图片、模板和打印记录仍会保留。共用手机时，请留意本机内容。',
      confirmText: '退出登录',
      confirmColor: BRAND_RED,
      success: async (result) => {
        if (!result || !result.confirm || this.pageActive === false) return;
        try {
          await this.authService.logout();
          if (this.pageActive === false) return;
          this.syncAuthState();
          wx.showToast({ title: '已退出，本机标签已保留', icon: 'none' });
        } catch (error) {
          wx.showModal({ title: '退出失败', content: '登录状态没有清除，请重试。', showCancel: false, confirmColor: BRAND_RED });
        }
      }
    });
  },

  enableSharing() {
    if (typeof wx.showShareMenu !== 'function') return;
    try {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    } catch (error) {
      // Older clients keep their default share menu.
    }
  },

  onShareAppMessage() {
    return { title: SHARE_TITLE, path: '/pages/home/index' };
  },

  onShareTimeline() {
    return { title: SHARE_TITLE };
  },

  bindConnectionState() {
    const manager = appConnectionManager();
    if (!manager || typeof manager.subscribe !== 'function') return;
    this.removeConnectionListener = manager.subscribe((state) => {
      this.setData(connectionView(state));
    });
    if (typeof manager.getState === 'function') {
      this.setData(connectionView(manager.getState()));
    }
  },

  refresh() {
    try {
      this.repository.migrate();
      this.refreshStoredData();
    } catch (error) {
      this.setData({ storageError: plainMessage(error, '本地数据读取失败，请重试。'), showOnboarding: false });
    }
  },

  // Reads everything from storage and sends the page one patch. The template
  // shelf is rebuilt only when something it shows changed (coming back from
  // the editor used to resend every card: about 500 KB with 300 cards).
  refreshStoredData() {
    // Save a table edit still waiting for its timer; storage is read back below.
    // When storage refuses it, the edit stays in memory and on screen.
    const tableSaved = this.commitDataRows(true);
    const storedProjects = this.repository.getProjectsForDisplay();
    const storedTemplates = this.repository.getUserTemplatesForDisplay();
    const projects = storedProjects.items;
    const userTemplates = storedTemplates.items;
    const settings = this.repository.getSettings();
    const profile = getProfile(settings.defaultProfileId);
    const dataRows = tableSaved ? this.repository.getDataRows() : this.currentDataRows();
    const printHistory = this.repository.getPrintHistory();
    let recovery = null;
    let damagedDraft = false;
    try {
      recovery = this.editorSession.recoverable();
    } catch (error) {
      // A draft that cannot be read must not lock every label away; home
      // offers to discard it instead.
      if (!error || error.code !== 'STORAGE_DATA_INVALID') throw error;
      damagedDraft = true;
    }
    if (tableSaved) this.cancelDataSave();
    this.projects = projects;
    this.userTemplates = userTemplates;
    this.printHistoryRecords = printHistory;
    this.tableRows = dataRows;
    this.printerProfile = rememberedProfile(appConnectionManager(), settings);
    const family = this.printerProfile ? this.printerProfile.family : '';
    const patch = Object.assign({
      storageError: '',
      recoveryDraft: damagedDraft ? { damaged: true, name: '上次的草稿', updatedText: '' } : (recovery ? {
        damaged: false,
        name: recovery.document.name || '未命名标签',
        updatedText: formatRelativeTime(recovery.updatedAt)
      } : null),
      settings,
      densityMin: profile.densityMin,
      densityMax: profile.densityMax,
      densityAdjustable: profile.densityMax > profile.densityMin,
      recentProjects: projects.slice(0, 4).map((item, index) => projectView(item, index)),
      allProjects: this.filteredProjectViews(projects),
      projectTotal: projects.length,
      projectRoom: Math.max(0, MAX_PROJECTS - projects.length),
      damagedRecords: storedProjects.damaged + storedTemplates.damaged,
      userTemplateCount: userTemplates.length,
      printHistory: printHistory.slice(0, HISTORY_SHEET_LIMIT).map(historyView),
      historyTotal: printHistory.length,
      showOnboarding: !settings.onboardingDone,
      printerFamily: family,
      printerFamilyLabel: FAMILY_LABELS[family] || ''
    }, this.tableViewPatch(dataRows), this.stockPatch(settings));
    const state = Object.assign({}, this.data, patch);
    Object.assign(patch, this.familyViewsPatch(state));
    Object.assign(state, patch);
    if (this.templatesSignature(state) !== this.shownTemplatesSignature) {
      Object.assign(patch, this.templatesPatch(state));
    }
    this.setData(patch);
  },

  /** The family the shelf is limited to: '' when unknown or 「只看…」 is off. */
  activeFamily(state) {
    const view = state || this.data;
    return view.familyFilterOn === false ? '' : (view.printerFamily || '');
  },

  // Everything that depends on the printer family or the 「只看…」 switch.
  familyViewsPatch(state) {
    const view = state || this.data;
    const family = view.printerFamily || '';
    const active = this.activeFamily(view);
    const scenes = curatedCategoryChips(active);
    const sizes = curatedSizeChips(active);
    const patch = Object.assign({
      libraryScenes: scenes,
      librarySizes: sizes,
      libraryTotal: curatedStats(active).total,
      libraryScene: scenes.includes(view.libraryScene) ? view.libraryScene : '全部',
      librarySize: sizes.includes(view.librarySize) ? view.librarySize : '全部'
    }, batchPickerData(active, view.batchTemplateId));
    // The home picks (six cards with previews) change only with the printer
    // or the paper.
    const paper = paperSizeText(view.settings);
    const picksKey = `${family}|${paper}`;
    if (picksKey !== this.shownRecommendedKey) {
      this.shownRecommendedKey = picksKey;
      patch.recommendedTemplates = recommendedViews(family, paper);
      const forPaper = paper && patch.recommendedTemplates.some((item) => item.sizeText === `${paper} mm`);
      if (forPaper) {
        patch.recommendedSubtitle = family
          ? `适合你的 ${FAMILY_LABELS[family]} 打印机和 ${paper} 标签纸`
          : `适合你的 ${paper} 标签纸`;
      } else {
        patch.recommendedSubtitle = family ? `适合你的 ${FAMILY_LABELS[family]} 打印机` : '';
      }
    }
    return patch;
  },

  refreshFamilyViews() {
    this.setData(this.familyViewsPatch());
  },

  toggleFamilyFilter() {
    this.setData({ familyFilterOn: !this.data.familyFilterOn, templateVisibleCount: PAGE_SIZE }, () => {
      this.refreshFamilyViews();
      this.refreshTemplates();
    });
  },

  // Paper card: plain size name, plus a hint when the printer cannot take it.
  stockPatch(settings) {
    const width = Number(settings && settings.stockWidthMm) || 0;
    const height = Number(settings && settings.stockHeightMm) || 0;
    if (!width || !height) return { stockName: '', stockFitHint: '' };
    let fits = true;
    if (this.printerProfile) {
      const blank = createDocument(width, height);
      blank.elements = [];
      fits = evaluatePrintability(blank, this.printerProfile).ok;
    }
    return { stockName: stockLabel(width, height), stockFitHint: fits ? '' : STOCK_TOO_LARGE_HINT };
  },

  filteredProjectViews(projects) {
    const query = normalizeSearchText(this.data.projectQuery);
    return (projects || []).filter((item) => !query || normalizeSearchText(item.name).includes(query))
      .map((item, index) => projectView(item, index));
  },

  // Everything the template shelf shows depends on; equal signatures mean the
  // cards on screen are still right.
  templatesSignature(state) {
    const view = state || this.data;
    return JSON.stringify([
      view.printerFamily || '', this.activeFamily(view), view.templateCategory, view.templateIndustry,
      view.templateQuery, view.templateVisibleCount, view.libraryScene, view.librarySize,
      (this.userTemplates || []).map((item) => `${item.id}:${item.updatedAt}`)
    ]);
  },

  refreshTemplates() {
    this.setData(this.templatesPatch());
  },

  templatesPatch(state) {
    const view = state || this.data;
    this.shownTemplatesSignature = this.templatesSignature(view);
    const family = view.printerFamily || '';
    const active = this.activeFamily(view);
    const category = view.templateCategory;
    const industry = view.templateIndustry;
    const query = normalizeSearchText(view.templateQuery);
    const visibleCount = view.templateVisibleCount;
    if (industry === '场景模板') {
      const page = this.queryCuratedPage(0, visibleCount, view);
      return {
        templateTotal: page.total,
        visibleTemplates: page.items.map((item) => curatedCardView(item, family))
      };
    }
    const systemItems = templates.slice();
    const userItems = (this.userTemplates || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: '我的',
      industry: '我的',
      size: [item.document.widthMm, item.document.heightMm],
      kind: projectView(item).kind,
      blurb: '保存在本机的自定义模板',
      source: 'user',
      document: item.document
    }));
    const source = industry === '我的'
        ? userItems
        : systemItems.concat(userItems);
    const filtered = source.filter((item) => {
      // 我的 has no categories: a category picked on another tab must not
      // hide every user template.
      if (industry !== '我的' && category !== '全部' && item.category !== category) {
        return false;
      }
      if (industry !== '全部' && industry !== '我的' && item.industry !== industry) return false;
      if (active && !fitOf(item).families.includes(active)) return false;
      if (!query) return true;
      return [item.name, item.category, item.industry, item.blurb, item.sceneLabel, item.size && `${item.size[0]}×${item.size[1]}`]
        .some((value) => normalizeSearchText(value).includes(query));
    });
    const views = filtered.slice(0, visibleCount)
      .map((item) => withPreview(templateView(item, family), item.document, previewBoxes().card));
    // A search on 全部 also lists the matching scene templates, after these.
    let curatedTotal = 0;
    if (industry === '全部' && query) {
      const room = visibleCount - views.length;
      const curated = queryCuratedMeta({ category, query, family: active, limit: Math.max(1, room) });
      curatedTotal = curated.total;
      if (room > 0) curated.items.forEach((item) => views.push(curatedCardView(item, family)));
    }
    return {
      templateTotal: filtered.length + curatedTotal,
      visibleTemplates: views
    };
  },

  navigate(event) {
    const route = event.currentTarget.dataset.route;
    if (!ROUTE_TITLES[route]) return;
    if (this.data.route === 'data' && route !== 'data') this.commitDataRows(true);
    const patch = { route, routeTitle: ROUTE_TITLES[route] };
    // The table goes to the page only when its route opens.
    if (route === 'data' && this.data.route !== 'data') Object.assign(patch, this.tableViewPatch(this.currentDataRows(), { route }));
    this.setData(patch, () => {
      // Cards already on screen stay put unless what they show changed.
      if (route === 'templates' && this.templatesSignature() !== this.shownTemplatesSignature) {
        this.refreshTemplates();
      }
      if (route === 'projects') this.setData({ allProjects: this.filteredProjectViews(this.projects) });
    });
  },

  openIndustry() {
    this.setData({ route: 'templates', routeTitle: ROUTE_TITLES.templates, templateIndustry: '全部' }, () => {
      this.refreshTemplates();
    });
  },

  ensureRemoteTemplateCatalog() {
    return Promise.resolve();
  },

  loadRemoteTemplatePage() {
    return Promise.resolve();
  },

  loadMoreRemoteTemplates() {
    return Promise.resolve();
  },

  setTemplateCategory(event) {
    this.setData({ templateCategory: event.currentTarget.dataset.value, templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
  },

  setTemplateIndustry(event) {
    const industry = event.currentTarget.dataset.value;
    this.setData({
      templateIndustry: industry,
      libraryScene: '全部',
      // Scene templates open on the user's paper size when there are some;
      // 全部 is one tap away.
      librarySize: industry === '场景模板' ? this.paperLibrarySize() : '全部',
      templateVisibleCount: PAGE_SIZE
    }, () => this.refreshTemplates());
  },

  paperLibrarySize() {
    const paper = paperSizeText(this.data.settings);
    return paper && (this.data.librarySizes || []).includes(paper) ? paper : '全部';
  },

  setLibraryScene(event) {
    this.setData({
      libraryScene: event.currentTarget.dataset.value,
      templateVisibleCount: PAGE_SIZE
    }, () => this.refreshTemplates());
  },

  setLibrarySize(event) {
    this.setData({
      librarySize: event.currentTarget.dataset.value,
      templateVisibleCount: PAGE_SIZE
    }, () => this.refreshTemplates());
  },

  // The shelf filters once typing pauses, not on every key.
  onTemplateSearch(event) {
    const value = event.detail.value;
    if (this.templateSearchTimer) clearTimeout(this.templateSearchTimer);
    this.templateSearchTimer = setTimeout(() => {
      this.templateSearchTimer = null;
      if (this.pageActive === false) return;
      this.setData({ templateQuery: value, templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
    }, SEARCH_DELAY_MS);
  },

  resetTemplateFilters() {
    if (this.templateSearchTimer) clearTimeout(this.templateSearchTimer);
    this.templateSearchTimer = null;
    this.setData({
      templateCategory: '全部',
      templateIndustry: '全部',
      libraryScene: '全部',
      librarySize: '全部',
      templateQuery: '',
      familyFilterOn: false,
      templateVisibleCount: PAGE_SIZE
    }, () => {
      this.refreshFamilyViews();
      this.refreshTemplates();
    });
  },

  queryCuratedPage(offset, limit, state) {
    const view = state || this.data;
    return queryCuratedMeta({
      category: view.libraryScene,
      size: view.librarySize,
      query: view.templateQuery,
      family: this.activeFamily(view),
      offset,
      limit
    });
  },

  loadMoreTemplates() {
    if (this.data.templateIndustry !== '场景模板') {
      // Sending the whole shelf again made every "显示更多" grow with the list:
      // only the cards that were not on screen yet go over the bridge.
      const visibleCount = this.data.templateVisibleCount + PAGE_SIZE;
      const next = this.templatesPatch(Object.assign({}, this.data, { templateVisibleCount: visibleCount }));
      this.appendTemplateCards(next, { templateVisibleCount: visibleCount });
      return;
    }
    // Append only the next page (about 50 KB): re-sending every card already on
    // screen made each setData grow with the list, to about 530 KB at 300 cards.
    const family = this.data.printerFamily || '';
    const offset = this.data.visibleTemplates.length;
    const page = this.queryCuratedPage(offset, PAGE_SIZE);
    const patch = { templateTotal: page.total, templateVisibleCount: offset + PAGE_SIZE };
    page.items.forEach((item, index) => {
      patch[`visibleTemplates[${offset + index}]`] = curatedCardView(item, family);
    });
    // The cards on screen now match the longer list.
    this.shownTemplatesSignature = this.templatesSignature(Object.assign({}, this.data, patch));
    this.setData(patch);
  },

  /**
   * Sends only the cards that differ from the ones on screen. Cards keep their
   * order, so the shared prefix is skipped and the rest is written by index;
   * a shorter list (a filter that hides cards) is sent whole.
   */
  appendTemplateCards(next, extra) {
    const current = Array.isArray(this.data.visibleTemplates) ? this.data.visibleTemplates : [];
    const items = Array.isArray(next && next.visibleTemplates) ? next.visibleTemplates : [];
    const patch = Object.assign({ templateTotal: next.templateTotal }, extra || {});
    if (items.length < current.length) {
      patch.visibleTemplates = items;
      this.setData(patch);
      return;
    }
    let prefix = 0;
    while (prefix < current.length && prefix < items.length
      && current[prefix] && items[prefix] && current[prefix].id === items[prefix].id) {
      prefix += 1;
    }
    for (let index = prefix; index < items.length; index += 1) {
      patch[`visibleTemplates[${index}]`] = items[index];
    }
    this.setData(patch);
  },

  resolveTemplate(id) {
    const family = this.data.printerFamily || '';
    if (String(id || '').startsWith('sy-tpl-')) {
      const entry = getCuratedEntry(id);
      if (!entry) return null;
      const meta = catalogMeta(entry);
      return { meta: templateView(meta, family), document: buildCuratedDocument(id) };
    }
    const user = (this.userTemplates || []).find((item) => item.id === id);
    if (user) return { meta: templateView({
      id: user.id,
      name: user.name,
      category: '我的',
      industry: '我的',
      size: [user.document.widthMm, user.document.heightMm],
      kind: projectView(user).kind,
      source: 'user',
      document: user.document
    }, family), document: user.document };
    const remote = (this.remoteTemplates || []).find((item) => item.id === id);
    if (remote) return { meta: templateView(remote, family), document: remote.document };
    const meta = templates.find((item) => item.id === id);
    if (!meta) return null;
    return { meta: templateView(meta, family), document: buildTemplateDocument(meta) };
  },

  previewTemplate(event) {
    const resolved = this.resolveTemplate(event.currentTarget.dataset.id);
    if (!resolved) return;
    const meta = resolved.meta;
    const family = this.data.printerFamily || '';
    if (meta.fitFamilies === undefined) Object.assign(meta, fitFields(documentFit(resolved.document), family));
    // Opening stays allowed: the user may be about to change paper or printer.
    meta.fitNotice = meta.fitMismatch
      ? `你的打印机（${FAMILY_LABELS[family]}）打印不了这个尺寸，可以换一个模板`
      : '';
    this.previewDocument = resolved.document;
    withPreview(meta, resolved.document, previewBoxes().sheet);
    this.setData({ showTemplatePreview: true, previewTemplate: meta });
  },

  closeTemplatePreview() {
    this.previewDocument = null;
    this.setData({ showTemplatePreview: false, previewTemplate: null });
  },

  async usePreviewTemplate() {
    if (!this.previewDocument || this.data.remoteAssetLoading) return;
    if (!this.data.previewTemplate || this.data.previewTemplate.source !== 'remote-niim') {
      this.openEditor(this.previewDocument, '');
      return;
    }
    const document = this.previewDocument;
    const previewId = this.data.previewTemplate.id;
    this.setData({ remoteAssetLoading: true });
    try {
      const localized = await localizeDocumentImages(wx, document);
      if (!this.data.showTemplatePreview || !this.data.previewTemplate || this.data.previewTemplate.id !== previewId) return;
      this.previewDocument = localized;
      this.openEditor(localized, '');
    } catch (error) {
      wx.showModal({
        title: '模板图片加载失败',
        content: `${error && error.message ? error.message : '请检查网络后重试'}。仅支持你自己导入的图片。`,
        showCancel: false
      });
    } finally {
      if (this.pageActive !== false) this.setData({ remoteAssetLoading: false });
    }
  },

  deletePreviewTemplate() {
    const preview = this.data.previewTemplate;
    if (!preview || preview.source !== 'user') return;
    wx.showModal({
      title: '删除我的模板',
      content: `确定删除“${preview.name}”吗？已用它做好的标签不会被删除。`,
      confirmColor: BRAND_RED,
      success: (result) => {
        if (!result.confirm) return;
        try {
          this.repository.deleteUserTemplate(preview.id);
        } catch (error) {
          this.showStorageError(error, '模板没有删除');
          return;
        }
        this.closeTemplatePreview();
        this.refresh();
        wx.showToast({ title: '模板已删除', icon: 'success' });
      }
    });
  },

  createBlank() {
    let settings = this.data.settings || {};
    try {
      settings = this.repository.getSettings();
    } catch (error) {
      // Use the paper size already on screen.
    }
    const document = createDocument(Number(settings.stockWidthMm) || 50, Number(settings.stockHeightMm) || 30);
    document.name = '未命名标签';
    document.elements = [];
    this.openEditor(document, '');
  },

  createWifiLabel() {
    const meta = templates.find((item) => item.id === WIFI_TEMPLATE_ID);
    if (!meta) {
      wx.showToast({ title: 'Wi-Fi 模板暂时不能用', icon: 'none' });
      return;
    }
    this.openEditor(buildTemplateDocument(meta), '');
  },

  async scanToLabel() {
    if (this.codeScanInFlight) return;
    this.codeScanInFlight = true;
    this.setData({ codeScanning: true });
    try {
      const result = await scanCode(wx);
      // 电脑标签设计器「发到手机」的码：导入成模板，不按普通码建标签（码的内容远超 500 字，走普通建标会被拒）
      if (isPcTemplateCode(result && result.result)) {
        await this.importPcTemplateCode(result.result);
        return;
      }
      const settings = this.repository.getSettings();
      const document = buildScanDocument(result, {
        widthMm: settings.stockWidthMm,
        heightMm: settings.stockHeightMm
      });
      this.openEditor(document, '');
    } catch (error) {
      if (error && error.code === 'SCAN_CANCELLED') return;
      const fromPc = error && /^PC_CODE_/.test(String(error.code || ''));
      showScanFailure(wx, error, { title: fromPc ? '模板导入失败' : '无法扫码建标', retry: () => this.scanToLabel() });
    } finally {
      this.codeScanInFlight = false;
      this.setData({ codeScanning: false });
    }
  },

  /** 电脑标签设计器的模板码：存进「我的模板」，再直接打开，扫完就能打印。 */
  async importPcTemplateCode(text) {
    const payload = decodePcTemplateCode(text);
    let document = normalizeDocument(payload.document);
    if (!document) {
      const error = new Error('模板里的标签尺寸或内容不完整，请在电脑上重新点「发到手机」');
      error.code = 'PC_CODE_CORRUPT';
      throw error;
    }
    document = await localizeDocumentImages(wx, document);
    if (this.pageActive === false) return;
    const template = this.repository.saveUserTemplate(document, payload.name || document.name);
    this.refresh();
    wx.showToast({ title: `已导入“${template.name}”`, icon: 'none' });
    this.openEditor(template.document, '');
  },

  openProject(event) {
    const project = (this.projects || []).find((item) => item.id === event.currentTarget.dataset.id);
    if (project) this.openEditor(project.document, project.id);
  },

  /** Opens `document` in the editor; options.batch ({ rows, source }) prints every row. */
  openEditor(document, projectId, options) {
    if (this.editorOpening) return;
    try {
      const recovery = this.editorSession.recoverable();
      if (recovery) {
        if (projectId && recovery.projectId === projectId) return this.resumeDraft();
        this.editorOpening = true;
        wx.showActionSheet({
          alertText: `“${recovery.document.name || '未命名标签'}”还有未保存的草稿`,
          itemList: ['继续编辑草稿', '保存草稿并打开新标签', '放弃草稿，打开新标签'],
          success: (result) => {
            this.editorOpening = false;
            if (result.tapIndex === 0) this.resumeDraft();
            else if (result.tapIndex === 1) this.saveDraftAndOpen(document, projectId, options);
            else if (result.tapIndex === 2) this.discardDraftAndOpen(document, projectId, options);
          },
          fail: () => { this.editorOpening = false; }
        });
        return;
      }
      this.editorSession.stage(document, projectId, options);
      this.navigateEditor();
    } catch (error) {
      wx.showModal({ title: '无法打开编辑器', content: error.message || '本地存储空间不足', showCancel: false });
    }
  },

  saveDraftAndOpen(document, projectId, options) {
    try {
      this.editorSession.saveRecovery();
      this.openEditor(document, projectId, options);
    } catch (error) {
      wx.showModal({ title: '草稿保存失败', content: error.message, showCancel: false });
    }
  },

  discardDraftAndOpen(document, projectId, options) {
    wx.showModal({
      title: '放弃未保存的草稿？',
      content: '草稿中的修改将被删除，之前手动保存的标签不受影响。',
      confirmText: '放弃草稿',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (!result || !result.confirm) return;
        try {
          this.editorSession.discard();
        } catch (error) {
          wx.showModal({ title: '草稿未删除', content: error.message, showCancel: false });
          return;
        }
        this.openEditor(document, projectId, options);
      }
    });
  },

  navigateEditor() {
    this.editorOpening = true;
    wx.navigateTo({
      url: '/pages/editor/index',
      success: () => {
        if (this.data.showTemplatePreview) this.closeTemplatePreview();
      },
      fail: () => {
        this.editorOpening = false;
        wx.showToast({ title: '编辑器未打开，请重试', icon: 'none' });
      }
    });
  },

  resumeDraft() {
    if (this.editorOpening) return;
    try {
      if (this.editorSession.resume()) this.navigateEditor();
      else this.refresh();
    } catch (error) {
      wx.showModal({ title: '无法恢复草稿', content: error.message, showCancel: false });
    }
  },

  discardDraft() {
    const damaged = Boolean(this.data.recoveryDraft && this.data.recoveryDraft.damaged);
    wx.showModal({
      title: damaged ? '放弃损坏的草稿？' : '放弃未保存的草稿？',
      content: damaged
        ? '上次的草稿数据坏了，打不开。放弃后可以正常新建和打开标签，已保存的标签不受影响。'
        : '草稿中的修改将被删除，之前手动保存的标签不受影响。',
      confirmText: '放弃草稿',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (!result.confirm) return;
        try { this.editorSession.discard(); this.refresh(); }
        catch (error) { wx.showModal({ title: '草稿未删除', content: error.message, showCancel: false }); }
      }
    });
  },

  deleteProject(event) {
    const id = event.currentTarget.dataset.id;
    const project = (this.projects || []).find((item) => item.id === id);
    wx.showModal({
      title: '删除标签',
      content: `确定删除“${project ? project.name : '此标签'}”吗？删除后不能恢复。`,
      confirmText: '删除',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (!result.confirm) return;
        try {
          this.repository.deleteProject(id);
        } catch (error) {
          this.showStorageError(error, '标签没有删除');
          return;
        }
        this.refresh();
        wx.showToast({ title: '标签已删除', icon: 'success' });
      }
    });
  },

  // Stored labels or templates that cannot be read are hidden from the lists,
  // and saving refuses to touch them. This removes them after a confirmation.
  cleanDamagedRecords() {
    const count = this.data.damagedRecords;
    if (!count) return;
    wx.showModal({
      title: '清理损坏的数据？',
      content: `有 ${count} 条标签或模板的数据坏了，打不开，也会让新的标签存不进去。清理只删掉这些坏数据，其他标签不受影响。`,
      confirmText: '清理',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (!result || !result.confirm) return;
        try {
          this.repository.discardDamagedRecords();
        } catch (error) {
          this.showStorageError(error, '没有清理成功');
          return;
        }
        this.refresh();
        wx.showToast({ title: '已清理', icon: 'success' });
      }
    });
  },

  onProjectSearch(event) {
    this.setData({ projectQuery: event.detail.value }, () => {
      this.setData({ allProjects: this.filteredProjectViews(this.projects) });
    });
  },

  clearProjectSearch() {
    this.setData({ projectQuery: '' }, () => {
      this.setData({ allProjects: this.filteredProjectViews(this.projects) });
    });
  },

  showStorageError(error, title) {
    wx.showModal({
      title: title || '没有保存成功',
      content: error && error.message ? error.message : '本机存储空间不足，请清理后重试',
      showCancel: false
    });
  },

  openStockSheet() { this.setData({ showStockSheet: true }); },
  closeStockSheet() { this.setData({ showStockSheet: false }); },
  openHistorySheet() { this.setData({ showHistorySheet: true }); },
  closeHistorySheet() { this.setData({ showHistorySheet: false }); },
  openSettingsSheet() { this.setData({ showSettingsSheet: true }); },
  closeSettingsSheet() { this.setData({ showSettingsSheet: false }); },
  openHelp() { this.setData({ showHelpSheet: true }); },
  closeHelp() { this.setData({ showHelpSheet: false }); },

  // A record holds the label as it was printed. It opens as a new label: tied
  // to its saved label, saving it would overwrite a newer version.
  openHistoryItem(event) {
    const record = (this.printHistoryRecords || []).find((item) => item.id === event.currentTarget.dataset.id);
    if (!record || !record.document) {
      wx.showToast({ title: '较早记录只保留结果，不再保存标签副本', icon: 'none' });
      return;
    }
    this.setData({ showHistorySheet: false });
    this.openEditor(record.document, '');
  },

  /** Saves a settings change from a tap; storage problems are shown, not thrown. */
  saveSettingsPatch(patch, extra) {
    let settings;
    try {
      settings = this.repository.saveSettings(patch);
    } catch (error) {
      this.showStorageError(error);
      return null;
    }
    // Changing the paper changes the home picks and their subtitle, so both are
    // recomputed in the same update: the page must never show two paper sizes.
    const changed = patch || {};
    const paperChanged = Object.prototype.hasOwnProperty.call(changed, 'stockWidthMm')
      || Object.prototype.hasOwnProperty.call(changed, 'stockHeightMm');
    const views = paperChanged ? this.familyViewsPatch(Object.assign({}, this.data, { settings })) : null;
    this.setData(Object.assign({ settings }, this.stockPatch(settings), views || {}, extra || {}));
    return settings;
  },

  updateStockField(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    if (!Number.isFinite(value) || value < 5 || value > 500) {
      wx.showToast({ title: '标签尺寸须在 5-500 mm', icon: 'none' });
      let settings = this.data.settings;
      try {
        settings = this.repository.getSettings();
      } catch (error) {
        // Keep the sizes already on screen.
      }
      this.setData({ settings });
      return;
    }
    this.saveSettingsPatch({ [field]: value });
  },

  chooseStockPreset(event) {
    const value = String(event.currentTarget.dataset.value || '').split('x').map(Number);
    if (value.length !== 2 || value.some((item) => !Number.isFinite(item))) return;
    this.saveSettingsPatch({ stockWidthMm: value[0], stockHeightMm: value[1] }, { showStockSheet: false });
  },

  updateSetting(event) {
    const field = event.currentTarget.dataset.field;
    let value = event.detail.value;
    if (['density', 'threshold', 'labelType'].includes(field)) value = Number(value);
    if (field === 'density') value = Math.max(this.data.densityMin, Math.min(this.data.densityMax, value));
    // The picker reports an index; paper types are stored as 1-4.
    if (field === 'labelType') value += 1;
    this.saveSettingsPatch({ [field]: value });
  },

  finishOnboarding() {
    let settings = this.data.settings;
    try {
      settings = this.repository.saveSettings({ onboardingDone: true });
    } catch (error) {
      // Never trap the user behind the guide; it simply shows again next time.
    }
    this.setData({ showOnboarding: false, settings });
  },

  nextOnboarding() {
    if (this.data.onboardingStep >= 2) this.finishOnboarding();
    else this.setData({ onboardingStep: this.data.onboardingStep + 1 });
  },

  skipOnboarding() { this.finishOnboarding(); },

  /**
   * The batch table for the page. Rows are sent only while the data route is
   * open (1,000 rows are about 95 KB), and when the rows on screen are the
   * same rows, only the cells that changed are sent.
   */
  tableViewPatch(rows, state) {
    const patch = { batchRowCount: rows.filter(hasRowData).length };
    if ((state || this.data).route !== 'data') {
      this.tableShownRows = null;
      return patch;
    }
    const shown = this.tableShownRows;
    if (shown && shown.length === rows.length && shown.every((row, index) => row && rows[index] && row.id === rows[index].id)) {
      rows.forEach((row, index) => {
        DATA_COLUMNS.forEach((field) => {
          if (cellText(row, field) !== cellText(shown[index], field)) patch[`dataRows[${index}].${field}`] = cellText(row, field);
        });
      });
    } else {
      patch.dataRows = rows;
    }
    this.tableShownRows = rows;
    return patch;
  },

  /** Table rows including edits whose save is still pending. */
  currentDataRows() {
    return this.pendingDataRows || this.tableRows || this.data.dataRows || [];
  },

  /** Saves the table; returns false (after telling the user unless quiet) on a storage problem. */
  saveDataRows(rows, quiet) {
    try {
      this.repository.saveDataRows(rows);
    } catch (error) {
      if (!quiet) this.showStorageError(error);
      return false;
    }
    this.tableRows = rows;
    this.setData(Object.assign(this.tableViewPatch(rows), this.data.dataSaveFailed ? { dataSaveFailed: false } : {}));
    return true;
  },

  stageDataCell(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const rows = this.currentDataRows();
    if (!rows[index] || !DATA_COLUMNS.includes(field)) return false;
    const value = String(event.detail.value == null ? '' : event.detail.value);
    if (String(rows[index][field] == null ? '' : rows[index][field]) === value) return Boolean(this.pendingDataRows);
    const next = rows.slice();
    next[index] = Object.assign({}, rows[index], { [field]: value });
    this.pendingDataRows = next;
    return true;
  },

  onDataCellInput(event) {
    if (!this.stageDataCell(event)) return;
    this.clearDataSaveTimer();
    this.dataSaveTimer = setTimeout(() => {
      this.dataSaveTimer = null;
      this.commitDataRows(true);
    }, DATA_SAVE_DELAY_MS);
  },

  updateDataCell(event) {
    if (this.stageDataCell(event)) this.commitDataRows();
  },

  /**
   * Writes pending table edits now; false when storage refused them. They stay
   * pending and the data page keeps saying so until a save works.
   */
  commitDataRows(quiet) {
    this.clearDataSaveTimer();
    const rows = this.pendingDataRows;
    if (!rows) return true;
    if (!this.saveDataRows(rows, quiet)) {
      if (!this.data.dataSaveFailed) this.setData({ dataSaveFailed: true });
      return false;
    }
    if (this.pendingDataRows === rows) this.pendingDataRows = null;
    return true;
  },

  retryDataSave() {
    if (this.commitDataRows()) wx.showToast({ title: '已保存', icon: 'success' });
  },

  cancelDataSave() {
    this.clearDataSaveTimer();
    this.pendingDataRows = null;
  },

  clearDataSaveTimer() {
    if (this.dataSaveTimer) clearTimeout(this.dataSaveTimer);
    this.dataSaveTimer = null;
  },

  addDataRow() {
    if (!this.commitDataRows()) return;
    const rows = this.currentDataRows();
    if (rows.length >= MAX_DATA_ROWS) {
      wx.showToast({ title: `最多 ${MAX_DATA_ROWS} 行`, icon: 'none' });
      return;
    }
    this.saveDataRows(rows.concat({ id: `row-${Date.now().toString(36)}-${rows.length}`, name: '', code: '', price: '', date: '' }));
  },

  // A row with content is deleted only after a confirmation; a blank row goes at once.
  removeDataRow(event) {
    if (!this.commitDataRows()) return;
    const index = Number(event.currentTarget.dataset.index);
    const target = this.currentDataRows()[index];
    if (!target) return;
    const remove = () => {
      const rows = this.currentDataRows();
      const at = rows.indexOf(target) >= 0 ? rows.indexOf(target) : rows.findIndex((row) => row.id === target.id);
      if (at < 0) return;
      this.saveDataRows(rows.filter((item, itemIndex) => itemIndex !== at));
    };
    if (!hasRowData(target)) {
      remove();
      return;
    }
    const name = cellText(target, 'name').trim();
    wx.showModal({
      title: '删除这一行？',
      content: `第 ${index + 1} 行${name ? `「${name}」` : ''}会从表格里删掉。`,
      confirmText: '删除',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (result && result.confirm && this.commitDataRows()) remove();
      }
    });
  },

  onBatchTemplateChange(event) {
    const picks = batchPicks(this.activeFamily());
    const index = Math.max(0, Math.min(picks.length - 1, Number(event.detail.value) || 0));
    this.setData({ batchTemplateIndex: index, batchTemplateId: picks[index].id });
  },

  /**
   * Base document, rows and finished labels for the chosen batch template,
   * after every row was checked; problems are shown and null returned.
   */
  prepareBatch() {
    const base = buildCuratedBatchDocument(this.data.batchTemplateId);
    if (!base) {
      wx.showModal({ title: '该模板不支持批量生成', content: '请重新选择一个批量模板。', showCancel: false });
      return null;
    }
    const rows = batchRows(this.currentDataRows());
    if (!rows.some(hasRowData)) {
      wx.showToast({ title: '请先填写至少一行数据', icon: 'none' });
      return null;
    }
    const settings = this.data.settings || {};
    const profile = this.printerProfile || getProfile(settings.defaultProfileId);
    try {
      const documents = buildBatchDocuments(base, rows, {
        validate: (document) => validateDocument(document, profile.dpi)
      });
      return { base, rows, documents };
    } catch (error) {
      // The table has no row numbers of its own for the owner to count from, so
      // the message names the row and the screen jumps to it.
      const rowNumber = Number(error && error.rowNumber) || 0;
      const row = rowNumber ? rows[rowNumber - 1] : null;
      const name = row ? String(row.name || row.code || '').trim() : '';
      const where = row && name ? `第 ${rowNumber} 行「${name}」` : (rowNumber ? `第 ${rowNumber} 行` : '');
      wx.showModal({
        title: '这一行数据要改一下',
        content: `${where ? `${where}：` : ''}${String(error.message || '数据不符合模板要求').replace(/^第 \d+ 行[^：]*：/, '')}`,
        showCancel: false
      });
      if (rowNumber && typeof wx.pageScrollTo === 'function') {
        wx.pageScrollTo({ selector: `#data-row-${rowNumber - 1}`, offsetTop: -160, duration: 200 });
      }
      return null;
    }
  },

  /** 批量打印: the editor opens the template and prints one label per row. */
  printBatch() {
    if (!this.commitDataRows()) return;
    const batch = this.prepareBatch();
    if (!batch) return;
    this.openEditor(batch.base, '', { batch: { rows: batch.rows, source: 'data' } });
  },

  /** 生成标签（分别保存）: one saved project per row; a second tap while it runs does nothing. */
  runBatch() {
    if (this.batchSaving) return;
    if (!this.commitDataRows()) return;
    const room = Number.isFinite(this.data.projectRoom) ? this.data.projectRoom : MAX_PROJECTS;
    if (this.data.batchRowCount > room) {
      wx.showModal({
        title: '标签存不下了',
        content: `最多还能存 ${room} 个标签，这次要生成 ${this.data.batchRowCount} 个。可以减少行数，或者直接用「批量打印」，不用分别保存。`,
        showCancel: false
      });
      return;
    }
    const batch = this.prepareBatch();
    if (!batch) return;
    this.batchSaving = true;
    let created;
    try {
      created = this.repository.saveProjects(batch.documents);
    } catch (error) {
      this.batchSaving = false;
      wx.showModal({ title: '批量保存失败', content: plainMessage(error, '本机存储空间不足，这批标签没有保存。'), showCancel: false });
      return;
    }
    const first = created[0] || null;
    this.refresh();
    wx.showToast({ title: `已生成 ${created.length} 个标签`, icon: 'none' });
    // The toast has to be read before the editor slides in. The timer is kept
    // so leaving the page in between cannot open an editor from a dead page.
    clearTimeout(this.batchSavingTimer);
    this.batchSavingTimer = setTimeout(() => {
      this.batchSavingTimer = null;
      this.batchSaving = false;
      if (first && this.pageActive !== false) this.openEditor(first.document, first.id);
    }, 350);
  },

  /**
   * Lets the user pick one file sent to a WeChat chat (the only file source a
   * mini program has) and hands it to `onFile` once it is within `maxBytes`.
   */
  chooseChatFile(extension, maxBytes, tooLarge, onFile) {
    if (typeof wx.chooseMessageFile !== 'function') {
      wx.showModal({ title: '无法选择文件', content: '当前微信版本不能选择聊天里的文件，请升级微信后再试', showCancel: false });
      return;
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: [extension],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (Number(file.size) > maxBytes) {
          wx.showToast({ title: tooLarge, icon: 'none' });
          return;
        }
        onFile(file);
      },
      fail: (failure) => {
        if (isCancelled(failure)) return;
        wx.showModal({ title: '没有选到文件', content: '请先把文件发到微信聊天（如文件传输助手），再从聊天记录里选择。', showCancel: false });
      }
    });
  },

  importCsv() {
    this.chooseChatFile('csv', MAX_CSV_IMPORT_BYTES, 'CSV 文件不能超过 2 MB', (file) => {
      wx.getFileSystemManager().readFile({
        filePath: file.path,
        encoding: 'utf8',
        success: (readResult) => this.applyCsvText(readResult.data),
        fail: () => wx.showModal({ title: 'CSV 导入失败', content: CSV_READ_FAILED, showCancel: false })
      });
    });
  },

  applyCsvText(text) {
    let parsed;
    try {
      parsed = parseDataCsv(text);
    } catch (error) {
      wx.showModal({ title: 'CSV 导入失败', content: error.message || CSV_READ_FAILED, showCancel: false });
      return;
    }
    // An empty or unreadable file must not wipe the rows already in the table.
    if (!parsed.records.length) {
      wx.showModal({ title: 'CSV 导入失败', content: '文件里没有找到数据行。', showCancel: false });
      return;
    }
    // Excel has already turned long codes into 6.90123E+12: the digits are
    // gone, so importing would print wrong barcodes.
    const damaged = findExcelDamagedCodes(parsed.records);
    if (damaged.length) {
      const where = damaged.length > 3 ? `第 ${damaged.slice(0, 3).join('、')} 等 ${damaged.length} 行` : `第 ${damaged.join('、')} 行`;
      wx.showModal({
        title: '条码被 Excel 改坏了',
        content: `${where}的编码变成了“${parsed.records[damaged[0] - 1].code}”这种写法，后面的数字已经丢了。请在 Excel 里把条码列设成「文本」，重新填好编码，再另存为 CSV UTF-8 后导入。`,
        showCancel: false
      });
      return;
    }
    const stamp = Date.now().toString(36);
    const records = parsed.records.map((item, index) => Object.assign({ id: `csv-${stamp}-${index}` }, item));
    // Rows the user typed are never wiped without asking.
    const existing = this.currentDataRows();
    const kept = userRowCount(existing);
    if (!kept) {
      this.importCsvRecords(records, []);
      return;
    }
    wx.showActionSheet({
      alertText: `表格里已有 ${kept} 行数据`,
      itemList: [`替换现有 ${kept} 行`, '追加到后面'],
      success: (result) => {
        if (!result || (result.tapIndex !== 0 && result.tapIndex !== 1)) return;
        if (result.tapIndex === 0) {
          this.importCsvRecords(records, []);
          return;
        }
        if (!this.commitDataRows()) return;
        this.importCsvRecords(records, this.currentDataRows().filter((row) => hasRowData(row) && !isSampleRow(row)));
      }
    });
  },

  /** Puts imported rows after `kept`, within the table limit, and says how it went. */
  importCsvRecords(records, kept) {
    const room = Math.max(0, MAX_DATA_ROWS - kept.length);
    const added = records.slice(0, room);
    this.cancelDataSave();
    if (!this.saveDataRows(kept.concat(added))) return;
    if (added.length < records.length) {
      wx.showModal({
        title: '只导入了一部分',
        content: `表格最多 ${MAX_DATA_ROWS} 行，这次导入了前 ${added.length} 行，后面 ${records.length - added.length} 行没有导入。`,
        showCancel: false
      });
      return;
    }
    wx.showToast({ title: kept.length ? `已追加 ${added.length} 行` : `已导入 ${added.length} 行`, icon: 'none' });
  },

  // Must stay synchronous: WeChat only opens the send-file sheet inside the tap.
  exportCsv() {
    this.commitDataRows(true);
    const day = dayStamp(new Date());
    shareTextFileSync(wx, {
      fileName: `shangyue-data-${day}.csv`,
      displayName: `商跃标签数据-${day}.csv`,
      content: stringifyDataCsv(this.currentDataRows()),
      replacePrefix: ['shangyue-data-', 'niim-label-data']
    });
  },

  // Must stay synchronous: WeChat only opens the send-file sheet inside the tap.
  exportBackup() {
    let content;
    try {
      content = JSON.stringify(this.repository.backup(), null, 2);
    } catch (error) {
      wx.showModal({ title: '备份失败', content: error.message || '本机数据读取失败，请重试', showCancel: false });
      return;
    }
    const now = new Date();
    const stamp = `${dayStamp(now)}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    shareTextFileSync(wx, {
      fileName: `shangyue-backup-${stamp}.json`,
      displayName: `商跃标签备份-${stamp}.json`,
      content,
      replacePrefix: ['shangyue-backup-', 'niim-label-backup-']
    });
  },

  importBackup() {
    this.chooseChatFile('json', MAX_BACKUP_IMPORT_BYTES, '备份文件不能超过 5 MB', (file) => {
      wx.getFileSystemManager().readFile({
        filePath: file.path,
        encoding: 'utf8',
        success: (readResult) => {
          try {
            const payload = JSON.parse(readResult.data);
            // Check the whole file first: a wrong or damaged file is reported
            // before anyone is asked to overwrite their labels.
            const checked = this.repository.inspectBackup(payload);
            wx.showModal({
              title: '确认恢复备份',
              content: `备份里有 ${checked.projects.length} 个标签、${checked.templates.length} 个模板。恢复会替换这台手机上现有的标签、模板、批量数据和设置，确定继续吗？`,
              confirmText: '覆盖恢复',
              confirmColor: BRAND_RED,
              success: (choice) => {
                if (!choice.confirm) return;
                try {
                  // Restored rows win over a table edit still waiting to be saved.
                  this.cancelDataSave();
                  const restored = this.repository.restore(payload);
                  this.refresh();
                  wx.showToast({ title: `已恢复 ${restored.projects} 个标签`, icon: 'none' });
                } catch (error) {
                  wx.showModal({ title: '恢复失败', content: plainMessage(error, '备份文件无效'), showCancel: false });
                }
              }
            });
          } catch (error) {
            wx.showModal({ title: '恢复失败', content: plainMessage(error, '备份文件无效或不完整，请重新导出一份再试。'), showCancel: false });
          }
        },
        fail: () => wx.showModal({ title: '恢复失败', content: '备份文件没有读出来，请重新选择备份文件。', showCancel: false })
      });
    });
  },

  // While a file is being imported (pictures can take a while to download) a
  // loading mask is shown and further taps are ignored, so nothing is
  // imported twice.
  importTemplateFile() {
    if (this.templateImporting) return;
    this.chooseChatFile('json', MAX_TEMPLATE_IMPORT_BYTES, '模板文件不能超过 2 MB', (file) => {
      if (this.templateImporting) return;
      this.templateImporting = true;
      if (typeof wx.showLoading === 'function') wx.showLoading({ title: '正在导入模板', mask: true });
      const finish = () => {
        this.templateImporting = false;
        if (typeof wx.hideLoading === 'function') wx.hideLoading();
      };
      wx.getFileSystemManager().readFile({
        filePath: file.path,
        encoding: 'utf8',
        success: async (readResult) => {
          let document = null;
          let payload = null;
          try {
            payload = JSON.parse(readResult.data);
            if (payload && Array.isArray(payload.templates)) {
              // 电脑标签设计器导出的整包：图片是 data URL，先落成本地文件
              const templates = [];
              for (const item of payload.templates) {
                if (item && item.document && typeof item.document === 'object') {
                  templates.push(Object.assign({}, item, { document: await materializeDataUrlImages(wx, item.document) }));
                } else {
                  templates.push(item);
                }
              }
              finish();
              if (this.pageActive === false) return;
              this.importTemplatePack(Object.assign({}, payload, { templates }));
              return;
            }
            document = normalizeDocument(await materializeDataUrlImages(wx, payload.document || payload));
            if (!document) document = importNiimTemplate(payload, { allowRemoteImages: true }).document;
            const localized = await localizeDocumentImages(wx, document);
            finish();
            if (this.pageActive === false) return;
            this.saveImportedTemplate(localized, payload.name || localized.name || file.name);
          } catch (error) {
            finish();
            if (error && error.code === 'IMAGE_DOWNLOAD_FAILED' && document) {
              this.offerTemplateWithoutImages(document, (payload && payload.name) || document.name || file.name);
              return;
            }
            wx.showModal({ title: '模板导入失败', content: plainMessage(error, '这个文件不是能用的模板，请重新导出后再试'), showCancel: false });
          }
        },
        fail: () => {
          finish();
          wx.showToast({ title: '读取模板失败', icon: 'none' });
        }
      });
    });
  },

  saveImportedTemplate(document, name) {
    let template;
    try {
      template = this.repository.saveUserTemplate(document, name);
    } catch (error) {
      wx.showModal({ title: '模板导入失败', content: plainMessage(error, '模板没有保存，请重试'), showCancel: false });
      return;
    }
    this.refresh();
    wx.showToast({ title: `已导入“${template.name}”`, icon: 'none' });
  },

  // The template's pictures are online and did not download: say so, and
  // offer the template without them (their frames stay, ready for a picture).
  offerTemplateWithoutImages(document, name) {
    wx.showModal({
      title: '模板图片没下载下来',
      content: '这个模板里的图片要联网下载，现在没有下载成功。可以先导入不带图片的模板，以后在编辑器里换上图片；也可以检查网络后重新导入。',
      confirmText: '不带图片',
      cancelText: '取消',
      success: (choice) => {
        if (!choice || !choice.confirm || this.pageActive === false) return;
        const withoutImages = JSON.parse(JSON.stringify(document));
        withoutImages.elements.forEach((element) => {
          if ((element.type === 'image' || element.type === 'material') && isRemoteImage(element.path)) element.path = '';
        });
        this.saveImportedTemplate(withoutImages, name);
      }
    });
  },

  importTemplatePack(payload) {
    const result = this.repository.importUserTemplates(payload.templates);
    this.refresh();
    if (!result.imported) {
      wx.showModal({
        title: '模板包未导入',
        content: result.overflow
          ? '「我的模板」已满（上限 80 个），请先删除部分模板后再导入。'
          : '模板包里没有可用的模板数据。',
        showCancel: false
      });
      return;
    }
    const parts = [`已导入 ${result.imported} 个模板到「我的模板」`];
    if (result.overflow) parts.push(`${result.overflow} 个超出 80 个上限未导入`);
    if (result.invalid) parts.push(`${result.invalid} 个数据无效已跳过`);
    wx.showModal({
      title: '模板包导入完成',
      content: `${parts.join('；')}。`,
      showCancel: false
    });
  },

  openDevices() {
    this.setData({ showDevices: true });
  },

  closeDevices() {
    this.setData({ showDevices: false });
    // 忘记设备 in the picker changes which templates the shelf should offer.
    const profile = rememberedProfile(appConnectionManager(), this.data.settings);
    if ((profile ? profile.family : '') !== (this.data.printerFamily || '')) this.refresh();
  },

  /** The picker connected a printer: remember its model and show what it prints. */
  onPrinterConnected(event) {
    const detail = event && event.detail || {};
    const result = detail.result || {};
    const device = detail.device || {};
    const name = result.name || device.name || device.localName || '打印机';
    this.setData({ showDevices: false });
    wx.showToast({ title: `已连接 ${name}`, icon: 'none' });
    const manager = appConnectionManager();
    const deviceId = result.deviceId || device.deviceId || '';
    const confirmedProfileId = deviceId && manager && typeof manager.getConfirmedProfileId === 'function'
      ? manager.getConfirmedProfileId(deviceId)
      : '';
    const profile = savedPrinterProfile(Object.assign({}, result, {
      name: result.name || device.name || device.localName,
      confirmedProfileId
    }));
    if (profile) {
      try {
        this.repository.saveSettings({ defaultProfileId: profile.id });
      } catch (error) {
        // Only the model preselection is lost; the printer itself is connected.
      }
    }
    this.refresh();
  }
});
