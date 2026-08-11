# 术语表

| 术语 | 含义 |
|---|---|
| BLE | Bluetooth Low Energy，小程序与打印机使用的低功耗蓝牙通道 |
| GATT | BLE 的服务和特征访问模型 |
| Service / Characteristic | BLE 服务与读写、通知特征；NIIMBOT 主服务为 E781 系列 UUID |
| Notify | 打印机主动返回协议响应或错误的 BLE 通知能力 |
| MTU | BLE 单次属性传输上限；必须足以容纳完整 NIIMBOT 协议帧 |
| Transport ready | GATT、write、notify 等传输层条件就绪 |
| Protocol ready | 已在传输层之上完成 NIIMBOT 状态、信息与心跳协商 |
| Single-flight | 同一设备的并发连接请求合并为同一个 Promise，避免重复连接 |
| Zombie connection | 系统声称已连接，但服务或特征不可用的假连接状态 |
| TTL | 连接缓存允许快速复用的有效时间 |
| Kill switch | 紧急禁止自动 BLE 工作的本地开关 `ble_reconnect_off` |
| Profile | 打印机型号对应的 DPI、打印头宽度、任务族和能力配置 |
| Print plan | 把标签图像、设置和份数转换成有序协议任务的计划 |
| Printability | 当前文档在选定 profile 上是否能安全打印的非破坏式判断 |
| Schema v2 | 当前本地仓储与文档归一化版本 |
| 用户模板 | 用户从编辑器保存、可删除和复用的本地模板 |
| 固化在线模板 | 从既有目录整理后随包离线发布的模板，不代表运行时联网 |
| 扫码建标 | 用户主动调用微信原生扫码，以一维码或二维码结果创建新的可编辑标签，不自动打印 |
| 扫码填入 | 在编辑器选中条码/二维码后扫描同类型码并更新元素；取消或不匹配不改变原稿 |
| P0 / P1 / P2 | 发布阻断、重要回归和次要优化三个风险优先级 |
| RC | Release Candidate，工程候选版，尚未等同生产发布 |
| UAT | User Acceptance Test，生产相似环境中的业务验收 |
| 灰度 | 仅向部分受控用户或比例发布，并根据指标决定继续或回滚 |
