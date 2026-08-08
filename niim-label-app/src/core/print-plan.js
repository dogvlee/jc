const { u16be } = require('./bytes');
const { COMMAND, RESPONSE } = require('./protocol');
const { rowToCommand } = require('./image-encoder');

function step(command, data, expect, extra) {
  return Object.assign({ command, data: data || [], expect }, extra || {});
}

function imageSteps(encoded, profile, useChecks) {
  return encoded.rowsData.map((row) => rowToCommand(row, {
    printheadPixels: profile.printheadPixels,
    countsMode: profile.task === 'b21Legacy' ? 'total' : 'auto',
    useIndexed: true,
    checkResponse: useChecks ? RESPONSE.CHECK_LINE : null
  }));
}

function pageSizeData(profile, encoded, copies) {
  if (profile.task === 'd11Legacy') {
    return [...u16be(encoded.rows)];
  }
  if (profile.task === 'b1') {
    return [...u16be(encoded.rows), ...u16be(encoded.columns), ...u16be(copies)];
  }
  return [...u16be(encoded.rows), ...u16be(encoded.columns)];
}

function buildPrintPlan(encoded, profile, options) {
  options = options || {};
  const copies = Math.max(1, Math.min(99, Number(options.copies) || 1));
  const requestedDensity = Number(options.density);
  const density = Number.isFinite(requestedDensity)
    ? Math.max(profile.densityMin, Math.min(profile.densityMax, requestedDensity))
    : profile.densityDefault;
  const labelType = Number(options.labelType) || 1;
  const steps = [
    ...(profile.task === 'd11Legacy'
      ? [step(COMMAND.HEARTBEAT, [1], RESPONSE.HEARTBEAT)]
      : []),
    step(COMMAND.SET_DENSITY, [density], RESPONSE.SET_DENSITY),
    step(COMMAND.SET_LABEL_TYPE, [labelType], RESPONSE.SET_LABEL_TYPE)
  ];

  if (profile.task === 'b1') {
    steps.push(step(COMMAND.PRINT_START, [...u16be(copies), 0, 0, 0, 0, 0], RESPONSE.PRINT_START));
  } else {
    steps.push(step(COMMAND.PRINT_START, [1], RESPONSE.PRINT_START));
  }

  const pageCount = profile.task === 'b21Legacy' ? copies : 1;
  for (let page = 0; page < pageCount; page += 1) {
    if (profile.task === 'd110' || profile.task === 'd11Legacy') {
      steps.push(step(COMMAND.PRINT_CLEAR, [1], RESPONSE.PRINT_CLEAR));
    }
    steps.push(step(COMMAND.PAGE_START, [1], RESPONSE.PAGE_START));
    steps.push(step(COMMAND.SET_PAGE_SIZE, pageSizeData(profile, encoded, copies), RESPONSE.SET_PAGE_SIZE));
    if (profile.task === 'd110' || profile.task === 'd11Legacy') {
      steps.push(step(COMMAND.SET_QUANTITY, u16be(copies), RESPONSE.SET_QUANTITY));
    }
    steps.push(...imageSteps(encoded, profile, profile.task === 'b21Legacy'));
    steps.push(step(COMMAND.PAGE_END, [1], RESPONSE.PAGE_END));
  }
  return steps;
}

module.exports = { buildPrintPlan, pageSizeData };
