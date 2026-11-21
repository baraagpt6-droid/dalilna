"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
test("primary places directory loads the static regional catalogue, not live map searches",()=>{
 for(const token of ['const LIVE_CATALOG_BASE="./regional-catalog/";',"async function loadRegionalCatalogManifest","async function loadRegionalCatalog","async function runLiveDirectorySearch","regionalCatalogMatches"])assert.ok(html.includes(token),token);
 for(const token of ["searchLivePlaces(","/api/places/search","/api/geoapify/search"])assert.ok(!html.includes(token),token);
});
test("the country catalogue exposes governorate choices and counts",()=>{
 for(const token of ["function liveDirectoryLocationPrompt(manifest)","manifest&&manifest.governorates","data-region-gov=","فهرس اليمن المحلي"])assert.ok(html.includes(token),token);
 assert.ok(html.includes('const directoryGov=event.target.closest("#liveDirectoryItems [data-region-gov]")'));
});
test("the local directory retains attribution and explains incomplete coverage",()=>{
 for(const token of ["OpenStreetMap contributors","Open Admin Data","هذا لا يعني أن المكان غير موجود","تقدير تقريبي من أقرب مركز إداري"])assert.ok(html.includes(token),token);
});
test("regional profiles open local directory category shortcuts",()=>{
 for(const token of ["data-region-category=","تصفح المحلات والخدمات في هذه المنطقة","مكاتب عقارية","ساعات","جوالات واتصالات","طاقة شمسية","حرف وصيانة"])assert.ok(html.includes(token),token);
 assert.ok(!html.includes("google.com/maps/search"));
 assert.ok(!html.includes("regionMapSearch("));
});
test("AI business lookup uses local regional data and approved shared adverts",()=>{
 for(const token of ["loadRegionalCatalog(context.gov","loadLiveMarketplaceMatches","فهرس OpenStreetMap المحلي","إعلانات أضافها المستخدمون واعتمدتها إدارة دليلنا"])assert.ok(html.includes(token),token);
 assert.ok(!html.includes("searchLivePlaces("));
});
test("jobs, products and property adverts remain in the shared marketplace",()=>{
 for(const token of ["/api/marketplace/listings","إعلانات معتمدة","أرض","شقة","منزل","للإيجار"])assert.ok(html.includes(token),token);
});
test("individual place cards use optional map and source links from catalogue data",()=>{
 for(const token of ["record.mapsUrl","record.sourceUrl","data-map-toggle","عرض الخريطة","OpenStreetMap"])assert.ok(html.includes(token),token);
});
test("photos and ratings remain device-local",()=>{
 for(const token of ["data-live-rate-id","data-live-photo-input","تقييم المستخدمين على هذا الجهاز","صورة محفوظة"])assert.ok(html.includes(token),token);
});


test("region category shortcuts apply the selected category inside the regional directory",()=>{
 assert.ok(html.includes('liveDirectoryCategoryOverride=category.dataset.regionCategory||"all"'));
 assert.ok(html.includes('liveDirectoryListingTypeOverride=category.dataset.regionListingType||""'));
 assert.ok(html.includes('data-region-listing-type='));
 assert.ok(html.includes('params.set("listingType",listingType)'));
});
test("approved market ads map directory sections to their product types",()=>{
 for(const token of ['vehicles:["car","motorcycle","vehicle_parts","construction_equipment"]','real_estate:["land","property","apartment","house"]','categoryProductTypes.includes(item.productType)',"للإيجار"])assert.ok(html.includes(token),token);
});

test("local-service categories do not fetch unrelated marketplace ads",()=>{
 assert.ok(html.includes('marketplaceCategories=["all","jobs","souq","land","marketplace"]'));
 assert.ok(html.includes('if(!productType&&!categoryProductTypes&&!marketplaceCategories.includes(category))'));
 assert.ok(html.includes('context.type==="subdistrict"'));
});
