"use strict";

const assert = require("node:assert/strict");

const baseUrl = String(process.env.LIVE_API_BASE_URL || "https://dalilna-live.onrender.com").replace(/\/+$/, "");
const timeoutMs = 90000;

async function getJson(path) {
  const response = await fetch(baseUrl + path, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function waitForService() {
  const deadline = Date.now() + 180000;
  let lastError = "service has not responded";
  while (Date.now() < deadline) {
    try {
      const { response, payload } = await getJson("/health");
      if (response.ok && payload.ok && payload.version === "1.5.8") return payload;
      lastError = "unexpected health response: HTTP " + response.status + " version=" + String(payload.version || "missing");
    } catch (error) {
      lastError = error.message || String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error("Render service did not become healthy on v1.5.8 within 180 seconds: " + lastError);
}

async function main() {
  const health = await waitForService();
  process.stdout.write("PASS live Render health: " + health.version + "\n");

  const { response: statusResponse, payload: status } = await getJson("/api/places/status");
  assert.equal(statusResponse.status, 200, "live provider status endpoint must return HTTP 200");
  assert.equal(typeof status.googleEnabled, "boolean");
  assert.equal(typeof status.googleKeyConfigured, "boolean");
  assert.equal(typeof status.googleFlagEnabled, "boolean");
  assert.equal(status.activeProvider, status.googleEnabled ? "Google Places" : "OpenStreetMap");
  process.stdout.write("PASS live provider status: " + JSON.stringify({
    googleEnabled: status.googleEnabled,
    googleKeyConfigured: status.googleKeyConfigured,
    googleFlagEnabled: status.googleFlagEnabled,
    activeProvider: status.activeProvider
  }) + "\n");

  const query = new URLSearchParams({
    q: "مطعم",
    category: "food",
    lat: "15.3694",
    lon: "44.1910",
    radius: "7000"
  });
  const { response: searchResponse, payload: result } = await getJson("/api/places/search?" + query.toString());
  if (searchResponse.status !== 200) {
    throw new Error("Live place search failed: HTTP " + searchResponse.status + " — " + String(result.error || JSON.stringify(result)));
  }
  assert.ok(Array.isArray(result.items), "live search must return an items array");
  assert.equal(result.count, result.items.length);
  assert.ok(["Google Maps", "OpenStreetMap"].includes(result.source));
  process.stdout.write("PASS live search endpoint: source=" + result.source + " count=" + result.count + "\n");

  if (status.googleEnabled) {
    if (result.source !== "Google Maps" || !result.items.length) {
      throw new Error("Google Places is enabled, but the live Sana'a restaurant search returned no Google results. Fallback reason: " + String(result.googleFallbackReason || "none"));
    }
    const first = result.items[0];
    assert.ok(first.googlePlaceId, "Google search result must carry a Place ID");
    const detailsResponse = await getJson("/api/places/details?placeId=" + encodeURIComponent(first.googlePlaceId));
    assert.equal(detailsResponse.response.status, 200, "live Google place details must return HTTP 200");
    assert.equal(detailsResponse.payload.source, "Google Maps");
    assert.ok(Array.isArray(detailsResponse.payload.details.photos));
    assert.ok(Array.isArray(detailsResponse.payload.details.reviews));
    process.stdout.write("PASS live Google details: " + first.name + ", photos=" + detailsResponse.payload.details.photos.length + ", reviews=" + detailsResponse.payload.details.reviews.length + "\n");

    const firstPhoto = detailsResponse.payload.details.photos[0];
    if (firstPhoto && firstPhoto.name) {
      const photoQuery = new URLSearchParams({
        placeId: first.googlePlaceId,
        photoName: firstPhoto.name
      });
      const photoResponse = await fetch(baseUrl + "/api/places/photo?" + photoQuery.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      });
      assert.equal(photoResponse.status, 200, "live Google photo proxy must return HTTP 200");
      assert.match(photoResponse.headers.get("content-type") || "", /^image\//);
      const bytes = await photoResponse.arrayBuffer();
      assert.ok(bytes.byteLength > 0, "live Google photo must not be empty");
      process.stdout.write("PASS live Google photo proxy: " + bytes.byteLength + " bytes\n");
    } else {
      process.stdout.write("WARN first live place has no Google photo; photo endpoint was verified with the mock integration check.\n");
    }
  } else {
    // The public service cannot call the paid provider without both a server-side key and the feature flag.
    const disabledDetails = await getJson("/api/places/details?placeId=ChIJDalilnaSmokeCheck123");
    assert.equal(disabledDetails.response.status, 503, "disabled Google details should be gated with HTTP 503");
    process.stdout.write("BLOCKED: live Google search/details are disabled. Add GOOGLE_PLACES_API_KEY as a Render secret, configure quotas/billing, then set GOOGLE_PLACES_ENABLED=true.\n");
    if (!result.items.length) {
      process.stdout.write("WARN: OpenStreetMap also returned zero places in the Sana'a test radius. This is source coverage, not proof that no restaurants exist.\n");
    }
  }
  process.stdout.write("RESULT: live Render HTTP checks completed.\n");
}

main().catch(error => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
});
