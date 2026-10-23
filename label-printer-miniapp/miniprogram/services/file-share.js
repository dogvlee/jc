// Sends a text file (backup, CSV) to a WeChat chat. WeChat only opens the
// "send file" sheet while the tap that asked for it is still being handled
// (iOS rejects it otherwise), so the file is written and shared
// synchronously: callers must not await or wait for a callback first.

const BRAND_RED = '#E02D26';
const UNSUPPORTED_MESSAGE = '当前微信版本不能发送文件，请升级微信后再试';
const WRITE_FAILED_MESSAGE = '文件没有生成，可能是手机存储空间不足。请清理手机空间后再试。';
const SHARE_FAILED_MESSAGE = '文件没有发出去，请再点一次试试。';

function showProblem(api, content) {
  if (!api || typeof api.showModal !== 'function') return;
  api.showModal({ title: '无法发送文件', content, showCancel: false, confirmText: '知道了', confirmColor: BRAND_RED });
}

// WeChat rejects some file types outright. Saying "upgrade WeChat" then sends
// the owner looking for a newer version that cannot help, so the extension is
// named instead and the next step is spelled out.
function failureMessage(failure, fileName) {
  const text = String(failure && failure.errMsg || '');
  if (/not support|unsupport|file ?type/i.test(text)) {
    const extension = /\.[A-Za-z0-9]{1,8}$/.exec(String(fileName || ''));
    return extension
      ? `微信不让把 ${extension[0].toLowerCase()} 文件发到聊天。可以先在电脑上导出这个文件，或把内容复制到聊天里。`
      : '微信不让把这种文件发到聊天。可以先在电脑上导出这个文件，或把内容复制到聊天里。';
  }
  if (/not available|not implement/i.test(text)) return UNSUPPORTED_MESSAGE;
  return SHARE_FAILED_MESSAGE;
}

// Every export gets a dated name; earlier ones are dropped so repeated
// exports do not fill the mini program's file storage.
function removeEarlierExports(files, directory, prefixes, keepName) {
  const list = [].concat(prefixes || []).filter(Boolean);
  if (!list.length || typeof files.readdirSync !== 'function' || typeof files.unlinkSync !== 'function') return;
  let names = [];
  try {
    names = files.readdirSync(directory) || [];
  } catch (error) {
    return;
  }
  names.forEach((name) => {
    if (name === keepName || !list.some((prefix) => String(name).startsWith(prefix))) return;
    try {
      files.unlinkSync(`${directory}/${name}`);
    } catch (error) {
      // Clean-up is best effort; the new file is what matters.
    }
  });
}

/**
 * Writes `content` as UTF-8 to USER_DATA_PATH/`fileName` (plain ASCII) and
 * opens the chat picker showing `displayName`. `replacePrefix` (string or
 * list) names earlier exports to remove. Returns true once the sheet was
 * requested; problems show a plain dialog, a cancelled share stays silent.
 */
function shareTextFileSync(api, options) {
  const config = options || {};
  if (!api || typeof api.shareFileMessage !== 'function' || typeof api.getFileSystemManager !== 'function') {
    showProblem(api, UNSUPPORTED_MESSAGE);
    return false;
  }
  const directory = api.env && api.env.USER_DATA_PATH;
  const filePath = `${directory}/${config.fileName}`;
  try {
    const files = api.getFileSystemManager();
    removeEarlierExports(files, directory, config.replacePrefix, config.fileName);
    files.writeFileSync(filePath, String(config.content == null ? '' : config.content), 'utf8');
  } catch (error) {
    showProblem(api, WRITE_FAILED_MESSAGE);
    return false;
  }
  try {
    api.shareFileMessage({
      filePath,
      fileName: config.displayName || config.fileName,
      fail: (failure) => {
        if (!/cancel/i.test(String(failure && failure.errMsg || ''))) showProblem(api, failureMessage(failure, config.fileName));
      }
    });
  } catch (error) {
    showProblem(api, UNSUPPORTED_MESSAGE);
    return false;
  }
  return true;
}

module.exports = { shareTextFileSync };
