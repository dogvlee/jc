# 代码审查报告 · label-printer-miniapp 当前工作树

- 审查对象：`D:\\vibecode\\jc` 未提交改动（HEAD = `499765c`），153 项变更 / +8256 −3317 行，含 41 个新增文件
- 审查方式：三路并行深读（首页+货架、编辑器+手势/几何、登录服务+协议页）+ 主线复核（BLE/ESC-POS 打印链路、仓储、服务端）
- 客观证据：`node --test tests/*.test.js` 803/803 通过；覆盖率 91.75% 行 / 78.79% 分支；`node scripts/check-project.mjs` PASS
- 结论：**没有发现 P0**。打印链路、连接状态机、服务端令牌设计质量都高于平均水平；剩下的问题集中在"部署后才会暴露"的服务端限流、纸宽推测、以及存储/会话的长期泄漏

---

## P1（发版前必须处理或必须真机确认）

### P1-1 反向代理后限流桶退化为单一 IP，全站共用「10 次登录/分钟」
- 位置：`server/app.js:18`（loginLimit 10 / sessionLimit 120 / globalLimit 300 per 60s）、`server/app.js:176`（`limiter.allow(req.socket.remoteAddress …)`）、`server/deploy/nginx.conf.example:26-27`（清空 X-Forwarded-For / X-Real-IP）、`server/compose.yaml:20`
- 问题：限流键取 TCP 对端地址。按仓库自带拓扑（Nginx → 127.0.0.1:8787），所有用户的对端地址都是 127.0.0.1，全部落进同一个桶。
- 影响：第 11 个用户在本分钟内登录即 429；每分钟超过 120 次 `GET /api/auth/session`（每次冷启动一次）后全站恢复登录失败；单个未认证 IP 只要按 Nginx 允许的 10r/m 持续打登录接口，就能长期占满桶，让所有真实用户无法登录（全站登录 DoS）。
- 建议：显式可信代理开关，Nginx 用 `proxy_set_header X-Real-IP $remote_addr` 覆盖；或把限流交给边缘并按「IP + 令牌」双维度计数；429 的 Retry-After 与真实窗口对齐；补一条「两个不同来源应各自计数」的测试。

### P1-2 纸宽只按蓝牙名末尾 58/80 推测；名字不含宽度时静默按 58mm 出点阵
- 位置：`core/profiles.js:59-62`（`profileForPrinterName` 缺省 escpos-58）、`pages/editor/index.js:2676-2697`（`applyConnectionResult`，无确认）、`core/escpos.js:45-51`（`rasterize` 按 `printheadPixels` 居中补齐）
- 事实：HEAD 里 `evaluatePrintBlock` 开头有 `if (!this.profileConfirmed) return { kind: 'model' }` 硬拦截，本次改动整段删除（`git show HEAD:…/editor/index.js` 可见 profileConfirmed 共 6 处）；现行测试 `tests/editor-print-flow.test.js` 把"静默按 58mm"固定成预期。
- 判断：删除门禁本身是 ADR-013/015 的产品决定（"连上就能打"），这条风险 ADR 也已披露；**真正的问题是"名字没说纸宽时没有任何提示"**。80mm 机型（如老板实测的 EY-260）名字不含 58/80 时，整张标签按 384 dots 生成，而打印头是 576 dots：若固件左对齐，内容相对纸面偏移约 (576−384)/2 = 96 dots ≈ 12mm，右侧内容丢失或落到离型纸上。
- 建议：名字不含宽度时，首次打印前弹一次"58 还是 80mm 纸宽？"，结果用现成的 `confirmProfile/getConfirmedProfileId` 落库；真机清单里把"名字无宽度后缀的 80mm 机型"列为必测项。

---

## P2（应尽快修）

### P2-1 弱网/限流下有效登录被静默降级为 guest
- 位置：`services/auth-service.js:260-271`（只有 401 才 `forget()`）、`:307-311`（任何失败都 emit guest）、`pages/home/index.js:578-584`（只消费 status/user，丢弃 state.error）
- 影响：冷启动 restore 遇到 429/超时/503 → 界面显示未登录、无提示、不重试；本地令牌仍在，用户重登又生成新令牌，旧令牌在服务端继续有效 30 天（孤儿会话堆积）。
- 建议：区分确定性失败（401/账号变更）与暂时性失败（超时/429/5xx），后者保留登录态并退避重试一次；把 error 暴露到"我的"。

