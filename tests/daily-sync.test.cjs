"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {mapFeedItem,phoneNumber,canonicalLocation,canonicalProductType,canonicalCurrency}=require("../scripts/refresh-marketplace-products.cjs");
const {PRODUCT_GROUPS}=require("../marketplace-api");
const manifest=require("../regional-catalog/manifest.json");
const firstDistrict=manifest.districtCounts.find(row=>row.district&&row.governorate);

test("merchant feed canonicalizes Arabic governorate and district names from the national index",()=>{
 assert.ok(firstDistrict);
 const resolved=canonicalLocation(firstDistrict.governorate,firstDistrict.district);
 assert.deepEqual(resolved,{governorate:firstDistrict.governorate,district:firstDistrict.district});
 assert.equal(canonicalLocation(firstDistrict.governorate,"مديرية غير موجودة"),null);
});

test("Yemen district lookup folds hamza, taa marbuta and the definite article",()=>{
 const sample=manifest.districtCounts.find(row=>row.district);
 assert.ok(sample);
 const variant=sample.district.replace(/^ال/,"").replace(/ة/g,"ه").replace(/[أإآ]/g,"ا");
 assert.deepEqual(canonicalLocation(sample.governorate,variant),{governorate:sample.governorate,district:sample.district});
});

test("marketplace product groups are exactly seven and every product type has one group",()=>{
 assert.deepEqual(Object.keys(PRODUCT_GROUPS),["electronics","vehicles","property","solar","home","agriculture","clothing"]);
 const values=Object.values(PRODUCT_GROUPS).flat();
 assert.equal(new Set(values).size,values.length,"A product type must not appear in two group tabs.");
});

test("merchant feed validates price, seller phone, district and maps a valid product group",()=>{
 const row=mapFeedItem({
  id:"phone-001",title:"هاتف تجريبي",productType:"smartphone",
  sellerName:"متجر الاختبار",phone:"777123456",governorate:firstDistrict.governorate,
  district:firstDistrict.district,price:"150,000",currency:"ريال يمني",listingType:"sale",condition:"used"
 });
 assert.ok(row);
 assert.equal(row.productType,"phone");
 assert.equal(row.productGroup,"electronics");
 assert.equal(row.governorate,firstDistrict.governorate);
 assert.equal(row.district,firstDistrict.district);
 assert.equal(row.price,"150000");
 assert.equal(row.currency,"YER");
 assert.equal(mapFeedItem({id:"missing-price",title:"بدون سعر",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:firstDistrict.governorate,district:firstDistrict.district}),null);
});

test("Yemen phone numbers and currency aliases normalize safely",()=>{
 assert.equal(phoneNumber("0777123456"),"967777123456");
 assert.equal(phoneNumber("+967 777 123 456"),"967777123456");
 assert.equal(canonicalCurrency("ريال سعودي"),"SAR");
 assert.equal(canonicalCurrency("دولار"),"USD");
 assert.equal(canonicalProductType("سيارة"),"car");
 assert.equal(canonicalProductType("معدات غير معروفة"),"");
});

test("inactive and expired merchant feed entries are excluded",()=>{
 assert.equal(mapFeedItem({id:"sold-1",title:"Sold phone",status:"sold"}),null);
 assert.equal(mapFeedItem({id:"inactive-1",title:"Inactive phone",active:false}),null);
});
