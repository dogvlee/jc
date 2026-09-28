# 微信模拟器验收记录 · 2026-09-16

本记录对应当前未提交的 `1.0.0-rc.1` 工作区。基线提交为 `baa92c31fbbee9edd7198046ae8d6346acb79133`，不把它当作已包含本轮修复的冻结提交。

## 产品结论

当前继续保持**正式发布未放行**。本轮验证软件主流程及微信模拟器呈现；真实 AppID 的平台配置、Android/iOS 手机权限、蓝牙连接与目标打印机样张仍没有实测证据。游客项目不能替代这些验收。

## 执行环境与方法

- Windows 本机，微信开发者工具 `2.02.2608060`，官方自动化 SDK `miniprogram-automator@0.12.1`。
- 分别指定基础库 `2.32.3` 和 `3.17.2`，脚本核对运行时 `SDKVersion`，不依赖 `latest` 别名。
- 每次从当前源代码构建独立游客项目，开启 `urlCheck`，物理排除内部研究资源；保留原有开发项目及其数据。
- 模拟器预设为 iPhone 12/13 (Pro)、390 × 844 CSS 像素、DPR 3；系统信息中的 iOS 字段是模拟器返回值，不能当作 iOS 真机结果。
- 通过真实 WXML 按钮、文本输入、返回和重新打开完成旅程。未点击实际打印、未主动扫描 BLE、未上传或发布。
- 对模板的画布尺寸和点阵比例做检查，并比较原始点阵与截图内内容范围，避免“DOM 尺寸正确但显示失真”被误判为通过。截图另外人工复核。

