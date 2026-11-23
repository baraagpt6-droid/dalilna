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
 assert.ok(html.includes("assistantWhatsAppShareUrl"));
 assert.ok(!html.includes("regionMapSearch("));
});
test("AI business lookup uses local data, hybrid map search and shared adverts",()=>{
 for(const token of [
  "loadRegionalCatalog(selectedContext.gov",
  "loadLiveMarketplaceMatches",
  "searchLiveDirectoryFallback",
  "assistantCards:cards.slice(0,10)",
  "approvedListings:approved.slice(0,8)",
  'approvalStatus:"approved_by_dalilna_admin"',
  'fieldVerificationStatus:"phone_and_address_not_field_verified"'
 ])assert.ok(html.includes(token),token);
 assert.ok(!html.includes("searchLivePlaces("));
 assert.ok(html.includes("function renderAssistantResult(container,result)"));
});
test("manual refresh buttons are absent and Souq is not a home directory category",()=>{
 for(const id of ["liveDirectoryRefresh","liveDirectoryRetry","sharedDirectoryRefresh","sharedJobsRefresh","sharedSouqRefresh"])
  assert.ok(!html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('CATS.filter(([key])=>!["souq","parts"].includes(key))'));
});
test("profile settings, logout and local-auth limitations are present",()=>{
 for(const token of ['id="profilePanel"','id="profileDefaultGovernorate"','id="profileLanguageBtn"','id="profileThemeBtn"','id="profileNotificationsBtn"','id="profileLogoutBtn"','defaultGovernorate','notificationsEnabled','function renderProfilePanel()'])
  assert.ok(html.includes(token),token);
 assert.ok(html.includes("لا يستخدم دليلنا حالياً نظام مصادقة مركزي"));
});
test("static English labels and bilingual regional search are wired",()=>{
 for(const token of ["const STATIC_UI_EN=","function applyStaticBilingualLabels()","document.documentElement.dir=curLang===","const GOVS_EN=","function governorateLabel(name)","Search Yemen's shops and services"])
  assert.ok(html.includes(token),token);
});
test("assistant cards expose call, WhatsApp contact, map and share links",()=>{
 assert.ok(html.includes("function renderAssistantResult(container,result)"));
 assert.ok(html.includes('call.href="tel:"'));
 assert.ok(html.includes("https://www.openstreetmap.org/search?query="));
 assert.ok(html.includes("assistantWhatsAppShareUrl"));
 assert.ok(html.includes("https://www.google.com/maps/search/?api=1&query="));
 assert.ok(html.includes("مشاركة واتساب"));
});
test("jobs, products and property adverts remain in the shared marketplace",()=>{
 for(const token of ["/api/marketplace/listings","إعلانات معتمدة","أرض","شقة","منزل","للإيجار"])assert.ok(html.includes(token),token);
});
test("individual place cards use optional map and source links from catalogue data",()=>{
 for(const token of ["record.mapsUrl","data-map-toggle","View map","OpenStreetMap"])assert.ok(html.includes(token),token);
});
test("all-tab search shows local matches and progressively loads governorate catalogues beside OSM",()=>{
 for(const token of ["const showTopSearch=searchActive",'if(view!=="home")go("home")',"searchRegionalCatalogProgressive","searchLiveDirectoryFallback","query.length>=2","openLiveCatalogDB","readRegionalCatalogCache","writeRegionalCatalogCache"])
  assert.ok(html.includes(token),token);
 assert.ok(!html.includes('id="catFilterQ"'));
 assert.ok(!html.includes("async function loadAllRegionalCatalog"));
 assert.ok(!html.includes('loadRegionalCatalogManifest(false).then(()=>warmUnifiedSearchIndex(false))'));
});


