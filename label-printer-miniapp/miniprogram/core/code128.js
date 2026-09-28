// Code 128 with sets B and C. Values outside printable ASCII are rejected explicitly.
const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;
const QUIET_ZONE_MODULES = 20;
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

function finish(symbols) {
  const checksum = symbols.reduce((sum, item, index) => sum + item * Math.max(1, index), 0) % 103;
  const all = symbols.concat(checksum, STOP);
  return {
    symbols: all,
    patterns: all.map((item) => PATTERNS[item]),
    moduleCount: all.reduce((total, item) => {
      return total + PATTERNS[item].split('').reduce((sum, width) => sum + Number(width), 0);
    }, QUIET_ZONE_MODULES)
  };
}

function encodeCode128B(value) {
  const text = String(value || '');
  if (!text.length) {
    throw new Error('条码内容不能为空');
  }

  const values = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code > 126) {
      throw new Error('Code 128B 仅支持 ASCII 32-126 字符');
    }
    values.push(code - 32);
  }
  return finish([START_B].concat(values));
}

function isDigit(text, index) {
  const code = text.charCodeAt(index);
  return code >= 48 && code <= 57;
}

/**
 * Shortest B/C symbol sequence (fewest modules), so numeric runs such as
 * express numbers take about half the width of set B. Ties stay in the
 * current set, which keeps text without digit runs identical to set B.
 */
function encodeCode128(value) {
  const text = value == null ? '' : String(value);
  if (!text.length) {
    throw new Error('条码内容不能为空');
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code > 126) {
      throw new Error('条码（Code 128）只支持英文字母、数字和常用符号；中文或换行请改用二维码');
    }
  }

  const length = text.length;
  // costB[i] / costC[i]: symbols needed for text[i..] when set B / C is active.
  const costB = new Array(length + 1).fill(0);
  const costC = new Array(length + 1).fill(0);
  const stayB = new Array(length).fill(true);
  const stayC = new Array(length).fill(true);
  for (let index = length - 1; index >= 0; index -= 1) {
    const pair = index + 1 < length && isDigit(text, index) && isDigit(text, index + 1);
    const charInB = 1 + costB[index + 1];
    const pairInC = pair ? 1 + costC[index + 2] : Infinity;
    stayB[index] = charInB <= 1 + pairInC;
    costB[index] = stayB[index] ? charInB : 1 + pairInC;
    stayC[index] = pairInC <= 1 + charInB;
    costC[index] = stayC[index] ? pairInC : 1 + charInB;
  }

  let set = costC[0] < costB[0] ? 'C' : 'B';
  const symbols = [set === 'C' ? START_C : START_B];
  let index = 0;
  while (index < length) {
    if (set === 'B') {
      if (stayB[index]) {
        symbols.push(text.charCodeAt(index) - 32);
        index += 1;
      } else {
        symbols.push(CODE_C);
        set = 'C';
      }
    } else if (stayC[index]) {
      symbols.push(Number(text.slice(index, index + 2)));
      index += 2;
    } else {
      symbols.push(CODE_B);
      set = 'B';
    }
  }
  return finish(symbols);
}

module.exports = { encodeCode128, encodeCode128B };
