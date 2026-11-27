# Dalilna Google Play handoff

Application ID: `ye.dalilna.app`  
Release: `3.1.0` / Google Play internal-track versionCode `4100101` completed; latest signed GitHub AAB versionCode `4128301` (not yet uploaded to Play)  
Developer display name: **Dalilna Team**  
Support and privacy email: **dalilnasupport@gmail.com**

## Current Play release and automation state — 27 November 2026

- Google Play package `ye.dalilna.app`, track `internal`, versionCode `4100101` is `completed`. The state was read back successfully through Android Publisher API after the upload and again during the 27 November recheck.
- The successful upload emitted the Internal App Sharing direct link: https://play.google.com/apps/test/ye.dalilna.app/4100101. This is not the internal-testing opt-in link. The latest API read reports zero tester Google Groups and zero tester email lists configured on the internal track.
- The Arabic (`ar`) and English (`en-US`) listing payloads are in `scripts/publish_google_play_internal.py`. The API accepted each listing PUT but rejected edit commit with `HTTP 403 PERMISSION_DENIED`. Required app-scoped permission: `Manage store presence` for service account `dalilna-play-automation@dalilna-play-automation-516000.iam.gserviceaccount.com`.
- Bilingual privacy policy: https://baraagpt6-droid.github.io/dalilna/privacy.html
- Data deletion request page: https://baraagpt6-droid.github.io/dalilna/data-deletion.html
- Data Safety import file: `data-safety.csv`; source mapping: `GOOGLE_PLAY_DATA_SAFETY.md`. The CSV has not been imported into Play Console. Internal-only testing does not require the Data safety form; re-evaluate before closed/open/production distribution.
- GitHub Release `v3.1.0` is published. [Run 45927435699](https://github.com/baraagpt6-droid/dalilna/actions/runs/45927435699) downloaded the existing APK/AAB, verified SHA-256 against GitHub's asset digests, exercised `gh release edit` and `gh release upload --clobber` against the same files, then verified the post-upload digests remained identical. This tests the replacement for `softprops/action-gh-release` without Gradle or a new Play upload.
- The latest 27 November API recheck [run 45927261168](https://github.com/baraagpt6-droid/dalilna/actions/runs/45927261168) reconfirmed track completion, found zero internal tester groups and zero email lists, and failed only when committing the store-listing edit with HTTP 403 `PERMISSION_DENIED`.
- The daily sync [run 45926160978](https://github.com/baraagpt6-droid/dalilna/actions/runs/45926160978), public app verification [run 45926198717](https://github.com/baraagpt6-droid/dalilna/actions/runs/45926198717), and GitHub Pages deployment/smoke test [run 45925900760](https://github.com/baraagpt6-droid/dalilna/actions/runs/45925900760) passed.
- Current repository metadata in root `version.json` reflects the web/OTA source version code and is not the Google Play internal AAB version code. Treat Play's API read-back as the source of truth for the installed internal bundle.
- No production rollout, billing change, new AAB upload or signing-key change was performed in this 27 November handoff.

## Historical production verification — 26 November 2026

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
- `versionCode=3127401` (Android build workflow run #274)
- `applicationId=ye.dalilna.app`
- `targetSdk=36`
- `compileSdk=36`
- Persistent signing is configured.
- [Android build workflow run #274](https://github.com/baraagpt6-droid/dalilna/actions/runs/45731324533) completed successfully. It built and verified the persistent-signed APK/AAB, checked their package/version metadata and published both files to Release v3.1.0. Current published assets: APK 6,708,776 bytes; AAB 8,831,823 bytes. OTA metadata is synchronized at versionCode `3127401` in the root and Android-bundled `version.json` files.

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


## Latest signed GitHub artifact — 27 November 2026

- Main commit: `84ca8b10b7ae81794285fb8e2fb321d5b5317d6f` before this Closed Testing automation PR.
- Current Android package: `ye.dalilna.app`, versionName `3.1.0`, versionCode `4128301`.
- Android build run [45939045693](https://github.com/baraagpt6-droid/dalilna/actions/runs/45939045693) completed successfully. Release AAB and APK signatures and version metadata passed verification; the GitHub Release was updated.
- AAB: 8,838,161 bytes, SHA-256 `000bad420c5b6844c3ee6552dc2eb8364a51ddcef263bfc756b36e82d88ff86e`.
- APK: 6,715,031 bytes, SHA-256 `dae102c1370a8e69f58ce0b31321c81e01c1a64044a1705999495bc46bef7813`.
- Public directory / marketplace verification run [45939045681](https://github.com/baraagpt6-droid/dalilna/actions/runs/45939045681) succeeded, including live Render and DB probes.
- Play still shows the previously completed internal release `4100101`; the new `4128301` AAB has not been uploaded to Google Play.
- The service-account workflow authenticated via WIF, but store-listing commit returned HTTP 403. No closed-test opt-in link or new tester list has been confirmed.
