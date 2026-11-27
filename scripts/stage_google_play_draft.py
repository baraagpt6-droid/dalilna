#!/usr/bin/env python3
"""Smart-publish a verified Dalilna AAB to Closed Testing, with draft fallback.

Safety scope: ye.dalilna.app and Dalilna Closed Testing only. Try completed with
ERROR_IF_IN_REVIEW. If Google reports CHANGES_ALREADY_IN_REVIEW, save the same
AAB as draft using that same guard. Never cancel an existing review or write
Production, tester, listing, pricing, or account-level resources.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

from smart_publish_closed_testing import PlayApiError, commit_release_with_review_fallback

PACKAGE_NAME = "ye.dalilna.app"
TRACK_NAME = "Dalilna Closed Testing"
VERSION_NAME = "3.1.0"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD_ROOT = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"


def parse_bundle_metadata(metadata: dict, expected_package: str = PACKAGE_NAME) -> tuple[int, str]:
    if metadata.get("applicationId") != expected_package:
        raise ValueError(
            f"Refusing AAB for applicationId {metadata.get('applicationId')!r}; "
            f"expected {expected_package!r}"
        )
    elements = metadata.get("elements")
    if not isinstance(elements, list) or len(elements) != 1:
        raise ValueError("Expected one release AAB entry in Gradle output-metadata.json")
    element = elements[0]
    try:
        version_code = int(element["versionCode"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("AAB metadata does not contain a valid versionCode") from exc
    version_name = str(element.get("versionName", "")).strip()
    if version_code <= 0 or not version_name:
        raise ValueError("AAB metadata has an invalid versionCode or versionName")
    return version_code, version_name


def validate_release_status(status: str) -> None:
    if status not in {"draft", "completed"}:
        raise ValueError("Closed Testing release status must be draft or completed")


def build_draft_release(version_code: int, version_name: str, status: str = "draft") -> dict:
    validate_release_status(status)
    return {
        "name": f"Dalilna {version_name} preview {version_code}",
        "versionCodes": [str(version_code)],
        "status": status,
    }


def ensure_no_conflicting_drafts(releases: list[dict], version_code: int) -> None:
    for release in releases:
        if release.get("status") != "draft":
            continue
        codes = {str(code) for code in release.get("versionCodes", [])}
        if str(version_code) in codes:
            raise RuntimeError(
                f"versionCode {version_code} is already present as a draft; "
                "refusing to create or replace a duplicate."
            )
        raise RuntimeError(
            "The Closed Testing track already has an unsubmitted draft. "
            "It was preserved; no new draft was staged."
        )


class PlayApi:
    def __init__(self) -> None:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
        credentials, _ = google.auth.default(scopes=[OAUTH_SCOPE])
        self.session = AuthorizedSession(credentials)

    def request(self, method: str, path: str, *, body=None, data=None,
                content_type=None, params=None, timeout=(30, 600)):
        headers = {}
        if content_type:
            headers["Content-Type"] = content_type
        response = self.session.request(
            method, API_ROOT + path, json=body, data=data, headers=headers,
            params=params, timeout=timeout
        )
        if not response.ok:
            try:
                detail = response.json()
            except ValueError:
                detail = {"error": {"message": response.text[:1600]}}
            raise PlayApiError(method, path, response.status_code, detail)
        return response.json() if response.content else {}

    def upload(self, edit_path: str, aab_path: Path) -> dict:
        upload_path = (
            f"{UPLOAD_ROOT}{edit_path}/bundles"
        )
        with aab_path.open("rb") as bundle:
            response = self.session.post(
                upload_path,
                params={"uploadType": "media"},
                data=bundle,
                headers={"Content-Type": "application/octet-stream"},
                timeout=(30, 900),
            )
        if not response.ok:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:1600]
            raise RuntimeError(
                f"Google Play bundle upload returned HTTP {response.status_code}: {detail}"
            )
        return response.json()


def stage_draft(api: PlayApi, aab_path: Path, metadata_path: Path) -> dict:
    if not aab_path.is_file() or aab_path.stat().st_size <= 0:
        raise FileNotFoundError(f"Signed AAB is missing or empty: {aab_path}")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    version_code, version_name = parse_bundle_metadata(metadata)
    if version_name != VERSION_NAME:
        raise ValueError(
            f"Refusing versionName {version_name!r}; this pipeline is pinned to {VERSION_NAME!r}"
        )
    digest = hashlib.sha256(aab_path.read_bytes()).hexdigest()
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    created = api.request("POST", package_path + "/edits", body={})
    edit_id = created.get("id")
    if not edit_id:
        raise RuntimeError("Google Play did not return a temporary edit ID")
    edit_path = package_path + f"/edits/{quote(str(edit_id), safe='')}"
    tracks_path = edit_path + "/tracks"
    committed = False
    try:
        tracks = api.request("GET", tracks_path).get("tracks", []) or []
        max_existing = max(
            (
                int(code)
                for track in tracks
                for release in (track.get("releases", []) or [])
                for code in (release.get("versionCodes", []) or [])
            ),
            default=0,
        )
        if version_code <= max_existing:
            raise RuntimeError(
                f"New AAB versionCode {version_code} must exceed the highest Play track "
                f"versionCode {max_existing}. No Play data was changed."
            )

        target = next(
            (item for item in tracks if item.get("track") == TRACK_NAME),
            None,
        )
        if target is None:
            raise RuntimeError(
                f"Required Closed Testing track {TRACK_NAME!r} was not found. "
                "The script will not create a new track."
            )
        releases = list(target.get("releases", []) or [])
        ensure_no_conflicting_drafts(releases, version_code)

        known_bundles = api.request("GET", edit_path + "/bundles").get("bundles", []) or []
        existing = next(
            (item for item in known_bundles if int(item.get("versionCode", 0)) == version_code),
            None,
        )
        if existing:
            known_hash = str(existing.get("sha256", "")).lower()
            if known_hash and known_hash != digest:
                raise RuntimeError(
                    "This versionCode already belongs to a different AAB SHA-256; "
                    "refusing to reuse or replace it."
                )
        else:
            uploaded = api.upload(edit_path, aab_path)
            returned_code = int(uploaded.get("versionCode", 0))
            if returned_code != version_code:
                raise RuntimeError(
                    f"Play returned versionCode {returned_code}, expected {version_code}"
                )
            returned_hash = str(uploaded.get("sha256", "")).lower()
            if returned_hash and returned_hash != digest:
                raise RuntimeError("Google Play upload SHA-256 did not match the local AAB")

        releases.append(build_draft_release(version_code, version_name, "completed"))
        publication = commit_release_with_review_fallback(
            api, edit_path, tracks_path, TRACK_NAME, releases, version_code
        )
        release_status = publication["releaseStatus"]
        committed = True

        # Read back the committed Closed Testing draft in a fresh, disposable edit.
        verify_edit = api.request("POST", package_path + "/edits", body={})
        verify_id = verify_edit.get("id")
        if not verify_id:
            raise RuntimeError("Draft was committed but read-back edit creation failed")
        verify_path = package_path + f"/edits/{quote(str(verify_id), safe='')}"
        try:
            verified_tracks = api.request("GET", verify_path + "/tracks").get("tracks", []) or []
            verified_track = next(
                (item for item in verified_tracks if item.get("track") == TRACK_NAME),
                None,
            )
            verified_releases = (verified_track or {}).get("releases", []) or []
            match = [
                item for item in verified_releases
                if str(version_code) in {str(code) for code in item.get("versionCodes", [])}
            ]
            if len(match) != 1 or match[0].get("status") != release_status:
                raise RuntimeError(f"The committed version did not read back as {release_status}")
            verified_bundles = api.request("GET", verify_path + "/bundles").get("bundles", []) or []
            verified_bundle = next(
                (item for item in verified_bundles if int(item.get("versionCode", 0)) == version_code),
                None,
            )
            if verified_bundle is None:
                raise RuntimeError("The committed draft has no matching Play bundle")
            verified_hash = str(verified_bundle.get("sha256", "")).lower()
            if verified_hash and verified_hash != digest:
                raise RuntimeError("Read-back bundle SHA-256 differs from the staged AAB")
        finally:
            api.request("DELETE", verify_path)

        return {
            "packageName": PACKAGE_NAME,
            "track": TRACK_NAME,
            "versionName": version_name,
            "versionCode": version_code,
            "releaseStatus": release_status,
            "aabSha256": digest,
            "aabBytes": aab_path.stat().st_size,
            "availableToTesters": release_status == "completed",
            "readBackVerified": True,
            "reviewInProgressFallback": publication["reviewInProgressFallback"],
            "reviewConflictReason": publication["reviewConflictReason"],
            "reviewSubmissionRequested": release_status == "completed",
            "productionTouched": False,
            "testerConfigurationChanged": False,
        }
    finally:
        if not committed:
            # Discard only this run's uncommitted Play edit.
            api.request("DELETE", edit_path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--aab", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_REPOSITORY") not in (None, "baraagpt6-droid/dalilna"):
            raise RuntimeError("This script is restricted to baraagpt6-droid/dalilna")
        if os.environ.get("GITHUB_REF") not in (None, "refs/heads/main"):
            raise RuntimeError("Play draft staging is restricted to main")
        result = stage_draft(PlayApi(), args.aab, args.metadata)
        print("DALILNA_PLAY_SMART_PUBLISH=" + json.dumps(result, ensure_ascii=False))
        summary = [
            "## Dalilna Google Play — Smart Closed Testing publication",
            "",
            f"- Package: {result['packageName']}",
            f"- Track: {result['track']}",
            f"- Version: {result['versionName']} ({result['versionCode']})",
            f"- Release status: {result['releaseStatus']}",
            f"- Available to testers: {'yes' if result['availableToTesters'] else 'no — safely retained as draft'}",
            f"- Active-review fallback: {'used' if result['reviewInProgressFallback'] else 'not needed'}",
            f"- Review submission requested: {'yes' if result['reviewSubmissionRequested'] else 'no'}",
            "- Production modified: no",
            "- Tester configuration modified: no",
            f"- AAB SHA-256: {result['aabSha256']}",
        ]
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write("\n".join(summary) + "\n")
        return 0
    except Exception as exc:
        print(f"Dalilna smart Closed Testing publication stopped safely: {exc}", file=sys.stderr)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(
                    "## Dalilna Google Play — Smart publication blocked safely\n\n"
                    f"No unverified release was published.\n\n{str(exc)[:1500]}\n"
                )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
