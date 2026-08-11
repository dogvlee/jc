# 技术架构

## 1. 文档范围

本文描述 `1.0.0-rc.1` 当前源码的实际结构、运行时所有权、数据流、打印流和失败边界。内容以 `miniprogram/`、`tests/` 与 `scripts/check-project.mjs` 为准，不把 mock 测试等同于微信真机或打印机实测。

相关文档：

- [数据模型与存储](./DATA_MODEL_AND_STORAGE.md)
- [BLE 打印协议](./BLE_PRINTING_PROTOCOL.md)
- [模块参考](./MODULE_REFERENCE.md)
- [架构决策记录](./ARCHITECTURE_DECISIONS.md)
- [测试计划](./TEST_PLAN.md)

## 2. 系统边界

这是一个微信原生小程序，不是 WebView 包装层。当前边界如下：

| 边界 | 当前实现 | 明确不包含 |
|---|---|---|
| UI | 两个原生页面：`home`、`editor`；WXML/WXSS；Canvas 2D | Web DOM、React/Vue 运行时 |
| 业务数据 | `wx` 同步本地存储；用户文件目录；随包模板和素材 | 账号、云同步、远端数据库、云函数 |
| 模板内容 | 189 套离线模板及本地用户模板 | 运行时模板商城接口、在线素材下载 |
| 打印 | 微信 BLE Central API；NIIMBOT E781 通道；代码内已知 profile | 经典蓝牙 SPP、通用 ESC/POS、FF00 信用流控 |
| 自动化 | Node `node:test`、微信 API mock、静态项目检查 | 微信编译器、系统 BLE 栈、固件和纸张实测 |
| 发布 | 工程候选版，`project.config.json` 仍是 `touristappid` | 已上线、已完成隐私审核、已完成硬件认证的声明 |

最重要的架构不变量：

1. 页面不拥有全局 BLE 生命周期；正常运行时由 `App` 创建一个连接管理器、一个会话和一个打印客户端。
2. 用户原稿与打印机适配分离；打印头不兼容时阻止打印，不静默缩放、裁切或改写原稿。
3. NIIMBOT 协议帧保持完整，一帧对应一次 GATT 写入。
4. 连接可以恢复，已经开始的打印任务不会自动重放。
5. 本地数据写入前通过仓储边界规范化；备份恢复覆盖业务集合，但不覆盖设备绑定和编辑器临时态。

## 3. 分层与依赖方向

```text
app.js
  ├─ Repository ─────────────── wx storage / user data files
  └─ PrinterConnectionManager
       ├─ BleSession ────────── wx BLE adapter / GATT / MTU
       └─ PrinterClient
            ├─ image-encoder
            ├─ print-plan
            └─ protocol

pages/home
  ├─ app/* catalog + template builders + data binding
  ├─ scanner + scan-label
  ├─ Repository + CSV
  └─ editorDraft ──────────────► pages/editor

pages/editor
  ├─ document + geometry + renderer + profile
  ├─ Repository autosave/project/history
  └─ global connection manager/session/client
```

依赖规则：

- `core/` 主要是可在 Node 中运行的领域逻辑，不直接访问 `wx`。
- `services/` 封装持久化、CSV、BLE 和打印编排；需要微信 API 的类允许注入 mock。
- `app/` 组合目录元数据、模板构建器和批量数据绑定。
- `pages/` 持有页面状态、用户反馈、文件选择和 Canvas 节点，不应复制协议状态机。
- `app.js` 是应用级依赖装配点。正常页面从 `getApp().globalData` 取得共享实例。

当前存在一个兼容性后备路径：如果编辑页没有取得全局 BLE 单例，会自行构造 `BleSession` 和 `PrinterClient`，并在卸载时关闭该自有会话。正式小程序运行应走应用级单例；后备路径主要保证孤立页面或测试环境不会立即崩溃。

## 4. 目录职责

