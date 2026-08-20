# FloatBalance 产品 PRD

版本：v0.2  
日期：2026-08-20  
结论：**建议先做技术风险梳理 + 开发任务拆解，再进入项目骨架**。当前需求里最容易返工的是窗口行为、密钥存储、跨平台差异、接口稳定性和错误事件归一化，不建议先搭骨架后补规则。

## 1. 产品概述

FloatBalance 是一个跨平台桌面悬浮球工具，面向需要频繁查看 Sub2 中转站、DeepSeek 账户余额，以及 TrueSOTA 相关服务错误状态的用户。它的目标不是做一个大而全的桌面应用，而是用极小的体积、极低的占用和尽量少的打扰，把余额和关键报错稳定地放在屏幕一角。

### 1.1 一句话定义
桌面常驻、可自定义样式、支持多账户和多错误源的状态悬浮球。

### 1.2 目标用户
- 需要随时查看余额的个人开发者
- 同时管理多个 Sub2 Key / DeepSeek 账号的重度用户
- 希望自定义外观、但不想用重型框架做桌面工具的用户

### 1.3 核心价值
- 一眼看到余额，不切页面
- 一眼看到报错，不翻日志
- 网络异常时不空白，始终有缓存值兜底
- 样式可定制，但仍然轻量

## 2. 产品原则

1. **Glance first**：先看数字，再看详情。  
2. **Non-intrusive**：默认不遮挡、不打断。  
3. **Local-first**：尽量在本地完成展示与缓存。  
4. **Fail-soft**：接口失败时退回缓存，不让 UI 断掉。  
5. **Small by default**：体积、内存、依赖都要克制。
6. **Error as signal**：报错不是弹窗噪音，而是可聚合、可确认、可追踪的状态信号。

## 3. 范围定义

### 3.1 P0 必须有
| 编号 | 能力 | 说明 |
|---|---|---|
| F1 | 全局置顶悬浮球 | 显示余额数字与状态 |
| F2 | Sub2 余额查询 | 对接 `/v1/usage` |
| F3 | DeepSeek 余额查询 | 对接 `/user/balance` |
| F4 | 自定义 CSS | 支持本地文件或直接粘贴 |
| F5 | 拖拽 / 折叠 / 穿透 | 作为桌面工具的基础交互 |
| F6 | 系统托盘常驻 | 关闭不退出 |
| F13 | 报错悬浮球 | 将余额查询、代理服务、TrueSOTA 服务报错聚合成可视化错误球 |
| F14 | 错误缓存与恢复态 | 网络断开或服务恢复中时显示最后一次错误和恢复状态 |

### 3.2 P1 建议有
| 编号 | 能力 | 说明 |
|---|---|---|
| F7 | 开机自启 | 提升使用频率 |
| F8 | 低余额提醒 | 变色 / 弹窗 / 托盘提示 |
| F9 | 多账户切换 | 多条 Sub2 Key / 多个 DeepSeek 账号 |
| F15 | 错误确认 / 静音 | 用户可确认、暂时静音、复制错误摘要 |
| F16 | 错误源管理 | 支持按服务启停错误源，如 `truesota-sota2api`、`truesota-insight`、`truesota-kiroking` |

### 3.3 P2 以后再做
| 编号 | 能力 | 说明 |
|---|---|---|
| F10 | 充值页跳转 | 低余额时导流 |
| F11 | 历史趋势 | 余额/用量趋势图 |
| F12 | 游戏模式 | 全屏应用自动降干扰 |

## 4. 推荐方案

### 4.1 结论
推荐 **Tauri + Rust + 纯 HTML/CSS/JS** 作为客户端，**Go 代理服务** 作为可选网络兜底层。

### 4.2 为什么不是先开骨架
先开骨架会把很多未定问题提前固化，尤其是：
- 最低支持的窗口能力
- Windows / macOS 的穿透与置顶差异
- 密钥环插件与本地配置边界
- 直连与代理模式的切换逻辑
- 自定义 CSS 的安全净化规则

这些内容一旦在骨架阶段写死，后面会反复返工。先把 PRD 冻住，再开骨架更稳。

