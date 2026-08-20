# FloatBalance 技术调研与实现记录

版本：v0.1  
日期：2026-08-20  
状态：M1 骨架已实现

## 1. 调研结论

首版采用 Tauri 2 + Vanilla TypeScript + Vite。

原因：

- 符合 PRD 中“纯 HTML/CSS/JS，不引重框架”的约束。
- Tauri 2 支持透明窗口、无边框窗口、置顶、系统托盘和 Rust 命令。
- Vanilla TypeScript 能先把 ErrorEvent、ErrorStore、UI Manager 等契约落稳，后续再接真实数据源。

## 2. 已验证能力

| 能力 | 状态 | 证据 |
|---|---|---|
| 前端构建 | PASS | `npm run build` 通过 |
| Rust 编译 | PASS | `cargo check` 通过 |
| Windows release build | PASS | `npm run tauri build` 通过 |
| Windows 安装包 | PASS | 已生成 MSI 与 NSIS installer |
| 浏览器 UI 回归 | PASS | `scripts/visual_check.py` 通过 |
| 公开仓库 | PASS | `https://github.com/bosprimigenious/FloatBalance` |

## 3. 当前实现范围

### 3.1 Tauri 桌面骨架

- 无边框透明窗口。
- 置顶窗口。
- 跳过任务栏。
- 关闭窗口时隐藏到托盘，不直接退出。
- 托盘菜单支持显示、隐藏、退出。
- 接入 `tauri-plugin-window-state` 保存窗口状态。

### 3.2 前端悬浮球

- Sub2 与 DeepSeek mock 余额球。
- ErrorBall 错误簇，最多展示 3 个可见错误。
- 错误详情抽屉。
- 复制脱敏摘要。
- 静音 30 分钟。
- 确认错误。
- 仅严重错误过滤。
- 折叠模式。
- 深色/浅色主题切换。
- 临时点击穿透预览。
- 浏览器 fallback：普通 Vite 预览环境中不强依赖 Tauri runtime，便于 Playwright 回归测试。

### 3.3 ErrorEvent 契约

已实现：

- `ErrorEvent` 标准模型。
- `fingerprint` 生成。
- 10 分钟去重窗口。
- severity 排序。
- mute/ack/recovering 状态。
- token、Authorization、Cookie、API Key 等敏感字段脱敏。

## 4. 本地网络发现

本机 Git 全局代理配置指向 `localhost:7890`，但当前有效代理为 `127.0.0.1:7897`。

处理方式：

- FloatBalance 仓库本地 Git proxy 已配置为 `127.0.0.1:7897`。
- Cargo 拉 crates.io 需要设置 `CARGO_HTTP_PROXY=http://127.0.0.1:7897`。

不建议在项目里写死这个代理；它属于开发者本机环境。

## 5. 构建产物

Windows 构建产物路径：

```text
src-tauri/target/release/floatbalance.exe
src-tauri/target/release/bundle/msi/FloatBalance_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/FloatBalance_0.1.0_x64-setup.exe
```

视觉检查截图路径：

```text
test-results/floatbalance-visual-check.png
```

说明：`test-results/` 已加入 `.gitignore`，截图只作为本地验证证据，不进入开源仓库。

## 6. 未完成风险

| 风险 | 当前状态 | 下一步 |
|---|---|---|
| 真实 Sub2 / DeepSeek 接口字段 | 未接入 | 增加 BalanceProvider adapter |
| TrueSOTA API Key 余额 | 不作为首版余额来源 | `GET /v1/usage` 只能代表单 Key |
| TrueSOTA Web 账户余额 | 已接入 | 系统凭据账户 token 或 `TRUE_SOTA_WEB_TOKEN` + `GET /api/v1/user/profile` |
| TrueSOTA Web 错误列表 | 已接入 | 系统凭据账户 token 或 `TRUE_SOTA_WEB_TOKEN` + `GET /api/v1/usage/errors` |
| 密钥存储 | 已接入 | Rust `keyring` 写入系统凭据，前端只显示配置状态 |
| 点击穿透跨平台表现 | Windows build 已编译，未人工交互验收 | 启动 Tauri dev 进行桌面实测 |
| 自动更新/签名 | 未接入 | M5 处理 |

## 7. 下一步建议

进入 M2：

1. 抽象 `BalanceProvider` 接口，避免后续 Sub2 / DeepSeek / TrueSOTA 分支继续长在 UI 层。
2. 接入 DeepSeek balance adapter。
3. 将 `/api/v1/usage/errors/{id}` 接入详情面板。
4. 增加 ErrorBall 的单元测试和视觉回归测试。

## 8. 2026-08-20 TrueSOTA 自检

已登录页面：`https://true-sota.com/keys`

只读结果：

- 页面可见账户余额：已验证。出于公开仓库安全，不提交具体金额。
- API Key 使用脚本指向：`GET /v1/usage`，但它只代表单 Key，不适合作为平台总余额。
- 前端 Web API 基础路径：`/api/v1`
- 账户资料：`GET /api/v1/user/profile`
- 使用错误列表：`GET /api/v1/usage/errors`

安全判断：

- 浏览器登录 token 存在于前端认证流程中，但本项目不读取该值。
- 桌面端从系统凭据读取用户显式保存的账户级 Web token；`TRUE_SOTA_WEB_TOKEN` 只作为临时环境变量覆盖。
- 当前机器未保存账户级 token 时，直接运行会显示配置缺失 ErrorBall。
- 桌面端不显示静态 demo 余额；只有浏览器预览环境保留 Sub2 / DeepSeek demo 数据。
- 真实接入后每 30 秒自动轮询刷新。
