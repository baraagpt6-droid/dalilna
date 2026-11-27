"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getClientIp, validSingleIp } = require("../client-ip");
const { setCors } = require("../server");

test("Render Cloudflare client IP overrides a client-supplied X-Forwarded-For value", () => {
  const req = {
    headers: {
      "cf-connecting-ip": "198.51.100.24",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    },
    socket: { remoteAddress: "10.0.0.4" },
  };
  assert.equal(getClientIp(req), "198.51.100.24");
});

test("Vercel's canonical x-real-ip is used only with its platform request ID", () => {
  const trusted = {
    headers: {
      "x-vercel-id": "sin1::abc123",
      "x-real-ip": "203.0.113.17",
      "x-forwarded-for": "1.1.1.1",
    },
    socket: { remoteAddress: "10.0.0.8" },
  };
  assert.equal(getClientIp(trusted), "203.0.113.17");
});

test("X-Forwarded-For and x-real-ip are ignored without a trusted edge marker", () => {
  const req = {
    headers: {
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
      "x-real-ip": "203.0.113.17",
    },
    socket: { remoteAddress: "10.0.0.9" },
  };
  assert.equal(getClientIp(req), "10.0.0.9");
});

test("Invalid or multi-value Cloudflare IP header falls back to the socket IP", () => {
  const req = {
    headers: {
      "cf-connecting-ip": "198.51.100.24, 1.1.1.1",
      "x-forwarded-for": "1.1.1.1",
    },
    socket: { remoteAddress: "10.0.0.10" },
  };
  assert.equal(getClientIp(req), "10.0.0.10");
});

test("IPv4 and IPv6 addresses are accepted; hostnames and header lists are not", () => {
  assert.equal(validSingleIp(" 203.0.113.9 "), "203.0.113.9");
  assert.equal(validSingleIp("2001:db8::1"), "2001:db8::1");
  assert.equal(validSingleIp("attacker.example"), "");
  assert.equal(validSingleIp("203.0.113.9, 1.1.1.1"), "");
  assert.equal(validSingleIp(""), "");
});

function corsHeaders(path, origin) {
  const values = new Map();
  setCors(
    { url: path, headers: origin ? { origin } : {} },
    { setHeader(name, value) { values.set(name.toLowerCase(), value); } }
  );
  return values;
}

test("Marketplace moderation and product feed sync CORS are allowlist-only", () => {
  for (const path of [
    "/api/marketplace/admin/pending",
    "/api/marketplace/admin/reports",
    "/api/marketplace/feed-sync",
  ]) {
    const hostile = corsHeaders(path, "https://evil.example");
    assert.equal(hostile.has("access-control-allow-origin"), false, path);
    const trusted = corsHeaders(path, "https://baraagpt6-droid.github.io");
    assert.equal(trusted.get("access-control-allow-origin"), "https://baraagpt6-droid.github.io", path);
    assert.match(trusted.get("access-control-allow-headers"), /Authorization/i);
  }
});

test("Public marketplace endpoints retain their public cross-origin access", () => {
  const values = corsHeaders("/api/marketplace/listings", "https://evil.example");
  assert.equal(values.get("access-control-allow-origin"), "*");
});
