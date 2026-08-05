# Grok 执行计划：标签编辑与 BLE 打印应用

> 本文是交给 Grok 的直接执行指令。按阶段工作、逐项验收、提交小步 commit。不要把静态推断写成已经验证的事实，也不要在没有对应实体打印机证据时宣称兼容某个型号。

## 0. 执行规则

1. 先读代码和测试，再修改；优先沿用现有结构，不做无关重构。
2. 每次开始工作先运行 `git status --short`，保护用户已有改动，不覆盖或回退不属于本任务的修改。
3. 每个结论使用三种状态之一：
   - `VERIFIED`：自动化测试、实体硬件或可复现构建已经证明。
   - `INFERRED`：来自公开资料或静态线索，尚未通过实体行为确认。
   - `TODO`：没有证据，不能作为产品承诺。
4. 修改打印协议、profile、位图编码或 BLE 写入方式时，必须先补失败测试或硬件证据，再改实现。
5. App 和小程序共享协议思路，但不是复制目录。修复共同的纯 JS 逻辑时，应同步测试向量，避免两端静默分叉。
6. 所有 BLE 原始日志默认仅保存在本机；提交前删除或掩码 MAC、设备 ID、序列号、账号、路径和其他个人信息。
7. 阶段依赖实体设备、发布账号、AppID 或签名密钥而无法继续时，提交已经完成的工具和文档，并把阻塞项写清楚；不伪造成功结果。

## 1. 任务与边界

### 1.1 任务

在现有洁净室实现上，交付一个离线可用、可安装、可诊断、可发布的 Android 标签编辑与 BLE 打印 App，并保留微信小程序实现。第一目标是让用户在目标 D11/D110、B1、B21 系列实体机器上完成可重复的端到端打印；随后补齐可靠持久化、打印历史、CSV 批量工作流和正式 AAB 发布链路。

最终产品必须满足：

- 无账号时也能创建、编辑、保存、恢复和导出本地标签。
- 预览使用的文档、方向和阈值与实际发送给打印机的 1bpp 数据一致。
- 未识别或未验证的 model ID 默认阻止打印，并提供诊断导出。
- 打印失败、断连或 App 重启后，不会把任务误报为成功，也不会静默继续发送剩余数据。
- 兼容性声明可追溯到具体机型、固件、Android 版本、MTU 和实体打印记录。
- 正式包可从干净环境构建，签名秘密不进入 Git。

### 1.2 非目标

- 不追求逐像素复制 NIIMBOT 原 App 的品牌、素材或界面。
- 不复用、发布或链接原 XAPK/APK 内的 Flutter AOT、DEX、`.so`、字体、图片、配置资源或其他专有内容。
- 不绕过登录、支付、会员、授权、签名、固件、区域、耗材/RFID/NFC 校验或服务端访问控制。
- 没有官方 API 契约和合法凭证时，不实现账号、云模板、商城、支付、团队、订单或售后接口。
- 不根据相似设备名猜测新型号协议，不将“能连接”当作“能正确打印”。
- 不提交 APK、AAB、XAPK、提取目录、密钥、`.env`、设备原始日志或本机 SDK/toolchain。

## 2. 仓库与启动方式

### 2.1 当前工作区

```text
E:\项目\jc\
  GROK_EXECUTION_PLAN.md       本执行计划
  label-printer-app\           Android/Web App，独立 Git 仓库和父仓库子模块
  label-printer-miniapp\       微信小程序，由父仓库直接跟踪
  research\                    本地研究材料，禁止提交和复制到产品
```

父仓库本地基线是 `bd21f09`，remote 配置为 `https://github.com/dogvlee/jc.git`，但该 GitHub 仓库是否已经创建必须先验证。Android/Web 子仓库是公开可拉取的：

- URL：`https://github.com/dogvlee/label-printer-app.git`
- 已验证 `main` commit：`45383227f163ce8e23e84337944542691f87328b`

### 2.2 新电脑完整拉取

先验证父仓库是否存在：

```powershell
git ls-remote https://github.com/dogvlee/jc.git
```

只有命令成功后才执行：

```powershell
git clone --recurse-submodules https://github.com/dogvlee/jc.git
cd jc
git submodule update --init --recursive
git status --short
```

