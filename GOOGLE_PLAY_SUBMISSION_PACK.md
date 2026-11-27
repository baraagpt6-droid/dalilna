# Dalilna 3.1.0 — Google Play submission pack

Application ID: `ye.dalilna.app`  
App version: `3.1.0`  
Google Play internal-track AAB: versionCode `4100101` — status `completed`. Latest GitHub signed AAB: versionCode `4128601`; it is now staged as a Closed Testing draft in existing uncommitted Edit `13370413812168476918` (run `45952854092`). The edit remains uncommitted and has not been sent for review.  
Target SDK: 36  
Developer display name proposed in the listing: `Dalilna Team` — confirm it matches the Play Console publisher profile.  
Support/privacy contact: `dalilnasupport@gmail.com`

## Canonical listing content

The active Arabic and English Google Play listing payload is defined in:
- [Internal release/listing API payload](./scripts/publish_google_play_internal.py) — authoritative title, short description and full description for `ar` and `en-US`.
- [Launch checklist and copy](./GOOGLE_PLAY_LAUNCH_CHECKLIST.md) — reviewer access instructions, bilingual release notes, category and store copy.

The Arabic and English listing metadata and existing image groups are staged inside Play edit `13370413812168476918`. The STAGE_ONLY run `45952854092` updated the draft and performed a read-only API check. The edit remains uncommitted; these changes are not yet a live listing or an active tester release. A prior commit attempt returned HTTP 400 when trying to hold changes with `changesNotSentForReview`; do not retry by omitting that parameter because the Publishing API would submit the changes for review.

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

The GitHub Release is separate from the Play internal-track artifact. The internal track remains at versionCode `4100101` (completed). AAB `4128601` was uploaded into the existing uncommitted Closed Testing edit and verified by a post-stage API read; no new AAB build was created for the STAGE_ONLY operation.

## Remaining Play Console work

1. Confirm that the app-scoped Play Console permissions are sufficient. Do not grant Account admin or account-wide access without a specific need.
2. Add the intended Dalilna tester accounts or a Dalilna-only Google Group to Closed Testing in Play Console. Current API read-back shows zero Google Groups and `allUsers=false`; individual saved email lists are not readable through Android Publisher API. Do not use the Hubaish tester list.
3. After enabling the test track in Console, retrieve the official Opt-in link and verify it with a tester account. The Internal App Sharing URL is not an Opt-in link.
4. Complete Ads, Target audience, App access, IARC and any required App content declarations in Play Console.
5. Review the 782-row Data Safety CSV against the actual service-provider contracts before importing it. Importing replaces existing answers; the CSV has not been imported.
6. Inspect the existing icon, feature graphic and screenshot assets in the Console UI. API read-back confirms their counts in the uncommitted edit but did not expose image dimensions or allow visual review.
7. Review the closed-test feedback and Pre-launch report after the test release becomes available. For personal developer accounts created after 13 November 2023, Google currently requires at least 12 continuously opted-in testers for 14 days before a Production access application. Verify whether this applies to the account.



## Automation status

- Internal track `4100101`: completed and verified by API read-back.
- Closed Testing draft `4128601`: staged in existing uncommitted edit `13370413812168476918` by run `45952854092`; post-stage API verification succeeded.
- WIF/OIDC authentication succeeded in the Stage Only run.
- Stage Only did not call `edits.validate` or `edits.commit`; the review-submission step was skipped.
- Tester configuration was not modified. No Google Groups are configured; individual saved email lists are not readable through the Publisher API.
- Existing listing image groups were preserved. API counts are available, but dimensions and visual quality still need Console review.
- Production rollout: not performed.




## Latest signed GitHub artifact — 27 November 2026

