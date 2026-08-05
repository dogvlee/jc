let nextId = 1;

function makeId(prefix) {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

function createElement(type, document) {
  const width = document.widthMm;
  const height = document.heightMm;
  const common = { id: makeId(type), type, rotation: 0 };
  if (type === 'text') {
    return Object.assign(common, {
      x: 2,
      y: 1.5,
      width: Math.max(10, width - 4),
      height: Math.min(7, height - 3),
      text: '标签文字',
      fontSize: 4,
      bold: false,
      align: 'left'
    });
  }
  if (type === 'barcode') {
    return Object.assign(common, {
      x: 2,
      y: Math.max(1, height - 8),
      width: Math.max(14, width - 4),
      height: Math.min(7, height - 2),
      value: '6901234567892',
      format: 'ean13',
      showText: true
    });
  }
  if (type === 'qrcode') {
    const size = Math.max(8, Math.min(14, height - 2, width - 2));
    return Object.assign(common, {
      x: Math.max(1, width - size - 1),
      y: 1,
      width: size,
      height: size,
      value: 'https://example.com'
    });
  }
  if (type === 'rect') {
    return Object.assign(common, {
      x: 1,
      y: 1,
      width: Math.max(8, width - 2),
      height: Math.max(5, height - 2),
      lineWidth: 0.35,
      filled: false
    });
  }
  if (type === 'line') {
    return Object.assign(common, {
      x: 2,
      y: height / 2,
      width: Math.max(8, width - 4),
      height: 1,
      lineWidth: 0.35
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
  element.width = Math.max(1, Math.min(Number(element.width) || 1, document.widthMm));
  element.height = Math.max(1, Math.min(Number(element.height) || 1, document.heightMm));
  element.x = Math.max(0, Math.min(Number(element.x) || 0, document.widthMm - element.width));
  element.y = Math.max(0, Math.min(Number(element.y) || 0, document.heightMm - element.height));
  element.rotation = ((Number(element.rotation) || 0) % 360 + 360) % 360;
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
