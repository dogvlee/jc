const { BATCH_FIELDS } = require('../core/data-fields');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const text = String(input || '').replace(/^\uFEFF/, '');

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new Error('CSV 引号未闭合');
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeField(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stringifyCsv(rows) {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

function rowsToRecords(rows, expectedColumns) {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value || '').trim());
  const mapping = expectedColumns.map((column, index) => {
    const found = headers.indexOf(column);
    return found >= 0 ? found : index;
  });
  return rows.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row) => {
    const record = {};
    expectedColumns.forEach((column, index) => {
      record[column] = row[mapping[index]] == null ? '' : row[mapping[index]];
    });
    return record;
  });
}

// Batch data table columns (one source: core/data-fields.js) and the headers
// export writes for them.
const DATA_COLUMNS = BATCH_FIELDS;
const DATA_HEADERS = ['名称', '编码/条码', '价格', '日期'];
// Header names seen in shop spreadsheets, compared without case, spaces or a
// trailing unit such as “（元）”.
const HEADER_ALIASES = {
  name: ['名称', 'name', '品名', '商品名称', '商品名', '商品', '产品名称', '产品', '名字', '姓名'],
  code: ['编码/条码', 'code', '编码', '条码', '条形码', '商品条码', '商品编码', 'sku', '货号', '编号', 'barcode'],
  price: ['价格', 'price', '售价', '单价', '零售价', '销售价', '价钱'],
  date: ['日期', 'date', '生产日期', '有效期', '有效期至', '到期日', '到期日期']
};
const MAX_FIELD_LENGTH = 256;
const NOT_UTF8_MESSAGE = '文件编码不是 UTF-8。请在 Excel 里选择「另存为 → CSV UTF-8（逗号分隔）」后再导入。';

function headerKey(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/／/g, '/')
    .replace(/[（(][^（()）]*[)）]$/, '');
}

const ALIAS_COLUMNS = new Map();
DATA_COLUMNS.forEach((column) => {
  HEADER_ALIASES[column].forEach((alias) => ALIAS_COLUMNS.set(headerKey(alias), column));
});

// Prices, codes and dates: a row holding one of these is data, not headers.
function looksLikeValue(cell) {
  return /^[¥￥]?\s*\d[\d\s.,:/-]*$/.test(String(cell == null ? '' : cell).trim());
}

function cellText(row, index) {
  if (index < 0 || row[index] == null) return '';
  return String(row[index]).trim().slice(0, MAX_FIELD_LENGTH);
}

/**
 * Batch data rows ({ name, code, price, date }) from CSV text. Headers are
 * matched by common names in any order; a first row that names no column is
 * data, read column by column. Blank lines are skipped. Throws code
 * 'CSV_NOT_UTF8' for text that was not saved as UTF-8 (Excel's plain “CSV”
 * on Chinese Windows), since reading it as UTF-8 leaves U+FFFD behind.
 */
function parseDataCsv(input) {
  const text = String(input == null ? '' : input);
  if (text.includes('�')) {
    const error = new Error(NOT_UTF8_MESSAGE);
    error.code = 'CSV_NOT_UTF8';
    throw error;
  }
  const rows = parseCsv(text);
  const first = rows[0] || [];
  const named = first.map((cell) => ALIAS_COLUMNS.get(headerKey(cell)) || '');
  const hasHeader = named.some(Boolean) && !first.some(looksLikeValue);
  const positions = DATA_COLUMNS.map((column, index) => (hasHeader ? named.indexOf(column) : index));
  const records = (hasHeader ? rows.slice(1) : rows)
    .map((row) => {
      const record = {};
      DATA_COLUMNS.forEach((column, index) => { record[column] = cellText(row, positions[index]); });
      return record;
    })
    .filter((record) => DATA_COLUMNS.some((column) => record[column]));
  return { records, hasHeader };
}

// Excel shows 12+ digit numbers as 6.90123E+12 and drops leading zeros, and
// saving the sheet keeps only what it shows. A leading tab keeps such codes
// as text; import trims it off again.
function excelSafeCode(value) {
  const text = String(value == null ? '' : value);
  return /^\d+$/.test(text) && (text.length >= 12 || text.charAt(0) === '0') ? `\t${text}` : text;
}

/**
 * Row numbers (1-based) whose code Excel already turned into scientific
 * notation, such as 6.90123E+12. The digits behind it are lost, so these rows
 * would print a wrong barcode.
 */
function findExcelDamagedCodes(records) {
  const rows = [];
  (Array.isArray(records) ? records : []).forEach((record, index) => {
    const code = String(record && record.code != null ? record.code : '').trim();
    // Excel always writes the sign (E+12), so a code such as 1E5 stays a code.
    if (/^[+-]?\d+(?:[.,]\d+)?e[+-]\d+$/i.test(code)) rows.push(index + 1);
  });
  return rows;
}

/** Batch data as CSV for Excel: UTF-8 BOM, Chinese headers, CRLF lines. */
function stringifyDataCsv(records) {
  const rows = (Array.isArray(records) ? records : []).map((record) => DATA_COLUMNS.map((column) => {
    const value = record && record[column] != null ? record[column] : '';
    return column === 'code' ? excelSafeCode(value) : value;
  }));
  return `\uFEFF${stringifyCsv([DATA_HEADERS].concat(rows))}`;
}

module.exports = {
  DATA_COLUMNS,
  DATA_HEADERS,
  findExcelDamagedCodes,
  parseCsv,
  parseDataCsv,
  rowsToRecords,
  stringifyCsv,
  stringifyDataCsv
};
