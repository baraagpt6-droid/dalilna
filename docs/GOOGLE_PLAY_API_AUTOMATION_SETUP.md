# Dalilna — Google Play API automation

Scope is fixed to:

- Application ID: `ye.dalilna.app`
- Version: `3.1.0`
- versionCode: `4128601` (Build #286)
- Closed testing track: `Dalilna Closed Testing`

The manual-dispatch workflow is:

`.github/workflows/google-play-closed-testing-draft.yml`

The workflow has two modes. `INSPECT_ONLY` reads the existing edit, bundles, tracks, localized listings, images and tester settings without writing app data. `SUBMIT_FOR_REVIEW` downloads and verifies the AAB, captures fresh screenshots, updates Arabic/English listings and artwork, refreshes the closed-testing draft and commits the edit for Google review.

The track release payload is written with `status: draft`, but this does not mean the surrounding Play edit can be committed without review. Google documents `changesNotSentForReview` for cases where changes were rejected; in run `45945373618` the parameter was rejected with HTTP 400 `INVALID_ARGUMENT`. Removing it would send all changes for review when no review is already in progress. Therefore the workflow defaults to `INSPECT_ONLY`; `SUBMIT_FOR_REVIEW` is a separate manual mode and knowingly submits the entire edit to Google review. Neither mode changes Production or performs a rollout.

## 1. Create the app card once in Play Console

The Android Publisher API does not provide an initial app-card creation method. Use the developer account that already owns the app `ye.dalilna.app`. The account display name and account type have not been independently verified in this handoff:

- App name: `دليلنا — دليل اليمن`
- Package name: `ye.dalilna.app`
- Default language: Arabic
- App or game: App
- Free or paid: Free
- Support email: `dalilnasupport@gmail.com`

Do not create or select `dalilna.com` or `com.hubaish.guide`.

## 1.1 Existing Play artifact and API bootstrap

The app already has a completed internal-test release at versionCode `4100101`, so its first Play artifact bootstrap is complete. The current GitHub Release AAB is versionCode `4128601` and SHA-256 `5b12e80334bb534c094a200cac41366d02c3810aea9dddf32c5d838ebc64f70a`.

The submit mode verifies this exact file before opening a Play edit. It refuses any versionCode below the highest value on any app track, checks existing bundles, and uploads only when a matching bundle is absent. Its commit submits changes for review. The inspect-only mode does not upload anything and can reuse the current uncommitted edit ID for read-back.

Do not make other Play Console edits while an API edit is open: Google invalidates an outstanding edit when Console changes are made.

## 2. Google Cloud — recommended Workload Identity Federation

Use GitHub OIDC and short-lived credentials. Do not create or store a Service Account JSON private key.

### Create/select the Cloud project and enable APIs

Enable:

- `androidpublisher.googleapis.com`
- `iam.googleapis.com`
- `iamcredentials.googleapis.com`
- `sts.googleapis.com`
- `serviceusage.googleapis.com`

Create a dedicated service account, for example:

`dalilna-play-automation@PROJECT_ID.iam.gserviceaccount.com`

### Create the GitHub Workload Identity Pool and OIDC provider

Use Google Cloud Console → IAM & Admin → Workload Identity Federation:

- Pool ID: `github-dalilna`
- Provider ID: `github`
- Provider type: OpenID Connect (OIDC)
- Issuer URL: `https://token.actions.githubusercontent.com`

Attribute mappings:

- `google.subject=assertion.sub`
- `attribute.repository=assertion.repository`
- `attribute.ref=assertion.ref`
- `attribute.repository_owner=assertion.repository_owner`

Attribute condition:

```
assertion.repository == 'baraagpt6-droid/dalilna' && assertion.ref == 'refs/heads/main'
```

Grant the repository principal set the role `roles/iam.workloadIdentityUser` on the dedicated service account:

```
principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-dalilna/attribute.repository/baraagpt6-droid/dalilna
```

Example commands (replace placeholders):

```bash
gcloud services enable androidpublisher.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com serviceusage.googleapis.com --project=PROJECT_ID

gcloud iam workload-identity-pools create github-dalilna \
  --project=PROJECT_ID --location=global --display-name="GitHub Actions for Dalilna"

gcloud iam workload-identity-pools providers create-oidc github \
  --project=PROJECT_ID --location=global --workload-identity-pool=github-dalilna \
  --display-name="GitHub OIDC for Dalilna" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository == 'baraagpt6-droid/dalilna' && assertion.ref == 'refs/heads/main'"

gcloud iam service-accounts create dalilna-play-automation --project=PROJECT_ID

gcloud iam service-accounts add-iam-policy-binding \
  dalilna-play-automation@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-dalilna/attribute.repository/baraagpt6-droid/dalilna"
```

Keep this service account dedicated to the Dalilna repository. Do not create a JSON key.

## 3. Invite the service account in Play Console

In Play Console → Users and permissions → Invite new users, enter the service-account email.

Grant **Admin (all permissions)** at the app scope for `ye.dalilna.app` only, matching the owner's explicit requirement. In the app selector, leave all other apps unchecked. Keep the developer-account-level **Account admin** permission unchecked and leave the developerAccountPermissions list empty. Do not grant account-wide Admin. The app-level grant must appear against the exact package `ye.dalilna.app`.

If the owner later chooses a least-privilege alternative, the API roles required for this workflow are app-level `CAN_VIEW_NON_FINANCIAL_DATA`, `CAN_MANAGE_TRACK_APKS`, `CAN_MANAGE_TRACK_USERS`, and `CAN_MANAGE_PUBLIC_LISTING`. The explicit target for the current setup remains app-level Admin only on Dalilna, without any account-level permissions. Do not alter the separate `com.hubaish.guide` app or its tester lists.

## 4. WIF values used by the workflow

The workflow uses the already-tested GitHub OIDC / Workload Identity Federation provider and dedicated service account directly. These identifiers are not private keys or access tokens:

- Provider: `projects/28058491662/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- Service account: `dalilna-play-automation@dalilna-play-automation-516000.iam.gserviceaccount.com`

No service-account JSON key and no additional GitHub repository variables are required. The workflow uses GitHub OIDC with `id-token: write`, short-lived credentials and the existing provider binding scoped to `baraagpt6-droid/dalilna` on `main`.


## 5. Optional tester Google Group

The workflow accepts one optional Google Group address (for example `dalilna-testers@googlegroups.com`). The group must already exist and contain the intended tester accounts.

The Android Publisher Testers API supports Google Groups but not saved individual email lists. If you prefer the Play Console email-list UI, add the list manually in the Closed Testing track instead.

The API does not set the feedback contact email or create the tester opt-in link. After the draft is prepared, open the Closed Testing track in Play Console, set the feedback email to `dalilnasupport@gmail.com`, review the group/list, and copy the opt-in link. The release remains a draft until the owner separately makes it available to testers.

## 6. Run the workflow after the app card and permissions are ready

After merging the workflow changes, WIF and app access are configured for Dalilna. The workflow uses the existing provider and service-account identifiers directly; no additional GitHub variables are required.

1. Open Actions → Inspect or submit Dalilna Google Play changes.
2. Select branch `main` and confirm `YES — ye.dalilna.app only`.
3. Keep mode as `INSPECT_ONLY` for read-back. `SUBMIT_FOR_REVIEW` sends all staged changes to Google review and must be used only after every policy and testing prerequisite is verified.
4. The current uncommitted edit ID from run `45945373618` is `13370413812168476918`.

The currently committed target-track draft is versionCode `3127701`. The active uncommitted Play edit was previously staged with bundle `4128401`; the latest signed AAB is now `4128601` and will be staged into the same edit by `STAGE_ONLY`. The API read returned zero Google Groups and `allUsers=false`. The Android Publisher API does not expose saved individual-email lists; the `Hubaish Testers` Console list is not read, copied, renamed or changed.

## 7. Remaining owner actions in Play Console

- Complete privacy policy, App access, Ads, Content rating, target audience, Data Safety, Government apps, Financial features, Health, Trader status, category/contact details, free pricing, and country availability.
- Set country availability to Yemen only. Country availability applies across tracks; the custom Closed Testing API workflow does not modify it.
- Set the feedback contact and obtain the opt-in link.
- Manage saved individual-email tester lists in Console if not using Google Groups.
- Review any Play Console validation warnings.
- Keep all review submission and release decisions with the account owner.

The workflow's default mode is read-only. The manual submission mode sends changes for review; it never changes the Production track or starts a rollout.


## Explicit execution trigger

A push to `main` only starts inspection when the commit message contains `[inspect-dalilna-play-state]`. An ordinary merge or push does not submit or update Play. Review submission is available only through `workflow_dispatch` with affirmative Dalilna-only scope and mode `SUBMIT_FOR_REVIEW`.

## Why API save-as-draft is not available here

The `changesNotSentForReview` parameter is documented for changes after a rejection. The actual commit response for this app was HTTP 400 `INVALID_ARGUMENT`: it said changes are sent for review automatically and the parameter must not be set. Google also documents that, without a rejected state, a successful API commit sends all pending app changes for review. To hold changes without submitting them, use Play Console Publishing overview → Changes not yet sent for review → Save for later. This browser-console action has not been performed from the connected tools.
## Read-only inspection results — 27 November 2026

Run 45947016030 reused active edit 13370413812168476918 and performed GET requests only. It confirmed AAB 4128401 and SHA-256 3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026, track draft 4128401 in that edit, both locale listings, icon/feature graphic and four phone/four tablet screenshots per locale. It also confirmed zero Google Groups and allUsers=false. This edit remains uncommitted; read-only confirmation is not publication or review.
## Stage the latest signed AAB without submitting for review

The workflow offers three explicit modes: `INSPECT_ONLY` (GET-only read-back), `STAGE_ONLY` (updates the existing active edit and leaves it uncommitted), and `SUBMIT_FOR_REVIEW` (commits the complete edit and sends it to Google review).

To stage the latest Build #286 artifact, use `Actions → Inspect or submit Dalilna Google Play changes`, branch `main`, confirmation `YES — ye.dalilna.app only`, mode `STAGE_ONLY`, existing Edit ID `13370413812168476918`, and leave the tester Google Group field empty. Stage-only reuses that existing edit, pins AAB versionCode `4128601` by SHA-256, updates the draft release payload and bilingual metadata, and preserves existing image groups and tester configuration. It rejects a tester group input in this mode. It does not call `edits:validate`, `edits:commit`, Production, rollout, or review submission.

After staging, run `INSPECT_ONLY` against the same Edit ID to read back the bundle version/hash, draft release, images and tester settings. The committed Play tracks will remain unchanged until a separate review submission action is explicitly chosen.