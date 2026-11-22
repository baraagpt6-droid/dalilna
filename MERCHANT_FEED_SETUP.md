# Dalilna 2.6.1 — merchant product feed integration

The shared marketplace imports real merchant inventory only through the authenticated server endpoint:

- \`POST /api/marketplace/feed-sync\`
- The endpoint requires \`Authorization: Bearer <DALILNA_PRODUCT_SYNC_TOKEN>\`.
- The token must contain at least 32 characters.
- Feed URLs must be public HTTPS JSON endpoints. Accepted payloads are a JSON array or an object containing an \`items\` array.
- The importer accepts up to 20 configured feeds, validates product types and Yemeni governorate/district names, and limits the total accepted batch to 200 records.
- A complete snapshot is required before missing products can be archived. Empty or partial snapshots do not archive existing stock.
- Stable feed IDs are used to update existing listings rather than create duplicates.

## Required product fields

| Field | Required | Notes |
|---|---|---|
| \`id\` | yes | Stable product or listing ID in the merchant feed |
| \`title\` or \`name\` | yes | Product title |
| \`productType\` | yes | A supported product type from \`marketplace-api.js\` |
| \`sellerName\` | yes | Merchant or seller identity |
| \`phone\` or \`whatsapp\` | yes | Contact number |
| \`governorate\` | yes | One of the supported Yemen governorates |
| \`district\` | yes | District/directorate name under that governorate |
| \`price\` | yes | Numeric price; zero is accepted only for free listings |
| \`currency\` | yes | YER, SAR, USD, OMR, AED or other |
| \`description\` | no | Product description |
| \`url\` or \`productUrl\` | no | Direct HTTPS product page |
| \`listingType\` | no | sale, wanted, barter, free or rent |
| \`condition\` | no | new, used or unknown |

## Configure GitHub Actions

These settings belong in the GitHub repository, not in the frontend.

1. Open repository Settings → Secrets and variables → Actions.
2. Add repository variable \`DALILNA_PRODUCT_FEED_URLS\`. Set it to comma-separated or newline-separated public HTTPS JSON feed URLs.
3. Add repository secret \`DALILNA_PRODUCT_SYNC_TOKEN\`. Use a high-entropy value of at least 32 characters.
4. The workflow already sets \`DALILNA_API_BASE_URL=https://dalilna-live.onrender.com\`.

Do not send the token in a chat or commit it to Git. Keep feed URLs free of embedded credentials. The importer rejects non-HTTPS feeds, credentials in URLs, and unsafe host forms.

## Schedule and current status

The workflow \`.github/workflows/daily-sync.yml\` runs every six hours through GitHub Actions. It checks marketplace readiness, the jobs feed and exchange-rate freshness, then imports merchant products only when feed URLs and the sync token are configured.

No Render Cron is required for this task. The earlier Render Cron creation was blocked by the requirement to add a payment method; the repository already has a scheduled GitHub Actions workflow and should not create a duplicate paid service.

At the last checked successful sync on 22 November 2026:
- Marketplace database: ready.
- Jobs feed: 25 entries returned.
- Exchange-rate feed: fresh.
- Merchant product feeds: skipped because \`DALILNA_PRODUCT_FEED_URLS\` was empty.

Until a merchant supplies a working JSON feed endpoint and the repository settings are configured, the importer intentionally creates no product stock and does not invent inventory or prices.

## Manual validation

After setting the variable and secret, run the \`Daily merchant, marketplace and live-data sync\` workflow from GitHub Actions. Check its logs for \`marketplace.feed_sync.completed\`. A skipped result means the feed URL variable is not configured; an authentication error means the sync token does not match the server-side token.