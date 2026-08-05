const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encodeImageData,
  indexBlackPixels,
  pixelCounts,
  rowToCommand
} = require('../miniprogram/core/image-encoder');
const { COMMAND, RESPONSE } = require('../miniprogram/core/protocol');

function makeImage(width, height, blackPixels) {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  for (const [x, y] of blackPixels || []) {
    const offset = (y * width + x) * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 255;
  }
  return { width, height, data };
}

function summarizeRows(rowsData) {
  return rowsData.map((row) => ({
    dataType: row.dataType,
    rowNumber: row.rowNumber,
    repeat: row.repeat,
    rowData: row.rowData ? Array.from(row.rowData) : null,
    blackPixels: row.blackPixels
  }));
}

test('top direction packs rows from left to right and RLE-compresses equal rows', () => {
  const image = makeImage(8, 4, [
    [0, 0], [7, 0],
    [0, 1], [7, 1]
  ]);
  const encoded = encodeImageData(image, { direction: 'top' });

  assert.equal(encoded.columns, 8);
  assert.equal(encoded.rows, 4);
  assert.deepEqual(summarizeRows(encoded.rowsData), [
    { dataType: 'pixels', rowNumber: 0, repeat: 2, rowData: [0x81], blackPixels: 2 },
    { dataType: 'empty', rowNumber: 2, repeat: 2, rowData: null, blackPixels: 0 }
  ]);
});

test('left direction rotates the source clockwise into print rows', () => {
  const image = makeImage(2, 8, [
    [0, 7], [0, 0],
    [1, 6]
  ]);
  const encoded = encodeImageData(image, { direction: 'left' });

  assert.equal(encoded.columns, 8);
  assert.equal(encoded.rows, 2);
  assert.deepEqual(summarizeRows(encoded.rowsData), [
    { dataType: 'pixels', rowNumber: 0, repeat: 1, rowData: [0x81], blackPixels: 2 },
    { dataType: 'pixels', rowNumber: 1, repeat: 1, rowData: [0x40], blackPixels: 1 }
  ]);
});

test('RLE stops at 200 rows and check rows split runs at configured intervals', () => {
  const longRun = encodeImageData(makeImage(8, 257), { direction: 'top' });
  assert.deepEqual(summarizeRows(longRun.rowsData), [
    { dataType: 'empty', rowNumber: 0, repeat: 200, rowData: null, blackPixels: 0 },
    { dataType: 'empty', rowNumber: 200, repeat: 57, rowData: null, blackPixels: 0 }
  ]);

  const checked = encodeImageData(makeImage(8, 4), {
    direction: 'top',
    checkEvery: 2
  });
  assert.deepEqual(summarizeRows(checked.rowsData), [
    { dataType: 'empty', rowNumber: 0, repeat: 2, rowData: null, blackPixels: 0 },
    { dataType: 'check', rowNumber: 1, repeat: 0, rowData: null, blackPixels: 0 },
    { dataType: 'empty', rowNumber: 2, repeat: 2, rowData: null, blackPixels: 0 },
    { dataType: 'check', rowNumber: 3, repeat: 0, rowData: null, blackPixels: 0 }
  ]);
});

test('encodeImageData rejects a non-byte-aligned printhead axis', () => {
  assert.throws(() => encodeImageData(makeImage(7, 1), { direction: 'top' }));
  assert.throws(() => encodeImageData(makeImage(1, 7), { direction: 'left' }));
});

test('row helpers emit indexed, bitmap, empty, and check command payloads', () => {
  assert.deepEqual(indexBlackPixels(Uint8Array.from([0x81, 0x40])), [
    0x00, 0x00,
    0x00, 0x07,
    0x00, 0x09
  ]);
  assert.deepEqual(pixelCounts(Uint8Array.from([0xff, 0x0f, 0x80]), 24, 'auto'), [8, 4, 1]);
  assert.deepEqual(pixelCounts(Uint8Array.from([0xff, 0x0f, 0x80]), 24, 'total'), [0, 13, 0]);

  assert.deepEqual(rowToCommand({
    dataType: 'pixels',
    rowNumber: 0x0123,
    repeat: 2,
    rowData: Uint8Array.from([0x81, 0x40]),
    blackPixels: 3
  }, { printheadPixels: 16, countsMode: 'auto' }), {
    command: COMMAND.PRINT_ROW_INDEXED,
    data: [0x01, 0x23, 0, 3, 0, 2, 0, 0, 0, 7, 0, 9],
    oneWay: true
  });

  assert.deepEqual(rowToCommand({
    dataType: 'pixels',
    rowNumber: 2,
    repeat: 1,
    rowData: Uint8Array.from([0xff, 0x0f, 0x80]),
    blackPixels: 13
  }, { printheadPixels: 24, countsMode: 'auto' }), {
    command: COMMAND.PRINT_BITMAP_ROW,
    data: [0, 2, 8, 4, 1, 1, 0xff, 0x0f, 0x80],
    oneWay: true
  });

  assert.deepEqual(rowToCommand({
    dataType: 'empty',
    rowNumber: 9,
    repeat: 4
  }, {}), {
    command: COMMAND.PRINT_EMPTY_ROW,
    data: [0, 9, 4],
    oneWay: true
  });

  assert.deepEqual(rowToCommand({
    dataType: 'check',
    rowNumber: 0x0201
  }, { checkResponse: RESPONSE.CHECK_LINE }), {
    command: COMMAND.CHECK_LINE,
    data: [0x02, 0x01, 1],
    expect: RESPONSE.CHECK_LINE
  });
});
