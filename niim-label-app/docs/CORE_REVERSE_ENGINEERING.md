# NIIMBOT 6.6.6 核心链路逆向与复原

分析样本：`NIIMBOT_6.6.6_APKPure.xapk`（versionName `6.6.6`，versionCode `607281807`）。  
结论分级：`VERIFIED`（本仓库测试/实现已固定）、`INFERRED`（静态资产或公开协议线索）、`TODO`（缺硬件或服务端证据）。

本文件只描述**核心离线链路**：标签文档 → 画布渲染 → 1bpp 编码 → BLE 协议 → 分机型打印时序。  
账号、商城、云模板、支付、会员不在核心范围内。

---

## 1. 样本与壳层

| 工件 | 角色 | 说明 |
| --- | --- | --- |
| XAPK | 安装包 | base + `config.arm64_v8a` + `config.hdpi` |
| `classes.dex` ~22 KB | SecNeo 壳 | 可见 Java 几乎只有 `com.secneo.apkwrapper.*` |
| `libapp.so` ~30 MB | Flutter AOT | 业务主体，无法直接移植 |
| `libniimbot_canvas_image.so` ~15 MB | 画布/图像 native | 位图/滤镜相关，洁净室用 Canvas 2D 重写 |
| `libniimbot_excel.so` / calamine | Excel | P2 数据源 |
| `assets/flutter_assets` | 配置与 UI 资产 | `printerList.json`、模板 JSON、编辑器文案 |

架构（`INFERRED`）：

```text
LaunchActivity / MainActivity
  ├─ Flutter AOT (niimbot_flutter_canvas / connector / print_setting)
  ├─ Android 原生 Activity（设备、Excel、商品库、扫码…）
  ├─ WebView / Uni-App / Capacitor 模块
  └─ native BLE + 图像 + 存储 SDK
```

复原策略：不反编译搬运 AOT/`.so`，在 `label-printer-app` / `label-printer-miniapp` 做行为级洁净室重写。

---

## 2. 核心功能分解

原 App 核心可拆成 6 条竖切：

| # | 域 | 原 App 证据 | 本仓库状态 |
| --- | --- | --- | --- |
| 1 | 标签文档模型 | 模板 JSON：`width/height/rotate/elements/values` | `VERIFIED` `document.js` |
| 2 | 画布编辑 | 10 类元素 + 对齐/撤销/锁定等文案与 SVG | `VERIFIED` 文本/条码/二维码/图/形/线/日期/流水/表格 |
| 3 | 预览渲染 | Flutter canvas + native 图像库 | `VERIFIED` Canvas 2D `renderer.js` |
| 4 | 1bpp 栅格 | 打印方向、行重复、稀疏索引 | `VERIFIED` `image-encoder.js` |
| 5 | BLE 传输 | GATT 服务/特征、MTU、串行写 | `VERIFIED` `ble-session.js` + Capacitor BLE |
| 6 | 打印协议与时序 | 帧 `55 55 … AA AA`、分机型 task | `VERIFIED` D11/D110/B1/B21 家族 |

非核心（静态有入口，不阻塞离线闭环）：Wi-Fi 配网、固件 OTA、RFID/NFC、悬浮窗截屏打印、云端账号体系。

---

## 3. 标签文档模型（从模板 JSON 还原）

样本：`c1_default_template_file.json`、医药/商品/国网模板（`INFERRED` 字段语义）。

```text
LabelDocument
  width, height          // mm
  rotate                 // 标签方向 0/90/270
  canvasRotate           // 画布层旋转（与设备 printDirection 分离）
  paperType              // 间隙/黑标/连续等
  consumableType
  paccuracyName          // 203 / 300
  elements[]             // 几何 + 类型专有字段
  values[]               // 与元素解耦的数据源绑定（Excel/商品/序列）
  bindInfo / dataSource*
  usedFonts
  profile.machineName    // 目标机型名
```

元素公共字段：`id, type, x, y, width, height, zIndex, rotate`。

画布 10 类元素（编辑器 `zh.json` 直证）：

1. 文本 `text`
2. 一维码 `barcode`
3. 二维码 `qrcode`
4. 时间 `date`
5. 序列号 `serial`
6. 图片 `image`
7. 素材 `material`
8. 形状 `graph`（本实现 `rect`）
9. 线条 `line`
10. 表格 `table`

文本元素额外字段（样本 + 文案）：字号、字体、字距、行距、水平/垂直对齐、竖排、`typesettingMode`、`colorReverse`、自动缩小（`minimized`）。

**本仓库映射**：毫米坐标、`schemaVersion: 1`、打印时再转点阵；`values`/数据源绑定部分完成（CSV 批量），完整 Excel 映射为 P2。

---

## 4. 打印机能力矩阵（`printerList.json`）

- 79 机型 / 27 系列  
- 56×203 dpi，23×300 dpi  
- `printDirection`：`0` 顶入纸（53），`90` 左入纸（24），`270`（2）  
- `codes[]`：设备上报的 model ID（握手 `PRINTER_INFO` type=8）  
- 浓度：`solubilitySetStart/End/Default`  
- 最大打印宽高：`maxPrintWidth/Height`（mm）  
- 可选：Wi-Fi、校准、裁刀、RFID  

