# FloatBalance TrueSOTA 接入记录

## 1. 当前自检结论

2026-08-20 在已登录的 TrueSOTA `/keys` 页面做只读检查：

- 页面可见账户总余额：已验证。出于公开仓库安全，不提交具体金额。
- 前端 API 基础路径：`/api/v1`
- API Key 余额探针：`GET /v1/usage`，只代表单 Key，不适合 FloatBalance 的账户总余额口径。
- Web 用户资料：`GET /api/v1/user/profile`
- Web 使用错误列表：`GET /api/v1/usage/errors`
- Web 使用错误详情：`GET /api/v1/usage/errors/{id}`

安全边界：

- FloatBalance 不读取浏览器 Cookie、localStorage、完整 API Key 或任何浏览器登录态。
- 公开仓库只提交接口契约、脱敏错误模型和配置说明。
- 本地运行时从系统凭据读取用户显式保存的账户级 Web token；`TRUE_SOTA_WEB_TOKEN` 或 `TRUE_SOTA_WEB_BEARER_TOKEN` 仅作为本机临时覆盖。

## 2. 已接入能力

### 2.1 Web 账户余额与错误

用户在“连接 TrueSOTA”面板中保存账户级 Web Bearer token，或后续 TrueSOTA 提供的只读监控 token 后，Tauri 后端会尝试调用：

```http
GET https://true-sota.com/api/v1/user/profile
Authorization: Bearer <explicit-account-or-monitor-token>
```

并显示账户级 `TrueSOTA` 余额球。

同时会尝试调用：

```http
GET https://true-sota.com/api/v1/usage/errors?page=1&page_size=20
Authorization: Bearer <explicit-account-or-monitor-token>
```

返回记录会被归一化为 `ErrorEvent`，再显示为 ErrorBall。

### 2.2 单 Key 探针处理

`GET /v1/usage` 只能反映某一把 API Key 的剩余额度。用户会同时使用多把 key，因此首版不再把 `TRUE_SOTA_API_KEY` 作为余额球来源。该接口仅保留在调研记录里，后续如要做“单 Key 健康检查”，应作为独立 Key 维度展示，不能混入账户总余额。

## 3. 运行方式

桌面端不会显示静态 demo 余额。未设置账户级 token 时只显示配置类 ErrorBall；设置凭证后每 30 秒自动刷新。

推荐方式：

1. 运行 `npm run tauri dev`。
2. 点击悬浮球工具栏里的齿轮按钮。
3. 粘贴账户级 Web token 或只读监控 token。
4. 点击“保存并刷新”。

临时环境变量覆盖：

```powershell
$env:TRUE_SOTA_WEB_TOKEN="你显式提供的 TrueSOTA Web Bearer token"
npm run tauri dev
```

注意：`TRUE_SOTA_WEB_TOKEN` 目前属于网页登录态能力，不建议长期作为生产方案。更好的做法是让 TrueSOTA 提供只读监控 token，或在用户自管后端里做最小权限代理。

## 4. ErrorBall 映射

| 来源 | 条件 | ErrorEvent category | severity |
| --- | --- | --- | --- |
| `/api/v1/user/profile` | token 缺失 | `config` | `warn` |
| `/api/v1/user/profile` | 401 / 403 | `auth` | `error` |
| `/api/v1/user/profile` | 429 | `rate_limit` | `warn` |
| `/api/v1/user/profile` | 5xx | `upstream` | `error` |
| `/api/v1/user/profile` | 超时 / DNS / 连接失败 | `network` | `error` |
| `/api/v1/usage/errors` | 返回记录 | 由 status/message 推断 | `warn` / `error` |

所有错误摘要走 `sanitizeSensitiveText`，会脱敏 Authorization、API Key、token、secret、cookie、password 和 `sk-*` 形式的密钥。
