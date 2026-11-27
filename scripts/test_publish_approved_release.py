import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish_approved_release as publish


class PublishApprovedReleaseTests(unittest.TestCase):
    def test_requires_exact_manual_approval(self):
        with self.assertRaises(ValueError):
            publish.validate_approval("no", publish.PACKAGE_NAME, "4129001")

    def test_is_pinned_to_the_exact_dalilna_package(self):
        with self.assertRaises(ValueError):
            publish.validate_approval(
                publish.APPROVAL_PHRASE, "com.hubaish.guide", "4129001"
            )

    def test_requires_positive_numeric_version_code(self):
        for value in ("", "latest", "-1", "3.1.0"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    publish.validate_approval(
                        publish.APPROVAL_PHRASE, publish.PACKAGE_NAME, value
                    )

    def test_promotes_only_the_exact_draft_and_preserves_other_releases(self):
        releases = [
            {"status": "completed", "versionCodes": ["4128701"], "name": "live"},
            {"status": "draft", "versionCodes": ["4129001"], "name": "preview"},
        ]
        result = publish.promote_draft(releases, 4129001)
        self.assertEqual(result[0], releases[0])
        self.assertEqual(result[1]["status"], "completed")
        self.assertEqual(releases[1]["status"], "draft")

    def test_refuses_already_completed_or_missing_releases(self):
        with self.assertRaises(RuntimeError):
            publish.promote_draft([
                {"status": "completed", "versionCodes": ["4129001"]}
            ], 4129001)
        with self.assertRaises(RuntimeError):
            publish.promote_draft([], 4129001)

    def test_refuses_ambiguous_duplicate_version_codes(self):
        with self.assertRaises(RuntimeError):
            publish.promote_draft([
                {"status": "draft", "versionCodes": ["4129001"]},
                {"status": "draft", "versionCodes": ["4129001"]},
            ], 4129001)


if __name__ == "__main__":
    unittest.main()
