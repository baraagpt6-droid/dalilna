"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const guide=require("../scripts/refresh-market-prices.cjs");
test("market reference dataset has all requested groups with dated sources and local illustrations",()=>{
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,"../market_prices_yemen.json"),"utf8"));
 assert.deepEqual(data.categories.map(x=>x.id),["solar","electronics","vehicles","property"]);
 assert.ok(data.items.length>=10);
 for(const item of data.items){
  assert.ok(item.sourceUrl.startsWith("https://"),item.id);
  assert.ok(item.sourceCheckedAt,item.id);
  assert.ok(fs.existsSync(path.join(__dirname,"../market-price-images",item.image)),item.image);
  assert.ok(["solar","electronics","vehicles","property"].includes(item.category),item.category);
 }
 assert.ok(data.items.some(x=>x.pricing?.sourceZone==="sanaa"));
 assert.ok(data.items.some(x=>x.pricing?.sourceZone==="aden"));
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
