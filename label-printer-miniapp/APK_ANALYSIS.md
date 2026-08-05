# NIIMBOT 6.6.6 静态分析

分析对象：`NIIMBOT_6.6.6_APKPure.xapk`

- SHA-256：`796DA24188A532ED269586425210DA3A493DDE5C8715214DCD4A01C9856FBEF7`
- 包名：`com.gengcon.android.jccloudprinter`
- 版本：`6.6.6`（versionCode `607281807`）
- Android：minSdk 24，targetSdk 35
- XAPK：base APK + arm64-v8a split + hdpi split

## 技术栈

应用主体是 Flutter AOT，并混合 Android 原生插件、FlutterBoost 和 WebView。arm64 split 内包含 `libflutter.so`、`libapp.so`，以及标签画布、Excel、图像与打印相关 native 库：

- `libniimbot_canvas_image.so`
- `libniimbot_calamine_excel.so`
- `libniimbot_excel.so`
- `libniimbot_lego.so`
- `libniimbot_netal.so`
- Skia / OpenCV 相关库

可见 Flutter 包线索包括 `niimbot_flutter_canvas`、`niimbot_connector`、`niimbot_print_setting_plugin`、`niimbot_tiny_canvaskit` 和 `niimbot_cache_manager`。

DEX 使用 SecNeo 包装，入口为 `com.secneo.apkwrapper.AW`，可见 Java 层基本只有壳代码。Flutter 业务已 AOT 编译，部分画布/打印逻辑又位于 native 库，因此这些二进制无法直接移植到微信小程序。

## 核心功能模型

包内配置与画布资产确认了核心编辑器能力：

- 打印机、纸张、DPI、最大宽高与 BLE 能力配置
- 标签尺寸、边距与元素数组
- 文字、条码、二维码、图形、图片
- 对齐、图层、撤销/重做、数据源、保存与打印

Android 清单同时包含 BLE、相机、图片/存储、Wi-Fi、前台服务、悬浮窗和屏幕捕获相关能力。小程序版本只迁移本地标签编辑与 BLE 打印，不迁移 Android 悬浮打印、屏幕捕获、账号、商城和云端模块。

## 重写方式

微信小程序不能加载 APK 内的 Flutter AOT 或 `.so`。当前项目用原生 Canvas 2D、纯 JS 1bpp 栅格化、公开 NIIMBOT BLE 帧格式和按机型区分的打印任务重新实现核心链路。未修改 APK，未绕过登录、付费、签名、授权、耗材校验或固件区域限制。