### P2-2 用户图片文件永久累积（USER_DATA_PATH 只增不减）
- 位置：`pages/editor/index.js:270-282`（`keepImageFile` 每次 copyFile 到 `label-image-<ts>`）、`services/data-url-images.js:48`；删除元素/替换图片/放弃草稿均不 unlink
- 影响：每次换图留下 0.2–1MB 孤儿文件，微信本地文件配额（约 200MB）耗尽后导入直接失败，且不可逆。注：远程模板缓存 `services/remote-image-cache.js:96-137` 已有 LRU 清理，用户图片这条路径没有。
- 建议：以"文档中仍被引用的 path"为白名单，在保存成功与 onUnload 时清理；或按内容哈希命名以复用。

### P2-3 相册导入没有 pageActive/取消保护，页面销毁后仍写全局 autosave
- 位置：`pages/editor/index.js:1576-1617`（chooseMedia → importLabelImage → commit，全程无 pageActive 检查）、`:713-739`（onUnload）、`services/repository.js:709-717`（唯一键 editorAutosave）
- 影响：处理图片（含 8s 解码超时）期间退出、另开一张标签编辑，旧实例完成后会用旧文档覆写新会话刚写的草稿。
- 建议：回调先判 pageActive/discardedSession；onUnload 给导入加 epoch；persistDocument 增加会话校验。

### P2-4 换纸后首页「商跃模板」推荐不刷新，纸张信息自相矛盾
- 位置：`pages/home/index.js:1333-1343`（saveSettingsPatch 只 setData settings+stockPatch）、`:725-755`（推荐只在 familyViewsPatch 里按 `family|paper` 重算）、`:1362-1366`（chooseStockPreset）
- 影响：选 70×50 后标题变「70×50 mm 标签纸」，但副标题/6 张推荐卡仍是 50×30，直到 onShow 才恢复。用户按推荐建标 = 尺寸不符，直接浪费标签纸。
- 建议：saveSettingsPatch 检测到 stock 字段变化时合并 familyViewsPatch 的结果。

### P2-5 模板货架「显示更多」/重复进页全量重发卡片
- 位置：`pages/home/index.js:966-982`（仅"场景模板"tab 做了稀疏追加，其余分支走 803-860 全量重建）、`:869-872`（navigate 进 templates 无条件 refresh）
- 影响：实测全部 tab 搜「40」（172 张）时，逐次显示更多的 setData 为 54.7KB → 98.6KB → 142.4KB → 283.7KB；294 张时约 500KB。低端安卓卡顿/滚动跳动。
- 建议：把稀疏追加抽成公共方法；进页时只在签名变化时 refresh。

### P2-6 主包已用 89.3% 配额且没有分包
- 位置：`scripts/check-project.mjs` 输出：`Main package: 109 files, 1873106 bytes (1.79 MiB, 89.3% of 2 MiB)`；`app.json` 无 `subPackages`
- 影响：只剩约 174KB 余量，再加模板/缩略图/字体就传不上去；本次新增的 `app/online-templates-pack.js` 单个已 374KB。
- 建议：把 curated 模板/缩略图/字体挪分包或 CDN；把包体上限检查写进 CI（现有 check 脚本已经在算，只差一个阈值断言）。

### P2-7 协议版本号服务端/客户端配置/协议页三处各写一份，无一致性测试
- 位置：`server/app.js:7`、`miniprogram/config/auth.js:6`、`miniprogram/pages/legal/index.js:1`
- 影响：只改协议正文不改 config → 库里记录的同意版本与用户实际阅读的不一致（合规证据失真）；只改 config 不改服务端 → 用户勾选后固定失败在 AUTH_CONSENT_REQUIRED，无论怎么重试都登不上。
- 建议：单一来源 + 一条断言相等的测试。

