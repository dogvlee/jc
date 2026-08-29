const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ADVANCED_QR_TYPES,
  buildAdvancedQrPayload,
  normalizeAdvancedQrType,
  parseAdvancedQrPayload,
  utf8ByteLength,
  validateAdvancedQrData,
  validateAdvancedQrPayload
} = require('../src/core/advanced-qr');
const qrcode = require('../src/vendor/qrcode');

test('advanced QR exposes the seven supported editor scenarios and aliases', () => {
  assert.deepEqual(ADVANCED_QR_TYPES, ['text', 'url', 'wifi', 'contact', 'phone', 'sms', 'email']);
  assert.equal(normalizeAdvancedQrType('网址'), 'url');
  assert.equal(normalizeAdvancedQrType('vCard'), 'contact');
  assert.equal(normalizeAdvancedQrType('Wi-Fi'), 'wifi');
  assert.equal(normalizeAdvancedQrType('unknown'), null);
});

test('plain text keeps Unicode and whitespace without lossy encoding', () => {
  const payload = buildAdvancedQrPayload('text', { text: '  仓库 A-01\n请轻拿  ' });
  assert.equal(payload, '  仓库 A-01\n请轻拿  ');
  assert.deepEqual(parseAdvancedQrPayload(payload).data, { text: payload });
  assert.equal(utf8ByteLength('中A😊'), 8);
  assert.equal(validateAdvancedQrData('text', '   ').valid, false);
});

test('website payload supplies HTTPS and rejects unsafe or malformed schemes', () => {
  assert.equal(buildAdvancedQrPayload('website', 'example.com/orders?id=8'), 'https://example.com/orders?id=8');
  const parsed = parseAdvancedQrPayload('http://example.com/path');
  assert.equal(parsed.type, 'url');
  assert.equal(parsed.data.url, 'http://example.com/path');
  assert.equal(validateAdvancedQrData('url', 'javascript:alert(1)').errors[0].code, 'INVALID_URL');
  assert.throws(() => buildAdvancedQrPayload('url', 'http://'), (error) => {
    assert.equal(error.code, 'INVALID_URL');
    assert.equal(error.field, 'url');
    return true;
  });
});

test('Wi-Fi payload follows ZXing WIFI syntax and round-trips escaped delimiters', () => {
  const payload = buildAdvancedQrPayload('wifi', {
    ssid: 'Shop;Guest:5G',
    password: 'p\\a;ss,w:"d',
    security: 'WPA2',
    hidden: true
  });
  assert.equal(payload, 'WIFI:T:WPA;S:Shop\\;Guest\\:5G;P:p\\\\a\\;ss\\,w\\:\\"d;H:true;;');
  const parsed = parseAdvancedQrPayload(payload);
  assert.equal(parsed.type, 'wifi');
  assert.deepEqual(parsed.data, {
    ssid: 'Shop;Guest:5G',
    password: 'p\\a;ss,w:"d',
    security: 'WPA',
    hidden: true
  });
  assert.equal(buildAdvancedQrPayload('wifi', { ssid: '前台', security: 'open' }), 'WIFI:T:nopass;S:前台;H:false;;');
});

test('Wi-Fi validation checks required fields, security, password, and SSID byte limit', () => {
  assert.equal(validateAdvancedQrData('wifi', { security: 'WPA', password: '' }).valid, false);
  assert.equal(validateAdvancedQrData('wifi', { ssid: 'Cafe', security: 'magic', password: 'x' }).errors[0].code, 'INVALID_SECURITY');
  const tooLong = validateAdvancedQrData('wifi', { ssid: '一'.repeat(11), security: 'open' });
  assert.equal(tooLong.errors[0].code, 'TOO_LONG');
});

test('contact payload is a vCard 3.0 document and round-trips escaped content', () => {
  const payload = buildAdvancedQrPayload('contact', {
    firstName: '小明',
    lastName: '王',
    fullName: '王小明',
    organization: '商跃;标签',
    title: '采购',
    phones: ['+86 138-0013-8000', '010-88886666'],
    emails: ['ming@example.com', 'buy@example.com'],
    website: 'example.com',
    address: { street: '中心路 1 号', city: '深圳', region: '广东', postalCode: '518000', country: '中国' },
    note: '收货,验货\n周一至周五'
  });
  assert.match(payload, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(payload, /ORG:商跃\\;标签/);
  assert.match(payload, /NOTE:收货\\,验货\\n周一至周五/);
  assert.match(payload, /\r\nEND:VCARD$/);

  const parsed = parseAdvancedQrPayload(payload);
  assert.equal(parsed.type, 'contact');
  assert.equal(parsed.data.fullName, '王小明');
  assert.deepEqual(parsed.data.phones, ['+8613800138000', '01088886666']);
  assert.deepEqual(parsed.data.emails, ['ming@example.com', 'buy@example.com']);
  assert.equal(parsed.data.organization, '商跃;标签');
  assert.equal(parsed.data.address.city, '深圳');
  assert.equal(parsed.data.note, '收货,验货\n周一至周五');
});

test('contact parser accepts legacy MECARD payloads already used by templates', () => {
  const parsed = parseAdvancedQrPayload('MECARD:N:Doe,Jane;TEL:+12025550123;EMAIL:jane@example.com;;');
  assert.equal(parsed.type, 'contact');
  assert.equal(parsed.data.fullName, 'Jane Doe');
  assert.equal(parsed.data.phone, '+12025550123');
  assert.equal(parsed.data.email, 'jane@example.com');
});

test('contact validation requires a name and validates optional channels', () => {
  const validation = validateAdvancedQrData('contact', {
    name: '',
    phone: 'abc',
    email: 'not-an-email',
    url: 'ftp://example.com'
  });
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors.map((item) => item.code), [
    'REQUIRED', 'INVALID_PHONE', 'INVALID_EMAIL', 'INVALID_URL'
  ]);
});

