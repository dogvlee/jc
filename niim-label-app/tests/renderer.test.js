const assert = require('node:assert/strict');
const test = require('node:test');

const qrcode = require('../src/vendor/qrcode');
const {
  binarizeImageData,
  fitText,
  renderDocument,
  validateDocument
} = require('../src/core/renderer');

function fontPixels(context) {
  const match = /([\d.]+)px/.exec(context.font || '');
  return match ? Number(match[1]) : 10;
}

function createCanvasContext() {
  return {
    canvas: {},
    fillRects: [],
    textCalls: [],
    drawImageCalls: [],
    font: '10px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    textAlign: 'left',
    textBaseline: 'top',
    beginPath() {},
    clearRect() {},
    clip() {},
    fillRect(x, y, width, height) {
      this.fillRects.push({ color: this.fillStyle, height, width, x, y });
    },
    fillText(value, x, y, maxWidth) {
      this.textCalls.push({
        align: this.textAlign,
        baseline: this.textBaseline,
        font: this.font,
        maxWidth,
        value,
        x,
        y
      });
    },
    drawImage(...args) {
      this.drawImageCalls.push(args);
    },
    lineTo() {},
    measureText(value) {
      const pixels = fontPixels(this);
      const width = Array.from(String(value)).reduce((total, character) => (
        total + (character === 'W' ? pixels * 1.5 : pixels * 0.7)
      ), 0);
      return {
        actualBoundingBoxAscent: pixels * 0.8,
        actualBoundingBoxDescent: pixels * 0.2,
        width
      };
    },
    moveTo() {},
    putImageData() {},
    rect() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    setLineDash() {},
    setTransform() {},
    stroke() {},
    strokeRect() {},
    translate() {}
  };
}

test('QR validation supports UTF-8 content and rejects undersized elements', () => {
  const document = {
    elements: [{
      id: 'qr',
      type: 'qrcode',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      value: '中文标签'
    }]
  };
  assert.doesNotThrow(() => validateDocument(document, 203));
  document.elements[0].width = 1;
  document.elements[0].height = 1;
  assert.throws(() => validateDocument(document, 203), /二维码元素过小/);
});

test('barcode validation requires at least one printer dot per module', () => {
  const document = {
    elements: [{
      id: 'barcode',
      type: 'barcode',
      format: 'code128',
      width: 2,
      height: 8,
      value: '1234567890'
    }]
  };
  assert.throws(() => validateDocument(document, 203), /条码元素过窄/);
  document.elements[0].width = 30;
  assert.doesNotThrow(() => validateDocument(document, 203));
});

test('vertical text wraps into distinct columns and auto-fits letter spacing inside its bounds', () => {
  const context = createCanvasContext();
  const element = {
    id: 'vertical',
    type: 'text',
    x: 0,
    y: 0,
    width: 22,
    height: 30,
    text: 'ABCD',
    fontSize: 12,
    direction: 'vertical',
    letterSpacing: 4,
    lineSpacing: 1,
    autoFit: true,
    align: 'left',
    verticalAlign: 'top'
  };

  renderDocument(context, { elements: [element] }, { width: 22, height: 30 }, 25.4, {});

  assert.equal(context.textCalls.length, 4);
  assert.equal(new Set(context.textCalls.map((call) => call.x)).size, 2);
  const renderedFont = fontPixels({ font: context.textCalls[0].font });
  assert.ok(renderedFont < 12, 'font should shrink when spacing creates a second column');
  const firstColumn = context.textCalls.filter((call) => call.x === context.textCalls[0].x);
  assert.equal(firstColumn[1].y - firstColumn[0].y, renderedFont + 4);
  context.textCalls.forEach((call) => {
    assert.ok(call.x - renderedFont / 2 >= -11 - 0.001);
    assert.ok(call.x + renderedFont / 2 <= 11 + 0.001);
    assert.equal(call.baseline, 'alphabetic');
    assert.ok(call.y - renderedFont * 0.8 >= -15 - 0.001);
    assert.ok(call.y + renderedFont * 0.2 <= 15 + 0.001);
  });
});