如果父仓库返回 `Repository not found`，不要假装已经同步。可以先单独取得 Android/Web 项目：

```powershell
git clone https://github.com/dogvlee/label-printer-app.git
cd label-printer-app
npm.cmd ci
npm.cmd run verify
```

完整工作区仍需仓库所有者先创建 `dogvlee/jc`，再从当前电脑推送父仓库。不要把 `label-printer-app` 当普通目录重复加入父仓库；它是 submodule。

### 2.3 分支与环境

```powershell
cd E:\项目\jc\label-printer-app
git switch -c grok/p0-hardware-validation
npm.cmd ci
npm.cmd run verify
```

要求：

- Node.js 20 或更高版本。
- Android Studio、Android SDK（API 35）和 JDK 21。
- Android 实机用于 BLE；浏览器和模拟器只能验证 UI、文档、位图与模拟 transport。
- 微信开发者工具用于小程序；BLE 打印必须真机调试。

## 3. 已验证基线

以下是开始本计划前的基线，Grok 必须先复跑，失败时先定位环境或回归，不要直接继续开发。

| 范围 | 当前结果 | 状态 |
| --- | --- | --- |
| Android/Web 纯 JS 测试 | 15 个测试文件、53 项通过 | `VERIFIED` |
| Web 构建 | `npm run build` 和构建内容校验通过 | `VERIFIED` |
| 浏览器布局 | 320x700、390x844、800x900、1280x900 无横向溢出，关键流程通过 | `VERIFIED` |
| Android 构建 | Capacitor Android debug 构建通过 | `VERIFIED` |
| Android 15 模拟器 | 安装、启动和核心 UI 检查通过 | `VERIFIED` |
| 最近 debug APK | `artifacts/label-studio-modern-ui-debug.apk` | `VERIFIED`，但不在 Git |
| 最近 APK SHA-256 | `F09D6AF192056982815F0CB7D40309A1D83CFCC58DEBA06EAE25AA99E14B7D10` | `VERIFIED` |
| 微信小程序纯 JS 测试 | 33 项通过 | `VERIFIED` |
| 小程序发布身份 | `project.config.json` 仍为 `touristappid` | `TODO` |
| 目标打印机实物打印 | 尚无当前用户硬件验收记录 | `TODO` |
| 正式签名 APK/AAB | 当前仅 debug 签名 | `TODO` |

当前实现已经包含：标签文档、Canvas 预览、文字/EAN-13/Code 128/二维码/图片/基础图形/日期/流水号/表格/符号、1bpp 编码、协议帧解析、打印计划、BLE 扫描连接、基础模板、CSV 导入导出和本地打印历史。不要重复实现已有功能；先从测试和页面行为确认差距。

关键入口：

- `label-printer-app/src/core/protocol.js`
- `label-printer-app/src/core/print-plan.js`
- `label-printer-app/src/core/profiles.js`
- `label-printer-app/src/core/image-encoder.js`
- `label-printer-app/src/services/platform-ble-api.js`
- `label-printer-app/src/services/ble-session.js`
- `label-printer-app/src/services/printer-client.js`
- `label-printer-app/src/services/store.js`
- `label-printer-app/src/services/csv.js`
- `label-printer-app/src/app/main.js`
- `label-printer-app/src/app/views.js`
- `label-printer-app/docs/PORT_PLAN.md`
- `label-printer-miniapp/APK_ANALYSIS.md`
- `label-printer-miniapp/miniprogram/core/`
- `label-printer-miniapp/miniprogram/services/`

## 4. 洁净室与法律边界

允许使用的证据：

- 公开协议资料和具有兼容许可的开源实现，且记录 URL、版本/commit 和许可证。
- 本项目现有的独立源码、测试向量和第三方 notice。
- 用户合法持有的打印机，通过本 App 产生的 GATT 枚举、请求/响应、实体标签和故障行为。
- 原 App 的公开可见功能名称仅可用于建立功能清单，不能作为协议正确性或实现完成的证据。

禁止的行为：

