import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import play_status_monitor as monitor


class FakeApi:
    def __init__(self):
        self.calls = []

    def request(self, method, path):
        self.calls.append((method, path))
        if method == "POST" and path.endswith("/edits"):
            return {"id": "temporary-edit"}
        if method == "GET" and path.endswith("/temporary-edit"):
            return {"id": "temporary-edit", "expiryTimeSeconds": "2099-01-01T00:00:00Z"}
        if method == "GET" and path.endswith("/tracks"):
            return {"tracks": [
                {"track": "Dalilna Closed Testing", "releases": [
                    {"name": "Dalilna preview", "status": "draft", "versionCodes": ["4128701"]}
                ]},
                {"track": "production", "releases": [
                    {"name": "Production release", "status": "completed", "versionCodes": ["4100101"]}
                ]},
            ]}
        if method == "GET" and path.endswith("/bundles"):
            return {"bundles": [{"versionCode": 4128701, "sha256": "abc", "size": 100}]}
        if method == "GET" and "/testers/" in path:
            return {"googleGroups": [], "allUsers": False}
        if method == "DELETE" and path.endswith("/temporary-edit"):
            return {}
        raise AssertionError(f"Unexpected API request: {method} {path}")


class PlayStatusMonitorTests(unittest.TestCase):
    def test_release_status_labels(self):
        self.assertIn("مسودة", monitor.arabic_status("draft"))
        self.assertIn("مكتمل", monitor.arabic_status("completed"))
        self.assertIn("متوقف", monitor.arabic_status("halted"))

    def test_flatten_releases_preserves_track_and_version_codes(self):
        rows = monitor.flatten_releases([
            {"track": "production", "releases": [
                {"status": "completed", "versionCodes": ["100", "101"]}
            ]}
        ])
        self.assertEqual(rows[0]["track"], "production")
        self.assertEqual(rows[0]["versionCodes"], [100, 101])

    def test_monitor_only_reads_then_deletes_its_temporary_edit(self):
        api = FakeApi()
        state = monitor.collect_play_state(api)
        methods = [method for method, _ in api.calls]
        self.assertEqual(methods[0], "POST")
        self.assertEqual(methods[-1], "DELETE")
        self.assertNotIn("PUT", methods)
        self.assertNotIn("PATCH", methods)
        self.assertEqual(state["packageName"], "ye.dalilna.app")
        self.assertEqual(state["closedTesting"]["latestRelease"]["status"], "draft")
        self.assertEqual(state["production"]["latestRelease"]["status"], "completed")
        self.assertTrue(state["temporaryEdit"]["deletedAfterInspection"])

    def test_summary_does_not_claim_to_know_review_queue_state(self):
        state = {
            "checkedAt": "2026-11-28T00:00:00+00:00",
            "packageName": "ye.dalilna.app",
            "repositoryVersion": {"versionName": "3.1.0", "versionCode": 4128801},
            "highestVersionCodeAcrossTracks": 4128701,
            "closedTesting": {
                "trackFound": True,
                "latestRelease": {"versionCodes": [4128701], "status": "draft"},
                "releases": [{"versionCodes": [4128701], "status": "draft"}],
                "draftCount": 1,
                "testerConfiguration": {
                    "googleGroupCount": 0, "allUsers": False,
                    "individualEmailListsReadable": False,
                },
            },
            "production": {"trackFound": True, "releases": [], "latestRelease": None},
        }
        summary = monitor.render_summary(state)
        self.assertIn("لا يعرضها Android Publisher Tracks API مباشرة", summary)
        self.assertIn("مسودة", summary)
        self.assertIn("لم يُنشر للمختبرين", summary)
        self.assertIn("لم يتم تعديل هذا المسار", summary)


if __name__ == "__main__":
    unittest.main()
