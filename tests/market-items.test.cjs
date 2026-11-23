"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const data=JSON.parse(fs.readFileSync("market_items.json","utf8"));
const client=fs.readFileSync("marketplace-client.js","utf8");
test("local marketplace reference catalogue covers the seven marketplace groups",()=>{
 const expected=["electronics","vehicles","property","solar","home","agriculture","clothing"];
 assert.deepEqual(data.groupNames,expected);
 assert.ok(Array.isArray(data.items));
 assert.ok(data.items.length>=21);
 for(const group of expected)assert.ok(data.items.some(item=>item.group===group),group);
});
test("reference catalogue entries are not represented as real seller advertisements",()=>{
 assert.equal(data.purpose,"reference_catalog_only");
 assert.ok(data.items.every(item=>item.category==="souq"&&!item.phone&&!item.price&&!item.sellerName&&!item.listingType));
 assert.ok(data.noticeAr.includes("ليست إعلانات بيع حقيقية"));
 assert.ok(client.includes("catalogOnly: true"));
 assert.ok(client.includes("كتالوج استرشادي · ليس إعلان بائع"));
 assert.ok(client.includes("./market_items.json?v=2.7.1"));
});
