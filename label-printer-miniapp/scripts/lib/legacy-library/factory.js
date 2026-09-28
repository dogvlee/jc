/**
 * Clean-room Shangyue industry library.
 * Builds original vector labels from a scene + paper size. Never reads NIIM
 * elements, images, fonts or brand copy.
 */
const { createDocument, createElement } = require('../../../miniprogram/core/document');
const {
  ITEM_POOLS,
  OWNED_PAPERS,
  OWNED_VARIANT_MARKS,
  SCENES,
  classifyScene,
  kindFor,
  pickItem
} = require('./classify');
const {
  designFamily,
  identityLabel,
  sceneCode,
  sceneFont,
  sceneGroup
} = require('./brand-system');

const QR_SCENES = new Set(['wifi', 'warehouse', 'asset', 'card', 'ship', 'lab']);
const BARCODE_SCENES = new Set(['price', 'bakery', 'cup', 'garment', 'jewelry', 'cable', 'material']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fontSize(heightMm, ratio, max) {
  return clamp(heightMm * ratio, 2.2, max == null ? 5.2 : max);
}

function text(doc, opts) {
  const value = String((opts && opts.text) || '').trim();
  if (!value) return null;
  const el = createElement('text', doc);
  Object.assign(el, {
    text: value,
    fontSize: 3,
    bold: false,
    align: 'left',
    verticalAlign: 'middle',
    autoFit: true,
    fontFamily: 'sans-serif'
  }, opts, { text: value, autoFit: true });
  return el;
}

function barcode(doc, opts) {
  const el = createElement('barcode', doc);
  Object.assign(el, {
    value: 'SY00',
    format: 'code128',
    showText: false,
    textPosition: 'bottom'
  }, opts);
  return el;
}

function qrcode(doc, opts) {
  const el = createElement('qrcode', doc);
  Object.assign(el, {
    value: 'SY://label',
    errorCorrection: 'M'
  }, opts);
  return el;
}

function rect(doc, opts) {
  const el = createElement('rect', doc);
  Object.assign(el, { lineWidth: 0.35, filled: false }, opts);
  return el;
}

function line(doc, opts) {
  const el = createElement('line', doc);
  Object.assign(el, { lineWidth: 0.3 }, opts);
  return el;
}

function dateEl(doc, opts) {
  const el = createElement('date', doc);
  Object.assign(el, {
    format: 'YYYY-MM-DD',
    autoUpdate: true,
    fontSize: 2.4,
    autoFit: true,
    fontFamily: 'sans-serif'
  }, opts);
  return el;
}

function serial(doc, opts) {
  const el = createElement('serial', doc);
  Object.assign(el, {
    prefix: 'NO.',
    start: 1,
    digits: 4,
    fontSize: 2.4,
    autoFit: true,
    fontFamily: 'sans-serif'
  }, opts);
  return el;
}

function shortCode(index) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return alphabet[index % alphabet.length] + String(1000 + (index % 9000)).slice(-3);
}

function ean13FromIndex(index) {
  const body = String(690000000000 + (index % 999999999)).padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}

