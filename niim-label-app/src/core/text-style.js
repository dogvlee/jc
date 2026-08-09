const DEFAULT_FONT_SIZE_BY_TYPE = Object.freeze({
  date: 3.2,
  table: 2.8
});

const { changeTextMode } = require('./geometry');

/**
 * Restore typographic defaults without touching the element's content,
 * date configuration, or geometry.
 */
function resetTextStyle(element, document) {
  if (!element) return element;
  // Direction changes reshape the editor box. Restore the saved horizontal
  // geometry before clearing direction state so the element does not remain
  // in a narrow vertical box after "清样式".
  if (document && document.widthMm && document.heightMm) {
    changeTextMode(element, 'horizontal', document);
  }
  element.bold = false;
  element.underline = false;
  element.strike = false;
  element.italic = false;
  element.reverse = false;
  element.fontFamily = 'sans-serif';
  element.fontSize = DEFAULT_FONT_SIZE_BY_TYPE[element.type] || 4;
  element.letterSpacing = 0;
  element.lineSpacing = 0;
  element.autoFit = true;
  element.wordWrap = false;
  element.color = '#000000';
  element.align = element.type === 'table' ? 'center' : 'left';
  element.verticalAlign = 'middle';
  element.direction = 'horizontal';
  element.textMode = 'horizontal';
  element.textArcAngle = 180;
  delete element.directionLayout;
  return element;
}

module.exports = { resetTextStyle };
