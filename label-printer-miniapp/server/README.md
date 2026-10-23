# 商跃账号服务

独立的 Node.js 24 原生 HTTP 服务，使用内置 `node:sqlite`，没有第三方运行时依赖。微信 AppID、AppSecret 仅从服务端环境变量读取。当前没有配置真实服务地址或密钥，也没有部署或调用微信。

## 本机启动

在此 `server` 目录复制 `.env.example` 为 `.env`，填入你自己的 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`，然后执行：

```sh
npm start
```

需要 Node.js 24.15 或更新的 24.x（本地测试为 24.17.0）。默认监听 `127.0.0.1:8787`，数据库自动建立在 `server/data/auth.sqlite`，位置与当前工作目录无关。启动只检查配置并初始化数据库，不主动调用微信。

| 环境变量 | 说明 |
|---|---|
| `WECHAT_APP_ID` | 当前小程序的真实 AppID，必填 |
| `WECHAT_APP_SECRET` | 该 AppID 的服务端密钥，必填，不能放入小程序 |
| `HOST` / `PORT` | 默认 `127.0.0.1` / `8787` |
| `DATABASE_PATH` | 可选数据库路径；默认 `server/data/auth.sqlite` |
| `SESSION_TTL_DAYS` | 会话期限，默认 30 天，最大 90 天 |
| `UPSTREAM_TIMEOUT_MS` | 整个微信校验流程时限，默认 18000 毫秒，最大 20000 |
| `TRUST_PROXY` | 设为 `1` 时按代理覆盖的 `X-Real-IP` 分桶；不设或 `0` 时只用 TCP 对端地址 |
| `AUTH_RATE_LIMIT_LOGIN` / `AUTH_RATE_LIMIT_SESSION` / `AUTH_RATE_LIMIT_GLOBAL` | 每客户端每分钟的登录、会话、全部账号操作上限，默认 10 / 120 / 300 |

正式对外前，将服务置于自有域名的 HTTPS 反向代理后，并把该域名配置为微信小程序合法 request 域名。代理应关闭请求体、Authorization 和上游 URL 日志，设置合理请求大小、连接及速率限制，并限制只有代理能访问本服务。

内置限制默认使用实际 TCP 对端 IP，并忽略客户端传入的转发头。**反向代理后所有用户的对端地址都是代理自己**（例如 `127.0.0.1`），此时必须让代理覆盖 `X-Real-IP` 并设置 `TRUST_PROXY=1`（[Nginx 示例](./deploy/nginx.conf.example) 已这样配置，compose 默认开启），否则"每分钟 10 次登录"会变成整个部署共用的上限，单个来源即可占满。`X-Forwarded-For` 不使用：它可能带客户端追加的多个地址，取值容易出错。默认每分钟每个客户端最多 10 次登录、120 次会话操作，总计 300 次账号操作，桶数最多 2000，最多 20 个同时进行的微信校验。单实例 SQLite 需要持久磁盘，不应把不同机器的本地文件当作共享数据库。

## 账号资料与删除

库里只保存脱敏手机号（如 `138****1234`）、微信在此 AppID 下的 `openid`、协议版本与**首次**同意时间。会话只存令牌的 SHA-256（`sessions`），过期或退出即失效，进程每小时清理一次；账号行不随会话过期删除。

用户通过小程序「我的 → 反馈与投诉」要求删除时，在持有数据库的机器上执行：

```sh
node scripts/delete-account.mjs --openid=oXXXX --yes
# 或 node scripts/delete-account.mjs --user=syu_XXXX --yes
```

脚本删除该账号并（按外键级联）删除它全部会话，然后打印删除条数；它不提供 HTTP 接口，因此没有新增攻击面。删除后用户再登录会重新建号。协议页所说的「提出账号信息处理请求」由这条流程承接，不在应用内自助执行。
## HTTP 契约

所有响应为 JSON，账号响应使用 `Cache-Control: no-store`，服务不返回重定向。POST 使用 `Content-Type: application/json`，请求体最多 8 KiB。

### `POST /api/auth/wechat/phone`

```json
{
  "loginCode": "wx.login 返回的一次性 code",
  "phoneCode": "getPhoneNumber 返回的一次性 code",
  "consentAccepted": true,
  "consentVersion": "2026-10-15"
}
```

服务端以自己的 AppID/AppSecret 调用微信 `code2session`，再通过 `stable_token` 和 `getuserphonenumber` 获取手机号并核对 watermark AppID。不接受客户端提供的 OpenID、AppID、手机号或额外字段作为身份信息。

```json
{
  "ok": true,
  "user": { "id": "syu_用户UUID", "phoneMasked": "138****1234", "nickName": "商跃用户" },
  "accessToken": "随机256位不透明令牌",
  "expiresAt": 1802592000000
}
```

`expiresAt` 是 Unix 毫秒时间戳。相同 AppID/OpenID 幂等更新同一账号；不按手机号找回账号，也不合并不同微信身份。手机号、微信 `session_key`、取号 code 和微信 access_token 不写入数据库。

### `GET /api/auth/session`

请求头 `Authorization: Bearer <accessToken>`。有效时返回 `{ "ok": true, "user": { ... }, "expiresAt": 1802592000000 }`；无效或过期返回 HTTP 401。

### `POST /api/auth/logout`

使用相同 Bearer 请求头，JSON 请求体为 `{}`（也接受 Content-Type 为 JSON 的空体）。撤销当前令牌后返回 `{ "ok": true }`；无效令牌返回 HTTP 401。退出不会删除账号资料或本机标签。

### `GET /healthz`

只返回 `{ "ok": true }`，不返回数据库路径、用户数、环境变量或微信凭据。这是进程探活，不代表微信真实登录验收通过。

### 错误

统一格式 `{ "ok": false, "code": "AUTH_INVALID_SESSION", "msg": "登录已失效，请重新登录" }`，不会透传微信诊断正文、URL 或数据库异常。

| HTTP | code |
|---|---|
| 400 | `AUTH_CONSENT_REQUIRED`、`AUTH_CODE_REQUIRED`、`AUTH_REQUEST_INVALID`、`AUTH_WECHAT_LOGIN_FAILED`、`AUTH_PHONE_EXPIRED`、`AUTH_PHONE_FAILED`、`INVALID_JSON` |
| 401 | `AUTH_INVALID_SESSION` |
| 404 / 405 | `NOT_FOUND` / `METHOD_NOT_ALLOWED` |
| 408 / 413 / 415 | `REQUEST_TIMEOUT` / `BODY_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `AUTH_RATE_LIMITED` |
| 503 | `AUTH_UPSTREAM_TIMEOUT`、`AUTH_SERVICE_FAILED` |

