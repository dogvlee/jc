/**
 * Shangyue clean-room business template pack.
 *
 * This module intentionally depends only on the local document primitives. All
 * wording, identifiers and geometry below were authored for Shangyue. The pack
 * contains no imported images, remote assets or third-party template geometry.
 */
const { createDocument, createElement } = require('../core/document');

const PACK_VERSION = '2026.08-cleanroom-100';
const STANDARD_PROFILES = Object.freeze(['b1', 'b21', 'b21-c2b', 'b21s']);
const COMPACT_PROFILES = Object.freeze(['d110', 'd11-legacy', 'b1', 'b21', 'b21-c2b', 'b21s']);

const SERIES = Object.freeze([
  { id: 'retail-food', label: '零售餐饮', accent: '#B64932' },
  { id: 'warehouse-production', label: '仓储生产', accent: '#315E8A' },
  { id: 'asset-equipment', label: '资产设备', accent: '#386A61' },
  { id: 'office-archive', label: '办公档案', accent: '#66543E' },
  { id: 'fashion-jewelry', label: '服装珠宝', accent: '#76516E' },
  { id: 'campus-home', label: '校园家庭', accent: '#5D6A3D' }
]);

const VARIANTS = Object.freeze([
  { id: 'focus', label: '醒目版', layoutFamily: 'headline-focus', blurb: '标题带聚焦核心信息' },
  { id: 'split', label: '分区版', layoutFamily: 'side-rail-split', blurb: '侧栏分区便于快速扫读' },
  { id: 'verify', label: '核验版', layoutFamily: 'step-card-verify', blurb: '信息卡片支持现场复核' },
  {
    id: 'panorama', label: '横展版', layoutFamily: 'native-wide-panorama',
    blurb: '50×30 原生宽幅信息带', nativeWide: true
  },
  {
    id: 'ledger', label: '台账版', layoutFamily: 'native-wide-ledger',
    blurb: '40 mm 高原生宽幅核验台账', nativeWide: true
  }
]);

function task(spec) {
  const series = SERIES.find((item) => item.id === spec.seriesId);
  if (!series) throw new Error(`Unknown clean-room series: ${spec.seriesId}`);
  return Object.freeze(Object.assign({}, spec, {
    seriesGroup: series.label,
    accent: series.accent,
    size: Object.freeze(spec.size.slice()),
    sceneIds: Object.freeze(spec.sceneIds.slice()),
    fields: Object.freeze(spec.fields.slice())
  }));
}

/**
 * Twenty frequent label jobs. Functional field names are deliberately short so
 * the resulting labels remain readable on real 40 mm stock.
 */
