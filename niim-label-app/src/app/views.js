const { PROFILES, evaluatePrintability } = require('../core/profiles');
const { formatDateChip, formatTimeChip } = require('../core/renderer');
const { BATCH_TEMPLATES, categories, homeQuickActions, industries, templates } = require('./catalog');
const {
  SCENE_DEFINITIONS,
  countTemplatesByScene,
  sceneForId,
  sceneIdsForTemplate,
  templateMatchesScene
} = require('./scenes');
const { icon, sprite } = require('./icons');
const { STOCK_PRESETS } = require('./stock-presets');
const { buildTemplateDocument } = require('./template-layouts');
const {
  buildLibraryDocument,
  catalogMeta,
  getLibraryEntry,
  librarySceneChips,
  librarySizeChips,
  libraryStats,
  queryLibraryMeta
} = require('../../../label-printer-miniapp/miniprogram/app/shangyue-library/pack');
const LIBRARY_SCENES = librarySceneChips();
const LIBRARY_SIZES = librarySizeChips();
const LIBRARY_TOTAL = libraryStats().total;
const { DEFAULT_MATERIAL_CHIP, MATERIAL_CATALOG, MATERIAL_CHIPS } = require('../core/materials');
const { BORDER_CATALOG, BORDER_CHIPS } = require('../core/borders');
const { TEXT_MODE_OPTIONS, clampTextArcAngle, normalizeTextMode } = require('../core/text-direction');
const { isBatchCompatibleTemplate, resolveBatchCompatibleTemplate } = require('./data-bind');
const { FONT_CATEGORIES, fontFallbackInfo, listFontCatalog } = require('../core/font-family');

const DATE_EXPIRE_PRESETS = [
  { label: '2小时', hours: 2 },
  { label: '4小时', hours: 4 },
  { label: '24小时', hours: 24 },
  { label: '48小时', hours: 48 },
  { label: '72小时', hours: 72 },
  { label: '7天', hours: 168 },
  { label: '14天', hours: 336 },
  { label: '28天', hours: 672 },
  { label: '30天', hours: 720 },
  { label: '60天', hours: 1440 },
  { label: '90天', hours: 2160 },
  { label: '180天', hours: 4320 }
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EDITOR_ASSET_BASE = 'assets/niimbot-editor';

function editorAsset(path, className) {
  return `<img class="editor-native-icon${className ? ` ${className}` : ''}" src="${EDITOR_ASSET_BASE}/${path}" width="24" height="24" alt="" aria-hidden="true" decoding="async" draggable="false">`;
}

function controlIcon(name) {
  return icon(name, 'icon-control');
}

function formatDate(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function bottomNav(route) {
  const items = [
    ['home', 'home', '首页'],
    ['templates', 'template', '模板'],
    ['create', 'plus', '新建'],
    ['data', 'sheet', '批量'],
    ['profile', 'user', '我的']
  ];
  return `<nav class="bottom-nav" aria-label="主导航">
    ${items.map(([target, iconName, label]) => {
      const active = route === target || (target === 'create' && route === 'editor');
      return `<button class="nav-item${target === 'create' ? ' nav-create' : ''}${active ? ' active' : ''}"
data-action="navigate" data-route="${target}" aria-label="${label}" ${active ? 'aria-current="page"' : ''}>
        ${icon(iconName, target === 'create' ? 'icon-lg' : '')}
        ${target === 'create' ? '<span class="sr-only">新建</span>' : `<span>${label}</span>`}
      </button>`;
    }).join('')}
  </nav>`;
}

function templateMotif(meta, kind) {
  const m = meta || {};
  if (m.motif) return String(m.motif);
  const hay = [m.id, m.name, m.category, kind].filter(Boolean).join(' ').toLowerCase();
  if (/婚|席卡|wedding|engag/.test(hay)) return 'wedding';
  if (/药|医|medicine|pharma/.test(hay)) return 'medicine';
  if (/食|餐|烘焙|净菜|效期|food|bakery|kitchen/.test(hay)) return 'food';
  if (/仓储|货架|料箱|物流|快递|仓|warehouse|shipping|bin|storage/.test(hay)) return 'warehouse';
  if (/线缆|线号|cable|wire/.test(hay)) return 'cable';
  if (/名片|name.?card|商务名片/.test(hay)) return 'namecard';
  if (/wifi|wi-?fi|无线/.test(hay)) return 'wifi';
  if (/电力|国网|power|电压/.test(hay)) return 'power';
  if (/珠宝|jewelry/.test(hay)) return 'jewelry';
  if (/服装|款式|clothing|apparel/.test(hay)) return 'clothing';
  if (/姓名贴|名贴|name.?tag/.test(hay)) return 'namecard';
  if (/价|促销|商品|零售|price|promo|product|爆炸/.test(hay)) return 'price';
  if (kind === 'qr') return 'qr';
  if (kind === 'barcode') return 'barcode';
  return 'accent';
}

function thumbSvg(kind, accent, motif) {
  const soft = escapeHtml(accent || '#E85D4C');
  const m = motif || templateMotif({}, kind);
  const Q = String.fromCharCode(34);
  const barcodeBars = (x, y, w, h) => {
    const widths = [1.2,0.7,1.5,0.6,1.1,0.8,1.4,0.7,1.2,0.6,1.6,0.8,1.0,0.7,1.3];
    let cx = x, out = '';
    for (let i = 0; i < widths.length; i++) {
      const bw = widths[i];
      if (cx > x + w) break;
      if (i % 2 === 0) {
        out += '<rect x=' + Q + cx.toFixed(1) + Q;
        out += ' y=' + Q + y + Q + ' width=' + Q + bw + Q;
        out += ' height=' + Q + h + Q + ' fill=' + Q + '#1a1f22' + Q + '/>';
      }
      cx += bw + 0.35;
    }
    return out;
  };
  const qrBlock = (x, y, s) => {
    const cell = s / 7;
    const map = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
    let out = '';
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (!map[r][c]) continue;
        out += '<rect x=' + Q + (x + c * cell).toFixed(1) + Q;
        out += ' y=' + Q + (y + r * cell).toFixed(1) + Q;
        out += ' width=' + Q + (cell - 0.3).toFixed(1) + Q;
        out += ' height=' + Q + (cell - 0.3).toFixed(1) + Q + ' fill=' + Q + '#1a1f22' + Q + '/>';
      }
    }
    [[1,3],[2,1],[3,2],[3,4],[4,1],[4,5],[5,3],[5,5],[2,5],[1,5]].forEach(function (pair) {
      const c = pair[0], r = pair[1];
      out += '<rect x=' + Q + (x + c * cell + s * 0.12).toFixed(1) + Q;
      out += ' y=' + Q + (y + r * cell + s * 0.12).toFixed(1) + Q;
      out += ' width=' + Q + (cell * 0.7).toFixed(1) + Q;
      out += ' height=' + Q + (cell * 0.7).toFixed(1) + Q + ' fill=' + Q + '#1a1f22' + Q + '/>';
    });
    return out;
  };
  let body = '';
  switch (m) {
    case 'wedding':
      body = '<rect x="10" y="14" width="140" height="92" rx="4" fill="#fff" stroke="#e8e0e4" stroke-width="1"/>' + '<path d="M80 28c-4-8-16-6-16 4 0 10 16 20 16 20s16-10 16-20c0-10-12-12-16-4z" fill="' + soft + '" opacity="0.85"/>' + '<text x="80" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#3a2a32" font-family="system-ui,sans-serif">席位卡</text>' + '<text x="80" y="88" text-anchor="middle" font-size="7" fill="#8a7a82" font-family="system-ui,sans-serif">Table 03</text>';
      break;
    case 'food':
      body = '<rect x="10" y="16" width="140" height="88" rx="3" fill="#fff" stroke="#e2e6ea" stroke-width="1"/>' + '<rect x="10" y="16" width="6" height="88" rx="1" fill="' + soft + '"/>' + '<text x="24" y="36" font-size="10" font-weight="700" fill="#1f2724" font-family="system-ui,sans-serif">食品效期</text>' + '<text x="24" y="52" font-size="7.5" fill="#5a6560" font-family="system-ui,sans-serif">制作 08-08 10:00</text>' + '<text x="24" y="66" font-size="7.5" fill="#5a6560" font-family="system-ui,sans-serif">到期 08-09 10:00</text>' + '<text x="30" y="86" font-size="8" font-weight="700" fill="' + soft + '" font-family="system-ui,sans-serif">冷藏 24h</text>';
      break;
    case 'medicine':
      body = '<rect x="12" y="18" width="136" height="84" rx="3" fill="#fff" stroke="#dfe6ea" stroke-width="1"/>' + '<rect x="12" y="18" width="136" height="18" rx="3" fill="' + soft + '"/>' + '<text x="20" y="31" font-size="8" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">药品收纳</text>' + '<text x="20" y="54" font-size="9" font-weight="600" fill="#1a2228" font-family="system-ui,sans-serif">阿莫西林胶囊</text>' + '<text x="20" y="68" font-size="7" fill="#667078" font-family="system-ui,sans-serif">规格 0.25g</text>' + barcodeBars(20, 88, 90, 8);
      break;
    case 'warehouse':
      body = '<rect x="10" y="14" width="140" height="92" rx="3" fill="#fff" stroke="#dce2e8" stroke-width="1"/>' + '<rect x="10" y="14" width="140" height="22" fill="#1a2330"/>' + '<text x="18" y="29" font-size="9" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">A-12-03 库位</text>' + '<text x="18" y="52" font-size="8" fill="#334" font-family="system-ui,sans-serif">SKU 884021</text>' + qrBlock(108, 46, 32) + barcodeBars(18, 78, 80, 18);
      break;
    case 'cable':
      body = '<rect x="8" y="28" width="144" height="64" rx="2" fill="#fff" stroke="#d0d8dc" stroke-width="1"/>' + '<rect x="8" y="28" width="144" height="8" fill="' + soft + '"/>' + '<text x="14" y="52" font-size="9" font-weight="700" fill="#152028" font-family="system-ui,sans-serif">CAT6 U-12-R</text>' + '<text x="14" y="66" font-size="7" fill="#5a6870" font-family="system-ui,sans-serif">机柜 A / 端口 08</text>' + barcodeBars(100, 42, 44, 36);
      break;
    case 'namecard':
      body = '<rect x="14" y="18" width="132" height="84" rx="4" fill="#fff" stroke="#d8dee4" stroke-width="1"/>' + '<circle cx="42" cy="52" r="16" fill="' + soft + '" opacity="0.2"/>' + '<text x="42" y="56" text-anchor="middle" font-size="12" font-weight="700" fill="' + soft + '" font-family="system-ui,sans-serif">王</text>' + '<text x="68" y="46" font-size="11" font-weight="700" fill="#1a2228" font-family="system-ui,sans-serif">王小明</text>' + '<text x="68" y="60" font-size="7.5" fill="#667078" font-family="system-ui,sans-serif">产品经理</text>';
      break;
    case 'wifi':
      body = '<rect x="12" y="16" width="136" height="88" rx="4" fill="#fff" stroke="#dce4ea" stroke-width="1"/>' + '<text x="24" y="40" font-size="10" font-weight="700" fill="#1a2228" font-family="system-ui,sans-serif">Wi-Fi 接入</text>' + '<text x="24" y="56" font-size="7.5" fill="#5a6870" font-family="system-ui,sans-serif">SSID Guest-5G</text>' + '<text x="24" y="70" font-size="7.5" fill="#5a6870" font-family="system-ui,sans-serif">PWD niim2026</text>' + qrBlock(100, 38, 36);
      break;
    case 'power':
      body = '<rect x="10" y="14" width="140" height="92" rx="3" fill="#fff" stroke="#d4dce2" stroke-width="1"/>' + '<rect x="10" y="14" width="140" height="20" fill="#0b6e4f"/>' + '<text x="18" y="28" font-size="8" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">国网电力标识</text>' + '<text x="18" y="52" font-size="9" font-weight="700" fill="#0b3d2e" font-family="system-ui,sans-serif">10kV 开关柜</text>' + qrBlock(108, 42, 32) + '<text x="24" y="89" font-size="7.5" font-weight="700" fill="#0b6e4f" font-family="system-ui,sans-serif">有电危险</text>';
      break;
    case 'jewelry':
      body = '<rect x="18" y="12" width="124" height="96" rx="3" fill="#fff" stroke="#e4dcd0" stroke-width="1"/>' + '<text x="80" y="32" text-anchor="middle" font-size="8" fill="#8B6B4A" font-family="system-ui,sans-serif">JEWELRY</text>' + '<text x="80" y="50" text-anchor="middle" font-size="10" font-weight="700" fill="#2a2218" font-family="system-ui,sans-serif">足金吊坠</text>' + '<text x="80" y="82" text-anchor="middle" font-size="12" font-weight="700" fill="' + soft + '" font-family="system-ui,sans-serif">Y2,680</text>' + barcodeBars(36, 90, 88, 10);
      break;
    case 'clothing':
      body = '<rect x="14" y="12" width="132" height="96" rx="3" fill="#fff" stroke="#ddd6e8" stroke-width="1"/>' + '<rect x="14" y="12" width="132" height="16" fill="' + soft + '" opacity="0.9"/>' + '<text x="80" y="23" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">款式吊牌</text>' + '<text x="24" y="44" font-size="9" font-weight="700" fill="#221a2a" font-family="system-ui,sans-serif">春夏连衣裙</text>' + '<text x="24" y="90" font-size="11" font-weight="700" fill="' + soft + '" font-family="system-ui,sans-serif">Y299</text>' + barcodeBars(78, 78, 58, 22);
      break;
    case 'price':
      body = '<rect x="10" y="14" width="140" height="92" rx="3" fill="#fff" stroke="#e2e6ea" stroke-width="1"/>' + '<text x="18" y="34" font-size="9" font-weight="700" fill="#1a2228" font-family="system-ui,sans-serif">精选商品</text>' + '<text x="18" y="48" font-size="7" fill="#6a7278" font-family="system-ui,sans-serif">规格 500g</text>' + '<text x="18" y="72" font-size="16" font-weight="800" fill="' + soft + '" font-family="system-ui,sans-serif">Y12.90</text>' + barcodeBars(18, 82, 100, 16);
      break;
    case 'qr':
      body = '<rect x="12" y="16" width="136" height="88" rx="3" fill="#fff" stroke="#dde3e8" stroke-width="1"/>' + '<text x="20" y="36" font-size="9" font-weight="700" fill="#1a2228" font-family="system-ui,sans-serif">扫码查看</text>' + '<text x="20" y="52" font-size="7.5" fill="#667078" font-family="system-ui,sans-serif">资产 / 链接</text>' + qrBlock(96, 32, 42);
      break;
    case 'barcode':
      body = '<rect x="10" y="18" width="140" height="84" rx="3" fill="#fff" stroke="#dde3e8" stroke-width="1"/>' + '<text x="18" y="36" font-size="9" font-weight="700" fill="#1a2228" font-family="system-ui,sans-serif">商品条码标签</text>' + '<text x="18" y="50" font-size="7" fill="#6a7278" font-family="system-ui,sans-serif">品名规格批次</text>' + barcodeBars(18, 58, 124, 28);
      break;
    default:
      body = '<rect x="12" y="16" width="136" height="88" rx="3" fill="#fff" stroke="#dde3e8" stroke-width="1"/>';
  }
  return '<svg class=' + Q + 'tpl-thumb-svg' + Q + ' viewBox=' + Q + '0 0 160 120' + Q + ' xmlns=' + Q + 'http://www.w3.org/2000/svg' + Q + ' aria-hidden=' + Q + 'true' + Q + '>' + body + '</svg>';
}

function labelThumb(kind, size, accent, thumbMeta) {
  const wide = size && size[0] / size[1] > 2.2;
  const Q = String.fromCharCode(34);
  const style = accent ? (' style=' + Q + '--thumb-accent:' + escapeHtml(accent) + Q) : '';
  const meta = thumbMeta || {};
  if (meta.thumbSrc) {
    const Qs = String.fromCharCode(34);
    const st = accent ? (" style=" + Qs + "--thumb-accent:" + escapeHtml(accent) + Qs) : "";
    const attrs = [meta.id ? ("data-thumb-id=" + Qs + escapeHtml(meta.id) + Qs) : "", meta.source ? ("data-thumb-source=" + Qs + escapeHtml(meta.source) + Qs) : "", "data-role=" + Qs + "template-thumb" + Qs, "data-thumb-static=" + Qs + "1" + Qs].filter(Boolean).join(" ");
    return "<div class=" + Qs + "label-thumbnail thumb-v2 has-thumb" + Qs + " aria-hidden=" + Qs + "true" + Qs + st + " " + attrs + "><img class=" + Qs + "thumb-image" + Qs + " src=" + Qs + escapeHtml(meta.thumbSrc) + Qs + " alt=" + Qs + Qs + " loading=" + Qs + "lazy" + Qs + " decoding=" + Qs + "async" + Qs + " style=" + Qs + "display:block;width:100%;height:100%;object-fit:contain;background:#fff" + Qs + "></div>";
  }

  const motif = templateMotif(meta, kind);
  const attrs = [
    meta.id ? ('data-thumb-id=' + Q + escapeHtml(meta.id) + Q) : '',
    meta.source ? ('data-thumb-source=' + Q + escapeHtml(meta.source) + Q) : '',
    'data-role=' + Q + 'template-thumb' + Q
  ].filter(Boolean).join(' ');
  return '<div class=' + Q + 'label-thumbnail thumb-v2' + (wide ? ' wide-stock' : '') + Q + ' aria-hidden=' + Q + 'true' + Q + style + ' ' + attrs + '>'
    + '<img class=' + Q + 'thumb-image' + Q + ' alt=' + Q + Q + ' hidden>'
    + '<div class=' + Q + 'mini-label-svg fallback-thumb' + Q + '>'
    + thumbSvg(kind, accent, motif)
    + '</div></div>';
}

function templateBadge(badge) {
  if (!badge) return '';
  return `<span class="template-badge">${escapeHtml(badge)}</span>`;
}

function templateOriginLabel(template) {
  if (!template || template.userTemplate) return '';
  if (template.source === 'shangyue-library') return '商跃生成';
  if (template.approvedOriginal === true && template.origin === 'shangyue-original') return '商跃原创';
  if (template.authorizedRedesign === true && template.origin === 'shangyue-authorized-redesign') return '精诚授权改编';
  if (!template.source || template.source === 'builtin-base') return '内置基础 · 权属待审';
  return /niim/i.test(String(template.source)) ? '精臣来源' : '第三方来源';
}

function templateSourceBadge(template) {
  const label = templateOriginLabel(template);
  if (!label || label === '商跃原创') return '';
  return `<span class="template-source-badge">${label}</span>`;
}

function templateCard(template, options) {
  const action = (options && options.action) || 'preview-template';
  const thumbSource = template.userTemplate ? 'user' : 'catalog';
  const primaryScene = sceneForId(sceneIdsForTemplate(template)[0]);
  return `<button class="template-card" data-action="${action}" data-id="${escapeHtml(template.id)}">
    ${templateBadge(template.badge)}
    ${templateSourceBadge(template)}
    ${labelThumb(template.kind, template.size, template.accent, { id: template.id, source: thumbSource, name: template.name, category: template.category, motif: template.motif, thumbSrc: template.thumbSrc || '' })}
    <div class="card-body">
      <p class="card-title">${escapeHtml(template.name)}</p>
      <div class="card-meta">${template.size[0]}×${template.size[1]} mm · ${escapeHtml(template.category)}${primaryScene ? ` · ${escapeHtml(primaryScene.label)}` : ''}</div>
      ${template.blurb ? `<div class="card-blurb">${escapeHtml(template.blurb)}</div>` : ''}
    </div>
  </button>`;
}

function myTemplateCard(project) {
  const document = project.document;
  const size = [document.widthMm, document.heightMm];
  return `<div class="my-template-card-wrap">
    <button class="my-template-card" data-action="open-project" data-id="${escapeHtml(project.id)}">
      ${labelThumb(projectKind(project), size, '', { id: project.id, source: 'project', thumbSrc: project.thumbSrc || '' })}
      <div class="card-body">
        <p class="card-title">${escapeHtml(document.name)}</p>
        <div class="card-meta">${document.widthMm}×${document.heightMm} mm</div>
        <div class="my-template-actions">
          <span class="meta-chip">${formatDate(project.updatedAt)}</span>
          <span class="meta-chip printish">${icon('printer', 'icon-sm')}</span>
        </div>
      </div>
    </button>
  </div>`;
}

function userTemplateManageCard(card) {
  const folder = card.folder || '未分类';
  return `<div class="my-template-card-wrap">
    <button class="template-card" data-action="preview-template" data-id="${escapeHtml(card.id)}">
      ${labelThumb(card.kind, card.size, '', { id: card.id, source: 'user' })}
      <div class="card-body">
        <p class="card-title">${escapeHtml(card.name)}</p>
        <div class="card-meta">${card.size[0]}×${card.size[1]} mm · ${escapeHtml(folder)}</div>
      </div>
    </button>
    <button class="card-overflow" data-action="manage-user-template" data-id="${escapeHtml(card.id)}" title="管理模板" aria-label="管理 ${escapeHtml(card.name)}">${icon('settings', 'icon-sm')}</button>
  </div>`;
}

function userTemplateCard(template) {
  const documentValue = template.document || {};
  return {
    id: template.id,
    name: template.name || documentValue.name || '我的模板',
    category: '我的',
    size: [Number(documentValue.widthMm) || 40, Number(documentValue.heightMm) || 12],
    kind: projectKind({ document: documentValue }),
    uses: template.uses || 0,
    document: documentValue,
    userTemplate: true,
    folder: template.folder || '未分类',
    thumbSrc: template.thumbSrc || '',
    accent: template.accent
  };
}

