const { BleSession } = require('../../../services/ble-session');
const { PrinterClient } = require('../../../services/printer-client');
const { describeBleError } = require('../../../services/ble-errors');
const { sweepOrphanImages } = require('../../../services/image-files');
const { templates: catalogTemplates } = require('../../../app/catalog');
const { assertBatchCompatible, buildBatchDocuments } = require('../../../app/data-bind');
const { buildTemplateDocument } = require('../../../app/template-layouts');
const { buildCuratedDocument, normalizeSearchText, queryCuratedMeta } = require('../../../app/curated');
const {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  elementTypeLabel,
  hitTest,
  fitImageToPicture,
  hitTestAll,
  placeNewElement
} = require('../../../core/document');
const {
  changeTextMode,
  clampGroupDelta,
  fitElementToSelectionBounds,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  scaleRotatedElement,
  selectionHandleModeAtPoint,
  snapElementPosition
} = require('../../../core/geometry');
const { BORDER_CATALOG } = require('../../../core/borders');
const { MATERIAL_CATALOG, MATERIAL_CHIPS } = require('../../../core/materials');
const {
  cropImageData,
  evaluatePrintability,
  getProfile,
  marginInkMessage,
  marginInkReport,
  previewCanvasSize,
  printRasterPlan,
  PROFILES,
  printerNameProfileId,
  profileForPrinterName
} = require('../../../core/profiles');
const {
  dateShowsTime,
  dateStyleOf,
  dateStylePatch,
  dateTimePatch,
  formatDateValue,
  renderDocument,
  renderSelection,
  serialValue,
  validateDocument
} = require('../../../core/renderer');
const { TEXT_MODE_OPTIONS } = require('../../../core/text-direction');
const {
  longPressSelection,
  nextSelectionId,
  selectionHitDecision,
  selectionTargetSizeMm
} = require('../../../core/editor-gesture');
const { createImageCacheRegistry } = require('../../../core/image-cache');
const { applyScanToElement } = require('../../../core/scan-label');
const { linkedCodeValue, syncLinkedCodes } = require('../../../core/linked-codes');
const { applySerialAdvance, serialAdvancePlan } = require('../../../core/serial-advance');
const { DOCUMENT_LIMITS, KEYS, Repository, normalizeDocument } = require('../../../services/repository');
const { STOCK_PRESETS } = require('../../../app/stock-presets');
const { scanCode, showScanFailure } = require('../../../services/scanner');
const { EditorSession } = require('../../../services/editor-session');
const { PrintJobService } = require('../../../services/print-job-service');
const { collectDocumentFontIds, fontFallbackInfo, listFontCatalog, resolveFontId } = require('../../../core/font-family');
const { ensureDocumentFonts, ensureFont } = require('../../../core/font-loader');
const { resizeCodeElementToMinimum } = require('../../../core/code-quality');

function fontRuntime() {
  return { wx: typeof wx === 'undefined' ? null : wx };
}

const EDITOR_FONT_CATALOG = listFontCatalog();
const EDITOR_REMOTE_FONT_COUNT = EDITOR_FONT_CATALOG.filter((font) => font.remote).length;
const EDITOR_FONT_CATALOG_NOTE = `共 ${EDITOR_FONT_CATALOG.length} 款字体，其中 ${EDITOR_REMOTE_FONT_COUNT} 款第一次用时要联网下载`;
const FONT_FAILURE_TOAST = '字体下载失败，已先用系统字体显示，联网后可再试';
const PRINT_LEAVE_MESSAGE = '正在打印，离开会中断打印。确定要离开吗？';
const SHARE_TITLE = '商跃标签：手机设计标签，蓝牙直接打印';
// Data columns a batch row fills, with the names the 批量数据 page shows.
const BATCH_FIELD_LABELS = { name: '名称', code: '编码', price: '价格', date: '日期' };

// Anchors inside the panel's scroll-view, targeted with scroll-into-view.
const PANEL_TOP_ID = 'panel-tools';
const CONTENT_FIELD_ID = 'content-field';
// WeChat fires longpress at 350 ms; a longer hold is not a tap.
const TAP_MAX_MS = 350;

const MILLIMETERS_PER_INCH = 25.4;
const PREVIEW_WIDTH_RPX = 672;
// Chrome around the canvas, in rpx; they mirror editor/index.wxss (header 88 +
// document row 64, stage padding 72 + 80, panel 440…640 capped at 48vh). A CSS
// change here only makes the fitted preview slightly smaller or larger.
const PREVIEW_CHROME = Object.freeze({
  headerRpx: 152,
  stagePaddingRpx: 152,
  panelMinRpx: 440,
  panelMaxRpx: 640,
  panelViewportRatio: 0.48,
  safety: 0.96
});
let previewCanvasInstanceSequence = 0;
// The same paper sizes as the home page's paper picker.
const SIZE_OPTIONS = STOCK_PRESETS.map((item) => ({
  label: `${item.widthMm}×${item.heightMm} mm`,
  width: item.widthMm,
  height: item.heightMm
}));

function sizeLabel(documentValue) {
  return `${documentValue.widthMm}×${documentValue.heightMm} mm`;
}

// The size list for a label: the common sizes, led by the label's own size
// when it is not one of them, so the picker opens on the current size and
// confirming it changes nothing.
function sizeChoices(documentValue) {
  const current = SIZE_OPTIONS.find((item) => item.width === documentValue.widthMm && item.height === documentValue.heightMm);
  if (current) return SIZE_OPTIONS;
  return [{
    label: `当前 ${sizeLabel(documentValue)}`,
    width: documentValue.widthMm,
    height: documentValue.heightMm
  }].concat(SIZE_OPTIONS);
}

// Inspector number fields and the range each one keeps; the label is saved
// with the same limits (services/repository.js), so what the canvas shows
// is what reopens.
const FIELD_RANGES = {
  width: [0.5, Infinity],
  height: [0.5, Infinity],
  fontSize: [DOCUMENT_LIMITS.minFontSizeMm, DOCUMENT_LIMITS.maxFontSizeMm],
  letterSpacing: [DOCUMENT_LIMITS.minLetterSpacingMm, DOCUMENT_LIMITS.maxLetterSpacingMm],
  lineSpacing: [DOCUMENT_LIMITS.minLineSpacing, DOCUMENT_LIMITS.maxLineSpacing],
  lineWidth: [0.1, 10],
  threshold: [0, 255],
  digits: [1, DOCUMENT_LIMITS.maxSerialDigits],
  start: [0, 999999999999],
  step: [1, 9999],
  offsetDays: [-3650, 3650],
  offsetHours: [-87600, 87600],
  expirePresetHours: [0, 87600],
  textArcAngle: [0, 360]
};
const INTEGER_FIELDS = ['digits', 'start', 'step', 'offsetDays', 'offsetHours', 'expirePresetHours'];

function fieldValueInRange(field, value) {
  const range = FIELD_RANGES[field];
  let next = INTEGER_FIELDS.includes(field) ? Math.round(value) : value;
  if (range) next = Math.max(range[0], Math.min(range[1], next));
  return next;
}

function roundMm(value) {
  return Math.round(Number(value) * 100) / 100;
}

// The words printed before a date for each role. Switching the role swaps
// them, unless the label says something of its own.
const DATE_ROLE_LABELS = { made: '制作日期', expire: '保质期至', generic: '' };
const STOCK_DATE_LABELS = ['制作日期', '生产日期', '保质期至', '有效至', '有效期至', '到期', '到期日期'];

function dateRolePatch(element, role) {
  const patch = { dateRole: role };
  const label = String(element.label || '');
  if (!label || STOCK_DATE_LABELS.includes(label)) patch.label = DATE_ROLE_LABELS[role] || '';
  return patch;
}

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

// The inspector field holding what an element prints, when it has one to type
// into. A code that follows the serial number has no field of its own.
function contentFieldOf(element) {
  if (!element) return '';
  if (element.type === 'text') return 'text';
  if ((element.type === 'barcode' || element.type === 'qrcode') && !element.serialLinked) return 'value';
  if (element.type === 'serial') return 'prefix';
  return '';
}

function paperSizeChanged(before, after) {
  return before.widthMm !== after.widthMm || before.heightMm !== after.heightMm;
}

function updateInputConfirmationAfterEdit(element, field) {
  const isEditableContent = element && (
    (element.type === 'text' && field === 'text')
    || ((element.type === 'barcode' || element.type === 'qrcode') && field === 'value')
  );
  if (!isEditableContent) return element;
  const value = element.type === 'text' ? element.text : element.value;
  // Text the user edited is theirs, even when they emptied it. An empty code
  // cannot print, so it still asks for content.
  element.requiresInput = element.type !== 'text' && !String(value == null ? '' : value).trim();
  element.requiresInputReason = element.requiresInput ? 'empty-code' : undefined;
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

// Photos are scaled down to this many pixels on their longest side when they
// are imported: a thermal label prints a few hundred dots across, and decoding
// and converting a 12 megapixel photo is what made pictures slow.
const MAX_IMAGE_EDGE = 1600;
const TURNED_ORIENTATIONS = ['left', 'right', 'left-mirrored', 'right-mirrored'];

function wxCall(name, options) {
  return new Promise((resolve, reject) => {
    if (typeof wx[name] !== 'function') {
      reject(new Error(`${name} is not available`));
      return;
    }
    wx[name](Object.assign({}, options, { success: resolve, fail: reject }));
  });
}

// The picture at `source`, scaled down when it is a photo larger than
// MAX_IMAGE_EDGE. Only JPEG photos are scaled: compressing writes JPEG, which
// would turn the clear background of a PNG logo black. Any failure keeps the
// original picture.
function shrinkLargeImage(source) {
  return wxCall('getImageInfo', { src: source }).then((info) => {
    const turned = TURNED_ORIENTATIONS.includes(info.orientation);
    const width = Number(turned ? info.height : info.width) || 0;
    const height = Number(turned ? info.width : info.height) || 0;
    const original = { path: source, width, height };
    if (Math.max(width, height) <= MAX_IMAGE_EDGE || !/^jpe?g$/i.test(String(info.type || ''))) return original;
    const size = width >= height ? { compressedWidth: MAX_IMAGE_EDGE } : { compressedHeight: MAX_IMAGE_EDGE };
    return wxCall('compressImage', Object.assign({ src: source, quality: 85 }, size))
      .then((result) => (result && result.tempFilePath ? Object.assign(original, { path: result.tempFilePath }) : original))
      .catch(() => original);
  }).catch(() => ({ path: source, width: 0, height: 0 }));
}

// Copies a picture into the mini program's own storage, where it outlives
// the temporary file and stays with the saved label.
function keepImageFile(source) {
  const extensionMatch = String(source).match(/\.[a-zA-Z0-9]+$/);
  const extension = extensionMatch ? extensionMatch[0] : '.jpg';
  const destination = `${wx.env.USER_DATA_PATH}/label-image-${Date.now()}${extension}`;
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().copyFile({
      srcPath: source,
      destPath: destination,
      success: () => resolve(destination),
      fail: reject
    });
  });
}

function previewFrameWidth(windowInfo) {
  const windowWidth = Number(windowInfo && windowInfo.windowWidth);
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return 0;
  return windowWidth * PREVIEW_WIDTH_RPX / 750;
}

function previewFrameHeight(documentValue, windowInfo) {
  const widthMm = Number(documentValue && documentValue.widthMm);
  const heightMm = Number(documentValue && documentValue.heightMm);
  const frameWidth = previewFrameWidth(windowInfo);
  if (!frameWidth
    || !Number.isFinite(widthMm) || widthMm <= 0
    || !Number.isFinite(heightMm) || heightMm <= 0) {
    return 1;
  }
  // Keep the unrounded ratio for CSS. Rounding to an integer pixel is visible
  // on narrow/tall labels and makes the two overlaid canvases drift at edges.
  return Number((frameWidth * heightMm / widthMm).toFixed(4));
}