### P2-8 导出分享用 wx.shareFileMessage 发 .csv/.json（需真机确认）
- 位置：`services/file-share.js:7,18,65`、`pages/home/index.js:1717-1740`
- 问题：该 API 对各平台支持的文件后缀有限制（本机无法访问微信文档，未能证实 csv/json 是否在白名单内）。若不支持，失败文案 `当前微信版本不能发送文件，请升级微信后再试` 会把"类型不支持"说成"版本太低"，用户升级也没用。
- 建议：真机导入导出各跑一次；若受限改为 .xlsx/.txt 或 `openDocument`，并把文案按 errMsg 分流。

---

## P3（择机）

1. 预检比实际栅格检查更严格：`core/print-area.js:156-172` 按元素外接框判边条，而 `:223-236` 的像素级 `marginInkReport` 只在渲染后才会跑；文本框外接框进边条但不出墨时会被误拦，提示语还让用户"往中间移"。
2. `pages/editor/index.js:2842-2847` 只要名字给出不同纸宽就无条件 `canResize: true`，对 MARGIN_INK 也生效——改尺寸解决不了"靠边打不到"。
3. 文本实时预览绕开 undo：`pages/editor/index.js:1682-1734`，draft 被 onHide/打印前清空后继续输入的字符既不进模型也不可撤销。
4. `commit` 用 JSON 串比较前后，但先跑了非幂等的 `clampElement`（`core/document.js:343-368`，浮点往返漂 1e-15），会偶发"什么都没变也多一条撤销"。
5. 保存时静默截断：序列号前缀/后缀 input 无 maxlength（`index.wxml:165-166`），仓储侧截到 128/256（`repository.js:278-283`）——"打印对、重开变短"。
6. 套模板无失败兜底：`pages/editor/index.js:2568-2591`，normalizeDocument 失败会静默变成 50×30 空白标签；批量模式套模板不清 batch，会按旧数据行各打一张。
7. 示例行判定漏了 date：`pages/home/index.js:250-253` 只比 name/code/price，用户只改日期时仍算"样例"，CSV 导入会不询问直接覆盖。
8. `runBatch` 的 350ms 定时器未登记、onUnload 不清（`pages/home/index.js:1589-1604`、`:545-553`）。
9. 批量字段 `['name','code','price','date']` 在 4 个文件各写一份（`home/index.js:46`、`services/csv.js:72`、`app/data-bind.js:9`、`services/repository.js:32`），且顺序被隐式依赖。
10. 服务端小问题：`server/store.js:37-40` 每次登录覆盖 `consent_accepted_at`（只剩最近一次）；`users` 表无删除路径（协议页却承诺"可通过反馈与投诉提出处理请求"）；`server/wechat.js:66` 当 `expires_in=60` 时缓存 TTL 为 0，等于每次都刷新 stable_token。
11. 两处死代码：remote 模板/素材整条链路（`home/index.js:430-438,883-893`、`editor/index.js:539-552,2117-2131`）与重复的手柄数学（`renderer.js:1325-1342` 与 `geometry.selectionBox`）。
12. `services/csv.js:5,176` 的 BOM 写成不可见字面量 U+FEFF，建议改 `\uFEFF`。

---

## 做得好的地方

- **ESC/POS 分条发送**：`core/escpos.js:70-90` 的 `rasterBands` 在 MTU 23 / 179 / 244 三档下实测都满足"≤8 包、≤1400 字节"不变量；取消只在条与条之间生效，不会留半条光栅。
- **连接状态机**：`services/printer-connection-manager.js` 的代际（connectionEpoch）+ 单飞（inflight）+ 后台重连降级逻辑自洽；`BleSession` 的 connect attempt 可被 disconnect 取消，不会让关机的打印机占满 12s 超时。
- **服务端令牌**：32 字节随机 + 只存 SHA-256、严格 Bearer 正则、会话按 app_id 绑定、容器 non-root/read-only/cap_drop、密钥不进仓库；协议页五条陈述与实现逐条对得上。
- **仓储规范化**：备份恢复逐条清洗（坏行只丢自己）、批量 1000 行/256 字符口径在 CSV/备份/批量三处一致、损坏列表可"丢弃并重试"。
- **工程化**：803 条测试全绿、覆盖率 91.75%、`check-project.mjs` 校验 JS 语法/JSON/文档链接/267 个 WXML 绑定/静态资源引用。

