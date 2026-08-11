# 精臣标签小程序需求追踪矩阵

文档状态：工程追踪基线；外部验收证据待补
适用版本：`1.0.0-rc.1`
更新日期：2026-08-11

## 1. 使用规则

本矩阵把产品需求、非功能要求映射到代码、自动化测试和微信/真机证据。状态含义：

- **自动通过**：有当前 Node/静态门禁证据，只证明所列自动化范围。
- **部分通过**：代码和部分测试存在，但关键 UI、平台或硬件行为待验。
- **待手工/真机**：无法由当前仓库自动化得出结论。
- **外部阻断**：依赖 AppID、账号权限、隐私/法务、设备或平台审核。
- **未知**：尚无需求决策或证据，不得按默认通过处理。

“已实现”不等于“已发布验收”。任何包含 BLE、Canvas、权限、文件分享、包上传或物理出纸的需求，都必须同时有对应平台/真机证据。

## 2. 证据索引

| 证据 ID | 内容 | 当前结果 | 证据位置/缺口 |
| --- | --- | --- | --- |
| AUT-VERIFY-CANDIDATE | `npm run verify` | 待冻结候选 commit 后重跑；数量以完整输出为准 | 在验收记录附 commit、时间、执行人和原始输出；开发过程快照不作最终证据 |
| AUT-COV-CANDIDATE | `npm run test:coverage` | 待在同一冻结 commit 重跑；百分比以完整输出为准 | 仅 Node 已加载模块和有限页面方法，不含 WXML/微信/相机扫码/真机 |
| AUT-PKG-CANDIDATE | 本地静态包体 | 待从冻结 commit 的 `npm run verify` 读取 | `scripts/check-project.mjs` 只作本地预警；不等于微信上传报告 |
| SRC-REF-AUDIT | 源应用行为参考 | 审计时自动化通过，数量见原始归档 | 只作迁移参考，不证明小程序平台一致 |
| WX-COMPILE | 正式 AppID 开发者工具编译/预览 | 待验 | 需版本、基础库、0 error 截图和 warning 结论 |
| WX-UPLOAD | 微信上传包与包体报告 | 待验 | `touristappid` 阻断；仓库无 upload CI |
| UAT-JOURNEY | 首次/回访/扫码/批量/恢复主旅程 | 待验 | 体验版、Android/iOS 权限与录屏、实物码和缺陷记录 |
| HW-MATRIX | D11/D110/B1/B21 系列打印矩阵 | 待验 | 需手机、固件、耗材、诊断和样张 |
| DATA-DESTRUCT | 存储满、恢复中断、回滚演练 | 待验 | Node 有失败注入；微信真机破坏性演练缺失 |
| PERF-DEVICE | 低端机、189 模板、300 张性能 | 待验 | 需时间/内存/失败率原始记录 |
| PRIVACY-APPROVAL | 隐私、权限、类目和用户文本 | 外部阻断 | 正式 AppID/平台配置/负责人签字缺失 |
| CONTENT-RIGHTS | 品牌、189 模板与冻结候选包内全部资源授权 | 外部阻断 | 授权台账和法务签字缺失；资源数以候选 `npm run verify` 为准 |
| RELEASE-ROLLBACK | 上一稳定版与回滚演练 | 待验 | 当前无生产版本/平台演练记录 |

## 3. 功能需求矩阵

