import { createErrorEvent } from "./error-event";
import type { BalanceSnapshot, ErrorEvent } from "./types";

const now = () => Date.now();

export async function loadMockBalances(): Promise<BalanceSnapshot[]> {
  const updatedAt = now();

  return [
    {
      provider: "sub2",
      label: "Sub2",
      amount: 86.32,
      currency: "CNY",
      usedToday: 12.68,
      status: "ok",
      endpoint: "/v1/usage",
      updatedAt,
      cached: false,
    },
    {
      provider: "deepseek",
      label: "DeepSeek",
      amount: 110,
      currency: "CNY",
      usedToday: 4.91,
      status: "ok",
      endpoint: "/user/balance",
      updatedAt,
      cached: false,
    },
  ];
}

export async function loadSeedErrors(): Promise<ErrorEvent[]> {
  return Promise.all([
    createErrorEvent({
      source: "sota2api",
      repo: "truesota-sota2api",
      category: "upstream",
      severity: "error",
      title: "上游 502",
      message: "upstream returned 502: provider unavailable",
      endpoint: "/v1/usage",
      httpStatus: 502,
      traceId: "req_502_demo",
      suggestedAction: "检查上游 provider 可用性和代理重试策略。",
    }).then((event) => ({ ...event, count: 6 })),
    createErrorEvent({
      source: "insight",
      repo: "truesota-insight",
      category: "rate_limit",
      severity: "warn",
      title: "查询限流",
      message: "query returned 429: report service is throttled",
      endpoint: "/api/reports/usage",
      httpStatus: 429,
      traceId: "req_429_demo",
      suggestedAction: "降低轮询频率或检查缓存策略。",
    }).then((event) => ({ ...event, count: 2 })),
    createErrorEvent({
      source: "kiroking",
      repo: "truesota-kiroking",
      category: "runtime",
      severity: "critical",
      title: "自动化任务失败",
      message: "database task failed: connection pool exhausted",
      taskId: "kiroking-demo-task",
      suggestedAction: "检查任务队列、数据库连接池和最近一次部署。",
    }),
  ]);
}

export async function createClientNetworkError(): Promise<ErrorEvent> {
  return createErrorEvent({
    source: "client",
    category: "network",
    severity: "error",
    title: "余额刷新失败",
    message: "request timeout after 5000ms; authorization header present",
    endpoint: "/user/balance",
    suggestedAction: "保留缓存值，并检查代理或网络连通性。",
  });
}
