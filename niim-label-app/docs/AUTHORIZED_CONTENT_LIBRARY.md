# 第三方内容库内部接入说明（授权待补）

本文件描述内部研究/兼容目录，不构成授权证明。`manifest.json` 的权利证明字段仍是占位内容；在书面再分发授权落盘前，相关模板、图片、素材和目录接口不得进入商跃公开发布包，也不得标成商跃原创。

## 当前覆盖

- 内部 App 工程随包保留 190 套离线模板（33 套基础结构 + 157 套第三方来源）用于回归；这不是可公开再分发的内容清单。
- 待授权目录按需分页加载：行业模板 9,161 条、素材 2,567 条、边框 632 条（2026-08-11 抓取快照）。
- 远程模板与离线模板按来源 ID 去重；命中同一 ID 时始终采用随包版本。
- 远程图片按需加载，不把完整图片库塞进安装包。XAPK 本身只有 3 个有内容示例和 1 个空白模板，完整目录来自授权的只读目录接口。

素材和边框数量只代表当前目录接口可枚举的分页结果，不代表本项目已经取得授权。若未来授权还包含未出现在该分页结果中的 VIP、账号或最新内容，应使用权利方提供的正式导出或专用 API；本项目不会访问用户模板、收件箱或其他私有端点。

## App 运行时

只读客户端位于 `src/services/authorized-catalog.js`，仅允许行业模板、素材、边框三个目录端点。模板页首次打开时加载第一页；素材和边框在对应面板打开时加载，失败不会影响离线内容。

默认目录基址为：

```text
https://print.niimbot.com/api
```

生产环境建议把授权内容同步到自有只读服务/CDN，并在应用入口执行前设置：

```js
globalThis.NIIM_AUTHORIZED_CATALOG_BASE = 'https://catalog.example.com/api';
```

自有服务应保持相同的分页响应结构，并为 Web/Capacitor 来源配置正确的 CORS。远程图片也必须允许跨域读取，否则编辑器可以显示但导出打印画布可能被浏览器污染。

## 全量元数据同步

同步命令默认只保存目录 JSON，不下载图片正文：

```powershell
npm run sync:authorized-catalog -- --kind all --max-pages 0 --resume --out ./research/authorized-catalog-full
```

确需建立自有图片镜像时，可在已核对存储空间、授权范围和 CDN 成本后增加 `--download-assets`。资源会按内容 SHA-256 寻址，命令支持断点续传、429/5xx 退避、原子 checkpoint、跨页去重及确定性 manifest。

本次完整元数据快照在 `research/authorized-catalog-full/`（约 272 MiB，已被忽略，不进入安装包）。其 `manifest.json` 中的授权证明字段目前仍是占位内容；正式发布前必须补充书面授权编号、覆盖范围、地域和有效期。

## 微信小程序域名

在微信公众平台配置以下合法域名：

- request：`print.niimbot.com`（或自有目录服务域名）
- downloadFile / 图片：`oss-print.niimbot.com`
- downloadFile / 图片：`oss-niimbot-print.niimbot.com`
- downloadFile / 图片：`jc-print.oss-cn-hangzhou.aliyuncs.com`
- downloadFile / 图片：`niimbot-bison.oss-cn-hangzhou.aliyuncs.com`

生产发布更推荐统一改写为自有 CDN 域名，减少上游域名和内容变更带来的风险。
