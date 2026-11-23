# Verified merchant product feeds

Dalilna does not scrape arbitrary storefront pages and does not infer stock or prices from map listings. The daily importer accepts explicit public HTTPS JSON feeds supplied by the app operator.

## Configure a feed

Configure the feed on the GitHub repository used by Dalilna. Open **Settings → Secrets and variables → Actions** and add:

- Repository variable `DALILNA_PRODUCT_FEED_URLS`: one HTTPS JSON URL per line or a comma-separated list. Each endpoint must return either a JSON array or an object with an `items` array.
- Repository secret `DALILNA_PRODUCT_SYNC_TOKEN`: a random token with at least 32 characters. Keep it private. The feed endpoint itself must be a public HTTPS URL; the sync token protects the write request to Dalilna.

Example:

```json
{
  "items": [
    {
      "id": "SKU-100",
      "title": "هاتف ذكي",
      "productType": "phone",
      "sellerName": "اسم المتجر",
      "phone": "+967777123456",
      "governorate": "إب",
      "district": "حبيش",
      "area": "مركز المديرية",
      "price": "120000",
      "currency": "YER",
      "condition": "new",
      "listingType": "sale",
      "description": "وصف المنتج",
      "productUrl": "https://merchant.example/products/SKU-100",
      "imageUrl": "https://cdn.merchant.example/images/SKU-100.webp",
      "status": "available"
    }
  ]
}
```

Required fields: stable `id`, `title`, valid `productType`, `sellerName`, a WhatsApp-capable `phone`, exact Yemeni `governorate`, `district`, `price`, supported `currency` and a public HTTPS `imageUrl`. Records without these fields or a safe HTTPS image URL are rejected. Each displayed image stays on the merchant CDN; the importer does not scrape or invent product photos. Product status values such as `sold`, `expired`, `inactive` and `out_of_stock` are excluded.

The importer keeps the merchant image URL with the live price and currency. The six-hour refresh job updates the approved listings from the authorized feed; changed or unavailable items follow the feed snapshot rules below.\n\nThe API supports the seven published product groups: electronics, vehicles and parts, property, solar and batteries, home furniture and appliances, agriculture/livestock/equipment, and clothing/perfume/accessories.

## Security and lifecycle

- Only HTTPS feed URLs are fetched.
- The scheduled GitHub Actions job sends validated records to `/api/marketplace/feed-sync` using `DALILNA_PRODUCT_SYNC_TOKEN`.
- The API upserts stable feed references; repeated daily runs do not duplicate the same product.
- A complete feed snapshot archives products removed from the configured feeds. If one feed fails, the run is marked incomplete and existing records are not mass-archived.
- Feed listings are labelled as merchant feed records and expire after 60 days unless refreshed.
- User-submitted ads continue through the existing moderation queue; merchant feeds do not change their approval state.
- Source feed owners are responsible for providing accurate stock, price, seller and location data.

## Daily jobs

GitHub Actions runs `node scripts/daily-sync.cjs` every six hours. It validates the exchange source, checks the marketplace and jobs API, and synchronizes configured merchant JSON feeds. No Render Cron service is required for this schedule.

No external product source is enabled by default. Configure feed URLs only after the merchant authorizes their use. The refresh job reports `configured: 0` when the Repository variable is missing; it does not create placeholder products.
