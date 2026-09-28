# 商跃公开模板来源与授权登记

本文件记录商跃公开货架 22 套模板的创作来源、授权关系与工程证据链。其中 17 套为“商跃原创”，5 套为“精诚授权改编 · 商跃重设计”；两类不得混标。本文件用于版本追踪和第三方内容隔离，不代替著作权登记、商标核验、劳动/委托创作协议或律师意见。

## 公开口径

- 商跃原创（17 套）：`shangyue-wish-card`、`shangyue-price-tag`、`shangyue-bin-label`、`shangyue-name-sticker`、`shangyue-fresh-date`、`shangyue-jewelry-tag`、`shangyue-garment-tag`、`shangyue-ship-label`、`shangyue-cable-tag`、`shangyue-asset-tag`、`shangyue-biz-card`、`shangyue-med-label`、`shangyue-seat-card`、`shangyue-bakery-tag`、`shangyue-desk-plate`、`shangyue-lab-tag`、`shangyue-serial-cable`。
- 精诚授权改编 · 商跃重设计（5 套）：`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag`。

用户已明确确认精诚同意对这 5 套模板进行改编与重设计，但书面授权凭证、授权范围和编号仍待归档。在凭证归档前后，这 5 套的来源标记都必须保持为“精诚授权改编 · 商跃重设计”，绝不标注为“商跃原创”，也不得据此暗示原作权利已转让。

## SY-OT-001：商跃心意祝福卡

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-wish-card` |
| 作品名称 | 商跃心意祝福卡 |
| 首版日期 | 2026-08-16 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-wish-card-v1.png`（640×480，SHA-256 `47b96220a1a9d8111091375c017fa2f3a2b5bd3ff01f24f1248ce423c446896e`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版，全部由可编辑文字、线条、矩形、二维码和序列号组成 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `生日快乐，愿你常欢喜。`（非占位链接或内部代号） |

### 独立创作说明

外部参考包中的 50×30「祝福」截图只用于确认用户场景是“可编辑祝福卡”。其花卉边框、爱心图片、ZT195 字体、50×30 构图、文字位置和在线模板数据均未复用。

本模板采用留白双栏、反白品牌签、短文本二维码和可递增编号；纸张改为 40×30mm。源码测试会持续检查：

- 不含 `image` / `material` 元素或第三方资源路径；
- 不含 NIIMBOT、精臣、95598、网上国网等第三方品牌文案；
- 与参考 `online-512427668` 的尺寸、元素类型序列和资源路径不同；
- 文字不小于 2.2mm，二维码在 203dpi 下通过编码校验；
- 首页缩略图由真实模板渲染导出，尺寸与 SHA-256 由测试锁定；
- 编辑、另存、重开与项目保存链持续保留 `origin`、`authorship`、`copyright` 和批量兼容元数据；
- B1/B21 类 384 点打印头可打印，D11/D110 的 12mm 高度限制会在打印前拦截。

### 发布前权属动作

1. 由实际权利主体确认“商跃”的完整公司/个人名称，并保存本文件、Git 提交、需求记录和首发样张。
2. 若创作者是员工或受托方，补齐职务作品或委托创作的书面权属约定。
3. 若要申请作品登记，提交最终样张和源码快照；登记材料中的作品名称、完成日期、权利人应与本记录一致。
4. “商跃原创”只用于上述 17 套本地洁净室模板；不得给 5 套精诚授权改编模板、`niim-import`、`online-niim` 或远程第三方内容加该标记。

## SY-OT-002：商跃零售价签

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-price-tag` |
| 作品名称 | 商跃零售价签 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-price-tag-v1.png`（640×480，SHA-256 `06a0c194b2930e906f09173181b8166a4ca55eedcd04907a55e37a4eb31783d4`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版：顶栏反白分区、品名、双价、EAN-13；无第三方图片或字体 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 场景来源 | 只参考“小店改价签”这一用户任务，不复用精臣价签底图或 `online-233730076` 构图 |

### 独立创作说明

