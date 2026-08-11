# 数据模型与存储

## 1. 范围与术语

当前产品是本地优先应用，业务数据主要保存在微信同步存储中。本文区分两个容易混淆的版本号：

- **存储 schema**：`Repository.STORAGE_VERSION`，当前为 `2`，记录在 `niim-label:storage-version`。
- **标签文档 schema**：`document.schemaVersion`。`normalizeDocument()` 输出 `2`；但 `createDocument()` 当前仍以 `1` 创建内存对象，进入仓储边界后才提升为 `2`。

因此，不能用某个内存文档的 `schemaVersion` 判断整个本地仓储是否已迁移。

## 2. 存储适配器和基本语义

`Repository` 需要一个具有以下同步接口的对象，正式运行传入 `wx`，测试传入内存 mock：

```text
getStorageSync(key)
setStorageSync(key, value)
removeStorageSync(key)
```

读取语义：空字符串、`undefined`、`null` 都视为无值并返回 fallback 的深拷贝；读取异常也返回 fallback。写入异常统一包装为：

```text
code: STORAGE_WRITE_FAILED
message: 本地存储空间不足，请先备份并删除不再使用的标签
```

这条消息覆盖所有同步写失败，不只是真正的配额耗尽。需要诊断底层原因时读取 `error.cause`，不要仅凭中文文案判定 quota。

## 3. schema v2 键

| 常量 | 实际键 | 值 | 上限/生命周期 |
|---|---|---|---|
| `KEYS.version` | `niim-label:storage-version` | 数字 `2` | 迁移标记 |
| `KEYS.projects` | `niim-label:projects` | `Project[]` | 最多 120，按 `updatedAt` 降序读取 |
| `KEYS.templates` | `niim-label:templates` | `UserTemplate[]` | 最多 80，按 `updatedAt` 降序读取 |
| `KEYS.settings` | `niim-label:settings` | `Settings` | 单对象，按 patch 合并 |
| `KEYS.dataRows` | `niim-label:data-rows` | `DataRow[]` | 最多 1000 |
| `KEYS.printHistory` | `niim-label:print-history` | `PrintHistoryEntry[]` | 最多 80；只有最新 10 条保留文档快照 |
| `KEYS.lastDevice` | `niim-label:last-device` | `SavedDevice` | 单对象；由连接管理器主写 |
| `KEYS.editorDraft` | `niim-label:editor-draft` | `EditorDraft` | 页面跳转临时态；编辑页读取后删除 |
| `KEYS.editorAutosave` | `niim-label:editor-autosave` | `EditorAutosave` | 最近一次编辑状态 |

还有一个不属于 `KEYS`、但会写入同一存储适配器的运行控制键：

| 键 | 含义 |
|---|---|
| `ble_reconnect_off` | truthy 时关闭连接管理器的稳定复连路径；清除后恢复 |

### 3.1 旧键

| 旧键 | v2 目标或兼容用途 |
|---|---|
| `label-printer:last-document` | 迁移为一个项目；编辑页仍把它作为最终兼容读取入口 |
| `label-printer:templates` | 迁移为用户模板集合 |
| `label-printer:profile` | 迁移到 `settings.defaultProfileId` |

连接管理器内部默认设备键常量仍是 `label-printer:last-device`，但 `app.js` 构造它时显式传入 `KEYS.lastDevice`，所以正常应用运行使用的是 `niim-label:last-device`。

## 4. 实体模型

### 4.1 LabelDocument

持久化文档的基础形状：

```js
{
  schemaVersion: 2,
  name: '库存标签',       // 规范化时最多 80 个 JS 字符
  widthMm: 50,           // 有限数且 > 0
  heightMm: 30,          // 有限数且 > 0
  elements: []           // 数组顺序也是图层顺序，后项在上
}
```

导入 NIIM 模板时可能附带 `templateMeta`，包括来源 ID、名称、宽高、纸型、VIP 标记、单位、版本、元素数量和 `imported` 标记。仓储规范化采用“默认对象 + 来源对象”合并，因此会保留这类扩展字段；当前不是拒绝未知字段的严格 JSON Schema。

### 4.2 LabelElement 公共字段

所有受支持元素都以如下字段为核心：

