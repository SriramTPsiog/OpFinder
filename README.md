# Wafer Desk

[Open the admissions desk](https://sriramtpsiog.github.io/OpFinder/)

Discover master's programmes and scholarships in electronics, circuits and semiconductor engineering. Search six official indexes from HKU, Southampton, KTH and the Commonwealth Scholarship Commission, or browse the original 34 programme and funding profiles.

## Discover and track

- Use **Discover** to search by programme, funding body, country, field or source. Each record links to the provider. The source monitor displays check dates and identifies reviewed and cached copies.
- Open a title to see its details. Use **Shortlist** to add it to **My applications**, then add a note, a confirmed deadline or change the stage. Earlier browser saves use the same storage key. A saved entry remains available even if the provider removes it.
- Export the tracker to CSV. Export dated applications as an all-day calendar file. A personal deadline takes precedence over the provider date.
- The overview rotates curated picks and builds a daily briefing on the device. Usual application windows are estimates. Check the round, time zone and eligibility on the provider page.

## GitHub Pages

Choose **GitHub Actions** as the repository's Pages source. **Publish Wafer Desk** builds and publishes on pushes to `main`, on manual dispatch and daily at 02:47 UTC (08:17 India time). Use **Actions → Publish Wafer Desk → Run workflow** to run an extra scan. The browser's **Check latest snapshot** button reloads the published feed. An open tab checks for updates every 15 minutes.

The scanner keeps the previous copy of each unavailable provider. GitHub Actions restores the last scan from its cache or the published JSON. A separately labelled reviewed list can bootstrap a first run. The first and latest observed dates refer to the scanner, not the provider's publication date.

## Local use

With Node.js 24 and Python 3.10 or newer, run these from the repository root.

```sh
npm run pages:refresh
npm run pages:build
python -m http.server 8080 --directory site
```

Visit `http://localhost:8080/`. To build using only the reviewed fallback, run `npm run pages:build` on a clean checkout. The static build requires no npm package installation. The original TanStack server can also run with `npm install` followed by `npm run dev`. Its optional Grok briefing reads the API key on the server.

## Checks

```sh
python -m unittest discover -s tests
node --test tests/desk.test.mjs
```

The publishing workflow also tests desktop and mobile layouts, shortlist persistence, filters and both export formats in Chromium.
