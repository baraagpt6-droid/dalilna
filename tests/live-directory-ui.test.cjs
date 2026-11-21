"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

test("live map discovery panel appears for scoped home and category searches", () => {
  assert.match(html, /function liveDirectoryPanelHTML\(\)/);
  assert.match(html, /nominatim\.openstreetmap\.org\/search/);
  assert.match(html, /overpass-api\.de\/api\/interpreter/);
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


test("live discovery prompt is shown directly below the search bar", () => {
  assert.match(html, /id="liveDirectoryTop"/);
  assert.match(html, /liveTop\.innerHTML=liveWanted\?liveDirectoryPanelHTML\(\):""/);
  assert.match(html, /id="liveDirectoryChooseRegion"/);
  assert.match(html, /اختيار المحافظة أو المديرية/);
});

test("scope count is described as local entries", () => {
  assert.match(html, /إدراج محلي/);
  assert.doesNotMatch(html, /const prefix=cur\.count===0\?"لا توجد إدراجات"/);
});


test("live search is bounded and offers retry after a timeout", () => {
  assert.match(html, /controller\.abort\(\),30000/);
  assert.match(html, /id="liveDirectoryRetry"/);
  assert.match(html, /liveDirectoryRetry/);
  assert.match(html, /انتهت مهلة الاتصال/);
});


test("direct OSM search is throttled, cached and bounded", () => {
  assert.match(html, /liveDirectoryLastGeocodeAt/);
  assert.match(html, /1100-\(Date\.now\(\)-liveDirectoryLastGeocodeAt\)/);
  assert.match(html, /controller\.abort\(\),30000/);
  assert.match(html, /liveDirectoryRetry/);
  assert.doesNotMatch(html, /const LIVE_DIRECTORY_API=/);
});