| 路径 | 职责 |
|---|---|
| `miniprogram/app.js` | 启动迁移、创建应用级仓储与连接管理器、绑定适配器事件、尝试恢复上次设备 |
| `miniprogram/app/` | 模板目录、离线模板包、NIIM 模板组合、标签纸预设、批量字段绑定 |
| `miniprogram/core/` | 文档模型、几何、手势、渲染、条码/二维码、点阵编码、profile、协议帧、打印计划 |
| `miniprogram/services/` | 仓储、CSV、BLE 会话、NIIMBOT 客户端、稳定连接管理器 |
| `miniprogram/pages/home/` | 首页及模板、项目、批量数据、设置、历史、备份/恢复入口 |
| `miniprogram/pages/editor/` | Canvas 编辑、属性面板、撤销/重做、设备选择、预检、打印和取消 |
| `miniprogram/data/` | 固化 NIIM 模板 JSON、原始素材清单 |
| `miniprogram/assets/` | 原始素材、离线模板图和缩略图 |
| `miniprogram/vendor/` | 构建后的二维码运行时代码 |
| `tests/` | 纯逻辑、服务 mock 和编辑页行为测试 |
| `scripts/` | JS/JSON/WXML/资源/主包体积静态门禁和素材处理 |
| `docs/` | 产品、技术、测试、发布和风险文档 |

主包当前包含模板与图片资源，`npm run check` 以 2 MiB 为门限检查整个 `miniprogram/`。新增资源应先评估压缩或分包，不能只看 JavaScript 体积。

## 5. 运行时与生命周期

### 5.1 应用启动

`App.onLaunch` 的顺序是：

1. 以 `wx` 创建 `Repository`，执行 `migrate()`。
2. 创建 `PrinterConnectionManager`，并把设备存储键指定为 schema v2 的 `niim-label:last-device`。
3. 管理器内部创建单一 `BleSession` 和 `PrinterClient`。
4. 绑定蓝牙适配器状态监听，启用连接级自动恢复。
5. 把四个实例写入 `globalData`。
6. 若存在上次设备，800 ms 后调用 `ensureReady(device, { forceFresh: true })`；启动恢复失败被吞掉，页面通过管理器状态或用户操作继续处理。

这里恢复的是连接和 NIIMBOT 握手，不是打印任务。

### 5.2 首页生命周期

首页当前自行创建 `Repository(wx)`，但与应用级仓储访问同一组 `wx` 存储键。它订阅全局连接管理器，仅把连接状态投影为页面文案。离开页面时只退订，不关闭 BLE。

首页承担以下跨页面入口：

- 从系统目录或用户模板构造文档；
- 从项目读取文档；
- 调用微信原生扫码，把一维码/二维码结果构造成新标签；
- 把 `{ document, projectId, returnRoute, openedAt }` 写入 `editorDraft` 后跳转编辑页；
- 导入/导出 CSV、JSON 模板和 JSON 备份；
- 批量生成项目并打开第一条结果。

### 5.3 编辑页生命周期

编辑页按以下优先级恢复文档：

1. 读取并立即删除 `editorDraft`；
2. 读取 `editorAutosave`；
3. 兼容读取旧键 `label-printer:last-document`；
4. 按设置中的纸张尺寸创建新文档。

每次 `commit()` 都会：克隆变更前快照、执行修改、把所有元素限制回画布、记录最多 30 步撤销、写入自动保存，然后同步页面数据并重绘。手动“保存项目”才写入项目集合；自动保存与项目不是同一事务。

编辑页卸载时：

- 若仍在打印，先调用 `PrinterClient.cancel()`；
- 只有后备构造的自有会话才会关闭；全局会话保留；
- 移除会话和管理器订阅。

页面隐藏时只停止正在进行的扫描，不主动断开已建立连接。

## 6. 数据时序

### 6.1 打开、编辑和保存

