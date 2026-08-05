# 标签快印小程序

这是对 NIIMBOT Android 应用核心工作流的微信小程序原生重写。项目不依赖原 APK 的 Flutter/native 二进制，标签数据只保存在本机，小程序直接通过 BLE 与打印机通信。

## 已实现

- 40/30/50 mm 常用标签尺寸与 203 dpi 点阵画布
- 文字、EAN-13、Code 128B、二维码、图片、矩形、线条
- 元素选择、拖动、坐标/尺寸/旋转调整、图层移动、复制、删除
- 30 步撤销/重做、本地自动保存、本地模板
- 浓度、纸张类型、黑白阈值、打印份数
- BLE 扫描、连接、通知流重组、MTU 协商、完整帧串行写入
- D11/D110 新旧时序、B1、B21/B21_L2B、B21S、B21_C2B profile
- 连接后读取打印机型号 ID，并优先按 ID 选择时序

## 运行

1. 用微信开发者工具导入本目录 `label-printer-miniapp`。
2. 在 `project.config.json` 中将 `touristappid` 换成你的小程序 AppID。
3. 基础库选择 2.22.0 或更高版本，项目默认使用 2.32.3。
4. 在小程序管理后台按实际发布用途完成蓝牙、相机和相册相关的用户隐私保护指引声明。
5. 预览编辑功能可直接在模拟器运行；蓝牙扫描和打印必须使用 Android/iOS 真机调试。

依赖已经构建到 `miniprogram/vendor/qrcode.js`。需要重新生成时运行：

```powershell
npm.cmd install
npm.cmd run build:vendor
```

运行纯 JS 测试：

```powershell
npm.cmd test
```

## 真机边界

微信小程序只支持 BLE，不支持经典蓝牙 SPP。连接时会枚举实际 GATT 服务和特征，不只依赖设备名或固定 UUID。

打印行必须作为完整 NIIMBOT 协议帧写入。D11/D110 行帧通常约 25 字节，B1/B21 通常约 61 字节；项目会在 Android 尝试协商 MTU 247，并读取系统实际 MTU。若 `MTU - 3` 小于当前完整帧，打印会明确失败，不会把一帧静默拆成多个 GATT write。

当前 profile 来源于公开协议实现，自动匹配只接受已知型号 ID；已识别但未适配的型号会被阻止打印，不会按相似设备名猜参数。尚未在你的具体硬件上验证，首轮真机验收请记录：

- 设备名、型号 ID、硬件/固件版本
- 手机系统与微信版本、协商后的 MTU
- 标签实际宽高、方向、浓度和打印偏移
- D11 老固件是否需要切换到“旧协议”profile
- B21_C2B 在 B1 与 B21 时序下的实际表现

B21 Pro 使用另一套 `D110M_V4` 时序，当前不会自动误判为普通 B21，需拿目标设备补一次协议适配和实物验收。

## 目录

```text
miniprogram/
  core/       标签文档、Canvas 渲染、位图编码、协议与打印计划
  services/   微信 BLE 会话和打印任务
  pages/      标签编辑与设备连接界面
  vendor/     已打包的二维码生成器
tests/        Node 单元测试
```

APK 静态分析记录见 [APK_ANALYSIS.md](./APK_ANALYSIS.md)，第三方许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
