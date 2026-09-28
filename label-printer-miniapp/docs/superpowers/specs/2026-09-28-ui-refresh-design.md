# 商跃标签 UI 视觉改版 — 设计说明

日期：2026-09-28 · 范围：`miniprogram/` 两个页面（home、editor）及其全部弹层 + Figma 设计系统

## 1. 目标与已确认的决策

目标：在不改信息结构和业务流程的前提下，把小程序整体视觉做成主流工具类 App 的观感，并在 Figma 里交付一套与代码一一对应的设计系统和页面稿。

| 决策 | 结论 |
| --- | --- |
| 视觉方向 | 清爽白底 + 品牌红点缀；红色只用于主按钮、选中态、角标 |
| 主色 | `#E02D26`（白字对比度 4.6:1，满足 UX_SPEC 的 4.5:1 目标） |
| 实现方式 | 原生 WXSS 设计变量 + SVG 遮罩图标，就地改造现有页面；不引入 UI 组件库 |
| 图标来源 | Lucide（ISC 许可），由脚本生成 WXSS，登记第三方声明 |
| Figma 交付 | 变量 + 文字样式 + 核心组件 + 约 12 个页面，变量名与代码变量对应 |
| 顺序 | 先改代码并验证，再做 Figma |

## 2. 不变的约束

- 首页顺序：最近标签 → 当前纸张 → 商跃模板 → 扫码建标（`tests/home-page.test.js` 校验）。
- 底栏：首页 / 模板 / ＋ / 标签 / 我的；编辑器顶栏图标顺序、三 Tab、底部保存与打印常驻（UX_SPEC 4.6）。
- 头部让开微信胶囊：`headerTop`、`menuSafeRightPx` 的计算逻辑不改。
- 冒烟脚本依赖的选择器全部保留：`.onboarding-actions button/.primary-button`、`.bottom-nav button[data-route]`、`.circle-button`、`.device-pill`、`.brand-row`、`.create-nav`、`.tool-button[data-type]`、`.save-button`、`.print-button`、`.header-main button`、`.icon-button.close`、`.draft-recovery .primary-button`、`.project-open`、`.print-actions button`、`.print-sheet .sheet-close`、`.plain-header`（首个 button 为导入）、`.library-card`、`.preview-sheet .primary-button`、`.paper-shell`、`.label-canvas`、`.selection-canvas`。
- `.paper-shell` 不加 min/max-height，保持上下 `margin: auto`；`.canvas-stage` 保持 `align-items: flex-start`。
- 文案、事件绑定、数据结构不变；只做与视觉直接相关的少量文案补充（空状态一句说明、“本地模式”标识）。

## 3. 设计变量（`app.wxss` 的 `page {}`）

颜色

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--color-primary` | `#E02D26` | 主按钮、选中、角标、链接 |
| `--color-primary-pressed` | `#C4231D` | 主按钮按下 |
| `--color-primary-soft` | `#FFF1F0` | 选中底色、图标底板 |
| `--color-primary-line` | `#FFCCC7` | 选中描边 |
| `--color-bg` | `#F5F6F8` | 页面底 |
| `--color-surface` | `#FFFFFF` | 卡片、弹层 |
| `--color-fill` | `#F2F3F5` | 输入框、图块、次级填充 |
| `--color-fill-strong` | `#E8EAED` | 拖拽条、按下填充 |
| `--color-border` | `#E5E6EB` | 描边 |
| `--color-divider` | `#F0F1F3` | 分隔线 |
| `--color-text-1` | `#1F2329` | 标题、正文 |
| `--color-text-2` | `#51565D` | 次要正文 |
| `--color-text-3` | `#646A73` | 辅助说明（白底 5.5:1） |
| `--color-text-4` | `#8F959E` | 占位、禁用、箭头 |
| `--color-success` / `-soft` | `#1E9E62` / `#E8F7EF` | 已连接、成功 |
| `--color-warning` / `-soft` | `#B86E00` / `#FFF6E5` | 提醒 |
| `--color-danger` / `-soft` | `#E02D26` / `#FFF1F0` | 危险动作（与主色统一） |

字号（rpx）：`--font-display` 40 · `--font-title` 34 · `--font-subtitle` 30 · `--font-body` 28 · `--font-caption` 24 · `--font-tiny` 20。字重只用 400 / 500 / 600。

间距：`--space-1..6` = 8 / 12 / 16 / 24 / 32 / 48rpx；页边距 `--gutter` 32rpx。
圆角：`--radius-xs/sm/md/lg/xl/full` = 8 / 12 / 16 / 24 / 32 / 999rpx。
阴影：`--shadow-card`（几乎不可见）、`--shadow-float`（弹层、浮条）、`--shadow-primary`（“＋”与主按钮）。

## 4. 图标

- `scripts/build-icons.mjs` 从 `lucide-static`（开发依赖，精确版本）读取固定清单的 SVG，统一 `stroke-width=1.8`，压缩后写入 `miniprogram/styles/icons.wxss`（生成文件，含来源与版本注释），同时写 `docs/design/icons.json` 供 Figma 使用同一批 SVG。
- 用法：`<text class="icon icon-house"></text>`，尺寸跟随 `font-size`，颜色跟随 `color`（`background-color: currentColor` + `-webkit-mask-image`）。
- 替换所有 Unicode 符号图标：底栏、头部、菜单、编辑器工具、顶栏、弹层、空状态、引导。
- `THIRD_PARTY_NOTICES.md` 与 `miniprogram/THIRD_PARTY_NOTICES.txt` 登记 Lucide ISC 许可。

