"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
test("live place discovery supports Google Maps and OpenStreetMap fallback",()=>{
 assert.match(html,/function liveDirectoryPanelHTML\(\)/);assert.match(html,/dalilna-live\.onrender\.com/);
 assert.match(html,/\/api\/places\/search/);assert.match(html,/runLiveDirectorySearch\(false\)/);
 assert.match(html,/OpenStreetMap contributors/);
});
test("live results retain source links and geographic selection",()=>{
 assert.match(html,/item\.sourceUrl/);assert.match(html,/item\.mapsUrl/);
 assert.match(html,/function liveDirectoryContext\(\)/);assert.match(html,/fallbackPlace/);
 assert.match(html,/navigator\.geolocation\.getCurrentPosition/);
});
test("external place data is not inserted into local merchant listings",()=>{
 const a=html.indexOf("async function runLiveDirectorySearch"),b=html.indexOf("function renderLiveDirectoryResponse",a);
 assert.doesNotMatch(html.slice(a,b),/S\.items\.unshift|S\.items\.push|saveState\(/);
});
test("live search offers retry and explains network failures in Arabic",()=>{
 assert.match(html,/id="liveDirectoryRetry"/);assert.match(html,/هذا لا يؤكد عدم وجودها على أرض الواقع/);
 assert.match(html,/تعذر الوصول إلى خادم البحث/);assert.doesNotMatch(html,/Failed to fetch/);
});
test("home search does not request every category when the query is empty",()=>{
 assert.match(html,/لن نبحث في كل أنواع الأماكن تلقائياً/);
 assert.match(html,/اكتب اسم الخدمة أو افتح فئة محددة لبدء البحث/);
});
test("region count is clearly labeled as device-local",()=>{
 assert.match(html,/إدراج محلي على هذا الجهاز/);
});
test("local ratings and photos are clearly device-local",()=>{
 assert.match(html,/data-live-rate-id/);assert.match(html,/data-live-photo-input/);
 assert.match(html,/dalilna_live_places_159/);assert.match(html,/محفوظة على هذا الجهاز فقط/);
});
test("optional Wikimedia photo search shows author and license",()=>{
 assert.match(html,/api\/places\/photos/);assert.match(html,/data-commons-photos/);
 assert.match(html,/p\.author/);assert.match(html,/p\.license/);assert.match(html,/p\.sourceUrl/);
});
test("Google Maps places are shown as in-app cards with optional map links",()=>{
 assert.match(html,/\/api\/google\/places\/status/);
 assert.match(html,/\/api\/google\/places\/search/);
 assert.match(html,/function googleMapsDirectoryCardHTML\(item\)/);
 assert.match(html,/فتح الموقع في Google Maps/);
 assert.match(html,/href=\"\'+esc\(item\.mapsUrl\)/);
 assert.match(html,/tel:/);
 assert.match(html,/Google Maps · تُعرض بيانات المحلات هنا داخل دليلنا/);
 assert.doesNotMatch(html,/places\.googleapis\.com|GOOGLE_MAPS_API_KEY/);
});
test("live directory links to privacy and terms pages",()=>{assert.match(html,/\.\/privacy\.html/);assert.match(html,/\.\/terms\.html/);});
