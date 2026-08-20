import { mergeErrorEvent, severityRank } from "./error-event";
import type { ErrorEvent } from "./types";

const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const STORAGE_KEY = "floatbalance.error-store.v1";

interface PersistedErrorStore {
  events: ErrorEvent[];
}

export class ErrorStore {
  private readonly events = new Map<string, ErrorEvent>();

  constructor(seed: ErrorEvent[] = []) {
    this.load();
    seed.forEach((event) => this.upsert(event));
  }

  upsert(event: ErrorEvent): ErrorEvent {
    const current = this.events.get(event.fingerprint);
    const shouldMerge =
      current && event.lastSeenAt - current.lastSeenAt <= DEDUP_WINDOW_MS;
    const next = shouldMerge ? mergeErrorEvent(current, event) : event;

    this.events.set(next.fingerprint, next);
    this.save();
    return next;
  }

  acknowledge(fingerprint: string): void {
    const event = this.events.get(fingerprint);
    if (!event) return;
    this.events.set(fingerprint, { ...event, status: "acknowledged" });
    this.save();
  }

  mute(fingerprint: string, durationMs: number): void {
    const event = this.events.get(fingerprint);
    if (!event) return;
    this.events.set(fingerprint, {
      ...event,
      status: "muted",
      mutedUntil: Date.now() + durationMs,
    });
    this.save();
  }

  markRecovering(source: ErrorEvent["source"]): void {
    for (const [fingerprint, event] of this.events) {
      if (event.source !== source || event.status !== "active") continue;
      this.events.set(fingerprint, {
        ...event,
        status: "recovering",
        lastSeenAt: Date.now(),
      });
    }
    this.save();
  }

  all(): ErrorEvent[] {
    const now = Date.now();
    return Array.from(this.events.values())
      .map((event) =>
        event.status === "muted" && event.mutedUntil && event.mutedUntil < now
          ? { ...event, status: "active" as const, mutedUntil: undefined }
          : event,
      )
      .sort((left, right) => {
        const severityDelta = severityRank[right.severity] - severityRank[left.severity];
        return severityDelta || right.lastSeenAt - left.lastSeenAt;
      });
  }

  visible(criticalOnly: boolean, limit = 3): ErrorEvent[] {
    return this.all()
      .filter((event) => event.status !== "resolved")
      .filter((event) => event.status !== "muted")
      .filter((event) => (criticalOnly ? event.severity === "critical" : true))
      .slice(0, limit);
  }

  find(fingerprint: string | null): ErrorEvent | undefined {
    if (!fingerprint) return undefined;
    return this.events.get(fingerprint);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedErrorStore;
      parsed.events.forEach((event) => this.events.set(event.fingerprint, event));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private save(): void {
    const payload: PersistedErrorStore = { events: Array.from(this.events.values()) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