test('phone payload normalizes visual separators and supports extensions', () => {
  const payload = buildAdvancedQrPayload('phone', { number: '+86 (138) 0013-8000 ext. 22' });
  assert.equal(payload, 'tel:+8613800138000;ext=22');
  assert.deepEqual(parseAdvancedQrPayload(payload).data, { number: '+8613800138000;ext=22' });
  assert.equal(validateAdvancedQrData('phone', '12').errors[0].code, 'INVALID_PHONE');
});

test('SMS uses SMSTO syntax and parser also accepts sms URI payloads', () => {
  const payload = buildAdvancedQrPayload('sms', { to: '+86 13800138000', body: '库存:已入库\nA-01' });
  assert.equal(payload, 'SMSTO:+8613800138000:库存:已入库\nA-01');
  assert.deepEqual(parseAdvancedQrPayload(payload).data, {
    number: '+8613800138000',
    message: '库存:已入库\nA-01'
  });
  assert.deepEqual(parseAdvancedQrPayload('sms:+12025550123?body=Hello%20world').data, {
    number: '+12025550123',
    message: 'Hello world'
  });
});

test('email uses mailto URI encoding and round-trips recipients and message', () => {
  const payload = buildAdvancedQrPayload('email', {
    to: 'sales@example.com',
    cc: ['store@example.com'],
    subject: '订单 #8',
    body: '请发货\n谢谢'
  });
  assert.equal(payload, 'mailto:sales@example.com?cc=store%40example.com&subject=%E8%AE%A2%E5%8D%95%20%238&body=%E8%AF%B7%E5%8F%91%E8%B4%A7%0A%E8%B0%A2%E8%B0%A2');
  const parsed = parseAdvancedQrPayload(payload);
  assert.equal(parsed.type, 'email');
  assert.equal(parsed.data.to, 'sales@example.com');
  assert.deepEqual(parsed.data.cc, ['store@example.com']);
  assert.equal(parsed.data.subject, '订单 #8');
  assert.equal(parsed.data.body, '请发货\n谢谢');
  assert.equal(validateAdvancedQrData('email', 'broken@').errors[0].code, 'INVALID_EMAIL');
});

test('email parser accepts MATMSG payloads emitted by other QR tools', () => {
  const parsed = parseAdvancedQrPayload('MATMSG:TO:hello@example.com;SUB:Hi;BODY:Meet at 10:00;;');
  assert.equal(parsed.type, 'email');
  assert.equal(parsed.data.to, 'hello@example.com');
  assert.equal(parsed.data.subject, 'Hi');
  assert.equal(parsed.data.body, 'Meet at 10:00');
});

test('payload validation detects an expected scenario mismatch', () => {
  assert.equal(validateAdvancedQrPayload('https://example.com', 'url').valid, true);
  const mismatch = validateAdvancedQrPayload('https://example.com', 'phone');
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.errors[0].code, 'TYPE_MISMATCH');
});

test('all generated scenario payloads are accepted by the existing UTF-8 QR encoder', () => {
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }
  const payloads = [
    buildAdvancedQrPayload('text', '文本'),
    buildAdvancedQrPayload('url', 'example.com'),
    buildAdvancedQrPayload('wifi', { ssid: 'Shop', password: 'secret', security: 'WPA' }),
    buildAdvancedQrPayload('contact', { name: '王小明', phone: '+8613800138000' }),
    buildAdvancedQrPayload('phone', '+8613800138000'),
    buildAdvancedQrPayload('sms', { number: '+8613800138000', message: '你好' }),
    buildAdvancedQrPayload('email', { to: 'hello@example.com', subject: '你好' })
  ];
  payloads.forEach((payload) => {
    const code = qrcode(0, 'M');
    code.addData(payload, 'Byte');
    assert.doesNotThrow(() => code.make());
    assert.ok(code.getModuleCount() > 0);
  });
});