## 存储与备份

`users` 只保存随机用户 ID、可信 AppID/OpenID、脱敏手机号和协议同意时间/版本。`sessions` 保存令牌 SHA-256 哈希、账号引用和过期时间，不保存明文令牌。过期会话在访问时及每分钟清理；退出立即撤销当前会话。

数据库和 WAL 文件属于账号私有数据，已由 `server/.gitignore` 排除。SQLite 使用 WAL；备份请停服务后复制完整数据库，或使用支持在线一致性备份的 SQLite 工具。不要只复制正在写入的主文件。文件副本也要限制访问，不应纳入小程序的标签 JSON 备份。

客户端把会话令牌保存在独立的本机账号存储，用于恢复登录。登录、退出和账号服务不会上传、迁移或清空标签、模板、图片、批量数据、打印历史、草稿或打印机设置。

## Docker（可选）

从此目录构建，`.dockerignore` 会排除 `.env` 和数据目录：

```sh
docker build -t shangyue-auth .
docker run --env-file .env -e HOST=0.0.0.0 -e PORT=8787 -e DATABASE_PATH=/app/data/auth.sqlite -p 127.0.0.1:8787:8787 -v shangyue-auth-data:/app/data shangyue-auth
```

容器内显式监听 `0.0.0.0`，覆盖 `.env` 的本机监听设置；宿主机仍只映射本机端口，由反向代理提供 HTTPS。持久卷中的账号数据库应按上面的规则管理。此构建配置尚未做 Docker 实机验收。

