# Dalilna Google Play handoff

Application ID: `ye.dalilna.app`  
Release: `3.1.0` / Google Play internal-track versionCode `4100101` completed; latest signed GitHub AAB versionCode `4128401` uploaded inside an uncommitted Play edit, not committed to a track  
Developer display name: **Dalilna Team**  
Support and privacy email: **dalilnasupport@gmail.com**

## Current Play release and automation state — 27 November 2026

- Google Play package `ye.dalilna.app`, track `internal`, versionCode `4100101` is `completed`. The state was read back successfully through Android Publisher API after the upload and again during the 27 November recheck.
- The successful upload emitted the Internal App Sharing direct link: https://play.google.com/apps/test/ye.dalilna.app/4100101. This is not the internal-testing opt-in link. The latest API read reports zero tester Google Groups and zero tester email lists configured on the internal track.
- The historical listing edit in run `45927261168` failed commit with `HTTP 403 PERMISSION_DENIED`. A later authenticated run `45945373618` accepted Arabic/English listing updates and image uploads inside an edit, but the commit returned `HTTP 400 INVALID_ARGUMENT`: `changesNotSentForReview` is not accepted for the app's current state. This newer response is not a permissions denial; app-scoped `Manage store presence` is not proven to be the current blocker.
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
- Current Android package: `ye.dalilna.app`, versionName `3.1.0`, versionCode `4128401`.
- Android build run [45943431867](https://github.com/baraagpt6-droid/dalilna/actions/runs/45943431867) completed successfully. Release AAB and APK signatures and version metadata passed verification; the GitHub Release was updated.
- AAB: 8,838,161 bytes, SHA-256 `3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026`.
- APK: 6,715,031 bytes, SHA-256 `2664437d32bea2a0c9c09eef60700aa71a65cd3c995a19a8d855dcf79851e1e7`.
- Public directory / marketplace verification run [45939045681](https://github.com/baraagpt6-droid/dalilna/actions/runs/45939045681) succeeded, including live Render and DB probes.
- Play still shows the completed internal release `4100101` and the pre-existing Closed Testing draft `3127701`. AAB `4128401`, listing updates and images were uploaded/staged within edit `13370413812168476918`; the edit was not committed, so no new track release or live store listing change is confirmed.
- The service-account workflow authenticated via WIF, but store-listing commit returned HTTP 403. No closed-test opt-in link or new tester list has been confirmed.


## Closed testing preflight — 27 November 2026

The current `Dalilna Closed Testing` track already contains one unsubmitted `draft` release named `3127701 (3.1.0)`, versionCode `3127701`. Android Publisher read-back confirms the highest code across all app tracks is `4100101` (completed on internal). The current signed GitHub AAB is `4128401`, higher than both. Run `45945373618` attempted to replace the older draft and stage its assets, but Google rejected the edit commit. No new closed-testing release was committed. The track's currently committed draft remains `3127701`.

The Android Publisher Testers API exposes Google Groups but not saved individual email lists. The current edit read returned zero Google Groups and `allUsers=false`. The existing account-wide `Hubaish Testers` email list was not copied, renamed, deleted or altered. No opt-in link is confirmed.

## Latest Play API result and safe review gate — 27 November 2026

- Workflow: [run 45945373618](https://github.com/baraagpt6-droid/dalilna/actions/runs/45945373618).
- WIF/OIDC authentication, AAB SHA-256 validation, screenshot capture and asset preparation succeeded.
- The edit read-back found `Dalilna Closed Testing` Draft `3127701` and highest versionCode `4100101` across tracks.
- Within the uncommitted edit `13370413812168476918`, API calls accepted the Arabic and English listing payloads, icon, feature graphic, four phone screenshots and four tablet screenshots for each locale. The signed AAB `4128401` was also uploaded into that edit.
- Tester precheck: `googleGroupCount=0`, `allUsers=false`. No email list was changed.
- `edits.commit` failed with HTTP 400 `INVALID_ARGUMENT`: `changesNotSentForReview` is not accepted for the app's current state. The edit was not committed. No new track version, saved listing, live artwork or review submission is confirmed.
- Google documents `changesNotSentForReview` for rejection scenarios; it is not a general-purpose save-as-draft option. Without that parameter, an API commit sends the app's pending changes for review when no existing review blocks it. `changesInReviewBehavior=ERROR_IF_IN_REVIEW` only prevents cancelling an existing review; it does not prevent submitting a new one.
- The UI alternative is Play Console → Publishing overview → Changes not yet sent for review → Save for later. This requires the signed-in Console UI; no app connector currently exposes this action. The available browser runner has a negative wallet balance, and no paid top-up was made.
- The Play workflow now separates read-only inspection from explicit review submission. Routine pushes can run only the read-only inspection marker. A review submission requires a manual `SUBMIT_FOR_REVIEW` mode and affirmative Dalilna-only scope.
- Account-level `Account admin`, billing, financial details, and the separate `com.hubaish.guide` app were not changed.
## Read-only Play edit inspection — 27 November 2026

- Read-only inspection run: [45947016030](https://github.com/baraagpt6-droid/dalilna/actions/runs/45947016030) — success. It reused the existing edit 13370413812168476918; no new edit was created and no write operation was performed.
- The current edit's track snapshot contains internal 4100101 completed and Dalilna Closed Testing 4128401 draft. Production, beta and alpha contain no releases in the snapshot.
- The bundle list contains 3127701, 4100101 and 4128401. The AAB 4128401 SHA-256 reported by Play is 3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026, matching the GitHub Release artifact.
- The Arabic listing in the edit has title دليلنا — دليل اليمن, short description length 71 and full description length 1,400. The English listing has title Dalilna — Yemen Directory, short description length 70 and full description length 1,669.
- Both locales show one icon, one feature graphic, four phone screenshots and four 10-inch tablet screenshots in the edit. The image metadata endpoint returned no dimensions; the asset preparation workflow had previously validated 512×512 icon and 1024×500 feature graphic before upload.
- Tester read-back remains zero Google Groups and allUsers=false. Saved email lists remain unavailable through Android Publisher API and were not accessed.
- This data belongs to an uncommitted API edit. It is not evidence that the current Play track has been updated, that store listing changes are live, that testers can opt in, or that Google has reviewed the release.
- The edit must be held or committed through the Console publishing workflow. API commit without a rejection-only hold parameter would send the edit to Google review. The current workflow defaults to read-only inspection and has a separate manual review-submission mode.