/**
 * First-party Shangyue scenes. Paper sizes and copy are owned here;
 * nothing is read from a third-party catalog at runtime.
 */
const SCENES = Object.freeze([
  { id: 'price', category: '零售', title: '商跃价签' },
  { id: 'date', category: '生活', title: '商跃效期' },
  { id: 'name', category: '办公', title: '商跃名牌' },
  { id: 'wifi', category: '办公', title: '商跃连网' },
  { id: 'wish', category: '生活', title: '商跃祝福' },
  { id: 'warehouse', category: '仓储', title: '商跃仓储' },
  { id: 'cable', category: '办公', title: '商跃线缆' },
  { id: 'jewelry', category: '零售', title: '商跃金饰' },
  { id: 'garment', category: '零售', title: '商跃成衣' },
  { id: 'ship', category: '仓储', title: '商跃物流' },
  { id: 'medicine', category: '生活', title: '商跃用药' },
  { id: 'card', category: '办公', title: '商跃名片' },
  { id: 'seat', category: '生活', title: '商跃席卡' },
  { id: 'bakery', category: '零售', title: '商跃烘焙' },
  { id: 'plant', category: '生活', title: '商跃园艺' },
  { id: 'lab', category: '行业', title: '商跃样品' },
  { id: 'asset', category: '办公', title: '商跃资产' },
  { id: 'queue', category: '办公', title: '商跃排号' },
  { id: 'note', category: '办公', title: '商跃备忘' },
  { id: 'cert', category: '行业', title: '商跃合格证' },
  { id: 'material', category: '行业', title: '商跃物料' },
  { id: 'cup', category: '零售', title: '商跃杯贴' },
  { id: 'seal', category: '零售', title: '商跃封口' },
  { id: 'office', category: '办公', title: '商跃办公' },
  { id: 'info', category: '行业', title: '商跃信息' }
]);

const OWNED_PAPERS = Object.freeze([
  [30, 12], [40, 12], [50, 12],
  [30, 15], [40, 15], [50, 15],
  [30, 20], [40, 20], [50, 20],
  [40, 25], [50, 25],
  [30, 30], [40, 30], [50, 30],
  [40, 40], [50, 40],
  [40, 50], [50, 50]
]);

const OWNED_VARIANT_MARKS = Object.freeze(['甲', '乙', '丙']);

const ITEM_POOLS = {
  price: ['青提', '黄瓜', '水杯', '短袖', '饼干', '山核桃'],
  date: ['桂花酿', '酸奶', '肉酱', '蓝莓', '豆浆', '净菜'],
  name: ['林晓舟', '周衡', '赵敏', '陈思远', '王厨', '张工'],
  wifi: ['访客网络', '会议网络', '店内网络', '仓储网络', '办公网络', '展厅网络'],
  wish: ['生日快乐', '新春如意', '旅途平安', '常欢喜', '学业有成', '一路顺风'],
  warehouse: ['A-12-08', '冷链区', '紧固件区', 'BIN-08', '拣货口', '退货区'],
  cable: ['CAT6', '光纤', '照明支路', '配电 A', '弱电桥', '备用回路'],
  jewelry: ['18K 手链', '银耳钉', '金项链', '珍珠戒', '玉坠', '银手镯'],
  garment: ['直筒牛仔裤', '棉质衬衫', '针织开衫', '亚麻长裙', '卫衣', '工装裤'],
  ship: ['华东仓', '滨江库', '易碎件', '周转箱', '同城件', '冷链件'],
  medicine: ['感冒颗粒', '维生素 C', '碘伏棉棒', '创口贴', '生理盐水', '棉签'],
  card: ['周衡', '赵敏', '林晓舟', '张工', '陈思远', '王厨'],
  seat: ['桌号 08', '桌号 12', '迎宾席', '主桌', '桌号 03', '亲友席'],
  bakery: ['芒果奶油', '原味吐司', '巧克力泡芙', '抹茶卷', '葡式蛋挞', '咸可颂'],
  plant: ['粉色郁金香', '绿萝', '多肉', '薄荷', '吊兰', '蔷薇'],
  lab: ['S-081', 'S-204', '留样 A', '室温样', '冷藏样', '对照样'],
  asset: ['笔记本', '显示器', '标签机', '会议平板', '扫码枪', '路由器'],
  queue: ['A012', 'B008', '取件 16', '等候 3', 'C021', '窗口 2'],
  note: ['今日待办', '货架整理', '必需品', '待处理', '周计划', '交接事项'],
  cert: ['质检合格', '抽检通过', '批次放行', '出厂检', '复检通过', '来料检'],
  material: ['M6 螺栓', '标签纸', '铜线', '轴承', '垫片', '扎带'],
  cup: ['柚子茶', '梅子饮', '美式', '牛乳茶', '柠檬水', '可可'],
  seal: ['手工点心', '伴手礼', '密封口', '当日鲜', '冷藏口', '礼盒'],
  office: ['会议室', '前台', '档案柜', '文具', '打印角', '茶水间'],
  info: ['规格说明', '产品简介', '使用须知', '存放提示', '保养说明', '安全提示']
};

