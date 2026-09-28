# 微信验收项目准备

本工具生成与研究资源隔离的微信验收项目，不上传、不发布，也不替代微信账号权限、后台配置或实物验收。仓库原始 `project.config.json` 保留 `touristappid` 开发占位，不用虚构 AppID 生成正式配置。

## 生成可导入项目

在项目根目录执行：

```powershell
# 将下面的中文占位替换为自己的真实小程序 AppID。
$env:WECHAT_APPID = '实际小程序AppID'
node scripts/prepare-wechat-release.mjs
```

也可通过 `--appid` 传入，或预先在源项目配置中填写已授权 AppID。只接受 `wx` 加 16 位十六进制字符的格式；格式通过不表示账号权限已通过微信验证。不需要 AppSecret，也不会读取 AppSecret。

工具先检查 AppID，再构建公开内容并执行内容门禁，随后生成：

```text
dist/wechat-acceptance[-时间戳]/
  project.config.json        # miniprogramRoot=miniprogram/，urlCheck=true
  acceptance-inventory.json  # 字体 URL、隐私相关 API 的实际代码位置、待验收项
  miniprogram/               # 已物理排除内部第三方研究资源
```

导入工具打印的**项目目录**，而不是其中的 `miniprogram/`。已有默认输出不会被覆盖，会创建新的带时间戳目录；`--out <全新目录>` 可指定本次路径，显式目录已存在则拒绝。两个发布工具都不再递归删除输出目录。

源目录仍可用于游客本地开发。游客模拟器检查、真实 AppID 验收、微信上传审核与手机/打印机验收是不同证据。

## 网络来源与隐私代码清单

无需 AppID 即可只读查看清单：

```powershell
node scripts/prepare-wechat-release.mjs --inspect
```

2026-09-16 本地代码审查结果：

| 功能 | 当前实现与验收内容 |
| --- | --- |
| 远程字体 | 20 款字体对应 22 个文件，实际文件源为 `https://cdn.jsdelivr.net`；验证目标手机网络、加载失败反馈与 Canvas 样张。当天本机对 22 个 URL 的 HEAD 请求均返回 200、`font/woff2`、CORS `*`，这不证明手机或微信加载通过。 |
| 字体许可证 | `github.com/google/fonts` 仅为来源和许可引用，不是应用字体文件下载源。 |
| 内置模板与素材 | 公开模板图片使用包内商跃资源；内部在线模板、素材客户端及其固定域名已排除。 |
| 导入远程图片 | 用户主动导入 JSON 中的 HTTPS 图片由 `wx.downloadFile` 获取，域名取决于导入数据。应明确支持的图片来源，在真实平台配置下验证允许和失败路径。 |
| 图片与扫码 | `chooseMedia` 用于标签图片；`scanCode` 用于建标或填入编码。验证允许、拒绝、取消和恢复。 |
| 文件与分享 | `chooseMessageFile` 用于 CSV、备份、模板导入；`shareFileMessage` 用于用户主动分享导出文件。JSON 备份不包含图片文件本体。 |
| 蓝牙 | BLE 发现/连接用于打印；记忆设备在启动或蓝牙恢复时可能自动重连。验证首次授权、拒绝、恢复及已记忆设备行为。 |

上述清单来自代码，不读取也不代填小程序后台隐私保护指引、服务类目或网络配置。后台声明应与实际处理的数据、功能触发时机和用户可见说明一致；隐私 API 的具体配置以微信当前后台提示和真机结果核对。工具不会把“未检查”标为“已通过”。

## 交付证据

归档本次生成路径、候选版本、完整检查输出，以及 `acceptance-inventory.json`。真实 AppID、后台配置、最低/目标基础库和 Android/iOS 打印样张的结果记录在[验收记录模板](./ACCEPTANCE_RECORD_TEMPLATE.md)，不要用空白模板或静态检查替代实测结果。

## 可重复的模拟器主流程验收

```powershell
npm.cmd run test:wechat -- --cli 'D:\software\微信web开发者工具\cli.bat' --lib 2.32.3
```

`scripts/wechat-smoke.cjs` 从当前代码生成物理排除研究资源的独立游客项目并打开微信自动化端口，进行实际控件交互、Canvas 几何及截图内容比例检查。`--lib` 只接受明确的 `x.y.z` 版本，并核对实际 SDK。基础库版本、工具版本、场景结果、连接后观察到的运行时日志/异常和截图保存在 `artifacts/wechat-smoke/run-*/`，启动日志单独保存在 `devtools.log`。通过参数校验并创建运行目录后，构建/启动/交互失败均写入 JSON 报告、返回非零退出码并保留现场；全程 180 秒超时。此脚本不操作既有项目数据，也不执行蓝牙、上传或发布。

本次实际执行结果与最终证据见[2026-09-16 微信模拟器验收记录](./ACCEPTANCE_2026-09-16.md)。

游客配置开启 `urlCheck` 仅表示配置意图，不证明真实 AppID 的后台域名、隐私或权限已经通过；模拟器呈现的机型和授权状态也不代表真实手机。

验收 SDK `miniprogram-automator` 为开发依赖，不进入小程序包。锁文件对其旧图像解析依赖使用兼容补丁版本；当前 `npm audit --omit=dev` 无运行时依赖漏洞。开发工具依赖仍有 `phin` 的中等风险重定向问题，当前脚本只连接本地 IDE、读取截图，不使用 URL 图像解析或远程真机二维码接口；不要用 `npm audit fix --force` 自动降级 SDK。
