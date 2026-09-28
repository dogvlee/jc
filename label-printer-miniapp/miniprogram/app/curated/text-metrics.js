/**
 * Conservative text width estimate in millimetres, shared by the curated
 * layout generator and its quality gate. CJK glyphs are one em wide in every
 * font the app uses; Latin widths are rounded up from PingFang, Source Han
 * Sans and Arial so a line that fits here also fits on device.
 */
const BOLD_FACTOR = 1.04;

function isWideCharacter(code) {
  return (code >= 0x2e80 && code <= 0x9fff)
    || (code >= 0x3000 && code <= 0x303f)
    || (code >= 0xac00 && code <= 0xd7af)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xff01 && code <= 0xff60)
    || code === 0x2103 || code === 0x2116 || code === 0x25a1 || code === 0x2605;
}

function characterEm(character) {
  const code = character.codePointAt(0) || 0;
  if (isWideCharacter(code) || code > 0xffff) return 1;
  if (character === ' ') return 0.3;
  if (/[0-9]/.test(character)) return 0.6;
  if (/[A-Z]/.test(character)) return /[MW]/.test(character) ? 0.9 : /[IJ]/.test(character) ? 0.36 : 0.7;
  if (/[a-z]/.test(character)) return /[mw]/.test(character) ? 0.88 : /[ijlft]/.test(character) ? 0.32 : 0.57;
  if (character === '¥') return 0.62;
  if (character === '%' || character === '@' || character === '&') return 0.8;
  if (/[.,:;'`!|]/.test(character)) return 0.3;
  if (character === '·' || character === '•') return 0.5;
  if (character === '–' || character === '—' || character === '×') return 0.7;
  return 0.5;
}

/** Width of one line of `text` at `fontSizeMm`. */
function lineWidthMm(text, fontSizeMm, bold) {
  const em = Array.from(String(text || '')).reduce((total, character) => total + characterEm(character), 0);
  return em * Number(fontSizeMm) * (bold ? BOLD_FACTOR : 1);
}

/** Widest line of a (possibly multi-line) text. */
function textWidthMm(text, fontSizeMm, bold) {
  return String(text || '').split('\n').reduce((max, line) => Math.max(max, lineWidthMm(line, fontSizeMm, bold)), 0);
}

module.exports = { lineWidthMm, textWidthMm };
