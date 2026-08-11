# 模块参考

## 1. 阅读约定

本文按当前源码逐模块列出责任、主要导出、调用方、可观察副作用和测试。除页面与配置外，小程序运行代码使用 CommonJS。

“纯”表示模块本身不访问 `wx` 或持久化外部状态；它仍可能分配对象、抛出校验错误，或按函数契约修改传入对象。“间接测试”表示由上层模块测试经过，不等于该模块所有分支都有独立断言。

## 2. 应用入口与页面

| 模块 | 责任 | 主要导出/页面入口 | 调用方 | 副作用 | 测试 |
|---|---|---|---|---|---|
| `miniprogram/app.js` | 组合应用级仓储、BLE 会话、打印客户端和连接管理器 | `App({ onLaunch, globalData })` | 微信小程序运行时 | 启动迁移；注册 BLE 监听；保存全局实例；800 ms 后尝试 force-fresh 恢复上次设备 | 无独立测试；连接与仓储逻辑由对应服务测试，项目结构由 `npm run check` 检查 |
| `miniprogram/app.json` | 声明页面、窗口主题、基础运行选项 | `pages/home/index`、`pages/editor/index` | 微信小程序运行时 | 决定页面注册和导航栏 | `scripts/check-project.mjs` 验证页面配套文件 |
| `pages/home/index.js` | 首页虚拟分区、模板/项目/批量数据/设置/历史、扫码建标、导入导出和编辑器入口 | `Page(...)` 方法 | WXML 事件、小程序生命周期 | 读写 storage；相机扫码；选择/读写/分享文件；弹窗；导航；订阅连接状态 | 无独立 home 页面测试；下层由 `scanner`、`scan-label`、`csv`、`data-bind`、`repository`、模板测试覆盖，WXML 事件由静态检查覆盖 |
| `pages/home/index.wxml` | 首页、模板、项目、批量数据、“我的”和各 sheet 视图 | 页面模板 | 微信渲染层 | 绑定页面事件、展示本地数据 | `npm run check` 检查结构与处理器存在 |
| `pages/home/index.wxss` | 首页视觉和布局 | 无 | 微信样式层 | 视觉呈现 | 无视觉自动化；需开发者工具/真机检查 |
| `pages/editor/index.js` | Canvas 编辑、元素属性、扫码填入、手势、撤销/重做、自动保存、设备选择、预检、打印和取消 | `Page(...)` 方法 | WXML 事件、小程序生命周期 | Canvas 绘制；storage；相册/相机/扫码；用户文件复制；BLE；弹窗；打印历史 | `tests/editor-page.test.js`；扫码、几何、渲染、连接、打印等下层测试；WXML 静态检查 |
| `pages/editor/index.wxml` | 编辑器工具栏、双 Canvas、属性区、设备/设置/打印/图层/素材/边框 sheet | 页面模板 | 微信渲染层 | 绑定触摸和页面事件 | `npm run check` 检查结构与处理器存在 |
| `pages/editor/index.wxss` | 编辑器视觉、Canvas 外框和 sheet 布局 | 无 | 微信样式层 | 视觉呈现 | 无视觉自动化；需开发者工具/真机检查 |

页面 JSON 只定义页面级窗口/组件配置，当前没有自定义组件目录。

## 3. `miniprogram/app/` 应用组合模块

