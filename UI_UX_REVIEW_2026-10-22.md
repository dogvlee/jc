# UI / UX 走查（2026-10-22）

- 范围：首页 / 模板 / 标签 / 我的 / 批量数据 / 四个弹层、编辑器全部面板与弹层、登录、协议页、设备选择组件
- 方法：逐屏按「看得懂吗 / 点得中吗 / 长内容会不会坏 / 状态齐不齐 / 前后有反馈吗 / 键盘挡不挡 / 文案一致吗 / 无障碍 / 小屏大屏 / 能退出吗」十问走查，结论只用代码里能证实的证据；改完由 `node --test`（845 条）与 `check-project.mjs` 兜底
- 依据规范：[DESIGN_SYSTEM.md](./label-printer-miniapp/docs/DESIGN_SYSTEM.md) 的变量、组件 class 与已登记的已知问题

---

## 一、本轮已修（有测试）

| # | 问题 | 修法 | 位置 |
|---|---|---|---|
| 1 | 批量数据 1000 行把页面撑到 4 万 rpx，**批量打印按钮永远在表格末尾** | 表格改为定高滚动区（`max-height: 52vh` + `scroll-y`），批量卡始终在首屏 | `home/index.wxss`、`index.wxml` |
| 2 | 报错只说「第 437 行」，表格没有行号，用户数不出来 | 表格加 `#` 行号列、行上 `id="data-row-N"`；报错带行内容「第 3 行「香蕉」：…」并 `pageScrollTo` 跳过去 | `home/index.wxml`、`index.js`、`index.wxss` |
| 3 | 份数输入框可以停在「0」「500」，实际按 1/99 打印，打印中还能改 | 输入框改绑 `copiesInput`，越界时**看得见地**改回来并提示；打印中禁用 | `editor/index.js`、`index.wxml` |
| 4 | 「可能已经出纸」的失败后，同一颗红按钮一点就重复出纸 | 失败后 CTA 换成「我已核对，再打一次」，点了再二次确认；新任务开始时复位 | `editor/index.wxml`、`index.js` |
| 5 | 页头「已自动保存」和退出时「有未保存的修改」互相打架 | 文案改成「草稿已保存 · 未存为标签」/「已保存为标签」，退出菜单同步 | `editor/index.js` |
| 6 | 批量模式横幅说「每行打印 N 张」，批量 tab 却说「不能直接用当前标签」 | tab 按 `batchRowCount` 分状态：批量模式说明升级路径，按钮改「回到批量数据」 | `editor/index.wxml` |
| 7 | 空态「恢复全部」不会关掉「只看 X 能打印的」 | `resetTemplateFilters` 同时置 `familyFilterOn: false` 并刷新 | `home/index.js` |
| 8 | 选纸弹层自定义尺寸输入没有键盘间距 | 两个输入补 `cursor-spacing="32"` `confirm-type="done"` | `home/index.wxml` |
| 9 | 软红底上的品牌红只有 4.18:1、软绿底上的成功色 3.1:1 | 模板角标/扫码 CTA/失败记录改 `--color-primary-pressed`，成功记录改 `--color-success-text` | `home/index.wxss` |
| 10 | 首页「帮助」圆钮与「未连接」胶囊只有 32px 高 | 视觉不变，用透明外扩把热区做到 88rpx（44px）；打印拦截卡的恢复按钮 64→72rpx | `home/index.wxss`、`editor/index.wxss` |
| 11 | 打印面板「打印机 / 打印机纸宽」两行点了没反应感 | 补 `hover-class`（`pressed-row` / `pressed-fade`，新增在 `app.wxss`） | `editor/index.wxml`、`app.wxss` |
| 12 | 「反白」是印厂行话 | 改「黑底白字」 | `editor/index.wxml` |
| 13 | 批量数据页底部导航五个 tab 全灰 | `route == 'data'` 时「我的」保持高亮 | `home/index.wxml` |
| 14 | 删除标签成功没有任何提示（删模板有） | 补「标签已删除」toast | `home/index.js` |
| 15 | 登录状态确认中仍显示「登录」按钮 | `authStatus == 'restoring'` 时隐藏 | `home/index.wxml` |
| 16 | 设备选择已连接时副标题仍写「没有找到蓝牙设备」 | 副标题按 `linkStatus` 分状态 | `printer-picker/index.wxml` |