| ID | 需求与验收口径 | 代码落点 | 自动化映射 | 当前状态 | 待补证据/责任人 |
| --- | --- | --- | --- | --- | --- |
| FR-01 | 首次引导可跳过并持久化；用户能进入新建/模板/批量 | `pages/home/index.*`、`services/repository.js` 设置 | 静态 WXML/handler；repository 设置间接覆盖 | 部分通过 | 清数据后 UAT-JOURNEY；产品/QA |
| FR-02 | 首页展示设备、快捷入口、耗材和最近标签，无死路 | `pages/home/index.*` | 静态页面完整性和 handler 检查 | 部分通过 | Android/iOS 布局、空/错态与所有点击；QA |
| FR-03 | 系统模板恰为 189，ID 唯一、可构建、资源存在；筛选/分页/预览可用 | `app/catalog.js`、`imported-templates.js`、`online-templates-pack.js`、`template-layouts.js`、home 页 | `online-templates.test.js`、`template-layouts.test.js`、`niim-template-import.test.js`、静态资源检查 | 自动核心通过；UI 部分 | 搜索/分类/行业/24 项分页、缺图占位；QA |
| FR-04 | 项目最多 120、我的模板最多 80，可保存/打开/删除，系统模板不写入用户仓储 | `services/repository.js`、home/editor 页 | `repository.test.js` | 自动仓储通过；UI 部分 | 删除确认、存储失败、重进恢复；QA |
| FR-05 | CSV 支持引号/逗号/换行，字段绑定和批量生成；坏行在打印前定位 | `services/csv.js`、`app/data-bind.js`、home 页 | `csv.test.js`、`data-bind.test.js`、`repository.test.js` 批量原子写 | 部分通过 | 文件选择、BOM/编码、大文件、100/1000 行、坏行 UI；QA/安全 |
| FR-06 | JSON 备份/恢复覆盖项目、模板、设置、数据、历史；失败保留原数据 | `services/repository.js`、home 页 | `repository.test.js` 版本、往返、中途失败回滚 | 自动核心通过；真机待验 | DATA-DESTRUCT、覆盖确认、明文告知；QA/隐私 |
| FR-07 | 编辑器支持文本、条码、二维码、图片、矩形、线、日期、序列、表格、素材 10 类元素 | `core/document.js`、`core/renderer.js`、`pages/editor/index.*` | `dynamic-elements`、`renderer`、`borders-table-shape`、`materials`、`date-links`、`text-*` 测试 | 自动核心通过；UI 部分 | 每类创建→编辑→保存→重开→打印样张；QA/硬件 |
| FR-08 | 移动、缩放、旋转、吸附、多选、对齐/分布、锁定和图层行为正确 | `core/geometry.js`、`editor-gesture.js`、`document.js`、editor 页 | `geometry.test.js`、`editor-snap`、`editor-gesture`、`document`、`editor-page` | 部分通过 | 真实触摸、小屏、边缘手柄、键盘/安全区；QA |
| FR-09 | 图片可从相册/相机添加/替换，阈值/镜像和异步替换安全 | editor 页、`core/image-cache.js`、`renderer.js` | `image-cache.test.js`、renderer 二值化测试 | 部分通过 | 权限拒绝、超大/损坏图片、iOS/Android Canvas；QA/安全 |
| FR-10 | 标签可在超出当前机型时继续编辑；打印预检阻断型号、尺寸、占位和非法元素，不改原稿 | `core/profiles.js`、`renderer.js`、editor `evaluatePrintBlock` | `profiles.test.js`、`renderer.test.js`、`repository.test.js` | 自动核心通过；UI 待验 | 预检弹层、建议 profile、不连接时恢复；QA |
| FR-11 | 支持正确 profile、浓度、阈值、间隙/黑标/连续/定孔及份数 | `core/profiles.js`、`print-plan.js`、repository 设置、home/editor 页 | `profiles.test.js`、`print-plan.test.js` | 协议计划通过；物理待验 | HW-MATRIX 的 4 纸型、1/3 份和边界尺寸；硬件 |
| FR-12 | BLE 扫描、选择、E781 特征、MTU 和 NIIMBOT 握手正确；通用设备被拒绝 | `services/ble-session.js`、`printer-client.js`、editor 页 | `ble-session.test.js`、`printer-client.test.js`、`protocol.test.js` | mock 通过；真机待验 | BLE-001/002、Android/iOS 权限和固件；硬件/QA |
| FR-13 | 连接可单飞复用、恢复系统连接/僵尸、断线失效、蓝牙恢复和切换设备 | `services/printer-connection-manager.js`、`app.js` | `printer-connection-manager.test.js` | mock 通过；真机待验 | 前后台/杀进程/蓝牙开关/两台设备；硬件/QA |
| FR-14 | 诊断不打印；可忘记设备；本地 kill switch 可止住自动重连 | connection manager、editor 诊断/忘记设备 | manager 的 diagnose/forget/kill switch 测试 | 自动核心通过；运营待验 | 受控设备演练；确认开关非远程且非全量停印；发布/QA |
| FR-15 | 打印点阵、方向、字节对齐、任务顺序和机型协议正确 | `core/image-encoder.js`、`print-plan.js`、`protocol.js`、`printer-client.js` | `image-encoder`、`print-plan`、`protocol`、`printer-client` 测试 | 自动协议通过；物理待验 | HW-MATRIX 样张尺寸、方向、扫码和固件；硬件 |
| FR-16 | 取消停止后续发送；预打印连接/图片等待阶段也可取消；失败/取消/成功进入历史，不自动重放可能已打印页 | `printer-client.js`、editor `startPrint/cancelPrint`、repository 历史 | printer client 状态、预打印取消页面回归、repository 历史上限测试 | 自动核心通过；真机待验 | 三个断线时机、纸面核对、历史一致、不重复；硬件/QA |
| FR-17 | 条码、二维码、日期、序列号在动态/批量场景值正确 | `code128.js`、`ean13.js`、renderer、date-links、data-bind | `code128`、`ean13`、`renderer`、`date-links`、`dynamic-elements`、`data-bind` | 自动核心通过 | 两类扫码器、跨日/时区、连续序列实物；QA/硬件 |
| FR-18 | NIIM 模板 JSON/内部文档导入可归一化；无效/缺图安全拒绝 | `core/niim-template-import.js`、repository、home 页 | `niim-template-import.test.js`、`online-templates.test.js` | 自动核心通过；文件 UI 待验 | 恶意/超大/未知 schema、权限拒绝；QA/安全 |
| FR-19 | CSV 和备份可生成并由用户主动分享 | home `shareTextFile`、CSV、repository backup | CSV 往返、backup 往返测试 | 部分通过 | 真机分享、取消、磁盘满、敏感提示、CSV 公式防护；QA/隐私 |
| FR-20 | 本地 v1→v2 迁移幂等，草稿/自动保存可恢复，失败不虚报成功 | `services/repository.js`、`pages/editor/index.js`、`app.js` | `repository.test.js` 迁移/写失败/回滚 | 自动仓储通过；生命周期待验 | 杀进程、升级、存储满、回滚上一版本；QA |
| FR-21 | 帮助、空状态、失败文案均给出下一步，耗时动作防重复点击 | home/editor WXML/JS | WXML 结构/handler 检查；部分连接单飞测试 | 部分通过 | UI-001/002/003、权限拒绝和恢复可理解性；产品/QA |
| FR-22 | 首页扫码建标、编辑器扫码填入；按一维/二维码映射，取消/失败/类型不符不改原稿且不上传原文 | `core/scan-label.js`、`services/scanner.js`、home/editor 页 | `scan-label.test.js`、`scanner.test.js`、WXML handler 检查 | 规则自动通过；平台待验 | SCN-001–004、Android/iOS 权限、实物码与独立扫码器；QA/隐私 |