/**
 * How tall the label may be before the stage cuts it off, in px. A 40 x 60 mm
 * label used to show only ~59% of itself on a 375 x 667 phone with no way to
 * reach the rest: the canvas swallows every drag.
 */
function stageAvailableHeight(windowInfo, options) {
  const windowHeight = Number(windowInfo && windowInfo.windowHeight);
  const frameWidth = previewFrameWidth(windowInfo);
  if (!windowHeight || !frameWidth) return 0;
  const rpx = Number(windowInfo && windowInfo.windowWidth) / 750;
  const config = options || {};
  const safeTop = Math.max(0, Number(config.safeTop) || 0);
  const keyboard = Math.max(0, Number(config.keyboardHeight) || 0);
  const panel = Math.max(
    PREVIEW_CHROME.panelMinRpx * rpx,
    Math.min(PREVIEW_CHROME.panelMaxRpx * rpx, windowHeight * PREVIEW_CHROME.panelViewportRatio)
  );
  const chromeRpx = PREVIEW_CHROME.headerRpx + PREVIEW_CHROME.stagePaddingRpx;
  const available = windowHeight - safeTop - keyboard - chromeRpx * rpx - panel;
  return available > 0 ? available * PREVIEW_CHROME.safety : 0;
}

/** 1 when the label fits the stage; smaller when the whole label must fit. */
function previewFitScale(frameHeightPx, availableHeightPx) {
  const frame = Number(frameHeightPx);
  const available = Number(availableHeightPx);
  if (!Number.isFinite(frame) || frame <= 0) return 1;
  if (!Number.isFinite(available) || available <= 0) return 1;
  return frame <= available ? 1 : available / frame;
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
    // A text box the user emptied on purpose prints blank; text nobody has
    // filled in yet, or a data field left empty, stops the print.
    if (element.requiresInput === true || (!value && element.bindField) || value === '双击编辑'
      || value === '双击文本框编辑' || value === '点击后编辑文字') {
      return '还有文字没改，请改成你要的内容，或者删掉这个文本框';
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
    messages.push(`模板里有 ${Number(meta.missingImageCount)} 张图片没带过来，请重新添加`);
  }
  if (meta.sizeClamped) {
    messages.push(`原模板太大，已缩成 ${documentValue.widthMm}×${documentValue.heightMm} mm`);
  }
  if (liveUnsupported > 0) {
    messages.push(`有 ${liveUnsupported} 个条码要选条码类型`);
  }
  if (liveInvalid > 0) {
    messages.push(`有 ${liveInvalid} 个条码内容不对`);
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
    // The chips below the title filter on these; the catalogue already carries them.
    category: item.category || '',
    tags: Array.isArray(item.tags) ? item.tags.slice() : []
  };
}

const MATERIAL_CHIP_ALL = '全部';
// '全部' first, then the catalogue's own groups (最新/警示/物流…).
const MATERIAL_CHIP_LIST = [MATERIAL_CHIP_ALL].concat(MATERIAL_CHIPS);

function borderOption(item) {
  return {
    id: item.id,
    label: item.label,
    previewSrc: previewAssetPath(item.previewSrc || item.asset)
  };
}

function friendlyPrintError(error) {
  const code = error && error.code;
  // The print-area checks already say what to change, in plain words.
  if ((code === 'MARGIN_INK' || code === 'PAPER_TOO_LARGE') && error.message) return error.message;
  // A connected device that cannot take print data says so itself.
  if (code === 'NO_PRINT_CHANNEL' && error.message) return error.message;
  const raw = String(error && error.message || '打印失败');
  if (/断开|disconnect|未连接|not connected|no connection/i.test(raw)) return '打印机连接已断开，请靠近后重新连接再试';
  if (/缺纸|no paper|paper/i.test(raw)) return '打印机缺纸或纸仓未合上，装好标签纸后重试';
  if (/上盖|纸仓盖|cover/i.test(raw)) return '打印机上盖未关闭，请合上纸仓盖后重试';
  if (/电量|电池|battery/i.test(raw)) return '打印机电量过低，请充电后重试';
  if (/过热|温度过高|overheat/i.test(raw)) return '打印头温度过高，请稍等片刻再打印';
  if (/正忙|busy|尚未完成当前任务/i.test(raw)) return '打印机正忙，请等待当前任务结束后重试';
  if (/位图宽度|超过打印头/.test(raw)) return '标签比这台打印机能打的宽度还宽，请换小一点的尺寸或换纸宽';
  if (/协议协商|协议尚未|handshake/i.test(raw)) return '打印机没有正常回应，请把打印机关机再开机，然后重新连接';
  if (/超时|timeout/i.test(raw)) return '打印机没有响应，请检查电源与纸仓后重试';
  if (/MTU|载荷|写入特征|通知特征|BLE 服务|writeBLE|readBLE|notifyBLE|BLECharacteristic|BLEConnection|GATT|characteristic/i.test(raw)) {
    return '蓝牙传输出现问题，请重新连接打印机后再试';
  }
  // Raw platform errors with no Chinese copy (e.g. "operateBLECharacteristic:fail")
  // get the plain Bluetooth explanation instead.
  if (!/[\u4e00-\u9fff]/.test(raw)) {
    return describeBleError(error, { api: typeof wx === 'undefined' ? null : wx }).message;
  }
  return raw;
}

function hasText(value) {
  return Boolean(String(value == null ? '' : value).trim());
}

// Rows with something to print; printing skips blank rows.
function filledRowCount(batch) {
  const rows = batch && Array.isArray(batch.rows) ? batch.rows : [];
  return rows.filter((row) => row && Object.keys(BATCH_FIELD_LABELS).some((field) => hasText(row[field]))).length;
}

function batchPrintBlock(error) {
  // A row that fails on one element of the design (a code too dense for its
  // value, say) can jump to that element; the fix is made in the design.
  const cause = error && error.cause;
  return {
    kind: 'batch',
    message: (error && error.message) || '批量数据无法生成标签，请检查后再试。',
    elementId: (cause && cause.elementId) || '',
    suggestProfileId: ''
  };
}

// Names the data row a label came from. An empty label or paper that does
// not fit is the same for every row; an empty field bound to a data column
// is fixed in that row's data, not in the design.
function rowPrintBlock(block, rowNumber, documentValue) {
  if (block.kind === 'empty' || (block.kind === 'size' && block.reason === 'PAPER_TOO_LARGE')) return block;
  const element = block.kind === 'placeholder'
    ? documentValue.elements.find((item) => item.id === block.elementId)
    : null;
  const field = element && BATCH_FIELD_LABELS[element.bindField];
  if (field && !hasText(element.type === 'text' ? element.text : element.value)) {
    return Object.assign({}, block, {
      message: `第 ${rowNumber} 行：${field}是空的，请在批量数据里填上这一格`,
      elementId: '',
      canConfirmOriginal: false
    });
  }
  return Object.assign({}, block, { message: `第 ${rowNumber} 行：${block.message}` });
}

// Progress text before each page of a batch. Without a serial number one
// page carries every copy of its row.
function batchPageMessage(index, total, info, copies) {
  const perPage = total === info.totalDocuments ? Math.max(1, Number(copies) || 1) : 1;
  const first = index * perPage + 1;
  const last = first + perPage - 1;
  const labels = total * perPage;
  return first === last ? `正在打印第 ${first}/${labels} 张` : `正在打印第 ${first}-${last}/${labels} 张`;
}

// Every label of a job in one document. Data rows only change text and
// codes, so fonts and pictures load once for the whole batch.
function combinedDocument(documents) {
  if (documents.length === 1) return documents[0];
  const elements = [];
  documents.forEach((documentValue) => elements.push(...documentValue.elements));
  return { elements };
}

function clampDensity(value, profile) {
  const density = Number(value);
  if (!Number.isFinite(density)) return profile.densityDefault;
  return Math.max(profile.densityMin, Math.min(profile.densityMax, density));
}

