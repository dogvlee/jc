# 设计系统与视觉规范

视觉方向：清爽白底 + 品牌红点缀。红色只用于主按钮、选中态和来源角标，其余界面由中性色承担。设计说明见 [UI 视觉改版设计说明](./superpowers/specs/2026-09-28-ui-refresh-design.md)。

Figma：[商跃标签 · 设计系统与页面](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL)（变量、图标、组件与 12 张页面稿）。

## 代码位置

| 文件 | 内容 |
| --- | --- |
| `miniprogram/app.wxss` | 设计变量（`page {}`）、按钮重置、按钮 / 筛选标签 / 卡片 / 选择框 / 底部弹层等通用样式 |
| `miniprogram/styles/icons.wxss` | 图标类，**生成文件，勿手改** |
| `miniprogram/pages/*/index.wxss` | 页面布局与页面专属样式，只引用变量 |
| `scripts/build-icons.mjs` | 从 `lucide-static` 生成图标 WXSS 与 `docs/design/icons.json` |
| `tests/ui-icons.test.js`、`tests/ui-tokens.test.js` | 图标与变量的回归测试 |

## 设计变量

Figma 变量名 = CSS 变量去掉 `--`，第一个 `-` 改为 `/`（`--color-text-1` ↔ `color/text-1`，`--gutter` ↔ `space/gutter`）。Figma 以 375 宽画布为准：**px = rpx ÷ 2**。

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--color-primary` | `#E02D26` | 主按钮、选中、角标；白字对比度 4.6:1 |
| `--color-primary-pressed` / `-soft` / `-line` | `#C4231D` / `#FFF1F0` / `#FFCCC7` | 按下、选中底色、选中描边 |
| `--color-bg` / `--color-surface` | `#F5F6F8` / `#FFFFFF` | 页面底、卡片与弹层 |
| `--color-fill` / `--color-fill-strong` | `#F2F3F5` / `#E8EAED` | 输入框与图块、拖拽条 |
| `--color-border` / `--color-divider` | `#E5E6EB` / `#F0F1F3` | 描边、分隔线 |
| `--color-text-1…4` | `#1F2329` `#51565D` `#646A73` `#8F959E` | 标题 / 次要 / 辅助（白底 5.5:1）/ 占位 |
| `--color-success` / `--color-warning`（含 `-soft`） | `#1E9E62` / `#B86E00` | 已连接、成功；提醒 |
| `--color-danger` / `-soft` | 同主色 | 危险动作与主色统一 |
| `--color-mask` | `rgba(15,17,20,.5)` | 弹层遮罩 |
| `--font-display…tiny` | 40 / 34 / 30 / 28 / 24 / 20 rpx | 字号；字重只用 400 / 500 / 600 |
| `--space-1…6`、`--gutter` | 8 / 12 / 16 / 24 / 32 / 48 rpx，边距 32 rpx | 间距 |
| `--radius-xs…xl`、`--radius-full` | 8 / 12 / 16 / 24 / 32 / 999 rpx | 圆角 |
| `--shadow-card` / `-float` / `-primary` | 卡片 / 弹层与浮条 / 红色浮起 | 阴影只有三级 |

规则：

- 页面样式只引用变量，不写新的品牌红；`tests/ui-tokens.test.js` 拦截旧红色和未定义变量。
- 原生组件颜色属性同样统一：`slider activeColor`、`switch color`、`wx.showModal confirmColor` 均为 `#E02D26`。
- 选中态必须同时改变形状或字重（描边、白底浮起、加粗），不能只靠颜色。
- 按钮高度 L 88 / M 72 / S 56 rpx，文字垂直居中；主按钮全圆角。`button` 的默认按下、禁用和左右 auto 外边距已在 `app.wxss` 覆盖，按钮间距用 `gap`。

## 图标

- 来源：Lucide（ISC，部分图标源自 Feather MIT），开发依赖 `lucide-static@1.48.0`，线宽统一 1.8；许可见 `THIRD_PARTY_NOTICES.md`。
- 用法：`<text class="icon icon-house" aria-hidden="true"></text>`，尺寸跟随 `font-size`，颜色跟随 `color`（SVG 遮罩）。纯图标按钮必须有 `aria-label`。
- 新增图标：在 `scripts/build-icons.mjs` 的 `ICON_NAMES` 加 Lucide 名称，运行 `npm run build:icons`，再在页面使用；测试要求“已定义 = 已使用”，产物过期也会失败。
- Figma 中对应组件 `Icon/<name>`，使用 `docs/design/icons.json` 的同一批 SVG。

## 组件与 class 对照

| Figma 组件 | 代码 |
| --- | --- |
| Button（Primary / Secondary / Danger / Text × Large / Medium / Small） | `.primary-button` `.outline-button` `.danger-button` `.text-button` + `.btn-l` `.btn-s` |
| Icon Button（Plain / Soft / Glass） | `.icon-button`、`.close-button` / `.sheet-close`、`.circle-button` |
| Chip / Tab | `.chip.active`、`.filter-tab`、`.panel-tabs button` |
| Search Field / Picker Field | `.search-box` / `.picker-field` |
| Segmented Control / Switch Row / Stepper / Field Tile | `.segment-row` / `.switch-row` / `.stepper` / `.field-grid label` |
| Template Card / Project Card / Stock Card | `.template-card` / `.project-card` / `.stock-card` |
| List Cell / Section Header / Empty State / Promo Row | `.menu-section button` / `.section-heading` / `.friendly-empty` / `.scan-banner` |
| Tab Bar / Home Header / Page Header / Device Pill | `.bottom-nav` / `.home-hero` / `.plain-header` / `.device-pill` |
| Editor Toolbar / Tool Tile / Editor Action Bar | `.editor-header` / `.tool-button` / `.editor-actions` |
| Sheet Header / Status Pill / Notice Card / Preset Tile / Onboarding Card | `.sheet-heading` / `.draft-save-status` / `.warning-card`、`.error-card` / `.preset-grid button` / `.onboarding-card` |

## 需要真机或后续确认

- 遮罩图标与渐变头部已在微信开发者工具（基础库 3.17.2、2.32.3）验证，Android / iOS 真机仍需按发布清单复核。
- 开发者工具会把 2D Canvas 画在弹层之上。编辑器在任一弹层打开时给 `.paper-shell` 加 `under-sheet`，把画布平移出屏幕（不能用 `display:none`，否则 `initCanvas` 量到 0×0）；基础库 2.32.x 的开发者工具不跟随平移，弹层仍能正常盖住画布，只是遮罩不压暗画布。
- 素材库内置矢量素材暂无缩略图（53 个素材由 Canvas 指令绘制，没有 SVG 源），列表显示统一占位图标。
- 图标按钮点击区 72rpx（约 36px），小于 UX 规范建议的 44px，需要在真机可用性测试中确认。
- Figma 使用 Noto Sans SC 代替系统苹方（600 → Bold），字形与真机略有差异。
