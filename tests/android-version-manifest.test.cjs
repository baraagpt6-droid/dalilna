"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("PWA and Android manifests stay aligned at version 3.0.1", () => {
  const pwa = readJson("manifest.json");
  const android = readJson("android/app/src/main/assets/manifest.json");
  assert.equal(pwa.version, "3.0.1");
  assert.equal(android.version, "3.0.1");
  assert.deepEqual(android, pwa);
});

test("application package, Android Gradle and VERSION file agree on 3.0.1", () => {
  const packageJson = readJson("package.json");
  const gradle = fs.readFileSync(path.join(root, "android/app/build.gradle.kts"), "utf8");
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  assert.equal(packageJson.version, "3.0.1");
  assert.equal(version, "3.0.1");
  assert.match(gradle, /versionName = "3.0.1"/);
  assert.match(gradle, /versionCode = 3_000_000 \+ \(workflowRunNumber \* 100\)/);
});
