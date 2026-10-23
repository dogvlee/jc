/**
 * 电脑「标签设计器」→ 手机的二维码（打印模板设计器网站 / 电脑版里点「发到手机」弹出的码）。
 *
 * 码的内容：`SYL1:` + base64( deflate-raw( UTF-8 JSON ) )，JSON 是
 *   { type: 'shangyue-label-template', v: 1, name, document }
 * document 就是本小程序的 LabelDocument（毫米坐标）。设计器那边省掉了跟 createElement 默认值一样的字段，
 * 导入时交给 normalizeDocument 按默认值补齐（跟导入 JSON 模板文件同一套规范化）。
 * 压缩 + base64 是为了码不太密、所有手机扫出来都是纯 ASCII（中文不会被扫码器按别的编码读坏）。
 *
 * 首页「扫码建标」扫到这种码时不按普通条码 / 二维码建标签，而是解开成模板导入。纯逻辑，可在 Node 里测。
 */
const inflate = require('../vendor/tiny-inflate');

const PREFIX = 'SYL1:';
const PAYLOAD_TYPE = 'shangyue-label-template';
const PAYLOAD_VERSION = 1;
// 最大的二维码（40-L）也装不下 3 KB 字节；留足余量，超过的一定不是设计器出的码
const MAX_CODE_LENGTH = 8192;
const MAX_JSON_BYTES = 256 * 1024;

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_MAP = (() => {
  const map = {};
  for (let index = 0; index < B64_CHARS.length; index += 1) map[B64_CHARS.charAt(index)] = index;
  return map;
})();

function codeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPcTemplateCode(text) {
  return typeof text === 'string' && text.trim().indexOf(PREFIX) === 0;
}

// 小程序没有 atob，自己解；base64url（- _）也认
function base64ToBytes(value) {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((text.length * 3) >> 2);
  let length = 0;
  let buffer = 0;
  let bits = 0;
  for (let index = 0; index < text.length; index += 1) {
    const digit = B64_MAP[text.charAt(index)];
    if (digit === undefined) continue;
    buffer = ((buffer << 6) | digit) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[length] = (buffer >> bits) & 0xff;
      length += 1;
    }
  }
  return out.subarray(0, length);
}

// 真机基础库里 TextDecoder 不一定有，手写 UTF-8 解码；坏字节直接判为码损坏
function bytesToUtf8(bytes) {
  let text = '';
  let index = 0;
  const count = bytes.length;
  const next = () => {
    if (index >= count) throw codeError('PC_CODE_CORRUPT', 'utf8');
    const value = bytes[index];
    index += 1;
    if ((value & 0xc0) !== 0x80) throw codeError('PC_CODE_CORRUPT', 'utf8');
    return value & 0x3f;
  };
  while (index < count) {
    const lead = bytes[index];
    index += 1;
    if (lead < 0x80) {
      text += String.fromCharCode(lead);
    } else if (lead >= 0xc2 && lead < 0xe0) {
      text += String.fromCharCode(((lead & 0x1f) << 6) | next());
    } else if (lead >= 0xe0 && lead < 0xf0) {
      text += String.fromCharCode(((lead & 0x0f) << 12) | (next() << 6) | next());
    } else if (lead >= 0xf0 && lead < 0xf5) {
      const point = (((lead & 0x07) << 18) | (next() << 12) | (next() << 6) | next()) - 0x10000;
      text += String.fromCharCode(0xd800 + (point >> 10), 0xdc00 + (point & 0x3ff));
    } else {
      throw codeError('PC_CODE_CORRUPT', 'utf8');
    }
  }
  return text;
}

/**
 * 扫到的文字 → { type, v, name, document }。
 * 解不开抛带 code 的错误（PC_CODE_CORRUPT / PC_CODE_TOO_NEW），message 是给用户看的中文。
 */
function decodePcTemplateCode(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!isPcTemplateCode(raw)) throw codeError('PC_CODE_NOT_TEMPLATE', '这不是电脑标签设计器发出的模板码');
  const corrupt = () => codeError('PC_CODE_CORRUPT', '模板码没扫完整或已损坏。请在电脑上点「放大二维码」后重新扫码，或改用「下载模板文件」发到手机导入。');
  if (raw.length > MAX_CODE_LENGTH) throw corrupt();
  let payload;
  try {
    const bytes = base64ToBytes(raw.slice(PREFIX.length));
    if (!bytes.length) throw corrupt();
    const json = bytesToUtf8(inflate(bytes, new Uint8Array(MAX_JSON_BYTES)));
    payload = JSON.parse(json);
  } catch (error) {
    throw corrupt();
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.type !== PAYLOAD_TYPE) throw corrupt();
  if (Number(payload.v) > PAYLOAD_VERSION) {
    throw codeError('PC_CODE_TOO_NEW', '这个模板码来自更新版本的标签设计器，请先更新小程序（右上角「···」→「重新进入小程序」）后再扫。');
  }
  if (!payload.document || typeof payload.document !== 'object' || Array.isArray(payload.document)) throw corrupt();
  return payload;
}

module.exports = {
  MAX_CODE_LENGTH,
  PAYLOAD_TYPE,
  PAYLOAD_VERSION,
  PREFIX,
  base64ToBytes,
  bytesToUtf8,
  decodePcTemplateCode,
  isPcTemplateCode
};
