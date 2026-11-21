"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { server } = require("../server");

const PLACE_ID = "ChIJDalilnaMock1234";
const PHOTO_NAME = "places/" + PLACE_ID + "/photos/PhotoIdentifier123";
const TEST_KEY = "test-google-places-key";

const previousEnv = {
  enabled: process.env.GOOGLE_PLACES_ENABLED,
  key: process.env.GOOGLE_PLACES_API_KEY
};
const originalFetch = global.fetch;
let baseUrl = "";

function restoreEnv() {
  if (previousEnv.enabled === undefined) delete process.env.GOOGLE_PLACES_ENABLED;
  else process.env.GOOGLE_PLACES_ENABLED = previousEnv.enabled;
  if (previousEnv.key === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = previousEnv.key;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function httpRequest(path, ip) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      host: "127.0.0.1",
      port: Number(new URL(baseUrl).port),
      path,
      headers: { "x-forwarded-for": ip, "accept": "application/json" }
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    request.on("error", reject);
    request.setTimeout(25000, () => request.destroy(new Error("Local HTTP integration request timed out")));
  });
}

function googlePlace(overrides = {}) {
  return {
    id: PLACE_ID,
    displayName: { text: "مطعم دليلنا التجريبي" },
    formattedAddress: "شارع الزبيري، صنعاء، اليمن",
    location: { latitude: 15.3694, longitude: 44.1910 },
    googleMapsUri: "https://www.google.com/maps/place/Dalilna+Test",
    nationalPhoneNumber: "+967 1 234 567",
    websiteUri: "https://example.test/dalilna",
    rating: 4.7,
    userRatingCount: 128,
    businessStatus: "OPERATIONAL",
    priceLevel: "PRICE_LEVEL_MODERATE",
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ["السبت: 08:00 – 23:00"]
    },
    primaryTypeDisplayName: { text: "مطعم" },
    ...overrides
  };
}

