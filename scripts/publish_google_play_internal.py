#!/usr/bin/env python3
"""Promote only the already-uploaded Dalilna 4100101 internal release."""
from __future__ import annotations
import json
import sys
from typing import Any
import google.auth
from google.auth.transport.requests import AuthorizedSession

PACKAGE_NAME = "ye.dalilna.app"
TRACK = "internal"
VERSION_CODE = "4100101"
API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]

class PlayApiError(RuntimeError):
    def __init__(self, method: str, url: str, status: int, body: str) -> None:
        super().__init__(f"{method} {url} returned HTTP {status}: {body[:12000]}")

def call(session: AuthorizedSession, method: str, path: str,
         payload: dict[str, Any] | None = None,
         params: dict[str, str] | None = None) -> dict[str, Any]:
    url = API_ROOT + path
    response = session.request(method, url, json=payload, params=params, timeout=60)
    if not response.ok:
        raise PlayApiError(method, response.url, response.status_code, response.text)
    if response.status_code == 204 or not response.content:
        return {}
    return response.json()

def create_edit(session: AuthorizedSession) -> str:
    result = call(session, "POST", f"/applications/{PACKAGE_NAME}/edits", payload={})
    edit_id = result.get("id")
    if not edit_id:
        raise RuntimeError(f"edits.insert returned no ID: {json.dumps(result)}")
    return str(edit_id)

def delete_edit(session: AuthorizedSession, edit_id: str) -> None:
    url = f"{API_ROOT}/applications/{PACKAGE_NAME}/edits/{edit_id}"
    response = session.delete(url, timeout=60)
    if not response.ok and response.status_code != 404:
        raise PlayApiError("DELETE", response.url, response.status_code, response.text)

def get_track(session: AuthorizedSession, edit_id: str) -> dict[str, Any]:
    return call(session, "GET", f"/applications/{PACKAGE_NAME}/edits/{edit_id}/tracks/{TRACK}")

def get_target_release(track: dict[str, Any]) -> dict[str, Any]:
    found = [r for r in track.get("releases", [])
             if VERSION_CODE in {str(code) for code in r.get("versionCodes", [])}]
    if len(found) != 1:
        state = [{"status": r.get("status"), "versionCodes": r.get("versionCodes", []),
                  "name": r.get("name")} for r in track.get("releases", [])]
        raise RuntimeError(
            f"Expected one internal release containing {VERSION_CODE}; found {len(found)}. "
            f"Track releases: {json.dumps(state, ensure_ascii=False)}"
        )
    return found[0]

def publish_existing_release(session: AuthorizedSession) -> None:
    edit_id = create_edit(session)
    try:
        track = get_track(session, edit_id)
        release = get_target_release(track)
        old_status = release.get("status")
        print(f"PLAY_TRACK_BEFORE={old_status}")
        if old_status != "completed":
            release["status"] = "completed"
            if not release.get("releaseNotes"):
                release["releaseNotes"] = [
                    {"language": "ar", "text":
                     "أول إصدار من دليلنا للاختبار الداخلي. دليل المحلات والخدمات والبحث حسب المنطقة، "
                     "والبحث القريب الاختياري، والوظائف وسوق البيع والشراء."},
                    {"language": "en-US", "text":
                     "First Dalilna release for internal testing. Explore local shops and services, "
                     "nearby search, jobs and buy-and-sell listings."}
                ]
            call(session, "PUT",
                 f"/applications/{PACKAGE_NAME}/edits/{edit_id}/tracks/{TRACK}",
                 payload=track)
            call(session, "POST",
                 f"/applications/{PACKAGE_NAME}/edits/{edit_id}:commit",
                 params={"changesInReviewBehavior": "ERROR_IF_IN_REVIEW"})
            print("PLAY_TRACK_COMMIT=success")
        else:
            print("PLAY_TRACK_COMMIT=already_completed")
    except Exception:
        try:
            delete_edit(session, edit_id)
        except Exception as cleanup_error:
            print(f"::warning::Could not discard temporary Play edit: {cleanup_error}")
        raise
    else:
        delete_edit(session, edit_id)

    verify_id = create_edit(session)
    try:
        verified = get_target_release(get_track(session, verify_id))
        status = verified.get("status")
        print(f"PLAY_TRACK_AFTER={status}")
        if status != "completed":
            raise RuntimeError(f"Internal release status verification failed: {status!r}")
    finally:
        delete_edit(session, verify_id)

