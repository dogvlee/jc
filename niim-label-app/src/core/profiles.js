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

// Physical stock is often slightly wider than the printable head area: a B21
// feeds 50 mm paper but its 384-dot head prints the centered 48.05 mm, and a
// D110 accepts 15 mm tape over a 96-dot (12.01 mm) head. Within this tolerance
// the raster is center-cropped to the head instead of refusing to print.
// Anything beyond it stays a hard error because most of the label would be cut.
const PRINT_CROP_TOLERANCE_MM = 3.5;

function alignedCanvasSize(document, profile) {
  const size = previewCanvasSize(document, profile.dpi);
  const dotsPerMillimeter = profile.dpi / 25.4;
  const toleranceDots = PRINT_CROP_TOLERANCE_MM * dotsPerMillimeter;
  let { width, height } = size;
  if (profile.printDirection === 'left') {
    height = Math.ceil(height / 8) * 8;
    if (height > profile.printheadPixels) {
      if (size.height - profile.printheadPixels > toleranceDots) {
        throw new Error(`当前机型打印高度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
      }
      return {
        width,
        height: profile.printheadPixels,
        cropOffsetX: 0,
        cropOffsetY: Math.floor((size.height - profile.printheadPixels) / 2),
        cropped: true
      };
    }
  } else {
    width = Math.ceil(width / 8) * 8;
    if (width > profile.printheadPixels) {
      if (size.width - profile.printheadPixels > toleranceDots) {
        throw new Error(`当前机型打印宽度最多约 ${(profile.printheadPixels / dotsPerMillimeter).toFixed(1)} mm`);
      }
      return {
        width: profile.printheadPixels,
        height,
        cropOffsetX: Math.floor((size.width - profile.printheadPixels) / 2),
        cropOffsetY: 0,
        cropped: true
      };
    }
  }
  return { width, height };
}

/**
 * The printable window in label millimetres when the stock is wider than the
 * head (center crop), or null when the whole label fits the printhead.
 */
function rotatedBoundsMm(element) {
  const width = Number(element.width) || 0;
  const height = Number(element.height) || 0;
  const centerX = (Number(element.x) || 0) + width / 2;
  const centerY = (Number(element.y) || 0) + height / 2;
  const radians = ((Number(element.rotation) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const boundsWidth = width * cos + height * sin;
  const boundsHeight = width * sin + height * cos;
  return {
    x: centerX - boundsWidth / 2,
    y: centerY - boundsHeight / 2,
    width: boundsWidth,
    height: boundsHeight
  };
}

/**
 * Elements whose visual bounds reach into the physically unprintable margin
 * of center-cropped stock. Empty when the label fits the head entirely.
 */
function elementsCutByCrop(document, profile, types) {
  const window = printableWindowMm(document, profile);
  if (!window) return [];
  const wanted = Array.isArray(types) && types.length ? new Set(types) : null;
  const epsilon = 0.05;
  return (document.elements || []).filter((element) => {
    if (wanted && !wanted.has(element.type)) return false;
    const bounds = rotatedBoundsMm(element);
    return bounds.x < window.x - epsilon
      || bounds.y < window.y - epsilon
      || bounds.x + bounds.width > window.x + window.width + epsilon
      || bounds.y + bounds.height > window.y + window.height + epsilon;
  });
}

function printableWindowMm(document, profile) {
  const size = alignedCanvasSize(document, profile);
  if (!size.cropped) return null;
  const dotsPerMillimeter = profile.dpi / 25.4;
  const croppedAxis = profile.printDirection === 'left' ? 'height' : 'width';
  const printableMm = profile.printheadPixels / dotsPerMillimeter;
  const totalMm = croppedAxis === 'height' ? Number(document.heightMm) : Number(document.widthMm);
  return {
    x: size.cropOffsetX / dotsPerMillimeter,
    y: size.cropOffsetY / dotsPerMillimeter,
    width: croppedAxis === 'width' ? printableMm : Number(document.widthMm),
    height: croppedAxis === 'height' ? printableMm : Number(document.heightMm),
    axis: croppedAxis,
    printableMm,
    marginMm: Math.max(0, (totalMm - printableMm) / 2)
  };
}

/**
 * Non-throwing printability check used before opening the print sheet.
 * Returns the blocking reason plus the first profile that could print the
 * label as-is, so the UI can offer a way out instead of a dead end.
 */
function evaluatePrintability(document, profile) {
  try {
    const size = alignedCanvasSize(document, profile);
    if (size.cropped) {
      const window = printableWindowMm(document, profile);
      const axisLabel = window.axis === 'height' ? '高' : '宽';
      const sideLabel = window.axis === 'height' ? '上下' : '左右';
      const totalMm = window.axis === 'height' ? Number(document.heightMm) : Number(document.widthMm);
      return {
        ok: true,
        message: '',
        suggestProfileId: '',
        notice: `标签${axisLabel} ${totalMm} mm 超过当前机型可打${axisLabel} ${window.printableMm.toFixed(1)} mm，将居中打印，${sideLabel}各约 ${window.marginMm.toFixed(1)} mm 不出墨。首次使用请先试打一张核对边距。`
      };
    }
    return { ok: true, message: '', suggestProfileId: '', notice: '' };
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
    const maximumVerifiedHeadMm = Math.max(...PROFILES.map((item) => (
      item.printheadPixels / (item.dpi / 25.4)
    )));
    return {
      ok: false,
      message: fallback
        ? error.message
        : `${error.message}；现有已验证机型中没有可直接打印该尺寸的配置（最大已验证打印头约 ${maximumVerifiedHeadMm.toFixed(1)} mm）。请改用适配标签纸，或在目标宽幅机型完成协议与真机样张验证后再新增机型配置。`,
      suggestProfileId: fallback ? fallback.id : '',
      notice: ''
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
  elementsCutByCrop,
  evaluatePrintability,
  getProfile,
  guessProfile,
  previewCanvasSize,
  printableWindowMm,
  profileForModelId
};