function genuineUserTemplates(state) {
  return (state.userTemplates || []).filter((template) => !template.source || template.source === 'user');
}

function projectKind(project) {
  const elements = project.document.elements || [];
  if (elements.some((item) => item.type === 'qrcode')) return 'qr';
  if (elements.some((item) => item.type === 'barcode')) return 'barcode';
  return 'accent';
}

function projectCard(project) {
  const document = project.document;
  return `<button class="project-card" data-action="open-project" data-id="${escapeHtml(project.id)}">
    ${labelThumb(projectKind(project), [document.widthMm, document.heightMm])}
    <div class="card-body">
      <p class="card-title">${escapeHtml(document.name)}</p>
      <div class="card-meta">${document.widthMm} x ${document.heightMm} mm · ${formatDate(project.updatedAt)}</div>
    </div>
  </button>`;
}

function homeView(state) {
  const seededSources = new Set(['catalog-seed', 'niim-import', 'online-niim']);
  const myTemplates = state.projects
    .filter((project) => !seededSources.has(project.source))
    .slice(0, 4);
  const featuredPool = templates
    .filter((item) => item.publicCatalog === true && item.releaseApproved === true);
  const featured = [];
  SCENE_DEFINITIONS.forEach((scene) => {
    const representative = featuredPool.find((item) => (
      sceneIdsForTemplate(item)[0] === scene.id && !featured.some((entry) => entry.id === item.id)
    )) || featuredPool.find((item) => (
      templateMatchesScene(item, scene.id) && !featured.some((entry) => entry.id === item.id)
    ));
    if (representative) featured.push(representative);
  });
  featuredPool.forEach((item) => {
    if (featured.length < 6 && !featured.some((entry) => entry.id === item.id)) featured.push(item);
  });
  const stock = state.settings.installedStock || 'T40×12 203 空白标签';
  const sceneCounts = countTemplatesByScene(templates);
  return `${sprite()}
    <header class="home-hero">
      <div class="home-hero-top">
        <div class="brand-lockup">
          <span class="brand-mark">S</span>
          <div><h1>商跃标签</h1><div class="topbar-subtitle">模板 · 编辑 · 蓝牙打印</div></div>
        </div>
        <div class="topbar-actions">
          <button class="icon-button ghost" data-action="help" title="帮助">${icon('help')}</button>
          <button class="device-chip${state.device ? ' connected' : ''}" data-action="open-devices" title="打印机">
            ${icon(state.device ? 'printer' : 'bluetooth', 'icon-sm')}
            <span>${state.device ? escapeHtml(state.device.name) : '未连接'}</span>
          </button>
        </div>
      </div>
      <div class="quick-tiles">
        ${homeQuickActions.map((item) => {
          const attrs = item.templateId
            ? `data-action="preview-template" data-id="${escapeHtml(item.templateId)}"`
            : `data-action="${escapeHtml(item.action)}"`;
          return `<button class="quick-tile tone-${escapeHtml(item.tone)}" ${attrs}>
            <span class="quick-tile-icon">${icon(item.icon)}</span>
            <span>${escapeHtml(item.label)}</span>
          </button>`;
        }).join('')}
      </div>
    </header>
    <main class="page home-page">
      <section class="section home-scene-section">
        <div class="section-heading">
          <span class="ux-head-ico">${icon('template', 'icon-sm')}</span>
          <div><h2>按经营场景开始</h2><p class="section-subtitle">先选用途，再挑能直接改字打印的模板</p></div>
          <button type="button" class="section-link" data-action="navigate" data-route="templates">全部${icon('chevronRight', 'icon-sm')}</button>
        </div>
        <div class="scene-card-grid">
          ${SCENE_DEFINITIONS.map((scene) => `<button type="button" class="scene-card tone-${escapeHtml(scene.tone)}" data-action="open-scene" data-scene="${escapeHtml(scene.id)}" aria-label="打开${escapeHtml(scene.label)}模板，共 ${sceneCounts[scene.id] || 0} 张">
            <span class="scene-card-icon">${icon(scene.icon)}</span>
            <span class="scene-card-copy"><strong>${escapeHtml(scene.label)}</strong><small>${escapeHtml(scene.description)}</small></span>
            <span class="scene-card-count">${sceneCounts[scene.id] || 0}</span>
          </button>`).join('')}
        </div>
      </section>

      <button type="button" class="promo-banner" data-action="preview-template" data-id="shangyue-wifi-card">
        <span class="ux-promo-icon">${icon('wifi')}</span>
        <div>
          <strong>打开 Wi-Fi 标签模板</strong>
          <p>进入编辑器后填写网络名称、密码和二维码内容</p>
        </div>
        <span class="promo-cta">打开模板</span>
      </button>

      <section class="section">
        <div class="stock-card">
          <div class="stock-thumb">${labelThumb('accent', [40, 12], '#F2B84B')}</div>
          <div class="stock-body">
            <div class="ux-stock-head">
              <div class="stock-label">已安装标签</div>
              <p class="device-name">${escapeHtml(stock)}</p>
            </div>
            <div class="device-meta"><span>新建标签将默认使用此尺寸</span></div>
          </div>
          <div class="stock-actions">
            <button type="button" class="button-secondary compact" data-action="open-stock-sheet">换纸</button>
            <button type="button" class="button compact" data-action="create-label">新建</button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <span class="ux-head-ico">${icon('sheet', 'icon-sm')}</span>
          <h2>最近编辑</h2>
          <div class="heading-actions">
            <button type="button" class="section-link" data-action="print-history">${icon('history', 'icon-sm')}打印历史</button>
            <button type="button" class="section-link" data-action="all-projects">全部${icon('chevronRight', 'icon-sm')}</button>
          </div>
        </div>
        ${myTemplates.length
          ? `<div class="my-template-grid">${myTemplates.map(myTemplateCard).join('')}</div>`
          : `<div class="empty-state soft"><span class="empty-state-icon">${icon('template')}</span><div>还没有我的模板</div><button type="button" class="button" data-action="navigate" data-route="templates">去模板库挑选</button></div>`}
      </section>

      ${state.recentPrints && state.recentPrints.length ? `<section class="section">
        <div class="section-heading">
          <span class="ux-head-ico">${icon('history', 'icon-sm')}</span>
          <h2>最近打印</h2>
          <button type="button" class="section-link" data-action="print-history">打印历史${icon('chevronRight', 'icon-sm')}</button>
        </div>
        <div class="recent-prints-row" aria-label="最近打印的标签">
          ${state.recentPrints.slice(0, 6).map(renderRecentPrint).join('')}
        </div>
      </section>` : ''}

      <section class="section">
        <div class="section-heading">
          <span class="ux-head-ico">${icon('template', 'icon-sm')}</span>
          <h2>推荐模板</h2>
          <button type="button" class="section-link" data-action="navigate" data-route="templates">更多${icon('chevronRight', 'icon-sm')}</button>
        </div>
        <div class="template-grid home-template-grid">${featured.map((item) => templateCard(item)).join('')}</div>
      </section>

      <section class="section">
        <div class="section-heading"><span class="ux-head-ico">${icon('plus', 'icon-sm')}</span><h2>快捷创建</h2></div>
        <div class="quick-grid secondary-quick">
          <button type="button" class="quick-action" data-action="create-label"><span class="quick-icon">${icon('plus')}</span><span>空白标签</span></button>
          <button type="button" class="quick-action" data-action="navigate" data-route="data"><span class="quick-icon">${icon('sheet')}</span><span>批量打印</span></button>
          <button type="button" class="quick-action" data-action="import-project"><span class="quick-icon">${icon('folder')}</span><span>导入项目</span></button>
          <button type="button" class="quick-action" data-action="open-devices"><span class="quick-icon">${icon('bluetooth')}</span><span>连接设备</span></button>
        </div>
      </section>
    </main>
    ${bottomNav('home')}`;
}

function renderRecentPrint(item) {
  const record = item || {};
  return `<button type="button" class="recent-print" data-action="reprint-history" data-id="${escapeHtml(record.projectId || record.id || '')}" data-kind="${escapeHtml(record.kind || 'accent')}" aria-label="重新打印 ${escapeHtml(record.name || '未命名标签')}">
    ${labelThumb(record.kind || 'accent', [(record.widthMm || 40), (record.heightMm || 30)])}
    <span class="recent-print-name">${escapeHtml(record.name || '未命名标签')}</span>
    <span class="recent-print-meta">${escapeHtml(record.sizeText || '')}</span>
  </button>`;
}

function onboardingStepMarkup(state) {
  const step = state.onboardingStep || 1;
  const steps = [
    { icon: 'bluetooth', title: '连接打印机', text: '开机后在蓝牙列表里找到你的标签机，点击即可连接' },
    { icon: 'template', title: '挑选模板', text: `${templates.length} 个通过权属门禁的场景模板，也可以从空白开始编辑` },
    { icon: 'printer', title: '编辑并打印', text: '改文字、调大小，点打印就出纸' }
  ];
  const current = steps[step - 1] || steps[0];
  return `<span class="onboarding-step-icon">${icon(current.icon)}</span>
    <h2>${current.title}</h2>
    <p>${current.text}</p>`;
}

