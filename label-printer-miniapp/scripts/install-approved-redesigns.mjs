import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { normalizeDocument } = require('../miniprogram/services/repository');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const batchDir = path.resolve(option('--batch-dir', path.join(root, '..', 'output', 'shangyue-redesign', 'batch')));
const approvedFile = path.resolve(option('--approved', path.join(root, '..', 'output', 'shangyue-redesign', 'approved-ids.txt')));
const outFile = path.resolve(option('--out', path.join(root, '..', 'output', 'shangyue-redesign', 'approved-pack.json')));
const packName = option('--name', '商跃重设计 · 已批准候选包');

const candidatesDir = path.join(batchDir, 'candidates');
if (!fs.existsSync(candidatesDir)) throw new Error(`找不到候选分片目录：${candidatesDir}，请先运行 batch-redesign.mjs`);
if (!fs.existsSync(approvedFile)) {
  throw new Error(`找不到批准清单：${approvedFile}\n请创建该文件，每行一个候选 ID（sy-redesign-…）或来源 ID，# 开头为注释。`);
}

const approvedLines = fs.readFileSync(approvedFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const wanted = new Set(approvedLines);
if (!wanted.size) throw new Error('批准清单为空：没有可安装的候选。');

const matched = new Map();
const chunkFiles = fs.readdirSync(candidatesDir).filter((file) => file.endsWith('.json')).sort();
for (const file of chunkFiles) {
  const chunk = JSON.parse(fs.readFileSync(path.join(candidatesDir, file), 'utf8'));
  for (const plan of chunk.plans || []) {
    const keys = [plan.catalogMeta && plan.catalogMeta.id, plan.profile && plan.profile.sourceId].filter(Boolean);
    const hit = keys.find((key) => wanted.has(key));
    if (!hit || matched.has(plan.catalogMeta.id)) continue;
    matched.set(plan.catalogMeta.id, plan);
  }
}

const templates = [];
const invalid = [];
for (const plan of matched.values()) {
  const document = normalizeDocument(plan.document);
  if (!document) {
    invalid.push(plan.catalogMeta.id);
    continue;
  }
  templates.push({
    id: plan.catalogMeta.id,
    name: plan.catalogMeta.name,
    scene: plan.catalogMeta.scene,
    size: plan.catalogMeta.size,
    sourceId: plan.profile.sourceId,
    sourceLabel: plan.profile.sourceLabel,
    structuralDistance: plan.audit.structuralDistance,
    document
  });
}

const matchedKeys = new Set();
for (const plan of matched.values()) {
  matchedKeys.add(plan.catalogMeta.id);
  matchedKeys.add(plan.profile.sourceId);
}
const missing = approvedLines.filter((line) => !matchedKeys.has(line));

const pack = {
  schemaVersion: 1,
  kind: 'shangyue-template-pack',
  name: packName,
  generatedAt: new Date().toISOString(),
  policy: {
    origin: 'shangyue-authorized-redesign-review',
    publicCatalog: false,
    releaseApproved: false,
    note: '本包用于导入“我的模板”本机使用与评审；对外货架发布仍需书面授权凭证归档与登记。'
  },
  count: templates.length,
  templates
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(pack)}\n`);
console.log(JSON.stringify({
  outFile,
  approvedRequested: approvedLines.length,
  installed: templates.length,
  invalidDocuments: invalid,
  unmatchedIds: missing.slice(0, 20),
  unmatchedCount: missing.length
}, null, 2));
