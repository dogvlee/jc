const { APPROVED_ORIGINAL_TEMPLATES, getTemplate } = require('../miniprogram/app/catalog');
const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
const { renderDocument } = require('../miniprogram/core/renderer');

function freezeDocument(documentValue) {
  const clone = JSON.parse(JSON.stringify(documentValue));
  clone.elements.forEach((element) => {
    if (element.type !== 'date') return;
    element.autoUpdate = false;
    element.fixedValue = element.dateRole === 'expire' ? '2026-08-19' : '2026-08-17';
  });
  return clone;
}

function fitPaper(widthMm, heightMm, canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / widthMm, canvasHeight / heightMm);
  return {
    width: Math.round(widthMm * scale),
    height: Math.round(heightMm * scale),
    dpi: scale * 25.4
  };
}

function paintTemplate(target, templateId) {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`unknown template: ${templateId}`);
  const context = target.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, target.width, target.height);
  const documentValue = freezeDocument(buildTemplateDocument(template));
  const fitted = fitPaper(documentValue.widthMm, documentValue.heightMm, target.width, target.height);
  const paper = document.createElement('canvas');
  paper.width = fitted.width;
  paper.height = fitted.height;
  renderDocument(paper.getContext('2d'), documentValue, fitted, fitted.dpi, {});
  context.drawImage(
    paper,
    Math.round((target.width - fitted.width) / 2),
    Math.round((target.height - fitted.height) / 2)
  );
  return template;
}

function roundedRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

// Shelf thumbnail: transparent surround, white die-cut paper with a hairline
// and soft shadow, so the label edge reads at every paper ratio. Templates
// themselves carry no frame; this outline exists only in the preview.
function paintShelfThumb(target, templateId) {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`unknown template: ${templateId}`);
  const context = target.getContext('2d');
  context.clearRect(0, 0, target.width, target.height);
  const documentValue = freezeDocument(buildTemplateDocument(template));
  const inset = 28;
  const fitted = fitPaper(documentValue.widthMm, documentValue.heightMm, target.width - inset * 2, target.height - inset * 2);
  const paper = document.createElement('canvas');
  paper.width = fitted.width;
  paper.height = fitted.height;
  renderDocument(paper.getContext('2d'), documentValue, fitted, fitted.dpi, {});
  const x = Math.round((target.width - fitted.width) / 2);
  const y = Math.round((target.height - fitted.height) / 2);
  const radius = Math.round(1.5 * fitted.dpi / 25.4);
  context.save();
  context.shadowColor = 'rgba(15, 17, 20, 0.14)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 4;
  roundedRectPath(context, x, y, fitted.width, fitted.height, radius);
  context.fillStyle = '#ffffff';
  context.fill();
  context.restore();
  context.save();
  roundedRectPath(context, x, y, fitted.width, fitted.height, radius);
  context.clip();
  context.drawImage(paper, x, y);
  context.restore();
  roundedRectPath(context, x + 0.5, y + 0.5, fitted.width - 1, fitted.height - 1, radius);
  context.strokeStyle = '#E5E6EB';
  context.lineWidth = 1;
  context.stroke();
  return template;
}

window.renderShangyueThumb = function renderShangyueThumb(templateId) {
  paintShelfThumb(document.getElementById('thumb'), templateId);
};

window.renderShangyueCompare = function renderShangyueCompare(leftId, rightId, leftTitle, rightTitle) {
  const canvas = document.getElementById('compare');
  const context = canvas.getContext('2d');
  context.fillStyle = '#f4f1ea';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const panelWidth = 620;
  const panelHeight = 500;
  const leftX = 20;
  const rightX = 680;
  const panelY = 88;

  function panel(x, title) {
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#1b1b1b';
    context.lineWidth = 2;
    context.fillRect(x, panelY, panelWidth, panelHeight);
    context.strokeRect(x + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);
    context.fillStyle = '#1b1b1b';
    context.font = 'bold 28px sans-serif';
    context.textAlign = 'left';
    context.fillText(title, x, 52);
  }

  panel(leftX, leftTitle);
  panel(rightX, rightTitle);

  const leftPaper = document.createElement('canvas');
  leftPaper.width = 580;
  leftPaper.height = 440;
  const rightPaper = document.createElement('canvas');
  rightPaper.width = 580;
  rightPaper.height = 440;
  paintTemplate(leftPaper, leftId);
  paintTemplate(rightPaper, rightId);
  context.drawImage(leftPaper, leftX + 20, panelY + 30);
  context.drawImage(rightPaper, rightX + 20, panelY + 30);
};

window.SHANGYUE_ORIGINAL_IDS = APPROVED_ORIGINAL_TEMPLATES.map((item) => item.id);