测试：`tests/style-review-fixes.test.js`（对比度/热区）、`tests/home-page.test.js`（表格可滚、行号、导航高亮）、`tests/editor-page.test.js`（份数显示）、`tests/editor-print-flow.test.js`（重打确认）。

---

## 二、没修，按优先级排好（每条都给了改法）

### P1

1. **竖长标签看不全也拖不动**（`editor/index.wxml:51` 的 `catchtouchmove` 吃掉滚动；40×60 标签在 375×667 上只能看到约 59%）。改法：手指按在空白处（`hitDecision.element` 为空）时进入平移模式，把位移写回 `.canvas-stage` 的 `scroll-top`；或按舞台高度等比缩小 `paper-shell` 宽度并 `initCanvas()`。需要真机验手势，建议单独一轮。
2. **键盘整块盖住底部面板**（页面 `disableScroll: true` + `100vh; overflow:hidden`，键盘 260–300px 弹起时无法避让）。改法：`wx.onKeyboardHeightChange` 存 `keyboardHeight`，`.editor-panel` 用 `transform: translateY(-{{keyboardHeight}}px)` 上移，打印弹层的份数行同样处理；需要 iOS 真机确认。
3. **存储读取失败页是死胡同**（只有「重新读取」，帮助/反馈/备份全被 `wx:else` 藏掉）。改法：错误分支里补「意见反馈」「使用帮助」「导出备份」三个次级操作。

### P2

4. **标签卡右上角垃圾桶压在缩略图上**，想打开常先弹删除确认。改法：卡片长按出 `showActionSheet`（打开/删除），或删除只留在编辑页。
5. **打印历史失败原因被省略号截断**（`.menu-note` nowrap + ellipsis）。改法：错误行允许两行（`-webkit-line-clamp: 2`）+ 整行点击看详情。
6. **1000 行表格没有窗口化**：一次渲染 5000 个 input、整表 95KB 下发。改法：固定高度 `scroll-view` + 只渲染可视区 ±20 行；或先把上限降到 200 并在导入时提示。
7. **「添加行」在长表格里像没反应**。改法：`wx.pageScrollTo({ selector: '#data-row-N' })` + 聚焦新行 + toast「已添加第 N 行」。
8. **模板 tab 是一个 70+ 项的原生 picker**（无缩略图、无搜索、不显示当前模板、重选同一个没反应）。改法：面板内可滚缩略图列表，或至少绑定 `value` 并在标题显示当前模板名 + 「重新套用」。
9. **属性面板 3 屏多、滚动条被隐藏、位置尺寸沉底**。改法：恢复滚动条/加渐隐提示；把「位置与尺寸」提到内容之后。
10. **素材弹层 129 个条目平铺**，缩略图全是同一个占位图标。改法：用现成的 `MATERIAL_CHIPS`（15 个分类）加一行分类 chip，`materialOption` 补回 `tags`。

### P3

11. 首页/编辑器的 `.chip`（30px）、`.btn-s`（32px）、`.segment-row button`（30px）仍低于 44px；建议用同样的透明热区写法，或把 chip 提到 80rpx 并把行间距压到 8rpx。
12. 禁用态主按钮整块 `opacity: .4`，红底白字几乎看不清；建议改灰底 + 「先填一行数据」提示。
13. 弹层打开时安卓返回键不会先关弹层（`position: fixed` 覆盖层）；建议关键弹层换 `page-container`。
14. 表格面板一次渲染 240 个 input、没有行列标题；第 129 个元素会被保存时静默丢弃（建议在 `commit` 前拦）。
15. 文案收口：`批量制标/批量数据/批量打印` 三个叫法、模板页「我的」标题仍写「商跃模板」、`X/Y` 没解释、日期三连前两项是示例第三项是名称。
16. 设置里的纸张类型四个术语（间隙纸/黑标纸/连续纸/定孔纸）没有一句解释；决定走纸与定位，建议补一行说明。
17. 无障碍：`role=` 与 `aria-role=` 混用、滑杆没有 `aria-label`；表格/份数/标签名输入缺可访问名称。
18. 首页渐变用了未登记的 `#FFE4E0 / #FFF2F0`，正文出现 36/32/38rpx 等不在 `--font-*` 阶梯里的字号。