| 模块 | 责任 | 主要导出 | 主要调用方 | 副作用/状态 | 测试 |
|---|---|---|---|---|---|
| `app/catalog.js` | 合并 32 套基础、4 套导入和 153 套固化目录模板；提供分类和查找 | `categories`、`industries`、`templates`、`homeQuickActions`、`getTemplate`、`templatesByCategory`、`templatesByIndustry` | 首页、`template-layouts` 测试、`data-bind` 测试 | require 时组合大数组；不访问网络 | `tests/online-templates.test.js`、`tests/template-layouts.test.js`、`tests/data-bind.test.js` 间接覆盖 |
| `app/data-bind.js` | 把一行 `name/code/price/date` 数据应用到模板文档；批量构造文档 | `applyRowToDocument`、`buildDocumentsFromRows`、`looksLikeCode`、`looksLikePrice` | 首页批量生成、测试 | **修改传入文档**及元素值/格式；无 I/O | `tests/data-bind.test.js` |
| `app/imported-templates.js` | 在加载期转换 4 个 NIIM JSON 模板，并按 ID 提供深拷贝 | `IMPORTED_TEMPLATES`、`getImportedTemplate`、`buildImportedDocument` | `catalog.js`、`template-layouts.js` | require 时解析 JSON并构建文档；返回时 JSON 深拷贝 | `tests/niim-template-import.test.js`、`tests/online-templates.test.js` 间接覆盖 |
| `app/online-templates-pack.js` | 固化原“在线目录”的 153 套元数据和可编辑文档构建数据 | `ONLINE_TEMPLATES`、`getOnlineTemplate`、`buildOnlineDocument` | `catalog.js`、`template-layouts.js` | 大型静态模块进入主包；无运行时网络请求 | `tests/online-templates.test.js` |
| `app/stock-presets.js` | 常用纸张尺寸与显示名称 | `STOCK_PRESETS`、`findPreset`、`stockLabel` | 首页、`data-bind` 测试 | 纯 | `tests/data-bind.test.js` 间接覆盖 |
| `app/template-layouts.js` | 依据模板 ID 构造完整可编辑文档；组合基础/导入/固化模板构建器 | `LAYOUT_BUILDERS`、`buildTemplateDocument` | 首页、批量生成、测试 | 创建新文档；不写存储 | `tests/template-layouts.test.js`、`tests/online-templates.test.js`、`tests/data-bind.test.js` |

## 4. `miniprogram/core/` 领域模块

### 4.1 文档、编辑与显示

