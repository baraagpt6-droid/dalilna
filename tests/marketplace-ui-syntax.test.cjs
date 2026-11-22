"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),test=require("node:test");
const html=fs.readFileSync("index.html","utf8"),client=fs.readFileSync("marketplace-client.js","utf8"),features=fs.readFileSync("features-2.1.js","utf8"),quickCss=fs.readFileSync("features-2.1.css","utf8"),jobs=fs.readFileSync("scripts/refresh-jobs.cjs","utf8"),sw=fs.readFileSync("sw.js","utf8");
const workflow=fs.readFileSync(".github/workflows/refresh-regional-catalog.yml","utf8");
const inline=html.split("<script").slice(1).map(part=>{const start=part.indexOf(">");const end=part.indexOf("</script>");return start>=0&&end>start?part.slice(start+1,end):"";}).filter(code=>code.trim());
test("all inline JavaScript in PWA parses",()=>{assert.ok(inline.length>=2);inline.forEach((code,i)=>new vm.Script(code,{filename:"index.html:inline-"+i}));});
test("marketplace client parses",()=>new vm.Script(client,{filename:"marketplace-client.js"}));
test("Dalilna 2.1 feature layer parses and exposes job and marketplace filters",()=>{new vm.Script(features,{filename:"features-2.1.js"});for(const token of ['id="jobsCountryTabs"','id="souqTransactionTabs"','id="souqCategoryTabs"','/api/jobs/candidates'])assert.ok(features.includes(token),token);});
test("regional catalogue runtime exports safe parsers",()=>{const runtime=require("../regional-catalog-runtime");assert.equal(typeof runtime.normalizeItems,"function");assert.equal(typeof runtime.yemenPhone,"function");});
test("smart search uses the local catalogue first and Nominatim as its live fallback",()=>{
 for(const token of ["LIVE_CATALOG_BASE","loadRegionalCatalogManifest","loadRegionalCatalog(context.gov","loadLiveMarketplaceMatches","OpenStreetMap contributors"])assert.ok(html.includes(token),token);
 assert.ok(!html.includes("searchLivePlaces("));
 assert.ok(html.includes("searchLiveDirectoryFallback"));
 assert.ok(html.includes("/api/places/search"));
 assert.ok(!html.includes("/api/geoapify/search"));
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

test("home shared directory panel no longer repeats search controls",()=>{
 assert.ok(html.includes('id="sharedDirectoryPanel"'));
 assert.ok(!html.includes('id="sharedDirectoryQuery"'));
 assert.ok(!html.includes('id="sharedDirectoryCategory"'));
 assert.ok(html.includes('id="sharedMigrateLocalButton"'));
});
test("add listing district is a governorate-dependent picker",()=>{
 assert.ok(html.includes('id="fdistBtn"'));
 assert.ok(html.includes('name="dist" id="fdist"'));
 assert.ok(html.includes('YEMEN_DISTRICTS[gov]'));
});
test("souq category pills replace the duplicate product-type selector",()=>{
 assert.ok(html.includes('id="souqCategoryTabs"')||features.includes('id="souqCategoryTabs"'));
 assert.ok(!html.includes('id="sharedSouqType"'));
 assert.ok(client.includes('productGroup: selectedGroup'));
});
test("job cards only render apply buttons from approved official provider hosts",()=>{
 assert.ok(features.includes('officialApplicationUrl(job.applicationUrl)'));
 assert.ok(features.includes('dalilna-job-favs-v1'));
 assert.ok(features.includes('navigator.share'));
 assert.ok(jobs.includes('function isOfficialApplicationUrl'));
});

test("PWA version metadata and asset cache tags are 2.6.0",()=>{
 assert.ok(html.includes('content="2.6.0"'));
 assert.ok(html.includes('features-2.1.css?v=2.6.0'));
 assert.ok(html.includes('features-2.1.js?v=2.6.0'));
 assert.ok(sw.includes('CACHE_PREFIX + "v2.6.0"'));
});
test("main directory search loads all 22 governorate files without requiring a selected governorate",()=>{
 assert.ok(html.includes("async function loadAllRegionalCatalog(force)"));
 assert.ok(html.includes("regionalCatalogMatches(loaded.items,context,query,category,productType)"));
 assert.ok(html.includes("جارٍ تحميل سجلات المحافظات الـ22 في الخلفية"));
 assert.ok(html.includes("normalizeSearchPlace"));
});
test("Souq renders only shared PostgreSQL product listings and excludes map restaurants and local ratings",()=>{
 assert.ok(!html.includes('id="souqStoresPanel"'));
 assert.ok(!html.includes("runSouqStores"));
 assert.ok(!html.includes('id="sqList"'));
 assert.ok(!html.includes("Restaurant directory"));
 assert.ok(html.includes('id="sharedSouqPanel"'));
 assert.ok(features.includes("souqCategoryTabs"));
 assert.equal((html.match(/function regionalCatalogCardHTML/g)||[]).length,1);
});
test("Souq exposes exactly seven product groups",()=>{
 const groups=features.slice(features.indexOf("const GROUPS=["),features.indexOf("let country="));
 for(const label of ["جوالات وإلكترونيات","سيارات ودراجات وقطع غيار","عقارات وأراضٍ","طاقة شمسية وبطاريات","أثاث وأجهزة منزلية","مواشي وزراعة ومعدات","ملابس وعطور ومستلزمات"])assert.ok(groups.includes(label),label);
 assert.ok(!groups.includes('["tools"'));
 assert.ok(!groups.includes('["other"'));
});
test("Souq's optional product image input does not show the browser-native Choose file control",()=>{
 assert.ok(html.includes('id="imgChooseBtn"'));
 assert.ok(html.includes('id="imgInput" accept="image/*" hidden'));
 assert.ok(!html.includes('صورة المحل أو المنتج (اختيارية)'));
});
test("Global directory matcher uses normalized whitespace tokens and has no orphaned legacy matcher",()=>{
 assert.ok(html.includes('split(/\\s+/).filter(Boolean)'));
 assert.ok(!html.includes('watches:["ساعة","ساعات","ساعاتي"]'));
 assert.equal((html.match(/function regionalCatalogCardHTML/g)||[]).length,1);
});
test("exchange rates use fresh public quotes and do not display saved device prices",()=>{
 assert.ok(html.includes('https://ye-rial.com/api/v1/current/'));
 assert.ok(html.includes("last_verified_at"));
 assert.ok(html.includes("24*60*60*1000"));
 assert.ok(html.includes("liveFxData?.fresh"));
 assert.ok(!html.includes("S.fx.s.usdB"));
 assert.ok(!html.includes("S.fx.a.usdB"));
});
test("Android 2.6.0 updates app version and clears only the WebView HTTP cache",()=>{
 const gradle=fs.readFileSync("android/app/build.gradle.kts","utf8");
 const activity=fs.readFileSync("android/app/src/main/java/ye/dalilna/app/MainActivity.java","utf8");
 assert.ok(gradle.includes("versionCode = 260"));
 assert.ok(gradle.includes('versionName = "2.6.0"'));
 assert.ok(activity.includes("webView.clearCache(true)"));
 assert.ok(activity.includes("installed_version_code"));
 assert.ok(activity.includes("Keep DOM storage/localStorage intact"));
});


test("category mapping includes English OSM tags for health and delivery",()=>{
 const mapping=JSON.parse(fs.readFileSync(path.join(__dirname,"../category-mapping.json"),"utf8"));
 for(const key of ["grocery","health","pharmacy","edu","money","delivery","solar","vehicles","real_estate"])assert.ok(mapping.categories[key],key);
 const tags=JSON.stringify(mapping);
 for(const token of ['"hospital"','"clinic"','"doctors"','"courier"','"delivery"','"parcel"'])assert.ok(tags.includes(token),token);
});
test("catalogue category filters use multi-category memberships and searchable English tags",()=>{
 assert.ok(html.includes("item.categories"));
 assert.ok(html.includes("item.searchText"));
 assert.ok(html.includes("item.nameEn"));
 assert.ok(html.includes("item.governorateEn"));
 assert.ok(html.includes("item.districtEn"));
 assert.ok(html.includes('requestedCategory&&requestedCategory!=="all"'));
});
test("Souq displays shared product listings only and has no OSM restaurant directory",()=>{
 assert.ok(!html.includes('id="souqStoresPanel"'));
 assert.ok(!html.includes("runSouqStores"));
 assert.ok(!html.includes('id="sqList"'));
 assert.ok(!html.includes('id="souqStoreCategory"'));
 assert.ok(html.includes('id="sharedSouqPanel"'));
 assert.ok(features.includes("souqCategoryTabs"));
});
test("Souq renders shared product cards with seller, WhatsApp and share actions",()=>{
 assert.ok(client.includes('category: "marketplace"'));
 assert.ok(client.includes('item.sellerName'));
 assert.ok(client.includes("wa.me/"));
 assert.ok(client.includes("share.dataset.shareId"));
});
test("six-hour catalogue workflow imports OSM, Overture and Yemen country/admin polygons",()=>{
 assert.ok(workflow.includes('cron: "0 */6 * * *"'));
 assert.ok(workflow.includes("YEM/ADM2") && workflow.includes("YEM/ADM0"));
 assert.ok(workflow.includes("geoBoundaries") && workflow.includes("overturemaps download") && workflow.includes("fuse_regional_catalog.py"));
});

test("merchant feed SQL maps latitude, longitude and source metadata to distinct parameters",()=>{
 const api=fs.readFileSync(path.join(__dirname,"../marketplace-api.js"),"utf8");
 const feed=api.slice(api.indexOf("async function syncMerchantFeed"),api.indexOf("async function handleMarketplaceRequest"));
 assert.ok(feed.includes("$18,$19,NULL,'approved',NOW(),$20"));
 assert.ok(feed.includes("item.latitude,item.longitude"));
 assert.ok(feed.includes("ON CONFLICT(client_ref) DO UPDATE"));
 assert.ok(feed.includes("completeSnapshot&&skipped===0"));
});
test("Android 2.6.0 cache and version metadata remain synchronized",()=>{
 assert.ok(sw.includes('CACHE_PREFIX + "v2.6.0"'));
 assert.ok(html.includes('content="2.6.0"'));
 const gradle=fs.readFileSync("android/app/build.gradle.kts","utf8");
 assert.ok(gradle.includes("versionCode = 240"));
 assert.ok(gradle.includes('versionName = "2.6.0"'));
});

test("daily sync workflow checks jobs, marketplace, exchange and configured merchant feeds",()=>{
 const daily=fs.readFileSync(path.join(__dirname,"../scripts/daily-sync.cjs"),"utf8");
 const workflow=fs.readFileSync(path.join(__dirname,"../.github/workflows/daily-sync.yml"),"utf8");
 assert.ok(daily.includes("checkServices()"));
 assert.ok(daily.includes("checkExchange()"));
 assert.ok(daily.includes("syncConfiguredFeeds"));
 assert.ok(daily.includes("country=YE"));
 assert.ok(workflow.includes("DALILNA_PRODUCT_FEED_URLS"));
 assert.ok(workflow.includes("DALILNA_PRODUCT_SYNC_TOKEN"));
});
test("empty merchant snapshots never archive existing feed listings",()=>{
 const feed=fs.readFileSync(path.join(__dirname,"../scripts/refresh-marketplace-products.cjs"),"utf8");
 const api=fs.readFileSync(path.join(__dirname,"../marketplace-api.js"),"utf8");
 assert.ok(feed.includes("items.length>0&&items.length<=MAX_BATCH"));
 assert.ok(api.includes("items.length===0"));
 assert.ok(api.includes("activeRefs.length===activeClientRefs.length"));
});
test("quick-jump fallback prevents intrinsic SVGs from rendering as giant black shapes",()=>{
 const start=html.indexOf('<nav class="quick-jump-bar"'),end=html.indexOf('</nav>',start);
 const bar=html.slice(start,end);
 assert.equal((bar.match(/<svg width="18" height="18"/g)||[]).length,3);
 assert.ok(html.includes(".quick-jump-bar{display:grid!important"));
 assert.ok(html.includes(".quick-jump-icon svg{display:block!important;width:18px!important;height:18px!important"));
 assert.ok(html.includes('.quick-jump-btn{display:flex;min-width:0;min-height:48px;align-items:center;justify-content:center;gap:6px;padding:6px 5px;border:1px solid var(--line);border-radius:13px;background:var(--card);color:var(--ink);font:600 11.5px \'Readex Pro\',Tahoma,sans-serif;text-decoration:none;white-space:normal;text-align:center;overflow:hidden}'));
});
test("regional catalogue manifest loads at first visit and does not show a local-only count as the national total",()=>{
 assert.ok(html.includes('loadRegionalCatalogManifest(false).then(()=>warmUnifiedSearchIndex(false))'));
 assert.ok(html.includes('جارٍ تجهيز فهرس البحث الموحد'));
 assert.ok(html.includes('manifest.json?v=2.6.0'));
 assert.ok(html.includes('cache:"no-store"'));
 assert.ok(html.includes('districtCounts.length!==335'));
});
test("service worker refreshes regional data and critical CSS/JS from the network",()=>{
 assert.ok(sw.includes('CACHE_PREFIX + "v2.6.0"'));
 assert.ok(sw.includes('url.pathname.includes("/regional-catalog/")'));
 assert.ok(sw.includes('fetch(request, { cache: "no-store" })'));
 assert.ok(sw.includes('features-2.1.css?v=2.6.0'));
});

test("home results stay mounted in a stable slot and can move to the top search panel",()=>{for(const token of ['id="homeListSlot"','id="latestT"','id="list"','id="searchResultsTop"','id="searchResultList"','id="clearSearch"'])assert.ok(html.includes(token),token);});

test("home quick jump bar points to existing exchange, calculator and emergency cards",()=>{
 for(const token of ['id="quickJumpBar"','data-quick-jump="fxBox"','data-quick-jump="fxCalcBox"','data-quick-jump="emBox"','id="fxCalcBox"'])assert.ok(html.includes(token),token);
 assert.ok(features.includes('scrollIntoView({behavior:"smooth",block:"start"})'));
 assert.ok(features.includes('quick-jump-highlight'));
});
test("emergency contacts remain direct tel links and include a return-to-search control",()=>{
 assert.ok(html.includes('href="tel:'));
 assert.ok(html.includes('id="emBackToTop"'));
 assert.ok(features.includes('event.target.closest("#emBackToTop")'));
});

test("search icon is a working submit button and Enter reveals results",()=>{
 assert.ok(html.includes('id="searchSubmit"'));
 assert.ok(inline.join("\n").includes('$("#searchSubmit").addEventListener("click",renderSearchAndRevealResults)'));
 assert.ok(html.includes('event.key==="Enter"'));
 assert.ok(html.includes('searchRenderTimer=window.setTimeout'));
});
test("emergency card stays visible until search is cleared or back-to-search is pressed",()=>{
 assert.ok(features.includes('if(id==="emBox")document.body.classList.add("quick-jump-reveal-emergency")'));
 assert.ok(!features.includes('classList.remove("quick-jump-reveal-emergency"),1600'));
 assert.ok(features.includes('if(!active)document.body.classList.remove("quick-jump-reveal-emergency")'));
 assert.ok(features.includes('scrollIntoView({behavior:"smooth",block:"start"})'));
});

test("search state observer cannot recursively observe its own hidden updates",()=>{
 const sync=features.slice(features.indexOf("function syncSearch"),features.indexOf("function scrollToQuickTarget"));
 assert.ok(sync.includes("clear.hidden!==shouldHide"));
 assert.ok(features.includes('attributeFilter:["aria-pressed"]'));
 assert.ok(!features.includes('attributeFilter:["aria-pressed","hidden"]'));
});
test("regional catalogue requests are cancelled before a newer search starts",()=>{
 assert.ok(html.includes("liveDirectoryController.abort()"));
 assert.ok(html.includes("controller.signal.aborted"));
 assert.ok(html.includes("},45);"));
});

test("Dalilna quick jump buttons use SVG icons and native anchor targets",()=>{
 assert.ok(html.includes('href="#fxBox"'));
 assert.ok(html.includes('href="#fxCalcBox"'));
 assert.ok(html.includes('href="#emBox"'));
 assert.ok(html.includes('class="quick-jump-icon"'));
 assert.ok(!html.includes('>💱 الصرف والذهب'));
 assert.ok(!html.includes('>🧮 حاسبة التحويل'));
 assert.ok(!html.includes('>🚨 أرقام الطوارئ'));
 assert.ok(features.includes('scrollIntoView({behavior:"smooth",block:"start"})'));
});

test("quick-jump labels wrap inside their own cards on narrow screens",()=>{
 assert.ok(quickCss.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
 assert.ok(quickCss.includes(".quick-jump-btn > span:last-child"));
 assert.ok(quickCss.includes("white-space:normal"));
 assert.ok(quickCss.includes("overflow-wrap:break-word"));
 assert.ok(quickCss.includes("@media(max-width:380px)"));
 assert.ok(quickCss.includes("min-height:56px"));
});

test("approved listing cards use compact empty-image fallbacks",()=>{
 assert.ok(html.includes('shared-listing-image-fallback no-image'));
 assert.ok(client.includes('shared-listing-image-fallback no-image'));
 assert.ok(features.includes('image.replaceWith(fallback)'));
});
test("currency, gold and emergency areas use matching vector icons",()=>{
 assert.ok(html.includes('class="fx-asset-icon '));
 assert.ok(html.includes('class="emergency-heading"'));
 assert.ok(html.includes('emergency-number-link'));
});
