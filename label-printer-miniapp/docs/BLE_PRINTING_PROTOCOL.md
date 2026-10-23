# BLE 连接与打印协议

> **2026-10-07 起只支持 ESC/POS 热敏打印机（ADR-015）。** 当前打印方式见第 11 节；连接与通道发现见第 2 节。其余描述精臣（NIIMBOT）帧、握手、打印计划和型号映射的章节，对应代码已删除，只作历史记录保留。

## 1. 范围、证据和保密边界

本文只描述仓库当前代码可见的 BLE/GATT 选择、帧边界、连接状态机、打印编排和安全限制。它不是厂商完整协议规范，也不包含未出现在源码中的命令、固件秘密或逆向结论。

自动化测试使用微信 API mock，只能证明代码分支和字节处理符合预期；本文不声称已在 Android、iOS 或任一打印机固件上完成真机验证。型号支持结论必须以发布测试记录和样张为准。

相关实现：

- `miniprogram/services/ble-session.js`
- `miniprogram/services/printer-connection-manager.js`
- `miniprogram/services/printer-client.js`
- `miniprogram/core/escpos.js`
- `miniprogram/core/image-encoder.js`
- `miniprogram/core/profiles.js`

## 2. GATT 通道

当前 NIIMBOT 主通道常量如下，UUID 比较不区分大小写：

| 角色 | 常量 | UUID | 必要属性 |
|---|---|---|---|
| E781 主服务 | `PRIMARY_SERVICE` | `e7810a71-73ae-499d-8c15-faa9aef0c3f2` | 被服务发现返回 |
| 写入特征 | `PRIMARY_WRITE_CHARACTERISTIC` | `bef8d6c9-9c21-4c9e-b632-bd58c1009f9f` | `write` 或 `writeNoResponse`；带 `notify` 时也在它上面收通知 |
| 备用通知特征 | `PRIMARY_NOTIFY_CHARACTERISTIC` | `bef8d6c9-9c21-4c9e-b632-bd58c1009f9e` | `notify` 或 `indicate`；无真机证据，仅在 9f 不能通知时使用 |

若写特征支持 `writeNoResponse`，会话优先使用该写入类型；否则使用 `write`。通知特征支持 `indicate` 时，启用时传 `indication`，否则传 `notification`。

### 2.1 通道发现规则（ADR-013：连上即可打印）

服务按以下顺序尝试，跳过通用访问、通用属性、设备信息和电量服务（`1800`、`1801`、`180A`、`180F`）：

1. E781 主服务；
2. 设备记录里此前连接成功的 `serviceId`（其中记住的写/通知特征优先）；
3. 其他服务，`isPrimary` 的在前。

同一服务内的选择（`channelIn`）：

- E781：写入用 `…9f9f`（没有时用服务内其他可写特征）；通知优先用写入特征本身（NIIMBOT 打印机在被写入的 9f 特征上回包，开源实现和 RC1 之前的代码都是这样），其次 `…9f9e`，再次服务内任一通知特征。
- 其他服务：优先“既能写又能通知”的单个特征；否则取第一个可写特征加第一个通知特征。

写入和通知必须在同一服务里。没有任何服务同时有写入和通知时，退而用第一个只能写入的通道（`notify: null`）。服务列表为空或不完整时，间隔 500 ms、1000 ms 再查两次（`discoveryRetryDelaysMs`）；`getBLEDeviceServices` 本身报错或超时不重查，避免叠加等待。

链路建立后一律保持连接（ADR-013）：

- 什么都写不进的设备：`connected = true`，写入通道为空；任何写入（握手或打印）抛出 `NO_NIIMBOT_CHANNEL`（“这台设备不能接收打印内容，可能不是打印机……”）。
- 通知开不了（重试一次后）：不开通知继续连接，之后的请求收不到回包，记为未回应。
- 只有链路本身没了（错误码 10006/10002、断开事件、`TRANSPORT_RESET`/`CONNECT_CANCELLED`）才让连接失败。