const RULES = [
  [/价签|标价/, 'price'],
  [/效期|日期|保质|留样/, 'date'],
  [/姓名|名牌|人员|工位/, 'name'],
  [/wifi|wi-?fi|连网/i, 'wifi'],
  [/祝福|生日|圣诞|新年/, 'wish'],
  [/仓库|货架|货位|仓储/, 'warehouse'],
  [/线缆|线号/, 'cable'],
  [/珠宝|金饰|钻石/, 'jewelry'],
  [/服装|吊牌|服饰|洗涤/, 'garment'],
  [/物流|快递|面单/, 'ship'],
  [/药|服药|医院/, 'medicine'],
  [/名片/, 'card'],
  [/席卡|婚礼/, 'seat'],
  [/烘焙|蛋糕|面包/, 'bakery'],
  [/植物|花店|园艺/, 'plant'],
  [/样品|实验|检测/, 'lab'],
  [/资产/, 'asset'],
  [/排号|取号|取件/, 'queue'],
  [/备忘|待办/, 'note'],
  [/合格证|质检/, 'cert'],
  [/物料|器械/, 'material'],
  [/杯贴|外卖/, 'cup'],
  [/封口/, 'seal'],
  [/办公/, 'office'],
  [/规格|品名|信息/, 'info']
];

function sceneById(id) {
  return SCENES.find((scene) => scene.id === id) || SCENES[SCENES.length - 1];
}

function classifyScene(rawName) {
  const name = String(rawName || '').trim();
  for (const [pattern, sceneId] of RULES) {
    if (pattern.test(name)) {
      const scene = sceneById(sceneId);
      return { scene: scene.id, category: scene.category, title: scene.title };
    }
  }
  const fallback = sceneById('info');
  return { scene: fallback.id, category: fallback.category, title: fallback.title };
}

function pickItem(scene, index) {
  const pool = ITEM_POOLS[scene] || ITEM_POOLS.info;
  return pool[index % pool.length];
}

function kindFor(scene, widthMm, heightMm) {
  if (scene === 'wifi' || scene === 'warehouse' || scene === 'asset' || scene === 'card' || scene === 'ship') {
    return heightMm >= 22 && widthMm >= 28 ? 'qr' : 'accent';
  }
  if (scene === 'price' || scene === 'garment' || scene === 'bakery' || scene === 'jewelry' || scene === 'cup') {
    return widthMm >= 28 && heightMm >= 18 ? 'barcode' : 'accent';
  }
  if (scene === 'cable' || scene === 'lab') return widthMm >= 26 ? 'barcode' : 'accent';
  return 'accent';
}

function sceneTitles() {
  return SCENES.map((scene) => scene.title);
}

function ownedLibraryShape() {
  const items = ITEM_POOLS.price.length;
  return {
    scenes: SCENES.length,
    papers: OWNED_PAPERS.length,
    items,
    variants: OWNED_VARIANT_MARKS.length,
    total: SCENES.length * OWNED_PAPERS.length * items * OWNED_VARIANT_MARKS.length,
    perScene: OWNED_PAPERS.length * items * OWNED_VARIANT_MARKS.length,
    perSize: SCENES.length * items * OWNED_VARIANT_MARKS.length
  };
}

module.exports = {
  ITEM_POOLS,
  OWNED_PAPERS,
  OWNED_VARIANT_MARKS,
  RULES,
  SCENES,
  classifyScene,
  kindFor,
  ownedLibraryShape,
  pickItem,
  sceneById,
  sceneTitles
};