const CLEANROOM_TASKS = Object.freeze([
  task({
    id: 'shelf-price', taskLabel: '货架价签', seriesId: 'retail-food', sceneIds: ['retail'],
    category: '零售', industry: '行业标识', size: [40, 30], kind: 'barcode',
    fields: ['商品名称', '规格 / 单位', '售价 / 会员价'], codeLabel: '商品编码',
    blurb: '商品、规格、双价与扫码核对'
  }),
  task({
    id: 'store-promo', taskLabel: '门店促销', seriesId: 'retail-food', sceneIds: ['retail'],
    category: '零售', industry: '内容设计', size: [30, 15], kind: 'qrcode',
    fields: ['活动商品', '优惠规则', '截止提示'], codeLabel: '活动核验码',
    blurb: '活动主题、规则与到期提示'
  }),
  task({
    id: 'bakery-freshness', taskLabel: '烘焙效期', seriesId: 'retail-food', sceneIds: ['retail', 'expiry'],
    category: '零售', industry: '实用功能', size: [40, 30], kind: 'barcode',
    fields: ['产品名称', '出炉时刻', '建议食用前'], codeLabel: '批次编码', dateLabel: '制作日期',
    blurb: '出炉、食用期限与生产批次'
  }),
  task({
    id: 'takeaway-pickup', taskLabel: '外卖取餐', seriesId: 'retail-food', sceneIds: ['retail'],
    category: '零售', industry: '行业标识', size: [40, 30], kind: 'qrcode',
    fields: ['餐品摘要', '取餐编号', '交付备注'], codeLabel: '出餐复核码',
    blurb: '取餐号、餐品摘要与交付复核'
  }),

  task({
    id: 'bin-location', taskLabel: '库位标识', seriesId: 'warehouse-production', sceneIds: ['warehouse'],
    category: '仓储', industry: '行业标识', size: [40, 30], kind: 'barcode',
    fields: ['库区 / 库位', '存放品类', '补货上限'], codeLabel: '库位编码',
    blurb: '库位、品类与补货容量'
  }),
  task({
    id: 'receiving-lot', taskLabel: '收货批次', seriesId: 'warehouse-production', sceneIds: ['warehouse'],
    category: '仓储', industry: '实用功能', size: [40, 30], kind: 'barcode',
    fields: ['物料名称', '到货批次', '收货状态'], codeLabel: '收货流转码', dateLabel: '收货日期',
    blurb: '物料、到货批次与验收状态'
  }),
  task({
    id: 'picking-tote', taskLabel: '拣货周转', seriesId: 'warehouse-production', sceneIds: ['warehouse'],
    category: '仓储', industry: '行业标识', size: [40, 30], kind: 'qrcode',
    fields: ['波次编号', '路线分区', '复核件数'], codeLabel: '周转箱码',
    blurb: '拣货波次、路线与件数复核'
  }),
  task({
    id: 'production-wip', taskLabel: '在制工序', seriesId: 'warehouse-production', sceneIds: ['warehouse', 'equipment'],
    category: '仓储', industry: '行业标识', size: [40, 30], kind: 'qrcode',
    fields: ['工序名称', '工单批次', '当前状态'], codeLabel: '转序扫码', dateLabel: '转序日期',
    blurb: '工序、工单与转序状态'
  }),

  task({
    id: 'fixed-asset', taskLabel: '固定资产', seriesId: 'asset-equipment', sceneIds: ['equipment'],
    category: '行业', industry: '行业标识', size: [40, 30], kind: 'qrcode',
    fields: ['资产名称', '使用部门', '盘点周期'], codeLabel: '资产盘点码',
    blurb: '资产归属、使用部门与盘点'
  }),
  task({
    id: 'cable-endpoint', taskLabel: '线缆端点', seriesId: 'asset-equipment', sceneIds: ['equipment'],
    category: '行业', industry: '行业标识', size: [30, 12], kind: 'qrcode',
    fields: ['A 端位置', 'B 端位置', '链路用途'], codeLabel: '链路码',
    blurb: '线缆两端位置与链路用途'
  }),
  task({
    id: 'equipment-inspection', taskLabel: '设备点检', seriesId: 'asset-equipment', sceneIds: ['equipment'],
    category: '行业', industry: '实用功能', size: [40, 30], kind: 'qrcode',
    fields: ['设备位号', '点检项目', '下次日期'], codeLabel: '点检记录码', dateLabel: '本次日期',
    blurb: '设备位号、点检项与周期'
  }),
  task({
    id: 'repair-status', taskLabel: '维修状态', seriesId: 'asset-equipment', sceneIds: ['equipment'],
    category: '行业', industry: '实用功能', size: [40, 30], kind: 'barcode',
    fields: ['设备名称', '故障摘要', '处理状态'], codeLabel: '维修工单码',
    blurb: '故障摘要、处理状态与工单'
  }),

  task({
    id: 'archive-folder', taskLabel: '档案卷夹', seriesId: 'office-archive', sceneIds: ['office-life'],
    category: '办公', industry: '行业标识', size: [40, 30], kind: 'barcode',
    fields: ['档案题名', '年度 / 门类', '保管期限'], codeLabel: '档号',
    blurb: '题名、年度门类与保管期限'
  }),
  task({
    id: 'archive-box', taskLabel: '档案盒索引', seriesId: 'office-archive', sceneIds: ['office-life'],
    category: '办公', industry: '实用功能', size: [40, 30], kind: 'qrcode',
    fields: ['盒号', '起止档号', '归档位置'], codeLabel: '盒内清单码',
    blurb: '盒号、档号范围与归档位置'
  }),
  task({
    id: 'document-routing', taskLabel: '文件流转', seriesId: 'office-archive', sceneIds: ['office-life'],
    category: '办公', industry: '实用功能', size: [40, 30], kind: 'qrcode',
    fields: ['文件主题', '接收岗位', '流转状态'], codeLabel: '流转登记码',
    blurb: '文件主题、接收岗位与流转状态'
  }),

  task({
    id: 'apparel-sku', taskLabel: '服装款号', seriesId: 'fashion-jewelry', sceneIds: ['fashion'],
    category: '零售', industry: '行业标识', size: [40, 30], kind: 'barcode',
    fields: ['款式名称', '尺码 / 色号', '零售价'], codeLabel: '库存编码',
    blurb: '款式、尺码色号与库存编码'
  }),
  task({
    id: 'jewelry-piece', taskLabel: '珠宝单品', seriesId: 'fashion-jewelry', sceneIds: ['fashion'],
    category: '零售', industry: '行业标识', size: [30, 15], kind: 'qrcode',
    fields: ['饰品名称', '材质 / 规格', '柜台位置'], codeLabel: '单品溯源码',
    blurb: '单品名称、材质规格与柜台'
  }),
  task({
    id: 'garment-care', taskLabel: '成分洗护', seriesId: 'fashion-jewelry', sceneIds: ['fashion'],
    category: '零售', industry: '内容设计', size: [30, 15], kind: 'qrcode',
    fields: ['品类名称', '成分说明', '洗护要点'], codeLabel: '详情查询码',
    blurb: '成分摘要、洗护要点与详情查询'
  }),

  task({
    id: 'student-belonging', taskLabel: '学生物品', seriesId: 'campus-home', sceneIds: ['office-life'],
    category: '生活', industry: '行业标识', size: [40, 12], kind: 'qrcode',
    fields: ['姓名 / 班级', '物品名称', '归还位置'], codeLabel: '物品码',
    blurb: '姓名班级、物品与归还位置'
  }),
  task({
    id: 'home-storage', taskLabel: '家庭收纳', seriesId: 'campus-home', sceneIds: ['office-life'],
    category: '生活', industry: '实用功能', size: [40, 20], kind: 'qrcode',
    fields: ['箱体编号', '内容分类', '存放位置'], codeLabel: '收纳清单码',
    blurb: '箱号、内容分类与存放位置'
  })
]);

function scenarioGroupFor(taskSpec) {
  const scene = taskSpec.sceneIds[0];
  return {
    retail: '零售价签',
    warehouse: '仓储资产',
    expiry: '食品效期',
    fashion: '服装珠宝',
    equipment: '线缆设备',
    'office-life': '办公生活'
  }[scene] || taskSpec.seriesGroup;
}

function profileIdsFor(size) {
  return size[1] <= 12 ? COMPACT_PROFILES : STANDARD_PROFILES;
}

function sizeForVariant(taskSpec, taskIndex, variant) {
  if (variant.id === 'panorama') return [50, 30];
  if (variant.id === 'ledger') return taskIndex % 2 === 0 ? [60, 40] : [50, 40];
  return taskSpec.size.slice();
}

function freezeTemplate(template) {
  template.size = Object.freeze(template.size.slice());
  template.sceneIds = Object.freeze(template.sceneIds.slice());
  template.verifiedProfiles = Object.freeze(template.verifiedProfiles.slice());
  template.stockProfile = Object.freeze(Object.assign({}, template.stockProfile));
  template.printRequirements = Object.freeze(Object.assign({}, template.printRequirements));
  return Object.freeze(template);
}

