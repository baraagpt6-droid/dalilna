# Dalilna Google Play handoff

Application ID: `ye.dalilna.app`  
Release: `3.1.0` / latest completed Android build versionCode `3127301`  
Developer display name: **Dalilna Team**  
Support and privacy email: **dalilnasupport@gmail.com**

## Current production verification — 26 November 2026

The active application API is **`dalilna-live`**:
- Base URL: https://dalilna-live.onrender.com
- Render workspace: My Workspace
- Region: Frankfurt
- Deployment branch: `main`
- Search fallback fix: `3e4fe6cf83d96a84f7406c23e3f901bd1ccf6d04` — English governorate aliases and local-first category search.
- Latest marketplace API fix: `f019509a16896af7d9f7e591fd373ce3f71ad5ba` — removed a duplicate SQL bind value that could reject new listing submissions.
- Latest Render deployment: `dep-dc3nucjbc2fs738q3hd0` — succeeded and live.
- The later documentation commits also deployed successfully.

Verified live endpoints:
- `GET /health`: HTTP 200, `ok:true`.
- `GET /api/marketplace/status`: HTTP 200, `ready:true`, database configured.
- `GET /api/geoapify/status`: `geoapifyEnabled:true`.
- A Geoapify coordinate search returned 20 results.
- English-place searches for Ibb and Sanaa return local index results. Ibb pharmacy results all resolve to governorate إب. Application logs show the local-first search path completed in approximately 100 ms during the final test.
- The earlier 503s came from upstream geocoding/map-provider errors and unnecessary waits. The Photon language parameter was corrected, English governorate aliases were added, and recognized category searches now use the national catalogue before slow map mirrors. Overpass mirrors remain external dependencies and may still be unavailable; local index results cover the tested category searches.

The app source and Android assets use `https://dalilna-live.onrender.com`. A second Render service named `dalilna-directory-api` exists but is not the API URL embedded in the app. Its status endpoints reported no database connection and no Geoapify key. It was left untouched to avoid breaking any external integration.

## Database and data lifecycle

The active database is Neon project **`dalilna-production-frankfurt`**, region `aws-eu-central-1`, database `neondb`, PostgreSQL 18.7, default branch `production`.

- The Render service connects successfully. The marketplace readiness endpoint reports the database ready.
- Migrations 1, 2 and 3 are applied.
- The expected tables and indexes exist: `marketplace_listings`, `job_seekers`, `marketplace_moderation_log`, `marketplace_seller_blocks`, `marketplace_ugc_reports`, and `dalilna_schema_migrations`.
- The listings, job-seeker, moderation, seller-block and UGC-report tables contained zero rows at the time of the read-only audit. The migration table contains three migration records.
- Neon `history_retention_seconds` is **21,600 seconds (6 hours)**. This is the database point-in-time recovery/history window. It is not a scheduled deletion period for user data.
- The current marketplace API submits pending listings with `expires_at=NULL`. On approval, souq/land listings receive 60 days; jobs receive up to 60 days, capped by the deadline; other listing categories may receive no expiry. Job-seeker profiles default to 60 days. **Expiry only hides records from public results; it does not physically delete rows.** No scheduled database purge exists in the repository.
- Schema drift found: the live `marketplace_listings.expires_at` column has a legacy database default of 120 days, while `db/schema.sql` specifies a nullable column with no default. The active submit API explicitly writes `NULL` and the approval route assigns category-specific expiry, so the legacy default does not apply to the current submission path. Normalize this default in a separate approved migration before any future insert path relies on it.
- Render log retention is controlled by the workspace plan. The workspace subscription level was not exposed by the inspected account metadata, so an exact Render log-retention period is not asserted here.

