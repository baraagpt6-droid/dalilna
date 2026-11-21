"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const test=require("node:test");
const html=fs.readFileSync("index.html","utf8");
const client=fs.readFileSync("marketplace-client.js","utf8");
const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(match=>!/\bsrc\s*=/.test(match[1])&&match[2].trim())
 .map(match=>match[2]);
test("all inline JavaScript in the PWA parses",()=>{
 assert.ok(inline.length>=2,"expected inline application scripts");
 inline.forEach((code,index)=>new vm.Script(code,{filename:"index.html:inline-script-"+index}));
});
test("shared marketplace client parses",()=>{
 new vm.Script(client,{filename:"marketplace-client.js"});
});
test("smart search maps school supplies and vehicles to their real place categories",()=>{
 assert.match(html,/productType:product\?product\.productType/);
 assert.match(html,/label:"مكتبات وقرطاسيات"/);
 assert.match(html,/test:\/\(قلم\|اقلام\|دفتر/);
 assert.match(html,/loadLiveMarketplaceMatches/);
 assert.match(html,/params\.set\("category","marketplace"\)/);\n assert.match(html,/params\.set\("productType",productType\)/);
 assert.match(html,/liveFetchJson\("\/api\/places\/search/);
});
test("PWA and Android WebView marketplace assets stay byte-for-byte aligned",()=>{
 for(const name of ["index.html","sw.js","marketplace-client.js"]) {
  assert.equal(fs.readFileSync("android/app/src/main/assets/"+name,"utf8"),fs.readFileSync(name,"utf8"),name+" differs between web and Android");
 }
});
test("marketplace form exposes the requested product subtypes",()=>{
 for(const item of ["phone","phone_accessories","watch","computer_accessories","car","motorcycle","land","property","honey","coffee","livestock","stationery","perfume","cosmetics","solar_equipment","tools","baby_products","construction_equipment"])assert.ok(html.includes('value="'+item+'"'),"missing product subtype "+item);
});
