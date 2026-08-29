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

window.renderShangyueThumb = function renderShangyueThumb(templateId) {
  paintTemplate(document.getElementById('thumb'), templateId);
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
