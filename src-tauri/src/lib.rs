use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};

const TRUE_SOTA_DEFAULT_BASE_URL: &str = "https://true-sota.com";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaRequest {
    base_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaConfigStatus {
    api_key_configured: bool,
    web_token_configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaUsageResponse {
    amount: f64,
    currency: String,
    unit: String,
    is_active: bool,
    endpoint: String,
    http_status: u16,
}

fn non_empty_env(names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| env::var(name).ok().filter(|value| !value.trim().is_empty()))
}

fn true_sota_base_url(request: TrueSotaRequest) -> String {
    request
        .base_url
        .or_else(|| non_empty_env(&["TRUE_SOTA_BASE_URL"]))
        .unwrap_or_else(|| TRUE_SOTA_DEFAULT_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn true_sota_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("FloatBalance/0.1.0")
        .build()
        .map_err(|error| format!("failed to build TrueSOTA HTTP client: {error}"))
}

fn value_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter().try_fold(value, |current, key| current.get(key))
}

fn value_as_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.replace(['$', ',', ' '], "").parse::<f64>().ok(),
        _ => None,
    }
}

fn pick_f64(value: &Value, paths: &[&[&str]]) -> Option<f64> {
    paths
        .iter()
        .find_map(|path| value_at(value, path).and_then(value_as_f64))
}

fn pick_string(value: &Value, paths: &[&[&str]]) -> Option<String> {
    paths
        .iter()
        .find_map(|path| value_at(value, path).and_then(Value::as_str))
        .map(str::to_string)
}

fn pick_bool(value: &Value, paths: &[&[&str]]) -> Option<bool> {
    paths
        .iter()
        .find_map(|path| value_at(value, path).and_then(Value::as_bool))
}

async fn get_json_bearer(url: &str, bearer: &str) -> Result<(u16, Value), String> {
    let client = true_sota_http_client()?;
    let response = client
        .get(url)
        .bearer_auth(bearer)
        .header("Accept", "application/json")
        .header("Accept-Language", "zh-CN")
        .send()
        .await
        .map_err(|error| format!("TrueSOTA request failed: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("TrueSOTA response read failed: {error}"))?;

    if !status.is_success() {
        return Err(format!("TrueSOTA {url} returned HTTP {}", status.as_u16()));
    }

    let json = serde_json::from_str::<Value>(&text)
        .map_err(|error| format!("TrueSOTA {url} returned invalid JSON: {error}"))?;
    Ok((status.as_u16(), json))
}

#[tauri::command]
fn truesota_config_status() -> TrueSotaConfigStatus {
    TrueSotaConfigStatus {
        api_key_configured: non_empty_env(&["TRUE_SOTA_API_KEY"]).is_some(),
        web_token_configured: non_empty_env(&["TRUE_SOTA_WEB_TOKEN", "TRUE_SOTA_WEB_BEARER_TOKEN"])
            .is_some(),
    }
}

#[tauri::command]
async fn fetch_truesota_usage(request: TrueSotaRequest) -> Result<TrueSotaUsageResponse, String> {
    let api_key = non_empty_env(&["TRUE_SOTA_API_KEY"])
        .ok_or_else(|| "TRUE_SOTA_API_KEY is not set".to_string())?;
    let base_url = true_sota_base_url(request);
    let endpoint = "/v1/usage";
    let url = format!("{base_url}{endpoint}");
    let (http_status, json) = get_json_bearer(&url, &api_key).await?;

    let amount = pick_f64(
        &json,
        &[
            &["remaining"],
            &["quota", "remaining"],
            &["balance"],
            &["data", "remaining"],
            &["data", "quota", "remaining"],
            &["data", "balance"],
        ],
    )
    .ok_or_else(|| {
        "TrueSOTA /v1/usage did not include remaining, quota.remaining, or balance".to_string()
    })?;
    let unit = pick_string(
        &json,
        &[
            &["unit"],
            &["quota", "unit"],
            &["currency"],
            &["data", "unit"],
            &["data", "quota", "unit"],
            &["data", "currency"],
        ],
    )
    .unwrap_or_else(|| "USD".to_string());
    let is_active = pick_bool(
        &json,
        &[&["is_active"], &["isValid"], &["data", "is_active"]],
    )
    .unwrap_or(true);

    Ok(TrueSotaUsageResponse {
        amount,
        currency: unit.to_uppercase(),
        unit,
        is_active,
        endpoint: endpoint.to_string(),
        http_status,
    })
}

#[tauri::command]
async fn fetch_truesota_web_profile(request: TrueSotaRequest) -> Result<Value, String> {
    let token = non_empty_env(&["TRUE_SOTA_WEB_TOKEN", "TRUE_SOTA_WEB_BEARER_TOKEN"])
        .ok_or_else(|| "TRUE_SOTA_WEB_TOKEN is not set".to_string())?;
    let base_url = true_sota_base_url(request);
    get_json_bearer(&format!("{base_url}/api/v1/user/profile"), &token)
        .await
        .map(|(_, json)| json)
}

#[tauri::command]
async fn fetch_truesota_web_errors(request: TrueSotaRequest) -> Result<Value, String> {
    let token = non_empty_env(&["TRUE_SOTA_WEB_TOKEN", "TRUE_SOTA_WEB_BEARER_TOKEN"])
        .ok_or_else(|| "TRUE_SOTA_WEB_TOKEN is not set".to_string())?;
    let base_url = true_sota_base_url(request);
    get_json_bearer(
        &format!("{base_url}/api/v1/usage/errors?page=1&page_size=20"),
        &token,
    )
    .await
    .map(|(_, json)| json)
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| error.to_string())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("FloatBalance")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "hide" => hide_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            truesota_config_status,
            fetch_truesota_usage,
            fetch_truesota_web_profile,
            fetch_truesota_web_errors
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
