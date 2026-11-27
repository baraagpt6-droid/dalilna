"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
function read(p) { return fs.readFileSync(path.join(root, p), "utf8"); }

const client = read("marketplace-client.js");
const features = read("features-2.1.js");
const index = read("index.html");
const privacy = read("privacy.html");

test("marketplace and jobs UI never appends raw exception messages", () => {
  assert.doesNotMatch(client, /(?:e|error)\.message/);
  assert.doesNotMatch(features, /(?:e|error)\.message/);
  assert.doesNotMatch(client, /DALILNA_ADMIN_TOKEN|DATABASE_URL|PostgreSQL/);
});

test("main PWA does not inject raw backend errors into visible UI", () => {
  assert.doesNotMatch(index, /esc\(error\?\.message/);
  assert.doesNotMatch(index, /panel\.textContent\s*=\s*error\.message/);
  assert.doesNotMatch(index, /liveFxError=.*(?:error|e)\??\.message/);
  const exposed = index.split(/\r?\n/).filter(line =>
    /\.(?:textContent|innerHTML)\s*=/.test(line) && /(?:error|e)\??\.message/.test(line)
  );
  assert.deepEqual(exposed, []);
});

test("jobs service uses a 12 second timeout and retries only safe reads", () => {
  assert.ok(features.includes("const API_TIMEOUT_MS=12000;"));
  assert.ok(features.includes('const retries=method==="GET"?1:0;'));
  assert.ok(features.includes("API_RETRYABLE_GET_STATUSES"));
  assert.ok(features.includes("requestJobsApi("));
});

test("public policy preserves privacy disclosures without exposing connection settings or hostnames", () => {
  for (const term of ["Web Speech API", "Nominatim", "Photon", "Overpass", "سجلات الخادم", "لا يحذف صف قاعدة البيانات تلقائياً"]) {
    assert.ok(privacy.includes(term), "privacy.html must disclose: " + term);
  }
  assert.doesNotMatch(privacy, /DATABASE_URL|GEOAPIFY_API_KEY|onrender\.com|Render/i);
  assert.doesNotMatch(index, /Requires PostgreSQL|server admin token|يتطلب ربط PostgreSQL/);
});

function walkPublicFiles(relativeDir) {
  const absolute = path.join(root, relativeDir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return walkPublicFiles(child);
    return /\.(?:html|js|css|json|svg|txt|xml)$/i.test(entry.name) ? [child] : [];
  });
}
const publicFiles = [
  "index.html", "marketplace-client.js", "features-2.1.js", "sw.js",
  "app-update.js", "app-native-bridge.js", "v3.0.0.js", "v3.0.0.css",
  "regional-catalog-runtime.js", "regions-yemen.js", "regions-profiles.js",
  "privacy.html", "terms.html", "data-deletion.html", "manifest.json",
  "version.json", "market_items.json", "market_prices_yemen.json",
  "jobs-feed.json", "store/index.html",
  ...walkPublicFiles("regional-catalog"),
  ...walkPublicFiles("icons"),
  ...walkPublicFiles("market-price-images")
];
const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Google API key", /(?:^|[^A-Za-z0-9_-])AIzaSy[A-Za-z0-9_-]{33}(?:$|[^A-Za-z0-9_-])/],
  ["AWS key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Stripe secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["database URL", /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/i],
  ["database env name", /\bDATABASE_URL\b/],
  ["literal privileged secret", /\b(?:ADMIN_TOKEN|API_KEY|SECRET_KEY|PRIVATE_KEY|PASSWORD)\b\s*[:=]\s*["']([A-Za-z0-9_./+=-]{16,})["']/i],
  ["generic secret literal", /\b(?:password|token|secret|api[_-]?key)\b\s*[:=]\s*["'][^"']{16,}["']/i]
];

test("GitHub Pages assets contain no known credentials or database connection strings", () => {
  for (const file of publicFiles) {
    const content = read(file);
    for (const [label, pattern] of secretPatterns) {
      assert.doesNotMatch(content, pattern, file + " contains a possible " + label);
    }
  }
});

test("Android WebView mirrors match the reviewed public source files", () => {
  for (const file of [
    "index.html", "marketplace-client.js", "features-2.1.js",
    "privacy.html", "sw.js", "app-update.js", "app-native-bridge.js"
  ]) {
    assert.equal(read("android/app/src/main/assets/" + file), read(file), file + " differs");
  }
});

test("Android public WebView assets contain no known credentials or database URLs", () => {
  for (const file of [
    "index.html", "marketplace-client.js", "features-2.1.js",
    "privacy.html", "sw.js", "app-update.js", "app-native-bridge.js"
  ]) {
    const content = read("android/app/src/main/assets/" + file);
    for (const [label, pattern] of secretPatterns) {
      assert.doesNotMatch(content, pattern, file + " contains a possible " + label);
    }
  }
});
