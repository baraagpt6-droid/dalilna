#!/usr/bin/env python3
"""Smart, review-safe publisher for Dalilna Closed Testing only.

The publisher promotes exactly one verified Closed Testing draft to completed.
If Google reports CHANGES_ALREADY_IN_REVIEW, it uses the still-valid edit to
restore that same release to draft and commits that non-submitting change with
ERROR_IF_IN_REVIEW. Production and tester configuration are never written.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from urllib.parse import quote

PACKAGE_NAME = "ye.dalilna.app"
TRACK_NAME = "Dalilna Closed Testing"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"


class PlayApiError(RuntimeError):
    def __init__(self, method: str, path: str, status: int, payload):
        self.method = method
        self.path = path
        self.status = status
        self.payload = payload
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        self.reason = None
        for detail in error.get("details", []) if isinstance(error, dict) else []:
            if isinstance(detail, dict) and detail.get("reason"):
                self.reason = str(detail["reason"])
                break
        self.message = str(error.get("message", payload)) if isinstance(error, dict) else str(payload)
        super().__init__(
            f"Google Play API {method} {path} returned HTTP {status}: "
            f"{self.message[:1200]}"
        )

    @property
    def changes_already_in_review(self) -> bool:
        return (
            self.status == 400
            and (
                self.reason == "CHANGES_ALREADY_IN_REVIEW"
                or "already have changes in review" in self.message.lower()
            )
        )


def promote_to_single_completed_release(releases: list[dict], version_code: int) -> list[dict]:
    """Merge the new code into the track's one completed release object."""
    result = [dict(item) for item in releases]
    targets = [
        index for index, item in enumerate(result)
        if str(version_code) in {str(code) for code in item.get("versionCodes", [])}
    ]
    if len(targets) != 1:
        raise RuntimeError(
            f"Expected exactly one Closed Testing release with versionCode {version_code}; "
            f"found {len(targets)}"
        )
    target_index = targets[0]
    target = dict(result[target_index])
    if target.get("status") not in {"draft", "completed"}:
        raise RuntimeError(f"Refusing unexpected release status {target.get('status')!r}")

    other_completed = [
        index for index, item in enumerate(result)
        if index != target_index and item.get("status") == "completed"
    ]
    if len(other_completed) > 1:
        raise RuntimeError("Closed Testing already contains more than one completed release")
    if not other_completed:
        target["status"] = "completed"
        result[target_index] = target
        return result

    # Google Play accepts only one completed release object on a track.
    # Merge the new code into the existing completed release, keeping its
    # rollout object and historical version codes, and remove the draft object.
    completed_index = other_completed[0]
    completed = dict(result[completed_index])
    codes = [str(code) for code in completed.get("versionCodes", [])]
    if str(version_code) not in codes:
        codes.append(str(version_code))
    completed["versionCodes"] = codes
    result[completed_index] = completed
    return [item for index, item in enumerate(result) if index != target_index]


def retain_release_as_draft(releases: list[dict], version_code: int) -> list[dict]:
    result = [dict(item) for item in releases]
    matches = [
        index for index, item in enumerate(result)
        if str(version_code) in {str(code) for code in item.get("versionCodes", [])}
    ]
    if len(matches) != 1:
        raise RuntimeError(f"Cannot restore draft: expected one release for {version_code}")
    result[matches[0]]["status"] = "draft"
    return result


def commit_release_with_review_fallback(
    api,
    edit_path: str,
    tracks_path: str,
    track_name: str,
    existing_releases: list[dict],
    version_code: int,
) -> dict:
    """Commit completed safely, or persist the exact release as draft on review conflict."""
    original_releases = [dict(item) for item in existing_releases]
    completed_releases = promote_to_single_completed_release(original_releases, version_code)
    track_path = tracks_path + f"/{quote(track_name, safe='')}"
    api.request(
        "PUT", track_path,
        body={"track": track_name, "releases": completed_releases},
    )
    api.request("POST", edit_path + ":validate")
    try:
        api.request(
            "POST", edit_path + ":commit",
            params={"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"},
        )
        return {
            "releaseStatus": "completed",
            "reviewInProgressFallback": False,
            "reviewConflictReason": None,
        }
    except PlayApiError as exc:
        if not exc.changes_already_in_review:
            raise
        # The failed commit does not invalidate the edit. Restore the original
        # completed release and retain only this new version as a draft. Google
        # documents that an edit which creates no new submission can be committed
        # while another review is active.
        draft_releases = retain_release_as_draft(original_releases, version_code)
        api.request(
            "PUT", track_path,
            body={"track": track_name, "releases": draft_releases},
        )
        api.request("POST", edit_path + ":validate")
        api.request(
            "POST", edit_path + ":commit",
            params={"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"},
        )
        return {
            "releaseStatus": "draft",
            "reviewInProgressFallback": True,
            "reviewConflictReason": "CHANGES_ALREADY_IN_REVIEW",
        }


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
                payload = response.json()
            except ValueError:
                payload = {"error": {"message": response.text[:1200]}}
            raise PlayApiError(method, path, response.status_code, payload)
        return response.json() if response.content else {}


