# 电脑标签设计器 → 小程序导入（2026-09-29）

「打印模板设计器」（`D:\vibecode\web-designer`，网站 + 电脑版 exe + 本机版）新增了第三个设计器「标签设计器」（`label.html`），在电脑上画标签，交给本小程序打印。本文记录两边的对接约定。设计器那边的说明见 `web-designer/CLAUDE.md`「标签设计器」一节和 `print/docs/74g-LABEL-DESIGNER-2026-09-29.md`。

## 画的 = 打的

设计器不自己画标签：它把本仓库 `miniprogram/` 里的 `core/renderer.js`、`core/document.js`、`core/geometry.js`、`core/profiles.js`、`core/code-quality.js`、`core/linked-codes.js`、`core/text-direction.js`、`core/font-family.js`、`core/font-loader.js`、`core/materials.js`、`core/borders.js`、`core/pc-template-code.js`、`services/repository.js`（`normalizeDocument`）、`app/stock-presets.js`、`app/curated/`（300 套商跃原创模板）原样打包进网页（`web-designer/label-designer/build.js` 顺着 `require` 找依赖）。每次修改后跟编辑页 `commit()` 一样：`syncLinkedCodes` → 所有元素 `clampElement` → 记撤销 → 自动保存。

**这些文件改了，要到 web-designer 跑 `bash build-label.sh` 重新打包**，否则网页用的是旧逻辑。打包闭包里 `wx` 是 `undefined`，内核按浏览器的路走（`OffscreenCanvas`、`FontFace`），所以上面这些模块里对 `wx` 的使用必须保持「先判断有没有」的写法。

## 两条导入路

1. **扫码（首页「扫码建标」）**：设计器「发到手机」弹出的码内容是 `SYL1:` + base64( deflate-raw( UTF-8 JSON ) )，JSON 为 `{ type: 'shangyue-label-template', v: 1, name, document }`。`document` 是 LabelDocument，省掉了 `id` 和跟 `createElement` 默认值相同的字段，导入时由 `normalizeDocument` 按同一套默认值补回。`scanToLabel` 先用 `core/pc-template-code.js` 的 `isPcTemplateCode` 判断：是 → `decodePcTemplateCode` → `normalizeDocument` → `localizeDocumentImages` → `saveUserTemplate`（存进「我的模板」）→ 打开编辑器；不是 → 照旧按普通码建标签。码坏了 / 没扫全报 `PC_CODE_CORRUPT`（弹「模板导入失败」+「重新扫码」），版本比小程序新报 `PC_CODE_TOO_NEW`。解压用 `vendor/tiny-inflate.js`（MIT，见 THIRD_PARTY_NOTICES）。
2. **文件（模板页「导入模板」）**：设计器「下载模板文件」= `{ type: 'shangyue-label-template', v: 1, name, document }`，「全部导出给手机」= `{ type: 'shangyue-label-pack', v: 1, templates: [{ name, document }] }`，都走原来的 `importTemplateFile`。设计器里的图片是 `data:image/...;base64,` 写在 `path` 上的：导入前由 `services/data-url-images.js` 的 `materializeDataUrlImages` 写成 `USER_DATA_PATH/label-image-*` 本地文件、`path` 换成文件路径（必须在 `normalizeDocument` 之前做，它会把 `path` 截到 1024 字）；不是图片的 `data:` 清空。带图片的标签二维码装不下，设计器会自动改成用文件发。

## 验证（2026-09-29）

- `tests/pc-template-code.test.js` 8 项：中文内容来回、普通码不误认、截断 / 乱码 / 别家 / 新版本码报错、扫码建标导入并打开、坏码给「重新扫码」、导入文件时图片落地、整包导入带图片、data URL 工具只动图片 / 素材元素。全量 456 项、`npm run check` 通过（主包 1.58 MiB）。
- 设计器侧（无头 Chrome）：「发到手机」的码用本仓库源文件（不是打包进网页的那份）解开 → `normalizeDocument` 后跟设计器里逐字段一致、203 dpi 逐像素一致；300 套原创模板逐张同样核对，全部一致，全部装得进二维码（版本中位数 19、最大 24）。带图片的模板文件走 `materializeDataUrlImages` + `normalizeDocument` 后跟设计器一致。
- 没做：微信开发者工具 / 真机里的扫码与导入（要真机），`wx.scanCode` 对这种纯 ASCII 码的识别速度要真机看。
