import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildDocument, buildOwnedLibraryIndex } = require('../miniprogram/app/shangyue-library/factory');
const { ownedLibraryShape } = require('../miniprogram/app/shangyue-library/classify');
const { auditLibrary } = require('../miniprogram/app/shangyue-library/quality');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outReview = path.join(root, '..', 'output', 'shangyue-library');

const entries = buildOwnedLibraryIndex();
const shape = ownedLibraryShape();
if (entries.length !== shape.total) {
  throw new Error(`owned library size ${entries.length} != shape ${shape.total}`);
}

fs.mkdirSync(outReview, { recursive: true });
fs.writeFileSync(path.join(outReview, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);

const scenes = {};
const sizes = {};
const skeletons = new Set();
const variantGroups = new Map();
entries.forEach((entry) => {
  scenes[entry.scene] = (scenes[entry.scene] || 0) + 1;
  const key = `${entry.widthMm}×${entry.heightMm}`;
  sizes[key] = (sizes[key] || 0) + 1;
  const document = buildDocument(entry);
  const skeleton = JSON.stringify(document.elements.map((element) => ({
    type: element.type,
    x: Number(element.x.toFixed(3)),
    y: Number(element.y.toFixed(3)),
    width: Number(element.width.toFixed(3)),
    height: Number(element.height.toFixed(3)),
    filled: element.filled === true,
    align: element.align || 'left',
    reverse: element.reverse === true,
    dateRole: element.dateRole || ''
  })));
  skeletons.add(skeleton);
  const groupKey = [entry.scene, entry.item, entry.widthMm, entry.heightMm].join('|');
  if (!variantGroups.has(groupKey)) variantGroups.set(groupKey, new Set());
  variantGroups.get(groupKey).add(skeleton);
});

const variantCollisionGroups = [...variantGroups.values()]
  .filter((variants) => variants.size !== ownedLibraryShape().variants)
  .length;
const quality = auditLibrary(entries, buildDocument);
if (!quality.ok) {
  throw new Error(`library quality gate failed: ${quality.totals.documentErrors} document errors, ${quality.totals.batchErrors} batch errors`);
}

const stats = {
  total: entries.length,
  countMeaning: 'scene × paper × copy × layout variant entries; not individually hand-drawn works',
  designSystem: 'sy-semantic-grid-v2',
  designVersion: '2.0.0',
  aiAssisted: true,
  uniqueScenes: Object.keys(scenes).length,
  uniqueSizes: Object.keys(sizes).length,
  uniqueLayoutSkeletons: skeletons.size,
  variantGroups: variantGroups.size,
  variantCollisionGroups,
  quality: {
    hardErrors: quality.totals.documentErrors + quality.totals.batchErrors,
    reviewWarnings: quality.totals.documentWarnings + quality.totals.batchWarnings,
    documentsWithWarnings: quality.reports.filter((report) => report.warnings > 0).length,
    structuralFingerprints: quality.diversity.uniqueStructures,
    exactDuplicateGroups: quality.diversity.exactDuplicateGroups,
    maxStructureReuse: quality.diversity.maxStructureReuse
  },
  shape,
  scenes,
  topSizes: Object.entries(sizes).sort((left, right) => right[1] - left[1]).slice(0, 20)
};
fs.writeFileSync(path.join(outReview, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

fs.writeFileSync(outReview + path.sep + 'README.md', `# 商跃行业库

- 组合预设条目：${entries.length}
- 场景/文案/纸张组：${variantGroups.size}，每组甲乙丙 3 个不同构图
- 去除文案与 ID 后的布局骨架：${skeletons.size}
- 场景：${Object.keys(scenes).length} 类
- 纸张：${Object.keys(sizes).length} 种
- 生成方式：商跃自有场景 × 常用纸张 × 自有占位品名 × 版式变体，不读取第三方目录
- 设计系统：\`sy-semantic-grid-v2\`（AI 辅助语义排版，三套命名母版）
- 自动质量门：${quality.totals.documentErrors + quality.totals.batchErrors} 个硬错误；${quality.reports.filter((report) => report.warnings > 0).length} 张进入人工留白复核
- 码区策略：只在有扫描语义的场景出现；演示商品码统一为短 Code 128，不制造 EAN 商品号
- 应用模块：\`label-printer-miniapp/miniprogram/app/shangyue-library/\`
- 运行时由矩阵规则生成索引，不把 8,100 行静态 JSON 塞入小程序主包
- 不并入已过审的 22 套商跃货架

> ${entries.length} 是可筛选的组合预设条目数，不代表 ${entries.length} 张人工逐张设计的作品。

对照样张见 \`samples/\`。
`);

console.log(JSON.stringify(stats, null, 2));