function stableSeed(entry) {
  const source = [
    entry && entry.scene,
    entry && entry.widthMm,
    entry && entry.heightMm,
    entry && entry.item
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableLayoutSeed(entry) {
  return stableSeed(entry) ^ Math.imul((Number(entry && entry.variant) || 0) + 1, 2654435761);
}

function provenance(entry) {
  const family = designFamily(entry.variant);
  return {
    origin: 'shangyue-library',
    authorship: 'shangyue-owned-library',
    library: 'shangyue-library',
    scene: entry.scene,
    variant: entry.variant,
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: false,
    approvalStatus: 'approved-library',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    designVersion: '2.1.0',
    designSystem: 'sy-semantic-grid-v2',
    designFamily: family.id,
    designFamilyLabel: family.label,
    aiAssisted: true,
    authorshipBasis: 'deterministic-clean-room-generator',
    sourceTemplateId: null,
    optimization: 'semantic-layout-v2',
    contentSeed: stableSeed(entry),
    layoutSeed: stableLayoutSeed(entry),
    createdAt: '2026-08-17',
    optimizedAt: '2026-09-28'
  };
}

/**
 * Safe content box. Labels drift 0.5–1 mm under the print head, so templates
 * carry no outer frame, edge rail or corner marks (they print as black edges)
 * and keep every element at least 1.5 mm inside the paper.
 */
function contentBox(widthMm, heightMm, entry) {
  const margin = clamp(Math.min(widthMm, heightMm) * 0.06, 1.5, 2.5);
  return {
    x: margin,
    y: margin,
    w: widthMm - margin * 2,
    h: heightMm - margin * 2,
    family: designFamily(entry.variant)
  };
}

function add(doc, element) {
  if (element) doc.elements.push(element);
}

function buildDocument(entry) {
  const widthMm = Number(entry.widthMm);
  const heightMm = Number(entry.heightMm);
  const doc = createDocument(widthMm, heightMm);
  doc.elements = [];
  const variant = Number(entry.variant) || 0;
  const item = entry.item || pickItem(entry.scene, Number(entry.serial) || 0);
  const index = stableSeed(Object.assign({}, entry, { item }));
  const inner = contentBox(widthMm, heightMm, entry);

  if (heightMm <= 16 || widthMm <= 22) {
    fillNarrow(doc, inner, entry, item, index, variant);
  } else if (variant % 3 === 1) {
    fillBar(doc, inner, entry, item, index);
  } else if (variant % 3 === 2) {
    if (widthMm >= 48 && heightMm >= 24) {
      fillSplit(doc, inner, entry, item, index);
    } else {
      fillFooter(doc, inner, entry, item, index);
    }
  } else {
    fillBand(doc, inner, entry, item, index);
  }

  doc.elements = doc.elements.filter(Boolean);
  doc.name = entry.name;
  doc.templateMeta = provenance(entry);
  return doc;
}

function fillNarrow(doc, box, entry, item, index, variant) {
  const mode = Number(variant) % 3;
  const family = designFamily(mode);
  const fontFamily = sceneFont(entry.scene);
  const hasQr = QR_SCENES.has(entry.scene) && box.h >= 10.8 && box.w >= 28;
  const hasBarcode = BARCODE_SCENES.has(entry.scene) && box.w >= 38 && box.h >= 6.2;
  const codeW = hasQr
    ? clamp(Math.min(box.h - 0.3, box.w * 0.31), 10.8, 12.5)
    : hasBarcode ? clamp(box.w * 0.52, 24.8, 28) : 0;
  const gap = codeW ? 0.8 : 0;
  const contentW = box.w - codeW - gap;
  const codeX = mode === 2 ? box.x : box.x + contentW + gap;
  const textX = mode === 2 && codeW ? box.x + codeW + gap : box.x;
  const label = identityLabel(entry);
  const topH = clamp(box.h * 0.35, 2.8, 3.6);
  const lowerY = box.y + topH + 0.35;
  const lowerH = box.h - topH - 0.35;
  const align = mode === 1 ? 'center' : mode === 2 ? 'right' : 'left';

  function addDivider() {
    add(doc, line(doc, {
      x: textX,
      y: box.y + topH,
      width: contentW,
      height: 0.3,
      lineWidth: mode === 1 ? 0.55 : 0.3,
      locked: true
    }));
  }

  function addScanCode() {
    if (hasQr) {
      add(doc, qrcode(doc, {
        x: codeX,
        y: box.y + (box.h - codeW) / 2,
        width: codeW,
        height: codeW,
        value: qrPayload(entry.scene, index, item)
      }));
    } else if (hasBarcode) {
      add(doc, barcode(doc, {
        x: codeX,
        y: box.y + 0.2,
        width: codeW,
        height: box.h - 0.4,
        value: shortCode(index),
        fontSize: 2.2
      }));
    }
  }

  if (entry.scene === 'price' || entry.scene === 'bakery' || entry.scene === 'cup') {
    add(doc, text(doc, {
      x: textX, y: box.y, width: contentW, height: topH,
      text: item, fontSize: 2.4, bold: true, align, fontFamily
    }));
    addDivider();
    add(doc, text(doc, {
      x: textX, y: lowerY, width: contentW, height: lowerH,
      text: priceFor(index), fontSize: clamp(lowerH * 0.58, 2.8, 4.1), bold: true, align
    }));
    addScanCode();
    return;
  }

  if (entry.scene === 'date' || entry.scene === 'medicine') {
    add(doc, text(doc, {
      x: textX, y: box.y, width: contentW, height: topH,
      text: item, fontSize: 2.4, bold: true, align, fontFamily
    }));
    addDivider();
    add(doc, dateEl(doc, {
      x: textX,
      y: lowerY,
      width: contentW,
      height: lowerH,
      label: entry.scene === 'medicine' ? '有效至' : '制作',
      dateRole: entry.scene === 'medicine' ? 'expire' : 'made',
      expireMode: 'preset',
      expirePresetHours: entry.scene === 'medicine' ? 24 * 180 : 48,
      showTime: false,
      format: 'YYYY-MM-DD',
      fontSize: 2.2,
      bold: true,
      align,
      fontFamily: 'monospace'
    }));
    return;
  }

  if (entry.scene === 'queue' && mode === 1) {
    // Number first: a large ticket number beside a stacked title and note.
    const numberW = contentW * 0.46;
    const sideX = textX + numberW + 0.6;
    const sideW = contentW - numberW - 0.6;
    add(doc, serial(doc, {
      x: textX,
      y: box.y,
      width: numberW,
      height: box.h,
      prefix: 'SY-',
      start: 10 + (index % 80),
      digits: 3,
      fontSize: clamp(box.h * 0.36, 2.6, 3.8),
      bold: true,
      align: 'left',
      fontFamily: 'monospace'
    }));
    add(doc, text(doc, {
      x: sideX, y: box.y, width: sideW, height: topH,
      text: item, fontSize: 2.4, bold: true, align: 'right', fontFamily
    }));
    add(doc, text(doc, {
      x: sideX, y: lowerY, width: sideW, height: lowerH,
      text: '请持号等候', fontSize: 2.2, align: 'right'
    }));
    return;
  }

  if (entry.scene === 'queue' && mode === 2) {
    // Centered title across the top, number and note side by side below.
    add(doc, text(doc, {
      x: textX, y: box.y, width: contentW, height: topH,
      text: item, fontSize: 2.6, bold: true, align: 'center', fontFamily
    }));
    addDivider();
    add(doc, serial(doc, {
      x: textX,
      y: lowerY,
      width: contentW * 0.5,
      height: lowerH,
      prefix: 'SY-',
      start: 10 + (index % 80),
      digits: 3,
      fontSize: 2.6,
      bold: true,
      align: 'left',
      fontFamily: 'monospace'
    }));
    add(doc, text(doc, {
      x: textX + contentW * 0.52, y: lowerY, width: contentW * 0.48, height: lowerH,
      text: '请持号等候', fontSize: 2.2, align: 'right'
    }));
    return;
  }

  if (entry.scene === 'queue') {
    add(doc, text(doc, {
      x: textX, y: box.y, width: contentW * 0.55, height: topH,
      text: item, fontSize: 2.7, bold: true, fontFamily
    }));
    add(doc, text(doc, {
      x: textX + contentW * 0.56, y: box.y, width: contentW * 0.44, height: topH,
      text: '请持号等候', fontSize: 2.2, bold: true, align: 'right'
    }));
    addDivider();
    add(doc, serial(doc, {
      x: textX,
      y: lowerY,
      width: contentW * 0.48,
      height: lowerH,
      prefix: 'SY-',
      start: 10 + (index % 80),
      digits: 3,
      fontSize: 2.3,
      bold: true,
      align: 'left',
      fontFamily: 'monospace'
    }));
    add(doc, text(doc, {
      x: textX + contentW * 0.50,
      y: lowerY,
      width: contentW * 0.50,
      height: lowerH,
      text: identityLabel(entry),
      fontSize: 2.2,
      align: 'right',
      fontFamily: 'monospace'
    }));
    return;
  }

  if (entry.scene === 'wifi') {
    add(doc, text(doc, {
      x: textX, y: box.y, width: contentW, height: topH,
      text: item, fontSize: 2.4, bold: true, align, fontFamily
    }));
    addDivider();
    add(doc, text(doc, {
      x: textX, y: lowerY, width: contentW, height: lowerH,
      text: hasQr ? 'SY-Guest · 扫码连接' : 'SSID  SY-Guest',
      fontSize: 2.2, align, fontFamily: 'monospace'
    }));
    addScanCode();
    return;
  }

  if (box.h < 8.2) {
    const chipW = clamp(contentW * 0.24, 6.2, 9.0);
    add(doc, text(doc, {
      x: textX,
      y: box.y + 0.1,
      width: chipW,
      height: box.h - 0.2,
      text: sceneCode(entry.scene),
      fontSize: 2.2,
      bold: true,
      reverse: mode !== 2,
      align: 'center',
      fontFamily: 'monospace'
    }));
    add(doc, text(doc, {
      x: textX + chipW + 0.6,
      y: box.y + 0.1,
      width: contentW - chipW - 0.6,
      height: box.h - 0.2,
      text: item,
      fontSize: 2.4,
      bold: true,
      align: family.id === 'ledger' ? 'right' : 'left',
      fontFamily
    }));
  } else {
    add(doc, text(doc, {
      x: textX,
      y: box.y,
      width: contentW,
      height: topH,
      text: `${label}  ${entry.title || '商跃'}`,
      fontSize: 2.2,
      bold: true,
      align: mode === 2 ? 'right' : 'left',
      fontFamily: 'monospace'
    }));
    addDivider();
    add(doc, text(doc, {
      x: textX,
      y: box.y + topH + 0.35,
      width: contentW,
      height: box.h - topH - 0.35,
      text: item,
      fontSize: clamp(box.h * 0.26, 2.4, 3.2),
      bold: true,
      align: mode === 1 ? 'center' : mode === 2 ? 'right' : 'left',
      fontFamily
    }));
  }
  addScanCode();
}

function fillBand(doc, box, entry, item, index) {
  const bandH = clamp(box.h * 0.14, 3.1, 4.2);
  const chipW = clamp(box.w * 0.21, 7.2, 10.5);
  add(doc, text(doc, {
    x: box.x,
    y: box.y,
    width: chipW,
    height: bandH,
    text: sceneCode(entry.scene),
    fontSize: 2.3,
    bold: true,
    reverse: true,
    align: 'center',
    fontFamily: 'monospace'
  }));
  add(doc, text(doc, {
    x: box.x + chipW + 0.7,
    y: box.y,
    width: box.w - chipW - 0.7,
    height: bandH,
    text: `${entry.title || '商跃'}  ${identityLabel(entry)}`,
    fontSize: 2.2,
    bold: true,
    align: 'right',
    fontFamily: 'monospace'
  }));
  add(doc, line(doc, {
    x: box.x,
    y: box.y + bandH + 0.25,
    width: box.w,
    height: 0.3,
    lineWidth: 0.4,
    locked: true
  }));

  const bodyY = box.y + bandH + 0.8;
  const bodyH = box.h - bandH - 0.8;
  fillBody(doc, { x: box.x, y: bodyY, w: box.w, h: bodyH }, entry, item, index, false);
}

function fillBar(doc, box, entry, item, index) {
  const markerW = clamp(box.w * 0.12, 4.6, 6.4);
  const markerH = clamp(box.h * 0.17, 3.2, 4.4);
  add(doc, text(doc, {
    x: box.x,
    y: box.y,
    width: markerW,
    height: markerH,
    text: designFamily(entry.variant).mark,
    fontSize: 2.8,
    bold: true,
    reverse: true,
    align: 'center',
    fontFamily: 'monospace'
  }));
  add(doc, text(doc, {
    x: box.x + markerW + 0.7,
    y: box.y,
    width: box.w - markerW - 0.7,
    height: markerH,
    text: `${entry.title || '商跃'} / ${sceneCode(entry.scene)}`,
    fontSize: 2.5,
    bold: true,
    fontFamily: sceneFont(entry.scene)
  }));
  add(doc, line(doc, {
    x: box.x + markerW + 0.7,
    y: box.y + markerH,
    width: box.w - markerW - 0.7,
    height: 0.3,
    lineWidth: 0.55,
    locked: true
  }));
  fillBody(doc, {
    x: box.x,
    y: box.y + markerH + 0.65,
    w: box.w,
    h: box.h - markerH - 0.65
  }, entry, item, index, true);
}

function fillSplit(doc, box, entry, item, index) {
  const bandH = 3.5;
  const codeCapable = QR_SCENES.has(entry.scene);
  add(doc, text(doc, {
    x: box.x,
    y: box.y,
    width: box.w * 0.55,
    height: bandH,
    text: identityLabel(entry),
    fontSize: 2.2,
    bold: true,
    fontFamily: 'monospace'
  }));
  add(doc, text(doc, {
    x: box.x + box.w * 0.55,
    y: box.y,
    width: box.w * 0.45,
    height: bandH,
    text: entry.category || '',
    fontSize: 2.2,
    bold: true,
    align: 'right'
  }));
  add(doc, line(doc, {
    x: box.x,
    y: box.y + bandH,
    width: box.w,
    height: 0.3,
    lineWidth: 0.35,
    locked: true
  }));
  const bodyY = box.y + bandH + 0.6;
  const bodyH = box.h - bandH - 0.6;
  if (codeCapable && box.w >= 38) {
    const leftW = box.w * 0.59;
    fillBody(doc, { x: box.x, y: bodyY, w: leftW, h: bodyH }, entry, item, index, false, true);
    add(doc, rect(doc, {
      x: box.x + leftW + 0.8,
      y: bodyY,
      width: box.w - leftW - 0.8,
      height: bodyH,
      lineWidth: 0.25,
      filled: false,
      locked: true
    }));
    maybeCode(doc, {
      x: box.x + leftW + 1.3,
      y: bodyY + 0.5,
      w: box.w - leftW - 1.8,
      h: bodyH - 1.0
    }, entry, index, true);
  } else {
    fillBody(doc, { x: box.x, y: bodyY, w: box.w, h: bodyH }, entry, item, index, false);
  }
}

function fillFooter(doc, box, entry, item, index) {
  const footerH = clamp(box.h * 0.18, 3.2, 4.6);
  const bodyH = box.h - footerH - 0.7;
  fillBody(doc, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: bodyH
  }, entry, item, index, true);
  const footerY = box.y + box.h - footerH;
  add(doc, rect(doc, {
    x: box.x,
    y: footerY,
    width: box.w,
    height: footerH,
    filled: false,
    lineWidth: 0.35,
    locked: true
  }));
  add(doc, text(doc, {
    x: box.x + 0.6,
    y: footerY + 0.2,
    width: box.w * 0.62,
    height: footerH - 0.3,
    text: identityLabel(entry),
    fontSize: 2.2,
    bold: true,
    fontFamily: 'monospace'
  }));
  add(doc, text(doc, {
    x: box.x + box.w * 0.63,
    y: footerY + 0.2,
    width: box.w * 0.34,
    height: footerH - 0.3,
    text: `${sceneCode(entry.scene)} · ${entry.category || ''}`,
    fontSize: 2.2,
    bold: true,
    align: 'right',
    fontFamily: 'monospace'
  }));
}

function priceFor(index) {
  return ['¥16.80', '¥5.80', '¥29.90', '¥12.80', '¥6.90', '¥39.00'][index % 6];
}

function qrPayload(scene, index, item) {
  if (scene === 'wifi') return 'WIFI:T:WPA;S:SY-Guest;P:welcome26;;';
  if (scene === 'card') return `MECARD:N:${String(item || '商跃用户')};ORG:SY;;`;
  return `SY:${String(scene || 'info').toUpperCase()}:${shortCode(index)}`;
}

function fillBody(doc, box, entry, item, index, allowSideCode, suppressCode) {
  const scene = entry.scene;
  if (scene === 'price' || scene === 'bakery' || scene === 'cup') {
    return fillPriceBody(doc, box, entry, item, index);
  }
  if (scene === 'date' || scene === 'medicine') {
    return fillDateBody(doc, box, entry, item, index, scene === 'medicine');
  }
  if (scene === 'name') {
    return fillNameBody(doc, box, entry, item, index);
  }
  if (scene === 'wifi') {
    return fillWifiBody(doc, box, entry, item, index, suppressCode);
  }
  if (scene === 'wish') {
    return fillWishBody(doc, box, entry, item, index);
  }
  if (scene === 'warehouse' || scene === 'asset' || scene === 'lab') {
    return fillBinBody(doc, box, entry, item, index, scene, suppressCode);
  }
  return fillStructuredBody(doc, box, entry, item, index, allowSideCode, suppressCode);
}

function fillStructuredBody(doc, box, entry, item, index, allowSideCode, suppressCode) {
  const scene = entry.scene;
  const group = sceneGroup(scene);
  const fontFamily = sceneFont(scene);
  const extras = extraLines(scene, index, box.h >= 28 ? 4 : box.h >= 18 ? 3 : 2);
  const codeScene = !suppressCode && (QR_SCENES.has(scene) || BARCODE_SCENES.has(scene));
  const reserveCode = QR_SCENES.has(scene) && allowSideCode && box.w >= 34 && box.h >= 13;
  const sideW = reserveCode ? clamp(box.w * 0.36, 11.2, 16) : 0;
  const contentW = box.w - sideW - (sideW ? 0.9 : 0);
  const bottomCodeH = codeScene && !reserveCode && box.w >= 24.8 && box.h >= 13
    ? clamp(box.h * 0.30, 6.2, 8.2)
    : 0;
  const contentH = box.h - (bottomCodeH ? bottomCodeH + 0.5 : 0);

  if (scene === 'cert') {
    fillCertBody(doc, { x: box.x, y: box.y, w: contentW, h: contentH }, entry, item, index);
    return;
  }

  if (scene === 'queue' || scene === 'seat') {
    const heroH = clamp(contentH * 0.48, 5.4, 10.5);
    add(doc, text(doc, {
      x: box.x,
      y: box.y,
      width: contentW,
      height: heroH,
      text: item,
      fontSize: clamp(heroH * 0.54, 3.3, 6.2),
      bold: true,
      align: scene === 'seat' ? 'center' : 'left',
      fontFamily
    }));
    if (scene === 'queue' && heroH + 3.4 <= contentH) {
      add(doc, serial(doc, {
        x: box.x,
        y: box.y + heroH,
        width: Math.min(contentW, 22),
        height: 3.2,
        prefix: 'SY-',
        start: 10 + (index % 80),
        digits: 3,
        bold: true,
        fontFamily: 'monospace'
      }));
      const noteY = box.y + heroH + 3.35;
      if (noteY + 2.8 <= box.y + contentH) {
        add(doc, text(doc, {
          x: box.x,
          y: noteY,
          width: contentW,
          height: 2.8,
          text: extras[0] || '请持号等候',
          fontSize: 2.2,
          align: 'right'
        }));
      }
    } else {
      extras.slice(0, 2).forEach((value, row) => {
        const top = box.y + heroH + row * 3.1;
        if (top + 2.8 <= box.y + contentH) {
          add(doc, text(doc, {
            x: box.x,
            y: top,
            width: contentW,
            height: 2.8,
            text: value,
            fontSize: 2.2,
            align: scene === 'seat' ? 'center' : 'left'
          }));
        }
      });
    }
  } else if (scene === 'note' || scene === 'office' || scene === 'info' || scene === 'seal') {
    const titleH = clamp(contentH * 0.23, 3.5, 5.2);
    add(doc, text(doc, {
      x: box.x,
      y: box.y,
      width: contentW,
      height: titleH,
      text: item,
      fontSize: clamp(titleH * 0.62, 2.8, 4.1),
      bold: true,
      fontFamily
    }));
    const available = contentH - titleH - 0.5;
    const rows = Math.min(extras.length, available >= 18 ? 4 : available >= 9 ? 3 : available >= 5.5 ? 2 : 1);
    const rowH = rows ? clamp(available / rows, 3.2, 6.2) : available;
    extras.slice(0, rows).forEach((value, row) => {
      const top = box.y + titleH + 0.5 + row * rowH;
      const check = clamp(rowH * 0.45, 1.5, 2.3);
      add(doc, rect(doc, {
        x: box.x,
        y: top + Math.max(0.2, (rowH - check) / 2),
        width: check,
        height: check,
        lineWidth: 0.3,
        filled: false,
        locked: true
      }));
      add(doc, text(doc, {
        x: box.x + check + 0.7,
        y: top,
        width: contentW - check - 0.7,
        height: rowH,
        text: value,
        fontSize: 2.2
      }));
    });
  } else {
    const titleH = clamp(contentH * 0.27, 3.8, 6.2);
    add(doc, text(doc, {
      x: box.x,
      y: box.y,
      width: contentW,
      height: titleH,
      text: item,
      fontSize: clamp(titleH * 0.62, 2.9, 4.6),
      bold: true,
      fontFamily
    }));
    const available = contentH - titleH - 0.5;
    const rows = Math.min(extras.length, available >= 10 ? 3 : available >= 6 ? 2 : 1);
    const rowH = rows ? Math.min(3.6, available / rows) : 0;
    extras.slice(0, rows).forEach((value, row) => {
      const top = box.y + titleH + 0.5 + row * rowH;
      const labelW = clamp(contentW * 0.18, 3.6, 6.4);
      add(doc, text(doc, {
        x: box.x,
        y: top,
        width: labelW,
        height: rowH,
        text: String(row + 1).padStart(2, '0'),
        fontSize: 2.2,
        bold: true,
        reverse: group === 'operations' && row === 0,
        align: 'center',
        fontFamily: 'monospace'
      }));
      add(doc, text(doc, {
        x: box.x + labelW + 0.6,
        y: top,
        width: contentW - labelW - 0.6,
        height: rowH,
        text: value,
        fontSize: 2.2
      }));
    });
  }

  if (sideW) {
    maybeCode(doc, {
      x: box.x + contentW + 0.9,
      y: box.y,
      w: sideW,
      h: box.h
    }, entry, index, true);
  } else if (bottomCodeH) {
    maybeCode(doc, {
      x: box.x,
      y: box.y + box.h - bottomCodeH,
      w: box.w,
      h: bottomCodeH
    }, entry, index, false);
  }
}

function fillCertBody(doc, box, entry, item, index) {
  const split = box.w >= 32 && box.h >= 18;
  const leftW = split ? box.w * 0.62 : box.w;
  const titleH = clamp(box.h * 0.34, 5.2, 9.5);
  add(doc, text(doc, {
    x: box.x,
    y: box.y,
    width: leftW,
    height: titleH,
    text: item,
    fontSize: clamp(titleH * 0.58, 3.3, 5.8),
    bold: true,
    fontFamily: sceneFont('cert')
  }));
  const rows = extraLines('cert', index, 2);
  rows.forEach((value, row) => {
    const top = box.y + titleH + 0.4 + row * 3.1;
    if (top + 2.8 <= box.y + box.h) {
      add(doc, text(doc, {
        x: box.x,
        y: top,
        width: leftW,
        height: 2.8,
        text: value,
        fontSize: 2.2
      }));
    }
  });
  const dateY = box.y + titleH + 0.4 + rows.length * 3.1;
  if (dateY + 3.0 <= box.y + box.h) {
    add(doc, dateEl(doc, {
      x: box.x,
      y: dateY,
      width: leftW,
      height: 3.0,
      label: '检验',
      showTime: false,
      format: 'YYYY-MM-DD',
      fontSize: 2.2,
      align: 'left',
      fontFamily: 'monospace'
    }));
  }
  if (!split) return;
  const panelX = box.x + leftW + 0.9;
  const panelW = box.w - leftW - 0.9;
  add(doc, rect(doc, {
    x: panelX,
    y: box.y,
    width: panelW,
    height: box.h,
    lineWidth: 0.35,
    filled: false,
    locked: true
  }));
  add(doc, text(doc, {
    x: panelX + 0.5,
    y: box.y + 0.8,
    width: panelW - 1.0,
    height: clamp(box.h * 0.28, 4.6, 7.5),
    text: 'PASS',
    fontSize: clamp(box.h * 0.14, 3.2, 5.0),
    bold: true,
    reverse: true,
    align: 'center',
    fontFamily: 'monospace'
  }));
  add(doc, serial(doc, {
    x: panelX + 0.5,
    y: box.y + box.h * 0.48,
    width: panelW - 1.0,
    height: 3.4,
    prefix: 'QC-',
    start: 100 + (index % 900),
    digits: 3,
    fontSize: 2.3,
    bold: true,
    align: 'center',
    fontFamily: 'monospace'
  }));
  add(doc, text(doc, {
    x: panelX + 0.5,
    y: box.y + box.h - 3.7,
    width: panelW - 1.0,
    height: 2.9,
    text: sceneCode(entry.scene),
    fontSize: 2.2,
    bold: true,
    align: 'center',
    fontFamily: 'monospace'
  }));
}

function fillPriceBody(doc, box, entry, item, index) {
  const titleSize = fontSize(Math.min(box.h, 28), 0.16, 4.0);
  let y = box.y;
  doc.elements.push(text(doc, {
    x: box.x, y, width: box.w, height: titleSize + 0.5,
    text: item, fontSize: titleSize, bold: true
  }));
  y += titleSize + 0.8;
  if (y + 5 <= box.y + box.h) {
    doc.elements.push(text(doc, {
      x: box.x, y, width: box.w * 0.58, height: 5.2,
      text: priceFor(index), fontSize: clamp(box.h * 0.2, 3.4, 5.4), bold: true
    }));
    doc.elements.push(text(doc, {
      x: box.x + box.w * 0.58, y: y + 1.0, width: box.w * 0.42, height: 3.2,
      text: extraLines(entry.scene, index, 1)[0] || '当日鲜品', fontSize: 2.2, align: 'right'
    }));
    y += 5.6;
  }
  maybeCode(doc, { x: box.x, y, w: box.w, h: box.y + box.h - y }, entry, index, false);
}

function fillDateBody(doc, box, entry, item, index, medicine) {
  const titleSize = fontSize(Math.min(box.h, 26), 0.15, 3.6);
  let y = box.y;
  doc.elements.push(text(doc, {
    x: box.x, y, width: box.w, height: titleSize + 0.5,
    text: item, fontSize: titleSize, bold: true
  }));
  y += titleSize + 0.9;
  const rowH = 3.3;
  if (y + rowH <= box.y + box.h) {
    doc.elements.push(text(doc, { x: box.x, y, width: 9, height: rowH, text: '制作', fontSize: 2.2 }));
    doc.elements.push(dateEl(doc, {
      x: box.x + 9, y, width: box.w - 9, height: rowH,
      label: '', showTime: false, format: 'YYYY-MM-DD', fontSize: 2.4, align: 'right'
    }));
    y += rowH + 0.2;
  }
  if (y + rowH <= box.y + box.h) {
    doc.elements.push(text(doc, { x: box.x, y, width: 9, height: rowH, text: medicine ? '有效至' : '食用至', fontSize: 2.2 }));
    doc.elements.push(dateEl(doc, {
      x: box.x + 9, y, width: box.w - 9, height: rowH,
      label: '', showTime: false, format: 'YYYY-MM-DD', fontSize: 2.4, bold: true, align: 'right',
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: medicine ? 24 * 180 : 48
    }));
    y += rowH + 0.3;
  }
  extraLines(entry.scene, index, box.h >= 28 ? 2 : 1).forEach((line) => {
    if (y + 2.8 > box.y + box.h) return;
    doc.elements.push(text(doc, { x: box.x, y, width: box.w, height: 2.8, text: line, fontSize: 2.2 }));
    y += 2.9;
  });
}

function fillNameBody(doc, box, entry, item, index) {
  const nameSize = fontSize(Math.min(box.h, 24), 0.28, 5.2);
  let y = box.y;
  doc.elements.push(text(doc, {
    x: box.x, y, width: box.w, height: nameSize + 0.8,
    text: item, fontSize: nameSize, bold: true
  }));
  y += nameSize + 1.1;
  extraLines('name', index, 2).forEach((line) => {
    if (y + 3.0 > box.y + box.h) return;
    doc.elements.push(text(doc, { x: box.x, y, width: box.w, height: 3.0, text: line, fontSize: 2.2 }));
    y += 3.1;
  });
}

function fillWifiBody(doc, box, entry, item, index, suppressCode) {
  const qrSize = Math.min(14, box.h, box.w * 0.38);
  const useQr = !suppressCode && qrSize >= 10.8 && box.w >= 28;
  const textW = useQr ? box.w - qrSize - 1.0 : box.w;
  doc.elements.push(text(doc, {
    x: box.x, y: box.y, width: textW, height: 4.0,
    text: item, fontSize: 3.0, bold: true
  }));
  doc.elements.push(text(doc, {
    x: box.x, y: box.y + 4.2, width: textW, height: 2.8,
    text: '名称 SY-Guest', fontSize: 2.2
  }));
  doc.elements.push(text(doc, {
    x: box.x, y: box.y + 7.2, width: textW, height: 2.8,
    text: '密码 welcome26', fontSize: 2.2
  }));
  if (box.y + 10.2 + 2.6 <= box.y + box.h) {
    doc.elements.push(text(doc, {
      x: box.x, y: box.y + 10.2, width: textW, height: 2.6,
      text: '打印后请改密码', fontSize: 2.2
    }));
  }
  if (useQr) {
    doc.elements.push(qrcode(doc, {
      x: box.x + textW + 1.0,
      y: box.y + Math.max(0, (box.h - qrSize) / 2),
      width: qrSize,
      height: qrSize,
      value: qrPayload('wifi', index, item)
    }));
  }
}

function fillWishBody(doc, box, entry, item, index) {
  const titleH = clamp(box.h * 0.38, 4.5, 8.0);
  add(doc, text(doc, {
    x: box.x,
    y: box.y,
    width: box.w,
    height: titleH,
    text: item,
    fontSize: clamp(titleH * 0.58, 3.2, 5.2),
    bold: true,
    align: Number(entry.variant) === 1 ? 'center' : Number(entry.variant) === 2 ? 'right' : 'left',
    fontFamily: sceneFont('wish')
  }));
  add(doc, line(doc, {
    x: box.x + (Number(entry.variant) === 1 ? box.w * 0.2 : 0),
    y: box.y + titleH,
    width: Number(entry.variant) === 1 ? box.w * 0.6 : box.w,
    height: 0.3,
    lineWidth: 0.35,
    locked: true
  }));
  extraLines('wish', index, box.h >= 14 ? 2 : 1).forEach((line, lineIndex) => {
    const top = box.y + titleH + 0.45 + lineIndex * 3.4;
    if (top + 3.0 > box.y + box.h) return;
    add(doc, text(doc, {
      x: box.x,
      y: top,
      width: box.w,
      height: 3.0,
      text: line,
      fontSize: 2.3,
      align: Number(entry.variant) === 1 ? 'center' : Number(entry.variant) === 2 ? 'right' : 'left'
    }));
  });
}

function fillBinBody(doc, box, entry, item, index, scene, suppressCode) {
  const qrSize = Math.min(14.0, box.h, box.w * 0.34);
  const useQr = !suppressCode && qrSize >= 10.8 && box.w >= 32;
  const textW = useQr ? box.w - qrSize - 1.0 : box.w;
  const titleSize = fontSize(Math.min(box.h, 26), 0.18, 4.2);
  let y = box.y;
  doc.elements.push(text(doc, {
    x: box.x, y, width: textW, height: titleSize + 0.6,
    text: item, fontSize: titleSize, bold: true
  }));
  y += titleSize + 0.9;
  extraLines(scene, index, box.h >= 28 ? 3 : 2).forEach((line) => {
    if (y + 2.9 > box.y + box.h) return;
    doc.elements.push(text(doc, { x: box.x, y, width: textW, height: 2.8, text: line, fontSize: 2.2 }));
    y += 2.95;
  });
  if (useQr) {
    doc.elements.push(qrcode(doc, {
      x: box.x + textW + 1.0,
      y: box.y + 0.2,
      width: qrSize,
      height: qrSize,
      value: qrPayload(scene, index, item)
    }));
  } else if (!suppressCode) {
    maybeCode(doc, { x: box.x, y, w: box.w, h: box.y + box.h - y }, entry, index, false);
  }
}

function extraLines(scene, index, limit) {
  const n = Math.max(1, Number(limit) || ((index % 3) + 1));
  const table = {
    price: ['产地 宾川 · 500g', '会员价另计', '当日鲜品', '售完即止'],
    date: ['冷藏 0–4℃', '开封后请尽快食用', '密封存放', '请勿反复解冻'],
    name: ['三年二班 · 12 号', '家属 138-0000-2288'],
    wifi: ['名称 SY-Guest', '请改默认密码'],
    wish: ['新一岁 · 常欢喜', '愿每一次出发都有好风景'],
    warehouse: ['SKU SY-WH-0817', '批次 20260817', '数量 24', '先入先出'],
    cable: ['机柜 12', '回路照明'],
    jewelry: ['编号 SY-J8842', '重量 5.2g'],
    garment: ['款号 SY-2601 · M', '98% 棉 2% 氨纶', '不可漂白', '低温熨烫'],
    ship: ['杭州滨江 · 3 号库', '1/4 · 易碎轻放', '当日达'],
    medicine: ['0.3g × 20 粒', '遵医嘱使用', '儿童请监护'],
    card: ['产品设计', 'hi＠sy.example'],
    seat: ['2026.10.01', '宴会厅'],
    bakery: ['6 寸 / 约 680g', '当日烘焙', '冷藏保存'],
    plant: ['散射光 4–6h', '见干见湿', '15–22℃'],
    lab: ['室温保存', '商跃实验室', '请勿倒置'],
    asset: ['研发中心', '购置 2025-11', '使用人 张工'],
    queue: ['请持号等候', '过号请重取'],
    note: ['请当日完成', '完成后划掉', '重要事项优先', '离开前复核'],
    cert: ['抽检合格', '批次放行', '可出厂'],
    material: ['库区 紧固件', '点数后入库', '编码 PN-88421'],
    cup: ['少冰 · 标准糖', '请勿摇晃'],
    seal: ['请冷藏', '开封即食', '封口保持干燥', '破损请勿食用'],
    office: ['请随手关闭', '用品请归位', '设备用后断电', '保持台面整洁'],
    info: ['请按说明使用', '存放于干燥处', '如有破损请停用', '商跃出品']
  };
  return (table[scene] || table.info).slice(0, n);
}

function maybeCode(doc, box, entry, index, preferQr) {
  if (box.h < 6 || box.w < 11) return;
  const scene = entry.scene;
  if (!QR_SCENES.has(scene) && !BARCODE_SCENES.has(scene)) return;
  const wantQr = QR_SCENES.has(scene);
  const qrSize = Math.min(box.w, box.h, 14);
  if (wantQr && qrSize >= 10.8) {
    doc.elements.push(qrcode(doc, {
      x: box.x + Math.max(0, box.w - qrSize),
      y: box.y + Math.max(0, (box.h - qrSize) / 2),
      width: qrSize,
      height: qrSize,
      value: qrPayload(scene, index, entry.item)
    }));
    return;
  }
  if (wantQr) return;
  if (box.w >= 24.8 && box.h >= 6) {
    doc.elements.push(barcode(doc, {
      x: box.x,
      y: box.y + Math.max(0, box.h - Math.min(box.h, 8)),
      width: box.w,
      height: Math.min(box.h, 8),
      value: shortCode(index),
      format: 'code128',
      showText: true,
      fontSize: 2.2
    }));
  }
}

function catalogMeta(entry) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    industry: entry.category === '零售' || entry.category === '生活' ? '内容设计' : '行业标识',
    size: [entry.widthMm, entry.heightMm],
    kind: kindFor(entry.scene, entry.widthMm, entry.heightMm),
    uses: 0,
    scene: entry.scene,
    sceneLabel: entry.title,
    badge: '商跃生成',
    blurb: `${entry.title} · 商跃语义排版 v2`,
    accent: '#176B68',
    origin: 'shangyue-library',
    source: 'shangyue-library',
    copyright: '© 2026 商跃',
    approvedOriginal: false,
    approvalStatus: 'approved-library',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    designSystem: 'sy-semantic-grid-v2',
    designFamily: designFamily(entry.variant).id,
    aiAssisted: true,
    libraryId: entry.id
  };
}

