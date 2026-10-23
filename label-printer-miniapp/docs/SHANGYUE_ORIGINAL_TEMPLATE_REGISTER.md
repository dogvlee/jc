# 商跃公开模板来源与授权登记

本文件记录商跃公开货架 22 套模板的创作来源与工程证据链。22 套均为“商跃原创”；其中 5 套于 2026-09-28 由权利人决定从“精诚授权改编”转为自有，设计历史保留在本文件的内部记录中。本文件用于版本追踪和第三方内容隔离，不代替著作权登记、商标核验、劳动/委托创作协议或律师意见。

## 公开口径

- 商跃原创（22 套）：`shangyue-wish-card`、`shangyue-price-tag`、`shangyue-bin-label`、`shangyue-name-sticker`、`shangyue-fresh-date`、`shangyue-jewelry-tag`、`shangyue-garment-tag`、`shangyue-ship-label`、`shangyue-cable-tag`、`shangyue-asset-tag`、`shangyue-biz-card`、`shangyue-med-label`、`shangyue-seat-card`、`shangyue-bakery-tag`、`shangyue-desk-plate`、`shangyue-lab-tag`、`shangyue-serial-cable`、`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag`。

内部设计历史（不对外展示）：`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag` 最初参考精诚同类模板的用途，2026-08-18 独立重做版式、文案和码值（布局距离 ≥ 0.25、不复用整行文案、不含对方图片/字体/素材），2026-09-28 去黑边后再次修订。权利人于 2026-09-28 决定这 5 套作为商跃原创发布，对外标记 `© 2026 商跃`。如与精诚的授权约定对署名另有要求，以约定为准。

## SY-OT-001：商跃心意祝福卡

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-wish-card` |
| 作品名称 | 商跃心意祝福卡 |
| 首版日期 | 2026-08-16 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-wish-card-v1.png`（640×480，SHA-256 `45737271c651558cf0d57c62597501bc9e1879f1cac330d86a7ed4f857943147`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版，全部由可编辑文字、线条、矩形、二维码和序列号组成 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `生日快乐，愿你常欢喜。`（非占位链接或内部代号） |

### 独立创作说明

外部参考包中的 50×30「祝福」截图只用于确认用户场景是“可编辑祝福卡”。其花卉边框、爱心图片、ZT195 字体、50×30 构图、文字位置和在线模板数据均未复用。

本模板采用留白双栏、反白“送给你”小签、短文本二维码和可递增编号；纸张改为 40×30mm。源码测试会持续检查：

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
4. “商跃原创”只用于上述 22 套货架模板，以及经洁净室流程重做、通过全部门禁和人工看图的商跃模板；不得给 `niim-import`、`online-niim` 或远程第三方内容加该标记。

## SY-OT-002：商跃零售价签

| 字段 | 记录 |
|---|---|
| 模板 ID | `shangyue-price-tag` |
| 作品名称 | 商跃零售价签 |
| 首版日期 | 2026-08-17 |
| 当前版本 | 1.0.0 |
| 署名标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-price-tag-v1.png`（640×480，SHA-256 `dd371845753a31a11480dc1a2bc9075495f59fb974824223615a37443e83efa7`） |
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
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-bin-label-v1.png`（640×480，SHA-256 `2cd54a81677b1d88106d899bb8eed3434b1f74bf3e32f715a7e83c6e5a20dbfa`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 洁净室独立排版：反白“库位”小签、货位码、SKU/批次、序列号、右侧入库二维码 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `BIN://A-12-08/LM-WH-0817` |

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
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-name-sticker-v1.png`（640×480，SHA-256 `af550eb82411b22a4cdff874105bd8b3c169c5054742d6ca4947b960ee746ce9`） |
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
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-fresh-date-v1.png`（640×480，SHA-256 `a4d5dba02be437f7961e954a48f98461b9fe2288cd1844ef0b4e77d95c5710f5`） |
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
| 权属分类 | 商跃原创（2026-09-28 由授权改编转为自有） |
| 设计历史 | 内部记录：最初参考精诚同类用途，版式、文案与码值独立重做 |
| 对外标记 | `© 2026 商跃` |
| 小程序源码 | `miniprogram/app/catalog.js`、`miniprogram/app/template-layouts.js` |
| 实际渲染缩略图 | `miniprogram/assets/shangyue-thumbs/shangyue-wifi-card-v1.png`（640×480，SHA-256 `6b394d88a11a187db232a89b582ea568eda11c84960a7c38d503a55ff6b503d2`） |
| 网页/App 镜像 | `../niim-label-app/src/app/catalog.js`、`../niim-label-app/src/app/template-layouts.js` |
| 设计方式 | 独立重设计：左侧标准 `WIFI:` 二维码、右侧访客凭据和反白密码框 |
| 第三方图片 | 无 |
| 第三方字体 | 无；仅使用运行环境通用 `sans-serif` |
| 目标纸张 | 40×30mm；适配当前 B 系 203dpi profile |
| 二维码正文 | `WIFI:T:WPA;S:HQ-Guest;P:hq202609;;` |