- 不含 `image` / `material` 元素或第三方资源路径；
- 不含 NIIMBOT、精臣、95598、网上国网等第三方品牌文案；
- 与内置候选 `product-simple` 及参考 `online-233730076` 的尺寸、元素类型序列不同；
- 文字不小于 2.2mm，EAN-13 在 203dpi 下通过编码校验；
- 首页缩略图由真实模板渲染导出，尺寸与 SHA-256 由测试锁定。

## SY-OT-003：商跃仓储货位

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-bin-label` |
| 作品名称 | 商跃仓储货位 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-bin-label-v1.png`（640×480，SHA-256 `4112c62fe3069e9a8535d1eabe0047ecfe53a930625459055266abc8ccece7a6`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版：反白品牌签、货位码、SKU/批次、序列号、右侧入库二维码 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `BIN://A-12-08/SY-WH-0817` |

### 独立创作说明

外部仓储场景只用于确认用户要“货位 + 扫码入库”。其花卉/图标底图、精臣货架模板数据和元素序列均未复用。源码测试会持续检查：不含第三方图、与 `storage-code` 元素序列不同、二维码在 203dpi 下至少两格一点。

## SY-OT-004：商跃姓名贴

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-name-sticker` |
| 作品名称 | 商跃姓名贴 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-name-sticker-v1.png`（640×480，SHA-256 `5d69334d3cb5f24b2a863f4a4d43d18d04820ad422fc0987ee884bf85d2368a1`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版：横条签名、班级/部门、联系电话；40×20mm 不放二维码 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×20mm；适配当前 B 系 203dpi profile |

### 独立创作说明

只取“姓名条”这一任务，不复用精臣校园贴图或居中三行候选稿。占位姓名、电话均为虚构。与 `name-tag` 的元素类型序列不同。

## SY-OT-005：商跃效期签

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-fresh-date` |
| 作品名称 | 商跃效期签 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-fresh-date-v1.png`（640×480，SHA-256 `cf5cacce0e1d02af11091e5400c7cfe2ccc49213fe966ad6a022e72477ae0c6d`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版：顶栏冷藏分区、制作/食用日期表、开封提示 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |

### 独立创作说明

日期元素使用打印时自动计算，不写死日历。食用期限默认开封后 48 小时。与 `home-date` 的元素类型序列和顶栏构图均不同。

## SY-AR-001：商跃连网码

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-wifi-card` |
| 作品名称 | 商跃连网码 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 2.0.0 |
| 权属分类 | 精诚授权改编 · 商跃重设计 |
| 授权状态 | 用户已确认获精诚同意；书面凭证和授权编号待归档 |
| 对外标记 | `精诚授权改编 · 商跃重设计`；不得标为“商跃原创” |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-wifi-card-v1.png`（640×480，SHA-256 `e3901bf2944ed4091fccdc4bc152503e2e905f6874f0aef529a14c587e173d5a`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 在获得精诚同意的前提下改编并重设计：左侧标准 `WIFI:` 二维码、右侧访客凭据和反白密码框 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `WIFI:T:WPA;S:SY-Guest;P:welcome26;;` |

### 授权改编与重设计说明

SSID / 密码均为虚构样例，版面上保留“打印后请改密码”。与 `wifi-code` 的元素类型序列不同，也不引用精诚原稿中的图片、字体或远程素材；这些差异不改变其“授权改编”的来源分类。

## 其余 16 套模板登记

本组含 12 套商跃原创和 4 套精诚授权改编。全部由文字 / 线 / 矩形 / 条码 / 二维码 / 日期 / 序列号组成，无第三方图片或字体，纸张宽度 ≤ 40mm 以适配 B 系 203dpi。对照图在 `output/shangyue-compare/`；“无第三方素材”不等于“商跃原创”，授权改编的来源标记必须保留。

