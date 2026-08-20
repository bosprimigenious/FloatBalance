import { invoke } from "@tauri-apps/api/core";
import { createErrorEvent } from "../error-event";
import type {
  BalanceSnapshot,
  ErrorCategory,
  ErrorEvent,
  ErrorSeverity,
} from "../types";

const DEFAULT_BASE_URL = "https://true-sota.com";
const WEB_PROFILE_ENDPOINT = "/api/v1/user/profile";
const WEB_ERRORS_ENDPOINT = "/api/v1/usage/errors";

export interface TrueSotaConfigStatus {
  webTokenConfigured: boolean;
  webTokenSource?: "env" | "credential";
}

export interface TrueSotaLoadResult {
  balances: BalanceSnapshot[];
  errors: ErrorEvent[];
  mode: "demo" | "partial" | "live";
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberFromValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringFromValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => asObject(current)?.[key], value);
}

function pickNumber(value: unknown, paths: string[][]): number | undefined {
  for (const path of paths) {
    const parsed = numberFromValue(getPath(value, path));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function pickString(value: unknown, paths: string[][]): string | undefined {
  for (const path of paths) {
    const parsed = stringFromValue(getPath(value, path));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const object = asObject(value);
  if (!object) return [];

  for (const key of ["items", "records", "list", "errors"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }

  return extractArray(object.data);
}

function httpStatusFromMessage(message: string): number | undefined {
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  if (!match) return undefined;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : undefined;
}

function classifyError(message: string, httpStatus?: number): ErrorCategory {
  const lower = message.toLowerCase();
  if (lower.includes("true_sota_api_key") || lower.includes("not set")) return "config";
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus === 429) return "rate_limit";
  if (httpStatus !== undefined && httpStatus >= 500) return "upstream";
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("dns") ||
    lower.includes("network") ||
    lower.includes("connect")
  ) {
    return "network";
  }
  if (lower.includes("json") || lower.includes("remaining")) return "validation";
  return "unknown";
}

function severityFor(category: ErrorCategory, httpStatus?: number): ErrorSeverity {
  if (httpStatus !== undefined && httpStatus >= 500) return "error";
  if (category === "config" || category === "rate_limit") return "warn";
  if (category === "auth" || category === "network" || category === "upstream") {
    return "error";
  }
  return "warn";
}

function titleFor(category: ErrorCategory, fallback = "TrueSOTA 同步失败"): string {
  if (category === "config") return "TrueSOTA 配置缺失";
  if (category === "auth") return "TrueSOTA 鉴权失败";
  if (category === "rate_limit") return "TrueSOTA 限流";
  if (category === "network") return "TrueSOTA 网络失败";
  if (category === "upstream") return "TrueSOTA 上游失败";
  if (category === "validation") return "TrueSOTA 响应解析失败";
  return fallback;
}

function inferRecordCategory(httpStatus: number | undefined, message: string): ErrorCategory {
  const lower = message.toLowerCase();
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus === 429 || lower.includes("rate") || lower.includes("限流")) {
    return "rate_limit";
  }
  if (httpStatus !== undefined && httpStatus >= 500) return "upstream";
  if (lower.includes("quota") || lower.includes("余额")) return "quota";
  if (lower.includes("timeout") || lower.includes("network")) return "network";
  if (lower.includes("database") || lower.includes("db")) return "runtime";
  return "unknown";
}

function inferRepo(record: Record<string, unknown>): ErrorEvent["repo"] | undefined {
  const text = [
    record.repo,
    record.repository,
    record.service,
    record.source,
    record.message,
    record.error,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (text.includes("sota2api")) return "truesota-sota2api";
  if (text.includes("insight")) return "truesota-insight";
  if (text.includes("kiroking")) return "truesota-kiroking";
  return undefined;
}

async function createProviderError(
  message: string,
  endpoint: string,
  suggestedAction: string,
): Promise<ErrorEvent> {
  const httpStatus = httpStatusFromMessage(message);
  const category = classifyError(message, httpStatus);

  return createErrorEvent({
    source: "truesota",
    repo: "truesota-sota2api",
    category,
    severity: severityFor(category, httpStatus),
    title: titleFor(category),
    message,
    endpoint,
    httpStatus,
    suggestedAction,
  });
}

async function normalizeWebErrorRecord(record: unknown): Promise<ErrorEvent | null> {
  const object = asObject(record);
  if (!object) return null;

  const httpStatus = pickNumber(object, [
    ["http_status"],
    ["httpStatus"],
    ["status_code"],
    ["statusCode"],
    ["status"],
  ]);
  const message =
    pickString(object, [["message"], ["error"], ["error_message"], ["detail"], ["reason"]]) ??
    "TrueSOTA usage error record did not include a message.";
  const title =
    pickString(object, [["title"], ["error_type"], ["type"], ["code"], ["model"]]) ??
    titleFor(inferRecordCategory(httpStatus, message), "TrueSOTA 错误记录");
  const endpoint =
    pickString(object, [["endpoint"], ["path"], ["request_path"], ["url"]]) ??
    WEB_ERRORS_ENDPOINT;
  const traceId = pickString(object, [["trace_id"], ["traceId"], ["request_id"], ["id"]]);
  const category = inferRecordCategory(httpStatus, message);

  return createErrorEvent({
    source: "truesota",
    repo: inferRepo(object),
    category,
    severity: severityFor(category, httpStatus),
    title,
    message,
    endpoint,
    httpStatus,
    traceId,
    suggestedAction: "在 TrueSOTA 使用记录或渠道状态页核对该请求。不要在摘要中粘贴完整密钥。",
  });
}

async function loadConfigStatus(): Promise<TrueSotaConfigStatus> {
  return invoke<TrueSotaConfigStatus>("truesota_config_status");
}

export async function loadTrueSotaConfigStatus(): Promise<TrueSotaConfigStatus> {
  if (!isTauriRuntime()) {
    return { webTokenConfigured: false };
  }

  return loadConfigStatus();
}

export async function saveTrueSotaAccountToken(
  webToken: string,
): Promise<TrueSotaConfigStatus> {
  return invoke<TrueSotaConfigStatus>("save_truesota_credentials", {
    request: { webToken },
  });
}

export async function clearTrueSotaAccountToken(): Promise<TrueSotaConfigStatus> {
  return invoke<TrueSotaConfigStatus>("clear_truesota_credentials");
}

async function loadAccountBalance(now: number): Promise<BalanceSnapshot | null> {
  const profile = await invoke<unknown>("fetch_truesota_web_profile", {
    request: { baseUrl: DEFAULT_BASE_URL },
  });
  const amount = pickNumber(profile, [
    ["balance"],
    ["data", "balance"],
    ["user", "balance"],
    ["data", "user", "balance"],
  ]);

  if (amount === undefined) return null;

  const frozen = pickNumber(profile, [
    ["frozen_balance"],
    ["data", "frozen_balance"],
    ["user", "frozen_balance"],
    ["data", "user", "frozen_balance"],
  ]);

  return {
    provider: "truesota",
    label: "TrueSOTA",
    amount,
    currency: "USD",
    usedToday: frozen ?? 0,
    status: amount <= 10 ? "low" : "ok",
    endpoint: WEB_PROFILE_ENDPOINT,
    updatedAt: now,
    cached: false,
  };
}

async function loadWebErrors(): Promise<ErrorEvent[]> {
  const response = await invoke<unknown>("fetch_truesota_web_errors", {
    request: { baseUrl: DEFAULT_BASE_URL },
  });
  const records = extractArray(response).slice(0, 12);
  const events = await Promise.all(records.map((record) => normalizeWebErrorRecord(record)));
  return events.filter((event): event is ErrorEvent => event !== null);
}

export async function loadTrueSotaProvider(): Promise<TrueSotaLoadResult> {
  const balances: BalanceSnapshot[] = [];
  const errors: ErrorEvent[] = [];
  const now = Date.now();

  if (!isTauriRuntime()) {
    errors.push(
      await createProviderError(
        "Tauri desktop runtime is unavailable; TrueSOTA live adapters run only inside the desktop app.",
        WEB_PROFILE_ENDPOINT,
        "使用 npm run tauri dev 或安装 Windows 桌面包运行。",
      ),
    );
    return { balances, errors, mode: "demo" };
  }

  let config: TrueSotaConfigStatus;
  try {
    config = await loadConfigStatus();
  } catch (error) {
    errors.push(
      await createProviderError(
        String(error),
        WEB_PROFILE_ENDPOINT,
        "检查 Tauri command 注册是否正常。",
      ),
    );
    return { balances, errors, mode: "partial" };
  }

  if (!config.webTokenConfigured) {
    errors.push(
      await createProviderError(
        "TrueSOTA account token is not configured.",
        WEB_PROFILE_ENDPOINT,
        "打开连接面板，保存你显式授权的 TrueSOTA 账户级 token 或只读监控 token。",
      ),
    );
    return { balances, errors, mode: "demo" };
  }

  if (config.webTokenConfigured) {
    try {
      const accountBalance = await loadAccountBalance(now);
      if (accountBalance) balances.push(accountBalance);
    } catch (error) {
      errors.push(
        await createProviderError(
          String(error),
          WEB_PROFILE_ENDPOINT,
          "可粘贴裸 token 或 Authorization: Bearer ...；若仍 401，说明 token 过期或没有账户接口权限。",
        ),
      );
    }

    try {
      errors.push(...(await loadWebErrors()));
    } catch (error) {
      errors.push(
        await createProviderError(
          String(error),
          WEB_ERRORS_ENDPOINT,
          "确认 TrueSOTA 账号是否允许访问使用错误记录。",
        ),
      );
    }
  }

  return {
    balances,
    errors,
    mode: balances.length > 0 ? "live" : "partial",
  };
}