| 字段 | 含义 |
|---|---|
| `id` | 字符串 ID；缺失时用类型、时间和序号补齐 |
| `type` | `text`、`barcode`、`qrcode`、`image`、`rect`、`line`、`date`、`serial`、`table`、`material` 之一 |
| `x`, `y` | 左上角位置，单位 mm |
| `width`, `height` | 元素盒尺寸，单位 mm |
| `rotation` | 角度，规范化到 `[0, 360)` |
| `locked` | 是否锁定编辑 |
| `mirrorX`, `mirrorY` | 水平/垂直镜像 |

`clampElement()` 会按旋转后的外接尺寸缩小并平移元素，使其留在文档范围内。未知 `type` 在 `normalizeDocument()` 中被丢弃；损坏的整个文档会返回 `null`。

### 4.3 元素专有字段

下表列出当前代码实际消费的主要字段。规范化仍可能保留导入器带来的额外元数据。

| 类型 | 主要字段 |
|---|---|
| `text` | `text`、`fontSize`、`bold`、`italic`、`underline`、`strike`、`reverse`、`align`、`verticalAlign`、`direction`、`textMode`、`textArcAngle`、`letterSpacing`、`lineSpacing`、`autoFit`、`wordWrap`、`color`、`fontFamily` |
| `barcode` | `value`、`format`（`code128`/`ean13`）、`showText`、`textPosition`、`fontSize`、`color` |
| `qrcode` | `value`、`errorCorrection`、`color` |
| `image` | `path`、`threshold`；用户图片通常指向 `wx.env.USER_DATA_PATH` 下的文件 |
| `rect` | `lineWidth`、`filled`、`dashed`、`shapeKind`、`borderStyle`、`color` |
| `line` | `lineWidth`、`dashed`、`shapeKind`、`color` |
| `date` | 文字样式字段，以及 `dateRole`、`label`、`baseTime`、`autoUpdate`、`offsetDays`、`offsetHours`、`showTime`、`showSeconds`、`expireMode`、`expirePresetHours`、`format`、`fixedValue`；链接能力可扩展 `linkedFrom`、`linkedExpire` |
| `serial` | 文字样式字段，以及 `prefix`、`suffix`、`start`、`step`、`digits`、`currentValue` |
| `table` | `rows`、`columns`、`rowH`、`colW`、`cells`、文字样式、`lineWidth`、`textColor`、`strokeColor` |
| `material` | `symbol`、可选 `path`、`lineWidth`、`color` |

表格规范化规则：`rows` 限制在 1–20，`columns` 限制在 1–12；`cells` 截断或补空到 `rows * columns`，每格转为字符串。

扫码入口在仓储之外增加输入约束：扫码原文最多 500 个字符；写入一维码时最多 80 个字符且当前 Code 128 只接受可打印 ASCII。二维码可保存扫码得到的非 ASCII 文本。最终仍以渲染器和仓储规范化结果为准。

渲染器可能给元素写入不可枚举的瞬态 `_fit`，几何操作还可能使用 `directionLayout`、`selectionFit`。`_fit` 不会通过 JSON 克隆进入存储，不应被当作持久化契约。

### 4.4 Project

```js
{
  id: 'project-...',
  name: '库存标签',
  document: LabelDocument,
  updatedAt: 1786...
}
```

- `saveProject(document, projectId?)` 有 ID 时覆盖，无 ID 时创建。
- 写入采用 `[新项目, 其余项目]`，然后截断到 120。
- `saveProjects()` 先验证整批，再为本批生成同一时间基准的 ID 和排序时间，以一次 `projects` 键写入。
- `deleteProject()` 重写过滤后的整个数组。

### 4.5 UserTemplate

```js
{
  id: 'user-template-...',
  name: '库存模板',
  document: LabelDocument,
  updatedAt: 1786...,
  source: 'user'
}
```

名称去首尾空白，最多 80 个 JS 字符；空名称回退为“我的模板”。更新和删除都通过重写模板数组完成。

系统模板不写入此键。32 套基础模板、4 套导入模板和 153 套固化在线目录模板随代码包发布，由 `app/catalog.js` 组合。

### 4.6 Settings

默认对象：

```js
{
  defaultProfileId: 'd110',
  density: 2,
  threshold: 180,
  labelType: 1,
  stockWidthMm: 50,
  stockHeightMm: 30,
  onboardingDone: false,
  unit: 'mm'
}
```

读取和保存都是浅合并。仓储不单独验证密度、阈值、纸型或尺寸范围；页面、profile 和打印计划在使用时做约束。未知设置字段会被保留。

