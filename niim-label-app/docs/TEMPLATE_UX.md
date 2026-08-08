# 模板打印体验复刻说明

目标：对齐 NIIMBOT 6.6.6 的**模板 → 预览 → 编辑 → 打印**主路径与交互质感，而不是只做协议层。

**工程：** `niim-label-app` · 存储键前缀 `niim-label:*` · appId `com.jc.niimlabel`

## 原版流程（静态证据 + 商店截图）

```text
首页红顶 Hero
  ├─ 设备芯片（右上）
  ├─ 四宫格快捷：行业模板 / 名片 / 服装 / 扫一扫
  ├─ 运营条（扫码/连网引导）
  ├─ 已安装标签
  ├─ 我的模板 + 打印历史
  └─ 推荐模板网格
        ↓
行业模板库（行业 chips + 品类分段 + 搜索）
        ↓
模板详情 Bottom Sheet（真实画布预览 + 元素摘要）
        ↓
编辑器（元素 / 对齐 / 样式 / 保存 / 打印）
        ↓
打印 Sheet → BLE 任务 → 历史（可打开 / 再打印）
```

## 本仓库对应实现

| 环节 | 文件 | 行为 |
| --- | --- | --- |
| 行业版式 | `src/app/template-layouts.js` | 15 套 mm 坐标洁净室版式 |
| 目录元数据 | `src/app/catalog.js` | 分类、行业、角标、文案 |
| 缩略图 | `src/app/template-thumbs.js` | 离屏 Canvas 缓存 PNG |
| 首页/库 | `src/app/views.js` | Hero、快捷、我的模板、预览 Sheet |
| 交互 | `src/app/main.js` | 统一 `preview-template` → `use-template`；历史打开/再打 |
| 视觉 | `src/styles.css` | 红色品牌、真缩略图、Sheet 动效 |

## P0 已完成

1. **统一入口**：`open-template` / 快捷 / 卡片 / 编辑器模板面板 → 一律先预览。  
2. **预览 Sheet**：加载态、失败文案、纸张尺寸、Esc 关闭、sticky 主按钮。  
3. **真缩略图**：卡片用 `renderDocument` 生成 data URL，失败回退 CSS 假标签。  
4. **打印历史闭环**：写入 `document` 快照 + `projectId`；**打开** / **再打印**。  
5. **存储键**：`niim-label:projects|templates|settings|data-rows|print-history`。

## 模板清单（离线可用）

零售：商品价格、促销价签、珠宝、服装吊牌  
仓储：货架、物流周转箱  
办公：线缆、线号序列、固定资产、名片、Wi-Fi 码  
生活：食品日期、餐饮效期、药品  
行业：国网电力标识（简化离线版，无远程底图）

## 交互细节

1. 点模板卡片 → **先预览**（Canvas 渲染真实元素），再「使用此模板」。  
2. 首页「行业模板」进入库并默认 `行业标识` 行业 chip。  
3. 「打印历史」读 `niim-label:print-history`，可重新打开快照或再打。  
4. 扫一扫：能力未接时 toast 提示，不假成功。  
5. 编辑器内模板页同样走预览，避免误覆盖当前文档而不知情。

## 编辑器 APK 对齐（进行中）

对照商店截图 + `niimbot_flutter_canvas` 资源：

- 白顶栏：返回 / 撤销 / 重做 / 清空 / 旋转 / 设置（原版 SVG）
- 耗材条：`T50*30-203WHITE ▼`
- 选中：蓝色实线框；多选虚线外包 + **Compact / Looser** 黑气泡
- 浮动快捷：编辑 / 复制 / 锁定 / 旋转 / 删除（`floating_shortcut/*`）
- 底栏面板：对齐/镜像 · 样式 · 字体 · 内容；对齐九宫格 + 圆形微调 + 等距分布 + 镜像开关
- 底栏：保存 / 打印（原版 bottom_bar 图标）

## P1 已完成

- **替换标签纸**：`open-stock-sheet` 常用尺寸 + 自定义 mm，可应用到当前标签 / 默认新建尺寸  
- **批量生成**：选模板 + 勾选行 + 打开第一行 / 全部写入项目；`data-bind.js` 字段映射  
- **我的模板管理**：重命名 / 删除  

## P0 主链路修复（体验审计后）

审计结论：**全新安装下，15 套模板只有 2 套走得通**。根因是三处断链，已全部修复。