```text
系统模板 / 用户模板 / 项目
          │ build / normalize
          ▼
  editorDraft（临时交接）
          │ 编辑页读取后删除
          ▼
     编辑器内存文档
       ├─ 每次 commit ──► editorAutosave
       ├─ 保存项目 ─────► projects
       └─ 存为模板 ─────► templates
```

`editorDraft` 只解决页面跳转参数不适合承载大文档的问题，不是长期存档。`editorAutosave` 是崩溃恢复入口，也不等同于用户确认保存的项目版本。

扫码建标先由 `services/scanner.js` 调用 `wx.scanCode`，再由 `core/scan-label.js` 区分一维码和二维码、限制内容长度并生成居中元素。编辑页也可把扫描结果写入当前条码/二维码元素；二维码结果不会静默覆盖一维码元素。

### 6.2 批量生成

首页把非空数据行逐条应用到同一个模板工厂，每条都先 `validateDocument`。任一行失败时，在写入仓储前整体取消。所有文档都通过后，`saveProjects()` 先整体规范化，再以一次 `projects` 键写入提交本批数据。

这保证“本批项目不部分写入”，但不保证与其他存储键组成跨键事务。

### 6.3 备份与恢复

备份从仓储读取项目、用户模板、设置、数据行和打印历史，序列化为 JSON，写到 `wx.env.USER_DATA_PATH` 后调用文件分享。恢复前页面要求用户确认覆盖；仓储对六个目标键做快照，任一写入失败时逐键回滚。

设备绑定、kill switch、编辑草稿、自动保存和用户图片文件本体不在备份中。详细语义见[数据模型与存储](./DATA_MODEL_AND_STORAGE.md)。

## 7. 打印时序

```text
用户点击打印
  │
  ├─ 预检：已知 profile、非空、无占位值、尺寸可打印、元素合法
  │
  ├─ ensureReady(savedDevice)
  │    ├─ 复用可信 ready 会话，或
  │    └─ 打开适配器 → GATT → notify → NIIMBOT 握手 → 型号/profile
  │
  ├─ 等待文档图片加载
  ├─ Canvas 按 profile DPI 渲染 ImageData
  ├─ 二值化、旋转/按行编码、空行/RLE/稀疏行压缩
  ├─ buildPrintPlan：密度、纸型、任务开始、页面、点阵行、页面结束
  ├─ BleSession.request 串行发送完整帧并匹配响应
  ├─ 按任务族轮询状态或等待页通知
  └─ 成功/失败/取消写入 printHistory
```

序列号标签是特例：编辑页为每份克隆文档并计算 `start + copyIndex * step`，每个克隆以一份打印；普通标签把份数交给 profile 对应的打印计划。

`PrinterClient.print()` 在失败时尝试发送取消命令，但始终保留并抛出原始错误。连接管理器可以随后恢复连接，却不会自动再次调用 `print()`。这样避免打印机已消费部分行时产生重复标签。

## 8. 异常路径

