"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8");
test("primary places directory loads the static regional catalogue, not live map searches",()=>{
 for(const token of ["LIVE_CATALOG_LOCAL_BASE","LIVE_CATALOG_REMOTE_BASE","async function fetchCatalogAsset","async function loadRegionalCatalogManifest","async function loadRegionalCatalog","async function runLiveDirectorySearch","regionalCatalogMatches","warmUnifiedSearchIndex","searchLiveDirectoryFallback","/api/places/search"])assert.ok(html.includes(token),token);
 assert.ok(!html.includes("searchLivePlaces("));
});
test("the country catalogue exposes governorate choices and counts",()=>{
 for(const token of ["function liveDirectoryLocationPrompt(manifest)","manifest&&manifest.governorates","data-region-gov=","فهرس اليمن المحلي"])assert.ok(html.includes(token),token);
 assert.ok(html.includes('const directoryGov=event.target.closest("#liveDirectoryItems [data-region-gov]")'));
});
test("the local directory retains attribution and explains incomplete coverage",()=>{
 for(const token of ["OpenStreetMap contributors","Open Admin Data","هذا لا يعني أن المكان غير موجود","توزيع المديرية تقديري من أقرب مركز إداري"])assert.ok(html.includes(token),token);
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
test("all-tab search uses the preloaded Yemen index and live OSM fallback",()=>{
 for(const token of ["const showTopSearch=searchActive",'if(view!=="home")go("home")',"warmUnifiedSearchIndex(false)","searchLiveDirectoryFallback","rows.length<5"])assert.ok(html.includes(token),token);
 assert.ok(!html.includes('id="catFilterQ"'));
});


test("place cards omit local ratings, image search and file upload controls",()=>{
 const start=html.indexOf("function liveDirectoryCardHTML(item){");
 const end=html.indexOf("\nfunction geoapifyDirectoryCardHTML(item){",start);
 assert.ok(start>=0&&end>start);
 const card=html.slice(start,end);
 for(const forbidden of ["تقييم المستخدمين على هذا الجهاز","data-live-rate-id","data-commons-photos","البحث عن صور مرخصة","type=\"file\"","Choose file"])assert.ok(!card.includes(forbidden),forbidden);
 for(const required of ["اتصال","واتساب","الخريطة","record.address","record.openingHours"])assert.ok(card.includes(required),required);
});
test("seven product-group filters are visible and connected to the shared marketplace API",()=>{
 const groups=["electronics","vehicles","property","solar","home","agriculture","clothing"];
 for(const group of groups)assert.ok(html.includes('data-group="'+group+'"'),group);
 const client=fs.readFileSync("marketplace-client.js","utf8");
 assert.ok(client.includes("productGroup: selectedGroup"));
 assert.ok(client.includes('souqTabs.addEventListener("click"'));
 assert.ok(!client.includes("Restaurant"));
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
 assert.ok(html.includes('ctx.type==="subdistrict"'));
});
