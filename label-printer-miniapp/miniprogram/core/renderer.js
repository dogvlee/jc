const qrcode = require('../vendor/qrcode');
const { encodeCode128B } = require('./code128');
const { encodeEan13 } = require('./ean13');

if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
}

function mmToDots(value, dpi) {
  return value * dpi / 25.4;
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  String(text || '').split('\n').forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    let current = '';
    Array.from(paragraph).forEach((character) => {
      const candidate = current + character;
      if (current && context.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    });
    lines.push(current);
  });
  return lines;
}

function fitText(context, element, width, height, dpi) {
  let fontPixels = Math.max(7, mmToDots(element.fontSize || 4, dpi));
  let lines = [];
  while (fontPixels >= 7) {
    context.font = `${element.bold ? 'bold ' : ''}${fontPixels}px sans-serif`;
    lines = wrapText(context, element.text, width);
    if (lines.length * fontPixels * 1.15 <= height) {
      break;
    }
    fontPixels -= 1;
  }
  return { fontPixels, lines };
}

function withElementTransform(context, element, dpi, draw) {
  const x = mmToDots(element.x, dpi);
  const y = mmToDots(element.y, dpi);
  const width = mmToDots(element.width, dpi);
  const height = mmToDots(element.height, dpi);
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((element.rotation || 0) * Math.PI / 180);
  draw(-width / 2, -height / 2, width, height);
  context.restore();
}

function drawText(context, element, dpi) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#000000';
    context.textBaseline = 'top';
    context.textAlign = element.align || 'left';
    const fitted = fitText(context, element, width, height, dpi);
    context.font = `${element.bold ? 'bold ' : ''}${fitted.fontPixels}px sans-serif`;
    const textX = element.align === 'center' ? x + width / 2 : element.align === 'right' ? x + width : x;
    fitted.lines.forEach((line, index) => {
      context.fillText(line, textX, y + index * fitted.fontPixels * 1.15, width);
    });
    context.restore();
  });
}

function drawBarcode(context, element, dpi) {
  let encoded;
  try {
    encoded = element.format === 'ean13' ? encodeEan13(element.value) : encodeCode128B(element.value);
  } catch (error) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const labelHeight = element.showText ? Math.min(mmToDots(2.4, dpi), height * 0.25) : 0;
    const barsHeight = height - labelHeight;
    const moduleWidth = width / encoded.moduleCount;
    let cursor = x;
    context.fillStyle = '#000000';
    if (encoded.bits) {
      encoded.bits.split('').forEach((bit) => {
        if (bit === '1') {
          context.fillRect(Math.round(cursor), y, Math.max(1, Math.round(cursor + moduleWidth) - Math.round(cursor)), barsHeight);
        }
        cursor += moduleWidth;
      });
    } else {
      cursor += moduleWidth * 10;
      encoded.patterns.forEach((pattern) => {
        let bar = true;
        pattern.split('').forEach((moduleCount) => {
          const partWidth = Number(moduleCount) * moduleWidth;
          const start = Math.round(cursor);
          const end = Math.round(cursor + partWidth);
          if (bar) {
            context.fillRect(start, y, Math.max(1, end - start), barsHeight);
          }
          cursor += partWidth;
          bar = !bar;
        });
      });
    }
    if (element.showText) {
      context.font = `${Math.max(7, labelHeight * 0.8)}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillText(encoded.text || String(element.value), x + width / 2, y + height, width);
    }
  });
}

function drawQrCode(context, element, dpi) {
  let code;
  try {
    code = qrcode(0, 'M');
    code.addData(String(element.value || ''), 'Byte');
    code.make();
  } catch (error) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    const modules = code.getModuleCount();
    const quietModules = 2;
    const scale = Math.floor(Math.min(width, height) / (modules + quietModules * 2));
    if (scale < 1) {
      return;
    }
    const drawSize = (modules + quietModules * 2) * scale;
    const startX = x + (width - drawSize) / 2 + quietModules * scale;
    const startY = y + (height - drawSize) / 2 + quietModules * scale;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#000000';
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (code.isDark(row, column)) {
          context.fillRect(startX + column * scale, startY + row * scale, scale, scale);
        }
      }
    }
    context.restore();
  });
}

function validateDocument(document, dpi) {
  document.elements.forEach((element) => {
    if (element.type === 'barcode') {
      const encoded = element.format === 'ean13' ? encodeEan13(element.value) : encodeCode128B(element.value);
      const availableDots = Math.floor(mmToDots(element.width, dpi));
      if (availableDots < encoded.moduleCount) {
        throw new Error(`条码元素过窄，当前内容至少需要 ${encoded.moduleCount} 个打印点`);
      }
    }
    if (element.type === 'qrcode') {
      const code = qrcode(0, 'M');
      code.addData(String(element.value || ''), 'Byte');
      code.make();
      const requiredDots = code.getModuleCount() + 4;
      const availableDots = Math.floor(Math.min(
        mmToDots(element.width, dpi),
        mmToDots(element.height, dpi)
      ));
      if (availableDots < requiredDots) {
        throw new Error(`二维码元素过小，当前内容至少需要 ${requiredDots} x ${requiredDots} 个打印点`);
      }
    }
  });
}

function drawShape(context, element, dpi) {
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    context.strokeStyle = '#000000';
    context.fillStyle = '#000000';
    context.lineWidth = Math.max(1, mmToDots(element.lineWidth || 0.35, dpi));
    if (element.type === 'line') {
      context.beginPath();
      context.moveTo(x, y + height / 2);
      context.lineTo(x + width, y + height / 2);
      context.stroke();
    } else if (element.filled) {
      context.fillRect(x, y, width, height);
    } else {
      context.strokeRect(x, y, width, height);
    }
  });
}

function drawImage(context, element, dpi, images) {
  const image = images && images[element.id];
  if (!image) {
    return;
  }
  withElementTransform(context, element, dpi, (x, y, width, height) => {
    context.drawImage(image, x, y, width, height);
  });
}

function renderDocument(context, document, canvasSize, dpi, images) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
  document.elements.forEach((element) => {
    if (element.type === 'text') {
      drawText(context, element, dpi);
    } else if (element.type === 'barcode') {
      drawBarcode(context, element, dpi);
    } else if (element.type === 'qrcode') {
      drawQrCode(context, element, dpi);
    } else if (element.type === 'rect' || element.type === 'line') {
      drawShape(context, element, dpi);
    } else if (element.type === 'image') {
      drawImage(context, element, dpi, images);
    }
  });
}

function renderSelection(context, selected, canvasSize, dpi) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  if (!selected) {
    return;
  }
  withElementTransform(context, selected, dpi, (x, y, width, height) => {
    context.strokeStyle = '#087f73';
    context.lineWidth = 1.5;
    context.setLineDash([5, 4]);
    context.strokeRect(x, y, width, height);
    context.setLineDash([]);
    context.fillStyle = '#087f73';
    const handle = Math.max(5, Math.min(9, dpi / 24));
    [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].forEach((point) => {
      context.fillRect(point[0] - handle / 2, point[1] - handle / 2, handle, handle);
    });
  });
}

module.exports = { mmToDots, renderDocument, renderSelection, validateDocument, wrapText };
