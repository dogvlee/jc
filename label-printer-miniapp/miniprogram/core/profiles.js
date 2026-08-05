const PROFILES = [
  {
    id: 'd110',
    name: 'D11 / D110（新协议）',
    devicePattern: /D110|D11S|D11/i,
    task: 'd110',
    dpi: 203,
    printheadPixels: 96,
    printDirection: 'left',
    densityMin: 1,
    densityMax: 3,
    densityDefault: 2,
    defaultSize: [40, 12]
  },
  {
    id: 'd11-legacy',
    name: 'D11 / D11S（旧协议）',
    devicePattern: /D11S|D11/i,
    task: 'd11Legacy',
    dpi: 203,
    printheadPixels: 96,
    printDirection: 'left',
    densityMin: 1,
    densityMax: 3,
    densityDefault: 2,
    defaultSize: [40, 12]
  },
  {
    id: 'b1',
    name: 'B1',
    devicePattern: /^B1(?!\d)/i,
    task: 'b1',
    dpi: 203,
    printheadPixels: 384,
    printDirection: 'top',
    densityMin: 1,
    densityMax: 5,
    densityDefault: 3,
    defaultSize: [40, 30]
  },
  {
    id: 'b21',
    name: 'B21 / B21_L2B',
    devicePattern: /^B21(?:\b|_L2B)/i,
    task: 'b21Legacy',
    dpi: 203,
    printheadPixels: 384,
    printDirection: 'top',
    densityMin: 1,
    densityMax: 5,
    densityDefault: 3,
    defaultSize: [40, 30]
  },
  {
    id: 'b21-c2b',
    name: 'B21_C2B（B1 时序）',
    devicePattern: /B21_C2B/i,
    task: 'b1',
    dpi: 203,
    printheadPixels: 384,
    printDirection: 'top',
    densityMin: 1,
    densityMax: 5,
    densityDefault: 3,
    defaultSize: [40, 30]
  },
  {
    id: 'b21s',
    name: 'B21S / B21S_C2B',
    devicePattern: /B21S/i,
    task: 'd110',
    dpi: 203,
    printheadPixels: 384,
    printDirection: 'top',
    densityMin: 1,
    densityMax: 5,
    densityDefault: 3,
    defaultSize: [40, 30]
  }
];

function getProfile(id) {
  return PROFILES.find((item) => item.id === id) || PROFILES[0];
}

function guessProfile(deviceName) {
  const name = String(deviceName || '');
  if (/D11S/i.test(name)) {
    return getProfile('d11-legacy');
  }
  if (/B21[_ -]?PRO/i.test(name)) {
    return null;
  }
  if (/B21S/i.test(name)) {
    return getProfile('b21s');
  }
  if (/B21_C2B/i.test(name)) {
    return getProfile('b21-c2b');
  }
  if (/B21/i.test(name)) {
    return getProfile('b21');
  }
  if (/^B1(?!\d)/i.test(name)) {
    return getProfile('b1');
  }
  return PROFILES.find((item) => item.id !== 'd11-legacy' && item.devicePattern.test(name)) || null;
}

function profileForModelId(modelId, deviceName, protocolVersion) {
  const mapping = {
    2304: 'd110',
    2305: 'd110',
    4096: 'b1',
    768: 'b21',
    769: 'b21',
    771: 'b21-c2b',
    775: 'b21-c2b',
    776: 'b21s',
    777: 'b21s'
  };
  if (modelId !== null && modelId !== undefined) {
    if (modelId === 512) {
      return protocolVersion === 1 || protocolVersion === 2 ? getProfile('d110') : getProfile('d11-legacy');
    }
    if (modelId === 514) {
      return getProfile('d11-legacy');
    }
    return mapping[modelId] ? getProfile(mapping[modelId]) : null;
  }
  if (/D11S/i.test(String(deviceName || ''))) {
    return getProfile('d11-legacy');
  }
  if (/D110/i.test(String(deviceName || ''))) {
    return getProfile('d110');
  }
  if (/D11(?!0)/i.test(String(deviceName || ''))) {
    return protocolVersion === 1 || protocolVersion === 2 ? getProfile('d110') : getProfile('d11-legacy');
  }
  return guessProfile(deviceName);
}

function alignedCanvasSize(document, profile) {
  const dotsPerMillimeter = profile.dpi / 25.4;
  let width = Math.max(8, Math.round(document.widthMm * dotsPerMillimeter));
  let height = Math.max(8, Math.round(document.heightMm * dotsPerMillimeter));
  if (profile.printDirection === 'left') {
    height = Math.ceil(height / 8) * 8;
    if (height > profile.printheadPixels) {
      throw new Error(`当前机型打印高度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
    }
  } else {
    width = Math.ceil(width / 8) * 8;
    if (width > profile.printheadPixels) {
      throw new Error(`当前机型打印宽度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
    }
  }
  return { width, height };
}

module.exports = { PROFILES, alignedCanvasSize, getProfile, guessProfile, profileForModelId };