Page({
  data: {
    profileOptions: PROFILES.map((item) => item.name),
    profileIndex: 0,
    sizeOptions: SIZE_OPTIONS.map((item) => item.label),
    sizeIndex: 1,
    labelTypeOptions: ['间隙纸', '黑标纸', '连续纸', '定孔纸'],
    qrCorrectionOptions: ['L', 'M', 'Q', 'H'],
    qrCorrectionLabels: { L: '低', M: '中', Q: '较高', H: '高' },
    labelTypeIndex: 0,
    density: 2,
    densityMin: 1,
    densityMax: 3,
    // ESC/POS printers keep their own density, so there is nothing to set.
    densityAdjustable: true,
    threshold: 180,
    copies: 1,
    copiesInput: '1',
    loadError: '',
    saveState: '',
    keyboardHeight: 0,
    previewHeightPx: 104,
    previewWidthPx: 336,
    previewFitPercent: 100,
    canvasInstanceId: '',
    canvasReady: false,
    canvasError: '',
    document: null,
    layers: [],
    selected: null,
    selectionCount: 0,
    multiSelect: false,
    canUndo: false,
    canRedo: false,
    templates: [],
    templateNames: [],
    templateQuery: '',
    templateCards: [],
    showDevices: false,
    codeScanning: false,
    connectionState: 'disconnected',
    connectionLabel: '未连接',
    connectedDevice: '',
    printing: false,
    printProgress: 0,
    printMessage: '',
    projectId: '',
    editorPanelTab: 'elements',
    elementTools: ELEMENT_TOOLS,
    textModeOptions: TEXT_MODE_OPTIONS,
    materialChips: MATERIAL_CHIP_LIST,
    materialChip: MATERIAL_CHIP_ALL,
    materialOptions: MATERIAL_CATALOG.map(materialOption),
    borderOptions: BORDER_CATALOG.map(borderOption),
    showPrintSheet: false,
    showSettingsSheet: false,
    showLayersSheet: false,
    showMaterialSheet: false,
    showBorderSheet: false,
    printBlock: null,
    printError: '',
    printMayHavePrinted: false,
    printAreaNote: '',
    suggestedProfileName: '',
    savedPrinterName: '',
    batchRowCount: 0,
    contentFocus: false,
    panelScrollTarget: '',
    fontLoading: {},
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
    this.printTaskGeneration = 0;
    this.bindKeyboard();
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
      this.loadTemplates(state.document);
    } catch (error) {
      this.setData({ loadError: error.message || '本地标签读取失败，请重试' });
      return;
    }
    this.setData({ loadError: '' });
    this.profile = getProfile(settings.defaultProfileId);
    // 'device' when the user chose this model for the connected printer,
    // 'auto' when taken from the printer's name, 'manual' when picked by hand,
    // 'default' from settings.
    this.profileSource = 'default';
    this.connectedDeviceId = '';
    this.projectId = state.projectId || '';
    this.dirtySinceSave = state.dirtySinceSave;
    this.document = state.document;
    // Rows handed over by the 批量数据 page print one label each.
    this.batch = filledRowCount(state.batch) ? state.batch : null;
    // Templates often start with a locked backdrop; select what the user edits.
    const firstEditable = this.document.elements.find((item) => !item.locked) || this.document.elements[0];
    this.selectedId = firstEditable ? firstEditable.id : '';
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
        this.applyLinkState(state);
      });
      this.applyLinkState(this.connectionManager.getState());
    }
    const profileIndex = PROFILES.findIndex((item) => item.id === this.profile.id);
    this.setData({
      profileIndex,
      density: clampDensity(Number(settings.density) || this.profile.densityDefault, this.profile),
      densityMin: this.profile.densityMin,
      densityMax: this.profile.densityMax,
      densityAdjustable: this.profile.densityMax > this.profile.densityMin,
      threshold: Number(settings.threshold) || 180,
      labelTypeIndex: Math.max(0, Math.min(3, (Number(settings.labelType) || 1) - 1)),
      projectId: this.projectId,
      batchRowCount: filledRowCount(this.batch),
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
    // Set only once the editor really closes: a cancelled exit must not send
    // a later visit home to the data page.
    if (this.exitRoute === 'data') {
      try {
        wx.setStorageSync(KEYS.pendingHomeRoute, 'data');
      } catch (error) {
        // Falling back to the plain home route is acceptable.
      }
    }
    wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) });
  },

  async onUnload() {
    // A system navigation can unload the page before the focused input emits
    // blur. Persist the latest live preview so typed text is never discarded.
    const fieldCommitted = this.commitFieldEditDraft();
    if (!fieldCommitted && this.document && !this.discardedSession && !this.data.loadError) this.persistDocument();
    this.pageActive = false;
    this.unbindKeyboard();
    this.printCancelRequested = true;
    this.printTaskGeneration = (this.printTaskGeneration || 0) + 1;
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
    // After the last autosave: everything this page still uses is in the store.
    this.sweepImageFiles();
  },

  onHide() {
    if (this.document && !this.discardedSession && !this.data.loadError) {
      if (!this.commitFieldEditDraft()) this.persistDocument();
    }
    // The picker stays open: Bluetooth/permission settings hide this page, and
    // the picker searches again on return so the user can connect right away.
  },

  onShareAppMessage() {
    return { title: SHARE_TITLE, path: '/pages/home/index' };
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
      // "已自动保存" next to "有未保存的修改" made owners guess what was saved:
      // the draft is the editor's own copy, the label is what 标签 shows.
      this.setData({
        saveState: this.projectId && !this.dirtySinceSave ? '已保存为标签' : '草稿已保存 · 未存为标签'
      });
      return true;
    } catch (error) {
      this.setData({ saveState: '草稿保存失败，请勿退出，点此重试' });
      return false;
    }
  },

  // The template picker, led by templates of the label's own size (built-in,
  // then scene templates), so choosing one keeps the paper the label is made
  // for; then the user's templates and the other built-in ones. Built-in and
  // scene templates are built only when chosen (applyTemplate).
  loadTemplates(documentValue) {
    const label = documentValue || this.document;
    const widthMm = label ? Number(label.widthMm) : 0;
    const heightMm = label ? Number(label.heightMm) : 0;
    const size = `${widthMm}×${heightMm}`;
    const builtIn = catalogTemplates
      .filter((item) => item.publicCatalog === true && item.releaseApproved === true)
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: `${item.name}（${item.size[0]}×${item.size[1]} · 商跃原创）`,
        builtinId: item.id,
        sameSize: item.size[0] === widthMm && item.size[1] === heightMm,
        source: item.source,
        approvalStatus: item.approvalStatus,
        thumbSrc: item.thumbSrc || '',
        kind: item.kind || ''
      }));
    const scenes = widthMm && heightMm
      ? queryCuratedMeta({ size, family: this.profile ? this.profile.family : '', limit: 300 }).items.map((item) => ({
        id: item.id,
        name: item.name,
        displayName: `${item.name}（${size}）`,
        curatedId: item.id,
        source: item.source,
        approvalStatus: item.approvalStatus,
        // The card shows the paper size and the kind of code it carries.
        size: Array.isArray(item.size) ? item.size : null,
        kind: item.kind || ''
      }))
      : [];
    const userTemplates = this.repository.getUserTemplates().map((item) => Object.assign({ source: 'user' }, item, {
      displayName: `${item.name}（我的）`
    }));
    const templates = builtIn.filter((item) => item.sameSize)
      .concat(scenes, userTemplates, builtIn.filter((item) => !item.sameSize));
    this.setData({
      templates,
      templateNames: templates.length ? templates.map((item) => item.displayName || item.name) : ['暂无模板'],
      templateCards: this.templateCardsFor(templates, this.data.templateQuery)
    });
  },

  /**
   * The picker renders a searchable list instead of a 70-item native wheel:
   * name, paper size and where the template comes from, with the catalogue
   * thumbnail where there is one.
   */
  templateCardsFor(templates, query) {
    // The same normalisation as the shelf: "50x30", "50*30" and "50 30" all find
    // a 50×30 template.
    const needle = normalizeSearchText(String(query == null ? '' : query));
    const list = Array.isArray(templates) ? templates : [];
    return list.map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!needle) return true;
        const size = Array.isArray(item.size) ? `${item.size[0]}×${item.size[1]}` : '';
        return [item.name, item.displayName, item.sceneLabel, item.category, size]
          .some((value) => normalizeSearchText(value).includes(needle));
      })
      .map(({ item, index }) => this.templateCard(item, index));
  },

  templateCard(item, index) {
    const document = item.document || null;
    const size = Array.isArray(item.size)
      ? `${item.size[0]}×${item.size[1]} mm`
      : (document && document.widthMm ? `${document.widthMm}×${document.heightMm} mm` : '');
    let kind = item.kind || '';
    if (!kind && document && Array.isArray(document.elements)) {
      kind = document.elements.some((element) => element.type === 'qrcode') ? 'qr'
        : document.elements.some((element) => element.type === 'barcode') ? 'barcode' : 'accent';
    }
    const thumb = String(item.thumbSrc || '').trim();
    return {
      index,
      id: item.id,
      name: item.name || '未命名模板',
      sizeText: size,
      sourceLabel: item.source === 'user' ? '我的' : (item.curatedId ? '场景模板' : '商跃原创'),
      thumbSrc: thumb && !/^(?:https?:|wxfile:)/i.test(thumb) ? (thumb.startsWith('/') ? thumb : `/${thumb}`) : '',
      kind: kind || 'accent'
    };
  },

  onTemplateSearch(event) {
    const templateQuery = String(event && event.detail ? event.detail.value : '').trim();
    this.setData({
      templateQuery,
      templateCards: this.templateCardsFor(this.data.templates, templateQuery)
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

  // Keeps the selection valid against the label (ids that still exist, one
  // id unless multi-select) and returns the selected element.
  normalizeSelection() {
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
    return this.selectedElement();
  },

  // What the page shows about the selection.
  selectionData(selected) {
    const selectedFont = selected
      ? fontFallbackInfo(selected.fontFamily, selected.sourceFontFamily)
      : { requested: '', renderFamily: 'sans-serif', fallback: false };
    return {
      selected: selected ? Object.assign({}, selected) : null,
      selectedTypeLabel: selected ? elementTypeLabel(selected.type) : '',
      selectionCount: this.selectedIds.length,
      multiSelect: this.multiSelect,
      selectedDateValue: selected && selected.type === 'date' ? formatDateValue(selected) : '',
      selectedBorderLabel: selected && selected.borderStyle
        ? ((BORDER_CATALOG.find((item) => item.id === selected.borderStyle) || {}).label || '装饰边框')
        : '',
      selectedDateShowsTime: selected && selected.type === 'date' ? dateShowsTime(selected) : false,
      selectedDateStyle: selected && selected.type === 'date' ? dateStyleOf(selected) : '',
      selectedExpireDays: selected && selected.type === 'date' ? Math.floor((Number(selected.expirePresetHours) || 0) / 24) : 0,
      selectedExpireHours: selected && selected.type === 'date' ? (Number(selected.expirePresetHours) || 0) % 24 : 0,
      selectedSerialValue: selected && selected.type === 'serial' ? serialValue(selected) : '',
      selectedLinkedValue: selected && selected.serialLinked ? linkedCodeValue(this.document, selected) : '',
      selectedFontFamily: selectedFont.renderFamily,
      fontFallbackNote: selectedFont.fallback
        ? `模板用的字体「${selectedFont.requested}」手机上没有，先用「${selectedFont.label}」代替。点下面的字体可以换。`
        : '',
      tableCellIndexes: selected && selected.type === 'table'
        ? Array.from({ length: Math.max(1, Number(selected.rows) || 1) * Math.max(1, Number(selected.columns) || 1) }, (item, index) => index)
        : []
    };
  },

  // Sends the whole label and the selection to the page.
  syncPageData(callback) {
    const selected = this.normalizeSelection();
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const frameHeight = previewFrameHeight(this.document, windowInfo);
    const frameWidth = previewFrameWidth(windowInfo) || 336;
    const fitScale = previewFitScale(frameHeight, stageAvailableHeight(windowInfo, {
      safeTop: this.data.safeTop,
      keyboardHeight: this.data.keyboardHeight
    }));
    // A label taller than the stage shrinks until the whole thing is visible:
    // the bottom of a 40 x 60 mm label used to be unreachable.
    const previewHeightPx = Number((frameHeight * fitScale).toFixed(4));
    const previewWidthPx = Number((frameWidth * fitScale).toFixed(4));
    const sizes = sizeChoices(this.document);
    const sizeIndex = sizes.findIndex((item) => {
      return item.width === this.document.widthMm && item.height === this.document.heightMm;
    });
    // The page shows the label's name and size and the layer list; the
    // elements themselves live on the canvas, so they are not sent along.
    this.setData(Object.assign(this.selectionData(selected), {
      document: {
        name: this.document.name,
        widthMm: this.document.widthMm,
        heightMm: this.document.heightMm
      },
      layers: this.layerItems(),
      canvasInstanceId: this.canvasInstanceId || '',
      previewHeightPx,
      previewWidthPx,
      previewFitPercent: Math.max(1, Math.round(fitScale * 100)),
      sizeOptions: sizes.map((item) => item.label),
      sizeIndex: sizeIndex >= 0 ? sizeIndex : 0,
      currentSizeLabel: sizeLabel(this.document),
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      projectId: this.projectId || '',
      documentHasSerial: this.document.elements.some((item) => item.type === 'serial'),
      templateAttentionMessage: templateAttentionMessage(this.document)
    }), callback);
  },

  // The layer list, top layer first as the canvas stacks them, so 上移
  // moves an item up the list.
  layerItems() {
    return this.document.elements.map((item) => {
      const typeLabel = elementTypeLabel(item.type);
      return {
        id: item.id,
        _typeLabel: typeLabel,
        _selected: (this.selectedIds || []).includes(item.id),
        locked: Boolean(item.locked),
        name: String(item.text || item.value || item.label || '').slice(0, 40) || typeLabel
      };
    }).reverse();
  },

  // A touch that only changes the selection sends just the selection and the
  // layer list's check marks. Sending the whole label to the page on every
  // touch is what made picking and dragging lag.
  syncSelectionData(callback) {
    const selected = this.normalizeSelection();
    const listed = this.data.layers;
    const elements = this.document.elements;
    const count = elements.length;
    if (!Array.isArray(listed) || listed.length !== count
      || listed.some((item, index) => item.id !== elements[count - 1 - index].id)) {
      this.syncPageData(callback);
      return;
    }
    const patch = this.selectionData(selected);
    listed.forEach((item, index) => {
      const chosen = this.selectedIds.includes(item.id);
      if (Boolean(item._selected) !== chosen) patch[`layers[${index}]._selected`] = chosen;
    });
    this.setData(patch, callback);
  },

  initCanvas() {
    const generation = (this.canvasInitGeneration || 0) + 1;
    this.canvasInitGeneration = generation;
    this.setData({ canvasReady: false, canvasError: '' });
    const isCurrent = () => this.canvasInitGeneration === generation && this.pageActive !== false;
    let retried = false;
    const initialize = () => {
      if (!isCurrent()) return;
      wx.createSelectorQuery()
        .in(this)
        .select('#labelCanvas')
        .fields({ node: true, size: true })
        .select('#selectionCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          if (!isCurrent()) return;
          if (!result || !result[0] || !result[1]) {
            // The canvases can show up a moment late: look once more, then
            // offer a reload instead of a loading text that never ends.
            if (!retried) {
              retried = true;
              setTimeout(initialize, 300);
              return;
            }
            this.setData({ canvasError: '预览没加载出来' });
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
            this.setData({ canvasReady: false, canvasError: error.message || '预览没加载出来' });
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

  paintCanvases(options) {
    if (!this.context || !this.selectionContext || !this.previewDpi) {
      return;
    }
    renderDocument(this.context, this.document, this.canvasSize, this.previewDpi, this.images, options);
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

  // While a finger moves an element the canvases are painted at most once per
  // display frame, however many touch events arrive, and pictures reuse their
  // black and white copy (see renderDocument). A frame still pending when the
  // finger lifts is dropped: the touch end paints the exact result.
  scheduleGesturePaint() {
    if (this.gesturePaintPending) return;
    this.gesturePaintPending = true;
    const paint = () => {
      this.gesturePaintPending = false;
      if (this.drag && this.pageActive !== false) this.paintCanvases({ interactive: true });
    };
    if (this.canvas && typeof this.canvas.requestAnimationFrame === 'function') this.canvas.requestAnimationFrame(paint);
    else setTimeout(paint, 16);
  },

  refreshLoadedFonts() {
    if (!this.document) return;
    collectDocumentFontIds(this.document).forEach((id) => this.loadFont(id));
  },

  // Each font is requested once per editor session. A failed download is not
  // retried on every redraw; tapping its chip again starts a new attempt.
  loadFont(id) {
    const states = this.fontStates || (this.fontStates = {});
    if (states[id]) return;
    states[id] = 'loading';
    let settled = false;
    ensureFont(id, fontRuntime()).then((result) => {
      settled = true;
      const failed = Boolean(result && result.status === 'failed');
      states[id] = failed ? 'failed' : 'ready';
      if (this.pageActive === false) return;
      this.setFontLoading(id, false);
      if (failed) this.reportFontFailure(id);
      else if (result && result.newlyLoaded) this.paintCanvases();
    });
    // A font the loader already holds settles before this check runs, so only
    // a real download marks its chip and chips never flicker.
    Promise.resolve().then(() => {
      if (!settled && this.pageActive !== false) this.setFontLoading(id, true);
    });
  },

  setFontLoading(id, loading) {
    const current = this.data.fontLoading || {};
    if (Boolean(current[id]) === loading) return;
    const next = Object.assign({}, current);
    if (loading) next[id] = true;
    else delete next[id];
    this.setData({ fontLoading: next });
  },

  reportFontFailure(id) {
    const notified = this.fontFailuresNotified || (this.fontFailuresNotified = {});
    if (notified[id]) return;
    notified[id] = true;
    wx.showToast({ title: FONT_FAILURE_TOAST, icon: 'none', duration: 2800 });
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
    // A tap that leaves the label as it was (a field left as it was, the
    // alignment already chosen, the top layer moved up) is no change: no undo
    // step, no unsaved mark, no save and no canvas rebuild.
    const changed = JSON.stringify(before) !== JSON.stringify(this.document);
    if (changed) {
      this.recordSnapshot(before);
      this.persistDocument();
    }
    this.syncPageData(() => {
      if (reinitializeCanvas && changed) {
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
    this.restoreFromHistory(this.undoStack, this.redoStack);
  },

  redo() {
    if (!this.redoStack.length) {
      return;
    }
    this.restoreFromHistory(this.redoStack, this.undoStack);
  },

  // Replaces the document with the newest entry of `from` and keeps the
  // current one on `to`. Entries recorded when a template replaced the label
  // also carry the saved label they belong to (see loadTemplate).
  restoreFromHistory(from, to) {
    const restored = from.pop();
    const current = cloneDocument(this.document);
    const projects = this.historyProjects;
    if (projects && projects.has(restored)) {
      projects.set(current, this.projectId || '');
      this.projectId = projects.get(restored);
    }
    to.push(current);
    const resized = paperSizeChanged(this.document, restored);
    this.document = restored;
    this.dirtySinceSave = true;
    // Undo keeps working on the same element while it is still there.
    this.setSelection(this.selectedIds || [], this.multiSelect);
    this.persistDocument();
    this.syncPageData(() => this.refreshCanvas(resized));
  },

  // Only a new paper size needs the canvas measured again. Otherwise redraw in
  // place so the canvas never flashes its loading state.
  refreshCanvas(resized) {
    if (resized) {
      this.initCanvas();
      return;
    }
    this.loadDocumentImages();
    this.renderAll();
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
    this.resetPanelFocus();
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
    // Tapping the element that is already selected opens its content for
    // typing once the finger lifts, unless that tap cycles through overlaps.
    this.contentTap = !this.multiSelect && mode === 'move' && !hitDecision.cycleOnTap
      && previous && element && element.id === previous.id
      ? {
        elementId: element.id,
        startClientX: Number(touch.x) || 0,
        startClientY: Number(touch.y) || 0,
        startedAt: Date.now(),
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
    // Paint first so the selection shows under the finger at once; the page
    // catches up after.
    this.paintCanvases();
    this.syncSelectionData();
  },

  onCanvasTouchMove(event) {
    this.markTapMoved(this.selectionTapCycle, event);
    this.markTapMoved(this.contentTap, event);
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
    } else if (this.drag.mode === 'scale') {
      // The bottom-right corner scales the element as a whole, text size too.
      Object.assign(element, scaleRotatedElement(this.drag.original, delta, this.document, 0.8), { selectionFit: false });
      this.snapGuides = [];
    } else if (this.drag.mode === 'rotate') {
      const center = {
        x: this.drag.original.x + this.drag.original.width / 2,
        y: this.drag.original.y + this.drag.original.height / 2
      };
      const nextAngle = pointerAngle(point, center);
      // Every move turns the box the finger started with, so a turn that
      // shrank it to fit the label gives the size back on the way back.
      Object.assign(element, {
        x: this.drag.original.x,
        y: this.drag.original.y,
        width: this.drag.original.width,
        height: this.drag.original.height
      });
      if (this.drag.promotedFit) element.selectionFit = false;
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
    // The inspector catches up when the finger lifts (onCanvasTouchEnd).
    this.scheduleGesturePaint();
  },

  onCanvasTouchEnd(event) {
    const cycle = this.selectionTapCycle;
    const shouldCycle = cycle && !cycle.moved && !(this.drag && this.drag.moved);
    const contentTap = this.contentTap;
    const shouldType = Boolean(contentTap && !contentTap.moved && !(this.drag && this.drag.moved)
      && !(event && event.type === 'touchcancel')
      && Date.now() - contentTap.startedAt < TAP_MAX_MS);
    const pressBaseIds = this.pressBaseIds || [];
    let cycled = false;
    if (this.drag && this.drag.moved) {
      this.roundDraggedGeometry(this.drag);
      this.recordSnapshot(this.drag.before);
      this.persistDocument();
      this.syncPageData();
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
    this.contentTap = null;
    this.pressBaseIds = [];
    this.snapGuides = [];
    // One exact paint: pictures get their black and white copy at the final size.
    this.renderAll();
    if (cycled) this.syncSelectionData();
    // A newly selected element shows its inspector from the top, not at the
    // scroll offset left by the previous element's longer inspector.
    const newSelection = !this.multiSelect && this.selectedId
      && !(pressBaseIds.length === 1 && pressBaseIds[0] === this.selectedId);
    if (shouldType) this.focusContentField(contentTap.elementId);
    else if (newSelection) this.setData({ panelScrollTarget: PANEL_TOP_ID });
  },

  // A finger leaves long decimals (13.287234…); the inspector shows the
  // label rounded to 0.01 mm and whole degrees.
  roundDraggedGeometry(drag) {
    const ids = drag.mode === 'group' ? drag.groupOriginals.map((item) => item.id) : [this.selectedId];
    ids.forEach((id) => {
      const element = this.document.elements.find((item) => item.id === id);
      if (!element) return;
      ['x', 'y', 'width', 'height'].forEach((field) => {
        if (Number.isFinite(Number(element[field]))) element[field] = roundMm(element[field]);
      });
      if (drag.mode === 'rotate') element.rotation = ((Math.round(Number(element.rotation) || 0) % 360) + 360) % 360;
    });
  },

  // Eight pixels of finger travel turn a tap into a drag.
  markTapMoved(tap, event) {
    if (!tap) return;
    const touch = event.touches[0] || event.changedTouches[0] || {};
    const distance = Math.hypot(
      (Number(touch.x) || 0) - tap.startClientX,
      (Number(touch.y) || 0) - tap.startClientY
    );
    if (distance >= 8) tap.moved = true;
  },

  // Focuses the element's content field and scrolls the panel to it. The
  // `focus` binding and scroll-into-view only react to a changed value, so
  // every canvas touch clears them first (resetPanelFocus). The scroll is not
  // animated: the keyboard positions the page from where the field ends up.
  focusContentField(elementId) {
    const element = this.document.elements.find((item) => item.id === elementId);
    if (!contentFieldOf(element)) return;
    this.setData({
      editorPanelTab: 'elements',
      contentFocus: true,
      panelScrollTarget: CONTENT_FIELD_ID
    });
  },

  resetPanelFocus() {
    if (this.data.contentFocus || this.data.panelScrollTarget) {
      this.setData({ contentFocus: false, panelScrollTarget: '' });
    }
  },

  addElement(event) {
    const type = event.currentTarget.dataset.type;
    if (type === 'image') {
      this.chooseImage();
      return;
    }
    if (type === 'material') {
      this.replaceMaterial = false;
      this.setData({ showMaterialSheet: true, materialOptions: this.materialOptionsFor(this.data.materialChip) });
      return;
    }
    this.commit((document) => {
      const element = createElement(type, document);
      placeNewElement(element, document);
      document.elements.push(element);
      this.setSelection([element.id], false);
    });
  },

  // Decodes a picture on the label canvas. Its size there is what the label
  // draws (a phone's rotation flag included), so the picture frame takes those
  // proportions. Resolves null when the canvas is not ready or cannot read it.
  decodeLabelImage(path) {
    if (!this.canvas || typeof this.canvas.createImage !== 'function') return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = this.canvas.createImage();
      // A picture the canvas never answers for still lets the import finish;
      // the canvas loads it again the usual way.
      const timer = setTimeout(() => resolve(null), 8000);
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      image.src = path;
    });
  },

  // A picture from the album or camera, ready for the label: shrunk when it
  // is a large photo, kept in the mini program's storage, and decoded once.
  importLabelImage(source) {
    return shrinkLargeImage(source).then((picture) => keepImageFile(picture.path).then((path) => {
      return this.decodeLabelImage(path).then((image) => ({
        path,
        image,
        width: image && image.width > 0 ? image.width : picture.width,
        height: image && image.height > 0 ? image.height : picture.height
      }));
    }));
  },

  // Whether a picture that finished decoding still belongs to this page: after
  // onUnload the document here is stale and must not touch shared storage.
  imageImportApplies() {
    return Boolean(this.pageActive) && !this.discardedSession;
  },

  /**
   * Pictures this device saved for labels nothing refers to any more are
   * deleted when the editor closes, so the local-file quota cannot fill up with
   * orphan photos. The undo stack of this page is gone by then.
   */
  sweepImageFiles() {
    const repository = this.repository;
    if (!repository) return;
    const documents = [this.document];
    const take = (list) => (Array.isArray(list) ? list : []).forEach((item) => {
      if (item && item.document) documents.push(item.document);
    });
    try {
      take(repository.getProjects());
      take(repository.getUserTemplates());
      take(repository.getPrintHistory());
      const saved = [repository.getEditorDraft(), repository.getEditorAutosave()];
      saved.forEach((draft) => { if (draft && draft.document) documents.push(draft.document); });
    } catch (error) {
      // A damaged store must never cost the owner their pictures.
      return;
    }
    try {
      sweepOrphanImages(wx, documents);
    } catch (error) {
      // Clean-up is best effort; the label already saved fine.
    }
  },

  // Puts the picture just decoded for `element` in the image cache, so the
  // canvas does not load the same file a second time.
  adoptDecodedImage(element, image) {
    if (!image || !element) return;
    const token = this.imageCache.begin(element);
    this.imageCache.accept(this.images, element, token, image);
  },

  chooseImage(event) {
    const replaceId = event && event.currentTarget && event.currentTarget.dataset.replace === '1'
      ? this.selectedId
      : '';
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      // Thermal labels print far below photo resolution; the compressed copy
      // keeps storage and canvas memory small.
      sizeType: ['compressed'],
      success: (result) => {
        const picked = result && Array.isArray(result.tempFiles) ? result.tempFiles[0] : null;
        if (!picked || !picked.tempFilePath) {
          wx.showToast({ title: '没有拿到图片，请重新选择', icon: 'none' });
          return;
        }
        if (typeof wx.showLoading === 'function') wx.showLoading({ title: '正在处理图片', mask: true });
        this.importLabelImage(picked.tempFilePath).then((picture) => {
          // Decoding and copying a photo can outlast the page: a system
          // navigation may have unloaded it, and this instance's document is
          // not the one the next editing session owns.
          if (!this.imageImportApplies()) return;
          this.commit((document) => {
            const existing = replaceId && document.elements.find((item) => item.id === replaceId && item.type === 'image');
            if (existing) {
              // The new picture fits inside the old frame without stretching.
              existing.path = picture.path;
              fitImageToPicture(existing, picture.width, picture.height, document, true);
              this.invalidateImage(existing.id);
              this.adoptDecodedImage(existing, picture.image);
              return;
            }
            const element = createElement('image', document);
            element.path = picture.path;
            fitImageToPicture(element, picture.width, picture.height, document, false);
            placeNewElement(element, document);
            document.elements.push(element);
            this.adoptDecodedImage(element, picture.image);
            this.setSelection([element.id], false);
          });
        }).then(() => {
          if (typeof wx.hideLoading === 'function') wx.hideLoading();
        }, () => {
          // Close the loading toast first: a toast shown under it would vanish with it.
          if (typeof wx.hideLoading === 'function') wx.hideLoading();
          if (this.pageActive) wx.showToast({ title: '图片保存失败，请重新选择', icon: 'none' });
        });
      }
    });
  },

  deleteSelected() {
    const deletedIds = (this.selectedIds && this.selectedIds.length ? this.selectedIds : [this.selectedId]).filter(Boolean);
    if (!deletedIds.length) {
      return;
    }
    const what = deletedIds.length > 1
      ? `${deletedIds.length} 个元素`
      : (() => {
        const element = this.document.elements.find((item) => item.id === deletedIds[0]);
        return element ? `「${elementTypeLabel(element.type)}」` : '这个元素';
      })();
    const remove = () => {
      this.commit((document) => {
        document.elements = document.elements.filter((item) => !deletedIds.includes(item.id));
        deletedIds.forEach((id) => {
          this.invalidateImage(id);
        });
        this.setSelection([], false);
      });
      // Deletion has no dialog of its own, so say what happened and where undo is.
      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
        wx.showToast({ title: `已删除${what}，可点左上角撤销`, icon: 'none' });
      }
    };
    if (deletedIds.length > 1 && typeof wx !== 'undefined' && typeof wx.showModal === 'function') {
      wx.showModal({
        title: `删除这 ${deletedIds.length} 个元素？`,
        content: '删掉后可以点左上角的撤销找回来。',
        confirmText: '删除',
        cancelText: '取消',
        confirmColor: '#E02D26',
        success: (result) => { if (result && result.confirm) remove(); }
      });
      return;
    }
    remove();
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

  // A draft for the selected element's live field; the snapshot is the label as
  // it was before this burst of typing.
  startImplicitFieldEdit(field) {
    const element = this.selectedElement();
    if (!isLiveStringField(element, field)) {
      this.fieldEditDraft = null;
      return false;
    }
    this.fieldEditDraft = { elementId: element.id, field, before: cloneDocument(this.document) };
    return true;
  },

  previewField(event) {
    const field = event.currentTarget.dataset.field;
    // onHide, the print sheet and saving all commit and drop the draft, while
    // the native input keeps its focus and keeps sending keystrokes. Starting a
    // draft here keeps those characters in the label (and undoable) instead of
    // letting them live only inside the input.
    if (!this.fieldEditDraft || this.fieldEditDraft.field !== field) {
      if (!this.startImplicitFieldEdit(field)) return;
    }
    const draft = this.fieldEditDraft;
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
    // Clearing the request lets the next repeat tap focus the field again.
    if (this.data.contentFocus) this.setData({ contentFocus: false });
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
    let value = numeric.indexOf(field) >= 0 ? Number(event.detail.value) : event.detail.value;
    if (numeric.indexOf(field) >= 0) {
      if (String(event.detail.value).trim() === '' || !Number.isFinite(value)) {
        // An emptied number field puts the old value back on screen.
        this.syncPageData();
        return;
      }
      const kept = fieldValueInRange(field, value);
      if (kept !== value) wx.showToast({ title: `已调整为可用范围：${kept}`, icon: 'none' });
      value = kept;
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
      if (!selected) return;
      if (field === 'showTime' && selected.type === 'date') Object.assign(selected, dateTimePatch(selected, event.detail.value));
      else selected[field] = event.detail.value;
    });
  },

  updateSlider(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    if (field === 'rotation') {
      this.rotateSelected(value);
      return;
    }
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        selected[field] = value;
      }
    });
  },

  // A turn that does not fit the label shrinks the element to fit. Turning
  // it back must give the old size back, so the size before the first turn
  // is kept while the element is only being turned.
  rotateSelected(rotation) {
    const selected = this.selectedElement();
    if (!selected) return;
    const base = this.rotationBase;
    const sameTurn = base && base.id === selected.id
      && base.after.width === selected.width && base.after.height === selected.height
      && base.after.x === selected.x && base.after.y === selected.y;
    const start = sameTurn ? base.before : {
      x: selected.x, y: selected.y, width: selected.width, height: selected.height
    };
    this.commit(() => {
      const element = this.selectedElement();
      if (!element) return;
      Object.assign(element, start, { rotation: ((Math.round(rotation) % 360) + 360) % 360 });
    });
    const turned = this.selectedElement();
    this.rotationBase = turned ? {
      id: turned.id,
      before: start,
      after: { x: turned.x, y: turned.y, width: turned.width, height: turned.height }
    } : null;
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
    if (this.fontStates && this.fontStates[value] === 'failed') delete this.fontStates[value];
    const current = this.selectedElement();
    if (current && current.fontFamily === value && !current.sourceFontFamily) {
      // The font is already applied: only retry its download, without adding
      // an empty undo step.
      this.refreshLoadedFonts();
      return;
    }
    this.commit(() => {
      const selected = this.selectedElement();
      // Locking only keeps an element still on the canvas; like its size and
      // text, its font stays editable here.
      if (!selected) return;
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
    const tab = event.currentTarget.dataset.value;
    // The template list follows the label's current size.
    if (tab === 'templates' && this.repository) {
      try {
        this.loadTemplates();
      } catch (error) {
        // The list from before stays; the user templates could not be read.
      }
    }
    // A tab opens at its top; an earlier focus or scroll request is not replayed.
    this.setData({
      editorPanelTab: tab,
      contentFocus: false,
      panelScrollTarget: ''
    });
  },

  setChoiceField(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    if (!field) return;
    this.commit(() => {
      const selected = this.selectedElement();
      if (selected) {
        if (field === 'format' && selected.type === 'barcode') confirmBarcodeFormat(selected, value);
        else if (field === 'dateStyle' && selected.type === 'date') Object.assign(selected, dateStylePatch(selected, value));
        else if (field === 'dateRole' && selected.type === 'date') Object.assign(selected, dateRolePatch(selected, value));
        else selected[field] = value;
      }
    });
  },

  // 保质期 in days and hours; the label prints the print time plus both.
  updateExpiry(event) {
    const part = event.currentTarget.dataset.part;
    const value = Number(event.detail.value);
    const selected = this.selectedElement();
    if (!selected || selected.type !== 'date') return;
    if (String(event.detail.value).trim() === '' || !Number.isFinite(value)) {
      this.syncPageData();
      return;
    }
    const total = Math.max(0, Number(selected.expirePresetHours) || 0);
    const days = part === 'days' ? Math.max(0, Math.min(3650, Math.round(value))) : Math.floor(total / 24);
    const hours = part === 'hours' ? Math.max(0, Math.min(23, Math.round(value))) : total % 24;
    this.commit(() => {
      const element = this.selectedElement();
      if (element) element.expirePresetHours = days * 24 + hours;
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
  closeSettings() {
    this.returnToPrintAfterProfile = false;
    this.setData({ showSettingsSheet: false });
  },

  // The model picker sits at the top of the settings sheet. Picking a model
  // from the print sheet returns there.
  openProfilePicker() {
    if (this.data.printing) return;
    this.returnToPrintAfterProfile = Boolean(this.data.showPrintSheet);
    this.setData({ showPrintSheet: false, showSettingsSheet: true });
  },

  openMaterialSheet() {
    this.replaceMaterial = Boolean(this.selectedElement() && this.selectedElement().type === 'material');
    this.setData({
      showMaterialSheet: true,
      materialOptions: this.materialOptionsFor(this.data.materialChip)
    });
  },

  /** Materials in one chip: '全部', or the category/tag the catalogue gave it. */
  materialOptionsFor(chip) {
    if (!this.materialCatalog) this.materialCatalog = MATERIAL_CATALOG.map(materialOption);
    const selected = String(chip || MATERIAL_CHIP_ALL);
    if (selected === MATERIAL_CHIP_ALL) return this.materialCatalog;
    return this.materialCatalog.filter((item) => item.category === selected || item.tags.indexOf(selected) >= 0);
  },

  selectMaterialChip(event) {
    const materialChip = String((event.currentTarget.dataset.chip) || MATERIAL_CHIP_ALL);
    this.setData({ materialChip, materialOptions: this.materialOptionsFor(materialChip) });
  },
  closeMaterialSheet() { this.setData({ showMaterialSheet: false }); },
  openBorderSheet() {
    this.setData({ showBorderSheet: true });
  },
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
    this.renderAll();
    this.syncSelectionData();
    wx.showToast({ title: `已选择 ${decision.ids.length} 个元素`, icon: 'none' });
  },

  pickMaterial(event) {
    const id = event.currentTarget.dataset.id;
    const material = MATERIAL_CATALOG.find((item) => item.id === id);
    if (!material) return;
    const asset = material.asset || '';
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
      this.invalidateImage(element.id);
    });
    this.replaceMaterial = false;
    this.setData({ showMaterialSheet: false, editorPanelTab: 'elements' });
  },

  pickBorder(event) {
    const id = event.currentTarget.dataset.id;
    const border = BORDER_CATALOG.find((item) => item.id === id);
    if (!border) return;
    this.commit((document) => {
      // A decorative border replaces any full-canvas image frame left behind.
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

  // Back to a plain shape: its kind, dashes and fill apply again.
  removeBorder() {
    this.commit(() => {
      const selected = this.selectedElement();
      if (!selected || selected.type !== 'rect') return;
      delete selected.borderStyle;
      delete selected.decorativeBorder;
    });
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

  // Live rename while typing: a system back gesture can unload the page before
  // blur, and onUnload/onHide persist this.document as it stands.
  previewDocumentName(event) {
    if (!this.document) return;
    if (!this.nameEdit) this.nameEdit = { name: this.document.name, dirty: this.dirtySinceSave };
    const typed = String(event.detail.value == null ? '' : event.detail.value);
    this.document.name = typed.trim() ? typed : this.nameEdit.name;
    this.dirtySinceSave = true;
  },

  updateDocumentName(event) {
    const name = String(event.detail.value || '').trim() || '未命名标签';
    if (this.nameEdit) {
      // Undo returns to the name from before this edit, not to a keystroke.
      this.document.name = this.nameEdit.name;
      this.dirtySinceSave = this.nameEdit.dirty;
      this.nameEdit = null;
    }
    if (name === this.document.name) {
      return;
    }
    this.commit((document) => {
      document.name = name;
    });
  },

  onProfileChange(event) {
    const profile = PROFILES[Number(event.detail.value)];
    if (!profile) return;
    this.pickProfile(profile);
    this.syncPageData(() => this.initCanvas());
    if (this.returnToPrintAfterProfile) {
      this.returnToPrintAfterProfile = false;
      this.setData({ showSettingsSheet: false });
      this.openPrintSheet();
      return;
    }
    const check = evaluatePrintability(this.document, profile);
    if (!check.ok) wx.showToast({ title: '这台打印机打不了这个尺寸，打印前请换纸宽或尺寸', icon: 'none', duration: 2500 });
  },

  // Makes `profile` the model used for printing and the saved default. The
  // chosen density survives unless the model, and so its range, changes.
  useProfile(profile) {
    const changed = !this.profile || this.profile.id !== profile.id;
    this.profile = profile;
    this.repository.saveSettings({ defaultProfileId: profile.id });
    this.setData({
      profileIndex: PROFILES.findIndex((item) => item.id === profile.id),
      density: changed ? profile.densityDefault : clampDensity(this.data.density, profile),
      densityMin: profile.densityMin,
      densityMax: profile.densityMax,
      densityAdjustable: profile.densityMax > profile.densityMin
    });
  },

  onSizeChange(event) {
    const sizeIndex = Number(event.detail.value);
    const size = sizeChoices(this.document)[sizeIndex];
    if (!size || (size.width === this.document.widthMm && size.height === this.document.heightMm)) return;
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
    if (this.data.printing) return;
    const delta = Number(event.currentTarget.dataset.delta);
    const copies = Math.max(1, Math.min(99, this.data.copies + delta));
    this.setData({ copies, copiesInput: String(copies) });
  },

  setCopiesInput(event) {
    const previous = Number(this.data.copies) || 1;
    if (this.data.printing) {
      // The job took its copies when it started; late edits only confuse.
      this.setData({ copies: previous, copiesInput: String(previous) });
      return;
    }
    const rawText = String(event.detail.value == null ? '' : event.detail.value).trim();
    const typed = Math.round(Number(rawText));
    const usable = Boolean(rawText) && Number.isFinite(typed);
    const copies = usable ? Math.max(1, Math.min(99, typed)) : previous;
    // The box shows copiesInput, not copies: typing "500" must visibly become
    // "99" rather than sit there while one label prints.
    this.setData({ copies, copiesInput: String(copies) });
    if (usable && copies !== typed && typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: `份数已调整为 ${copies}`, icon: 'none' });
    }
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
      this.setData({ projectId: project.id, saveState: '已保存为标签' });
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
    if (this.dirtySinceSave && !this.discardedSession && !this.persistDocument()) {
      wx.showModal({
        title: '草稿没有保存成功',
        content: '手机存储空间可能不够了。现在退出，这次的修改会丢失。',
        confirmText: '再试一次',
        cancelText: '仍要退出',
        confirmColor: '#E02D26',
        success: (result) => {
          if (result && result.confirm) this.exitEditor();
          else if (result && result.cancel) this.returnHome();
        }
      });
      return;
    }
    this.returnHome();
  },

  closeEditor(route) {
    this.exitRoute = typeof route === 'string' ? route : '';
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
      alertText: '这张标签还没存为标签（草稿已保存）',
      itemList: ['保存并退出', '保留草稿退出', '放弃修改退出'],
      success: (result) => {
        if (result.tapIndex === 0) {
          const saved = this.saveProjectSilently();
          if (saved.ok) this.exitEditor();
        } else if (result.tapIndex === 1) {
          this.exitEditor();
        } else if (result.tapIndex === 2) {
          this.confirmDiscard();
        }
      }
    });
  },

  // The last item of the exit menu, and the only one that loses work, asks
  // once more.
  confirmDiscard() {
    wx.showModal({
      title: '放弃这些修改？',
      content: this.projectId ? '标签会回到上次保存时的样子。' : '这张标签还没保存过，放弃后就找不回来了。',
      confirmText: '放弃',
      cancelText: '再想想',
      confirmColor: '#E02D26',
      success: (result) => {
        if (!result || !result.confirm) return;
        try {
          this.editorSession.discard();
          this.discardedSession = true;
          this.dirtySinceSave = false;
          this.exitEditor();
        } catch (error) {
          wx.showModal({ title: '无法放弃草稿', content: error.message, showCancel: false });
        }
      }
    });
  },

  openDataManager() {
    this.closeEditor('data');
  },

  loadTemplate(event) {
    if (!this.data.templates.length) {
      return;
    }
    const dataset = event && event.currentTarget && event.currentTarget.dataset;
    const index = dataset && dataset.index != null
      ? Number(dataset.index)
      : Number(event && event.detail ? event.detail.value : NaN);
    const template = this.data.templates[index];
    if (!template) {
      return;
    }
    // Choosing from the picker replaces the whole label, so it asks first.
    wx.showModal({
      title: `套用「${template.name}」？`,
      content: this.dirtySinceSave
        ? '当前标签会被换掉，还没保存的修改可以点撤销找回。'
        : '当前标签会被换掉，可以点撤销换回来。',
      confirmText: '套用',
      cancelText: '取消',
      success: (result) => {
        if (result && result.confirm) this.applyTemplate(template);
      }
    });
  },

  applyTemplate(template) {
    const openProjectId = this.projectId || '';
    const builtIn = template.builtinId && catalogTemplates.find((item) => item.id === template.builtinId);
    // Build before touching anything: a template whose data cannot be read must
    // leave the current label (and the undo stack) exactly as it was, instead of
    // quietly replacing it with an empty 50 x 30 sheet.
    let built = null;
    try {
      built = template.document
        || (template.curatedId ? buildCuratedDocument(template.curatedId) : null)
        || (builtIn ? buildTemplateDocument(builtIn) : null);
    } catch (error) {
      built = null;
    }
    const next = built ? normalizeDocument(built) : null;
    if (!next) {
      wx.showModal({
        title: '模板打不开',
        content: '这个模板的数据不完整，没有套用。换一个模板，或重新导入后再试。',
        showCancel: false
      });
      return;
    }
    const previous = cloneDocument(this.document);
    // Undo brings the replaced label back together with its saved project id.
    if (!this.historyProjects) this.historyProjects = new WeakMap();
    this.historyProjects.set(previous, openProjectId);
    this.recordSnapshot(previous);
    this.document = next;
    this.images = {};
    this.imageLoadPromises = {};
    this.imageCache = createImageCacheRegistry();
    this.document.name = template.name;
    // A template starts a new label, so saving never overwrites the open one.
    this.projectId = '';
    this.dirtySinceSave = true;
    this.setSelection([], false);
    this.persistDocument();
    this.syncPageData(() => this.refreshCanvas(paperSizeChanged(previous, this.document)));
    // Rows from 批量数据 only fill the fields this design binds; a template
    // without them could not print one label per row, so batch mode ends here
    // instead of failing after the printer has been contacted.
    if (this.batch && !this.batchCompatible(this.document)) {
      this.exitBatch();
      wx.showToast({ title: '这个模板没有数据字段，已退出批量打印', icon: 'none' });
      return;
    }
    if (openProjectId) wx.showToast({ title: '已套用模板，保存时会存成新标签', icon: 'none' });
  },

  /**
   * Whether 批量数据 can print one label per row with this design. The binder
   * fills tagged fields, else the first texts/codes/dates; a design with none
   * of those would print the very same label for every row.
   */
  batchCompatible(documentValue) {
    try {
      assertBatchCompatible(documentValue);
    } catch (error) {
      return false;
    }
    const fillable = ['text', 'barcode', 'qrcode', 'date', 'serial'];
    const elements = documentValue && Array.isArray(documentValue.elements) ? documentValue.elements : [];
    return elements.some((element) => element && (element.bindField || fillable.indexOf(element.type) >= 0));
  },

  // Leaves batch mode; the design and its unsaved changes stay as they are.
  exitBatch() {
    this.batch = null;
    try {
      if (this.editorSession) this.editorSession.clearBatch();
    } catch (error) {
      // The session has already let go of the rows; the next autosave stores that.
    }
    this.setData({ batchRowCount: 0 });
  },

  // An automatic reconnect never blocks the picker; a running print does.
  openDevices() {
    if (!this.pageActive || this.data.printing) return;
    this.setData({ showDevices: true });
  },

  closeDevices() {
    this.returnToPrintAfterConnect = false;
    this.setData({ showDevices: false });
  },

  openDevicesFromSettings() {
    this.closeSettings();
    this.openDevices();
  },

  // The printer picker reports a printer that is connected and ready.
  onPrinterConnected(event) {
    if (this.pageActive === false) return;
    const detail = (event && event.detail) || {};
    const device = detail.device || {};
    const result = Object.assign({}, detail.result);
    if (!result.deviceId) result.deviceId = device.deviceId || '';
    if (!result.name) result.name = device.name || device.localName || '';
    this.applyConnectionResult(result);
    this.setData({
      showDevices: false,
      connectionState: 'connected',
      connectionLabel: '已连接',
      connectedDevice: result.name || '打印机'
    });
    this.syncPageData(() => this.initCanvas());
    if (this.returnToPrintAfterConnect) {
      this.returnToPrintAfterConnect = false;
      this.openPrintSheet();
    }
  },

  // Header status of the shared connection. An automatic reconnect runs in
  // the background and reads as 未连接 until it succeeds.
  applyLinkState(state) {
    if (state && state.status === 'connected' && state.device) {
      this.adoptConnectedPrinter(state.device);
      this.setData({
        connectionState: 'connected',
        connectionLabel: '已连接',
        connectedDevice: state.device.name || state.device.displayName || '打印机'
      });
    } else if (state && state.status === 'connecting' && !state.background) {
      this.setData({ connectionState: 'connecting', connectionLabel: '连接中' });
    } else {
      this.setDisconnectedState();
    }
  },

  // A printer that connected without the picker (already connected when the
  // editor opened, or reconnected on its own) prints with its own model too.
  adoptConnectedPrinter(device) {
    if (device.deviceId) this.applyConnectionResult(device);
  },

  setDisconnectedState() {
    this.setData({
      connectionState: 'disconnected',
      connectionLabel: '未连接',
      connectedDevice: ''
    });
  },

  // The model a connected printer prints with: a model picked by hand since it
  // last connected (which then becomes its model), else the model chosen for
  // it before, else the paper width the end of its name gives (…58 / …80).
  applyConnectionResult(result) {
    const value = result || {};
    this.connectedDeviceId = String(value.deviceId || '');
    if (this.manualProfileConfirmed && this.profile) {
      this.manualProfileConfirmed = false;
      this.rememberProfileChoice(this.profile.id);
      this.profileSource = 'device';
      this.paperWidthUnconfirmed = null;
      return this.profile;
    }
    const chosen = this.chosenProfileFor(this.connectedDeviceId);
    if (chosen) {
      // Saved again: connecting another printer meanwhile replaces the saved one.
      this.rememberProfileChoice(chosen.id);
      if (!this.profile || this.profile.id !== chosen.id) this.useProfile(chosen);
      this.profileSource = 'device';
      this.paperWidthUnconfirmed = null;
      return chosen;
    }
    const name = value.name || value.displayName || '';
    const profile = profileForPrinterName(name);
    if (!this.profile || this.profile.id !== profile.id) this.useProfile(profile);
    this.profileSource = 'auto';
    // Nothing on the device states its paper width, so printing uses the 58 mm
    // guess. Connecting stays silent (ADR-013); the print sheet asks once.
    this.paperWidthUnconfirmed = printerNameProfileId(name) ? null : {
      deviceId: this.connectedDeviceId,
      name: String(name || '')
    };
    return profile;
  },

  // The model the user chose for this printer, in this visit or saved with it.
  chosenProfileFor(deviceId) {
    const manager = this.connectionManager;
    const session = deviceId && this.profileChoices ? this.profileChoices[deviceId] : '';
    const saved = !session && deviceId && manager && typeof manager.getConfirmedProfileId === 'function'
      ? manager.getConfirmedProfileId(deviceId)
      : '';
    const id = session || saved;
    return id && PROFILES.some((item) => item.id === id) ? getProfile(id) : null;
  },

  // A model picked by hand. For a connected printer the pick becomes that
  // printer's model; otherwise it waits for the next printer to connect.
  pickProfile(profile) {
    this.useProfile(profile);
    this.profileSource = 'manual';
    if (this.connectedDeviceId && this.data.connectionState === 'connected') {
      this.rememberProfileChoice(profile.id);
      this.manualProfileConfirmed = false;
    } else {
      this.manualProfileConfirmed = true;
    }
  },

  // Remembers the user's model for the connected printer: for this visit, and
  // with the saved printer so later visits use it too.
  rememberProfileChoice(profileId) {
    const deviceId = this.connectedDeviceId;
    if (!deviceId) return;
    this.profileChoices = Object.assign({}, this.profileChoices, { [deviceId]: profileId });
    const manager = this.connectionManager;
    if (manager && typeof manager.confirmProfile === 'function') manager.confirmProfile(deviceId, profileId);
  },

  /**
   * The one question a printer whose name does not state its paper width asks:
   * 58 or 80 mm. A wrong width prints every label askew, so it blocks the print
   * instead of guessing silently; the answer is remembered with the printer.
   */
  paperWidthBlock() {
    const pending = this.paperWidthUnconfirmed;
    if (!pending) return null;
    if (pending.deviceId && this.connectedDeviceId && pending.deviceId !== this.connectedDeviceId) return null;
    const name = pending.name ? `「${pending.name}」` : '这台打印机';
    return {
      kind: 'paper-width',
      message: `${name}没有在蓝牙名称里写纸宽（58 还是 80mm 纸）。按 58mm 猜着打印，装的是 80mm 纸时整张标签会偏一边。请按机身或说明书上的纸宽选一次，之后会记住。`,
      canChoosePaperWidth: true,
      suggestProfileId: ''
    };
  },

  choosePrinterPaperWidth(event) {
    if (this.data.printing) return;
    const width = Number(event.currentTarget.dataset.width) === 80 ? 80 : 58;
    this.paperWidthUnconfirmed = null;
    // Both widths print at 203 dpi, so the preview canvas keeps its size; only
    // the print sheet and the label size hints have to catch up.
    this.pickProfile(getProfile(width === 80 ? 'escpos-80' : 'escpos-58'));
    this.syncPageData();
    this.refreshPrintBlock();
  },

  evaluatePrintBlock(documentValue = this.document, profile = this.profile) {
    return this.paperWidthBlock()
      || this.contentPrintBlock(documentValue, profile)
      || this.elementPrintBlock(documentValue, profile);
  },

  // An empty label, unfilled placeholders, or a label the printer cannot fit.
  contentPrintBlock(documentValue, profile) {
    if (!documentValue.elements.length) {
      return { kind: 'empty', message: '请先添加至少一个标签元素。', suggestProfileId: '', canAddElement: true };
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
    if (!fit.ok && !this.textReachesIntoStrip(documentValue, fit)) {
      return {
        kind: 'size',
        message: fit.message,
        reason: fit.reason || '',
        elementId: fit.elementId || '',
        suggestProfileId: fit.suggestProfileId || '',
        canResize: fit.reason === 'PAPER_TOO_LARGE'
      };
    }
    return null;
  },

  /**
   * The page cannot scroll (100vh + overflow hidden), so a keyboard would sit on
   * top of the property panel and the owner would type blind. Lifting the whole
   * layout by the keyboard height keeps the panel visible above it.
   */
  bindKeyboard() {
    if (typeof wx.onKeyboardHeightChange !== 'function') return;
    this.keyboardListener = (event) => {
      const height = Math.max(0, Math.min(Number(event && event.height) || 0, 420));
      if (height === this.data.keyboardHeight) return;
      this.setData({ keyboardHeight: height });
    };
    wx.onKeyboardHeightChange(this.keyboardListener);
  },

  unbindKeyboard() {
    if (!this.keyboardListener) return;
    if (typeof wx.offKeyboardHeightChange === 'function') {
      wx.offKeyboardHeightChange(this.keyboardListener);
    }
    this.keyboardListener = null;
  },

  /**
   * A text box usually reaches past the glyphs inside it, so its bounding box
   * can touch a strip the head never prints on a label whose ink is fine. Those
   * are judged on the real pixels at print time (createPrintImageData), which
   * still stops before a single byte reaches the printer.
   */
  textReachesIntoStrip(documentValue, fit) {
    if (!fit || fit.reason !== 'MARGIN_INK') return false;
    const elements = documentValue && Array.isArray(documentValue.elements) ? documentValue.elements : [];
    const element = elements.find((item) => String(item.id) === String(fit.elementId));
    return Boolean(element) && ['text', 'date', 'serial'].indexOf(element.type) >= 0;
  },

  // Codes the renderer refuses, such as one too dense to scan.
  elementPrintBlock(documentValue, profile) {
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

  // One label per filled data row; rowNumbers[i] is the data row of
  // documents[i]. A row that cannot become a label throws 第 N 行无法生成：….
  buildBatchPrint(profile) {
    const rowNumbers = [];
    const documents = buildBatchDocuments(this.document, this.batch.rows, {
      validate: (documentValue, rowNumber) => {
        validateDocument(documentValue, profile.dpi);
        rowNumbers.push(rowNumber);
      }
    });
    if (!documents.length) throw new Error('批量数据里没有要打印的行，请先在批量数据页填写。');
    return { documents, rowNumbers };
  },

  // The first problem among the rows' labels, named by its data row.
  batchRowsBlock(documents, rowNumbers, profile) {
    for (let index = 0; index < documents.length; index += 1) {
      const block = this.contentPrintBlock(documents[index], profile);
      if (block) return rowPrintBlock(block, rowNumbers[index], documents[index]);
    }
    return null;
  },

  evaluateBatchPrintBlock(profile = this.profile) {
    const widthBlock = this.paperWidthBlock();
    if (widthBlock) return widthBlock;
    let built;
    try {
      built = this.buildBatchPrint(profile);
    } catch (error) {
      return batchPrintBlock(error);
    }
    return this.batchRowsBlock(built.documents, built.rowNumbers, profile);
  },

  refreshPrintBlock() {
    const printBlock = this.batch ? this.evaluateBatchPrintBlock() : this.evaluatePrintBlock();
    this.showPrintBlock(printBlock, this.profile, { printError: '' });
    return printBlock;
  },

  // Shows a preflight result; with nothing to fix, the sheet notes the blank
  // edges the printer skips instead.
  showPrintBlock(printBlock, profile = this.profile, patch) {
    const block = this.withPrinterSuggestion(printBlock);
    const suggested = block && block.suggestProfileId
      ? getProfile(block.suggestProfileId)
      : null;
    this.setData(Object.assign({
      printBlock: block,
      suggestedProfileName: suggested ? suggested.name : '',
      printAreaNote: block ? '' : this.edgeNote(this.document, profile)
    }, patch || {}));
  },

  // A printer whose name says its paper width (…58 / …80) is never offered
  // the other width: its print head stays the same size, so the label has to
  // change size instead.
  withPrinterSuggestion(printBlock) {
    if (!printBlock || !printBlock.suggestProfileId) return printBlock;
    const stated = printerNameProfileId(this.printerName());
    if (!stated || stated === printBlock.suggestProfileId) return printBlock;
    // A name that states its width rules out switching models. Changing the
    // label size still fixes a label that is too large — but not ink that falls
    // in a strip this printer cannot reach.
    return Object.assign({}, printBlock, {
      suggestProfileId: '',
      canResize: printBlock.reason === 'PAPER_TOO_LARGE'
    });
  },

  // The connected printer's name, else the remembered printer's.
  printerName() {
    if (this.data.connectionState === 'connected' && this.data.connectedDevice) return this.data.connectedDevice;
    const saved = this.savedPrinter();
    return saved ? String(saved.name || saved.displayName || saved.localName || '') : '';
  },

  savedPrinter() {
    const manager = this.connectionManager;
    if (!manager || typeof manager.getSavedDevice !== 'function') return null;
    try {
      return manager.getSavedDevice() || null;
    } catch (error) {
      return null;
    }
  },

  // A label a little wider than the print head prints without its blank
  // edge strips.
  edgeNote(documentValue, profile) {
    const fit = evaluatePrintability(documentValue, profile);
    if (!fit.ok || !fit.cropped) return '';
    return profile.printDirection === 'left'
      ? '标签比打印头略宽，上下两侧空白处不会打印'
      : '标签比打印头略宽，两侧空白处不会打印';
  },

  openPrintSheet() {
    this.commitFieldEditDraft();
    this.refreshPrintBlock();
    const saved = this.savedPrinter();
    const patch = {
      showPrintSheet: true,
      savedPrinterName: saved ? String(saved.name || saved.displayName || saved.localName || '打印机') : ''
    };
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
    const apply = () => {
      this.pickProfile(profile);
      this.syncPageData(() => {
        this.initCanvas();
        this.refreshPrintBlock();
      });
    };
    if (printerNameProfileId(this.printerName()) === profileId) {
      apply();
      return;
    }
    // The name does not say the width, so only the user knows it. A wrong
    // width is remembered with the printer and prints every label askew.
    wx.showModal({
      title: `打印机是 ${profile.paperMaxMm}mm 纸宽吗？`,
      content: '选错纸宽，标签会打歪或打不全。纸宽一般写在打印机机身或说明书上。',
      confirmText: '是的',
      cancelText: '不是',
      success: (result) => {
        if (result && result.confirm) apply();
      }
    });
  },

  // The label size sits in the settings sheet.
  openSizeSettings() {
    if (this.data.printing) return;
    this.returnToPrintAfterProfile = false;
    this.setData({ showPrintSheet: false, showSettingsSheet: true });
  },

  // The printer row of the print sheet picks another printer, then comes back.
  choosePrinterFromPrint() {
    if (this.data.printing) return;
    this.returnToPrintAfterConnect = true;
    this.setData({ showPrintSheet: false });
    this.openDevices();
  },

  // Leaves the sheet on the 元素 tab, where the first element is added.
  closePrintAndAdd() {
    this.setData({
      showPrintSheet: false,
      editorPanelTab: 'elements',
      panelScrollTarget: PANEL_TOP_ID
    });
  },

  focusPrintElement() {
    const elementId = this.data.printBlock && this.data.printBlock.elementId;
    if (!elementId || !this.document.elements.some((item) => item.id === elementId)) return;
    this.setSelection([elementId], false);
    // The element's settings live on the 元素 tab; show them from the top.
    this.setData({ showPrintSheet: false, editorPanelTab: 'elements', panelScrollTarget: PANEL_TOP_ID });
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

  recordPrintSafely(entry) {
    try {
      this.repository.recordPrint(entry);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Loads each picture once, even when every row of a batch repeats it.
  async preparePrintImages(documentValue) {
    const images = {};
    const pictures = new Map();
    documentValue.elements.forEach((element) => {
      if ((element.type === 'image' || element.type === 'material') && element.path && !pictures.has(element.id)) {
        pictures.set(element.id, element);
      }
    });
    await Promise.all(Array.from(pictures.values()).map((element) => new Promise((resolve, reject) => {
      const image = this.canvas.createImage();
      const timer = setTimeout(() => reject(new Error('标签图片加载超时，请重新选择图片后重试')), 15000);
      image.onload = () => { clearTimeout(timer); images[element.id] = image; resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('标签图片加载失败，请重新选择图片后重试')); };
      image.src = this.resolveImagePath(element.path);
    })));
    return images;
  },

  // Rasters the whole label. A label a little wider than the head sends only
  // the band the head reaches, and only when the skipped strips are blank
  // at the same black/white threshold the printer uses.
  createPrintImageData(documentValue, profile = this.profile, images = this.images, threshold = this.data.threshold) {
    const plan = printRasterPlan(documentValue, profile);
    const size = plan.canvas;
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
    const imageData = context.getImageData(0, 0, size.width, size.height);
    if (!plan.crop) return imageData;
    if (marginInkReport(imageData, plan, threshold).ink) {
      const error = new Error(marginInkMessage(documentValue, profile, plan));
      error.code = 'MARGIN_INK';
      throw error;
    }
    return cropImageData(imageData, plan.crop);
  },

  /**
   * The last print may already have produced a label. A second attempt is a
   * decision the owner makes on purpose, never a reflex tap on the red button.
   */
  confirmReprint() {
    if (this.data.printing) return;
    wx.showModal({
      title: '刚才可能已经出纸了',
      content: '上一次打印中断，可能已经有标签打出来。再打一次会多出一张，请先核对已经出来的标签。',
      confirmText: '确认重打',
      cancelText: '先看看',
      confirmColor: '#E02D26',
      success: (result) => {
        if (result && result.confirm) this.startPrint();
      }
    });
  },

  assertPrintActive(generation) {
    if (!this.pageActive || this.printCancelRequested || generation !== this.printTaskGeneration) {
      const error = new Error('打印已取消');
      error.code = 'PRINT_CANCELLED';
      throw error;
    }
  },

  // A back swipe while printing asks first instead of silently ending the job.
  setLeaveAlert(enabled) {
    if (enabled) {
      if (typeof wx.enableAlertBeforeUnload === 'function') wx.enableAlertBeforeUnload({ message: PRINT_LEAVE_MESSAGE });
    } else if (typeof wx.disableAlertBeforeUnload === 'function') {
      wx.disableAlertBeforeUnload();
    }
  },

  async startPrint() {
    if (this.data.printing) return;
    this.commitFieldEditDraft();
    if (!this.context || !this.canvasSize || !this.data.canvasReady) {
      wx.showToast({ title: '预览还没准备好，请稍等再打印', icon: 'none' });
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

    // Data rows do not depend on the printer, so their problems show before
    // anything connects.
    let batchPrint = null;
    if (this.batch) {
      try {
        batchPrint = this.buildBatchPrint(this.profile);
      } catch (error) {
        this.showPrintBlock(batchPrintBlock(error));
        return;
      }
    }

    const taskGeneration = (this.printTaskGeneration || 0) + 1;
    this.printTaskGeneration = taskGeneration;
    this.printCancelRequested = false;
    this.setData({ printing: true, printProgress: 2, printMessage: '正在确认打印机连接', printError: '', printMayHavePrinted: false });
    this.setLeaveAlert(true);
    let blockedAfterConnect = false;
    const projectId = this.projectId || '';
    const requestedDocument = cloneDocument(this.document);
    const options = {
      copies: this.data.copies,
      density: this.data.density,
      threshold: this.data.threshold,
      labelType: this.data.labelTypeIndex + 1
    };
    let printImages = {};
    let pageMessage = '';
    const request = {
      profile: this.profile,
      options,
      prepare: async (snapshot, controls) => {
        if (this.connectionManager) {
          const result = await this.connectionManager.ensureReady(savedDevice);
          controls.assertActive();
          this.assertPrintActive(taskGeneration);
          this.applyConnectionResult(result);
        }
        this.assertPrintActive(taskGeneration);
        const profile = Object.assign({}, this.profile);
        const block = this.paperWidthBlock()
          || (snapshot.documents
            ? this.batchRowsBlock(snapshot.documents, batchPrint.rowNumbers, profile)
            : this.evaluatePrintBlock(snapshot.document, profile));
        if (block) {
          blockedAfterConnect = true;
          this.showPrintBlock(block, profile, { printProgress: 0, printMessage: '' });
          const error = new Error(block.message);
          error.code = 'PRINT_PREFLIGHT_BLOCKED';
          throw error;
        }
        this.setData({
          printProgress: 5,
          printMessage: '正在准备打印内容',
          printAreaNote: this.edgeNote(snapshot.document, profile)
        });
        const printSource = combinedDocument(snapshot.documents || [snapshot.document]);
        await ensureDocumentFonts(printSource, fontRuntime());
        controls.assertActive();
        printImages = await this.preparePrintImages(printSource);
        this.assertPrintActive(taskGeneration);
        return { profile };
      },
      render: (documentValue, profile) => {
        this.assertPrintActive(taskGeneration);
        validateDocument(documentValue, profile.dpi);
        return this.createPrintImageData(documentValue, profile, printImages, options.threshold);
      },
      onProgress: (progress, message) => {
        if (!this.pageActive || taskGeneration !== this.printTaskGeneration) return;
        // During a batch the label count says more than each page's own steps.
        this.setData({ printProgress: progress, printMessage: pageMessage && progress < 100 ? pageMessage : message });
      }
    };
    if (batchPrint) {
      request.documents = batchPrint.documents;
      request.onPage = (index, total, info) => {
        pageMessage = batchPageMessage(index, total, info, options.copies);
        if (!this.pageActive || taskGeneration !== this.printTaskGeneration) return;
        this.setData({ printMessage: pageMessage });
      };
    } else {
      request.document = requestedDocument;
    }
    this.printJobService = this.printJobService || new PrintJobService({ printer: this.printer });
    try {
      const completed = await this.printJobService.run(request);
      if (this.connectionManager) this.connectionManager.touch(savedDevice);
      const entry = {
        name: completed.document.name,
        projectId,
        result: 'success',
        message: `已完成 ${completed.completedCopies} 份`,
        profileId: completed.profile.id,
        deviceName: this.data.connectedDevice,
        document: completed.document
      };
      if (batchPrint) {
        entry.name = `${completed.document.name} 等 ${completed.totalCopies} 张`;
        entry.message = `已完成 ${completed.completedCopies} 张`;
      }
      const historySaved = this.recordPrintSafely(entry);
      if (this.pageActive && taskGeneration === this.printTaskGeneration) {
        this.setData({ printProgress: 100, printMessage: '打印完成', printError: '' });
        const serialPlan = batchPrint ? null : serialAdvancePlan(completed.document, completed.completedCopies);
        if (serialPlan) {
          this.offerSerialAdvance(serialPlan, historySaved);
        } else {
          wx.showToast({
            title: historySaved ? '打印完成' : '打印完成，历史未保存',
            icon: historySaved ? 'success' : 'none'
          });
        }
      }
    } catch (error) {
      if (blockedAfterConnect) return;
      const cancelled = this.printCancelRequested || !this.pageActive
        || taskGeneration !== this.printTaskGeneration
        || /已取消/.test(String(error && error.message || ''));
      const job = error.printJob;
      const unit = batchPrint ? '张' : '份';
      const paperNotice = job && job.possiblyPrinted
        ? `已确认完成 ${job.completedCopies}/${job.totalCopies} ${unit}，可能仍有标签出纸。请核对实物后再打印，避免重复。`
        : '';
      const message = [cancelled ? '' : friendlyPrintError(error), paperNotice].filter(Boolean).join('；');
      const batchTotal = job ? job.totalCopies : (batchPrint ? batchPrint.documents.length * options.copies : 0);
      this.recordPrintSafely({
        name: batchPrint ? `${batchPrint.documents[0].name} 等 ${batchTotal} 张` : requestedDocument.name,
        projectId,
        result: cancelled ? 'cancelled' : 'failed',
        // The same plain words as the print sheet; raw Bluetooth errors mean nothing to a shop owner.
        message: [cancelled ? '已取消' : friendlyPrintError(error), paperNotice].filter(Boolean).join('；'),
        profileId: job ? job.profile.id : this.profile.id,
        deviceName: this.data.connectedDevice,
        document: job ? job.document : requestedDocument
      });
      if (this.pageActive && taskGeneration === this.printTaskGeneration) {
        this.setData({
          printMessage: cancelled ? '打印已取消' : '打印未完成',
          printError: message,
          printMayHavePrinted: Boolean(paperNotice)
        });
        wx.showToast({ title: cancelled ? '打印已取消' : message, icon: 'none', duration: 2800 });
      }
    } finally {
      if (taskGeneration === this.printTaskGeneration) {
        this.printCancelRequested = false;
        if (this.pageActive) {
          this.setLeaveAlert(false);
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

  // Numbered labels: the next job can start where this one ended.
  offerSerialAdvance(plan, historySaved) {
    wx.showModal({
      title: historySaved ? '打印完成' : '打印完成，历史未保存',
      content: `已打印到 ${plan.lastText}。下次从 ${plan.nextText} 开始吗？`,
      confirmText: '接着编号',
      cancelText: '保持不变',
      confirmColor: '#E02D26',
      success: (result) => {
        if (result && result.confirm) this.applySerialAdvancePlan(plan);
      }
    });
  },

  // Through commit, so undo brings the previous numbers back.
  applySerialAdvancePlan(plan) {
    if (!this.document || this.pageActive === false) return;
    this.commit((documentValue) => {
      documentValue.elements = applySerialAdvance(documentValue, plan).elements;
    });
    wx.showToast({ title: `下次从 ${plan.nextText} 开始`, icon: 'none' });
  },

  async cancelPrint() {
    if (!this.data.printing) return;
    this.printCancelRequested = true;
    this.setData({ printMessage: '正在停止打印…' });
    // Still connecting: stop the attempt now instead of waiting for its
    // timeout with a sheet that cannot close.
    if (this.session && typeof this.session.cancelConnectAttempt === 'function') {
      try {
        this.session.cancelConnectAttempt();
      } catch (error) {
        // Nothing was connecting.
      }
    }
    try {
      if (this.printJobService) await this.printJobService.cancel();
      else await this.printer.cancel();
    } catch (error) {
      // PrinterClient will surface the original task result to startPrint.
    }
  }
});
