function asUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof DataView !== 'undefined' && value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return Uint8Array.from(value || []);
}

function concatBytes() {
  const arrays = Array.prototype.map.call(arguments, asUint8Array);
  const length = arrays.reduce((total, item) => total + item.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  arrays.forEach((item) => {
    output.set(item, offset);
    offset += item.length;
  });
  return output;
}

function u16be(value) {
  const number = Math.max(0, Math.min(0xffff, Math.round(value)));
  return [(number >> 8) & 0xff, number & 0xff];
}

function readU16be(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

function countBits(value) {
  let number = value & 0xff;
  let count = 0;
  while (number) {
    number &= number - 1;
    count += 1;
  }
  return count;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = {
  asUint8Array,
  concatBytes,
  countBits,
  readU16be,
  sleep,
  u16be
};
