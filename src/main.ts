import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles.css";
import {
  compactErrorToken,
  sourceLabel,
  statusLabel,
} from "./error-ball-manager";
import { toSanitizedSummary } from "./error-event";
import { ErrorStore } from "./error-store";
import {
  createClientNetworkError,
  loadMockBalances,
} from "./mock-data";
import { loadTrueSotaProvider } from "./providers/truesota";
import type { AppPreferences, BalanceSnapshot, ErrorEvent } from "./types";

const PREF_KEY = "floatbalance.preferences.v2";
const CLICK_THROUGH_PREVIEW_MS = 8000;
const REFRESH_INTERVAL_MS = 30_000;
const DRAG_THRESHOLD_PX = 4;
const DRAG_CLICK_SUPPRESS_MS = 1200;

interface ViewState {
  balances: BalanceSnapshot[];
  errorStore: ErrorStore;
  preferences: AppPreferences;
  selectedFingerprint: string | null;
  copiedFingerprint: string | null;
  clickThrough: boolean;
  refreshing: boolean;
  providerMode: string;
  lastSyncedAt: number | null;
}

const defaultPreferences: AppPreferences = {
  collapsed: true,
  theme: "workbench",
  criticalOnly: false,
};

const state: ViewState = {
  balances: [],
  errorStore: new ErrorStore(),
  preferences: loadPreferences(),
  selectedFingerprint: null,
  copiedFingerprint: null,
  clickThrough: false,
  refreshing: false,
  providerMode: "demo providers",
  lastSyncedAt: null,
};

let refreshTimer: number | undefined;
let dragCandidate: { x: number; y: number } | null = null;
let dragStartRequested = false;
let suppressNextClick = false;

function loadPreferences(): AppPreferences {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}"),
    };
  } catch {
    return defaultPreferences;
  }
}

function savePreferences(): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(state.preferences));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function formatCurrency(balance: BalanceSnapshot): string {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: balance.currency,
      maximumFractionDigits: 2,
    }).format(balance.amount);
  } catch {
    return `${balance.amount.toFixed(2)} ${balance.currency}`;
  }
}