const CLEANROOM_TEMPLATE_PACK = Object.freeze(CLEANROOM_TASKS.flatMap((taskSpec, taskIndex) => (
  VARIANTS.map((variant, variantIndex) => {
    const size = sizeForVariant(taskSpec, taskIndex, variant);
    // Wide stock is selected by physical capability at print time. It is not
    // tied to a Bluetooth name, protocol task or hard-coded printer model.
    const verifiedProfiles = variant.nativeWide ? [] : profileIdsFor(size).slice();
    return freezeTemplate({
      id: `sy-cr-${taskSpec.id}-${variant.id}`,
      name: `商跃${taskSpec.taskLabel}·${variant.label}`,
      taskId: taskSpec.id,
      taskLabel: taskSpec.taskLabel,
      seriesGroup: taskSpec.seriesGroup,
      scenarioGroup: scenarioGroupFor(taskSpec),
      sceneIds: taskSpec.sceneIds.slice(),
      category: taskSpec.category,
      industry: taskSpec.industry,
      size,
      kind: taskSpec.kind,
      blurb: `${taskSpec.blurb}；${variant.blurb}`,
      variantLabel: variant.label,
      layoutVariant: variant.id,
      layoutFamily: variant.layoutFamily,
      accent: taskSpec.accent,
      badge: '商跃原创',
      uses: 0,
      origin: 'shangyue-original',
      source: 'shangyue-original',
      provenance: 'shangyue-clean-room',
      authorship: 'shangyue-clean-room',
      copyright: '© 2026 商跃',
      thirdPartyAssets: false,
      approvedOriginal: true,
      approvalStatus: 'approved',
      publicCatalog: true,
      releaseApproved: true,
      batchCompatible: false,
      riskGuard: 'edit-before-print',
      packVersion: PACK_VERSION,
      designVersion: variant.nativeWide ? '3.0.0' : '2.0.0',
      nativeLayout: variant.nativeWide === true,
      hardwareAgnostic: variant.nativeWide === true,
      transportAgnostic: true,
      profilePolicy: variant.nativeWide ? 'runtime-capability' : 'verified-profile-list',
      taskOrder: taskIndex,
      variantOrder: variantIndex,
      verifiedProfiles,
      stock: `${size[0]}×${size[1]} mm 间隙标签`,
      stockProfile: {
        widthMm: size[0],
        heightMm: size[1],
        media: 'gap-label',
        orientation: 'landscape',
        safeInsetMm: variant.nativeWide ? 0.8 : 0.7,
        fitPolicy: 'native-size-only'
      },
      printRequirements: {
        widthMm: size[0],
        heightMm: size[1],
        media: 'gap-label',
        minDpi: 203,
        transportAgnostic: true
      }
    });
  })
)));

const CLEANROOM_TEMPLATE_INDEX = Object.freeze(Object.fromEntries(
  CLEANROOM_TEMPLATE_PACK.map((template) => [template.id, template])
));

function getCleanroomTemplate(id) {
  return CLEANROOM_TEMPLATE_INDEX[String(id || '')] || null;
}

function cleanroomTaskChips() {
  const groups = SERIES.map((series) => {
    const tasks = CLEANROOM_TASKS.filter((item) => item.seriesId === series.id);
    return {
      id: series.id,
      label: series.label,
      taskCount: tasks.length,
      templateCount: tasks.length * VARIANTS.length,
      sceneIds: Array.from(new Set(tasks.flatMap((item) => item.sceneIds)))
    };
  });
  return [
    {
      id: 'all',
      label: '全部',
      taskCount: CLEANROOM_TASKS.length,
      templateCount: CLEANROOM_TEMPLATE_PACK.length,
      sceneIds: Array.from(new Set(CLEANROOM_TASKS.flatMap((item) => item.sceneIds)))
    },
    ...groups
  ];
}

function elementFactory(doc, templateId) {
  let ordinal = 0;
  return function make(type, options) {
    const element = createElement(type, doc);
    ordinal += 1;
    Object.assign(element, options || {});
    element.id = `${templateId}-e${String(ordinal).padStart(2, '0')}-${type}`;
    return element;
  };
}

function staticText(make, options) {
  return make('text', Object.assign({
    text: '', fontSize: 2.7, autoFit: true, wordWrap: false,
    align: 'left', verticalAlign: 'middle', locked: true
  }, options || {}));
}

function requiredField(make, label, options) {
  return make('text', Object.assign({
    text: `${label}：请填写`, fontSize: 2.8, autoFit: true, wordWrap: false,
    align: 'left', verticalAlign: 'middle', locked: false,
    fieldLabel: label, requiresInput: true,
    requiresInputReason: 'placeholder-text', riskRole: 'business-data'
  }, options || {}));
}

function shape(make, options) {
  return make('rect', Object.assign({
    lineWidth: 0.32, filled: false, shapeKind: 'rect', locked: true
  }, options || {}));
}

function divider(make, options) {
  return make('line', Object.assign({
    lineWidth: 0.3, locked: true
  }, options || {}));
}

function sampleCode(make, template, taskSpec, options) {
  const common = {
    value: taskSpec.kind === 'qrcode'
      ? `SYDEMO:${String(template.taskOrder + 1).padStart(2, '0')}`
      : 'DEMO',
    requiresInput: true,
    requiresInputReason: 'sample-code',
    riskRole: 'sample-code',
    fieldLabel: taskSpec.codeLabel,
    locked: false
  };
  if (taskSpec.kind === 'qrcode') {
    return make('qrcode', Object.assign(common, {
      errorCorrection: 'M'
    }, options || {}));
  }
  return make('barcode', Object.assign(common, {
    format: 'code128', showText: true, textPosition: 'bottom', fontSize: 2.1
  }, options || {}));
}

function generatedDate(make, label, options) {
  return make('date', Object.assign({
    label, dateRole: 'generic', baseTime: '2026-01-01T00:00:00.000Z',
    autoUpdate: true, showTime: false, format: 'YYYY-MM-DD',
    fontSize: 2.35, autoFit: true, locked: false, riskRole: 'generated-date'
  }, options || {}));
}

function addOptionalDate(elements, make, taskSpec, box) {
  if (!taskSpec.dateLabel) return;
  elements.push(generatedDate(make, taskSpec.dateLabel, box));
}

function geometryNudge(template) {
  return {
    // Deliberate, visible grid rhythm: each task gets a different primary-field
    // inset, and the second task row also changes its vertical breathing room.
    // These are composition decisions (0.16/0.26 mm), not sub-pixel noise.
    x: (template.taskOrder % 10) * 0.16,
    y: Math.floor(template.taskOrder / 10) * 0.26
  };
}