## 5. 通用组件（全局样式，保留现有 class 名）

- 按钮：`primary-button`（主）/ `outline-button`（次）/ 文字按钮 / `danger-*`；尺寸 L 88rpx、M 72rpx、S 56rpx；主按钮全圆角，文字垂直居中。
- 筛选：一级为文字 Tab（下方红色短横线），二级为胶囊 Chip（选中 = 浅红底 + 红字 + 描边 + 加粗）。
- 卡片：白底 24rpx 圆角，几乎无阴影；缩略图区域用 `--color-fill` 底。
- 列表行：图标 + 标题 + 说明 + 右箭头，行高 ≥ 104rpx，分隔线左侧缩进。
- 底部弹层：拖拽条 + 标题/说明 + 圆形关闭按钮 + 底部整行按钮；两个页面共用一套样式。
- 分段选择器、开关行、步进器、输入块统一写法。

## 6. 页面

首页
- 顶部淡红渐变，渐隐到页面底色；品牌块（红色方块“商”+ 标题 + 副标题），右侧帮助圆钮与设备胶囊（蓝牙图标 + 状态文字 + 箭头；已连接变绿并换“已连接”图标）。
- 草稿恢复卡、最近标签（空状态为白卡 + 图标 + 一句说明 + 三个等宽按钮）、当前纸张卡、商跃模板两列卡、扫码建标横条。
- 底栏：线性图标 + 文字，选中为红色；中间红色圆形“＋”，白色加号。

模板页
- 白色页头（标题、副标题、导入按钮）与白色工具区（搜索框、一级文字 Tab：全部/行业标识/内容设计/实用功能/行业库/我的，二级 Chip：分类或场景，行业库再加尺寸 Chip），下方灰底两列模板卡。

标签页：白色页头 + 搜索；项目卡右上角删除图标按钮（保留 `aria-label`）。
批量数据：白色页头；导入/导出次按钮带图标；表格白卡；批量生成卡。
我的：淡红渐变头部（头像块、标题、“本地模式”标识、说明）；统计卡；分组菜单（中性色图标）；隐私说明。

弹层：模板预览、选择标签纸（当前尺寸高亮）、打印历史（成功/失败用图标 + 颜色）、默认打印设置、使用帮助、首次引导（大图标底板 + 标题 + 说明 + 跳过/下一步）。

编辑器
- 顶栏：图标按钮（关闭、撤销、重做 | 图层、打印机、设置）；文档行：可编辑名称 + 尺寸胶囊 + 连接状态点与文字。
- 画布区：浅灰点阵背景，标签纸白底圆角阴影；选中提示为浮动胶囊；保存状态为居中小胶囊（失败时红色）。
- 面板：三 Tab 下划线样式；工具 5 列（图标底板 + 文字）；属性区统一输入块、分段选择器、B/I/U/S 图标按钮；形状选项改为中文（矩形/圆角/圆形/椭圆）。
- 底部动作条：“保存”次按钮 + “打印”红色主按钮（1:2 宽度）。
- 弹层：连接打印机、打印预览（修复主按钮文字不居中）、标签与打印设置、图层、素材库、装饰边框。
- 滑块 `activeColor`、开关 `color`、确认框 `confirmColor` 统一为主色。

## 7. Figma

- 新建文件“商跃标签 · 设计系统”（团队：beatricewylde2829's team）。
- 页面：Cover、Foundations（颜色、字号、间距、圆角、图标）、Components、Screens。
- 变量集合 `Tokens`：`color/*`、`space/*`、`radius/*`，与 CSS 变量同名（去掉 `--` 前缀、`-` 改 `/`）。
- 文字样式：Display / Title / Subtitle / Body / Caption / Tiny；字体用 Noto Sans SC（Figma 中无 PingFang SC）。
- 图标组件：使用 `docs/design/icons.json` 的同一批 SVG。
- 组件：Button（类型 × 尺寸）、IconButton、Chip、Tab、SearchField、TemplateCard、ProjectCard、StockCard、ListCell、SectionHeader、TabBar、HomeHeader、Sheet、Segmented、SwitchRow、ToolTile、EditorActionBar、Stepper、Badge。
- 页面（375×812）：引导、首页（空）、首页（有标签 + 草稿）、模板、模板预览、我的标签、批量数据、我的、编辑器（未选中）、编辑器（选中文本）、打印预览、连接打印机。
- 调用预算：教育版每天 200 次，Figma 写入按批合并。

## 8. 验证

- 新增测试：图标类名全部有定义、图标只用内联 data URI、WXSS 用到的变量均已定义、页面中不再残留 Unicode 符号图标、滑块/开关颜色统一。
- `npm run verify`（静态检查 + 单测 + 公开包门禁）通过。
- 微信开发者工具冒烟 `npm run test:wechat -- --cli <cli.bat> --lib 3.17.2` 通过，并补拍其余页面截图逐页检查。
- 真机（iOS / Android）遮罩图标与渐变渲染仍需按发布清单验收；模拟器通过不代表真机通过。

## 9. 不做

深色模式、信息结构或流程调整、新功能、Skyline 渲染、画布内选中框配色（在 JS 渲染器里，改动有回归风险）。

## 10. 风险

- rpx 写在 CSS 变量里的换算：先在模拟器验证，不行则变量改用 px。
- 遮罩图标依赖 WebView 渲染（当前项目即是）；真机需复核。
- 编辑器面板变高会挤压画布：动作条与 Tab 总高控制在 208rpx 内，小屏媒体查询同步收紧。