执行命令：

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run test:wechat -- --cli 'D:\software\微信web开发者工具\cli.bat' --lib 2.32.3
npm.cmd run test:wechat -- --cli 'D:\software\微信web开发者工具\cli.bat' --lib 3.17.2
```

## 本轮实际修复

1. 微信 `style: v2` 的默认按钮宽度覆盖页面规则，导致首页按钮文字竖排、设备按钮越界、底部导航挤出屏幕。调整选择器优先级及栅格/弹性尺寸后验证按钮均在视口内。
2. 首页与模板等页的顶部操作与微信原生胶囊重叠。根据胶囊底部和安全区计算标题起点，并保留 API 不可用时的回退。
3. 原生 Canvas 页面生命周期缺少隔离：连续打开不同高度的标签时，内部点阵比例正确，屏幕仍可能按旧画布高度显示。通过窗口截图交叉确认不是单独截图 API 的问题。现在为每个编辑器实例生成唯一原生画布标识，文档尺寸确定后才挂载，等待视图更新和首帧绘制完成后才标记就绪；过期回调不再影响当前页面。未改动打印点阵坐标来补偿显示问题。
4. 公开包构建此前会删除已有目标目录。改为保留旧产物、默认生成新的带时间戳目录，显式输出已存在时拒绝；同时拒绝源目录及其别名作为输出。
5. 新增真实 AppID 验收项目生成命令，自动开启域名检查并附网络来源/隐私 API 清单。没有真实 AppID 时明确失败，不伪造可上传配置。

## 最终验证结果

| 检查 | 结果与证据 |
| --- | --- |
| 依赖锁文件安装 | `npm ci` 成功，80 个包；`npm audit --omit=dev` 为 0。开发 SDK 遗留中等风险依赖的范围见[准备说明](./WECHAT_ACCEPTANCE_SETUP.md)。 |
| 工程检查 | `npm run verify` 通过，399 项测试全部通过，0 失败/跳过；50 个 JS 文件、11 个 JSON、229 个 WXML 事件绑定检查通过。[完整输出](./acceptance-evidence/2026-09-16/verify.txt) |
| 基础库 2.32.3 | 7 个场景全部通过，截图人工复核通过。[原始报告](./acceptance-evidence/2026-09-16/sdk-2.32.3.json) · [启动日志](./acceptance-evidence/2026-09-16/startup-2.32.3.txt) |
| 基础库 3.17.2 | 7 个场景全部通过，截图人工复核通过。[原始报告](./acceptance-evidence/2026-09-16/sdk-3.17.2.json) · [启动日志](./acceptance-evidence/2026-09-16/startup-3.17.2.txt) |
| 公开包 | 78 个文件、1,524,307 字节，约 1.45 MiB；内容门禁通过。两版模拟器使用相同公开包 SHA-256，见下方。 |
| 验收脚本失败路径 | 非法基础库别名立即拒绝；不存在的 CLI 返回失败并写入报告；加入轮询/清理超时及全程 180 秒上限。画布失真曾被新增截图断言实际捕获，[失败报告](./acceptance-evidence/2026-09-16/canvas-regression-failed.json)保留作为回归证据。 |

七个场景为：首次编译与引导；首页导航和按钮布局；新建并真实输入、保存；系统返回后恢复未保存草稿；保存重开与打印预检；模板浏览、预览与进入编辑器；连接后未观察到未捕获的运行时异常。测试未覆盖全部编辑器功能、全部模板和所有屏幕尺寸。

两版连接后的 `exceptions` 都为空，但这不等于开发者工具控制台“零错误”。3.17.2 报告保留了 `getSystemInfoSync` 弃用提示、页面初始化性能提示，以及 5 条参数被 SDK 序列化为 `{}` 的 `console.error` 事件。

只读重开同一个 3.17.2 游客验收项目，检查开发者工具控制台后，5 条错误归为同一错误（控制台重复计数 5）：`Error: SystemError (appServiceSDKScriptError)`，内容为 `{"errMsg":"webapi_getwxasyncsecinfo:fail "}`。堆栈位于 `WAServiceMainContext.js` 的 errorReport / 内部回调，相邻提示为“游客模式，调用 wx.operateWXData 受限，API 返回开发工具模拟返回”，未发现业务页面或模块堆栈。SDK 内部来源已确认，游客权限限制是推测原因；不修改或清零原始报告，真实 AppID 下仍需复核。重开过程中 CLI 另报的 AppID 不存在 / simulator launch failed 属于这次额外诊断，未混入原始 7 场景结果。

最终公开包内容指纹（按文件相对路径排序，对路径、内容和分隔符求哈希）：

```text
4906598d491c139242ec9ea231259c97c4ee466b043e94f69ec5950621b4397b
```

本机工程验证产物目录为 `dist/shangyue-release-1789537447342-1/`。游客验收运行目录分别为 `artifacts/wechat-smoke/run-tY5ROH/` 和 `artifacts/wechat-smoke/run-5FZTcM/`；上述关键证据已复制到本记录旁，避免依赖被忽略的临时目录。

截图：[首页](./acceptance-evidence/2026-09-16/home.png)、[保存后的编辑器](./acceptance-evidence/2026-09-16/editor-saved.png)、[草稿恢复入口](./acceptance-evidence/2026-09-16/draft-recovery.png)、[打印预检](./acceptance-evidence/2026-09-16/print-preflight.png)、[模板修复前](./acceptance-evidence/2026-09-16/template-before.png)、[2.32.3 修复后](./acceptance-evidence/2026-09-16/template-2.32.3.png)、[3.17.2 修复后](./acceptance-evidence/2026-09-16/template-3.17.2.png)。这些截图和数据均来自专用验收项目中的合成内容。

## 尚未完成的发布证据

| 项目 | 当前状态与所需输入 |
| --- | --- |
| 真实 AppID | 尚未提供。需要有权限的小程序 AppID；不需要 AppSecret。 |
| 平台网络与隐私配置 | 生成工具已具备；仍需真实主体后台与手机环境核验。 |
| Android / iOS 真机 | 尚未执行。需要手机验证权限允许/拒绝/恢复、键盘、切后台和重启。 |
| BLE 与实物打印 | 尚未执行。需要实际型号、型号 ID、固件、纸张尺寸及打印机，完成连接、连续打印、断线恢复和码制回扫。 |
| 内容与运营 | 公开包检查通过不等于素材授权凭证或支持渠道已落实，发布前需核对实际交付记录。 |
| 发布 | 未上传、未提交审核、未发布。最终冻结候选需重新归档对应版本证据。 |

真实 AppID 项目生成与手机验收准备见[微信验收项目准备](./WECHAT_ACCEPTANCE_SETUP.md)，硬件矩阵填写[验收记录模板](./ACCEPTANCE_RECORD_TEMPLATE.md)。
