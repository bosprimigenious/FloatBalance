# FloatBalance 技术风险与开发任务拆解

版本：v0.1  
日期：2026-08-20  
状态：开源初始化草案

## 1. 目标

FloatBalance 第一阶段要做成一个可以长期驻留桌面的全局悬浮球，用最小干扰展示账户余额和服务错误状态。

首版重点不是做完整监控平台，而是把“余额是否够用、服务是否异常、异常是否需要立刻处理”这三件事压缩成一个可扫视的桌面信号。

## 2. 技术风险

### R1. 桌面悬浮窗跨平台一致性

Windows 与 macOS 在置顶、透明窗口、拖拽、吸边、任务栏/菜单栏行为上差异明显。

建议：

- 首版优先 Tauri 2。
- 悬浮窗只做一个主窗口和一个详情窗口，避免多窗口生命周期过早复杂化。
- 用 Playwright 或平台截图做视觉回归，验证透明、置顶、点击穿透和缩放。

### R2. 余额接口认证与凭证安全

Sub2、DeepSeek 余额接口可能涉及 API Key、Cookie、反代地址或不同账号体系。

建议：

- 凭证只存在本机安全存储，不写入普通日志。
- 请求日志默认脱敏，只保留 provider、endpoint、status、latency、error category。
- PR 和 issue 模板明确禁止提交真实 token。

### R3. 错误来源不统一

`truesota-sota2api`、`truesota-insight`、`truesota-kiroking` 语言栈不同，错误形态也不同：HTTP、Python exception、数据库异常、限流、空数据都可能出现。

建议：

- 统一落到 `ErrorEvent` 模型。
- 每个仓库只写 adapter，不把 UI 逻辑塞进业务仓库。
- 首版用轮询和日志文件 tail，后续再接 webhook 或 SLS。

### R4. 错误噪声与误报

悬浮球如果频繁闪烁，会从“提醒”变成“打扰”。

建议：

- 必须实现去重窗口、静音、恢复状态。
- 同一 fingerprint 在短时间内只增长 count。
- UI 默认只显示最高优先级错误，展开后再看分组详情。

### R5. 开源边界

项目可以公开，但真实仓库地址、内部 endpoint、token、日志样例、业务数据都不能进入开源仓库。

建议：

- 提供 `config.example.json`，真实配置放本地 ignored 文件。
- 示例错误全部使用模拟数据。
- 文档里的 TrueSOTA 仓库只作为 adapter 目标，不写内部密钥和私有 URL。

## 3. 任务拆解

### M0. 开源仓库初始化

- 建立公开 GitHub 仓库 `FloatBalance`。
- 添加 README、PRD、ErrorBall 技术方案、开发计划。
- 添加 MIT License。
- 添加 HTML 预览文件。

验收：

- GitHub 仓库可访问。
- 本地 main 分支有初始 commit。
- README 能引导读者打开文档和预览。

### M1. 桌面应用骨架

- 初始化 Tauri 2 + TypeScript 前端。
- 实现单个透明悬浮窗。
- 支持拖拽、吸边、置顶、最小化到托盘。
- 添加本地模拟余额和模拟错误数据。

验收：

- Windows 本地可启动。
- 悬浮球能展示余额、错误计数和展开面板。
- 应用退出、重启后窗口位置可恢复。

### M2. 余额数据接入

- 设计 `BalanceProvider` 接口。
- 添加 Sub2 adapter。
- 添加 DeepSeek adapter。
- 实现轮询、超时、重试和缓存。

验收：

- 凭证缺失时显示配置缺失，不报崩溃。
- 接口失败时生成 ErrorEvent。
- 成功请求不会泄露 token 到日志。

### M3. ErrorBall 数据接入

- 设计 `ErrorEvent`、`ErrorSummary`、`RecoveryEvent`。
- 添加 `truesota-sota2api` adapter。
- 添加 `truesota-insight` adapter。
- 添加 `truesota-kiroking` adapter。
- 实现 fingerprint 去重、severity 排序、静音规则。

验收：

- 同类错误聚合到同一个球。
- 不同仓库错误可区分来源。
- 错误恢复后能降级或消失。

### M4. 交互与可用性打磨

- 每个错误球支持 hover tooltip、点击详情、复制脱敏摘要。
- 支持静音 30 分钟、1 小时、今天。
- 支持“仅严重错误浮窗提醒”。
- 支持深色/浅色跟随系统。

验收：

- 视觉在 100%、125%、150% 缩放下不重叠。
- 错误球文本不会溢出。
- 鼠标和键盘都能操作详情面板。

### M5. 打包与发布

- 添加 Windows 安装包。
- 添加 macOS app 构建脚本。
- 添加 GitHub Actions release workflow。
- 添加版本号与 changelog。

验收：

- main 分支构建通过。
- release 能产出可下载包。
- 本地配置不会被打包进产物。

## 4. ErrorBall HTML 文件映射

单独错误球 HTML 已拆分到 `previews/`：

- `FloatBalance_ErrorBall_502.html`：`truesota-sota2api` 上游 502。
- `FloatBalance_ErrorBall_429.html`：`truesota-insight` 查询为空或限流类告警。
- `FloatBalance_ErrorBall_DB.html`：`truesota-kiroking` 数据库或自动化任务严重错误。

这些 HTML 当前是设计与交互基准，不直接等同于最终 Tauri 实现。后续前端组件应以它们的状态、视觉层级和信息结构为参考。

## 5. 首个开发建议

建议下一步直接进入 M1：先搭 Tauri 桌面骨架，并把 HTML 预览中的悬浮球变成真实组件。

原因：

- PRD 和 ErrorBall 方案已经足够支撑首版交互。
- 桌面窗口行为是最大不确定性，应该尽早实测。
- 数据 adapter 可以先用 mock contract 驱动，不阻塞 UI 和窗口能力验证。
