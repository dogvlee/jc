import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const input = process.argv[2];

if (!input) {
  console.error('用法：node scripts/check-shangyue-release.mjs <待上传的小程序根目录>');
  process.exit(2);
}

const releaseRoot = path.resolve(process.cwd(), input);
if (!fs.existsSync(releaseRoot) || !fs.statSync(releaseRoot).isDirectory()) {
  console.error(`发布目录不存在：${releaseRoot}`);
  process.exit(2);
}

const forbiddenPaths = [
  'app/imported-templates.js',
  'app/online-template-runtime-fixes.js',
  'app/online-templates-pack.js',
  'assets/materials/original/',
  'assets/online-images/',
  'assets/online-thumbs/',
  'data/niim-templates/',
  'data/original-materials.json',
  'services/authorized-template-catalog.js'
];

const forbiddenText = [
  ['固定第三方模板域名', /(?:oss-print\.)?niimbot\.com/i]
];

const textExtensions = new Set(['.js', '.json', '.wxml', '.wxss', '.html', '.md']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) files.push(absolute);
  }
}

walk(releaseRoot);

const relativeFiles = files.map((file) => path.relative(releaseRoot, file).replaceAll('\\', '/'));
const failures = [];

for (const blocked of forbiddenPaths) {
  const target = path.join(releaseRoot, blocked.replace(/\/$/, ''));
  if (fs.existsSync(target)) failures.push(`禁止随公开包分发：${blocked}`);
}

for (let index = 0; index < files.length; index += 1) {
  const file = files[index];
  const relative = relativeFiles[index];
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of forbiddenText) {
    if (pattern.test(content)) failures.push(`${label}：${relative}`);
  }
}

const catalogPath = path.join(releaseRoot, 'app', 'catalog.js');
const layoutsPath = path.join(releaseRoot, 'app', 'template-layouts.js');
const libraryPath = path.join(releaseRoot, 'app', 'shangyue-library', 'pack.js');
const libraryQualityPath = path.join(releaseRoot, 'app', 'shangyue-library', 'quality.js');
const materialsPath = path.join(releaseRoot, 'core', 'materials.js');
const materialSymbolsPath = path.join(releaseRoot, 'core', 'material-symbols-v2.js');

