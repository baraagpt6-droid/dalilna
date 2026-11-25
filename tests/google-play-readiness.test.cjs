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

test("privacy policy contains bilingual disclosures, voice recognition and developer placeholders", () => {
  const policy = read("privacy.html");
  for (const term of ["arabicPolicy", "englishPolicy", "Google Mobile Ads", "Google Gemini", "Firebase", "الموقع الجغرافي", "المفضلة", "المحل", "البحث الصوتي", "الميكروفون", "HTTPS", "[اسم المطور الرسمي]", "[البريد الإلكتروني الرسمي]"]) {
    assert.ok(policy.includes(term), `privacy.html must disclose: ${term}`);
  }
  assert.ok(!policy.includes("baraagpt6@gmail.com"));
});

test("Play Data safety worksheet explains AdMob data and local-only profiles", () => {
  const safety = read("GOOGLE_PLAY_DATA_SAFETY.md");
  assert.match(safety, /Google Mobile Ads SDK/);
  assert.match(safety, /Advertising ID/);
  assert.match(safety, /No centralized customer or merchant account registration/i);
  assert.match(safety, /No Firebase Analytics/i);
  assert.match(safety, /AdMob/);
  assert.match(safety, /Audio files.*voice or sound recordings/i);
  assert.match(safety, /12\.5|voice/i);
});

test("privacy policy is linked from the profile/account dialog and Android assets sync it", () => {
  const html = read("index.html");
  const workflow = read(".github/workflows/android-apk.yml");
  assert.match(html, /id="profilePrivacyLink"[^>]*href="\.\/privacy\.html"/);
  assert.match(workflow, /privacy\.html/);
  assert.match(workflow, /app-release\.aab/);
  assert.match(workflow, /bundleRelease/);
});

test("public marketing page and neutral static build are prepared", () => {
  const landing = read("store/index.html");
  const builder = read("scripts/build-static-site.cjs");
  const packageJson = JSON.parse(read("package.json"));
  assert.match(landing, /دليلنا/);
  assert.match(landing, /\[اسم المطور الرسمي\]/);
  assert.match(landing, /\[البريد الإلكتروني الرسمي\]/);
  assert.match(builder, /store\/index\.html/);
  assert.match(builder, /outputDirectory: "dist"/);
  assert.equal(packageJson.scripts["build:static"], "node scripts/build-static-site.cjs");
});

test("voice search explains microphone processing before requesting recognition", () => {
  const html = read("index.html");
  assert.match(html, /voiceDisclosure/);
  assert.match(html, /window\.confirm\(voiceDisclosure\)/);
  assert.match(html, /الميكروفون/);
  const activity = read("android/app/src/main/java/ye/dalilna/app/MainActivity.java");
  assert.match(activity, /REMOTE_APP_URL/);
  assert.doesNotMatch(activity, /legacy.*host/i);
});

test("Android bundled policy pages match current public policy files", () => {
  assert.equal(read("privacy.html"), read("android/app/src/main/assets/privacy.html"));
  assert.equal(read("terms.html"), read("android/app/src/main/assets/terms.html"));
});

test("the public store page is deployed separately from the PWA application route", () => {
  const landing = read("store/index.html");
  const pagesWorkflow = read(".github/workflows/deploy-pages.yml");
  assert.ok(landing.includes('rel="canonical" href="https://baraagpt6-droid.github.io/dalilna/store/"'));
  assert.ok(landing.includes('href="../privacy.html"'));
  assert.ok(landing.includes('href="../terms.html"'));
  assert.ok(pagesWorkflow.includes("cp store/index.html _site/store/index.html"));
  assert.ok(pagesWorkflow.includes("test -s _site/store/index.html"));
});

test("production runtime contains no legacy static-host origin or migration branch", () => {
  const files = [
    "index.html",
    "server.js",
    "app-native-bridge.js",
    "android/app/src/main/java/ye/dalilna/app/MainActivity.java",
    "android/app/src/main/assets/index.html",
    "android/app/src/main/assets/app-native-bridge.js",
    ".github/workflows/deploy-pages.yml",
    ".github/workflows/android-apk.yml",
    "package.json"
  ];
  const source = files.map(read).join("\\n").toLowerCase();
  const provider = ["net", "lify"].join("");
  const legacyOrigin = ["dalilna-ftny", provider, "app"].join(".");
  assert.equal(source.includes(provider), false);
  assert.equal(source.includes(legacyOrigin), false);
});
