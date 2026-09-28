/* Browser bundle for scripts/render-curated-sheets.mjs: draws curated
 * templates as paper cards on one review sheet and flags any text the real
 * canvas renderer would shrink below its declared size. */
const { buildCuratedDocument, getCuratedEntry } = require('../miniprogram/app/curated/index');
const { fitText, mmToDots, renderDocument, formatDateValue, serialValue } = require('../miniprogram/core/renderer');

const FIXED_NOW = new Date('2026-09-28T14:30:00+08:00');

function freeze(documentValue) {
  const clone = JSON.parse(JSON.stringify(documentValue));
  clone.elements.forEach((element) => {
    if (element.type !== 'date') return;
    const text = formatDateValue(element, FIXED_NOW);
    element.autoUpdate = false;
    element.fixedValue = element.label ? text.slice(element.label.length + 1) : text;
  });
  return clone;
}

function shrunkTexts(context, documentValue, dpi) {
  const problems = [];
  documentValue.elements.forEach((element) => {
    if (!['text', 'date', 'serial'].includes(element.type)) return;
    const value = element.type === 'date' ? formatDateValue(element, FIXED_NOW)
      : element.type === 'serial' ? serialValue(element) : element.text;
    const probe = Object.assign({}, element, { text: value });
    const width = mmToDots(element.width, dpi);
    const height = mmToDots(element.height, dpi);
    const fitted = fitText(context, probe, width, height, dpi);
    const declared = Math.max(7, mmToDots(element.fontSize || 4, dpi));
    if (fitted.fontPixels < declared - 0.5 || (fitted.lines && fitted.lines.length > String(value).split('\n').length)) {
      problems.push(value);
    }
  });
  return problems;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

window.renderCuratedSheet = function renderCuratedSheet(ids, columns, cellWidth, cellHeight) {
  const canvas = document.getElementById('sheet');
  const context = canvas.getContext('2d');
  context.fillStyle = '#E9EBEF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const report = [];
  ids.forEach((id, index) => {
    const entry = getCuratedEntry(id);
    const documentValue = freeze(buildCuratedDocument(id));
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = column * cellWidth;
    const cellY = row * cellHeight;
    const areaW = cellWidth - 24;
    const areaH = cellHeight - 44;
    const scale = Math.min(areaW / documentValue.widthMm, areaH / documentValue.heightMm);
    const paperW = Math.round(documentValue.widthMm * scale);
    const paperH = Math.round(documentValue.heightMm * scale);
    const paper = document.createElement('canvas');
    paper.width = paperW;
    paper.height = paperH;
    const dpi = scale * 25.4;
    renderDocument(paper.getContext('2d'), documentValue, { width: paperW, height: paperH }, dpi, {});
    const shrunk = shrunkTexts(paper.getContext('2d'), documentValue, dpi);
    const x = cellX + Math.round((cellWidth - paperW) / 2);
    const y = cellY + 12 + Math.round((areaH - paperH) / 2);
    context.save();
    context.shadowColor = 'rgba(15, 17, 20, 0.18)';
    context.shadowBlur = 10;
    roundedRect(context, x, y, paperW, paperH, Math.round(1.5 * scale));
    context.fillStyle = '#ffffff';
    context.fill();
    context.restore();
    context.save();
    roundedRect(context, x, y, paperW, paperH, Math.round(1.5 * scale));
    context.clip();
    context.drawImage(paper, x, y);
    context.restore();
    context.fillStyle = shrunk.length ? '#E02D26' : '#51565D';
    context.font = '13px sans-serif';
    context.textAlign = 'center';
    const label = `${entry.widthMm}×${entry.heightMm} ${entry.name}${shrunk.length ? ` ⚠缩小:${shrunk.join('/')}` : ''}`;
    context.fillText(label.slice(0, 44), cellX + cellWidth / 2, cellY + cellHeight - 14);
    if (shrunk.length) report.push({ id, shrunk });
  });
  document.getElementById('report').textContent = JSON.stringify(report);
};