function addCodeWithLabel(elements, make, template, taskSpec, labelBox, codeBox) {
  elements.push(staticText(make, Object.assign({
    text: taskSpec.codeLabel, fontSize: 2.05, bold: true
  }, labelBox)));
  elements.push(sampleCode(make, template, taskSpec, codeBox));
}

function focusLayout(doc, make, template, taskSpec) {
  const h = doc.heightMm;
  const nudge = geometryNudge(template);
  const elements = [
    shape(make, { x: 0.7, y: 0.7, width: 38.6, height: h - 1.4, shapeKind: 'rounded' })
  ];

  if (h <= 12) {
    elements.push(
      shape(make, { x: 0.7, y: 0.7, width: 7.8, height: h - 1.4, filled: true }),
      staticText(make, {
        x: 1.1, y: 1.1, width: 7, height: 6.1, text: taskSpec.taskLabel,
        fontSize: 2.05, bold: true, reverse: true, wordWrap: true, align: 'center'
      }),
      staticText(make, {
        x: 1.1, y: 7.6, width: 7, height: 2.7, text: template.variantLabel,
        fontSize: 1.75, reverse: true, align: 'center'
      }),
      requiredField(make, taskSpec.fields[0], {
        x: 9.2 + nudge.x, y: 1 + nudge.y, width: 18.2 - nudge.x, height: 2.9, fontSize: 2.2
      }),
      requiredField(make, taskSpec.fields[1], { x: 9.2, y: 4.15, width: 18.2, height: 2.9, fontSize: 2.2 }),
      requiredField(make, taskSpec.fields[2], { x: 9.2, y: 7.3, width: 18.2, height: 2.9, fontSize: 2.2 })
    );
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 28.6, y: 0.8, width: 10, height: 1.7, fontSize: 1.6, align: 'center' },
      { x: 28.4, y: 1.9, width: 10.2, height: 9.1 });
    return elements;
  }

  const headerHeight = h <= 20 ? 4 : 4.8;
  elements.push(
    shape(make, { x: 0.7, y: 0.7, width: 38.6, height: headerHeight, filled: true }),
    staticText(make, {
      x: 1.5, y: 1.15, width: 25, height: headerHeight - 0.9,
      text: taskSpec.taskLabel, fontSize: h <= 20 ? 2.6 : 3, bold: true, reverse: true
    }),
    staticText(make, {
      x: 28, y: 1.2, width: 10.5, height: headerHeight - 1,
      text: template.variantLabel, fontSize: 2.15, bold: true, reverse: true, align: 'right'
    })
  );

  if (h <= 20) {
    if (taskSpec.kind === 'qrcode') {
      elements.push(
        requiredField(make, taskSpec.fields[0], {
          x: 1.5 + nudge.x, y: 5.2 + nudge.y, width: 25 - nudge.x, height: 3.5, fontSize: 2.45
        }),
        requiredField(make, taskSpec.fields[1], { x: 1.5, y: 8.9, width: 25, height: 3.5, fontSize: 2.35 }),
        requiredField(make, taskSpec.fields[2], { x: 1.5, y: 12.6, width: 25, height: 3.5, fontSize: 2.35 })
      );
      addCodeWithLabel(elements, make, template, taskSpec,
        { x: 27.8, y: 5.1, width: 10.6, height: 2, align: 'center' },
        { x: 28, y: 7.1, width: 10.8, height: 10.8 });
    } else {
      elements.push(
        requiredField(make, taskSpec.fields[0], {
          x: 1.5 + nudge.x, y: 5.1 + nudge.y, width: 37 - nudge.x, height: 3.4, fontSize: 2.5
        }),
        requiredField(make, taskSpec.fields[1], { x: 1.5, y: 8.6, width: 17.7, height: 3.3, fontSize: 2.3 }),
        requiredField(make, taskSpec.fields[2], { x: 20.1, y: 8.6, width: 18.4, height: 3.3, fontSize: 2.3 })
      );
      addCodeWithLabel(elements, make, template, taskSpec,
        { x: 1.5, y: 12.1, width: 10, height: 1.7 },
        { x: 1.5, y: 13.6, width: 37, height: 5.1 });
    }
    return elements;
  }

  if (taskSpec.kind === 'qrcode') {
    elements.push(
      requiredField(make, taskSpec.fields[0], {
        x: 1.5 + nudge.x, y: 6 + nudge.y, width: 24.7 - nudge.x, height: 4, fontSize: 2.75
      }),
      requiredField(make, taskSpec.fields[1], { x: 1.5, y: 10.3, width: 24.7, height: 4, fontSize: 2.55 }),
      requiredField(make, taskSpec.fields[2], { x: 1.5, y: 14.6, width: 24.7, height: 4, fontSize: 2.55 }),
      divider(make, { x: 1.5, y: 19.2, width: 24.7, height: 0.4 })
    );
    addOptionalDate(elements, make, taskSpec, { x: 1.5, y: 20, width: 24.7, height: 3.2 });
    if (!taskSpec.dateLabel) {
      elements.push(staticText(make, {
        x: 1.5, y: 20, width: 24.7, height: 3.2, text: '核对内容后打印', fontSize: 2.2
      }));
    }
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 27.3, y: 6, width: 11.2, height: 2.2, align: 'center' },
      { x: 27.4, y: 8.4, width: 11.1, height: 11.1 });
  } else {
    elements.push(
      requiredField(make, taskSpec.fields[0], {
        x: 1.5 + nudge.x, y: 6 + nudge.y, width: 37 - nudge.x, height: 4.1, fontSize: 2.8
      }),
      requiredField(make, taskSpec.fields[1], { x: 1.5, y: 10.4, width: 17.7, height: 4.1, fontSize: 2.55 }),
      requiredField(make, taskSpec.fields[2], { x: 20.1, y: 10.4, width: 18.4, height: 4.1, fontSize: 2.55 })
    );
    addOptionalDate(elements, make, taskSpec, { x: 1.5, y: 14.8, width: 18, height: 3.2 });
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: taskSpec.dateLabel ? 20.1 : 1.5, y: 15.1, width: taskSpec.dateLabel ? 18.4 : 37, height: 2, align: taskSpec.dateLabel ? 'right' : 'left' },
      { x: 1.5, y: 18.2, width: 37, height: 9.4 });
  }
  return elements;
}

