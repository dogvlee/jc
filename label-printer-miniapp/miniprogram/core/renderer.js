const qrcode = require('../vendor/qrcode');
const { encodeCode128B } = require('./code128');
const { encodeEan13 } = require('./ean13');
const { drawMaterialSymbol } = require('./materials');
const { drawBorderStyle, borderById } = require('./borders');
const { clampTextArcAngle, normalizeTextMode } = require('./text-direction');
const { CHROME } = require('./editor-gesture');

const QR_QUIET_ZONE_MODULES = 4;
const thresholdImageCache = new WeakMap();
const DOT_EPSILON = 1e-6;

if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
}

function mmToDots(value, dpi) {
  return value * dpi / 25.4;
}

function fontValue(element, fontPixels) {
  return `${element.italic ? 'italic ' : ''}${element.bold ? 'bold ' : ''}${fontPixels}px ${element.fontFamily || 'sans-serif'}`;
}

function lineSpacingValue(element) {
  // UI shows 0.0 as baseline; map 0 → 1.15, positive as multiplier.
  const value = Number(element.lineSpacing);
  if (!Number.isFinite(value) || value === 0) return 1.15;
  return value > 0 && value < 0.4 ? 1.15 + value : value;
}

function letterSpacingDots(element, dpi) {
  const value = Number(element.letterSpacing);
  return Number.isFinite(value) ? mmToDots(value, dpi) : 0;
}

function measureSpacedText(context, text, spacing) {
  const characters = Array.from(String(text || ''));
  if (!characters.length) return 0;
  if (!spacing) return context.measureText(characters.join('')).width;
  return characters.reduce((total, character) => total + context.measureText(character).width, 0)
    + spacing * (characters.length - 1);
}

function wrapText(context, text, maxWidth, spacing) {
  const lines = [];
  String(text || '').split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    let current = '';
    Array.from(paragraph).forEach((character) => {
      const candidate = current + character;
      if (current && measureSpacedText(context, candidate, spacing) > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    });
    lines.push(current);
  });
  return lines;
}

function glyphMetrics(context, characters, fontPixels) {
  let width = fontPixels;
  let ascent = fontPixels * 0.8;
  let descent = fontPixels * 0.2;
  characters.forEach((character) => {
    const metrics = context.measureText(character);
    width = Math.max(width, Number(metrics.width) || 0);
    const measuredAscent = Number(metrics.actualBoundingBoxAscent);
    const measuredDescent = Number(metrics.actualBoundingBoxDescent);
    if (Number.isFinite(measuredAscent) && measuredAscent >= 0) ascent = Math.max(ascent, measuredAscent);
    if (Number.isFinite(measuredDescent) && measuredDescent >= 0) descent = Math.max(descent, measuredDescent);
  });
  return { ascent, descent, height: ascent + descent, width };
}

function splitVerticalColumns(text, capacity) {
  const columns = [];
  String(text || '').split('\n').forEach((paragraph) => {
    const characters = Array.from(paragraph);
    if (!characters.length) {
      columns.push([]);
      return;
    }
    for (let index = 0; index < characters.length; index += capacity) {
      columns.push(characters.slice(index, index + capacity));
    }
  });
  return columns;
}

function verticalLayout(context, element, width, height, dpi, fontPixels) {
  context.font = fontValue(element, fontPixels);
  const allCharacters = Array.from(String(element.text || '').replace(/\n/g, ''));
  const glyph = glyphMetrics(context, allCharacters, fontPixels);
  const spacing = letterSpacingDots(element, dpi);
  const characterAdvance = glyph.height + spacing;
  const capacity = height >= glyph.height
    ? Math.max(1, Math.floor((height - glyph.height) / characterAdvance) + 1)
    : 1;
  const columns = splitVerticalColumns(element.text, capacity);
  const columnAdvance = glyph.width * Math.max(1, lineSpacingValue(element));
  const blockWidth = columns.length
    ? glyph.width + Math.max(0, columns.length - 1) * columnAdvance
    : 0;
  const columnHeights = columns.map((characters) => characters.length
    ? glyph.height + (characters.length - 1) * characterAdvance
    : 0);
  const blockHeight = columnHeights.length ? Math.max(...columnHeights) : 0;
  return {
    blockHeight,
    blockWidth,
    characterAdvance,
    columnAdvance,
    columnHeights,
    columns,
    fontPixels,
    glyphAscent: glyph.ascent,
    glyphDescent: glyph.descent,
    glyphHeight: glyph.height,
    glyphWidth: glyph.width,
    spacing
  };
}

function horizontalLayout(context, element, width, dpi, fontPixels) {
  context.font = fontValue(element, fontPixels);
  const spacing = letterSpacingDots(element, dpi);
  const lines = wrapText(context, element.text, width, spacing);
  const lineHeight = fontPixels * lineSpacingValue(element);
  const lineWidths = lines.map((line) => measureSpacedText(context, line, spacing));
  return {
    blockHeight: lines.length ? fontPixels + Math.max(0, lines.length - 1) * lineHeight : 0,
    blockWidth: lineWidths.length ? Math.max(...lineWidths) : 0,
    fontPixels,
    lineHeight,
    lines,
    lineWidths,
    spacing
  };
}

function isEastAsianGlyph(character) {
  const code = String(character || '').codePointAt(0) || 0;
  return (code >= 0x2e80 && code <= 0x9fff)
    || (code >= 0x3040 && code <= 0x30ff)
    || (code >= 0xac00 && code <= 0xd7af)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xff01 && code <= 0xff60);
}

function horizontalGlyphRotation(mode, character) {
  if (mode === 'horizontal-90-words-rotate') return -Math.PI / 2;
  if (mode === 'horizontal-90' && isEastAsianGlyph(character)) return -Math.PI / 2;
  return 0;
}

