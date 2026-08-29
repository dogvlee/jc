# 商跃公开包版权门禁

当前 `miniprogram/` 是内部开发根目录，仍保留第三方模板、缩略图和素材用于兼容回归，**不能脱离项目配置直接打包或复制上传**。仓库根目录的 `project.config.json` 已用 `packOptions.ignore` 排除同一批研究资源；微信开发者工具必须从该项目根目录导入，不能另建一个丢失忽略规则的工程。

公开包必须先构建到独立目录，再执行：

```powershell
node scripts/check-shangyue-release.mjs <待上传的小程序根目录>
```

门禁会失败拦截：

- 固化的导入 / 在线第三方模板模块与数据；
- 第三方模板图片、缩略图和原始素材；
- 固定第三方内容目录客户端与域名；
- `online-niim`、`niim-import`、`remote-niim` 来源；
- 默认 22 套中未显式设置 `releaseApproved: true`，或来源不是 `shangyue-original` / `shangyue-authorized-redesign` 的模板；
- 行业库中来源不是 `shangyue-library`、缺少 `sy-semantic-grid-v2` 生成证据，或未通过 8,100 条全库质量门的组合预设；
- 商跃矢量素材不是恰好 76 个独立路径条目，或缺少 `shangyue-vector-v2` / `vector` 来源标记；
- 缺少原创元数据，或引用非商跃资源目录的公开模板。

BLE 机型兼容代码、用户主动导入适配器与“随包分发第三方内容”应分开审计，不能简单按 `NIIMBOT` 关键词全删。

公开包构建：

```powershell
npm run release:shangyue
```

产物在 `dist/shangyue-release/`，已排除固化精臣模板、图片、素材和目录客户端，是 CI 或自定义上传器的首选输入。若使用微信开发者工具从仓库根目录预览/上传，`npm run check` 会按 `packOptions.ignore` 的实际上传集合计算包体；当前主包为 75 个文件、1,492,177 字节（1.42 MiB）。20 个远程开源字体按需加载，不把字体二进制写入主包。
