# 设计系统与视觉规范

视觉方向：**工作台 · 便当格（方案 B）**。浅灰底 + 白色大圆角卡片，品牌红只给「新建标签」大卡、主按钮和选中态；扫码蓝、记录紫、已连接绿作为功能色。打印机卡片固定在首页最上面：连上是白卡，没连是深色卡加红色「连接」按钮。选中态（筛选胶囊、编辑器选项卡、样式按钮）统一变深色。设计说明见 [UI 视觉改版设计说明](./superpowers/specs/2026-09-28-ui-refresh-design.md)。

Figma：[商跃标签 · 设计系统与页面](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL)（变量、图标、组件）；35 张页面稿按流程分 6 行放在 [Screens 页](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL?node-id=3-11)。2026-11-01 选定方案 B 后，全部 47 张页面（首页各状态、引导、打印机连接、模板库、标签/批量/我的、编辑器及弹层、登录与协议）在 [方案 B · 全部页面](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL?node-id=71-2)，代码按它实现；下面这个旧 Screens 页是改版前的稿子。新增[登录](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL?node-id=38-4806)、[我的 · 未登录](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL?node-id=40-4831)、[我的 · 已登录](https://www.figma.com/design/xvL5iJJ0SViCmOi2LE9RuL?node-id=40-5006)，旧稿保留。

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
| `--color-bg` / `--color-surface` | `#F2F3F7` / `#FFFFFF` | 页面底、卡片与弹层 |
| `--color-fill` / `--color-fill-strong` | `#F2F3F7` / `#E6E8EE` | 输入框与图块、拖拽条、次按钮 |
| `--color-border` / `--color-divider` | `#E1E4EB` / `#E7E9EF` | 描边、分隔线 |
| `--color-text-1…4` | `#15171C` `#3F4552` `#5D6473` `#6B7079` | 标题 / 次要 / 辅助 / 占位（白底 5:1 以上） |
| `--color-success` / `--color-warning`（含 `-soft`） | `#16A34A` / `#C27803` | 已连接、成功；提醒 |
| `--color-info`（含 `-soft`、`-text`） | `#2F6BFF` / `#EAF0FF` / `#1E4FD0` | 扫码、连接中、图层选中、编辑器选择框；蓝底上的字用 `-text` |
| `--color-violet`（含 `-soft`）、`--color-ink` | `#6E56F8` / `#F0EDFF`、`#1C1F26` | 打印记录；深色卡片与编辑器快捷条 |
| `--color-danger` / `-soft` | 同主色 | 危险动作与主色统一 |
| `--color-mask` | `rgba(21,23,28,.5)` | 弹层遮罩 |
| `--font-display…tiny` | 40 / 34 / 30 / 28 / 24 / 20 rpx | 字号；字重只用 400 / 500 / 600 |
| `--space-1…6`、`--gutter` | 8 / 12 / 16 / 24 / 32 / 48 rpx，边距 32 rpx | 间距 |
| `--radius-xs…xl`、`--radius-full` | 8 / 20 / 28 / 40 / 52 / 999 rpx | 圆角（按钮 sm/md，卡片 lg，弹层 xl） |
| `--shadow-card` / `-float` / `-primary` | 卡片 / 弹层与浮条 / 红色浮起 | 阴影只有三级；主按钮用 `--color-gradient-primary` 渐变 |

规则：

- 页面样式只引用变量，不写新的品牌红；`tests/ui-tokens.test.js` 拦截旧红色和未定义变量。
- 原生组件颜色属性同样统一：`slider activeColor`、`switch color`、`wx.showModal confirmColor` 均为 `#E02D26`。
- 选中态必须同时改变形状或字重（描边、白底浮起、加粗），不能只靠颜色。
- 按钮高度 L 100 / M 88 / S 64 rpx，文字垂直居中；按钮是圆角矩形，只有筛选胶囊和芯片是全圆角。`button` 的默认按下、禁用和左右 auto 外边距已在 `app.wxss` 覆盖，按钮间距用 `gap`。

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
| Chip / Tab（选中变深色） | `.chip.active`、`.filter-tab`、`.panel-tabs button` |
| Search Field / Picker Field | `.search-box` / `.picker-field` |
| Segmented Control / Switch Row / Stepper / Field Tile | `.segment-row` / `.switch-row` / `.stepper` / `.field-grid label` |
| Template Card / Project Card / Recent Card | `.template-card` / `.project-card` / `.recent-card` |
| List Cell / Section Header / Empty State / Bento Tile | `.menu-section button` / `.section-heading` / `.friendly-empty` / `.tile`、`.bento-new` |
| Tab Bar / Home Bar / Page Header / Printer Card | `.bottom-nav`（悬浮四项）/ `.home-bar` / `.plain-header` / `.printer-card`（`on` `wait` `off`） |
| Editor Header / Floating Pills / Style Bar / Tool Tile / Action Bar | `.editor-header` / `.stage-pills`（撤销重做；打印机、图层、设置）/ `.style-bar`（加粗、字号加减、对齐、复制、删除）/ `.tool-button` / `.editor-actions` |
| Sheet Header / Save Status / Notice Card / Preset Tile / Onboarding Card | `.sheet-heading` / `.save-status`（顶部栏里）/ `.warning-card`、`.error-card`、`.print-ok` / `.preset-grid button` / `.onboarding-card` |

## 模板库交互规则

依据 ui-ux-pro-max 的交互规范（不把人带进空结果、筛选不藏选项、给搜不到的建议、按需加载、按下有反馈、数量变化用一句完整的话说明），代码在 `pages/home` 的 `templatesPatch` / `templateFilterPatch`，测试在 `tests/template-shelf-ux.test.js`。

- 一级是图标方块（全部 / 场景模板 / 我的 / 行业分类），换一级时子分类、场景和尺寸回到「全部」，搜索词保留。
- 子分类芯片带数量，结果为 0 的选项不出现（已选中的除外）；只剩「全部」时整行不显示。普通分类换行显示，场景和尺寸横向滑动，右边渐隐提示还能滑。
- 筛选下方一行结果：没有筛选时写「共 N 个模板」，有筛选时写「零售 · 只看 58mm · “价签” · 找到 N 个」，旁边「清除筛选」。场景模板默认按当前纸张筛选，这一行会写出尺寸，不再悄悄过滤。在全部里搜索时，子分类数量也算上一起搜出来的场景模板。
- 搜索框有清空按钮；在某个分类里搜索时，结果行多一个「搜全部」。搜不到时给 6 个常用词（价签、效期、40x30、二维码、姓名贴、库位），点一下就在全部模板里搜。
- 「只看 58mm 能打印的」是独立一行的开关，不和单选芯片混在一起。
- 滑到底自动加载下一页（`onReachBottom`），「加载更多」按钮保留；滑过筛选区后右下角出现「↑ 筛选」（`onPageScroll`，只在状态变化时 setData）。模拟器里 IntersectionObserver 不触发，所以没用它。
- 卡片只放名称、尺寸 · 分类和「适用 58mm」小胶囊（文字写明适用或需换纸，不只靠颜色），简介留在预览里；按下缩小到 0.97。打印机打不了这个尺寸时，预览的主按钮写「仍然使用」。

## 需要真机或后续确认

- 遮罩图标与渐变头部已在微信开发者工具（基础库 3.17.2、2.32.3）验证，Android / iOS 真机仍需按发布清单复核。
- 开发者工具会把 2D Canvas 画在弹层之上。编辑器在任一弹层打开时给 `.paper-shell` 加 `under-sheet`，把画布平移出屏幕（不能用 `display:none`，否则 `initCanvas` 量到 0×0）；基础库 2.32.x 的开发者工具不跟随平移，弹层仍能正常盖住画布，只是遮罩不压暗画布。
- 素材库内置矢量素材暂无缩略图（53 个素材由 Canvas 指令绘制，没有 SVG 源），列表显示统一占位图标。
- 编辑器返回按钮和悬浮胶囊的点击区都是 88rpx（44px）；检查面板里的小按钮仍是 72rpx，需要在真机可用性测试中确认。
- 方案 B 的页面标题在 Figma 里和胶囊同一行；代码里只有首页的问候栏这样放，其余页面的标题仍在胶囊下面（这样更稳，测试也固定了这个位置）。
- 「最近标签」卡片右下角的小打印机按钮（`.recent-print`）= 再打一张：打开那张已保存的标签并直接弹出打印窗口（份数 1，点「开始打印」才出纸）。入口是 `reprintProject`，编辑器靠 URL 参数 `print=1` 识别。
- 模板库一级分类是图标方块（`.cat-tile`，选中变红色实心）；行业分类的图标和底色在首页数据 `industryIcons` / `industryTones`，新分类没配时用灰色标签图标。
- 编辑器检查面板：「位置与尺寸」四个数字框排在最上面；矮屏手机（高度 ≤ 700px）用 CSS `order` 让内容字段仍在第一屏，位置、旋转与样式排在后面。
- Figma 使用 Noto Sans SC 代替系统苹方（600 → Bold），字形与真机略有差异。
