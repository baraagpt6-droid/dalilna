#!/usr/bin/env python3
"""Create an unsubmitted Google Play Closed Testing draft for Dalilna only.

Hard safety scope:
- package: ye.dalilna.app
- version: 3.1.0 / versionCode 3127701
- custom Closed Testing track: Dalilna Closed Testing
- release status: draft
- commit with changesNotSentForReview=true
- never call Production, rollout, send-for-review or deletion methods
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

import google.auth
import requests
from google.auth.transport.requests import Request


PACKAGE_NAME = "ye.dalilna.app"
VERSION_NAME = "3.1.0"
VERSION_CODE = 3127701
TRACK_NAME = "Dalilna Closed Testing"
SUPPORT_EMAIL = "dalilnasupport@gmail.com"
WEBSITE = "https://baraagpt6-droid.github.io/dalilna/store/"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD_ROOT = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
AAB_SHA256 = "1b62ceb401001f32e652b4e185ab12d794e8ea0202487561f56910f279539f04"

RELEASE_NOTES = {
    "ar": "• تحديث دليل الأماكن والبحث في المحافظات والمديريات.\n"
          "• تحسين عرض نتائج البحث ومعلومات الأماكن ووسائل التواصل.\n"
          "• تطوير السوق المشترك وإجراءات مراجعة الإعلانات.\n"
          "• تحديث معلومات الأسعار الاسترشادية والخصوصية.\n"
          "• تحسين الأداء والاستقرار وتجربة الاستخدام.",
    "en-US": "• Updated the Yemen places directory and governorate/district search.\n"
             "• Improved search results, place details and contact actions.\n"
             "• Updated the shared marketplace and listing moderation flow.\n"
             "• Refreshed indicative price and privacy information.\n"
             "• Improved performance, stability and usability."
}


def validate_target(package_name: str, version_code: int, track_name: str) -> None:
    if package_name != PACKAGE_NAME:
        raise ValueError(f"Refusing package {package_name!r}; only {PACKAGE_NAME} is permitted")
    if version_code != VERSION_CODE:
        raise ValueError(f"Refusing versionCode {version_code}; expected {VERSION_CODE}")
    if track_name != TRACK_NAME:
        raise ValueError(f"Refusing track {track_name!r}; expected {TRACK_NAME}")


def draft_release() -> dict:
    return {
        "name": "Dalilna Closed Testing — 3.1.0",
        "versionCodes": [str(VERSION_CODE)],
        "status": "draft",
        "releaseNotes": [
            {"language": language, "text": notes}
            for language, notes in RELEASE_NOTES.items()
        ],
    }


def validate_listing(listing: dict, language: str) -> None:
    for key in ("title", "shortDescription", "fullDescription"):
        value = listing.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{language}: missing {key}")
    limits = {"title": 30, "shortDescription": 80, "fullDescription": 4000}
    for key, limit in limits.items():
        if len(listing[key]) > limit:
            raise ValueError(f"{language}: {key} exceeds {limit} characters")
    if listing.get("language") != language:
        raise ValueError(f"{language}: language field does not match file locale")


class PlayApi:
    def __init__(self) -> None:
        credentials, _ = google.auth.default(scopes=[OAUTH_SCOPE])
        self.credentials = credentials
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def request(self, method: str, url: str, *, json_body=None, data=None,
                content_type: str | None = None, params=None, timeout=(30, 600)):
        if not self.credentials.valid:
            self.credentials.refresh(Request())
        headers = {"Authorization": f"Bearer {self.credentials.token}"}
        if content_type:
            headers["Content-Type"] = content_type
        response = self.session.request(
            method, url, json=json_body, data=data, headers=headers,
            params=params, timeout=timeout
        )
        if response.status_code == 401:
            self.credentials.refresh(Request())
            headers["Authorization"] = f"Bearer {self.credentials.token}"
            response = self.session.request(
                method, url, json=json_body, data=data, headers=headers,
                params=params, timeout=timeout
            )
        if not response.ok:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:1500]
            raise RuntimeError(f"Google Play API returned HTTP {response.status_code}: {detail}")
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text[:500]}

    def api(self, method: str, path: str, **kwargs):
        return self.request(method, f"{API_ROOT}{path}", **kwargs)

    def upload(self, path: str, file_path: Path, mime_type: str):
        with file_path.open("rb") as stream:
            return self.request(
                "POST", f"{UPLOAD_ROOT}{path}", data=stream,
                content_type=mime_type, params={"uploadType": "media"},
                timeout=(30, 600)
            )


def read_listing(root: Path, language: str) -> dict:
    path = root / "google-play" / "listings" / f"{language}.json"
    listing = json.loads(path.read_text(encoding="utf-8"))
    validate_listing(listing, language)
    return listing


def ensure_no_existing_images(api: PlayApi, package_path: str, edit_id: str,
                              locale: str, image_type: str) -> None:
    path = (
        f"{package_path}/edits/{quote(edit_id, safe='')}"
        f"/listings/{quote(locale, safe='')}/{quote(image_type, safe='')}"
    )
    response = api.api("GET", path)
    images = response.get("images", [])
    if images:
        raise RuntimeError(
            f"{locale}/{image_type} already has {len(images)} image(s). "
            "Nothing was removed or replaced. Inspect the listing in Play Console first."
        )


def upload_image_group(api: PlayApi, package_path: str, edit_id: str,
                       locale: str, image_type: str, image_paths: list[Path]) -> None:
    path = (
        f"{package_path}/edits/{quote(edit_id, safe='')}"
        f"/listings/{quote(locale, safe='')}/{quote(image_type, safe='')}"
    )
    ensure_no_existing_images(api, package_path, edit_id, locale, image_type)
    for image_path in image_paths:
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        api.upload(path, image_path, "image/png")
        print(f"Uploaded {locale}/{image_type}: {image_path.name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aab", required=True, type=Path)
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--testers-google-group", default="")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    validate_target(
        os.environ.get("PACKAGE_NAME", PACKAGE_NAME),
        int(os.environ.get("EXPECTED_VERSION_CODE", VERSION_CODE)),
        os.environ.get("PLAY_TRACK_NAME", TRACK_NAME),
    )

    if not args.aab.is_file():
        raise FileNotFoundError(args.aab)
    if not args.assets_dir.is_dir():
        raise FileNotFoundError(args.assets_dir)

    actual_hash = hashlib.sha256(args.aab.read_bytes()).hexdigest()
    if actual_hash != AAB_SHA256:
        raise ValueError(f"Pinned AAB SHA-256 mismatch: {actual_hash}")

    google_group = args.testers_google_group.strip()
    if google_group and not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", google_group):
        raise ValueError("Google Group address is not valid")

    assets = {
        "icon": [args.assets_dir / "icon.png"],
        "featureGraphic": [args.assets_dir / "feature-graphic.png"],
        "phoneScreenshots": sorted((args.assets_dir / "phone").glob("*.png")),
        "tenInchScreenshots": sorted((args.assets_dir / "tablet").glob("*.png")),
    }
    if any(not paths for paths in assets.values()):
        raise RuntimeError("One or more Play image groups are empty")
    if len(assets["phoneScreenshots"]) != 4 or len(assets["tenInchScreenshots"]) != 4:
        raise RuntimeError("Expected exactly four phone and four 10-inch tablet screenshots")

    api = PlayApi()
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"

    # Preflight: refuse duplicate/in-progress versions before opening an edit.
    # Only the exact custom closed-testing track is read.
    preflight = api.api("POST", f"{package_path}/edits", json_body={})
    edit_id = preflight["id"]
    committed = False
    try:
        tracks_path = f"{package_path}/edits/{quote(edit_id, safe='')}/tracks"
        tracks = api.api("GET", tracks_path).get("tracks", [])
        track = next((item for item in tracks if item.get("track") == TRACK_NAME), None)
        if track is None:
            api.api(
                "POST", tracks_path,
                json_body={
                    "track": TRACK_NAME,
                    "type": "CLOSED_TESTING",
                    "formFactor": "DEFAULT",
                },
            )
            current_releases = []
        else:
            current_releases = list(track.get("releases", []))

        for release in current_releases:
            versions = {str(code) for code in release.get("versionCodes", [])}
            if str(VERSION_CODE) in versions:
                raise RuntimeError(
                    f"versionCode {VERSION_CODE} already exists on the target track "
                    f"with status {release.get('status')!r}. No release was changed."
                )
            if release.get("status") == "draft":
                raise RuntimeError(
                    "The target track already has a draft release. Inspect it in Play Console first."
                )

        # App metadata and localized store listings.
        api.api(
            "PATCH",
            f"{package_path}/edits/{quote(edit_id, safe='')}/details",
            json_body={
                "defaultLanguage": "ar",
                "contactEmail": SUPPORT_EMAIL,
                "contactWebsite": WEBSITE,
            },
        )

        for locale in ("ar", "en-US"):
            listing = read_listing(root, locale)
            api.api(
                "PUT",
                f"{package_path}/edits/{quote(edit_id, safe='')}/listings/{quote(locale, safe='')}",
                json_body={
                    "language": locale,
                    "title": listing["title"],
                    "shortDescription": listing["shortDescription"],
                    "fullDescription": listing["fullDescription"],
                },
            )

        # Never delete or replace existing artwork. Stop if any image group is occupied.
        for locale in ("ar", "en-US"):
            for image_type, image_paths in assets.items():
                upload_image_group(api, package_path, edit_id, locale, image_type, image_paths)

        # Upload the exact signed AAB and verify Google's returned version code.
        bundle = api.upload(
            f"/applications/{quote(PACKAGE_NAME, safe='')}/edits/{quote(edit_id, safe='')}/bundles",
            args.aab,
            "application/octet-stream",
        )
        returned_version_code = int(bundle.get("versionCode", 0))
        if returned_version_code != VERSION_CODE:
            raise RuntimeError(
                f"Google returned versionCode {returned_version_code}; expected {VERSION_CODE}"
            )

        # Put only a draft release on the custom closed-testing track.
        # Preserve existing non-draft releases on that track.
        track_path = f"{tracks_path}/{quote(TRACK_NAME, safe='')}"
        track_after_upload = api.api("GET", track_path)
        releases = list(track_after_upload.get("releases", []))
        if any(release.get("status") == "draft" for release in releases):
            raise RuntimeError("A draft was detected during the edit. No existing draft was replaced.")
        releases.append(draft_release())
        api.api("PUT", track_path, json_body={"track": TRACK_NAME, "releases": releases})

        # Optional Google Groups. Individual email lists are intentionally not supported here.
        if google_group:
            testers_path = (
                f"{package_path}/edits/{quote(edit_id, safe='')}"
                f"/testers/{quote(TRACK_NAME, safe='')}"
            )
            existing = api.api("GET", testers_path).get("googleGroups", [])
            groups = sorted(set(existing) | {google_group})
            api.api("PUT", testers_path, json_body={"googleGroups": groups})

        # Validate, then commit as an unsent draft. Do not submit for review.
        api.api("POST", f"{package_path}/edits/{quote(edit_id, safe='')}:validate", json_body={})
        api.api(
            "POST",
            f"{package_path}/edits/{quote(edit_id, safe='')}:commit",
            params={
                "changesNotSentForReview": "true",
                "changesInReviewBehavior": "ERROR_IF_IN_REVIEW",
            },
            json_body={},
        )
        committed = True
        print(json.dumps({
            "result": "committed_unsubmitted_draft",
            "packageName": PACKAGE_NAME,
            "versionName": VERSION_NAME,
            "versionCode": VERSION_CODE,
            "track": TRACK_NAME,
            "releaseStatus": "draft",
            "googleGroupConfigured": bool(google_group),
            "productionTouched": False,
            "changesSentForReview": False,
            "existingImagesDeleted": False,
        }, ensure_ascii=False, indent=2))
    finally:
        if not committed:
            print(
                f"Play edit {edit_id} was not committed. It was left unsubmitted; "
                "nothing was rolled out and no existing assets were deleted.",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