### 4.7 DataRow

首页当前识别四个业务列：

```js
{
  id: 'row-a',
  name: '样品 A',
  code: '6901234567892',
  price: '19.90',
  date: '2026-08-02'
}
```

仓储只深拷贝并截断到 1000，不做逐字段 schema 验证。CSV 导入按表头或列序映射 `name/code/price/date`，页面再补 `id`。数据绑定器根据值推断文字、价格、条码、二维码、日期和序列号用途。

### 4.8 PrintHistoryEntry

仓储自动补充：

```js
{
  id: 'print-...',
  at: 1786...,
  name: '库存标签',
  projectId: '',
  result: 'success' | 'failed' | 'cancelled',
  message: '',
  profileId: 'd110',
  deviceName: 'D110',
  document: LabelDocument // 仅最新 10 条保留
}
```

历史最多 80 条。从第 11 条开始删除 `document`，仍保留结果和诊断元数据。首页只展示前 20 条；有文档快照的记录才可重新打开。

### 4.9 SavedDevice

应用级连接管理器正常写入的结构：

```js
{
  deviceId,
  name,
  displayName,
  serviceId,
  writeCharacteristicId,
  notifyCharacteristicId,
  writeType,
  mtu,
  maxWriteSize,
  modelId,
  protocolVersion,
  profileId
}
```

它用于后续发现和诊断，不等于连接仍然有效。进程被杀、系统回收 GATT 或特征句柄失效时，连接管理器必须重新验证。

`Repository.saveLastDevice()` 是较窄的兼容 API，只保存 `deviceId` 和 `name`；当前 `app.js` 由连接管理器直接拥有这个键。新代码不要交替使用两个写入者，否则会丢失已发现的通道、MTU 和型号元数据。

### 4.10 编辑器临时实体

`EditorDraft`：

```js
{ document, projectId, returnRoute, openedAt }
```

编辑页启动时消费并删除。若页面跳转失败，键可能保留到下一次编辑器打开。

`EditorAutosave`：

```js
{ document, projectId, updatedAt }
```

每次编辑提交、撤销、重做后覆盖。它没有版本历史，30 步撤销栈只在当前页面内存中。

## 5. v1 到 v2 迁移

`Repository.migrate()` 的实际顺序：

1. 读取 `niim-label:storage-version`；若 `>= 2`，返回 `false`。
2. 读取已存在的 v2 项目、模板和设置。
3. 规范化旧文档、旧模板，读取旧 profile。
4. 只有 v2 项目为空时才导入旧文档；只有 v2 模板为空时才导入旧模板。
5. 如有旧 profile，覆盖 `settings.defaultProfileId`。
6. 顺序写入项目（最多 120）、模板（最多 80）、设置、版本号 `2`。
7. 所有新键写成功后删除三个旧键，返回 `true`。

设计含义：

- 迁移不会把完整系统模板目录灌入用户模板键。
- 版本号最后写，且删除旧键更晚，因此中途写失败时旧数据仍在。
- 迁移不是跨键事务，没有快照回滚；可能已经写入部分 v2 键。下次运行会基于现有非空集合继续，避免重复导入，但仍应把迁移错误视为启动故障而不是“已成功”。
- `normalizeDocument()` 会补齐新元素默认值、清理未知类型并把文档 schema 设为 `2`。

## 6. 容量和性能语义

### 6.1 代码内上限

| 数据 | 上限 |
|---|---:|
| 项目 | 120 |
| 用户模板 | 80 |
| 数据行 | 1000 |
| 打印历史 | 80 |
| 带完整文档的打印历史 | 10 |
| 单文档元素 | 128 |
| 文本/编码值 | 512 字符 |
| 表格单元格 | 256 字符 |
| 表格 | 20 行 × 12 列 |
| 字号 | 0.5–25 mm |
| 字距 / 行距 | -20–20 mm / -5–10 |
| 序列号位数 | 1–20 |
| 单次 JSON 模板导入文件 | 页面限制 2 MiB |

这些限制不是整体字节预算。代码没有在写入前调用存储信息 API 估算剩余空间，也没有按文档大小淘汰；大量接近字段上限的项目仍可能导致同步写失败。

### 6.2 写放大

