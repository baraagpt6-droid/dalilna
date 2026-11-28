"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("PWA and Android manifests stay aligned at version 3.1.0", () => {
  const pwa = readJson("manifest.json");
  const android = readJson("android/app/src/main/assets/manifest.json");
  assert.equal(pwa.version, "3.1.0");
  assert.equal(android.version, "3.1.0");
  assert.deepEqual(android, pwa);
});

test("Android Gradle and both OTA metadata files share version 3.1.0 and code 4129901", () => {
  const packageJson = readJson("package.json");
  const gradle = fs.readFileSync(path.join(root, "android/app/build.gradle.kts"), "utf8");
  const versionName = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const version = readJson("version.json");
  const androidVersion = readJson("android/app/src/main/assets/version.json");
  assert.equal(packageJson.version, "3.1.0");
  assert.equal(versionName, "3.1.0");
  assert.equal(version.version, "3.1.0");
  assert.equal(version.androidVersion, "3.1.0");
  assert.equal(version.versionCode, 4129901);
  assert.equal(version.androidVersionCode, 4129901);
  assert.equal(androidVersion.versionCode, 4129901);
  assert.equal(androidVersion.androidVersionCode, 4129901);
  assert.match(gradle, /versionName = "3\.1\.0"/);
  assert.match(gradle, /versionCodeForBuild = versionMetadataInt\("androidVersionCode"\)/);
  assert.match(gradle, /versionMetadataInt\("versionCode"\) == versionCodeForBuild/);
});
});