- 从原 App 二进制反编译后复制业务代码、常量表、算法实现、素材或私有 SDK。
- 修改原 APK、去壳、注入、破解签名或绕过认证/付费/授权/耗材/固件限制。
- 将 `NIIMBOT_6.6.6_APKPure.xapk`、`research/` 或提取物放进 commit、Release、测试 fixture 或产品包。
- 调用未获授权的私有云 API，抓取其他用户数据或提交任何真实账号 token。

若某项需求只能通过上述禁止方式完成，标记为 `BLOCKED: requires authorized specification`，不要实现替代性绕过。

## 5. 架构约束

1. `src/core/` 保持纯 JS：不访问 DOM、Capacitor、微信或存储 API，输入输出可序列化。
2. 协议帧、位图编码、打印时序分别由 `protocol.js`、`image-encoder.js`、`print-plan.js` 负责，禁止把机型分支散落到 UI。
3. `profiles.js` 是设备能力和已验证协议映射的唯一事实来源。
4. Android transport 当前基于 `@capacitor-community/bluetooth-le`。除非实体测试证明该插件无法满足串行、MTU、通知或写入需求，不要先重写自定义 Kotlin BLE 栈。
5. `BleSession` 负责 GATT 生命周期、串行请求、超时、通知重组和断连；`PrinterClient` 负责设备信息与打印命令；UI 不直接写 characteristic。
6. 完整协议帧是逻辑写入单位。若 `MTU - 3` 小于帧长，应明确失败；不能静默把协议帧切成多个 GATT write，除非实体证据证明目标协议允许且有对应测试。
7. 连接成功不等于 profile 已验证。未知 model ID 必须阻止打印并允许导出诊断。
8. 浏览器 preview transport 必须清楚标为模拟设备，不能产生实体兼容性记录。

## 6. P0：实体 BLE 闭环与证据系统

这是最高优先级。完成 P0 前，不新增云端、商城或大规模编辑器功能。

### P0.1 固化可复现基线

执行：

```powershell
cd E:\项目\jc\label-printer-app
npm.cmd ci
npm.cmd run verify
npm.cmd run android:debug

cd E:\项目\jc\label-printer-miniapp
npm.cmd ci
npm.cmd test
```

处理浏览器审计的可移植性：当前 `scripts/ui-smoke.mjs`、`scripts/ui-refresh-audit.mjs` 和 `scripts/template-final-audit.mjs` 从 Codex 本机 runtime 路径加载 `playwright-core`。改为项目锁定的开发依赖或一个可配置、失败信息明确的统一 browser helper，确保 Grok 在新电脑通过 `npm ci` 就能运行。将脚本写进 `package.json`，例如 `audit:ui`、`audit:templates`，不要依赖用户目录中的隐藏缓存。

检查/修改：

- `label-printer-app/package.json`
- `label-printer-app/package-lock.json`
- `label-printer-app/scripts/ui-smoke.mjs`
- `label-printer-app/scripts/ui-refresh-audit.mjs`
- `label-printer-app/scripts/template-final-audit.mjs`
- 可新增 `label-printer-app/scripts/browser-runtime.mjs`

验收：干净 clone 后，只执行 `npm ci`、启动本地服务和审计脚本即可在四个 viewport 复现通过结果；页面异常、console error、横向溢出或空 Canvas 均导致非零退出。

### P0.2 增加本地诊断记录与导出

新增一个有界、默认关闭的诊断记录器，至少采集：

- App commit/version、平台、Android 版本和手机型号。
- 扫描到的广播名与 RSSI；设备地址在导出时哈希或掩码。
- 连接/发现/订阅/MTU/断连各阶段耗时和错误。
- service UUID、write/notify characteristic UUID、properties、write type。
- 请求 MTU、实际 MTU、`maxWriteSize`。
- TX/RX 的时间、命令 ID、帧长度、校验结果和掩码后的十六进制；不记录账号和用户标签正文。
- model ID、协议版本、firmware、hardware、电量等读取结果及其原始响应状态。
- 打印任务参数、状态迁移、首个失败命令和错误码。

检查/修改：

- `src/services/platform-ble-api.js`
- `src/services/ble-session.js`
- `src/services/printer-client.js`
- `src/app/main.js`
- `src/app/views.js`
- `src/services/store.js`
- 新增 `src/services/diagnostics.js`
- 新增 `tests/diagnostics.test.js`