LISTINGS = {
    "ar": {
        "title": "دليلنا - دليل اليمن",
        "shortDescription": "ابحث عن المحلات والخدمات والوظائف واستكشف سوق البيع والشراء في اليمن",
        "fullDescription": (
            "دليلنا يجمع معلومات المحلات والخدمات والوظائف وإعلانات البيع والشراء في اليمن ضمن تطبيق واحد.\n\n"
            "استكشف الدليل حسب المحافظة والمديرية والتصنيف، وابحث عن اسم النشاط أو الخدمة. "
            "يمكنك اختيار منطقتك يدوياً، أو تفعيل البحث القريب بعد منح إذن الموقع.\n\n"
            "ماذا يقدم دليلنا؟\n"
            "• دليل للمحلات والخدمات مع بيانات النشاط ووسائل التواصل عندما تتوفر في المصدر.\n"
            "• بحث حسب الاسم والتصنيف والمحافظة والمديرية.\n"
            "• بحث قريب اختياري باستخدام موقع الجهاز.\n"
            "• قسم للوظائف وروابط التقديم عند توفرها.\n"
            "• سوق لإعلانات البيع والشراء، مع مراجعة الإعلانات قبل نشرها.\n"
            "• أسعار استرشادية ومعلومات صرف عند توفر بيانات من مصادرها.\n"
            "• حفظ المفضلة وتفضيلات الاستخدام على الجهاز.\n"
            "• مساعد محلي، مع خيار تفعيل المساعد السحابي بشكل اختياري.\n\n"
            "صُمم دليلنا لمساعدتك على الوصول إلى المعلومات المحلية ومراجعة الخيارات المتاحة. "
            "قد تختلف التغطية وحداثة المعلومات من منطقة إلى أخرى. ظهور محل أو إعلان لا يعني "
            "التحقق الميداني من صاحبه أو ضمان المنتج أو الخدمة.\n\n"
            "لا يعالج الإصدار الحالي مدفوعات البيع والشراء داخل التطبيق. تحقق من بيانات النشاط "
            "والبائع واتفق على الدفع والتسليم مباشرة قبل إتمام أي تعامل.\n\n"
            "يمكنك تصفح الدليل دون إنشاء حساب مركزي. بعض الميزات تحتاج اتصالاً بالإنترنت، "
            "وقد تحتاج ميزة البحث القريب إلى إذن الموقع."
        )
    },
    "en-US": {
        "title": "Dalilna - Yemen Guide",
        "shortDescription": "Find local shops, services, jobs and marketplace listings across Yemen.",
        "fullDescription": (
            "Dalilna brings together information about shops, local services, jobs and marketplace listings across Yemen in one app.\n\n"
            "Explore the directory by governorate, district and category. Search for a business or service by name, "
            "choose an area manually, or enable nearby search after granting location permission.\n\n"
            "What you can do with Dalilna:\n"
            "• Browse shop and service listings with contact details when available from the source.\n"
            "• Search by name, category, governorate and district.\n"
            "• Optionally find nearby places using your device location.\n"
            "• Explore job posts and application links when provided.\n"
            "• Browse buy-and-sell listings submitted by users and reviewed before publication.\n"
            "• Check reference prices and exchange information when source data is available.\n"
            "• Save favourites and preferences on your device.\n"
            "• Use the local assistant or optionally enable the cloud assistant.\n\n"
            "Dalilna helps you find local information and compare available options. Coverage and freshness may vary by area. "
            "A listing does not mean that Dalilna has physically verified a business, seller, product or service.\n\n"
            "The current version does not process marketplace payments inside the app. Verify business and seller details "
            "and agree directly on payment and delivery before completing a transaction.\n\n"
            "You can browse the directory without creating a central account. Some features require an internet connection. "
            "Nearby search may require location permission."
        )
    }
}

def save_store_listings(session: AuthorizedSession) -> None:
    edit_id = create_edit(session)
    try:
        for language, listing in LISTINGS.items():
            call(session, "PUT",
                 f"/applications/{PACKAGE_NAME}/edits/{edit_id}/listings/{language}",
                 payload={"language": language, **listing})
            print(f"STORE_LISTING_UPDATED={language}")
        call(session, "POST",
             f"/applications/{PACKAGE_NAME}/edits/{edit_id}:commit",
             params={
                 "changesNotSentForReview": "true",
                 "changesInReviewBehavior": "ERROR_IF_IN_REVIEW"
             })
        print("STORE_LISTINGS_COMMIT=saved_not_sent_for_review")
    except Exception as error:
        try:
            delete_edit(session, edit_id)
        except Exception as cleanup_error:
            print(f"::warning::Could not discard listing edit: {cleanup_error}")
        print(f"::warning::Store listing update not completed: {error}")
        print("STORE_LISTINGS_COMMIT=not_completed")
    else:
        delete_edit(session, edit_id)

def main() -> int:
    credentials, _ = google.auth.default(scopes=SCOPES)
    session = AuthorizedSession(credentials)
    try:
        publish_existing_release(session)
    except Exception as error:
        print(f"::error::Google Play API rejection: {error}")
        return 1

    save_store_listings(session)
    print(f"PACKAGE_NAME={PACKAGE_NAME}")
    print(f"TRACK={TRACK}")
    print(f"VERSION_CODE={VERSION_CODE}")
    print("RELEASE_STATUS=completed")
    return 0

if __name__ == "__main__":
    sys.exit(main())
