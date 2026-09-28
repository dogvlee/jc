# 精臣授权输入 → 商跃重设计流水线

本流程用于把已获许可的第三方标签作为“用途输入”，转成可编辑、可打印、视觉独立的商跃设计。当前仓库只记录到操作者确认授权，书面凭证编号仍待归档；因此自动产物默认是内部审核候选，不会直接进入公开货架。

## 2026-09-28 权属决定

权利人决定：经本流程只提取用途与字段、由商跃版式重做、通过全部自动门禁并人工看图通过的模板，作为商跃原创发布（`© 2026 商跃`）。来源 ID、记录哈希等审计信息只留在内部产物和登记表中，不写入用户可见字段。如与精诚的授权约定对署名另有要求，以约定为准。

## 两条产线

1. 结构化模板优先读取名称、纸张尺寸、字段名和元素类型。只抽取场景、字段角色和信息层级，不把坐标、字体、图片、素材路径或完整示例文案送进生成器。
2. 只有截图而没有结构化数据时，才准备 AI 识图。计划文件会写入语义识别 prompt，并明确记录 `vision.invoked: false`、`status: not-invoked`；它不伪装已经调用过模型。真正调用视觉模型后仍只允许输出用途与字段语义 JSON；看不清就标 `unknown`，禁止回传原图坐标和装饰细节。

两条产线最终都进入商跃自己的版式工厂：选择甲/乙/丙布局语法，生成原生文字、日期、条码、二维码、线和矩形元素，而不是生成不可编辑的扁平图片。

## 自动门禁

- 来源或候选只要含 `image` / `raster` / `bitmap` / `material`，固定标为 `visual-review`，不得成为候选；
- 来源没有足够坐标进行结构比较时也固定标为 `visual-review`，不再把“无法比较”当作通过；
- 不复用来源模板中长度不少于 4 个字符的 `text`、`value`、`prefix`、`suffix`、`label` 或 `fixedValue`；
- 可比较时，归一化结构距离至少为 `0.25`；
- 来源含 `barcode`、`qrcode`、`date`、`table` 或 `serial` 等关键字段时，候选必须保留相同字段角色；
- 每个相同场景、文案、纸张组的甲乙丙必须是 3 个不同骨架；
- 元素不越界，文字、条码和二维码通过 203dpi 打印校验；
- 自动产物固定为 `publicCatalog: false`、`releaseApproved: false`，必须经人工看图和授权凭证复核。

授权状态和来源提供方只从输入集合的 `authorization`、`sourceProvider`（或集合来源字段）传播。输入未提供授权元数据时，状态为 `missing`、计划为 `authorization-review`，名称和来源标识都不会宣称“已授权”。同一 `sourceId` 的版式种子只由该 ID 决定，因此改变 `--limit` 或集合顺序不会改变生成内容。

## 运行

先生成 30 条内部审核计划：

```powershell
npm.cmd run plan:authorized-redesign -- --limit 30
```

处理完整本地快照时使用 `--limit 0`。输出默认写入 `output/shangyue-redesign/pilot-plan.json`，不会进入小程序包。

## 批量转私有工作流（全量 9161 条）

```powershell
# 1. 全量跑批：语义提取 → 商跃工厂重排 → 门禁审计
npm.cmd run redesign:batch

# 2. 人工评审：打开 output/shangyue-redesign/batch/review-sheet.csv
#    对照 sourcePreviewUrl（原稿预览）逐条看候选是否成立，
#    把通过的候选 ID（sy-redesign-…）写进 output/shangyue-redesign/approved-ids.txt

# 3. 生成可导入模板包
npm.cmd run redesign:install
```

产物说明：

- `batch/summary.json`：门禁分布（candidate / visual-review / manual-redesign-required）、结构距离直方、场景分布。
- `batch/review-sheet.csv`：每条一行的评审清单，含来源名、原稿预览 URL、候选名与门禁原因。
- `batch/candidates/candidates-*.json`：通过全部自动门禁的候选（完整可编辑文档 + 审计记录）。
- `batch/needs-review.json`：未通过自动门禁的记录（visual-review：原稿含图片需看图；manual：文案复用或关键字段缺失）。
- `approved-pack.json`：批准候选的合并包，可从小程序「模板 → 导入模板」直接批量导入「我的模板」（上限 80 个，超出不导入也不挤占既有模板）。

导入后的模板保留 `origin: shangyue-authorized-redesign-review` 等审计元数据，仅供本机使用与评审；对外货架发布仍需书面授权凭证归档并按登记表走 `SHANGYUE_ORIGINAL_TEMPLATE_REGISTER.md`。

## 发布前授权记录

至少归档：授权方主体、模板/图片/字体范围、是否允许 AI 处理与改编、是否允许商用再分发和白标、地域、期限、署名要求、授权编号或合同路径。若只有“允许改编”而没有白标或权利归属条款，对外宜标“精臣授权改编 / 商跃重设计”，不宜直接标“商跃原创”。