| 模块 | 责任 | 主要导出 | 主要调用方 | 副作用/状态 | 测试 |
|---|---|---|---|---|---|
| `core/document.js` | 创建文档/10 类元素、JSON 克隆、放置、边界限制和旋转命中测试 | `createDocument`、`createElement`、`cloneDocument`、`placeNewElement`、`clampElement`、`hitTest` | 仓储、模板构建、导入器、首页、编辑页、多个 core 测试 | 使用模块级 ID 序号和 `Date.now()`；多个函数修改传入元素 | `tests/document.test.js`、`tests/dynamic-elements.test.js`、`tests/editor-page.test.js` 等 |
| `core/geometry.js` | 文字方向切换、旋转元素缩放、吸附、角度和选择内容适配 | `changeTextDirection`、`changeTextMode`、`fitElementToSelectionBounds`、`normalizeAngleDelta`、`pointerAngle`、`resizeRotatedElement`、`snapElementPosition`、`snapScalar` | 编辑页、`text-style.js` | 方向/缩放函数修改传入元素；吸附函数返回新坐标/辅助线 | `tests/geometry.test.js`、`tests/editor-snap.test.js`、`tests/text-direction.test.js` 间接覆盖 |
| `core/editor-gesture.js` | 编辑器 chrome 颜色/尺寸、长按多选和大触摸命中区域 | `CHROME`、`handleHitRegion`、`longPressSelection` | 编辑页、渲染器 | 纯、常量冻结 | `tests/editor-gesture.test.js` |
| `core/date-links.js` | 日期主项/效期伴随项的语义复制、同步与解除 | `LINKED_DATE_FIELDS`、`companionDates`、`copyDateSemantics`、`linkedPrimary`、`syncLinkedDates`、`unlinkDate` | 当前仅测试 | 修改文档元素和日期字段；可删除伴随元素 | `tests/date-links.test.js`；**当前编辑页主路径未接入** |
| `core/text-direction.js` | 六种文字模式元数据、模式规范化和弧角限制 | `TEXT_MODE_OPTIONS`、`normalizeTextMode`、`legacyDirectionForMode`、`clampTextArcAngle` | 编辑页、几何、渲染器 | 纯、选项冻结 | `tests/text-direction.test.js`、几何/渲染测试间接覆盖 |
| `core/text-style.js` | 恢复文字/日期/表格的排版默认值 | `resetTextStyle` | 当前仅测试 | 修改传入元素，可能通过 geometry 恢复水平盒 | `tests/text-style.test.js`；**当前编辑页主路径未接入** |
| `core/image-cache.js` | 用路径和请求 token 防止异步旧图片覆盖新路径 | `createImageCacheRegistry` | 当前仅测试 | 内部 `WeakMap`/`Map`；修改调用方 images 字典 | `tests/image-cache.test.js`；**当前编辑页仍使用自己的 imageLoadPromises，未接入本模块** |
| `core/borders.js` | 20 种边框目录、筛选和 Canvas 绘制 | `BORDER_CATALOG`、`BORDER_CHIPS`、`borderById`、`bordersForChip`、`drawBorderStyle` | 编辑页、渲染器 | 绘制传入 Canvas context | `tests/borders-table-shape.test.js` |
| `core/materials.js` | 144 个素材目录、15 个原图清单、筛选、应用和 Canvas 符号绘制 | `DEFAULT_MATERIAL_CHIP`、`MATERIAL_CATALOG`、`MATERIAL_CHIPS`、`ORIGINAL_MATERIAL_CATALOG`、`ORIGINAL_MATERIAL_MANIFEST`、`applyMaterialToElement`、`drawMaterialSymbol`、`materialChipAfterSearchToggle`、`materialById`、`materialCategories`、`materialsForChip` | 编辑页、渲染器 | require JSON 清单；应用函数修改元素；绘制 Canvas | `tests/materials.test.js`、`tests/dynamic-elements.test.js`、`tests/borders-table-shape.test.js` 间接覆盖 |
| `core/renderer.js` | 文档校验、mm→dot、文字/日期/序列号/条码/二维码/图片/形状/表格/素材渲染、选择框和二值化 | `validateDocument`、`renderDocument`、`renderSelection`、`mmToDots`、`fitText`、`wrapText`、`formatDateValue`、`formatDateChip`、`formatTimeChip`、`resolveDateTime`、`serialValue`、`binarizeImageData`、`contentHandleLocalMm` | 编辑页、首页批量预验证、测试 | 绘制 Canvas；选择渲染会给元素设置不可枚举 `_fit` 并可能删除旧 `_fit` | `tests/renderer.test.js`、`tests/dynamic-elements.test.js`、`tests/date-links.test.js`、`tests/materials.test.js`、`tests/borders-table-shape.test.js` |

### 4.2 条码、模板导入与打印纯逻辑

