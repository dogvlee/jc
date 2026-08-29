const { LIBRARY_INDEX, buildLibraryDocument } = require('../miniprogram/app/shangyue-library/pack');
const { renderDocument } = require('../miniprogram/core/renderer');

function freeze(documentValue) {
  const clone = JSON.parse(JSON.stringify(documentValue));
  clone.elements.forEach((element) => {
    if (element.type !== 'date') return;
    element.autoUpdate = false;
    element.fixedValue = element.dateRole === 'expire' ? '2026-08-19' : '2026-08-17';
  });
  return clone;
}

window.renderLibraryThumb = function renderLibraryThumb(templateId) {
  const canvas = document.getElementById('thumb');
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const documentValue = freeze(buildLibraryDocument(templateId));
  const scale = Math.min(canvas.width / documentValue.widthMm, canvas.height / documentValue.heightMm);
  const width = Math.round(documentValue.widthMm * scale);
  const height = Math.round(documentValue.heightMm * scale);
  const paper = document.createElement('canvas');
  paper.width = width;
  paper.height = height;
  renderDocument(paper.getContext('2d'), documentValue, { width, height }, scale * 25.4, {});
  context.drawImage(paper, Math.round((canvas.width - width) / 2), Math.round((canvas.height - height) / 2));
};

window.LIBRARY_SAMPLE_IDS = (function pickSamples() {
  const picked = [];
  const seenScene = new Set();
  for (const entry of LIBRARY_INDEX) {
    if (seenScene.has(entry.scene)) continue;
    seenScene.add(entry.scene);
    picked.push(entry);
  }
  const extras = ['40x60', '50x80', '30x15', '80x50', '50x30', '40x20'];
  extras.forEach((size) => {
    const [w, h] = size.split('x').map(Number);
    const hit = LIBRARY_INDEX.find((entry) => entry.widthMm === w && entry.heightMm === h && !picked.includes(entry));
    if (hit) picked.push(hit);
  });
  return picked.slice(0, 30);
}());
