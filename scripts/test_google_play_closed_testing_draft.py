#!/usr/bin/env python3
import contextlib
import hashlib
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import google_play_closed_testing_draft as play_module

from google_play_closed_testing_draft import (
    PACKAGE_NAME,
    TRACK_NAME,
    VERSION_CODE,
    draft_release,
    prepare_closed_track_releases,
    inspect_play_state,
    validate_play_mode,
    validate_stage_only_inputs,
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
        self.assertEqual(release["versionCodes"], ["4128601"])
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
        self.assertEqual(updated[0]["versionCodes"], ["4128601"])
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
        self.assertEqual(updated[-1]["versionCodes"], ["4128601"])


    def test_play_mode_requires_exactly_one_action(self):
        validate_play_mode(True, False, False)
        validate_play_mode(False, True, False)
        validate_play_mode(False, False, True)
        with self.assertRaises(ValueError):
            validate_play_mode(False, False, False)
        with self.assertRaises(ValueError):
            validate_play_mode(True, True, False)
        with self.assertRaises(ValueError):
            validate_play_mode(True, False, True)
        with self.assertRaises(ValueError):
            validate_play_mode(False, True, True)

    def test_stage_only_requires_existing_edit_and_preserves_testers(self):
        validate_stage_only_inputs("13370413812168476918", "")
        with self.assertRaises(ValueError):
            validate_stage_only_inputs("", "")
        with self.assertRaises(ValueError):
            validate_stage_only_inputs("13370413812168476918", "dalilna-testers@example.com")

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
                            {"name": "Dalilna", "status": "draft", "versionCodes": ["4128601"]}
                        ]},
                    ]}
                if path.endswith("/bundles"):
                    return {"bundles": [{"versionCode": 4128601, "sha256": "abc", "size": 100}]}
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
        self.assertEqual(state["highestVersionCodeAcrossTracks"], 4128601)
        self.assertEqual(state["bundles"][0]["versionCode"], 4128601)
        self.assertEqual(state["testers"]["googleGroupCount"], 0)
        self.assertFalse(any(method in {"POST", "PUT", "PATCH", "DELETE"} for method, _ in fake.calls))

    def test_stage_only_updates_existing_edit_without_validate_or_commit(self):
        class FakeApi:
            def __init__(self):
                self.calls = []
                self.track_payload = None

            def api(self, method, path, **kwargs):
                self.calls.append((method, path, kwargs))
                if path.endswith("/edits/active-edit"):
                    return {"id": "active-edit"}
                if path.endswith("/tracks"):
                    return {"tracks": [
                        {"track": "internal", "releases": [
                            {"name": "Internal", "status": "completed", "versionCodes": ["4100101"]}
                        ]},
                        {"track": TRACK_NAME, "releases": [
                            {"name": "Previous draft", "status": "draft", "versionCodes": ["4128401"]}
                        ]},
                    ]}
                if path.endswith("/bundles"):
                    return {"bundles": []}
                if path.endswith("/testers/" + TRACK_NAME.replace(" ", "%20")):
                    return {"googleGroups": [], "allUsers": False}
                if path.endswith("/tracks/" + TRACK_NAME.replace(" ", "%20")) and method == "GET":
                    return {"releases": [
                        {"name": "Previous draft", "status": "draft", "versionCodes": ["4128401"]}
                    ]}
                if path.endswith("/tracks/" + TRACK_NAME.replace(" ", "%20")) and method == "PUT":
                    self.track_payload = kwargs.get("json_body")
                    return {}
                if method == "GET" and "/listings/" in path and any(
                    path.endswith("/" + image_type)
                    for image_type in ("icon", "featureGraphic", "phoneScreenshots", "tenInchScreenshots")
                ):
                    return {"images": [{"width": 512, "height": 512}]}
                return {}

            def upload(self, path, file_path, mime_type):
                self.calls.append(("UPLOAD", path, {"file": str(file_path), "mime": mime_type}))
                return {"versionCode": VERSION_CODE, "sha256": play_module.AAB_SHA256}

        fake = FakeApi()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            aab = root / "app-release.aab"
            aab.write_bytes(b"fake signed bundle for CLI test")
            assets = root / "assets"
            for folder in ("phone", "tablet"):
                (assets / folder).mkdir(parents=True)
            (assets / "icon.png").write_bytes(b"png")
            (assets / "feature-graphic.png").write_bytes(b"png")
            for index in range(4):
                (assets / "phone" / f"{index}.png").write_bytes(b"png")
                (assets / "tablet" / f"{index}.png").write_bytes(b"png")

            env = {
                "PACKAGE_NAME": PACKAGE_NAME,
                "EXPECTED_VERSION_CODE": str(VERSION_CODE),
                "PLAY_TRACK_NAME": TRACK_NAME,
            }
            argv = [
                "google_play_closed_testing_draft.py",
                "--stage-only",
                "--existing-edit-id", "active-edit",
                "--aab", str(aab),
                "--assets-dir", str(assets),
            ]
            fake_hash = hashlib.sha256(aab.read_bytes()).hexdigest()
            with mock.patch.object(play_module, "PlayApi", return_value=fake), \
                 mock.patch.object(play_module, "AAB_SHA256", fake_hash), \
                 mock.patch.dict(os.environ, env, clear=False), \
                 mock.patch.object(sys, "argv", argv), \
                 contextlib.redirect_stdout(io.StringIO()), \
                 contextlib.redirect_stderr(io.StringIO()):
                play_module.main()

        self.assertTrue(any(method == "UPLOAD" for method, _, _ in fake.calls))
        self.assertIsNotNone(fake.track_payload)
        closed = next(item for item in fake.track_payload["releases"] if item["status"] == "draft")
        self.assertEqual(closed["versionCodes"], [str(VERSION_CODE)])
        self.assertTrue(any(method == "GET" and path.endswith("/edits/active-edit") for method, path, _ in fake.calls))
        self.assertFalse(any(path.endswith(":commit") or path.endswith(":validate") for _, path, _ in fake.calls))
        self.assertFalse(any(method == "POST" and path.endswith("/edits") for method, path, _ in fake.calls))
        self.assertFalse(any(method == "PUT" and "/testers/" in path for method, path, _ in fake.calls))

    def test_stage_only_rejects_tester_changes(self):
        with self.assertRaises(ValueError):
            validate_stage_only_inputs("13370413812168476918", "dalilna-testers@example.com")

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
