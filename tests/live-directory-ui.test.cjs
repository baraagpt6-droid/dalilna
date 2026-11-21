"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

test("live map discovery panel appears for scoped home and category searches", () => {
  assert.match(html, /function liveDirectoryPanelHTML\(\)/);
  assert.match(html, /dalilna-directory-api\.onrender\.com/);
  assert.match(html, /runLiveDirectorySearch\(false\)/);
});

test("live results display OpenStreetMap attribution and the original source link", () => {
  assert.match(html, /OpenStreetMap contributors/);
  assert.match(html, /function liveDirectoryCardHTML/);
  assert.match(html, /item\.sourceUrl/);
  assert.match(html, /item\.mapsUrl/);
});

test("live search uses the selected region or asks permission for GPS", () => {
  assert.match(html, /function liveDirectoryContext\(\)/);
  assert.match(html, /fallbackPlace/);
  assert.match(html, /navigator\.geolocation\.getCurrentPosition/);
});

test("live external data is not inserted into local merchant listings", () => {
  const start = html.indexOf("async function runLiveDirectorySearch");
  const end = html.indexOf("function renderLiveDirectoryResponse", start);
  const block = html.slice(start, end);
  assert.doesNotMatch(block, /S\.items\.unshift|S\.items\.push|saveState\(/);
});