async function run() {
  process.env.GOOGLE_PLACES_ENABLED = "true";
  process.env.GOOGLE_PLACES_API_KEY = TEST_KEY;

  await new Promise((resolve, reject) => {
    if (server.listening) return reject(new Error("The application server is already listening"));
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;

  try {
    // 1. The real HTTP status route must report feature state without exposing the key.
    {
      const response = await httpRequest("/api/places/status", "198.51.100.11");
      assert.equal(response.status, 200, "places status endpoint should respond");
      const status = JSON.parse(response.body.toString("utf8"));
      assert.equal(status.googleEnabled, true);
      assert.equal(status.googleKeyConfigured, true);
      assert.equal(status.googleFlagEnabled, true);
      assert.equal(status.activeProvider, "Google Places");
      assert.equal(response.body.toString("utf8").includes(TEST_KEY), false, "the API key must never be exposed");
      process.stdout.write("PASS HTTP provider status and secret redaction\n");
    }

    // 2. Search traverses the actual HTTP route and the Google Places Text Search proxy.
    {
      let outboundRequest = null;
      global.fetch = async (input, options = {}) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "places.googleapis.com");
        assert.equal(url.pathname, "/v1/places:searchText");
        outboundRequest = { url, options };
        return jsonResponse({ places: [googlePlace()] });
      };

      const query = new URLSearchParams({
        q: "مطعم",
        category: "food",
        lat: "15.3694",
        lon: "44.1910",
        radius: "5000"
      });
      const response = await httpRequest("/api/places/search?" + query, "198.51.100.12");
      assert.equal(response.status, 200, "search endpoint should respond successfully");
      const result = JSON.parse(response.body.toString("utf8"));
      assert.equal(result.source, "Google Maps");
      assert.equal(result.count, 1);
      assert.equal(result.items[0].name, "مطعم دليلنا التجريبي");
      assert.equal(result.items[0].rating, 4.7);
      assert.equal(result.items[0].ratingCount, 128);
      assert.equal(result.items[0].phone, "+967 1 234 567");
      assert.equal(result.items[0].website, "https://example.test/dalilna");
      assert.equal(result.items[0].openNow, true);
      assert.ok(outboundRequest, "Google Text Search should have been called");
      assert.equal(outboundRequest.options.headers["X-Goog-Api-Key"], TEST_KEY);
      assert.match(outboundRequest.options.headers["X-Goog-FieldMask"], /places\.rating/);
      assert.match(outboundRequest.options.headers["X-Goog-FieldMask"], /places\.userRatingCount/);
      assert.equal(JSON.parse(outboundRequest.options.body).includedType, "restaurant");
      process.stdout.write("PASS live-search HTTP route -> Google Places proxy -> rated business result\n");
    }

    // 3. Detail route returns photo names and visitor reviews only when requested.
    {
      global.fetch = async input => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "places.googleapis.com");
        assert.equal(url.pathname, "/v1/places/" + PLACE_ID);
        return jsonResponse(googlePlace({
          photos: [{
            name: PHOTO_NAME,
            authorAttributions: [{
              displayName: "مساهم تجريبي",
              uri: "https://maps.google.com/maps/contrib/123",
              photoUri: "https://lh3.googleusercontent.com/test-author"
            }]
          }],
          reviews: [{
            rating: 5,
            text: { text: "تجربة ممتازة في اختبار التكامل." },
            relativePublishTimeDescription: "قبل أسبوع",
            authorAttribution: {
              displayName: "زائر تجريبي",
              uri: "https://maps.google.com/maps/contrib/456",
              photoUri: "https://lh3.googleusercontent.com/test-reviewer"
            }
          }]
        }));
      };

      const response = await httpRequest("/api/places/details?placeId=" + PLACE_ID, "198.51.100.13");
      assert.equal(response.status, 200, "place details endpoint should respond successfully");
      const payload = JSON.parse(response.body.toString("utf8"));
      assert.equal(payload.source, "Google Maps");
      assert.equal(payload.details.rating, 4.7);
      assert.equal(payload.details.photos.length, 1);
      assert.equal(payload.details.reviews.length, 1);
      assert.equal(payload.details.reviews[0].text, "تجربة ممتازة في اختبار التكامل.");
      assert.equal(payload.details.reviews[0].author.displayName, "زائر تجريبي");
      process.stdout.write("PASS place-details HTTP route -> photos and attributed visitor reviews\n");
    }

    // 4. Photo route obtains a short-lived Google URI and never forwards the API key to that host.
    {
      const outbound = [];
      global.fetch = async (input, options = {}) => {
        const url = new URL(String(input));
        outbound.push({ url, options });
        if (url.hostname === "places.googleapis.com") {
          assert.equal(url.searchParams.get("skipHttpRedirect"), "true");
          return jsonResponse({ photoUri: "https://lh3.googleusercontent.com/dalilna-integration-image" });
        }
        assert.equal(url.hostname, "lh3.googleusercontent.com");
        return new Response(Uint8Array.from([255, 216, 255, 217]), {
          status: 200,
          headers: { "content-type": "image/jpeg" }
        });
      };

      const photoQuery = new URLSearchParams({ placeId: PLACE_ID, photoName: PHOTO_NAME });
      const response = await httpRequest("/api/places/photo?" + photoQuery, "198.51.100.14");
      assert.equal(response.status, 200, "place photo endpoint should respond successfully");
      assert.equal(response.headers["content-type"], "image/jpeg");
      assert.deepEqual([...response.body], [255, 216, 255, 217]);
      assert.equal(outbound.length, 2);
      assert.equal(outbound[0].options.headers["X-Goog-Api-Key"], TEST_KEY);
      assert.equal(outbound[1].options.headers["X-Goog-Api-Key"], undefined, "the secret must not reach googleusercontent.com");
      process.stdout.write("PASS photo HTTP route -> Google media URI -> image without API-key leakage\n");
    }

    // 5. An empty Google response must fall back to OSM and keep the explanation in the API response.
    {
      const calls = [];
      global.fetch = async (input, options = {}) => {
        const url = new URL(String(input));
        calls.push(url.hostname);
        if (url.hostname === "places.googleapis.com") return jsonResponse({ places: [] });
        if (url.hostname === "overpass-api.de") return jsonResponse({ elements: [] });
        throw new Error("Unexpected external host in empty-results test: " + url.hostname);
      };

      const query = new URLSearchParams({
        q: "مطعم",
        category: "food",
        lat: "15.3694",
        lon: "44.1910",
        radius: "5000"
      });
      const response = await httpRequest("/api/places/search?" + query, "198.51.100.15");
      assert.equal(response.status, 200, "empty-search fallback should return HTTP 200");
      const result = JSON.parse(response.body.toString("utf8"));
      assert.equal(result.source, "OpenStreetMap");
      assert.equal(result.count, 0);
      assert.match(result.googleFallbackReason, /لم يعثر Google Places على نتائج/);
      assert.ok(calls.includes("places.googleapis.com"));
      assert.ok(calls.includes("overpass-api.de"));
      process.stdout.write("PASS empty Google response -> OpenStreetMap fallback with an explicit reason\n");
    }

    // 6. The feature gate must prevent details access when Google is disabled.
    {
      process.env.GOOGLE_PLACES_ENABLED = "false";
      const response = await httpRequest("/api/places/details?placeId=" + PLACE_ID, "198.51.100.16");
      assert.equal(response.status, 503);
      const payload = JSON.parse(response.body.toString("utf8"));
      assert.match(payload.error, /Google Places غير مفعّل/);
      process.stdout.write("PASS disabled Google feature gate returns a clear HTTP 503\n");
    }

    process.stdout.write("RESULT: 6 HTTP integration checks passed; no mock upstream call failed.\n");
  } finally {
    global.fetch = originalFetch;
    restoreEnv();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
  if (server.listening) server.close();
});