### 重设计说明

SSID / 密码均为虚构样例，版面上保留“打印后请改密码”。与 `wifi-code` 的元素类型序列不同，也不引用精诚原稿中的图片、字体或远程素材。

## 其余 16 套模板登记

本组 16 套均为商跃原创（其中 4 套于 2026-09-28 由授权改编转为自有）。全部由文字 / 线 / 矩形 / 条码 / 二维码 / 日期 / 序列号组成，无第三方图片或字体，纸张宽度 ≤ 40mm 以适配 B 系 203dpi。对照图在 `output/shangyue-compare/`。

| 登记号 | 模板 ID | 名称 | 权属分类 | 纸张 | 对照旧稿 | 缩略图 SHA-256 |
|---|---|---|---|---|---|---|
| SY-AR-002 | `shangyue-promo-tag` | 商跃促销价签 | 商跃原创（2026-09-28 由授权改编转为自有） | 40×30 | `promo-price` | `2a88b664579fbf50c2701e87e1b5f0fa3218dc0e1e469018c69e4e1fd28b2f4d` |
| SY-OT-008 | `shangyue-jewelry-tag` | 商跃珠宝吊牌 | 商跃原创 | 40×30 | `jewelry-price` | `ba20122e3bfad8450c130db511d274803b3140f88c570a453c5371f65f314994` |
| SY-OT-009 | `shangyue-garment-tag` | 商跃服装吊牌 | 商跃原创 | 40×30 | `clothing-tag` | `b108a969a57c912b841cc9ce333c5419c073da13068bf78d781c66bdcb71098c` |
| SY-OT-010 | `shangyue-ship-label` | 商跃物流简签 | 商跃原创 | 40×30 | `shipping-bin` | `7d466c9ff7f4c8d7dad89c9a35b26496fdf33dcf6ea9f1d9ae5d4dab974b0f6d` |
| SY-OT-011 | `shangyue-cable-tag` | 商跃线缆标识 | 商跃原创 | 40×12 | `cable-name` | `263286e73765e6026be6415d9504a20b6cae35d82bedf7384315a4f30fde4997` |
| SY-OT-012 | `shangyue-asset-tag` | 商跃固定资产 | 商跃原创 | 40×30 | `asset-card` | `d2c8c36db4cd4f6bec57005c34f4aba4db413b4400024683c2163cdd078a9b4d` |
| SY-OT-013 | `shangyue-biz-card` | 商跃商务名片 | 商跃原创 | 40×30 | `business-card` | `ff7d9a915bc18f8e47e7b42db29342c1f84b99acc6d5f2a62ced0fe1b8060edc` |
| SY-AR-003 | `shangyue-kitchen-date` | 商跃餐饮效期 | 商跃原创（2026-09-28 由授权改编转为自有） | 40×30 | `catering-date` | `b774152e31b3a458a4eda12bb692cb8c2d85fc8229977de0bc7c5854073705fa` |
| SY-OT-015 | `shangyue-med-label` | 商跃药品签 | 商跃原创 | 40×20 | `medicine-box` | `8c324099f870429dc0dae9ac227fbcfb0fa9ab0142b17b7163c97de41f396a52` |
| SY-OT-016 | `shangyue-seat-card` | 商跃席卡 | 商跃原创 | 40×30 | `wedding-invite` | `0ae58a458af757caaa72411c736d30054f1938b5c3111c45210e324c06d9c869` |
| SY-OT-017 | `shangyue-bakery-tag` | 商跃烘焙价签 | 商跃原创 | 40×30 | `bakery-tag` | `5156ced25055a5669e2401a3870e6fc9c91fefa3c40b193c8fe5ec6b628b2eef` |
| SY-AR-004 | `shangyue-plant-tag` | 商跃植物签 | 商跃原创（2026-09-28 由授权改编转为自有） | 40×30 | `plant-care` | `cc7d67ffa5946534d001de6a336b60aa36ed580f645dcca134f98bf500fca4e3` |
| SY-OT-019 | `shangyue-desk-plate` | 商跃工位牌 | 商跃原创 | 40×30 | `office-desk` | `0852a376f168dce59668f2ab3aa2d1954d2a43bcefb6c49c3d007a0182a6fa83` |
| SY-OT-020 | `shangyue-lab-tag` | 商跃样品签 | 商跃原创 | 40×20 | `lab-sample` | `76e2fd3e6feb365cd07e6468179bbffb84d26e28945fa35693aed3af6660063d` |
| SY-AR-005 | `shangyue-care-tag` | 商跃洗涤说明 | 商跃原创（2026-09-28 由授权改编转为自有） | 40×30 | `garment-care` | `cadd8ad8b63acc8b4831b779b730581aa971d199dc756b949b868e64468eea06` |
| SY-OT-022 | `shangyue-serial-cable` | 商跃线号序列 | 商跃原创 | 30×12 | `serial-cable` | `cd9d5541bd1667b11ecae6faafdb1cfb86c33cef2a744622d7a0c859f710ad5e` |