function ownedEntry(scene, widthMm, heightMm, item, variant, serial) {
  const mark = OWNED_VARIANT_MARKS[variant] || OWNED_VARIANT_MARKS[0];
  const family = designFamily(variant);
  return {
    id: `sy-lib-${String(serial + 1).padStart(5, '0')}`,
    name: `${scene.title} · ${item} · ${widthMm}×${heightMm}${mark}`,
    title: scene.title,
    item,
    scene: scene.id,
    category: scene.category,
    sceneCode: sceneCode(scene.id),
    designFamily: family.id,
    designFamilyLabel: family.label,
    widthMm,
    heightMm,
    variant,
    serial,
    kind: kindFor(scene.id, widthMm, heightMm)
  };
}

function buildOwnedLibraryIndex() {
  const entries = [];
  SCENES.forEach((scene) => {
    const pool = ITEM_POOLS[scene.id] || ITEM_POOLS.info;
    OWNED_PAPERS.forEach(([widthMm, heightMm]) => {
      pool.forEach((item) => {
        OWNED_VARIANT_MARKS.forEach((_, variant) => {
          entries.push(ownedEntry(scene, widthMm, heightMm, item, variant, entries.length));
        });
      });
    });
  });
  return entries;
}

function fromRemoteUseCase(record, serial) {
  const classified = classifyScene(record && record.name);
  const scene = SCENES.find((item) => item.id === classified.scene) || SCENES[SCENES.length - 1];
  const widthMm = Number(record && record.width) || 40;
  const heightMm = Number(record && record.height) || 30;
  const item = pickItem(scene.id, serial);
  return ownedEntry(scene, widthMm, heightMm, item, serial % OWNED_VARIANT_MARKS.length, serial);
}

module.exports = {
  buildDocument,
  buildOwnedLibraryIndex,
  catalogMeta,
  ean13FromIndex,
  fromRemoteUseCase,
  ownedEntry,
  provenance,
  shortCode,
  stableLayoutSeed,
  stableSeed
};
