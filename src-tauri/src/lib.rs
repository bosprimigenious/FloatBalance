use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};

const TRUE_SOTA_DEFAULT_BASE_URL: &str = "https://true-sota.com";
const TRUE_SOTA_CREDENTIAL_SERVICE: &str = "FloatBalance.TrueSOTA";
const TRUE_SOTA_WEB_TOKEN_ACCOUNT: &str = "account_web_token";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaRequest {
    base_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaCredentialSaveRequest {
    web_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrueSotaConfigStatus {
    web_token_configured: bool,
    web_token_source: Option<String>,
}

fn non_empty_env(names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| env::var(name).ok().filter(|value| !value.trim().is_empty()))
}

fn credential_entry(account: &str) -> Result<Entry, String> {
    Entry::new(TRUE_SOTA_CREDENTIAL_SERVICE, account)
        .map_err(|error| format!("failed to open system credential store: {error}"))
}

fn read_stored_credential(account: &str) -> Option<String> {
    credential_entry(account)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .filter(|value| !value.trim().is_empty())
}

fn strip_bearer_prefix(value: &str) -> Option<&str> {
    let trimmed = value.trim_start();
    let prefix = trimmed.get(..6)?;
    if !prefix.eq_ignore_ascii_case("bearer") {
        return None;
    }

    let rest = trimmed.get(6..)?;
    if rest.chars().next().is_some_and(char::is_whitespace) {
        return Some(rest.trim());
    }

    None
}

fn normalize_bearer_token(value: &str) -> String {
    let mut token = value.trim().trim_matches(['"', '\'']).trim();

    if let Some((name, rest)) = token.split_once(':') {
        if name.trim().eq_ignore_ascii_case("authorization") {
            token = rest.trim();
        }
    }

    while let Some(stripped) = strip_bearer_prefix(token) {
        token = stripped;
    }

    token.trim().trim_matches(['"', '\'']).trim().to_string()
}

fn normalize_non_empty_token(value: String) -> Option<String> {
    let token = normalize_bearer_token(&value);
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn configured_web_token_source() -> Option<String> {
    if non_empty_env(&["TRUE_SOTA_WEB_TOKEN", "TRUE_SOTA_WEB_BEARER_TOKEN"]).is_some() {
        return Some("env".to_string());
    }
    if read_stored_credential(TRUE_SOTA_WEB_TOKEN_ACCOUNT).is_some() {
        return Some("credential".to_string());
    }
    None
}

fn true_sota_web_token() -> Option<String> {
    non_empty_env(&["TRUE_SOTA_WEB_TOKEN", "TRUE_SOTA_WEB_BEARER_TOKEN"])
        .and_then(normalize_non_empty_token)
        .or_else(|| {
            read_stored_credential(TRUE_SOTA_WEB_TOKEN_ACCOUNT).and_then(normalize_non_empty_token)
        })
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
    let web_token_source = configured_web_token_source();
    TrueSotaConfigStatus {
        web_token_configured: web_token_source.is_some(),
        web_token_source,
    }
}

#[tauri::command]
fn save_truesota_credentials(
    request: TrueSotaCredentialSaveRequest,
) -> Result<TrueSotaConfigStatus, String> {
    let web_token = normalize_bearer_token(&request.web_token);
    if web_token.is_empty() {
        return Err("TrueSOTA account token is empty".to_string());
    }

    credential_entry(TRUE_SOTA_WEB_TOKEN_ACCOUNT)?
        .set_password(&web_token)
        .map_err(|error| {
            format!("failed to save TrueSOTA token to system credential store: {error}")
        })?;

    Ok(truesota_config_status())
}

#[tauri::command]
fn clear_truesota_credentials() -> Result<TrueSotaConfigStatus, String> {
    if let Ok(entry) = credential_entry(TRUE_SOTA_WEB_TOKEN_ACCOUNT) {
        let _ = entry.delete_credential();
    }

    Ok(truesota_config_status())
}

#[tauri::command]
async fn fetch_truesota_web_profile(request: TrueSotaRequest) -> Result<Value, String> {
    let token = true_sota_web_token()
        .ok_or_else(|| "TrueSOTA account token is not configured".to_string())?;
    let base_url = true_sota_base_url(request);
    get_json_bearer(&format!("{base_url}/api/v1/user/profile"), &token)
        .await
        .map(|(_, json)| json)
}

#[tauri::command]
async fn fetch_truesota_web_errors(request: TrueSotaRequest) -> Result<Value, String> {
    let token = true_sota_web_token()
        .ok_or_else(|| "TrueSOTA account token is not configured".to_string())?;
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
            save_truesota_credentials,
            clear_truesota_credentials,
            fetch_truesota_web_profile,
            fetch_truesota_web_errors
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
