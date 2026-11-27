#!/usr/bin/env python3
"""Create an unsubmitted Google Play Closed Testing draft for Dalilna only.

Hard safety scope:
- package: ye.dalilna.app
- version: 3.1.0 / versionCode 4128701
- custom Closed Testing track: Dalilna Closed Testing
- release status: draft
- inspection-only is supported and does not modify the app state
- any commit requires an explicit --submit-for-review flag and sends all changes for review
- never call Production, rollout, pricing or account-level access methods
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



PACKAGE_NAME = "ye.dalilna.app"
VERSION_NAME = "3.1.0"
VERSION_CODE = 4128701
TRACK_NAME = "Dalilna Closed Testing"
SUPPORT_EMAIL = "dalilnasupport@gmail.com"
WEBSITE = "https://baraagpt6-droid.github.io/dalilna/store/"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD_ROOT = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
AAB_SHA256 = "6e70daa8cdbdd93f9ce069223514bfb5129e2b462e9ff278f9cd91ef7ae24ca0"

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


def validate_stage_only_inputs(existing_edit_id: str, testers_google_group: str) -> None:
    # A fresh isolated edit is valid after the separate read-only preflight.
    # An optional existing edit is reused only if Google confirms it is active.
    if testers_google_group.strip():
        raise ValueError("--stage-only must preserve the existing tester configuration")


def validate_play_mode(inspect_only: bool, stage_only: bool, submit_for_review: bool) -> None:
    if sum((inspect_only, stage_only, submit_for_review)) != 1:
        raise ValueError(
            "Select exactly one mode: --inspect-only, --stage-only or --submit-for-review."
        )


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
        # Load network/auth dependencies only when a live API client is created.
        # Pure validation tests can import this module without Google credentials.
        import google.auth
        import requests
        from google.auth.transport.requests import Request

        self.Request = Request
        credentials, _ = google.auth.default(scopes=[OAUTH_SCOPE])
        self.credentials = credentials
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def request(self, method: str, url: str, *, json_body=None, data=None,
                content_type: str | None = None, params=None, timeout=(30, 600)):
        if not self.credentials.valid:
            self.credentials.refresh(self.Request())
        headers = {"Authorization": f"Bearer {self.credentials.token}"}
        if content_type:
            headers["Content-Type"] = content_type
        response = self.session.request(
            method, url, json=json_body, data=data, headers=headers,
            params=params, timeout=timeout
        )
        if response.status_code == 401:
            self.credentials.refresh(self.Request())
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
                              locale: str, image_type: str) -> bool:
    path = (
        f"{package_path}/edits/{quote(edit_id, safe='')}"
        f"/listings/{quote(locale, safe='')}/{quote(image_type, safe='')}"
    )
    response = api.api("GET", path)
    images = response.get("images", [])
    if images:
        dimensions = [
            {"width": item.get("width"), "height": item.get("height")}
            for item in images
        ]
        print("PLAY_IMAGE_GROUP_PRESERVED=" + json.dumps({
            "locale": locale,
            "imageType": image_type,
            "count": len(images),
            "dimensions": dimensions,
        }, ensure_ascii=False))
        return False
    return True


def upload_image_group(api: PlayApi, package_path: str, edit_id: str,
                       locale: str, image_type: str, image_paths: list[Path]) -> None:
    path = (
        f"{package_path}/edits/{quote(edit_id, safe='')}"
        f"/listings/{quote(locale, safe='')}/{quote(image_type, safe='')}"
    )
    if not ensure_no_existing_images(api, package_path, edit_id, locale, image_type):
        return
    for image_path in image_paths:
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        api.upload(path, image_path, "image/png")
        print(f"Uploaded {locale}/{image_type}: {image_path.name}")


def prepare_closed_track_releases(existing_releases: list[dict]) -> list[dict]:
    """Update one existing closed-track draft in place; preserve live releases."""
    releases = [dict(item) for item in existing_releases]
    draft_indexes = [
        index for index, release in enumerate(releases)
        if release.get("status") == "draft"
    ]
    if len(draft_indexes) > 1:
        raise RuntimeError(
            "The target track contains multiple draft releases. No release was changed."
        )

    replacement = draft_release()
    if not draft_indexes:
        return releases + [replacement]

    index = draft_indexes[0]
    existing = dict(releases[index])
    existing_codes = [int(code) for code in existing.get("versionCodes", [])]
    if any(code > VERSION_CODE for code in existing_codes):
        raise RuntimeError(
            f"The existing closed-track draft has a versionCode higher than {VERSION_CODE}. "
            "Refusing to replace it."
        )

    # Only replace the single unsubmitted draft with the newer verified AAB.
    # Keep other fields on the draft and all non-draft releases unchanged.
    existing.update({
        "name": replacement["name"],
        "versionCodes": replacement["versionCodes"],
        "status": "draft",
        "releaseNotes": replacement["releaseNotes"],
    })
    releases[index] = existing
    return releases


def inspect_play_state(api: PlayApi, existing_edit_id: str | None = None) -> dict:
    """Read Play state through an edit, without uploading or committing anything."""
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    created_edit = False
    expired_edit_replaced = False
    edit_info = None
    if existing_edit_id:
        edit_id = existing_edit_id
        try:
            edit_info = api.api("GET", f"{package_path}/edits/{quote(edit_id, safe='')}")
        except RuntimeError as exc:
            if "This edit has expired" not in str(exc):
                raise
            expired_edit_replaced = True
            print("PLAY_EXISTING_EDIT_EXPIRED=" + json.dumps({
                "editId": edit_id,
                "action": "create_temporary_read_only_edit",
            }))
            response = api.api("POST", f"{package_path}/edits", json_body={})
            edit_id = response["id"]
            created_edit = True
    else:
        response = api.api("POST", f"{package_path}/edits", json_body={})
        edit_id = response["id"]
        created_edit = True

    edit_path = f"{package_path}/edits/{quote(edit_id, safe='')}"
    result: dict = {
        "packageName": PACKAGE_NAME,
        "editId": edit_id,
        "requestedEditId": existing_edit_id or None,
        "expiredEditReplaced": expired_edit_replaced,
    }
    try:
        if edit_info is None:
            edit_info = api.api("GET", edit_path)
        result["edit"] = {
            "id": edit_info.get("id", edit_id),
            "expiryTimeSeconds": edit_info.get("expiryTimeSeconds"),
            "existingEditReused": not created_edit,
        }
        tracks = api.api("GET", f"{edit_path}/tracks").get("tracks", [])
        all_codes = [
            int(code)
            for track in tracks
            for release in track.get("releases", [])
            for code in release.get("versionCodes", [])
        ]
        result["highestVersionCodeAcrossTracks"] = max(all_codes, default=0)
        result["tracks"] = [
            {
                "track": item.get("track"),
                "releases": [
                    {
                        "name": release.get("name"),
                        "status": release.get("status"),
                        "versionCodes": [str(code) for code in release.get("versionCodes", [])],
                    }
                    for release in item.get("releases", [])
                ],
            }
            for item in tracks
        ]

        bundles = api.api("GET", f"{edit_path}/bundles").get("bundles", [])
        result["bundles"] = [
            {
                "versionCode": int(item.get("versionCode", 0)),
                "sha256": item.get("sha256"),
                "size": item.get("size"),
            }
            for item in bundles
        ]

        tester_path = (
            f"{edit_path}/testers/{quote(TRACK_NAME, safe='')}"
        )
        try:
            tester = api.api("GET", tester_path)
            result["testers"] = {
                "googleGroupCount": len(tester.get("googleGroups", [])),
                "allUsers": bool(tester.get("allUsers", False)),
                "individualEmailListsReadable": False,
            }
        except Exception as exc:
            result["testers"] = {"readError": str(exc)[:500]}

        details = api.api("GET", f"{edit_path}/details")
        expected_details = {
            "defaultLanguage": "ar",
            "contactWebsite": WEBSITE,
            "contactEmail": SUPPORT_EMAIL,
        }
        details_comparable = {
            "defaultLanguage": details.get("defaultLanguage"),
            "contactWebsite": details.get("contactWebsite"),
            "contactEmail": details.get("contactEmail"),
        }
        result["appDetails"] = {
            **details_comparable,
            "contactEmailConfigured": bool(details.get("contactEmail")),
            "matchesRepository": details_comparable == expected_details,
        }

        image_types = ("icon", "featureGraphic", "phoneScreenshots", "tenInchScreenshots")
        listing_state = {}
        for locale in ("ar", "en-US"):
            try:
                listing = api.api(
                    "GET",
                    f"{edit_path}/listings/{quote(locale, safe='')}"
                )
                actual_fields = {
                    "title": listing.get("title"),
                    "shortDescription": listing.get("shortDescription"),
                    "fullDescription": listing.get("fullDescription"),
                }
                expected_listing = read_listing(Path(__file__).resolve().parents[1], locale)
                expected_fields = {
                    "title": expected_listing.get("title"),
                    "shortDescription": expected_listing.get("shortDescription"),
                    "fullDescription": expected_listing.get("fullDescription"),
                }
                def fingerprint(value: dict) -> str:
                    serialized = json.dumps(
                        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                    ).encode("utf-8")
                    return hashlib.sha256(serialized).hexdigest()
                listing_state[locale] = {
                    "title": listing.get("title"),
                    "shortDescriptionLength": len(listing.get("shortDescription", "")),
                    "fullDescriptionLength": len(listing.get("fullDescription", "")),
                    "metadataSha256": fingerprint(actual_fields),
                    "repositoryMetadataSha256": fingerprint(expected_fields),
                    "matchesRepository": actual_fields == expected_fields,
                }
            except Exception as exc:
                listing_state[locale] = {"readError": str(exc)[:500]}

            listing_state[locale]["images"] = {}
            for image_type in image_types:
                try:
                    image_group = api.api(
                        "GET",
                        f"{edit_path}/listings/{quote(locale, safe='')}/{quote(image_type, safe='')}"
                    ).get("images", [])
                    listing_state[locale]["images"][image_type] = [
                        {"width": image.get("width"), "height": image.get("height")}
                        for image in image_group
                    ]
                except Exception as exc:
                    listing_state[locale]["images"][image_type] = {
                        "readError": str(exc)[:500]
                    }
        result["listings"] = listing_state
        result["editMetadataMatchesRepository"] = bool(
            result["appDetails"].get("matchesRepository")
            and all(
                listing_state.get(locale, {}).get("matchesRepository") is True
                for locale in ("ar", "en-US")
            )
        )

        result["inspectionOnly"] = True
        result["existingEditReused"] = not created_edit
        print("PLAY_READ_ONLY_INSPECTION=" + json.dumps(result, ensure_ascii=False))
        return result
    finally:
        if created_edit:
            try:
                api.api("DELETE", edit_path)
                print("PLAY_INSPECTION_TEMP_EDIT_DELETED=true")
            except Exception as exc:
                print(
                    "PLAY_INSPECTION_TEMP_EDIT_DELETE_ERROR=" + str(exc)[:500],
                    file=sys.stderr,
                )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect-only", action="store_true")
    parser.add_argument("--stage-only", action="store_true")
    parser.add_argument("--existing-edit-id", default="")
    parser.add_argument("--submit-for-review", action="store_true")
    parser.add_argument("--aab", type=Path)
    parser.add_argument("--assets-dir", type=Path)
    parser.add_argument("--testers-google-group", default="")
    parser.add_argument("--github-output", default=os.environ.get("GITHUB_OUTPUT", ""))
    args = parser.parse_args()

    try:
        validate_play_mode(args.inspect_only, args.stage_only, args.submit_for_review)
    except ValueError as exc:
        parser.error(str(exc))

    root = Path(__file__).resolve().parents[1]
    validate_target(
        os.environ.get("PACKAGE_NAME", PACKAGE_NAME),
        int(os.environ.get("EXPECTED_VERSION_CODE", VERSION_CODE)),
        os.environ.get("PLAY_TRACK_NAME", TRACK_NAME),
    )

    if args.inspect_only:
        api = PlayApi()
        inspect_play_state(api, args.existing_edit_id.strip() or None)
        return

    if args.aab is None:
        parser.error("--stage-only and --submit-for-review require --aab")
    if not args.aab.is_file():
        raise FileNotFoundError(args.aab)
    if not args.stage_only and args.assets_dir is None:
        parser.error("--submit-for-review requires --assets-dir")
    if not args.stage_only and not args.assets_dir.is_dir():
        raise FileNotFoundError(args.assets_dir)

    actual_hash = hashlib.sha256(args.aab.read_bytes()).hexdigest()
    if actual_hash != AAB_SHA256:
        raise ValueError(f"Pinned AAB SHA-256 mismatch: {actual_hash}")

    google_group = args.testers_google_group.strip()
    if google_group and not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", google_group):
        raise ValueError("Google Group address is not valid")
    if args.stage_only:
        validate_stage_only_inputs(args.existing_edit_id, google_group)

    assets = {}
    if not args.stage_only:
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

    # Stage-only uses a fresh isolated edit after the workflow's read-only
    # preflight. An explicitly supplied edit is reused only while still active.
    edit_reused = False
    if args.stage_only and args.existing_edit_id.strip():
        candidate_id = args.existing_edit_id.strip()
        try:
            api.api("GET", f"{package_path}/edits/{quote(candidate_id, safe='')}")
            edit_id = candidate_id
            edit_reused = True
        except RuntimeError as exc:
            if "This edit has expired" not in str(exc):
                raise
            print("PLAY_STAGE_OLD_EDIT_EXPIRED=" + json.dumps({
                "editId": candidate_id,
                "action": "create_fresh_stage_edit",
            }))
            preflight = api.api("POST", f"{package_path}/edits", json_body={})
            edit_id = preflight["id"]
    else:
        preflight = api.api("POST", f"{package_path}/edits", json_body={})
        edit_id = preflight["id"]
    print("PLAY_STAGE_EDIT=" + json.dumps({
        "editId": edit_id,
        "existingEditReused": edit_reused,
        "newIsolatedEdit": not edit_reused,
    }))
    committed = False
    try:
        tracks_path = f"{package_path}/edits/{quote(edit_id, safe='')}/tracks"
        tracks = api.api("GET", tracks_path).get("tracks", [])
        # The new code must be greater than the highest version already assigned
        # to any track for this package. Existing instances of this exact code
        # are allowed only so their bundle hash can be checked and reused.
        existing_codes = [
            int(code)
            for item in tracks
            for release in item.get("releases", [])
            for code in release.get("versionCodes", [])
        ]
        highest_existing = max(existing_codes, default=0)
        if VERSION_CODE < highest_existing:
            raise RuntimeError(
                f"versionCode {VERSION_CODE} is lower than the highest track versionCode "
                f"{highest_existing}. Refusing a downgrade."
            )
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

        # Diagnostic read-back only. Keep this output limited to non-sensitive
        # release metadata so an existing Console draft can be identified safely.
        print("PLAY_CLOSED_TRACK_PRECHECK=" + json.dumps({
            "packageName": PACKAGE_NAME,
            "track": TRACK_NAME,
            "trackExists": track is not None,
            "highestVersionCodeAcrossTracks": highest_existing,
            "releases": [
                {
                    "name": release.get("name"),
                    "status": release.get("status"),
                    "versionCodes": [str(code) for code in release.get("versionCodes", [])],
                }
                for release in current_releases
            ],
        }, ensure_ascii=False))

        existing_version_code_draft = False
        draft_releases = [release for release in current_releases if release.get("status") == "draft"]
        if len(draft_releases) > 1:
            raise RuntimeError("The target track has multiple draft releases. No release was changed.")
        for release in current_releases:
            versions = {str(code) for code in release.get("versionCodes", [])}
            if str(VERSION_CODE) in versions:
                if release.get("status") != "draft":
                    raise RuntimeError(
                        f"versionCode {VERSION_CODE} already exists on the target track "
                        f"with non-draft status {release.get('status')!r}. No release was changed."
                    )
                existing_version_code_draft = True
            if release.get("status") == "draft":
                draft_codes = [int(code) for code in release.get("versionCodes", [])]
                if any(code > VERSION_CODE for code in draft_codes):
                    raise RuntimeError(
                        f"The existing draft has versionCodes {draft_codes} above {VERSION_CODE}. "
                        "No release was changed."
                    )

        if not args.stage_only:
            # Store metadata and artwork are excluded from STAGE_ONLY.
            # This edit is limited to the bundle and target Closed Testing track.
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

            # Preserve existing artwork; fill only image groups that are currently empty.
            for locale in ("ar", "en-US"):
                for image_type, image_paths in assets.items():
                    upload_image_group(api, package_path, edit_id, locale, image_type, image_paths)

        # Reuse the bundle if the owner performed the one-time Console bootstrap.
        # Never upload a second copy of the same versionCode if Google already knows it.
        bundles_path = f"{package_path}/edits/{quote(edit_id, safe='')}/bundles"
        known_bundles = api.api("GET", bundles_path).get("bundles", [])
        known_bundle = next(
            (item for item in known_bundles if int(item.get("versionCode", 0)) == VERSION_CODE),
            None,
        )
        if known_bundle:
            known_hash = str(known_bundle.get("sha256", "")).lower()
            if known_hash and known_hash != AAB_SHA256:
                raise RuntimeError(
                    "The existing bundle has the expected versionCode but a different SHA-256. "
                    "No bundle was replaced."
                )
            print("Reusing the existing app bundle with the pinned versionCode.")
        elif existing_version_code_draft:
            raise RuntimeError(
                "The target track has this versionCode in draft status, but the API bundle list "
                "does not expose its SHA-256. Refusing to reuse an unverified bundle."
            )
        else:
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
            returned_hash = str(bundle.get("sha256", "")).lower()
            if returned_hash and returned_hash != AAB_SHA256:
                raise RuntimeError("Google's AAB SHA-256 does not match the pinned signed artifact.")

        # Put only a draft release on the custom closed-testing track.
        # Preserve existing non-draft releases. Replace only the matching draft
        # when it already carries this exact versionCode.
        track_path = f"{tracks_path}/{quote(TRACK_NAME, safe='')}"
        track_after_upload = api.api("GET", track_path)
        releases = prepare_closed_track_releases(
            list(track_after_upload.get("releases", []))
        )
        api.api("PUT", track_path, json_body={"track": TRACK_NAME, "releases": releases})

        # Read tester config. Android Publisher exposes Google Groups, not saved email lists.
        # Do not change any tester configuration unless an explicit Google Group was supplied.
        testers_path = (
            f"{package_path}/edits/{quote(edit_id, safe='')}"
            f"/testers/{quote(TRACK_NAME, safe='')}"
        )
        tester_config = api.api("GET", testers_path)
        existing_groups = tester_config.get("googleGroups", [])
        print("PLAY_CLOSED_TESTERS_PRECHECK=" + json.dumps({
            "googleGroupCount": len(existing_groups),
            "allUsers": bool(tester_config.get("allUsers", False)),
            "individualEmailListsAvailableViaPublisherApi": False,
            "individualEmailListsChanged": False,
        }, ensure_ascii=False))
        if google_group:
            groups = sorted(set(existing_groups) | {google_group})
            api.api("PUT", testers_path, json_body={"googleGroups": groups})

        if args.stage_only:
            print(json.dumps({
                "result": "staged_uncommitted",
                "editId": edit_id,
                "packageName": PACKAGE_NAME,
                "versionName": VERSION_NAME,
                "versionCode": VERSION_CODE,
                "track": TRACK_NAME,
                "releaseStatus": "draft",
                "googleGroupCount": len(existing_groups),
                "existingEditReused": edit_reused,
                "storeListingMetadataChanged": False,
                "storeArtworkChanged": False,
                "testerConfigurationChanged": False,
                "productionTouched": False,
                "changesCommitted": False,
                "changesSentForReview": False,
                "existingImagesDeleted": False,
            }, ensure_ascii=False, indent=2))
            if args.github_output:
                with Path(args.github_output).open("a", encoding="utf-8") as output_file:
                    output_file.write(f"edit_id={edit_id}\\n")
            return

        # This commit intentionally sends all staged edits for Google review.
        # The CLI refuses to reach this point without --submit-for-review.
        api.api("POST", f"{package_path}/edits/{quote(edit_id, safe='')}:validate")
        api.api(
            "POST",
            f"{package_path}/edits/{quote(edit_id, safe='')}:commit",
            params={"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"},
        )
        committed = True
        print(json.dumps({
            "result": "submitted_for_review",
            "packageName": PACKAGE_NAME,
            "versionName": VERSION_NAME,
            "versionCode": VERSION_CODE,
            "track": TRACK_NAME,
            "releaseStatus": "draft",
            "googleGroupConfigured": bool(google_group),
            "productionTouched": False,
            "changesSentForReview": True,
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
