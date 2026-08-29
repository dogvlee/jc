const { encodeEan13 } = require('./ean13');

function checksum(digits) {
  const text = String(digits || '');
  if (!/^\d{11}$/.test(text)) {
    throw new Error('UPC-A 需要 11 或 12 位数字');
  }
  const sum = text.split('').reduce((total, digit, index) => (
    total + Number(digit) * (index % 2 === 0 ? 3 : 1)
  ), 0);
  return (10 - (sum % 10)) % 10;
}

function encodeUpca(value) {
  let text = String(value == null ? '' : value).replace(/\s/g, '');
  if (!/^\d{11,12}$/.test(text)) {
    throw new Error('UPC-A 需要 11 或 12 位数字');
  }
  const expected = checksum(text.slice(0, 11));
  if (text.length === 11) text += expected;
  else if (Number(text[11]) !== expected) throw new Error(`UPC-A 校验位应为 ${expected}`);
  const encoded = encodeEan13(`0${text}`);
  return { ...encoded, text };
}

module.exports = { checksum, encodeUpca };