所有 16 套都不含 `image` / `material`、不含精臣/NIIMBOT/95598 文案，文字 ≥ 2.2mm，缩略图由真实渲染导出。其中 12 套商跃原创按洁净室证据链登记；4 套授权改编仅记录资产、字体和完整文案未直接复用，不因版式差异或素材隔离而改标为“商跃原创”。

### 2026-08-18 二次重设计

> 本节的来源标记要求已由下文“2026-09-28 权属调整”取代。

`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag` 升级为 2.0.0：分别改为左码右凭据、上置条码+右价格舱、双时间窗格、三栏照护仪表和面料侧栏+四格参数。这 5 套统一归类为“精诚授权改编 · 商跃重设计”：用户已确认获得精诚同意，书面凭证待归档，任何对照图、文档、货架或发布说明都不得将它们标为“商跃原创”。布局距离不小于 0.25、可见文案不复用完整行，仅作为重设计差异性证据，不改变授权改编属性。

## 商跃场景模板（精选 300 套，独立货架，不并入默认 22 套）

2026-09-28 起替换原 8,100 条程序化“行业库”。原库把内部编号（如 `SY/WS-B11`）当标题印在标签上，大量条目只有一两行字，无法保证逐套可用，已下架；生成器移到 `scripts/lib/legacy-library/`，只供内部转换流水线使用，不再随包分发。

