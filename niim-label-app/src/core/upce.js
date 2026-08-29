const { encodeUpca } = require('./upca');

const LEFT_ODD = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const LEFT_EVEN = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];

// GS1 calls these number sets A/B. O/G keeps the names aligned with the
// odd/even terminology used by barcode readers such as ZXing.
const PARITY = [
  [
    'GGGOOO', 'GGOGOO', 'GGOOGO', 'GGOOOG', 'GOGGOO',
    'GOOGGO', 'GOOOGG', 'GOGOGO', 'GOGOOG', 'GOOGOG'
  ],
  [
    'OOOGGG', 'OOGOGG', 'OOGGOG', 'OOGGGO', 'OGOOGG',
    'OGGOOG', 'OGGGOO', 'OGOGOG', 'OGOGGO', 'OGGOGO'
  ]
];

const QUIET_ZONE = '0000000000';

function normalizeNumberSystem(value) {
  const numberSystem = value == null ? 0 : Number(value);
  if (!Number.isInteger(numberSystem) || (numberSystem !== 0 && numberSystem !== 1)) {
    throw new Error('UPC-E 编号系统位只能是 0 或 1');
  }
  return numberSystem;
}

function validateCompressedPayload(payload) {
  const last = payload[5];
  if (last === '3' && Number(payload[2]) < 3) {
    throw new Error('UPC-E 压缩结构无效：末位为 3 时，第 3 位必须是 3–9');
  }
  if (last === '4' && payload[3] === '0') {
    throw new Error('UPC-E 压缩结构无效：末位为 4 时，第 4 位必须是 1–9');
  }
  if (Number(last) >= 5 && payload[4] === '0') {
    throw new Error('UPC-E 压缩结构无效：末位为 5–9 时，第 5 位必须是 1–9');
  }
}

function expandPayload(numberSystem, payload) {
  validateCompressedPayload(payload);
  const last = payload[5];
  let body;

  if (last === '0' || last === '1' || last === '2') {
    body = `${numberSystem}${payload.slice(0, 2)}${last}0000${payload.slice(2, 5)}`;
  } else if (last === '3') {
    body = `${numberSystem}${payload.slice(0, 3)}00000${payload.slice(3, 5)}`;
  } else if (last === '4') {
    body = `${numberSystem}${payload.slice(0, 4)}00000${payload[4]}`;
  } else {
    body = `${numberSystem}${payload.slice(0, 5)}0000${last}`;
  }

  return body;
}

function normalizeUpce(value, options = {}) {
  const input = String(value == null ? '' : value).replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(input)) {
    throw new Error('UPC-E 需要 6、7 或 8 位数字');
  }

  const hasExplicitOption = options.numberSystem != null;
  let numberSystem;
  let payload;
  let suppliedCheckDigit = null;

  if (input.length === 6) {
    numberSystem = normalizeNumberSystem(options.numberSystem);
    payload = input;
  } else {
    numberSystem = normalizeNumberSystem(input[0]);
    payload = input.slice(1, 7);
    if (input.length === 8) suppliedCheckDigit = input[7];

    if (hasExplicitOption && normalizeNumberSystem(options.numberSystem) !== numberSystem) {
      throw new Error(`UPC-E 编号系统位冲突：输入为 ${numberSystem}，选项为 ${options.numberSystem}`);
    }
  }

  const upcaBody = expandPayload(numberSystem, payload);
  const upcaText = encodeUpca(upcaBody).text;
  const checkDigit = upcaText[11];
  if (suppliedCheckDigit != null && suppliedCheckDigit !== checkDigit) {
    throw new Error(`UPC-E 校验位应为 ${checkDigit}`);
  }

  return {
    numberSystem,
    payload,
    checkDigit,
    text: `${numberSystem}${payload}${checkDigit}`,
    upcaText
  };
}

function expandUpce(value, options = {}) {
  return normalizeUpce(value, options).upcaText;
}

function encodeUpce(value, options = {}) {
  const normalized = normalizeUpce(value, options);
  const parity = PARITY[normalized.numberSystem][Number(normalized.checkDigit)];
  let core = '101';

  normalized.payload.split('').forEach((digit, index) => {
    const patterns = parity[index] === 'O' ? LEFT_ODD : LEFT_EVEN;
    core += patterns[Number(digit)];
  });
  core += '010101';

  const bits = QUIET_ZONE + core + QUIET_ZONE;
  return { bits, text: normalized.text, moduleCount: bits.length };
}

module.exports = {
  encodeUpce,
  expandUpce,
  normalizeUpce,
  validateCompressedPayload
};
