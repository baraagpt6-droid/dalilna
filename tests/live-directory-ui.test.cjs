"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");

test("primary places directory loads a static regional catalogue, not live map searches",()=>{
 assert.match(html,/const LIVE_CATALOG_BASE="\.\/regional-catalog\//);
 assert.match(html,/async function loadRegionalCatalogManifest/);
 assert.match(html,/async function loadRegionalCatalog/);
 assert.match(html,/async function runLiveDirectorySearch/);
 assert.doesNotMatch(html,/searchLivePlaces\(/);
 assert.doesNotMatch(html,/\/api\/places\/search/);
 assert.doesNotMatch(html,/\/api\/geoapify\/search/);
});

test("the country catalogue exposes governorate choices and per-governorate counts",()=>{
 assert.match(html,/function liveDirectoryLocationPrompt\(manifest\)/);
 assert.match(html,/manifest\.governorates/);
 assert.match(html,/data-region-gov=/);
 assert.match(html,/فهرس اليمن المحلي/);
});

test("the local directory keeps open-data attribution and explains incomplete coverage",()=>{
 assert.match(html,/OpenStreetMap contributors/);
 assert.match(html,/Open Admin Data/);
 assert.match(html,/هذا لا يعني أن المكان غير موجود/);
 assert.match(html,/تقدير تقريبي من أقرب مركز إداري/);
});

test("regional profiles open local directory categories instead of sending searches to Google Maps",()=>{
 assert.match(html,/data-region-category=/);
 assert.match(html,/تصفح المحلات والخدمات في هذه المنطقة/);
 assert.doesNotMatch(html,/regionMapSearch\(/);
 assert.doesNotMatch(html,/google\.com\/maps\/search/);
});

test("AI business lookup uses local regional data and approved shared adverts",()=>{
 assert.match(html,/loadRegionalCatalog\(context\.gov/);
 assert.match(html,/loadLiveMarketplaceMatches/);
 assert.match(html,/فهرس OpenStreetMap المحلي/);
 assert.match(html,/إعلانات أضافها المستخدمون واعتمدتها إدارة دليلنا/);
 assert.doesNotMatch(html,/searchLivePlaces\(/);
});

test("jobs and market sections continue to use reviewed shared listings",()=>{
 assert.match(html,/\/api\/marketplace\/listings/);
 assert.match(html,/إعلانات معتمدة/);
 assert.match(html,/الإعلانات المعتمدة/);
});

test("open maps only from a specific place card",()=>{
 assert.match(html,/openstreetmap\.org\/?mlat=/);
 assert.match(html,/الموقع والاتجاهات/);
 assert.doesNotMatch(html,/google\.com\/maps\/search/);
});

test("local photos and ratings remain labelled as device-only",()=>{
 assert.match(html,/data-live-rate-id/);
 assert.match(html,/data-live-photo-input/);
 assert.match(html,/محفوظة على هذا الجهاز فقط/);
});