function verticalGlyphRotation(mode, character) {
  if (mode === 'vertical' && String(character).trim() && !isEastAsianGlyph(character)) return Math.PI / 2;
  return 0;
}

function horizontalOrientedLayout(context, element, width, dpi, fontPixels, mode) {
  context.font = fontValue(element, fontPixels);
  const spacing = letterSpacingDots(element, dpi);
  const lines = [];
  const advances = [];
  const rotations = [];
  const lineHeights = [];
  String(element.text || '').split('\n').forEach((paragraph) => {
    const characters = Array.from(paragraph);
    if (!characters.length) {
      lines.push([]);
      advances.push([]);
      rotations.push([]);
      lineHeights.push(fontPixels);
      return;
    }
    let line = [];
    let lineAdvances = [];
    let lineRotations = [];
    let lineWidth = 0;
    let lineHeight = fontPixels;
    const flush = () => {
      lines.push(line);
      advances.push(lineAdvances);
      rotations.push(lineRotations);
      lineHeights.push(lineHeight);
      line = [];
      lineAdvances = [];
      lineRotations = [];
      lineWidth = 0;
      lineHeight = fontPixels;
    };
    characters.forEach((character) => {
      const rotation = horizontalGlyphRotation(mode, character);
      const measured = Math.max(0.1, context.measureText(character).width);
      const advance = rotation ? fontPixels : measured;
      const glyphHeight = rotation ? measured : fontPixels;
      const candidate = lineWidth + (line.length ? spacing : 0) + advance;
      if (line.length && candidate > width) flush();
      if (line.length) lineWidth += spacing;
      line.push(character);
      lineAdvances.push(advance);
      lineRotations.push(rotation);
      lineWidth += advance;
      lineHeight = Math.max(lineHeight, glyphHeight);
    });
    flush();
  });
  const lineWidths = advances.map((items) => items.reduce((sum, value) => sum + value, 0)
    + Math.max(0, items.length - 1) * spacing);
  const gap = Math.max(0, lineSpacingValue(element) - 1) * fontPixels;
  const lineOffsets = [];
  let blockHeight = 0;
  lineHeights.forEach((lineHeight, index) => {
    lineOffsets.push(blockHeight);
    blockHeight += lineHeight + (index < lineHeights.length - 1 ? gap : 0);
  });
  return {
    advances,
    blockHeight,
    blockWidth: lineWidths.length ? Math.max(...lineWidths) : 0,
    fontPixels,
    lineHeights,
    lineOffsets,
    lines,
    lineWidths,
    rotations,
    spacing
  };
}

function arcLayout(context, element, width, dpi, fontPixels) {
  context.font = fontValue(element, fontPixels);
  const characters = Array.from(String(element.text || '').replace(/\n/g, ''));
  const spacing = letterSpacingDots(element, dpi);
  const glyph = glyphMetrics(context, characters, fontPixels);
  const advances = characters.map((character) => Math.max(0.1, context.measureText(character).width));
  const arcAngle = clampTextArcAngle(element.textArcAngle);
  const theta = arcAngle * Math.PI / 180;
  const totalAdvance = advances.reduce((total, value) => total + value, 0)
    + Math.max(0, advances.length - 1) * spacing;
  if (characters.length < 2 || theta < 0.001) {
    const flat = horizontalLayout(context, element, width, dpi, fontPixels);
    return Object.assign({}, flat, { arcAngle: 0, arcFlat: true });
  }
  const radius = Math.max(fontPixels / 2, totalAdvance / theta);
  const chord = 2 * radius * Math.sin(theta / 2);
  const sagitta = radius * (1 - Math.cos(theta / 2));
  return {
    advances,
    arcAngle,
    blockHeight: fontPixels + sagitta,
    blockWidth: chord + glyph.width,
    characters,
    fontPixels,
    glyphWidth: glyph.width,
    radius,
    spacing,
    theta,
    totalAdvance
  };
}

function fitText(context, element, width, height, dpi) {
  let fontPixels = Math.max(7, mmToDots(element.fontSize || 4, dpi));
  let layout;
  const mode = normalizeTextMode(element);
  while (fontPixels >= 1) {
    if (mode === 'horizontal-90' || mode === 'horizontal-90-words-rotate') {
      layout = horizontalOrientedLayout(context, element, width, dpi, fontPixels, mode);
    } else if (mode === 'vertical' || mode === 'vertical-words-rotate') {
      layout = verticalLayout(context, element, width, height, dpi, fontPixels);
    } else if (mode === 'arc') {
      layout = arcLayout(context, element, width, dpi, fontPixels);
    } else {
      layout = horizontalLayout(context, element, width, dpi, fontPixels);
    }
    const fits = layout.blockWidth <= width + 0.001 && layout.blockHeight <= height + 0.001;
    if (element.autoFit === false || fits || fontPixels === 1) break;
    fontPixels -= 1;
  }
  return layout;
}

function withElementTransform(context, element, dpi, draw) {
  const x = mmToDots(element.x, dpi);
  const y = mmToDots(element.y, dpi);
  const width = mmToDots(element.width, dpi);
  const height = mmToDots(element.height, dpi);
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((element.rotation || 0) * Math.PI / 180);
  context.scale(element.mirrorX ? -1 : 1, element.mirrorY ? -1 : 1);
  draw(-width / 2, -height / 2, width, height);
  context.restore();
}

function alignedStart(origin, available, content, alignment) {
  if (alignment === 'middle' || alignment === 'center') {
    return origin + Math.max(0, (available - content) / 2);
  }
  if (alignment === 'bottom' || alignment === 'right') {
    return origin + Math.max(0, available - content);
  }
  return origin;
}