| 场景 | 当前处理 | 数据/设备后果 |
|---|---|---|
| 本地读取失败 | 返回对应默认值或空集合 | 读取错误不向页面抛出，可能表现为无数据 |
| 本地写入失败 | 仓储抛出 `STORAGE_WRITE_FAILED`；编辑自动保存显示提示 | 单键写入未完成；普通操作无跨键回滚 |
| 迁移中断 | 版本号最后写入；旧键在所有新键写完后才删除 | 可能已有部分新键；下次启动可继续，但迁移本身不是事务 |
| 备份恢复写入失败 | 恢复原快照并抛出 `RESTORE_FAILED` | 原数据保留；若回滚也失败则抛 `RESTORE_ROLLBACK_FAILED` 并要求停止编辑 |
| 模板或文档尺寸损坏 | `normalizeDocument` 返回 `null` 或保存抛错 | 损坏条目在读取集合时被过滤 |
| 用户图片加载失败 | 打印前 `ensureImagesReady` 阻止发送 | 原稿不被删除；用户需重新选择图片 |
| 扫码取消/无权限/内容不支持 | 分别返回 `SCAN_CANCELLED`、`SCAN_FAILED` 或领域校验错误 | 不创建文档、不修改原条码元素 |
| 型号未知或 B21 Pro | profile 不确认，打印预检阻止 | 仍可编辑，不向未知任务族发送打印数据 |
| 标签超过打印头 | `evaluatePrintability` 返回阻断与可能的替代 profile | 原稿尺寸不变 |
| 蓝牙关闭 | 清缓存、使协议 ready 失效、发布 `adapter-off` | 蓝牙恢复后可尝试重建连接 |
| `already connect` 后发现失败 | 标记 `retryFresh`，硬关闭后只重建一次 | 不把未发现特征的 OS 链路当 ready |
| OS 显示已连接但特征丢失 | `connectExisting` 失败后关闭、等待、重新连接 | 标记来源 `zombie-recovered` |
| MTU 不足 | 在写入前拒绝超过 `maxWriteSize` 的完整帧 | 不发送半帧 |
| 写入或响应超时 | 3 秒写入 watchdog 或命令响应超时 | 当前打印失败，尝试取消，不自动重放 |
| 异步打印机错误 | 拒绝当前请求；无请求时锁存到下一个命令 | 错误不会退化成无信息的超时 |
| 物理断线 | 拒绝 pending、清解析器/特征/ready、通知管理器 | 当前打印失败；连接可在任务结束后恢复 |
| 初始化时断线竞态 | `transportGeneration` 检测旧初始化结果 | 旧 GATT 结果不能重新发布为 connected |
| 用户取消 | 停止继续排队并尽力发送取消命令 | 历史记录为 `cancelled`，不自动重打 |

## 9. 关键设计决策

### 9.1 本地优先，而非“伪云同步”

当前没有账号和服务端版本冲突模型。导出备份是显式用户动作；卸载、清理小程序存储或删除用户目录可能导致数据丢失。技术实现不应把本地存储描述为云端保障。

### 9.2 页面状态与领域状态分离

连接管理器只发布 `{ status, device, source, error }`，不持有页面弹窗或按钮。页面负责中文反馈；服务负责可测试状态转换。仓储同样不依赖页面。

### 9.3 编辑尺寸与打印尺寸分离

预览使用 `previewCanvasSize()`，只要求尺寸为正；打印使用 `alignedCanvasSize()`，再按打印方向对齐到 8 像素并验证打印头上限。这使不适配当前打印机的原稿仍可编辑和保存。

### 9.4 协议与 profile 分离

`protocol.js` 只处理帧；`image-encoder.js` 处理点阵行；`print-plan.js` 处理任务族时序；`profiles.js` 决定 DPI、打印头、方向和任务族。新增硬件不能只加名称正则，必须明确型号 ID、任务族、打印头和完成条件。

### 9.5 恢复连接不恢复业务命令

单飞、TTL、自动重连只建立可信 transport 和 protocol ready。它们不缓存待打印的 ImageData，也不重放命令队列。用户必须检查实物后决定是否重新打印。

## 10. 验证边界与已知技术债

- Node 测试可证明帧编码、mock 状态机、仓储回滚和页面方法行为，不能证明 Android/iOS、某个基础库和目标固件的真实表现。
- `home` 页面没有独立页面行为测试；主要通过下层模块测试和静态 WXML 事件检查覆盖。
- `createDocument()` 的内存文档版本初值仍为 `1`，仓储规范化后才成为文档 schema `2`；调用方不能把它与存储版本混为一谈。
- `date-links.js`、`image-cache.js`、`text-style.js` 已有单元测试，但当前编辑页主路径没有引用它们；它们属于待接入能力，不应在架构图中视为已闭环 UI。
- 用户相册图片复制到小程序用户目录，JSON 备份仅保留路径，不包含图片二进制；跨设备恢复可能缺图。
- 候选型号映射和全部 BLE 路径仍需微信开发者工具、Android/iOS 和目标打印机留下实测证据。
