#!/usr/bin/env node
/**
 * Idempotent repair for stale image markers in the checked-in offline pack.
 * An unavailable layer is removed rather than cloned from a sibling: two
 * nearly coincident copies of the same bitmap create a visible white fringe
 * after thermal thresholding and an extra selection layer in the editor.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packPath = path.join(root, 'src', 'app', 'online-templates-pack.js');
const invalidPath = /(?:^|[\\/])(?:文件不存在|null|undefined|not[ _-]?found)(?:\.[^\\/]*)?$/i;
const knownUnavailable = new Set([
  'online-482306420/image-mskgxb8p-351'
]);

delete require.cache[require.resolve(packPath)];
const { ONLINE_TEMPLATES } = require(packPath);
let removed = 0;

for (const template of ONLINE_TEMPLATES) {
  const elements = template.document && Array.isArray(template.document.elements)
    ? template.document.elements
    : [];
  template.document.elements = elements.filter((element) => {
    if (element.type !== 'image') return true;
    const unavailable = knownUnavailable.has(`${template.id}/${element.id}`)
      || invalidPath.test(String(element.path || '').trim());
    if (unavailable) removed += 1;
    return !unavailable;
  });
}

const body = '/** Auto-generated offline NIIM online templates. */\n'
  + `const ONLINE_TEMPLATES = ${JSON.stringify(ONLINE_TEMPLATES)};\n`
  + 'function getOnlineTemplate(id) {\n'
  + '  return ONLINE_TEMPLATES.find((item) => item.id === id) || null;\n'
  + '}\n'
  + 'function buildOnlineDocument(id) {\n'
  + '  const item = getOnlineTemplate(id);\n'
  + '  if (!item || !item.document) return null;\n'
  + '  return JSON.parse(JSON.stringify(item.document));\n'
  + '}\n'
  + 'module.exports = { ONLINE_TEMPLATES, getOnlineTemplate, buildOnlineDocument };\n';

fs.writeFileSync(packPath, body, 'utf8');
const imageElements = ONLINE_TEMPLATES.flatMap((template) => template.document.elements || [])
  .filter((element) => element.type === 'image');
const unresolved = imageElements.filter((element) => invalidPath.test(String(element.path || '').trim()));
console.log(JSON.stringify({ templates: ONLINE_TEMPLATES.length, images: imageElements.length, removed, unresolved: unresolved.length, bytes: Buffer.byteLength(body) }));
if (unresolved.length) process.exitCode = 1;