项目、模板、数据行和历史都以完整数组保存。新增、修改或删除一条记录会重写整个键；同步 API 会占用页面主线程。当前记录数上限用于控制风险，但不是数据库级索引或增量日志。

### 6.3 图片容量

从相册或相机选择的图片通过 `copyFile` 复制到 `wx.env.USER_DATA_PATH/label-image-<timestamp>.<ext>`，文档只存路径。删除图片元素、项目或模板时，当前代码没有垃圾回收对应文件；长期使用可能产生孤儿文件并占用用户文件空间。

随包素材和模板图片属于小程序包体，不占 `wx` 业务存储键配额，但受主包 2 MiB 门限约束。

## 7. 事务、一致性和并发

### 7.1 单键提交

微信同步存储一次 `setStorageSync` 是当前代码能观察到的最小提交单位。`saveProjects()` 先在内存验证完整批次，再只写一次 `projects`，因此对本批项目提供“全部验证后单键提交”。

普通操作没有 compare-and-swap、锁或修订号。两个页面若同时执行“读取数组 → 修改 → 写回”，后写者可能覆盖先写者。当前 UI 通常只有一个首页和一个编辑页，降低但没有消除这种风险。

### 7.2 跨键操作

- `migrate()`：跨键顺序写，无回滚。
- `restore()`：跨键顺序写，有应用层快照回滚。
- “保存项目 + 清理自动保存”：当前不是一个组合操作；保存项目不会删除 `editorAutosave`。
- “打印 + 写历史”：硬件打印成功后才写成功历史；历史写入失败可能导致实物已打印但无记录。

### 7.3 克隆语义

仓储多数读写通过 JSON 深拷贝，调用方修改返回对象不会直接改变已存值。该克隆方式只适合 JSON 数据：`Date`、`Map`、函数、`undefined`、循环引用和二进制对象不属于文档契约。

## 8. 备份、恢复与回滚

### 8.1 备份载荷

`backup()` 输出：

```js
{
  schemaVersion: 2,
  exportedAt: 'ISO-8601 timestamp',
  projects,
  templates,
  settings,
  dataRows,
  printHistory
}
```

明确不包含：

- `lastDevice` 和 GATT 元数据；
- `editorDraft`、`editorAutosave`；
- `ble_reconnect_off`；
- 用户图片文件二进制；
- 随包模板、素材和 vendor 代码。

因此当前备份是“业务 JSON 备份”，不是完整应用镜像。文档里的本地图片路径在原安装被清理或跨设备恢复后可能不可用。

### 8.2 恢复验证

`restore(payload)`：

- 要求 `schemaVersion` 是有限数字且至少为 1；
- 高于当前版本 2 时拒绝，要求升级小程序；
- 规范化项目和模板文档，过滤损坏条目；
- 合并默认设置；
- 对集合应用当前记录数上限；
- 最终把存储版本写为 2。

恢复是覆盖，不是合并。

### 8.3 回滚算法

恢复前对以下六个键记录 `{ key, existed, value }`：项目、模板、设置、数据行、打印历史、版本。随后顺序写入新值。

若任一写入失败：

1. 对快照中原本存在的键恢复旧值；
2. 对原本不存在的键执行删除；
3. 回滚全部成功时抛 `RESTORE_FAILED`，提示原数据已保留；
4. 任一回滚操作失败时抛 `RESTORE_ROLLBACK_FAILED`，提示不要继续编辑并联系支持。

回滚是尽力而为的应用层补偿，不具备数据库 WAL 或崩溃原子性。如果进程在写入新值与执行 catch 回滚之间被系统终止，可能留下混合版本；此时应保留外部备份并做人工恢复。

## 9. 数据安全与演进规则

新增或修改数据字段时应遵守：

1. 先修改 `normalizeDocument()` 或新增明确的实体规范化函数，再让页面消费字段。
2. 新存储版本必须保持迁移可重复执行，版本号最后提交，旧数据最后删除。
3. 对跨键覆盖操作继续使用“预验证 → 快照 → 写入 → 补偿回滚”，并测试中途失败和回滚失败。
4. 不把设备句柄、pending 命令、Canvas/Image 对象写进 JSON 存储。
5. 对用户图片建立单独的文件清单和垃圾回收前，不得宣称备份可跨设备完整恢复。
6. 如果引入云同步，需要新增稳定修订号、冲突规则、身份与隐私模型；不能直接复用当前最后写入覆盖语义。
