import type {
  ErrorEvent,
  ErrorEventInput,
  ErrorSeverity,
  ErrorStatus,
} from "./types";

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*)bearer\s+[a-z0-9._-]+/gi, "$1Bearer [REDACTED]"],
  [/(api[_-]?key\s*[:=]\s*)[a-z0-9._-]+/gi, "$1[REDACTED]"],
  [/(token\s*[:=]\s*)[a-z0-9._-]+/gi, "$1[REDACTED]"],
  [/(secret\s*[:=]\s*)[a-z0-9._-]+/gi, "$1[REDACTED]"],
  [/(cookie\s*[:=]\s*)[^;\n]+/gi, "$1[REDACTED]"],
  [/(password\s*[:=]\s*)[^\s&]+/gi, "$1[REDACTED]"],
  [/(sk-)[a-z0-9]{12,}/gi, "$1[REDACTED]"],
  [/([?&](?:key|token|secret|authorization)=)[^&\s]+/gi, "$1[REDACTED]"],
];

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export const severityRank: Record<ErrorSeverity, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

export const statusRank: Record<ErrorStatus, number> = {
  resolved: 0,
  acknowledged: 1,
  muted: 2,
  recovering: 3,
  active: 4,
};

export function sanitizeSensitiveText(value: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

export function normalizeForFingerprint(value: string): string {
  return sanitizeSensitiveText(value)
    .replace(UUID_PATTERN, "<uuid>")
    .replace(/\breq_[a-z0-9_-]+\b/gi, "req_<id>")
    .replace(/\btrace[_-]?[a-z0-9_-]+\b/gi, "trace_<id>")
    .replace(/\b\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/gi, "<time>")
    .replace(/\b\d{8,}\b/g, "<id>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function sha256(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function createErrorEvent(input: ErrorEventInput): Promise<ErrorEvent> {
  const now = Date.now();
  const sanitizedMessage = sanitizeSensitiveText(input.message);
  const normalized = normalizeForFingerprint(
    [input.source, input.category, input.endpoint ?? "", sanitizedMessage].join("|"),
  );
  const fingerprint = await sha256(normalized);

  return {
    ...input,
    id: `${input.source}-${fingerprint.slice(0, 12)}-${now}`,
    fingerprint,
    status: input.status ?? "active",
    sanitizedMessage,
    rawMessageHash: await sha256(input.message),
    firstSeenAt: now,
    lastSeenAt: now,
    count: 1,
  };
}

export function mergeErrorEvent(current: ErrorEvent, incoming: ErrorEvent): ErrorEvent {
  const severity =
    severityRank[incoming.severity] > severityRank[current.severity]
      ? incoming.severity
      : current.severity;
  const status =
    statusRank[incoming.status] > statusRank[current.status]
      ? incoming.status
      : current.status;

  return {
    ...current,
    ...incoming,
    id: current.id,
    firstSeenAt: current.firstSeenAt,
    lastSeenAt: incoming.lastSeenAt,
    count: current.count + incoming.count,
    severity,
    status,
    mutedUntil: current.mutedUntil,
  };
}

export function toSanitizedSummary(event: ErrorEvent): string {
  return [
    "[FloatBalance Error]",
    `source: ${event.source}`,
    `severity: ${event.severity}`,
    `status: ${event.status}`,
    `category: ${event.category}`,
    event.endpoint ? `endpoint: ${event.endpoint}` : undefined,
    event.httpStatus ? `http_status: ${event.httpStatus}` : undefined,
    `count: ${event.count}`,
    `first_seen: ${new Date(event.firstSeenAt).toISOString()}`,
    `last_seen: ${new Date(event.lastSeenAt).toISOString()}`,
    event.traceId ? `trace_id: ${sanitizeSensitiveText(event.traceId)}` : undefined,
    event.taskId ? `task_id: ${sanitizeSensitiveText(event.taskId)}` : undefined,
    `message: ${event.sanitizedMessage}`,
  ]
    .filter(Boolean)
    .join("\n");
}