---

## 三、走了但没问题的屏

首屏信息层级、最近标签空态三入口、纸张卡与「装不下」提示、推荐模板角标、扫码条的错误分流、模板页三级筛选与「显示更多」、标签页空态、我的页两套登录态与隐私说明、新建路径兜底、模板预览弹层、选纸弹层预设、打印历史三态、使用帮助、首启引导、打开失败页、编辑器页头结构（避开胶囊）、选中态指引与手柄 44px 命中、图层弹层、设置弹层分组、打印弹层的「阻断卡在信息行之上」、批量横幅、离开编辑器的三段式确认、保存/打印主次关系、字体回退说明。

---

# 第二轮（同日，覆盖第一节之外的三条 P1 与一批 P3）

## 已修

| # | 问题 | 修法 |
|---|---|---|
| 1 | **键盘整块盖住底部属性面板**（页面 `disableScroll` + `100vh`，iOS 必现） | `wx.onKeyboardHeightChange` 存 `keyboardHeight`，`.editor-page` 用 `padding-bottom` 让出键盘高度，面板整体上移；高度钳到 420px，卸载时注销监听（`editor/index.js` `bindKeyboard/unbindKeyboard`、`index.wxml`、`index.wxss`） |
| 2 | **存储读取失败页是死胡同**（只有「重新读取」） | 补「先导出一份备份」「打不开怎么办」「意见反馈」，文案补一句先备份；`showRecoveryHelp` 说明处理步骤（`home/index.wxml`、`index.js`） |
| 3 | 空标签的打印面板一个按钮都没有 | `kind: 'empty'` 时给「去添加元素」，点击关弹层并切到元素面板（`editor/index.js`、`index.wxml`） |
| 4 | 「添加行」在长表格里像没反应 | 加完行 toast「已添加第 N 行」并 `pageScrollTo` 到该行（`home/index.js`） |
| 5 | 选纸格子里尺寸写了两遍（「40×12」+「40×12 线缆/小标」） | 格子只显示用途名，尺寸仍由上方大字承担（`home/index.js` 派生 `stockPresets`） |
| 6 | 模板页「我的」标题仍写「商跃模板」 | 补 `templateIndustry == '我的' ? '我的模板'` |
| 7 | 设置里四种纸张类型没有任何解释 | 加一行说明：间隙纸 / 黑标纸 / 连续纸 / 定孔纸各是什么 |
| 8 | 打印中「打印机 / 打印机纸宽」两行看着能点却没反应 | 打印中加 `.disabled` 降透明度，`hover-class` 关闭（点击仍被忽略） |

测试：新增「键盘上移」「存储失败页不是死胡同」「添加行有反馈」「空标签有出口」四条；全套 **849 pass**。

## 仍待处理（与第一节一致，只减不增）

- **竖长标签看不全也拖不动**（唯一剩下的 P1）：要做画布平移或整张适配，需要动 `scroll-view` 与手势，必须真机验证，建议单独一轮。
- 第一节 P2 第 4–10 条（标签卡垃圾桶、历史原因截断、1000 行窗口化、模板 picker、属性面板长度、素材分类）与 P3 第 11–18 条保持原状。

## 验证记录

- `node --test tests/*.test.js` → 849 pass / 0 fail
- `node scripts/check-project.mjs` → PASS（主包 90.6%，剩 196 KB：下一批模板/字体必须先分包）

