"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("customer and merchant identities share a phone but persist separate names and active role", () => {
  const html = read("index.html");
  assert.match(html, /profile:\{customerName:"",storeName:"",phone:"",activeRole:"customer"\}/);
  assert.match(html, /customerName:cleanText\(profileRaw\.customerName\|\|legacyCustomer\.customerName\|\|legacyCustomer\.name/);
  assert.match(html, /storeName:cleanText\(profileRaw\.storeName\|\|legacyMerchant\.storeName\|\|legacyMerchant\.name/);
  assert.match(html, /activeRole:profileRaw\.activeRole==="merchant"/);
  assert.match(html, /S\.profile=\{customerName,storeName,phone,activeRole:current\.activeRole==="merchant"\?"merchant":"customer"\}/);
  assert.match(html, /S\.session=profile\.activeRole==="merchant"/);
  assert.match(html, /profile\.activeRole==="merchant"\?profile\.storeName:profile\.customerName/);
  assert.ok(html.includes('data-profile-role="customer"'));
  assert.ok(html.includes('data-profile-role="merchant"'));
  assert.ok(html.includes('id="profileEditForm"'));
  assert.ok(html.includes('id="profileStoreNameInput"'));
  assert.ok(html.includes('id="profileCustomerNameInput"'));
  assert.ok(html.includes('id="profilePhoneInput"'));
  assert.ok(!html.includes('id="roleClientBtn"'));
  assert.ok(!html.includes('id="roleMerchantBtn"'));
  assert.ok(!html.includes('id="merchantBox"'));
  assert.ok(!html.includes('id="merchSave"'));
});

test("switching a customer to merchant asks for storeName and preserves the customer name and shared phone", () => {
  const html = read("index.html");
  assert.match(html, /function setProfileRole\(role,options=\{\}\)/);
  assert.match(html, /if\(nextRole==="merchant"&&!S\.profile\.storeName\)openProfileEditor\(\{merchantSetup:true\}\)/);
  assert.match(html, /const hasCustomer=!!\(profile\.customerName&&profile\.phone\)/);
  assert.match(html, /const customerName=\$\("#profileCustomerNameRow"\)\.hidden\?current\.customerName/);
  assert.match(html, /const storeName=\$\("#profileStoreNameRow"\)\.hidden\?current\.storeName/);
  assert.match(html, /const phone=\$\("#profilePhoneRow"\)\.hidden\?current\.phone/);
  assert.match(html, /S\.profile=\{customerName,storeName,phone,activeRole:current\.activeRole==="merchant"\?"merchant":"customer"\}/);
  assert.match(html, /profile\.activeRole==="merchant"&&profile\.storeName&&profile\.phone/);
});

test("account dialog uses one role card and an explicit inline edit action", () => {
  const html = read("index.html");
  const dialog = html.match(/<dialog id="accountDlg">([\s\S]*?)<\/dialog>/)?.[1] || "";
  assert.ok(dialog.includes('id="profilePanel"'));
  assert.ok(dialog.includes('id="v3RoleSwitcher"'));
  assert.ok(dialog.includes('id="profileEditToggle"'));
  assert.ok(dialog.includes('id="profileEditForm"'));
  assert.ok(dialog.includes("تعديل الاسم أو الرقم"));
  assert.ok(!dialog.includes('id="roleClientBtn"'));
  assert.ok(!dialog.includes('id="roleMerchantBtn"'));
  assert.ok(!dialog.includes('id="merchantBox"'));
  assert.ok(!dialog.includes('id="merchSave"'));
  assert.ok(!dialog.includes('id="v3CustomerRegisterBtn"'));
});

test("the Add tab is a dedicated hub with independent advert, shop and jobs actions", () => {
  const html = read("index.html");
  const addView = html.match(/<section id="vAdd" hidden>([\s\S]*?)<\/section>\s*<!-- Home View -->/)?.[1] || "";
  assert.ok(addView.includes('id="addFreeAdCard"'));
  assert.ok(addView.includes('id="addMerchantListingCard"'));
  assert.ok(addView.includes('id="addJobPortalCard"'));
  assert.ok(addView.includes('id="merchantToolsPanel"'));
  assert.match(html, /\$\("#navAdd"\)\.addEventListener\("click",\(\)=>go\("add"\)\)/);
  assert.match(html, /\$\("#addJobPortalCard"\)\.addEventListener\("click",\(\)=>go\("jobs"\)\)/);
  assert.match(html, /const active=S\.session\.role==="merchant"&&profile\.activeRole==="merchant"&&!!profile\.storeName&&!!profile\.phone/);
});

