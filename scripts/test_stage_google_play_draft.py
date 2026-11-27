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


if __name__ == "__main__":
    unittest.main()