| 登记号 | 模板 ID | 名称 | 权属分类 | 纸张 | 对照旧稿 | 缩略图 SHA-256 |
|---|---|---|---|---|---|---|
| SY-AR-002 | `shangyue-promo-tag` | 商跃促销价签 | 精诚授权改编 · 商跃重设计 | 40×30 | `promo-price` | `81a0e68717b971977138f8b4fafe13d00e9fef9de2140ab3790bab8498536ec2` |
| SY-OT-008 | `shangyue-jewelry-tag` | 商跃珠宝吊牌 | 商跃原创 | 40×30 | `jewelry-price` | `8ea344ab92206911ef993fbdeb13ff74242e6c546f99763e77ab88fcf9294a28` |
| SY-OT-009 | `shangyue-garment-tag` | 商跃服装吊牌 | 商跃原创 | 40×30 | `clothing-tag` | `a84c689e92348459696d301f8c6ff9505b3242c53dc8cd55ee631e70e7e01531` |
| SY-OT-010 | `shangyue-ship-label` | 商跃物流简签 | 商跃原创 | 40×30 | `shipping-bin` | `3b386c0cff406b46c1ee2f838ccf77738522974a51427212afde91153ef3658a` |
| SY-OT-011 | `shangyue-cable-tag` | 商跃线缆标识 | 商跃原创 | 40×12 | `cable-name` | `263286e73765e6026be6415d9504a20b6cae35d82bedf7384315a4f30fde4997` |
| SY-OT-012 | `shangyue-asset-tag` | 商跃固定资产 | 商跃原创 | 40×30 | `asset-card` | `07662ebe90de133091d032e11b6cac61aee43526555be81ca18ed13efb934f3b` |
| SY-OT-013 | `shangyue-biz-card` | 商跃商务名片 | 商跃原创 | 40×30 | `business-card` | `d7f960e990caba274d31d3f493c976b351b6ed15cc44ba8c2f9b8b3ef4926a23` |
| SY-AR-003 | `shangyue-kitchen-date` | 商跃餐饮效期 | 精诚授权改编 · 商跃重设计 | 40×30 | `catering-date` | `6feffef5397678212b073f9d5a8241b7236056b12b22aec24968f0d66897d8a9` |
| SY-OT-015 | `shangyue-med-label` | 商跃药品签 | 商跃原创 | 40×20 | `medicine-box` | `7eb88b4098b854e265d808b231dbeba7ddcf353aae813faa9b4182f96326c75b` |
| SY-OT-016 | `shangyue-seat-card` | 商跃席卡 | 商跃原创 | 40×30 | `wedding-invite` | `952254754c24f811d798f36b49ac3aba5e6541be7ccc88760697712a8674f644` |
| SY-OT-017 | `shangyue-bakery-tag` | 商跃烘焙价签 | 商跃原创 | 40×30 | `bakery-tag` | `e1d7be276379c0586bb74fd49de006c3aaeba331f372b36e7a2bb6baf7afa634` |
| SY-AR-004 | `shangyue-plant-tag` | 商跃植物签 | 精诚授权改编 · 商跃重设计 | 40×30 | `plant-care` | `9db140567f60378967410baf423456535699976af8e2b5b639de607818dd4fa6` |
| SY-OT-019 | `shangyue-desk-plate` | 商跃工位牌 | 商跃原创 | 40×30 | `office-desk` | `6e5a8b41792b82713bbcb9cd050cdc8af402dde40389afdca0e5c0bb644fbcca` |
| SY-OT-020 | `shangyue-lab-tag` | 商跃样品签 | 商跃原创 | 40×20 | `lab-sample` | `76e2fd3e6feb365cd07e6468179bbffb84d26e28945fa35693aed3af6660063d` |
| SY-AR-005 | `shangyue-care-tag` | 商跃洗涤说明 | 精诚授权改编 · 商跃重设计 | 40×30 | `garment-care` | `31d269f9cf5b0db080195e8634b054d4a570666f8171d210da2f7cd444a933b0` |
| SY-OT-022 | `shangyue-serial-cable` | 商跃线号序列 | 商跃原创 | 30×12 | `serial-cable` | `cd9d5541bd1667b11ecae6faafdb1cfb86c33cef2a744622d7a0c859f710ad5e` |

