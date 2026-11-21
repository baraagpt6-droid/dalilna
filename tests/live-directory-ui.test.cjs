"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
test("live place discovery prefers Geoapify free data and falls back to OpenStreetMap",()=>{
 assert.ok(html.includes("function liveDirectoryPanelHTML()"));
 assert.ok(html.includes("/api/geoapify/status"));
 assert.ok(html.includes("/api/geoapify/search"));
 assert.ok(html.includes("/api/places/search"));
 assert.match(html,/runLiveDirectorySearch/);
 assert.match(html,/OpenStreetMap contributors/);
});
test("live results retain source links and geographic selection",()=>{
 assert.ok(html.includes("item.mapsUrl"));
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
 assert.match(html,/اكتب مثلاً «بقالة» أو «صيدلية» أو اختر فئة محددة لعرض المحلات هنا/);
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
test("Geoapify results render in-app business cards with phone and optional map links",()=>{
 assert.match(html,/\/api\/geoapify\/status/);
 assert.match(html,/\/api\/geoapify\/search/);
 assert.match(html,/function geoapifyDirectoryCardHTML\(item\)/);
 assert.match(html,/Powered by Geoapify/);
 assert.match(html,/فتح الموقع على الخريطة/);
 assert.ok(html.includes("item.mapsUrl"));
 assert.match(html,/tel:/);
 assert.doesNotMatch(html,/GEOAPIFY_API_KEY|GOOGLE_MAPS_API_KEY|places\.googleapis\.com/);
});
test("live directory links to privacy and terms pages",()=>{assert.match(html,/\.\/privacy\.html/);assert.match(html,/\.\/terms\.html/);});

test("first-run public starter catalog includes real sourced businesses and products",()=>{
 assert.match(html,/const PUBLIC_BUSINESSES=\[/);
 assert.match(html,/const PUBLIC_PRODUCTS=\[/);
 assert.match(html,/seedCatalogVersion/);
 assert.match(html,/بيانات عامة · غير موثّقة/);
 assert.match(html,/عرض من متجر خارجي/);
 assert.match(html,/sourceUrl:safeExternalUrl/);
 assert.match(html,/https:\/\/hubloh\.com\/en\/cell-phones/);
 assert.match(html,/https:\/\/www\.google\.com\/maps\/search/);
});