| 模块 | 责任 | 主要导出 | 主要调用方 | 副作用/状态 | 测试 |
|---|---|---|---|---|---|
| `core/bytes.js` | Uint8Array 转换/连接、16 位大端、读大端、位计数、异步等待 | `asUint8Array`、`concatBytes`、`countBits`、`readU16be`、`u16be`、`sleep` | 协议、编码、计划、BLE、客户端、连接管理器 | 除 `sleep` 使用计时器外为纯函数 | 无独立测试；由 protocol/image-encoder/print-plan/BLE/client 测试间接覆盖 |
| `core/code128.js` | Code 128B 编码 | `encodeCode128B` | 渲染器 | 纯；非法输入抛错 | `tests/code128.test.js`、`tests/renderer.test.js` 间接覆盖 |
| `core/ean13.js` | EAN-13 校验位与编码 | `checksum`、`encodeEan13` | 渲染器 | 纯；非法输入抛错 | `tests/ean13.test.js`、`tests/renderer.test.js` 间接覆盖 |
| `core/niim-template-import.js` | 把 NIIM JSON 模板/元素转换为本地文档，映射对齐、字体、码制和资源路径 | `importNiimTemplate`、`convertElement`、`mapAlignH`、`mapAlignV`、`parseFontStyle`、`isMissingImagePath`、`resolveImagePath`、`CODE_TYPE_MAP` | 导入模板模块、首页 JSON 模板导入 | 新建并填充文档；跳过畸形元素；不访问网络 | `tests/niim-template-import.test.js` |
| `core/scan-label.js` | 规范化扫码结果，区分一维码/二维码，限制长度，把结果写入元素或构造成新标签 | `MAX_BARCODE_VALUE_LENGTH`、`MAX_SCAN_VALUE_LENGTH`、`applyScanToElement`、`buildScanDocument`、`inferBarcodeFormat`、`isOneDimensionalType`、`normalizeScanResult` | 首页扫码建标、编辑页扫码填入 | `applyScanToElement` 修改传入元素；其他函数纯；校验失败抛带 code 的错误 | `tests/scan-label.test.js`、`tests/editor-page.test.js` 间接覆盖 |
| `core/profiles.js` | 设备 profile、型号/名称路由、预览尺寸、打印头对齐和非破坏式可打印性评估 | `PROFILES`、`getProfile`、`guessProfile`、`profileForModelId`、`previewCanvasSize`、`alignedCanvasSize`、`evaluatePrintability` | 首页、编辑页、打印逻辑测试 | 纯；非法/超尺寸抛错或返回阻断 | `tests/profiles.test.js`、`tests/print-plan.test.js` 间接覆盖 |
| `core/image-encoder.js` | RGBA 阈值二值化、方向转换、行 RLE、稀疏索引/位图/空行/检查行编码 | `encodeImageData`、`isBlackPixel`、`indexBlackPixels`、`pixelCounts`、`rowToCommand` | `PrinterClient`、`print-plan.js` | 纯；分配点阵数组 | `tests/image-encoder.test.js`、`tests/print-plan.test.js` 间接覆盖 |
| `core/print-plan.js` | 按 task 组合密度、纸型、开始、页面、份数、打印行和页面结束时序 | `buildPrintPlan`、`pageSizeData` | `PrinterClient` | 纯；份数/密度在计划内约束 | `tests/print-plan.test.js` |
| `core/protocol.js` | NIIMBOT 命令/响应枚举、帧编码、校验和增量解析 | `COMMAND`、`RESPONSE`、`PacketParser`、`checksum`、`encodePacket` | BLE 会话、打印客户端、编码和计划 | 编码纯；`PacketParser` 持有 buffer/errors 可变状态 | `tests/protocol.test.js`、`tests/ble-session.test.js` 间接覆盖 |

## 5. `miniprogram/services/` 服务模块