## 4. 非功能需求矩阵

| ID | 非功能要求 | 实现/证据 | 当前状态 | 待补证据/责任人 |
| --- | --- | --- | --- | --- |
| NFR-01 | 数据完整性：迁移/恢复失败不覆盖原数据 | Repository 归一化、快照回滚；repository 测试 | 自动通过；真机部分 | DATA-DESTRUCT、schema 回滚演练；开发/QA |
| NFR-02 | 包体与资源：主包低于限制并预留 ≥10%，无断链 | `check-project.mjs`；AUT-PKG-CANDIDATE | 冻结提交待归档；微信上传待验 | WX-UPLOAD；每次资源刷新重新测；发布 |
| NFR-03 | 离线可编辑/浏览模板，无静默上传 | 当前未调用运行时网络 API；资源本地 | 代码观察，非平台证明 | 飞行模式主旅程、包内上游 URL 最小化；QA/隐私 |
| NFR-04 | BLE 可靠性：超时、低 MTU、僵尸、断线、自动重连不假成功 | BLE/session/client/manager 测试 | mock 自动通过 | HW-MATRIX，统计连接/重连基线；硬件 |
| NFR-05 | 性能：189 模板、小屏编辑、低端机和 300 张无卡死 | 分页视图、本地资源压缩 | 待手工/真机 | PERF-DEVICE；产品定义数值阈值；QA/硬件 |
| NFR-06 | 兼容性：目标基础库、Android/iOS、D 系/B 系固件 | 基础库配置 `2.32.3`、profiles | 待平台/真机 | 最低基础库决策、WX-COMPILE、HW-MATRIX；产品/QA |
| NFR-07 | 安全：不执行动态输入、秘密不入包、导入有界 | 无 `eval`、文档归一化、模板 2 MiB、lock 文件 | 部分通过 | 秘密扫描；CSV/备份/图片限制；BLE 认证评审；安全/开发 |
| NFR-08 | 隐私：最小权限、本地数据透明、可导出/删除、日志脱敏 | 本地优先、忘记设备、导出、简短 UI 说明 | 外部阻断 | PRIVACY-APPROVAL、清理入口、导出告知；隐私/产品 |
| NFR-09 | 法务内容：品牌、模板、素材、字体、依赖可使用/再分发 | 两项 MIT notice | 外部阻断 | CONTENT-RIGHTS 全台账和签字；法务/内容 |
| NFR-10 | 可用性/无障碍：主动作可见、错误可恢复、小屏/大字体 | 响应式 WXSS、状态文案 | 待手工 | UAT-JOURNEY，小屏/大字体/安全区；产品/QA |
| NFR-11 | 可维护性：依赖锁、可重复命令、需求→测试→发布可追踪 | lock、npm scripts、产品/技术/测试/发布/运维/合规文档集、本文 | 部分通过 | 固定 Node/Pillow/DevTools；CI artifact 归档；开发/发布 |
| NFR-12 | 可运营性：分级、诊断、止损、灰度、回滚 | `OPERATIONS_RUNBOOK.md`、本地诊断/kill switch | 文档就绪；能力部分 | 值守人、阈值、遥测/人工汇总、回滚演练；运营/发布 |
| NFR-13 | 可观察性：能定位适配器/GATT/协议/打印/存储阶段且不泄密 | UI 诊断、错误码、打印历史 | 部分通过 | 脱敏事件字典/保留期；当前无远程遥测；隐私/运营 |
| NFR-14 | 发布与回滚：干净构建、双人发布、上一稳定版可恢复 | `ENVIRONMENT_AND_DEPLOYMENT.md`、自动门禁 | 外部待验 | 正式 AppID、DevTools、体验版、RELEASE-ROLLBACK；发布 |

