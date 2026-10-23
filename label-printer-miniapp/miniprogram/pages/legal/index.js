// The text the owner agrees to. Must equal config/auth.js consentVersion and
// server/app.js CONSENT_VERSION; tests/auth-integration.test.js checks all three.
const AGREEMENT_VERSION = '2026-10-15';

const DOCUMENTS = {
  privacy: {
    title: '隐私说明',
    summary: '账号用于识别登录身份，标签内容仍保存在本机。',
    sections: [
      {
        title: '1. 登录会使用哪些信息',
        paragraphs: [
          '你主动同意协议并点击微信手机号登录后，服务端通过微信提供的手机号接口获取手机号，仅用于账号识别。',
          '账号资料仅保存脱敏手机号、微信提供并经服务端确认的用户标识及协议同意时间和版本，不保存完整手机号。',
          '为保持登录，本机会在独立账号存储保存会话令牌及到期时间，账号服务保存令牌哈希及到期时间用于验证会话。登录令牌不包含在标签 JSON 备份里。'
        ]
      },
      {
        title: '2. 标签内容保存在本机',
        paragraphs: [
          '标签、模板、图片、批量数据和打印历史仍保存在当前设备。登录不会将这些内容上传到账号，也不代表已经云同步或云备份。',
          '请主动导出需要保留的数据。JSON 备份包含文档数据和图片路径，不包含本地图片文件本体；清理小程序数据或更换设备后，原图片可能无法恢复。'
        ]
      },
      {
        title: '3. 主动使用的设备能力',
        paragraphs: [
          '连接打印机、扫码和选择图片由你主动开启；已记忆的打印机可能在启动或蓝牙恢复时尝试重连，可在「我的打印机」里忘记设备。',
          '按需加载字体或导入含远程图片的模板时，会连接对应资源服务。登录过程不上传标签正文、模板、图片、批量数据或打印历史。'
        ]
      },
      {
        title: '4. 退出与共用手机',
        paragraphs: [
          '退出登录只清除本机账号登录态，并请求账号服务撤销当前会话，不会删除账号资料，也不会删除本机标签和其他编辑数据。',
          '共用手机上的其他使用者仍可能查看、编辑或导出本机内容。交给他人使用前，请自行备份并检查需要保留或删除的数据。'
        ]
      },
      {
        title: '5. 联系与信息处理请求',
        paragraphs: [
          '运营主体以微信小程序详情页展示的信息为准。如需咨询、反馈或提出账号信息处理请求，可通过微信右上角「···」中的「反馈与投诉」联系。'
        ]
      }
    ]
  },
  terms: {
    title: '用户协议',
    summary: '请先了解账号登录和本机数据的使用范围。',
    sections: [
      {
        title: '1. 服务范围',
        paragraphs: [
          '商跃标签提供标签设计、模板使用、数据导入导出及蓝牙打印等工具。账号登录用于识别身份；登录不代表标签内容已云同步或云备份。',
          '本次账号服务提供微信手机号登录，不包含短信、邮箱、会员或支付服务。'
        ]
      },
      {
        title: '2. 你的登录选择',
        paragraphs: [
          '请阅读本协议和隐私说明，再主动选择是否同意并使用微信手机号登录。打开或阅读本页不会替你同意协议，也不会自动登录。',
          '手机号由服务端通过微信接口获取，仅用于账号识别。账号资料仅保留脱敏手机号、可信微信用户标识及协议同意时间和版本。',
          '会话令牌及到期时间保存在本机独立账号存储，账号服务只保存令牌哈希及到期时间用于验证会话，不随标签备份导出。'
        ]
      },
      {
        title: '3. 本机内容与备份',
        paragraphs: [
          '标签、模板、图片、批量数据和打印历史仍保存在当前设备。请妥善保管本机内容，并主动导出需要留存的数据。',
          'JSON 备份不包含本地图片文件本体。清理小程序数据、卸载或更换设备可能导致本机内容或图片无法恢复。'
        ]
      },
      {
        title: '4. 使用与退出',
        paragraphs: [
          '请使用你有权使用的文字、图片和模板，并在打印前检查内容、纸张尺寸及打印机状态。',
          '退出登录只清除本机账号登录态，并请求账号服务撤销当前会话。本机标签和其他编辑数据仍保留，账号资料不会因此删除。共用手机时，其他使用者仍可能访问本机内容。'
        ]
      },
      {
        title: '5. 版本与联系',
        paragraphs: [
          '本页协议版本为 2026-10-15。运营主体请查看微信小程序详情页；咨询或账号信息处理请求可通过微信右上角「···」中的「反馈与投诉」提出。'
        ]
      }
    ]
  }
};

function headerMetrics(api) {
  let info = {};
  try {
    info = (typeof api.getWindowInfo === 'function' ? api.getWindowInfo()
      : typeof api.getSystemInfoSync === 'function' ? api.getSystemInfoSync() : {}) || {};
  } catch (_) { /* A readable page must not depend on device metrics. */ }
  const validTop = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) < 200;
  const areaTop = info.safeArea && info.safeArea.top;
  const safeTop = validTop(areaTop) ? Number(areaTop) : validTop(info.statusBarHeight) ? Number(info.statusBarHeight) : 24;
  let headerTop = safeTop + 44;
  try {
    const menu = typeof api.getMenuButtonBoundingClientRect === 'function' ? api.getMenuButtonBoundingClientRect() : null;
    if (menu && validTop(menu.bottom)) headerTop = Math.max(safeTop + 12, Number(menu.bottom) + 12);
  } catch (_) { /* Reserve a navigation row when the capsule cannot be read. */ }
  return { safeTop, headerTop };
}

Page({
  data: {
    type: 'privacy',
    version: AGREEMENT_VERSION,
    safeTop: 24,
    headerTop: 68,
    ...DOCUMENTS.privacy
  },

  onLoad(options) {
    // Only static documents are addressable. Query strings never become copy or URLs.
    const type = options && options.type === 'terms' ? 'terms' : 'privacy';
    this.setData(Object.assign({ type, version: AGREEMENT_VERSION }, DOCUMENTS[type], headerMetrics(wx)));
  },

  onResize() {
    this.setData(headerMetrics(wx));
  },

  goBack() {
    if (this.backPending) return;
    this.backPending = true;
    const failed = () => { this.backPending = false; };
    const home = () => {
      try { wx.reLaunch({ url: '/pages/home/index', fail: failed }); }
      catch (_) { failed(); }
    };
    try { wx.navigateBack({ delta: 1, fail: home }); }
    catch (_) { home(); }
  }
});
