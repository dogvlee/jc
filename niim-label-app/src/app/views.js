const { PROFILES } = require('../core/profiles');
const { formatDateChip, formatTimeChip } = require('../core/renderer');
const { categories, homeQuickActions, industries, templates } = require('./catalog');
const { icon, sprite } = require('./icons');
const { STOCK_PRESETS } = require('./stock-presets');
const { buildTemplateDocument } = require('./template-layouts');
const { MATERIAL_CATALOG, MATERIAL_CHIPS, materialCategories, materialsForChip } = require('../core/materials');
const { BORDER_CATALOG, BORDER_CHIPS, bordersForChip, borderById } = require('../core/borders');

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
  return `<img class="editor-native-icon${className ? ` ${className}` : ''}" src="${EDITOR_ASSET_BASE}/${path}" alt="" aria-hidden="true">`;
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
    return "<div class=" + Qs + "label-thumbnail thumb-v2 has-thumb" + Qs + " aria-hidden=" + Qs + "true" + Qs + st + " " + attrs + "><img class=" + Qs + "thumb-image" + Qs + " src=" + Qs + escapeHtml(meta.thumbSrc) + Qs + " alt=" + Qs + Qs + " style=" + Qs + "display:block;width:100%;height:100%;object-fit:contain;background:#fff" + Qs + "></div>";
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

function templateCard(template, options) {
  const action = (options && options.action) || 'preview-template';
  const thumbSource = template.userTemplate ? 'user' : 'catalog';
  return `<button class="template-card" data-action="${action}" data-id="${escapeHtml(template.id)}">
    ${templateBadge(template.badge)}
    ${labelThumb(template.kind, template.size, template.accent, { id: template.id, source: thumbSource, name: template.name, category: template.category, motif: template.motif, thumbSrc: template.thumbSrc || '' })}
    <div class="card-body">
      <p class="card-title">${escapeHtml(template.name)}</p>
      <div class="card-meta">${template.size[0]}×${template.size[1]} mm · ${escapeHtml(template.category)}</div>
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
  return `<div class="my-template-card-wrap">
    <button class="template-card" data-action="preview-template" data-id="${escapeHtml(card.id)}">
      ${labelThumb(card.kind, card.size, '', { id: card.id, source: 'user' })}
      <div class="card-body">
        <p class="card-title">${escapeHtml(card.name)}</p>
        <div class="card-meta">${card.size[0]}×${card.size[1]} mm · 我的</div>
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
    thumbSrc: template.thumbSrc || '',
    accent: template.accent
  };
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
  const myTemplates = state.projects.slice(0, 24);
  const featured = templates.filter((item) => item.badge || item.uses > 180).slice(0, 4);
  const stock = state.settings.installedStock || 'T50×30 230 空白标签';
  return `${sprite()}
    <header class="home-hero">
      <div class="home-hero-top">
        <div class="brand-lockup">
          <span class="brand-mark">N</span>
          <div><h1>精臣标签</h1><div class="topbar-subtitle">模板 · 编辑 · 蓝牙打印</div></div>
        </div>
        <div class="topbar-actions">
          <button class="icon-button ghost" data-action="help" title="帮助">${icon('help')}</button>
          <button class="device-chip" data-action="open-devices" title="打印机">
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
      <section class="promo-banner" data-action="preview-template" data-id="wifi-code" role="button" tabindex="0">
        <div>
          <strong>设计师太贵？</strong>
          <p>一个二维码搞定展示与连网 — 试试 Wi-Fi 码模板</p>
        </div>
        <span class="promo-cta">立即使用</span>
      </section>

      <section class="section">
        <div class="stock-card">
          <div class="stock-thumb">${labelThumb('accent', [50, 30], '#F2B84B')}</div>
          <div class="stock-body">
            <div class="stock-label">已安装标签</div>
            <p class="device-name">${escapeHtml(stock)}</p>
            <div class="device-meta"><span>点击编辑可改尺寸与名称</span></div>
          </div>
          <div class="stock-actions">
            <button class="button-secondary compact" data-action="open-stock-sheet">换纸</button>
            <button class="button compact" data-action="create-label">新建</button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <h2>我的模板</h2>
          <div class="heading-actions">
            <button class="section-link" data-action="print-history">${icon('history', 'icon-sm')}打印历史</button>
            <button class="section-link" data-action="all-projects">全部${icon('chevronRight', 'icon-sm')}</button>
          </div>
        </div>
        ${myTemplates.length
          ? `<div class="my-template-grid">${myTemplates.map(myTemplateCard).join('')}</div>`
          : `<div class="empty-state soft">还没有我的模板<br><button class="button" data-action="navigate" data-route="templates">去模板库挑选</button></div>`}
      </section>

      <section class="section">
        <div class="section-heading">
          <h2>推荐模板</h2>
          <button class="section-link" data-action="navigate" data-route="templates">更多${icon('chevronRight', 'icon-sm')}</button>
        </div>
        <div class="template-grid home-template-grid">${featured.map((item) => templateCard(item)).join('')}</div>
      </section>

      <section class="section">
        <div class="section-heading"><h2>快捷创建</h2></div>
        <div class="quick-grid secondary-quick">
          <button class="quick-action" data-action="create-label"><span class="quick-icon">${icon('plus')}</span><span>空白标签</span></button>
          <button class="quick-action" data-action="navigate" data-route="data"><span class="quick-icon">${icon('sheet')}</span><span>批量打印</span></button>
          <button class="quick-action" data-action="import-project"><span class="quick-icon">${icon('folder')}</span><span>导入项目</span></button>
          <button class="quick-action" data-action="open-devices"><span class="quick-icon">${icon('bluetooth')}</span><span>连接设备</span></button>
        </div>
      </section>
    </main>
    ${bottomNav('home')}`;
}

function templatesView(state) {
  const query = state.templateQuery.trim().toLowerCase();
  const available = [...templates, ...state.userTemplates.map(userTemplateCard)];
  const filtered = available.filter((item) => {
    const categoryMatch = state.templateCategory === '全部' || item.category === state.templateCategory;
    const industryMatch = !state.templateIndustry || state.templateIndustry === '全部' || item.industry === state.templateIndustry || item.userTemplate;
    const queryMatch = !query || `${item.name} ${item.category} ${item.blurb || ''} ${item.industry || ''}`.toLowerCase().includes(query);
    return categoryMatch && industryMatch && queryMatch;
  });
  const total = available.length;
  const activeFilters = [
    state.templateCategory !== '全部' ? state.templateCategory : '',
    (state.templateIndustry && state.templateIndustry !== '全部') ? state.templateIndustry : '',
    query ? `“${state.templateQuery.trim()}”` : ''
  ].filter(Boolean);
  return `${sprite()}
    <header class="topbar brand-topbar">
      <div class="topbar-title"><h1>行业模板</h1><div class="topbar-subtitle">${activeFilters.length
        ? `筛选出 ${filtered.length} / ${total} 个`
        : `${total} 个可用 · 点卡片预览版式`}</div></div>
      ${activeFilters.length ? `<button class="section-link" data-action="reset-template-filters">清除筛选</button>` : ''}
      <button class="icon-button" data-action="import-template" title="导入模板">${icon('upload')}</button>
    </header>
    <main class="page templates-page">
      <div class="search-row">${icon('search')}<input class="search-input" type="search" data-action="template-search" value="${escapeHtml(state.templateQuery)}" placeholder="搜索模板名称、行业、用途"></div>
      <div class="industry-chips" role="tablist" aria-label="行业分类">
        ${industries.map((industry) => `<button class="industry-chip${(state.templateIndustry || '全部') === industry ? ' active' : ''}" data-action="template-industry" data-industry="${escapeHtml(industry)}" role="tab">${escapeHtml(industry)}</button>`).join('')}
      </div>
      <div class="segmented" role="tablist">${[...categories, ...(state.userTemplates.length ? ['我的'] : [])].map((category) => `<button class="segment${state.templateCategory === category ? ' active' : ''}" data-action="template-category" data-category="${category}" role="tab">${category}</button>`).join('')}</div>
      ${filtered.length
        ? `<div class="template-grid rich">${filtered.map((item) => (
          item.userTemplate ? userTemplateManageCard(item) : templateCard(item)
        )).join('')}</div>`
        : `<div class="empty-state">${icon('search', 'icon-lg')}<div>${activeFilters.length
          ? `「${escapeHtml(activeFilters.join(' · '))}」下没有模板`
          : '没有匹配的模板'}</div><button class="button-secondary" data-action="reset-template-filters">清除全部筛选</button></div>`}
    </main>
    ${bottomNav('templates')}`;
}