要求：环形上限，避免无限增长；一键清除；导出 JSON 带 `schemaVersion`；所有字节转换有单测；诊断失败不能破坏打印；生产默认不把日志上传网络。

验收：preview transport 和至少一台 Android 实机都能生成可解析的诊断 JSON；断连和超时能定位到具体阶段；导出文件不含完整设备地址或用户标签内容。

### P0.3 把 profile 声明改为证据驱动

当前代码映射仅表示“实现中存在”，不是实体兼容性证明：

| 族/候选 profile | 当前代码中的 model ID | 当前任务时序 | 开始状态 |
| --- | --- | --- | --- |
| D110 / D11 新协议 | 2304、2305；512 在 protocolVersion 1/2 时 | `d110` | `INFERRED` |
| D11 / D11S 旧协议 | 514；512 的其他协议版本 | `d11Legacy` | `INFERRED` |
| B1 | 4096 | `b1` | `INFERRED` |
| B21 / B21_L2B | 768、769 | `b21Legacy` | `INFERRED` |
| B21_C2B | 771、775 | `b1` | `INFERRED` |
| B21S / B21S_C2B | 776、777 | `d110` | `INFERRED` |
| B21 Pro | 无 | 不得套普通 B21 | `TODO/UNSUPPORTED` |

在 `profiles.js` 中为声明增加最小必要元数据，例如 `supportStatus`、`verifiedModels`、`evidenceRef` 和明确能力；UI 只显示事实，不写“全系列支持”。如果没有硬件记录，状态保持 experimental/unverified。不要仅凭名称把新 model ID 添加到表中。

检查/修改：

- `src/core/profiles.js`
- `src/core/print-plan.js`
- `src/services/printer-client.js`
- `src/app/views.js`
- `tests/profiles.test.js`
- `tests/print-plan.test.js`
- 小程序对应的 `miniprogram/core/profiles.js` 与测试（仅在同步同一条已验证证据时）

验收：成功读取到未知 model ID 时，打印按钮被阻止并提示导出诊断；已知但未实测 profile 明确显示“待实机验证”；只有具有对应证据文件的组合才能标为 verified。

### P0.4 实体硬件验证矩阵

每个实际拥有的 D11、D110、B1、B21 变体分别建记录，不以“同系列”合并。建议目录：

```text
label-printer-app/docs/hardware/
  README.md
  matrix.json
  <family>-<model-id>-<firmware>.md
```

原始 trace 和实物照片放 `artifacts/hardware/`，默认不提交；提交脱敏摘要和能证明 parser/print-plan 行为的最小合成 fixture。每条记录必须包含：

- 测试日期、App commit、APK SHA-256。
- 手机型号、Android 版本。
- 广播名、model ID（十进制和十六进制）、协议版本、firmware、hardware。
- service/write/notify UUID、properties、write type、请求/实际 MTU。
- 标签宽高、纸型、方向、浓度、阈值、份数、水平/垂直偏移。
- 命令序列摘要、结果、诊断文件哈希、实物照片引用。
- 明确结论：passed、failed 或 blocked，并记录失败的第一条命令。

每台设备执行：

| 用例 | 操作 | 通过标准 |
| --- | --- | --- |
| H01 | 首次授权、扫描、连接、读取信息、断开、重连 | 无需杀进程；状态和诊断准确 |
| H02 | 打印方向/边距校准图一份 | 实物方向正确，可测量偏移 |
| H03 | 文字、横线、矩形、1px/2px 图案 | 无截断、错行或多余走纸 |
| H04 | EAN-13、Code 128、二维码 | 常用手机扫码器可读 |
| H05 | 1、2、5 份打印 | 实际份数准确，任务只完成一次 |
| H06 | 打印中取消 | 停止后不继续发送后续行；状态为 cancelled |
| H07 | 打印中断开/关闭蓝牙 | 快速失败，可重连，不误报成功 |
| H08 | 安全地模拟缺纸/开盖（设备支持时） | 错误码和用户提示正确，不继续发数据 |
| H09 | 前后台切换和屏幕旋转 | 文档不丢，连接状态不撒谎 |
| H10 | 最大允许宽度和接近上限长度 | 无越界、内存崩溃或协议帧拆分 |