## 自有云服务器部署

现按单台 Linux 云服务器准备，云厂商不限。服务器地址、系统、现有站点和域名尚未提供，以下配置未安装到真实服务器。

可使用 [compose.yaml](./compose.yaml) 运行账号服务，并由宿主机 Nginx 提供 HTTPS。已有站点时，把配置并入它的站点管理流程，先核对端口和域名；不要直接替换现有 Nginx 配置。

1. 将 `server/` 上传到服务器的独立目录，安装 Docker Engine 和 Compose 插件；如果已有运行环境，按实际情况接入。
2. 在该目录执行 `cp .env.example .env` 和 `chmod 600 .env`，用服务器编辑器填写真实 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。密钥仅保存在服务器，不发到小程序代码或聊天记录。
3. 执行 `docker compose config --quiet` 校验配置，再执行 `docker compose up -d --build`。不要输出不带 `--quiet` 的完整配置，它会展开密钥。
4. 执行 `docker compose ps` 和 `curl --fail http://127.0.0.1:8787/healthz`。探活成功只表示账号进程可用，不代表微信取号可用。
5. 将域名解析到云服务器，准备有效 HTTPS 证书。参考 [Nginx 站点示例](./deploy/nginx.conf.example) 替换域名和证书路径，使用 `nginx -t` 校验后再由现有运维流程加载。配置用于宿主机 Nginx；容器里的 Nginx 不能通过自己的 `127.0.0.1` 访问本服务。
6. 云安全组开放 HTTPS 443；8787 只供宿主机反代，不对公网开放。SSH 限制到管理来源。证书申请或已有站点若需要 80 端口，按其实际流程配置；账号 API 使用 HTTPS 直达，不设置跳转。
7. 以真实域名验证 `/healthz` 直接返回 200；验证 `GET /api/auth/session` 无令牌时直接返回 401 JSON。然后配置小程序合法 request 域名及 `miniprogram/config/auth.js` 的 `apiBaseUrl`，按 [登录接入验收](../docs/LOGIN_SETUP.md) 完成真机授权。

Compose 固定容器内部地址、端口和数据库目录；数据库及 WAL 在 `auth-data` 持久卷中，常规重建服务保留卷。不要执行带 `--volumes` 的清理命令。备份要停服务或使用 SQLite 一致性备份；恢复前先保留现有卷并核对 `node` 用户访问权限。

`compose.yaml` 已为容器设置 `TRUST_PROXY=1`，宿主机 Nginx 必须按示例覆盖 `X-Real-IP`，否则所有请求仍会共享同一个桶。若不用代理、直接对外暴露，请保持 `TRUST_PROXY=0`（此时客户端无法伪造来源绕过限流）。上线容量验收需要覆盖预计并发量：总量上限由 `AUTH_RATE_LIMIT_GLOBAL` 控制，扩容前应按实际代理拓扑与数据库方案调整。

日常检查用 `docker compose ps`，更新用 `docker compose up -d --build`；保留上一版本代码或镜像及一致性数据库备份，以便在部署失败时恢复。健康检查不会自动证明上游微信可用，也不会自动重启仅被标记为 unhealthy 的进程。

## 验证

```sh
npm test
```

测试使用内存/临时 SQLite 与模拟微信上游，不读取真实 `.env`、不调用微信、不发送短信、不产生手机号接口费用。覆盖令牌恢复/过期/撤销、身份边界、上游失败/超时、请求大小/格式、限流、账号幂等及 SQLite 重启/回滚。

接口参考：[Node.js 24.17 SQLite](https://nodejs.org/download/release/v24.17.0/docs/api/sqlite.html)、[微信 code2session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)、[稳定版 access_token](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-access-token/getStableAccessToken.html)、[手机号接口](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html)。正式接入仍需用真实 AppID、配置后的 HTTPS 地址和手机授权验收。