function projectsView(state) {
  const queryValue = state.projectQuery || '';
  const query = queryValue.trim().toLowerCase();
  const filtered = state.projects.filter((project) => {
    const documentValue = project.document || {};
    const haystack = `${documentValue.name || ''} ${documentValue.widthMm || ''}×${documentValue.heightMm || ''}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  const visibleCount = Math.max(24, Number(state.projectVisibleCount) || 24);
  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visible.length);
  return `${sprite()}
    <header class="topbar brand-topbar">
      <button type="button" class="icon-button" data-action="navigate" data-route="home" title="返回首页" aria-label="返回首页">${icon('back')}</button>
      <div class="topbar-title"><h1>我的标签</h1><div class="topbar-subtitle">显示 ${visible.length} / ${filtered.length} 个</div></div>
      <button type="button" class="icon-button" data-action="create-label" title="新建标签" aria-label="新建标签">${icon('plus')}</button>
    </header>
    <main class="page projects-page">
      <div class="search-row">${icon('search')}<input class="search-input" type="search" data-action="project-search" value="${escapeHtml(queryValue)}" placeholder="搜索标签名称或尺寸" aria-label="搜索我的标签"></div>
      ${visible.length
        ? `<div class="my-template-grid projects-grid">${visible.map(myTemplateCard).join('')}</div>
           ${remaining ? `<div class="load-more-row"><button type="button" class="button-secondary load-more-button" data-action="load-more-projects">显示更多（剩余 ${remaining}）</button></div>` : ''}`
        : `<div class="empty-state"><span class="empty-state-icon">${icon(query ? 'search' : 'sheet')}</span><div>${query ? `没有找到“${escapeHtml(queryValue.trim())}”` : '还没有标签'}</div>${query ? `<button type="button" class="button-secondary" data-action="clear-project-search">清除搜索</button>` : `<button type="button" class="button" data-action="create-label">新建空白标签</button>`}</div>`}
    </main>
    ${bottomNav('home')}`;
}

function templatesView(state) {
  const userTemplates = genuineUserTemplates(state);
  const userFolders = ['全部', ...Array.from(new Set(userTemplates.map((item) => item.folder || '未分类')))];
  const query = state.templateQuery.trim().toLowerCase();
  const approvedBundled = templates.filter((item) => item.approvedOriginal === true && item.origin === 'shangyue-original').length;
  const authorizedBundled = templates.filter((item) => item.authorizedRedesign === true && item.origin === 'shangyue-authorized-redesign').length;
  const cleanroomBundled = templates.filter((item) => item.packVersion && item.taskLabel).length;
  const visibleCount = Math.max(24, Number(state.templateVisibleCount) || 24);
  const selectedScene = sceneForId(state.templateScene);
  const selectedTask = state.templateTask || '全部';
  const selectedSize = state.templateSize || '全部尺寸';
  const libraryMode = state.templateIndustry === '行业库';
  const available = libraryMode ? [] : templateLibraryPool(state);
  const taskOptions = ['全部', ...Array.from(new Set(available
    .filter((item) => !selectedScene || templateMatchesScene(item, selectedScene.id))
    .map((item) => item.taskLabel)
    .filter(Boolean)))];
  const sizeOptions = ['全部尺寸', ...Array.from(new Set(available
    .filter((item) => !selectedScene || templateMatchesScene(item, selectedScene.id))
    .filter((item) => selectedTask === '全部' || item.taskLabel === selectedTask)
    .filter((item) => Array.isArray(item.size) && item.size.length >= 2)
    .map((item) => `${item.size[0]}×${item.size[1]}`)))];
  const filtered = libraryMode
    ? queryLibraryMeta({
      sceneLabel: state.libraryScene,
      size: state.librarySize,
      query,
      limit: visibleCount
    }).items
    : available.filter((item) => {
      const categoryMatch = state.templateCategory === '全部' || item.category === state.templateCategory;
      const folderMatch = state.templateCategory !== '我的'
        || !state.templateFolder
        || state.templateFolder === '全部'
        || item.folder === state.templateFolder;
      const industryMatch = !state.templateIndustry || state.templateIndustry === '全部' || item.industry === state.templateIndustry || item.userTemplate;
      const sceneMatch = templateMatchesScene(item, state.templateScene);
      const taskMatch = !state.templateTask || state.templateTask === '全部' || item.taskLabel === state.templateTask;
      const sizeMatch = selectedSize === '全部尺寸' || (Array.isArray(item.size) && `${item.size[0]}×${item.size[1]}` === selectedSize);
      const queryMatch = !query || `${item.name} ${item.category} ${item.folder || ''} ${item.blurb || ''} ${item.industry || ''} ${item.sceneLabel || ''} ${item.taskLabel || ''} ${item.seriesGroup || ''}`.toLowerCase().includes(query);
      return categoryMatch && folderMatch && industryMatch && sceneMatch && taskMatch && sizeMatch && queryMatch;
    });
  const filteredTotal = libraryMode
    ? queryLibraryMeta({ sceneLabel: state.libraryScene, size: state.librarySize, query, limit: 1 }).total
    : filtered.length;
  const total = libraryMode ? LIBRARY_TOTAL : available.length;
  const visible = libraryMode ? filtered : filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filteredTotal - visible.length);
  const loadMoreHtml = remaining
    ? `<div class="load-more-row"><button type="button" class="button-secondary load-more-button" data-action="load-more-templates">显示更多（当前已载入还剩 ${remaining}）</button></div>`
    : '';
  const activeFilters = [
    state.templateCategory !== '全部' ? state.templateCategory : '',
    state.templateCategory === '我的' && state.templateFolder !== '全部' ? state.templateFolder : '',
    (state.templateIndustry && state.templateIndustry !== '全部') ? state.templateIndustry : '',
    selectedScene ? selectedScene.label : '',
    (state.templateTask && state.templateTask !== '全部') ? state.templateTask : '',
    selectedSize !== '全部尺寸' ? `${selectedSize} mm` : '',
    query ? `“${state.templateQuery.trim()}”` : ''
  ].filter(Boolean);
  return `${sprite()}
    <header class="topbar brand-topbar">
      <div class="topbar-title"><h1>模板库</h1><div class="topbar-subtitle">${activeFilters.length
        ? `筛选出 ${filteredTotal} / ${total} 个 · 显示 ${visible.length}`
        : `${total} 个可用（已载入） · 当前显示 ${visible.length}`}</div></div>
      ${activeFilters.length ? `<button type="button" class="section-link" data-action="reset-template-filters">清除筛选</button>` : ''}
      <button type="button" class="icon-button" data-action="import-project" title="导入项目" aria-label="导入项目">${icon('upload')}</button>
    </header>
    <main class="page templates-page">
      <div class="search-row">${icon('search')}<input class="search-input" type="search" data-action="template-search" value="${escapeHtml(state.templateQuery)}" placeholder="搜索模板名称、行业、用途"></div>
      <div class="scene-filter-strip" role="tablist" aria-label="经营场景">
        <button type="button" class="scene-filter${!selectedScene ? ' active' : ''}" data-action="template-scene" data-scene="全部" role="tab" aria-label="全部场景" aria-selected="${!selectedScene}"><span>${icon('template', 'icon-sm')}</span>全部场景</button>
        ${SCENE_DEFINITIONS.map((scene) => `<button type="button" class="scene-filter${state.templateScene === scene.id ? ' active' : ''}" data-action="template-scene" data-scene="${escapeHtml(scene.id)}" role="tab" aria-label="${escapeHtml(scene.label)}" aria-selected="${state.templateScene === scene.id}"><span>${icon(scene.icon, 'icon-sm')}</span>${escapeHtml(scene.label)}</button>`).join('')}
      </div>
      ${!libraryMode && taskOptions.length > 1 ? `<section class="template-task-row" aria-label="原创任务系列">
        <strong>热门任务</strong>
        <div class="template-task-strip" role="tablist" aria-label="按打印任务筛选">
          ${taskOptions.map((task) => { const active = (state.templateTask || '全部') === task; return `<button type="button" class="template-task-chip${active ? ' active' : ''}" data-action="template-task" data-task="${escapeHtml(task)}" role="tab" aria-selected="${active}">${escapeHtml(task === '全部' ? '全部任务' : task)}</button>`; }).join('')}
        </div>
      </section>` : ''}
      ${!libraryMode && sizeOptions.length > 2 ? `<section class="template-task-row template-size-row" aria-label="按纸张尺寸筛选">
        <strong>纸张尺寸</strong>
        <div class="template-task-strip template-size-strip" role="tablist" aria-label="模板纸张尺寸">
          ${sizeOptions.map((size) => { const active = selectedSize === size; return `<button type="button" class="template-task-chip template-size-chip${active ? ' active' : ''}" data-action="template-size" data-size="${escapeHtml(size)}" role="tab" aria-selected="${active}">${escapeHtml(size === '全部尺寸' ? size : `${size} mm`)}</button>`; }).join('')}
        </div>
      </section>` : ''}
      <div class="industry-chips" role="tablist" aria-label="模板类型">
        ${[...industries, '行业库'].map((industry) => { const active = (state.templateIndustry || '全部') === industry; return `<button class="industry-chip${active ? ' active' : ''}" data-action="template-industry" data-industry="${escapeHtml(industry)}" role="tab" aria-selected="${active}" tabindex="${active ? '0' : '-1'}">${escapeHtml(industry)}</button>`; }).join('')}
      </div>
      ${state.templateIndustry === '行业库' ? `<div class="industry-chips" role="tablist" aria-label="纸张尺寸（宽×高）">${LIBRARY_SIZES.map((size) => {
          const active = (state.librarySize || '全部') === size;
          return `<button class="industry-chip${active ? ' active' : ''}" data-action="library-size" data-size="${escapeHtml(size)}" role="tab" aria-selected="${active}">${escapeHtml(size === '全部' ? size : `${size} mm`)}</button>`;
        }).join('')}</div>` : ''}
      <div class="segmented" role="tablist" aria-label="${state.templateIndustry === '行业库' ? '行业场景' : '应用行业'}">${(state.templateIndustry === '行业库' ? LIBRARY_SCENES : [...categories, ...(userTemplates.length ? ['我的'] : [])]).map((category) => {
          const active = state.templateIndustry === '行业库'
            ? (state.libraryScene || '全部') === category
            : state.templateCategory === category;
          const action = state.templateIndustry === '行业库' ? 'library-scene' : 'template-category';
          const dataAttr = state.templateIndustry === '行业库' ? `data-scene="${escapeHtml(category)}"` : `data-category="${category}"`;
          return `<button class="segment${active ? ' active' : ''}" data-action="${action}" ${dataAttr} role="tab" aria-selected="${active}" tabindex="${active ? '0' : '-1'}">${escapeHtml(category)}</button>`;
        }).join('')}</div>
      ${state.templateCategory === '我的' && userFolders.length > 1 ? `<div class="industry-chips template-folder-chips" role="tablist" aria-label="我的模板文件夹">${userFolders.map((folder) => {
        const active = (state.templateFolder || '全部') === folder;
        return `<button type="button" class="industry-chip${active ? ' active' : ''}" data-action="template-folder" data-folder="${escapeHtml(folder)}" role="tab" aria-selected="${active}">${escapeHtml(folder)}</button>`;
      }).join('')}</div>` : ''}
      <div class="device-meta catalog-sync-meta" role="status" aria-live="polite">
        <span>商跃原创 ${approvedBundled}${authorizedBundled ? ` · 已获书面授权改编 ${authorizedBundled}` : ' · 待授权内容不公开'}</span>
        <span>原创任务系列 ${cleanroomBundled} · 场景预设 ${LIBRARY_TOTAL}</span>
      </div>
      ${filtered.length
        ? `<div class="template-grid rich">${visible.map((item) => (
          item.userTemplate ? userTemplateManageCard(item) : templateCard(item)
        )).join('')}</div>`
        : `<div class="empty-state"><span class="empty-state-icon">${icon('search')}</span><div>${activeFilters.length
          ? `「${escapeHtml(activeFilters.join(' · '))}」下没有模板`
          : '没有匹配的模板'}</div><button type="button" class="button-secondary" data-action="reset-template-filters">清除全部筛选</button></div>`}
      ${loadMoreHtml}
    </main>
    ${bottomNav('templates')}`;
}

function templateLibraryPool(state) {
  const userCards = genuineUserTemplates(state).map(userTemplateCard);
  if (state.templateCategory === '我的') return userCards;
  if (state.route === 'templates' && state.templateIndustry === '行业库') {
    return queryLibraryMeta({
      sceneLabel: state.libraryScene,
      size: state.librarySize,
      query: state.templateQuery,
      limit: Math.max(24, Number(state.templateVisibleCount) || 24)
    }).items;
  }
  const bundled = templates.filter((item) => item.publicCatalog === true && item.releaseApproved === true);
  const catalogIds = new Set(bundled.map((item) => item.id));
  return [...bundled, ...userCards.filter((item) => !catalogIds.has(item.id))];
}

function dataView(state) {
  const columns = ['name', 'code', 'price', 'date'];
  const labels = { name: '名称', code: '条码', price: '价格', date: '日期' };
  return `${sprite()}
    <header class="topbar">
      ${state.dataReturnToEditor && state.document ? `<button type="button" class="icon-button" data-action="return-to-editor" title="返回编辑器" aria-label="返回编辑器">${icon('back')}</button>` : ''}
      <div class="topbar-title"><h1>批量数据</h1><div class="topbar-subtitle">${state.dataRows.length} 条记录</div></div>
      <span class="meta-chip" data-role="data-save-status" aria-live="polite">已保存</span>
    </header>
    <main class="page">
      <section class="section">
        <div class="section-heading">
          <span class="ux-head-ico">${icon('sheet', 'icon-sm')}</span>
          <h2>数据明细</h2>
          <div class="heading-actions">
            <button type="button" class="button" data-action="add-data-row">${icon('plus', 'icon-sm')}添加行</button>
            <button type="button" class="button-secondary" data-action="import-csv">${icon('upload', 'icon-sm')}导入 CSV</button>
            <button type="button" class="button-secondary" data-action="export-csv">${icon('download', 'icon-sm')}导出 CSV</button>
            <button type="button" class="button" data-action="open-batch-sheet">${icon('template', 'icon-sm')}生成标签</button>
          </div>
        </div>
        <p class="data-hint">将 CSV 行套用到行业模板：名称→标题文字，条码→一维码/二维码，价格/日期→对应字段</p>
        ${state.dataRows.length
          ? `<div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th class="row-number">#</th>${columns.map((column) => `<th>${labels[column]}</th>`).join('')}<th>操作</th></tr></thead>
          <tbody>${state.dataRows.map((row, rowIndex) => `<tr>
            <td class="row-number">${rowIndex + 1}</td>
            ${columns.map((column) => `<td><input data-action="update-data-cell" data-row="${rowIndex}" data-field="${column}" value="${escapeHtml(row[column])}"></td>`).join('')}
            <td><button type="button" class="icon-button" data-action="remove-data-row" data-row="${rowIndex}" title="删除" aria-label="删除第 ${rowIndex + 1} 行">${icon('trash', 'icon-sm')}</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`
          : `<div class="empty-state"><span class="empty-state-icon">${icon('sheet')}</span><div>还没有数据行</div><button type="button" class="button" data-action="add-data-row">添加第一行</button></div>`}
      </section>
    </main>
    ${bottomNav('data')}`;
}

function profileView(state) {
  return `${sprite()}
    <header class="topbar"><div class="topbar-title"><h1>我的</h1><div class="topbar-subtitle">本地工作区</div></div><button class="icon-button" data-action="open-about" title="关于">${icon('info')}</button></header>
    <main class="page">
      <section class="profile-header">
        <div class="avatar">标</div>
        <div><p class="profile-name">本地用户</p><div class="profile-id">数据保存在当前设备</div></div>
        <span class="meta-chip">本地模式</span>
      </section>
      <section class="stats-band">
        <div class="stat"><span class="ux-stat-ico">${icon('sheet', 'icon-sm')}</span><strong>${state.projects.length}</strong><span>标签</span></div>
        <div class="stat"><span class="ux-stat-ico">${icon('template', 'icon-sm')}</span><strong>${genuineUserTemplates(state).length}</strong><span>模板</span></div>
        <div class="stat"><span class="ux-stat-ico">${icon('database', 'icon-sm')}</span><strong>${state.dataRows.length}</strong><span>数据行</span></div>
      </section>
      <section class="section">
        <div class="section-heading"><span class="ux-head-ico">${icon('database', 'icon-sm')}</span><h2>设备与数据</h2></div>
        <div class="settings-list">
          ${settingsRow('printer', '打印机管理', state.device ? state.device.name : '未连接', 'open-devices')}
          ${settingsRow('cloud', '数据存储', '仅保存在本机', 'cloud-info')}
          ${settingsRow('database', '备份与恢复', `${state.projects.length} 个本地项目`, 'backup-data')}
          ${settingsRow('history', '打印记录', '本机记录', 'print-history')}
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><span class="ux-head-ico">${icon('settings', 'icon-sm')}</span><h2>偏好设置</h2></div>
        <div class="settings-list">
          ${settingsRow('settings', '默认打印参数', `${state.settings.density} 档浓度 · ${state.settings.copies} 份`, 'default-print-settings')}
          ${settingsRow('palette', '尺寸单位', '毫米（mm）', 'unit-info')}
          ${settingsRow('help', '使用帮助', '', 'help')}
          ${settingsRow('info', '关于应用', `v${__APP_VERSION__}`, 'open-about')}
        </div>
      </section>
    </main>
    ${bottomNav('profile')}`;
}

function settingsRow(iconName, title, detail, action) {
  return `<button type="button" class="settings-row" data-action="${action}">
    <span class="setting-icon">${icon(iconName, 'icon-sm')}</span>
    <span><span class="setting-title">${escapeHtml(title)}</span>${detail ? `<span class="setting-detail">${escapeHtml(detail)}</span>` : ''}</span>
    ${icon('chevronRight', 'icon-sm')}
  </button>`;
}

function selectedElement(state) {
  return state.document && state.document.elements.find((item) => item.id === state.selectedId);
}

function selectedElements(state) {
  if (!state.document) return [];
  const ids = Array.isArray(state.selectedIds) && state.selectedIds.length
    ? state.selectedIds
    : (state.selectedId ? [state.selectedId] : []);
  return ids.map((id) => state.document.elements.find((item) => item.id === id)).filter(Boolean);
}

function elementName(type) {
  return {
    text: '文字',
    barcode: '条码',
    qrcode: '二维码',
    image: '图片',
    rect: '矩形',
    line: '线条',
    date: '日期时间',
    serial: '序列号',
    table: '表格',
    material: '素材'
  }[type] || '元素';
}

function elementIconName(type) {
  return {
    text: 'type',
    barcode: 'barcode',
    qrcode: 'qr',
    image: 'image',
    rect: 'square',
    line: 'minus',
    date: 'calendar',
    serial: 'hash',
    table: 'table',
    material: 'stamp'
  }[type] || 'help';
}

function attributeToggle(label, field, checked, wide) {
  return `<div class="attribute-toggle${wide ? ' wide' : ''}">
    <label><input type="checkbox" data-action="toggle-element" data-field="${field}" ${checked ? 'checked' : ''}><span class="attribute-check">${checked ? icon('check', 'icon-xs') : ''}</span><span>${label}</span></label>
  </div>`;
}

/** Icon style toggle matching NIIMBOT attribute buttons. */
function styleIconToggle(label, field, checked, asset) {
  return `<button type="button" class="niim-style-ico${checked ? ' active' : ''}" data-action="toggle-element" data-field="${field}" title="${escapeHtml(label)}" aria-pressed="${checked ? 'true' : 'false'}">
    ${editorAsset(asset)}
    <span>${escapeHtml(label)}</span>
  </button>`;
}

function fontSizeStepper(element) {
  const size = round(element.fontSize || 4);
  return `<div class="niim-font-size">
    <span class="niim-field-label">字号</span>
    <div class="niim-stepper">
      <button type="button" data-action="nudge-font" data-delta="-0.2" title="减小">${editorAsset('element/attribute/text_font_size_subtract.svg')}</button>
      <input id="field-fontSize" inputmode="decimal" type="number" step="0.1" min="0.8" max="40" data-action="update-element" data-field="fontSize" value="${size}">
      <button type="button" data-action="nudge-font" data-delta="0.2" title="增大">${editorAsset('element/attribute/text_font_size_add.svg')}</button>
    </div>
    <span class="niim-unit">mm</span>
  </div>`;
}

function segmentedButton(label, action, value, active, iconName) {
  const originalIcons = {
    alignLeft: 'element/attribute/align_left.svg',
    alignCenter: 'element/attribute/align_center_h.svg',
    alignRight: 'element/attribute/align_right.svg',
    verticalTop: 'element/attribute/align_top.svg',
    verticalCenter: 'element/attribute/align_center_v.svg',
    verticalBottom: 'element/attribute/align_bottom.svg',
    mirror: value === 'y' ? 'element/attribute/mirror_by_y.svg' : 'element/attribute/mirror_by_x.svg',
    rotate: 'common/image_rotate.svg',
    refresh: 'common/image_reset.svg',
    align: 'element/attribute/text_mode_horizontal.svg'
  };
  const nativePath = iconName === 'distribute'
    ? `element/attribute/align_uniform_${value === 'vertical' ? 'v' : 'h'}.svg`
    : originalIcons[iconName];
  const iconMarkup = nativePath ? editorAsset(nativePath) : (iconName ? icon(iconName, 'icon-sm') : '');
  return `<button class="attribute-button${active ? ' active' : ''}" data-action="${action}" data-value="${value}" title="${escapeHtml(label)}">${iconMarkup}<span>${escapeHtml(label)}</span></button>`;
}

function stockCode(documentValue, dpi) {
  const w = Math.round(Number(documentValue.widthMm) || 0);
  const h = Math.round(Number(documentValue.heightMm) || 0);
  // Plain size for users; keep stockLabel if set
  if (documentValue.stockLabel) return documentValue.stockLabel;
  return `${w}×${h} mm`;
}

function isPlaceholderElement(element) {
  if (!element) return false;
  if (element.type === 'text') {
    const t = String(element.text || '').trim();
    return element.requiresInput === true || !t || t === '双击编辑'
      || t === '双击文本框编辑' || t === '点击后编辑文字';
  }
  if (element.type === 'barcode') {
    if (element.unsupportedCodeType === true || element.invalidCode === true) return false;
    const v = String(element.value || '').trim();
    return element.requiresInput === true || !v || v === '0';
  }
  if (element.type === 'qrcode') {
    const v = String(element.value || '').trim();
    return element.requiresInput === true || !v || v === 'https://example.com';
  }
  return false;
}

function templateAttentionMessage(documentValue) {
  const meta = documentValue && documentValue.templateMeta;
  if (!meta) return '';
  const elements = Array.isArray(documentValue.elements) ? documentValue.elements : [];
  const liveUnsupported = elements.filter((element) => element.unsupportedCodeType === true).length;
  const liveInvalid = elements.filter((element) => element.invalidCode === true).length;
  const liveRequired = elements.filter((element) => element.requiresInput === true).length;
  const messages = [];
  if (Number(meta.missingImageCount) > 0) {
    messages.push(`源模板有 ${Number(meta.missingImageCount)} 张图片缺失，已跳过，请补图`);
  }
  if (meta.sizeClamped) {
    messages.push(`源尺寸 ${meta.sourceWidthMm}×${meta.sourceHeightMm} mm 超出编辑上限，当前副本为 ${documentValue.widthMm}×${documentValue.heightMm} mm`);
  }
  if (liveUnsupported > 0) {
    messages.push(`有 ${liveUnsupported} 个条码码制待确认`);
  }
  if (liveInvalid > 0) {
    messages.push(`有 ${liveInvalid} 个条码内容不符合声明码制`);
  }
  const otherRequired = Math.max(0, liveRequired - liveUnsupported - liveInvalid);
  if (otherRequired > 0) messages.push(`有 ${otherRequired} 个内容需要填写或确认`);
  return messages.join('；');
}

function labelId(documentValue) {
  if (documentValue.labelId) return documentValue.labelId;
  // Stable short id from name/size for display (not server SKU)
  const seed = `${documentValue.widthMm}x${documentValue.heightMm}:${documentValue.name || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return String(100000 + (Math.abs(hash) % 900000));
}

/**
 * Fixed float bar. Multi: count+tools. Locked: short bar. Content keyboard: hidden.
 */
function contextActions(state) {
  const selected = selectedElements(state);
  if (!selected.length) return '';
  if (state.editorMode === 'content' && selected[0] && ['text', 'barcode', 'qrcode'].includes(selected[0].type)) {
    return '';
  }
  if (selected.length > 1 || state.multiSelect) {
    const n = selected.length;
    const editableCount = selected.filter((item) => !item.locked).length;
    const lockedCount = n - editableCount;
    return `<div class="niim-float-multi niim-float-fixed" role="toolbar" aria-label="多选排版">
      <span class="niim-multi-count">已选 ${n}${lockedCount ? ` · ${lockedCount} 锁定` : ''}</span>
      <button type="button" data-action="open-align-menu" ${editableCount < 1 ? 'disabled' : ''}>对齐</button>
      <button type="button" data-action="space-selection" data-delta="-0.6" ${editableCount < 2 ? 'disabled' : ''}>更紧凑</button>
      <button type="button" data-action="space-selection" data-delta="0.6" ${editableCount < 2 ? 'disabled' : ''}>更宽松</button>
      <button type="button" data-action="delete-selected" ${editableCount ? '' : 'disabled'}>删除</button>
      <button type="button" data-action="toggle-multi-select">完成</button>
    </div>`;
  }
  const element = selected[0];
  const fs = (name) => editorAsset(`floating_shortcut/${name}`);
  const locked = !!element.locked;
  if (locked) {
    return `<div class="niim-float-bar niim-float-fixed niim-float-locked" role="toolbar" aria-label="元素操作">
      <button type="button" class="niim-float-btn" data-action="duplicate-element" title="复制">${fs('floating_shortcut_copy.svg')}</button>
      <button type="button" class="niim-float-btn" data-action="toggle-lock" title="解锁">${fs('floating_shortcut_lock.svg')}</button>
    </div>`;
  }
  return `<div class="niim-float-bar niim-float-fixed" role="toolbar" aria-label="元素操作">
    <button type="button" class="niim-float-btn" data-action="edit-element" title="编辑内容">${fs('floating_shortcut_edit.svg')}</button>
    <button type="button" class="niim-float-btn" data-action="delete-element" title="删除">${fs('floating_shortcut_remove.svg')}</button>
    <button type="button" class="niim-float-btn" data-action="duplicate-element" title="复制">${fs('floating_shortcut_copy.svg')}</button>
    <button type="button" class="niim-float-btn" data-action="rotate-element" title="旋转">${fs('floating_shortcut_rotate.svg')}</button>
    <button type="button" class="niim-float-btn niim-float-text" data-action="open-align-menu" title="相对标签纸对齐"><span>对齐标签</span></button>
    <button type="button" class="niim-float-btn" data-action="toggle-lock" title="锁定">${fs('floating_shortcut_lock.svg')}</button>
  </div>`;
}

function layerList(state) {
  const elements = state.document ? state.document.elements.slice().reverse() : [];
  if (!elements.length) return `<div class="layer-empty"><span class="empty-state-icon">${icon('layers', 'icon-sm')}</span><div>还没有元素</div></div>`;
  return `<div class="layer-list">${elements.map((element, index) => {
    const active = Array.isArray(state.selectedIds) && state.selectedIds.includes(element.id);
    const label = element.type === 'text' ? (element.text || '空文字') : element.type === 'barcode' ? (element.value || '条码') : element.advanced && element.type === 'qrcode' ? '高级二维码' : elementName(element.type);
    const canRaise = !element.locked && index > 0;
    const canLower = !element.locked && index < elements.length - 1;
    return `<div class="layer-item${active ? ' active' : ''}">
      <button type="button" class="layer-select" data-action="select-element" data-id="${escapeHtml(element.id)}">
        <span class="layer-index">${elements.length - index}</span><span class="layer-icon">${icon(elementIconName(element.type), 'icon-sm')}</span><span class="layer-label">${escapeHtml(label)}</span>${element.locked ? icon('lock', 'icon-sm') : ''}
      </button>
      <span class="layer-actions">
        <button type="button" data-action="select-and-move-layer" data-id="${escapeHtml(element.id)}" data-delta="1" title="${element.locked ? '解锁后可调整层级' : canRaise ? '上移一层' : '已经在最上层'}" aria-label="${escapeHtml(label)}上移一层" ${canRaise ? '' : 'disabled'}>↑</button>
        <button type="button" data-action="select-and-move-layer" data-id="${escapeHtml(element.id)}" data-delta="-1" title="${element.locked ? '解锁后可调整层级' : canLower ? '下移一层' : '已经在最下层'}" aria-label="${escapeHtml(label)}下移一层" ${canLower ? '' : 'disabled'}>↓</button>
      </span>
    </div>`;
  }).join('')}</div>`;
}

function numericField(label, field, value, step, min, max) {
  const limits = `${min == null ? '' : ` min="${min}"`}${max == null ? '' : ` max="${max}"`}`;
  return `<div class="field"><label for="field-${field}">${label}</label><input id="field-${field}" inputmode="decimal" type="number" step="${step || 0.1}"${limits} data-action="update-element" data-field="${field}" value="${escapeHtml(value)}"></div>`;
}

function commonProperties(element) {
  return `${numericField('X (mm)', 'x', round(element.x))}${numericField('Y (mm)', 'y', round(element.y))}${numericField('宽度 (mm)', 'width', round(element.width), 0.1, 1)}${numericField('高度 (mm)', 'height', round(element.height), 0.1, 1)}${numericField('旋转 (°)', 'rotation', round(element.rotation), 1)}`;
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}

function materialBrowserHtml(state, activeSymbol, options) {
  const opts = options || {};
  const chip = state.materialChip || DEFAULT_MATERIAL_CHIP;
  const query = state.materialQuery || '';
  const searchOpen = !!state.materialSearchOpen || chip === '搜索';
  const remote = Array.isArray(state.remoteMaterials) ? state.remoteMaterials : [];
  const seen = new Set(MATERIAL_CATALOG.map((item) => item.id));
  const library = MATERIAL_CATALOG.concat(remote.filter((item) => item && item.id && !seen.has(item.id)));
  const activeChip = searchOpen ? '搜索' : chip;
  const q = String(query || '').trim().toLowerCase();
  const items = library.filter((item) => {
    const chipMatch = !activeChip || activeChip === '搜索' || activeChip === '全部'
      || item.category === activeChip
      || (item.asset && item.source === 'authorized-niim' && activeChip === DEFAULT_MATERIAL_CHIP)
      || (Array.isArray(item.tags) && item.tags.includes(activeChip));
    if (!chipMatch) return false;
    if (!q) return true;
    return [item.id, item.label, item.category, ...(item.tags || [])].join(' ').toLowerCase().includes(q);
  });
  const chipsHtml = MATERIAL_CHIPS.map(function(name) {
    const active = (!searchOpen && chip === name) ? ' active' : '';
    const sel = (!searchOpen && chip === name) ? 'true' : 'false';
    return '<button type="button" class="niim-mat-chip' + active + '" data-action="material-chip" data-chip="' + escapeHtml(name) + '" role="tab" aria-selected="' + sel + '" aria-label="筛选' + escapeHtml(name) + '素材">' + escapeHtml(name) + '</button>';
  }).join('');
  const ownedCount = items.filter((item) => Array.isArray(item.tags) && item.tags.includes('商跃')).length;
  const tiles = items.map(function(item) {
    const active = (activeSymbol || 'check') === item.id ? ' active' : '';
    const thumbnail = item.asset
      ? '<span class="niim-material-thumb" data-material-thumb="' + item.id + '" data-material-asset="' + escapeHtml(item.asset) + '"><img src="' + escapeHtml(item.asset) + '" alt="" crossorigin="anonymous" loading="lazy" decoding="async"></span>'
      : '<span class="niim-material-thumb" data-material-thumb="' + item.id + '"><canvas width="56" height="56" aria-hidden="true"></canvas></span>';
    return '<button type="button" class="niim-mat-tile' + active + '" data-action="pick-material" data-symbol="' + item.id + '" title="' + escapeHtml(item.label) + '" aria-label="素材 ' + escapeHtml(item.label) + '">' + thumbnail + '<span class="niim-mat-name">' + escapeHtml(item.label) + '</span></button>';
  }).join('');
  const searchInput = searchOpen ? ('<input class="niim-mat-search" data-action="material-search" placeholder="搜索素材" value="' + escapeHtml(query) + '">') : '';
  return '<section class="niim-mat-browser' + (opts.embedded ? ' embedded' : '') + '">' +
    '<div class="niim-mat-chips" role="tablist">' +
      '<button type="button" class="niim-mat-chip search' + (searchOpen ? ' active' : '') + '" data-action="material-chip" data-chip="搜索" role="tab" aria-selected="' + searchOpen + '" aria-label="搜索素材">' + icon('search', 'icon-xs') + '<span>搜索</span></button>' +
      chipsHtml +
    '</div>' +
    searchInput +
    '<div class="niim-mat-summary" role="status" aria-live="polite"><strong>' + escapeHtml(searchOpen ? '搜索结果' : activeChip + '素材') + '</strong><span>' + items.length + ' 个' + (ownedCount ? ' · 商跃原创 ' + ownedCount : '') + '</span></div>' +
    '<div class="niim-mat-grid">' + (tiles || '<p class="niim-hint">暂无素材</p>') + '</div>' +
    (!opts.embedded ? authorizedAssetPager(state, 'material') : '') +
  '</section>';
}

function authorizedAssetPager(state, kind) {
  const isBorder = kind === 'border';
  const list = isBorder ? (state.remoteBorders || []) : (state.remoteMaterials || []);
  const total = Math.max(0, Number(isBorder ? state.remoteBorderTotal : state.remoteMaterialTotal) || 0);
  const page = Math.max(0, Number(isBorder ? state.remoteBorderPage : state.remoteMaterialPage) || 0);
  const loading = !!(isBorder ? state.remoteBorderLoading : state.remoteMaterialLoading);
  const error = String((isBorder ? state.remoteBorderError : state.remoteMaterialError) || '');
  const action = isBorder ? 'load-more-online-borders' : 'load-more-online-materials';
  const label = isBorder ? '边框' : '素材';
  const loaded = list.length;
  const explicitHasMore = isBorder ? state.remoteBorderHasMore : state.remoteMaterialHasMore;
  const hasMore = explicitHasMore !== false && (page === 0 || loaded < total);
  if (!loading && !error && !hasMore && loaded === 0 && total === 0) return '';
  return '<div class="load-more-row authorized-asset-pager" role="status" aria-live="polite">' +
    '<span class="meta-chip">' + label + ' ' + (total ? (loaded + ' / ' + total) : (loading ? '读取中' : '待载入')) + '</span>' +
    (error ? '<span class="niim-hint">' + escapeHtml(error) + '</span>' : '') +
    (loading ? '<span class="niim-hint">正在读取…</span>' : (hasMore ? '<button type="button" class="button-secondary compact" data-action="' + action + '">' + (error ? '重试' : '加载更多') + '</button>' : '')) +
  '</div>';
}

function materialGridHtml(activeSymbol, compact) {
  return materialBrowserHtml({ materialChip: DEFAULT_MATERIAL_CHIP, materialQuery: '', materialSearchOpen: false }, activeSymbol, { embedded: !!compact });
}

function materialSheet(state) {
  const selected = selectedElement(state);
  const active = selected && selected.type === 'material' ? selected.symbol : (state.pendingMaterialSymbol || 'check');
  return '<div class="sheet-backdrop" data-action="close-modal"></div>' +
    '<section class="bottom-sheet workbench-sheet niim-material-sheet" role="dialog" aria-modal="true" aria-labelledby="material-sheet-title">' +
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-header">' +
        '<div><h2 id="material-sheet-title">' + icon('stamp', 'icon-sm') + '素材</h2><div class="topbar-subtitle">商跃内置矢量符号</div></div>' +
        '<button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">' + icon('close') + '</button>' +
      '</div>' +
      '<div class="niim-material-sheet-body">' +
        materialBrowserHtml(state, active, { embedded: false }) +
      '</div>' +
    '</section>';
}

function borderBrowserHtml(state, activeId, options) {
  const opts = options || {};
  const chip = state.borderChip || "最新";
  const query = state.borderQuery || "";
  const searchOpen = !!state.borderSearchOpen || chip === "搜索";
  const remote = Array.isArray(state.remoteBorders) ? state.remoteBorders : [];
  const seen = new Set(BORDER_CATALOG.map((item) => item.id));
  const library = BORDER_CATALOG.concat(remote.filter((item) => item && item.id && !seen.has(item.id)));
  const activeChip = searchOpen ? '搜索' : chip;
  const q = String(query || '').trim().toLowerCase();
  const items = library.filter((item) => {
    const chipMatch = !activeChip || activeChip === '搜索' || activeChip === '全部'
      || item.chip === activeChip
      || item.category === activeChip
      || (item.asset && activeChip === '最新')
      || (Array.isArray(item.tags) && item.tags.includes(activeChip));
    if (!chipMatch) return false;
    return !q || [item.id, item.label, item.category, ...(item.tags || [])].join(' ').toLowerCase().includes(q);
  });
  const chipsHtml = BORDER_CHIPS.map(function(name) {
    const active = (!searchOpen && chip === name) ? " active" : "";
    return "<button type=\"button\" class=\"niim-mat-chip" + active + "\" data-action=\"border-chip\" data-chip=\"" + escapeHtml(name) + "\" role=\"tab\">" + escapeHtml(name) + "</button>";
  }).join("");
  const tiles = items.map(function(item) {
    const active = (activeId || "") === item.id ? " active" : "";
    return "<button type=\"button\" class=\"niim-mat-tile niim-border-tile" + active + "\" data-action=\"pick-border\" data-border=\"" + item.id + "\" title=\"" + escapeHtml(item.label) + "\">" +
      (item.asset
        ? "<span class=\"niim-border-thumb\"><img src=\"" + escapeHtml(item.asset) + "\" alt=\"\" crossorigin=\"anonymous\" loading=\"lazy\" decoding=\"async\"></span>"
        : "<span class=\"niim-border-thumb\" data-border-thumb=\"" + item.id + "\"><canvas width=\"72\" height=\"48\" aria-hidden=\"true\"></canvas></span>") +
      "<span class=\"niim-border-label\">" + escapeHtml(item.label) + "</span></button>";
  }).join("");
  const searchInput = searchOpen ? ("<input class=\"niim-mat-search\" data-action=\"border-search\" placeholder=\"搜索边框\" value=\"" + escapeHtml(query) + "\">") : "";
  return "<section class=\"niim-mat-browser niim-border-browser" + (opts.embedded ? " embedded" : "") + "\">" +
    "<div class=\"niim-mat-chips\" role=\"tablist\">" +
      "<button type=\"button\" class=\"niim-mat-chip search" + (searchOpen ? " active" : "") + "\" data-action=\"border-chip\" data-chip=\"搜索\" role=\"tab\">搜索</button>" +
      chipsHtml +
    "</div>" +
    searchInput +
    "<div class=\"niim-mat-grid niim-border-grid\">" + (tiles || "<p class=\"niim-hint\">暂无边框</p>") + "</div>" +
    (!opts.embedded ? authorizedAssetPager(state, 'border') : '') +
  "</section>";
}

function borderSheet(state) {
  const selected = selectedElement(state);
  const active = selected && selected.type === 'image' && selected.remoteBorderId
    ? selected.remoteBorderId
    : (selected && selected.type === "rect" && selected.borderStyle ? selected.borderStyle : "");
  return "<div class=\"sheet-backdrop\" data-action=\"close-modal\"></div>" +
    "<section class=\"bottom-sheet workbench-sheet niim-material-sheet niim-border-sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"border-sheet-title\">" +
      "<div class=\"sheet-handle\"></div>" +
      "<div class=\"sheet-header\">" +
        "<div><h2 id=\"border-sheet-title\">" + icon("square", "icon-sm") + "边框</h2><div class=\"topbar-subtitle\">商跃程序化线框</div></div>" +
        "<button type=\"button\" class=\"icon-button\" data-action=\"close-modal\" title=\"关闭\" aria-label=\"关闭\">" + icon("close") + "</button>" +
      "</div>" +
      "<div class=\"niim-material-sheet-body\">" +
        borderBrowserHtml(state, active, { embedded: false }) +
      "</div>" +
    "</section>";
}
function elementPicker(state) {
  // Page 2 ship: 扫描 · 序列号 · 边框 · 形状 · 表格 · 线条
  const pages = [
    [
      ['text', 'element_icon_text.svg', '文本', 'add-element'],
      ['image', 'element_icon_photoPrint.svg', '拍照打印', 'add-photo'],
      ['image', 'element_icon_image.svg', '图片', 'add-image'],
      ['material', 'element_icon_material.svg', '素材', 'open-material-sheet'],
      ['date', 'element_icon_date.svg', '时间', 'add-element'],
      ['barcode', 'element_icon_barcode.svg', '条形码', 'add-element'],
      ['qrcode', 'element_icon_qrcode.svg', '二维码', 'add-element'],
      ['qrcode', 'features_icon_advance_qrcode.svg', '高级二维码', 'open-advanced-qr']
    ],
    [
      ['scan', 'features_icon_scan.svg', '扫描', 'scan-code'],
      ['serial', 'element_icon_serial.svg', '序列号', 'add-element'],
      ['rect', 'element_icon_border.svg', '边框', 'open-border-sheet'],
      ['rect', 'element_icon_graph.svg', '形状', 'add-element', 'shape'],
      ['table', 'element_icon_table.svg', '表格', 'add-element'],
      ['line', 'element_icon_line.svg', '线条', 'add-element']
    ]
  ];
  return `<div class="niim-element-pager">
    <div class="element-pages" data-role="element-pages">${pages.map((items, pageIndex) => `
      <div class="niim-element-grid element-page" data-page="${pageIndex}">
        ${items.map(([type, asset, label, action, variant, aiBadge, badge]) => `
          <button type="button" class="niim-element-item" data-action="${action}" data-type="${type || ''}"${variant ? ` data-variant="${variant}"` : ''}${badge ? ` data-badge="${badge}"` : ''}>
            <span class="niim-element-ico">${aiBadge ? '<i class="niim-ai-badge">AI</i>' : ''}${badge === 'new' ? '<i class="niim-new-badge">NEW</i>' : ''}${editorAsset(`element/icon/${asset}`)}</span>
            <span class="niim-element-label">${label}</span>
          </button>`).join('')}
      </div>`).join('')}
    </div>
    <div class="niim-page-dots" role="tablist" aria-label="元素分页">
      ${pages.map((_, index) => `<button type="button" class="element-page-dot${index === 0 ? ' active' : ''}" data-action="set-element-page" data-page="${index}" role="tab" aria-label="元素第 ${index + 1} 页" aria-selected="${index === 0}"></button>`).join('')}
    </div>
  </div>`;
}

function editorTemplatePanel(state) {
  const all = templateLibraryPool({ ...state, templateCategory: '全部' });
  const sizeFilter = state.editorTplSize || "\u5168\u90e8\u5c3a\u5bf8";
  const industryFilter = state.editorTplIndustry || "\u5168\u90e8";
  const query = String(state.editorTplQuery || "").trim().toLowerCase();
  const sizeKeys = Array.from(new Set(all.map((t) => t.size[0] + "\u00d7" + t.size[1]))).sort();
  const sizeOptions = ["\u5168\u90e8\u5c3a\u5bf8", ...sizeKeys];
  let items = all;
  if (sizeFilter && sizeFilter !== "\u5168\u90e8\u5c3a\u5bf8") {
    items = items.filter((t) => (t.size[0] + "\u00d7" + t.size[1]) === sizeFilter);
  }
  if (industryFilter && industryFilter !== "\u5168\u90e8") {
    items = items.filter((t) => (t.industry || "") === industryFilter);
  }
  if (query) {
    items = items.filter((t) => {
      const hay = [t.name, t.blurb || "", t.category || "", t.industry || ""].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }
  const sizeSelect = sizeOptions.map((s) => "<option value=\"" + escapeHtml(s) + "\"" + (s === sizeFilter ? " selected" : "") + ">" + escapeHtml(s) + (s === "\u5168\u90e8\u5c3a\u5bf8" ? "" : " mm") + "</option>").join("");
  const industrySelect = industries.map((ind) => {
    const label = ind === "\u5168\u90e8" ? "\u884c\u4e1a\u573a\u666f" : ind;
    return "<option value=\"" + escapeHtml(ind) + "\"" + (ind === industryFilter ? " selected" : "") + ">" + escapeHtml(ind === "\u5168\u90e8" ? "\u884c\u4e1a\u573a\u666f" : ind) + "</option>";
  }).join("");
  const cards = items.map((template) => {
    const source = template.userTemplate ? "user" : "catalog";
    return "<button type=\"button\" class=\"niim-tpl-card\" data-action=\"preview-template\" data-id=\"" + escapeHtml(template.id) + "\">" +
      labelThumb(template.kind, template.size, template.accent, { id: template.id, source, name: template.name, category: template.category, motif: template.motif, thumbSrc: template.thumbSrc || '' }) +
      "<span class=\"niim-tpl-caption\">" + escapeHtml(template.name) + "</span>" +
    "</button>";
  }).join("");
  return "<section class=\"niim-tpl-panel\">" +
    "<div class=\"niim-tpl-filters\">" +
      "<select class=\"niim-tpl-filter\" data-action=\"editor-tpl-size\">" + sizeSelect + "</select>" +
      "<select class=\"niim-tpl-filter\" data-action=\"editor-tpl-industry\">" + industrySelect + "</select>" +
      "<label class=\"niim-tpl-search\"><span class=\"search-ico\">\U0001F50D</span>" +
        "<input data-action=\"editor-tpl-search\" placeholder=\"\u641c\u7d22\u6a21\u677f\" value=\"" + escapeHtml(state.editorTplQuery || "") + "\">" +
      "</label>" +
    "</div>" +
    "<div class=\"niim-tpl-grid\">" + (cards || "<p class=\"niim-hint\">\u6682\u65e0\u6a21\u677f</p>") + "</div>" +
  "</section>";
}

function editorDataPanel(state) {
  const rows = state.dataRows || [];
  return `<div class="editor-data-panel">
    <p class="niim-hint">点选一行即可把名称、价格、条码和日期套用到当前标签；该操作可撤销。</p>
    <div class="editor-data-list">${rows.length ? rows.map((row, index) => `<button type="button" class="editor-data-row${state.editorDataRowIndex === index ? ' active' : ''}" data-action="apply-editor-data-row" data-row="${index}"><span>${index + 1}</span><strong>${escapeHtml(row.name || row.code || `数据 ${index + 1}`)}</strong><small>${escapeHtml([row.code, row.price, row.date].filter(Boolean).join(' · '))}</small><i>${state.editorDataRowIndex === index ? icon('check', 'icon-sm') : icon('chevronRight', 'icon-sm')}</i></button>`).join('') : '<div class="empty-state soft">暂无数据行</div>'}</div>
    <button type="button" class="native-wide-command" data-action="manage-editor-data">${icon('sheet', 'icon-sm')}<span>编辑 / 导入数据表</span>${icon('chevronRight', 'icon-sm')}</button>
  </div>`;
}

function contentValue(element) {
  if (!element) return '';
  // The canvas owns the visual placeholder. It is never user-entered content.
  if (element.type === 'text') return element.text === '双击编辑' ? '' : (element.text || '');
  if (element.type === 'barcode' || element.type === 'qrcode') return element.value || '';
  if (element.type === 'date') return element.fixedValue || '';
  if (element.type === 'serial') {
    return `${element.prefix || ''}${String(element.start || 0).padStart(Math.max(1, Number(element.digits) || 1), '0')}${element.suffix || ''}`;
  }
  return '';
}

function contentField(element) {
  if (element.type === 'text') return 'text';
  if (element.type === 'barcode' || element.type === 'qrcode') return 'value';
  if (element.type === 'date') return 'fixedValue';
  return 'text';
}

/** 时间 Tab — 截图: 制作日期/保质期至 + 偏移 + 常用时长 */
function elementTimePanel(element) {
  if (!element || element.type !== 'date') return '';
  const role = element.dateRole || 'made';
  const label = element.label == null ? (role === 'expire' ? '保质期至' : '制作日期') : String(element.label);
  const presetLabels = ['生产日期', '上架日期', '制作日期', '开封时间', '保质期至', '打印时间'];
  const customLabel = !!label && !presetLabels.includes(label);
  const dateChip = formatDateChip(element);
  const timeChip = formatTimeChip(element);
  const offsetDays = Number(element.offsetDays) || 0;
  const preset = Number(element.expirePresetHours) || 24;
  const expireMode = element.expireMode || 'preset';
  const formatValue = String(element.format || 'YYYY年MM月DD日 HH:mm');
  const dateFormats = [
    ['YYYY年MM月DD日 HH:mm', '2026年08月18日 14:30'],
    ['YYYY-MM-DD HH:mm', '2026-08-18 14:30'],
    ['YYYY/MM/DD HH:mm', '2026/08/18 14:30'],
    ['YYYY-MM-DD', '2026-08-18'],
    ['YYYY/MM/DD', '2026/08/18']
  ];
  const knownFormat = dateFormats.some(([value]) => value === formatValue);
  // A companion is still part of the relationship when it is selected on its
  // own; exposing another "add linked date" button there would create a chain.
  const linked = !!element.linkedExpire || !!element.linkedFrom;
  const baseLocal = (() => {
    try {
      const d = element.baseTime ? new Date(element.baseTime) : new Date();
      if (Number.isNaN(d.getTime())) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch (_) {
      return '';
    }
  })();
  return `<section class="niim-time-panel">
    <div class="niim-realtime-row">
      <span class="niim-realtime-label">实时时间 </span>
      <button type="button" class="niim-switch${element.autoUpdate !== false ? ' on' : ''}" data-action="toggle-element" data-field="autoUpdate" aria-label="实时时间"><i></i></button>
    </div>
    <div class="niim-time-primary">
      <select class="niim-time-label" data-action="set-date-label">
        <option value="" ${label === '' ? 'selected' : ''}>无前缀</option>
        <option value="生产日期" ${label === '生产日期' ? 'selected' : ''}>生产日期</option>
        <option value="上架日期" ${label === '上架日期' ? 'selected' : ''}>上架日期</option>
        <option value="制作日期" ${label === '制作日期' ? 'selected' : ''}>制作日期</option>
        <option value="开封时间" ${label === '开封时间' ? 'selected' : ''}>开封时间</option>
        <option value="保质期至" ${label === '保质期至' ? 'selected' : ''}>保质期至</option>
        <option value="打印时间" ${label === '打印时间' ? 'selected' : ''}>打印时间</option>
        <option value="__custom__" ${customLabel ? 'selected' : ''}>自定义</option>
      </select>
      ${label ? '<span class="niim-time-colon">:</span>' : ''}
      <label class="niim-time-chip date">
        <span>${escapeHtml(dateChip)}</span>
        <input type="datetime-local" class="niim-time-native" data-action="set-date-base" value="${escapeHtml(baseLocal)}" title="选择日期时间">
      </label>
      <label class="niim-time-chip time">
        <span>${escapeHtml(timeChip)}</span>
        <input type="datetime-local" class="niim-time-native" data-action="set-date-base" value="${escapeHtml(baseLocal)}" title="选择时间">
      </label>
    </div>
    ${customLabel ? `<div class="niim-form-row"><label for="date-custom-label">自定义前缀</label><input id="date-custom-label" class="niim-text-input" data-action="update-date-custom-label" value="${escapeHtml(label)}" maxlength="16" placeholder="例如：入库日期"></div>` : ''}
    <div class="niim-form-row"><label for="date-format-select">日期格式</label><select id="date-format-select" class="niim-select compact" data-action="set-date-format">
      ${!knownFormat ? `<option value="${escapeHtml(formatValue)}" selected>自定义 · ${escapeHtml(formatValue)}</option>` : ''}
      ${dateFormats.map(([value, text]) => `<option value="${value}" ${formatValue === value ? 'selected' : ''}>${text}</option>`).join('')}
    </select></div>
    <div class="niim-form-row niim-time-offset">
      <label>时间偏移</label>
      <div class="niim-pm wide">
        <button type="button" data-action="nudge-date-offset" data-delta="-1" aria-label="减少时间偏移">${controlIcon('minus')}</button>
        <em>+ ${offsetDays}天</em>
        <button type="button" data-action="nudge-date-offset" data-delta="1" aria-label="增加时间偏移">${controlIcon('plus')}</button>
      </div>
    </div>
    ${!linked ? `<button type="button" class="niim-add-linked" data-action="add-linked-date">+ 添加关联时间</button>` : ''}
    ${(linked || role === 'expire' || label === '保质期至') ? `
    <div class="niim-expire-block">
      <div class="niim-expire-head">
        <span class="niim-expire-title">保质期至</span>
        <div class="niim-seg">
          <button type="button" class="niim-seg-btn${expireMode !== 'custom' ? ' active' : ''}" data-action="set-expire-mode" data-value="preset">常用</button>
          <button type="button" class="niim-seg-btn${expireMode === 'custom' ? ' active' : ''}" data-action="set-expire-mode" data-value="custom">自定义</button>
        </div>
      </div>
      ${expireMode === 'custom' ? `
        <div class="niim-form-row">
          <label>小时</label>
          <div class="niim-pm wide">
            <button type="button" data-action="nudge-expire-hours" data-delta="-1" aria-label="减少小时">${controlIcon('minus')}</button>
            <em>${preset}小时</em>
            <button type="button" data-action="nudge-expire-hours" data-delta="1" aria-label="增加小时">${controlIcon('plus')}</button>
          </div>
        </div>` : `
        <div class="niim-expire-grid">
          ${DATE_EXPIRE_PRESETS.map((item) => `
            <button type="button" class="niim-expire-chip${preset === item.hours ? ' active' : ''}"
              data-action="set-expire-preset" data-hours="${item.hours}">${item.label}</button>`).join('')}
        </div>`}
      ${linked ? `<button type="button" class="niim-link-btn" data-action="remove-linked-date">移除关联时间</button>` : ''}
    </div>` : ''}
    <button type="button" class="niim-mirror-row" data-action="toggle-element" data-field="showTime">
      <span>显示时间</span>
      <span class="niim-switch${element.showTime !== false ? ' on' : ''}"><i></i></span>
    </button>
  </section>`;
}

/** Original: single-line bar + clear + 完成 (system keyboard). */
function elementContentPanel(element, state) {
  if (!element) return '';
  if (element.type === 'date') return elementTimePanel(element);
  if (['text', 'barcode', 'qrcode'].includes(element.type)) {
    const field = contentField(element);
    const value = contentValue(element);
    const hasValue = String(value || '').length > 0;
    const inputId = element.type === 'text' ? 'element-text' : element.type === 'barcode' ? 'barcode-value' : 'qr-value';
    const scannable = element.type === 'barcode' || element.type === 'qrcode';
    const editorControl = element.type === 'text'
      ? `<textarea id="${inputId}" class="niim-content-line" rows="2" inputmode="text" enterkeyhint="enter"
          data-action="update-element" data-field="${field}" aria-label="文本内容"
          placeholder="请输入内容" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">${escapeHtml(value)}</textarea>`
      : `<input id="${inputId}" class="niim-content-line" type="text" inputmode="text" enterkeyhint="done"
          data-action="update-element" data-field="${field}" value="${escapeHtml(value)}"
          placeholder="请输入内容" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
    return `<section class="niim-content-edit">
      <div class="niim-content-bar${element.type === 'text' ? ' multiline' : ''}">
        ${editorControl}
        ${hasValue ? `<button type="button" class="niim-content-clear" data-action="clear-content" title="清除" tabindex="-1">×</button>` : ''}
        ${scannable ? `<button type="button" class="niim-content-scan" data-action="scan-code" title="扫码" tabindex="-1">${editorAsset('element/attribute/barcode_scan.svg')}</button>` : ''}
        <button type="button" class="niim-content-done" data-action="content-done" tabindex="-1">完成</button>
      </div>
      ${element.type === 'qrcode' && element.advanced ? `<button type="button" class="niim-content-advanced" data-action="edit-advanced-qr">${icon('edit', 'icon-sm')}结构化编辑 ${escapeHtml(element.advancedType || '')}</button>` : ''}
    </section>`;
  }
  if (element.type === 'serial') {
    const start = element.start == null ? 1 : element.start;
    const step = element.step == null ? 1 : element.step;
    const digits = Math.max(1, Number(element.digits) || 2);
    const preview = [0, 1, 2].map((i) => {
      const n = Number(start) + i * Number(step);
      return `${element.prefix || ''}${String(n).padStart(digits, '0')}${element.suffix || ''}`;
    }).join(',');
    return `<section class="niim-serial-panel">
      <div class="niim-form-row">
        <label>前缀</label>
        <input class="niim-text-input" data-action="update-element" data-field="prefix" value="${escapeHtml(element.prefix || '')}" placeholder="请输入内容">
      </div>
      <div class="niim-form-row">
        <label>后缀</label>
        <input class="niim-text-input" data-action="update-element" data-field="suffix" value="${escapeHtml(element.suffix || '')}" placeholder="请输入内容">
      </div>
      <div class="niim-form-row">
        <label>起始值</label>
        <input class="niim-text-input" data-action="update-element" data-field="start" value="${escapeHtml(start)}" inputmode="numeric">
      </div>
      <div class="niim-form-row">
        <label>递增值</label>
        <div class="niim-pm wide">
          <button type="button" data-action="nudge-serial" data-field="step" data-delta="-1" aria-label="减少递增值">${controlIcon('minus')}</button>
          <em>${escapeHtml(step)}</em>
          <button type="button" data-action="nudge-serial" data-field="step" data-delta="1" aria-label="增加递增值">${controlIcon('plus')}</button>
        </div>
      </div>
      <div class="niim-form-row">
        <label>位数</label>
        <div class="niim-pm wide">
          <button type="button" data-action="nudge-serial" data-field="digits" data-delta="-1" aria-label="减少位数">${controlIcon('minus')}</button>
          <em>${escapeHtml(digits)}</em>
          <button type="button" data-action="nudge-serial" data-field="digits" data-delta="1" aria-label="增加位数">${controlIcon('plus')}</button>
        </div>
      </div>
      <p class="niim-serial-preview">预览示例:${escapeHtml(preview)}...</p>
      <button type="button" class="niim-link-btn" data-action="toast-feature" data-msg="序列号在批量打印时按递增值递增">了解如何设置序列号数量?</button>
    </section>`;
  }
  if (element.type === 'image') {
    return `<section class="niim-content-panel">
      <button type="button" class="niim-row-command" data-action="replace-image"><span>替换图片</span></button>
      <button type="button" class="niim-row-command" data-action="replace-photo"><span>拍照替换</span></button>
    </section>`;
  }
  if (element.type === 'table') {
    return tableTextPanel(element);
  }
  if (element.type === 'material') {
    return '<section class="niim-content-panel niim-material-content">' +
      materialBrowserHtml(state || {}, element.symbol || 'check', { embedded: true }) +
    '</section>';
  }
  return `<section class="niim-content-panel"><p class="niim-hint">切换到样式进行设置</p></section>`;
}

function fontCatalogMarkup(activeId, options) {
  const compact = Boolean(options && options.compact);
  const fonts = listFontCatalog();
  return FONT_CATEGORIES.map((category) => {
    const items = fonts.filter((font) => font.category === category.id);
    if (!items.length) return '';
    const chips = items.map((font) => (
      `<button type="button" class="niim-font-chip${activeId === font.id ? ' active' : ''}" data-action="set-font" data-value="${font.id}" style="font-family:${font.cssFamily}" title="${escapeHtml(`${font.label} · ${font.coverage} · ${font.license}`)}">${escapeHtml(font.shortLabel)}</button>`
    )).join('');
    return `<div class="niim-font-group"><span class="niim-font-cat">${escapeHtml(category.label)}</span><div class="niim-font-list${compact ? ' compact' : ''}">${chips}</div></div>`;
  }).join('');
}

function fontCatalogSummary() {
  const catalog = listFontCatalog();
  const remoteCount = catalog.filter((font) => font.remote).length;
  return `${catalog.length} 款字体 · ${remoteCount} 款 OFL 开源字体按需加载`;
}

function fontSelectOptions(activeId) {
  return listFontCatalog().map((font) => (
    `<option value="${font.id}" ${activeId === font.id ? 'selected' : ''}>${escapeHtml(font.label)}</option>`
  )).join('');
}

function elementFontPanel(element) {
  if (!element || !['text', 'date', 'serial', 'table'].includes(element.type)) {
    return `<section class="niim-font-panel"><p class="niim-hint">当前元素无字体设置</p></section>`;
  }
  const fontInfo = fontFallbackInfo(element.fontFamily, element.sourceFontFamily);
  const fontFamily = fontInfo.renderFamily;
  return `<section class="niim-font-panel">
    <label class="niim-field-label">字体</label>
    <select class="niim-select" data-action="update-element" data-field="fontFamily">
      ${fontSelectOptions(fontFamily)}
    </select>
    <p class="niim-hint">${fontCatalogSummary()}</p>
    <div class="niim-font-catalog">${fontCatalogMarkup(fontFamily)}</div>
    ${fontInfo.fallback ? `<p class="niim-hint niim-font-fallback">源字体“${escapeHtml(fontInfo.requested)}”未随模板提供，已用开源「${escapeHtml(fontInfo.label)}」稳定替代。选择上方字体可确认替换。</p>` : ''}
  </section>`;
}

function barcodeStylePanel(element) {
  const position = element.showText === false ? 'none' : (element.textPosition || 'bottom');
  const fontSize = round(element.fontSize || 2.5);
  const color = (element.color || '#000000').toUpperCase();
  return `<section class="niim-style-panel niim-barcode-style">
    <div class="niim-form-row linkish">
      <label>编码格式 <button type="button" class="niim-q" data-action="toast-feature" data-msg="Code128 自动适配；A 支持控制字符，B 支持常用 ASCII，C 需偶数位数字；EAN-13 和 UPC-A 会校验位数与校验码" aria-label="编码格式说明">${icon('help', 'icon-xs')}</button></label>
      <select class="niim-select compact" data-action="update-barcode-format">
        ${element.requiresFormatConfirmation ? `<option value="" selected disabled>待确认：${escapeHtml(element.declaredFormat || element.sourceCodeType || '未知码制')}</option>` : ''}
        <option value="code128" ${element.format === 'code128' ? 'selected' : ''}>Code128 自动</option>
        <option value="code128a" ${element.format === 'code128a' ? 'selected' : ''}>Code128-A</option>
        <option value="code128b" ${element.format === 'code128b' ? 'selected' : ''}>Code128-B</option>
        <option value="code128c" ${element.format === 'code128c' ? 'selected' : ''}>Code128-C</option>
        <option value="ean13" ${element.format === 'ean13' ? 'selected' : ''}>EAN-13</option>
        <option value="upca" ${element.format === 'upca' ? 'selected' : ''}>UPC-A</option>
        <option value="upce" ${element.format === 'upce' ? 'selected' : ''}>UPC-E</option>
      </select>
    </div>
    <div class="niim-form-row">
      <label>条码样式</label>
      <div class="niim-barcode-styles">
        <button type="button" class="niim-bstyle${position === 'bottom' ? ' active' : ''}" data-action="set-barcode-text" data-value="bottom" title="文字在下">
          <span class="bars"></span><small>123</small>
        </button>
        <button type="button" class="niim-bstyle${position === 'top' ? ' active' : ''}" data-action="set-barcode-text" data-value="top" title="文字在上">
          <small>123</small><span class="bars"></span>
        </button>
        <button type="button" class="niim-bstyle${position === 'none' ? ' active' : ''}" data-action="set-barcode-text" data-value="none" title="仅条码">
          <span class="bars red"></span>
        </button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>字号</label>
      <div class="niim-pm wide">
        <button type="button" data-action="nudge-font" data-delta="-0.5" aria-label="减小字号">${controlIcon('minus')}</button>
        <em class="niim-size-readout">${fontSize.toFixed(1)}</em>
        <button type="button" data-action="nudge-font" data-delta="0.5" aria-label="增大字号">${controlIcon('plus')}</button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>颜色 <button type="button" class="niim-q" data-action="toast-feature" data-msg="仅限双色/彩色标签纸使用该功能，实际打印的颜色和标签纸有关。" aria-label="颜色说明">${icon('help', 'icon-xs')}</button></label>
      <span class="niim-color-dots">
        <button type="button" class="niim-color-dot${color === '#000000' || !element.color ? ' active' : ''}" data-action="set-color" data-value="#000000" data-reverse="0" style="--dot:#000"></button>
        <button type="button" class="niim-color-dot${color === '#E53935' ? ' active' : ''}" data-action="set-color" data-value="#E53935" data-reverse="0" style="--dot:#E53935"></button>
      </span>
    </div>
  </section>`;
}

function qrStylePanel(element) {
  const color = (element.color || '#000000').toUpperCase();
  return `<section class="niim-style-panel niim-qr-style">
    <div class="niim-form-row linkish">
      <label>编码格式</label>
      <span class="niim-static-val">QR_CODE</span>
    </div>
    <div class="niim-form-row">
      <label>颜色 <button type="button" class="niim-q" data-action="dual-color-tip" aria-label="颜色说明">${icon('help', 'icon-xs')}</button></label>
      <span class="niim-color-dots">
        <button type="button" class="niim-color-dot${color === '#000000' || !element.color ? ' active' : ''}" data-action="set-color" data-value="#000000" data-reverse="0" style="--dot:#000"></button>
        <button type="button" class="niim-color-dot${color === '#E53935' ? ' active' : ''}" data-action="set-color" data-value="#E53935" data-reverse="0" style="--dot:#E53935"></button>
      </span>
    </div>
  </section>`;
}

function shapeStylePanel(element) {
  const kind = element.shapeKind || (element.type === 'line' ? 'line' : 'rect');
  const color = (element.color || '#000000').toUpperCase();
  const lw = round(element.lineWidth || 0.4);
  const kinds = [
    ['line', 'shapeLine', '线条'],
    ['rounded', 'shapeRounded', '圆角矩形'],
    ['rect', 'shapeRect', '矩形'],
    ['ellipse', 'shapeEllipse', '椭圆'],
    ['circle', 'shapeCircle', '圆形']
  ];
  return `<section class="niim-style-panel niim-shape-style">
    <div class="niim-shape-kinds">
      ${kinds.map(([k, iconName, label]) => `<button type="button" class="niim-shape-kind${kind === k ? ' active' : ''}" data-action="set-shape-kind" data-value="${k}" title="${label}" aria-label="${label}">${icon(iconName, 'icon-shape')}</button>`).join('')}
    </div>
    <div class="niim-form-row">
      <label>样式</label>
      <div class="niim-dash-pair">
        <button type="button" class="niim-dash-btn${!element.dashed ? ' active' : ''}" data-action="set-dashed" data-value="0"><i class="solid"></i></button>
        <button type="button" class="niim-dash-btn${element.dashed ? ' active' : ''}" data-action="set-dashed" data-value="1"><i class="dash"></i></button>
      </div>
    </div>
    ${kind !== 'line' ? `<button type="button" class="niim-mirror-row" data-action="toggle-element" data-field="filled"><span>填充形状</span><span class="niim-switch${element.filled ? ' on' : ''}"><i></i></span></button>` : ''}
    <div class="niim-form-row">
      <label>线粗</label>
      <div class="niim-pm wide">
        <button type="button" data-action="nudge-line-width" data-delta="-0.1" aria-label="减小线粗">${controlIcon('minus')}</button>
        <em>${lw.toFixed(1)}</em>
        <button type="button" data-action="nudge-line-width" data-delta="0.1" aria-label="增大线粗">${controlIcon('plus')}</button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>颜色 <button type="button" class="niim-q" data-action="dual-color-tip" aria-label="颜色说明">${icon('help', 'icon-xs')}</button></label>
      <span class="niim-color-dots">
        <button type="button" class="niim-color-dot${color === '#000000' || !element.color ? ' active' : ''}" data-action="set-color" data-value="#000000" data-reverse="0" style="--dot:#000"></button>
        <button type="button" class="niim-color-dot${color === '#E53935' ? ' active' : ''}" data-action="set-color" data-value="#E53935" data-reverse="0" style="--dot:#E53935"></button>
      </span>
    </div>
  </section>`;
}

function tableStylePanel(element) {
  const rows = Math.max(1, Number(element.rows) || 3);
  const cols = Math.max(1, Number(element.columns) || 2);
  const rowH = round(element.rowH || (element.height / rows) || 4);
  const colW = round(element.colW || (element.width / cols) || 8);
  const lw = round(element.lineWidth || 0.4);
  const textColor = (element.textColor || element.color || "#000000").toUpperCase();
  const strokeColor = (element.strokeColor || element.color || "#000000").toUpperCase();
  return `<section class="niim-style-panel niim-table-style">` +
    `<div class="niim-form-row"><label>行数</label><div class="niim-pm wide">` +
    `<button type="button" data-action="nudge-table" data-field="rows" data-delta="-1" aria-label="减少行数">${controlIcon('minus')}</button>` +
    `<em>${rows}</em>` +
    `<button type="button" data-action="nudge-table" data-field="rows" data-delta="1" aria-label="增加行数">${controlIcon('plus')}</button></div></div>` +
    `<div class="niim-form-row"><label>列数</label><div class="niim-pm wide">` +
    `<button type="button" data-action="nudge-table" data-field="columns" data-delta="-1" aria-label="减少列数">${controlIcon('minus')}</button>` +
    `<em>${cols}</em>` +
    `<button type="button" data-action="nudge-table" data-field="columns" data-delta="1" aria-label="增加列数">${controlIcon('plus')}</button></div></div>` +
    `<div class="niim-form-row"><label>行高</label>` +
    `<input class="niim-size-slider" type="range" min="2" max="20" step="0.1" value="${rowH}" data-action="set-table-dim" data-field="rowH">` +
    `<em>${rowH.toFixed(1)}</em></div>` +
    `<div class="niim-form-row"><label>列宽</label>` +
    `<input class="niim-size-slider" type="range" min="4" max="40" step="0.1" value="${colW}" data-action="set-table-dim" data-field="colW">` +
    `<em>${colW.toFixed(1)}</em></div>` +
    `<div class="niim-form-row"><label>线粗</label><div class="niim-pm wide">` +
    `<button type="button" data-action="nudge-line-width" data-delta="-0.1" aria-label="减小线粗">${controlIcon('minus')}</button>` +
    `<em>${lw.toFixed(1)}</em>` +
    `<button type="button" data-action="nudge-line-width" data-delta="0.1" aria-label="增大线粗">${controlIcon('plus')}</button></div></div>` +
    `<div class="niim-form-row"><label>文本颜色</label><span class="niim-color-dots">` +
    `<button type="button" class="niim-color-dot${textColor === "#000000" ? " active" : ""}" data-action="set-table-color" data-field="textColor" data-value="#000000" style="--dot:#000"></button>` +
    `<button type="button" class="niim-color-dot${textColor === "#E53935" ? " active" : ""}" data-action="set-table-color" data-field="textColor" data-value="#E53935" style="--dot:#E53935"></button>` +
    `</span></div>` +
    `<div class="niim-form-row"><label>线条颜色</label><span class="niim-color-dots">` +
    `<button type="button" class="niim-color-dot${strokeColor === "#000000" ? " active" : ""}" data-action="set-table-color" data-field="strokeColor" data-value="#000000" style="--dot:#000"></button>` +
    `<button type="button" class="niim-color-dot${strokeColor === "#E53935" ? " active" : ""}" data-action="set-table-color" data-field="strokeColor" data-value="#E53935" style="--dot:#E53935"></button>` +
    `</span></div></section>`;
}

function tableTextPanel(element) {
  const size = round(element.fontSize || 2.8);
  const align = element.align || 'center';
  const vAlign = element.verticalAlign || 'middle';
  const count = Math.max(1, Math.min(240, Number(element.rows) * Number(element.columns)));
  const cellsHtml = Array.from({ length: count }, function(_, i) {
    return '<input data-action="update-table-cell" data-index="' + i + '" value="' + escapeHtml((element.cells || [])[i] || '') + '">';
  }).join('');
  return '<section class="niim-style-panel niim-table-text">' +
    '<div class="niim-style-toolbar">' +
    '<button type="button" class="niim-tbtn' + (element.bold ? ' active' : '') + '" data-action="toggle-element" data-field="bold"><b>B</b></button>' +
    '<button type="button" class="niim-tbtn' + (element.underline ? ' active' : '') + '" data-action="toggle-element" data-field="underline"><span class="u">U</span></button>' +
    '<button type="button" class="niim-tbtn' + (element.strike ? ' active' : '') + '" data-action="toggle-element" data-field="strike"><span class="s">S</span></button>' +
    '<button type="button" class="niim-tbtn' + (element.italic ? ' active' : '') + '" data-action="toggle-element" data-field="italic"><i>I</i></button></div>' +
    '<div class="niim-size-row"><span class="niim-aa">A<span>A</span></span>' +
    '<input class="niim-size-slider" type="range" min="1" max="20" step="0.1" value="' + size + '" data-action="update-element" data-field="fontSize">' +
    '<button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="-0.2" aria-label="减小字号">' + controlIcon('minus') + '</button>' +
    '<button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="0.2" aria-label="增大字号">' + controlIcon('plus') + '</button></div>' +
    '<div class="niim-size-readout">' + size.toFixed(1) + '</div>' +
    '<div class="niim-align-text-row">' +
    '<button type="button" class="niim-align-t' + (align === 'left' ? ' active' : '') + '" data-action="set-align" data-value="left">左</button>' +
    '<button type="button" class="niim-align-t' + (align === 'center' ? ' active' : '') + '" data-action="set-align" data-value="center">中</button>' +
    '<button type="button" class="niim-align-t' + (align === 'right' ? ' active' : '') + '" data-action="set-align" data-value="right">右</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'top' ? ' active' : '') + '" data-action="set-vertical-align" data-value="top">顶</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'middle' ? ' active' : '') + '" data-action="set-vertical-align" data-value="middle">中</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'bottom' ? ' active' : '') + '" data-action="set-vertical-align" data-value="bottom">底</button></div>' +
    '<div class="niim-spacing-pair"><div class="niim-spacing-item"><span>字距</span><div class="niim-pm">' +
    '<button type="button" data-action="nudge-letter" data-delta="-0.1" aria-label="减小字距">' + controlIcon('minus') + '</button><em>' + round(element.letterSpacing || 0).toFixed(1) + '</em>' +
    '<button type="button" data-action="nudge-letter" data-delta="0.1" aria-label="增大字距">' + controlIcon('plus') + '</button></div></div>' +
    '<div class="niim-spacing-item"><span>行距</span><div class="niim-pm">' +
    '<button type="button" data-action="nudge-line" data-delta="-0.05" aria-label="减小行距">' + controlIcon('minus') + '</button><em>' + round((element.lineSpacing != null ? element.lineSpacing : 0)).toFixed(1) + '</em>' +
    '<button type="button" data-action="nudge-line" data-delta="0.05" aria-label="增大行距">' + controlIcon('plus') + '</button></div></div></div>' +
    '<button type="button" class="niim-mirror-row" data-action="toggle-element" data-field="wordWrap">' +
    '<span>按单词换行</span><span class="niim-switch' + (element.wordWrap ? ' on' : '') + '"><i></i></span></button>' +
    '<div class="table-cell-editor">' + cellsHtml + '</div></section>';
}

/** Style tab from domestic screenshot: B/U/S/I · colors · size slider · align · spacing */
function elementStylePanel(element, state) {
  if (!element) return '';
  if (element.type === 'barcode') return barcodeStylePanel(element);
  if (element.type === 'qrcode') return qrStylePanel(element);
  if (element.type === 'table') return tableStylePanel(element);
  if (element.type === 'rect' || element.type === 'line') {
    const shape = shapeStylePanel(element);
    if (element.borderStyle) {
      return shape + '<button type="button" class="niim-row-command" data-action="open-border-sheet"><span>更换边框</span></button>';
    }
    return shape;
  }
  if (element.type === 'material') {
    const lw = round(element.lineWidth || 0.55);
    return `<section class="niim-style-panel niim-material-style">
      <div class="property-grid">${commonProperties(element)}</div>
      <div class="niim-form-row">
        <label>线粗</label>
        <div class="niim-pm wide">
          <button type="button" data-action="nudge-line-width" data-delta="-0.1" aria-label="减小线粗">${controlIcon('minus')}</button>
          <em>${lw.toFixed(1)}</em>
          <button type="button" data-action="nudge-line-width" data-delta="0.1" aria-label="增大线粗">${controlIcon('plus')}</button>
        </div>
      </div>
      <button type="button" class="niim-row-command" data-action="open-material-sheet"><span>更换素材</span></button>
    </section>`;
  }
  if (element.type === 'image') {
    const fit = element.imageFit || 'stretch';
    const threshold = Math.max(1, Math.min(254, Number(element.threshold) || 180));
    return `<section class="niim-style-panel niim-image-style">
      <div class="niim-form-row"><label>图片适配</label><div class="niim-seg image-fit-seg">
        <button type="button" class="niim-seg-btn${fit === 'contain' ? ' active' : ''}" data-action="set-image-fit" data-value="contain">完整显示</button>
        <button type="button" class="niim-seg-btn${fit === 'cover' ? ' active' : ''}" data-action="set-image-fit" data-value="cover">铺满裁切</button>
        <button type="button" class="niim-seg-btn${fit === 'stretch' ? ' active' : ''}" data-action="set-image-fit" data-value="stretch">拉伸</button>
      </div></div>
      <div class="niim-form-row"><label>黑白阈值 <strong>${threshold}</strong></label><input class="niim-size-slider" type="range" min="1" max="254" value="${threshold}" data-action="update-element" data-field="threshold"></div>
      <div class="property-grid">${commonProperties(element)}</div>
      <button type="button" class="niim-row-command" data-action="replace-image"><span>替换图片</span></button>
    </section>`;
  }
  if (!['text', 'date', 'serial'].includes(element.type)) {
    return `<section class="niim-style-panel"><div class="property-grid">${commonProperties(element)}</div></section>`;
  }
  const size = round(element.fontSize || 4);
  const color = (element.color || '#000000').toUpperCase();
  // Video: plain black/red + star reverse (反白) variants
  const colors = [
    { c: '#000000', star: false, reverse: false, name: '黑' },
    { c: '#E53935', star: false, reverse: false, name: '红' },
    { c: '#000000', star: true, reverse: true, name: '反白' },
    { c: '#E53935', star: true, reverse: true, name: '红反白' }
  ];
  const align = element.align || 'left';
  const vAlign = element.verticalAlign || 'middle';
  const fontInfo = fontFallbackInfo(element.fontFamily, element.sourceFontFamily);
  const fontFamily = fontInfo.renderFamily;
  const textMode = normalizeTextMode(element);
  const directionOpen = !!(state && state.textDirectionOpen);
  const arcAngle = clampTextArcAngle(element.textArcAngle);
  const activeDirection = TEXT_MODE_OPTIONS.find((option) => option.id === textMode) || TEXT_MODE_OPTIONS[0];
  const directionPopover = directionOpen ? `<div class="niim-text-direction-popover" role="dialog" aria-label="文字方向">
    <div class="niim-text-dir-title">文本方向</div>
    <div class="niim-text-dir-grid" role="radiogroup" aria-label="排版模式">
      ${TEXT_MODE_OPTIONS.map((option) => `<button type="button" class="niim-dir-opt${textMode === option.id ? ' active' : ''}" data-action="set-text-mode" data-mode="${option.id}" role="radio" aria-checked="${textMode === option.id ? 'true' : 'false'}" title="${escapeHtml(option.label)}">
        ${editorAsset(`element/attribute/${option.asset}`)}<span>${escapeHtml(option.label)}</span>
      </button>`).join('')}
    </div>
    <div class="niim-text-arc-row${textMode === 'arc' ? '' : ' disabled'}">
      <span>0°</span>
      <input class="niim-text-arc-slider" type="range" min="0" max="180" step="1" value="${arcAngle}" data-action="update-element" data-field="textArcAngle" aria-label="弧形角度" ${textMode === 'arc' ? '' : 'disabled'}>
      <output class="niim-text-arc-readout">${Math.round(arcAngle)}°</output>
      <button type="button" class="niim-text-arc-reset" data-action="reset-text-arc-angle" title="重置为180度" aria-label="重置为180度">${icon('refresh', 'icon-sm')}</button>
    </div>
  </div>` : '';
  return `<section class="niim-style-panel">
    ${directionPopover}
    <div class="niim-style-toolbar">
      <button type="button" class="niim-tbtn${element.bold ? ' active' : ''}" data-action="toggle-element" data-field="bold" title="粗体"><b>B</b></button>
      <button type="button" class="niim-tbtn${element.underline ? ' active' : ''}" data-action="toggle-element" data-field="underline" title="下划线"><span class="u">U</span></button>
      <button type="button" class="niim-tbtn${element.strike ? ' active' : ''}" data-action="toggle-element" data-field="strike" title="删除线"><span class="s">S</span></button>
      <button type="button" class="niim-tbtn${element.italic ? ' active' : ''}" data-action="toggle-element" data-field="italic" title="斜体"><i>I</i></button>
      <button type="button" class="niim-tbtn niim-tdir${directionOpen ? ' active' : ''}" data-action="toggle-text-direction-menu" title="文字方向" aria-expanded="${directionOpen ? 'true' : 'false'}">
        ${editorAsset(`element/attribute/${activeDirection.asset}`)}<span class="niim-tdir-label">方向</span>
      </button>
      <span class="niim-color-dots">
        ${colors.map(({ c, star, reverse, name }) => {
          const active = color === c.toUpperCase() && !!element.reverse === reverse;
          return `<button type="button" class="niim-color-dot${active ? ' active' : ''}${star ? ' star' : ''}" data-action="set-color" data-value="${c}" data-reverse="${reverse ? '1' : '0'}" style="--dot:${c}" title="${escapeHtml(name)}">${star ? icon('star', 'icon-star') : ''}<span class="niim-color-name">${escapeHtml(name)}</span></button>`;
        }).join('')}
      </span>
      <button type="button" class="niim-tbtn niim-clear-style" data-action="clear-text-style" title="清除文字样式">清</button>
    </div>
    <p class="niim-hint">${fontCatalogSummary()}</p>
    <div class="niim-font-catalog compact">${fontCatalogMarkup(fontFamily, { compact: true })}</div>
    ${fontInfo.fallback ? `<p class="niim-hint niim-font-fallback">源字体“${escapeHtml(fontInfo.requested)}”未随模板提供，已用开源「${escapeHtml(fontInfo.label)}」稳定替代。</p>` : ''}
    <div class="niim-size-row">
      <span class="niim-aa">A<span>A</span></span>
      <input class="niim-size-slider" type="range" min="1" max="40" step="0.5" value="${size}" data-action="update-element" data-field="fontSize" aria-label="字号">
      <button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="-0.5" aria-label="减小字号">${controlIcon('minus')}</button>
      <button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="0.5" aria-label="增大字号">${controlIcon('plus')}</button>
    </div>
    <div class="niim-size-readout">${size.toFixed(1)}</div>
    <div class="niim-align-text-row">
      <button type="button" class="niim-align-t${align === 'left' ? ' active' : ''}" data-action="set-align" data-value="left" title="左对齐">${editorAsset('element/attribute/text_align_left.svg')}</button>
      <button type="button" class="niim-align-t${align === 'center' ? ' active' : ''}" data-action="set-align" data-value="center" title="居中">${editorAsset('element/attribute/text_align_center.svg')}</button>
      <button type="button" class="niim-align-t${align === 'right' ? ' active' : ''}" data-action="set-align" data-value="right" title="右对齐">${editorAsset('element/attribute/text_align_right.svg')}</button>
      <button type="button" class="niim-align-t${align === 'justify' ? ' active' : ''}" data-action="set-align" data-value="justify" title="两端">${editorAsset('element/attribute/text_align_h_disttibuted.svg')}</button>
      <button type="button" class="niim-align-t${vAlign === 'top' ? ' active' : ''}" data-action="set-vertical-align" data-value="top" title="顶对齐">${editorAsset('element/attribute/text_align_top.svg')}</button>
      <button type="button" class="niim-align-t${vAlign === 'middle' ? ' active' : ''}" data-action="set-vertical-align" data-value="middle" title="垂直居中">${editorAsset('element/attribute/text_align_middle.svg')}</button>
      <button type="button" class="niim-align-t${vAlign === 'bottom' ? ' active' : ''}" data-action="set-vertical-align" data-value="bottom" title="底对齐">${editorAsset('element/attribute/text_align_bottom.svg')}</button>
    </div>
    <div class="niim-spacing-pair">
      <div class="niim-spacing-item">
        <span>字距</span>
        <div class="niim-pm">
          <button type="button" data-action="nudge-letter" data-delta="-0.1" aria-label="减小字距">${controlIcon('minus')}</button>
          <em>${round(element.letterSpacing || 0).toFixed(1)}</em>
          <button type="button" data-action="nudge-letter" data-delta="0.1" aria-label="增大字距">${controlIcon('plus')}</button>
        </div>
      </div>
      <div class="niim-spacing-item">
        <span>行距</span>
        <div class="niim-pm">
          <button type="button" data-action="nudge-line" data-delta="-0.05" aria-label="减小行距">${controlIcon('minus')}</button>
          <em>${round((element.lineSpacing != null ? element.lineSpacing : 0)).toFixed(1)}</em>
          <button type="button" data-action="nudge-line" data-delta="0.05" aria-label="增大行距">${controlIcon('plus')}</button>
        </div>
      </div>
    </div>
    <button type="button" class="niim-mirror-row" data-action="toggle-element" data-field="wordWrap">
      <span>按单词换行</span>
      <span class="niim-switch${element.wordWrap ? ' on' : ''}"><i></i></span>
    </button>
  </section>`;
}

/** Align tab: 6 align + D-pad + vertical/horizontal spacing + mirror */
function arrangementPanel(state, element) {
  const selected = selectedElements(state);
  const editable = selected.filter((item) => !item.locked);
  const controlElement = editable.find((item) => item.id === state.selectedId) || editable[editable.length - 1] || element;
  const mirrorX = !!(controlElement && controlElement.mirrorX);
  const mirrorY = !!(controlElement && controlElement.mirrorY);
  const editableCount = editable.length;
  const lockedCount = selected.length - editableCount;
  const multi = editableCount > 1;
  const canEdit = editableCount > 0;
  const canDistribute = editableCount >= 3;
  const alignHint = multi ? '相对元素对齐' : '相对标签纸对齐';
  return `<section class="niim-arrange-panel">
    <p class="niim-align-hint">${alignHint}${lockedCount ? ` · ${lockedCount} 个锁定元素不参与` : ''}</p>
    <div class="niim-arrange-row">
      <div class="niim-align-grid" role="group" aria-label="对齐">
        <button type="button" data-action="align-selection" data-value="left" title="左对齐" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_left.svg')}</button>
        <button type="button" data-action="align-selection" data-value="centerH" title="水平居中" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_center_h.svg')}</button>
        <button type="button" data-action="align-selection" data-value="right" title="右对齐" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_right.svg')}</button>
        <button type="button" data-action="align-selection" data-value="top" title="顶部对齐" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_top.svg')}</button>
        <button type="button" data-action="align-selection" data-value="centerV" title="垂直居中" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_center_v.svg')}</button>
        <button type="button" data-action="align-selection" data-value="bottom" title="底部对齐" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_bottom.svg')}</button>
      </div>
      <div class="niim-nudge-pad" role="group" aria-label="微调">
        <button type="button" class="nudge-up" data-action="nudge-element" data-x="0" data-y="-0.5" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_move_top.svg')}</button>
        <button type="button" class="nudge-left" data-action="nudge-element" data-x="-0.5" data-y="0" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_move_left.svg')}</button>
        <button type="button" class="nudge-right" data-action="nudge-element" data-x="0.5" data-y="0" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_move_right.svg')}</button>
        <button type="button" class="nudge-down" data-action="nudge-element" data-x="0" data-y="0.5" ${canEdit ? '' : 'disabled'}>${editorAsset('element/attribute/align_move_bottom.svg')}</button>
      </div>
    </div>
    <div class="niim-gap-row${multi ? '' : ' disabled'}">
      <span>垂直间距</span>
      <div class="niim-pm">
        <i class="niim-gap-ico">${editorAsset('element/attribute/align_uniform_v.svg')}</i>
        <button type="button" data-action="gap-selection" data-axis="v" data-delta="-0.5" aria-label="减小纵向间距" ${multi ? '' : 'disabled'}>${controlIcon('minus')}</button>
        <button type="button" data-action="gap-selection" data-axis="v" data-delta="0.5" aria-label="增大纵向间距" ${multi ? '' : 'disabled'}>${controlIcon('plus')}</button>
      </div>
    </div>
    <div class="niim-gap-row${multi ? '' : ' disabled'}">
      <span>水平间距</span>
      <div class="niim-pm">
        <i class="niim-gap-ico">${editorAsset('element/attribute/align_uniform_h.svg')}</i>
        <button type="button" data-action="gap-selection" data-axis="h" data-delta="-0.5" aria-label="减小横向间距" ${multi ? '' : 'disabled'}>${controlIcon('minus')}</button>
        <button type="button" data-action="gap-selection" data-axis="h" data-delta="0.5" aria-label="增大横向间距" ${multi ? '' : 'disabled'}>${controlIcon('plus')}</button>
      </div>
    </div>
    <div class="niim-distribute-row${canDistribute ? '' : ' disabled'}">
      <span>等距分布</span>
      <div class="niim-distribute-actions">
        <button type="button" class="button-secondary compact" data-action="distribute-selection" data-value="horizontal" ${canDistribute ? '' : 'disabled'}>水平等距</button>
        <button type="button" class="button-secondary compact" data-action="distribute-selection" data-value="vertical" ${canDistribute ? '' : 'disabled'}>垂直等距</button>
      </div>
    </div>
    <button type="button" class="niim-mirror-row" data-action="mirror-element" data-axis="x" ${canEdit ? '' : 'disabled'}><span>水平镜像</span><span class="niim-switch${mirrorX ? ' on' : ''}"><i></i></span></button>
    <button type="button" class="niim-mirror-row" data-action="mirror-element" data-axis="y" ${canEdit ? '' : 'disabled'}><span>垂直镜像</span><span class="niim-switch${mirrorY ? ' on' : ''}"><i></i></span></button>
  </section>`;
}

function labelPanel(state) {
  return `<section class="property-section">
    <div class="property-grid">
      <div class="field wide"><label for="document-name">名称</label><input id="document-name" data-action="update-document" data-field="name" value="${escapeHtml(state.document.name)}"></div>
      ${numericField('宽度 (mm)', 'document-width', state.document.widthMm, 0.1, 0.1)}
      ${numericField('高度 (mm)', 'document-height', state.document.heightMm, 0.1, 0.1)}
    </div>
    <button class="native-wide-command" data-action="open-stock-sheet">${icon('settings', 'icon-sm')}<span>替换标签纸 / 常用尺寸</span>${icon('chevronRight', 'icon-sm')}</button>
  </section>`;
}

function propertyPanel(state) {
  const element = selectedElement(state);
  const selection = selectedElements(state);
  const lockedSingle = !!(element && element.locked && selection.length === 1 && state.editorPanelTab !== 'layers');
  let tabs;
  // Screenshots: 内容 | 样式 | 字体 | 对齐/镜像 (selected); 添加元素 | 模板 | 数据源 (idle)
  if (lockedSingle) {
    tabs = [['locked', '元素已锁定']];
  } else if (state.editorPanelTab === 'layers') {
    tabs = [['layers', '图层']];
  } else if (selection.length > 1) {
    tabs = [['arrange', '对齐/镜像']];
  } else if (element) {
    const textLike = ['text', 'date', 'serial'].includes(element.type);
    const shapeLike = element.type === 'rect' || element.type === 'line';
    if (shapeLike) {
      // Video: 形状 | 对齐/镜像
      tabs = [['style', '形状'], ['arrange', '对齐/镜像']];
    } else if (element.type === 'date') {
      // 截图: 时间 | 样式 | 字体 | 对齐/镜像
      tabs = [['content', '时间'], ['style', '样式'], ['font', '字体'], ['arrange', '对齐/镜像']];
    } else if (element.type === 'serial') {
      tabs = [['content', '数值'], ['style', '样式'], ['font', '字体'], ['arrange', '对齐/镜像']];
    } else if (element.type === 'table') {
      tabs = [['style', '表格'], ['content', '文本'], ['font', '字体'], ['arrange', '对齐']];
    } else if (element.type === 'material') {
      tabs = [['content', '素材'], ['style', '样式'], ['arrange', '对齐/镜像']];
    } else if (textLike) {
      tabs = [['content', '内容'], ['style', '样式'], ['font', '字体'], ['arrange', '对齐/镜像']];
    } else {
      tabs = [['content', '内容'], ['style', '样式'], ['arrange', '对齐/镜像']];
    }
  } else {
    tabs = [['elements', '添加元素'], ['templates', '模板'], ['data-source', '数据源']];
  }
  const allowed = tabs.map(([value]) => value);
  let active = allowed.includes(state.editorPanelTab) ? state.editorPanelTab : allowed[0];
  let body = '';
  if (active === 'elements') body = elementPicker(state);
  else if (active === 'templates') body = editorTemplatePanel(state);
  else if (active === 'data-source') body = editorDataPanel(state);
  else if (active === 'label') body = labelPanel(state);
  else if (active === 'layers') body = `<section class="property-section">${layerList(state)}</section>`;
  else if (active === 'content') body = elementContentPanel(element, state);
  else if (active === 'font') body = elementFontPanel(element);
  else if (active === 'style') body = elementStylePanel(element, state);
  else if (active === 'locked') body = `<section class="niim-locked-panel">
    <span class="niim-locked-icon">${icon('lock')}</span>
    <div><strong>这个元素已锁定</strong><p>解锁后才能修改内容、样式、位置和层级。</p></div>
    <div class="niim-locked-actions"><button type="button" class="button" data-action="toggle-lock">解锁并编辑</button><button type="button" class="button-secondary" data-action="duplicate-element">复制为可编辑元素</button></div>
  </section>`;
  else body = arrangementPanel(state, element);

  // Text/barcode content: system keyboard bar, hide footer. Date「时间」keeps 保存/打印.
  const contentMode = active === 'content' && element && ['text', 'barcode', 'qrcode'].includes(element.type);
  const unlockCommand = '';
  // Equal-width fixed tabs when editing an element (内容|样式|字体|对齐)
  const equalTabs = !!(element || selection.length > 1) && state.editorPanelTab !== 'layers';

  return `<div class="niim-panel-head">
      <div class="niim-panel-tabs${equalTabs ? ' equal' : ''}" role="tablist" data-tab-count="${tabs.length}">
        <i class="niim-tab-indicator" aria-hidden="true"></i>
        ${tabs.map(([value, label]) => `<button type="button" class="niim-panel-tab${active === value ? ' active' : ''}" data-action="set-editor-panel-tab" data-tab="${value}" role="tab" aria-selected="${active === value}" tabindex="${active === value ? '0' : '-1'}"><span>${escapeHtml(label)}</span></button>`).join('')}
      </div>
      <button type="button" class="niim-panel-fold" data-action="toggle-property-panel" title="${state.panelCollapsed ? '展开' : '收起'}">${editorAsset('common/attributeDown.svg')}</button>
    </div>
    ${unlockCommand}
    <div class="niim-panel-body editor-panel-body${contentMode ? ' content-mode' : ''}" data-panel-body="${active}">${body}</div>
    ${contentMode ? '' : `<div class="niim-panel-footer">
      <button type="button" class="niim-panel-save" data-action="save-project">
        ${editorAsset('bottom_bar/bottom_bar_save.svg')}<span>保存</span>
      </button>
      <button type="button" class="niim-panel-print" data-action="open-print">
        ${editorAsset('bottom_bar/bottom_bar_print.svg')}<span>打印</span>
      </button>
    </div>`}`;
}

function editorView(state) {
  const document = state.document;
  const ratio = document.widthMm / Math.max(0.1, document.heightMm);
  const selection = selectedElements(state);
  const activeElement = selectedElement(state);
  const profile = PROFILES.find((item) => item.id === state.settings.defaultProfileId) || PROFILES[0];
  const code = stockCode(document, profile.dpi);
  const realLabelId = document.labelId || "";
  const attentionMessage = templateAttentionMessage(document);
  const contentMode = selection.length === 1 && state.editorPanelTab === 'content'
    && activeElement && ['text', 'barcode', 'qrcode'].includes(activeElement.type);
  return `${sprite()}
    <main class="editor-shell niim-editor${state.canvasExpanded ? ' canvas-expanded' : ''}${state.panelCollapsed ? ' panel-collapsed' : ''}${selection.length ? ' has-selection' : ''}${contentMode ? ' content-editing' : ''}">
      <header class="niim-topbar" aria-label="标签编辑器">
        <button type="button" class="niim-top-btn" data-action="close-editor" title="关闭">${editorAsset('app_bar/app_bar_close.svg')}</button>
        <button type="button" class="niim-top-btn" data-action="undo" title="撤销" ${state.undo.length ? '' : 'disabled'}>${editorAsset('app_bar/app_bar_undo.svg')}</button>
        <button type="button" class="niim-top-btn" data-action="redo" title="重做" ${state.redo.length ? '' : 'disabled'}>${editorAsset('app_bar/app_bar_redo.svg')}</button>
        <div class="niim-top-spacer"></div>
        <div class="niim-top-actions">
          <button type="button" class="niim-top-btn" data-action="open-layers" title="图层">${icon('layers')}</button>
          <button type="button" class="niim-top-btn${state.editorMenu === 'clear' ? ' active' : ''}" data-action="editor-clear-menu" title="清空">${editorAsset('app_bar/app_bar_clear.svg')}</button>
          <button type="button" class="niim-top-btn${state.editorMenu === 'settings' ? ' active' : ''}" data-action="editor-more" title="设置">${editorAsset('app_bar/app_bar_setting.svg')}</button>
          <button type="button" class="niim-top-btn niim-top-im" data-action="help" title="使用帮助" aria-label="使用帮助">${icon('help')}</button>
        </div>
      </header>
      <div class="niim-stock-row">
        <button type="button" class="niim-stock-bar" data-action="open-stock-sheet">
          <span>${escapeHtml(code)}</span>
          ${editorAsset('common/attributeDown.svg', 'stock-caret')}
        </button>
        ${realLabelId ? `<button type="button" class="niim-label-id" data-action="open-stock-sheet" title="标签 ID">
          ${icon('info', 'icon-sm')}<span>ID:${escapeHtml(realLabelId)}</span>
        </button>` : ''}
        ${state.draftSavedAt ? '<span class="niim-save-chip">草稿已自动保存</span>' : ''}
      </div>
      ${attentionMessage ? `<div class="niim-template-attention" role="alert">${icon('info', 'icon-sm')}<span>${escapeHtml(attentionMessage)}</span></div>` : ''}
      ${state.editorMenu === 'settings' ? `<div class="editor-more-menu niim-menu" role="menu">
        <button data-action="rename-document">重命名标签</button>
        <button data-action="save-as-template">保存为模板</button>
        <button data-action="open-stock-sheet">标签纸设置</button>
        <button data-action="set-editor-panel-tab" data-tab="data-source">数据源</button>
        <button data-action="open-devices">连接打印机</button>
      </div>` : ''}
      ${state.editorMenu === 'clear' ? `<div class="editor-more-menu niim-menu" role="menu">
        <button data-action="toggle-multi-select">${state.multiSelect ? '退出多选' : '多选'}</button>
        <button data-action="select-all-elements">全选</button>
        <button data-action="select-element-type" data-type="text">全选文本</button>
        <button data-action="confirm-clear-elements" class="danger">清空画布</button>
      </div>` : ''}
      <section class="niim-stage editor-stage">
        ${contextActions(state)}
        ${!selection.length ? `<button type="button" class="niim-canvas-expand" data-action="toggle-canvas-expand" title="展开画布">${editorAsset('canvas_expand.svg')}</button>` : ''}
        <div class="canvas-workarea">
          <div class="canvas-fit-frame" style="--label-ratio:${ratio}">
            <div class="canvas-zoom-frame" style="width:${state.zoom}%">
              <div id="canvas-viewport" class="canvas-viewport niim-viewport" style="--label-ratio:${ratio}">
                <canvas id="label-canvas" aria-hidden="true"></canvas>
                <canvas id="selection-canvas" class="selection-canvas" tabindex="0" aria-label="标签画布，${document.widthMm}×${document.heightMm} 毫米，共 ${document.elements.length} 个元素${selection.length ? `，已选中 ${selection.length} 个` : ''}。可用方向键微调选中元素"></canvas>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside class="niim-panel editor-panel${activeElement && activeElement.locked && selection.length === 1 ? ' locked' : ''}">${propertyPanel(state)}</aside>
    </main>`;
}

function devicesSheet(state) {
  return `<div class="sheet-backdrop" data-action="close-modal"></div><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="devices-title">
    <div class="sheet-handle"></div>
    <div class="sheet-header"><div><h2 id="devices-title">${icon('bluetooth', 'icon-sm')}打印机</h2><div class="topbar-subtitle">蓝牙设备</div></div><div class="row-actions">${state.scanning ? '<span class="loading-spinner" aria-label="扫描中"></span>' : `<button type="button" class="icon-button" data-action="scan-devices" title="重新扫描" aria-label="重新扫描">${icon('refresh')}</button>`}<button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button></div></div>
    ${state.device ? `<div class="device-banner ux-device-connected"><div class="device-visual">${icon('printer')}</div><div><p class="device-name">${escapeHtml(state.device.name)}</p><div class="device-meta"><span><i class="status-dot online"></i>已连接</span><span>${state.device.mtu ? '传输通道就绪' : '基础通道'}</span></div></div><button type="button" class="button-danger" data-action="disconnect-device">断开</button></div><div style="height:12px"></div>` : ''}
    <div class="device-list">${state.devices.length ? state.devices.map((device) => `<button type="button" class="device-item" data-action="connect-device" data-id="${escapeHtml(device.deviceId)}" ${state.connecting ? 'disabled' : ''}><span class="device-visual">${icon('bluetooth')}</span><span><span class="device-name">${escapeHtml(device.displayName || device.name || '蓝牙打印机')}</span><span class="device-meta">编号 ${escapeHtml(String(device.deviceId || '').slice(-8) || '-')}${device.RSSI == null ? '' : ` · 信号${device.RSSI >= -60 ? '强' : device.RSSI >= -75 ? '中' : '弱'}`}</span></span><span class="signal-bars" aria-label="信号"><i></i><i></i><i></i><i></i></span></button>`).join('') : `<div class="empty-state"><span class="empty-state-icon">${icon(state.scanning ? 'search' : 'bluetooth')}</span><div>${state.scanning ? '正在搜索附近设备…' : '未发现打印机'}</div>${state.scanning ? '' : '<button type="button" class="button" data-action="scan-devices">重新扫描</button>'}</div>`}</div>
  </section>`;
}

function printSheet(state) {
  const settings = state.settings;
  const profileId = state.device && state.device.profileId || settings.defaultProfileId;
  const profile = PROFILES.find((item) => item.id === profileId) || PROFILES[0];
  const densityMax = profile.densityMax || 5;
  const densityMin = profile.densityMin || 1;
  const density = Math.max(densityMin, Math.min(densityMax, Number(settings.density) || profile.densityDefault || 3));
  const doc = state.document;
  const batchCount = Array.isArray(state.pendingBatchDocuments) ? state.pendingBatchDocuments.length : 0;
  const batchIndex = Math.max(0, Number(state.pendingBatchIndex) || 0);
  const block = state.printBlock;
  const printabilityNotice = doc ? (evaluatePrintability(doc, profile).notice || '') : '';
  // With a printer connected the model is a fact, not a preference — offering
  // another model would promise something a menu cannot deliver.
  const suggested = block && block.suggestProfileId && !state.device
    ? PROFILES.find((item) => item.id === block.suggestProfileId)
    : null;
  return `<div class="sheet-backdrop"${state.printing ? '' : ' data-action="close-modal"'}></div>
  <section class="bottom-sheet print-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="print-title">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div>
        <h2 id="print-title">${icon('printer', 'icon-sm')}打印标签</h2>
        <div class="topbar-subtitle">${batchCount
          ? `批量任务 ${Math.min(batchIndex + 1, batchCount)} / ${batchCount} · 每行 ${settings.copies} 份`
          : doc ? `${escapeHtml(doc.name)} · ${doc.widthMm}×${doc.heightMm} mm` : '打印预览'}</div>
      </div>
      <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭" ${state.printing ? 'disabled' : ''}>${icon('close')}</button>
    </div>
    ${block ? `<div class="print-notice blocked" role="alert">
      <span class="ux-notice-ico">${icon('info')}</span>
      <strong>${block.kind === 'placeholder'
        ? '还有默认内容未改'
        : block.kind === 'empty'
          ? '画布还是空的'
        : block.kind === 'element' && /^CODE_|^INVALID_CODE/.test(block.errorCode || '')
          ? '条码或二维码需要调整'
        : block.kind !== 'size'
          ? '内容装不下，暂时无法打印'
          : state.device
            ? `已连接的 ${escapeHtml(state.device.name)} 打不了这张标签`
            : '这张标签超出当前机型的可打印范围'}</strong>
      <p>${escapeHtml(block.message)}${block.kind === 'size' && doc ? ` · 当前标签 ${doc.widthMm}×${doc.heightMm} mm` : ''}</p>
      <div class="print-notice-actions">
        ${block.kind === 'empty'
          ? '<button type="button" class="button compact" data-action="close-modal">返回编辑</button>'
          : (block.kind === 'placeholder' || block.kind === 'element') && block.elementId
          ? `${block.errorCode === 'CODE_MODULE_DENSITY_LOW' ? `<button type="button" class="button compact" data-action="fix-code-size" data-id="${escapeHtml(block.elementId)}">按最小清晰度放大</button>` : ''}
             ${block.canConfirmOriginal ? `<button type="button" class="button compact" data-action="confirm-placeholder-value" data-id="${escapeHtml(block.elementId)}">确认使用当前编码</button>` : ''}
             <button type="button" class="button-secondary compact" data-action="focus-placeholder" data-id="${escapeHtml(block.elementId)}">定位并修改</button>
             <button type="button" class="button-secondary compact" data-action="close-modal">返回编辑</button>`
          : `${suggested ? `<button type="button" class="button compact" data-action="apply-suggested-profile" data-id="${escapeHtml(suggested.id)}">换成 ${escapeHtml(suggested.name)}</button>` : ''}
             <button type="button" class="button-secondary compact" data-action="open-stock-sheet">更换标签纸</button>`}
      </div>
    </div>` : ''}
    ${!block && printabilityNotice ? `<div class="print-notice advisory">
      <span class="ux-notice-ico">${icon('info')}</span>
      <strong>将居中裁切打印</strong>
      <p>${escapeHtml(printabilityNotice)}</p>
    </div>` : ''}
    ${state.printError ? `<div class="print-notice failed" role="alert">
      <span class="ux-notice-ico">${icon('info')}</span>
      <strong>打印失败</strong>
      <p>${escapeHtml(state.printError.message)}</p>
      <div class="print-notice-actions">
        <button type="button" class="button compact" data-action="retry-print">重试打印</button>
        <button type="button" class="button-secondary compact" data-action="open-devices">重新连接</button>
      </div>
    </div>` : ''}
    <button type="button" class="print-device-row" data-action="open-devices">
      <span class="device-visual">${icon(state.device ? 'printer' : 'bluetooth')}</span>
      <span class="print-device-meta">
        <strong>${state.device ? escapeHtml(state.device.name) : '未连接打印机'}</strong>
        <small>${state.device ? '已连接 · 传输通道就绪' : '点击连接热敏打印机'}</small>
      </span>
      <span class="section-link">${state.device ? '切换' : '连接'}${icon('chevronRight', 'icon-sm')}</span>
    </button>
    <div class="print-preview"><canvas id="print-preview-canvas" aria-label="打印预览"></canvas></div>
    <div class="print-options">
      <div class="field"><label for="print-profile">打印机型号 / 协议</label><select id="print-profile" data-action="update-setting" data-field="defaultProfileId" ${state.device ? 'disabled aria-describedby="connected-profile-hint"' : ''}>${PROFILES.map((item) => `<option value="${item.id}" ${item.id === profileId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>${state.device ? '<small id="connected-profile-hint">已按当前连接设备自动识别</small>' : ''}</div>
      <div class="field"><label for="print-label-type">纸张类型</label><select id="print-label-type" data-action="update-setting" data-field="labelType">
        <option value="1" ${Number(settings.labelType) === 1 ? 'selected' : ''}>间隙纸</option>
        <option value="2" ${Number(settings.labelType) === 2 ? 'selected' : ''}>黑标纸</option>
        <option value="3" ${Number(settings.labelType) === 3 ? 'selected' : ''}>连续纸</option>
        <option value="4" ${Number(settings.labelType) === 4 ? 'selected' : ''}>定孔纸</option>
      </select></div>
      <div class="field"><label for="print-copies">份数</label><div class="stepper"><button type="button" data-action="change-copies" data-delta="-1" aria-label="减少份数" ${state.printing ? 'disabled' : ''}>${controlIcon('minus')}</button><input id="print-copies" value="${settings.copies}" readonly><button type="button" data-action="change-copies" data-delta="1" aria-label="增加份数" ${state.printing ? 'disabled' : ''}>${controlIcon('plus')}</button></div></div>
      <div class="field"><label for="print-density">浓度 <strong>${density}</strong> / ${densityMax}</label><input id="print-density" type="range" min="${densityMin}" max="${densityMax}" value="${density}" data-action="update-setting" data-field="density" ${state.printing ? 'disabled' : ''}></div>
      <div class="field"><label for="print-threshold">黑白阈值 <strong>${settings.threshold}</strong></label><input id="print-threshold" type="range" min="1" max="254" value="${settings.threshold}" data-action="update-setting" data-field="threshold" ${state.printing ? 'disabled' : ''}></div>
    </div>
    ${state.printing ? `<div class="progress-track" role="progressbar" aria-label="打印进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.printProgress}"><div class="progress-fill" style="width:${state.printProgress}%"></div></div><div class="device-meta" role="status">${escapeHtml(state.printMessage)}</div>` : ''}
    <div class="print-sheet-actions sticky-sheet-actions">
      ${state.printing
        ? `<button type="button" class="button-danger" data-action="cancel-print">停止打印</button>
           <button type="button" class="button print-submit" disabled>正在打印…</button>`
        : `<button type="button" class="button-secondary" data-action="${batchCount ? 'cancel-batch-print' : 'close-modal'}">${batchCount ? '取消批量任务' : '返回编辑'}</button>
           <button type="button" class="button print-submit" data-action="start-print" ${block ? 'disabled' : ''}>${block ? '请先解决上方问题' : state.device ? (batchCount ? `开始连续打印 ${batchCount} 张` : '开始打印') : '连接并打印'}</button>`}
    </div>
  </section>`;
}

function infoSheet(title, body, actionLabel) {
  return `<div class="sheet-backdrop" data-action="close-modal"></div><section class="bottom-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="sheet-handle"></div><div class="sheet-header"><h2>${icon('info', 'icon-sm')}${escapeHtml(title)}</h2><button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button></div><div style="color:var(--muted);line-height:1.7">${body}</div>${actionLabel ? `<button type="button" class="button print-submit" data-action="close-modal">${escapeHtml(actionLabel)}</button>` : ''}</section>`;
}

function defaultPrintSettingsSheet(state) {
  const settings = state.settings;
  const profile = PROFILES.find((item) => item.id === settings.defaultProfileId) || PROFILES[0];
  const densityMin = profile.densityMin || 1;
  const densityMax = profile.densityMax || 5;
  const density = Math.max(densityMin, Math.min(densityMax, Number(settings.density) || profile.densityDefault || 3));
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="default-print-settings-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="default-print-settings-title">${icon('settings', 'icon-sm')}默认打印参数</h2><div class="topbar-subtitle">新打印任务会优先使用这些设置</div></div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="default-print-profile">打印机型号 / 协议</label><select id="default-print-profile" data-action="update-setting" data-field="defaultProfileId">${PROFILES.map((item) => `<option value="${item.id}" ${item.id === settings.defaultProfileId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="default-label-type">纸张类型</label><select id="default-label-type" data-action="update-setting" data-field="labelType">
          <option value="1" ${Number(settings.labelType) === 1 ? 'selected' : ''}>间隙纸</option>
          <option value="2" ${Number(settings.labelType) === 2 ? 'selected' : ''}>黑标纸</option>
          <option value="3" ${Number(settings.labelType) === 3 ? 'selected' : ''}>连续纸</option>
          <option value="4" ${Number(settings.labelType) === 4 ? 'selected' : ''}>定孔纸</option>
        </select></div>
          <div class="field"><label for="default-print-copies">默认份数</label><div class="stepper"><button type="button" data-action="change-copies" data-delta="-1" aria-label="减少份数">${controlIcon('minus')}</button><input id="default-print-copies" value="${settings.copies}" readonly><button type="button" data-action="change-copies" data-delta="1" aria-label="增加份数">${controlIcon('plus')}</button></div></div>
        <div class="field"><label for="default-print-density">浓度 <strong>${density}</strong> / ${densityMax}</label><input id="default-print-density" type="range" min="${densityMin}" max="${densityMax}" value="${density}" data-action="update-setting" data-field="density"></div>
        <div class="field"><label for="default-print-threshold">黑白阈值 <strong>${settings.threshold}</strong></label><input id="default-print-threshold" type="range" min="1" max="254" value="${settings.threshold}" data-action="update-setting" data-field="threshold"></div>
      </div>
      <button type="button" class="button print-submit" data-action="close-modal">完成</button>
    </section>`;
}

function elementSummary(documentValue) {
  const counts = {};
  (documentValue.elements || []).forEach((item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
  });
  const labels = {
    text: '文本', barcode: '一维码', qrcode: '二维码', date: '时间',
    serial: '序列号', image: '图片', rect: '形状', line: '线条',
    table: '表格', material: '素材'
  };
  return Object.keys(counts).map((type) => `${labels[type] || type}×${counts[type]}`).join(' · ') || '空白';
}

function templatePreviewSheet(state) {
  const libraryEntry = getLibraryEntry(state.templatePreviewId);
  const libraryTemplate = libraryEntry
    ? Object.assign(catalogMeta(libraryEntry), { document: buildLibraryDocument(libraryEntry.id) })
    : null;
  const template = libraryTemplate
    || templates.find((item) => item.id === state.templatePreviewId)
    || (state.remoteTemplates || []).find((item) => item.id === state.templatePreviewId)
    || state.userTemplates.map(userTemplateCard).find((item) => item.id === state.templatePreviewId);
  if (!template) {
    return `<div class="sheet-backdrop" data-action="close-modal"></div>
      <section class="bottom-sheet template-sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="sheet-header"><h2>模板不可用</h2><button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button></div>
        <div class="empty-state soft"><span class="empty-state-icon">${icon('help')}</span><div>找不到该模板，可能已被删除</div></div>
        <button type="button" class="button print-submit" data-action="close-modal">关闭</button>
      </section>`;
  }
  const documentValue = template.document || buildTemplateDocument(template);
  const ratio = documentValue.widthMm / Math.max(0.1, documentValue.heightMm);
  const industry = template.industry || (template.userTemplate ? '我的模板' : '行业模板');
  const sceneLabels = sceneIdsForTemplate(template)
    .map((id) => sceneForId(id))
    .filter(Boolean)
    .map((scene) => scene.label);
  const originLabel = templateOriginLabel(template);
  const distinctBadge = template.badge && template.badge !== originLabel ? template.badge : '';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet template-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div>
          <h2 id="template-preview-title">${icon('template', 'icon-sm')}${escapeHtml(template.name)}</h2>
          <div class="topbar-subtitle">${template.size[0]}×${template.size[1]} mm · ${escapeHtml(template.category || '我的')} · ${escapeHtml(industry)}</div>
        </div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="template-preview-stage">
        <div class="template-preview-frame" style="--label-ratio:${ratio}">
          <div class="template-preview-loading" data-role="template-preview-status">正在渲染预览…</div>
          <canvas id="template-preview-canvas" aria-label="模板预览" hidden></canvas>
        </div>
      </div>
      <div class="template-preview-meta">
        ${distinctBadge ? `<span class="template-badge static">${escapeHtml(distinctBadge)}</span>` : ''}
        ${originLabel ? `<span class="template-source-badge static">${escapeHtml(originLabel)}</span>` : ''}
        <p>${escapeHtml(template.blurb || '本地行业模板，打开后可自由改字、改尺寸并打印。')}</p>
        <div class="device-meta">
          ${template.taskLabel ? `<span>任务 ${escapeHtml(template.taskLabel)}</span>` : ''}
          ${template.variantLabel ? `<span>版式 ${escapeHtml(template.variantLabel)}</span>` : ''}
          ${sceneLabels.length ? `<span>适用 ${escapeHtml(sceneLabels.join(' / '))}</span>` : ''}
          <span>${escapeHtml(elementSummary(documentValue))}</span>
          <span>${(documentValue.elements || []).length} 个元素</span>
          <span>纸张 ${documentValue.widthMm}×${documentValue.heightMm} mm</span>
        </div>
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="use-template" data-id="${escapeHtml(template.id)}">使用此模板</button>
      </div>
    </section>`;
}

function printHistorySheet(state) {
  const history = state.printHistory || [];
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="print-history-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="print-history-title">${icon('history', 'icon-sm')}打印历史</h2><div class="topbar-subtitle">本机最近 ${history.length} 条 · 可重新打开或再打</div></div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="history-list">
        ${history.length ? history.slice(0, 30).map((item) => {
          const canReopen = !!(item.document || item.projectId);
          return `<div class="history-item">
          <span class="ux-history-ico">${icon('printer', 'icon-sm')}</span>
          <div class="history-main">
            <strong>${escapeHtml(item.name || '未命名标签')}</strong>
            <span class="history-result ${item.result === 'success' ? 'ok' : item.result === 'cancelled' ? 'warn' : 'fail'}">${item.result === 'success' ? '成功' : item.result === 'cancelled' ? '已取消' : '失败'}</span>
          </div>
          <div class="device-meta">
            <span>${escapeHtml(item.device || '未连接设备')}</span>
            <span>${item.copies || 1} 份</span>
            ${item.widthMm && item.heightMm ? `<span>${item.widthMm}×${item.heightMm} mm</span>` : ''}
            <span>${formatDate(item.createdAt)}</span>
          </div>
          ${item.error ? `<div class="history-error">${escapeHtml(item.error)}</div>` : ''}
          <div class="history-actions">
            <button type="button" class="button-secondary compact" data-action="history-open" data-id="${escapeHtml(item.id)}" ${canReopen ? '' : 'disabled'}>打开</button>
            <button type="button" class="button compact" data-action="history-reprint" data-id="${escapeHtml(item.id)}" ${canReopen ? '' : 'disabled'}>再打印</button>
          </div>
        </div>`;
        }).join('') : `<div class="empty-state soft"><span class="empty-state-icon">${icon('history')}</span><div>还没有打印记录，完成一次打印后会出现在这里</div></div>`}
      </div>
    </section>`;
}

function renderMain(state) {
  if (state.route === 'templates') return templatesView(state);
  if (state.route === 'projects') return projectsView(state);
  if (state.route === 'data') return dataView(state);
  if (state.route === 'profile') return profileView(state);
  if (state.route === 'editor' && state.document) return editorView(state);
  const homeMarkup = homeView(state);
  if (state.route !== 'home') return homeMarkup;
  const settings = state.settings || {};
  if (settings.onboardingDone === true) return homeMarkup;
  const step = state.onboardingStep || 1;
  return `${homeMarkup}
    <div class="onboarding-overlay" role="dialog" aria-modal="true" aria-label="新手引导">
      <div class="onboarding-card">
        <div class="onboarding-dots"><span class="onboarding-dot active"></span><span class="onboarding-dot"></span><span class="onboarding-dot"></span></div>
        <div class="onboarding-step">${onboardingStepMarkup(state)}</div>
        <div class="onboarding-actions">
          <button type="button" class="button-secondary compact" data-action="onboarding-skip">跳过</button>
          <button type="button" class="button compact" data-action="onboarding-next">${step < 3 ? '下一步' : '开始使用'}</button>
        </div>
      </div>
    </div>`;
}

function stockSheet(state) {
  const width = Number(state.stockWidthMm) || state.settings.defaultWidthMm || 40;
  const height = Number(state.stockHeightMm) || state.settings.defaultHeightMm || 12;
  const inEditor = state.route === 'editor' && state.document;
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="stock-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="stock-title">${icon('template', 'icon-sm')}标签纸</h2><div class="topbar-subtitle">选择常用尺寸或自定义毫米宽高</div></div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="stock-preset-grid">
        ${STOCK_PRESETS.map((preset) => {
          const active = preset.widthMm === width && preset.heightMm === height;
          return `<button class="stock-preset${active ? ' active' : ''}" data-action="pick-stock-preset" data-width="${preset.widthMm}" data-height="${preset.heightMm}" data-name="${escapeHtml(preset.name)}">
            <strong>${preset.widthMm}×${preset.heightMm}</strong>
            <span>${escapeHtml(preset.name)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="print-options">
        <div class="field"><label for="stock-width">宽度 (mm)</label><input id="stock-width" type="number" min="5" max="200" step="0.1" value="${width}" data-action="stock-field" data-field="stockWidthMm"></div>
        <div class="field"><label for="stock-height">高度 (mm)</label><input id="stock-height" type="number" min="5" max="200" step="0.1" value="${height}" data-action="stock-field" data-field="stockHeightMm"></div>
        <div class="field wide"><label for="stock-label-type">纸张类型</label><select id="stock-label-type" data-action="stock-label-type">
          <option value="1" ${Number(state.stockLabelType == null ? state.settings.labelType : state.stockLabelType) === 1 ? 'selected' : ''}>间隙纸</option><option value="2" ${Number(state.stockLabelType == null ? state.settings.labelType : state.stockLabelType) === 2 ? 'selected' : ''}>黑标纸</option><option value="3" ${Number(state.stockLabelType == null ? state.settings.labelType : state.stockLabelType) === 3 ? 'selected' : ''}>连续纸</option><option value="4" ${Number(state.stockLabelType == null ? state.settings.labelType : state.stockLabelType) === 4 ? 'selected' : ''}>定孔纸</option>
        </select></div>
        ${inEditor ? `<div class="field wide"><label class="toggle-row"><span>同时应用到当前标签</span><input type="checkbox" data-action="stock-apply-current" ${state.stockApplyCurrent !== false ? 'checked' : ''}></label></div>` : ''}
        ${inEditor ? `<button type="button" class="native-wide-command field wide" data-action="rotate-document">${icon('rotate', 'icon-sm')}<span>旋转标签方向（宽高互换）${state.stockRotationTurns ? ` · ${state.stockRotationTurns * 90}°` : ''}</span>${icon('chevronRight', 'icon-sm')}</button>` : ''}
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="apply-stock">确认标签纸</button>
      </div>
    </section>`;
}

function batchSheet(state) {
  const rows = state.dataRows || [];
  const selected = Array.isArray(state.batchSelectedRows)
    ? state.batchSelectedRows
    : rows.map((_, index) => index);
  const requestedTemplateId = state.settings.batchTemplateId || 'product-simple';
  const catalog = BATCH_TEMPLATES.filter(isBatchCompatibleTemplate);
  const selectedTemplate = resolveBatchCompatibleTemplate(catalog, requestedTemplateId, 'product-simple');
  const templateId = selectedTemplate ? selectedTemplate.id : '';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet batch-sheet" role="dialog" aria-modal="true" aria-labelledby="batch-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="batch-title">${icon('sheet', 'icon-sm')}批量生成标签</h2><div class="topbar-subtitle">${rows.length} 条数据 · 已选 ${selected.length} 行</div></div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="batch-template">套用模板</label>
          <select id="batch-template" data-action="batch-template">
            ${catalog.length
              ? catalog.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === templateId ? 'selected' : ''}>${escapeHtml(item.name)} (${item.size ? `${item.size[0]}×${item.size[1]}` : '自定义'})</option>`).join('')
              : '<option value="">暂无支持批量的数据模板</option>'}
          </select>
        </div>
        <div class="field wide"><label for="batch-mode">生成方式</label>
          <select id="batch-mode" data-action="batch-mode">
            <option value="print" ${state.batchMode === 'print' ? 'selected' : ''}>连续打印全部选中行</option>
            <option value="open-first" ${state.batchMode === 'open-first' ? 'selected' : ''}>打开第一行到编辑器</option>
            <option value="projects" ${state.batchMode === 'projects' ? 'selected' : ''}>全部生成到「我的标签」</option>
          </select>
        </div>
      </div>
      <div class="batch-row-list">
        <div class="batch-row-toolbar">
          <button type="button" class="button-secondary compact" data-action="batch-select-all">全选</button>
          <button type="button" class="button-secondary compact" data-action="batch-select-none">清空</button>
        </div>
        ${rows.length ? rows.map((row, index) => `<label class="batch-row-item">
          <input type="checkbox" data-action="batch-toggle-row" data-row="${index}" ${selected.includes(index) ? 'checked' : ''}>
          <span class="batch-row-index">${index + 1}</span>
          <span class="batch-row-main"><strong>${escapeHtml(row.name || '未命名')}</strong><small>${escapeHtml(row.code || '')} · ${escapeHtml(row.price || '')} · ${escapeHtml(row.date || '')}</small></span>
        </label>`).join('') : `<div class="empty-state soft"><span class="empty-state-icon">${icon('sheet')}</span><div>还没有批量数据</div><button type="button" class="button-secondary compact" data-action="close-modal">去添加数据</button></div>`}
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="run-batch" ${!rows.length || !selected.length || !catalog.length ? 'disabled' : ''}>${state.batchMode === 'print' ? `打印 ${selected.length} 张` : '生成标签'}</button>
      </div>
    </section>`;
}

function manageUserTemplateSheet(state) {
  const template = state.userTemplates.find((item) => item.id === state.manageTemplateId);
  if (!template) {
    return infoSheet('模板', '找不到该模板', '关闭');
  }
  const name = template.name || (template.document && template.document.name) || '我的模板';
  const folder = template.folder || '未分类';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-label="管理模板">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2>${icon('settings', 'icon-sm')}管理模板</h2><div class="topbar-subtitle">${escapeHtml(name)}</div></div>
        <button type="button" class="icon-button" data-action="close-modal" title="关闭" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="rename-template">名称</label>
          <input id="rename-template" data-action="rename-template-field" value="${escapeHtml(name)}">
        </div>
        <div class="field wide"><label for="rename-template-folder">文件夹</label>
          <input id="rename-template-folder" data-action="rename-template-folder-field" value="${escapeHtml(folder)}" placeholder="例如：门店常用" maxlength="24">
        </div>
      </div>
      <div class="template-preview-actions sticky-sheet-actions" style="grid-template-columns:1fr 1fr 1.2fr">
        <button type="button" class="button-danger" data-action="delete-user-template" data-id="${escapeHtml(template.id)}">删除</button>
        <button type="button" class="button-secondary" data-action="preview-template" data-id="${escapeHtml(template.id)}">预览</button>
        <button type="button" class="button" data-action="rename-user-template" data-id="${escapeHtml(template.id)}">保存修改</button>
      </div>
    </section>`;
}

function saveTemplateSheet(state) {
  const folders = Array.from(new Set((state.userTemplates || []).map((item) => item.folder || '未分类')));
  const name = state.saveTemplateName || (state.document && state.document.name) || '未命名模板';
  const folder = state.saveTemplateFolder || '未分类';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet save-template-sheet" role="dialog" aria-modal="true" aria-labelledby="save-template-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="save-template-title">${icon('template', 'icon-sm')}保存为模板</h2><div class="topbar-subtitle">命名并归档，之后可从「模板库 → 我的」重复使用</div></div>
        <button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="save-template-name">模板名称</label>
          <input id="save-template-name" data-action="save-template-name" value="${escapeHtml(name)}" maxlength="40" autocomplete="off" placeholder="请输入模板名称">
        </div>
        <div class="field wide"><label for="save-template-folder">存储到文件夹</label>
          <input id="save-template-folder" data-action="save-template-folder" value="${escapeHtml(folder)}" maxlength="24" list="save-template-folders" autocomplete="off" placeholder="例如：门店常用">
          <datalist id="save-template-folders">${folders.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist>
          <small>可直接输入新文件夹名称</small>
        </div>
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="confirm-save-template">保存模板</button>
      </div>
    </section>`;
}

function exitEditorSheet(state) {
  const name = state.document && state.document.name || '未命名标签';
  const discardLabel = state.editorBaselineProject ? '恢复打开前版本' : '删除本次草稿';
  return `<div class="sheet-backdrop" data-action="cancel-close-editor"></div>
    <section class="bottom-sheet workbench-sheet exit-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="exit-editor-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="exit-editor-title">保存这次修改？</h2><div class="topbar-subtitle">${escapeHtml(name)}</div></div>
        <button type="button" class="icon-button" data-action="cancel-close-editor" aria-label="继续编辑">${icon('close')}</button>
      </div>
      <p class="sheet-description">修改已作为本机草稿自动保存。你可以保留草稿退出、另存为模板，或撤销本次打开后的全部修改。</p>
      <div class="exit-editor-actions">
        <button type="button" class="button" data-action="save-and-close-editor">保留修改并退出</button>
        <button type="button" class="button-secondary" data-action="save-template-and-close">另存为模板</button>
        <button type="button" class="button-ghost danger-text" data-action="discard-and-close-editor">${discardLabel}</button>
        <button type="button" class="button-ghost" data-action="cancel-close-editor">取消，继续编辑</button>
      </div>
    </section>`;
}

function renameDocumentSheet(state) {
  const value = state.documentNameDraft || (state.document && state.document.name) || '';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet rename-document-sheet" role="dialog" aria-modal="true" aria-labelledby="rename-document-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="rename-document-title">${icon('edit', 'icon-sm')}标签名称</h2><div class="topbar-subtitle">名称会显示在最近编辑、项目和打印历史中</div></div>
        <button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="print-options"><div class="field wide"><label for="document-name-input">名称</label>
        <input id="document-name-input" data-action="document-name-draft" value="${escapeHtml(value)}" maxlength="40" autocomplete="off" placeholder="例如：门店商品价签">
      </div></div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="confirm-document-name">保存名称</button>
      </div>
    </section>`;
}

function backupRestoreSheet(state) {
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet backup-restore-sheet" role="dialog" aria-modal="true" aria-labelledby="backup-restore-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="backup-restore-title">${icon('database', 'icon-sm')}备份与恢复</h2><div class="topbar-subtitle">${state.projects.length} 个标签 · ${state.userTemplates.length} 个模板 · ${state.dataRows.length} 行数据</div></div>
        <button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="backup-cards">
        <section class="backup-card"><span class="backup-card-icon">${icon('download')}</span><div><strong>导出完整备份</strong><p>保存标签、我的模板、批量数据和常用设置。</p></div><button type="button" class="button" data-action="export-backup">导出 JSON</button></section>
        <section class="backup-card"><span class="backup-card-icon">${icon('upload')}</span><div><strong>从备份恢复</strong><p>先校验整份文件，成功后一次写入；失败不会保留半份数据。</p></div>
          <label class="field wide"><span>恢复方式</span><select data-action="backup-strategy">
            <option value="merge" ${state.backupStrategy === 'merge' ? 'selected' : ''}>合并（保留本机数据）</option>
            <option value="replace" ${state.backupStrategy === 'replace' ? 'selected' : ''}>替换（覆盖本机数据）</option>
          </select></label>
          <button type="button" class="button-secondary" data-action="import-backup">选择备份文件</button>
        </section>
      </div>
      ${state.backupStatus ? `<div class="backup-status" role="status">${escapeHtml(state.backupStatus)}</div>` : ''}
    </section>`;
}

function scannerSheet(state) {
  const status = state.scanStatus || 'idle';
  const error = state.scanError || '';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet scanner-sheet" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="scanner-title">${icon('scan', 'icon-sm')}扫描条码 / 二维码</h2><div class="topbar-subtitle">识别结果会直接回填到当前元素</div></div>
        <button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="scanner-stage${error ? ' has-error' : ''}">
        <video id="barcode-scanner-video" class="scanner-video" muted playsinline aria-label="相机取景"></video>
        <div class="scanner-frame" aria-hidden="true"></div>
        ${status === 'starting' ? '<div class="scanner-status">正在打开相机…</div>' : ''}
        ${error ? `<div class="scanner-fallback"><strong>相机暂不可用</strong><p>${escapeHtml(error)}</p><button type="button" class="button-secondary compact" data-action="restart-scan-camera">重试实时相机</button></div>` : ''}
      </div>
      <div class="scanner-actions">
        <button type="button" class="button-secondary" data-action="scan-take-photo">${icon('camera', 'icon-sm')}拍照识别</button>
        <button type="button" class="button-secondary" data-action="scan-pick-image">${icon('image', 'icon-sm')}相册识别</button>
      </div>
      <div class="scanner-manual">
        <label for="scanner-manual-value">也可以手动输入</label>
        <div class="scanner-manual-row">
          <input id="scanner-manual-value" data-action="scan-manual-value" value="${escapeHtml(state.scanManualValue || '')}" placeholder="输入条码或二维码内容" autocomplete="off">
          <button type="button" class="button" data-action="confirm-scan-manual" ${state.scanManualValue ? '' : 'disabled'}>使用</button>
        </div>
      </div>
    </section>`;
}

function advancedQrField(state, field, label, options) {
  const opts = options || {};
  const value = state.advancedQrDraft && state.advancedQrDraft[field] != null ? state.advancedQrDraft[field] : '';
  const error = state.advancedQrErrors && state.advancedQrErrors[field];
  const tag = opts.multiline ? 'textarea' : 'input';
  const attrs = opts.multiline
    ? `rows="3"`
    : `type="${opts.type || 'text'}" inputmode="${opts.inputmode || 'text'}"`;
  const control = tag === 'textarea'
    ? `<textarea data-action="advanced-qr-field" data-field="${field}" ${attrs} placeholder="${escapeHtml(opts.placeholder || '')}">${escapeHtml(value)}</textarea>`
    : `<input data-action="advanced-qr-field" data-field="${field}" value="${escapeHtml(value)}" ${attrs} placeholder="${escapeHtml(opts.placeholder || '')}">`;
  return `<div class="field wide${error ? ' invalid' : ''}"><label>${escapeHtml(label)}</label>${control}${error ? `<small role="alert">${escapeHtml(error)}</small>` : ''}</div>`;
}

function advancedQrFields(state) {
  const type = state.advancedQrType || 'wifi';
  if (type === 'text') return advancedQrField(state, 'text', '文本内容', { multiline: true, placeholder: '输入扫码后显示的文本' });
  if (type === 'url') return advancedQrField(state, 'url', '网址', { type: 'url', inputmode: 'url', placeholder: 'https://example.com' });
  if (type === 'wifi') return `${advancedQrField(state, 'ssid', 'Wi-Fi 名称', { placeholder: 'SSID' })}
    ${advancedQrField(state, 'password', '密码', { placeholder: '开放网络可留空' })}
    <div class="field wide"><label>加密方式</label><select data-action="advanced-qr-field" data-field="security">
      ${[['WPA', 'WPA / WPA2'], ['SAE', 'WPA3'], ['WEP', 'WEP'], ['nopass', '开放网络']].map(([value, label]) => `<option value="${value}" ${(state.advancedQrDraft.security || 'WPA') === value ? 'selected' : ''}>${label}</option>`).join('')}
    </select></div>
    <label class="toggle-row"><span>隐藏网络</span><input type="checkbox" data-action="advanced-qr-hidden" ${state.advancedQrDraft.hidden ? 'checked' : ''}></label>`;
  if (type === 'contact') return `${advancedQrField(state, 'fullName', '姓名', { placeholder: '张三' })}${advancedQrField(state, 'organization', '公司', { placeholder: '选填' })}${advancedQrField(state, 'title', '职位', { placeholder: '选填' })}${advancedQrField(state, 'phones', '电话', { inputmode: 'tel', placeholder: '多个号码用逗号分隔' })}${advancedQrField(state, 'emails', '邮箱', { inputmode: 'email', placeholder: '多个邮箱用逗号分隔' })}${advancedQrField(state, 'url', '网址', { inputmode: 'url', placeholder: '选填' })}`;
  if (type === 'phone') return advancedQrField(state, 'number', '电话号码', { inputmode: 'tel', placeholder: '+86 13800138000' });
  if (type === 'sms') return `${advancedQrField(state, 'number', '收件人号码', { inputmode: 'tel', placeholder: '13800138000' })}${advancedQrField(state, 'message', '短信内容', { multiline: true, placeholder: '选填' })}`;
  return `${advancedQrField(state, 'to', '收件人', { inputmode: 'email', placeholder: 'name@example.com' })}${advancedQrField(state, 'subject', '主题', { placeholder: '选填' })}${advancedQrField(state, 'body', '正文', { multiline: true, placeholder: '选填' })}`;
}

function advancedQrSheet(state) {
  const types = [['text', '文本'], ['url', '网址'], ['wifi', 'Wi-Fi'], ['contact', '名片'], ['phone', '电话'], ['sms', '短信'], ['email', '邮件']];
  const editing = Boolean(state.advancedQrEditId);
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet advanced-qr-sheet" role="dialog" aria-modal="true" aria-labelledby="advanced-qr-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="advanced-qr-title">${icon('qr', 'icon-sm')}${editing ? '编辑' : '高级'}二维码</h2><div class="topbar-subtitle">${editing ? '按结构化字段修改扫码内容' : '生成可直接扫码执行的标准内容'}</div></div>
        <button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
      </div>
      <div class="advanced-qr-types" role="tablist">${types.map(([value, label]) => `<button type="button" class="industry-chip${state.advancedQrType === value ? ' active' : ''}" data-action="advanced-qr-type" data-type="${value}" role="tab" aria-selected="${state.advancedQrType === value}">${label}</button>`).join('')}</div>
      <div class="advanced-qr-form">${advancedQrFields(state)}</div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button type="button" class="button-secondary" data-action="close-modal">取消</button>
        <button type="button" class="button" data-action="confirm-advanced-qr">${editing ? '更新二维码' : '插入二维码'}</button>
      </div>
    </section>`;
}

function renderModal(state) {
  if (state.modal === 'devices') return devicesSheet(state);
  if (state.modal === 'print') return printSheet(state);
  if (state.modal === 'template-preview') return templatePreviewSheet(state);
  if (state.modal === 'print-history') return printHistorySheet(state);
  if (state.modal === 'stock') return stockSheet(state);
  if (state.modal === 'batch') return batchSheet(state);
  if (state.modal === 'manage-template') return manageUserTemplateSheet(state);
  if (state.modal === 'save-template') return saveTemplateSheet(state);
  if (state.modal === 'exit-editor') return exitEditorSheet(state);
  if (state.modal === 'rename-document') return renameDocumentSheet(state);
  if (state.modal === 'backup-restore') return backupRestoreSheet(state);
  if (state.modal === 'scan-code') return scannerSheet(state);
  if (state.modal === 'advanced-qr') return advancedQrSheet(state);
  if (state.modal === 'default-print-settings') return defaultPrintSettingsSheet(state);
  if (state.modal === 'about') return infoSheet('关于应用', `商跃标签 v${__APP_VERSION__}<br>本地模板编辑与蓝牙打印<br><br>公开货架仅展示通过权属门禁的商跃原创或已获书面授权内容；待补授权内容不公开展示。行业场景预设由商跃程序化生成，不是第三方目录。<br><br>字体库含 20 款 OFL 开源中文字库，按需联网加载。<a href="THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">查看第三方许可</a>。`, '完成');
  if (state.modal === 'login') return infoSheet('本地模式', '当前版本无需登录，标签、模板和打印记录都保存在本机。可通过「备份与恢复」导出副本。', '知道了');
  if (state.modal === 'cloud') return infoSheet('数据存储', '当前版本仅在本机保存数据。建议定期使用「备份与恢复」导出项目，换机前先保留备份文件。', '知道了');
  if (state.modal === 'help') return infoSheet('使用帮助', '1. 从首页选择模板或新建空白标签。<br>2. 点选元素后修改内容与样式。<br>3. 连接蓝牙打印机，确认纸张和浓度后打印。<br><br>遇到问题时，可先重新连接打印机并重试。', '知道了');
  if (state.modal === 'unit-info') return infoSheet('尺寸单位', '标签纸与打印头规格统一使用毫米（mm），避免英寸换算造成裁切偏差。1 英寸 = 25.4 毫米。', '知道了');
  if (state.modal === 'material') return materialSheet(state);
  if (state.modal === 'border') return borderSheet(state);
  return '';
}

module.exports = {
  contextActions,
  escapeHtml,
  isPlaceholderElement,
  templateAttentionMessage,
  propertyPanel,
  renderMain,
  renderModal,
  renderRecentPrint,
  selectedElement,
  selectedElements,
  templateCard,
  templateLibraryPool
};

