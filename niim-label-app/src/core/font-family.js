const FONTSOURCE = 'https://cdn.jsdelivr.net/npm';
const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';
const GOOGLE_FONTS = 'https://github.com/google/fonts/tree/main/ofl';

function woff2(pkg, file) {
  return `${FONTSOURCE}/${pkg}/files/${file}`;
}

function fontsourceWoff2(id, subset, weight = 400, version = '5.3.0') {
  return `${FONTSOURCE_CDN}/${id}@${version}/${subset}-${weight}-normal.woff2`;
}

function googleFontSource(directory) {
  return `${GOOGLE_FONTS}/${directory}`;
}

function googleFontLicense(directory) {
  return `https://github.com/google/fonts/blob/main/ofl/${directory}/OFL.txt`;
}

const FONT_CATEGORIES = Object.freeze([
  { id: 'system', label: '系统' },
  { id: 'sans', label: '黑体' },
  { id: 'serif', label: '宋体' },
  { id: 'kai', label: '楷体' },
  { id: 'rounded', label: '圆体' },
  { id: 'script', label: '手写' },
  { id: 'mono', label: '等宽' }
]);

/**
 * Open-source CJK catalog. JingChen ZT* / HarmonyOS files are not bundled.
 * Those ids only map to OFL substitutes below.
 */