function drawHorizontalText(context, element, fitted, x, y, width, height) {
  context.textBaseline = 'top';
  context.textAlign = element.align || 'left';
  const textX = element.align === 'center' ? x + width / 2 : element.align === 'right' ? x + width : x;
  const startY = alignedStart(y, height, fitted.blockHeight, element.verticalAlign);
  fitted.lines.forEach((line, index) => {
    const lineY = startY + index * fitted.lineHeight;
    if (fitted.spacing > 0 && line.length > 1) {
      const characters = Array.from(line);
      const measured = fitted.lineWidths[index];
      let cursor = element.align === 'center' ? textX - measured / 2 : element.align === 'right' ? textX - measured : textX;
      context.textAlign = 'left';
      characters.forEach((character) => {
        context.fillText(character, cursor, lineY);
        cursor += context.measureText(character).width + fitted.spacing;
      });
      context.textAlign = element.align || 'left';
    } else {
      context.fillText(line, textX, lineY, width);
    }
    if ((element.underline || element.strike) && line) {
      const measured = fitted.lineWidths[index];
      const lineStart = element.align === 'center' ? textX - measured / 2 : element.align === 'right' ? textX - measured : textX;
      context.beginPath();
      context.lineWidth = Math.max(1, fitted.fontPixels / 14);
      if (element.underline) {
        context.moveTo(lineStart, lineY + fitted.fontPixels * 0.98);
        context.lineTo(lineStart + measured, lineY + fitted.fontPixels * 0.98);
      }
      if (element.strike) {
        context.moveTo(lineStart, lineY + fitted.fontPixels * 0.52);
        context.lineTo(lineStart + measured, lineY + fitted.fontPixels * 0.52);
      }
      context.stroke();
    }
  });
}

function drawVerticalText(context, element, fitted, x, y, width, height, rotationForCharacter) {
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const horizontalAlignment = element.align === 'center' ? 'center' : element.align === 'right' ? 'right' : 'left';
  const startX = alignedStart(x, width, fitted.blockWidth, horizontalAlignment);
  fitted.columns.forEach((characters, columnIndex) => {
    if (!characters.length) return;
    const columnX = startX + fitted.glyphWidth / 2 + columnIndex * fitted.columnAdvance;
    const columnHeight = fitted.columnHeights[columnIndex];
    const startY = alignedStart(y, height, columnHeight, element.verticalAlign) + fitted.glyphAscent;
    characters.forEach((character, characterIndex) => {
      const characterY = startY + characterIndex * fitted.characterAdvance;
      const glyphRotation = typeof rotationForCharacter === 'function'
        ? rotationForCharacter(character)
        : Number(rotationForCharacter) || 0;
      if (glyphRotation) {
        context.save();
        context.translate(columnX, characterY - fitted.glyphAscent + fitted.glyphHeight / 2);
        context.rotate(glyphRotation);
        context.textBaseline = 'middle';
        context.fillText(character, 0, 0);
        context.restore();
        context.textBaseline = 'alphabetic';
      } else {
        context.fillText(character, columnX, characterY);
      }
    });
    if (element.underline || element.strike) {
      const lineTop = startY - fitted.glyphAscent;
      const lineBottom = lineTop + columnHeight;
      context.beginPath();
      context.lineWidth = Math.max(1, fitted.fontPixels / 14);
      if (element.underline) {
        const underlineX = columnX + fitted.glyphWidth * 0.42;
        context.moveTo(underlineX, lineTop);
        context.lineTo(underlineX, lineBottom);
      }
      if (element.strike) {
        context.moveTo(columnX, lineTop);
        context.lineTo(columnX, lineBottom);
      }
      context.stroke();
    }
  });
}

function drawHorizontalOrientedText(context, element, fitted, x, y, width, height) {
  const startY = alignedStart(y, height, fitted.blockHeight, element.verticalAlign);
  fitted.lines.forEach((characters, lineIndex) => {
    const measured = fitted.lineWidths[lineIndex];
    let cursor = element.align === 'center'
      ? x + (width - measured) / 2
      : element.align === 'right' ? x + width - measured : x;
    const lineY = startY + fitted.lineOffsets[lineIndex];
    characters.forEach((character, characterIndex) => {
      const advance = fitted.advances[lineIndex][characterIndex];
      const rotation = fitted.rotations[lineIndex][characterIndex];
      context.save();
      context.translate(cursor + advance / 2, lineY + fitted.lineHeights[lineIndex] / 2);
      if (rotation) context.rotate(rotation);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(character, 0, 0);
      context.restore();
      cursor += advance + fitted.spacing;
    });
    if ((element.underline || element.strike) && characters.length) {
      const lineStart = element.align === 'center'
        ? x + (width - measured) / 2
        : element.align === 'right' ? x + width - measured : x;
      context.beginPath();
      context.lineWidth = Math.max(1, fitted.fontPixels / 14);
      if (element.underline) {
        context.moveTo(lineStart, lineY + fitted.lineHeights[lineIndex] * 0.98);
        context.lineTo(lineStart + measured, lineY + fitted.lineHeights[lineIndex] * 0.98);
      }
      if (element.strike) {
        context.moveTo(lineStart, lineY + fitted.lineHeights[lineIndex] * 0.52);
        context.lineTo(lineStart + measured, lineY + fitted.lineHeights[lineIndex] * 0.52);
      }
      context.stroke();
    }
  });
}

