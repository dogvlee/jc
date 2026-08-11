import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const miniRoot = path.join(projectRoot, 'miniprogram');
const MAIN_PACKAGE_LIMIT = 2 * 1024 * 1024;
const warnings = [];
const errors = [];

function walk(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (predicate(absolute)) files.push(absolute);
    }
  }
  return files.sort();
}

function relative(file) {
  return path.relative(projectRoot, file).replaceAll('\\', '/');
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateWxmlStructure(source, file) {
  const stack = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    if (start < 0) break;
    if (source.startsWith('<!--', start)) {
      const commentEnd = source.indexOf('-->', start + 4);
      if (commentEnd < 0) {
        errors.push(`WXML structure: ${relative(file)} has an unterminated comment`);
        return;
      }
      cursor = commentEnd + 3;
      continue;
    }
    let quote = '';
    let end = start + 1;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
    }
    if (end >= source.length) {
      errors.push(`WXML structure: ${relative(file)} has an unterminated tag`);
      return;
    }
    const raw = source.slice(start + 1, end).trim();
    cursor = end + 1;
    if (!raw || raw.startsWith('!') || raw.startsWith('?')) continue;
    const closing = raw.startsWith('/');
    const selfClosing = /\/$/.test(raw);
    const match = raw.match(/^\/?([A-Za-z][\w-]*)/);
    if (!match) continue;
    const name = match[1];
    if (closing) {
      const expected = stack.pop();
      if (expected !== name) {
        errors.push(`WXML structure: ${relative(file)} closes <${name}> while <${expected || 'none'}> is open`);
        return;
      }
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length) {
    errors.push(`WXML structure: ${relative(file)} leaves <${stack[stack.length - 1]}> unclosed`);
  }
  const opens = source.match(/\{\{/g) || [];
  const closes = source.match(/\}\}/g) || [];
  if (opens.length !== closes.length) {
    errors.push(`WXML expressions: ${relative(file)} has ${opens.length} openings and ${closes.length} closings`);
  }
}

const jsFiles = walk(miniRoot, (file) => file.endsWith('.js'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    errors.push(`JS syntax: ${relative(file)}\n${(result.stderr || result.stdout).trim()}`);
  }
}
console.log(`[check] JS syntax: ${jsFiles.length} files`);

const jsonFiles = [
  path.join(projectRoot, 'package.json'),
  path.join(projectRoot, 'project.config.json'),
  ...walk(miniRoot, (file) => file.endsWith('.json'))
];
for (const file of jsonFiles) {
  try {
    JSON.parse(readText(file));
  } catch (error) {
    errors.push(`JSON parse: ${relative(file)}: ${error.message}`);
  }
}
console.log(`[check] JSON parse: ${jsonFiles.length} files`);

const markdownFiles = [
  ...['README.md', 'APK_ANALYSIS.md', 'THIRD_PARTY_NOTICES.md']
    .map((name) => path.join(projectRoot, name))
    .filter((file) => fs.existsSync(file)),
  ...walk(path.join(projectRoot, 'docs'), (file) => file.endsWith('.md'))
];
let localMarkdownLinks = 0;
for (const file of markdownFiles) {
  const source = readText(file);
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim().split(/\s+["']/)[0];
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (!target || target.startsWith('#') || /^(?:https?:|mailto:)/i.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;
    try { target = decodeURIComponent(target); } catch { /* Keep the literal path for diagnostics. */ }
    localMarkdownLinks += 1;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) {
      errors.push(`Missing Markdown link: ${relative(file)} -> ${match[1].trim()}`);
    }
  }
}
console.log(`[check] Markdown links: ${localMarkdownLinks} local links across ${markdownFiles.length} files`);

const appJsonPath = path.join(miniRoot, 'app.json');
let appJson = null;
try {
  appJson = JSON.parse(readText(appJsonPath));
} catch {
  // The JSON pass already reports this with exact context.
}
if (appJson && Array.isArray(appJson.pages)) {
  for (const page of appJson.pages) {
    for (const extension of ['.js', '.wxml', '.wxss']) {
      const target = path.join(miniRoot, `${page}${extension}`);
      if (!fs.existsSync(target)) errors.push(`Missing page file: ${relative(target)}`);
    }
  }
} else if (appJson) {
  errors.push('app.json must declare a pages array');
}

const wxmlFiles = walk(miniRoot, (file) => file.endsWith('.wxml'));
let handlerCount = 0;
for (const file of wxmlFiles) {
  const source = readText(file);
  validateWxmlStructure(source, file);
  const scriptFile = file.replace(/\.wxml$/i, '.js');
  if (!fs.existsSync(scriptFile)) {
    errors.push(`WXML has no companion JS: ${relative(file)}`);
    continue;
  }
  const script = readText(scriptFile);
  const eventPattern = /\b(?:bind|catch|capture-bind|capture-catch)[\w:-]*\s*=\s*["']([^"'{}\s]+)["']/g;
  for (const match of source.matchAll(eventPattern)) {
    const handler = match[1];
    handlerCount += 1;
    const name = escapeRegExp(handler);
    const methodPattern = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{|\\b${name}\\s*:\\s*(?:async\\s+)?(?:function\\b|[^,\\n]*=>)`, 'm');
    if (!methodPattern.test(script)) {
      errors.push(`Missing WXML handler: ${relative(file)} -> ${handler}`);
    }
  }
}
console.log(`[check] WXML handlers: ${handlerCount} bindings across ${wxmlFiles.length} files`);

const resourceSourceFiles = walk(miniRoot, (file) => /\.(?:js|json|wxml|wxss)$/i.test(file));
const resourceRefs = new Map();
const resourcePattern = /(?:^|[='"`(\s])\/?(assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg))/gim;
for (const file of resourceSourceFiles) {
  const source = readText(file);
  for (const match of source.matchAll(resourcePattern)) {
    const assetPath = match[1];
    if (!resourceRefs.has(assetPath)) resourceRefs.set(assetPath, []);
    resourceRefs.get(assetPath).push(relative(file));
  }
}
for (const [assetPath, owners] of resourceRefs) {
  const target = path.join(miniRoot, ...assetPath.split('/'));
  if (!fs.existsSync(target)) {
    errors.push(`Missing asset: ${assetPath} (from ${[...new Set(owners)].join(', ')})`);
  }
}
console.log(`[check] Static assets: ${resourceRefs.size} referenced paths`);

const packageFiles = walk(miniRoot);
const packageBytes = packageFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const packageMiB = packageBytes / 1024 / 1024;
const usage = packageBytes / MAIN_PACKAGE_LIMIT;
console.log(`[check] Main package: ${packageFiles.length} files, ${packageBytes} bytes (${packageMiB.toFixed(2)} MiB, ${(usage * 100).toFixed(1)}% of 2 MiB)`);
if (packageBytes > MAIN_PACKAGE_LIMIT) {
  errors.push(`Main package is ${packageBytes - MAIN_PACKAGE_LIMIT} bytes over the 2 MiB limit`);
} else if (usage >= 0.9) {
  warnings.push(`Main package has only ${MAIN_PACKAGE_LIMIT - packageBytes} bytes of headroom`);
}

for (const warning of warnings) console.warn(`[warn] ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[error] ${error}`);
  console.error(`[check] FAILED with ${errors.length} error(s)`);
  process.exitCode = 1;
} else {
  console.log(`[check] PASS${warnings.length ? ` with ${warnings.length} warning(s)` : ''}`);
}