function splitLayout(doc, make, template, taskSpec) {
  const h = doc.heightMm;
  const nudge = geometryNudge(template);
  const elements = [
    shape(make, { x: 0.7, y: 0.7, width: 38.6, height: h - 1.4 }),
    shape(make, { x: 0.7, y: 0.7, width: h <= 12 ? 6.2 : 7.7, height: h - 1.4, filled: true })
  ];

  if (h <= 12) {
    elements.push(
      staticText(make, {
        x: 1, y: 1.1, width: 5.6, height: 6.4, text: taskSpec.taskLabel,
        fontSize: 1.9, bold: true, reverse: true, wordWrap: true, align: 'center'
      }),
      staticText(make, {
        x: 1, y: 7.7, width: 5.6, height: 2.3, text: template.variantLabel,
        fontSize: 1.55, reverse: true, align: 'center'
      }),
      requiredField(make, taskSpec.fields[0], {
        x: 7.7 + nudge.x, y: 1 + nudge.y, width: 20 - nudge.x, height: 2.8, fontSize: 2.15
      }),
      divider(make, { x: 7.7, y: 3.9, width: 20, height: 0.3 }),
      requiredField(make, taskSpec.fields[1], { x: 7.7, y: 4.15, width: 20, height: 2.8, fontSize: 2.1 }),
      divider(make, { x: 7.7, y: 7.05, width: 20, height: 0.3 }),
      requiredField(make, taskSpec.fields[2], { x: 7.7, y: 7.3, width: 20, height: 2.8, fontSize: 2.1 })
    );
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 28.5, y: 0.8, width: 10.3, height: 1.6, fontSize: 1.55, align: 'center' },
      { x: 28.4, y: 1.8, width: 10.2, height: 9.1 });
    return elements;
  }

  elements.push(
    staticText(make, {
      x: 1.2, y: 1.5, width: 6.7, height: h <= 20 ? 7.2 : 9.2,
      text: taskSpec.taskLabel, fontSize: h <= 20 ? 2.1 : 2.45,
      bold: true, reverse: true, wordWrap: true, align: 'center'
    }),
    staticText(make, {
      x: 1.2, y: h - 5, width: 6.7, height: 3.1,
      text: template.variantLabel, fontSize: 1.9, reverse: true, align: 'center'
    })
  );

  if (h <= 20) {
    if (taskSpec.kind === 'qrcode') {
      elements.push(
        requiredField(make, taskSpec.fields[0], {
          x: 9.2 + nudge.x, y: 1.4 + nudge.y, width: 17.5 - nudge.x, height: 4, fontSize: 2.45
        }),
        requiredField(make, taskSpec.fields[1], { x: 9.2, y: 5.6, width: 17.5, height: 4, fontSize: 2.3 }),
        requiredField(make, taskSpec.fields[2], { x: 9.2, y: 9.8, width: 17.5, height: 4, fontSize: 2.3 })
      );
      addCodeWithLabel(elements, make, template, taskSpec,
        { x: 27.8, y: 1.3, width: 10.5, height: 2, align: 'center' },
        { x: 28, y: 3.5, width: 10.8, height: 10.8 });
    } else {
      elements.push(
        requiredField(make, taskSpec.fields[0], {
          x: 9.2 + nudge.x, y: 1.4 + nudge.y, width: 29.1 - nudge.x, height: 3.6, fontSize: 2.55
        }),
        requiredField(make, taskSpec.fields[1], { x: 9.2, y: 5.1, width: 14, height: 3.6, fontSize: 2.3 }),
        requiredField(make, taskSpec.fields[2], { x: 24.2, y: 5.1, width: 14.1, height: 3.6, fontSize: 2.3 })
      );
      addCodeWithLabel(elements, make, template, taskSpec,
        { x: 9.2, y: 9, width: 12, height: 1.8 },
        { x: 9.2, y: 11.2, width: 29.1, height: 7.2 });
    }
    return elements;
  }

  elements.push(
    requiredField(make, taskSpec.fields[0], {
      x: 9.5 + nudge.x, y: 1.5 + nudge.y, width: 28.8 - nudge.x, height: 4.8, fontSize: 2.75
    }),
    divider(make, { x: 9.5, y: 6.5, width: 28.8, height: 0.4 }),
    requiredField(make, taskSpec.fields[1], { x: 9.5, y: 7, width: 13.7, height: 4.7, fontSize: 2.5 }),
    requiredField(make, taskSpec.fields[2], { x: 24.3, y: 7, width: 14, height: 4.7, fontSize: 2.5 }),
    divider(make, { x: 9.5, y: 12, width: 28.8, height: 0.4 })
  );
  addOptionalDate(elements, make, taskSpec, { x: 9.5, y: 12.6, width: 13.7, height: 3.1 });

  if (taskSpec.kind === 'qrcode') {
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 9.5, y: 16.2, width: 15, height: 2.4 },
      { x: 27, y: 16.5, width: 11.1, height: 11.1 });
    elements.push(staticText(make, {
      x: 9.5, y: 19, width: 15.5, height: 5.5, text: '扫码登记\n·\n核验后流转',
      fontSize: 2.05, wordWrap: true, align: 'center'
    }));
  } else {
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 9.5, y: 15.6, width: 28.8, height: 2 },
      { x: 9.5, y: 18, width: 28.8, height: 9.3 });
  }
  return elements;
}

