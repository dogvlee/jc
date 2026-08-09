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
  const context = {
    canvas: {},
    fillRects: [],
    textCalls: [],
    drawImageCalls: [],
    rotations: [],
    transformStack: [],
    transform: { x: 0, y: 0, rotation: 0 },
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
      const cosine = Math.cos(this.transform.rotation);
      const sine = Math.sin(this.transform.rotation);
      this.textCalls.push({
        align: this.textAlign,
        baseline: this.textBaseline,
        font: this.font,
        maxWidth,
        rotation: this.transform.rotation,
        value,
        x: this.transform.x + x * cosine - y * sine,
        y: this.transform.y + x * sine + y * cosine
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
    restore() { this.transform = this.transformStack.pop() || { x: 0, y: 0, rotation: 0 }; },
    rotate(value) {
      this.transform.rotation += value;
      this.rotations.push(value);
    },
    save() { this.transformStack.push({ ...this.transform }); },
    scale() {},
    setLineDash() {},
    setTransform() {},
    stroke() {},
    strokeRect() {},
    translate(x, y) {
      const cosine = Math.cos(this.transform.rotation);
      const sine = Math.sin(this.transform.rotation);
      this.transform.x += x * cosine - y * sine;
      this.transform.y += x * sine + y * cosine;
    }
  };
  return context;
}

test('all six text modes preserve the native layout axes and per-script rotations', () => {
  const base = {
    id: 'mode',
    type: 'text',
    x: 0,
    y: 0,
    width: 36,
    height: 18,
    text: '文A',
    fontSize: 5,
    direction: 'horizontal',
    textArcAngle: 120,
    letterSpacing: 0,
    lineSpacing: 0,
    autoFit: true,
    align: 'center',
    verticalAlign: 'middle'
  };

  for (const mode of ['horizontal', 'horizontal-90', 'horizontal-90-words-rotate', 'vertical', 'vertical-words-rotate', 'arc']) {
    const context = createCanvasContext();
    const element = { ...base, textMode: mode, direction: mode.startsWith('vertical') ? 'vertical' : 'horizontal' };
    const fitted = fitText(context, element, 36, 18, 25.4);
    assert.ok(fitted.blockWidth <= 36 + 0.001, `${mode} width should fit`);
    assert.ok(fitted.blockHeight <= 18 + 0.001, `${mode} height should fit`);
    renderDocument(context, { elements: [element] }, { width: 36, height: 18 }, 25.4, {});
    assert.ok(context.textCalls.length > 0, `${mode} should paint glyphs`);
    if (mode === 'arc') {
      assert.ok(context.rotations.some((value) => Math.abs(value) > 0.05), 'arc should rotate glyphs along the path');
    }
    if (mode === 'horizontal-90') {
      assert.deepEqual(context.textCalls.map((call) => [call.value, call.rotation]), [
        ['文', -Math.PI / 2], ['A', 0]
      ]);
      assert.ok(context.textCalls[1].x > context.textCalls[0].x, 'horizontal-90 keeps an X-axis flow');
      assert.equal(context.textCalls[1].y, context.textCalls[0].y);
    }
    if (mode === 'horizontal-90-words-rotate') {
      assert.deepEqual(context.textCalls.map((call) => [call.value, call.rotation]), [
        ['文', -Math.PI / 2], ['A', -Math.PI / 2]
      ]);
      assert.ok(context.textCalls[1].x > context.textCalls[0].x, 'horizontal words-rotate keeps an X-axis flow');
      assert.equal(context.textCalls[1].y, context.textCalls[0].y);
    }
    if (mode === 'vertical') {
      assert.deepEqual(context.textCalls.map((call) => [call.value, call.rotation]), [
        ['文', 0], ['A', Math.PI / 2]
      ]);
      assert.ok(context.textCalls[1].y > context.textCalls[0].y, 'vertical keeps a Y-axis flow');
      assert.equal(context.textCalls[1].x, context.textCalls[0].x);
    }
    if (mode === 'vertical-words-rotate') {
      assert.deepEqual(context.textCalls.map((call) => [call.value, call.rotation]), [
        ['文', 0], ['A', 0]
      ]);
      assert.ok(context.textCalls[1].y > context.textCalls[0].y, 'vertical words-rotate keeps a Y-axis flow');
      assert.equal(context.textCalls[1].x, context.textCalls[0].x);
    }
  }
});

test('arc angle zero falls back to a straight line without curved glyph rotations', () => {
  const context = createCanvasContext();
  const element = {
    id: 'flat-arc', type: 'text', x: 0, y: 0, width: 30, height: 8,
    text: '直线', fontSize: 4, textMode: 'arc', textArcAngle: 0,
    direction: 'horizontal', autoFit: true, align: 'center', verticalAlign: 'middle'
  };
  renderDocument(context, { elements: [element] }, { width: 30, height: 8 }, 25.4, {});
  assert.equal(context.textCalls.length, 1);
  assert.ok(context.rotations.every((value) => Math.abs(value) < 1e-9));
});

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
    text: '甲乙丙丁',
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
    assert.ok(call.x - renderedFont / 2 >= -0.001);
    assert.ok(call.x + renderedFont / 2 <= 22 + 0.001);
    assert.equal(call.baseline, 'alphabetic');
    assert.ok(call.y - renderedFont * 0.8 >= -0.001);
    assert.ok(call.y + renderedFont * 0.2 <= 30 + 0.001);
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

test('empty text renders the editor placeholder instead of an empty box', () => {
  const context = createCanvasContext();
  renderDocument(context, {
    elements: [{
      id: 'empty-text',
      type: 'text',
      x: 0,
      y: 0,
      width: 24,
      height: 8,
      text: '',
      fontSize: 4,
      align: 'left',
      verticalAlign: 'middle',
      direction: 'horizontal',
      autoFit: true
    }]
  }, { width: 24, height: 8 }, 25.4, {});

  assert.ok(context.textCalls.some((call) => call.value === '双击编辑'));
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

