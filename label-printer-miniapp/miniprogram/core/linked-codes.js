/**
 * Barcodes and QR codes can follow the label's serial number
 * (`serialLinked: true`), so every copy of an asset or cable label carries a
 * code that matches its own printed number. The stored `value` stays as the
 * editor's fallback; rendering and print validation use the resolved value.
 */
const CODE_TYPES = ['barcode', 'qrcode'];

function serialText(element) {
  const raw = element.currentValue == null ? Number(element.start) || 0 : Number(element.currentValue) || 0;
  const digits = Math.max(1, Number(element.digits) || 1);
  return `${element.prefix || ''}${String(raw).padStart(digits, '0')}${element.suffix || ''}`;
}

function linkedSerial(document) {
  const elements = document && Array.isArray(document.elements) ? document.elements : [];
  return elements.find((element) => element.type === 'serial') || null;
}

function isLinkedCode(element) {
  return Boolean(element && CODE_TYPES.includes(element.type) && element.serialLinked === true);
}

/** Value the code prints on this page; its stored value when no serial exists. */
function linkedCodeValue(document, element) {
  const serial = isLinkedCode(element) ? linkedSerial(document) : null;
  return serial ? serialText(serial) : String(element && element.value != null ? element.value : '');
}

/** Same document when nothing is linked; otherwise a copy with resolved code values. */
function resolveLinkedCodes(document) {
  const elements = document && Array.isArray(document.elements) ? document.elements : [];
  const serial = linkedSerial(document);
  if (!serial || !elements.some(isLinkedCode)) return document;
  const value = serialText(serial);
  return Object.assign({}, document, {
    elements: elements.map((element) => (isLinkedCode(element) ? Object.assign({}, element, { value }) : element))
  });
}

/**
 * Keeps each linked code's stored value equal to the first serial number, so
 * size checks, previews and exports that read `value` see what page 1 prints.
 */
function syncLinkedCodes(document) {
  const serial = linkedSerial(document);
  if (!serial) return document;
  const value = serialText(Object.assign({}, serial, { currentValue: null }));
  document.elements.forEach((element) => {
    if (isLinkedCode(element)) element.value = value;
  });
  return document;
}

module.exports = { isLinkedCode, linkedCodeValue, resolveLinkedCodes, serialText, syncLinkedCodes };
