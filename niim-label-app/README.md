# 精臣标签（niim-label-app）

独立标签打印 App：行业模板库 → 预览 → 编辑 → 蓝牙打印。

## 功能

- 首页（红顶 Hero、快捷入口、我的模板、打印历史）
- 15+ 离线行业模板（零售 / 仓储 / 办公 / 生活 / 行业）
- 模板画布预览后进入编辑器
- 文本 / 条码 / 二维码 / 日期 / 序列号 / 形状 / 表格等
- NIIMBOT 兼容 BLE 打印协议（D11/D110/B1/B21 等）
- CSV 批量数据、本地保存、打印历史

## 快速开始

```powershell
cd D:\vibecode\jc\niim-label-app
npm.cmd install
npm.cmd test
npm.cmd run dev
```

浏览器打开终端提示的本地地址（默认 `http://127.0.0.1:4173`）。

## 构建

```powershell
npm.cmd run build
# 产物在 dist/
```

## Android（Capacitor）

```powershell
npm.cmd install
npx cap add android   # 仅首次
npm.cmd run android:sync
npm.cmd run android:open
# 或
npm.cmd run android:debug
```

需要本机 Android SDK / JDK。真机打印需蓝牙权限。

## 目录

```text
src/
  app/          UI 与模板目录
  core/         协议、位图、渲染（纯 JS）
  services/     BLE / 存储 / CSV
public/         图标与编辑器资源
dist/           构建输出
tests/          单元测试
```

## 与 label-printer-app 的关系

本仓库是**独立新产品工程**，从 `label-printer-app` 洁净室核心衍生，使用独立 `appId` 与本地存储键，可单独安装与发布。
