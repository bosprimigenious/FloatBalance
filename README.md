# FloatBalance

FloatBalance 是一个跨平台桌面全局悬浮球项目，目标是在 Windows 和 macOS 上实时展示 Sub2 中转站、DeepSeek 账户余额，以及 TrueSOTA 相关服务的错误状态。

项目当前处于产品与技术方案阶段，仓库先开源沉淀 PRD、ErrorBall 技术方案、开发任务拆解和 HTML 预览。

## 文档

- [产品 PRD](docs/FloatBalance_PRD.md)
- [ErrorBall 技术文档](docs/FloatBalance_ErrorBall_TechSpec.md)
- [技术风险与开发任务拆解](docs/FloatBalance_Development_Plan.md)
- [技术调研与实现记录](docs/FloatBalance_Research.md)

## 本地开发

```powershell
npm install
npm run build
npm run tauri dev
```

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