## 5. 关键交互

### 5.1 悬浮球
- 默认只显示余额数字与一个状态点
- 单击展开设置 / 详情
- 双击折叠
- 拖拽移动
- 开启穿透后可点击透过

### 5.1.1 报错悬浮球
- 默认与余额球并列显示，也可折叠成一个错误角标
- 红色表示当前仍在失败，黄色表示降级或恢复中，灰色表示已确认
- 单击展开错误摘要：来源、级别、时间、次数、最近错误信息
- 支持复制错误摘要，便于发给开发者或贴进 issue / 飞书
- 支持“静音 30 分钟”“仅保留严重错误”“查看原始日志链接”

### 5.2 托盘
- 显示 / 隐藏
- 立即刷新
- 打开设置
- 开机自启开关
- 退出

### 5.3 设置面板
- 账号管理
- CSS 自定义
- 轮询间隔
- 告警阈值
- 代理模式
- 高级开关

## 6. 非功能需求

| 指标 | 目标 |
|---|---|
| 安装包 | ≤ 10MB |
| 常驻内存 | ≤ 80MB |
| 前端实现 | 纯 HTML/CSS/JS，不引重框架 |
| 密钥存储 | 不明文落盘 |
| 离线体验 | 显示上次缓存值 |
| 平台 | Windows 10/11 优先，兼容 macOS |

## 7. 技术风险

| 风险 | 影响 | 应对 |
|---|---|---|
| WebView 平台差异 | 窗口样式、透明度、穿透表现不一致 | 先做最小窗口原型，再补细节 |
| 密钥环插件行为差异 | 登录态、读写失败 | 敏感配置只落 keyRef，本地只存引用 |
| 接口字段变化 | 余额解析失败 | 响应适配层做容错 |
| 国内网络不稳定 | 请求超时、卡顿 | 直连 + 代理双模式 |
| 自定义 CSS 破坏 UI | 页面失真甚至不可用 | 做 CSS 净化和“重置默认样式” |
| 错误来源不统一 | Go/Python/桌面端错误格式不同 | 统一 `ErrorEvent` 模型和 Adapter |
| 错误过多造成打扰 | 高频错误刷屏 | 指纹去重、合并计数、静音、严重级别过滤 |
| 错误含敏感信息 | API Key、Token、URL 参数泄露 | 本地脱敏后再展示，复制摘要默认排除敏感字段 |
| 自动自启权限 | macOS / Windows 行为不一致 | 作为可选项，不作为首屏阻塞 |
| 多账户状态复杂 | UI 变拥挤 | 先做单主账号 + 切换器 |

## 8. 开发任务拆解

### 8.1 第一阶段：MVP
1. Tauri 客户端骨架
2. 透明置顶窗口
3. 悬浮球 UI
4. Sub2 / DeepSeek 余额拉取
5. 本地缓存
6. 托盘菜单
7. 关闭不退出
8. 错误事件模型 `ErrorEvent`
9. 基础错误浮球：请求失败、鉴权失败、网络失败

### 8.2 第二阶段：可用性
1. 自定义 CSS 文件加载
2. CSS 文本粘贴
3. CSS 净化
4. 鼠标穿透
5. 开机自启
6. 告警机制
7. 多屏位置记忆
8. 错误去重、合并计数、确认与静音
9. 错误详情抽屉和复制摘要

### 8.3 第三阶段：网络与分发
1. Go 代理服务
2. 直连 / 代理模式切换
3. 失败重试与退避
4. macOS 适配
5. 打包与签名
6. 发布说明与升级路径
7. TrueSOTA 仓库错误源接入：`truesota-sota2api`、`truesota-insight`、`truesota-kiroking`

## 9. 验收标准

- 启动后 3 秒内出现悬浮球
- 断网后仍显示最近一次余额缓存
- 用户可加载本地 CSS 并立即生效
- 用户可开启 / 关闭穿透与折叠
- 余额刷新失败时不出现空白页
- 密钥不写入普通配置文件
- 任何余额接口或代理接口失败时，错误浮球在 5 秒内出现或更新
- 同一错误 10 分钟内不会刷出多个独立浮球，而是合并计数
- 复制错误摘要时不包含 API Key、Authorization、Cookie、完整 token

