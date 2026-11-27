#!/usr/bin/env python3
"""Read-only Google Play status monitor for Dalilna.

Creates a temporary Android Publisher edit, reads committed tracks/bundles and
tester configuration, then deletes only that temporary edit. It never uploads
an AAB, updates a track, validates/commits an edit, or changes Production.
"""
from __future__ import annotations
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

PACKAGE_NAME = "ye.dalilna.app"
CLOSED_TRACK_NAME = "Dalilna Closed Testing"
OAUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
ROOT = Path(__file__).resolve().parents[1]


class PlayApi:
    def __init__(self) -> None:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
        credentials, _ = google.auth.default(scopes=[OAUTH_SCOPE])
        self.session = AuthorizedSession(credentials)

    def request(self, method: str, path: str):
        response = self.session.request(method, API_ROOT + path, timeout=(20, 90))
        if not response.ok:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:1200]
            raise RuntimeError(
                f"Google Play API {method} {path} returned HTTP "
                f"{response.status_code}: {detail}"
            )
        return response.json() if response.content else {}


def repo_version_metadata() -> dict:
    data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    gradle = (ROOT / "android/app/build.gradle.kts").read_text(encoding="utf-8")
    match = re.search(r'versionName\s*=\s*"([^"]+)"', gradle)
    return {
        "versionName": match.group(1) if match else data.get("androidVersion") or data.get("version"),
        "versionCode": data.get("androidVersionCode", data.get("versionCode")),
        "webVersion": data.get("webVersion"),
        "androidStoreUrl": data.get("androidStoreUrl"),
        "metadataSource": "Repository version.json / Gradle; tracks API does not return versionName",
    }


def flatten_releases(tracks: list[dict]) -> list[dict]:
    result = []
    for track in tracks:
        for release in track.get("releases", []) or []:
            codes = []
            for code in release.get("versionCodes", []) or []:
                try:
                    codes.append(int(code))
                except (TypeError, ValueError):
                    continue
            result.append({
                "track": track.get("track", ""),
                "releaseName": release.get("name"),
                "status": release.get("status", "unknown"),
                "versionCodes": codes,
                "userFraction": release.get("userFraction"),
            })
    return result


def arabic_status(value: str | None) -> str:
    return {
        "draft": "مسودة غير متاحة للمختبرين",
        "inProgress": "طرح جارٍ",
        "completed": "مكتمل / متاح حسب إعدادات المسار",
        "halted": "متوقف",
    }.get(value or "", value or "غير معروف")


def collect_play_state(api: PlayApi) -> dict:
    package_path = f"/applications/{quote(PACKAGE_NAME, safe='')}"
    edit = api.request("POST", package_path + "/edits")
    edit_id = edit.get("id")
    if not edit_id:
        raise RuntimeError("Android Publisher API did not return a temporary edit ID")
    edit_path = package_path + f"/edits/{quote(str(edit_id), safe='')}"
    try:
        edit_info = api.request("GET", edit_path)
        tracks = api.request("GET", edit_path + "/tracks").get("tracks", []) or []
        releases = flatten_releases(tracks)
        bundles = api.request("GET", edit_path + "/bundles").get("bundles", []) or []

        closed_track = next((t for t in tracks if t.get("track") == CLOSED_TRACK_NAME), None)
        production_track = next((t for t in tracks if t.get("track") == "production"), None)
        closed_releases = [r for r in releases if r["track"] == CLOSED_TRACK_NAME]
        production_releases = [r for r in releases if r["track"] == "production"]

        latest_closed = max(closed_releases, key=lambda r: max(r["versionCodes"], default=0), default=None)
        latest_production = max(production_releases, key=lambda r: max(r["versionCodes"], default=0), default=None)

        testers = None
        tester_error = None
        if closed_track is not None:
            try:
                data = api.request("GET", edit_path + f"/testers/{quote(CLOSED_TRACK_NAME, safe='')}")
                testers = {
                    "googleGroupCount": len(data.get("googleGroups", []) or []),
                    "allUsers": bool(data.get("allUsers", False)),
                    "individualEmailListsReadable": False,
                }
            except Exception as exc:
                tester_error = str(exc)[:700]

        all_codes = [code for release in releases for code in release["versionCodes"]]
        return {
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "packageName": PACKAGE_NAME,
            "temporaryEdit": {
                "created": True,
                "expiryTimeSeconds": edit_info.get("expiryTimeSeconds"),
                "deletedAfterInspection": True,
            },
            "repositoryVersion": repo_version_metadata(),
            "highestVersionCodeAcrossTracks": max(all_codes, default=0),
            "closedTesting": {
                "trackFound": closed_track is not None,
                "track": CLOSED_TRACK_NAME,
                "releases": closed_releases,
                "latestRelease": latest_closed,
                "draftCount": sum(r["status"] == "draft" for r in closed_releases),
                "testerConfiguration": testers,
                "testerReadError": tester_error,
            },
            "production": {
                "trackFound": production_track is not None,
                "releases": production_releases,
                "latestRelease": latest_production,
            },
            "knownBundles": [
                {
                    "versionCode": int(item.get("versionCode", 0)),
                    "sha256": item.get("sha256"),
                    "size": item.get("size"),
                }
                for item in bundles
            ],
            "reviewStatus": {
                "value": "not_exposed_by_tracks_endpoint",
                "note": "The tracks API exposes rollout status, not the Play Console pending-review queue.",
            },
        }
    finally:
        # This DELETE discards only the temporary inspection edit created above.
        api.request("DELETE", edit_path)


