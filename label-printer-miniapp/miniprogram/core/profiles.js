const {
  cropImageData,
  elementInkBounds,
  marginInkMessage,
  marginInkReport,
  previewCanvasSize,
  printAreaCheck,
  printRasterPlan
} = require('./print-area');

// The app prints to ESC/POS thermal printers only (core/escpos.js), sized by
// paper width: a 58 mm printer has a 48 mm (384-dot) head, an 80 mm one a
// 72 mm (576-dot) head. Density is the printer's own setting.
const PROFILES = [
  {
    id: 'escpos-58',
    name: '58mm 打印机',
    family: '5',
    task: 'escpos',
    dpi: 203,
    printheadPixels: 384,
    paperMaxMm: 58,
    printDirection: 'top',
    densityMin: 3,
    densityMax: 3,
    densityDefault: 3,
    defaultSize: [50, 30]
  },
  {
    id: 'escpos-80',
    name: '80mm 打印机',
    family: '8',
    task: 'escpos',
    dpi: 203,
    printheadPixels: 576,
    paperMaxMm: 80,
    printDirection: 'top',
    densityMin: 3,
    densityMax: 3,
    densityDefault: 3,
    defaultSize: [50, 30]
  }
];

function getProfile(id) {
  return PROFILES.find((item) => item.id === id) || PROFILES[0];
}

/**
 * The profile id a Bluetooth name states by its ending, as the receipt app
 * reads it (…58 or …80), or '' when the name does not say.
 */
function printerNameProfileId(deviceName) {
  const match = /(?:^|\D)(58|80)$/.exec(String(deviceName || '').trim());
  if (!match) return '';
  return match[1] === '80' ? 'escpos-80' : 'escpos-58';
}

/** Paper width from the end of the Bluetooth name; a name that does not say prints 58 mm. */
function profileForPrinterName(deviceName) {
  return getProfile(printerNameProfileId(deviceName) || 'escpos-58');
}

/** Model a remembered printer prints with: the user's pick for it, else by its name. */
function savedPrinterProfile(saved) {
  const value = saved || {};
  const pick = PROFILES.find((item) => item.id === value.confirmedProfileId);
  return pick || profileForPrinterName(value.name || value.displayName || value.localName || '');
}

// Canvas for a label that fits the head as-is. printRasterPlan() also covers
// labels up to the paper width by skipping blank edge strips.
function alignedCanvasSize(document, profile) {
  const size = previewCanvasSize(document, profile.dpi);
  const dotsPerMillimeter = profile.dpi / 25.4;
  let { width, height } = size;
  if (profile.printDirection === 'left') {
    height = Math.ceil(height / 8) * 8;
    if (height > profile.printheadPixels) {
      throw new Error(`当前机型打印高度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
    }
  } else {
    width = Math.ceil(width / 8) * 8;
    if (width > profile.printheadPixels) {
      throw new Error(`当前机型打印宽度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
    }
  }
  return { width, height };
}

/**
 * Non-throwing printability check used before opening the print sheet.
 * Returns the blocking reason plus the first profile that could print the
 * label as-is, so the UI can offer a way out instead of a dead end.
 * reason: '' | 'MARGIN_INK' (elementId names the element in a skipped strip)
 * | 'PAPER_TOO_LARGE'; cropped: the printer skips blank strips at the edges.
 */
function evaluatePrintability(document, profile) {
  const check = printAreaCheck(document, profile);
  const result = {
    ok: check.ok,
    message: check.message,
    suggestProfileId: '',
    cropped: check.cropped,
    reason: check.reason,
    elementId: check.elementId
  };
  if (!check.ok) {
    const fallback = PROFILES.find((item) => item.id !== profile.id && printAreaCheck(document, item).ok);
    result.suggestProfileId = fallback ? fallback.id : '';
  }
  return result;
}

function printableProfilesForDocument(document) {
  return PROFILES.filter((profile) => printAreaCheck(document, profile).ok).map((profile) => profile.id);
}

// Shelf and picker labels, one family per paper width.
const PRINTER_FAMILIES = Object.freeze([
  Object.freeze({ code: '5', label: '58mm' }),
  Object.freeze({ code: '8', label: '80mm' })
]);

function familiesOf(profileIds) {
  const ids = Array.isArray(profileIds) ? profileIds : [];
  return PRINTER_FAMILIES.filter((family) => PROFILES.some((profile) => (
    profile.family === family.code && ids.includes(profile.id)
  )));
}

/** '5', '8', '58' or '' for a list of profile ids. */
function printerFamilyCode(profileIds) {
  return familiesOf(profileIds).map((family) => family.code).join('');
}

/** '58mm', '80mm', both joined with ' · ', or '' for a list of profile ids. */
function printerFamilyLabel(profileIds) {
  return familiesOf(profileIds).map((family) => family.label).join(' · ');
}

module.exports = {
  PRINTER_FAMILIES,
  PROFILES,
  alignedCanvasSize,
  cropImageData,
  elementInkBounds,
  evaluatePrintability,
  getProfile,
  marginInkMessage,
  marginInkReport,
  previewCanvasSize,
  printRasterPlan,
  printableProfilesForDocument,
  printerFamilyCode,
  printerFamilyLabel,
  printerNameProfileId,
  profileForPrinterName,
  savedPrinterProfile
};