## 10. 里程碑

| 阶段 | 目标 | 建议时长 |
|---|---|---|
| M0 | PRD 冻结 | 0.5 天 |
| M1 | 客户端骨架 + 基础悬浮球 | 1-2 周 |
| M2 | CSS / 托盘 / 告警 / 自启 | 2-3 周 |
| M3 | 代理模式 + macOS + 发布 | 1-2 周 |

## 11. 待确认问题

- Sub2 与 DeepSeek 的真实返回字段是否完全稳定
- 充值页地址是否统一，还是按账号分别配置
- 是否第一版就必须支持多账号排序
- 代理服务是否作为默认推荐方案
- 是否需要导出 / 导入配置
- 三个 TrueSOTA 仓库的实际错误来源是日志、HTTP health、CLI 输出、Sentry，还是数据库任务表
- 错误浮球是否只服务本机开发者，还是要支持团队共享/上报
- 错误静音规则是否需要跨设备同步

## 12. 建议执行顺序

1. 冻结 PRD
2. 先做最小可运行窗口原型
3. 再做账户与轮询
4. 然后补错误浮球、CSS、告警、托盘、自启
5. 最后上代理服务、TrueSOTA 错误源和发布

## 13. 报错悬浮球产品设计

### 13.1 产品定位

报错悬浮球是 FloatBalance 的第二核心视图。余额球告诉用户“还剩多少钱”，错误球告诉用户“现在哪里坏了”。它不替代日志系统，也不替代 Sentry/Prometheus，而是把和用户当前使用强相关的错误压缩成桌面可见信号。

### 13.2 错误来源

| 来源 | 预期错误 | 首版接入方式 |
|---|---|---|
| FloatBalance 客户端 | 网络超时、密钥缺失、解析失败、CSS 加载失败 | 本地事件总线 |
| Go 代理服务 / `truesota-sota2api` | 上游不可达、鉴权失败、限流、模型不可用 | HTTP health + 日志/接口 Adapter |
| Python 视图 / `truesota-insight` | 后端异常、数据为空、报表生成失败 | HTTP health + JSON 错误接口 |
| Python 自动化 / `truesota-kiroking` | 任务失败、脚本异常、外部 API 调用失败 | CLI 输出/日志 Adapter |

说明：当前三个 TrueSOTA 仓库尚未在本轮成功克隆，以上为产品接入边界；源码级接口需在仓库拉取后补齐。

### 13.3 错误级别

| 级别 | 颜色 | 触发条件 | UI 表现 |
|---|---|---|---|
| info | 蓝色 | 可忽略的状态变化 | 不弹出，仅详情可见 |
| warn | 黄色 | 降级、重试中、余额接近阈值 | 小错误球或角标 |
| error | 红色 | 当前功能失败但可恢复 | 独立错误球，显示计数 |
| critical | 深红 | 核心功能不可用或持续失败 | 置顶错误球 + 托盘提示 |

### 13.4 错误球状态

| 状态 | 含义 |
|---|---|
| active | 当前仍在失败 |
| recovering | 最近一次成功，但仍处于观察期 |
| resolved | 已恢复，仅保留历史 |
| muted | 用户主动静音 |
| acknowledged | 用户已确认，不再强提示 |

### 13.5 用户故事

- 作为开发者，我希望 Sub2 或 DeepSeek 请求失败时，桌面角落立刻出现错误球，而不是只能打开日志。
- 作为代理服务维护者，我希望同类 502 / 429 错误被合并计数，避免桌面刷屏。
- 作为重度用户，我希望错误摘要一键复制，并且不会泄露 API Key。
- 作为日常使用者，我希望已恢复的错误自动变灰或消失，而不是一直吓人。

### 13.6 首版验收

- 支持至少 5 类错误：网络、鉴权、限流、上游失败、响应解析失败
- 支持错误指纹去重：`source + category + endpoint + normalized_message`
- 支持错误计数与首次/最近出现时间
- 支持错误详情抽屉
- 支持复制脱敏摘要
- 支持按来源启停错误球