def display_release(release: dict | None) -> str:
    if not release:
        return "لا يوجد إصدار مسجل في هذا المسار"
    codes = ", ".join(str(code) for code in release.get("versionCodes", [])) or "غير متاح"
    name = f" — الاسم: {release['releaseName']}" if release.get("releaseName") else ""
    return f"versionCode {codes} — الحالة: {arabic_status(release.get('status'))}{name}"


def render_summary(state: dict) -> str:
    closed = state["closedTesting"]
    production = state["production"]
    version = state["repositoryVersion"]
    testers = closed.get("testerConfiguration")
    tester_line = "غير مقروءة"
    if testers is not None:
        tester_line = (
            f"مجموعات Google: {testers['googleGroupCount']}، "
            f"الوصول العام: {'مفعّل' if testers['allUsers'] else 'غير مفعّل'}، "
            "قوائم البريد الفردية لا تعرضها هذه الواجهة البرمجية"
        )
    elif closed.get("testerReadError"):
        tester_line = "تعذرت قراءة إعدادات الجمهور: " + closed["testerReadError"]

    latest_code = state.get("highestVersionCodeAcrossTracks", 0)
    repo_code = version.get("versionCode")
    code_check = "متطابق" if str(repo_code) == str(latest_code) else (
        f"ملف المستودع: {repo_code}؛ أعلى رقم مسجل في Play: {latest_code}"
    )

    if not production.get("trackFound") or not production.get("releases"):
        production_line = "لا يوجد إصدار ظاهر في مسار Production"
    else:
        production_line = display_release(production.get("latestRelease"))

    release = closed.get("latestRelease")
    if not closed.get("trackFound"):
        readiness = "غير جاهز: المسار غير موجود"
    elif not closed.get("releases"):
        readiness = "المسار موجود لكنه لا يحتوي إصداراً"
    elif release and release.get("status") in {"completed", "inProgress"}:
        readiness = "يوجد إصدار متاح أو قيد الطرح؛ يلزم التحقق من جمهور المختبرين"
    elif release and release.get("status") == "draft":
        readiness = "يوجد إصدار مسودة؛ لم يُنشر للمختبرين"
    else:
        readiness = "المسار موجود؛ حالة الإصدار تحتاج مراجعة"

    lines = [
        "# تقرير حالة Google Play — دليلنا",
        "",
        f"- وقت الفحص UTC: {state['checkedAt']}",
        f"- الحزمة: {state['packageName']}",
        f"- versionName من إعدادات المستودع: {version.get('versionName')}",
        f"- أعلى versionCode في مسارات Play: {latest_code}",
        f"- مقارنة رقم الإصدار: {code_check}",
        "",
        "## الاختبار المغلق",
        "",
        f"- المسار: {CLOSED_TRACK_NAME} — {'موجود' if closed.get('trackFound') else 'غير موجود'}",
        f"- أحدث إصدار: {display_release(release)}",
        f"- عدد المسودات: {closed.get('draftCount', 0)}",
        f"- الجاهزية: {readiness}",
        f"- إعدادات الجمهور: {tester_line}",
        "",
        "## مراجعة Google",
        "",
        "- حالة المراجعة المعلقة: لا يعرضها Android Publisher Tracks API مباشرة.",
        "- البيانات أدناه تعرض حالات إصدارات المسارات فقط؛ ولا أستنتج منها وجود/عدم وجود عنصر مراجعة معلق.",
        "",
        "## Production",
        "",
        f"- المسار: {'موجود' if production.get('trackFound') else 'غير موجود'}",
        f"- أحدث إصدار: {production_line}",
        "- لم يتم تعديل هذا المسار.",
        "",
        "## سلامة الفحص",
        "",
        "- قراءة فقط باستخدام GitHub OIDC وGoogle Cloud WIF.",
        "- أُنشئ تحرير مؤقت لقراءة المسارات ثم حُذف.",
        "- لم يتم رفع AAB أو تعديل مسار أو اعتماد تحرير أو إرسال تغييرات للمراجعة.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    try:
        state = collect_play_state(PlayApi())
        summary = render_summary(state)
        print("DALILNA_PLAY_STATUS_JSON=" + json.dumps(state, ensure_ascii=False))
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(summary)
        else:
            print(summary)
        return 0
    except Exception as exc:
        message = "# تقرير حالة Google Play — دليلنا\n\nتعذر إكمال الفحص الحي.\n\n" + str(exc)[:2000] + "\n"
        print(message, file=sys.stderr)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(message)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
