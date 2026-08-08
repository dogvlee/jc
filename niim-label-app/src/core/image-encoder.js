const { countBits, u16be } = require('./bytes');
const { COMMAND } = require('./protocol');

function isBlackPixel(imageData, x, y, threshold) {
  const index = (y * imageData.width + x) * 4;
  const alpha = imageData.data[index + 3] / 255;
  const red = imageData.data[index] * alpha + 255 * (1 - alpha);
  const green = imageData.data[index + 1] * alpha + 255 * (1 - alpha);
  const blue = imageData.data[index + 2] * alpha + 255 * (1 - alpha);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return luminance < threshold;
}

function sourceCoordinates(direction, imageData, row, column) {
  if (direction === 'left') {
    return {
      x: row,
      y: imageData.height - 1 - column
    };
  }
  return { x: column, y: row };
}

function sameBytes(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function encodeImageData(imageData, options) {
  const config = Object.assign({ direction: 'left', threshold: 180, checkEvery: 0 }, options);
  const columns = config.direction === 'left' ? imageData.height : imageData.width;
  const rows = config.direction === 'left' ? imageData.width : imageData.height;
  if (columns % 8 !== 0) {
    throw new Error('打印头方向的像素数必须是 8 的倍数');
  }

  const rowsData = [];
  for (let row = 0; row < rows; row += 1) {
    const rowData = new Uint8Array(columns / 8);
    let blackPixels = 0;
    for (let column = 0; column < columns; column += 1) {
      const source = sourceCoordinates(config.direction, imageData, row, column);
      if (isBlackPixel(imageData, source.x, source.y, config.threshold)) {
        rowData[Math.floor(column / 8)] |= 1 << (7 - (column % 8));
        blackPixels += 1;
      }
    }

    const dataType = blackPixels === 0 ? 'empty' : 'pixels';
    const previous = rowsData[rowsData.length - 1];
    const canRepeat = previous
      && previous.dataType === dataType
      && previous.repeat < 200
      && (dataType === 'empty' || sameBytes(previous.rowData, rowData));

    if (canRepeat) {
      previous.repeat += 1;
    } else {
      rowsData.push({
        dataType,
        rowNumber: row,
        repeat: 1,
        rowData: dataType === 'pixels' ? rowData : null,
        blackPixels
      });
    }

    if (config.checkEvery > 0 && (row + 1) % config.checkEvery === 0) {
      rowsData.push({ dataType: 'check', rowNumber: row, repeat: 0, rowData: null, blackPixels: 0 });
    }
  }

  return { columns, rows, rowsData };
}

function indexBlackPixels(rowData) {
  const indexes = [];
  for (let byteIndex = 0; byteIndex < rowData.length; byteIndex += 1) {
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      if (rowData[byteIndex] & (1 << (7 - bitIndex))) {
        indexes.push(...u16be(byteIndex * 8 + bitIndex));
      }
    }
  }
  return indexes;
}

function pixelCounts(rowData, printheadPixels, mode) {
  const total = rowData.reduce((count, byte) => count + countBits(byte), 0);
  if (mode === 'total') {
    const bytes = u16be(total);
    return [0, bytes[1], bytes[0]];
  }

  const chunkSize = Math.floor(printheadPixels / 8 / 3);
  if (chunkSize < 1 || rowData.length > chunkSize * 3) {
    const bytes = u16be(total);
    return [0, bytes[1], bytes[0]];
  }

  const counts = [0, 0, 0];
  rowData.forEach((byte, byteIndex) => {
    counts[Math.min(2, Math.floor(byteIndex / chunkSize))] += countBits(byte);
  });
  return counts;
}

function rowToCommand(row, options) {
  if (row.dataType === 'check') {
    return {
      command: COMMAND.CHECK_LINE,
      data: [...u16be(row.rowNumber), 1],
      expect: options.checkResponse
    };
  }
  if (row.dataType === 'empty') {
    return {
      command: COMMAND.PRINT_EMPTY_ROW,
      data: [...u16be(row.rowNumber), row.repeat],
      oneWay: true
    };
  }

  const counts = pixelCounts(row.rowData, options.printheadPixels, options.countsMode);
  if (row.blackPixels <= 6 && options.useIndexed !== false) {
    return {
      command: COMMAND.PRINT_ROW_INDEXED,
      data: [...u16be(row.rowNumber), ...counts, row.repeat, ...indexBlackPixels(row.rowData)],
      oneWay: true
    };
  }
  return {
    command: COMMAND.PRINT_BITMAP_ROW,
    data: [...u16be(row.rowNumber), ...counts, row.repeat, ...row.rowData],
    oneWay: true
  };
}

module.exports = {
  encodeImageData,
  indexBlackPixels,
  isBlackPixel,
  pixelCounts,
  rowToCommand
};
