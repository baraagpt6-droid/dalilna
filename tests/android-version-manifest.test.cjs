"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("PWA and Android manifests stay aligned at version 2.9.0", () => {
  const pwa = readJson("manifest.json");
  const android = readJson("android/app/src/main/assets/manifest.json");
  assert.equal(pwa.version, "2.9.0");
  assert.equal(android.version, "2.9.0");
  assert.deepEqual(android, pwa);
});

test("application package, Android Gradle and VERSION file agree on 2.9.0", () => {
  const packageJson = readJson("package.json");
  const gradle = fs.readFileSync(path.join(root, "android/app/build.gradle.kts"), "utf8");
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  assert.equal(packageJson.version, "2.9.0");
  assert.equal(version, "2.9.0");
  assert.match(gradle, /versionName = "2\.8\.0"/);
  assert.match(gradle, /versionCode = 2_900_000 \+ \(workflowRunNumber \* 100\)/);
});
