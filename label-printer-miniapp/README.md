# 精臣标签微信小程序

`1.0.0-rc.1` 是 `niim-label-app` 核心产品旅程的微信小程序原生迁移候选版：模板浏览、标签编辑、本地项目、批量数据、打印预检和 NIIMBOT BLE 打印已经形成工程闭环。标签内容默认只保存在本机，不依赖账号或远端服务。

当前是“工程候选版”，不是“已上线版”。正式 AppID、微信开发者工具编译、Android/iOS 真机、目标打印机样张、隐私/类目及品牌与素材授权仍是发布 P0 门禁，详见[发布清单](./docs/RELEASE_CHECKLIST.md)。

## 已交付能力

- 首页、模板、我的标签、批量数据、我的，以及独立 Canvas 编辑器。
- 189 套离线模板，分为 32 套基础、4 套导入和 153 套在线目录固化模板。
- 文字、图片、素材、日期、条码、二维码、序列号、形状、表格和线条 10 类元素。
- 扫码建标：从首页扫描现有条码/二维码直接生成可编辑标签，也可向编辑器中的编码元素扫描填入。
- 144 个黑白素材、20 种边框、六种文字方向、吸附、移动、缩放、旋转、多选、对齐/分布、锁定、镜像、图层和 30 步撤销/重做。
- 项目/用户模板、自动保存、schema v1→v2 迁移、打印历史、CSV 批量生成、JSON 备份与失败回滚。
- 非破坏式打印预检：标签超过当前打印头时只阻止打印，不会修改或裁切原稿。
- 应用级 BLE 单例、上次设备记忆、单飞连接、TTL、`already connect`、僵尸连接恢复、蓝牙恢复自动复连、诊断和 kill switch。
- D11/D110 新旧时序、B1、B21/B21_L2B、B21S、B21_C2B profile；未知型号不会按相似名称冒险打印。
- 已拒绝非 NIIMBOT 的通用可写 BLE 特征，避免把 NIIMBOT 协议发送到无关设备。

## 本地验收

```powershell
cd D:\vibecode\jc\label-printer-miniapp
npm.cmd ci
npm.cmd run verify
npm.cmd run test:coverage
```

`verify` 会检查 JS/JSON、页面组合、WXML 事件处理器、静态资源引用、主包大小，并执行全量 Node 测试。需要重新同步压缩素材或构建二维码依赖时：

```powershell
npm.cmd run assets:sync
npm.cmd run build:vendor
```

本地自动化只覆盖纯逻辑、仓储和 BLE mock，不能替代微信编译与真实打印机验收。

## 微信开发者工具运行

1. 导入本目录。
2. 将 [`project.config.json`](./project.config.json) 中的 `touristappid` 替换为有权限的正式或测试 AppID。
3. 使用项目声明的基础库和计划支持的当前稳定基础库分别编译。
4. 在管理后台完成蓝牙、相册/相机、文件选择等实际用途的隐私保护指引和类目配置。
5. 模拟器验证页面；BLE、前后台恢复、杀进程重连和打印必须在 Android/iOS 真机执行。

## 协议与硬件边界

小程序只使用 BLE，不支持经典蓝牙 SPP。NIIMBOT 打印行必须作为完整协议帧单次写入；代码不会按 MTU 任意切碎一帧，也没有接入与本项目不兼容的 FF00/FF02/FF03 ESC/POS 流控。

自动匹配只接受已知型号 ID。`2320 → d110`、`4098 → b1` 目前仍属于候选映射，必须拿对应真机确认后才能对外声明支持。B21 Pro 的 `D110M_V4` 路径尚未适配，发布版本必须明确阻止。

## 文档

- [完整交付文档总索引](./docs/README.md)
- [产品规格](./docs/PRODUCT_SPEC.md) · [需求规格](./docs/REQUIREMENTS_SPEC.md) · [体验规格](./docs/UX_SPEC.md)
- [技术架构](./docs/TECHNICAL_ARCHITECTURE.md) · [模块参考](./docs/MODULE_REFERENCE.md) · [BLE 与打印协议](./docs/BLE_PRINTING_PROTOCOL.md)
- [测试计划](./docs/TEST_PLAN.md) · [需求追踪](./docs/TRACEABILITY_MATRIX.md) · [发布清单](./docs/RELEASE_CHECKLIST.md)
- [竞品分析与产品决策](./docs/COMPETITIVE_ANALYSIS.md) · [扫码建标功能规格](./docs/FEATURE_SPEC_SCAN_TO_LABEL.md)

模板和素材中包含来源于既有 NIIMBOT 数据/资产的内容；进入外部体验版或生产前，必须由权利人确认品牌、模板和素材的再分发范围。代码完成不等于授权完成。