---

## 附录 A：HTML 原型源码

下面这份 HTML 是一个可直接打开的产品预览页，适合用来做早期评审。你可以把它单独保存为 `FloatBalance_PRD_preview.html`。

<details>
<summary>展开查看 HTML</summary>

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FloatBalance PRD Preview</title>
  <style>
    :root{
      --bg:#f4efe7; --panel:#fffaf2; --ink:#182129; --muted:#66717b;
      --line:#d8d1c5; --accent:#1b8a6b; --accent-2:#3156d3;
      --warn:#c37a00; --danger:#b43b3b; --shadow:0 20px 50px rgba(24,33,41,.10);
      --radius:8px;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      color:var(--ink);
      font:14px/1.45 "Bahnschrift","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
      background:
        linear-gradient(180deg, rgba(255,255,255,.56), rgba(255,255,255,.56)),
        radial-gradient(circle at 15% 10%, rgba(27,138,107,.08), transparent 28%),
        radial-gradient(circle at 85% 0%, rgba(49,86,211,.07), transparent 22%),
        linear-gradient(180deg, #f8f5ef, #efe8dd 72%, #ece3d4);
    }
    .page{max-width:1240px;margin:0 auto;padding:28px 24px 34px}
    .topbar{
      display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
      margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:14px
    }
    .brand h1{margin:0;font-size:28px;letter-spacing:.2px}
    .brand p{margin:4px 0 0;color:var(--muted)}
    .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
    .chip,.pill,.switch{
      border:1px solid var(--line);background:rgba(255,255,255,.78);
      border-radius:999px;padding:7px 10px;font-size:12px;box-shadow:0 1px 0 rgba(255,255,255,.55) inset
    }
    .chip strong{font-weight:700}
    .toolbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:10px}
    .btn{
      border:1px solid var(--line);background:var(--panel);color:var(--ink);
      border-radius:8px;padding:9px 12px;font:inherit;cursor:pointer;
      box-shadow:0 1px 0 rgba(255,255,255,.75) inset
    }
    .btn.active{border-color:color-mix(in srgb,var(--accent) 35%, var(--line));background:color-mix(in srgb,var(--accent) 8%, white)}
    .layout{display:grid;grid-template-columns:320px 1fr 320px;gap:16px;align-items:start}
    .panel{
      background:rgba(255,250,242,.82);backdrop-filter:blur(8px);
      border:1px solid rgba(216,209,197,.9);border-radius:var(--radius);
      box-shadow:var(--shadow);overflow:hidden
    }
    .panel-hd{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
    .panel-hd h2{margin:0;font-size:15px}
    .panel-bd{padding:16px}
    .ball-stage{padding:20px 16px 18px;text-align:center}
    .ball{
      width:170px;height:170px;margin:8px auto 16px;border-radius:50%;
      display:grid;place-items:center;position:relative;
      background:
        radial-gradient(circle at 35% 30%, rgba(255,255,255,.85), rgba(255,255,255,.08) 28%, rgba(255,255,255,0) 29%),
        radial-gradient(circle at 50% 45%, rgba(27,138,107,.98), rgba(24,33,41,.98) 72%);
      box-shadow:0 18px 35px rgba(24,33,41,.22), inset 0 0 0 1px rgba(255,255,255,.18);
      color:#f7f7f4;
    }
    .ball::after{
      content:"";position:absolute;inset:10px;border-radius:50%;
      border:1px solid rgba(255,255,255,.15)
    }
    .ball-amount{font-size:28px;font-weight:700;letter-spacing:.1px}
    .ball-sub{font-size:12px;opacity:.88;margin-top:2px}
    .status-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}
    .status{
      padding:6px 9px;border-radius:999px;border:1px solid var(--line);font-size:12px;background:#fff
    }
    .status.ok{color:var(--accent)}
    .status.warn{color:var(--warn)}
    .status.bad{color:var(--danger)}
    .stack{display:grid;gap:10px}
    .metric{
      border:1px solid var(--line);border-radius:var(--radius);background:#fff;padding:12px
    }
    .metric .k{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px;margin-bottom:8px}
    .metric .v{font-size:24px;font-weight:700}
    .metric .s{font-size:12px;color:var(--muted);margin-top:4px}
    .tabs{display:flex;gap:8px;flex-wrap:wrap}
    .tab{
      border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;
      font:inherit;font-size:12px;cursor:pointer
    }
    .tab.active{background:color-mix(in srgb,var(--accent) 9%, white);border-color:color-mix(in srgb,var(--accent) 40%, var(--line))}
    .tabpane{display:none;margin-top:14px}
    .tabpane.active{display:block}
    .field{display:grid;gap:6px;margin-bottom:12px}
    .field label{font-size:12px;color:var(--muted)}
    .field .value{padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:#fff}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .kv{padding:12px;border:1px solid var(--line);border-radius:8px;background:#fff}
    .kv b{display:block;font-size:16px;margin-top:3px}
    .section{margin-top:16px}
    .table{width:100%;border-collapse:collapse;font-size:12px}
    .table th,.table td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    .table th{color:var(--muted);font-weight:600}
    .roadmap{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .card{
      border:1px solid var(--line);border-radius:var(--radius);padding:14px;background:#fff
    }
    .card h3{margin:0 0 8px;font-size:14px}
    .card p{margin:0;color:var(--muted);font-size:12px}
    .footnote{margin-top:12px;color:var(--muted);font-size:12px}
    body[data-theme="night"]{
      --bg:#0f1419;--panel:#121a21;--ink:#eaf0f4;--muted:#95a2ad;--line:#25313c;
      --accent:#44c08d;--accent-2:#8ba5ff;--warn:#ffbc52;--danger:#ff7878;
      background:
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.03)),
        radial-gradient(circle at 18% 10%, rgba(68,192,141,.12), transparent 26%),
        radial-gradient(circle at 90% 0%, rgba(139,165,255,.11), transparent 20%),
        linear-gradient(180deg, #0f1419, #121a21 70%, #0d1217);
    }
    body[data-theme="night"] .panel,
    body[data-theme="night"] .metric,
    body[data-theme="night"] .card,
    body[data-theme="night"] .value,
    body[data-theme="night"] .status,
    body[data-theme="night"] .btn,
    body[data-theme="night"] .tab{background:#121a21;color:var(--ink)}
    body[data-theme="night"] .ball{
      background:
        radial-gradient(circle at 35% 30%, rgba(255,255,255,.16), rgba(255,255,255,.02) 28%, rgba(255,255,255,0) 29%),
        radial-gradient(circle at 50% 45%, rgba(68,192,141,.95), rgba(18,26,33,.96) 72%);
    }
    body[data-state="warning"] .ball{
      background:
        radial-gradient(circle at 35% 30%, rgba(255,255,255,.84), rgba(255,255,255,.08) 28%, rgba(255,255,255,0) 29%),
        radial-gradient(circle at 50% 45%, rgba(195,122,0,.98), rgba(24,33,41,.98) 72%);
    }
    body[data-state="offline"] .ball{
      background:
        radial-gradient(circle at 35% 30%, rgba(255,255,255,.84), rgba(255,255,255,.08) 28%, rgba(255,255,255,0) 29%),
        radial-gradient(circle at 50% 45%, rgba(180,59,59,.98), rgba(24,33,41,.98) 72%);
    }
    @media (max-width: 1100px){ .layout{grid-template-columns:1fr} .roadmap{grid-template-columns:1fr} }
  </style>
</head>
<body data-theme="paper" data-state="connected">
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <h1>FloatBalance</h1>
        <p>桌面全局悬浮球 · Sub2 / DeepSeek 余额一眼可见</p>
      </div>
      <div>
        <div class="chips">
          <span class="chip"><strong>模式</strong>：直连 + 代理兜底</span>
          <span class="chip"><strong>状态</strong>：最近刷新 3 分钟前</span>
          <span class="chip"><strong>体积目标</strong>：&lt; 10MB</span>
        </div>
        <div class="toolbar">
          <button class="btn active" data-state="connected">连接正常</button>
          <button class="btn" data-state="warning">低余额</button>
          <button class="btn" data-state="offline">离线</button>
          <button class="btn active" data-theme="paper">Paper</button>
          <button class="btn" data-theme="night">Night</button>
        </div>
      </div>
    </header>

    <main class="layout">
      <section class="panel">
        <div class="panel-hd">
          <h2>悬浮球预览</h2>
          <span class="pill">可拖拽 / 可折叠 / 可穿透</span>
        </div>
        <div class="ball-stage">
          <div class="ball">
            <div>
              <div class="ball-amount">￥86.32</div>
              <div class="ball-sub">Sub2 当前余额</div>
            </div>
          </div>
          <div class="status-row">
            <span class="status ok">Sub2 正常</span>
            <span class="status ok">DeepSeek 正常</span>
            <span class="status">托盘驻留</span>
          </div>
        </div>
        <div class="panel-bd stack">
          <div class="metric">
            <div class="k"><span>Sub2</span><span>接口 /v1/usage</span></div>
            <div class="v">86.32 CNY</div>
            <div class="s">今天已用 12.68，剩余额度可继续服务</div>
          </div>
          <div class="metric">
            <div class="k"><span>DeepSeek</span><span>接口 /user/balance</span></div>
            <div class="v">110.00 CNY</div>
            <div class="s">赠送余额 10.00，充值余额 100.00</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-hd">
          <h2>PRD 视图</h2>
          <span class="pill">优先级 / 风险 / 里程碑</span>
        </div>
        <div class="panel-bd">
          <div class="tabs">
            <button class="tab active" data-tab="overview">概览</button>
            <button class="tab" data-tab="accounts">账户</button>
            <button class="tab" data-tab="theme">主题</button>
            <button class="tab" data-tab="alerts">告警</button>
          </div>

          <div class="tabpane active" id="overview">
            <div class="grid2">
              <div class="kv"><span>定位</span><b>全局桌面余额悬浮球</b></div>
              <div class="kv"><span>建议技术栈</span><b>Tauri + Rust + 原生前端</b></div>
            </div>
            <div class="section">
              <table class="table">
                <thead><tr><th>优先级</th><th>功能</th><th>说明</th></tr></thead>
                <tbody>
                  <tr><td>P0</td><td>悬浮球 / 余额查询 / 自定义 CSS</td><td>第一版必须成立</td></tr>
                  <tr><td>P0</td><td>拖拽 / 穿透 / 托盘</td><td>桌面工具的基础体验</td></tr>
                  <tr><td>P1</td><td>自启 / 告警 / 多账户</td><td>提升常用性</td></tr>
                  <tr><td>P2</td><td>充值页 / 趋势图</td><td>后续增强项</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="tabpane" id="accounts">
            <div class="field"><label>Sub2 Key</label><div class="value">2 条启用 · 1 条备用</div></div>
            <div class="field"><label>DeepSeek 账号</label><div class="value">1 主账号 · 1 备用账号</div></div>
            <div class="field"><label>存储策略</label><div class="value">Key 进系统密钥环，普通配置进本地 JSON</div></div>
          </div>

          <div class="tabpane" id="theme">
            <div class="field"><label>CSS 来源</label><div class="value">default.css → 本地文件 → 粘贴代码</div></div>
            <div class="field"><label>安全规则</label><div class="value">过滤 @import、expression()、外链 url()</div></div>
            <div class="field"><label>恢复能力</label><div class="value">支持一键重置默认主题</div></div>
          </div>

          <div class="tabpane" id="alerts">
            <div class="field"><label>阈值</label><div class="value">Sub2 ≤ 10 元 / DeepSeek ≤ 5 元</div></div>
            <div class="field"><label>表现</label><div class="value">变色、托盘提示、可选弹窗</div></div>
            <div class="field"><label>失败策略</label><div class="value">接口失败时显示最近缓存，不打空白页</div></div>
          </div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-hd">
          <h2>风险与计划</h2>
          <span class="pill">先风险，再骨架</span>
        </div>
        <div class="panel-bd stack">
          <div class="metric">
            <div class="k"><span>Top Risk</span><span>跨平台窗口能力</span></div>
            <div class="s">置顶、穿透、透明、托盘在 Win / macOS 上的细节要先做最小验证。</div>
          </div>
          <div class="metric">
            <div class="k"><span>Top Risk</span><span>密钥存储</span></div>
            <div class="s">API Key 不能明文落盘，只存引用和必要配置。</div>
          </div>
          <div class="metric">
            <div class="k"><span>Milestone</span><span>建议顺序</span></div>
            <div class="s">PRD 冻结 → 最小窗口原型 → 账户 / 轮询 → CSS / 告警 / 托盘 → 代理服务。</div>
          </div>
          <div class="metric">
            <div class="k"><span>验收</span><span>第一版</span></div>
            <div class="s">启动快、常驻稳、余额清晰、断网有缓存、自定义样式可恢复。</div>
          </div>
        </div>
      </aside>
    </main>

    <section class="section">
      <div class="panel">
        <div class="panel-hd">
          <h2>开发节奏</h2>
          <span class="pill">M0 → M3</span>
        </div>
        <div class="panel-bd">
          <div class="roadmap">
            <div class="card"><h3>M0 · 冻结 PRD</h3><p>锁定范围、技术约束、验收口径。</p></div>
            <div class="card"><h3>M1 · 客户端骨架</h3><p>透明窗口、悬浮球、托盘、基础余额展示。</p></div>
            <div class="card"><h3>M2 · 体验层</h3><p>CSS、穿透、告警、自启、多屏记忆。</p></div>
          </div>
          <div class="footnote">建议先用这份页面做评审，确认视觉方向和范围，再进入代码仓库骨架。</div>
        </div>
      </div>
    </section>
  </div>

  <script>
    const root = document.body;
    const stateButtons = document.querySelectorAll('[data-state]');
    const themeButtons = document.querySelectorAll('[data-theme]');
    const tabs = document.querySelectorAll('.tab');
    const panes = document.querySelectorAll('.tabpane');

    stateButtons.forEach(btn => btn.addEventListener('click', () => {
      stateButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      root.dataset.state = btn.dataset.state;
    }));

    themeButtons.forEach(btn => btn.addEventListener('click', () => {
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      root.dataset.theme = btn.dataset.theme;
    }));

    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    }));
  </script>
