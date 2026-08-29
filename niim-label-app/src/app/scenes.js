/**
 * User-facing business scenarios for discovering templates.
 *
 * These are product taxonomy, not copied template metadata. A template may
 * serve more than one scenario (for example a bakery price tag is both retail
 * and food/expiry), which makes browsing forgiving without duplicating cards.
 */
const SCENE_DEFINITIONS = Object.freeze([
  {
    id: 'retail',
    label: '门店零售',
    description: '价格、促销、烘焙',
    icon: 'barcode',
    tone: 'red',
    pattern: /零售|商品|价签|价格|售价|会员|促销|烘焙|货架价|称重|收银/i
  },
  {
    id: 'warehouse',
    label: '仓储物流',
    description: '货位、周转、资产',
    icon: 'database',
    tone: 'blue',
    pattern: /仓储|货位|物流|周转|快递|运单|库位|入库|出库|盘点|固定资产|资产/i
  },
  {
    id: 'expiry',
    label: '食品效期',
    description: '制作、保质、冷藏',
    icon: 'calendar',
    tone: 'yellow',
    pattern: /效期|日期|食品|餐饮|厨房|药品|冷藏|保质|制作|食用|开封|鲜食|烘焙/i
  },
  {
    id: 'fashion',
    label: '服装珠宝',
    description: '吊牌、尺码、洗护',
    icon: 'stamp',
    tone: 'purple',
    pattern: /服装|成衣|衣物|珠宝|首饰|金饰|吊牌|尺码|洗涤|洗护|面料|鞋帽/i
  },
  {
    id: 'equipment',
    label: '设备线缆',
    description: '线号、机柜、样品',
    icon: 'settings',
    tone: 'teal',
    pattern: /线缆|线号|设备|电力|实验室|样品|仪表|机柜|端口|工具|巡检|校准/i
  },
  {
    id: 'office-life',
    label: '办公生活',
    description: '名片、姓名贴、Wi-Fi',
    icon: 'user',
    tone: 'green',
    pattern: /办公|生活|名片|姓名|工位|席卡|植物|祝福|Wi-?Fi|连网|访客|收纳|学校/i
  }
]);

const SCENE_BY_ID = new Map(SCENE_DEFINITIONS.map((scene) => [scene.id, scene]));
const SCENE_GROUP_IDS = Object.freeze({
  '零售价签': 'retail',
  '仓储资产': 'warehouse',
  '食品效期': 'expiry',
  '服装珠宝': 'fashion',
  '线缆设备': 'equipment',
  '办公生活': 'office-life'
});

function templateSearchText(template) {
  const item = template || {};
  return [
    item.name,
    item.category,
    item.industry,
    item.blurb,
    item.scene,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).join(' ');
}

function templateSpecificText(template) {
  const item = template || {};
  return [
    item.name,
    item.blurb,
    item.scene,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).join(' ');
}

function sceneIdsForTemplate(template) {
  const declaredGroup = template && SCENE_GROUP_IDS[template.scenarioGroup];
  const explicit = Array.isArray(template && template.sceneIds)
    ? template.sceneIds.filter((id) => SCENE_BY_ID.has(id))
    : [];
  const specificText = templateSpecificText(template);
  const text = templateSearchText(template);
  const specificInferred = SCENE_DEFINITIONS
    .filter((scene) => scene.pattern.test(specificText))
    .map((scene) => scene.id);
  const inferred = SCENE_DEFINITIONS
    .filter((scene) => scene.pattern.test(text))
    .map((scene) => scene.id);
  const ids = Array.from(new Set([declaredGroup, ...explicit, ...specificInferred, ...inferred].filter(Boolean)));
  return ids.length ? ids : ['office-life'];
}

function sceneForId(id) {
  return SCENE_BY_ID.get(id) || null;
}

function templateMatchesScene(template, sceneId) {
  return !sceneId || sceneId === '全部' || sceneIdsForTemplate(template).includes(sceneId);
}

function countTemplatesByScene(templates) {
  const source = Array.isArray(templates) ? templates : [];
  return Object.fromEntries(SCENE_DEFINITIONS.map((scene) => [
    scene.id,
    source.filter((template) => templateMatchesScene(template, scene.id)).length
  ]));
}

module.exports = {
  SCENE_DEFINITIONS,
  countTemplatesByScene,
  sceneForId,
  sceneIdsForTemplate,
  templateMatchesScene
};