function verifyLayout(doc, make, template, taskSpec) {
  const h = doc.heightMm;
  const nudge = geometryNudge(template);
  const elements = [
    shape(make, { x: 0.7, y: 0.7, width: 38.6, height: h - 1.4, shapeKind: 'rounded' })
  ];

  if (h <= 12) {
    elements.push(
      shape(make, { x: 1, y: 1, width: 12.2, height: 3.1, filled: true, shapeKind: 'rounded' }),
      staticText(make, {
        x: 1.4, y: 1.25, width: 11.4, height: 2.5, text: taskSpec.taskLabel,
        fontSize: 2, bold: true, reverse: true, align: 'center'
      }),
      requiredField(make, taskSpec.fields[0], {
        x: 1.2 + nudge.x, y: 4.45 + nudge.y, width: 13.5 - nudge.x, height: 2.7, fontSize: 2.05
      }),
      requiredField(make, taskSpec.fields[1], { x: 15.2, y: 1, width: 12.4, height: 2.9, fontSize: 2.05 }),
      requiredField(make, taskSpec.fields[2], { x: 15.2, y: 4.25, width: 12.4, height: 2.9, fontSize: 2.05 }),
      staticText(make, {
        x: 1.2, y: 7.5, width: 26.4, height: 2.6, text: '核对两端信息后打印', fontSize: 1.9
      })
    );
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 28.6, y: 0.8, width: 10, height: 1.6, fontSize: 1.55, align: 'center' },
      { x: 28.4, y: 1.9, width: 10.2, height: 9.1 });
    return elements;
  }

  const tagHeight = h <= 20 ? 3.6 : 4.2;
  elements.push(
    shape(make, { x: 1, y: 1, width: 13.5, height: tagHeight, filled: true, shapeKind: 'rounded' }),
    staticText(make, {
      x: 1.5, y: 1.35, width: 12.5, height: tagHeight - 0.7,
      text: taskSpec.taskLabel, fontSize: h <= 20 ? 2.25 : 2.55, bold: true, reverse: true, align: 'center'
    }),
    staticText(make, {
      x: 16, y: 1.1, width: 22.2, height: tagHeight,
      text: `${template.variantLabel}  ·  请现场核对`, fontSize: h <= 20 ? 2 : 2.2, bold: true, align: 'right'
    })
  );

  if (h <= 20) {
    elements.push(
      shape(make, { x: 1, y: 5, width: 11.6, height: 5.6, shapeKind: 'rounded' }),
      shape(make, { x: 13.2, y: 5, width: 11.6, height: 5.6, shapeKind: 'rounded' }),
      requiredField(make, taskSpec.fields[0], {
        x: 1.6 + nudge.x, y: 5.5 + nudge.y, width: 10.4 - nudge.x, height: 4.6, fontSize: 2.15, wordWrap: true, align: 'center'
      }),
      requiredField(make, taskSpec.fields[1], {
        x: 13.8, y: 5.5, width: 10.4, height: 4.6, fontSize: 2.15, wordWrap: true, align: 'center'
      }),
      requiredField(make, taskSpec.fields[2], { x: 1.2, y: 11.3, width: 23.7, height: 3.6, fontSize: 2.25 })
    );
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 27.5, y: 5, width: 10.8, height: 2, align: 'center' },
      { x: 27.8, y: 7.1, width: 10.8, height: 10.8 });
    return elements;
  }

  elements.push(
    shape(make, { x: 1, y: 6, width: 11.8, height: 8.2, shapeKind: 'rounded' }),
    shape(make, { x: 14.1, y: 6, width: 11.8, height: 8.2, shapeKind: 'rounded' }),
    shape(make, { x: 27.2, y: 6, width: 11.8, height: 8.2, shapeKind: 'rounded' }),
    staticText(make, { x: 1.5, y: 6.4, width: 2.7, height: 2.2, text: '01', fontSize: 1.9, bold: true }),
    staticText(make, { x: 14.6, y: 6.4, width: 2.7, height: 2.2, text: '02', fontSize: 1.9, bold: true }),
    staticText(make, { x: 27.7, y: 6.4, width: 2.7, height: 2.2, text: '03', fontSize: 1.9, bold: true }),
    requiredField(make, taskSpec.fields[0], {
      x: 1.5 + nudge.x, y: 8.4 + nudge.y, width: 10.8 - nudge.x, height: 5.1, fontSize: 2.25, wordWrap: true, align: 'center'
    }),
    requiredField(make, taskSpec.fields[1], {
      x: 14.6, y: 8.4, width: 10.8, height: 5.1, fontSize: 2.25, wordWrap: true, align: 'center'
    }),
    requiredField(make, taskSpec.fields[2], {
      x: 27.7, y: 8.4, width: 10.8, height: 5.1, fontSize: 2.25, wordWrap: true, align: 'center'
    })
  );
  addOptionalDate(elements, make, taskSpec, { x: 1.3, y: 15.1, width: 16, height: 3.1 });

  if (taskSpec.kind === 'qrcode') {
    elements.push(staticText(make, {
      x: 1.3, y: taskSpec.dateLabel ? 18.6 : 16, width: 23.8, height: 3.8,
      text: taskSpec.dateLabel ? '扫码记录复核结果' : '内容确认无误后扫码流转', fontSize: 2.25, bold: true
    }));
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 27.1, y: 15.1, width: 11.6, height: 2.1, align: 'center' },
      { x: 27.5, y: 17.4, width: 10.9, height: 10.9 });
  } else {
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: 1.3, y: 15.2, width: 37.4, height: 2 },
      { x: 1.3, y: 18.2, width: 37.4, height: 9.2 });
  }
  return elements;
}

/**
 * Native 50×30 composition. Unlike the compact families above, this layout is
 * authored directly against the requested stock and is never stretched from a
 * 40 mm grid. The right scan rail leaves a continuous reading lane for the
 * three editable business fields.
 */