---

# 第三轮：竖长标签整张可见

**P1-1 修完**。原因：`.canvas-stage` 是唯一能滚的区域，但画布上的 `catchtouchmove` 把拖动全吃掉了，空白处又不进入拖动，所以比舞台高的标签下半张既看不见也碰不到。

做法（`editor/index.js`、`index.wxml`、`index.wxss`）：

- 新增 `previewFrameWidth()` / `stageAvailableHeight()` / `previewFitScale()` 三个纯函数，把「舞台还剩多高」从布局里算出来（常量集中在 `PREVIEW_CHROME`，和 `editor/index.wxss` 里 header 152rpx、stage 上下 152rpx、面板 440–640rpx 且不超过 48vh 一一对应，CSS 改了最多让预览略大略小，不会算错）；
- 标签比舞台高时，**宽高等比缩到整张可见**，`previewWidthPx` 一起下发，`paper-shell` 用内联宽高，画布随之量到新尺寸（mm↔px 一直是实测值，缩放后点选仍然准）；
- 舞台左上角出现「整张显示 N%」，让用户知道为什么字变小了；
- 键盘弹起时可用高度随之减少，预览也跟着缩（下一轮同步时生效）。

新增 3 条测试：高标签被缩且保持比例、放得下的标签仍是 100%、键盘占位会压缩可用高度。全套 **852 pass**。

需要注意：小时标签缩小后**点击仍然准确但字会很小**，这是"整张可见"的必然代价；真机上如果觉得难读，下一步应做「双指缩放 + 空白处平移」，而不是回退到裁切。

---

# 第四轮：按「误触/信息可见性 → 性能 → 结构」推进

## 第一段：误触与信息可见性（已完成）

| # | 问题 | 修法 |
|---|---|---|
| 1 | 标签卡右上角的垃圾桶压在缩略图上，想打开常先弹删除确认 | 删除按钮移出缩略图，放进卡片底部的文字行右侧（64rpx 圆形，悬停变红）；缩略图和标题行都保留「打开」；旧 `.delete-card` 绝对定位样式整段删除 |
| 2 | 打印历史失败原因被省略号截断，真正想知道的原因看不到 | 时间单独一行，原因单独两行（`-webkit-line-clamp: 2`，失败态用 `--color-warning-text`）；整行可点，弹出完整原因 + 状态 + 时间；「打开」按钮改 `catchtap`，不会连带弹详情 |
| 3 | 筛选 chip 只有 30px 高，三行连续排列容易点错行 | `.chip` 提到 72rpx（36px），保留 12rpx 间距（再高会让相邻行热区重叠） |
| 4 | 删除元素没有任何反馈，多选时也直接删 | 单删后 toast「已删除「文本」，可点左上角撤销」；多选先弹确认，确认后再删 |
| 5 | 死代码 | 删掉不再使用的 `.delete-card` 规则 |

测试新增 3 条（卡片结构、历史两行与详情、删除反馈），全套 **855 pass**。

## 第二段：性能（评估后未动手，附计划）

唯一的大头还是**批量表格一次渲染 1000 行 × 5 个 input**（约 5000 个节点、首帧 95KB 数据）。仓库里已有两处优化：只有数据页打开时才下发；编辑时只 patch 变化的单元格（`tableViewPatch` 的 diff）。

真正的修法是**窗口化渲染**，但它是这一个改动里风险最高的一处（要动 `dataRows` 的语义或引入 `dataWindowRows` + 上下占位 + 滚动重算，还会连带影响「报错滚到第 N 行」「添加行滚动」「行号」三处刚做的逻辑）。我在当前没有真机、且已连续改了三轮的前提下不做半成品。落地方案（可直接照做）：

