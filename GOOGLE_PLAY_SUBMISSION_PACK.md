# Dalilna 3.1.0 — Google Play submission pack

Application ID: `ye.dalilna.app`  
App version: `3.1.0`  
Google Play internal-track AAB: versionCode `4100101` — status `completed`. Latest GitHub signed AAB: versionCode `4128301`, not yet uploaded to Play.  
Target SDK: 36  
Developer display name proposed in the listing: `Dalilna Team` — confirm it matches the Play Console publisher profile.  
Support/privacy contact: `dalilnasupport@gmail.com`

## Canonical listing content

The active Arabic and English Google Play listing payload is defined in:
- [Internal release/listing API payload](./scripts/publish_google_play_internal.py) — authoritative title, short description and full description for `ar` and `en-US`.
- [Launch checklist and copy](./GOOGLE_PLAY_LAUNCH_CHECKLIST.md) — reviewer access instructions, bilingual release notes, category and store copy.

The current listing content has been written into a Play edit for both languages, but Google rejected the commit with HTTP 403 `PERMISSION_DENIED`. Do not treat these strings as saved to the Play listing until the API workflow reports `STORE_LISTINGS_COMMIT=saved_not_sent_for_review`.

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

1. Grant the automation service account app-scoped `Manage store presence` permission for Dalilna. Do not grant Admin or production-release permissions.
2. Add the internal tester Google accounts or a Google Group, save the tester list and retrieve the track's opt-in link. The current track has zero configured tester groups and zero email lists.
3. Complete Ads, target audience, App access, IARC content rating and any required declarations in Play Console.
4. Upload the final 512 × 512 PNG app icon, 1024 × 500 feature graphic and captured screenshots. The repository audit found the SVG icon and screenshot workflow artifact, but no verified 512 × 512 Play icon PNG or 1024 × 500 feature graphic.
5. For a future closed/open/production track, review and submit the Data safety CSV and all required Play Console declarations. Do not assume the internal-only exemption applies to other tracks.

## Automation status

- Internal track `4100101`: completed and verified.
- Arabic and English store listings: staged in API edit; commit blocked by HTTP 403 until app-scoped permission is granted.
- GitHub Release publish step: changed to use GitHub CLI with explicit tag `v3.1.0`; separate no-build asset audit passes. The release upload step itself has not been re-executed because the task constraint forbids an unnecessary AAB build.
- WIF/OIDC and signing secrets: unchanged.
- Production rollout: not performed.


## Latest signed GitHub artifact — 27 November 2026

- Current app package: `ye.dalilna.app`
- Version name: `3.1.0`
- Signed AAB versionCode: `4128301`
- AAB SHA-256: `000bad420c5b6844c3ee6552dc2eb8364a51ddcef263bfc756b36e82d88ff86e`
- AAB size: 8,838,161 bytes
- APK SHA-256: `dae102c1370a8e69f58ce0b31321c81e01c1a64044a1705999495bc46bef7813`
- Build: [GitHub Actions 45939045693](https://github.com/baraagpt6-droid/dalilna/actions/runs/45939045693)
- The completed Play internal track is still versionCode `4100101`. The newer AAB is only published as a GitHub Release asset at this checkpoint.
