const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DATA_HEADERS,
  parseCsv,
  parseDataCsv,
  rowsToRecords,
  stringifyCsv,
  stringifyDataCsv
} = require('../miniprogram/services/csv');

test('CSV parser preserves quoted commas, quotes, and newlines', () => {
  const source = 'name,code,price,date\r\n"样品, A","A""01",19.90,"2026-08-02\n上午"';
  const rows = parseCsv(source);
  assert.deepEqual(rows, [
    ['name', 'code', 'price', 'date'],
    ['样品, A', 'A"01', '19.90', '2026-08-02\n上午']
  ]);
});

test('CSV stringify round-trips structured records', () => {
  const rows = [['name', 'code'], ['样品 A', 'A,01'], ['"B"', 'B02']];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
  assert.deepEqual(rowsToRecords(rows, ['name', 'code']), [
    { name: '样品 A', code: 'A,01' },
    { name: '"B"', code: 'B02' }
  ]);
});

test('CSV parser rejects an unterminated quoted field', () => {
  assert.throws(() => parseCsv('name\n"open'), /引号未闭合/);
});

test('data export opens in Excel with Chinese intact: UTF-8 BOM and Chinese headers', () => {
  const text = stringifyDataCsv([
    { id: 'row-a', name: '青苹果, 大', code: 'A-01', price: '9.90', date: '2026-09-30' },
    { name: '香蕉' }
  ]);
  assert.equal(text.charCodeAt(0), 0xFEFF);
  assert.deepEqual(DATA_HEADERS, ['名称', '编码/条码', '价格', '日期']);
  assert.ok(text.startsWith('﻿名称,编码/条码,价格,日期\r\n'));
  assert.deepEqual(parseCsv(text).slice(1), [
    ['青苹果, 大', 'A-01', '9.90', '2026-09-30'],
    ['香蕉', '', '', '']
  ]);
});

test('long numeric barcodes stay text in Excel and come back unchanged', () => {
  const text = stringifyDataCsv([{ name: '牛奶', code: '6901234567892', price: '5', date: '' }]);
  assert.match(text, /\t6901234567892/, 'Excel would otherwise show 6.90123E+12');
  assert.equal(parseDataCsv(text).records[0].code, '6901234567892');
  const short = stringifyDataCsv([{ name: '箱子', code: 'BIN-01' }]);
  assert.doesNotMatch(short, /\t/);
});

test('an exported data file imports back to the same rows', () => {
  const rows = [
    { name: '样品 A', code: '6901234567892', price: '19.90', date: '2026-09-30' },
    { name: '含"引号"', code: 'A,01', price: '', date: '' }
  ];
  const parsed = parseDataCsv(stringifyDataCsv(rows));
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.records, rows);
});

test('import maps common header names in any order', () => {
  const parsed = parseDataCsv('售价,商品名称,生产日期,条码,备注\n9.9,青苹果,2026-09-01,6901234567892,不要\n5.5,香蕉,,BN-2001,');
  assert.equal(parsed.hasHeader, true);
  assert.deepEqual(parsed.records, [
    { name: '青苹果', code: '6901234567892', price: '9.9', date: '2026-09-01' },
    { name: '香蕉', code: 'BN-2001', price: '5.5', date: '' }
  ]);
  const english = parseDataCsv('Name, SKU ,PRICE,Date\n杯子,C-1,12,');
  assert.deepEqual(english.records, [{ name: '杯子', code: 'C-1', price: '12', date: '' }]);
  const aliases = parseDataCsv('品名,货号,零售价（元）,有效期\n毛巾,T-9,8,2027-01-01');
  assert.deepEqual(aliases.records, [{ name: '毛巾', code: 'T-9', price: '8', date: '2027-01-01' }]);
});

test('a file without a header row keeps its first row as data, read column by column', () => {
  const parsed = parseDataCsv('青苹果,6901234567892,9.9,2026-09-01\r\n香蕉,BN-2001,5.5,\r\n');
  assert.equal(parsed.hasHeader, false);
  assert.equal(parsed.records.length, 2);
  assert.deepEqual(parsed.records[0], { name: '青苹果', code: '6901234567892', price: '9.9', date: '2026-09-01' });
  // A product that happens to be called like a header is still data when the row holds numbers.
  const tricky = parseDataCsv('商品,6901234567892,9.9\n香蕉,BN-2001,5.5');
  assert.equal(tricky.hasHeader, false);
  assert.equal(tricky.records[0].name, '商品');
});

test('blank lines are skipped and cells are trimmed', () => {
  const parsed = parseDataCsv('﻿名称,价格\n\n  苹果  , 3 \n,\n');
  assert.deepEqual(parsed.records, [{ name: '苹果', code: '', price: '3', date: '' }]);
});

test('a file that is not UTF-8 asks to save it again as CSV UTF-8', () => {
  assert.throws(
    () => parseDataCsv('��,��\n1,2'),
    (error) => error.code === 'CSV_NOT_UTF8'
      && error.message === '文件编码不是 UTF-8。请在 Excel 里选择「另存为 → CSV UTF-8（逗号分隔）」后再导入。'
  );
});