const FONT_CATALOG = Object.freeze([
  {
    id: 'sans-serif',
    label: '系统黑体',
    shortLabel: '黑体',
    category: 'system',
    family: 'sans-serif',
    cssFamily: 'sans-serif',
    generic: true,
    license: 'system',
    aliases: ['微软雅黑', '苹方', 'PingFang SC', 'Microsoft YaHei', '黑体']
  },
  {
    id: 'serif',
    label: '系统宋体',
    shortLabel: '宋体',
    category: 'system',
    family: 'serif',
    cssFamily: 'serif',
    generic: true,
    license: 'system',
    aliases: ['宋体', 'SimSun']
  },
  {
    id: 'monospace',
    label: '等宽',
    shortLabel: '等宽',
    category: 'mono',
    family: 'monospace',
    cssFamily: 'monospace',
    generic: true,
    license: 'system',
    aliases: ['等宽字体', 'Consolas', 'Menlo']
  },
  {
    id: 'sy-heiti',
    label: '思源黑体',
    shortLabel: '思源黑',
    category: 'sans',
    family: 'Noto Sans SC',
    cssFamily: '"Noto Sans SC", sans-serif',
    license: 'OFL-1.1',
    source: 'Google / Adobe Noto Sans SC',
    sourceUrl: googleFontSource('notosanssc'),
    licenseUrl: googleFontLicense('notosanssc'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/noto-sans-sc@5.2.5', 'noto-sans-sc-chinese-simplified-400-normal.woff2') },
      { weight: 700, url: woff2('@fontsource/noto-sans-sc@5.2.5', 'noto-sans-sc-chinese-simplified-700-normal.woff2') }
    ],
    aliases: [
      '思源黑体', '思源黑体 CN', 'Noto Sans SC', 'Noto Sans CJK SC',
      'Source Han Sans', 'Source Han Sans SC', 'Harmony', 'HarmonyOS',
      'HarmonyOS Sans', 'ZT201', 'ZT032', 'ZT256'
    ]
  },
  {
    id: 'sy-song',
    label: '思源宋体',
    shortLabel: '思源宋',
    category: 'serif',
    family: 'Noto Serif SC',
    cssFamily: '"Noto Serif SC", serif',
    license: 'OFL-1.1',
    source: 'Google / Adobe Noto Serif SC',
    sourceUrl: googleFontSource('notoserifsc'),
    licenseUrl: googleFontLicense('notoserifsc'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/noto-serif-sc@5.2.5', 'noto-serif-sc-chinese-simplified-400-normal.woff2') },
      { weight: 700, url: woff2('@fontsource/noto-serif-sc@5.2.5', 'noto-serif-sc-chinese-simplified-700-normal.woff2') }
    ],
    aliases: ['思源宋体', '思源宋体粗', 'Noto Serif SC', 'Noto Serif CJK SC', 'Source Han Serif', 'Source Han Serif SC']
  },
  {
    id: 'sy-mashan',
    label: '马善政楷书',
    shortLabel: '楷书',
    category: 'kai',
    family: 'Ma Shan Zheng',
    cssFamily: '"Ma Shan Zheng", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts Ma Shan Zheng',
    sourceUrl: googleFontSource('mashanzheng'),
    licenseUrl: googleFontLicense('mashanzheng'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/ma-shan-zheng@5.2.5', 'ma-shan-zheng-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['马善政楷书', '马善政', 'Ma Shan Zheng', 'ZT195', '霞鹜文楷', 'LXGW WenKai', '楷体']
  },
  {
    id: 'sy-xiaowei',
    label: '站酷小薇',
    shortLabel: '小薇',
    category: 'script',
    family: 'ZCOOL XiaoWei',
    cssFamily: '"ZCOOL XiaoWei", serif',
    license: 'OFL-1.1',
    source: 'ZCOOL XiaoWei',
    sourceUrl: googleFontSource('zcoolxiaowei'),
    licenseUrl: googleFontLicense('zcoolxiaowei'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/zcool-xiaowei@5.2.5', 'zcool-xiaowei-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['站酷小薇', 'ZCOOL XiaoWei', 'ZCOOLXiaoWei']
  },
  {
    id: 'sy-huangyou',
    label: '站酷黄油体',
    shortLabel: '黄油',
    category: 'rounded',
    family: 'ZCOOL QingKe HuangYou',
    cssFamily: '"ZCOOL QingKe HuangYou", sans-serif',
    license: 'OFL-1.1',
    source: 'ZCOOL QingKe HuangYou',
    sourceUrl: googleFontSource('zcoolqingkehuangyou'),
    licenseUrl: googleFontLicense('zcoolqingkehuangyou'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/zcool-qingke-huangyou@5.2.5', 'zcool-qingke-huangyou-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['站酷黄油体', '站酷庆科黄油体', 'ZCOOL QingKe HuangYou', 'ZCOOLQingKeHuangYou']
  },
  {
    id: 'sy-kuaile',
    label: '站酷快乐体',
    shortLabel: '快乐',
    category: 'rounded',
    family: 'ZCOOL KuaiLe',
    cssFamily: '"ZCOOL KuaiLe", sans-serif',
    license: 'OFL-1.1',
    source: 'ZCOOL KuaiLe',
    sourceUrl: googleFontSource('zcoolkuaile'),
    licenseUrl: googleFontLicense('zcoolkuaile'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/zcool-kuaile@5.2.5', 'zcool-kuaile-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['站酷快乐体', 'ZCOOL KuaiLe', 'ZCOOLKuaiLe']
  },
  {
    id: 'sy-longcang',
    label: '龙藏体',
    shortLabel: '龙藏',
    category: 'script',
    family: 'Long Cang',
    cssFamily: '"Long Cang", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts Long Cang',
    sourceUrl: googleFontSource('longcang'),
    licenseUrl: googleFontLicense('longcang'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/long-cang@5.2.5', 'long-cang-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['龙藏体', 'Long Cang', 'LongCang']
  },
  {
    id: 'sy-zhimang',
    label: '芝麻体',
    shortLabel: '芝麻',
    category: 'script',
    family: 'Zhi Mang Xing',
    cssFamily: '"Zhi Mang Xing", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts Zhi Mang Xing',
    sourceUrl: googleFontSource('zhimangxing'),
    licenseUrl: googleFontLicense('zhimangxing'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/zhi-mang-xing@5.2.5', 'zhi-mang-xing-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['芝麻体', 'Zhi Mang Xing', 'ZhiMangXing']
  },
  {
    id: 'sy-liujian',
    label: '流江毛草',
    shortLabel: '毛草',
    category: 'script',
    family: 'Liu Jian Mao Cao',
    cssFamily: '"Liu Jian Mao Cao", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts Liu Jian Mao Cao',
    sourceUrl: googleFontSource('liujianmaocao'),
    licenseUrl: googleFontLicense('liujianmaocao'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: woff2('@fontsource/liu-jian-mao-cao@5.2.5', 'liu-jian-mao-cao-chinese-simplified-400-normal.woff2') }
    ],
    aliases: ['流江毛草', 'Liu Jian Mao Cao', 'LiuJianMaoCao']
  },
  {
    id: 'sy-lubrifont-sc',
    label: 'WD-XL 滑油字（简）',
    shortLabel: '滑油简',
    category: 'rounded',
    family: 'WDXL Lubrifont SC',
    cssFamily: '"WDXL Lubrifont SC", sans-serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / WD-XL Lubrifont',
    sourceUrl: googleFontSource('wdxllubrifontsc'),
    licenseUrl: googleFontLicense('wdxllubrifontsc'),
    coverage: '简体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('wdxl-lubrifont-sc', 'chinese-simplified') }
    ],
    aliases: ['WD-XL 滑油字', '滑油字', 'WDXL Lubrifont SC']
  },
  {
    id: 'sy-noto-sans-tc',
    label: '思源黑体 TC（繁）',
    shortLabel: '思源黑繁',
    category: 'sans',
    family: 'Noto Sans TC',
    cssFamily: '"Noto Sans TC", sans-serif',
    license: 'OFL-1.1',
    source: 'Google / Adobe Noto Sans TC',
    sourceUrl: googleFontSource('notosanstc'),
    licenseUrl: googleFontLicense('notosanstc'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('noto-sans-tc', 'chinese-traditional') }
    ],
    aliases: ['思源黑体 TC', 'Noto Sans TC', 'Source Han Sans TC']
  },
  {
    id: 'sy-noto-serif-tc',
    label: '思源宋体 TC（繁）',
    shortLabel: '思源宋繁',
    category: 'serif',
    family: 'Noto Serif TC',
    cssFamily: '"Noto Serif TC", serif',
    license: 'OFL-1.1',
    source: 'Google / Adobe Noto Serif TC',
    sourceUrl: googleFontSource('notoseriftc'),
    licenseUrl: googleFontLicense('notoseriftc'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('noto-serif-tc', 'chinese-traditional') }
    ],
    aliases: ['思源宋体 TC', 'Noto Serif TC', 'Source Han Serif TC']
  },
  {
    id: 'sy-wenkai-tc',
    label: '霞鹜文楷 TC（繁）',
    shortLabel: '文楷繁',
    category: 'kai',
    family: 'LXGW WenKai TC',
    cssFamily: '"LXGW WenKai TC", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / LXGW WenKai TC',
    sourceUrl: googleFontSource('lxgwwenkaitc'),
    licenseUrl: googleFontLicense('lxgwwenkaitc'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('lxgw-wenkai-tc', 'chinese-traditional') }
    ],
    aliases: ['霞鹜文楷 TC', '霞鶩文楷 TC', 'LXGW WenKai TC']
  },
  {
    id: 'sy-wenkai-mono-tc',
    label: '霞鹜文楷等宽 TC（繁）',
    shortLabel: '文楷等宽',
    category: 'mono',
    family: 'LXGW WenKai Mono TC',
    cssFamily: '"LXGW WenKai Mono TC", monospace',
    license: 'OFL-1.1',
    source: 'Google Fonts / LXGW WenKai Mono TC',
    sourceUrl: googleFontSource('lxgwwenkaimonotc'),
    licenseUrl: googleFontLicense('lxgwwenkaimonotc'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('lxgw-wenkai-mono-tc', 'chinese-traditional') }
    ],
    aliases: ['霞鹜文楷等宽 TC', '霞鶩文楷等寬 TC', 'LXGW WenKai Mono TC']
  },
  {
    id: 'sy-marker-gothic',
    label: '霞鹜漫黑（繁）',
    shortLabel: '漫黑',
    category: 'script',
    family: 'LXGW Marker Gothic',
    cssFamily: '"LXGW Marker Gothic", sans-serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / LXGW Marker Gothic',
    sourceUrl: googleFontSource('lxgwmarkergothic'),
    licenseUrl: googleFontLicense('lxgwmarkergothic'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('lxgw-marker-gothic', 'chinese-traditional') }
    ],
    aliases: ['霞鹜漫黑', '霞鶩漫黑', 'LXGW Marker Gothic']
  },
  {
    id: 'sy-huninn',
    label: '粉圆体（繁）',
    shortLabel: '粉圆繁',
    category: 'rounded',
    family: 'Huninn',
    cssFamily: 'Huninn, sans-serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / justfont Huninn',
    sourceUrl: googleFontSource('huninn'),
    licenseUrl: googleFontLicense('huninn'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('huninn', 'chinese-traditional') }
    ],
    aliases: ['粉圆体', '粉圓體', '粉圆', '粉圓', 'Huninn']
  },
  {
    id: 'sy-iansui',
    label: '芫荽（繁）',
    shortLabel: '芫荽',
    category: 'kai',
    family: 'Iansui',
    cssFamily: 'Iansui, serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / Iansui',
    sourceUrl: googleFontSource('iansui'),
    licenseUrl: googleFontLicense('iansui'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('iansui', 'chinese-traditional') }
    ],
    aliases: ['芫荽', 'Iansui']
  },
  {
    id: 'sy-chiron-round-tc',
    label: 'Chiron 圆体 TC（繁）',
    shortLabel: 'Chiron圆',
    category: 'rounded',
    family: 'Chiron GoRound TC',
    cssFamily: '"Chiron GoRound TC", sans-serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / Chiron GoRound TC',
    sourceUrl: googleFontSource('chirongoroundtc'),
    licenseUrl: googleFontLicense('chirongoroundtc'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('chiron-goround-tc', 'chinese-traditional') }
    ],
    aliases: ['Chiron GoRound TC', 'Chiron 圆体', 'Chiron 圓體']
  },
  {
    id: 'sy-chocolate-sans',
    label: '巧克力黑体（繁）',
    shortLabel: '巧克力',
    category: 'sans',
    family: 'Chocolate Classical Sans',
    cssFamily: '"Chocolate Classical Sans", sans-serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / Chocolate Classical Sans',
    sourceUrl: googleFontSource('chocolateclassicalsans'),
    licenseUrl: googleFontLicense('chocolateclassicalsans'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('chocolate-classical-sans', 'chinese-traditional') }
    ],
    aliases: ['巧克力黑体', '巧克力黑體', 'Chocolate Classical Sans']
  },
  {
    id: 'sy-cactus-serif',
    label: '仙人掌明体（繁）',
    shortLabel: '仙人掌',
    category: 'serif',
    family: 'Cactus Classical Serif',
    cssFamily: '"Cactus Classical Serif", serif',
    license: 'OFL-1.1',
    source: 'Google Fonts / Cactus Classical Serif',
    sourceUrl: googleFontSource('cactusclassicalserif'),
    licenseUrl: googleFontLicense('cactusclassicalserif'),
    coverage: '繁体中文',
    files: [
      { weight: 400, url: fontsourceWoff2('cactus-classical-serif', 'chinese-traditional') }
    ],
    aliases: ['仙人掌明体', '仙人掌明體', 'Cactus Classical Serif']
  }
]);