function panoramaLayout(doc, make, template, taskSpec) {
  const w = doc.widthMm;
  const h = doc.heightMm;
  const nudge = geometryNudge(template);
  const elements = [
    shape(make, { x: 0.8, y: 0.8, width: w - 1.6, height: h - 1.6, shapeKind: 'rounded' }),
    shape(make, { x: 0.8, y: 0.8, width: w - 1.6, height: 5.1, filled: true, shapeKind: 'rounded' }),
    staticText(make, {
      x: 1.6, y: 1.25, width: w - 20.2, height: 3.9,
      text: taskSpec.taskLabel, fontSize: 3.05, bold: true, reverse: true
    }),
    staticText(make, {
      x: w - 17.6, y: 1.3, width: 16, height: 3.7,
      text: '50×30 · 横展', fontSize: 2.1, bold: true, reverse: true, align: 'right'
    })
  ];

  if (taskSpec.kind === 'qrcode') {
    const codeColumnX = w - 13.2;
    const fieldWidth = codeColumnX - 2.7;
    elements.push(
      shape(make, {
        x: codeColumnX - 0.7, y: 6.5, width: 0.35, height: h - 8.1,
        filled: true, lineWidth: 0.2
      }),
      requiredField(make, taskSpec.fields[0], {
        x: 1.6 + nudge.x, y: 6.45 + nudge.y,
        width: fieldWidth - nudge.x, height: 4.05, fontSize: 2.75
      }),
      requiredField(make, taskSpec.fields[1], {
        x: 1.6, y: 10.95, width: fieldWidth, height: 4.05, fontSize: 2.55
      }),
      requiredField(make, taskSpec.fields[2], {
        x: 1.6, y: 15.45, width: fieldWidth, height: 4.05, fontSize: 2.55
      })
    );
    addOptionalDate(elements, make, taskSpec, {
      x: 1.6, y: 20.05, width: fieldWidth, height: 3.05, fontSize: 2.25
    });
    if (!taskSpec.dateLabel) {
      elements.push(staticText(make, {
        x: 1.6, y: 20.05, width: fieldWidth, height: 3.05,
        text: '业务信息确认后再打印', fontSize: 2.2, bold: true
      }));
    }
    elements.push(staticText(make, {
      x: 1.6, y: 23.55, width: fieldWidth, height: 3.45,
      text: '三项可编辑 · 扫码值待替换', fontSize: 1.95
    }));
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: codeColumnX, y: 6.55, width: 11.6, height: 1.9, align: 'center' },
      { x: codeColumnX + 0.25, y: 9.05, width: 11.15, height: 11.15 });
    elements.push(staticText(make, {
      x: codeColumnX, y: 21.15, width: 11.6, height: 5.65,
      text: '现场核对\n再扫码', fontSize: 2.05, bold: true, wordWrap: true, align: 'center'
    }));
    return elements;
  }

  const halfGap = 0.9;
  const halfWidth = (w - 4.1) / 2;
  elements.push(
    requiredField(make, taskSpec.fields[0], {
      x: 1.6 + nudge.x, y: 6.45 + nudge.y,
      width: w - 3.2 - nudge.x, height: 4.05, fontSize: 2.85
    }),
    divider(make, { x: 1.6, y: 10.6, width: w - 3.2, height: 0.35 }),
    requiredField(make, taskSpec.fields[1], {
      x: 1.6, y: 11.15, width: halfWidth, height: 3.8, fontSize: 2.5
    }),
    requiredField(make, taskSpec.fields[2], {
      x: 1.6 + halfWidth + halfGap, y: 11.15,
      width: halfWidth - halfGap, height: 3.8, fontSize: 2.5
    })
  );
  addOptionalDate(elements, make, taskSpec, {
    x: 1.6, y: 15.45, width: halfWidth, height: 2.8, fontSize: 2.15
  });
  if (!taskSpec.dateLabel) {
    elements.push(staticText(make, {
      x: 1.6, y: 15.45, width: halfWidth, height: 2.8,
      text: '规格与数值已复核', fontSize: 2.1
    }));
  }
  addCodeWithLabel(elements, make, template, taskSpec,
    { x: 1.6 + halfWidth + halfGap, y: 15.45, width: halfWidth - halfGap, height: 2.2, align: 'right' },
    { x: 1.6, y: 18.55, width: w - 3.2, height: 9.05 });
  return elements;
}

/**
 * Native 50/60×40 composition for jobs that benefit from a three-column
 * verification ledger. Width-dependent card math is intentional: 50 mm and
 * 60 mm stock receive their own spacing instead of scaled legacy coordinates.
 */
function ledgerLayout(doc, make, template, taskSpec) {
  const w = doc.widthMm;
  const h = doc.heightMm;
  const nudge = geometryNudge(template);
  const gap = 0.8;
  const cardWidth = (w - 4 - gap * 2) / 3;
  const cardXs = [1.2, 1.2 + cardWidth + gap, 1.2 + (cardWidth + gap) * 2];
  const elements = [
    shape(make, { x: 0.8, y: 0.8, width: w - 1.6, height: h - 1.6, shapeKind: 'rounded' }),
    shape(make, { x: 0.8, y: 0.8, width: w - 1.6, height: 5.1, filled: true, shapeKind: 'rounded' }),
    staticText(make, {
      x: 1.6, y: 1.2, width: w - 20, height: 3.9,
      text: taskSpec.taskLabel, fontSize: 3.15, bold: true, reverse: true
    }),
    staticText(make, {
      x: w - 17.8, y: 1.25, width: 16.2, height: 3.8,
      text: `${w}×40 · 台账`, fontSize: 2.15, bold: true, reverse: true, align: 'right'
    })
  ];

  cardXs.forEach((x, index) => {
    elements.push(
      shape(make, { x, y: 6.75, width: cardWidth, height: 9.35, shapeKind: 'rounded' }),
      staticText(make, {
        x: x + 0.55, y: 7.1, width: 2.8, height: 2.05,
        text: `0${index + 1}`, fontSize: 1.85, bold: true
      }),
      requiredField(make, taskSpec.fields[index], {
        x: x + 0.65 + (index === 0 ? nudge.x : 0),
        y: 9.15 + (index === 0 ? nudge.y : 0),
        width: cardWidth - 1.3 - (index === 0 ? nudge.x : 0),
        height: 6.05, fontSize: 2.3, wordWrap: true, align: 'center'
      })
    );
  });

  if (taskSpec.kind === 'qrcode') {
    const codeX = w - 14.25;
    const reviewWidth = codeX - 2.4;
    elements.push(
      shape(make, { x: 1.2, y: 17.15, width: reviewWidth, height: 13.55, shapeKind: 'rounded' }),
      staticText(make, {
        x: 2, y: 17.85, width: reviewWidth - 1.6, height: 2.8,
        text: '现场复核', fontSize: 2.45, bold: true
      })
    );
    addOptionalDate(elements, make, taskSpec, {
      x: 2, y: 21.05, width: reviewWidth - 1.6, height: 3.1, fontSize: 2.25
    });
    if (!taskSpec.dateLabel) {
      elements.push(staticText(make, {
        x: 2, y: 21.05, width: reviewWidth - 1.6, height: 3.1,
        text: '未核对内容请勿直接打印', fontSize: 2.2
      }));
    }
    elements.push(staticText(make, {
      x: 2, y: 25, width: reviewWidth - 1.6, height: 4.2,
      text: '信息完整  □    编码已换  □', fontSize: 2.05, bold: true
    }));
    addCodeWithLabel(elements, make, template, taskSpec,
      { x: codeX, y: 17.25, width: 13.05, height: 1.9, align: 'center' },
      { x: codeX + 0.5, y: 19.55, width: 12.05, height: 12.05 });
    elements.push(
      shape(make, { x: 1.2, y: 32.35, width: w - 2.4, height: 5.45, filled: true, shapeKind: 'rounded' }),
      staticText(make, {
        x: 2, y: 33.05, width: w - 4, height: 3.85,
        text: '三项确认完成 · 再执行扫码流转', fontSize: 2.35,
        bold: true, reverse: true, align: 'center'
      })
    );
    return elements;
  }

  addOptionalDate(elements, make, taskSpec, {
    x: 1.6, y: 17.35, width: 21, height: 2.9, fontSize: 2.2
  });
  if (!taskSpec.dateLabel) {
    elements.push(staticText(make, {
      x: 1.6, y: 17.35, width: 21, height: 2.9,
      text: '三项业务信息已复核', fontSize: 2.2, bold: true
    }));
  }
  addCodeWithLabel(elements, make, template, taskSpec,
    { x: w - 23, y: 17.35, width: 21.4, height: 2.3, align: 'right' },
    { x: 1.4, y: 21.05, width: w - 2.8, height: 10.65 });
  elements.push(
    shape(make, { x: 1.2, y: 32.45, width: w - 2.4, height: 5.35, filled: true, shapeKind: 'rounded' }),
    staticText(make, {
      x: 2, y: 33.1, width: w - 4, height: 3.8,
      text: '编码替换后打印 · 留存现场核验结果', fontSize: 2.3,
      bold: true, reverse: true, align: 'center'
    })
  );
  return elements;
}

