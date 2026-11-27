#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from google_play_closed_testing_draft import (
    PACKAGE_NAME,
    TRACK_NAME,
    VERSION_CODE,
    draft_release,
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
        self.assertEqual(release["versionCodes"], ["4128301"])
        self.assertNotIn("userFraction", release)
        self.assertNotIn("countryTargeting", release)

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
