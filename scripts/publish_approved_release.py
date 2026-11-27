#!/usr/bin/env python3
"""Publish one explicitly approved Dalilna Closed Testing draft.

This script can only promote a user-confirmed draft on the custom Closed
Testing track to completed. It never targets Production or uploads an AAB.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from urllib.parse import quote

PACKAGE_NAME = "ye.dalilna.app"
TRACK_NAME = "Dalilna Closed Testing"
APPROVAL_PHRASE = "YES — publish approved draft to Closed Testing"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"


class PlayApi:
    def __init__(self) -> None:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
        credentials, _ = google.auth.default(scopes=[OAUTH_SCOPE])
        self.session = AuthorizedSession(credentials)

    def request(self, method: str, path: str, *, body=None, params=None):
        response = self.session.request(
            method, API_ROOT + path, json=body, params=params, timeout=(30, 180)
        )
        if not response.ok:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:1600]
            raise RuntimeError(
                f"Google Play API {method} {path} returned "
                f"HTTP {response.status_code}: {detail}"
            )
        return response.json() if response.content else {}


def validate_approval(approval: str, package_name: str, version_code: str) -> int:
    if approval != APPROVAL_PHRASE:
        raise ValueError("Explicit approval phrase is required; the draft remains unchanged")
    if package_name != PACKAGE_NAME:
        raise ValueError(f"Refusing package {package_name!r}")
    if not version_code.isdigit() or int(version_code) <= 0:
        raise ValueError("A positive numeric versionCode is required")
    return int(version_code)


def promote_draft(releases: list[dict], version_code: int) -> list[dict]:
    result = [dict(item) for item in releases]
    matches = [
        index for index, release in enumerate(result)
        if str(version_code) in {str(code) for code in release.get("versionCodes", [])}
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one Closed Testing release with versionCode {version_code}; "
            f"found {len(matches)}"
        )
    index = matches[0]
    release = dict(result[index])
    if release.get("status") != "draft":
        raise RuntimeError(
            f"versionCode {version_code} is {release.get('status')!r}, not draft; "
            "no change was made."
        )
    release["status"] = "completed"
    result[index] = release
    return result


def publish(api: PlayApi, version_code: int) -> dict:
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    edit = api.request("POST", package_path + "/edits", body={})
    edit_id = edit.get("id")
    if not edit_id:
        raise RuntimeError("Google Play did not return an edit ID")
    edit_path = package_path + f"/edits/{quote(str(edit_id), safe='')}"
    committed = False
    try:
        tracks = api.request("GET", edit_path + "/tracks").get("tracks", []) or []
        target = next((item for item in tracks if item.get("track") == TRACK_NAME), None)
        if target is None:
            raise RuntimeError(f"Closed Testing track {TRACK_NAME!r} does not exist")
        bundles = api.request("GET", edit_path + "/bundles").get("bundles", []) or []
        if not any(int(item.get("versionCode", 0)) == version_code for item in bundles):
            raise RuntimeError(
                f"Google Play has no uploaded bundle for versionCode {version_code}; "
                "no release was published."
            )
        releases = promote_draft(list(target.get("releases", []) or []), version_code)
        api.request(
            "PUT",
            edit_path + f"/tracks/{quote(TRACK_NAME, safe='')}",
            body={"track": TRACK_NAME, "releases": releases},
        )
        api.request("POST", edit_path + ":validate")
        api.request(
            "POST",
            edit_path + ":commit",
            params={"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"},
        )
        committed = True
    finally:
        if not committed:
            api.request("DELETE", edit_path)

    # Read back from a fresh edit and discard only that inspection edit.
    verify = api.request("POST", package_path + "/edits", body={})
    verify_id = verify.get("id")
    if not verify_id:
        raise RuntimeError("Publish completed, but Play did not return an ID for verification")
    verify_path = package_path + f"/edits/{quote(str(verify_id), safe='')}"
    try:
        verify_tracks = api.request("GET", verify_path + "/tracks").get("tracks", []) or []
        verify_track = next(
            (item for item in verify_tracks if item.get("track") == TRACK_NAME),
            None,
        )
        verified_releases = (verify_track or {}).get("releases", []) or []
        verified = [
            release for release in verified_releases
            if str(version_code) in {str(code) for code in release.get("versionCodes", [])}
        ]
        if len(verified) != 1 or verified[0].get("status") != "completed":
            raise RuntimeError(
                "The Closed Testing versionCode did not read back as completed after commit"
            )
    finally:
        api.request("DELETE", verify_path)

    return {
        "packageName": PACKAGE_NAME,
        "track": TRACK_NAME,
        "versionCode": version_code,
        "releaseStatus": "completed",
        "productionTouched": False,
        "aabUploaded": False,
        "reviewSubmissionBehavior": "ERROR_IF_IN_REVIEW",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version-code", required=True)
    parser.add_argument("--approval", required=True)
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_REPOSITORY") not in (None, "baraagpt6-droid/dalilna"):
            raise RuntimeError("Restricted to baraagpt6-droid/dalilna")
        if os.environ.get("GITHUB_REF") not in (None, "refs/heads/main"):
            raise RuntimeError("Must run from main")
        version_code = validate_approval(args.approval, PACKAGE_NAME, args.version_code)
        result = publish(PlayApi(), version_code)
        print("DALILNA_APPROVED_CLOSED_TEST_RELEASE=" + json.dumps(result, ensure_ascii=False))
        summary = [
            "## Dalilna — approved Closed Testing release",
            "",
            f"- Package: {result['packageName']}",
            f"- Track: {result['track']}",
            f"- versionCode: {result['versionCode']}",
            "- Status after verification: completed",
            "- Production changed: no",
            "- New AAB uploaded: no",
            "- Commit behavior: ERROR_IF_IN_REVIEW",
        ]
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write("\n".join(summary) + "\n")
        return 0
    except Exception as exc:
        print(f"Dalilna approved release was blocked safely: {exc}", file=sys.stderr)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(
                    "## Dalilna — approved release not published\n\n"
                    "No Production track was changed.\n\n" + str(exc)[:1500] + "\n"
                )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
