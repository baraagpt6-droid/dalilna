# Verified merchant product feeds

Dalilna does not scrape arbitrary storefront pages and does not infer stock or prices from map listings. The daily importer accepts explicit public HTTPS JSON feeds supplied by the app operator.

## Configure a feed

Set `DALILNA_PRODUCT_FEED_URLS` on the Render Cron service. Use one HTTPS JSON URL per line or a comma-separated list. Each endpoint must return either a JSON array or an object with an `items` array.

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
- The Cron job sends validated records to `/api/marketplace/feed-sync` using `DALILNA_PRODUCT_SYNC_TOKEN`.
- The API upserts stable feed references; repeated daily runs do not duplicate the same product.
- A complete feed snapshot archives products removed from the configured feeds. If one feed fails, the run is marked incomplete and existing records are not mass-archived.
- Feed listings are labelled as merchant feed records and expire after 60 days unless refreshed.
- User-submitted ads continue through the existing moderation queue; merchant feeds do not change their approval state.
- Source feed owners are responsible for providing accurate stock, price, seller and location data.

## Daily jobs

GitHub Actions refreshes the Yemen place catalogue and jobs feed daily. Render Cron runs `node scripts/daily-sync.cjs` daily to validate the live exchange source, check the marketplace and jobs API, and synchronize configured merchant JSON feeds.

No external product source is enabled by default. Configure feed URLs only after the merchant authorizes their use.