与核心打印直接相关的字段 → `profiles.js`：

| 配置字段 | Profile 字段 |
| --- | --- |
| `paccuracyName` | `dpi` |
| `printDirection` 0/90 | `printDirection` top/left |
| `solubilitySet*` | `densityMin/Max/Default` |
| `defaultWidth/Heigth` | `defaultSize` |
| `codes[]` | `profileForModelId` 映射表 |
| 系列协议差异 | `task`：`d110` / `d11Legacy` / `b1` / `b21Legacy` |

**printhead 像素（VERIFIED 基线，非简单 mm×dpi 估算）**：

- D11/D110 左向：`96`（约 12 mm @203）
- B1/B21 顶向：`384`（约 48 mm @203）

300 dpi 机型（D11_H/Pro、B1 Pro、B21_Pro 等）`printhead` 与 task 未经验证，默认**阻止打印**直至硬件验收。

### 4.1 已接线 model ID（核心家族）

| codes | 机型名 | profile / task | 状态 |
| --- | --- | --- | --- |
| 512 | D11 / Hi-NB-D11 | d110 或 d11-legacy（看协议版本） | VERIFIED 映射逻辑 |
| 514 | D11S | d11-legacy | VERIFIED 映射 |
| 2304, 2305 | D110 / Hi-D110 | d110 | VERIFIED 映射 |
| 2320 | D110_M | d110 | INFERRED 同系列 |
| 4096 | B1 | b1 | VERIFIED 映射 |
| 4098 | B1 SE | b1 | INFERRED 同 203 协议族 |
| 768 | B21 | b21Legacy | VERIFIED |
| 769 | B21-L2B | b21Legacy | VERIFIED |
| 771, 775 | B21-C2B | b1 时序 | VERIFIED |
| 776 | B21S-C2B | d110 时序 | VERIFIED |
| 777 | B21S | d110 时序 | VERIFIED |

刻意保持 `null`（待 300dpi/硬件证据）：`528` D11_H、`531` D11_Pro、`4097` B1 Pro、`785` B21_Pro 等。

---

## 5. BLE 传输层

公开兼容实现中固定的 Nordic-style 自定义服务（本仓库 `VERIFIED`）：

```text
Service  e7810a71-73ae-499d-8c15-faa9aef0c3f2
Write    bef8d6c9-9c21-4c9e-b632-bd58c1009f9f
Notify   bef8d6c9-9c21-4c9e-b632-bd58c1009f9e
```

会话约束（`ble-session.js`）：

1. 扫描 → 连接 → 枚举服务/特征（优先已知 UUID，否则按 properties 回退）
2. 开 notify（CCCD）后再 ready
3. 协商 MTU，写上限 `mtu - 3`
4. **完整协议帧**为最小写入单位；帧长 > maxWrite 则失败，不静默拆 GATT 包
5. 请求/响应串行 + 超时；notify 字节进 `PacketParser` 组帧

---

## 6. 应用层协议

帧格式（`VERIFIED`）：

```text
55 55 | CMD | LEN | DATA[0..LEN-1] | XOR_CSUM | AA AA
csum = CMD ^ LEN ^ DATA[0] ^ … ^ DATA[n-1]
CONNECT 帧前缀额外 0x03
```

### 6.1 命令 / 响应（核心子集）

| CMD | 含义 | 期望响应 |
| --- | --- | --- |
| `0xC1` CONNECT | 握手 | `0xC2` data∈{1,2,3} |
| `0x40` PRINTER_INFO | 查询信息 subtype | model `0x48` / sw `0x49` / hw `0x4C`… |
| `0xA5` PRINTER_STATUS_DATA | 扩展状态（connect=3） | `0xB5` |
| `0xDC` HEARTBEAT | 心跳 | `0xDD/DE/DF/D9` |
| `0x21` SET_DENSITY | 浓度 | `0x31` |
| `0x23` SET_LABEL_TYPE | 纸型 | `0x33` |
| `0x01` PRINT_START | 开始任务 | `0x02` |
| `0x20` PRINT_CLEAR | 清缓冲（D 系列） | `0x30` |
| `0x03` PAGE_START | 页开始 | `0x04` |
| `0x13` SET_PAGE_SIZE | 行列/份数 | `0x14` |
| `0x15` SET_QUANTITY | 份数（D 系列） | `0x16` |
| `0x85` PRINT_BITMAP_ROW | 位图行 | 可选 check |
| `0x83` PRINT_ROW_INDEXED | 稀疏黑点索引行 | 可选 check |
| `0x84` PRINT_EMPTY_ROW | 空行重复 | 可选 check |
| `0x86` CHECK_LINE | 行确认 | `0xD3` |
| `0xE3` PAGE_END | 页结束 | `0xE4` |
| `0xF3` PRINT_END | 任务结束 | `0xF4` |
| `0xA3` PRINT_STATUS | 状态轮询 | `0xB3` |
| `0xDA` CANCEL | 取消 | `0xD0` |
| — | 页进度推送 | `0xE0` PAGE_INDEX |
| — | 打印错误推送 | `0xDB` |

