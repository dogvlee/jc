const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRINTER_FAMILIES,
  PROFILES,
  alignedCanvasSize,
  evaluatePrintability,
  getProfile,
  previewCanvasSize,
  printerNameProfileId,
  profileForPrinterName,
  savedPrinterProfile
} = require('../miniprogram/core/profiles');

// No shipped profile feeds the label sideways any more, but alignedCanvasSize
// still handles a head that spans the label height (96 dots, about 12 mm).
const SIDE_FED = Object.freeze({ dpi: 203, printheadPixels: 96, printDirection: 'left' });

function headMm(profile) {
  return profile.printheadPixels / (profile.dpi / 25.4);
}

test('alignedCanvasSize aligns only the axis presented to the printhead', () => {
  // 10.5 mm is 84 dots; only the head axis is padded to whole bytes (88).
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 10.5, heightMm: 10.5 }, getProfile('escpos-58')),
    { width: 88, height: 84 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 10.5, heightMm: 10.5 }, getProfile('escpos-80')),
    { width: 88, height: 84 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 10.5, heightMm: 10.5 }, SIDE_FED),
    { width: 84, height: 88 }
  );
});

test('alignedCanvasSize rejects invalid dimensions and accepts exact head limits', () => {
  const printer58 = getProfile('escpos-58');
  assert.throws(() => alignedCanvasSize({ widthMm: 0, heightMm: 0 }, printer58), /大于 0/);
  assert.throws(() => alignedCanvasSize({ widthMm: -1, heightMm: 12 }, printer58), /大于 0/);
  assert.throws(() => alignedCanvasSize({ widthMm: Number.NaN, heightMm: 12 }, printer58), /大于 0/);
  // 48 mm is the 58 mm printer's whole 384-dot head, 72 mm the 80 mm printer's 576 dots.
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 48, heightMm: 30 }, printer58),
    { width: 384, height: 240 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 72, heightMm: 30 }, getProfile('escpos-80')),
    { width: 576, height: 240 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 40, heightMm: 12 }, SIDE_FED),
    { width: 320, height: 96 }
  );
});

test('previewCanvasSize allows editing labels that do not fit the selected printer', () => {
  assert.deepEqual(previewCanvasSize({ widthMm: 50, heightMm: 40 }, 203), { width: 400, height: 320 });
});

test('alignedCanvasSize rejects labels wider than the active printhead axis', () => {
  // 49 mm is 392 dots, past the 384-dot head; 73 mm is 584 dots, past 576.
  assert.throws(
    () => alignedCanvasSize({ widthMm: 49, heightMm: 30 }, getProfile('escpos-58')),
    { message: '当前机型打印宽度最多约 48.0 mm' }
  );
  assert.throws(
    () => alignedCanvasSize({ widthMm: 73, heightMm: 30 }, getProfile('escpos-80')),
    { message: '当前机型打印宽度最多约 72.1 mm' }
  );
  // The 80 mm printer's head takes what the 58 mm one refuses.
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 49, heightMm: 30 }, getProfile('escpos-80')),
    { width: 392, height: 240 }
  );
  assert.throws(
    () => alignedCanvasSize({ widthMm: 40, heightMm: 13 }, SIDE_FED),
    { message: '当前机型打印高度最多约 12.0 mm' }
  );
});

