const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// WeChat's require is not Node's: `require('./dir')` does not fall back to
// `./dir/index.js`, and only .js modules can be required. Node tests pass
// either way, so a directory require only shows up on a phone, where the page
// that needs it cannot open at all ("module 'app/curated.js' is not defined").
const root = path.join(__dirname, '..');
const mini = path.join(root, 'miniprogram');
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const ignored = (config.packOptions && config.packOptions.ignore) || [];

function shipped(relative) {
  const unix = relative.split(path.sep).join('/');
  return !ignored.some((rule) => (rule.type === 'folder'
    ? unix === rule.value || unix.startsWith(`${rule.value}/`)
    : unix === rule.value));
}

function jsFiles(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(file));
    else if (entry.name.endsWith('.js')) out.push(file);
  }
  return out;
}

test('every require in the shipped package names a .js file the way WeChat resolves it', () => {
  const problems = [];
  let checked = 0;
  for (const file of jsFiles(mini)) {
    const relativeFile = path.relative(mini, file);
    if (!shipped(relativeFile)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = match[1];
      checked += 1;
      if (!target.startsWith('.') && !target.startsWith('/')) {
        problems.push(`${relativeFile}: require('${target}') is a bare name; WeChat has no node_modules lookup`);
        continue;
      }
      const base = target.startsWith('/') ? path.join(mini, target) : path.resolve(path.dirname(file), target);
      const resolved = target.endsWith('.js') ? base : `${base}.js`;
      if (fs.existsSync(resolved)) {
        const inside = path.relative(mini, resolved);
        if (!shipped(inside)) problems.push(`${relativeFile}: require('${target}') points at ${inside}, which is not shipped`);
        continue;
      }
      if (fs.existsSync(path.join(base, 'index.js'))) {
        problems.push(`${relativeFile}: require('${target}') is a directory; write '${target}/index'`);
      } else {
        problems.push(`${relativeFile}: require('${target}') has no .js file`);
      }
    }
  }
  assert.ok(checked > 100, `only ${checked} requires found; the scan is broken`);
  assert.deepEqual(problems, []);
});
