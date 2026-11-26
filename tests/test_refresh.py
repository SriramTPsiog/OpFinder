import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from refresh_opportunities import SOURCES, baseline, refresh

FIRST, SECOND = "2026-11-25T02:47:00Z", "2026-11-26T02:47:00Z"


def row(source, suffix):
    return {"title": suffix, "url": source["url"] + "#" + suffix, "institution": "Example",
            "country": "Sweden", "kind": "program", "field": "Electronics"}


class RefreshTests(unittest.TestCase):
    def test_first_failed_check_retains_reviewed_provenance(self):
        first = SOURCES[0]
        data = baseline({"reviewedOn": "2026-11-24", "sources": {first["id"]: [row(first, "old")]}})
        result = refresh(data, FIRST, lambda src: [] if src == first else [row(src, "discovered")])
        self.assertIsNone(data["checkedAt"])
        self.assertEqual(result["sources"][0]["state"], "reviewed")
        self.assertIsNone(result["sources"][0]["lastSuccessAt"])
        self.assertEqual(result["items"][0]["title"], "old")
        self.assertTrue(all(s["state"] == "ok" for s in result["sources"][1:]))

    def test_partial_failure_keeps_last_good_records_and_deduplicates_new_items(self):
        first, second = SOURCES[:2]
        data = baseline({"reviewedOn": "2026-11-24", "sources": {}})
        before = refresh(data, FIRST, lambda src: [row(src, "one")])

        def changes(src):
            if src == first:
                raise TimeoutError("fixture timeout")
            if src == second:
                return [row(src, "one"), row(src, "two"), row(src, "two")]
            return [row(src, "replacement")]

        after = refresh(before, SECOND, changes)
        self.assertEqual(after["sources"][0]["state"], "stale")
        self.assertEqual(after["sources"][0]["lastSuccessAt"], FIRST)
        items = [x for x in after["items"] if x["sourceId"] == second["id"]]
        self.assertEqual([x["firstSeenAt"] for x in items], [FIRST, SECOND])
        self.assertEqual([x["lastSeenAt"] for x in items], [SECOND, SECOND])
        self.assertEqual(items[0]["id"], before["items"][1]["id"])
