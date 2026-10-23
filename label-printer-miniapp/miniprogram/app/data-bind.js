/**
 * Map CSV/batch rows onto label documents (clean-room field binding).
 * Roles: name, code, price, date → text / barcode / qrcode / date elements.
 */

const { BATCH_FIELDS } = require('../core/data-fields');
const { cloneDocument } = require('../core/document');
const { isValidEan13 } = require('../core/ean13');

// Only a complete EAN-13 prints as EAN-13; anything else prints as Code 128.
function barcodeFormatFor(value) {
  return isValidEan13(value) ? 'ean13' : 'code128';
}

function looksLikePrice(text) {
  return /¥|￥|元|price|价/i.test(String(text || ''));
}

function looksLikeCode(text) {
  return /code|编号|条码|sku|货号/i.test(String(text || ''));
}

function assertBatchCompatible(documentValue) {
  if (!documentValue || !Array.isArray(documentValue.elements)) {
    throw new Error('批量模板数据损坏');
  }
  if (documentValue.templateMeta && documentValue.templateMeta.batchCompatible === false) {
    throw new Error('此模板不支持批量数据，请选择内置基础模板');
  }
  return documentValue;
}

function confirmBoundValue(element) {
  if (!element) return element;
  element.requiresInput = false;
  delete element.requiresInputReason;
  delete element.invalidCode;
  delete element.codeValidationMessage;
  return element;
}

// Trimmed name / code / price / date of one row, honoring custom column names.
function rowValues(row, options) {
  const config = Object.assign({
    nameField: 'name',
    codeField: 'code',
    priceField: 'price',
    dateField: 'date'
  }, options || {});
  const rowData = row || {};
  const read = (field) => String(rowData[field] != null ? rowData[field] : '').trim();
  return {
    name: read(config.nameField),
    code: read(config.codeField),
    price: read(config.priceField),
    date: read(config.dateField)
  };
}

function applyRowToDocument(documentValue, row, options) {
  assertBatchCompatible(documentValue);
  const { name, code, price, date } = rowValues(row, options);

  if (name) documentValue.name = name;

  // Templates that tag their fields (bindField) are filled exactly; the
  // heuristics below remain for older templates without tags.
  const tagged = documentValue.elements.filter((item) => ['name', 'price', 'code', 'date'].includes(item.bindField));
  if (tagged.length) {
    const values = { name, price, code, date };
    tagged.forEach((element) => {
      const value = values[element.bindField];
      if (!value) return;
      if (element.type === 'barcode') {
        element.value = value;
        element.format = barcodeFormatFor(value);
        delete element.unsupportedCodeType;
        delete element.requiresFormatConfirmation;
      } else if (element.type === 'qrcode') {
        element.value = value;
      } else if (element.type === 'date') {
        element.autoUpdate = false;
        element.fixedValue = value;
      } else {
        element.text = element.bindField === 'price' && !/¥|￥/.test(value) ? `¥${value}` : value;
      }
      confirmBoundValue(element);
    });
    return documentValue;
  }

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
    barcode.format = barcodeFormatFor(code);
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

function rowError(rowNumber, reason, cause) {
  const error = new Error(`第 ${rowNumber} 行无法生成：${reason}`);
  error.code = 'BATCH_ROW_INVALID';
  error.rowNumber = rowNumber;
  if (cause) error.cause = cause;
  return error;
}

// An edited base usually still shows the first row's price and code; a row
// that leaves such a field blank must not print another row's value.
function clearUnfilledFields(documentValue, values, usedFields) {
  documentValue.elements.forEach((element) => {
    const field = element && element.bindField;
    if (!usedFields.includes(field) || values[field]) return;
    if (element.type === 'barcode' || element.type === 'qrcode') {
      element.value = '';
    } else if (element.type === 'date') {
      element.autoUpdate = true;
      element.fixedValue = '';
    } else {
      element.text = '';
    }
  });
}

/**
 * One print-ready copy of `baseDocument` per data row, in row order. Rows
 * whose name, code, price and date are all blank are skipped; each copy is
 * named after the row's name, code or “第 N 行”. A bound field that some rows
 * fill is emptied on rows that leave it blank. `options.validate(document,
 * rowNumber)` may reject a finished label. A failing row throws
 * “第 N 行无法生成：…” with error.rowNumber = N (1-based, blank rows counted).
 */
function buildBatchDocuments(baseDocument, rows, options) {
  assertBatchCompatible(baseDocument);
  const list = Array.isArray(rows) ? rows : [];
  const values = list.map((row, index) => {
    try {
      return rowValues(row, options);
    } catch (error) {
      throw rowError(index + 1, '这一行的数据无法填入模板', error);
    }
  });
  const usedFields = BATCH_FIELDS.filter((field) => values.some((value) => value[field]));
  const validate = options && typeof options.validate === 'function' ? options.validate : null;
  const documents = [];
  values.forEach((value, index) => {
    if (!BATCH_FIELDS.some((field) => value[field])) return;
    const rowNumber = index + 1;
    let documentValue;
    try {
      documentValue = applyRowToDocument(cloneDocument(baseDocument), list[index], options);
    } catch (error) {
      throw rowError(rowNumber, '这一行的数据无法填入模板', error);
    }
    clearUnfilledFields(documentValue, value, usedFields);
    documentValue.name = (value.name || value.code || `第 ${rowNumber} 行`).slice(0, 80);
    if (validate) {
      try {
        validate(documentValue, rowNumber);
      } catch (error) {
        throw rowError(rowNumber, (error && error.message) || '数据不符合模板要求', error);
      }
    }
    documents.push(documentValue);
  });
  return documents;
}

module.exports = {
  applyRowToDocument,
  assertBatchCompatible,
  buildBatchDocuments,
  buildDocumentsFromRows,
  looksLikeCode,
  looksLikePrice
};
