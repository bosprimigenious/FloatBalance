export type BalanceProviderId = "sub2" | "deepseek";

export type BalanceStatus = "ok" | "low" | "offline" | "config_missing";

export interface BalanceSnapshot {
  provider: BalanceProviderId;
  label: string;
  amount: number;
  currency: "CNY" | "USD";
  usedToday: number;
  status: BalanceStatus;
  endpoint: string;
  updatedAt: number;
  cached: boolean;
}

export type ErrorSeverity = "info" | "warn" | "error" | "critical";
export type ErrorStatus =
  | "active"
  | "recovering"
  | "resolved"
  | "muted"
  | "acknowledged";

export type ErrorCategory =
  | "network"
  | "auth"
  | "quota"
  | "rate_limit"
  | "upstream"
  | "validation"
  | "runtime"
  | "deploy"
  | "config"
  | "unknown";

export type ErrorSource =
  | "client"
  | "sota2api"
  | "insight"
  | "kiroking"
  | "deepseek"
  | "sub2"
  | "proxy";

export interface ErrorEvent {
  id: string;
  fingerprint: string;
  source: ErrorSource;
  repo?: "truesota-sota2api" | "truesota-insight" | "truesota-kiroking";
  service?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  status: ErrorStatus;
  title: string;
  message: string;
  sanitizedMessage: string;
  rawMessageHash?: string;
  endpoint?: string;
  httpStatus?: number;
  traceId?: string;
  taskId?: string;
  accountRef?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  recoverAfterSuccessCount?: number;
  link?: string;
  suggestedAction?: string;
  mutedUntil?: number;
}

export interface ErrorEventInput {
  source: ErrorSource;
  repo?: ErrorEvent["repo"];
  service?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  status?: ErrorStatus;
  title: string;
  message: string;
  endpoint?: string;
  httpStatus?: number;
  traceId?: string;
  taskId?: string;
  accountRef?: string;
  link?: string;
  suggestedAction?: string;
}

export interface AppPreferences {
  collapsed: boolean;
  theme: "workbench" | "night";
  criticalOnly: boolean;
}
