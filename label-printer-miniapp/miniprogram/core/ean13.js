const LEFT = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const LEFT_EVEN = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const RIGHT = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

function checksum(digits) {
  const sum = digits.split('').reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return (10 - (sum % 10)) % 10;
}

function encodeEan13(value) {
  let text = String(value || '').replace(/\s/g, '');
  if (!/^\d{12,13}$/.test(text)) {
    throw new Error('EAN-13 需要 12 或 13 位数字');
  }
  const expected = checksum(text.slice(0, 12));
  if (text.length === 12) {
    text += expected;
  } else if (Number(text[12]) !== expected) {
    throw new Error(`EAN-13 校验位应为 ${expected}`);
  }

  const parity = PARITY[Number(text[0])];
  let core = '101';
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(text[index]);
    core += parity[index - 1] === 'L' ? LEFT[digit] : LEFT_EVEN[digit];
  }
  core += '01010';
  for (let index = 7; index <= 12; index += 1) {
    core += RIGHT[Number(text[index])];
  }
  core += '101';

  const quietZone = '0000000000';
  const bits = quietZone + core + quietZone;
  return { bits, text, moduleCount: bits.length };
}

module.exports = { checksum, encodeEan13 };