---

## 建议的推进顺序

1. 先定 P1-1（限流键）与 P1-2（纸宽确认）——两者都是"上线后才炸/真机才炸"的类型。
2. 再修 P2-2、P2-3、P2-4：前两个是数据/存储安全，第三个是直接的废纸入口。
3. 发布前把 P2-6（包体 89.3%）与 P2-8（分享文件类型）各跑一次真机/上传验证。
4. P3 建议随下次改动顺带清理，尤其第 4、5 条（假撤销步、静默截断）成本低但用户可感知。

---

# 修复记录（2026-10-21 下午，同一工作树）

已按上面的顺序修掉 9 项，全套测试 `828 pass / 0 fail`（原 803），`check-project.mjs` PASS。

| 编号 | 项 | 改动 | 新增/改动的测试 |
|---|---|---|---|
| P1-1 | 反代后限流退化为全站单桶 | `server/app.js` 新增 `clientAddress()`：仅当 `trustProxy` 时读代理覆盖的 `X-Real-IP`，且只接受 IP 字面量；`server/index.js` 读 `TRUST_PROXY` / `AUTH_RATE_LIMIT_*`；compose 默认 `TRUST_PROXY=1`，Nginx 示例改为 `proxy_set_header X-Real-IP $remote_addr`；README/.env.example 同步 | `auth-server.test.js`：代理开启时两个来源各自分桶、关闭时头部被忽略、非 IP 头部回退到 TCP 地址 |
| P1-2 | 纸宽只按名字猜、无确认 | `editor/index.js` 新增 `paperWidthBlock()`：连接时静默（ADR-013 不变），**打印前**若名字没写 58/80 且用户没选过型号，就阻断并给出两个按钮；选择后 "记住这台打印机" 用的是现成的 `confirmProfile` | `editor-print-flow.test.js`：静默连接不弹窗、首次打印被拦、选 80 后按 80 打印并落库、名字带宽度不拦 |
| P2-1 | 弱网下有效登录被静默降级为 guest | `auth-service.js`：恢复会话遇到超时/5xx/429 先保留状态并重试一次（`retryDelayMs` 可配），重试仍失败才降级；令牌不清除；并发调用共享同一 flight；401 仍立即清除且不重试 | `auth-service.test.js`：重试成功、重试失败保留令牌、401 不重试 |
| P2-2 | 用户图片文件只增不减 | 新增 `services/image-files.js`（`sweepOrphanImages`），编辑页关闭时以 "所有已存标签/模板/草稿/打印记录引用" 为白名单清理 `label-image-*`，跳过 60 秒内的新文件和无法删除的文件 | 新增 `tests/image-files.test.js`（9 条） |
| P2-3 | 相册导入无 pageActive 保护 | `chooseImage` 解码完成、失败、取消三条路径都判断 `imageImportApplies()`；页面已关闭时不再 commit/写全局草稿；空选择给提示 | 新增 `tests/editor-image-import.test.js`（5 条） |
| P2-4 | 换纸后首页推荐不刷新 | `home/index.js saveSettingsPatch`：补丁含 `stockWidthMm/HeightMm` 时在同一 `setData` 里合并 `familyViewsPatch` | `home-page.test.js`：换 70×50 后副标题与 6 张推荐卡同时更新 |
| P2-6 | 主包 89.9% 且无分包 | `check-project.mjs` 预警阈值 90%→85%，并在告警里列出最大三个文件和剩余字节 | 由 `check` 自身覆盖 |
| P2-7 | 协议版本号三处各写一份 | 三处加交叉引用注释；新增断言三者相等的测试 | `auth-integration.test.js` |
| P2-8 | 分享失败文案误导 | `file-share.js`："类型不支持" 时点明扩展名并给出替代路径，只有 "not available" 才建议升级微信 | `file-share.test.js` |
| P3 | 假撤销步 / 静默截断 | `clampElement` 对已放得下的元素不再做 1e-15 级回写（`CLAMP_EPSILON`）；序列号前后缀与表格单元格补 `maxlength`（128/256，与仓储一致） | `document.test.js` 新增 2 条 |