低电量、过热等状态只在自然出现且安全时记录，不为测试故意损害设备。

P0 总验收：至少用户要求首发支持的每个具体机型/固件有一条完整 passed 记录；没有实体设备的 profile 保持 unverified；任何失败组合不得进入正式兼容列表。

## 7. P1：持久化、恢复与打印历史

目标是消除当前分散的 `localStorage` 状态，让文档、模板、图片资产和打印结果在 App 重启、升级和异常退出后保持一致。

### 工作项

1. 先为当前键 `label-app:projects`、`templates`、`settings`、`data-rows` 和 `print-history` 写读取兼容测试。
2. 定义版本化数据模型和迁移器；迁移失败保留原数据并给出可导出恢复文件。
3. 小设置可用 Capacitor Preferences；大量文档/历史使用 IndexedDB 或明确的 repository；图片复制到 App 私有 Filesystem，只在文档中保存 `assetId` 和校验和，不依赖临时 blob/content URL。
4. 打印任务保存不可变的文档、打印机、profile 和 options 快照，状态至少有 queued/rendering/printing/succeeded/failed/cancelled/interrupted。
5. App 被杀或重启时，把未完成硬件任务标为 interrupted，绝不自动继续发送；用户明确点击后才能重试。
6. 历史详情支持再次打印、导出诊断、删除和清理；失败历史保留第一错误和阶段。
7. 提供 JSON 导入/导出，校验 `schemaVersion`、尺寸、元素和资源引用；不接受路径穿越或任意文件写入。

主要文件：

- `src/services/store.js`
- `src/app/main.js`
- `src/app/views.js`
- `src/core/document.js`
- 可新增 `src/data/repository.js`、`src/data/migrations.js`、`src/services/assets.js`
- 对应新增/扩展 `tests/store.test.js`、`tests/document.test.js`、`tests/assets.test.js`

验收：从旧基线数据升级不丢文档；含图片模板重启后仍能预览和打印；异常退出后不会出现“成功”假记录；导出再导入的文档语义一致；损坏数据不会导致整个 App 白屏。

## 8. P2：CSV 与可恢复批量打印

当前已有基础 `src/services/csv.js` 和页面入口，P2 是完成工作流，不是再写一个 parser。

### 工作项

1. 保留 RFC 风格引号、逗号和换行测试，增加 BOM、CRLF、空表头、重复表头、超长单元格和非法编码错误。
2. 导入后提供表头识别、列映射、前若干行预览、类型/空值校验和错误行下载。
3. 文档元素使用稳定字段 ID 绑定数据列；重命名显示名不能破坏绑定。
4. 批量计划在开始前冻结模板和数据快照，逐条渲染并展示总数、当前行、成功、失败、跳过和剩余。
5. 断连、打印机错误或用户取消时停止队列。重试默认只处理失败/未开始项，不重复成功项。
6. 流水号只在实体打印确认成功后提交；失败或取消不消耗，规则必须有纯函数测试。
7. 批次结果可导出 CSV/JSON，包含行号、状态、时间和错误，但不包含 BLE 地址或原始 trace。

主要文件：

- `src/services/csv.js`
- `src/core/document.js`
- `src/core/renderer.js`
- `src/services/printer-client.js`
- `src/app/main.js`
- `src/app/views.js`
- `tests/csv.test.js`
- 新增 `src/services/batch-print.js` 和 `tests/batch-print.test.js`

验收：包含引号和多行字段的 CSV 可往返；100 行 preview transport 批次无重复/漏项；在第 N 行注入断连后，第 N 行失败、后续停止、前 N-1 行不被重打；实体设备先用 5 行小批次通过再提高数量。

## 9. P3：Android 正式构建、签名与发布

### P3.1 发布配置

