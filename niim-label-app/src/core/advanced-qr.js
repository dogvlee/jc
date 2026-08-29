/**
 * Structured content helpers for "advanced QR" editor forms.
 *
 * The renderer deliberately remains unaware of these shapes: callers build a
 * standards-based string and store it in an ordinary qrcode element's `value`.
 * This keeps saved documents and the print pipeline backwards compatible.
 */

const ADVANCED_QR_TYPES = Object.freeze([
  'text',
  'url',
  'wifi',
  'contact',
  'phone',
  'sms',
  'email'
]);

const TYPE_ALIASES = Object.freeze({
  text: 'text',
  plain: 'text',
  '文本': 'text',
  url: 'url',
  uri: 'url',
  web: 'url',
  website: 'url',
  '网址': 'url',
  wifi: 'wifi',
  'wi-fi': 'wifi',
  '无线': 'wifi',
  contact: 'contact',
  vcard: 'contact',
  mecard: 'contact',
  '联系人': 'contact',
  phone: 'phone',
  tel: 'phone',
  telephone: 'phone',
  '电话': 'phone',
  sms: 'sms',
  message: 'sms',
  '短信': 'sms',
  email: 'email',
  mail: 'email',
  mailto: 'email',
  '邮件': 'email'
});

function stringValue(value) {
  return value == null ? '' : String(value);
}

function firstValue(source, keys) {
  if (source == null || typeof source !== 'object' || Array.isArray(source)) return source;
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return '';
}

function normalizeAdvancedQrType(type) {
  const key = stringValue(type).trim().toLowerCase();
  return TYPE_ALIASES[key] || null;
}

function issue(field, code, message) {
  return { field, code, message };
}

