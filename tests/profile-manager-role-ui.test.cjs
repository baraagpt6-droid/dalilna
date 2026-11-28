"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const manager = read("profile-manager.js");
const sw = read("sw.js");

function block(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0 && end > start, startToken + " section exists");
  return source.slice(start, end);
}

test("customer editor shows customer fields and hides merchant-only fields", () => {
  const applyRole = block(manager, "function applyRole(selectedRole)", "function open(options)");
  assert.match(applyRole, /show\("profileCustomerNameRow",!merchant\)/);
  assert.match(applyRole, /show\("profileCustomerCityRow",!merchant\)/);
  assert.match(applyRole, /show\("profileStoreNameRow",merchant\)/);
  assert.match(applyRole, /show\("profileStoreCategoryRow",merchant\)/);
  assert.match(applyRole, /show\("profileStoreCityRow",merchant\)/);
  assert.match(applyRole, /show\("profileStoreAreaRow",merchant\)/);
  assert.match(applyRole, /show\("merchantSyncPanel",merchant\)/);
  assert.match(applyRole, /profilePhoneLabel/);
});

test("customer dashboard hides shop metrics and the free-ad countdown", () => {
  const render = block(manager, "function render()", "function save(event)");
  assert.match(render, /show\("profileMerchantCard",merchant && !admin\)/);
  assert.match(render, /show\("profileDaysLeft",merchant && !admin\)/);
  assert.match(render, /show\("profileShopsMetric",merchant && !admin\)/);
  assert.match(render, /show\("profileLocation",!merchant && !admin\)/);
  assert.match(render, /merchant \? local\.marketplaceAds\.length \+ local\.otherAds\.length \+ publicAds : local\.marketplaceAds\.length/);
  const panel = block(html, 'const list=$("#profileActivityList")', 'document.addEventListener("click"');
  assert.match(panel, /:section\(english\?"My marketplace adverts":"إعلاناتي في السوق"/);
  assert.doesNotMatch(panel, /:section\(english\?"My shops":"محلاتي"/);
});

test("merchant setup requires store details and offers public-record lookup", () => {
  const dialog = html.match(/<dialog id="accountDlg">([\s\S]*?)<\/dialog>/)?.[1] || "";
  for (const id of [
    "merchantSyncPanel", "merchantSyncPhoneInput", "merchantSyncButton",
    "profileStoreNameInput", "profileStoreCategoryInput", "profileStoreCityInput",
    "profileStoreAreaInput", "profilePhoneInput", "profileMerchantCard",
    "profileMerchantQuickActions", "profileAddShopButton", "profileAddAdButton"
  ]) assert.ok(dialog.includes('id="' + id + '"'), id);
  for (const id of ["profileCustomerCityInputButton","profileCustomerCityInputLabel","profileStoreCategoryInputButton","profileStoreCategoryInputLabel","profileStoreCityInputButton","profileStoreCityInputLabel"]) assert.ok(dialog.includes('id="' + id + '"'), id);
  assert.match(dialog, /id="profileCustomerCityInput" type="hidden"/);
  assert.match(dialog, /id="profileStoreCategoryInput" type="hidden"/);
  assert.match(dialog, /id="profileStoreCityInput" type="hidden"/);
  assert.doesNotMatch(dialog, /<select[^>]+id="(?:profileCustomerCityInput|profileStoreCategoryInput|profileStoreCityInput)"/);
  const save = block(manager, "function save(event)", "function categoryFromRecord");
  assert.match(save, /if \(!patch\.storeName \|\| !patch\.storeCategory \|\| !patch\.storeCity\)/);
  assert.match(save, /patch\.merchantCreatedAt = current\.merchantCreatedAt \|\| Date\.now\(\)/);
  const sync = block(manager, "async function syncMerchant()", "function init()");
  assert.match(sync, /window\.DalilnaShared\?\.findPublicSellerRecords/);
  assert.match(sync, /storeName:first\.sellerName/);
  assert.match(sync, /storeCategory:categoryFromRecord\(first\)/);
  assert.match(sync, /storeCity:first\.governorate/);
  assert.match(sync, /\$\("profilePhoneInput"\)\.value = phone/);
  assert.doesNotMatch(sync, /saveProfile|updateListing|method:\s*["']PATCH/i);
  assert.match(sync, /يتم عرض بيانات المتجر المرتبطة برقمك للمعاينة السريعة، وتخضع التعديلات المنشورة لمراجعة الإدارة لحماية حسابات التجار/);
});

test("seller dashboard exposes its two direct actions and merchant sections", () => {
  const render = block(manager, "function render()", "function save(event)");
  assert.match(render, /show\("profileMerchantQuickActions",merchant && !admin && ready\(p\)\)/);
  assert.match(render, /show\("profileShopsMetric",merchant && !admin\)/);
  assert.match(render, /show\("profileDaysLeft",merchant && !admin\)/);
  const panel = block(html, 'const list=$("#profileActivityList")', 'document.addEventListener("click"');
  assert.match(panel, /section\(english\?"My shops":"محلاتي"/);
  assert.match(panel, /section\(english\?"My marketplace adverts":"إعلاناتي في السوق"/);
});

test("Arabic profile messages avoid raw service and network error codes", () => {
  const sync = block(manager, "async function syncMerchant()", "function init()");
  assert.match(sync, /catch \(_\) \{\s*write\("merchantSyncStatus"/);
  assert.match(sync, /تعذر جلب الإعلانات الآن/);
  assert.match(sync, /يمكنك إكمال بيانات المتجر يدوياً/);
  assert.doesNotMatch(sync, /write\("merchantSyncStatus"[^\n]*error/i);
  assert.ok(html.includes('id="roleAdminBtn"'));
  assert.ok(html.includes("دخول المشرف"));
  assert.ok(html.includes("window.DalilnaOpenCustomPicker=openCustomPicker"));
  assert.ok(html.includes("sheet-opt-icon"));
  assert.ok(html.includes("profileDefaultGovernorateBtn"));
});

test("the service worker cache is versioned for the published profile manager", () => {
  assert.match(sw, /const CACHE_NAME = CACHE_PREFIX \+ "v3\.1\.0-ui-unified1"/);
  assert.ok(sw.includes("./profile-manager.js?v=3.1.0-ui-unified1"));
  assert.ok(sw.includes('url.pathname.endsWith("/profile-manager.js")'));
});
