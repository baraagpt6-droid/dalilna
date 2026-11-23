"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {mapFeedItem,phoneNumber}=require("../scripts/refresh-marketplace-products.cjs");

test("merchant product feed normalizes a Yemen WhatsApp number and maps a valid phone listing",()=>{
 const item=mapFeedItem({
  id:"sku-100",title:"هاتف ذكي",productType:"phone",sellerName:"متجر الاختبار",
  phone:"777123456",governorate:"إب",district:"حبيش",price:"120000",currency:"YER",
  productUrl:"https://merchant.example/products/sku-100",imageUrl:"https://cdn.merchant.example/images/sku-100.webp",status:"available"
 });
 assert.ok(item);
 assert.equal(item.phone,"967777123456");
 assert.equal(item.productGroup,"electronics");
 assert.equal(item.currency,"YER");
 assert.equal(item.website,"https://merchant.example/products/sku-100");
 assert.equal(item.imageUrl,"https://cdn.merchant.example/images/sku-100.webp");
});
test("merchant product feed rejects incomplete inventory and invalid seller contact",()=>{
 assert.equal(mapFeedItem({id:"x",title:"جوال",productType:"phone",sellerName:"متجر",phone:"",governorate:"إب",district:"حبيش",price:"10",currency:"YER"}),null);
 assert.equal(mapFeedItem({id:"x",title:"جوال",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:"إب",district:"",price:"10",currency:"YER"}),null);
 assert.equal(mapFeedItem({id:"x",title:"جوال",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:"إب",district:"حبيش",currency:"YER"}),null);
 assert.equal(mapFeedItem({id:"x",title:"جوال",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:"محافظة وهمية",district:"حبيش",price:"10",currency:"YER"}),null);
});
test("merchant WhatsApp phone numbers are normalized and checked",()=>{
 assert.equal(phoneNumber("+967 777 123 456"),"967777123456");
 assert.equal(phoneNumber("0777123456"),"967777123456");
 assert.equal(phoneNumber("123"),"");
});

test("all commercial product groups map through the supported OSM marketplace taxonomy",()=>{
 const base={id:"sku",title:"عرض",sellerName:"متجر",phone:"777123456",governorate:"إب",district:"حبيش",price:"100",currency:"YER",imageUrl:"https://cdn.merchant.example/product.webp"};
 for(const [productType,group] of [
  ["phone","electronics"],["computer","electronics"],["motorcycle","vehicles"],
  ["vehicle_parts","vehicles"],["house","property"],["solar_panel","solar"],
  ["battery","solar"],["furniture","home"],["livestock","agriculture"],
  ["tools","agriculture"],["clothing","clothing"],["perfume","clothing"]
 ]){
  const item=mapFeedItem({...base,id:productType,productType});
  assert.equal(item?.productGroup,group,productType);
 }
});
test("sold and unavailable products never re-enter the published feed snapshot",()=>{
 const base={id:"sku",title:"عرض",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:"إب",district:"حبيش",price:"100",currency:"YER",imageUrl:"https://cdn.merchant.example/product.webp"};
 for(const status of ["sold","deleted","expired","inactive","unavailable","out_of_stock"])assert.equal(mapFeedItem({...base,status}),null,status);
 assert.equal(mapFeedItem({...base,active:false}),null);
});

test("merchant feed requires a public HTTPS product image",()=>{
 const base={id:"image-check",title:"عرض",productType:"phone",sellerName:"متجر",phone:"777123456",governorate:"إب",district:"حبيش",price:"100",currency:"YER"};
 assert.equal(mapFeedItem({...base,imageUrl:"http://cdn.example/product.jpg"}),null);
 assert.equal(mapFeedItem({...base,imageUrl:"https://user:pass@cdn.example/product.jpg"}),null);
 assert.equal(mapFeedItem(base),null);
});
