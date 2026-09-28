import fs from 'node:fs';
import path from 'node:path';

export const EXCLUDED_RELEASE_PATHS = [
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

export function isExcluded(relative) {
  const normalized = relative.replaceAll('\\', '/');
  return EXCLUDED_RELEASE_PATHS.some((prefix) => (
    normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)
  ));
}

function physicalPath(value) {
  const remaining = [];
  let existing = path.resolve(value);
  while (!fs.existsSync(existing)) {
    remaining.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`无法解析目录：${value}`);
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...remaining);
}

export function reserveOutputDirectory(desired, sourceRoot, unique = false) {
  const target = path.resolve(desired);
  const relative = path.relative(physicalPath(sourceRoot), physicalPath(target));
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('输出目录不能位于小程序源目录内');
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? target : `${target}-${Date.now()}-${attempt}`;
    try {
      fs.mkdirSync(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!unique) throw new Error(`输出目录已存在，未修改任何已有文件：${candidate}`);
    }
  }
  throw new Error('无法创建新的输出目录');
}

export function copyReleaseTree(sourceRoot, outRoot) {
  function copy(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name);
      const relative = path.relative(sourceRoot, source).replaceAll('\\', '/');
      if (isExcluded(relative)) continue;
      if (entry.isSymbolicLink()) throw new Error(`发布源文件不能是符号链接：${relative}`);
      const target = path.join(to, entry.name);
      if (entry.isDirectory()) copy(source, target);
      else fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    }
  }
  copy(sourceRoot, outRoot);
}

export function createWechatConfig(source, appid) {
  if (!/^wx[0-9a-f]{16}$/i.test(String(appid || '').trim())) {
    throw new Error('需要真实、有权限的微信小程序 AppID：设置 WECHAT_APPID 或传入 --appid；不能使用 touristappid。');
  }
  return {
    ...source,
    appid: appid.trim(),
    miniprogramRoot: 'miniprogram/',
    projectname: `${source.projectname || 'label-printer-miniapp'}-acceptance`,
    setting: { ...source.setting, urlCheck: true },
    packOptions: { ignore: [], include: [] }
  };
}