- 应用模块：`miniprogram/app/curated/`（`layout.js` 版式原语、`recipes/*.js` 48 个场景配方各 1–3 种版式、`index.js` 300 条目录、`quality.js` 质量门、`text-metrics.js` 字宽估算）
- 命名：`sy-tpl-<场景>-<宽>x<高>-<版式序号>`（`-00` 为该场景的第一种版式），显示名 `商品价签 · 云南青提`；徽章“原创”，`© 2026 商跃`，`source: shangyue-curated`
- 规模与配比：300 套 = 场景 × 版式 × 常用纸张，**300 套版式各不相同**，示例内容在版式与尺寸之间轮换。按本地精诚模板快照的**汇总统计**（各场景与纸张的出现频次）分配套数：价签类约 30%，效期 / 餐饮约 15%，其余为仓储物流、办公人员、工业质检、线缆通信、实验、医护与生活。统计只用于决定“做哪些场景、哪些尺寸”，不读取、不复用任何单个模板的版式、坐标、文案、图片或字体
- 内容：示例商品、人名、地址、电话、条码均为虚构；EAN-13 校验位由代码计算；日期元素全部打印时自动计算（到期日 = 打印时刻 + 保质时长），取餐号、箱号、资产编号、样品编号为自动递增流水号，资产二维码与样品条码跟随编号
- 质量门（`tests/curated-library.test.js`、发布门禁逐套执行）：越界、字号 ≥ 2.2 mm、码区 ≥ 2 打印点/模块、黑边（`EDGE_*`）、**文字按声明字号放得下（`TEXT_OVERFLOW`）**、**印刷内容框零重叠**、**同一纸张上任意两套版式骨架不同（`layoutSkeleton`，换文字不算新版式）**、无完全重复、无内部编号或 `undefined` 文本
- 人工看图：`npm run curated:sheets` 用无头 Chrome 按每页 24 张渲染到 `output/shangyue-curated/`，并用真实 Canvas 测量标出任何被自动缩小的文字；2026-09-28 版本 300 套全部看过，缩小为 0
- 预览：模板页“场景模板”分页与预览弹层由 `core/mini-preview.js` 按真实版式实时绘制（条码 / 二维码按真实编码生成），不再显示通用示意图

### 2026-09-28 去黑边修订

用户反馈部分商跃模板打印后出现黑边。原因是 22 套货架模板都有距纸边 0.4–0.8 mm 的整圈外框，其中多套还有贴边的实心竖条或通栏黑色顶栏；热敏机走纸约有 0.5–1 mm 偏差，一偏就印成一侧黑边、另一侧留白。本次修订：

- 22 套全部去掉整圈外框和贴边竖条；顶栏、面料侧栏、价格舱改为距纸边至少 1.5 mm 的圆角色块；内容距纸边至少 1 mm（40×30 版式统一留 2 mm）。
- 商跃行业库 8,100 条同步去掉外框、信号轨、环行卡角标和信息栅角线，内容框按纸张留 1.5–2.5 mm 安全边距；取号场景的甲乙丙改为三种不同骨架，避免撞版。版本升至 2.1.0。
- 质量门禁新增 `EDGE_FRAME`（整圈外框）、`EDGE_INK`（1.5 mm 内的线条、色块、表格、反白字）、`EDGE_TOO_CLOSE`（1 mm 内的任何元素），由 `tests/template-quality.test.js` 对货架、批量模板和场景模板全量检查（原行业库已于同日由 300 套场景模板替换，见上文）。
- `shangyue-asset-tag` 的盘点二维码、`shangyue-serial-cable` 的条码改为“跟随序号递增”，连续打印时每张的码与编号一致；线号序列改为反白 `LN` + 纯数字编号，条码只编码数字。
- 资产签、工位牌、名片补页脚细线与说明，平衡下方留白。
- 缩略图改为透明底 + 白色圆角纸张卡片（描边与投影只存在于预览，不打印），22 张重新渲染，SHA-256 已同步更新到上表与 `catalog.js`。Web 端（niim-label-app）仍使用自己的旧版式与缩略图，本次未改动。

### 2026-09-28 权属调整

权利人决定：`shangyue-wifi-card`、`shangyue-promo-tag`、`shangyue-kitchen-date`、`shangyue-plant-tag`、`shangyue-care-tag` 5 套货架模板作为商跃原创发布。代码中 `APPROVED_AUTHORIZED_REDESIGN_TEMPLATE_IDS` 清空，5 套并入 `APPROVED_ORIGINAL_TEMPLATE_IDS`，徽章为“原创”，`copyright` 为 `© 2026 商跃`，编辑器与首页不再显示“授权改编”。设计历史保留在本文件内部记录，不写入用户可见字段。今后经洁净室流程（只提取用途与字段、版式和文案由商跃重做、通过全部门禁并人工看图）产出的模板，同样以商跃原创发布。

### 2026-09-28 文字放得下修订