function utf8ByteLength(value) {
  let bytes = 0;
  for (const character of Array.from(stringValue(value))) {
    const point = character.codePointAt(0);
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function normalizeUrl(value) {
  const text = stringValue(value).trim();
  if (!text) return '';
  return /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function isEmailAddress(value) {
  const text = stringValue(value).trim();
  return text.length <= 254
    && /^[^\s@<>,;:?&#]+@[^\s@<>,;:?&#]+\.[^\s@<>,;:?&#]+$/.test(text);
}

function normalizePhoneNumber(value) {
  const text = stringValue(value).trim();
  if (!text) return '';
  const extensionMatch = text.match(/(?:\s*(?:ext\.?|x|\u8f6c)\s*)(\d{1,10})$/i);
  const extension = extensionMatch ? extensionMatch[1] : '';
  const base = (extensionMatch ? text.slice(0, extensionMatch.index) : text)
    .replace(/[\s().-]/g, '');
  return extension ? `${base};ext=${extension}` : base;
}

function isPhoneNumber(value) {
  return /^\+?\d{3,20}(?:;ext=\d{1,10})?$/.test(stringValue(value));
}

function normalizeStringList(value) {
  const source = Array.isArray(value) ? value : stringValue(value).split(',');
  return source.map((item) => stringValue(item).trim()).filter(Boolean);
}

function normalizeWifiSecurity(value) {
  const text = stringValue(value || 'WPA').trim();
  const upper = text.toUpperCase().replace(/\s+/g, '');
  if (['', 'WPA', 'WPA2', 'WPA/WPA2', 'WPA-PSK', 'WPA2-PSK', 'WPA_PSK', 'WPA2_PSK'].includes(upper)) return 'WPA';
  if (['WPA3', 'WPA3-SAE', 'WPA3_SAE', 'SAE'].includes(upper)) return 'SAE';
  if (upper === 'WEP') return 'WEP';
  if (['NONE', 'OPEN', 'NOPASS', 'NO_PASS'].includes(upper)) return 'nopass';
  return upper;
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  return /^(?:1|true|yes|on)$/i.test(stringValue(value).trim());
}

function normalizeTextData(input) {
  return { text: stringValue(firstValue(input, ['text', 'value', 'content'])) };
}

function normalizeUrlData(input) {
  return { url: normalizeUrl(firstValue(input, ['url', 'value', 'website'])) };
}

function normalizeWifiData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : { ssid: input };
  return {
    ssid: stringValue(firstValue(source, ['ssid', 'name', 'network'])).trim(),
    password: stringValue(firstValue(source, ['password', 'pass', 'key'])),
    security: normalizeWifiSecurity(firstValue(source, ['security', 'encryption', 'type']) || 'WPA'),
    hidden: booleanValue(firstValue(source, ['hidden', 'isHidden']))
  };
}

function normalizeAddress(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    const street = stringValue(value).trim();
    return street ? { street, city: '', region: '', postalCode: '', country: '' } : null;
  }
  const address = {
    postOfficeBox: stringValue(value.postOfficeBox).trim(),
    extendedAddress: stringValue(value.extendedAddress).trim(),
    street: stringValue(firstValue(value, ['street', 'addressLine'])).trim(),
    city: stringValue(firstValue(value, ['city', 'locality'])).trim(),
    region: stringValue(firstValue(value, ['region', 'state', 'province'])).trim(),
    postalCode: stringValue(firstValue(value, ['postalCode', 'zip'])).trim(),
    country: stringValue(value.country).trim()
  };
  return Object.values(address).some(Boolean) ? address : null;
}

function normalizeContactData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : { fullName: input };
  const firstName = stringValue(firstValue(source, ['firstName', 'givenName'])).trim();
  const middleName = stringValue(source.middleName).trim();
  const lastName = stringValue(firstValue(source, ['lastName', 'familyName'])).trim();
  const prefix = stringValue(source.prefix).trim();
  const suffix = stringValue(source.suffix).trim();
  const derivedName = [prefix, firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  const phones = normalizeStringList(source.phones != null
    ? source.phones
    : firstValue(source, ['phone', 'telephone', 'tel'])).map(normalizePhoneNumber);
  const emails = normalizeStringList(source.emails != null
    ? source.emails
    : firstValue(source, ['email', 'mail']));
  return {
    fullName: stringValue(firstValue(source, ['fullName', 'name'])).trim() || derivedName,
    firstName,
    middleName,
    lastName,
    prefix,
    suffix,
    organization: stringValue(firstValue(source, ['organization', 'org', 'company'])).trim(),
    title: stringValue(firstValue(source, ['title', 'jobTitle'])).trim(),
    phone: phones[0] || '',
    phones,
    email: emails[0] || '',
    emails,
    url: normalizeUrl(firstValue(source, ['url', 'website'])),
    address: normalizeAddress(source.address),
    note: stringValue(source.note)
  };
}

function normalizePhoneData(input) {
  return { number: normalizePhoneNumber(firstValue(input, ['number', 'phone', 'tel', 'value'])) };
}

function normalizeSmsData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : { number: input };
  return {
    number: normalizePhoneNumber(firstValue(source, ['number', 'phone', 'tel', 'to'])),
    message: stringValue(firstValue(source, ['message', 'body', 'text', 'content']))
  };
}

function normalizeEmailData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : { to: input };
  const recipients = normalizeStringList(source.recipients != null
    ? source.recipients
    : firstValue(source, ['to', 'email', 'address']));
  return {
    to: recipients[0] || '',
    email: recipients[0] || '',
    recipients,
    cc: normalizeStringList(source.cc),
    bcc: normalizeStringList(source.bcc),
    subject: stringValue(source.subject),
    body: stringValue(firstValue(source, ['body', 'message', 'content']))
  };
}

function normalizeAdvancedQrData(type, input) {
  const normalizedType = normalizeAdvancedQrType(type);
  if (normalizedType === 'text') return normalizeTextData(input);
  if (normalizedType === 'url') return normalizeUrlData(input);
  if (normalizedType === 'wifi') return normalizeWifiData(input);
  if (normalizedType === 'contact') return normalizeContactData(input);
  if (normalizedType === 'phone') return normalizePhoneData(input);
  if (normalizedType === 'sms') return normalizeSmsData(input);
  if (normalizedType === 'email') return normalizeEmailData(input);
  return {};
}

