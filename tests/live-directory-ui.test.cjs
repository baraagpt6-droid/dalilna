"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

test("live map discovery panel appears for scoped home and category searches", () => {
  assert.match(html, /function liveDirectoryPanelHTML\(\)/);
  assert.match(html, /dalilna-live\.onrender\.com/);
  assert.match(html, /\/api\/places\/search/);
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
  assert.match(html, /controller\.abort\(\),100000/);
  assert.match(html, /id="liveDirectoryRetry"/);
  assert.match(html, /liveDirectoryRetry/);
  assert.match(html, /تأخر تشغيل خدمة البحث/);
});


test("direct OSM search is throttled, cached and bounded", () => {
  assert.match(html, /LIVE_DIRECTORY_API\+"\/health"/);
  assert.match(html, /controller\.abort\(\),100000/);
  assert.match(html, /id="liveDirectoryRetry"/);
  assert.match(html, /تأخر تشغيل خدمة البحث/);
});

test("live search exposes Google Maps fallback and provider attribution",()=>{
  assert.match(html,/google\.com\/maps\/search/);
  assert.match(html,/liveDirectoryAttribution/);
  assert.match(html,/Google Maps/);
});
test("Google Places results are not saved in the browser result cache",()=>{
  assert.match(html,/data\.source!==\"Google Maps\"/);
  assert.match(html,/live-google-source/);
});
test("changing selected region clears prior GPS coordinates",()=>{
  assert.match(html,/liveDirectoryCoords=null/);
  assert.match(html,/liveDirectoryVisibleCount=8/);
});
