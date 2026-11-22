"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs");
const {validate,PRODUCT_TYPES,CATEGORIES,GOVERNORATES,PRODUCT_GROUPS}=require("../marketplace-api");
test("taxonomy covers Yemen service categories and product types",()=>{assert.equal(GOVERNORATES.size,22);for(const x of ["phone","phone_accessories","watch","car","motorcycle","land","property","apartment","house","honey","coffee","stationery","perfume","cosmetics","solar_equipment","solar_panel","battery","inverter","power_system","screen","monitor","charger","audio_accessories","tools","baby_products","construction_equipment"])assert.ok(PRODUCT_TYPES.has(x));for(const x of ["jobs","souq","grocery","health","pharmacy"])assert.ok(CATEGORIES.has(x));});
test("normalizes a used phone listing",()=>{const x=validate({title:"هاتف",category:"souq",productType:"phone",condition:"used",governorate:"إب",district:"حبيش",area:"ربع ظلمة",clientRef:"local-1"});assert.equal(x.productType,"phone");assert.equal(x.condition,"used");assert.equal(x.governorate,"إب");assert.equal(x.clientRef,"local-1");});
test("accepts land and property as classified marketplace listings",()=>{
 const land=validate({title:"أرض للبيع",category:"land",productType:"land",listingType:"sale",governorate:"إب",district:"حبيش"});
 assert.equal(land.category,"land");
 assert.equal(land.productType,"land");
 const property=validate({title:"منزل",category:"land",productType:"property",governorate:"عدن"});
 assert.equal(property.productType,"property");
});
test("requires expiry dates only for jobs",()=>{assert.equal(validate({title:"وظيفة",category:"jobs",deadline:"2026-12-31"}).deadline,"2026-12-31");assert.throws(()=>validate({title:"ساعة",category:"souq",productType:"watch",deadline:"2026-12-31"}),/مخصص للوظائف/);});
test("rejects invalid categories, product types and governorates",()=>{assert.throws(()=>validate({title:"x",category:"nonsense"}),/القسم المحدد غير معروف/);assert.throws(()=>validate({title:"x",category:"souq",productType:"weapon"}),/نوع المعروض غير معروف/);assert.throws(()=>validate({title:"x",category:"souq",governorate:"خيالية"}),/اختر محافظة يمنية/);});
test("rejects unsafe or oversized image data",()=>{assert.throws(()=>validate({title:"x",category:"grocery",img:"https://example.com/a.jpg"}),/صيغة الصورة غير مدعومة/);assert.throws(()=>validate({title:"x",category:"souq",img:"data:image/jpeg;base64,"+"A".repeat(400001)}),/حجم الصورة أكبر/);});
test("validates coordinate pairs and currency",()=>{assert.throws(()=>validate({title:"x",category:"grocery",latitude:15.3}),/أرسل خط العرض وخط الطول معاً/);assert.throws(()=>validate({title:"x",category:"grocery",currency:"BTC"}),/العملة غير معروفة/);assert.equal(validate({title:"محل",category:"grocery",latitude:15.3,longitude:44.2}).latitude,15.3);});

test("preserves opening hours, safe website links and optional map coordinates",()=>{
 const x=validate({title:"مكتبة",category:"books",hours:"8 صباحاً - 10 مساءً",website:"example.org",latitude:15.3694,longitude:44.1910});
 assert.equal(x.openingHours,"8 صباحاً - 10 مساءً");
 assert.equal(x.website,"https://example.org/");
 assert.equal(x.latitude,15.3694);
 assert.equal(x.longitude,44.191);
 assert.throws(()=>validate({title:"مكتبة",category:"books",website:"javascript:alert(1)"}),/يجب أن يبدأ رابط الموقع/);
 assert.throws(()=>validate({title:"مكتبة",category:"books",website:"https://user:pass@example.org"}),/يجب أن يبدأ رابط الموقع/);
});
test("shared listings SQL migration adds backward-compatible shop detail columns",()=>{
 const sql=fs.readFileSync("db/schema.sql","utf8");
 assert.match(sql,/ADD COLUMN IF NOT EXISTS opening_hours/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS website/);
 assert.match(sql,/VALUES\(1\),\(2\) ON CONFLICT/);
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.match(source,/opening_hours,website,seller_name/);
 assert.match(source,/item\.openingHours,item\.website/);
 assert.match(source,/openingHours:row\.opening_hours/);
 assert.match(source,/website:row\.website/);
});