function validateAdvancedQrData(type, input) {
  const normalizedType = normalizeAdvancedQrType(type);
  const data = normalizeAdvancedQrData(normalizedType, input);
  const errors = [];
  if (!normalizedType) {
    errors.push(issue('type', 'UNSUPPORTED_TYPE', `不支持的高级二维码类型：${stringValue(type) || '空'}`));
  } else if (normalizedType === 'text') {
    if (!data.text.trim()) errors.push(issue('text', 'REQUIRED', '请输入文本内容'));
  } else if (normalizedType === 'url') {
    if (!data.url) errors.push(issue('url', 'REQUIRED', '请输入网址'));
    else if (!isHttpUrl(data.url)) errors.push(issue('url', 'INVALID_URL', '网址必须是有效的 HTTP 或 HTTPS 地址'));
  } else if (normalizedType === 'wifi') {
    if (!data.ssid) errors.push(issue('ssid', 'REQUIRED', '请输入 Wi-Fi 名称'));
    else if (utf8ByteLength(data.ssid) > 32) errors.push(issue('ssid', 'TOO_LONG', 'Wi-Fi 名称不能超过 32 字节'));
    if (!['WPA', 'SAE', 'WEP', 'nopass'].includes(data.security)) {
      errors.push(issue('security', 'INVALID_SECURITY', 'Wi-Fi 加密类型仅支持 WPA、WPA3/SAE、WEP 或开放网络'));
    }
    if (data.security !== 'nopass' && !data.password) errors.push(issue('password', 'REQUIRED', '加密 Wi-Fi 必须填写密码'));
  } else if (normalizedType === 'contact') {
    if (!data.fullName) errors.push(issue('fullName', 'REQUIRED', '请输入联系人姓名'));
    data.phones.forEach((phone, index) => {
      if (!isPhoneNumber(phone)) errors.push(issue(`phones.${index}`, 'INVALID_PHONE', '联系人电话格式不正确'));
    });
    data.emails.forEach((email, index) => {
      if (!isEmailAddress(email)) errors.push(issue(`emails.${index}`, 'INVALID_EMAIL', '联系人邮箱格式不正确'));
    });
    if (data.url && !isHttpUrl(data.url)) errors.push(issue('url', 'INVALID_URL', '联系人网址格式不正确'));
  } else if (normalizedType === 'phone') {
    if (!data.number) errors.push(issue('number', 'REQUIRED', '请输入电话号码'));
    else if (!isPhoneNumber(data.number)) errors.push(issue('number', 'INVALID_PHONE', '电话号码格式不正确'));
  } else if (normalizedType === 'sms') {
    if (!data.number) errors.push(issue('number', 'REQUIRED', '请输入短信收件人号码'));
    else if (!isPhoneNumber(data.number)) errors.push(issue('number', 'INVALID_PHONE', '短信收件人号码格式不正确'));
  } else if (normalizedType === 'email') {
    if (!data.recipients.length) errors.push(issue('to', 'REQUIRED', '请输入收件人邮箱'));
    data.recipients.forEach((email, index) => {
      if (!isEmailAddress(email)) errors.push(issue(`recipients.${index}`, 'INVALID_EMAIL', '收件人邮箱格式不正确'));
    });
    data.cc.forEach((email, index) => {
      if (!isEmailAddress(email)) errors.push(issue(`cc.${index}`, 'INVALID_EMAIL', '抄送邮箱格式不正确'));
    });
    data.bcc.forEach((email, index) => {
      if (!isEmailAddress(email)) errors.push(issue(`bcc.${index}`, 'INVALID_EMAIL', '密送邮箱格式不正确'));
    });
  }
  return {
    valid: errors.length === 0,
    type: normalizedType,
    data,
    errors,
    messages: errors.map((item) => item.message)
  };
}