`PrinterClient` 的握手和信息查询都是尽力而为（`optional`）：CONNECT 不回或回包无效时 `answered = false`，不再发型号/序列号等查询，连接照样成功；v3 打印机个别信息查询或心跳不回，只把对应字段记为 `null`。每次打印前若 `answered` 为 false，先再握手一次：回应了就照常打印；仍不回应则不发送任何打印数据，抛出 `PRINTER_UNANSWERED`（“已经连上这台打印机，但它不回应商跃标签的打印指令，暂时不能用它打印。”），没有可写通道时抛出 `NO_NIIMBOT_CHANNEL`。“检查连接”对未回应的设备显示“已连接。这台设备还没有回应打印指令，打印时会再试一次。”。成功连接后，通道随设备记录保存，下次连接优先使用。

## 3. 传输帧和完整写入

`protocol.js` 中可见的帧结构是：双字节帧头、命令、单字节载荷长度、载荷、异或校验、双字节帧尾。连接命令还带一个代码内定义的前导字节。单帧载荷最大 255 字节。

本文不复制完整命令号表；命令和响应枚举以源码为唯一依据。传输层必须遵守以下不变量：

> `encodePacket()` 生成的每个 NIIMBOT 帧，必须通过一次 `writeBLECharacteristicValue` 完整写入。

`BleSession.writeBytes()` 不做通用分片：

- 初始 MTU 为 23，对应 `maxWriteSize = 20`；
- 协商后使用 `maxWriteSize = mtu - 3`；
- 若整帧长度大于 `maxWriteSize`，在调用微信写 API 前直接失败；
- 单次微信写调用有 3000 ms watchdog；
- 写成功后默认等待 10 ms，再允许下一个请求继续。

这样可以避免把打印机按帧消费的数据任意切成若干 ATT 片段。低 MTU 环境必须通过真机确认可容纳当前最大帧，或在协议/打印计划层设计厂商明确支持的更小帧；不能在 `writeBytes()` 内盲目切字节。

## 4. 接收解析和请求串行化

### 4.1 PacketParser

通知可能包含半帧、完整帧或多个粘连帧。`PacketParser` 会：

- 缓存不完整数据；
- 搜索帧头并丢弃前置噪声；
- 按载荷长度等待完整帧；
- 校验帧尾和 XOR；
- 对坏帧记录解析错误并继续寻找后续有效帧；
- 在断线、重连和显式断开时重置缓冲。

只有当前设备、且特征 ID 与当前通知特征一致的数据才进入解析器。

### 4.2 请求队列

`BleSession.request()` 把所有请求串入同一个 Promise 队列，任一时刻最多有一个等待响应的 `pending`。请求可以声明：

- 一个期望响应命令；
- 多个可接受响应命令，例如心跳；
- `null`，表示打印行等单向命令。

等待响应的命令超时后清除 `pending` 并抛错。打印机错误帧会立即拒绝当前请求；如果错误发生在单向打印行期间而没有 active pending，则先锁存，下一条命令发送前抛出。这样异步错误不会被误报成后续无信息超时。

队列串行化是命令有序性，不是断线重放日志。断线会拒绝 pending，已有队列任务随后因 `connected === false` 失败。

## 5. 连接状态机

### 5.1 层次

连接有三层 ready：

1. **适配器 ready**：`openBluetoothAdapter` 成功。
2. **transport ready**：设备连接、可信服务/特征发现、MTU 获取、通知启用完成；`BleSession.connected === true`。
3. **protocol ready**：NIIMBOT 连接握手和设备信息阶段完成；`PrinterClient.ready === true`。

只有三层都满足，连接管理器才发布 `status: connected`。系统声称设备已连接并不代表 transport 或 protocol ready。

```text
disconnected
    │ ensureReady
    ▼
connecting
    ├─ fast/system reuse ───────────────► connected
    ├─ fresh GATT + handshake ──────────► connected
    ├─ existing rediscovery + handshake ► connected
    ├─ zombie/already hard recovery ────► connected
    └─ error / adapter off / link lost ─► disconnected
```

管理器对页面暴露的状态只有 `disconnected`、`connecting`、`connected`，并附带 `source` 和 `error`。更细的来源用于诊断，不应作为业务成功的替代条件。

### 5.2 ensureReady 和单飞

`ensureReady(device?, options?)` 是 UI 应优先调用的入口：

