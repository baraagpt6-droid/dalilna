"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const guide=require("../scripts/refresh-market-prices.cjs");
const root=path.join(__dirname,"..");
test("market reference dataset has all requested groups with dated sources and local illustrations",()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,"market_prices_yemen.json"),"utf8"));
 assert.deepEqual(data.categories.map(x=>x.id),["solar","electronics","vehicles","property"]);
 assert.ok(data.items.length>=14);
 for(const item of data.items){
  assert.ok(item.sourceUrl.startsWith("https://"),item.id);
  assert.ok(item.sourceCheckedAt,item.id);
  assert.ok(fs.existsSync(path.join(root,"market-price-images",item.image)),item.image);
  assert.ok(["solar","electronics","vehicles","property"].includes(item.category),item.category);
 }
 assert.ok(data.items.some(x=>x.pricing?.sourceZone==="sanaa"));
 assert.ok(data.items.some(x=>x.pricing?.sourceZone==="aden"));
 assert.ok(data.items.some(x=>x.category==="electronics"&&x.title.includes("لابتوبات")));
 assert.ok(data.items.some(x=>x.category==="vehicles"&&!x.pricing));
 assert.ok(data.items.some(x=>x.category==="property"&&!x.pricing));
});
test("price-page parser only returns positive integer YER values near the named item",()=>{
 const text="Samsung Galaxy A08 4G 121,675 ريال يمني Xiaomi Redmi Note 15 4G 151,267 ريال يمني";
 assert.equal(guide.parseMoneyNear(text,["Samsung Galaxy A08 4G"]),121675);
 assert.equal(guide.parseMoneyNear(text,["Xiaomi Redmi Note 15 4G"]),151267);
 assert.equal(guide.parseMoneyNear("Samsung Galaxy no price",["Samsung Galaxy"]),null);
});
test("weekly price guide does not invent missing prices",()=>{
 const text=guide.stripHtml("<h1>لوح 550W</h1><p>75,000 ﷼</p>");
 assert.equal(guide.parseProductMoney(text),75000);
 assert.equal(guide.parseProductMoney("غير متوفر"),null);
});
test("v3.0 offline assistant reads active jobs locally and returns interactive source links",()=>{
 const app=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const feed=JSON.parse(fs.readFileSync(path.join(root,"jobs-feed.json"),"utf8"));
 assert.match(app,/fetch\("\.\/jobs-feed\.json"/);
 assert.match(app,/assistantCards:cards/);
 assert.match(app,/const sourceJobs=/);
 assert.match(app,/const now=Date\.now\(\)/);
 assert.match(app,/jobs\.slice\(0,5\)/);
 assert.match(app,/assistant-job-save/);
 assert.match(app,/resolveAssistantConversationFollowup/);
 assert.ok(Array.isArray(feed.items));
 assert.ok(feed.items.length>=75,"active job feed must retain at least the expected baseline count");
 assert.equal(new Set(feed.items.map(item=>item.id||item.url||item.title)).size,feed.items.length,"job feed entries must remain unique");
 assert.ok(feed.items.some(item=>item.countryCode==="YE"));
 assert.ok(feed.items.some(item=>item.countryCode==="SA"));
});
test("Android APK build prepares matching OTA metadata before asset sync and verifies embedded code",()=>{
 const workflow=fs.readFileSync(path.join(root,".github/workflows/android-apk.yml"),"utf8");
 const prepare=workflow.indexOf("Prepare Android OTA metadata before packaging");
 const sync=workflow.indexOf("Sync PWA, OTA bridge, price guide and Yemen catalogue into Android assets");
 const build=workflow.indexOf("Build signed Release APK and AAB");
 const verify=workflow.indexOf("Verify APK version and signature");
 assert.ok(prepare>=0&&prepare<sync&&sync<build&&build<verify);
 assert.match(workflow,/const version = JSON\.parse\(fs\.readFileSync\(file, "utf8"\)\)/);
 assert.match(workflow,/versionCode = Number\(version\.androidVersionCode\)/);
 assert.match(workflow,/versionCode !== 4129901/);
 assert.match(workflow,/VERSION_CODE.*4129901/);
 assert.doesNotMatch(workflow,/DALILNA_VERSION_CODE_OFFSET|3100000/);
 assert.ok(workflow.includes('unzip -p "$APK" assets/version.json'));
 assert.ok(workflow.includes('EMBEDDED_VERSION_CODE'));
});

test("v3.0 app, PWA manifest, Android Gradle and metadata versions match",()=>{
 const app=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const version=JSON.parse(fs.readFileSync(path.join(root,"version.json"),"utf8"));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
 const gradle=fs.readFileSync(path.join(root,"android/app/build.gradle.kts"),"utf8");
 assert.match(app,/meta name="app-version" content="3.1.0"/);
 assert.match(app,/const APP_VERSION="3.1.0"/);
 assert.equal(version.version,"3.1.0");
 assert.equal(manifest.version,"3.1.0");
 assert.equal(pkg.version,"3.1.0");
 assert.match(gradle,/versionName = "3.1.0"/);
});
test("OTA worker activates immediately and removes only older Dalilna caches",()=>{
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 assert.match(sw,/self\.skipWaiting\(\)/);
 assert.match(sw,/self\.clients\.claim\(\)/);
 assert.match(sw,/key\.startsWith\(CACHE_PREFIX\)/);
 assert.match(sw,/market-price-images\/laptop\.svg/);
});

test("Android WebView package includes the same OTA and price assets as the PWA",()=>{
 const files=["index.html","app-native-bridge.js","app-update.js","market-price-guide.js","market-price-guide.css","market_prices_yemen.json","sw.js","marketplace-client.js","manifest.json","version.json","jobs-feed.json"];
 for(const file of files){
  const source=fs.readFileSync(path.join(root,file));
  const bundled=fs.readFileSync(path.join(root,"android/app/src/main/assets",file));
  assert.deepEqual(bundled,source,file+" Android asset is stale");
 }
 const guide=JSON.parse(fs.readFileSync(path.join(root,"market_prices_yemen.json"),"utf8"));
 for(const item of guide.items){
  const source=fs.readFileSync(path.join(root,"market-price-images",item.image));
  const bundled=fs.readFileSync(path.join(root,"android/app/src/main/assets/market-price-images",item.image));
  assert.deepEqual(bundled,source,item.image+" Android illustration is stale");
 }
});