function escapeWifiValue(value) {
  return stringValue(value).replace(/([\\;,:"])/g, '\\$1');
}

function unescapeWifiValue(value) {
  let output = '';
  const text = stringValue(value);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\' && index + 1 < text.length) {
      output += text[index + 1];
      index += 1;
    } else {
      output += text[index];
    }
  }
  return output;
}

function escapeVCardValue(value) {
  return stringValue(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function unescapeVCardValue(value) {
  let output = '';
  const text = stringValue(value);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\\' || index + 1 >= text.length) {
      output += text[index];
      continue;
    }
    const next = text[index + 1];
    output += next === 'n' || next === 'N' ? '\n' : next;
    index += 1;
  }
  return output;
}

function splitEscaped(value, delimiter) {
  const result = [];
  let current = '';
  const text = stringValue(value);
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\\' && index + 1 < text.length) {
      current += character + text[index + 1];
      index += 1;
    } else if (character === delimiter) {
      result.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  result.push(current);
  return result;
}

function indexOfUnescaped(value, character) {
  const text = stringValue(value);
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1;
    else if (text[index] === character) return index;
  }
  return -1;
}

function parseDelimitedFields(value) {
  const fields = {};
  splitEscaped(value, ';').forEach((part) => {
    const separator = indexOfUnescaped(part, ':');
    if (separator < 0) return;
    const key = part.slice(0, separator).trim().toUpperCase();
    if (key) fields[key] = unescapeWifiValue(part.slice(separator + 1));
  });
  return fields;
}

function buildWifiPayload(data) {
  const fields = [
    `T:${data.security}`,
    `S:${escapeWifiValue(data.ssid)}`
  ];
  if (data.security !== 'nopass') fields.push(`P:${escapeWifiValue(data.password)}`);
  fields.push(`H:${data.hidden ? 'true' : 'false'}`);
  return `WIFI:${fields.join(';')};;`;
}

