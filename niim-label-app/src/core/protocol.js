const { asUint8Array, concatBytes } = require('./bytes');

const COMMAND = Object.freeze({
  PRINT_START: 0x01,
  PAGE_START: 0x03,
  SET_PAGE_SIZE: 0x13,
  SET_QUANTITY: 0x15,
  PRINT_CLEAR: 0x20,
  SET_DENSITY: 0x21,
  SET_LABEL_TYPE: 0x23,
  PRINTER_INFO: 0x40,
  CANCEL_PRINT: 0xda,
  HEARTBEAT: 0xdc,
  CONNECT: 0xc1,
  PRINT_ROW_INDEXED: 0x83,
  PRINT_EMPTY_ROW: 0x84,
  PRINT_BITMAP_ROW: 0x85,
  CHECK_LINE: 0x86,
  PRINT_STATUS: 0xa3,
  PRINTER_STATUS_DATA: 0xa5,
  PAGE_END: 0xe3,
  PRINT_END: 0xf3
});

const RESPONSE = Object.freeze({
  NOT_SUPPORTED: 0x00,
  PRINT_START: 0x02,
  PAGE_START: 0x04,
  SET_PAGE_SIZE: 0x14,
  SET_QUANTITY: 0x16,
  PRINT_CLEAR: 0x30,
  SET_DENSITY: 0x31,
  SET_LABEL_TYPE: 0x33,
  PRINTER_MODEL: 0x48,
  PRINTER_SOFTWARE: 0x49,
  PRINTER_HARDWARE: 0x4c,
  CANCEL_PRINT: 0xd0,
  HEARTBEAT: [0xdd, 0xde, 0xdf, 0xd9],
  CONNECT: 0xc2,
  CHECK_LINE: 0xd3,
  PRINT_STATUS: 0xb3,
  PRINTER_STATUS_DATA: 0xb5,
  PAGE_END: 0xe4,
  PRINT_END: 0xf4,
  PAGE_INDEX: 0xe0,
  PRINT_ERROR: 0xdb
});

function checksum(command, data) {
  const bytes = asUint8Array(data);
  let value = command ^ bytes.length;
  for (let index = 0; index < bytes.length; index += 1) {
    value ^= bytes[index];
  }
  return value & 0xff;
}

function encodePacket(command, data) {
  const payload = asUint8Array(data);
  if (payload.length > 0xff) {
    throw new Error('协议单帧数据不能超过 255 字节');
  }

  const frame = Uint8Array.from([
    0x55,
    0x55,
    command,
    payload.length,
    ...payload,
    checksum(command, payload),
    0xaa,
    0xaa
  ]);

  return command === COMMAND.CONNECT ? concatBytes([0x03], frame) : frame;
}

class PacketParser {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.errors = [];
  }

  reset() {
    this.buffer = new Uint8Array(0);
    this.errors = [];
  }

  push(chunk) {
    this.buffer = concatBytes(this.buffer, asUint8Array(chunk));
    const packets = [];

    while (this.buffer.length >= 2) {
      let headerIndex = -1;
      for (let index = 0; index < this.buffer.length - 1; index += 1) {
        if (this.buffer[index] === 0x55 && this.buffer[index + 1] === 0x55) {
          headerIndex = index;
          break;
        }
      }

      if (headerIndex < 0) {
        this.buffer = this.buffer[this.buffer.length - 1] === 0x55
          ? this.buffer.slice(this.buffer.length - 1)
          : new Uint8Array(0);
        break;
      }

      if (headerIndex > 0) {
        this.buffer = this.buffer.slice(headerIndex);
      }
      if (this.buffer.length < 7) {
        break;
      }

      const dataLength = this.buffer[3];
      const frameLength = dataLength + 7;
      if (this.buffer.length < frameLength) {
        break;
      }

      const frame = this.buffer.slice(0, frameLength);
      this.buffer = this.buffer.slice(frameLength);
      if (frame[frameLength - 2] !== 0xaa || frame[frameLength - 1] !== 0xaa) {
        this.errors.push(new Error('收到的协议帧尾无效'));
        this.buffer = concatBytes(frame.slice(1), this.buffer);
        continue;
      }

      const command = frame[2];
      const data = frame.slice(4, 4 + dataLength);
      const expected = checksum(command, data);
      if (frame[4 + dataLength] !== expected) {
        this.errors.push(new Error('收到的协议帧校验失败'));
        continue;
      }
      packets.push({ command, data, raw: frame });
    }

    return packets;
  }
}

module.exports = {
  COMMAND,
  RESPONSE,
  PacketParser,
  checksum,
  encodePacket
};