test("place cards omit local ratings, image search and file upload controls",()=>{
 const start=html.indexOf("function liveDirectoryCardHTML(item){");
 const end=html.indexOf("\nfunction geoapifyDirectoryCardHTML(item){",start);
 assert.ok(start>=0&&end>start);
 const card=html.slice(start,end);
 for(const forbidden of ["تقييم المستخدمين على هذا الجهاز","data-live-rate-id","data-commons-photos","البحث عن صور مرخصة","type=\"file\"","Choose file"])assert.ok(!card.includes(forbidden),forbidden);
 for(const required of ["Call","WhatsApp","View map","record.address","record.openingHours"])assert.ok(card.includes(required),required);
});
test("seven product-group filters are visible and connected to the shared marketplace API",()=>{
 const groups=["electronics","vehicles","property","solar","home","agriculture","clothing"];
 for(const group of groups)assert.ok(html.includes('data-group="'+group+'"'),group);
 const client=fs.readFileSync("marketplace-client.js","utf8");
 assert.ok(client.includes("productGroup: selectedGroup"));
 assert.ok(client.includes('souqTabs.addEventListener("click"'));
 assert.ok(!client.includes("Restaurant directory"));
 assert.ok(!client.includes("runSouqStores"));
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

test("hybrid search presents a single results surface when the live directory is active",()=>{
 assert.ok(html.includes("const unifiedResultsVisible=liveWanted&&searchActive"));
 assert.ok(html.includes('$("#latestT").hidden=unifiedResultsVisible'));
 assert.ok(html.includes('$("#list").hidden=unifiedResultsVisible'));
 assert.ok(html.includes('$("#more").hidden=unifiedResultsVisible||res.length<=homeLim'));
});
test("profile lists this device's adverts, shops and saved places without implying central authentication",()=>{
 for(const token of ['id="profileActivityList"','data-profile-item-id=','My marketplace adverts','Shops I added','Saved directory places'])assert.ok(html.includes(token),token);
 assert.ok(html.includes("لا يمثل حساباً مركزياً موثقاً"));
});
test("language changes reach generated jobs and shared marketplace controls",()=>{
 assert.ok(html.includes("window.DALILNA_LANGUAGE=curLang"));
 assert.ok(html.includes("dalilna:languagechange"));
 assert.ok(fs.readFileSync("features-2.1.js","utf8").includes('window.addEventListener("dalilna:languagechange"'));
 assert.ok(fs.readFileSync("marketplace-client.js","utf8").includes('window.addEventListener("dalilna:languagechange"'));
});
test("job seeker refresh button is removed from the UI and event bindings",()=>{
 assert.ok(!fs.readFileSync("features-2.1.js","utf8").includes('id="refreshJobSeekers"'));
 assert.ok(!fs.readFileSync("features-2.1.js","utf8").includes('refreshJobSeekers")?.addEventListener'));
});

test("background sync does not clear lists or show loading labels",()=>{
 const features=fs.readFileSync("features-2.1.js","utf8");
 const marketplace=fs.readFileSync("marketplace-client.js","utf8");
 assert.ok(features.includes('status.textContent="";'));
 assert.ok(features.includes("box.replaceChildren(fragment)"));
 assert.ok(features.includes("if(!box.childElementCount)"));
 assert.ok(marketplace.includes('const hadLoadedData = list.dataset.loaded === "true";'));
 assert.ok(marketplace.includes("if (!hadLoadedData) status.textContent"));
 assert.ok(marketplace.includes("6*60*60*1000"));
});

test("offline AI assistant uses English answers when English is selected",()=>{
 assert.ok(html.includes("function answerAIArabic(q)"));
 assert.ok(html.includes("function answerAIEnglish(q)"));
 assert.ok(html.includes('return curLang==="en"?answerAIEnglish(q):answerAIArabic(q)'));
 assert.ok(html.includes("No jobs are currently recorded on this device."));
 assert.ok(html.includes("Nearest matching records with saved coordinates"));
 assert.ok(html.includes("Please answer in English."));
});

test("English live-assistant cards and result summaries use English category names",()=>{
 assert.ok(html.includes('const assistantServiceLabel=curLang==="en"?(serviceNames[serviceIntent.category]'));
 assert.ok(html.includes('category:curLang==="en"?assistantServiceLabel'));
 assert.ok(html.includes('"I found "+count+" matching "+assistantServiceLabel'));
});

test("progressive directory search keeps the first fifty matches appear with 30-card pagination",()=>{
 assert.ok(html.includes("liveDirectoryVisibleCount=50"));
 assert.ok(html.includes("liveDirectoryVisibleCount+=30"));
 assert.ok(html.includes("batchSize=2"));
 assert.ok(html.includes("maxMatches=500"));
 assert.ok(html.includes("data?.pending&&!items.length"));
 assert.ok(!html.includes('id="fxRefresh"'));
 assert.ok(!html.includes("تحديث الأسعار"));
});

test("manual price refresh is removed while automatic rate polling remains",()=>{
 assert.ok(!html.includes('id="fxRefresh"'));
 assert.ok(!html.includes('$("#fxRefresh")?.addEventListener'));
 assert.ok(html.includes('setInterval(()=>{if(!document.hidden)loadLiveFx(false);},60000)'));
});

test("full-Yemen light index loads at startup and drives local directory search",()=>{
 for(const token of ["search_index_light.json?v=3.0.1","async function ensureLightSearchIndex()","function searchLightIndex(index,query,context,category,productType)","void ensureLightSearchIndex()","mode:\"full-yemen-light\""])assert.ok(html.includes(token),token);
 assert.ok(html.includes("searchRegionalCatalogProgressive"));
 assert.ok(html.includes("responseData.suggestions=result.suggestions"));
 assert.ok(html.includes("data-search-suggestion"));
});
test("directory cards use compact source badges and WhatsApp share links",()=>{
 assert.ok(html.includes("verification-badge verified"));
 assert.ok(html.includes("دليل مفتوح"));
 assert.ok(html.includes("https://wa.me/?text="));
 assert.ok(!html.includes("لم يتم التحقق منها ميدانياً من فريق دليلنا"));
 assert.ok(!html.includes("Open-map records are not field-verified by Dalilna"));
});
test("assistant renders local results before cloud follow-up and shows typing state",()=>{
 assert.ok(html.includes("async function askAssistant(q,onImmediate)"));
 assert.ok(html.includes('pending.textContent=curLang==="en"?"Typing…":"يكتب الآن..."'));
 assert.ok(html.includes("fastResult=>"));
 assert.ok(html.includes("cleanAssistantAnswer(data.answer)"));
});
