import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smart_publish_closed_testing as smart


VERSION_CODE = 4129001
SHA256 = "3e321203e6457ec44724b88d400c6ba4ffd21ec4884da46f0ff7d4b82d25e740"


class FakeApi:
    def __init__(self, review_in_progress=False, status="draft", digest=SHA256):
        self.review_in_progress = review_in_progress
        self.status = status
        self.digest = digest
        self.calls = []
        self.edit_counter = 0
        self.edits = {}
        self.commits = 0

    def request(self, method, path, *, body=None, params=None):
        self.calls.append((method, path, body, params))
        if method == "POST" and path.endswith("/edits"):
            self.edit_counter += 1
            edit_id = f"edit-{self.edit_counter}"
            self.edits[edit_id] = {
                "releases": [{"name": "Dalilna 3.1.0 preview", "versionCodes": [str(VERSION_CODE)], "status": self.status}],
                "bundles": [{"versionCode": VERSION_CODE, "sha256": self.digest}],
            }
            return {"id": edit_id}
        if method == "GET" and path.endswith("/tracks"):
            edit_id = path.split("/edits/")[1].split("/")[0]
            return {"tracks": [
                {"track": "Dalilna Closed Testing", "releases": self.edits[edit_id]["releases"]},
                {"track": "internal", "releases": [{"status": "completed", "versionCodes": ["4100101"]}]},
                {"track": "production", "releases": []},
            ]}
        if method == "GET" and path.endswith("/bundles"):
            edit_id = path.split("/edits/")[1].split("/")[0]
            return {"bundles": self.edits[edit_id]["bundles"]}
        if method == "PUT" and "/tracks/Dalilna%20Closed%20Testing" in path:
            edit_id = path.split("/edits/")[1].split("/")[0]
            self.edits[edit_id]["releases"] = body["releases"]
            return {"track": "Dalilna Closed Testing"}
        if method == "POST" and path.endswith(":validate"):
            return {}
        if method == "POST" and path.endswith(":commit"):
            self.commits += 1
            edit_id = path.split("/edits/")[1].split(":")[0]
            status = self.edits[edit_id]["releases"][0]["status"]
            if self.review_in_progress and status == "completed":
                payload = {
                    "error": {
                        "message": "You already have changes in review.",
                        "details": [{"reason": "CHANGES_ALREADY_IN_REVIEW"}],
                    }
                }
                raise smart.PlayApiError(method, path, 400, payload)
            self.status = status
            return {"id": edit_id}
        if method == "DELETE" and "/edits/" in path:
            return {}
        raise AssertionError(f"Unexpected request {method} {path}")


class SmartPublishTests(unittest.TestCase):
    def test_completed_is_committed_when_no_review_is_active(self):
        api = FakeApi(review_in_progress=False)
        result = smart.publish_existing_draft(api, VERSION_CODE, SHA256)
        self.assertEqual(result["releaseStatus"], "completed")
        self.assertFalse(result["reviewInProgressFallback"])
        self.assertTrue(result["readBackVerified"])
        self.assertEqual(api.status, "completed")
        self.assertEqual(api.commits, 1)

    def test_active_review_falls_back_to_persisted_draft_without_cancelling_review(self):
        api = FakeApi(review_in_progress=True)
        result = smart.publish_existing_draft(api, VERSION_CODE, SHA256)
        self.assertEqual(result["releaseStatus"], "draft")
        self.assertTrue(result["reviewInProgressFallback"])
        self.assertEqual(result["reviewConflictReason"], "CHANGES_ALREADY_IN_REVIEW")
        self.assertEqual(api.status, "draft")
        self.assertEqual(api.commits, 2)
        commit_calls = [call for call in api.calls if call[0] == "POST" and call[1].endswith(":commit")]
        self.assertEqual(len(commit_calls), 2)
        for call in commit_calls:
            self.assertEqual(call[3], {"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"})
        self.assertFalse(any("tracks/production" in call[1] for call in api.calls))

    def test_sha256_mismatch_never_changes_track(self):
        api = FakeApi(digest="0" * 64)
        with self.assertRaises(RuntimeError):
            smart.publish_existing_draft(api, VERSION_CODE, SHA256)
        self.assertEqual(api.commits, 0)
        self.assertFalse(any(call[0] == "PUT" for call in api.calls))

    def test_non_review_errors_are_not_swallowed(self):
        class BrokenApi(FakeApi):
            def request(self, method, path, *, body=None, params=None):
                if method == "POST" and path.endswith(":commit"):
                    raise smart.PlayApiError(
                        method, path, 403,
                        {"error": {"message": "Permission denied", "details": [{"reason": "ACCESS_DENIED"}]}}
                    )
                return super().request(method, path, body=body, params=params)
        api = BrokenApi()
        with self.assertRaises(smart.PlayApiError):
            smart.publish_existing_draft(api, VERSION_CODE, SHA256)

    def test_already_completed_matching_release_is_idempotent(self):
        api = FakeApi(status="completed")
        result = smart.publish_existing_draft(api, VERSION_CODE, SHA256)
        self.assertTrue(result["alreadyCompleted"])
        self.assertEqual(result["releaseStatus"], "completed")
        self.assertEqual(api.commits, 0)

    def test_release_state_transition_changes_only_the_requested_code(self):
        releases = [
            {"status": "completed", "versionCodes": ["4128701"], "name": "old"},
            {"status": "draft", "versionCodes": ["4129001"], "name": "new"},
        ]
        changed = smart.change_release_status(releases, VERSION_CODE, "completed")
        self.assertEqual(changed[0], releases[0])
        self.assertEqual(changed[1]["status"], "completed")
        self.assertEqual(releases[1]["status"], "draft")


if __name__ == "__main__":
    unittest.main()
