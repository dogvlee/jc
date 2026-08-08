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
  // Model IDs from NIIMBOT printerList.json codes[] for 203dpi families
  // whose print task matches verified protocol profiles. 300dpi codes stay unmapped.
  const mapping = {
    2304: 'd110',   // D110
    2305: 'd110',   // D110 / Hi-D110
    2320: 'd110',   // D110_M (same series, 203dpi)
    4096: 'b1',     // B1
    4098: 'b1',     // B1 SE (203dpi; printhead still treated as 384 until hardware log)
    768: 'b21',     // B21
    769: 'b21',     // B21-L2B
    771: 'b21-c2b', // B21-C2B
    775: 'b21-c2b', // B21-C2B alt code
    776: 'b21s',    // B21S-C2B
    777: 'b21s'     // B21S
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
  const size = previewCanvasSize(document, profile.dpi);
  const dotsPerMillimeter = profile.dpi / 25.4;
  let { width, height } = size;
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

/**
 * Non-throwing printability check used before opening the print sheet.
 * Returns the blocking reason plus the first profile that could print the
 * label as-is, so the UI can offer a way out instead of a dead end.
 */
function evaluatePrintability(document, profile) {
  try {
    alignedCanvasSize(document, profile);
    return { ok: true, message: '', suggestProfileId: '' };
  } catch (error) {
    const fallback = PROFILES.find((item) => {
      if (item.id === profile.id) return false;
      try {
        alignedCanvasSize(document, item);
        return true;
      } catch (retryError) {
        return false;
      }
    });
    return {
      ok: false,
      message: error.message,
      suggestProfileId: fallback ? fallback.id : ''
    };
  }
}

function previewCanvasSize(document, dpi) {
  const widthMm = Number(document && document.widthMm);
  const heightMm = Number(document && document.heightMm);
  const dotsPerMillimeter = Number(dpi) / 25.4;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error('标签宽高必须大于 0 mm');
  }
  if (!Number.isFinite(dotsPerMillimeter) || dotsPerMillimeter <= 0) {
    throw new Error('打印分辨率无效');
  }
  return {
    width: Math.max(1, Math.round(widthMm * dotsPerMillimeter)),
    height: Math.max(1, Math.round(heightMm * dotsPerMillimeter))
  };
}

module.exports = {
  PROFILES,
  alignedCanvasSize,
  evaluatePrintability,
  getProfile,
  guessProfile,
  previewCanvasSize,
  profileForModelId
};