function drawArcText(context, element, fitted, x, y, width, height) {
  if (fitted.arcFlat) {
    drawHorizontalText(context, element, fitted, x, y, width, height);
    return;
  }
  const horizontalAlignment = element.align === 'center' ? 'center' : element.align === 'right' ? 'right' : 'left';
  const blockX = alignedStart(x, width, fitted.blockWidth, horizontalAlignment);
  const blockY = alignedStart(y, height, fitted.blockHeight, element.verticalAlign);
  const centerX = blockX + fitted.blockWidth / 2;
  const centerY = blockY + fitted.fontPixels * 0.72 + fitted.radius;
  let cursor = 0;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  fitted.characters.forEach((character, index) => {
    const advance = fitted.advances[index];
    const midpoint = cursor + advance / 2;
    const angle = -Math.PI / 2 - fitted.theta / 2 + midpoint / fitted.radius;
    context.save();
    context.translate(centerX + fitted.radius * Math.cos(angle), centerY + fitted.radius * Math.sin(angle));
    context.rotate(angle + Math.PI / 2);
    context.fillText(character, 0, 0);
    context.restore();
    cursor += advance + fitted.spacing;
  });
}

function drawText(context, element, dpi) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const rawText = String(element.text || '');
    const isEmpty = rawText.trim().length === 0;
    const displayText = isEmpty ? '双击编辑' : rawText;
    const paintEl = Object.assign({}, element, { text: displayText });
    const ink = isEmpty ? '#9aa3a8' : (element.color || '#000000');
    // Reverse/反白 (video): fill with element color, white glyphs + underline
    if (element.reverse && rawText.trim().length > 0) {
      context.fillStyle = element.color || '#000000';
      context.fillRect(x, y, width, height);
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#ffffff';
    } else {
      context.fillStyle = ink;
      context.strokeStyle = ink;
    }
    const fitted = fitText(context, paintEl, width, height, dpi);
    context.font = fontValue(paintEl, fitted.fontPixels);
    const mode = normalizeTextMode(paintEl);
    if (mode === 'horizontal-90' || mode === 'horizontal-90-words-rotate') {
      drawHorizontalOrientedText(context, paintEl, fitted, x, y, width, height);
    } else if (mode === 'vertical-words-rotate') {
      drawVerticalText(context, paintEl, fitted, x, y, width, height);
    } else if (mode === 'vertical') {
      drawVerticalText(context, paintEl, fitted, x, y, width, height, (character) => verticalGlyphRotation(mode, character));
    } else if (mode === 'arc') {
      drawArcText(context, paintEl, fitted, x, y, width, height);
    } else {
      drawHorizontalText(context, paintEl, fitted, x, y, width, height);
    }
    context.restore();
  });
}

function pad(value, length) {
  return String(value).padStart(Math.max(1, Number(length) || 1), '0');
}

function resolveDateTime(element, now) {
  const clock = now || new Date();
  let base;
  // autoUpdate on → always live clock (print-time update)
  if (element.autoUpdate !== false) {
    base = new Date(clock.getTime());
  } else if (element.baseTime) {
    const parsed = new Date(element.baseTime);
    base = Number.isNaN(parsed.getTime()) ? new Date(clock.getTime()) : parsed;
  } else {
    base = new Date(clock.getTime());
  }
  let ms = base.getTime();
  ms += (Number(element.offsetDays) || 0) * 86400000;
  ms += (Number(element.offsetHours) || 0) * 3600000;
  // 保质期：常用 + 自定义 都用 expirePresetHours
  if (element.dateRole === 'expire') {
    const hours = Number(element.expirePresetHours);
    if (Number.isFinite(hours) && hours > 0) ms += hours * 3600000;
  }
  return new Date(ms);
}

/** Canvas display: 「制作日期：2026年08月05日 22:13」 */
function formatDateValue(element, now) {
  if (element.autoUpdate === false && element.fixedValue) {
    const label = element.label ? `${element.label}：` : '';
    return `${label}${element.fixedValue}`;
  }
  const date = resolveDateTime(element, now);
  const datePart = `${date.getFullYear()}年${pad(date.getMonth() + 1, 2)}月${pad(date.getDate(), 2)}日`;
  let timePart = '';
  if (element.showTime !== false) {
    timePart = ` ${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`;
    if (element.showSeconds !== false) timePart += `:${pad(date.getSeconds(), 2)}`;
  }
  // Honor custom token format if provided and not Chinese default
  const fmt = String(element.format || '');
  if (fmt && /YYYY|MM|DD|HH|mm|ss/.test(fmt) && !fmt.includes('年')) {
    const replacements = {
      YYYY: String(date.getFullYear()),
      MM: pad(date.getMonth() + 1, 2),
      DD: pad(date.getDate(), 2),
      HH: pad(date.getHours(), 2),
      mm: pad(date.getMinutes(), 2),
      ss: pad(date.getSeconds(), 2)
    };
    const body = fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => replacements[token]);
    return element.label ? `${element.label}：${body}` : body;
  }
  const body = `${datePart}${timePart}`;
  return element.label ? `${element.label}：${body}` : body;
}

function formatDateChip(element, now) {
  const date = resolveDateTime(element, now);
  return `${date.getFullYear()}年${pad(date.getMonth() + 1, 2)}月${pad(date.getDate(), 2)}日`;
}

function formatTimeChip(element, now) {
  const date = resolveDateTime(element, now);
  let t = `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`;
  if (element.showSeconds !== false) t += `:${pad(date.getSeconds(), 2)}`;
  return t;
}

function serialValue(element) {
  const raw = element.currentValue == null ? Number(element.start) || 0 : Number(element.currentValue) || 0;
  return `${element.prefix || ''}${pad(raw, element.digits)}${element.suffix || ''}`;
}

function drawGeneratedText(context, element, dpi, text) {
  drawText(context, Object.assign({}, element, { text }), dpi);
}