test('vertical text auto-fit accounts for its widest glyph', () => {
  const context = createCanvasContext();
  const fitted = fitText(context, {
    text: 'WA',
    fontSize: 12,
    direction: 'vertical',
    letterSpacing: 0,
    lineSpacing: 1,
    autoFit: true
  }, 16, 30, 25.4);

  assert.ok(fitted.fontPixels <= 10.01);
  assert.ok(fitted.blockWidth <= 16);
  assert.ok(fitted.glyphWidth >= fitted.fontPixels * 1.5);
});

test('image binarization composites transparency onto white and honors the element threshold', (t) => {
  const sourcePixels = Uint8ClampedArray.from([
    200, 200, 200, 255,
    230, 230, 230, 255,
    0, 0, 0, 0
  ]);
  const createdCanvases = [];
  const previousOffscreenCanvas = global.OffscreenCanvas;
  class FakeOffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.output = null;
      createdCanvases.push(this);
    }

    getContext() {
      return {
        drawImage() {},
        fillRect() {},
        getImageData: () => ({
          data: Uint8ClampedArray.from(sourcePixels),
          height: this.height,
          width: this.width
        }),
        putImageData: (imageData) => {
          this.output = imageData;
        }
      };
    }
  }
  global.OffscreenCanvas = FakeOffscreenCanvas;
  t.after(() => {
    if (previousOffscreenCanvas === undefined) delete global.OffscreenCanvas;
    else global.OffscreenCanvas = previousOffscreenCanvas;
  });

  const context = createCanvasContext();
  const image = {};
  renderDocument(context, {
    elements: [{
      id: 'photo',
      type: 'image',
      x: 0,
      y: 0,
      width: 3,
      height: 1,
      threshold: 220
    }]
  }, { width: 3, height: 1 }, 25.4, { photo: image });

  assert.equal(createdCanvases.length, 1);
  assert.equal(context.drawImageCalls[0][0], createdCanvases[0]);
  assert.deepEqual(Array.from(createdCanvases[0].output.data), [
    0, 0, 0, 255,
    255, 255, 255, 255,
    255, 255, 255, 255
  ]);

  const direct = binarizeImageData({
    data: Uint8ClampedArray.from([150, 150, 150, 255]),
    height: 1,
    width: 1
  }, 151);
  assert.deepEqual(Array.from(direct.data), [0, 0, 0, 255]);
});

test('QR rendering and validation reserve four quiet modules on every side', () => {
  const value = 'A';
  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const requiredDots = code.getModuleCount() + 8;
  const document = {
    elements: [{
      id: 'qr',
      type: 'qrcode',
      x: 0,
      y: 0,
      width: requiredDots + 0.5,
      height: requiredDots + 0.5,
      value
    }]
  };

  assert.doesNotThrow(() => validateDocument(document, 25.4));
  document.elements[0].width = requiredDots - 0.5;
  document.elements[0].height = requiredDots - 0.5;
  assert.throws(() => validateDocument(document, 25.4), /二维码元素过小/);

  document.elements[0].width = requiredDots;
  document.elements[0].height = requiredDots;
  const context = createCanvasContext();
  renderDocument(context, document, { width: requiredDots, height: requiredDots }, 25.4, {});
  const quietZone = context.fillRects.find((rect) => (
    rect.color === '#ffffff' && rect.x < 0 && rect.width === requiredDots
  ));
  const modules = context.fillRects.filter((rect) => rect.color === '#000000');
  assert.ok(quietZone);
  assert.ok(modules.length > 0);
  assert.ok(Math.min(...modules.map((rect) => rect.x)) >= quietZone.x + 4);
  assert.ok(Math.min(...modules.map((rect) => rect.y)) >= quietZone.y + 4);
});

