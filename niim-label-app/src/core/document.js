let nextId = 1;

function makeId(prefix) {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

function createElement(type, document) {
  const width = document.widthMm;
  const height = document.heightMm;
  const common = {
    id: makeId(type),
    type,
    rotation: 0,
    locked: false,
    mirrorX: false,
    mirrorY: false
  };
  if (type === 'text') {
    return Object.assign(common, {
      x: 2,
      y: 1.5,
      width: Math.max(10, width - 4),
      height: Math.max(3, Math.min(7, (height - 3) * 0.48)),
      text: '双击编辑',
      fontSize: 4,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      reverse: false,
      align: 'left',
      verticalAlign: 'middle',
      direction: 'horizontal',
      letterSpacing: 0,
      lineSpacing: 0,
      autoFit: true,
      wordWrap: false,
      color: '#000000',
      fontFamily: 'sans-serif'
    });
  }
  if (type === 'barcode') {
    const barcodeHeight = Math.max(4, Math.min(8, (height - 2) * 0.48));
    return Object.assign(common, {
      x: 2,
      y: Math.max(1, height - barcodeHeight - 1),
      width: Math.max(14, width - 4),
      height: barcodeHeight,
      // Domestic default after add: value "0", Code128, human-readable bottom
      value: '0',
      format: 'code128',
      showText: true,
      textPosition: 'bottom',
      fontSize: 2.5,
      color: '#000000'
    });
  }
  if (type === 'qrcode') {
    const size = Math.max(8, Math.min(14, height - 2, width - 2));
    return Object.assign(common, {
      x: Math.max(1, width - size - 1),
      y: 1,
      width: size,
      height: size,
      value: 'https://example.com',
      errorCorrection: 'M',
      color: '#000000'
    });
  }
  if (type === 'rect') {
    return Object.assign(common, {
      x: 1,
      y: 1,
      width: Math.max(8, width - 2),
      height: Math.max(5, height - 2),
      lineWidth: 0.4,
      filled: false,
      dashed: false,
      shapeKind: 'rect',
      color: '#000000'
    });
  }
  if (type === 'line') {
    return Object.assign(common, {
      x: 2,
      y: height / 2,
      width: Math.max(8, width - 4),
      height: 1,
      lineWidth: 0.4,
      dashed: false,
      shapeKind: 'line',
      color: '#000000'
    });
  }
  if (type === 'image') {
    const size = Math.max(8, Math.min(15, height - 2, width - 2));
    return Object.assign(common, {
      x: 1,
      y: 1,
      width: size,
      height: size,
      path: '',
      threshold: 180
    });
  }
  if (type === 'date') {
    const now = new Date();
    return Object.assign(common, {
      x: 2,
      y: 1.5,
      width: Math.max(18, width - 4),
      height: Math.max(4.5, Math.min(7, height - 3)),
      // Domestic time element (截图: 制作日期 / 保质期至)
      dateRole: 'made', // made | expire | generic
      label: '制作日期',
      baseTime: now.toISOString(),
      autoUpdate: true,
      offsetDays: 0,
      offsetHours: 0,
      showTime: true,
      showSeconds: true,
      expireMode: 'preset', // preset | custom
      expirePresetHours: 24,
      format: 'YYYY年MM月DD日 HH:mm',
      fixedValue: '',
      fontSize: 3.2,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      reverse: false,
      align: 'left',
      verticalAlign: 'middle',
      direction: 'horizontal',
      letterSpacing: 0,
      lineSpacing: 0,
      autoFit: true,
      wordWrap: false,
      color: '#000000',
      fontFamily: 'sans-serif'
    });
  }
  if (type === 'serial') {
    return Object.assign(common, {
      x: 2,
      y: 1.5,
      width: Math.max(14, width - 4),
      height: Math.max(4, Math.min(7, height - 3)),
      // Video: bare "01" with empty prefix/suffix
      prefix: '',
      suffix: '',
      start: 1,
      step: 1,
      digits: 2,
      currentValue: null,
      fontSize: 4,
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      reverse: false,
      align: 'left',
      verticalAlign: 'middle',
      direction: 'horizontal',
      letterSpacing: 0,
      lineSpacing: 0,
      autoFit: true,
      wordWrap: false,
      color: '#000000',
      fontFamily: 'sans-serif'
    });
  }
  if (type === 'table') {
    const rows = 2;
    const columns = 2;
    return Object.assign(common, {
      x: 1,
      y: 1,
      width: Math.max(12, width - 2),
      height: Math.max(8, height - 2),
      rows,
      columns,
      cells: Array.from({ length: rows * columns }, (_, index) => index < columns ? `标题${index + 1}` : `内容${index - columns + 1}`),
      fontSize: 2.8,
      lineWidth: 0.3
    });
  }
  if (type === 'material') {
    const size = Math.max(6, Math.min(12, height - 2, width - 2));
    return Object.assign(common, {
      x: 1,
      y: 1,
      width: size,
      height: size,
      symbol: 'check',
      lineWidth: 0.55,
      color: '#000000'
    });
  }
  throw new Error(`不支持的元素类型：${type}`);
}

function createDocument(widthMm, heightMm) {
  const document = {
    schemaVersion: 1,
    name: '未命名标签',
    widthMm: widthMm || 40,
    heightMm: heightMm || 12,
    elements: []
  };
  document.elements.push(createElement('text', document));
  return document;
}

function cloneDocument(document) {
  return JSON.parse(JSON.stringify(document));
}

function clampElement(element, document) {
  const sourceWidth = Math.max(0.1, Number(element.width) || 1);
  const sourceHeight = Math.max(0.1, Number(element.height) || 1);
  const sourceCenterX = (Number(element.x) || 0) + sourceWidth / 2;
  const sourceCenterY = (Number(element.y) || 0) + sourceHeight / 2;
  element.rotation = ((Number(element.rotation) || 0) % 360 + 360) % 360;
  const angle = element.rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const projectedWidth = cosine * sourceWidth + sine * sourceHeight;
  const projectedHeight = sine * sourceWidth + cosine * sourceHeight;
  const scale = Math.min(1, document.widthMm / projectedWidth, document.heightMm / projectedHeight);
  element.width = sourceWidth * scale;
  element.height = sourceHeight * scale;
  const halfExtentX = (cosine * element.width + sine * element.height) / 2;
  const halfExtentY = (sine * element.width + cosine * element.height) / 2;
  const centerX = halfExtentX * 2 > document.widthMm
    ? document.widthMm / 2
    : Math.max(halfExtentX, Math.min(sourceCenterX, document.widthMm - halfExtentX));
  const centerY = halfExtentY * 2 > document.heightMm
    ? document.heightMm / 2
    : Math.max(halfExtentY, Math.min(sourceCenterY, document.heightMm - halfExtentY));
  element.x = centerX - element.width / 2;
  element.y = centerY - element.height / 2;
  return element;
}

function hitTest(document, xMm, yMm) {
  for (let index = document.elements.length - 1; index >= 0; index -= 1) {
    const element = document.elements[index];
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const angle = -(element.rotation || 0) * Math.PI / 180;
    const deltaX = xMm - centerX;
    const deltaY = yMm - centerY;
    const localX = deltaX * Math.cos(angle) - deltaY * Math.sin(angle);
    const localY = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
    if (Math.abs(localX) <= element.width / 2 && Math.abs(localY) <= element.height / 2) {
      return element;
    }
  }
  return null;
}

module.exports = {
  clampElement,
  cloneDocument,
  createDocument,
  createElement,
  hitTest
};