The marketplace insert mismatch was fixed in `marketplace-api.js`: the SQL uses 23 placeholders and the value array now contains 23 values. The full CI verification then passed in [GitHub Actions run #386](https://github.com/baraagpt6-droid/dalilna/actions/runs/45731324373) at commit `e33ebd3db2b7e565cd8770b3cfbb151c64c58297`: all 249 unit/UI tests passed, all 8 mocked open-data HTTP checks passed, and the live Render API, Geoapify, Commons, marketplace database and jobs endpoint checks passed. No production marketplace POST was made, so no test listing was inserted into the live database.

No database writes, deletions, migrations or retention-setting changes were made during this audit.

## Android release assets

The signed production release already exists:
- [Signed AAB — app-release.aab](https://github.com/baraagpt6-droid/dalilna/releases/download/v3.1.0/app-release.aab)
- [Signed APK — app-release.apk](https://github.com/baraagpt6-droid/dalilna/releases/download/v3.1.0/app-release.apk)
- [GitHub Release v3.1.0](https://github.com/baraagpt6-droid/dalilna/releases/tag/v3.1.0)

Release facts:
- `versionName=3.1.0`
- `versionCode=3127301` (Android build workflow run #273)
- `applicationId=ye.dalilna.app`
- `targetSdk=36`
- `compileSdk=36`
- Persistent signing is configured.
- [Android build workflow run #273](https://github.com/baraagpt6-droid/dalilna/actions/runs/45731239656) completed successfully. It built and verified the persistent-signed APK/AAB and published both files to Release v3.1.0. Published assets at the time of this handoff: APK 6,708,780 bytes; AAB 8,831,821 bytes. A second build run #274 is currently running because an earlier test-script commit also matched the Android workflow path filter; it may publish a higher OTA code. Recheck `version.json` and Release assets after it completes.

The Google Play screenshot workflow also completed successfully:
- [Screenshot workflow run](https://github.com/baraagpt6-droid/dalilna/actions/runs/45678040821)
- Artifact: `dalilna-play-screenshots` (ZIP, approximately 1.4 MB)
- Artifact ID: `15052333473`
- Retention expiry: 25 December 2026.
- The workflow captured phone and tablet screenshots and uploaded the ZIP artifact.

The repository currently does **not** contain a separately exported Play Store 512×512 PNG app icon or a 1024×500 feature graphic. The existing SVG/app launcher resource is not a substitute for verifying and uploading those Play Console assets.

## Data Safety, privacy and access

The source-based worksheet is in `GOOGLE_PLAY_DATA_SAFETY.md`; store copy and reviewer guidance are in `GOOGLE_PLAY_SUBMISSION_PACK.md`.

- The app has no central customer or merchant login. Public browsing is available without signing in.
- The app includes Google Mobile Ads and UMP. Ads must be declared.
- User-submitted listings/photos, location use, search terms and optional Web Speech microphone recognition are described in the Data Safety worksheet.
- The cloud Gemini assistant is configured, but an earlier end-to-end audit recorded an intermittent upstream 502. The local assistant fallback exists. Perform one consented cloud-assistant test in the Play pre-launch/device test before treating that optional feature as fully verified.
- The support/privacy mailbox is shown as `dalilnasupport@gmail.com` in public privacy and terms pages. The app owner must keep the mailbox monitored; inbox monitoring was not verified in this audit.
- Server-side deletion requests are handled manually. Local app-data deletion does not remove a server submission.

## Remaining Play Console steps

The signed AAB and screenshot ZIP are available, but the app has **not** been uploaded or submitted to Google Play Console by this audit.

Before submission:
1. Export and upload the 512×512 PNG app icon and 1024×500 feature graphic.
2. Upload the existing phone/tablet screenshot ZIP contents to the Store listing.
3. Complete the store listing, contact details, category, app access, target audience and content-rating forms in Play Console.
4. Enter and verify every Data Safety answer against `GOOGLE_PLAY_DATA_SAFETY.md`, including Ads, location, user-generated content and voice recognition.
5. Test the production AAB in Internal testing, including location permission, microphone disclosure, UMP/ads, marketplace flows, the local assistant and one consented Gemini request.
6. Check whether this Play Console account is subject to the 12-testers/14-days Closed testing requirement. That requirement depends on the account type and creation date.
7. Review the pre-launch report, then create and submit the Production release.

The technical release artifacts are built and signed. Store listing assets and Play Console declarations/review remain owner-side gates. No Play Console submission or publication was performed.
