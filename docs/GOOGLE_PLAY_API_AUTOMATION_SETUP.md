# Dalilna — Google Play API automation

Scope is fixed to:

- Application ID: `ye.dalilna.app`
- Version: `3.1.0`
- versionCode: `3127701` (Build #277)
- Closed testing track: `Dalilna Closed Testing`

The manual-dispatch workflow is:

`.github/workflows/google-play-closed-testing-draft.yml`

It downloads and verifies the signed AAB, prepares the app icon and feature graphic from source SVGs, captures fresh phone/tablet screenshots from the live Dalilna app with Playwright, updates Arabic and English listings, uploads images, creates the custom closed-testing track if necessary, and assigns an optional Google Group.

The release is always written with `status: draft`. The edit is committed using `changesNotSentForReview=true` and `changesInReviewBehavior=ERROR_IF_IN_REVIEW`. Google documents that a draft release is not served to users and that the changes are not sent for review until explicitly submitted in Play Console. The workflow contains no Production-track operation, no rollout operation, and no review-submission operation.

## 1. Create the app card once in Play Console

The Android Publisher API does not provide an initial app-card creation method. Create the app in the account `SNTECHNOLOGYAI` first:

- App name: `دليلنا — دليل اليمن`
- Package name: `ye.dalilna.app`
- Default language: Arabic
- App or game: App
- Free or paid: Free
- Support email: `dalilnasupport@gmail.com`

Do not create or select `dalilna.com` or `com.hubaish.guide`.

## 1.1 First-upload bootstrap if Google blocks the first API edit

Google's Edits guide notes that the API is intended for an app that has already had an APK uploaded through Play Console. If the first run fails at `edits.insert` or the first bundle upload with a prerequisite error, perform this one-time bootstrap in Play Console:

1. Open **Dalilna → Test and release → Testing → Closed testing**.
2. Create the track named `Dalilna Closed Testing`.
3. Create a draft release and upload the pinned `app-release.aab` (versionCode `3127701`).
4. Save it as a draft only. Do not roll it out or send it for review.

Then rerun the workflow. It checks the existing bundle list and reuses the matching versionCode/SHA-256. If the API bundle list exposes that versionCode, the script verifies the returned SHA-256 and reuses the bundle without uploading it again. If a draft release exists but the bundle list does not expose a matching hash, or if the hash differs, the workflow stops without changing the draft.

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

Grant access to **this app only**, with these permissions:

- Release apps to testing tracks
- Manage testing tracks and edit tester lists
- Manage store presence

Do not grant Admin, financial permissions, or the production-release permission. Google documents that the testing-track upload and tester-management permissions do not grant the ability to publish to Production.

## 4. Add GitHub repository variables

Open repository Settings → Secrets and variables → Actions → Variables. Add:

| Variable | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-dalilna/providers/github` |
| `GCP_SERVICE_ACCOUNT` | `dalilna-play-automation@PROJECT_ID.iam.gserviceaccount.com` |

No credential or private key is stored in GitHub.

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

The first run stops if the app is not accessible, if the AAB checksum or versionCode does not match, if image groups are already populated, or if a different draft/version already exists on the named track. It does not delete existing images or existing releases.

## 7. Remaining owner actions in Play Console

- Complete privacy policy, App access, Ads, Content rating, target audience, Data Safety, Government apps, Financial features, Health, Trader status, category/contact details, free pricing, and country availability.
- Set country availability to Yemen only. Country availability applies across tracks; the custom Closed Testing API workflow does not modify it.
- Set the feedback contact and obtain the opt-in link.
- Manage saved individual-email tester lists in Console if not using Google Groups.
- Review any Play Console validation warnings.
- Keep all review submission and release decisions with the account owner.

The workflow only prepares an unsubmitted Closed Testing draft. It never changes the Production track and never sends changes for review.
