# GOOGLE PLAY DATA SAFETY — DALILNA 3.1.0

Source review: 27 November 2026  
Android application ID: `ye.dalilna.app`  
Android version: `3.1.0` · latest signed GitHub AAB versionCode `4128401` (not yet uploaded to Play) · Google Play internal-track versionCode `4100101` completed · target SDK 36  
Developer display name: `Dalilna Team` — the app owner's team/brand name  
Support and privacy contact: `dalilnasupport@gmail.com`

This worksheet reflects the checked Android manifest, WebView bridge, JavaScript search flow, Node.js API, PostgreSQL schema, and Google Mobile Ads (AdMob) SDK 25.5.0 / UMP 4.0.0 configuration. Google treats app-controlled WebView behavior and SDK collection as part of the developer's Data safety declaration.

## Console answers

| Play Console question | Answer | Code basis |
|---|---|---|
| Does the app collect or share required user data? | **Yes** | User-selected location, user-submitted listings and photos, search queries, optional voice recognition, and Google Mobile Ads data. |
| Is any data shared with third parties? | **Yes** | Google Mobile Ads SDK automatically shares its disclosed IP-derived location, app interactions, diagnostics/crash information and device identifiers. Other transfers to maps, speech recognition, Gemini or public listing pages are user-initiated and expected for the feature; assess them against Google's user-initiated transfer exception and the actual provider contracts. |
| Is data encrypted in transit? | **Yes** | App APIs and configured search/AI endpoints use HTTPS. Google Mobile Ads documents TLS encryption for its collected data. |
| Can users request deletion of data? | **Yes — by email** | Users can request review/removal of server-side listings and submitted profiles at `dalilnasupport@gmail.com`. Local data can be cleared on-device. |
| Does the app create customer or merchant accounts? | **No** | Customer/merchant profiles and favourites are local to the device; public browsing does not require sign-in. |
| Does the app contain ads? | **Yes** | Google Mobile Ads SDK 25.5.0 and Google UMP 4.0.0 are included in the Android project. |
| Does the app contain user-generated content? | **Yes** | Users can submit marketplace, business and job-seeker content, including text, phone numbers, coordinates and photos. |

## Data types to declare

| Google Play data type | Collect? | Required? | Purpose | Sharing / detail |
|---|---:|---|---|---|
| Location — approximate | **Yes** | SDK IP processing is automatic; nearby search is optional | App functionality; advertising/analytics/fraud prevention for SDK IP processing | The app sends manually selected locality or uses nearby search. Google Mobile Ads also collects IP address and may use it to estimate general location. |
| Location — precise | **Yes** | Optional; only after the user grants location access | App functionality | GPS coordinates for nearby search or for a user-submitted business/listing location. |
| Personal info — name | **Yes** | Optional form submission | App functionality | Seller, shop/contact or job-seeker name submitted with shared content. |
| Personal info — phone number | **Yes** | Optional form submission | App functionality | Contact number submitted with a listing or public job-seeker profile. |
| Photos and videos — photos | **Yes** | Optional | App functionality | User-selected listing/profile image uploaded to the Dalilna API and stored with the submission. |
| App activity — in-app search history | **Yes** | Optional search | App functionality | Search text, selected place/area and category are sent to the search API. The server writes structured search-start events containing the query, place, category and request origin to its operational logs. |
| App activity — app interactions | **Yes** | Automatic when Google Mobile Ads operates | Advertising, analytics and fraud prevention | Google Mobile Ads collects and shares app/ad interactions such as launches, taps and ad views. |
| App info and performance — crash logs | **Yes** | Automatic when Google Mobile Ads operates | Analytics, service improvement and fraud prevention | Google Mobile Ads disclosure includes crash-related diagnostic data. |
| App info and performance — diagnostics | **Yes** | Automatic when Google Mobile Ads operates | Analytics, service improvement and fraud prevention | Google Mobile Ads collects diagnostic and performance information such as app launch time, hang rate and energy use. |
| Device or other IDs | **Yes** | SDK-dependent; automatically collected by Google Mobile Ads | Advertising, analytics and fraud prevention | Android Advertising ID, App Set ID and applicable device/account identifiers. |
| Audio files — voice or sound recordings | **Yes** | Optional; only after microphone action, disclosure and Android permission | App functionality | Android WebView grants audio capture to the Web Speech API. The app does not send raw audio to the Dalilna API. The WebView/system recognition provider may process audio locally or remotely. The CSV marks it collected but not separately shared because recognition is initiated by the user and expected from the voice-search action; verify this against the speech provider's actual behavior and disclosure. |
| Other user-generated content | **Yes** | Optional submission | App functionality | Listing titles, descriptions, shop/business details, job-seeker bios, report details and user-submitted content. |