所有 16 套都不含 `image` / `material`、不含精臣/NIIMBOT/95598 文案，文字 ≥ 2.2mm，缩略图由真实渲染导出。其中 12 套商跃原创按洁净室证据链登记；4 套授权改编仅记录资产、字体和完整文案未直接复用，不因版式差异或素材隔离而改标为“商跃原创”。

### 2026-08-18 二次重设计

`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag` 升级为 2.0.0：分别改为左码右凭据、上置条码+右价格舱、双时间窗格、三栏照护仪表和面料侧栏+四格参数。这 5 套统一归类为“精诚授权改编 · 商跃重设计”：用户已确认获得精诚同意，书面凭证待归档，任何对照图、文档、货架或发布说明都不得将它们标为“商跃原创”。布局距离不小于 0.25、可见文案不复用完整行，仅作为重设计差异性证据，不改变授权改编属性。

## 商跃行业库（独立行业货架，不并入默认 22 套）

商跃自有场景 × 常用纸张 × 自有占位文案生成的程序化库，不再读取第三方目录名录。

- 应用模块：`miniprogram/app/shangyue-library/`
- 对照目录：`output/shangyue-library/`（`index.json`、`stats.json`、`samples/`）
- 命名：`sy-lib-#####`，显示名 `商跃价签 · 青提 · 40×30甲`
- 不进入上述公开 22 套货架，也不计入“17 套商跃原创 + 5 套精诚授权改编”统计
- 不含第三方底图、元素、VIP 资源或品牌品名
- 规模口径：25 场景 × 18 纸张 × 6 份自有示例文案 × 3 个阅读路径 = 8,100 条组合预设；不得表述为“8,100 张逐张手绘原创作品”
- 2026-08-18 升级至 `sy-semantic-grid-v2`：`signal / orbit / ledger` 三套商跃母版、独立场景码、稳定内容种子和场景核心字段；AI 参与规则设计与样张审阅，但运行时由确定性代码生成
- 每个文档保留 `authorshipBasis: deterministic-clean-room-generator`、`sourceTemplateId: null`、`aiAssisted: true`、内容种子和布局种子
- 自动门禁覆盖 8,100 条的越界、字号、重叠、码区清晰度、空白、完全重复和甲乙丙撞版；评审数字以 `output/shangyue-library/stats.json` 为准

### 2026-09-28 去黑边修订

用户反馈部分商跃模板打印后出现黑边。原因是 22 套货架模板都有距纸边 0.4–0.8 mm 的整圈外框，其中多套还有贴边的实心竖条或通栏黑色顶栏；热敏机走纸约有 0.5–1 mm 偏差，一偏就印成一侧黑边、另一侧留白。本次修订：

- 22 套全部去掉整圈外框和贴边竖条；顶栏、面料侧栏、价格舱改为距纸边至少 1.5 mm 的圆角色块；内容距纸边至少 1 mm（40×30 版式统一留 2 mm）。
- 商跃行业库 8,100 条同步去掉外框、信号轨、环行卡角标和信息栅角线，内容框按纸张留 1.5–2.5 mm 安全边距；取号场景的甲乙丙改为三种不同骨架，避免撞版。版本升至 2.1.0。
- 质量门禁新增 `EDGE_FRAME`（整圈外框）、`EDGE_INK`（1.5 mm 内的线条、色块、表格、反白字）、`EDGE_TOO_CLOSE`（1 mm 内的任何元素），由 `tests/shangyue-library-quality.test.js` 对货架、批量模板和行业库全量检查。
- `shangyue-asset-tag` 的盘点二维码、`shangyue-serial-cable` 的条码改为“跟随序号递增”，连续打印时每张的码与编号一致；线号序列改为反白 `LN` + 纯数字编号，条码只编码数字。
- 资产签、工位牌、名片补页脚细线与说明，平衡下方留白。
- 缩略图改为透明底 + 白色圆角纸张卡片（描边与投影只存在于预览，不打印），22 张重新渲染，SHA-256 已同步更新到上表与 `catalog.js`。Web 端（niim-label-app）仍使用自己的旧版式与缩略图，本次未改动。
