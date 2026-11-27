"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");

test("the unified profile has distinct customerName and storeName fields", () => {
  assert.match(html, /profile:\{customerName:"",storeName:"",phone:"",activeRole:"customer"\}/);
  assert.match(html, /activeRole:profileRaw\.activeRole==="merchant"/);
  assert.match(html, /customerName:cleanText\(profileRaw\.customerName\|\|legacyCustomer\.customerName\|\|legacyCustomer\.name/);
  assert.match(html, /storeName:cleanText\(profileRaw\.storeName\|\|legacyMerchant\.storeName\|\|legacyMerchant\.name/);
  assert.match(html, /phone:cleanText\(profileRaw\.phone\|\|legacyCustomer\.phone\|\|legacyMerchant\.phone/);
  assert.match(html, /localStorage\.removeItem\("dalilna-v3-customer-profile"\)/);
  assert.match(html, /if\(adminCredentialMigrationRequired\|\|legacyProfileMigrationRequired\)saveState\(\)/);
});

test("active role determines the profile heading and merchant tools visibility", () => {
  assert.match(html, /const merchant=profile\.activeRole==="merchant"/);
  assert.match(html, /merchant\?\(profile\.storeName/);
  assert.match(html, /S\.session=profile\.activeRole==="merchant"/);
  assert.match(html, /const active=S\.session\.role==="merchant"&&profile\.activeRole==="merchant"&&!!profile\.storeName&&!!profile\.phone/);
  assert.match(html, /openProfileEditor\(\{merchantSetup:true\}\)/);
});

test("first customer-to-merchant activation edits storeName without exposing the existing customer name or phone fields", () => {
  assert.match(html, /const hasCustomer=!!\(profile\.customerName&&profile\.phone\)/);
  assert.match(html, /\$\("#profileCustomerNameRow"\)\.hidden=mode==="merchant-setup"&&hasCustomer/);
  assert.match(html, /\$\("#profilePhoneRow"\)\.hidden=mode==="merchant-setup"&&!!profile\.phone/);
  assert.match(html, /\$\("#profileStoreNameRow"\)\.hidden=mode==="initial"&&profile\.activeRole!=="merchant"/);
  assert.match(html, /const customerName=\$\("#profileCustomerNameRow"\)\.hidden\?current\.customerName/);
  assert.match(html, /const storeName=\$\("#profileStoreNameRow"\)\.hidden\?current\.storeName/);
  assert.match(html, /const phone=\$\("#profilePhoneRow"\)\.hidden\?current\.phone/);
});

test("account card has one role switcher and a deliberate profile editor, with no duplicate role forms", () => {
  const dialog = html.match(/<dialog id="accountDlg">([\s\S]*?)<\/dialog>/)?.[1] || "";
  assert.ok(dialog.includes('id="v3RoleSwitcher"'));
  assert.ok(dialog.includes('data-profile-role="customer"'));
  assert.ok(dialog.includes('data-profile-role="merchant"'));
  assert.ok(dialog.includes('id="profileEditToggle"'));
  assert.ok(dialog.includes("تعديل الاسم أو الرقم"));
  assert.ok(dialog.includes('id="profileEditForm"'));
  assert.ok(dialog.includes('id="profileStoreNameInput"'));
  assert.ok(!dialog.includes('id="roleClientBtn"'));
  assert.ok(!dialog.includes('id="roleMerchantBtn"'));
  assert.ok(!dialog.includes('id="merchantBox"'));
  assert.ok(!dialog.includes('id="merchSave"'));
  assert.ok(!dialog.includes('تسجيل الاسم ورقم الجوال'));
  assert.ok(!dialog.includes('تفعيل حساب التاجر'));
  assert.ok(html.includes('$("#profileEditToggle").hidden=admin!==null||!$("#profileEditForm").hidden'));
});

test("the Add view separates advert, merchant listing and independent jobs portal actions", () => {
  const addView = html.match(/<section id="vAdd" hidden>([\s\S]*?)<\/section>\s*<!-- Home View -->/)?.[1] || "";
  for (const id of ["addFreeAdCard", "addMerchantListingCard", "addJobPortalCard", "merchantToolsPanel"]) {
    assert.ok(addView.includes('id="' + id + '"'), id);
  }
  assert.match(html, /\$\("#navAdd"\)\.addEventListener\("click",\(\)=>go\("add"\)\)/);
  assert.match(html, /\$\("#addJobPortalCard"\)\.addEventListener\("click",\(\)=>go\("jobs"\)\)/);
  assert.match(html, /\$\("#vAdd"\)\.hidden=v!=="add"/);
});

test("the app exposes one profile bridge and no second customer profile form", () => {
  const bridgeScript = read("v3.0.0.js");
  assert.match(html, /profile:\(\)=>\(\{\.\.\.S\.profile\}\)/);
  assert.match(html, /profileReady:\(\)=>!!\(S\.profile\?\.phone/);
  assert.match(html, /saveProfile:\(patch=\{\}\)=>/);
  assert.match(html, /setActiveRole:\(role\)=>/);
  assert.match(bridgeScript, /const current=bridge\(\)\?\.profile\?\.\(\)/);
  assert.match(bridgeScript, /api\.openProfileEditor\(/);
  assert.doesNotMatch(bridgeScript, /v3CustomerDialog|v3CustomerRegisterBtn|roleButtons\(\)/);
});

test("Google Play remains the only update destination and Service Worker cache is versioned", () => {
  const version = JSON.parse(read("version.json"));
  const updater = read("app-update.js");
  const sw = read("sw.js");
  assert.equal(version.androidStoreUrl, "https://play.google.com/store/apps/details?id=ye.dalilna.app");
  assert.equal(Object.hasOwn(version, "androidReleaseUrl"), false);
  assert.ok(updater.includes("window.location.assign(PLAY_STORE_URL)"));
  assert.doesNotMatch(updater, /github\.com|app-release\.apk|androidReleaseUrl/i);
  assert.ok(sw.includes('CACHE_PREFIX + "v3.1.0-profile-identity1"'));
});
