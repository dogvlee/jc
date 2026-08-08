const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPrintPlan, pageSizeData } = require('../src/core/print-plan');
const { getProfile } = require('../src/core/profiles');
const { COMMAND, RESPONSE } = require('../src/core/protocol');

function encodedFixture() {
  return {
    rows: 0x0102,
    columns: 0x0018,
    rowsData: [
      {
        dataType: 'pixels',
        rowNumber: 0,
        repeat: 1,
        rowData: Uint8Array.from([0x80, 0, 0]),
        blackPixels: 1
      },
      {
        dataType: 'empty',
        rowNumber: 1,
        repeat: 2,
        rowData: null,
        blackPixels: 0
      },
      {
        dataType: 'check',
        rowNumber: 0x0101,
        repeat: 0,
        rowData: null,
        blackPixels: 0
      }
    ]
  };
}

function commands(plan) {
  return plan.map((item) => item.command);
}

function findStep(plan, command) {
  return plan.find((item) => item.command === command);
}

test('pageSizeData uses the payload layout required by each task family', () => {
  const encoded = encodedFixture();

  assert.deepEqual(pageSizeData(getProfile('d11-legacy'), encoded, 2), [0x01, 0x02]);
  assert.deepEqual(pageSizeData(getProfile('d110'), encoded, 2), [0x01, 0x02, 0, 0x18]);
  assert.deepEqual(pageSizeData(getProfile('b1'), encoded, 2), [
    0x01, 0x02, 0, 0x18, 0, 2
  ]);
});

test('d110 plan clamps settings and orders clear, setup, rows, and page end', () => {
  const plan = buildPrintPlan(encodedFixture(), getProfile('d110'), {
    copies: 120,
    density: 9,
    labelType: 2
  });

  assert.deepEqual(commands(plan), [
    COMMAND.SET_DENSITY,
    COMMAND.SET_LABEL_TYPE,
    COMMAND.PRINT_START,
    COMMAND.PRINT_CLEAR,
    COMMAND.PAGE_START,
    COMMAND.SET_PAGE_SIZE,
    COMMAND.SET_QUANTITY,
    COMMAND.PRINT_ROW_INDEXED,
    COMMAND.PRINT_EMPTY_ROW,
    COMMAND.CHECK_LINE,
    COMMAND.PAGE_END
  ]);
  assert.deepEqual(plan[0], {
    command: COMMAND.SET_DENSITY,
    data: [3],
    expect: RESPONSE.SET_DENSITY
  });
  assert.deepEqual(findStep(plan, COMMAND.SET_PAGE_SIZE).data, [1, 2, 0, 24]);
  assert.deepEqual(findStep(plan, COMMAND.SET_QUANTITY).data, [0, 99]);
  assert.deepEqual(findStep(plan, COMMAND.PRINT_ROW_INDEXED).data, [
    0, 0, 1, 0, 0, 1, 0, 0
  ]);
  assert.equal(findStep(plan, COMMAND.CHECK_LINE).expect, null);
});

test('legacy D11 prepends heartbeat and sends row count as page size', () => {
  const plan = buildPrintPlan(encodedFixture(), getProfile('d11-legacy'), {
    copies: 4,
    density: 1,
    labelType: 1
  });

  assert.deepEqual(commands(plan), [
    COMMAND.HEARTBEAT,
    COMMAND.SET_DENSITY,
    COMMAND.SET_LABEL_TYPE,
    COMMAND.PRINT_START,
    COMMAND.PRINT_CLEAR,
    COMMAND.PAGE_START,
    COMMAND.SET_PAGE_SIZE,
    COMMAND.SET_QUANTITY,
    COMMAND.PRINT_ROW_INDEXED,
    COMMAND.PRINT_EMPTY_ROW,
    COMMAND.CHECK_LINE,
    COMMAND.PAGE_END
  ]);
  assert.deepEqual(plan[0], {
    command: COMMAND.HEARTBEAT,
    data: [1],
    expect: RESPONSE.HEARTBEAT
  });
  assert.deepEqual(findStep(plan, COMMAND.SET_PAGE_SIZE).data, [1, 2]);
  assert.deepEqual(findStep(plan, COMMAND.SET_QUANTITY).data, [0, 4]);
});

test('B1 puts copies in PRINT_START and SET_PAGE_SIZE without quantity command', () => {
  const plan = buildPrintPlan(encodedFixture(), getProfile('b1'), {
    copies: 2,
    density: 4,
    labelType: 3
  });

  assert.deepEqual(commands(plan), [
    COMMAND.SET_DENSITY,
    COMMAND.SET_LABEL_TYPE,
    COMMAND.PRINT_START,
    COMMAND.PAGE_START,
    COMMAND.SET_PAGE_SIZE,
    COMMAND.PRINT_ROW_INDEXED,
    COMMAND.PRINT_EMPTY_ROW,
    COMMAND.CHECK_LINE,
    COMMAND.PAGE_END
  ]);
  assert.deepEqual(findStep(plan, COMMAND.PRINT_START).data, [0, 2, 0, 0, 0, 0, 0]);
  assert.deepEqual(findStep(plan, COMMAND.SET_PAGE_SIZE).data, [1, 2, 0, 24, 0, 2]);
  assert.equal(findStep(plan, COMMAND.SET_QUANTITY), undefined);
  assert.equal(findStep(plan, COMMAND.PRINT_CLEAR), undefined);
});

test('legacy B21 repeats a complete page per copy and waits on line checks', () => {
  const plan = buildPrintPlan(encodedFixture(), getProfile('b21'), {
    copies: 2,
    density: 5,
    labelType: 1
  });

  assert.deepEqual(commands(plan), [
    COMMAND.SET_DENSITY,
    COMMAND.SET_LABEL_TYPE,
    COMMAND.PRINT_START,
    COMMAND.PAGE_START,
    COMMAND.SET_PAGE_SIZE,
    COMMAND.PRINT_ROW_INDEXED,
    COMMAND.PRINT_EMPTY_ROW,
    COMMAND.CHECK_LINE,
    COMMAND.PAGE_END,
    COMMAND.PAGE_START,
    COMMAND.SET_PAGE_SIZE,
    COMMAND.PRINT_ROW_INDEXED,
    COMMAND.PRINT_EMPTY_ROW,
    COMMAND.CHECK_LINE,
    COMMAND.PAGE_END
  ]);
  assert.deepEqual(findStep(plan, COMMAND.PRINT_START).data, [1]);
  assert.equal(plan.filter((step) => step.command === COMMAND.PAGE_START).length, 2);
  assert.deepEqual(findStep(plan, COMMAND.PRINT_ROW_INDEXED).data, [
    0, 0, 0, 1, 0, 1, 0, 0
  ]);
  for (const check of plan.filter((step) => step.command === COMMAND.CHECK_LINE)) {
    assert.deepEqual(check.data, [1, 1, 1]);
    assert.equal(check.expect, RESPONSE.CHECK_LINE);
  }
});