- 未传设备时使用上次保存设备；仍无 `deviceId` 时抛 `DEVICE_INCOMPLETE`。
- 同一 `deviceId` 已在连接时，等强度请求返回同一个 Promise，形成 single-flight；后来到达的 `forceValidate`/`forceFresh` 若更强，会等待当前任务完成后按更强语义再执行，不会被普通请求静默降级。
- 另一设备正在连接时拒绝并抛 `CONNECT_BUSY`，不会并行争用全局适配器和回调。
- 打印进行中拒绝连接验证、强制重连和诊断并抛 `PRINT_IN_PROGRESS`，避免握手命令插入打印命令队列。
- 成功后缓存连接结果及时间，持久化设备/通道/MTU/型号/profile 元数据并发布状态。

`isReadyFor()` 同时检查 session connected、printer ready、session deviceId 和 printer deviceId；只有 OS 链路存在不满足复用条件。

### 5.3 TTL 复用

默认值：

| 参数 | 默认值 | 行为 |
|---|---:|---|
| `fastReuseTtlMs` | 5000 ms | ready 且缓存新鲜时直接复用，不查询系统连接 |
| `sessionTtlMs` | 120000 ms | 超过快速窗口后查询系统连接；ready、缓存仍在 TTL 且系统未明确断开时复用 |
| `reopenDelayMs` | 250 ms | 硬关闭后等待，再新建连接 |

`forceValidate` 跳过快速/TTL 复用，重新检查并发现现有连接；`forceFresh` 直接硬关闭指定连接后重新创建 transport。`reconnect()` 会清目标缓存并默认附加 `forceValidate: true`。

TTL 只表示“缓存结果允许怎样验证”，不是打印机永久在线的承诺。物理断线事件会立即清缓存和 protocol ready。

### 5.4 `already connect` 恢复

`createBLEConnection` 返回包含 `already connect/connected` 的错误时，会话不会立刻判失败，而是继续绑定监听、发现服务/特征、协商 MTU并启用通知。

- 若后续发现和握手成功，现有 OS 链路可用。
- 若后续初始化失败，错误会带 `retryFresh = true`。
- 连接管理器收到该标志后，关闭指定设备、等待 reopen delay，再只做一次 fresh 连接，成功来源记为 `already-recovered`。

这避免把微信“已连接”错误既当作硬失败，也避免在特征已失效时无限接受假连接。

### 5.5 zombie 连接恢复

当 `getConnectedBluetoothDevices` 显示目标已连接，管理器先走 `connectExisting()`：不再调用 `createBLEConnection`，但重新发现服务/特征、协商 MTU、启用通知并完整执行 NIIMBOT 握手。

如果 existing 路径失败，说明 OS 链路可能存在但 GATT/协议状态不可用。管理器会：

1. 清缓存和 protocol ready；
2. `closeBLEConnection` 指定设备；
3. 等待 250 ms；
4. fresh 连接并重新握手；
5. 成功来源记为 `zombie-recovered`。

进程被杀后的设备记录只是重新发现线索，绝不直接恢复 `connected` 标志。

### 5.6 初始化竞态

每次 transport 初始化递增 `transportGeneration`。断线或显式断开也递增。服务发现、MTU、通知启用后的旧异步任务如果发现 generation 已变化，会抛 `TRANSPORT_RESET`，不能把失效链路重新发布为 connected。

扫描启动与停止另有串行队列和 `scanGeneration`。若页面在 `startBluetoothDevicesDiscovery` 尚未回调时请求停止，停止动作会排在启动结束之后再次调用平台停止 API；旧设备发现回调也会因 generation 失效而被忽略。

## 6. MTU 协商与重协商

每次 `setupConnectedTransport()` 都先回到 MTU 23 / 最大载荷 20，然后重新协商：

1. Android 等支持 `setBLEMTU` 的环境尝试请求 247；成功返回有效 MTU 时立即更新。
2. 等待 100 ms。
3. 若支持 `getBLEMTU`，按实际写类型读取 MTU。
4. `setBLEMTU` 已成功而 `getBLEMTU` 失败时，保留前者结果，不退回 23。
5. 两者都不能给出有效值时使用 23/20。

iOS 可能不提供 `setBLEMTU`，代码允许只读取系统报告值。`onBLEMTUChange` 也会在运行中更新 `mtu` 和 `maxWriteSize`。