const LAYOUTS = Object.freeze({
  focus: focusLayout,
  split: splitLayout,
  verify: verifyLayout,
  panorama: panoramaLayout,
  ledger: ledgerLayout
});

function documentMeta(template) {
  return {
    templateId: template.id,
    taskId: template.taskId,
    taskLabel: template.taskLabel,
    seriesGroup: template.seriesGroup,
    scenarioGroup: template.scenarioGroup,
    sceneIds: template.sceneIds.slice(),
    variantLabel: template.variantLabel,
    layoutFamily: template.layoutFamily,
    origin: 'shangyue-original',
    source: 'shangyue-original',
    provenance: 'shangyue-clean-room',
    authorship: 'shangyue-clean-room',
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    riskGuard: 'edit-before-print',
    batchCompatible: false,
    packVersion: PACK_VERSION,
    designVersion: template.designVersion,
    nativeLayout: template.nativeLayout,
    hardwareAgnostic: template.hardwareAgnostic,
    transportAgnostic: template.transportAgnostic,
    profilePolicy: template.profilePolicy,
    verifiedProfiles: template.verifiedProfiles.slice(),
    stockProfile: Object.assign({}, template.stockProfile),
    printRequirements: Object.assign({}, template.printRequirements)
  };
}

/**
 * Layout algorithms use a 40 mm design grid. Narrow stock is transformed as a
 * complete composition, keeping the source math simple and deterministic while
 * preserving the exact requested physical size in the resulting document.
 * Fifteen-millimetre labels use the 20 mm vertical grid at 75% scale.
 */
function fitLayoutToStock(elements, targetWidth, targetHeight, designHeight) {
  const scaleX = targetWidth / 40;
  const scaleY = targetHeight / designHeight;
  const textScale = Math.min(scaleX, scaleY);
  return elements.map((element) => {
    element.x *= scaleX;
    element.y *= scaleY;
    element.width *= scaleX;
    element.height *= scaleY;
    if (Number.isFinite(Number(element.fontSize))) element.fontSize *= textScale;
    if (Number.isFinite(Number(element.lineWidth))) element.lineWidth *= Math.max(0.75, textScale);
    return element;
  });
}

function buildCleanroomDocument(templateOrId) {
  const template = typeof templateOrId === 'string'
    ? getCleanroomTemplate(templateOrId)
    : templateOrId;
  if (!template || getCleanroomTemplate(template.id) !== template) {
    throw new Error(`Unknown clean-room template: ${typeof templateOrId === 'string' ? templateOrId : ''}`);
  }
  const taskSpec = CLEANROOM_TASKS[template.taskOrder];
  const layout = LAYOUTS[template.layoutVariant];
  if (!taskSpec || !layout) throw new Error(`Incomplete clean-room template: ${template.id}`);

  const doc = createDocument(template.size[0], template.size[1]);
  doc.name = template.name;
  doc.elements = [];
  doc.templateMeta = documentMeta(template);
  doc.stockLabel = template.stock;
  const make = elementFactory(doc, template.id);
  if (template.nativeLayout) {
    doc.elements = layout(
      { widthMm: template.size[0], heightMm: template.size[1] },
      make,
      template,
      taskSpec
    );
  } else {
    const designHeight = template.size[1] === 15 ? 20 : template.size[1];
    const designGrid = { widthMm: 40, heightMm: designHeight };
    doc.elements = fitLayoutToStock(
      layout(designGrid, make, template, taskSpec),
      template.size[0],
      template.size[1],
      designHeight
    );
  }
  return doc;
}

const CLEANROOM_LAYOUT_BUILDERS = Object.freeze(Object.fromEntries(
  CLEANROOM_TEMPLATE_PACK.map((template) => [template.id, () => buildCleanroomDocument(template.id)])
));

module.exports = {
  CLEANROOM_LAYOUT_BUILDERS,
  CLEANROOM_TASKS,
  CLEANROOM_TEMPLATE_INDEX,
  CLEANROOM_TEMPLATE_PACK,
  CLEANROOM_VARIANTS: VARIANTS,
  PACK_VERSION,
  buildCleanroomDocument,
  cleanroomTaskChips,
  getCleanroomTemplate
};
