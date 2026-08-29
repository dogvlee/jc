# 商跃开源字体目录

更新时间：2026-08-18

编辑器提供 3 个系统字体和 20 个按需下载的开源字体，共 23 项。远程字体均标记为 `OFL-1.1`，字体文件不写入微信主包；只有文档实际使用某款字体时，才从固定版本的 Fontsource/jsDelivr 地址加载。加载失败时返回 `failed`，不会把失败结果缓存成“已就绪”。

## 简体中文

| 字体 | 类型 | 来源与许可 |
| --- | --- | --- |
| 思源黑体 / Noto Sans SC | 黑体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/notosanssc) |
| 思源宋体 / Noto Serif SC | 宋体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/notoserifsc) |
| 马善政楷书 | 楷体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/mashanzheng) |
| 站酷小薇 | 手写/宋体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei) |
| 站酷黄油体 | 圆体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/zcoolqingkehuangyou) |
| 站酷快乐体 | 圆体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/zcoolkuaile) |
| 龙藏体 / Long Cang | 手写 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/longcang) |
| 芝麻体 / Zhi Mang Xing | 手写 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/zhimangxing) |
| 流江毛草 | 手写 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/liujianmaocao) |
| WD-XL 滑油字 SC | 圆体/标题 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/wdxllubrifontsc) |

## 繁体中文

| 字体 | 类型 | 来源与许可 |
| --- | --- | --- |
| 思源黑体 TC / Noto Sans TC | 黑体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/notosanstc) |
| 思源宋体 TC / Noto Serif TC | 宋体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/notoseriftc) |
| 霞鹜文楷 TC | 楷体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/lxgwwenkaitc) |
| 霞鹜文楷等宽 TC | 等宽 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/lxgwwenkaimonotc) |
| 霞鹜漫黑 | 手写/标题 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/lxgwmarkergothic) |
| 粉圆体 / Huninn | 圆体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/huninn) |
| 芫荽 / Iansui | 楷体/手写 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/iansui) |
| Chiron GoRound TC | 圆体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/chirongoroundtc) |
| 巧克力黑体 | 黑体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/chocolateclassicalsans) |
| 仙人掌明体 | 宋体 | [Google Fonts / OFL-1.1](https://github.com/google/fonts/tree/main/ofl/cactusclassicalserif) |

## 使用与合规约定

- 字体 CDN 地址必须固定到精确版本；当前原有字体固定为 Fontsource `5.2.5`，新增字体固定为 `5.3.0`。
- 发布包不包含第三方字体二进制，因此新增目录项不会挤占微信主包。生产环境必须确保 `https://cdn.jsdelivr.net` 可访问；网络不可用时打印前会保留失败状态并使用平台回退字形。
- 若以后改为自托管或随应用分发字体文件，必须同时保留对应版权声明与完整 OFL 文本，且不得单独出售字体文件。
- 导入模板里的 `ZT*`、HarmonyOS 等未随模板提供的字体不会被复制；系统保留 `sourceFontFamily` 作为来源记录，并映射到本目录中的开源替代字体。
