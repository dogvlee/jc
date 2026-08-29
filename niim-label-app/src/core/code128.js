// Code 128 subsets A/B/C. Values outside each subset are rejected explicitly.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212',
  '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221',
  '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131',
  '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242',
  '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311',
  '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

function finishEncoding(startCode, values, text) {
  let checksum = startCode;
  values.forEach((item, index) => {
    checksum += item * (index + 1);
  });
  const symbols = [startCode, ...values, checksum % 103, 106];
  return {
    symbols,
    patterns: symbols.map((item) => PATTERNS[item]),
    moduleCount: symbols.reduce((total, item) => {
      return total + PATTERNS[item].split('').reduce((sum, width) => sum + Number(width), 0);
    }, 20),
    text
  };
}

function requiredText(value) {
  const text = String(value == null ? '' : value);
  if (!text.length) {
    throw new Error('条码内容不能为空');
  }
  return text;
}

function encodeCode128A(value) {
  const text = requiredText(value);
  const values = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0 || code > 95) {
      throw new Error('Code 128A 仅支持 ASCII 0-95 字符');
    }
    values.push(code < 32 ? code + 64 : code - 32);
  }
  return finishEncoding(103, values, text);
}

function encodeCode128B(value) {
  const text = requiredText(value);
  const values = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code > 126) {
      throw new Error('Code 128B 仅支持 ASCII 32-126 字符');
    }
    values.push(code - 32);
  }
  return finishEncoding(104, values, text);
}

function encodeCode128C(value) {
  const text = requiredText(value);
  if (!/^\d+$/.test(text) || text.length % 2 !== 0) {
    throw new Error('Code 128C 需要偶数位数字');
  }
  const values = [];
  for (let index = 0; index < text.length; index += 2) {
    values.push(Number(text.slice(index, index + 2)));
  }
  return finishEncoding(105, values, text);
}

function encodeCode128(value, subset) {
  const text = requiredText(value);
  const normalized = String(subset || 'auto').toLowerCase();
  if (normalized === 'a') return encodeCode128A(text);
  if (normalized === 'b') return encodeCode128B(text);
  if (normalized === 'c') return encodeCode128C(text);
  // Auto keeps mixed content compatible with the historic B encoder, while
  // compacting an all-numeric even-length payload using subset C.
  return /^\d{4,}$/.test(text) && text.length % 2 === 0
    ? encodeCode128C(text)
    : encodeCode128B(text);
}

module.exports = {
  encodeCode128,
  encodeCode128A,
  encodeCode128B,
  encodeCode128C
};
