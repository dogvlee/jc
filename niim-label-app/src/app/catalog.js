/**
 * Template catalog metadata for the offline industry template experience.
 * Icons/colors mirror the original app center IA (行业 / 内容 / 实用),
 * without remote VIP assets or login gates.
 */
const { CLEANROOM_TEMPLATE_PACK } = require('./cleanroom-template-pack');

function originalScenarioTemplate(spec) {
  return Object.assign({
    uses: 0,
    badge: '新场景',
    origin: 'shangyue-original',
    authorship: 'shangyue-clean-room',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    riskGuard: 'edit-before-print'
  }, spec);
}

const ORIGINAL_SCENARIO_TEMPLATES = Object.freeze([
  // 零售价签：货架、生鲜、活动三个高频门店任务。
  originalScenarioTemplate({
    id: 'shangyue-shelf-dual-price', name: '商跃双价货架签', category: '零售', industry: '行业标识',
    scenarioGroup: '零售价签', size: [40, 30], kind: 'barcode',
    blurb: '品名规格 + 零售/会员双价 + 商品码', accent: '#B4532A',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-produce-origin', name: '商跃生鲜产地签', category: '零售', industry: '行业标识',
    scenarioGroup: '零售价签', size: [40, 30], kind: 'barcode',
    blurb: '品名 + 产地等级 + 计价单位 + 批次码', accent: '#3F6B48',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-market-promo', name: '商跃门店活动签', category: '零售', industry: '内容设计',
    scenarioGroup: '零售价签', size: [40, 30], kind: 'accent',
    blurb: '活动主题 + 到期提示 + 主价视觉舱', accent: '#C43D2F',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),

  // 仓储资产：拣货、退货质检、工具盘点。
  originalScenarioTemplate({
    id: 'shangyue-pick-wave', name: '商跃拣货波次签', category: '仓储', industry: '行业标识',
    scenarioGroup: '仓储资产', size: [40, 30], kind: 'qr',
    blurb: '波次 + 库位路线 + 件数 + 复核码', accent: '#285B8F',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-return-check', name: '商跃退货质检签', category: '仓储', industry: '实用功能',
    scenarioGroup: '仓储资产', size: [40, 30], kind: 'barcode',
    blurb: '退货单 + 外观/配件复核 + 处置状态', accent: '#8A4E36',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-tool-asset', name: '商跃工具资产签', category: '仓储', industry: '行业标识',
    scenarioGroup: '仓储资产', size: [40, 30], kind: 'qr',
    blurb: '工具编号 + 保管区 + 点检周期 + 盘点码', accent: '#4A5968',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),

  // 食品效期：杯贴、冷链解冻、过敏原复核。
  originalScenarioTemplate({
    id: 'shangyue-drink-cup', name: '商跃茶饮杯贴', category: '生活', industry: '行业标识',
    scenarioGroup: '食品效期', size: [40, 30], kind: 'barcode',
    blurb: '饮品名 + 糖冰选项 + 取餐号 + 时间', accent: '#8B5A3C',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-thaw-window', name: '商跃冷链解冻签', category: '生活', industry: '实用功能',
    scenarioGroup: '食品效期', size: [40, 30], kind: 'accent',
    blurb: '品名 + 解冻/废弃时间 + 责任人复核', accent: '#2D6578',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-allergen-check', name: '商跃过敏原核对签', category: '生活', industry: '实用功能',
    scenarioGroup: '食品效期', size: [40, 30], kind: 'accent',
    blurb: '餐品 + 过敏原必填区 + 复核人', accent: '#9A3F35',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),

  // 服装珠宝：尺码色号、维修收件、面料卷管理。
  originalScenarioTemplate({
    id: 'shangyue-size-color', name: '商跃尺码色号签', category: '零售', industry: '内容设计',
    scenarioGroup: '服装珠宝', size: [40, 30], kind: 'barcode',
    blurb: '款号 + 大尺码 + 色号 + 库存码', accent: '#5B4E72',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-jewelry-repair', name: '商跃珠宝维修签', category: '零售', industry: '实用功能',
    scenarioGroup: '服装珠宝', size: [40, 30], kind: 'barcode',
    blurb: '收件号 + 物品特征 + 服务项 + 流转码', accent: '#7A6044',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-fabric-roll', name: '商跃面料卷标', category: '零售', industry: '行业标识',
    scenarioGroup: '服装珠宝', size: [40, 30], kind: 'qr',
    blurb: '面料编号 + 成分幅宽 + 缸号 + 卷码', accent: '#435C63',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),

  // 线缆设备：双端路由、端口名称、设备维保。
  originalScenarioTemplate({
    id: 'shangyue-cable-pair', name: '商跃跳线双端签', category: '办公', industry: '行业标识',
    scenarioGroup: '线缆设备', size: [40, 12], kind: 'accent',
    blurb: 'A/B 双端位置 + 链路用途', accent: '#11636D',
    verifiedProfiles: ['d110', 'd11-legacy', 'b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-panel-port', name: '商跃端口标识签', category: '办公', industry: '行业标识',
    scenarioGroup: '线缆设备', size: [40, 12], kind: 'accent',
    blurb: '机柜位 + 端口号 + VLAN/用途', accent: '#355E80',
    verifiedProfiles: ['d110', 'd11-legacy', 'b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-maintenance', name: '商跃设备维保签', category: '行业', industry: '实用功能',
    scenarioGroup: '线缆设备', size: [40, 30], kind: 'qr',
    blurb: '设备位号 + 本次/下次维保 + 工单码', accent: '#3E5A3D',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),

  // 办公生活：档案、收纳、图书借阅。
  originalScenarioTemplate({
    id: 'shangyue-archive-box', name: '商跃档案盒签', category: '办公', industry: '行业标识',
    scenarioGroup: '办公生活', size: [40, 30], kind: 'barcode',
    blurb: '年度 + 门类 + 保管期限 + 档号', accent: '#6B513A',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-storage-index', name: '商跃收纳索引签', category: '生活', industry: '实用功能',
    scenarioGroup: '办公生活', size: [40, 30], kind: 'qr',
    blurb: '箱号 + 内容分类 + 存放位置 + 清单码', accent: '#536B55',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  }),
  originalScenarioTemplate({
    id: 'shangyue-book-loan', name: '商跃图书借阅签', category: '办公', industry: '实用功能',
    scenarioGroup: '办公生活', size: [40, 20], kind: 'qr',
    blurb: '书名 + 归属区 + 借阅登记码', accent: '#3F5574',
    verifiedProfiles: ['b1', 'b21', 'b21-c2b', 'b21s']
  })
]);

const baseTemplates = [
  {
    id: 'product-simple',
    name: '商品价格标签',
    category: '零售',
    industry: '行业标识',
    size: [40, 30],
    kind: 'barcode',
    uses: 328,
    badge: null,
    blurb: '品名 + 产地规格 + 售价/会员价 + EAN-13',
    accent: '#E85D4C'
  },
  {
    id: 'promo-price',
    name: '促销价签',
    category: '零售',
    industry: '内容设计',
    size: [50, 30],
    kind: 'barcode',
    uses: 256,
    badge: '热门',
    blurb: '特价角标 + 原价划线 + 配料说明 + 条码',
    accent: '#F04A3E'
  },
  {
    id: 'jewelry-price',
    name: '珠宝价格标签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 118,
    badge: null,
    blurb: '品牌标题 + 材质重量编号 + 价格 + Code128',
    accent: '#8B6B4A'
  },
  {
    id: 'clothing-tag',
    name: '服装款式吊牌',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 142,
    badge: '新品',
    blurb: '款式名 + 规格 + 图案 + 效期 + 条码',
    accent: '#6B5B95'
  },
  {
    id: 'storage-code',
    name: '仓储货架标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 241,
    badge: null,
    blurb: '库位码 + SKU 批次 + 扫码入库二维码',
    accent: '#2F6FED'
  },
  {
    id: 'shipping-bin',
    name: '物流周转箱标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 40],
    kind: 'qr',
    uses: 97,
    badge: null,
    blurb: '收件信息 + 运单条码 + 签收二维码',
    accent: '#1B8A5A'
  },
  {
    id: 'cable-name',
    name: '线缆分类标签',
    category: '办公',
    industry: '行业标识',
    size: [40, 12],
    kind: 'barcode',
    uses: 196,
    badge: null,
    blurb: '线缆型号 + 机柜位置 + 竖向条码',
    accent: '#0E7C86'
  },
  {
    id: 'serial-cable',
    name: '线号序列标签',
    category: '办公',
    industry: '行业标识',
    size: [30, 12],
    kind: 'barcode',
    uses: 88,
    badge: null,
    blurb: '自动递增序列号 + 位置说明',
    accent: '#0A6E78'
  },
  {
    id: 'asset-card',
    name: '固定资产标签',
    category: '办公',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 174,
    badge: null,
    blurb: '资产信息 + 序列号 + 盘点二维码',
    accent: '#3D5A80'
  },
  {
    id: 'business-card',
    name: '商务名片',
    category: '办公',
    industry: '内容设计',
    size: [50, 30],
    kind: 'qr',
    uses: 210,
    badge: '常用',
    blurb: '姓名职位 + 联系方式 + 电子名片码',
    accent: '#1D3557'
  },
  {
    id: 'wifi-code',
    name: 'Wi-Fi 码标签',
    category: '办公',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 165,
    badge: null,
    blurb: 'SSID/密码 + 标准 WIFI: 扫码连网',
    accent: '#457B9D'
  },
  {
    id: 'home-date',
    name: '食品日期标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 188,
    badge: null,
    blurb: '制作/保质日期 + 存放提示（打印时自动更新）',
    accent: '#E09F3E'
  },
  {
    id: 'shangyue-wish-card',
    name: '商跃心意祝福卡',
    category: '生活',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创留白排版 + 祝福语 + 心意二维码',
    accent: '#6C5CE7',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-price-tag',
    name: '商跃零售价签',
    category: '零售',
    industry: '行业标识',
    size: [40, 30],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创顶栏排版 + 售价/会员价 + EAN-13',
    accent: '#C45C26',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-price-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-bin-label',
    name: '商跃仓储货位',
    category: '仓储',
    industry: '行业标识',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创竖条货位 + 批次 + 入库二维码',
    accent: '#1F4E5F',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-bin-label-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-name-sticker',
    name: '商跃姓名贴',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 0,
    badge: '原创',
    blurb: '原创横条签名 + 班级部门 + 联系电话',
    accent: '#3D4A6B',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-name-sticker-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-fresh-date',
    name: '商跃效期签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 0,
    badge: '原创',
    blurb: '原创顶栏分区 + 制作/食用日期自动更新',
    accent: '#2F6B4F',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-fresh-date-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-wifi-card',
    name: '商跃连网码',
    category: '办公',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '授权改编',
    blurb: '左码右凭据的访客通行证',
    accent: '#355C7D',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-wifi-card-v1.png',
    thumbSha256: '2c7de8eae7063011c31e6ede73a88ddf0cbd2569ad297b3e2fb140b574cf3aa3',
    origin: 'shangyue-authorized-redesign',
    authorship: 'shangyue-independent-redesign',
    authorizationStatus: 'operator-confirmed-document-reference-pending',
    authorizedRedesign: true,
    copyright: '精诚授权改编 · 商跃重设计',
    approvedOriginal: false,
    approvalStatus: 'authorized',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-promo-tag',
    name: '商跃促销价签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 0,
    badge: '授权改编',
    blurb: '上置条码 + 右侧反白价格舱',
    accent: '#C0392B',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-promo-tag-v1.png',
    thumbSha256: 'e37550c265eb269e2eef97c7b4832dd999f899a957022e41a61174a2353a7c3f',
    origin: 'shangyue-authorized-redesign',
    authorship: 'shangyue-independent-redesign',
    authorizationStatus: 'operator-confirmed-document-reference-pending',
    authorizedRedesign: true,
    copyright: '精诚授权改编 · 商跃重设计',
    approvedOriginal: false,
    approvalStatus: 'authorized',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-jewelry-tag',
    name: '商跃珠宝吊牌',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创竖条金饰 + 克重编号 + Code128',
    accent: '#8D6E4C',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-jewelry-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-garment-tag',
    name: '商跃服装吊牌',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创顶栏成衣 + 款号尺码 + EAN-13',
    accent: '#5C4B73',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-garment-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-ship-label',
    name: '商跃物流简签',
    category: '仓储',
    industry: '行业标识',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创竖条流向 + 运单条码 + 签收二维码',
    accent: '#1B7A4E',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-ship-label-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-cable-tag',
    name: '商跃线缆标识',
    category: '办公',
    industry: '行业标识',
    size: [40, 12],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创窄条线号 + 机柜位置 + Code128',
    accent: '#0B6E75',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-cable-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-asset-tag',
    name: '商跃固定资产',
    category: '办公',
    industry: '行业标识',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创竖条资产 + 序列号 + 盘点二维码',
    accent: '#3A4F6B',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-asset-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-biz-card',
    name: '商跃商务名片',
    category: '办公',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创竖条名片 + 联系方式 + 电子名片码',
    accent: '#1A334F',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-biz-card-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-kitchen-date',
    name: '商跃餐饮效期',
    category: '生活',
    industry: '行业标识',
    size: [40, 30],
    kind: 'accent',
    uses: 0,
    badge: '授权改编',
    blurb: '双时间窗格 + 批次复核清单',
    accent: '#C45C3A',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-kitchen-date-v1.png',
    thumbSha256: 'f36ba52bdf09de0ef6c951b49c53bf24a993cef35f6ddcf81bdfc8187f1fed5a',
    origin: 'shangyue-authorized-redesign',
    authorship: 'shangyue-independent-redesign',
    authorizationStatus: 'operator-confirmed-document-reference-pending',
    authorizedRedesign: true,
    copyright: '精诚授权改编 · 商跃重设计',
    approvedOriginal: false,
    approvalStatus: 'authorized',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-med-label',
    name: '商跃药品签',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 0,
    badge: '原创',
    blurb: '原创用药顶栏 + 规格用法 + 有效期',
    accent: '#9B2D30',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-med-label-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-seat-card',
    name: '商跃席卡',
    category: '生活',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 0,
    badge: '原创',
    blurb: '原创留白席卡 + 新人姓名 + 桌号',
    accent: '#B07A7A',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-seat-card-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-bakery-tag',
    name: '商跃烘焙价签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创烘焙顶栏 + 口味规格 + EAN-13',
    accent: '#B06A4A',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-bakery-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-plant-tag',
    name: '商跃植物签',
    category: '生活',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 0,
    badge: '授权改编',
    blurb: '光水温三栏照护仪表',
    accent: '#2F6B4A',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-plant-tag-v1.png',
    thumbSha256: '68ee5309e64827b2eb61fdc61bc618f663c2952c18794af24a690a6ec279742c',
    origin: 'shangyue-authorized-redesign',
    authorship: 'shangyue-independent-redesign',
    authorizationStatus: 'operator-confirmed-document-reference-pending',
    authorizedRedesign: true,
    copyright: '精诚授权改编 · 商跃重设计',
    approvedOriginal: false,
    approvalStatus: 'authorized',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-desk-plate',
    name: '商跃工位牌',
    category: '办公',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 0,
    badge: '原创',
    blurb: '原创工位竖条 + 分机 + 企业码',
    accent: '#1A4332',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-desk-plate-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-lab-tag',
    name: '商跃样品签',
    category: '行业',
    industry: '行业标识',
    size: [40, 20],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创样品编号 + 日期 + 条码',
    accent: '#2C6BC9',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-lab-tag-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-care-tag',
    name: '商跃洗涤说明',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 0,
    badge: '授权改编',
    blurb: '面料侧栏 + 四格洗护参数',
    accent: '#5A5560',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-care-tag-v1.png',
    thumbSha256: 'ca14692e899f3ccd803acf52eb967d0cce207cd2dc82744c9479ed90fb058e87',
    origin: 'shangyue-authorized-redesign',
    authorship: 'shangyue-independent-redesign',
    authorizationStatus: 'operator-confirmed-document-reference-pending',
    authorizedRedesign: true,
    copyright: '精诚授权改编 · 商跃重设计',
    approvedOriginal: false,
    approvalStatus: 'authorized',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'shangyue-serial-cable',
    name: '商跃线号序列',
    category: '办公',
    industry: '行业标识',
    size: [30, 12],
    kind: 'barcode',
    uses: 0,
    badge: '原创',
    blurb: '原创窄条递增线号 + Code128',
    accent: '#0A5E66',
    thumbSrc: 'assets/shangyue-thumbs/shangyue-serial-cable-v1.png',
    origin: 'shangyue-original',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false
  },
  {
    id: 'catering-date',
    name: '餐饮效期标签',
    category: '生活',
    industry: '行业标识',
    size: [40, 30],
    kind: 'accent',
    uses: 156,
    badge: '热门',
    blurb: '厨房效期 + 制作时间 + 责任人',
    accent: '#E76F51'
  },
  {
    id: 'medicine-box',
    name: '药品收纳标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 129,
    badge: null,
    blurb: '药名规格用法 + 警示图标',
    accent: '#C1121F'
  },
  {
    id: 'state-grid',
    name: '电力计量标识',
    category: '行业',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 76,
    badge: null,
    blurb: '计量箱信息 + 表号条码 + 用电信息码',
    accent: '#0077B6'
  },
  {
    id: 'wedding-invite',
    name: '订婚婚礼席卡',
    category: '生活',
    industry: '内容设计',
    size: [50, 30],
    kind: 'accent',
    uses: 204,
    badge: '热门',
    blurb: '新人姓名 + 桌号 + 祝福语',
    accent: '#D4A5A5'
  },
  {
    id: 'bakery-tag',
    name: '烘焙店价签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 167,
    badge: '新品',
    blurb: '蛋糕名 + 口味规格 + 价格条码',
    accent: '#C97B63'
  },
  {
    id: 'fresh-cut',
    name: '省心净菜标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 143,
    badge: null,
    blurb: '净菜品名 + 分量 + 保质效期',
    accent: '#2A9D8F'
  },
  {
    id: 'name-tag',
    name: '姓名贴',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 289,
    badge: '常用',
    blurb: '姓名 + 班级/部门 + 联系电话',
    accent: '#4A6FA5'
  },
  {
    id: 'retail-shelf',
    name: '商品价签精简',
    category: '零售',
    industry: '行业标识',
    size: [50, 30],
    kind: 'barcode',
    uses: 301,
    badge: null,
    blurb: '货架价签：品名规格原价现价条码',
    accent: '#E63946'
  },
  {
    id: 'pharma-shelf',
    name: '医药价签精简',
    category: '零售',
    industry: '行业标识',
    size: [50, 30],
    kind: 'accent',
    uses: 188,
    badge: null,
    blurb: '药名规格厂家 + 零售价',
    accent: '#9B2226'
  },
  {
    id: 'warehouse-bin',
    name: '仓储料箱标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 112,
    badge: null,
    blurb: '料箱号 + 物料编码 + 库存二维码',
    accent: '#264653'
  },
  {
    id: 'express-waybill',
    name: '快递面单简签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 40],
    kind: 'barcode',
    uses: 95,
    badge: null,
    blurb: '收寄件 + 运单号条码',
    accent: '#E9C46A'
  },
  {
    id: 'cable-pair',
    name: '线缆对线标签',
    category: '办公',
    industry: '行业标识',
    size: [40, 12],
    kind: 'barcode',
    uses: 77,
    badge: null,
    blurb: 'A/B 端线号 + 回路说明',
    accent: '#118AB2'
  },
  {
    id: 'expiry-batch',
    name: '效期批次标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 151,
    badge: null,
    blurb: '批次号 + 生产/失效日期',
    accent: '#F4A261'
  },
  {
    id: 'promo-burst',
    name: '促销爆炸贴',
    category: '零售',
    industry: '内容设计',
    size: [40, 40],
    kind: 'accent',
    uses: 220,
    badge: '热门',
    blurb: '大字特价 + 折扣角标',
    accent: '#FF6B6B'
  },
  {
    id: 'jewelry-mini',
    name: '珠宝小吊牌',
    category: '零售',
    industry: '内容设计',
    size: [30, 20],
    kind: 'barcode',
    uses: 84,
    badge: null,
    blurb: '材质克重编号迷你签',
    accent: '#B08968'
  },
  {
    id: 'garment-care',
    name: '服装洗涤说明',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 99,
    badge: null,
    blurb: '面料成分 + 洗涤图标文字',
    accent: '#6D6875'
  },
  {
    id: 'med-storage',
    name: '药品柜位标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 71,
    badge: null,
    blurb: '柜位 + 药名 + 数量',
    accent: '#AE2012'
  },
  {
    id: 'office-desk',
    name: '工位姓名牌',
    category: '办公',
    industry: '内容设计',
    size: [50, 30],
    kind: 'qr',
    uses: 133,
    badge: null,
    blurb: '姓名部门 + 分机号 + 企业码',
    accent: '#1B4332'
  },
  {
    id: 'lab-sample',
    name: '实验室样品签',
    category: '行业',
    industry: '行业标识',
    size: [40, 20],
    kind: 'barcode',
    uses: 62,
    badge: null,
    blurb: '样品编号 + 日期 + 条码',
    accent: '#3A86FF'
  },
  {
    id: 'plant-care',
    name: '园艺植物标签',
    category: '生活',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 108,
    badge: '新品',
    blurb: '植物名 + 浇水日照提示',
    accent: '#40916C'
  },
  ...ORIGINAL_SCENARIO_TEMPLATES,
  ...CLEANROOM_TEMPLATE_PACK
];

const classifiedBaseTemplates = baseTemplates.map((item) => {
  const approvedOriginal = item.approvedOriginal === true && item.origin === 'shangyue-original';
  const authorizedRedesign = item.authorizedRedesign === true
    && item.origin === 'shangyue-authorized-redesign'
    && item.authorizationStatus === 'documentary-approved';
  const publicApproved = approvedOriginal || authorizedRedesign;
  return Object.assign({}, item, {
    source: approvedOriginal
      ? 'shangyue-original'
      : authorizedRedesign ? 'shangyue-authorized-redesign' : 'builtin-base',
    origin: publicApproved ? item.origin : 'builtin-base',
    approvedOriginal,
    authorizedRedesign,
    approvalStatus: approvedOriginal ? 'approved' : authorizedRedesign ? 'authorized' : 'pending-review',
    publicCatalog: publicApproved,
    releaseApproved: publicApproved,
    batchCompatible: !publicApproved
  });
});

const APPROVED_ORIGINAL_TEMPLATES = Object.freeze(
  classifiedBaseTemplates.filter((item) => item.approvedOriginal)
);
const APPROVED_AUTHORIZED_REDESIGN_TEMPLATES = Object.freeze(
  classifiedBaseTemplates.filter((item) => item.authorizedRedesign)
);
const PUBLIC_TEMPLATES = Object.freeze(
  classifiedBaseTemplates.filter((item) => item.publicCatalog === true && item.releaseApproved === true)
);
const BUILTIN_BASE_TEMPLATES = Object.freeze(
  classifiedBaseTemplates.filter((item) => item.publicCatalog !== true)
);

const templates = PUBLIC_TEMPLATES;

const categories = ['全部', '零售', '仓储', '办公', '生活', '行业'];

const industries = ['全部', '行业标识', '内容设计', '实用功能'];

const homeQuickActions = [
  { id: 'industry', label: '行业模板', action: 'open-industry', icon: 'template', tone: 'red' },
  { id: 'card', label: '名片', action: 'preview-template', templateId: 'shangyue-biz-card', icon: 'user', tone: 'blue' },
  { id: 'clothing', label: '服装款式', action: 'preview-template', templateId: 'shangyue-garment-tag', icon: 'stamp', tone: 'orange' },
  { id: 'date', label: '效期标签', action: 'preview-template', templateId: 'shangyue-fresh-date', icon: 'calendar', tone: 'yellow' }
];

function getTemplate(id) {
  return templates.find((item) => item.id === id)
    || BUILTIN_BASE_TEMPLATES.find((item) => item.id === id)
    || null;
}

function templatesByCategory(category) {
  if (!category || category === '全部') return templates.slice();
  return templates.filter((item) => item.category === category);
}

function templatesByIndustry(industry) {
  if (!industry || industry === '全部') return templates.slice();
  return templates.filter((item) => item.industry === industry);
}

module.exports = {
  APPROVED_AUTHORIZED_REDESIGN_TEMPLATES,
  APPROVED_ORIGINAL_TEMPLATES,
  BATCH_TEMPLATES: BUILTIN_BASE_TEMPLATES,
  BUILTIN_BASE_TEMPLATES,
  PUBLIC_TEMPLATES,
  categories,
  industries,
  templates,
  homeQuickActions,
  getTemplate,
  templatesByCategory,
  templatesByIndustry
};
