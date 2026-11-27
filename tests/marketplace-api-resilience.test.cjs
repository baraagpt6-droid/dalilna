"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "marketplace-client.js"), "utf8");
const start = source.indexOf("  const API_TIMEOUT_MS = 12000;");
const end = source.indexOf("\n  function fillSelect(", start);
assert.ok(start >= 0 && end > start, "marketplace API wrapper must exist");

function makeApi(fetchImpl) {
  const body = source.slice(start, end);
  const script = "(() => { const API = 'https://dalilna-live.onrender.com';\n"
    + body + "\nreturn api; })()";
  return vm.runInNewContext(script, {
    fetch: fetchImpl, AbortController, AbortSignal, TypeError, Error,
    Number, String, Set, Math, Promise, Object,
    window: { setTimeout, clearTimeout }
  });
}

function jsonResponse(status, payload, retryAfter) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === "retry-after" ? retryAfter || null : null },
    json: async () => payload
  };
}

test("GET retries one transient network failure and keeps no-store", async () => {
  const calls = [];
  const api = makeApi(async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) throw new TypeError("network disconnected");
    return jsonResponse(200, { items: [1] });
  });
  const result = await api("/api/marketplace/listings");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { items: [1] });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[1].url, "https://dalilna-live.onrender.com/api/marketplace/listings");
});

test("GET retries a temporary 503 response once", async () => {
  let calls = 0;
  const api = makeApi(async () => {
    calls += 1;
    return calls === 1 ? jsonResponse(503, { error: "service waking up" }) : jsonResponse(200, { ready: true });
  });
  const result = await api("/api/jobs");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ready: true });
  assert.equal(calls, 2);
});

test("POST is never retried after a network failure", async () => {
  let calls = 0;
  const api = makeApi(async () => { calls += 1; throw new TypeError("connection lost after request"); });
  await assert.rejects(api("/api/marketplace/listings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "one listing" })
  }), /connection lost/);
  assert.equal(calls, 1);
});

test("POST is never retried after a transient HTTP status", async () => {
  let calls = 0;
  const api = makeApi(async () => { calls += 1; return jsonResponse(503, { error: "temporarily unavailable" }); });
  await assert.rejects(api("/api/marketplace/reports", { method: "POST", body: "{}" }),
    error => error.status === 503);
  assert.equal(calls, 1);
});

test("timed-out idempotent request gets one retry with a fresh signal", async () => {
  let calls = 0;
  const signals = [];
  const api = makeApi((url, options) => {
    calls += 1;
    signals.push(options.signal);
    if (calls === 1) return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted"); error.name = "AbortError"; reject(error);
      }, { once: true });
    });
    return Promise.resolve(jsonResponse(200, { awake: true }));
  });
  const result = await api("/api/health", { timeoutMs: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { awake: true });
  assert.equal(calls, 2);
  assert.notEqual(signals[0], signals[1]);
});

test("timeout is applied by default and timeoutMs is not leaked to fetch", async () => {
  let received;
  const api = makeApi(async (url, options) => { received = options; return jsonResponse(200, {}); });
  await api("/api/health");
  assert.equal(received.signal instanceof AbortSignal, true);
  assert.equal(Object.hasOwn(received, "timeoutMs"), false);
  assert.equal(received.cache, "no-store");
});

test("caller cancellation is not retried", async () => {
  const external = new AbortController(); external.abort();
  let calls = 0;
  const api = makeApi(async () => { calls += 1; throw new TypeError("must not run"); });
  await assert.rejects(api("/api/jobs", { signal: external.signal }));
  assert.equal(calls, 0);
});
