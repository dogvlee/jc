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
