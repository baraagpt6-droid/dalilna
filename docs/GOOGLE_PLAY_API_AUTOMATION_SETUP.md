# Dalilna — Google Play API automation

Scope is fixed to:

- Application ID: `ye.dalilna.app`
- Version: `3.1.0`
- versionCode: `4128401` (Build #284)
- Closed testing track: `Dalilna Closed Testing`

The manual-dispatch workflow is:

`.github/workflows/google-play-closed-testing-draft.yml`

It downloads and verifies the signed AAB, prepares the app icon and feature graphic from source SVGs, captures fresh phone/tablet screenshots from the live Dalilna app with Playwright, updates Arabic and English listings, uploads images, creates the custom closed-testing track if necessary, and assigns an optional Google Group.

The release is always written with `status: draft`. The edit is committed using `changesNotSentForReview=true` and `changesInReviewBehavior=ERROR_IF_IN_REVIEW`. Google documents that a draft release is not served to users and that the changes are not sent for review until explicitly submitted in Play Console. The workflow contains no Production-track operation, no rollout operation, and no review-submission operation.

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

The app already has a completed internal-test release at versionCode `4100101`, so its first Play artifact bootstrap is complete. The current GitHub Release AAB is versionCode `4128401` and SHA-256 `3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026`.

The workflow verifies this exact file before it opens a Play edit. It refuses any versionCode below the highest value on any app track. It checks existing bundles and reuses a matching bundle only when the hash agrees. If the new bundle is absent, it uploads the signed AAB to `ye.dalilna.app` only. It creates only an unsubmitted Closed Testing draft. It does not send changes for review or roll out the release.

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

After merging this PR, creating the app card, configuring WIF, inviting the service account, and adding the two GitHub variables:

1. Open Actions → Prepare Dalilna Google Play Closed Testing Draft.
2. Select branch `main`.
3. Select `YES — ye.dalilna.app draft only`.
4. Optionally enter the tester Google Group email.
5. Run the workflow.

The workflow refuses a versionCode below the highest code across tracks. If the named track already has exactly one older draft (the currently read-back draft is versionCode `3127701`), the workflow refreshes that draft in place with the pinned newer AAB `4128401`, preserving its other release fields and every non-draft release. It refuses multiple drafts or a draft with a higher versionCode. Existing image groups are read and preserved; uploads are added only to empty groups. Existing tester configuration is read and preserved unless an explicit Google Group is supplied. The Android Publisher Testers API exposes Google Groups but not saved individual email lists, so the `Hubaish Testers` list is not read, copied, or modified by this workflow. It does not delete tester lists, images, completed releases or any other app's data.

## 7. Remaining owner actions in Play Console

- Complete privacy policy, App access, Ads, Content rating, target audience, Data Safety, Government apps, Financial features, Health, Trader status, category/contact details, free pricing, and country availability.
- Set country availability to Yemen only. Country availability applies across tracks; the custom Closed Testing API workflow does not modify it.
- Set the feedback contact and obtain the opt-in link.
- Manage saved individual-email tester lists in Console if not using Google Groups.
- Review any Play Console validation warnings.
- Keep all review submission and release decisions with the account owner.

The workflow only prepares an unsubmitted Closed Testing draft. It never changes the Production track and never sends changes for review.


## Explicit execution trigger

The workflow can also start from a merge to `main` only when the merge commit message contains `[run-dalilna-closed-draft]`. An ordinary merge or push does not start the Play edit. This marker is used only after the pull-request quality checks pass. A `workflow_dispatch` run still requires selecting the affirmative Dalilna-only confirmation option.
