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
test("standard banner is bottom-centered and limited to the details dialog",()=>{
 assert.match(activity,/adView\.setAdSize\(AdSize\.BANNER\)/);
 assert.match(activity,/Gravity\.BOTTOM \| Gravity\.CENTER_HORIZONTAL/);
 assert.match(html,/if\(d\.id==="ddlg"\)setDetailBannerVisible\(true\)/);
 assert.match(html,/if\(d\.id==="ddlg"\)setDetailBannerVisible\(false\)/);
 assert.match(html,/if\(d\.id==="ddlg"\)setDetailBannerVisible\(false\);/);
 assert.match(activity,/detailScreenVisible \? View\.VISIBLE : View\.GONE/);
});
test("AdMob load and lifecycle calls are protected from runtime failures",()=>{
 for(const call of ["MobileAds.initialize","adView.loadAd","adView.pause","adView.resume","adView.destroy"])
  assert.ok(activity.includes(call),call+" exists");
 assert.ok((activity.match(/catch \(RuntimeException ignored\)/g)||[]).length>=8);
});
