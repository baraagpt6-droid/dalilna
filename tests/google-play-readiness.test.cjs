const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Android production configuration targets API 36 and enables safe R8 shrinking", () => {
  const gradle = read("android/app/build.gradle.kts");
  assert.match(gradle, /compileSdk\s*=\s*36/);
  assert.match(gradle, /targetSdk\s*=\s*36/);
  assert.match(gradle, /versionName\s*=\s*"3\.1\.0"/);
  assert.match(gradle, /isMinifyEnabled\s*=\s*true/);
  assert.match(gradle, /proguard-rules\.pro/);
  assert.match(gradle, /play-services-ads:25\.5\.0/);
  assert.match(gradle, /user-messaging-platform:4\.0\.0/);
});

test("Android manifest uses configurable AdMob app ID and explicit permissions", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.match(manifest, /\$\{adMobAppId\}/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.ACCESS_FINE_LOCATION/);
  assert.match(manifest, /android\.permission\.ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /android:allowBackup="false"/);
});

test("AdMob defaults are Google test IDs; production IDs are configurable and not hard-coded", () => {
  const config = read("android/ads.properties");
  assert.match(config, /test\.appId=ca-app-pub-3940256099942544~3347511713/);
  assert.match(config, /test\.bannerAdUnitId=ca-app-pub-3940256099942544\/9214589741/);
  assert.match(config, /release\.appId=\s*$/m);
  assert.match(config, /release\.bannerAdUnitId=\s*$/m);
});

test("privacy policy contains Arabic and English disclosures for current data flows", () => {
  const policy = read("privacy.html");
  for (const term of ["arabicPolicy", "englishPolicy", "Google AdMob", "Google Mobile Ads", "Google Gemini", "Firebase", "الموقع الجغرافي", "المفضلة", "المحلات", "HTTPS"]) {
    assert.ok(policy.includes(term), `privacy.html must disclose: ${term}`);
  }
});

test("Play Data safety worksheet explains AdMob data and local-only profiles", () => {
  const safety = read("GOOGLE_PLAY_DATA_SAFETY.md");
  assert.match(safety, /Google Mobile Ads SDK/);
  assert.match(safety, /Advertising ID/);
  assert.match(safety, /Account creation: \*\*No\*\*/i);
  assert.match(safety, /Firebase Analytics.*not/i);
  assert.match(safety, /AdMob/);
});

test("privacy policy is linked from the profile/account dialog and Android assets sync it", () => {
  const html = read("index.html");
  const workflow = read(".github/workflows/android-apk.yml");
  assert.match(html, /id="profilePrivacyLink"[^>]*href="\.\/privacy\.html"/);
  assert.match(workflow, /privacy\.html/);
  assert.match(workflow, /app-release\.aab/);
  assert.match(workflow, /bundleRelease/);
});
