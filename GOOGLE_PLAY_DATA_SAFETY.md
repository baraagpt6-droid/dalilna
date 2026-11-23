# Dalilna 3.1.0 — Google Play Data safety and App content worksheet

Prepared: 23 November 2026  
Privacy policy: https://baraagpt6-droid.github.io/dalilna/privacy.html  
Package: `ye.dalilna.app`

This worksheet reflects the reviewed Android/WebView code and the planned Google Mobile Ads SDK 25.5.0 integration. It is preparation material, not a declaration submitted to Google. Before submitting the Play Console form, verify the final production AAB, AdMob account settings, privacy messages, Gemini/search routes, server retention and every transitive SDK.

## 1. Account and sign-in

- Account creation: **No** centrally authenticated customer or merchant account in v3.1.0.
- Sign-in required: **No** for normal directory browsing, local profile, favourites and local functions.
- The customer/merchant profile and role switcher are local-device functionality. They are not server accounts and do not synchronize profile data across devices.
- The administrator interface is not a public customer sign-in flow.

## 2. Data types to review in Data safety

| Google Play data type | Collection | Purpose and handling |
|---|---|---|
| Location — approximate | Yes, when nearby search uses location | Sent to Dalilna search service to return nearby places. Manual region selection is available. |
| Location — precise | Yes, when the user grants precise permission and uses nearby search | Used for nearby search. |
| Personal info — name | Yes, when entered in local profile or listing form | Local profile remains on-device; submitted listing fields go to the marketplace server. |
| Personal info — phone number | Yes, when entered in merchant/listing forms | Used as contact data and may be publicly shown after approval. |
| User-generated content — other user-generated content | Yes, for shared shop/marketplace listings and submitted images | Sent to Dalilna server for moderation; approved listings may be public. |
| App activity — app interactions | Yes, through Google Mobile Ads SDK | Advertising delivery, measurement and fraud prevention. |
| App info and performance — diagnostics | Yes, through Google Mobile Ads SDK | SDK/app performance and diagnostic information. |
| Device or other IDs | Yes, through Google Mobile Ads SDK, subject to device/user controls | Android Advertising ID, App Set ID and applicable device/account identifiers for advertising and measurement. |
| Messages, contacts, financial information | No known collection by reviewed app flow | Recheck future features and SDKs. |
| Firebase analytics/auth/crash data | No | Firebase Analytics, Authentication and Crashlytics SDKs are not integrated in this Android branch. |

Google's current disclosure for Google Mobile Ads SDK 25.5.0 says the SDK automatically collects and shares IP address, user product interactions, diagnostic information, and device/account identifiers for advertising, analytics and fraud prevention. Map these to the exact labels in Play Console.  
Source: https://developers.google.com/admob/android/privacy/play-data-disclosure

## 3. Data sharing

- **Google Mobile Ads / AdMob:** SDK-collected IP address, interactions, diagnostics and identifiers are shared with Google for ad delivery, measurement, fraud prevention and related SDK purposes.
- **Google Gemini API:** the cloud assistant is optional. When enabled by the user, their question and relevant directory context may be sent through Dalilna's API to Google Gemini to generate the answer. Context may include a public business phone number already shown in the directory.
- **Dalilna marketplace server/database:** submitted listing fields are sent for moderation and publication. Approved listing details may be public.
- **Search providers:** search text, selected region and, for nearby search, location coordinates are sent to Dalilna search service. Depending on the route, the server may query Geoapify, OpenStreetMap/Nominatim or Overpass.

Do not select “not shared” for data the AdMob SDK shares with Google.

## 4. Processing, security and deletion

- Data in transit: **Yes, encrypted in transit** for HTTPS API/provider requests and Google Mobile Ads SDK traffic documented by Google.
- Central user accounts: **None** in the reviewed v3.1.0 flow.
- Account deletion: **Not applicable to a central account**, because the app does not create one.
- Local deletion: users can clear Android app data or uninstall the app. This removes local profile/favourites but does not automatically delete a marketplace submission already sent to the server.
- Remote listing deletion: no self-service central deletion workflow was found in the reviewed app. Confirm an operational private contact and moderation process before launch.
- Retention: local data remains until cleared. Shared listings may remain for moderation, publication, duplicate prevention or administrative review. Confirm production database retention and backup windows before submission.
- Dalilna does not sell personal data. This does not override the AdMob SDK sharing described above.

## 5. App content worksheet

| Play Console section | Prepared answer |
|---|---|
| App access | Main browsing and local profile features do not require login. Do not publish administrator credentials. |
| Ads | **Yes.** Android uses Google Mobile Ads SDK banner ads when production AdMob IDs are configured. |
| Privacy policy | https://baraagpt6-droid.github.io/dalilna/privacy.html |
| Target audience | Not designed for children. Confirm age-group selection against the store listing and ad configuration. |
| User-generated content | **Yes.** Users can submit shop and marketplace listing details and images. Shared submissions require moderation before public display. |
| Government app | **No.** Dalilna is an independent directory/marketplace, not an official government service. |
| Financial features | The app displays market/exchange reference information. It does not provide banking, payment processing, lending or investment services in the reviewed release. |

## 6. Required checks before submission

1. Configure real AdMob App ID and banner Ad Unit ID as GitHub Actions secrets `ADMOB_APP_ID` and `ADMOB_BANNER_AD_UNIT_ID`. Production AAB generation is intentionally blocked when either is missing. Google's sample IDs must never ship in the release bundle.
2. Complete AdMob privacy messages and consent geography in the AdMob account, then test UMP consent and privacy-options entry point on devices.
3. Confirm whether the production Gemini API configuration retains prompts/request metadata and update the form if needed.
4. Confirm Render/PostgreSQL retention and backup policy and establish a real private route for listing deletion/privacy requests.
5. Review the final merged AAB's manifest and transitive SDKs with Play Console App Bundle Explorer / SDK analysis. Update this worksheet whenever a dependency or data flow changes.

## 7. Source references

- Google Mobile Ads SDK data disclosure: https://developers.google.com/admob/android/privacy/play-data-disclosure
- Google UMP setup: https://developers.google.com/admob/android/privacy
- Google Play Data safety guidance: https://support.google.com/googleplay/android-developer/answer/10787469
- Dalilna implementation constraints: `SECURITY_LIMITATIONS.txt`
