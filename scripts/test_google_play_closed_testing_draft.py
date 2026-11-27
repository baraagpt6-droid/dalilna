#!/usr/bin/env python3
import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from google_play_closed_testing_draft import (
    PACKAGE_NAME,
    TRACK_NAME,
    VERSION_CODE,
    draft_release,
    prepare_closed_track_releases,
    inspect_play_state,
    validate_play_mode,
    validate_listing,
    validate_target,
)


class DraftSafetyTests(unittest.TestCase):
    def test_scope_is_pinned_to_dalilna(self):
        validate_target(PACKAGE_NAME, VERSION_CODE, TRACK_NAME)
        with self.assertRaises(ValueError):
            validate_target("com.hubaish.guide", VERSION_CODE, TRACK_NAME)
        with self.assertRaises(ValueError):
            validate_target("dalilna.com", VERSION_CODE, TRACK_NAME)
        with self.assertRaises(ValueError):
            validate_target(PACKAGE_NAME, 3127401, TRACK_NAME)
        with self.assertRaises(ValueError):
            validate_target(PACKAGE_NAME, VERSION_CODE, "production")

    def test_release_is_always_draft(self):
        release = draft_release()
        self.assertEqual(release["status"], "draft")
        self.assertEqual(release["versionCodes"], ["4128401"])
        self.assertNotIn("userFraction", release)
        self.assertNotIn("countryTargeting", release)

 
    def test_replaces_single_older_draft_and_preserves_other_track_releases(self):
        original = [
            {
                "name": "3127701 (3.1.0)",
                "versionCodes": ["3127701"],
                "status": "draft",
                "countryTargeting": {"countries": ["YE"], "includeRestOfWorld": False},
                "inAppUpdatePriority": 0,
            },
            {
                "name": "4100101 (3.1.0)",
                "versionCodes": ["4100101"],
                "status": "completed",
            },
        ]
        updated = prepare_closed_track_releases(original)
        self.assertEqual(updated[0]["versionCodes"], ["4128401"])
        self.assertEqual(updated[0]["status"], "draft")
        self.assertEqual(updated[0]["countryTargeting"], original[0]["countryTargeting"])
        self.assertEqual(updated[0]["inAppUpdatePriority"], 0)
        self.assertEqual(updated[1], original[1])
        self.assertEqual(original[0]["versionCodes"], ["3127701"])

    def test_multiple_existing_drafts_are_refused(self):
        releases = [
            {"versionCodes": ["3127701"], "status": "draft"},
            {"versionCodes": ["3127702"], "status": "draft"},
        ]
        with self.assertRaises(RuntimeError):
            prepare_closed_track_releases(releases)

    def test_existing_draft_above_target_is_refused(self):
        releases = [{"versionCodes": ["4128402"], "status": "draft"}]
        with self.assertRaises(RuntimeError):
            prepare_closed_track_releases(releases)

    def test_creates_new_draft_only_when_track_has_no_draft(self):
        completed = [{"versionCodes": ["4100101"], "status": "completed"}]
        updated = prepare_closed_track_releases(completed)
        self.assertEqual(len(updated), 2)
        self.assertEqual(updated[-1]["status"], "draft")
        self.assertEqual(updated[-1]["versionCodes"], ["4128401"])


    def test_play_mode_requires_exactly_one_action(self):
        validate_play_mode(True, False)
        validate_play_mode(False, True)
        with self.assertRaises(ValueError):
            validate_play_mode(False, False)
        with self.assertRaises(ValueError):
            validate_play_mode(True, True)

    def test_read_only_inspection_reuses_existing_edit_without_mutation(self):
        class FakeApi:
            def __init__(self):
                self.calls = []

            def api(self, method, path, **kwargs):
                self.calls.append((method, path))
                if path.endswith("/tracks"):
                    return {"tracks": [
                        {"track": "internal", "releases": [
                            {"name": "Internal", "status": "completed", "versionCodes": ["4100101"]}
                        ]},
                        {"track": TRACK_NAME, "releases": [
                            {"name": "Dalilna", "status": "draft", "versionCodes": ["4128401"]}
                        ]},
                    ]}
                if path.endswith("/bundles"):
                    return {"bundles": [{"versionCode": 4128401, "sha256": "abc", "size": 100}]}
                if "/testers/" in path:
                    return {"googleGroups": [], "allUsers": False}
                if path.endswith("/details"):
                    return {"defaultLanguage": "ar", "contactWebsite": "https://example.com", "contactEmail": "support@example.com"}
                if "/listings/" in path and path.rsplit("/", 1)[-1] in {"ar", "en-US"}:
                    return {"title": "Dalilna", "shortDescription": "short", "fullDescription": "full"}
                if any(path.endswith("/" + image_type) for image_type in ("icon", "featureGraphic", "phoneScreenshots", "tenInchScreenshots")):
                    return {"images": [{"width": 512, "height": 512}]}
                if path.endswith("/edits/active-edit"):
                    return {"id": "active-edit"}
                return {}

        fake = FakeApi()
        with contextlib.redirect_stdout(io.StringIO()):
            state = inspect_play_state(fake, "active-edit")
        self.assertTrue(state["inspectionOnly"])
        self.assertTrue(state["existingEditReused"])
        self.assertEqual(state["highestVersionCodeAcrossTracks"], 4128401)
        self.assertEqual(state["bundles"][0]["versionCode"], 4128401)
        self.assertEqual(state["testers"]["googleGroupCount"], 0)
        self.assertFalse(any(method in {"POST", "PUT", "PATCH", "DELETE"} for method, _ in fake.calls))

    def test_listing_limits(self):
        good = {
            "language": "ar",
            "title": "دليلنا — دليل اليمن",
            "shortDescription": "دليل المحلات والخدمات في اليمن.",
            "fullDescription": "وصف التطبيق.",
        }
        validate_listing(good, "ar")
        with self.assertRaises(ValueError):
            validate_listing(dict(good, shortDescription="x" * 81), "ar")


if __name__ == "__main__":
    unittest.main()
