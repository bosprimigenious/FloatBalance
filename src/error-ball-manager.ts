import type { ErrorEvent, ErrorSeverity, ErrorStatus } from "./types";

export const severityLabel: Record<ErrorSeverity, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR",
  critical: "CRIT",
};

export const statusLabel: Record<ErrorStatus, string> = {
  active: "active",
  recovering: "recovering",
  resolved: "resolved",
  muted: "muted",
  acknowledged: "ack",
};

export function compactErrorToken(event: ErrorEvent): string {
  if (event.httpStatus) return String(event.httpStatus);
  if (event.category === "runtime") return "DB";
  if (event.category === "auth") return "401";
  if (event.category === "network") return "NET";
  return severityLabel[event.severity];
}

export function sourceLabel(event: ErrorEvent): string {
  if (event.repo === "truesota-sota2api") return "sota2api";
  if (event.repo === "truesota-insight") return "insight";
  if (event.repo === "truesota-kiroking") return "kiroking";
  return event.source;
}