1. 由仓库所有者确认最终 `applicationId`、应用名、版本号和图标版权；不要擅自使用不属于项目的 NIIMBOT 商标或素材。
2. release 构建关闭 WebView 调试，检查 mixed content、备份策略、导出组件和明文流量。
3. Gradle 从环境变量或未跟踪的 `keystore.properties` 读取签名；只提交 `.example`，绝不提交 keystore、密码或真实 alias。
4. 建立 `versionCode` 单调递增规则和 `versionName` 语义版本规则。
5. 审核 Android 7-15 权限：Android 12+ BLE scan/connect；旧版本按实际需要；保持 `androidNeverForLocation` 声明与真实用途一致。
6. 检查第三方许可证和隐私说明，明确 BLE、相机、文件、诊断导出的本地数据用途。

主要文件：

- `capacitor.config.json`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/proguard-rules.pro`
- `android/app/src/main/res/`
- `THIRD_PARTY_NOTICES.md` 或现有同类 notice
- 新增 `keystore.properties.example`、`docs/RELEASE.md`

### P3.2 构建与验证命令

Debug：

```powershell
cd E:\项目\jc\label-printer-app
npm.cmd run verify
npm.cmd run android:sync
cd android
.\gradlew.bat clean test lint assembleDebug
```

Release（仅在签名环境已提供时）：

```powershell
cd E:\项目\jc\label-printer-app
npm.cmd run android:sync
cd android
.\gradlew.bat clean test lint assembleRelease bundleRelease
```

安装与基本检查：

```powershell
adb devices
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.labelstudio.mobile/.MainActivity
adb logcat -c
```

若最终更改 `applicationId`，同步替换启动 component。使用 SDK 自带 `apksigner verify --verbose --print-certs <apk>` 校验 APK；使用 `bundletool validate --bundle <aab>` 校验 AAB。生成 SHA-256 并附到 Release notes，二进制放 GitHub Releases，不进源码 commit。

### P3.3 发布验收

- 干净 clone 可构建 debug；具备签名 secret 的 CI/受控机器可构建 signed AAB。
- `git ls-files` 不含密钥、密码、APK/AAB、原始硬件日志或研究提取物。
- Android 7、10、12、13、14、15 至少覆盖权限/启动/存储迁移；BLE 最终结论仍以实体机为准。
- debug 到 release 升级和上一 release 到新 release 升级后文档与图片不丢。
- 冷启动、离线启动、旋转、后台恢复、拒绝权限、关闭蓝牙和进程被杀均有明确结果。
- Release notes 列出经过实体验证的精确型号/固件，未验证型号明确不承诺。

## 10. P4：扩展与明确延期项

P0-P3 稳定后才处理：

1. 微信小程序同步经过证明的纯 JS 协议/profile 修复，并保持 33 项现有测试及新增向量通过。
2. 仓库所有者提供正式微信 AppID；AppSecret 只能放后台或 CI secret，永不写入 `project.config.json`。
3. 新打印机型号必须重复 P0 全矩阵。B21 Pro、D110M v4、300 dpi、Wi-Fi、USB、RFID/NFC、热转印等分别建独立 transport/profile，不套用相似名称。
4. 编辑器增强按用户价值排序：对齐/吸附、多选、字体与排版、图片裁剪/抖动、模板文件夹、商品字段；每项必须有文档迁移和渲染回归测试。
5. 账号、云模板、团队、会员、订单、商城、支付和售后保持 `BLOCKED`，直到拿到授权的服务端 API、测试环境、数据模型、隐私政策和凭证管理方案。
6. 不做无后端的假登录、假支付或仅展示静态页面的“完成”状态。

P4 验收：每个独立功能有真实契约和测试；每个新增硬件有实体记录；小程序隐私声明和真机 BLE 验收完成后才发布。

## 11. 自动化与浏览器审计

P0 完成可移植性修改后，标准命令应为：

```powershell
cd E:\项目\jc\label-printer-app
npm.cmd ci
npm.cmd run verify
```

终端 A：

```powershell
npm.cmd run dev
```

终端 B：

```powershell
$env:BROWSER_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run audit:ui
npm.cmd run audit:templates
```

审计必须至少覆盖 320x700、390x844、800x900、1280x900，并验证：

- 页面和 body 无横向溢出。
- 首页、模板、数据、设置、编辑器、设备面板和打印面板可达。
- Canvas 非空，模板均有有效像素。
- 按钮、sheet、导航和上下文工具不重叠。
- 没有未处理 page error 或 console error。

每个阶段结束还要执行：

```powershell
git diff --check
npm.cmd test
npm.cmd run build
```

小程序共同逻辑有变更时：

```powershell
cd E:\项目\jc\label-printer-miniapp
npm.cmd ci
npm.cmd test
```

## 12. 每阶段交付物

### P0

- 可移植的 browser audit 命令。
- 脱敏诊断 JSON schema、导出入口和测试。
- profile 支持状态和硬件证据引用。
- 每台可获得设备的硬件验收记录、诊断哈希和结论。
- 只包含已通过组合的兼容性清单。

### P1

- 版本化 repository、迁移测试、资源持久化。
- 可靠打印历史、interrupted/retry 行为。
- JSON 导入导出与损坏数据恢复路径。

### P2

- CSV 映射与预览。
- 可停止、可恢复、不会重打成功项的批量队列。
- 批次结果导出和实体小批次记录。

### P3

- Release 构建说明、签名模板、权限和隐私审计。
- signed APK/AAB（通过 Releases 交付）、SHA-256、版本说明。
- Android 版本矩阵和升级/恢复报告。

### P4

- 小程序同步验证或新功能专项交付。
- 每项扩展的契约、测试、迁移和明确支持范围。

## 13. 全局完成标准

只有同时满足以下条件，才可宣告首个正式版本完成：

1. Android/Web 自动化测试、构建校验和四 viewport 审计全部通过。
2. 首发支持列表中的每个精确 printer model ID + firmware 组合有实体 passed 记录。
3. 条码和二维码实体可扫，方向、偏移、份数、取消、断连和错误处理符合矩阵。
4. 未知/未验证型号默认阻止打印，诊断可导出且已脱敏。
5. 文档、模板和图片在重启与升级后可恢复；未完成任务不会被误报或自动续打。
6. CSV 批次在注入失败时不会重复成功项，结果可审计。
7. signed AAB 可验证，Release 二进制和哈希已产出，Git 中无秘密或专有提取物。
8. 第三方 notice、隐私说明、支持范围、已知限制和回滚版本齐全。

## 14. Commit 与检查点策略

每个 commit 只解决一个可验证主题，建议顺序：

```text
test: make browser audits reproducible
feat: add redacted BLE diagnostic export
test: enforce evidence-backed printer profiles
docs: record <model-id> hardware validation
feat: add versioned local data migrations
feat: persist print jobs and recovery states
feat: add resumable CSV batch printing
build: configure environment-based release signing
docs: add Android release and compatibility matrix
```

每次 commit 前：

```powershell
git status --short
git diff --check
npm.cmd test
npm.cmd run build
```

涉及核心协议时额外运行浏览器审计和 Android debug 构建；涉及硬件时附对应记录但不提交未脱敏原始 trace。

注意嵌套仓库顺序：

1. 在 `label-printer-app` 内提交并推送 App commit。
2. 回到 `E:\项目\jc`，确认父仓库只显示 submodule 指针变化及有意修改。
3. 再提交父仓库中的 submodule 指针、计划或小程序变更。
4. 父仓库 remote 确实存在后才 push；失败时报告真实错误，不强推、不改历史。

推荐每个 P 阶段打一个 annotated tag 或 GitHub milestone。阶段报告固定包含：commit、执行命令、通过/失败数量、硬件证据、未解决风险和下一步；不得只写“已完成”。

## 15. Grok 开始时的第一批动作

1. 读取本计划、`docs/PORT_PLAN.md`、App README、两个 `package.json` 和上述关键源码。
2. 检查两个 Git 工作区状态、Node/JDK/Android SDK 版本和远程可达性。
3. 复跑 53 项 App 测试、33 项小程序测试、Web build 和 Android debug build。
4. 建 `grok/p0-hardware-validation` 分支，先完成 browser audit 可移植化和诊断记录器。
5. 向设备所有者索取首发精确型号、固件和可用于测试的实体设备清单；没有设备时只交付验证工具，不声称兼容。
6. 按 P0 矩阵逐台执行，证据通过后再更改 profile 支持状态。

