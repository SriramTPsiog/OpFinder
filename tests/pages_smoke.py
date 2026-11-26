"""Exercise the production build at a GitHub project subpath in desktop and mobile Chrome."""
import csv
import functools
import http.server
import os
import tempfile
import threading
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait

ROOT = Path(__file__).resolve().parents[1]


def check_view(url, downloads, width, height):
    options = webdriver.ChromeOptions()
    for flag in ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", f"--window-size={width},{height}"]:
        options.add_argument(flag)
    options.page_load_strategy = "eager"
    options.add_experimental_option("prefs", {"download.default_directory": str(downloads), "download.prompt_for_download": False})
    with webdriver.Chrome(options=options) as driver:
        wait = WebDriverWait(driver, 15)
        find = lambda css: driver.find_element(By.CSS_SELECTOR, css)
        if width < 500:
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": True})
        driver.get(url)
        wait.until(lambda d: "admissions desk" in find("h1").text.lower())
        assert driver.execute_script("return document.documentElement.scrollWidth <= innerWidth")
        find('nav a[href="#discover"]').click()
        wait.until(lambda d: find("h1").text == "Discover opportunities")
        assert driver.execute_script("return document.documentElement.scrollWidth <= innerWidth")
        source_choices = Select(find('select[data-filter="source"]')).options
        assert len(source_choices) >= 7
        rows = driver.find_elements(By.CSS_SELECTOR, ".wd-card")
        assert rows
        # Test whichever real listing this particular provider snapshot contains.
        name = rows[0].find_element(By.CSS_SELECTOR, "summary strong").text
        search = find('[data-filter="query"]')
        search.send_keys(name)
        wait.until(lambda d: find(".wd-card summary strong").text == name)
        find('[data-act="save"]').click()
        find('nav a[href="#applications"]').click()
        wait.until(lambda d: find("h1").text == "My applications")
        find(".wd-card summary").click()
        note = find("[data-note]")
        note.send_keys("Application documents checked")
        # Native date entry uses a browser-specific keyboard layout. Set the value
        # and dispatch the same change event a committed selection would send.
        driver.execute_script("arguments[0].value='2027-02-19'; arguments[0].dispatchEvent(new Event('change',{bubbles:true}))", find("[data-deadline]"))
        Select(find("[data-stage]")).select_by_value("drafting")
        driver.refresh()
        wait.until(lambda d: find("h1").text == "My applications")
        find(".wd-card summary").click()
        assert find("[data-note]").get_attribute("value") == "Application documents checked"
        assert find("[data-deadline]").get_attribute("value") == "2027-02-19"
        assert Select(find("[data-stage]")).first_selected_option.get_attribute("value") == "drafting"
        find('[data-act="csv"]').click()
        exported = downloads / "wafer-desk-applications.csv"
        wait.until(lambda d: exported.exists() and exported.stat().st_size > 0)
        with exported.open(encoding="utf-8-sig", newline="") as stream:
            record = next(csv.DictReader(stream))
            assert record["Title"] == name and record["Status"] == "Drafting"
        find('[data-act="calendar"]').click()
        cal = downloads / "wafer-desk-deadlines.ics"
        wait.until(lambda d: cal.exists() and cal.stat().st_size > 0)
        assert "DTSTART;VALUE=DATE:20270219" in cal.read_text(encoding="utf-8")
        find('nav a[href="#desk"]').click()
        wait.until(lambda d: find("h1").text.lower().endswith("admissions desk."))
        find('[data-act="brief"]').click()
        assert find(".wd-letter").text.strip()
        # Browser console may contain third-party branding warnings. Reject uncaught
        # application errors and module failures, which prevent core interactions.
        issues = [e for e in driver.get_log("browser") if e["level"] == "SEVERE" and
                  ("Uncaught" in e["message"] or "Failed to load module script" in e["message"])]
        assert not issues, issues
        print(f"Passed {width}x{height}: search, shortlist, stage, note, date, reload, CSV, iCalendar, briefing.")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        parent = Path(tmp)
        (parent / "OpFinder").symlink_to(ROOT / "site", target_is_directory=True)
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=parent)
        with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                for width, height in [(1280, 900), (390, 844)]:
                    destination = parent / f"downloads-{width}"
                    destination.mkdir()
                    check_view(f"http://127.0.0.1:{server.server_port}/OpFinder/", destination, width, height)
            finally:
                server.shutdown()


if __name__ == "__main__":
    main()