新增 `TEXT_OVERFLOW` 门禁后，货架 22 套中有 5 套共 10 处文字按声明字号放不下（打印时会被渲染器自动缩小）：连网码（“WPA2 · GUEST”“SY · VISITOR”“PASS welcome26”“商跃连网 · 临时凭据”）、促销价签（到手价 ¥6.90）、商务名片（邮箱）、植物签（“CARE / P-026”）、洗涤说明（“100%”“COTTON”“SY-2601”）。已改为能放下的文案或字号；连网码示例密码改为 8 位 `sy202609`（WPA 密码至少 8 位），二维码正文同步。5 张缩略图重新渲染，SHA-256 已更新。

### 2026-09-28 版式去重修订

权利人要求 300 套场景模板“都是不同的版式”。原 300 套是“配方 × 纸张 × 示例内容”，同一配方同一纸张只换示例文字：按版式骨架（`quality.layoutSkeleton`：元素种类、反白 / 加粗 / 字号档与大致位置，忽略文字和分隔线）统计只有 142 种不同版式（按精确几何统计为 190 种，多出的部分只是字号随文字长短变化），另有 6 组不同场景长得一样（如口味贴、收纳分类、姓名贴都是“大字 + 一行小字”）。本次修订：

- 47 个配方增加第二种版式（Wi-Fi 卡本来就按 4 种纸张各一套），商品价签的两个配方各有三种；同一纸张上同一配方的每套模板各用一种版式。
- 口味贴、收纳分类、开封标签、冷冻标签、灭菌标签、试剂标签、收纳罐的第一种版式重新设计，与相近场景区分；灭菌标签增加化学指示卡粘贴框。
- 新增门禁：同一纸张上任意两套模板版式骨架不得相同（单元测试与发布门禁），印刷内容框零重叠（单元测试）；顺带修正 3 处内容框重叠，含原促销价签“限时特价”标签压到日期框。
- 结果：300 套 = 300 种版式，覆盖 11 个大类、48 个场景配方；全部通过越界、字号、黑边、码区、文字放得下与零重叠检查，并逐张看图（真实 Canvas 缩小为 0）。批量模板 12 套仍为各场景第一种版式，字段标记不变。

### 2026-09-30 标签不印商跃品牌

用户用模板给自己的商品、货位、工位打标签，印出来的内容不应带商跃品牌。此前货架 22 套中有 19 套会印出反白品牌签或品牌落款（如“商跃原创”“商跃价签”“商跃仓储”“商跃”“商跃效期”“商跃科技有限公司”），场景模板中有 40 套的示例店名 / 公司名含“商跃”（商跃超市、商跃小厨、商跃科技等），示例码值还用 `SY` 作前缀（`SY-Guest`、`SYJ8842`、`SY20260928001` 等）。本次修订：

- 货架 22 套：品牌签改为说明用途的中性文字（如“明码标价”“库位”“姓名”“效期提醒”“固定资产”“用药提醒”“发往”“员工”），落款改为“临时凭据 · 勿外传”“本店专享优惠”“后厨专用 · 超时即弃”等；名片示例公司改为虚构的“星河科技有限公司”。字号、位置与样式不变，全部通过文字放得下与黑边门禁。
- 码值去掉 `SY` 前缀：货位二维码 `BIN://A-12-08/LM-WH-0817`、连网码 `WIFI:T:WPA;S:HQ-Guest;P:hq202609;;`、珠宝条码 `JW8842`、物流单号 `HD1024`，对应文字同步；内置批量底稿同样去掉 `SHANGYUE JEWELRY`、“商跃团队”等字样。
- 场景模板 300 套：示例店名 / 公司名换成多个虚构中性名称（邻里超市、街角超市、巷口小厨、绿野轻食、南巷小店、星河科技、云帆科技、清屿服饰等），示例单号、工号、货号、SSID 去掉 `SY` 前缀；替换文字与原文等宽，300 套的版式、坐标与字号逐项不变。
- 模板名称、徽章“原创”与 `© 2026 商跃` 等元数据不变，只改印在纸上的内容。`tests/template-quality.test.js` 新增门禁：货架、批量底稿与 300 套场景模板的文字、码值、日期标签、序列号前后缀与表格单元格均不得出现“商跃”/“Shangyue”或 `SY` 码前缀。
- 19 张缩略图重新渲染（其余 3 张内容未变，渲染结果逐字节相同），SHA-256 已同步更新到上表与 `catalog.js`。