1. 常量：`ROW_HEIGHT_RPX = 80`、`WINDOW_ROWS = 60`、`OVERSCAN = 8`；
2. 页面数据保留 `dataRows`（逻辑与测试都依赖它），新增 `dataWindowRows = [{ index, row }]` 与上下占位 `dataWindowTopPx / dataWindowBottomPx`；
3. `tableViewPatch` 里：结构性变化（导入/增删行）重建窗口并重置 `dataWindowStart`；只有单元格变化时，除 `dataRows[i].field` 外再补一条 `dataWindowRows[offset].row.field`（可视区内才发），payload 仍是一两个键；
4. `bindscroll` 里按 `scrollTop / rowHeight` 算首行，偏移超过半个窗口才 `setData` 新窗口；
5. 「滚到第 N 行」先把窗口起点设到 N 附近，等一个 tick 再 `pageScrollTo`。

## 第三段：结构（未动手，附计划）

按价值排序：

1. **编辑器模板 picker**：现在是 74 项的原生 picker（无缩略图、无搜索、重选同一项无反应）。改成面板内 3 列缩略图列表 + 搜索，是这一屏最大的结构问题。
2. **素材弹层 129 项平铺**：`core/materials.js` 已经有 15 个分类常量（`MATERIAL_CHIPS`），`materialOption` 丢掉了 `category/tags`；补分类 chip 即可，不需要新资源。
3. **死代码清理**：home/editor 的 remote 模板/素材空壳、`renderer.contentHandleLocalMm`、`ensureImagesReady`。注意前两项**测试会注入并断言这些分支**，删除等于改行为，必须连同测试一起重写。
4. **属性面板**：文字元素的 inspector 约 3.4 屏，滚动条被隐藏，「位置与尺寸」沉底；建议把该段移到内容段之后，或做成可折叠分组。

我按这个顺序继续也可以，但 1 和 3 各自都值得单独一轮 + 真机回归。

---

# 第五轮：批量表格窗口化（性能）

按上一轮写下的五步方案落地，未改数据语义（`dataRows` 仍是完整列表，逻辑与测试都照旧），只改渲染层。

- 常量：`ROW_HEIGHT_RPX = 80`、`DATA_WINDOW_ROWS = 60`、`DATA_WINDOW_OVERSCAN = 8`；
- 新增 `dataWindowAt(rows, start)`：算出 `dataWindowRows = [{ index, row }]` 与上下占位 `dataWindowTopPx / dataWindowBottomPx`（行高按 `windowWidth / 750 × 80` 换算，375 宽屏是 40px）；
- WXML 只渲染窗口，行号、`data-index`、`id="data-row-N"` 全部用 `item.index`，上下各一个撑高的 `data-row-spacer`；
- `onDataTableScroll`：按 `scrollTop / 行高` 算首行，偏移超过半个窗口才换片；
- `tableViewPatch`：结构性变化（导入/增删行）重建窗口；只有单元格变化时，除 `dataRows[i].field` 外再补一条 `dataWindowRows[offset].row.field`，payload 仍是几个键；
- 跳转改为表内滚动：原来的 `pageScrollTo` 对嵌套 `scroll-view` 无效（上一轮把表格限高后就已失效），现在 `revealDataRow(index)` 先把窗口移到目标附近，再用 `scroll-into-view` 滚过去；
- 进入批量数据页时窗口回到顶部（否则滚动条在顶部、渲染却从第 500 行开始）。

效果：1000 行时节点数从约 5000 个 input 降到 300 个左右；首屏只传一页窗口；编辑仍然只发一个单元格。

测试新增 5 条：千行只渲染 60 行与占位高度、滚动换片且小幅晃动不重发、编辑同时更新行与窗口副本、删行后窗口与占位正确、返回页面窗口归零。全套 **860 pass**。

注意：`dataRows` 仍在页面数据里（首次进入批量数据页仍会下发一次完整列表）。若以后要连这一次也省掉，把逻辑改为只依赖 `tableRows` 即可，但那会牵动现有测试对 `page.data.dataRows` 的断言，属于下一层重构。

---

# 第六轮：结构重构 —— 编辑器模板选择

