from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "test-results" / "floatbalance-visual-check.png"


def main() -> None:
    SCREENSHOT.parent.mkdir(exist_ok=True)

    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 452, "height": 292})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        page.goto("http://127.0.0.1:1420")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector(".float-shell")

        assert page.locator(".balance-ball").count() == 2
        assert page.locator(".error-ball").count() == 3
        assert page.locator(".detail-drawer").is_visible()

        page.get_by_label("模拟网络错误").click()
        page.wait_for_selector(".error-ball:has-text('NET')")

        page.get_by_label("仅严重错误").click()
        assert page.locator(".error-ball").count() == 1

        page.get_by_label("折叠").click()
        assert page.locator(".detail-drawer").count() == 0

        shell_box = page.locator(".float-shell").bounding_box()
        assert shell_box is not None
        assert shell_box["width"] <= 452
        assert shell_box["height"] <= 292

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()

    if console_errors or page_errors:
        raise AssertionError(
            "Browser errors found:\n"
            + "\n".join(console_errors + page_errors)
        )

    print(f"visual check passed: {SCREENSHOT}")


if __name__ == "__main__":
    main()
