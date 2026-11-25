# GOOGLE PLAY DATA SAFETY — DALILNA 3.1.0

Review date: 25 November 2026  
Android application ID: `ye.dalilna.app`  
Release target SDK: 36

This worksheet is based on the checked source code and bundled SDK configuration. Google Play treats app-controlled WebView content and third-party SDK behavior as part of the app's disclosure obligations. Re-check the final signed AAB and runtime network behavior before submitting the form.

## High-level answers

| Play Console question | Prepared answer | Qualification |
|---|---|---|
| Does the app collect or share required user data? | **Yes** | Location, listing data/photos, advertising SDK data and optional assistant/voice flows are transmitted. |
| Is all collected user data encrypted in transit? | **Yes, subject to final endpoint audit** | App API routes use HTTPS; Google Mobile Ads uses encrypted transport. Confirm every final network endpoint and speech-recognition provider. |
| Can users request deletion of their data? | **Yes, after the official privacy email is configured and monitored** | Users can request removal of shared listings. Local profile/favourites can be cleared from the device. There is no central customer/merchant account. |
| Does the app create user accounts? | **No central customer or merchant account** | Customer/merchant profile selection and preferences are local to the device. An administrator interface exists but is not public account registration. |
| Does the app contain ads? | **Yes** | Android includes Google Mobile Ads SDK 25.5.0 and Google UMP 4.0.0. |
| Does the app include user-generated content? | **Yes** | Public shop/marketplace/job-seeker submissions and images; moderation and report/block controls are implemented. |

## Data types to declare

| Play data type | Collect? | Required or optional | Purpose | Details |
|---|---:|---|---|---|
| Location — approximate | Yes | Optional | App functionality | Used when the user activates nearby search; may be sent to Dalilna search service. |
| Location — precise | Yes | Optional | App functionality | Android location permission supports precise coordinates for nearby search. |
| Personal info — name | Yes, when submitted | Optional form submission | App functionality | A seller/contact name or job-seeker name may be included in a shared submission. A local-only profile name is not transmitted merely by saving it locally. |
| Personal info — phone number | Yes, when submitted | Optional form submission | App functionality | Submitted with a shop, marketplace or job-seeker listing; may be public after approval. |
| Photos and videos — photos | Yes, when an image is attached | Optional | App functionality | A selected listing image is sent to the Dalilna server for review and possible publication. |
| App activity — search history / search queries | Review final logging behavior | Optional | App functionality | Search text and selected area are sent to the service that fulfils the search. Declare retained search history if it is logged or stored. |
| App activity — app interactions | Yes | Automatic when ad SDK operates | Advertising, measurement, fraud prevention | Google Mobile Ads may collect interactions such as app launches, taps and ad views. |
| App info and performance — diagnostics | Yes | Automatic when ad SDK operates | Analytics, fraud prevention, service improvement | Google Mobile Ads may collect diagnostic and performance information. |
| Device or other IDs | Yes | Automatic when ad SDK operates | Advertising, measurement, fraud prevention | Google Mobile Ads may collect Advertising ID, App Set ID or other device/account identifiers. |
| Audio files — voice or sound recordings | **Verify; conservative answer is Yes if remote recognition is used** | Optional, after microphone action and in-app confirmation | App functionality | Voice search uses Web Speech recognition. Depending on Android WebView/device/provider, audio may be processed locally or sent to the recognition provider. Do not answer No until this has been tested on supported devices. |
| Other user-generated content | Yes | Optional form submission | App functionality | Listing text, descriptions, public contact details and job/marketplace submissions. |

## Sharing and service providers

1. **Google Mobile Ads SDK** — Google may receive IP address, in-app/ad interactions, diagnostics/performance information and device/account identifiers for ad delivery, measurement and fraud prevention.
2. **Google Gemini** — when the user explicitly enables the cloud assistant, the user's prompt and relevant general directory context may pass through Dalilna's server to the AI service for response generation.
3. **Search/geocoding providers** — depending on the route, Dalilna's server may query Geoapify, OpenStreetMap, Nominatim or Overpass. Nearby search may involve coordinates. Confirm which data fields each provider receives.
4. **Speech-recognition provider** — voice audio may be sent outside the device by the speech-recognition implementation on some Android/WebView versions. Confirm the behavior on production devices and identify the provider before submitting.

Google Play's form distinguishes data sharing with third parties from processing by a service provider on the developer's behalf. Make the sharing selection according to the contracts and exact processing role of each provider. Do not omit SDK data merely because it is not sent to Dalilna's own server.

## Data not used as a core feature in 3.1.0

- No centralized customer or merchant account registration.
- No in-app direct messaging between users.
- No in-app payment processing, banking, credit, lending or investment feature.
- No contact-book, calendar, health or SMS access.
- No Firebase Analytics, Firebase Authentication or Firebase Crashlytics SDKs in the checked Android build.

## Data deletion and retention

- Local profile, preferences and favourites remain on the device until the user clears app data or uninstalls the app. The app does not synchronize profile data across devices.
- Shared marketplace submissions are stored on the server for moderation, publication, duplicate prevention and report handling.
- The app does not have a central account system, so there is no central account-deletion flow.
- Users must be able to contact the developer to request review/removal of a shared listing. Configure and monitor the real privacy email before selecting the deletion-request answer.
- Confirm the server's database retention and backup retention schedules. Do not promise immediate deletion from backups unless that behavior is implemented.

## Encryption in transit

The checked application uses HTTPS for its Dalilna API and published web resources. Google Mobile Ads documents encrypted transport for collected SDK data. The final declaration must cover all collected/transmitted data, including optional assistant and speech recognition providers. If any endpoint or provider path sends user data without encryption, change the answer and remediate before release.

## App access and audience

- Public app browsing does not require sign-in.
- Customer/merchant profile information is local to the device.
- The administrator interface is not required to review the public app. Do not provide administrator tokens or backend secrets to Play reviewers.
- Dalilna is not designed for children. Choose only the target-age groups that reflect the real intended audience; if the intended audience is adults, select 18+ and do not select a child age band.
- Ads: Yes.
- User-generated content: Yes.
- Government app: No, unless the operator is an authorized government entity.
- Financial features: No; reference prices do not constitute a financial service.

## Must complete before submitting the Data Safety form

- [ ] Build and inspect the final signed AAB, including all transitive SDKs.
- [ ] Test microphone/voice recognition on supported Android versions and determine whether raw audio leaves the device.
- [ ] Confirm the exact AdMob production configuration and UMP consent behavior.
- [ ] Confirm the prompt/context fields sent to the cloud assistant and applicable service-provider terms.
- [ ] Confirm all search providers, payload fields, logging and retention.
- [ ] Configure the real developer/privacy email and test the deletion-request process.
- [ ] Confirm database and backup retention settings.
- [ ] Make the public privacy policy describe the final build and actual practices.
- [ ] Submit the same answers in Play Console that the final binary and policy support.

## Official references

- [Google Play Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play SDK security guidance](https://support.google.com/googleplay/android-developer/answer/13326895)
- [Google Mobile Ads SDK data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Google Play user-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937)