断线、显式断开或新 transport 都清除旧 MTU。持久化的 MTU仅用于展示和诊断，不能替代本次连接重新协商。

## 7. 协议握手

`PrinterClient.connect()` 在 transport ready 后执行 NIIMBOT 握手：

1. 发送连接请求，接受代码当前支持的三种连接状态。
2. 高级状态分支读取打印机状态数据并推导协议版本。
3. 按固定顺序尝试读取型号、序列号、蓝牙地址、电量、自动关机、纸型、硬件和软件信息。
4. 高级连接状态下，信息读取失败会使连接失败；旧分支允许部分信息为空。
5. 高级分支最后执行心跳。
6. 全部完成后才设置 `PrinterClient.ready = true`。

任何失败都会断开 session 并保持 `ready = false`。`connectExisting()` 只复用 GATT，不复用 protocol ready；它仍完整重复上述握手。

## 8. 打印流水线

### 8.1 预检与点阵

页面打印前检查：profile 已确认、文档非空、没有默认占位值、尺寸符合打印头、条码/二维码等元素可渲染。然后：

1. `alignedCanvasSize()` 按 DPI 计算像素，并仅对打印头方向向上补齐到 8 的倍数。
2. Canvas 渲染黑白标签；优先使用 offscreen canvas。
3. `encodeImageData()` 按 profile 的 `top` 或 `left` 方向读取像素、阈值二值化。
4. 相同点阵行做最多 200 行的 RLE；空行、稀疏黑点行和普通位图行使用不同命令形状。
5. B21 legacy 每 200 行插入检查行。

如果编码后的打印头轴超过 `profile.printheadPixels`，客户端再次阻止打印。

### 8.2 打印计划

`buildPrintPlan()` 把点阵转换为有序步骤：密度、纸型、打印开始、可选清空、页面开始、页面尺寸、可选份数、打印行、页面结束。密度被限制在 profile 范围，份数限制在 1–99。

| task | 关键差异 | 完成判断 |
|---|---|---|
| `d110` | 清空；设置份数；新 D11/D110 时序 | 轮询打印状态，达到份数后 `PRINT_END` |
| `d11Legacy` | 任务前心跳；页面尺寸只传行数；清空并设置份数 | 监听页索引推进，完成后 `PRINT_END` |
| `b1` | 份数进入打印开始和页面尺寸；不单发 quantity | 轮询打印状态，达到份数后 `PRINT_END` |
| `b21Legacy` | 每份重复完整页面；检查行等待响应 | 反复查询结束状态直到成功或超时 |

`PrinterClient` 会对 B1 高协议版本在打印前补高级心跳。打印中任何命令失败时，客户端尽力发送取消命令，然后抛出原始错误。

### 8.3 完成超时

- 常规和 D11 legacy 路径有绝对时限，并要求页数在 15 秒内持续推进。
- B21 legacy 按份数计算至少 20 秒的 deadline，间隔查询完成状态。
- 用户取消会设置本地 `cancelled`，后续循环和计划步骤停止，并尽力发送设备取消。

这些时限来自当前实现，不代表所有固件都已真机验证。

## 9. 自动重连、kill switch 和不重放

### 9.1 自动重连

`bindStateListeners({ autoReconnect: true })` 绑定一个应用级蓝牙适配器监听。以下事件可触发连接重建：

- 已连接设备报告物理断线；
- 蓝牙适配器从不可用恢复为可用；
- 启动时存在上次设备，`app.js` 延时走 force-fresh。

物理断线后的默认重试参数为：初始 800 ms，最多 3 次，失败后延迟逐步增加且最多 4000 ms。打印客户端仍标记 `printing` 时，管理器延后 1000 ms，不在任务中间抢占重连。

### 9.2 kill switch

存储键 `ble_reconnect_off` 为 truthy 时：

- `ensureReady()` 默认抛 `BLE_RECONNECT_OFF`；
- 自动重连不启动；
- `diagnose()` 返回 kill switch 已关闭稳定连接；
- 启用开关时的缓存和自动重连计时器被清除。

重要边界：当前 `disable()` 不会主动断开一个已经建立的连接，也不会取消已经开始的打印。编辑页用户明确扫描并选择设备时，如果管理器返回 `BLE_RECONNECT_OFF`，代码会退回直接 `PrinterClient.connect()` 的原连接流程。因此它是“稳定复连 kill switch”，不是阻断所有 BLE 写入的全局急停。要停止当前打印必须调用取消；要禁止所有传输还需显式断开或在更低层增加独立开关。