### 6.2 握手状态机（`printer-client.js` VERIFIED）

```text
CONNECT(1)
  ├─ result 1 → protocolVersion=0，旧路径，信息查询失败可容忍
  ├─ result 2 → protocolVersion=1
  └─ result 3 → 读 PRINTER_STATUS_DATA
                  用 status[11..12] 推 3/4/5 版本
                  信息查询失败则断开
                  HEARTBEAT(4)
查 PRINTER_INFO：model/serial/battery/hw/sw…
modelId = u16be(model) 或单字节左移 8
```

### 6.3 打印任务时序（`print-plan.js` VERIFIED）

公共前缀：`SET_DENSITY` → `SET_LABEL_TYPE` → `PRINT_START`。

| task | 特征 |
| --- | --- |
| `d110` | clear → page → pageSize(rows,cols) → quantity → rows → pageEnd；一份份数走 quantity |
| `d11Legacy` | 先 HEARTBEAT；pageSize 仅 rows；其余近 d110 |
| `b1` | PRINT_START 带 copies；pageSize(rows,cols,copies)；单页含多份 |
| `b21Legacy` | 每 copy 一页；行带 CHECK；pageSize 无 copies；countsMode=total |

行编码（`image-encoder.js`）：

- 按 `printDirection` 取样：`left` 时行沿宽度推进，列映射高度翻转
- 空行 `0x84` + 重复次数
- 稠密黑点 `0x85` 全行位图
- 稀疏黑点 `0x83` 索引表（更省带宽）
- 连续相同行合并，重复上限 200

---

## 7. 端到端数据流（已复原）

```text
UI 编辑 LabelDocument (mm)
    ↓ renderer (dpi, 字体/条码/QR)
RGBA ImageData
    ↓ encodeImageData(direction, threshold)
rowsData[]
    ↓ buildPrintPlan(profile.task, density, copies, labelType)
steps[] { command, data, expect? }
    ↓ PrinterClient 串行 session.request / write
BLE notify → PacketParser → 匹配响应 / PAGE_INDEX / ERROR
    ↓ PAGE_END / PRINT_END / STATUS
打印历史 + 成功/失败
```

预览与打印共用文档与方向规则，避免“预览对了、打印歪了”。

---

## 8. 原 App 功能面 vs 复原优先级

| 优先级 | 内容 | 复原情况 |
| --- | --- | --- |
| P0 | 编辑、本地保存、BLE 连接、已支持机型打印 | **已完成**（缺实体机签字验收） |
| P1 | 完整画布手势、表格、日期/序列、模板夹、历史重打 | **大部分完成** |
| P2 | Excel 列映射、商品库、批量、字体包、校准 UI | **部分（CSV）** |
| P3 | 79 机型、300dpi、热转印、Wi-Fi、RFID、裁刀 | **能力表已提取；协议未全量** |
| P4 | 账号/云/商城/会员/推送 | **不做**（需官方 API） |

---

## 9. 洁净室边界

允许：

- 公开协议与兼容实现（记录来源）
- 本仓库独立测试向量
- 合法持有打印机上的 GATT/帧抓取
- 原 App **功能名清单**（非实现拷贝）

禁止：

- 拷贝 Flutter AOT、DEX、`.so`、字体、私有 SDK
- 去壳/重打包/绕过登录付费耗材校验
- 把 XAPK、`research/` 提取物提交进产品仓库

---

## 10. 下一步（把核心做到“可签字”）

1. **实体机 P0 矩阵**：D11/D110、B1、B21 各打一张标准标签，记录 modelId、固件、MTU、成功帧序列。  
2. **300 dpi 专项**：对 D11_H / B1 Pro 抓握手与 pageSize，再开独立 profile。  
3. **B18/B16 左向小机**：静态像 D11 族，需确认 task 与 printhead。  
4. **错误码表**：`0xDB` / status 字节 → 缺纸、开盖、过热等人话。  
5. **文档导入**：读取原模板 JSON 子集，转本仓库 `schemaVersion:1`。

---

## 11. 关键代码入口

| 文件 | 职责 |
| --- | --- |
| `src/core/document.js` | 文档与元素工厂 |
| `src/core/renderer.js` | 预览/打印位图 |
| `src/core/image-encoder.js` | 1bpp + 行命令 |
| `src/core/protocol.js` | 帧编解码 |
| `src/core/print-plan.js` | 分 task 时序 |
| `src/core/profiles.js` | 机型能力与 modelId |
| `src/services/ble-session.js` | GATT 会话 |
| `src/services/printer-client.js` | 握手与打印执行 |
| `src/app/main.js` | UI 闭环 |

静态分析补充文档：`docs/APK_INVENTORY.md`、`docs/PORT_PLAN.md`、`../GROK_EXECUTION_PLAN.md`。
