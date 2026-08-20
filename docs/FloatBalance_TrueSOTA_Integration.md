# FloatBalance TrueSOTA 接入记录

## 1. 当前自检结论

2026-08-20 在已登录的 TrueSOTA `/keys` 页面做只读检查：

- 页面可见账户总余额：已验证。出于公开仓库安全，不提交具体金额。
- 前端 API 基础路径：`/api/v1`
- API Key 余额探针：`GET /v1/usage`
- Web 用户资料：`GET /api/v1/user/profile`
- Web 使用错误列表：`GET /api/v1/usage/errors`
- Web 使用错误详情：`GET /api/v1/usage/errors/{id}`

安全边界：

- FloatBalance 不读取浏览器 Cookie、localStorage 或完整 API Key。
- 公开仓库只提交接口契约、脱敏错误模型和环境变量名称。
- 本地运行时只从环境变量读取 `TRUE_SOTA_API_KEY`、`TRUE_SOTA_WEB_TOKEN` 或 `TRUE_SOTA_WEB_BEARER_TOKEN`。

## 2. 已接入能力

### 2.1 API Key 余额

`TRUE_SOTA_API_KEY` 存在时，Tauri 后端调用：

```http
GET https://true-sota.com/v1/usage
Authorization: Bearer <TRUE_SOTA_API_KEY>
Accept: application/json
```

响应字段兼容：

- `remaining`
- `quota.remaining`
- `balance`
- `data.remaining`
- `data.quota.remaining`
- `data.balance`

单位字段兼容：

- `unit`
- `quota.unit`
- `currency`
- `data.unit`
- `data.quota.unit`
- `data.currency`

前端显示为 `TrueSOTA Key` 余额球。

### 2.2 Web 账户余额与错误

`TRUE_SOTA_WEB_TOKEN` 或 `TRUE_SOTA_WEB_BEARER_TOKEN` 存在时，Tauri 后端会尝试调用：

```http
GET https://true-sota.com/api/v1/user/profile
Authorization: Bearer <TRUE_SOTA_WEB_TOKEN>
```

并显示账户级 `TrueSOTA` 余额球。

同时会尝试调用：

```http
GET https://true-sota.com/api/v1/usage/errors?page=1&page_size=20
Authorization: Bearer <TRUE_SOTA_WEB_TOKEN>
```

返回记录会被归一化为 `ErrorEvent`，再显示为 ErrorBall。

## 3. 运行方式

桌面端不会显示静态 demo 余额。未设置真实凭证时只显示配置类 ErrorBall；设置凭证后每 30 秒自动刷新。

仅接 API Key 余额：

```powershell
$env:TRUE_SOTA_API_KEY="你的 TrueSOTA API Key"
npm run tauri dev
```

同时接账户余额和错误记录：

```powershell
$env:TRUE_SOTA_API_KEY="你的 TrueSOTA API Key"
$env:TRUE_SOTA_WEB_TOKEN="你显式提供的 TrueSOTA Web Bearer token"
npm run tauri dev
```

注意：`TRUE_SOTA_WEB_TOKEN` 目前属于网页登录态能力，不建议长期保存。后续更好的做法是让 TrueSOTA 提供只读错误查询 Token，或在用户自管后端里做最小权限代理。

## 4. ErrorBall 映射

| 来源 | 条件 | ErrorEvent category | severity |
| --- | --- | --- | --- |
| `/v1/usage` | 环境变量缺失 | `config` | `warn` |
| `/v1/usage` | 401 / 403 | `auth` | `error` |
| `/v1/usage` | 429 | `rate_limit` | `warn` |
| `/v1/usage` | 5xx | `upstream` | `error` |
| `/v1/usage` | 超时 / DNS / 连接失败 | `network` | `error` |
| `/api/v1/usage/errors` | 返回记录 | 由 status/message 推断 | `warn` / `error` |

所有错误摘要走 `sanitizeSensitiveText`，会脱敏 Authorization、API Key、token、secret、cookie、password 和 `sk-*` 形式的密钥。
