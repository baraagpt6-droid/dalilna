"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {mapFeedItem,phoneNumber}=require("../scripts/refresh-marketplace-products.cjs");

test("merchant product feed normalizes a Yemen WhatsApp number and maps a valid phone listing",()=>{
 const item=mapFeedItem({
  id:"sku-100",title:"هاتف ذكي",productType:"phone",sellerName:"متجر الاختبار",
  phone:"777123456",governorate:"إب",district:"حبيش",price:"120000",currency:"YER",
  productUrl:"https://merchant.example/products/sku-100",status:"available"
 });
 assert.ok(item);
 assert.equal(item.phone,"967777123456");
 assert.equal(item.productGroup,"electronics");
 assert.equal(item.currency,"YER");
 assert.equal(item.website,"https://merchant.example/products/sku-100");
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
