import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  normalizeAuthorization,
  planAuthorizedRedesign,
  selectDiverseRecords
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
const output = path.resolve(option(
  '--out',
  path.join(root, '..', 'output', 'shangyue-redesign', 'pilot-plan.json')
));
const requestedLimit = Number(option('--limit', '30'));
const limit = Number.isInteger(requestedLimit) && requestedLimit >= 0 ? requestedLimit : 30;

if (!fs.existsSync(input)) {
  throw new Error(`授权模板输入不存在：${input}`);
}

const inputBuffer = fs.readFileSync(input);
const payload = JSON.parse(inputBuffer.toString('utf8'));
const records = Array.isArray(payload.records) ? payload.records : [];
const selected = selectDiverseRecords(records, limit);
const authorization = normalizeAuthorization(payload.authorization);
const sourceProvider = payload.sourceProvider
  || (payload.source && payload.source.provider)
  || payload.provider
  || payload.kind
  || payload.sourceMethod
  || 'unspecified-input';
const planContext = { authorization: payload.authorization, sourceProvider };
const plans = selected.map((record) => planAuthorizedRedesign(record, planContext));
const sceneCounts = {};
plans.forEach((plan) => {
  sceneCounts[plan.profile.scene] = (sceneCounts[plan.profile.scene] || 0) + 1;
});

const result = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  input: {
    file: input,
    recordCount: records.length,
    processedCount: plans.length,
    sourceCollectionHash: createHash('sha256').update(inputBuffer).digest('hex'),
    sourceProvider,
    authorizationMetadataPresent: authorization.metadataPresent
  },
  policy: {
    inputUse: 'semantic extraction and similarity review only',
    copiedExpression: false,
    publicCatalog: false,
    releaseApproved: false,
    authorizationStatus: authorization.status,
    visionModelInvoked: false
  },
  stats: {
    candidates: plans.filter((plan) => plan.reviewStatus === 'candidate').length,
    manualRedesignRequired: plans.filter((plan) => plan.reviewStatus !== 'candidate').length,
    visualReview: plans.filter((plan) => plan.reviewStatus === 'visual-review').length,
    authorizationReview: plans.filter((plan) => plan.reviewStatus === 'authorization-review').length,
    scenes: sceneCounts
  },
  plans
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, ...result.stats }, null, 2));
