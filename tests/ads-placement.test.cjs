"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const activity = fs.readFileSync(
  path.join(root, "android/app/src/main/java/ye/dalilna/app/MainActivity.java"),
  "utf8"
);

test("AdMob banner is a standard 320x50 banner anchored to the end of home content", () => {
  const homeStart = html.indexOf('<section id="vHome">');
  const adSlot = html.indexOf('id="homeAdSlot"');
  const categoryView = html.indexOf("<!-- Category View -->");
  assert.ok(homeStart >= 0 && adSlot > homeStart && adSlot < categoryView,
    "the ad slot must be inside the home view and before other tabs");
  assert.match(html, /nativeBridge\.updateHomeBannerPosition\(rect\.left,rect\.top,rect\.width,rect\.height,visible\)/);
  assert.match(html, /rect\.top>=0&&rect\.bottom<=window\.innerHeight/);
  assert.match(activity, /adView\.setAdSize\(AdSize\.BANNER\)/);
  assert.match(activity, /dp\(320\), dp\(50\)/);
  assert.doesNotMatch(activity, /adsFooter|getLargeAnchoredAdaptiveBannerAdSize/);
});

test("floating assistant shortcut is removed and assistant remains in bottom navigation", () => {
  assert.doesNotMatch(html, /aiFab|ai-fab/);
  assert.match(html, /<span>المساعد<\/span>/);
  assert.match(html, /data-go="fb"/);
});

test("UMP privacy options remain accessible without a fixed ad footer", () => {
  assert.match(html, /id="privacyOptionsEntry"/);
  assert.match(activity, /showPrivacyOptionsForm/);
  assert.match(activity, /getPrivacyOptionsRequirementStatus/);
  assert.doesNotMatch(activity, /adsFooter|privacyOptionsButton/);
});