| # | 问题 | 现在的行为 | 落点 |
| --- | --- | --- | --- |
| 1 | 默认机型 D110 打印头 96px(12mm)，13/15 模板超高 → 点「打印」面板不弹，只有 2.8 秒红字，而改机型的下拉框就在那个打不开的面板里 | 面板**必开**，顶部黄条说明超限并给「换成 B1」/「更换标签纸」两个出口；已连打印机时不再建议换机型（换菜单项换不了硬件），改说「已连接的 X 打不了这张标签」 | `core/profiles.js` `evaluatePrintability()`、`main.js` `evaluatePrintBlock()`、`views.js` `printSheet` |
| 2 | 打印中点遮罩/Esc 会关掉面板、进度条消失、无法取消；失败只有 2.8 秒 toast | 打印中遮罩与 Esc 失效并提示；左键变红色「停止打印」；失败常驻错误条（中文人话）+「重试打印」「重新连接」 | `main.js` `closeModal()` `cancelPrint()` `friendlyPrintError()` |
| 3 | 「连接并打印」连上后 `state.modal=''`，面板被关掉，纸没出 | `printIntent` 贯穿连接流程，连上即回到面板继续打印 | `main.js` `startPrint()` / `connectDevice()` |
| 4 | `openDocument` 自动选中首元素 → 面板落到 content tab → 底部「保存/打印」整块被省略 | 落地即 idle 首屏（添加元素｜模板｜数据源）+ 保存/打印双按钮 | `state.js` `openDocument()` |
| 5 | 改字要赌快速双击 | 已选中元素上**再点一次**进内容态（单击选中+拖动语义不变，符合 `EDITOR_INTERACTION_SPEC` I1/I2） | `main.js` `selection.onpointerdown` / `finishCanvasGesture` |
| 6 | 顶栏撤销/重做不在 `refreshEditorChrome` 重绘范围内，改完字仍是灰的 | `patchHistoryButtons()` 局部同步 | `main.js` |
| 7 | 保质期是写死的文本（`2026-08-12` / `2026-08-06 18:00` / `有效期至：2027-03`）；日期元素还重复打印自己的标题 | 改为 `dateRole:'expire'` + 预设时长实时计算；`label:''` 去重 | `template-layouts.js` |
| 8 | 批量数据只在点那个无文字的保存图标时落盘 | 输入防抖 500ms 自动落盘 + 失焦/切页/卸载立即 flush，顶栏显示「已保存 14:32」 | `main.js` `scheduleRowSave()`、`views.js` `dataView` |
| 9 | 空态「查看全部」只清分类，搜索词与行业 chip 还在，点了还是空 | `reset-template-filters` 一次清三项；空态回显是哪几层筛掉的；标题显示「筛选出 N / M」 | `main.js`、`views.js` `templatesView` |
| 10 | 预览/打印/编辑器按返回键一律直接退出 App | `@capacitor/app` 接管：Sheet → 关闭、编辑器 → 退出、非首页 → 回首页、首页 → 再按一次退出；Web 侧 popstate 兜底 | `main.js` `goBack()` / `bindBackButton()` |

### 顺带修掉的模板内容 bug

`promo-price` EAN-13 校验位错（应为 2）、`cable-name` 条码 13mm 装不下 `CABLE1206`（需 19.3mm）、`serial-cable` 条码宽度不足 —— 这三套此前**在任何机型上都渲染不出来**。另：`clothing-tag` 里装的是一张护肤乳液标签（首页快捷入口「服装款式」直指它），已换成真正的服装吊牌（款号/颜色尺码/面料/吊牌价/EAN-13）。

### 遗留：50mm 宽模板无任何机型可打

`promo-price` / `storage-code` / `shipping-bin` / `asset-card` / `business-card` / `state-grid` 共 6 套是 50mm 宽，而所有 profile 的 `printheadPixels` 都是 384 = **48.05mm**，`alignedCanvasSize` 直接拒绝。`STOCK_PRESETS` 里的 50×30 / 50×40 / 60×40 / 70×50 同理。

根因是把「纸张尺寸」和「打印头可打宽度」当成了同一个值 —— 真机 B21 是能进 50mm 纸、只印得到中间 48mm 的。两条路：

- **A（推荐）**：让文档宽度可超过打印头，渲染/编码时按可打区裁切并居中，编辑器画布标出不可打印边距。改 `alignedCanvasSize` 语义 + `renderer`/`image-encoder`，需要真机验证。
- **B（权宜）**：把这 6 套模板改成 48mm 宽并按 0.96 缩放坐标。当天可打，但与用户手上的 50mm 耗材有 2mm 落差，且 QR 元素会被压成非正方。

未做 B，因为它是拿"缩模板"掩盖建模问题；P0-1 的岔路已能让用户体面地换纸走出去。

## 尚未对齐（P2+）

- Excel 原生 xlsx、字段级可视化绑定 UI  
- 扫码开模板 / 相机 OCR  
- 云端行业模板 / VIP（明确不做）  
- 批量直接连打多张

## 验证

```powershell
cd D:\vibecode\jc\niim-label-app
npm.cmd test
npm.cmd run build
npm.cmd run dev
# 浏览器：首页 → 模板 → 预览 → 使用 → 编辑 → 打印 Sheet → 历史打开
```