function buildContactPayload(data) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${[data.lastName, data.firstName, data.middleName, data.prefix, data.suffix].map(escapeVCardValue).join(';')}`,
    `FN:${escapeVCardValue(data.fullName)}`
  ];
  if (data.organization) lines.push(`ORG:${escapeVCardValue(data.organization)}`);
  if (data.title) lines.push(`TITLE:${escapeVCardValue(data.title)}`);
  data.phones.forEach((phone) => lines.push(`TEL;TYPE=CELL:${escapeVCardValue(phone)}`));
  data.emails.forEach((email) => lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(email)}`));
  if (data.url) lines.push(`URL:${escapeVCardValue(data.url)}`);
  if (data.address) {
    const address = data.address;
    lines.push(`ADR;TYPE=WORK:${[
      address.postOfficeBox,
      address.extendedAddress,
      address.street,
      address.city,
      address.region,
      address.postalCode,
      address.country
    ].map(escapeVCardValue).join(';')}`);
  }
  if (data.note) lines.push(`NOTE:${escapeVCardValue(data.note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function addQueryValue(values, key, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
  const text = Array.isArray(value) ? value.join(',') : stringValue(value);
  values.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
}

function buildEmailPayload(data) {
  const query = [];
  addQueryValue(query, 'cc', data.cc);
  addQueryValue(query, 'bcc', data.bcc);
  addQueryValue(query, 'subject', data.subject);
  addQueryValue(query, 'body', data.body);
  return `mailto:${data.recipients.join(',')}${query.length ? `?${query.join('&')}` : ''}`;
}

function invalidDataError(validation) {
  const first = validation.errors[0];
  const error = new Error(first ? first.message : '高级二维码内容无效');
  error.code = first ? first.code : 'INVALID_ADVANCED_QR_DATA';
  error.field = first ? first.field : '';
  error.validation = validation;
  return error;
}

function buildAdvancedQrPayload(type, input) {
  const validation = validateAdvancedQrData(type, input);
  if (!validation.valid) throw invalidDataError(validation);
  const data = validation.data;
  if (validation.type === 'text') return data.text;
  if (validation.type === 'url') return data.url;
  if (validation.type === 'wifi') return buildWifiPayload(data);
  if (validation.type === 'contact') return buildContactPayload(data);
  if (validation.type === 'phone') return `tel:${data.number}`;
  if (validation.type === 'sms') return `SMSTO:${data.number}:${data.message}`;
  if (validation.type === 'email') return buildEmailPayload(data);
  throw invalidDataError(validation);
}

function safePercentDecode(value) {
  try {
    return decodeURIComponent(stringValue(value));
  } catch (error) {
    return stringValue(value);
  }
}

function safeQueryDecode(value) {
  return safePercentDecode(stringValue(value).replace(/\+/g, ' '));
}

function parseQuery(value) {
  const query = {};
  stringValue(value).split('&').forEach((part) => {
    if (!part) return;
    const separator = part.indexOf('=');
    const key = safeQueryDecode(separator < 0 ? part : part.slice(0, separator)).toLowerCase();
    const content = safeQueryDecode(separator < 0 ? '' : part.slice(separator + 1));
    if (key) query[key] = content;
  });
  return query;
}

function parseWifiPayload(payload) {
  const fields = parseDelimitedFields(payload.slice(5));
  return normalizeWifiData({
    ssid: fields.S || '',
    password: fields.P || '',
    security: fields.T || 'nopass',
    hidden: fields.H || false
  });
}

function parseVCardPayload(payload) {
  const unfolded = stringValue(payload).replace(/(?:\r\n|\n|\r)[ \t]/g, '');
  const result = {
    phones: [],
    emails: []
  };
  unfolded.split(/\r\n|\n|\r/).forEach((line) => {
    const separator = indexOfUnescaped(line, ':');
    if (separator < 0) return;
    const header = line.slice(0, separator);
    const name = header.split(';')[0].toUpperCase();
    const rawValue = line.slice(separator + 1);
    if (name === 'N') {
      const parts = splitEscaped(rawValue, ';').map(unescapeVCardValue);
      result.lastName = parts[0] || '';
      result.firstName = parts[1] || '';
      result.middleName = parts[2] || '';
      result.prefix = parts[3] || '';
      result.suffix = parts[4] || '';
    } else if (name === 'FN') result.fullName = unescapeVCardValue(rawValue);
    else if (name === 'ORG') result.organization = splitEscaped(rawValue, ';').map(unescapeVCardValue).join(' / ');
    else if (name === 'TITLE') result.title = unescapeVCardValue(rawValue);
    else if (name === 'TEL') result.phones.push(unescapeVCardValue(rawValue).replace(/^tel:/i, ''));
    else if (name === 'EMAIL') result.emails.push(unescapeVCardValue(rawValue));
    else if (name === 'URL') result.url = unescapeVCardValue(rawValue);
    else if (name === 'NOTE') result.note = unescapeVCardValue(rawValue);
    else if (name === 'ADR') {
      const parts = splitEscaped(rawValue, ';').map(unescapeVCardValue);
      result.address = {
        postOfficeBox: parts[0] || '',
        extendedAddress: parts[1] || '',
        street: parts[2] || '',
        city: parts[3] || '',
        region: parts[4] || '',
        postalCode: parts[5] || '',
        country: parts[6] || ''
      };
    }
  });
  return normalizeContactData(result);
}

function parseMeCardPayload(payload) {
  const fields = parseDelimitedFields(payload.slice(7));
  const nameParts = stringValue(fields.N).split(',');
  return normalizeContactData({
    fullName: nameParts.filter(Boolean).reverse().join(' ') || fields.N || '',
    firstName: nameParts[1] || '',
    lastName: nameParts[0] || '',
    phone: fields.TEL || '',
    email: fields.EMAIL || '',
    address: fields.ADR || '',
    url: fields.URL || '',
    note: fields.NOTE || ''
  });
}

function parseSmsPayload(payload) {
  if (/^SMSTO:/i.test(payload)) {
    const content = payload.slice(6);
    const separator = content.indexOf(':');
    return normalizeSmsData({
      number: separator < 0 ? content : content.slice(0, separator),
      message: separator < 0 ? '' : content.slice(separator + 1)
    });
  }
  const content = payload.slice(payload.indexOf(':') + 1);
  const separator = content.indexOf('?');
  const number = safePercentDecode(separator < 0 ? content : content.slice(0, separator));
  const query = parseQuery(separator < 0 ? '' : content.slice(separator + 1));
  return normalizeSmsData({ number, message: query.body || '' });
}

function parseEmailPayload(payload) {
  if (/^MATMSG:/i.test(payload)) {
    const fields = parseDelimitedFields(payload.slice(7));
    return normalizeEmailData({ to: fields.TO || '', subject: fields.SUB || '', body: fields.BODY || '' });
  }
  const content = payload.slice(payload.indexOf(':') + 1);
  const separator = content.indexOf('?');
  const recipients = (separator < 0 ? content : content.slice(0, separator)).split(',').map(safePercentDecode);
  const query = parseQuery(separator < 0 ? '' : content.slice(separator + 1));
  return normalizeEmailData({
    recipients,
    cc: query.cc || '',
    bcc: query.bcc || '',
    subject: query.subject || '',
    body: query.body || ''
  });
}

function parseAdvancedQrPayload(payload) {
  const original = stringValue(payload);
  const candidate = original.trim();
  if (/^WIFI:/i.test(candidate)) return { type: 'wifi', data: parseWifiPayload(candidate), payload: original };
  if (/^BEGIN:VCARD(?:\r\n|\n|\r)/i.test(candidate)) {
    return { type: 'contact', data: parseVCardPayload(candidate), payload: original };
  }
  if (/^MECARD:/i.test(candidate)) return { type: 'contact', data: parseMeCardPayload(candidate), payload: original };
  if (/^TEL:/i.test(candidate)) {
    return { type: 'phone', data: normalizePhoneData(safePercentDecode(candidate.slice(4))), payload: original };
  }
  if (/^(?:SMSTO|SMS):/i.test(candidate)) {
    return { type: 'sms', data: parseSmsPayload(candidate), payload: original };
  }
  if (/^(?:MAILTO|MATMSG):/i.test(candidate)) {
    return { type: 'email', data: parseEmailPayload(candidate), payload: original };
  }
  if (/^https?:\/\//i.test(candidate)) {
    return { type: 'url', data: normalizeUrlData(candidate), payload: original };
  }
  return { type: 'text', data: normalizeTextData(original), payload: original };
}

function validateAdvancedQrPayload(payload, expectedType) {
  const parsed = parseAdvancedQrPayload(payload);
  const validation = validateAdvancedQrData(parsed.type, parsed.data);
  const expected = expectedType == null ? null : normalizeAdvancedQrType(expectedType);
  const errors = validation.errors.slice();
  if (expectedType != null && !expected) {
    errors.unshift(issue('type', 'UNSUPPORTED_TYPE', `不支持的高级二维码类型：${stringValue(expectedType)}`));
  } else if (expected && parsed.type !== expected) {
    errors.unshift(issue('type', 'TYPE_MISMATCH', `二维码内容类型为 ${parsed.type}，期望 ${expected}`));
  }
  return {
    valid: errors.length === 0,
    type: parsed.type,
    data: validation.data,
    payload: parsed.payload,
    errors,
    messages: errors.map((item) => item.message)
  };
}

module.exports = {
  ADVANCED_QR_TYPES,
  buildAdvancedQrPayload,
  normalizeAdvancedQrData,
  normalizeAdvancedQrType,
  parseAdvancedQrPayload,
  utf8ByteLength,
  validateAdvancedQrData,
  validateAdvancedQrPayload
};