function formatClock(value: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function relativeTime(value: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function statusTone(balance: BalanceSnapshot): string {
  if (
    balance.cached ||
    balance.status === "offline" ||
    balance.status === "config_missing"
  ) {
    return "offline";
  }
  if (balance.status === "low" || balance.amount <= 10) return "low";
  return "ok";
}

function renderBalanceBalls(): string {
  return state.balances
    .map(
      (balance) => `
        <button class="balance-ball drag-surface ${statusTone(balance)}" data-provider="${balance.provider}" title="${escapeHtml(balance.label)} ${escapeHtml(balance.endpoint)}">
          <span class="balance-amount">${escapeHtml(formatCurrency(balance))}</span>
          <span class="balance-label">${escapeHtml(balance.label)}</span>
        </button>
      `,
    )
    .join("");
}

function renderErrorBalls(errors: ErrorEvent[]): string {
  if (errors.length === 0) {
    return '<span class="empty-signal drag-surface">OK</span>';
  }

  return errors
    .map(
      (event) => `
        <button
          class="error-ball drag-surface ${event.severity} ${event.status}"
          data-fingerprint="${event.fingerprint}"
          data-count="${event.count}"
          title="${escapeHtml(`${sourceLabel(event)} ${event.title}`)}"
          aria-label="${escapeHtml(`${event.title}, ${event.count} 次`)}"
        >
          ${escapeHtml(compactErrorToken(event))}
        </button>
      `,
    )
    .join("");
}

function renderDetail(selected: ErrorEvent | undefined): string {
  if (!selected || state.preferences.collapsed) return "";

  const copied = state.copiedFingerprint === selected.fingerprint;

  return `
    <section class="detail-drawer" aria-label="错误详情">
      <div class="detail-title">
        <div>
          <strong>${escapeHtml(sourceLabel(selected))} · ${escapeHtml(selected.title)}</strong>
          <span>${escapeHtml(statusLabel[selected.status])} · ${escapeHtml(selected.category)}</span>
        </div>
        <button class="icon-button" data-action="close-detail" title="收起详情" aria-label="收起详情">×</button>
      </div>
      <dl class="detail-grid">
        <dt>count</dt><dd>${selected.count}</dd>
        <dt>endpoint</dt><dd>${escapeHtml(selected.endpoint ?? "-")}</dd>
        <dt>first</dt><dd>${formatClock(selected.firstSeenAt)}</dd>
        <dt>last</dt><dd>${relativeTime(selected.lastSeenAt)}</dd>
      </dl>
      <p class="message">${escapeHtml(selected.sanitizedMessage)}</p>
      <div class="detail-actions">
        <button data-action="copy-error" data-fingerprint="${selected.fingerprint}">${copied ? "已复制" : "复制摘要"}</button>
        <button data-action="mute-error" data-fingerprint="${selected.fingerprint}">静音 30m</button>
        <button data-action="ack-error" data-fingerprint="${selected.fingerprint}">确认</button>
      </div>
    </section>
  `;
}

function renderMetrics(): string {
  if (state.preferences.collapsed) return "";

  return `
    <section class="metrics">
      ${state.balances
        .map(
          (balance) => `
            <div class="metric">
              <span>${escapeHtml(balance.label)}</span>
              <strong>${escapeHtml(formatCurrency(balance))}</strong>
              <small>${escapeHtml(balance.endpoint)} · used ${balance.usedToday.toFixed(2)}</small>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function render(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;

  const visibleErrors = state.errorStore.visible(state.preferences.criticalOnly);
  const selected =
    state.errorStore.find(state.selectedFingerprint) ?? visibleErrors[0] ?? undefined;
  const totalActive = state.errorStore
    .all()
    .filter((event) => event.status !== "resolved" && event.status !== "acknowledged")
    .reduce((count, event) => count + event.count, 0);

  document.body.dataset.theme = state.preferences.theme;
  document.body.dataset.collapsed = String(state.preferences.collapsed);
  document.body.dataset.clickThrough = String(state.clickThrough);

  root.innerHTML = `
    <main class="float-shell" data-tauri-drag-region>
      <header class="toolbar" data-tauri-drag-region>
        <div class="brand" data-tauri-drag-region>
          <span class="brand-mark">FB</span>
          <span class="brand-copy">
            <strong>FloatBalance</strong>
            <small>${totalActive} signals · ${state.refreshing ? "syncing" : state.providerMode}</small>
          </span>
        </div>
        <nav class="window-actions" aria-label="窗口操作">
          <button class="icon-button" data-action="refresh" title="刷新余额" aria-label="刷新余额">↻</button>
          <button class="icon-button" data-action="simulate-error" title="模拟网络错误" aria-label="模拟网络错误">!</button>
          <button class="icon-button" data-action="toggle-critical" title="仅严重错误" aria-label="仅严重错误">${state.preferences.criticalOnly ? "C" : "A"}</button>
          <button class="icon-button" data-action="toggle-theme" title="切换主题" aria-label="切换主题">◐</button>
          <button class="icon-button" data-action="toggle-collapse" title="折叠" aria-label="折叠">${state.preferences.collapsed ? "+" : "−"}</button>
          <button class="icon-button" data-action="click-through" title="临时穿透" aria-label="临时穿透">⌁</button>
          <button class="icon-button" data-action="hide-window" title="隐藏到托盘" aria-label="隐藏到托盘">×</button>
        </nav>
      </header>

      <section class="signal-row">
        <div class="balance-cluster" aria-label="余额浮球">
          ${renderBalanceBalls()}
        </div>
        <div class="error-cluster" aria-label="错误浮球">
          ${renderErrorBalls(visibleErrors)}
        </div>
      </section>

      ${renderMetrics()}
      ${renderDetail(selected)}

      <footer class="status-strip" data-tauri-drag-region>
        <span>${escapeHtml(state.providerMode)}</span>
        <span>${state.clickThrough ? `click-through ${CLICK_THROUGH_PREVIEW_MS / 1000}s` : state.lastSyncedAt ? `updated ${formatClock(state.lastSyncedAt)}` : "not synced"}</span>
      </footer>
    </main>
  `;

  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button));
  });

  document.querySelectorAll<HTMLElement>(".drag-surface").forEach((element) => {
    element.addEventListener("pointerdown", startDragCandidate);
    element.addEventListener("pointermove", requestWindowDrag);
    element.addEventListener("pointerup", clearDragCandidate);
    element.addEventListener("pointercancel", clearDragCandidate);
  });

  document.querySelectorAll<HTMLButtonElement>(".error-ball").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (suppressNextClick) {
        event.preventDefault();
        suppressNextClick = false;
        return;
      }
      state.selectedFingerprint = button.dataset.fingerprint ?? null;
      state.preferences.collapsed = false;
      savePreferences();
      render();
    });
  });
}

function startDragCandidate(event: PointerEvent): void {
  if (!isTauriRuntime() || event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("[data-no-drag], .window-actions, .detail-actions")) return;

  dragCandidate = { x: event.screenX, y: event.screenY };
  dragStartRequested = false;
}

function clearDragCandidate(): void {
  dragCandidate = null;
  dragStartRequested = false;
}

