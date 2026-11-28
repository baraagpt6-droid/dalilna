"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("v3.0.0.css");

test("the unified profile has distinct customerName and storeName fields", () => {
  assert.match(html, /profile:\{customerName:"",customerCity:"",storeName:"",storeCategory:"",storeCity:"",storeArea:"",merchantCreatedAt:0,phone:"",activeRole:"customer"\}/);
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
  assert.match(html, /S\.session=profile\.activeRole==="merchant"\s*\?\{role:"merchant"/);
  assert.match(html, /function merchantProfileReady\(profile=S\.profile\)/);
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
  assert.ok(dialog.includes("تعديل البيانات"));
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

test("Arabic profile headings reserve space for descenders and avoid clipping", () => {
  assert.match(css, /#accountDlg \.dlg-body > h2,[\s\S]*?#accountDlg \.dlg-body > \.panel h3\s*\{[\s\S]*?line-height:\s*1\.55[\s\S]*?padding-bottom:\s*4px[\s\S]*?overflow:\s*visible/);
  assert.ok(html.includes("لا توجد إعلانات سوق مرتبطة برقم هذا الحساب."));
  assert.ok(!html.includes("لا توجد إعلانات سوق مرتبطة برقم هذا التاجر."));
});

test("switching account role closes the open edit form before changing role", () => {
  const start = html.indexOf('document.querySelectorAll("#v3RoleSwitcher [data-profile-role]")');
  const end = html.indexOf('$("#profileEditToggle").addEventListener', start);
  assert.ok(start >= 0 && end > start, "role switch listener exists");
  const handler = html.slice(start, end);
  const closeForm = handler.indexOf('$("#profileEditForm").hidden=true');
  const clearCallback = handler.indexOf("profileAfterSave=null");
  const switchRole = handler.indexOf("setProfileRole(role)");
  assert.ok(closeForm >= 0 && closeForm < switchRole, "the editor closes before the role is switched");
  assert.ok(clearCallback >= 0 && clearCallback < switchRole, "an edit callback from the previous form is discarded");
  assert.ok(handler.includes('$("#profileEditToggle").hidden=false'));
});

test("Google Play remains the only update destination and Service Worker cache is versioned", () => {
  const version = JSON.parse(read("version.json"));
  const updater = read("app-update.js");
  const sw = read("sw.js");
  assert.equal(version.androidStoreUrl, "https://play.google.com/store/apps/details?id=ye.dalilna.app");
  assert.equal(Object.hasOwn(version, "androidReleaseUrl"), false);
  assert.ok(updater.includes("window.location.assign(PLAY_STORE_URL)"));
  assert.doesNotMatch(updater, /github\.com|app-release\.apk|androidReleaseUrl/i);
  assert.ok(sw.includes('CACHE_PREFIX + "v3.1.0-ui-unified1"'));
  assert.ok(sw.includes("./profile-manager.js?v=3.1.0-ui-unified1"));
});
