import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  normalizeAuthorization,
  planAuthorizedRedesign
} = require('./lib/authorized-redesign');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const input = path.resolve(option(
  '--input',
  path.join(root, '..', 'niim-label-app', 'research', 'authorized-catalog-full', 'collections', 'templates.json')
));
const outDir = path.resolve(option('--out-dir', path.join(root, '..', 'output', 'shangyue-redesign', 'batch')));
const chunkSize = Math.max(50, Number(option('--chunk-size', '250')) || 250);
const limitRaw = Number(option('--limit', '0'));
const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 0;

if (!fs.existsSync(input)) throw new Error(`爬取模板输入不存在：${input}`);

const inputBuffer = fs.readFileSync(input);
const payload = JSON.parse(inputBuffer.toString('utf8'));
const records = Array.isArray(payload.records) ? payload.records : [];
const authorization = normalizeAuthorization(payload.authorization);
const sourceProvider = payload.sourceProvider
  || (payload.source && payload.source.provider)
  || payload.provider
  || payload.kind
  || payload.sourceMethod
  || 'unspecified-input';
const planContext = { authorization: payload.authorization, sourceProvider };
const selected = limit ? records.slice(0, limit) : records;

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'candidates'), { recursive: true });

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sourcePreview(record) {
  return String(record.previewImage || record.thumbnail || record.contentThumbnail || '').slice(0, 500);
}

const startedAt = Date.now();
const statusCounts = {};
const sceneCounts = {};
const distanceBuckets = { 'lt-0.25': 0, '0.25-0.5': 0, '0.5-0.75': 0, 'gte-0.75': 0, 'not-comparable': 0 };
const gateCounts = {};
const reviewRows = [
  ['reviewStatus', 'structuralDistance', 'scene', 'widthMm', 'heightMm', 'sourceId', 'sourceLabel',
    'candidateId', 'candidateName', 'gateReasons', 'sourcePreviewUrl'].join(',')
];
const needsReview = [];
let candidateChunk = [];
let chunkIndex = 0;
let processed = 0;

function flushCandidates(force) {
  if (!candidateChunk.length || (!force && candidateChunk.length < chunkSize)) return;
  const file = path.join(outDir, 'candidates', `candidates-${String(chunkIndex).padStart(3, '0')}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ chunk: chunkIndex, count: candidateChunk.length, plans: candidateChunk })}\n`);
  chunkIndex += 1;
  candidateChunk = [];
}

for (const record of selected) {
  const plan = planAuthorizedRedesign(record, planContext);
  processed += 1;
  statusCounts[plan.reviewStatus] = (statusCounts[plan.reviewStatus] || 0) + 1;
  sceneCounts[plan.profile.scene] = (sceneCounts[plan.profile.scene] || 0) + 1;
  const distance = plan.audit.structuralDistance;
  if (!plan.audit.layoutComparable) distanceBuckets['not-comparable'] += 1;
  else if (distance < 0.25) distanceBuckets['lt-0.25'] += 1;
  else if (distance < 0.5) distanceBuckets['0.25-0.5'] += 1;
  else if (distance < 0.75) distanceBuckets['0.5-0.75'] += 1;
  else distanceBuckets['gte-0.75'] += 1;
  plan.audit.gateReasons.forEach((reason) => { gateCounts[reason] = (gateCounts[reason] || 0) + 1; });

  reviewRows.push([
    plan.reviewStatus,
    plan.audit.layoutComparable ? distance : '',
    plan.profile.scene,
    plan.profile.widthMm,
    plan.profile.heightMm,
    plan.profile.sourceId,
    plan.profile.sourceLabel,
    plan.catalogMeta.id,
    plan.catalogMeta.name,
    plan.audit.gateReasons.join('|'),
    sourcePreview(record)
  ].map(csvCell).join(','));

  if (plan.reviewStatus === 'candidate') {
    candidateChunk.push({
      profile: plan.profile,
      audit: plan.audit,
      authorization: plan.authorization,
      catalogMeta: plan.catalogMeta,
      document: plan.document
    });
    flushCandidates(false);
  } else {
    needsReview.push({
      reviewStatus: plan.reviewStatus,
      profile: plan.profile,
      audit: plan.audit
    });
  }
  if (processed % 1000 === 0) {
    console.log(`processed ${processed}/${selected.length}`);
  }
}
flushCandidates(true);

fs.writeFileSync(path.join(outDir, 'review-sheet.csv'), `\ufeff${reviewRows.join('\r\n')}\r\n`);
fs.writeFileSync(path.join(outDir, 'needs-review.json'), `${JSON.stringify({ count: needsReview.length, items: needsReview })}\n`);

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  input: {
    file: input,
    recordCount: records.length,
    processedCount: processed,
    sourceCollectionHash: createHash('sha256').update(inputBuffer).digest('hex'),
    sourceProvider,
    authorizationStatus: authorization.status,
    authorizationMetadataPresent: authorization.metadataPresent
  },
  policy: {
    inputUse: 'semantic extraction and similarity review only',
    copiedExpression: false,
    publicCatalog: false,
    releaseApproved: false,
    visionModelInvoked: false,
    note: '候选仅为内部评审产物；对外发布仍需书面授权凭证归档与人工登记。'
  },
  statusCounts,
  sceneCounts,
  distanceBuckets,
  gateCounts,
  output: {
    candidateChunks: chunkIndex,
    candidateCount: statusCounts.candidate || 0,
    reviewSheet: 'review-sheet.csv',
    needsReview: 'needs-review.json'
  }
};
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  outDir,
  processed,
  statusCounts,
  distanceBuckets,
  candidateChunks: chunkIndex,
  elapsedMs: summary.elapsedMs
}, null, 2));