## 5. 发布门禁覆盖

| 门禁 | 关联需求 | 当前判定 |
| --- | --- | --- |
| Node/静态自动化 | FR-03–22、NFR-01/02/04/11 | 开发过程有通过记录；冻结候选需重跑并归档原始 artifact |
| 微信编译/上传 | FR-01/02/07–10/18–22、NFR-02/06/10/14 | 未执行，正式 AppID 阻断 |
| Android/iOS 产品旅程 | FR-01/02/04–10/18–22、NFR-05/06/10 | 未执行，包含相机扫码授权/取消/拒绝恢复 |
| 真实 BLE/打印 | FR-11–17、NFR-04/05/06/13 | 未执行 |
| 存储破坏/回滚 | FR-04–06/20、NFR-01/14 | Node 有部分证据；真机未执行 |
| 安全/隐私 | FR-05/06/09/12/14/18/19/22、NFR-07/08/13 | 未完成平台与治理门禁；扫码原文不得入日志/遥测 |
| 品牌/内容授权 | FR-03/18、NFR-09 | P0 阻断 |
| 灰度/运营/回滚 | FR-14/16、NFR-12/14 | 手册已有；人员、阈值和演练缺失 |

## 6. 缺口清单与优先级

### P0：不得发布

1. 正式 AppID、微信开发者工具编译/预览、上传包体和审核未完成。
2. Android/iOS × D11/D110/B1/B21 系列 BLE 与实体打印矩阵无证据。
3. 隐私保护指引、权限用途、类目、用户协议/隐私政策未完成。
4. 品牌、189 模板和冻结候选包内全部资源的再分发授权无证据。
5. 发布秘密治理、正式秘密扫描、上传/回滚双人流程未建立。
6. schema v2 对上一版本的真实回滚和存储中途失败真机演练未完成。

### P1：上线前关闭或经明确规则升级为阻断

1. CSV/备份/图片缺少统一大小与复杂度限制，CSV 公式防护待补。
2. 用户图片和导出文件没有安全清理/用量管理。
3. 低端 Android、iOS 大字体、189 模板性能和 300 张压力测试未执行。
4. BLE 设备真实性/配对能力没有硬件安全结论。
5. 无远程遥测/远程 kill switch；事故阈值、联系表和人工汇总流程未填。
6. Node、Pillow、DevTools 工具版本和 CI 证据归档未完全固定。

## 7. 变更维护规则

每次需求、代码或测试变化必须在同一交付变更中：

1. 更新 FR/NFR 验收口径和关联代码。
2. 增加或更新自动化测试；若无法自动化，创建明确手工/真机用例。
3. 执行 `npm run verify`，记录新的测试数、事件绑定、资源和包体。
4. 涉及平台/BLE/打印/数据时更新对应证据 ID，不复用旧版本结果。
5. 若删改功能，不能只删除代码；同时更新产品规格、测试计划、Runbook 和发布清单。
6. 只有所有关联 P0 证据完成、无开放 P0/P1，才能把需求状态改为“已发布验收”。