test('evaluatePrintability reports the blocker and a printer that can print it', () => {
  const fits = evaluatePrintability({ widthMm: 40, heightMm: 30 }, getProfile('escpos-58'));
  assert.equal(fits.ok, true);
  assert.equal(fits.suggestProfileId, '');

  // 70 mm is wider than 58 mm paper but within the 80 mm printer's 72 mm head.
  const wide = { widthMm: 70, heightMm: 30 };
  const blocked = evaluatePrintability(wide, getProfile('escpos-58'));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'PAPER_TOO_LARGE');
  assert.equal(
    blocked.message,
    '58mm 打印机只能装宽度不超过 58 mm 的标签纸，当前标签 70×30 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );
  assert.equal(blocked.suggestProfileId, 'escpos-80');
  assert.equal(evaluatePrintability(wide, getProfile(blocked.suggestProfileId)).ok, true);

  // No supported printer takes 90 mm paper; the message stays plain.
  const hopeless = evaluatePrintability({ widthMm: 90, heightMm: 60 }, getProfile('escpos-80'));
  assert.equal(hopeless.ok, false);
  assert.equal(hopeless.suggestProfileId, '');
  assert.equal(
    hopeless.message,
    '80mm 打印机只能装宽度不超过 80 mm 的标签纸，当前标签 90×60 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );
  assert.doesNotMatch(hopeless.message, /已验证|协议|真机|样张|机型配置/);
});

test('the other paper width is offered exactly when it prints the label', () => {
  for (let widthMm = 10; widthMm <= 100; widthMm += 0.5) {
    const document = { widthMm, heightMm: 30 };
    const on58 = evaluatePrintability(document, getProfile('escpos-58'));
    const on80 = evaluatePrintability(document, getProfile('escpos-80'));
    // A blank label prints on any paper the printer takes, skipping the strips the head misses.
    assert.equal(on58.ok, widthMm <= 58, `${widthMm} mm on 58 mm`);
    assert.equal(on80.ok, widthMm <= 80, `${widthMm} mm on 80 mm`);
    assert.equal(on58.suggestProfileId, !on58.ok && on80.ok ? 'escpos-80' : '', `${widthMm} mm on 58 mm`);
    // Whatever 58 mm paper holds fits the 80 mm head, so the 80 mm printer never points back.
    assert.equal(on80.suggestProfileId, '', `${widthMm} mm on 80 mm`);
  }
});

test('profiles are the 58 mm and 80 mm ESC/POS printers, each with a plain name and a family', () => {
  assert.deepEqual(
    PROFILES.map((profile) => [profile.id, profile.name, profile.family, profile.printheadPixels, profile.paperMaxMm]),
    [
      ['escpos-58', '58mm 打印机', '5', 384, 58],
      ['escpos-80', '80mm 打印机', '8', 576, 80]
    ]
  );
  // 384 dots at 203 dpi is a 48 mm head, 576 dots a 72 mm one: each narrower than its paper.
  assert.deepEqual(PROFILES.map((profile) => Math.round(headMm(profile))), [48, 72]);
  for (const profile of PROFILES) {
    assert.ok(profile.paperMaxMm > headMm(profile), profile.id);
    assert.equal(profile.task, 'escpos', profile.id);
    assert.equal(profile.dpi, 203, profile.id);
    assert.equal(profile.printDirection, 'top', profile.id);
    // Density is the printer's own setting, so there is nothing to choose.
    assert.deepEqual([profile.densityMin, profile.densityMax, profile.densityDefault], [3, 3, 3], profile.id);
    assert.deepEqual(profile.defaultSize, [50, 30], profile.id);
    assert.doesNotMatch(profile.name, /协议|时序|_/);
  }

  // One shelf family per paper width, each naming exactly one profile.
  assert.deepEqual(PRINTER_FAMILIES, [{ code: '5', label: '58mm' }, { code: '8', label: '80mm' }]);
  assert.ok(Object.isFrozen(PRINTER_FAMILIES) && PRINTER_FAMILIES.every((family) => Object.isFrozen(family)));
  assert.deepEqual(
    PRINTER_FAMILIES.map((family) => PROFILES.filter((profile) => profile.family === family.code).map((profile) => profile.id)),
    [['escpos-58'], ['escpos-80']]
  );
});

test('an unknown or retired profile id falls back to the 58 mm printer', () => {
  assert.equal(getProfile('escpos-80').id, 'escpos-80');
  // Settings saved before the switch to ESC/POS may still name a NIIMBOT model.
  for (const id of ['d110', 'd11-legacy', 'b1', 'b21s', 'missing', '', null, undefined]) {
    assert.equal(getProfile(id).id, 'escpos-58', String(id));
  }
});

test('a printer takes the paper width its Bluetooth name ends with, as in the receipt app', () => {
  for (const name of ['SYD-80', 'syd-80', 'SYD_80', 'SYD80', 'SYD 80', 'Printer80', '80', ' SYD-80 ']) {
    assert.equal(profileForPrinterName(name), getProfile('escpos-80'), name);
  }
  for (const name of ['SYD-58', 'SYD 58', 'SYD58', 'Printer58', '58']) {
    assert.equal(profileForPrinterName(name), getProfile('escpos-58'), name);
  }
  // Only the very end of the name counts; anything else prints as 58 mm.
  for (const name of ['SYD-80-A1', 'SYD-80-1A2B', 'SYD-580', 'SYD-880', 'DEV5800', 'B11-5678', 'D110-G123', '', null, undefined]) {
    assert.equal(profileForPrinterName(name).id, 'escpos-58', String(name));
  }
});

test('a printer name says its paper width only by its ending', () => {
  assert.equal(printerNameProfileId('SYD-80'), 'escpos-80');
  assert.equal(printerNameProfileId('SYD-58'), 'escpos-58');
  for (const name of ['EY-260', 'SYD-80-A1', 'MPT-II', '', null]) assert.equal(printerNameProfileId(name), '', String(name));
});

test('a remembered printer uses the model the user picked for it, else its name', () => {
  // The user's pick wins over the name, either way round.
  assert.equal(savedPrinterProfile({ name: 'SYD-80', confirmedProfileId: 'escpos-58' }).id, 'escpos-58');
  assert.equal(savedPrinterProfile({ name: 'SYD-58', confirmedProfileId: 'escpos-80' }).id, 'escpos-80');
  // A pick or model ID stored before the switch to ESC/POS, or a pick that is no profile, does not count.
  assert.equal(savedPrinterProfile({ name: 'SYD-80', modelId: 4096, confirmedProfileId: 'b1' }).id, 'escpos-80');
  assert.equal(savedPrinterProfile({ name: 'SYD-80', confirmedProfileId: 'missing' }).id, 'escpos-80');
  assert.equal(savedPrinterProfile({ name: 'SYD-80', confirmedProfileId: '' }).id, 'escpos-80');
  // The name comes from whichever field the platform filled in.
  assert.equal(savedPrinterProfile({ name: '', displayName: 'SYD-80' }).id, 'escpos-80');
  assert.equal(savedPrinterProfile({ localName: 'Printer80' }).id, 'escpos-80');
  assert.equal(savedPrinterProfile({ name: 'SYD-58' }).id, 'escpos-58');
  // Without a usable name the printer prints as 58 mm, as in the receipt app.
  assert.equal(savedPrinterProfile({ deviceId: 'AA:BB' }).id, 'escpos-58');
  assert.equal(savedPrinterProfile(null).id, 'escpos-58');
  assert.equal(savedPrinterProfile(undefined).id, 'escpos-58');
});
