/**
 * Map CSV/batch rows onto label documents (clean-room field binding).
 * Roles: name, code, price, date → text / barcode / qrcode / date elements.
 */

function looksLikePrice(text) {
  return /¥|￥|元|price|价/i.test(String(text || ''));
}

function looksLikeCode(text) {
  return /code|编号|条码|sku|货号/i.test(String(text || ''));
}

function isBatchCompatibleTemplate(template) {
  if (!template || template.batchCompatible === false) return false;
  const documentValue = template.document || template;
  const meta = documentValue && documentValue.templateMeta;
  return !(meta && meta.batchCompatible === false);
}

function resolveBatchCompatibleTemplate(candidates, requestedId, fallbackId) {
  const compatible = (Array.isArray(candidates) ? candidates : [])
    .filter(isBatchCompatibleTemplate);
  return compatible.find((item) => item.id === requestedId)
    || compatible.find((item) => item.id === (fallbackId || 'product-simple'))
    || compatible[0]
    || null;
}

function confirmBoundValue(element) {
  if (!element) return element;
  element.requiresInput = false;
  delete element.requiresInputReason;
  delete element.invalidCode;
  delete element.codeValidationMessage;
  return element;
}

function applyRowToDocument(documentValue, row, options) {
  if (!isBatchCompatibleTemplate(documentValue)) {
    throw new Error('此模板不支持批量数据绑定');
  }
  const config = Object.assign({
    nameField: 'name',
    codeField: 'code',
    priceField: 'price',
    dateField: 'date'
  }, options || {});

  const rowData = row || {};
  const name = String(rowData[config.nameField] != null ? rowData[config.nameField] : '').trim();
  const code = String(rowData[config.codeField] != null ? rowData[config.codeField] : '').trim();
  const price = String(rowData[config.priceField] != null ? rowData[config.priceField] : '').trim();
  const date = String(rowData[config.dateField] != null ? rowData[config.dateField] : '').trim();

  if (name) documentValue.name = name;

  const texts = documentValue.elements.filter((item) => item.type === 'text');
  const barcodes = documentValue.elements.filter((item) => item.type === 'barcode');
  const qrcodes = documentValue.elements.filter((item) => item.type === 'qrcode');
  const dates = documentValue.elements.filter((item) => item.type === 'date');
  const serials = documentValue.elements.filter((item) => item.type === 'serial');

  // Title-like first text
  if (texts[0] && name) {
    texts[0].text = name;
    confirmBoundValue(texts[0]);
  }

  // Price-looking text or second text
  const priceTarget = texts.find((item) => looksLikePrice(item.text)) || texts[1];
  if (priceTarget && price) {
    priceTarget.text = /¥|￥/.test(price) ? price : `¥${price}`;
    confirmBoundValue(priceTarget);
  }

  // Code-looking text (if any remaining)
  const codeTarget = texts.find((item) => item !== texts[0] && item !== priceTarget && looksLikeCode(item.text));
  if (codeTarget && code) {
    codeTarget.text = code;
    confirmBoundValue(codeTarget);
  }

  // Third text can absorb date label if no date element
  if (date && texts[2] && !dates.length && texts[2] !== priceTarget) {
    texts[2].text = date;
    confirmBoundValue(texts[2]);
  }

  barcodes.forEach((barcode) => {
    if (!code) return;
    barcode.value = code;
    barcode.format = /^\d{12,13}$/.test(code) ? 'ean13' : 'code128';
    delete barcode.unsupportedCodeType;
    delete barcode.requiresFormatConfirmation;
    confirmBoundValue(barcode);
  });

  qrcodes.forEach((qr) => {
    if (code) qr.value = code;
    else if (name) qr.value = name;
    if (code || name) confirmBoundValue(qr);
  });

  dates.forEach((item) => {
    if (!date) return;
    item.autoUpdate = false;
    item.fixedValue = date;
  });

  // Serial: use code digits if present
  if (serials[0] && code && /^\d+$/.test(code)) {
    serials[0].start = Number(code) || serials[0].start;
    serials[0].currentValue = null;
  }

  return documentValue;
}

function buildDocumentsFromRows(templateFactory, rows, options) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row, index) => {
    const documentValue = templateFactory();
    applyRowToDocument(documentValue, row, options);
    if (!documentValue.name || documentValue.name === '未命名标签') {
      documentValue.name = (row && (row.name || row.code)) || `批量 ${index + 1}`;
    }
    return documentValue;
  });
}

module.exports = {
  applyRowToDocument,
  buildDocumentsFromRows,
  isBatchCompatibleTemplate,
  looksLikeCode,
  looksLikePrice,
  resolveBatchCompatibleTemplate
};
