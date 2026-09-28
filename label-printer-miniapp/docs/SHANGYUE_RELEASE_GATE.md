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
- 场景模板不是恰好 300 套、来源不是 `shangyue-original` / `shangyue-curated`、含图片或素材，或任何一套未通过质量门（越界、字号、重叠、码区、黑边、文字放得下）、与另一套完全重复，或与同一纸张上的另一套版式骨架相同（撞版）；
- 商跃矢量素材不是恰好 76 个独立路径条目，或缺少 `shangyue-vector-v2` / `vector` 来源标记；
- 缺少原创元数据，或引用非商跃资源目录的公开模板。

BLE 机型兼容代码、用户主动导入适配器与“随包分发第三方内容”应分开审计，不能简单按 `NIIMBOT` 关键词全删。

公开包构建：

```powershell
npm run release:shangyue
```

默认产物在 `dist/shangyue-release/`；该目录已存在时，自动使用带时间戳的新目录，并在输出中打印准确路径。下游检查和导入必须使用本次打印的路径，不得继续指向旧包。可以用 `npm run release:shangyue -- <全新目录>` 明确指定输出；已有目录会被拒绝，构建不会删除或覆盖旧文件。

产物已排除固化精臣模板、图片、素材和目录客户端，是 CI 或自定义上传器的内容输入。公开包只包含小程序内容；需要完整、可导入微信工具的验收项目时，使用[微信验收项目准备工具](./WECHAT_ACCEPTANCE_SETUP.md)。该工具要求真实 AppID，并启用域名检查。

若使用微信开发者工具从仓库根目录预览，`npm run check` 会按 `packOptions.ignore` 的实际上传集合计算包体。文件数和包体以本次门禁输出为准；远程开源字体按需加载，不把字体二进制写入主包。