## Third-party services and data flow

1. **Google Mobile Ads SDK 25.5.0 / Google UMP 4.0.0** — the SDK automatically collects and shares IP address, user product interactions, crash/diagnostic/performance information and device/account identifiers for advertising, analytics and fraud prevention. Google states this SDK data is encrypted in transit with TLS. IP address may be used to estimate general location.
2. **Android WebView / system speech-recognition service** — the microphone is granted to WebView only after a user action, disclosure and Android runtime permission. The page uses `window.SpeechRecognition` or `window.webkitSpeechRecognition`. The app itself does not use Android's native `SpeechRecognizer` API and does not upload raw audio to Dalilna's server. The system/WebView speech provider controls whether audio is processed locally or remotely. The CSV marks audio as collected, but not separately shared because recognition is an explicit user-initiated feature; confirm the provider's actual processing and disclosures before public release.
3. **Google Gemini** — only when the user explicitly enables the cloud assistant. The question and relevant general directory context are sent through Dalilna's API to Gemini for response generation. The API request sets `store: false`.
4. **Live places/search providers** — the local index is searched first. Server fallback can use Geoapify when `GEOAPIFY_API_KEY` is configured; otherwise or for fallback routes it uses OpenStreetMap Nominatim, Photon by Komoot, and Overpass instances at `overpass-api.de`, `overpass.private.coffee` and `maps.mail.ru`. Requests may include the search text, selected place/area, category, coordinates and radius.
5. **Wikimedia Commons** — the optional place-photo search feature can send a search term to Wikimedia Commons.
6. **Job source links** — the app reads its prepared jobs feed and opens source/application links when a user selects them.

For each provider, classify the provider as a service provider or third party according to the actual contract and role. The CSV sets the sharing flag only for the Google Mobile Ads SDK data disclosed as automatically shared. Maps/search, Gemini and speech transfers initiated by a user's specific action are not automatically marked as shared; confirm the user-initiated transfer exception and provider contracts before declaration. Google Play still requires collection disclosure for relevant SDK and WebView data.

## Server logs, database storage and expiry