test("supports apartment and house rentals in the land and property category",()=>{
 const apartment=validate({title:"شقة للإيجار",category:"land",productType:"apartment",listingType:"rent",governorate:"إب"});
 const house=validate({title:"منزل للبيع",category:"land",productType:"house",listingType:"sale",governorate:"تعز"});
 assert.equal(apartment.productType,"apartment");assert.equal(apartment.listingType,"rent");
 assert.equal(house.productType,"house");assert.equal(house.listingType,"sale");
});


test("marketplace exposes exactly seven browseable product groups",()=>{
 const keys=Object.keys(PRODUCT_GROUPS);
 assert.deepEqual(keys,["electronics","vehicles","property","solar","home","agriculture","clothing"]);
});
test("rent is restricted to homes, land and vehicles",()=>{
 const valid=validate({title:"سيارة للإيجار",category:"souq",productType:"car",listingType:"rent"});
 assert.equal(valid.listingType,"rent");
 assert.throws(()=>validate({title:"جوال للإيجار",category:"souq",productType:"phone",listingType:"rent"}),/خيار الإيجار مخصص/);
});


test("supports validated listingType filtering for rental searches",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.ok(source.includes('listingType=clean(url.searchParams.get("listingType"),16)'));
 assert.ok(source.includes('add("listing_type = ?",listingType)'));
 const rent=validate({title:"شقة للإيجار",category:"land",productType:"apartment",listingType:"rent"});
 assert.equal(rent.listingType,"rent");
});

test("shared marketplace exposes grouped approved listing counts",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.match(source,/async function counts\(req,res\)/);
 assert.match(source,/GROUP BY governorate,category/);
 assert.ok(source.includes('r==="counts"'));
 assert.ok(source.includes('r==="feed-sync"'));
 assert.ok(source.includes("DALILNA_PRODUCT_SYNC_TOKEN"));
 assert.ok(source.includes("completeSnapshot"));
 assert.ok(source.includes("ON CONFLICT(client_ref) DO UPDATE"));
});


test("supports product-group marketplace filtering",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.match(source,/PRODUCT_GROUPS/);
 assert.match(source,/product_type = ANY/);
 assert.ok(source.includes('group=clean(url.searchParams.get("productGroup"),32)'));
});
test("marketplace list query selects expiry timestamp for the 60-day card label",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.match(source,/updated_at,expires_at,COUNT\(\*\) OVER\(\) AS total_count/);
});
test("marketplace public records return their expiry timestamp",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.match(source,/expiresAt:row\.expires_at/);
});

test("daily merchant feed endpoint is authenticated, idempotent and retires missing feed products only on a complete snapshot",()=>{
 const source=fs.readFileSync("marketplace-api.js","utf8");
 assert.ok(source.includes('r==="feed-sync"&&req.method==="POST"'));
 assert.ok(source.includes("DALILNA_PRODUCT_SYNC_TOKEN"));
 assert.ok(source.includes("crypto.timingSafeEqual"));
 assert.ok(source.includes("ON CONFLICT(client_ref) DO UPDATE"));
 assert.ok(source.includes("completeSnapshot"));
 assert.ok(source.includes("client_ref=ANY($1::text[])"));
 assert.ok(source.includes("status='archived'"));
});
test("merchant product feed is processed in batches and only the last batch may retire stale products",()=>{
 const feed=fs.readFileSync("scripts/refresh-marketplace-products.cjs","utf8");
 const api=fs.readFileSync("marketplace-api.js","utf8");
 assert.ok(feed.includes("MAX_ITEMS=5000,MAX_BATCH=200"));
 assert.ok(feed.includes("for(let offset=0;offset<items.length;offset+=MAX_BATCH)"));
 assert.ok(feed.includes("activeClientRefs:completeSnapshotForBatch?activeClientRefs:[]"));
 assert.ok(api.includes("activeRefs.every(ref=>activeClientRefs.includes(ref))"));
 assert.ok(api.includes("NOT (client_ref=ANY($1::text[]))"));
});
test("merchant product feed rejects unsafe URLs and never prunes on an empty snapshot",()=>{
 const feed=fs.readFileSync("scripts/refresh-marketplace-products.cjs","utf8");
 assert.ok(feed.includes("validatePublicFeedUrl"));
 assert.ok(feed.includes('url.protocol!=="https:"'));
 assert.ok(feed.includes('redirect:"error"'));
 assert.ok(feed.includes("Empty feed snapshot is not allowed"));
});
test("solar, screen, battery and inverter products are valid marketplace items",()=>{
 for(const productType of ["solar_equipment","solar_panel","battery","inverter","power_system","screen","monitor","charger","audio_accessories"]) {
  assert.ok(PRODUCT_TYPES.has(productType),productType);
 }
});