原来的「模板」tab 是一个原生 `picker`：74 个条目（同尺寸内置 22 + 场景模板 50+ + 我的）挤在滚轮里，只有「名称（50×30）」一串纯文字，没有缩略图、没有搜索、不显示当前模板，而且**重选同一个模板完全没反应**（原生 picker 只在值变化时触发）。

改成面板内的可搜索列表（`editor/index.wxml`、`index.js`、`index.wxss`）：

- 顶部搜索框，按名称、尺寸、场景、来源过滤；搜索走首页同一套 `normalizeSearchText`，所以「50x30」「50*30」「50 30」都能命中 50×30；
- 每张卡片：缩略图（内置模板用目录里的 `thumbSrc`；没有图的按码型显示二维码 / 条码 / 版面图标）、名称、纸张尺寸、来源（商跃原创 / 场景模板 / 我的）；
- 卡片自带 `data-index`，点击仍走原来的 `loadTemplate` → 「套用「X」？」确认 → `applyTemplate`，撤销、批量兼容、失败兜底全部不变；
- 空搜索结果给「没有找到模板 / 换个关键词」；
- 列表在面板内独立滚动，底部的「将当前标签保存为模板」常驻；
- `templateCards` 在 `loadTemplates()` 里随当前纸张一起重建，切到模板 tab 时会重新读取「我的模板」。

新增 2 条测试：卡片字段与搜索（含尺寸归一化、清空恢复）、卡片点击走同一套确认流程。全套 **862 pass**。

顺带说明：`templateNames` 仍在下发，但界面已不再使用，目前只被既有测试断言；等下一轮清理时连同测试一起删。

---

# 第七轮：素材分类 + 死代码清理

## 素材分类

素材弹层原来是 129 个条目平铺、缩略图全是同一个占位图标，core/materials.js 里现成的 15 个分类（最新/警示/物流…）完全没用。

- materialOption 补回 category 与 tags；
- 弹层标题下加一行分类 chip（「全部」+ 目录自带的 15 类），点一下按 category / 标签过滤，列表在弹层内独立滚动；
- 分类为空时给「这一类还没有素材，换个分类看看」；
- 切换分类只重建过滤后的列表，不改素材本身。

新增 1 条测试：chip 列表、「全部」等于全量、按「警示」「物流」过滤、清空恢复、markup 绑定。

## 死代码清理

| 位置 | 删除内容 | 依据 |
|---|---|---|
| core/renderer.js | contentHandleLocalMm | 与 geometry.selectionBox 重复的第二套手柄数学，无人调用 |
| core/geometry.js | selectionHandleMode（毫米版命中测试） | 只有测试在调；实际走 selectionHandleModeAtPoint（CSS 像素版） |
| pages/editor/index.js | ensureImagesReady | 打印路径用的是 preparePrintImages |
| pages/editor/index.js | remoteMaterial* / remoteBorder* 12 个 data 键、4 个空实现、pickMaterial 与 pickBorder 的远程分支、materialAssetLoadingId / borderAssetLoadingId | 没有任何代码填充远程目录；内置素材是矢量绘制，边框是程序化生成 |
| pages/home/index.js | remoteTemplate* 9 个 data 键、3 个空实现、resolveTemplate 远程分支、remoteAssetLoading | 同上；公开货架只有商跃原创和我的模板 |
| pages/home/index.js | usePreviewTemplate 的远程分支 | 改成「有 https 图片才落地本地」，行为不变但不再依赖一个不存在的来源 |
| pages/editor/index.wxml | 素材 / 边框格子的 loading、disabled 绑定 | 不再有下载态 |

同步删除 4 条只测已删代码的用例，并更新 MODULE_REFERENCE.md（手柄 / 渲染器导出）与 TECHNICAL_ARCHITECTURE.md（打印前图片门禁的函数名）。

全套 **859 pass**，check-project.mjs PASS。

## 这一轮之后

走查报告里的结构清单只剩**属性面板 3.4 屏、位置尺寸沉底**一项没动；其余（模板 picker、素材分类、死代码、表格窗口化、误触与可见性、键盘与画布）都已落地。
