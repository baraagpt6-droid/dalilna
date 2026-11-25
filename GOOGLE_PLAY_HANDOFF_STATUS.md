# Dalilna Google Play handoff

Application ID: `ye.dalilna.app`  
Release: `3.1.0` / `3127201`  
Developer display name: **Dalilna Team** — the app owner's official team/brand name; use the same name as the publisher display name in Play Console.  
Support and privacy email: **dalilnasupport@gmail.com** (provided by the app owner).

## Verified release assets

- The signed AAB remains the existing file in release `v3.1.0`; this handoff commit does not change `version.json`, Android Gradle versioning, release tags, APK or AAB.
- Public browsing does not require sign-in. The administrator interface is separate and is not required for Play reviewer access.
- The public privacy policy, terms and store landing page use `dalilnasupport@gmail.com`.
- Android voice search uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) through WebView. The app requests microphone permission only after user action and Android permission. Raw audio is not posted to the Dalilna API; the system/WebView speech provider may process it locally or remotely. Data Safety declares voice audio conservatively as collected/shared with that provider.
- Server search logs record search text, place/area, category and request origin. Marketplace operational logs record event identifiers and report metadata; normal request logs do not store full listing bodies or raw audio.
- PostgreSQL stores shared listings, submitted contact details, images, job-seeker profiles and reports. Expiry hides some records from public results but does not physically delete them. Souq/land listings normally expire after 60 days, jobs at deadline or 60 days, and job-seeker profiles after 60 days. The source contains no automatic purge of expired rows. Render log and database-backup retention is controlled outside the repository.
- The code uses the local places index first, then Geoapify when configured, and OpenStreetMap Nominatim, Photon and Overpass fallback providers. The live Render status endpoints returned HTTP 503 during this review, so the active provider configuration could not be confirmed at runtime.

## Public links

- Website: https://baraagpt6-droid.github.io/dalilna/store/
- App: https://baraagpt6-droid.github.io/dalilna/
- Privacy policy: https://baraagpt6-droid.github.io/dalilna/privacy.html
- Terms: https://baraagpt6-droid.github.io/dalilna/terms.html

## Handoff

- [x] Official support/privacy email reflected in public pages and Android policy assets.
- [x] Developer display name stated consistently as Dalilna Team.
- [x] Source-level voice-recognition behavior and third-party providers documented.
- [x] Server log fields and database expiry/deletion behavior documented.
- [x] Data Safety worksheet updated to match the checked code and SDK disclosures.
- [x] Android release workflow excludes policy/documentation-only changes so this commit does not rebuild or replace release binaries.
- [ ] The app owner must select the correct Render workspace to inspect service settings. The public health/status endpoints returned HTTP 503 during this review; no Render settings were changed.
- [ ] Keep the owner-provided Gmail inbox monitored for deletion and support requests.