test("the profile bridge exposes the unified local profile without creating a second registration store", () => {
  const html = read("index.html");
  const customerUi = read("v3.0.0.js");
  assert.match(html, /profile:\(\)=>\(\{\.\.\.S\.profile\}\)/);
  assert.match(html, /profileReady:\(\)=>!!\(S\.profile\?\.phone/);
  assert.match(html, /setActiveRole:\(role\)=>\{setProfileRole\(role/);
  assert.match(customerUi, /const current=bridge\(\)\?\.profile\?\.\(\)/);
  assert.match(customerUi, /api\.openProfileEditor\(/);
  assert.doesNotMatch(customerUi, /localStorage\.setItem\("dalilna-v3-customer-profile"/);
  assert.doesNotMatch(customerUi, /v3CustomerRegisterBtn|v3CustomerDialog/);
});

test("administrator login validates a device-local credential list, not a remote auth account", () => {
  const html = read("index.html");
  assert.match(html, /\$\("#adminLoginForm"\)\.addEventListener\("submit",async e=>/);
  assert.match(html, /const adm=S\.admins\.find\(a=>a\.email\.toLowerCase\(\)===email&&a\.hash===h\)/);
  assert.match(html, /S\.session=\{role:"admin",adminEmail:adm\.email/);
});

test("new shop submissions are retained locally and forwarded to shared marketplace moderation", () => {
  const html = read("index.html");
  const marketplace = read("marketplace-client.js");
  assert.match(html, /\$\("#f"\)\.addEventListener\("submit"/);
  assert.match(html, /const obj=\{/);
  assert.match(html, /S\.items\.unshift\(obj\)/);
  assert.match(html, /window\.DalilnaShared\.submitListing\(obj\)/);
  assert.match(html, /saveState\(\);buildScopeSelector\(\);render\(\)/);
  assert.match(marketplace, /async function submitListing\(item\)/);
  assert.match(marketplace, /api\("\/api\/marketplace\/listings",\s*\{/);
  assert.match(marketplace, /method:\s*"POST"/);
  assert.match(marketplace, /"تم استلام الإعلان\. سيظهر لجميع المستخدمين بعد موافقة الإدارة\."/);
});

test("directory favourites update local state and are persisted on the device", () => {
  const html = read("index.html");
  const favoritesUi = read("v3.0.0.js");
  assert.match(html, /const f=e\.target\.closest\("\\?\[data-fav\]"/);
  assert.match(html, /if\(ix>=0\)S\.favs\.splice\(ix,1\);else S\.favs\.push\(id\)/);
  assert.match(html, /saveState\(\);\s*window\.dispatchEvent\(new CustomEvent\("dalilna:favorite-change"/);
  assert.match(html, /setDirectoryFavorite:\(id,shouldSave\)=>/);
  assert.match(favoritesUi, /market:"dalilna-marketplace-favs-v1"/);
  assert.match(favoritesUi, /jobs:"dalilna-job-favs-v1"/);
  assert.match(favoritesUi, /write\(KEYS\.market,/);
  assert.match(favoritesUi, /write\(KEYS\.jobs,/);
});

test("the profile remains a device-local record without cross-device synchronization", () => {
  const html = read("index.html");
  const privacy = read("privacy.html");
  const safety = read("GOOGLE_PLAY_DATA_SAFETY.md");
  assert.match(html, /يُحفظ اسم المستفيد واسم المحل ورقم الجوال الموحد محلياً على هذا الجهاز/);
  assert.match(privacy, /not automatically synchronized between devices/);
  assert.match(privacy, /لا تتم مزامنة هذه البيانات الشخصية المحلية تلقائياً بين الأجهزة/);
  assert.match(safety, /do not synchronize profile data across devices/);
});
