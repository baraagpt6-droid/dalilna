"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const activity=fs.readFileSync(path.join(root,"android/app/src/main/java/ye/dalilna/app/MainActivity.java"),"utf8");

test("home scroll has no AdMob slot or coordinate overlay",()=>{
 assert.doesNotMatch(html,/homeAdSlot|scheduleHomeAdPosition|updateHomeBannerPosition/);
 assert.doesNotMatch(activity,/positionHomeBanner|homeAdSlotVisible|updateHomeBannerPosition/);
});

test("standard banner is bottom-centred and limited to the details dialog",()=>{
 assert.match(activity,/adView\.setAdSize\(AdSize\.BANNER\)/);
 assert.match(activity,/Gravity\.BOTTOM \| Gravity\.CENTER_HORIZONTAL/);
 assert.match(html,/if\(d\.id==="ddlg"\)setDetailBannerVisible\(true\)/);
 assert.match(html,/if\(d\.id==="ddlg"\)setDetailBannerVisible\(false\)/);
 assert.match(html,/detailDialog\.addEventListener\("close"/);
 assert.match(html,/detailDialog\.addEventListener\("cancel"/);
 assert.match(html,/function go\(v,c\)\{[\s\S]*?setDetailBannerVisible\(false\)/);
 assert.match(activity,/detailScreenVisible \? View\.VISIBLE : View\.GONE/);
});

test("AdMob and UMP asynchronous operations are guarded",()=>{
 assert.match(activity,/catch \(RuntimeException ignored\)/);
 assert.match(activity,/catch \(RuntimeException error\)/);
 assert.match(activity,/UserMessagingPlatform\.loadAndShowConsentFormIfRequired/);
 assert.match(activity,/private void requestAdsIfAllowed\(\)[\s\S]*?!detailScreenVisible/);
 assert.match(activity,/MobileAds\.initialize/);
 assert.match(activity,/adView\.loadAd\(new AdRequest\.Builder\(\)\.build\(\)\)/);
 assert.match(activity,/adView\.pause\(\)/);
 assert.match(activity,/adView\.resume\(\)/);
 assert.match(activity,/adView\.destroy\(\)/);
 assert.ok((activity.match(/catch \(RuntimeException ignored\)/g)||[]).length>=10);
});

test("assistant tab and UMP privacy options stay available",()=>{
 assert.match(html,/<span>المساعد<\/span>/);
 assert.match(html,/id="privacyOptionsEntry"/);
 assert.match(activity,/showPrivacyOptionsForm/);
});