| 模块 | 责任 | 主要导出 | 主要调用方 | 副作用/状态 | 测试 |
|---|---|---|---|---|---|
| `services/repository.js` | schema v2 本地仓储、规范化、迁移、集合上限、备份/覆盖恢复/回滚 | `Repository`、`KEYS`、`LEGACY_KEYS`、`STORAGE_VERSION`、`defaultRows`、`defaultSettings`、`normalizeDocument` | `app.js`、首页、编辑页 | 同步读写/删除 storage；恢复时多键补偿；读取会过滤损坏文档 | `tests/repository.test.js` |
| `services/csv.js` | RFC 风格常用 CSV 引号解析、序列化和列映射 | `parseCsv`、`stringifyCsv`、`rowsToRecords` | 首页 | 纯；未闭合引号抛错 | `tests/csv.test.js` |
| `services/scanner.js` | Promise 化微信原生扫码，统一默认码型、取消、权限失败和不支持环境 | `scanCode` | 首页、编辑页 | 调用 `wx.scanCode`/注入 API；不写存储 | `tests/scanner.test.js` |
| `services/ble-session.js` | 适配器/扫描/GATT/可信通道/MTU/notify、完整帧写入、请求队列、解析和断线清理 | `BleSession`、`PRIMARY_SERVICE`、`PRIMARY_WRITE_CHARACTERISTIC`、`PRIMARY_NOTIFY_CHARACTERISTIC`、`callWx`、`withTimeout`、`isAlreadyConnectedError` | 连接管理器、编辑页后备、测试 | 调用微信 BLE API；注册全局监听；计时器；维护 parser/pending/queue/连接状态 | `tests/ble-session.test.js` |
| `services/printer-client.js` | NIIMBOT transport 后握手、信息读取、点阵计划发送、任务族完成等待和取消 | `PrinterClient` | 连接管理器、编辑页后备 | 发送 BLE 请求；维护 connecting/ready/printing/cancelled/pageIndex；使用计时器轮询 | `tests/printer-client.test.js`、`tests/print-plan.test.js` 间接覆盖 |
| `services/printer-connection-manager.js` | 应用级单例连接编排：单飞、TTL、OS 连接检查、already/zombie 恢复、持久化、自动重连、kill switch、诊断 | `PrinterConnectionManager`、`codedError`、`DEFAULT_DEVICE_STORAGE_KEY`、`DEFAULT_KILL_SWITCH_KEY`、`DEFAULT_SESSION_TTL_MS`、`DEFAULT_FAST_REUSE_TTL_MS`、`DEFAULT_REOPEN_DELAY_MS` | `app.js`、首页订阅、编辑页连接/诊断/打印前确认 | storage；适配器监听；重连计时器；连接缓存和订阅；调用 session/client | `tests/printer-connection-manager.test.js` |

服务所有权关系：

```text
PrinterConnectionManager
  ├─ owns/reuses BleSession
  └─ owns/reuses PrinterClient(BleSession)

Repository 独立于连接栈；二者只通过 lastDevice 存储键在应用装配层关联。
```

## 6. 数据、资源和 vendor

| 模块/路径 | 责任 | 调用方 | 副作用/风险 | 测试/门禁 |
|---|---|---|---|---|
| `data/niim-templates/*.json` | 4 个离线 NIIM 模板源数据 | `app/imported-templates.js`、导入测试 | 随包发布；内容和品牌再分发需授权 | `tests/niim-template-import.test.js` |
| `data/original-materials.json` | 原图素材元数据和路径清单 | `core/materials.js` | 随包路径必须存在 | `tests/materials.test.js`、静态资源检查 |
| `assets/materials/original/` | 15 个原始素材 PNG | 素材目录/渲染 | 占主包；授权与二值渲染质量需验收 | 静态资源检查、素材测试 |
| `assets/online-images/` | 固化模板引用图片 | 在线模板文档、渲染器 | 占主包；路径和授权风险 | `tests/online-templates.test.js`、静态资源检查 |
| `assets/online-thumbs/` | 模板列表缩略图 | 首页模板视图 | 占主包 | `tests/online-templates.test.js`、静态资源检查 |
| `vendor/qrcode.js` | `qrcode-generator` 的本地 CommonJS bundle | `core/renderer.js` | 第三方构建产物；不能手改后忘记重建/许可 | `tests/renderer.test.js`；`npm run build:vendor` 可重建 |
| `THIRD_PARTY_NOTICES.txt` | 小程序包内第三方告知 | 发布流程 | 法务/许可文本 | 人工审查 |

`app/online-templates-pack.js` 虽然名称包含 online，但当前是随包静态数据，不发网络请求。

## 7. 脚本和工程配置

| 模块 | 责任 | 主要入口 | 副作用 | 验证 |
|---|---|---|---|---|
| `scripts/check-project.mjs` | JS 语法、JSON、本地 Markdown 链接、页面配套、WXML 标签/表达式/事件处理器、静态资源和 2 MiB 主包检查 | `npm run check` | 只读扫描并启动 `node --check`；失败设置退出码 | 自身无测试，作为 `verify` 前置门禁 |
| `scripts/optimize_assets.py` | 素材优化/同步 | `npm run assets:sync` | **会重写资源输出**；执行前需确认输入和 worktree | 资源差异与项目检查 |
| `package.json` | Node 工具依赖和命令 | `test`、`test:coverage`、`check`、`verify`、`build:vendor`、`assets:sync` | 安装依赖或重建 vendor/资源时会写文件 | `npm run verify` |
| `project.config.json` | 微信开发者工具项目配置 | 开发者工具 | 当前 `touristappid` 不能代表正式发布配置 | 开发者工具编译/上传前人工门禁 |

