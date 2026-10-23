/**
 * 电脑「标签设计器」导出的模板文件，图片 / 素材图是以 `data:image/...;base64,` 写在元素 path 上的。
 * 导入前先把它们写成手机本地文件（跟相册选图一样放在 USER_DATA_PATH/label-image-*），path 换成文件路径，
 * 再交给仓储规范化——规范化会把 path 截到 1024 个字，data URL 不先落地就会被截坏。
 * 不是 data URL 的 path 一律不动（https 图片仍由 remote-image-cache 下载）。
 */
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;
const MAX_IMAGES = 16;
// 约 3 MB 图片；导入的模板文件本身页面已限 2 MiB，这里只防单张异常大
const MAX_BASE64_CHARS = 4 * 1024 * 1024;

function isDataUrlImage(value) {
  return typeof value === 'string' && /^data:image\//i.test(value.trim());
}

function writeBase64File(fs, filePath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile({ filePath, data, encoding: 'base64', success: resolve, fail: reject });
  });
}

/**
 * 返回一份新的文档（不改传入的对象）。写文件失败抛出中文错误；认不出或过大的 data URL
 * 清成空路径（元素留着，手机上点「替换图片」重新选），不让半截数据进存储。
 */
async function materializeDataUrlImages(wxLike, documentValue) {
  if (!documentValue || typeof documentValue !== 'object') return documentValue;
  const document = JSON.parse(JSON.stringify(documentValue));
  const elements = Array.isArray(document.elements) ? document.elements : [];
  // 凡是 data: 开头的都要处理：合法图片落成文件，别的（data:text/html 之类）清空，不能原样进存储
  const targets = elements.filter((element) => element
    && (element.type === 'image' || element.type === 'material')
    && /^data:/i.test(String(element.path || '').trim()));
  const writable = [];
  targets.forEach((element) => {
    const match = String(element.path).trim().match(DATA_URL_PATTERN);
    if (writable.length >= MAX_IMAGES || !match || match[2].length > MAX_BASE64_CHARS) element.path = '';
    else writable.push({ element, match });
  });
  if (!writable.length) return document;
  const fs = wxLike && typeof wxLike.getFileSystemManager === 'function' ? wxLike.getFileSystemManager() : null;
  const root = wxLike && wxLike.env && wxLike.env.USER_DATA_PATH;
  if (!fs || !root) throw new Error('当前微信版本不能保存模板里的图片，请升级微信后重试');
  const stamp = Date.now();
  for (let index = 0; index < writable.length; index += 1) {
    const { element, match } = writable[index];
    const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const filePath = `${root}/label-image-${stamp}-${index}.${extension}`;
    try {
      await writeBase64File(fs, filePath, match[2].replace(/\s+/g, ''));
    } catch (error) {
      const failure = new Error('模板里的图片保存失败，手机存储空间可能不足，请清理后重试');
      failure.cause = error;
      throw failure;
    }
    element.path = filePath;
  }
  return document;
}

module.exports = { MAX_IMAGES, isDataUrlImage, materializeDataUrlImages };