const GENERIC_FONT_FAMILIES = Object.freeze(
  FONT_CATALOG.filter((entry) => entry.generic).map((entry) => entry.id)
);
const GENERIC_FONT_SET = new Set(GENERIC_FONT_FAMILIES);
const FONT_BY_ID = new Map();
const FONT_BY_ALIAS = new Map();

FONT_CATALOG.forEach((entry) => {
  FONT_BY_ID.set(entry.id, entry);
  const keys = [entry.id, entry.family, entry.label, entry.shortLabel]
    .concat(entry.aliases || [])
    .filter(Boolean);
  keys.forEach((key) => {
    const normalized = String(key).trim().toLowerCase();
    if (normalized && !FONT_BY_ALIAS.has(normalized)) FONT_BY_ALIAS.set(normalized, entry);
  });
});

function getFontEntry(value) {
  if (value && typeof value === 'object' && value.id && FONT_BY_ID.has(value.id)) {
    return FONT_BY_ID.get(value.id);
  }
  const requested = String(value == null ? '' : value).trim();
  if (!requested) return FONT_BY_ID.get('sans-serif');
  return FONT_BY_ALIAS.get(requested.toLowerCase()) || FONT_BY_ID.get(resolveFontId(requested));
}

function guessFontId(requested) {
  if (/^zt195$/i.test(requested)) return 'sy-mashan';
  if (/^zt\d+$/i.test(requested) || /harmony/i.test(requested)) return 'sy-heiti';
  if (/宋|serif|song/i.test(requested)) return 'sy-song';
  if (/楷|kai|wenkai/i.test(requested)) return 'sy-mashan';
  if (/圆|rounded|butter|huangyou/i.test(requested)) return 'sy-huangyou';
  if (/手写|毛笔|cursive|script|mashan/i.test(requested)) return 'sy-mashan';
  if (/等宽|mono/i.test(requested)) return 'monospace';
  if (/黑|heiti|gothic/i.test(requested)) return 'sy-heiti';
  return 'sans-serif';
}

