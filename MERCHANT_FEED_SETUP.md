# Dalilna 2.4.0 — merchant product feed integration

The shared marketplace accepts real merchant inventory only through the authenticated server endpoint:

- \`POST /api/marketplace/feed-sync\`
- The endpoint requires \`Authorization: Bearer <DALILNA_PRODUCT_SYNC_TOKEN>\`.
- The token must be at least 32 characters. The API compares it using a constant-time comparison.
- Feed URLs must be public HTTPS JSON endpoints. Supported bodies are a JSON array or an object with an \`items\` array.
- The importer limits each source to 200 records and each run to 200 accepted records. It rejects malformed entries and reports skipped records.
- A complete snapshot is required before records absent from that snapshot can be archived. Empty snapshots and partial/invalid snapshots never archive current products.
- Product records are upserted by a stable source URL and product ID. Daily runs update the same listing instead of creating duplicates.

## Required source fields

| Field | Required | Notes |
|---|---|---|
| \`id\` | yes | Stable product or listing ID in that merchant feed |
| \`title\` or \`name\` | yes | Product title |
| \`productType\` | yes | Must be one of the supported types in \`marketplace-api.js\` |
| \`sellerName\` | yes | Merchant or seller identity |
| \`phone\` or \`whatsapp\` | yes | Yemen/international phone with country code or local Yemeni mobile |
| \`governorate\` | yes | Must match one of the 22 supported Arabic governorate names |
| \`district\` | yes | District/directorate name |
| \`price\` | yes | Numeric price; zero is valid only for free listings |
| \`currency\` | yes | YER, SAR, USD, OMR, AED or other |
| \`description\` | no | Short product description |
| \`url\` / \`productUrl\` | no | Direct HTTPS product detail page |
| \`listingType\` | no | sale, wanted, barter, free or rent |
| \`condition\` | no | new, used or unknown |

## Configure the sources

Set these variables on the Render \`dalilna-live\` web service and the daily Render Cron service:

- \`DALILNA_PRODUCT_FEED_URLS\`: comma- or newline-separated HTTPS JSON feed URLs.
- \`DALILNA_PRODUCT_SYNC_TOKEN\`: the same high-entropy secret on both services, at least 32 characters.
- \`DALILNA_API_BASE_URL\`: \`https://dalilna-live.onrender.com\` on the Cron service.

Set the same \`DALILNA_PRODUCT_FEED_URLS\` as a GitHub Actions repository variable and \`DALILNA_PRODUCT_SYNC_TOKEN\` as a GitHub Actions repository secret.

No merchant feed URLs were present in the repository when this release was prepared. Until the marketplace owner configures a verified merchant feed and matching token, the daily job intentionally reports that product feed sync was skipped. It does not infer that a shop has inventory from an OpenStreetMap point, and it does not generate fake stock or prices.

## Daily schedule

- Yemen regional places and district-boundary rebuild: 02:20 UTC via GitHub Actions.
- Jobs feed refresh: 02:30 UTC via GitHub Actions.
- Jobs/marketplace health, live exchange freshness check and configured merchant feed import: 03:30 UTC via GitHub Actions and the Render Cron job.

Exchange values are fetched directly from the source at runtime. The daily job checks that the provider is reachable and recent. The app hides stale rates instead of retaining fixed device values.