function drawBarcode(context, element, dpi) {
  let encoded;
  try {
    encoded = element.format === 'ean13' ? encodeEan13(element.value) : encodeCode128B(element.value);
  } catch (error) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const ink = element.color || '#000000';
    const fontMm = Number(element.fontSize) > 0 ? Number(element.fontSize) : 2.4;
    const labelHeight = element.showText === false ? 0 : Math.min(mmToDots(fontMm, dpi) * 1.15, height * 0.35);
    const barsHeight = Math.max(1, height - labelHeight);
    const textAtTop = element.textPosition === 'top';
    const barsY = textAtTop ? y + labelHeight : y;
    const moduleWidth = width / encoded.moduleCount;
    let cursor = x;
    context.fillStyle = ink;
    if (encoded.bits) {
      encoded.bits.split('').forEach((bit) => {
        if (bit === '1') {
          context.fillRect(Math.round(cursor), barsY, Math.max(1, Math.round(cursor + moduleWidth) - Math.round(cursor)), barsHeight);
        }
        cursor += moduleWidth;
      });
    } else {
      cursor += moduleWidth * 10;
      encoded.patterns.forEach((pattern) => {
        let bar = true;
        pattern.split('').forEach((moduleCount) => {
          const partWidth = Number(moduleCount) * moduleWidth;
          const start = Math.round(cursor);
          const end = Math.round(cursor + partWidth);
          if (bar) {
            context.fillRect(start, barsY, Math.max(1, end - start), barsHeight);
          }
          cursor += partWidth;
          bar = !bar;
        });
      });
    }
    if (element.showText !== false && labelHeight > 0) {
      context.fillStyle = ink;
      context.font = `${Math.max(7, labelHeight * 0.78)}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = textAtTop ? 'top' : 'bottom';
      context.fillText(encoded.text || String(element.value), x + width / 2, textAtTop ? y : y + height, width);
    }
  });
}

function drawQrCode(context, element, dpi) {
  let code;
  try {
    code = qrcode(0, element.errorCorrection || 'M');
    code.addData(String(element.value || ''), 'Byte');
    code.make();
  } catch (error) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const modules = code.getModuleCount();
    const quietModules = QR_QUIET_ZONE_MODULES;
    const scale = Math.floor((Math.min(width, height) + DOT_EPSILON) / (modules + quietModules * 2));
    if (scale < 1) {
      return;
    }
    const drawSize = (modules + quietModules * 2) * scale;
    const quietX = x + (width - drawSize) / 2;
    const quietY = y + (height - drawSize) / 2;
    const startX = quietX + quietModules * scale;
    const startY = quietY + quietModules * scale;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#ffffff';
    context.fillRect(quietX, quietY, drawSize, drawSize);
    context.fillStyle = element.color || '#000000';
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (code.isDark(row, column)) {
          context.fillRect(startX + column * scale, startY + row * scale, scale, scale);
        }
      }
    }
    context.restore();
  });
}

function validateDocument(document, dpi) {
  document.elements.forEach((element) => {
    if (element.type === 'barcode') {
      const encoded = element.format === 'ean13' ? encodeEan13(element.value) : encodeCode128B(element.value);
      const availableDots = Math.floor(mmToDots(element.width, dpi));
      if (availableDots < encoded.moduleCount) {
        throw new Error(`条码元素过窄，当前内容至少需要 ${encoded.moduleCount} 个打印点`);
      }
    }
    if (element.type === 'qrcode') {
      const code = qrcode(0, element.errorCorrection || 'M');
      code.addData(String(element.value || ''), 'Byte');
      code.make();
      const requiredDots = code.getModuleCount() + QR_QUIET_ZONE_MODULES * 2;
      const availableDots = Math.floor(Math.min(
        mmToDots(element.width, dpi),
        mmToDots(element.height, dpi)
      ) + DOT_EPSILON);
      if (availableDots < requiredDots) {
        throw new Error(`二维码元素过小，当前内容至少需要 ${requiredDots} x ${requiredDots} 个打印点`);
      }
    }
  });
}

function drawShape(context, element, dpi) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const ink = element.color || '#000000';
    const kind = element.shapeKind || (element.type === 'line' ? 'line' : 'rect');
    const linePx = Math.max(1, mmToDots(element.lineWidth || 0.35, dpi));
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.lineWidth = linePx;
    if (element.borderStyle) {
      context.setLineDash([]);
      const bstyle = (borderById(element.borderStyle) || {}).draw || element.borderStyle; drawBorderStyle(context, bstyle, x, y, width, height, linePx);
      return;
    }
    if (element.dashed) context.setLineDash([mmToDots(1.2, dpi), mmToDots(0.8, dpi)]);
    else context.setLineDash([]);
    if (kind === 'line' || element.type === 'line') {
      context.beginPath();
      context.moveTo(x, y + height / 2);
      context.lineTo(x + width, y + height / 2);
      context.stroke();
    } else if (kind === 'ellipse' || kind === 'circle') {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = width / 2;
      const ry = kind === 'circle' ? Math.min(width, height) / 2 : height / 2;
      context.beginPath();
      context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (element.filled) context.fill();
      else context.stroke();
    } else if (kind === 'rounded') {
      const r = Math.min(width, height) * 0.15;
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + width, y, x + width, y + height, r);
      context.arcTo(x + width, y + height, x, y + height, r);
      context.arcTo(x, y + height, x, y, r);
      context.arcTo(x, y, x + width, y, r);
      context.closePath();
      if (element.filled) context.fill();
      else context.stroke();
    } else if (element.filled) {
      context.fillRect(x, y, width, height);
    } else {
      context.strokeRect(x, y, width, height);
    }
    context.setLineDash([]);
  });
}

function normalizedThreshold(value) {
  const threshold = Number(value);
  return Number.isFinite(threshold) ? Math.max(1, Math.min(254, threshold)) : 180;
}

function binarizeImageData(imageData, thresholdValue) {
  const threshold = normalizedThreshold(thresholdValue);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3] / 255;
    const red = imageData.data[index] * alpha + 255 * (1 - alpha);
    const green = imageData.data[index + 1] * alpha + 255 * (1 - alpha);
    const blue = imageData.data[index + 2] * alpha + 255 * (1 - alpha);
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const color = luminance < threshold ? 0 : 255;
    imageData.data[index] = color;
    imageData.data[index + 1] = color;
    imageData.data[index + 2] = color;
    imageData.data[index + 3] = 255;
  }
  return imageData;
}

function createRasterCanvas(context, width, height) {
  if (typeof wx !== 'undefined' && wx && typeof wx.createOffscreenCanvas === 'function') {
    try {
      return wx.createOffscreenCanvas({ type: '2d', width, height });
    } catch (error) {
      // Fall through for browser/test hosts that expose a standard canvas.
    }
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const ownerDocument = context.canvas && context.canvas.ownerDocument;
  const canvasDocument = ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!canvasDocument || typeof canvasDocument.createElement !== 'function') return null;
  const canvas = canvasDocument.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function thresholdedImage(context, image, width, height, thresholdValue) {
  const pixelWidth = Math.max(1, Math.round(Math.abs(width)));
  const pixelHeight = Math.max(1, Math.round(Math.abs(height)));
  const threshold = normalizedThreshold(thresholdValue);
  const cacheable = image && (typeof image === 'object' || typeof image === 'function');
  const cacheKey = `${pixelWidth}x${pixelHeight}:${threshold}`;
  if (cacheable) {
    const cached = thresholdImageCache.get(image);
    if (cached && cached.has(cacheKey)) return cached.get(cacheKey);
  }

  const canvas = createRasterCanvas(context, pixelWidth, pixelHeight);
  if (!canvas) return image;
  const rasterContext = canvas.getContext('2d', { willReadFrequently: true });
  if (!rasterContext) return image;
  try {
    rasterContext.fillStyle = '#ffffff';
    rasterContext.fillRect(0, 0, pixelWidth, pixelHeight);
    rasterContext.drawImage(image, 0, 0, pixelWidth, pixelHeight);
    const imageData = rasterContext.getImageData(0, 0, pixelWidth, pixelHeight);
    rasterContext.putImageData(binarizeImageData(imageData, threshold), 0, 0);
  } catch (error) {
    return image;
  }

  if (cacheable) {
    let cached = thresholdImageCache.get(image);
    if (!cached) {
      cached = new Map();
      thresholdImageCache.set(image, cached);
    }
    if (cached.size >= 4) cached.delete(cached.keys().next().value);
    cached.set(cacheKey, canvas);
  }
  return canvas;
}

function drawImage(context, element, dpi, images) {
  const image = images && images[element.id];
  if (!image) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const renderedImage = thresholdedImage(context, image, width, height, element.threshold);
    context.drawImage(renderedImage, x, y, width, height);
  });
}

function drawTable(context, element, dpi) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const rows = Math.max(1, Math.min(20, Number(element.rows) || 1));
    const columns = Math.max(1, Math.min(12, Number(element.columns) || 1));
    const rowHeight = height / rows;
    const columnWidth = width / columns;
    const cells = Array.isArray(element.cells) ? element.cells : [];
    const strokeInk = element.strokeColor || element.color || '#000000';
    const textInk = element.textColor || element.color || '#000000';
    context.save();
    context.strokeStyle = strokeInk;
    context.fillStyle = textInk;
    context.lineWidth = Math.max(1, mmToDots(element.lineWidth || 0.4, dpi));
    context.strokeRect(x, y, width, height);
    for (let row = 1; row < rows; row += 1) {
      context.beginPath();
      context.moveTo(x, y + row * rowHeight);
      context.lineTo(x + width, y + row * rowHeight);
      context.stroke();
    }
    for (let column = 1; column < columns; column += 1) {
      context.beginPath();
      context.moveTo(x + column * columnWidth, y);
      context.lineTo(x + column * columnWidth, y + height);
      context.stroke();
    }
    const fontPixels = Math.max(7, Math.min(mmToDots(element.fontSize || 2.8, dpi), rowHeight * 0.62));
    context.font = fontValue(element, fontPixels);
    context.fillStyle = textInk;
    const spacing = letterSpacingDots(element, dpi);
    const align = element.align || 'center';
    const vAlign = element.verticalAlign || 'middle';
    const pad = 4;
    const lineHeight = fontPixels * lineSpacingValue(element);
    const decorationWidth = Math.max(1, fontPixels / 14);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = String(cells[row * columns + column] || '');
        if (!value) continue;
        const cellX = x + column * columnWidth;
        const cellY = y + row * rowHeight;
        context.save();
        context.beginPath();
        context.rect(cellX + 2, cellY + 2, Math.max(0, columnWidth - 4), Math.max(0, rowHeight - 4));
        context.clip();
        const maxWidth = Math.max(0, columnWidth - pad * 2);
        const lines = element.wordWrap
          ? wrapText(context, value, maxWidth, spacing)
          : value.split('\n');
        const lineWidths = lines.map((line) => measureSpacedText(context, line, spacing));
        const blockHeight = lines.length
          ? fontPixels + Math.max(0, lines.length - 1) * lineHeight
          : 0;
        const startY = alignedStart(cellY + pad, Math.max(0, rowHeight - pad * 2), blockHeight, vAlign);
        context.textBaseline = 'top';
        context.textAlign = 'left';
        context.strokeStyle = textInk;
        lines.forEach((line, lineIndex) => {
          const measured = lineWidths[lineIndex] || 0;
          const lineY = startY + lineIndex * lineHeight;
          let textX;
          if (align === 'right') textX = cellX + columnWidth - pad - measured;
          else if (align === 'left') textX = cellX + pad;
          else textX = cellX + pad + Math.max(0, (maxWidth - measured) / 2);
          if (spacing !== 0 && line.length > 0) {
            let cursor = textX;
            Array.from(line).forEach((character) => {
              context.fillText(character, cursor, lineY);
              cursor += context.measureText(character).width + spacing;
            });
          } else if (line) {
            context.fillText(line, textX, lineY);
          }
          if ((element.underline || element.strike) && line) {
            context.beginPath();
            context.lineWidth = decorationWidth;
            if (element.underline) {
              context.moveTo(textX, lineY + fontPixels * 0.98);
              context.lineTo(textX + measured, lineY + fontPixels * 0.98);
            }
            if (element.strike) {
              context.moveTo(textX, lineY + fontPixels * 0.52);
              context.lineTo(textX + measured, lineY + fontPixels * 0.52);
            }
            context.stroke();
          }
        });
        context.restore();
      }
    }
    context.restore();
  });
}

function drawMaterial(context, element, dpi, images) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const pad = Math.min(width, height) * 0.08;
    const image = images && images[element.id];
    if (image) {
      const availableWidth = Math.max(1, width - pad * 2);
      const availableHeight = Math.max(1, height - pad * 2);
      const sourceWidth = image.naturalWidth || image.width || availableWidth;
      const sourceHeight = image.naturalHeight || image.height || availableHeight;
      const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
      const drawWidth = Math.max(1, sourceWidth * scale);
      const drawHeight = Math.max(1, sourceHeight * scale);
      const renderedImage = thresholdedImage(context, image, drawWidth, drawHeight, element.threshold);
      context.drawImage(
        renderedImage,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
      return;
    }
    const lineWidthPx = Math.max(1, mmToDots(element.lineWidth || 0.55, dpi));
    drawMaterialSymbol(
      context,
      element.symbol || 'check',
      x + pad,
      y + pad,
      Math.max(1, width - pad * 2),
      Math.max(1, height - pad * 2),
      lineWidthPx
    );
  });
}

function renderDocument(context, document, canvasSize, dpi, images, options) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  // Editor-only workbench backdrop; defaults OFF so preview/thumbnail/print
  // raster paths keep painting the label on pure white. Callers opt in with
  // { editorCanvas: true } only for the live editor canvas.
  if (options && options.editorCanvas) {
    context.fillStyle = CHROME.backdrop;
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);
  }
  context.fillStyle = CHROME.paper;
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
  document.elements.forEach((element) => {
    if (element.type === 'text') {
      drawText(context, element, dpi);
    } else if (element.type === 'date') {
      drawGeneratedText(context, element, dpi, formatDateValue(element));
    } else if (element.type === 'serial') {
      drawGeneratedText(context, element, dpi, serialValue(element));
    } else if (element.type === 'barcode') {
      drawBarcode(context, element, dpi);
    } else if (element.type === 'qrcode') {
      drawQrCode(context, element, dpi);
    } else if (element.type === 'rect' || element.type === 'line') {
      drawShape(context, element, dpi);
    } else if (element.type === 'image') {
      drawImage(context, element, dpi, images);
    } else if (element.type === 'table') {
      drawTable(context, element, dpi);
    } else if (element.type === 'material') {
      drawMaterial(context, element, dpi, images);
    }
  });
}

function drawSnapGuides(context, guides, canvasSize, dpi) {
  if (!guides || !guides.length) return;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  // Snap rulers: blue dashed crosshair + mm ticks
  context.strokeStyle = CHROME.guide;
  context.lineWidth = CHROME.guideWidth;
  context.setLineDash(CHROME.guideDash);
  context.font = CHROME.guideLabelFont;
  context.fillStyle = CHROME.guideLabel;
  context.textBaseline = 'middle';
  const stepMm = canvasSize.width > 400 ? 10 : 5;
  guides.forEach((guide) => {
    if (!guide || !Number.isFinite(guide.pos)) return;
    if (guide.axis === 'v') {
      const x = mmToDots(guide.pos, dpi) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasSize.height);
      context.stroke();
      context.setLineDash([]);
      for (let mm = 0; mm <= Math.ceil(canvasSize.height * 25.4 / dpi); mm += stepMm) {
        const y = mmToDots(mm, dpi);
        context.beginPath();
        context.moveTo(x - 4, y);
        context.lineTo(x + 4, y);
        context.stroke();
        if (mm > 0 && mm % (stepMm * 2) === 0) {
          context.fillText(String(mm), x + 6, y);
        }
      }
      context.setLineDash(CHROME.guideDash);
    } else if (guide.axis === 'h') {
      const y = mmToDots(guide.pos, dpi) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvasSize.width, y);
      context.stroke();
      context.setLineDash([]);
      for (let mm = 0; mm <= Math.ceil(canvasSize.width * 25.4 / dpi); mm += stepMm) {
        const x = mmToDots(mm, dpi);
        context.beginPath();
        context.moveTo(x, y - 4);
        context.lineTo(x, y + 4);
        context.stroke();
        if (mm > 0 && mm % (stepMm * 2) === 0) {
          context.fillText(String(mm), x + 2, y - 8);
        }
      }
      context.setLineDash(CHROME.guideDash);
    }
  });
  context.restore();
}

function renderSelection(context, selected, canvasSize, dpi, guides) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  // paper margin only when guides active (drag) — keep select shot clean
  if (guides && guides.length) {
    context.save();
    context.setLineDash(CHROME.paperMarginDash);
    context.strokeStyle = CHROME.paperMargin;
    context.lineWidth = CHROME.guideWidth;
    context.strokeRect(0.5, 0.5, canvasSize.width - 1, canvasSize.height - 1);
    context.restore();
  }
  drawSnapGuides(context, guides, canvasSize, dpi);
  const selections = Array.isArray(selected) ? selected.filter(Boolean) : (selected ? [selected] : []);
  if (!selections.length) {
    return;
  }
  // Multi-select outer bound (NIIMBOT dashed group box)
  if (selections.length > 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    selections.forEach((element) => {
      minX = Math.min(minX, mmToDots(element.x, dpi));
      minY = Math.min(minY, mmToDots(element.y, dpi));
      maxX = Math.max(maxX, mmToDots(element.x + element.width, dpi));
      maxY = Math.max(maxY, mmToDots(element.y + element.height, dpi));
    });
    context.save();
    context.strokeStyle = CHROME.multiSelect;
    context.lineWidth = CHROME.multiSelectWidth;
    context.setLineDash(CHROME.multiSelectDash);
    context.strokeRect(minX - 1, minY - 1, maxX - minX + 2, maxY - minY + 2);
    context.restore();
  }

  selections.forEach((element) => withElementTransform(context, Object.assign({}, element, { mirrorX: false, mirrorY: false }), dpi, (x, y, width, height) => {
    const isDate = element.type === 'date';
    const isTextLike = element.type === 'text' || element.type === 'date' || element.type === 'serial';
    const color = element.locked ? CHROME.locked : CHROME.selection;
    // Text-like selections hug the painted content until the first manual
    // handle drag promotes that fitted rectangle to the real element box.
    let sx = x;
    let sy = y;
    let sw = width;
    let sh = height;
    if (isTextLike && element.selectionFit !== false) {
      try {
        let sample = element.text || '';
        if (element.type === 'date') sample = formatDateValue(element);
        else if (element.type === 'serial') sample = serialValue(element);
        if (element.type === 'text' && !String(sample).trim()) sample = '双击编辑';
        const fitted = fitText(context, Object.assign({}, element, { text: sample }), width, height, dpi);
        if (fitted && fitted.blockWidth > 0 && fitted.blockHeight > 0) {
          const hAlign = element.align === 'center' || element.align === 'middle' ? 'center'
            : (element.align === 'right' || element.align === 'bottom' ? 'right' : 'left');
          sx = alignedStart(x, width, fitted.blockWidth, hAlign) - 1;
          sy = alignedStart(y, height, fitted.blockHeight, element.verticalAlign || 'middle') - 1;
          sw = fitted.blockWidth + 2;
          sh = fitted.blockHeight + 2;
          // ratios of content box inside element (for handle hit-test in mm)
          Object.defineProperty(element, '_fit', { configurable: true, enumerable: false, writable: true, value: {
            left: (sx - x) / Math.max(1, width),
            top: (sy - y) / Math.max(1, height),
            w: sw / Math.max(1, width),
            h: sh / Math.max(1, height)
          } });
        }
      } catch (_) { /* keep element box */ }
    } else {
      delete element._fit;
    }
    // Date: dashed + hatch; other types: solid blue
    context.strokeStyle = color;
    context.lineWidth = CHROME.selectionWidth;
    context.fillStyle = CHROME.selectionFill;
    context.fillRect(sx, sy, sw, sh);
    if (isDate) {
      context.setLineDash(CHROME.dateDash);
      context.strokeRect(sx, sy, sw, sh);
      context.setLineDash([]);
      // light diagonal hatch
      context.save();
      context.beginPath();
      context.rect(sx, sy, sw, sh);
      context.clip();
      context.strokeStyle = CHROME.selectionFill;
      context.lineWidth = 1;
      const step = 6;
      for (let i = -sh; i < sw + sh; i += step) {
        context.beginPath();
        context.moveTo(sx + i, sy);
        context.lineTo(sx + i + sh, sy + sh);
        context.stroke();
      }
      context.restore();
    } else {
      context.setLineDash([]);
      context.strokeRect(sx, sy, sw, sh);
    }
    if (element.locked) return;
    // Handles on content-fitted box (贴蓝框): white dots with blue ring
    const r = CHROME.handleRadius;
    const mids = [
      [sx + sw, sy + sh / 2],
      [sx + sw / 2, sy + sh]
    ];
    mids.forEach((point) => {
      context.beginPath();
      context.arc(point[0], point[1], r, 0, Math.PI * 2);
      context.fillStyle = CHROME.handleFill;
      context.fill();
      context.lineWidth = CHROME.handleRingWidth;
      context.strokeStyle = CHROME.handleRing;
      context.stroke();
    });
    // Rotate at SE of content box
    const rx = sx + sw;
    const ry = sy + sh;
    context.beginPath();
    context.arc(rx, ry, r + 1, 0, Math.PI * 2);
    context.fillStyle = CHROME.handleFill;
    context.fill();
    context.strokeStyle = CHROME.handleRing;
    context.lineWidth = CHROME.handleRingWidth;
    context.stroke();
    context.beginPath();
    context.arc(rx, ry, r * 0.55, -0.2, Math.PI * 1.2);
    context.strokeStyle = CHROME.handleArrow;
    context.lineWidth = CHROME.handleArrowWidth;
    context.stroke();
  }));
}

function contentHandleLocalMm(element) {
  const hw = (Number(element.width) || 1) / 2;
  const hh = (Number(element.height) || 1) / 2;
  const fit = element._fit;
  if (!fit || !Number.isFinite(fit.w)) {
    return { e: { x: hw, y: 0 }, s: { x: 0, y: hh }, se: { x: hw, y: hh } };
  }
  // local origin = element center; content rect from left-top of element
  const left = -hw + fit.left * element.width;
  const top = -hh + fit.top * element.height;
  const cw = fit.w * element.width;
  const ch = fit.h * element.height;
  return {
    e: { x: left + cw, y: top + ch / 2 },
    s: { x: left + cw / 2, y: top + ch },
    se: { x: left + cw, y: top + ch }
  };
}

module.exports = {
  binarizeImageData,
  fitText,
  formatDateChip,
  formatDateValue,
  formatTimeChip,
  mmToDots,
  renderDocument,
  contentHandleLocalMm,
  renderSelection,
  resolveDateTime,
  serialValue,
  validateDocument,
  wrapText
};
