"""Scan each public opportunity index separately, keeping its last usable records on failure."""

import argparse
import hashlib
import json
import os
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from opportunity_sources import RESULT_HOSTS, SOURCES, fetch_source

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "opportunities.json"
SEED = ROOT / "data" / "starting-opportunities.json"
MAX_BYTES = 5 * 1024 * 1024


def permitted(url, hosts):
    parts = urlsplit(url)
    return (parts.scheme == "https" and parts.hostname in hosts
            and not parts.username and not parts.password and parts.port in (None, 443))


def reader_for(source):
    hosts = RESULT_HOSTS[source["id"]] | {urlsplit(source["url"]).hostname}

    class OfficialRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            if not permitted(newurl, hosts):
                raise ValueError("Redirect left the official provider")
            return super().redirect_request(request, fp, code, msg, headers, newurl)

    client = build_opener(OfficialRedirect())

    def read(url):
        if not permitted(url, hosts):
            raise ValueError("Unknown provider hostname")
        request = Request(url, headers={
            "User-Agent": "WaferDesk/1.0 (+https://github.com/SriramTPsiog/OpFinder)",
            "Accept": "text/html,application/xhtml+xml",
        })
        with client.open(request, timeout=12) as response:
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError("Response exceeds the document limit")
            return body.decode(response.headers.get_content_charset() or "utf-8", errors="replace")

    return read


def listing_id(url):
    return "feed-" + hashlib.sha256(url.rstrip("/").encode()).hexdigest()[:20]


def baseline(seed):
    items, sources = [], []
    for source in SOURCES:
        rows = seed["sources"].get(source["id"], [])
        sources.append({**source, "state": "reviewed", "count": len(rows),
                        "lastSuccessAt": None, "checkedAt": None})
        for row in rows:
            items.append({**row, "id": listing_id(row["url"]), "sourceId": source["id"],
                          "firstSeenAt": None, "lastSeenAt": None})
    return {"version": 1, "reviewedOn": seed["reviewedOn"], "checkedAt": None,
            "sources": sources, "items": items}


def refresh(previous, now, collect):
    prior_sources = {source["id"]: source for source in previous["sources"]}
    known = {item["id"]: item for item in previous["items"]}

    def scan(source):
        old = prior_sources.get(source["id"], {})
        try:
            rows = collect(source)
            if not rows:
                raise ValueError("No matching listings returned")
            seen = {}
            for row in rows:
                key = listing_id(row["url"])
                seen[key] = {**row, "id": key, "sourceId": source["id"],
                             "firstSeenAt": known.get(key, {}).get("firstSeenAt") or now,
                             "lastSeenAt": now}
            items = list(seen.values())
            state, success = "ok", now
        except Exception as error:
            print(f'{source["name"]}: {type(error).__name__}: {error}', file=sys.stderr)
            items = [item for item in known.values() if item["sourceId"] == source["id"]]
            success = old.get("lastSuccessAt")
            state = "stale" if success else "reviewed" if items else "unavailable"
        return {**source, "state": state, "count": len(items), "checkedAt": now,
                "lastSuccessAt": success}, items

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(scan, SOURCES))
    sources, distinct = [], {}
    for source, items in results:
        sources.append(source)
        for item in items:
            distinct.setdefault(item["id"], item)
    return {"version": 1, "reviewedOn": previous.get("reviewedOn"), "checkedAt": now,
            "sources": sources, "items": list(distinct.values())}


def load_previous(path, fallback):
    if path and path.is_file():
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if value.get("version") == 1 and isinstance(value["items"], list) and isinstance(value["sources"], list):
                if all(isinstance(r, dict) and "id" in r and "sourceId" in r for r in value["items"]):
                    return value
        except (ValueError, KeyError, AttributeError, TypeError):
            print("Unreadable earlier snapshot. Using reviewed listings.", file=sys.stderr)
    return fallback


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as tmp:
        json.dump(data, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
    os.replace(tmp.name, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--baseline-only", action="store_true", help="Use the reviewed list without fetching")
    args = parser.parse_args()
    seed = baseline(json.loads(SEED.read_text(encoding="utf-8")))
    data = load_previous(args.previous or args.output, seed)
    if not args.baseline_only:
        now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        data = refresh(data, now, lambda source: fetch_source(source, reader_for(source)))
    save(args.output, data)
    for source in data["sources"]:
        print(f'{source["name"]}: {source["count"]} listings ({source["state"]})')


if __name__ == "__main__":
    main()
