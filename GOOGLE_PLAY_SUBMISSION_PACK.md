# Dalilna 3.1.0 — Google Play submission pack

Application ID: `ye.dalilna.app`  
App version: `3.1.0`  
Google Play internal-track AAB: versionCode `4100101` — status `completed`. Latest GitHub signed AAB: versionCode `4128601`; the preceding `4128401` bundle is staged inside the current uncommitted edit, and the latest AAB still needs to be staged there.  
Target SDK: 36  
Developer display name proposed in the listing: `Dalilna Team` — confirm it matches the Play Console publisher profile.  
Support/privacy contact: `dalilnasupport@gmail.com`

## Canonical listing content

The active Arabic and English Google Play listing payload is defined in:
- [Internal release/listing API payload](./scripts/publish_google_play_internal.py) — authoritative title, short description and full description for `ar` and `en-US`.
- [Launch checklist and copy](./GOOGLE_PLAY_LAUNCH_CHECKLIST.md) — reviewer access instructions, bilingual release notes, category and store copy.

The current listing content for both languages and the associated image groups were uploaded within Play edit `13370413812168476918`. Google rejected the edit commit with HTTP 400 `INVALID_ARGUMENT` because `changesNotSentForReview` is not accepted for the app's current state. Do not treat those assets as saved to the Play listing until the Console Publishing overview confirms the pending changes or the API confirms an approved submission.

## Public URLs

- Application: https://baraagpt6-droid.github.io/dalilna/
- Store/website page: https://baraagpt6-droid.github.io/dalilna/store/
- Privacy policy: https://baraagpt6-droid.github.io/dalilna/privacy.html
- Data deletion requests: https://baraagpt6-droid.github.io/dalilna/data-deletion.html
- Terms: https://baraagpt6-droid.github.io/dalilna/terms.html
- AdMob app-ads declaration: https://baraagpt6-droid.github.io/dalilna/app-ads.txt

## Data Safety and privacy

- Source review: [GOOGLE_PLAY_DATA_SAFETY.md](./GOOGLE_PLAY_DATA_SAFETY.md)
- Prepared Google Play import file: [data-safety.csv](./data-safety.csv)
- Data deletion request instructions: [data-deletion.html](./data-deletion.html)

The CSV has 782 answer rows and uses the published Google Play Data safety import schema. It does not select home or mailing address. Its sharing flags are limited to the automatically shared Google Mobile Ads SDK disclosures; review the user-initiated transfer exception and provider contracts before importing. It is prepared from the inspected Android manifest, WebView flows, listing/job-seeker forms, marketplace API and Google Mobile Ads SDK 25.5.0 disclosure. It has **not** been imported into Play Console. Review the classifications against the real service-provider contracts before importing; Google Play warns that CSV import replaces existing form answers. The Data safety form is exempt while the app is distributed only on the internal testing track.

## Internal testing

- Track: `internal`
- Version code: `4100101`
- Release status: `completed` (verified after API read-back)
- Internal App Sharing direct link emitted by the successful upload action: https://play.google.com/apps/test/ye.dalilna.app/4100101

The link above is an Internal App Sharing download link, **not** the Play internal-testing opt-in link. The latest API read reports zero tester Google Groups and zero tester email lists. Add the intended testers in Play Console, save the list, and copy the official opt-in link. Do not use this Internal App Sharing URL as the opt-in link.

## GitHub release artifacts