`ensureReady` 内部支持 `ignoreKillSwitch` 选项，但当前页面没有常规使用它。

### 9.3 为什么绝不自动重放打印

断线时应用无法可靠知道打印机已经消费了多少行、是否走纸、是否完成某一份。连接恢复后自动重放可能产生：

- 重复标签；
- 前半张与重打整张并存；
- 序列号重复；
- 批量任务中部分数据重复。

因此当前设计只恢复 adapter/transport/protocol ready。它不保存待重放的打印行，不从失败索引继续，也不重新调用 `PrinterClient.print()`。页面记录失败或取消，用户检查实物后手动决定是否重打。

## 10. profile 边界

当前 profile 全部是 203 DPI：

| profile | task | 打印头 | 方向 | 代码路由的型号 ID |
|---|---|---:|---|---|
| `d110` | `d110` | 96 px | `left` | 2304、2305、2320；型号 512 在协议版本 1/2 时 |
| `d11-legacy` | `d11Legacy` | 96 px | `left` | 514；型号 512 在其他协议版本时 |
| `b1` | `b1` | 384 px | `top` | 4096、4098 |
| `b21` | `b21Legacy` | 384 px | `top` | 768、769 |
| `b21-c2b` | `b1` | 384 px | `top` | 771、775 |
| `b21s` | `d110` | 384 px | `top` | 776、777 |

边界规则（ADR-013：连上即可打印，不按型号阻断）：

- 完成握手的打印机都可以打印。`reportedProfile` 只认打印机上报、且在上表中能直接映射的型号 ID（候选 ID 除外），命中即由它决定 profile；没有上报型号 ID 时，按名称识别出的型号只算猜测。
- 否则依次使用：打印机连上前在编辑器手动选的型号（连上后按设备 ID 记住）> 用户为这台打印机选过的型号 > `likelyProfile` > 能放下当前标签的 profile。不弹窗要求确认型号。
- `likelyProfile` 的顺序：`profileForModelId`（含候选 ID 和无型号 ID 时的 D11 名称/协议版本规则）→ 厂商机型表按型号 ID → `guessProfile` 名称规则 → `nameFamilyProfile`（厂商机型表按名称，名称须是 `<型号>-<序列号>` 形式且序列号含数字，避免把 `H1_Headset`、`D2` 之类的耳机、音箱当成打印机；再按首字母 `D…` → `d110`、`B…` → `b1`）。
- 厂商机型表（`profiles.js` 的 `VENDOR_MODELS`）来自 `research/extracted-configs/printerList.json` 的 `printDirection`：90°/270° 侧向出纸的窄打印头（B16 1792、B18 3584、B18S 3585、D101 2560、H1 3840、H1S 4352、D11_H 528 等）按 `d110`；0° 顶部出纸（B3S 256/260/262、K3 4864、A8 256、B21_Pro 785、B1 Pro 4097 等）按 `b1`。
- `B21_PRO` 名称在 `guessProfile` 中返回 `null`，`D110M_V4` 专用路径未适配；连接后按厂商机型表使用 `b1` 尝试，输出可能不正确。
- 300 DPI 机型（4097、528、785 等）按 203 dpi profile 打印，输出约为设计尺寸的 2/3；打印头宽于 48 mm 的机型只打中间 48 mm；270° 出纸机型（B16、A1 Pro）内容可能倒置。
- `2320 → d110` 和 `4098 → b1` 是候选映射，作为最可能的型号直接用于打印，但未形成对应真机证据前不得对外承诺支持。
- 型号不确定时，用户在打印弹层“打印机型号”或设置中改选的 profile 会为该设备记住（打印机不在时选的型号，在它连上或自动重连时记到它名下）；只是用户选定、并非打印机上报的型号，尺寸不符时仍给出“切换为 X”；手动选型只决定打印参数，不把未知硬件升级为已验证型号。
- 标签超过所选 profile 打印头和最大纸宽的物理尺寸检查仍会阻断打印。

profile 同时决定 DPI、打印头像素、点阵方向、密度范围和 task。新增型号必须验证完整组合，不能只扩充设备名称正则。

