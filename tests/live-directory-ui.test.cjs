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
test("region counts no longer mislabel public seed listings as device-local",()=>{
 assert.match(html,/إدراجات مسجلة/);
 assert.doesNotMatch(html,/0 إدراج محلي على هذا الجهاز/);
});
test("curated Yemen seed data has sources, review timestamps and useful starter content",()=>{
 const start=html.indexOf("const SEED_ITEMS=")+ "const SEED_ITEMS=".length;
 const end=html.indexOf("const LEGACY_DEMO_IDS",start);
 assert.ok(start>0&&end>start,"SEED_ITEMS must remain a JSON-readable starter directory");
 const seeds=JSON.parse(html.slice(start,end));
 assert.ok(seeds.length>=24);
 assert.ok(seeds.some(x=>x.name==="المتجر العالمي Global Store"));
 assert.ok(seeds.some(x=>x.name==="مطاعم الشيباني جولدن"));
 assert.ok(seeds.some(x=>x.cat==="souq"&&x.sourceType==="official_product"));
 assert.ok(seeds.filter(x=>x.cat==="jobs").length>=7);
 assert.ok(seeds.filter(x=>x.sourceType==="brand_dealer").length>=10);
 assert.ok(seeds.every(x=>x.sourceName&&x.sourceUrl&&x.sourceCheckedAt));
 assert.ok(seeds.every(x=>!x.verifiedAt));
});
test("seed records merge with saved user listings and admin seed removals persist",()=>{
 assert.ok(html.includes("const items=[...activeSeeds,...storedItems.filter"));
 assert.ok(html.includes("removedSeedIds:[...removedSeedIds]"));
 assert.ok(html.includes("S.removedSeedIds.push(it.id)"));
});
test("nationwide offers are not hidden when a governorate is selected",()=>{
 assert.ok(html.includes("if(item.nationwide===true)return true"));
 assert.ok(html.includes("if(scope)r=r.filter(i=>scopeMatchesItem(i))"));
});
test("expired jobs and market offers are hidden automatically",()=>{
 assert.ok(html.includes('i.expiresAt>Date.now()'));
 assert.ok(html.includes('i.cat==="souq"&&(!i.expiresAt||i.expiresAt>Date.now())&&match(i)'));
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