## 8. 测试文件索引

当前 `tests/` 有 30 个 `*.test.js`：

| 测试 | 主覆盖模块/契约 |
|---|---|
| `ble-session.test.js` | BLE 超时、错误锁存、完整帧、可信 UUID、already、existing、竞态 |
| `printer-connection-manager.test.js` | 单飞、TTL、zombie、force-fresh、kill switch、自动重连、诊断、忘记设备 |
| `printer-client.test.js` | 握手、ready 失效、existing 重新握手 |
| `protocol.test.js` | 帧、校验、前导、拆包/粘包、坏帧恢复 |
| `print-plan.test.js` | D110、D11 legacy、B1、B21 legacy 时序 |
| `profiles.test.js` | 尺寸/打印头、建议 profile、名称和型号边界 |
| `image-encoder.test.js` | 方向、二值行、RLE、检查行、四类行命令 |
| `renderer.test.js` | Canvas 渲染、文字、条码、二维码、校验 |
| `document.test.js` | 元素默认值、边界、放置、命中 |
| `geometry.test.js` | 旋转几何、文字方向、选择适配 |
| `editor-snap.test.js` | 吸附和旋转缩放 |
| `editor-gesture.test.js` | 长按多选和触摸命中区 |
| `editor-page.test.js` | Page 方法、编辑交互和打印前页面逻辑 |
| `text-direction.test.js` | 六种文字模式和弧角 |
| `text-style.test.js` | 清除文字样式 |
| `date-links.test.js` | 日期伴随关系 |
| `dynamic-elements.test.js` | 日期、序列号、素材等动态元素 |
| `borders-table-shape.test.js` | 边框、表格和形状渲染 |
| `materials.test.js` | 素材目录、筛选、应用、路径 |
| `image-cache.test.js` | 异步图片路径 token 防陈旧写入 |
| `code128.test.js` | Code 128B |
| `ean13.test.js` | EAN-13 |
| `niim-template-import.test.js` | 四份 NIIM JSON 导入和字段映射 |
| `scan-label.test.js` | 扫码结果分类、EAN/Code128 推断、建标、目标类型和长度限制 |
| `scanner.test.js` | 微信扫码参数转发、取消/权限失败和不支持环境 |
| `template-layouts.test.js` | 模板构建器可编辑文档 |
| `online-templates.test.js` | 153 套固化模板、目录组合和静态资源 |
| `data-bind.test.js` | 批量字段推断和文档生成 |
| `csv.test.js` | CSV 引号、换行、映射和序列化 |
| `repository.test.js` | 文档规范化、迁移、上限、批量单写、备份、恢复回滚 |

运行方式：

```powershell
npm.cmd test
npm.cmd run test:coverage
npm.cmd run verify
```

`verify` 是“静态工程门禁 + Node 自动化”，不是微信编译和真机验收。BLE、Canvas 字体/像素、相册权限、用户文件、前后台恢复和打印样张必须在发布矩阵中另留证据。

## 9. 接入新模块的约束

1. 领域算法优先放 `core/`，避免直接依赖 `wx`。
2. 微信 API 放 `services/` 或页面边界，并允许依赖注入以便 mock。
3. 页面只能通过连接管理器发起稳定连接，不新增第二套全局 BLE 监听。
4. 新文档字段必须经过规范化和仓储测试；新存储键必须进入备份/迁移范围评审。
5. 新打印机必须明确 transport 协议族和 profile；FF00 ESC/POS 不能作为 E781 发现失败后的回退。
6. 新资源必须进入路径、主包体积、许可和视觉测试门禁。