## 11. ESC/POS 打印机（ADR-014）

不走 E781 服务连上的打印机由 `PrinterClient` 记为 `protocol: 'escpos'`：连接时不握手、不发任何字节；`savedDevice.protocol` 随设备保存。打印走 `printEscPos()`（`core/escpos.js`），整个过程只调用 `BleSession.writeRaw()`。`writeRaw()` 按 `maxWriteSize` 分包、顺序写；特征支持写应答时用 `write`，否则用 `writeNoResponse` 并隔 `writeDelayMs`。

| 步骤 | 字节 | 来源 |
|---|---|---|
| 开始 | `1B 40 1B 61 00 1B 33 18`（ESC @、左对齐、行距 24） | `print` 打印工具 `INIT_BYTES` |
| 图像 | 每条 `1D 76 30 00 xL xH yL yH` + 像素，≤32 点行、≤1400 字节、≤8 包，条间 80 ms | `print-table-simple.js sendBitmapBanded` 稳定模式 |
| 下一张 | `1D 0C`（GS FF，走纸到下一张），之后等 400 ms | 厂家《打印指令 v1.06》第 3 章 |

光栅按编辑器同一黑白阈值生成，行从上到下，每字节最高位在左；标签宽度小于打印头时居中补白。ESC/POS 没有取消命令，取消只在两条 `GS v 0` 之间停下；不发 NIIMBOT 取消帧。打印机不回打印完成，写完最后一条和走纸即算完成。

尚未接入：FF03 信用令牌高速模式、厂家私有的黑标检测开关与票长设置、电量与休眠命令。

### 11.1 原先不接 FF00 / FF02 / FF03 的分析（ADR-008，保留备查）

FF00 Data Transmission Service、FF02 写入、FF03 credit/notify 的常见路径服务于另一类以 ESC/POS 位图命令（例如 `GS v 0`）发送，并用令牌/信用做背压的热敏打印机。它与当前链路在多个层面不同：

| 层面 | 当前 NIIMBOT 路径 | FF00 ESC/POS 信用路径 |
|---|---|---|
| 服务/特征 | E781 + 固定 9f write / 9e notify | FF00 + FF02 write / FF03 notify |
| 应用帧 | NIIMBOT 帧头、长度、校验、帧尾 | ESC/POS 命令流 |
| 响应 | 命令响应、页索引、状态和打印错误 | 信用令牌与 ESC/POS 设备状态 |
| 背压 | 请求队列、命令响应、完整帧写入 | 按 credit 控制分块发送 |
| 打印计划 | D11/D110/B1/B21 任务族 | ESC/POS 光栅行/块语义 |

把 FF02/FF03 当作“任意可写/通知特征”接入会导致三个问题：

1. 向错误设备发送 NIIMBOT 私有帧；
2. 忽略 credit，造成丢包或阻塞；
3. 让当前 `PacketParser` 和 `PrinterClient` 等待永远不会出现的 NIIMBOT 响应。

ADR-014 按这里的建议做了：设备连上后按服务先判协议族，ESC/POS 打印机走独立的 encoder（`core/escpos.js`）和打印分支，不复用 NIIMBOT 帧、解析器或响应等待；信用状态机暂未实现，只用稳定模式。

## 12. 可观测性和测试证据

`PrinterConnectionManager.diagnose()` 只做连接和协议握手，不发送打印行，返回：适配器、系统连接、transport/protocol ready、服务/特征、写类型、MTU、最大载荷、型号、协议版本、来源和错误。

自动化覆盖包括：

- 完整帧编码、拆包/粘包、坏校验恢复；
- 超过 MTU 时零写入；
- `already connect`、existing rediscovery、通用特征拒绝、初始化断线竞态；
- 单飞、TTL、force-fresh、zombie、kill switch、自动重连、手动忘记、诊断；
- 协议握手、transport reset 使 ready 失效；
- 各 task 打印计划和点阵编码。

仍必须补齐的发布证据：微信开发者工具编译、Android/iOS 权限和 MTU、前后台/杀进程恢复、目标型号连接日志、正常/异常样张、缺纸/开盖/低电/取消/断线行为。没有这些证据时只能称为“代码实现和 mock 已覆盖”。