function dataView(state) {
  const columns = ['name', 'code', 'price', 'date'];
  const labels = { name: '名称', code: '条码', price: '价格', date: '日期' };
  return `${sprite()}
    <header class="topbar">
      <div class="topbar-title"><h1>批量数据</h1><div class="topbar-subtitle">${state.dataRows.length} 条记录</div></div>
      <span class="meta-chip" data-role="data-save-status" aria-live="polite">已保存</span>
    </header>
    <main class="page">
      <div class="data-toolbar">
        <button class="button" data-action="add-data-row">${icon('plus', 'icon-sm')}添加行</button>
        <button class="button-secondary" data-action="import-csv">${icon('upload', 'icon-sm')}导入 CSV</button>
        <button class="button-secondary" data-action="export-csv">${icon('download', 'icon-sm')}导出 CSV</button>
        <button class="button" data-action="open-batch-sheet">${icon('template', 'icon-sm')}生成标签</button>
      </div>
      <p class="data-hint">将 CSV 行套用到行业模板：名称→标题文字，条码→一维码/二维码，价格/日期→对应字段</p>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th class="row-number">#</th>${columns.map((column) => `<th>${labels[column]}</th>`).join('')}<th>操作</th></tr></thead>
          <tbody>${state.dataRows.map((row, rowIndex) => `<tr>
            <td class="row-number">${rowIndex + 1}</td>
            ${columns.map((column) => `<td><input data-action="update-data-cell" data-row="${rowIndex}" data-field="${column}" value="${escapeHtml(row[column])}"></td>`).join('')}
            <td><button class="icon-button" data-action="remove-data-row" data-row="${rowIndex}" title="删除">${icon('trash', 'icon-sm')}</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
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
        <button class="button-secondary" data-action="account-login">${icon('logIn', 'icon-sm')}登录</button>
      </section>
      <section class="stats-band">
        <div class="stat"><strong>${state.projects.length}</strong><span>标签</span></div>
        <div class="stat"><strong>${state.userTemplates.length}</strong><span>模板</span></div>
        <div class="stat"><strong>${state.dataRows.length}</strong><span>数据行</span></div>
      </section>
      <section class="section">
        <div class="section-heading"><h2>设备与数据</h2></div>
        <div class="settings-list">
          ${settingsRow('printer', '打印机管理', state.device ? state.device.name : '未连接', 'open-devices')}
          ${settingsRow('cloud', '云端同步', state.settings.cloudSync ? '已开启' : '未开启', 'toggle-cloud')}
          ${settingsRow('database', '备份与恢复', `${state.projects.length} 个本地项目`, 'backup-data')}
          ${settingsRow('history', '打印记录', '本机记录', 'print-history')}
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><h2>偏好设置</h2></div>
        <div class="settings-list">
          ${settingsRow('settings', '默认打印参数', `${state.settings.density} 档浓度 · ${state.settings.copies} 份`, 'default-print-settings')}
          ${settingsRow('palette', '编辑器设置', state.settings.units, 'editor-settings')}
          ${settingsRow('bell', '消息通知', '系统设置', 'notification-settings')}
          ${settingsRow('help', '帮助与反馈', '', 'help')}
          ${settingsRow('info', '关于应用', `v${__APP_VERSION__}`, 'open-about')}
        </div>
      </section>
    </main>
    ${bottomNav('profile')}`;
}

function settingsRow(iconName, title, detail, action) {
  return `<button class="settings-row" data-action="${action}">
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
    <label><input type="checkbox" data-action="toggle-element" data-field="${field}" ${checked ? 'checked' : ''}><span class="attribute-check">${checked ? '✓' : ''}</span><span>${label}</span></label>
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
    return !t || t === '双击编辑';
  }
  if (element.type === 'barcode') {
    const v = String(element.value || '').trim();
    return !v || v === '0';
  }
  if (element.type === 'qrcode') {
    const v = String(element.value || '').trim();
    return !v || v === 'https://example.com';
  }
  return false;
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
    return `<div class="niim-float-multi niim-float-fixed" role="toolbar" aria-label="多选排版">
      <span class="niim-multi-count">已选 ${n}</span>
      <button type="button" data-action="open-align-menu" ${n < 1 ? 'disabled' : ''}>对齐</button>
      <button type="button" data-action="space-selection" data-delta="-0.6" ${n < 2 ? 'disabled' : ''}>更紧凑</button>
      <button type="button" data-action="space-selection" data-delta="0.6" ${n < 2 ? 'disabled' : ''}>更宽松</button>
      <button type="button" data-action="delete-selected">删除</button>
      <button type="button" data-action="toggle-multi-select">完成</button>
    </div>`;
  }
  const element = selected[0];
  const fs = (name) => editorAsset(`floating_shortcut/${name}`);
  const locked = !!element.locked;
  if (locked) {
    return `<div class="niim-float-bar niim-float-fixed niim-float-locked" role="toolbar" aria-label="元素操作">
      <button type="button" class="niim-float-btn" data-action="edit-element" title="编辑">${fs('floating_shortcut_edit.svg')}</button>
      <button type="button" class="niim-float-btn" data-action="delete-element" title="删除">${fs('floating_shortcut_remove.svg')}</button>
      <button type="button" class="niim-float-btn" data-action="duplicate-element" title="复制">${fs('floating_shortcut_copy.svg')}</button>
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
  if (!elements.length) return '<div class="layer-empty">还没有元素</div>';
  return `<div class="layer-list">${elements.map((element, index) => {
    const active = Array.isArray(state.selectedIds) && state.selectedIds.includes(element.id);
    const label = element.type === 'text' ? (element.text || '空文字') : element.type === 'barcode' ? (element.value || '条码') : element.advanced && element.type === 'qrcode' ? '高级二维码' : elementName(element.type);
    return `<button class="layer-item${active ? ' active' : ''}" data-action="select-element" data-id="${escapeHtml(element.id)}">
      <span class="layer-index">${elements.length - index}</span><span class="layer-icon">${icon(elementIconName(element.type), 'icon-sm')}</span><span class="layer-label">${escapeHtml(label)}</span>${element.locked ? icon('lock', 'icon-sm') : ''}
    </button>`;
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
  const chip = state.materialChip || '热门';
  const query = state.materialQuery || '';
  const searchOpen = !!state.materialSearchOpen || chip === '搜索';
  const items = materialsForChip(searchOpen ? '搜索' : chip, query);
  const chipsHtml = MATERIAL_CHIPS.map(function(name) {
    const active = (!searchOpen && chip === name) ? ' active' : '';
    const sel = (!searchOpen && chip === name) ? 'aria-selected="true"' : '';
    return '<button type="button" class="niim-mat-chip' + active + '" data-action="material-chip" data-chip="' + escapeHtml(name) + '" role="tab" ' + sel + '>' + escapeHtml(name) + '</button>';
  }).join('');
  const tiles = items.map(function(item) {
    const active = (activeSymbol || 'check') === item.id ? ' active' : '';
    return '<button type="button" class="niim-mat-tile' + active + '" data-action="pick-material" data-symbol="' + item.id + '" title="' + escapeHtml(item.label) + '">' + '<span class="niim-material-thumb" data-material-thumb="' + item.id + '"><canvas width="56" height="56"></canvas></span></button>';
  }).join('');
  const searchInput = searchOpen ? ('<input class="niim-mat-search" data-action="material-search" placeholder="搜索素材" value="' + escapeHtml(query) + '">') : '';
  return '<section class="niim-mat-browser' + (opts.embedded ? ' embedded' : '') + '">' +
    '<div class="niim-mat-chips" role="tablist">' +
      '<button type="button" class="niim-mat-chip search' + (searchOpen ? ' active' : '') + '" data-action="material-chip" data-chip="搜索" role="tab">🔍 搜索</button>' +
      chipsHtml +
    '</div>' +
    searchInput +
    '<div class="niim-mat-grid">' + (tiles || '<p class="niim-hint">暂无素材</p>') + '</div>' +
  '</section>';
}

function materialGridHtml(activeSymbol, compact) {
  return materialBrowserHtml({ materialChip: '热门', materialQuery: '', materialSearchOpen: false }, activeSymbol, { embedded: !!compact });
}

function materialSheet(state) {
  const selected = selectedElement(state);
  const active = selected && selected.type === 'material' ? selected.symbol : (state.pendingMaterialSymbol || 'check');
  return '<div class="sheet-backdrop" data-action="close-modal"></div>' +
    '<section class="bottom-sheet workbench-sheet niim-material-sheet" role="dialog" aria-modal="true" aria-labelledby="material-sheet-title">' +
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-header">' +
        '<div><h2 id="material-sheet-title">素材</h2><div class="topbar-subtitle">黑白矢量图标 · 点击插入标签</div></div>' +
        '<button class="icon-button" data-action="close-modal" title="关闭">' + icon('close') + '</button>' +
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
  const items = bordersForChip(searchOpen ? "搜索" : chip, query);
  const chipsHtml = BORDER_CHIPS.map(function(name) {
    const active = (!searchOpen && chip === name) ? " active" : "";
    return "<button type=\"button\" class=\"niim-mat-chip" + active + "\" data-action=\"border-chip\" data-chip=\"" + escapeHtml(name) + "\" role=\"tab\">" + escapeHtml(name) + "</button>";
  }).join("");
  const tiles = items.map(function(item) {
    const active = (activeId || "") === item.id ? " active" : "";
    return "<button type=\"button\" class=\"niim-mat-tile niim-border-tile" + active + "\" data-action=\"pick-border\" data-border=\"" + item.id + "\" title=\"" + escapeHtml(item.label) + "\">" +
      "<span class=\"niim-border-thumb\" data-border-thumb=\"" + item.id + "\"><canvas width=\"72\" height=\"48\"></canvas></span>" +
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
  "</section>";
}

function borderSheet(state) {
  const selected = selectedElement(state);
  const active = selected && selected.type === "rect" && selected.borderStyle ? selected.borderStyle : "";
  return "<div class=\"sheet-backdrop\" data-action=\"close-modal\"></div>" +
    "<section class=\"bottom-sheet workbench-sheet niim-material-sheet niim-border-sheet\" role=\"dialog\" aria-modal=\"true\">" +
      "<div class=\"sheet-handle\"></div>" +
      "<div class=\"sheet-header\">" +
        "<div><h2>边框</h2><div class=\"topbar-subtitle\">选择边框样式</div></div>" +
        "<button class=\"icon-button\" data-action=\"close-modal\">" + icon("close") + "</button>" +
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
      ['image', 'element_icon_photoPrint.svg', '随拍随打', 'add-photo', null, true],
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
      ${pages.map((_, index) => `<button type="button" class="element-page-dot${index === 0 ? ' active' : ''}" data-action="set-element-page" data-page="${index}" ${index === 0 ? 'aria-selected="true"' : ''}></button>`).join('')}
    </div>
  </div>`;
}

function editorTemplatePanel(state) {
  const all = [...templates, ...state.userTemplates.map(userTemplateCard)];
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
  const rows = state.dataRows.slice(0, 4);
  return `<div class="editor-data-panel"><div class="editor-data-list">${rows.map((row, index) => `<div class="editor-data-row"><span>${index + 1}</span><strong>${escapeHtml(row.name || row.code || `数据 ${index + 1}`)}</strong><small>${escapeHtml(row.code || row.date || '')}</small></div>`).join('')}</div><button class="native-wide-command" data-action="navigate" data-route="data">${icon('sheet', 'icon-sm')}<span>管理数据源</span>${icon('chevronRight', 'icon-sm')}</button></div>`;
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
  const label = element.label || (role === 'expire' ? '保质期至' : '制作日期');
  const dateChip = formatDateChip(element);
  const timeChip = formatTimeChip(element);
  const offsetDays = Number(element.offsetDays) || 0;
  const preset = Number(element.expirePresetHours) || 24;
  const expireMode = element.expireMode || 'preset';
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
        <option value="无前缀" ${label === '无前缀' ? 'selected' : ''}>无前缀</option>
        <option value="生产日期" ${label === '生产日期' ? 'selected' : ''}>生产日期</option>
        <option value="上架日期" ${label === '上架日期' ? 'selected' : ''}>上架日期</option>
        <option value="制作日期" ${label === '制作日期' ? 'selected' : ''}>制作日期</option>
        <option value="开封时间" ${label === '开封时间' ? 'selected' : ''}>开封时间</option>
        <option value="保质期至" ${label === '保质期至' ? 'selected' : ''}>保质期至</option>
        <option value="打印时间" ${label === '打印时间' ? 'selected' : ''}>打印时间</option>
        <option value="自定义" ${label === '自定义' ? 'selected' : ''}>自定义</option>
      </select>
      <span class="niim-time-colon">:</span>
      <label class="niim-time-chip date">
        <span>${escapeHtml(dateChip)}</span>
        <input type="datetime-local" class="niim-time-native" data-action="set-date-base" value="${escapeHtml(baseLocal)}" title="选择日期时间">
      </label>
      <label class="niim-time-chip time">
        <span>${escapeHtml(timeChip)}</span>
        <input type="datetime-local" class="niim-time-native" data-action="set-date-base" value="${escapeHtml(baseLocal)}" title="选择时间">
      </label>
    </div>
    <div class="niim-form-row niim-time-offset">
      <label>时间偏移</label>
      <div class="niim-pm wide">
        <button type="button" data-action="nudge-date-offset" data-delta="-1">−</button>
        <em>+ ${offsetDays}天</em>
        <button type="button" data-action="nudge-date-offset" data-delta="1">+</button>
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
            <button type="button" data-action="nudge-expire-hours" data-delta="-1">−</button>
            <em>${preset}小时</em>
            <button type="button" data-action="nudge-expire-hours" data-delta="1">+</button>
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
      <span>显示时分秒</span>
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
    return `<section class="niim-content-edit">
      <div class="niim-content-bar">
        <input id="${inputId}" class="niim-content-line" type="text" inputmode="text" enterkeyhint="done"
          data-action="update-element" data-field="${field}" value="${escapeHtml(value)}"
          placeholder="请输入内容" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        ${hasValue ? `<button type="button" class="niim-content-clear" data-action="clear-content" title="清除" tabindex="-1">×</button>` : ''}
        ${scannable ? `<button type="button" class="niim-content-scan" data-action="scan-code" title="扫码" tabindex="-1">${editorAsset('element/attribute/barcode_scan.svg')}</button>` : ''}
        <button type="button" class="niim-content-done" data-action="content-done" tabindex="-1">完成</button>
      </div>
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
          <button type="button" data-action="nudge-serial" data-field="step" data-delta="-1">−</button>
          <em>${escapeHtml(step)}</em>
          <button type="button" data-action="nudge-serial" data-field="step" data-delta="1">+</button>
        </div>
      </div>
      <div class="niim-form-row">
        <label>位数</label>
        <div class="niim-pm wide">
          <button type="button" data-action="nudge-serial" data-field="digits" data-delta="-1">−</button>
          <em>${escapeHtml(digits)}</em>
          <button type="button" data-action="nudge-serial" data-field="digits" data-delta="1">+</button>
        </div>
      </div>
      <p class="niim-serial-preview">预览示例:${escapeHtml(preview)}...</p>
      <button type="button" class="niim-link-btn" data-action="toast-feature" data-msg="序列号在批量打印时按递增值递增">了解如何设置序列号数量?</button>
    </section>`;
  }
  if (element.type === 'image') {
    return `<section class="niim-content-panel">
      <button type="button" class="niim-row-command" data-action="replace-image"><span>替换图片</span></button>
      <button type="button" class="niim-row-command" data-action="add-photo"><span>随拍随打</span></button>
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

function elementFontPanel(element) {
  if (!element || !['text', 'date', 'serial', 'table'].includes(element.type)) {
    return `<section class="niim-font-panel"><p class="niim-hint">当前元素无字体设置</p></section>`;
  }
  return `<section class="niim-font-panel">
    <label class="niim-field-label">字体</label>
    <select class="niim-select" data-action="update-element" data-field="fontFamily">
      <option value="sans-serif" ${!element.fontFamily || element.fontFamily === 'sans-serif' ? 'selected' : ''}>系统黑体</option>
      <option value="serif" ${element.fontFamily === 'serif' ? 'selected' : ''}>系统宋体</option>
      <option value="monospace" ${element.fontFamily === 'monospace' ? 'selected' : ''}>等宽</option>
    </select>
    <div class="niim-font-list">
      <button type="button" class="niim-font-chip${!element.fontFamily || element.fontFamily === 'sans-serif' ? ' active' : ''}" data-action="set-font" data-value="sans-serif">黑体</button>
      <button type="button" class="niim-font-chip${element.fontFamily === 'serif' ? ' active' : ''}" data-action="set-font" data-value="serif">宋体</button>
      <button type="button" class="niim-font-chip${element.fontFamily === 'monospace' ? ' active' : ''}" data-action="set-font" data-value="monospace">等宽</button>
    </div>
  </section>`;
}

function barcodeStylePanel(element) {
  const position = element.showText === false ? 'none' : (element.textPosition || 'bottom');
  const fontSize = round(element.fontSize || 2.5);
  const color = (element.color || '#000000').toUpperCase();
  return `<section class="niim-style-panel niim-barcode-style">
    <div class="niim-form-row linkish">
      <label>编码格式 <button type="button" class="niim-q" data-action="toast-feature" data-msg="Code128 支持数字与字母；EAN-13 需 12/13 位数字">?</button></label>
      <select class="niim-select compact" data-action="update-barcode-format">
        <option value="code128" ${element.format !== 'ean13' ? 'selected' : ''}>Code128</option>
        <option value="ean13" ${element.format === 'ean13' ? 'selected' : ''}>EAN-13</option>
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
        <button type="button" data-action="nudge-font" data-delta="-0.5">−</button>
        <em>${fontSize.toFixed(1)}</em>
        <button type="button" data-action="nudge-font" data-delta="0.5">+</button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>颜色 <button type="button" class="niim-q" data-action="toast-feature" data-msg="仅限双色/彩色标签纸使用该功能，实际打印的颜色和标签纸有关。">?</button></label>
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
      <label>颜色 <button type="button" class="niim-q" data-action="dual-color-tip">?</button></label>
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
    ['line', '／'],
    ['rounded', '▢'],
    ['rect', '□'],
    ['ellipse', '⬭'],
    ['circle', '○']
  ];
  return `<section class="niim-style-panel niim-shape-style">
    <div class="niim-shape-kinds">
      ${kinds.map(([k, glyph]) => `<button type="button" class="niim-shape-kind${kind === k ? ' active' : ''}" data-action="set-shape-kind" data-value="${k}">${glyph}</button>`).join('')}
    </div>
    <div class="niim-form-row">
      <label>样式</label>
      <div class="niim-dash-pair">
        <button type="button" class="niim-dash-btn${!element.dashed ? ' active' : ''}" data-action="set-dashed" data-value="0"><i class="solid"></i></button>
        <button type="button" class="niim-dash-btn${element.dashed ? ' active' : ''}" data-action="set-dashed" data-value="1"><i class="dash"></i></button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>线粗</label>
      <div class="niim-pm wide">
        <button type="button" data-action="nudge-line-width" data-delta="-0.1">−</button>
        <em>${lw.toFixed(1)}</em>
        <button type="button" data-action="nudge-line-width" data-delta="0.1">+</button>
      </div>
    </div>
    <div class="niim-form-row">
      <label>颜色 <button type="button" class="niim-q" data-action="dual-color-tip">?</button></label>
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
    `<button type="button" data-action="nudge-table" data-field="rows" data-delta="-1">−</button>` +
    `<em>${rows}</em>` +
    `<button type="button" data-action="nudge-table" data-field="rows" data-delta="1">+</button></div></div>` +
    `<div class="niim-form-row"><label>列数</label><div class="niim-pm wide">` +
    `<button type="button" data-action="nudge-table" data-field="columns" data-delta="-1">−</button>` +
    `<em>${cols}</em>` +
    `<button type="button" data-action="nudge-table" data-field="columns" data-delta="1">+</button></div></div>` +
    `<div class="niim-form-row"><label>行高</label>` +
    `<input class="niim-size-slider" type="range" min="2" max="20" step="0.1" value="${rowH}" data-action="set-table-dim" data-field="rowH">` +
    `<em>${rowH.toFixed(1)}</em></div>` +
    `<div class="niim-form-row"><label>列宽</label>` +
    `<input class="niim-size-slider" type="range" min="4" max="40" step="0.1" value="${colW}" data-action="set-table-dim" data-field="colW">` +
    `<em>${colW.toFixed(1)}</em></div>` +
    `<div class="niim-form-row"><label>线粗</label><div class="niim-pm wide">` +
    `<button type="button" data-action="nudge-line-width" data-delta="-0.1">−</button>` +
    `<em>${lw.toFixed(1)}</em>` +
    `<button type="button" data-action="nudge-line-width" data-delta="0.1">+</button></div></div>` +
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
    '<button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="-0.2">-</button>' +
    '<button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="0.2">+</button></div>' +
    '<div class="niim-size-readout">' + size.toFixed(1) + '</div>' +
    '<div class="niim-align-text-row">' +
    '<button type="button" class="niim-align-t' + (align === 'left' ? ' active' : '') + '" data-action="set-align" data-value="left">左</button>' +
    '<button type="button" class="niim-align-t' + (align === 'center' ? ' active' : '') + '" data-action="set-align" data-value="center">中</button>' +
    '<button type="button" class="niim-align-t' + (align === 'right' ? ' active' : '') + '" data-action="set-align" data-value="right">右</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'top' ? ' active' : '') + '" data-action="set-vertical-align" data-value="top">顶</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'middle' ? ' active' : '') + '" data-action="set-vertical-align" data-value="middle">中</button>' +
    '<button type="button" class="niim-align-t' + (vAlign === 'bottom' ? ' active' : '') + '" data-action="set-vertical-align" data-value="bottom">底</button></div>' +
    '<div class="niim-spacing-pair"><div class="niim-spacing-item"><span>字距</span><div class="niim-pm">' +
    '<button type="button" data-action="nudge-letter" data-delta="-0.1">-</button><em>' + round(element.letterSpacing || 0).toFixed(1) + '</em>' +
    '<button type="button" data-action="nudge-letter" data-delta="0.1">+</button></div></div>' +
    '<div class="niim-spacing-item"><span>行距</span><div class="niim-pm">' +
    '<button type="button" data-action="nudge-line" data-delta="-0.05">-</button><em>' + round((element.lineSpacing != null ? element.lineSpacing : 0)).toFixed(1) + '</em>' +
    '<button type="button" data-action="nudge-line" data-delta="0.05">+</button></div></div></div>' +
    '<button type="button" class="niim-mirror-row" data-action="toggle-element" data-field="wordWrap">' +
    '<span>按单词换行</span><span class="niim-switch' + (element.wordWrap ? ' on' : '') + '"><i></i></span></button>' +
    '<div class="table-cell-editor">' + cellsHtml + '</div></section>';
}

/** Style tab from domestic screenshot: B/U/S/I · colors · size slider · align · spacing */
function elementStylePanel(element) {
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
          <button type="button" data-action="nudge-line-width" data-delta="-0.1">−</button>
          <em>${lw.toFixed(1)}</em>
          <button type="button" data-action="nudge-line-width" data-delta="0.1">+</button>
        </div>
      </div>
      <button type="button" class="niim-row-command" data-action="open-material-sheet"><span>更换素材</span></button>
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
  const fontFamily = element.fontFamily || 'sans-serif';
  return `<section class="niim-style-panel">
    <div class="niim-style-toolbar">
      <button type="button" class="niim-tbtn${element.bold ? ' active' : ''}" data-action="toggle-element" data-field="bold" title="粗体"><b>B</b></button>
      <button type="button" class="niim-tbtn${element.underline ? ' active' : ''}" data-action="toggle-element" data-field="underline" title="下划线"><span class="u">U</span></button>
      <button type="button" class="niim-tbtn${element.strike ? ' active' : ''}" data-action="toggle-element" data-field="strike" title="删除线"><span class="s">S</span></button>
      <button type="button" class="niim-tbtn${element.italic ? ' active' : ''}" data-action="toggle-element" data-field="italic" title="斜体"><i>I</i></button>
      <button type="button" class="niim-tbtn niim-tdir${element.direction === 'vertical' ? ' active' : ''}" data-action="set-text-direction" data-value="${element.direction === 'vertical' ? 'horizontal' : 'vertical'}" title="文字方向">
        <span class="niim-tdir-label">文本<span class="niim-tdir-a">A</span></span>
      </button>
      <span class="niim-color-dots">
        ${colors.map(({ c, star, reverse, name }) => {
          const active = color === c.toUpperCase() && !!element.reverse === reverse;
          return `<button type="button" class="niim-color-dot${active ? ' active' : ''}${star ? ' star' : ''}" data-action="set-color" data-value="${c}" data-reverse="${reverse ? '1' : '0'}" style="--dot:${c}" title="${escapeHtml(name)}"><span class="niim-color-name">${escapeHtml(name)}</span></button>`;
        }).join('')}
      </span>
      <button type="button" class="niim-tbtn niim-clear-style" data-action="clear-text-style" title="清除文字样式">清</button>
    </div>
    <div class="niim-font-list compact">
      <button type="button" class="niim-font-chip${!element.fontFamily || fontFamily === 'sans-serif' ? ' active' : ''}" data-action="set-font" data-value="sans-serif">黑体</button>
      <button type="button" class="niim-font-chip${fontFamily === 'serif' ? ' active' : ''}" data-action="set-font" data-value="serif">宋体</button>
      <button type="button" class="niim-font-chip${fontFamily === 'monospace' ? ' active' : ''}" data-action="set-font" data-value="monospace">等宽</button>
    </div>
    <div class="niim-size-row">
      <span class="niim-aa">A<span>A</span></span>
      <input class="niim-size-slider" type="range" min="1" max="40" step="0.5" value="${size}" data-action="update-element" data-field="fontSize">
      <button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="-0.5">−</button>
      <button type="button" class="niim-size-btn" data-action="nudge-font" data-delta="0.5">+</button>
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
          <button type="button" data-action="nudge-letter" data-delta="-0.1">−</button>
          <em>${round(element.letterSpacing || 0).toFixed(1)}</em>
          <button type="button" data-action="nudge-letter" data-delta="0.1">+</button>
        </div>
      </div>
      <div class="niim-spacing-item">
        <span>行距</span>
        <div class="niim-pm">
          <button type="button" data-action="nudge-line" data-delta="-0.05">−</button>
          <em>${round((element.lineSpacing != null ? element.lineSpacing : 0)).toFixed(1)}</em>
          <button type="button" data-action="nudge-line" data-delta="0.05">+</button>
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
  const mirrorOn = !!(element && (element.mirrorX || element.mirrorY));
  const multi = selectedElements(state).length > 1;
  const alignHint = multi ? '相对元素对齐' : '相对标签纸对齐';
  return `<section class="niim-arrange-panel">
    <p class="niim-align-hint">${alignHint}</p>
    <div class="niim-arrange-row">
      <div class="niim-align-grid" role="group" aria-label="对齐">
        <button type="button" data-action="align-selection" data-value="left" title="左对齐">${editorAsset('element/attribute/align_left.svg')}</button>
        <button type="button" data-action="align-selection" data-value="centerH" title="水平居中">${editorAsset('element/attribute/align_center_h.svg')}</button>
        <button type="button" data-action="align-selection" data-value="right" title="右对齐">${editorAsset('element/attribute/align_right.svg')}</button>
        <button type="button" data-action="align-selection" data-value="top" title="顶部对齐">${editorAsset('element/attribute/align_top.svg')}</button>
        <button type="button" data-action="align-selection" data-value="centerV" title="垂直居中">${editorAsset('element/attribute/align_center_v.svg')}</button>
        <button type="button" data-action="align-selection" data-value="bottom" title="底部对齐">${editorAsset('element/attribute/align_bottom.svg')}</button>
      </div>
      <div class="niim-nudge-pad" role="group" aria-label="微调">
        <button type="button" class="nudge-up" data-action="nudge-element" data-x="0" data-y="-0.5">${editorAsset('element/attribute/align_move_top.svg')}</button>
        <button type="button" class="nudge-left" data-action="nudge-element" data-x="-0.5" data-y="0">${editorAsset('element/attribute/align_move_left.svg')}</button>
        <button type="button" class="nudge-right" data-action="nudge-element" data-x="0.5" data-y="0">${editorAsset('element/attribute/align_move_right.svg')}</button>
        <button type="button" class="nudge-down" data-action="nudge-element" data-x="0" data-y="0.5">${editorAsset('element/attribute/align_move_bottom.svg')}</button>
      </div>
    </div>
    <div class="niim-gap-row${multi ? '' : ' disabled'}">
      <span>垂直间距</span>
      <div class="niim-pm">
        <i class="niim-gap-ico">${editorAsset('element/attribute/align_uniform_v.svg')}</i>
        <button type="button" data-action="gap-selection" data-axis="v" data-delta="-0.5" ${multi ? '' : 'disabled'}>−</button>
        <button type="button" data-action="gap-selection" data-axis="v" data-delta="0.5" ${multi ? '' : 'disabled'}>+</button>
      </div>
    </div>
    <div class="niim-gap-row${multi ? '' : ' disabled'}">
      <span>水平间距</span>
      <div class="niim-pm">
        <i class="niim-gap-ico">${editorAsset('element/attribute/align_uniform_h.svg')}</i>
        <button type="button" data-action="gap-selection" data-axis="h" data-delta="-0.5" ${multi ? '' : 'disabled'}>−</button>
        <button type="button" data-action="gap-selection" data-axis="h" data-delta="0.5" ${multi ? '' : 'disabled'}>+</button>
      </div>
    </div>
    <button type="button" class="niim-mirror-row" data-action="mirror-element" data-axis="x">
      <span>镜像</span>
      <span class="niim-switch${mirrorOn ? ' on' : ''}"><i></i></span>
    </button>
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
  let tabs;
  // Screenshots: 内容 | 样式 | 字体 | 对齐/镜像 (selected); 添加元素 | 模板 | 数据源 (idle)
  if (state.editorPanelTab === 'layers') {
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
  else if (active === 'style') body = elementStylePanel(element);
  else body = arrangementPanel(state, element);

  // Text/barcode content: system keyboard bar, hide footer. Date「时间」keeps 保存/打印.
  const contentMode = active === 'content' && element && ['text', 'barcode', 'qrcode'].includes(element.type);
  const unlockCommand = element && element.locked && selection.length === 1
    ? `<button type="button" class="niim-unlock-command" data-action="toggle-lock">
      ${editorAsset('floating_shortcut/floating_shortcut_unlock.svg')}<span>解锁元素</span>
    </button>`
    : '';
  // Equal-width fixed tabs when editing an element (内容|样式|字体|对齐)
  const equalTabs = !!(element || selection.length > 1) && state.editorPanelTab !== 'layers';

  return `<div class="niim-panel-head">
      <div class="niim-panel-tabs${equalTabs ? ' equal' : ''}" role="tablist" data-tab-count="${tabs.length}">
        <i class="niim-tab-indicator" aria-hidden="true"></i>
        ${tabs.map(([value, label]) => `<button type="button" class="niim-panel-tab${active === value ? ' active' : ''}" data-action="set-editor-panel-tab" data-tab="${value}" role="tab" ${active === value ? 'aria-selected="true"' : ''}><span>${escapeHtml(label)}</span></button>`).join('')}
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
          <button type="button" class="niim-top-btn niim-top-im" data-action="help" title="客服">${editorAsset('app_bar/app_bar_im.png')}</button>
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
        ${state.draftSavedAt ? '<span class="niim-save-chip">已保存</span>' : ''}
      </div>
      ${state.editorMenu === 'settings' ? `<div class="editor-more-menu niim-menu" role="menu">
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
                <canvas id="label-canvas"></canvas>
                <canvas id="selection-canvas" class="selection-canvas"></canvas>
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
    <div class="sheet-header"><div><h2 id="devices-title">打印机</h2><div class="topbar-subtitle">蓝牙设备</div></div><div class="row-actions">${state.scanning ? '<span class="loading-spinner" aria-label="扫描中"></span>' : `<button class="icon-button" data-action="scan-devices" title="重新扫描">${icon('refresh')}</button>`}<button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button></div></div>
    ${state.device ? `<div class="device-banner"><div class="device-visual">${icon('printer')}</div><div><p class="device-name">${escapeHtml(state.device.name)}</p><div class="device-meta"><span><i class="status-dot online"></i>已连接</span><span>MTU ${state.device.mtu || '-'}</span></div></div><button class="button-danger" data-action="disconnect-device">断开</button></div><div style="height:12px"></div>` : ''}
    <div class="device-list">${state.devices.length ? state.devices.map((device) => `<button class="device-item" data-action="connect-device" data-id="${escapeHtml(device.deviceId)}" ${state.connecting ? 'disabled' : ''}><span class="device-visual">${icon('bluetooth')}</span><span><span class="device-name">${escapeHtml(device.displayName || device.name || 'BLE 打印机')}</span><span class="device-meta">${escapeHtml(device.deviceId)} · RSSI ${device.RSSI == null ? '-' : device.RSSI}</span></span><span class="signal-bars" aria-label="信号"><i></i><i></i><i></i><i></i></span></button>`).join('') : `<div class="empty-state">${state.scanning ? '正在搜索附近设备' : '未发现打印机'}</div>`}</div>
  </section>`;
}

function printSheet(state) {
  const settings = state.settings;
  const profile = PROFILES.find((item) => item.id === settings.defaultProfileId) || PROFILES[0];
  const densityMax = profile.densityMax || 5;
  const densityMin = profile.densityMin || 1;
  const density = Math.max(densityMin, Math.min(densityMax, Number(settings.density) || profile.densityDefault || 3));
  const doc = state.document;
  const block = state.printBlock;
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
        <h2 id="print-title">打印标签</h2>
        <div class="topbar-subtitle">${doc ? `${escapeHtml(doc.name)} · ${doc.widthMm}×${doc.heightMm} mm` : '打印预览'}</div>
      </div>
      <button class="icon-button" data-action="close-modal" title="关闭" ${state.printing ? 'disabled' : ''}>${icon('close')}</button>
    </div>
    ${block ? `<div class="print-notice blocked" role="alert">
      <strong>${block.kind === 'placeholder'
        ? '还有默认内容未改'
        : block.kind !== 'size'
          ? '内容装不下，暂时无法打印'
          : state.device
            ? `已连接的 ${escapeHtml(state.device.name)} 打不了这张标签`
            : '这张标签超出当前机型的可打印范围'}</strong>
      <p>${escapeHtml(block.message)}${block.kind === 'size' && doc ? ` · 当前标签 ${doc.widthMm}×${doc.heightMm} mm` : ''}</p>
      <div class="print-notice-actions">
        ${block.kind === 'placeholder' && block.elementId
          ? `<button class="button compact" data-action="focus-placeholder" data-id="${escapeHtml(block.elementId)}">去修改</button>
             <button class="button-secondary compact" data-action="close-modal">返回编辑</button>`
          : `${suggested ? `<button class="button compact" data-action="apply-suggested-profile" data-id="${escapeHtml(suggested.id)}">换成 ${escapeHtml(suggested.name)}</button>` : ''}
             <button class="button-secondary compact" data-action="open-stock-sheet">更换标签纸</button>`}
      </div>
    </div>` : ''}
    ${state.printError ? `<div class="print-notice failed" role="alert">
      <strong>打印失败</strong>
      <p>${escapeHtml(state.printError.message)}</p>
      <div class="print-notice-actions">
        <button class="button compact" data-action="retry-print">重试打印</button>
        <button class="button-secondary compact" data-action="open-devices">重新连接</button>
      </div>
    </div>` : ''}
    <button class="print-device-row" data-action="open-devices">
      <span class="device-visual">${icon(state.device ? 'printer' : 'bluetooth')}</span>
      <span class="print-device-meta">
        <strong>${state.device ? escapeHtml(state.device.name) : '未连接打印机'}</strong>
        <small>${state.device ? `已连接 · MTU ${state.device.mtu || '-'}` : '点击连接蓝牙打印机'}</small>
      </span>
      <span class="section-link">${state.device ? '切换' : '连接'}${icon('chevronRight', 'icon-sm')}</span>
    </button>
    <div class="print-preview"><canvas id="print-preview-canvas" aria-label="打印预览"></canvas></div>
    <div class="print-options">
      <div class="field"><label for="print-profile">打印机型号 / 协议</label><select id="print-profile" data-action="update-setting" data-field="defaultProfileId">${PROFILES.map((item) => `<option value="${item.id}" ${item.id === settings.defaultProfileId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="print-label-type">纸张类型</label><select id="print-label-type" data-action="update-setting" data-field="labelType">
        <option value="1" ${Number(settings.labelType) === 1 ? 'selected' : ''}>间隙纸</option>
        <option value="2" ${Number(settings.labelType) === 2 ? 'selected' : ''}>黑标纸</option>
        <option value="3" ${Number(settings.labelType) === 3 ? 'selected' : ''}>连续纸</option>
        <option value="4" ${Number(settings.labelType) === 4 ? 'selected' : ''}>定孔纸</option>
      </select></div>
      <div class="field"><label for="print-copies">份数</label><div class="stepper"><button data-action="change-copies" data-delta="-1" ${state.printing ? 'disabled' : ''}>-</button><input id="print-copies" value="${settings.copies}" readonly><button data-action="change-copies" data-delta="1" ${state.printing ? 'disabled' : ''}>+</button></div></div>
      <div class="field"><label for="print-density">浓度 <strong>${density}</strong> / ${densityMax}</label><input id="print-density" type="range" min="${densityMin}" max="${densityMax}" value="${density}" data-action="update-setting" data-field="density" ${state.printing ? 'disabled' : ''}></div>
      <div class="field"><label for="print-threshold">黑白阈值 <strong>${settings.threshold}</strong></label><input id="print-threshold" type="range" min="1" max="254" value="${settings.threshold}" data-action="update-setting" data-field="threshold" ${state.printing ? 'disabled' : ''}></div>
    </div>
    ${state.printing ? `<div class="progress-track"><div class="progress-fill" style="width:${state.printProgress}%"></div></div><div class="device-meta">${escapeHtml(state.printMessage)}</div>` : ''}
    <div class="print-sheet-actions sticky-sheet-actions">
      ${state.printing
        ? `<button class="button-danger" data-action="cancel-print">停止打印</button>
           <button class="button print-submit" disabled>正在打印…</button>`
        : `<button class="button-secondary" data-action="close-modal">返回编辑</button>
           <button class="button print-submit" data-action="start-print" ${block ? 'disabled' : ''}>${block ? '请先解决上方问题' : state.device ? '开始打印' : '连接并打印'}</button>`}
    </div>
  </section>`;
}

function infoSheet(title, body, actionLabel) {
  return `<div class="sheet-backdrop" data-action="close-modal"></div><section class="bottom-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><div class="sheet-header"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button></div><div style="color:var(--muted);line-height:1.7">${body}</div>${actionLabel ? `<button class="button print-submit" data-action="close-modal">${escapeHtml(actionLabel)}</button>` : ''}</section>`;
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
  const template = templates.find((item) => item.id === state.templatePreviewId)
    || state.userTemplates.map(userTemplateCard).find((item) => item.id === state.templatePreviewId);
  if (!template) {
    return `<div class="sheet-backdrop" data-action="close-modal"></div>
      <section class="bottom-sheet template-sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="sheet-header"><h2>模板不可用</h2><button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button></div>
        <div class="empty-state soft">找不到该模板，可能已被删除</div>
        <button class="button print-submit" data-action="close-modal">关闭</button>
      </section>`;
  }
  const documentValue = template.document || buildTemplateDocument(template);
  const ratio = documentValue.widthMm / Math.max(0.1, documentValue.heightMm);
  const industry = template.industry || (template.userTemplate ? '我的模板' : '行业模板');
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet template-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div>
          <h2 id="template-preview-title">${escapeHtml(template.name)}</h2>
          <div class="topbar-subtitle">${template.size[0]}×${template.size[1]} mm · ${escapeHtml(template.category || '我的')} · ${escapeHtml(industry)}</div>
        </div>
        <button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button>
      </div>
      <div class="template-preview-stage">
        <div class="template-preview-frame" style="--label-ratio:${ratio}">
          <div class="template-preview-loading" data-role="template-preview-status">正在渲染预览…</div>
          <canvas id="template-preview-canvas" aria-label="模板预览" hidden></canvas>
        </div>
      </div>
      <div class="template-preview-meta">
        ${template.badge ? `<span class="template-badge static">${escapeHtml(template.badge)}</span>` : ''}
        <p>${escapeHtml(template.blurb || '本地行业模板，打开后可自由改字、改尺寸并打印。')}</p>
        <div class="device-meta">
          <span>${escapeHtml(elementSummary(documentValue))}</span>
          <span>${(documentValue.elements || []).length} 个元素</span>
          <span>纸张 ${documentValue.widthMm}×${documentValue.heightMm} mm</span>
        </div>
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button class="button-secondary" data-action="close-modal">取消</button>
        <button class="button" data-action="use-template" data-id="${escapeHtml(template.id)}">使用此模板</button>
      </div>
    </section>`;
}

function printHistorySheet(state) {
  const history = state.printHistory || [];
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="print-history-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="print-history-title">打印历史</h2><div class="topbar-subtitle">本机最近 ${history.length} 条 · 可重新打开或再打</div></div>
        <button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button>
      </div>
      <div class="history-list">
        ${history.length ? history.slice(0, 30).map((item) => {
          const canReopen = !!(item.document || item.projectId);
          return `<div class="history-item">
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
            <button class="button-secondary compact" data-action="history-open" data-id="${escapeHtml(item.id)}" ${canReopen ? '' : 'disabled'}>打开</button>
            <button class="button compact" data-action="history-reprint" data-id="${escapeHtml(item.id)}" ${canReopen ? '' : 'disabled'}>再打印</button>
          </div>
        </div>`;
        }).join('') : '<div class="empty-state soft">还没有打印记录<br>完成一次打印后会出现在这里</div>'}
      </div>
    </section>`;
}

function renderMain(state) {
  if (state.route === 'templates') return templatesView(state);
  if (state.route === 'data') return dataView(state);
  if (state.route === 'profile') return profileView(state);
  if (state.route === 'editor' && state.document) return editorView(state);
  return homeView(state);
}

function stockSheet(state) {
  const width = Number(state.stockWidthMm) || state.settings.defaultWidthMm || 50;
  const height = Number(state.stockHeightMm) || state.settings.defaultHeightMm || 30;
  const inEditor = state.route === 'editor' && state.document;
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true" aria-labelledby="stock-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="stock-title">标签纸</h2><div class="topbar-subtitle">选择常用尺寸或自定义毫米宽高</div></div>
        <button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button>
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
        ${inEditor ? `<div class="field wide"><label class="toggle-row"><span>同时应用到当前标签</span><input type="checkbox" data-action="stock-apply-current" ${state.stockApplyCurrent !== false ? 'checked' : ''}></label></div>` : ''}
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button class="button-secondary" data-action="close-modal">取消</button>
        <button class="button" data-action="apply-stock">确认标签纸</button>
      </div>
    </section>`;
}

function batchSheet(state) {
  const rows = state.dataRows || [];
  const selected = Array.isArray(state.batchSelectedRows)
    ? state.batchSelectedRows
    : rows.map((_, index) => index);
  const templateId = state.settings.batchTemplateId || 'product-simple';
  const catalog = [...templates, ...state.userTemplates.map(userTemplateCard)];
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet batch-sheet" role="dialog" aria-modal="true" aria-labelledby="batch-title">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2 id="batch-title">批量生成标签</h2><div class="topbar-subtitle">${rows.length} 条数据 · 已选 ${selected.length} 行</div></div>
        <button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="batch-template">套用模板</label>
          <select id="batch-template" data-action="batch-template">
            ${catalog.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === templateId ? 'selected' : ''}>${escapeHtml(item.name)} (${item.size ? `${item.size[0]}×${item.size[1]}` : '自定义'})</option>`).join('')}
          </select>
        </div>
        <div class="field wide"><label for="batch-mode">生成方式</label>
          <select id="batch-mode" data-action="batch-mode">
            <option value="open-first" ${state.batchMode === 'open-first' ? 'selected' : ''}>打开第一行到编辑器</option>
            <option value="projects" ${state.batchMode === 'projects' ? 'selected' : ''}>全部生成到「我的模板」/最近项目</option>
          </select>
        </div>
      </div>
      <div class="batch-row-list">
        <div class="batch-row-toolbar">
          <button class="button-secondary compact" data-action="batch-select-all">全选</button>
          <button class="button-secondary compact" data-action="batch-select-none">清空</button>
        </div>
        ${rows.length ? rows.map((row, index) => `<label class="batch-row-item">
          <input type="checkbox" data-action="batch-toggle-row" data-row="${index}" ${selected.includes(index) ? 'checked' : ''}>
          <span class="batch-row-index">${index + 1}</span>
          <span class="batch-row-main"><strong>${escapeHtml(row.name || '未命名')}</strong><small>${escapeHtml(row.code || '')} · ${escapeHtml(row.price || '')} · ${escapeHtml(row.date || '')}</small></span>
        </label>`).join('') : '<div class="empty-state soft">还没有批量数据，请先添加行或导入 CSV</div>'}
      </div>
      <div class="template-preview-actions sticky-sheet-actions">
        <button class="button-secondary" data-action="close-modal">取消</button>
        <button class="button" data-action="run-batch" ${!rows.length || !selected.length ? 'disabled' : ''}>生成标签</button>
      </div>
    </section>`;
}

function manageUserTemplateSheet(state) {
  const template = state.userTemplates.find((item) => item.id === state.manageTemplateId);
  if (!template) {
    return infoSheet('模板', '找不到该模板', '关闭');
  }
  const name = template.name || (template.document && template.document.name) || '我的模板';
  return `<div class="sheet-backdrop" data-action="close-modal"></div>
    <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div><h2>管理模板</h2><div class="topbar-subtitle">${escapeHtml(name)}</div></div>
        <button class="icon-button" data-action="close-modal" title="关闭">${icon('close')}</button>
      </div>
      <div class="print-options">
        <div class="field wide"><label for="rename-template">名称</label>
          <input id="rename-template" data-action="rename-template-field" value="${escapeHtml(name)}">
        </div>
      </div>
      <div class="template-preview-actions sticky-sheet-actions" style="grid-template-columns:1fr 1fr 1.2fr">
        <button class="button-danger" data-action="delete-user-template" data-id="${escapeHtml(template.id)}">删除</button>
        <button class="button-secondary" data-action="preview-template" data-id="${escapeHtml(template.id)}">预览</button>
        <button class="button" data-action="rename-user-template" data-id="${escapeHtml(template.id)}">保存名称</button>
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
  if (state.modal === 'about') return infoSheet('关于应用', `精臣标签 v${__APP_VERSION__}<br>本地模板编辑与蓝牙打印<br><br>行业模板与协议核心均在当前设备运行。`, '完成');
  if (state.modal === 'login') return infoSheet('账号登录', '服务地址：<code>API_BASE_URL</code><br>客户端鉴权适配器：<code>AUTH_PROVIDER</code>', '完成');
  if (state.modal === 'cloud') return infoSheet('云端同步', '服务地址：<code>API_BASE_URL</code><br>对象存储：<code>STORAGE_PROVIDER</code>', '完成');
  if (state.modal === 'help') return infoSheet('帮助与反馈', '从首页「行业模板」选版式 → 编辑内容 → 连接打印机 → 打印。<br><br>反馈接口：<code>FEEDBACK_ENDPOINT</code>', '完成');
  if (state.modal === 'material') return materialSheet(state);
  if (state.modal === 'border') return borderSheet(state);
  if (state.modal === 'advanced-qr') {
    return `<div class="sheet-backdrop" data-action="close-modal"></div>
      <section class="bottom-sheet workbench-sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="icon-button" data-action="close-modal">关闭</button>
          <h2 style="flex:1;text-align:center;margin:0;font-size:16px">插入高级二维码</h2>
          <span style="width:40px"></span>
        </div>
        <div class="niim-empty-feature">
          <div class="niim-empty-ico">${editorAsset('element/icon/features_icon_advance_qrcode.svg')}</div>
          <strong>暂无高级二维码</strong>
          <p>请先到【应用】-【高级二维码场景】中新建后进行使用</p>
        </div>
      </section>`;
  }
  return '';
}

module.exports = {
  contextActions,
  escapeHtml,
  isPlaceholderElement,
  propertyPanel,
  renderMain,
  renderModal,
  selectedElement,
  selectedElements,
  templateCard
};

