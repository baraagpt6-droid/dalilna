import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stage_google_play_draft as stage


class DraftStagingTests(unittest.TestCase):
    def test_parses_exact_release_bundle_metadata(self):
        metadata = {
            "applicationId": "ye.dalilna.app",
            "elements": [{
                "versionCode": 4129001,
                "versionName": "3.1.0",
                "outputFile": "app-release.aab",
            }],
        }
        self.assertEqual(stage.parse_bundle_metadata(metadata), (4129001, "3.1.0"))

    def test_rejects_other_package(self):
        with self.assertRaises(ValueError):
            stage.parse_bundle_metadata({
                "applicationId": "com.hubaish.guide",
                "elements": [{"versionCode": 1, "versionName": "3.1.0"}],
            })

    def test_rejects_multiple_bundle_variants(self):
        with self.assertRaises(ValueError):
            stage.parse_bundle_metadata({
                "applicationId": "ye.dalilna.app",
                "elements": [
                    {"versionCode": 4129001, "versionName": "3.1.0"},
                    {"versionCode": 4129002, "versionName": "3.1.0"},
                ],
            })

    def test_draft_payload_is_pinned_to_closed_testing_preview(self):
        release = stage.build_draft_release(4129001, "3.1.0", "completed")
        self.assertEqual(release["status"], "completed")
        self.assertEqual(release["versionCodes"], ["4129001"])
        self.assertNotIn("userFraction", release)
        draft = stage.build_draft_release(4129001, "3.1.0", "draft")
        self.assertEqual(draft["status"], "draft")
        with self.assertRaises(ValueError):
            stage.validate_release_status("halted")

    def test_existing_draft_is_never_overwritten(self):
        with self.assertRaises(RuntimeError):
            stage.ensure_no_conflicting_drafts([
                {"status": "draft", "versionCodes": ["4128999"]}
            ], 4129001)
        with self.assertRaises(RuntimeError):
            stage.ensure_no_conflicting_drafts([
                {"status": "draft", "versionCodes": ["4129001"]}
            ], 4129001)

    def test_completed_releases_are_preserved(self):
        releases = [
            {"status": "completed", "versionCodes": ["4128701"]},
        ]
        stage.ensure_no_conflicting_drafts(releases, 4129001)
        self.assertEqual(releases[0]["versionCodes"], ["4128701"])



class FakeStageApi:
    def __init__(self, review_in_progress=False):
        self.review_in_progress = review_in_progress
        self.edit_counter = 0
        self.edits = {}
        self.persisted_releases = [
            {"name": "Dalilna 3.1.0", "versionCodes": ["4129001"], "status": "completed"}
        ]
        self.bundles = []
        self.calls = []
        self.commits = 0

    def request(self, method, path, *, body=None, params=None):
        self.calls.append((method, path, body, params))
        if method == "POST" and path.endswith("/edits"):
            self.edit_counter += 1
            edit_id = f"edit-{self.edit_counter}"
            self.edits[edit_id] = {"releases": [dict(item) for item in self.persisted_releases]}
            return {"id": edit_id}
        if method == "GET" and path.endswith("/tracks"):
            edit_id = path.split("/edits/")[1].split("/")[0]
            return {"tracks": [{
                "track": "Dalilna Closed Testing",
                "releases": self.edits[edit_id]["releases"]
            }]}
        if method == "GET" and path.endswith("/bundles"):
            return {"bundles": [dict(item) for item in self.bundles]}
        if method == "PUT" and path.endswith("/tracks/Dalilna%20Closed%20Testing"):
            edit_id = path.split("/edits/")[1].split("/")[0]
            self.edits[edit_id]["releases"] = [dict(item) for item in body["releases"]]
            return {"track": "Dalilna Closed Testing"}
        if method == "POST" and path.endswith(":validate"):
            return {}
        if method == "POST" and path.endswith(":commit"):
            self.commits += 1
            edit_id = path.split("/edits/")[1].split(":")[0]
            releases = self.edits[edit_id]["releases"]
            target = next(
                item for item in releases
                if "4129601" in {str(code) for code in item.get("versionCodes", [])}
            )
            if self.review_in_progress and target["status"] == "completed":
                raise stage.PlayApiError(
                    method, path, 400,
                    {"error": {
                        "message": "You already have changes in review.",
                        "details": [{"reason": "CHANGES_ALREADY_IN_REVIEW"}],
                    }}
                )
            self.persisted_releases = [dict(item) for item in releases]
            return {"id": edit_id}
        if method == "DELETE" and "/edits/" in path:
            return {}
        raise AssertionError(f"Unexpected API call {method} {path}")

    def upload(self, edit_path, aab_path):
        import hashlib
        digest = hashlib.sha256(aab_path.read_bytes()).hexdigest()
        self.bundles = [{"versionCode": 4129601, "sha256": digest}]
        return {"versionCode": 4129601, "sha256": digest}


def write_stage_inputs(directory):
    import json
    from pathlib import Path
    aab = Path(directory) / "app-release.aab"
    metadata = Path(directory) / "output-metadata.json"
    aab.write_bytes(b"fake signed bundle contents for staging unit tests")
    metadata.write_text(json.dumps({
        "applicationId": "ye.dalilna.app",
        "elements": [{
            "versionCode": 4129601,
            "versionName": "3.1.0",
            "outputFile": "app-release.aab",
        }],
    }), encoding="utf-8")
    return aab, metadata


class SmartStageIntegrationTests(unittest.TestCase):
    def test_stage_draft_path_publishes_completed_and_verifies_readback(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            aab, metadata = write_stage_inputs(directory)
            api = FakeStageApi()
            result = stage.stage_draft(api, aab, metadata)
        self.assertEqual(result["versionCode"], 4129601)
        self.assertEqual(result["releaseStatus"], "completed")
        self.assertTrue(result["availableToTesters"])
        self.assertTrue(result["readBackVerified"])
        self.assertFalse(result["reviewInProgressFallback"])
        self.assertEqual(api.persisted_releases[0]["versionCodes"], ["4129601"])
        self.assertTrue(any("tracks/Dalilna%20Closed%20Testing" in call[1] for call in api.calls))

    def test_stage_draft_path_retains_new_version_as_draft_during_active_review(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            aab, metadata = write_stage_inputs(directory)
            api = FakeStageApi(review_in_progress=True)
            result = stage.stage_draft(api, aab, metadata)
        self.assertEqual(result["releaseStatus"], "draft")
        self.assertFalse(result["availableToTesters"])
        self.assertTrue(result["reviewInProgressFallback"])
        completed = next(item for item in api.persisted_releases if item["status"] == "completed")
        draft = next(item for item in api.persisted_releases if item["status"] == "draft")
        self.assertEqual(completed["versionCodes"], ["4129001"])
        self.assertEqual(draft["versionCodes"], ["4129601"])
        commit_calls = [call for call in api.calls if call[0] == "POST" and call[1].endswith(":commit")]
        self.assertEqual(len(commit_calls), 2)
        self.assertTrue(all(call[3] == {"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"} for call in commit_calls))


if __name__ == "__main__":
    unittest.main()
