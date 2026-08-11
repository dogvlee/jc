const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCsv, rowsToRecords, stringifyCsv } = require('../miniprogram/services/csv');

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