</body>
</html>
```

</details>

## 附录 B：ErrorBall HTML 片段

下面是错误悬浮球的最小 DOM 结构，完整交互版见 `FloatBalance_PRD_preview.html`。

```html
<div class="error-cluster" aria-label="错误浮球预览">
  <button class="error-ball error" data-count="6" title="truesota-sota2api 上游 502">
    502
  </button>
  <button class="error-ball warn" data-count="2" title="truesota-insight 数据查询为空">
    429
  </button>
  <button class="error-ball critical" data-count="1" title="truesota-kiroking 自动化任务失败">
    DB
  </button>
</div>

<section class="error-detail">
  <h3>truesota-sota2api · 上游 502</h3>
  <dl>
    <dt>source</dt><dd>sota2api</dd>
    <dt>category</dt><dd>upstream</dd>
    <dt>count</dt><dd>6</dd>
    <dt>endpoint</dt><dd>/v1/usage</dd>
    <dt>message</dt><dd>upstream returned 502: provider unavailable</dd>
  </dl>
  <button>复制脱敏摘要</button>
  <button>静音 30 分钟</button>
</section>
```

```css
.error-cluster {
  display: flex;
  gap: 8px;
  align-items: center;
}

.error-ball {
  min-width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .45);
  color: #fff;
  font-weight: 700;
  position: relative;
}

.error-ball.warn {
  background: radial-gradient(circle at 35% 25%, #ffe4a3, #c37a00 64%, #503100);
}

.error-ball.error {
  background: radial-gradient(circle at 35% 25%, #ffb3b3, #b43b3b 64%, #4b1212);
}

.error-ball.critical {
  background: radial-gradient(circle at 35% 25%, #ffd0d0, #7f1d1d 62%, #260707);
}

.error-ball::after {
  content: attr(data-count);
  position: absolute;
  right: -2px;
  top: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fff;
  color: #b43b3b;
}
```
