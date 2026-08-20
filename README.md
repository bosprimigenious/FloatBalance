# FloatBalance

FloatBalance 是一个跨平台桌面全局悬浮球项目，目标是在 Windows 和 macOS 上实时展示 Sub2 中转站、DeepSeek 账户余额，以及 TrueSOTA 相关服务的错误状态。

项目当前处于产品与技术方案阶段，仓库先开源沉淀 PRD、ErrorBall 技术方案、开发任务拆解和 HTML 预览。

## 文档

- [产品 PRD](docs/FloatBalance_PRD.md)
- [ErrorBall 技术文档](docs/FloatBalance_ErrorBall_TechSpec.md)
- [技术风险与开发任务拆解](docs/FloatBalance_Development_Plan.md)
- [技术调研与实现记录](docs/FloatBalance_Research.md)
- [TrueSOTA 接入记录](docs/FloatBalance_TrueSOTA_Integration.md)

## 本地开发

```powershell
npm install
npm run build
npm run tauri dev
```

接入 TrueSOTA 账户级余额与错误列表：

推荐在桌面端点击齿轮按钮打开“连接 TrueSOTA”，粘贴你显式授权的 Web Bearer token，或后续 TrueSOTA 提供的只读监控 token。可以粘贴裸 token，也可以粘贴 `Authorization: Bearer ...` 整段；FloatBalance 会自动清洗前缀，并把 token 存入本机系统凭据，不会回填显示，也不会写入仓库。

也可以临时用环境变量覆盖：

```powershell
$env:TRUE_SOTA_WEB_TOKEN="你显式提供的 TrueSOTA Web Bearer token"
npm run tauri dev
```

`TRUE_SOTA_WEB_TOKEN` 不会写入仓库；默认也不会读取浏览器 Cookie、localStorage 或任何浏览器登录态。

桌面端不会显示静态 demo 余额。未设置账户级 token 时只显示配置类 ErrorBall；设置后每 30 秒自动刷新账户总余额和错误列表。

Windows 安装包构建：

```powershell
$env:CARGO_HTTP_PROXY='http://127.0.0.1:7897'
npm run tauri build
```

## HTML 预览

- [PRD 交互预览](previews/FloatBalance_PRD_preview.html)
- [502 错误球](previews/FloatBalance_ErrorBall_502.html)
- [429 告警球](previews/FloatBalance_ErrorBall_429.html)
- [DB 严重错误球](previews/FloatBalance_ErrorBall_DB.html)

## 初始范围

- 桌面全局悬浮窗：余额球、错误球、折叠/展开、吸边、置顶。
- 余额数据源：Sub2 中转站账户、DeepSeek 账户。
- 错误数据源：`truesota-sota2api`、`truesota-insight`、`truesota-kiroking`。
- 错误能力：聚合、去重、分级、静音、复制脱敏摘要、恢复提示。

## 技术倾向

首版建议使用 Tauri 2 + Rust sidecar + TypeScript 前端：

- Tauri 负责跨平台窗口、系统托盘、权限边界和打包。
- Rust/Node sidecar 负责轮询、代理、日志解析和本地事件聚合。
- 前端负责悬浮球交互、错误详情面板和状态可视化。

## 开源协议

本仓库使用 MIT License。