- [GitHub Release v3.1.0](https://github.com/baraagpt6-droid/dalilna/releases/tag/v3.1.0)
- [APK](https://github.com/baraagpt6-droid/dalilna/releases/download/v3.1.0/app-release.apk)
- [AAB](https://github.com/baraagpt6-droid/dalilna/releases/download/v3.1.0/app-release.aab)

The GitHub Release is separate from the Play internal-track artifact. The current Play track contains versionCode `4100101`; verify an artifact's embedded versionCode before reusing it for a future upload. No new AAB was built or uploaded during the 27 November permission/API recheck.

## Remaining Play Console work

1. Verify app-scoped permissions from Play Console. The newest 400 error is not evidence of a missing permission; do not grant Account admin or account-wide permissions.
2. Add the internal tester Google accounts or a Google Group, save the tester list and retrieve the track's opt-in link. The current track has zero configured tester groups and zero email lists.
3. Complete Ads, target audience, App access, IARC content rating and any required declarations in Play Console.
4. Upload the final 512 × 512 PNG app icon, 1024 × 500 feature graphic and captured screenshots. The repository audit found the SVG icon and screenshot workflow artifact, but no verified 512 × 512 Play icon PNG or 1024 × 500 feature graphic.
5. For a future closed/open/production track, review and submit the Data safety CSV and all required Play Console declarations. Do not assume the internal-only exemption applies to other tracks.

## Automation status

- Internal track `4100101`: completed and verified.
- Arabic and English store listings and artwork: staged in API edit; commit rejected with HTTP 400 because the current API commit mode sends changes for review automatically.
- GitHub Release publish step: changed to use GitHub CLI with explicit tag `v3.1.0`; separate no-build asset audit passes. The release upload step itself has not been re-executed because the task constraint forbids an unnecessary AAB build.
- WIF/OIDC and signing secrets: unchanged.
- Production rollout: not performed.


## Latest signed GitHub artifact — 27 November 2026

- Current app package: `ye.dalilna.app`
- Version name: `3.1.0`
- Signed AAB versionCode: `4128601`
- AAB SHA-256: `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`
- AAB size: 8,838,656 bytes
- APK SHA-256: `88ab10f58bfb4296951fa97144b501da9c5b7e5296b8c79fcc5fc3589249ad11`
- Build: [GitHub Actions 45943431867](https://github.com/baraagpt6-droid/dalilna/actions/runs/45943431867)
- The completed Play internal track is still versionCode `4100101`. The newer AAB is only published as a GitHub Release asset at this checkpoint.


## Closed test preflight state — 27 November 2026

- Existing `Dalilna Closed Testing` release: Draft versionCode `3127701`.
- Highest versionCode on other app tracks: `4100101` (internal, completed).
- Current verified signed AAB: `4128601`.
- The older draft has not yet been updated in the committed track. A later API Edit staged the replacement but could not be committed without sending changes for review.
- No tester email lists or other app tracks are modified.

## Latest Google Play API state — 27 November 2026

Run [45945373618](https://github.com/baraagpt6-droid/dalilna/actions/runs/45945373618) successfully authenticated with WIF, uploaded the current AAB and staged the Arabic/English listings and generated artwork in Edit `13370413812168476918`. It read the committed closed-testing release `3127701` and tester configuration (`0` Google Groups, `allUsers=false`). Commit returned HTTP 400 `INVALID_ARGUMENT` because `changesNotSentForReview` is not allowed in the current app state. The edit was not committed; no new testing release or live store listing is confirmed. Do not retry without the parameter because Google says the API would submit the app changes for review.
## Read-only API confirmation — 27 November 2026

Run 45947016030 inspected existing edit 13370413812168476918 without creating a new edit or changing data. The edit contains bundle 4128401 with SHA-256 3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026, Arabic and English listings, icon, feature graphic, four phone screenshots and four tablet screenshots per locale. The custom closed-testing track within this edit has a draft for 4128401. The tester configuration in the edit is zero Google Groups and allUsers=false.

This is still an uncommitted edit. The committed track has not been changed; the listing is not confirmed live and no opt-in link or tester membership is active. The Publishing API would submit the edit for review if committed in the current app state. Keep the INSPECT_ONLY mode until all account-specific declarations and tester setup are complete.
## Latest signed artifact — Build #286

- Workflow: [45949440829](https://github.com/baraagpt6-droid/dalilna/actions/runs/45949440829).
- versionCode: `4128601`.
- AAB SHA-256: `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`.
- APK SHA-256: `88ab10f58bfb4296951fa97144b501da9c5b7e5296b8c79fcc5fc3589249ad11`.
- Build signing and signature verification passed. The artifact has not yet been staged to Play.