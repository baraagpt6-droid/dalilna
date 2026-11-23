"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const data=JSON.parse(fs.readFileSync("market_items.json","utf8"));
const client=fs.readFileSync("marketplace-client.js","utf8");
test("local marketplace fallback never invents seller adverts or prices",()=>{
 assert.equal(data.purpose,"approved_seller_listings_only");
 assert.deepEqual(data.groupNames,["electronics","vehicles","property","solar","home","agriculture","clothing"]);
 assert.deepEqual(data.items,[]);
 assert.ok(client.includes('category: "marketplace"'));
 assert.ok(!client.includes("local-reference-catalog"));
 assert.ok(!client.includes("كتالوج استرشادي · ليس إعلان بائع"));
});
test("market cards do not show empty image placeholders and offer WhatsApp sharing",()=>{
 assert.ok(!client.includes("shared-listing-image-fallback no-image"));
 assert.ok(client.includes("مشاركة واتساب"));
 assert.ok(client.includes("https://wa.me/?text="));
 assert.ok(client.includes("google.com/maps/search/?api=1&query="));
});
