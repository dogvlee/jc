const DEFAULT_FONT_SIZE_BY_TYPE = Object.freeze({
  date: 3.2,
  table: 2.8
});

/**
 * Restore typographic defaults without touching the element's content,
 * date configuration, or geometry.
 */
function resetTextStyle(element) {
  if (!element) return element;
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
  return element;
}

module.exports = { resetTextStyle };