def verify_state(api: PlayApi, version_code: int, expected_sha256: str, expected_status: str) -> dict:
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    verify = api.request("POST", package_path + "/edits", body={})
    verify_id = verify.get("id")
    if not verify_id:
        raise RuntimeError("Google Play did not return a verification edit ID")
    verify_path = package_path + f"/edits/{quote(str(verify_id), safe='')}"
    try:
        tracks = api.request("GET", verify_path + "/tracks").get("tracks", []) or []
        target = next((item for item in tracks if item.get("track") == TRACK_NAME), None)
        if target is None:
            raise RuntimeError(f"Closed Testing track {TRACK_NAME!r} was not found on read-back")
        matches = [
            item for item in (target.get("releases", []) or [])
            if str(version_code) in {str(code) for code in item.get("versionCodes", [])}
        ]
        if len(matches) != 1 or matches[0].get("status") != expected_status:
            raise RuntimeError(
                f"Read-back verification expected versionCode {version_code} "
                f"to be {expected_status}; got {matches!r}"
            )
        bundles = api.request("GET", verify_path + "/bundles").get("bundles", []) or []
        bundle = next(
            (item for item in bundles if int(item.get("versionCode", 0)) == version_code),
            None,
        )
        if bundle is None or str(bundle.get("sha256", "")).lower() != expected_sha256.lower():
            raise RuntimeError("Play bundle SHA-256 did not match the pinned AAB")
        return {
            "packageName": PACKAGE_NAME,
            "track": TRACK_NAME,
            "versionCode": version_code,
            "releaseStatus": expected_status,
            "aabSha256": bundle.get("sha256"),
            "readBackVerified": True,
            "productionTouched": False,
            "testerConfigurationChanged": False,
        }
    finally:
        api.request("DELETE", verify_path)


def publish_existing_draft(api: PlayApi, version_code: int, expected_sha256: str) -> dict:
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    edit = api.request("POST", package_path + "/edits", body={})
    edit_id = edit.get("id")
    if not edit_id:
        raise RuntimeError("Google Play did not return a temporary edit ID")
    edit_path = package_path + f"/edits/{quote(str(edit_id), safe='')}"
    tracks_path = edit_path + "/tracks"
    committed = False
    try:
        tracks = api.request("GET", tracks_path).get("tracks", []) or []
        target = next((item for item in tracks if item.get("track") == TRACK_NAME), None)
        if target is None:
            raise RuntimeError(f"Required Closed Testing track {TRACK_NAME!r} does not exist")
        releases = list(target.get("releases", []) or [])
        matches = [
            item for item in releases
            if str(version_code) in {str(code) for code in item.get("versionCodes", [])}
        ]
        if len(matches) != 1:
            raise RuntimeError(
                f"Expected exactly one Closed Testing release for versionCode {version_code}; "
                f"found {len(matches)}"
            )
        if matches[0].get("status") == "completed":
            bundle_data = api.request("GET", edit_path + "/bundles").get("bundles", []) or []
            bundle = next(
                (item for item in bundle_data if int(item.get("versionCode", 0)) == version_code),
                None,
            )
            if bundle is None or str(bundle.get("sha256", "")).lower() != expected_sha256.lower():
                raise RuntimeError("Already-completed release does not match the pinned AAB")
            committed = True
            result = verify_state(api, version_code, expected_sha256, "completed")
            result["alreadyCompleted"] = True
            result["reviewInProgressFallback"] = False
            return result
        if matches[0].get("status") != "draft":
            raise RuntimeError(
                f"versionCode {version_code} is {matches[0].get('status')!r}; expected draft"
            )

        bundle_data = api.request("GET", edit_path + "/bundles").get("bundles", []) or []
        bundle = next(
            (item for item in bundle_data if int(item.get("versionCode", 0)) == version_code),
            None,
        )
        if bundle is None or str(bundle.get("sha256", "")).lower() != expected_sha256.lower():
            raise RuntimeError("The existing draft AAB did not match the expected SHA-256")

        outcome = commit_release_with_review_fallback(
            api, edit_path, tracks_path, TRACK_NAME, releases, version_code
        )
        committed = True
        result = verify_state(api, version_code, expected_sha256, outcome["releaseStatus"])
        result.update({
            "alreadyCompleted": False,
            "reviewInProgressFallback": outcome["reviewInProgressFallback"],
            "reviewConflictReason": outcome["reviewConflictReason"],
        })
        print("DALILNA_SMART_PLAY_PUBLISH=" + json.dumps(result, ensure_ascii=False))
        return result
    finally:
        if not committed:
            try:
                api.request("DELETE", edit_path)
            except Exception as cleanup_error:
                print(f"Could not discard temporary Play edit {edit_id}: {cleanup_error}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version-code", type=int, required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_REPOSITORY") not in (None, "baraagpt6-droid/dalilna"):
            raise RuntimeError("Restricted to baraagpt6-droid/dalilna")
        if os.environ.get("GITHUB_REF") not in (None, "refs/heads/main"):
            raise RuntimeError("Must run from main")
        if args.version_code <= 0 or len(args.sha256) != 64:
            raise ValueError("A positive versionCode and SHA-256 value are required")
        result = publish_existing_draft(PlayApi(), args.version_code, args.sha256)
        print("DALILNA_SMART_PUBLISH_RESULT=" + json.dumps(result, ensure_ascii=False))
        status_text = "completed — available to the Closed Testing audience" if result["releaseStatus"] == "completed" else "draft — preserved for later approval"
        if result.get("alreadyCompleted"):
            status_text = "completed — already published; no changes needed"
        summary = [
            "## Dalilna Smart Auto-Publish",
            "",
            f"- Package: {result['packageName']}",
            f"- Track: {result['track']}",
            f"- versionCode: {result['versionCode']}",
            f"- Final status: {status_text}",
            f"- Read-back verified: {'yes' if result['readBackVerified'] else 'no'}",
            f"- Review-conflict fallback: {'used' if result.get('reviewInProgressFallback') else 'not needed'}",
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
        print(f"Dalilna smart publisher stopped safely: {exc}", file=sys.stderr)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(
                    "## Dalilna Smart Auto-Publish — stopped safely\n\n"
                    f"No unverified release was published.\n\n{str(exc)[:1500]}\n"
                )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
