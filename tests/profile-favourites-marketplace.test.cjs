"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("customer profile and merchant role setup persist as a local-device profile", () => {
  const html = read("index.html");
  assert.match(html, /const STORE_KEY="dalilna_app_v6"/);
  assert.match(html, /function saveState\(\)[\s\S]*?localStorage\.setItem\(STORE_KEY,serialized\)/);
  assert.match(html, /\$\("#roleClientBtn"\)\.addEventListener\("click"/);
  assert.match(html, /\$\("#roleMerchantBtn"\)\.addEventListener\("click"/);
  assert.match(html, /\$\("#merchSave"\)\.addEventListener\("click"/);
  assert.match(html, /S\.merchantProfile=\{name,phone,area:/);
  assert.match(html, /S\.session=\{role:"merchant",adminEmail:"",merchant:\{name,phone\}\}/);
  assert.match(html, /لا يمثل حساباً مركزياً موثقاً|لا يستخدم دليلنا حالياً نظام مصادقة مركزي/);
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
  assert.match(html, /const f=e\.target\.closest\("\[data-fav\]"\)/);
  assert.match(html, /if\(ix>=0\)S\.favs\.splice\(ix,1\);else S\.favs\.push\(id\)/);
  assert.match(html, /saveState\(\);\s*window\.dispatchEvent\(new CustomEvent\("dalilna:favorite-change"/);
  assert.match(html, /setDirectoryFavorite:\(id,shouldSave\)=>/);
  assert.match(favoritesUi, /market:"dalilna-marketplace-favs-v1"/);
  assert.match(favoritesUi, /jobs:"dalilna-job-favs-v1"/);
  assert.match(favoritesUi, /write\(KEYS\.market,/);
  assert.match(favoritesUi, /write\(KEYS\.jobs,/);
});

test("the contract explicitly excludes cross-device profile and favourites synchronization", () => {
  const html = read("index.html");
  const privacy = read("privacy.html");
  const safety = read("GOOGLE_PLAY_DATA_SAFETY.md");
  assert.match(html, /لا يستخدم دليلنا حالياً نظام مصادقة مركزي/);
  assert.match(privacy, /not automatically synchronized between devices/);
  assert.match(privacy, /لا تتم مزامنة هذه البيانات الشخصية المحلية تلقائياً بين الأجهزة/);
  assert.match(safety, /do not synchronize profile data across devices/);
});