仍未处理（按原报告顺序）：P2-5 模板货架全量 `setData`；P3 中的预检过严、`canResize`、实时预览撤销、套模板兜底、示例行 date、`runBatch` 定时器、批量字段重复定义、服务端同意时间/账号删除/token TTL、死代码、BOM 字面量。

需要真机/上传验证的两项不变：80mm 机型在 384 dots 光栅下的实际对齐方式（决定 P1-2 的位移量），以及 `wx.shareFileMessage` 对 `.csv/.json` 的支持。

---

# 修复记录（第二轮，同一工作树）

全套测试 `841 pass / 0 fail`（第一轮后 828），`check-project.mjs` PASS，`prepare-wechat-release.mjs` 门禁通过。

| 编号 | 项 | 改动 | 测试 |
|---|---|---|---|
| P2-5 | 模板货架全量重发 | `home/index.js` 新增 `appendTemplateCards()`：按卡片 id 求公共前缀，只把新增/位移的卡片按 `visibleTemplates[i]` 下发；「显示更多」与场景模板共用；进入「模板」页仅在签名变化时重建 | 新增：只发改动的卡片、重进页面不发卡片 |
| P3-1 | 预检比像素判定更严 | 边条冲突时，若越界元素是文本/日期/序列号，交给打印时的 `marginInkReport` 用真实像素判定（仍在发送任何字节之前拦截） | 新增：文本框越界但无墨→可打印；真有墨→报同一句提示 |
| P3-2 | MARGIN_INK 误给「改尺寸」 | `withPrinterSuggestion` 只在 `PAPER_TOO_LARGE` 时保留 `canResize` | 新增：名字写 58 的打印机遇到边条墨迹 → 不给改尺寸，给「定位并修改」 |
| P3-3 | 实时预览丢字/不可撤销 | `previewField` 在草稿被 onHide/打印/保存清掉后自动重开一份 `startImplicitFieldEdit`，键入既进模型又进撤销 | 新增：onHide 后再输入仍进标签且可撤销 |
| P3-6 | 套模板无兜底、批量残留 | `applyTemplate` 先构建再改状态：模板读不出来只弹提示、不记录撤销、不动当前标签；新设计没有任何可填字段时退出批量模式并说明 | 新增：坏模板不动现场；纯图形模板退批量；文字模板保批量 |
| P3-7 | 示例行只改日期仍算样例 | `isSampleRow` 比较全部四个字段 | 新增：只改过日期的行在导入前会询问 |
| P3-8 | 批量保存定时器未清理 | 保存句柄到 `batchSavingTimer`，`onUnload` 清理，回调判 `pageActive` | 新增：卸载后在途定时器不再打开编辑器 |
| P3-9 | 批量字段四处重复 | 新增 `core/data-fields.js`，csv / data-bind / repository / home 全部引用它 | 既有 59 条数据相关测试 |
| P3-10 | 服务端三处数据寿命问题 | 同意时间取 `MIN(旧值, 新值)`（保留首次同意）；`stable_token` 缓存最短 30 秒；新增 `store.deleteAccount()` 与 `scripts/delete-account.mjs`，README 写明删除流程与保留策略 | 新增：首次同意时间不被覆盖、删号级联清会话、短 TTL 不再每次刷新令牌 |
| P3-12 | 源码里的不可见 BOM | `csv.js` 改用 `\uFEFF` 转义 | 既有 csv 测试 |

## 仍未处理

**P3-11 死代码清理**（home/editor 的 remote 模板/素材目录空壳、renderer 的重复手柄数学、selectionHandleMode）暂缓：测试会向页面实例注入 `remoteTemplates`/`remoteMaterials` 并断言这些分支，删掉等于改行为而不是清理，需要连同测试一起重写。建议下次单独做一次，而不是和功能改动混在一起。

## 需要真机/上传验证

1. 80mm 机型拿到 384 dots 光栅时的实际对齐方式（决定 P1-2 纸宽确认的实际收益）。
2. `wx.shareFileMessage` 对 `.csv/.json` 的支持（决定 P2-8 是否需要改导出格式）。
3. 主包已到 **90.2%**（剩 205 KB）：下一批模板/字体必须分包，否则上传失败。