- Current app package: `ye.dalilna.app`
- Version name: `3.1.0`
- Signed AAB versionCode: `4128601`
- AAB SHA-256: `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`
- AAB size: 8,838,656 bytes
- APK SHA-256: `88ab10f58bfb4296951fa97144b501da9c5b7e5296b8c79fcc5fc3589249ad11`
- Build: [GitHub Actions 45943431867](https://github.com/baraagpt6-droid/dalilna/actions/runs/45943431867)
- The completed Play internal track is still versionCode `4100101`. The newer AAB is also staged as a draft inside the uncommitted Closed Testing edit `13370413812168476918`; it is not committed or live.


## Closed test preflight snapshot before STAGE_ONLY — 27 November 2026

- Existing `Dalilna Closed Testing` release: Draft versionCode `3127701`.
- Highest versionCode on other app tracks: `4100101` (internal, completed).
- Current verified signed AAB: `4128601`.
- At the time of this preflight snapshot, the earlier draft was `3127701`; the later STAGE_ONLY run updated the draft within the existing uncommitted Edit to `4128601` without committing it.
- No tester email lists or other app tracks are modified.

## Latest Google Play API state — 27 November 2026

Run [45945373618](https://github.com/baraagpt6-droid/dalilna/actions/runs/45945373618) successfully authenticated with WIF, uploaded the current AAB and staged the Arabic/English listings and generated artwork in Edit `13370413812168476918`. It read the committed closed-testing release `3127701` and tester configuration (`0` Google Groups, `allUsers=false`). Commit returned HTTP 400 `INVALID_ARGUMENT` because `changesNotSentForReview` is not allowed in the current app state. The edit was not committed; no new testing release or live store listing is confirmed. Do not retry without the parameter because Google says the API would submit the app changes for review.
## Read-only API confirmation before STAGE_ONLY — 27 November 2026

Run 45947016030 inspected existing edit 13370413812168476918 without creating a new edit or changing data. The edit contains bundle 4128401 with SHA-256 3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026, Arabic and English listings, icon, feature graphic, four phone screenshots and four tablet screenshots per locale. The custom closed-testing track within this edit has a draft for 4128401. The tester configuration in the edit is zero Google Groups and allUsers=false.

This was the pre-stage snapshot. The later STAGE_ONLY run updated the same edit to versionCode `4128601` and verified it by API read-back. It remains uncommitted; the committed track was not changed by the staging operation, and no opt-in link or tester membership is active. Submission remains a separate action.
## Latest signed artifact — Build #286

- Workflow: [45949440829](https://github.com/baraagpt6-droid/dalilna/actions/runs/45949440829).
- versionCode: `4128601`.
- AAB SHA-256: `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`.
- APK SHA-256: `88ab10f58bfb4296951fa97144b501da9c5b7e5296b8c79fcc5fc3589249ad11`.
- Build signing and signature verification passed. The artifact was staged to the existing uncommitted Play edit `13370413812168476918` by run `45952854092`; the post-stage API read confirmed versionCode `4128601` and the pinned SHA-256.

## STAGE_ONLY API verification — 27 November 2026

- GitHub Actions run [45952854092](https://github.com/baraagpt6-droid/dalilna/actions/runs/45952854092): `success`.
- Main commit: `d3ea0f9a26ba6c86d1c806c05ab010c62dc057cd`.
- Package: `ye.dalilna.app`; versionName `3.1.0`; versionCode `4128601`.
- Existing Google Play Edit reused: `13370413812168476918`.
- AAB SHA-256 from Google Play API: `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`.
- Closed Testing release inside the edit: `draft`, versionCode `4128601`.
- Highest versionCode in the edit read-back: `4128601`.
- Image groups present in both locales: one icon, one feature graphic, four phone screenshots and four 10-inch tablet screenshots; previous images were preserved. API did not return dimensions in this inspection.
- Testers: `googleGroupCount=0`, `allUsers=false`; individual email lists are not readable via this API.
- `changesCommitted=false`, `changesSentForReview=false`; the review-submission step was skipped.
- Production and rollout were not touched. The edit remains uncommitted and is not yet available to testers.