function resolveFontId(value) {
  const requested = String(value == null ? '' : value).trim();
  if (!requested) return 'sans-serif';
  const mapped = FONT_BY_ALIAS.get(requested.toLowerCase());
  if (mapped) return mapped.id;
  return guessFontId(requested);
}

function resolveFontFamily(value) {
  const entry = getFontEntry(value);
  return entry ? entry.cssFamily : 'sans-serif';
}

function isKnownFontId(value) {
  const requested = String(value == null ? '' : value).trim().toLowerCase();
  return GENERIC_FONT_SET.has(requested) || FONT_BY_ID.has(requested);
}

function fontFallbackInfo(value, sourceValue) {
  const declared = String(sourceValue || value || '').trim();
  const entry = getFontEntry(value || declared);
  const renderFamily = entry ? entry.id : 'sans-serif';
  return {
    requested: declared,
    renderFamily,
    cssFamily: entry ? entry.cssFamily : 'sans-serif',
    label: entry ? entry.label : '系统黑体',
    fallback: Boolean(declared && !isKnownFontId(declared))
  };
}

function normalizeElementFont(element) {
  if (!element || typeof element !== 'object') return element;
  const info = fontFallbackInfo(element.fontFamily, element.sourceFontFamily);
  if (info.fallback && !element.sourceFontFamily) element.sourceFontFamily = info.requested;
  if (element.fontFamily || element.sourceFontFamily) element.fontFamily = info.renderFamily;
  return element;
}

function listFontCatalog() {
  return FONT_CATALOG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    category: entry.category,
    cssFamily: entry.cssFamily,
    generic: Boolean(entry.generic),
    license: entry.license,
    licenseUrl: entry.licenseUrl || '',
    source: entry.source || '',
    sourceUrl: entry.sourceUrl || '',
    coverage: entry.coverage || '系统字库',
    remote: Boolean((entry.files || []).length)
  }));
}

function collectDocumentFontIds(documentValue) {
  const ids = new Set();
  (documentValue && documentValue.elements ? documentValue.elements : []).forEach((element) => {
    if (!element) return;
    if (element.fontFamily || element.sourceFontFamily) {
      ids.add(resolveFontId(element.fontFamily || element.sourceFontFamily));
    }
  });
  return Array.from(ids);
}

module.exports = {
  FONT_CATALOG,
  FONT_CATEGORIES,
  GENERIC_FONT_FAMILIES,
  collectDocumentFontIds,
  fontFallbackInfo,
  getFontEntry,
  listFontCatalog,
  normalizeElementFont,
  resolveFontFamily,
  resolveFontId
};