async function requestWindowDrag(event: PointerEvent): Promise<void> {
  if (!dragCandidate || dragStartRequested || event.buttons !== 1) return;

  const dx = Math.abs(event.screenX - dragCandidate.x);
  const dy = Math.abs(event.screenY - dragCandidate.y);
  if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;

  dragStartRequested = true;
  suppressNextClick = true;
  event.preventDefault();

  await getCurrentWindow().startDragging().catch(() => undefined);
  window.setTimeout(() => {
    clearDragCandidate();
    suppressNextClick = false;
  }, DRAG_CLICK_SUPPRESS_MS);
}

async function handleAction(button: HTMLButtonElement): Promise<void> {
  const action = button.dataset.action;

  if (action === "refresh") await refreshBalances();
  if (action === "simulate-error") await simulateClientError();
  if (action === "toggle-critical") toggleCriticalOnly();
  if (action === "toggle-theme") toggleTheme();
  if (action === "toggle-collapse") toggleCollapse();
  if (action === "click-through") await previewClickThrough();
  if (action === "hide-window") await hideWindow();
  if (action === "close-detail") {
    state.selectedFingerprint = null;
    render();
  }
  if (action === "copy-error") await copyError(button.dataset.fingerprint ?? null);
  if (action === "mute-error") muteError(button.dataset.fingerprint ?? null);
  if (action === "ack-error") acknowledgeError(button.dataset.fingerprint ?? null);
}

async function refreshBalances(): Promise<void> {
  if (state.refreshing) return;

  state.refreshing = true;
  render();
  const [mockBalances, trueSota] = await Promise.all([
    loadMockBalances(),
    loadTrueSotaProvider(),
  ]);
  const allowDemoBalances = !isTauriRuntime();

  state.balances = [
    ...trueSota.balances,
    ...(allowDemoBalances ? mockBalances : []),
  ];
  state.providerMode = trueSota.mode === "live"
    ? "TrueSOTA live"
    : allowDemoBalances
      ? "preview demo"
      : "setup needed";
  state.lastSyncedAt = Date.now();

  trueSota.errors.forEach((event) => {
    state.errorStore.upsert(event);
  });

  if (trueSota.errors.length === 0 && trueSota.balances.length > 0) {
    state.errorStore.markRecovering("truesota");
  }
  state.refreshing = false;
  render();
}

async function simulateClientError(): Promise<void> {
  const event = await createClientNetworkError();
  state.errorStore.upsert(event);
  state.selectedFingerprint = event.fingerprint;
  render();
}

function toggleCriticalOnly(): void {
  state.preferences.criticalOnly = !state.preferences.criticalOnly;
  savePreferences();
  render();
}

function toggleTheme(): void {
  state.preferences.theme =
    state.preferences.theme === "workbench" ? "night" : "workbench";
  savePreferences();
  render();
}

function toggleCollapse(): void {
  state.preferences.collapsed = !state.preferences.collapsed;
  savePreferences();
  render();
}

async function previewClickThrough(): Promise<void> {
  if (state.clickThrough) return;

  if (!isTauriRuntime()) {
    state.clickThrough = true;
    render();
    window.setTimeout(() => {
      state.clickThrough = false;
      render();
    }, CLICK_THROUGH_PREVIEW_MS);
    return;
  }

  try {
    await invoke("set_click_through", { enabled: true });
    state.clickThrough = true;
    render();

    window.setTimeout(async () => {
      await invoke("set_click_through", { enabled: false }).catch(() => undefined);
      state.clickThrough = false;
      render();
    }, CLICK_THROUGH_PREVIEW_MS);
  } catch {
    state.clickThrough = false;
    render();
  }
}

async function hideWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const appWindow = getCurrentWindow();
  await appWindow.hide().catch(() => undefined);
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function copyError(fingerprint: string | null): Promise<void> {
  const event = state.errorStore.find(fingerprint);
  if (!event) return;
  await navigator.clipboard.writeText(toSanitizedSummary(event));
  state.copiedFingerprint = event.fingerprint;
  render();
}

function muteError(fingerprint: string | null): void {
  if (!fingerprint) return;
  state.errorStore.mute(fingerprint, 30 * 60 * 1000);
  render();
}

function acknowledgeError(fingerprint: string | null): void {
  if (!fingerprint) return;
  state.errorStore.acknowledge(fingerprint);
  render();
}

async function init(): Promise<void> {
  state.errorStore = new ErrorStore();
  await refreshBalances();
  refreshTimer = window.setInterval(() => {
    refreshBalances().catch((error) => console.error(error));
  }, REFRESH_INTERVAL_MS);
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => console.error(error));
});

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
});
