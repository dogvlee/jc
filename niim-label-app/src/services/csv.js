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

module.exports = { parseCsv, rowsToRecords, stringifyCsv };
