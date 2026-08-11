# 开发指南

## 1. 目的与适用范围

本文用于指导 `label-printer-miniapp` 的本地开发、代码评审、资源更新和回归验证。当前版本为 `1.0.0-rc.1`，运行目标是微信原生小程序，不包含 WebView、云函数或远端业务后端。

## 2. 开发环境

建议使用以下环境：

- Windows 10/11 或 macOS；
- Node.js 20 LTS 及以上；
- npm 10 及以上；
- Python 3，仅在执行素材压缩脚本时需要；
- 微信开发者工具，用于编译、预览、真机调试和上传；
- Android 与 iOS 测试手机，以及目标 NIIMBOT 打印机。

首次安装：

```powershell
cd D:\vibecode\jc\label-printer-miniapp
npm.cmd ci
npm.cmd run build:vendor
npm.cmd run verify
```

`project.config.json` 当前使用 `touristappid`。开发者工具真机调试前必须替换成有权限的测试或正式 AppID，但不得把上传私钥、账号令牌或其他凭据提交到仓库。

## 3. 目录职责

| 路径 | 职责 |
|---|---|
| `miniprogram/app.js` | 应用级仓储与 BLE 连接管理器生命周期 |
| `miniprogram/app/` | 模板目录、模板构建、批量数据绑定和预设 |
| `miniprogram/core/` | 文档模型、几何、渲染、扫码建标规则、编码、协议和打印计划等纯逻辑 |
| `miniprogram/services/` | 本地仓储、CSV、微信原生扫码封装、BLE 会话、打印客户端和连接管理 |
| `miniprogram/pages/home/` | 首页及模板、项目、数据、我的等虚拟分区 |
| `miniprogram/pages/editor/` | 编辑器、属性面板、预检与打印交互 |
| `miniprogram/assets/` | 随主包发布的黑白模板图、缩略图与素材 |
| `tests/` | Node 单元、集成和微信 API mock 测试 |
| `scripts/` | 静态门禁与资源转换脚本 |
| `docs/` | 产品、技术、测试、发布、运维和合规文档 |

## 4. 代码约束

- 小程序运行代码采用 CommonJS；领域逻辑优先写成无 `wx`、无页面状态依赖的纯函数。
- 微信 API 依赖应从构造参数注入，便于在 Node 测试中使用 mock。
- 文档进入仓储、模板、打印链路前必须经过 `normalizeDocument`，未知元素类型不得进入打印路径。
- 连接监听由应用级 `PrinterConnectionManager` 唯一持有；页面只订阅状态，不在卸载时关闭全局蓝牙适配器。
- NIIMBOT 协议帧必须完整单次写入，不能为了“提速”在任意字节边界拆帧。
- 打印已发送任意行后，不允许自动重放整单；必须提示用户检查实物后手动决定是否重打。
- 连接打印机不得静默改变标签尺寸；尺寸不兼容应由打印预检阻止。
- 扫码只能由用户主动触发；取消、权限失败或类型不匹配不得创建/修改文档，扫描原文与 `rawData` 不得写日志或上传。
- 新增模板或素材时，必须验证所有静态路径存在，并关注 2 MiB 主包门限。

## 5. 常用命令

```powershell
# 全量静态门禁与测试
npm.cmd run verify

# 覆盖率
npm.cmd run test:coverage

# 仅运行 Node 测试
npm.cmd test

# 重建二维码依赖
npm.cmd run build:vendor

# 从源素材重新生成一位 PNG；执行前先审查脚本输入来源
npm.cmd run assets:sync
```

静态门禁检查 JS 语法、JSON、页面文件组合、WXML 标签与事件处理器、资源引用以及主包大小。它不等同于微信编译器，也不覆盖基础库、系统 BLE 栈和打印机固件差异。

## 6. 变更工作流

1. 先确定对应需求编号和验收标准。
2. 优先在 `core/` 或 `services/` 实现可测试逻辑，再接页面交互。
3. 正常路径、边界、失败恢复至少各增加一个测试；BLE 变更必须包含断线或超时场景。
4. 执行 `npm.cmd run verify` 与 `npm.cmd run test:coverage`。
5. 在微信开发者工具执行开发者自测；涉及扫码/相册/文件权限时必须补 Android/iOS 的允许、取消、拒绝和恢复证据，涉及渲染或 BLE 时补相应真机证据。
6. 更新需求追踪、测试计划、已知风险和版本说明。
7. 评审通过后再进入体验版、灰度或生产发布流程。

## 7. 素材与依赖管理

- `qrcode-generator` 固定版本后构建到 `miniprogram/vendor/qrcode.js`，避免运行时网络依赖。
- 素材优化脚本输出一位 PNG；不得只修改扩展名而不更新引用。
- 新增第三方代码、字体、模板或图片时，同步更新 `THIRD_PARTY_NOTICES.md` 与授权证据。
- 不要把 `node_modules`、开发者工具缓存、上传密钥、真机日志或含用户内容的备份提交到 Git。

## 8. Definition of Done

仓库内开发完成至少满足：

- 需求、异常状态和验收标准明确；
- 代码评审完成，无跨项目误改；
- `npm run verify` 全绿且包体不过线；
- 对应自动化测试和文档已更新；
- 微信开发者工具编译无错误；
- 涉及设备能力时，目标系统与硬件矩阵有证据；
- 隐私、类目、素材授权和回滚责任人已确认。

只有前五项及所有 P0 发布门禁均满足，版本才可从候选版转为可上线版本。
