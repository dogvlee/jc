import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyReleaseTree, createWechatConfig, isExcluded, reserveOutputDirectory } from './release-utils.mjs';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(projectRoot, 'miniprogram');

export function collectAcceptanceInventory(root) {
  const { FONT_CATALOG } = require(path.join(root, 'core/font-family.js'));
  const auth = require(path.join(root, 'config/auth.js'));
  let accountServiceOrigin = '';
  try { accountServiceOrigin = auth.apiBaseUrl ? new URL(auth.apiBaseUrl).origin : ''; } catch (_) {}
  const fonts = FONT_CATALOG.flatMap((font) => (font.files || []).map((file) => ({
    fontId: font.id, family: font.family, weight: file.weight, url: file.url
  })));
  const uses = [];
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      if (isExcluded(relative)) continue;
      if (entry.isDirectory()) scan(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const source = fs.readFileSync(absolute, 'utf8');
        for (const api of ['chooseMedia', 'chooseMessageFile', 'scanCode', 'openBluetoothAdapter', 'startBluetoothDevicesDiscovery', 'shareFileMessage', 'login', 'request']) {
          if (new RegExp(`\\b${api}\\b`).test(source)) uses.push({ api, file: relative });
        }
      }
    }
  }
  scan(root);
  return {
    generatedAt: new Date().toISOString(),
    scope: '代码清单；未读取微信后台配置，不表示微信审核或真机验收通过',
    network: {
      accountServiceOrigin,
      accountServiceStatus: accountServiceOrigin ? '自有服务地址已配置，仍需核验合法域名和服务端部署' : '自有服务地址待提供；本地功能可用，不宣称真实登录已接通',
      fontOrigins: [...new Set(fonts.map((font) => new URL(font.url).origin))].sort(),
      fontFiles: fonts,
      builtInRemoteImages: [],
      importedRemoteImages: '用户导入 JSON 中的 HTTPS 图片可触发 wx.downloadFile；来源由导入内容决定，须按实际允许来源配置和验收',
      referenceLinksOnly: ['https://github.com/google/fonts'],
      note: '字体 URL、许可证链接、下载图片的网络配置应分别核对，不能把许可证链接当作请求域名；公开包已排除内部在线模板服务'
    },
    apiUsesToReview: uses,
    dataPractices: [
      '用户同意协议并主动授权手机号后，微信登录码与一次性取号凭证发送到自有账号服务校验；仅保存脱敏账号资料，登录凭据不进入标签备份',
      '项目、模板、批量数据、草稿与打印历史保存在本机；JSON 备份不含图片文件本体',
      '相机/相册用于用户主动添加标签图片，相机扫码用于建标或填写编码内容',
      '聊天文件用于用户主动导入 CSV、模板或 JSON 备份；导出分享由用户主动触发',
      '蓝牙用于发现和连接打印机；记忆设备可能在启动或蓝牙恢复时自动重连',
      '字体按需联网下载；导入的 HTTPS 图片按需下载；标签内容通过 BLE 发送给用户选择的打印机'
    ],
    pendingEvidence: [
      'AppID 的主体和开发者权限由微信验证；工具只检查 AppID 格式',
      '微信后台实际网络、隐私指引和服务类目配置',
      '最低/目标基础库、Android/iOS 真机的权限允许/拒绝/恢复以及远程字体和图片行为',
      '目标打印机型号、固件、标签物理尺寸与条码/二维码回扫样张'
    ]
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === '--help' || name === '--inspect') options[name.slice(2)] = true;
    else if (name === '--appid' || name === '--out') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${name} 缺少参数`);
      options[name.slice(2)] = value;
    } else throw new Error(`不支持的参数：${name}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('用法：node scripts/prepare-wechat-release.mjs [--appid 真实AppID] [--out 新目录]\nAppID 默认读取 WECHAT_APPID 或项目配置；--inspect 只输出代码网络/隐私清单，不写文件。');
    return;
  }
  if (options.inspect) {
    console.log(JSON.stringify(collectAcceptanceInventory(sourceRoot), null, 2));
    return;
  }
  const sourceConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.config.json'), 'utf8'));
  // Validate before creating any output, and never persist a substitute AppID.
  const config = createWechatConfig(sourceConfig, options.appid || process.env.WECHAT_APPID || sourceConfig.appid);
  const output = reserveOutputDirectory(options.out || path.join(projectRoot, 'dist', 'wechat-acceptance'), sourceRoot, !options.out);
  const miniRoot = path.join(output, 'miniprogram');
  copyReleaseTree(sourceRoot, miniRoot);
  const gate = spawnSync(process.execPath, [path.join(scriptDir, 'check-shangyue-release.mjs'), miniRoot], { stdio: 'inherit' });
  if (gate.error || gate.status !== 0) throw new Error(`公开包检查未通过，未生成微信项目配置：${gate.error?.message || gate.status}`);
  fs.writeFileSync(path.join(output, 'project.config.json'), `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'acceptance-inventory.json'), `${JSON.stringify(collectAcceptanceInventory(miniRoot), null, 2)}\n`, { flag: 'wx' });
  console.log(`微信验收项目已生成：${output}`);
  console.log(`公开内容目录：${miniRoot}`);
  console.log('请导入上述项目目录；已开启域名检查。项目生成不代表微信后台配置、隐私、真机或样张已通过；未执行上传或发布。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