- Search-start operational logs include the submitted search text (up to the server's configured input limit), selected place/area, requested category and request origin. Operational logs also include counts, response status, error codes, and selected marketplace moderation/report event metadata. The source does not log raw voice audio or full listing bodies as normal request logs.
- Shared marketplace submissions, photos, contact details, job-seeker profiles and UGC reports are stored in the PostgreSQL database configured through `DATABASE_URL`.
- Marketplace/real-estate listings are normally hidden from public results after 60 days. Job listings expire at their deadline or after 60 days, whichever comes first. Public job-seeker profiles expire after 60 days.
- Expiry is a visibility filter, **not a database deletion**. The checked application code has no scheduled `DELETE` job that purges expired listing or job-seeker rows. Some approved listing categories can have no automatic expiry.
- The code does not define a fixed retention duration for Render operational logs or PostgreSQL backups. Their retention is controlled by the hosting/database provider and the owner's account settings.
- Local profile fields, saved preferences and favourites remain on the device until the user clears app data or uninstalls the app.

## Data deletion

- There is no central customer or merchant account, so there is no central account-deletion flow.
- Users can request review/removal of server-side submissions by emailing **dalilnasupport@gmail.com** and identifying the listing/profile. The app owner or team handles the request manually.
- Clearing app data or uninstalling removes local profile/preferences/favourites from the device; it does not remove a submission already stored on the server.
- Do not promise that provider logs or backups disappear immediately. Their retention follows the provider configuration.

## Data not used as a core feature in 3.1.0

- No central customer or merchant account registration.
- No centralized customer or merchant account registration is provided. Local profiles and favourites remain on the device and do not synchronize profile data across devices.
- No in-app direct messaging between users.
- No in-app marketplace payments, banking, credit, lending, investment or gambling.
- No contact-book, calendar, health or SMS access.
- No Firebase Analytics, Firebase Authentication or Firebase Crashlytics SDK in the checked Android build.

## Audience, ads and app access

- **Ads:** Yes.
- **User-generated content:** Yes; public submissions are moderated, and users can report content.
- **Public app access:** No sign-in is required to browse the public directory, search or view marketplace content. The administrator interface is separate and is not required for Play review. Do not provide admin tokens or backend secrets.
- **Target audience:** The app is not designed for children. Select adult age groups only if they match the owner's intended audience; do not select child age bands.
- **Government app:** No, unless the operator is an authorized government entity.
- **Financial features:** No; indicative prices and exchange information are not payment or financial services.
- **Content rating:** Complete the IARC questionnaire truthfully. Google Play assigns the final regional rating; do not guess a rating in advance.

## Import file and revision note

- The repository includes [`data-safety.csv`](./data-safety.csv), a 782-row, five-column Google Play Data safety import worksheet. It selects name, phone, approximate and precise location, photos, optional voice audio, ad SDK interactions/diagnostics/identifiers, search history and user-generated content. It does not select home/mailing address; manually selected locality and business-area coordinates are represented through location data.
- The CSV is prepared from the published Google Play import schema and source inspection; it has not been imported into this app's Play Console. Review every selected category and the service-provider/third-party classification against the operator's actual contracts before importing. Google warns that importing a CSV replaces the existing Data safety form responses.
- Deletion request URL: `https://baraagpt6-droid.github.io/dalilna/data-deletion.html`. Privacy policy URL: `https://baraagpt6-droid.github.io/dalilna/privacy.html`.
- The Play internal track is exempt from the Data safety form while distribution remains exclusive to internal testing. This CSV is prepared for closed/open testing or production when required.

## Official references

- Google Play Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Mobile Ads SDK Play data disclosure (Android, version 25.5.0): https://developers.google.com/admob/android/privacy/play-data-disclosure
- Google Play user-generated content policy: https://support.google.com/googleplay/android-developer/answer/9876937


## Release artifact status — 27 November 2026

The current signed AAB in GitHub Release `v3.1.0` is versionCode `4128401`, SHA-256 `3fb668f1ba2d1dfb91a7613901ca2d85aa0485c509a4a5befc63214523254026`. The completed Google Play internal track remains `4100101`. This worksheet describes app data behavior; it is not evidence that the Play Data Safety form has been submitted or approved. The newest signed AAB has not been uploaded to Play as of this note.


## Play Console submission status

This Data Safety worksheet is derived from the project implementation and is not evidence of the Play Console questionnaire being submitted or approved. The latest signed AAB is versionCode `4128401`; the closed-testing track has a previous unsubmitted draft `3127701`. The latest AAB has not yet been committed to that draft. App content declarations and account-specific review requirements still require a Play Console read-back.


## Google Play commit limitation — 27 November 2026

The automation successfully authenticated with WIF, read the existing Dalilna closed-testing draft (`3127701`), staged the Arabic/English listing updates, uploaded the new `4128401` bundle and listing assets inside a temporary edit, and read the tester configuration (`googleGroupCount=0`, `allUsers=false`). The final `edits.commit` was rejected with HTTP 400:

`Changes are sent for review automatically. The query parameter changesNotSentForReview must not be set.`

The edit was not committed. The staged bundle, text and images therefore must not be treated as live in Play Console. The old track draft remains the last confirmed committed state. The script now explicitly refuses to retry without `changesNotSentForReview`, because Google says the ordinary commit would automatically send these changes for review. It will not bypass this guard.

The Android Publisher documentation states the `changesNotSentForReview` parameter applies when a rejection happens; the console Publishing overview is the mechanism for saving reviewable changes for later. The remaining safe step needs Play Console UI access to save the staged changes without sending them for review. The connected browser automation was unavailable because its wallet could not fund the run. No review, rollout or Production action was taken.

Tester API read-back:
- Google Groups: `0`
- `allUsers`: `false`
- Saved individual email lists are not exposed by Android Publisher API and were not modified.
- No opt-in link is available while the app remains in Draft/Pending publication.
