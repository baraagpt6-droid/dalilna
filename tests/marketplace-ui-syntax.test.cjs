"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const html=fs.readFileSync("index.html","utf8"),client=fs.readFileSync("marketplace-client.js","utf8"),features=fs.readFileSync("features-2.1.js","utf8");
const inline=html.split("<script").slice(1).map(part=>{const start=part.indexOf(">");const end=part.indexOf("</script>");return start>=0&&end>start?part.slice(start+1,end):"";}).filter(code=>code.trim());
test("all inline JavaScript in PWA parses",()=>{assert.ok(inline.length>=2);inline.forEach((code,i)=>new vm.Script(code,{filename:"index.html:inline-"+i}));});
test("marketplace client parses",()=>new vm.Script(client,{filename:"marketplace-client.js"}));
test("Dalilna 2.1 feature layer parses and exposes job and marketplace filters",()=>{new vm.Script(features,{filename:"features-2.1.js"});for(const token of ['id:"jobsCountryTabs"','id:"souqTransactionTabs"','id:"souqCategoryTabs"','/api/jobs/candidates'])assert.ok(features.includes(token),token);});
test("regional catalogue runtime exports safe parsers",()=>{const runtime=require("../regional-catalog-runtime");assert.equal(typeof runtime.normalizeItems,"function");assert.equal(typeof runtime.yemenPhone,"function");});
test("smart search reads static local catalogue and shared ads, not live map endpoints",()=>{
 for(const token of ["LIVE_CATALOG_BASE","loadRegionalCatalogManifest","loadRegionalCatalog(context.gov","loadLiveMarketplaceMatches","OpenStreetMap contributors"])assert.ok(html.includes(token),token);
 for(const token of ["searchLivePlaces(","/api/places/search","/api/geoapify/search"])assert.ok(!html.includes(token),token);
});
test("Android and PWA assets remain byte-for-byte aligned",()=>{
 for(const name of ["index.html","sw.js","marketplace-client.js","regional-catalog-runtime.js","features-2.1.js","features-2.1.css","jobs-feed.json"])assert.equal(fs.readFileSync("android/app/src/main/assets/"+name,"utf8"),fs.readFileSync(name,"utf8"),name+" mismatch");
});
test("marketplace form includes product and rental categories",()=>{
 for(const type of ["phone","car","motorcycle","land","property","apartment","house","honey","coffee","stationery","solar_equipment"])assert.ok(html.includes('value="'+type+'"'),type);
 assert.ok(html.includes('value="rent"'));
});
test("legacy migration keeps opening hours, websites and coordinates",()=>{
 for(const token of ['name="hours"','name="website"','id="pickListingLocation"','id="listingLocationStatus"','website:item.website'])assert.ok(html.includes(token),token);
 assert.ok(client.includes("openingHours: item.hours || item.openingHours"));
 assert.ok(client.includes("website: item.website"));
});


test("marketplace client displays rental labels",()=>{
 assert.ok(client.includes('item.listingType === "rent") labels.push("للإيجار")'));
});

test("PWA version metadata is 2.1.0",()=>{
 assert.ok(html.includes('content="2.1.0"'));
});