try {
  delete require.cache[require.resolve(catalogPath)];
  delete require.cache[require.resolve(layoutsPath)];
  const catalog = require(catalogPath);
  const layouts = require(layoutsPath);
  const templates = Array.isArray(catalog.templates) ? catalog.templates : [];

  if (!templates.length) failures.push('公开包至少需要一个已过审模板');

  for (const template of templates) {
    const isOriginal = template.origin === 'shangyue-original'
      && template.source === 'shangyue-original'
      && template.approvedOriginal === true;
    const isAuthorizedRedesign = template.origin === 'shangyue-authorized-redesign'
      && template.source === 'shangyue-authorized-redesign'
      && template.authorizedRedesign === true
      && template.approvedOriginal === false
      && template.authorizationStatus === 'operator-confirmed-document-reference-pending'
      && /授权改编/.test(String(template.copyright || ''));
    if (template.releaseApproved !== true || (!isOriginal && !isAuthorizedRedesign)) {
      failures.push(`模板未通过商跃公开门禁：${template.id || 'unknown'}`);
      continue;
    }
    if (!String(template.thumbSrc || '').startsWith('assets/shangyue-thumbs/')) {
      failures.push(`公开模板缩略图未使用商跃资源目录：${template.id}`);
    }

    const documentValue = layouts.buildTemplateDocument(template);
    const meta = documentValue && documentValue.templateMeta;
    const documentOriginValid = isOriginal
      ? meta && meta.origin === 'shangyue-original' && meta.approvedOriginal === true
      : meta
        && meta.origin === 'shangyue-authorized-redesign'
        && meta.authorizedRedesign === true
        && meta.approvedOriginal === false
        && /授权改编/.test(String(meta.copyright || ''));
    if (!documentOriginValid || meta.thirdPartyAssets !== false || meta.releaseApproved !== true) {
      failures.push(`文档来源或发布元数据不完整：${template.id}`);
    }
    for (const element of (documentValue && documentValue.elements) || []) {
      const asset = String(element.path || '');
      if (asset && !asset.startsWith('assets/shangyue-')) {
        failures.push(`模板引用未批准资源：${template.id} -> ${asset}`);
      }
    }
  }

  delete require.cache[require.resolve(libraryPath)];
  const library = require(libraryPath);
  const entries = Array.isArray(library.LIBRARY_INDEX) ? library.LIBRARY_INDEX : [];
  if (entries.length !== 8100 || new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    failures.push(`商跃行业库索引异常：${entries.length} entries`);
  }
  for (const entry of entries) {
    const item = library.catalogMeta(entry);
    if (item.origin !== 'shangyue-library'
      || item.source !== 'shangyue-library'
      || item.approvedOriginal !== false
      || item.publicCatalog !== true
      || item.releaseApproved !== true
      || item.designSystem !== 'sy-semantic-grid-v2'
      || item.aiAssisted !== true) {
      failures.push(`行业库条目未通过公开门禁：${entry.id || 'unknown'}`);
      continue;
    }
    const documentValue = library.buildLibraryDocument(entry.id);
    const meta = documentValue && documentValue.templateMeta;
    if (!meta
      || meta.origin !== 'shangyue-library'
      || meta.thirdPartyAssets !== false
      || meta.releaseApproved !== true
      || meta.designSystem !== 'sy-semantic-grid-v2'
      || meta.aiAssisted !== true
      || meta.sourceTemplateId !== null
      || (documentValue.elements || []).some((element) => (
        ['image', 'material'].includes(element.type) || Boolean(element.path)
      ))) {
      failures.push(`行业库文档来源或资源异常：${entry.id || 'unknown'}`);
    }
  }
  delete require.cache[require.resolve(libraryQualityPath)];
  const quality = require(libraryQualityPath);
  const audit = quality.auditLibrary(entries, (entry) => library.buildLibraryDocument(entry.id));
  if (!audit.ok) {
    failures.push(`商跃行业库质量门失败：${audit.totals.documentErrors} document errors / ${audit.totals.batchErrors} batch errors`);
  }
  if (audit.diversity.exactDuplicateGroups !== 0
    || audit.diversity.variantCollisionGroups !== 0
    || audit.diversity.uniqueStructures < 680
    || audit.diversity.maxStructureReuse > 110) {
    failures.push(`商跃行业库多样性门失败：${audit.diversity.uniqueStructures} structures / max reuse ${audit.diversity.maxStructureReuse}`);
  }

  delete require.cache[require.resolve(materialsPath)];
  delete require.cache[require.resolve(materialSymbolsPath)];
  const materials = require(materialsPath);
  const materialSymbols = require(materialSymbolsPath);
  const symbolIds = Array.isArray(materialSymbols.SHANGYUE_MATERIAL_SYMBOL_IDS)
    ? materialSymbols.SHANGYUE_MATERIAL_SYMBOL_IDS
    : [];
  const ownedMaterials = (materials.MATERIAL_CATALOG || []).filter((item) => item.source === 'shangyue-vector-v2');
  const ownedIds = new Set(ownedMaterials.map((item) => item.id));
  if (symbolIds.length !== 76
    || new Set(symbolIds).size !== 76
    || ownedMaterials.length !== 76
    || symbolIds.some((id) => !ownedIds.has(id))
    || ownedMaterials.some((item) => item.vector !== true || item.raster !== false || !(item.tags || []).includes('商跃'))) {
    failures.push(`商跃矢量素材门失败：${symbolIds.length} paths / ${ownedMaterials.length} catalog entries`);
  }
} catch (error) {
  failures.push(`无法检查公开模板目录：${error.message}`);
}

const uniqueFailures = [...new Set(failures)];
if (uniqueFailures.length) {
  console.error(`商跃公开包门禁失败（${uniqueFailures.length} 项）：`);
  uniqueFailures.slice(0, 30).forEach((item) => console.error(`- ${item}`));
  if (uniqueFailures.length > 30) console.error(`- 其余 ${uniqueFailures.length - 30} 项已省略`);
  process.exitCode = 1;
} else {
  const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  console.log(`商跃公开包门禁通过：${files.length} files / ${totalBytes} bytes`);
}
